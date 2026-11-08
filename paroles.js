// The Paradise — « Les Paroles d'Or » : la musique joue, les paroles défilent, puis la musique s'arrête :
// chaque candidat doit écrire la suite des paroles. Présenté par Maestro Paradise.
// Chansons : paroles-songs.js (créations du site + chansons traditionnelles du domaine public).
const SONGS = require('./paroles-songs');

const SLUG = 'paroles';
const HOST = { username: 'Maestro Paradise', color: '#ffc94d', icon: '🎩' };
const MAX_PLAYERS = 6, ROUND_SONGS = 4, BEATS_PER_LINE = 8, LEAD_MS = 3500, ANSWER_MS = 25000, REVEAL_MS = 8000;

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// Nombre de syllabes chantées (approximation du français : la plupart des « e » muets en fin de mot ne se chantent pas)
function syllables(text) {
  let n = 0;
  for (const w of norm(text).split(' ').filter(Boolean)) {
    let v = (w.match(/[aeiouy]+/g) || []).length;
    if (v > 1 && /(e|es|ent)$/.test(w)) v--;
    n += Math.max(1, v);
  }
  return n;
}
// Compose une mélodie simple qui suit les accords (une note par syllabe)
function compose(text, chords, lineIdx) {
  const n = syllables(text);
  const dur = n <= 7 ? 1 : n <= 14 ? .5 : 7 / n;
  const contours = [[0, 1, 2, 1, 2, 3, 2, 1], [2, 1, 0, 1, 2, 2, 3, 4], [4, 3, 2, 1, 2, 1, 0, 0], [0, 2, 1, 3, 2, 4, 3, 2]];
  const shape = contours[lineIdx % contours.length];
  const notes = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const bar = t < 4 ? 0 : 1;
    const [root, kind] = chords[(lineIdx * 2 + bar) % chords.length];
    const tones = [0, kind === 'm' ? 3 : 4, 7, 12, 16];
    const pitch = root + 12 + tones[shape[i % shape.length]];
    const last = i === n - 1;
    notes.push([pitch, last ? Math.max(dur, 8 - t) : dur]);
    t += dur;
  }
  return notes;
}
function prepare(song) {
  const lines = song.lines.map((raw, i) => {
    const m = /\[([^\]]+)\]/.exec(raw);
    const text = raw.replace(/[[\]]/g, '');
    return { text, hidden: m ? m[1] : null, before: m ? raw.slice(0, m.index) : null, after: m ? raw.slice(m.index + m[0].length).replace(/[[\]]/g, '') : null,
      melody: song.melody ? song.melody[i] : compose(text, song.chords, i) };
  });
  const hiddenLine = lines.findIndex(l => l.hidden);
  return { ...song, prepared: lines, hiddenLine };
}

