// GajoxGaming — serveur principal (Express + Socket.io)
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const { db, getSettings, setSetting, log } = require('./db');

const PORT = process.env.PORT || 3000;
const COOKIE = 'lc_session';
const ROLES = ['user', 'moderator', 'admin'];
const GENDERS = ['h', 'f', 'x'];
const COLORS = ['#8b6cff', '#ff5fa2', '#ffb547', '#33d6a6', '#4fb3ff', '#ff7a59', '#c86bff', '#f2e94e'];

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// ---------- Utilitaires ----------
const now = () => Date.now();
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const USERNAME_RE = /^[\p{L}\p{N}_\-]{3,20}$/u;

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, gender: u.gender, age: u.age, city: u.city,
    bio: u.bio, color: u.color, role: u.role, isGuest: !!u.is_guest, createdAt: u.created_at,
  };
}
function adminUser(u) {
  return { ...publicUser(u), banned: !!u.banned, banReason: u.ban_reason, mutedUntil: u.muted_until, lastSeen: u.last_seen };
}
const getUser = id => db.prepare('SELECT * FROM users WHERE id=?').get(id);
const getUserByName = name => db.prepare('SELECT * FROM users WHERE username=?').get(name);

function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)').run(token, userId, now());
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
}
function userFromToken(token) {
  if (!token) return null;
  const row = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?').get(token);
  return row || null;
}
function parseCookie(header = '') {
  const out = {};
  header.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function filterWords(text) {
  const words = (getSettings().bannedWords || '').split(',').map(w => w.trim()).filter(Boolean);
  let out = text;
  for (const w of words) {
    const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, m => '*'.repeat(m.length));
  }
  return out;
}

// Anti-brute-force très simple
const attempts = new Map();
function tooMany(key, limit = 10, windowMs = 10 * 60 * 1000) {
  const t = now();
  const list = (attempts.get(key) || []).filter(x => t - x < windowMs);
  list.push(t);
  attempts.set(key, list);
  return list.length > limit;
}

// ---------- Middlewares ----------
function auth(req, res, next) {
  const u = userFromToken(req.cookies[COOKIE]);
  if (!u) return res.status(401).json({ error: 'Non connecté' });
  if (u.banned) return res.status(403).json({ error: 'Compte banni : ' + (u.ban_reason || 'aucune raison donnée') });
  req.user = u;
  next();
}
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Accès refusé' });
const isStaff = u => u && (u.role === 'admin' || u.role === 'moderator');

// ---------- Authentification ----------
function validateProfile({ gender, age }) {
  const minAge = parseInt(getSettings().minAge, 10) || 18;
  if (!GENDERS.includes(gender)) return 'Genre invalide';
  const a = parseInt(age, 10);
  if (!a || a < minAge || a > 99) return `Tu dois avoir au moins ${minAge} ans`;
  return null;
}

