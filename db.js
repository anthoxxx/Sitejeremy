// Base de données SQLite de The Paradise
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'gajoxgaming.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  gender TEXT NOT NULL DEFAULT 'x',
  age INTEGER,
  city TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  color TEXT DEFAULT '#8b6cff',
  role TEXT NOT NULL DEFAULT 'user',
  is_guest INTEGER NOT NULL DEFAULT 0,
  banned INTEGER NOT NULL DEFAULT 0,
  ban_reason TEXT DEFAULT '',
  muted_until INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '💬',
  sort INTEGER DEFAULT 0,
  members_only INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, id);
CREATE TABLE IF NOT EXISTS private_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pm_pair ON private_messages(from_id, to_id, id);
CREATE TABLE IF NOT EXISTS blocks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, blocked_id)
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  actor_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at INTEGER NOT NULL
);
`);

// ---------- Migrations (ajout de colonnes sur une base existante) ----------
function addColumn(table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
addColumn('rooms', 'owner_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
addColumn('rooms', 'is_private', 'INTEGER NOT NULL DEFAULT 0');
addColumn('rooms', 'station_id', 'INTEGER');
addColumn('rooms', 'voice_enabled', 'INTEGER NOT NULL DEFAULT 1');
// Personnalisation du profil
addColumn('users', 'avatar', "TEXT DEFAULT ''");
addColumn('users', 'banner', "TEXT DEFAULT ''");
addColumn('users', 'banner_style', "TEXT DEFAULT 'aurora'");
addColumn('users', 'accent', "TEXT DEFAULT '#ff5fa2'");
addColumn('users', 'name_effect', "TEXT DEFAULT 'none'");
addColumn('users', 'avatar_frame', "TEXT DEFAULT 'none'");
addColumn('users', 'status_emoji', "TEXT DEFAULT ''");
addColumn('users', 'status_text', "TEXT DEFAULT ''");
addColumn('users', 'interests', "TEXT DEFAULT '[]'");
addColumn('users', 'games', "TEXT DEFAULT '[]'");
addColumn('users', 'socials', "TEXT DEFAULT '{}'");
addColumn('users', 'show_age', 'INTEGER NOT NULL DEFAULT 1');
addColumn('users', 'show_city', 'INTEGER NOT NULL DEFAULT 1');
// Limite de comptes par personne + fonds d'écran de salon + état des radios
addColumn('users', 'device_id', "TEXT DEFAULT ''");
addColumn('users', 'signup_ip', "TEXT DEFAULT ''");
addColumn('users', 'ghost', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'ghost_anon', 'INTEGER NOT NULL DEFAULT 0');
// Douane : les comptes déjà inscrits au moment où la douane arrive sont considérés comme vérifiés
{
  const had = db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'verified');
  addColumn('users', 'verified', 'INTEGER NOT NULL DEFAULT 0');
  if (!had) db.prepare('UPDATE users SET verified=1 WHERE is_guest=0').run();
  addColumn('users', 'refused', 'INTEGER NOT NULL DEFAULT 0'); // refusé à la douane
  // Deux validations à la douane : la voix et la caméra (il faut les deux pour être accepté)
  const hadVoice = db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'voice_ok');
  addColumn('users', 'voice_ok', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('users', 'cam_ok', 'INTEGER NOT NULL DEFAULT 0');
  if (!hadVoice) db.prepare('UPDATE users SET voice_ok=1, cam_ok=1 WHERE verified=1').run(); // les comptes déjà acceptés gardent leur accès
  // Photo de profil vérifiée par le staff (badge V) ; une nouvelle photo attend la vérification
  const hadPhoto = db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'avatar_ok');
  addColumn('users', 'avatar_ok', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('users', 'avatar_pending', "TEXT NOT NULL DEFAULT ''");
  if (!hadPhoto) db.prepare("UPDATE users SET avatar_ok=1 WHERE avatar<>''").run(); // les photos déjà en ligne sont considérées vérifiées
  // Niveaux de modérateur (1, 2, 3) et sanctions à durée limitée
  addColumn('users', 'mod_level', 'INTEGER NOT NULL DEFAULT 1');
  addColumn('users', 'ban_until', 'INTEGER NOT NULL DEFAULT 0');   // 0 = jusqu'à ce qu'on le lève
  addColumn('users', 'ban_kind', "TEXT NOT NULL DEFAULT 'ban'");   // kick (expulsion), exclusion ou ban
}
addColumn('users', 'birth_day', 'INTEGER DEFAULT 0');
addColumn('users', 'birth_month', 'INTEGER DEFAULT 0');
addColumn('users', 'show_birthday', 'INTEGER NOT NULL DEFAULT 1');
addColumn('users', 'bday_year', 'INTEGER DEFAULT 0');
addColumn('messages', 'anon', 'INTEGER NOT NULL DEFAULT 0');
addColumn('logs', 'category', "TEXT DEFAULT 'system'");
addColumn('logs', 'ip', "TEXT DEFAULT ''");
addColumn('logs', 'data', "TEXT DEFAULT '{}'");
addColumn('messages', 'kind', "TEXT DEFAULT 'text'");
addColumn('messages', 'media', "TEXT DEFAULT ''");
addColumn('messages', 'duration', 'INTEGER DEFAULT 0');
addColumn('private_messages', 'kind', "TEXT DEFAULT 'text'");
addColumn('private_messages', 'media', "TEXT DEFAULT ''");
addColumn('private_messages', 'duration', 'INTEGER DEFAULT 0');
addColumn('messages', 'edited_at', 'INTEGER NOT NULL DEFAULT 0'); // message corrigé par son auteur
addColumn('private_messages', 'edited_at', 'INTEGER NOT NULL DEFAULT 0');
db.exec('CREATE INDEX IF NOT EXISTS idx_logs_cat ON logs(category, id)');
db.exec(`
CREATE TABLE IF NOT EXISTS cam_blocks (
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, viewer_id)
);
CREATE TABLE IF NOT EXISTS mod_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  motivation TEXT NOT NULL DEFAULT '',
  availability TEXT NOT NULL DEFAULT '',
  experience TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by TEXT NOT NULL DEFAULT '',
  decided_at INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS staff_codes (
  code TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  uses_left INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER,
  note TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS room_managers (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, user_id)
);
CREATE TABLE IF NOT EXISTS user_mutes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  until INTEGER NOT NULL,
  PRIMARY KEY (user_id, muted_id)
);
CREATE TABLE IF NOT EXISTS game_scores (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  best INTEGER,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  played INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, game)
);
`);
addColumn('rooms', 'background', "TEXT DEFAULT ''");
addColumn('rooms', 'temporary', 'INTEGER NOT NULL DEFAULT 0');
addColumn('rooms', 'empty_since', 'INTEGER');

// Rôle super-admin : s'il n'y en a pas encore, le plus ancien admin le devient
if (!db.prepare("SELECT 1 FROM users WHERE role='superadmin'").get()) {
  const oldest = db.prepare("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1").get();
  if (oldest) db.prepare("UPDATE users SET role='superadmin' WHERE id=?").run(oldest.id);
}

db.exec(`
CREATE TABLE IF NOT EXISTS room_members (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, user_id)
);
CREATE TABLE IF NOT EXISTS room_mods (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room_id, user_id)
);
CREATE TABLE IF NOT EXISTS room_bans (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, user_id)
);
CREATE TABLE IF NOT EXISTS stations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  genre TEXT DEFAULT '',
  icon TEXT DEFAULT '📻',
  sort INTEGER DEFAULT 0
);
`);

// Sanctions de salon avec durée et motif (expulsion 1 h, exclusion 5 h, bannissement à vie)
addColumn('room_bans', 'until', 'INTEGER NOT NULL DEFAULT 0');
addColumn('room_bans', 'reason', "TEXT NOT NULL DEFAULT ''");
addColumn('room_bans', 'kind', "TEXT NOT NULL DEFAULT 'ban'");
addColumn('room_bans', 'by_name', "TEXT NOT NULL DEFAULT ''");
addColumn('room_bans', 'created_at', 'INTEGER NOT NULL DEFAULT 0');

db.exec(`
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  icon TEXT DEFAULT '🔔',
  title TEXT NOT NULL,
  text TEXT DEFAULT '',
  data TEXT DEFAULT '{}',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, id);
