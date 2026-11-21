// The Paradise — 🔗 Reconnaître les appareils d'une personne (PC, téléphone, tablette…) pour que la modération
// puisse la bannir partout, et repérer quand elle revient avec un autre compte.
// On retient, pour chaque compte : les appareils (identifiant gardé dans le navigateur), les connexions (adresses IP)
// et une empreinte d'appareil (un simple indice). Ces informations ne servent qu'à la modération.
//
// Quand un membre est banni (avec « tous ses appareils ») :
//   • ses appareils sont bannis : plus aucun compte ne peut s'en servir (inscription, connexion, chat) ;
//   • ses autres comptes qui utilisent le même appareil sont bannis aussi ;
//   • ses connexions (IP) sont marquées : on ne peut plus créer de compte depuis elles, et un compte créé APRÈS le
//     bannissement qui s'y connecte est banni. Les anciens comptes de la même connexion (famille, wifi partagé…)
//     ne sont pas bloqués : le staff est seulement prévenu.
//   • l'empreinte seule ne bloque jamais (deux téléphones identiques peuvent avoir la même) : elle prévient le staff.

module.exports = function setupIdent({ db, getUser, isStaff, log = () => {}, alert = () => {}, onBan = () => {} }) {
  const now = () => Date.now();
  db.exec(`CREATE TABLE IF NOT EXISTS user_traces (user_id INTEGER NOT NULL, kind TEXT NOT NULL, value TEXT NOT NULL, first_at INTEGER NOT NULL, last_at INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (user_id, kind, value))`);
  db.exec('CREATE INDEX IF NOT EXISTS user_traces_v ON user_traces (kind, value)');
  db.exec(`CREATE TABLE IF NOT EXISTS ban_marks (kind TEXT NOT NULL, value TEXT NOT NULL, user_id INTEGER NOT NULL, until INTEGER NOT NULL DEFAULT 0, reason TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, PRIMARY KEY (kind, value))`);
  // les comptes déjà créés : on reprend l'appareil et la connexion de leur inscription
  try {
    if (!db.prepare("SELECT 1 FROM settings WHERE key='identV1'").get()) {
      const ins = db.prepare('INSERT OR IGNORE INTO user_traces (user_id,kind,value,first_at,last_at) VALUES (?,?,?,?,?)');
      for (const u of db.prepare('SELECT id, device_id, signup_ip, created_at FROM users WHERE is_guest=0').all()) {
        if (/^[a-f0-9]{32}$/.test(u.device_id || '')) ins.run(u.id, 'dev', u.device_id, u.created_at, u.created_at);
        if (u.signup_ip) ins.run(u.id, 'ip', clip(u.signup_ip), u.created_at, u.created_at);
      }
      db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('identV1','1')").run();
    }
  } catch (e) { console.warn('ident', e.message); }

  function clip(ip) { return String(ip || '').replace(/^::ffff:/, '').trim().slice(0, 64); }
  const okId = v => /^[a-f0-9]{32}$/.test(v || '') ? v : '';
  const okFp = v => /^[a-f0-9]{16}$/.test(v || '') ? v : '';
  // ce que la requête (ou la connexion du chat) nous dit de l'appareil
  const fromReq = req => ({ ip: clip(req.ip), dev: okId(req.cookies?.lc_dev), pid: okId(req.get?.('x-lc-pid') || req.cookies?.lc_pid), fp: okFp(req.get?.('x-lc-fp')) });
  const fromSocket = (s, ip) => { const ck = Object.fromEntries(String(s.handshake.headers.cookie || '').split(/;\s*/).map(c => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; })); return { ip: clip(ip), dev: okId(ck.lc_dev), pid: okId(s.handshake.auth?.pid || ck.lc_pid), fp: okFp(s.handshake.auth?.fp) }; };
  const pairs = c => [['dev', c.dev], ['pid', c.pid], ['ip', c.ip], ['fp', c.fp]].filter(([, v]) => v);

  // ---------- on retient les appareils de chaque compte ----------
  const seen = new Map();
  const up = db.prepare('INSERT INTO user_traces (user_id,kind,value,first_at,last_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,kind,value) DO UPDATE SET last_at=excluded.last_at, n=n+1');
  function trace(uid, c) {
    if (!uid || !c) return;
    const t = now();
    for (const [k, v] of pairs(c)) { const key = uid + k + v; if (t - (seen.get(key) || 0) < 10 * 60000) continue; seen.set(key, t); up.run(uid, k, v, t, t); }
    if (seen.size > 50000) seen.clear();
  }

  // ---------- les comptes et appareils liés à un compte ----------
  function links(uid) {
    const tr = db.prepare('SELECT kind, value, first_at, last_at, n FROM user_traces WHERE user_id=? ORDER BY last_at DESC').all(uid);
    const accounts = new Map();
    for (const r of tr) {
      if (r.kind === 'fp') continue;
      for (const o of db.prepare('SELECT user_id FROM user_traces WHERE kind=? AND value=? AND user_id<>? LIMIT 50').all(r.kind, r.value, uid)) {
        const a = accounts.get(o.user_id) || { id: o.user_id, by: new Set() }; a.by.add(r.kind === 'ip' ? 'ip' : 'dev'); accounts.set(o.user_id, a);
      }
    }
    return {
      devices: tr.filter(r => r.kind === 'dev' || r.kind === 'pid').length,
      ips: tr.filter(r => r.kind === 'ip').map(r => ({ ip: r.value, last: r.last_at, n: r.n })),
      accounts: [...accounts.values()].map(a => { const u = getUser(a.id); return u ? { id: u.id, username: u.username, banned: !!u.banned, strong: a.by.has('dev'), by: [...a.by] } : null; }).filter(Boolean),
    };
  }

  // ---------- bannir tous les appareils d'un compte ----------
  const mark = db.prepare('INSERT INTO ban_marks (kind,value,user_id,until,reason,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(kind,value) DO UPDATE SET user_id=excluded.user_id, until=excluded.until, reason=excluded.reason, created_at=excluded.created_at');
  function banEverywhere(target, until, reason, actor, depth = 0) {
    if (!target || isStaff(target)) return { devices: 0, ips: 0, accounts: [] };
    const t = now(), tr = db.prepare('SELECT kind, value FROM user_traces WHERE user_id=?').all(target.id);
    let devices = 0, ips = 0;
    for (const r of tr) {
      if (r.kind === 'fp') continue;
      if (r.kind === 'ip' && staffOn('ip', r.value)) continue; // jamais la connexion d'un membre du staff
      mark.run(r.kind, r.value, target.id, until || 0, reason || '', t);
      if (r.kind === 'ip') ips++; else devices++;
    }
    // ses autres comptes sur le même appareil sont bannis aussi
    const banned = [];
    if (depth < 2) for (const r of tr.filter(r => r.kind === 'dev' || r.kind === 'pid')) {
      for (const o of db.prepare('SELECT user_id FROM user_traces WHERE kind=? AND value=? AND user_id<>?').all(r.kind, r.value, target.id)) {
        const u = getUser(o.user_id); if (!u || u.banned || isStaff(u)) continue;
        db.prepare("UPDATE users SET banned=1, ban_until=?, ban_kind='ban', ban_reason=? WHERE id=?").run(until || 0, `🔗 Même appareil que ${target.username}${reason ? ' : ' + reason : ''}`, u.id);
        banned.push(u.username); onBan(u.id);
        banEverywhere(getUser(u.id), until, reason, actor, depth + 1);
      }
    }
    if (depth === 0) log(actor, 'ban', `🔗 ${target.username} banni sur tous ses appareils : ${devices} appareil(s), ${ips} connexion(s)${banned.length ? ', comptes liés bannis : ' + banned.join(', ') : ''}`);
    return { devices, ips, accounts: banned };
  }
  const staffOn = (kind, value) => db.prepare("SELECT 1 FROM user_traces t JOIN users u ON u.id=t.user_id WHERE t.kind=? AND t.value=? AND u.role IN ('moderator','admin','superadmin') LIMIT 1").get(kind, value);
  // on lève le bannissement : ses appareils sont libérés (et les comptes bannis à cause de lui)
  function unbanEverywhere(target, actor) {
    const n = db.prepare('DELETE FROM ban_marks WHERE user_id=?').run(target.id).changes;
    const freed = db.prepare("SELECT id, username FROM users WHERE banned=1 AND ban_reason LIKE ?").all(`🔗 Même appareil que ${target.username}%`);
    for (const u of freed) { db.prepare("UPDATE users SET banned=0, ban_until=0, ban_reason='' WHERE id=?").run(u.id); db.prepare('DELETE FROM ban_marks WHERE user_id=?').run(u.id); }
    if (n || freed.length) log(actor, 'unban', `🔗 Appareils de ${target.username} libérés${freed.length ? ' (+ ' + freed.map(u => u.username).join(', ') + ')' : ''}`);
  }

  // ---------- quelqu'un arrive : est-ce un appareil banni ? ----------
  const live = m => m && (!m.until || m.until > now());
  const getMark = (k, v) => { const m = db.prepare('SELECT * FROM ban_marks WHERE kind=? AND value=?').get(k, v); return live(m) ? m : null; };
  // u = le compte (ou null pour une inscription). Renvoie { block, mark } ; block = message à afficher
  function check(c, u = null) {
    if (u && isStaff(u)) return null;
    for (const k of ['dev', 'pid']) { const m = c[k] && getMark(k, c[k]); if (m && (!u || m.user_id !== u.id)) return { block: true, mark: m, why: 'appareil' }; }
    const m = c.ip && getMark('ip', c.ip);
    if (m && (!u || (m.user_id !== u.id && u.created_at > m.created_at))) return { block: true, mark: m, why: 'connexion' };
    if (m && u && m.user_id !== u.id) return { block: false, mark: m, why: 'connexion' }; // ancien compte sur la même connexion : on prévient seulement
    return null;
  }
  // l'appareil d'un banni revient : on bloque, on bannit le nouveau compte, et on prévient le staff
  function evade(c, u, where) {
    const r = check(c, u); if (!r) return null;
    const orig = getUser(r.mark.user_id), name = orig?.username || 'un membre banni';
    if (!r.block) { alert(`🔗 ${u.username} se connecte depuis la même connexion que ${name} (banni)`, 'C\'est peut-être la même personne, ou quelqu\'un de sa famille / du même wifi.'); return null; }
    if (u) {
      db.prepare("UPDATE users SET banned=1, ban_until=?, ban_kind='ban', ban_reason=? WHERE id=?").run(r.mark.until || 0, `🔗 Contournement du bannissement de ${name}`, u.id);
      trace(u.id, c); banEverywhere(getUser(u.id), r.mark.until || 0, `Contournement du bannissement de ${name}`, null, 1); onBan(u.id);
      log(null, 'ban', `🔗 ${u.username} banni : ${r.why === 'appareil' ? 'même appareil' : 'même connexion'} que ${name} (${where})`);
      alert(`🔗 ${u.username} a été banni automatiquement`, `Il utilisait ${r.why === 'appareil' ? 'le même appareil' : 'la même connexion'} que ${name}, qui est banni.`);
    } else {
      log(null, 'shield', `🔗 Inscription refusée : ${r.why === 'appareil' ? 'appareil' : 'connexion'} de ${name} (banni)`);
      if (r.why === 'appareil') alert('🔗 Un banni a essayé de recréer un compte', `Son appareil (celui de ${name}) est banni : l'inscription a été refusée.`);
    }
    const until = r.mark.until ? ` jusqu'au ${new Date(r.mark.until).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}` : '';
    return `⛔ Cet appareil est banni du site${until}.`;
  }
  // l'empreinte ressemble à celle d'un banni : un simple avertissement pour le staff (jamais de blocage)
  function hint(c, u) {
    if (!c.fp || (u && isStaff(u))) return;
    const r = db.prepare("SELECT t.user_id FROM user_traces t JOIN users b ON b.id=t.user_id WHERE t.kind='fp' AND t.value=? AND b.banned=1 AND t.user_id<>? LIMIT 1").get(c.fp, u?.id || 0);
    if (r && !seen.has('hint' + (u?.id || c.ip) + r.user_id)) { seen.set('hint' + (u?.id || c.ip) + r.user_id, now()); const b = getUser(r.user_id); alert(`🔎 ${u ? u.username : 'Une inscription'} ressemble à ${b?.username || 'un banni'}`, 'Même type d\'appareil qu\'un membre banni. Ce n\'est qu\'un indice : vérifie avant de sanctionner.'); }
  }
  return { fromReq, fromSocket, trace, links, banEverywhere, unbanEverywhere, check, evade, hint };
};