app.post('/api/register', (req, res) => {
  const s = getSettings();
  if (s.registrationOpen !== '1') return res.status(403).json({ error: 'Les inscriptions sont fermées pour le moment' });
  if (tooMany('reg:' + req.ip, 5)) return res.status(429).json({ error: 'Trop de tentatives, réessaie plus tard' });
  const username = clean(req.body.username, 20);
  const password = String(req.body.password || '');
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Pseudo : 3 à 20 caractères (lettres, chiffres, _ ou -)' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum' });
  const err = validateProfile(req.body);
  if (err) return res.status(400).json({ error: err });
  const existing = getUserByName(username);
  if (existing && (existing.banned || !(existing.is_guest && !online.has(existing.id)))) return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
  if (existing) db.prepare('DELETE FROM users WHERE id=?').run(existing.id);

  const isFirst = db.prepare('SELECT COUNT(*) c FROM users WHERE is_guest=0').get().c === 0;
  const role = isFirst || (process.env.ADMIN_USER && process.env.ADMIN_USER.toLowerCase() === username.toLowerCase()) ? 'admin' : 'user';
  const info = db.prepare(`INSERT INTO users (username,password_hash,gender,age,city,color,role,created_at,last_seen)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    username, bcrypt.hashSync(password, 10), req.body.gender, parseInt(req.body.age, 10),
    clean(req.body.city, 40), COLORS[Math.floor(Math.random() * COLORS.length)], role, now(), now());
  createSession(res, info.lastInsertRowid);
  if (role === 'admin') log(null, 'admin_auto', `${username} est devenu administrateur`);
  res.json({ user: publicUser(getUser(info.lastInsertRowid)) });
});

app.post('/api/login', (req, res) => {
  if (tooMany('login:' + req.ip, 15)) return res.status(429).json({ error: 'Trop de tentatives, réessaie dans quelques minutes' });
  const u = getUserByName(clean(req.body.username, 20));
  if (!u || u.is_guest || !bcrypt.compareSync(String(req.body.password || ''), u.password_hash || ''))
    return res.status(401).json({ error: 'Pseudo ou mot de passe incorrect' });
  if (u.banned) return res.status(403).json({ error: 'Compte banni : ' + (u.ban_reason || 'aucune raison donnée') });
  createSession(res, u.id);
  res.json({ user: publicUser(u) });
});

app.post('/api/guest', (req, res) => {
  const s = getSettings();
  if (s.guestsAllowed !== '1') return res.status(403).json({ error: "L'accès invité est désactivé, inscris-toi !" });
  if (tooMany('guest:' + req.ip, 20)) return res.status(429).json({ error: 'Trop de tentatives, réessaie plus tard' });
  const username = clean(req.body.username, 20);
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Pseudo : 3 à 20 caractères (lettres, chiffres, _ ou -)' });
  const err = validateProfile(req.body);
  if (err) return res.status(400).json({ error: err });
  const existing = getUserByName(username);
  if (existing) {
    if (!existing.is_guest) return res.status(409).json({ error: 'Ce pseudo appartient à un membre inscrit' });
    if (online.has(existing.id)) return res.status(409).json({ error: 'Ce pseudo est déjà utilisé en ce moment' });
    if (existing.banned) return res.status(403).json({ error: 'Ce pseudo est banni' });
    db.prepare('DELETE FROM users WHERE id=?').run(existing.id);
  }
  const info = db.prepare(`INSERT INTO users (username,gender,age,city,color,is_guest,created_at,last_seen)
    VALUES (?,?,?,?,?,1,?,?)`).run(
    username, req.body.gender, parseInt(req.body.age, 10), clean(req.body.city, 40),
    COLORS[Math.floor(Math.random() * COLORS.length)], now(), now());
  createSession(res, info.lastInsertRowid);
  res.json({ user: publicUser(getUser(info.lastInsertRowid)) });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(token);
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.put('/api/me', auth, (req, res) => {
  const u = req.user;
  const gender = req.body.gender ?? u.gender;
  const age = req.body.age ?? u.age;
  const err = validateProfile({ gender, age });
  if (err) return res.status(400).json({ error: err });
  const color = /^#[0-9a-f]{6}$/i.test(req.body.color || '') ? req.body.color : u.color;
  db.prepare('UPDATE users SET gender=?,age=?,city=?,bio=?,color=? WHERE id=?')
    .run(gender, parseInt(age, 10), clean(req.body.city ?? u.city, 40), clean(req.body.bio ?? u.bio, 300), color, u.id);
  const updated = getUser(u.id);
  refreshOnline(updated);
  res.json({ user: publicUser(updated) });
});

app.put('/api/me/password', auth, (req, res) => {
  const u = req.user;
  if (u.is_guest) return res.status(400).json({ error: 'Les invités n\'ont pas de mot de passe' });
  if (!bcrypt.compareSync(String(req.body.current || ''), u.password_hash)) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
  if (String(req.body.next || '').length < 6) return res.status(400).json({ error: 'Nouveau mot de passe : 6 caractères minimum' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(String(req.body.next), 10), u.id);
  res.json({ ok: true });
});

// ---------- Données publiques ----------
app.get('/api/stats', (req, res) => {
  res.json({
    online: online.size,
    members: db.prepare('SELECT COUNT(*) c FROM users WHERE is_guest=0').get().c,
    rooms: db.prepare('SELECT COUNT(*) c FROM rooms').get().c,
    guestsAllowed: getSettings().guestsAllowed === '1',
    registrationOpen: getSettings().registrationOpen === '1',
    minAge: parseInt(getSettings().minAge, 10) || 18,
  });
});

// ---------- Salons (officiels + salons créés par les membres) ----------
const getRoom = id => db.prepare('SELECT * FROM rooms WHERE id=?').get(id);
const getRoomBySlug = slug => db.prepare('SELECT * FROM rooms WHERE slug=?').get(String(slug));
const getStation = id => (id ? db.prepare('SELECT * FROM stations WHERE id=?').get(id) : null);
const stationOut = s => s && { id: s.id, name: s.name, url: s.url, genre: s.genre, icon: s.icon };
const isRoomMember = (roomId, userId) => !!db.prepare('SELECT 1 FROM room_members WHERE room_id=? AND user_id=?').get(roomId, userId);
const isRoomBanned = (roomId, userId) => !!db.prepare('SELECT 1 FROM room_bans WHERE room_id=? AND user_id=?').get(roomId, userId);

function roomOut(r) {
  const owner = r.owner_id ? getUser(r.owner_id) : null;
  return {
    id: r.id, slug: r.slug, name: r.name, description: r.description, icon: r.icon, membersOnly: !!r.members_only, sort: r.sort,
    ownerId: r.owner_id || null, ownerName: owner ? owner.username : null, isPrivate: !!r.is_private,
    voiceEnabled: !!r.voice_enabled, station: stationOut(getStation(r.station_id)),
    count: roomCount(r.slug), voice: voiceList(r.slug).length,
  };
}
// Peut-on entrer dans ce salon ?
function roomAccess(user, room) {
  if (!room) return 'Salon introuvable';
  if (isStaff(user) || room.owner_id === user.id) return null;
  if (room.members_only && user.is_guest) return 'Ce salon est réservé aux membres inscrits';
  if (isRoomBanned(room.id, user.id)) return 'Tu as été exclu de ce salon';
  if (room.is_private && !isRoomMember(room.id, user.id)) return 'Ce salon est fermé : seules les personnes invitées peuvent entrer';
  return null;
}
// Peut-on gérer ce salon ? (propriétaire, ou équipe ; seuls les admins gèrent les salons officiels)
function canManageRoom(user, room) {
  if (!room || !user) return false;
  if (room.owner_id) return room.owner_id === user.id || isStaff(user);
  return user.role === 'admin';
}
function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
}
const roomsChanged = () => io.emit('rooms_changed');

app.get('/api/rooms', auth, (req, res) => {
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY owner_id IS NOT NULL, sort, id').all();
  // Les salons fermés ne sont visibles que par les personnes qui peuvent y entrer
  const visible = rooms.filter(r => !r.is_private || !roomAccess(req.user, r));
  const s = getSettings();
  res.json({
    rooms: visible.map(roomOut),
    canCreate: s.userRoomsEnabled === '1' && !req.user.is_guest,
    maxUserRooms: parseInt(s.maxUserRooms, 10) || 0,
    voiceEnabled: s.voiceEnabled === '1',
  });
});

app.post('/api/rooms', auth, (req, res) => {
  const s = getSettings();
  if (s.userRoomsEnabled !== '1') return res.status(403).json({ error: 'La création de salons est désactivée' });
  if (req.user.is_guest) return res.status(403).json({ error: 'Inscris-toi pour créer ton propre salon' });
  const max = parseInt(s.maxUserRooms, 10) || 0;
  const mine = db.prepare('SELECT COUNT(*) c FROM rooms WHERE owner_id=?').get(req.user.id).c;
  if (!isStaff(req.user) && mine >= max) return res.status(400).json({ error: `Tu peux avoir ${max} salon(s) maximum` });
  if (tooMany('room:' + req.user.id, 5, 3600 * 1000)) return res.status(429).json({ error: 'Trop de salons créés, réessaie plus tard' });
  const name = clean(req.body.name, 30);
  if (name.length < 3) return res.status(400).json({ error: 'Nom du salon : 3 caractères minimum' });
  const slug = 'u-' + (slugify(name) || 'salon') + '-' + crypto.randomBytes(2).toString('hex');
  const info = db.prepare(`INSERT INTO rooms (slug,name,description,icon,sort,members_only,owner_id,is_private,created_at)
    VALUES (?,?,?,?,100,0,?,?,?)`).run(slug, name, clean(req.body.description, 120), clean(req.body.icon, 4) || '🏠', req.user.id, req.body.isPrivate ? 1 : 0, now());
  log(req.user, 'room_create', name + ' (salon membre)');
  roomsChanged();
  res.json({ room: roomOut(getRoom(info.lastInsertRowid)) });
});

app.patch('/api/rooms/:id', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!canManageRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne gères pas ce salon' });
  const b = req.body;
  const name = b.name !== undefined ? clean(b.name, 30) : room.name;
  if (name.length < 2) return res.status(400).json({ error: 'Nom trop court' });
  let stationId = room.station_id;
  if (b.stationId !== undefined) stationId = b.stationId ? (getStation(b.stationId) ? parseInt(b.stationId, 10) : room.station_id) : null;
  db.prepare('UPDATE rooms SET name=?,description=?,icon=?,is_private=?,station_id=?,voice_enabled=? WHERE id=?').run(
    name,
    b.description !== undefined ? clean(b.description, 120) : room.description,
    b.icon !== undefined ? (clean(b.icon, 4) || '🏠') : room.icon,
    b.isPrivate !== undefined ? (b.isPrivate ? 1 : 0) : room.is_private,
    stationId,
    b.voiceEnabled !== undefined ? (b.voiceEnabled ? 1 : 0) : room.voice_enabled,
    room.id);
  const updated = getRoom(room.id);
  // Salon passé en "fermé" : on fait sortir les personnes non invitées
  if (updated.is_private && !room.is_private) {
    for (const [uid2, e] of online) if (roomAccess(e.user, updated)) ejectFromRoom(uid2, updated.slug, 'Le salon a été fermé par son propriétaire');
  }
  if (!updated.voice_enabled) for (const p of voiceList(updated.slug)) leaveVoiceBySocket(p.socketId, 'Le vocal a été désactivé dans ce salon');
  if (updated.station_id !== room.station_id) io.to('room:' + updated.slug).emit('room_radio', { slug: updated.slug, station: stationOut(getStation(updated.station_id)), by: req.user.username });
  roomsChanged();
  res.json({ room: roomOut(updated) });
});

app.delete('/api/rooms/:id', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!room || !room.owner_id) return res.status(400).json({ error: 'Seuls les salons de membres se suppriment ici' });
  if (!canManageRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne gères pas ce salon' });
  deleteRoom(room, req.user);
  res.json({ ok: true });
});

app.get('/api/rooms/:id/members', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!canManageRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne gères pas ce salon' });
  const members = db.prepare('SELECT u.* FROM room_members m JOIN users u ON u.id=m.user_id WHERE m.room_id=? ORDER BY u.username').all(room.id);
  const bans = db.prepare('SELECT u.* FROM room_bans b JOIN users u ON u.id=b.user_id WHERE b.room_id=? ORDER BY u.username').all(room.id);
  res.json({ members: members.map(publicUser), bans: bans.map(publicUser) });
});

app.post('/api/rooms/:id/members', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!canManageRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne gères pas ce salon' });
  const target = req.body.userId ? getUser(req.body.userId) : getUserByName(clean(req.body.username, 20));
  if (!target) return res.status(404).json({ error: 'Pseudo introuvable' });
  if (target.id === room.owner_id) return res.status(400).json({ error: 'C\'est le propriétaire du salon' });
  const count = db.prepare('SELECT COUNT(*) c FROM room_members WHERE room_id=?').get(room.id).c;
  if (count >= 200) return res.status(400).json({ error: 'Liste d\'invités pleine (200 maximum)' });
  db.prepare('INSERT OR IGNORE INTO room_members (room_id,user_id) VALUES (?,?)').run(room.id, target.id);
  db.prepare('DELETE FROM room_bans WHERE room_id=? AND user_id=?').run(room.id, target.id);
  emitToUser(target.id, 'room_invite', { room: roomOut(room), by: req.user.username });
  roomsChanged();
  res.json({ user: publicUser(target) });
});

app.delete('/api/rooms/:id/members/:userId', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!canManageRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne gères pas ce salon' });
  const uid2 = parseInt(req.params.userId, 10);
  db.prepare('DELETE FROM room_members WHERE room_id=? AND user_id=?').run(room.id, uid2);
  const target = getUser(uid2);
  if (room.is_private && target && roomAccess(target, room)) ejectFromRoom(uid2, room.slug, 'Tu as été retiré de ce salon fermé');
  roomsChanged();
  res.json({ ok: true });
});

// Exclure quelqu'un d'un salon (et l'empêcher de revenir)
app.post('/api/rooms/:id/kick/:userId', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!canManageRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne gères pas ce salon' });
  const target = getUser(req.params.userId);
  if (!target || target.id === req.user.id || target.id === room.owner_id) return res.status(400).json({ error: 'Impossible d\'exclure cette personne' });
  if (isStaff(target) && req.user.role !== 'admin') return res.status(403).json({ error: 'Impossible d\'exclure un membre de l\'équipe' });
  db.prepare('DELETE FROM room_members WHERE room_id=? AND user_id=?').run(room.id, target.id);
  db.prepare('INSERT OR IGNORE INTO room_bans (room_id,user_id) VALUES (?,?)').run(room.id, target.id);
  ejectFromRoom(target.id, room.slug, `Tu as été exclu du salon ${room.name}`);
  io.to('room:' + room.slug).emit('system', { room: room.slug, text: `${target.username} a été exclu du salon par ${req.user.username}` });
  roomsChanged();
  res.json({ ok: true });
});
app.delete('/api/rooms/:id/bans/:userId', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!canManageRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne gères pas ce salon' });
  db.prepare('DELETE FROM room_bans WHERE room_id=? AND user_id=?').run(room.id, req.params.userId);
  roomsChanged();
  res.json({ ok: true });
});

function deleteRoom(room, actor) {
  for (const p of voiceList(room.slug)) leaveVoiceBySocket(p.socketId, 'Le salon a été supprimé');
  db.prepare('DELETE FROM rooms WHERE id=?').run(room.id);
  for (const e of online.values()) if (e.room === room.slug) e.room = null;
  log(actor, 'room_delete', room.name);
  io.to('room:' + room.slug).emit('room_deleted', { slug: room.slug });
  io.in('room:' + room.slug).socketsLeave('room:' + room.slug);
  roomsChanged();
  schedulePresence();
}

// ---------- Radios & vocal ----------
app.get('/api/stations', auth, (req, res) => {
  res.json({ stations: db.prepare('SELECT * FROM stations ORDER BY sort, id').all().map(stationOut) });
});
app.get('/api/ice', auth, (req, res) => {
  const iceServers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) iceServers.push({ urls: process.env.TURN_URL.split(','), username: process.env.TURN_USER, credential: process.env.TURN_PASS });
  res.json({ iceServers });
});

app.get('/api/users/:id', auth, (req, res) => {
  const u = getUser(req.params.id);
  if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ user: publicUser(u), online: online.has(u.id), blocked: isBlocked(req.user.id, u.id) });
});

// ---------- Blocages & signalements ----------
const isBlocked = (a, b) => !!db.prepare('SELECT 1 FROM blocks WHERE user_id=? AND blocked_id=?').get(a, b);
app.get('/api/blocks', auth, (req, res) => {
  res.json({ ids: db.prepare('SELECT blocked_id FROM blocks WHERE user_id=?').all(req.user.id).map(r => r.blocked_id) });
});
app.post('/api/blocks/:id', auth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id || !getUser(id)) return res.status(400).json({ error: 'Impossible' });
  db.prepare('INSERT OR IGNORE INTO blocks (user_id,blocked_id) VALUES (?,?)').run(req.user.id, id);
  res.json({ ok: true });
});
app.delete('/api/blocks/:id', auth, (req, res) => {
  db.prepare('DELETE FROM blocks WHERE user_id=? AND blocked_id=?').run(req.user.id, req.params.id);
  res.json({ ok: true });
});

app.post('/api/reports', auth, (req, res) => {
  const target = getUser(req.body.targetId);
  const reason = clean(req.body.reason, 500);
  if (!target || !reason) return res.status(400).json({ error: 'Signalement incomplet' });
  if (tooMany('report:' + req.user.id, 10, 3600 * 1000)) return res.status(429).json({ error: 'Trop de signalements' });
  db.prepare('INSERT INTO reports (reporter_id,target_id,reason,created_at) VALUES (?,?,?,?)').run(req.user.id, target.id, reason, now());
  emitToStaff('staff_alert', { text: `Nouveau signalement contre ${target.username}` });
  res.json({ ok: true });
});

// ---------- Messages privés ----------
app.get('/api/pm', auth, (req, res) => {
  // Liste des conversations
  const rows = db.prepare(`
    SELECT CASE WHEN from_id=? THEN to_id ELSE from_id END other, MAX(id) last_id,
      SUM(CASE WHEN to_id=? AND is_read=0 THEN 1 ELSE 0 END) unread
    FROM private_messages WHERE from_id=? OR to_id=? GROUP BY other ORDER BY last_id DESC LIMIT 50`)
    .all(req.user.id, req.user.id, req.user.id, req.user.id);
  const convs = rows.map(r => {
    const u = getUser(r.other);
    const last = db.prepare('SELECT content,created_at FROM private_messages WHERE id=?').get(r.last_id);
    return u && { user: publicUser(u), online: online.has(u.id), unread: r.unread, last };
  }).filter(Boolean);
  res.json({ conversations: convs });
});

app.get('/api/pm/:id', auth, (req, res) => {
  const other = parseInt(req.params.id, 10);
  const msgs = db.prepare(`SELECT * FROM private_messages WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY id DESC LIMIT 100`)
    .all(req.user.id, other, other, req.user.id).reverse();
  db.prepare('UPDATE private_messages SET is_read=1 WHERE from_id=? AND to_id=?').run(other, req.user.id);
  res.json({ messages: msgs.map(pmOut) });
});
const pmOut = m => ({ id: m.id, from: m.from_id, to: m.to_id, content: m.content, createdAt: m.created_at, read: !!m.is_read });

// ---------- Administration ----------
const admin = express.Router();
admin.use(auth, requireRole('admin', 'moderator'));

admin.get('/stats', (req, res) => {
  const day = now() - 24 * 3600 * 1000;
  res.json({
    online: online.size,
    members: db.prepare('SELECT COUNT(*) c FROM users WHERE is_guest=0').get().c,
    guests: db.prepare('SELECT COUNT(*) c FROM users WHERE is_guest=1').get().c,
    banned: db.prepare('SELECT COUNT(*) c FROM users WHERE banned=1').get().c,
    newToday: db.prepare('SELECT COUNT(*) c FROM users WHERE created_at>? AND is_guest=0').get(day).c,
    messagesToday: db.prepare('SELECT COUNT(*) c FROM messages WHERE created_at>?').get(day).c,
    pmToday: db.prepare('SELECT COUNT(*) c FROM private_messages WHERE created_at>?').get(day).c,
    openReports: db.prepare("SELECT COUNT(*) c FROM reports WHERE status='open'").get().c,
    rooms: db.prepare('SELECT * FROM rooms ORDER BY sort,id').all().map(r => ({ name: r.name, icon: r.icon, count: roomCount(r.slug) })),
    me: publicUser(req.user),
  });
});

admin.get('/users', (req, res) => {
  const q = '%' + clean(req.query.q, 40) + '%';
  const page = Math.max(0, parseInt(req.query.page, 10) || 0);
  const filter = req.query.filter || 'all';
  let where = 'username LIKE ?';
  if (filter === 'online') where += ` AND id IN (${[...online.keys()].join(',') || 0})`;
  if (filter === 'banned') where += ' AND banned=1';
  if (filter === 'staff') where += " AND role IN ('admin','moderator')";
  if (filter === 'guests') where += ' AND is_guest=1';
  if (filter === 'members') where += ' AND is_guest=0';
  const total = db.prepare(`SELECT COUNT(*) c FROM users WHERE ${where}`).get(q).c;
  const users = db.prepare(`SELECT * FROM users WHERE ${where} ORDER BY id DESC LIMIT 25 OFFSET ?`).all(q, page * 25);
  res.json({ total, page, users: users.map(u => ({ ...adminUser(u), online: online.has(u.id) })) });
});

function canModerate(actor, target) {
  if (!target) return false;
  if (actor.id === target.id) return false;
  if (actor.role === 'admin') return true;
  return target.role === 'user';
}

admin.patch('/users/:id', (req, res) => {
  const target = getUser(req.params.id);
  if (!canModerate(req.user, target)) return res.status(403).json({ error: 'Action non autorisée sur cet utilisateur' });
  if (req.body.role !== undefined) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Seul un admin peut changer les rôles' });
    if (!ROLES.includes(req.body.role)) return res.status(400).json({ error: 'Rôle invalide' });
    if (target.is_guest && req.body.role !== 'user') return res.status(400).json({ error: 'Un invité ne peut pas être promu' });
    db.prepare('UPDATE users SET role=? WHERE id=?').run(req.body.role, target.id);
    log(req.user, 'role', `${target.username} → ${req.body.role}`);
  }
  if (req.body.banned !== undefined) {
    const banned = req.body.banned ? 1 : 0;
    const reason = clean(req.body.banReason, 200);
    db.prepare('UPDATE users SET banned=?, ban_reason=? WHERE id=?').run(banned, banned ? reason : '', target.id);
    log(req.user, banned ? 'ban' : 'unban', `${target.username}${reason ? ' : ' + reason : ''}`);
    if (banned) {
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
      disconnectUser(target.id, 'banned', reason || 'Tu as été banni par la modération');
    }
  }
  const updated = getUser(target.id);
  refreshOnline(updated);
  res.json({ user: adminUser(updated) });
});

admin.post('/users/:id/mute', (req, res) => {
  const target = getUser(req.params.id);
  if (!canModerate(req.user, target)) return res.status(403).json({ error: 'Action non autorisée' });
  const minutes = Math.min(10080, Math.max(0, parseInt(req.body.minutes, 10) || 0));
  const until = minutes ? now() + minutes * 60000 : 0;
  db.prepare('UPDATE users SET muted_until=? WHERE id=?').run(until, target.id);
  log(req.user, minutes ? 'mute' : 'unmute', `${target.username}${minutes ? ' (' + minutes + ' min)' : ''}`);
  emitToUser(target.id, 'system', { text: minutes ? `Tu es rendu muet pendant ${minutes} minute(s).` : 'Tu peux de nouveau parler.' });
  res.json({ ok: true });
});

admin.post('/users/:id/kick', (req, res) => {
  const target = getUser(req.params.id);
  if (!canModerate(req.user, target)) return res.status(403).json({ error: 'Action non autorisée' });
  log(req.user, 'kick', target.username);
  disconnectUser(target.id, 'kicked', clean(req.body.reason, 200) || 'Tu as été expulsé du chat');
  res.json({ ok: true });
});

admin.delete('/users/:id', requireRole('admin'), (req, res) => {
  const target = getUser(req.params.id);
  if (!canModerate(req.user, target)) return res.status(403).json({ error: 'Action non autorisée' });
  disconnectUser(target.id, 'kicked', 'Ton compte a été supprimé');
  db.prepare('DELETE FROM users WHERE id=?').run(target.id);
  log(req.user, 'delete_user', target.username);
  res.json({ ok: true });
});

admin.get('/users/:id/messages', (req, res) => {
  const msgs = db.prepare(`SELECT m.*, r.name room FROM messages m JOIN rooms r ON r.id=m.room_id WHERE m.user_id=? ORDER BY m.id DESC LIMIT 50`).all(req.params.id);
  res.json({ messages: msgs.map(m => ({ id: m.id, room: m.room, content: m.content, createdAt: m.created_at })) });
});

// Salons
admin.get('/rooms', (req, res) => {
  res.json({ rooms: db.prepare('SELECT * FROM rooms ORDER BY owner_id IS NOT NULL, sort, id').all().map(roomOut) });
});
function roomInput(body) {
  const name = clean(body.name, 30);
  const slug = clean(body.slug || name, 30).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { name, slug, description: clean(body.description, 120), icon: clean(body.icon, 4) || '💬', sort: parseInt(body.sort, 10) || 0, members_only: body.membersOnly ? 1 : 0 };
}
admin.post('/rooms', requireRole('admin'), (req, res) => {
  const r = roomInput(req.body);
  if (!r.name || !r.slug) return res.status(400).json({ error: 'Nom de salon requis' });
  if (db.prepare('SELECT 1 FROM rooms WHERE slug=?').get(r.slug)) return res.status(409).json({ error: 'Ce salon existe déjà' });
  db.prepare('INSERT INTO rooms (slug,name,description,icon,sort,members_only,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(r.slug, r.name, r.description, r.icon, r.sort, r.members_only, now());
  log(req.user, 'room_create', r.name);
  io.emit('rooms_changed');
  res.json({ ok: true });
});
admin.patch('/rooms/:id', requireRole('admin'), (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id=?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Salon introuvable' });
  const r = roomInput({ ...roomOut(room), ...req.body, slug: room.slug });
  db.prepare('UPDATE rooms SET name=?,description=?,icon=?,sort=?,members_only=? WHERE id=?')
    .run(r.name, r.description, r.icon, r.sort, r.members_only, room.id);
  log(req.user, 'room_edit', r.name);
  io.emit('rooms_changed');
  res.json({ ok: true });
});
admin.delete('/rooms/:id', requireRole('admin'), (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id=?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Salon introuvable' });
  if (db.prepare('SELECT COUNT(*) c FROM rooms').get().c <= 1) return res.status(400).json({ error: 'Il faut garder au moins un salon' });
  deleteRoom(room, req.user);
  res.json({ ok: true });
});
admin.delete('/rooms/:id/messages', requireRole('admin'), (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id=?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Salon introuvable' });
  db.prepare('DELETE FROM messages WHERE room_id=?').run(room.id);
  log(req.user, 'room_clear', room.name);
  io.to('room:' + room.slug).emit('room_cleared', { slug: room.slug });
  res.json({ ok: true });
});

// Messages
admin.get('/messages', (req, res) => {
  const q = '%' + clean(req.query.q, 60) + '%';
  const msgs = db.prepare(`SELECT m.*, u.username, r.name room FROM messages m JOIN users u ON u.id=m.user_id JOIN rooms r ON r.id=m.room_id
    WHERE m.content LIKE ? OR u.username LIKE ? ORDER BY m.id DESC LIMIT 100`).all(q, q);
  res.json({ messages: msgs.map(m => ({ id: m.id, userId: m.user_id, username: m.username, room: m.room, content: m.content, createdAt: m.created_at })) });
});
admin.delete('/messages/:id', (req, res) => {
  const m = db.prepare('SELECT m.*, r.slug FROM messages m JOIN rooms r ON r.id=m.room_id WHERE m.id=?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Message introuvable' });
  db.prepare('DELETE FROM messages WHERE id=?').run(m.id);
  io.to('room:' + m.slug).emit('message_deleted', { id: m.id });
  log(req.user, 'message_delete', `#${m.id}`);
  res.json({ ok: true });
});

