// The Paradise — « Le Grand Blind Test du Paradise », présenté par Maestro Paradise (personnage original du site)
// Le présentateur lance un extrait (vidéo YouTube trouvée par la recherche du DJ Bot, image cachée),
// le premier candidat qui buzze donne le titre et/ou l'artiste. 8 chansons, puis une finale à deux.
const SLUG = 'blindtest';
const HOST = { username: 'Maestro Paradise', color: '#ff5fa2', icon: '🎩' };
const MAX_PLAYERS = 6, SONGS = 8, FINAL_SONGS = 3, LISTEN_MS = 30000, ANSWER_MS = 15000, REVEAL_MS = 7000, BET_MS = 15000;

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\b(feat|ft|the|le|la|les|l)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
// La réponse contient-elle (à peu près) ce texte ? On tolère les petites fautes de frappe.
function close(guess, target) {
  const g = norm(guess), t = norm(target);
  if (!g || !t) return false;
  if ((' ' + g + ' ').includes(' ' + t + ' ')) return true;
  const tol = t.length <= 4 ? 0 : t.length <= 8 ? 1 : 2;
  if (lev(g, t) <= tol) return true;
  // morceau de la réponse de la même longueur que la cible
  const gw = g.split(' '), tn = t.split(' ').length;
  for (let i = 0; i + tn <= gw.length; i++) if (lev(gw.slice(i, i + tn).join(' '), t) <= tol) return true;
  return false;
}
const artistsOf = a => [a, ...String(a).split(/\s*(?:&|,| et | x | feat\.? )\s*/i)].filter(x => norm(x).length >= 2);

