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
    chair: { name: 'Chaise', icon: '🪑', w: 58, h: 90, act: 'sit', spot: 'seat', sideK: .8, sideL: 1.25 },
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

  // =================== 🛋️ Encore plus de meubles réalistes, de A à Z ===================
  // cat = la catégorie dans la liste ; seatY = où l'on s'assoit ; lieY = où l'on se couche
  const FURN2 = {
    aspirateur: { name: 'Aspirateur robot', icon: '🤖', w: 60, h: 60, cat: 'maison', flat: true },
    arbre: { name: 'Arbre d\'intérieur', icon: '🌳', w: 90, h: 160, cat: 'deco' },
    banc: { name: 'Banc en bois', icon: '🪵', w: 170, h: 64, act: 'sit', spot: 'seat', seatY: -6, cat: 'salon' },
    billard: { name: 'Billard', icon: '🎱', w: 270, h: 150, act: 'play', actLabel: 'Jouer au billard', spot: 'front', cat: 'loisirs' },
    buffet: { name: 'Buffet', icon: '🗄️', w: 190, h: 96, cat: 'salon' },
    canape_angle: { name: 'Canapé d\'angle', icon: '🛋️', w: 310, h: 170, act: 'sit', spot: 'seat', seatY: -10, cat: 'salon' },
    commode: { name: 'Commode', icon: '🗃️', w: 130, h: 96, cat: 'chambre' },
    climatiseur: { name: 'Climatiseur', icon: '❄️', w: 130, h: 46, cat: 'maison' },
    dressing: { name: 'Dressing', icon: '👗', w: 230, h: 180, act: 'dress', spot: 'front', cat: 'chambre' },
    enceinte: { name: 'Enceinte colonne', icon: '🔊', w: 54, h: 130, act: 'dance', spot: 'front', cat: 'loisirs' },
    etagere: { name: 'Étagère murale', icon: '🪴', w: 150, h: 46, cat: 'deco' },
    fauteuil_oeuf: { name: 'Fauteuil œuf suspendu', icon: '🥚', w: 100, h: 160, act: 'sit', spot: 'seat', seatY: 10, cat: 'salon' },
    four: { name: 'Cuisinière avec four', icon: '🔥', w: 96, h: 96, act: 'cook', spot: 'front', cat: 'cuisine' },
    guitare: { name: 'Guitare sur son pied', icon: '🎸', w: 54, h: 130, act: 'guitar', spot: 'front', cat: 'loisirs' },
    gamer: { name: 'Fauteuil gamer', icon: '🎮', w: 86, h: 120, act: 'sit', spot: 'seat', seatY: 4, cat: 'bureau' },
    hamac: { name: 'Hamac', icon: '🏝️', w: 220, h: 90, act: 'sleep', actLabel: 'Se reposer dans le hamac', spot: 'center', lieY: -4, cat: 'chambre' },
    horloge: { name: 'Horloge comtoise', icon: '🕰️', w: 64, h: 180, cat: 'deco' },
    ilot: { name: 'Îlot de cuisine', icon: '🍳', w: 230, h: 100, act: 'cook', spot: 'front', cat: 'cuisine' },
    jukebox: { name: 'Jukebox', icon: '🎵', w: 96, h: 140, act: 'dance', actLabel: 'Danser sur le jukebox', spot: 'front', cat: 'loisirs' },
    jardiniere: { name: 'Jardinière de fleurs', icon: '🌷', w: 170, h: 56, cat: 'deco' },
    karaoke: { name: 'Machine à karaoké', icon: '🎤', w: 76, h: 140, act: 'dance', actLabel: 'Chanter au karaoké', spot: 'front', cat: 'loisirs' },
    lave_linge: { name: 'Lave-linge', icon: '🫧', w: 88, h: 96, cat: 'bain' },
    lampadaire: { name: 'Lampadaire arc', icon: '💡', w: 130, h: 180, cat: 'salon' },
    lits_superposes: { name: 'Lits superposés', icon: '🛏️', w: 190, h: 200, act: 'sleep', spot: 'center', lieY: 30, cat: 'chambre' },
    lustre: { name: 'Lustre en cristal', icon: '✨', w: 150, h: 100, cat: 'deco' },
    micro_ondes: { name: 'Micro-ondes', icon: '📦', w: 76, h: 50, act: 'cook', actLabel: 'Réchauffer un plat', spot: 'front', cat: 'cuisine' },
    meuble_tv: { name: 'Meuble télé', icon: '📺', w: 320, h: 66, cat: 'salon' },
    niche: { name: 'Niche pour animal', icon: '🐶', w: 116, h: 106, cat: 'maison' },
    ordi_gamer: { name: 'PC gamer', icon: '🖥️', w: 160, h: 116, act: 'work', spot: 'front', cat: 'bureau' },
    pouf: { name: 'Pouf', icon: '🟠', w: 72, h: 58, act: 'sit', spot: 'seat', seatY: -8, cat: 'salon' },
    paravent: { name: 'Paravent', icon: '🎎', w: 170, h: 150, cat: 'chambre' },
    porte_manteau: { name: 'Porte-manteau', icon: '🧥', w: 66, h: 170, cat: 'maison' },
    ping_pong: { name: 'Table de ping-pong', icon: '🏓', w: 270, h: 150, act: 'play', actLabel: 'Jouer au ping-pong', spot: 'front', cat: 'loisirs' },
    poubelle: { name: 'Poubelle', icon: '🗑️', w: 48, h: 62, cat: 'cuisine' },
    quilles: { name: 'Quilles de bowling', icon: '🎳', w: 110, h: 90, cat: 'loisirs' },
    radiateur: { name: 'Radiateur', icon: '♨️', w: 130, h: 64, act: 'warm', actLabel: 'Se réchauffer au radiateur', spot: 'front', cat: 'maison' },
    frigo_us: { name: 'Frigo américain', icon: '🧊', w: 150, h: 196, act: 'drink', actLabel: 'Ouvrir le frigo', spot: 'front', cat: 'cuisine' },
    rocking: { name: 'Rocking-chair', icon: '🪑', w: 86, h: 110, act: 'sit', spot: 'seat', seatY: 4, cat: 'salon' },
    seche_linge: { name: 'Sèche-linge', icon: '🌀', w: 88, h: 96, cat: 'bain' },
    sac_frappe: { name: 'Sac de frappe', icon: '🥊', w: 66, h: 160, act: 'sport', spot: 'front', cat: 'sport' },
    tapis_course: { name: 'Tapis de course', icon: '🏃', w: 210, h: 100, act: 'sport', spot: 'center', cat: 'sport' },
    tabouret: { name: 'Tabouret de bar', icon: '🍸', w: 54, h: 96, act: 'sit', spot: 'seat', seatY: -30, cat: 'cuisine' },
    telescope: { name: 'Télescope', icon: '🔭', w: 90, h: 140, act: 'watch', actLabel: 'Regarder les étoiles', spot: 'front', cat: 'loisirs' },
    tapis_rond: { name: 'Tapis rond', icon: '⭕', w: 230, h: 230, act: 'dance', spot: 'center', flat: true, cat: 'deco' },
    ukulele: { name: 'Ukulélé', icon: '🪕', w: 46, h: 90, act: 'guitar', spot: 'front', cat: 'loisirs' },
    velo: { name: 'Vélo d\'appartement', icon: '🚲', w: 140, h: 116, act: 'sport', spot: 'center', cat: 'sport' },
    ventilateur: { name: 'Ventilateur', icon: '🌬️', w: 76, h: 140, cat: 'maison' },
    valise: { name: 'Valise', icon: '🧳', w: 76, h: 96, cat: 'chambre' },
    vase: { name: 'Vase de fleurs', icon: '💐', w: 50, h: 96, cat: 'deco' },
    lit_eau: { name: 'Waterbed (lit à eau)', icon: '🌊', w: 210, h: 180, act: 'sleep', spot: 'center', lieY: 0, cat: 'chambre' },
    xylophone: { name: 'Xylophone', icon: '🎶', w: 150, h: 76, act: 'piano', actLabel: 'Jouer du xylophone', spot: 'front', cat: 'loisirs' },
    yucca: { name: 'Yucca', icon: '🌿', w: 76, h: 160, cat: 'deco' },
    zebre: { name: 'Tapis zèbre', icon: '🦓', w: 270, h: 170, act: 'dance', spot: 'center', flat: true, cat: 'deco' },
  };
  Object.assign(FURN, FURN2);
  const box = (g, x, y, w, h, col, r = 6, k1 = 1.12, k2 = .82) => { g.fillStyle = lin(g, x, y, x, y + h, [[0, shade(col, k1)], [1, shade(col, k2)]]); roundRect(g, x, y, w, h, r); g.fill(); };
  const leg = (g, x, y, h, col = '#3a2a1e', w = 6) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const glow = (g, x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  const leaves = (g, n, len, wd, cols, sway, spread = .42) => { for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * spread + sway; g.save(); g.rotate(a); g.fillStyle = cols[i % cols.length]; g.beginPath(); g.ellipse(0, -len / 2, wd, len / 2, 0, 0, 7); g.fill(); g.restore(); } };
  function draw2(g, f, d, t, A, night) {
    const w = d.w, h = d.h, L = -w / 2, T = -h / 2;
    switch (f.t) {
      case 'aspirateur': { const a = t * .6 + f.x; g.fillStyle = lin(g, L, T, L, -T, [[0, '#4a4a56'], [1, '#1c1c24']]); g.beginPath(); g.arc(0, 0, w / 2, 0, 7); g.fill(); g.strokeStyle = '#9aa3b2'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, w / 2 - 3, 0, 7); g.stroke(); g.fillStyle = '#2a2a32'; g.beginPath(); g.arc(0, -4, 12, 0, 7); g.fill(); g.fillStyle = Math.sin(t * 3) > 0 ? '#34ff6a' : '#1a7a3a'; g.beginPath(); g.arc(Math.cos(a) * 18, Math.sin(a) * 18, 3, 0, 7); g.fill(); return true; }
      case 'arbre': case 'yucca': {
        g.fillStyle = lin(g, -20, 0, 20, 0, [[0, '#6b6b72'], [.5, '#a0a0aa'], [1, '#5a5a62']]); g.beginPath(); g.moveTo(-22, h / 2 - 40); g.lineTo(22, h / 2 - 40); g.lineTo(16, h / 2); g.lineTo(-16, h / 2); g.closePath(); g.fill();
        g.fillStyle = '#6b4423'; g.fillRect(-4, T + 50, 8, h - 90);
        const sw = Math.sin(t * 1.2 + f.x) * .05; g.save(); g.translate(0, T + 60);
        if (f.t === 'yucca') { leaves(g, 9, 70, 6, ['#3d8a3a', '#56b56b', '#2e7a35'], sw, .38); } else { for (const [x, y, r] of [[0, -20, 40], [-26, 4, 30], [26, 2, 32], [0, 14, 30]]) { g.fillStyle = lin(g, x, y - r, x, y + r, [[0, '#56b56b'], [1, '#2e7a35']]); g.beginPath(); g.arc(x + sw * 40, y, r, 0, 7); g.fill(); } }
        g.restore(); return true; }
      case 'banc': { leg(g, L + 14, -4, h / 2 + 4); leg(g, w / 2 - 20, -4, h / 2 + 4); for (let i = 0; i < 3; i++) wood(g, L, T + i * 14, w, 11, '#a86b3a', 3); wood(g, L, 2, w, 12, '#8a5a2b', 3); return true; }
      case 'billard': { wood(g, L, T, w, h, '#6b3f1f', 14); g.fillStyle = lin(g, 0, T + 14, 0, -T - 14, [[0, '#2bb866'], [1, '#1f8a4c']]); roundRect(g, L + 16, T + 16, w - 32, h - 32, 6); g.fill(); g.fillStyle = '#111'; for (const [x, y] of [[L + 18, T + 18], [0, T + 14], [-L - 18, T + 18], [L + 18, -T - 18], [0, -T - 14], [-L - 18, -T - 18]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
        const B = ['#ffd34d', '#2f6fd6', '#ff3b30', '#7a3fbf', '#ff9500', '#1f8a4c', '#8a1f1f', '#111']; B.forEach((c, i) => { const r = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2), k = i - r * (r + 1) / 2; g.fillStyle = c; g.beginPath(); g.arc(50 + r * 13, (k - r / 2) * 14, 6, 0, 7); g.fill(); });
        g.fillStyle = '#fff'; g.beginPath(); g.arc(-60, 0, 6, 0, 7); g.fill(); g.strokeStyle = '#c08a5a'; g.lineWidth = 4; g.beginPath(); g.moveTo(-72, 4); g.lineTo(-160, 30); g.stroke(); return true; }
      case 'buffet': { box(g, L, T + 10, w, h - 18, '#7a4f2b', 6); wood(g, L - 4, T + 4, w + 8, 10, '#8a5a2b', 3); for (let i = 0; i < 3; i++) { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.strokeRect(L + 8 + i * (w - 16) / 3, T + 20, (w - 16) / 3 - 6, h - 40); g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(L + 8 + (i + .5) * (w - 16) / 3 - 3, 0, 3, 0, 7); g.fill(); } leg(g, L + 8, h / 2 - 8, 8); leg(g, w / 2 - 14, h / 2 - 8, 8); g.font = '26px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.fillText('🏺', L + 40, T); g.fillText('🖼️', 40, T - 4); return true; }
      case 'canape_angle': { const c = A; cushion(g, L, T, w, 46, shade(c, .85), 16); cushion(g, w / 2 - 70, T, 70, h, shade(c, .85), 16); for (let i = 0; i < 3; i++) cushion(g, L + 10 + i * 76, T + 38, 72, 50, c, 10); cushion(g, w / 2 - 66, T + 38, 60, h - 46, c, 10); cushion(g, L, T + 14, 24, 82, shade(c, .92), 10); cushion(g, L + 20, T + 8, 46, 34, '#fff3d6', 10); cushion(g, w / 2 - 60, T + 8, 46, 34, shade(c, 1.4), 10); return true; }
      case 'commode': { box(g, L, T, w, h - 8, '#efe6d8', 6, 1.05, .9); for (let i = 0; i < 3; i++) { g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2; g.strokeRect(L + 6, T + 6 + i * 27, w - 12, 23); g.fillStyle = '#c0a060'; roundRect(g, -12, T + 15 + i * 27, 24, 5, 2); g.fill(); } leg(g, L + 6, h / 2 - 10, 10, '#b08a5a'); leg(g, w / 2 - 12, h / 2 - 10, 10, '#b08a5a'); g.font = '24px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.fillText('🌸', L + 26, T - 6); g.fillText('🧴', 30, T - 4); return true; }
      case 'climatiseur': { box(g, L, T, w, h, '#f4f6fa', 10, 1.02, .9); g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 6; i++) g.fillRect(L + 10, T + h - 14 + (i % 2) * 4, w - 20, 1.5); g.fillStyle = '#34c759'; g.beginPath(); g.arc(w / 2 - 14, T + 10, 3, 0, 7); g.fill(); g.strokeStyle = 'rgba(160,220,255,.5)'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { const yy = h / 2 + 6 + ((t * 30 + i * 12) % 34); g.beginPath(); g.moveTo(-30 + i * 30, yy); g.quadraticCurveTo(-20 + i * 30, yy + 6, -30 + i * 30, yy + 12); g.stroke(); } return true; }
      case 'dressing': { box(g, L, T, w, h, '#efe6d8', 8, 1.04, .9); g.fillStyle = '#d8ccb8'; g.fillRect(L + 8, T + 8, w - 16, h - 16); metal(g, L + 12, T + 22, w - 24, 5, 2); const C = ['#ff5fa2', '#2f6fd6', '#ffd34d', '#ffffff', '#1c1c24', '#34c759', '#af52de', '#ff9500']; for (let i = 0; i < 8; i++) { const x = L + 22 + i * (w - 44) / 7; g.fillStyle = C[i]; g.beginPath(); g.moveTo(x - 11, T + 30); g.lineTo(x + 11, T + 30); g.lineTo(x + 13, T + 96); g.lineTo(x - 13, T + 96); g.closePath(); g.fill(); g.strokeStyle = '#9aa3b2'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, T + 26, 4, Math.PI, 0); g.stroke(); } wood(g, L + 8, T + 110, w - 16, 6, '#b08a5a', 2); g.font = '22px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; ['👠', '👟', '👜', '🧢', '👢'].forEach((e, i) => g.fillText(e, L + 30 + i * (w - 60) / 4, T + 140)); return true; }
      case 'enceinte': { box(g, L, T, w, h, '#1c1c24', 8, 1.3, .9); const b = 1 + Math.abs(Math.sin(t * 8)) * .08; for (const [y, r] of [[T + 26, 14], [T + 74, 20], [T + 112, 10]]) { g.fillStyle = '#0a0a0e'; g.beginPath(); g.arc(0, y, r + 3, 0, 7); g.fill(); g.fillStyle = lin(g, 0, y - r, 0, y + r, [[0, '#5a5a66'], [1, '#2a2a32']]); g.beginPath(); g.arc(0, y, r * b, 0, 7); g.fill(); g.fillStyle = '#9aa3b2'; g.beginPath(); g.arc(0, y, r * .3, 0, 7); g.fill(); } g.fillStyle = '#2fa8ff'; g.fillRect(L + 6, h / 2 - 6, w - 12, 2); return true; }
      case 'etagere': { wood(g, L, T + h - 12, w, 12, '#8a5a2b', 3); g.fillStyle = '#3a2a1e'; g.fillRect(L + 14, T + h - 2, 4, 8); g.fillRect(w / 2 - 18, T + h - 2, 4, 8); const C = ['#c0392b', '#2f6fd6', '#ffd34d', '#2e9d57', '#8e44ad']; for (let i = 0; i < 5; i++) { g.fillStyle = C[i]; g.fillRect(L + 12 + i * 11, T + h - 12 - 30 - (i % 2) * 4, 9, 30 + (i % 2) * 4); } g.font = '26px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('🪴', 20, T + h - 10); g.fillText('🕯️', w / 2 - 22, T + h - 10); return true; }
      case 'fauteuil_oeuf': { metal(g, -3, T, 6, 30, 2); g.strokeStyle = '#9aa3b2'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, T + 28); g.lineTo(0, T + 40); g.stroke(); const sw = Math.sin(t * 1.4 + f.x) * .05; g.save(); g.rotate(sw); g.fillStyle = lin(g, L, 0, -L, 0, [[0, '#c9a46a'], [.5, '#f0d9a8'], [1, '#b08a5a']]); g.beginPath(); g.ellipse(0, 30, w / 2, h / 2 - 22, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(120,80,30,.35)'; g.lineWidth = 1.5; for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(0, 30, Math.abs(i) * 14 + 4, h / 2 - 24, 0, 0, 7); g.stroke(); } g.fillStyle = shade(A, .9); g.beginPath(); g.ellipse(0, 40, w / 2 - 16, h / 2 - 46, 0, 0, 7); g.fill(); cushion(g, -26, 34, 52, 34, A, 14); g.restore(); return true; }
      case 'four': { metal(g, L, T, w, h, 8); g.fillStyle = '#1c1c24'; roundRect(g, L + 10, T + 30, w - 20, h - 42, 6); g.fill(); const on = .4 + .3 * Math.sin(t * 2); g.fillStyle = `rgba(255,140,40,${on})`; roundRect(g, L + 16, T + 36, w - 32, h - 54, 4); g.fill(); g.fillStyle = '#c3cad6'; g.fillRect(L + 14, T + 26, w - 28, 4); g.fillStyle = '#1c1c24'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(L + 18 + i * 20, T + 12, 6, 0, 7); g.fill(); } return true; }
      case 'guitare': case 'ukulele': { const k = f.t === 'ukulele' ? .65 : 1; g.strokeStyle = '#3a3a44'; g.lineWidth = 3; g.beginPath(); g.moveTo(-14, h / 2); g.lineTo(0, h / 2 - 30 * k); g.lineTo(14, h / 2); g.stroke(); g.save(); g.translate(0, 6); g.fillStyle = f.t === 'ukulele' ? '#d99a4e' : lin(g, -22, 0, 22, 0, [[0, '#8a1f1f'], [.5, '#d9533a'], [1, '#8a1f1f']]); g.beginPath(); g.ellipse(0, 16 * k, 22 * k, 26 * k, 0, 0, 7); g.ellipse(0, -14 * k, 16 * k, 18 * k, 0, 0, 7); g.fill(); g.fillStyle = '#1c1c24'; g.beginPath(); g.arc(0, 0, 7 * k, 0, 7); g.fill(); wood(g, -4 * k, -64 * k, 8 * k, 50 * k, '#5a3a1c', 2); g.fillStyle = '#3a2a1e'; g.fillRect(-7 * k, -76 * k, 14 * k, 14 * k); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = .8; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * 2.4, -70 * k); g.lineTo(i * 2.4, 30 * k); g.stroke(); } g.restore(); return true; }
      case 'gamer': { g.fillStyle = '#2a2a32'; g.fillRect(-4, 20, 8, h / 2 - 26); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.fillRect(Math.cos(a) * 26 - 3, h / 2 - 8 + Math.sin(a) * 4, 8, 6); } g.fillStyle = lin(g, L, 0, -L, 0, [[0, '#111'], [.5, '#2a2a32'], [1, '#111']]); roundRect(g, L + 10, T, w - 20, h * .6, 18); g.fill(); g.fillStyle = A; g.fillRect(L + 18, T + 10, 8, h * .5); g.fillRect(-L - 26, T + 10, 8, h * .5); roundRect(g, -20, T + 14, 40, 16, 6); g.fill(); cushion(g, L + 4, T + h * .5, w - 8, 26, '#2a2a32', 10); return true; }
      case 'hamac': { metal(g, L, T, 8, h, 3); metal(g, w / 2 - 8, T, 8, h, 3); g.strokeStyle = '#d9c49a'; g.lineWidth = 2; g.beginPath(); g.moveTo(L + 8, T + 14); g.lineTo(L + 30, -6); g.moveTo(w / 2 - 8, T + 14); g.lineTo(w / 2 - 30, -6); g.stroke(); const sw = Math.sin(t * 1.2 + f.x) * 3; g.fillStyle = lin(g, 0, -14, 0, 24, [[0, shade(A, 1.2)], [1, shade(A, .8)]]); g.beginPath(); g.moveTo(L + 30, -8); g.quadraticCurveTo(0, 34 + sw, w / 2 - 30, -8); g.quadraticCurveTo(0, 10 + sw, L + 30, -8); g.fill(); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 3; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(L + 30 + i * (w - 60) / 5, -6 + Math.sin(i / 5 * Math.PI) * 6); g.lineTo(L + 30 + i * (w - 60) / 5, 4 + Math.sin(i / 5 * Math.PI) * 20 + sw); g.stroke(); } return true; }
      case 'horloge': { wood(g, L, T, w, h, '#6b3f1f', 10); g.fillStyle = '#fff8e6'; g.beginPath(); g.arc(0, T + 32, 22, 0, 7); g.fill(); g.strokeStyle = '#3a2a1e'; g.lineWidth = 2; g.stroke(); const n = new Date(), hh = (n.getHours() % 12 + n.getMinutes() / 60) / 12 * Math.PI * 2, mm = n.getMinutes() / 60 * Math.PI * 2; g.beginPath(); g.moveTo(0, T + 32); g.lineTo(Math.sin(hh) * 11, T + 32 - Math.cos(hh) * 11); g.moveTo(0, T + 32); g.lineTo(Math.sin(mm) * 17, T + 32 - Math.cos(mm) * 17); g.stroke(); g.fillStyle = 'rgba(30,15,5,.7)'; roundRect(g, L + 10, T + 64, w - 20, h - 86, 6); g.fill(); const a = Math.sin(t * Math.PI) * .35; g.save(); g.translate(0, T + 70); g.rotate(a); g.strokeStyle = '#d4af37'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 60); g.stroke(); g.fillStyle = '#d4af37'; g.beginPath(); g.arc(0, 66, 9, 0, 7); g.fill(); g.restore(); return true; }
      case 'ilot': { box(g, L, T + 14, w, h - 14, '#efe6d8', 6, 1.04, .9); g.fillStyle = lin(g, 0, T, 0, T + 16, [[0, '#f4f1ea'], [1, '#cfc8bc']]); roundRect(g, L - 6, T, w + 12, 16, 4); g.fill(); g.strokeStyle = 'rgba(150,150,160,.3)'; g.beginPath(); g.moveTo(L, T + 6); g.quadraticCurveTo(0, T + 12, -L, T + 4); g.stroke(); for (let i = 0; i < 4; i++) { g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2; g.strokeRect(L + 6 + i * (w - 12) / 4, T + 24, (w - 12) / 4 - 6, h - 34); g.fillStyle = '#9aa3b2'; g.fillRect(L + (i + .5) * (w - 12) / 4 - 8, T + 32, 16, 3); } g.font = '26px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.fillText('🍎', -60, T - 4); g.fillText('🥖', 30, T - 4); return true; }
      case 'jukebox': { g.fillStyle = lin(g, L, 0, -L, 0, [[0, '#8a1f1f'], [.5, '#e0503a'], [1, '#8a1f1f']]); g.beginPath(); g.moveTo(L, h / 2); g.lineTo(L, T + 40); g.arc(0, T + 40, w / 2, Math.PI, 0); g.lineTo(-L, h / 2); g.closePath(); g.fill(); const C = ['#ff2d55', '#ffd34d', '#34c759', '#2fa8ff', '#af52de']; g.lineWidth = 4; for (let i = 0; i < 3; i++) { g.strokeStyle = C[(i + Math.floor(t * 3)) % 5]; g.shadowColor = g.strokeStyle; g.shadowBlur = 10; g.beginPath(); g.arc(0, T + 40, w / 2 - 6 - i * 7, Math.PI, 0); g.stroke(); } g.shadowBlur = 0; g.fillStyle = '#1c1c24'; roundRect(g, L + 14, T + 46, w - 28, 40, 6); g.fill(); g.fillStyle = '#c3cad6'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(0, T + 54 + i * 9, 26, 3, 0, 0, 7); g.fill(); } metal(g, L + 10, T + 92, w - 20, 36, 6); g.fillStyle = '#1c1c24'; for (let i = 0; i < 5; i++) g.fillRect(L + 16 + i * 14, T + 100, 8, 20); return true; }
      case 'jardiniere': { wood(g, L, -6, w, h / 2 + 6, '#8a5a2b', 4); const F = ['🌷', '🌹', '🌻', '🌼', '🌺', '🌷']; g.font = '30px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom'; F.forEach((e, i) => g.fillText(e, L + 18 + i * (w - 36) / 5, -2 + Math.sin(t * 1.5 + i) * 1.5)); return true; }
      case 'karaoke': { box(g, L, T + 40, w, h - 40, '#2a1248', 8); g.fillStyle = '#05030a'; roundRect(g, L + 8, T + 50, w - 16, 40, 4); g.fill(); g.fillStyle = ['#ff4fd8', '#38dce6', '#ffd34d'][Math.floor(t * 2) % 3]; g.font = '800 10px Outfit, sans-serif'; g.textAlign = 'center'; g.fillText('♪ LA LA ♪', 0, T + 72); g.fillStyle = '#9aa3b2'; g.fillRect(-2, T, 4, 40); g.fillStyle = '#1c1c24'; roundRect(g, -8, T - 12, 16, 22, 8); g.fill(); g.fillStyle = '#c3cad6'; g.beginPath(); g.arc(0, T - 6, 7, 0, 7); g.fill(); for (let i = 0; i < 4; i++) { g.fillStyle = ['#ff2d55', '#34c759', '#ffd34d', '#2fa8ff'][i]; g.beginPath(); g.arc(L + 16 + i * 15, h / 2 - 18, 4, 0, 7); g.fill(); } return true; }
      case 'lave_linge': case 'seche_linge': { box(g, L, T, w, h, '#f4f6fa', 8, 1.02, .88); g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(L, T + 20, w, 2); g.fillStyle = '#1c1c24'; g.fillRect(w / 2 - 30, T + 7, 22, 7); g.fillStyle = '#c3cad6'; g.beginPath(); g.arc(L + 14, T + 10, 5, 0, 7); g.fill(); g.fillStyle = '#c3cad6'; g.beginPath(); g.arc(0, 14, 30, 0, 7); g.fill(); g.fillStyle = f.t === 'lave_linge' ? '#5aa9e6' : '#3a3a44'; g.beginPath(); g.arc(0, 14, 23, 0, 7); g.fill(); g.save(); g.beginPath(); g.arc(0, 14, 23, 0, 7); g.clip(); g.translate(0, 14); g.rotate(t * 4); g.fillStyle = f.t === 'lave_linge' ? 'rgba(255,255,255,.6)' : '#ff5fa2'; g.beginPath(); g.ellipse(8, 4, 12, 7, 0, 0, 7); g.fill(); g.fillStyle = '#ffd34d'; g.beginPath(); g.ellipse(-8, -6, 10, 6, 0, 0, 7); g.fill(); g.restore(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(-6, 8, 14, 3.6, 4.6); g.stroke(); return true; }
      case 'lampadaire': { g.fillStyle = '#2a2a32'; g.beginPath(); g.ellipse(L + 20, h / 2 - 4, 22, 6, 0, 0, 7); g.fill(); g.strokeStyle = lin(g, 0, T, 0, -T, [[0, '#eef1f6'], [1, '#7d8594']]); g.lineWidth = 5; g.beginPath(); g.moveTo(L + 20, h / 2 - 6); g.lineTo(L + 20, T + 40); g.quadraticCurveTo(L + 30, T, w / 2 - 20, T + 30); g.stroke(); glow(g, w / 2 - 20, T + 60, 70, 'rgba(255,225,150,A)', .25 + night * .4); g.fillStyle = lin(g, 0, T + 26, 0, T + 50, [[0, '#ffffff'], [1, '#c3cad6']]); g.beginPath(); g.moveTo(w / 2 - 44, T + 50); g.quadraticCurveTo(w / 2 - 20, T + 18, w / 2 + 4, T + 50); g.closePath(); g.fill(); return true; }
      case 'lits_superposes': { wood(g, L, T, 12, h, '#8a5a2b', 3); wood(g, w / 2 - 12, T, 12, h, '#8a5a2b', 3); for (const y of [T + 14, 10]) { g.fillStyle = '#ffffff'; roundRect(g, L + 12, y, w - 24, 70, 8); g.fill(); cushion(g, L + 18, y + 6, 46, 22, '#ffffff', 10); g.fillStyle = lin(g, 0, y + 30, 0, y + 70, [[0, shade(y < 0 ? '#2f6fd6' : A, 1.1)], [1, shade(y < 0 ? '#2f6fd6' : A, .8)]]); roundRect(g, L + 14, y + 30, w - 28, 40, 8); g.fill(); wood(g, L + 12, y + 68, w - 24, 10, '#6b4423', 3); } for (let i = 0; i < 4; i++) wood(g, w / 2 - 34, T + 20 + i * 22, 22, 5, '#a86b3a', 2); return true; }
      case 'lustre': { g.strokeStyle = '#d4af37'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, T - 30); g.lineTo(0, T + 10); g.stroke(); glow(g, 0, 10, 90, 'rgba(255,240,200,A)', .2 + night * .35); g.strokeStyle = '#d4af37'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, w / 2 - 10, 16, 0, 0, Math.PI); g.stroke(); g.beginPath(); g.ellipse(0, -12, w / 2 - 34, 10, 0, 0, Math.PI); g.stroke(); for (let i = 0; i < 9; i++) { const x = -w / 2 + 14 + i * (w - 28) / 8, y = Math.sin(i / 8 * Math.PI) * 16, sp = Math.sin(t * 3 + i) > .6; g.fillStyle = sp ? '#ffffff' : 'rgba(200,230,255,.85)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 12); g.lineTo(x, y + 22); g.lineTo(x - 4, y + 12); g.closePath(); g.fill(); g.fillStyle = '#fff3d6'; g.fillRect(x - 2, y - 12, 4, 10); } return true; }
      case 'micro_ondes': { box(g, L, T, w, h, '#2a2a32', 6, 1.4, .9); g.fillStyle = '#05030a'; roundRect(g, L + 6, T + 6, w - 26, h - 12, 4); g.fill(); g.fillStyle = 'rgba(255,200,90,.25)'; roundRect(g, L + 8, T + 8, w - 30, h - 16, 3); g.fill(); g.fillStyle = '#34ff6a'; g.font = '700 9px monospace'; g.textAlign = 'center'; g.fillText(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), w / 2 - 10, T + 14); g.fillStyle = '#9aa3b2'; for (let i = 0; i < 3; i++) g.fillRect(w / 2 - 16, T + 20 + i * 8, 12, 4); return true; }
      case 'meuble_tv': { box(g, L, T + 8, w, h - 14, '#3a3a44', 6, 1.2, .85); wood(g, L - 4, T, w + 8, 12, '#8a5a2b', 3); for (let i = 0; i < 3; i++) { g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; g.strokeRect(L + 8 + i * (w - 16) / 3, T + 18, (w - 16) / 3 - 6, h - 32); } g.fillStyle = '#1c1c24'; roundRect(g, -40, T + 22, 80, 16, 3); g.fill(); g.fillStyle = '#34ff6a'; g.fillRect(28, T + 28, 4, 3); g.font = '20px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.fillText('🎮', -90, T + 2); g.fillText('🪴', 110, T + 2); return true; }
      case 'niche': { g.fillStyle = lin(g, 0, T, 0, -T, [[0, '#c0392b'], [1, '#8a1f1f']]); g.beginPath(); g.moveTo(L - 6, T + 40); g.lineTo(0, T); g.lineTo(-L + 6, T + 40); g.closePath(); g.fill(); wood(g, L + 4, T + 36, w - 8, h - 40, '#b57a45', 4); g.fillStyle = '#2a1a0e'; g.beginPath(); g.moveTo(-26, h / 2); g.lineTo(-26, 0); g.arc(0, 0, 26, Math.PI, 0); g.lineTo(26, h / 2); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.font = '800 11px Outfit, sans-serif'; g.textAlign = 'center'; g.fillText('🦴 ' + (f.c || 'TOUTOU'), 0, T + 52); return true; }
      case 'ordi_gamer': { wood(g, L, -4, w, 12, '#1c1c24', 3); leg(g, L + 8, 8, h / 2 - 8, '#2a2a32'); leg(g, w / 2 - 14, 8, h / 2 - 8, '#2a2a32'); g.fillStyle = '#111'; roundRect(g, -56, T, 112, 66, 6); g.fill(); const hue = (t * 60) % 360; g.fillStyle = `hsl(${hue},80%,45%)`; roundRect(g, -50, T + 6, 100, 54, 3); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-50, T + 30, 100, 30); g.fillStyle = '#fff'; g.font = '700 9px monospace'; g.textAlign = 'center'; g.fillText('GAME ON', 0, T + 22); g.fillStyle = '#2a2a32'; g.fillRect(-6, T + 66, 12, 10); g.fillStyle = '#1c1c24'; roundRect(g, w / 2 - 40, T + 14, 34, 66, 4); g.fill(); g.strokeStyle = `hsl(${(hue + 120) % 360},90%,60%)`; g.lineWidth = 2; g.strokeRect(w / 2 - 36, T + 18, 26, 58); g.fillStyle = '#2a2a32'; roundRect(g, -40, -14, 66, 10, 3); g.fill(); g.fillStyle = `hsl(${(hue + 240) % 360},90%,60%)`; g.fillRect(-38, -12, 62, 2); return true; }
      case 'pouf': { cushion(g, L, T + 6, w, h - 6, A, 22); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, T + 10); g.lineTo(0, h / 2 - 4); g.moveTo(L + 6, 0); g.lineTo(-L - 6, 0); g.stroke(); return true; }
      case 'paravent': { for (let i = 0; i < 3; i++) { const x = L + i * w / 3; wood(g, x, T, w / 3 - 4, h - 10, '#3a2a1e', 3); g.fillStyle = '#f4ead2'; g.fillRect(x + 6, T + 6, w / 3 - 16, h - 22); g.strokeStyle = '#3a2a1e'; g.lineWidth = 2; g.strokeRect(x + 6, T + 6, w / 3 - 16, (h - 22) / 2); } g.font = '28px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.fillText('🌸', L + w / 6, T + 46); g.fillText('🏯', 0, T + 46); g.fillText('🌸', -L - w / 6, T + 46); return true; }
      case 'porte_manteau': { g.fillStyle = '#2a2a32'; g.beginPath(); g.ellipse(0, h / 2 - 4, 26, 6, 0, 0, 7); g.fill(); wood(g, -4, T + 10, 8, h - 14, '#6b4423', 3); g.strokeStyle = '#6b4423'; g.lineWidth = 4; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, T + 20); g.lineTo(s * 22, T + 8); g.stroke(); } g.fillStyle = shade(A, .8); g.beginPath(); g.moveTo(14, T + 14); g.lineTo(30, T + 14); g.lineTo(34, T + 90); g.lineTo(12, T + 90); g.closePath(); g.fill(); g.font = '26px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.fillText('🧣', -18, T + 40); g.fillText('🎩', -20, T + 8); return true; }
      case 'ping_pong': { leg(g, L + 20, -4, h / 2 + 4, '#2a2a32', 8); leg(g, w / 2 - 28, -4, h / 2 + 4, '#2a2a32', 8); g.fillStyle = lin(g, 0, T, 0, 0, [[0, '#2f6fd6'], [1, '#1a4a9a']]); roundRect(g, L, T, w, h - 30, 6); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(L + 4, T + 4, w - 8, h - 38); g.beginPath(); g.moveTo(L + 4, T + (h - 30) / 2); g.lineTo(-L - 4, T + (h - 30) / 2); g.stroke(); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-3, T - 8, 6, h - 22); g.strokeStyle = '#222'; g.lineWidth = 1; for (let y = T - 6; y < h / 2 - 32; y += 5) { g.beginPath(); g.moveTo(-3, y); g.lineTo(3, y); g.stroke(); } const bx = Math.sin(t * 3) * (w / 2 - 30); g.fillStyle = '#ff9500'; g.beginPath(); g.arc(bx, T + 30 - Math.abs(Math.cos(t * 3)) * 20, 5, 0, 7); g.fill(); return true; }
      case 'poubelle': { metal(g, L, T + 10, w, h - 10, 8); g.fillStyle = '#5c6470'; roundRect(g, L - 3, T + 4, w + 6, 10, 4); g.fill(); g.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 0; i < 4; i++) g.fillRect(L + 8 + i * 9, T + 20, 2, h - 30); return true; }
      case 'quilles': { for (let i = 0; i < 6; i++) { const r = i < 3 ? 0 : i < 5 ? 1 : 2, x = (i < 3 ? i - 1 : i < 5 ? i - 3.5 : 0) * 26, y = -r * 12; g.save(); g.translate(x, y + 10); g.fillStyle = lin(g, -9, 0, 9, 0, [[0, '#d8dde6'], [.5, '#ffffff'], [1, '#c3cad6']]); g.beginPath(); g.ellipse(0, 10, 10, 18, 0, 0, 7); g.ellipse(0, -14, 6, 9, 0, 0, 7); g.fill(); g.fillStyle = '#ff3b30'; g.fillRect(-6, -6, 12, 3); g.restore(); } g.fillStyle = lin(g, 30, 30, 50, 50, [[0, '#7a3fbf'], [1, '#2a1248']]); g.beginPath(); g.arc(38, 30, 16, 0, 7); g.fill(); g.fillStyle = '#111'; for (const [x, y] of [[34, 24], [42, 24], [38, 32]]) { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); } return true; }
      case 'radiateur': { for (let i = 0; i < 9; i++) metal(g, L + 4 + i * (w - 8) / 9, T, (w - 8) / 9 - 3, h, 5); metal(g, L, T + 8, w, 6, 2); metal(g, L, h / 2 - 14, w, 6, 2); g.strokeStyle = 'rgba(255,170,100,.35)'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { const yy = T - 6 - ((t * 20 + i * 10) % 28); g.beginPath(); g.moveTo(-30 + i * 30, yy + 10); g.quadraticCurveTo(-24 + i * 30, yy + 5, -30 + i * 30, yy); g.stroke(); } return true; }
      case 'frigo_us': { metal(g, L, T, w / 2 - 1, h, 10); metal(g, 1, T, w / 2 - 1, h, 10); g.fillStyle = '#5c6470'; roundRect(g, -10, T + 30, 4, 90, 2); g.fill(); roundRect(g, 6, T + 30, 4, 90, 2); g.fill(); g.fillStyle = '#1c1c24'; roundRect(g, L + 14, T + 22, 40, 50, 6); g.fill(); g.fillStyle = '#38dce6'; g.font = '700 11px monospace'; g.textAlign = 'center'; g.fillText('4°C', L + 34, T + 38); g.fillStyle = '#9aa3b2'; roundRect(g, L + 22, T + 46, 24, 18, 3); g.fill(); g.font = '20px "Noto Color Emoji", sans-serif'; g.fillText('🧲', 40, T + 50); g.fillText('📝', 54, T + 80); return true; }
      case 'rocking': { g.strokeStyle = '#5a3a1c'; g.lineWidth = 6; g.beginPath(); g.ellipse(0, h / 2 - 26, w / 2, 20, 0, .2, Math.PI - .2); g.stroke(); const sw = Math.sin(t * 1.6 + f.x) * .05; g.save(); g.rotate(sw); for (let i = 0; i < 5; i++) wood(g, L + 14 + i * (w - 28) / 5, T, (w - 28) / 5 - 3, h * .5, '#8a5a2b', 3); wood(g, L + 6, T + h * .48, w - 12, 12, '#9b6b3e', 3); cushion(g, L + 10, T + h * .42, w - 20, 14, A, 6); leg(g, L + 10, T + h * .55, h * .3, '#6b4423'); leg(g, w / 2 - 16, T + h * .55, h * .3, '#6b4423'); g.restore(); return true; }
      case 'sac_frappe': { g.strokeStyle = '#9aa3b2'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, T); g.lineTo(0, T + 20); g.stroke(); const sw = Math.sin(t * 2 + f.x) * .04; g.save(); g.translate(0, T + 20); g.rotate(sw); g.fillStyle = lin(g, -w / 2, 0, w / 2, 0, [[0, '#8a1f1f'], [.5, '#d9533a'], [1, '#8a1f1f']]); roundRect(g, -w / 2 + 6, 0, w - 12, h - 30, 22); g.fill(); g.fillStyle = '#1c1c24'; g.fillRect(-w / 2 + 6, 20, w - 12, 8); g.fillRect(-w / 2 + 6, h - 64, w - 12, 8); g.restore(); return true; }
      case 'tapis_course': { metal(g, L, -10, w, 30, 8); g.fillStyle = '#1c1c24'; roundRect(g, L + 8, -6, w - 30, 20, 6); g.fill(); g.strokeStyle = 'rgba(255,255,255,.15)'; g.lineWidth = 2; for (let i = 0; i < 8; i++) { const x = L + 12 + ((i * 22 - t * 80) % (w - 36) + (w - 36)) % (w - 36); g.beginPath(); g.moveTo(x, -4); g.lineTo(x, 12); g.stroke(); } metal(g, w / 2 - 24, T, 8, h / 2 + 4, 3); metal(g, w / 2 - 40, T - 4, 40, 26, 6); g.fillStyle = '#05030a'; roundRect(g, w / 2 - 36, T, 32, 18, 3); g.fill(); g.fillStyle = '#34ff6a'; g.font = '700 8px monospace'; g.textAlign = 'center'; g.fillText('8 km/h', w / 2 - 20, T + 12); return true; }
      case 'tabouret': { g.fillStyle = '#2a2a32'; g.beginPath(); g.ellipse(0, h / 2 - 4, 22, 6, 0, 0, 7); g.fill(); metal(g, -3, T + 14, 6, h - 18, 2); g.strokeStyle = '#9aa3b2'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 10, 16, 4, 0, 0, 7); g.stroke(); cushion(g, L, T, w, 18, A, 9); return true; }
      case 'telescope': { g.strokeStyle = '#3a3a44'; g.lineWidth = 4; for (const s of [-1, 0, 1]) { g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 30, h / 2); g.stroke(); } g.save(); g.translate(0, -6); g.rotate(-.7); g.fillStyle = lin(g, 0, -12, 0, 12, [[0, '#eef1f6'], [1, '#7d8594']]); roundRect(g, -40, -12, 100, 24, 8); g.fill(); g.fillStyle = '#2f6fd6'; g.fillRect(-40, -12, 18, 24); g.fillStyle = '#1c1c24'; roundRect(g, 58, -14, 10, 28, 3); g.fill(); g.restore(); return true; }
      case 'tapis_rond': { const R = w / 2; for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? shade(A, 1.25) : shade(A, .85); g.beginPath(); g.ellipse(0, 0, R - i * 20, (R - i * 20) * .55, 0, 0, 7); g.fill(); } g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.setLineDash([4, 6]); g.beginPath(); g.ellipse(0, 0, R - 8, (R - 8) * .55, 0, 0, 7); g.stroke(); g.setLineDash([]); return true; }
      case 'velo': { g.fillStyle = '#2a2a32'; g.fillRect(L + 10, h / 2 - 10, w - 20, 8); g.strokeStyle = '#c3cad6'; g.lineWidth = 6; g.beginPath(); g.moveTo(L + 30, h / 2 - 8); g.lineTo(-10, T + 40); g.lineTo(w / 2 - 30, T + 14); g.moveTo(-10, T + 40); g.lineTo(10, h / 2 - 8); g.stroke(); g.fillStyle = '#1c1c24'; roundRect(g, -30, T + 26, 36, 12, 6); g.fill(); metal(g, w / 2 - 44, T + 4, 30, 8, 3); g.fillStyle = '#05030a'; roundRect(g, w / 2 - 40, T - 14, 22, 16, 3); g.fill(); g.fillStyle = '#34ff6a'; g.fillRect(w / 2 - 36, T - 10, 14, 3); g.save(); g.translate(L + 40, 8); g.rotate(t * 6); g.strokeStyle = '#5c6470'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-22, 0); g.lineTo(22, 0); g.moveTo(0, -22); g.lineTo(0, 22); g.stroke(); g.restore(); return true; }
      case 'ventilateur': { g.fillStyle = '#2a2a32'; g.beginPath(); g.ellipse(0, h / 2 - 4, 24, 6, 0, 0, 7); g.fill(); metal(g, -3, T + 50, 6, h - 54, 2); g.fillStyle = 'rgba(200,210,225,.25)'; g.beginPath(); g.arc(0, T + 36, 34, 0, 7); g.fill(); g.strokeStyle = '#9aa3b2'; g.lineWidth = 2; g.beginPath(); g.arc(0, T + 36, 34, 0, 7); g.stroke(); g.save(); g.translate(0, T + 36); g.rotate(t * 14); g.fillStyle = 'rgba(240,245,255,.75)'; for (let i = 0; i < 3; i++) { g.rotate(Math.PI * 2 / 3); g.beginPath(); g.ellipse(0, -16, 8, 15, 0, 0, 7); g.fill(); } g.restore(); g.fillStyle = '#5c6470'; g.beginPath(); g.arc(0, T + 36, 6, 0, 7); g.fill(); return true; }
      case 'valise': { g.strokeStyle = '#3a3a44'; g.lineWidth = 4; g.beginPath(); g.moveTo(-16, T + 12); g.lineTo(-16, T); g.lineTo(16, T); g.lineTo(16, T + 12); g.stroke(); box(g, L, T + 12, w, h - 18, A, 10); g.fillStyle = 'rgba(0,0,0,.15)'; for (let i = 1; i < 4; i++) g.fillRect(L + i * w / 4 - 1, T + 16, 2, h - 26); g.fillStyle = '#1c1c24'; for (const x of [L + 10, w / 2 - 14]) { g.beginPath(); g.arc(x + 2, h / 2 - 4, 5, 0, 7); g.fill(); } g.font = '18px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.fillText('🌍', 0, 6); return true; }
      case 'vase': { g.fillStyle = lin(g, -20, 0, 20, 0, [[0, '#2f6fd6'], [.5, '#7fb8ff'], [1, '#1a4a9a']]); g.beginPath(); g.moveTo(-10, 0); g.quadraticCurveTo(-26, h / 4, -14, h / 2); g.lineTo(14, h / 2); g.quadraticCurveTo(26, h / 4, 10, 0); g.closePath(); g.fill(); g.font = '30px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('💐', 0, 6); return true; }
      case 'lit_eau': { wood(g, L, T - 16, w, 36, '#3a3a44', 10); g.fillStyle = '#1c1c24'; roundRect(g, L, T + 10, w, h - 14, 12); g.fill(); const wv = Math.sin(t * 1.8 + f.x); g.fillStyle = lin(g, 0, T + 16, 0, h / 2, [[0, '#7fd0ff'], [1, '#2f6fd6']]); roundRect(g, L + 8, T + 16, w - 16, h - 28, 10); g.fill(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { const y = T + 40 + i * 30; g.beginPath(); g.moveTo(L + 16, y + wv * 3); g.quadraticCurveTo(0, y + 8 - wv * 4, w / 2 - 16, y + wv * 3); g.stroke(); } cushion(g, L + 20, T + 20, w / 2 - 26, 28, '#ffffff', 12); cushion(g, 6, T + 20, w / 2 - 26, 28, '#ffffff', 12); return true; }
      case 'xylophone': { leg(g, L + 10, 0, h / 2, '#5a3a1c'); leg(g, w / 2 - 16, 0, h / 2, '#5a3a1c'); const C = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#007aff', '#5856d6', '#af52de']; C.forEach((c, i) => { const bh = 54 - i * 4; g.fillStyle = lin(g, 0, -bh / 2, 0, bh / 2, [[0, shade(c, 1.2)], [1, shade(c, .8)]]); roundRect(g, L + 8 + i * (w - 16) / 8, T + (h - bh) / 2 - 8, (w - 16) / 8 - 4, bh, 3); g.fill(); g.fillStyle = '#c3cad6'; g.beginPath(); g.arc(L + 8 + (i + .5) * (w - 16) / 8 - 2, T + (h - bh) / 2 - 2, 2, 0, 7); g.fill(); }); return true; }
      case 'zebre': { g.save(); g.beginPath(); g.moveTo(L + 30, T + 20); g.quadraticCurveTo(0, T - 10, -L - 30, T + 20); g.lineTo(-L, 0); g.lineTo(-L - 30, -T - 20); g.quadraticCurveTo(0, -T + 10, L + 30, -T - 20); g.lineTo(L, 0); g.closePath(); g.fillStyle = '#f4f1ea'; g.fill(); g.clip(); g.fillStyle = '#1c1c24'; for (let i = -8; i < 10; i++) { g.beginPath(); g.moveTo(i * 30, T); g.quadraticCurveTo(i * 30 + 18, 0, i * 30 - 4, -T); g.lineTo(i * 30 + 8, -T); g.quadraticCurveTo(i * 30 + 30, 0, i * 30 + 12, T); g.closePath(); g.fill(); } g.restore(); return true; }
    }
    return false;
  }

  // ---------- 🔄 les meubles vus « dans l'autre sens » (la longueur de haut en bas, le dossier sur le côté) ----------
  const SIDE = {
    table(g, f, d) { const w = d.w, h = d.h, L = -w / 2, T = -h / 2;
      g.fillStyle = '#5a3a1c'; g.fillRect(L + 8, h / 2 - 18, 8, 18); g.fillRect(-L - 16, h / 2 - 18, 8, 18);
      g.fillStyle = lin(g, L, 0, -L, 0, [[0, '#a8744a'], [.5, '#c99566'], [1, '#a8744a']]); roundRect(g, L, T, w, h - 20, 8); g.fill();
      g.strokeStyle = 'rgba(80,40,10,.18)'; g.lineWidth = 1; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(L + i * w / 5, T + 4); g.lineTo(L + i * w / 5, h / 2 - 24); g.stroke(); }
      wood(g, L, h / 2 - 28, w, 10, '#7a4f2b', 2);
      g.fillStyle = '#ffffff'; for (const y of [T + 34, h / 2 - 62]) { g.beginPath(); g.ellipse(0, y, 18, 10, 0, 0, 7); g.fill(); g.strokeStyle = '#d8dde6'; g.lineWidth = 1.5; g.stroke(); }
      g.fillStyle = 'rgba(180,220,255,.75)'; roundRect(g, -6, -20, 12, 22, 4); g.fill(); g.fillStyle = '#ff5fa2'; g.beginPath(); g.arc(-2, -24, 5, 0, 7); g.arc(4, -26, 5, 0, 7); g.fill(); g.fillStyle = '#2e9d57'; g.fillRect(-1, -22, 2, 8);
    },
    sofa(g, f, d, t, A) { const w = d.w, h = d.h, L = -w / 2, T = -h / 2;
      g.fillStyle = '#3a2a1e'; g.fillRect(-L - 10, T + 14, 7, 6); g.fillRect(-L - 10, h / 2 - 20, 7, 6);
      cushion(g, L, T + 10, 34, h - 20, shade(A, .85), 14); // dossier sur le côté
      for (let i = 0; i < 3; i++) cushion(g, L + 26, T + 30 + i * (h - 60) / 3, w - 30, (h - 60) / 3 - 3, A, 9); // assises
      cushion(g, L, T, w, 32, shade(A, .92), 14); cushion(g, L, h / 2 - 32, w, 32, shade(A, .92), 14); // accoudoirs
      cushion(g, L + 30, T + 36, 30, 40, '#fff3d6', 10); cushion(g, L + 30, h / 2 - 78, 30, 40, shade(A, 1.4), 10); // coussins
    },
    armchair(g, f, d, t, A) { const w = d.w, h = d.h, L = -w / 2, T = -h / 2;
      cushion(g, L, T + 8, 30, h - 16, shade(A, .85), 14); cushion(g, L + 22, T + 18, w - 24, h - 36, A, 10);
      cushion(g, L, T, w, 22, shade(A, .92), 10); cushion(g, L, h / 2 - 22, w, 22, shade(A, .92), 10);
    },
    chair(g, f, d, t, A) { const w = d.w, h = d.h, L = -w / 2, T = -h / 2;
      g.fillStyle = '#5a3a1c'; g.fillRect(L + 8, h / 2 - 12, 5, 12); g.fillRect(-L - 12, h / 2 - 12, 5, 12);
      wood(g, L + 6, T + 10, w - 10, h - 22, '#9b6b3e', 4); cushion(g, L + 10, T + 14, w - 18, h - 30, A, 6);
      for (let i = 0; i < 3; i++) wood(g, L, T + i * ((h - 16) / 3), 10, (h - 16) / 3 - 3, '#8a5a2b', 2); // le dossier, vu de côté
    },
    banc(g, f, d) { const w = d.w, h = d.h, L = -w / 2, T = -h / 2;
      g.fillStyle = '#3a2a1e'; g.fillRect(L + 6, h / 2 - 14, 6, 14); g.fillRect(-L - 12, h / 2 - 14, 6, 14);
      for (let i = 0; i < 3; i++) wood(g, L + 4 + i * (w - 8) / 3, T, (w - 8) / 3 - 4, h - 14, '#a86b3a', 3);
    },
  };
  // ---------- Les meubles réalistes ----------
  // f = { t, x, y, c (couleur du néon) }, d = définition, A = couleur de la déco. Renvoie true si le meuble a été dessiné.
  function draw(g, f, d, t, A, night) {
    if (f.o && SIDE[f.t]) { SIDE[f.t](g, f, d, t, A, night); return true; }
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
    return draw2(g, f, d, t, A, night);
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
    if (hs.floors >= 2) { g.save(); g.translate(40, 0); for (let i = 0; i < 7; i++) wood(g, 0, 186 - i * 26, 150 - i * 8, 22, floor ? '#6b4423' : '#8a5a2b', 2); g.restore(); g.font = '900 16px Outfit, sans-serif'; g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4; const lab = floor ? '⬇️ Rez-de-chaussée' : '⬆️ Étage'; g.strokeText(lab, 120, 18); g.fillText(lab, 120, 18); }
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
  return { NEON, STYLES, FURN, SIDE, draw, room, bigHouse, facade, setNight: f => { nightFn = f; } };
})();
window.Decor = Decor;