`);

addColumn('stations', 'status', "TEXT DEFAULT 'unknown'");
addColumn('stations', 'checked_at', 'INTEGER DEFAULT 0');
addColumn('stations', 'check_note', "TEXT DEFAULT ''");
addColumn('users', 'panel', 'INTEGER DEFAULT 0'); // compte de l'espace admin (identifiant + mot de passe du serveur)

// Salon « Douane » (contrôle des nouveaux arrivants)
if (!db.prepare("SELECT 1 FROM rooms WHERE slug='douane'").get()) {
  db.prepare('INSERT INTO rooms (slug,name,description,icon,sort,members_only,created_at) VALUES (?,?,?,?,?,?,?)')
    .run('douane', 'Douane', 'Les nouveaux arrivants passent ici pour être vérifiés par le staff', '🛂', 0, 0, Date.now());
}

// Radios par défaut (modifiables dans l'admin → Radios)
if (db.prepare('SELECT COUNT(*) c FROM stations').get().c === 0) {
  const ins = db.prepare('INSERT INTO stations (name,url,genre,icon,sort) VALUES (?,?,?,?,?)');
  [
    ['NRJ', 'https://scdn.nrjaudio.fm/adwz2/fr/30001/mp3_128.mp3?origine=fluxradios', 'Hits', '⚡', 1],
    ['Chérie FM', 'https://scdn.nrjaudio.fm/adwz2/fr/30201/mp3_128.mp3?origine=fluxradios', 'Love songs', '💖', 2],
    ['Nostalgie', 'https://scdn.nrjaudio.fm/adwz2/fr/30601/mp3_128.mp3?origine=fluxradios', 'Années 70-80', '📼', 3],
    ['Rire & Chansons', 'https://scdn.nrjaudio.fm/adwz2/fr/30401/mp3_128.mp3?origine=fluxradios', 'Humour', '😂', 4],
    ['Skyrock', 'https://icecast.skyrock.net/s/natio_mp3_128k', 'Rap / RnB', '🎤', 5],
    ['Fun Radio', 'https://streamer-02.rtl.fr/fun-1-44-128', 'Dance / Électro', '🪩', 6],
    ['RTL2', 'https://streamer-02.rtl.fr/rtl2-1-44-128', 'Pop-rock', '🎸', 7],
    ["Mouv'", 'https://icecast.radiofrance.fr/mouv-midfi.mp3', 'Hip-hop', '🎧', 8],
    ['FIP', 'https://icecast.radiofrance.fr/fip-midfi.mp3', 'Éclectique', '🎷', 9],
    ['France Inter', 'https://icecast.radiofrance.fr/franceinter-midfi.mp3', 'Généraliste', '📰', 10],
  ].forEach(r => ins.run(...r));
}

// Salons par défaut
const roomCount = db.prepare("SELECT COUNT(*) c FROM rooms WHERE slug<>'douane'").get().c;
if (roomCount === 0) {
  const ins = db.prepare('INSERT INTO rooms (slug,name,description,icon,sort,members_only,created_at) VALUES (?,?,?,?,?,?,?)');
  const now = Date.now();
  [
    ['general', 'Général', 'Le salon principal, pour discuter de tout', '✨', 1, 0],
    ['rencontres', 'Rencontres', 'Faire de nouvelles rencontres', '💞', 2, 0],
    ['18-25', '18 – 25 ans', 'Le salon des jeunes adultes', '🎧', 3, 0],
    ['25-40', '26 – 40 ans', 'Pour les trentenaires et plus', '🍷', 4, 0],
    ['40-plus', '40 ans et +', 'Entre personnes de plus de 40 ans', '🌙', 5, 0],
    ['amitie', 'Amitié', 'Se faire des amis, sans prise de tête', '🤝', 6, 0],
    ['gaming', 'Jeux vidéo', 'Gamers de tous horizons', '🎮', 7, 0],
    ['musique', 'Musique', 'Partage tes sons du moment', '🎵', 8, 0],
    ['membres', 'Salon VIP', 'Réservé aux membres inscrits', '💎', 9, 1],
  ].forEach(r => ins.run(...r, now));
}
// Salon Karaoké (avec le KaraoBot)
if (!db.prepare("SELECT 1 FROM rooms WHERE slug='karaoke'").get()) {
  db.prepare("UPDATE rooms SET sort=sort+1 WHERE owner_id IS NULL AND sort>=9 AND slug<>'douane'").run();
  db.prepare('INSERT INTO rooms (slug,name,description,icon,sort,members_only,created_at) VALUES (?,?,?,?,?,?,?)')
    .run('karaoke', 'Karaoké', 'Choisis ta chanson avec le KaraoBot et prends le micro ! 🎶', '🎤', 9, 0, Date.now());
}
// Salon TV (avec le TV Bot)
if (!db.prepare("SELECT 1 FROM rooms WHERE slug='tv'").get()) {
  const vip = db.prepare("SELECT sort FROM rooms WHERE slug='membres'").get();
  const sort = vip ? vip.sort : 10;
  db.prepare("UPDATE rooms SET sort=sort+1 WHERE owner_id IS NULL AND sort>=? AND slug<>'douane'").run(sort);
  db.prepare('INSERT INTO rooms (slug,name,description,icon,sort,members_only,created_at) VALUES (?,?,?,?,?,?,?)')
    .run('tv', 'TV du monde', 'Regardez ensemble les chaînes de télé du monde entier avec le TV Bot 📺', '📺', sort, 0, Date.now());
}
// Salon « La Roue du Paradise » (jeu de lettres avec une roue, animé par le Roue Bot)
if (!db.prepare("SELECT 1 FROM rooms WHERE slug='roue'").get()) {
  const tv = db.prepare("SELECT sort FROM rooms WHERE slug='tv'").get();
  const sort = tv ? tv.sort + 1 : 11;
  db.prepare("UPDATE rooms SET sort=sort+1 WHERE owner_id IS NULL AND sort>=? AND slug NOT IN ('douane','patchnote')").run(sort);
  db.prepare('INSERT INTO rooms (slug,name,description,icon,sort,members_only,created_at) VALUES (?,?,?,?,?,?,?)')
    .run('roue', 'La Roue du Paradise', 'Tourne la roue, trouve les lettres et gagne la partie avec le Roue Bot 🎡', '🎡', sort, 0, Date.now());
}
// Salon « Patch note » : personne n'y écrit, seul le bot y annonce les nouveautés du site
if (!db.prepare("SELECT 1 FROM rooms WHERE slug='patchnote'").get()) {
  const top = db.prepare('SELECT MIN(sort) s FROM rooms WHERE owner_id IS NULL').get();
  db.prepare('INSERT INTO rooms (slug,name,description,icon,sort,members_only,created_at) VALUES (?,?,?,?,?,?,?)')
    .run('patchnote', 'Patch note', 'Toutes les nouveautés du site, annoncées par le bot 📝', '📝', (top && top.s != null ? top.s : 0) - 1, 0, Date.now());
  db.prepare("UPDATE rooms SET voice_enabled=0 WHERE slug='patchnote'").run();
}
// Le salon « 25 – 40 ans » devient « 26 – 40 ans » (18 – 25 ans s'arrête à 25)
db.prepare("UPDATE rooms SET name='26 – 40 ans' WHERE slug='25-40' AND name='25 – 40 ans'").run();

const defaults = {
  announcement: '',
  bannedWords: '',
  guestsAllowed: '1',
  registrationOpen: '1',
  minAge: '18',
  voiceEnabled: '1',
  voiceMax: '10',
  micTimer: '1',
  micStep: '10',
  userRoomsEnabled: '1',
  maxUserRooms: '2',
  maxAccounts: '2',
  theme: 'auto',
  tempRoomsEnabled: '1',
  customsEnabled: '0',
  mediaVerify: '1',
  modBotEnabled: '1',
  modBotWarnings: '3',
  modBotMuteMinutes: '5',
  customsOpen: '1',
  tempRoomMinutes: '5',
  colorRoomPerm: '#4fb3ff',
  colorRoomTemp: '#ffb547',
  siteName: 'The Paradise',
  siteDomain: 'theparadise.fr',
  heroTitle: 'Discute, rencontre, *brille* sur The Paradise.',
  heroText: 'Le chat gratuit et en temps réel : entre dans un salon en quelques secondes, avec ou sans inscription, et fais de nouvelles rencontres partout en France.',
  footerText: 'Fait avec 💜 pour discuter librement',
  colorViolet: '#8b6cff',
  colorRose: '#ff5fa2',
  colorGold: '#ffb547',
  historyContent: `# Notre histoire

