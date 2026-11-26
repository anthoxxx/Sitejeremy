// The Paradise — 🍾 « La bouteille à la mer » : avant de s'inscrire ou de se connecter, on touche la bouteille qui flotte près de l'île,
// le bouchon saute, et le parchemin qui en sort se déroule… et devient le formulaire.
(() => {
  const card = document.getElementById('authCard'); if (!card) return;
  const q = new URLSearchParams(location.search);
  // pas d'animation quand on revient d'un lien « mot de passe oublié », de Google, ou si l'appareil demande moins d'animations
  if (q.get('reset') || q.get('google') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const svg = `
  <svg class="bg-scene" viewBox="0 0 400 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="bgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1b5e"/><stop offset=".45" stop-color="#c2408f"/><stop offset=".8" stop-color="#ff9a6b"/><stop offset="1" stop-color="#ffd59a"/></linearGradient>
      <radialGradient id="bgSun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6c8"/><stop offset=".5" stop-color="#ffd36b"/><stop offset="1" stop-color="#ffb15a" stop-opacity="0"/></radialGradient>
      <linearGradient id="bgSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fb6d6"/><stop offset="1" stop-color="#14608f"/></linearGradient>
      <linearGradient id="bgSand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7dfa8"/><stop offset="1" stop-color="#e2bd78"/></linearGradient>
      <linearGradient id="bgGlass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f8f5e" stop-opacity=".75"/><stop offset=".45" stop-color="#8fe3b3" stop-opacity=".55"/><stop offset="1" stop-color="#1f6e45" stop-opacity=".8"/></linearGradient>
    </defs>
    <rect width="400" height="460" fill="url(#bgSky)"/>
    <g class="bg-stars" fill="#fff">${Array.from({ length: 18 }, (_, i) => `<circle cx="${(i * 73) % 400}" cy="${(i * 37) % 120 + 8}" r="${i % 3 ? 1 : 1.6}" style="animation-delay:${(i % 6) * .4}s"/>`).join('')}</g>
    <circle cx="300" cy="205" r="70" fill="url(#bgSun)"/>
    <circle cx="300" cy="205" r="30" fill="#fff1b8"/>
    <!-- l'île au loin -->
    <path d="M40 252 Q90 222 140 250 Z" fill="#3a2a55" opacity=".55"/>
    <path d="M85 236 q4 -24 2 -40" stroke="#3a2a55" stroke-width="3" fill="none" opacity=".55"/>
    <path d="M87 196 q-14 2 -22 12 M87 196 q14 0 22 10 M87 196 q-4 -10 -16 -12" stroke="#3a2a55" stroke-width="3" fill="none" opacity=".55"/>
    <rect y="248" width="400" height="140" fill="url(#bgSea)"/>
    <path d="M230 250 L370 250 L330 300 L270 300 Z" fill="#ffe7a0" opacity=".25"/>
    <g class="bg-wave w1"><path d="M-400 262 q25 -8 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V300 H-400Z" fill="#7fd6ec" opacity=".35"/></g>
    <g class="bg-wave w2"><path d="M-400 290 q30 -10 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 V330 H-400Z" fill="#9fe6f5" opacity=".3"/></g>
    <!-- la plage, le palmier -->
    <path d="M0 360 Q120 330 230 348 T400 340 V460 H0Z" fill="url(#bgSand)"/>
    <path class="bg-foam" d="M0 360 Q120 330 230 348 T400 340" stroke="#fff" stroke-width="4" fill="none" opacity=".7"/>
    <g class="bg-palm" transform="translate(352 352)">
      <path d="M0 0 C -6 -40 -2 -80 -14 -122" stroke="#7a4b26" stroke-width="9" fill="none" stroke-linecap="round"/>
      <path d="M0 0 C -6 -40 -2 -80 -14 -122" stroke="#9c6534" stroke-width="3" fill="none" stroke-dasharray="4 7"/>
      <g fill="#2f9a4a" transform="translate(-14 -122)">
        <path d="M0 0 C -30 -14 -60 -4 -78 18 C -52 4 -28 4 0 0Z"/><path d="M0 0 C 24 -20 56 -16 74 4 C 48 -6 24 -4 0 0Z"/>
        <path d="M0 0 C -14 -30 -42 -42 -66 -36 C -40 -26 -18 -16 0 0Z"/><path d="M0 0 C 10 -32 36 -46 60 -44 C 36 -30 16 -18 0 0Z"/>
        <path d="M0 0 C -8 18 -4 44 8 60 C 2 38 0 18 0 0Z" fill="#257d3b"/>
        <circle cx="-4" cy="6" r="6" fill="#6b3f1f"/><circle cx="6" cy="4" r="6" fill="#5a3418"/>
      </g>
    </g>
    <g fill="#e9b96a" opacity=".8"><circle cx="70" cy="408" r="2"/><circle cx="160" cy="420" r="1.6"/><circle cx="250" cy="400" r="2.2"/><circle cx="310" cy="430" r="1.6"/></g>
    <text x="40" y="424" font-size="22">🐚</text><text x="296" y="446" font-size="18">⭐</text>
  </svg>`;
  const bottle = `
  <svg class="bg-bottle-svg" viewBox="0 0 60 150" aria-hidden="true">
    <rect class="bg-cork" x="22" y="6" width="16" height="18" rx="3" fill="#b07a45" stroke="#7a5128" stroke-width="2"/>
    <path d="M24 22 h12 v18 c0 6 14 12 14 30 v62 c0 8 -6 12 -20 12 c-14 0 -20 -4 -20 -12 v-62 c0 -18 14 -24 14 -30z" fill="url(#bgGlass)" stroke="#1f5e3e" stroke-width="2"/>
    <rect x="18" y="72" width="24" height="48" rx="6" fill="#f6e6c4" stroke="#c9a46a" stroke-width="1.5" transform="rotate(-8 30 96)"/>
    <path d="M20 86 h18 M20 94 h16 M21 102 h18" stroke="#c9a46a" stroke-width="1.5" transform="rotate(-8 30 96)"/>
    <path d="M17 64 q-2 30 0 60" stroke="#fff" stroke-width="3" opacity=".55" fill="none" stroke-linecap="round"/>
  </svg>`;
  const gate = document.createElement('div');
  gate.className = 'bgate';
  gate.innerHTML = svg + `<button type="button" class="bg-bottle" aria-label="Ouvrir la bouteille pour t'inscrire ou te connecter">${bottle}</button>
    <div class="bg-hint">🍾 Touche la bouteille pour entrer sur l'île</div>
    <div class="bg-title">🌴 Un message t'attend…</div>
    <div class="bg-scroll" aria-hidden="true"><div class="bg-scroll-in"><b>Bienvenue au Paradise</b><span>🌴</span></div></div>
    <button type="button" class="bg-skip">Passer ›</button>`;
  card.classList.add('gated'); card.append(gate);
  let done = false, AC = null;
  const pop = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(140, t + .12); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .16); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + .18);
    const n = Math.ceil(AC.sampleRate * .5), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3) * .25; const s = AC.createBufferSource(), f = AC.createBiquadFilter(); s.buffer = b; f.type = 'lowpass'; f.frequency.value = 900; s.connect(f).connect(AC.destination); s.start(t + .05); } catch (e) {} };
  const sparkle = () => { for (let i = 0; i < 14; i++) { const s = document.createElement('i'); s.className = 'bg-spark'; s.textContent = ['✨', '⭐', '💫', '🌺'][i % 4]; s.style.setProperty('--dx', (Math.random() * 220 - 110) + 'px'); s.style.setProperty('--dy', (-60 - Math.random() * 140) + 'px'); s.style.animationDelay = (Math.random() * .15) + 's'; gate.append(s); } };
  function open(fast) {
    if (done) return; done = true;
    try { localStorage.setItem('lc_bottle', '1'); } catch (e) {}
    if (fast) { reveal(); setTimeout(finish, 450); return; }
    gate.classList.add('bg-go');                  // la bouteille arrive sur la plage
    setTimeout(() => { gate.classList.add('bg-pop'); pop(); sparkle(); }, 750);   // le bouchon saute
    setTimeout(() => gate.classList.add('bg-unroll'), 1050);                       // le parchemin se déroule
    setTimeout(reveal, 2050);                                                       // … et devient le formulaire
    setTimeout(finish, 2550);
  }
  // le formulaire apparaît pendant que le parchemin s'efface (pas de moment vide)
  function reveal() { card.classList.remove('gated'); card.classList.add('bg-revealed'); gate.classList.add('bg-out'); setTimeout(() => card.classList.remove('bg-revealed'), 900); }
  function finish() { gate.remove(); card.querySelector('form:not(.hidden) input:not([type=hidden])')?.focus({ preventScroll: true }); }
  gate.querySelector('.bg-bottle').addEventListener('click', () => open(false));
  gate.querySelector('.bg-skip').addEventListener('click', e => { e.stopPropagation(); open(true); });
  // glisser la bouteille vers le haut (vers la plage) l'ouvre aussi
  let y0 = null; gate.addEventListener('pointerdown', e => { y0 = e.clientY; }); gate.addEventListener('pointerup', e => { if (y0 != null && y0 - e.clientY > 40) open(false); y0 = null; });
  // le bouton « Rejoins-nous » en bas de la page ouvre directement la bouteille
  document.querySelectorAll('a[href="#authCard"]').forEach(a => a.addEventListener('click', () => setTimeout(() => open(false), 500)));
  window.BottleGate = { open };
})();
