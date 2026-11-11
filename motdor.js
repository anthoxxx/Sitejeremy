// The Paradise — « Le Mot d'Or » : trouver le mot caché en 6 essais (la première lettre est donnée)
// Tous les joueurs cherchent le même mot en même temps. Lettre dorée = bien placée, lettre violette = mal placée.
// 5 mots par partie ; plus on trouve vite (et en peu d'essais), plus on gagne de points.
const WORDS = {
  6: ['MAISON', 'JARDIN', 'SOLEIL', 'CHEVAL', 'BATEAU', 'CERISE', 'ORANGE', 'BANANE', 'CITRON', 'TOMATE', 'PLANTE', 'ETOILE', 'MONTRE', 'CHAISE', 'BOUGIE',
    'FOURMI', 'RENARD', 'CANARD', 'MOUTON', 'REQUIN', 'TORTUE', 'CRAYON', 'CAHIER', 'CARTON', 'VOYAGE', 'DANSER', 'AMITIE', 'CAMION', 'ROCHER', 'GLACON',
    'SALADE', 'GATEAU', 'MIROIR', 'BALCON', 'GARAGE', 'POUPEE', 'BALLON', 'TOUPIE', 'DOMINO', 'PUZZLE', 'CINEMA', 'CIRQUE', 'DRAGON', 'PRINCE', 'CHATON',
    'SOURIS', 'PIRATE', 'TRESOR', 'BONBON', 'HIBOUX', 'PIGEON', 'CASTOR', 'GIRAFE', 'LIONNE', 'JAGUAR', 'MEDUSE', 'HOMARD', 'VIOLON', 'VOLCAN', 'DESERT', 'CAMERA'],
  7: ['PALMIER', 'CORBEAU', 'MOINEAU', 'CHAMEAU', 'BALEINE', 'FENETRE', 'PLANETE', 'ABEILLE', 'POISSON', 'DAUPHIN', 'RIVIERE', 'VILLAGE', 'CHATEAU', 'MUSIQUE',
    'CHANTER', 'SOURIRE', 'BONHEUR', 'PARADIS', 'AUTOMNE', 'BISCUIT', 'BOISSON', 'COUTEAU', 'CUISINE', 'CHAMBRE', 'LICORNE', 'SORCIER', 'THEATRE', 'GUITARE',
    'FROMAGE', 'CAROTTE', 'CHAPEAU', 'MANTEAU', 'TAMBOUR', 'CAMPING', 'DESSERT', 'CRAVATE', 'LUMIERE', 'MYSTERE', 'TEMPETE', 'MESSAGE', 'VOITURE', 'PINCEAU',
    'PEINTRE', 'CHANSON', 'CONCERT', 'TOURNOI'],
};
const SLUG = 'motdor';
const HOST = { username: 'Maestro Paradise', color: '#ffc94d', icon: '🎩' };
const MAX_PLAYERS = 8, ROUND_WORDS = 5, TRIES = 6, WORD_MS = 120000, REVEAL_MS = 7000;
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
// Couleurs d'un essai : 2 = bien placée (or), 1 = mal placée (violet), 0 = absente
function check(guess, word) {
  const res = Array(word.length).fill(0), left = {};
  for (let i = 0; i < word.length; i++) { if (guess[i] === word[i]) res[i] = 2; else left[word[i]] = (left[word[i]] || 0) + 1; }
  for (let i = 0; i < word.length; i++) if (res[i] !== 2 && left[guess[i]]) { res[i] = 1; left[guess[i]]--; }
  return res;
}

