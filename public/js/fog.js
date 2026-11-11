// The Paradise — le brouillard magique quand on change de salon 🌫️✨
// Un nuage de fumée tourbillonne dans la couleur néon du salon, recouvre l'écran, puis se dissipe sur le nouveau salon.
const RoomFog = (() => {
  const COLORS = {
    general: ['#ff2d55'], rencontres: ['#ff4fd8'], '18-25': ['#2fa8ff'], '25-40': ['#2fa8ff'], '40-plus': ['#2fa8ff'],
    amitie: ['#2bff88'], gaming: ['#b8c0d0'], musique: ['#ff8a1f'], karaoke: ['#ff8a1f'], tv: ['#5b5b78'], douane: ['#f4f4ff'], patchnote: ['#7a5cff'],
    roue: ['#ffc94d'], blindtest: ['#ffc94d'], sommet: ['#ffc94d'], paroles: ['#ffc94d'], motdor: ['#ffc94d'],
    membres: ['#ff2d55', '#ff9500', '#ffe600', '#34ff6a', '#2fa8ff', '#c64dff'], fierte: ['#ff2d55', '#ff9500', '#ffe600', '#34ff6a', '#2fa8ff', '#c64dff'],
  };
  const DEFAULT = ['#a07bff'];
  const sprites = new Map();
  // Une « bouffée » de fumée douce, dessinée une seule fois par couleur
  function puff(color) {
    if (sprites.has(color)) return sprites.get(color);
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    for (let i = 0; i < 7; i++) {
      const x = 128 + Math.cos(i * 1.9) * 38 * Math.random(), y = 128 + Math.sin(i * 2.3) * 38 * Math.random(), r = 70 + Math.random() * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const col = i % 3 === 0 ? shade(color, .45) : color; // des nuances plus sombres pour que la fumée ait du relief
      gr.addColorStop(0, hexA(col, .5)); gr.addColorStop(.5, hexA(col, .22)); gr.addColorStop(1, hexA(col, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // un cœur plus clair pour l'effet « lumineux »
    const w = g.createRadialGradient(128, 128, 0, 128, 128, 60); w.addColorStop(0, 'rgba(255,255,255,.10)'); w.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = w; g.beginPath(); g.arc(128, 128, 60, 0, Math.PI * 2); g.fill();
    sprites.set(color, c);
    return c;
  }
  const shade = (h, k) => { const n = parseInt(h.slice(1), 16); const f = v => Math.round(v * k).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); };
  const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  let running = null;
  function play(slug) {
    if (!LC.fxEnabled() || document.visibilityState !== 'visible') return;
    if (running) running.stop();
    const colors = COLORS[slug] || DEFAULT;
    const cv = document.createElement('canvas');
    cv.className = 'room-fog';
    const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    document.body.append(cv);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
    // Les bouffées partent des bords et tourbillonnent vers le centre
    const n = W < 700 ? 34 : 52;
    const puffs = Array.from({ length: n }, (_, i) => {
      const a = Math.random() * Math.PI * 2;
      return { a, d: R * (1.05 + Math.random() * .35), spin: (Math.random() < .5 ? -1 : 1) * (1.2 + Math.random() * 1.4), size: (W < 700 ? 220 : 320) * (.7 + Math.random() * .8), rot: Math.random() * 6, vr: (Math.random() - .5) * 2, delay: Math.random() * .18, c: colors[i % colors.length], s: puff(colors[i % colors.length]) };
    });
    const sparks = Array.from({ length: W < 700 ? 30 : 50 }, () => ({ a: Math.random() * Math.PI * 2, d: Math.random() * R, sp: .6 + Math.random() * 1.4, z: 1 + Math.random() * 2.5, c: colors[Math.floor(Math.random() * colors.length)] }));
    const IN = .55, OUT = 1, TOTAL = IN + OUT;
    const t0 = performance.now();
    let raf = 0;
    const frame = now => {
      const t = (now - t0) / 1000;
      if (t > TOTAL) return stop();
      raf = requestAnimationFrame(frame);
      ctx.clearRect(0, 0, W, H);
      const inK = Math.min(1, t / IN), outK = t > IN ? (t - IN) / OUT : 0;
      const ease = 1 - Math.pow(1 - inK, 3);
      // un voile de couleur qui assombrit le salon pendant la transition
      ctx.globalAlpha = (ease * .6) * (1 - outK);
      ctx.fillStyle = hexA(shade(colors[0], .35), .75); ctx.fillRect(0, 0, W, H);
      for (const p of puffs) {
        const k = Math.max(0, Math.min(1, (t - p.delay) / IN));
        const e = 1 - Math.pow(1 - k, 3);
        // en arrivant, la fumée tourne vers le centre ; en partant, elle s'étale et s'efface
        const dist = p.d * (1 - e * .78) + outK * R * .55;
        const ang = p.a + p.spin * (e * .9 + outK * .7);
        const x = cx + Math.cos(ang) * dist, y = cy + Math.sin(ang) * dist * .8;
        const sz = p.size * (.7 + e * .5 + outK * .9);
        ctx.globalAlpha = Math.min(1, e * 1.2) * Math.pow(1 - outK, 1.4) * .85;
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot + p.vr * t);
        ctx.drawImage(p.s, -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      }
      // des petites étincelles magiques
      for (const s of sparks) {
        const ang = s.a + t * s.sp * 2, dist = s.d * (1 - ease * .5) + outK * 80;
        ctx.globalAlpha = (.4 + .6 * Math.abs(Math.sin(t * 9 + s.a * 5))) * ease * (1 - outK);
        ctx.fillStyle = '#ffffff'; ctx.shadowColor = s.c; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist * .8, s.z, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    };
    function stop() { cancelAnimationFrame(raf); cv.remove(); if (running?.cv === cv) running = null; }
    running = { cv, stop };
    raf = requestAnimationFrame(frame);
  }
  return { play };
})();
window.RoomFog = RoomFog;