// Signalements
admin.get('/reports', (req, res) => {
  const status = req.query.status === 'closed' ? 'closed' : 'open';
  const rows = db.prepare(`SELECT r.*, a.username reporter, t.username target FROM reports r
    LEFT JOIN users a ON a.id=r.reporter_id LEFT JOIN users t ON t.id=r.target_id WHERE r.status=? ORDER BY r.id DESC LIMIT 100`).all(status);
  res.json({ reports: rows.map(r => ({ id: r.id, reporter: r.reporter, target: r.target, targetId: r.target_id, reason: r.reason, status: r.status, createdAt: r.created_at })) });
});
admin.patch('/reports/:id', (req, res) => {
  const status = req.body.status === 'open' ? 'open' : 'closed';
  db.prepare('UPDATE reports SET status=? WHERE id=?').run(status, req.params.id);
  log(req.user, 'report_' + status, `#${req.params.id}`);
  res.json({ ok: true });
});

// Réglages
admin.get('/settings', requireRole('admin'), (req, res) => res.json({ settings: getSettings() }));
admin.put('/settings', requireRole('admin'), (req, res) => {
  const b = req.body;
  if (b.announcement !== undefined) setSetting('announcement', clean(b.announcement, 300));
  if (b.bannedWords !== undefined) setSetting('bannedWords', clean(b.bannedWords, 2000));
  if (b.guestsAllowed !== undefined) setSetting('guestsAllowed', b.guestsAllowed ? '1' : '0');
  if (b.registrationOpen !== undefined) setSetting('registrationOpen', b.registrationOpen ? '1' : '0');
  if (b.minAge !== undefined) setSetting('minAge', Math.min(99, Math.max(13, parseInt(b.minAge, 10) || 18)));
  if (b.voiceEnabled !== undefined) setSetting('voiceEnabled', b.voiceEnabled ? '1' : '0');
  if (b.voiceMax !== undefined) setSetting('voiceMax', Math.min(20, Math.max(2, parseInt(b.voiceMax, 10) || 8)));
  if (b.userRoomsEnabled !== undefined) setSetting('userRoomsEnabled', b.userRoomsEnabled ? '1' : '0');
  if (b.maxUserRooms !== undefined) setSetting('maxUserRooms', Math.min(20, Math.max(0, parseInt(b.maxUserRooms, 10) || 0)));
  if (getSettings().voiceEnabled !== '1') for (const [slug] of voice) for (const p of voiceList(slug)) leaveVoiceBySocket(p.socketId, 'Le vocal a été désactivé');
  log(req.user, 'settings', 'Réglages mis à jour');
  io.emit('announcement', { text: getSettings().announcement });
  res.json({ settings: getSettings() });
});

