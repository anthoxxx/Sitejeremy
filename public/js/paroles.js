// The Paradise — « Les Paroles d'Or » : la scène dorée, les paroles en karaoké et la musique (jouée par le navigateur)
const Paroles = {
  SLUG: 'paroles', data: null, offset: 0, welcomed: false, raf: null, ctx: null, master: null, nodes: [], scheduledFor: '', muted: false, mini: false, sent: '',

  active() { return state.view?.type === 'room' && state.view.slug === this.SLUG; },
  onView() {
    const box = $('paStage');
    if (!this.active()) { box.classList.add('hidden'); box.replaceChildren(); this.stopMusic(); cancelAnimationFrame(this.raf); this.raf = null; return; }
    box.classList.remove('hidden');
    socket.emit('pa_state', d => this.update(d));
    if (!this.raf) this.loop();
    if (!this.welcomed) {
      this.welcomed = true;
      addBotMessage({ username: 'Maestro Paradise', botIcon: '🎩', color: '#ffc94d', content: `Bonsoir ${state.me.username} ! 🎤 Bienvenue aux Paroles d'Or. Monte sur scène avec « 🎤 Je chante », lancez la partie, et chantez avec les paroles qui défilent. Au dernier refrain, la musique s'arrête : à toi d'écrire la suite ! Tape !aide pour les règles.`, createdAt: Date.now() }, true);
    }
  },
  now() { return Date.now() + this.offset; },
  update(d) {
    if (!d) return;
    const prev = this.data;
    this.offset = d.now - Date.now();
    this.data = d;
    if (d.phase !== 'answer') this.sent = '';
    if (prev?.phase === 'playing' && d.phase === 'answer') this.sfx('stop');
    if (prev?.phase === 'answer' && d.phase === 'reveal') this.sfx(d.results?.some(r => r.id === state.me.id && r.perfect) ? 'win' : 'reveal');
    if (this.active()) { this.render(); this.syncMusic(); }
  },
  emit(ev, arg, cb) { socket.emit(ev, arg, r => { if (r?.error) toast(r.error); cb && cb(r); }); },

  // ---------- La musique, fabriquée par le navigateur ----------
  audio() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : .8; this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },
  hz: m => 440 * Math.pow(2, (m - 69) / 12),
  tone(when, freq, dur, type, vol, attack = .01) {
    const ctx = this.ctx, o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, when);
    gn.gain.setValueAtTime(0, when); gn.gain.linearRampToValueAtTime(vol, when + attack);
    gn.gain.setValueAtTime(vol, Math.max(when + attack, when + dur * .7)); gn.gain.exponentialRampToValueAtTime(.0001, when + dur);
    o.connect(gn).connect(this.master); o.start(when); o.stop(when + dur + .05);
    this.nodes.push(o);
  },
  noise(when, dur, vol, hp) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    src.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; gn.gain.value = vol;
    src.connect(f).connect(gn).connect(this.master); src.start(when); this.nodes.push(src);
  },
  kick(when) {
    const ctx = this.ctx, o = ctx.createOscillator(), gn = ctx.createGain();
    o.frequency.setValueAtTime(140, when); o.frequency.exponentialRampToValueAtTime(45, when + .15);
    gn.gain.setValueAtTime(.55, when); gn.gain.exponentialRampToValueAtTime(.001, when + .25);
    o.connect(gn).connect(this.master); o.start(when); o.stop(when + .3); this.nodes.push(o);
  },
  stopMusic() {
    for (const n of this.nodes) { try { n.stop(); } catch (e) {} }
    this.nodes = []; this.scheduledFor = '';
  },
  // Programme toute la chanson jusqu'au moment où elle s'arrête (en tenant compte de l'endroit où on en est)
  syncMusic() {
    const d = this.data;
    if (!d || d.phase !== 'playing' || !d.song || this.muted) { if (d?.phase !== 'playing') this.stopMusic(); return; }
    const key = d.song.id + '|' + d.startAt;
    if (this.scheduledFor === key) return;
    let ctx;
    try { ctx = this.audio(); } catch (e) { return; }
    if (ctx.state !== 'running') { this.render(); return; } // il faut un toucher pour activer le son
    this.stopMusic(); this.scheduledFor = key;
    const s = d.song, beat = 60 / s.bpm, t0 = ctx.currentTime + (d.startAt - this.now()) / 1000;
    const endBeat = s.hiddenLine * s.beatsPerLine;
    const at = b => t0 + b * beat;
    const future = b => at(b) >= ctx.currentTime - .02;
    for (let bar = 0; bar * 4 < endBeat; bar++) {
      const [root, kind] = s.chords[bar % s.chords.length];
      const tones = [0, kind === 'm' ? 3 : 4, 7];
      if (future(bar * 4)) tones.forEach(x => this.tone(at(bar * 4), this.hz(root + x), beat * 4, 'sine', .045, .08));
      for (let b = 0; b < 4; b++) {
        const B = bar * 4 + b;
        if (!future(B)) continue;
        if (b % 2 === 0) { this.kick(at(B)); this.tone(at(B), this.hz(root - 12), beat * .9, 'triangle', .16); }
        else { this.noise(at(B), .12, .18, 1800); this.tone(at(B), this.hz(root - 12 + 7), beat * .8, 'triangle', .1); }
        this.noise(at(B + .5), .04, .07, 7000);
      }
    }
    // la mélodie (la « voix »)
    s.lines.slice(0, s.hiddenLine).forEach((l, i) => {
      let b = i * s.beatsPerLine;
      for (const [m, dur] of l.melody) { if (future(b)) this.tone(at(b), this.hz(m), dur * beat * .95, 'square', .05, .02); b += dur; }
    });
  },
  sfx(kind) {
    if (this.muted) return;
    try {
      this.audio(); const t = this.ctx.currentTime;
      if (kind === 'stop') { const o = this.ctx.createOscillator(), gn = this.ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(60, t + .45); gn.gain.setValueAtTime(.12, t); gn.gain.exponentialRampToValueAtTime(.001, t + .5); o.connect(gn).connect(this.master); o.start(t); o.stop(t + .55); }
      if (kind === 'reveal') [523, 659, 784].forEach((f, i) => this.tone(t + i * .12, f, .3, 'triangle', .1));
      if (kind === 'win') [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(t + i * .12, f, .35, 'triangle', .12));
    } catch (e) {}
  },

  // ---------- Affichage ----------
  render() {
    const box = $('paStage'), d = this.data;
    if (!d) return;
    const me = state.me.id, joined = d.players.some(p => p.id === me);
    if (!box.querySelector('.pa-lyrics')) {
      box.replaceChildren(
        el('div', { class: 'pa-shine' }),
        el('div', { class: 'pa-top' }),
        el('div', { class: 'pa-scene' },
          el('div', { class: 'pa-host' }, typeof BlindTest !== 'undefined' ? BlindTest.hostSvg() : el('div', {}, '🎩'), el('div', { class: 'pa-bubble' })),
          el('div', { class: 'pa-lyrics' })),
        el('div', { class: 'pa-players' }), el('div', { class: 'pa-ctrl' }));
    }
    box.classList.toggle('mini', this.mini);
    const needSound = d.phase === 'playing' && !this.muted && (!this.ctx || this.ctx.state !== 'running');
    box.querySelector('.pa-top').replaceChildren(...[
      el('img', { class: 'pa-logo', src: '/img/logo-mark.webp?v=3', alt: '' }),
      el('b', { class: 'pa-title' }, 'Les Paroles d\'Or'),
      d.song && d.phase !== 'end' ? el('span', { class: 'pa-chip' }, `Chanson ${d.songNo}/${d.total}`) : null,
      el('span', { style: 'flex:1' }),
      el('span', { class: 'pa-timer' }),
      needSound ? el('button', { class: 'btn btn-sm btn-primary', onclick: () => { this.audio(); setTimeout(() => this.syncMusic(), 50); } }, '🔊 Activer le son') : null,
      el('button', { class: 'btn btn-sm', title: this.muted ? 'Remettre le son' : 'Couper le son', onclick: () => { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : .8; if (this.muted) this.stopMusic(); else this.syncMusic(); this.render(); } }, this.muted ? '🔇' : '🔊'),
      el('button', { class: 'btn btn-sm', title: this.mini ? 'Agrandir' : 'Réduire', onclick: () => { this.mini = !this.mini; this.render(); } }, this.mini ? '🎤' : '▁')].filter(Boolean));
    box.querySelector('.pa-bubble').textContent = d.line || '';
    box.querySelector('.pa-host').classList.toggle('talking', !!d.line);
    this.drawLyrics();
    // Les chanteurs
    box.querySelector('.pa-players').replaceChildren(...(d.players.length ? d.players.map(p => {
      const r = d.results?.find(x => x.id === p.id);
      return el('div', { class: 'pa-player' + (p.id === me ? ' me' : '') + (r?.perfect ? ' perfect' : ''), 'data-uid': p.id },
        LC.avatar(p), el('b', { style: 'color:' + (p.color || '#fff') }, p.username), el('span', { class: 'pa-score' }, p.score),
        d.phase === 'answer' ? el('small', {}, p.answered ? '✅ a répondu' : '✍️ écrit…') : null,
        r ? el('small', { class: 'pa-res' }, `${r.perfect ? '✅' : r.good ? '🟡' : '❌'} « ${r.answer || '—'} » +${r.pts}`) : null);
    }) : [el('div', { class: 'pa-empty' }, 'La scène attend ses chanteurs… 🎤')]));
    // Les boutons
    const ctrl = [];
    if (d.phase === 'lobby') {
      if (joined) ctrl.push(el('button', { class: 'btn btn-primary', onclick: () => { this.audio(); this.emit('pa_start'); } }, '🎶 Lancer la partie'), el('button', { class: 'btn btn-sm', onclick: () => this.emit('pa_leave') }, 'Descendre de scène'));
      else ctrl.push(el('button', { class: 'btn btn-primary', onclick: () => { this.audio(); this.emit('pa_join'); } }, '🎤 Je chante'));
    } else if (d.phase === 'answer' && joined) {
      if (this.sent) ctrl.push(el('span', { class: 'pa-wait' }, `✅ Réponse envoyée : « ${this.sent} »`));
      else {
        const inp = el('input', { class: 'input pa-answer', maxlength: 120, placeholder: 'Écris la suite des paroles…', autocomplete: 'off' });
        const go = () => { const v = inp.value.trim(); if (!v) return; this.emit('pa_answer', v, r => { if (r?.ok) { this.sent = v; this.render(); } }); };
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
        ctrl.push(inp, el('button', { class: 'btn btn-primary', onclick: go }, 'Valider'));
        setTimeout(() => inp.focus(), 0);
      }
    } else if (d.phase === 'end') {
      ctrl.push(el('div', { class: 'pa-win' }, d.winner ? `👑 ${d.winner.username} gagne avec ${d.winner.score} points !` : '🤝 Égalité !'),
        el('button', { class: 'btn btn-primary', onclick: () => this.emit(joined ? 'pa_new' : 'pa_join') }, joined ? '🔁 Nouvelle partie' : '🎤 Je chante'));
    } else {
      if (!joined && d.players.length < d.maxPlayers) ctrl.push(el('button', { class: 'btn btn-sm btn-primary', onclick: () => { this.audio(); this.emit('pa_join'); } }, '🎤 Monter sur scène'));
      if (!joined) ctrl.push(el('span', { class: 'pa-wait' }, '👏 Tu es dans le public : chante avec nous !'));
    }
    box.querySelector('.pa-ctrl').replaceChildren(...ctrl);
  },
  // Les paroles en karaoké : la ligne en cours s'allume au fil de la musique
  drawLyrics() {
    const box = $('paStage')?.querySelector('.pa-lyrics'), d = this.data;
    if (!box || !d) return;
    const s = d.song;
    if (!s || d.phase === 'lobby') {
      box.replaceChildren(el('div', { class: 'pa-lobby' }, el('b', {}, '🏅 Les meilleures mémoires'),
        d.leaderboard.length ? el('ol', {}, ...d.leaderboard.map(r => el('li', {}, el('span', { style: 'color:' + (r.color || 'inherit') }, r.username), ` · ${r.wins} victoire${r.wins > 1 ? 's' : ''} · ${r.points} pts`))) : el('small', {}, 'Personne n\'a encore joué : à toi !')));
      box.dataset.k = ''; return;
    }
    if (d.phase === 'end') { box.replaceChildren(el('div', { class: 'pa-big' }, d.winner ? `👑 ${d.winner.username}` : '🤝 Égalité !')); box.dataset.k = ''; return; }
    const lineMs = s.beatsPerLine * 60000 / s.bpm;
    const pos = this.now() - d.startAt;
    const idx = d.phase === 'playing' ? Math.max(-1, Math.min(s.hiddenLine - 1, Math.floor(pos / lineMs))) : s.hiddenLine;
    const k = s.id + '|' + idx + '|' + d.phase;
    const prog = d.phase === 'playing' && idx >= 0 ? Math.min(1, (pos - idx * lineMs) / lineMs) : 1;
    if (box.dataset.k !== k) {
      box.dataset.k = k;
      const hidden = s.lines[s.hiddenLine];
      const hiddenEl = () => d.phase === 'reveal'
        ? el('div', { class: 'pa-line now reveal' }, hidden.before, el('span', { class: 'pa-gold' }, s.answer), hidden.after)
        : el('div', { class: 'pa-line now hole' }, hidden.before, ...hidden.blanks.map(n => el('span', { class: 'pa-blank' }, '_'.repeat(Math.min(n, 12)))), hidden.after);
      const rows = [el('div', { class: 'pa-song' }, `🎵 ${s.title} · ${s.artist}`)];
      if (idx < 0) rows.push(el('div', { class: 'pa-line now count' }, '🎶 La musique commence…'));
      else if (d.phase !== 'playing') {
        if (s.lines[idx - 1]) rows.push(el('div', { class: 'pa-line prev' }, s.lines[idx - 1].text));
        rows.push(hiddenEl());
      } else {
        if (s.lines[idx - 1]) rows.push(el('div', { class: 'pa-line prev' }, s.lines[idx - 1].text));
        rows.push(el('div', { class: 'pa-line now karaoke', 'data-text': s.lines[idx].text }, s.lines[idx].text));
        rows.push(idx + 1 === s.hiddenLine ? el('div', { class: 'pa-line next secret' }, '🤫 …') : el('div', { class: 'pa-line next' }, s.lines[idx + 1]?.text || ''));
      }
      box.replaceChildren(...rows);
    }
    const kar = box.querySelector('.karaoke');
    if (kar) kar.style.setProperty('--p', (prog * 100).toFixed(1) + '%');
  },
  loop() {
    this.raf = requestAnimationFrame(() => this.loop());
    if (!this.data || !this.active()) return;
    this.drawLyrics();
    const t = $('paStage')?.querySelector('.pa-timer');
    if (t) {
      const left = this.data.deadline ? Math.max(0, Math.ceil((this.data.deadline - this.now()) / 1000)) : 0;
      t.textContent = left ? `⏱ ${left} s` : ''; t.classList.toggle('low', left > 0 && left <= 8);
    }
  },
};

socket.on('paroles', d => Paroles.update(d));
document.addEventListener('viewchange', () => Paroles.onView());
// Le moindre toucher active le son (les navigateurs l'exigent)
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => {
  if (Paroles.active() && Paroles.data?.phase === 'playing' && !Paroles.muted && (!Paroles.ctx || Paroles.ctx.state !== 'running')) { Paroles.audio(); setTimeout(() => { Paroles.syncMusic(); Paroles.render(); }, 80); }
}, { passive: true }));
