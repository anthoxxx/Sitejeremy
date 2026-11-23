// The Paradise — 🎰 Le Paradise Club (côté écran) : un grand complexe en 3D où l'on se promène avec les autres joueurs.
// Dedans : le bar (on commande à boire), l'entrée du Bowling et du Laser Game (on les voit derrière les vitres),
// 2 billards en 3D (billard américain, contre un ami ou un robot) et une table de poker Texas Hold'em, plus des machines à sous.
// Sur ordinateur : ZQSD / WASD / flèches pour marcher, glisser la souris pour tourner la caméra, E pour interagir.
// Sur téléphone : le joystick à gauche, glisser le doigt pour tourner la caméra, le gros bouton pour interagir.
const Casino = (() => {
  const PP = window.PoolPhys, SPEED = 3.6, RAD = .32, CAM_D = 4.2;
  const RN = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R', 'A'], SU = ['♠', '♥', '♦', '♣'];
  const POOLS = [{ x: -5, z: .5 }, { x: -5, z: 6.5 }], PK = { x: 7.5, z: 3.5, rx: 2.0, rz: 1.15 }, TH = .8; // TH = hauteur du tapis du billard
  let active = false, K = null, THREE = null, R = null, scene = null, camera = null, canvas = null, ov = null, raf = 0, last = 0, paused = false;
  let info = null, hud = {}, mode = 'walk', poolT = -1, lastSend = 0, camYaw = 0, camPitch = .32, drinks = {};
  const me = { x: 0, z: 11, yaw: 0, y: 0, zone: 'club', lvl: 0, ride: null, seat: null }, people = new Map(), avatars = new Map(), keys = new Set(), stick = { x: 0, y: 0, on: false };
  const tables = [], pk = { st: null, hole: null, meshes: null };
  const mobile = () => innerWidth < 760 || matchMedia('(pointer: coarse)').matches;
  const myId = () => state.me?.id;
  const ack = (ev, ...a) => new Promise(res => socket.emit(ev, ...a, res));
  const busyElsewhere = () => window.Bowling?.active?.() || window.LaserGame?.active?.();

  // ---------- 🔊 les bruitages (fabriqués directement, sans fichier) ----------
  let AC = null, MIX = null;
  const ac = () => { try { if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); MIX = AC.createDynamicsCompressor(); MIX.connect(AC.destination); } if (AC.state === 'suspended') AC.resume(); } catch (e) {} return AC; };
  function noise(dur, f, q, vol, when = 0, type = 'bandpass') {
    const a = ac(); if (!a || vol < .003) return; const t = a.currentTime + when, n = Math.ceil(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = vol; s.connect(fl).connect(g).connect(MIX); s.start(t);
  }
  function tone(f0, f1, dur, vol, when = 0, type = 'sine') {
    const a = ac(); if (!a || vol < .003) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + when;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g).connect(MIX); o.start(t); o.stop(t + dur + .02);
  }
  const sClick = v => { noise(.035, 3200, 2.5, Math.min(.5, v)); tone(2100, 1500, .04, Math.min(.18, v * .35)); }; // deux billes qui se touchent
  const sRail = v => { tone(160, 90, .09, Math.min(.3, v * .5)); noise(.05, 600, 1, Math.min(.15, v * .25)); };
  const sPocket = v => { tone(120, 60, .25, .35 * v); for (let i = 0; i < 4; i++) noise(.04, 900 + i * 200, 3, .12 * v, .05 + i * .06); };
  const sCue = v => { noise(.03, 1800, 3, .5 * v); tone(900, 500, .05, .2 * v); };
  const sChips = () => { for (let i = 0; i < 5; i++) noise(.025, 4000 + Math.random() * 2000, 6, .18, i * .035 + Math.random() * .02); };
  const sCard = () => noise(.08, 5000, .8, .2, 0, 'highpass');
  const sDing = () => { tone(1320, 1320, .25, .12); tone(1760, 1760, .35, .1, .12); };
  const nearVol = (x, z) => camera ? Math.max(0, 1 - Math.hypot(camera.position.x - x, camera.position.z - z) / 14) : 0;

  // ---------- 🎨 les textures ----------
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...o });
  const basic = color => new THREE.MeshBasicMaterial({ color });
  function neon(text, col, w = 1024, size = 110) { const [c, g] = cnv(w, 170); g.font = `900 ${size}px Outfit, Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = 34; g.fillStyle = '#fff'; g.fillText(text, w / 2, 88, w - 30); g.shadowBlur = 14; g.fillStyle = col; g.fillText(text, w / 2, 88, w - 30); return new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false }); }
  function carpetTex() { // la moquette du casino : bordeaux avec des motifs dorés
    const [c, g] = cnv(256, 256); g.fillStyle = '#2a0614'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(232,180,60,.55)'; g.lineWidth = 3; for (const [x, y] of [[64, 64], [192, 192], [192, 64], [64, 192]]) { g.beginPath(); g.moveTo(x, y - 40); g.lineTo(x + 40, y); g.lineTo(x, y + 40); g.lineTo(x - 40, y); g.closePath(); g.stroke(); g.beginPath(); g.arc(x, y, 12, 0, 7); g.stroke(); }
    g.fillStyle = 'rgba(120,20,60,.6)'; for (let i = 0; i < 400; i++) g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    return tex(c, [18, 14]);
  }
  function feltTex(col) { const [c, g] = cnv(256, 128); g.fillStyle = col; g.fillRect(0, 0, 256, 128); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .05})`; g.fillRect(Math.random() * 256, Math.random() * 128, 1, 1); } const r = g.createRadialGradient(128, 64, 10, 128, 64, 150); r.addColorStop(0, 'rgba(255,255,255,.07)'); r.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = r; g.fillRect(0, 0, 256, 128); return tex(c); }
  const BALLC = ['#f4f1e6', '#f5c400', '#1c4fd8', '#d42020', '#6a1fb0', '#f07800', '#12804a', '#7a1a1a', '#111111'];
  function ballMat(n) {
    const [c, g] = cnv(256, 128), col = BALLC[n > 8 ? n - 8 : n];
    g.fillStyle = n > 8 ? '#f4f1e6' : col; g.fillRect(0, 0, 256, 128);
    if (n > 8) { g.fillStyle = col; g.fillRect(0, 34, 256, 60); }
    if (n) for (const x of [64, 192]) { g.fillStyle = '#f4f1e6'; g.beginPath(); g.ellipse(x, 64, 17, 26, 0, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = '900 26px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), x, 66); }
    else { g.fillStyle = '#c02020'; g.beginPath(); g.arc(64, 64, 5, 0, 7); g.fill(); }
    return new THREE.MeshPhysicalMaterial({ map: tex(c), roughness: .12, clearcoat: 1, clearcoatRoughness: .04 });
  }
  const cardCache = new Map();
  function cardTex(cd) { // une carte à jouer (cd = 0..51, ou -1 = le dos)
    if (cardCache.has(cd)) return cardCache.get(cd);
    const [c, g] = cnv(128, 180); g.fillStyle = cd < 0 ? '#7b1030' : '#fbfaf6'; g.beginPath(); g.roundRect?.(2, 2, 124, 176, 12); g.fill();
    if (cd < 0) { g.strokeStyle = '#f2c14e'; g.lineWidth = 4; g.strokeRect(14, 14, 100, 152); g.font = '900 56px serif'; g.fillStyle = '#f2c14e'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', 64, 92); }
    else { const s = Math.floor(cd / 13), red = s === 1 || s === 2; g.fillStyle = red ? '#d11a2a' : '#141414'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 42px Inter, sans-serif'; g.fillText(RN[cd % 13], 34, 32); g.font = '36px serif'; g.fillText(SU[s], 34, 70); g.font = '84px serif'; g.fillText(SU[s], 72, 122); }
    const t = tex(c); cardCache.set(cd, t); return t;
  }
  const cardHtml = (cd, big) => cd == null || cd < 0 ? el('span', { class: 'cs-card back' + (big ? ' big' : '') }) : el('span', { class: 'cs-card' + ([1, 2].includes(Math.floor(cd / 13)) ? ' red' : '') + (big ? ' big' : '') }, el('b', {}, RN[cd % 13]), el('i', {}, SU[Math.floor(cd / 13)]));
  function tagSprite() { const [c, g] = cnv(512, 112), t = tex(c), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(1.5, .33, 1); s.renderOrder = 5; s.set = (txt, col = '#fff') => { if (s._t === txt + col) return; s._t = txt + col; g.clearRect(0, 0, 512, 112); g.font = '800 46px Outfit, Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const w = Math.min(504, g.measureText(txt).width + 40); g.fillStyle = 'rgba(8,6,20,.72)'; g.beginPath(); g.roundRect?.(256 - w / 2, 12, w, 86, 43); g.fill(); g.fillStyle = col; g.fillText(txt, 256, 57, 480); t.needsUpdate = true; }; return s; }

  // ---------- 🏗️ le bâtiment ----------
  const boxes = []; // les obstacles [x0, z0, x1, z1]
  const block = (x0, z0, x1, z1) => boxes.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
  const fits = (x, z) => me.zone === 'cine' ? cineFits(x, z) : me.zone === 'hall' ? hallFits(x, z) : me.zone === 'night' ? nightFits(x, z) : me.zone === 'kart' ? kartFits(x, z) : x > -17.6 && x < 17.6 && z > -13.5 && z < 13.4 && !boxes.some(([a, b, c, d]) => x > a - RAD && x < c + RAD && z > b - RAD && z < d + RAD);
  const anims = []; // petites animations du décor
  let spots = []; // les endroits où l'on peut faire quelque chose
  function build() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x07040c); scene.fog = new THREE.Fog(0x07040c, 32, 70);
    boxes.length = 0; anims.length = 0;
    scene.add(new THREE.HemisphereLight(0xffd9c0, 0x301020, 1.25));
    const key = new THREE.DirectionalLight(0xfff0e0, .9); key.position.set(4, 10, 6); scene.add(key);
    // sol, plafond, murs
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(36, 28), std(0xffffff, { map: carpetTex(), roughness: .95 })); fl.rotation.x = -Math.PI / 2; scene.add(fl);
    const ce = new THREE.Mesh(new THREE.PlaneGeometry(36, 28), basic(0x0b0710)); ce.rotation.x = Math.PI / 2; ce.position.y = 6; scene.add(ce);
    const wallM = std(0x1a0d1e, { roughness: .8 });
    for (const [w, x, z, ry] of [[36, 0, 14, Math.PI], [28, -18, 0, Math.PI / 2], [28, 18, 0, -Math.PI / 2]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 6), wallM); m.position.set(x, 3, z); m.rotation.y = ry; scene.add(m); }
    // le mur du fond (nord) avec ses deux grandes vitres : le bowling à gauche, le laser game à droite
    for (const [x0, x1] of [[-18, -16], [-4, 4], [16, 18]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 6), wallM); m.position.set((x0 + x1) / 2, 3, -14); scene.add(m); }
    for (const x of [-10, 10]) { const top = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.6), wallM); top.position.set(x, 4.7, -14); scene.add(top); const bot = new THREE.Mesh(new THREE.PlaneGeometry(12, .4), wallM); bot.position.set(x, .2, -14); scene.add(bot); }
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x88aacc, transparent: true, opacity: .12, roughness: .05, metalness: .1, depthWrite: false });
    for (const x of [-10, 10]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), glass); g.position.set(x, 1.9, -14); scene.add(g); }
    // les néons le long des murs
    for (const [x, z, w, d, col] of [[0, 13.95, 36, .03, 0xff2bd6], [-17.95, 0, .03, 28, 0x38e8ff], [17.95, 0, .03, 28, 0xffd23f], [0, -13.95, 36, .03, 0x9b5cff]]) { const n = new THREE.Mesh(new THREE.BoxGeometry(w, .05, d), basic(col)); n.position.set(x, 3.5, z); scene.add(n); const n2 = n.clone(); n2.position.y = .12; scene.add(n2); }
    block(-18, -14.2, 18, -13.9);
    // l'entrée (au sud) et la grande enseigne
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.3), neon('PARADISE CLUB', '#ff2bd6')); sign.position.set(0, 4.6, 13.9); sign.rotation.y = Math.PI; scene.add(sign);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.2), std(0x05030a, { emissive: 0x1a0a30 })); door.position.set(0, 1.6, 13.95); door.rotation.y = Math.PI; scene.add(door);
    const exitS = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .3), neon('🚪 SORTIE', '#2bff88', 512, 90)); exitS.position.set(0, 3.45, 13.9); exitS.rotation.y = Math.PI; scene.add(exitS);
    // des lustres
    for (const [x, z] of [[-5, 3.5], [7.5, 3.5], [0, -5], [0, 9]]) chandelier(x, z);
    buildBowling(); buildLaser(); buildBar(); POOLS.forEach((p, i) => buildPool(i, p)); buildPoker(); buildSlots(); buildLounge(); buildParty(); buildCinema(); buildHall(); buildNight(); buildKart();
    // les reflets
    const pm = new THREE.PMREMGenerator(R), env = new THREE.Scene(); env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: 0x24121e, side: THREE.BackSide })));
    for (const [x, y, z, c] of [[3, 4, 2, 0xff2bd6], [-3, 4, 6, 0x38e8ff], [0, 6, -4, 0xfff0d0], [0, -3, 0, 0x301018]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), new THREE.MeshBasicMaterial({ color: c })); s.position.set(x, y, z); env.add(s); }
    scene.environment = pm.fromScene(env, .04).texture;
    camera = new THREE.PerspectiveCamera(mobile() ? 64 : 55, 1, .03, 80);
    spots = [
      { x: 0, z: 12.6, r: 1.6, icon: '🏬', label: 'Retour à l\'atrium', act: () => goZone('hallFromClub') },
      { zone: 'hall', lvl: 0, x: -80, z: 19, r: 1.8, icon: '🚪', label: 'Quitter le Paradise Complex', act: () => { if (confirm('Quitter le Paradise Complex ?')) leave(); } },
      { zone: 'hall', lvl: 0, x: -99, z: 8, r: 2, icon: '🏎️', label: 'Aller au karting', act: () => goZone('kart') },
      { zone: 'hall', lvl: 0, x: -61, z: 8, r: 2, icon: '🎰', label: 'Aller au casino & jeux', act: () => goZone('club') },
      { zone: 'hall', lvl: 0, x: -72, z: 3.2, r: 1.6, icon: '🗺️', label: 'Voir le plan du complexe', act: () => mapPanel() },
      { zone: 'hall', lvl: 0, x: -90, z: 10, r: 3.9, icon: '🪙', label: 'Faire un vœu dans la fontaine', act: () => { socket.emit('cs_emote', '✨'); sDing(); toast('🪙 Plouf ! Ton vœu est fait ✨'); } },
      { zone: 'hall', lvl: 1, x: -90, z: -19.3, r: 1.7, icon: '🪩', label: 'Entrer dans la boîte de nuit', act: () => goZone('night') },
      { zone: 'hall', lvl: 1, x: -70, z: -19.3, r: 1.7, icon: '🎬', label: 'Entrer au cinéma', act: () => goZone('cine') },
      { zone: 'night', x: 115, z: 14.1, r: 1.7, icon: '🚪', label: 'Sortir de la boîte de nuit', act: () => goZone('hallFromNight') },
      { zone: 'night', x: 115, z: -9.6, r: 2.6, icon: '🎧', label: 'Choisir le son du DJ (YouTube)', act: () => ytPanel() },
      { zone: 'night', x: 115, z: -4, r: 5.5, icon: '💃', label: 'Danser sur la piste', act: () => socket.emit('cs_emote', '💃') },
      { zone: 'night', x: 124, z: 0, r: 2.4, icon: '🍸', label: 'Commander au bar', act: () => drinkMenu() },
      { zone: 'night', x: 107.5, z: 0, r: 3, icon: '🍾', label: 'Commander une bouteille au carré VIP', act: () => { ack('cs_drink', 'champ'); socket.emit('cs_emote', '🍾'); sDing(); toast('🍾 Bouteille VIP servie avec ses étincelles !'); } },
      { zone: 'kart', x: -145, z: 23.5, r: 1.8, icon: '🏬', label: 'Retour au complexe', act: () => goZone('hallFromKart') },
      { zone: 'kart', x: -147, z: 0, r: 3.2, icon: '🏎️', label: 'Prendre un kart', act: () => takeKart() },
      { zone: 'kart', x: -146, z: 10, r: 2.2, icon: '🏁', label: 'Voir le classement', act: () => kartBoardPanel() },
      { x: 4, z: 12.7, r: 1.5, icon: '🎬', label: 'Aller au cinéma', act: () => goCine(true) },
      { zone: 'cine', lvl: 0, x: CI.mid, z: 14.1, r: 1.6, icon: '🏬', label: 'Retour à l\'atrium', act: () => goCine(false) },
      { zone: 'cine', lvl: 0, x: 70.5, z: 6.2, r: 2.2, icon: '🍿', label: 'Prendre du popcorn', act: () => drinkMenu(true) },
      { zone: 'cine', lvl: 0, x: 49.5, z: 6.2, r: 2.2, icon: '🎟️', label: 'Voir les films à l\'affiche', act: () => cineProgram() },
      ...[0, 1, 2, 3].map(k => ({ zone: 'cine', lvl: 1, x: CI.c(k), z: -23.5, r: 4.6, icon: '🪑', label: `S'asseoir (salle ${k + 1})`, act: () => sitDown(k) })),
      ...[0, 1, 2, 3].map(k => ({ zone: 'cine', lvl: 1, x: CI.c(k), z: -16.3, r: 1.3, icon: '🎬', label: `Choisir le film de la salle ${k + 1}`, act: () => ytPanel() })),
      { x: -10, z: -12.8, r: 2.4, icon: '🎳', label: 'Entrer au Bowling', act: () => goTo('bowling') },
      { x: 10, z: -12.8, r: 2.4, icon: '🔫', label: 'Entrer au Laser Game', act: () => goTo('laser') },
      { x: -13.9, z: 0, r: 2.6, icon: '🍹', label: 'Commander au bar', act: () => drinkMenu() },
      ...POOLS.map((p, i) => ({ x: p.x, z: p.z, r: 2.4, icon: '🎱', label: () => { const T = tables[i]?.st; return T && (T.status === 'playing' || T.status === 'ended' || T.players.length >= 2) ? `Regarder le billard ${i + 1}` : `Jouer au billard ${i + 1}`; }, act: () => poolSit(i) })),
      { x: PK.x, z: PK.z, r: 3.4, icon: '🃏', label: 'S\'asseoir au poker', act: () => pokerSit() },
      { x: 16.2, z: 1, r: 2.2, icon: '🎰', label: 'Jouer à la machine à sous', act: () => slotGame() },
      { x: 0, z: -11.2, r: 1.9, icon: '📺', label: 'Choisir la vidéo des écrans', act: () => ytPanel() },
      { x: 0, z: -7.6, r: 3, icon: '💃', label: 'Danser', act: () => socket.emit('cs_emote', '💃') },
    ];
  }
  function chandelier(x, z) {
    const g = new THREE.Group(); g.position.set(x, 5.2, z); scene.add(g);
    const gold = std(0xd4a24a, { metalness: .9, roughness: .25 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.7, .03, 8, 32), gold); ring.rotation.x = Math.PI / 2; g.add(ring);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .8), gold); rod.position.y = .4; g.add(rod);
    const bulbM = new THREE.MeshBasicMaterial({ color: 0xfff1c8 });
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, b = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), bulbM); b.position.set(Math.cos(a) * .7, .06, Math.sin(a) * .7); g.add(b); const cr = new THREE.Mesh(new THREE.OctahedronGeometry(.05), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: .6, roughness: 0, metalness: .2 })); cr.position.set(Math.cos(a) * .55, -.2, Math.sin(a) * .55); g.add(cr); }
  }
  // 🎳 derrière la vitre de gauche : 4 pistes de bowling, avec des boules qui roulent
  function buildBowling() {
    const wood = (() => { const [c, g] = cnv(64, 1024); for (let i = 0; i < 16; i++) { const v = 200 + Math.random() * 30 | 0; g.fillStyle = `rgb(${v},${v - 45},${v - 100})`; g.fillRect(i * 4, 0, 4, 1024); } return tex(c); })();
    const laneM = new THREE.MeshPhysicalMaterial({ map: wood, roughness: .2, clearcoat: 1 }), pinM = std(0xf7f5f0, { roughness: .3 }), pinG = new THREE.CylinderGeometry(.03, .055, .38, 10);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 22), std(0x120b26)); floor.rotation.x = -Math.PI / 2; floor.position.set(-10, 0, -25); scene.add(floor);
    for (const [w, x, z, ry] of [[22, -17, -25, Math.PI / 2], [22, -3, -25, -Math.PI / 2], [14, -10, -36, 0]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 6), std(0x0d0a1c)); m.position.set(x, 3, z); m.rotation.y = ry; scene.add(m); }
    const bs = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), neon('🎳 BOWLING PARADISE', '#38e8ff')); bs.position.set(-10, 3.2, -35.9); scene.add(bs);
    for (let k = 0; k < 4; k++) {
      const x = -14.4 + k * 2.9, L = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 19), laneM); L.rotation.x = -Math.PI / 2; L.position.set(x, .01, -25); scene.add(L);
      const pins = []; for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) { const p = new THREE.Mesh(pinG, pinM); p.position.set(x + (i - r / 2) * .3, .19, -33 - r * .26); scene.add(p); pins.push(p); }
      const ball = new THREE.Mesh(new THREE.SphereGeometry(.11, 16, 12), new THREE.MeshPhysicalMaterial({ color: [0xff2bd6, 0x38e8ff, 0xffd23f, 0x2bff88][k], roughness: .1, clearcoat: 1 })); ball.position.set(x, .11, -16); scene.add(ball);
      const st = { t: -Math.random() * 6 };
      anims.push(dt => { st.t += dt; const T = st.t; if (T < 0) { ball.visible = false; return; } ball.visible = T < 3.2;
        ball.position.z = -16 - Math.min(1, T / 3) * 17.5; ball.rotation.x -= dt * 25;
        if (T > 3 && !st.hit) { st.hit = true; pins.forEach(p => { p.userData.d = Math.random() < .8 ? (Math.random() - .5) * 3 : 0; }); if (nearVol(x, -30) > .05) noise(.2, 900, .8, .25 * nearVol(x, -30)); }
        if (st.hit) pins.forEach(p => { if (p.userData.d) { p.rotation.z = Math.min(1.5, (T - 3) * 6) * Math.sign(p.userData.d); p.position.y = .19 - Math.min(.13, (T - 3) * .5); } });
        if (T > 6) { st.t = -2 - Math.random() * 6; st.hit = false; pins.forEach(p => { p.rotation.z = 0; p.position.y = .19; }); } });
    }
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3), new THREE.MeshBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: .18 })); portal.position.set(-10, 1.5, -13.9); scene.add(portal);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4.6, .8), neon('🎳 BOWLING', '#38e8ff')); s.position.set(-10, 3.9, -13.85); scene.add(s);
    anims.push((dt, t) => { portal.material.opacity = .14 + Math.sin(t * 2) * .06; });
  }
  // 🔫 derrière la vitre de droite : l'arène du laser game, sombre, avec des rayons qui passent
  function buildLaser() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), std(0x05060c)); floor.rotation.x = -Math.PI / 2; floor.position.set(10, 0, -21); scene.add(floor);
    for (const [w, x, z, ry] of [[14, 3, -21, Math.PI / 2], [14, 17, -21, -Math.PI / 2], [14, 10, -28, 0]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 6), std(0x07080f)); m.position.set(x, 3, z); m.rotation.y = ry; scene.add(m); }
    const blkM = std(0x10131f, { emissive: 0x05101a }), edge = [0xff3df0, 0x38e8ff, 0x39ff8a];
    for (let i = 0; i < 9; i++) { const w = .8 + Math.random() * 2, h = 1 + Math.random() * 1.6, b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .8), blkM); b.position.set(4.5 + Math.random() * 11, h / 2, -16.5 - Math.random() * 10); scene.add(b); const e = new THREE.Mesh(new THREE.BoxGeometry(w + .02, .04, .82), basic(edge[i % 3])); e.position.copy(b.position); e.position.y = h; scene.add(e); }
    const beams = [];
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(14, .015, .015), new THREE.MeshBasicMaterial({ color: edge[i % 3], transparent: true, opacity: .8, blending: THREE.AdditiveBlending })); b.position.set(10, 1.2, -20); scene.add(b); beams.push(b); }
    anims.push((dt, t) => beams.forEach((b, i) => { b.rotation.y = Math.sin(t * .6 + i * 1.3) * .9; b.position.z = -21 + Math.sin(t * .4 + i) * 5; b.position.y = 1 + Math.sin(t * .9 + i * 2) * .5; b.material.opacity = (Math.sin(t * 3 + i) > -.3) ? .85 : 0; }));
    const lg = new THREE.PointLight(0xff3df0, 8, 12); lg.position.set(10, 3, -20); scene.add(lg);
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3), new THREE.MeshBasicMaterial({ color: 0x39ff8a, transparent: true, opacity: .18 })); portal.position.set(10, 1.5, -13.9); scene.add(portal);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4.6, .8), neon('🔫 LASER GAME', '#39ff8a')); s.position.set(10, 3.9, -13.85); scene.add(s);
    anims.push((dt, t) => { portal.material.opacity = .14 + Math.sin(t * 2.4 + 1) * .06; });
  }
  // 🍹 le bar (à gauche) : le comptoir lumineux, les bouteilles, les tabourets et le barman
  function buildBar() {
    const top = new THREE.Mesh(new THREE.BoxGeometry(.8, .08, 12), std(0x2b1a10, { roughness: .2, metalness: .3 })); top.position.set(-15, 1.12, 0); scene.add(top);
    const front = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.08, 12), std(0x150a18, { emissive: 0x1a0420 })); front.position.set(-15, .54, 0); scene.add(front);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(.02, .05, 12), basic(0xff2bd6)); strip.position.set(-14.64, 1.02, 0); scene.add(strip);
    const strip2 = new THREE.Mesh(new THREE.BoxGeometry(.02, .05, 12), basic(0x38e8ff)); strip2.position.set(-14.64, .1, 0); scene.add(strip2);
    block(-15.4, -6, -14.6, 6); block(-18, -6.4, -15.4, -6); block(-18, 6, -15.4, 6.4);
    const shelfM = std(0x3a2414, { roughness: .4 });
    for (const y of [1.5, 2.1, 2.7]) { const s = new THREE.Mesh(new THREE.BoxGeometry(.35, .04, 11), shelfM); s.position.set(-17.75, y, 0); scene.add(s);
      for (let z = -5.2; z < 5.3; z += .32) { const h = .22 + Math.random() * .16, col = [0x39ff8a, 0xff2bd6, 0xffd23f, 0x38e8ff, 0xff6a00, 0xb07cff][Math.random() * 6 | 0];
        const b = new THREE.Mesh(new THREE.CylinderGeometry(.04, .045, h, 8), new THREE.MeshPhysicalMaterial({ color: col, transparent: true, opacity: .85, roughness: .05, emissive: col, emissiveIntensity: .35 })); b.position.set(-17.75, y + .02 + h / 2, z); scene.add(b); } }
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(11, 2), std(0x1c1c2a, { metalness: 1, roughness: .1 })); mirror.position.set(-17.97, 2.1, 0); mirror.rotation.y = Math.PI / 2; scene.add(mirror);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4, .9), neon('🍸 COCKTAIL BAR', '#ff2bd6')); s.position.set(-17.9, 3.6, 0); s.rotation.y = Math.PI / 2; scene.add(s);
    const stoolTop = std(0xd0204a, { roughness: .4 }), chrome = std(0xcccccc, { metalness: 1, roughness: .2 });
    for (let z = -5; z <= 5; z += 1.25) { const st = new THREE.Group(); st.position.set(-14.1, 0, z); const seat = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .08, 16), stoolTop); seat.position.y = .78; const leg = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .76), chrome); leg.position.y = .38; const foot = new THREE.Mesh(new THREE.CylinderGeometry(.18, .2, .03, 16), chrome); st.add(seat, leg, foot); scene.add(st); }
    const l = new THREE.PointLight(0xff5fd0, 6, 9); l.position.set(-15, 3, 0); scene.add(l);
    // le barman
    const src = K.people.men[1 % K.people.men.length], h = K.makeHuman(src, src.k * 1.78 / 43); h.g.position.set(-16.3, 0, 0); h.g.rotation.y = Math.PI / 2; scene.add(h.g);
    const tag = tagSprite(); tag.set('🍸 Le barman', '#ffd23f'); tag.position.y = 2.1; h.g.add(tag);
    anims.push(dt => h.mixer.update(dt)); bartender = h;
  }
  let bartender = null;
  // 🎱 les billards
  function buildPool(i, p) {
    const G = new THREE.Group(); G.position.set(p.x, 0, p.z); scene.add(G);
    const W = PP.T.L, D = PP.T.W, wood = new THREE.MeshPhysicalMaterial({ color: 0x5a2a12, roughness: .35, clearcoat: .7 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W + .34, .14, D + .34), wood); frame.position.y = TH - .08; G.add(frame);
    for (const [x, z, w, d] of [[0, -(D / 2 + .085), W + .34, .17], [0, D / 2 + .085, W + .34, .17], [-(W / 2 + .085), 0, .17, D], [W / 2 + .085, 0, .17, D]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, .05, d), wood); r.position.set(x, TH + .02, z); G.add(r); }
    const body = new THREE.Mesh(new THREE.BoxGeometry(W + .1, .3, D + .1), wood); body.position.y = TH - .26; G.add(body);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(.14, TH - .3, .14), wood); lg.position.set(x * (W / 2 - .05), (TH - .3) / 2, z * (D / 2 - .05)); G.add(lg); }
    const felt = new THREE.Mesh(new THREE.PlaneGeometry(W + .1, D + .1), new THREE.MeshStandardMaterial({ map: feltTex(i ? '#0d3f8a' : '#0f6b3a'), roughness: .95 })); felt.rotation.x = -Math.PI / 2; felt.position.y = TH + .005; G.add(felt);
    const cushM = std(i ? 0x0a336f : 0x0b5530, { roughness: .9 });
    const segs = [[-W / 4, -D / 2, W / 2 - .15, true], [W / 4, -D / 2, W / 2 - .15, true], [-W / 4, D / 2, W / 2 - .15, true], [W / 4, D / 2, W / 2 - .15, true], [-W / 2, 0, D - .15, false], [W / 2, 0, D - .15, false]];
    for (const [x, z, len, alongX] of segs) { const c = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : .05, .045, alongX ? .05 : len), cushM); c.position.set(x + (alongX ? 0 : Math.sign(x) * .025), TH + .025, z + (alongX ? Math.sign(z) * .025 : 0)); G.add(c); }
    const holeM = basic(0x020202); for (const [x, z, r] of PP.POCKETS) { const h = new THREE.Mesh(new THREE.CircleGeometry(r * 1.05, 20), holeM); h.rotation.x = -Math.PI / 2; h.position.set(x, TH + .008, z); G.add(h); }
    const diam = basic(0xf0e6c8); for (let k = 1; k < 8; k++) { if (k === 4) continue; for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.CircleGeometry(.008, 6), diam); d.rotation.x = -Math.PI / 2; d.position.set(-W / 2 + k * W / 8, TH + .022, s * (D / 2 + .1)); G.add(d); } }
    // la lampe au-dessus
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.9, .14, .38), std(0x0e3b22, { metalness: .5, roughness: .3 })); lamp.position.y = 2.1; G.add(lamp);
    const lampL = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .3), basic(0xfff3d6)); lampL.rotation.x = Math.PI / 2; lampL.position.y = 2.025; G.add(lampL);
    const sp = new THREE.SpotLight(0xfff1d6, 30, 5, 1.05, .6, 1.3); sp.position.set(0, 2, 0); sp.target.position.set(0, TH, 0); G.add(sp, sp.target);
    for (const x of [-.9, .9]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 3.8), std(0x222222)); w.position.set(x, 4.1, 0); G.add(w); }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .3), neon(`🎱 BILLARD ${i + 1}`, i ? '#38e8ff' : '#2bff88', 512, 80)); sign.position.set(0, 2.5, 0); sign.rotation.y = 0; G.add(sign);
    const sign2 = sign.clone(); sign2.rotation.y = Math.PI; G.add(sign2); const topHide = [lamp, lampL, sign, sign2];
    block(p.x - W / 2 - .2, p.z - D / 2 - .2, p.x + W / 2 + .2, p.z + D / 2 + .2);
    // les billes, la queue, la ligne de visée
    const bg = new THREE.SphereGeometry(PP.R, 24, 16), balls = [];
    for (let n = 0; n < 16; n++) { const m = new THREE.Mesh(bg, ballMat(n)); m.visible = false; G.add(m); balls.push(m); }
    const cue = new THREE.Group(); G.add(cue);
    const stickG = new THREE.CylinderGeometry(.0065, .014, 1.45, 12); stickG.rotateZ(Math.PI / 2); stickG.translate(-1.45 / 2, 0, 0);
    const stickM = new THREE.MeshPhysicalMaterial({ color: 0xc89a5a, roughness: .3, clearcoat: .8 }), stick = new THREE.Mesh(stickG, stickM); cue.add(stick);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(.0068, .0068, .012, 10), std(0x2a4aa0)); tip.rotation.z = Math.PI / 2; tip.position.x = -.006; stick.add(tip);
    const butt = new THREE.Mesh(new THREE.CylinderGeometry(.0142, .0148, .35, 12), std(0x111111, { roughness: .4 })); butt.rotation.z = Math.PI / 2; butt.position.x = -1.45 + .175; stick.add(butt);
    cue.visible = false;
    const lineM = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7 }), lineG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), line = new THREE.Line(lineG, lineM); G.add(line);
    const line2G = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), line2 = new THREE.Line(line2G, new THREE.LineBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .8 })); G.add(line2);
    const ghost = new THREE.Mesh(new THREE.RingGeometry(PP.R * .85, PP.R, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .6, side: THREE.DoubleSide })); ghost.rotation.x = -Math.PI / 2; G.add(ghost);
    line.visible = line2.visible = ghost.visible = false;
    tables[i] = { topHide, G, balls, cue, stick, line, line2, ghost, st: null, anim: null, aim: 0, power: .55, spin: 0, place: false, local: null, lastAng: 0 };
  }
  // 🃏 la table de poker
  function buildPoker() {
    const G = new THREE.Group(); G.position.set(PK.x, 0, PK.z); scene.add(G);
    const felt = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .06, 48), new THREE.MeshStandardMaterial({ map: feltTex('#7a1028'), roughness: .95 })); felt.scale.set(PK.rx, 1, PK.rz); felt.position.y = .76; G.add(felt);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(1, .09, 12, 64), new THREE.MeshPhysicalMaterial({ color: 0x1b0d08, roughness: .35, clearcoat: .6 })); rail.rotation.x = Math.PI / 2; rail.scale.set(PK.rx + .05, PK.rz + .05, 1); rail.position.y = .8; G.add(rail);
    const goldL = new THREE.Mesh(new THREE.TorusGeometry(1, .006, 4, 64), basic(0xf2c14e)); goldL.rotation.x = Math.PI / 2; goldL.scale.set(PK.rx * .72, PK.rz * .62, 1); goldL.position.y = .795; G.add(goldL);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.5, .7, .74, 24), std(0x140808)); base.position.y = .37; G.add(base);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(3, .55), neon('🃏 POKER', '#f2c14e')); s.position.set(0, 3.2, 0); G.add(s); const s2 = s.clone(); s2.rotation.y = Math.PI; G.add(s2);
    const lamp = new THREE.SpotLight(0xffe7c0, 30, 6, 1.1, .5, 1.2); lamp.position.set(0, 3, 0); lamp.target.position.set(0, .8, 0); G.add(lamp, lamp.target);
    const chairM = std(0x5a0c1e, { roughness: .5 });
    for (let i = 0; i < 6; i++) { const [x, z] = seatXZ(i, 1.2), c = new THREE.Group(); c.position.set(x - PK.x, 0, z - PK.z); c.rotation.y = Math.atan2(PK.x - x, PK.z - z);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(.5, .1, .5), chairM); seat.position.y = .48; const back = new THREE.Mesh(new THREE.BoxGeometry(.5, .6, .08), chairM); back.position.set(0, .8, -.24); const leg = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .45), std(0xd4a24a, { metalness: .9 })); leg.position.y = .23; c.add(seat, back, leg); G.add(c); }
    block(PK.x - PK.rx - .1, PK.z - PK.rz - .1, PK.x + PK.rx + .1, PK.z + PK.rz + .1);
    // les cartes du milieu, les cartes des joueurs, les jetons
    const cg = new THREE.PlaneGeometry(.13, .18), board = [];
    for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ map: cardTex(-1), roughness: .5 })); m.rotation.x = -Math.PI / 2; m.position.set((k - 2) * .16, .795, 0); m.visible = false; G.add(m); board.push(m); }
    const holes = []; for (let i = 0; i < 6; i++) { const pair = []; for (let k = 0; k < 2; k++) { const m = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ map: cardTex(-1), roughness: .5 })); m.rotation.x = -Math.PI / 2; const [x, z] = seatXZ(i, .7); m.position.set(x - PK.x + (k - .5) * .1, .796 + k * .001, z - PK.z); m.rotation.z = Math.atan2(PK.x - x, PK.z - z); m.visible = false; G.add(m); pair.push(m); } holes.push(pair); }
    const chipG = new THREE.CylinderGeometry(.03, .03, .008, 16), chipM = [0xd42020, 0x1c4fd8, 0x12804a, 0x111111, 0xf2c14e].map(c => std(c, { roughness: .4 }));
    const potG = new THREE.Group(); potG.position.set(0, .795, .22); G.add(potG);
    const bets = []; for (let i = 0; i < 6; i++) { const g = new THREE.Group(); const [x, z] = seatXZ(i, .55); g.position.set(x - PK.x, .795, z - PK.z); G.add(g); bets.push(g); }
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .012, 20), new THREE.MeshStandardMaterial({ map: (() => { const [c, g] = cnv(64, 64); g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#111'; g.font = '900 40px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('D', 32, 34); return tex(c); })() })); btn.position.y = .8; G.add(btn);
    pk.meshes = { G, board, holes, potG, bets, chipG, chipM, btn };
  }
  function seatXZ(i, k = 1) { const a = Math.PI / 2 + i * Math.PI * 2 / 6; return [PK.x + Math.cos(a) * (PK.rx + .55) * k, PK.z + Math.sin(a) * (PK.rz + .55) * k]; }
  function stackChips(g, n) { // une pile de jetons proportionnelle à la mise
    const M = pk.meshes; while (g.children.length) g.remove(g.children[0]); if (!n) return;
    const cnt = Math.min(24, Math.ceil(Math.log2(n / 5 + 1) * 3)); for (let k = 0; k < cnt; k++) { const c = new THREE.Mesh(M.chipG, M.chipM[Math.floor(k / 6) % 5]); const col = Math.floor(k / 8); c.position.set((col - 1) * .065, .004 + (k % 8) * .0085, 0); g.add(c); }
  }
  // 🎰 les machines à sous (mur de droite)
  function buildSlots() {
    for (let k = 0; k < 7; k++) { const z = -4 + k * 1.3, g = new THREE.Group(); g.position.set(17.3, 0, z); g.rotation.y = -Math.PI / 2; scene.add(g);
      const body = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.6, .7), std([0x7b1030, 0x1c3a8a, 0x5a1a8a][k % 3], { metalness: .5, roughness: .3 })); body.position.y = .8; g.add(body);
      const [c, gx] = cnv(256, 128); const t = tex(c); const scr = new THREE.Mesh(new THREE.PlaneGeometry(.7, .35), new THREE.MeshBasicMaterial({ map: t })); scr.position.set(0, 1.15, .351); g.add(scr);
      const top = new THREE.Mesh(new THREE.BoxGeometry(.92, .3, .72), new THREE.MeshBasicMaterial({ color: [0xff2bd6, 0x38e8ff, 0xffd23f][k % 3] })); top.position.y = 1.75; g.add(top);
      const lever = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .4), std(0xcccccc, { metalness: 1 })); lever.position.set(.5, 1.2, 0); g.add(lever); const knob = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), basic(0xd42020)); knob.position.set(.5, 1.42, 0); g.add(knob);
      const E = ['🍒', '🍋', '⭐', '💎', '7️⃣', '🔔']; let acc = Math.random() * 2;
      const draw = () => { gx.fillStyle = '#fff8e0'; gx.fillRect(0, 0, 256, 128); gx.font = '64px serif'; gx.textAlign = 'center'; gx.textBaseline = 'middle'; for (let r = 0; r < 3; r++) gx.fillText(E[Math.random() * E.length | 0], 45 + r * 83, 66); t.needsUpdate = true; };
      draw(); anims.push(dt => { acc += dt; if (acc > 2.5 + k * .3) { acc = 0; draw(); } });
    }
    block(16.85, -4.6, 18, 4.4 + 1.3);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4.2, .8), neon('🎰 JACKPOT', '#ffd23f')); s.position.set(17.9, 3.3, 1); s.rotation.y = -Math.PI / 2; scene.add(s);
  }
  // 🛋️ le salon près de l'entrée : canapés, plantes
  function buildLounge() {
    const sofaM = std(0x3a0a5a, { roughness: .7 });
    for (const [x, z, ry] of [[-8, 11.5, Math.PI], [8, 11.5, Math.PI], [-12.5, 9, Math.PI / 2], [12.5, 9, -Math.PI / 2]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, .42, .9), sofaM); seat.position.y = .21; const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, .6, .22), sofaM); back.position.set(0, .6, -.36); g.add(seat, back);
      for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(.2, .55, .9), sofaM); arm.position.set(s * 1.2, .3, 0); g.add(arm); }
      const pts = [[1.3, -.2], [1.3, .2], [-1.3, .2], [-1.3, -.2]].map(([a, b]) => [x + a * Math.cos(ry) + b * Math.sin(ry), z - a * Math.sin(ry) + b * Math.cos(ry)]);
      block(Math.min(...pts.map(p => p[0])) - .3, Math.min(...pts.map(p => p[1])) - .3, Math.max(...pts.map(p => p[0])) + .3, Math.max(...pts.map(p => p[1])) + .3);
    }
    const potM = std(0x222222, { metalness: .6 }), leafM = std(0x1f7a3a);
    for (const [x, z] of [[-2.6, 13], [2.6, 13], [-17, 12.8], [17, 12.8], [-3.5, -13.2], [3.5, -13.2]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.25, .2, .5, 12), potM); p.position.set(x, .25, z); scene.add(p); for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(.12, .9, 6), leafM); l.position.set(x + Math.cos(k) * .1, .9, z + Math.sin(k) * .1); l.rotation.set(Math.cos(k) * .5, 0, Math.sin(k) * .5); scene.add(l); } block(x - .3, z - .3, x + .3, z + .3); }
  }

  // ---------- 🎉 l'ambiance de fête : piste de danse, boule à facettes, faisceaux, confettis, néons qui changent de couleur, écrans ----------
  const screens = []; let tvCtx = null, tvTex = null, tvThumb = null, tvThumbId = '';
  function buildParty() {
    screens.length = 0;
    // le mur d'écran géant (au fond, entre les deux vitres) et la cabine du DJ
    const [c, g] = cnv(512, 288); tvCtx = g; tvTex = tex(c); const tvM = new THREE.MeshBasicMaterial({ map: tvTex, fog: false });
    const big = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.05), tvM); big.position.set(0, 3.15, -13.86); scene.add(big); screens.push({ m: big, w: 7.2, h: 4.05 });
    const bz = new THREE.Mesh(new THREE.BoxGeometry(7.5, 4.35, .1), std(0x08060e, { metalness: .6, roughness: .3 })); bz.position.set(0, 3.15, -13.95); scene.add(bz);
    const partyMats = [];
    const tube = (w, h, d, x, y, z, hue) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue, 1, .6) }); m.userData.hue = hue; partyMats.push(m); const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); t.position.set(x, y, z); scene.add(t); return t; };
    for (const [y, h] of [[1.08, .05], [5.25, .05]]) tube(7.6, h, .05, 0, y, -13.85, .85);
    for (const x of [-3.8, 3.8]) tube(.05, 4.2, .05, x, 3.15, -13.85, .55);
    const dj = new THREE.Group(); dj.position.set(0, 0, -12.6); scene.add(dj);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, .8), std(0x0d0816, { metalness: .4, roughness: .4 })); desk.position.y = .52; dj.add(desk);
    for (const x of [-.7, .7]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .03, 24), std(0x111111, { metalness: .8, roughness: .2 })); p.position.set(x, 1.07, 0); dj.add(p); anims.push(dt => { p.rotation.y += dt * 3.5; }); }
    const djS = new THREE.Mesh(new THREE.PlaneGeometry(2.5, .5), neon('🎧 DJ PARADISE', '#ff2bd6', 1024, 120)); djS.position.set(0, .55, .41); dj.add(djS);
    block(-1.4, -13.1, 1.4, -12.15);
    // la piste de danse : des dalles qui s'allument en rythme
    const tiles = [], tg = new THREE.PlaneGeometry(.96, .96);
    for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) { const m = new THREE.MeshBasicMaterial({ color: 0x220022 }), t = new THREE.Mesh(tg, m); t.rotation.x = -Math.PI / 2; t.position.set(-3 + i, .012, -10.4 + j); scene.add(t); tiles.push({ m, i, j }); }
    const rim = tube(7.1, .03, .03, 0, .03, -10.95, .1); const rim2 = tube(7.1, .03, .03, 0, .03, -5.85, .1); tube(.03, .03, 5.1, -3.55, .03, -8.4, .1); tube(.03, .03, 5.1, 3.55, .03, -8.4, .1); void rim; void rim2;
    const floorS = new THREE.Mesh(new THREE.PlaneGeometry(4, .7), neon('💃 DANCE FLOOR 🕺', '#ffd23f')); floorS.position.set(0, 5.75, -13.8); floorS.scale.setScalar(.8); scene.add(floorS);
    // la boule à facettes et ses éclats de lumière
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(.45, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .05, flatShading: true })); ball.position.set(0, 5.1, -8.4); scene.add(ball);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, .9), std(0x888888)); wire.position.set(0, 5.6, -8.4); scene.add(wire);
    const dotTex = (() => { const [c, g] = cnv(64, 64), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return tex(c); })();
    const dots = []; for (let k = 0; k < 40; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: new THREE.Color().setHSL(Math.random(), 1, .7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(.35); scene.add(sp); dots.push({ sp, a: Math.random() * 6.28, r: 1 + Math.random() * 6, y: Math.random() < .6 ? .03 : 1 + Math.random() * 3 }); }
    // les faisceaux qui balayent la salle
    const beams = []; for (let k = 0; k < 6; k++) { const cone = new THREE.Mesh(new THREE.ConeGeometry(.9, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(k / 6, 1, .55), transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); cone.geometry.translate(0, -3, 0); const piv = new THREE.Group(); piv.position.set([-8, -3, 3, 8, -12, 12][k], 5.95, [-9, -11, -11, -9, 4, 4][k]); piv.add(cone); scene.add(piv); beams.push(piv); }
    // les confettis qui tombent doucement sur la piste
    const N = mobile() ? 160 : 380, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), cc = new THREE.Color();
    for (let k = 0; k < N; k++) { pos[k * 3] = (Math.random() - .5) * 9; pos[k * 3 + 1] = Math.random() * 5.5; pos[k * 3 + 2] = -8.4 + (Math.random() - .5) * 7; cc.setHSL(Math.random(), 1, .6); col.set([cc.r, cc.g, cc.b], k * 3); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const conf = new THREE.Points(pg, new THREE.PointsMaterial({ size: .07, vertexColors: true, transparent: true, opacity: .9, depthWrite: false })); scene.add(conf);
    // des néons partout : colonnes lumineuses le long des murs, cadres au plafond, enseignes
    for (const z of [-8, -2, 4, 10]) { tube(.06, 5.6, .06, -17.9, 2.9, z + (z === -2 || z === 4 ? 3.6 * Math.sign(z) + (z === -2 ? -2 : 2.5) : 0), (z + 10) / 24); tube(.06, 5.6, .06, 17.9, 2.9, z === 4 ? 7 : z, (z + 14) / 24); }
    for (const x of [-12, -6, 6, 12]) tube(.06, 5.6, .06, x, 2.9, 13.9, (x + 12) / 24);
    for (const [x, z, w, d] of [[-5, 3.5, 4.5, 8.5], [7.5, 3.5, 6, 4.5], [0, -8.4, 8, 6]]) { tube(w, .04, .04, x, 5.95, z - d / 2, .8); tube(w, .04, .04, x, 5.95, z + d / 2, .8); tube(.04, .04, d, x - w / 2, 5.95, z, .5); tube(.04, .04, d, x + w / 2, 5.95, z, .5); }
    for (const [txt, colr, x, y, z, ry] of [['✨ PARTY TIME ✨', '#ff2bd6', 9, 4.3, 13.88, Math.PI], ['🍾 VIP LOUNGE', '#ffd23f', -9, 4.3, 13.88, Math.PI], ['🎉 FIESTA', '#38e8ff', 17.88, 4.4, -9, -Math.PI / 2], ['⭐ PARADISE ⭐', '#2bff88', -17.88, 4.4, 9, Math.PI / 2]]) { const sgn = new THREE.Mesh(new THREE.PlaneGeometry(4.2, .75), neon(txt, colr)); sgn.position.set(x, y, z); sgn.rotation.y = ry; scene.add(sgn); }
    // les TV accrochées aux murs (elles passent toutes la même vidéo)
    for (const [x, y, z, ry] of [[17.86, 3, -6.2, -Math.PI / 2], [17.86, 3, 12, -Math.PI / 2], [-17.86, 3, -10.6, Math.PI / 2], [-17.86, 3, 12.2, Math.PI / 2], [-12, 3.1, 13.86, Math.PI], [12, 3.1, 13.86, Math.PI]]) {
      const G = new THREE.Group(); G.position.set(x, y, z); G.rotation.y = ry; scene.add(G);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.42, .08), std(0x050505, { metalness: .7, roughness: .3 })); frame.position.z = -.03; G.add(frame);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.24, 1.26), tvM); scr.position.z = .015; G.add(scr); screens.push({ m: scr, w: 2.24, h: 1.26 });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.7), new THREE.MeshBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.z = -.08; G.add(glow); partyMats.push(glow.material); glow.material.userData.hue = Math.random();
    }
    // tout bouge en rythme (environ 124 battements par minute)
    let tvAcc = 0, salleAcc = 0;
    anims.push((dt, t) => {
      const beat = t * 124 / 60, pulse = Math.pow(1 - (beat % 1), 3), step = Math.floor(beat);
      for (const m of partyMats) m.color.setHSL((m.userData.hue + t * .05) % 1, 1, .5 + pulse * .15);
      for (const T of tiles) { const v = Math.sin(T.i * 1.3 + T.j * .9 + step * 1.7), on = v > .1; T.m.color.setHSL(((T.i + T.j) / 12 + step * .13) % 1, 1, on ? .35 + pulse * .25 : .06); }
      ball.rotation.y += dt * .6;
      for (const d of dots) { d.a += dt * .35; const r = d.r; d.sp.position.set(Math.cos(d.a) * r, d.y, -8.4 + Math.sin(d.a) * r * .7); d.sp.material.opacity = .5 + pulse * .5; }
      beams.forEach((b, k) => { b.rotation.x = Math.sin(t * .7 + k) * .55; b.rotation.z = Math.cos(t * .5 + k * 1.7) * .55; b.children[0].material.color.setHSL((k / 6 + t * .07) % 1, 1, .55); b.children[0].material.opacity = .07 + pulse * .07; });
      const P = conf.geometry.attributes.position; for (let k = 0; k < N; k++) { let y = P.array[k * 3 + 1] - dt * (.25 + (k % 5) * .06); if (y < 0) y = 5.5; P.array[k * 3 + 1] = y; P.array[k * 3] += Math.sin(t + k) * dt * .05; } P.needsUpdate = true;
      tvAcc += dt; if (tvAcc > .12) { tvAcc = 0; drawTv(t); salleAcc = (salleAcc + 1) % 5; drawSalle(salleAcc, t); }
    });
  }
  const thumbs = new Map(); // les miniatures YouTube déjà chargées
  function thumbOf(id) { if (!thumbs.has(id)) { thumbs.set(id, null); const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => thumbs.set(id, im); im.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; } return thumbs.get(id); }
  function drawSalle(k, t) { // l'écran d'une salle de cinéma quand on n'y est pas (ou pendant que la caméra bouge)
    const S = salleScreens[k]; if (!S) return; const g = S.ctx, v = info?.cine?.[k], th = v && thumbOf(v.videoId);
    g.fillStyle = '#05040a'; g.fillRect(0, 0, 512, 230);
    if (th) { try { g.drawImage(th, 0, -26, 512, 284); } catch (e) {} }
    else { const gr = g.createRadialGradient(256, 115, 10, 256, 115, 300); gr.addColorStop(0, '#2a1840'); gr.addColorStop(1, '#05040a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 230); }
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 186, 512, 44); g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '800 22px Outfit, Inter, sans-serif';
    if (k === NT.LED && !th) for (let b = 0; b < 32; b++) { const hh = 10 + Math.abs(Math.sin(t * 7 + b * .6) * Math.cos(t * 2 + b)) * 120; g.fillStyle = `hsl(${(b * 11 + t * 80) % 360},100%,60%)`; g.fillRect(b * 16 + 2, 180 - hh, 12, hh); }
    g.fillText(v ? (k === NT.LED ? '🎧 ' : '🎬 ') + v.title : k === NT.LED ? '🪩 THE PARADISE NIGHT · Va voir le DJ pour mettre le son !' : `🎬 SALLE ${k + 1} · Choisis un film !`, 256, 214, 490); S.tex.needsUpdate = true;
  }
  // l'image des écrans : la miniature de la vidéo en cours, son titre, et un égaliseur qui danse
  function drawTv(t) {
    const g = tvCtx, v = info?.video; if (!g) return;
    if (v && tvThumbId !== v.videoId) { tvThumbId = v.videoId; tvThumb = null; const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { if (tvThumbId === v.videoId) tvThumb = im; }; im.src = `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`; }
    const gr = g.createLinearGradient(0, 0, 512, 288); gr.addColorStop(0, `hsl(${(t * 30) % 360},80%,18%)`); gr.addColorStop(1, `hsl(${(t * 30 + 140) % 360},80%,10%)`); g.fillStyle = gr; g.fillRect(0, 0, 512, 288);
    if (v && tvThumb) { try { g.globalAlpha = .9; g.drawImage(tvThumb, 0, -36, 512, 384); g.globalAlpha = 1; } catch (e) { tvThumb = null; } }
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 218, 512, 70);
    for (let k = 0; k < 32; k++) { const h = 6 + Math.abs(Math.sin(t * 6 + k * .7) * Math.cos(t * 2.3 + k)) * (v ? 52 : 24); g.fillStyle = `hsl(${(k * 11 + t * 60) % 360},100%,60%)`; g.fillRect(k * 16 + 2, 216 - h, 12, h); }
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '800 26px Outfit, Inter, sans-serif';
    g.fillText(v ? '🎵 ' + v.title : '📺 Mets ta vidéo YouTube sur les écrans !', 256, 248, 490); g.font = '600 18px Outfit, Inter, sans-serif'; g.fillStyle = '#ffd23f'; g.fillText(v ? 'mise par ' + v.by : 'Va voir le DJ (au fond) ou touche 📺', 256, 274, 490);
    tvTex.needsUpdate = true;
  }
  // 📺 la vraie vidéo YouTube, posée pile sur l'écran le plus visible (sinon en petit dans un coin)
  let ytOn = '', muted = false;
  const RADIO = () => (typeof Media !== 'undefined' ? Media : null);
  const screenHere = () => (me.zone === 'cine' ? salleAt(me.x, me.z) : me.zone === 'night' ? NT.LED : me.zone === 'club' ? -1 : null); // l'écran (ou la salle) qui me concerne
  const curVideo = () => { const k = screenHere(); return k == null || (me.zone === 'cine' && k < 0) ? null : k < 0 ? info?.video || null : info?.cine?.[k] || null; };
  function syncVideo() {
    const v = curVideo();
    if (!v || paused) { if (ytOn) { hud.frame.replaceChildren(); hud.frame.classList.add('hidden'); ytOn = ''; } return; }
    const key = v.videoId + v.at + me.zone + screenHere(); if (ytOn === key) return; ytOn = key;
    const start = Math.max(0, Math.floor(((info.serverNow || v.at) - v.at + (info._recv ? Date.now() - info._recv : 0)) / 1000));
    const f = el('iframe', { src: `https://www.youtube-nocookie.com/embed/${v.videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&controls=0&enablejsapi=1&start=${start}&origin=${encodeURIComponent(location.origin)}`, allow: 'autoplay; encrypted-media', title: v.title });
    f.addEventListener('load', () => setTimeout(() => { for (const c of [muted ? 'mute' : 'unMute', 'playVideo']) f.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: c, args: [] }), '*'); }, 600));
    hud.frame.replaceChildren(f, el('div', { class: 'bw-frame-t' }, `🎵 ${v.title} · par ${v.by}`)); hud.frame.classList.remove('hidden');
    try { RADIO()?.audio?.pause(); } catch (e) {}
  }
  function setMute(m) { muted = m; const f = hud.frame?.querySelector('iframe'); f?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: m ? 'mute' : 'unMute', args: [] }), '*'); if (hud.mute) hud.mute.textContent = m ? '🔇' : '🔊'; }
  const _v = () => new THREE.Vector3();
  // la vidéo est « collée » dans l'écran avec la bonne perspective (une transformation qui suit ses 4 coins)
  const FW = 640, FH = 360;
  function homography(P) { // P = les 4 coins à l'écran : haut-gauche, haut-droite, bas-droite, bas-gauche
    const S = [[0, 0], [FW, 0], [FW, FH], [0, FH]], A = [], B = [];
    for (let k = 0; k < 4; k++) { const [u, v] = S[k], [x, y] = P[k]; A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); B.push(x); A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); B.push(y); }
    for (let c = 0; c < 8; c++) { let piv = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r; [A[c], A[piv]] = [A[piv], A[c]]; [B[c], B[piv]] = [B[piv], B[c]]; const d = A[c][c]; if (Math.abs(d) < 1e-9) return null;
      for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / d; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; } }
    const [a, b, c, d, e, f, g, h] = B.map((v, k) => v / A[k][k]);
    return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,1)`;
  }
  let glueTo = null, camPrev = null, camMovedAt = 0;
  function placeFrame() {
    if (!ytOn) return;
    // la caméra bouge-t-elle ? (la vidéo YouTube est toujours un peu en retard sur la 3D : on la cache pendant le mouvement)
    const e = camera.matrixWorld.elements; if (camPrev) { let d = 0; for (let k = 0; k < 16; k++) d += Math.abs(e[k] - camPrev[k]); if (d > .002) camMovedAt = performance.now(); } camPrev = e.slice();
    const still = performance.now() - camMovedAt > 280; const W = innerWidth, H = innerHeight, cands = [];
    const here = screenHere();
    for (const sc of screens) {
      if (here == null || (sc.salle ?? -1) !== here || (me.zone === 'cine' && here < 0)) continue;
      const n = _v().set(0, 0, 1).applyQuaternion(sc.m.getWorldQuaternion(new THREE.Quaternion())), to = _v().subVectors(camera.position, sc.m.getWorldPosition(_v())); if (n.dot(to) <= 0) continue; // on voit l'écran de face
      const pts = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([a, b]) => sc.m.localToWorld(_v().set(a * sc.w / 2, b * sc.h / 2, 0)).project(camera));
      if (!pts.every(p => p.z < 1 && p.z > -1 && Math.abs(p.x) < 2 && Math.abs(p.y) < 2)) continue;
      const px = pts.map(p => [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]), w = Math.max(...px.map(q => q[0])) - Math.min(...px.map(q => q[0]));
      const xs = px.map(q => q[0]), ys = px.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const vis = Math.max(0, Math.min(W, x1) - Math.max(0, x0)) * Math.max(0, Math.min(H, y1) - Math.max(0, y0)) / Math.max(1, (x1 - x0) * (y1 - y0));
      if (vis < .5) continue; // on ne colle la vidéo que sur un écran qu'on voit au moins à moitié
      cands.push({ sc, px, w: w * vis });
    }
    // on reste sur le même écran tant qu'on le voit (sinon la vidéo « saute » d'une TV à l'autre) ; le mur géant d'abord
    let best = cands.find(c => c.sc === glueTo && c.w > 90) || cands.find(c => c.sc === screens[0] && c.w > 140 && me.zone === 'club') || cands.sort((a, b) => b.w - a.w)[0];
    if (best && best.w < 110) best = null;
    const st = hud.frame.style, m = best && (mode === 'walk' || mode === 'seat') ? homography(best.px) : null;
    if (m) { glueTo = best.sc; hud.frame.classList.remove('mini'); hud.frame.classList.add('glued'); hud.frame.classList.toggle('moving', !still); st.left = st.top = '0px'; st.width = FW + 'px'; st.height = FH + 'px'; st.transform = m; }
    else { glueTo = null; hud.frame.classList.add('mini'); hud.frame.classList.remove('glued', 'moving'); st.left = st.top = st.width = st.height = st.transform = ''; }
  }
  function ytPanel() {
    const input = el('input', { class: 'input', placeholder: 'Colle un lien YouTube ou cherche une musique…', maxlength: 120 }), res = el('div', { class: 'bw-ytres' }), err = el('small', { class: 'help' });
    const salle = screenHere() ?? -2;
    if (salle === -2) return toast('📺 Il y a des écrans au casino, dans la boîte de nuit et dans les salles de cinéma');
    if (me.zone === 'cine' && salle < 0) return toast('🎬 Entre dans une salle (à l\'étage) pour choisir son film');
    const go = async () => { err.textContent = '⏳ Recherche…'; res.replaceChildren(); const r = await ack('cs_search', input.value); err.textContent = r.error || (r.results?.length ? '' : 'Aucun résultat');
      res.replaceChildren(...(r.results || []).map(v => el('button', { type: 'button', class: 'bw-ytitem', onclick: async () => { const x = await ack('cs_video', { ...v, salle }); if (x.error) { err.textContent = x.error; return; } hidePanel(); setMute(false); toast(salle === NT.LED ? '🎧 Ton son passe dans la boîte de nuit !' : salle >= 0 ? `🎬 Ton film commence dans la salle ${salle + 1} !` : '📺 Ta vidéo passe sur tous les écrans du club !'); } },
        el('img', { src: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`, alt: '' }), el('span', {}, el('b', {}, v.title), el('small', {}, [v.channel, v.length].filter(Boolean).join(' · ')))))); };
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); }); input.addEventListener('keyup', e => e.stopPropagation());
    const cur = salle >= 0 ? info?.cine?.[salle] : info?.video;
    showPanel(el('h3', {}, salle === NT.LED ? '🎧 Le son de la boîte de nuit' : salle >= 0 ? `🎬 Le film de la salle ${salle + 1}` : '📺 Les écrans du club'), el('p', { class: 'help' }, salle === NT.LED ? 'Mets le son que tu veux (avec son clip sur le mur LED) : tout le monde dans la boîte l\'entend et danse dessus.' : salle >= 0 ? 'Choisis un film, une bande-annonce ou un clip sur YouTube : il passe sur le grand écran de la salle, et tous ceux qui sont dans la salle le regardent ensemble.' : 'Mets la musique ou la vidéo que tu veux : elle passe sur le mur géant et sur toutes les TV, et tout le monde dans le club la voit et l\'entend en même temps.'),
      el('div', { class: 'row', style: 'gap:6px' }, input, el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: go }, '🔎')), err, res,
      cur ? el('button', { type: 'button', class: 'btn btn-sm', style: 'width:100%;margin-top:8px', onclick: () => { socket.emit('cs_video', { stop: true, salle }, () => {}); hidePanel(); } }, '⏹ Arrêter la vidéo') : null);
    setTimeout(() => input.focus(), 50);
  }

  // ---------- 🎬 le cinéma : un grand multiplexe relié au club (hall, escalators électriques, mezzanine, 4 salles) ----------
  // Il est construit à côté du club (x de 45 à 75) : on y passe par la porte « CINÉMA ».
  const CI = { x0: 45, x1: 75, sw: 7.5, up: 5, upX: 58.9, dnX: 61.1, mid: 60, c: k => 45 + 7.5 * k + 3.75, rowZ: r => -26 + r * 1.1, rowH: r => .1 + r * .32 /* les gradins : chaque rangée un peu plus haute */, seatX: (k, i) => 45 + 7.5 * k + 1.5 + i * .57 };
  const salleAt = (x, z) => (me.zone === 'cine' && z < -15.2 && x > CI.x0 && x < CI.x1 ? Math.min(3, Math.floor((x - CI.x0) / CI.sw)) : -1);
  const cineBoxes = [[], []]; // les obstacles du rez-de-chaussée et de l'étage
  const cineRects = [[[45.4, -9.6, 74.6, 14.6]], [[45.4, -14.7, 74.6, -10.3]]]; // où l'on peut marcher à chaque étage
  for (let k = 0; k < 4; k++) { const c = CI.c(k), x0 = CI.x0 + k * CI.sw; cineRects[1].push([c - .55, -15.7, c + .55, -14.3], [x0 + .45, -32.4, x0 + CI.sw - .45, -15.4]); for (let r = 0; r < 6; r++) cineBoxes[1].push([x0 + 1.15, CI.rowZ(r) - .32, x0 + 6.4, CI.rowZ(r) + .36]); }
  cineBoxes[0].push([57.9, -10.5, 62.1, -.15], [46, 4.2, 53, 5.3], [67, 4.2, 74, 5.3]); // les escalators, la caisse, le comptoir à popcorn
  function cineFits(x, z) { const L = me.lvl ? 1 : 0; return cineRects[L].some(([a, b, c, d]) => x >= a && x <= c && z >= b && z <= d) && !cineBoxes[L].some(([a, b, c, d]) => x > a - RAD && x < c + RAD && z > b - RAD && z < d + RAD); }
  function goCine(inside) { goZone(inside ? 'cine' : 'hallFromCine'); }
  const POSTERS = [['NUIT NÉON', '🌃', '#ff2bd6', '#1a0430'], ['LES ROIS DU PARADISE', '👑', '#ffd23f', '#2a1400'], ['OPÉRATION SOLDAT 76', '🎖️', '#2bff88', '#04210f'], ['LA VILLE ENDORMIE', '🌙', '#38e8ff', '#041826'],
    ['BOWLING STORY', '🎳', '#ff8a3d', '#2a0c00'], ['LE DERNIER JACKPOT', '🎰', '#ffd23f', '#200018'], ['CŒUR DE PIXEL', '💖', '#ff5fa2', '#22041a'], ['MISSION LASER', '🔫', '#9b5cff', '#0c0424']];
  function posterTex(i) {
    const [t, e, col, bg] = POSTERS[i % POSTERS.length], [c, g] = cnv(256, 380);
    const gr = g.createLinearGradient(0, 0, 0, 380); gr.addColorStop(0, bg); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 256, 380);
    g.globalAlpha = .25; g.fillStyle = col; for (let k = 0; k < 12; k++) { g.beginPath(); g.arc(Math.random() * 256, Math.random() * 250, 10 + Math.random() * 40, 0, 7); g.fill(); } g.globalAlpha = 1;
    g.font = '120px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 128, 150);
    g.fillStyle = col; g.font = '900 26px Outfit, Inter, sans-serif'; g.shadowColor = col; g.shadowBlur = 12; g.fillText(t, 128, 285, 236); g.shadowBlur = 0;
    g.fillStyle = '#fff'; g.font = '700 14px Outfit, Inter, sans-serif'; g.fillText('AU PARADISE CINÉ', 128, 320); g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '600 11px Inter, sans-serif'; g.fillText('UN FILM DU PARADISE · BIENTÔT', 128, 350);
    g.strokeStyle = col; g.lineWidth = 6; g.strokeRect(3, 3, 250, 374); return tex(c);
  }
  function poster(i, x, y, z, ry, s = 1) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3 * s, 1.93 * s), new THREE.MeshBasicMaterial({ map: posterTex(i) })); g.add(m); const fr = new THREE.Mesh(new THREE.BoxGeometry(1.4 * s, 2.03 * s, .05), std(0xd4a24a, { metalness: .8, roughness: .3 })); fr.position.z = -.03; g.add(fr); (BG || scene).add(g); return g; }
  const salleScreens = [];
  function buildCinema() {
    const X0 = CI.x0, X1 = CI.x1, W = X1 - X0, MX = CI.mid, wallM = std(0x14102a, { roughness: .8 }), darkM = std(0x0a0814), redM = std(0x5a0c1e, { roughness: .7 });
    const plane = (w, h, m, x, y, z, ry = 0, rx = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx, ry, 0); scene.add(p); return p; };
    const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); scene.add(b); return b; };
    // le hall : sol brillant, murs, plafond haut avec des spots
    const floorT = (() => { const [c, g] = cnv(256, 256); g.fillStyle = '#100c1c'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(212,162,74,.5)'; g.lineWidth = 2; g.strokeRect(1, 1, 254, 254); g.strokeRect(96, 96, 64, 64); return tex(c, [15, 13]); })();
    plane(W, 25, new THREE.MeshPhysicalMaterial({ map: floorT, roughness: .25, clearcoat: .6 }), MX, 0, 2.5, 0, -Math.PI / 2);
    plane(W, 25, basic(0x07050d), MX, 10, 2.5, 0, Math.PI / 2);
    plane(25, 10, wallM, X0, 5, 2.5, Math.PI / 2); plane(25, 10, wallM, X1, 5, 2.5, -Math.PI / 2); plane(W, 10, wallM, MX, 5, 15, Math.PI);
    for (let x = X0 + 2; x < X1; x += 3.5) for (let z = -8; z < 15; z += 3.5) plane(.25, .25, basic(0xfff1d0), x, 9.98, z, 0, Math.PI / 2);
    const exitD = plane(3, 3, std(0x05030a, { emissive: 0x10203a }), MX, 1.5, 14.97, Math.PI);
    plane(3.6, .6, neon('🚪 PARADISE CLUB', '#2bff88', 1024, 90), MX, 3.4, 14.95, Math.PI); void exitD;
    plane(14, 2.2, neon('🎬 PARADISE CINÉ', '#ff2bd6'), MX, 7.4, 14.94, Math.PI);
    // la caisse et le comptoir à popcorn (avec leurs vendeurs)
    for (const [x0, x1, label, col, emo] of [[46, 53, '🎟️ BILLETTERIE', '#38e8ff', 0x0c2a3a], [67, 74, '🍿 POPCORN · BOISSONS', '#ffd23f', 0x3a2a04]]) {
      box(x1 - x0, 1.1, 1.1, std(0x1a1024, { emissive: emo, roughness: .4 }), (x0 + x1) / 2, .55, 4.75);
      box(x1 - x0 + .1, .06, 1.2, std(0xd4a24a, { metalness: .8, roughness: .25 }), (x0 + x1) / 2, 1.13, 4.75);
      box(x1 - x0, .04, .02, basic(new THREE.Color(col).getHex()), (x0 + x1) / 2, .2, 5.31);
      plane(5.5, 1, neon(label, col, 1024, 96), (x0 + x1) / 2, 3.2, 3.6);
      const src = (x0 < 60 ? K.people.women : K.people.men)[2 % (x0 < 60 ? K.people.women : K.people.men).length], h = K.makeHuman(src, src.k * 1.74 / 43); h.g.position.set((x0 + x1) / 2, 0, 3.7); scene.add(h.g); anims.push(dt => h.mixer.update(dt));
    }
    // la machine à popcorn : une vitrine avec du popcorn qui saute
    const vit = box(1, 1, .7, new THREE.MeshPhysicalMaterial({ color: 0xfff0c0, transparent: true, opacity: .25, roughness: .05 }), 72.6, 1.7, 4.6); void vit;
    const pops = []; for (let k = 0; k < 40; k++) { const p = new THREE.Mesh(new THREE.IcosahedronGeometry(.035, 0), basic(0xfff2b0)); p.position.set(72.6 + (Math.random() - .5) * .8, 1.3 + Math.random() * .2, 4.6 + (Math.random() - .5) * .5); scene.add(p); pops.push({ p, v: 0 }); }
    anims.push(dt => { for (const o of pops) { if (o.p.position.y <= 1.25 && Math.random() < .02) o.v = 1 + Math.random() * 1.5; o.v -= dt * 6; o.p.position.y = Math.max(1.25, o.p.position.y + o.v * dt); } });
    // les affiches du hall
    for (let k = 0; k < 4; k++) { poster(k, X0 + .06, 2.4, -6 + k * 3.2, Math.PI / 2); poster(k + 4, X1 - .06, 2.4, -6 + k * 3.2, -Math.PI / 2); }
    // le mur du fond (sous la mezzanine) : « à l'affiche »
    plane(W, 5, wallM, MX, 2.5, -10, 0);
    for (let k = 0; k < 6; k++) poster(k + 2, k < 3 ? 47.5 + k * 3 : 64.5 + (k - 3) * 3, 2.3, -9.94, 0);
    plane(6, .9, neon('⭐ À L\'AFFICHE ⭐', '#ffd23f'), MX, 4.2, -9.9);
    // la mezzanine (l'étage) et sa rambarde en verre lumineuse
    box(W, .3, 5, std(0x1a1430, { roughness: .5 }), MX, 4.85, -12.5);
    plane(W, 5, new THREE.MeshPhysicalMaterial({ map: floorT, roughness: .3 }), MX, 5.01, -12.5, 0, -Math.PI / 2);
    const glassM = new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, transparent: true, opacity: .18, roughness: .05, depthWrite: false });
    for (const [a, b] of [[X0, 57.8], [62.2, X1]]) { plane(b - a, 1.05, glassM, (a + b) / 2, 5.55, -10.02); box(b - a, .05, .08, basic(0x38e8ff), (a + b) / 2, 6.1, -10.02); box(b - a, .04, .04, basic(0xff2bd6), (a + b) / 2, 4.68, -9.98); }
    // le mur des salles, avec une porte, un panneau lumineux et une affiche par salle
    let xa = X0; for (let k = 0; k < 4; k++) { const c = CI.c(k); plane(c - .8 - xa, 5, wallM, (xa + c - .8) / 2, 7.5, -15); xa = c + .8; plane(1.6, 2.6, wallM, c, 8.7, -15); plane(1.6, 2.4, new THREE.MeshBasicMaterial({ color: 0x14020a, transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false }), c, 6.2, -15.3);
      plane(1.7, .4, neon(`SALLE ${k + 1}`, ['#ff2bd6', '#38e8ff', '#ffd23f', '#2bff88'][k], 512, 100), c, 7.75, -14.97); poster(k * 2 + 1, c + 2.1, 6.6, -14.95, 0, .7); }
    plane(X1 - xa, 5, wallM, (xa + X1) / 2, 7.5, -15);
    // les 4 salles : murs sombres, petites lumières, grand écran avec rideaux, rangées de fauteuils rouges
    const seatG = new THREE.BoxGeometry(.5, .12, .48), backG = new THREE.BoxGeometry(.5, .6, .1), armG = new THREE.BoxGeometry(.06, .25, .45);
    const seatM = std(0x9a1028, { roughness: .6 }), N = 4 * 6 * 9;
    const seats = new THREE.InstancedMesh(seatG, seatM, N), backs = new THREE.InstancedMesh(backG, seatM, N), arms = new THREE.InstancedMesh(armG, std(0x1a1a1a), N); const q = new THREE.Object3D(); let n = 0;
    for (let k = 0; k < 4; k++) {
      const x0 = X0 + k * CI.sw, c = CI.c(k);
      plane(CI.sw, 18, redM, c, 5.005, -24, 0, -Math.PI / 2); plane(CI.sw, 18, darkM, c, 9.5, -24, 0, Math.PI / 2);
      plane(18, 4.5, std(0x1c0614, { roughness: .9 }), x0 + .02, 7.25, -24, Math.PI / 2); plane(18, 4.5, std(0x1c0614, { roughness: .9 }), x0 + CI.sw - .02, 7.25, -24, -Math.PI / 2);
      plane(CI.sw, 4.5, darkM, c, 7.25, -33, 0); for (const [a, b] of [[x0, c - .8], [c + .8, x0 + CI.sw]]) plane(b - a, 4.5, darkM, (a + b) / 2, 7.25, -15.05, Math.PI); plane(1.6, 2, darkM, c, 8.5, -15.05, Math.PI);
      for (let z = -31; z < -16; z += 3) for (const x of [x0 + .05, x0 + CI.sw - .05]) { const l = box(.05, .25, .12, basic(0xffb070), x, 6.4, z); void l; }
      // l'écran (sa propre image) et les rideaux
      const [cc, gg] = cnv(512, 230), t = tex(cc), scr = plane(6.4, 2.88, new THREE.MeshBasicMaterial({ map: t, fog: false }), c, 7.65, -32.9);
      salleScreens[k] = { ctx: gg, tex: t }; screens.push({ m: scr, w: 6.4, h: 2.88, salle: k });
      box(6.7, 3.15, .05, basic(0x000000), c, 7.65, -32.97);
      for (const s2 of [-1, 1]) { const cur = box(.5, 4.2, .2, std(0x7a0a1a, { roughness: .9 }), c + s2 * 3.5, 7.25, -32.7); void cur; }
      for (let r = 0; r < 6; r++) { const st = box(5.3, CI.rowH(r), 1.1, std(0x3a0612, { roughness: .9 }), x0 + 3.78, 5 + CI.rowH(r) / 2, CI.rowZ(r) + .1); void st; const led = box(5.3, .02, .02, basic(0xffb070), x0 + 3.78, 5 + CI.rowH(r) + .01, CI.rowZ(r) - .45); void led; }
      for (let r = 0; r < 6; r++) for (let i = 0; i < 9; i++) {
        const x = CI.seatX(k, i), z = CI.rowZ(r);
        const hh = CI.rowH(r); q.position.set(x, 5.42 + hh, z); q.rotation.set(0, 0, 0); q.updateMatrix(); seats.setMatrixAt(n, q.matrix);
        q.position.set(x, 5.75 + hh, z + .25); q.rotation.set(-.12, 0, 0); q.updateMatrix(); backs.setMatrixAt(n, q.matrix);
        q.position.set(x - .285, 5.55 + hh, z); q.rotation.set(0, 0, 0); q.updateMatrix(); arms.setMatrixAt(n, q.matrix); n++;
      }
    }
    scene.add(seats, backs, arms);
    // les escalators électriques (la même pièce que dans l'atrium)
    ESC.filter(e => e.zone === 'cine').forEach(buildEscalator);
    // la porte du cinéma dans le club (mur du sud)
    plane(2, 2.4, std(0x05030a, { emissive: 0x2a0418 }), 4, 1.2, 13.95, Math.PI);
    plane(2.4, .5, neon('🎬 CINÉMA', '#ff2bd6', 512, 100), 4, 2.75, 13.93, Math.PI);
  }
  // les sièges : on prend le plus proche de libre
  function sitDown(k) {
    let best = null, bd = 99;
    for (let r = 0; r < 6; r++) for (let i = 0; i < 9; i++) { const x = CI.seatX(k, i), z = CI.rowZ(r); if ([...avatars.values()].some(a => a.id !== myId() && Math.hypot(a.x - x, a.z - z) < .3)) continue; const d = Math.hypot(x - me.x, z - me.z); if (d < bd) { bd = d; best = { k, r, i, x, z }; } }
    if (!best) return toast('😕 La salle est pleine !');
    me.ride = null; me.lvl = 1; me.seat = best; me.x = best.x; me.z = best.z; me.y = CI.up - .5 + CI.rowH(best.r); me.yaw = 0; mode = 'seat'; hud.joy.classList.add('hidden');
    socket.emit('cs_move', { x: me.x, z: me.z, y: me.y, yaw: me.yaw }); sCard();
    if (!info?.cine?.[k]) setTimeout(() => toast(`🎬 Aucun film dans la salle ${k + 1} : touche « 📺 YouTube » pour en lancer un !`), 400);
  }
  function standUp() {
    const st = me.seat; if (!st) return; me.seat = null; mode = 'walk'; hud.joy.classList.toggle('hidden', !mobile());
    const x0 = CI.x0 + st.k * CI.sw; me.x = st.i < 5 ? x0 + .7 : x0 + CI.sw - .7; me.z = st.z; me.y = CI.up;
    socket.emit('cs_move', { x: me.x, z: me.z, y: me.y, yaw: me.yaw });
  }
  function cineProgram() {
    showPanel(el('h3', {}, '🎟️ À l\'affiche au Paradise Ciné'), el('p', { class: 'help' }, 'Prends l\'escalator ⬆ pour monter aux salles. Dans une salle, assieds-toi et choisis le film (n\'importe quelle vidéo YouTube) : tout le monde dans la salle le voit en même temps.'),
      el('div', { class: 'cs-prog' }, ...[0, 1, 2, 3].map(k => { const v = info?.cine?.[k]; return el('div', { class: 'cs-prog-s' }, el('b', {}, `🎬 Salle ${k + 1}`), el('span', {}, v ? `▶ ${v.title}` : 'Pas encore de film'), v ? el('small', {}, `lancé par ${v.by}`) : null); })));
  }

  // ---------- 🏬 le Paradise Complex : l'atrium (2 étages), la boîte de nuit, le karting, et les escalators partout ----------
  // Chaque zone est à part dans la 3D (on passe de l'une à l'autre par des portes) ; seule celle où l'on est est dessinée.
  const ZG = {}; let BG = null; // les groupes de chaque zone ; BG = le groupe en cours de construction
  const addPlane = (w, h, m, x, y, z, ry = 0, rx = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx, ry, 0); (BG || scene).add(p); return p; };
  const addBox = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); (BG || scene).add(b); return b; };
  const glassMat = () => new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, transparent: true, opacity: .18, roughness: .05, depthWrite: false });
  function npc(list, idx, x, z, yaw, zone, dance = false, y = 0) { // un figurant (vendeur, DJ, videur, danseuse…)
    const L = list === 'f' ? K.people.women : K.people.men, src = L[idx % L.length], h = K.makeHuman(src, src.k * 1.75 / 43);
    h.g.position.set(x, y, z); h.g.rotation.y = yaw; (BG || scene).add(h.g);
    if (dance && h.act.dance) { h.act.idle.stop(); h.act.dance.play(); h.act.dance.time = Math.random() * 3; }
    anims.push(dt => { if (me.zone === zone) h.mixer.update(dt); }); return h;
  }
  // les escalators : un qui monte, un qui descend (cinéma et atrium)
  const ESC = [
    { zone: 'cine', x: 58.9, z0: 0, z1: -10, h: 5, dir: 1 }, { zone: 'cine', x: 61.1, z0: 0, z1: -10, h: 5, dir: -1 },
    { zone: 'hall', x: -81.1, z0: 8, z1: -4, h: 6, dir: 1 }, { zone: 'hall', x: -78.9, z0: 8, z1: -4, h: 6, dir: -1 }];
  function buildEscalator(e) {
    const D = e.z0 - e.z1, ang = Math.atan2(e.h, D), Lc = Math.hypot(e.h, D), zc = (e.z0 + e.z1) / 2, yc = e.h / 2, gm = glassMat();
    const truss = addBox(1.35, .5, Lc, std(0x2a2d36, { metalness: .7, roughness: .35 }), e.x, yc - .3, zc); truss.rotation.x = ang;
    for (const sx of [-.62, .62]) {
      const gl = addBox(.04, .9, Lc, gm, e.x + sx, yc + .5, zc); gl.rotation.x = ang;
      const rail = addBox(.09, .07, Lc + .4, std(0x0a0a0a, { roughness: .4 }), e.x + sx, yc + 1, zc); rail.rotation.x = ang;
      const led = addBox(.03, .03, Lc, basic(e.dir > 0 ? 0x38e8ff : 0xff2bd6), e.x + sx, yc + .08, zc); led.rotation.x = ang;
    }
    addPlane(1.2, .3, neon(e.dir > 0 ? '⬆ MONTÉE' : '⬇ DESCENTE', e.dir > 0 ? '#38e8ff' : '#ff2bd6', 512, 90), e.x, 2.4, e.z0 + .9, Math.PI);
    const NS = Math.round(D * 3), steps = new THREE.InstancedMesh(new THREE.BoxGeometry(1.05, .14, .42), std(0x8a8f99, { metalness: .85, roughness: .3 }), NS), edge = new THREE.InstancedMesh(new THREE.BoxGeometry(1.05, .02, .04), basic(0xffd23f), NS);
    (BG || scene).add(steps, edge); const qq = new THREE.Object3D(); let off = 0;
    anims.push(dt => { if (me.zone !== e.zone) return; off = (off + dt * 1.9 / (D + 1.4) * e.dir + 1) % 1;
      for (let i = 0; i < NS; i++) { const u = (i / NS + off) % 1, z = e.z0 + .7 - u * (D + 1.4), y = Math.max(0, Math.min(1, (e.z0 - z) / D)) * e.h; qq.position.set(e.x, y + .02, z); qq.updateMatrix(); steps.setMatrixAt(i, qq.matrix); qq.position.set(e.x, y + .095, z + .2); qq.updateMatrix(); edge.setMatrixAt(i, qq.matrix); }
      steps.instanceMatrix.needsUpdate = true; edge.instanceMatrix.needsUpdate = true; });
  }
  // aller d'une zone à l'autre
  const SPAWN = {
    hall: { zone: 'hall', x: -80, z: 17.6, y: 0, lvl: 0, yaw: 0 }, hallFromClub: { zone: 'hall', x: -61.6, z: 8, y: 0, lvl: 0, yaw: Math.PI / 2 }, hallFromKart: { zone: 'hall', x: -98.4, z: 8, y: 0, lvl: 0, yaw: -Math.PI / 2 },
    hallFromNight: { zone: 'hall', x: -90, z: -18.3, y: 6, lvl: 1, yaw: Math.PI }, hallFromCine: { zone: 'hall', x: -70, z: -18.3, y: 6, lvl: 1, yaw: Math.PI },
    club: { zone: 'club', x: 0, z: 10.3, y: 0, lvl: 0, yaw: 0 }, cine: { zone: 'cine', x: 60, z: 12.6, y: 0, lvl: 0, yaw: 0 },
    night: { zone: 'night', x: 115, z: 12.6, y: 0, lvl: 0, yaw: 0 }, kart: { zone: 'kart', x: -145, z: 20, y: 0, lvl: 0, yaw: 0 } };
  const WELCOME = { hall: '🏬 Bienvenue au Paradise Complex ! Prends l\'escalator pour la boîte de nuit et le cinéma', club: '🎰 Le casino et les jeux : bar, billards, poker, bowling, laser game…', cine: '🎬 Bienvenue au Paradise Ciné ! Prends l\'escalator pour aller dans les salles', night: '🪩 Bienvenue à The Paradise Night ! Va sur la piste, au bar ou au carré VIP', kart: '🏎️ Bienvenue au Paradise Karting ! Prends un kart au stand pour faire un tour' };
  function goZone(key, quiet) {
    const S = SPAWN[key]; if (!S) return; if (mode === 'kart') leaveKart(true); if (mode === 'seat') { me.seat = null; mode = 'walk'; }
    Object.assign(me, { zone: S.zone, x: S.x, z: S.z, y: S.y, lvl: S.lvl, yaw: S.yaw, ride: null, seat: null }); camYaw = S.yaw;
    for (const k in ZG) ZG[k].visible = k === S.zone;
    hidePanel(); socket.emit('cs_move', { x: me.x, z: me.z, y: me.y, yaw: me.yaw }); syncVideo(); if (!quiet && WELCOME[S.zone]) toast(WELCOME[S.zone]);
  }
  const ZONES = [['hall', '🏬', 'L\'atrium (accueil, boutiques, fontaine)'], ['club', '🎰', 'Casino & jeux (bar, billards, poker, bowling, laser game)'], ['night', '🪩', 'The Paradise Night (la boîte de nuit)'], ['cine', '🎬', 'Paradise Ciné (4 salles)'], ['kart', '🏎️', 'Paradise Karting (circuit)']];
  const zoneOfX = x => (x < -120 ? 'kart' : x < -40 ? 'hall' : x < 30 ? 'club' : x < 90 ? 'cine' : 'night');
  function mapPanel() {
    const cnt = z => [...people.values()].filter(p => zoneOfX(p.x) === z).length;
    showPanel(el('h3', {}, '🗺️ Le plan du Paradise Complex'), el('p', { class: 'help' }, 'Choisis où aller : tu y es tout de suite. (Dans le complexe, des portes et des escalators relient aussi toutes les zones.)'),
      el('div', { class: 'cs-map' }, ...ZONES.map(([k, ic, lbl]) => el('button', { class: 'cs-mapb' + (me.zone === k ? ' on' : ''), onclick: () => goZone(k) }, el('span', { class: 'cs-mapi' }, ic), el('span', {}, el('b', {}, lbl), el('small', {}, me.zone === k ? '📍 Tu es ici' : `${cnt(k)} joueur${cnt(k) > 1 ? 's' : ''}`))))));
  }

  // ---------- 🏬 l'atrium : le grand hall central sur 2 étages ----------
  const HL = { x0: -100, x1: -60, z0: -20, z1: 20, up: 6, H: 14 };
  const hallRects = [[[-99.5, -3.5, -60.5, 19.5]], [[-99.5, -19.5, -60.5, -4.35]]];
  const hallBoxes = [[[-82.1, -4.5, -77.9, 7.85], [-93.4, 6.6, -86.6, 13.4], [-73.2, 1.4, -70.8, 2.6], [-99.5, 17, -97.5, 19.5], [-62.5, 17, -60.5, 19.5], [-99.5, -3.5, -97.6, -1.6], [-62.4, -3.5, -60.5, -1.6]], []];
  function hallFits(x, z) { const L = me.lvl ? 1 : 0; return hallRects[L].some(([a, b, c, d]) => x >= a && x <= c && z >= b && z <= d) && !hallBoxes[L].some(([a, b, c, d]) => x > a - RAD && x < c + RAD && z > b - RAD && z < d + RAD); }
  function marbleTex() { const [c, g] = cnv(512, 512); g.fillStyle = '#e9e4dc'; g.fillRect(0, 0, 512, 512); for (let k = 0; k < 60; k++) { g.strokeStyle = `rgba(${120 + Math.random() * 60 | 0},${110 + Math.random() * 50 | 0},${100 + Math.random() * 40 | 0},${.15 + Math.random() * .2})`; g.lineWidth = .5 + Math.random() * 2; g.beginPath(); let x = Math.random() * 512, y = Math.random() * 512; g.moveTo(x, y); for (let i = 0; i < 8; i++) { x += (Math.random() - .5) * 120; y += (Math.random() - .5) * 120; g.lineTo(x, y); } g.stroke(); } g.strokeStyle = 'rgba(180,140,60,.6)'; g.lineWidth = 3; g.strokeRect(0, 0, 512, 512); return tex(c, [10, 10]); }
  function shopFront(x, y, z, w, ry, name, col, inside) { // une vitrine de boutique avec son enseigne lumineuse
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; (BG || scene).add(g);
    const [c, gg] = cnv(256, 128); const gr = gg.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, inside); gr.addColorStop(1, '#0a0a12'); gg.fillStyle = gr; gg.fillRect(0, 0, 256, 128);
    for (let k = 0; k < 10; k++) { gg.fillStyle = `hsla(${Math.random() * 360},70%,60%,.8)`; gg.fillRect(10 + k * 24, 70 + Math.random() * 20, 16, 30); } gg.fillStyle = 'rgba(255,255,255,.12)'; gg.fillRect(0, 0, 256, 6);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w - .4, 3.2), new THREE.MeshBasicMaterial({ map: tex(c) })); win.position.set(0, 1.9, .02); g.add(win);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, .25, .2), std(0x1a1a1a, { metalness: .6 })); frame.position.set(0, 3.65, .05); g.add(frame);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w - .6, .9), neon(name, col, 1024, 100)); sign.position.set(0, 4.35, .1); g.add(sign);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.6), new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, transparent: true, opacity: .25, roughness: .05 })); door.position.set(0, 1.3, .06); g.add(door);
  }
  function palm(x, z, s = 1, y = 0) {
    const trunk = addBox(.25 * s, 3.2 * s, .25 * s, std(0x6b4a2a, { roughness: .9 }), x, y + 1.6 * s, z); void trunk;
    for (let k = 0; k < 7; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(.18 * s, 2.2 * s, 5), std(0x1f8a3a, { roughness: .8 })); l.position.set(x + Math.cos(k) * .7 * s, y + 3.1 * s, z + Math.sin(k) * .7 * s); l.rotation.set(Math.sin(k) * 1.3, 0, -Math.cos(k) * 1.3); (BG || scene).add(l); }
    const pot = addBox(.9 * s, .6 * s, .9 * s, std(0xd4a24a, { metalness: .7, roughness: .3 }), x, y + .3 * s, z); void pot;
  }
  function buildHall() {
    BG = ZG.hall = new THREE.Group(); scene.add(BG); BG.visible = false;
    const { x0, x1, z0, z1, up, H } = HL, MX = (x0 + x1) / 2, W = x1 - x0, D = z1 - z0, wallM = std(0x1b1626, { roughness: .7, side: THREE.DoubleSide });
    const marble = new THREE.MeshPhysicalMaterial({ map: marbleTex(), roughness: .15, clearcoat: .8, clearcoatRoughness: .1 });
    addPlane(W, D, marble, MX, 0, 0, 0, -Math.PI / 2);
    // la verrière : un plafond de verre avec le ciel étoilé
    const [sc, sg] = cnv(512, 512); sg.fillStyle = '#060818'; sg.fillRect(0, 0, 512, 512); for (let k = 0; k < 500; k++) { sg.fillStyle = `rgba(255,255,255,${Math.random()})`; sg.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5); }
    addPlane(W, D, new THREE.MeshBasicMaterial({ map: tex(sc) }), MX, H, 0, 0, Math.PI / 2);
    for (let x = x0 + 4; x < x1; x += 4) addBox(.15, .15, D, std(0xcfd3da, { metalness: .9, roughness: .2 }), x, H - .1, 0);
    for (let z = z0 + 4; z < z1; z += 4) addBox(W, .15, .15, std(0xcfd3da, { metalness: .9, roughness: .2 }), MX, H - .1, z);
    // les murs
    addPlane(D, H, wallM, x0, H / 2, 0, Math.PI / 2); addPlane(D, H, wallM, x1, H / 2, 0, -Math.PI / 2); addPlane(W, H, wallM, MX, H / 2, z1, Math.PI); addPlane(W, H, wallM, MX, H / 2, z0);
    // la mezzanine (l'étage) : dalle, sol en marbre, rambarde en verre avec une lumière
    addBox(W, .3, 16, std(0x2a2433, { roughness: .5 }), MX, up - .15, -12);
    addPlane(W, 16, marble, MX, up + .01, -12, 0, -Math.PI / 2);
    const gm = glassMat();
    for (const [a, b] of [[x0, -82], [-78, x1]]) { addPlane(b - a, 1.05, gm, (a + b) / 2, up + .55, -4.02); addBox(b - a, .06, .1, std(0xd4a24a, { metalness: .9, roughness: .2 }), (a + b) / 2, up + 1.1, -4.02); addBox(b - a, .04, .04, basic(0x38e8ff), (a + b) / 2, up - .32, -3.96); }
    // le rez-de-chaussée : les boutiques sous la mezzanine
    for (const [x, w, name, col, ins] of [[-94, 8, '👟 SNEAKERS', '#38e8ff', '#103048'], [-86.5, 6, '🎮 GAME ZONE', '#9b5cff', '#1c0c40'], [-74, 6, '☕ CAFÉ', '#ffb070', '#3a2010'], [-66, 8, '🍦 GLACIER', '#ff7ad9', '#3a1030']]) shopFront(x, 0, -4, w, 0, name, col, ins);
    // l'étage : les boutiques et les grandes entrées (boîte de nuit, cinéma)
    for (const [x, w, name, col, ins] of [[-97, 5, '📱 PHONE', '#2bff88', '#0c3020'], [-63, 5, '👕 MODE', '#ffd23f', '#302a08']]) shopFront(x, up, z0, w, 0, name, col, ins);
    // la boîte de nuit : grande porte noire, néon, cordon de velours, videur
    addPlane(6, 4.2, std(0x05030a, { emissive: 0x1a0430 }), -90, up + 2.1, z0 + .02);
    addPlane(8, 1.3, neon('🪩 THE PARADISE NIGHT', '#ff2bd6'), -90, up + 4.9, z0 + .05);
    for (const px of [-94.4, -91.6, -88.4, -85.6]) addBox(.12, 1, .12, std(0xd4a24a, { metalness: .9, roughness: .2 }), px, up + .5, z0 + 1.6);
    for (const cx of [-93, -87]) addBox(2.8, .06, .06, std(0x8a0020, { roughness: .6 }), cx, up + .9, z0 + 1.6); // le cordon de velours (on passe au milieu)
    npc('h', 3, -93.6, z0 + 1.9, 0, 'hall', false, up);
    // le cinéma
    addPlane(6, 4.2, std(0x05030a, { emissive: 0x2a0418 }), -70, up + 2.1, z0 + .02);
    addPlane(8, 1.3, neon('🎬 PARADISE CINÉ', '#ffd23f'), -70, up + 4.9, z0 + .05);
    for (let k = 0; k < 4; k++) poster(k + 1, -76 + (k > 1 ? 10.2 : 0) + (k % 2) * 1.5, up + 2.2, z0 + .05, 0, .7);
    // les portes du rez-de-chaussée : karting (ouest), casino (est), sortie (sud)
    for (const [x, z, ry, txt, col] of [[x0 + .03, 8, Math.PI / 2, '🏎️ KARTING', '#ff8a3d'], [x1 - .03, 8, -Math.PI / 2, '🎰 CASINO & JEUX', '#2bff88'], [MX, z1 - .03, Math.PI, '🚪 SORTIE', '#38e8ff']]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; BG.add(g);
      const d = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), std(0x05030a, { emissive: new THREE.Color(col).multiplyScalar(.04) })); d.position.y = 1.7; g.add(d);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(5, .9), neon(txt, col, 1024, 100)); s.position.set(0, 4, .02); g.add(s);
    }
    addPlane(16, 2.4, neon('✨ PARADISE COMPLEX ✨', '#ff2bd6'), MX, 10.5, z1 - .05, Math.PI);
    // la fontaine : bassin, eau qui brille, jets d'eau
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, .6, 40), std(0xd8d2c8, { roughness: .3 })); basin.position.set(-90, .3, 10); BG.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.8, 40), new THREE.MeshPhysicalMaterial({ color: 0x2a9fd8, transparent: true, opacity: .75, roughness: .05, emissive: 0x0a3050 })); water.rotation.x = -Math.PI / 2; water.position.set(-90, .58, 10); BG.add(water);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(.3, .5, 1.6, 20), std(0xd8d2c8, { roughness: .3 })); col.position.set(-90, 1.1, 10); BG.add(col);
    const NJ = 260, jp = new Float32Array(NJ * 3), jv = new Float32Array(NJ * 3), jg = new THREE.BufferGeometry(); jg.setAttribute('position', new THREE.BufferAttribute(jp, 3));
    const resetDrop = k => { const a = Math.random() * Math.PI * 2, s = .6 + Math.random() * .8; jp[k * 3] = -90; jp[k * 3 + 1] = 1.9; jp[k * 3 + 2] = 10; jv[k * 3] = Math.cos(a) * s; jv[k * 3 + 1] = 3.2 + Math.random() * 1.2; jv[k * 3 + 2] = Math.sin(a) * s; };
    for (let k = 0; k < NJ; k++) { resetDrop(k); jp[k * 3 + 1] = -5; }
    const jets = new THREE.Points(jg, new THREE.PointsMaterial({ color: 0xbfe8ff, size: .08, transparent: true, opacity: .85 })); BG.add(jets);
    let jacc = 0; anims.push(dt => { if (me.zone !== 'hall') return; jacc += dt * 120; while (jacc > 1) { jacc--; const k = Math.random() * NJ | 0; if (jp[k * 3 + 1] < .6) resetDrop(k); } for (let k = 0; k < NJ; k++) { if (jp[k * 3 + 1] < .55) continue; jv[k * 3 + 1] -= 9.8 * dt; jp[k * 3] += jv[k * 3] * dt; jp[k * 3 + 1] += jv[k * 3 + 1] * dt; jp[k * 3 + 2] += jv[k * 3 + 2] * dt; } jg.attributes.position.needsUpdate = true; water.material.emissiveIntensity = .8 + Math.sin(performance.now() / 400) * .2; });
    // palmiers, bancs, le plan du complexe, des suspensions lumineuses
    for (const [x, z] of [[-98.5, 18.2], [-61.5, 18.2], [-98.5, -2.5], [-61.5, -2.5]]) palm(x, z);
    for (const [x, z] of [[-96, -12], [-64, -12]]) palm(x, z, .8, up);
    for (const [x, z, ry] of [[-84.5, 14, 0], [-75.5, 14, 0], [-96, 4, Math.PI / 2], [-64, 4, -Math.PI / 2]]) { const b = addBox(2.2, .45, .6, std(0x3a2a1a, { roughness: .6 }), x, .45, z); b.rotation.y = ry; const l = addBox(2.2, .1, .5, std(0x111111, { metalness: .8 }), x, .2, z); l.rotation.y = ry; hallBoxes[0].push(ry ? [x - .5, z - 1.2, x + .5, z + 1.2] : [x - 1.2, z - .5, x + 1.2, z + .5]); }
    const [dc, dg] = cnv(256, 400); dg.fillStyle = '#0c0a18'; dg.fillRect(0, 0, 256, 400); dg.fillStyle = '#ff2bd6'; dg.font = '900 26px Outfit, Inter, sans-serif'; dg.textAlign = 'center'; dg.fillText('PLAN DU COMPLEXE', 128, 40);
    [['NIVEAU 1', '#ffd23f'], ['🪩 Boîte de nuit', '#fff'], ['🎬 Cinéma', '#fff'], ['NIVEAU 0', '#ffd23f'], ['🎰 Casino & jeux →', '#fff'], ['🏎️ ← Karting', '#fff'], ['⛲ Fontaine', '#fff'], ['🚪 Sortie ↓', '#fff']].forEach(([t, c], i) => { dg.fillStyle = c; dg.font = (c === '#ffd23f' ? '900 22px' : '700 20px') + ' Outfit, Inter, sans-serif'; dg.fillText(t, 128, 90 + i * 38); });
    const tot = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3, .3), [std(0x111111), std(0x111111), std(0x111111), std(0x111111), new THREE.MeshBasicMaterial({ map: tex(dc) }), new THREE.MeshBasicMaterial({ map: tex(dc) })]); tot.position.set(-72, 1.5, 2); BG.add(tot);
    for (let k = 0; k < 10; k++) { const x = x0 + 4 + (k % 5) * 8, z = k < 5 ? 2 : 13; const lamp = new THREE.Mesh(new THREE.SphereGeometry(.35, 16, 12), basic(0xfff1d0)); lamp.position.set(x, 9.5, z); BG.add(lamp); const w = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, 4.4), std(0x888888)); w.position.set(x, 11.8, z); BG.add(w); }
    for (const [x, t, c] of [[-92, 'SOLDES -50%', '#ff3b5c'], [-68, 'NOUVEAU : KARTING', '#ff8a3d']]) { const b = addPlane(4, 6, new THREE.MeshBasicMaterial({ map: (() => { const [c2, g2] = cnv(128, 192); g2.fillStyle = c; g2.fillRect(0, 0, 128, 192); g2.fillStyle = '#fff'; g2.font = '900 18px Outfit, Inter, sans-serif'; g2.textAlign = 'center'; g2.fillText('PARADISE', 64, 40); g2.font = '900 15px Outfit, Inter, sans-serif'; g2.fillText(t, 64, 100, 120); return tex(c2); })(), side: THREE.DoubleSide }), x, 10, 6); void b; }
    ESC.filter(e => e.zone === 'hall').forEach(buildEscalator);
    // des passants qui se promènent
    const path = [[-96, 16], [-66, 16], [-66, 1], [-96, 1]], per = path.reduce((a, p, i) => a + Math.hypot(path[(i + 1) % 4][0] - p[0], path[(i + 1) % 4][1] - p[1]), 0);
    for (let k = 0; k < 5; k++) { const h = npc(k % 2 ? 'f' : 'h', k + 4, -90, 10, 0, 'hall'); h.act.idle.stop(); h.act.walk.play(); let s = k / 5 * per, sp = 1.1 + Math.random() * .3;
      anims.push(dt => { if (me.zone !== 'hall') return; s = (s + dt * sp) % per; let d = s; for (let i = 0; i < 4; i++) { const a = path[i], b = path[(i + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= L) { const u = d / L; h.g.position.set(a[0] + (b[0] - a[0]) * u, 0, a[1] + (b[1] - a[1]) * u); h.g.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); break; } d -= L; } }); }
    BG = null;
  }

  // ---------- 🪩 The Paradise Night : la boîte de nuit ----------
  const NT = { x0: 100, x1: 130, z0: -15, z1: 15, H: 9, LED: 4 };
  const nightBoxes = [[107, -15, 123, -10.6], [125.3, -9, 130, 9], [100, -9, 106.2, 9], [102.2, -12.2, 103.8, -10.6], [126.2, -12.2, 127.8, -10.6]];
  function nightFits(x, z) { return x > 100.5 && x < 129.5 && z > -14.5 && z < 14.5 && !nightBoxes.some(([a, b, c, d]) => x > a - RAD && x < c + RAD && z > b - RAD && z < d + RAD); }
  let strobe = 0;
  function buildNight() {
    BG = ZG.night = new THREE.Group(); scene.add(BG); BG.visible = false;
    const { x0, x1, z0, z1, H } = NT, MX = (x0 + x1) / 2, W = x1 - x0, D = z1 - z0, wallM = std(0x07050c, { roughness: .9 });
    addPlane(W, D, std(0x0a0810, { roughness: .4, metalness: .3 }), MX, 0, 0, 0, -Math.PI / 2);
    addPlane(W, D, basic(0x030206), MX, H, 0, 0, Math.PI / 2);
    addPlane(D, H, wallM, x0, H / 2, 0, Math.PI / 2); addPlane(D, H, wallM, x1, H / 2, 0, -Math.PI / 2); addPlane(W, H, wallM, MX, H / 2, z1, Math.PI); addPlane(W, H, wallM, MX, H / 2, z0);
    const party = [];
    const tubeN = (w, h, d, x, y, z, hue) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue, 1, .6) }); m.userData.hue = hue; party.push(m); return addBox(w, h, d, m, x, y, z); };
    for (const z of [-7, 0, 7]) { tubeN(.05, 8, .05, x0 + .05, 4.5, z, .8); tubeN(.05, 8, .05, x1 - .05, 4.5, z, .55); }
    for (let k = 0; k < 6; k++) tubeN(W, .05, .05, MX, H - .05, z0 + 3 + k * 5, k / 6);
    // la scène du DJ, son mur LED géant (la vidéo YouTube de la boîte), les platines et le DJ
    addBox(16, .8, 4.4, std(0x111118, { metalness: .5, roughness: .4 }), MX, .4, z0 + 2.2);
    tubeN(16, .04, .04, MX, .82, z0 + 4.42, .9);
    const [cc, gg] = cnv(512, 230), t = tex(cc), scr = addPlane(12, 5.4, new THREE.MeshBasicMaterial({ map: t, fog: false }), MX, 4.6, z0 + .06);
    salleScreens[NT.LED] = { ctx: gg, tex: t }; screens.push({ m: scr, w: 12, h: 5.4, salle: NT.LED });
    for (let k = 0; k < 2; k++) tubeN(12.4, .08, .05, MX, k ? 7.35 : 1.85, z0 + .08, .6);
    const desk = addBox(4, 1.1, 1.1, std(0x0a0a10, { metalness: .6, roughness: .3 }), MX, 1.35, z0 + 3.2); void desk;
    addPlane(3.8, .6, neon('🎧 DJ', '#ff2bd6', 512, 110), MX, 1.3, z0 + 3.76);
    for (const x of [MX - 1.1, MX + 1.1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .04, 24), std(0x222222, { metalness: .8 })); p.position.set(x, 1.92, z0 + 3.2); BG.add(p); anims.push(dt => { if (me.zone === 'night') p.rotation.y += dt * 4; }); }
    npc('h', 6, MX, z0 + 2.4, 0, 'night', true, .8);
    for (const x of [MX - 7.2, MX + 7.2]) { addBox(1.6, 2.6, 1.2, std(0x0c0c0c, { roughness: .5 }), x, 2.1, z0 + 1.2); const c1 = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .06, 24), std(0x333333)); c1.rotation.x = Math.PI / 2; c1.position.set(x, 2.5, z0 + 1.81); BG.add(c1); }
    // la piste de danse lumineuse
    const tiles = [], tg = new THREE.PlaneGeometry(.96, .96);
    for (let i = 0; i < 14; i++) for (let j = 0; j < 9; j++) { const m = new THREE.MeshBasicMaterial({ color: 0x220022 }), tl = new THREE.Mesh(tg, m); tl.rotation.x = -Math.PI / 2; tl.position.set(108.5 + i, .012, -9.5 + j); BG.add(tl); tiles.push({ m, i, j }); }
    // les podiums avec les danseuses
    for (const x of [103, 127]) { const pd = new THREE.Mesh(new THREE.CylinderGeometry(.8, .9, 1.2, 24), std(0x1a1a24, { metalness: .6 })); pd.position.set(x, .6, -11.4); BG.add(pd); const ring = new THREE.Mesh(new THREE.TorusGeometry(.85, .03, 6, 32), basic(0xff2bd6)); ring.rotation.x = Math.PI / 2; ring.position.set(x, 1.2, -11.4); BG.add(ring); party.push(ring.material); ring.material.userData.hue = .85; npc('f', x === 103 ? 1 : 3, x, -11.4, 0, 'night', true, 1.2); }
    // le bar (à droite)
    addBox(.9, 1.15, 17, std(0x120a1a, { emissive: 0x1a0420 }), 125.8, .58, 0); addBox(1, .06, 17.2, std(0xd4a24a, { metalness: .9, roughness: .2 }), 125.8, 1.17, 0); tubeN(.03, .04, 17, 125.33, .15, 0, .1);
    for (const y of [1.7, 2.4]) { addBox(.4, .04, 16, std(0x3a2414), 129.7, y, 0); for (let z = -7.6; z < 7.7; z += .38) { const h2 = .25 + Math.random() * .15, cl = [0x39ff8a, 0xff2bd6, 0xffd23f, 0x38e8ff][Math.random() * 4 | 0], b = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, h2, 8), new THREE.MeshPhysicalMaterial({ color: cl, transparent: true, opacity: .85, emissive: cl, emissiveIntensity: .4 })); b.position.set(129.7, y + .02 + h2 / 2, z); BG.add(b); } }
    addPlane(4.4, .9, neon('🍸 BAR', '#38e8ff', 512, 110), x1 - .05, 3.6, 0, -Math.PI / 2);
    npc('f', 5, 127.2, 0, -Math.PI / 2, 'night');
    // le carré VIP (à gauche) : canapés, tables, champagne avec des étincelles
    addBox(6.2, .35, 18, std(0x1a1018, { roughness: .5 }), 103.1, .17, 0); tubeN(.04, .04, 18, 106.2, .36, 0, .13);
    addPlane(3, .7, neon('👑 VIP', '#ffd23f', 512, 110), x0 + .05, 3.4, 0, Math.PI / 2);
    const sparks = [];
    for (const z of [-5, 0, 5]) { const so = addBox(1, .7, 3.4, std(0x4a0a2a, { roughness: .6 }), 101.2, .7, z); void so; const tb = addBox(1, .5, 1, std(0x111111, { metalness: .8, roughness: .2 }), 103.4, .6, z); void tb;
      const bot = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .4, 10), std(0x0a3a1a, { metalness: .4, roughness: .2 })); bot.position.set(103.4, 1.05, z); BG.add(bot);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffe08a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.set(103.4, 1.35, z); sp.scale.setScalar(.25); BG.add(sp); sparks.push(sp); }
    // les lasers et les lyres (faisceaux qui bougent), la fumée
    const lasers = []; for (let k = 0; k < 18; k++) { const L = new THREE.Mesh(new THREE.BoxGeometry(.012, .012, 30), new THREE.MeshBasicMaterial({ color: [0x39ff8a, 0xff2b4a, 0x38e8ff][k % 3], transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false })); L.geometry.translate(0, 0, 15); const piv = new THREE.Group(); piv.position.set(MX + (k % 2 ? 2.5 : -2.5), 7.6, z0 + .5); piv.add(L); BG.add(piv); lasers.push(piv); }
    const heads = []; for (let k = 0; k < 8; k++) { const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 8.5, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(k / 8, 1, .55), transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); cone.geometry.translate(0, -4.25, 0); const piv = new THREE.Group(); piv.position.set(103 + k * 3.4, 8.8, -3); piv.add(cone); BG.add(piv); heads.push(piv); }
    const smokeT = (() => { const [c, g] = cnv(128, 128), r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return tex(c); })();
    const smoke = []; for (let k = 0; k < 14; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeT, color: 0x9a7aff, transparent: true, opacity: .12, depthWrite: false })); s.position.set(104 + Math.random() * 22, .8 + Math.random() * 1.2, -10 + Math.random() * 14); s.scale.setScalar(5 + Math.random() * 4); BG.add(s); smoke.push({ s, v: (Math.random() - .5) * .3 }); }
    for (const [x, z] of [[110, -4], [120, -4]]) { const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(.5, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .05, flatShading: true })); ball.position.set(x, 7.8, z); BG.add(ball); anims.push(dt => { if (me.zone === 'night') ball.rotation.y += dt * .7; }); }
    addPlane(12, 1.8, neon('THE PARADISE NIGHT', '#ff2bd6'), MX, 6.5, z1 - .05, Math.PI);
    addPlane(3, 3.2, std(0x05030a, { emissive: 0x2a0418 }), MX, 1.6, z1 - .03, Math.PI);
    // tout bouge au rythme (128 BPM) ; un flash stroboscopique de temps en temps
    anims.push((dt, tt) => {
      if (me.zone !== 'night') return; const beat = tt * 128 / 60, pulse = Math.pow(1 - (beat % 1), 3), step = Math.floor(beat);
      for (const m of party) m.color.setHSL((m.userData.hue + tt * .06) % 1, 1, .45 + pulse * .2);
      for (const T of tiles) { const v = Math.sin(T.i * .9 + T.j * 1.4 + step * 2.1); T.m.color.setHSL(((T.i * .05 + T.j * .07) + step * .17) % 1, 1, v > 0 ? .3 + pulse * .3 : .05); }
      lasers.forEach((p, k) => { p.rotation.y = Math.sin(tt * .8 + k * .6) * .8 + (k - 9) * .06; p.rotation.x = .12 + Math.sin(tt * 1.3 + k) * .18; p.children[0].material.opacity = (step % 8 < 6) ? .75 : 0; });
      heads.forEach((p, k) => { p.rotation.x = Math.sin(tt * .9 + k) * .6; p.rotation.z = Math.cos(tt * .7 + k * 1.3) * .6; p.children[0].material.color.setHSL((k / 8 + tt * .08) % 1, 1, .55); p.children[0].material.opacity = .06 + pulse * .1; });
      sparks.forEach((s, k) => { s.material.opacity = .5 + Math.random() * .5; s.scale.setScalar(.2 + Math.random() * .2); });
      smoke.forEach(o => { o.s.position.x += o.v * dt; if (o.s.position.x < 103 || o.s.position.x > 127) o.v = -o.v; });
      if (step % 16 === 15 && (beat % 1) < .5) strobe = Math.floor(beat * 8) % 2 ? .9 : 0; else strobe = 0;
    });
    BG = null;
  }

  // ---------- 🏎️ Paradise Karting : un vrai circuit, des karts, le chrono au tour ----------
  const KPTS = [[-158, -40], [-158, 30], [-163, 44], [-180, 50], [-198, 38], [-214, 47], [-234, 42], [-246, 22], [-236, 2], [-246, -22], [-236, -44], [-212, -52], [-196, -38], [-180, -52], [-164, -52]];
  const KW = 5, track = { P: [], T: [], N: [], S: [], L: 0, start: 0 };
  (function makeTrack() { // une courbe douce qui passe par tous les points (Catmull-Rom), découpée en petits morceaux
    const n = KPTS.length, M = 50;
    for (let i = 0; i < n; i++) { const p0 = KPTS[(i - 1 + n) % n], p1 = KPTS[i], p2 = KPTS[(i + 1) % n], p3 = KPTS[(i + 2) % n];
      for (let k = 0; k < M; k++) { const t = k / M, t2 = t * t, t3 = t2 * t; const f = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); track.P.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); } }
    const N = track.P.length; let s = 0;
    for (let i = 0; i < N; i++) { const a = track.P[(i - 1 + N) % N], b = track.P[(i + 1) % N], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; track.T.push([dx / l, dz / l]); track.N.push([-dz / l, dx / l]); track.S.push(s); s += Math.hypot(track.P[(i + 1) % N][0] - track.P[i][0], track.P[(i + 1) % N][1] - track.P[i][1]); }
    track.L = s; let bd = 1e9; track.P.forEach(([x, z], i) => { const d = Math.hypot(x + 158, z); if (d < bd) { bd = d; track.start = i; } });
  })();
  function nearestIdx(x, z, from) { const N = track.P.length; let best = from, bd = 1e9; const span = from == null ? N : 40; const s0 = from == null ? 0 : from - span;
    for (let k = s0; k < s0 + (from == null ? N : span * 2); k++) { const i = ((k % N) + N) % N, d = (track.P[i][0] - x) ** 2 + (track.P[i][1] - z) ** 2; if (d < bd) { bd = d; best = i; } } return best; }
  function atS(s) { const N = track.P.length; s = ((s % track.L) + track.L) % track.L; let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (track.S[m] <= s) lo = m; else hi = m - 1; } return lo; }
  function makeKart(col, number) { // un kart : châssis, pontons, pneus, volant, numéro
    const g = new THREE.Group(), cm = std(col, { metalness: .3, roughness: .35 }), dark = std(0x111111, { roughness: .6 });
    const ch = new THREE.Mesh(new THREE.BoxGeometry(1.1, .12, 1.8), dark); ch.position.y = .16; g.add(ch);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1, .22, .45), cm); nose.position.set(0, .26, -.85); nose.rotation.x = -.25; g.add(nose);
    for (const sx of [-.5, .5]) { const pod = new THREE.Mesh(new THREE.BoxGeometry(.25, .22, .9), cm); pod.position.set(sx, .26, .05); g.add(pod); }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(.45, .4, .35), dark); seat.position.set(0, .4, .35); g.add(seat);
    const bump = new THREE.Mesh(new THREE.BoxGeometry(1.25, .2, .2), cm); bump.position.set(0, .22, .98); g.add(bump);
    const wg = new THREE.CylinderGeometry(.17, .17, .2, 16); wg.rotateZ(Math.PI / 2); const wm = std(0x0a0a0a, { roughness: .9 }); g.wheels = [];
    for (const [x, z, r] of [[-.62, -.62, .15], [.62, -.62, .15], [-.65, .62, .19], [.65, .62, .19]]) { const w = new THREE.Mesh(wg, wm); w.scale.setScalar(r / .17); w.position.set(x, r, z); g.add(w); g.wheels.push(w); }
    const sw = new THREE.Mesh(new THREE.TorusGeometry(.13, .02, 6, 16), dark); sw.position.set(0, .5, -.25); sw.rotation.x = -1; g.add(sw);
    if (number != null) { const [c, gg] = cnv(64, 64); gg.fillStyle = '#fff'; gg.fillRect(0, 0, 64, 64); gg.fillStyle = '#111'; gg.font = '900 40px Inter'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText(String(number), 32, 34); const np = new THREE.Mesh(new THREE.PlaneGeometry(.28, .28), new THREE.MeshBasicMaterial({ map: tex(c) })); np.position.set(0, .4, -1.04); np.rotation.y = Math.PI; g.add(np); }
    return g;
  }
  let gantryLights = [], towerTex = null, towerCtx = null, aiKarts = [];
  function buildKart() {
    BG = ZG.kart = new THREE.Group(); scene.add(BG); BG.visible = false;
    const N = track.P.length;
    // le sol (herbe), le ciel de la ville la nuit
    const grass = (() => { const [c, g] = cnv(256, 256); g.fillStyle = '#16301a'; g.fillRect(0, 0, 256, 256); for (let k = 0; k < 4000; k++) { g.fillStyle = `rgba(${40 + Math.random() * 40 | 0},${90 + Math.random() * 60 | 0},${40 + Math.random() * 30 | 0},.5)`; g.fillRect(Math.random() * 256, Math.random() * 256, 1, 2); } return tex(c, [40, 40]); })();
    addPlane(150, 140, std(0xffffff, { map: grass, roughness: 1 }), -200, -.01, -5, 0, -Math.PI / 2);
    // la piste : asphalte, vibreurs rouges et blancs
    const asph = (() => { const [c, g] = cnv(256, 256); g.fillStyle = '#2a2b2f'; g.fillRect(0, 0, 256, 256); for (let k = 0; k < 9000; k++) { const v = 30 + Math.random() * 50 | 0; g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); } g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(0, 0, 6, 256); g.fillRect(250, 0, 6, 256); return tex(c); })(); asph.wrapS = asph.wrapT = THREE.RepeatWrapping;
    const curbT = (() => { const [c, g] = cnv(16, 64); g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 16, 64); g.fillStyle = '#d42020'; g.fillRect(0, 0, 16, 32); return tex(c); })(); curbT.wrapS = curbT.wrapT = THREE.RepeatWrapping;
    const ribbon = (a, b, y, mat, vScale) => { const pos = [], uv = [], idx = []; for (let i = 0; i <= N; i++) { const k = i % N, [px, pz] = track.P[k], [nx, nz] = track.N[k], v = (i === N ? track.L : track.S[k]) / vScale; pos.push(px + nx * a, y, pz + nz * a, px + nx * b, y, pz + nz * b); uv.push(0, v, 1, v); if (i < N) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.material.side = THREE.DoubleSide; BG.add(m); return m; };
    ribbon(KW, -KW, .02, std(0xffffff, { map: asph, roughness: .85 }), 10);
    ribbon(KW + .9, KW, .03, std(0xffffff, { map: curbT, roughness: .7 }), 2); ribbon(-KW, -KW - .9, .03, std(0xffffff, { map: curbT, roughness: .7 }), 2);
    // la ligne de départ (damier) et le portique avec les 5 feux
    const st = track.start, [sx, sz] = track.P[st], [tx, tz] = track.T[st];
    const chk = (() => { const [c, g] = cnv(128, 32); for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#111'; g.fillRect(i * 8, j * 8, 8, 8); } return tex(c); })();
    const gy = Math.atan2(tx, tz), lg = new THREE.Group(); lg.position.set(sx, .035, sz); lg.rotation.y = gy; BG.add(lg);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(KW * 2, 1.2), new THREE.MeshBasicMaterial({ map: chk })); line.rotation.x = -Math.PI / 2; lg.add(line); const G = new THREE.Group(); G.position.set(sx, 0, sz); G.rotation.y = gy; BG.add(G);
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.3, 5, .3), std(0x222222)); post.position.set(s * (KW + .9), 2.5, 0); G.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(KW * 2 + 2.1, .8, .4), std(0x111111)); beam.position.y = 5; G.add(beam);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, .7), neon('🏁 PARADISE KARTING', '#ff8a3d', 1024, 100)); sign.position.set(0, 5.9, 0); sign.rotation.y = Math.PI; G.add(sign);
    gantryLights = []; for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.CircleGeometry(.22, 16), new THREE.MeshBasicMaterial({ color: 0x220000 })); l.position.set((k - 2) * .7, 5, -.21); l.rotation.y = Math.PI; G.add(l); gantryLights.push(l); }
    // les murs de pneus le long de la piste (sauf la ligne droite des stands, où il y a le muret)
    const tireG = new THREE.CylinderGeometry(.32, .32, .26, 12), cnt = Math.floor(track.L / 1.3) * 2 * 2, tires = new THREE.InstancedMesh(tireG, std(0x151515, { roughness: .9 }), cnt), tireW = new THREE.InstancedMesh(tireG, std(0xe8e8e8, { roughness: .8 }), cnt);
    let ti = 0, wi = 0; const q = new THREE.Object3D();
    for (let s = 0; s < track.L; s += 1.3) { const i = atS(s), [px, pz] = track.P[i], [nx, nz] = track.N[i]; for (const side of [1, -1]) { if (side === -1 && pz > -36 && pz < 34 && px > -161) continue; const ox = px + nx * side * (KW + 1.6), oz = pz + nz * side * (KW + 1.6); for (let h = 0; h < 2; h++) { q.position.set(ox, .13 + h * .26, oz); q.updateMatrix(); if ((Math.floor(s / 1.3) + h) % 4 === 0) tireW.setMatrixAt(wi++, q.matrix); else tires.setMatrixAt(ti++, q.matrix); } } }
    tires.count = ti; tireW.count = wi; BG.add(tires, tireW);
    // le muret des stands avec des banderoles, le paddock, les garages, la tour des chronos
    addBox(.5, 1.1, 68, std(0xcfcfcf, { roughness: .6 }), -152.4, .55, -1);
    const banners = ['PARADISE', 'SOLDAT76 RACING', 'NÉON ENERGY', 'THE PARADISE NIGHT', 'PARADISE CINÉ', 'GO FAST'];
    banners.forEach((b, k) => { const [c, g] = cnv(512, 96); g.fillStyle = ['#ff2bd6', '#111', '#2bff88', '#9b5cff', '#ffd23f', '#d42020'][k]; g.fillRect(0, 0, 512, 96); g.fillStyle = k === 4 || k === 2 ? '#111' : '#fff'; g.font = '900 52px Outfit, Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b, 256, 50, 490); const m = new THREE.MeshBasicMaterial({ map: tex(c) }); addPlane(9, 1.05, m, -152.68, .6, -28 + k * 11, -Math.PI / 2); });
    const pad = addPlane(10, 52, std(0x3a3b40, { roughness: .8 }), -145, .01, 0, 0, -Math.PI / 2); void pad;
    for (let k = 0; k < 3; k++) { const z = -16 + k * 6, g = new THREE.Group(); g.position.set(-140.5, 0, z); BG.add(g); const wall = std(0xe0e0e6, { roughness: .7 });
      for (const [w, h, d, x, y, zz] of [[.2, 3, 5.6, .9, 1.5, 0], [3.6, .2, 5.6, -.8, 3, 0], [3.6, 3, .2, -.8, 1.5, -2.8], [3.6, 3, .2, -.8, 1.5, 2.8]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall); m.position.set(x, y, zz); g.add(m); }
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.4, .5), neon(`STAND ${k + 1}`, '#ff8a3d', 512, 100)); sg.position.set(-2.62, 2.6, 0); sg.rotation.y = -Math.PI / 2; g.add(sg);
      for (const zz of [-1.2, 1.2]) { const kk = makeKart([0xd42020, 0x1c4fd8, 0xffd23f, 0x2bff88, 0xff2bd6, 0xff8a3d][k * 2 + (zz > 0 ? 1 : 0)], k * 2 + (zz > 0 ? 2 : 1)); kk.position.set(-.6, 0, zz); kk.rotation.y = Math.PI / 2; g.add(kk); } }
    const tw = new THREE.Group(); tw.position.set(-143.5, 0, 10); BG.add(tw); const tb = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 3.2), std(0x111118, { metalness: .5 })); tb.position.y = 3; tw.add(tb);
    const [tc, tg] = cnv(256, 420); towerCtx = tg; towerTex = tex(tc); const tfront = new THREE.Mesh(new THREE.PlaneGeometry(3, 4.9), new THREE.MeshBasicMaterial({ map: towerTex })); tfront.position.set(-.61, 3.2, 0); tfront.rotation.y = -Math.PI / 2; tw.add(tfront); drawTower();
    kartBlocks.push([-144.2, 8.3, -142.8, 11.7], [-142.6, -19, -139, 2]);
    // les projecteurs autour du circuit, et la ville tout autour
    for (let s = 0; s < track.L; s += 38) { const i = atS(s), [px, pz] = track.P[i], [nx, nz] = track.N[i], x = px + nx * (KW + 4.5), z = pz + nz * (KW + 4.5);
      addBox(.25, 9, .25, std(0x333333, { metalness: .6 }), x, 4.5, z); const head = addBox(1.4, .4, .6, basic(0xfff8e0), x, 9, z); void head;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(4, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: .06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); cone.position.set(x - nx * 2, 4.5, z - nz * 2); BG.add(cone); }
    const winT = (() => { const [c, g] = cnv(128, 256); g.fillStyle = '#0a0c14'; g.fillRect(0, 0, 128, 256); for (let y = 6; y < 256; y += 12) for (let x = 6; x < 128; x += 12) if (Math.random() < .45) { g.fillStyle = Math.random() < .5 ? '#ffd890' : '#9fd0ff'; g.fillRect(x, y, 6, 7); } return tex(c); })();
    const bm = new THREE.MeshBasicMaterial({ map: winT });
    for (let k = 0; k < 34; k++) { const side = k % 4, f = Math.random(), h = 18 + Math.random() * 40, w = 8 + Math.random() * 10;
      const [x, z] = side === 0 ? [-268 + f * 130, -78] : side === 1 ? [-268 + f * 130, 68] : side === 2 ? [-280, -70 + f * 135] : [-128, -70 + f * 135]; addBox(w, h, w, bm, x, h / 2, z); }
    // 3 karts robots qui tournent en continu (tout le monde les voit au même endroit)
    aiKarts = [[0xd42020, 'Soldat76-Kart', 15.5, 0], [0x1c4fd8, 'Turbo-76', 16.4, .33], [0x2bff88, 'Pixel-Racer', 14.6, .66]].map(([c, name, v, o], k) => {
      const g = makeKart(c, 76 + k); BG.add(g); const drv = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(.45, .5, .3), std(c)); body.position.y = .65; const helmet = new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 12), std(0xffffff, { metalness: .3, roughness: .2 })); helmet.position.y = 1.02; drv.add(body, helmet); drv.position.z = .3; g.add(drv);
      const tag = tagSprite(); tag.set('🤖 ' + name, '#ffd23f'); tag.position.y = 1.6; tag.scale.multiplyScalar(.8); g.add(tag); return { g, v, o }; });
    anims.push(() => { if (me.zone !== 'kart') return; const tt = Date.now() / 1000; for (const a of aiKarts) { const s = (tt * a.v + a.o * track.L) % track.L, i = atS(s), j = (i + 1) % track.P.length, u = (s - track.S[i]) / Math.max(.01, (track.S[j] || track.L) - track.S[i]); const [px, pz] = track.P[i], [qx, qz] = track.P[j], lat = Math.sin(s * .05) * 1.6; const [nx, nz] = track.N[i]; a.g.position.set(px + (qx - px) * u + nx * lat, 0, pz + (qz - pz) * u + nz * lat); const [ttx, ttz] = track.T[i]; a.g.rotation.y = Math.atan2(-ttx, -ttz); a.g.wheels.forEach(w => { w.rotation.x -= .3; }); } });
    BG = null;
  }
  const kartBlocks = [];
  function camInside(x, z) { // la caméra reste dans la pièce où je suis
    const inR = (L, m) => L.some(([a, b, c, d]) => x >= a - m && x <= c + m && z >= b - m && z <= d + m);
    if (me.zone === 'hall') return inR(hallRects[me.lvl ? 1 : 0], .3) || (me.lvl === 0 && x > -99.7 && x < -60.3 && z > -3.7 && z < 19.7);
    if (me.zone === 'cine') return inR(cineRects[me.lvl ? 1 : 0], .3);
    if (me.zone === 'night') return x > 100.2 && x < 129.8 && z > -14.8 && z < 14.8;
    if (me.zone === 'club') return x > -17.8 && x < 17.8 && z > -13.8 && z < 13.8;
    return true;
  }
  function kartFits(x, z) { return x > -151 && x < -139.8 && z > -25 && z < 25 && !kartBlocks.some(([a, b, c, d]) => x > a - RAD && x < c + RAD && z > b - RAD && z < d + RAD); }
  function drawTower() {
    const g = towerCtx; if (!g) return; const B = info?.kart || { here: [], day: [] };
    g.fillStyle = '#05050c'; g.fillRect(0, 0, 256, 420); g.fillStyle = '#ff8a3d'; g.font = '900 24px Outfit, Inter, sans-serif'; g.textAlign = 'center'; g.fillText('🏁 MEILLEURS TOURS', 128, 34);
    g.textAlign = 'left'; g.font = '700 18px Outfit, Inter, sans-serif';
    const L = (B.day || []).slice(0, 10); if (!L.length) { g.fillStyle = '#aaa'; g.fillText('Aucun tour aujourd\'hui', 20, 80); }
    L.forEach((r, i) => { g.fillStyle = i === 0 ? '#ffd23f' : '#fff'; g.fillText(`${i + 1}. ${r.name}`.slice(0, 16), 14, 76 + i * 33); g.textAlign = 'right'; g.fillText(fmtLap(r.ms), 244, 76 + i * 33); g.textAlign = 'left'; });
    towerTex.needsUpdate = true;
  }
  const fmtLap = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;

  // ----- conduire son kart -----
  const kt = { x: 0, z: 0, yaw: 0, v: 0, idx: 0, go: 0, lapStart: 0, half: false, last: 0, best: 0, lap: 0, camX: 0, camZ: 0, engine: null, screech: 0 };
  function takeKart() {
    const i = (track.start - 14 + track.P.length) % track.P.length, [px, pz] = track.P[i], [tx, tz] = track.T[i];
    Object.assign(kt, { x: px - track.N[i][0] * 1.6, z: pz - track.N[i][1] * 1.6, yaw: Math.atan2(-tx, -tz), v: 0, idx: i, go: performance.now() + 3600, lapStart: 0, half: false, camX: px - tx * 6, camZ: pz - tz * 6 });
    mode = 'kart'; hidePanel(); hud.emotes.classList.add('hidden'); hud.joy.classList.toggle('hidden', !mobile()); hud.kart.classList.remove('hidden'); engine(true);
    toast(mobile() ? '🏎️ Joystick : en haut pour accélérer, en bas pour freiner, à gauche/droite pour tourner. Attends le départ aux feux !' : '🏎️ Z / ↑ accélérer · S / ↓ freiner · Q D / ← → tourner. Attends que les feux s\'éteignent !');
  }
  function leaveKart(quiet) { engine(false); mode = 'walk'; hud.kart?.classList.add('hidden'); hud.emotes?.classList.remove('hidden'); me.x = -147; me.z = 0; me.y = 0; me.yaw = Math.PI / 2; camYaw = Math.PI / 2; if (!quiet) socket.emit('cs_move', { x: me.x, z: me.z, y: 0, yaw: me.yaw, k: 0 }); }
  function engine(on) {
    const a = ac(); if (!a) return;
    if (on && !kt.engine) { const o = a.createOscillator(), o2 = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(); o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = .045; o.connect(f); o2.connect(f); f.connect(g).connect(MIX); o.start(); o2.start(); kt.engine = { o, o2, g }; }
    if (!on && kt.engine) { try { kt.engine.o.stop(); kt.engine.o2.stop(); } catch (e) {} kt.engine = null; }
  }
  function driveKart(dt, ts) {
    const now0 = performance.now(), started = now0 >= kt.go;
    // les feux : ils s'allument un par un, puis s'éteignent tous = départ !
    const lit = started ? 0 : Math.min(5, Math.floor((3600 - (kt.go - now0)) / 600) + 1); gantryLights.forEach((l, k) => l.material.color.setHex(k < lit ? 0xff1a1a : 0x220000));
    if (!started && lit !== kt.lit) { kt.lit = lit; if (lit) tone(440, 440, .15, .12); } if (started && kt.lit) { kt.lit = 0; tone(880, 880, .4, .16); }
    let f = 0, s = 0;
    if (keys.has('z') || keys.has('w') || keys.has('ArrowUp')) f += 1; if (keys.has('s') || keys.has('ArrowDown')) f -= 1; if (keys.has('q') || keys.has('a') || keys.has('ArrowLeft')) s -= 1; if (keys.has('d') || keys.has('ArrowRight')) s += 1;
    if (stick.on) { f = Math.abs(stick.y) > .15 ? -stick.y : 0; s = stick.x; }
    if (!started) f = 0;
    if (f > 0) kt.v += 8.5 * f * dt * (1 - kt.v / 22); else if (f < 0) kt.v += (kt.v > 0 ? -18 : -5) * -f * dt;
    kt.v -= kt.v * .25 * dt; if (!f && Math.abs(kt.v) < .2) kt.v = 0; kt.v = Math.max(-5, Math.min(22, kt.v));
    const steer = s * 1.9 * Math.min(1, Math.abs(kt.v) / 5) * (1 - Math.abs(kt.v) / 50) * Math.sign(kt.v || 1); kt.yaw -= steer * dt;
    kt.x += -Math.sin(kt.yaw) * kt.v * dt; kt.z += -Math.cos(kt.yaw) * kt.v * dt;
    // les murs de pneus
    const i = nearestIdx(kt.x, kt.z, kt.idx), [px, pz] = track.P[i], [nx, nz] = track.N[i], lat = (kt.x - px) * nx + (kt.z - pz) * nz, lim = KW + .6;
    if (Math.abs(lat) > lim) { const sg = Math.sign(lat); kt.x = px + nx * sg * lim; kt.z = pz + nz * sg * lim; if (Math.abs(kt.v) > 4) { noise(.15, 300, 1, .25); kt.v *= .55; } }
    kt.screech = Math.abs(s) > .6 && Math.abs(kt.v) > 13 ? Math.min(1, kt.screech + dt * 3) : Math.max(0, kt.screech - dt * 4); if (kt.screech > .5 && Math.random() < .3) noise(.06, 2600, 3, .04 * kt.screech);
    // le chrono : un tour = passer la mi-course puis recroiser la ligne
    const N = track.P.length, rel = (i - track.start + N) % N, prev = (kt.idx - track.start + N) % N;
    if (rel > N * .4 && rel < N * .6) kt.half = true;
    if (prev > N * .9 && rel < N * .1 && kt.v > 0) {
      if (!kt.lapStart) { kt.lapStart = now0; toast('⏱️ Chrono lancé !'); }
      else if (kt.half) { const ms = Math.round(now0 - kt.lapStart); kt.last = ms; kt.lap++; const isBest = !kt.best || ms < kt.best; if (isBest) kt.best = ms; kt.lapStart = now0; sDing();
        ack('kt_lap', ms).then(r => { if (r?.record) { toast(`🏆 Nouveau record du jour : ${fmtLap(ms)} !`); window.LC?.confetti?.(['🏁', '🏆', '🏎️']); } else toast(`🏁 Tour en ${fmtLap(ms)}${isBest ? ' · ton meilleur tour !' : ''}`); }); }
      kt.half = false;
    }
    kt.idx = i;
    for (const w of avatars.get(myId())?.kart?.wheels || []) w.rotation.x -= kt.v * dt / .17;
    if (kt.engine) { const A = ac(); const fr = 55 + Math.abs(kt.v) * 9 + (f > 0 ? 12 : 0); kt.engine.o.frequency.setTargetAtTime(fr, A.currentTime, .05); kt.engine.o2.frequency.setTargetAtTime(fr * .5, A.currentTime, .05); }
    me.x = kt.x; me.z = kt.z; me.yaw = kt.yaw; me.y = 0;
    if (ts - lastSend > 90) { lastSend = ts; socket.emit('cs_move', { x: me.x, z: me.z, y: 0, yaw: me.yaw, k: 1 }); }
    // l'écran : vitesse, tour en cours, dernier tour, meilleur tour
    const txt = `${Math.round(Math.abs(kt.v) * 3.6)}|${kt.lapStart ? fmtLap(Math.round(now0 - kt.lapStart)).slice(0, -2) : '--'}|${kt.last}|${kt.best}|${lit}`;
    if (txt !== kt.hudTxt) { kt.hudTxt = txt; hud.kartSpd.textContent = `${Math.round(Math.abs(kt.v) * 3.6)} km/h`; hud.kartLap.textContent = kt.lapStart ? `⏱️ ${fmtLap(Math.round(now0 - kt.lapStart)).slice(0, -2)}` : started ? '⏱️ Passe la ligne pour lancer le chrono' : `🚦 ${'🔴'.repeat(lit)}${'⚫'.repeat(5 - lit)}`; hud.kartBest.textContent = `Dernier : ${kt.last ? fmtLap(kt.last) : '--'} · Meilleur : ${kt.best ? fmtLap(kt.best) : '--'}`; }
  }
  function kartBoardPanel() {
    const B = info?.kart || { here: [], day: [] }, row = (r, i) => el('div', { class: 'cs-kb' }, el('b', {}, `${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${r.name}`), el('span', {}, fmtLap(r.ms)));
    showPanel(el('h3', {}, '🏁 Le classement du karting'), el('h4', {}, '🌍 Les meilleurs tours du jour'), ...(B.day.length ? B.day.map(row) : [el('p', { class: 'help' }, 'Personne n\'a encore fait de tour aujourd\'hui : à toi !')]),
      el('p', { class: 'help' }, 'Chaque tour bouclé rapporte 2 💰 (10 tours par jour). Battre le record du jour rapporte 15 💰 !'), el('button', { class: 'btn btn-primary', style: 'width:100%', onclick: () => takeKart() }, '🏎️ Prendre un kart'));
  }

  // ---------- 🧍 les personnages ----------
  function avatarFor(id, name, gender, bot) {
    let a = avatars.get(id); if (a) return a;
    const L = gender === 'f' ? K.people.women : K.people.men, src = L[Math.abs(id) % L.length], h = K.makeHuman(src, src.k * 1.76 / 43);
    const tag = tagSprite(); tag.position.y = 2.08; h.g.add(tag);
    a = { ...h, id, name, tag, bot, x: me.x, z: me.z, yaw: 0, tx: 0, tz: 0, tyaw: 0, init: false, bubble: null, bubbleT: 0 }; scene.add(h.g); avatars.set(id, a); return a;
  }
  function say(id, text) { const a = avatars.get(id); if (!a) return; if (!a.bubble) { a.bubble = tagSprite(); a.bubble.position.y = 2.45; a.g.add(a.bubble); } a.bubble.set(text, '#ffd23f'); a.bubble.visible = true; a.bubbleT = 4; }
  // où chacun doit se tenir : à sa place au poker, autour de son billard, ou là où il marche
  function poseOf(id) {
    const P = pk.st; if (P) { const i = P.seats.findIndex(s => s && s.id === id); if (i >= 0) { const [x, z] = seatXZ(i, 1.32); return { x, z, yaw: Math.atan2(x - PK.x, z - PK.z), tag: (P.seats[i].last ? P.seats[i].last + ' · ' : '') + P.seats[i].chips + ' 🪙' }; } }
    for (const [ti, T] of tables.entries()) { const S = T.st; if (!S) continue; const k = S.players.findIndex(p => p.id === id); if (k < 0) continue;
      const P0 = POOLS[ti], shooting = S.status === 'playing' && S.turn === k && !T.anim;
      if (shooting) { const cb = (T.local || S.balls)[0] || PP.HEAD, ang = id === myId() ? T.aim : T.lastAng; let x = cb[0] - Math.cos(ang) * .75, z = cb[1] - Math.sin(ang) * .75; const ex = PP.T.L / 2 + .45, ez = PP.T.W / 2 + .45; if (Math.abs(x) < ex && Math.abs(z) < ez) { const sx = (ex - Math.abs(x)) / Math.abs(Math.cos(ang) || 1e-3), sz = (ez - Math.abs(z)) / Math.abs(Math.sin(ang) || 1e-3), s = Math.min(sx, sz); x -= Math.cos(ang) * s; z -= Math.sin(ang) * s; } return { x: P0.x + x, z: P0.z + z, yaw: Math.atan2(-Math.cos(ang), -Math.sin(ang)), tag: '🎱 À son tour' }; }
      return { x: P0.x + (k ? 1.9 : -1.9), z: P0.z + 1.05, yaw: k ? Math.PI / 2 : -Math.PI / 2, tag: '🎱 ' + (S.status === 'lobby' ? 'attend' : 'regarde') }; }
    return null;
  }
  function syncAvatars(dt) {
    const want = new Set();
    const put = (id, name, gender, bot, base, extra = '') => {
      const a = avatarFor(id, name, gender, bot), p = poseOf(id) || base; want.add(id); if (!p) return;
      a.tx = p.x; a.tz = p.z; a.tyaw = p.yaw; a.ty = p.y || 0; if (p.tag && Math.hypot(a.tx - a.x, a.tz - a.z) > 1.2) a.init = false; /* autour d'une table : on se place directement (sans traverser le billard) */ if (!a.init) { a.x = a.tx; a.z = a.tz; a.yaw = a.tyaw; a.y = a.ty; a.init = true; }
      a.tag.set(`${window.ProxVoice?.speaking(id) ? '🔊 ' : ''}${people.get(id)?.k || (id === myId() && mode === 'kart') ? '🏎️ ' : ''}${name}${extra}${p.tag ? ' · ' + p.tag : ''}`, bot ? '#ffd23f' : id === myId() ? '#2bff88' : '#38e8ff');
    };
    for (const p of people.values()) { if (p.id === myId()) continue; put(p.id, p.name, p.gender, false, { x: p.x, z: p.z, y: p.y || 0, yaw: p.yaw }, (p.drink && drinks[p.drink] ? ' ' + drinks[p.drink].split(' ')[0] : '') + (p.st ? ' · ' + p.st : '')); }
    const mine = people.get(myId()); if (mine) put(myId(), mine.name, mine.gender, false, { x: me.x, z: me.z, y: me.y, yaw: me.yaw }, mine.drink && drinks[mine.drink] ? ' ' + drinks[mine.drink].split(' ')[0] : '');
    // les robots du poker et du billard
    if (pk.st) for (const s of pk.st.seats) if (s && s.bot) put(s.id, s.name, s.id % 2 ? 'f' : 'h', true, null);
    for (const T of tables) if (T.st) for (const p of T.st.players) if (p.bot) put(p.id, p.name, 'h', true, null);
    for (const [id, a] of avatars) if (!want.has(id)) { scene.remove(a.g); avatars.delete(id); }
    for (const a of avatars.values()) {
      const ox = a.x, oz = a.z, k = Math.min(1, dt * (a.id === myId() ? 30 : 8));
      a.x += (a.tx - a.x) * k; a.z += (a.tz - a.z) * k; const d = Math.hypot(a.tx - a.x, a.tz - a.z); if (d > 6) { a.x = a.tx; a.z = a.tz; }
      const sp = Math.hypot(a.x - ox, a.z - oz) / Math.max(dt, 1e-3);
      let da = ((a.tyaw - a.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; a.yaw += da * Math.min(1, dt * 10);
      const inKart = a.id === myId() ? mode === 'kart' : !!people.get(a.id)?.k; // en kart : on s'assoit dedans
      if (inKart && !a.kart) { a.kart = makeKart([0xd42020, 0x1c4fd8, 0xffd23f, 0x2bff88, 0xff2bd6, 0xff8a3d][Math.abs(a.id) % 6], Math.abs(a.id) % 100); scene.add(a.kart); const hm = new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 12), std(0xffffff, { metalness: .3, roughness: .2 })); hm.position.set(0, 1.08, .3); a.kart.add(hm); }
      if (!inKart && a.kart) { scene.remove(a.kart); a.kart = null; }
      if (a.kart) { if (a.id === myId()) { a.x = a.tx; a.z = a.tz; a.yaw = a.tyaw; } a.kart.position.set(a.x, 0, a.z); a.kart.rotation.y = a.yaw; }
      const oy = a.y ?? 0; a.y = oy + ((a.ty || 0) - oy) * Math.min(1, dt * (a.id === myId() ? 30 : 8)); if (Math.abs(a.ty - a.y) > 3) a.y = a.ty; const vy = Math.abs(a.y - oy) / Math.max(dt, 1e-3);
      a.g.position.set(a.x - (a.kart ? Math.sin(a.yaw) * -.3 : 0), a.y - (a.kart ? .62 : 0), a.z - (a.kart ? Math.cos(a.yaw) * -.3 : 0)); a.g.rotation.y = a.yaw + Math.PI;
      a.spd = (a.spd || 0) + (Math.min(sp, 8) - (a.spd || 0)) * Math.min(1, dt * 6); // vitesse lissée
      const cur0 = a.cur === 'dance' ? 'idle' : a.cur, v = a.spd;
      const still = !!a.kart || vy > .3 || (a.id === myId() && (me.ride || me.seat)) || (a.ty > 4.2 && Math.abs(a.ty - 5) > .05); // assis au cinéma (plus bas que le sol de l'étage, ou sur un gradin) // sur l'escalator ou assis : on ne marche pas
      const w = a.dance > 0 ? 'dance' : still ? 'idle' : cur0 === 'run' ? (v > 2.4 ? 'run' : v > .3 ? 'walk' : 'idle') : cur0 === 'walk' ? (v > 3.4 ? 'run' : v > .2 ? 'walk' : 'idle') : (v > 3.4 ? 'run' : v > .5 ? 'walk' : 'idle');
      if (a.dance > 0) a.dance -= dt;
      if (w !== a.cur && a.act[w]) { const n = a.act[w]; n.reset().play(); a.act[a.cur]?.crossFadeTo(n, .25, false); a.cur = w; }
      a.mixer.update(dt);
      a.tag.visible = camera.position.distanceTo(a.g.position) > (mode === 'walk' ? 1.5 : 2.4); // pas d'étiquette géante devant la caméra
      if (a.bubble && a.bubbleT > 0) { a.bubbleT -= dt; if (a.bubbleT <= 0) a.bubble.visible = false; }
      a.g.visible = !(a.id === myId() && (mode === 'seat' || mode === 'poker' || (mode === 'pool' && myTurnPool() && poolView !== 'top')));
    }
  }

  // ---------- 🚪 entrer / sortir ----------
  async function open(opts = {}) {
    const want = opts.zone || (opts.cine ? 'cine' : null);
    if (active) { if (want && me.zone !== want) goZone(want); return; } if (!window.City3D?.kit) return toast('😕 La 3D ne marche pas sur cet appareil');
    active = true; mode = 'walk'; poolT = -1;
    ov = el('div', { class: 'lgame cs' }, el('div', { class: 'lg-load' }, el('div', { class: 'lg-logo' }, '🎰'), el('b', {}, 'On ouvre les portes du Paradise Complex…'))); document.body.append(ov); document.body.classList.add('casino-open');
    try { K = await window.City3D.kit(); THREE = K.THREE; } catch (e) { console.warn(e); toast('😕 La 3D ne marche pas sur cet appareil'); return close(); }
    if (!active) return;
    const d = await ack('cs_enter', {}); if (!active) return; if (d.error) { toast(d.error); return close(); }
    canvas = el('canvas', { class: 'lg-cv' });
    R = new THREE.WebGLRenderer({ canvas, antialias: !mobile(), powerPreference: 'high-performance' }); R.setPixelRatio(Math.min(devicePixelRatio || 1, mobile() ? 1.35 : 1.75));
    R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
    avatars.clear(); people.clear(); build(); applyEnter(d);
    me.x = (Math.random() - .5) * 2; me.z = 10.3; me.yaw = 0; camYaw = 0; Object.assign(me, { y: 0, zone: 'club', lvl: 0, ride: null, seat: null });
    try { document.activeElement?.blur?.(); } catch (e) {}
    ov.replaceChildren(canvas, buildHud()); ytOn = ''; syncVideo(); fit();
    window.ProxVoice?.use('casino', { space: () => (info ? 'cs:' + info.inst : null), me: () => { const a = avatars.get(myId()); return a ? { x: a.x, z: a.z } : { x: me.x, z: me.z }; }, pos: uid => { const a = avatars.get(uid); return a && uid !== myId() ? { x: a.x, z: a.z } : null; }, yaw: () => (mode === 'walk' ? camYaw : camera ? Math.atan2(-(camera.getWorldDirection(new THREE.Vector3()).x), -(camera.getWorldDirection(new THREE.Vector3()).z)) : 0) }); addEventListener('resize', fit); bindInput();
    last = performance.now(); raf = requestAnimationFrame(loop);
    goZone(want || 'hall');
  }
  function applyEnter(d) {
    info = d; info._recv = Date.now(); drinks = d.drinks || {}; people.clear(); for (const p of d.players) people.set(p.id, p);
    d.pool.forEach(s => setPool(s)); pk.hole = d.hole; setPoker(d.poker); if (hud.frame) { ytOn = ''; syncVideo(); }
  }
  function close() {
    active = false; cancelAnimationFrame(raf); removeEventListener('resize', fit); unbindInput();
    ytOn = ''; engine(false); try { R?.dispose(); } catch (e) {} R = null; scene = null; ov?.remove(); ov = null; avatars.clear(); people.clear(); tables.length = 0; pk.meshes = null; pk.st = null;
    document.body.classList.remove('casino-open'); mode = 'walk'; window.ProxVoice?.use('casino', null);
  }
  function leave() { socket.emit('cs_leave'); close(); }
  const fit = () => { if (!R) return; const w = innerWidth, h = innerHeight; R.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  function goTo(what) {
    socket.emit('cs_status', what === 'bowling' ? '🎳 au bowling' : '🔫 au laser game');
    const back = () => { if (!active) return; if (busyElsewhere() || document.querySelector('.modal-back')) return setTimeout(back, 1000); socket.emit('cs_status', ''); };
    if (what === 'bowling') window.Bowling?.panel(); else window.LaserGame?.panel();
    setTimeout(back, 1500);
  }

  // ---------- l'écran (boutons, panneaux) ----------
  function buildHud() {
    hud.top = el('div', { class: 'cs-top' }); hud.act = el('button', { class: 'cs-act hidden', onclick: () => doAct() });
    hud.hint = el('div', { class: 'lg-hint' }, mobile() ? '🕹️ Joystick pour marcher · glisse pour tourner la caméra · le bouton pour interagir' : '⌨️ ZQSD / WASD pour marcher · glisse la souris pour tourner · E pour interagir');
    setTimeout(() => hud.hint?.classList.add('gone'), 8000);
    hud.emotes = el('div', { class: 'cs-emotes' }, ...['👋', '😂', '🔥', '❤️', '💃'].map(e => el('button', { onclick: () => { socket.emit('cs_emote', e); } }, e)));
    hud.pool = el('div', { class: 'cs-pool hidden' }); hud.poolTop = el('div', { class: 'cs-pooltop hidden' }); hud.poker = el('div', { class: 'cs-poker hidden' }); hud.panel = el('div', { class: 'cs-panel hidden' });
    const quit = el('button', { class: 'lg-quit', title: 'Sortir', onclick: () => { if (mode !== 'walk') return backToWalk(); if (confirm('Sortir du Paradise Club ?')) leave(); } }, '✕');
    hud.frame = el('div', { class: 'bw-frame hidden' }); hud.mute = el('button', { class: 'cs-tvb', title: 'Couper / remettre le son de la vidéo', onclick: () => setMute(!muted) }, '🔊');
    hud.zoneBtn = el('button', { class: 'cs-tvb cine', onclick: () => { if (mode !== 'walk') backToWalk(); if (mode === 'walk') mapPanel(); } }, '🗺️ Plan');
    hud.kartSpd = el('b', { class: 'cs-kspd' }); hud.kartLap = el('div', { class: 'cs-klap' }); hud.kartBest = el('small', {});
    hud.kart = el('div', { class: 'cs-kart hidden' }, hud.kartSpd, hud.kartLap, hud.kartBest, el('div', { class: 'cs-krow' }, el('button', { class: 'btn btn-sm', onclick: () => kartBoardPanel() }, '🏁 Classement'), el('button', { class: 'btn btn-sm', onclick: () => backToWalk() }, '🚶 Descendre du kart')));
    const tvBtns = el('div', { class: 'cs-tv' }, hud.zoneBtn, el('button', { class: 'cs-tvb yt', onclick: () => ytPanel() }, '📺 YouTube'), hud.mute);
    const box = el('div', { class: 'lg-hud cs-hud' }, hud.frame, hud.kart, tvBtns, window.ProxVoice ? ProxVoice.button('cs-pv') : null, hud.top, hud.emotes, hud.act, hud.poolTop, hud.pool, hud.poker, hud.panel, hud.hint, quit);
    const knob = el('div', { class: 'joy-knob' }), pad = el('div', { class: 'joy lg-joy cs-joy' + (mobile() ? '' : ' hidden') }, el('i', { class: 'joy-ring' }), knob); hud.joy = pad;
    let id = null;
    const mv = e => { const r = pad.getBoundingClientRect(), Rr = r.width / 2; let dx = e.clientX - (r.left + Rr), dy = e.clientY - (r.top + Rr); const d = Math.hypot(dx, dy), mx = Rr * .62; if (d > mx) { dx *= mx / d; dy *= mx / d; } knob.style.transform = `translate(${dx}px, ${dy}px)`; stick.x = dx / mx; stick.y = dy / mx; };
    pad.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); id = e.pointerId; pad.setPointerCapture?.(id); stick.on = true; mv(e); });
    pad.addEventListener('pointermove', e => { if (e.pointerId === id) mv(e); });
    const up = e => { if (e.pointerId !== id) return; id = null; stick.on = false; stick.x = stick.y = 0; knob.style.transform = ''; }; pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
    box.append(pad);
    return box;
  }
  let nearSpot = null;
  function renderTop() { const n = people.size, k = salleAt(me.x, me.z); hud.top.textContent = me.zone === 'hall' ? `🏬 Paradise Complex · ${me.lvl ? 'Niveau 1' : 'Niveau 0'} · ${n} joueur${n > 1 ? 's' : ''}` : me.zone === 'night' ? '🪩 The Paradise Night' : me.zone === 'kart' ? '🏎️ Paradise Karting' : me.zone === 'cine' ? (k >= 0 ? `🎬 Paradise Ciné · Salle ${k + 1}` : `🎬 Paradise Ciné · ${me.lvl ? 'Étage des salles' : 'Hall'}`) : '🎰 Casino & jeux'; }
  function doAct() { if (mode === 'seat') return standUp(); if (mode === 'kart') return; if (nearSpot && mode === 'walk') { ac(); nearSpot.act(); } }
  function showPanel(...kids) { hud.panel.replaceChildren(el('button', { class: 'cs-x', onclick: () => hidePanel() }, '✕'), ...kids); hud.panel.classList.remove('hidden'); }
  const hidePanel = () => hud.panel?.classList.add('hidden');
  const SNACKS = ['popcorn', 'nachos', 'glace', 'slush', 'soda'];
  function drinkMenu(cine) {
    showPanel(el('h3', {}, cine ? '🍿 Popcorn et boissons' : '🍸 Le bar'), el('p', { class: 'help' }, cine ? 'Prends de quoi grignoter pendant le film (c\'est offert 😉).' : 'Choisis ce que tu veux boire (c\'est offert par la maison 😉). Les autres verront ton verre au-dessus de ta tête.'),
      el('div', { class: 'cs-drinks' }, ...Object.entries(drinks).filter(([k]) => (cine ? SNACKS.includes(k) : !SNACKS.includes(k) || k === 'soda')).map(([k, v]) => el('button', { class: 'btn', onclick: async () => { const r = await ack('cs_drink', k); if (r?.error) return toast(r.error); hidePanel(); sDing(); toast(`${v} servi ! Santé 🥂`); } }, v))));
  }
  function slotGame() {
    const E = ['🍒', '🍋', '⭐', '💎', '7️⃣', '🔔'], reels = [0, 1, 2].map(() => el('span', { class: 'cs-reel' }, '❔')), res = el('p', { class: 'help' }, 'Pour le plaisir : ça ne coûte rien et ça ne rapporte rien, juste pour le frisson !');
    let spinning = false;
    const spin = () => { if (spinning) return; spinning = true; ac(); const out = [0, 1, 2].map(() => E[Math.random() * E.length | 0]);
      reels.forEach((r, i) => { let n = 0; const it = setInterval(() => { r.textContent = E[Math.random() * E.length | 0]; tone(600 + Math.random() * 400, 500, .03, .05); if (++n > 10 + i * 6) { clearInterval(it); r.textContent = out[i]; tone(300, 200, .08, .15); if (i === 2) { spinning = false; const win = out[0] === out[1] && out[1] === out[2], two = out[0] === out[1] || out[1] === out[2] || out[0] === out[2]; res.textContent = win ? `🎉 JACKPOT ! ${out[0]}${out[0]}${out[0]}` : two ? '✨ Presque ! Deux pareils' : '😅 Perdu, retente ta chance !'; if (win) { sDing(); setTimeout(sDing, 300); window.LC?.confetti?.(['🎰', '💰', '✨']); socket.emit('cs_emote', '🎰'); } } } }, 70); }); };
    showPanel(el('h3', {}, '🎰 Machine à sous'), el('div', { class: 'cs-reels' }, ...reels), res, el('button', { class: 'btn btn-primary', style: 'width:100%', onclick: spin }, '🎰 Tirer le levier'));
  }
  function backToWalk() {
    if (mode === 'seat') return standUp();
    if (mode === 'kart') return leaveKart();
    if (mode === 'pool') { const T = tables[poolT]?.st; if (T && T.players.some(p => p.id === myId())) { if (T.status === 'playing' && !confirm('Quitter la partie de billard ? (tu perds la partie)')) return; socket.emit('pl_stand'); } }
    if (mode === 'poker') { if (pk.st && ['preflop', 'flop', 'turn', 'river'].includes(pk.st.phase) && !confirm('Te lever de la table ? (tu abandonnes la main en cours)')) return; socket.emit('pk_stand'); pk.hole = null; }
    uiWalk();
  }
  function uiWalk() {
    mode = 'walk'; poolT = -1; hud.pool.classList.add('hidden'); hud.poolTop.classList.add('hidden'); hud.poker.classList.add('hidden'); hud.emotes.classList.remove('hidden'); hud.joy.classList.toggle('hidden', !mobile());
    // on se replace à côté
    if (me.zone === 'club') for (let k = 0; k < 40 && !fits(me.x, me.z); k++) me.z += .2;
  }

  // ---------- 🎱 le billard ----------
  let poolView = 'aim';
  const myTurnPool = () => { const T = tables[poolT]; const S = T?.st; return !!S && S.status === 'playing' && S.players[S.turn]?.id === myId() && !S.busy && !T.anim && !T.sent; };
  async function poolSit(i) {
    const S = tables[i]?.st; const r = (S && (S.status === 'playing' || S.status === 'ended' || S.players.length >= 2) && !S.players.some(p => p.id === myId())) ? { watch: true } : await ack('pl_sit', i);
    if (r.error) { toast(r.error); r.watch = true; }
    mode = 'pool'; poolT = i; poolView = 'aim'; hud.emotes.classList.add('hidden'); hud.joy.classList.add('hidden'); hud.act.classList.add('hidden'); orb = Math.PI / 2;
    renderPool();
  }
  function setPool(s) {
    const T = tables[s.t]; if (!T) return; const was = T.st; T.st = s; T.sent = false;
    if (T.anim && performance.now() - T.anim.t0 > T.anim.frames.length / 30 * 1000 * .8) { T.anim = null; if (poolView === 'follow') poolView = 'aim'; } // le serveur a fini le coup : on termine l'animation
    if (!T.anim) placeBalls(T, s.balls);
    T.local = null; T.place = s.inHand && s.players[s.turn]?.id === myId();
    if (was && was.turn !== s.turn && s.status === 'playing' && s.players[s.turn]?.id === myId()) { sDing(); if (navigator.vibrate) navigator.vibrate(60); }
    if (s.players[s.turn]?.id === myId() && s.balls[0] && (!was || was.busy !== s.busy || was.turn !== s.turn)) T.aim = bestAimGuess(s);
    if (mode === 'pool' && poolT === s.t) renderPool();
    if (s.status === 'ended' && was?.status !== 'ended' && s.winner === myId()) { window.LC?.confetti?.(['🎱', '🏆', '✨']); }
  }
  function bestAimGuess(s) { const c = s.balls[0]; if (!c) return 0; const g = s.players[s.turn]?.group; let best = null, bd = 9; s.balls.forEach((b, n) => { if (!b || !n) return; if (g && PP.kind(n) !== g && !(n === 8 && !s.balls.some((x, m) => x && PP.kind(m) === g))) return; if (!g && n === 8) return; const d = Math.hypot(b[0] - c[0], b[1] - c[1]); if (d < bd) { bd = d; best = b; } }); return best ? Math.atan2(best[1] - c[1], best[0] - c[0]) : 0; }
  function placeBalls(T, balls) { balls.forEach((b, n) => { const m = T.balls[n]; m.visible = !!b; if (b) { m.position.set(b[0], TH + PP.R, b[1]); } }); }
  function renderPool() {
    const T = tables[poolT], S = T?.st; if (!S) return; const mine = S.players.some(p => p.id === myId()), my = myTurnPool();
    const pl = S.players.map((p, k) => el('div', { class: 'cs-pl' + (S.status === 'playing' && S.turn === k ? ' on' : '') }, el('b', {}, (p.bot ? '🤖 ' : '') + p.name), el('small', {}, p.group ? `${p.group === 'solid' ? '● Pleines' : '◐ Rayées'} · ${p.left} restante${p.left > 1 ? 's' : ''}` : 'Couleur pas encore choisie')));
    hud.poolTop.replaceChildren(el('div', { class: 'cs-pls' }, ...pl, !S.players.length ? el('div', { class: 'cs-pl' }, el('b', {}, 'Table libre')) : null), el('div', { class: 'cs-msg' }, S.msg || (S.status === 'lobby' ? '⏳ En attente d\'un adversaire…' : ''))); hud.poolTop.classList.remove('hidden');
    const kids = [];
    if (mine && S.status === 'lobby' && S.players.length === 1) kids.push(el('button', { class: 'btn btn-primary', onclick: () => socket.emit('pl_bot', poolT) }, '🤖 Jouer contre Soldat76-Billard'));
    if (!mine && S.players.length < 2 && S.status !== 'playing') kids.push(el('button', { class: 'btn btn-primary', onclick: () => poolSit(poolT) }, '🎱 Prendre la place'));
    if (my) {
      if (T.place) kids.push(el('div', { class: 'cs-msg gold' }, '✋ Blanche en main : touche le tapis pour la poser où tu veux, puis vise.'));
      kids.push(el('div', { class: 'cs-aim' },
        el('button', { class: 'btn btn-sm', onclick: () => { T.aim -= .01; } }, '◀'), el('button', { class: 'btn btn-sm', onclick: () => { T.aim += .01; } }, '▶'),
        el('button', { class: 'btn btn-sm' + (poolView === 'top' ? ' btn-primary' : ''), onclick: () => { poolView = poolView === 'top' ? 'aim' : 'top'; renderPool(); } }, '🗺️ Vue de dessus'),
        el('button', { class: 'btn btn-sm' + (T.place ? ' btn-primary' : ''), onclick: () => { if (!S.inHand) return toast('Tu ne peux déplacer la blanche qu\'après une faute de l\'autre'); T.place = !T.place; renderPool(); } }, '✋')));
      hud.aimRow = kids[kids.length - 1]; hud.aimRow.append(...[[-1, '⤵️ Rétro'], [0, '⏺ Normal'], [1, '⤴️ Coulé']].map(([v, l]) => el('button', { class: 'btn btn-sm' + (T.spin === v ? ' btn-primary' : ''), onclick: () => { T.spin = v; renderPool(); } }, l)));
      const pw = el('input', { type: 'range', min: 5, max: 100, value: Math.round(T.power * 100), class: 'cs-power', oninput: e => { T.power = e.target.value / 100; pv.textContent = `💪 Force ${e.target.value} %`; } }), pv = el('small', {}, `💪 Force ${Math.round(T.power * 100)} %`);
      kids.push(el('div', { class: 'cs-pw' }, pv, pw, el('button', { class: 'btn btn-primary cs-shoot', onclick: () => poolShoot() }, '🎱 Tirer !')));
      kids.push(el('p', { class: 'help' }, mobile() ? 'Glisse le doigt sur le tapis pour viser (ou touche une bille), règle la force, puis tire.' : 'Glisse la souris pour viser (ou clique sur une bille), règle la force, puis tire.'));
    } else if (S.status === 'playing') kids.push(el('p', { class: 'help' }, mine ? '⏳ Ce n\'est pas ton tour : regarde bien…' : '👀 Tu regardes la partie. Glisse pour tourner autour de la table.'));
    kids.push(el('button', { class: 'btn btn-sm', onclick: () => backToWalk() }, mine ? '🚪 Quitter la table' : '🚶 Partir'));
    hud.pool.replaceChildren(...kids.filter(Boolean)); hud.pool.classList.remove('hidden');
  }
  function poolShoot() {
    const T = tables[poolT]; if (!myTurnPool()) return; const S = T.st, cb = (T.local || S.balls)[0] || PP.HEAD;
    socket.emit('pl_shoot', { angle: T.aim, power: T.power, spin: T.spin * .8, cue: S.inHand ? cb : undefined });
    T.sent = true; setTimeout(() => { T.sent = false; }, 4000); sCue(.4 + T.power * .6);
  }
  function startShot(d) {
    const T = tables[d.t]; if (!T) return; if (d.from) T.balls[0].position.set(d.from[0], TH + PP.R, d.from[1]);
    T.sent = false; T.anim = { t0: performance.now(), frames: d.frames, events: d.events.slice(), i: 0, by: d.by }; T.lastAng = d.shot.angle;
    if (d.by !== myId()) sCue(nearVol(POOLS[d.t].x, POOLS[d.t].z) * (.4 + d.shot.power * .6));
    if (mode === 'pool' && poolT === d.t) { renderPool(); if (poolView === 'aim' && d.by === myId()) poolView = 'follow'; }
  }
  const _q = () => new THREE.Quaternion(), _ax = () => new THREE.Vector3();
  function animPool(T, ti) {
    const A = T.anim; if (!A) return; const t = (performance.now() - A.t0) / 1000, f = Math.min(A.frames.length - 1, t * 30), k = Math.floor(f), u = f - k, F0 = A.frames[k], F1 = A.frames[Math.min(A.frames.length - 1, k + 1)];
    const vol = nearVol(POOLS[ti].x, POOLS[ti].z);
    while (A.events.length && A.events[0][0] <= t) { const e = A.events.shift(); if (e[1] === 'click') sClick(vol * Math.min(1, e[2] / 2.5)); else if (e[1] === 'rail') sRail(vol * Math.min(1, e[2] / 2)); else if (e[1] === 'pocket') sPocket(vol); }
    F0.forEach((p0, n) => { const m = T.balls[n], p1 = F1[n];
      if (!p0) { m.visible = false; return; }
      if (p0[0] === 99) { const [px, pz] = PP.POCKETS[p0[1]]; m.position.set(px, m.position.y - .02, pz); if (m.position.y < TH - .1) m.visible = false; return; }
      const x = p1 && p1[0] !== 99 ? p0[0] + (p1[0] - p0[0]) * u : p0[0], z = p1 && p1[0] !== 99 ? p0[1] + (p1[1] - p0[1]) * u : p0[1];
      const dx = x - m.position.x, dz = z - m.position.z, d = Math.hypot(dx, dz);
      if (d > 1e-5 && d < .3) { const ax = _ax().set(dz, 0, -dx).normalize(); m.quaternion.premultiply(_q().setFromAxisAngle(ax, d / PP.R)); }
      m.visible = true; m.position.set(x, TH + PP.R, z); });
    if (t > A.frames.length / 30 + .2) { T.anim = null; if (poolView === 'follow') poolView = 'aim'; if (T.st) placeBalls(T, T.st.balls); }
  }
  function drawAim(T, ti) {
    const S = T.st, my = mode === 'pool' && poolT === ti && myTurnPool(), cbArr = (T.local || S?.balls || [])[0];
    T.cue.visible = !!(S && my && cbArr);
    T.line.visible = T.line2.visible = T.ghost.visible = false;
    if (!T.cue.visible) return;
    const ang = my ? T.aim : T.lastAng; T.cue.position.set(cbArr[0], TH + PP.R + .01, cbArr[1]); T.cue.rotation.set(0, -ang, .06);
    T.stick.position.x = -(PP.R + .01) - (.04 + T.power * .22);
    const balls = (T.local || S.balls), L = PP.aimLine(balls, ang); if (!L) return;
    const y = TH + PP.R * .3;
    T.line.geometry.setFromPoints([new THREE.Vector3(cbArr[0], y, cbArr[1]), new THREE.Vector3(L.end[0], y, L.end[1])]); T.line.visible = true;
    T.ghost.position.set(L.end[0], TH + .007, L.end[1]); T.ghost.visible = true;
    if (L.hit) { const b = balls[L.hit]; T.line2.geometry.setFromPoints([new THREE.Vector3(b[0], y, b[1]), new THREE.Vector3(b[0] + L.dir[0] * .45, y, b[1] + L.dir[1] * .45)]); T.line2.visible = true; }
  }

  // ---------- 🃏 le poker ----------
  async function pokerSit() {
    const r = await ack('pk_sit', -1); if (r.error) return toast(r.error);
    mode = 'poker'; hud.emotes.classList.add('hidden'); hud.joy.classList.add('hidden'); hud.act.classList.add('hidden'); sChips(); renderPoker();
  }
  function setPoker(P) {
    const was = pk.st; pk.st = P; if (!pk.meshes) return;
    const M = pk.meshes;
    M.board.forEach((m, k) => { const cd = P.board[k]; m.visible = cd != null; if (cd != null && m.userData.cd !== cd) { m.material.map = cardTex(cd); m.material.needsUpdate = true; m.userData.cd = cd; if (was && was.board.length <= k) sCard(); } });
    P.seats.forEach((s, i) => { const pair = M.holes[i]; pair.forEach((m, k) => { const show = s && s.cards && !s.folded && P.phase !== 'wait', face = s?.shown?.cards?.[k] ?? (s && s.id === myId() && pk.hole?.hand === P.hand ? -2 : -1);
      m.visible = !!show && !(s.id === myId() && mode === 'poker'); const cd = face === -2 ? -1 : face; if (m.userData.cd !== cd) { m.material.map = cardTex(cd); m.material.needsUpdate = true; m.userData.cd = cd; } }); stackChips(M.bets[i], s ? s.bet : 0); });
    stackChips(M.potG, Math.max(0, P.pot - P.seats.reduce((a, s) => a + (s ? s.bet : 0), 0)));
    if (P.dealer >= 0) { const [x, z] = seatXZ(P.dealer, .78); M.btn.position.set(x - PK.x + .12, .8, z - PK.z); M.btn.visible = true; } else M.btn.visible = false;
    if (was && P.seats.some((s, i) => s && was.seats[i] && s.bet > was.seats[i].bet)) sChips();
    const meI = P.seats.findIndex(s => s && s.id === myId());
    if (meI >= 0 && P.toAct === meI && was?.toAct !== meI) { sDing(); if (navigator.vibrate) navigator.vibrate(60); }
    if (P.show && was && !was.show && P.show.winners.some(w => w.id === myId())) window.LC?.confetti?.(['🃏', '💰', '🏆']);
    if (mode === 'poker') renderPoker();
  }
  function renderPoker() {
    const P = pk.st; if (!P) return; const i = P.seats.findIndex(s => s && s.id === myId()); if (i < 0) { if (mode === 'poker') uiWalk(); return; }
    const s = P.seats[i], my = P.toAct === i, toCall = Math.max(0, P.curBet - s.bet);
    const seats = P.seats.map((o, k) => o ? el('div', { class: 'cs-seat' + (P.toAct === k ? ' on' : '') + (o.folded && P.phase !== 'wait' ? ' out' : '') + (k === i ? ' me' : '') },
      el('b', {}, (P.dealer === k ? 'Ⓓ ' : '') + (o.bot ? '🤖 ' : '') + o.name), el('small', {}, `${o.chips} 🪙${o.bet ? ' · mise ' + o.bet : ''}`), o.last ? el('em', {}, o.last) : null,
      o.shown ? el('span', { class: 'cs-mini' }, ...o.shown.cards.map(c => cardHtml(c)), el('small', {}, o.shown.hand)) : null) : null).filter(Boolean);
    const hole = pk.hole && pk.hole.hand === P.hand && P.phase !== 'wait' && !s.folded ? pk.hole.cards : null;
    const kids = [el('div', { class: 'cs-seats' }, ...seats),
      el('div', { class: 'cs-board' }, ...[0, 1, 2, 3, 4].map(k => P.board[k] != null ? cardHtml(P.board[k]) : el('span', { class: 'cs-card empty' })), el('b', { class: 'cs-pot' }, `Pot : ${P.pot} 🪙`)),
      el('div', { class: 'cs-msg' }, P.msg || ''),
      el('div', { class: 'cs-hole' }, ...(hole ? hole.map(c => cardHtml(c, true)) : []), hole ? el('small', {}, handHint(hole, P.board)) : null)];
    if (my) {
      let raise = Math.min(s.chips + s.bet, Math.max(P.curBet + P.minRaise, P.curBet * 2 || 40));
      const minR = Math.min(s.chips + s.bet, P.curBet + P.minRaise), maxR = s.chips + s.bet;
      const lbl = el('b', {}, `Relancer à ${raise}`), rng = el('input', { type: 'range', min: minR, max: maxR, step: 10, value: raise, oninput: e => { raise = +e.target.value; lbl.textContent = raise >= maxR ? 'Tapis !' : `Relancer à ${raise}`; } });
      kids.push(el('div', { class: 'cs-acts' },
        el('button', { class: 'btn', onclick: () => socket.emit('pk_act', { type: 'fold' }) }, '🙅 Se coucher'),
        toCall ? el('button', { class: 'btn btn-primary', onclick: () => socket.emit('pk_act', { type: 'call' }) }, toCall >= s.chips ? `Tapis (${s.chips})` : `Suivre ${toCall}`) : el('button', { class: 'btn btn-primary', onclick: () => socket.emit('pk_act', { type: 'check' }) }, '✋ Parole'),
        s.chips > toCall ? el('div', { class: 'cs-raise' }, lbl, rng, el('div', { class: 'cs-quick' }, el('button', { class: 'btn btn-sm', onclick: () => { raise = Math.max(minR, Math.min(maxR, P.curBet + Math.round(P.pot / 2 / 10) * 10)); rng.value = raise; lbl.textContent = `Relancer à ${raise}`; } }, '½ pot'), el('button', { class: 'btn btn-sm', onclick: () => { raise = Math.max(minR, Math.min(maxR, P.curBet + P.pot)); rng.value = raise; lbl.textContent = `Relancer à ${raise}`; } }, 'Pot'), el('button', { class: 'btn btn-sm', onclick: () => { raise = maxR; rng.value = raise; lbl.textContent = 'Tapis !'; } }, 'Tapis'), el('button', { class: 'btn btn-sm btn-primary', onclick: () => socket.emit('pk_act', { type: 'raise', to: raise }) }, '💰 Relancer'))) : null));
    }
    kids.push(el('div', { class: 'cs-row' }, el('button', { class: 'btn btn-sm', onclick: () => backToWalk() }, '🚪 Se lever'), el('button', { class: 'btn btn-sm', onclick: () => showPanel(el('h3', {}, '🃏 Les mains au poker'), el('ol', { class: 'cs-rules' }, ...['Quinte flush : 5 cartes qui se suivent, même couleur', 'Carré : 4 cartes pareilles', 'Full : un brelan + une paire', 'Couleur : 5 cartes de la même couleur', 'Quinte : 5 cartes qui se suivent', 'Brelan : 3 cartes pareilles', 'Double paire', 'Paire', 'Carte haute'].map(t => el('li', {}, t))), el('p', { class: 'help' }, 'Tu as 2 cartes cachées, il y en a 5 au milieu pour tout le monde. Fais la meilleure main de 5 cartes ! Les jetons sont gratuits (1000 pour commencer, recharge automatique). Gagner un gros pot rapporte quelques 💰 pièces du site.')) }, '❔ Règles')));
    hud.poker.replaceChildren(...kids.filter(Boolean)); hud.poker.classList.remove('hidden');
  }
  function handHint(hole, board) { // le nom de ta main actuelle
    const cs = [...hole, ...board]; if (cs.length < 5) { return hole[0] % 13 === hole[1] % 13 ? '✨ Une paire en main !' : ''; }
    const r = cs.map(c => c % 13), cnt = {}; r.forEach(x => cnt[x] = (cnt[x] || 0) + 1); const n = Object.values(cnt).sort((a, b) => b - a);
    const suits = {}; cs.forEach(c => suits[Math.floor(c / 13)] = (suits[Math.floor(c / 13)] || 0) + 1); const fl = Object.values(suits).some(v => v >= 5);
    const u = [...new Set(r)].sort((a, b) => a - b); if (u.includes(12)) u.unshift(-1); let run = 1, st = false; for (let i = 1; i < u.length; i++) { run = u[i] === u[i - 1] + 1 ? run + 1 : 1; if (run >= 5) st = true; }
    return '👉 ' + (st && fl ? 'Quinte ou couleur !' : n[0] === 4 ? 'Carré !' : n[0] === 3 && n[1] >= 2 ? 'Full !' : fl ? 'Couleur !' : st ? 'Quinte !' : n[0] === 3 ? 'Brelan' : n[0] === 2 && n[1] === 2 ? 'Double paire' : n[0] === 2 ? 'Paire' : 'Carte haute');
  }

  // ---------- les commandes ----------
  let drag = null, orb = Math.PI / 2;
  const ray = () => new THREE.Raycaster();
  const onKey = e => {
    if (!active || paused) return; if (e.target?.closest?.('input, textarea, select') && ov?.contains(e.target)) return; if (document.querySelector('.modal-back')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['z', 'q', 's', 'd', 'w', 'a', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === 'keydown') keys.add(k); else keys.delete(k); }
    if (e.type === 'keydown' && k === 'e') { e.preventDefault(); doAct(); }
    if (e.type === 'keydown' && k === ' ' && mode === 'pool') { e.preventDefault(); poolShoot(); }
    if (e.type === 'keydown' && k === 'Escape' && mode !== 'walk') { e.preventDefault(); e.stopImmediatePropagation(); backToWalk(); }
  };
  function tablePoint(e) { // où l'on touche le tapis du billard (en coordonnées de la table)
    const T = tables[poolT]; if (!T) return null; const r = canvas.getBoundingClientRect(), v = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const rc = ray(); rc.setFromCamera(v, camera); const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TH + PP.R)), p = new THREE.Vector3(); if (!rc.ray.intersectPlane(pl, p)) return null;
    return [p.x - POOLS[poolT].x, p.z - POOLS[poolT].z];
  }
  const onDown = e => { if (e.target !== canvas) return; ac(); drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: 0 }; canvas.setPointerCapture?.(e.pointerId); };
  const onMove = e => {
    if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (mode === 'pool') { const T = tables[poolT]; if (myTurnPool() && !T.place) { if (poolView === 'top') { const p = tablePoint(e), c = (T.local || T.st.balls)[0]; if (p && c) T.aim = Math.atan2(p[1] - c[1], p[0] - c[0]); } else T.aim -= dx * (Math.abs(e.clientY - drag.y0) > 120 ? .0008 : .0035); } else orb -= dx * .006; return; }
    if (mode === 'walk') { camYaw -= dx * .006; camPitch = Math.max(.05, Math.min(.9, camPitch + dy * .004)); }
  };
  const onUp = e => {
    if (!drag || e.pointerId !== drag.id) return; const tap = drag.moved < 10; drag = null;
    if (tap && mode === 'pool' && myTurnPool()) { const T = tables[poolT], p = tablePoint(e); if (!p) return; const S = T.st;
      if (T.place) { const ok = Math.abs(p[0]) < PP.T.L / 2 - PP.R && Math.abs(p[1]) < PP.T.W / 2 - PP.R && S.balls.every((b, n) => !n || !b || Math.hypot(b[0] - p[0], b[1] - p[1]) > PP.R * 2.1); if (!ok) return toast('Pas de place ici'); T.local = S.balls.map((b, n) => n ? b : p); T.balls[0].visible = true; T.balls[0].position.set(p[0], TH + PP.R, p[1]); T.place = false; T.aim = bestAimGuess({ ...S, balls: T.local }); renderPool(); return; }
      const c = (T.local || S.balls)[0]; if (c) T.aim = Math.atan2(p[1] - c[1], p[0] - c[0]); }
  };
  function bindInput() { addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true); canvas.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp); }
  function unbindInput() { removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true); canvas?.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp); keys.clear(); stick.on = false; }

  // ---------- chaque image ----------
  let lastTop = 0, lastHere = '';
  function loop(ts) {
    if (!active || !R) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (ts - last) / 1000); last = ts;
    // pendant le bowling ou le laser game, le club se met en pause
    if (busyElsewhere()) { if (!paused) { paused = true; ov.style.visibility = 'hidden'; keys.clear(); syncVideo(); } return; }
    if (paused) { paused = false; ov.style.visibility = ''; syncVideo(); }
    const t = ts / 1000;
    // l'escalator m'emmène (on ne contrôle rien pendant la montée ou la descente)
    if (me.ride) {
      const R0 = me.ride, e = R0.e, Dz = e.z0 - e.z1, tot = Dz + 1.1; R0.t += dt * 1.9; const u = Math.min(1, R0.t / (tot + .3)), z = R0.dir > 0 ? e.z0 + .5 - u * tot : e.z1 - .6 + u * tot;
      me.z = z; me.y = Math.max(0, Math.min(1, (e.z0 - z) / Dz)) * e.h; me.yaw = R0.dir > 0 ? 0 : Math.PI;
      if (u >= 1) { me.lvl = R0.dir > 0 ? 1 : 0; me.y = me.lvl ? e.h : 0; me.z = R0.dir > 0 ? e.z1 - .75 : e.z0 + .9; me.ride = null;
        if (me.lvl) toast(e.zone === 'cine' ? '🎬 Les salles sont devant toi : entre, assieds-toi et lance un film !' : '🪩 À l\'étage : la boîte de nuit (à gauche) et le cinéma (à droite) !'); }
      if (ts - lastSend > 90) { lastSend = ts; socket.emit('cs_move', { x: me.x, z: me.z, y: me.y, yaw: me.yaw }); }
    }
    if (mode === 'seat' && (keys.size || stick.on)) standUp();
    if (mode === 'kart') driveKart(dt, ts);
    R.toneMappingExposure = me.zone === 'night' ? 1.05 + strobe * 2.5 : me.zone === 'kart' ? 1.15 : 1.05;
    // je change de salle → la bonne vidéo
    const hereNow = me.zone + screenHere(); if (hereNow !== lastHere) { lastHere = hereNow; syncVideo(); }
    // je marche
    if (mode === 'walk' && !me.ride && !document.querySelector('.modal-back')) {
      let f = 0, s = 0;
      if (keys.has('z') || keys.has('w') || keys.has('ArrowUp')) f += 1; if (keys.has('s') || keys.has('ArrowDown')) f -= 1;
      if (keys.has('q') || keys.has('a')) s -= 1; if (keys.has('d')) s += 1; if (keys.has('ArrowLeft')) camYaw += dt * 2.2; if (keys.has('ArrowRight')) camYaw -= dt * 2.2;
      if (stick.on) { f = -stick.y; s = stick.x; }
      const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
      if (len > .08) {
        const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
        const vx = (fx * f + rx * s) * SPEED, vz = (fz * f + rz * s) * SPEED, dx = vx * dt, dz = vz * dt;
        if (fits(me.x + dx, me.z)) me.x += dx; if (fits(me.x, me.z + dz)) me.z += dz; me.yaw = Math.atan2(-vx, -vz);
        // monter / descendre par l'escalator électrique
        for (const e of ESC) { if (e.zone !== me.zone || Math.abs(me.x - e.x) > .6) continue;
          if (e.dir > 0 && !me.lvl && me.z < e.z0 + .75 && me.z > e.z0 - 1 && vz < 0) { me.ride = { e, dir: 1, t: 0 }; me.x = e.x; sCard(); }
          if (e.dir < 0 && me.lvl && me.z > e.z1 - .85 && me.z < e.z1 + 1 && vz > 0) { me.ride = { e, dir: -1, t: 0 }; me.x = e.x; sCard(); } }
      }
      if (ts - lastSend > 90) { lastSend = ts; socket.emit('cs_move', { x: me.x, z: me.z, y: me.y, yaw: me.yaw }); }
      // près d'un endroit spécial ?
      let best = null, bd = 99; for (const sp of spots) { if ((sp.zone || 'club') !== me.zone || (sp.lvl != null && sp.lvl !== me.lvl)) continue; const d = Math.hypot(sp.x - me.x, sp.z - me.z); if (d < sp.r && d < bd) { bd = d; best = sp; } }
      nearSpot = best; if (best) { const lbl = typeof best.label === 'function' ? best.label() : best.label; const txt = `${best.icon} ${lbl}${mobile() ? '' : ' (E)'}`; if (hud.act.textContent !== txt) hud.act.textContent = txt; hud.act.classList.remove('hidden'); } else hud.act.classList.add('hidden');
    } else if (mode === 'seat') { nearSpot = null; const txt = `🚶 Se lever${mobile() ? '' : ' (E)'}`; if (hud.act.textContent !== txt) hud.act.textContent = txt; hud.act.classList.remove('hidden'); }
    else { nearSpot = null; hud.act.classList.add('hidden'); }
    if (ts - lastTop > 1000) { lastTop = ts; renderTop(); }
    // le décor, les billards, les personnages
    for (const a of anims) a(dt, t);
    tables.forEach((T, i) => { animPool(T, i); drawAim(T, i); const top = mode === 'pool' && poolT === i && poolView === 'top' && myTurnPool(); T.topHide.forEach(m => { m.visible = !top; }); });
    syncAvatars(dt);
    // la caméra
    if (mode === 'pool') {
      const T = tables[poolT], P0 = POOLS[poolT], cb = (T.local || T.st?.balls || [])[0];
      if (poolView === 'top' && myTurnPool()) { const asp = camera.aspect, tn = Math.tan(camera.fov * Math.PI / 360), land = asp >= 1, h = land ? Math.max(1.4 / (tn * asp), .85 / tn) : Math.max(1.4 / tn, .85 / (tn * asp)); camera.up.set(land ? 0 : 1, 0, land ? -1 : 0); camera.position.set(P0.x, TH + h, P0.z + .001); camera.lookAt(P0.x, TH, P0.z); camera.up.set(0, 1, 0); }
      else if (myTurnPool() && cb) { const a = T.aim, cx = P0.x + cb[0], cz = P0.z + cb[1]; camera.position.set(cx - Math.cos(a) * 1.0, TH + .62, cz - Math.sin(a) * 1.0); camera.lookAt(cx + Math.cos(a) * .45, TH - .32, cz + Math.sin(a) * .45); }
      else { camera.position.set(P0.x + Math.cos(orb) * 2.6, TH + 1.9, P0.z + Math.sin(orb) * 2.1); camera.lookAt(P0.x, TH, P0.z); }
    } else if (mode === 'poker') {
      const i = pk.st?.seats.findIndex(s => s && s.id === myId()) ?? -1; const [x, z] = seatXZ(Math.max(0, i), 1.25);
      camera.position.set(x, 1.65, z); camera.lookAt(PK.x + (PK.x - x) * .05, .75, PK.z + (PK.z - z) * .05);
    } else if (mode === 'kart') {
      const fx = -Math.sin(kt.yaw), fz = -Math.cos(kt.yaw), k = Math.min(1, dt * 5); kt.camX += (kt.x - fx * 5.4 - kt.camX) * k; kt.camZ += (kt.z - fz * 5.4 - kt.camZ) * k;
      camera.fov = (mobile() ? 64 : 55) + Math.abs(kt.v) * .7; camera.updateProjectionMatrix();
      camera.position.set(kt.camX, 2.3, kt.camZ); camera.lookAt(kt.x + fx * 5, .8, kt.z + fz * 5);
    } else if (mode === 'seat' && me.seat) {
      const c = CI.c(me.seat.k), hh = CI.rowH(me.seat.r); camera.position.set(me.seat.x, CI.up + 1.2 + hh, me.seat.z + .35); camera.lookAt(c + (me.seat.x - c) * .2, CI.up + 2.4, -32.9);
    } else {
      if (camera.fov !== (mobile() ? 64 : 55)) { camera.fov = mobile() ? 64 : 55; camera.updateProjectionMatrix(); }
      // la caméra recule derrière moi, mais jamais à travers un mur
      let D = me.zone === 'cine' ? 3.4 : CAM_D; for (let k = 0; k < 12 && D > .6; k++) { const tx = me.x + Math.sin(camYaw) * D * Math.cos(camPitch), tz = me.z + Math.cos(camYaw) * D * Math.cos(camPitch); if (camInside(tx, tz)) break; D -= .35; }
      const cx = me.x + Math.sin(camYaw) * D * Math.cos(camPitch), cz = me.z + Math.cos(camYaw) * D * Math.cos(camPitch), cy = me.y + 1.5 + D * Math.sin(camPitch);
      camera.position.set(cx, cy, cz); camera.lookAt(me.x, me.y + 1.35, me.z);
    }
    camera.updateMatrixWorld(); placeFrame(); // la position de la caméra de CETTE image (sinon la vidéo a une image de retard)
    R.render(scene, camera);
  }

  // ---------- les messages du serveur ----------
  socket.on('cs_pos', L => { if (!active) return; for (const [id, x, z, yaw, y, k] of L) { if (id === myId()) continue; const p = people.get(id); if (p) { p.x = x; p.z = z; p.yaw = yaw; p.y = y || 0; p.k = k || 0; } } });
  socket.on('cs_join', p => { if (!active) return; people.set(p.id, p); });
  socket.on('cs_left', id => { if (!active) return; people.delete(id); });
  socket.on('cs_player', p => { if (!active) return; const o = people.get(p.id); people.set(p.id, { ...o, ...p, ...(p.id === myId() ? {} : {}) }); });
  socket.on('cs_say', d => { if (active) say(d.id, d.text); });
  socket.on('cs_emote', d => { if (!active) return; say(d.id, d.e); const a = avatars.get(d.id); if (a && d.e === '💃') a.dance = 6; });
  socket.on('kt_board', B => { if (!active || !info) return; info.kart = B; drawTower(); });
  socket.on('cs_cineset', d => { if (!active || !info) return; info.cine = info.cine || []; info.cine[d.salle] = d.video; info.serverNow = d.serverNow; info._recv = Date.now(); syncVideo(); });
  socket.on('cs_videoset', d => { if (!active || !info) return; info.video = d.video; info.serverNow = d.serverNow; info._recv = Date.now(); syncVideo(); });
  socket.on('pl_table', s => { if (active) setPool(s); });
  socket.on('pl_shot', d => { if (active) startShot(d); });
  socket.on('pk_table', P => { if (active) setPoker(P); });
  socket.on('pk_hole', h => { if (!active) return; pk.hole = h; sCard(); if (pk.st) setPoker(pk.st); });
  socket.on('connect', async () => { if (!active) return; const d = await ack('cs_enter', {}); if (d && !d.error && active) applyEnter(d); });
  return { open, active: () => active && !paused, go: { poolSit, pokerSit, drinkMenu, slotGame, goTo, tp: (x, z) => { me.x = x; me.z = z; }, goCine, goZone, takeKart, sitDown, me: () => ({ ...me }) } };
})();
window.Casino = Casino;
