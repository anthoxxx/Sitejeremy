// The Paradis — mini-jeux : scores solo, classements et parties à deux en temps réel
// Le serveur arbitre chaque partie à deux (impossible de tricher en envoyant de faux coups).
const crypto = require('crypto');

// ---------- Banque de questions (quiz solo et quiz duel) ----------
const QUESTIONS = [
  ['Quelle est la capitale de l\'Australie ?', ['Sydney', 'Canberra', 'Melbourne', 'Perth'], 1],
  ['Combien de joueurs dans une équipe de football sur le terrain ?', ['9', '10', '11', '12'], 2],
  ['Quel est le plus grand océan du monde ?', ['Atlantique', 'Indien', 'Arctique', 'Pacifique'], 3],
  ['Qui a peint « La Joconde » ?', ['Léonard de Vinci', 'Michel-Ange', 'Raphaël', 'Picasso'], 0],
  ['Combien de continents compte-t-on habituellement ?', ['5', '6', '7', '8'], 2],
  ['Quelle planète est surnommée la planète rouge ?', ['Vénus', 'Mars', 'Jupiter', 'Saturne'], 1],
  ['En quelle année l\'homme a-t-il marché sur la Lune pour la première fois ?', ['1965', '1969', '1972', '1959'], 1],
  ['Quel est l\'animal terrestre le plus rapide ?', ['Lion', 'Guépard', 'Antilope', 'Cheval'], 1],
  ['Quelle est la langue la plus parlée au monde (langue maternelle) ?', ['Anglais', 'Espagnol', 'Mandarin', 'Hindi'], 2],
  ['Combien de côtés a un hexagone ?', ['5', '6', '7', '8'], 1],
  ['Quel est le symbole chimique de l\'or ?', ['Or', 'Ag', 'Au', 'Go'], 2],
  ['Quelle est la capitale du Canada ?', ['Toronto', 'Montréal', 'Ottawa', 'Vancouver'], 2],
  ['Quel pays a la forme d\'une botte ?', ['Espagne', 'Grèce', 'Italie', 'Portugal'], 2],
  ['Combien de minutes dans une journée ?', ['1 440', '1 240', '2 400', '960'], 0],
  ['Quel est le plus long fleuve de France ?', ['La Seine', 'Le Rhône', 'La Loire', 'La Garonne'], 2],
  ['Quel instrument a 88 touches ?', ['L\'accordéon', 'Le piano', 'L\'orgue', 'Le xylophone'], 1],
  ['Quelle est la monnaie du Japon ?', ['Le yuan', 'Le won', 'Le yen', 'Le baht'], 2],
  ['Combien d\'os possède un adulte humain ?', ['186', '206', '226', '246'], 1],
  ['Quel gaz les plantes absorbent-elles ?', ['Oxygène', 'Azote', 'Dioxyde de carbone', 'Hélium'], 2],
  ['Quel est le plus haut sommet du monde ?', ['Mont Blanc', 'K2', 'Kilimandjaro', 'Everest'], 3],
  ['Dans quel pays se trouve le Machu Picchu ?', ['Mexique', 'Pérou', 'Chili', 'Bolivie'], 1],
  ['Qui a écrit « Les Misérables » ?', ['Émile Zola', 'Victor Hugo', 'Balzac', 'Molière'], 1],
  ['Combien de cordes a une guitare classique ?', ['4', '5', '6', '7'], 2],
  ['Quelle est la couleur obtenue en mélangeant bleu et jaune ?', ['Violet', 'Orange', 'Vert', 'Marron'], 2],
  ['Quel est le plus petit pays du monde ?', ['Monaco', 'Vatican', 'Saint-Marin', 'Malte'], 1],
  ['Combien de jours compte une année bissextile ?', ['364', '365', '366', '367'], 2],
  ['Quel est l\'organe qui pompe le sang ?', ['Le foie', 'Le cœur', 'Les poumons', 'Les reins'], 1],
  ['Quelle est la capitale de l\'Espagne ?', ['Barcelone', 'Séville', 'Madrid', 'Valence'], 2],
  ['Quel animal est le symbole de la France ?', ['L\'aigle', 'Le lion', 'Le coq', 'L\'ours'], 2],
  ['Combien font 7 × 8 ?', ['54', '56', '58', '64'], 1],
  ['Quel est le plus grand désert chaud du monde ?', ['Gobi', 'Kalahari', 'Sahara', 'Atacama'], 2],
  ['Quelle fête célèbre-t-on le 14 juillet en France ?', ['La fête du travail', 'La fête nationale', 'L\'Armistice', 'La Toussaint'], 1],
  ['Combien de pattes a une araignée ?', ['6', '8', '10', '12'], 1],
  ['Quel métal est liquide à température ambiante ?', ['Le plomb', 'Le mercure', 'L\'étain', 'Le zinc'], 1],
  ['Quelle est la capitale de l\'Allemagne ?', ['Munich', 'Hambourg', 'Francfort', 'Berlin'], 3],
  ['Combien y a-t-il de lettres dans l\'alphabet français ?', ['24', '25', '26', '27'], 2],
  ['Quelle est la plus grande planète du système solaire ?', ['Saturne', 'Jupiter', 'Neptune', 'Uranus'], 1],
  ['Quel sport pratique-t-on à Roland-Garros ?', ['Golf', 'Tennis', 'Rugby', 'Cyclisme'], 1],
  ['Combien de secondes dans une heure ?', ['360', '3 600', '6 000', '1 800'], 1],
  ['Quel est l\'ingrédient principal du guacamole ?', ['La tomate', 'L\'avocat', 'Le concombre', 'Le poivron'], 1],
  ['Dans quelle ville se trouve la tour Eiffel ?', ['Lyon', 'Marseille', 'Paris', 'Lille'], 2],
  ['Quel oiseau ne peut pas voler ?', ['Le pingouin', 'L\'autruche', 'Le moineau', 'La mouette'], 1],
].map(([q, choices, answer]) => ({ q, choices, answer }));

