// The Paradise — serveur principal (Express + Socket.io)
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const fs = require('fs');
const { db, dataDir, getSettings, setSetting, log } = require('./db');
const envText = v => String(v || '').trim().replace(/^(["'])(.*)\1$/, '$2').trim(); // tolère les espaces et guillemets autour
const uploadDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const PORT = process.env.PORT || 3000;
const COOKIE = 'lc_session';
const ROLES = ['user', 'moderator', 'admin', 'superadmin'];
const rank = u => ROLES.indexOf(u?.role);
const GENDERS = ['h', 'f', 'x'];
// Couleur du pseudo par défaut selon le genre : bleu (homme), rose (femme), violet (autre)
const GENDER_COLORS = { h: '#4fb3ff', f: '#ff5fa2', x: '#a78bfa' };
const genderColor = g => GENDER_COLORS[g] || GENDER_COLORS.x;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Les images de profil ont droit à une taille plus grande que le reste
const bigJson = express.json({ limit: '3mb' });
const smallJson = express.json({ limit: '50kb' });
const isUpload = p => p.startsWith('/api/me/image/') || p === '/api/audio' || /^\/api\/rooms\/\d+\/background$/.test(p);
const hugeJson = express.json({ limit: '40mb' });
app.use((req, res, next) => (req.path === '/api/admin/backup/import' ? hugeJson : isUpload(req.path) ? bigJson : smallJson)(req, res, next));
app.use('/uploads', express.static(uploadDir, { maxAge: '7d', setHeaders: r => r.setHeader('X-Content-Type-Options', 'nosniff') }));
app.set('trust proxy', true); // vraie adresse IP derrière l'hébergeur (Render…)
app.use(cookieParser());
// Identifiant d'appareil (sert à limiter le nombre de comptes par personne)
app.use((req, res, next) => {
  if (!/^[a-f0-9]{32}$/.test(req.cookies.lc_dev || '')) {
    req.cookies.lc_dev = crypto.randomBytes(16).toString('hex');
    res.cookie('lc_dev', req.cookies.lc_dev, { httpOnly: true, sameSite: 'lax', maxAge: 2 * 365 * 24 * 3600 * 1000 });
  }
  next();
});
// Le navigateur redemande toujours si les pages, scripts et styles ont changé : une mise à jour est vue tout de suite
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  setHeaders: (res, file) => { if (/\.(html|js|css)$/.test(file)) res.setHeader('Cache-Control', 'no-cache'); },
}));
// Version du site : change à chaque mise en ligne (Render donne le numéro du commit)
const BUILD = process.env.RENDER_GIT_COMMIT || String(Date.now());
app.get('/api/version', (req, res) => res.json({ build: BUILD }));
// Lecteur vidéo HLS pour le salon TV (servi depuis le paquet npm, pas de CDN)
app.get('/vendor/hls.min.js', (req, res) => res.sendFile(path.join(__dirname, 'node_modules', 'hls.js', 'dist', 'hls.min.js'), { maxAge: '7d' }));

// ---------- Utilitaires ----------
const now = () => Date.now();
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
// Comme clean() mais garde les retours à la ligne (3 lignes vides max d'affilée)
const cleanMultiline = (s, max) => String(s ?? '').replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const USERNAME_RE = /^[\p{L}\p{N}_\-]{3,20}$/u;

const parseJSON = (v, d) => { try { const x = JSON.parse(v); return x ?? d; } catch (e) { return d; } };
const NAME_EFFECTS = ['none', 'gradient', 'glow', 'rainbow', 'gold'];
const FRAMES = ['none', 'neon', 'gold', 'rainbow', 'fire', 'ice'];
const BANNER_STYLES = ['aurora', 'sunset', 'ocean', 'neon', 'forest', 'midnight', 'candy', 'lava'];
const SOCIALS = ['discord', 'twitch', 'instagram', 'tiktok', 'youtube', 'steam', 'psn', 'xbox'];

// ---------- Dates (heure de Paris) & anniversaires ----------
function parisToday() {
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(new Date());
  const g = t => parseInt(p.find(x => x.type === t).value, 10);
  return { d: g('day'), m: g('month'), y: g('year') };
}
function isBirthday(u) {
  if (!u || !u.birth_day || !u.birth_month || u.show_birthday === 0) return false;
  const t = parisToday();
  if (u.birth_day === t.d && u.birth_month === t.m) return true;
  // né un 29 février : on fête le 28 les années non bissextiles
  const leap = (t.y % 4 === 0 && t.y % 100 !== 0) || t.y % 400 === 0;
  return u.birth_day === 29 && u.birth_month === 2 && !leap && t.d === 28 && t.m === 2;
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, gender: u.gender,
    age: u.show_age === 0 ? null : u.age, city: u.show_city === 0 ? '' : u.city,
    bio: u.bio, color: u.color, role: u.role, isGuest: !!u.is_guest, createdAt: u.created_at,
    avatar: u.avatar || '', banner: u.banner || '', bannerStyle: u.banner_style || 'aurora', accent: u.accent || '#ff5fa2',
    nameEffect: u.name_effect || 'none', frame: u.avatar_frame || 'none',
    statusEmoji: u.status_emoji || '', statusText: u.status_text || '',
    interests: parseJSON(u.interests, []), games: parseJSON(u.games, []), socials: parseJSON(u.socials, {}),
    birthday: u.birth_day && u.birth_month && u.show_birthday !== 0 ? { day: u.birth_day, month: u.birth_month } : null,
    verified: isVerified(u),
    validated: customsOn() && isVerified(u), // badge ✓ « Validé » à côté de la photo
    modLevel: u.role === 'moderator' ? modLevel(u) : 0,
    voiceOk: !!u.voice_ok || isStaff(u), camOk: !!u.cam_ok || isStaff(u), // badges de la douane 🎙️ 📷
    photoOk: !!u.avatar && !!u.avatar_ok, // badge V : photo de profil vérifiée par le staff
    refused: !!u.refused && !isVerified(u),
    isBirthday: isBirthday(u),
  };
}
// Ce que la personne voit d'elle-même (âge et ville même s'ils sont cachés aux autres)
function selfUser(u) {
  return { ...publicUser(u), age: u.age, city: u.city, showAge: u.show_age !== 0, showCity: u.show_city !== 0,
    birthDay: u.birth_day || 0, birthMonth: u.birth_month || 0, showBirthday: u.show_birthday !== 0, mutedUntil: u.muted_until > Date.now() ? u.muted_until : 0, avatarPending: u.avatar_pending || '' };
}
function adminUser(u) {
  const linked = u.is_guest ? 0 : db.prepare("SELECT COUNT(*) c FROM users WHERE id<>? AND is_guest=0 AND ((device_id<>'' AND device_id=?) OR (signup_ip<>'' AND signup_ip=?))").get(u.id, u.device_id || '', u.signup_ip || '').c;
  return { ...selfUser(u), banned: !!banBlock(u), banUntil: u.ban_until || 0, banKind: u.ban_kind || 'ban', banReason: u.ban_reason, mutedUntil: u.muted_until, lastSeen: u.last_seen, linkedAccounts: linked };
}
// Mini-profil pour les messages, le vocal…
const miniUser = u => ({ modLevel: u.role === 'moderator' ? modLevel(u) : 0, avatar: u.avatar || '', nameEffect: u.name_effect || 'none', frame: u.avatar_frame || 'none', isBirthday: isBirthday(u), validated: customsOn() && isVerified(u) });