module.exports = function setupBlindTest({ io, db, getOnline, ytSearch, catalogs, notify = () => {}, notifyLive = () => {}, reward = () => {} }) {
  const now = () => Date.now();
  db.exec(`CREATE TABLE IF NOT EXISTS bt_scores (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    wins INTEGER NOT NULL DEFAULT 0, points INTEGER NOT NULL DEFAULT 0, stars INTEGER NOT NULL DEFAULT 0, games INTEGER NOT NULL DEFAULT 0)`);
  const addScore = (id, f) => {
    db.prepare(`INSERT INTO bt_scores (user_id, wins, points, stars, games) VALUES (?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET wins=wins+excluded.wins, points=points+excluded.points, stars=stars+excluded.stars, games=games+excluded.games`)
    .run(id, f.wins || 0, f.points || 0, f.stars || 0, f.games || 0);
    // 💰 Paradise Coins
    if (f.wins) reward(id, 'win_blindtest', 30, '🏆 Victoire au Grand Blind Test');
    else if (f.games) reward(id, 'play_blindtest', 5, '🎮 Partie au Grand Blind Test');
  };
  const leaderboard = () => db.prepare('SELECT s.*, u.username, u.color, u.avatar FROM bt_scores s JOIN users u ON u.id=s.user_id ORDER BY s.wins DESC, s.points DESC LIMIT 5').all()
    .map(r => ({ id: r.user_id, username: r.username, color: r.color, avatar: r.avatar, wins: r.wins, points: r.points, stars: r.stars }));
  const themes = catalogs.map(c => c.cat);

  let msgSeq = 1, timer = null, lb = leaderboard();
  const g = {
    phase: 'lobby',     // lobby | intro | loading | playing | buzzed | reveal | bet | end
    players: [],        // { id, username, color, avatar, score }
    theme: '', songNo: 0, total: SONGS, final: false, finalists: [],
    song: null,         // { artist, title, videoId, start, duration }
    played: 0, resumedAt: 0, buzz: null, locked: new Set(), found: null, line: '', bets: new Map(), queue: [], winner: null,
  };
  const say = content => io.to('room:' + SLUG).emit('message', { room: SLUG, id: 'bt' + (msgSeq++), userId: 0, username: HOST.username, color: HOST.color, gender: 'x', role: 'bot', avatar: '', bot: true, botIcon: HOST.icon, content, createdAt: now(), kind: 'text' });
  const host = line => { g.line = line; };
  const position = () => g.played + (g.phase === 'playing' && g.resumedAt ? now() - g.resumedAt : 0);
  const stateOut = () => ({
    phase: g.phase, theme: g.theme, themes, songNo: g.songNo, total: g.total, final: g.final, finalists: g.finalists,
    players: g.players.map(p => ({ id: p.id, username: p.username, color: p.color, avatar: p.avatar, score: p.score })),
    media: g.song && ['playing', 'buzzed'].includes(g.phase) ? { videoId: g.song.videoId, start: g.song.start, pos: position(), paused: g.phase !== 'playing' } : null,
    answer: g.phase === 'reveal' || g.phase === 'end' ? (g.song ? { artist: g.song.artist, title: g.song.title, videoId: g.song.videoId } : null) : null,
    buzz: g.buzz ? { id: g.buzz.id, username: g.buzz.username, deadline: g.buzz.deadline } : null,
    locked: [...g.locked], found: g.found, line: g.line, listenLeft: g.phase === 'playing' || g.phase === 'buzzed' ? Math.max(0, LISTEN_MS - position()) : 0,
    betDeadline: g.phase === 'bet' ? g.betDeadline : 0, bets: [...g.bets.values()].reduce((o, id) => (o[id] = (o[id] || 0) + 1, o), {}),
    winner: g.winner, leaderboard: lb, now: now(), maxPlayers: MAX_PLAYERS,
  });
  const broadcast = () => io.to('room:' + SLUG).emit('blindtest', stateOut());
  const setTimer = (ms, fn) => { clearTimeout(timer); timer = setTimeout(fn, ms); };
  const canBuzz = id => g.players.some(p => p.id === id) && (!g.final || g.finalists.includes(id)) && !g.locked.has(id);

  function pickQueue(theme) {
    const pool = (theme ? catalogs.filter(c => c.cat === theme) : catalogs).flatMap(c => c.songs);
    const seen = new Set(), list = [];
    for (const s of pool.sort(() => Math.random() - .5)) { const k = norm(s[0] + s[1]); if (!seen.has(k)) { seen.add(k); list.push(s); } }
    return list;
  }
  async function loadSong(tries = 0) {
    const s = g.queue.shift();
    if (!s || tries > 4) { say('😕 Oups, la régie n\'arrive pas à trouver les musiques en ce moment. On réessaie un peu plus tard !'); return toLobby(); }
    try {
      const res = await ytSearch(`${s[0]} ${s[1]} audio officiel`);
      const v = res.find(r => r.duration >= 90 && r.duration <= 600) || res[0];
      if (!v) return loadSong(tries + 1);
      return { artist: s[0], title: s[1], videoId: v.videoId, duration: v.duration, start: Math.max(5, Math.min(50, Math.floor(v.duration * .2))) };
    } catch (e) { return loadSong(tries + 1); }
  }
  async function nextSong() {
    if (g.phase === 'lobby') return;
    const last = g.final ? g.songNo >= FINAL_SONGS : g.songNo >= SONGS;
    if (last) return g.final || g.players.length < 2 ? endShow() : startBets();
    g.songNo++;
    g.phase = 'loading'; g.buzz = null; g.locked = new Set(); g.found = null; g.song = null;
    host(`🎶 ${g.final ? 'Finale · ' : ''}Chanson ${g.songNo} sur ${g.total}… la régie prépare l'extrait !`);
    broadcast();
    const song = await loadSong();
    if (!song || g.phase !== 'loading') return;
    g.song = song; g.phase = 'playing'; g.played = 0; g.resumedAt = now();
    host(g.final ? '🔥 Finale ! Écoutez bien… et buzzez !' : ['🎧 Écoutez bien… et buzzez !', '🎵 Ça vous dit quelque chose ?', '👂 Ouvrez grand les oreilles !', '🎶 Qui va trouver le premier ?'][g.songNo % 4]);
    broadcast();
    setTimer(LISTEN_MS, () => reveal(null));
  }
  function reveal(winner) {
    clearTimeout(timer);
    g.phase = 'reveal'; g.buzz = null;
    if (!winner) { host(`⏱️ Temps écoulé ! C'était « ${g.song.title} » de ${g.song.artist}.`); say(`🎵 C'était « ${g.song.title} » de ${g.song.artist}. Personne n'a trouvé !`); }
    broadcast();
    setTimer(REVEAL_MS, nextSong);
  }
  function startBets() {
    clearTimeout(timer);
    const top = [...g.players].sort((a, b) => b.score - a.score).slice(0, 2);
    g.finalists = top.map(p => p.id);
    g.phase = 'bet'; g.bets = new Map(); g.betDeadline = now() + BET_MS; g.song = null;
    host(`🏆 Place à la grande finale : ${top[0].username} contre ${top[1].username} ! Public, pariez sur votre favori ⭐`);
    top.forEach(p => notify(p.id, { type: 'game', icon: '🏆', title: 'Tu es en grande finale du Blind Test !', text: `Contre ${top.find(x => x.id !== p.id).username}. Les points comptent double !`, data: { slug: SLUG } }));
    for (const e of getOnline().values()) if (e.room === SLUG && !g.finalists.includes(e.user.id)) notifyLive(e.user.id, { type: 'game', icon: '⭐', title: 'Paris ouverts : parie sur ton finaliste !', text: `${top[0].username} contre ${top[1].username}`, data: { slug: SLUG } });
    say(`🏆 FINALE : ${top[0].username} (${top[0].score} pts) contre ${top[1].username} (${top[1].score} pts) ! ${FINAL_SONGS} chansons, les points comptent double. Le public a ${BET_MS / 1000} secondes pour parier ⭐`);
    broadcast();
    setTimer(BET_MS, () => {
      g.final = true; g.songNo = 0; g.total = FINAL_SONGS;
      g.players.forEach(p => { if (g.finalists.includes(p.id)) p.score = 0; });
      nextSong();
    });
  }
  function endShow() {
    clearTimeout(timer);
    g.phase = 'end'; g.buzz = null;
    const pool = g.final ? g.players.filter(p => g.finalists.includes(p.id)) : g.players;
    const best = [...pool].sort((a, b) => b.score - a.score)[0];
    const tie = best && pool.filter(p => p.score === best.score).length > 1;
    g.winner = best && !tie && best.score > 0 ? { id: best.id, username: best.username, score: best.score } : null;
    g.players.forEach(p => addScore(p.id, { points: p.score, games: 1, wins: g.winner && g.winner.id === p.id ? 1 : 0 }));
    let goodBets = 0;
    if (g.winner) for (const [uid, pick] of g.bets) if (pick === g.winner.id) { addScore(uid, { stars: 1 }); goodBets++; notify(uid, { type: 'game', icon: '⭐', title: 'Pari gagné ! +1 étoile au Blind Test', text: `${g.winner.username} a gagné l'émission.`, data: { slug: SLUG } }); }
    g.players.forEach(p => notify(p.id, { type: 'game', icon: g.winner?.id === p.id ? '👑' : '🎩', title: g.winner?.id === p.id ? `Tu as gagné Le Grand Blind Test avec ${p.score} points !` : `Le Grand Blind Test est terminé : ${p.score} points pour toi`, text: g.winner ? `Gagnant : ${g.winner.username}` : 'Égalité !', data: { slug: SLUG } }));
    lb = leaderboard();
    host(g.winner ? `👑 Et le grand gagnant de ce soir est… ${g.winner.username} ! Bravo !` : '🤝 Égalité parfaite ! Merci à nos candidats !');
    say(g.winner ? `👑 ${g.winner.username} remporte Le Grand Blind Test du Paradise ! 👏👏👏${goodBets ? ` ${goodBets} personne${goodBets > 1 ? 's' : ''} du public gagne${goodBets > 1 ? 'nt' : ''} une ⭐ pour son pari.` : ''} Clique sur « Nouvelle émission » pour rejouer.` : '🤝 Égalité ! Merci à tous, à la prochaine émission 🎤');
    broadcast();
    setTimer(90000, toLobby);
  }
  function toLobby() {
    clearTimeout(timer);
    Object.assign(g, { phase: 'lobby', theme: '', songNo: 0, total: SONGS, final: false, finalists: [], song: null, buzz: null, locked: new Set(), found: null, bets: new Map(), queue: [], winner: null });
    g.players.forEach(p => { p.score = 0; });
    host(g.players.length ? '🎤 Candidats prêts ? On lance l\'émission quand vous voulez !' : '🎤 Bonsoir et bienvenue ! Montez sur le plateau pour jouer.');
    broadcast();
  }
  function removePlayer(id) {
    const i = g.players.findIndex(p => p.id === id);
    if (i < 0) return;
    const [p] = g.players.splice(i, 1);
    if (!g.players.length && g.phase !== 'lobby') { say(`👋 ${p.username} a quitté le plateau. Fin de l'émission.`); return toLobby(); }
    if (g.buzz && g.buzz.id === id) { g.buzz = null; resume(); }
    if (g.final && g.finalists.includes(id)) { g.finalists = g.finalists.filter(x => x !== id); if (g.finalists.length < 2) return endShow(); }
    broadcast();
  }
  function resume() {
    if (g.phase !== 'buzzed') return;
    g.phase = 'playing'; g.resumedAt = now(); g.buzz = null;
    const everyoneLocked = g.players.filter(p => canBuzz(p.id)).length === 0;
    if (everyoneLocked) return reveal(null);
    broadcast();
    setTimer(Math.max(1000, LISTEN_MS - g.played), () => reveal(null));
  }
  // Les candidats qui ne sont plus dans le salon descendent du plateau
  setInterval(() => {
    const here = new Set([...getOnline().values()].filter(e => e.room === SLUG).map(e => e.user.id));
    g.players.filter(p => !here.has(p.id)).forEach(p => removePlayer(p.id));
  }, 5000).unref();

  function onConnection(socket, uid, currentUser) {
    const me = () => g.players.find(p => p.id === uid);
    const inRoom = () => socket.rooms.has('room:' + SLUG);
    const guard = fn => (...args) => {
      const ack = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      const u = currentUser();
      if (!u || !inRoom()) return ack && ack({ error: 'Viens dans le salon du Blind Test pour jouer' });
      const r = fn(u, ...args);
      if (ack) ack(r || { ok: true });
    };
    socket.on('bt_state', ack => typeof ack === 'function' && ack(stateOut()));
    socket.on('bt_join', guard(u => {
      if (me()) return;
      if (g.final) return { error: 'La finale est en cours : tu pourras jouer à la prochaine émission' };
      if (g.players.length >= MAX_PLAYERS) return { error: `Le plateau est complet (${MAX_PLAYERS} candidats)` };
      g.players.push({ id: uid, username: u.username, color: u.color, avatar: u.avatar || '', score: 0 });
      if (g.phase === 'lobby') for (const p of g.players) notifyLive(p.id, { type: 'game', icon: '🙌', title: `${u.username} rejoint le Blind Test`, data: { slug: SLUG } });
      say(`🙌 ${u.username} monte sur le plateau ! (${g.players.length}/${MAX_PLAYERS})`);
      if (g.phase === 'end') toLobby(); else broadcast();
    }));
    socket.on('bt_leave', guard(() => { removePlayer(uid); }));
    socket.on('bt_start', guard((u, theme) => {
      if (!me()) return { error: 'Monte d\'abord sur le plateau' };
      if (g.phase === 'end') toLobby();
      if (g.phase !== 'lobby') return { error: 'L\'émission a déjà commencé' };
      g.theme = themes.includes(theme) ? theme : '';
      g.queue = pickQueue(g.theme);
      g.players.forEach(p => { p.score = 0; });
      g.phase = 'intro';
      host(`🎩 Bonsoir à toutes et à tous et bienvenue dans Le Grand Blind Test du Paradise ! Ce soir : ${g.theme || 'tous les styles'} !`);
      say(`🎩 L'émission commence ! ${g.players.map(p => p.username).join(', ')} sur le plateau. ${SONGS} chansons ${g.theme ? '(' + g.theme + ')' : 'de tous les styles'}. Buzzez dès que vous reconnaissez, puis donnez le titre (2 pts) et/ou l'artiste (1 pt) !`);
      broadcast();
      setTimer(5000, nextSong);
    }));
    socket.on('bt_buzz', guard(u => {
      if (g.phase !== 'playing') return { error: 'Pas maintenant !' };
      if (!canBuzz(uid)) return { error: g.locked.has(uid) ? 'Tu as déjà tenté ta chance sur cette chanson' : g.final ? 'Seuls les finalistes peuvent buzzer' : 'Monte sur le plateau pour buzzer' };
      g.played += now() - g.resumedAt; g.resumedAt = 0;
      g.phase = 'buzzed';
      g.buzz = { id: uid, username: u.username, deadline: now() + ANSWER_MS };
      host(`🔴 ${u.username} a buzzé ! Le titre ? L'artiste ?`);
      broadcast();
      setTimer(ANSWER_MS, () => { g.locked.add(uid); host(`⏱️ Trop tard ${u.username} ! La musique reprend…`); resume(); });
    }));
    socket.on('bt_answer', guard((u, text) => {
      if (g.phase !== 'buzzed' || g.buzz?.id !== uid) return { error: 'Ce n\'est pas à toi de répondre' };
      const guess = String(text || '').slice(0, 100);
      const titleOk = close(guess, g.song.title);
      const artistOk = artistsOf(g.song.artist).some(a => close(guess, a));
      const pts = ((titleOk ? 2 : 0) + (artistOk ? 1 : 0)) * (g.final ? 2 : 1);
      const p = me();
      if (pts && p) {
        p.score += pts;
        g.found = { id: uid, username: u.username, pts, title: titleOk, artist: artistOk };
        host(`✅ ${titleOk && artistOk ? 'Le titre ET l\'artiste' : titleOk ? 'Le titre' : 'L\'artiste'} ! +${pts} pour ${u.username} 👏`);
        say(`✅ Bravo ${u.username} ! « ${g.song.title} » de ${g.song.artist}. +${pts} point${pts > 1 ? 's' : ''} !`);
        reveal(p);
        return { ok: true, good: true, pts };
      }
      g.locked.add(uid);
      host(`❌ « ${guess} »… non ! La musique reprend pour les autres !`);
      resume();
      return { ok: true, good: false };
    }));
    socket.on('bt_bet', guard((u, pick) => {
      if (g.phase !== 'bet') return { error: 'Les paris sont fermés' };
      if (g.finalists.includes(uid)) return { error: 'Les finalistes ne parient pas 😉' };
      if (!g.finalists.includes(pick)) return { error: 'Choisis un des finalistes' };
      g.bets.set(uid, pick);
      broadcast();
    }));
    socket.on('bt_new', guard(() => { if (g.phase === 'end') toLobby(); }));
  }

  function command(user, text) {
    const c = text.trim().toLowerCase();
    if (c === '!aide' || c === '!blindtest') say(`🎩 Je suis Maestro Paradise ! Monte sur le plateau avec « 🙋 Je joue », puis lancez l'émission. Quand la musique démarre, appuie sur le gros bouton BUZZ 🔴 et écris le titre (2 pts) et/ou l'artiste (1 pt). Après ${SONGS} chansons, les 2 meilleurs vont en finale (points doublés) et le public parie ⭐ sur son favori !`);
    return Promise.resolve();
  }

  return { onConnection, command, has: slug => slug === SLUG, SLUG };
};
