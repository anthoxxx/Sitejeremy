// The Paradise — « L'Île du Paradise » : un monde en 2D où chaque membre est un petit personnage qui se promène.
// Chaque salon est un lieu de l'île ; on se déplace, on discute avec des bulles au-dessus des têtes, et on entre dans les salons.
// Le serveur garde la position de chacun et relaie les mouvements et les bulles (rien n'est enregistré).
const W = 2400, H = 1600;
// Terre ferme : une grande île ovale (même formule côté navigateur)
const onLand = (x, y) => { const dx = (x - 1200) / 1080, dy = (y - 800) / 700; return dx * dx + dy * dy < 0.93; };

module.exports = function setupIsland({ io, modScan, isStaff, getUser }) {
  const now = () => Date.now();
  const players = new Map(); // userId -> { id, x, y, username, color, avatar, gender, role, frame, sockets:Set, said, saidAt }
  const out = p => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), username: p.username, color: p.color, avatar: p.avatar, gender: p.gender, role: p.role, said: p.saidAt > now() - 6000 ? p.said : '', saidAt: p.saidAt });
  const ROOM = 'island';
  const spawn = () => { for (let i = 0; i < 40; i++) { const x = 1130 + Math.random() * 140, y = 880 + Math.random() * 70; if (onLand(x, y)) return [x, y]; } return [1200, 950]; };

  function leave(uid, sid) {
    const p = players.get(uid);
    if (!p) return;
    p.sockets.delete(sid);
    if (p.sockets.size) return;
    players.delete(uid);
    io.to(ROOM).emit('island_left', { id: uid });
  }

  function onConnection(socket, uid, currentUser) {
    let lastMove = 0, lastSay = 0;
    socket.on('island_join', ack => {
      const u = currentUser();
      if (!u) return;
      socket.join(ROOM);
      let p = players.get(uid);
      if (!p) {
        const [x, y] = spawn();
        p = { id: uid, x, y, username: u.username, color: u.color, avatar: u.avatar || '', gender: u.gender, role: u.role, sockets: new Set(), said: '', saidAt: 0 };
        players.set(uid, p);
        socket.to(ROOM).emit('island_joined', out(p));
      }
      p.sockets.add(socket.id);
      if (typeof ack === 'function') ack({ me: uid, players: [...players.values()].map(out), size: { W, H } });
    });
    socket.on('island_move', pos => {
      const p = players.get(uid);
      if (!p || !pos) return;
      const t = now();
      if (t - lastMove < 60) return; // 16 mises à jour par seconde au maximum
      lastMove = t;
      let x = Number(pos.x), y = Number(pos.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      x = Math.max(0, Math.min(W, x)); y = Math.max(0, Math.min(H, y));
      // pas de téléportation : 60 px au maximum entre deux mises à jour
      const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
      if (d > 60) { x = p.x + dx / d * 60; y = p.y + dy / d * 60; }
      if (!onLand(x, y)) return;
      p.x = x; p.y = y;
      socket.to(ROOM).emit('island_move', { id: uid, x: Math.round(x), y: Math.round(y) });
    });
    // Bulle de chat au-dessus du personnage (filtrée par le ModoBot, rien n'est gardé)
    socket.on('island_say', (text, ack) => {
      const p = players.get(uid), u = currentUser();
      if (!p || !u) return;
      if (u.muted_until && u.muted_until > now()) return typeof ack === 'function' && ack({ error: 'Tu es rendu muet pour le moment' });
      const t = now();
      if (t - lastSay < 1200) return typeof ack === 'function' && ack({ error: 'Doucement !' });
      lastSay = t;
      const raw = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      if (!raw) return;
      const clean = modScan ? modScan(raw).text : raw;
      p.said = clean; p.saidAt = t;
      io.to(ROOM).emit('island_say', { id: uid, text: clean, at: t });
      if (typeof ack === 'function') ack({ ok: true });
    });
    // Petits gestes : 👋 ❤️ 😂 🎉 qui sautent au-dessus du personnage
    socket.on('island_emote', e => {
      const p = players.get(uid);
      if (!p || !['👋', '❤️', '😂', '🎉', '🔥', '😍'].includes(e)) return;
      io.to(ROOM).emit('island_emote', { id: uid, e });
    });
    socket.on('island_leave', () => { socket.leave(ROOM); leave(uid, socket.id); });
    socket.on('disconnect', () => leave(uid, socket.id));
  }
  return { onConnection, count: () => players.size };
};