// Fichiers d'images de profil
function removeUpload(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  fs.unlink(path.join(uploadDir, path.basename(url)), () => {});
}
function deleteUserRecord(u) {
  if (!u) return;
  removeUpload(u.avatar);
  removeUpload(u.avatar_pending);
  removeUpload(u.banner);
  db.prepare('DELETE FROM users WHERE id=?').run(u.id);
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

// ---------- ModoBot : grossièretés et insultes ----------
const ModBot = require('./modbot');
let modIndex = null, modIndexKey = null;
function modScan(text) {
  const st = getSettings();
  const key = (st.bannedWords || '') + '|' + st.modBotEnabled;
  if (key !== modIndexKey) {
    const extra = (st.bannedWords || '').split(',').map(w => w.trim()).filter(Boolean);
    // ModoBot coupé : seuls les mots interdits choisis par l'admin sont masqués
    modIndex = st.modBotEnabled === '0' ? { map: new Map(extra.map(w => [ModBot.norm(w), 1])), phrases: [] } : ModBot.buildIndex(extra);
    modIndexKey = key;
  }
  return ModBot.scan(modIndex, text);
}
function filterWords(text) { return modScan(text).text; }

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
// ---------- Niveaux de modérateur ----------
// Chaque niveau a ses durées fixes (en minutes) ; 0 pour l'expulsion = la personne peut revenir tout de suite
const MOD_LEVELS = {
  1: { label: 'Modérateur 1', color: '#7cc8ff', kick: 0, exclusion: 24 * 60, ban: 7 * 24 * 60 },
  2: { label: 'Modérateur 2', color: '#2457c5', kick: 60, exclusion: 48 * 60, ban: 30 * 24 * 60 },
  3: { label: 'Modérateur 3', color: '#ff8a1f', kick: 7 * 24 * 60, exclusion: 72 * 60, ban: 365 * 24 * 60 },
};
const modLevel = u => Math.min(3, Math.max(1, parseInt(u?.mod_level, 10) || 1));
const SANCTION_FR = { kick: 'expulsé', exclusion: 'exclu', ban: 'banni' };
// Sanction en cours (expulsion avec délai, exclusion ou bannissement) ; levée toute seule quand le délai est passé
function banBlock(u) {
  if (!u || !u.banned) return null;
  if (u.ban_until && u.ban_until <= Date.now()) {
    db.prepare("UPDATE users SET banned=0, ban_until=0, ban_reason='' WHERE id=?").run(u.id);
    u.banned = 0;
    return null;
  }
  const word = SANCTION_FR[u.ban_kind] || 'banni';
  const until = u.ban_until ? ` jusqu'au ${new Date(u.ban_until).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}` : ' définitivement';
  return `Tu es ${word}${until}${u.ban_reason ? ' : ' + u.ban_reason : ''}`;
}

function auth(req, res, next) {
  const u = userFromToken(req.cookies[COOKIE]);
  if (!u) return res.status(401).json({ error: 'Non connecté' });
  const block = banBlock(u);
  if (block) return res.status(403).json({ error: block });
  req.user = u;
  next();
}
// requireRole('admin') laisse aussi passer les rôles au-dessus (super-admin)
const requireRole = (...roles) => (req, res, next) =>
  rank(req.user) >= Math.min(...roles.map(r => ROLES.indexOf(r))) ? next() : res.status(403).json({ error: 'Accès refusé' });
const isStaff = u => !!u && rank(u) >= 1;
const isAdminRole = u => !!u && rank(u) >= 2;
const isSuper = u => !!u && u.role === 'superadmin';

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
  if (isPanelName(username)) return res.status(409).json({ error: 'Ce pseudo est réservé' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum' });
  const err = validateProfile(req.body);
  if (err) return res.status(400).json({ error: err });
  const existing = getUserByName(username);
  if (existing && (banBlock(existing) || !(existing.is_guest && !online.has(existing.id)))) return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
  if (existing) deleteUserRecord(existing);

  const maxAccounts = parseInt(getSettings().maxAccounts, 10) || 0;
  if (maxAccounts > 0) {
    const already = db.prepare("SELECT COUNT(*) c FROM users WHERE is_guest=0 AND ((device_id<>'' AND device_id=?) OR (signup_ip<>'' AND signup_ip=?))").get(req.cookies.lc_dev, req.ip).c;
    if (already >= maxAccounts) log(null, 'account_limit', `Inscription refusée pour « ${username} » : ${already} compte(s) déjà créé(s) depuis cet appareil ou cette connexion`, { ip: req.ip });
    if (already >= maxAccounts) return res.status(403).json({ error: `Tu as déjà ${already} compte(s) sur ${getSettings().siteName} : ${maxAccounts} maximum par personne. Connecte-toi avec un de tes comptes.` });
  }
  const isFirst = db.prepare('SELECT COUNT(*) c FROM users WHERE is_guest=0').get().c === 0;
  const role = isFirst || (process.env.ADMIN_USER && process.env.ADMIN_USER.toLowerCase() === username.toLowerCase()) ? 'superadmin' : 'user';
  const info = db.prepare(`INSERT INTO users (username,password_hash,gender,age,city,color,role,created_at,last_seen,device_id,signup_ip)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    username, bcrypt.hashSync(password, 10), req.body.gender, parseInt(req.body.age, 10),
    clean(req.body.city, 40), genderColor(req.body.gender), role, now(), now(), req.cookies.lc_dev, req.ip || '');
  if (!customsOn()) db.prepare('UPDATE users SET verified=1 WHERE id=?').run(info.lastInsertRowid);
  createSession(res, info.lastInsertRowid);
  log(getUser(info.lastInsertRowid), 'register', `Inscription (${req.body.gender === 'f' ? 'Femme' : req.body.gender === 'h' ? 'Homme' : 'Autre'}, ${parseInt(req.body.age, 10)} ans${req.body.city ? ', ' + clean(req.body.city, 40) : ''})`, { ip: req.ip });
  if (role === 'superadmin') log(null, 'admin_auto', `${username} est devenu super-administrateur`);
  res.json({ user: publicUser(getUser(info.lastInsertRowid)) });
});

app.post('/api/login', (req, res) => {
  // « admin » + mot de passe de l'espace admin marche aussi depuis le formulaire de connexion normal
  if (isPanelName(req.body.username)) return panelLogin(req, res);
  if (tooMany('login:' + req.ip, 15)) return res.status(429).json({ error: 'Trop de tentatives, réessaie dans quelques minutes' });
  const u = getUserByName(clean(req.body.username, 20));
  if (!u || u.is_guest || u.panel || !bcrypt.compareSync(String(req.body.password || ''), u.password_hash || '')) {
    if (u && !u.is_guest) log(u, 'login', 'Échec de connexion (mauvais mot de passe)', { ip: req.ip });
    return res.status(401).json({ error: 'Pseudo ou mot de passe incorrect' });
  }
  const block = banBlock(u);
  if (block) return res.status(403).json({ error: block });
  // Le pseudo indiqué dans ADMIN_USER (réglage du serveur) redevient super-admin à la connexion
  if (process.env.ADMIN_USER && process.env.ADMIN_USER.toLowerCase() === u.username.toLowerCase() && u.role !== 'superadmin') {
    db.prepare("UPDATE users SET role='superadmin', verified=1 WHERE id=?").run(u.id);
    log(u, 'admin_auto', `${u.username} est redevenu super-administrateur (ADMIN_USER)`);
  }
  createSession(res, u.id);
  log(u, 'login', 'Connexion', { ip: req.ip });
  res.json({ user: publicUser(u) });
});

app.post('/api/guest', (req, res) => {
  const s = getSettings();
  if (s.guestsAllowed !== '1') return res.status(403).json({ error: "L'accès invité est désactivé, inscris-toi !" });
  if (tooMany('guest:' + req.ip, 20)) return res.status(429).json({ error: 'Trop de tentatives, réessaie plus tard' });
  const username = clean(req.body.username, 20);
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Pseudo : 3 à 20 caractères (lettres, chiffres, _ ou -)' });
  if (isPanelName(username)) return res.status(409).json({ error: 'Ce pseudo est réservé' });
  const err = validateProfile(req.body);
  if (err) return res.status(400).json({ error: err });
  const existing = getUserByName(username);
  if (existing) {
    if (!existing.is_guest) return res.status(409).json({ error: 'Ce pseudo appartient à un membre inscrit' });
    if (online.has(existing.id)) return res.status(409).json({ error: 'Ce pseudo est déjà utilisé en ce moment' });
    if (banBlock(existing)) return res.status(403).json({ error: 'Ce pseudo est sanctionné : ' + banBlock(existing).replace(/^Tu es /, '') });
    deleteUserRecord(existing);
  }
  const info = db.prepare(`INSERT INTO users (username,gender,age,city,color,is_guest,created_at,last_seen)
    VALUES (?,?,?,?,?,1,?,?)`).run(
    username, req.body.gender, parseInt(req.body.age, 10), clean(req.body.city, 40),
    genderColor(req.body.gender), now(), now());
  if (!customsOn()) db.prepare('UPDATE users SET verified=1 WHERE id=?').run(info.lastInsertRowid);
  createSession(res, info.lastInsertRowid);
  log(getUser(info.lastInsertRowid), 'guest', `Entrée en invité (${req.body.gender === 'f' ? 'Femme' : req.body.gender === 'h' ? 'Homme' : 'Autre'}, ${parseInt(req.body.age, 10)} ans)`, { ip: req.ip });
  res.json({ user: publicUser(getUser(info.lastInsertRowid)) });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies[COOKIE];
  const who = userFromToken(token);
  if (who) log(who, 'logout', 'Déconnexion', { ip: req.ip });
  if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(token);
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => res.json({ user: selfUser(req.user) }));

app.put('/api/me', auth, (req, res) => {
  const u = req.user;
  const b = req.body;
  const gender = b.gender ?? u.gender;
  const age = b.age ?? u.age;
  const err = validateProfile({ gender, age });
  if (err) return res.status(400).json({ error: err });
  const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : d);
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const list = (v, max, len) => (Array.isArray(v) ? [...new Set(v.map(x => filterWords(clean(x, len))).filter(Boolean))].slice(0, max) : null);
  let socials = parseJSON(u.socials, {});
  if (b.socials && typeof b.socials === 'object') {
    socials = {};
    for (const k of SOCIALS) {
      const h = clean(b.socials[k], 40).replace(/^@/, '');
      if (h && /^[\p{L}\p{N}_.#\-]{1,40}$/u.test(h)) socials[k] = h;
    }
  }
  let bd = u.birth_day || 0, bm = u.birth_month || 0;
  if (b.birthDay !== undefined || b.birthMonth !== undefined) {
    bd = parseInt(b.birthDay, 10) || 0; bm = parseInt(b.birthMonth, 10) || 0;
    const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][bm - 1] || 0;
    if (!bd || !bm || bd > maxDay) { bd = 0; bm = 0; }
  }
  db.prepare('UPDATE users SET birth_day=?, birth_month=?, show_birthday=? WHERE id=?').run(bd, bm,
    b.showBirthday !== undefined ? (b.showBirthday ? 1 : 0) : u.show_birthday, u.id);
  db.prepare(`UPDATE users SET gender=?, age=?, city=?, bio=?, color=?, accent=?, name_effect=?, avatar_frame=?, banner_style=?,
    status_emoji=?, status_text=?, interests=?, games=?, socials=?, show_age=?, show_city=? WHERE id=?`).run(
    gender, parseInt(age, 10),
    b.city !== undefined ? filterWords(clean(b.city, 40)) : u.city,
    b.bio !== undefined ? filterWords(cleanMultiline(b.bio, 500)) : u.bio,
    // Si la personne change de genre et garde la couleur par défaut, la couleur suit le nouveau genre
    (() => { const c = hex(b.color, u.color); return gender !== u.gender && c.toLowerCase() === genderColor(u.gender) ? genderColor(gender) : c; })(),
    hex(b.accent, u.accent || '#ff5fa2'),
    pick(b.nameEffect, NAME_EFFECTS, u.name_effect || 'none'),
    pick(b.frame, FRAMES, u.avatar_frame || 'none'),
    pick(b.bannerStyle, BANNER_STYLES, u.banner_style || 'aurora'),
    b.statusEmoji !== undefined ? clean(b.statusEmoji, 8) : u.status_emoji,
    b.statusText !== undefined ? filterWords(clean(b.statusText, 60)) : u.status_text,
    JSON.stringify(list(b.interests, 10, 24) ?? parseJSON(u.interests, [])),
    JSON.stringify(list(b.games, 8, 40) ?? parseJSON(u.games, [])),
    JSON.stringify(socials),
    b.showAge !== undefined ? (b.showAge ? 1 : 0) : u.show_age,
    b.showCity !== undefined ? (b.showCity ? 1 : 0) : u.show_city,
    u.id);
  const updated = getUser(u.id);
  refreshOnline(updated);
  celebrateBirthday(updated);
  res.json({ user: selfUser(updated) });
});

// Photo de profil et bannière (image envoyée en base64, déjà redimensionnée par le navigateur)
const IMAGE_TYPES = [
  { ext: 'jpg', test: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', test: b => b.slice(0, 4).toString('hex') === '89504e47' },
  { ext: 'gif', test: b => b.slice(0, 4).toString('ascii') === 'GIF8' },
  { ext: 'webp', test: b => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP' },
];
function saveImage(dataUrl, prefix) {
  const m = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!m) return { error: 'Image invalide' };
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 2 * 1024 * 1024) return { error: 'Image trop lourde (2 Mo maximum)' };
  const type = IMAGE_TYPES.find(t => t.test(buf));
  if (!type) return { error: 'Format accepté : JPG, PNG, GIF ou WEBP' };
  const name = `${prefix}-${crypto.randomBytes(6).toString('hex')}.${type.ext}`;
  fs.writeFileSync(path.join(uploadDir, name), buf);
  return { url: '/uploads/' + name };
}
app.post('/api/me/image/:kind', auth, (req, res) => {
  const kind = req.params.kind;
  if (!['avatar', 'banner'].includes(kind)) return res.status(400).json({ error: 'Type d\'image inconnu' });
  if (tooMany('upload:' + req.user.id, 30, 3600 * 1000)) return res.status(429).json({ error: 'Trop d\'envois, réessaie plus tard' });
  const saved = saveImage(req.body.data, `${kind}-${req.user.id}`);
  if (saved.error) return res.status(400).json({ error: saved.error });
  if (kind === 'avatar' && !isStaff(req.user)) {
    // Nouvelle photo : elle attend la vérification du staff, l'ancienne reste affichée en attendant
    removeUpload(req.user.avatar_pending);
    db.prepare('UPDATE users SET avatar_pending=? WHERE id=?').run(saved.url, req.user.id);
    log(req.user, 'profile_update', 'Nouvelle photo de profil (en attente de vérification)', { data: { image: saved.url } });
    emitToStaff('staff_alert', { text: `📸 ${req.user.username} a envoyé une nouvelle photo de profil à vérifier`, url: '/admin#photos' });
    emitToStaff('photos_pending', { count: pendingPhotos() });
    const upd = getUser(req.user.id);
    return res.json({ user: selfUser(upd), pending: true });
  }
  removeUpload(req.user[kind]);
  db.prepare(`UPDATE users SET ${kind}=?${kind === 'avatar' ? ', avatar_ok=1' : ''} WHERE id=?`).run(saved.url, req.user.id);
  log(req.user, 'profile_update', kind === 'avatar' ? 'Nouvelle photo de profil' : 'Nouvelle bannière de profil', { data: { image: saved.url } });
  const updated = getUser(req.user.id);
  refreshOnline(updated);
  res.json({ user: selfUser(updated) });
});
app.delete('/api/me/image/:kind', auth, (req, res) => {
  const kind = req.params.kind;
  if (!['avatar', 'banner'].includes(kind)) return res.status(400).json({ error: 'Type d\'image inconnu' });
  removeUpload(req.user[kind]);
  if (kind === 'avatar') { removeUpload(req.user.avatar_pending); db.prepare("UPDATE users SET avatar='', avatar_pending='', avatar_ok=0 WHERE id=?").run(req.user.id); }
  else db.prepare(`UPDATE users SET ${kind}='' WHERE id=?`).run(req.user.id);
  const updated = getUser(req.user.id);
  refreshOnline(updated);
  res.json({ user: selfUser(updated) });
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
// Contenu du site (nom, textes, couleurs, histoire, règlement) — modifiable par le super-admin
// Thèmes de fête : 'auto' = selon la date (heure de Paris)
const THEMES = ['automne-hiver', 'hiver', 'noel', 'nouvel-an', 'saint-valentin', 'paques', 'ete'];
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}
function autoTheme() {
  const { d, m, y } = parisToday();
  const md = m * 100 + d;
  if (md >= 1201 && md <= 1226) return 'noel';
  if (md >= 1227 || md <= 103) return 'nouvel-an';
  if (md >= 210 && md <= 215) return 'saint-valentin';
  const diff = (Date.UTC(y, m - 1, d) - easter(y).getTime()) / 86400000;
  if (diff >= -3 && diff <= 1) return 'paques';
  // 🍂 Automne-Hiver : feuilles et premiers flocons, du 22 septembre jusqu'à Noël
  if (md >= 922 && md <= 1130) return 'automne-hiver';
  // ❄️ Hiver : de janvier à la fin de l'hiver (20 mars)
  if (md >= 104 && md <= 320) return 'hiver';
  return '';
}
function activeTheme() {
  const mode = getSettings().theme || 'auto';
  if (mode === 'auto') return autoTheme();
  return THEMES.includes(mode) ? mode : '';
}

const SITE_KEYS = ['siteName', 'siteDomain', 'heroTitle', 'heroText', 'footerText', 'colorViolet', 'colorRose', 'colorGold', 'historyContent', 'rulesContent', 'colorRoomPerm', 'colorRoomTemp'];
function siteInfo() {
  const s = getSettings();
  const out = {};
  for (const k of SITE_KEYS) out[k] = s[k] || '';
  out.maxAccounts = parseInt(s.maxAccounts, 10) || 0;
  out.themeMode = s.theme || 'auto';
  out.theme = activeTheme();
  return out;
}
app.get('/api/site', (req, res) => res.json({ site: siteInfo() }));

// Anniversaires du jour
app.get('/api/birthdays', auth, (req, res) => {
  const t = parisToday();
  const rows = db.prepare('SELECT * FROM users WHERE is_guest=0 AND banned=0 AND show_birthday=1 AND birth_day>0').all().filter(isBirthday);
  res.json({ today: `${t.d}/${t.m}`, users: rows.map(u => ({ ...publicUser(u), online: visibleOnline(u.id, req.user) })) });
});
// Fête l'anniversaire une fois par an : notification + annonce à tout le monde
function celebrateBirthday(u) {
  if (!u || u.is_guest || !isBirthday(u)) return;
  const year = parisToday().y;
  if (u.bday_year === year) return;
  db.prepare('UPDATE users SET bday_year=? WHERE id=?').run(year, u.id);
  const site = getSettings().siteName || 'The Paradise';
  notify(u.id, { type: 'birthday', icon: '🎂', title: `Joyeux anniversaire ${u.username} ! 🎉`, text: `Toute l'équipe de ${site} te souhaite une journée magique. Profite bien de ta journée ! 🥳`, important: true });
  io.emit('birthday', { user: publicUser(u) });
  log(u, 'birthday', `🎂 Anniversaire de ${u.username} fêté sur le site`);
}

app.get('/api/stats', (req, res) => {
  res.json({
    online: [...online.values()].filter(e => !e.ghost).length,
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
// Sanction de salon en cours (levée toute seule quand sa durée est passée)
function roomBan(roomId, userId) {
  const b = db.prepare('SELECT * FROM room_bans WHERE room_id=? AND user_id=?').get(roomId, userId);
  if (b && b.until && b.until <= Date.now()) { db.prepare('DELETE FROM room_bans WHERE room_id=? AND user_id=?').run(roomId, userId); return null; }
  return b || null;
}
const isRoomBanned = (roomId, userId) => !!roomBan(roomId, userId);
// Modérateurs de salon (« modo simple », 4 par salon) : expulsion 1 h, exclusion 5 h avec motif, bannissement à vie
const ROOM_MODS_MAX = 4;
const isRoomMod = (roomId, userId) => !!db.prepare('SELECT 1 FROM room_mods WHERE room_id=? AND user_id=?').get(roomId, userId);
const roomModsOf = roomId => db.prepare('SELECT u.id, u.username FROM room_mods m JOIN users u ON u.id=m.user_id WHERE m.room_id=? ORDER BY u.username').all(roomId);
const ROOM_SANCTIONS = { expulsion: { minutes: 60, label: 'expulsé', icon: '⏱️' }, exclusion: { minutes: 300, label: 'exclu', icon: '🚪', reason: true }, ban: { minutes: 0, label: 'banni à vie', icon: '⛔' } };

function roomOut(r) {
  const owner = r.owner_id ? getUser(r.owner_id) : null;
  return {
    id: r.id, slug: r.slug, name: r.name, description: r.description, icon: r.icon, membersOnly: !!r.members_only, sort: r.sort,
    ownerId: r.owner_id || null, ownerName: owner ? owner.username : null, isPrivate: !!r.is_private,
    voiceEnabled: !!r.voice_enabled, station: stationOut(getStation(r.station_id)),
    count: roomCount(r.slug), voice: voiceList(r.slug).filter(p => !p.listener).length, background: r.background || '',
    managers: r.owner_id ? roomManagers(r.id) : [],
    mods: roomModsOf(r.id),
    temporary: !!r.temporary,
    closesAt: r.temporary && r.empty_since ? r.empty_since + tempRoomDelay() : null,
  };
}
// Peut-on entrer dans ce salon ?
// ---------- Douane : les nouveaux arrivants doivent être vérifiés par le staff ----------
const customsOn = () => getSettings().customsEnabled === '1';
// Validation de la voix et de la caméra : badge 🎙️ pour parler, badge 📷 pour la caméra
const mediaVerifyOn = () => getSettings().mediaVerify === '1';
const voiceAllowed = u => !mediaVerifyOn() || !!u?.voice_ok || isStaff(u);
const camAllowed = u => !mediaVerifyOn() || !!u?.cam_ok || isStaff(u);
const VOICE_NEEDED = '🎙️ Ta voix doit d\'abord être validée par l\'équipe : va dans le salon « Vérification » ou demande la validation. En attendant, tu peux écouter 🎧';
const CAM_NEEDED = '📷 Ta caméra doit d\'abord être validée par l\'équipe : va dans le salon « Vérification » ou demande la validation.';
const customsOpen = () => getSettings().customsOpen === '1';
const isVerified = u => !!u && (!customsOn() || !!u.verified || isStaff(u));
const NOT_VERIFIED = '🛂 Passe d\'abord par la Douane : un super-admin doit valider ta voix 🎙️ et ta caméra 📷.';
function roomAccess(user, room) {
  if (!room) return 'Salon introuvable';
  if (room.slug === 'douane' && !customsOn() && !mediaVerifyOn() && !isStaff(user)) return 'Ce salon est fermé';
  if (!isVerified(user) && room.slug !== 'douane') return NOT_VERIFIED;
  if (isStaff(user) || room.owner_id === user.id || isRoomManager(room.id, user.id)) return null;
  if (room.members_only && user.is_guest) return 'Ce salon est réservé aux membres inscrits';
  const rb = roomBan(room.id, user.id);
  if (rb) return `Tu es ${ROOM_SANCTIONS[rb.kind]?.label || 'exclu'} de ce salon${rb.until ? ' jusqu\'à ' + new Date(rb.until).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }) : ''}${rb.reason ? ' : ' + rb.reason : ''}`;
  if (room.is_private && !isRoomMember(room.id, user.id)) return 'Ce salon est fermé : seules les personnes invitées peuvent entrer';
  return null;
}
// Peut-on gérer ce salon ? (propriétaire, ou équipe ; seuls les admins gèrent les salons officiels)
// Co-gérants : personnes nommées par le propriétaire pour l'aider à gérer son salon
const isRoomManager = (roomId, userId) => !!db.prepare('SELECT 1 FROM room_managers WHERE room_id=? AND user_id=?').get(roomId, userId);
const roomManagers = roomId => db.prepare('SELECT u.id, u.username FROM room_managers m JOIN users u ON u.id=m.user_id WHERE m.room_id=? ORDER BY u.username').all(roomId);
function canManageRoom(user, room) {
  if (!room || !user) return false;
  if (room.owner_id) return room.owner_id === user.id || isStaff(user) || isRoomManager(room.id, user.id);
  return isAdminRole(user);
}
// Supprimer le salon et choisir les co-gérants : propriétaire ou équipe seulement
// Peut sanctionner dans ce salon : l'équipe du site, le propriétaire et ses co-gérants, les modérateurs du salon
function canModRoom(user, room) {
  if (!room || !user) return false;
  return isStaff(user) || canManageRoom(user, room) || isRoomMod(room.id, user.id);
}
function canOwnRoom(user, room) {
  if (!room || !user) return false;
  return room.owner_id ? room.owner_id === user.id || isStaff(user) : isAdminRole(user);
}
function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
}
const roomsChanged = () => io.emit('rooms_changed');

app.get('/api/rooms', auth, (req, res) => {
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY owner_id IS NOT NULL, sort, id').all();
  // Les salons fermés ne sont visibles que par les personnes qui peuvent y entrer
  // Pas encore validé : on ne voit que la douane
  const pending = !isVerified(req.user);
  const visible = rooms.filter(r => (r.slug === 'douane' ? customsOn() || mediaVerifyOn() || isStaff(req.user) : !pending && (!r.is_private || !roomAccess(req.user, r))));
  const s = getSettings();
  res.json({
    rooms: visible.map(roomOut),
    canCreate: s.userRoomsEnabled === '1' && !req.user.is_guest && isVerified(req.user),
    canCreateTemp: s.tempRoomsEnabled === '1' && isVerified(req.user),
    customs: { enabled: s.customsEnabled === '1', open: s.customsOpen === '1', media: s.mediaVerify === '1' },
    tempMinutes: parseInt(s.tempRoomMinutes, 10) || 5,
    maxUserRooms: parseInt(s.maxUserRooms, 10) || 0,
    voiceEnabled: s.voiceEnabled === '1',
    patchLast: patchLast(),
  });
});

app.post('/api/rooms', auth, (req, res) => {
  const s = getSettings();
  if (req.body.temporary) return createTempRoom(req, res);
  if (s.userRoomsEnabled !== '1') return res.status(403).json({ error: 'La création de salons est désactivée' });
  if (!isVerified(req.user)) return res.status(403).json({ error: NOT_VERIFIED });
  if (req.user.is_guest) return res.status(403).json({ error: 'Inscris-toi pour créer ton propre salon' });
  const max = parseInt(s.maxUserRooms, 10) || 0;
  const mine = db.prepare('SELECT COUNT(*) c FROM rooms WHERE owner_id=? AND temporary=0').get(req.user.id).c;
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

// ---------- Salons temporaires ----------
// Créés par n'importe qui (même un invité), à son pseudo ou avec un nom au choix,
// ils se ferment tout seuls quand ils restent vides quelques minutes.
const tempRoomDelay = () => (parseInt(getSettings().tempRoomMinutes, 10) || 5) * 60 * 1000;
function createTempRoom(req, res) {
  const s = getSettings();
  if (!isVerified(req.user)) return res.status(403).json({ error: NOT_VERIFIED });
  if (s.tempRoomsEnabled !== '1') return res.status(403).json({ error: 'Les salons temporaires sont désactivés' });
  const existing = db.prepare('SELECT * FROM rooms WHERE owner_id=? AND temporary=1').get(req.user.id);
  if (existing && !isStaff(req.user)) return res.status(400).json({ error: `Tu as déjà un salon temporaire ouvert : « ${existing.name} »`, room: roomOut(existing) });
  if (tooMany('troom:' + req.user.id, 8, 3600 * 1000)) return res.status(429).json({ error: 'Trop de salons créés, réessaie plus tard' });
  const name = req.body.usePseudo ? `Salon de ${req.user.username}` : filterWords(clean(req.body.name, 30));
  if (name.length < 3) return res.status(400).json({ error: 'Nom du salon : 3 caractères minimum' });
  const slug = 't-' + (slugify(name) || 'salon') + '-' + crypto.randomBytes(2).toString('hex');
  const info = db.prepare(`INSERT INTO rooms (slug,name,description,icon,sort,members_only,owner_id,is_private,created_at,temporary,empty_since)
    VALUES (?,?,?,?,200,0,?,?,?,1,?)`).run(slug, name, clean(req.body.description, 120), clean(req.body.icon, 4) || '⏳', req.user.id, req.body.isPrivate ? 1 : 0, now(), now());
  log(req.user, 'room_create', `${name} (salon temporaire)`);
  roomsChanged();
  res.json({ room: roomOut(getRoom(info.lastInsertRowid)) });
}
// Surveille les salons temporaires : vides trop longtemps → fermés
setInterval(() => {
  const delay = tempRoomDelay();
  let changed = false;
  for (const r of db.prepare('SELECT * FROM rooms WHERE temporary=1').all()) {
    const inside = io.sockets.adapter.rooms.get('room:' + r.slug)?.size || 0;
    if (inside > 0) {
      if (r.empty_since) { db.prepare('UPDATE rooms SET empty_since=NULL WHERE id=?').run(r.id); changed = true; }
    } else if (!r.empty_since) {
      db.prepare('UPDATE rooms SET empty_since=? WHERE id=?').run(now(), r.id); changed = true;
    } else if (now() - r.empty_since >= delay) {
      deleteRoom(r, null);
      changed = false;
    }
  }
  if (changed) roomsChanged();
}, 15000).unref();
// Au démarrage, les salons temporaires repartent avec un délai neuf
db.prepare('UPDATE rooms SET empty_since=? WHERE temporary=1').run(now());

app.patch('/api/rooms/:id', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!canManageRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne gères pas ce salon' });
  const b = req.body;
  const name = b.name !== undefined ? clean(b.name, 30) : room.name;
  if (name.length < 2) return res.status(400).json({ error: 'Nom trop court' });
  let stationId = room.station_id;
  if (b.stationId !== undefined) stationId = b.stationId ? (getStation(b.stationId) ? parseInt(b.stationId, 10) : room.station_id) : null;
  if (b.backgroundPreset !== undefined) {
    const key = String(b.backgroundPreset);
    if (key && !BG_PRESETS.includes(key)) return res.status(400).json({ error: 'Fond animé inconnu' });
    removeUpload(room.background);
    db.prepare('UPDATE rooms SET background=? WHERE id=?').run(key ? 'preset:' + key : '', room.id);
    if (key) log(req.user, 'room_background', `Fond animé « ${key} » pour le salon ${room.name}`);
  }
  db.prepare('UPDATE rooms SET name=?,description=?,icon=?,is_private=?,station_id=?,voice_enabled=? WHERE id=?').run(
    name,
    b.description !== undefined ? clean(b.description, 120) : room.description,
    b.icon !== undefined ? (clean(b.icon, 4) || '🏠') : room.icon,
    b.isPrivate !== undefined ? (b.isPrivate ? 1 : 0) : room.is_private,
    stationId,
    b.voiceEnabled !== undefined ? (b.voiceEnabled ? 1 : 0) : room.voice_enabled,
    room.id);
  const updated = getRoom(room.id);
  if (!!updated.is_private !== !!room.is_private) log(req.user, 'room_private', `Salon ${updated.name} ${updated.is_private ? 'fermé (sur invitation)' : 'ouvert à tous'}`);
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
  if (!canOwnRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne gères pas ce salon' });
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
  log(req.user, 'room_invite', `${target.username} invité dans le salon ${room.name}`);
  notify(target.id, { type: 'room_invite', icon: '🎟️', title: `Invitation dans « ${room.name} »`, text: `${req.user.username} t'a invité dans son salon.`, data: { slug: room.slug } });
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
  if (isRoomManager(room.id, target.id) && !canOwnRoom(req.user, room)) return res.status(403).json({ error: 'Seul le propriétaire peut exclure un co-gérant' });
  if (rank(target) >= rank(req.user) && !isSuper(req.user)) return res.status(403).json({ error: 'Impossible d\'exclure un membre de l\'équipe' });
  db.prepare('DELETE FROM room_members WHERE room_id=? AND user_id=?').run(room.id, target.id);
  db.prepare('INSERT OR IGNORE INTO room_bans (room_id,user_id) VALUES (?,?)').run(room.id, target.id);
  const reason = clean(req.body.reason, 200);
  const byName = displayName(req.user);
  log(req.user, 'room_kick', `${target.username} exclu du salon ${room.name}${reason ? ' : ' + reason : ''}`);
  notify(target.id, { type: 'room_kick', icon: '🚪', title: `Tu as été exclu du salon « ${room.name} »`, text: `Par ${byName}. ${reasonText(reason)} Tu ne peux plus y revenir sauf s'il te réinvite.`, important: true });
  ejectFromRoom(target.id, room.slug, `Tu as été exclu du salon ${room.name}`);
  io.to('room:' + room.slug).emit('system', { room: room.slug, text: `${target.username} a été exclu du salon par ${byName}` });
  roomsChanged();
  res.json({ ok: true });
});
app.delete('/api/rooms/:id/bans/:userId', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!canModRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne gères pas ce salon' });
  const t = getUser(req.params.userId);
  db.prepare('DELETE FROM room_bans WHERE room_id=? AND user_id=?').run(room.id, req.params.userId);
  if (t) {
    log(req.user, 'room_unban', `${t.username} débanni du salon ${room.name}`);
    notify(t.id, { type: 'room_unban', icon: '✅', title: `Tu peux revenir dans « ${room.name} »`, text: `${displayName(req.user)} a levé ta sanction.`, data: { slug: room.slug } });
  }
  roomsChanged();
  res.json({ ok: true });
});

// ---------- Modération des salons (modo simple) ----------
// Liste des personnes sanctionnées dans le salon
app.get('/api/rooms/:id/bans', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!canModRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne modères pas ce salon' });
  const rows = db.prepare('SELECT b.*, u.username, u.color, u.avatar FROM room_bans b JOIN users u ON u.id=b.user_id WHERE b.room_id=? ORDER BY b.created_at DESC').all(room.id)
    .filter(b => !(b.until && b.until <= now()));
  res.json({ bans: rows.map(b => ({ userId: b.user_id, username: b.username, color: b.color, avatar: b.avatar, kind: b.kind, until: b.until, reason: b.reason, by: b.by_name, at: b.created_at })) });
});
// Expulsion 1 h · exclusion 5 h avec motif · bannissement à vie
app.post('/api/rooms/:id/sanction', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!canModRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne modères pas ce salon' });
  const kind = String(req.body.kind || '');
  const S = ROOM_SANCTIONS[kind];
  if (!S) return res.status(400).json({ error: 'Sanction inconnue' });
  const target = getUser(parseInt(req.body.userId, 10));
  if (!target || target.id === req.user.id) return res.status(400).json({ error: 'Impossible de sanctionner cette personne' });
  if (target.id === room.owner_id) return res.status(403).json({ error: 'C\'est le propriétaire du salon' });
  if (isStaff(target) && !isSuper(req.user)) return res.status(403).json({ error: 'Impossible de sanctionner un membre de l\'équipe du site' });
  const iAmManager = isStaff(req.user) || canManageRoom(req.user, room);
  if (!iAmManager && (isRoomMod(room.id, target.id) || isRoomManager(room.id, target.id))) return res.status(403).json({ error: 'Un modérateur ne peut pas sanctionner un autre modérateur du salon' });
  const reason = clean(req.body.reason, 200);
  if (S.reason && reason.length < 3) return res.status(400).json({ error: 'Indique le motif de l\'exclusion' });
  const until = S.minutes ? now() + S.minutes * 60000 : 0;
  const by = displayName(req.user);
  db.prepare('DELETE FROM room_members WHERE room_id=? AND user_id=?').run(room.id, target.id);
  db.prepare('INSERT OR REPLACE INTO room_bans (room_id, user_id, until, reason, kind, by_name, created_at) VALUES (?,?,?,?,?,?,?)').run(room.id, target.id, until, reason, kind, by, now());
  const dur = S.minutes ? (S.minutes >= 60 ? S.minutes / 60 + ' h' : S.minutes + ' min') : 'à vie';
  log(req.user, 'room_kick', `${target.username} ${S.label}${S.minutes ? ' ' + dur : ''} du salon ${room.name}${reason ? ' : ' + reason : ''}`);
  notify(target.id, { type: 'room_kick', icon: S.icon, title: `Tu as été ${S.label}${S.minutes ? ' ' + dur : ''} du salon « ${room.name} »`, text: `Par ${by}. ${reasonText(reason)}${until ? ' Tu pourras revenir à ' + new Date(until).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }) + '.' : ''}`, important: true });
  ejectFromRoom(target.id, room.slug, `Tu as été ${S.label}${S.minutes ? ' ' + dur : ''} du salon ${room.name}${reason ? ' : ' + reason : ''}`);
  io.to('room:' + room.slug).emit('system', { room: room.slug, text: `${S.icon} ${target.username} a été ${S.label}${S.minutes ? ' ' + dur : ''} du salon par ${by}${reason ? ' (' + reason + ')' : ''}` });
  roomsChanged();
  res.json({ ok: true });
});
// Nommer / retirer les modérateurs du salon (4 maximum)
app.post('/api/rooms/:id/mods', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Salon introuvable' });
  if (!canOwnRoom(req.user, room)) return res.status(403).json({ error: room.owner_id ? 'Seul le propriétaire du salon peut nommer ses modérateurs' : 'Seuls les admins nomment les modérateurs des salons officiels' });
  const target = req.body.userId ? getUser(req.body.userId) : getUserByName(clean(req.body.username, 20));
  if (!target) return res.status(404).json({ error: 'Pseudo introuvable' });
  if (target.is_guest) return res.status(400).json({ error: 'Un invité ne peut pas être modérateur (il doit s\'inscrire)' });
  if (target.id === room.owner_id) return res.status(400).json({ error: 'C\'est le propriétaire du salon' });
  if (!isRoomMod(room.id, target.id) && roomModsOf(room.id).length >= ROOM_MODS_MAX) return res.status(400).json({ error: `${ROOM_MODS_MAX} modérateurs maximum par salon` });
  db.prepare('INSERT OR IGNORE INTO room_mods (room_id, user_id, created_at) VALUES (?,?,?)').run(room.id, target.id, now());
  db.prepare('DELETE FROM room_bans WHERE room_id=? AND user_id=?').run(room.id, target.id);
  log(req.user, 'room_edit', `${target.username} nommé modérateur du salon ${room.name}`);
  notify(target.id, { type: 'role', icon: '🤍', title: `Tu es modérateur du salon « ${room.name} »`, text: 'Clic droit (ou appui long) sur un pseudo dans ce salon : expulsion 1 h, exclusion 5 h avec motif, bannissement à vie, débannissement.', data: { slug: room.slug } });
  roomsChanged();
  res.json({ mods: roomModsOf(room.id) });
});
app.delete('/api/rooms/:id/mods/:userId', auth, (req, res) => {
  const room = getRoom(req.params.id);
  const uid2 = parseInt(req.params.userId, 10);
  if (!room) return res.status(404).json({ error: 'Salon introuvable' });
  if (!canOwnRoom(req.user, room) && req.user.id !== uid2) return res.status(403).json({ error: 'Action non autorisée' });
  db.prepare('DELETE FROM room_mods WHERE room_id=? AND user_id=?').run(room.id, uid2);
  roomsChanged();
  res.json({ mods: roomModsOf(room.id) });
});

// Fond d'écran d'un salon (propriétaire ou équipe)
const BG_PRESETS = ['aurore', 'etoiles', 'galaxie', 'vagues', 'bulles', 'pluie', 'coucher', 'feu'];
// GIF animé ou vidéo (MP4 / WebM) envoyé tel quel, sans conversion
const VIDEO_TYPES = [
  { ext: 'mp4', test: b => b.slice(4, 8).toString('ascii') === 'ftyp' },
  { ext: 'webm', test: b => b.slice(0, 4).toString('hex') === '1a45dfa3' },
];
app.post('/api/rooms/:id/background/file', auth, express.raw({ type: () => true, limit: '12mb' }), (req, res) => {
  const room = getRoom(req.params.id);
  if (!canManageRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne gères pas ce salon' });
  if (tooMany('upload:' + req.user.id, 30, 3600 * 1000)) return res.status(429).json({ error: 'Trop d\'envois, réessaie plus tard' });
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length < 100) return res.status(400).json({ error: 'Fichier vide' });
  const img = IMAGE_TYPES.find(t => t.test(buf));
  const vid = !img && VIDEO_TYPES.find(t => t.test(buf));
  if (!img && !vid) return res.status(400).json({ error: 'Formats acceptés : GIF, JPG, PNG, WEBP, MP4 ou WebM' });
  if (img && buf.length > 6 * 1024 * 1024) return res.status(400).json({ error: 'Image trop lourde (6 Mo maximum)' });
  const name = `room-${room.id}-${crypto.randomBytes(6).toString('hex')}.${(img || vid).ext}`;
  fs.writeFileSync(path.join(uploadDir, name), buf);
  removeUpload(room.background);
  db.prepare('UPDATE rooms SET background=? WHERE id=?').run('/uploads/' + name, room.id);
  log(req.user, 'room_background', `Nouveau fond ${vid ? 'vidéo' : img.ext === 'gif' ? 'animé (GIF)' : 'd\'écran'} pour le salon ${room.name}`, { data: { image: img ? '/uploads/' + name : '' } });
  roomsChanged();
  res.json({ room: roomOut(getRoom(room.id)) });
});
app.post('/api/rooms/:id/background', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!canManageRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne gères pas ce salon' });
  if (tooMany('upload:' + req.user.id, 30, 3600 * 1000)) return res.status(429).json({ error: 'Trop d\'envois, réessaie plus tard' });
  const saved = saveImage(req.body.data, `room-${room.id}`);
  if (saved.error) return res.status(400).json({ error: saved.error });
  removeUpload(room.background);
  db.prepare('UPDATE rooms SET background=? WHERE id=?').run(saved.url, room.id);
  log(req.user, 'room_background', `Nouveau fond d'écran pour le salon ${room.name}`, { data: { image: saved.url } });
  roomsChanged();
  res.json({ room: roomOut(getRoom(room.id)) });
});
app.delete('/api/rooms/:id/background', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!canManageRoom(req.user, room)) return res.status(403).json({ error: 'Tu ne gères pas ce salon' });
  removeUpload(room.background);
  db.prepare("UPDATE rooms SET background='' WHERE id=?").run(room.id);
  roomsChanged();
  res.json({ room: roomOut(getRoom(room.id)) });
});

app.post('/api/rooms/:id/managers', auth, (req, res) => {
  const room = getRoom(req.params.id);
  if (!room || !room.owner_id) return res.status(400).json({ error: 'Les co-gérants existent seulement pour les salons de membres' });
  if (!canOwnRoom(req.user, room)) return res.status(403).json({ error: 'Seul le propriétaire du salon peut nommer des co-gérants' });
  const target = req.body.userId ? getUser(req.body.userId) : getUserByName(clean(req.body.username, 20));
  if (!target) return res.status(404).json({ error: 'Pseudo introuvable' });
  if (target.id === room.owner_id) return res.status(400).json({ error: 'C\'est déjà le propriétaire' });
  if (target.is_guest) return res.status(400).json({ error: 'Un invité ne peut pas être co-gérant (il doit s\'inscrire)' });
  if (roomManagers(room.id).length >= 10) return res.status(400).json({ error: '10 co-gérants maximum' });
  db.prepare('INSERT OR IGNORE INTO room_managers (room_id,user_id) VALUES (?,?)').run(room.id, target.id);
  db.prepare('INSERT OR IGNORE INTO room_members (room_id,user_id) VALUES (?,?)').run(room.id, target.id);
  db.prepare('DELETE FROM room_bans WHERE room_id=? AND user_id=?').run(room.id, target.id);
  log(req.user, 'room_edit', `${target.username} nommé co-gérant du salon ${room.name}`);
  notify(target.id, { type: 'room_invite', icon: '👑', title: `Tu es co-gérant de « ${room.name} »`, text: `${req.user.username} t'a confié la gestion de son salon : tu peux le modifier avec le bouton ⚙️.`, data: { slug: room.slug } });
  roomsChanged();
  res.json({ managers: roomManagers(room.id) });
});
app.delete('/api/rooms/:id/managers/:userId', auth, (req, res) => {
  const room = getRoom(req.params.id);
  const uid2 = parseInt(req.params.userId, 10);
  // Le propriétaire retire qui il veut ; un co-gérant peut se retirer lui-même
  if (!canOwnRoom(req.user, room) && req.user.id !== uid2) return res.status(403).json({ error: 'Seul le propriétaire du salon peut retirer un co-gérant' });
  db.prepare('DELETE FROM room_managers WHERE room_id=? AND user_id=?').run(room.id, uid2);
  roomsChanged();
  res.json({ managers: roomManagers(room.id) });
});

function deleteRoom(room, actor) {
  removeUpload(room.background);
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
// Les radios en panne sont masquées pour les utilisateurs
app.get('/api/stations', auth, (req, res) => {
  res.json({ stations: db.prepare("SELECT * FROM stations WHERE status<>'broken' ORDER BY sort, id").all().map(stationOut) });
});

// ---------- Vérification automatique des radios ----------
// Teste un flux : il doit répondre et envoyer de l'audio lisible par un navigateur
async function testStream(url) {
  if (!/^https:\/\//i.test(url)) return { ok: false, note: 'Lien non sécurisé (http) : bloqué par les navigateurs sur un site en https' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (radio-check)', 'Icy-MetaData': '0' } });
    const type = (r.headers.get('content-type') || '').toLowerCase();
    if (!r.ok) return { ok: false, note: `Le serveur répond ${r.status}` };
    if (/mpegurl|m3u|pls|text\/html/.test(type)) return { ok: false, note: `Format non lisible directement (${type || 'inconnu'})` };
    const reader = r.body.getReader();
    let got = 0;
    while (got < 4096) { const { value, done } = await reader.read(); if (done) break; got += value.length; }
    ctrl.abort();
    if (got < 1024) return { ok: false, note: 'Aucun son reçu' };
    return { ok: true, note: type || 'audio' };
  } catch (e) {
    return { ok: false, note: e.name === 'AbortError' ? 'Pas de réponse (délai dépassé)' : 'Injoignable : ' + (e.cause?.code || e.message) };
  } finally { clearTimeout(timer); }
}
// Cherche un lien de remplacement sur l'annuaire libre radio-browser.info
async function findReplacement(name) {
  const norm = x => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const target = norm(name);
  for (const host of ['de1.api.radio-browser.info', 'nl1.api.radio-browser.info', 'at1.api.radio-browser.info']) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(`https://${host}/json/stations/search?name=${encodeURIComponent(name)}&countrycode=FR&hidebroken=true&order=clickcount&reverse=true&limit=15`,
        { signal: ctrl.signal, headers: { 'User-Agent': 'ParadisChat/1.0' } });
      clearTimeout(t);
      if (!r.ok) continue;
      const list = await r.json();
      const candidates = list.filter(x => norm(x.name).startsWith(target) || norm(x.name) === target)
        .map(x => x.url_resolved || x.url).filter(u => /^https:\/\//i.test(u));
      for (const url of [...new Set(candidates)].slice(0, 6)) {
        const t2 = await testStream(url);
        if (t2.ok) return url;
      }
      return null;
    } catch (e) { /* on essaie le serveur suivant */ }
  }
  return null;
}
let checking = false;
async function checkStations({ repair = true, actor = null, ids = null } = {}) {
  if (checking) return { busy: true };
  checking = true;
  const report = { ok: 0, repaired: [], broken: [] };
  try {
    const list = db.prepare('SELECT * FROM stations ORDER BY sort, id').all().filter(st => !ids || ids.includes(st.id));
    for (const st of list) {
      let res = await testStream(st.url);
      let url = st.url;
      if (!res.ok && repair) {
        const alt = await findReplacement(st.name);
        if (alt && alt !== st.url) { url = alt; res = { ok: true, note: 'Lien réparé automatiquement' }; report.repaired.push(st.name); }
      }
      if (res.ok && url === st.url) report.ok++;
      if (!res.ok) report.broken.push(st.name);
      db.prepare('UPDATE stations SET url=?, status=?, checked_at=?, check_note=? WHERE id=?').run(url, res.ok ? 'ok' : 'broken', now(), res.note, st.id);
    }
    db.prepare("UPDATE rooms SET station_id=NULL WHERE station_id IN (SELECT id FROM stations WHERE status='broken')").run();
    log(actor, 'stations_check', `${report.ok} OK, ${report.repaired.length} réparée(s), ${report.broken.length} en panne (masquée(s))`);
    io.emit('stations_changed');
    roomsChanged();
  } finally { checking = false; }
  return report;
}
// Vérification au démarrage puis toutes les 6 heures (désactivable avec RADIO_CHECK=0)
if (process.env.RADIO_CHECK !== '0') {
  setTimeout(() => checkStations().catch(() => {}), 15000).unref();
  setInterval(() => checkStations().catch(() => {}), 6 * 3600 * 1000).unref();
}
// Serveurs pour la connexion du vocal et des appels.
// STUN suffit quand les deux réseaux sont « ouverts » ; sinon (4G, box, entreprise) il faut un relais TURN :
//  - TURN_URL / TURN_USER / TURN_PASS : ton propre serveur (installé automatiquement sur un VPS IONOS)
//  - CF_TURN_KEY_ID / CF_TURN_API_TOKEN : TURN de Cloudflare (gratuit jusqu'à un gros volume)
//  - METERED_DOMAIN / METERED_API_KEY : TURN de Metered (offre gratuite)
// Lecture tolérante des réglages : espaces, minuscules, tirets ou guillemets autour ne gênent pas
const envKey = k => String(k).trim().toUpperCase().replace(/[\s-]+/g, '_');
function envGet(name) {
  if (process.env[name]) return envText(process.env[name]);
  for (const [k, v] of Object.entries(process.env)) if (envKey(k) === name && v) return envText(v);
  return '';
}
const turnEnv = () => ({
  url: envGet('TURN_URL'), user: envGet('TURN_USER'), pass: envGet('TURN_PASS'),
  cfId: envGet('CF_TURN_KEY_ID'), cfToken: envGet('CF_TURN_API_TOKEN'),
  mDomain: envGet('METERED_DOMAIN'), mKey: envGet('METERED_API_KEY'),
});
let turnCache = { at: 0, servers: [] };
let turnCheck = { at: 0, ok: null, error: '' }; // dernier essai auprès du relais (pour le diagnostic admin)
async function remoteTurn(force = false) {
  if (!force && now() - turnCache.at < 3600 * 1000) return turnCache.servers;
  const t = turnEnv();
  let servers = [], error = '';
  try {
    if (t.cfId && t.cfToken) {
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(t.cfId)}/credentials/generate-ice-servers`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + t.cfToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: 86400 }), signal: AbortSignal.timeout(6000) });
      if (!r.ok) error = `Cloudflare refuse les codes (erreur ${r.status}) : vérifie le Turn Token ID et l'API Token`;
      const d = await r.json().catch(() => ({}));
      servers = Array.isArray(d.iceServers) ? d.iceServers : d.iceServers ? [d.iceServers] : [];
    } else if (t.mDomain && t.mKey) {
      const r = await fetch(`https://${t.mDomain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(t.mKey)}`, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) error = `Metered refuse la clé (erreur ${r.status})`;
      const d = await r.json().catch(() => ({}));
      servers = Array.isArray(d) ? d : [];
    } else return [];
    if (!servers.length && !error) error = 'Réponse vide du relais';
  } catch (e) { error = 'Relais injoignable : ' + e.message; }
  if (error) console.log('TURN :', error);
  turnCheck = { at: now(), ok: servers.length > 0, error };
  if (servers.length) turnCache = { at: now(), servers };
  return servers;
}
const turnConfigured = () => { const t = turnEnv(); return !!(t.url || (t.cfId && t.cfToken) || (t.mDomain && t.mKey)); };
if (!turnConfigured()) console.log('⚠️  Aucun serveur relais TURN : le vocal et les appels risquent de ne pas marcher entre certains réseaux (4G, box). Voir le README.');
else setTimeout(() => remoteTurn(true).catch(() => {}), 3000).unref();
// Diagnostic pour l'admin : ce que le site voit vraiment (jamais la valeur des codes secrets)
function diagnostics() {
  const t = turnEnv();
  return {
    version: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || 'local',
    dataDir, adminPassword: !!PANEL_HASH,
    turn: { configured: turnConfigured(), provider: t.cfId || t.cfToken ? 'Cloudflare' : t.mDomain || t.mKey ? 'Metered' : t.url ? 'Serveur TURN' : '',
      cfKeyId: !!t.cfId, cfToken: !!t.cfToken, mDomain: !!t.mDomain, mKey: !!t.mKey, url: !!t.url, ...turnCheck },
    // Noms de réglages qui ressemblent à ceux attendus mais ne sont pas exactement pareils (fautes de frappe)
    oddNames: Object.keys(process.env).filter(k => /TURN|ADMIN|DATA|METERED/i.test(k) && envKey(k) !== k).map(k => JSON.stringify(k)),
  };
}
app.get('/api/ice', auth, async (req, res) => {
  const iceServers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  const t = turnEnv();
  if (t.url) iceServers.push({ urls: t.url.split(','), username: t.user, credential: t.pass });
  iceServers.push(...await remoteTurn());
  res.json({ iceServers, relay: iceServers.length > 1 });
});

