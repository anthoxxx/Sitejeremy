// The Paradise — 🎙️ Le vocal de proximité (dans la Ville, les maisons, le Paradise Club…)
// On entend les gens qui sont près de nous : plus ils sont loin, moins on les entend, et le son vient de leur côté.
// Les voix passent directement d'un joueur à l'autre (WebRTC) ; le serveur ne fait que présenter les gens
// qui sont dans le même endroit, et vérifie à chaque message qu'ils y sont vraiment.
module.exports = function setupProxVoice({ io, spacesOf = () => [], canTalk = () => true }) {
  const members = new Map(); // socket.id -> { uid, name, space, talk }
  const room = sp => 'pv:' + sp;
  const isIn = (uid, sp) => spacesOf(uid).includes(sp);
  function leave(socket) {
    const m = members.get(socket.id); if (!m) return; members.delete(socket.id);
    socket.leave(room(m.space)); socket.to(room(m.space)).emit('pv_gone', { sid: socket.id });
  }
  function onConnection(socket, uid, currentUser) {
    const ack = (cb, v) => typeof cb === 'function' && cb(v);
    socket.on('pv_join', (space, cb) => {
      const u = currentUser(), sp = String(space || '').slice(0, 80); if (!u) return ack(cb, { error: 'Connecte-toi d\'abord' });
      if (!isIn(uid, sp)) return ack(cb, { error: 'Tu n\'es pas dans cet endroit' });
      leave(socket);
      const me = { uid, name: u.username, space: sp, talk: canTalk(u) };
      const peers = [...members.entries()].filter(([, m]) => m.space === sp).map(([sid, m]) => ({ sid, uid: m.uid, name: m.name, talk: m.talk }));
      members.set(socket.id, me); socket.join(room(sp));
      socket.to(room(sp)).emit('pv_peer', { sid: socket.id, uid, name: me.name, talk: me.talk });
      ack(cb, { ok: true, sid: socket.id, talk: me.talk, peers });
    });
    socket.on('pv_signal', ({ to, data } = {}) => {
      const a = members.get(socket.id), b = members.get(String(to)); if (!a || !b || a.space !== b.space || !data) return;
      if (!isIn(uid, a.space)) { leave(socket); return socket.emit('pv_kicked'); }
      io.to(String(to)).emit('pv_signal', { from: socket.id, data });
    });
    socket.on('pv_mute', m => { const a = members.get(socket.id); if (a) socket.to(room(a.space)).emit('pv_mute', { sid: socket.id, muted: !!m }); });
    socket.on('pv_leave', () => leave(socket));
    socket.on('disconnect', () => leave(socket));
  }
  // quelqu'un change d'endroit : on le sort du vocal de l'ancien
  setInterval(() => { for (const [sid, m] of members) if (!isIn(m.uid, m.space)) { const s = io.sockets.sockets.get(sid); if (s) { leave(s); s.emit('pv_kicked'); } else members.delete(sid); } }, 5000).unref?.();
  return { onConnection };
};
