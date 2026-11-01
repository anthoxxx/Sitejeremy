// The Paradise — salon TV et son TV Bot
// Chaînes de télé gratuites du monde entier, tirées de l'annuaire public iptv-org
// (https://github.com/iptv-org/iptv : uniquement des flux diffusés librement sur Internet).
// Le serveur vérifie chaque flux (lisible depuis un navigateur, en https), garde ceux qui marchent,
// et tout le salon regarde la même chaîne en même temps.
const fs = require('fs');
const path = require('path');

const SLUG = 'tv';
const API = (process.env.TV_API_BASE || 'https://iptv-org.github.io/api').replace(/\/$/, '');
const BOT = { username: 'TV Bot', color: '#33d6a6', icon: '📺' };
const BLOCKED_CATS = new Set(['xxx', 'adult']);
const REFRESH = 24 * 3600 * 1000;

module.exports = function setupTvBot({ app, io, auth, isStaff, isVerified, tooMany, log, getOnline, dataDir }) {
  const now = () => Date.now();
  const cacheFile = path.join(dataDir, 'tv-chaines.json');
  let channels = new Map();   // id -> { id, name, country, flag, countryName, logo, categories, url, ok }
  let countries = new Map();  // code -> { code, name, flag }
  let status = { loading: false, checked: 0, total: 0, at: 0, error: '' };
  let current = null;         // { id, name, flag, logo, url, by, at }
  let lastChange = 0, msgSeq = 1;
  const reports = new Map();  // channelId -> Set(userId)

  // ---------- Le bot parle ----------
  const say = content => io.to('room:' + SLUG).emit('message', { room: SLUG, id: 'tv' + (msgSeq++), userId: 0, username: BOT.username, color: BOT.color, gender: 'x', role: 'bot', avatar: '', bot: true, botIcon: BOT.icon, content, createdAt: now(), kind: 'text' });
  const stateOut = () => ({ current, ready: [...channels.values()].filter(c => c.ok).length, status });
  const broadcast = () => io.to('room:' + SLUG).emit('tv', stateOut());
  const out = c => ({ id: c.id, name: c.name, country: c.country, flag: c.flag, countryName: c.countryName, logo: c.logo, categories: c.categories });

  // ---------- Chargement et vérification des chaînes ----------
  async function getJSON(file) {
    const r = await fetch(`${API}/${file}`, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`${file} : ${r.status}`);
    return r.json();
  }
  // Vérification complète d'un flux, comme le ferait le navigateur du spectateur :
  // playlist principale → playlist de qualité → premier morceau de vidéo, avec l'autorisation CORS à chaque étape.
  const HEAD = { Origin: 'https://theparadise.fr', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' };
  const secure = u => u.startsWith('https://') || process.env.TV_ALLOW_HTTP === '1';
  async function get(url, extra = {}) {
    const r = await fetch(url, { headers: { ...HEAD, ...extra }, redirect: 'follow', signal: AbortSignal.timeout(8000) });
    if (!(r.ok || r.status === 206) || !r.headers.get('access-control-allow-origin') || !secure(r.url)) { r.body?.cancel().catch(() => {}); return null; }
    return r;
  }
  const lines = t => t.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  async function checkStream(url) {
    try {
      let r = await get(url);
      if (!r) return false;
      let text = (await r.text()).slice(0, 200000), base = r.url;
      if (!text.includes('#EXTM3U') || /METHOD=SAMPLE-AES|KEYFORMAT="com\.apple|widevine/i.test(text)) return false; // DRM : illisible
      if (text.includes('#EXT-X-STREAM-INF')) {
        // Choix d'une qualité lisible (pas de HEVC, que la plupart des navigateurs ne lisent pas)
        const ls = lines(text); let variant = null;
        for (let i = 0; i < ls.length; i++) {
          if (!ls[i].startsWith('#EXT-X-STREAM-INF')) continue;
          if (/hvc1|hev1|dvh1/i.test(ls[i])) continue;
          const uri = ls.slice(i + 1).find(l => !l.startsWith('#'));
          if (uri) { variant = new URL(uri, base).href; break; }
        }
        if (!variant || !secure(variant)) return false;
        r = await get(variant);
        if (!r) return false;
        text = (await r.text()).slice(0, 200000); base = r.url;
        if (/METHOD=SAMPLE-AES/i.test(text)) return false;
      }
      if (!text.includes('#EXTINF')) return false;
      const seg = lines(text).find(l => !l.startsWith('#'));
      if (!seg) return false;
      const segUrl = new URL(seg, base).href;
      if (!secure(segUrl)) return false;
      const sr = await get(segUrl, { Range: 'bytes=0-2047' });
      if (!sr) return false;
      sr.body?.cancel().catch(() => {});
      return true;
    } catch (e) { return false; }
  }
  async function load() {
    if (status.loading) return;
    status = { ...status, loading: true, error: '' };
    try {
      const [chs, streams, ctr, logos] = await Promise.all([getJSON('channels.json'), getJSON('streams.json'), getJSON('countries.json'), getJSON('logos.json').catch(() => [])]);
      countries = new Map(ctr.map(c => [c.code, { code: c.code, name: c.name, flag: c.flag || '' }]));
      const logoOf = new Map();
      for (const l of logos) if (l.channel && l.url && !logoOf.has(l.channel)) logoOf.set(l.channel, l.url);
      const info = new Map();
      for (const c of chs) {
        if (c.is_nsfw || (c.categories || []).some(x => BLOCKED_CATS.has(x)) || c.closed) continue;
        info.set(c.id, c);
      }
      // Jusqu'à 4 flux par chaîne : https, sans en-têtes spéciaux (impossibles à envoyer depuis un navigateur)
      const candidates = new Map();
      for (const s of streams) {
        if (!s.channel || !info.has(s.channel)) continue;
        if (!(/^https:\/\//.test(s.url || '') || (process.env.TV_ALLOW_HTTP === '1' && /^http:\/\//.test(s.url || ''))) || s.http_referrer || s.user_agent || s.referrer) continue;
        const arr = candidates.get(s.channel) || [];
        if (arr.length < 4 && !arr.includes(s.url)) arr.push(s.url);
        candidates.set(s.channel, arr);
      }
      const list = [...candidates.entries()];
      status = { ...status, total: list.length, checked: 0 };
      const next = new Map();
      // On garde les chaînes déjà connues pendant la vérification
      for (const [id, c] of channels) next.set(id, c);
      let i = 0;
      const worker = async () => {
        while (i < list.length) {
          const [id, urls] = list[i++];
          const c = info.get(id);
          const ctry = countries.get(c.country) || { name: c.country || '', flag: '' };
          // On essaie les flux un par un ; les autres servent de secours si le premier tombe en panne
          const good = [];
          for (const u of urls) { if (await checkStream(u)) good.push(u); if (good.length >= 2) break; }
          const ok = good.length > 0;
          next.set(id, { id, name: c.name, country: c.country || '', flag: ctry.flag, countryName: ctry.name, logo: logoOf.get(id) || c.logo || '', categories: c.categories || [], url: good[0] || urls[0], alts: good.slice(1), ok });
          status.checked++;
          if (status.checked % 200 === 0) { channels = next; save(); }
        }
      };
      await Promise.all(Array.from({ length: 24 }, worker));
      for (const id of [...next.keys()]) if (!candidates.has(id)) next.delete(id);
      channels = next;
      status = { ...status, loading: false, at: now() };
      save();
      log(null, 'tv_check', `📺 TV : ${[...channels.values()].filter(c => c.ok).length} chaînes qui marchent sur ${list.length} vérifiées`);
    } catch (e) {
      status = { ...status, loading: false, error: e.message };
      console.log('📺 TV : chargement impossible —', e.message);
    }
    broadcast();
  }
  function save() {
    try { fs.writeFileSync(cacheFile, JSON.stringify({ at: now(), countries: [...countries.values()], channels: [...channels.values()].filter(c => c.ok) })); } catch (e) {}
  }
  try {
    const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    countries = new Map((c.countries || []).map(x => [x.code, x]));
    channels = new Map((c.channels || []).map(x => [x.id, x]));
    status.at = c.at || 0;
  } catch (e) {}
  if (process.env.TV_CHECK !== '0') {
    setTimeout(() => { if (now() - status.at > REFRESH || !channels.size) load(); }, 15000);
    setInterval(load, REFRESH);
  }

  // ---------- Changer de chaîne ----------
  function setChannel(user, id) {
    const c = channels.get(String(id || ''));
    if (!c || !c.ok) return { error: 'Chaîne introuvable ou indisponible' };
    const wait = 20000 - (now() - lastChange);
    if (wait > 0 && !isStaff(user) && current?.by !== user.username) return { error: `Attends ${Math.ceil(wait / 1000)} s avant de changer de chaîne` };
    lastChange = now();
    current = { id: c.id, name: c.name, flag: c.flag, countryName: c.countryName, logo: c.logo, url: c.url, alts: c.alts || [], by: user.username, at: now() };
    reports.delete(c.id);
    say(`📺 ${user.username} a mis ${c.flag} ${c.name}${c.countryName ? ' (' + c.countryName + ')' : ''}. Clique sur « ▶ Regarder » en haut du salon !`);
    log(user, 'tv', `📺 TV : ${c.name}`);
    broadcast();
    return { ok: true };
  }

  // ---------- API ----------
  app.get('/api/tv/countries', auth, (req, res) => {
    const count = new Map();
    for (const c of channels.values()) if (c.ok) count.set(c.country, (count.get(c.country) || 0) + 1);
    const list = [...count.entries()].map(([code, n]) => ({ ...(countries.get(code) || { code, name: code, flag: '' }), count: n }))
      .sort((a, b) => (a.code === 'FR' ? -1 : b.code === 'FR' ? 1 : a.name.localeCompare(b.name, 'fr')));
    res.json({ countries: list, status, total: [...channels.values()].filter(c => c.ok).length });
  });
  app.get('/api/tv/channels', auth, (req, res) => {
    const country = String(req.query.country || '').toUpperCase();
    const q = String(req.query.q || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    let list = [...channels.values()].filter(c => c.ok);
    if (country) list = list.filter(c => c.country === country);
    if (q) list = list.filter(c => c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q));
    list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    res.json({ channels: list.slice(0, 200).map(out), more: list.length > 200 });
  });
  app.post('/api/admin/tv/refresh', auth, (req, res) => {
    if (!isStaff(req.user)) return res.status(403).json({ error: 'Réservé au staff' });
    load();
    res.json({ ok: true });
  });

  // ---------- Temps réel ----------
  function onConnection(socket, uid, currentUser) {
    const inTv = () => getOnline().get(uid)?.room === SLUG;
    socket.on('tv_state', ack => typeof ack === 'function' && ack(stateOut()));
    socket.on('tv_set', (id, ack) => {
      const u = currentUser();
      if (!u || !inTv()) return ack && ack({ error: 'Entre dans le salon TV d\'abord' });
      if (!isVerified(u)) return ack && ack({ error: 'Action impossible' });
      if (u.muted_until && u.muted_until > now()) return ack && ack({ error: 'Tu es rendu muet pour le moment' });
      if (tooMany('tvset:' + uid, 10, 60 * 1000)) return ack && ack({ error: 'Doucement !' });
      ack && ack(setChannel(u, id));
    });
    // Un spectateur signale que la chaîne ne marche pas
    socket.on('tv_report', id => {
      if (!current || current.id !== id || !inTv()) return;
      const set = reports.get(id) || new Set();
      set.add(uid); reports.set(id, set);
      const viewers = [...getOnline().values()].filter(e => e.room === SLUG && !e.ghost).length;
      if (set.size >= Math.min(2, Math.max(1, viewers))) {
        const c = channels.get(id);
        if (c) c.ok = false;
        say(`⚠️ ${current.name} ne marche plus : je la retire de la liste. Choisis une autre chaîne avec « 📺 Changer de chaîne ».`);
        current = null; reports.delete(id); save(); broadcast();
      }
    });
  }

  async function command(user, text) {
    const [cmd, ...rest] = text.trim().split(/\s+/);
    const arg = rest.join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    switch (cmd.toLowerCase()) {
      case '!aide': case '!help': case '!tv':
        if (cmd.toLowerCase() === '!tv' && arg) {
          const list = [...channels.values()].filter(c => c.ok && c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(arg));
          const c = list.find(x => x.name.toLowerCase() === arg) || list[0];
          if (!c) return say(`😕 Je ne trouve pas de chaîne « ${rest.join(' ')} ». Utilise « 📺 Changer de chaîne » pour voir la liste.`);
          const r = setChannel(user, c.id);
          if (r.error) say(`@${user.username} ${r.error}`);
          return;
        }
        return say(`📺 Je suis TV Bot ! ${[...channels.values()].filter(c => c.ok).length} chaînes du monde entier. Clique sur « 📺 Changer de chaîne » pour choisir par pays, ou tape !tv suivi du nom (ex : !tv France 24). Tout le salon regarde la même chaîne.`);
      case '!chaine': case '!chaîne': case '!quoi':
        return say(current ? `En ce moment : ${current.flag} ${current.name}, mise par ${current.by}.` : 'Aucune chaîne pour le moment. Mets-en une !');
    }
  }

  return { onConnection, command, has: slug => slug === SLUG, SLUG };
};