app.get('/api/users/:id', auth, (req, res) => {
  const u = getUser(req.params.id);
  if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ user: publicUser(u), online: visibleOnline(u.id, req.user), blocked: isBlocked(req.user.id, u.id) });
});

// ---------- Blocages & signalements ----------
const isBlocked = (a, b) => !!db.prepare('SELECT 1 FROM blocks WHERE user_id=? AND blocked_id=?').get(a, b);
// Mute personnel : « a » a rendu « b » muet pour lui seul pendant un certain temps
const isMutedBy = (a, b) => !!db.prepare('SELECT 1 FROM user_mutes WHERE user_id=? AND muted_id=? AND until>?').get(a, b, Date.now());
app.get('/api/mutes', auth, (req, res) => {
  db.prepare('DELETE FROM user_mutes WHERE until<?').run(now());
  res.json({ mutes: db.prepare('SELECT muted_id, until FROM user_mutes WHERE user_id=?').all(req.user.id).map(r => ({ userId: r.muted_id, until: r.until })) });
});
app.post('/api/mutes/:id', auth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const seconds = Math.round(Number(req.body.seconds));
  if (id === req.user.id || !getUser(id)) return res.status(400).json({ error: 'Impossible' });
  if (!(seconds >= 1 && seconds <= 30 * 24 * 3600)) return res.status(400).json({ error: 'Durée invalide (de 1 seconde à 30 jours)' });
  const until = now() + seconds * 1000;
  db.prepare('INSERT INTO user_mutes (user_id,muted_id,until) VALUES (?,?,?) ON CONFLICT(user_id,muted_id) DO UPDATE SET until=excluded.until').run(req.user.id, id, until);
  res.json({ userId: id, until });
});
app.delete('/api/mutes/:id', auth, (req, res) => {
  db.prepare('DELETE FROM user_mutes WHERE user_id=? AND muted_id=?').run(req.user.id, req.params.id);
  res.json({ ok: true });
});
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
  log(req.user, 'report_new', `Signalement contre ${target.username} : ${reason}`);
  emitToStaff('staff_alert', { text: `Nouveau signalement contre ${target.username}` });
  res.json({ ok: true });
});

