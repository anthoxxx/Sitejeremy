// The Paradise — « Le Mot d'Or » : la grille, le clavier et les grilles des autres joueurs
const MotDor = {
  SLUG: 'motdor', data: null, offset: 0, welcomed: false, tick: null, typed: '', mini: false, ctx: null, lastRows: 0,

  active() { return state.view?.type === 'room' && state.view.slug === this.SLUG; },
  onView() {
    const box = $('mdStage');
    if (!this.active()) { box.classList.add('hidden'); box.replaceChildren(); clearInterval(this.tick); this.tick = null; return; }
    box.classList.remove('hidden');
    socket.emit('md_state', d => this.update(d));
    if (!this.tick) this.tick = setInterval(() => this.updateTimer(), 250);
    if (!this.welcomed) {
      this.welcomed = true;
      addBotMessage({ username: 'Maestro Paradise', botIcon: '🎩', color: '#ffc94d', content: `Bonsoir ${state.me.username} ! ✨ Bienvenue au Mot d'Or. Trouve le mot caché en 6 essais : la première lettre est donnée. Lettre dorée = bien placée, lettre violette = présente mais mal placée. Rejoins la partie avec « ✨ Je joue » ! Tape !aide pour les règles.`, createdAt: Date.now() }, true);
    }
  },
  update(d) {
    if (!d) return;
    const prev = this.data;
    this.offset = d.now - Date.now();
    this.data = d;
    if (!prev || prev.wordNo !== d.wordNo || prev.phase !== d.phase && d.phase === 'play') this.typed = d.first || '';
    const mine = d.players.find(p => p.id === state.me.id);
    if (mine && mine.rows.length > this.lastRows && d.phase === 'play') { this.typed = d.first; this.sfx(mine.found ? 'win' : 'flip'); }
    this.lastRows = mine ? mine.rows.length : 0;
    if (prev?.phase === 'play' && d.phase === 'reveal') this.sfx('reveal');
    if (this.active()) this.render();
  },
  emit(ev, arg, cb) { socket.emit(ev, arg, r => { if (r?.error) toast(r.error); cb && cb(r); }); },
  sfx(kind) {
    try {
      const ctx = this.ctx || (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const t = ctx.currentTime;
      const tone = (f, s, dur, vol = .08) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(vol, t + s); g.gain.exponentialRampToValueAtTime(.0001, t + s + dur); o.connect(g).connect(ctx.destination); o.start(t + s); o.stop(t + s + dur + .02); };
      if (kind === 'flip') [660, 740, 830, 880, 990, 1100, 1180].forEach((f, i) => tone(f, i * .07, .1, .05));
      if (kind === 'win') [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * .1, .3));
      if (kind === 'reveal') [784, 659, 523].forEach((f, i) => tone(f, i * .12, .25));
    } catch (e) {}
  },

  // ---------- Saisie (clavier de l'appareil ou clavier à l'écran) ----------
  canType() { const d = this.data; const me = d?.players.find(p => p.id === state.me.id); return d?.phase === 'play' && me && !me.done; },
  key(k) {
    if (!this.canType()) return;
    const d = this.data;
    if (k === 'ENTER') {
      if (this.typed.length !== d.length) return toast(`Le mot fait ${d.length} lettres`);
      return this.emit('md_guess', this.typed);
    }
    if (k === 'DEL') { if (this.typed.length > 1) this.typed = this.typed.slice(0, -1); }
    else if (/^[A-Z]$/.test(k) && this.typed.length < d.length) this.typed += k;
    this.drawGrid();
  },

  render() {
    const box = $('mdStage'), d = this.data;
    if (!d) return;
    const me = state.me.id, mine = d.players.find(p => p.id === me), joined = !!mine;
    if (!box.querySelector('.md-grid')) {
      box.replaceChildren(el('div', { class: 'pa-shine' }), el('div', { class: 'md-top' }),
        el('div', { class: 'md-main' }, el('div', { class: 'md-left' }, el('div', { class: 'md-grid' }), el('div', { class: 'md-keys' })), el('div', { class: 'md-others' })),
        el('div', { class: 'md-ctrl' }));
    }
    box.classList.toggle('mini', this.mini);
    box.querySelector('.md-top').replaceChildren(...[
      el('img', { class: 'pa-logo', src: '/img/logo-mark.webp?v=3', alt: '' }),
      el('b', { class: 'pa-title' }, 'Le Mot d\'Or'),
      d.phase !== 'lobby' && d.phase !== 'end' ? el('span', { class: 'pa-chip' }, `Mot ${d.wordNo}/${d.total} · ${d.length} lettres`) : null,
      el('span', { style: 'flex:1' }), el('span', { class: 'pa-timer md-timer' }),
      el('button', { class: 'btn btn-sm', title: this.mini ? 'Agrandir' : 'Réduire', onclick: () => { this.mini = !this.mini; this.render(); } }, this.mini ? '✨' : '▁')].filter(Boolean));
    this.drawGrid();
    // Les autres joueurs : on voit seulement leurs couleurs (pas leurs lettres) pendant la recherche
    box.querySelector('.md-others').replaceChildren(...(d.players.length ? d.players.filter(p => p.id !== me || d.phase !== 'play').map(p => el('div', { class: 'md-other' + (p.found ? ' found' : '') + (p.done && !p.found ? ' out' : ''), 'data-uid': p.id },
      el('div', { class: 'md-ohead' }, LC.avatar(p), el('b', { style: 'color:' + (p.color || '#fff') }, p.username), el('span', { class: 'pa-score' }, p.score)),
      d.phase !== 'lobby' ? el('div', { class: 'md-mini' }, ...p.rows.map(r => el('div', { class: 'md-mrow' }, ...r.colors.map(c => el('i', { class: 'c' + c }))))) : null,
      p.found ? el('small', {}, '✅ trouvé !') : p.done ? el('small', {}, '❌ plus d\'essais') : null))
      : [el('div', { class: 'pa-empty' }, 'Personne ne joue encore… ✨')]));
    // Les boutons
    const ctrl = [];
    if (d.phase === 'lobby') {
      if (joined) ctrl.push(el('button', { class: 'btn btn-primary', onclick: () => this.emit('md_start') }, '✨ Lancer la partie'), el('button', { class: 'btn btn-sm', onclick: () => this.emit('md_leave') }, 'Quitter'));
      else ctrl.push(el('button', { class: 'btn btn-primary', onclick: () => this.emit('md_join') }, '✨ Je joue'));
    } else if (d.phase === 'end') {
      ctrl.push(el('div', { class: 'pa-win' }, d.winner ? `👑 ${d.winner.username} gagne avec ${d.winner.score} points !` : '🤝 Égalité !'),
        el('button', { class: 'btn btn-primary', onclick: () => this.emit(joined ? 'md_new' : 'md_join') }, joined ? '🔁 Nouvelle partie' : '✨ Je joue'));
    } else if (!joined) {
      if (d.players.length < d.maxPlayers) ctrl.push(el('button', { class: 'btn btn-sm btn-primary', onclick: () => this.emit('md_join') }, '✨ Je joue aussi'));
      ctrl.push(el('span', { class: 'pa-wait' }, '👀 Tu regardes la partie'));
    } else if (d.phase === 'reveal') ctrl.push(el('span', { class: 'pa-wait' }, 'Mot suivant dans un instant…'));
    else if (mine.done) ctrl.push(el('span', { class: 'pa-wait' }, mine.found ? '✅ Bravo ! Attends que les autres finissent…' : '😅 Plus d\'essais… attends le mot suivant'));
    box.querySelector('.md-ctrl').replaceChildren(...ctrl);
  },
  drawGrid() {
    const box = $('mdStage'), d = this.data;
    if (!box || !d) return;
    const grid = box.querySelector('.md-grid'), keys = box.querySelector('.md-keys');
    const me = d.players.find(p => p.id === state.me.id);
    if (d.phase === 'lobby' || !d.length) {
      grid.replaceChildren(el('div', { class: 'pa-lobby' }, el('b', {}, '🏅 Les champions du Mot d\'Or'),
        d.leaderboard.length ? el('ol', {}, ...d.leaderboard.map(r => el('li', {}, el('span', { style: 'color:' + (r.color || 'inherit') }, r.username), ` · ${r.wins} victoire${r.wins > 1 ? 's' : ''} · ${r.points} pts`))) : el('small', {}, 'Personne n\'a encore gagné : à toi !')));
      keys.replaceChildren(); return;
    }
    if (d.phase === 'end') { grid.replaceChildren(el('div', { class: 'pa-big' }, d.winner ? `👑 ${d.winner.username}` : '🤝 Égalité !')); keys.replaceChildren(); return; }
    const rows = me ? me.rows : [];
    const lines = [];
    for (let i = 0; i < d.tries; i++) {
      const r = rows[i];
      let cells;
      if (r) cells = [...r.letters].map((ch, j) => el('span', { class: 'md-cell c' + r.colors[j], style: `animation-delay:${j * .08}s` }, ch));
      else if (i === rows.length && d.phase === 'play' && me && !me.done) cells = Array.from({ length: d.length }, (_, j) => el('span', { class: 'md-cell md-typing' + (j === this.typed.length ? ' md-cursor' : '') }, this.typed[j] || (j === 0 ? d.first : '.')));
      else cells = Array.from({ length: d.length }, (_, j) => el('span', { class: 'md-cell md-blank' }, i === rows.length && j === 0 && d.phase === 'play' ? d.first : ''));
      lines.push(el('div', { class: 'md-row' }, ...cells));
    }
    if (d.phase === 'reveal') lines.push(el('div', { class: 'md-answer' }, 'Le mot était : ', el('span', { class: 'pa-gold' }, d.word)));
    grid.replaceChildren(...lines);
    // Clavier à l'écran, avec la couleur des lettres déjà essayées
    const best = {};
    for (const r of rows) [...r.letters].forEach((ch, j) => { best[ch] = Math.max(best[ch] ?? -1, r.colors[j]); });
    const kb = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'];
    keys.replaceChildren(...(me && d.phase === 'play' && !me.done ? kb.map((row, i) => el('div', { class: 'md-krow' },
      i === 2 ? el('button', { class: 'md-key wide', onclick: () => this.key('DEL') }, '⌫') : null,
      ...[...row].map(ch => el('button', { class: 'md-key' + (best[ch] !== undefined ? ' c' + best[ch] : ''), onclick: () => this.key(ch) }, ch)),
      i === 2 ? el('button', { class: 'md-key wide ok', onclick: () => this.key('ENTER') }, '✔') : null)) : []));
  },
  updateTimer() {
    const t = $('mdStage')?.querySelector('.md-timer');
    if (!t || !this.data) return;
    const left = this.data.deadline ? Math.max(0, Math.ceil((this.data.deadline - this.offset - Date.now()) / 1000)) : 0;
    t.textContent = left ? `⏱ ${left} s` : ''; t.classList.toggle('low', left > 0 && left <= 15);
  },
};

socket.on('motdor', d => MotDor.update(d));
document.addEventListener('viewchange', () => MotDor.onView());
// Taper au clavier de l'ordinateur (sauf quand on écrit dans le chat)
document.addEventListener('keydown', e => {
  if (!MotDor.active() || !MotDor.canType()) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  const k = e.key === 'Enter' ? 'ENTER' : e.key === 'Backspace' ? 'DEL' : (e.key || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  if (k === 'ENTER' || k === 'DEL' || /^[A-Z]$/.test(k)) { e.preventDefault(); MotDor.key(k); }
});
