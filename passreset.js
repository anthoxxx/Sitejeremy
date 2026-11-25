// The Paradise — 🔑 Mot de passe oublié
// 1) La personne donne son pseudo (ou son e-mail) sur la page de connexion.
// 2) Si son compte a une adresse e-mail et que l'envoi d'e-mails est réglé sur Render (EmailJS avec un Gmail : EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID,
//    EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY ; ou Brevo / Resend : BREVO_API_KEY ou RESEND_API_KEY + MAIL_FROM),
//    elle reçoit un lien valable 1 heure pour choisir un nouveau mot de passe.
// 3) Sinon, la demande arrive à l'équipe (espace admin → 🔑 Mots de passe) : un admin vérifie que c'est bien la personne,
//    crée un lien (valable 24 h) et le lui transmet.
// On ne dit jamais si un pseudo ou une adresse existe (pour ne pas aider ceux qui cherchent des comptes).
const crypto = require('crypto');
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
module.exports = function setupPassReset({ db, bcrypt, getUser, getUserByName, tooMany, emitToStaff, log, createSession, publicUser, isSuper, rank, banBlock }) {
  db.exec(`CREATE TABLE IF NOT EXISTS pw_resets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER NOT NULL DEFAULT 0, by_id INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS pw_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, created_at INTEGER NOT NULL, contact TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', handled_by INTEGER NOT NULL DEFAULT 0, handled_at INTEGER NOT NULL DEFAULT 0, ip TEXT NOT NULL DEFAULT '');`);
  const now = () => Date.now();
  // l'adresse du site dans les liens : celle réglée sur le serveur (jamais celle envoyée par le navigateur, qu'on peut truquer)
  const base = req => (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const ejsOn = () => !!(process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY && process.env.EMAILJS_PRIVATE_KEY);
  const mailOn = () => ejsOn() || !!((process.env.BREVO_API_KEY || process.env.RESEND_API_KEY) && process.env.MAIL_FROM);
  async function sendMail(to, subject, html, text) {
    const from = process.env.MAIL_FROM, name = process.env.MAIL_FROM_NAME || 'The Paradise';
    // ✉️ EmailJS : les e-mails partent du Gmail branché sur EmailJS (le modèle utilise {{to_email}}, {{subject}} et {{message}})
    if (ejsOn()) {
      const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ service_id: process.env.EMAILJS_SERVICE_ID, template_id: process.env.EMAILJS_TEMPLATE_ID, user_id: process.env.EMAILJS_PUBLIC_KEY, accessToken: process.env.EMAILJS_PRIVATE_KEY,
          template_params: { to_email: to, subject, message: text, name } }) });
      if (!r.ok) throw new Error('EmailJS ' + r.status + ' ' + (await r.text()).slice(0, 200));
      return;
    }
    if (process.env.BREVO_API_KEY) {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { email: from, name }, to: [{ email: to }], subject, htmlContent: html, textContent: text }) });
      if (!r.ok) throw new Error('Brevo ' + r.status + ' ' + (await r.text()).slice(0, 200));
      return;
    }
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from: `${name} <${from}>`, to: [to], subject, html, text }) });
    if (!r.ok) throw new Error('Resend ' + r.status + ' ' + (await r.text()).slice(0, 200));
  }
  function newToken(uid, ms, byId = 0) {
    const t = crypto.randomBytes(32).toString('base64url');
    db.prepare('UPDATE pw_resets SET used_at=? WHERE user_id=? AND used_at=0').run(now(), uid); // un seul lien valable à la fois
    db.prepare('INSERT INTO pw_resets (user_id, token_hash, created_at, expires_at, by_id) VALUES (?,?,?,?,?)').run(uid, sha(t), now(), now() + ms, byId);
    return t;
  }
  const valid = t => { if (!t || String(t).length < 20) return null; const r = db.prepare('SELECT * FROM pw_resets WHERE token_hash=?').get(sha(t)); return r && !r.used_at && r.expires_at > now() ? r : null; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GENERIC = '📧 C\'est noté ! Si ce compte a une adresse e-mail, un lien pour changer ton mot de passe vient d\'y être envoyé (regarde aussi dans les spams). Sinon, ta demande est transmise à l\'équipe du Paradise, qui va te recontacter.';

  return {
    mailOn,
    routes(app, admin, requireRole) {
      // 1) « J'ai oublié mon mot de passe »
      app.post('/api/password/forgot', async (req, res) => {
        if (tooMany('pwforgot:' + req.ip, 6, 3600000)) return res.status(429).json({ error: 'Trop de demandes, réessaie dans une heure' });
        const login = String(req.body?.login || '').trim().slice(0, 120), contact = String(req.body?.contact || '').trim().slice(0, 200);
        if (login.length < 3) return res.status(400).json({ error: 'Écris ton pseudo (ou ton adresse e-mail)' });
        let u = login.includes('@') ? db.prepare("SELECT * FROM users WHERE lower(email)=lower(?) AND is_guest=0 ORDER BY last_seen DESC LIMIT 1").get(login) : getUserByName(login);
        if (u && (u.is_guest || u.panel)) u = null;
        res.json({ ok: true, msg: GENERIC }); // même réponse dans tous les cas
        if (!u || tooMany('pwforgot-u:' + u.id, 3, 3600000)) return;
        try {
          if (u.email && mailOn()) {
            const t = newToken(u.id, 3600000), link = `${base(req)}/?reset=${t}`;
            await sendMail(u.email, '🔑 Ton nouveau mot de passe — The Paradise',
              `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border-radius:16px;background:#1b1230;color:#fff"><h2 style="margin-top:0">🌴 The Paradise</h2><p>Coucou <b>${esc(u.username)}</b> !</p><p>Tu as demandé à changer ton mot de passe. Touche le bouton ci-dessous pour en choisir un nouveau :</p><p style="text-align:center;margin:28px 0"><a href="${link}" style="background:#ff4fa8;color:#fff;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold">Choisir mon nouveau mot de passe</a></p><p style="font-size:13px;opacity:.8">Ce lien marche pendant 1 heure, une seule fois. Si ce n'est pas toi qui as demandé, ignore ce message : ton mot de passe ne change pas.</p></div>`,
              `Coucou ${u.username} ! Pour choisir un nouveau mot de passe sur The Paradise, ouvre ce lien (valable 1 heure) : ${link}\nSi ce n'est pas toi, ignore ce message.`);
            log(u, 'password_forgot', '🔑 Mot de passe oublié : lien envoyé par e-mail', { ip: req.ip });
            return;
          }
          // pas d'e-mail (ou pas d'envoi d'e-mails réglé) : l'équipe s'en occupe
          if (db.prepare("SELECT 1 FROM pw_requests WHERE user_id=? AND status='open'").get(u.id)) { if (contact) db.prepare("UPDATE pw_requests SET contact=? WHERE user_id=? AND status='open'").run(contact, u.id); return; }
          db.prepare('INSERT INTO pw_requests (user_id, created_at, contact, ip) VALUES (?,?,?,?)').run(u.id, now(), contact, req.ip || '');
          log(u, 'password_forgot', '🔑 Mot de passe oublié : demande envoyée à l\'équipe', { ip: req.ip });
          emitToStaff('staff_alert', { text: `🔑 ${u.username} a oublié son mot de passe`, url: '/admin#passwords' });
        } catch (e) { console.error('mot de passe oublié', e.message); }
      });
      // 2) le lien : est-il encore valable ?
      app.get('/api/password/check', (req, res) => { const r = valid(req.query.t); const u = r && getUser(r.user_id); if (!u) return res.status(400).json({ error: 'Ce lien n\'est plus valable (il a déjà servi ou il est trop vieux). Refais une demande « Mot de passe oublié ».' }); res.json({ ok: true, username: u.username }); });
      // 3) choisir le nouveau mot de passe (et être connecté directement)
      app.post('/api/password/reset', (req, res) => {
        if (tooMany('pwreset:' + req.ip, 20, 3600000)) return res.status(429).json({ error: 'Trop de tentatives, réessaie plus tard' });
        const r = valid(req.body?.t), u = r && getUser(r.user_id);
        if (!u) return res.status(400).json({ error: 'Ce lien n\'est plus valable (il a déjà servi ou il est trop vieux). Refais une demande « Mot de passe oublié ».' });
        const pw = String(req.body?.password || '');
        if (pw.length < 6) return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum' });
        if (pw.length > 200) return res.status(400).json({ error: 'Mot de passe trop long' });
        db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(pw, 10), u.id);
        db.prepare('UPDATE pw_resets SET used_at=? WHERE id=?').run(now(), r.id);
        db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id); // déconnecte les anciennes sessions (au cas où quelqu'un d'autre était connecté)
        db.prepare("UPDATE pw_requests SET status='done', handled_at=? WHERE user_id=? AND status='open'").run(now(), u.id);
        log(u, 'password_reset', '🔑 Nouveau mot de passe choisi (mot de passe oublié)', { ip: req.ip });
        const block = banBlock(u); if (block) return res.json({ ok: true, banned: block });
        createSession(res, u.id);
        res.json({ ok: true, user: publicUser(u) });
      });
      // 🛡️ l'équipe : les demandes en attente
      admin.get('/pwreq', requireRole('admin'), (req, res) => {
        const rows = db.prepare("SELECT * FROM pw_requests WHERE status='open' OR created_at>? ORDER BY status='open' DESC, created_at DESC LIMIT 100").all(now() - 7 * 86400000);
        res.json({ mail: mailOn(), list: rows.map(r => { const u = getUser(r.user_id); return u && { id: r.id, status: r.status, createdAt: r.created_at, contact: r.contact, user: { id: u.id, username: u.username, avatar: u.avatar || '', color: u.color, role: u.role, email: !!u.email, google: !!u.google_id, lastSeen: u.last_seen } }; }).filter(Boolean) });
      });
      // créer un lien pour la personne (après avoir vérifié que c'est bien elle)
      admin.post('/pwreq/:id/link', requireRole('admin'), (req, res) => {
        const r = db.prepare('SELECT * FROM pw_requests WHERE id=?').get(parseInt(req.params.id, 10)); const u = r && getUser(r.user_id);
        if (!u) return res.status(404).json({ error: 'Demande introuvable' });
        if (rank(u) >= 1 && !isSuper(req.user)) return res.status(403).json({ error: 'Pour un compte du staff, seul le super-admin peut créer le lien' });
        const t = newToken(u.id, 24 * 3600000, req.user.id);
        db.prepare("UPDATE pw_requests SET status='done', handled_by=?, handled_at=? WHERE id=?").run(req.user.id, now(), r.id);
        log(req.user, 'password_link', `🔑 Lien « nouveau mot de passe » créé pour ${u.username}`);
        res.json({ ok: true, link: `${base(req)}/?reset=${t}`, username: u.username });
      });
      admin.post('/pwreq/:id/refuse', requireRole('admin'), (req, res) => {
        const r = db.prepare('SELECT * FROM pw_requests WHERE id=?').get(parseInt(req.params.id, 10)); if (!r) return res.status(404).json({ error: 'Demande introuvable' });
        db.prepare("UPDATE pw_requests SET status='refused', handled_by=?, handled_at=? WHERE id=?").run(req.user.id, now(), r.id);
        const u = getUser(r.user_id); log(req.user, 'password_link', `🔑 Demande de mot de passe de ${u?.username || '?'} refusée`);
        res.json({ ok: true });
      });
      admin.get('/pwreq/count', requireRole('admin'), (req, res) => res.json({ count: db.prepare("SELECT COUNT(*) c FROM pw_requests WHERE status='open'").get().c }));
    },
  };
};
