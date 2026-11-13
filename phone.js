// The Paradise — le téléphone virtuel 📱 : les Snaps 👻 (photos qui disparaissent), les Stories (24 h) et les flammes 🔥
// Les messages et les appels du téléphone utilisent les messages privés et les appels déjà présents sur le site.
const fs = require('fs');
const path = require('path');
const DAY = 86400000;
const parisDay = (ts = Date.now()) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts);

module.exports = function setupPhone({ db, uploadDir, getUser, publicUser, emitToUser, notify, isBlocked, areFriends, friendsOf, track = () => {}, modScan = t => t }) {
  const now = () => Date.now();
  db.exec(`CREATE TABLE IF NOT EXISTS snaps (id INTEGER PRIMARY KEY AUTOINCREMENT, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL, media TEXT NOT NULL DEFAULT '',
    caption TEXT NOT NULL DEFAULT '', seconds INTEGER NOT NULL DEFAULT 5, created_at INTEGER NOT NULL, opened_at INTEGER NOT NULL DEFAULT 0, day TEXT NOT NULL DEFAULT '')`);
  db.exec('CREATE INDEX IF NOT EXISTS snaps_to ON snaps (to_id, opened_at)');
  db.exec('CREATE INDEX IF NOT EXISTS snaps_pair ON snaps (from_id, to_id, day)');
  db.exec(`CREATE TABLE IF NOT EXISTS stories (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, media TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS story_views (story_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (story_id, user_id))`);
  const removeFile = url => { if (url && url.startsWith('/uploads/')) fs.unlink(path.join(uploadDir, path.basename(url)), () => {}); };
  const validImage = (url, uid) => new RegExp(`^/uploads/img-${uid}-[a-f0-9]{12}\\.(jpg|png|gif|webp)$`).test(url) && fs.existsSync(path.join(uploadDir, path.basename(url)));

  // 🔥 Les flammes : le nombre de jours de suite où les deux se sont envoyé un snap
  function streak(a, b) {
    const days = new Set(db.prepare('SELECT day FROM snaps WHERE from_id=? AND to_id=? AND created_at>?').all(a, b, now() - 400 * DAY).map(r => r.day));
    const back = new Set(db.prepare('SELECT day FROM snaps WHERE from_id=? AND to_id=? AND created_at>?').all(b, a, now() - 400 * DAY).map(r => r.day));
    let n = 0, t = now();
    if (!(days.has(parisDay(t)) && back.has(parisDay(t)))) t -= DAY; // aujourd'hui pas encore fait : on compte à partir d'hier
    while (days.has(parisDay(t)) && back.has(parisDay(t))) { n++; t -= DAY; }
    return n;
  }

  function send(from, toIds, url, caption, seconds) {
    const u = getUser(from);
    if (!u || u.is_guest) return { error: 'Inscris-toi pour envoyer des snaps 👻' };
    if (!validImage(url, from)) return { error: 'Photo invalide' };
    const ids = [...new Set((Array.isArray(toIds) ? toIds : [toIds]).map(Number))].filter(id => id && id !== from).slice(0, 20);
    if (!ids.length) return { error: 'Choisis au moins un ami' };
    const cap = modScan(String(caption || '').slice(0, 120));
    const secs = [3, 5, 10, 0].includes(Number(seconds)) ? Number(seconds) : 5;
    let sent = 0;
    for (const id of ids) {
      const v = getUser(id);
      if (!v || isBlocked(id, from) || isBlocked(from, id)) continue;
      if (!areFriends(from, id)) continue; // les snaps, c'est entre amis
      // chaque ami reçoit sa propre copie (elle est effacée quand il l'a vue)
      let media = url;
      if (sent > 0) { const copy = url.replace(/-([a-f0-9]{12})\./, () => '-' + require('crypto').randomBytes(6).toString('hex') + '.'); try { fs.copyFileSync(path.join(uploadDir, path.basename(url)), path.join(uploadDir, path.basename(copy))); media = copy; } catch (e) { continue; } }
      const info = db.prepare('INSERT INTO snaps (from_id,to_id,media,caption,seconds,created_at,day) VALUES (?,?,?,?,?,?,?)').run(from, id, media, cap, secs, now(), parisDay());
      emitToUser(id, 'snap_new', { id: info.lastInsertRowid, from: publicUser(u), createdAt: now() });
      notify(id, { type: 'snap', icon: '👻', title: `${u.username} t'a envoyé un snap`, text: 'Ouvre ton téléphone 📱 pour le voir avant qu\'il disparaisse', data: { userId: from } });
      sent++;
    }
    if (!sent) { removeFile(url); return { error: 'Tu ne peux envoyer des snaps qu\'à tes amis 🤝' }; }
    track(from, 'snap');
    return { ok: true, sent };
  }
  // La boîte de réception : les snaps reçus pas encore ouverts, et l'état des snaps envoyés
  function inbox(uid) {
    const got = db.prepare('SELECT id, from_id, created_at FROM snaps WHERE to_id=? AND opened_at=0 AND created_at>? ORDER BY id DESC').all(uid, now() - 2 * DAY);
    const sent = db.prepare('SELECT to_id, MAX(created_at) at, MAX(opened_at) opened FROM snaps WHERE from_id=? AND created_at>? GROUP BY to_id ORDER BY at DESC LIMIT 30').all(uid, now() - 7 * DAY);
    const people = new Map();
    for (const s of got) { const p = people.get(s.from_id) || { user: publicUser(getUser(s.from_id)), unread: [], lastAt: 0 }; p.unread.push(s.id); p.lastAt = Math.max(p.lastAt, s.created_at); people.set(s.from_id, p); }
    for (const s of sent) { const p = people.get(s.to_id) || { user: publicUser(getUser(s.to_id)), unread: [], lastAt: 0 }; p.sentAt = s.at; p.sentOpened = s.opened > 0; p.lastAt = Math.max(p.lastAt, s.at); people.set(s.to_id, p); }
    for (const id of friendsOf(uid)) if (!people.has(id)) { const v = getUser(id); if (v) people.set(id, { user: publicUser(v), unread: [], lastAt: 0 }); }
    return [...people.entries()].filter(([, p]) => p.user).map(([id, p]) => ({ ...p, streak: streak(uid, id) })).sort((a, b) => (b.unread.length ? 1 : 0) - (a.unread.length ? 1 : 0) || b.lastAt - a.lastAt);
  }
  // Ouvrir un snap : on le voit une seule fois, puis il disparaît
  function open(uid, id) {
    const s = db.prepare('SELECT * FROM snaps WHERE id=? AND to_id=?').get(Number(id), uid);
    if (!s) return { error: 'Ce snap n\'existe plus' };
    if (s.opened_at) return { error: 'Ce snap a déjà été vu 👻' };
    db.prepare('UPDATE snaps SET opened_at=? WHERE id=?').run(now(), s.id);
    const media = s.media;
    setTimeout(() => { removeFile(media); db.prepare("UPDATE snaps SET media='' WHERE id=?").run(s.id); }, ((s.seconds || 10) + 20) * 1000).unref?.();
    const u = getUser(uid);
    emitToUser(s.from_id, 'snap_opened', { by: uid, username: u?.username });
    return { ok: true, media, caption: s.caption, seconds: s.seconds, from: publicUser(getUser(s.from_id)), createdAt: s.created_at };
  }

  // 📖 Les stories : visibles 24 h par les amis
  function addStory(uid, url, caption) {
    const u = getUser(uid);
    if (!u || u.is_guest) return { error: 'Inscris-toi pour publier une story' };
    if (!validImage(url, uid)) return { error: 'Photo invalide' };
    db.prepare('INSERT INTO stories (user_id,media,caption,created_at) VALUES (?,?,?,?)').run(uid, url, modScan(String(caption || '').slice(0, 120)), now());
    for (const id of friendsOf(uid)) emitToUser(id, 'story_new', { userId: uid });
    track(uid, 'story');
    return { ok: true };
  }
  function stories(uid) {
    const ids = [uid, ...friendsOf(uid)];
    const rows = db.prepare(`SELECT * FROM stories WHERE created_at>? AND user_id IN (${ids.map(() => '?').join(',') || '0'}) ORDER BY created_at ASC`).all(now() - DAY, ...ids);
    const seen = new Set(db.prepare('SELECT story_id FROM story_views WHERE user_id=?').all(uid).map(r => r.story_id));
    const by = new Map();
    for (const r of rows) { const g = by.get(r.user_id) || { user: publicUser(getUser(r.user_id)), items: [] }; g.items.push({ id: r.id, media: r.media, caption: r.caption, createdAt: r.created_at, seen: seen.has(r.id), views: r.user_id === uid ? db.prepare('SELECT COUNT(*) c FROM story_views WHERE story_id=?').get(r.id).c : undefined }); by.set(r.user_id, g); }
    return [...by.values()].filter(g => g.user).sort((a, b) => (a.user.id === uid ? -1 : b.user.id === uid ? 1 : 0) || (a.items.every(i => i.seen) ? 1 : 0) - (b.items.every(i => i.seen) ? 1 : 0));
  }
  const viewStory = (uid, id) => { db.prepare('INSERT OR IGNORE INTO story_views (story_id,user_id) VALUES (?,?)').run(Number(id), uid); return { ok: true }; };
  const delStory = (uid, id) => { const r = db.prepare('SELECT * FROM stories WHERE id=? AND user_id=?').get(Number(id), uid); if (!r) return { error: 'Introuvable' }; db.prepare('DELETE FROM stories WHERE id=?').run(r.id); removeFile(r.media); return { ok: true }; };

  // 🧹 Nettoyage : snaps jamais ouverts après 2 jours, stories après 24 h
  setInterval(() => {
    for (const s of db.prepare("SELECT id, media FROM snaps WHERE media<>'' AND ((opened_at>0 AND opened_at<?) OR created_at<?)").all(now() - 120000, now() - 2 * DAY)) { removeFile(s.media); db.prepare("UPDATE snaps SET media='' WHERE id=?").run(s.id); }
    for (const r of db.prepare('SELECT id, media FROM stories WHERE created_at<?').all(now() - DAY)) { removeFile(r.media); db.prepare('DELETE FROM stories WHERE id=?').run(r.id); db.prepare('DELETE FROM story_views WHERE story_id=?').run(r.id); }
    db.prepare('DELETE FROM snaps WHERE created_at<?').run(now() - 400 * DAY);
  }, 10 * 60000).unref?.();

  const unread = uid => db.prepare('SELECT COUNT(*) c FROM snaps WHERE to_id=? AND opened_at=0 AND created_at>?').get(uid, now() - 2 * DAY).c;
  return { send, inbox, open, addStory, stories, viewStory, delStory, unread, streak };
};
