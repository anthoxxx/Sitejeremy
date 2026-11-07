// The Paradise — « La Roue du Paradise » : jeu de lettres avec une roue, dans le salon dédié
// Chacun son tour : on tourne la roue, on propose une consonne (points × nombre de lettres),
// on achète une voyelle (200 points) ou on propose la réponse. 3 manches, celui qui a le plus de points gagne.
const PUZZLES = require('./wheel-puzzles');

const SLUG = 'roue';
const BOT = { username: 'Roue Bot', color: '#ffc94d', icon: '🎡' };
const ROUNDS = 3, MAX_PLAYERS = 6, TURN_MS = 35000, SPIN_MS = 3600, VOWEL_COST = 200, SOLVE_BONUS = 500;
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U', 'Y']);
// Les cases de la roue (dans l'ordre, dans le sens des aiguilles d'une montre)
const SEGMENTS = [
  { v: 300 }, { v: 800 }, { v: 400 }, { lose: true }, { v: 600 }, { v: 250 }, { v: 900 }, { pass: true },
  { v: 500 }, { v: 1500, star: true }, { v: 350 }, { v: 700 }, { lose: true }, { v: 450 }, { v: 1000 }, { v: 200 },
];
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/Œ/g, 'OE').replace(/Æ/g, 'AE');
const isLetter = c => c >= 'A' && c <= 'Z';

