// The Paradise — 🔫 Le Laser Game : des parties séparées (« instances »), 3 cartes, équipe Rouge contre équipe Bleue.
// Le serveur garde la position de chacun, vérifie chaque tir (murs, distance, cadence) et compte les points.
// S'il manque du monde, des robots complètent les équipes. Rien n'est enregistré : tout disparaît à la fin de la partie.

const C = 3; // taille d'une case de la carte, en mètres
// # = mur · c = caisse · R / B = base des Rouges / des Bleus · . = sol
const MAPS = {
  neon: { name: 'Arène Néon', icon: '🌈', desc: 'Une grande arène ouverte avec des piliers lumineux : idéale pour viser de loin.', grid: [
    '##########################',
    '#RR....#..........#....BB#',
    '#RR....#..........#....BB#',
    '#......#...cc.....#......#',
    '#...........##...........#',
    '#..cc.................cc.#',
    '#....#....#....#....#....#',
    '#....#..............#....#',
    '#....#..............#....#',
    '#....#....#....#....#....#',
    '#..cc.................cc.#',
    '#...........##...........#',
    '#......#.....cc...#......#',
    '#RR....#..........#....BB#',
    '#RR....#..........#....BB#',
    '##########################'] },
  entrepot: { name: 'Entrepôt', icon: '📦', desc: 'Un vieil entrepôt rempli de caisses : cache-toi et surprends tes ennemis.', grid: [
    '##########################',
    '#RR..c....c....c...c...BB#',
    '#RR..c..cc.....cc..c...BB#',
    '#....c......##.........c.#',
    '#.cc....c...##...c....cc.#',
    '#....##.............##...#',
    '#.c..##..cc....cc...##.c.#',
    '#........c......c........#',
    '#........c......c........#',
    '#.c..##..cc....cc...##.c.#',
    '#....##.............##...#',
    '#.cc....c...##...c....cc.#',
    '#.c.........##......c....#',
    '#RR..c..cc.....cc..c...BB#',
    '#RR..c....c....c...c...BB#',
    '##########################'] },
  laby: { name: 'Labyrinthe Cyber', icon: '🌀', desc: 'Des couloirs étroits et des virages partout : attention à chaque coin !', grid: [
    '##########################',
    '#RR.#.......##.......#.BB#',
    '#RR.#.####......####.#.BB#',
    '#...#.#..#..##..#..#.#...#',
    '#.###.#..#..##..#..#.###.#',
    '#.....#..............#...#',
    '###.#####.##..##.#####.###',
    '#.........#....#.........#',
    '#.........#....#.........#',
    '###.#####.##..##.#####.###',
    '#.....#..............#...#',
    '#.###.#..#..##..#..#.###.#',
    '#...#.#..#..##..#..#.#...#',
    '#RR.#.####......####.#.BB#',
    '#RR.#.......##.......#.BB#',
    '##########################'] },
};
const TEAMS = ['red', 'blue'];
const MAX = 10, ROUND_MS = 4 * 60 * 1000, WIN = 25, FIRE_MS = 280, DEAD_MS = 3000, SHIELD_MS = 2000, RANGE = 45, SPEED = 5.2, R = .38, EYE = 1.6;
const BOT_NAMES = ['Soldat76-Alpha', 'Soldat76-Bravo', 'Soldat76-Charlie', 'Soldat76-Delta', 'Soldat76-Echo', 'Soldat76-Fox', 'Soldat76-Golf', 'Soldat76-Hotel'];

