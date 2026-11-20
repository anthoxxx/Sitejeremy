// The Paradise — 📣 Discord : la pub du site, et les journaux (logs) du serveur à distance.
// Les adresses des webhooks sont SECRÈTES : elles se règlent seulement dans Render (variables d'environnement),
// jamais dans le code (il est public). Sans ces variables, rien n'est envoyé et le site marche normalement.
//   DISCORD_PROMO_WEBHOOK : salon de pub (nouveautés du site + une annonce par jour)
//   DISCORD_LOG_WEBHOOK   : salon des journaux (tout ce que le serveur écrit, les erreurs, démarrage/arrêt, statistiques)

const SITE = process.env.SITE_URL || 'https://theparadise.fr';
const okHook = u => /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(String(u || '').trim());

// les annonces du jour (une différente chaque jour)
const PROMOS = [
  { t: '🌴 Viens discuter sur The Paradise !', d: 'Des salons pour parler de tout, des messages privés, le vocal et la visio : un chat gratuit, sur téléphone comme sur ordinateur.' },
  { t: '🏙️ Une vraie ville en 3D t\'attend', d: 'Promène-toi dans la Ville du Paradise avec ton personnage, conduis une voiture de sport, entre dans les lieux et retrouve les autres membres.' },
  { t: '🔫 Le Laser Game est ouvert !', d: 'Rouges contre Bleus dans une arène en 3D, 3 cartes, des robots si vous n\'êtes pas assez : crée ta partie et invite tes amis !' },
  { t: '🏠 Construis la maison de tes rêves', d: 'Murs, étages, meubles de A à Z : chaque membre a sa propre maison, et choisit qui peut entrer.' },
  { t: '🎮 Des jeux pour tout le monde', d: 'Blind test, roue de la fortune, mot d\'or, babyfoot, courses de voitures, chasse au trésor… et des pièces à gagner.' },
  { t: '🎵 Écoutez de la musique ensemble', d: 'La radio, le jukebox, la boîte de nuit et le cinéma : on choisit, on vote, et tout le monde écoute en même temps.' },
  { t: '✨ Fais-toi remarquer', d: 'Personnalise ton profil, ta couleur, ton néon, ton son d\'arrivée et ton personnage. Inscription gratuite en quelques secondes.' },
];

