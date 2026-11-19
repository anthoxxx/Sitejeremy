// The Paradise — ⛅ La météo du site : la même pour tout le monde, elle change toute seule (selon la saison et l'heure de Paris)
// L'équipe peut aussi la forcer pendant un moment (« il neige pour la soirée de Noël ! »).
const SLOT = 40 * 60 * 1000; // la météo change toutes les 40 minutes environ
const TYPES = {
  soleil: { icon: '☀️', night: '🌙', name: 'Grand soleil', nightName: 'Nuit étoilée', wind: [5, 15], dt: 2 },
  eclaircies: { icon: '🌤️', night: '☁️', name: 'Éclaircies', nightName: 'Quelques nuages', wind: [8, 20], dt: 1 },
  nuageux: { icon: '☁️', name: 'Nuageux', wind: [10, 25], dt: -1 },
  pluie: { icon: '🌧️', name: 'Pluie', wind: [15, 35], dt: -3 },
  orage: { icon: '⛈️', name: 'Orage', wind: [30, 70], dt: -2 },
  neige: { icon: '🌨️', name: 'Neige', wind: [5, 20], dt: 0 },
  brouillard: { icon: '🌫️', name: 'Brouillard', wind: [0, 8], dt: -2 },
  vent: { icon: '💨', name: 'Grand vent', wind: [45, 90], dt: -2 },
  arcenciel: { icon: '🌈', name: 'Arc-en-ciel', wind: [5, 15], dt: 0 },
  canicule: { icon: '🔥', name: 'Canicule', wind: [0, 10], dt: 9 },
};
// les chances de chaque temps selon la saison
const SEASON = m => m === 12 || m <= 2 ? { soleil: 2, eclaircies: 2, nuageux: 3, pluie: 2, neige: 3, brouillard: 2, vent: 1, arcenciel: .3 }
  : m <= 5 ? { soleil: 3, eclaircies: 3, nuageux: 2, pluie: 3, orage: 1, vent: 1, arcenciel: 1, brouillard: .5 }
  : m <= 8 ? { soleil: 5, eclaircies: 2, nuageux: 1, pluie: 1, orage: 2, canicule: 1.5, arcenciel: .5 }
  : { soleil: 2, eclaircies: 2, nuageux: 3, pluie: 3, orage: 1, vent: 2, brouillard: 2, arcenciel: .5, ...(m === 11 ? { neige: .6 } : {}) };
const BASE_T = [5, 6, 10, 13, 17, 21, 24, 24, 20, 15, 9, 6];
const paris = ts => { const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', month: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(ts); const g = k => Number(p.find(x => x.type === k)?.value); return { m: g('month'), h: (g('hour') % 24) + g('minute') / 60 }; };
const hash = n => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

module.exports = function setupWeather({ io, getSettings, setSetting, isStaff, log = () => {} }) {
  // le temps d'un créneau (toujours le même pour un créneau donné : il ne change pas si le serveur redémarre)
  function slotWeather(slot) {
    const ts = slot * SLOT + SLOT / 2, { m, h } = paris(ts), w = SEASON(m);
    let r = hash(slot) * Object.values(w).reduce((a, b) => a + b, 0), type = 'nuageux';
    for (const [k, v] of Object.entries(w)) { if ((r -= v) <= 0) { type = k; break; } }
    // un peu de suite dans les idées : un créneau sur deux garde le temps d'avant
    if (slot % 2 && hash(slot * 7 + 1) < .55) type = slotWeather(slot - 1).type;
    return build(type, ts, slot);
  }
  function build(type, ts, seed = 0) {
    const T = TYPES[type] || TYPES.nuageux, { m, h } = paris(ts);
    const night = h < 7 || h >= 20;
    const day = -Math.cos((h - 3) / 24 * Math.PI * 2) * 4; // plus frais la nuit, plus chaud vers 15 h
    let temp = BASE_T[m - 1] + day + T.dt + (hash(seed * 3 + 2) - .5) * 4;
    if (type === 'neige') temp = Math.min(temp, -1 + hash(seed) * 3);
    if (type === 'canicule') temp = Math.max(temp, 33 + hash(seed) * 5);
    const wind = Math.round(T.wind[0] + hash(seed * 5 + 3) * (T.wind[1] - T.wind[0]));
    return { type, icon: night && T.night ? T.night : T.icon, name: night && T.nightName ? T.nightName : T.name, temp: Math.round(temp), wind, night, at: ts };
  }
  const forced = () => { try { const f = JSON.parse(getSettings().weatherForce || 'null'); return f && f.until > Date.now() && TYPES[f.type] ? f : null; } catch (e) { return null; } };
  function current() {
    const now = Date.now(), slot = Math.floor(now / SLOT), f = forced();
    const w = f ? { ...build(f.type, now, slot), forced: true, by: f.by, until: f.until } : { ...slotWeather(slot), at: now };
    w.next = (slot + 1) * SLOT;
    return w;
  }
  function forecast() {
    const slot = Math.floor(Date.now() / SLOT);
    return Array.from({ length: 6 }, (_, i) => { const w = slotWeather(slot + 1 + i); return { ...w, at: (slot + 1 + i) * SLOT }; });
  }
  const payload = () => ({ now: current(), forecast: forecast(), types: Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, { icon: v.icon, name: v.name }])) });
  // on prévient tout le monde quand le temps change
  let lastKey = '';
  setInterval(() => { const w = current(), k = w.type + ':' + w.icon + ':' + !!w.forced; if (k !== lastKey) { lastKey = k; io.emit('weather', payload()); } }, 30000).unref?.();
  return {
    current, TYPES,
    routes(app, auth) { app.get('/api/weather', (req, res) => res.json(payload())); },
    onConnection(socket, uid, cur) {
      socket.emit('weather', payload());
      // 🛡️ l'équipe peut choisir la météo pendant un moment (ou la remettre en automatique)
      socket.on('weather_set', (d, cb) => {
        const u = cur(); if (!u || !isStaff(u)) return cb && cb({ error: 'Réservé à l\'équipe' });
        if (!d || !d.type) setSetting('weatherForce', '');
        else { if (!TYPES[d.type]) return cb && cb({ error: 'Météo inconnue' }); const min = Math.max(10, Math.min(24 * 60, Number(d.minutes) || 60)); setSetting('weatherForce', JSON.stringify({ type: d.type, until: Date.now() + min * 60000, by: u.username })); }
        log(u, 'weather', d?.type ? `Météo forcée : ${TYPES[d.type].name} (${d.minutes || 60} min)` : 'Météo remise en automatique');
        lastKey = ''; io.emit('weather', payload());
        cb && cb({ ok: true });
      });
    },
  };
};
