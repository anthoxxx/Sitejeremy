// The Paradise — 🚪🔑 « La porte de l'île » : avant de s'inscrire ou de se connecter, on fait glisser la clé dorée dans le cadenas,
// la clé tourne, le cadenas s'ouvre et tombe, les deux battants de la grande porte s'ouvrent… et le formulaire apparaît derrière.
(() => {
  const card = document.getElementById('authCard'); if (!card) return;
  const q = new URLSearchParams(location.search);
  // pas de porte quand on revient d'un lien « mot de passe oublié », de Google, ou si l'appareil demande moins d'animations
  if (q.get('reset') || q.get('google') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const scene = `
  <svg class="ig-scene" viewBox="0 0 400 460" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="igSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1446"/><stop offset=".55" stop-color="#8a2f82"/><stop offset="1" stop-color="#ff8a5c"/></linearGradient>
      <linearGradient id="igSand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9c98a"/><stop offset="1" stop-color="#c9a160"/></linearGradient>
      <linearGradient id="igStone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a8f86"/><stop offset=".5" stop-color="#7d726a"/><stop offset="1" stop-color="#5e554f"/></linearGradient>
      <radialGradient id="igFire" cx=".5" cy=".6" r=".5"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#ffb02e"/><stop offset="1" stop-color="#ff4d1a" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="400" height="460" fill="url(#igSky)"/>
    <g fill="#fff">${Array.from({ length: 16 }, (_, i) => `<circle class="ig-star" cx="${(i * 89) % 400}" cy="${(i * 41) % 110 + 8}" r="${i % 3 ? 1 : 1.7}" style="animation-delay:${(i % 5) * .5}s"/>`).join('')}</g>
    <path d="M0 400 Q200 375 400 400 V460 H0Z" fill="url(#igSand)"/>
    <!-- les palmiers de chaque côté -->
    ${[[30, 1], [370, -1]].map(([x, s]) => `<g transform="translate(${x} 410) scale(${s} 1)"><path d="M0 0 C 6 -60 0 -140 18 -230" stroke="#5a3a1e" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M0 0 C 6 -60 0 -140 18 -230" stroke="#7a5230" stroke-width="4" fill="none" stroke-dasharray="5 9"/>
      <g class="ig-leaves" transform="translate(18 -230)" fill="#1f7a3a"><path d="M0 0 C 30 -18 66 -6 86 20 C 56 4 30 4 0 0Z"/><path d="M0 0 C -26 -20 -60 -14 -80 6 C -52 -4 -28 -4 0 0Z"/><path d="M0 0 C 14 -34 44 -46 70 -40 C 42 -28 20 -16 0 0Z"/><path d="M0 0 C 8 24 4 52 -10 70 C -2 46 0 22 0 0Z" fill="#17652f"/><path d="M0 0 C 26 6 48 26 56 52 C 38 30 20 14 0 0Z" fill="#17652f"/></g></g>`).join('')}
    <!-- l'arche en pierre -->
    <path d="M62 412 V170 Q62 60 200 52 Q338 60 338 170 V412 H300 V178 Q300 98 200 92 Q100 98 100 178 V412Z" fill="url(#igStone)" stroke="#4a423d" stroke-width="3"/>
    <g stroke="#4a423d" stroke-width="2" opacity=".55" fill="none">
      <path d="M62 250 H100 M62 320 H100 M300 250 H338 M300 320 H338 M62 190 H100 M300 190 H338"/>
      <path d="M80 110 L104 126 M118 78 L132 100 M200 52 V92 M282 78 L268 100 M320 110 L296 126"/>
    </g>
    <path d="M150 70 q50 -26 100 0" stroke="#2f9a4a" stroke-width="5" fill="none" opacity=".9"/>
    ${[160, 185, 215, 240].map((x, i) => `<path d="M${x} ${66 - (i % 2) * 6} q${i % 2 ? 6 : -6} 18 0 34" stroke="#2f9a4a" stroke-width="3" fill="none"/>`).join('')}
    <text x="200" y="80" text-anchor="middle" font-size="18" font-weight="900" fill="#ffe7a8" style="font-family:Georgia,serif;letter-spacing:2px">PARADISE</text>
    <!-- les torches -->
    ${[42, 358].map(x => `<g transform="translate(${x} 210)"><rect x="-4" y="0" width="8" height="70" rx="3" fill="#5a3a1e"/><path d="M-10 0 h20 l-4 -10 h-12z" fill="#3a2a1a"/><circle class="ig-flame" cx="0" cy="-22" r="22" fill="url(#igFire)"/><path class="ig-flame" d="M0 -40 C 10 -26 8 -14 0 -10 C -8 -14 -10 -26 0 -40Z" fill="#ffd24a"/></g>`).join('')}
  </svg>`;
  const lock = `<svg viewBox="0 0 80 100" aria-hidden="true"><path class="ig-shackle" d="M20 46 V28 a20 20 0 0 1 40 0 V46" fill="none" stroke="#b8bcc4" stroke-width="9" stroke-linecap="round"/>
    <rect x="8" y="44" width="64" height="52" rx="10" fill="#d4a24a" stroke="#8a6420" stroke-width="3"/><rect x="14" y="50" width="52" height="8" rx="4" fill="#f2d48a" opacity=".6"/>
    <circle cx="40" cy="68" r="7" fill="#3a2a10"/><path d="M37 70 h6 l2 16 h-10z" fill="#3a2a10"/></svg>`;
  const key = `<svg viewBox="0 0 120 50" aria-hidden="true"><circle cx="22" cy="25" r="18" fill="none" stroke="#e8b43c" stroke-width="9"/><circle cx="22" cy="25" r="18" fill="none" stroke="#fff3c0" stroke-width="2" opacity=".6"/>
    <rect x="38" y="20" width="72" height="10" rx="4" fill="#e8b43c"/><rect x="86" y="30" width="8" height="14" rx="2" fill="#e8b43c"/><rect x="100" y="30" width="8" height="10" rx="2" fill="#e8b43c"/><rect x="40" y="21" width="66" height="3" rx="1.5" fill="#fff3c0" opacity=".7"/></svg>`;
  const gate = document.createElement('div');
  gate.className = 'igate';
  gate.innerHTML = scene + `
    <div class="ig-doorway"><div class="ig-light"></div><div class="ig-door l"></div><div class="ig-door r"></div></div>
    <div class="ig-lock">${lock}</div>
    <div class="ig-key" role="button" tabindex="0" aria-label="Faire glisser la clé dans le cadenas pour entrer">${key}</div>
    <div class="ig-hint">🔑 Fais glisser la clé dans le cadenas</div>
    <button type="button" class="ig-skip">Passer ›</button>`;
  card.classList.add('gated'); card.append(gate);
  const K = gate.querySelector('.ig-key'), L = gate.querySelector('.ig-lock');
  let done = false, AC = null;
  const snd = (f0, f1, dur, type = 'square', vol = .25) => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + .02); } catch (e) {} };
  const creak = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(110, t + 1.2); o.frequency.linearRampToValueAtTime(60, t + 1.8); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 6; g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.12, t + .2); g.gain.linearRampToValueAtTime(.0001, t + 1.9); o.connect(f).connect(g).connect(AC.destination); o.start(t); o.stop(t + 2); } catch (e) {} };
  // où mettre la clé : le trou de la serrure
  const holeXY = () => ({ x: L.offsetLeft + L.offsetWidth * .5, y: L.offsetTop + L.offsetHeight * .68 });
  const keyHome = () => { K.style.transition = 'transform .45s cubic-bezier(.3,1.4,.5,1)'; K.style.transform = ''; };
  // glisser la clé avec le doigt (ou la souris)
  let drag = null;
  K.addEventListener('pointerdown', e => { if (done) return; e.preventDefault(); const r = K.getBoundingClientRect(); drag = { id: e.pointerId, ox: e.clientX, oy: e.clientY, moved: false, r }; K.setPointerCapture?.(e.pointerId); K.style.transition = 'none'; K.classList.add('held'); });
  K.addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.ox, dy = e.clientY - drag.oy; if (Math.hypot(dx, dy) > 6) drag.moved = true; K.style.transform = `translate(${dx}px, ${dy}px) rotate(-20deg) scale(1.08)`;
    const h = holeXY(), kx = K.offsetLeft + K.offsetWidth * .86 + dx, ky = K.offsetTop + K.offsetHeight / 2 + dy; L.classList.toggle('near', Math.hypot(kx - h.x, ky - h.y) < 70); });
  const release = e => { if (!drag || e.pointerId !== drag.id) return; K.classList.remove('held'); const moved = drag.moved, near = L.classList.contains('near'); drag = null; L.classList.remove('near');
    if (!moved || near) unlock(); else { keyHome(); snd(220, 160, .12, 'sine', .15); } };
  K.addEventListener('pointerup', release); K.addEventListener('pointercancel', e => { if (drag) { drag = null; keyHome(); } });
  K.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); unlock(); } });
  gate.querySelector('.ig-skip').addEventListener('click', e => { e.stopPropagation(); unlock(true); });
  function unlock(fast) {
    if (done) return; done = true;
    if (fast) { reveal(); setTimeout(finish, 700); return; }
    // 1) la clé va dans la serrure
    // (calculé depuis la place de départ de la clé, sans tenir compte de là où le doigt l'a lâchée)
    const hx = L.offsetLeft + L.offsetWidth * .5, hy = L.offsetTop + L.offsetHeight * .68;
    const dx = hx - (K.offsetLeft + K.offsetWidth * .86), dy = hy - (K.offsetTop + K.offsetHeight / 2);
    K.style.transition = 'transform .7s cubic-bezier(.25,.8,.3,1)'; K.style.transform = `translate(${dx}px, ${dy}px) rotate(0deg)`; gate.classList.add('ig-go');
    // 2) elle tourne : clic !
    setTimeout(() => { K.style.transition = 'transform .7s ease-in-out'; K.style.transformOrigin = '86% 50%'; K.style.transform = `translate(${dx}px, ${dy}px) rotateX(48deg) scale(1.05)`; }, 800);
    setTimeout(() => { snd(1400, 700, .05); setTimeout(() => snd(900, 500, .06), 90); gate.classList.add('ig-click'); }, 1450);
    // 3) le cadenas s'ouvre et tombe
    setTimeout(() => gate.classList.add('ig-drop'), 1900);
    setTimeout(() => snd(180, 60, .25, 'triangle', .3), 2600);
    // 4) les deux battants s'ouvrent, la lumière entre
    setTimeout(() => { gate.classList.add('ig-open'); creak(); }, 2500);
    // 5) … et le formulaire apparaît
    setTimeout(reveal, 4700);
    setTimeout(finish, 5600);
  }
  function reveal() { card.classList.remove('gated'); card.classList.add('bg-revealed'); gate.classList.add('ig-out'); setTimeout(() => card.classList.remove('bg-revealed'), 1300); }
  function finish() { gate.remove(); card.querySelector('form:not(.hidden) input:not([type=hidden])')?.focus({ preventScroll: true }); }
  // le bouton « Rejoins-nous » en bas de la page ouvre la porte directement
  document.querySelectorAll('a[href="#authCard"]').forEach(a => a.addEventListener('click', () => setTimeout(() => unlock(), 600)));
  window.IslandGate = { open: unlock };
})();
