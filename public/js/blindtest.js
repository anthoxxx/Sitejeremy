// The Paradise — « Le Grand Blind Test du Paradise » : le plateau, l'écran géant, le présentateur et le buzzer
const BlindTest = {
  SLUG: 'blindtest', data: null, offset: 0, welcomed: false, tick: null, muted: false, mini: false, videoKey: '', lastPhase: '', lastBuzz: null, ctx: null,

  active() { return state.view?.type === 'room' && state.view.slug === this.SLUG; },
  onView() {
    const box = $('btStage');
    if (!this.active()) { box.classList.add('hidden'); box.replaceChildren(); this.videoKey = ''; clearInterval(this.tick); this.tick = null; return; }
    box.classList.remove('hidden');
    socket.emit('bt_state', d => this.update(d));
    if (!this.tick) this.tick = setInterval(() => this.updateTimers(), 250);
    if (!this.welcomed) {
      this.welcomed = true;
      addBotMessage({ username: 'Maestro Paradise', botIcon: '🎩', color: '#ff5fa2', content: `Bonsoir ${state.me.username} ! 🎩 Bienvenue sur le plateau du Grand Blind Test du Paradise. Monte sur scène avec « 🙋 Je joue », lancez l'émission, et quand la musique démarre, appuie sur le BUZZ 🔴 (ou la barre espace) pour donner le titre ou l'artiste. Tape !aide pour les règles.`, createdAt: Date.now() }, true);
    }
  },
  update(d) {
    if (!d) return;
    const prev = this.data;
    this.offset = d.now - Date.now();
    this.data = d;
    // Petits sons du plateau
    if (prev && d.buzz && (!prev.buzz || prev.buzz.id !== d.buzz.id)) this.sfx('buzz');
    if (prev && d.found && (!prev.found || prev.phase !== 'reveal') && d.phase === 'reveal') this.sfx('good');
    if (prev && prev.phase === 'buzzed' && d.phase === 'playing') this.sfx('bad');
    if (prev && d.phase === 'end' && prev.phase !== 'end' && d.winner) this.sfx('win');
    if (this.active()) this.render();
  },
  emit(ev, arg, cb) { socket.emit(ev, arg, r => { if (r?.error) toast(r.error); cb && cb(r); }); },

  // ---------- Sons (fabriqués par le navigateur) ----------
  sfx(kind) {
    if (this.muted) return;
    try {
      const ctx = this.ctx || (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const t = ctx.currentTime;
      const tone = (f, start, dur, type = 'square', vol = .08) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t + start);
        g.gain.setValueAtTime(vol, t + start); g.gain.exponentialRampToValueAtTime(.0001, t + start + dur);
        o.connect(g).connect(ctx.destination); o.start(t + start); o.stop(t + start + dur + .02);
      };
      if (kind === 'buzz') { tone(180, 0, .35, 'sawtooth', .12); tone(120, 0, .35, 'square', .06); }
      if (kind === 'good') [523, 659, 784, 1046].forEach((f, i) => tone(f, i * .09, .25, 'triangle', .1));
      if (kind === 'bad') { tone(220, 0, .2, 'square', .07); tone(160, .18, .35, 'square', .07); }
      if (kind === 'win') [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, i * .13, .3, 'triangle', .1));
    } catch (e) {}
  },

  // ---------- Le présentateur (personnage original du site) ----------
  hostSvg() {
    const box = el('div', { class: 'bt-host-figure' });
    box.innerHTML = `<svg viewBox="0 0 120 140" aria-hidden="true">
      <defs><linearGradient id="btSuit" x1="0" x2="1"><stop offset="0" stop-color="#8b6cff"/><stop offset="1" stop-color="#ff5fa2"/></linearGradient></defs>
      <path d="M18 140 Q20 98 60 92 Q100 98 102 140 Z" fill="url(#btSuit)"/>
      <path d="M50 96 L60 110 L70 96 Z" fill="#fff"/><path d="M52 104 L60 108 L52 112 Z M68 104 L60 108 L68 112 Z" fill="#ffd76a"/>
      <circle cx="60" cy="62" r="30" fill="#ffd2a8"/>
      <rect x="34" y="54" width="22" height="12" rx="6" fill="#14101f"/><rect x="64" y="54" width="22" height="12" rx="6" fill="#14101f"/>
      <rect x="55" y="57" width="10" height="3" fill="#14101f"/><path d="M38 57 h8" stroke="#7cc8ff" stroke-width="2" stroke-linecap="round"/><path d="M68 57 h8" stroke="#7cc8ff" stroke-width="2" stroke-linecap="round"/>
      <path class="bt-mouth" d="M48 76 Q60 88 72 76" fill="#7a2840"/>
      <rect x="30" y="34" width="60" height="7" rx="3" fill="#14101f"/><rect x="40" y="6" width="40" height="30" rx="4" fill="#14101f"/><rect x="40" y="26" width="40" height="5" fill="#ff5fa2"/>
      <g class="bt-mic"><rect x="92" y="78" width="6" height="34" rx="3" fill="#555" transform="rotate(-20 95 95)"/><circle cx="102" cy="74" r="9" fill="#cfcfe0"/><circle cx="102" cy="74" r="9" fill="none" stroke="#888" stroke-dasharray="2 2"/></g>
    </svg>`;
    return box;
  },

  // ---------- Le son de l'extrait (vidéo YouTube cachée : on ne voit pas le titre) ----------
  syncAudio(box, d) {
    const holder = box.querySelector('.bt-audio');
    const m = d.media;
    if (!m || this.muted) { if (this.videoKey) { holder.replaceChildren(); this.videoKey = ''; } return; }
    const key = m.videoId;
    const send = func => holder.querySelector('iframe')?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
    if (this.videoKey !== key) {
      this.videoKey = key;
      const start = m.start + Math.floor((m.pos + (m.paused ? 0 : Math.max(0, Date.now() + this.offset - d.now))) / 1000);
      holder.replaceChildren(el('iframe', { src: `https://www.youtube-nocookie.com/embed/${m.videoId}?autoplay=1&playsinline=1&controls=0&disablekb=1&rel=0&enablejsapi=1&start=${start}`, allow: 'autoplay; encrypted-media', title: 'Extrait du blind test', tabindex: '-1' }));
      if (m.paused) setTimeout(() => send('pauseVideo'), 1500);
      return;
    }
    send(m.paused ? 'pauseVideo' : 'playVideo');
  },

  // ---------- Affichage ----------
  render() {
    const box = $('btStage'), d = this.data;
    if (!d) return;
    const me = state.me.id, mine = d.players.find(p => p.id === me), joined = !!mine;
    if (!box.querySelector('.bt-screen')) {
      box.replaceChildren(
        el('div', { class: 'bt-lights' }, el('i'), el('i'), el('i'), el('i')),
        el('div', { class: 'bt-top' }), el('div', { class: 'bt-scene' }, el('div', { class: 'bt-host' }, this.hostSvg(), el('div', { class: 'bt-bubble' })), el('div', { class: 'bt-screen' })),
        el('div', { class: 'bt-podiums' }), el('div', { class: 'bt-ctrl' }), el('div', { class: 'bt-audio' }));
    }
    box.classList.toggle('mini', this.mini);
    box.classList.toggle('live', ['playing', 'buzzed'].includes(d.phase));
    box.querySelector('.bt-top').replaceChildren(...[
      el('b', { class: 'bt-title' }, '🎩 Le Grand Blind Test du Paradise'),
      d.songNo && !['lobby', 'end'].includes(d.phase) ? el('span', { class: 'bt-chip' }, `${d.final ? '🏆 Finale · ' : ''}Chanson ${d.songNo}/${d.total}`) : null,
      d.theme ? el('span', { class: 'bt-chip gold' }, d.theme) : null,
      el('span', { style: 'flex:1' }),
      el('button', { class: 'btn btn-sm', title: this.muted ? 'Remettre le son' : 'Couper le son', onclick: () => { this.muted = !this.muted; this.render(); } }, this.muted ? '🔇' : '🔊'),
      el('button', { class: 'btn btn-sm', title: this.mini ? 'Agrandir le plateau' : 'Réduire le plateau', onclick: () => { this.mini = !this.mini; this.render(); } }, this.mini ? '🎩' : '▁')].filter(Boolean));
    box.querySelector('.bt-bubble').textContent = d.line || '';
    box.querySelector('.bt-host').classList.toggle('talking', !!d.line);
    // L'écran géant
    let screen;
    if (d.phase === 'playing' || d.phase === 'buzzed' || d.phase === 'loading') {
      screen = [el('div', { class: 'bt-eq' + (d.phase === 'playing' ? ' on' : '') }, ...Array.from({ length: 14 }, (_, i) => el('i', { style: `animation-delay:${(i * 0.09) % 0.7}s` }))),
        d.phase === 'loading' ? el('div', { class: 'bt-big' }, '🎚️ La régie prépare l\'extrait…')
        : d.phase === 'buzzed' ? el('div', { class: 'bt-big buzz' }, `🔴 ${d.buzz?.username} a buzzé !`, el('span', { class: 'bt-count', 'data-deadline': d.buzz?.deadline }))
        : el('div', { class: 'bt-big' }, '🎵 Qui reconnaît cette chanson ?', el('span', { class: 'bt-count', 'data-listen': Date.now() + d.listenLeft }))];
    } else if (d.phase === 'reveal' && d.answer) {
      screen = [el('img', { class: 'bt-cover', src: `https://i.ytimg.com/vi/${d.answer.videoId}/mqdefault.jpg`, alt: '', referrerpolicy: 'no-referrer' }),
        el('div', { class: 'bt-reveal' }, el('small', {}, d.found ? `✅ Trouvé par ${d.found.username} (+${d.found.pts})` : '⏱️ Personne n\'a trouvé'), el('b', {}, d.answer.title), el('span', {}, d.answer.artist))];
    } else if (d.phase === 'bet') {
      screen = [el('div', { class: 'bt-big' }, '🏆 GRANDE FINALE', el('small', {}, 'Le public parie sur son favori ⭐'), el('span', { class: 'bt-count', 'data-deadline': d.betDeadline }))];
    } else if (d.phase === 'end') {
      screen = [el('div', { class: 'bt-big win' }, d.winner ? `👑 ${d.winner.username}` : '🤝 Égalité !', el('small', {}, d.winner ? `remporte l'émission avec ${d.winner.score} points !` : 'Merci à nos candidats'))];
    } else if (d.phase === 'intro') {
      screen = [el('div', { class: 'bt-big' }, '🎬 L\'émission commence…')];
    } else {
      screen = [el('div', { class: 'bt-lobby' }, el('b', {}, '🏅 Les champions du Blind Test'),
        d.leaderboard.length ? el('ol', {}, ...d.leaderboard.map(r => el('li', {}, el('span', { style: 'color:' + (r.color || 'inherit') }, r.username), ` · ${r.wins} victoire${r.wins > 1 ? 's' : ''} · ${r.points} pts${r.stars ? ' · ' + r.stars + '⭐' : ''}`)))
        : el('small', {}, 'Personne n\'a encore gagné : à toi de jouer !'))];
    }
    box.querySelector('.bt-screen').replaceChildren(...screen);
    // Les pupitres des candidats
    box.querySelector('.bt-podiums').replaceChildren(...(d.players.length ? d.players.map(p => el('div', {
      class: 'bt-podium' + (d.buzz?.id === p.id ? ' buzzing' : '') + (d.locked.includes(p.id) ? ' locked' : '') + (d.finalists.includes(p.id) && (d.final || d.phase === 'bet') ? ' finalist' : '') + (d.final && !d.finalists.includes(p.id) ? ' out' : '') + (p.id === me ? ' me' : ''), 'data-uid': p.id },
      el('span', { class: 'bt-lamp' }), LC.avatar(p), el('b', { style: 'color:' + (p.color || 'inherit') }, p.username), el('span', { class: 'bt-score' }, p.score),
      d.phase === 'bet' && d.bets[p.id] ? el('small', { class: 'bt-bets' }, `⭐ ${d.bets[p.id]}`) : null))
      : [el('div', { class: 'bt-empty' }, 'Le plateau attend ses candidats… 🎤')]));
    // Les boutons
    const ctrl = [];
    const canBuzz = joined && !d.locked.includes(me) && (!d.final || d.finalists.includes(me));
    if (d.phase === 'lobby') {
      if (joined) {
        const sel = el('select', { class: 'input bt-theme' }, el('option', { value: '' }, '🎶 Tous les styles'), ...d.themes.map(t => el('option', { value: t }, t)));
        ctrl.push(sel, el('button', { class: 'btn btn-primary', onclick: () => this.emit('bt_start', sel.value) }, '🎬 Lancer l\'émission'), el('button', { class: 'btn btn-sm', onclick: () => this.emit('bt_leave') }, 'Descendre du plateau'));
      } else ctrl.push(el('button', { class: 'btn btn-primary', onclick: () => this.emit('bt_join') }, '🙋 Je joue'));
    } else if (d.phase === 'playing' && canBuzz) {
      ctrl.push(el('button', { class: 'bt-buzzer', onclick: () => this.buzz() }, 'BUZZ'), el('small', { class: 'help' }, 'ou la barre espace'));
    } else if (d.phase === 'buzzed' && d.buzz?.id === me) {
      const inp = el('input', { class: 'input bt-answer', maxlength: 100, placeholder: 'Le titre et/ou l\'artiste…', autocomplete: 'off' });
      const go = () => { if (inp.value.trim()) this.emit('bt_answer', inp.value); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      ctrl.push(inp, el('button', { class: 'btn btn-primary', onclick: go }, 'Valider'));
      setTimeout(() => inp.focus(), 0);
    } else if (d.phase === 'bet' && !d.finalists.includes(me)) {
      d.finalists.forEach(id => { const p = d.players.find(x => x.id === id); if (p) ctrl.push(el('button', { class: 'btn btn-primary', onclick: () => this.emit('bt_bet', id, () => toast(`⭐ Tu paries sur ${p.username}`)) }, `⭐ Je parie sur ${p.username}`)); });
    } else if (d.phase === 'end') {
      ctrl.push(el('button', { class: 'btn btn-primary', onclick: () => this.emit(joined ? 'bt_new' : 'bt_join') }, joined ? '🔁 Nouvelle émission' : '🙋 Je joue'));
    } else {
      if (!joined && !d.final && d.players.length < d.maxPlayers && d.phase !== 'end') ctrl.push(el('button', { class: 'btn btn-sm btn-primary', onclick: () => this.emit('bt_join') }, '🙋 Monter sur le plateau'));
      if (joined && d.locked.includes(me) && d.phase === 'playing') ctrl.push(el('span', { class: 'bt-wait' }, '🔒 Tu as déjà tenté ta chance sur cette chanson'));
      if (!joined) ctrl.push(el('span', { class: 'bt-wait' }, '👏 Tu es dans le public'));
    }
    box.querySelector('.bt-ctrl').replaceChildren(...ctrl);
    this.syncAudio(box, d);
    this.updateTimers();
  },
  buzz() {
    if (this.data?.phase !== 'playing') return;
    this.emit('bt_buzz');
  },
  updateTimers() {
    const box = $('btStage');
    if (!box || !this.data) return;
    box.querySelectorAll('.bt-count').forEach(e => {
      const end = e.dataset.deadline ? +e.dataset.deadline - this.offset : +e.dataset.listen;
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      e.textContent = left ? `${left} s` : '';
      e.classList.toggle('low', left <= 5);
    });
  },
};

socket.on('blindtest', d => BlindTest.update(d));
document.addEventListener('viewchange', () => BlindTest.onView());
// Barre espace = BUZZ (sauf quand on écrit)
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' || !BlindTest.active() || BlindTest.data?.phase !== 'playing') return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  e.preventDefault();
  BlindTest.buzz();
});
