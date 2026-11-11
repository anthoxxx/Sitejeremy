// The Paradise — Les Soirées événements 🎉 (côté navigateur)
// La bannière avec le compte à rebours, le mode fête pendant la soirée, et le décompte du Nouvel An.
const Events = (() => {
  let st = null, offset = 0, lastRain = 0, nyShown = '', lastRefresh = 0;
  const now = () => Date.now() + offset;
  const left = ms => {
    const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    if (d) return `${d} j ${h} h`;
    if (h) return `${h} h ${String(m).padStart(2, '0')} min`;
    if (m) return `${m} min ${String(s % 60).padStart(2, '0')} s`;
    return `${s % 60} s`;
  };
  const when = ts => {
    const d = new Date(ts), today = new Date(now()), tomorrow = new Date(now() + 86400000);
    const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).replace(':', ' h ');
    const same = (a, b) => a.toDateString() === b.toDateString();
    return same(d, today) ? `ce soir à ${hm}` : same(d, tomorrow) ? `demain à ${hm}` : `${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })} à ${hm}`;
  };
  function apply(d) {
    const wasLive = st?.live?.id;
    st = d; offset = (d.serverNow || Date.now()) - Date.now();
    window.EventState = d;
    const live = d.live;
    document.body.classList.toggle('event-live', !!live);
    if (live) { const [a, b, c] = live.colors; document.body.style.setProperty('--ev1', a); document.body.style.setProperty('--ev2', b); document.body.style.setProperty('--ev3', c); }
    if (live && wasLive !== live.id && state.me) {
      let seen = ''; try { seen = localStorage.getItem('evSeen') || ''; } catch (e) {}
      if (seen !== live.id) { try { localStorage.setItem('evSeen', live.id); } catch (e) {} LC.confetti(live.emojis); lastRain = now(); }
    }
    render();
  }
  socket.on('event', apply);
  socket.on('event_end', () => toast('🌙 La soirée est terminée… merci d\'être venus ! À la semaine prochaine 💖'));

  function joinParty() {
    if (typeof Island === 'undefined') return;
    Island.open(() => socket.emit('inst_enter', 'club', r => r?.error && toast(r.error)));
  }
  // La bannière en haut des salons
  function render() {
    let b = document.getElementById('eventBanner');
    const host = document.getElementById('seasonBanner');
    if (!host) return;
    if (!b) { b = el('div', { class: 'ev-banner hidden', id: 'eventBanner' }); host.before(b); }
    const live = st?.live, nx = st?.next;
    // on annonce la prochaine soirée seulement si elle est dans moins de 3 jours
    if (!live && !(nx && nx.start - now() < 3 * 86400000)) return b.classList.add('hidden');
    b.classList.remove('hidden');
    b.classList.toggle('live', !!live);
    if (live) {
      b.replaceChildren(el('span', { class: 'ev-icon' }, live.icon),
        el('div', { class: 'ev-txt' }, el('b', {}, `C'EST LA ${live.title.toUpperCase()} !`), el('small', { class: 'ev-left' }, '')),
        el('span', { class: 'ev-x2' }, '💰 x2'),
        el('button', { class: 'btn btn-sm btn-primary', onclick: joinParty }, '🏝️ Rejoindre la fête'));
    } else {
      b.replaceChildren(el('span', { class: 'ev-icon' }, nx.icon),
        el('div', { class: 'ev-txt' }, el('b', {}, `${nx.title} ${when(nx.start)}`), el('small', { class: 'ev-left' }, '')));
    }
    tick();
  }
  function tick() {
    const b = document.getElementById('eventBanner');
    const live = st?.live, nx = st?.next;
    const t = b?.querySelector('.ev-left');
    if (t) t.textContent = live ? (live.countdownTo && live.countdownTo > now() ? `⏳ ${left(live.countdownTo - now())} avant ${live.year} !` : `Encore ${left(live.end - now())} de fête · musique au Paradise Club, feux d'artifice, pièces x2`) : nx ? `⏳ dans ${left(nx.start - now())}` : '';
    if ((live && live.end < now() || nx && !live && nx.start <= now()) && now() - lastRefresh > 5000) { lastRefresh = now(); socket.emit('event_refresh'); }
    // pendant la soirée : de temps en temps une pluie d'émojis du thème
    if (live && now() - lastRain > 150000 && document.visibilityState === 'visible') { lastRain = now(); LC.confetti(live.emojis); }
    // 🎆 Le décompte du Nouvel An
    if (live?.countdownTo) {
      const r = live.countdownTo - now();
      let o = document.querySelector('.ny-count');
      if (r <= 10000 && r > -30000) {
        if (!o) { o = el('div', { class: 'ny-count' }); document.body.append(o); }
        if (r > 0) o.replaceChildren(el('b', {}, String(Math.ceil(r / 1000))));
        else { o.replaceChildren(el('b', { class: 'ny' }, `🎆 BONNE ANNÉE ${live.year} ! 🎆`)); if (nyShown !== live.id) { nyShown = live.id; LC.confetti(['🎆', '🥂', '🍾', '✨', '🎉']); setTimeout(() => LC.confetti(['🎆', '🎇', '✨']), 1500); } }
      } else o?.remove();
    }
  }
  setInterval(tick, 1000);
  fetch('/api/event').then(r => r.json()).then(apply).catch(() => {});
  return { state: () => st, joinParty };
})();
window.Events = Events;
