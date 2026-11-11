// The Paradise — « L'Île du Paradise » : un monde en 2D où chaque membre est un petit personnage qui se promène.
// Sur l'île, chaque salon est un lieu. Il y a aussi des lieux virtuels où l'on entre vraiment :
//   🪩 le Paradise Club (boîte de nuit avec musique YouTube), 🎬 le Ciné Paradise (films YouTube),
//   🏠 les maisons des membres (chacun a la sienne, avec sa télé, et choisit qui peut entrer).
// Dans chaque lieu : bulles de discussion, gestes, actions (danser, boire un verre, s'asseoir…)
// et une jauge d'ambiance qui monte quand ça bouge : quand elle est pleine, c'est la fête !
// Le serveur garde la position de chacun et relaie tout (rien n'est enregistré, sauf les réglages des maisons).

// Taille et zone où l'on peut marcher pour chaque type de lieu (même formules côté navigateur)
const SCENES = {
  island: { W: 2400, H: 1600, walk: (x, y) => { const dx = (x - 1200) / 1080, dy = (y - 800) / 700; return dx * dx + dy * dy < 0.93; } },
  club: { W: 1200, H: 760, walk: (x, y) => x > 60 && x < 1140 && y > 290 && y < 720 },
  cinema: { W: 1200, H: 800, walk: (x, y) => x > 60 && x < 1140 && y > 575 && y < 770 },
  house: { W: 1100, H: 720, walk: (x, y) => x > 60 && x < 1040 && y > 250 && y < 680 },
  pool: { W: 1200, H: 760, walk: (x, y) => x > 60 && x < 1140 && y > 230 && y < 720 },
  cafe: { W: 1100, H: 720, walk: (x, y) => x > 60 && x < 1040 && y > 250 && y < 680 },
  arcade: { W: 1200, H: 760, walk: (x, y) => x > 60 && x < 1140 && y > 280 && y < 720 },
  campfire: { W: 1200, H: 760, walk: (x, y) => x > 60 && x < 1140 && y > 260 && y < 720 },
};
const PUBLIC = ['club', 'cinema', 'pool', 'cafe', 'arcade', 'campfire'];
const kindOf = scene => (scene.startsWith('house:') ? 'house' : scene);
// Où l'on arrive en entrant, et où l'on ressort sur l'île
const ENTRY = { club: [600, 690], cinema: [600, 740], house: [550, 650], pool: [600, 690], cafe: [550, 650], arcade: [600, 690], campfire: [600, 690] };
const DOORS = { club: [1000, 720], cinema: [1380, 1080], house: [760, 960], pool: [2000, 470], cafe: [1310, 640], arcade: [480, 1260], campfire: [1010, 300] };
// Actions possibles dans chaque lieu
const ACTIONS = {
  island: ['dance'],
  club: ['dance', 'drink', 'dj', 'sit'],
  cinema: ['sit', 'popcorn'],
  house: ['dj', 'sit', 'sleep', 'cook', 'dance', 'drink', 'read', 'work', 'watch', 'warm', 'bath', 'piano', 'play'],
  pool: ['swim', 'dive', 'tan', 'drink', 'dance', 'sit'],
  cafe: ['sit', 'eat', 'piano', 'cheers', 'dance'],
  arcade: ['play', 'slot', 'darts', 'claw', 'dance'],
  campfire: ['sit', 'marshmallow', 'guitar', 'wish', 'dance', 'warm'],
};
const MENU = ['☕', '🍵', '🥐', '🍰', '🍕', '🍔', '🍦', '🧋', '🍾', '🥗'];
const PRIZES = ['🧸', '🐶', '🦄', '🐱', '🐸', '🐼', '🐰', '🦊'];
const SLOT = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];
// Les meubles qu'on peut placer chez soi
const RARE = ['throne', 'jacuzzi', 'djbooth', 'statue', 'neonsign']; // meubles rares de la boutique 💰
const FURN = [...RARE, 'babyfoot', 'sofa', 'armchair', 'bed', 'table', 'kitchen', 'fridge', 'tv', 'rug', 'plant', 'lamp', 'shelf', 'piano', 'aquarium', 'fireplace', 'desk', 'bath', 'arcade', 'painting'];
// Ballon de plage (même calcul côté navigateur) : il roule, freine et rebondit sur les bords
const BALL_BOX = [80, 250, 1120, 705];
function ballAt(b, t) {
  let { x, y, vx, vy } = b;
  const steps = Math.min(600, Math.max(0, Math.floor((t - b.at) / 16.67)));
  for (let i = 0; i < steps; i++) {
    x += vx / 60; y += vy / 60; vx *= 0.985; vy *= 0.985;
    if (x < BALL_BOX[0]) { x = BALL_BOX[0]; vx = -vx; } if (x > BALL_BOX[2]) { x = BALL_BOX[2]; vx = -vx; }
    if (y < BALL_BOX[1]) { y = BALL_BOX[1]; vy = -vy; } if (y > BALL_BOX[3]) { y = BALL_BOX[3]; vy = -vy; }
    if (Math.abs(vx) + Math.abs(vy) < 4) { vx = 0; vy = 0; break; }
  }
  return { x, y, vx, vy };
}
const EMOTES = ['👋', '❤️', '😂', '🎉', '🔥', '😍'];
const THEMES = ['cosy', 'ocean', 'rose', 'nuit', 'jungle', 'or'];
const ACCESS = ['all', 'friends', 'bell', 'closed'];
const ytId = s => { const m = String(s || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/) || String(s || '').match(/^([\w-]{11})$/); return m ? m[1] : null; };

