// The Paradise — « L'Île du Paradise » : un monde en 2D, vu du dessus, où chaque membre est un petit personnage.
// Chaque salon est un lieu de l'île. On se déplace (clic / toucher / flèches), on parle avec des bulles,
// et on entre dans un salon en s'approchant de son bâtiment. Tout est dessiné par le navigateur.
const Island = (() => {
  const W = 2400, H = 1600;
  const onLand = (x, y) => { const dx = (x - 1200) / 1080, dy = (y - 800) / 700; return dx * dx + dy * dy < 0.93; };
  // Les lieux de l'île (un par salon) : position, icône, couleur néon, forme du bâtiment
  const PLACES = [
    { slug: 'general', label: 'Général', icon: '✨', x: 1200, y: 830, c: '#ff2d55', kind: 'tiki', big: true },
    { slug: 'douane', label: 'Vérification', icon: '🛂', x: 340, y: 800, c: '#ffffff', kind: 'hut' },
    { slug: 'patchnote', label: 'Patch note', icon: '📝', x: 2110, y: 760, c: '#7a5cff', kind: 'lighthouse' },
    { slug: 'fierte', label: 'Arc-en-ciel', icon: '🏳️‍🌈', x: 1240, y: 300, c: 'rainbow', kind: 'arch' },
    { slug: 'rencontres', label: 'Rencontres', icon: '💞', x: 870, y: 470, c: '#ff4fd8', kind: 'garden' },
    { slug: 'amitie', label: 'Amitié', icon: '🤝', x: 590, y: 570, c: '#2bff88', kind: 'hut' },
    { slug: '18-25', label: '18 – 25 ans', icon: '🎧', x: 1530, y: 430, c: '#2fa8ff', kind: 'house' },
    { slug: '25-40', label: '26 – 40 ans', icon: '🍷', x: 1800, y: 540, c: '#2fa8ff', kind: 'house' },
    { slug: '40-plus', label: '40 ans et +', icon: '🌙', x: 1960, y: 960, c: '#2fa8ff', kind: 'house' },
    { slug: 'membres', label: 'Salon VIP', icon: '💎', x: 1580, y: 780, c: 'rainbow', kind: 'villa' },
    { slug: 'gaming', label: 'Jeux vidéo', icon: '🎮', x: 560, y: 1050, c: '#b8c0d0', kind: 'house' },
    { slug: 'musique', label: 'Musique', icon: '🎵', x: 860, y: 1170, c: '#ff8a1f', kind: 'club' },
    { slug: 'karaoke', label: 'Karaoké', icon: '🎤', x: 1130, y: 1270, c: '#ff8a1f', kind: 'stage' },
    { slug: 'tv', label: 'TV du monde', icon: '📺', x: 1420, y: 1250, c: '#e8e8f0', kind: 'house' },
    { slug: 'roue', label: 'La Roue', icon: '🎡', x: 1690, y: 1110, c: 'gold', kind: 'kiosk' },
    { slug: 'blindtest', label: 'Blind Test', icon: '🎩', x: 1860, y: 1170, c: 'gold', kind: 'kiosk' },
    { slug: 'sommet', label: 'Le Sommet', icon: '🏔️', x: 2010, y: 1110, c: 'gold', kind: 'kiosk' },
    { slug: 'paroles', label: "Paroles d'Or", icon: '🎤', x: 1740, y: 1300, c: 'gold', kind: 'kiosk' },
    { slug: 'motdor', label: "Mot d'Or", icon: '✨', x: 1900, y: 1265, c: 'gold', kind: 'kiosk' },
    // Les lieux virtuels où l'on entre vraiment
    { inst: 'club', label: 'Paradise Club', icon: '🪩', x: 1000, y: 640, c: '#c64dff', kind: 'nightclub' },
    { inst: 'cinema', label: 'Ciné Paradise', icon: '🎬', x: 1380, y: 1010, c: '#ff2d55', kind: 'cinema' },
    { inst: 'houses', label: 'Les Maisons', icon: '🏠', x: 760, y: 880, c: '#ffd34d', kind: 'houses' },
    { inst: 'pool', label: 'Pool Party', icon: '🏊', x: 2010, y: 400, c: '#38dce6', kind: 'poolplace' },
    { inst: 'cafe', label: 'Café Paradise', icon: '☕', x: 1310, y: 560, c: '#ffd76a', kind: 'cafeplace' },
    { inst: 'arcade', label: 'Arcade', icon: '🕹️', x: 470, y: 1200, c: '#ff4fd8', kind: 'arcadeplace' },
    { inst: 'campfire', label: 'Feu de camp', icon: '🔥', x: 1010, y: 230, c: '#ff8a1f', kind: 'campplace' },
    { inst: 'fortune', label: 'La Voyante', icon: '🔮', x: 1650, y: 260, c: '#c64dff', kind: 'fortuneplace' },
  ];
  const RAINBOW = ['#ff2d55', '#ff9500', '#ffe600', '#34ff6a', '#2fa8ff', '#c64dff'];
  // pendant une soirée, les lumières du club prennent les couleurs du thème
  const PAL = () => { const c = window.EventState?.live?.colors; return c ? [...c, ...c] : RAINBOW; };
  const neonOf = p => (p.role === 'admin' || p.role === 'superadmin') ? '#ff2d55' : p.gender === 'f' ? '#ff4fd8' : p.gender === 'h' ? '#2fa8ff' : '#c3b8ff';
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  let lowFx = false, lastKick = 0, root, cv, ctx, terrain, open = false, me = null, players = new Map(), cam = { x: 1200, y: 900 }, zoom = 1, target = null, keys = new Set(), lastSent = 0, raf = 0, last = 0;
  const imgs = new Map(), emotes = [], palms = [], deco = [], leaves = [];
  const img = src => { if (!src) return null; let i = imgs.get(src); if (!i) { i = new Image(); i.src = src; imgs.set(src, i); } return i.complete && i.naturalWidth ? i : null; };

  // ---------- Le décor fixe (dessiné une seule fois) ----------
  window.Decor?.setNight(() => nightLevel());
  function buildTerrain() {
    terrain = document.createElement('canvas'); terrain.width = W; terrain.height = H;
    const g = terrain.getContext('2d');
    // sable
    const sand = g.createRadialGradient(1200, 800, 300, 1200, 800, 1150);
    sand.addColorStop(0, '#f6dca0'); sand.addColorStop(1, '#e7c27a');
    g.fillStyle = sand; g.beginPath(); g.ellipse(1200, 800, 1080 * Math.sqrt(.93), 700 * Math.sqrt(.93), 0, 0, Math.PI * 2); g.fill();
    // écume
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 10; g.beginPath(); g.ellipse(1200, 800, 1080 * Math.sqrt(.93) + 6, 700 * Math.sqrt(.93) + 6, 0, 0, Math.PI * 2); g.stroke();
    // herbe au centre, avec des bords irréguliers
    g.fillStyle = '#5fbf6a';
    g.beginPath();
    for (let a = 0; a <= Math.PI * 2 + .01; a += .05) {
      const r = 1 + .05 * Math.sin(a * 7) + .03 * Math.sin(a * 13);
      const x = 1200 + Math.cos(a) * 880 * r, y = 800 + Math.sin(a) * 540 * r;
      a ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.fill();
    // taches d'herbe plus foncée
    seed = 5;
    for (let i = 0; i < 160; i++) { const x = 400 + rnd() * 1600, y = 330 + rnd() * 940; if (!onLand(x, y)) continue; g.fillStyle = `rgba(40,140,70,${.15 + rnd() * .2})`; g.beginPath(); g.ellipse(x, y, 20 + rnd() * 60, 12 + rnd() * 30, rnd() * 3, 0, Math.PI * 2); g.fill(); }
    // chemins de sable : de la grande place vers chaque lieu
    g.strokeStyle = '#ecd29a'; g.lineCap = 'round'; g.lineWidth = 34;
    for (const p of PLACES) { if (p.slug === 'general') continue; g.beginPath(); g.moveTo(1200, 860); g.quadraticCurveTo((1200 + p.x) / 2 + (p.y - 800) * .15, (860 + p.y) / 2 - (p.x - 1200) * .1, p.x, p.y + 40); g.stroke(); }
    g.strokeStyle = 'rgba(180,140,80,.25)'; g.lineWidth = 3; g.setLineDash([2, 14]);
    for (const p of PLACES) { if (p.slug === 'general') continue; g.beginPath(); g.moveTo(1200, 860); g.quadraticCurveTo((1200 + p.x) / 2 + (p.y - 800) * .15, (860 + p.y) / 2 - (p.x - 1200) * .1, p.x, p.y + 40); g.stroke(); }
    g.setLineDash([]);
    // grande place ronde
    g.fillStyle = '#ecd29a'; g.beginPath(); g.ellipse(1200, 870, 190, 120, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 4; g.beginPath(); g.ellipse(1200, 870, 190, 120, 0, 0, Math.PI * 2); g.stroke();
    // le ponton de la Vérification
    g.fillStyle = '#9b6b3e'; g.fillRect(70, 785, 190, 30); for (let i = 0; i < 9; i++) { g.fillStyle = '#7d522c'; g.fillRect(78 + i * 20, 785, 4, 30); }
    // fleurs et cailloux
    seed = 21;
    for (let i = 0; i < 260; i++) { const x = 300 + rnd() * 1800, y = 250 + rnd() * 1100; if (!onLand(x, y) || PLACES.some(p => Math.hypot(p.x - x, p.y - y) < 110)) continue; deco.push({ x, y, t: rnd() < .75 ? 'f' : 'r', c: ['#ff5fa2', '#ffe600', '#ffffff', '#c64dff', '#ff9500'][Math.floor(rnd() * 5)] }); }
    for (const d of deco) { if (d.t === 'f') { g.fillStyle = d.c; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(d.x + Math.cos(k * 1.26) * 4, d.y + Math.sin(k * 1.26) * 4, 3, 0, 7); g.fill(); } g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(d.x, d.y, 2.4, 0, 7); g.fill(); } else { g.fillStyle = '#a7a39b'; g.beginPath(); g.ellipse(d.x, d.y, 9, 6, 0, 0, 7); g.fill(); } }
    // palmiers (dessinés à chaque image pour bouger avec le vent)
    seed = 33;
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, r = .72 + rnd() * .22;
      const x = 1200 + Math.cos(a) * 1080 * Math.sqrt(.93) * r, y = 800 + Math.sin(a) * 700 * Math.sqrt(.93) * r;
      if (PLACES.some(p => Math.hypot(p.x - x, p.y - y) < 120)) continue;
      palms.push({ x, y, s: .8 + rnd() * .5, p: rnd() * 6 });
    }
    palms.sort((a, b) => a.y - b.y);
  }

  // ---------- Dessins animés ----------
  function drawWater(t, x0, y0, x1, y1) {
    const night = nightLevel();
    const sea = ctx.createLinearGradient(0, y0, 0, y1);
    sea.addColorStop(0, mix('#19b5d8', '#08243f', night)); sea.addColorStop(1, mix('#0a7fb8', '#04142a', night));
    ctx.fillStyle = sea; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = `rgba(255,255,255,${.18 - night * .1})`; ctx.lineWidth = 3;
    for (let y = Math.floor(y0 / 60) * 60; y < y1; y += 60) {
      ctx.beginPath();
      for (let x = x0; x < x1; x += 30) { const yy = y + Math.sin(x * .02 + t * 1.6 + y) * 6; x === x0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
      ctx.stroke();
    }
  }
  function drawPalm(p, t) {
    const sway = Math.sin(t * 1.2 + p.p) * .08;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.s, p.s);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(14, 6, 34, 10, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -40, 4 + sway * 60, -78); ctx.stroke();
    ctx.translate(4 + sway * 60, -78); ctx.rotate(sway);
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * Math.PI * 2;
      ctx.fillStyle = k % 2 ? '#1fa85a' : '#2bc56c';
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a - .3) * 30, Math.sin(a - .3) * 18 - 8, Math.cos(a) * 46, Math.sin(a) * 26 + 10);
      ctx.quadraticCurveTo(Math.cos(a + .3) * 26, Math.sin(a + .3) * 14, 0, 0); ctx.fill();
    }
    ctx.fillStyle = '#7a4a1f'; ctx.beginPath(); ctx.arc(-4, 4, 5, 0, 7); ctx.arc(5, 5, 5, 0, 7); ctx.fill();
    ctx.restore();
  }
  function neonColor(c, t, k = 0) { if (c === 'rainbow') return RAINBOW[Math.floor(t * 2 + k) % RAINBOW.length]; if (c === 'gold') return '#ffc94d'; return c; }
  function drawPlace(p, t, count) {
    const col = neonColor(p.c, t);
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 34, p.big ? 110 : 64, p.big ? 26 : 16, 0, 0, 7); ctx.fill();
    const flick = (Math.sin(t * 9 + p.x) > .96) ? .5 : 1;
    ctx.shadowColor = col; ctx.shadowBlur = 18 * flick;
    if (p.kind === 'lighthouse') {
      ctx.fillStyle = '#f4f4f8'; ctx.beginPath(); ctx.moveTo(-22, 30); ctx.lineTo(-14, -90); ctx.lineTo(14, -90); ctx.lineTo(22, 30); ctx.fill();
      ctx.fillStyle = '#ff2d55'; for (let i = 0; i < 3; i++) ctx.fillRect(-20 + i * 2, -40 + i * -30 + 20, 40 - i * 4, 12);
      ctx.fillStyle = col; ctx.fillRect(-16, -112, 32, 22); ctx.fillStyle = '#3a2c6e'; ctx.beginPath(); ctx.moveTo(-20, -112); ctx.lineTo(0, -130); ctx.lineTo(20, -112); ctx.fill();
      // faisceau la nuit
      const n = nightLevel();
      if (n > .2) { ctx.shadowBlur = 0; ctx.save(); ctx.translate(0, -100); ctx.rotate(t * .9); const gr = ctx.createLinearGradient(0, 0, 420, 0); gr.addColorStop(0, `rgba(255,250,200,${.45 * n})`); gr.addColorStop(1, 'rgba(255,250,200,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(420, -60); ctx.lineTo(420, 60); ctx.fill(); ctx.restore(); }
    } else if (p.kind === 'arch') {
      ctx.lineWidth = 12;
      RAINBOW.forEach((c, i) => { ctx.strokeStyle = c; ctx.shadowColor = c; ctx.beginPath(); ctx.arc(0, 30, 92 - i * 12, Math.PI, 0); ctx.stroke(); });
    } else if (p.kind === 'kiosk') {
      ctx.fillStyle = '#3a2608'; ctx.fillRect(-36, -30, 72, 60);
      ctx.fillStyle = '#ffc94d'; ctx.beginPath(); ctx.moveTo(-46, -30); ctx.lineTo(0, -66); ctx.lineTo(46, -30); ctx.fill();
      ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 3; ctx.strokeRect(-36, -30, 72, 60);
      ctx.fillStyle = '#1c1204'; ctx.fillRect(-12, 4, 24, 26);
    } else if (p.kind === 'tiki') {
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-96, -10, 14, 46); ctx.fillRect(82, -10, 14, 46);
      ctx.fillStyle = '#c99b4f'; ctx.beginPath(); ctx.moveTo(-130, -6); ctx.lineTo(0, -92); ctx.lineTo(130, -6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a77a35'; ctx.lineWidth = 3; for (let i = -120; i < 130; i += 16) { ctx.beginPath(); ctx.moveTo(i, -6); ctx.lineTo(i * .3, -80); ctx.stroke(); }
      ctx.fillStyle = '#6e4420'; ctx.fillRect(-80, 8, 160, 22);
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(-80, 8, 160, 22);
    } else if (p.kind === 'garden') {
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.fillStyle = i % 2 ? '#ff4fd8' : '#ff8fc0'; ctx.beginPath(); ctx.arc(Math.cos(a) * 46, Math.sin(a) * 22, 16, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#ff2d6f'; ctx.font = '54px serif'; ctx.textAlign = 'center'; ctx.fillText('❤', 0, 18);
    } else if (p.kind === 'stage') {
      ctx.fillStyle = '#2a1238'; ctx.fillRect(-70, -40, 140, 70); ctx.fillStyle = '#ff8a1f'; ctx.fillRect(-70, -48, 140, 10);
      ctx.fillStyle = '#c21e3a'; ctx.fillRect(-70, -40, 20, 70); ctx.fillRect(50, -40, 20, 70);
    } else if (p.kind === 'club') {
      ctx.fillStyle = '#1a0f2e'; ctx.fillRect(-64, -46, 128, 76); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(-64, -46, 128, 76);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = RAINBOW[(i + Math.floor(t * 4)) % 6]; ctx.fillRect(-54 + i * 24, -36, 16, 8); }
    } else if (p.kind === 'villa') {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-70, -40, 140, 70); ctx.fillStyle = '#c64dff'; ctx.beginPath(); ctx.moveTo(-82, -40); ctx.lineTo(0, -88); ctx.lineTo(82, -40); ctx.fill();
      ctx.fillStyle = '#38dce6'; ctx.fillRect(-56, -22, 30, 22); ctx.fillRect(26, -22, 30, 22); ctx.fillStyle = '#ffd76a'; ctx.fillRect(-12, 0, 24, 30);
      ctx.fillStyle = '#2fd0ff'; ctx.beginPath(); ctx.ellipse(0, 52, 60, 12, 0, 0, 7); ctx.fill(); // piscine
    } else if (p.kind === 'nightclub') {
      ctx.fillStyle = '#1a0b2e'; ctx.fillRect(-80, -54, 160, 86);
      ctx.fillStyle = '#2a1248'; ctx.fillRect(-88, -64, 176, 14);
      for (let i = 0; i < 7; i++) { ctx.fillStyle = RAINBOW[(i + Math.floor(t * 5)) % 6]; ctx.beginPath(); ctx.arc(-66 + i * 22, -57, 4, 0, 7); ctx.fill(); }
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(-80, -54, 160, 86);
      ctx.fillStyle = '#0c0616'; ctx.fillRect(-16, 2, 32, 30); ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 2; ctx.strokeRect(-16, 2, 32, 30);
      ctx.shadowBlur = 0; ctx.save(); ctx.globalAlpha = .35;
      for (let k = 0; k < 2; k++) { ctx.save(); ctx.translate(k ? 60 : -60, -64); ctx.rotate(Math.sin(t * 1.5 + k * 2) * .6 - .0); ctx.fillStyle = RAINBOW[(k * 3 + Math.floor(t)) % 6]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, -190); ctx.lineTo(30, -190); ctx.fill(); ctx.restore(); }
      ctx.restore();
    } else if (p.kind === 'cinema') {
      ctx.fillStyle = '#5a0f1e'; ctx.fillRect(-84, -50, 168, 82);
      ctx.fillStyle = '#ffd76a'; ctx.fillRect(-90, -64, 180, 22);
      ctx.fillStyle = '#5a0f1e'; ctx.font = '900 16px Outfit, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CINÉMA', 0, -52);
      for (let i = 0; i < 12; i++) { ctx.fillStyle = (i + Math.floor(t * 6)) % 2 ? '#fff6c0' : '#a8862a'; ctx.beginPath(); ctx.arc(-84 + i * 15.3, -66, 3, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#1b0508'; ctx.fillRect(-20, 0, 40, 32); ctx.fillStyle = '#c21e3a'; ctx.fillRect(-66, -30, 30, 40); ctx.fillRect(36, -30, 30, 40);
    } else if (p.kind === 'houses') {
      ctx.shadowBlur = 0;
      // le quartier : des maisons de tous les styles, certaines avec un étage
      if (window.Decor) { Decor.facade(ctx, 'chalet', 1, '#ff8a1f', -92, 28, .62); Decor.facade(ctx, 'moderne', 2, '#38dce6', 0, 10, .62); Decor.facade(ctx, 'plage', 1, '#2fa8ff', 92, 28, .62); Decor.facade(ctx, 'japon', 2, '#ff2d55', -46, -34, .5); Decor.facade(ctx, 'chateau', 2, '#c64dff', 52, -36, .46); }
    } else if (p.kind === 'poolplace') {
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; roundRect(-84, -40, 168, 80, 22); ctx.fill();
      ctx.fillStyle = '#2fd0ff'; roundRect(-74, -30, 148, 60, 18); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let x = -70; x <= 70; x += 10) { const yy = -14 + i * 14 + Math.sin(x * .1 + t * 3 + i) * 3; x === -70 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke(); }
      ctx.font = '34px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⛱️', 74, -36);
    } else if (p.kind === 'cafeplace') {
      ctx.fillStyle = '#f2e0c0'; ctx.fillRect(-70, -40, 140, 70);
      for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#c21e3a'; ctx.beginPath(); ctx.moveTo(-80 + i * 23, -40); ctx.lineTo(-57 + i * 23, -40); ctx.lineTo(-57 + i * 23, -24); ctx.arc(-68.5 + i * 23, -24, 11.5, 0, Math.PI); ctx.fill(); }
      ctx.fillStyle = '#5b3a29'; ctx.fillRect(-12, 0, 24, 30); ctx.fillStyle = '#a8e4ff'; ctx.fillRect(-56, -10, 34, 26); ctx.fillRect(22, -10, 34, 26);
    } else if (p.kind === 'arcadeplace') {
      ctx.fillStyle = '#1a0b2e'; ctx.fillRect(-74, -50, 148, 80); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(-74, -50, 148, 80);
      ctx.shadowBlur = 0; ctx.font = '28px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(['👾', '🎰', '🎯', '🧸'][Math.floor(t * 1.5) % 4], 0, -12);
      ctx.fillStyle = '#0c0616'; ctx.fillRect(-14, 4, 28, 26);
    } else if (p.kind === 'fortuneplace') {
      // la roulotte de la Voyante
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#4a1a6e'; roundRect(-74, -44, 148, 70, 14); ctx.fill();
      ctx.fillStyle = '#7a2cb8'; ctx.beginPath(); ctx.moveTo(-82, -44); ctx.quadraticCurveTo(0, -96, 82, -44); ctx.fill();
      for (let i = 0; i < 6; i++) { ctx.fillStyle = (i + Math.floor(t * 3)) % 2 ? '#ffd76a' : '#ff4fd8'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✦', -60 + i * 24, -54 + Math.abs(i - 2.5) * 5); }
      ctx.fillStyle = '#ffd76a'; ctx.fillRect(-18, -30, 36, 40); ctx.fillStyle = '#2a0a40'; ctx.fillRect(-14, -26, 28, 36);
      const glow = 10 + Math.sin(t * 3) * 4; ctx.shadowColor = '#c64dff'; ctx.shadowBlur = glow * 2; ctx.fillStyle = '#d9a6ff'; ctx.beginPath(); ctx.arc(0, -8, 9, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      for (const wx of [-48, 48]) { ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(wx, 28, 14, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(wx - 14, 28); ctx.lineTo(wx + 14, 28); ctx.moveTo(wx, 14); ctx.lineTo(wx, 42); ctx.stroke(); }
    } else if (p.kind === 'campplace') {
      ctx.shadowBlur = 0; ctx.fillStyle = '#5a3216'; ctx.fillRect(-30, 10, 60, 10); drawFlame(0, 12, .35, t);
      ctx.font = '40px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⛺', -70, -4); ctx.fillText('⛺', 70, -4);
    } else { // house / hut
      const hut = p.kind === 'hut';
      ctx.fillStyle = hut ? '#b07a42' : '#efe6d8'; ctx.fillRect(-48, -30, 96, 60);
      ctx.fillStyle = hut ? '#d6a65a' : '#3a2c6e'; ctx.beginPath(); ctx.moveTo(-58, -30); ctx.lineTo(0, -72); ctx.lineTo(58, -30); ctx.fill();
      ctx.fillStyle = '#3b2412'; ctx.fillRect(-11, 2, 22, 28);
      ctx.fillStyle = nightLevel() > .4 ? '#ffe28a' : '#9fdcff'; ctx.fillRect(-38, -16, 18, 14); ctx.fillRect(20, -16, 18, 14);
    }
    ctx.shadowBlur = 0;
    // icône
    ctx.font = (p.big ? 46 : 34) + 'px "Noto Color Emoji", "Apple Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.icon, 0, p.kind === 'lighthouse' ? -150 : p.kind === 'arch' ? -6 : p.big ? -46 : p.kind === 'houses' ? -88 : p.inst ? -96 : -46 - (p.kind === 'kiosk' ? 28 : 12));
    // enseigne néon avec le nom
    const label = p.label, y = p.big ? 74 : 60;
    ctx.font = `900 ${p.big ? 26 : 19}px Outfit, Inter, sans-serif`;
    const w = ctx.measureText(label).width + 22;
    ctx.fillStyle = 'rgba(10,6,20,.82)'; roundRect(-w / 2, y - 15, w, 30, 10); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.shadowColor = col; ctx.shadowBlur = 12 * flick; roundRect(-w / 2, y - 15, w, 30, 10); ctx.stroke();
    ctx.fillStyle = p.c === 'rainbow' ? neonColor(p.c, t, 2) : col; ctx.fillText(label, 0, y + 1); ctx.shadowBlur = 0;
    if (count) { ctx.font = '800 14px Outfit, Inter, sans-serif'; ctx.fillStyle = '#33d6a6'; ctx.fillText(`🟢 ${count}`, 0, y + 28); }
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function drawPlayer(p, t) {
    const col = neonOf(p), moving = p.moving;
    const act = moving ? '' : p.action;
    const dancing = act === 'dance' || act === 'dj';
    const bob = moving ? Math.abs(Math.sin(t * 12)) * 5 : dancing ? Math.abs(Math.sin(t * 9 + p.id)) * 9 : act === 'sit' ? (kind === 'cinema' ? 16 : 8) : act === 'sleep' ? -6 : Math.sin(t * 2 + p.id) * 1.2;
    const pose = p.pose;
    ctx.save(); ctx.translate(pose ? pose.x : p.dx, pose ? pose.y : p.dy);
    if (dancing) ctx.rotate(Math.sin(t * 4.5 + p.id) * .22);
    if (act === 'sleep' && !pose) ctx.rotate(-.5);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 22, 18, 6, 0, 0, 7); ctx.fill();
    let y = -14 - bob, r = 18;
    if (p.mode !== 'photo' && window.Look) {
      // 🧍 le personnage créé par le membre (il regarde dans le sens où il marche)
      if (p.prevX != null && Math.abs(p.dx - p.prevX) > .3) p.dir = p.dx > p.prevX ? 1 : -1;
      p.prevX = p.dx;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = .55; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.beginPath(); ctx.ellipse(0, 22, 15, 5, 0, 0, 7); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      const h = p.mode === 'creature' && Look.drawCreature ? Look.drawCreature(ctx, p.look?.creature, { t, walking: moving, dir: p.dir || 1, act, seed: p.id }) : Look.draw(ctx, p.look, { t, walking: moving, dir: p.dir || 1, act, seed: p.id, id: p.id, gender: p.gender });
      y = h.headY; r = 15;
      // 🛏️ dans le lit : la couette par-dessus · 🛁 dans le bain : l'eau et la mousse
      if (pose?.type === 'lie') { const d = pose.d, A = (THEME[house?.theme] || THEME.cosy).accent; ctx.fillStyle = A; roundRect(-d.w / 2 + 8, -12, d.w - 16, d.h - 52, 12); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.35)'; roundRect(-d.w / 2 + 8, -12, d.w - 16, 12, 6); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '16px sans-serif'; ctx.fillText('💤', 22, -48 - ((t * 20) % 20)); }
      if (pose?.type === 'soak') { const d = pose.d; ctx.fillStyle = 'rgba(80,190,255,.88)'; ctx.beginPath(); ctx.ellipse(0, 4, d.w / 2 - 16, 18, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.95)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(-34 + i * 10, -6 + Math.sin(t * 3 + i) * 3, 5 + (i % 3) * 2, 0, 7); ctx.fill(); } }
    } else {
    // petit corps
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-14, 20 - bob); ctx.quadraticCurveTo(0, -4 - bob, 14, 20 - bob); ctx.closePath(); ctx.fill();
    // tête = photo de profil dans un rond néon
    ctx.shadowColor = col; ctx.shadowBlur = 14;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, y, r + 3, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.save(); ctx.beginPath(); ctx.arc(0, y, r, 0, 7); ctx.clip();
    const im = img(p.avatar);
    if (im) ctx.drawImage(im, -r, y - r, r * 2, r * 2);
    else { ctx.fillStyle = p.color || '#8b6cff'; ctx.fillRect(-r, y - r, r * 2, r * 2); ctx.fillStyle = '#fff'; ctx.font = '900 18px Outfit, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((p.username || '?')[0].toUpperCase(), 0, y + 1); }
    ctx.restore();
    }
    // dans la piscine : on nage !
    if (inPool(p.dx, p.dy)) {
      ctx.fillStyle = 'rgba(30,170,230,.92)'; ctx.fillRect(-26, -2, 52, 30);
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -1, 24 + Math.sin(t * 4 + p.id) * 3, 7, 0, 0, 7); ctx.stroke();
    }
    // pseudo en néon
    ctx.font = '800 14px Outfit, Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(p.username, 0, 40);
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.fillText(p.username, 0, 40); ctx.shadowBlur = 0;
    // ce que fait le personnage
    const ICON = { dance: '💃', drink: '🍹', dj: '🎧', sit: '🪑', popcorn: '🍿', sleep: '💤', cook: '🍳', dive: '🤿', tan: '😎', read: '📖', work: '💻', watch: '🐠', warm: '🔥', bath: '🛁', piano: '🎹', play: '🕹️', cheers: '🥂', slot: '🎰', darts: '🎯', claw: '🧸', marshmallow: '🍡', guitar: '🎸', wish: '🌠' };
    if (p.item && p.itemAt > Date.now() - 120000) { ctx.font = '22px "Noto Color Emoji", "Apple Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.item, -24, y + 14); }
    if (p.prize) { ctx.font = '18px "Noto Color Emoji", "Apple Color Emoji", sans-serif'; ctx.fillText(p.prize, -22, 18); }
    if (act && ICON[act] && act !== 'eat') {
      ctx.font = '22px "Noto Color Emoji", "Apple Color Emoji", sans-serif';
      const k = (t * 1.2 + p.id * .37) % 1;
      if (act === 'sleep' || dancing) { ctx.globalAlpha = 1 - k; ctx.fillText(act === 'sleep' ? '💤' : '🎵', 22 + k * 10, y - 18 - k * 36); ctx.globalAlpha = 1; }
      if (act !== 'sleep') ctx.fillText(ICON[act], 24, y + 4 + Math.sin(t * 5) * 2);
    }
    if (p.id === me) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.ellipse(0, 22, 24, 8, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    // bulle de chat
    if (p.said && Date.now() - p.saidAt < 6000) {
      const a = Math.min(1, (6000 - (Date.now() - p.saidAt)) / 600);
      ctx.globalAlpha = a; ctx.font = '700 14px Outfit, Inter, sans-serif';
      const lines = wrap(p.said, 190), bw = Math.min(210, Math.max(...lines.map(l => ctx.measureText(l).width)) + 20), bh = lines.length * 18 + 12, by = y - r - 14 - bh;
      ctx.fillStyle = '#fff'; roundRect(-bw / 2, by, bw, bh, 10); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-7, by + bh); ctx.lineTo(0, by + bh + 9); ctx.lineTo(7, by + bh); ctx.fill();
      ctx.fillStyle = '#1a1030'; lines.forEach((l, i) => ctx.fillText(l, 0, by + 15 + i * 18));
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function drawPet(p, t, moving) {
    const pet = p.pet, size = { bebe: 30, ado: 36, adulte: 42, legende: 48 }[pet.stage] || 34;
    const hop = moving ? Math.abs(Math.sin(t * 14 + p.id)) * 7 : Math.abs(Math.sin(t * 2.5 + p.id)) * 2;
    ctx.save(); ctx.translate(p.px, p.py); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 6, size * .45, size * .16, 0, 0, 7); ctx.fill();
    // un petit halo pour bien voir l'animal
    const halo = ctx.createRadialGradient(0, -size * .45 - hop, 2, 0, -size * .45 - hop, size * .8); halo.addColorStop(0, 'rgba(255,255,255,.45)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, -size * .45 - hop, size * .8, 0, 7); ctx.fill();
    if (pet.stage === 'legende') { ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 16; }
    ctx.font = `${size}px "Noto Color Emoji", "Apple Color Emoji", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    if ((p.px > p.dx) !== (p.petSide < 0)) ctx.scale(-1, 1);
    if (pet.creature && window.Look?.drawCreature) { const k = size / 46; ctx.save(); ctx.translate(0, 4 - hop - 20 * k); ctx.scale(k, k); Look.drawCreature(ctx, pet.species, { t, walking: moving, seed: p.id + 7 }); ctx.restore(); }
    else { ctx.fillStyle = '#000'; ctx.fillText(pet.icon, 0, 4 - hop); }
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.save(); ctx.translate(p.px, p.py);
    if (pet.acc) { ctx.font = `${Math.round(size * .55)}px "Noto Color Emoji", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(pet.acc, 0, 4 - hop - size * .78); }
    if (pet.stage === 'legende' && Math.sin(t * 3 + p.id) > .6) { ctx.font = '12px sans-serif'; ctx.fillText('✨', size * .5, -size * .8); }
    if (pet.mood === 'sad' || pet.mood === 'starving') { ctx.globalAlpha = .5 + .5 * Math.sin(t * 3); ctx.font = '13px sans-serif'; ctx.fillText(pet.mood === 'starving' ? '🍖' : '💧', size * .55, -size * .55); ctx.globalAlpha = 1; }
    else if (pet.mood === 'happy' && (t + p.id) % 6 < .8) { ctx.font = '13px sans-serif'; ctx.fillText('💕', size * .55, -size * .7 - ((t + p.id) % 6) * 12); }
    ctx.restore();
  }
  // Le personnage utilise vraiment le meuble : couché dans le lit, assis sur la chaise, dans le bain…
  const SEAT_Y = { sofa: d => -d.h / 2 + 36, armchair: d => -d.h / 2 + d.h * .42, throne: d => -d.h / 2 + d.h * .42, chair: d => d.h * .05 - 10 };
  function poseOf(p) {
    if (kind !== 'house' || p.moving || !p.action) return null;
    let best = null, bd = 140;
    for (const f of furn()) {
      const d = FURN[f.t]; if (!d || d.act !== p.action) continue;
      const s = furnSpot(f), dist = Math.hypot(s.x - p.dx, s.y - p.dy);
      if (dist < bd) { bd = dist; best = { f, d }; }
    }
    if (!best) return null;
    const { f, d } = best, z = f.y + d.h / 2 + 2;
    if (p.action === 'sleep' && (f.t === 'bed')) return { type: 'lie', x: f.x, y: f.y - d.h / 2 + 62, z, d };
    if (p.action === 'bath') return { type: 'soak', x: f.x, y: f.y - 4, z, d };
    if (p.action === 'sit' && SEAT_Y[f.t]) return { type: 'seat', x: f.x, y: f.y + SEAT_Y[f.t](d), z, d };
    return null;
  }
  function wrap(text, max) {
    const words = text.split(' '), out = []; let line = '';
    for (const w of words) { const t2 = line ? line + ' ' + w : w; if (ctx.measureText(t2).width > max && line) { out.push(line); line = w; } else line = t2; }
    if (line) out.push(line); return out.slice(0, 4);
  }
  // Jour et nuit selon l'heure de Paris
  function nightLevel() {
    const h = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: 'numeric' }).split(':').map(Number);
    const x = h[0] + (h[1] || 0) / 60;
    if (x >= 8 && x < 18) return 0; if (x >= 18 && x < 21) return (x - 18) / 3 * .75; if (x >= 21 || x < 6) return .75; return .75 - (x - 6) / 2 * .75;
  }
  const mix = (a, b, k) => { const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; };


  // ======================================================================
  //  Les lieux virtuels : 🪩 boîte de nuit, 🎬 cinéma, 🏠 maisons
  // ======================================================================
  const SCENES = {
    island: { W, H, walk: onLand },
    club: { W: 1200, H: 760, walk: (x, y) => x > 60 && x < 1140 && y > 290 && y < 720, screen: { x: 400, y: 28, w: 400, h: 225 } },
    cinema: { W: 1200, H: 800, walk: (x, y) => x > 60 && x < 1140 && y > 575 && y < 770, screen: { x: 200, y: 30, w: 800, h: 450 } },
    house: { W: 1100, H: 720, walk: (x, y) => x > 60 && x < 1040 && y > 250 && y < 680, screen: { x: 110, y: 52, w: 300, h: 169 } },
  };
  const SEATS = []; for (const sy of [612, 672, 732]) for (let sx = 140; sx <= 1060; sx += 70) if (Math.abs(sx - 600) > 40) SEATS.push({ x: sx, y: sy });
  // Les endroits où l'on peut faire quelque chose
  const HOTS = {
    island: [{ action: 'dance', icon: '💃', label: 'Danser' }],
    club: [
      { action: 'dance', icon: '💃', label: 'Danser', x: 600, y: 470, spread: 200 },
      { action: 'drink', icon: '🍹', label: 'Boire un verre', x: 285, y: 470, spread: 110 },
      { action: 'dj', icon: '🎧', label: 'Aux platines', x: 600, y: 302, spread: 60 },
      { action: 'sit', icon: '🛋️', label: 'Se poser', x: 1040, y: 500, spread: 60 },
      { exit: true, icon: '🚪', label: 'Sortir', x: 600, y: 712 },
    ],
    cinema: [
      { action: 'sit', icon: '🪑', label: 'S\'asseoir', seat: true },
      { action: 'popcorn', icon: '🍿', label: 'Pop-corn', x: 120, y: 595 },
      { exit: true, icon: '🚪', label: 'Sortir', x: 600, y: 762 },
    ],
    house: [
      { action: 'sit', icon: '🛋️', label: 'Canapé', x: 280, y: 365, spread: 80 },
      { action: 'cook', icon: '🍳', label: 'Cuisiner', x: 860, y: 272, spread: 40 },
      { action: 'drink', icon: '🥤', label: 'Le frigo', x: 1005, y: 275 },
      { action: 'sleep', icon: '💤', label: 'Dormir', x: 930, y: 555, spread: 50 },
      { action: 'dance', icon: '💃', label: 'Danser', x: 540, y: 480, spread: 80 },
      { exit: true, icon: '🚪', label: 'Sortir', x: 550, y: 672 },
    ],
  };
  const THEME = {
    cosy: { name: 'Cosy', wall: '#f3e3c8', floor: '#c08a5a', accent: '#e07a5f' },
    ocean: { name: 'Océan', wall: '#cdeffc', floor: '#7fb7c9', accent: '#1d7ea8' },
    rose: { name: 'Rose bonbon', wall: '#ffe0ef', floor: '#e7b2c9', accent: '#ff4fa3' },
    nuit: { name: 'Nuit étoilée', wall: '#272046', floor: '#3b3166', accent: '#9b7bff' },
    jungle: { name: 'Jungle', wall: '#dff3d6', floor: '#8aa86a', accent: '#2e9d57' },
    or: { name: 'Palais doré', wall: '#fff1c4', floor: '#c9a24a', accent: '#d99a00' },
  };
  // ======================================================================
  //  Encore plus de lieux : 🏊 piscine, ☕ café, 🕹️ arcade, 🔥 feu de camp
  // ======================================================================
  Object.assign(SCENES, {
    pool: { W: 1200, H: 760, walk: (x, y) => x > 60 && x < 1140 && y > 230 && y < 720, screen: { x: 470, y: 22, w: 260, h: 146 } },
    cafe: { W: 1100, H: 720, walk: (x, y) => x > 60 && x < 1040 && y > 250 && y < 680, screen: { x: 820, y: 26, w: 220, h: 124 } },
    arcade: { W: 1200, H: 760, walk: (x, y) => x > 60 && x < 1140 && y > 280 && y < 720 },
    campfire: { W: 1200, H: 760, walk: (x, y) => x > 60 && x < 1140 && y > 260 && y < 720 },
  });
  const CAFE_TABLES = [[230, 380], [230, 560], [520, 450], [780, 380], [780, 560]];
  const CAFE_SEATS = CAFE_TABLES.flatMap(([x, y]) => [{ x: x - 62, y: y + 8 }, { x: x + 62, y: y + 8 }]);
  const FIRE = { x: 600, y: 470 };
  const CAMP_SEATS = Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return { x: FIRE.x + Math.cos(a) * 165, y: FIRE.y + Math.sin(a) * 105 + 10 }; });
  const SEAT_LISTS = { cinema: SEATS, cafe: CAFE_SEATS, camp: CAMP_SEATS };
  const POOL = { x0: 300, y0: 300, x1: 900, y1: 600 };
  const inPool = (x, y) => kind === 'pool' && x > POOL.x0 && x < POOL.x1 && y > POOL.y0 && y < POOL.y1;
  Object.assign(HOTS, {
    pool: [
      { action: 'dive', icon: '🤿', label: 'Plonger', x: 600, y: 268 },
      { action: 'swim', icon: '🏊', label: 'Nager', x: 600, y: 450, spread: 420 },
      { ball: true, icon: '🏐', label: 'Le ballon' },
      { action: 'tan', icon: '😎', label: 'Bronzer', x: 165, y: 470, spread: 30, rows: [330, 430, 530, 630] },
      { action: 'drink', icon: '🍹', label: 'Cocktail', x: 1040, y: 450, spread: 120 },
      { action: 'dance', icon: '💃', label: 'Danser' },
      { exit: true, icon: '🚪', label: 'Sortir', x: 600, y: 712 },
    ],
    cafe: [
      { action: 'eat', menu: true, icon: '🍽️', label: 'Commander', x: 860, y: 285, spread: 120 },
      { action: 'sit', icon: '🪑', label: 'S\'asseoir', seat: 'cafe' },
      { action: 'piano', instrument: 'piano', icon: '🎹', label: 'Piano', x: 975, y: 655 },
      { action: 'cheers', icon: '🥂', label: 'Trinquer' },
      { exit: true, icon: '🚪', label: 'Sortir', x: 550, y: 672 },
    ],
    arcade: [
      { game: 'slot', icon: '🎰', label: 'Machine à sous', x: 270, y: 330, spread: 240 },
      { game: 'claw', icon: '🧸', label: 'Pince à peluches', x: 600, y: 345 },
      { hidden: true, icon: '🔍', label: 'Objets cachés' },
      { game: 'darts', icon: '🎯', label: 'Fléchettes', x: 985, y: 385, spread: 60 },
      { babyfoot: true, icon: '⚽', label: 'Babyfoot', x: 600, y: 618 },
      { action: 'play', icon: '🕹️', label: 'Jeux rétro', x: 200, y: 630, spread: 160 },
      { action: 'dance', icon: '💃', label: 'Danser' },
      { exit: true, icon: '🚪', label: 'Sortir', x: 600, y: 712 },
    ],
    campfire: [
      { action: 'sit', icon: '🪵', label: 'S\'asseoir', seat: 'camp' },
      { action: 'marshmallow', icon: '🍡', label: 'Chamallows', seat: 'camp' },
      { action: 'guitar', instrument: 'guitar', icon: '🎸', label: 'Guitare', seat: 'camp' },
      { action: 'wish', icon: '🌠', label: 'Faire un vœu' },
      { action: 'dance', icon: '💃', label: 'Danser' },
      { exit: true, icon: '🚪', label: 'Sortir', x: 600, y: 712 },
    ],
  });
  const MENU = [['☕', 'Café'], ['🍵', 'Thé'], ['🥐', 'Croissant'], ['🍰', 'Gâteau'], ['🍕', 'Pizza'], ['🍔', 'Burger'], ['🍦', 'Glace'], ['🧋', 'Bubble tea'], ['🍾', 'Champagne'], ['🥗', 'Salade']];

  // ---------- Les meubles des maisons ----------
  // spot : où l'on se place pour s'en servir ('front' = devant, 'center' = dessus)
  const FURN = {
    sofa: { name: 'Canapé', icon: '🛋️', w: 270, h: 84, act: 'sit', spot: 'front' },
    armchair: { name: 'Fauteuil', icon: '💺', w: 84, h: 80, act: 'sit', spot: 'front' },
    bed: { name: 'Lit', icon: '🛏️', w: 200, h: 170, act: 'sleep', spot: 'center' },
    table: { name: 'Table', icon: '🍽️', w: 170, h: 110, act: 'sit', spot: 'front' },
    kitchen: { name: 'Cuisine', icon: '🍳', w: 220, h: 76, act: 'cook', spot: 'front' },
    fridge: { name: 'Frigo', icon: '🧊', w: 80, h: 186, act: 'drink', spot: 'front' },
    tv: { name: 'Télé', icon: '📺', w: 312, h: 200 },
    rug: { name: 'Tapis', icon: '🟣', w: 340, h: 160, act: 'dance', spot: 'center', flat: true },
    plant: { name: 'Plante', icon: '🪴', w: 56, h: 70 },
    lamp: { name: 'Lampe', icon: '💡', w: 44, h: 100 },
    shelf: { name: 'Bibliothèque', icon: '📚', w: 120, h: 150, act: 'read', spot: 'front' },
    piano: { name: 'Piano', icon: '🎹', w: 150, h: 90, act: 'piano', spot: 'front' },
    aquarium: { name: 'Aquarium', icon: '🐠', w: 140, h: 96, act: 'watch', spot: 'front' },
    fireplace: { name: 'Cheminée', icon: '🔥', w: 170, h: 130, act: 'warm', spot: 'front' },
    desk: { name: 'Bureau', icon: '💻', w: 150, h: 84, act: 'work', spot: 'front' },
    bath: { name: 'Baignoire', icon: '🛁', w: 190, h: 96, act: 'bath', spot: 'center' },
    arcade: { name: 'Borne d\'arcade', icon: '🕹️', w: 74, h: 120, act: 'play', spot: 'front' },
    painting: { name: 'Tableau', icon: '🖼️', w: 100, h: 76 },
    babyfoot: { name: 'Babyfoot', icon: '⚽', w: 200, h: 112, act: 'babyfoot', spot: 'front' },
    // 💰 meubles rares de la boutique
    throne: { name: 'Trône royal', icon: '👑', w: 110, h: 130, act: 'sit', spot: 'front', rare: 'furn_throne' },
    jacuzzi: { name: 'Jacuzzi', icon: '🫧', w: 200, h: 140, act: 'bath', spot: 'center', rare: 'furn_jacuzzi' },
    djbooth: { name: 'Platines de DJ', icon: '🎧', w: 200, h: 90, act: 'dj', spot: 'front', rare: 'furn_djbooth' },
    statue: { name: 'Statue en or', icon: '🗿', w: 80, h: 140, rare: 'furn_statue' },
    neonsign: { name: 'Néon « Paradise »', icon: '💡', w: 220, h: 70, rare: 'furn_neonsign' },
  };
  Object.assign(FURN, window.Decor?.FURN || {});
  const ACT_LABEL = { coffee: 'Un café', mirror: 'Le miroir', dress: 'Se changer', sit: 'S\'asseoir', sleep: 'Dormir', cook: 'Cuisiner', drink: 'Le frigo', dance: 'Danser', read: 'Lire', piano: 'Piano', watch: 'Les poissons', warm: 'Se réchauffer', work: 'Travailler', bath: 'Prendre un bain', play: 'Jouer', babyfoot: 'Babyfoot', dj: 'Mixer' };
  const DEFAULT_FURN = [
    { t: 'tv', x: 260, y: 140 }, { t: 'sofa', x: 280, y: 322 }, { t: 'rug', x: 540, y: 470 }, { t: 'kitchen', x: 870, y: 208 },
    { t: 'fridge', x: 1025, y: 153 }, { t: 'bed', x: 940, y: 555 }, { t: 'plant', x: 80, y: 262 }, { t: 'plant', x: 1060, y: 660 }, { t: 'lamp', x: 455, y: 200 },
  ];
  let editing = false, draft = [], sel = -1, drag = null;
  let floorNow = 0;
  const furnAll = () => (editing ? draft : house?.furniture || DEFAULT_FURN);
  const furn = () => furnAll().filter(f => (f.l || 0) === floorNow);
  const clampWalk = (x, y) => ({ x: Math.max(75, Math.min(1025, x)), y: Math.max(262, Math.min(668, y)) });
  const furnSpot = f => { const d = FURN[f.t]; return d.spot === 'center' ? clampWalk(f.x, f.y) : clampWalk(f.x, f.y + d.h / 2 + 14); };
  function houseHots() {
    const seen = new Set(), out = [];
    for (const f of furn()) {
      const d = FURN[f.t];
      if (!d?.act || seen.has(d.act + (d.act === 'sit' ? f.t : ''))) continue;
      seen.add(d.act + (d.act === 'sit' ? f.t : ''));
      const s = furnSpot(f);
      out.push({ action: d.act, icon: d.icon, label: d.act === 'sit' ? d.name : ACT_LABEL[d.act], x: s.x, y: s.y, spread: d.spot === 'center' ? Math.min(60, d.w / 3) : 20, instrument: d.act === 'piano' ? 'piano' : undefined, babyfoot: d.act === 'babyfoot' || undefined });
    }
    if (house?.floors === 2) out.unshift({ stairs: true, icon: floorNow ? '⬇️' : '⬆️', label: floorNow ? 'Descendre' : 'Monter à l\'étage', x: 140, y: 282 });
    if (!floorNow) out.push({ exit: true, icon: '🚪', label: 'Sortir', x: 550, y: 672 });
    return out;
  }
  const hots = () => (kind === 'house' ? houseHots() : HOTS[kind]);
  const screenRect = () => { if (kind !== 'house') return SCENES[kind].screen; const tv = furn().find(f => f.t === 'tv'); return tv ? { x: tv.x - 150, y: tv.y - 94, w: 300, h: 169 } : null; };
  function drawFurn(f, t, th) {
    const d = FURN[f.t];
    if (!d) return;
    ctx.save(); ctx.translate(f.x, f.y); if (f.f && f.t !== 'neonsign' && f.t !== 'statue') ctx.scale(-1, 1);
    const w = d.w, h = d.h, A = th.accent;
    ctx.fillStyle = 'rgba(0,0,0,.14)'; if (!d.flat && !d.neon && f.t !== 'painting') { ctx.beginPath(); ctx.ellipse(0, h / 2, w / 2, 9, 0, 0, 7); ctx.fill(); }
    if (window.Decor && Decor.draw(ctx, f, d, t, A, nightLevel())) { ctx.restore(); if (f.t === 'tv') drawScreen(t); return; }
    switch (f.t) {
      case 'sofa': ctx.fillStyle = A; roundRect(-w / 2 + 10, -h / 2, w - 20, 40, 12); ctx.fill(); roundRect(-w / 2, -h / 2 + 12, 30, h - 12, 10); ctx.fill(); roundRect(w / 2 - 30, -h / 2 + 12, 30, h - 12, 10); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.28)'; roundRect(-w / 2 + 30, -h / 2 + 38, w - 60, 30, 8); ctx.fill(); break;
      case 'armchair': ctx.fillStyle = A; roundRect(-w / 2, -h / 2, w, h, 14); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.3)'; roundRect(-w / 2 + 12, -h / 2 + 22, w - 24, h - 30, 8); ctx.fill(); break;
      case 'bed': ctx.fillStyle = '#6b4a2b'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = '#fff'; ctx.fillRect(-w / 2 + 10, -h / 2 + 10, w - 20, 40); ctx.fillStyle = A; ctx.fillRect(-w / 2 + 10, -h / 2 + 55, w - 20, h - 62); ctx.fillStyle = 'rgba(255,255,255,.2)'; for (let i = 0; i < 3; i++) ctx.fillRect(-w / 2 + 10, -h / 2 + 70 + i * 30, w - 20, 6); break;
      case 'table': ctx.fillStyle = '#7a4f2b'; for (const [cx, cy] of [[-70, 0], [70, 0], [0, -40], [0, 46]]) { ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.fill(); } ctx.fillStyle = '#a8743f'; ctx.beginPath(); ctx.ellipse(0, 0, 62, 36, 0, 0, 7); ctx.fill(); ctx.font = '22px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🍽️', 0, 0); break;
      case 'kitchen': ctx.fillStyle = '#e8e8ee'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = '#444'; ctx.fillRect(-50, -h / 2 + 12, 70, 40); for (const bx of [-32, -2]) { ctx.strokeStyle = '#ff7a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, -h / 2 + 32, 9, 0, 7); ctx.stroke(); } ctx.fillStyle = '#9fd8ff'; ctx.fillRect(40, -h / 2 + 14, 50, 30); break;
      case 'fridge': ctx.fillStyle = '#d8dde6'; roundRect(-w / 2, -h / 2, w, h, 8); ctx.fill(); ctx.fillStyle = '#b8bfcc'; ctx.fillRect(-w / 2, -h / 2 + 62, w, 3); ctx.fillStyle = '#8a93a3'; ctx.fillRect(-w / 2 + 10, -h / 2 + 20, 6, 30); ctx.fillRect(-w / 2 + 10, -h / 2 + 80, 6, 40); break;
      case 'tv': ctx.fillStyle = '#4a3020'; ctx.fillRect(-160, 82, 320, 22); ctx.fillStyle = '#111'; ctx.fillRect(-156, -100, 312, 181); break;
      case 'rug': ctx.fillStyle = A; ctx.globalAlpha = .45; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, 7); ctx.fill(); ctx.globalAlpha = .7; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.ellipse(0, 0, w / 2 - 16, h / 2 - 12, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; break;
      case 'plant': ctx.font = '52px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🪴', 0, 0); break;
      case 'lamp': { const n = nightLevel(); ctx.fillStyle = `rgba(255,240,180,${.2 + n * .45})`; ctx.beginPath(); ctx.arc(0, -30, 60, 0, 7); ctx.fill(); ctx.fillStyle = '#555'; ctx.fillRect(-3, -30, 6, 76); ctx.fillRect(-14, 44, 28, 6); ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.moveTo(-20, -24); ctx.lineTo(20, -24); ctx.lineTo(12, -50); ctx.lineTo(-12, -50); ctx.fill(); break; }
      case 'shelf': ctx.fillStyle = '#6b4a2b'; ctx.fillRect(-w / 2, -h / 2, w, h); for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) { ctx.fillStyle = RAINBOW[(i + r * 2) % 6]; ctx.fillRect(-w / 2 + 10 + i * 17, -h / 2 + 12 + r * 46, 12, 34); } break;
      case 'piano': ctx.fillStyle = '#141018'; roundRect(-w / 2, -h / 2, w, h, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-w / 2 + 8, h / 2 - 30, w - 16, 22); ctx.fillStyle = '#111'; for (let i = 0; i < 12; i++) if (i % 7 !== 2 && i % 7 !== 6) ctx.fillRect(-w / 2 + 16 + i * 11, h / 2 - 30, 6, 12); break;
      case 'aquarium': ctx.fillStyle = '#5a3a1c'; ctx.fillRect(-w / 2, h / 2 - 16, w, 16); ctx.fillStyle = 'rgba(80,190,255,.75)'; ctx.fillRect(-w / 2, -h / 2, w, h - 16); ctx.font = '22px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🐠', Math.sin(t) * 40, -10); ctx.fillText('🐟', Math.cos(t * .8) * 45, 16); break;
      case 'fireplace': ctx.fillStyle = '#8a4a32'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = '#2a1208'; ctx.fillRect(-w / 2 + 30, -h / 2 + 40, w - 60, h - 40); drawFlame(0, h / 2 - 8, 0.55, t); break;
      case 'desk': ctx.fillStyle = '#9b6b3e'; ctx.fillRect(-w / 2, -h / 2, w, 46); ctx.fillRect(-w / 2 + 6, -h / 2 + 46, 10, 36); ctx.fillRect(w / 2 - 16, -h / 2 + 46, 10, 36); ctx.font = '30px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💻', 0, -h / 2 + 20); break;
      case 'bath': ctx.fillStyle = '#fff'; roundRect(-w / 2, -h / 2, w, h, 30); ctx.fill(); ctx.fillStyle = '#9fe0ff'; roundRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 22); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-60 + i * 24, -10 + Math.sin(t * 2 + i) * 6, 9, 0, 7); ctx.fill(); } break;
      case 'arcade': ctx.fillStyle = '#2a1248'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = RAINBOW[Math.floor(t * 3) % 6]; ctx.fillRect(-w / 2 + 8, -h / 2 + 12, w - 16, 40); ctx.fillStyle = '#ff2d55'; ctx.beginPath(); ctx.arc(-12, 10, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe600'; ctx.beginPath(); ctx.arc(12, 14, 6, 0, 7); ctx.fill(); break;
      case 'babyfoot': drawBabyTable(0, 0, w, h, t); break;
      case 'throne': ctx.fillStyle = '#d99a00'; roundRect(-w / 2, -h / 2, w, h, 16); ctx.fill(); ctx.fillStyle = '#b01e3a'; roundRect(-w / 2 + 14, -h / 2 + 26, w - 28, h - 40, 10); ctx.fill(); ctx.fillStyle = '#ffd76a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-30 + i * 30 - 12, -h / 2 + 6); ctx.lineTo(-30 + i * 30, -h / 2 - 16); ctx.lineTo(-30 + i * 30 + 12, -h / 2 + 6); ctx.fill(); } ctx.fillStyle = '#38dce6'; ctx.beginPath(); ctx.arc(0, -h / 2 + 14, 6, 0, 7); ctx.fill(); break;
      case 'jacuzzi': ctx.fillStyle = '#e8e8ee'; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#2fd0ff'; ctx.beginPath(); ctx.ellipse(0, 0, w / 2 - 14, h / 2 - 14, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 10; i++) { const a = i * 2.4 + t * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * (w / 3) * ((i % 3) / 3 + .3), Math.sin(a) * (h / 3) * ((i % 3) / 3 + .3), 4 + Math.abs(Math.sin(t * 3 + i)) * 4, 0, 7); ctx.fill(); } break;
      case 'djbooth': ctx.fillStyle = '#1a0b2e'; roundRect(-w / 2, -h / 2, w, h, 10); ctx.fill(); ctx.strokeStyle = RAINBOW[Math.floor(t * 4) % 6]; ctx.lineWidth = 4; roundRect(-w / 2, -h / 2, w, h, 10); ctx.stroke(); for (const dx of [-55, 55]) { ctx.fillStyle = '#0b0614'; ctx.beginPath(); ctx.arc(dx, -4, 26, 0, 7); ctx.fill(); ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(dx, -4); ctx.lineTo(dx + Math.cos(t * 5) * 24, -4 + Math.sin(t * 5) * 24); ctx.stroke(); } ctx.font = '22px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎧', 0, -4); break;
      case 'statue': ctx.fillStyle = '#8a6a20'; ctx.fillRect(-w / 2, h / 2 - 26, w, 26); ctx.fillStyle = '#ffd76a'; ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 16 + Math.sin(t * 3) * 6; ctx.font = '86px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🗿', 0, -14); ctx.shadowBlur = 0; break;
      case 'neonsign': { ctx.fillStyle = '#140a24'; roundRect(-w / 2, -h / 2, w, h, 12); ctx.fill(); const c = RAINBOW[Math.floor(t * 2) % 6]; ctx.shadowColor = c; ctx.shadowBlur = 18; ctx.fillStyle = c; ctx.font = '900 30px Outfit, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PARADISE', 0, 2); ctx.shadowBlur = 0; if (f.f) { /* le texte reste lisible même retourné */ } break; }
      case 'painting': ctx.fillStyle = '#c9a24a'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = '#ffb0d0'; ctx.fillRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16); ctx.fillStyle = '#ff9500'; ctx.beginPath(); ctx.arc(14, -6, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#2e9d57'; ctx.beginPath(); ctx.moveTo(-w / 2 + 8, h / 2 - 8); ctx.lineTo(-10, -4); ctx.lineTo(w / 2 - 8, h / 2 - 8); ctx.fill(); break;
    }
    ctx.restore();
    if (f.t === 'tv') drawScreen(t);
  }
  // Une table de babyfoot vue de dessus (dans l'arcade et dans les maisons)
  function drawBabyTable(x, y, w, h, t) {
    ctx.fillStyle = '#5a3a1c'; roundRect(x - w / 2, y - h / 2, w, h, 10); ctx.fill();
    ctx.fillStyle = '#2e9d57'; ctx.fillRect(x - w / 2 + 12, y - h / 2 + 10, w - 24, h - 20);
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - h / 2 + 10); ctx.lineTo(x, y + h / 2 - 10); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const rx = x - w / 2 + 22 + i * (w - 44) / 7;
      ctx.fillStyle = '#c0c6cc'; ctx.fillRect(rx - 1.5, y - h / 2 - 6, 3, h + 12);
      ctx.fillStyle = [0, 1, 3, 5].includes(i) ? '#ff2d55' : '#2fa8ff';
      const n = [1, 2, 3, 4, 4, 3, 2, 1][i];
      for (let k = 0; k < n; k++) ctx.fillRect(rx - 4, y - h / 2 + 14 + (k + .5) * (h - 28) / n - 5 + Math.sin(t * 2 + i) * 3, 8, 10);
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + Math.sin(t * 1.3) * 40, y + Math.cos(t * 1.7) * 20, 4, 0, 7); ctx.fill();
  }
  function drawFlame(x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const tongue = (xo, w, h, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(xo - w, 0); ctx.bezierCurveTo(xo - w * 1.1, -h * .45, xo - w * .2, -h * .6, xo + Math.sin(t * 6 + xo) * w * .4, -h); ctx.bezierCurveTo(xo + w * .3, -h * .6, xo + w * 1.1, -h * .45, xo + w, 0); ctx.closePath(); ctx.fill(); };
    ctx.shadowColor = '#ff7a1f'; ctx.shadowBlur = 30;
    [[-38, 26, 100], [38, 26, 95], [-14, 30, 140], [16, 30, 130]].forEach(([xo, w, h], i) => tongue(xo, w, h * (.8 + .2 * Math.sin(t * 8 + i * 2)), '#ff3b1f'));
    ctx.shadowBlur = 0;
    [[-24, 20, 80], [22, 20, 76], [0, 26, 110]].forEach(([xo, w, h], i) => tongue(xo, w, h * (.8 + .2 * Math.sin(t * 9 + i)), '#ff8a1f'));
    [[-8, 14, 58], [10, 14, 52]].forEach(([xo, w, h], i) => tongue(xo, w, h * (.8 + .2 * Math.sin(t * 11 + i * 3)), '#ffd34d'));
    ctx.restore();
  }

  // ---------- Dessin des nouveaux lieux ----------
  let ball = null, fx = [];
  const ballAt = (b, tnow) => {
    let { x, y, vx, vy } = b; const BOX = [80, 250, 1120, 705];
    const steps = Math.min(600, Math.max(0, Math.floor((tnow - b.at) / 16.67)));
    for (let i = 0; i < steps; i++) {
      x += vx / 60; y += vy / 60; vx *= 0.985; vy *= 0.985;
      if (x < BOX[0]) { x = BOX[0]; vx = -vx; } if (x > BOX[2]) { x = BOX[2]; vx = -vx; } if (y < BOX[1]) { y = BOX[1]; vy = -vy; } if (y > BOX[3]) { y = BOX[3]; vy = -vy; }
      if (Math.abs(vx) + Math.abs(vy) < 4) break;
    }
    return { x, y };
  };
  function drawPool(t) {
    const n = nightLevel();
    const sky = ctx.createLinearGradient(0, 0, 0, 200); sky.addColorStop(0, mix('#6fd3ff', '#0b1640', n)); sky.addColorStop(1, mix('#bdf0ff', '#24306a', n));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 1200, 150);
    ctx.fillStyle = mix('#1fb7d6', '#08243f', n); ctx.fillRect(0, 150, 1200, 60);
    ctx.font = '44px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n > .4 ? '🌙' : '☀️', 120, 60); ctx.fillText('🌴', 330, 150); ctx.fillText('🌴', 880, 150); ctx.fillText('⛵', 1040 + Math.sin(t * .3) * 30, 165);
    ctx.fillStyle = '#f1e3c4'; ctx.fillRect(0, 205, 1200, 555);
    ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 2; for (let x = 0; x < 1200; x += 60) { ctx.beginPath(); ctx.moveTo(x, 205); ctx.lineTo(x, 760); ctx.stroke(); } for (let y = 205; y < 760; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke(); }
    // la piscine
    ctx.fillStyle = '#ffffff'; roundRect(POOL.x0 - 14, POOL.y0 - 14, POOL.x1 - POOL.x0 + 28, POOL.y1 - POOL.y0 + 28, 30); ctx.fill();
    const wg = ctx.createLinearGradient(0, POOL.y0, 0, POOL.y1); wg.addColorStop(0, '#2fd0ff'); wg.addColorStop(1, '#0a7fd0');
    ctx.fillStyle = wg; roundRect(POOL.x0, POOL.y0, POOL.x1 - POOL.x0, POOL.y1 - POOL.y0, 22); ctx.fill();
    ctx.save(); roundRect(POOL.x0, POOL.y0, POOL.x1 - POOL.x0, POOL.y1 - POOL.y0, 22); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) { ctx.beginPath(); for (let x = POOL.x0; x <= POOL.x1; x += 20) { const y = POOL.y0 + 20 + i * 21 + Math.sin(x * .03 + t * 2 + i) * 5; x === POOL.x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#c0c6cc'; ctx.fillRect(POOL.x1 - 50, POOL.y0 - 18, 6, 40); ctx.fillRect(POOL.x1 - 30, POOL.y0 - 18, 6, 40);
    // le plongeoir
    ctx.fillStyle = '#3a7bd5'; ctx.fillRect(570, 240, 60, 26); ctx.fillStyle = '#ffffff'; ctx.fillRect(582, 250, 36, 80); ctx.strokeStyle = '#3a7bd5'; ctx.lineWidth = 3; ctx.strokeRect(582, 250, 36, 80);
    // transats et parasols
    for (const y of [330, 430, 530, 630]) { ctx.fillStyle = '#ffffff'; roundRect(120, y - 20, 90, 34, 8); ctx.fill(); ctx.fillStyle = ['#ff4fa3', '#2fa8ff', '#ffd34d', '#2bff88'][y / 100 % 4 | 0]; for (let i = 0; i < 4; i++) ctx.fillRect(126 + i * 22, y - 16, 12, 26); }
    ctx.font = '46px "Noto Color Emoji", sans-serif'; ctx.fillText('⛱️', 240, 375); ctx.fillText('⛱️', 240, 575);
    // le bar à cocktails
    ctx.fillStyle = '#c99b4f'; ctx.beginPath(); ctx.moveTo(940, 290); ctx.lineTo(1040, 236); ctx.lineTo(1140, 290); ctx.fill();
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(960, 290, 160, 100); ctx.font = '28px "Noto Color Emoji", sans-serif'; ctx.fillText('🍹', 1000, 330); ctx.fillText('🥥', 1040, 330); ctx.fillText('🍸', 1080, 330);
    neonText('POOL PARTY', 600, 196, '#ff4fd8', 22);
    // écran sur pied
    ctx.fillStyle = '#333'; ctx.fillRect(595, 168, 10, 30);
  }
  function drawBall(t) {
    if (!ball) return;
    const b = ballAt(ball, Date.now()), r = 20, rot = (b.x + b.y) / 20;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 18, 18, 6, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(rot);
    ['#ff2d55', '#ffffff', '#2fa8ff', '#ffffff', '#ffe600', '#ffffff'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, i * Math.PI / 3, (i + 1) * Math.PI / 3); ctx.fill(); });
    ctx.restore();
  }
  function drawCafe(t) {
    ctx.fillStyle = '#5b3a29'; ctx.fillRect(0, 0, 1100, 250);
    ctx.fillStyle = '#6e4632'; for (let x = 0; x < 1100; x += 40) ctx.fillRect(x, 0, 20, 250);
    // vitrine sur la rue
    const n = nightLevel();
    ctx.fillStyle = mix('#a8e4ff', '#14204a', n); ctx.fillRect(60, 46, 250, 150); ctx.strokeStyle = '#f2e0c0'; ctx.lineWidth = 8; ctx.strokeRect(60, 46, 250, 150);
    ctx.font = '30px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🚶', 80 + ((t * 30) % 220), 160); ctx.fillText('🌳', 270, 150);
    // l'ardoise du menu
    ctx.fillStyle = '#1f2a24'; ctx.fillRect(370, 36, 270, 164); ctx.strokeStyle = '#a8743f'; ctx.lineWidth = 8; ctx.strokeRect(370, 36, 270, 164);
    ctx.fillStyle = '#fff'; ctx.font = '800 20px Outfit, sans-serif'; ctx.fillText('— MENU —', 505, 60);
    ctx.font = '15px Outfit, "Noto Color Emoji", sans-serif'; ctx.textAlign = 'left';
    MENU.slice(0, 10).forEach(([e, l], i) => ctx.fillText(`${e} ${l}`, 385 + (i % 2) * 130, 88 + Math.floor(i / 2) * 22));
    ctx.textAlign = 'center';
    // le comptoir et la machine à café
    ctx.fillStyle = '#8a5a3a'; ctx.fillRect(680, 170, 360, 80); ctx.fillStyle = '#c08a5a'; ctx.fillRect(680, 162, 360, 14);
    ctx.fillStyle = '#c0c6cc'; ctx.fillRect(700, 112, 70, 52); ctx.font = '26px "Noto Color Emoji", sans-serif'; ctx.fillText('☕', 735, 150); ctx.fillText('🥐', 800, 150); ctx.fillText('🍰', 850, 150);
    for (let i = 0; i < 3; i++) { ctx.globalAlpha = .5 - ((t + i / 3) % 1) * .5; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(735 + Math.sin(t * 3 + i) * 5, 105 - ((t + i / 3) % 1) * 40, 6, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // sol en damier
    for (let y = 250; y < 720; y += 50) for (let x = 0; x < 1100; x += 50) { ctx.fillStyle = ((x + y) / 50) % 2 ? '#efe2cf' : '#c9b49a'; ctx.fillRect(x, y, 50, 50); }
    // tables
    for (const [x, y] of CAFE_TABLES) { ctx.fillStyle = '#7a4f2b'; ctx.beginPath(); ctx.arc(x - 62, y + 2, 18, 0, 7); ctx.arc(x + 62, y + 2, 18, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(x, y + 30, 46, 10, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 40, 0, 7); ctx.fill(); ctx.fillStyle = '#ff7a8a'; ctx.beginPath(); ctx.arc(x, y, 34, 0, 7); ctx.fill(); ctx.font = '20px "Noto Color Emoji", sans-serif'; ctx.fillText('🌷', x, y); }
    // le piano
    ctx.fillStyle = '#141018'; roundRect(900, 545, 150, 80, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(908, 596, 134, 22); ctx.fillStyle = '#111'; for (let i = 0; i < 12; i++) if (i % 7 !== 2 && i % 7 !== 6) ctx.fillRect(916 + i * 11, 596, 6, 12);
    ctx.font = '40px "Noto Color Emoji", sans-serif'; ctx.fillText('🪴', 40, 690); ctx.fillText('🪴', 660, 290);
    neonText('CAFÉ PARADISE', 505, 226, '#ffd76a', 20);
  }
  const STARS = Array.from({ length: 90 }, (_, i) => ({ x: (i * 137.5) % 1200, y: (i * 61.7) % 200, s: 1 + (i % 3), p: i }));
  function drawArcade(t) {
    ctx.fillStyle = '#12061f'; ctx.fillRect(0, 0, 1200, 760);
    ctx.fillStyle = '#1d0b33'; ctx.fillRect(0, 0, 1200, 300);
    // sol façon néon
    ctx.strokeStyle = 'rgba(198,77,255,.35)'; ctx.lineWidth = 2;
    for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(600 + i * 30, 300); ctx.lineTo(600 + i * 140, 760); ctx.stroke(); }
    for (let k = 0; k < 8; k++) { const y = 300 + Math.pow(k / 8, 1.6) * 460 + ((t * 30) % 20) * (k / 8); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1200, y); ctx.stroke(); }
    // machines à sous
    for (const [i, x] of [150, 270, 390].entries()) {
      ctx.fillStyle = '#b01e3a'; roundRect(x - 48, 140, 96, 160, 12); ctx.fill(); ctx.fillStyle = '#ffd76a'; ctx.fillRect(x - 48, 132, 96, 16);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 38, 170, 76, 44); ctx.font = '20px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ['🍒', '7️⃣', '💎'].forEach((e, k) => ctx.fillText(['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'][(k + i + Math.floor(t * 2)) % 6], x - 25 + k * 25, 192));
      ctx.fillStyle = '#333'; ctx.fillRect(x + 48, 170, 8, 50); ctx.fillStyle = '#ff2d55'; ctx.beginPath(); ctx.arc(x + 52, 166, 9, 0, 7); ctx.fill();
      for (let k = 0; k < 6; k++) { ctx.fillStyle = (k + Math.floor(t * 6)) % 2 ? '#fff6c0' : '#a8862a'; ctx.beginPath(); ctx.arc(x - 40 + k * 16, 140, 3, 0, 7); ctx.fill(); }
    }
    neonText('JACKPOT', 270, 106, '#ffd76a', 24);
    // la pince à peluches
    ctx.fillStyle = '#2fa8ff'; ctx.fillRect(515, 90, 170, 30); ctx.fillStyle = 'rgba(180,230,255,.25)'; ctx.fillRect(520, 120, 160, 150); ctx.strokeStyle = '#2fa8ff'; ctx.lineWidth = 4; ctx.strokeRect(520, 120, 160, 150); ctx.fillStyle = '#2fa8ff'; ctx.fillRect(515, 270, 170, 40);
    ctx.font = '26px "Noto Color Emoji", sans-serif'; ['🧸', '🐶', '🦄', '🐱', '🐸', '🐼', '🐰'].forEach((e, i) => ctx.fillText(e, 540 + (i % 4) * 38, 250 - Math.floor(i / 4) * 26));
    const claw = fx.find(f => f.type === 'claw');
    const cy = claw ? 130 + Math.sin(Math.min(1, (Date.now() - claw.at) / 2200) * Math.PI) * 90 : 130;
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(600, 120); ctx.lineTo(600, cy); ctx.moveTo(600, cy); ctx.lineTo(588, cy + 16); ctx.moveTo(600, cy); ctx.lineTo(612, cy + 16); ctx.stroke();
    if (claw?.prize && Date.now() - claw.at > 1100) ctx.fillText(claw.prize, 600, cy + 22);
    neonText('PINCE', 600, 70, '#2fa8ff', 22);
    // la cible des fléchettes
    const D = { x: 985, y: 160 };
    ['#111', '#ff2d55', '#111', '#2bff88', '#ffe600'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(D.x, D.y, 72 - i * 15, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#ff2d55'; ctx.beginPath(); ctx.arc(D.x, D.y, 7, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ffe600'; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(900, 370); ctx.lineTo(1070, 370); ctx.stroke(); ctx.setLineDash([]);
    neonText('FLÉCHETTES', 985, 260, '#2bff88', 18);
    // le tableau des scores
    const bd = arcadeBoard;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; roundRect(720, 40, 160, 200, 12); ctx.fill(); ctx.strokeStyle = '#c64dff'; ctx.lineWidth = 2; roundRect(720, 40, 160, 200, 12); ctx.stroke();
    ctx.fillStyle = '#ffd76a'; ctx.font = '800 15px Outfit, sans-serif'; ctx.fillText('🏆 FLÉCHETTES', 800, 62);
    ctx.font = '700 13px Outfit, sans-serif'; ctx.fillStyle = '#fff';
    (bd?.darts || []).forEach((d, i) => ctx.fillText(`${i + 1}. ${d.username.slice(0, 11)} · ${d.score}`, 800, 88 + i * 22));
    if (!bd?.darts?.length) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillText('À toi de jouer !', 800, 110); }
    ctx.fillStyle = '#ff4fd8'; ctx.fillText(`🎰 Jackpots : ${bd?.jackpots || 0}`, 800, 206); ctx.fillStyle = '#38dce6'; ctx.fillText(`🧸 Peluches : ${bd?.prizes || 0}`, 800, 226);
    drawBabyTable(600, 528, 220, 120, t);
    const bfs = window.Babyfoot?.state('arcade');
    if (bfs && bfs.phase !== 'lobby') neonText(`🔴 ${bfs.score.red} – ${bfs.score.blue} 🔵`, 600, 450, '#ffffff', 20);
    // bornes rétro
    for (const x of [100, 190, 280]) { ctx.fillStyle = '#2a1248'; ctx.fillRect(x - 34, 560, 68, 110); ctx.fillStyle = RAINBOW[(x / 90 + Math.floor(t * 3)) % 6 | 0]; ctx.fillRect(x - 26, 572, 52, 36); ctx.fillStyle = '#ff2d55'; ctx.beginPath(); ctx.arc(x - 10, 630, 6, 0, 7); ctx.fill(); }
    for (const x of [920, 1010, 1100]) { ctx.fillStyle = '#2a1248'; ctx.fillRect(x - 34, 560, 68, 110); ctx.fillStyle = RAINBOW[(x / 90 + Math.floor(t * 3) + 2) % 6 | 0]; ctx.fillRect(x - 26, 572, 52, 36); }
    neonText('ARCADE', 600, 30, RAINBOW[Math.floor(t * 2) % 6], 26);
  }
  function drawCamp(t) {
    const sky = ctx.createLinearGradient(0, 0, 0, 260); sky.addColorStop(0, '#050820'); sky.addColorStop(1, '#1a1f4a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 1200, 260);
    for (const s of STARS) { ctx.globalAlpha = .4 + .6 * Math.abs(Math.sin(t * 1.3 + s.p)); ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.s, s.s); }
    ctx.globalAlpha = 1;
    ctx.font = '54px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🌕', 960, 70);
    ctx.fillStyle = '#0d1a3a'; ctx.fillRect(0, 200, 1200, 70);
    ctx.fillStyle = 'rgba(255,250,200,.35)'; for (let i = 0; i < 6; i++) ctx.fillRect(930 + Math.sin(t * 2 + i) * 10, 206 + i * 10, 60 - i * 6, 3);
    const sand = ctx.createRadialGradient(FIRE.x, FIRE.y, 40, FIRE.x, FIRE.y, 700); sand.addColorStop(0, '#c9935a'); sand.addColorStop(1, '#3a2a28');
    ctx.fillStyle = sand; ctx.fillRect(0, 262, 1200, 498);
    // lueur du feu (plus grande quand l'ambiance monte)
    const glow = 180 + amb * 2.2 + Math.sin(t * 9) * 8;
    const g = ctx.createRadialGradient(FIRE.x, FIRE.y, 10, FIRE.x, FIRE.y, glow); g.addColorStop(0, 'rgba(255,170,60,.55)'); g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(FIRE.x, FIRE.y, glow, 0, 7); ctx.fill();
    // bûches pour s'asseoir
    for (const s of CAMP_SEATS) { ctx.fillStyle = '#6b3f1f'; roundRect(s.x - 30, s.y - 2, 60, 18, 8); ctx.fill(); ctx.fillStyle = '#c08a5a'; ctx.beginPath(); ctx.ellipse(s.x + 30, s.y + 7, 5, 9, 0, 0, 7); ctx.fill(); }
    // le feu
    ctx.fillStyle = '#555'; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; ctx.beginPath(); ctx.arc(FIRE.x + Math.cos(a) * 46, FIRE.y + 20 + Math.sin(a) * 20, 9, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#5a3216'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(FIRE.x - 40, FIRE.y + 26); ctx.lineTo(FIRE.x + 40, FIRE.y + 6); ctx.moveTo(FIRE.x - 40, FIRE.y + 6); ctx.lineTo(FIRE.x + 40, FIRE.y + 26); ctx.stroke();
    drawFlame(FIRE.x, FIRE.y + 18, .55 + amb / 260, t);
    for (let i = 0; i < 12; i++) { const k = (t * .7 + i / 12) % 1; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffd34d'; ctx.fillRect(FIRE.x + Math.sin(i * 7 + t * 2) * 30 * k, FIRE.y - 30 - k * 160, 3, 3); }
    ctx.globalAlpha = 1;
    ctx.font = '70px "Noto Color Emoji", sans-serif'; ctx.fillText('⛺', 150, 340); ctx.fillText('⛺', 1050, 340);
    ctx.font = '40px "Noto Color Emoji", sans-serif'; ctx.fillText('🎸', 840, 560); ctx.fillText('🌴', 60, 600); ctx.fillText('🌴', 1140, 620);
    // étoiles filantes des vœux
    for (const f of fx) if (f.type === 'wish') {
      const k = (Date.now() - f.at) / 2600; if (k > 1) continue;
      const x = 1150 - k * 1000, y = 30 + k * 150;
      const gr = ctx.createLinearGradient(x, y, x + 160, y - 24); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = gr; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 160, y - 24); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '800 16px Outfit, sans-serif'; ctx.globalAlpha = Math.min(1, (1 - k) * 3); ctx.fillText(`🌠 ${f.name} fait un vœu…`, 600, 130); ctx.globalAlpha = 1;
    }
  }
  let arcadeBoard = null;
  // Les animations des mini-jeux, plongeons, fléchettes…
  function drawFx(t) {
    const nowT = Date.now();
    fx = fx.filter(f => nowT - f.at < (f.life || 3000));
    for (const f of fx) {
      const k = (nowT - f.at) / (f.life || 3000), p = players.get(f.id);
      if (f.type === 'splash') { for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * k * 70, f.y + Math.sin(a) * k * 30 - Math.sin(k * Math.PI) * 30, 6 * (1 - k) + 2, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
      if (f.type === 'dart' && p) {
        const D = { x: 985 + f.ax * 50 * (f.score === 50 ? 0 : 1), y: 160 + f.ay * 50 * (f.score === 50 ? 0 : 1) };
        const fly = Math.min(1, k * 8), x = p.dx + (D.x - p.dx) * fly, y = p.dy - 30 + (D.y - p.dy + 30) * fly - Math.sin(fly * Math.PI) * 60;
        ctx.font = '22px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎯', x, y);
        if (fly >= 1) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(D.x, D.y, 5, 0, 7); ctx.fill(); neonText(f.score === 50 ? 'BULL ! 50' : `${f.score} pts`, D.x, D.y - 90 - k * 20, f.score >= 40 ? '#ffd76a' : '#ffffff', 22); }
      }
      if (f.type === 'slot' && p) {
        const spin = k < .5, x = p.dx, y = p.dy - 110;
        ctx.fillStyle = 'rgba(20,6,30,.9)'; roundRect(x - 64, y - 22, 128, 44, 10); ctx.fill(); ctx.strokeStyle = f.win === 'jackpot' ? RAINBOW[Math.floor(t * 8) % 6] : '#ffd76a'; ctx.lineWidth = 3; roundRect(x - 64, y - 22, 128, 44, 10); ctx.stroke();
        ctx.font = '24px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        f.r.forEach((e, i) => ctx.fillText(spin || k < .35 + i * .08 ? ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'][Math.floor(t * 20 + i * 2) % 6] : e, x - 38 + i * 38, y + 1));
        if (!spin && f.win) neonText(f.win === 'jackpot' ? '💰 JACKPOT !' : 'Une paire !', x, y - 36, f.win === 'jackpot' ? '#ffd76a' : '#38dce6', f.win === 'jackpot' ? 24 : 16);
      }
      if (f.type === 'claw' && p && k > .75) neonText(f.prize ? `Gagné ${f.prize} !` : 'Raté… 😅', p.dx, p.dy - 96, f.prize ? '#2bff88' : '#ffffff', 18);
    }
  }

  // ---------- Piano et guitare (le son est fabriqué par le navigateur) ----------
  let actx = null;
  const audio = () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; } catch (e) { return null; } };
  function playNote(ins, n) {
    const a = audio(); if (!a || muted) return;
    const tt = a.currentTime;
    const tone = (f, delay, dur, type, vol) => { const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, tt + delay); g.gain.exponentialRampToValueAtTime(.0001, tt + delay + dur); if (type === 'sawtooth') { const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; o.connect(lp).connect(g); } else o.connect(g); g.connect(a.destination); o.start(tt + delay); o.stop(tt + delay + dur + .05); };
    if (ins === 'piano') { const f = 261.63 * Math.pow(2, n / 12); tone(f, 0, 1.4, 'triangle', .16); tone(f * 2, 0, .5, 'sine', .04); }
    else { const CH = [[0, 4, 7, 12], [2, 5, 9, 14], [4, 7, 11, 16], [5, 9, 12, 17], [7, 11, 14, 19], [9, 12, 16, 21], [-3, 4, 9, 12], [12, 16, 19, 24]][n % 8]; CH.forEach((s, i) => tone(130.81 * Math.pow(2, s / 12), i * .035, 1.6, 'sawtooth', .07)); }
  }
  function instrumentPanel(ins) {
    const play = n => { playNote(ins, n); socket.emit('inst_note', n); const mine = players.get(me); if (mine) emotes.push({ id: me, e: '🎵', at: Date.now() }); };
    if (ins === 'piano') {
      const WHITE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24], NAMES = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
      const keysBox = el('div', { class: 'isl-piano' }, ...WHITE.map((n, i) => el('button', { type: 'button', class: 'isl-key', onpointerdown: e => { e.preventDefault(); play(n); } }, el('small', {}, NAMES[i % 7]),
        [1, 3, 6, 8, 10].includes((n + 1) % 12) && n < 24 ? el('span', { class: 'isl-black', onpointerdown: e => { e.preventDefault(); e.stopPropagation(); play(n + 1); } }) : null)));
      panel('🎹 Le piano', el('small', { class: 'isl-sub' }, 'Touche les notes : tout le monde dans la pièce t\'entend !'), keysBox);
    } else {
      const CH = ['Do', 'Ré m', 'Mi m', 'Fa', 'Sol', 'La m', 'La', 'Do aigu'];
      panel('🎸 La guitare', el('small', { class: 'isl-sub' }, 'Gratte des accords autour du feu 🔥'), el('div', { class: 'isl-chords' }, ...CH.map((c, i) => el('button', { type: 'button', class: 'isl-chord', onpointerdown: e => { e.preventDefault(); play(i); } }, c))));
    }
  }
  function menuPanel() {
    panel('☕ Le menu du Café Paradise', el('div', { class: 'isl-menu' }, ...MENU.map(([e, l]) => el('button', { type: 'button', class: 'isl-dish', onclick: () => { const mine = players.get(me); if (!mine) return; mine.action = 'eat'; mine.item = e; mine.itemAt = Date.now(); socket.emit('island_action', 'eat', { x: mine.x, y: mine.y }, e); root.querySelector('.isl-panel')?.remove(); toast(`${e} Et voilà, bonne dégustation !`); } }, el('span', {}, e), l))));
  }

  // ---------- 🔔 La sonnette ----------
  function ringPanel(ownerId, owner) {
    panel(`🔔 Chez ${owner}`, el('small', { class: 'isl-sub' }, `Ici, on sonne avant d'entrer. Sonne et attends que ${owner} t'ouvre !`),
      el('button', { class: 'btn btn-primary', onclick: () => ring(ownerId) }, '🔔 Sonner à la porte'));
  }
  function ring(ownerId) {
    socket.emit('house_ring', ownerId, r => {
      if (r?.error) return toast(r.error);
      if (r?.open) return socket.emit('house_enter', ownerId, x => x?.error && toast(x.error));
      root?.querySelector('.isl-panel')?.remove();
      dingDong();
      const elle = r.ownerGender === 'f';
      toast(r.online ? `🔔 Ding dong ! ${r.owner} a été ${elle ? 'prévenue' : 'prévenu'}, attends qu'${elle ? 'elle' : 'il'} t'ouvre…` : `🔔 ${r.owner} n'est pas là pour le moment : ${elle ? 'elle' : 'il'} verra que tu as sonné`);
    });
  }
  function dingDong() { const a = audio(); if (!a) return; const tt = a.currentTime; [[659, 0], [523, .45]].forEach(([f, d]) => { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.2, tt + d); g.gain.exponentialRampToValueAtTime(.0001, tt + d + 1.2); o.connect(g).connect(a.destination); o.start(tt + d); o.stop(tt + d + 1.3); }); }
  socket.on('house_ring', v => {
    dingDong();
    document.querySelector(`.ring-card[data-id="${v.visitorId}"]`)?.remove();
    const card = el('div', { class: 'ring-card', 'data-id': v.visitorId },
      LC.avatar(v), el('div', {}, el('b', {}, `🔔 ${v.username} sonne à ta porte !`), el('small', {}, `${v.gender === 'f' ? 'Elle' : 'Il'} voudrait entrer dans ta maison 🏠`)),
      el('div', { class: 'ring-btns' },
        el('button', { class: 'btn btn-primary', onclick: () => { socket.emit('house_answer', v.visitorId, true, r => r?.error ? toast(r.error) : toast(`🚪 Tu as ouvert à ${v.username}`)); card.remove(); } }, '🚪 Ouvrir'),
        el('button', { class: 'btn btn-sm', onclick: () => { socket.emit('house_answer', v.visitorId, false); card.remove(); } }, 'Pas maintenant')));
    document.body.append(card);
    setTimeout(() => card.remove(), 60000);
  });
  socket.on('house_opened', d => {
    if (d.inside) return toast(`🚪 ${d.owner} t'a ouvert, entre !`);
    toast(`🚪 ${d.owner} t'a ouvert sa porte ! Touche ici pour entrer`, () => openHouse(d.ownerId));
  });

  // ---------- 🛠️ Placer ses meubles ----------
  function startEdit() {
    if (kind !== 'house' || house?.ownerId !== state.me.id) return;
    editing = true; draft = (house.furniture || DEFAULT_FURN).map(f => ({ ...f })); sel = -1;
    root.querySelector('.isl-panel')?.remove(); renderUI();
    toast('🛠️ Fais glisser tes meubles avec le doigt ou la souris');
  }
  function stopEdit(save) {
    if (save) socket.emit('house_furniture', draft, r => { if (r?.error) return toast(r.error); toast('✅ Tes meubles sont en place !'); });
    editing = false; sel = -1; drag = null; root.querySelector('.isl-panel')?.remove(); renderUI();
  }
  function furniturePanel() {
    panel('➕ Ajouter un meuble', el('div', { class: 'isl-menu' }, ...Object.entries(FURN).map(([k, d]) => el('button', { type: 'button', class: 'isl-dish' + (d.rare ? ' rare' + (window.Shop?.owned(d.rare) ? '' : ' locked') : ''), onclick: () => {
      if (d.rare && !window.Shop?.owned(d.rare)) { toast(`🔒 « ${d.name} » est un meuble rare : il est dans la boutique 💰`); return window.Shop?.open('shop'); }
      if (draft.length >= 40) return toast('40 meubles au maximum');
      if (k === 'tv' && draft.some(f => f.t === 'tv')) return toast('📺 Tu as déjà une télé');
      const n = draft.length; draft.push({ t: k, x: 380 + (n * 97) % 360, y: d.neon ? 120 + (n * 31) % 80 : 400 + (n * 53) % 180, l: floorNow, ...(d.neon ? { c: Decor.NEON[n % Decor.NEON.length] } : {}) }); sel = draft.length - 1; root.querySelector('.isl-panel')?.remove(); renderUI();
    } }, el('span', {}, d.icon), d.name, d.rare ? el('small', {}, window.Shop?.owned(d.rare) ? '💎 Rare' : '🔒 Boutique') : null))));
  }
  const furnDepth = f => f.y + (FURN[f.t]?.flat ? -999 : FURN[f.t]?.h / 2 || 0);
  function hitFurn(x, y) {
    const order = draft.map((f, i) => i).filter(i => (draft[i].l || 0) === floorNow).sort((a, b) => furnDepth(draft[b]) - furnDepth(draft[a]));
    return order.find(i => { const f = draft[i], d = FURN[f.t]; return Math.abs(x - f.x) < d.w / 2 + 6 && Math.abs(y - f.y) < d.h / 2 + 6; }) ?? -1;
  }

  let scene = 'island', kind = 'island', house = null, media = null, mediaOffset = 0, amb = 0, party = 0, view = { z: 1, ox: 0, oy: 0 }, confetti = [], muted = false;
  try { muted = localStorage.getItem('islMute') === '1'; } catch (e) {}
  const S = () => SCENES[kind];
  const toWorld = (sx, sy) => ({ x: (sx - view.ox) / view.z, y: (sy - view.oy) / view.z });

  function drawClub(t) {
    const evx = !!window.EventState?.live;
    const hot = party > Date.now(), speed = hot ? 7 : media?.current ? 3 : 1, beat = .5 + .5 * Math.sin(t * (hot ? 14 : 8));
    ctx.fillStyle = '#100620'; ctx.fillRect(0, 0, 1200, 760);
    const wall = ctx.createLinearGradient(0, 0, 0, 290); wall.addColorStop(0, '#24103f'); wall.addColorStop(1, '#170a2b');
    ctx.fillStyle = wall; ctx.fillRect(0, 0, 1200, 290);
    for (let i = 0; i < 3; i++) { ctx.strokeStyle = PAL()[(i * 2 + Math.floor(t * speed)) % PAL().length]; ctx.lineWidth = 3; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(0, 268 + i * 7); ctx.lineTo(1200, 268 + i * 7); ctx.stroke(); }
    ctx.shadowBlur = 0;
    // étagères du bar
    ctx.fillStyle = '#2d1a10'; ctx.fillRect(60, 150, 200, 110);
    for (let i = 0; i < 16; i++) { ctx.fillStyle = ['#38dce6', '#ff4fd8', '#ffd34d', '#34ff6a'][i % 4]; ctx.fillRect(72 + (i % 8) * 23, 160 + Math.floor(i / 8) * 50, 10, 34); }
    // piste de danse lumineuse
    for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) {
      ctx.globalAlpha = .25 + .55 * ((i + j + Math.floor(t * speed)) % 3 === 0 ? beat : .25);
      ctx.fillStyle = PAL()[(i * 2 + j + Math.floor(t * speed)) % PAL().length]; ctx.fillRect(330 + i * 60 + 2, 345 + j * 52 + 2, 56, 48);
    }
    ctx.globalAlpha = 1;
    // cabine du DJ
    ctx.fillStyle = '#2a1440'; ctx.fillRect(460, 250, 280, 50); ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 3; ctx.shadowColor = '#ff4fd8'; ctx.shadowBlur = 12; ctx.strokeRect(460, 250, 280, 50); ctx.shadowBlur = 0;
    for (const dx of [530, 670]) { ctx.fillStyle = '#0b0614'; ctx.beginPath(); ctx.arc(dx, 275, 20, 0, 7); ctx.fill(); ctx.strokeStyle = '#888'; ctx.lineWidth = 2; const a = media?.current ? t * 5 : 0; ctx.beginPath(); ctx.moveTo(dx, 275); ctx.lineTo(dx + Math.cos(a) * 18, 275 + Math.sin(a) * 18); ctx.stroke(); }
    // comptoir et tabourets
    ctx.fillStyle = '#4a2a63'; ctx.fillRect(60, 330, 170, 290); ctx.strokeStyle = '#38dce6'; ctx.lineWidth = 3; ctx.strokeRect(60, 330, 170, 290);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = '#c64dff'; ctx.beginPath(); ctx.arc(255, 365 + i * 60, 12, 0, 7); ctx.fill(); }
    // coin salon
    ctx.fillStyle = '#7a1f5c'; ctx.fillRect(960, 330, 170, 40); ctx.fillRect(1090, 330, 40, 160); ctx.fillStyle = '#2a1440'; ctx.beginPath(); ctx.arc(1010, 440, 26, 0, 7); ctx.fill();
    // faisceaux lumineux
    ctx.save(); ctx.globalAlpha = hot ? .22 : .1;
    [[100, 0], [1100, 0], [300, 0], [900, 0]].forEach(([lx, ly], k) => { ctx.save(); ctx.translate(lx, ly); ctx.rotate(Math.sin(t * (hot ? 2.4 : 1) + k) * .7 + (k % 2 ? .4 : -.4)); ctx.fillStyle = PAL()[(k + Math.floor(t * speed / 2)) % PAL().length]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-70, 700); ctx.lineTo(70, 700); ctx.fill(); ctx.restore(); });
    ctx.restore();
    ctx.font = '40px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.translate(250, 70); ctx.rotate(t); ctx.fillText('🪩', 0, 0); ctx.restore(); ctx.save(); ctx.translate(950, 70); ctx.rotate(-t); ctx.fillText('🪩', 0, 0); ctx.restore();
    neonText('PARADISE CLUB', 1000, 200, '#ff4fd8', 26); neonText('BAR', 145, 132, '#38dce6', 20);
  }
  function drawCinema(t) {
    ctx.fillStyle = '#2a0d14'; ctx.fillRect(0, 0, 1200, 800);
    ctx.fillStyle = '#3e0f1c'; ctx.fillRect(0, 0, 1200, 560);
    // rideaux
    for (const [x0, dir] of [[110, 1], [1090, -1]]) for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#a3122e' : '#c21e3a'; ctx.fillRect(x0 + dir * (i * 15) - (dir < 0 ? 15 : 0), 10, 15, 500 + Math.sin(t + i) * 4); }
    ctx.fillStyle = '#7a0d22'; ctx.fillRect(100, 0, 1000, 26);
    for (let i = 0; i < 20; i++) { ctx.fillStyle = (i + Math.floor(t * 3)) % 2 ? '#fff6c0' : '#a8862a'; ctx.beginPath(); ctx.arc(110 + i * 51, 13, 4, 0, 7); ctx.fill(); }
    // fauteuils
    for (const s of SEATS) { ctx.fillStyle = '#7d1022'; roundRect(s.x - 25, s.y - 30, 50, 22, 6); ctx.fill(); ctx.fillStyle = '#a3172f'; roundRect(s.x - 22, s.y - 12, 44, 18, 5); ctx.fill(); }
    // stand pop-corn
    ctx.fillStyle = '#ffd76a'; ctx.fillRect(60, 520, 110, 46); ctx.fillStyle = '#c21e3a'; for (let i = 0; i < 5; i++) ctx.fillRect(60 + i * 22, 520, 11, 46);
    ctx.font = '30px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🍿', 115, 505);
    neonText('SORTIE', 600, 790, '#34ff6a', 14);
  }
  function drawHouse(t) {
    const th = THEME[house?.theme] || THEME.cosy;
    const n = nightLevel();
    if (window.Decor) Decor.room(ctx, t, { style: house?.style, floors: house?.floors || 1, accent: th.accent, wall: th.wall, floor: th.floor }, floorNow, n, mix);
    // nom de la maison et porte
    neonText(house?.name || 'Ma maison', 860, 120 - 70, th.accent, 22);
    if (!floorNow) { ctx.fillStyle = '#5a3a1c'; ctx.fillRect(500, 690, 100, 30); }
  }
  function neonText(text, x, y, col, size) {
    ctx.font = `900 ${size}px Outfit, Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = col; ctx.fillText(text, x, y); ctx.shadowBlur = 0;
  }
  // L'écran quand rien ne passe
  function drawScreen(t) {
    const r = screenRect();
    if (!r) return;
    ctx.fillStyle = '#05030a'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = kind === 'club' ? RAINBOW[Math.floor(t * 3) % 6] : '#444'; ctx.lineWidth = 5; ctx.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
    if (!media?.current) {
      const msg = kind === 'club' || kind === 'pool' ? '🎵 Pas de musique… mets un son !' : kind === 'cinema' ? '🎬 Choisis un film à regarder' : kind === 'cafe' ? '🎶 Mets une musique d\'ambiance' : '📺 La télé est éteinte';
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = `800 ${Math.round(r.w / 22)}px Outfit, Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(msg, r.x + r.w / 2, r.y + r.h / 2);
    }
  }
  function drawHots(t) {
    if (editing) return;
    for (const h of hots()) {
      if (h.x == null) continue;
      const pulse = 1 + Math.sin(t * 3 + h.x) * .08;
      ctx.save(); ctx.translate(h.x, h.y); ctx.scale(pulse, pulse);
      ctx.fillStyle = h.exit ? 'rgba(52,255,106,.22)' : 'rgba(255,255,255,.18)'; ctx.strokeStyle = h.exit ? '#34ff6a' : 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 30, 12, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.font = '20px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(h.icon, h.x, h.y - 2);
    }
  }
  // ======================================================================
  //  ✨ L'Île en plus beau : lampadaires néon, guirlandes, fontaine, bateaux, dauphins, montgolfière, lucioles
  // ======================================================================
  const FOUNTAIN = { x: 1050, y: 1010 };
  const LAMP_COLORS = ['#ff2d55', '#ff4fd8', '#c64dff', '#2fa8ff', '#38dce6', '#2bff88', '#ffd34d', '#ff8a1f'];
  const lamps = [];
  for (const [i, p] of PLACES.entries()) {
    if (p.slug === 'general') continue;
    const cx = (1200 + p.x) / 2 + (p.y - 800) * .15, cy = (860 + p.y) / 2 - (p.x - 1200) * .1;
    for (const k of [.42, .76]) {
      const x = (1 - k) * (1 - k) * 1200 + 2 * (1 - k) * k * cx + k * k * p.x, y = (1 - k) * (1 - k) * 860 + 2 * (1 - k) * k * cy + k * k * (p.y + 40);
      if (Math.hypot(x - FOUNTAIN.x, y - FOUNTAIN.y) < 80 || PLACES.some(q => Math.hypot(q.x - x, q.y - y) < 70)) continue;
      lamps.push({ x: x + 26, y, c: LAMP_COLORS[(i * 2 + (k > .5 ? 1 : 0)) % LAMP_COLORS.length] });
    }
  }
  const boats = [{ a: 0, sp: .03, r: 1.12, e: '⛵' }, { a: 2.4, sp: -.022, r: 1.18, e: '🛥️' }, { a: 4.3, sp: .018, r: 1.24, e: '🚤' }];
  const flies = Array.from({ length: 40 }, () => ({ x: 400 + Math.random() * 1600, y: 300 + Math.random() * 1000, p: Math.random() * 6 }));
  let dolphin = { at: 0, x: 0, y: 0 };
  function drawSea(t) {
    // bateaux qui font le tour de l'île
    for (const b of boats) {
      const a = b.a + t * b.sp, x = 1200 + Math.cos(a) * 1080 * b.r, y = 800 + Math.sin(a) * 700 * b.r;
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x - Math.sign(b.sp) * 30, y + 14, 26, 4, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(x, y + Math.sin(t * 2 + b.a) * 3); if (Math.cos(a) * b.sp > 0) ctx.scale(-1, 1);
      ctx.font = '46px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.e, 0, 0); ctx.restore();
    }
    // un dauphin qui saute de temps en temps
    const now = performance.now();
    if (now - dolphin.at > 9000) { const a = Math.random() * Math.PI * 2; dolphin = { at: now, x: 1200 + Math.cos(a) * 1180, y: 800 + Math.sin(a) * 790 }; }
    const k = (now - dolphin.at) / 1600;
    if (k < 1) { ctx.save(); ctx.translate(dolphin.x + k * 120, dolphin.y - Math.sin(k * Math.PI) * 70); ctx.rotate(-.9 + k * 1.8); ctx.font = '44px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🐬', 0, 0); ctx.restore(); if (k > .85) { ctx.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(dolphin.x + 120 + (i - 3) * 8, dolphin.y - 4 - (i % 2) * 6, 3, 0, 7); ctx.fill(); } } }
  }
  function drawCoast(t, n) {
    // la nuit, le contour de l'île s'allume en néon arc-en-ciel
    if (n < .2) return;
    const c = LAMP_COLORS[Math.floor(t / 2) % LAMP_COLORS.length];
    ctx.save(); ctx.globalAlpha = Math.min(1, n * 1.4); ctx.strokeStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 24; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(1200, 800, 1080 * Math.sqrt(.93) + 4, 700 * Math.sqrt(.93) + 4, 0, 0, 7); ctx.stroke(); ctx.restore();
  }
  function drawLights(t, n) {
    // guirlande lumineuse autour de la grande place
    const pts = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * .1 + i * Math.PI * .08; pts.push([1200 + Math.cos(a) * 235, 870 + Math.sin(a) * 150]); }
    ctx.strokeStyle = 'rgba(40,30,30,.6)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], mx = (ax + bx) / 2, my = (ay + by) / 2 + 16;
      ctx.beginPath(); ctx.moveTo(ax, ay - 40); ctx.quadraticCurveTo(mx, my - 40, bx, by - 40); ctx.stroke();
      for (let k = 1; k < 5; k++) { const q = k / 5, x = (1 - q) * (1 - q) * ax + 2 * (1 - q) * q * mx + q * q * bx, y = (1 - q) * (1 - q) * (ay - 40) + 2 * (1 - q) * q * (my - 40) + q * q * (by - 40); const c = LAMP_COLORS[(i * 4 + k + Math.floor(t * 3)) % LAMP_COLORS.length]; ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 6 + n * 12; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill(); }
    }
    ctx.shadowBlur = 0;
    for (const [x, y] of pts) { ctx.fillStyle = '#5a3a1c'; ctx.fillRect(x - 2, y - 42, 4, 42); }
  }
  function drawLamp(l, t, n) {
    const flick = Math.sin(t * 19 + l.x) > .985 ? .4 : 1;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(l.x, l.y + 2, 10, 3, 0, 0, 7); ctx.fill();
    const glow = ctx.createRadialGradient(l.x, l.y - 52, 2, l.x, l.y - 52, 40 + n * 50); glow.addColorStop(0, l.c + 'aa'); glow.addColorStop(1, l.c + '00');
    ctx.globalAlpha = (.35 + n * .65) * flick; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(l.x, l.y - 52, 40 + n * 50, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a2a32'; ctx.fillRect(l.x - 2, l.y - 50, 4, 52); ctx.fillRect(l.x - 6, l.y - 2, 12, 4);
    ctx.fillStyle = l.c; ctx.shadowColor = l.c; ctx.shadowBlur = 16 * flick; ctx.beginPath(); ctx.arc(l.x, l.y - 54, 6, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#2a2a32'; ctx.beginPath(); ctx.moveTo(l.x - 8, l.y - 58); ctx.lineTo(l.x + 8, l.y - 58); ctx.lineTo(l.x, l.y - 66); ctx.fill();
  }
  function drawFountain(t, n) {
    const { x, y } = FOUNTAIN;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x, y + 26, 80, 18, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d8dde6'; ctx.beginPath(); ctx.ellipse(x, y + 10, 76, 24, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2fd0ff'; ctx.beginPath(); ctx.ellipse(x, y + 6, 66, 18, 0, 0, 7); ctx.fill();
    const c = LAMP_COLORS[Math.floor(t * 1.5) % LAMP_COLORS.length];
    ctx.strokeStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 10 + n * 16; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + 10, 76, 24, 0, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#c0c6cc'; ctx.fillRect(x - 6, y - 40, 12, 46); ctx.beginPath(); ctx.ellipse(x, y - 40, 26, 8, 0, 0, 7); ctx.fill();
    // les jets d'eau
    for (let i = 0; i < 26; i++) { const q = ((t * .9 + i / 26) % 1), a = i / 26 * Math.PI * 2; ctx.globalAlpha = 1 - q; ctx.fillStyle = n > .3 ? c : '#e8fbff'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * q * 50, y - 44 - Math.sin(q * Math.PI) * 50 + q * 44 + Math.sin(a) * q * 10, 2.6, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  function drawSky(t, n, x0, y0, x1, y1) {
    // une montgolfière qui traverse le ciel
    const bx = 400 + ((t * 18) % 2000), by = 260 + Math.sin(t * .4) * 40;
    if (bx > x0 - 80 && bx < x1 + 80) { ctx.font = '64px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎈', bx, by); ctx.font = '26px "Noto Color Emoji", sans-serif'; ctx.fillText('🧺', bx, by + 46); }
    // les lucioles la nuit, les papillons le jour
    for (const f of flies) {
      const x = f.x + Math.sin(t * .7 + f.p) * 30, y = f.y + Math.cos(t * .9 + f.p) * 20;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      if (n > .3) { ctx.globalAlpha = .4 + .6 * Math.abs(Math.sin(t * 3 + f.p)); ctx.fillStyle = '#fff6a0'; ctx.shadowColor = '#fff6a0'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
      else if (f.p > 4.5) { ctx.font = '18px "Noto Color Emoji", sans-serif'; ctx.fillText('🦋', x, y); }
    }
  }
  // 🎆 Les feux d'artifice : pendant les soirées, la nuit de temps en temps, ou quand quelqu'un en lance un
  let fwUntil = 0, fwColors = null, fwBy = '';
  function fireworksNow(n) {
    if (window.EventState?.live) return window.EventState.live.colors;
    if (fwUntil > Date.now()) return fwColors;
    const d = new Date(); if (n >= .6 && d.getMinutes() % 15 === 0 && d.getSeconds() < 40) return LAMP_COLORS; // la nuit, toutes les 15 minutes
    return null;
  }
  // 🎆 Feux d'artifice des soirées
  let rockets = [], sparks = [], nextRocket = 0;
  function drawFireworks(dt, vw, vh, palette) {
    const cols = palette.concat(['#ffffff']);
    const tnow = performance.now();
    if (tnow > nextRocket) { nextRocket = tnow + 700 + Math.random() * 900; rockets.push({ x: vw * (.1 + Math.random() * .8), y: vh, ty: vh * (.12 + Math.random() * .3), c: cols[Math.floor(Math.random() * cols.length)] }); }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]; r.y -= 520 * dt;
      ctx.fillStyle = '#fff6c0'; ctx.fillRect(r.x - 2, r.y, 4, 16); ctx.globalAlpha = .4; ctx.fillRect(r.x - 1, r.y + 16, 2, 30); ctx.globalAlpha = 1;
      if (r.y <= r.ty) { rockets.splice(i, 1); const n = 70; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + Math.random() * .1, sp = 140 + Math.random() * 160; sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, c: Math.random() < .25 ? '#ffffff' : r.c }); } }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 70 * dt; p.vx *= .975; p.vy *= .975; p.life -= dt * .55;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life); ctx.strokeStyle = p.c; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .06, p.y - p.vy * .06); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (sparks.length > 900) sparks.splice(0, sparks.length - 900);
  }
  // Confettis quand l'ambiance est à fond
  function drawConfetti(dt, vw, vh) {
    if (party > Date.now() && confetti.length < 160) for (let i = 0; i < 4; i++) confetti.push({ x: Math.random() * vw, y: -10, v: 80 + Math.random() * 120, r: Math.random() * 6, s: 4 + Math.random() * 5, c: RAINBOW[Math.floor(Math.random() * 6)] });
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i]; c.y += c.v * dt; c.r += dt * 6;
      if (c.y > vh + 10) { confetti.splice(i, 1); continue; }
      ctx.save(); ctx.translate(c.x + Math.sin(c.r) * 8, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2); ctx.restore();
    }
    if (party > Date.now()) { ctx.font = `900 ${vw < 600 ? 22 : 34}px Outfit, Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const col = RAINBOW[Math.floor(Date.now() / 150) % 6]; ctx.shadowColor = col; ctx.shadowBlur = 20; ctx.fillStyle = '#fff'; ctx.fillText('🔥 AMBIANCE DE FOLIE ! 🔥', vw / 2, 96); ctx.shadowBlur = 0; }
  }

  // ---------- Boucle d'animation ----------
  let lastDraw = 0;
  function frame(ts) {
    if (!open) return;
    raf = requestAnimationFrame(frame);
    // quand une vidéo passe, on dessine 30 images par seconde (et sans effets lumineux sur téléphone) pour laisser YouTube respirer
    const video = kind !== 'island' && !!media?.current;
    lowFx = video || innerWidth < 700;
    if (video && ts - lastDraw < 31) return;
    lastDraw = ts;
    const t = ts / 1000, dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
    const vw = cv.width / devicePixelRatio, vh = cv.height / devicePixelRatio;
    const sc = S();
    // déplacement de mon personnage
    const mine = players.get(me);
    if (mine) {
      let vx = 0, vy = 0;
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('q')) vx--; if (keys.has('ArrowRight') || keys.has('d')) vx++;
      if (keys.has('ArrowUp') || keys.has('w') || keys.has('z')) vy--; if (keys.has('ArrowDown') || keys.has('s')) vy++;
      if (vx || vy) target = null;
      if (target) {
        const dx = target.x - mine.x, dy = target.y - mine.y, d = Math.hypot(dx, dy);
        if (d < 6) { const hot = target.hot; target = null; if (hot) arrive(hot, mine); } else { vx = dx / d; vy = dy / d; }
      }
      const len = Math.hypot(vx, vy);
      mine.moving = len > 0;
      if (len) {
        if (mine.action) { mine.action = ''; }
        const sp = (kind === 'island' ? 260 : 220) * dt, nx = mine.x + vx / len * sp, ny = mine.y + vy / len * sp;
        if (sc.walk(nx, ny)) { mine.x = nx; mine.y = ny; } else if (sc.walk(nx, mine.y)) mine.x = nx; else if (sc.walk(mine.x, ny)) mine.y = ny; else target = null;
        if (ts - lastSent > 70) { lastSent = ts; socket.emit('island_move', { x: mine.x, y: mine.y }); }
      }
      mine.dx = mine.x; mine.dy = mine.y;
      cam.x += (mine.x - cam.x) * Math.min(1, dt * 6); cam.y += (mine.y - cam.y) * Math.min(1, dt * 6);
    }
    // les autres glissent doucement vers leur dernière position
    for (const p of players.values()) {
      if (p.id === me) continue;
      if (p.dx == null) { p.dx = p.x; p.dy = p.y; }
      const dx = p.x - p.dx, dy = p.y - p.dy;
      p.moving = Math.hypot(dx, dy) > 1.5;
      p.dx += dx * Math.min(1, dt * 10); p.dy += dy * Math.min(1, dt * 10);
    }
    // la « caméra » : sur l'île elle suit mon personnage, dans un lieu on voit toute la pièce
    if (kind === 'island') view = { z: zoom, ox: vw / 2 - cam.x * zoom, oy: vh / 2 - cam.y * zoom };
    else {
      // sur téléphone, la pièce est plus grande que l'écran : la caméra suit le personnage (l'écran vidéo reste toujours entier)
      const top = 60, bottom = vw < 600 ? 190 : 170, avail = vh - top - bottom;
      const fit = Math.min(vw / sc.W, avail / sc.H);
      const z = editing ? fit : Math.max(fit, Math.min(avail / sc.H, vw / ((screenRect()?.w || 460) + 40)));
      const ox = sc.W * z <= vw ? (vw - sc.W * z) / 2 : Math.min(0, Math.max(vw - sc.W * z, vw / 2 - cam.x * z));
      view = { z, ox, oy: top + Math.max(0, avail - sc.H * z) / 2 };
    }
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.fillStyle = kind === 'island' ? '#0a7fb8' : '#07040d'; ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(view.ox, view.oy); ctx.scale(view.z, view.z);
    const items = [];
    if (kind === 'island') {
      const x0 = cam.x - vw / 2 / zoom - 20, x1 = cam.x + vw / 2 / zoom + 20, y0 = cam.y - vh / 2 / zoom - 20, y1 = cam.y + vh / 2 / zoom + 20;
      drawWater(t, x0, y0, x1, y1);
      const nn = Math.max(nightLevel(), window.EventState?.live ? .6 : 0);
      drawSea(t);
      ctx.drawImage(terrain, 0, 0);
      drawCoast(t, nn); drawLights(t, nn);
      items.push(...lamps.filter(l => l.x > x0 - 60 && l.x < x1 + 60 && l.y > y0 - 20 && l.y < y1 + 80).map(l => ({ y: l.y, d: () => drawLamp(l, t, nn) })), { y: FOUNTAIN.y + 26, d: () => drawFountain(t, nn) });
      const counts = {};
      for (const u of state.online || []) if (u.room && !u.ghost) counts[u.room] = (counts[u.room] || 0) + 1;
      items.push(...palms.filter(p => p.x > x0 - 80 && p.x < x1 + 80 && p.y > y0 && p.y < y1 + 120).map(p => ({ y: p.y, d: () => drawPalm(p, t) })),
        ...PLACES.map(p => ({ y: p.y + 30, d: () => drawPlace(p, t, counts[p.slug]) })));
    } else {
      ({ club: drawClub, cinema: drawCinema, house: drawHouse, pool: drawPool, cafe: drawCafe, arcade: drawArcade, campfire: drawCamp })[kind](t);
      if (kind === 'house') {
        const th = THEME[house?.theme] || THEME.cosy, list = furn();
        list.filter(f => FURN[f.t]?.flat || FURN[f.t]?.neon).forEach(f => drawFurn(f, t, th));
        items.push(...list.filter(f => !FURN[f.t]?.flat && !FURN[f.t]?.neon).map(f => ({ y: f.y + FURN[f.t].h / 2, d: () => drawFurn(f, t, th) })));
        if (editing) for (const [i, f] of draft.entries()) { if ((f.l || 0) !== floorNow) continue; const d = FURN[f.t]; ctx.save(); ctx.strokeStyle = i === sel ? '#ffd34d' : 'rgba(255,255,255,.5)'; ctx.lineWidth = i === sel ? 4 : 2; ctx.setLineDash([8, 6]); ctx.strokeRect(f.x - d.w / 2 - 4, f.y - d.h / 2 - 4, d.w + 8, d.h + 8); ctx.restore(); }
      } else drawScreen(t);
      if (kind === 'pool') items.push({ y: ball ? ballAt(ball, Date.now()).y + 10 : 0, d: () => drawBall(t) });
      drawHots(t);
    }
    const here = p => kind !== 'house' || (p.floor || 0) === floorNow;
    items.push(...[...players.values()].filter(here).map(p => { p.pose = poseOf(p); return { y: p.pose ? p.pose.z : (p.dy ?? p.y) + 20, d: () => drawPlayer(p, t) }; }));
    // 🐾 chaque animal trottine derrière son maître
    for (const p of players.values()) {
      if (!p.pet || p.dx == null || !here(p)) continue;
      const side = p.petSide || (p.petSide = p.id % 2 ? 1 : -1);
      const tx = p.dx - side * 44, ty = p.dy + 16;
      if (p.px == null) { p.px = tx; p.py = ty; }
      const k = Math.min(1, dt * 4); p.px += (tx - p.px) * k; p.py += (ty - p.py) * k;
      const moving = Math.hypot(tx - p.px, ty - p.py) > 3;
      items.push({ y: p.py + 6, d: () => drawPet(p, t, moving) });
    }
    items.sort((a, b) => a.y - b.y).forEach(it => it.d());
    if (kind === 'island') { const x0 = cam.x - vw / 2 / zoom - 20, x1 = cam.x + vw / 2 / zoom + 20, y0 = cam.y - vh / 2 / zoom - 20, y1 = cam.y + vh / 2 / zoom + 20; drawSky(t, Math.max(nightLevel(), window.EventState?.live ? .6 : 0), x0, y0, x1, y1); }
    if (kind === 'house' && editing && sel >= 0 && draft[sel]) { const f = draft[sel], d = FURN[f.t]; ctx.save(); ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); ctx.strokeRect(f.x - d.w / 2 - 4, f.y - d.h / 2 - 4, d.w + 8, d.h + 8); ctx.restore(); }
    drawFx(t);
    // shooter dans le ballon en marchant dessus
    if (kind === 'pool' && ball && mine?.moving && ts - lastKick > 350) { const b = ballAt(ball, Date.now()); if (Math.hypot(b.x - mine.x, b.y - mine.y) < 46) { lastKick = ts; socket.emit('inst_kick'); } }
    // petits gestes qui sautent
    for (let i = emotes.length - 1; i >= 0; i--) {
      const e = emotes[i], k = (Date.now() - e.at) / 1600, p = players.get(e.id);
      if (k > 1 || !p) { emotes.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - k; ctx.font = '34px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(e.e, p.dx + Math.sin(k * 8) * 10, p.dy - 70 - k * 70); ctx.globalAlpha = 1;
    }
    if (target) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(target.x, target.y, 14 + Math.sin(t * 8) * 3, 6, 0, 0, 7); ctx.stroke(); }
    if (kind === 'campfire') { ctx.fillStyle = 'rgba(5,8,30,.25)'; ctx.fillRect(0, 0, 1200, 760); }
    // au cinéma, on baisse la lumière pendant le film
    if (kind === 'cinema' && media?.current) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 560, 1200, 240); }
    ctx.restore();
    if (kind === 'island') {
      const n = Math.max(nightLevel(), window.EventState?.live ? .6 : 0); // pendant une soirée, c'est la nuit pour voir les feux d'artifice
      if (n > 0) { ctx.fillStyle = `rgba(8,10,40,${n * .55})`; ctx.fillRect(0, 0, vw, vh); }
      for (const l of leaves) {
        l.y += l.v * dt; l.x += Math.sin(t + l.p) * 20 * dt; if (l.y > vh + 20) { l.y = -20; l.x = Math.random() * vw; const em = window.EventState?.live?.emojis; if (em) l.e = em[Math.floor(Math.random() * em.length)]; }
        ctx.globalAlpha = .75; ctx.font = l.s + 'px sans-serif'; ctx.fillText(l.e, l.x, l.y); ctx.globalAlpha = 1;
      }
      nearPlace(mine);
    }
    { const pal = ['island', 'pool', 'campfire'].includes(kind) ? fireworksNow(nightLevel()) : null; if (pal) drawFireworks(dt, vw, vh, pal); }
    if (fwUntil > Date.now() && fwBy && kind === 'island') { ctx.font = `900 ${vw < 600 ? 14 : 18}px Outfit, Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.shadowColor = fwColors[0]; ctx.shadowBlur = 14; ctx.fillText(`🎆 Feu d'artifice offert par ${fwBy} !`, vw / 2, vw < 600 ? 140 : 140); ctx.shadowBlur = 0; }
    if (window.EventState?.live && ['island', 'pool', 'campfire'].includes(kind)) { const ev = window.EventState.live; ctx.font = `900 ${vw < 600 ? 13 : 16}px Outfit, Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const c = ev.colors[Math.floor(t * 2) % ev.colors.length]; ctx.shadowColor = c; ctx.shadowBlur = 14; ctx.fillStyle = '#fff'; ctx.fillText(`${ev.icon} ${ev.title} · 💰 x2`, vw / 2, vw < 600 ? 112 : 112); ctx.shadowBlur = 0; }
    drawConfetti(dt, vw, vh);
    placeScreen();
  }
  // Arrivé à un endroit : on fait l'action
  function arrive(h, mine) {
    if (h.exit) return exitScene();
    if (h.babyfoot) return window.Babyfoot?.open(scene);
    if (h.hidden) { Hub.open(); return Solo.start('cache'); }
    if (h.stairs) return socket.emit('house_floor', floorNow ? 0 : 1);
    if (h.game) return socket.emit('inst_game', h.game);
    if (h.menu) return menuPanel();
    mine.action = h.action;
    socket.emit('island_action', h.action, { x: mine.x, y: mine.y });
    if (h.instrument) instrumentPanel(h.instrument);
    if (h.action === 'dive') setTimeout(() => { target = { x: 560 + Math.random() * 80, y: 380 + Math.random() * 60 }; }, 350);
  }
  function doHot(h) {
    const mine = players.get(me);
    if (!mine) return;
    if (h.exit) return exitScene();
    if (editing) return;
    if (h.hidden) { Hub.open(); return Solo.start('cache'); }
    if (h.ball) { if (ball) { const b = ballAt(ball, Date.now()); target = { x: b.x, y: b.y }; } return; }
    if (h.x == null && !h.seat) { mine.action = h.action; return socket.emit('island_action', h.action, { x: mine.x, y: mine.y }); }
    let x = h.x, y = h.y;
    const SEATS = SEAT_LISTS[h.seat === true ? 'cinema' : h.seat];
    if (h.rows) { x = h.x + (Math.random() - .5) * h.spread; y = h.rows[Math.floor(Math.random() * h.rows.length)]; }
    else if (h.seat) { const taken = [...players.values()].filter(p => p.id !== me && ['sit', 'marshmallow', 'guitar'].includes(p.action)); const free = SEATS.filter(s => !taken.some(p => Math.hypot(p.x - s.x, p.y - s.y) < 20)); const s = free.sort((a, b) => Math.hypot(a.x - mine.x, a.y - mine.y) - Math.hypot(b.x - mine.x, b.y - mine.y))[0] || SEATS[0]; x = s.x; y = s.y; }
    else if (h.spread) { x += (Math.random() - .5) * h.spread; y += (Math.random() - .5) * h.spread * .4; }
    target = { x, y, hot: h };
  }
  function exitScene() { socket.emit('inst_exit'); }

  // ---------- Entrer dans un salon / un lieu de l'île ----------
  let near = null;
  function nearPlace(mine) {
    if (!mine) return;
    let best = null, bd = 120;
    for (const p of PLACES) { const d = Math.hypot(p.x - mine.x, p.y + 30 - mine.y); if (d < bd && (p.inst || state.rooms?.some(r => r.slug === p.slug))) { bd = d; best = p; } }
    if (best === near) return;
    near = best;
    const card = root.querySelector('.isl-enter');
    if (!best) return card.classList.add('hidden');
    if (best.inst) {
      const txt = { club: ['La boîte de nuit : musique YouTube, piste de danse, bar…', '🪩 Entrer'], cinema: ['Le cinéma : regardez des films ensemble', '🎬 Entrer'], houses: ['Ta maison et celles de tes amis', '🏠 Voir les maisons'],
        pool: ['Piscine, plongeoir, ballon et cocktails', '🏊 Entrer'], cafe: ['Commande, trinque et joue du piano', '☕ Entrer'], arcade: ['Machine à sous, fléchettes, pince à peluches', '🕹️ Entrer'], campfire: ['Guitare, chamallows et vœux sous les étoiles', '🔥 Entrer'], fortune: ['Madame Paradisia lit ton avenir dans sa boule de cristal', '🔮 Consulter'] }[best.inst];
      card.replaceChildren(el('div', {}, el('b', {}, `${best.icon} ${best.label}`), el('small', {}, txt[0])),
        el('button', { class: 'btn btn-primary', onclick: () => (best.inst === 'houses' ? housesPanel() : best.inst === 'fortune' ? window.Fortune?.open() : socket.emit('inst_enter', best.inst, r => r?.error && toast(r.error))) }, txt[1]));
    } else {
      const room = state.rooms.find(r => r.slug === best.slug);
      const n = (state.online || []).filter(u => u.room === best.slug && !u.ghost).length;
      card.replaceChildren(
        el('div', {}, el('b', {}, `${best.icon} ${room?.name || best.label}`), el('small', {}, n ? `🟢 ${n} personne${n > 1 ? 's' : ''} dedans` : 'Personne pour l\'instant')),
        el('button', { class: 'btn btn-primary', onclick: () => { close(); joinRoom(best.slug); } }, '🚪 Entrer'));
    }
    card.classList.remove('hidden');
  }

  // ---------- L'écran YouTube (club, cinéma, télé) ----------
  let screenKey = '', screenPos = '';
  const elapsed = () => (media?.current ? Math.max(0, Math.floor((Date.now() + mediaOffset - media.current.startedAt) / 1000)) : 0);
  const ytSend = (func, args = []) => root?.querySelector('.isl-screen iframe')?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  // Le lecteur démarre toujours sans le son (les navigateurs l'autorisent partout, même sur téléphone),
  // puis on remet le son dès qu'on a touché l'écran. On surveille le lecteur pour rester synchronisé.
  let yt = { state: -1, time: 0, at: 0, muted: true, loadedAt: 0, errorSent: '' }, soundOk = false;
  function syncScreen() {
    const box = root.querySelector('.isl-screen');
    const c = kind !== 'island' ? media?.current : null;
    const key = c ? scene + ':' + c.id : '';
    if (key === screenKey) return;
    screenKey = key; box.replaceChildren();
    if (!c) return box.classList.add('hidden');
    yt = { state: -1, time: 0, at: 0, muted: true, loadedAt: Date.now(), errorSent: '' };
    const f = el('iframe', { src: `https://www.youtube-nocookie.com/embed/${c.videoId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&controls=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}&start=${elapsed()}`, allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture', allowfullscreen: true, title: c.title });
    const hello = () => { try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'isl' }), '*'); } catch (e) {} };
    f.addEventListener('load', () => { hello(); setTimeout(hello, 800); });
    const btn = el('button', { type: 'button', class: 'isl-unmute' + (muted ? ' hidden' : ''), onclick: e => { e.stopPropagation(); soundOk = true; muted = false; try { localStorage.setItem('islMute', '0'); } catch (err) {} soundOn(); btn.classList.add('hidden'); renderUI(); } }, '🔊 Toucher pour le son');
    box.append(f, btn); box.classList.remove('hidden'); screenPos = '';
  }
  function soundOn() { ytSend('unMute'); ytSend('setVolume', [100]); ytSend('playVideo'); }
  // Toutes les 3 secondes : on relance si ça bloque, on rattrape le retard, on remet le son
  setInterval(() => {
    if (!open || !media?.current || !screenKey) return;
    const want = elapsed(), playing = yt.state === 1, since = Date.now() - yt.loadedAt;
    if ((yt.state === -1 || yt.state === 5 || yt.state === 2 && kind !== 'cinema') && since > 3500) ytSend('playVideo');
    if (playing && yt.at) { const cur = yt.time + (Date.now() - yt.at) / 1000; if (Math.abs(cur - want) > 6 && (!media.current.duration || want < media.current.duration - 3)) ytSend('seekTo', [want, true]); }
    if (playing && soundOk && !muted && yt.muted) soundOn();
    const b = root.querySelector('.isl-unmute'); if (b) b.classList.toggle('hidden', muted || (soundOk && !yt.muted));
  }, 3000);
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (open && !muted && screenKey && !soundOk) { soundOk = true; setTimeout(soundOn, 50); } }, true));
  function placeScreen() {
    const r = screenRect(), box = root.querySelector('.isl-screen');
    if (!r || box.classList.contains('hidden')) return;
    const pos = [view.ox + r.x * view.z, view.oy + r.y * view.z, r.w * view.z, r.h * view.z].map(Math.round).join(',');
    if (pos === screenPos) return;
    const [l, tp, w, h] = pos.split(','), [, , ow, oh] = screenPos.split(',');
    // déplacer l'écran sans le redessiner (plus fluide sur téléphone)
    if (ow !== w || oh !== h) Object.assign(box.style, { left: '0px', top: '0px', width: w + 'px', height: h + 'px' });
    box.style.transform = `translate3d(${l}px,${tp}px,0)`;
    screenPos = pos;
  }
  window.addEventListener('message', e => {
    if (!open || !/youtube(-nocookie)?\.com$/.test(new URL(e.origin || 'http://x').hostname)) return;
    let m; try { m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (err) { return; }
    if (!m || !media?.current) return;
    if (m.event === 'onReady') { if (soundOk && !muted) soundOn(); }
    if (m.event === 'onStateChange') yt.state = m.info;
    if (m.event === 'infoDelivery' && m.info) {
      if (m.info.playerState != null) yt.state = m.info.playerState;
      if (m.info.currentTime != null) { yt.time = m.info.currentTime; yt.at = Date.now(); }
      if (m.info.muted != null) yt.muted = m.info.muted;
    }
    if (yt.state === 0) socket.emit('inst_ended', media.current.videoId);
    // vidéo interdite sur les autres sites : on passe toute seule à la suivante
    if (m.event === 'onError' && yt.errorSent !== media.current.videoId) { yt.errorSent = media.current.videoId; socket.emit('inst_error', media.current.videoId); toast('⚠️ Cette vidéo ne peut pas être lue sur le site : on passe à la suivante'); }
  });

  // ---------- Fenêtres : musique / film, maisons, réglages ----------
  function panel(title, ...body) {
    root.querySelector('.isl-panel')?.remove();
    const p = el('div', { class: 'isl-panel' }, el('div', { class: 'isl-phead' }, el('b', {}, title), el('button', { class: 'btn btn-sm', onclick: () => p.remove() }, '✕')), el('div', { class: 'isl-pbody' }, ...body.filter(Boolean)));
    root.append(p); return p;
  }
  const canControl = () => isStaff() || (kind === 'house' && house?.ownerId === state.me.id);
  function mediaPanel() {
    const label = { club: ['🎵 La musique du club', 'Cherche une musique ou colle un lien YouTube…'], cinema: ['🎬 Le film du Ciné Paradise', 'Cherche un film ou colle un lien YouTube…'], house: ['📺 La télé de la maison', 'Cherche une vidéo ou colle un lien YouTube…'] }[kind];
    if (kind === 'house' && !canControl()) return toast(`📺 Seul ${house?.owner || 'le propriétaire'} choisit ce qui passe à la télé`);
    const results = el('div', { class: 'isl-results' });
    const play = item => socket.emit('inst_play', item, r => { if (r?.error) return toast(r.error); toast(r.now ? '▶ C\'est parti !' : '✅ Ajouté à la file d\'attente'); });
    const p = panel(label[0],
      el('div', { class: 'isl-now' }),
      el('form', { class: 'isl-search', onsubmit: e => {
        e.preventDefault(); const q = e.target.querySelector('input').value.trim(); if (!q) return;
        const id = (q.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/) || [])[1];
        if (id) return play({ videoId: id, title: 'Vidéo YouTube' });
        results.replaceChildren(el('div', { class: 'isl-wait' }, '🔎 Recherche…'));
        socket.emit('inst_search', q, r => {
          if (r?.error) return results.replaceChildren(el('div', { class: 'isl-wait' }, r.error));
          results.replaceChildren(...(r.results.length ? r.results.map(v => el('div', { class: 'isl-res' },
            el('img', { src: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`, alt: '', loading: 'lazy' }),
            el('div', {}, el('b', {}, v.title), el('small', {}, [v.channel, v.length].filter(Boolean).join(' · '))),
            el('button', { class: 'btn btn-sm btn-primary', onclick: () => play(v) }, '▶'))) : [el('div', { class: 'isl-wait' }, 'Rien trouvé 😕')]));
        });
      } }, el('input', { class: 'input', placeholder: label[1], maxlength: 200 }), el('button', { class: 'btn btn-primary' }, '🔎')),
      results);
    renderNow(p);
  }
  function renderNow(p = root.querySelector('.isl-panel')) {
    const box = p?.querySelector('.isl-now');
    if (!box || !media) return;
    const c = media.current, mine = c?.userId === state.me.id;
    box.replaceChildren(...[
      c ? el('div', { class: 'isl-playing' }, el('span', {}, '▶ '), el('b', {}, c.title), el('small', {}, ` · demandé par ${c.username}`)) : el('div', { class: 'isl-wait' }, 'Rien ne passe pour l\'instant'),
      c ? el('button', { class: 'btn btn-sm', onclick: () => socket.emit('inst_skip', r => r?.error && toast(r.error)) }, mine || canControl() ? '⏭ Passer' : `⏭ Voter pour passer ${media.votes}/${media.votesNeeded}`) : null,
      media.queue.length ? el('div', { class: 'isl-queue' }, el('small', {}, `À suivre (${media.queue.length}) :`), ...media.queue.map((q, i) => el('div', { class: 'isl-qi' }, el('span', {}, `${i + 1}. ${q.title} · ${q.username}`),
        q.userId === state.me.id || canControl() ? el('button', { class: 'btn btn-sm btn-ghost', title: 'Retirer', onclick: () => socket.emit('inst_unqueue', q.id, r => r?.error && toast(r.error)) }, '✕') : null))) : null,
    ].filter(Boolean));
  }
  function housesPanel() {
    socket.emit('house_list', d => {
      if (!d) return;
      const enter = id => socket.emit('house_enter', id, r => { if (r?.error) return toast(r.error); if (r?.ring) return ringPanel(r.ownerId, r.owner); root.querySelector('.isl-panel')?.remove(); });
      const lock = h => ({ all: '🔓 Ouverte à tous', friends: '👥 Amis (les autres sonnent)', bell: '🔔 On sonne pour entrer', closed: '🔕 Ne pas déranger' })[h.access] || '';
      panel('🏠 Les Maisons du Paradise',
        el('div', { class: 'isl-house mine' }, facadeCanvas(d.mine), el('div', {}, el('b', {}, `🏡 ${d.mine.name}`), el('small', {}, `${THEME[d.mine.theme]?.name || ''} · ${lock(d.mine)}${d.mine.visitors ? ` · 🟢 ${d.mine.visitors} dedans` : ''}`)),
          el('button', { class: 'btn btn-primary', onclick: () => enter(state.me.id) }, 'Entrer chez moi')),
        el('small', { class: 'isl-sub' }, 'Les maisons de tes amis et celles où il y a du monde :'),
        ...(d.list.length ? d.list.map(h => el('div', { class: 'isl-house' + (h.canEnter ? '' : ' locked') },
          facadeCanvas(h),
          el('div', {}, el('b', {}, h.name), el('small', {}, `${h.friend ? '🤝 Ton ami · ' : ''}${lock(h)}${h.visitors ? ` · 🟢 ${h.visitors} dedans` : ''}`)),
          h.canEnter ? el('button', { class: 'btn btn-sm btn-primary', onclick: () => enter(h.ownerId) }, 'Entrer')
            : h.access === 'closed' ? el('button', { class: 'btn btn-sm', onclick: () => toast(`🔕 ${h.owner} ne veut pas être dérangé`) }, '🔕')
            : el('button', { class: 'btn btn-sm btn-primary', onclick: () => ring(h.ownerId) }, '🔔 Sonner'))) : [el('div', { class: 'isl-wait' }, 'Ajoute des amis pour visiter leurs maisons 🤝')]));
    });
  }
  // Petite image de la façade de la maison (style et étage)
  function facadeCanvas(h) {
    const c = el('canvas', { class: 'isl-facade', width: 120, height: 104 }); const g = c.getContext('2d');
    const save = ctx; ctx = g; try { Decor.facade(g, h.style, h.floors || 1, (THEME[h.theme] || THEME.cosy).accent, 60, 98, h.floors === 2 ? .78 : .95); } finally { ctx = save; }
    return c;
  }
  function houseSettings() {
    if (!house || house.ownerId !== state.me.id) return;
    let theme = house.theme, access = house.access, style = house.style || 'cosy', floors = house.floors || 1;
    const name = el('input', { class: 'input', maxlength: 40, value: house.name });
    const chips = (list, get, set) => el('div', { class: 'isl-chips' }, ...list.map(([v, l]) => el('button', { type: 'button', class: 'isl-chip' + (get() === v ? ' on' : ''), onclick: e => { set(v); e.target.parentNode.querySelectorAll('.isl-chip').forEach(b => b.classList.toggle('on', b === e.target)); } }, l)));
    const visitors = [...players.values()].filter(p => p.id !== me);
    panel('⚙️ Ma maison',
      el('label', {}, 'Le nom de ma maison'), name,
      el('label', {}, 'Le style de la maison'), chips(Object.entries(Decor.STYLES).map(([k, v]) => [k, `${v.icon} ${v.name}`]), () => style, v => (style = v)),
      el('label', {}, 'Les étages'), chips([[1, '🏠 Plain-pied'], [2, '🏘️ Avec un étage (escalier)']], () => floors, v => (floors = v)),
      el('label', {}, 'Les couleurs'), chips(Object.entries(THEME).map(([k, v]) => [k, v.name]), () => theme, v => (theme = v)),
      el('label', {}, 'Qui peut entrer ?'), chips([['all', '🔓 Tout le monde entre'], ['friends', '👥 Mes amis entrent, les autres sonnent'], ['bell', '🔔 Tout le monde sonne'], ['closed', '🔕 Ne pas déranger']], () => access, v => (access = v)),
      el('button', { class: 'btn btn-primary', onclick: () => socket.emit('house_settings', { name: name.value, theme, access, style, floors }, r => { if (r?.error) return toast(r.error); toast('✅ Maison enregistrée'); root.querySelector('.isl-panel')?.remove(); }) }, '💾 Enregistrer'),
      visitors.length ? el('label', {}, 'Chez moi en ce moment') : null,
      ...visitors.map(v => el('div', { class: 'isl-qi' }, el('span', {}, v.username), el('button', { class: 'btn btn-sm btn-danger', onclick: e => socket.emit('house_kick', v.id, r => { if (r?.error) return toast(r.error); e.target.closest('.isl-qi').remove(); }) }, '🚪 Faire sortir'))));
  }

  // ---------- La barre du haut et les boutons d'action ----------
  function renderUI() {
    const titles = { island: '🏝️ L\'Île du Paradise', club: '🪩 Paradise Club', cinema: '🎬 Ciné Paradise', house: `🏠 ${house?.name || 'Maison'}`, pool: '🏊 Pool Party', cafe: '☕ Café Paradise', arcade: '🕹️ L\'Arcade', campfire: '🔥 Le Feu de camp' };
    root.querySelector('.isl-title').textContent = titles[kind];
    root.classList.toggle('inside', kind !== 'island');
    root.querySelector('.isl-zoom').classList.toggle('hidden', kind !== 'island');
    root.querySelector('.isl-amb').classList.toggle('hidden', kind === 'island');
    if (editing) {
      requestAnimationFrame(arrows);
      root.querySelector('.isl-actions').replaceChildren(
        el('button', { type: 'button', class: 'isl-act media', onclick: () => furniturePanel() }, el('span', {}, '➕'), 'Ajouter un meuble'),
        el('button', { type: 'button', class: 'isl-act', onclick: () => { if (draft[sel]) draft[sel].f = draft[sel].f ? 0 : 1; else toast('Touche d\'abord un meuble'); } }, el('span', {}, '↔️'), 'Retourner'),
        el('button', { type: 'button', class: 'isl-act', onclick: () => { const f = draft[sel]; if (!f || !FURN[f.t]?.neon) return toast('Touche d\'abord un néon 💡'); const L = Decor.NEON; f.c = L[(L.indexOf(f.c) + 1) % L.length]; } }, el('span', {}, '🎨'), 'Couleur du néon'),
        el('button', { type: 'button', class: 'isl-act', onclick: () => { if (draft[sel]) { draft.splice(sel, 1); sel = -1; } else toast('Touche d\'abord un meuble'); } }, el('span', {}, '🗑️'), 'Retirer'),
        el('button', { type: 'button', class: 'isl-act exit', onclick: () => stopEdit(true) }, el('span', {}, '💾'), 'Enregistrer'),
        el('button', { type: 'button', class: 'isl-act', onclick: () => stopEdit(false) }, el('span', {}, '✖'), 'Annuler'));
      return renderAmb();
    }
    const acts = hots().map(h => el('button', { type: 'button', class: 'isl-act' + (h.exit ? ' exit' : ''), onclick: () => doHot(h) }, el('span', {}, h.icon), h.label));
    if (kind !== 'island' && screenRect()) acts.unshift(el('button', { type: 'button', class: 'isl-act media', onclick: () => mediaPanel() }, el('span', {}, kind === 'cinema' ? '🎬' : kind === 'house' ? '📺' : '🎵'), kind === 'cinema' ? 'Choisir un film' : kind === 'house' ? 'La télé' : 'Mettre un son'));
    if (kind !== 'island') acts.unshift(
      el('button', { type: 'button', class: 'isl-act', onclick: () => { muted = !muted; try { localStorage.setItem('islMute', muted ? '1' : '0'); } catch (e) {} if (muted) ytSend('mute'); else { soundOk = true; soundOn(); } renderUI(); } }, el('span', {}, muted ? '🔇' : '🔊'), muted ? 'Son coupé' : 'Son'));
    if (kind === 'house' && house?.ownerId === state.me.id) acts.push(el('button', { type: 'button', class: 'isl-act', onclick: () => startEdit() }, el('span', {}, '🛠️'), 'Mes meubles'), el('button', { type: 'button', class: 'isl-act', onclick: () => houseSettings() }, el('span', {}, '⚙️'), 'Ma maison'));
    if (kind === 'island') acts.push(el('button', { type: 'button', class: 'isl-act', onclick: () => housesPanel() }, el('span', {}, '🏠'), 'Les maisons'));
    if (kind === 'island') acts.push(el('button', { type: 'button', class: 'isl-act', onclick: () => window.Look?.open() }, el('span', {}, '🧍'), 'Mon perso'));
    if (kind === 'island' || kind === 'pool' || kind === 'campfire') acts.push(el('button', { type: 'button', class: 'isl-act media', onclick: () => { if (!confirm('Lancer un feu d\'artifice pour toute l\'Île ? (30 pièces 💰)')) return; socket.emit('island_fw', r => r?.error && toast(r.error)); } }, el('span', {}, '🎆'), 'Feu d\'artifice'));
    acts.push(el('button', { type: 'button', class: 'isl-act', onclick: () => window.Pets?.open() }, el('span', {}, players.get(me)?.pet?.icon || '🐾'), players.get(me)?.pet ? players.get(me).pet.name : 'Adopter un animal'));
    root.querySelector('.isl-actions').replaceChildren(...acts);
    requestAnimationFrame(arrows);
    renderAmb();
  }
  // La barre de boutons trop longue : flèches ‹ › et molette de la souris pour la faire défiler (sur ordinateur)
  function arrows() {
    const bar = root?.querySelector('.isl-actions'); if (!bar) return;
    const over = bar.scrollWidth > bar.clientWidth + 2;
    root.querySelector('.isl-arrow.left').classList.toggle('hidden', !over || bar.scrollLeft < 4);
    root.querySelector('.isl-arrow.right').classList.toggle('hidden', !over || bar.scrollLeft + bar.clientWidth > bar.scrollWidth - 4);
  }
  function scrollActs(dir) { const bar = root.querySelector('.isl-actions'); bar.scrollBy({ left: dir * Math.max(160, bar.clientWidth * .7), behavior: 'smooth' }); setTimeout(arrows, 400); }
  function renderAmb() {
    const b = root.querySelector('.isl-amb');
    b.querySelector('i').style.width = amb + '%';
    b.classList.toggle('hot', party > Date.now() || amb > 80);
    b.querySelector('small').textContent = party > Date.now() ? '🔥 À fond !' : `${amb}%`;
  }

  // ---------- Ouvrir / fermer l'île ----------
  function build() {
    root = el('div', { class: 'island hidden', id: 'island' },
      el('canvas', { class: 'isl-canvas' }),
      el('div', { class: 'isl-screen hidden' }),
      el('div', { class: 'isl-top' },
        el('b', { class: 'isl-title' }, '🏝️ L\'Île du Paradise'), el('span', { class: 'isl-count' }),
        el('div', { class: 'isl-amb hidden', title: 'La jauge d\'ambiance : elle monte quand ça danse, parle et s\'amuse !' }, el('span', {}, '🔥'), el('div', { class: 'isl-gauge' }, el('i')), el('small', {}, '0%')),
        el('span', { style: 'flex:1' }),
        el('span', { class: 'isl-zoom' },
          el('button', { class: 'btn btn-sm', title: 'Dézoomer', onclick: () => { zoom = Math.max(.45, zoom - .15); } }, '－'),
          el('button', { class: 'btn btn-sm', title: 'Zoomer', onclick: () => { zoom = Math.min(1.6, zoom + .15); } }, '＋')),
        el('button', { class: 'btn btn-sm btn-danger', title: 'Quitter l\'île', onclick: () => close() }, '✕')),
      el('div', { class: 'isl-hint' }, '👆 Touche le sol pour marcher · approche-toi d\'un lieu pour y entrer'),
      el('div', { class: 'isl-enter hidden' }),
      el('div', { class: 'isl-bottom' },
        el('div', { class: 'isl-actwrap' },
          el('button', { type: 'button', class: 'isl-arrow left hidden', 'aria-label': 'Boutons précédents', onclick: () => scrollActs(-1) }, '‹'),
          el('div', { class: 'isl-actions', onscroll: () => arrows() }),
          el('button', { type: 'button', class: 'isl-arrow right hidden', 'aria-label': 'Boutons suivants', onclick: () => scrollActs(1) }, '›')),
        el('div', { class: 'isl-emotes' }, ...['👋', '❤️', '😂', '🎉', '🔥', '😍'].map(e => el('button', { type: 'button', onclick: () => socket.emit('island_emote', e) }, e))),
        el('form', { class: 'isl-say', onsubmit: e => { e.preventDefault(); const i = e.target.querySelector('input'); const v = i.value.trim(); if (!v) return; socket.emit('island_say', v, r => r?.error && toast(r.error)); i.value = ''; } },
          el('input', { class: 'input', maxlength: 120, placeholder: 'Dire quelque chose à côté de moi…', autocomplete: 'off' }),
          el('button', { class: 'btn btn-primary' }, '💬'))));
    document.body.append(root);
    cv = root.querySelector('canvas'); ctx = cv.getContext('2d');
    // les halos néon coûtent cher : on peut les couper sans toucher au reste du dessin
    const blur = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
    if (blur?.set) Object.defineProperty(ctx, 'shadowBlur', { get() { return blur.get.call(this); }, set(v) { blur.set.call(this, lowFx ? 0 : v); } });
    const pick = e => {
      const r = cv.getBoundingClientRect();
      const { x, y } = toWorld(e.clientX - r.left, e.clientY - r.top);
      root.querySelector('.isl-hint').classList.add('gone');
      root.querySelector('.isl-panel')?.remove();
      if (editing) {
        sel = hitFurn(x, y);
        if (sel >= 0) { drag = { id: e.pointerId, dx: x - draft[sel].x, dy: y - draft[sel].y }; try { cv.setPointerCapture(e.pointerId); } catch (err) {} }
        return;
      }
      if (kind !== 'island') {
        // toucher un endroit spécial (piste, bar, canapé, porte…), un siège, un meuble ou le ballon
        const h = hots().find(h => h.x != null && Math.hypot(h.x - x, h.y - y) < 45);
        if (h) return doHot(h);
        if (kind === 'house') { const f = [...furn()].reverse().find(f => FURN[f.t]?.act && Math.abs(x - f.x) < FURN[f.t].w / 2 && Math.abs(y - f.y) < FURN[f.t].h / 2); if (f) { const s = furnSpot(f); return (target = { x: s.x, y: s.y, hot: houseHots().find(h => h.action === FURN[f.t].act) }); } }
        if (kind === 'pool' && ball) { const b = ballAt(ball, Date.now()); if (Math.hypot(b.x - x, b.y - y) < 40) return (target = { x: b.x, y: b.y }); }
        const seatList = { cinema: SEATS, cafe: CAFE_SEATS, campfire: CAMP_SEATS }[kind];
        const seat = seatList && seatList.find(s => Math.hypot(s.x - x, s.y - 10 - y) < 32);
        if (seat) return (target = { x: seat.x, y: seat.y, hot: hots().find(h => h.seat) });
        const sc = S();
        if (sc.walk(x, y)) target = { x, y };
        else target = { x: Math.max(sc === SCENES.club ? 70 : 70, Math.min(sc.W - 70, x)), y: Math.max(sc === SCENES.cinema ? 585 : sc === SCENES.club ? 300 : 260, Math.min(sc.H - (kind === 'cinema' ? 35 : 45), y)) };
        return;
      }
      // clic sur un lieu : on y va ; clic sur l'eau : on va au bord le plus proche
      const place = PLACES.find(p => Math.hypot(p.x - x, p.y - y) < 70);
      if (place) { target = { x: place.x, y: place.y + 50 }; return; }
      if (onLand(x, y)) target = { x, y };
      else { let tx = x, ty = y; for (let k = 0; k < 40 && !onLand(tx, ty); k++) { tx += (1200 - tx) * .05; ty += (800 - ty) * .05; } target = { x: tx, y: ty }; }
    };
    cv.addEventListener('pointerdown', pick);
    // molette de la souris sur la barre : elle défile de gauche à droite
    const bar = root.querySelector('.isl-actions');
    bar.addEventListener('wheel', e => { if (bar.scrollWidth <= bar.clientWidth) return; e.preventDefault(); bar.scrollLeft += (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX); arrows(); }, { passive: false });
    // et on peut aussi la faire glisser avec la souris
    let dragX = null, startLeft = 0, moved = false;
    bar.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; dragX = e.clientX; startLeft = bar.scrollLeft; moved = false; });
    window.addEventListener('pointermove', e => { if (dragX == null) return; const dx = e.clientX - dragX; if (Math.abs(dx) > 5) moved = true; bar.scrollLeft = startLeft - dx; arrows(); });
    window.addEventListener('pointerup', () => { dragX = null; });
    bar.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    window.addEventListener('resize', arrows);
    cv.addEventListener('pointermove', e => {
      if (!editing || !drag || e.pointerId !== drag.id || !draft[sel]) return;
      const r = cv.getBoundingClientRect(), { x, y } = toWorld(e.clientX - r.left, e.clientY - r.top);
      draft[sel].x = Math.round(Math.max(0, Math.min(1100, x - drag.dx)) / 5) * 5; draft[sel].y = Math.round(Math.max(0, Math.min(720, y - drag.dy)) / 5) * 5;
    });
    const drop = () => { drag = null; };
    cv.addEventListener('pointerup', drop); cv.addEventListener('pointercancel', drop);
    window.addEventListener('resize', resize);
    document.addEventListener('keydown', e => { if (!open || /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'q', 'w', 'z', 's'].includes(k)) { keys.add(k); e.preventDefault(); } if (k === 'Escape') { if (document.querySelector('.modal-back')) return; /* Échap ferme d'abord la fenêtre ouverte (Voyante, animal…) */ if (root.querySelector('.isl-panel')) root.querySelector('.isl-panel').remove(); else if (kind !== 'island') exitScene(); else close(); } });
    document.addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys.delete(k); });
    buildTerrain();
    const month = new Date().getMonth();
    const set = month === 9 || month === 10 ? ['🍂', '🍁', '❄️'] : month === 11 || month <= 1 ? ['❄️', '❄️', '✨'] : ['🌸', '✨'];
    for (let i = 0; i < 18; i++) leaves.push({ x: Math.random() * 800, y: Math.random() * 800, v: 30 + Math.random() * 40, p: Math.random() * 6, s: 12 + Math.random() * 10, e: set[i % set.length] });
    renderUI();
  }
  function resize() { if (!cv) return; const r = cv.getBoundingClientRect(); cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio; zoom = r.width < 600 ? .72 : 1; screenPos = ''; }
  function count() { const c = root?.querySelector('.isl-count'); if (c) c.textContent = `· ${players.size} ${kind === 'island' ? 'promeneur' : 'personne'}${players.size > 1 ? 's' : ''}`; }
  let afterJoin = null;
  function openIsland(then) {
    if (!root) build();
    afterJoin = typeof then === 'function' ? then : null;
    if (open) { if (afterJoin) { afterJoin(); afterJoin = null; } return; }
    root.classList.remove('hidden'); open = true; document.body.classList.add('island-open');
    resize();
    setTimeout(() => root.querySelector('.isl-hint')?.classList.add('gone'), 7000);
    socket.emit('island_join');
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function close() {
    if (!open) return;
    open = false; cancelAnimationFrame(raf); root.classList.add('hidden'); document.body.classList.remove('island-open');
    socket.emit('island_leave'); players.clear(); near = null; keys.clear(); target = null;
    window.Babyfoot?.close();
    scene = 'island'; kind = 'island'; media = null; syncScreen(); root.querySelector('.isl-panel')?.remove();
  }
  // Le serveur m'envoie la pièce où je suis (à l'arrivée et à chaque changement de lieu)
  socket.on('island_fw', d => { if (!open) return; fwUntil = Date.now() + 25000; fwColors = d.colors; fwBy = d.by; });
  socket.on('island_floor', ({ id, floor }) => {
    const p = players.get(id); if (!p) return;
    p.floor = floor; p.action = '';
    if (id === me) { floorNow = floor; target = null; const s = floor ? { x: 150, y: 300 } : { x: 150, y: 300 }; p.x = p.dx = s.x; p.y = p.dy = s.y; renderUI(); toast(floor ? '⬆️ Tu es à l\'étage' : '⬇️ Tu es au rez-de-chaussée'); }
  });
  socket.on('island_scene', d => {
    if (!open || !d) return;
    const changed = d.scene !== scene;
    if (changed) window.Babyfoot?.close();
    me = d.me; scene = d.scene; kind = d.kind; house = d.house; amb = d.amb || 0;
    players = new Map(d.players.map(p => [p.id, p]));
    if (d.media) { media = d.media; mediaOffset = (d.media.serverNow || Date.now()) - Date.now(); } else media = null;
    const m = players.get(me); if (m) { cam.x = m.x; cam.y = m.y; }
    floorNow = m?.floor || 0;
    target = null; near = null; confetti = []; fx = []; editing = false; sel = -1;
    ball = d.ball ? { ...d.ball, at: d.ball.at - ((d.ball.serverNow || Date.now()) - Date.now()) } : null;
    arcadeBoard = d.board || null;
    root.querySelector('.isl-enter').classList.add('hidden');
    if (changed) root.querySelector('.isl-panel')?.remove();
    syncScreen(); renderUI(); count();
    if (afterJoin) { const f = afterJoin; afterJoin = null; f(); }
  });
  socket.on('island_joined', p => { if (!open) return; players.set(p.id, p); count(); });
  socket.on('island_pet', ({ id, pet, look, mode }) => { const p = players.get(id); if (p) { p.pet = pet; if (look !== undefined) { p.look = look; p.mode = mode; } if (id === me) renderUI(); } });
  socket.on('island_left', ({ id }) => { players.delete(id); count(); });
  socket.on('island_move', ({ id, x, y }) => { const p = players.get(id); if (p && id !== me) { p.x = x; p.y = y; } });
  socket.on('island_action', ({ id, action, x, y, item }) => {
    const p = players.get(id); if (!p) return;
    p.action = action; if (id !== me && x != null) { p.x = x; p.y = y; }
    if (item) { p.item = item; p.itemAt = Date.now(); }
    if (action === 'dive') setTimeout(() => fx.push({ type: 'splash', x: 600, y: 360, at: Date.now(), life: 1200 }), 450);
    if (action === 'wish') fx.push({ type: 'wish', name: p.username, at: Date.now(), life: 2600 });
    if (action === 'cheers') for (const q of players.values()) if (Math.hypot(q.x - p.x, q.y - p.y) < 160) emotes.push({ id: q.id, e: '🥂', at: Date.now() });
  });
  socket.on('inst_ball', b => { if (!open || kind !== 'pool') return; ball = { ...b, at: b.at - ((b.serverNow || Date.now()) - Date.now()) }; });
  socket.on('inst_game', d => {
    if (!open || kind !== 'arcade') return;
    arcadeBoard = d.board;
    const p = players.get(d.id); if (p) p.action = d.g;
    if (d.g === 'slot') { fx = fx.filter(f => !(f.type === 'slot' && f.id === d.id)); fx.push({ type: 'slot', id: d.id, r: d.r, win: d.win, at: Date.now(), life: 3200 }); if (d.win === 'jackpot') { setTimeout(() => { party = Math.max(party, Date.now() + 6000); }, 1600); if (d.id === me) setTimeout(() => toast('💰 JACKPOT ! Bravo !'), 1600); } }
    if (d.g === 'darts') fx.push({ type: 'dart', id: d.id, score: d.score, ax: d.ax, ay: d.ay, at: Date.now(), life: 3000 });
    if (d.g === 'claw') { fx = fx.filter(f => f.type !== 'claw'); fx.push({ type: 'claw', id: d.id, prize: d.prize, at: Date.now(), life: 3200 }); if (d.win && p) setTimeout(() => { p.prize = d.prize; }, 2400); }
  });
  socket.on('inst_note', d => { if (!open) return; playNote(d.ins, d.n); emotes.push({ id: d.id, e: '🎵', at: Date.now() }); });
  socket.on('island_say', ({ id, text }) => { const p = players.get(id); if (p) { p.said = text; p.saidAt = Date.now(); } });
  socket.on('island_emote', ({ id, e }) => { if (open) emotes.push({ id, e, at: Date.now() }); });
  socket.on('island_notice', msg => toast(msg));
  socket.on('inst_media', d => { if (!open || d.scene !== scene) return; media = d; mediaOffset = (d.serverNow || Date.now()) - Date.now(); syncScreen(); renderNow(); });
  socket.on('inst_amb', d => { if (!open || d.scene !== scene) return; amb = d.v; renderAmb(); });
  socket.on('inst_party', d => { if (!open || d.scene !== scene) return; party = Date.now() + 15000; renderAmb(); setTimeout(renderAmb, 15100); });
  socket.on('house_info', h => { if (open && kind === 'house') { house = h; if (!editing) renderUI(); else root.querySelector('.isl-title').textContent = `🏠 ${h.name}`; } });
  socket.on('connect', () => { if (open) { players.clear(); open = false; openIsland(); } });
  const openHouse = id => openIsland(() => socket.emit('house_enter', id, r => { if (r?.error) toast(r.error); else if (r?.ring) ringPanel(r.ownerId, r.owner); }));
  return { open: openIsland, close, isOpen: () => open, openHouse, PLACES, scene: () => scene, me: () => me };
})();
$('islandBtn').onclick = () => (Island.isOpen() ? Island.close() : Island.open());
window.Island = Island;
