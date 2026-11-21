// The Paradise — « Le Sommet du Paradise » : la scène, la question, les réponses, l'ascension et les aides
const Sommet = {
  // 📞 Choisir l'ami à appeler (un membre connecté)
  callFriend() {
    const list = (state.online || []).filter(u => u.id !== state.me.id && !u.isGuest);
    if (!list.length) return toast('Personne d\'autre n\'est connecté pour le moment 😕');
    const close = modal(el('div', {}, el('h3', {}, '📞 Qui veux-tu appeler ?'), el('p', { class: 'help' }, 'Ton ami reçoit la question sur son écran et a 20 secondes pour te répondre.'),
      el('div', { class: 'so-call-list' }, ...list.slice(0, 40).map(u => el('button', { class: 'list-item', onclick: () => { close(); this.emit('so_joker', 'friend', u.id); } }, LC.avatar(u), el('b', {}, u.username), u.room === 'sommet' ? el('small', {}, ' (dans le salon)') : null)))));
  },
  SLUG: 'sommet', data: null, offset: 0, welcomed: false, tick: null, mini: false, ctx: null,

  active() { return state.view?.type === 'room' && state.view.slug === this.SLUG; },
  onView() {
    const box = $('soStage');
    if (!this.active()) { box.classList.add('hidden'); box.replaceChildren(); clearInterval(this.tick); this.tick = null; return; }
    box.classList.remove('hidden');
    socket.emit('so_state', d => this.update(d));
    if (!this.tick) this.tick = setInterval(() => this.updateTimer(), 250);
    if (!this.welcomed) {
      this.welcomed = true;
      addBotMessage({ username: 'Soldat76-Maestro', botIcon: '🎩', color: '#ff5fa2', content: `Bonsoir ${state.me.username} ! 🎩 Bienvenue au Sommet du Paradise. Inscris-toi avec « 🏔️ Je tente l'ascension » : 12 questions de plus en plus dures jusqu'à 500 pièces 💰 (des vraies !) Les spectateurs peuvent aider le candidat quand il demande le 🗳️ Vote du salon. Tape !aide pour les règles.`, createdAt: Date.now() }, true);
    }
  },
  update(d) {
    if (!d) return;
    const prev = this.data;
    this.offset = d.now - Date.now();
    this.data = d;
    if (prev && d.phase === 'result' && prev.phase !== 'result') this.sfx(d.result === 'good' ? 'good' : 'bad');
    if (prev && d.phase === 'suspense' && prev.phase !== 'suspense') this.sfx('drum');
    if (prev && d.phase === 'over' && prev.phase !== 'over' && d.won === d.ladder[d.ladder.length - 1]) this.sfx('top');
    if (this.active()) this.render();
  },
  emit(ev, ...args) { socket.emit(ev, ...args, r => { if (r?.error) toast(r.error); }); },
  fmt: n => Number(n || 0).toLocaleString('fr-FR'),

  sfx(kind) {
    try {
      const ctx = this.ctx || (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const t = ctx.currentTime;
      const tone = (f, s, dur, type = 'triangle', vol = .09) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t + s);
        g.gain.setValueAtTime(vol, t + s); g.gain.exponentialRampToValueAtTime(.0001, t + s + dur);
        o.connect(g).connect(ctx.destination); o.start(t + s); o.stop(t + s + dur + .02);
      };
      if (kind === 'drum') for (let i = 0; i < 14; i++) tone(90 + (i % 2) * 8, i * .16, .12, 'square', .05);
      if (kind === 'good') [392, 523, 659, 784].forEach((f, i) => tone(f, i * .1, .3));
      if (kind === 'bad') { tone(300, 0, .25, 'sawtooth', .07); tone(200, .25, .5, 'sawtooth', .07); }
      if (kind === 'top') [523, 659, 784, 1046, 1318, 1046, 1318, 1568].forEach((f, i) => tone(f, i * .14, .35));
    } catch (e) {}
  },

  render() {
    const box = $('soStage'), d = this.data;
    if (!d) return;
    const me = state.me.id, isCand = d.cand?.id === me, inQueue = d.queue.some(q => q.id === me);
    if (!box.querySelector('.so-board')) {
      box.replaceChildren(
        el('div', { class: 'so-sky' }, el('i'), el('i'), el('i')),
        el('div', { class: 'so-top' }),
        el('div', { class: 'so-main' },
          el('div', { class: 'so-left' }, el('div', { class: 'so-host' }, typeof BlindTest !== 'undefined' ? BlindTest.hostSvg() : el('div', {}, '🎩'), el('div', { class: 'so-bubble' })), el('div', { class: 'so-cand' })),
          el('div', { class: 'so-board' }),
          el('div', { class: 'so-ladder' })),
        el('div', { class: 'so-ctrl' }));
    }
    box.classList.toggle('mini', this.mini);
    box.querySelector('.so-top').replaceChildren(...[
      el('b', { class: 'so-title' }, '🏔️ Le Sommet du Paradise'),
      d.cand && d.q ? el('span', { class: 'so-chip' }, `Question ${d.level + 1}/12 · ${this.fmt(d.ladder[d.level])} 💰`) : null,
      el('span', { style: 'flex:1' }),
      el('span', { class: 'so-timer' }),
      el('button', { class: 'btn btn-sm', title: this.mini ? 'Afficher l\'ascension' : 'Réduire', onclick: () => { this.mini = !this.mini; this.render(); } }, this.mini ? '🏔️' : '▁')].filter(Boolean));
    box.querySelector('.so-bubble').textContent = d.line || '';
    box.querySelector('.so-host').classList.toggle('talking', !!d.line);
    // Le candidat sous le projecteur
    box.querySelector('.so-cand').replaceChildren(...(d.cand
      ? [el('div', { class: 'so-spot' }), LC.avatar(d.cand), el('b', { style: 'color:' + (d.cand.color || '#fff') }, d.cand.username), el('small', {}, `🔒 assuré : ${this.fmt(d.secured)} 💰`)]
      : [el('small', { class: 'so-empty' }, 'Personne sur scène')]));
    // La question et les réponses
    const board = box.querySelector('.so-board');
    if (d.q && ['question', 'vote', 'call', 'suspense', 'result', 'over'].includes(d.phase)) {
      const total = d.voteCounts ? d.voteCounts.reduce((a, b) => a + b, 0) : 0;
      board.replaceChildren(
        d.phase === 'call' ? el('div', { class: 'so-calling' }, `📞 Appel en cours avec ${d.call?.to || 'un ami'}… dring dring !`) : d.callResult ? el('div', { class: 'so-calling done' }, d.callResult.answer != null ? `📞 ${d.callResult.name} a répondu : ${'ABCD'[d.callResult.answer]}` : `📞 ${d.callResult.name} n'a pas répondu`) : null,
        el('div', { class: 'so-question' }, d.q.text),
        el('div', { class: 'so-answers' }, ...d.q.answers.map((a, i) => {
          const gone = d.removed.includes(i);
          const cls = ['so-ans', gone ? 'gone' : '', d.pick === i ? 'picked' : '', d.correct === i ? 'right' : '', d.correct != null && d.pick === i && d.correct !== i ? 'wrong' : ''].filter(Boolean).join(' ');
          const pct = d.voteCounts && total ? Math.round(d.voteCounts[i] * 100 / total) : null;
          return el('button', { class: cls, disabled: gone || !(isCand && d.phase === 'question') && !(d.phase === 'vote' && !isCand), onclick: () => (d.phase === 'vote' ? this.emit('so_vote', i) : this.emit('so_pick', i)) },
            el('span', { class: 'so-letter' }, 'ABCD'[i]), el('span', { class: 'so-text' }, gone ? '' : a),
            pct != null && !gone ? el('span', { class: 'so-vote' }, el('i', { style: `width:${pct}%` }), el('em', {}, pct + ' %')) : null);
        })));
    } else if (d.phase === 'intro') {
      board.replaceChildren(el('div', { class: 'so-big' }, `🎬 ${d.cand?.username || ''}`, el('small', {}, 'se prépare à l\'ascension…')));
    } else {
      board.replaceChildren(el('div', { class: 'so-lobby' }, el('b', {}, '🏅 Les meilleurs grimpeurs'),
        d.leaderboard.length ? el('ol', {}, ...d.leaderboard.map(r => el('li', {}, el('span', { style: 'color:' + (r.color || 'inherit') }, r.username), ` · record ${this.fmt(r.best)} 💰${r.tops ? ' · 🏆×' + r.tops : ''}`)))
          : el('small', {}, 'Personne n\'a encore joué : sois le premier !'),
        d.queue.length ? el('small', {}, `📝 En attente : ${d.queue.map(q => q.username).join(', ')}`) : null));
    }
    if (d.phase === 'over') board.append(el('div', { class: 'so-won' + (d.won === d.ladder[d.ladder.length - 1] ? ' top' : '') }, `${d.cand?.username || ''} repart avec ${this.fmt(d.won)} pièces`));
    // L'ascension (les 12 paliers, le plus haut en premier)
    box.querySelector('.so-ladder').replaceChildren(el('div', { class: 'so-peak' }, '🏔️'), ...d.ladder.map((v, i) => ({ v, i })).reverse().map(({ v, i }) =>
      el('div', { class: 'so-step' + (d.safe.includes(i) ? ' safe' : '') + (d.cand && i === d.level && d.phase !== 'idle' ? ' now' : '') + (d.cand && i < d.level ? ' done' : '') },
        el('span', {}, i + 1), el('b', {}, this.fmt(v)))));
    // Les boutons
    const ctrl = [];
    if (isCand && d.phase === 'question') {
      ctrl.push(
        el('button', { class: 'btn btn-primary so-validate', disabled: d.pick == null, onclick: () => this.emit('so_validate') }, d.pick == null ? 'Choisis une réponse' : `✔ Je valide la réponse ${'ABCD'[d.pick]}`),
        el('button', { class: 'btn btn-sm so-joker', disabled: !d.jokers.half, title: 'Retire deux mauvaises réponses', onclick: () => this.emit('so_joker', 'half') }, '✂️ Moitié'),
        el('button', { class: 'btn btn-sm so-joker', disabled: !d.jokers.vote, title: 'Les spectateurs du salon votent', onclick: () => this.emit('so_joker', 'vote') }, '🗳️ Vote du salon'),
        el('button', { class: 'btn btn-sm so-joker', disabled: !d.jokers.swap, title: 'Une autre question de même valeur', onclick: () => this.emit('so_joker', 'swap') }, '🔄 Changer'),
        el('button', { class: 'btn btn-sm so-joker', disabled: !d.jokers.friend, title: 'Appelle un membre connecté : il reçoit la question et a 20 secondes pour répondre', onclick: () => this.callFriend() }, '📞 Appeler un ami'),
        el('button', { class: 'btn btn-sm', onclick: () => { if (confirm(`T'arrêter ici et repartir avec ${this.fmt(d.level ? d.ladder[d.level - 1] : 0)} pièces ?`)) this.emit('so_quit'); } }, `💼 Repartir avec ${this.fmt(d.level ? d.ladder[d.level - 1] : 0)}`));
    } else if (d.phase === 'vote') {
      ctrl.push(el('span', { class: 'so-wait' }, isCand ? `🗳️ Le salon vote pour toi… (${d.voters} vote${d.voters > 1 ? 's' : ''})` : `🗳️ Vote pour aider ${d.cand?.username} : clique sur une réponse ! (${d.voters} vote${d.voters > 1 ? 's' : ''})`));
    } else if (!isCand) {
      if (inQueue) ctrl.push(el('span', { class: 'so-wait' }, `📝 Tu es inscrit (n°${d.queue.findIndex(q => q.id === me) + 1})`), el('button', { class: 'btn btn-sm', onclick: () => this.emit('so_unjoin') }, 'Me désinscrire'));
      else ctrl.push(el('button', { class: 'btn btn-primary', onclick: () => this.emit('so_join') }, '🏔️ Je tente l\'ascension'));
      if (d.cand) ctrl.push(el('span', { class: 'so-wait' }, '👏 Tu es dans le public'));
    } else if (d.phase === 'suspense') ctrl.push(el('span', { class: 'so-wait' }, '🥁 Suspense…'));
    box.querySelector('.so-ctrl').replaceChildren(...ctrl);
    this.updateTimer();
  },
  updateTimer() {
    const t = $('soStage')?.querySelector('.so-timer');
    if (!t || !this.data) return;
    const left = this.data.deadline ? Math.max(0, Math.ceil((this.data.deadline - this.offset - Date.now()) / 1000)) : 0;
    t.textContent = left ? `⏱ ${left} s` : '';
    t.classList.toggle('low', left > 0 && left <= 10);
  },
};