// Radios
function stationInput(b) {
  const url = clean(b.url, 500);
  return { name: clean(b.name, 40), url, genre: clean(b.genre, 40), icon: clean(b.icon, 4) || '📻', sort: parseInt(b.sort, 10) || 0 };
}
const validStream = st => st.name && /^https?:\/\//i.test(st.url);
admin.get('/stations', requireRole('admin'), (req, res) => {
  res.json({ stations: db.prepare('SELECT * FROM stations ORDER BY sort, id').all() });
});
admin.post('/stations', requireRole('admin'), (req, res) => {
  const st = stationInput(req.body);
  if (!validStream(st)) return res.status(400).json({ error: 'Nom et lien du flux (http/https) obligatoires' });
  db.prepare('INSERT INTO stations (name,url,genre,icon,sort) VALUES (?,?,?,?,?)').run(st.name, st.url, st.genre, st.icon, st.sort);
  log(req.user, 'station_create', st.name);
  io.emit('stations_changed');
  res.json({ ok: true });
});
admin.patch('/stations/:id', requireRole('admin'), (req, res) => {
  const cur = db.prepare('SELECT * FROM stations WHERE id=?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Radio introuvable' });
  const st = stationInput({ ...cur, ...req.body });
  if (!validStream(st)) return res.status(400).json({ error: 'Nom et lien du flux (http/https) obligatoires' });
  db.prepare('UPDATE stations SET name=?,url=?,genre=?,icon=?,sort=? WHERE id=?').run(st.name, st.url, st.genre, st.icon, st.sort, cur.id);
  log(req.user, 'station_edit', st.name);
  io.emit('stations_changed');
  res.json({ ok: true });
});
admin.delete('/stations/:id', requireRole('admin'), (req, res) => {
  const cur = db.prepare('SELECT * FROM stations WHERE id=?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Radio introuvable' });
  db.prepare('DELETE FROM stations WHERE id=?').run(cur.id);
  db.prepare('UPDATE rooms SET station_id=NULL WHERE station_id=?').run(cur.id);
  log(req.user, 'station_delete', cur.name);
  io.emit('stations_changed');
  roomsChanged();
  res.json({ ok: true });
});

