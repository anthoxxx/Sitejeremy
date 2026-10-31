// LustryChat — serveur principal (Express + Socket.io)
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

app.get('/api/rooms', auth, (req, res) => {
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY sort, id').all();
  res.json({ rooms: rooms.map(r => ({ ...roomOut(r), count: roomCount(r.slug) })) });
});
const roomOut = r => ({ id: r.id, slug: r.slug, name: r.name, description: r.description, icon: r.icon, membersOnly: !!r.members_only, sort: r.sort });

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
  res.json({ rooms: db.prepare('SELECT * FROM rooms ORDER BY sort,id').all().map(r => ({ ...roomOut(r), count: roomCount(r.slug) })) });
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
  db.prepare('DELETE FROM rooms WHERE id=?').run(room.id);
  log(req.user, 'room_delete', room.name);
  io.to('room:' + room.slug).emit('room_deleted', { slug: room.slug });
  io.emit('rooms_changed');
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
  log(req.user, 'settings', 'Réglages mis à jour');
  io.emit('announcement', { text: getSettings().announcement });
  res.json({ settings: getSettings() });
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
    const room = db.prepare('SELECT * FROM rooms WHERE slug=?').get(String(slug));
    const u = current();
    if (!room) return ack && ack({ error: 'Salon introuvable' });
    if (room.members_only && u.is_guest) return ack && ack({ error: 'Ce salon est réservé aux membres inscrits' });
    for (const r of socket.rooms) if (r.startsWith('room:')) socket.leave(r);
    socket.join('room:' + room.slug);
    const prev = entry.room;
    entry.room = room.slug;
    const history = db.prepare(`SELECT m.*, u.username, u.color, u.gender, u.role FROM messages m JOIN users u ON u.id=m.user_id
      WHERE m.room_id=? ORDER BY m.id DESC LIMIT 60`).all(room.id).reverse();
    ack && ack({ room: roomOut(room), history: history.map(msgOut) });
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
    const room = db.prepare('SELECT * FROM rooms WHERE slug=?').get(entry.room);
    if (!room) return;
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

  socket.on('disconnect', () => {
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

server.listen(PORT, () => console.log(`✨ LustryChat en ligne sur http://localhost:${PORT}`));
