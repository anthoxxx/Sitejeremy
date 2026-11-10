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
    ctx.fillText(p.icon, 0, p.kind === 'lighthouse' ? -150 : p.kind === 'arch' ? -6 : p.big ? -46 : -46 - (p.kind === 'kiosk' ? 28 : 12));
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
    const bob = moving ? Math.abs(Math.sin(t * 12)) * 5 : Math.sin(t * 2 + p.id) * 1.2;
    ctx.save(); ctx.translate(p.dx, p.dy);
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

  // ---------- Boucle d'animation ----------
  function frame(ts) {
    if (!open) return;
    raf = requestAnimationFrame(frame);
    const t = ts / 1000, dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
    const vw = cv.width / devicePixelRatio, vh = cv.height / devicePixelRatio;
    // déplacement du personnage
    const mine = players.get(me);
    if (mine) {
      let vx = 0, vy = 0;
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('q')) vx--; if (keys.has('ArrowRight') || keys.has('d')) vx++;
      if (keys.has('ArrowUp') || keys.has('w') || keys.has('z')) vy--; if (keys.has('ArrowDown') || keys.has('s')) vy++;
      if (vx || vy) target = null;
      if (target) { const dx = target.x - mine.x, dy = target.y - mine.y, d = Math.hypot(dx, dy); if (d < 6) target = null; else { vx = dx / d; vy = dy / d; } }
      const len = Math.hypot(vx, vy);
      mine.moving = len > 0;
      if (len) {
        const sp = 260 * dt, nx = mine.x + vx / len * sp, ny = mine.y + vy / len * sp;
        if (onLand(nx, ny)) { mine.x = nx; mine.y = ny; } else if (onLand(nx, mine.y)) mine.x = nx; else if (onLand(mine.x, ny)) mine.y = ny; else target = null;
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
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(vw / 2, vh / 2); ctx.scale(zoom, zoom); ctx.translate(-cam.x, -cam.y);
    const x0 = cam.x - vw / 2 / zoom - 20, x1 = cam.x + vw / 2 / zoom + 20, y0 = cam.y - vh / 2 / zoom - 20, y1 = cam.y + vh / 2 / zoom + 20;
    drawWater(t, x0, y0, x1, y1);
    ctx.drawImage(terrain, 0, 0);
    // tout ce qui a une hauteur est trié du haut vers le bas (effet de profondeur)
    const counts = {};
    for (const u of state.online || []) if (u.room && !u.ghost) counts[u.room] = (counts[u.room] || 0) + 1;
    const items = [
      ...palms.filter(p => p.x > x0 - 80 && p.x < x1 + 80 && p.y > y0 && p.y < y1 + 120).map(p => ({ y: p.y, d: () => drawPalm(p, t) })),
      ...PLACES.map(p => ({ y: p.y + 30, d: () => drawPlace(p, t, counts[p.slug]) })),
      ...[...players.values()].map(p => ({ y: (p.dy ?? p.y) + 20, d: () => drawPlayer(p, t) })),
    ].sort((a, b) => a.y - b.y);
    for (const it of items) it.d();
    // petits gestes qui sautent
    for (let i = emotes.length - 1; i >= 0; i--) {
      const e = emotes[i], k = (Date.now() - e.at) / 1600, p = players.get(e.id);
      if (k > 1 || !p) { emotes.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - k; ctx.font = '34px "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(e.e, p.dx + Math.sin(k * 8) * 10, p.dy - 70 - k * 70); ctx.globalAlpha = 1;
    }
    // point d'arrivée
    if (target) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(target.x, target.y, 14 + Math.sin(t * 8) * 3, 6, 0, 0, 7); ctx.stroke(); }
    ctx.restore();
    // nuit, feuilles et flocons par-dessus
    const n = nightLevel();
    if (n > 0) { ctx.fillStyle = `rgba(8,10,40,${n * .55})`; ctx.fillRect(0, 0, vw, vh); }
    for (const l of leaves) {
      l.y += l.v * dt; l.x += Math.sin(t + l.p) * 20 * dt; if (l.y > vh + 20) { l.y = -20; l.x = Math.random() * vw; }
      ctx.globalAlpha = .75; ctx.font = l.s + 'px sans-serif'; ctx.fillText(l.e, l.x, l.y); ctx.globalAlpha = 1;
    }
    nearPlace(mine);
  }
  // ---------- Entrer dans un salon ----------
  let near = null;
  function nearPlace(mine) {
    if (!mine) return;
    let best = null, bd = 120;
    for (const p of PLACES) { const d = Math.hypot(p.x - mine.x, p.y + 30 - mine.y); if (d < bd && state.rooms?.some(r => r.slug === p.slug)) { bd = d; best = p; } }
    if (best === near) return;
    near = best;
    const card = root.querySelector('.isl-enter');
    if (!best) return card.classList.add('hidden');
    const room = state.rooms.find(r => r.slug === best.slug);
    const n = (state.online || []).filter(u => u.room === best.slug && !u.ghost).length;
    card.replaceChildren(
      el('div', {}, el('b', {}, `${best.icon} ${room?.name || best.label}`), el('small', {}, n ? `🟢 ${n} personne${n > 1 ? 's' : ''} dedans` : 'Personne pour l\'instant')),
      el('button', { class: 'btn btn-primary', onclick: () => { close(); joinRoom(best.slug); } }, '🚪 Entrer'));
    card.classList.remove('hidden');
  }

  // ---------- Ouvrir / fermer l'île ----------
  function build() {
    root = el('div', { class: 'island hidden', id: 'island' },
      el('canvas', { class: 'isl-canvas' }),
      el('div', { class: 'isl-top' },
        el('b', { class: 'isl-title' }, '🏝️ L\'Île du Paradise'), el('span', { class: 'isl-count' }),
        el('span', { style: 'flex:1' }),
        el('button', { class: 'btn btn-sm', title: 'Dézoomer', onclick: () => { zoom = Math.max(.45, zoom - .15); } }, '－'),
        el('button', { class: 'btn btn-sm', title: 'Zoomer', onclick: () => { zoom = Math.min(1.6, zoom + .15); } }, '＋'),
        el('button', { class: 'btn btn-sm btn-danger', title: 'Quitter l\'île', onclick: () => close() }, '✕')),
      el('div', { class: 'isl-hint' }, '👆 Touche le sol pour marcher · approche-toi d\'un lieu pour y entrer'),
      el('div', { class: 'isl-enter hidden' }),
      el('div', { class: 'isl-bottom' },
        el('div', { class: 'isl-emotes' }, ...['👋', '❤️', '😂', '🎉', '🔥', '😍'].map(e => el('button', { type: 'button', onclick: () => socket.emit('island_emote', e) }, e))),
        el('form', { class: 'isl-say', onsubmit: e => { e.preventDefault(); const i = e.target.querySelector('input'); const v = i.value.trim(); if (!v) return; socket.emit('island_say', v, r => r?.error && toast(r.error)); i.value = ''; } },
          el('input', { class: 'input', maxlength: 120, placeholder: 'Dire quelque chose à côté de moi…', autocomplete: 'off' }),
          el('button', { class: 'btn btn-primary' }, '💬'))));
    document.body.append(root);
    cv = root.querySelector('canvas'); ctx = cv.getContext('2d');
    const pick = e => {
      const r = cv.getBoundingClientRect(), vw = r.width, vh = r.height;
      const x = cam.x + (e.clientX - r.left - vw / 2) / zoom, y = cam.y + (e.clientY - r.top - vh / 2) / zoom;
      // clic sur un lieu : on y va ; clic sur l'eau : on va au bord le plus proche
      const place = PLACES.find(p => Math.hypot(p.x - x, p.y - y) < 70);
      if (place) { target = { x: place.x, y: place.y + 50 }; return; }
      if (onLand(x, y)) target = { x, y };
      else { let tx = x, ty = y; for (let k = 0; k < 40 && !onLand(tx, ty); k++) { tx += (1200 - tx) * .05; ty += (800 - ty) * .05; } target = { x: tx, y: ty }; }
      root.querySelector('.isl-hint').classList.add('gone');
    };
    cv.addEventListener('pointerdown', pick);
    window.addEventListener('resize', resize);
    document.addEventListener('keydown', e => { if (!open || /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'q', 'w', 'z', 's'].includes(k)) { keys.add(k); e.preventDefault(); } if (k === 'Escape') close(); });
    document.addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys.delete(k); });
    buildTerrain();
    const month = new Date().getMonth();
    const set = month === 9 || month === 10 ? ['🍂', '🍁', '❄️'] : month === 11 || month <= 1 ? ['❄️', '❄️', '✨'] : ['🌸', '✨'];
    for (let i = 0; i < 18; i++) leaves.push({ x: Math.random() * 800, y: Math.random() * 800, v: 30 + Math.random() * 40, p: Math.random() * 6, s: 12 + Math.random() * 10, e: set[i % set.length] });
  }
  function resize() { if (!cv) return; const r = cv.getBoundingClientRect(); cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio; zoom = r.width < 600 ? .72 : 1; }
  function count() { const c = root?.querySelector('.isl-count'); if (c) c.textContent = `· ${players.size} promeneur${players.size > 1 ? 's' : ''}`; }
  function openIsland() {
    if (!root) build();
    root.classList.remove('hidden'); open = true; document.body.classList.add('island-open');
    resize();
    setTimeout(() => root.querySelector('.isl-hint')?.classList.add('gone'), 7000);
    socket.emit('island_join', d => {
      if (!d) return;
      me = d.me; players = new Map(d.players.map(p => [p.id, p]));
      const m = players.get(me); if (m) { cam.x = m.x; cam.y = m.y; }
      count();
    });
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function close() {
    if (!open) return;
    open = false; cancelAnimationFrame(raf); root.classList.add('hidden'); document.body.classList.remove('island-open');
    socket.emit('island_leave'); players.clear(); near = null; keys.clear(); target = null;
  }
  socket.on('island_joined', p => { if (!open) return; players.set(p.id, p); count(); });
  socket.on('island_left', ({ id }) => { players.delete(id); count(); });
  socket.on('island_move', ({ id, x, y }) => { const p = players.get(id); if (p && id !== me) { p.x = x; p.y = y; } });
  socket.on('island_say', ({ id, text, at }) => { const p = players.get(id); if (p) { p.said = text; p.saidAt = Date.now(); } });
  socket.on('island_emote', ({ id, e }) => { if (open) emotes.push({ id, e, at: Date.now() }); });
  socket.on('connect', () => { if (open) { players.clear(); openIsland(); } });
  return { open: openIsland, close, isOpen: () => open, PLACES };
})();
$('islandBtn').onclick = () => (Island.isOpen() ? Island.close() : Island.open());