admin.post('/broadcast', (req, res) => {
  const text = clean(req.body.text, 300);
  if (!text) return res.status(400).json({ error: 'Message vide' });
  io.emit('broadcast', { text, from: req.user.username });
  log(req.user, 'broadcast', text);
  res.json({ ok: true });
});

admin.get('/logs', (req, res) => {
  res.json({ logs: db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 200').all() });
});

app.use('/api/admin', admin);

// Pages
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chat.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ---------- Temps réel ----------
// online : userId -> { user, sockets:Set, room }
const online = new Map();

function onlineOut(entry) {
  return { ...publicUser(entry.user), room: entry.room };
}
function roomCount(slug) {
  let c = 0;
  for (const e of online.values()) if (e.room === slug) c++;
  return c;
}
function broadcastPresence() {
  io.emit('presence', { users: [...online.values()].map(onlineOut) });
}
let presenceTimer = null;
function schedulePresence() {
  if (presenceTimer) return;
  presenceTimer = setTimeout(() => { presenceTimer = null; broadcastPresence(); }, 300);
}
function refreshOnline(user) {
  const e = online.get(user.id);
  if (e) { e.user = user; schedulePresence(); }
}
function emitToUser(id, ev, data) {
  const e = online.get(id);
  if (e) for (const s of e.sockets) io.to(s).emit(ev, data);
}
function emitToStaff(ev, data) {
  for (const e of online.values()) if (isStaff(e.user)) for (const s of e.sockets) io.to(s).emit(ev, data);
}
function disconnectUser(id, ev, reason) {
  const e = online.get(id);
  if (!e) return;
  for (const sid of e.sockets) {
    const s = io.sockets.sockets.get(sid);
    if (s) { s.emit(ev, { reason }); s.disconnect(true); }
  }
}

// Faire sortir quelqu'un d'un salon (tous ses onglets)
function ejectFromRoom(userId, slug, reason) {
  const e = online.get(userId);
  if (!e) return;
  for (const sid of e.sockets) {
    const s = io.sockets.sockets.get(sid);
    if (!s || !s.rooms.has('room:' + slug)) continue;
    s.leave('room:' + slug);
    leaveVoiceBySocket(sid, null);
    s.emit('room_ejected', { slug, reason });
  }
  if (e.room === slug) e.room = null;
  schedulePresence();
}

// ---------- Vocal (WebRTC : le serveur ne fait que relayer la signalisation) ----------
// voice : slug -> Map(socketId -> { userId, username, color, muted })
const voice = new Map();
const voiceOf = new Map(); // socketId -> slug
function voiceList(slug) {
  const m = voice.get(slug);
  return m ? [...m.entries()].map(([socketId, p]) => ({ socketId, ...p })) : [];
}
function emitVoiceState(slug) {
  io.emit('voice_state', { slug, participants: voiceList(slug) });
}
function leaveVoiceBySocket(socketId, reason) {
  const slug = voiceOf.get(socketId);
  if (!slug) return;
  voiceOf.delete(socketId);
  const m = voice.get(slug);
  if (m) { m.delete(socketId); if (!m.size) voice.delete(slug); }
  for (const p of voiceList(slug)) io.to(p.socketId).emit('voice_peer_left', { socketId });
  if (reason) io.to(socketId).emit('voice_kicked', { reason });
  emitVoiceState(slug);
}

io.use((socket, next) => {
  const token = parseCookie(socket.handshake.headers.cookie)[COOKIE];
  const u = userFromToken(token);
  if (!u) return next(new Error('unauthorized'));
  if (u.banned) return next(new Error('banned'));
  socket.data.userId = u.id;
  next();
});

io.on('connection', socket => {
  const uid = socket.data.userId;
  let entry = online.get(uid);
  if (!entry) {
    entry = { user: getUser(uid), sockets: new Set(), room: null };
    online.set(uid, entry);
  }
  entry.sockets.add(socket.id);
  db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(now(), uid);

  socket.emit('hello', { user: publicUser(entry.user), announcement: getSettings().announcement });
  broadcastPresence();

  let lastMsg = 0;
  const flood = () => {
    const t = now();
    if (t - lastMsg < 700) return true;
    lastMsg = t;
    return false;
  };
  const current = () => getUser(uid);

  socket.on('join', (slug, ack) => {
    const room = getRoomBySlug(slug);
    const u = current();
    const denied = roomAccess(u, room);
    if (denied) return ack && ack({ error: denied });
    if (voiceOf.get(socket.id) && voiceOf.get(socket.id) !== room.slug) leaveVoiceBySocket(socket.id, null);
    for (const r of socket.rooms) if (r.startsWith('room:')) socket.leave(r);
    socket.join('room:' + room.slug);
    const prev = entry.room;
    entry.room = room.slug;
    const history = db.prepare(`SELECT m.*, u.username, u.color, u.gender, u.role FROM messages m JOIN users u ON u.id=m.user_id
      WHERE m.room_id=? ORDER BY m.id DESC LIMIT 60`).all(room.id).reverse();
    ack && ack({ room: roomOut(room), history: history.map(msgOut), voice: voiceList(room.slug) });
    if (prev !== room.slug) {
      if (prev) io.to('room:' + prev).emit('system', { room: prev, text: `${u.username} a quitté le salon` });
      socket.to('room:' + room.slug).emit('system', { room: room.slug, text: `${u.username} a rejoint le salon` });
    }
    schedulePresence();
  });

  socket.on('message', (text, ack) => {
    const u = current();
    if (!u || u.banned) return;
    if (!entry.room) return ack && ack({ error: 'Rejoins un salon d\'abord' });
    if (u.muted_until && u.muted_until > now()) return ack && ack({ error: 'Tu es rendu muet pour le moment' });
    if (flood()) return ack && ack({ error: 'Doucement ! Tu envoies trop de messages' });
    const content = filterWords(clean(text, 500));
    if (!content) return;
    const room = getRoomBySlug(entry.room);
    if (!room || !socket.rooms.has('room:' + room.slug)) return ack && ack({ error: 'Rejoins un salon d\'abord' });
    if (roomAccess(u, room)) return ack && ack({ error: roomAccess(u, room) });
    const info = db.prepare('INSERT INTO messages (room_id,user_id,content,created_at) VALUES (?,?,?,?)').run(room.id, uid, content, now());
    const msg = msgOut({ id: info.lastInsertRowid, user_id: uid, username: u.username, color: u.color, gender: u.gender, role: u.role, content, created_at: now() });
    io.to('room:' + room.slug).emit('message', { room: room.slug, ...msg });
    ack && ack({ ok: true });
  });

  socket.on('typing', () => {
    if (entry.room) socket.to('room:' + entry.room).emit('typing', { room: entry.room, username: entry.user.username });
  });

  socket.on('pm', ({ to, text } = {}, ack) => {
    const u = current();
    const target = getUser(parseInt(to, 10));
    if (!u || !target || target.id === uid) return ack && ack({ error: 'Destinataire invalide' });
    if (u.muted_until && u.muted_until > now()) return ack && ack({ error: 'Tu es rendu muet pour le moment' });
    if (isBlocked(target.id, uid)) return ack && ack({ error: 'Cette personne ne reçoit pas tes messages' });
    if (isBlocked(uid, target.id)) return ack && ack({ error: 'Tu as bloqué cette personne' });
    if (flood()) return ack && ack({ error: 'Doucement ! Tu envoies trop de messages' });
    const content = filterWords(clean(text, 1000));
    if (!content) return;
    const info = db.prepare('INSERT INTO private_messages (from_id,to_id,content,created_at) VALUES (?,?,?,?)').run(uid, target.id, content, now());
    const m = pmOut({ id: info.lastInsertRowid, from_id: uid, to_id: target.id, content, created_at: now(), is_read: 0 });
    emitToUser(target.id, 'pm', { ...m, fromUser: publicUser(u) });
    emitToUser(uid, 'pm', { ...m, fromUser: publicUser(u) });
    ack && ack({ ok: true, message: m });
  });

  socket.on('pm_read', from => {
    db.prepare('UPDATE private_messages SET is_read=1 WHERE from_id=? AND to_id=?').run(parseInt(from, 10), uid);
  });

  socket.on('pm_typing', to => emitToUser(parseInt(to, 10), 'pm_typing', { from: uid }));

  // ----- Vocal -----
  const myVoiceRoom = () => { for (const r of socket.rooms) if (r.startsWith('room:')) return r.slice(5); return null; };
  socket.on('voice_join', (_, ack) => {
    const u = current();
    const slug = myVoiceRoom();
    const room = slug && getRoomBySlug(slug);
    const s = getSettings();
    if (!room) return ack && ack({ error: 'Rejoins un salon d\'abord' });
    if (s.voiceEnabled !== '1' || !room.voice_enabled) return ack && ack({ error: 'Le vocal est désactivé dans ce salon' });
    if (roomAccess(u, room)) return ack && ack({ error: roomAccess(u, room) });
    if (u.muted_until && u.muted_until > now()) return ack && ack({ error: 'Tu es rendu muet pour le moment' });
    if (voiceOf.get(socket.id) === slug) return ack && ack({ peers: voiceList(slug).filter(p => p.socketId !== socket.id) });
    leaveVoiceBySocket(socket.id, null);
    const max = parseInt(s.voiceMax, 10) || 8;
    if (voiceList(slug).length >= max) return ack && ack({ error: `Le vocal est plein (${max} personnes maximum)` });
    const peers = voiceList(slug);
    if (!voice.has(slug)) voice.set(slug, new Map());
    voice.get(slug).set(socket.id, { userId: uid, username: u.username, color: u.color, muted: false });
    voiceOf.set(socket.id, slug);
    ack && ack({ peers });
    emitVoiceState(slug);
  });
  socket.on('voice_leave', () => leaveVoiceBySocket(socket.id, null));
  socket.on('voice_signal', ({ to, data } = {}) => {
    const slug = voiceOf.get(socket.id);
    if (!slug || voiceOf.get(String(to)) !== slug || !data) return;
    io.to(String(to)).emit('voice_signal', { from: socket.id, data });
  });
  socket.on('voice_mute', muted => {
    const slug = voiceOf.get(socket.id);
    const p = slug && voice.get(slug)?.get(socket.id);
    if (!p) return;
    p.muted = !!muted;
    emitVoiceState(slug);
  });
  socket.on('voice_kick', (targetSocketId, ack) => {
    const slug = voiceOf.get(String(targetSocketId));
    const room = slug && getRoomBySlug(slug);
    if (!room || !canManageRoom(current(), room)) return ack && ack({ error: 'Action non autorisée' });
    const target = voice.get(slug)?.get(String(targetSocketId));
    if (target && target.userId === room.owner_id) return ack && ack({ error: 'Impossible de retirer le propriétaire' });
    leaveVoiceBySocket(String(targetSocketId), 'Tu as été retiré du vocal');
    ack && ack({ ok: true });
  });

  socket.on('disconnect', () => {
    leaveVoiceBySocket(socket.id, null);
    entry.sockets.delete(socket.id);
    if (entry.sockets.size === 0) {
      online.delete(uid);
      db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(now(), uid);
      if (entry.room) io.to('room:' + entry.room).emit('system', { room: entry.room, text: `${entry.user.username} s'est déconnecté` });
      schedulePresence();
    }
  });
});

function msgOut(m) {
  return { id: m.id, userId: m.user_id, username: m.username, color: m.color, gender: m.gender, role: m.role, content: m.content, createdAt: m.created_at };
}

// Nettoyage : invités inactifs depuis 24 h et vieux messages (30 jours)
setInterval(() => {
  const day = now() - 24 * 3600 * 1000;
  const ids = db.prepare('SELECT id FROM users WHERE is_guest=1 AND banned=0 AND last_seen<?').all(day).map(r => r.id).filter(id => !online.has(id));
  const del = db.prepare('DELETE FROM users WHERE id=?');
  ids.forEach(id => del.run(id));
  db.prepare('DELETE FROM messages WHERE created_at<?').run(now() - 30 * 24 * 3600 * 1000);
}, 3600 * 1000).unref();

server.listen(PORT, () => console.log(`✨ GajoxGaming en ligne sur http://localhost:${PORT}`));