const PHRASES = [
  'Le soleil brille sur la mer et les mouettes chantent au loin.',
  'Un bon ami vaut mieux que mille connaissances.',
  'La nuit tombe doucement sur la ville endormie.',
  'Rien ne sert de courir, il faut partir à point.',
  'Les étoiles dansent dans le ciel comme des lucioles.',
  'Ce soir, on joue, on rigole et on refait le monde.',
  'Le chat noir saute sur le toit pour attraper la lune.',
  'Il faut toujours garder le sourire, même sous la pluie.',
  'Une tasse de chocolat chaud et un bon film, le bonheur.',
  'Petit à petit, l\'oiseau fait son nid.',
  'La musique adoucit les mœurs et réchauffe les cœurs.',
  'Qui veut voyager loin ménage sa monture.',
];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- Jeux solo : sens du meilleur score ----------
// higher = plus grand c'est mieux ; lower = plus petit c'est mieux
const SOLO = {
  serpent: { order: 'higher', max: 5000 },
  demineur: { order: 'lower', max: 3600 },   // secondes
  memory: { order: 'lower', max: 999 },      // coups
  pendu: { order: 'higher', max: 100000 },   // mots trouvés d'affilée
  taquin: { order: 'lower', max: 9999 },     // coups
  reflexes: { order: 'lower', max: 5000 },   // millisecondes
  quiz: { order: 'higher', max: 200 },       // points
};
const MULTI = ['morpion', 'quatre', 'chifoumi', 'frappe', 'quizduel'];