The Paradise est né d'une idée simple : créer un endroit chaleureux où l'on peut discuter librement, rencontrer de nouvelles personnes et passer de bons moments ensemble.

## Les débuts

Au départ, ce n'était qu'un petit salon entre amis. Petit à petit, la communauté a grandi, avec de nouveaux salons, le chat vocal, la radio et la visio.

## Notre mission

- Offrir un chat **gratuit** et accessible à tous
- Garder une ambiance **respectueuse** et bienveillante
- Écouter la communauté pour améliorer le site chaque jour

Merci à toutes celles et ceux qui font vivre The Paradise 💜`,
  rulesContent: `# Règlement de The Paradise

En utilisant le site, tu acceptes ce règlement. L'équipe de modération peut sanctionner tout manquement.

## 1. Respect

- Pas d'insultes, de moqueries, de racisme, d'homophobie ou de discrimination
- Pas de harcèlement, en public comme en privé
- Respecte les choix de chacun : si quelqu'un ne veut pas te parler, n'insiste pas

## 2. Contenus interdits

- Aucun contenu pornographique, violent ou illégal
- Pas de spam, de flood ni de publicité
- Pas de partage d'informations personnelles (adresse, téléphone…) sans accord

## 3. Comptes

- **2 comptes maximum** par personne
- Les mineurs ne sont pas autorisés
- Les pseudos insultants ou choquants sont interdits

