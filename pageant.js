// The Paradise — 👑 Miss & Mister Paradise : chaque mois, les membres s'inscrivent et tout le monde vote (1 vote par jour et par catégorie)
// À la fin du mois, les gagnants reçoivent une couronne à côté de leur pseudo, 500 pièces et leur photo sur la page d'accueil.
const parisMonth = (ts = Date.now()) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).format(ts).slice(0, 7);
const parisDay = (ts = Date.now()) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts);
const CATS = { miss: '👸 Miss Paradise', mister: '🤴 Mister Paradise' };

module.exports = function setupPageant({ db, coins, notify, getUser, publicUser, isStaff, track = () => {}, botSay = () => {}, onWinners = () => {} }) {
  const now = () => Date.now();
  db.exec('CREATE TABLE IF NOT EXISTS pageant_entries (month TEXT NOT NULL, user_id INTEGER NOT NULL, cat TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (month, user_id))');
  db.exec('CREATE TABLE IF NOT EXISTS pageant_votes (month TEXT NOT NULL, day TEXT NOT NULL, voter_id INTEGER NOT NULL, cat TEXT NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (day, voter_id, cat))');
  db.exec('CREATE TABLE IF NOT EXISTS pageant_winners (month TEXT NOT NULL, cat TEXT NOT NULL, user_id INTEGER NOT NULL, votes INTEGER NOT NULL, PRIMARY KEY (month, cat))');
  let crowns = new Map(); // id du gagnant du mois dernier -> 'miss' / 'mister'
  const loadCrowns = () => { const last = db.prepare('SELECT MAX(month) m FROM pageant_winners').get()?.m; crowns = new Map(last ? db.prepare('SELECT user_id, cat FROM pageant_winners WHERE month=?').all(last).map(r => [r.user_id, r.cat]) : []); };

  const votesOf = (month, cat) => db.prepare(`SELECT e.user_id, COUNT(v.voter_id) votes, e.created_at FROM pageant_entries e LEFT JOIN pageant_votes v ON v.month=e.month AND v.user_id=e.user_id AND v.cat=e.cat
    WHERE e.month=? AND e.cat=? GROUP BY e.user_id ORDER BY votes DESC, e.created_at ASC`).all(month, cat);
  // 🏆 à chaque nouveau mois, on désigne les gagnants du mois précédent
  function finalize() {
    const cur = parisMonth();
    for (const { month } of db.prepare('SELECT DISTINCT month FROM pageant_entries WHERE month<?').all(cur)) {
      if (db.prepare('SELECT 1 FROM pageant_winners WHERE month=?').get(month)) continue;
      for (const cat of Object.keys(CATS)) {
        const top = votesOf(month, cat)[0];
        if (!top || !top.votes) continue;
        db.prepare('INSERT OR IGNORE INTO pageant_winners (month,cat,user_id,votes) VALUES (?,?,?,?)').run(month, cat, top.user_id, top.votes);
        coins.earn(top.user_id, 500, `👑 ${CATS[cat]} du mois !`, { boost: false });
        track(top.user_id, 'game_win');
        notify(top.user_id, { type: 'pageant', icon: '👑', title: `Tu es élu(e) ${CATS[cat]} !`, text: `Avec ${top.votes} votes : couronne à côté de ton pseudo, 500 pièces et ta photo sur la page d'accueil pendant un mois 🎉`, important: true });
        const u = getUser(top.user_id); if (u) botSay(`👑 Résultats du mois : ${u.username} est élu(e) ${CATS[cat]} avec ${top.votes} votes ! Bravo 🎉`);
      }
    }
    loadCrowns(); onWinners();
  }
  finalize();
  setInterval(finalize, 30 * 60000).unref?.();

  function state(uid) {
    const month = parisMonth(), day = parisDay();
    const out = {};
    for (const cat of Object.keys(CATS)) out[cat] = votesOf(month, cat).map(r => { const u = getUser(r.user_id); return u ? { user: publicUser(u), votes: r.votes } : null; }).filter(Boolean);
    const mine = db.prepare('SELECT cat FROM pageant_entries WHERE month=? AND user_id=?').get(month, uid)?.cat || null;
    const voted = Object.fromEntries(db.prepare('SELECT cat, user_id FROM pageant_votes WHERE day=? AND voter_id=?').all(day, uid).map(r => [r.cat, r.user_id]));
    const [y, m] = month.split('-').map(Number);
    const end = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) - 3600000; // ≈ minuit à Paris
    return { month, cats: CATS, entries: out, mine, voted, endsAt: end, winners: winners() };
  }
  function winners() {
    const last = db.prepare('SELECT MAX(month) m FROM pageant_winners').get()?.m;
    if (!last) return null;
    return { month: last, list: db.prepare('SELECT cat, user_id, votes FROM pageant_winners WHERE month=?').all(last).map(r => { const u = getUser(r.user_id); return u ? { cat: r.cat, label: CATS[r.cat], votes: r.votes, user: { id: u.id, username: u.username, avatar: u.avatar || '', color: u.color, gender: u.gender, avatarFx: u.avatar_fx || 'none', frame: u.avatar_frame || 'none' } } : null; }).filter(Boolean) };
  }
  function enter(uid, cat) {
    const u = getUser(uid);
    if (!u || u.is_guest) return { error: 'Inscris-toi pour participer 👑' };
    if (!CATS[cat]) return { error: 'Choisis Miss ou Mister' };
    if (!u.avatar) return { error: '📷 Mets d\'abord une photo de profil (validée) pour participer' };
    db.prepare('INSERT OR REPLACE INTO pageant_entries (month,user_id,cat,created_at) VALUES (?,?,?,?)').run(parisMonth(), uid, cat, now());
    botSay(`👑 ${u.username} se présente à l'élection ${CATS[cat]} ce mois-ci ! Allez voter 🗳️`);
    return { ok: true };
  }
  function withdraw(uid) { const m = parisMonth(); db.prepare('DELETE FROM pageant_entries WHERE month=? AND user_id=?').run(m, uid); db.prepare('DELETE FROM pageant_votes WHERE month=? AND user_id=?').run(m, uid); return { ok: true }; }
  function vote(uid, target, cat) {
    const u = getUser(uid);
    if (!u || u.is_guest) return { error: 'Inscris-toi pour voter 🗳️' };
    if (Number(target) === uid) return { error: 'On ne peut pas voter pour soi 😉' };
    const month = parisMonth(), day = parisDay();
    if (!db.prepare('SELECT 1 FROM pageant_entries WHERE month=? AND user_id=? AND cat=?').get(month, Number(target), cat)) return { error: 'Cette personne ne participe pas' };
    if (db.prepare('SELECT 1 FROM pageant_votes WHERE day=? AND voter_id=? AND cat=?').get(day, uid, cat)) return { error: 'Tu as déjà voté aujourd\'hui dans cette catégorie : reviens demain 🗳️' };
    db.prepare('INSERT INTO pageant_votes (month,day,voter_id,cat,user_id) VALUES (?,?,?,?,?)').run(month, day, uid, cat, Number(target));
    coins.earnCapped(uid, 'pageant_vote_' + cat, 5, '🗳️ Vote pour Miss & Mister Paradise', 1);
    const t = getUser(Number(target)); if (t) notify(t.id, { type: 'pageant', icon: '🗳️', title: `${u.username} a voté pour toi !`, text: CATS[cat] });
    return { ok: true };
  }
  function routes(app, auth) {
    app.get('/api/pageant', auth, (req, res) => res.json(state(req.user.id)));
    app.get('/api/pageant/winners', (req, res) => res.json({ winners: winners() })); // pour la page d'accueil
    app.post('/api/pageant/enter', auth, (req, res) => { const r = enter(req.user.id, String(req.body?.cat || '')); res.status(r.error ? 400 : 200).json(r); });
    app.post('/api/pageant/withdraw', auth, (req, res) => res.json(withdraw(req.user.id)));
    app.post('/api/pageant/vote', auth, (req, res) => { const r = vote(req.user.id, req.body?.to, String(req.body?.cat || '')); res.status(r.error ? 400 : 200).json(r); });
    // pour les tests et le super-admin : clôturer maintenant
    app.post('/api/admin/pageant/finalize', auth, (req, res) => { if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Réservé au super-admin' }); finalize(); res.json({ ok: true, winners: winners() }); });
  }
  return { routes, crownOf: id => crowns.get(id) || '', finalize };
};
