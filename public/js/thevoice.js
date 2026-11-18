// The Paradise — 🎤 The Voice du Paradise (la scène dans le salon)
const TheVoiceUI = (() => {
  let data = null, tick = null;
  const SLUG = 'thevoice';
  const box = () => document.getElementById('tvStage');
  const active = () => state.view?.type === 'room' && state.view.slug === SLUG;
  const emit = (ev, ...a) => socket.emit(ev, ...a, r => { if (r?.error) toast(r.error); });
  const left = () => (data?.endsAt ? Math.max(0, Math.ceil((data.endsAt - Date.now()) / 1000)) : 0);
  function buzz() { try { const A = new (window.AudioContext || window.webkitAudioContext)(), o = A.createOscillator(), g = A.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, A.currentTime); g.gain.setValueAtTime(.12, A.currentTime); g.gain.exponentialRampToValueAtTime(.001, A.currentTime + .7); o.connect(g).connect(A.destination); o.start(); o.stop(A.currentTime + .7); } catch (e) {} }
  function render() {
    const b = box(); if (!b || !data) return;
    const staff = isStaff(), me = state.me.id, d = data, singing = d.phase === 'singing', iSing = d.singer?.id === me;
    const inQueue = d.queue.some(q => q.id === me), sang = d.results.some(r => r.id === me);
    const song = el('input', { class: 'input tv-song', maxlength: 60, placeholder: 'Ta chanson (facultatif)' });
    b.replaceChildren(
      el('div', { class: 'tv-head' }, el('b', {}, '🎤 THE VOICE du Paradise'), el('span', { class: 'tv-phase' }, d.phase === 'idle' ? '⏸️ Fermé' : singing ? `🔴 En direct · ${Math.floor(left() / 60)}:${String(left() % 60).padStart(2, '0')}` : '🟢 Inscriptions ouvertes')),
      el('div', { class: 'tv-scene' },
        el('div', { class: 'tv-jury' }, ...(d.jury.length ? d.jury.map(j => el('div', { class: 'tv-chair' + (j.turned ? ' turned' : '') }, j.turned ? LC.avatar(j) : el('span', { class: 'tv-back' }, '🪑'), el('small', {}, j.username), j.turned ? el('i', {}, 'I WANT YOU') : null)) : [el('small', { class: 'tv-nojury' }, 'Le jury (le staff) n\'est pas encore là')])),
        el('div', { class: 'tv-spot' + (singing ? ' on' : '') }, singing ? [LC.avatar(d.singer, true), el('b', {}, d.singer.username), d.song ? el('em', {}, '🎶 ' + d.song) : null, el('div', { class: 'tv-score' }, `🔄 ${d.turns} · 👏 ${d.likes}`)] : [el('div', { class: 'tv-mic' }, '🎙️'), el('small', {}, d.phase === 'idle' ? (d.lastWinner ? `Dernier gagnant : 🏆 ${d.lastWinner.username} (${d.lastWinner.score} pts)` : 'Le prochain concours arrive bientôt !') : 'En attente du prochain candidat…')])),
      el('div', { class: 'tv-actions' },
        singing && staff && !iSing && !d.jury.find(j => j.id === me)?.turned ? el('button', { class: 'tv-turn', onclick: () => emit('tvo_turn') }, '🔄 Je me retourne !') : null,
        singing && !staff && !iSing ? el('button', { class: 'btn btn-primary', onclick: () => emit('tvo_like') }, '👏 J\'adore !') : null,
        iSing ? el('span', { class: 'tv-you' }, '🎙️ C\'est à toi ! Rejoins le vocal et chante !') : null,
        iSing ? el('button', { class: 'btn btn-sm', onclick: () => emit('tvo_end_song') }, '⏹ J\'ai fini') : null,
        d.phase !== 'idle' && !iSing && !inQueue && !sang && !staff ? [song, el('button', { class: 'btn btn-primary', onclick: () => emit('tvo_join', song.value) }, '🙋 M\'inscrire pour chanter')] : null,
        inQueue ? el('button', { class: 'btn btn-sm', onclick: () => emit('tvo_leave') }, `⏳ Tu es n°${d.queue.findIndex(q => q.id === me) + 1} · se désinscrire`) : null,
        staff ? el('div', { class: 'tv-staff' }, el('small', {}, '🛡️ Animation :'),
          d.phase === 'idle' ? el('button', { class: 'btn btn-sm btn-primary', onclick: () => emit('tvo_open') }, '🎤 Ouvrir le concours') : [
            el('button', { class: 'btn btn-sm btn-primary', disabled: !d.queue.length, onclick: () => emit('tvo_next') }, `▶ Candidat suivant (${d.queue.length})`),
            singing ? el('button', { class: 'btn btn-sm', onclick: () => emit('tvo_end_song') }, '⏹ Fin de la chanson') : null,
            el('button', { class: 'btn btn-sm btn-danger', onclick: () => { if (confirm('Terminer le concours et désigner le gagnant ?')) emit('tvo_close'); } }, '🏆 Terminer et désigner le gagnant')]) : null),
      d.queue.length ? el('div', { class: 'tv-queue' }, el('small', {}, '⏳ À suivre : '), ...d.queue.map((q, i) => el('span', {}, `${i + 1}. ${q.username}`))) : null,
      d.results.length ? el('div', { class: 'tv-results' }, el('small', {}, '🏅 Classement : '), ...d.results.map((r, i) => el('span', {}, `${['🥇', '🥈', '🥉'][i] || i + 1 + '.'} ${r.username} ${r.score} pts`))) : null);
  }
  function onView() {
    const b = box(); if (!b) return;
    if (!active()) { b.classList.add('hidden'); b.replaceChildren(); clearInterval(tick); tick = null; return; }
    b.classList.remove('hidden');
    socket.emit('tvo_state', d => { data = d; render(); });
    if (!tick) tick = setInterval(() => { if (data?.phase === 'singing') { const t = box()?.querySelector('.tv-phase'); if (t) t.textContent = `🔴 En direct · ${Math.floor(left() / 60)}:${String(left() % 60).padStart(2, '0')}`; } }, 1000);
  }
  socket.on('thevoice', d => { data = d; if (active()) render(); });
  socket.on('thevoice_turn', ({ username }) => { if (!active()) return; buzz(); const f = el('div', { class: 'tv-flash' }, `🔄 ${username} SE RETOURNE !`); box()?.append(f); setTimeout(() => f.remove(), 1800); });
  socket.on('thevoice_open', ({ by }) => { if (!active()) toast(`🎤 ${by} ouvre The Voice du Paradise ! Viens chanter ou voter`, () => joinRoom(SLUG)); });
  socket.on('thevoice_winner', ({ username }) => { LC.confetti(['🎤', '🏆', '🎶', '⭐']); toast(`🏆 ${username} gagne The Voice du Paradise !`); });
  document.addEventListener('viewchange', onView);
  return { onView };
})();