// ---------- la carte : murs, cases libres, bases ----------
function prepMap(key) {
  const m = MAPS[key], H = m.grid.length, W = m.grid[0].length, spawns = { red: [], blue: [] }, free = [];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const ch = m.grid[z][x];
    if (ch === 'R') spawns.red.push([x, z]); if (ch === 'B') spawns.blue.push([x, z]);
    if (ch !== '#' && ch !== 'c') free.push([x, z]);
  }
  return { key, W, H, grid: m.grid, spawns, free };
}
const PREP = Object.fromEntries(Object.keys(MAPS).map(k => [k, prepMap(k)]));
const solidCell = (M, cx, cz) => cx < 0 || cz < 0 || cx >= M.W || cz >= M.H || M.grid[cz][cx] === '#' || M.grid[cz][cx] === 'c';
const solidAt = (M, x, z) => solidCell(M, Math.floor(x / C), Math.floor(z / C));
// un rond de rayon R ne touche aucun mur
const fits = (M, x, z) => !solidAt(M, x - R, z - R) && !solidAt(M, x + R, z - R) && !solidAt(M, x - R, z + R) && !solidAt(M, x + R, z + R);
// distance (à plat) jusqu'au premier mur dans une direction (on avance case par case)
function wallDist(M, x, z, dx, dz, max) {
  const len = Math.hypot(dx, dz); if (len < 1e-6) return max; dx /= len; dz /= len;
  let cx = Math.floor(x / C), cz = Math.floor(z / C);
  const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = Math.abs(C / dx), tdz = Math.abs(C / dz);
  let tx = dx ? ((dx > 0 ? (cx + 1) * C - x : x - cx * C) / Math.abs(dx)) : Infinity, tz = dz ? ((dz > 0 ? (cz + 1) * C - z : z - cz * C) / Math.abs(dz)) : Infinity;
  for (let i = 0; i < 200; i++) {
    let t; if (tx < tz) { cx += sx; t = tx; tx += tdx; } else { cz += sz; t = tz; tz += tdz; }
    if (t > max) return max;
    if (solidCell(M, cx, cz)) return t;
  }
  return max;
}
const seeEach = (M, a, b) => { const d = Math.hypot(b.x - a.x, b.z - a.z); return wallDist(M, a.x, a.z, b.x - a.x, b.z - a.z, d) >= d - .01; };
// le chemin le plus court sur la grille (pour les robots)
function path(M, from, to) {
  const k = (x, z) => z * M.W + x, prev = new Map([[k(...from), -1]]), q = [from];
  while (q.length) {
    const [x, z] = q.shift(); if (x === to[0] && z === to[1]) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (solidCell(M, nx, nz) || prev.has(k(nx, nz))) continue; prev.set(k(nx, nz), k(x, z)); q.push([nx, nz]); }
  }
  if (!prev.has(k(...to))) return [];
  const out = []; for (let c = k(...to); c !== -1 && c !== k(...from); c = prev.get(c)) out.unshift([c % M.W, Math.floor(c / M.W)]);
  return out;
}

