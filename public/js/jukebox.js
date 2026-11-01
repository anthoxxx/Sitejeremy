// The Paradise — bots musicaux : KaraoBot (salon Karaoké) et DJ Bot (salon Musique)
const JB_MODES = {
  karaoke: {
    bot: 'KaraoBot', icon: '🤖', pick: '🎤 Choisir une chanson', pickTitle: '🎤 Choisis ta chanson',
    pickHelp: 'KaraoBot cherche la version karaoké (avec les paroles à l\'écran). Tu passeras quand ce sera ton tour.',
    welcome: n => `Salut ${n} ! 🎶 Je suis KaraoBot. Clique sur « 🎤 Choisir une chanson » pour t'inscrire, puis rejoins le vocal 🎙️ quand c'est ton tour. Tape !aide pour voir mes commandes.`,
    added: t => '🎶 Tu es inscrit : « ' + t + ' »',
  },
  music: {
    bot: 'DJ Bot', icon: '🎧', pick: '🎵 Mettre une musique', pickTitle: '🎵 Mets la musique que tu veux',
    pickHelp: 'Cherche un titre ou un artiste, ou colle un lien YouTube. Ta musique passera pour tout le salon, à son tour dans la file.',
    welcome: n => `Salut ${n} ! 🎧 Je suis DJ Bot. Ici chacun met la musique qu'il veut et tout le salon l'écoute en même temps. Clique sur « 🔊 Écouter » pour entendre, et sur « 🎵 Mettre une musique » pour ajouter la tienne. Tape !aide pour mes commandes.`,
    added: t => '🎵 Ajouté à la file : « ' + t + ' »',
  },
};
const JB_ROOMS = { karaoke: 'karaoke', musique: 'music' };

