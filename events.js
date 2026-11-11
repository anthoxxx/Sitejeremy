// The Paradise — Les Soirées événements 🎉
// Chaque semaine (par défaut le samedi à 21 h, heure de Paris) une grande soirée démarre toute seule :
// l'Île passe en mode fête (feux d'artifice, néons du thème), le Paradise Club passe la musique du thème,
// tout le monde est prévenu, et les pièces 💰 rapportent le double. Les admins peuvent aussi en lancer une quand ils veulent.
// Dates spéciales : Halloween, Saint-Valentin, Noël et le Réveillon du Nouvel An (avec le compte à rebours jusqu'à minuit).
const THEMES = {
  annees80: { title: 'Soirée Années 80', icon: '🕺', colors: ['#ff2d95', '#00f0ff', '#ffe600'], emojis: ['🕺', '💃', '📼', '🎸', '🪩'], music: 'tubes années 80 hits' },
  disco: { title: 'Soirée Disco', icon: '🪩', colors: ['#ffd76a', '#ff4fd8', '#c64dff'], emojis: ['🪩', '💃', '🕺', '✨', '🎶'], music: 'disco funk hits' },
  tropical: { title: 'Soirée Tropicale', icon: '🌴', colors: ['#2bff88', '#ffd34d', '#ff5fa2'], emojis: ['🌴', '🍍', '🥥', '🌺', '🍹'], music: 'musique tropicale été summer hits' },
  neon: { title: 'Soirée Néon', icon: '💡', colors: ['#ff2d55', '#2fa8ff', '#2bff88'], emojis: ['💡', '⚡', '🌈', '✨', '🪩'], music: 'electro dance party hits' },
  blanche: { title: 'Soirée Blanche', icon: '🤍', colors: ['#ffffff', '#c7d2fe', '#ffd76a'], emojis: ['🤍', '🕊️', '✨', '🥂', '💎'], music: 'deep house lounge chill' },
  zouk: { title: 'Soirée Zouk & Afro', icon: '🥁', colors: ['#ff8a1f', '#2bff88', '#ffe600'], emojis: ['🥁', '💃', '🌍', '🔥', '🎶'], music: 'zouk afro hits ambiance' },
  halloween: { title: 'Soirée Halloween', icon: '🎃', colors: ['#ff7a00', '#8a2be2', '#39ff14'], emojis: ['🎃', '👻', '🦇', '🕸️', '💀'], music: 'halloween party musique' },
  valentin: { title: 'Soirée Saint-Valentin', icon: '💘', colors: ['#ff2d6f', '#ff9ec4', '#ffffff'], emojis: ['💖', '💘', '🌹', '💌', '😍'], music: 'chansons d\'amour romantiques' },
  noel: { title: 'Soirée de Noël', icon: '🎄', colors: ['#ff2d55', '#2bff88', '#ffd76a'], emojis: ['🎄', '🎅', '❄️', '🎁', '⛄'], music: 'chansons de noël' },
  nouvelan: { title: 'Réveillon du Nouvel An', icon: '🎆', colors: ['#ffd76a', '#ffffff', '#c64dff'], emojis: ['🎆', '🥂', '🍾', '✨', '🎉'], music: 'hits fête nouvel an' },
};
const ROTATION = ['annees80', 'tropical', 'neon', 'disco', 'zouk', 'blanche'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

// ---------- L'heure de Paris ----------
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
function paris(ts) {
  const p = Object.fromEntries(fmt.formatToParts(ts).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}
// L'instant (en ms) qui correspond à une date et une heure de Paris
function parisTs(y, m, d, h, mi = 0) {
  let ts = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 2; i++) { const p = paris(ts); ts -= Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - Date.UTC(y, m - 1, d, h, mi); }
  return ts;
}
function themeFor(ts) {
  const p = paris(ts);
  if (p.m === 10 && p.d >= 24 || p.m === 11 && p.d <= 1) return 'halloween';
  if (p.m === 2 && p.d >= 9 && p.d <= 16) return 'valentin';
  if (p.m === 12 && p.d >= 15 && p.d <= 27) return 'noel';
  const week = Math.floor(Date.UTC(p.y, p.m - 1, p.d) / (7 * 86400000));
  return ROTATION[week % ROTATION.length];
}

module.exports = function setupEvents({ io, db, getSettings, setSetting, notify, notifyLive, getOnline, earn, track = () => {}, island, search, log = () => {} }) {
  const now = () => Date.now();
  const cfg = () => {
    const s = getSettings();
    return { auto: s.eventAuto !== '0', day: Math.max(0, Math.min(6, parseInt(s.eventDay ?? '6', 10))), hour: Math.max(0, Math.min(23, parseInt(s.eventHour ?? '21', 10))), duration: Math.max(30, Math.min(360, parseInt(s.eventDuration ?? '180', 10))) };
  };
  const manual = () => { try { return JSON.parse(getSettings().eventManual || 'null'); } catch (e) { return null; } };

  // Les prochaines soirées automatiques (la soirée de la semaine + le réveillon du 31 décembre)
  function autoEvents(from) {
    const c = cfg(), out = [];
    if (!c.auto) return out;
    const p = paris(from);
    for (let k = -1; k <= 8; k++) {
      const day = new Date(Date.UTC(p.y, p.m - 1, p.d + k));
      const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate();
      if (m === 12 && d === 31) { const start = parisTs(y, 12, 31, 22); out.push({ id: `ny-${y}`, theme: 'nouvelan', start, end: start + 3 * 3600000, countdownTo: parisTs(y + 1, 1, 1, 0), year: y + 1 }); continue; }
      if (day.getUTCDay() !== c.day) continue;
      const start = parisTs(y, m, d, c.hour);
      out.push({ id: `auto-${y}-${m}-${d}`, theme: themeFor(start), start, end: start + c.duration * 60000 });
    }
    return out.sort((a, b) => a.start - b.start);
  }
  // La soirée en cours, et la prochaine
  function current(t = now()) {
    const m = manual();
    if (m && m.end > t && m.start <= t) return m;
    const e = autoEvents(t).find(x => x.start <= t && x.end > t) || null;
    return e && getSettings().eventSkip === e.id ? null : e; // soirée annulée par un admin pour cette fois
  }
  function next(t = now()) {
    const m = manual();
    const list = autoEvents(t).filter(e => e.start > t && getSettings().eventSkip !== e.id);
    if (m && m.start > t) list.push(m);
    return list.sort((a, b) => a.start - b.start)[0] || null;
  }
  const withTheme = e => (e ? { ...e, ...THEMES[e.theme], themeId: e.theme } : null);
  const stateOut = () => ({ live: withTheme(current()), next: withTheme(next()), serverNow: now(), boost: current() ? 2 : 1 });
  const broadcast = () => io.emit('event', stateOut());

  // ---------- L'horloge des soirées ----------
  let liveId = null, remindedId = null, bonusAt = 0, bonusCount = 0, lastDj = 0;
  const members = () => [...getOnline().values()].filter(e => !e.ghost && e.user && !e.user.is_guest);
  function tick() {
    const t = now(), live = current(t), nx = next(t);
    // ⏰ 30 minutes avant : on prévient ceux qui sont connectés
    if (nx && !live && nx.start - t < 30 * 60000 && remindedId !== nx.id) {
      remindedId = nx.id;
      const th = THEMES[nx.theme];
      for (const e of members()) notifyLive(e.user.id, { type: 'event', icon: th.icon, title: `${th.icon} La ${th.title} commence dans 30 minutes !`, text: 'Prépare-toi, ça va être la fête sur l\'Île du Paradise 🏝️' });
    }
    if (live && liveId !== live.id) {
      // 🎉 La soirée commence !
      liveId = live.id; bonusAt = t; bonusCount = 0;
      const th = THEMES[live.theme];
      log(null, 'event_start', th.title);
      const recent = db.prepare('SELECT id FROM users WHERE is_guest=0 AND banned=0 AND last_seen>?').all(t - 14 * 86400000);
      const tx = db.transaction(() => { for (const r of recent) notify(r.id, { type: 'event', icon: th.icon, title: `🎉 La ${th.title} a commencé !`, text: 'Viens faire la fête sur l\'Île du Paradise : musique au Paradise Club, feux d\'artifice et pièces x2 💰', important: true }); });
      tx();
      broadcast();
    }
    if (!live && liveId) {
      // La soirée est finie
      io.emit('event_end', { id: liveId });
      liveId = null; broadcast();
    }
    if (live) {
      // 💰 Toutes les 15 minutes : 10 pièces pour ceux qui sont là (6 fois au maximum)
      if (t - bonusAt >= 15 * 60000 && bonusCount < 6) {
        bonusAt = t; bonusCount++;
        const th = THEMES[live.theme];
        for (const e of members()) { earn(e.user.id, 10, `${th.icon} Bonus de la ${th.title}`, { boost: false }); if (bonusCount === 1) track(e.user.id, 'party'); }
      }
      // 🎧 Le Paradise Club passe la musique du thème quand personne n'a rien mis
      if (island && search && t - lastDj > 30000 && island.mediaEmpty('club')) {
        lastDj = t;
        search(THEMES[live.theme].music, 15 * 60).then(res => {
          if (!res?.length || !island.mediaEmpty('club')) return;
          const v = res[Math.floor(Math.random() * Math.min(8, res.length))];
          island.playAuto('club', { ...v, username: '🎧 DJ Paradise' });
        }).catch(() => {});
      }
    }
  }
  setInterval(tick, 20000).unref?.();
  setTimeout(tick, 3000).unref?.();

  // ---------- Pour les admins ----------
  function startNow(theme, minutes) {
    if (!THEMES[theme]) return { error: 'Thème inconnu' };
    const start = now(), end = start + Math.max(15, Math.min(360, Number(minutes) || 120)) * 60000;
    setSetting('eventManual', JSON.stringify({ id: 'manual-' + start, theme, start, end }));
    tick(); broadcast();
    return { ok: true };
  }
  function planned(theme, startTs, minutes) {
    if (!THEMES[theme] || !(startTs > now())) return { error: 'Choisis un thème et une date dans le futur' };
    const end = startTs + Math.max(15, Math.min(360, Number(minutes) || 120)) * 60000;
    setSetting('eventManual', JSON.stringify({ id: 'manual-' + startTs, theme, start: startTs, end }));
    broadcast();
    return { ok: true };
  }
  function stop() {
    const m = manual(), live = current();
    if (m) setSetting('eventManual', 'null');
    // une soirée automatique en cours : on la passe pour cette fois
    if (live && live.id !== m?.id) setSetting('eventSkip', live.id);
    liveId && io.emit('event_end', { id: liveId });
    liveId = null; broadcast();
    return { ok: true };
  }
  function adminOut() { return { ...stateOut(), cfg: cfg(), themes: Object.entries(THEMES).map(([id, t]) => ({ id, title: t.title, icon: t.icon })), days: DAYS, upcoming: autoEvents(now()).filter(e => e.end > now()).slice(0, 4).map(withTheme) }; }
  function setCfg(b) {
    if (b.auto !== undefined) setSetting('eventAuto', b.auto ? '1' : '0');
    if (b.day !== undefined) setSetting('eventDay', String(Math.max(0, Math.min(6, parseInt(b.day, 10) || 0))));
    if (b.hour !== undefined) setSetting('eventHour', String(Math.max(0, Math.min(23, parseInt(b.hour, 10) || 0))));
    if (b.duration !== undefined) setSetting('eventDuration', String(Math.max(30, Math.min(360, parseInt(b.duration, 10) || 180))));
    broadcast(); return adminOut();
  }
  return { stateOut, isLive: () => !!current(), startNow, planned, stop, adminOut, setCfg, THEMES, onConnection: socket => { socket.emit('event', stateOut()); let last = 0; socket.on('event_refresh', () => { if (Date.now() - last < 4000) return; last = Date.now(); tick(); socket.emit('event', stateOut()); }); } };
};