module.exports = function setupWheel({ io, getOnline, notify = () => {}, notifyLive = () => {} }) {
  const now = () => Date.now();
  let msgSeq = 1, timer = null, lastThemes = [], lastPuzzles = new Set();
  const g = {
    phase: 'lobby',     // lobby | turn | spinning | letter | roundEnd | gameEnd
    players: [],        // { id, username, color, avatar, score, total }
    turn: 0, round: 0, theme: '', answer: '', used: new Set(),
    value: 0, spin: null, deadline: 0, lastEvent: '', winner: null,
  };

  const say = content => io.to('room:' + SLUG).emit('message', { room: SLUG, id: 'wh' + (msgSeq++), userId: 0, username: BOT.username, color: BOT.color, gender: 'x', role: 'bot', avatar: '', bot: true, botIcon: BOT.icon, content, createdAt: now(), kind: 'text' });
  const cur = () => g.players[g.turn] || null;
  const board = () => norm(g.answer).split(' ').map(w => [...w].map(c => (isLetter(c) ? (g.used.has(c) || g.phase === 'roundEnd' || g.phase === 'gameEnd' ? c : '_') : c)));
  const remaining = () => [...new Set([...norm(g.answer)].filter(isLetter))].filter(c => !g.used.has(c));
  const stateOut = () => ({
    phase: g.phase, round: g.round, rounds: ROUNDS, theme: g.theme, board: g.round ? board() : [],
    used: [...g.used], players: g.players.map(p => ({ id: p.id, username: p.username, color: p.color, avatar: p.avatar, score: p.score, total: p.total })),
    turnId: cur()?.id || null, value: g.value, spin: g.spin, deadline: g.deadline, now: now(), event: g.lastEvent,
    segments: SEGMENTS, vowelCost: VOWEL_COST, maxPlayers: MAX_PLAYERS, winner: g.winner,
    consonantsLeft: remaining().some(c => !VOWELS.has(c)), vowelsLeft: remaining().some(c => VOWELS.has(c)),
  });
  const broadcast = () => io.to('room:' + SLUG).emit('wheel', stateOut());
  const event = t => { g.lastEvent = t; };
  const setTimer = (ms, fn) => { clearTimeout(timer); timer = setTimeout(fn, ms); };

  function pickPuzzle() {
    const themes = Object.keys(PUZZLES).filter(t => !lastThemes.includes(t));
    const theme = themes[Math.floor(Math.random() * themes.length)] || Object.keys(PUZZLES)[0];
    lastThemes = [...lastThemes, theme].slice(-4);
    const list = PUZZLES[theme].filter(p => !lastPuzzles.has(p));
    const answer = (list.length ? list : PUZZLES[theme])[Math.floor(Math.random() * (list.length || PUZZLES[theme].length))];
    lastPuzzles.add(answer); if (lastPuzzles.size > 60) lastPuzzles = new Set([...lastPuzzles].slice(-40));
    return { theme, answer };
  }

  function startTurn(text) {
    if (!g.players.length) return toLobby();
    g.turn = g.turn % g.players.length;
    g.phase = 'turn'; g.value = 0; g.spin = null;
    g.deadline = now() + TURN_MS;
    if (text) event(text);
    if (g.players.length > 1) notifyLive(cur().id, { type: 'game', icon: '🎡', title: 'À toi de jouer à La Roue du Paradise !', text: 'Tourne la roue, achète une voyelle ou propose la réponse (35 s).', data: { slug: SLUG } });
    setTimer(TURN_MS, () => nextTurn(`⏱️ Trop tard pour ${cur()?.username || 'le joueur'}`));
    broadcast();
  }
  function nextTurn(text) {
    if (!g.players.length) return toLobby();
    g.turn = (g.turn + 1) % g.players.length;
    startTurn((text ? text + ' · ' : '') + `👉 À ${cur().username} de jouer`);
  }
  function startRound() {
    g.round++;
    const p = pickPuzzle();
    g.theme = p.theme; g.answer = p.answer; g.used = new Set(); g.winner = null;
    g.players.forEach(pl => { pl.score = 0; });
    g.turn = (g.round - 1) % Math.max(1, g.players.length);
    say(`🎡 Manche ${g.round}/${ROUNDS} · Thème : ${g.theme} · ${[...norm(g.answer)].filter(isLetter).length} lettres. À ${cur().username} de commencer !`);
    startTurn(`🎬 Manche ${g.round} · Thème ${g.theme}`);
  }
  function endRound(solver) {
    clearTimeout(timer);
    g.phase = 'roundEnd'; g.deadline = 0; g.spin = null;
    if (solver) {
      const gain = solver.score + SOLVE_BONUS;
      solver.total += gain;
      g.winner = { id: solver.id, username: solver.username, gain };
      event(`🏆 ${solver.username} a trouvé ! +${gain} points`);
      say(`🏆 Bravo ${solver.username} ! La réponse était « ${g.answer} ». +${gain} points (dont ${SOLVE_BONUS} de bonus).`);
    } else {
      event(`La réponse était « ${g.answer} »`);
      say(`😮 Personne n'a trouvé : c'était « ${g.answer} ».`);
    }
    broadcast();
    setTimer(7000, () => (g.round >= ROUNDS ? endGame() : startRound()));
  }
  function endGame() {
    clearTimeout(timer);
    g.phase = 'gameEnd'; g.deadline = 0;
    const ranking = [...g.players].sort((a, b) => b.total - a.total);
    const best = ranking[0];
    g.winner = best ? { id: best.id, username: best.username, total: best.total, final: true } : null;
    event(best ? `👑 ${best.username} gagne la partie avec ${best.total} points !` : 'Partie terminée');
    ranking.forEach((p, i) => notify(p.id, { type: 'game', icon: i === 0 ? '👑' : '🎡', title: i === 0 ? `Tu as gagné La Roue du Paradise avec ${p.total} points !` : `La Roue du Paradise : tu finis ${i + 1}e avec ${p.total} points`, text: `Gagnant : ${best.username}`, data: { slug: SLUG } }));
    if (best) say(`👑 Fin de la partie ! ${ranking.map((p, i) => `${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${p.username} ${p.total}`).join(' · ')}. Clique sur « Nouvelle partie » pour rejouer !`);
    broadcast();
    setTimer(60000, toLobby);
  }
  function toLobby() {
    clearTimeout(timer);
    Object.assign(g, { phase: 'lobby', round: 0, theme: '', answer: '', used: new Set(), value: 0, spin: null, deadline: 0, winner: null });
    g.players.forEach(p => { p.score = 0; p.total = 0; });
    event(g.players.length ? 'Prêts ? Lancez la partie !' : 'Rejoins la partie pour jouer');
    broadcast();
  }
  function removePlayer(id) {
    const i = g.players.findIndex(p => p.id === id);
    if (i < 0) return;
    const wasTurn = i === g.turn && ['turn', 'letter', 'spinning'].includes(g.phase);
    const [p] = g.players.splice(i, 1);
    if (i < g.turn) g.turn--;
    if (!g.players.length) { say(`👋 ${p.username} a quitté la partie.`); return toLobby(); }
    if (wasTurn) { g.turn = (g.turn - 1 + g.players.length) % g.players.length; nextTurn(`👋 ${p.username} est parti`); } else broadcast();
  }
  // Les joueurs qui ne sont plus dans le salon sont retirés de la partie
  setInterval(() => {
    const here = new Set([...getOnline().values()].filter(e => e.room === SLUG).map(e => e.user.id));
    g.players.filter(p => !here.has(p.id)).forEach(p => removePlayer(p.id));
  }, 5000).unref();

  function onConnection(socket, uid, currentUser) {
    const me = () => g.players.find(p => p.id === uid);
    const myTurn = () => cur()?.id === uid;
    const inRoom = () => [...socket.rooms].includes('room:' + SLUG);
    const guard = (fn) => (...args) => {
      const ack = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      const u = currentUser();
      if (!u || !inRoom()) return ack && ack({ error: 'Viens dans le salon de la Roue pour jouer' });
      const r = fn(u, ...args);
      if (ack) ack(r || { ok: true });
    };
    socket.on('wheel_state', ack => typeof ack === 'function' && ack(stateOut()));
    socket.on('wheel_join', guard(u => {
      if (me()) return { ok: true };
      if (g.players.length >= MAX_PLAYERS) return { error: `La partie est pleine (${MAX_PLAYERS} joueurs maximum)` };
      g.players.push({ id: uid, username: u.username, color: u.color, avatar: u.avatar || '', score: 0, total: 0 });
      say(`🙋 ${u.username} rejoint la partie ! (${g.players.length}/${MAX_PLAYERS})`);
      if (g.phase === 'gameEnd') toLobby(); else broadcast();
    }));
    socket.on('wheel_leave', guard(() => { removePlayer(uid); }));
    socket.on('wheel_start', guard(u => {
      if (!me()) return { error: 'Rejoins la partie d\'abord' };
      if (g.phase === 'gameEnd') toLobby();
      if (g.phase !== 'lobby') return { error: 'Une partie est déjà en cours' };
      g.players.forEach(p => { p.score = 0; p.total = 0; });
      say(`🎡 ${u.username} lance la partie ! ${ROUNDS} manches, ${g.players.length} joueur${g.players.length > 1 ? 's' : ''}. Bonne chance !`);
      startRound();
    }));
    socket.on('wheel_spin', guard(u => {
      if (!myTurn() || g.phase !== 'turn') return { error: 'Ce n\'est pas à toi de tourner' };
      if (!remaining().some(c => !VOWELS.has(c))) return { error: 'Il n\'y a plus de consonnes : achète une voyelle ou propose la réponse' };
      const index = Math.floor(Math.random() * SEGMENTS.length);
      g.phase = 'spinning'; g.deadline = 0;
      g.spin = { id: msgSeq++, index, at: now(), ms: SPIN_MS };
      event(`🎡 ${u.username} tourne la roue…`);
      broadcast();
      setTimer(SPIN_MS + 300, () => {
        const s = SEGMENTS[index], p = cur();
        if (!p || p.id !== uid) return;
        if (s.lose) { p.score = 0; return nextTurn(`💥 Tout perdu pour ${p.username} !`); }
        if (s.pass) return nextTurn(`⏭️ ${p.username} passe son tour`);
        g.value = s.v; g.phase = 'letter'; g.deadline = now() + TURN_MS;
        event(`${s.star ? '⭐' : '🎯'} ${s.v} points ! ${p.username}, choisis une consonne`);
        setTimer(TURN_MS, () => nextTurn(`⏱️ Trop tard pour ${p.username}`));
        broadcast();
      });
    }));
    const reveal = (p, L, gain) => {
      const n = [...norm(g.answer)].filter(c => c === L).length;
      g.used.add(L);
      if (!n) return { n };
      if (gain) p.score += gain * n;
      if (!remaining().length) { endRound(p); return { n, done: true }; }
      return { n };
    };
    socket.on('wheel_letter', guard((u, letter) => {
      const L = norm(letter).slice(0, 1);
      if (!myTurn() || g.phase !== 'letter') return { error: 'Tourne d\'abord la roue' };
      if (!isLetter(L) || VOWELS.has(L)) return { error: 'Choisis une consonne' };
      if (g.used.has(L)) return { error: 'Cette lettre a déjà été proposée' };
      const p = cur(), r = reveal(p, L, g.value);
      if (r.done) return;
      if (!r.n) return nextTurn(`❌ Pas de ${L}`);
      startTurn(`✅ ${r.n} ${L} ! +${g.value * r.n} pour ${p.username}. Encore à toi !`);
    }));
    socket.on('wheel_vowel', guard((u, letter) => {
      const L = norm(letter).slice(0, 1);
      if (!myTurn() || g.phase !== 'turn') return { error: 'Ce n\'est pas à toi de jouer' };
      if (!VOWELS.has(L)) return { error: 'Choisis une voyelle' };
      if (g.used.has(L)) return { error: 'Cette voyelle a déjà été proposée' };
      const p = cur();
      if (p.score < VOWEL_COST) return { error: `Il te faut ${VOWEL_COST} points dans cette manche pour acheter une voyelle` };
      p.score -= VOWEL_COST;
      const r = reveal(p, L, 0);
      if (r.done) return;
      if (!r.n) return nextTurn(`❌ Pas de ${L}`);
      startTurn(`🔤 ${r.n} ${L} ! Encore à ${p.username}`);
    }));
    socket.on('wheel_solve', guard((u, text) => {
      if (!myTurn() || !['turn', 'letter'].includes(g.phase)) return { error: 'Ce n\'est pas à toi de jouer' };
      const clean = s => norm(s).replace(/[^A-Z]/g, '');
      const guess = String(text || '').slice(0, 80);
      if (!clean(guess)) return { error: 'Écris ta réponse' };
      if (clean(guess) === clean(g.answer)) { endRound(cur()); return { ok: true, win: true }; }
      say(`❌ ${u.username} propose « ${guess} »… ce n'est pas ça !`);
      nextTurn(`❌ Mauvaise réponse de ${u.username}`);
      return { ok: true, win: false };
    }));
    socket.on('wheel_new', guard(() => { if (g.phase === 'gameEnd') toLobby(); }));
  }

  // Commandes dans le chat du salon
  function command(user, text) {
    const c = text.trim().toLowerCase();
    if (c === '!aide' || c === '!roue') say('🎡 Rejoins la partie avec le bouton « 🙋 Jouer », puis à ton tour : « Tourner la roue » et choisis une consonne (points × nombre de lettres), « Acheter une voyelle » (200 points) ou « Proposer la réponse ». 💥 = tu perds tes points de la manche, ⏭️ = tu passes ton tour. 3 manches, le plus de points gagne !');
    return Promise.resolve();
  }

  return { onConnection, command, has: slug => slug === SLUG, SLUG };
};
