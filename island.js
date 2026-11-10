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
};
const kindOf = scene => (scene.startsWith('house:') ? 'house' : scene);
// Où l'on arrive en entrant, et où l'on ressort sur l'île
const ENTRY = { club: [600, 690], cinema: [600, 740], house: [550, 650] };
const DOORS = { club: [1000, 720], cinema: [1380, 1080], house: [760, 900] };
// Actions possibles dans chaque lieu
const ACTIONS = {
  island: ['dance'],
  club: ['dance', 'drink', 'dj', 'sit'],
  cinema: ['sit', 'popcorn'],
  house: ['sit', 'sleep', 'cook', 'dance', 'drink'],
};
const EMOTES = ['👋', '❤️', '😂', '🎉', '🔥', '😍'];
const THEMES = ['cosy', 'ocean', 'rose', 'nuit', 'jungle', 'or'];
const ACCESS = ['all', 'friends', 'closed'];
const ytId = s => { const m = String(s || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/) || String(s || '').match(/^([\w-]{11})$/); return m ? m[1] : null; };

module.exports = function setupIsland({ io, db, modScan, isStaff, getUser, notify, throttled, areFriends, search, isEmbeddable }) {
  const now = () => Date.now();
  const players = new Map(); // userId -> { id, x, y, scene, action, username, color, avatar, gender, role, sockets:Set, said, saidAt }
  const out = p => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), action: p.action || '', username: p.username, color: p.color, avatar: p.avatar, gender: p.gender, role: p.role, said: p.saidAt > now() - 6000 ? p.said : '', saidAt: p.saidAt });
  const roomOf = scene => 'isl:' + scene;
  const inScene = scene => [...players.values()].filter(p => p.scene === scene);
  const spawn = () => { for (let i = 0; i < 40; i++) { const x = 1130 + Math.random() * 140, y = 880 + Math.random() * 70; if (SCENES.island.walk(x, y)) return [x, y]; } return [1200, 950]; };
  const sockOf = p => [...p.sockets].map(sid => io.sockets.sockets.get(sid)).filter(Boolean);
  const emitScene = (scene, ev, data) => io.to(roomOf(scene)).emit(ev, data);

  // ---------- Les maisons ----------
  const houseRow = uid => db.prepare('SELECT * FROM houses WHERE user_id=?').get(uid);
  function houseInfo(uid) {
    const u = getUser(uid);
    if (!u) return null;
    const h = houseRow(uid) || { name: '', theme: 'cosy', access: 'friends' };
    return { ownerId: uid, owner: u.username, ownerColor: u.color, ownerAvatar: u.avatar || '', name: h.name || `La maison de ${u.username}`, theme: THEMES.includes(h.theme) ? h.theme : 'cosy', access: ACCESS.includes(h.access) ? h.access : 'friends', visitors: inScene('house:' + uid).length };
  }
  function canEnterHouse(user, ownerId) {
    if (user.id === ownerId || isStaff(user)) return true;
    const h = houseInfo(ownerId);
    if (!h) return false;
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
    };
  }
  function move(p, scene, pos) {
    const old = p.scene;
    if (old && old !== scene) {
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
    socket.on('island_action', (action, pos) => {
      const p = me();
      if (!p) return;
      const t = now();
      if (t - lastAct < 400) return;
      lastAct = t;
      const a = ACTIONS[kindOf(p.scene)].includes(action) ? action : '';
      // l'action se fait là où l'on se trouve (on peut s'être placé juste avant)
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) && Math.hypot(pos.x - p.x, pos.y - p.y) < 90) { p.x = pos.x; p.y = pos.y; }
      p.action = a;
      emitScene(p.scene, 'island_action', { id: uid, action: a, x: Math.round(p.x), y: Math.round(p.y) });
      if (a) bump(p.scene, a === 'dance' || a === 'dj' ? 6 : 3);
    });
    socket.on('island_leave', () => { const p = me(); if (p) socket.leave(roomOf(p.scene)); leave(uid, socket.id); });
    socket.on('disconnect', () => leave(uid, socket.id));

    // ---------- Entrer et sortir des lieux ----------
    socket.on('inst_enter', (scene, cb) => {
      const p = me();
      if (!p || !['club', 'cinema'].includes(scene)) return ack(cb, { error: 'Lieu inconnu' });
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
      if (!canEnterHouse(u, ownerId)) return ack(cb, { error: h.access === 'closed' ? `🔒 ${h.owner} a fermé sa maison` : `🔒 Seuls les amis de ${h.owner} peuvent entrer` });
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
      const scene = 'house:' + uid, info = houseInfo(uid);
      emitScene(scene, 'house_info', info);
      // Ceux qui n'ont plus le droit d'être là repartent sur l'île
      for (const p of inScene(scene)) { const v = getUser(p.id); if (v && !canEnterHouse(v, uid)) sendHome(p, `🔒 ${u.username} a fermé sa maison`); }
      ack(cb, { ok: true, house: info });
    });
    socket.on('house_kick', (targetId, cb) => {
      const p = players.get(Number(targetId)), u = currentUser();
      if (!p || !u || p.scene !== 'house:' + uid || p.id === uid) return ack(cb, { error: 'Cette personne n\'est pas chez toi' });
      sendHome(p, `🚪 ${u.username} t'a demandé de sortir de sa maison`);
      ack(cb, { ok: true });
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
    socket.on('inst_unqueue', (id, cb) => {
      const p = me(), u = currentUser();
      const m = p && media.get(p.scene);
      const i = m ? m.queue.findIndex(x => x.id === id) : -1;
      if (i < 0) return ack(cb, { error: 'Introuvable' });
      if (m.queue[i].userId !== uid && !canControl(u, p.scene)) return ack(cb, { error: 'Tu ne peux retirer que tes demandes' });
      m.queue.splice(i, 1); sendMedia(p.scene); ack(cb, { ok: true });
    });
  }
  return { onConnection, count: () => players.size, where: uid => players.get(uid)?.scene || null };
};
