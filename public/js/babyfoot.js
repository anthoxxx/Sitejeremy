// The Paradise — le Babyfoot ⚽ (écran de jeu)
// Glisse le doigt (ou la souris) sur le terrain pour monter / descendre tes barres, touche pour tirer.
// Au clavier : ↑ ↓ (ou Z S) pour bouger, Espace pour tirer.
const Babyfoot = (() => {
  const W = 600, H = 340, R = 8, FW = 12, FH = 20, GOAL = 58, PAD = 26;
  const RODS = [
    { x: 40, team: 'red', n: 1, gap: 0, group: 0 }, { x: 110, team: 'red', n: 2, gap: 140, group: 0 },
    { x: 190, team: 'blue', n: 3, gap: 95, group: 1 }, { x: 270, team: 'red', n: 4, gap: 70, group: 1 },
    { x: 330, team: 'blue', n: 4, gap: 70, group: 1 }, { x: 410, team: 'red', n: 3, gap: 95, group: 1 },
    { x: 490, team: 'blue', n: 2, gap: 140, group: 0 }, { x: 560, team: 'blue', n: 1, gap: 0, group: 0 },
  ];
  const figures = (rod, v) => { const span = (rod.n - 1) * rod.gap, lo = rod.n === 1 ? H / 2 - 70 : 25, hi = rod.n === 1 ? H / 2 + 70 : H - 25 - span; return Array.from({ length: rod.n }, (_, i) => lo + v * (hi - lo) + i * rod.gap); };
  const COL = { red: '#ff2d55', blue: '#2fa8ff' };
  const states = new Map(); // scene -> dernier état reçu
  let box = null, cv, ctx, scene = null, st = null, recvAt = 0, offset = 0, raf = 0, myV = .5, sentV = -1, lastSend = 0, keys = new Set(), show = { pos: null }, actx = null, lastPhase = '', lastScore = '';

  const me = () => state.me.id;
  const myTeam = () => (st?.slots?.red?.some(p => p.id === me()) ? 'red' : st?.slots?.blue?.some(p => p.id === me()) ? 'blue' : null);
  const myGroups = () => { const t = myTeam(); if (!t) return []; const s = st.slots[t]; return s.length < 2 ? [0, 1] : [s.findIndex(p => p.id === me())]; };
  const emit = (ev, ...a) => socket.emit(ev, ...a, r => r?.error && toast(r.error));
  const sound = kind => {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime, tone = (f, d, dur, type = 'square', vol = .06) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, t + d); g.gain.exponentialRampToValueAtTime(.0001, t + d + dur); o.connect(g).connect(actx.destination); o.start(t + d); o.stop(t + d + dur + .02); };
      if (kind === 'kick') tone(180, 0, .08, 'triangle', .12);
      if (kind === 'goal') [523, 659, 784, 1046].forEach((f, i) => tone(f, i * .1, .25, 'square', .05));
      if (kind === 'win') [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, i * .12, .3, 'triangle', .08));
      if (kind === 'beep') tone(880, 0, .12, 'sine', .08);
    } catch (e) {}
  };

  function build() {
    box = el('div', { class: 'bf-stage hidden' },
      el('div', { class: 'bf-card' },
        el('div', { class: 'bf-head' }, el('b', {}, '⚽ Babyfoot'), el('div', { class: 'bf-score' }), el('button', { class: 'btn btn-sm', title: 'Fermer', onclick: () => close() }, '✕')),
        el('canvas', { class: 'bf-canvas', width: W + PAD * 2, height: H + PAD * 2 }),
        el('div', { class: 'bf-ctrl' })));
    document.body.append(box);
    cv = box.querySelector('canvas'); ctx = cv.getContext('2d');
    const toV = e => { const r = cv.getBoundingClientRect(); const fy = (e.clientY - r.top) / r.height * (H + PAD * 2) - PAD; return Math.max(0, Math.min(1, (fy - 40) / (H - 80))); };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); if (!myTeam()) return; myV = toV(e); try { cv.setPointerCapture(e.pointerId); } catch (err) {} kick(); });
    cv.addEventListener('pointermove', e => { if (!myTeam()) return; if (e.pointerType === 'mouse' || e.buttons) myV = toV(e); });
    document.addEventListener('keydown', e => {
      if (!isOpen() || /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowUp', 'ArrowDown', 'z', 'w', 's', ' '].includes(k)) { e.preventDefault(); e.stopPropagation(); }
      if (k === ' ') kick(); else keys.add(k);
      if (k === 'Escape') close();
    }, true);
    document.addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  }
  function kick() { if (st?.phase !== 'play' || !myTeam()) return; socket.emit('bf_kick'); sound('kick'); show.kickAt = Date.now(); }
  const isOpen = () => box && !box.classList.contains('hidden');

  function open(sc) {
    if (!box) build();
    scene = sc; box.classList.remove('hidden');
    socket.emit('bf_state', d => { if (d?.error) { toast(d.error); return close(); } apply(d); });
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function close() { if (!isOpen()) return; box.classList.add('hidden'); cancelAnimationFrame(raf); keys.clear(); }
  function apply(d) {
    const prevSlots = st?.slots;
    states.set(d.scene, { ...(states.get(d.scene) || {}), ...d, slots: d.slots || states.get(d.scene)?.slots });
    if (d.scene !== scene) return;
    st = { ...d, slots: d.slots || prevSlots };
    recvAt = Date.now(); offset = (d.t || Date.now()) - Date.now();
    if (!show.pos) show.pos = { red: [...d.pos.red], blue: [...d.pos.blue] };
    const sc = `${d.score.red}-${d.score.blue}`;
    if (lastScore && sc !== lastScore && d.phase !== 'count') sound('goal');
    if (d.phase === 'end' && lastPhase !== 'end') sound('win');
    lastScore = sc; lastPhase = d.phase;
    if (d.slots) renderCtrl();
    box.querySelector('.bf-score').replaceChildren(el('span', { style: 'color:' + COL.red }, `🔴 ${d.score.red}`), ' – ', el('span', { style: 'color:' + COL.blue }, `${d.score.blue} 🔵`));
  }
  socket.on('bf', d => { apply(d); });

  function renderCtrl() {
    const c = box.querySelector('.bf-ctrl'), mine = myTeam(), playing = st.phase === 'play' || st.phase === 'count' || st.phase === 'goal';
    const team = t => el('div', { class: 'bf-team ' + t },
      el('b', {}, t === 'red' ? '🔴 Les Rouges' : '🔵 Les Bleus'),
      ...(st.slots[t].length ? st.slots[t].map((p, i) => el('div', { class: 'bf-pl' }, `${p.id === me() ? '⭐ ' : ''}${p.username}`, st.slots[t].length > 1 ? el('small', {}, i ? ' · attaque' : ' · défense') : null))
        : [el('div', { class: 'bf-pl empty' }, st.bot === t ? '🤖 Le robot' : 'Personne')]),
      !playing && mine !== t && st.slots[t].length < 2 ? el('button', { class: 'btn btn-sm', onclick: () => emit('bf_join', t) }, 'Rejoindre') : null);
    const other = mine === 'red' ? 'blue' : 'red';
    c.replaceChildren(...[
      el('div', { class: 'bf-teams' }, team('red'), team('blue')),
      playing ? (mine ? el('div', { class: 'bf-play' }, el('button', { class: 'btn btn-primary bf-kick', onpointerdown: e => { e.preventDefault(); kick(); } }, '⚡ TIRER'),
        el('small', {}, `Glisse le doigt sur le terrain pour bouger tes barres ${myGroups().length === 1 ? (myGroups()[0] ? '(l\'attaque)' : '(la défense)') : ''} · touche pour tirer`))
        : el('div', { class: 'bf-play' }, el('small', {}, '👀 Tu regardes la partie'))) : null,
      !playing ? el('div', { class: 'bf-lobby' },
        mine && !st.slots[other].length ? el('button', { class: 'btn btn-sm', onclick: () => emit('bf_bot') }, st.bot ? '👥 Sans robot' : '🤖 Jouer contre le robot') : null,
        mine ? el('button', { class: 'btn btn-primary', onclick: () => emit('bf_start') }, '▶ Lancer la partie') : el('small', {}, 'Choisis ton équipe : 1 contre 1, 2 contre 2, ou contre le robot 🤖'),
        mine ? el('button', { class: 'btn btn-sm btn-ghost', onclick: () => emit('bf_leave') }, 'Quitter l\'équipe') : null) : null,
    ].filter(Boolean));
  }

  // ---------- Dessin ----------
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!st) return;
    // clavier
    if (keys.has('ArrowUp') || keys.has('z') || keys.has('w')) myV = Math.max(0, myV - .035);
    if (keys.has('ArrowDown') || keys.has('s')) myV = Math.min(1, myV + .035);
    const t = Date.now();
    if (myTeam() && Math.abs(myV - sentV) > .004 && t - lastSend > 40) { lastSend = t; sentV = myV; socket.emit('bf_move', myV); }
    // les barres glissent en douceur ; les miennes suivent tout de suite mon doigt
    const mine = myTeam(), groups = myGroups();
    for (const team of ['red', 'blue']) for (const k of [0, 1]) {
      const goal = team === mine && groups.includes(k) ? myV : st.pos[team][k];
      show.pos[team][k] += (goal - show.pos[team][k]) * (team === mine && groups.includes(k) ? .35 : .45);
    }
    draw(t);
  }
  function draw(t) {
    const g = ctx; g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#5a3a1c'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#7a4f2b'; g.fillRect(6, 6, cv.width - 12, cv.height - 12);
    g.translate(PAD, PAD);
    // la pelouse
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#2e9d57' : '#34ad61'; g.fillRect(i * W / 10, 0, W / 10, H); }
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
    g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke(); g.beginPath(); g.arc(W / 2, H / 2, 40, 0, 7); g.stroke();
    g.strokeRect(0, H / 2 - 90, 60, 180); g.strokeRect(W - 60, H / 2 - 90, 60, 180);
    // les buts
    g.fillStyle = '#111'; g.fillRect(-PAD + 8, H / 2 - GOAL, PAD - 8, GOAL * 2); g.fillRect(W, H / 2 - GOAL, PAD - 8, GOAL * 2);
    g.fillStyle = COL.red; g.fillRect(-4, H / 2 - GOAL - 4, 4, 8); g.fillRect(-4, H / 2 + GOAL - 4, 4, 8);
    g.fillStyle = COL.blue; g.fillRect(W, H / 2 - GOAL - 4, 4, 8); g.fillRect(W, H / 2 + GOAL - 4, 4, 8);
    // la balle (on la fait avancer entre deux nouvelles du serveur pour qu'elle roule sans à-coups)
    if (st.phase === 'play') {
      const dt = Math.min(.12, (t - recvAt) / 1000);
      let bx = st.ball.x + st.ball.vx * dt, by = st.ball.y + st.ball.vy * dt;
      if (by < R) by = 2 * R - by; if (by > H - R) by = 2 * (H - R) - by;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(bx + 3, by + 4, R, R * .7, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, R, 0, 7); g.fill(); g.strokeStyle = '#333'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#333'; g.beginPath(); g.arc(bx + Math.sin(bx / 6) * 3, by + Math.cos(by / 6) * 3, 2.5, 0, 7); g.fill();
    }
    // les barres et les petits joueurs
    const mine = myTeam(), groups = myGroups();
    for (const rod of RODS) {
      const v = show.pos[rod.team][rod.group], hot = rod.team === mine && groups.includes(rod.group);
      g.fillStyle = hot ? '#ffe9a8' : '#c0c6cc'; g.fillRect(rod.x - 2, -PAD + 4, 4, H + PAD * 2 - 8);
      g.fillStyle = '#222'; g.fillRect(rod.x - 7, (rod.team === 'red' ? -PAD : H) + 2, 14, PAD - 4);
      const kicking = st.kick?.[rod.team]?.[rod.group] || (hot && Date.now() - (show.kickAt || 0) < 180);
      for (const fy of figures(rod, v)) {
        const off = kicking ? (rod.team === 'red' ? 8 : -8) : 0;
        if (hot) { g.shadowColor = '#ffe9a8'; g.shadowBlur = 10; }
        g.fillStyle = COL[rod.team]; g.fillRect(rod.x - FW / 2 + off, fy - FH / 2, FW, FH); g.shadowBlur = 0;
        g.fillStyle = '#ffd7b0'; g.beginPath(); g.arc(rod.x + off * .4, fy, 4.5, 0, 7); g.fill();
        g.fillStyle = '#111'; g.fillRect(rod.x - FW / 2 + off + (rod.team === 'red' ? FW - 3 : 0), fy - 4, 3, 8);
      }
    }
    // messages
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const big = (txt, col, size = 54) => { g.font = `900 ${size}px Outfit, Inter, sans-serif`; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(txt, W / 2, H / 2); g.fillStyle = col; g.fillText(txt, W / 2, H / 2); };
    if (st.phase === 'count') { const n = Math.max(1, Math.ceil((st.until - offset - t) / 1000)); big(String(n), '#ffd76a', 90); }
    if (st.phase === 'goal') big(st.msg || '⚽ BUT !', '#ffffff', 44);
    if (st.phase === 'end') big(st.msg, st.winner ? COL[st.winner] : '#fff', 28);
    if (st.phase === 'lobby') { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, H); big('Choisis ton équipe !', '#ffffff', 30); }
  }
  return { open, close, isOpen, state: sc => states.get(sc) };
})();
window.Babyfoot = Babyfoot;