// ---------- Messages vocaux ----------
const AUDIO_TYPES = [
  { ext: 'webm', test: b => b.slice(0, 4).toString('hex') === '1a45dfa3' },
  { ext: 'ogg', test: b => b.slice(0, 4).toString('ascii') === 'OggS' },
  { ext: 'm4a', test: b => b.slice(4, 8).toString('ascii') === 'ftyp' },
  { ext: 'mp3', test: b => b.slice(0, 3).toString('ascii') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { ext: 'wav', test: b => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WAVE' },
];
app.post('/api/audio', auth, (req, res) => {
  const u = req.user;
  if (u.muted_until && u.muted_until > now()) return res.status(403).json({ error: 'Tu es rendu muet pour le moment' });
  if (tooMany('audio:' + u.id, 30, 10 * 60 * 1000)) return res.status(429).json({ error: 'Trop de messages vocaux, patiente un peu' });
  const m = /^data:audio\/[a-z0-9.+-]+(;[^,]*)?;base64,(.+)$/i.exec(String(req.body.data || ''));
  if (!m) return res.status(400).json({ error: 'Enregistrement invalide' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 500) return res.status(400).json({ error: 'Enregistrement trop court' });
  if (buf.length > 3 * 1024 * 1024) return res.status(400).json({ error: 'Message vocal trop long (2 minutes maximum)' });
  const type = AUDIO_TYPES.find(t => t.test(buf));
  if (!type) return res.status(400).json({ error: 'Format audio non reconnu' });
  const name = `audio-${u.id}-${crypto.randomBytes(6).toString('hex')}.${type.ext}`;
  fs.writeFileSync(path.join(uploadDir, name), buf);
  res.json({ url: '/uploads/' + name });
});
// Vérifie qu'un message vocal appartient bien à son auteur
function checkAudio(a, uid) {
  if (!a || typeof a !== 'object') return null;
  const url = String(a.url || '');
  if (!new RegExp(`^/uploads/audio-${uid}-[a-f0-9]{12}\\.(webm|ogg|m4a|mp3|wav)$`).test(url)) return null;
  if (!fs.existsSync(path.join(uploadDir, path.basename(url)))) return null;
  return { url, duration: Math.min(120, Math.max(1, Math.round(Number(a.duration) || 1))) };
}

// ---------- Photos partagées dans le chat ----------
app.post('/api/media', auth, express.raw({ type: () => true, limit: '9mb' }), (req, res) => {
  const u = req.user;
  if (u.muted_until && u.muted_until > now()) return res.status(403).json({ error: 'Tu es rendu muet pour le moment' });
  if (!isVerified(u)) return res.status(403).json({ error: NOT_VERIFIED });
  if (tooMany('media:' + u.id, 40, 10 * 60 * 1000)) return res.status(429).json({ error: 'Trop de photos envoyées, patiente un peu' });
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length < 100) return res.status(400).json({ error: 'Image vide' });
  if (buf.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'Image trop lourde (8 Mo maximum)' });
  const type = IMAGE_TYPES.find(t => t.test(buf));
  if (!type) return res.status(400).json({ error: 'Format accepté : JPG, PNG, GIF ou WEBP' });
  const name = `img-${u.id}-${crypto.randomBytes(6).toString('hex')}.${type.ext}`;
  fs.writeFileSync(path.join(uploadDir, name), buf);
  res.json({ url: '/uploads/' + name });
});
function checkImage(a, uid) {
  if (!a || typeof a !== 'object') return null;
  const url = String(a.url || '');
  if (!new RegExp(`^/uploads/img-${uid}-[a-f0-9]{12}\\.(jpg|png|gif|webp)$`).test(url)) return null;
  if (!fs.existsSync(path.join(uploadDir, path.basename(url)))) return null;
  return { url };
}

// Aperçu d'un lien (titre, image, description) — protégé contre les adresses internes
const dns = require('dns').promises;
const net = require('net');
const previewCache = new Map();
function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const x = ip.toLowerCase();
  return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80') || x.startsWith('::ffff:') && privateIp(x.slice(7));
}
async function safeFetch(url, hops = 0) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || hops > 3) throw new Error('bad');
  const addrs = await dns.lookup(u.hostname, { all: true });
  if (!addrs.length || addrs.some(a => privateIp(a.address))) throw new Error('blocked');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(u, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ParadiseBot/1.0; aperçu de lien)', Accept: 'text/html' } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) return safeFetch(new URL(r.headers.get('location'), u).toString(), hops + 1);
    if (!r.ok || !/text\/html/i.test(r.headers.get('content-type') || '')) throw new Error('not html');
    const reader = r.body.getReader();
    let html = '', size = 0;
    while (size < 400000) { const { value, done } = await reader.read(); if (done) break; size += value.length; html += Buffer.from(value).toString('utf8'); if (/<\/head>/i.test(html)) break; }
    ctrl.abort();
    return { html, finalUrl: u.toString() };
  } finally { clearTimeout(t); }
}
const decodeHtml = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n)).trim();
app.get('/api/preview', auth, async (req, res) => {
  const url = String(req.query.url || '').slice(0, 1000);
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Lien invalide' });
  if (previewCache.has(url)) return res.json(previewCache.get(url));
  if (tooMany('preview:' + req.user.id, 60, 60 * 1000)) return res.status(429).json({ error: 'Trop de demandes' });
  let out = { url };
  try {
    const { html, finalUrl } = await safeFetch(url);
    const meta = name => {
      const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i');
      const tag = html.match(re)?.[0];
      return tag ? decodeHtml(tag.match(/content=["']([^"']*)["']/i)?.[1]) : '';
    };
    let image = meta('og:image') || meta('twitter:image');
    if (image) { try { image = new URL(image, finalUrl).toString(); } catch (e) { image = ''; } }
    out = {
      url, site: meta('og:site_name') || new URL(finalUrl).hostname.replace(/^www\./, ''),
      title: (meta('og:title') || decodeHtml(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1])).slice(0, 140),
      description: (meta('og:description') || meta('description')).slice(0, 220),
      image: /^https:\/\//.test(image) ? image : '',
    };
  } catch (e) { out = { url, site: (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (er) { return ''; } })() }; }
  if (previewCache.size > 500) previewCache.delete(previewCache.keys().next().value);
  previewCache.set(url, out);
  res.json(out);
});
// Galerie d'un salon : photos et liens partagés récemment
app.get('/api/rooms/:slug/media', auth, (req, res) => {
  const room = getRoomBySlug(req.params.slug);
  const denied = roomAccess(req.user, room);
  if (denied) return res.status(403).json({ error: denied });
  const rows = db.prepare(`SELECT m.id, m.kind, m.media, m.content, m.created_at, u.username FROM messages m JOIN users u ON u.id=m.user_id
    WHERE m.room_id=? AND (m.kind='image' OR m.content LIKE '%http%') ORDER BY m.id DESC LIMIT 120`).all(room.id);
  res.json({ items: rows.map(r => ({ id: r.id, kind: r.kind, media: r.media, content: r.content, createdAt: r.created_at, username: r.username })) });
});

// ---------- Douane : vérifier quelqu'un, ouvrir / fermer ----------
app.post('/api/customs/open', auth, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ error: 'Réservé au staff' });
  const open = !!req.body.open;
  setSetting('customsOpen', open ? '1' : '0');
  log(req.user, 'customs', open ? '🛂 Douane ouverte' : '🛂 Douane fermée');
  io.emit('customs', { enabled: customsOn(), open, media: mediaVerifyOn() });
  io.to('room:douane').emit('system', { room: 'douane', text: open ? `🛂 La douane est ouverte par ${displayName(req.user)} : présente-toi !` : '🛂 La douane est fermée pour le moment.' });
  res.json({ open });
});
// Validation en deux badges : 🎙️ voix et 📷 caméra. Les deux sont nécessaires pour être accepté.
app.post('/api/customs/verify/:id', auth, (req, res) => {
  if (!isStaff(req.user)) return res.status(403).json({ error: 'Réservé à l\'équipe' });
  if (customsOn() && !isSuper(req.user)) return res.status(403).json({ error: 'Seul un super-admin peut valider ou refuser à la douane' });
  const target = getUser(req.params.id);
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (isStaff(target)) return res.status(400).json({ error: 'Les membres du staff n\'ont pas besoin de passer la douane' });
  const b = req.body || {};
  const wasVerified = !!target.verified;
  let voice = !!target.voice_ok, cam = !!target.cam_ok, refused = 0, what;
  if (b.refuse === true) { voice = false; cam = false; refused = 1; what = 'refuse'; }
  else if (b.verified === false) { voice = false; cam = false; what = 'reset'; }
  else if (b.verified === true) { voice = true; cam = true; what = 'both'; }
  else if (typeof b.voice === 'boolean') { voice = b.voice; what = 'voice'; }
  else if (typeof b.cam === 'boolean') { cam = b.cam; what = 'cam'; }
  else return res.status(400).json({ error: 'Que faut-il valider ?' });
  const verified = voice && cam;
  db.prepare('UPDATE users SET voice_ok=?, cam_ok=?, verified=?, refused=? WHERE id=?').run(voice ? 1 : 0, cam ? 1 : 0, verified ? 1 : 0, refused, target.id);
  const label = `🎙️ voix ${voice ? '✅' : '—'} · 📷 caméra ${cam ? '✅' : '—'}`;
  log(req.user, verified ? 'verify' : 'unverify', `${target.username} : ${what === 'refuse' ? 'refusé à la douane ❌' : what === 'reset' ? 'badges retirés, renvoyé à la douane' : label}${verified && !wasVerified ? ' → accepté' : ''}`);
  const updated = getUser(target.id);
  refreshOnline(updated);
  if (verified && !wasVerified && customsOn()) {
    notify(target.id, { type: 'verified', icon: '✅', title: 'Tu es accepté !', text: `Tu as les deux badges 🎙️ voix et 📷 caméra. Bienvenue sur ${getSettings().siteName} : tu as accès à tous les salons, aux messages privés et à tout le site.` });
    io.to('room:douane').emit('system', { room: 'douane', text: `✅ ${target.username} a les deux badges 🎙️📷 : accepté, bienvenue !` });
  } else if (what === 'refuse') {
    notify(target.id, { type: 'unverified', icon: '❌', title: 'Ta demande a été refusée', text: 'Un super-admin a refusé ton accès au site. Tu n\'as aucun rôle pour le moment.', important: true });
    io.to('room:douane').emit('system', { room: 'douane', text: `❌ ${target.username} a été refusé à la douane.` });
    sendToCustoms(target.id);
  } else if (!verified && wasVerified && customsOn()) {
    notify(target.id, { type: 'unverified', icon: '🛂', title: 'Retour à la douane', text: 'Il te manque un badge (🎙️ voix ou 📷 caméra) : un super-admin doit à nouveau te valider.', important: true });
    sendToCustoms(target.id);
  } else if (!customsOn() && (what === 'voice' || what === 'cam' || what === 'both')) {
    const label = what === 'voice' ? '🎙️ voix' : what === 'cam' ? '📷 caméra' : '🎙️ voix et 📷 caméra';
    const on = what === 'voice' ? voice : what === 'cam' ? cam : voice && cam;
    notify(target.id, on
      ? { type: 'verified', icon: what === 'cam' ? '📷' : '🎙️', title: `Badge ${label} validé !`, text: what === 'voice' ? 'Tu peux maintenant parler dans le vocal et passer des appels.' : what === 'cam' ? 'Tu peux maintenant allumer ta caméra dans le vocal et en appel vidéo.' : 'Tu peux parler et allumer ta caméra partout.' }
      : { type: 'unverified', icon: '🛂', title: `Badge ${label} retiré`, text: 'Repasse par le salon Vérification pour le récupérer.' });
  } else if ((what === 'voice' && voice) || (what === 'cam' && cam)) {
    const missing = !voice ? '🎙️ la voix' : !cam ? '📷 la caméra' : '';
    notify(target.id, { type: 'verified', icon: what === 'voice' ? '🎙️' : '📷', title: what === 'voice' ? 'Badge voix validé 🎙️' : 'Badge caméra validé 📷', text: missing ? `Plus qu'une étape : il te reste ${missing} à faire valider à la douane.` : '' });
  }
  emitToUser(target.id, 'verified_state', { verified: isVerified(updated), refused: !!updated.refused, voiceOk: voice, camOk: cam });
  roomsChanged();
  res.json({ verified, voice, cam, refused: !!refused });
});
// Fait sortir des salons une personne non vérifiée (elle retourne à la douane)
function sendToCustoms(userId) {
  const e = online.get(userId);
  if (!e || !e.room || e.room === 'douane') return;
  ejectFromRoom(userId, e.room, NOT_VERIFIED);
}

// ---------- Espace admin : connexion par identifiant + mot de passe ----------
// L'identifiant (ADMIN_LOGIN, « admin » par défaut) et le mot de passe (ADMIN_PASSWORD) se règlent
// sur le serveur : ils ne sont jamais écrits dans le code, qui est public.
const PANEL_USER = envGet('ADMIN_LOGIN') || 'admin';
const PANEL_PASS = envGet('ADMIN_PASSWORD');
const PANEL_HASH = PANEL_PASS ? bcrypt.hashSync(PANEL_PASS, 10) : null;
if (!PANEL_HASH) console.log('⚠️  ADMIN_PASSWORD n\'est pas réglé : la connexion à l\'espace admin (/admin) est désactivée');
const isPanelName = n => String(n || '').trim().toLowerCase() === PANEL_USER.toLowerCase();
function panelAccount() {
  let u = getUserByName(PANEL_USER);
  if (u && !u.panel) { // quelqu'un d'autre porte ce pseudo : il est renommé pour ne pas recevoir les droits
    db.prepare('UPDATE users SET username=? WHERE id=?').run((PANEL_USER + '_' + u.id).slice(0, 20), u.id);
    u = null;
  }
  if (!u) {
    const info = db.prepare(`INSERT INTO users (username,password_hash,gender,age,city,color,role,created_at,last_seen,verified,panel)
      VALUES (?,?,?,?,?,?,?,?,?,1,1)`).run(PANEL_USER, bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10), 'x', 30, '', '#ffb547', 'superadmin', now(), now());
    return getUser(info.lastInsertRowid);
  }
  if (u.role !== 'superadmin' || u.banned || !u.verified) db.prepare("UPDATE users SET role='superadmin', banned=0, verified=1 WHERE id=?").run(u.id);
  return getUser(u.id);
}
app.post('/api/admin-login', (req, res) => panelLogin(req, res));
function panelLogin(req, res) {
  if (tooMany('panel:' + req.ip, 5, 15 * 60 * 1000) || tooMany('panel:all', 40, 60 * 60 * 1000))
    return res.status(429).json({ error: 'Trop d\'essais : réessaie dans 15 minutes' });
  if (!PANEL_HASH) return res.status(503).json({ error: 'L\'espace admin n\'est pas encore activé : ajoute ADMIN_PASSWORD dans les réglages (Environment) de ton hébergeur, puis redémarre le site' });
  const ok = isPanelName(req.body.username) && bcrypt.compareSync(String(req.body.password || ''), PANEL_HASH);
  if (!ok) {
    log(null, 'admin_login', `❌ Connexion à l'espace admin refusée (identifiant « ${clean(req.body.username, 30)} »)`, { ip: req.ip });
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  }
  const u = panelAccount();
  createSession(res, u.id);
  log(u, 'admin_login', '✅ Connexion à l\'espace admin', { ip: req.ip });
  res.json({ user: publicUser(u), panel: true });
}

// ---------- Équipe de modération (visible par tous) et candidatures ----------
app.get('/api/team', auth, (req, res) => {
  const rows = db.prepare("SELECT * FROM users WHERE role IN ('moderator','admin','superadmin') AND banned=0 AND panel=0").all();
  const order = u => (u.role === 'superadmin' ? 0 : u.role === 'admin' ? 1 : 5 - modLevel(u));
  const team = rows.sort((a, b) => order(a) - order(b) || a.username.localeCompare(b.username))
    .map(u => ({ ...publicUser(u), online: visibleOnline(u.id, req.user) }));
  const lastYear = now() - 365 * 24 * 3600 * 1000;
  const mine = db.prepare('SELECT status, created_at FROM mod_applications WHERE user_id=? AND created_at>? ORDER BY created_at').all(req.user.id, lastYear);
  res.json({
    team,
    levels: MOD_LEVELS,
    apply: {
      used: mine.length, max: 2,
      pending: mine.some(a => a.status === 'pending'),
      nextAt: mine.length >= 2 ? mine[0].created_at + 365 * 24 * 3600 * 1000 : 0,
      allowed: !req.user.is_guest && isVerified(req.user) && !isStaff(req.user),
    },
  });
});
// Candidature pour devenir modérateur : 2 demandes maximum par an
app.post('/api/team/apply', auth, (req, res) => {
  const u = req.user;
  if (u.is_guest) return res.status(403).json({ error: 'Inscris-toi pour proposer ta candidature' });
  if (!isVerified(u)) return res.status(403).json({ error: NOT_VERIFIED });
  if (isStaff(u)) return res.status(400).json({ error: 'Tu fais déjà partie de l\'équipe' });
  const lastYear = now() - 365 * 24 * 3600 * 1000;
  const mine = db.prepare('SELECT status, created_at FROM mod_applications WHERE user_id=? AND created_at>? ORDER BY created_at').all(u.id, lastYear);
  if (mine.some(a => a.status === 'pending')) return res.status(400).json({ error: 'Ta demande est déjà en cours d\'examen' });
  if (mine.length >= 2) {
    const next = new Date(mine[0].created_at + 365 * 24 * 3600 * 1000).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
    return res.status(400).json({ error: `Tu as déjà fait 2 demandes cette année. Prochaine demande possible le ${next}.` });
  }
  const motivation = cleanMultiline(req.body.motivation, 1000);
  if (motivation.length < 30) return res.status(400).json({ error: 'Explique ta motivation (30 caractères minimum)' });
  db.prepare('INSERT INTO mod_applications (user_id, motivation, availability, experience, created_at) VALUES (?,?,?,?,?)')
    .run(u.id, motivation, clean(req.body.availability, 200), cleanMultiline(req.body.experience, 600), now());
  log(u, 'application', `🙋 Candidature pour devenir modérateur (${mine.length + 1}/2 cette année)`);
  for (const [id, e] of online) if (isAdminRole(e.user)) emitToUser(id, 'staff_alert', { text: `🙋 ${u.username} propose sa candidature pour devenir modérateur`, url: '/admin#applications' });
  res.json({ ok: true, used: mine.length + 1 });
});

