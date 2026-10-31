// Base de données SQLite de GajoxGaming
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

db.exec(`
CREATE TABLE IF NOT EXISTS room_members (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
const roomCount = db.prepare('SELECT COUNT(*) c FROM rooms').get().c;
if (roomCount === 0) {
  const ins = db.prepare('INSERT INTO rooms (slug,name,description,icon,sort,members_only,created_at) VALUES (?,?,?,?,?,?,?)');
  const now = Date.now();
  [
    ['general', 'Général', 'Le salon principal, pour discuter de tout', '✨', 1, 0],
    ['rencontres', 'Rencontres', 'Faire de nouvelles rencontres', '💞', 2, 0],
    ['18-25', '18 – 25 ans', 'Le salon des jeunes adultes', '🎧', 3, 0],
    ['25-40', '25 – 40 ans', 'Pour les trentenaires et plus', '🍷', 4, 0],
    ['40-plus', '40 ans et +', 'Entre personnes de plus de 40 ans', '🌙', 5, 0],
    ['amitie', 'Amitié', 'Se faire des amis, sans prise de tête', '🤝', 6, 0],
    ['gaming', 'Jeux vidéo', 'Gamers de tous horizons', '🎮', 7, 0],
    ['musique', 'Musique', 'Partage tes sons du moment', '🎵', 8, 0],
    ['membres', 'Salon VIP', 'Réservé aux membres inscrits', '💎', 9, 1],
  ].forEach(r => ins.run(...r, now));
}

const defaults = {
  announcement: '',
  bannedWords: '',
  guestsAllowed: '1',
  registrationOpen: '1',
  minAge: '18',
  voiceEnabled: '1',
  voiceMax: '8',
  userRoomsEnabled: '1',
  maxUserRooms: '2',
};
const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
for (const [k, v] of Object.entries(defaults)) insSetting.run(k, v);

function getSettings() {
  const out = {};
  for (const row of db.prepare('SELECT key,value FROM settings').all()) out[row.key] = row.value;
  return out;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}
function log(actor, action, details = '') {
  db.prepare('INSERT INTO logs (actor_id,actor_name,action,details,created_at) VALUES (?,?,?,?,?)')
    .run(actor ? actor.id : null, actor ? actor.username : 'système', action, details, Date.now());
}

module.exports = { db, dataDir, getSettings, setSetting, log };