module.exports = function setupLaserGame({ io, coins = null, track = () => {} }) {
  const now = () => Date.now();
  const rooms = new Map(); // id -> partie
  const where = new Map(); // userId -> id de la partie
  let nextId = 1;
  const roomName = id => 'lg:' + id;
  const humans = r => [...r.players.values()].filter(p => !p.bot);
  const count = (r, team) => [...r.players.values()].filter(p => p.team === team).length;
  const lessTeam = r => (count(r, 'red') <= count(r, 'blue') ? 'red' : 'blue');

  const pubPlayer = p => ({ id: p.id, name: p.name, team: p.team, bot: !!p.bot, gender: p.gender || '', tags: p.tags, deaths: p.deaths, host: false });
  function roomOut(r) {
    return { id: r.id, name: r.name, map: r.map, host: r.host, status: r.status, bots: r.bots, players: [...r.players.values()].map(p => ({ ...pubPlayer(p), host: p.id === r.host })),
      score: r.score, startAt: r.startAt, endAt: r.endAt, serverNow: now(), results: r.results || null, win: WIN };
  }
  const listOut = () => [...rooms.values()].map(r => ({ id: r.id, name: r.name, map: r.map, status: r.status, n: humans(r).length, total: r.players.size, max: MAX }));
  const send = r => io.to(roomName(r.id)).emit('lg_room', roomOut(r));
  const sockets = new Map(); // userId -> Set(socket)

  function spawnAt(r, p) {
    const M = PREP[r.map], list = M.spawns[p.team];
    const [cx, cz] = list[Math.floor(Math.random() * list.length)];
    p.x = cx * C + C / 2 + (Math.random() - .5); p.z = cz * C + C / 2 + (Math.random() - .5);
    p.yaw = p.team === 'red' ? -Math.PI / 2 : Math.PI / 2; p.pitch = 0; // on regarde vers le camp d'en face
    p.alive = true; p.shieldUntil = now() + SHIELD_MS; p.path = null;
    for (const s of sockets.get(p.id) || []) s.emit('lg_spawn', { x: p.x, z: p.z, yaw: p.yaw });
  }
  function addBots(r) {
    for (const p of [...r.players.values()]) if (p.bot) r.players.delete(p.id);
    if (!r.bots) return;
    const n = Math.max(2, humans(r).length);
    let i = 0;
    for (const team of TEAMS) while (count(r, team) < Math.min(4, Math.max(n, 2)) && r.players.size < MAX) {
      const id = -(r.id * 100 + (++i));
      r.players.set(id, { id, name: BOT_NAMES[(i - 1) % BOT_NAMES.length], team, bot: true, gender: i % 3 ? 'h' : 'f', tags: 0, deaths: 0, skill: .55 + Math.random() * .3, lastShot: 0, think: 0 });
    }
  }
  function start(r) {
    addBots(r);
    r.status = 'countdown'; r.score = { red: 0, blue: 0 }; r.results = null;
    for (const p of r.players.values()) { p.tags = 0; p.deaths = 0; p.lastShot = 0; spawnAt(r, p); }
    r.startAt = now() + 4000; r.endAt = r.startAt + ROUND_MS; r.playedAt = now();
    send(r);
  }
  function finish(r) {
    if (r.status !== 'playing') return;
    r.status = 'ended';
    const win = r.score.red === r.score.blue ? null : r.score.red > r.score.blue ? 'red' : 'blue';
    const list = [...r.players.values()].sort((a, b) => b.tags - a.tags || a.deaths - b.deaths);
    const played = now() - r.startAt > 45000;
    const res = list.map(p => {
      let earned = 0;
      if (!p.bot && played && coins) earned = (p.team === win ? coins.earnCapped(p.id, 'lasergame_win', 20, '🔫 Victoire au Laser Game', 5) : coins.earnCapped(p.id, 'lasergame', 5, '🔫 Partie de Laser Game', 5)) ? (p.team === win ? 20 : 5) : 0;
      if (!p.bot) track(p.id, 'lasergame');
      return { id: p.id, name: p.name, team: p.team, bot: !!p.bot, tags: p.tags, deaths: p.deaths, earned };
    });
    r.results = { win, score: { ...r.score }, players: res, best: res[0]?.name || '' };
    send(r);
    // retour au salon d'attente : on peut relancer une partie
    setTimeout(() => { if (!rooms.has(r.id) || r.status !== 'ended') return; r.status = 'lobby'; for (const p of [...r.players.values()]) if (p.bot) r.players.delete(p.id); send(r); broadcastList(); }, 12000);
    broadcastList();
  }
  function leaveRoom(uid) {
    const id = where.get(uid); if (!id) return;
    where.delete(uid);
    const r = rooms.get(id); if (!r) return;
    r.players.delete(uid);
    for (const s of sockets.get(uid) || []) s.leave(roomName(id));
    if (!humans(r).length) { rooms.delete(id); broadcastList(); return; }
    if (r.host === uid) r.host = humans(r)[0].id;
    send(r); broadcastList();
  }
  const broadcastList = () => io.to('lg:lobby').emit('lg_list', listOut());

  // ---------- un tir ----------
  function shoot(r, p, yaw, pitch) {
    const t = now();
    if (r.status !== 'playing' || !p.alive || t - p.lastShot < FIRE_MS) return;
    p.lastShot = t;
    yaw = Number(yaw); pitch = Math.max(-1.2, Math.min(1.2, Number(pitch) || 0)); if (!Number.isFinite(yaw)) return;
    const M = PREP[r.map], h = Math.cos(pitch), d = { x: -Math.sin(yaw) * h, y: Math.sin(pitch), z: -Math.cos(yaw) * h };
    const o = { x: p.x, y: EYE, z: p.z };
    let end = Math.min(RANGE, wallDist(M, o.x, o.z, d.x, d.z, RANGE * h) / Math.max(h, 1e-3));
    if (o.y + d.y * end < 0) end = -o.y / d.y; // le rayon touche le sol
    if (o.y + d.y * end > 3) end = (3 - o.y) / d.y; // ou le plafond
    let victim = null;
    for (const e of r.players.values()) {
      if (e.team === p.team || !e.alive || e.shieldUntil > t) continue;
      const ex = e.x - o.x, ez = e.z - o.z, hh = d.x * d.x + d.z * d.z;
      const tt = (ex * d.x + ez * d.z) / Math.max(hh, 1e-6); if (tt <= 0 || tt > end) continue;
      const px = o.x + d.x * tt - e.x, pz = o.z + d.z * tt - e.z, py = o.y + d.y * tt;
      if (Math.hypot(px, pz) < .5 && py > 0 && py < 1.95) { end = tt; victim = e; }
    }
    io.to(roomName(r.id)).emit('lg_shot', { id: p.id, o: [o.x, o.y, o.z], e: [o.x + d.x * end, o.y + d.y * end, o.z + d.z * end], hit: victim ? victim.id : null });
    if (victim) {
      victim.alive = false; victim.deadUntil = t + DEAD_MS; victim.deaths++; p.tags++; r.score[p.team]++;
      io.to(roomName(r.id)).emit('lg_tag', { by: p.id, byName: p.name, victim: victim.id, victimName: victim.name, team: p.team, score: r.score });
      if (r.score[p.team] >= WIN) finish(r);
    }
  }

  // ---------- les robots ----------
  function botThink(r, b, dt, t) {
    const M = PREP[r.map];
    if (!b.alive) return;
    // l'ennemi le plus proche qu'il voit
    let target = null, best = 30;
    for (const e of r.players.values()) { if (e.team === b.team || !e.alive) continue; const d = Math.hypot(e.x - b.x, e.z - b.z); if (d < best && seeEach(M, b, e)) { best = d; target = e; } }
    if (target) {
      b.last = { x: target.x, z: target.z };
      const want = Math.atan2(-(target.x - b.x), -(target.z - b.z));
      let da = ((want - b.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      b.yaw += Math.max(-dt * 4, Math.min(dt * 4, da));
      b.pitch = Math.atan2(1.2 - EYE, best);
      if (Math.abs(da) < .15 && t - b.lastShot > FIRE_MS * (2.2 - b.skill) && t > r.startAt + 1500) { const err = (1 - b.skill) * .16; shoot(r, b, b.yaw + (Math.random() - .5) * err, b.pitch + (Math.random() - .5) * err * .5); }
      // il garde ses distances : il avance s'il est loin, se décale de côté s'il est près
      const side = Math.sin(t / 700 + b.id) > 0 ? 1 : -1, fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
      const mv = best > 10 ? [fx, fz] : [fz * side, -fx * side];
      step(M, b, mv[0] * SPEED * .7 * dt, mv[1] * SPEED * .7 * dt);
      b.path = null; return;
    }
    // sinon il part chercher : vers le dernier endroit où il a vu un ennemi, ou au hasard
    if (!b.path || !b.path.length || t > b.think) {
      const from = [Math.floor(b.x / C), Math.floor(b.z / C)];
      const goal = b.last ? [Math.floor(b.last.x / C), Math.floor(b.last.z / C)] : M.free[Math.floor(Math.random() * M.free.length)];
      b.last = null; b.path = path(M, from, goal); b.think = t + 6000;
    }
    const nx = b.path[0]; if (!nx) return;
    const tx = nx[0] * C + C / 2, tz = nx[1] * C + C / 2, dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
    if (d < .4) { b.path.shift(); return; }
    const want = Math.atan2(-dx, -dz); let da = ((want - b.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; b.yaw += Math.max(-dt * 5, Math.min(dt * 5, da)); b.pitch = 0;
    step(M, b, dx / d * SPEED * .85 * dt, dz / d * SPEED * .85 * dt);
  }
  const step = (M, p, dx, dz) => { if (fits(M, p.x + dx, p.z)) p.x += dx; if (fits(M, p.x, p.z + dz)) p.z += dz; };

  // ---------- 12 fois par seconde : robots, réapparitions, fin du temps, positions de tous ----------
  let last = now();
  setInterval(() => {
    const t = now(), dt = Math.min(.2, (t - last) / 1000); last = t;
    for (const r of rooms.values()) {
      if (r.status === 'countdown' && t >= r.startAt) { r.status = 'playing'; send(r); }
      if (r.status === 'playing') {
        for (const p of r.players.values()) {
          if (!p.alive && t >= p.deadUntil) spawnAt(r, p);
          if (p.bot) botThink(r, p, dt, t);
        }
        if (t >= r.endAt) finish(r);
      }
      if (r.status === 'countdown' || r.status === 'playing')
        io.to(roomName(r.id)).volatile.emit('lg_tick', { p: [...r.players.values()].map(p => [p.id, +p.x.toFixed(2), +p.z.toFixed(2), +(p.yaw || 0).toFixed(2), +(p.pitch || 0).toFixed(2), p.alive ? 1 : 0, p.shieldUntil > t ? 1 : 0]), s: r.score, end: r.endAt - t });
    }
  }, 83).unref?.();

  function onConnection(socket, uid, currentUser) {
    let set = sockets.get(uid); if (!set) sockets.set(uid, set = new Set()); set.add(socket);
    const ack = (cb, v) => typeof cb === 'function' && cb(v);
    const myRoom = () => rooms.get(where.get(uid));
    const mine = () => myRoom()?.players.get(uid);
    socket.on('lg_list', cb => { socket.join('lg:lobby'); ack(cb, { rooms: listOut(), maps: Object.fromEntries(Object.entries(MAPS).map(([k, m]) => [k, { name: m.name, icon: m.icon, desc: m.desc }])), current: where.get(uid) ? roomOut(myRoom()) : null }); });
    socket.on('lg_unlist', () => socket.leave('lg:lobby'));
    // les cartes (pour dessiner le décor en 3D)
    socket.on('lg_map', (key, cb) => { const m = MAPS[key]; if (m) ack(cb, { key, grid: m.grid, cell: C, name: m.name }); });
    socket.on('lg_create', (o, cb) => {
      const u = currentUser(); if (!u) return;
      leaveRoom(uid);
      const map = MAPS[o?.map] ? o.map : 'neon', id = nextId++;
      const r = { id, name: `Partie de ${u.username}`, map, host: uid, status: 'lobby', bots: o?.bots !== false, players: new Map(), score: { red: 0, blue: 0 } };
      rooms.set(id, r);
      join(r, u, TEAMS.includes(o?.team) ? o.team : 'red');
      ack(cb, { ok: true, room: roomOut(r) }); broadcastList();
    });
    function join(r, u, team) {
      where.set(uid, r.id);
      for (const s of sockets.get(uid) || []) s.join(roomName(r.id));
      r.players.set(uid, { id: uid, name: u.username, team, gender: u.gender, tags: 0, deaths: 0, lastShot: 0, x: 0, z: 0, yaw: 0, pitch: 0, alive: false });
      if (r.status !== 'lobby') { const p = r.players.get(uid); for (const b of [...r.players.values()]) if (b.bot && b.team === team && count(r, team) > count(r, team === 'red' ? 'blue' : 'red')) { r.players.delete(b.id); break; } spawnAt(r, p); }
      send(r);
    }
    socket.on('lg_join', (id, cb) => {
      const u = currentUser(), r = rooms.get(Number(id)); if (!u) return;
      if (!r) return ack(cb, { error: 'Cette partie n\'existe plus' });
      if (where.get(uid) === r.id) return ack(cb, { ok: true, room: roomOut(r) });
      if (humans(r).length >= MAX) return ack(cb, { error: 'La partie est pleine (10 joueurs)' });
      leaveRoom(uid);
      join(r, u, lessTeam(r));
      ack(cb, { ok: true, room: roomOut(r) }); broadcastList();
    });
    socket.on('lg_team', team => {
      const r = myRoom(), p = mine(); if (!r || !p || !TEAMS.includes(team) || p.team === team) return;
      const other = team === 'red' ? 'blue' : 'red';
      const hum = t => humans(r).filter(x => x.team === t).length;
      if (hum(team) >= hum(other) + 2) return socket.emit('lg_notice', '⚖️ Cette équipe a déjà trop de joueurs : les équipes doivent rester équilibrées');
      p.team = team; if (r.status !== 'lobby') { p.alive = false; p.deadUntil = now() + 1500; }
      send(r);
    });
    socket.on('lg_set', o => {
      const r = myRoom(); if (!r || r.host !== uid || r.status !== 'lobby' || !o) return;
      if (MAPS[o.map]) r.map = o.map;
      if (typeof o.bots === 'boolean') r.bots = o.bots;
      send(r); broadcastList();
    });
    socket.on('lg_start', () => { const r = myRoom(); if (r && r.host === uid && r.status === 'lobby') { start(r); broadcastList(); } });
    socket.on('lg_leave', () => leaveRoom(uid));
    socket.on('lg_move', m => {
      const r = myRoom(), p = mine(); if (!r || !p || !m || r.status === 'lobby' || r.status === 'ended') return;
      const t = now(); p.yaw = Number(m.yaw) || 0; p.pitch = Math.max(-1.2, Math.min(1.2, Number(m.pitch) || 0));
      if (!p.alive || t < r.startAt) return;
      const x = Number(m.x), z = Number(m.z); if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      const M = PREP[r.map], dt = Math.max(.05, (t - (p.movedAt || t)) / 1000); p.movedAt = t;
      // pas de téléportation ni de traversée de mur
      if (Math.hypot(x - p.x, z - p.z) > SPEED * dt * 1.6 + .6 || !fits(M, x, z)) { socket.emit('lg_fix', { x: p.x, z: p.z }); return; }
      p.x = x; p.z = z;
    });
    socket.on('lg_shoot', s => { const r = myRoom(), p = mine(); if (r && p && s) shoot(r, p, s.yaw, s.pitch); });
    socket.on('disconnect', () => {
      set.delete(socket); if (set.size) return;
      sockets.delete(uid);
      leaveRoom(uid);
    });
  }
  return { onConnection, MAPS, _test: { PREP, path, wallDist, fits } };
};
