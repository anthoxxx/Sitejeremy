// The Paradise — 🎤 The Voice du Paradise : concours de chant au micro, dans le salon « The Voice »
// Le staff ouvre le concours et fait monter les candidats un par un. Pendant que le candidat chante au vocal :
// les membres du staff présents forment le jury (bouton « 🔄 Je me retourne »), le public vote « 👏 J'adore ».
// À la fin, le meilleur score gagne 300 pièces et le badge exclusif 🎙️.
const SLUG = 'thevoice';
const SING_MS = 4 * 60000; // 4 minutes maximum par chanson

module.exports = function setupTheVoice({ io, db, coins, notify = () => {}, isStaff, getOnline, track = () => {} }) {
  const now = () => Date.now();
  db.exec('CREATE TABLE IF NOT EXISTS voice_winners (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, score INTEGER NOT NULL, at INTEGER NOT NULL)');
  let seq = 1, timer = null;
  const show = { phase: 'idle', queue: [], singer: null, song: '', turns: new Set(), likes: new Set(), endsAt: 0, results: [] };
  const userOf = id => { for (const e of getOnline().values()) if (e.user.id === id) return e.user; return null; };
  const here = () => [...getOnline().values()].filter(e => e.room === SLUG && !e.ghost).map(e => e.user);
  const say = content => io.to('room:' + SLUG).emit('message', { room: SLUG, id: 'tv' + (seq++), userId: 0, username: 'The Voice', color: '#ff2d55', gender: 'x', role: 'bot', avatar: '', bot: true, botIcon: '🎤', content, createdAt: now(), kind: 'text' });
  const mini = u => u && { id: u.id, username: u.username, color: u.color, avatar: u.avatar || '', gender: u.gender, avatarFx: u.avatar_fx || 'none' };
  const out = () => ({
    phase: show.phase, singer: show.singer ? mini(userOf(show.singer)) || show.singerInfo : null, song: show.song, endsAt: show.endsAt,
    queue: show.queue.map(id => mini(userOf(id))).filter(Boolean),
    jury: here().filter(u => isStaff(u)).map(u => ({ ...mini(u), turned: show.turns.has(u.id) })),
    likes: show.likes.size, turns: show.turns.size,
    results: [...show.results].sort((a, b) => b.score - a.score).slice(0, 10),
    lastWinner: db.prepare('SELECT w.score, u.username FROM voice_winners w JOIN users u ON u.id=w.user_id ORDER BY w.id DESC LIMIT 1').get() || null,
  });
  const broadcast = () => io.to('room:' + SLUG).emit('thevoice', out());
  const score = () => show.turns.size * 10 + show.likes.size;

  function endSong(reason) {
    clearTimeout(timer);
    if (show.phase !== 'singing' || !show.singer) return;
    const u = userOf(show.singer) || show.singerInfo;
    const s = score();
    show.results.push({ id: show.singer, username: u?.username || '?', song: show.song, turns: show.turns.size, likes: show.likes.size, score: s });
    say(`🎤 Bravo ${u?.username} ! ${show.turns.size} juré${show.turns.size > 1 ? 's' : ''} s'${show.turns.size > 1 ? 'est retournés' : 'est retourné'} 🔄 et ${show.likes.size} 👏 du public : ${s} points${reason ? ' (' + reason + ')' : ''}.`);
    coins.earnCapped(show.singer, 'thevoice_sing', 15, '🎤 The Voice : tu as chanté sur scène', 2);
    track(show.singer, 'game');
    show.phase = 'open'; show.singer = null; show.song = ''; show.endsAt = 0;
    broadcast();
  }
  function routes() {}
  function onConnection(socket, uid, current) {
    const inRoom = () => socket.rooms.has('room:' + SLUG);
    const guard = fn => (...a) => { const ack = typeof a[a.length - 1] === 'function' ? a.pop() : null; const u = current(); if (!u || !inRoom()) return ack && ack({ error: 'Viens dans le salon The Voice 🎤' }); const r = fn(u, ...a); ack && ack(r || { ok: true }); };
    socket.on('tvo_state', ack => typeof ack === 'function' && ack(out()));
    // 🛡️ le staff anime le concours
    socket.on('tvo_open', guard(u => { if (!isStaff(u)) return { error: 'Réservé au staff' }; if (show.phase !== 'idle') return { error: 'Le concours est déjà ouvert' }; Object.assign(show, { phase: 'open', queue: [], results: [], singer: null }); say(`🎤 Le concours THE VOICE DU PARADISE est ouvert par ${u.username} ! Inscris-toi pour chanter 🎶 Le jury, c'est le staff, et le public vote 👏`); io.emit('thevoice_open', { by: u.username }); broadcast(); }));
    socket.on('tvo_next', guard(u => {
      if (!isStaff(u)) return { error: 'Réservé au staff' };
      if (show.phase === 'singing') endSong();
      if (show.phase !== 'open') return { error: 'Ouvre d\'abord le concours' };
      const id = show.queue.shift(); if (!id) { broadcast(); return { error: 'Personne dans la file d\'attente' }; }
      const s = userOf(id); if (!s) { broadcast(); return { error: 'Ce candidat n\'est plus là' }; }
      Object.assign(show, { phase: 'singing', singer: id, singerInfo: mini(s), song: show.songs?.get(id) || '', turns: new Set(), likes: new Set(), endsAt: now() + SING_MS });
      timer = setTimeout(() => endSong('temps écoulé'), SING_MS);
      notify(id, { type: 'game', icon: '🎤', title: 'C\'est à toi de chanter dans The Voice !', text: 'Rejoins le vocal 🎙️ et chante !', data: { slug: SLUG } });
      say(`🎶 Sur scène : ${s.username}${show.song ? ' avec « ' + show.song + ' »' : ''} ! Il/elle rejoint le vocal 🎙️… Jury, retournez-vous si vous aimez 🔄 Public, votez 👏 !`);
      broadcast();
    }));
    socket.on('tvo_end_song', guard(u => { if (!isStaff(u) && u.id !== show.singer) return { error: 'Réservé au staff' }; endSong(); }));
    socket.on('tvo_close', guard(u => {
      if (!isStaff(u)) return { error: 'Réservé au staff' };
      if (show.phase === 'singing') endSong();
      const best = [...show.results].sort((a, b) => b.score - a.score)[0];
      if (best && best.score > 0) {
        db.prepare('INSERT INTO voice_winners (user_id,score,at) VALUES (?,?,?)').run(best.id, best.score, now());
        coins.earn(best.id, 300, '🏆 Gagnant de The Voice du Paradise !', { boost: false });
        db.prepare('INSERT OR IGNORE INTO inventory (user_id,item,created_at) VALUES (?,?,?)').run(best.id, 'badge_voice', now()); coins.equip(best.id, 'badge_voice');
        track(best.id, 'game_win');
        notify(best.id, { type: 'game', icon: '🏆', title: 'Tu as gagné The Voice du Paradise !', text: '300 pièces et le badge 🎙️ à côté de ton pseudo 🎉', important: true });
        say(`🏆🎤 Et le grand gagnant de THE VOICE DU PARADISE est… ${best.username} avec ${best.score} points ! 300 pièces et le badge 🎙️ ! Bravo à tous les candidats 👏`);
        io.emit('thevoice_winner', { username: best.username });
      } else say('🎤 Le concours est terminé. Merci à tous ! À la semaine prochaine 🎶');
      Object.assign(show, { phase: 'idle', queue: [], singer: null, song: '', results: [] }); clearTimeout(timer); broadcast();
    }));
    // 🙋 les membres s'inscrivent
    socket.on('tvo_join', guard((u, song) => {
      if (show.phase === 'idle') return { error: 'Le concours n\'est pas encore ouvert : attends qu\'un membre du staff l\'ouvre 🎤' };
      if (show.singer === u.id || show.queue.includes(u.id)) return { error: 'Tu es déjà inscrit' };
      if (show.results.some(r => r.id === u.id)) return { error: 'Tu as déjà chanté pendant ce concours 🎶' };
      show.songs = show.songs || new Map(); show.songs.set(u.id, String(song || '').replace(/\s+/g, ' ').trim().slice(0, 60));
      show.queue.push(u.id); say(`🙋 ${u.username} s'inscrit pour chanter (n°${show.queue.length})${show.songs.get(u.id) ? ' : « ' + show.songs.get(u.id) + ' »' : ''} !`); broadcast();
    }));
    socket.on('tvo_leave', guard(u => { show.queue = show.queue.filter(id => id !== u.id); broadcast(); }));
    // 🔄 le jury se retourne / 👏 le public adore
    socket.on('tvo_turn', guard(u => { if (show.phase !== 'singing') return { error: 'Personne ne chante' }; if (!isStaff(u)) return { error: 'Seul le jury (le staff) peut se retourner' }; if (u.id === show.singer) return { error: 'Tu chantes !' }; if (show.turns.has(u.id)) return { error: 'Tu t\'es déjà retourné' }; show.turns.add(u.id); io.to('room:' + SLUG).emit('thevoice_turn', { username: u.username }); broadcast(); }));
    socket.on('tvo_like', guard(u => { if (show.phase !== 'singing') return { error: 'Personne ne chante' }; if (u.id === show.singer) return { error: 'Pas pour toi-même 😉' }; if (show.likes.has(u.id)) return { error: 'Tu as déjà voté 👏' }; show.likes.add(u.id); broadcast(); }));
  }
  return { onConnection, routes, SLUG };
};
