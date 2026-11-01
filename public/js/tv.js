// The Paradise — salon TV : tout le salon regarde la même chaîne, choisie avec le TV Bot
const Tv = {
  SLUG: 'tv', data: null, watching: false, mini: false, hls: null, loadedId: null, welcomed: false, failed: false,

  active() { return state.view?.type === 'room' && state.view.slug === this.SLUG; },

  onView() {
    const bar = $('tvBar');
    if (!this.active()) { this.stop(); bar.classList.add('hidden'); bar.replaceChildren(); this.watching = false; return; }
    bar.classList.remove('hidden');
    socket.emit('tv_state', d => this.update(d));
    if (!this.welcomed) {
      this.welcomed = true;
      addBotMessage({ username: 'TV Bot', botIcon: '📺', color: '#33d6a6', content: `Salut ${state.me.username} ! 📺 Je suis TV Bot. Ici on regarde ensemble la télé du monde entier. Clique sur « ▶ Regarder » pour voir la chaîne en cours, ou sur « 📺 Changer de chaîne » pour en choisir une par pays. Tape !aide pour mes commandes.`, createdAt: Date.now() }, true);
    }
  },

  update(d) {
    if (!d) return;
    const changed = d.current?.id !== this.data?.current?.id;
    this.data = d;
    if (changed) this.failed = false;
    if (this.active()) this.render();
  },

  // ---------- Lecture ----------
  async loadHls() {
    if (window.Hls) return window.Hls;
    await new Promise((ok, ko) => { const s = document.createElement('script'); s.src = '/vendor/hls.min.js'; s.onload = ok; s.onerror = ko; document.head.append(s); });
    return window.Hls;
  },
  async play(video, ch) {
    if (this.loadedId === ch.id && video.src) return;
    this.stop(video);
    this.loadedId = ch.id;
    const fail = () => {
      if (this.loadedId !== ch.id || this.failed) return;
      this.failed = true; this.render();
      socket.emit('tv_report', ch.id);
    };
    try {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = ch.url;
        video.onerror = fail;
      } else {
        const Hls = await this.loadHls();
        if (!Hls || !Hls.isSupported()) { toast('Ton navigateur ne peut pas lire la télé'); return; }
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        this.hls = hls;
        hls.on(Hls.Events.ERROR, (e, data) => { if (data.fatal) { hls.destroy(); if (this.hls === hls) this.hls = null; fail(); } });
        hls.loadSource(ch.url);
        hls.attachMedia(video);
      }
      if (window.Media?.stop) Media.stop();
      await video.play().catch(() => {});
    } catch (e) { fail(); }
  },
  stop(video) {
    if (this.hls) { try { this.hls.destroy(); } catch (e) {} this.hls = null; }
    const v = video || $('tvBar').querySelector('video');
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    this.loadedId = null;
  },

  render() {
    const bar = $('tvBar');
    const d = this.data || {};
    const c = d.current;
    if (!bar.querySelector('.k-stage-box')) {
      bar.replaceChildren(el('div', { class: 'k-stage-box' }),
        el('div', { class: 'k-video-box tv-box hidden' }, el('div', { class: 'k-video tv-video' }, el('video', { playsinline: true, controls: true, preload: 'none' }))),
        el('div', { class: 'k-bottom' }));
    }
    const video = bar.querySelector('video');
    const vbox = bar.querySelector('.tv-box');
    const stage = c
      ? el('div', { class: 'k-stage' },
        c.logo ? el('img', { class: 'k-thumb tv-logo', src: c.logo, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: e => e.target.remove() }) : el('div', { class: 'k-thumb tv-logo tv-noimg' }, '📺'),
        el('div', { class: 'k-now' },
          el('div', { class: 'k-label' }, this.failed ? '⚠️ Chaîne indisponible' : this.watching ? '🔴 En direct' : '📺 À l\'antenne'),
          el('b', { class: 'k-title-main' }, `${c.flag || ''} ${c.name}`.trim()),
          el('div', { class: 'k-title' }, (c.countryName ? c.countryName + ' · ' : '') + 'mise par ' + c.by)),
        el('div', { class: 'k-actions' },
          el('button', { class: 'btn btn-sm btn-primary', onclick: () => { this.watching = !this.watching; if (!this.watching) this.stop(); this.render(); } }, this.watching ? '⏹ Arrêter' : '▶ Regarder'),
          this.watching ? el('button', { class: 'btn btn-sm', title: this.mini ? 'Agrandir' : 'Réduire', onclick: () => { this.mini = !this.mini; this.render(); } }, this.mini ? '⤢' : '▁') : null,
          this.watching ? el('button', { class: 'btn btn-sm', title: 'Plein écran', onclick: () => (video.requestFullscreen ? video.requestFullscreen() : video.webkitEnterFullscreen?.()) }, '⛶') : null))
      : el('div', { class: 'k-stage empty' }, el('div', { class: 'k-now' },
        el('div', { class: 'k-label' }, '📺 Écran noir'),
        el('div', { class: 'k-title' }, d.ready ? `Choisis une chaîne parmi ${d.ready} du monde entier !` : d.status?.loading ? `TV Bot vérifie les chaînes… (${d.status.checked}/${d.status.total})` : 'TV Bot prépare la liste des chaînes, reviens dans quelques minutes.')));
    bar.querySelector('.k-stage-box').replaceChildren(stage);
    const show = !!(c && this.watching);
    vbox.classList.toggle('hidden', !show);
    vbox.querySelector('.tv-video').classList.toggle('mini', show && this.mini);
    if (show) this.play(video, c); else if (this.loadedId) this.stop(video);
    bar.querySelector('.k-bottom').replaceChildren(
      el('span', { class: 'k-qlabel' }, d.ready ? `🌍 ${d.ready} chaînes` : ''),
      el('span', { style: 'flex:1' }),
      el('button', { class: 'btn btn-sm btn-primary k-pick', onclick: () => this.openPicker() }, '📺 Changer de chaîne'));
  },

  // ---------- Choisir une chaîne ----------
  async openPicker() {
    const country = el('select', { class: 'input' }, el('option', { value: '' }, '🌍 Tous les pays'));
    const search = el('input', { class: 'input', placeholder: 'Nom de la chaîne…', maxlength: 60 });
    const list = el('div', { class: 'k-results tv-list' }, el('p', { class: 'empty' }, 'Chargement…'));
    const close = modal(el('h3', {}, '📺 Choisis une chaîne'),
      el('p', { class: 'help', style: 'margin:-4px 0 10px' }, 'Chaînes gratuites diffusées librement sur Internet, vérifiées par le TV Bot. Elle passera pour tout le salon.'),
      el('div', { class: 'tv-filters' }, country, search), list);
    const load = async () => {
      try {
        const d = await api(`/api/tv/channels?country=${encodeURIComponent(country.value)}&q=${encodeURIComponent(search.value)}`);
        if (!d.channels.length) return list.replaceChildren(el('p', { class: 'empty' }, 'Aucune chaîne trouvée.'));
        list.replaceChildren(...[...d.channels.map(ch => el('button', { class: 'k-result tv-item', onclick: () => socket.emit('tv_set', ch.id, r => { if (r?.error) return toast(r.error); close(); if (!this.watching) { this.watching = true; this.render(); } }) },
          ch.logo ? el('img', { src: ch.logo, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: e => e.target.replaceWith(el('span', { class: 'tv-noimg' }, '📺')) }) : el('span', { class: 'tv-noimg' }, '📺'),
          el('div', { class: 'k-rmeta' }, el('b', {}, ch.name), el('small', {}, `${ch.flag || ''} ${ch.countryName || ''}${ch.categories?.length ? ' · ' + ch.categories.slice(0, 2).join(', ') : ''}`)))),
        d.more ? el('p', { class: 'help center' }, 'Affine ta recherche pour voir plus de chaînes.') : null].filter(Boolean));
      } catch (e) { list.replaceChildren(el('p', { class: 'empty' }, e.message)); }
    };
    let t;
    search.oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
    country.onchange = load;
    try {
      const d = await api('/api/tv/countries');
      country.append(...d.countries.map(c => el('option', { value: c.code }, `${c.flag || ''} ${c.name} (${c.count})`)));
      if (d.countries.some(c => c.code === 'FR')) country.value = 'FR';
    } catch (e) {}
    load();
  },
};

socket.on('tv', d => Tv.update(d));
document.addEventListener('viewchange', () => Tv.onView());