## 4. Vocal et visio

- Pas d'enregistrement des appels sans l'accord de tout le monde
- Caméra : tenue correcte exigée

## 5. Sanctions

Avertissement, mute temporaire, expulsion ou bannissement définitif selon la gravité. En cas de problème, utilise le bouton **Signaler**.`,
};
const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
for (const [k, v] of Object.entries(defaults)) insSetting.run(k, v);
// 10 micros par vocal au lieu de 8 (si l'ancien réglage par défaut n'avait pas été changé)
if (!db.prepare("SELECT 1 FROM settings WHERE key='voiceMax10'").get()) {
  db.prepare("UPDATE settings SET value='10' WHERE key='voiceMax' AND value='8'").run();
  db.prepare("INSERT INTO settings (key, value) VALUES ('voiceMax10', '1')").run();
}
// Le thème Halloween n'existe plus : retour au thème automatique
db.prepare("UPDATE settings SET value='auto' WHERE key='theme' AND value='halloween'").run();

// Validation de la voix et de la caméra (remplace la douane bloquante) : appliquée une seule fois.
// Les nouveaux venus ont accès à tout le site ; il faut le badge 🎙️ pour parler et 📷 pour la caméra.
// Le salon « Douane » devient le salon « Vérification », où micro et caméra marchent pour tous.
if (!db.prepare("SELECT 1 FROM settings WHERE key='mediaVerifyAutoOn'").get()) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('mediaVerifyAutoOn', '1')").run();
  db.prepare("UPDATE settings SET value='1' WHERE key='mediaVerify'").run();
  db.prepare("UPDATE settings SET value='0' WHERE key='customsEnabled'").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('customsAutoOn', '1')").run();
  db.prepare("UPDATE rooms SET name='Vérification', description='Viens avec ton micro et ta caméra : l''équipe valide tes badges 🎙️ 📷' WHERE slug='douane' AND name='Douane'").run();
}
// Douane obligatoire pour les nouveaux inscrits (activée une fois ; les comptes déjà là restent validés)
if (!db.prepare("SELECT 1 FROM settings WHERE key='customsAutoOn'").get()) {
  db.prepare("UPDATE settings SET value='1' WHERE key='customsEnabled'").run();
  db.prepare("INSERT INTO settings (key, value) VALUES ('customsAutoOn', '1')").run();
}

// Changement de nom : « The Paradis » devient « The Paradise » (theparadise.fr) sur une base déjà existante
{
  const rows = db.prepare("SELECT key, value FROM settings WHERE value LIKE '%Paradis%' OR value LIKE '%theparadis.fr%'").all();
  const upd = db.prepare('UPDATE settings SET value=? WHERE key=?');
  for (const r of rows) {
    const v = r.value.replace(/The Paradis(?!e)/g, 'The Paradise').replace(/theparadis\.fr/g, 'theparadise.fr');
    if (v !== r.value) upd.run(v, r.key);
  }
}

// Une seule fois : les pseudos qui avaient une couleur tirée au hasard prennent la couleur de leur genre
if (!db.prepare("SELECT 1 FROM settings WHERE key='genderColors'").get()) {
  db.prepare(`UPDATE users SET color = CASE gender WHEN 'h' THEN '#4fb3ff' WHEN 'f' THEN '#ff5fa2' ELSE '#a78bfa' END
    WHERE lower(color) IN ('#8b6cff','#ff5fa2','#ffb547','#33d6a6','#4fb3ff','#ff7a59','#c86bff','#f2e94e')`).run();
  db.prepare("INSERT INTO settings (key,value) VALUES ('genderColors','1')").run();
}

// Réglages gardés en mémoire (relus après chaque modification)
let settingsCache = null;
function getSettings() {
  if (!settingsCache) {
    settingsCache = {};
    for (const row of db.prepare('SELECT key,value FROM settings').all()) settingsCache[row.key] = row.value;
  }
  return { ...settingsCache };
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
  settingsCache = null;
}
// ---------- Journal de tout ce qui se passe sur le site ----------
const LOG_CATEGORIES = {
  moderation: ['application', 'staff_code', 'admin_login', 'modbot', 'photo_ok', 'photo_refused', 'screenshot', 'verify', 'unverify', 'customs', 'ban', 'unban', 'mute', 'unmute', 'warn', 'kick', 'delete_user', 'profile_reset', 'role', 'broadcast', 'report_open', 'report_closed'],
  messages: ['message_delete', 'room_clear'],
  accounts: ['register', 'login', 'logout', 'guest', 'admin_auto', 'profile_update', 'account_limit', 'birthday'],
  rooms: ['room_create', 'room_edit', 'room_delete', 'room_kick', 'room_invite', 'room_private', 'room_background'],
  voice: ['voice_join', 'call'],
  games: ['game'],
  reports: ['report_new'],
  system: ['backup', 'settings', 'site', 'station_create', 'station_edit', 'station_delete', 'stations_check', 'ghost'],
};
const categoryOf = action => Object.keys(LOG_CATEGORIES).find(c => LOG_CATEGORIES[c].includes(action)) || 'system';
const logListeners = [];
function log(actor, action, details = '', extra = {}) {
  const entry = {
    actor_id: actor ? actor.id : null, actor_name: actor ? actor.username : 'système', action, details,
    category: categoryOf(action), ip: extra.ip || '', data: JSON.stringify(extra.data || {}), created_at: Date.now(),
  };
  const info = db.prepare('INSERT INTO logs (actor_id,actor_name,action,details,category,ip,data,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(entry.actor_id, entry.actor_name, entry.action, entry.details, entry.category, entry.ip, entry.data, entry.created_at);
  entry.id = info.lastInsertRowid;
  for (const fn of logListeners) { try { fn(entry); } catch (e) {} }
  return entry;
}
log.onEntry = fn => logListeners.push(fn);

module.exports = { db, dataDir, getSettings, setSetting, log };
