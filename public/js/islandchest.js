// The Paradise — 🏴‍☠️ « Le trésor de l'île » : avant de s'inscrire ou de se connecter, on frotte le sable avec le doigt pour creuser
// (comme un ticket à gratter). Le coffre apparaît, il sort du sable, le couvercle s'ouvre, la lumière et les pièces jaillissent… et le formulaire apparaît.
(() => {
  const card = document.getElementById('authCard'); if (!card) return;
  const q = new URLSearchParams(location.search);
  if (q.get('reset') || q.get('google') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bg = `<svg class="tc-bg" viewBox="0 0 400 460" preserveAspectRatio="none" aria-hidden="true"><defs>
      <linearGradient id="tcSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2a6e"/><stop offset=".5" stop-color="#e0668a"/><stop offset="1" stop-color="#ffc58a"/></linearGradient>
      <linearGradient id="tcSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9e7a"/><stop offset=".12" stop-color="#3aa6c4"/><stop offset="1" stop-color="#1d6f96"/></linearGradient>
      <radialGradient id="tcSun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff7d6"/><stop offset=".35" stop-color="#ffe08a"/><stop offset="1" stop-color="#ffb070" stop-opacity="0"/></radialGradient></defs>
    <rect width="400" height="460" fill="url(#tcSky)"/>
    <circle cx="120" cy="150" r="90" fill="url(#tcSun)"/><circle cx="120" cy="150" r="28" fill="#fff4cc"/>
    <path d="M0 120 q60 -18 120 -4 t130 0 t150 -10 V140 H0Z" fill="#fff" opacity=".12"/>
    <rect y="168" width="400" height="80" fill="url(#tcSea)"/>
    <g class="tc-glint" fill="#fff3c8">${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${92 + (i % 3) * 18 - i * 2}" y="${176 + i * 11}" width="${36 - i * 4}" height="2.4" rx="1.2" style="animation-delay:${i * .3}s"/>`).join('')}</g>
    <g class="tc-wave" fill="#ffffff" opacity=".5"><path d="M-400 236 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V244 H-400Z"/></g>
    <!-- le sable mouillé, sous celui qu'on gratte (c'est le fond du trou) -->
    <defs><radialGradient id="tcHole" cx=".5" cy=".55" r=".55"><stop offset="0" stop-color="#8a6234"/><stop offset=".6" stop-color="#b08550"/><stop offset="1" stop-color="#c99e62"/></radialGradient></defs>
    <path d="M0 252 Q120 232 220 246 T400 240 V460 H0Z" fill="#c99e62"/>
    <ellipse cx="200" cy="336" rx="150" ry="70" fill="url(#tcHole)"/>
    <g transform="translate(345 250)" fill="#3a2440" opacity=".85"><path d="M0 0 C -4 -50 4 -110 -10 -170" stroke="#3a2440" stroke-width="10" fill="none" stroke-linecap="round"/>
      <g class="tc-leaves" transform="translate(-10 -170)"><path d="M0 0 C -34 -16 -70 -4 -92 22 C -60 4 -30 4 0 0Z"/><path d="M0 0 C 28 -22 64 -18 86 4 C 56 -6 28 -4 0 0Z"/><path d="M0 0 C -16 -34 -48 -48 -76 -40 C -46 -30 -20 -18 0 0Z"/><path d="M0 0 C 12 -36 42 -52 70 -50 C 42 -34 18 -20 0 0Z"/><path d="M0 0 C -10 22 -4 52 10 70 C 2 44 0 22 0 0Z"/></g></g>
  </svg>`;
  const chestBody = `<svg viewBox="0 0 200 110" aria-hidden="true"><defs><linearGradient id="tcWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a5a2c"/><stop offset="1" stop-color="#5e3216"/></linearGradient>
      <linearGradient id="tcGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a0"/><stop offset=".45" stop-color="#e5ab2e"/><stop offset="1" stop-color="#a86a12"/></linearGradient></defs>
    <rect x="6" y="4" width="188" height="100" rx="8" fill="url(#tcWood)" stroke="#3a1e0c" stroke-width="3"/>
    ${[30, 58, 86].map(y => `<path d="M10 ${y} H190" stroke="#4a2810" stroke-width="2" opacity=".6"/>`).join('')}
    ${[14, 186].map(x => `<rect x="${x - 9}" y="2" width="18" height="104" rx="4" fill="url(#tcGold)" stroke="#7a4a08" stroke-width="2"/>`).join('')}
    <rect x="86" y="2" width="28" height="104" rx="5" fill="url(#tcGold)" stroke="#7a4a08" stroke-width="2"/>
    <rect x="88" y="10" width="24" height="30" rx="5" fill="#3a2a10"/><circle cx="100" cy="22" r="5" fill="#e5ab2e"/><path d="M97 25 h6 l1.5 10 h-9z" fill="#e5ab2e"/>
    ${[[14, 20], [14, 90], [186, 20], [186, 90], [100, 60], [100, 92]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#fff4c0" stroke="#7a4a08" stroke-width="1.2"/>`).join('')}
  </svg>`;
  const chestLid = `<svg viewBox="0 0 200 70" aria-hidden="true"><path d="M6 66 V36 Q6 4 100 4 Q194 4 194 36 V66 Z" fill="url(#tcWood)" stroke="#3a1e0c" stroke-width="3"/>
    <path d="M12 40 Q100 12 188 40" stroke="#4a2810" stroke-width="2" fill="none" opacity=".6"/>
    ${[14, 186].map(x => `<path d="M${x - 9} 66 V34 Q${x - 9} ${x < 100 ? 14 : 14} ${x} 12 Q${x + 9} 14 ${x + 9} 34 V66Z" fill="url(#tcGold)" stroke="#7a4a08" stroke-width="2"/>`).join('')}
    <path d="M86 66 V6 Q100 2 114 6 V66Z" fill="url(#tcGold)" stroke="#7a4a08" stroke-width="2"/>
    <rect x="6" y="58" width="188" height="9" rx="3" fill="url(#tcGold)" stroke="#7a4a08" stroke-width="1.5"/>
  </svg>`;
  const gate = document.createElement('div'); gate.className = 'tchest';
  gate.innerHTML = bg + `
    <div class="tc-x">✕</div>
    <div class="tc-chest"><div class="tc-rays"></div><div class="tc-glow"></div><div class="tc-lid">${chestLid}</div><div class="tc-body">${chestBody}</div></div>
    <canvas class="tc-sand"></canvas>
    <div class="tc-shovel">🪏</div>
    <div class="tc-hint"><b>🏴‍☠️ Un trésor est caché ici !</b><span>Frotte le sable avec ton doigt pour creuser</span></div>
    <div class="tc-bar"><i></i></div>
    <button type="button" class="tc-skip">Passer ›</button>`;
  card.classList.add('gated'); card.append(gate);
  const cv = gate.querySelector('.tc-sand'), g = cv.getContext('2d', { willReadFrequently: true }), bar = gate.querySelector('.tc-bar i'), shovel = gate.querySelector('.tc-shovel');
  let W = 0, H = 0, dpr = 1, done = false, AC = null, lastSnd = 0, dug = 0;
  // 🏖️ le sable, dessiné sur un calque qu'on efface en frottant
  function paintSand() {
    const r = gate.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const top = H * .52;
    const grd = g.createLinearGradient(0, top, 0, H); grd.addColorStop(0, '#f6dca4'); grd.addColorStop(.5, '#ecc887'); grd.addColorStop(1, '#d9ad68');
    g.fillStyle = grd; g.beginPath(); g.moveTo(0, top + 14); g.quadraticCurveTo(W * .3, top - 6, W * .55, top + 6); g.quadraticCurveTo(W * .8, top + 16, W, top + 2); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    // l'écume sur le bord
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, top + 14); g.quadraticCurveTo(W * .3, top - 6, W * .55, top + 6); g.quadraticCurveTo(W * .8, top + 16, W, top + 2); g.stroke();
    // le grain du sable, les petites rides, les coquillages
    for (let i = 0; i < W * H / 26; i++) { const x = Math.random() * W, y = top + Math.random() * (H - top); g.fillStyle = Math.random() < .5 ? 'rgba(120,80,30,.13)' : 'rgba(255,250,230,.25)'; g.fillRect(x, y, 1.4, 1.4); }
    g.strokeStyle = 'rgba(150,100,45,.16)'; g.lineWidth = 2; for (let i = 0; i < 14; i++) { const y = top + 30 + i * (H - top - 30) / 14; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 24) g.quadraticCurveTo(x + 12, y + (i % 2 ? 4 : -4), x + 24, y); g.stroke(); }
    g.font = '22px "Noto Color Emoji", sans-serif'; g.fillText('🐚', W * .12, H * .9); g.fillText('⭐', W * .82, H * .95); g.font = '16px "Noto Color Emoji", sans-serif'; g.fillText('🦀', W * .78, H * .66);
    // la croix du trésor, là où creuser
    g.strokeStyle = 'rgba(170,40,30,.85)'; g.lineWidth = 7; g.lineCap = 'round'; const cx = W / 2, cy = H * .73; g.beginPath(); g.moveTo(cx - 22, cy - 18); g.lineTo(cx + 22, cy + 18); g.moveTo(cx + 22, cy - 18); g.lineTo(cx - 22, cy + 18); g.stroke();
  }
  paintSand();
  const snd = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime, n = Math.ceil(AC.sampleRate * .09), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) * .18; const s = AC.createBufferSource(), f = AC.createBiquadFilter(); s.buffer = b; f.type = 'bandpass'; f.frequency.value = 2200; s.connect(f).connect(AC.destination); s.start(t); } catch (e) {} };
  const chime = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime; [880, 1175, 1568, 2093].forEach((f, i) => { const o = AC.createOscillator(), gg = AC.createGain(); o.type = 'triangle'; o.frequency.value = f; gg.gain.setValueAtTime(.0001, t + i * .09); gg.gain.exponentialRampToValueAtTime(.18, t + i * .09 + .02); gg.gain.exponentialRampToValueAtTime(.0001, t + i * .09 + .7); o.connect(gg).connect(AC.destination); o.start(t + i * .09); o.stop(t + i * .09 + .8); }); } catch (e) {} };
  // combien de sable a été retiré au-dessus du coffre
  function measure() {
    const cx = W / 2, cy = H * .73, bw = Math.min(W * .5, 190), bh = bw * .6, x0 = Math.round((cx - bw / 2) * dpr), y0 = Math.round((cy - bh / 2) * dpr), w = Math.round(bw * dpr), h = Math.round(bh * dpr);
    const data = g.getImageData(x0, y0, w, h).data; let clear = 0, tot = 0; for (let i = 3; i < data.length; i += 4 * 9) { tot++; if (data[i] < 40) clear++; } return clear / Math.max(1, tot);
  }
  function grains(x, y) { for (let i = 0; i < 3; i++) { const s = document.createElement('i'); s.className = 'tc-grain'; s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px'); s.style.setProperty('--dy', (-20 - Math.random() * 40) + 'px'); gate.append(s); setTimeout(() => s.remove(), 650); } }
  let last = null, n = 0;
  const dig = (x, y) => {
    g.save(); g.globalCompositeOperation = 'destination-out';
    const R = Math.max(22, W * .07);
    const stamp = (px, py) => { const gr = g.createRadialGradient(px, py, R * .3, px, py, R); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(px, py, R, 0, 7); g.fill(); };
    if (last) { const d = Math.hypot(x - last.x, y - last.y), st = Math.max(1, Math.ceil(d / (R * .35))); for (let i = 1; i <= st; i++) stamp(last.x + (x - last.x) * i / st, last.y + (y - last.y) * i / st); } else stamp(x, y);
    g.restore(); last = { x, y };
    if (performance.now() - lastSnd > 90) { lastSnd = performance.now(); snd(); grains(x, y); }
    if (++n % 4 === 0) { dug = measure(); bar.style.width = Math.min(100, dug / .42 * 100) + '%'; gate.classList.add('tc-digging'); if (dug > .42) found(); }
  };
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  let down = false;
  cv.addEventListener('pointerdown', e => { if (done) return; e.preventDefault(); down = true; last = null; cv.setPointerCapture?.(e.pointerId); const p = pos(e); dig(p.x, p.y); shovel.style.opacity = 1; });
  cv.addEventListener('pointermove', e => { const p = pos(e); shovel.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${down ? -35 + Math.sin(performance.now() / 60) * 18 : -20}deg)`; if (down && !done) dig(p.x, p.y); });
  const up = () => { down = false; last = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', () => { shovel.style.opacity = 0; });
  gate.querySelector('.tc-skip').addEventListener('click', e => { e.stopPropagation(); found(true); });
  // 🎉 le trésor est trouvé : le coffre sort du sable, s'ouvre, la lumière et les pièces jaillissent
  function found(fast) {
    if (done) return; done = true; bar.style.width = '100%';
    if (fast) { reveal(); setTimeout(finish, 800); return; }
    gate.classList.add('tc-found');
    setTimeout(() => { gate.classList.add('tc-open'); chime(); coins(); }, 1100);
    setTimeout(reveal, 3600);
    setTimeout(finish, 4600);
  }
  function coins() { const box = gate.querySelector('.tc-chest'); for (let i = 0; i < 22; i++) { const c = document.createElement('i'); c.className = 'tc-coin'; c.textContent = ['🪙', '💎', '🪙', '✨', '🪙', '💰'][i % 6]; c.style.setProperty('--dx', (Math.random() * 260 - 130) + 'px'); c.style.setProperty('--dy', (-140 - Math.random() * 160) + 'px'); c.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg'); c.style.animationDelay = (Math.random() * .5) + 's'; box.append(c); } }
  function reveal() { card.classList.remove('gated'); card.classList.add('bg-revealed'); gate.classList.add('tc-out'); setTimeout(() => card.classList.remove('bg-revealed'), 1300); }
  function finish() { gate.remove(); card.querySelector('form:not(.hidden) input:not([type=hidden])')?.focus({ preventScroll: true }); }
  addEventListener('resize', () => { if (!done && !dug) paintSand(); });
  document.querySelectorAll('a[href="#authCard"]').forEach(a => a.addEventListener('click', () => setTimeout(() => { if (!done) gate.querySelector('.tc-hint')?.classList.add('tc-shake'); }, 600)));
  window.TreasureGate = { open: () => found() };
})();
