// The Paradise — 🎳 Le Bowling : des pistes (parties à part), seul ou jusqu'à 4 joueurs, à tour de rôle.
// Le serveur calcule chaque lancer avec la même physique que le navigateur (public/js/bowlphys.js) :
// tout le monde voit exactement la même chose, et personne ne peut tricher sur son score.
const Phys = require('./public/js/bowlphys');
const MAX = 4, TURN_MS = 45000;
module.exports = function setupBowling({ outfitOf = () => '', decoOf = () => '', io, coins = null, track = () => {}, search = null, isEmbeddable = null, modScan = null }) {
  const ytId = s => { const m = String(s || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/) || String(s || '').match(/^([\w-]{11})$/); return m ? m[1] : null; };
  const now = () => Date.now();
  const lanes = new Map(), where = new Map(), sockets = new Map(); let nextId = 1;
  const roomName = id => 'bw:' + id;
  // 🏟️ la salle commune : 5 pistes côte à côte par salle ; chaque partie prend la première piste libre
  const slots = new Map(); // numéro de piste → id de la partie
  const hallOf = l => Math.floor(l.slot / 5), hallRoom = h => 'bwh:' + h;
  const hallOut = h => [...lanes.values()].filter(l => hallOf(l) === h).map(l => ({ id: l.id, pos: l.slot % 5, status: l.status, turn: l.turn, standing: l.standing, busy: l.busy,
    players: l.players.map(p => ({ id: p.id, name: p.name, bot: !!p.bot, gender: p.gender || 'h', outfit: p.bot ? '' : outfitOf(p.id), deco: p.bot ? '' : decoOf(p.id), total: Phys.score(p.rolls).total })) }));
  const sendHall = l => io.to(hallRoom(hallOf(l))).emit('bw_hall', { hall: hallOf(l), lanes: hallOut(hallOf(l)) });
  const humans = l => l.players.filter(p => !p.bot);
  const out = l => ({ slot: l.slot, hall: hallOf(l), id: l.id, name: l.name, host: l.host, status: l.status, turn: l.turn, busy: l.busy, turnEnd: l.turnEnd, serverNow: now(),
    players: l.players.map(p => ({ id: p.id, name: p.name, bot: !!p.bot, ...Phys.score(p.rolls), rolls: p.rolls })), standing: l.standing, results: l.results || null, video: l.video || null });
  const list = () => [...lanes.values()].map(l => ({ hall: hallOf(l) + 1, pos: 5 - l.slot % 5, id: l.id, name: l.name, status: l.status, n: l.players.length, max: MAX }));
  const send = l => { io.to(roomName(l.id)).emit('bw_lane', out(l)); sendHall(l); };
  const sendList = () => io.to('bw:lobby').emit('bw_list', list());
  function nextTurn(l) {
    // le joueur suivant qui n'a pas fini (le même joueur relance s'il a encore un lancer dans sa case)
    const cur = l.players[l.turn], sc = cur && Phys.score(cur.rolls);
    if (!(cur && !sc.over && sc.roll > 0)) {
      for (let k = 1; k <= l.players.length; k++) { const p = l.players[(l.turn + k) % l.players.length]; if (!Phys.score(p.rolls).over) { l.turn = (l.turn + k) % l.players.length; break; } }
    }
    const p = l.players[l.turn];
    if (l.players.every(x => Phys.score(x.rolls).over)) return finish(l);
    l.standing = Phys.standingAfter(p.rolls, p.knocked);
    l.turnEnd = now() + TURN_MS; send(l);
    clearTimeout(l.timer);
    l.timer = setTimeout(() => { if (lanes.has(l.id) && l.status === 'playing' && !l.busy) throwBall(l, p, p.bot ? botParams(p) : { x: (Math.random() - .5) * .3, angle: 0, speed: 5.5, spin: 0 }); }, p.bot ? 2200 : TURN_MS);
  }
  const botParams = p => { const side = Math.random() < .5 ? -1 : 1, good = Math.random() < p.skill; // le robot vise la poche avec de l'effet
    return good ? { x: .25 * side + (Math.random() - .5) * .08, angle: (Math.random() - .5) * .006, speed: 7.5 + Math.random(), spin: -.55 * side + (Math.random() - .5) * .2 } : { x: (Math.random() - .5) * .7, angle: (Math.random() - .5) * .03, speed: 6 + Math.random() * 3, spin: (Math.random() - .5) * 1.4 }; };
  function throwBall(l, p, params) {
    if (l.status !== 'playing' || l.busy || l.players[l.turn] !== p) return;
    clearTimeout(l.timer);
    // un tout petit peu d'imprévu, comme dans la vraie vie
    const q = { x: +params.x + (Math.random() - .5) * .01, angle: +params.angle + (Math.random() - .5) * .002, speed: +params.speed, spin: +params.spin };
    const r = Phys.simulate(q, l.standing);
    p.rolls.push(r.knocked.length); p.knocked.push(r.knocked);
    const sc = Phys.score(p.rolls), last = p.rolls.length - 1, fresh = l.standing.every(Boolean);
    const kind = r.knocked.length === 10 && fresh ? 'strike' : l.standing.filter(Boolean).length === r.knocked.length && r.knocked.length ? 'spare' : r.gutter ? 'gutter' : '';
    if (kind === 'strike') p.strikes = (p.strikes || 0) + 1;
    l.busy = true;
    io.to(hallRoom(hallOf(l))).emit('bw_hall_throw', { lane: l.id, pos: l.slot % 5, name: p.name, by: p.id, frames: r.frames, standing: l.standing, count: r.knocked.length, kind });
    io.to(roomName(l.id)).emit('bw_throw', { lane: l.id, by: p.id, name: p.name, params: q, frames: r.frames, knocked: r.knocked, count: r.knocked.length, kind, standing: l.standing });
    setTimeout(() => { if (!lanes.has(l.id)) return; l.busy = false; nextTurn(l); }, r.frames.length * 1000 / 30 + 1800);
  }
  function finish(l) {
    l.status = 'ended'; clearTimeout(l.timer);
    const res = l.players.map(p => ({ id: p.id, name: p.name, bot: !!p.bot, total: Phys.score(p.rolls).total, strikes: p.strikes || 0 })).sort((a, b) => b.total - a.total);
    const solo = l.players.length === 1;
    for (const r of res) {
      if (r.bot) continue; r.earned = 0;
      if (coins) { const win = !solo && r === res[0]; const n = win ? 15 : 5; if (coins.earnCapped(r.id, win ? 'bowling_win' : 'bowling', n, win ? '🎳 Victoire au bowling' : '🎳 Partie de bowling', 5)) r.earned = n; if (r.total >= 200 && coins.earnCapped(r.id, 'bowling200', 30, '🎳 Plus de 200 au bowling !', 1)) r.earned += 30; }
      track(r.id, 'bowling');
    }
    l.results = res; send(l);
    setTimeout(() => { if (!lanes.has(l.id) || l.status !== 'ended') return; l.status = 'lobby'; l.results = null; l.players = l.players.filter(p => !p.bot); for (const p of l.players) { p.rolls = []; p.knocked = []; p.strikes = 0; } send(l); sendList(); }, 15000);
    sendList();
  }
  function leave(uid) {
    const id = where.get(uid); if (!id) return; where.delete(uid);
    const l = lanes.get(id); if (!l) return;
    for (const s of sockets.get(uid) || []) { s.leave(roomName(id)); s.leave(hallRoom(hallOf(l))); }
    const i = l.players.findIndex(p => p.id === uid); if (i >= 0) { l.players.splice(i, 1); if (l.turn >= i && l.turn > 0) l.turn--; }
    if (!humans(l).length) { clearTimeout(l.timer); lanes.delete(id); slots.delete(l.slot); sendHall(l); sendList(); return; }
    if (l.host === uid) l.host = humans(l)[0].id;
    if (l.status === 'playing' && !l.busy) { l.turn = l.turn % l.players.length; nextTurn(l); } else send(l);
    sendList();
  }
  function onConnection(socket, uid, currentUser) {
    let set = sockets.get(uid); if (!set) sockets.set(uid, set = new Set()); set.add(socket);
    const ack = (cb, v) => typeof cb === 'function' && cb(v);
    const mine = () => lanes.get(where.get(uid));
    const join = (l, u) => { where.set(uid, l.id); for (const s of sockets.get(uid) || []) { s.join(roomName(l.id)); s.join(hallRoom(hallOf(l))); } l.players.push({ id: uid, name: u.username, gender: u.gender, rolls: [], knocked: [] }); send(l); sendList(); };
    socket.on('bw_list', cb => { socket.join('bw:lobby'); ack(cb, { lanes: list(), current: mine() ? out(mine()) : null }); });
    socket.on('bw_hall', (h, cb) => ack(cb, { hall: Number(h) || 0, lanes: hallOut(Number(h) || 0) }));
    socket.on('bw_create', (o, cb) => {
      const u = currentUser(); if (!u) return; leave(uid);
      const ORDER = [2, 1, 3, 0, 4]; let slot = 0; while (slots.has(Math.floor(slot / 5) * 5 + ORDER[slot % 5])) slot++; slot = Math.floor(slot / 5) * 5 + ORDER[slot % 5]; // on remplit d'abord la piste du milieu
      const id = nextId++; slots.set(slot, id); const l = { slot, id, name: `Piste ${5 - slot % 5} · ${u.username}`, host: uid, status: 'lobby', players: [], turn: 0, standing: Array(10).fill(true), busy: false };
      lanes.set(id, l); join(l, u); ack(cb, { ok: true, lane: out(l) });
    });
    socket.on('bw_join', (id, cb) => {
      const u = currentUser(), l = lanes.get(Number(id)); if (!u) return;
      if (!l) return ack(cb, { error: 'Cette piste n\'existe plus' });
      if (where.get(uid) === l.id) return ack(cb, { ok: true, lane: out(l) });
      if (l.status !== 'lobby') return ack(cb, { error: 'La partie a déjà commencé : attends la suivante' });
      if (l.players.length >= MAX) return ack(cb, { error: 'La piste est complète (4 joueurs)' });
      leave(uid); join(l, u); ack(cb, { ok: true, lane: out(l) });
    });
    socket.on('bw_bot', () => { const l = mine(); if (!l || l.host !== uid || l.status !== 'lobby' || l.players.length >= MAX) return; const n = l.players.filter(p => p.bot).length; l.players.push({ id: -(l.id * 10 + n + 1), name: ['Soldat76-Bowl', 'Soldat76-Strike', 'Soldat76-Quille'][n % 3], bot: true, skill: .5 + Math.random() * .3, rolls: [], knocked: [] }); send(l); });
    socket.on('bw_start', () => { const l = mine(); if (!l || l.host !== uid || l.status !== 'lobby') return; l.status = 'playing'; l.turn = 0; for (const p of l.players) { p.rolls = []; p.knocked = []; p.strikes = 0; } sendList(); nextTurnStart(l); });
    const nextTurnStart = l => { l.standing = Array(10).fill(true); l.turnEnd = now() + TURN_MS; send(l); clearTimeout(l.timer); const p = l.players[0]; l.timer = setTimeout(() => { if (l.status === 'playing' && !l.busy && l.players[l.turn] === p) throwBall(l, p, p.bot ? botParams(p) : { x: 0, angle: 0, speed: 5.5, spin: 0 }); }, p.bot ? 2200 : TURN_MS); };
    socket.on('bw_throw', p => { const l = mine(); if (!l || !p) return; const me = l.players.find(x => x.id === uid); if (!me) return; const v = ['x', 'angle', 'speed', 'spin'].map(k => Number(p[k])); if (v.some(n => !Number.isFinite(n))) return; throwBall(l, me, { x: v[0], angle: v[1], speed: v[2], spin: v[3] }); });
    // 📺 l'écran géant : n'importe qui sur la piste met la musique (avec la vidéo) qu'il veut, par un lien ou une recherche YouTube
    socket.on('bw_search', async (q, cb) => {
      const s = String(q || '').trim().slice(0, 120); if (!s) return ack(cb, { results: [] });
      const id = ytId(s); if (id) return ack(cb, { results: [{ videoId: id, title: 'Vidéo YouTube (lien)', length: '' }] });
      if (!search) return ack(cb, { error: 'Colle plutôt un lien YouTube' });
      try { const r = await search(s); ack(cb, { results: r.slice(0, 8).map(x => ({ videoId: x.videoId, title: x.title, length: x.length || '', channel: x.channel || '' })) }); } catch (e) { ack(cb, { error: 'La recherche ne marche pas pour le moment : colle un lien YouTube' }); }
    });
    socket.on('bw_video', async (item, cb) => {
      const l = mine(), u = currentUser(); if (!l || !u || !item) return ack(cb, { error: 'Prends d\'abord une piste' });
      if (item.stop) { l.video = null; send(l); return ack(cb, { ok: true }); }
      const id = ytId(item.videoId || item.url); if (!id) return ack(cb, { error: 'Lien YouTube invalide' });
      if (isEmbeddable && !(await isEmbeddable(id))) return ack(cb, { error: '⚠️ Cette vidéo ne peut pas être lue en dehors de YouTube (son propriétaire l\'interdit). Choisis-en une autre !' });
      const t = String(item.title || 'Vidéo YouTube').slice(0, 120);
      l.video = { videoId: id, title: modScan ? modScan(t).text : t, by: u.username, at: now() };
      send(l); ack(cb, { ok: true });
    });
    socket.on('bw_leave', () => leave(uid));
    socket.on('disconnect', () => { set.delete(socket); if (set.size) return; sockets.delete(uid); leave(uid); });
  }
  return { onConnection };
};