module.exports = function setupParoles({ io, db, getOnline, notify = () => {}, notifyLive = () => {} }) {
  const now = () => Date.now();
  db.exec(`CREATE TABLE IF NOT EXISTS paroles_scores (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    wins INTEGER NOT NULL DEFAULT 0, points INTEGER NOT NULL DEFAULT 0, perfect INTEGER NOT NULL DEFAULT 0, games INTEGER NOT NULL DEFAULT 0)`);
  const addScore = (id, f) => db.prepare(`INSERT INTO paroles_scores (user_id, wins, points, perfect, games) VALUES (?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET wins=wins+excluded.wins, points=points+excluded.points, perfect=perfect+excluded.perfect, games=games+excluded.games`)
    .run(id, f.wins || 0, f.points || 0, f.perfect || 0, f.games || 0);
  const leaderboard = () => db.prepare('SELECT s.*, u.username, u.color FROM paroles_scores s JOIN users u ON u.id=s.user_id ORDER BY s.wins DESC, s.points DESC LIMIT 5').all()
    .map(r => ({ id: r.user_id, username: r.username, color: r.color, wins: r.wins, points: r.points, perfect: r.perfect }));

  let msgSeq = 1, timer = null, lb = leaderboard(), recent = [];
  const g = { phase: 'lobby', players: [], songNo: 0, song: null, startAt: 0, stopAt: 0, deadline: 0, answers: new Map(), results: null, line: '', winner: null, queue: [] };
  const say = content => io.to('room:' + SLUG).emit('message', { room: SLUG, id: 'pa' + (msgSeq++), userId: 0, username: HOST.username, color: HOST.color, gender: 'x', role: 'bot', avatar: '', bot: true, botIcon: HOST.icon, content, createdAt: now(), kind: 'text' });
  const host = l => { g.line = l; };
  const lineMs = s => BEATS_PER_LINE * 60000 / s.bpm;
  const songOut = s => s && {
    id: s.id, title: s.title, artist: s.artist, bpm: s.bpm, chords: s.chords, hiddenLine: s.hiddenLine, beatsPerLine: BEATS_PER_LINE,
    lines: s.prepared.map((l, i) => ({
      text: i === s.hiddenLine && !['reveal', 'end'].includes(g.phase) ? null : l.text,
      before: l.hidden ? l.before : null, after: l.hidden ? l.after : null,
      blanks: l.hidden ? norm(l.hidden).split(' ').map(w => w.length) : null, melody: l.melody,
    })),
    answer: ['reveal', 'end'].includes(g.phase) ? s.prepared[s.hiddenLine].hidden : null,
  };
  const stateOut = () => ({
    phase: g.phase, songNo: g.songNo, total: ROUND_SONGS, song: songOut(g.song), startAt: g.startAt, stopAt: g.stopAt, deadline: g.deadline,
    players: g.players.map(p => ({ id: p.id, username: p.username, color: p.color, avatar: p.avatar, score: p.score, answered: g.answers.has(p.id) })),
    results: g.results, line: g.line, winner: g.winner, leaderboard: lb, now: now(), maxPlayers: MAX_PLAYERS,
  });
  const broadcast = () => io.to('room:' + SLUG).emit('paroles', stateOut());
  const setTimer = (ms, fn) => { clearTimeout(timer); timer = setTimeout(fn, ms); };

  function pickQueue() {
    const fresh = SONGS.filter(s => !recent.includes(s.id)).sort(() => Math.random() - .5);
    const list = (fresh.length >= ROUND_SONGS ? fresh : SONGS.slice().sort(() => Math.random() - .5)).slice(0, ROUND_SONGS);
    recent = [...recent, ...list.map(s => s.id)].slice(-6);
    return list;
  }
  function nextSong() {
    if (!g.players.length) return toLobby();
    if (g.songNo >= ROUND_SONGS) return endGame();
    g.songNo++;
    g.song = prepare(g.queue[g.songNo - 1]);
    g.phase = 'playing'; g.answers = new Map(); g.results = null;
    g.startAt = now() + LEAD_MS;
    g.stopAt = g.startAt + g.song.hiddenLine * lineMs(g.song);
    g.deadline = 0;
    host(`🎶 Chanson ${g.songNo} sur ${ROUND_SONGS} : « ${g.song.title} ». Retenez bien les paroles !`);
    say(`🎶 Chanson ${g.songNo}/${ROUND_SONGS} : « ${g.song.title} » (${g.song.artist}). Chantez avec les paroles… la musique va s'arrêter et il faudra trouver la suite !`);
    broadcast();
    setTimer(g.stopAt - now(), startAnswer);
  }
  function startAnswer() {
    g.phase = 'answer'; g.deadline = now() + ANSWER_MS;
    host('✋ STOP ! La musique s\'arrête… À vous de trouver la suite des paroles !');
    for (const p of g.players) notifyLive(p.id, { type: 'game', icon: '🎤', title: 'À toi ! Écris la suite des paroles', data: { slug: SLUG } });
    broadcast();
    setTimer(ANSWER_MS, reveal);
  }
  function score(guess, answer) {
    const want = norm(answer).split(' '), got = norm(guess).split(' ').filter(Boolean);
    let good = 0;
    want.forEach((w, i) => { const x = got[i]; if (x && (x === w || (w.length >= 5 && lev(x, w) <= 1))) good++; });
    const perfect = good === want.length && got.length === want.length;
    return { good, total: want.length, pts: good * 10 + (perfect ? 20 : 0), perfect };
  }
  function reveal() {
    clearTimeout(timer);
    if (g.phase !== 'answer') return;
    g.phase = 'reveal'; g.deadline = 0;
    const answer = g.song.prepared[g.song.hiddenLine].hidden;
    g.results = g.players.map(p => {
      const a = g.answers.get(p.id) || '';
      const r = score(a, answer);
      p.score += r.pts;
      if (r.perfect) addScore(p.id, { perfect: 1 });
      return { id: p.id, username: p.username, answer: a, ...r };
    });
    const perfects = g.results.filter(r => r.perfect).map(r => r.username);
    host(perfects.length ? `🏆 Bravo ${perfects.join(', ')} ! C'était « ${answer} »` : `C'était « ${answer} » ! Personne n'avait toutes les paroles…`);
    say(`🎤 La suite était : « ${answer} ». ${g.results.map(r => `${r.username} ${r.perfect ? '✅' : r.good ? '🟡' : '❌'} +${r.pts}`).join(' · ')}`);
    broadcast();
    setTimer(REVEAL_MS, nextSong);
  }
  function endGame() {
    clearTimeout(timer);
    g.phase = 'end'; g.deadline = 0;
    const ranking = [...g.players].sort((a, b) => b.score - a.score);
    const best = ranking[0];
    const tie = best && ranking.filter(p => p.score === best.score).length > 1;
    g.winner = best && !tie && best.score > 0 ? { id: best.id, username: best.username, score: best.score } : null;
    g.players.forEach(p => {
      addScore(p.id, { points: p.score, games: 1, wins: g.winner?.id === p.id ? 1 : 0 });
      notify(p.id, { type: 'game', icon: g.winner?.id === p.id ? '👑' : '🎤', title: g.winner?.id === p.id ? `Tu as gagné Les Paroles d'Or avec ${p.score} points !` : `Les Paroles d'Or : ${p.score} points pour toi`, text: g.winner ? `Gagnant : ${g.winner.username}` : 'Égalité !', data: { slug: SLUG } });
    });
    lb = leaderboard();
    host(g.winner ? `👑 ${g.winner.username} remporte Les Paroles d'Or ! Quelle mémoire !` : '🤝 Égalité ! Bravo à tous nos chanteurs !');
    say(g.winner ? `👑 ${g.winner.username} gagne avec ${g.winner.score} points ! ${ranking.map((p, i) => `${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${p.username} ${p.score}`).join(' · ')}` : '🤝 Égalité parfaite !');
    broadcast();
    setTimer(90000, toLobby);
  }
  function toLobby() {
    clearTimeout(timer);
    Object.assign(g, { phase: 'lobby', songNo: 0, song: null, startAt: 0, stopAt: 0, deadline: 0, answers: new Map(), results: null, winner: null, queue: [] });
    g.players.forEach(p => { p.score = 0; });
    host(g.players.length ? '🎤 Prêts à chanter ? Lancez la partie !' : '🎤 Bienvenue ! Montez sur scène pour jouer.');
    broadcast();
  }
  function removePlayer(id) {
    const i = g.players.findIndex(p => p.id === id);
    if (i < 0) return;
    const [p] = g.players.splice(i, 1);
    if (!g.players.length && g.phase !== 'lobby') { say(`👋 ${p.username} a quitté la scène. Fin de la partie.`); return toLobby(); }
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
      if (!u || !socket.rooms.has('room:' + SLUG)) return ack && ack({ error: 'Viens dans le salon Les Paroles d\'Or pour jouer' });
      const r = fn(u, ...args);
      if (ack) ack(r || { ok: true });
    };
    socket.on('pa_state', ack => typeof ack === 'function' && ack(stateOut()));
    socket.on('pa_join', guard(u => {
      if (me()) return;
      if (g.players.length >= MAX_PLAYERS) return { error: `La scène est pleine (${MAX_PLAYERS} chanteurs)` };
      g.players.push({ id: uid, username: u.username, color: u.color, avatar: u.avatar || '', score: 0 });
      say(`🎤 ${u.username} monte sur scène ! (${g.players.length}/${MAX_PLAYERS})`);
      if (g.phase === 'end') toLobby(); else broadcast();
    }));
    socket.on('pa_leave', guard(() => { removePlayer(uid); }));
    socket.on('pa_start', guard(u => {
      if (!me()) return { error: 'Monte d\'abord sur scène' };
      if (g.phase === 'end') toLobby();
      if (g.phase !== 'lobby') return { error: 'La partie a déjà commencé' };
      g.queue = pickQueue(); g.songNo = 0;
      g.players.forEach(p => { p.score = 0; });
      say(`🎩 C'est parti pour Les Paroles d'Or ! ${ROUND_SONGS} chansons. Écoutez bien : au dernier refrain, la musique s'arrête et il faut écrire la suite. 10 points par mot trouvé, +20 si tout est parfait !`);
      nextSong();
    }));
    socket.on('pa_answer', guard((u, text) => {
      if (g.phase !== 'answer') return { error: 'Pas maintenant !' };
      if (!me()) return { error: 'Monte sur scène pour jouer' };
      g.answers.set(uid, String(text || '').slice(0, 120));
      broadcast();
      if (g.players.every(p => g.answers.has(p.id))) reveal();
    }));
    socket.on('pa_new', guard(() => { if (g.phase === 'end') toLobby(); }));
  }

  function command(user, text) {
    const c = text.trim().toLowerCase();
    if (c === '!aide' || c === '!paroles') say('🎩 Les Paroles d\'Or : monte sur scène avec « 🎤 Je chante », lancez la partie, et chantez avec les paroles qui défilent. Au dernier refrain la musique s\'arrête : écris la suite ! 10 points par mot juste, +20 si c\'est parfait. 4 chansons par partie.');
    return Promise.resolve();
  }
  return { onConnection, command, has: slug => slug === SLUG, SLUG};
};
