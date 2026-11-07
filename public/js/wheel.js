// The Paradise — « La Roue du Paradise » : la roue, le tableau de lettres et les boutons du jeu
const Wheel = {
  SLUG: 'roue', data: null, rot: 0, spinId: null, offset: 0, mode: '', mini: false, welcomed: false, tick: null,

  active() { return state.view?.type === 'room' && state.view.slug === this.SLUG; },
  onView() {
    const bar = $('wheelBar');
    if (!this.active()) { bar.classList.add('hidden'); bar.replaceChildren(); this.spinId = null; clearInterval(this.tick); this.tick = null; return; }
    bar.classList.remove('hidden');
    socket.emit('wheel_state', d => this.update(d));
    if (!this.tick) this.tick = setInterval(() => this.updateTimer(), 500);
    if (!this.welcomed) {
      this.welcomed = true;
      addBotMessage({ username: 'Roue Bot', botIcon: '🎡', color: '#ffc94d', content: `Salut ${state.me.username} ! 🎡 Bienvenue à La Roue du Paradise. Clique sur « 🙋 Jouer » pour rejoindre la partie (6 joueurs max). À ton tour : tourne la roue et choisis une consonne, achète une voyelle (200 points) ou propose la réponse. 3 manches, le plus de points gagne ! Tape !aide pour revoir les règles.`, createdAt: Date.now() }, true);
    }
  },
  update(d) {
    if (!d) return;
    const prevPhase = this.data?.phase, prevTurn = this.data?.turnId;
    this.offset = d.now - Date.now();
    this.data = d;
    if (d.phase !== prevPhase || d.turnId !== prevTurn) this.mode = '';
    if (this.active()) this.render();
    if (d.turnId === state.me.id && prevTurn !== d.turnId && d.phase === 'turn') { try { ding(); } catch (e) {} }
  },
  emit(ev, arg) {
    socket.emit(ev, arg, r => { if (r?.error) toast(r.error); });
  },

  // ---------- La roue (dessin SVG) ----------
  colors: ['#ff5fa2', '#ffb547', '#7cc8ff', '#8b6cff', '#33d6a6', '#ff8a1f', '#4fb3ff', '#e5384d'],
  wheelSvg(segments) {
    const ns = 'http://www.w3.org/2000/svg', n = segments.length, R = 100;
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '-105 -105 210 210');
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'wh-rotor');
    segments.forEach((s, i) => {
      const a0 = (i / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`);
      p.setAttribute('fill', s.lose ? '#14101f' : s.pass ? '#f4f4f8' : s.star ? '#ffd76a' : this.colors[i % this.colors.length]);
      p.setAttribute('stroke', 'rgba(255,255,255,.65)'); p.setAttribute('stroke-width', '1');
      g.append(p);
      const t = document.createElementNS(ns, 'text');
      const mid = (i + .5) * 360 / n;
      t.setAttribute('transform', `rotate(${mid}) translate(0 -62) rotate(90)`);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('class', 'wh-label' + (s.lose ? ' lose' : s.pass ? ' pass' : ''));
      t.textContent = s.lose ? '💥' : s.pass ? '⏭️' : s.star ? '⭐' + s.v : s.v;
      g.append(t);
    });
    const hub = document.createElementNS(ns, 'circle');
    hub.setAttribute('r', '16'); hub.setAttribute('class', 'wh-hub');
    svg.append(g, hub);
    return svg;
  },
  // Fait tourner la roue jusqu'à la case tirée par le serveur (la case arrive sous la flèche en haut)
  applySpin(rotor, d) {
    const s = d.spin, n = d.segments.length;
    if (!s) return;
    const center = (s.index + .5) * 360 / n;
    const target = (360 - center) % 360;
    if (this.spinId === s.id) return;
    const late = Date.now() + this.offset - s.at > s.ms - 400;
    this.spinId = s.id;
    const base = this.rot - (this.rot % 360);
    this.rot = base + (late ? 0 : 360 * 5) + target;
    rotor.style.transition = late ? 'none' : `transform ${s.ms / 1000}s cubic-bezier(.12,.75,.14,1)`;
    requestAnimationFrame(() => { rotor.style.transform = `rotate(${this.rot}deg)`; });
  },

  // ---------- Affichage ----------
  render() {
    const bar = $('wheelBar'), d = this.data;
    if (!d) return;
    const me = state.me.id, joined = d.players.some(p => p.id === me), myTurn = d.turnId === me;
    const turnP = d.players.find(p => p.id === d.turnId);
    if (!bar.querySelector('.wh-wheel')) {
      bar.replaceChildren(
        el('div', { class: 'wh-head' }), el('div', { class: 'wh-board' }),
        el('div', { class: 'wh-mid' }, el('div', { class: 'wh-wheel' }, el('div', { class: 'wh-arrow' }), this.wheelSvg(d.segments)), el('div', { class: 'wh-players' })),
        el('div', { class: 'wh-event' }), el('div', { class: 'wh-ctrl' }));
      const rotor = bar.querySelector('.wh-rotor');
      rotor.style.transform = `rotate(${this.rot}deg)`;
    }
    bar.classList.toggle('mini', this.mini);
    // En-tête : manche, thème, minuteur
    bar.querySelector('.wh-head').replaceChildren(
      el('b', { class: 'wh-title' }, '🎡 La Roue du Paradise'),
      d.round ? el('span', { class: 'wh-round' }, `Manche ${d.round}/${d.rounds}`) : null,
      d.theme ? el('span', { class: 'wh-theme' }, d.theme) : null,
      el('span', { style: 'flex:1' }),
      el('span', { class: 'wh-timer' }),
      el('button', { class: 'btn btn-sm', title: this.mini ? 'Afficher la roue' : 'Réduire', onclick: () => { this.mini = !this.mini; this.render(); } }, this.mini ? '🎡' : '▁'));
    // Tableau de lettres
    const boardEl = bar.querySelector('.wh-board');
    if (d.board.length) {
      boardEl.classList.remove('empty');
      boardEl.replaceChildren(...d.board.map(w => el('div', { class: 'wh-word' }, ...w.map(c => el('span', { class: 'wh-tile' + (c === '_' ? ' hidden-l' : /[A-Z]/.test(c) ? ' shown' : ' punct') }, c === '_' ? '' : c)))));
    } else {
      boardEl.classList.add('empty');
      boardEl.replaceChildren(el('div', { class: 'wh-lobby' }, d.players.length ? `${d.players.length} joueur${d.players.length > 1 ? 's' : ''} prêt${d.players.length > 1 ? 's' : ''} · lancez la partie !` : 'Rejoins la partie pour jouer 🎡'));
    }
    // La roue
    const rotor = bar.querySelector('.wh-rotor');
    if (d.spin) this.applySpin(rotor, d);
    bar.querySelector('.wh-wheel').classList.toggle('spinning', d.phase === 'spinning');
    // Les joueurs
    bar.querySelector('.wh-players').replaceChildren(...(d.players.length ? d.players.map(p => el('div', { class: 'wh-player' + (p.id === d.turnId && d.phase !== 'lobby' ? ' turn' : '') + (p.id === me ? ' me' : ''), 'data-uid': p.id },
      LC.avatar(p), el('div', { class: 'wh-pmeta' }, el('b', { style: 'color:' + (p.color || 'inherit') }, p.username),
        el('small', {}, d.phase === 'lobby' ? 'prêt' : `manche ${p.score} · total ${p.total}`))))
      : [el('div', { class: 'wh-noplayer' }, 'Aucun joueur pour l\'instant')]));
    // Ce qui vient de se passer
    bar.querySelector('.wh-event').textContent = ['roundEnd', 'gameEnd'].includes(d.phase) ? '' : d.event || '';
    // Les boutons
    const ctrl = [];
    const solveBtn = () => el('button', { class: 'btn btn-sm', onclick: () => { this.mode = 'solve'; this.render(); } }, '💡 Proposer la réponse');
    if (d.phase === 'lobby') {
      ctrl.push(joined
        ? el('button', { class: 'btn btn-primary', onclick: () => this.emit('wheel_start') }, '🚀 Lancer la partie')
        : el('button', { class: 'btn btn-primary', onclick: () => this.emit('wheel_join') }, '🙋 Jouer'));
      if (joined) ctrl.push(el('button', { class: 'btn btn-sm', onclick: () => this.emit('wheel_leave') }, 'Quitter la partie'));
    } else if (d.phase === 'gameEnd') {
      ctrl.push(el('div', { class: 'wh-win' }, d.winner ? `👑 ${d.winner.username} gagne avec ${d.winner.total} points !` : 'Partie terminée'));
      ctrl.push(el('button', { class: 'btn btn-primary', onclick: () => this.emit(joined ? 'wheel_new' : 'wheel_join') }, joined ? '🔁 Nouvelle partie' : '🙋 Jouer'));
    } else if (d.phase === 'roundEnd') {
      ctrl.push(el('div', { class: 'wh-win' }, d.winner ? `🏆 ${d.winner.username} remporte la manche (+${d.winner.gain})` : 'Manche terminée'), el('small', { class: 'help' }, 'La suite arrive…'));
    } else if (myTurn && this.mode === 'solve') {
      const inp = el('input', { class: 'input wh-solve', maxlength: 80, placeholder: 'Ta réponse…', autocomplete: 'off' });
      const go = () => { if (!inp.value.trim()) return; socket.emit('wheel_solve', inp.value, r => { if (r?.error) toast(r.error); }); this.mode = ''; };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } if (e.key === 'Escape') { this.mode = ''; this.render(); } });
      ctrl.push(inp, el('button', { class: 'btn btn-primary btn-sm', onclick: go }, 'Valider'), el('button', { class: 'btn btn-sm', onclick: () => { this.mode = ''; this.render(); } }, 'Annuler'));
      setTimeout(() => inp.focus(), 0);
    } else if (myTurn && d.phase === 'turn' && this.mode === 'vowel') {
      ctrl.push(el('span', { class: 'wh-hint' }, `Voyelle (−${d.vowelCost}) :`), ...['A', 'E', 'I', 'O', 'U', 'Y'].map(v => el('button', { class: 'wh-key vowel', disabled: d.used.includes(v), onclick: () => this.emit('wheel_vowel', v) }, v)),
        el('button', { class: 'btn btn-sm', onclick: () => { this.mode = ''; this.render(); } }, 'Annuler'));
    } else if (myTurn && d.phase === 'turn') {
      const mine = d.players.find(p => p.id === me);
      ctrl.push(
        el('button', { class: 'btn btn-primary', disabled: !d.consonantsLeft, title: d.consonantsLeft ? '' : 'Plus de consonnes à trouver', onclick: () => this.emit('wheel_spin') }, '🎡 Tourner la roue'),
        el('button', { class: 'btn btn-sm', disabled: !d.vowelsLeft || (mine?.score || 0) < d.vowelCost, title: `Coûte ${d.vowelCost} points de la manche`, onclick: () => { this.mode = 'vowel'; this.render(); } }, `🔤 Acheter une voyelle (${d.vowelCost})`),
        solveBtn());
    } else if (myTurn && d.phase === 'letter') {
      ctrl.push(el('span', { class: 'wh-hint' }, 'Choisis une consonne :'),
        el('div', { class: 'wh-keys' }, ...'BCDFGHJKLMNPQRSTVWXZ'.split('').map(c => el('button', { class: 'wh-key', disabled: d.used.includes(c), onclick: () => this.emit('wheel_letter', c) }, c))),
        solveBtn());
    } else {
      ctrl.push(el('span', { class: 'wh-wait' }, d.phase === 'spinning' ? `🎡 ${turnP?.username || ''} tourne la roue…` : `⏳ À ${turnP?.username || '…'} de jouer`));
      if (!joined && d.players.length < d.maxPlayers) ctrl.push(el('button', { class: 'btn btn-sm btn-primary', onclick: () => this.emit('wheel_join') }, '🙋 Rejoindre'));
      if (joined) ctrl.push(el('button', { class: 'btn btn-sm', onclick: () => { if (confirm('Quitter la partie ?')) this.emit('wheel_leave'); } }, 'Quitter'));
    }
    // Lettres déjà proposées
    if (d.used.length && ['turn', 'letter', 'spinning'].includes(d.phase)) ctrl.push(el('div', { class: 'wh-used' }, 'Déjà dit : ', el('b', {}, d.used.join(' '))));
    bar.querySelector('.wh-ctrl').replaceChildren(...ctrl);
    this.updateTimer();
  },
  updateTimer() {
    const t = $('wheelBar')?.querySelector('.wh-timer');
    if (!t || !this.data) return;
    const left = this.data.deadline ? Math.max(0, Math.ceil((this.data.deadline - (Date.now() + this.offset)) / 1000)) : 0;
    t.textContent = left ? `⏱ ${left} s` : '';
    t.classList.toggle('low', left > 0 && left <= 10);
  },
};

socket.on('wheel', d => Wheel.update(d));
document.addEventListener('viewchange', () => Wheel.onView());
