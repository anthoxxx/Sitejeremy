// The Paradise — la déco des maisons de l'Île 🏡 : meubles réalistes, néons de toutes les couleurs,
// styles de maison (moderne, chalet, plage, château, loft, japonais) avec un étage, et les façades.
const Decor = (() => {
  const NEON = ['#ff2d55', '#ff4fd8', '#c64dff', '#7a5cff', '#2fa8ff', '#38dce6', '#2bff88', '#d4ff3a', '#ffd34d', '#ff8a1f', '#ffffff'];
  const STYLES = {
    cosy: { name: 'Cosy', icon: '🧸' }, moderne: { name: 'Villa moderne', icon: '🏢' }, chalet: { name: 'Chalet', icon: '🏔️' },
    plage: { name: 'Maison de plage', icon: '🏖️' }, chateau: { name: 'Château', icon: '🏰' }, loft: { name: 'Loft néon', icon: '🌃' }, japon: { name: 'Maison japonaise', icon: '🏯' },
  };
  // Les nouveaux meubles (ajoutés à ceux de l'Île). seat = on s'assoit dessus ; lie = on se couche dedans ; soak = on se baigne dedans
  const FURN = {
    chair: { name: 'Chaise', icon: '🪑', w: 58, h: 90, act: 'sit', spot: 'seat' },
    sink: { name: 'Lavabo', icon: '🚰', w: 70, h: 84, act: 'wash', spot: 'front' },
    toilet: { name: 'WC', icon: '🚽', w: 58, h: 78, act: 'sit', spot: 'seat' },
    shower: { name: 'Douche', icon: '🚿', w: 120, h: 160, act: 'shower', spot: 'center' },
    nightstand: { name: 'Table de chevet', icon: '🕯️', w: 60, h: 64 },
    coffee: { name: 'Cafetière', icon: '☕', w: 70, h: 86, act: 'coffee', spot: 'front' },
    wardrobe: { name: 'Armoire', icon: '🚪', w: 130, h: 176, act: 'dress', spot: 'front' },
    mirror: { name: 'Miroir', icon: '🪞', w: 70, h: 150, act: 'mirror', spot: 'front' },
    vanity: { name: 'Coiffeuse', icon: '💄', w: 120, h: 110, act: 'mirror', spot: 'front' },
    neon_coeur: { name: 'Néon cœur', icon: '💗', w: 90, h: 80, neon: true },
    neon_etoile: { name: 'Néon étoile', icon: '⭐', w: 90, h: 90, neon: true },
    neon_love: { name: 'Néon « LOVE »', icon: '💡', w: 170, h: 64, neon: true },
    neon_tube: { name: 'Tube néon', icon: '➖', w: 200, h: 24, neon: true },
    neon_vague: { name: 'Néon vague', icon: '🌊', w: 160, h: 60, neon: true },
    neon_palmier: { name: 'Néon palmier', icon: '🌴', w: 90, h: 120, neon: true },
    neon_lune: { name: 'Néon lune', icon: '🌙', w: 80, h: 90, neon: true },
    neon_eclair: { name: 'Néon éclair', icon: '⚡', w: 60, h: 100, neon: true },
    neon_bouche: { name: 'Néon bisou', icon: '💋', w: 110, h: 64, neon: true },
    neon_cadre: { name: 'Cadre néon', icon: '🔲', w: 160, h: 110, neon: true },
  };
  const roundRect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const shade = (hex, k) => { const n = parseInt(String(hex).slice(1), 16); if (Number.isNaN(n)) return hex; const f = v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0'); return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); };
  const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
  // du bois avec ses veines
  function wood(g, x, y, w, h, base = '#9b6b3e', r = 4) {
    g.fillStyle = lin(g, x, y, x, y + h, [[0, shade(base, 1.15)], [1, shade(base, .82)]]); roundRect(g, x, y, w, h, r); g.fill();
    g.save(); roundRect(g, x, y, w, h, r); g.clip(); g.strokeStyle = 'rgba(60,30,10,.18)'; g.lineWidth = 1;
    for (let i = 0; i < Math.max(2, h / 7); i++) { g.beginPath(); const yy = y + 4 + i * 7; g.moveTo(x, yy); g.bezierCurveTo(x + w * .3, yy + 2, x + w * .6, yy - 2, x + w, yy + 1); g.stroke(); }
    g.restore();
  }
  // tissu rembourré
  function cushion(g, x, y, w, h, col, r = 10) {
    g.fillStyle = lin(g, x, y, x, y + h, [[0, shade(col, 1.18)], [.6, col], [1, shade(col, .78)]]); roundRect(g, x, y, w, h, r); g.fill();
    g.fillStyle = 'rgba(255,255,255,.14)'; roundRect(g, x + 4, y + 3, w - 8, Math.min(8, h / 3), r / 2); g.fill();
  }
  const metal = (g, x, y, w, h, r = 6) => { g.fillStyle = lin(g, x, y, x + w, y, [[0, '#9aa3b2'], [.35, '#eef1f6'], [.6, '#c3cad6'], [1, '#7d8594']]); roundRect(g, x, y, w, h, r); g.fill(); };
  function glowNeon(g, col, t, path, width = 5) {
    const flick = Math.sin(t * 23 + col.length) > .985 ? .35 : 1;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    g.globalAlpha = flick; g.shadowColor = col; g.shadowBlur = 22; g.strokeStyle = col; g.lineWidth = width + 4; path(); g.stroke();
    g.shadowBlur = 8; g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1.5, width - 3); path(); g.stroke();
    g.restore();
  }

  // ---------- Les meubles réalistes ----------
  // f = { t, x, y, c (couleur du néon) }, d = définition, A = couleur de la déco. Renvoie true si le meuble a été dessiné.
  function draw(g, f, d, t, A, night) {
    const w = d.w, h = d.h;
    switch (f.t) {
      case 'sofa': {
        g.fillStyle = '#3a2a1e'; for (const x of [-w / 2 + 16, w / 2 - 22]) g.fillRect(x, h / 2 - 6, 6, 8);
        cushion(g, -w / 2 + 16, -h / 2, w - 32, 44, shade(A, .85), 14); // dossier
        for (let i = 0; i < 3; i++) cushion(g, -w / 2 + 30 + i * (w - 60) / 3, -h / 2 + 34, (w - 60) / 3 - 3, 34, A, 9); // assises
        cushion(g, -w / 2, -h / 2 + 14, 32, h - 18, shade(A, .92), 14); cushion(g, w / 2 - 32, -h / 2 + 14, 32, h - 18, shade(A, .92), 14); // accoudoirs
        cushion(g, -w / 2 + 38, -h / 2 + 8, 44, 34, '#fff3d6', 10); cushion(g, w / 2 - 82, -h / 2 + 8, 44, 34, shade(A, 1.4), 10); // coussins
        return true;
      }
      case 'armchair': case 'throne': {
        const c = f.t === 'throne' ? '#b01e3a' : A;
        if (f.t === 'throne') { g.fillStyle = lin(g, 0, -h / 2, 0, h / 2, [[0, '#ffe08a'], [1, '#b8860b']]); roundRect(g, -w / 2, -h / 2 - 14, w, h + 10, 18); g.fill(); g.fillStyle = '#ffd34d'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-30 + i * 30 - 10, -h / 2 - 12); g.lineTo(-30 + i * 30, -h / 2 - 34); g.lineTo(-30 + i * 30 + 10, -h / 2 - 12); g.fill(); } g.fillStyle = '#38dce6'; g.beginPath(); g.arc(0, -h / 2 - 2, 6, 0, 7); g.fill(); }
        cushion(g, -w / 2 + 10, -h / 2, w - 20, h * .55, shade(c, .85), 16);
        cushion(g, -w / 2 + 12, -h / 2 + h * .42, w - 24, h * .4, c, 10);
        cushion(g, -w / 2, -h / 2 + 16, 18, h - 22, shade(c, .92), 9); cushion(g, w / 2 - 18, -h / 2 + 16, 18, h - 22, shade(c, .92), 9);
        g.fillStyle = '#3a2a1e'; g.fillRect(-w / 2 + 6, h / 2 - 6, 5, 7); g.fillRect(w / 2 - 11, h / 2 - 6, 5, 7);
        return true;
      }
      case 'chair': {
        g.fillStyle = '#6b4423'; for (const x of [-w / 2 + 4, w / 2 - 9]) { g.fillRect(x, -h / 2, 5, h); }
        for (let i = 0; i < 3; i++) wood(g, -w / 2 + 4, -h / 2 + 6 + i * 12, w - 8, 6, '#8a5a2b', 2);
        wood(g, -w / 2, h * .05, w, 12, '#9b6b3e', 3); cushion(g, -w / 2 + 3, h * .05 - 6, w - 6, 9, A, 4);
        g.fillStyle = '#5a3a1c'; g.fillRect(-w / 2 + 3, h * .05 + 12, 5, h / 2 - h * .05 - 12); g.fillRect(w / 2 - 8, h * .05 + 12, 5, h / 2 - h * .05 - 12);
        return true;
      }
      case 'table': {
        g.fillStyle = '#5a3a1c'; for (const x of [-w / 2 + 12, w / 2 - 20]) g.fillRect(x, -4, 8, h / 2 + 4);
        g.fillStyle = lin(g, 0, -h / 2, 0, 0, [[0, '#c08a5a'], [1, '#8a5a2b']]); g.beginPath(); g.moveTo(-w / 2 + 14, -h / 2); g.lineTo(w / 2 - 14, -h / 2); g.lineTo(w / 2, -2); g.lineTo(-w / 2, -2); g.closePath(); g.fill();
        wood(g, -w / 2, -4, w, 9, '#7a4f2b', 2);
        g.fillStyle = '#ffffff'; for (const x of [-42, 42]) { g.beginPath(); g.ellipse(x, -h / 4, 16, 6, 0, 0, 7); g.fill(); g.strokeStyle = '#d8dde6'; g.lineWidth = 1.5; g.stroke(); }
        g.fillStyle = 'rgba(180,220,255,.75)'; roundRect(g, -6, -h / 4 - 24, 12, 22, 4); g.fill(); g.fillStyle = '#ff5fa2'; g.beginPath(); g.arc(-2, -h / 4 - 28, 5, 0, 7); g.arc(4, -h / 4 - 30, 5, 0, 7); g.fill(); g.fillStyle = '#2e9d57'; g.fillRect(-1, -h / 4 - 26, 2, 6);
        return true;
      }
      case 'bed': {
        wood(g, -w / 2, -h / 2 - 22, w, 40, '#7a4f2b', 10); // tête de lit
        g.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-w / 2 + 30 + i * (w - 60) / 3, -h / 2 - 4, 3, 0, 7); g.fill(); }
        g.fillStyle = lin(g, 0, -h / 2, 0, h / 2, [[0, '#ffffff'], [1, '#e6e9f0']]); roundRect(g, -w / 2 + 6, -h / 2 + 4, w - 12, h - 12, 10); g.fill(); // matelas
        cushion(g, -w / 2 + 16, -h / 2 + 10, w / 2 - 22, 30, '#ffffff', 12); cushion(g, 6, -h / 2 + 10, w / 2 - 22, 30, '#ffffff', 12); // oreillers
        g.fillStyle = lin(g, 0, -h / 2 + 46, 0, h / 2, [[0, shade(A, 1.1)], [1, shade(A, .8)]]); roundRect(g, -w / 2 + 4, -h / 2 + 46, w - 8, h - 50, 10); g.fill(); // couette
        g.fillStyle = shade(A, 1.35); roundRect(g, -w / 2 + 4, -h / 2 + 46, w - 8, 14, 7); g.fill(); // le drap replié
        g.strokeStyle = 'rgba(0,0,0,.1)'; g.lineWidth = 2; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-w / 2 + 10, -h / 2 + 60 + i * 22); g.quadraticCurveTo(0, -h / 2 + 66 + i * 22, w / 2 - 10, -h / 2 + 58 + i * 22); g.stroke(); }
        wood(g, -w / 2, h / 2 - 12, w, 14, '#6b4423', 5); // pied de lit
        return true;
      }
      case 'nightstand': {
        wood(g, -w / 2, -h / 2 + 18, w, h - 18, '#8a5a2b', 5); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(-w / 2 + 6, -h / 2 + 36, w - 12, 2); g.fillStyle = '#ffd34d'; g.fillRect(-4, -h / 2 + 28, 8, 3); g.fillRect(-4, -h / 2 + 46, 8, 3);
        const on = .3 + night * .6; g.fillStyle = `rgba(255,230,160,${on * .5})`; g.beginPath(); g.arc(0, -h / 2 - 2, 26, 0, 7); g.fill();
        g.fillStyle = '#c0c6cc'; g.fillRect(-2, -h / 2 + 4, 4, 14); g.fillStyle = lin(g, 0, -h / 2 - 12, 0, -h / 2 + 4, [[0, '#fff3d6'], [1, '#f0c27a']]); g.beginPath(); g.moveTo(-14, -h / 2 + 4); g.lineTo(14, -h / 2 + 4); g.lineTo(9, -h / 2 - 12); g.lineTo(-9, -h / 2 - 12); g.closePath(); g.fill();
        return true;
      }
      case 'kitchen': {
        g.fillStyle = '#f2f4f8'; g.fillRect(-w / 2, -h / 2 - 40, w, 40); g.strokeStyle = 'rgba(0,0,0,.08)'; for (let x = -w / 2; x < w / 2; x += 16) for (let y = -h / 2 - 40; y < -h / 2; y += 10) g.strokeRect(x + ((y / 10) % 2 ? 8 : 0), y, 16, 10); // carrelage
        wood(g, -w / 2, -h / 2 + 10, w, h - 10, '#efe6d8', 4);
        for (let i = 0; i < 3; i++) { g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2; g.strokeRect(-w / 2 + 6 + i * (w - 12) / 3, -h / 2 + 18, (w - 12) / 3 - 6, h - 28); g.fillStyle = '#9aa3b2'; g.fillRect(-w / 2 + (i + .5) * (w - 12) / 3, -h / 2 + 26, 10, 3); }
        g.fillStyle = lin(g, 0, -h / 2, 0, -h / 2 + 12, [[0, '#4a4a56'], [1, '#2a2a32']]); g.fillRect(-w / 2 - 4, -h / 2, w + 8, 12); // plan de travail
        for (const bx of [-w / 2 + 34, -w / 2 + 72]) { g.fillStyle = '#111'; g.beginPath(); g.ellipse(bx, -h / 2 + 5, 14, 4, 0, 0, 7); g.fill(); g.strokeStyle = `rgba(255,90,40,${.4 + .4 * Math.abs(Math.sin(t * 2 + bx))})`; g.lineWidth = 2; g.beginPath(); g.ellipse(bx, -h / 2 + 5, 10, 2.6, 0, 0, 7); g.stroke(); }
        g.fillStyle = '#c3cad6'; roundRect(g, w / 2 - 70, -h / 2 + 1, 46, 9, 3); g.fill(); metal(g, w / 2 - 50, -h / 2 - 22, 5, 22, 2); metal(g, w / 2 - 58, -h / 2 - 24, 18, 5, 2);
        return true;
      }
      case 'fridge': {
        metal(g, -w / 2, -h / 2, w, h, 10); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-w / 2, -h / 2 + 62, w, 3);
        g.fillStyle = '#5c6470'; roundRect(g, -w / 2 + 8, -h / 2 + 18, 5, 34, 2); g.fill(); roundRect(g, -w / 2 + 8, -h / 2 + 78, 5, 46, 2); g.fill();
        g.font = '14px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.fillText('🍓', 12, -h / 2 + 30); g.fillText('⭐', 22, -h / 2 + 100); g.fillText('📸', 4, -h / 2 + 120);
        return true;
      }
      case 'coffee': {
        g.fillStyle = '#2a2a32'; roundRect(g, -w / 2, -h / 2, w, h, 8); g.fill(); metal(g, -w / 2 + 4, -h / 2 + 4, w - 8, 22, 5);
        g.fillStyle = '#111'; g.fillRect(-w / 2 + 8, -h / 2 + 30, w - 16, 34); metal(g, -14, -h / 2 + 30, 28, 8, 3); g.fillStyle = '#1c1c24'; g.fillRect(-20, -h / 2 + 36, 18, 5);
        g.fillStyle = '#ffffff'; roundRect(g, -9, h / 2 - 24, 18, 14, 3); g.fill(); g.fillStyle = '#6b3a1c'; g.fillRect(-7, h / 2 - 22, 14, 3);
        if (Math.sin(t * 2) > 0) { g.strokeStyle = '#6b3a1c'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -h / 2 + 40); g.lineTo(0, h / 2 - 24); g.stroke(); }
        for (let i = 0; i < 3; i++) { const k = (t * .8 + i / 3) % 1; g.globalAlpha = .5 * (1 - k); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(Math.sin(t * 3 + i) * 4, h / 2 - 28 - k * 30, 3 + k * 3, 0, 7); g.fill(); } g.globalAlpha = 1;
        g.fillStyle = Math.sin(t * 4) > 0 ? '#2bff88' : '#0f5a30'; g.beginPath(); g.arc(w / 2 - 10, -h / 2 + 15, 3, 0, 7); g.fill(); g.fillStyle = '#ff2d55'; g.beginPath(); g.arc(w / 2 - 20, -h / 2 + 15, 3, 0, 7); g.fill();
        return true;
      }
      case 'wardrobe': {
        wood(g, -w / 2, -h / 2, w, h, '#8a5a2b', 6); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-1, -h / 2 + 6, 2, h - 12);
        for (const s of [-1, 1]) { g.strokeStyle = 'rgba(60,30,10,.35)'; g.lineWidth = 2; g.strokeRect(s < 0 ? -w / 2 + 8 : 6, -h / 2 + 10, w / 2 - 14, h - 24); g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(s * 8, 0, 3.5, 0, 7); g.fill(); }
        g.fillStyle = lin(g, 6, -h / 2 + 16, w / 2 - 10, h / 2 - 20, [[0, '#d8f0ff'], [.5, '#a8c8e8'], [1, '#e8f6ff']]); g.fillRect(12, -h / 2 + 16, w / 2 - 26, h - 36);
        return true;
      }
      case 'mirror': {
        g.fillStyle = lin(g, 0, -h / 2, 0, h / 2, [[0, '#ffe08a'], [1, '#b8860b']]); g.beginPath(); g.ellipse(0, -6, w / 2, h / 2 - 6, 0, 0, 7); g.fill();
        g.fillStyle = lin(g, -w / 2, -h / 2, w / 2, h / 2, [[0, '#e8f6ff'], [.45, '#a8c8e8'], [.55, '#ffffff'], [1, '#bcd8f0']]); g.beginPath(); g.ellipse(0, -6, w / 2 - 7, h / 2 - 13, 0, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(-10, -30, 5, 26, -.3, 0, 7); g.fill();
        g.fillStyle = '#8a6a20'; g.fillRect(-14, h / 2 - 10, 28, 10);
        return true;
      }
      case 'vanity': {
        wood(g, -w / 2, -6, w, h / 2 + 6, '#f2e6f0', 6); g.fillStyle = '#ffd34d'; g.fillRect(-w / 4 - 6, 14, 12, 3); g.fillRect(w / 4 - 6, 14, 12, 3);
        g.fillStyle = '#ffffff'; roundRect(g, -w / 2 + 14, -h / 2, w - 28, h / 2, 30); g.fill(); g.fillStyle = lin(g, 0, -h / 2, 0, 0, [[0, '#e8f6ff'], [1, '#bcd8f0']]); roundRect(g, -w / 2 + 20, -h / 2 + 6, w - 40, h / 2 - 12, 24); g.fill();
        for (let i = 0; i < 7; i++) { const a = Math.PI + i * Math.PI / 6; g.fillStyle = '#fff6c0'; g.shadowColor = '#ffd76a'; g.shadowBlur = 8; g.beginPath(); g.arc(Math.cos(a) * (w / 2 - 14), -h / 4 + Math.sin(a) * (h / 4 + 2), 3.5, 0, 7); g.fill(); } g.shadowBlur = 0;
        g.font = '16px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.fillText('💄', -20, -10); g.fillText('🌸', 22, -10);
        return true;
      }
      case 'lamp': {
        g.fillStyle = `rgba(255,232,170,${.18 + night * .45})`; g.beginPath(); g.arc(0, -h / 2 + 6, 64, 0, 7); g.fill();
        metal(g, -3, -h / 2 + 22, 6, h - 30, 2); g.fillStyle = '#2a2a32'; g.beginPath(); g.ellipse(0, h / 2 - 4, 16, 5, 0, 0, 7); g.fill();
        g.fillStyle = lin(g, 0, -h / 2 - 4, 0, -h / 2 + 24, [[0, '#fff3d6'], [1, '#f0c27a']]); g.beginPath(); g.moveTo(-22, -h / 2 + 24); g.lineTo(22, -h / 2 + 24); g.lineTo(13, -h / 2 - 4); g.lineTo(-13, -h / 2 - 4); g.closePath(); g.fill();
        return true;
      }
      case 'shelf': {
        wood(g, -w / 2, -h / 2, w, h, '#6b4423', 4);
        const cols = ['#c21e3a', '#2f4f8f', '#2e9d57', '#d99a00', '#7a2cb8', '#e07a5f', '#1d7ea8'];
        for (let r = 0; r < 3; r++) {
          const y0 = -h / 2 + 8 + r * 47; g.fillStyle = '#3a2410'; g.fillRect(-w / 2 + 6, y0, w - 12, 40);
          let x = -w / 2 + 8; let k = r * 3;
          while (x < w / 2 - 14) { const bw = 7 + (k * 7) % 6, bh = 26 + (k * 13) % 12; g.fillStyle = cols[k % cols.length]; g.fillRect(x, y0 + 40 - bh, bw, bh); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 1, y0 + 44 - bh, bw - 2, 2); x += bw + 1; k++; if (k % 9 === 4) x += 6; }
          wood(g, -w / 2 + 2, y0 + 40, w - 4, 6, '#8a5a2b', 1);
        }
        return true;
      }
      case 'desk': {
        wood(g, -w / 2, -h / 2, w, 16, '#9b6b3e', 4); wood(g, -w / 2 + 4, -h / 2 + 16, 46, h - 16, '#8a5a2b', 3); g.fillStyle = '#5a3a1c'; g.fillRect(w / 2 - 12, -h / 2 + 16, 8, h - 16);
        g.fillStyle = '#2a2a32'; roundRect(g, -8, -h / 2 - 40, 56, 38, 4); g.fill(); g.fillStyle = lin(g, 0, -h / 2 - 36, 0, -h / 2 - 6, [[0, '#4fb3ff'], [1, '#8b5cf6']]); g.fillRect(-4, -h / 2 - 36, 48, 30); g.fillStyle = '#c3cad6'; g.fillRect(-14, -h / 2 - 2, 68, 4);
        g.fillStyle = '#ffffff'; g.font = '12px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.fillText('🏝️', 20, -h / 2 - 16);
        return true;
      }
      case 'bath': case 'jacuzzi': {
        if (f.t === 'bath') {
          g.fillStyle = '#ffd34d'; for (const x of [-w / 2 + 16, w / 2 - 22]) { g.beginPath(); g.arc(x + 3, h / 2 - 2, 6, 0, 7); g.fill(); }
          g.fillStyle = lin(g, 0, -h / 2, 0, h / 2, [[0, '#ffffff'], [1, '#dfe4ec']]); roundRect(g, -w / 2, -h / 2, w, h - 4, 40); g.fill();
          g.fillStyle = lin(g, 0, -h / 2 + 10, 0, h / 2, [[0, '#9fe0ff'], [1, '#4fb3ff']]); roundRect(g, -w / 2 + 10, -h / 2 + 10, w - 20, h - 26, 30); g.fill();
          metal(g, -w / 2 + 8, -h / 2 - 18, 6, 22, 2); metal(g, -w / 2 + 8, -h / 2 - 20, 24, 6, 2);
        } else {
          g.fillStyle = '#e8e8ee'; g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, 7); g.fill(); g.fillStyle = lin(g, 0, -h / 2, 0, h / 2, [[0, '#7fe8ff'], [1, '#1fa0e0']]); g.beginPath(); g.ellipse(0, 0, w / 2 - 14, h / 2 - 14, 0, 0, 7); g.fill();
          g.strokeStyle = '#38dce6'; g.shadowColor = '#38dce6'; g.shadowBlur = 12; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, w / 2 - 6, h / 2 - 6, 0, 0, 7); g.stroke(); g.shadowBlur = 0;
        }
        g.fillStyle = 'rgba(255,255,255,.92)'; for (let i = 0; i < 12; i++) { const a = i * 2.4 + t * 1.5; g.beginPath(); g.arc(Math.cos(a) * w * .3 * ((i % 3) / 3 + .4), Math.sin(a) * h * .22 * ((i % 3) / 3 + .4), 5 + Math.abs(Math.sin(t * 3 + i)) * 5, 0, 7); g.fill(); }
        return true;
      }
      case 'sink': {
        wood(g, -w / 2, -6, w, h / 2 + 6, '#efe6d8', 4); g.fillStyle = '#9aa3b2'; g.fillRect(-4, 10, 8, 3);
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, -10, w / 2 - 2, 14, 0, 0, 7); g.fill(); g.fillStyle = '#cfe9ff'; g.beginPath(); g.ellipse(0, -10, w / 2 - 10, 9, 0, 0, 7); g.fill();
        metal(g, -3, -34, 6, 20, 2); metal(g, -3, -36, 16, 5, 2);
        g.fillStyle = lin(g, 0, -h / 2 - 30, 0, -h / 2, [[0, '#e8f6ff'], [1, '#bcd8f0']]); roundRect(g, -w / 2 + 6, -h / 2 - 34, w - 12, 36, 8); g.fill(); g.strokeStyle = '#c0c6cc'; g.lineWidth = 3; g.stroke();
        return true;
      }
      case 'toilet': {
        g.fillStyle = lin(g, 0, -h / 2, 0, h / 2, [[0, '#ffffff'], [1, '#dfe4ec']]); roundRect(g, -w / 2 + 4, -h / 2, w - 8, 26, 6); g.fill();
        g.beginPath(); g.ellipse(0, 10, w / 2, h / 2 - 12, 0, 0, 7); g.fill(); g.fillStyle = '#e6ebf2'; g.beginPath(); g.ellipse(0, 12, w / 2 - 8, h / 2 - 22, 0, 0, 7); g.fill();
        g.fillStyle = '#c0c6cc'; g.fillRect(w / 2 - 16, -h / 2 + 8, 8, 4);
        return true;
      }
      case 'shower': {
        g.fillStyle = '#e8eef5'; g.fillRect(-w / 2, -h / 2, w, h); g.strokeStyle = 'rgba(0,0,0,.06)'; g.lineWidth = 1; for (let x = -w / 2; x < w / 2; x += 20) for (let y = -h / 2; y < h / 2; y += 20) g.strokeRect(x, y, 20, 20);
        g.fillStyle = 'rgba(160,220,255,.28)'; g.fillRect(-w / 2, -h / 2, w, h); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4; g.strokeRect(-w / 2, -h / 2, w, h);
        g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-w / 2 + 14, -h / 2 + 10); g.lineTo(-w / 2 + 34, -h / 2 + 50); g.stroke();
        metal(g, -6, -h / 2 + 2, 12, 10, 4); g.fillStyle = '#9aa3b2'; g.beginPath(); g.arc(0, h / 2 - 16, 6, 0, 7); g.fill();
        return true;
      }
      case 'plant': {
        g.fillStyle = lin(g, -16, 0, 16, 0, [[0, '#b5562b'], [.5, '#e07a4f'], [1, '#a04a22']]); g.beginPath(); g.moveTo(-18, 2); g.lineTo(18, 2); g.lineTo(13, h / 2); g.lineTo(-13, h / 2); g.closePath(); g.fill(); g.fillStyle = '#8a3a18'; g.fillRect(-19, 0, 38, 5);
        const sway = Math.sin(t * 1.5 + f.x) * .06;
        for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .42 + sway; g.save(); g.rotate(a + Math.PI / 2); g.fillStyle = i % 2 ? '#2e9d57' : '#3cb96a'; g.beginPath(); g.ellipse(0, -26, 9, 22, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,60,20,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -46); g.stroke(); g.restore(); }
        return true;
      }
    }
    if (d.neon) { drawNeon(g, f, d, t); return true; }
    return false;
  }
  function drawNeon(g, f, d, t) {
    const c = /^#[0-9a-f]{6}$/i.test(f.c || '') ? f.c : NEON[(f.x + f.y) % NEON.length | 0] || '#ff4fd8';
    const w = d.w, h = d.h;
    // la lueur sur le mur
    const halo = g.createRadialGradient(0, 0, 4, 0, 0, Math.max(w, h)); halo.addColorStop(0, c + '55'); halo.addColorStop(1, c + '00'); g.fillStyle = halo; g.beginPath(); g.arc(0, 0, Math.max(w, h), 0, 7); g.fill();
    const P = {
      neon_coeur: () => { g.beginPath(); g.moveTo(0, h / 2 - 8); g.bezierCurveTo(-w / 2 - 10, 0, -w / 2 + 6, -h / 2 - 10, 0, -h / 2 + 18); g.bezierCurveTo(w / 2 - 6, -h / 2 - 10, w / 2 + 10, 0, 0, h / 2 - 8); },
      neon_etoile: () => { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? w * .2 : w * .48, a = -Math.PI / 2 + i * Math.PI / 5; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); },
      neon_tube: () => { g.beginPath(); g.moveTo(-w / 2 + 6, 0); g.lineTo(w / 2 - 6, 0); },
      neon_vague: () => { g.beginPath(); for (let x = -w / 2 + 6; x <= w / 2 - 6; x += 4) { const y = Math.sin(x / 14 + t * 2) * h * .25; x === -w / 2 + 6 ? g.moveTo(x, y) : g.lineTo(x, y); } },
      neon_palmier: () => { g.beginPath(); g.moveTo(4, h / 2 - 4); g.quadraticCurveTo(-6, 0, 2, -h / 4); for (let i = 0; i < 5; i++) { const a = -Math.PI * .95 + i * Math.PI * .24; g.moveTo(2, -h / 4); g.quadraticCurveTo(2 + Math.cos(a) * 20, -h / 4 + Math.sin(a) * 30 - 6, 2 + Math.cos(a) * 40, -h / 4 + Math.sin(a) * 22 + 12); } },
      neon_lune: () => { g.beginPath(); g.arc(0, 0, w * .45, Math.PI * .3, Math.PI * 1.7); g.arc(w * .18, -2, w * .34, Math.PI * 1.55, Math.PI * .45, true); },
      neon_eclair: () => { g.beginPath(); g.moveTo(8, -h / 2 + 4); g.lineTo(-14, 4); g.lineTo(2, 4); g.lineTo(-8, h / 2 - 4); g.lineTo(16, -8); g.lineTo(0, -8); g.closePath(); },
      neon_bouche: () => { g.beginPath(); g.moveTo(-w / 2 + 8, 0); g.quadraticCurveTo(-w / 4, -h / 2 + 4, 0, -6); g.quadraticCurveTo(w / 4, -h / 2 + 4, w / 2 - 8, 0); g.quadraticCurveTo(0, h / 2 + 4, -w / 2 + 8, 0); g.moveTo(-w / 2 + 12, 0); g.quadraticCurveTo(0, 8, w / 2 - 12, 0); },
      neon_cadre: () => { roundRect(g, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 12); },
    };
    if (f.t === 'neon_love') {
      g.save(); g.font = `italic 900 ${h * .78}px "Brush Script MT", Outfit, cursive`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      const flick = Math.sin(t * 23) > .985 ? .35 : 1; g.globalAlpha = flick; g.shadowColor = c; g.shadowBlur = 24; g.strokeStyle = c; g.lineWidth = 6; g.strokeText('Love', 0, 2); g.shadowBlur = 8; g.fillStyle = '#ffffff'; g.fillText('Love', 0, 2); g.restore();
      return;
    }
    glowNeon(g, c, t + f.x, P[f.t] || P.neon_cadre, f.t === 'neon_tube' ? 8 : 5);
  }

  // ---------- Les pièces de la maison selon le style ----------
  function room(g, t, hs, floor, night, mix) {
    const st = STYLES[hs.style] ? hs.style : 'cosy', A = hs.accent;
    const W = 1100, H = 720;
    // le mur
    const WALL = { cosy: hs.wall, moderne: '#eef1f6', chalet: '#b57a45', plage: '#dff4fb', chateau: '#c9c2b4', loft: '#3a3a44', japon: '#f4ead2' }[st];
    g.fillStyle = WALL; g.fillRect(0, 0, W, 250);
    if (st === 'chalet') { for (let y = 0; y < 250; y += 26) { wood(g, 0, y, W, 24, '#a86b3a', 2); } }
    if (st === 'chateau') { g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2; for (let y = 0; y < 250; y += 30) for (let x = (y / 30) % 2 ? -40 : 0; x < W; x += 80) g.strokeRect(x, y, 80, 30); g.fillStyle = '#7a0d22'; for (const x of [140, 960]) { g.fillRect(x - 40, 10, 80, 150); g.fillStyle = '#ffd34d'; g.fillRect(x - 40, 150, 80, 8); g.fillStyle = '#7a0d22'; } }
    if (st === 'loft') { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; for (let y = 0; y < 250; y += 22) for (let x = (y / 22) % 2 ? -30 : 0; x < W; x += 60) g.strokeRect(x, y, 60, 22); g.fillStyle = 'rgba(120,60,40,.35)'; g.fillRect(0, 0, W, 250); }
    if (st === 'plage') { g.fillStyle = 'rgba(47,168,255,.18)'; for (let x = 0; x < W; x += 60) g.fillRect(x, 0, 30, 250); g.font = '22px "Noto Color Emoji", sans-serif'; g.fillText('🐚', 60, 220); g.fillText('⭐', 1040, 40); }
    if (st === 'japon') { g.strokeStyle = '#6b4423'; g.lineWidth = 4; for (let x = 0; x <= W; x += 110) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 250); g.stroke(); } g.lineWidth = 1.5; for (let x = 0; x < W; x += 27.5) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 250); g.stroke(); } for (let y = 0; y < 250; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
    if (st === 'moderne') { g.fillStyle = A; g.fillRect(0, 0, 360, 250); }
    // la fenêtre (le ciel suit l'heure)
    const sky = mix('#8fd8ff', '#0b1640', night);
    if (st === 'moderne' || st === 'loft') { g.fillStyle = sky; g.fillRect(480, 30, 380, 180); g.strokeStyle = st === 'loft' ? '#1c1c24' : '#ffffff'; g.lineWidth = 6; g.strokeRect(480, 30, 380, 180); for (let x = 1; x < 4; x++) { g.beginPath(); g.moveTo(480 + x * 95, 30); g.lineTo(480 + x * 95, 210); g.stroke(); } if (night > .4) { g.fillStyle = '#ffd76a'; for (let i = 0; i < 18; i++) g.fillRect(490 + (i * 53) % 360, 120 + (i * 37) % 80, 6, 8); } }
    else if (st === 'chateau') { g.fillStyle = sky; g.beginPath(); g.moveTo(520, 210); g.lineTo(520, 90); g.arc(610, 90, 90, Math.PI, 0); g.lineTo(700, 210); g.closePath(); g.fill(); g.strokeStyle = '#7a6a50'; g.lineWidth = 8; g.stroke(); }
    else if (st === 'plage') { g.fillStyle = sky; g.beginPath(); g.arc(610, 110, 70, 0, 7); g.fill(); g.fillStyle = mix('#1fb7d6', '#08243f', night); g.beginPath(); g.arc(610, 110, 70, .2, Math.PI - .2); g.fill(); g.strokeStyle = '#c0c6cc'; g.lineWidth = 12; g.beginPath(); g.arc(610, 110, 70, 0, 7); g.stroke(); }
    else if (st === 'japon') { g.fillStyle = sky; g.beginPath(); g.arc(610, 110, 80, 0, 7); g.fill(); g.strokeStyle = '#6b4423'; g.lineWidth = 5; g.beginPath(); g.arc(610, 110, 80, 0, 7); g.stroke(); g.lineWidth = 2; for (let x = -60; x <= 60; x += 30) { g.beginPath(); g.moveTo(610 + x, 40); g.lineTo(610 + x, 180); g.stroke(); } }
    else { g.fillStyle = sky; g.fillRect(520, 50, 180, 120); g.strokeStyle = st === 'chalet' ? '#5a3a1c' : '#fff'; g.lineWidth = 6; g.strokeRect(520, 50, 180, 120); g.beginPath(); g.moveTo(610, 50); g.lineTo(610, 170); g.moveTo(520, 110); g.lineTo(700, 110); g.stroke(); }
    g.font = '26px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(night > .4 ? '🌙' : '☀️', 660, 80);
    // à l'étage : poutres et lucarne
    if (floor === 1) { g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(260, 0); g.lineTo(0, 200); g.fill(); g.beginPath(); g.moveTo(W, 0); g.lineTo(W - 260, 0); g.lineTo(W, 200); g.fill(); for (const x of [0, W]) wood(g, x === 0 ? 0 : W - 30, 0, 30, 250, '#6b4423', 0); wood(g, 0, 0, W, 16, '#6b4423', 0); }
    // le sol
    const FLOOR = { cosy: hs.floor, moderne: '#d9dde4', chalet: '#8a5a2b', plage: '#e8d3a8', chateau: '#9a8f80', loft: '#5a5a64', japon: '#d8c690' }[st];
    g.fillStyle = FLOOR; g.fillRect(0, 250, W, 470);
    g.save(); g.beginPath(); g.rect(0, 250, W, 470); g.clip();
    if (st === 'japon') { g.strokeStyle = '#6b5a2a'; g.lineWidth = 3; for (let y = 250; y < H; y += 90) for (let x = (y / 90) % 2 ? -90 : 0; x < W; x += 180) g.strokeRect(x, y, 180, 90); }
    else if (st === 'chateau') { for (let y = 250; y < H; y += 60) for (let x = 0; x < W; x += 60) { g.fillStyle = ((x + y) / 60) % 2 ? '#e8e2d6' : '#2a2a32'; g.fillRect(x, y, 60, 60); } g.fillStyle = 'rgba(122,13,34,.85)'; g.fillRect(420, 250, 260, 470); g.fillStyle = '#ffd34d'; g.fillRect(420, 250, 8, 470); g.fillRect(672, 250, 8, 470); }
    else if (st === 'moderne' || st === 'loft') { g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 2; for (let y = 250; y < H; y += 80) for (let x = 0; x < W; x += 120) g.strokeRect(x, y, 120, 80); if (st === 'loft') { g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, 250, W, 470); } }
    else { g.strokeStyle = 'rgba(0,0,0,.09)'; g.lineWidth = 2; for (let y = 280; y < H; y += 34) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); for (let x = ((y / 34) % 3) * 70; x < W; x += 210) { g.beginPath(); g.moveTo(x, y - 34); g.lineTo(x, y); g.stroke(); } } }
    g.restore();
    g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, 244, W, 8);
    if (st === 'loft') { const c = NEON[Math.floor(t / 3) % NEON.length]; g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = 18; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 246); g.lineTo(W, 246); g.stroke(); g.shadowBlur = 0; }
    // l'escalier (maison à étage)
    if (hs.floors === 2) {
      g.save(); g.translate(70, 0);
      for (let i = 0; i < 8; i++) wood(g, 0, 236 - i * 26, 120 - i * 6, 22, floor ? '#6b4423' : '#8a5a2b', 2);
      metal(g, 116, 40, 6, 210, 2);
      g.restore();
      g.font = '900 15px Outfit, sans-serif'; g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4; const lab = floor ? '⬇️ Rez-de-chaussée' : '⬆️ Étage'; g.strokeText(lab, 130, 24); g.fillText(lab, 130, 24);
    }
  }

  // ---------- 🏠 La grande maison : chambre, salle de bain, salon et cuisine ----------
  function bigHouse(g, t, hs, floor, night, mix) {
    const st = STYLES[hs.style] ? hs.style : 'cosy', A = hs.accent, W = 1800, H = 1100;
    const WALL = { cosy: hs.wall, moderne: '#eef1f6', chalet: '#b57a45', plage: '#dff4fb', chateau: '#c9c2b4', loft: '#3a3a44', japon: '#f4ead2' }[st];
    const MAIN = { cosy: hs.floor, moderne: '#d9dde4', chalet: '#8a5a2b', plage: '#e8d3a8', chateau: '#9a8f80', loft: '#5a5a64', japon: '#d8c690' }[st];
    // le mur du fond, avec ses fenêtres (le ciel suit l'heure)
    g.fillStyle = WALL; g.fillRect(0, 0, W, 200);
    if (st === 'chalet') for (let y = 0; y < 200; y += 25) wood(g, 0, y, W, 23, '#a86b3a', 2);
    if (st === 'loft') { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; for (let y = 0; y < 200; y += 22) for (let x = (y / 22) % 2 ? -30 : 0; x < W; x += 60) g.strokeRect(x, y, 60, 22); }
    if (st === 'japon') { g.strokeStyle = '#6b4423'; g.lineWidth = 3; for (let x = 0; x <= W; x += 100) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 200); g.stroke(); } }
    const sky = mix('#8fd8ff', '#1a3a8a', night * .7);
    for (const wx of [260, 640, 1150, 1520]) {
      g.fillStyle = sky; g.fillRect(wx - 80, 40, 160, 110); g.strokeStyle = st === 'loft' ? '#1c1c24' : '#ffffff'; g.lineWidth = 6; g.strokeRect(wx - 80, 40, 160, 110);
      g.beginPath(); g.moveTo(wx, 40); g.lineTo(wx, 150); g.moveTo(wx - 80, 95); g.lineTo(wx + 80, 95); g.stroke();
      g.fillStyle = shade(A, .9); g.fillRect(wx - 96, 32, 18, 128); g.fillRect(wx + 78, 32, 18, 128); // rideaux
    }
    g.font = '26px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(night > .4 ? '🌙' : '☀️', 680, 70);
    if (st === 'loft') { const c = NEON[Math.floor(t / 3) % NEON.length]; g.strokeStyle = c; g.shadowColor = c; g.shadowBlur = 16; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 196); g.lineTo(W, 196); g.stroke(); g.shadowBlur = 0; }
    // les sols de chaque pièce
    const room = (x, y, w, h, draw) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); draw(x, y, w, h); g.restore(); };
    room(0, 200, 900, 450, (x, y, w, h) => { g.fillStyle = '#c99566'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(80,40,10,.15)'; g.lineWidth = 2; for (let yy = y; yy < y + h; yy += 30) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); for (let xx = ((yy / 30) % 3) * 80; xx < w; xx += 240) { g.beginPath(); g.moveTo(x + xx, yy); g.lineTo(x + xx, yy + 30); g.stroke(); } } g.fillStyle = shade(A, 1.2) + '55'; g.beginPath(); g.ellipse(300, 470, 230, 120, 0, 0, 7); g.fill(); });
    room(900, 200, 900, 450, (x, y, w, h) => { for (let yy = y; yy < y + h; yy += 40) for (let xx = x; xx < x + w; xx += 40) { g.fillStyle = ((xx + yy) / 40) % 2 ? '#e6f4fb' : '#cfe7f3'; g.fillRect(xx, yy, 40, 40); } });
    room(0, 650, 900, 450, (x, y, w, h) => { g.fillStyle = MAIN; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 2; for (let yy = y; yy < y + h; yy += 34) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); } });
    room(900, 650, 900, 450, (x, y, w, h) => { for (let yy = y; yy < y + h; yy += 50) for (let xx = x; xx < x + w; xx += 50) { g.fillStyle = ((xx + yy) / 50) % 2 ? '#f4f1ea' : '#3a3f4b'; g.fillRect(xx, yy, 50, 50); } });
    // les murs entre les pièces (avec les portes)
    const wallH = (x0, x1, y) => { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x0, y + 10, x1 - x0, 10); g.fillStyle = shade(WALL, .82); g.fillRect(x0, y - 12, x1 - x0, 24); g.fillStyle = shade(WALL, 1.1); g.fillRect(x0, y - 12, x1 - x0, 6); };
    const wallV = (x, y0, y1) => { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 10, y0, 10, y1 - y0); g.fillStyle = shade(WALL, .82); g.fillRect(x - 12, y0, 24, y1 - y0); g.fillStyle = shade(WALL, 1.1); g.fillRect(x - 12, y0, 6, y1 - y0); };
    wallV(900, 200, 424); wallV(900, 536, 638); wallV(900, 662, 824); wallV(900, 936, H);
    wallH(0, 404, 650); wallH(516, 888, 650); wallH(912, 1284, 650); wallH(1396, W, 650);
    // les encadrements de portes
    g.fillStyle = '#8a5a2b'; for (const [x, y, v] of [[900, 424, 1], [900, 536, 1], [900, 824, 1], [900, 936, 1], [404, 650, 0], [516, 650, 0], [1284, 650, 0], [1396, 650, 0]]) { if (v) g.fillRect(x - 14, y - 4, 28, 8); else g.fillRect(x - 4, y - 14, 8, 28); }
    // le contour de la maison et la porte d'entrée (en bas du salon)
    g.fillStyle = shade(WALL, .7); g.fillRect(0, 200, 14, H - 200); g.fillRect(W - 14, 200, 14, H - 200); g.fillRect(0, H - 14, 404, 14); g.fillRect(516, H - 14, W - 516, 14);
    if (!floor) { g.fillStyle = '#5a3a1c'; g.fillRect(404, H - 16, 112, 16); g.fillStyle = '#c0392b'; roundRect(g, 410, H - 60, 100, 40, 8); g.fill(); g.fillStyle = '#ffd34d'; g.font = '700 14px Outfit, sans-serif'; g.fillText('Bienvenue', 460, H - 40); }
    // le nom des pièces
    const label = (txt, x, y) => { g.font = '800 18px Outfit, sans-serif'; const tw = g.measureText(txt).width + 24; g.fillStyle = 'rgba(20,12,40,.55)'; roundRect(g, x - tw / 2, y - 15, tw, 30, 15); g.fill(); g.fillStyle = '#ffffff'; g.fillText(txt, x, y); };
    label(floor ? '🛏️ Chambre d\'amis' : '🛏️ Chambre', 120, 225); label('🛁 Salle de bain', 1680, 225); label(floor ? '🎮 Salle de jeux' : '🛋️ Salon', 820, 680); label(floor ? '🎨 Atelier' : '🍳 Cuisine', 1700, 680);
    // l'escalier (maison à étage)
    if (hs.floors === 2) { g.save(); g.translate(40, 0); for (let i = 0; i < 7; i++) wood(g, 0, 186 - i * 26, 150 - i * 8, 22, floor ? '#6b4423' : '#8a5a2b', 2); g.restore(); g.font = '900 16px Outfit, sans-serif'; g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4; const lab = floor ? '⬇️ Rez-de-chaussée' : '⬆️ Étage'; g.strokeText(lab, 120, 18); g.fillText(lab, 120, 18); }
  }

  // ---------- Les façades (aperçu dans la liste des maisons, et le quartier sur l'Île) ----------
  function facade(g, style, floors, A, x, y, s = 1) {
    const st = STYLES[style] ? style : 'cosy';
    g.save(); g.translate(x, y); g.scale(s, s);
    const H = floors === 2 ? 110 : 64, W = 110;
    const wall = { cosy: '#ffe3a0', moderne: '#f2f4f8', chalet: '#a86b3a', plage: '#bfeaff', chateau: '#c9c2b4', loft: '#3a3a44', japon: '#f4ead2' }[st];
    const roof = { cosy: '#b5562b', moderne: '#2a2a32', chalet: '#5a3a1c', plage: '#2fa8ff', chateau: '#3b4cca', loft: '#1c1c24', japon: '#2a2a32' }[st];
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(0, 4, W * .6, 10, 0, 0, 7); g.fill();
    if (st === 'chalet') { for (let i = 0; i < H; i += 12) wood(g, -W / 2, -i - 12, W, 11, '#a86b3a', 1); } else { g.fillStyle = wall; g.fillRect(-W / 2, -H, W, H); }
    if (st === 'chateau') { g.fillStyle = '#b0a898'; for (const sx of [-1, 1]) { g.fillRect(sx * W / 2 - 14, -H - 40, 28, H + 40); g.fillStyle = roof; g.beginPath(); g.moveTo(sx * W / 2 - 18, -H - 40); g.lineTo(sx * W / 2, -H - 76); g.lineTo(sx * W / 2 + 18, -H - 40); g.fill(); g.fillStyle = '#b0a898'; } for (let i = 0; i < 6; i++) g.fillRect(-W / 2 + 6 + i * 18, -H - 10, 10, 10); }
    else if (st === 'moderne' || st === 'loft') { g.fillStyle = roof; g.fillRect(-W / 2 - 8, -H - 8, W + 16, 10); }
    else if (st === 'japon') { g.fillStyle = roof; g.beginPath(); g.moveTo(-W / 2 - 22, -H + 4); g.quadraticCurveTo(0, -H - 20, W / 2 + 22, -H + 4); g.lineTo(W / 2 + 8, -H - 8); g.quadraticCurveTo(0, -H - 40, -W / 2 - 8, -H - 8); g.closePath(); g.fill(); if (floors === 2) { g.beginPath(); g.moveTo(-W / 2 - 16, -H / 2 + 6); g.quadraticCurveTo(0, -H / 2 - 10, W / 2 + 16, -H / 2 + 6); g.lineTo(W / 2, -H / 2 - 4); g.lineTo(-W / 2, -H / 2 - 4); g.fill(); } }
    else { g.fillStyle = roof; g.beginPath(); g.moveTo(-W / 2 - 12, -H); g.lineTo(0, -H - 46); g.lineTo(W / 2 + 12, -H); g.closePath(); g.fill(); }
    // fenêtres (1 rangée par étage)
    for (let fl = 0; fl < floors; fl++) {
      const wy = -28 - fl * 46;
      for (const wx of fl === 0 ? [-36, 26] : [-36, -5, 26]) {
        if (st === 'moderne' || st === 'loft') { g.fillStyle = mix2(night(), '#9fdcff', '#ffe28a'); g.fillRect(wx - 6, wy - 12, 22, 22); if (st === 'loft') { g.strokeStyle = A; g.shadowColor = A; g.shadowBlur = 8; g.lineWidth = 2; g.strokeRect(wx - 6, wy - 12, 22, 22); g.shadowBlur = 0; } }
        else if (st === 'chateau' || st === 'japon') { g.fillStyle = mix2(night(), '#9fdcff', '#ffe28a'); g.beginPath(); g.moveTo(wx - 4, wy + 10); g.lineTo(wx - 4, wy - 4); g.arc(wx + 5, wy - 4, 9, Math.PI, 0); g.lineTo(wx + 14, wy + 10); g.fill(); }
        else if (st === 'plage') { g.fillStyle = mix2(night(), '#9fdcff', '#ffe28a'); g.beginPath(); g.arc(wx + 5, wy, 9, 0, 7); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.stroke(); }
        else { g.fillStyle = mix2(night(), '#9fdcff', '#ffe28a'); g.fillRect(wx - 4, wy - 10, 18, 18); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.strokeRect(wx - 4, wy - 10, 18, 18); }
      }
    }
    g.fillStyle = st === 'loft' ? '#1c1c24' : '#5a3a1c'; roundRect(g, -10, -30, 20, 30, 4); g.fill(); g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(5, -15, 2, 0, 7); g.fill();
    if (st === 'plage') { g.font = '26px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.fillText('🌴', W / 2 + 8, -6); }
    g.restore();
  }
  let nightFn = () => 0;
  const night = () => nightFn();
  const mix2 = (n, a, b) => (n > .4 ? b : a);
  return { NEON, STYLES, FURN, draw, room, bigHouse, facade, setNight: f => { nightFn = f; } };
})();
window.Decor = Decor;