// ---------- Demande de validation de la voix / caméra ----------
app.post('/api/verify/request', auth, (req, res) => {
  const u = req.user;
  if (!mediaVerifyOn()) return res.status(400).json({ error: 'La validation n\'est pas activée' });
  if (voiceAllowed(u) && camAllowed(u)) return res.json({ ok: true, already: true });
  if (tooMany('verifyreq:' + u.id, 1, 5 * 60 * 1000)) return res.status(429).json({ error: 'Demande déjà envoyée : l\'équipe va te contacter. Réessaie dans quelques minutes.' });
  const missing = [!voiceAllowed(u) && '🎙️ voix', !camAllowed(u) && '📷 caméra'].filter(Boolean).join(' et ');
  let n = 0;
  for (const [, e] of online) if (isStaff(e.user)) { emitToUser(e.user.id, 'staff_alert', { text: `🛂 ${u.username} demande la validation de sa ${missing} : il t'attend dans le salon Vérification`, slug: 'douane' }); n++; }
  log(u, 'verify_request', `Demande de validation (${missing})`);
  res.json({ ok: true, staffOnline: n });
});

// ---------- Notifications ----------
app.get('/api/notifications', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 40').all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0').get(req.user.id).c;
  res.json({ unread, notifications: rows.map(n => ({ id: n.id, type: n.type, icon: n.icon, title: n.title, text: n.text, data: parseJSON(n.data, {}), read: !!n.is_read, createdAt: n.created_at })) });
});
app.post('/api/notifications/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
  res.json({ ok: true });
});
app.delete('/api/notifications', auth, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE user_id=?').run(req.user.id);
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
    return u && { user: publicUser(u), online: visibleOnline(u.id, req.user), unread: r.unread, last };
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
const pmOut = m => ({ id: m.id, from: m.from_id, to: m.to_id, content: m.content, createdAt: m.created_at, read: !!m.is_read, kind: m.kind || 'text', media: m.media || '', duration: m.duration || 0, editedAt: m.edited_at || 0 });

// ---------- Administration ----------
const admin = express.Router();
admin.use(auth, requireRole('admin', 'moderator'));

admin.get('/stats', (req, res) => {
  const day = now() - 24 * 3600 * 1000;
  res.json({
    turn: turnConfigured(),
    diag: isAdminRole(req.user) ? diagnostics() : null,
    online: [...online.values()].filter(e => !e.ghost).length,
    ghosts: [...online.values()].filter(e => e.ghost).length,
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
  if (filter === 'online') where += ` AND id IN (${[...online.keys()].filter(id => visibleOnline(id, req.user)).join(',') || 0})`;
  if (filter === 'banned') where += ' AND banned=1';
  if (filter === 'staff') where += " AND role IN ('superadmin','admin','moderator')";
  if (filter === 'guests') where += ' AND is_guest=1';
  if (filter === 'unverified') where += " AND verified=0 AND role='user'";
  if (filter === 'members') where += ' AND is_guest=0';
  const total = db.prepare(`SELECT COUNT(*) c FROM users WHERE ${where}`).get(q).c;
  const users = db.prepare(`SELECT * FROM users WHERE ${where} ORDER BY id DESC LIMIT 25 OFFSET ?`).all(q, page * 25);
  res.json({ total, page, users: users.map(u => ({ ...adminUser(u), online: visibleOnline(u.id, req.user), ghost: isSuper(req.user) && isGhost(u.id) })) });
});

// On ne peut agir que sur quelqu'un de rang inférieur (le super-admin peut agir sur tout le monde sauf lui-même)
function canModerate(actor, target) {
  if (!target || actor.id === target.id) return false;
  if (isSuper(actor)) return true;
  return rank(actor) > rank(target);
}

admin.patch('/users/:id', (req, res) => {
  const target = getUser(req.params.id);
  if (!canModerate(req.user, target)) return res.status(403).json({ error: 'Action non autorisée sur cet utilisateur' });
  if (req.body.role !== undefined) {
    if (!isAdminRole(req.user)) return res.status(403).json({ error: 'Seul un admin peut changer les rôles' });
    if (!ROLES.includes(req.body.role)) return res.status(400).json({ error: 'Rôle invalide' });
    if (!isSuper(req.user) && ROLES.indexOf(req.body.role) >= rank(req.user)) return res.status(403).json({ error: 'Seul le super-admin peut nommer des administrateurs' });
    if (target.is_guest && req.body.role !== 'user') return res.status(400).json({ error: 'Un invité ne peut pas être promu' });
    const lvl = Math.min(3, Math.max(1, parseInt(req.body.modLevel, 10) || modLevel(target)));
    db.prepare('UPDATE users SET role=?, mod_level=? WHERE id=?').run(req.body.role, lvl, target.id);
    const ROLE_FR = { superadmin: 'super-admin', admin: 'admin', moderator: 'modérateur ' + lvl, user: 'membre' };
    log(req.user, 'role', `${target.username} : ${target.role === 'moderator' ? 'modérateur ' + modLevel(target) : { superadmin: 'super-admin', admin: 'admin', user: 'membre' }[target.role] || target.role} → ${ROLE_FR[req.body.role]}`);
    if (req.body.role === 'moderator' && target.role === 'moderator' && lvl !== modLevel(target)) {
      notify(target.id, { type: 'role', icon: '🎖️', title: `Tu es maintenant ${MOD_LEVELS[lvl].label}`, text: modPowers(lvl) });
    }
    if (req.body.role !== target.role) {
      const up = ROLES.indexOf(req.body.role) > ROLES.indexOf(target.role);
      const label = { superadmin: 'super-administrateur', admin: 'administrateur', moderator: MOD_LEVELS[lvl].label.toLowerCase(), user: 'membre' }[req.body.role];
      notify(target.id, up
        ? { type: 'role', icon: '🎖️', title: `Tu es maintenant ${label} !`, text: 'Merci de t\'impliquer dans la communauté. Le panneau 🛡️ Admin est accessible en haut du chat.' }
        : { type: 'role', icon: '🎖️', title: `Ton rôle a changé : ${label}`, text: 'Ton rôle dans l\'équipe a été modifié par un administrateur.' });
    }
  }
  if (req.body.banned !== undefined) {
    const banned = req.body.banned ? 1 : 0;
    if (banned && !isAdminRole(req.user)) return res.status(403).json({ error: 'Les modérateurs sanctionnent avec les durées de leur niveau' });
    const reason = clean(req.body.banReason, 200);
    db.prepare("UPDATE users SET banned=?, ban_reason=?, ban_until=0, ban_kind='ban' WHERE id=?").run(banned, banned ? reason : '', target.id);
    log(req.user, banned ? 'ban' : 'unban', `${target.username}${reason ? ' : ' + reason : ''}`);
    if (banned) {
      notify(target.id, { type: 'ban', icon: '⛔', title: 'Tu as été banni du chat', text: reasonText(reason), important: true });
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
      disconnectUser(target.id, 'banned', reason || 'Tu as été banni par la modération');
    } else if (target.banned) {
      notify(target.id, { type: 'unban', icon: '✅', title: 'Ton bannissement a été levé', text: 'Bon retour parmi nous ! Merci de respecter les règles du chat.' });
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
  const reason = clean(req.body.reason, 200);
  log(req.user, minutes ? 'mute' : 'unmute', `${target.username}${minutes ? ' (' + minutes + ' min)' : ''}${reason ? ' : ' + reason : ''}`);
  if (minutes) {
    notify(target.id, { type: 'mute', icon: '🔇', title: `Tu es rendu muet pendant ${fmtDuration(minutes)}`, text: `Tu ne peux plus écrire ni parler en vocal jusqu'à la fin de la sanction. ${reasonText(reason)}`, data: { until }, important: true });
    const e = online.get(target.id);
    if (e) for (const sid of e.sockets) {
      leaveVoiceBySocket(sid, null);
      if (callOfSocket.has(sid)) endCall(callOfSocket.get(sid), { by: sid, reason: 'Appel interrompu' });
    }
  } else if (target.muted_until > now()) {
    notify(target.id, { type: 'unmute', icon: '🔊', title: 'Tu peux de nouveau parler', text: 'La modération t\'a rendu la parole.', data: { until: 0 } });
  }
  res.json({ ok: true });
});

admin.post('/users/:id/warn', (req, res) => {
  const target = getUser(req.params.id);
  if (!canModerate(req.user, target)) return res.status(403).json({ error: 'Action non autorisée' });
  const reason = clean(req.body.reason, 200);
  if (!reason) return res.status(400).json({ error: 'Indique la raison de l\'avertissement' });
  log(req.user, 'warn', `${target.username} : ${reason}`);
  notify(target.id, { type: 'warn', icon: '⚠️', title: 'Avertissement de la modération', text: `${reasonText(reason)} En cas de récidive, une sanction pourra être appliquée.`, important: true });
  res.json({ ok: true });
});

// Ce que peut faire un modérateur de ce niveau (texte pour les notifications et l'aide)
function modPowers(lvl) {
  const L = MOD_LEVELS[lvl];
  return `Tes sanctions : expulsion ${L.kick ? '(' + fmtDuration(L.kick) + ' sans revenir)' : '(la personne peut revenir)'}, exclusion ${fmtDuration(L.exclusion)}, bannissement ${fmtDuration(L.ban)}. Le panneau 🛡️ Admin est accessible en haut du chat.`;
}
// Expulsion, exclusion ou bannissement. Un modérateur applique les durées de son niveau ;
// un admin choisit la durée (0 = bannissement définitif).
admin.post('/users/:id/sanction', (req, res) => {
  const target = getUser(req.params.id);
  if (!canModerate(req.user, target)) return res.status(403).json({ error: 'Action non autorisée' });
  const type = String(req.body.type || '');
  if (!['kick', 'exclusion', 'ban'].includes(type)) return res.status(400).json({ error: 'Sanction inconnue' });
  let minutes;
  if (req.user.role === 'moderator') minutes = MOD_LEVELS[modLevel(req.user)][type];
  else {
    minutes = Math.max(0, parseInt(req.body.minutes, 10) || 0);
    if (minutes > 525600 * 5) minutes = 525600 * 5;
    if (!minutes && type === 'exclusion') minutes = 24 * 60;
  }
  const reason = clean(req.body.reason, 200);
  const word = SANCTION_FR[type];
  if (type === 'kick' && !minutes) {
    // Expulsion simple : la personne peut revenir tout de suite
    log(req.user, 'kick', `${target.username}${reason ? ' : ' + reason : ''}`);
    notify(target.id, { type: 'kick', icon: '👢', title: 'Tu as été expulsé du chat', text: `${reasonText(reason)} Tu peux te reconnecter, mais respecte les règles.` });
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
    disconnectUser(target.id, 'kicked', reason || 'Tu as été expulsé du chat par la modération');
    return res.json({ ok: true, minutes: 0 });
  }
  const until = minutes ? now() + minutes * 60000 : 0;
  db.prepare('UPDATE users SET banned=1, ban_until=?, ban_kind=?, ban_reason=? WHERE id=?').run(until, type, reason, target.id);
  const dur = minutes ? fmtDuration(minutes) : 'définitivement';
  log(req.user, type === 'ban' ? 'ban' : 'kick', `${target.username} ${word} ${dur}${reason ? ' : ' + reason : ''}`);
  const icon = { kick: '👢', exclusion: '🚪', ban: '⛔' }[type];
  notify(target.id, { type: type === 'ban' ? 'ban' : 'kick', icon, title: `Tu as été ${word} ${minutes ? 'pour ' + dur : dur}`, text: `${reasonText(reason)}${until ? ' Tu pourras revenir le ' + new Date(until).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }) + '.' : ''}`, important: true });
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id);
  disconnectUser(target.id, type === 'ban' ? 'banned' : 'kicked', banBlock(getUser(target.id)) || `Tu as été ${word}`);
  emitToStaff('staff_alert', { text: `${icon} ${target.username} ${word} ${dur} par ${displayName(req.user)}` });
  res.json({ ok: true, minutes });
});

admin.post('/users/:id/kick', (req, res) => {
  const target = getUser(req.params.id);
  if (!canModerate(req.user, target)) return res.status(403).json({ error: 'Action non autorisée' });
  const reason = clean(req.body.reason, 200);
  log(req.user, 'kick', `${target.username}${reason ? ' : ' + reason : ''}`);
  notify(target.id, { type: 'kick', icon: '👢', title: 'Tu as été expulsé du chat', text: `${reasonText(reason)} Tu peux te reconnecter, mais respecte les règles.` });
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(target.id); // il doit se reconnecter
  disconnectUser(target.id, 'kicked', reason || 'Tu as été expulsé du chat par la modération');
  res.json({ ok: true });
});

admin.delete('/users/:id', requireRole('admin'), (req, res) => {
  const target = getUser(req.params.id);
  if (!canModerate(req.user, target)) return res.status(403).json({ error: 'Action non autorisée' });
  disconnectUser(target.id, 'kicked', 'Ton compte a été supprimé');
  deleteUserRecord(target);
  log(req.user, 'delete_user', target.username);
  res.json({ ok: true });
});

admin.post('/users/:id/reset-profile', (req, res) => {
  const target = getUser(req.params.id);
  if (!canModerate(req.user, target)) return res.status(403).json({ error: 'Action non autorisée' });
  removeUpload(target.avatar);
  removeUpload(target.banner);
  removeUpload(target.avatar_pending);
  db.prepare(`UPDATE users SET avatar='', avatar_pending='', avatar_ok=0, banner='', bio='', status_text='', status_emoji='', interests='[]', games='[]', socials='{}',
    name_effect='none', avatar_frame='none' WHERE id=?`).run(target.id);
  log(req.user, 'profile_reset', target.username);
  refreshOnline(getUser(target.id));
  notify(target.id, { type: 'profile_reset', icon: '🧹', title: 'Ton profil a été réinitialisé', text: 'Ta photo, ta bannière, ta bio et tes infos de profil ont été effacées par la modération car elles ne respectaient pas les règles.', important: true });
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
  const count = db.prepare('SELECT COUNT(*) c FROM messages WHERE room_id=?').get(room.id).c;
  db.prepare('DELETE FROM messages WHERE room_id=?').run(room.id);
  log(req.user, 'room_clear', `Salon ${room.name} vidé (${count} message(s) supprimé(s))`);
  io.to('room:' + room.slug).emit('room_cleared', { slug: room.slug });
  res.json({ ok: true });
});

// Messages
admin.get('/messages', (req, res) => {
  const q = '%' + clean(req.query.q, 60) + '%';
  const msgs = db.prepare(`SELECT m.*, u.username, r.name room FROM messages m JOIN users u ON u.id=m.user_id JOIN rooms r ON r.id=m.room_id
    WHERE m.content LIKE ? OR u.username LIKE ? ORDER BY m.id DESC LIMIT 100`).all(q, q);
  res.json({ messages: msgs.map(m => ({ id: m.id, userId: m.user_id, username: m.anon ? m.username + ' (👻 signé Modération)' : m.username, room: m.room, content: m.content, createdAt: m.created_at })) });
});
admin.delete('/messages/:id', (req, res) => {
  const m = db.prepare('SELECT m.*, r.slug, r.name room_name, u.username author FROM messages m JOIN rooms r ON r.id=m.room_id LEFT JOIN users u ON u.id=m.user_id WHERE m.id=?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Message introuvable' });
  db.prepare('DELETE FROM messages WHERE id=?').run(m.id);
  io.to('room:' + m.slug).emit('message_deleted', { id: m.id });
  log(req.user, 'message_delete', `Message de ${m.author || '?'} dans ${m.room_name} : « ${m.content} »`,
    { data: { author: m.author, authorId: m.user_id, room: m.room_name, content: m.content, kind: m.kind, media: m.media, sentAt: m.created_at } });
  if (m.user_id !== req.user.id) {
    const excerpt = m.content.length > 80 ? m.content.slice(0, 80) + '…' : m.content;
    notify(m.user_id, { type: 'message_deleted', icon: '🗑', title: 'Un de tes messages a été supprimé', text: `« ${excerpt} » — supprimé par la modération.` });
  }
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
  const rep = db.prepare('SELECT r.*, t.username target FROM reports r LEFT JOIN users t ON t.id=r.target_id WHERE r.id=?').get(req.params.id);
  if (!rep) return res.status(404).json({ error: 'Signalement introuvable' });
  db.prepare('UPDATE reports SET status=? WHERE id=?').run(status, rep.id);
  log(req.user, 'report_' + status, `#${rep.id}`);
  if (status === 'closed' && rep.status === 'open' && rep.reporter_id)
    notify(rep.reporter_id, { type: 'report_done', icon: '🛡️', title: 'Ton signalement a été traité', text: `Merci ! La modération a examiné ton signalement${rep.target ? ' concernant ' + rep.target : ''}.` });
  res.json({ ok: true });
});

// Candidatures de modérateur (admins)
admin.get('/applications', requireRole('admin'), (req, res) => {
  const rows = db.prepare(`SELECT a.*, u.username, u.color, u.age, u.gender, u.created_at user_created, u.role FROM mod_applications a JOIN users u ON u.id=a.user_id
    ORDER BY a.status='pending' DESC, a.created_at DESC LIMIT 100`).all();
  res.json({ applications: rows.map(a => ({ id: a.id, userId: a.user_id, username: a.username, color: a.color, age: a.age, gender: a.gender, memberSince: a.user_created, role: a.role,
    motivation: a.motivation, availability: a.availability, experience: a.experience, status: a.status, decidedBy: a.decided_by, decidedAt: a.decided_at, note: a.note, createdAt: a.created_at })) });
});
admin.post('/applications/:id', requireRole('admin'), (req, res) => {
  const a = db.prepare('SELECT * FROM mod_applications WHERE id=?').get(req.params.id);
  if (!a || a.status !== 'pending') return res.status(404).json({ error: 'Candidature déjà traitée ou introuvable' });
  const target = getUser(a.user_id);
  if (!target) return res.status(404).json({ error: 'Compte introuvable' });
  const accept = req.body.accept === true;
  const note = clean(req.body.note, 300);
  db.prepare('UPDATE mod_applications SET status=?, decided_by=?, decided_at=?, note=? WHERE id=?').run(accept ? 'accepted' : 'refused', req.user.username, now(), note, a.id);
  if (accept) {
    const lvl = Math.min(3, Math.max(1, parseInt(req.body.level, 10) || 1));
    if (!isStaff(target)) db.prepare("UPDATE users SET role='moderator', mod_level=? WHERE id=?").run(lvl, target.id);
    notify(target.id, { type: 'role', icon: '🎖️', title: `Candidature acceptée : tu es ${MOD_LEVELS[lvl].label} !`, text: modPowers(lvl) });
    refreshOnline(getUser(target.id));
  } else {
    notify(target.id, { type: 'role', icon: '🙋', title: 'Ta candidature de modérateur n\'a pas été retenue', text: (note ? 'Message de l\'équipe : ' + note + ' ' : '') + 'Tu peux faire 2 demandes par an.' });
  }
  log(req.user, 'application', `Candidature de ${target.username} ${accept ? 'acceptée ✅' : 'refusée ❌'}${note ? ' : ' + note : ''}`);
  res.json({ ok: true });
});

// Photos de profil à vérifier (tout le staff)
function pendingPhotos() { return db.prepare("SELECT COUNT(*) c FROM users WHERE avatar_pending<>''").get().c; }
admin.get('/photos', (req, res) => {
  const rows = db.prepare("SELECT * FROM users WHERE avatar_pending<>'' ORDER BY last_seen DESC LIMIT 100").all();
  res.json({ photos: rows.map(u => ({ id: u.id, username: u.username, color: u.color, role: u.role, isGuest: !!u.is_guest, current: u.avatar || '', pending: u.avatar_pending })) });
});
admin.post('/photos/:id', (req, res) => {
  const target = getUser(req.params.id);
  if (!target || !target.avatar_pending) return res.status(404).json({ error: 'Plus de photo à vérifier pour ce compte' });
  const approve = req.body.approve !== false;
  if (approve) {
    removeUpload(target.avatar);
    db.prepare("UPDATE users SET avatar=?, avatar_pending='', avatar_ok=1 WHERE id=?").run(target.avatar_pending, target.id);
    notify(target.id, { type: 'photo', icon: '✅', title: 'Ta photo de profil est vérifiée ✓', text: 'Elle est maintenant visible par tout le monde, avec le badge V.' });
  } else {
    removeUpload(target.avatar_pending);
    db.prepare("UPDATE users SET avatar_pending='' WHERE id=?").run(target.id);
    notify(target.id, { type: 'photo', icon: '❌', title: 'Ta nouvelle photo de profil a été refusée', text: `Choisis une autre photo, respectueuse du règlement.${req.body.reason ? ' Raison : ' + clean(req.body.reason, 200) : ''}`, important: true });
  }
  log(req.user, approve ? 'photo_ok' : 'photo_refused', `Photo de profil de ${target.username} ${approve ? 'vérifiée ✓' : 'refusée ❌'}`, { data: { image: target.avatar_pending } });
  const updated = getUser(target.id);
  refreshOnline(updated);
  emitToUser(target.id, 'me_updated', selfUser(updated));
  emitToStaff('photos_pending', { count: pendingPhotos() });
  res.json({ ok: true });
});

// Réglages
admin.get('/settings', requireRole('admin'), (req, res) => res.json({ settings: getSettings() }));
admin.put('/settings', requireRole('admin'), (req, res) => {
  const b = req.body;
  if (b.announcement !== undefined) setSetting('announcement', clean(b.announcement, 300));
  if (b.bannedWords !== undefined) setSetting('bannedWords', clean(b.bannedWords, 2000));
  if (b.mediaVerify !== undefined) { setSetting('mediaVerify', b.mediaVerify ? '1' : '0'); roomsChanged(); io.emit('customs', { enabled: customsOn(), open: customsOpen(), media: mediaVerifyOn() }); }
  if (b.modBotEnabled !== undefined) setSetting('modBotEnabled', b.modBotEnabled ? '1' : '0');
  if (b.modBotWarnings !== undefined) setSetting('modBotWarnings', Math.min(10, Math.max(1, parseInt(b.modBotWarnings, 10) || 3)));
  if (b.modBotMuteMinutes !== undefined) setSetting('modBotMuteMinutes', Math.min(1440, Math.max(1, parseInt(b.modBotMuteMinutes, 10) || 5)));
  if (b.guestsAllowed !== undefined) setSetting('guestsAllowed', b.guestsAllowed ? '1' : '0');
  if (b.registrationOpen !== undefined) setSetting('registrationOpen', b.registrationOpen ? '1' : '0');
  if (b.minAge !== undefined) setSetting('minAge', Math.min(99, Math.max(13, parseInt(b.minAge, 10) || 18)));
  if (b.voiceEnabled !== undefined) setSetting('voiceEnabled', b.voiceEnabled ? '1' : '0');
  if (b.voiceMax !== undefined) setSetting('voiceMax', Math.min(30, Math.max(2, parseInt(b.voiceMax, 10) || 10)));
  if (b.micTimer !== undefined) { setSetting('micTimer', b.micTimer ? '1' : '0'); for (const slug of voice.keys()) { const m = voice.get(slug); for (const p of m.values()) p.micUntil = 0; emitVoiceState(slug); } }
  if (b.micStep !== undefined) setSetting('micStep', Math.min(120, Math.max(1, parseInt(b.micStep, 10) || 10)));
  if (b.userRoomsEnabled !== undefined) setSetting('userRoomsEnabled', b.userRoomsEnabled ? '1' : '0');
  if (b.tempRoomsEnabled !== undefined) setSetting('tempRoomsEnabled', b.tempRoomsEnabled ? '1' : '0');
  if (b.customsEnabled !== undefined) {
    const was = customsOn();
    setSetting('customsEnabled', b.customsEnabled ? '1' : '0');
    if (customsOn() !== was) {
      log(req.user, 'customs', customsOn() ? '🛂 Douane activée' : '🛂 Douane désactivée');
      io.emit('customs', { enabled: customsOn(), open: customsOpen(), media: mediaVerifyOn() });
      for (const [id] of online) {
        const ok = isVerified(getUser(id));
        if (!ok) sendToCustoms(id);
        emitToUser(id, 'verified_state', { verified: ok });
      }
      roomsChanged();
      schedulePresence();
    }
  }
  if (b.tempRoomMinutes !== undefined) setSetting('tempRoomMinutes', Math.min(1440, Math.max(1, parseInt(b.tempRoomMinutes, 10) || 5)));
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
  res.json({ stations: db.prepare('SELECT * FROM stations ORDER BY sort, id').all(), checking });
});
admin.post('/stations/check', requireRole('admin'), async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number) : null;
  const report = await checkStations({ repair: req.body.repair !== false, actor: req.user, ids });
  if (report.busy) return res.status(409).json({ error: 'Une vérification est déjà en cours, patiente un peu' });
  res.json({ report });
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
  db.prepare("UPDATE stations SET name=?,url=?,genre=?,icon=?,sort=?, status=CASE WHEN url=? THEN status ELSE 'unknown' END WHERE id=?").run(st.name, st.url, st.genre, st.icon, st.sort, st.url, cur.id);
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

admin.put('/site', requireRole('superadmin'), (req, res) => {
  const b = req.body;
  const limits = { siteName: 40, siteDomain: 60, heroTitle: 120, heroText: 400, footerText: 120, historyContent: 20000, rulesContent: 20000 };
  for (const [k, max] of Object.entries(limits)) {
    if (b[k] === undefined) continue;
    const v = k.endsWith('Content') || k === 'heroText' ? cleanMultiline(b[k], max) : clean(b[k], max);
    if (k === 'siteName' && v.length < 2) return res.status(400).json({ error: 'Nom du site trop court' });
    setSetting(k, v);
  }
  for (const k of ['colorViolet', 'colorRose', 'colorGold', 'colorRoomPerm', 'colorRoomTemp']) if (/^#[0-9a-f]{6}$/i.test(b[k] || '')) setSetting(k, b[k]);
  if (b.theme !== undefined && (b.theme === 'auto' || b.theme === 'none' || THEMES.includes(b.theme))) setSetting('theme', b.theme);
  if (b.maxAccounts !== undefined) setSetting('maxAccounts', Math.min(20, Math.max(0, parseInt(b.maxAccounts, 10) || 0)));
  log(req.user, 'site', 'Contenu du site modifié');
  io.emit('site_changed', { site: siteInfo() });
  res.json({ site: siteInfo() });
});

const logOut = (l, withIp) => ({ id: l.id, actorId: l.actor_id, actor: l.actor_name, action: l.action, details: l.details, category: l.category || 'system',
  ip: withIp ? l.ip : undefined, data: typeof l.data === 'string' ? parseJSON(l.data, {}) : (l.data || {}), createdAt: l.created_at });
// ---------- Sauvegardes (super-admin) ----------
// Membres inscrits + rôles (+ réglages du site) dans un fichier, et restauration depuis ce fichier.
const BACKUP_DIR = path.join(dataDir, 'backups');
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const USER_FIELDS = ['username', 'password_hash', 'gender', 'age', 'city', 'bio', 'color', 'role', 'created_at', 'last_seen', 'banned', 'ban_reason',
  'banner_style', 'accent', 'name_effect', 'avatar_frame', 'status_emoji', 'status_text', 'interests', 'games', 'socials', 'show_age', 'show_city',
  'birth_day', 'birth_month', 'show_birthday', 'device_id', 'signup_ip', 'avatar', 'banner', 'mod_level', 'ban_until', 'ban_kind'];
function exportData() {
  const users = db.prepare('SELECT * FROM users WHERE is_guest=0 ORDER BY id').all().map(u => {
    const o = {};
    for (const k of USER_FIELDS) o[k] = u[k] ?? null;
    return o;
  });
  const settings = getSettings();
  return { app: 'The Paradise', version: 1, exportedAt: new Date().toISOString(), counts: { users: users.length }, users, settings };
}
admin.get('/backup/info', requireRole('superadmin'), (req, res) => {
  const counts = {};
  for (const r of db.prepare("SELECT role, COUNT(*) c FROM users WHERE is_guest=0 GROUP BY role").all()) counts[r.role] = r.c;
  const auto = fs.readdirSync(BACKUP_DIR).filter(f => /^auto-.+\.(db|json)$/.test(f)).sort().reverse()
    .map(f => ({ name: f, size: fs.statSync(path.join(BACKUP_DIR, f)).size, date: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }));
  res.json({ counts, total: Object.values(counts).reduce((a, b) => a + b, 0), auto });
});
admin.get('/backup/users', requireRole('superadmin'), (req, res) => {
  const data = exportData();
  log(req.user, 'backup', `Sauvegarde téléchargée (${data.users.length} membres)`);
  res.setHeader('Content-Disposition', `attachment; filename="sauvegarde-membres-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
});
admin.get('/backup/db', requireRole('superadmin'), async (req, res) => {
  const file = path.join(BACKUP_DIR, `manuel-${Date.now()}.db`);
  try {
    await db.backup(file);
    log(req.user, 'backup', 'Sauvegarde complète de la base téléchargée');
    res.download(file, `sauvegarde-complete-${new Date().toISOString().slice(0, 10)}.db`, () => fs.unlink(file, () => {}));
  } catch (e) { res.status(500).json({ error: 'Sauvegarde impossible : ' + e.message }); }
});
admin.get('/backup/auto/:name', requireRole('superadmin'), (req, res) => {
  const name = path.basename(String(req.params.name));
  if (!/^auto-.+\.(db|json)$/.test(name) || !fs.existsSync(path.join(BACKUP_DIR, name))) return res.status(404).json({ error: 'Sauvegarde introuvable' });
  res.download(path.join(BACKUP_DIR, name));
});
admin.post('/backup/import', requireRole('superadmin'), (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.users)) return res.status(400).json({ error: 'Fichier de sauvegarde invalide' });
  const withRoles = req.body.options?.roles !== false;
  const withSettings = !!req.body.options?.settings;
  const report = { created: 0, updated: 0, skipped: 0 };
  const insert = db.prepare(`INSERT INTO users (${USER_FIELDS.join(',')}) VALUES (${USER_FIELDS.map(() => '?').join(',')})`);
  const tx = db.transaction(() => {
    for (const raw of b.users) {
      const name = clean(raw?.username, 20);
      if (!USERNAME_RE.test(name) || !raw.password_hash || !/^\$2[aby]\$/.test(String(raw.password_hash))) { report.skipped++; continue; }
      const role = ROLES.includes(raw.role) ? raw.role : 'user';
      // Les images ne sont pas dans le fichier : on garde le lien seulement si l'image existe encore sur ce serveur
      const img = v => (v && String(v).startsWith('/uploads/') && fs.existsSync(path.join(uploadDir, path.basename(v))) ? v : '');
      const DEF = { mod_level: 1, ban_until: 0, ban_kind: 'ban', gender: 'x', color: '#8b6cff', banned: 0, show_age: 1, show_city: 1, show_birthday: 1, birth_day: 0, birth_month: 0, interests: '[]', games: '[]', socials: '{}',
        banner_style: 'aurora', accent: '#ff5fa2', name_effect: 'none', avatar_frame: 'none', bio: '', city: '', ban_reason: '', status_emoji: '', status_text: '', device_id: '', signup_ip: '' };
      const vals = () => USER_FIELDS.map(k => {
        if (k === 'username') return name;
        if (k === 'role') return withRoles ? role : 'user';
        if (k === 'avatar' || k === 'banner') return img(raw[k]);
        if (k === 'created_at') return Number(raw.created_at) || now();
        if (k === 'gender') return ['h', 'f', 'x'].includes(raw.gender) ? raw.gender : 'x';
        const v = raw[k] ?? DEF[k] ?? null;
        return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
      });
      const existing = getUserByName(name);
      if (!existing || existing.is_guest) {
        if (existing) deleteUserRecord(existing);
        try { insert.run(...vals()); report.created++; } catch (e) { report.skipped++; }
      } else {
        // Compte déjà présent : on remet son rôle (sans jamais retirer le super-admin qui restaure)
        if (withRoles && existing.id !== req.user.id && existing.role !== role) {
          db.prepare('UPDATE users SET role=? WHERE id=?').run(role, existing.id);
          report.updated++;
        } else report.skipped++;
      }
    }
    if (withSettings && b.settings && typeof b.settings === 'object') {
      for (const [k, v] of Object.entries(b.settings)) if (typeof v === 'string' && v.length < 25000) setSetting(k, v);
    }
  });
  tx();
  for (const e of online.values()) refreshOnline(getUser(e.user.id) || e.user);
  log(req.user, 'backup', `Restauration : ${report.created} créé(s), ${report.updated} rôle(s) remis, ${report.skipped} ignoré(s)${withSettings ? ', réglages du site restaurés' : ''}`);
  if (withSettings) io.emit('site_changed', { site: siteInfo() });
  res.json({ report });
});
// Sauvegarde automatique chaque jour sur le serveur (on garde les 14 dernières)
async function autoBackup() {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const dbFile = path.join(BACKUP_DIR, `auto-${day}.db`);
    if (!fs.existsSync(dbFile)) {
      await db.backup(dbFile);
      fs.writeFileSync(path.join(BACKUP_DIR, `auto-${day}-membres.json`), JSON.stringify(exportData()));
    }
    const olds = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('auto-')).sort().reverse();
    const days = [...new Set(olds.map(f => f.slice(5, 15)))];
    for (const f of olds) if (!days.slice(0, 14).includes(f.slice(5, 15))) fs.unlink(path.join(BACKUP_DIR, f), () => {});
  } catch (e) { console.error('Sauvegarde automatique impossible :', e.message); }
}
setTimeout(autoBackup, 20000).unref();
setInterval(autoBackup, 6 * 3600 * 1000).unref();

admin.get('/logs', (req, res) => {
  const where = [], args = [];
  if (req.query.category && req.query.category !== 'all') { where.push('category=?'); args.push(String(req.query.category)); }
  if (req.query.q) { where.push('(details LIKE ? OR actor_name LIKE ?)'); const q = '%' + clean(req.query.q, 60) + '%'; args.push(q, q); }
  const before = parseInt(req.query.before, 10);
  if (before) { where.push('id<?'); args.push(before); }
  const after = parseInt(req.query.after, 10);
  if (after) { where.push('id>?'); args.push(after); }
  const rows = db.prepare(`SELECT * FROM logs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 100`).all(...args);
  const counts = {};
  for (const r of db.prepare('SELECT category, COUNT(*) c FROM logs WHERE created_at>? GROUP BY category').all(now() - 24 * 3600 * 1000)) counts[r.category] = r.c;
  res.json({ logs: rows.map(l => logOut(l, isSuper(req.user))), counts, more: rows.length === 100 });
});

app.use('/api/admin', admin);

// Mini-jeux (scores, classements, parties à deux)
const Games = require('./games')({ app, io, db, auth, getUser, publicUser, online: null, emitToUser: (...a) => emitToUser(...a), isBlocked, isVerified: u => isVerified(u), isMutedBy, visibleOnline: (...a) => visibleOnline(...a), log, tooMany });
app.get('/jeux', (req, res) => res.redirect('/chat#jeux'));

// Pages
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chat.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/staff', (req, res) => res.redirect('/admin'));
app.get(['/histoire', '/reglement'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'page.html')));

// ---------- Temps réel ----------
// online : userId -> { user, sockets:Set, room }
const online = new Map();
const recentLeave = new Map(); // userId -> { room, timer } : départ pas encore annoncé
const Jukebox = require('./jukebox')({ app, io, auth, isStaff, tooMany, log, getOnline: () => online });
const TvBot = require('./tvbot')({ app, io, auth, isStaff, isVerified: u => isVerified(u), tooMany, log, getOnline: () => online, dataDir });

function onlineOut(entry) {
  return { ...publicUser(entry.user), room: entry.room, ghost: !!entry.ghost };
}
// Mode fantôme : le super-admin est invisible pour tout le monde sauf les autres super-admins
const isGhost = id => !!online.get(id)?.ghost;
const visibleOnline = (id, viewer) => online.has(id) && (!isGhost(id) || isSuper(viewer));
const displayName = u => (isGhost(u.id) ? 'la modération' : u.username);
function roomCount(slug) {
  let c = 0;
  for (const e of online.values()) if (e.room === slug && !e.ghost) c++;
  return c;
}
function broadcastPresence() {
  const all = [...online.values()];
  io.except('supers').emit('presence', { users: all.filter(e => !e.ghost).map(onlineOut) });
  io.to('supers').emit('presence', { users: all.map(onlineOut) });
}
function syncSuperRoom(entry) {
  for (const sid of entry.sockets) {
    const sk = io.sockets.sockets.get(sid);
    if (!sk) continue;
    if (isSuper(entry.user)) sk.join('supers'); else sk.leave('supers');
  }
  if (!isSuper(entry.user) && entry.ghost) {
    entry.ghost = false;
    db.prepare('UPDATE users SET ghost=0 WHERE id=?').run(entry.user.id);
    emitToUser(entry.user.id, 'ghost_state', { ghost: false });
  }
}
let presenceTimer = null;
function schedulePresence() {
  if (presenceTimer) return;
  presenceTimer = setTimeout(() => { presenceTimer = null; broadcastPresence(); }, 300);
}
function refreshOnline(user) {
  const e = online.get(user.id);
  if (e) { e.user = user; syncSuperRoom(e); schedulePresence(); }
}
function emitToUser(id, ev, data) {
  const e = online.get(id);
  if (e) for (const s of e.sockets) io.to(s).emit(ev, data);
}
log.onEntry(entry => {
  for (const e of online.values()) {
    if (!isStaff(e.user)) continue;
    const out = logOut(entry, isSuper(e.user));
    for (const sid of e.sockets) io.to(sid).emit('log', out);
  }
});

// ---------- Notifications (enregistrées + envoyées en direct) ----------
// important = true → s'affiche en grand chez la personne (sanctions)
function notify(userId, { type, icon = '🔔', title, text = '', data = {}, important = false }) {
  const info = db.prepare('INSERT INTO notifications (user_id,type,icon,title,text,data,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(userId, type, icon, title, text, JSON.stringify(data), now());
  emitToUser(userId, 'notification', { id: info.lastInsertRowid, type, icon, title, text, data, important, read: false, createdAt: now() });
}
const reasonText = r => (r ? `Raison : ${r}` : 'Aucune raison précisée.');
function fmtDuration(min) {
  if (min > 0 && min % 525600 === 0) return `${min / 525600} an${min > 525600 ? 's' : ''}`;
  if (min > 0 && min % 43200 === 0) return `${min / 43200} mois`;
  if (min > 0 && min % 10080 === 0) return `${min / 10080} semaine${min > 10080 ? 's' : ''}`;
  if (min >= 1440 && min % 1440 === 0) return `${min / 1440} jour${min > 1440 ? 's' : ''}`;
  if (min >= 60 && min % 60 === 0) return `${min / 60} heure${min > 60 ? 's' : ''}`;
  return `${min} minute${min > 1 ? 's' : ''}`;
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
    if (!s) continue;
    const inVoice = voiceOf.get(sid) === slug;
    if (!s.rooms.has('room:' + slug) && !inVoice) continue;
    s.leave('room:' + slug);
    if (inVoice) leaveVoiceBySocket(sid, null);
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
  return m ? [...m.entries()].map(([socketId, p]) => ({ socketId, ...p, micLeft: p.micUntil ? Math.max(0, p.micUntil - now()) : 0 })) : [];
}
function emitVoiceState(slug) {
  micRecalc(slug);
  io.emit('voice_state', { slug, participants: voiceList(slug) });
}
// ---------- Temps de micro ----------
// Le 1er micro (le plus ancien) n'a pas de limite ; le 2e a 2 × micStep minutes (20 min), le 3e 3 × micStep (30 min), etc.
// Quand quelqu'un devant part, les suivants avancent ; celui qui devient 1er n'a plus de limite.
const micTimerOn = () => getSettings().micTimer === '1';
const micStepMs = () => Math.min(120, Math.max(1, parseInt(getSettings().micStep, 10) || 10)) * 60000;
function micRecalc(slug) {
  const m = voice.get(slug);
  if (!m) return;
  const speakers = [...m.values()].filter(p => !p.listener).sort((a, b) => (a.micSince || 0) - (b.micSince || 0));
  const on = micTimerOn(), step = micStepMs();
  speakers.forEach((p, i) => {
    if (!on || i === 0) p.micUntil = 0;
    else if (!p.micUntil) p.micUntil = now() + (i + 1) * step;
  });
}
setInterval(() => {
  if (!micTimerOn()) return;
  for (const [slug, m] of voice) {
    const t = now();
    for (const [sid, p] of [...m.entries()]) {
      if (p.listener || !p.micUntil || p.micUntil > t) continue;
      io.to(sid).emit('voice_time_up', { reason: '⏱️ Ton temps de micro est terminé : tu repasses en écoute. Reprends le micro pour te remettre dans la file.' });
      leaveVoiceBySocket(sid, null);
    }
  }
}, 5000).unref();
// ---------- Qui regarde quelle caméra ----------
// watching : socket de celui qui regarde -> Set(sockets des caméras qu'il a à l'écran)
const watching = new Map();
const camBlocksOf = ownerId => db.prepare('SELECT viewer_id FROM cam_blocks WHERE owner_id=?').all(ownerId).map(r => r.viewer_id);
const blockedByOwners = viewerId => db.prepare('SELECT owner_id FROM cam_blocks WHERE viewer_id=?').all(viewerId).map(r => r.owner_id);
function voiceUserOf(socketId) { const slug = voiceOf.get(socketId); return slug ? voice.get(slug)?.get(socketId) : null; }
// Envoie au propriétaire de la caméra la liste des personnes qui la regardent
function emitCamViewers(ownerSocket) {
  const owner = voiceUserOf(ownerSocket);
  if (!owner) return;
  const blocked = new Set(camBlocksOf(owner.userId));
  const seen = new Map();
  for (const [viewerSocket, set] of watching) {
    if (!set.has(ownerSocket) || voiceOf.get(viewerSocket) !== voiceOf.get(ownerSocket)) continue;
    const v = voiceUserOf(viewerSocket);
    if (!v || v.userId === owner.userId || blocked.has(v.userId) || isGhost(v.userId)) continue;
    seen.set(v.userId, { userId: v.userId, username: v.username, color: v.color, avatar: v.avatar, frame: v.frame, listener: !!v.listener });
  }
  io.to(ownerSocket).emit('cam_viewers', { viewers: [...seen.values()] });
}
// Indique à quelqu'un du vocal quelles caméras ne lui sont pas partagées
function emitCamBlockedMe(socketId) {
  const me = voiceUserOf(socketId);
  if (!me) return;
  const owners = new Set(blockedByOwners(me.userId));
  const slug = voiceOf.get(socketId);
  const sockets = voiceList(slug).filter(p => owners.has(p.userId)).map(p => p.socketId);
  io.to(socketId).emit('cam_blocked_me', { sockets });
}
function forgetWatcher(socketId) {
  const set = watching.get(socketId);
  watching.delete(socketId);
  if (set) for (const owner of set) emitCamViewers(owner);
  for (const [viewer, s] of watching) if (s.delete(socketId)) { /* la caméra qu'il regardait est partie */ }
}

function leaveVoiceBySocket(socketId, reason) {
  const slug = voiceOf.get(socketId);
  if (!slug) return;
  forgetWatcher(socketId);
  voiceOf.delete(socketId);
  const m = voice.get(slug);
  if (m) { m.delete(socketId); if (!m.size) voice.delete(slug); }
  for (const p of voiceList(slug)) io.to(p.socketId).emit('voice_peer_left', { socketId });
  if (reason) io.to(socketId).emit('voice_kicked', { reason });
  emitVoiceState(slug);
}

// ---------- Appels audio / vidéo en tête-à-tête ----------
// calls : callId -> { callerId, callerSocket, calleeId, calleeSocket, video, timer, accepted }
const calls = new Map();
const callOfSocket = new Map(); // socketId -> callId
const userInCall = id => [...calls.values()].some(c => c.callerId === id || c.calleeId === id);
function endCall(callId, { by = null, reason = 'Appel terminé', missed = false } = {}) {
  const c = calls.get(callId);
  if (!c) return;
  const a = getUser(c.callerId), b2 = getUser(c.calleeId);
  if (a && b2) {
    const secs = c.startedAt ? Math.round((now() - c.startedAt) / 1000) : 0;
    log(a, 'call', c.accepted
      ? `Appel ${c.video ? 'vidéo' : 'audio'} avec ${b2.username} (${Math.floor(secs / 60)} min ${secs % 60} s)`
      : `Appel ${c.video ? 'vidéo' : 'audio'} vers ${b2.username} sans réponse (${reason})`);
  }
  calls.delete(callId);
  clearTimeout(c.timer);
  callOfSocket.delete(c.callerSocket);
  if (c.calleeSocket) callOfSocket.delete(c.calleeSocket);
  if (by !== c.callerSocket) io.to(c.callerSocket).emit('call_ended', { callId, reason });
  if (c.calleeSocket) { if (by !== c.calleeSocket) io.to(c.calleeSocket).emit('call_ended', { callId, reason }); }
  else emitToUser(c.calleeId, 'call_cancelled', { callId });
  if (missed) {
    const caller = getUser(c.callerId);
    if (caller) notify(c.calleeId, { type: 'call_missed', icon: '📵', title: `Appel ${c.video ? 'vidéo ' : ''}manqué de ${caller.username}`, text: 'Clique sur son pseudo pour le rappeler.' });
  }
}

io.use((socket, next) => {
  const token = parseCookie(socket.handshake.headers.cookie)[COOKIE];
  const u = userFromToken(token);
  if (!u) return next(new Error('unauthorized'));
  if (banBlock(u)) return next(new Error('banned'));
  socket.data.userId = u.id;
  next();
});

io.on('connection', socket => {
  socket.emit('build', BUILD);
  const uid = socket.data.userId;
  let entry = online.get(uid);
  if (!entry) {
    const u0 = getUser(uid);
    entry = { user: u0, sockets: new Set(), room: null, ghost: !!(u0.ghost && u0.role === 'superadmin'), ghostAnon: !!u0.ghost_anon };
    online.set(uid, entry);
  }
  entry.sockets.add(socket.id);
  if (isSuper(entry.user)) socket.join('supers');
  db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(now(), uid);

  socket.emit('hello', { user: selfUser(entry.user), announcement: getSettings().announcement, ghost: !!entry.ghost, ghostAnon: !!entry.ghostAnon });
  setTimeout(() => celebrateBirthday(getUser(uid)), 2500);
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
    // On garde le vocal en changeant de salon (on reste en vocal là où on était)
    for (const r of socket.rooms) if (r.startsWith('room:')) socket.leave(r);
    socket.join('room:' + room.slug);
    const prev = entry.room;
    entry.room = room.slug;
    const history = db.prepare(`SELECT m.*, u.username, u.color, u.gender, u.role, u.avatar, u.name_effect, u.avatar_frame, u.birth_day, u.birth_month, u.show_birthday, u.verified, u.is_guest, u.mod_level FROM messages m JOIN users u ON u.id=m.user_id
      WHERE m.room_id=? ORDER BY m.id DESC LIMIT 60`).all(room.id).reverse();
    ack && ack({ room: roomOut(room), history: room.slug === PATCH_SLUG ? patchHistory() : history.map(msgOut), voice: voiceList(room.slug) });
    if (room.slug === 'douane' && !isVerified(u) && prev !== room.slug) emitToStaff('staff_alert', { text: `🛂 ${u.username} attend à la douane`, slug: 'douane' });
    // Reconnexion rapide (connexion qui saute, page rechargée) : pas de « déconnecté / a rejoint » en boucle
    const quick = recentLeave.get(uid);
    const silent = !prev && quick && quick.room === room.slug;
    if (quick) { clearTimeout(quick.timer); recentLeave.delete(uid); if (!silent && !entry.ghost) io.to('room:' + quick.room).emit('system', { room: quick.room, text: `${u.username} a quitté le salon` }); }
    if (prev !== room.slug && !entry.ghost && !silent && room.slug !== PATCH_SLUG && prev !== PATCH_SLUG) {
      if (prev) io.to('room:' + prev).emit('system', { room: prev, text: `${u.username} a quitté le salon` });
      socket.to('room:' + room.slug).emit('system', { room: room.slug, text: `${u.username} a rejoint le salon` });
    }
    schedulePresence();
  });

  socket.on('message', (payload, ack) => {
    const u = current();
    if (!u || u.banned) return;
    if (!entry.room) return ack && ack({ error: 'Rejoins un salon d\'abord' });
    if (entry.room === PATCH_SLUG) return ack && ack({ error: '📝 Personne ne peut écrire dans le salon Patch note : seul le bot y annonce les nouveautés' });
    if (u.muted_until && u.muted_until > now()) return ack && ack({ error: 'Tu es rendu muet pour le moment' });
    if (flood()) return ack && ack({ error: 'Doucement ! Tu envoies trop de messages' });
    const audio = typeof payload === 'object' && payload ? checkAudio(payload.audio, uid) : null;
    if (typeof payload === 'object' && payload?.audio && !audio) return ack && ack({ error: 'Message vocal invalide' });
    const image = typeof payload === 'object' && payload ? checkImage(payload.image, uid) : null;
    if (typeof payload === 'object' && payload?.image && !image) return ack && ack({ error: 'Photo invalide' });
    const scanned = modScan(clean(typeof payload === 'string' ? payload : payload?.text, 500));
    const caption = scanned.text;
    const content = audio ? '🎤 Message vocal' : image ? caption || '🖼️ Photo' : caption;
    if (!content) return;
    const room = getRoomBySlug(entry.room);
    if (!room || !socket.rooms.has('room:' + room.slug)) return ack && ack({ error: 'Rejoins un salon d\'abord' });
    if (roomAccess(u, room)) return ack && ack({ error: roomAccess(u, room) });
    if (room.slug === 'douane' && customsOn() && !customsOpen() && !isVerified(u)) return ack && ack({ error: '🛂 La douane est fermée pour le moment : attends qu\'un membre du staff l\'ouvre' });
    if (room.slug === 'douane' && u.refused && !isVerified(u)) return ack && ack({ error: '❌ Ta demande a été refusée : tu ne peux pas écrire pour le moment' });
    const kind = audio ? 'audio' : image ? 'image' : 'text', media = audio ? audio.url : image ? image.url : '', duration = audio ? audio.duration : 0;
    const anon = entry.ghost && entry.ghostAnon ? 1 : 0;
    const info = db.prepare('INSERT INTO messages (room_id,user_id,content,created_at,kind,media,duration,anon) VALUES (?,?,?,?,?,?,?,?)').run(room.id, uid, content, now(), kind, media, duration, anon);
    const msg = msgOut({ ...u, id: info.lastInsertRowid, user_id: uid, content, created_at: now(), kind, media, duration, anon });
    io.to('room:' + room.slug).emit('message', { room: room.slug, ...msg });
    ack && ack({ ok: true });
    if (scanned.level) modBotStrike(u, room, scanned);
    if (Jukebox.has(room.slug) && kind === 'text' && content.startsWith('!')) Jukebox.command(room.slug, u, content).catch(() => {});
    if (TvBot.has(room.slug) && kind === 'text' && content.startsWith('!')) TvBot.command(u, content).catch(() => {});
  });

  // ----- Corriger un message (faute d'orthographe…) : seulement le sien, texte ou légende de photo, 15 min max -----
  socket.on('message_edit', ({ id, text } = {}, ack) => {
    const u = current();
    const m = db.prepare('SELECT m.*, r.slug FROM messages m JOIN rooms r ON r.id=m.room_id WHERE m.id=?').get(parseInt(id, 10));
    if (!u || !m || m.user_id !== uid) return ack && ack({ error: 'Tu ne peux modifier que tes messages' });
    if (m.kind === 'audio') return ack && ack({ error: 'Un message vocal ne peut pas être modifié' });
    if (now() - m.created_at > EDIT_WINDOW) return ack && ack({ error: 'Trop tard : on peut modifier un message pendant 15 minutes' });
    if (u.muted_until && u.muted_until > now()) return ack && ack({ error: 'Tu es rendu muet pour le moment' });
    if (flood()) return ack && ack({ error: 'Doucement !' });
    const scanned = modScan(clean(text, 500));
    const content = scanned.text || (m.kind === 'image' ? '🖼️ Photo' : '');
    if (!content) return ack && ack({ error: 'Le message est vide' });
    db.prepare('UPDATE messages SET content=?, edited_at=? WHERE id=?').run(content, now(), m.id);
    io.to('room:' + m.slug).emit('message_edited', { id: m.id, content, editedAt: now() });
    ack && ack({ ok: true });
    if (scanned.level) { const room = getRoomBySlug(m.slug); if (room) modBotStrike(u, room, scanned); }
  });
  socket.on('pm_edit', ({ id, text } = {}, ack) => {
    const u = current();
    const m = db.prepare('SELECT * FROM private_messages WHERE id=?').get(parseInt(id, 10));
    if (!u || !m || m.from_id !== uid) return ack && ack({ error: 'Tu ne peux modifier que tes messages' });
    if (m.kind === 'audio') return ack && ack({ error: 'Un message vocal ne peut pas être modifié' });
    if (now() - m.created_at > EDIT_WINDOW) return ack && ack({ error: 'Trop tard : on peut modifier un message pendant 15 minutes' });
    const content = filterWords(clean(text, 1000)) || (m.kind === 'image' ? '🖼️ Photo' : '');
    if (!content) return ack && ack({ error: 'Le message est vide' });
    db.prepare('UPDATE private_messages SET content=?, edited_at=? WHERE id=?').run(content, now(), m.id);
    const ev = { id: m.id, from: m.from_id, to: m.to_id, content, editedAt: now() };
    emitToUser(m.to_id, 'pm_edited', ev); emitToUser(uid, 'pm_edited', ev);
    ack && ack({ ok: true });
  });

  // ----- Supprimer son message privé pour tout le monde -----
  socket.on('pm_delete', ({ id } = {}, ack) => {
    const m = db.prepare('SELECT * FROM private_messages WHERE id=?').get(parseInt(id, 10));
    if (!m || m.from_id !== uid) return ack && ack({ error: 'Tu ne peux supprimer que tes messages' });
    db.prepare('DELETE FROM private_messages WHERE id=?').run(m.id);
    const ev = { id: m.id, from: m.from_id, to: m.to_id };
    emitToUser(m.to_id, 'pm_deleted', ev); emitToUser(uid, 'pm_deleted', ev);
    ack && ack({ ok: true });
  });

  socket.on('typing', () => {
    if (entry.room && entry.room !== PATCH_SLUG) socket.to('room:' + entry.room).emit('typing', { room: entry.room, username: entry.ghost && entry.ghostAnon ? 'La modération' : entry.user.username });
  });

  socket.on('pm', ({ to, text, audio: rawAudio, image: rawImage } = {}, ack) => {
    const u = current();
    const target = getUser(parseInt(to, 10));
    if (!u || !target || target.id === uid) return ack && ack({ error: 'Destinataire invalide' });
    if (u.muted_until && u.muted_until > now()) return ack && ack({ error: 'Tu es rendu muet pour le moment' });
    if (isBlocked(target.id, uid)) return ack && ack({ error: 'Cette personne ne reçoit pas tes messages' });
    if (!isVerified(u) && !isStaff(target)) return ack && ack({ error: NOT_VERIFIED });
    if (!isVerified(target) && !isStaff(u)) return ack && ack({ error: `${target.username} n'a pas encore passé la douane` });
    if (isMutedBy(target.id, uid)) return ack && ack({ error: `${target.username} t'a mis en sourdine pour le moment` });
    if (isBlocked(uid, target.id)) return ack && ack({ error: 'Tu as bloqué cette personne' });
    if (flood()) return ack && ack({ error: 'Doucement ! Tu envoies trop de messages' });
    const audio = rawAudio ? checkAudio(rawAudio, uid) : null;
    if (rawAudio && !audio) return ack && ack({ error: 'Message vocal invalide' });
    const image = rawImage ? checkImage(rawImage, uid) : null;
    if (rawImage && !image) return ack && ack({ error: 'Photo invalide' });
    const caption = filterWords(clean(text, 1000));
    const content = audio ? '🎤 Message vocal' : image ? caption || '🖼️ Photo' : caption;
    if (!content) return;
    const kind = audio ? 'audio' : image ? 'image' : 'text', media = audio ? audio.url : image ? image.url : '', duration = audio ? audio.duration : 0;
    const info = db.prepare('INSERT INTO private_messages (from_id,to_id,content,created_at,kind,media,duration) VALUES (?,?,?,?,?,?,?)').run(uid, target.id, content, now(), kind, media, duration);
    const m = pmOut({ id: info.lastInsertRowid, from_id: uid, to_id: target.id, content, created_at: now(), is_read: 0, kind, media, duration });
    emitToUser(target.id, 'pm', { ...m, fromUser: publicUser(u) });
    emitToUser(uid, 'pm', { ...m, fromUser: publicUser(u) });
    ack && ack({ ok: true, message: m });
  });

  socket.on('pm_read', from => {
    db.prepare('UPDATE private_messages SET is_read=1 WHERE from_id=? AND to_id=?').run(parseInt(from, 10), uid);
  });

  socket.on('pm_typing', to => emitToUser(parseInt(to, 10), 'pm_typing', { from: uid }));

  Games.onConnection(socket, uid, current);
  Jukebox.onConnection(socket, uid, current);
  TvBot.onConnection(socket, uid, current);

  // ----- Mode fantôme (super-admin) -----
  socket.on('ghost', (on, ack) => {
    const u = current();
    if (!isSuper(u)) return ack && ack({ error: 'Réservé au super-admin' });
    const wanted = !!on;
    if (wanted === !!entry.ghost) return ack && ack({ ghost: wanted });
    entry.ghost = wanted;
    db.prepare('UPDATE users SET ghost=? WHERE id=?').run(wanted ? 1 : 0, uid);
    if (wanted) {
      // Pour les autres, c'est comme s'il venait de partir (et inversement)
      if (entry.room) io.to('room:' + entry.room).except('supers').emit('system', { room: entry.room, text: `${u.username} s'est déconnecté` });
    } else if (entry.room) {
      io.to('room:' + entry.room).except('supers').emit('system', { room: entry.room, text: `${u.username} a rejoint le salon` });
    }
    log(u, 'ghost', wanted ? 'Mode fantôme activé 👻' : 'Mode fantôme désactivé');
    emitToUser(uid, 'ghost_state', { ghost: wanted });
    schedulePresence();
    ack && ack({ ghost: wanted });
  });

  socket.on('ghost_anon', (on, ack) => {
    if (!isSuper(current())) return ack && ack({ error: 'Réservé au super-admin' });
    entry.ghostAnon = !!on;
    db.prepare('UPDATE users SET ghost_anon=? WHERE id=?').run(on ? 1 : 0, uid);
    ack && ack({ ghostAnon: entry.ghostAnon });
  });

  // ----- Appels -----
  socket.on('call_invite', ({ to, video } = {}, ack) => {
    const u = current();
    const target = getUser(parseInt(to, 10));
    if (!target || target.id === uid) return ack && ack({ error: 'Destinataire invalide' });
    if (!visibleOnline(target.id, u)) return ack && ack({ error: `${target.username} n'est pas connecté` });
    if (u.muted_until && u.muted_until > now()) return ack && ack({ error: 'Tu es rendu muet pour le moment' });
    if (isBlocked(target.id, uid) || isBlocked(uid, target.id) || isMutedBy(target.id, uid)) return ack && ack({ error: 'Appel impossible avec cette personne pour le moment' });
    if ((!isVerified(u) && !isStaff(target)) || (!isVerified(target) && !isStaff(u))) return ack && ack({ error: '🛂 Appel impossible tant que la douane n\'est pas passée' });
    // Sans badge, on ne peut appeler / être appelé que par l'équipe (pour se faire valider)
    if (!isStaff(target) && !voiceAllowed(u)) return ack && ack({ error: VOICE_NEEDED });
    if (!isStaff(target) && video && !camAllowed(u)) return ack && ack({ error: CAM_NEEDED });
    if (!isStaff(u) && !voiceAllowed(target)) return ack && ack({ error: `${target.username} n'a pas encore le badge 🎙️ voix : il ne peut pas encore être appelé` });
    if (callOfSocket.has(socket.id) || userInCall(uid)) return ack && ack({ error: 'Tu es déjà en appel' });
    if (userInCall(target.id)) return ack && ack({ error: `${target.username} est déjà en appel` });
    if (tooMany('call:' + uid, 20, 10 * 60 * 1000)) return ack && ack({ error: 'Trop d\'appels, patiente un peu' });
    const callId = crypto.randomBytes(8).toString('hex');
    const c = { callerId: uid, callerSocket: socket.id, calleeId: target.id, calleeSocket: null, video: !!video, accepted: false };
    c.timer = setTimeout(() => endCall(callId, { reason: `${target.username} ne répond pas`, missed: true }), 35000);
    calls.set(callId, c);
    callOfSocket.set(socket.id, callId);
    emitToUser(target.id, 'call_incoming', { callId, from: publicUser(u), video: !!video });
    ack && ack({ callId, to: publicUser(target) });
  });
  socket.on('call_accept', callId => {
    const c = calls.get(String(callId));
    if (!c || c.accepted || c.calleeId !== uid) return;
    if (callOfSocket.has(socket.id)) return;
    c.accepted = true;
    c.startedAt = now();
    c.calleeSocket = socket.id;
    clearTimeout(c.timer);
    callOfSocket.set(socket.id, String(callId));
    const e = online.get(uid);
    if (e) for (const sid of e.sockets) if (sid !== socket.id) io.to(sid).emit('call_cancelled', { callId });
    io.to(c.callerSocket).emit('call_accepted', { callId });
  });
  socket.on('call_decline', callId => {
    const c = calls.get(String(callId));
    if (!c || c.accepted || c.calleeId !== uid) return;
    endCall(String(callId), { reason: `${current().username} a refusé l'appel` });
  });
  socket.on('call_end', callId => {
    const c = calls.get(String(callId));
    if (!c || (c.callerSocket !== socket.id && c.calleeSocket !== socket.id)) return;
    endCall(String(callId), { by: socket.id, reason: 'Appel terminé', missed: !c.accepted });
  });
  socket.on('call_signal', ({ callId, data } = {}) => {
    const c = calls.get(String(callId));
    if (!c || !c.accepted || !data) return;
    const other = socket.id === c.callerSocket ? c.calleeSocket : socket.id === c.calleeSocket ? c.callerSocket : null;
    if (other) io.to(other).emit('call_signal', { callId, data });
  });
  socket.on('call_media', ({ callId, video, muted } = {}) => {
    const c = calls.get(String(callId));
    if (!c || !c.accepted) return;
    const other = socket.id === c.callerSocket ? c.calleeSocket : c.callerSocket;
    io.to(other).emit('call_media', { callId, video: !!video, muted: !!muted });
    c.cam = c.cam || {};
    if (video && c.cam[socket.id] === false) io.to(other).emit('call_notice', { callId, text: `📷 ${entry.user.username} a allumé sa caméra` });
    c.cam[socket.id] = !!video;
  });

  // ----- Capture d'écran : on prévient les personnes concernées (comme sur Snapchat) -----
  socket.on('screenshot', (ctx = {}) => {
    const u = current();
    if (!u || entry.ghost) return; // le super-admin en mode fantôme reste invisible
    if (tooMany('shot:' + uid, 4, 30 * 1000)) return;
    const name = u.username;
    const cid = callOfSocket.get(socket.id);
    const call = cid && calls.get(cid);
    if (call && call.accepted) {
      // Pendant un appel : l'autre personne est prévenue tout de suite
      const other = socket.id === call.callerSocket ? call.calleeSocket : call.callerSocket;
      io.to(other).emit('call_notice', { callId: cid, text: `📸 ${name} a fait une capture d'écran de l'appel` });
      const otherId = other === call.callerSocket ? call.callerId : call.calleeId;
      log(u, 'screenshot', `📸 Capture d'écran pendant un appel`);
      if (otherId) notify(otherId, { type: 'screenshot', icon: '📸', title: `${name} a fait une capture d'écran`, text: 'Pendant votre appel.' });
      return;
    }
    if (ctx.pm) {
      const target = getUser(parseInt(ctx.pm, 10));
      if (!target || target.id === uid) return;
      notify(target.id, { type: 'screenshot', icon: '📸', title: `${name} a fait une capture d'écran`, text: 'De votre conversation privée.', data: { from: uid } });
      emitToUser(target.id, 'screenshot_alert', { from: uid, username: name });
      log(u, 'screenshot', `📸 Capture d'écran de la conversation privée avec ${target.username}`);
      return;
    }
    if (entry.room) {
      const room = getRoomBySlug(entry.room);
      io.to('room:' + entry.room).emit('system', { room: entry.room, text: `📸 ${name} a fait une capture d'écran du salon` });
      log(u, 'screenshot', `📸 Capture d'écran du salon « ${room?.name || entry.room} »`);
    }
  });

  // ----- Vocal -----
  const myVoiceRoom = () => { for (const r of socket.rooms) if (r.startsWith('room:')) return r.slice(5); return null; };
  // opts.listen = true : on écoute le vocal sans micro (on entend ceux qui parlent, sans parler)
  socket.on('voice_join', (opts, ack) => {
    const listen = !!(opts && opts.listen);
    const u = current();
    const slug = myVoiceRoom();
    const room = slug && getRoomBySlug(slug);
    const s = getSettings();
    if (!room) return ack && ack({ error: 'Rejoins un salon d\'abord' });
    if (s.voiceEnabled !== '1' || !room.voice_enabled) return ack && ack({ error: 'Le vocal est désactivé dans ce salon' });
    if (roomAccess(u, room)) return ack && ack({ error: roomAccess(u, room) });
    if (!listen && u.muted_until && u.muted_until > now()) return ack && ack({ error: 'Tu es rendu muet pour le moment' });
    if (u.refused && !isVerified(u)) return ack && ack({ error: '❌ Ta demande a été refusée' });
    if (!listen && slug !== 'douane' && !voiceAllowed(u)) return ack && ack({ error: VOICE_NEEDED, needVoice: true });
    const mine = voice.get(slug)?.get(socket.id);
    if (mine && !!mine.listener === listen) return ack && ack({ peers: voiceList(slug).filter(p => p.socketId !== socket.id && (!listen || !p.listener)) });
    leaveVoiceBySocket(socket.id, null);
    const max = parseInt(s.voiceMax, 10) || 10;
    const all = voiceList(slug);
    if (!listen && all.filter(p => !p.listener).length >= max) return ack && ack({ error: `Le vocal est plein (${max} personnes maximum) : tu peux écouter 🎧 en attendant` });
    if (listen && all.filter(p => p.listener).length >= 25) return ack && ack({ error: 'Trop de monde écoute déjà ce vocal' });
    // Un auditeur ne se connecte qu'à ceux qui parlent ; quelqu'un qui parle se connecte à tout le monde
    const peers = listen ? all.filter(p => !p.listener) : all;
    if (!voice.has(slug)) voice.set(slug, new Map());
    voice.get(slug).set(socket.id, { userId: uid, username: u.username, color: u.color, ...miniUser(u), muted: listen, video: false, listener: listen, micSince: listen ? 0 : now(), micUntil: 0 });
    log(u, 'voice_join', listen ? `Écoute le vocal du salon ${room.name} 🎧` : `A rejoint le vocal du salon ${room.name}`);
    voiceOf.set(socket.id, slug);
    ack && ack({ peers, camBlocked: camBlocksOf(uid) });
    emitVoiceState(slug);
    emitCamBlockedMe(socket.id);
    // Ceux que je bloque et qui sont déjà dans ce vocal : on leur indique que ma caméra ne leur est pas partagée
    const mine2 = new Set(camBlocksOf(uid));
    for (const p of voiceList(slug)) if (mine2.has(p.userId)) emitCamBlockedMe(p.socketId);
  });
  socket.on('voice_leave', () => leaveVoiceBySocket(socket.id, null));
  // ----- Son relayé par le site (quand la connexion directe entre deux personnes est impossible) -----
  socket.on('voice_relay_need', peerId => {
    const slug = voiceOf.get(socket.id);
    peerId = String(peerId || '');
    if (!slug || voiceOf.get(peerId) !== slug) return;
    io.to(peerId).emit('voice_relay_peer', { peer: socket.id });
    socket.emit('voice_relay_peer', { peer: peerId });
  });
  socket.on('voice_relay_audio', (msg = {}) => {
    const slug = voiceOf.get(socket.id);
    const p = slug && voice.get(slug)?.get(socket.id);
    if (!p || p.listener || p.muted) return;
    const data = msg.data;
    const size = data?.byteLength ?? data?.length ?? 0;
    if (!size || size > 6000 || !Array.isArray(msg.to)) return;
    for (const to of msg.to.slice(0, 40)) {
      const id = String(to);
      if (id !== socket.id && voiceOf.get(id) === slug) io.to(id).emit('voice_relay_audio', { from: socket.id, data });
    }
  });
  socket.on('voice_video', on => {
    const slug = voiceOf.get(socket.id);
    const p = slug && voice.get(slug)?.get(socket.id);
    if (!p || p.listener) return;
    if (on && slug !== 'douane' && !camAllowed(entry.user)) { socket.emit('voice_cam_refused', { error: CAM_NEEDED }); return; }
    const was = p.video;
    p.video = !!on;
    emitVoiceState(slug);
    // Prévenir le salon quand quelqu'un allume sa caméra
    if (p.video && !was && !entry.ghost) {
      io.to('room:' + slug).emit('system', { room: slug, text: `📷 ${entry.user.username} a allumé sa caméra` });
      io.to('room:' + slug).emit('cam_alert', { room: slug, userId: uid, username: entry.user.username });
    }
  });
  socket.on('voice_signal', ({ to, data } = {}) => {
    const slug = voiceOf.get(socket.id);
    if (!slug || voiceOf.get(String(to)) !== slug || !data) return;
    const m = voice.get(slug);
    if (m?.get(socket.id)?.listener && m?.get(String(to))?.listener) return;
    io.to(String(to)).emit('voice_signal', { from: socket.id, data });
  });
  // Caméras que j'ai à l'écran (pour que leurs propriétaires sachent qui les regarde)
  socket.on('cam_watching', list => {
    const slug = voiceOf.get(socket.id);
    if (!slug || !Array.isArray(list)) return;
    const now = new Set(list.slice(0, 40).map(String).filter(id => id !== socket.id && voiceOf.get(id) === slug));
    const before = watching.get(socket.id) || new Set();
    watching.set(socket.id, now);
    for (const id of new Set([...before, ...now])) if (before.has(id) !== now.has(id)) emitCamViewers(id);
  });
  // Ne plus partager (ou partager de nouveau) sa caméra avec quelqu'un
  socket.on('cam_block', ({ userId, block } = {}, ack) => {
    const target = getUser(parseInt(userId, 10));
    if (!target || target.id === uid) return ack && ack({ error: 'Personne introuvable' });
    if (block) db.prepare('INSERT OR IGNORE INTO cam_blocks (owner_id, viewer_id, created_at) VALUES (?,?,?)').run(uid, target.id, now());
    else db.prepare('DELETE FROM cam_blocks WHERE owner_id=? AND viewer_id=?').run(uid, target.id);
    ack && ack({ ok: true, blocked: camBlocksOf(uid) });
    // Prévenir la personne concernée (dans le vocal) et mettre à jour la liste de ceux qui regardent
    const e = online.get(target.id);
    if (e) for (const sid of e.sockets) if (voiceOf.get(sid)) emitCamBlockedMe(sid);
    for (const sid of entry.sockets) if (voiceOf.get(sid)) emitCamViewers(sid);
  });
  socket.on('cam_blocks', ack => {
    if (typeof ack !== 'function') return;
    const ids = camBlocksOf(uid);
    ack({ blocked: ids.map(id => { const u = getUser(id); return u && { userId: u.id, username: u.username, color: u.color, avatar: u.avatar }; }).filter(Boolean) });
  });

  socket.on('voice_mute', muted => {
    const slug = voiceOf.get(socket.id);
    const p = slug && voice.get(slug)?.get(socket.id);
    if (!p || p.listener) return;
    p.muted = !!muted;
    emitVoiceState(slug);
  });
  socket.on('voice_kick', (targetSocketId, ack) => {
    const slug = voiceOf.get(String(targetSocketId));
    const room = slug && getRoomBySlug(slug);
    if (!room || !canManageRoom(current(), room)) return ack && ack({ error: 'Action non autorisée' });
    const target = voice.get(slug)?.get(String(targetSocketId));
    if (!target) return ack && ack({ error: 'Cette personne n\'est plus dans le vocal' });
    if (target.userId === room.owner_id) return ack && ack({ error: 'Impossible de retirer le propriétaire' });
    leaveVoiceBySocket(String(targetSocketId), 'Tu as été retiré du vocal');
    notify(target.userId, { type: 'voice_kick', icon: '🎙️', title: `Tu as été retiré du vocal de « ${room.name} »`, text: `Par ${displayName(current())}.` });
    ack && ack({ ok: true });
  });

  socket.on('disconnect', () => {
    leaveVoiceBySocket(socket.id, null);
    const cid = callOfSocket.get(socket.id);
    if (cid) endCall(cid, { by: socket.id, reason: 'Ton correspondant s\'est déconnecté' });
    entry.sockets.delete(socket.id);
    if (entry.sockets.size === 0) {
      online.delete(uid);
      Games.onUserGone(uid);
      db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(now(), uid);
      // On attend 15 s avant d'annoncer le départ : si la personne revient tout de suite, on n'affiche rien
      if (entry.room && !entry.ghost) {
        const room = entry.room, name = entry.user.username;
        const timer = setTimeout(() => {
          recentLeave.delete(uid);
          if (!online.has(uid)) io.to('room:' + room).emit('system', { room, text: `${name} s'est déconnecté` });
        }, 15000);
        recentLeave.set(uid, { room, timer });
      }
      schedulePresence();
    }
  });
});

// ModoBot : avertit dans le salon, puis rend muet en cas de récidive
const modStrikes = new Map(); // userId -> { points, at, mutes, muteAt }
function modBotSay(slug, content) {
  io.to('room:' + slug).emit('message', { room: slug, id: 'mod' + now() + Math.random().toString(36).slice(2, 6), userId: 0, username: 'ModoBot', color: '#ff5a6e', gender: 'x', role: 'bot', avatar: '', bot: true, botIcon: '🛡️', content, createdAt: now(), kind: 'text' });
}
function modBotStrike(u, room, scanned) {
  const st = getSettings();
  if (st.modBotEnabled === '0') return;
  log(null, 'modbot', `🛡️ ModoBot : message de ${u.username} masqué dans « ${room.name} » (${scanned.found.join(', ')})`);
  if (isStaff(u)) return; // l'équipe n'est pas sanctionnée, le mot est juste masqué
  const max = Math.min(10, Math.max(1, parseInt(st.modBotWarnings, 10) || 3));
  const base = Math.min(1440, Math.max(1, parseInt(st.modBotMuteMinutes, 10) || 5));
  const t = now();
  const s = modStrikes.get(u.id) || { points: 0, at: t, mutes: 0, muteAt: 0 };
  if (t - s.at > 30 * 60 * 1000) s.points = 0;          // les avertissements s'effacent après 30 min
  if (t - s.muteAt > 24 * 3600 * 1000) s.mutes = 0;     // la récidive s'efface après 24 h
  s.points += scanned.level; s.at = t;
  modStrikes.set(u.id, s);
  if (s.points < max) {
    const grave = scanned.level >= 2;
    modBotSay(room.slug, `${grave ? '⛔' : '⚠️'} @${u.username}, ${grave ? 'les insultes ne sont pas tolérées ici' : 'surveille ton langage'} ! Avertissement ${s.points}/${max}${grave ? ' (compte double)' : ''}.`);
    return;
  }
  // Sanction : muet, de plus en plus long en cas de récidive (5, 10, 20 min…)
  const minutes = Math.min(1440, base * 2 ** s.mutes);
  s.mutes++; s.muteAt = t; s.points = 0;
  const until = t + minutes * 60000;
  db.prepare('UPDATE users SET muted_until=? WHERE id=?').run(until, u.id);
  log(null, 'mute', `🛡️ ModoBot : ${u.username} rendu muet ${fmtDuration(minutes)} (langage grossier)`);
  notify(u.id, { type: 'mute', icon: '🔇', title: `Tu es rendu muet pendant ${fmtDuration(minutes)}`, text: 'Le ModoBot t\'a averti plusieurs fois pour langage grossier ou insultes.', data: { until }, important: true });
  const e = online.get(u.id);
  if (e) for (const sid of e.sockets) {
    leaveVoiceBySocket(sid, null);
    if (callOfSocket.has(sid)) endCall(callOfSocket.get(sid), { by: sid, reason: 'Appel interrompu' });
  }
  modBotSay(room.slug, `🔇 ${u.username} est rendu muet pendant ${fmtDuration(minutes)} pour langage grossier. Restons respectueux 💜`);
  emitToStaff('staff_alert', { text: `🛡️ ModoBot a rendu ${u.username} muet ${fmtDuration(minutes)} (dans ${room.name})` });
}

// ---------- Salon « Patch note » : le bot annonce les nouveautés (voir patchnotes.js) ----------
const PATCH_SLUG = 'patchnote';
const PATCH_BOT = { username: 'Patch Note Bot', color: '#7cc8ff', icon: '📝' };
function patchText(n) {
  const d = new Date(n.date + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
  const part = (t, list) => list && list.length ? `\n\n${t}\n` + list.map(x => '• ' + x).join('\n') : '';
  return `theparadise bonjour\n\n📝 Patch note n°${n.id} du ${d}${n.title ? ' : ' + n.title : ''}`
    + part('✨ Ajouts', n.added) + part('🔧 Modifications', n.changed) + part('🗑️ Retraits', n.removed)
    + '\n\ncreate by Anthony';
}
const patchMsg = n => ({ room: PATCH_SLUG, id: 'patch' + n.id, userId: 0, username: PATCH_BOT.username, color: PATCH_BOT.color, gender: 'x', role: 'bot', avatar: '', bot: true, botIcon: PATCH_BOT.icon, content: patchText(n), createdAt: new Date(n.date + 'T12:00:00Z').getTime(), kind: 'text' });
const patchHistory = () => { try { delete require.cache[require.resolve('./patchnotes')]; return require('./patchnotes').map(patchMsg); } catch (e) { console.error('patchnotes.js', e.message); return []; } };
const patchLast = () => { try { return Math.max(0, ...require('./patchnotes').map(n => n.id)); } catch (e) { return 0; } };

const EDIT_WINDOW = 15 * 60 * 1000; // on peut corriger son message pendant 15 minutes
function msgOut(m) {
  // Message signé « Modération » (super-admin en mode fantôme anonyme) : l'identité reste visible dans l'admin
  if (m.anon) return { id: m.id, userId: 0, username: 'Modération', color: '#c3b8ff', gender: 'x', role: 'moderation', avatar: '', nameEffect: 'glow', frame: 'none', isBirthday: false,
    content: m.content, createdAt: m.created_at, kind: m.kind || 'text', media: m.media || '', duration: m.duration || 0, anon: true };
  return { id: m.id, userId: m.user_id, username: m.username, color: m.color, gender: m.gender, role: m.role, ...miniUser(m), content: m.content, createdAt: m.created_at, kind: m.kind || 'text', media: m.media || '', duration: m.duration || 0, editedAt: m.edited_at || 0 };
}

// Nettoyage : invités inactifs depuis 24 h et vieux messages (30 jours)
setInterval(() => {
  const day = now() - 24 * 3600 * 1000;
  const ids = db.prepare('SELECT id FROM users WHERE is_guest=1 AND banned=0 AND last_seen<?').all(day).map(r => r.id).filter(id => !online.has(id));
  ids.forEach(id => deleteUserRecord(getUser(id)));
  db.prepare('DELETE FROM messages WHERE created_at<?').run(now() - 30 * 24 * 3600 * 1000);
  db.prepare('DELETE FROM notifications WHERE created_at<?').run(now() - 30 * 24 * 3600 * 1000);
  db.prepare('DELETE FROM logs WHERE created_at<?').run(now() - 90 * 24 * 3600 * 1000);
  db.prepare("DELETE FROM private_messages WHERE kind='audio' AND created_at<?").run(now() - 30 * 24 * 3600 * 1000);
  for (const f of fs.readdirSync(uploadDir)) {
    if (!f.startsWith('audio-') && !f.startsWith('img-')) continue;
    try { if (fs.statSync(path.join(uploadDir, f)).mtimeMs < now() - 30 * 24 * 3600 * 1000) fs.unlinkSync(path.join(uploadDir, f)); } catch (e) {}
  }
}, 3600 * 1000).unref();

let lastTheme = activeTheme();
setInterval(() => {
  const t = activeTheme();
  if (t !== lastTheme) { lastTheme = t; io.emit('site_changed', { site: siteInfo() }); }
  for (const e of online.values()) celebrateBirthday(getUser(e.user.id));
}, 10 * 60 * 1000).unref();

server.listen(PORT, () => console.log(`✨ The Paradise en ligne sur http://localhost:${PORT}`));
