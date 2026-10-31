// The Paradis — lecteur radio / musique
const Media = {
  audio: new Audio(),
  stations: [],
  current: null,
  playing: false,
  loading: false,
  volume: 0.7,

  async load() {
    try { this.stations = (await api('/api/stations')).stations; } catch (e) { this.stations = []; }
    renderPlayer();
  },
  isPlaying(st) {
    return !!(st && this.current && this.playing && this.current.url === st.url);
  },
  play(st, fromRoom) {
    if (!st || !st.url) return;
    this.current = { ...st, fromRoom: !!fromRoom };
    this.audio.src = st.url;
    this.audio.volume = this.volume;
    this.loading = true;
    renderPlayer();
    this.audio.play().catch(() => {});
    try { localStorage.setItem('lc_station', JSON.stringify(st)); } catch (e) {}
  },
  toggle() {
    if (!this.current) {
      let last = null;
      try { last = JSON.parse(localStorage.getItem('lc_station') || 'null'); } catch (e) {}
      return this.play(last || this.stations[0]);
    }
    if (this.playing) this.audio.pause();
    else { this.audio.src = this.current.url; this.loading = true; renderPlayer(); this.audio.play().catch(() => {}); }
  },
  stop() {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.playing = false;
    this.loading = false;
    renderPlayer();
  },
  setVolume(v) {
    this.volume = v;
    this.audio.volume = v;
    try { localStorage.setItem('lc_volume', String(v)); } catch (e) {}
  },
};
try { const v = parseFloat(localStorage.getItem('lc_volume')); if (v >= 0 && v <= 1) Media.volume = v; } catch (e) {}

Media.audio.addEventListener('playing', () => { Media.playing = true; Media.loading = false; renderPlayer(); });
Media.audio.addEventListener('pause', () => { Media.playing = false; Media.loading = false; renderPlayer(); });
Media.audio.addEventListener('error', () => {
  if (!Media.audio.getAttribute('src')) return;
  Media.playing = false; Media.loading = false;
  toast(`📻 Impossible de lire « ${Media.current?.name || 'ce flux'} » (flux indisponible ou lien invalide)`);
  renderPlayer();
});

function renderPlayer() {
  const c = Media.current;
  const box = $('player');
  box.replaceChildren(
    el('div', { class: 'player-top' },
      el('div', { class: 'player-art' + (Media.playing ? ' on' : '') }, c ? c.icon || '🎵' : '📻'),
      el('div', { class: 'meta' },
        el('div', { class: 'name' }, c ? c.name : 'Radio & musique'),
        el('div', { class: 'sub' }, Media.loading ? 'Chargement…' : Media.playing ? (c.fromRoom ? '● Radio du salon' : '● En direct') : c ? 'En pause' : 'Choisis une radio')),
      el('button', { class: 'btn btn-icon', title: Media.playing ? 'Pause' : 'Lecture', onclick: () => Media.toggle() }, Media.playing ? '⏸' : '▶'),
      el('button', { class: 'btn btn-icon', title: 'Choisir une radio', onclick: openStations }, '📻')),
    el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: Media.volume, class: 'volume', 'aria-label': 'Volume', oninput: e => Media.setVolume(parseFloat(e.target.value)) }));
  if (state.currentRoom && state.me) renderRoomHead();
}

function openStations() {
  const url = el('input', { class: 'input', placeholder: 'https://… (flux radio ou fichier .mp3)' });
  const card = st => el('button', {
    class: 'station' + (Media.isPlaying(st) ? ' active' : ''),
    onclick: () => { Media.play(st); close(); },
  }, el('span', { class: 'station-ico' }, st.icon), el('b', {}, st.name), el('small', {}, st.genre || ''));
  const roomSt = state.currentRoom?.station;
  const close = modal(
    el('h3', {}, '📻 Radios & musique'),
    roomSt ? el('div', { class: 'room-radio-note' }, `Radio de ce salon : ${roomSt.icon} ${roomSt.name} `,
      el('button', { class: 'btn btn-sm btn-primary', onclick: () => { Media.play(roomSt, true); close(); } }, 'Écouter')) : null,
    Media.stations.length ? el('div', { class: 'stations' }, ...Media.stations.map(card)) : el('p', { class: 'empty' }, 'Aucune radio configurée'),
    el('div', { class: 'field', style: 'margin-top:16px' }, el('label', {}, '🔗 Écouter un lien audio'),
      el('div', { class: 'row', style: 'gap:8px' }, url,
        el('button', { class: 'btn', style: 'flex:none', onclick: () => {
          if (!/^https?:\/\//i.test(url.value.trim())) return toast('Lien invalide (il doit commencer par https://)');
          Media.play({ name: 'Lien personnel', url: url.value.trim(), icon: '🔗' }); close();
        } }, '▶'))),
    el('div', { class: 'actions' },
      Media.current ? el('button', { class: 'btn btn-ghost', onclick: () => { Media.stop(); close(); } }, '⏹ Arrêter') : null,
      el('button', { class: 'btn btn-ghost', onclick: () => close() }, 'Fermer')));
}

socket.on('stations_changed', () => Media.load());
renderPlayer();
