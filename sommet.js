// The Paradise — « Le Sommet du Paradise » : grand quiz sur scène, présenté par Maestro Paradise
// Un candidat à la fois au centre de la scène grimpe 12 paliers de questions jusqu'au million de points.
// 3 aides : ✂️ Moitié (retire 2 mauvaises réponses), 🗳️ Vote du salon (les spectateurs votent), 🔄 Changer de question.
// Paliers de sécurité : 1 000 et 20 000 points.
const QUESTIONS = require('./sommet-questions');

const SLUG = 'sommet';
const HOST = { username: 'Maestro Paradise', color: '#ff5fa2', icon: '🎩' };
const LADDER = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 250000, 1000000];
const SAFE = new Set([3, 7]); // index des paliers de sécurité (1 000 et 20 000)
const Q_MS = 45000, VOTE_MS = 15000, SUSPENSE_MS = 2600, RESULT_MS = 3500, OVER_MS = 9000;
const fmt = n => n.toLocaleString('fr-FR');

module.exports = function setupSommet({ io, db, getOnline, notify = () => {}, notifyLive = () => {}, reward = () => {} }) {
  const now = () => Date.now();
  db.exec(`CREATE TABLE IF NOT EXISTS sommet_scores (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    best INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL DEFAULT 0, tops INTEGER NOT NULL DEFAULT 0, games INTEGER NOT NULL DEFAULT 0)`);
  const save = (id, pts, top) => { reward(id, top ? 'win_sommet' : 'play_sommet', top ? 40 : 5, top ? '🏔️ Au sommet du Paradise !' : '🎮 Partie du Sommet'); return save0(id, pts, top); };
  const save0 = (id, pts, top) => db.prepare(`INSERT INTO sommet_scores (user_id, best, total, tops, games) VALUES (?,?,?,?,1)
    ON CONFLICT(user_id) DO UPDATE SET best=MAX(best, excluded.best), total=total+excluded.total, tops=tops+excluded.tops, games=games+1`).run(id, pts, pts, top ? 1 : 0);
  const leaderboard = () => db.prepare('SELECT s.*, u.username, u.color FROM sommet_scores s JOIN users u ON u.id=s.user_id ORDER BY s.best DESC, s.total DESC LIMIT 5').all()
    .map(r => ({ id: r.user_id, username: r.username, color: r.color, best: r.best, tops: r.tops }));

  let msgSeq = 1, timer = null, lb = leaderboard();
  const used = { easy: new Set(), medium: new Set(), hard: new Set() };
  const g = {
    phase: 'idle',      // idle | intro | question | vote | suspense | result | over
    queue: [],          // ids en attente
    cand: null,         // { id, username, color, avatar }
    level: 0, q: null, pick: null, removed: [], votes: new Map(), voteCounts: null,
    jokers: { half: true, vote: true, swap: true }, deadline: 0, left: 0, line: '', result: null, won: 0,
  };
  const say = content => io.to('room:' + SLUG).emit('message', { room: SLUG, id: 'so' + (msgSeq++), userId: 0, username: HOST.username, color: HOST.color, gender: 'x', role: 'bot', avatar: '', bot: true, botIcon: HOST.icon, content, createdAt: now(), kind: 'text' });
  const host = l => { g.line = l; };
  const secured = () => { let s = 0; for (let i = 0; i < g.level; i++) if (SAFE.has(i)) s = LADDER[i]; return s; };
  const userOf = id => { for (const e of getOnline().values()) if (e.user.id === id) return e.user; return null; };
  const stateOut = () => ({
    phase: g.phase, ladder: LADDER, safe: [...SAFE], level: g.level, cand: g.cand,
    queue: g.queue.map(id => userOf(id)).filter(Boolean).map(u => ({ id: u.id, username: u.username })),
    q: g.q ? { text: g.q.text, answers: g.q.answers, tier: g.q.tier } : null,
    pick: g.pick, removed: g.removed, jokers: g.jokers, voteCounts: g.voteCounts, voters: g.phase === 'vote' ? g.votes.size : 0,
    deadline: g.deadline, line: g.line, result: g.result, secured: secured(), won: g.won,
    correct: ['result', 'over'].includes(g.phase) && g.q ? g.q.correct : null,
    leaderboard: lb, now: now(),
  });
  const broadcast = () => io.to('room:' + SLUG).emit('sommet', stateOut());
  const setTimer = (ms, fn) => { clearTimeout(timer); timer = setTimeout(fn, ms); };

  function drawQuestion(level, exclude) {
    const tier = level < 4 ? 'easy' : level < 8 ? 'medium' : 'hard';
    const list = QUESTIONS[tier];
    let free = list.map((_, i) => i).filter(i => !used[tier].has(i) && i !== exclude);
    if (!free.length) { used[tier].clear(); free = list.map((_, i) => i).filter(i => i !== exclude); }
    const idx = free[Math.floor(Math.random() * free.length)];
    used[tier].add(idx);
    const [text, answers, good] = list[idx];
    const order = [0, 1, 2, 3].sort(() => Math.random() - .5);
    return { idx, tier, text, answers: order.map(i => answers[i]), correct: order.indexOf(good) };
  }
  function nextCandidate() {
    clearTimeout(timer);
    g.cand = null;
    while (g.queue.length) {
      const id = g.queue.shift(), u = userOf(id);
      if (u && [...getOnline().values()].some(e => e.user.id === id && e.room === SLUG)) { g.cand = { id: u.id, username: u.username, color: u.color, avatar: u.avatar || '' }; break; }
    }
    if (!g.cand) {
      Object.assign(g, { phase: 'idle', q: null, pick: null, removed: [], voteCounts: null, result: null, deadline: 0 });
      host('🏔️ Qui sera le prochain candidat à tenter l\'ascension ? Inscris-toi !');
      return broadcast();
    }
    Object.assign(g, { phase: 'intro', level: 0, q: null, pick: null, removed: [], voteCounts: null, result: null, won: 0, jokers: { half: true, vote: true, swap: true }, deadline: 0 });
    notify(g.cand.id, { type: 'game', icon: '🏔️', title: 'C\'est ton tour au Sommet du Paradise !', text: 'Tu es sur scène : 12 questions jusqu\'au million de points.', data: { slug: SLUG } });
    if (g.queue[0]) notifyLive(g.queue[0], { type: 'game', icon: '⏳', title: 'Prépare-toi : tu passes juste après au Sommet !', data: { slug: SLUG } });
    host(`🎩 Applaudissez bien fort ${g.cand.username} ! Objectif : le sommet et son million de points !`);
    say(`🏔️ ${g.cand.username} monte sur scène ! 12 questions jusqu'au million de points. Paliers de sécurité à ${fmt(LADDER[3])} et ${fmt(LADDER[7])} points. Bonne chance !`);
    broadcast();
    setTimer(4500, ask);
  }
  function ask() {
    g.q = drawQuestion(g.level);
    g.phase = 'question'; g.pick = null; g.removed = []; g.voteCounts = null; g.result = null;
    g.deadline = now() + Q_MS;
    host(`Question ${g.level + 1} pour ${fmt(LADDER[g.level])} points${SAFE.has(g.level) ? ' (palier de sécurité !)' : ''}…`);
    broadcast();
    setTimer(Q_MS, () => finish('timeout'));
  }
  function finish(kind) {
    clearTimeout(timer);
    const c = g.cand;
    if (!c) return nextCandidate();
    let pts;
    if (kind === 'top') pts = LADDER[LADDER.length - 1];
    else if (kind === 'quit') pts = g.level ? LADDER[g.level - 1] : 0;
    else pts = secured();
    g.won = pts; g.phase = 'over'; g.deadline = 0;
    host(kind === 'top' ? `🏆 INCROYABLE ! ${c.username} atteint le SOMMET : 1 MILLION de points !` : kind === 'quit' ? `💼 ${c.username} s'arrête là et repart avec ${fmt(pts)} points. Sage décision !` : kind === 'timeout' ? `⏱️ Le temps est écoulé… ${c.username} repart avec ${fmt(pts)} points.` : `😮 Oh non ! ${c.username} repart avec ${fmt(pts)} points.`);
    say(kind === 'top' ? `🏆🏆🏆 ${c.username} a atteint le SOMMET DU PARADISE et gagne 1 000 000 de points ! Bravo !!!` : `🏔️ ${c.username} termine son ascension avec ${fmt(pts)} points. Merci et bravo !`);
    save(c.id, pts, kind === 'top');
    notify(c.id, { type: 'game', icon: kind === 'top' ? '🏆' : '🏔️', title: kind === 'top' ? 'Tu as atteint le SOMMET : 1 000 000 de points !' : `Sommet du Paradise : tu repars avec ${fmt(pts)} points`, text: `Tu es allé jusqu'à la question ${g.level + 1}.`, data: { slug: SLUG } });
    lb = leaderboard();
    broadcast();
    setTimer(OVER_MS, nextCandidate);
  }
  // Le candidat qui quitte le salon termine sa partie ; les inscrits partis sont retirés de la file
  setInterval(() => {
    const here = new Set([...getOnline().values()].filter(e => e.room === SLUG).map(e => e.user.id));
    const before = g.queue.length;
    g.queue = g.queue.filter(id => here.has(id));
    if (g.cand && !here.has(g.cand.id) && !['over', 'idle'].includes(g.phase)) { say(`👋 ${g.cand.username} a quitté la scène.`); return finish('quit'); }
    if (before !== g.queue.length) broadcast();
  }, 5000).unref();

  function onConnection(socket, uid, currentUser) {
    const isCand = () => g.cand?.id === uid;
    const guard = fn => (...args) => {
      const ack = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      const u = currentUser();
      if (!u || !socket.rooms.has('room:' + SLUG)) return ack && ack({ error: 'Viens dans le salon du Sommet pour jouer' });
      const r = fn(u, ...args);
      if (ack) ack(r || { ok: true });
    };
    socket.on('so_state', ack => typeof ack === 'function' && ack(stateOut()));
    socket.on('so_join', guard(u => {
      if (isCand() || g.queue.includes(uid)) return { error: 'Tu es déjà inscrit' };
      if (g.queue.length >= 20) return { error: 'La file d\'attente est pleine' };
      g.queue.push(uid);
      if (!g.cand) { nextCandidate(); return; }
      say(`📝 ${u.username} s'inscrit pour tenter l'ascension (n°${g.queue.length} dans la file).`);
      broadcast();
    }));
    socket.on('so_unjoin', guard(() => { g.queue = g.queue.filter(id => id !== uid); broadcast(); }));
    socket.on('so_pick', guard((u, i) => {
      if (!isCand() || g.phase !== 'question') return { error: 'Ce n\'est pas à toi' };
      i = parseInt(i, 10);
      if (!(i >= 0 && i < 4) || g.removed.includes(i)) return { error: 'Réponse impossible' };
      g.pick = i;
      host(`Réponse ${'ABCD'[i]}… C'est votre dernier mot ?`);
      broadcast();
    }));
    socket.on('so_validate', guard(() => {
      if (!isCand() || g.phase !== 'question' || g.pick == null) return { error: 'Choisis d\'abord une réponse' };
      clearTimeout(timer);
      g.phase = 'suspense'; g.deadline = 0;
      host(`Réponse ${'ABCD'[g.pick]} validée… 🥁`);
      broadcast();
      setTimer(SUSPENSE_MS, () => {
        const good = g.pick === g.q.correct;
        g.phase = 'result'; g.result = good ? 'good' : 'bad';
        if (!good) { host(`❌ Ce n'était pas ça ! La bonne réponse était ${'ABCD'[g.q.correct]} : ${g.q.answers[g.q.correct]}.`); broadcast(); return setTimer(RESULT_MS, () => finish('wrong')); }
        if (g.level === LADDER.length - 1) { broadcast(); return setTimer(RESULT_MS, () => finish('top')); }
        host(`✅ BONNE RÉPONSE ! ${fmt(LADDER[g.level])} points${SAFE.has(g.level) ? ' : palier de sécurité atteint, ils sont à vous !' : ''}`);
        broadcast();
        setTimer(RESULT_MS, () => { g.level++; ask(); });
      });
    }));
    socket.on('so_quit', guard(() => {
      if (!isCand() || g.phase !== 'question') return { error: 'Pas maintenant' };
      finish('quit');
    }));
    socket.on('so_joker', guard((u, kind) => {
      if (!isCand() || g.phase !== 'question') return { error: 'Pas maintenant' };
      if (!g.jokers[kind]) return { error: 'Aide déjà utilisée' };
      g.jokers[kind] = false;
      if (kind === 'half') {
        const wrong = [0, 1, 2, 3].filter(i => i !== g.q.correct).sort(() => Math.random() - .5).slice(0, 2);
        g.removed = wrong; if (wrong.includes(g.pick)) g.pick = null;
        host('✂️ Moitié ! Il ne reste plus que deux réponses…');
        say(`✂️ ${u.username} utilise l'aide Moitié.`);
        broadcast();
      } else if (kind === 'swap') {
        g.q = drawQuestion(g.level, g.q.idx); g.pick = null; g.removed = []; g.voteCounts = null;
        g.deadline = now() + Q_MS;
        host('🔄 Nouvelle question, même valeur !');
        say(`🔄 ${u.username} change de question.`);
        broadcast();
        setTimer(Q_MS, () => finish('timeout'));
      } else if (kind === 'vote') {
        g.left = Math.max(5000, g.deadline - now());
        g.phase = 'vote'; g.votes = new Map(); g.deadline = now() + VOTE_MS;
        host('🗳️ Vote du salon ! Spectateurs, à vous de voter pour la bonne réponse !');
        say(`🗳️ ${u.username} demande l'aide du salon : votez vite avec les boutons A, B, C, D sur la scène (15 secondes) !`);
        broadcast();
        setTimer(VOTE_MS, () => {
          const counts = [0, 0, 0, 0];
          for (const v of g.votes.values()) counts[v]++;
          g.voteCounts = counts; g.phase = 'question'; g.deadline = now() + g.left;
          const total = counts.reduce((a, b) => a + b, 0);
          host(total ? `🗳️ Le salon a voté (${total} vote${total > 1 ? 's' : ''}) !` : '🗳️ Personne n\'a voté… à vous de jouer !');
          broadcast();
          setTimer(g.left, () => finish('timeout'));
        });
      } else return { error: 'Aide inconnue' };
    }));
    socket.on('so_vote', guard((u, i) => {
      if (g.phase !== 'vote' || isCand()) return { error: 'Le vote n\'est pas ouvert' };
      i = parseInt(i, 10);
      if (!(i >= 0 && i < 4) || g.removed.includes(i)) return { error: 'Vote impossible' };
      g.votes.set(uid, i);
      broadcast();
    }));
  }

  function command(user, text) {
    const c = text.trim().toLowerCase();
    if (c === '!aide' || c === '!sommet') say(`🎩 Bienvenue au Sommet du Paradise ! Inscris-toi avec « 🏔️ Je tente l'ascension ». Un candidat à la fois répond à 12 questions de plus en plus dures, jusqu'à 1 000 000 de points. Paliers de sécurité à ${fmt(LADDER[3])} et ${fmt(LADDER[7])}. Aides : ✂️ Moitié, 🗳️ Vote du salon, 🔄 Changer de question. On peut s'arrêter à tout moment avec ses points !`);
    return Promise.resolve();
  }

  return { onConnection, command, has: slug => slug === SLUG, SLUG };
};
