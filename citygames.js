// The Paradise — Les jeux de la Ville 🏙️ : 🗺️ la Chasse au trésor du jour et 🏁 les Courses de voitures
const DAY = 86400000;
const parisDay = (ts = Date.now()) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts);
const parisHour = () => Number(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }).format(Date.now()));
// Les lieux connus de la Ville (pour les indices)
const LANDMARKS = [['le Paradise Club', 850, 710], ['le Ciné Paradise', 1360, 1055], ['le quartier des maisons', 590, 710], ['la piscine', 1900, 700], ['le Café Paradise', 1060, 705], ['la salle d\'arcade', 590, 1045], ['le feu de camp', 2050, 1370], ['la grande fontaine', 1200, 820]];
const RIDDLES = [
  'Je dors là où les néons ne dorment jamais… Trouve-moi avant les autres ! 🗝️',
  'Un pirate a caché son coffre dans la Ville. Il a laissé des indices… à toi de jouer ! 🏴‍☠️',
  'Ce matin, un coffre rempli de pièces est tombé d\'un camion. Personne ne sait où… 🚚',
  'Le maire a enterré un trésor pour fêter la journée. Le premier qui le trouve le garde ! 🎩',
  'Un coffre magique apparaît chaque jour à un endroit différent. Aujourd\'hui, il t\'attend… ✨',
];
// Le circuit de course : des points de passage dans les rues (dans l'ordre), un tour complet
const CHECKPOINTS = [[700, 480], [1200, 480], [1700, 480], [2250, 800], [2250, 1450], [1200, 1450], [150, 1450], [150, 800], [400, 480]];
const START = [[400, 455], [400, 505], [340, 455], [340, 505], [280, 455], [280, 505], [220, 455], [220, 505]];