module.exports = function setupDiscord({ db, patchnotes = [], online = () => 0, rooms = () => 0 }) {
  const PROMO = okHook(process.env.DISCORD_PROMO_WEBHOOK) ? process.env.DISCORD_PROMO_WEBHOOK.trim() : null;
  const LOG = okHook(process.env.DISCORD_LOG_WEBHOOK) ? process.env.DISCORD_LOG_WEBHOOK.trim() : null;
  const secrets = [PROMO, LOG, process.env.GOOGLE_CLIENT_SECRET, process.env.ADMIN_PASSWORD, process.env.SESSION_SECRET, process.env.TURN_PASS].filter(s => s && s.length > 5);
  const clean = s => { let t = String(s); for (const x of secrets) t = t.split(x).join('[secret]'); return t; }; // on ne recopie jamais un secret dans Discord
  const setting = k => { try { return db.prepare('SELECT value FROM settings WHERE key=?').get(k)?.value; } catch (e) { return null; } };
  const setSetting = (k, v) => { try { db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(k, String(v)); } catch (e) {} };

  // envoi avec respect des limites de Discord (s'il dit « trop vite », on attend)
  const queues = new Map();
  function post(url, body) {
    if (!url) return Promise.resolve(false);
    const q = queues.get(url) || Promise.resolve();
    const p = q.then(async () => {
      for (let i = 0; i < 3; i++) {
        try {
          const r = await fetch(url + '?wait=false', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ allowed_mentions: { parse: [] }, ...body }), signal: AbortSignal.timeout(10000) });
          if (r.status === 429) { const j = await r.json().catch(() => ({})); await new Promise(res => setTimeout(res, Math.min(15000, (j.retry_after || 2) * 1000 + 200))); continue; }
          return r.ok;
        } catch (e) { await new Promise(res => setTimeout(res, 2000)); }
      }
      return false;
    });
    queues.set(url, p.catch(() => {}));
    return p;
  }

  // ---------- 📜 les journaux du serveur ----------
  let buf = [], dropped = 0;
  const ICON = { log: '⚪', info: '🔵', warn: '🟠', error: '🔴' };
  const fmt = a => a.map(x => (x instanceof Error ? (x.stack || x.message) : typeof x === 'object' ? (() => { try { return JSON.stringify(x); } catch (e) { return String(x); } })() : String(x))).join(' ');
  function logLine(level, text) {
    if (!LOG) return;
    const t = new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' });
    const line = `${ICON[level] || '⚪'} ${t} ${clean(text).replace(/```/g, "'''")}`.slice(0, 1800);
    if (buf.length > 300) { dropped++; return; }
    buf.push(line);
  }
  function flush() {
    if (!LOG || !buf.length) return Promise.resolve();
    const lines = buf; buf = [];
    if (dropped) { lines.push(`⚠️ ${dropped} lignes non envoyées (trop de journaux d'un coup)`); dropped = 0; }
    const chunks = []; let cur = '';
    for (const l of lines) { if (cur.length + l.length + 1 > 1900) { chunks.push(cur); cur = ''; } cur += (cur ? '\n' : '') + l; }
    if (cur) chunks.push(cur);
    return Promise.all(chunks.slice(0, 8).map(c => post(LOG, { username: 'The Paradise · Journaux', content: '```\n' + c + '\n```' })));
  }
  if (LOG) {
    for (const level of ['log', 'info', 'warn', 'error']) {
      const orig = console[level].bind(console);
      console[level] = (...a) => { orig(...a); try { logLine(level, fmt(a)); } catch (e) {} };
    }
    setInterval(flush, 5000).unref?.();
    process.on('uncaughtException', e => { console.error('💥 Erreur non rattrapée :', e); flush(); });
    process.on('unhandledRejection', e => { console.error('💥 Promesse rejetée :', e); });
    // Render arrête l'ancien serveur à chaque déploiement : on le dit avant de partir
    let stopping = false;
    for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => {
      if (stopping) return; stopping = true;
      logLine('warn', `🔴 Serveur arrêté (${sig}, souvent un redéploiement) · ${online()} connecté(s)`);
      await Promise.race([flush(), new Promise(r => setTimeout(r, 3000))]);
      process.exit(0);
    });
    // toutes les heures : un petit bilan
    setInterval(() => { const m = process.memoryUsage(); logLine('info', `📊 Bilan : ${online()} connecté(s) · ${rooms()} salon(s) · mémoire ${Math.round(m.rss / 1048576)} Mo · en ligne depuis ${Math.round(process.uptime() / 3600)} h`); }, 3600 * 1000).unref?.();
  }
  const event = (icon, text) => logLine('info', `${icon} ${text}`); // les événements importants (inscriptions, bannissements…)

  // ---------- 📣 la pub ----------
  const embed = (title, description, extra = {}) => ({ title, description, url: SITE, color: 0xff3df0, footer: { text: 'The Paradise · ' + SITE.replace(/^https?:\/\//, '') }, timestamp: new Date().toISOString(), ...extra });
  function announcePatch() {
    if (!PROMO || !patchnotes.length) return;
    const last = Number(setting('discordPatch') || 0), news = patchnotes.filter(p => p.id > last).sort((a, b) => a.id - b.id);
    if (!news.length) return;
    // la toute première fois : on n'annonce que la dernière nouveauté (pas tout l'historique)
    const list = last ? news.slice(-3) : news.slice(-1);
    for (const p of list) {
      const lines = [...(p.added || []), ...(p.changed || [])].slice(0, 8).map(x => '• ' + x);
      post(PROMO, { username: 'The Paradise', embeds: [embed('🆕 ' + p.title, (lines.join('\n') || 'Du nouveau sur le site !').slice(0, 3900) + `\n\n👉 **[Viens essayer !](${SITE})**`)] });
    }
    setSetting('discordPatch', patchnotes.reduce((m, p) => Math.max(m, p.id), 0));
  }
  function dailyPromo() {
    if (!PROMO) return;
    const paris = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' })), day = paris.toISOString().slice(0, 10);
    if (paris.getHours() < 18 || setting('discordPromoDay') === day) return; // une fois par jour, en fin de journée (18 h)
    setSetting('discordPromoDay', day);
    const n = Math.floor(Date.now() / 86400000) % PROMOS.length, p = PROMOS[n], on = online();
    post(PROMO, { username: 'The Paradise', embeds: [embed(p.t, `${p.d}\n\n${on > 1 ? `🟢 **${on} personnes** sont connectées en ce moment !\n` : ''}👉 **[Rejoins-nous sur The Paradise](${SITE})** — c'est gratuit !`)] });
  }
  if (PROMO) {
    setTimeout(announcePatch, 20000); // juste après le démarrage : les nouveautés du dernier déploiement
    setInterval(dailyPromo, 10 * 60 * 1000).unref?.();
  }
  return {
    enabled: { promo: !!PROMO, log: !!LOG },
    started: port => logLine('info', `🟢 Serveur démarré (port ${port}) · Node ${process.version}`),
    event, flush,
    // pour l'admin : envoyer une pub tout de suite
    promoNow: (title, text) => PROMO ? post(PROMO, { username: 'The Paradise', embeds: [embed(String(title).slice(0, 250), String(text).slice(0, 3800) + `\n\n👉 **[${SITE.replace(/^https?:\/\//, '')}](${SITE})**`)] }) : Promise.resolve(false),
  };
};