module.exports = function setupMotDor({ io, db, getOnline, notify = () => {}, notifyLive = () => {}, reward = () => {} }) {
  const now = () => Date.now();
  db.exec(`CREATE TABLE IF NOT EXISTS motdor_scores (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    wins INTEGER NOT NULL DEFAULT 0, points INTEGER NOT NULL DEFAULT 0, found INTEGER NOT NULL DEFAULT 0, games INTEGER NOT NULL DEFAULT 0)`);
  const addScore = (id, f) => {
    db.prepare(`INSERT INTO motdor_scores (user_id, wins, points, found, games) VALUES (?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET wins=wins+excluded.wins, points=points+excluded.points, found=found+excluded.found, games=games+excluded.games`)
    .run(id, f.wins || 0, f.points || 0, f.found || 0, f.games || 0);
    // 💰 Paradise Coins
    if (f.wins) reward(id, 'win_motdor', 30, "🏆 Victoire au Mot d'Or");
    else if (f.games) reward(id, 'play_motdor', 5, "🎮 Partie au Mot d'Or");
  };
  const leaderboard = () => db.prepare('SELECT s.*, u.username, u.color FROM motdor_scores s JOIN users u ON u.id=s.user_id ORDER BY s.wins DESC, s.points DESC LIMIT 5').all()
    .map(r => ({ id: r.user_id, username: r.username, color: r.color, wins: r.wins, points: r.points, found: r.found }));

  let msgSeq = 1, timer = null, lb = leaderboard(), recent = [];
  const g = { phase: 'lobby', players: [], wordNo: 0, word: '', deadline: 0, grids: new Map(), finders: [], line: '', winner: null };
  const say = content => io.to('room:' + SLUG).emit('message', { room: SLUG, id: 'md' + (msgSeq++), userId: 0, username: HOST.username, color: HOST.color, gender: 'x', role: 'bot', avatar: '', bot: true, botIcon: HOST.icon, content, createdAt: now(), kind: 'text' });
  const host = l => { g.line = l; };
  // Ce que voit chaque personne : ses propres lettres, et seulement les couleurs des autres
  const stateFor = viewerId => ({
    phase: g.phase, wordNo: g.wordNo, total: ROUND_WORDS, length: g.word.length, first: g.word[0] || '', tries: TRIES, deadline: g.deadline,
    word: ['reveal', 'end'].includes(g.phase) ? g.word : null,
    players: g.players.map(p => {
      const gr = g.grids.get(p.id) || { rows: [], done: false, found: false };
      const mine = p.id === viewerId || ['reveal', 'end'].includes(g.phase);
      return { id: p.id, username: p.username, color: p.color, avatar: p.avatar, score: p.score, done: gr.done, found: gr.found,
        rows: gr.rows.map(r => ({ colors: r.colors, letters: mine ? r.letters : null })) };
    }),
    finders: g.finders, line: g.line, winner: g.winner, leaderboard: lb, now: now(), maxPlayers: MAX_PLAYERS,
  });
  const broadcast = () => {
    for (const e of getOnline().values()) if (e.room === SLUG) for (const sid of e.sockets) io.to(sid).emit('motdor', stateFor(e.user.id));
  };
  const setTimer = (ms, fn) => { clearTimeout(timer); timer = setTimeout(fn, ms); };

  function pickWord() {
    const len = g.wordNo % 2 ? 7 : 6;
    const list = WORDS[len].filter(w => !recent.includes(w));
    const w = list[Math.floor(Math.random() * list.length)] || WORDS[len][0];
    recent = [...recent, w].slice(-40);
    return w;
  }
  function nextWord() {
    if (!g.players.length) return toLobby();
    if (g.wordNo >= ROUND_WORDS) return endGame();
    g.word = pickWord(); g.wordNo++;
    g.phase = 'play'; g.grids = new Map(); g.finders = [];
    g.players.forEach(p => g.grids.set(p.id, { rows: [], done: false, found: false }));
    g.deadline = now() + WORD_MS;
    host(`✨ Mot ${g.wordNo} sur ${ROUND_WORDS} : ${g.word.length} lettres, il commence par « ${g.word[0]} » !`);
    broadcast();
    setTimer(WORD_MS, reveal);
  }
  function reveal() {
    clearTimeout(timer);
    if (g.phase !== 'play') return;
    g.phase = 'reveal'; g.deadline = 0;
    host(g.finders.length ? `🏆 Le mot était « ${g.word} » ! Bravo ${g.finders.map(f => f.username).join(', ')}` : `Le mot était « ${g.word} »… personne ne l'a trouvé !`);
    say(`✨ Le mot était « ${g.word} ». ${g.finders.length ? g.finders.map((f, i) => `${['🥇', '🥈', '🥉'][i] || '✅'} ${f.username} (+${f.pts})`).join(' · ') : 'Personne ne l\'a trouvé !'}`);
    broadcast();
    setTimer(REVEAL_MS, nextWord);
  }
  function endGame() {
    clearTimeout(timer);
    g.phase = 'end'; g.deadline = 0;
    const ranking = [...g.players].sort((a, b) => b.score - a.score);
    const best = ranking[0];
    const tie = best && ranking.filter(p => p.score === best.score).length > 1;
    g.winner = best && !tie && best.score > 0 ? { id: best.id, username: best.username, score: best.score } : null;
    g.players.forEach(p => {
      addScore(p.id, { points: p.score, games: 1, wins: g.winner?.id === p.id ? 1 : 0, found: p.found || 0 });
      notify(p.id, { type: 'game', icon: g.winner?.id === p.id ? '👑' : '✨', title: g.winner?.id === p.id ? `Tu as gagné Le Mot d'Or avec ${p.score} points !` : `Le Mot d'Or : ${p.score} points pour toi`, text: g.winner ? `Gagnant : ${g.winner.username}` : 'Égalité !', data: { slug: SLUG } });
    });
    lb = leaderboard();
    host(g.winner ? `👑 ${g.winner.username} remporte Le Mot d'Or !` : '🤝 Égalité ! Bravo à tous !');
    say(g.winner ? `👑 ${g.winner.username} gagne avec ${g.winner.score} points ! ${ranking.map((p, i) => `${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${p.username} ${p.score}`).join(' · ')}` : '🤝 Égalité parfaite !');
    broadcast();
    setTimer(90000, toLobby);
  }
  function toLobby() {
    clearTimeout(timer);
    Object.assign(g, { phase: 'lobby', wordNo: 0, word: '', deadline: 0, grids: new Map(), finders: [], winner: null });
    g.players.forEach(p => { p.score = 0; p.found = 0; });
    host(g.players.length ? '✨ Prêts ? Lancez la partie !' : '✨ Bienvenue au Mot d\'Or ! Rejoins la partie pour jouer.');
    broadcast();
  }
  function removePlayer(id) {
    const i = g.players.findIndex(p => p.id === id);
    if (i < 0) return;
    const [p] = g.players.splice(i, 1);
    g.grids.delete(id);
    if (!g.players.length && g.phase !== 'lobby') { say(`👋 ${p.username} est parti. Fin de la partie.`); return toLobby(); }
    if (g.phase === 'play' && [...g.grids.values()].every(x => x.done)) return reveal();
    broadcast();
  }
  setInterval(() => {
    const here = new Set([...getOnline().values()].filter(e => e.room === SLUG).map(e => e.user.id));
    g.players.filter(p => !here.has(p.id)).forEach(p => removePlayer(p.id));
  }, 5000).unref();

  function onConnection(socket, uid, currentUser) {
    const me = () => g.players.find(p => p.id === uid);
    const guard = fn => (...args) => {
      const ack = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      const u = currentUser();
      if (!u || !socket.rooms.has('room:' + SLUG)) return ack && ack({ error: 'Viens dans le salon Le Mot d\'Or pour jouer' });
      const r = fn(u, ...args);
      if (ack) ack(r || { ok: true });
    };
    socket.on('md_state', ack => typeof ack === 'function' && ack(stateFor(uid)));
    socket.on('md_join', guard(u => {
      if (me()) return;
      if (g.players.length >= MAX_PLAYERS) return { error: `La partie est pleine (${MAX_PLAYERS} joueurs)` };
      g.players.push({ id: uid, username: u.username, color: u.color, avatar: u.avatar || '', score: 0, found: 0 });
      if (g.phase === 'play') g.grids.set(uid, { rows: [], done: false, found: false });
      say(`✨ ${u.username} rejoint la partie ! (${g.players.length}/${MAX_PLAYERS})`);
      if (g.phase === 'end') toLobby(); else broadcast();
    }));
    socket.on('md_leave', guard(() => { removePlayer(uid); }));
    socket.on('md_start', guard(u => {
      if (!me()) return { error: 'Rejoins d\'abord la partie' };
      if (g.phase === 'end') toLobby();
      if (g.phase !== 'lobby') return { error: 'La partie a déjà commencé' };
      g.players.forEach(p => { p.score = 0; p.found = 0; });
      say(`✨ C'est parti pour Le Mot d'Or ! ${ROUND_WORDS} mots à trouver, ${TRIES} essais pour chacun. La première lettre est donnée. Lettre dorée = bien placée, lettre violette = mal placée. Le plus rapide gagne le plus de points !`);
      nextWord();
    }));
    socket.on('md_guess', guard((u, text) => {
      if (g.phase !== 'play') return { error: 'Pas maintenant !' };
      const gr = g.grids.get(uid), p = me();
      if (!gr || !p) return { error: 'Rejoins la partie pour jouer' };
      if (gr.done) return { error: 'Tu as fini ce mot : attends les autres' };
      const guess = norm(text);
      if (guess.length !== g.word.length) return { error: `Le mot fait ${g.word.length} lettres` };
      if (guess[0] !== g.word[0]) return { error: `Le mot commence par « ${g.word[0]} »` };
      const colors = check(guess, g.word);
      gr.rows.push({ letters: guess, colors });
      if (guess === g.word) {
        gr.done = true; gr.found = true;
        const rank = g.finders.length;
        const pts = (TRIES + 1 - gr.rows.length) * 10 + ([30, 15, 5][rank] || 0);
        p.score += pts; p.found = (p.found || 0) + 1;
        g.finders.push({ id: uid, username: u.username, pts, tries: gr.rows.length });
        host(`${['🥇', '🥈', '🥉'][rank] || '✅'} ${u.username} a trouvé en ${gr.rows.length} essai${gr.rows.length > 1 ? 's' : ''} ! +${pts}`);
        for (const o of g.players) if (o.id !== uid && !g.grids.get(o.id)?.done) notifyLive(o.id, { type: 'game', icon: '✨', title: `${u.username} a trouvé le mot ! Dépêche-toi !`, data: { slug: SLUG } });
      } else if (gr.rows.length >= TRIES) gr.done = true;
      broadcast();
      if ([...g.grids.values()].every(x => x.done)) setTimeout(reveal, 1200);
      return { ok: true, colors, found: guess === g.word };
    }));
    socket.on('md_new', guard(() => { if (g.phase === 'end') toLobby(); }));
  }
  function command(user, text) {
    const c = text.trim().toLowerCase();
    if (c === '!aide' || c === '!motdor') say(`✨ Le Mot d'Or : trouve le mot caché en ${TRIES} essais. La première lettre est donnée. Lettre dorée = bien placée, lettre violette = présente mais mal placée, lettre sombre = absente. Plus tu trouves vite et en peu d'essais, plus tu gagnes de points ! ${ROUND_WORDS} mots par partie.`);
    return Promise.resolve();
  }
  return { onConnection, command, has: slug => slug === SLUG, SLUG };
};