module.exports = function setupCityGames({ db, io, coins, notify, track = () => {}, getUser, island, emitToUser, botSay = () => {}, throttled }) {
  const now = () => Date.now();
  db.exec('CREATE TABLE IF NOT EXISTS treasure (day TEXT PRIMARY KEY, x REAL NOT NULL, y REAL NOT NULL, riddle INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS treasure_finds (day TEXT NOT NULL, user_id INTEGER NOT NULL, rank INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (day, user_id))');
  db.exec('CREATE TABLE IF NOT EXISTS race_best (week TEXT NOT NULL, user_id INTEGER NOT NULL, ms INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (week, user_id))');

  // ---------- 🗺️ La chasse au trésor ----------
  function today() {
    const day = parisDay();
    let t = db.prepare('SELECT * FROM treasure WHERE day=?').get(day);
    if (!t) {
      const x = 160 + Math.random() * 2080, y = 220 + Math.random() * 1260;
      db.prepare('INSERT OR IGNORE INTO treasure (day,x,y,riddle,created_at) VALUES (?,?,?,?,?)').run(day, x, y, Math.floor(Math.random() * RIDDLES.length), now());
      t = db.prepare('SELECT * FROM treasure WHERE day=?').get(day);
    }
    return t;
  }
  const zoneOf = (x, y) => `${y < 640 ? 'au nord' : y < 1060 ? 'au centre' : 'au sud'}${x < 900 ? '-ouest' : x < 1500 ? '' : '-est'}`.replace('au centre', 'en plein centre').replace(/^en plein centre-/, 'au centre-');
  function hints(t) {
    const h = parisHour(), [name, lx, ly] = LANDMARKS.reduce((b, l) => (Math.hypot(l[1] - t.x, l[2] - t.y) < Math.hypot(b[1] - t.x, b[2] - t.y) ? l : b));
    const out = [`🧭 Le coffre est caché ${zoneOf(t.x, t.y)} de la Ville.`];
    if (h >= 12) out.push(`📍 Il n'est pas très loin de ${name}.`);
    if (h >= 18) out.push(`👣 Il est à environ ${Math.round(Math.hypot(lx - t.x, ly - t.y) / 10) * 10} pas de ${name}, plutôt vers ${Math.abs(t.x - lx) > Math.abs(t.y - ly) ? (t.x > lx ? 'l\'est' : 'l\'ouest') : (t.y > ly ? 'le sud' : 'le nord')}.`);
    const next = h < 12 ? 'midi' : h < 18 ? '18 h' : null;
    return { list: out, next };
  }
  function info(uid) {
    const t = today(), finds = db.prepare('SELECT f.user_id, f.rank, u.username FROM treasure_finds f LEFT JOIN users u ON u.id=f.user_id WHERE f.day=? ORDER BY f.rank').all(t.day);
    return { riddle: RIDDLES[t.riddle] || RIDDLES[0], hints: hints(t), winner: finds[0]?.username || null, finders: finds.length, found: finds.some(f => f.user_id === uid), prize: { first: 250, others: 25 } };
  }
  const heatMemo = new Map();
  function onMove(uid, x, y) {
    const t = today(), d = Math.hypot(t.x - x, t.y - y);
    // 🌡️ chaud / froid : on prévient quand ça change
    const lvl = d < 120 ? 4 : d < 300 ? 3 : d < 650 ? 2 : 1;
    if (heatMemo.get(uid) !== lvl) { heatMemo.set(uid, lvl); emitToUser(uid, 'treasure_heat', { lvl }); }
    if (d < 120) emitToUser(uid, 'treasure_near', { x: Math.round(t.x), y: Math.round(t.y) }); // le coffre brille quand on est tout près
    if (d < 46) found(uid, t);
    // 🏁 la course
    raceMove(uid, x, y);
  }
  function found(uid, t) {
    const u = getUser(uid); if (!u || u.is_guest) return;
    if (db.prepare('SELECT 1 FROM treasure_finds WHERE day=? AND user_id=?').get(t.day, uid)) return;
    const rank = db.prepare('SELECT COUNT(*) n FROM treasure_finds WHERE day=?').get(t.day).n + 1;
    db.prepare('INSERT OR IGNORE INTO treasure_finds (day,user_id,rank,at) VALUES (?,?,?,?)').run(t.day, uid, rank, now());
    const gain = coins.earn(uid, rank === 1 ? 250 : 25, rank === 1 ? '🗺️ Premier à trouver le trésor du jour !' : '🗺️ Trésor du jour trouvé');
    track(uid, rank === 1 ? 'game_win' : 'game');
    emitToUser(uid, 'treasure_found', { rank, gain });
    if (rank === 1) {
      io.emit('treasure_winner', { username: u.username });
      botSay(`🗺️ ${u.username} a trouvé le trésor du jour dans la Ville et gagne 250 pièces ! 🏆 Les suivants gagnent encore 25 pièces : le coffre est toujours là…`);
    }
  }

  // ---------- 🏁 Les courses ----------
  let race = { state: 'idle', racers: new Map(), startAt: 0, lobbyEnd: 0, timer: null };
  const pub = () => ({ state: race.state, lobbyEnd: race.lobbyEnd, startAt: race.startAt, endAt: race.endAt || 0, checkpoints: CHECKPOINTS, racers: [...race.racers.entries()].map(([id, r]) => ({ id, username: getUser(id)?.username || '?', cp: r.cp, done: r.done, car: r.car })).sort((a, b) => (a.done || 9e12) - (b.done || 9e12) || b.cp - a.cp) });
  const broadcast = () => { for (const id of new Set([...race.racers.keys(), ...island.islanders()])) emitToUser(id, 'race_state', pub()); };
  const CARS = ['🏎️', '🚗', '🚙', '🚓', '🚕', '🛻', '🚌', '🏍️'];
  function join(uid, car) {
    const u = getUser(uid); if (!u || u.is_guest) return { error: 'Inscris-toi pour faire la course 🏁' };
    if (island.posOf(uid)?.scene !== 'island') return { error: 'Va dans la Ville pour faire la course 🏙️' };
    if (race.state === 'running') return { error: 'Une course est en cours : attends la prochaine (environ 1 minute) ⏳' };
    if (race.racers.size >= 8 && !race.racers.has(uid)) return { error: 'La course est complète (8 pilotes) 🏎️' };
    race.racers.set(uid, { cp: 0, done: 0, car: CARS.includes(car) ? car : '🏎️' });
    if (race.state === 'idle') { race.state = 'lobby'; race.lobbyEnd = now() + 20000; clearTimeout(race.timer); race.timer = setTimeout(go, 20000); io.emit('race_open', { by: u.username }); }
    broadcast(); return { ok: true };
  }
  function leave(uid) { if (race.racers.delete(uid)) { if (!race.racers.size) reset(); else broadcast(); } return { ok: true }; }
  function go() {
    if (race.state !== 'lobby') return;
    const ids = [...race.racers.keys()].filter(id => island.posOf(id)?.scene === 'island');
    if (!ids.length) return reset();
    race.racers = new Map(ids.map(id => [id, race.racers.get(id)]));
    ids.forEach((id, i) => island.teleport(id, ...START[i % START.length]));
    race.state = 'running'; race.startAt = now() + 3500; // 3, 2, 1… partez !
    broadcast();
    clearTimeout(race.timer); race.timer = setTimeout(finish, 3500 + 120000);
  }
  function raceMove(uid, x, y) {
    if (race.state !== 'running' || now() < race.startAt) return;
    const r = race.racers.get(uid); if (!r || r.done) return;
    const [cx, cy] = CHECKPOINTS[r.cp];
    if (Math.hypot(cx - x, cy - y) > 75) return;
    r.cp++;
    if (r.cp >= CHECKPOINTS.length) { r.done = now(); const rank = [...race.racers.values()].filter(v => v.done).length; emitToUser(uid, 'race_finish', { rank, ms: r.done - race.startAt }); if ([...race.racers.values()].every(v => v.done)) return finish(); if (rank === 1) { clearTimeout(race.timer); race.timer = setTimeout(finish, 30000); race.endAt = now() + 30000; } }
    broadcast();
  }
  function finish() {
    if (race.state !== 'running') return;
    const done = [...race.racers.entries()].filter(([, r]) => r.done).sort((a, b) => a[1].done - b[1].done);
    const solo = race.racers.size < 2, week = parisDay(now() - ((new Date().getDay() + 6) % 7) * DAY);
    const res = done.map(([id, r], i) => {
      const ms = r.done - race.startAt, prize = solo ? 15 : [100, 60, 40][i] ?? 15;
      const gain = coins.earnCapped(id, 'race_' + (solo ? 'solo' : i < 3 ? 'podium' : 'fin'), prize, solo ? '🏁 Course en solo terminée' : `🏁 Course : ${i + 1}${i ? 'e' : 'er'} place`, solo ? 5 : 10);
      track(id, !solo && i === 0 ? 'game_win' : 'game');
      const best = db.prepare('SELECT ms FROM race_best WHERE week=? AND user_id=?').get(week, id);
      if (!best || ms < best.ms) db.prepare('INSERT OR REPLACE INTO race_best (week,user_id,ms,at) VALUES (?,?,?,?)').run(week, id, ms, now());
      return { id, username: getUser(id)?.username || '?', ms, rank: i + 1, gain };
    });
    for (const id of race.racers.keys()) emitToUser(id, 'race_results', { results: res, solo });
    if (res.length && !solo) botSay(`🏁 Course dans la Ville : ${res.slice(0, 3).map((r, i) => ['🥇', '🥈', '🥉'][i] + ' ' + r.username + ' (' + (r.ms / 1000).toFixed(1) + ' s)').join(' · ')}`);
    reset();
  }
  function reset() { clearTimeout(race.timer); race = { state: 'idle', racers: new Map(), startAt: 0, lobbyEnd: 0, timer: null }; broadcast(); }
  function leaderboard() {
    const week = parisDay(now() - ((new Date().getDay() + 6) % 7) * DAY);
    return db.prepare('SELECT b.ms, u.username FROM race_best b JOIN users u ON u.id=b.user_id WHERE b.week=? ORDER BY b.ms LIMIT 10').all(week);
  }

  // ---------- ⛄ La bataille de boules de neige (en hiver) ----------
  const winter = () => { const m = Number(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', month: 'numeric' }).format(Date.now())); return [11, 12, 1, 2].includes(m) || process.env.SNOW_FORCE === '1'; };
  const roundKey = () => parisDay() + ':' + parisHour();
  let snow = { round: roundKey(), score: { red: 0, blue: 0 }, hitters: { red: new Set(), blue: new Set() } };
  const teams = new Map(); const lastThrow = new Map();
  const teamOf = uid => { if (!teams.has(uid)) { const c = { red: 0, blue: 0 }; for (const t of teams.values()) c[t]++; teams.set(uid, c.red <= c.blue ? 'red' : 'blue'); } return teams.get(uid); };
  const snowState = () => ({ score: snow.score, teams: Object.fromEntries(teams), endsIn: (60 - new Date().getMinutes()) * 60000 - new Date().getSeconds() * 1000 });
  function endRound() {
    const { red, blue } = snow.score;
    if (red !== blue && red + blue > 0) {
      const win = red > blue ? 'red' : 'blue';
      for (const id of snow.hitters[win]) { const g = coins.earnCapped(id, 'snow_win', 20, `⛄ Bataille de boules de neige : l'équipe ${win === 'red' ? 'rouge' : 'bleue'} a gagné !`, 4); if (g) emitToUser(id, 'snow_won', { gain: g, team: win }); }
      botSay(`⛄ Fin de la manche de boules de neige : l'équipe ${win === 'red' ? '🔴 ROUGE' : '🔵 BLEUE'} gagne ${Math.max(red, blue)} à ${Math.min(red, blue)} ! Les lanceurs gagnants reçoivent 20 pièces 💰`);
    }
    snow = { round: roundKey(), score: { red: 0, blue: 0 }, hitters: { red: new Set(), blue: new Set() } };
    io.emit('snow_state', snowState());
  }
  setInterval(() => { if (snow.round !== roundKey()) endRound(); }, 20000).unref?.();
  function onConnection(socket, uid) {
    socket.on('snow_join', ack => { if (!winter()) return ack && ack({ error: '⛄ Les boules de neige, c\'est en hiver (de novembre à février) !' }); const t = teamOf(uid); ack && ack({ ok: true, team: t, ...snowState() }); });
    socket.on('snow_throw', pos => {
      if (!winter() || !pos) return;
      const me = island.posOf(uid); if (!me || me.scene !== 'island') return;
      const t = now(); if (t - (lastThrow.get(uid) || 0) < 650) return; lastThrow.set(uid, t);
      let x = Number(pos.x), y = Number(pos.y); if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const d = Math.hypot(x - me.x, y - me.y), max = 520; if (d > max) { x = me.x + (x - me.x) / d * max; y = me.y + (y - me.y) / d * max; }
      const team = teamOf(uid);
      // qui est touché ? le joueur le plus proche du point d'impact (pas soi-même, pas son équipe)
      let hit = null, best = 46;
      for (const id of island.islanders()) { if (id === uid) continue; const p = island.posOf(id); const dd = Math.hypot(p.x - x, p.y - y + 20); if (dd < best && teamOf(id) !== team) { best = dd; hit = id; } }
      if (hit) { snow.score[team]++; snow.hitters[team].add(uid); track(uid, 'game'); }
      const fx = { from: uid, fx: Math.round(me.x), fy: Math.round(me.y), x: Math.round(x), y: Math.round(y), hit, team, score: snow.score };
      for (const id of island.islanders()) emitToUser(id, 'snow_fx', fx);
    });
  }

  function routes(app, auth) {
    app.get('/api/city/treasure', auth, (req, res) => res.json(info(req.user.id)));
    app.get('/api/city/race', auth, (req, res) => res.json({ ...pub(), leaderboard: leaderboard(), cars: CARS }));
    app.post('/api/city/race/join', auth, (req, res) => { const r = join(req.user.id, String(req.body?.car || '')); res.status(r.error ? 400 : 200).json(r); });
    app.post('/api/city/race/leave', auth, (req, res) => res.json(leave(req.user.id)));
  }
  return { onMove, routes, leave, onConnection };
};