const Jukebox = {
  slug: null, data: null, offset: 0,
  watching: false,       // karaoké : vidéo affichée pour la chanson en cours
  listening: false,      // musique : on écoute (reste actif d'une musique à l'autre)
  mini: false,           // musique : lecteur réduit
  welcomed: new Set(),

  mode() { return JB_MODES[JB_ROOMS[this.slug]]; },
  isMusic() { return JB_ROOMS[this.slug] === 'music'; },

  onView() {
    const bar = $('karaokeBar');
    const slug = state.view?.type === 'room' && JB_ROOMS[state.view.slug] ? state.view.slug : null;
    if (slug !== this.slug) { this.watching = false; this.listening = false; this.data = null; }
    this.slug = slug;
    if (!slug) { bar.classList.add('hidden'); bar.replaceChildren(); bar.dataset.slug = ''; return; }
    if (slug !== bar.dataset.slug) { bar.dataset.slug = slug; bar.replaceChildren(); }
    bar.classList.remove('hidden');
    bar.classList.toggle('music', this.isMusic());
    socket.emit('jb_state', slug, d => this.update(d));
    if (!this.welcomed.has(slug)) {
      this.welcomed.add(slug);
      addBotMessage({ username: this.mode().bot, botIcon: this.mode().icon, content: this.mode().welcome(state.me.username), createdAt: Date.now() }, true);
    }
  },

  update(d) {
    if (!d || d.slug !== this.slug) return;
    const prevId = this.data?.current?.id;
    this.data = d;
    this.offset = (d.serverNow || Date.now()) - Date.now();
    if (d.current?.id !== prevId) this.watching = false;
    this.render();
  },

  elapsed() { const c = this.data?.current; return c ? Math.max(0, Math.floor((Date.now() + this.offset - c.startedAt) / 1000)) : 0; },

  player(c) {
    return el('div', { class: 'k-video' + (this.isMusic() && this.mini ? ' mini' : '') }, el('iframe', {
      src: `https://www.youtube-nocookie.com/embed/${c.videoId}?autoplay=1&playsinline=1&rel=0&start=${this.elapsed()}`,
      allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, title: c.title }));
  },

  render() {
    const bar = $('karaokeBar');
    if (!this.slug || !this.data) return;
    const { current, queue } = this.data;
    const music = this.isMusic();
    const mine = current?.userId === state.me.id;

    let actions = [];
    if (current && music) {
      actions = [
        el('button', { class: 'btn btn-sm btn-primary', onclick: () => { this.listening = !this.listening; if (this.listening && window.Media?.stop) Media.stop(); this.render(); } }, this.listening ? '🔇 Couper' : '🔊 Écouter'),
        this.listening ? el('button', { class: 'btn btn-sm', title: this.mini ? 'Afficher la vidéo' : 'Réduire la vidéo', onclick: () => { this.mini = !this.mini; this.render(); } }, this.mini ? '📺' : '▁') : null,
        el('button', { class: 'btn btn-sm', title: mine || isStaff() ? 'Passer à la suite' : 'Voter pour passer', onclick: () => socket.emit('jb_next', this.slug, r => r?.error && toast(r.error)) },
          mine || isStaff() ? '⏭' : `⏭ ${this.data.votes || 0}/${this.data.votesNeeded || 1}`),
      ];
    } else if (current) {
      actions = [
        el('button', { class: 'btn btn-sm btn-primary', onclick: () => { this.watching = !this.watching; this.render(); } }, this.watching ? '⏹ Masquer' : '▶ Vidéo'),
        mine || isStaff() ? el('button', { class: 'btn btn-sm', title: 'Chanson suivante', onclick: () => socket.emit('jb_next', this.slug, r => r?.error && toast(r.error)) }, mine ? '✅ J\'ai fini' : '⏭') : null,
      ];
    }
    const stage = current
      ? el('div', { class: 'k-stage' + (mine && !music ? ' mine' : '') },
        el('img', { class: 'k-thumb', src: `https://i.ytimg.com/vi/${current.videoId}/mqdefault.jpg`, alt: '', loading: 'lazy' }),
        el('div', { class: 'k-now' },
          el('div', { class: 'k-label' }, music ? (this.listening ? '🔊 En écoute' : '🎶 En cours') : mine ? '🌟 C\'est ton tour !' : '🎤 Sur scène'),
          music ? el('b', { class: 'k-title-main' }, current.title) : el('b', {}, current.username),
          el('div', { class: 'k-title' }, music ? 'Demandé par ' + current.username : current.title)),
        el('div', { class: 'k-actions' }, ...actions))
      : el('div', { class: 'k-stage empty' }, el('div', { class: 'k-now' },
        el('div', { class: 'k-label' }, music ? '🎧 Rien ne passe' : '🎤 Scène libre'),
        el('div', { class: 'k-title' }, music ? 'Mets la première musique !' : 'Personne ne chante : lance-toi !')));
    const showPlayer = current && (music ? this.listening : this.watching);
    const queueEl = el('div', { class: 'k-queue' },
      el('span', { class: 'k-qlabel' }, queue.length ? `À suivre (${queue.length})` : 'File vide'),
      ...queue.map((q, i) => el('span', { class: 'k-chip' + (q.userId === state.me.id ? ' mine' : ''), title: q.title },
        `${i + 1}. ${music ? q.title + ' · ' + q.username : q.username + ' · ' + q.title}`,
        q.userId === state.me.id || isStaff() ? el('button', { class: 'k-x', title: 'Retirer', onclick: () => socket.emit('jb_remove', this.slug, q.id, r => r?.error && toast(r.error)) }, '✕') : null)));
    // Trois zones fixes : le lecteur n'est jamais déplacé (sinon la musique recommence)
    if (!bar.querySelector('.k-stage-box')) bar.replaceChildren(el('div', { class: 'k-stage-box' }), el('div', { class: 'k-video-box' }), el('div', { class: 'k-bottom' }));
    bar.querySelector('.k-stage-box').replaceChildren(stage);
    const vbox = bar.querySelector('.k-video-box');
    const key = showPlayer ? current.id + ':' + current.videoId : '';
    if (vbox.dataset.key !== key) { vbox.dataset.key = key; vbox.replaceChildren(...(showPlayer ? [this.player(current)] : [])); }
    vbox.querySelector('.k-video')?.classList.toggle('mini', music && this.mini);
    bar.querySelector('.k-bottom').replaceChildren(queueEl,
      el('button', { class: 'btn btn-sm btn-primary k-pick', onclick: () => this.openPicker() }, this.mode().pick));
  },

  // ---------- Choisir une chanson / une musique ----------
  async openPicker() {
    const slug = this.slug, M = this.mode();
    const input = el('input', { class: 'input', placeholder: 'Titre, artiste… ou lien YouTube', maxlength: 200, enterkeyhint: 'search' });
    const results = el('div', { class: 'k-results' });
    const catBox = el('div', { class: 'k-catalog' });
    const close = modal(el('h3', {}, M.pickTitle),
      el('p', { class: 'help', style: 'margin:-4px 0 10px' }, M.pickHelp),
      el('form', { class: 'k-search', onsubmit: e => { e.preventDefault(); search(input.value); } }, input, el('button', { class: 'btn btn-primary' }, '🔍')),
      results, catBox);
    const add = song => socket.emit('jb_add', { ...song, slug }, r => {
      if (r?.error) return toast(r.error);
      toast(M.added(song.title));
      close();
    });
    const search = async q => {
      q = q.trim();
      if (q.length < 2) return;
      const info = /^https?:\/\//.test(q) && typeof embedInfo === 'function' ? embedInfo(q) : null;
      if (info?.type === 'youtube') {
        const title = el('input', { class: 'input', placeholder: 'Nom de la musique', maxlength: 120 });
        results.replaceChildren(el('div', { class: 'k-result' },
          el('img', { src: info.thumb.replace('hqdefault', 'mqdefault'), alt: '' }),
          el('div', { class: 'k-rmeta' }, title),
          el('button', { class: 'btn btn-sm btn-primary', onclick: () => add({ videoId: info.id, title: title.value.trim() || 'Musique YouTube' }) }, '＋')));
        title.focus();
        return;
      }
      results.replaceChildren(el('p', { class: 'empty' }, `🔍 ${M.bot} cherche…`));
      try {
        const d = await api(`/api/jukebox/${slug}/search?q=` + encodeURIComponent(q));
        if (!d.results.length) {
          return results.replaceChildren(...[el('p', { class: 'empty' }, d.error || 'Aucun résultat, essaie avec le nom de l\'artiste.'),
            d.searchUrl ? el('a', { class: 'btn btn-sm', href: d.searchUrl, target: '_blank', rel: 'noopener', style: 'display:block;text-align:center' }, 'Ouvrir la recherche sur YouTube ↗') : null].filter(Boolean));
        }
        results.replaceChildren(...d.results.map(r => el('div', { class: 'k-result' },
          el('img', { src: `https://i.ytimg.com/vi/${r.videoId}/mqdefault.jpg`, alt: '', loading: 'lazy' }),
          el('div', { class: 'k-rmeta' }, el('b', {}, r.title), el('small', {}, `${r.channel} · ${r.length}`)),
          el('button', { class: 'btn btn-sm btn-primary', title: 'Ajouter à la file', onclick: () => add({ videoId: r.videoId, title: r.title, duration: r.duration }) }, '＋'))));
      } catch (e) { results.replaceChildren(el('p', { class: 'empty' }, e.message)); }
    };
    try {
      const { catalog } = await api(`/api/jukebox/${slug}/catalog`);
      catBox.replaceChildren(el('div', { class: 'k-catlabel' }, '💡 Idées'),
        ...catalog.map(c => el('details', {}, el('summary', {}, c.cat),
          el('div', { class: 'k-songs' }, ...c.songs.map(([artist, title]) => el('button', { class: 'choice', onclick: () => { input.value = `${artist} ${title}`; search(input.value); results.scrollIntoView({ block: 'nearest' }); } }, `${title} — ${artist}`))))));
    } catch (e) {}
    input.focus();
  },
};

socket.on('jukebox', d => Jukebox.update(d));
document.addEventListener('viewchange', () => Jukebox.onView());
