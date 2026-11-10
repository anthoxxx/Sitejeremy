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
  ];
  const RAINBOW = ['#ff2d55', '#ff9500', '#ffe600', '#34ff6a', '#2fa8ff', '#c64dff'];
  const neonOf = p => (p.role === 'admin' || p.role === 'superadmin') ? '#ff2d55' : p.gender === 'f' ? '#ff4fd8' : p.gender === 'h' ? '#2fa8ff' : '#c3b8ff';
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  let root, cv, ctx, terrain, open = false, me = null, players = new Map(), cam = { x: 1200, y: 900 }, zoom = 1, target = null, keys = new Set(), lastSent = 0, raf = 0, last = 0;
  const imgs = new Map(), emotes = [], palms = [], deco = [], leaves = [];
  const img = src => { if (!src) return null; let i = imgs.get(src); if (!i) { i = new Image(); i.src = src; imgs.set(src, i); } return i.complete && i.naturalWidth ? i : null; };

  // ---------- Le décor fixe (dessiné une seule fois) ----------
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
      [[-62, 8, '#ff8fb1', '#7a3b5c'], [62, 8, '#9fd8ff', '#2a5c8a'], [0, -22, '#ffe3a0', '#8a5a2b']].forEach(([hx, hy, wall, roof]) => {
        ctx.fillStyle = wall; ctx.fillRect(hx - 30, hy - 18, 60, 40); ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(hx - 38, hy - 18); ctx.lineTo(hx, hy - 46); ctx.lineTo(hx + 38, hy - 18); ctx.fill();
        ctx.fillStyle = nightLevel() > .4 ? '#ffe28a' : '#ffffff'; ctx.fillRect(hx - 20, hy - 8, 12, 10); ctx.fillStyle = '#5a3a1c'; ctx.fillRect(hx + 4, hy + 2, 12, 20);
      });
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
    ctx.save(); ctx.translate(p.dx, p.dy);
    if (dancing) ctx.rotate(Math.sin(t * 4.5 + p.id) * .22);
    if (act === 'sleep') ctx.rotate(-.5);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 22, 18, 6, 0, 0, 7); ctx.fill();
    // petit corps
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-14, 20 - bob); ctx.quadraticCurveTo(0, -4 - bob, 14, 20 - bob); ctx.closePath(); ctx.fill();
    // tête = photo de profil dans un rond néon
    const y = -14 - bob, r = 18;
    ctx.shadowColor = col; ctx.shadowBlur = 14;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, y, r + 3, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.save(); ctx.beginPath(); ctx.arc(0, y, r, 0, 7); ctx.clip();
    const im = img(p.avatar);
    if (im) ctx.drawImage(im, -r, y - r, r * 2, r * 2);
    else { ctx.fillStyle = p.color || '#8b6cff'; ctx.fillRect(-r, y - r, r * 2, r * 2); ctx.fillStyle = '#fff'; ctx.font = '900 18px Outfit, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((p.username || '?')[0].toUpperCase(), 0, y + 1); }
    ctx.restore();
    // pseudo en néon
    ctx.font = '800 14px Outfit, Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(p.username, 0, 40);
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.fillText(p.username, 0, 40); ctx.shadowBlur = 0;
    // ce que fait le personnage
    const ICON = { dance: '💃', drink: '🍹', dj: '🎧', sit: '🪑', popcorn: '🍿', sleep: '💤', cook: '🍳' };
    if (act && ICON[act]) {
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
  let scene = 'island', kind = 'island', house = null, media = null, mediaOffset = 0, amb = 0, party = 0, view = { z: 1, ox: 0, oy: 0 }, confetti = [], muted = false;
  try { muted = localStorage.getItem('islMute') === '1'; } catch (e) {}
  const S = () => SCENES[kind];
  const toWorld = (sx, sy) => ({ x: (sx - view.ox) / view.z, y: (sy - view.oy) / view.z });

  function drawClub(t) {
    const hot = party > Date.now(), speed = hot ? 7 : media?.current ? 3 : 1, beat = .5 + .5 * Math.sin(t * (hot ? 14 : 8));
    ctx.fillStyle = '#100620'; ctx.fillRect(0, 0, 1200, 760);
    const wall = ctx.createLinearGradient(0, 0, 0, 290); wall.addColorStop(0, '#24103f'); wall.addColorStop(1, '#170a2b');
    ctx.fillStyle = wall; ctx.fillRect(0, 0, 1200, 290);
    for (let i = 0; i < 3; i++) { ctx.strokeStyle = RAINBOW[(i * 2 + Math.floor(t * speed)) % 6]; ctx.lineWidth = 3; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(0, 268 + i * 7); ctx.lineTo(1200, 268 + i * 7); ctx.stroke(); }
    ctx.shadowBlur = 0;
    // étagères du bar
    ctx.fillStyle = '#2d1a10'; ctx.fillRect(60, 150, 200, 110);
    for (let i = 0; i < 16; i++) { ctx.fillStyle = ['#38dce6', '#ff4fd8', '#ffd34d', '#34ff6a'][i % 4]; ctx.fillRect(72 + (i % 8) * 23, 160 + Math.floor(i / 8) * 50, 10, 34); }
    // piste de danse lumineuse
    for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) {
      ctx.globalAlpha = .25 + .55 * ((i + j + Math.floor(t * speed)) % 3 === 0 ? beat : .25);
      ctx.fillStyle = RAINBOW[(i * 2 + j + Math.floor(t * speed)) % 6]; ctx.fillRect(330 + i * 60 + 2, 345 + j * 52 + 2, 56, 48);
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
    [[100, 0], [1100, 0], [300, 0], [900, 0]].forEach(([lx, ly], k) => { ctx.save(); ctx.translate(lx, ly); ctx.rotate(Math.sin(t * (hot ? 2.4 : 1) + k) * .7 + (k % 2 ? .4 : -.4)); ctx.fillStyle = RAINBOW[(k + Math.floor(t * speed / 2)) % 6]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-70, 700); ctx.lineTo(70, 700); ctx.fill(); ctx.restore(); });
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
    ctx.fillStyle = th.wall; ctx.fillRect(0, 0, 1100, 250);
    ctx.fillStyle = th.floor; ctx.fillRect(0, 250, 1100, 470);
    ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 2; for (let y = 280; y < 720; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1100, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, 244, 1100, 8);
    // fenêtre : le ciel suit l'heure
    const n = nightLevel();
    ctx.fillStyle = mix('#8fd8ff', '#0b1640', n); ctx.fillRect(520, 50, 180, 120); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.strokeRect(520, 50, 180, 120); ctx.beginPath(); ctx.moveTo(610, 50); ctx.lineTo(610, 170); ctx.moveTo(520, 110); ctx.lineTo(700, 110); ctx.stroke();
    ctx.font = '26px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n > .4 ? '🌙' : '☀️', 660, 80);
    // meuble télé
    ctx.fillStyle = '#4a3020'; ctx.fillRect(100, 226, 320, 22); ctx.fillStyle = '#111'; ctx.fillRect(104, 46, 312, 181);
    // canapé, table basse, tapis
    ctx.fillStyle = th.accent; ctx.beginPath(); ctx.ellipse(540, 480, 170, 80, 0, 0, 7); ctx.globalAlpha = .45; ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = th.accent; roundRect(150, 290, 260, 34, 10); ctx.fill(); roundRect(140, 300, 30, 70, 10); ctx.fill(); roundRect(390, 300, 30, 70, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.25)'; roundRect(170, 324, 220, 26, 8); ctx.fill();
    // cuisine
    ctx.fillStyle = '#e8e8ee'; ctx.fillRect(760, 170, 220, 76); ctx.fillStyle = '#444'; ctx.fillRect(820, 182, 70, 40);
    for (const bx of [840, 870]) { ctx.strokeStyle = '#ff7a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, 202, 9, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#d8dde6'; ctx.fillRect(985, 60, 80, 186); ctx.fillStyle = '#9aa'; ctx.fillRect(995, 120, 6, 30);
    // lit
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(840, 470, 200, 170); ctx.fillStyle = '#ffffff'; ctx.fillRect(850, 480, 180, 40); ctx.fillStyle = th.accent; ctx.fillRect(850, 525, 180, 108);
    // plantes et lampe
    ctx.font = '40px "Noto Color Emoji", sans-serif'; ctx.fillText('🪴', 80, 290); ctx.fillText('🪴', 1060, 690);
    ctx.fillStyle = 'rgba(255,240,180,' + (.25 + n * .4) + ')'; ctx.beginPath(); ctx.arc(470, 230, 60, 0, 7); ctx.fill();
    // nom de la maison et porte
    neonText(house?.name || 'Ma maison', 860, 120 - 70, th.accent, 22);
    ctx.fillStyle = '#5a3a1c'; ctx.fillRect(500, 690, 100, 30);
  }
  function neonText(text, x, y, col, size) {
    ctx.font = `900 ${size}px Outfit, Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = col; ctx.fillText(text, x, y); ctx.shadowBlur = 0;
  }
  // L'écran quand rien ne passe
  function drawScreen(t) {
    const r = S().screen;
    if (!r) return;
    ctx.fillStyle = '#05030a'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = kind === 'club' ? RAINBOW[Math.floor(t * 3) % 6] : '#444'; ctx.lineWidth = 5; ctx.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
    if (!media?.current) {
      const msg = kind === 'club' ? '🎵 Pas de musique… mets un son !' : kind === 'cinema' ? '🎬 Choisis un film à regarder' : '📺 La télé est éteinte';
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = `800 ${Math.round(r.w / 22)}px Outfit, Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(msg, r.x + r.w / 2, r.y + r.h / 2);
    }
  }
  function drawHots(t) {
    for (const h of HOTS[kind]) {
      if (h.x == null) continue;
      const pulse = 1 + Math.sin(t * 3 + h.x) * .08;
      ctx.save(); ctx.translate(h.x, h.y); ctx.scale(pulse, pulse);
      ctx.fillStyle = h.exit ? 'rgba(52,255,106,.22)' : 'rgba(255,255,255,.18)'; ctx.strokeStyle = h.exit ? '#34ff6a' : 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 30, 12, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.font = '20px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(h.icon, h.x, h.y - 2);
    }
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
  function frame(ts) {
    if (!open) return;
    raf = requestAnimationFrame(frame);
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
      const z = Math.max(Math.min(vw / sc.W, avail / sc.H), Math.min(avail / sc.H, vw / (sc.screen.w + 40)));
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
      ctx.drawImage(terrain, 0, 0);
      const counts = {};
      for (const u of state.online || []) if (u.room && !u.ghost) counts[u.room] = (counts[u.room] || 0) + 1;
      items.push(...palms.filter(p => p.x > x0 - 80 && p.x < x1 + 80 && p.y > y0 && p.y < y1 + 120).map(p => ({ y: p.y, d: () => drawPalm(p, t) })),
        ...PLACES.map(p => ({ y: p.y + 30, d: () => drawPlace(p, t, counts[p.slug]) })));
    } else {
      if (kind === 'club') drawClub(t); else if (kind === 'cinema') drawCinema(t); else drawHouse(t);
      drawScreen(t); drawHots(t);
    }
    items.push(...[...players.values()].map(p => ({ y: (p.dy ?? p.y) + 20, d: () => drawPlayer(p, t) })));
    items.sort((a, b) => a.y - b.y).forEach(it => it.d());
    // petits gestes qui sautent
    for (let i = emotes.length - 1; i >= 0; i--) {
      const e = emotes[i], k = (Date.now() - e.at) / 1600, p = players.get(e.id);
      if (k > 1 || !p) { emotes.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - k; ctx.font = '34px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(e.e, p.dx + Math.sin(k * 8) * 10, p.dy - 70 - k * 70); ctx.globalAlpha = 1;
    }
    if (target) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(target.x, target.y, 14 + Math.sin(t * 8) * 3, 6, 0, 0, 7); ctx.stroke(); }
    // au cinéma, on baisse la lumière pendant le film
    if (kind === 'cinema' && media?.current) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 560, 1200, 240); }
    ctx.restore();
    if (kind === 'island') {
      const n = nightLevel();
      if (n > 0) { ctx.fillStyle = `rgba(8,10,40,${n * .55})`; ctx.fillRect(0, 0, vw, vh); }
      for (const l of leaves) {
        l.y += l.v * dt; l.x += Math.sin(t + l.p) * 20 * dt; if (l.y > vh + 20) { l.y = -20; l.x = Math.random() * vw; }
        ctx.globalAlpha = .75; ctx.font = l.s + 'px sans-serif'; ctx.fillText(l.e, l.x, l.y); ctx.globalAlpha = 1;
      }
      nearPlace(mine);
    }
    drawConfetti(dt, vw, vh);
    placeScreen();
  }
  // Arrivé à un endroit : on fait l'action
  function arrive(h, mine) {
    if (h.exit) return exitScene();
    mine.action = h.action;
    socket.emit('island_action', h.action, { x: mine.x, y: mine.y });
  }
  function doHot(h) {
    const mine = players.get(me);
    if (!mine) return;
    if (h.exit) return exitScene();
    if (h.x == null && !h.seat) { mine.action = h.action; return socket.emit('island_action', h.action, { x: mine.x, y: mine.y }); }
    let x = h.x, y = h.y;
    if (h.seat) { const taken = [...players.values()].filter(p => p.id !== me && p.action === 'sit'); const free = SEATS.filter(s => !taken.some(p => Math.hypot(p.x - s.x, p.y - s.y) < 20)); const s = free.sort((a, b) => Math.hypot(a.x - mine.x, a.y - mine.y) - Math.hypot(b.x - mine.x, b.y - mine.y))[0] || SEATS[0]; x = s.x; y = s.y; }
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
      const txt = { club: ['La boîte de nuit : musique YouTube, piste de danse, bar…', '🪩 Entrer'], cinema: ['Le cinéma : regardez des films ensemble', '🎬 Entrer'], houses: ['Ta maison et celles de tes amis', '🏠 Voir les maisons'] }[best.inst];
      card.replaceChildren(el('div', {}, el('b', {}, `${best.icon} ${best.label}`), el('small', {}, txt[0])),
        el('button', { class: 'btn btn-primary', onclick: () => (best.inst === 'houses' ? housesPanel() : socket.emit('inst_enter', best.inst, r => r?.error && toast(r.error))) }, txt[1]));
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
  function syncScreen() {
    const box = root.querySelector('.isl-screen');
    const c = kind !== 'island' ? media?.current : null;
    const key = c ? scene + ':' + c.id : '';
    if (key === screenKey) return;
    screenKey = key; box.replaceChildren();
    if (!c) return box.classList.add('hidden');
    const f = el('iframe', { src: `https://www.youtube-nocookie.com/embed/${c.videoId}?autoplay=1&playsinline=1&rel=0&controls=${kind === 'cinema' ? 1 : 0}&enablejsapi=1&origin=${encodeURIComponent(location.origin)}&start=${elapsed()}${muted ? '&mute=1' : ''}`, allow: 'autoplay; encrypted-media; fullscreen', allowfullscreen: true, title: c.title });
    f.addEventListener('load', () => { try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'isl' }), '*'); } catch (e) {} });
    box.append(f); box.classList.remove('hidden'); screenPos = '';
  }
  function placeScreen() {
    const r = S().screen, box = root.querySelector('.isl-screen');
    if (!r || box.classList.contains('hidden')) return;
    const pos = [view.ox + r.x * view.z, view.oy + r.y * view.z, r.w * view.z, r.h * view.z].map(Math.round).join(',');
    if (pos === screenPos) return;
    screenPos = pos; const [l, tp, w, h] = pos.split(',');
    Object.assign(box.style, { left: l + 'px', top: tp + 'px', width: w + 'px', height: h + 'px' });
  }
  window.addEventListener('message', e => {
    if (!open || !/youtube(-nocookie)?\.com$/.test(new URL(e.origin || 'http://x').hostname)) return;
    let m; try { m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (err) { return; }
    if (m?.event === 'infoDelivery' && m.info?.playerState === 0 && media?.current) socket.emit('inst_ended', media.current.videoId);
    if (m?.event === 'onError' && media?.current) toast('⚠️ Cette vidéo ne peut pas être lue sur le site : choisis-en une autre');
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
      const enter = id => socket.emit('house_enter', id, r => { if (r?.error) return toast(r.error); root.querySelector('.isl-panel')?.remove(); });
      const lock = h => (h.access === 'all' ? '🔓 Ouverte à tous' : h.access === 'friends' ? '👥 Amis seulement' : '🔒 Fermée');
      panel('🏠 Les Maisons du Paradise',
        el('div', { class: 'isl-house mine' }, el('div', {}, el('b', {}, `🏡 ${d.mine.name}`), el('small', {}, `${THEME[d.mine.theme]?.name || ''} · ${lock(d.mine)}${d.mine.visitors ? ` · 🟢 ${d.mine.visitors} dedans` : ''}`)),
          el('button', { class: 'btn btn-primary', onclick: () => enter(state.me.id) }, 'Entrer chez moi')),
        el('small', { class: 'isl-sub' }, 'Les maisons de tes amis et celles où il y a du monde :'),
        ...(d.list.length ? d.list.map(h => el('div', { class: 'isl-house' + (h.canEnter ? '' : ' locked') },
          LC.avatar({ username: h.owner, avatar: h.ownerAvatar, color: h.ownerColor }),
          el('div', {}, el('b', {}, h.name), el('small', {}, `${h.friend ? '🤝 Ton ami · ' : ''}${lock(h)}${h.visitors ? ` · 🟢 ${h.visitors} dedans` : ''}`)),
          el('button', { class: 'btn btn-sm' + (h.canEnter ? ' btn-primary' : ''), onclick: () => enter(h.ownerId) }, h.canEnter ? 'Entrer' : '🔒'))) : [el('div', { class: 'isl-wait' }, 'Ajoute des amis pour visiter leurs maisons 🤝')]));
    });
  }
  function houseSettings() {
    if (!house || house.ownerId !== state.me.id) return;
    let theme = house.theme, access = house.access;
    const name = el('input', { class: 'input', maxlength: 40, value: house.name });
    const chips = (list, get, set) => el('div', { class: 'isl-chips' }, ...list.map(([v, l]) => el('button', { type: 'button', class: 'isl-chip' + (get() === v ? ' on' : ''), onclick: e => { set(v); e.target.parentNode.querySelectorAll('.isl-chip').forEach(b => b.classList.toggle('on', b === e.target)); } }, l)));
    const visitors = [...players.values()].filter(p => p.id !== me);
    panel('⚙️ Ma maison',
      el('label', {}, 'Le nom de ma maison'), name,
      el('label', {}, 'La déco'), chips(Object.entries(THEME).map(([k, v]) => [k, v.name]), () => theme, v => (theme = v)),
      el('label', {}, 'Qui peut entrer ?'), chips([['all', '🔓 Tout le monde'], ['friends', '👥 Mes amis'], ['closed', '🔒 Personne']], () => access, v => (access = v)),
      el('button', { class: 'btn btn-primary', onclick: () => socket.emit('house_settings', { name: name.value, theme, access }, r => { if (r?.error) return toast(r.error); toast('✅ Maison enregistrée'); root.querySelector('.isl-panel')?.remove(); }) }, '💾 Enregistrer'),
      visitors.length ? el('label', {}, 'Chez moi en ce moment') : null,
      ...visitors.map(v => el('div', { class: 'isl-qi' }, el('span', {}, v.username), el('button', { class: 'btn btn-sm btn-danger', onclick: e => socket.emit('house_kick', v.id, r => { if (r?.error) return toast(r.error); e.target.closest('.isl-qi').remove(); }) }, '🚪 Faire sortir'))));
  }

  // ---------- La barre du haut et les boutons d'action ----------
  function renderUI() {
    const titles = { island: '🏝️ L\'Île du Paradise', club: '🪩 Paradise Club', cinema: '🎬 Ciné Paradise', house: `🏠 ${house?.name || 'Maison'}` };
    root.querySelector('.isl-title').textContent = titles[kind];
    root.classList.toggle('inside', kind !== 'island');
    root.querySelector('.isl-zoom').classList.toggle('hidden', kind !== 'island');
    root.querySelector('.isl-amb').classList.toggle('hidden', kind === 'island');
    const acts = HOTS[kind].map(h => el('button', { type: 'button', class: 'isl-act' + (h.exit ? ' exit' : ''), onclick: () => doHot(h) }, el('span', {}, h.icon), h.label));
    if (kind !== 'island') acts.unshift(el('button', { type: 'button', class: 'isl-act media', onclick: () => mediaPanel() }, el('span', {}, kind === 'club' ? '🎵' : kind === 'cinema' ? '🎬' : '📺'), kind === 'club' ? 'Mettre un son' : kind === 'cinema' ? 'Choisir un film' : 'La télé'),
      el('button', { type: 'button', class: 'isl-act', onclick: () => { muted = !muted; try { localStorage.setItem('islMute', muted ? '1' : '0'); } catch (e) {} ytSend(muted ? 'mute' : 'unMute'); renderUI(); } }, el('span', {}, muted ? '🔇' : '🔊'), muted ? 'Son coupé' : 'Son'));
    if (kind === 'house' && house?.ownerId === state.me.id) acts.push(el('button', { type: 'button', class: 'isl-act', onclick: () => houseSettings() }, el('span', {}, '⚙️'), 'Ma maison'));
    if (kind === 'island') acts.push(el('button', { type: 'button', class: 'isl-act', onclick: () => housesPanel() }, el('span', {}, '🏠'), 'Les maisons'));
    root.querySelector('.isl-actions').replaceChildren(...acts);
    renderAmb();
  }
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
        el('div', { class: 'isl-actions' }),
        el('div', { class: 'isl-emotes' }, ...['👋', '❤️', '😂', '🎉', '🔥', '😍'].map(e => el('button', { type: 'button', onclick: () => socket.emit('island_emote', e) }, e))),
        el('form', { class: 'isl-say', onsubmit: e => { e.preventDefault(); const i = e.target.querySelector('input'); const v = i.value.trim(); if (!v) return; socket.emit('island_say', v, r => r?.error && toast(r.error)); i.value = ''; } },
          el('input', { class: 'input', maxlength: 120, placeholder: 'Dire quelque chose à côté de moi…', autocomplete: 'off' }),
          el('button', { class: 'btn btn-primary' }, '💬'))));
    document.body.append(root);
    cv = root.querySelector('canvas'); ctx = cv.getContext('2d');
    const pick = e => {
      const r = cv.getBoundingClientRect();
      const { x, y } = toWorld(e.clientX - r.left, e.clientY - r.top);
      root.querySelector('.isl-hint').classList.add('gone');
      root.querySelector('.isl-panel')?.remove();
      if (kind !== 'island') {
        // toucher un endroit spécial (piste, bar, canapé, porte…) ou un fauteuil du cinéma
        const h = HOTS[kind].find(h => h.x != null && Math.hypot(h.x - x, h.y - y) < 45);
        if (h) return doHot(h);
        const seat = kind === 'cinema' && SEATS.find(s => Math.hypot(s.x - x, s.y - 10 - y) < 30);
        if (seat) return (target = { x: seat.x, y: seat.y, hot: HOTS.cinema[0] });
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
    window.addEventListener('resize', resize);
    document.addEventListener('keydown', e => { if (!open || /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'q', 'w', 'z', 's'].includes(k)) { keys.add(k); e.preventDefault(); } if (k === 'Escape') { if (root.querySelector('.isl-panel')) root.querySelector('.isl-panel').remove(); else if (kind !== 'island') exitScene(); else close(); } });
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
    scene = 'island'; kind = 'island'; media = null; syncScreen(); root.querySelector('.isl-panel')?.remove();
  }
  // Le serveur m'envoie la pièce où je suis (à l'arrivée et à chaque changement de lieu)
  socket.on('island_scene', d => {
    if (!open || !d) return;
    const changed = d.scene !== scene;
    me = d.me; scene = d.scene; kind = d.kind; house = d.house; amb = d.amb || 0;
    players = new Map(d.players.map(p => [p.id, p]));
    if (d.media) { media = d.media; mediaOffset = (d.media.serverNow || Date.now()) - Date.now(); } else media = null;
    const m = players.get(me); if (m) { cam.x = m.x; cam.y = m.y; }
    target = null; near = null; confetti = [];
    root.querySelector('.isl-enter').classList.add('hidden');
    if (changed) root.querySelector('.isl-panel')?.remove();
    syncScreen(); renderUI(); count();
    if (afterJoin) { const f = afterJoin; afterJoin = null; f(); }
  });
  socket.on('island_joined', p => { if (!open) return; players.set(p.id, p); count(); });
  socket.on('island_left', ({ id }) => { players.delete(id); count(); });
  socket.on('island_move', ({ id, x, y }) => { const p = players.get(id); if (p && id !== me) { p.x = x; p.y = y; } });
  socket.on('island_action', ({ id, action, x, y }) => { const p = players.get(id); if (!p) return; p.action = action; if (id !== me && x != null) { p.x = x; p.y = y; } });
  socket.on('island_say', ({ id, text }) => { const p = players.get(id); if (p) { p.said = text; p.saidAt = Date.now(); } });
  socket.on('island_emote', ({ id, e }) => { if (open) emotes.push({ id, e, at: Date.now() }); });
  socket.on('island_notice', msg => toast(msg));
  socket.on('inst_media', d => { if (!open || d.scene !== scene) return; media = d; mediaOffset = (d.serverNow || Date.now()) - Date.now(); syncScreen(); renderNow(); });
  socket.on('inst_amb', d => { if (!open || d.scene !== scene) return; amb = d.v; renderAmb(); });
  socket.on('inst_party', d => { if (!open || d.scene !== scene) return; party = Date.now() + 15000; renderAmb(); setTimeout(renderAmb, 15100); });
  socket.on('house_info', h => { if (open && kind === 'house') { house = h; renderUI(); } });
  socket.on('connect', () => { if (open) { players.clear(); open = false; openIsland(); } });
  const openHouse = id => openIsland(() => socket.emit('house_enter', id, r => r?.error && toast(r.error)));
  return { open: openIsland, close, isOpen: () => open, openHouse, PLACES, };
})();
$('islandBtn').onclick = () => (Island.isOpen() ? Island.close() : Island.open());