module.exports = function setupIsland({ io, db, modScan, isStaff, getUser, notify, throttled, areFriends, search, isEmbeddable, emitToUser, isOnline, coins = null }) {
  const now = () => Date.now();
  const players = new Map(); // userId -> { id, x, y, scene, action, username, color, avatar, gender, role, sockets:Set, said, saidAt }
  const out = p => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), action: p.action || '', item: p.itemAt > now() - 120000 ? p.item : '', prize: p.prize || '', username: p.username, color: p.color, avatar: p.avatar, gender: p.gender, role: p.role, said: p.saidAt > now() - 6000 ? p.said : '', saidAt: p.saidAt });
  const roomOf = scene => 'isl:' + scene;
  // ⚽ Le babyfoot : dans la salle d'arcade, et chez les membres qui en ont mis un dans leur maison
  const Babyfoot = require('./babyfoot')({
    reward: (id, key, n, why, max) => coins?.earnCapped(id, key, n, why, max),
    emitScene: (...a) => emitScene(...a), inScene: sc => inScene(sc), bump: (...a) => bump(...a),
    allowed: sc => {
      if (sc === 'arcade') return true;
      if (!sc.startsWith('house:')) return false;
      const c = bfCache.get(sc);
      if (c && now() - c.at < 5000) return c.ok;
      const ok = (houseInfo(Number(sc.slice(6)))?.furniture || []).some(f => f.t === 'babyfoot');
      bfCache.set(sc, { ok, at: now() }); return ok;
    },
  });
  const bfCache = new Map();
  const balls = new Map(); // scene -> ballon de la piscine
  const ballOf = scene => { let b = balls.get(scene); if (!b) { b = { x: 600, y: 650, vx: 0, vy: 0, at: now() }; balls.set(scene, b); } return b; };
  const boards = new Map(); // scene -> meilleurs scores de la salle d'arcade (jusqu'au redémarrage)
  const boardOf = scene => { let b = boards.get(scene); if (!b) { b = { darts: [], jackpots: 0, prizes: 0 }; boards.set(scene, b); } return b; };
  const inScene = scene => [...players.values()].filter(p => p.scene === scene);
  const spawn = () => { for (let i = 0; i < 40; i++) { const x = 1130 + Math.random() * 140, y = 880 + Math.random() * 70; if (SCENES.island.walk(x, y)) return [x, y]; } return [1200, 950]; };
  const sockOf = p => [...p.sockets].map(sid => io.sockets.sockets.get(sid)).filter(Boolean);
  const emitScene = (scene, ev, data) => io.to(roomOf(scene)).emit(ev, data);

  // ---------- Les maisons ----------
  const houseRow = uid => db.prepare('SELECT * FROM houses WHERE user_id=?').get(uid);
  function houseInfo(uid) {
    const u = getUser(uid);
    if (!u) return null;
    const h = houseRow(uid) || { name: '', theme: 'cosy', access: 'friends', furniture: '' };
    let furniture = null; try { furniture = h.furniture ? JSON.parse(h.furniture) : null; } catch (e) {}
    return { ownerId: uid, owner: u.username, ownerGender: u.gender, ownerColor: u.color, ownerAvatar: u.avatar || '', name: h.name || `La maison de ${u.username}`, theme: THEMES.includes(h.theme) ? h.theme : 'cosy', access: ACCESS.includes(h.access) ? h.access : 'friends', visitors: inScene('house:' + uid).length, furniture };
  }
  // Ceux à qui le propriétaire a ouvert la porte (valable 3 heures)
  const passes = new Map(); // ownerId -> Map(visitorId -> expiration)
  const rings = new Map(); // ownerId -> Map(visitorId -> heure)
  const hasPass = (ownerId, uid) => (passes.get(ownerId)?.get(uid) || 0) > now();
  function canEnterHouse(user, ownerId) {
    if (user.id === ownerId || isStaff(user)) return true;
    const h = houseInfo(ownerId);
    if (!h) return false;
    if (hasPass(ownerId, user.id)) return true;
    if (h.access === 'all') return true;
    if (h.access === 'friends') return areFriends(user.id, ownerId);
    return false;
  }

  // ---------- Écran partagé (musique du club, film du ciné, télé des maisons) ----------
  const media = new Map(); // scene -> { current, queue, votes:Set, timer }
  const mediaOf = scene => { let m = media.get(scene); if (!m) { m = { current: null, queue: [], votes: new Set(), timer: null }; media.set(scene, m); } return m; };
  const mediaOut = scene => { const m = media.get(scene); return m ? { current: m.current, queue: m.queue.slice(0, 20), votes: m.votes.size, votesNeeded: votesNeeded(scene), serverNow: now() } : { current: null, queue: [], votes: 0, votesNeeded: 1, serverNow: now() }; };
  const votesNeeded = scene => Math.max(1, Math.ceil(inScene(scene).length / 2));
  const sendMedia = scene => emitScene(scene, 'inst_media', { scene, ...mediaOut(scene) });
  function nextMedia(scene) {
    const m = mediaOf(scene);
    clearTimeout(m.timer); m.timer = null; m.votes.clear();
    const item = m.queue.shift();
    m.current = item ? { ...item, startedAt: now() } : null;
    // On passe tout seul à la suite à la fin (durée connue), sinon au bout de 3 h au maximum
    if (m.current) m.timer = setTimeout(() => nextMedia(scene), ((m.current.duration || 3 * 3600) + 4) * 1000);
    sendMedia(scene);
  }
  function canControl(user, scene) {
    if (isStaff(user)) return true;
    if (kindOf(scene) === 'house') return Number(scene.slice(6)) === user.id;
    return false;
  }

  // ---------- Jauge d'ambiance ----------
  const amb = new Map(); // scene -> { v, party, last }
  const bump = (scene, n) => {
    if (scene === 'island') return;
    const a = amb.get(scene) || { v: 10, party: 0, sent: -1 };
    if (a.party > now()) return amb.set(scene, a);
    a.v = Math.min(100, a.v + n);
    if (a.v >= 100) {
      a.v = 35; a.party = now() + 15000;
      emitScene(scene, 'inst_party', { scene, until: a.party });
    }
    amb.set(scene, a);
  };
  setInterval(() => {
    for (const [scene, a] of amb) {
      const here = inScene(scene);
      if (!here.length) { amb.delete(scene); continue; }
      const dancers = here.filter(p => p.action === 'dance' || p.action === 'dj').length;
      if (a.party < now()) a.v = Math.max(0, Math.min(100, a.v - 1.2 + dancers * 0.8 + (mediaOf(scene).current ? 0.3 : 0)));
      if (a.v >= 100) bump(scene, 0);
      const v = Math.round(a.v);
      if (v !== a.sent) { a.sent = v; emitScene(scene, 'inst_amb', { scene, v, party: a.party > now() }); }
    }
  }, 2000).unref?.();

  // ---------- Changer de lieu ----------
  function sceneState(scene, uid) {
    return {
      me: uid, scene, kind: kindOf(scene), players: inScene(scene).map(out),
      media: scene === 'island' ? null : { scene, ...mediaOut(scene) },
      amb: scene === 'island' ? null : Math.round((amb.get(scene) || { v: 10 }).v),
      house: kindOf(scene) === 'house' ? houseInfo(Number(scene.slice(6))) : null,
      ball: scene === 'pool' ? { ...ballOf(scene), serverNow: now() } : null,
      board: scene === 'arcade' ? boardOf(scene) : null,
    };
  }
  function move(p, scene, pos) {
    const old = p.scene;
    if (old && old !== scene) {
      Babyfoot.leaveScene(p.id, old);
      for (const s of sockOf(p)) s.leave(roomOf(old));
      emitScene(old, 'island_left', { id: p.id });
      afterLeave(old);
    }
    p.scene = scene; p.action = '';
    [p.x, p.y] = pos;
    for (const s of sockOf(p)) s.join(roomOf(scene));
    if (old !== scene) {
      io.to(roomOf(scene)).except(p.sockets.size ? [...p.sockets] : []).emit('island_joined', out(p));
      if (scene !== 'island') { const a = amb.get(scene) || { v: 10, party: 0, sent: -1 }; amb.set(scene, a); bump(scene, 4); }
    }
    for (const s of sockOf(p)) s.emit('island_scene', sceneState(scene, p.id));
  }
  // Une maison vide : on arrête sa télé
  function afterLeave(scene) {
    if (kindOf(scene) === 'house' && !inScene(scene).length) { const m = media.get(scene); if (m) { clearTimeout(m.timer); media.delete(scene); } }
    if (media.has(scene)) sendMedia(scene); // le nombre de votes nécessaires change
  }
  function leave(uid, sid) {
    const p = players.get(uid);
    if (!p) return;
    p.sockets.delete(sid);
    if (p.sockets.size) return;
    players.delete(uid);
    Babyfoot.leaveScene(uid, p.scene);
    emitScene(p.scene, 'island_left', { id: uid });
    afterLeave(p.scene);
  }
  // Renvoyer quelqu'un sur l'île (maison fermée, expulsé…)
  function sendHome(p, msg) {
    const kind = kindOf(p.scene);
    move(p, 'island', DOORS[kind] || spawn());
    for (const s of sockOf(p)) s.emit('island_notice', msg);
  }

  function onConnection(socket, uid, currentUser) {
    let lastMove = 0, lastSay = 0, lastSearch = 0, lastAct = 0;
    Babyfoot.onConnection(socket, uid, currentUser, () => players.get(uid)?.scene);
    const ack = (cb, v) => typeof cb === 'function' && cb(v);
    const me = () => players.get(uid);
    socket.on('island_join', cb => {
      const u = currentUser();
      if (!u) return;
      let p = players.get(uid);
      if (!p) {
        const [x, y] = spawn();
        p = { id: uid, x, y, scene: null, action: '', username: u.username, color: u.color, avatar: u.avatar || '', gender: u.gender, role: u.role, sockets: new Set([socket.id]), said: '', saidAt: 0 };
        players.set(uid, p);
        move(p, 'island', [x, y]);
      } else {
        p.sockets.add(socket.id); socket.join(roomOf(p.scene));
        socket.emit('island_scene', sceneState(p.scene, uid));
      }
      ack(cb, { ok: true });
    });
    socket.on('island_move', pos => {
      const p = me();
      if (!p || !pos) return;
      const t = now();
      if (t - lastMove < 60) return; // 16 mises à jour par seconde au maximum
      lastMove = t;
      const S = SCENES[kindOf(p.scene)];
      let x = Number(pos.x), y = Number(pos.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      x = Math.max(0, Math.min(S.W, x)); y = Math.max(0, Math.min(S.H, y));
      // pas de téléportation : 60 px au maximum entre deux mises à jour
      const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
      if (d > 60) { x = p.x + dx / d * 60; y = p.y + dy / d * 60; }
      if (!S.walk(x, y)) return;
      p.x = x; p.y = y;
      if (p.action && d > 4) { p.action = ''; emitScene(p.scene, 'island_action', { id: uid, action: '' }); }
      socket.to(roomOf(p.scene)).emit('island_move', { id: uid, x: Math.round(x), y: Math.round(y) });
    });
    // Bulle de chat au-dessus du personnage (filtrée par le ModoBot, rien n'est gardé)
    socket.on('island_say', (text, cb) => {
      const p = me(), u = currentUser();
      if (!p || !u) return;
      if (u.muted_until && u.muted_until > now()) return ack(cb, { error: 'Tu es rendu muet pour le moment' });
      const t = now();
      if (t - lastSay < 1200) return ack(cb, { error: 'Doucement !' });
      lastSay = t;
      const raw = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      if (!raw) return;
      const clean = modScan ? modScan(raw).text : raw;
      p.said = clean; p.saidAt = t;
      emitScene(p.scene, 'island_say', { id: uid, text: clean, at: t });
      bump(p.scene, 3);
      ack(cb, { ok: true });
    });
    socket.on('island_emote', e => {
      const p = me();
      if (!p || !EMOTES.includes(e)) return;
      emitScene(p.scene, 'island_emote', { id: uid, e });
      bump(p.scene, 4);
    });
    // Actions : danser, boire un verre, s'asseoir, dormir, cuisiner, mixer…
    socket.on('island_action', (action, pos, extra) => {
      const p = me();
      if (!p) return;
      const t = now();
      if (t - lastAct < 400) return;
      lastAct = t;
      const a = ACTIONS[kindOf(p.scene)].includes(action) ? action : '';
      // l'action se fait là où l'on se trouve (on peut s'être placé juste avant)
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) && Math.hypot(pos.x - p.x, pos.y - p.y) < 90) { p.x = pos.x; p.y = pos.y; }
      p.action = a;
      if (a === 'eat') { if (!MENU.includes(extra)) return; p.item = extra; p.itemAt = t; }
      emitScene(p.scene, 'island_action', { id: uid, action: a, x: Math.round(p.x), y: Math.round(p.y), item: a === 'eat' ? extra : undefined });
      if (a) bump(p.scene, a === 'dance' || a === 'dj' ? 6 : 3);
    });
    socket.on('island_leave', () => { const p = me(); if (p) socket.leave(roomOf(p.scene)); leave(uid, socket.id); });
    socket.on('disconnect', () => leave(uid, socket.id));

    // ---------- Entrer et sortir des lieux ----------
    socket.on('inst_enter', (scene, cb) => {
      const p = me();
      if (!p || !PUBLIC.includes(scene)) return ack(cb, { error: 'Lieu inconnu' });
      move(p, scene, ENTRY[scene].map(v => v + (Math.random() * 80 - 40)));
      ack(cb, { ok: true });
    });
    socket.on('inst_exit', cb => {
      const p = me();
      if (!p || p.scene === 'island') return ack(cb, { ok: true });
      move(p, 'island', DOORS[kindOf(p.scene)].map(v => v + (Math.random() * 40 - 20)));
      ack(cb, { ok: true });
    });
    socket.on('house_enter', (ownerId, cb) => {
      const p = me(), u = currentUser();
      ownerId = Number(ownerId) || uid;
      if (!p || !u) return ack(cb, { error: 'Ouvre d\'abord l\'île' });
      const h = houseInfo(ownerId);
      if (!h) return ack(cb, { error: 'Cette maison n\'existe pas' });
      if (!canEnterHouse(u, ownerId)) return ack(cb, h.access === 'closed' ? { error: `🔕 ${h.owner} ne veut pas être dérangé` } : { ring: true, owner: h.owner, ownerId });
      if (ownerId !== uid && inScene('house:' + ownerId).length >= 25) return ack(cb, { error: 'La maison est pleine (25 personnes)' });
      move(p, 'house:' + ownerId, ENTRY.house.map(v => v + (Math.random() * 80 - 40)));
      if (ownerId !== uid && notify && !throttled(`house:${ownerId}:${uid}`, 10 * 60 * 1000))
        notify(ownerId, { type: 'house_visit', icon: '🏠', title: `${u.username} est ${u.gender === 'f' ? 'entrée' : 'entré'} dans ta maison`, text: 'Viens lui dire bonjour sur l\'Île du Paradise 🏝️', data: { ownerId, userId: uid } });
      ack(cb, { ok: true });
    });
    // La liste des maisons : la mienne, celles de mes amis, et celles où il y a du monde
    socket.on('house_list', cb => {
      const u = currentUser();
      if (!u) return;
      const ids = new Set();
      const fr = db.prepare("SELECT CASE WHEN from_id=? THEN to_id ELSE from_id END AS id FROM friends WHERE (from_id=? OR to_id=?) AND status='accepted'").all(uid, uid, uid).map(r => r.id);
      fr.forEach(id => ids.add(id));
      for (const p of players.values()) if (p.scene.startsWith('house:')) ids.add(Number(p.scene.slice(6)));
      for (const r of db.prepare("SELECT user_id FROM houses WHERE access='all' ORDER BY updated_at DESC LIMIT 30").all()) ids.add(r.user_id);
      ids.delete(uid);
      const list = [...ids].map(id => houseInfo(id)).filter(Boolean).map(h => ({ ...h, friend: fr.includes(h.ownerId), canEnter: canEnterHouse(u, h.ownerId) }))
        .sort((a, b) => b.visitors - a.visitors || b.friend - a.friend).slice(0, 40);
      ack(cb, { mine: houseInfo(uid), list });
    });
    socket.on('house_settings', (s, cb) => {
      const u = currentUser();
      if (!u || !s) return;
      const h = houseInfo(uid);
      const name = s.name != null ? (modScan ? modScan(String(s.name).replace(/\s+/g, ' ').trim().slice(0, 40)).text : String(s.name).slice(0, 40)) : h.name;
      const theme = THEMES.includes(s.theme) ? s.theme : h.theme, access = ACCESS.includes(s.access) ? s.access : h.access;
      db.prepare('INSERT INTO houses (user_id,name,theme,access,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name, theme=excluded.theme, access=excluded.access, updated_at=excluded.updated_at').run(uid, name, theme, access, now());
      if (access === 'closed') passes.delete(uid);
      const scene = 'house:' + uid, info = houseInfo(uid);
      emitScene(scene, 'house_info', info);
      // Ceux qui n'ont plus le droit d'être là repartent sur l'île
      for (const p of inScene(scene)) { const v = getUser(p.id); if (v && !canEnterHouse(v, uid)) sendHome(p, `🔒 ${u.username} a fermé sa maison`); }
      ack(cb, { ok: true, house: info });
    });
    // 🔔 La sonnette : on sonne, le propriétaire ouvre (ou pas)
    socket.on('house_ring', (ownerId, cb) => {
      const u = currentUser();
      ownerId = Number(ownerId);
      const h = u && houseInfo(ownerId);
      if (!h || ownerId === uid) return ack(cb, { error: 'Impossible de sonner ici' });
      if (h.access === 'closed') return ack(cb, { error: `🔕 ${h.owner} ne veut pas être dérangé` });
      if (canEnterHouse(u, ownerId)) return ack(cb, { open: true });
      if (throttled(`ring:${ownerId}:${uid}`, 20000)) return ack(cb, { error: 'Tu as déjà sonné, attends un peu 🔔' });
      let r = rings.get(ownerId); if (!r) { r = new Map(); rings.set(ownerId, r); }
      r.set(uid, now());
      const here = isOnline(ownerId);
      if (here) emitToUser(ownerId, 'house_ring', { visitorId: uid, username: u.username, avatar: u.avatar || '', color: u.color, gender: u.gender });
      notify(ownerId, { type: 'house_ring', icon: '🔔', title: `${u.username} a sonné à ta porte`, text: here ? 'Ouvre-lui depuis la fenêtre qui s\'est affichée' : 'Tu n\'étais pas là… passe lui dire bonjour !', data: { ownerId, userId: uid } });
      ack(cb, { ok: true, online: here, owner: h.owner, ownerGender: h.ownerGender });
    });
    socket.on('house_answer', (visitorId, yes, cb) => {
      const u = currentUser();
      visitorId = Number(visitorId);
      const r = rings.get(uid);
      if (!u || !r?.has(visitorId)) return ack(cb, { error: 'Plus personne ne sonne' });
      r.delete(visitorId);
      if (!yes) { emitToUser(visitorId, 'island_notice', `🚪 ${u.username} ne peut pas t'ouvrir pour le moment`); return ack(cb, { ok: true }); }
      let ps = passes.get(uid); if (!ps) { ps = new Map(); passes.set(uid, ps); }
      ps.set(visitorId, now() + 3 * 3600 * 1000);
      const v = players.get(visitorId);
      if (v) move(v, 'house:' + uid, ENTRY.house.map(n => n + (Math.random() * 60 - 30)));
      emitToUser(visitorId, 'house_opened', { ownerId: uid, owner: u.username, inside: !!v });
      if (!v) notify(visitorId, { type: 'house_open', icon: '🚪', title: `${u.username} t'a ouvert sa porte`, text: 'Touche ici pour entrer chez ' + (u.gender === 'f' ? 'elle' : 'lui') + ' 🏠', data: { ownerId: uid } });
      ack(cb, { ok: true });
    });
    // 🛋️ Placer ses meubles où l'on veut
    socket.on('house_furniture', (list, cb) => {
      if (!Array.isArray(list) || list.length > 40) return ack(cb, { error: '40 meubles au maximum' });
      const clean = [];
      for (const f of list) {
        if (!f || !FURN.includes(f.t)) continue;
        if (RARE.includes(f.t) && !coins?.owns(uid, 'furn_' + f.t)) continue; // il faut l'avoir acheté
        const x = Math.round(Number(f.x)), y = Math.round(Number(f.y));
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (f.t === 'tv' && clean.some(c => c.t === 'tv')) continue; // une seule télé
        clean.push({ t: f.t, x: Math.max(0, Math.min(1100, x)), y: Math.max(0, Math.min(720, y)), f: f.f ? 1 : 0 });
      }
      houseInfo(uid);
      db.prepare("INSERT INTO houses (user_id,furniture,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET furniture=excluded.furniture, updated_at=excluded.updated_at").run(uid, JSON.stringify(clean), now());
      bfCache.delete('house:' + uid);
      emitScene('house:' + uid, 'house_info', houseInfo(uid));
      ack(cb, { ok: true });
    });
    socket.on('house_kick', (targetId, cb) => {
      const p = players.get(Number(targetId)), u = currentUser();
      if (!p || !u || p.scene !== 'house:' + uid || p.id === uid) return ack(cb, { error: 'Cette personne n\'est pas chez toi' });
      passes.get(uid)?.delete(p.id);
      sendHome(p, `🚪 ${u.username} t'a demandé de sortir de sa maison`);
      ack(cb, { ok: true });
    });

    // ---------- Les mini-jeux de la salle d'arcade ----------
    let lastGame = 0, lastKick = 0, notes = 0, notesAt = 0;
    socket.on('inst_game', g => {
      const p = me(), u = currentUser();
      if (!p || !u || p.scene !== 'arcade') return;
      const t = now();
      if (t - lastGame < 1800) return;
      lastGame = t;
      const b = boardOf(p.scene);
      let res;
      if (g === 'slot') {
        const jackpot = Math.random() < 0.06, pair = !jackpot && Math.random() < 0.3;
        const a = SLOT[Math.floor(Math.random() * SLOT.length)];
        let r = jackpot ? [a, a, a] : pair ? [a, a, SLOT[(SLOT.indexOf(a) + 1 + Math.floor(Math.random() * 5)) % 6]] : [0, 1, 2].map(() => SLOT[Math.floor(Math.random() * 6)]);
        if (!jackpot && r[0] === r[1] && r[1] === r[2]) r[2] = SLOT[(SLOT.indexOf(r[2]) + 1) % 6];
        if (pair) r = r.sort(() => Math.random() - .5);
        const win = jackpot ? 'jackpot' : new Set(r).size < 3 ? 'pair' : '';
        if (jackpot) b.jackpots++;
        // 💰 On mise 5 pièces si on en a : jackpot = 50 pièces, une paire = 3 pièces
        const bet = !!coins && coins.balance(uid) >= 5 && coins.spend(uid, 5, '🎰 Mise à la machine à sous');
        const gain = bet ? (jackpot ? 50 : win === 'pair' ? 3 : 0) : 0;
        if (gain) coins.earn(uid, gain, jackpot ? '🎰 JACKPOT à la machine à sous !' : '🎰 Une paire à la machine à sous', { boost: false });
        res = { g, r, win, bet, gain };
        bump(p.scene, jackpot ? 40 : 3);
      } else if (g === 'darts') {
        const k = Math.random();
        const score = k < .06 ? 50 : k < .12 ? 0 : Math.max(1, Math.round(Math.random() * 20)) * (k < .3 ? 3 : k < .45 ? 2 : 1);
        if (score === 50) coins?.earnCapped(uid, 'darts', 10, '🎯 En plein dans le mille !', 5);
        res = { g, score, ax: Math.random() * 2 - 1, ay: Math.random() * 2 - 1, bull: score === 50 };
        const best = b.darts.find(d => d.id === uid);
        if (!best) b.darts.push({ id: uid, username: u.username, score }); else if (score > best.score) best.score = score;
        b.darts.sort((x, y) => y.score - x.score); b.darts.length = Math.min(b.darts.length, 5);
        bump(p.scene, score >= 50 ? 12 : 3);
      } else if (g === 'claw') {
        const win = Math.random() < 0.28;
        res = { g, win, prize: win ? PRIZES[Math.floor(Math.random() * PRIZES.length)] : '' };
        if (win) { p.prize = res.prize; b.prizes++; coins?.earnCapped(uid, 'claw', 8, `${res.prize} Peluche gagnée à la pince`, 5); }
        bump(p.scene, win ? 10 : 2);
      } else return;
      p.action = g;
      emitScene(p.scene, 'inst_game', { id: uid, ...res, board: b });
    });
    // ---------- Le ballon de la piscine ----------
    socket.on('inst_kick', () => {
      const p = me();
      if (!p || p.scene !== 'pool') return;
      const t = now();
      if (t - lastKick < 300) return;
      const cur = ballAt(ballOf(p.scene), t);
      const dx = cur.x - p.x, dy = cur.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (d > 85) return;
      lastKick = t;
      const b = { x: cur.x, y: cur.y, vx: dx / d * 560, vy: dy / d * 560, at: t };
      balls.set(p.scene, b);
      emitScene(p.scene, 'inst_ball', { ...b, by: uid, serverNow: t });
      bump(p.scene, 3);
    });
    // ---------- Piano et guitare : tout le monde entend ----------
    socket.on('inst_note', n => {
      const p = me();
      if (!p || !['cafe', 'campfire'].includes(kindOf(p.scene)) && kindOf(p.scene) !== 'house') return;
      const t = now();
      if (t - notesAt > 1000) { notesAt = t; notes = 0; }
      if (++notes > 14) return;
      const ins = kindOf(p.scene) === 'campfire' ? 'guitar' : 'piano';
      const v = Math.floor(Number(n));
      if (!(v >= 0 && v < 25)) return;
      socket.to(roomOf(p.scene)).emit('inst_note', { id: uid, ins, n: v });
      if (notes === 1) bump(p.scene, 1);
    });

    // ---------- L'écran : chercher, mettre une vidéo, passer à la suite ----------
    socket.on('inst_search', async (q, cb) => {
      const p = me();
      if (!p || p.scene === 'island' || typeof cb !== 'function') return;
      const t = now();
      if (t - lastSearch < 1500) return cb({ error: 'Doucement !' });
      lastSearch = t;
      q = String(q || '').trim().slice(0, 100);
      if (!q) return cb({ results: [] });
      const film = p.scene === 'cinema';
      try { cb({ results: (await search(film && !/film|movie|court|dessin|animé/i.test(q) ? q + ' film complet' : q, film ? 4 * 3600 : 20 * 60)).slice(0, 10) }); }
      catch (e) { cb({ error: 'La recherche YouTube ne répond pas, réessaie (ou colle un lien YouTube)' }); }
    });
    socket.on('inst_play', async (item, cb) => {
      const p = me(), u = currentUser();
      if (!p || !u || p.scene === 'island' || !item) return ack(cb, { error: 'Entre d\'abord dans un lieu' });
      const scene = p.scene, kind = kindOf(scene);
      if (kind === 'house' && !canControl(u, scene)) return ack(cb, { error: 'Seul le propriétaire choisit ce qui passe à la télé' });
      const videoId = ytId(item.videoId || item.url);
      if (!videoId) return ack(cb, { error: 'Lien YouTube invalide' });
      if (isEmbeddable && !(await isEmbeddable(videoId))) return ack(cb, { error: '⚠️ Cette vidéo ne peut pas être lue sur un autre site (son propriétaire l\'interdit)' });
      const m = mediaOf(scene);
      const mine = m.queue.filter(x => x.userId === uid).length;
      const max = kind === 'cinema' ? 1 : 3;
      if (!canControl(u, scene) && mine >= max) return ack(cb, { error: `${max} demande${max > 1 ? 's' : ''} maximum dans la file` });
      if (m.queue.length >= 30) return ack(cb, { error: 'La file est pleine, attends un peu' });
      const title = (modScan ? modScan(String(item.title || 'Vidéo YouTube').slice(0, 120)).text : String(item.title || '').slice(0, 120)) || 'Vidéo YouTube';
      const duration = Math.max(0, Math.min(5 * 3600, Number(item.duration) || 0));
      m.queue.push({ id: now() + '' + uid, videoId, title, length: String(item.length || '').slice(0, 10), duration, userId: uid, username: u.username });
      if (!m.current) nextMedia(scene); else sendMedia(scene);
      bump(scene, 5);
      ack(cb, { ok: true, now: m.current?.videoId === videoId });
    });
    socket.on('inst_skip', cb => {
      const p = me(), u = currentUser();
      if (!p || !u) return;
      const m = media.get(p.scene);
      if (!m?.current) return ack(cb, { error: 'Rien ne passe en ce moment' });
      if (m.current.userId === uid || canControl(u, p.scene)) { nextMedia(p.scene); return ack(cb, { ok: true }); }
      if (kindOf(p.scene) === 'house') return ack(cb, { error: 'Seul le propriétaire peut changer' });
      m.votes.add(uid);
      if (m.votes.size >= votesNeeded(p.scene)) nextMedia(p.scene); else sendMedia(p.scene);
      ack(cb, { ok: true });
    });
    // Le lecteur a signalé la fin de la vidéo (utile pour les liens collés dont on ne connaît pas la durée)
    socket.on('inst_ended', videoId => {
      const p = me();
      const m = p && media.get(p.scene);
      if (m?.current && m.current.videoId === videoId && now() - m.current.startedAt > 15000) nextMedia(p.scene);
    });
    socket.on('inst_error', videoId => {
      const p = me();
      const m = p && media.get(p.scene);
      if (m?.current && m.current.videoId === videoId && now() - m.current.startedAt < 60000) nextMedia(p.scene);
    });
    socket.on('inst_unqueue', (id, cb) => {
      const p = me(), u = currentUser();
      const m = p && media.get(p.scene);
      const i = m ? m.queue.findIndex(x => x.id === id) : -1;
      if (i < 0) return ack(cb, { error: 'Introuvable' });
      if (m.queue[i].userId !== uid && !canControl(u, p.scene)) return ack(cb, { error: 'Tu ne peux retirer que tes demandes' });
      m.queue.splice(i, 1); sendMedia(p.scene); ack(cb, { ok: true });
    });
  }
  // Pour les soirées : le DJ du club met de la musique quand personne n'en a mis
  const mediaEmpty = scene => { const m = media.get(scene); return inScene(scene).length > 0 && (!m || (!m.current && !m.queue.length)); };
  function playAuto(scene, v) {
    if (!mediaEmpty(scene) || !/^[\w-]{11}$/.test(v.videoId || '')) return;
    mediaOf(scene).queue.push({ id: now() + 'dj', videoId: v.videoId, title: String(v.title || 'Musique').slice(0, 120), length: v.length || '', duration: v.duration || 0, userId: 0, username: v.username || '🎧 DJ Paradise' });
    nextMedia(scene);
  }
  return { onConnection, count: () => players.size, where: uid => players.get(uid)?.scene || null, mediaEmpty, playAuto };
};