socket.on('sommet', d => Sommet.update(d));
// 📞 On m'appelle à l'aide dans « Qui veut gagner des pièces » !
let soCallClose = null;
socket.on('so_call', c => {
  try { navigator.vibrate?.([200, 100, 200, 100, 400]); } catch (e) {}
  ding();
  const t = el('b', { class: 'so-call-timer' }, '20 s');
  const iv = setInterval(() => { const s = Math.max(0, Math.ceil((c.deadline - Date.now()) / 1000)); t.textContent = s + ' s'; if (!s) { clearInterval(iv); soCallClose && soCallClose(); } }, 300);
  soCallClose = modal(el('div', { class: 'so-call' },
    el('div', { class: 'so-call-ring' }, '📞'), el('h3', {}, `${c.from} t'appelle à l'aide !`), el('p', { class: 'help' }, 'Il joue à « Qui veut gagner des pièces » 💰 : quelle est la bonne réponse ? ', t),
    el('div', { class: 'so-question' }, c.text),
    el('div', { class: 'so-answers' }, ...c.answers.map((a, i) => el('button', { class: 'so-ans', disabled: c.removed.includes(i), onclick: () => { socket.emit('so_call_answer', i); clearInterval(iv); soCallClose && soCallClose(); toast(`📞 Tu as répondu ${'ABCD'[i]} à ${c.from} !`); } }, el('span', { class: 'so-letter' }, 'ABCD'[i]), el('span', { class: 'so-text' }, c.removed.includes(i) ? '' : a))))));
});
socket.on('so_call_end', () => { soCallClose && soCallClose(); soCallClose = null; });
document.addEventListener('viewchange', () => Sommet.onView());
