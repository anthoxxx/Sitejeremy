// The Paradise — salon Karaoké : scène, file d'attente et choix des chansons avec le KaraoBot
const Karaoke = {
  SLUG: 'karaoke',
  data: { current: null, queue: [], offset: 0 },
  watching: false,
  welcomed: false,

  active() { return state.view?.type === 'room' && state.view.slug === this.SLUG; },

  onView() {
    const bar = $('karaokeBar');
    if (!this.active()) { bar.classList.add('hidden'); bar.replaceChildren(); this.watching = false; return; }
    bar.classList.remove('hidden');
    socket.emit('karaoke_state', d => this.update(d));
    if (!this.welcomed) {
      this.welcomed = true;
      addBotMessage({ username: 'KaraoBot', content: `Salut ${state.me.username} ! 🎶 Je suis KaraoBot. Clique sur « 🎤 Choisir une chanson » pour t'inscrire, puis rejoins le vocal 🎙️ quand c'est ton tour. Tape !aide pour voir mes commandes.`, createdAt: Date.now() }, true);
    }
  },

  update(d) {
    if (!d) return;
    const prevId = this.data.current?.id;
    this.data = { current: d.current, queue: d.queue || [], offset: (d.serverNow || Date.now()) - Date.now() };
    if (this.data.current?.id !== prevId) this.watching = false;
    if (this.active()) this.render();
  },

  elapsed() { const c = this.data.current; return c ? Math.max(0, Math.floor((Date.now() + this.data.offset - c.startedAt) / 1000)) : 0; },

  render() {
    const bar = $('karaokeBar');
    const { current, queue } = this.data;
    const canSkip = current && (current.userId === state.me.id || isStaff());
    const mine = current?.userId === state.me.id;
    const stage = current
      ? el('div', { class: 'k-stage' + (mine ? ' mine' : '') },
        el('img', { class: 'k-thumb', src: `https://i.ytimg.com/vi/${current.videoId}/mqdefault.jpg`, alt: '', loading: 'lazy' }),
        el('div', { class: 'k-now' },
          el('div', { class: 'k-label' }, mine ? '🌟 C\'est ton tour !' : '🎤 Sur scène'),
          el('b', {}, current.username), el('div', { class: 'k-title' }, current.title)),
        el('div', { class: 'k-actions' },
          el('button', { class: 'btn btn-sm btn-primary', onclick: () => { this.watching = !this.watching; this.render(); } }, this.watching ? '⏹ Masquer' : '▶ Vidéo'),
          canSkip ? el('button', { class: 'btn btn-sm', title: 'Chanson suivante', onclick: () => socket.emit('karaoke_next', r => r?.error && toast(r.error)) }, mine ? '✅ J\'ai fini' : '⏭') : null))
      : el('div', { class: 'k-stage empty' }, el('div', { class: 'k-now' }, el('div', { class: 'k-label' }, '🎤 Scène libre'), el('div', { class: 'k-title' }, 'Personne ne chante : lance-toi !')));
    const video = current && this.watching
      ? el('div', { class: 'k-video' }, el('iframe', {
        src: `https://www.youtube-nocookie.com/embed/${current.videoId}?autoplay=1&playsinline=1&rel=0&start=${this.elapsed()}`,
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, title: current.title }))
      : null;
    const queueEl = el('div', { class: 'k-queue' },
      el('span', { class: 'k-qlabel' }, queue.length ? `À suivre (${queue.length})` : 'File vide'),
      ...queue.map((q, i) => el('span', { class: 'k-chip' + (q.userId === state.me.id ? ' mine' : ''), title: q.title },
        `${i + 1}. ${q.username} · ${q.title}`,
        q.userId === state.me.id || isStaff() ? el('button', { class: 'k-x', title: 'Retirer', onclick: () => socket.emit('karaoke_remove', q.id, r => r?.error && toast(r.error)) }, '✕') : null)));
    bar.replaceChildren(...[stage, video, el('div', { class: 'k-bottom' }, queueEl,
      el('button', { class: 'btn btn-sm btn-primary k-pick', onclick: () => this.openPicker() }, '🎤 Choisir une chanson'))].filter(Boolean));
  },

  // ---------- Choisir une chanson ----------
  async openPicker() {
    const input = el('input', { class: 'input', placeholder: 'Titre, artiste… ou lien YouTube', maxlength: 200, enterkeyhint: 'search' });
    const results = el('div', { class: 'k-results' });
    const catBox = el('div', { class: 'k-catalog' });
    const close = modal(el('h3', {}, '🎤 Choisis ta chanson'),
      el('p', { class: 'help', style: 'margin:-4px 0 10px' }, 'KaraoBot cherche la version karaoké (avec les paroles à l\'écran). Tu passeras quand ce sera ton tour.'),
      el('form', { class: 'k-search', onsubmit: e => { e.preventDefault(); search(input.value); } }, input, el('button', { class: 'btn btn-primary' }, '🔍')),
      results, catBox);
    const add = song => socket.emit('karaoke_add', song, r => {
      if (r?.error) return toast(r.error);
      toast('🎶 Tu es inscrit : « ' + song.title + ' »');
      close();
    });
    const search = async q => {
      q = q.trim();
      if (q.length < 2) return;
      // Lien YouTube collé directement
      const info = /^https?:\/\//.test(q) && typeof embedInfo === 'function' ? embedInfo(q) : null;
      if (info?.type === 'youtube') {
        const title = el('input', { class: 'input', placeholder: 'Nom de la chanson', maxlength: 120 });
        results.replaceChildren(el('div', { class: 'k-result' },
          el('img', { src: info.thumb.replace('hqdefault', 'mqdefault'), alt: '' }),
          el('div', { class: 'k-rmeta' }, title),
          el('button', { class: 'btn btn-sm btn-primary', onclick: () => add({ videoId: info.id, title: title.value.trim() || 'Chanson YouTube' }) }, '＋')));
        title.focus();
        return;
      }
      results.replaceChildren(el('p', { class: 'empty' }, '🔍 KaraoBot cherche…'));
      try {
        const d = await api('/api/karaoke/search?q=' + encodeURIComponent(q));
        if (!d.results.length) {
          return results.replaceChildren(el('p', { class: 'empty' }, d.error || 'Aucun résultat, essaie avec le nom de l\'artiste.'),
            d.searchUrl ? el('a', { class: 'btn btn-sm', href: d.searchUrl, target: '_blank', rel: 'noopener', style: 'display:block;text-align:center' }, 'Ouvrir la recherche sur YouTube ↗') : null);
        }
        results.replaceChildren(...d.results.map(r => el('div', { class: 'k-result' },
          el('img', { src: `https://i.ytimg.com/vi/${r.videoId}/mqdefault.jpg`, alt: '', loading: 'lazy' }),
          el('div', { class: 'k-rmeta' }, el('b', {}, r.title), el('small', {}, `${r.channel} · ${r.length}`)),
          el('button', { class: 'btn btn-sm btn-primary', title: 'Ajouter à la file', onclick: () => add({ videoId: r.videoId, title: r.title, duration: r.duration }) }, '＋'))));
      } catch (e) { results.replaceChildren(el('p', { class: 'empty' }, e.message)); }
    };
    try {
      const { catalog } = await api('/api/karaoke/catalog');
      catBox.replaceChildren(el('div', { class: 'k-catlabel' }, '💡 Idées de chansons'),
        ...catalog.map(c => el('details', {}, el('summary', {}, c.cat),
          el('div', { class: 'k-songs' }, ...c.songs.map(([artist, title]) => el('button', { class: 'choice', onclick: () => { input.value = `${artist} ${title}`; search(input.value); results.scrollIntoView({ block: 'nearest' }); } }, `${title} — ${artist}`))))));
    } catch (e) {}
    input.focus();
  },
};

socket.on('karaoke', d => Karaoke.update(d));
document.addEventListener('viewchange', () => Karaoke.onView());