// ---------- Moteurs des parties à deux ----------
const lines3 = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const ENGINES = {
  morpion: {
    init: () => ({ board: Array(9).fill(null), turn: 0 }),
    move(s, p, m) {
      if (s.turn !== p) return 'Ce n\'est pas ton tour';
      const c = parseInt(m.cell, 10);
      if (!(c >= 0 && c < 9) || s.board[c] !== null) return 'Case invalide';
      s.board[c] = p;
      const l = lines3.find(([a, b, d]) => s.board[a] === p && s.board[b] === p && s.board[d] === p);
      if (l) { s.over = true; s.winner = p; s.line = l; } else if (s.board.every(x => x !== null)) { s.over = true; s.winner = null; }
      s.turn = 1 - p;
    },
  },
  quatre: {
    init: () => ({ board: Array.from({ length: 6 }, () => Array(7).fill(null)), turn: 0 }),
    move(s, p, m) {
      if (s.turn !== p) return 'Ce n\'est pas ton tour';
      const col = parseInt(m.col, 10);
      if (!(col >= 0 && col < 7)) return 'Colonne invalide';
      let row = -1;
      for (let r = 5; r >= 0; r--) if (s.board[r][col] === null) { row = r; break; }
      if (row < 0) return 'Colonne pleine';
      s.board[row][col] = p;
      s.last = [row, col];
      const win = quatreWin(s.board, row, col, p);
      if (win) { s.over = true; s.winner = p; s.line = win; } else if (s.board[0].every(x => x !== null)) { s.over = true; s.winner = null; }
      s.turn = 1 - p;
    },
  },
  chifoumi: {
    init: () => ({ picks: [null, null], score: [0, 0], history: [], target: 3 }),
    move(s, p, m) {
      if (!['pierre', 'feuille', 'ciseaux'].includes(m.pick)) return 'Choix invalide';
      if (s.picks[p]) return 'Tu as déjà choisi';
      s.picks[p] = m.pick;
      if (s.picks[0] && s.picks[1]) {
        const beats = { pierre: 'ciseaux', feuille: 'pierre', ciseaux: 'feuille' };
        const [a, b] = s.picks;
        const r = a === b ? null : beats[a] === b ? 0 : 1;
        if (r !== null) s.score[r]++;
        s.history.push({ picks: [a, b], winner: r });
        s.picks = [null, null];
        if (s.score[0] >= s.target || s.score[1] >= s.target) { s.over = true; s.winner = s.score[0] > s.score[1] ? 0 : 1; }
      }
    },
    // On ne montre pas le choix de l'adversaire avant que les deux aient joué
    view: (s, p) => ({ ...s, picks: s.picks.map((x, i) => (i === p ? x : x ? 'caché' : null)) }),
  },
  frappe: {
    init: () => ({ phrase: PHRASES[Math.floor(Math.random() * PHRASES.length)], startAt: Date.now() + 3500, progress: [0, 0], times: [null, null] }),
    move(s, p, m) {
      if (Date.now() < s.startAt) return 'Attends le départ !';
      if (s.times[p] !== null) return null;
      const typed = String(m.typed || '').slice(0, 300);
      let n = 0;
      while (n < typed.length && typed[n] === s.phrase[n]) n++;
      s.progress[p] = n;
      if (typed === s.phrase) {
        s.times[p] = Date.now() - s.startAt;
        if (!s.over) { s.over = true; s.winner = p; }
      }
    },
  },
  quizduel: {
    init: () => ({ questions: shuffle([...QUESTIONS]).slice(0, 7), idx: 0, answers: [], scores: [0, 0], qStart: Date.now() + 2000, reveal: false }),
    move(s, p, m) {
      if (s.reveal || Date.now() < s.qStart) return null;
      const a = s.answers[s.idx] || (s.answers[s.idx] = [null, null]);
      if (a[p] !== null) return null;
      const choice = parseInt(m.choice, 10);
      if (!(choice >= 0 && choice < 4)) return 'Réponse invalide';
      const ms = Date.now() - s.qStart;
      a[p] = { choice, ms };
      if (choice === s.questions[s.idx].answer) s.scores[p] += 10 + Math.max(0, Math.round(5 - ms / 3000));
      if (a[0] !== null && a[1] !== null) s.reveal = true;
    },
    view: (s, p) => {
      const q = s.questions[s.idx];
      const a = s.answers[s.idx] || [null, null];
      return {
        idx: s.idx, total: s.questions.length, scores: s.scores, qStart: s.qStart, reveal: s.reveal, over: s.over, winner: s.winner,
        question: q && { q: q.q, choices: q.choices, answer: s.reveal ? q.answer : undefined },
        mine: a[p] ? a[p].choice : null, otherAnswered: !!a[1 - p], other: s.reveal && a[1 - p] ? a[1 - p].choice : null,
      };
    },
  },
};
function quatreWin(b, r, c, p) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = [[r, c]];
    for (const sgn of [1, -1]) {
      let rr = r + dr * sgn, cc = c + dc * sgn;
      while (rr >= 0 && rr < 6 && cc >= 0 && cc < 7 && b[rr][cc] === p) { cells.push([rr, cc]); rr += dr * sgn; cc += dc * sgn; }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

module.exports = function setupGames({ app, io, db, auth, getUser, publicUser, online, emitToUser, isBlocked, isMutedBy, visibleOnline, log, tooMany }) {
  const now = () => Date.now();
  const games = new Map();   // id -> partie en cours
  const invites = new Map(); // id -> invitation en attente
  const gameOf = uid => [...games.values()].find(g => !g.over && g.players.includes(uid));

  function addResult(uid, game, res) {
    db.prepare(`INSERT INTO game_scores (user_id,game,wins,losses,draws,played,updated_at) VALUES (?,?,?,?,?,1,?)
      ON CONFLICT(user_id,game) DO UPDATE SET wins=wins+excluded.wins, losses=losses+excluded.losses, draws=draws+excluded.draws, played=played+1, updated_at=excluded.updated_at`)
      .run(uid, game, res === 'win' ? 1 : 0, res === 'loss' ? 1 : 0, res === 'draw' ? 1 : 0, now());
  }

  // ----- API : scores solo et classements -----
  app.post('/api/games/score', auth, (req, res) => {
    const def = SOLO[req.body.game];
    const score = Math.round(Number(req.body.score));
    if (!def || !Number.isFinite(score) || score < 0 || score > def.max) return res.status(400).json({ error: 'Score invalide' });
    if (tooMany('score:' + req.user.id, 120, 3600 * 1000)) return res.status(429).json({ error: 'Trop de parties, fais une pause 😉' });
    const cur = db.prepare('SELECT best FROM game_scores WHERE user_id=? AND game=?').get(req.user.id, req.body.game);
    const better = !cur || cur.best === null || (def.order === 'higher' ? score > cur.best : score < cur.best);
    db.prepare(`INSERT INTO game_scores (user_id,game,best,played,updated_at) VALUES (?,?,?,1,?)
      ON CONFLICT(user_id,game) DO UPDATE SET best=CASE WHEN ? THEN excluded.best ELSE best END, played=played+1, updated_at=excluded.updated_at`)
      .run(req.user.id, req.body.game, score, now(), better ? 1 : 0);
    res.json({ best: better ? score : cur.best, record: better });
  });
  app.get('/api/games/me', auth, (req, res) => {
    const rows = db.prepare('SELECT * FROM game_scores WHERE user_id=?').all(req.user.id);
    const out = {};
    for (const r of rows) out[r.game] = { best: r.best, wins: r.wins, losses: r.losses, draws: r.draws, played: r.played };
    res.json({ scores: out });
  });
  app.get('/api/games/leaderboard', auth, (req, res) => {
    const game = String(req.query.game || '');
    let rows;
    if (SOLO[game]) rows = db.prepare(`SELECT s.*, u.username FROM game_scores s JOIN users u ON u.id=s.user_id WHERE s.game=? AND s.best IS NOT NULL ORDER BY s.best ${SOLO[game].order === 'higher' ? 'DESC' : 'ASC'} LIMIT 10`).all(game);
    else if (MULTI.includes(game)) rows = db.prepare('SELECT s.*, u.username FROM game_scores s JOIN users u ON u.id=s.user_id WHERE s.game=? AND s.played>0 ORDER BY s.wins DESC, s.losses ASC LIMIT 10').all(game);
    else return res.status(400).json({ error: 'Jeu inconnu' });
    res.json({ rows: rows.map(r => ({ username: r.username, userId: r.user_id, best: r.best, wins: r.wins, losses: r.losses, draws: r.draws, played: r.played })) });
  });
  app.get('/api/games/quiz', auth, (req, res) => {
    res.json({ questions: shuffle([...QUESTIONS]).slice(0, 10) });
  });

  // ----- Parties à deux -----
  function emitState(g) {
    const eng = ENGINES[g.type];
    g.players.forEach((uid, i) => emitToUser(uid, 'game_state', { id: g.id, game: g.type, you: i, state: eng.view ? eng.view(g.state, i) : g.state, over: !!g.state.over, winner: g.state.winner ?? null }));
  }
  function finish(g, reason) {
    if (g.over) return;
    g.over = true;
    clearTimeout(g.timer);
    const w = g.state.winner;
    g.players.forEach((uid, i) => addResult(uid, g.type, w === null || w === undefined ? 'draw' : w === i ? 'win' : 'loss'));
    const names = g.players.map(id => getUser(id)?.username || '?');
    log(getUser(g.players[0]), 'game', `${GAME_NAMES[g.type]} : ${names[0]} contre ${names[1]} — ${w === null || w === undefined ? 'égalité' : 'victoire de ' + names[w]}${reason ? ' (' + reason + ')' : ''}`);
    g.players.forEach(uid => emitToUser(uid, 'game_over', { id: g.id, winner: w ?? null, reason: reason || '' }));
    setTimeout(() => games.delete(g.id), 5 * 60 * 1000);
  }
  function start(type, players) {
    const g = { id: crypto.randomBytes(6).toString('hex'), type, players, state: ENGINES[type].init(), over: false, rematch: new Set() };
    games.set(g.id, g);
    const pubs = players.map(id => publicUser(getUser(id)));
    players.forEach((uid, i) => emitToUser(uid, 'game_start', { id: g.id, game: type, you: i, players: pubs }));
    emitState(g);
    if (type === 'quizduel') scheduleQuiz(g);
    return g;
  }
  // Quiz duel : 15 s par question, révélation 3 s, puis question suivante
  function scheduleQuiz(g) {
    clearTimeout(g.timer);
    const s = g.state;
    if (s.reveal) {
      g.timer = setTimeout(() => {
        s.idx++; s.reveal = false; s.qStart = now() + 800;
        if (s.idx >= s.questions.length) {
          s.over = true; s.winner = s.scores[0] === s.scores[1] ? null : s.scores[0] > s.scores[1] ? 0 : 1;
          emitState(g); return finish(g);
        }
        emitState(g); scheduleQuiz(g);
      }, 3000);
    } else {
      g.timer = setTimeout(() => { s.reveal = true; emitState(g); scheduleQuiz(g); }, Math.max(0, s.qStart - now()) + 15000);
    }
  }

  return {
    onConnection(socket, uid, current) {
      socket.on('game_invite', ({ to, game } = {}, ack) => {
        const u = current();
        const target = getUser(parseInt(to, 10));
        if (!MULTI.includes(game)) return ack && ack({ error: 'Jeu inconnu' });
        if (!target || target.id === uid) return ack && ack({ error: 'Adversaire invalide' });
        if (!visibleOnline(target.id, u)) return ack && ack({ error: `${target.username} n'est pas connecté` });
        if (isBlocked(target.id, uid) || isBlocked(uid, target.id) || isMutedBy(target.id, uid)) return ack && ack({ error: `${target.username} ne peut pas recevoir ton invitation` });
        if (gameOf(uid)) return ack && ack({ error: 'Termine d\'abord ta partie en cours' });
        if (gameOf(target.id)) return ack && ack({ error: `${target.username} est déjà en train de jouer` });
        if (tooMany('ginv:' + uid, 15, 5 * 60 * 1000)) return ack && ack({ error: 'Trop d\'invitations, patiente un peu' });
        const id = crypto.randomBytes(6).toString('hex');
        const inv = { id, from: uid, to: target.id, game, timer: setTimeout(() => { invites.delete(id); emitToUser(uid, 'game_invite_result', { id, accepted: false, reason: `${target.username} n'a pas répondu` }); emitToUser(target.id, 'game_invite_cancel', { id }); }, 30000) };
        invites.set(id, inv);
        emitToUser(target.id, 'game_invite', { id, game, from: publicUser(u) });
        ack && ack({ id });
      });
      socket.on('game_invite_cancel', id => {
        const inv = invites.get(String(id));
        if (!inv || inv.from !== uid) return;
        clearTimeout(inv.timer); invites.delete(inv.id);
        emitToUser(inv.to, 'game_invite_cancel', { id: inv.id });
      });
      socket.on('game_answer', ({ id, accept } = {}) => {
        const inv = invites.get(String(id));
        if (!inv || inv.to !== uid) return;
        clearTimeout(inv.timer); invites.delete(inv.id);
        if (!accept || gameOf(inv.from) || gameOf(uid)) {
          emitToUser(inv.from, 'game_invite_result', { id: inv.id, accepted: false, reason: `${current().username} a refusé` });
          return;
        }
        emitToUser(inv.from, 'game_invite_result', { id: inv.id, accepted: true });
        start(inv.game, [inv.from, uid]);
      });
      socket.on('game_move', ({ id, move } = {}, ack) => {
        const g = games.get(String(id));
        if (!g || g.over) return ack && ack({ error: 'Partie terminée' });
        const p = g.players.indexOf(uid);
        if (p < 0) return;
        const err = ENGINES[g.type].move(g.state, p, move || {});
        if (err) return ack && ack({ error: err });
        emitState(g);
        if (g.type === 'quizduel' && g.state.reveal) scheduleQuiz(g);
        if (g.state.over) finish(g);
        ack && ack({ ok: true });
      });
      socket.on('game_leave', id => {
        const g = games.get(String(id));
        if (!g || g.over) return;
        const p = g.players.indexOf(uid);
        if (p < 0) return;
        g.state.over = true; g.state.winner = 1 - p;
        emitState(g);
        finish(g, `${current().username} a abandonné`);
      });
      socket.on('game_rematch', id => {
        const g = games.get(String(id));
        if (!g || !g.over || !g.players.includes(uid) || g.rematched) return;
        g.rematch.add(uid);
        const other = g.players.find(x => x !== uid);
        if (g.rematch.size < 2) return emitToUser(other, 'game_rematch_ask', { id: g.id, from: current().username });
        g.rematched = true;
        if (gameOf(g.players[0]) || gameOf(g.players[1])) return;
        start(g.type, [g.players[1], g.players[0]]); // l'autre commence
      });
    },
    // Si un joueur quitte le site, il perd la partie
    onUserGone(uid) {
      const g = gameOf(uid);
      if (g) { g.state.over = true; g.state.winner = 1 - g.players.indexOf(uid); emitState(g); finish(g, `${getUser(uid)?.username || '?'} a quitté le site`); }
      for (const inv of invites.values()) if (inv.from === uid || inv.to === uid) {
        clearTimeout(inv.timer); invites.delete(inv.id);
        emitToUser(inv.from === uid ? inv.to : inv.from, inv.from === uid ? 'game_invite_cancel' : 'game_invite_result', { id: inv.id, accepted: false, reason: 'Joueur parti' });
      }
    },
    inGame: uid => !!gameOf(uid),
  };
};
const GAME_NAMES = { morpion: 'Morpion', quatre: '4 alignés', chifoumi: 'Chifoumi', frappe: 'Course de frappe', quizduel: 'Quiz duel' };
module.exports.GAME_NAMES = GAME_NAMES;
