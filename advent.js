// The Paradise — 🎄 Le Calendrier de l'Avent : du 1er au 24 décembre, une case par jour avec une surprise
// (pièces, sapin, bonhomme de neige, cadeaux pour sa maison, bonnet de Père Noël, badge 🎅…)
// Pour tester avant décembre : ADVENT_DAY=5 fait comme si on était le 5 décembre.
const parisDate = () => { const p = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(Date.now()).split('-').map(Number); return { y: p[0], m: p[1], d: p[2] }; };
// [type, valeur, nom affiché, icône]
const GIFTS = [
  ['coins', 20, '20 pièces', '💰'], ['coins', 25, '25 pièces', '💰'], ['item', 'furn_snowman', 'Un bonhomme de neige pour ta maison', '⛄'], ['coins', 30, '30 pièces', '💰'],
  ['coins', 35, '35 pièces', '💰'], ['look', 'acc:pere_noel', 'Le bonnet de Père Noël pour ton personnage', '🎅'], ['coins', 40, '40 pièces', '💰'], ['coins', 50, '50 pièces', '🍫'],
  ['item', 'furn_gifts', 'Une pile de cadeaux pour ta maison', '🎁'], ['coins', 45, '45 pièces', '💰'], ['coins', 50, '50 pièces', '🍬'], ['coins', 60, '60 pièces', '💰'],
  ['item', 'furn_xmastree', 'Un vrai sapin de Noël qui clignote pour ta maison', '🎄'], ['coins', 55, '55 pièces', '💰'], ['coins', 60, '60 pièces', '🧸'], ['coins', 70, '70 pièces', '💰'],
  ['coins', 75, '75 pièces', '🎈'], ['coins', 80, '80 pièces', '💰'], ['coins', 90, '90 pièces', '🍪'], ['coins', 100, '100 pièces', '💰'],
  ['coins', 110, '110 pièces', '❄️'], ['coins', 120, '120 pièces', '💰'], ['coins', 150, '150 pièces', '🔔'], ['badge', 'badge_santa', 'Le badge Père Noël 🎅 + 300 pièces', '🎅'],
];

module.exports = function setupAdvent({ db, coins, notify, track = () => {}, getUser }) {
  db.exec('CREATE TABLE IF NOT EXISTS advent_opened (year INTEGER NOT NULL, user_id INTEGER NOT NULL, day INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (year, user_id, day))');
  const today = () => { const t = parisDate(), force = parseInt(process.env.ADVENT_DAY, 10); return force >= 1 && force <= 31 ? { y: t.y, m: 12, d: force } : t; };
  function state(uid) {
    const t = today(), live = t.m === 12, opened = new Set(db.prepare('SELECT day FROM advent_opened WHERE year=? AND user_id=?').all(t.y, uid).map(r => r.day));
    return { live, year: t.y, today: live ? t.d : 0, days: GIFTS.map((g, i) => ({ day: i + 1, opened: opened.has(i + 1), gift: opened.has(i + 1) ? { name: g[2], icon: g[3] } : null, missed: live && i + 1 < t.d && !opened.has(i + 1) })) };
  }
  function open(uid, day) {
    const u = getUser(uid); if (!u || u.is_guest) return { error: 'Inscris-toi pour ouvrir le calendrier 🎄' };
    const t = today(); day = parseInt(day, 10);
    if (t.m !== 12) return { error: '🎄 Le calendrier s\'ouvre le 1er décembre : patience !' };
    if (!(day >= 1 && day <= 24)) return { error: 'Case inconnue' };
    if (day > t.d) return { error: `⏳ Pas si vite ! Cette case s'ouvre le ${day} décembre` };
    if (day < t.d) return { error: '😢 Trop tard pour cette case : il fallait l\'ouvrir le jour même. Reviens chaque jour !' };
    if (db.prepare('SELECT 1 FROM advent_opened WHERE year=? AND user_id=? AND day=?').get(t.y, uid, day)) return { error: 'Tu as déjà ouvert la case d\'aujourd\'hui 🎁 Reviens demain !' };
    db.prepare('INSERT INTO advent_opened (year,user_id,day,at) VALUES (?,?,?,?)').run(t.y, uid, day, Date.now());
    const [type, val, name, icon] = GIFTS[day - 1];
    const give = item => db.prepare('INSERT OR IGNORE INTO inventory (user_id,item,created_at) VALUES (?,?,?)').run(uid, item, Date.now());
    if (type === 'coins') coins.earn(uid, val, `🎄 Calendrier de l'Avent : case du ${day} décembre`, { boost: false });
    else if (type === 'item') give(val);
    else if (type === 'look') give('look:' + val);
    else if (type === 'badge') { give(val); coins.earn(uid, 300, '🎅 Calendrier de l\'Avent : le grand cadeau du 24 décembre', { boost: false }); coins.equip(uid, val); }
    track(uid, 'daily');
    return { ok: true, day, gift: { type, name, icon } };
  }
  function routes(app, auth) {
    app.get('/api/advent', auth, (req, res) => res.json(state(req.user.id)));
    app.post('/api/advent/open', auth, (req, res) => { const r = open(req.user.id, req.body?.day); res.status(r.error ? 400 : 200).json(r); });
  }
  return { routes, isLive: () => today().m === 12, today };
};
