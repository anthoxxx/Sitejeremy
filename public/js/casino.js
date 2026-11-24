// The Paradise — 🎰 Le Paradise Club (côté écran) : un grand complexe en 3D où l'on se promène avec les autres joueurs.
// Dedans : le bar (on commande à boire), l'entrée du Bowling et du Laser Game (on les voit derrière les vitres),
// 2 billards en 3D (billard américain, contre un ami ou un robot) et une table de poker Texas Hold'em, plus des machines à sous.
// Sur ordinateur : ZQSD / WASD / flèches pour marcher, glisser la souris pour tourner la caméra, E pour interagir.
// Sur téléphone : le joystick à gauche, glisser le doigt pour tourner la caméra, le gros bouton pour interagir.
const Casino = (() => {
  const PP = window.PoolPhys, SPEED = 3.6, RAD = .32, CAM_D = 4.2;
  const RN = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R', 'A'], SU = ['♠', '♥', '♦', '♣'];
  const POOLS = [{ x: -5, z: .5 }, { x: -5, z: 6.5 }], PK = { x: 7.5, z: 3.5, rx: 2.0, rz: 1.15 }, TH = .8; // TH = hauteur du tapis du billard
  let baseEnv = null, bgColor = null;
  let LIB2 = null, composer = null, bloom = null; // la lueur des lumières (fête foraine, boîte de nuit)
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
  const fits = (x, z) => me.zone === 'cine' ? cineFits(x, z) : me.zone === 'hall' ? hallFits(x, z) : me.zone === 'night' ? nightFits(x, z) : me.zone === 'kart' ? kartFits(x, z) : me.zone === 'aqua' ? aquaFits(x, z) : me.zone === 'zoo' ? zooFits(x, z) : me.zone === 'fair' ? fairFits(x, z) : x > -17.6 && x < 17.6 && z > -13.5 && z < 13.4 && !boxes.some(([a, b, c, d]) => x > a - RAD && x < c + RAD && z > b - RAD && z < d + RAD);
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
    buildBowling(); buildLaser(); buildBar(); POOLS.forEach((p, i) => buildPool(i, p)); buildPoker(); buildSlots(); buildLounge(); buildParty(); buildCinema(); buildHall(); buildNight(); buildKart(); buildAqua(); buildZoo(); buildFair();
    // les reflets
    const pm = new THREE.PMREMGenerator(R), env = new THREE.Scene(); env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: 0x24121e, side: THREE.BackSide })));
    for (const [x, y, z, c] of [[3, 4, 2, 0xff2bd6], [-3, 4, 6, 0x38e8ff], [0, 6, -4, 0xfff0d0], [0, -3, 0, 0x301018]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), new THREE.MeshBasicMaterial({ color: c })); s.position.set(x, y, z); env.add(s); }
    scene.environment = baseEnv = pm.fromScene(env, .04).texture;
    camera = new THREE.PerspectiveCamera(mobile() ? 64 : 55, 1, .03, 80);
    spots = [
      { x: 0, z: 12.6, r: 1.6, icon: '🏬', label: 'Retour à l\'atrium', act: () => goZone('hallFromClub') },
      { zone: 'hall', lvl: 0, x: -80, z: 19, r: 1.8, icon: '🚪', label: 'Quitter le Paradise Complex', act: () => { if (confirm('Quitter le Paradise Complex ?')) leave(); } },
      { zone: 'hall', lvl: 0, x: -99, z: 8, r: 2, icon: '🏎️', label: 'Aller au karting', act: () => goZone('kart') },
      { zone: 'hall', lvl: 0, x: -61, z: 8, r: 2, icon: '🎰', label: 'Aller au casino & jeux', act: () => goZone('club') },
      { zone: 'hall', lvl: 0, x: -92, z: 19, r: 1.9, icon: '🎡', label: 'Aller à la fête foraine', act: () => goZone('fair') },
      { zone: 'fair', x: 370, z: 38.3, r: 1.8, icon: '🏬', label: 'Retour à l\'atrium', act: () => goZone('hallFromFair') },
      { zone: 'fair', x: 348, z: -16.6, r: 2.6, icon: '🎡', label: 'Monter dans la grande roue', act: () => boardRide('wheel') },
      { zone: 'fair', x: 357.4, z: 18, r: 2.4, icon: '🎠', label: 'Monter sur le carrousel', act: () => boardRide('carousel') },
      { zone: 'fair', x: 380, z: -6.2, r: 2.6, icon: '🎢', label: 'Monter dans les montagnes russes', act: () => boardRide('coaster') },
      { zone: 'fair', x: 383, z: 18, r: 2.4, icon: '🪂', label: 'Monter dans les chaises volantes', act: () => boardRide('swing') },
      { zone: 'fair', x: 390.3, z: 5, r: 2.2, icon: '🗼', label: 'Monter dans la tour de chute libre', act: () => boardRide('drop') },
      { zone: 'fair', x: 347, z: -2.4, r: 3, icon: '🚗', label: 'Conduire une auto-tamponneuse', act: () => boardRide('bump') },
      { zone: 'fair', x: 370, z: -33, r: 3.2, icon: '🎵', label: 'Mettre la musique de la fête (YouTube)', act: () => ytPanel() },
      { zone: 'fair', x: 364.9, z: 10, r: 1.8, icon: '🍭', label: 'Acheter une barbe à papa', act: () => { ack('cs_drink', 'barbe'); sDing(); toast('🍭 Une barbe à papa toute rose !'); } },
      { zone: 'fair', x: 364.9, z: 17, r: 1.8, icon: '🥨', label: 'Acheter des churros', act: () => { ack('cs_drink', 'churros'); sDing(); toast('🥨 Des churros tout chauds !'); } },
      { zone: 'fair', x: 364.9, z: 24, r: 1.8, icon: '🦆', label: 'Jouer à la pêche aux canards', act: () => fairGame('canards') },
      { zone: 'fair', x: 375.1, z: 10, r: 1.8, icon: '🎯', label: 'Jouer au tir à la carabine', act: () => startStandGame('tir') },
      { zone: 'fair', x: 375.1, z: 24, r: 1.8, icon: '🥫', label: 'Jouer au chamboule-tout', act: () => startStandGame('chamboule') },
      { zone: 'hall', lvl: 0, x: -99, z: 14.5, r: 2, icon: '🐠', label: 'Entrer dans l\'aquarium', act: () => goZone('aqua') },
      { zone: 'hall', lvl: 0, x: -61, z: 14.5, r: 2, icon: '🦁', label: 'Entrer dans le zoo', act: () => goZone('zoo') },
      { zone: 'aqua', x: 170, z: 19, r: 1.7, icon: '🏬', label: 'Retour à l\'atrium', act: () => goZone('hallFromAqua') },
      { zone: 'aqua', x: 170, z: -4.5, r: 3, icon: '🦈', label: 'Lire : le grand bassin', act: () => aquaInfo('bassin') },
      { zone: 'aqua', x: 170, z: 12.6, r: 2, icon: '🖐️', label: 'Toucher les étoiles de mer', act: () => { sDing(); toast('🖐️ Tu caresses une étoile de mer… elle est toute douce ! ⭐'); socket.emit('cs_emote', '⭐'); } },
      { zone: 'aqua', x: 158.8, z: 6.3, r: 2, icon: '🪼', label: 'Lire : les méduses', act: () => aquaInfo('meduses') },
      { zone: 'zoo', x: 260, z: 36, r: 2, icon: '🏬', label: 'Retour à l\'atrium', act: () => goZone('hallFromZoo') },
      { zone: 'zoo', x: 257.5, z: -10, r: 2.2, icon: '🦒', label: 'Lire le panneau : la savane', act: () => zooInfo('savane') },
      { zone: 'zoo', x: 262.5, z: -22, r: 2.2, icon: '🦁', label: 'Lire le panneau : les lions', act: () => zooInfo('lions') },
      { zone: 'zoo', x: 262.5, z: -10.5, r: 2, icon: '🐒', label: 'Lire le panneau : les singes', act: () => zooInfo('singes') },
      { zone: 'zoo', x: 257.5, z: 14, r: 2.2, icon: '🐧', label: 'Donner du poisson aux pingouins', act: () => { zooInfo('pingouins'); sDing(); socket.emit('cs_emote', '🐟'); zooAnimals.filter(a => a.kind === 'penguin').forEach(a => { a.tx = 238; a.tz = 14 + (Math.random() - .5) * 6; a.wait = 0; }); } },
      { zone: 'zoo', x: 262.5, z: 14, r: 2.2, icon: '🦩', label: 'Lire le panneau : les flamants', act: () => zooInfo('flamants') },
      { zone: 'zoo', x: 235, z: 28.6, r: 2, icon: '🍦', label: 'Acheter une glace', act: () => { ack('cs_drink', 'glace'); sDing(); toast('🍦 Une bonne glace pour la balade !'); } },
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
      tvAcc += dt; if (tvAcc > .12) { tvAcc = 0; drawTv(t); salleAcc = (salleAcc + 1) % 6; drawSalle(salleAcc, t); }
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
    const party = k === NT.LED || k === FR.LED;
    if (party && !th) for (let b = 0; b < 32; b++) { const hh = 10 + Math.abs(Math.sin(t * 7 + b * .6) * Math.cos(t * 2 + b)) * 120; g.fillStyle = `hsl(${(b * 11 + t * 80) % 360},100%,60%)`; g.fillRect(b * 16 + 2, 180 - hh, 12, hh); }
    g.fillText(v ? (party ? '🎵 ' : '🎬 ') + v.title : k === FR.LED ? '🎡 FÊTE FORAINE · Mets la musique depuis la scène !' : k === NT.LED ? '🪩 THE PARADISE NIGHT · Va voir le DJ pour mettre le son !' : `🎬 SALLE ${k + 1} · Choisis un film !`, 256, 214, 490); S.tex.needsUpdate = true;
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
  const screenHere = () => (me.zone === 'cine' ? salleAt(me.x, me.z) : me.zone === 'night' ? NT.LED : me.zone === 'fair' ? FR.LED : me.zone === 'club' ? -1 : null); // l'écran (ou la salle) qui me concerne
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
      res.replaceChildren(...(r.results || []).map(v => el('button', { type: 'button', class: 'bw-ytitem', onclick: async () => { const x = await ack('cs_video', { ...v, salle }); if (x.error) { err.textContent = x.error; return; } hidePanel(); setMute(false); toast(salle === FR.LED ? '🎵 Ta musique passe dans toute la fête foraine !' : salle === NT.LED ? '🎧 Ton son passe dans la boîte de nuit !' : salle >= 0 ? `🎬 Ton film commence dans la salle ${salle + 1} !` : '📺 Ta vidéo passe sur tous les écrans du club !'); } },
        el('img', { src: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`, alt: '' }), el('span', {}, el('b', {}, v.title), el('small', {}, [v.channel, v.length].filter(Boolean).join(' · ')))))); };
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); }); input.addEventListener('keyup', e => e.stopPropagation());
    const cur = salle >= 0 ? info?.cine?.[salle] : info?.video;
    showPanel(el('h3', {}, salle === FR.LED ? '🎵 La musique de la fête foraine' : salle === NT.LED ? '🎧 Le son de la boîte de nuit' : salle >= 0 ? `🎬 Le film de la salle ${salle + 1}` : '📺 Les écrans du club'), el('p', { class: 'help' }, salle === FR.LED ? 'Choisis la musique qui passe dans toute la fête foraine (et son clip sur l\'écran géant de la scène).' : salle === NT.LED ? 'Mets le son que tu veux (avec son clip sur le mur LED) : tout le monde dans la boîte l\'entend et danse dessus.' : salle >= 0 ? 'Choisis un film, une bande-annonce ou un clip sur YouTube : il passe sur le grand écran de la salle, et tous ceux qui sont dans la salle le regardent ensemble.' : 'Mets la musique ou la vidéo que tu veux : elle passe sur le mur géant et sur toutes les TV, et tout le monde dans le club la voit et l\'entend en même temps.'),
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
    socket.emit('cs_move', { x: me.x, z: me.z, y: me.y, yaw: me.yaw, k: 2 }); sCard();
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
    hall: { zone: 'hall', x: -80, z: 17.6, y: 0, lvl: 0, yaw: 0 }, hallFromClub: { zone: 'hall', x: -61.6, z: 8, y: 0, lvl: 0, yaw: Math.PI / 2 }, hallFromKart: { zone: 'hall', x: -98.4, z: 8, y: 0, lvl: 0, yaw: -Math.PI / 2 }, hallFromFair: { zone: 'hall', x: -92, z: 18.2, y: 0, lvl: 0, yaw: 0 }, fair: { zone: 'fair', x: 370, z: 36, y: 0, lvl: 0, yaw: 0 }, hallFromAqua: { zone: 'hall', x: -98.2, z: 14.5, y: 0, lvl: 0, yaw: -Math.PI / 2 }, hallFromZoo: { zone: 'hall', x: -61.8, z: 14.5, y: 0, lvl: 0, yaw: Math.PI / 2 }, aqua: { zone: 'aqua', x: 170, z: 17.5, y: 0, lvl: 0, yaw: 0 }, zoo: { zone: 'zoo', x: 260, z: 34, y: 0, lvl: 0, yaw: 0 },
    hallFromNight: { zone: 'hall', x: -90, z: -18.3, y: 6, lvl: 1, yaw: Math.PI }, hallFromCine: { zone: 'hall', x: -70, z: -18.3, y: 6, lvl: 1, yaw: Math.PI },
    club: { zone: 'club', x: 0, z: 10.3, y: 0, lvl: 0, yaw: 0 }, cine: { zone: 'cine', x: 60, z: 12.6, y: 0, lvl: 0, yaw: 0 },
    night: { zone: 'night', x: 115, z: 12.6, y: 0, lvl: 0, yaw: 0 }, kart: { zone: 'kart', x: -145, z: 20, y: 0, lvl: 0, yaw: 0 } };
  const WELCOME = { fair: '🎡 Bienvenue à la fête foraine ! Grande roue, montagnes russes, carrousel… et mets la musique sur la scène !', aqua: '🐠 Bienvenue au Paradise Aquarium ! Passe dans le tunnel de verre, les requins nagent au-dessus de toi', zoo: '🦁 Bienvenue au Paradise Zoo ! Girafes, éléphants, lions, singes, pingouins et flamants roses t\'attendent', hall: '🏬 Bienvenue au Paradise Complex ! Prends l\'escalator pour la boîte de nuit et le cinéma', club: '🎰 Le casino et les jeux : bar, billards, poker, bowling, laser game…', cine: '🎬 Bienvenue au Paradise Ciné ! Prends l\'escalator pour aller dans les salles', night: '🪩 Bienvenue à The Paradise Night ! Va sur la piste, au bar ou au carré VIP', kart: '🏎️ Bienvenue au Paradise Karting ! Prends un kart au stand pour faire un tour' };
  function goZone(key, quiet) {
    const S = SPAWN[key]; if (!S) return; if (mode === 'kart') leaveKart(true); if (mode === 'ride') leaveRide(true); if (mode === 'game') endStandGame(); if (mode === 'seat') { me.seat = null; mode = 'walk'; }
    Object.assign(me, { zone: S.zone, x: S.x, z: S.z, y: S.y, lvl: S.lvl, yaw: S.yaw, ride: null, seat: null }); camYaw = S.yaw;
    for (const k in ZG) ZG[k].visible = k === S.zone;
    const sky = S.zone === 'zoo' ? 0xbfdcf0 : S.zone === 'aqua' ? 0x02101e : S.zone === 'fair' ? 0x0a0618 : 0x07040c; if (!bgColor) bgColor = new THREE.Color(); if (S.zone === 'zoo' && zooSky) { scene.background = zooSky; scene.environment = zooEnv; } else { scene.background = bgColor.setHex(sky); scene.environment = baseEnv; } scene.fog.color.setHex(S.zone === 'zoo' ? 0xcfe2ee : sky); scene.fog.near = S.zone === 'zoo' ? 90 : S.zone === 'fair' ? 60 : 32; scene.fog.far = S.zone === 'zoo' ? 260 : S.zone === 'fair' ? 170 : 70; if (zooSun) zooSun.intensity = S.zone === 'zoo' ? 1.3 : 0; fairLights.forEach(l => { l.intensity = S.zone === 'fair' ? 35 : 0; }); if (S.zone === 'fair') buildStandGames();
    hidePanel(); socket.emit('cs_move', { x: me.x, z: me.z, y: me.y, yaw: me.yaw }); syncVideo(); if (!quiet && WELCOME[S.zone]) toast(WELCOME[S.zone]);
  }
  const ZONES = [['hall', '🏬', 'L\'atrium (accueil, boutiques, fontaine)'], ['club', '🎰', 'Casino & jeux (bar, billards, poker, bowling, laser game)'], ['night', '🪩', 'The Paradise Night (la boîte de nuit)'], ['cine', '🎬', 'Paradise Ciné (4 salles)'], ['kart', '🏎️', 'Paradise Karting (circuit)'], ['aqua', '🐠', 'Paradise Aquarium (tunnel, requins, méduses)'], ['zoo', '🦁', 'Paradise Zoo (savane, lions, singes, pingouins…)'], ['fair', '🎡', 'Fête foraine (grande roue, montagnes russes, manèges)']];
  const zoneOfX = x => (x < -120 ? 'kart' : x < -40 ? 'hall' : x < 30 ? 'club' : x < 90 ? 'cine' : x < 140 ? 'night' : x < 205 ? 'aqua' : x < 320 ? 'zoo' : 'fair');
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
    for (const [x, z, ry, txt, col] of [[x0 + .03, 14.5, Math.PI / 2, '🐠 AQUARIUM', '#38e8ff'], [x1 - .03, 14.5, -Math.PI / 2, '🦁 ZOO', '#ffd23f'], [x0 + .03, 8, Math.PI / 2, '🏎️ KARTING', '#ff8a3d'], [x1 - .03, 8, -Math.PI / 2, '🎰 CASINO & JEUX', '#2bff88'], [MX, z1 - .03, Math.PI, '🚪 SORTIE', '#38e8ff'], [-92, z1 - .03, Math.PI, '🎡 FÊTE FORAINE', '#ff2bd6']]) {
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
    if (me.zone === 'hall') return x > -99.7 && x < -60.3 && z > (me.lvl ? -19.7 : -3.7) && z < 19.7; // à l'étage, la caméra peut flotter au-dessus de l'atrium
    if (me.zone === 'cine') return inR(cineRects[me.lvl ? 1 : 0], .3) || (me.lvl === 1 && salleAt(me.x, me.z) < 0 && inR(cineRects[0], .3)); // depuis la mezzanine, au-dessus du hall
    if (me.zone === 'night') return x > 100.2 && x < 129.8 && z > -14.8 && z < 14.8;
    if (me.zone === 'club') return x > -17.8 && x < 17.8 && z > -13.8 && z < 13.8;
    if (me.zone === 'aqua') return z < -5.9 ? Math.abs(x - 170) < 1.9 && z > -19.6 : x > 150.2 && x < 189.8 && z < 19.8;
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

  // ---------- 🐠 Paradise Aquarium : grand bassin avec tunnel de verre, méduses, récifs, bassin tactile ----------
  const AQ = { x0: 150, x1: 190, z0: -20, z1: 20, H: 9, glassZ: -6, tx: 170 };
  const aquaBoxes = [[150, -20, 168.3, -6], [171.7, -20, 190, -6], [150, .5, 152, 16.5], [188, .5, 190, 16.5], [167.6, 6.6, 172.4, 11.4], [154.6, 1.4, 157.4, 4.2], [154.6, 8.4, 157.4, 11.2], [182.6, 4.4, 185.4, 7.2]];
  function aquaFits(x, z) { return x > 150.5 && x < 189.5 && z > -19 && z < 19.5 && !aquaBoxes.some(([a, b, c, d]) => x > a - RAD && x < c + RAD && z > b - RAD && z < d + RAD); }
  const fishSchools = [];
  function causticTex() { const [c, g] = cnv(256, 256); g.fillStyle = '#0a3a5a'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(160,230,255,.35)'; g.lineWidth = 2; for (let k = 0; k < 70; k++) { g.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; g.ellipse(x, y, 8 + Math.random() * 18, 5 + Math.random() * 12, Math.random() * 3, 0, 7); g.stroke(); } const t = tex(c, [8, 8]); return t; }
  function sandTex() { const [c, g] = cnv(256, 256); g.fillStyle = '#c9b07a'; g.fillRect(0, 0, 256, 256); for (let k = 0; k < 5000; k++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,240,200' : '120,90,40'},${Math.random() * .25})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } return tex(c, [10, 5]); }
  // un banc de poissons : corps + nageoire de queue, chacun suit une boucle avec ses voisins
  function school({ n, col, col2, len, cx, cy, cz, rx, ry, rz, speed, zone = 'aqua', avoid }) {
    const body = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ roughness: .35, metalness: .3 }), n);
    const tailG = new THREE.BufferGeometry(); tailG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, .6, -1, 0, -.6, -1], 3)); tailG.computeVertexNormals();
    const tail = new THREE.InstancedMesh(tailG, new THREE.MeshStandardMaterial({ roughness: .5, side: THREE.DoubleSide }), n);
    const cA = new THREE.Color(col), cB = new THREE.Color(col2 || col);
    const fish = []; for (let i = 0; i < n; i++) { const c = cA.clone().lerp(cB, Math.random()); body.setColorAt(i, c); tail.setColorAt(i, c.clone().multiplyScalar(.8)); fish.push({ ox: (Math.random() - .5) * 2.4, oy: (Math.random() - .5) * 1.4, oz: (Math.random() - .5) * 2.4, ph: Math.random() * 6, s: .8 + Math.random() * .4 }); }
    (BG || scene).add(body, tail); const q = new THREE.Object3D(), p = new THREE.Vector3(), d = new THREE.Vector3();
    anims.push((dt, t) => { if (me.zone !== zone) return; const a = t * speed;
      for (let i = 0; i < n; i++) { const f = fish[i], aa = a + f.ph * .05;
        const x = cx + Math.cos(aa) * rx + f.ox + Math.sin(t * .7 + f.ph) * .3, y = cy + Math.sin(aa * 1.7) * ry + f.oy, z = cz + Math.sin(aa) * rz + f.oz;
        p.set(x, y, z); if (avoid) avoid(p);
        d.set(-Math.sin(aa) * rx, Math.cos(aa * 1.7) * ry * 1.7, Math.cos(aa) * rz).normalize();
        const L = len * f.s; q.position.copy(p); q.lookAt(p.x + d.x, p.y + d.y, p.z + d.z); q.scale.set(L * .28, L * .4, L * .55); q.updateMatrix(); body.setMatrixAt(i, q.matrix);
        q.position.set(p.x - d.x * L * .5, p.y - d.y * L * .5, p.z - d.z * L * .5); q.scale.setScalar(L * .45); q.rotateY(Math.sin(t * 9 + f.ph) * .45); q.updateMatrix(); tail.setMatrixAt(i, q.matrix); q.rotation.set(0, 0, 0); }
      body.instanceMatrix.needsUpdate = true; tail.instanceMatrix.needsUpdate = true; });
  }
  const tunnelAvoid = p => { const dx = p.x - AQ.tx, r = Math.hypot(dx, p.y); if (p.z > -19.5 && p.z < -6 && r < 2.8) { const k = 2.8 / Math.max(.01, r); p.x = AQ.tx + dx * k; p.y = Math.max(.3, p.y * k + (r < .2 ? 2.8 : 0)); } p.z = Math.max(-19.4, Math.min(-6.5, p.z)); p.x = Math.max(150.6, Math.min(189.4, p.x)); p.y = Math.max(.35, Math.min(8.2, p.y)); };
  function bigFish(kind) { // requin, raie ou tortue (un seul gros animal)
    const g = new THREE.Group(), grey = std(kind === 'turtle' ? 0x5a7a3a : kind === 'ray' ? 0x6a6458 : 0x7a8a96, { roughness: .5 }), belly = std(0xdfe6ea, { roughness: .6 });
    if (kind === 'shark') { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), grey); b.scale.set(.42, .45, 1.6); g.add(b); const bl = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), belly); bl.scale.set(.36, .3, 1.4); bl.position.y = -.14; g.add(bl);
      const dor = new THREE.Mesh(new THREE.ConeGeometry(.28, .7, 4), grey); dor.position.set(0, .55, .1); dor.scale.z = .3; g.add(dor);
      for (const s of [-1, 1]) { const pf = new THREE.Mesh(new THREE.ConeGeometry(.18, .8, 4), grey); pf.rotation.z = s * 1.9; pf.position.set(s * .45, -.15, .4); pf.scale.z = .25; g.add(pf); }
      const tl = new THREE.Group(); tl.position.z = -1.5; g.add(tl); const tf = new THREE.Mesh(new THREE.ConeGeometry(.25, .9, 4), grey); tf.rotation.x = Math.PI / 2 + .9; tf.position.set(0, .3, -.2); tf.scale.x = .25; tl.add(tf); const tf2 = tf.clone(); tf2.rotation.x = Math.PI / 2 - .9; tf2.position.y = -.2; tf2.scale.y = .6; tl.add(tf2); g.tail = tl;
      for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 6), basic(0x050505)); eye.position.set(s * .25, .1, 1.25); g.add(eye); } }
    if (kind === 'ray') { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), grey); b.scale.set(1.3, .12, .9); g.add(b); const tl = new THREE.Mesh(new THREE.CylinderGeometry(.03, .01, 1.6, 6), grey); tl.rotation.x = Math.PI / 2; tl.position.z = -1.6; g.add(tl); g.wings = b; }
    if (kind === 'turtle') { const sh = new THREE.Mesh(new THREE.SphereGeometry(.6, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0x6b5a2a, { roughness: .6 })); sh.scale.set(1, .5, 1.2); g.add(sh); const hd = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 8), grey); hd.position.set(0, .05, .8); g.add(hd);
      g.fl = []; for (const [x, z] of [[-.6, .4], [.6, .4], [-.45, -.5], [.45, -.5]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(.5, .05, .22), grey); f.position.set(x, 0, z); g.add(f); g.fl.push(f); } }
    (BG || scene).add(g); return g;
  }
  function jelly(x, z, col) { // une colonne de méduses lumineuses
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 4.2, 32, 1, true), new THREE.MeshPhysicalMaterial({ color: 0x0a2a4a, transparent: true, opacity: .35, roughness: .05, side: THREE.DoubleSide, depthWrite: false })); tube.position.set(x, 2.3, z); (BG || scene).add(tube);
    addBox(2.6, .4, 2.6, std(0x111622, { metalness: .6 }), x, .2, z); addBox(2.6, .25, 2.6, std(0x111622, { metalness: .6 }), x, 4.5, z);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 4, 24, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .08, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false })); glow.position.set(x, 2.3, z); (BG || scene).add(glow);
    const js = []; for (let k = 0; k < 5; k++) { const g = new THREE.Group(); const bell = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .9, transparent: true, opacity: .7 })); g.add(bell);
      const pts = []; for (let t = 0; t < 8; t++) { const a = t / 8 * Math.PI * 2; pts.push(Math.cos(a) * .14, 0, Math.sin(a) * .14, Math.cos(a) * .1, -.6 - Math.random() * .3, Math.sin(a) * .1); } const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: .7 })));
      g.position.set(x + (Math.random() - .5) * 1.2, 1 + Math.random() * 3, z + (Math.random() - .5) * 1.2); (BG || scene).add(g); js.push({ g, ph: Math.random() * 6, y0: g.position.y }); }
    anims.push((dt, t) => { if (me.zone !== 'aqua') return; for (const j of js) { const p = Math.sin(t * 2 + j.ph); j.g.scale.set(1 + p * .12, 1 - p * .15, 1 + p * .12); j.g.position.y = j.y0 + Math.sin(t * .4 + j.ph) * .6; } });
  }
  function coral(x, y, z, s = 1) { const cols = [0xff5f7a, 0xffa040, 0xb06bff, 0xffd23f, 0x3affc8]; const c = cols[Math.random() * cols.length | 0];
    for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.03 * s, .07 * s, (.4 + Math.random() * .6) * s, 6), std(c, { roughness: .8 })); b.position.set(x + (Math.random() - .5) * .4 * s, y + .3 * s, z + (Math.random() - .5) * .4 * s); b.rotation.set((Math.random() - .5) * .8, 0, (Math.random() - .5) * .8); (BG || scene).add(b); }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.25 * s, 10, 8), std(cols[(Math.random() * cols.length) | 0], { roughness: .9 })); ball.position.set(x + .3 * s, y + .15 * s, z); ball.scale.y = .7; (BG || scene).add(ball); }
  function seaweed(x, z, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.25, h, 1, 6), new THREE.MeshStandardMaterial({ color: 0x2a8a3a, side: THREE.DoubleSide, roughness: .8 })); m.position.set(x, h / 2, z); (BG || scene).add(m); const P = m.geometry.attributes.position, base = P.array.slice();
    anims.push((dt, t) => { if (me.zone !== 'aqua') return; for (let i = 0; i < P.count; i++) { const y = base[i * 3 + 1] + h / 2; P.array[i * 3] = base[i * 3] + Math.sin(t * 1.3 + y * 1.5 + x) * .12 * y / h; } P.needsUpdate = true; }); }
  function buildAqua() {
    BG = ZG.aqua = new THREE.Group(); scene.add(BG); BG.visible = false;
    const { x0, x1, z0, z1, H, glassZ, tx } = AQ, MX = (x0 + x1) / 2, W = x1 - x0, wallM = std(0x06121f, { roughness: .8 });
    // la salle : sol avec des reflets d'eau qui bougent, murs bleu nuit
    const caus = causticTex(); addPlane(W, z1 - glassZ, std(0xffffff, { map: caus, roughness: .5, emissive: 0x05182a }), MX, 0, (z1 + glassZ) / 2, 0, -Math.PI / 2);
    anims.push((dt, t) => { if (me.zone === 'aqua') { caus.offset.set(Math.sin(t * .2) * .1, t * .03); } });
    addPlane(W, 40, basic(0x020814), MX, H, 0, 0, Math.PI / 2);
    addPlane(40, H, wallM, x0, H / 2, 0, Math.PI / 2); addPlane(40, H, wallM, x1, H / 2, 0, -Math.PI / 2); addPlane(W, H, wallM, MX, H / 2, z1, Math.PI);
    // le grand bassin : sable, rochers, coraux, algues, fond bleu profond, surface qui scintille, rayons de lumière
    addPlane(W, 14, std(0xffffff, { map: sandTex(), roughness: 1 }), MX, .02, -13, 0, -Math.PI / 2);
    const [bc, bg] = cnv(64, 256); const gr = bg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#0a6aa8'); gr.addColorStop(1, '#021a30'); bg.fillStyle = gr; bg.fillRect(0, 0, 64, 256);
    addPlane(W, H, new THREE.MeshBasicMaterial({ map: tex(bc), fog: false }), MX, H / 2, z0 + .02); addPlane(14, H, new THREE.MeshBasicMaterial({ map: tex(bc) }), x0 + .02, H / 2, -13, Math.PI / 2); addPlane(14, H, new THREE.MeshBasicMaterial({ map: tex(bc) }), x1 - .02, H / 2, -13, -Math.PI / 2);
    const surf = causticTex(); addPlane(W, 14, new THREE.MeshBasicMaterial({ map: surf, transparent: true, opacity: .55, side: THREE.DoubleSide, color: 0x8fdcff }), MX, 8.6, -13, 0, Math.PI / 2); anims.push((dt, t) => { if (me.zone === 'aqua') surf.offset.set(t * .02, Math.sin(t * .3) * .1); });
    for (let k = 0; k < 9; k++) { const ray = new THREE.Mesh(new THREE.ConeGeometry(1.4, 8.5, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: .05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); ray.position.set(x0 + 3 + k * 4.3, 4.3, -10 - (k % 3) * 3); ray.rotation.z = .15; BG.add(ray); }
    for (let k = 0; k < 14; k++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(.6 + Math.random() * 1.2, 0), std(0x4a4a52, { roughness: 1 })); const x = x0 + 1 + Math.random() * 38; if (Math.abs(x - tx) < 3.2) continue; r.position.set(x, .3, -7.5 - Math.random() * 11.5); r.scale.y = .6; BG.add(r); coral(r.position.x, .4, r.position.z + .8, 1.2); }
    for (let k = 0; k < 26; k++) { const x = x0 + 1 + Math.random() * 38; if (Math.abs(x - tx) < 3) continue; seaweed(x, -7 - Math.random() * 12, 1.5 + Math.random() * 3); }
    // la vitre géante avec son cadre, et le tunnel de verre qui traverse le bassin
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x4ab8e8, transparent: true, opacity: .22, roughness: .05, metalness: .1, depthWrite: false, side: THREE.DoubleSide });
    for (const [a, b] of [[x0, tx - 2.2], [tx + 2.2, x1]]) { addPlane(b - a, H - .4, glass, (a + b) / 2, (H - .4) / 2, glassZ); addBox(b - a, .2, .3, std(0x0a1a2a, { metalness: .6 }), (a + b) / 2, .1, glassZ); }
    addPlane(4.4, H - .4 - 2.25, glass, tx, 2.25 + (H - .4 - 2.25) / 2, glassZ);
    addBox(W, .3, .3, std(0x0a1a2a, { metalness: .6 }), MX, H - .3, glassZ);
    for (let x = x0 + 5; x < x1; x += 5) if (Math.abs(x - tx) > 2.6) addBox(.18, H, .25, std(0x0a1a2a, { metalness: .6, roughness: .3 }), x, H / 2, glassZ); // les montants de la grande vitre
    const tun = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 13.5, 32, 1, true, Math.PI / 2, Math.PI), glass); tun.rotation.x = Math.PI / 2; tun.position.set(tx, 0, -12.75); BG.add(tun); // la voûte en verre au-dessus de l'allée
    for (let z = -6.5; z > -19.5; z -= 2) { const rib = new THREE.Mesh(new THREE.TorusGeometry(2.2, .04, 6, 24, Math.PI), std(0x8aa4b8, { metalness: .8, roughness: .3 })); rib.position.set(tx, 0, z); BG.add(rib); }
    addPlane(3.2, 13.5, std(0x1a2a3a, { roughness: .4 }), tx, .03, -12.75, 0, -Math.PI / 2);
    for (const s of [-1, 1]) addBox(.04, .04, 13.5, basic(0x38e8ff), tx + s * 1.5, .06, -12.75);
    addPlane(8, 1.2, neon('🐠 PARADISE AQUARIUM', '#38e8ff'), MX, 8.4, z1 - .05, Math.PI);
    addPlane(5, .8, neon('🦈 LE GRAND BASSIN', '#9fe6ff', 1024, 100), tx, 8.1, glassZ + .05);
    addPlane(3, 3.2, std(0x05030a, { emissive: 0x04203a }), MX, 1.6, z1 - .03, Math.PI);
    // les habitants du grand bassin
    school({ n: 34, col: 0xffd23f, col2: 0xffa000, len: .35, cx: 160, cy: 3, cz: -12, rx: 7, ry: 1.5, rz: 4, speed: .25, avoid: tunnelAvoid });
    school({ n: 40, col: 0x2fa8ff, col2: 0x1c4fd8, len: .3, cx: 180, cy: 4.5, cz: -13, rx: 7, ry: 2, rz: 4.5, speed: .3, avoid: tunnelAvoid });
    school({ n: 50, col: 0xc8d4dc, col2: 0x8fa4b4, len: .22, cx: 170, cy: 5.5, cz: -12, rx: 14, ry: 1.2, rz: 4, speed: .18, avoid: tunnelAvoid });
    school({ n: 16, col: 0xff6a1f, col2: 0xffffff, len: .25, cx: 157, cy: 1.2, cz: -9, rx: 3, ry: .4, rz: 1.5, speed: .5, avoid: tunnelAvoid });
    const bigs = [['shark', 170, 4, -13, 15, 1.2, 5, .12, 0], ['shark', 170, 2.6, -12, 12, .8, 4, -.1, 2], ['ray', 165, 1, -14, 8, .4, 3.5, .16, 1], ['ray', 178, 1.5, -10, 6, .5, 2.5, -.2, 3], ['turtle', 172, 5, -15, 10, 1.5, 3, .09, 4]].map(([k, cx, cy, cz, rx, ry, rz, sp, ph]) => ({ g: bigFish(k), k, cx, cy, cz, rx, ry, rz, sp, ph }));
    const pv = new THREE.Vector3();
    anims.push((dt, t) => { if (me.zone !== 'aqua') return; for (const b of bigs) { const a = t * b.sp + b.ph; pv.set(b.cx + Math.cos(a) * b.rx, b.cy + Math.sin(a * 1.3) * b.ry, b.cz + Math.sin(a) * b.rz); tunnelAvoid(pv); const d = Math.sign(b.sp); b.g.position.copy(pv); b.g.lookAt(pv.x - Math.sin(a) * b.rx * d, pv.y, pv.z + Math.cos(a) * b.rz * d);
      if (b.g.tail) b.g.tail.rotation.y = Math.sin(t * 3 + b.ph) * .4; if (b.g.wings) b.g.wings.rotation.z = Math.sin(t * 2 + b.ph) * .15; if (b.g.fl) b.g.fl.forEach((f, i) => { f.rotation.z = Math.sin(t * 2 + i) * .5; }); } });
    // les colonnes de méduses, les récifs muraux, le bassin tactile, les bancs
    jelly(156, 2.8, 0xff6ad5); jelly(156, 9.8, 0x6ad5ff); jelly(184, 5.8, 0xc8a0ff);
    for (const sx of [151, 189]) { const g = new THREE.Group(); BG.add(g); const tank = new THREE.Mesh(new THREE.BoxGeometry(2, 3.4, 16), new THREE.MeshPhysicalMaterial({ color: 0x2a9fd8, transparent: true, opacity: .25, roughness: .05, depthWrite: false })); tank.position.set(sx, 2.2, 8.5); g.add(tank);
      const sand = new THREE.Mesh(new THREE.BoxGeometry(1.9, .3, 15.8), std(0xd8c08a)); sand.position.set(sx, .65, 8.5); g.add(sand); addBox(2.1, .5, 16.2, std(0x0a1a2a, { metalness: .6 }), sx, .25, 8.5);
      for (let k = 0; k < 9; k++) coral(sx + (Math.random() - .5) * .8, .8, 1.5 + k * 1.7, .8);
      school({ n: 14, col: sx < 170 ? 0xff7a1f : 0x2f6aff, col2: sx < 170 ? 0xffffff : 0xffd23f, len: .14, cx: sx, cy: 2.2, cz: 8.5, rx: .4, ry: .8, rz: 6.5, speed: .35 }); }
    addPlane(3, .6, neon('🐟 RÉCIF CORALLIEN', '#ff9a3d', 1024, 100), 152.1, 4.4, 8.5, Math.PI / 2); addPlane(3, .6, neon('🐠 LAGON TROPICAL', '#38e8ff', 1024, 100), 187.9, 4.4, 8.5, -Math.PI / 2);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.5, .8, 40), std(0x2a3a4a, { roughness: .4 })); pool.position.set(170, .4, 9); BG.add(pool);
    const pw = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40), new THREE.MeshPhysicalMaterial({ color: 0x3ac0f0, transparent: true, opacity: .6, roughness: .05, emissive: 0x0a3050 })); pw.rotation.x = -Math.PI / 2; pw.position.set(170, .78, 9); BG.add(pw);
    for (let k = 0; k < 7; k++) { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? .07 : .18, a = i / 10 * Math.PI * 2; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(r, 0); } const st = new THREE.Mesh(new THREE.ShapeGeometry(sh), std([0xff6a3d, 0xff3b8a, 0xffd23f][k % 3])); st.rotation.x = -Math.PI / 2; const a = k / 7 * Math.PI * 2; st.position.set(170 + Math.cos(a) * 1.3, .7, 9 + Math.sin(a) * 1.3); BG.add(st); }
    addPlane(3, .55, neon('🖐️ BASSIN TACTILE', '#2bff88', 1024, 100), 170, 2.3, 11.6, Math.PI);
    for (const x of [158, 164, 176, 182]) { addBox(2.4, .45, .6, std(0x1a2a3a, { roughness: .6 }), x, .45, -3.2); aquaBoxes.push([x - 1.2, -3.5, x + 1.2, -2.9]); }
    // des bulles qui montent dans le grand bassin
    const NB = 120, bp = new Float32Array(NB * 3); for (let k = 0; k < NB; k++) { bp[k * 3] = x0 + 2 + (k % 6) * 7 + Math.random(); bp[k * 3 + 1] = Math.random() * 8; bp[k * 3 + 2] = -8 - (k % 4) * 3; }
    const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.BufferAttribute(bp, 3)); BG.add(new THREE.Points(bgeo, new THREE.PointsMaterial({ color: 0xdff6ff, size: .09, transparent: true, opacity: .7 })));
    anims.push((dt, t) => { if (me.zone !== 'aqua') return; for (let k = 0; k < NB; k++) { bp[k * 3 + 1] += dt * (.6 + (k % 5) * .15); bp[k * 3] += Math.sin(t * 2 + k) * dt * .05; if (bp[k * 3 + 1] > 8.4) bp[k * 3 + 1] = .2; } bgeo.attributes.position.needsUpdate = true; });
    BG = null;
  }

  // ---------- 🦁 Paradise Zoo : savane, lions, singes, pingouins, flamants roses ----------
  const ZO = { x0: 222, x1: 298, z0: -38, z1: 38 };
  const PENS = { savane: [225, -37, 255, -6], lions: [265, -37, 296, -18], singes: [265, -15, 296, -6], pingouins: [225, 6, 255, 22], flamants: [265, 6, 296, 22] };
  const zooBoxes = Object.values(PENS).slice();
  function zooFits(x, z) { return x > 222.5 && x < 297.5 && z > -37.5 && z < 37.5 && !zooBoxes.some(([a, b, c, d]) => x > a - RAD && x < c + RAD && z > b - RAD && z < d + RAD); }
  const zooAnimals = [];
  function patternTex(kind) {
    const [c, g] = cnv(512, 256);
    if (kind === 'giraffe') { g.fillStyle = '#f2dcae'; g.fillRect(0, 0, 512, 256); for (let y = 0; y < 256; y += 30) for (let x = (y / 30 % 2) * 16; x < 512; x += 34) { g.fillStyle = `rgb(${150 + Math.random() * 20 | 0},${80 + Math.random() * 15 | 0},${30})`; g.beginPath(); const cx = x + 15 + Math.random() * 4, cy = y + 14 + Math.random() * 4; for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, r = 11 + Math.random() * 4; g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r * 1.15, cy + Math.sin(a) * r); } g.closePath(); g.fill(); } }
    if (kind === 'skin') { g.fillStyle = '#8c8781'; g.fillRect(0, 0, 512, 256); for (let k = 0; k < 900; k++) { g.strokeStyle = `rgba(${Math.random() < .5 ? '60,55,50' : '170,165,160'},${Math.random() * .25})`; g.lineWidth = 1; g.beginPath(); const x = Math.random() * 512, y = Math.random() * 256; g.moveTo(x, y); g.lineTo(x + (Math.random() - .5) * 30, y + (Math.random() - .5) * 6); g.stroke(); } }
    if (kind === 'fur') { g.fillStyle = '#c99a4a'; g.fillRect(0, 0, 512, 256); for (let k = 0; k < 6000; k++) { g.fillStyle = `rgba(${Math.random() < .5 ? '120,80,30' : '235,200,130'},${Math.random() * .25})`; g.fillRect(Math.random() * 512, Math.random() * 256, 1, 3); } }
    return tex(c);
  }
  const shadowTex = (() => { let t = null; return () => { if (t) return t; const [c, g] = cnv(128, 128), r = g.createRadialGradient(64, 64, 4, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,.5)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); t = tex(c); return t; }; })();
  function blob(w, d) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .03; m.renderOrder = 1; return m; }
  // une patte articulée (cuisse + jambe + sabot) qui se balance depuis la hanche
  function limb(g, x, y, z, len, r, mat, hoofM) { const piv = new THREE.Group(); piv.position.set(x, y, z); g.add(piv);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(r, len * .45, 6, 12), mat); up.position.y = -len * .27; piv.add(up);
    const knee = new THREE.Group(); knee.position.y = -len * .52; piv.add(knee); const lo = new THREE.Mesh(new THREE.CapsuleGeometry(r * .72, len * .38, 6, 12), mat); lo.position.y = -len * .22; knee.add(lo);
    if (hoofM) { const h = new THREE.Mesh(new THREE.CylinderGeometry(r * .8, r * .95, len * .07, 12), hoofM); h.position.y = -len * .46; knee.add(h); }
    piv.knee = knee; return piv; }
  const eyes = (g, x, y, z, r = .045) => { for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), std(0x0a0a0a, { roughness: .2 })); e.position.set(s * x, y, z); g.add(e); const sh = new THREE.Mesh(new THREE.SphereGeometry(r * .35, 6, 6), basic(0xffffff)); sh.position.set(s * x + s * r * .2, y + r * .3, z - r * .6); g.add(sh); } };
  function animal(kind) {
    const g = new THREE.Group(), A = { g, kind, legs: [], bob: 0 }; g.add(blob(kind === 'elephant' ? 4.5 : kind === 'giraffe' ? 2.8 : kind === 'penguin' ? .8 : kind === 'monkey' ? 1 : 2.4, kind === 'elephant' ? 5.5 : kind === 'giraffe' ? 3.6 : kind === 'penguin' ? .8 : 1.6));
    if (kind === 'elephant') { const m = new THREE.MeshStandardMaterial({ map: patternTex('skin'), roughness: .95 }), dark = std(0x3a3632);
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), m); body.scale.set(1.2, 1.15, 1.85); body.position.y = 2.35; g.add(body);
      const sh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), m); sh.scale.set(1.05, 1.1, .9); sh.position.set(0, 2.6, -.9); g.add(sh);
      const hd = new THREE.Group(); hd.position.set(0, 3, -1.85); g.add(hd); const h = new THREE.Mesh(new THREE.SphereGeometry(.85, 24, 18), m); h.scale.set(1, 1.05, .95); hd.add(h);
      const earS = new THREE.Shape(); earS.moveTo(0, .6); earS.bezierCurveTo(.9, .9, 1.4, .1, 1.1, -.7); earS.bezierCurveTo(.8, -1.2, .2, -1, 0, -.5); earS.lineTo(0, .6);
      A.ears = [-1, 1].map(s => { const e = new THREE.Mesh(new THREE.ShapeGeometry(earS, 16), new THREE.MeshStandardMaterial({ map: m.map, color: 0xb0a49a, roughness: .95, side: THREE.DoubleSide })); e.scale.set(s, 1, 1); e.position.set(s * .55, .1, .3); e.rotation.y = s * .4; hd.add(e); return e; });
      let parent = hd; const seg = []; for (let k = 0; k < 8; k++) { const p = new THREE.Group(); p.position.set(0, k ? -.24 : -.25, k ? 0 : -.72); const rr = .24 - k * .019; const c = new THREE.Mesh(new THREE.CapsuleGeometry(rr, .16, 6, 12), m); c.position.y = -.12; p.add(c); parent.add(p); parent = p; seg.push(p); } A.trunk = seg;
      for (const s of [-1, 1]) { const tc = new THREE.CatmullRomCurve3([new THREE.Vector3(s * .32, -.45, -.6), new THREE.Vector3(s * .38, -.8, -.9), new THREE.Vector3(s * .3, -.95, -1.3)]); const tu = new THREE.Mesh(new THREE.TubeGeometry(tc, 10, .06, 8), std(0xf4ecd8, { roughness: .4 })); hd.add(tu); }
      eyes(hd, .5, .2, -.62, .05);
      A.legs = [[-.7, 1.75, -1.05], [.7, 1.75, -1.05], [-.7, 1.75, 1.05], [.7, 1.75, 1.05]].map(([x, y, z]) => limb(g, x, y, z, 1.8, .34, m, dark));
      const tl = new THREE.Mesh(new THREE.CylinderGeometry(.03, .05, 1, 8), m); tl.position.set(0, 2.2, 1.9); tl.rotation.x = .3; g.add(tl); A.tail = tl; A.speed = .9; }
    if (kind === 'giraffe') { const pm = new THREE.MeshStandardMaterial({ map: patternTex('giraffe'), roughness: .85 }), dark = std(0x2a1a10), mane = std(0x7a4a22);
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), pm); body.scale.set(.62, .72, 1.25); body.position.y = 2.65; g.add(body);
      const nk = new THREE.Group(); nk.position.set(0, 2.95, -.95); nk.rotation.x = -.38; g.add(nk);
      for (let k = 0; k < 7; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.3 - k * .022, 16, 12), pm); s.scale.y = 1.6; s.position.y = .25 + k * .38; nk.add(s); const mn = new THREE.Mesh(new THREE.BoxGeometry(.05, .3, .1), mane); mn.position.set(0, .25 + k * .38, .26 - k * .02); nk.add(mn); }
      const hd = new THREE.Group(); hd.position.set(0, 2.85, -.1); nk.add(hd); const h = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .42, 8, 16), pm); h.rotation.x = Math.PI / 2 - .2; h.position.z = -.2; hd.add(h); const snout = new THREE.Mesh(new THREE.SphereGeometry(.15, 14, 10), std(0x6a4a30)); snout.position.set(0, -.06, -.52); hd.add(snout);
      for (const s of [-1, 1]) { const o = new THREE.Mesh(new THREE.CylinderGeometry(.03, .035, .22, 8), pm); o.position.set(s * .09, .24, .02); hd.add(o); const kn = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), dark); kn.position.set(s * .09, .36, .02); hd.add(kn); const ear = new THREE.Mesh(new THREE.ConeGeometry(.06, .2, 8), pm); ear.position.set(s * .2, .12, .05); ear.rotation.z = -s * 1.2; hd.add(ear); }
      eyes(hd, .15, .08, -.25, .035); A.neck = nk;
      A.legs = [[-.32, 2.2, -.8], [.32, 2.2, -.8], [-.32, 2.2, .8], [.32, 2.2, .8]].map(([x, y, z]) => limb(g, x, y, z, 2.25, .09, pm, dark));
      const tl = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1), pm); tl.position.set(0, 2.3, 1.3); tl.rotation.x = .25; g.add(tl); const tf = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), dark); tf.position.set(0, -.5, 0); tl.add(tf); A.tail = tl; A.speed = 1.1; }
    if (kind === 'lion' || kind === 'lioness') { const fur = new THREE.MeshStandardMaterial({ map: patternTex('fur'), roughness: .9 }), maneM = std(0x6a3a14, { roughness: 1 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(.42, 1.1, 10, 20), fur); body.rotation.x = Math.PI / 2; body.position.y = 1.05; g.add(body);
      const chest = new THREE.Mesh(new THREE.SphereGeometry(.5, 20, 14), fur); chest.position.set(0, 1.12, -.6); g.add(chest);
      const hd = new THREE.Group(); hd.position.set(0, 1.4, -1.05); g.add(hd); const h = new THREE.Mesh(new THREE.SphereGeometry(.32, 20, 14), fur); h.scale.set(1, .95, 1.05); hd.add(h);
      const mz = new THREE.Mesh(new THREE.SphereGeometry(.17, 14, 10), std(0xe0b880)); mz.scale.set(1.1, .8, 1); mz.position.set(0, -.08, -.26); hd.add(mz); const nose = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), std(0x3a2018)); nose.position.set(0, -.02, -.42); hd.add(nose);
      for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(.08, 10, 8), fur); ear.position.set(s * .22, .25, .02); hd.add(ear); }
      eyes(hd, .12, .08, -.26, .035);
      if (kind === 'lion') for (let k = 0; k < 34; k++) { const a = k / 34 * Math.PI * 2, r = .36 + Math.random() * .08, tuft = new THREE.Mesh(new THREE.SphereGeometry(.15 + Math.random() * .06, 10, 8), maneM); tuft.position.set(Math.cos(a) * r, Math.sin(a) * r * .95 - .02, .1 + Math.random() * .12); hd.add(tuft); }
      const tl = new THREE.Group(); tl.position.set(0, 1.15, .95); g.add(tl); const tlc = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, .95, 8), fur); tlc.position.set(0, -.3, .3); tlc.rotation.x = .9; tl.add(tlc); const tuftT = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), maneM); tuftT.position.set(0, -.62, .66); tl.add(tuftT); A.tail = tl;
      A.legs = [[-.24, .85, -.6], [.24, .85, -.6], [-.24, .85, .55], [.24, .85, .55]].map(([x, y, z]) => limb(g, x, y, z, .85, .1, fur, std(0xc0904a))); A.speed = 1.2; }
    if (kind === 'penguin') { const blk = std(0x14171c, { roughness: .5 }), wht = std(0xf6f6f2, { roughness: .5 }), yel = std(0xffb81f, { roughness: .5 });
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .38, 10, 20), blk); b.position.y = .45; g.add(b); const bel = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .32, 10, 20), wht); bel.position.set(0, .43, -.06); bel.scale.z = .8; g.add(bel);
      const h = new THREE.Mesh(new THREE.SphereGeometry(.15, 16, 12), blk); h.position.set(0, .88, -.02); g.add(h); for (const s of [-1, 1]) { const pt = new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), yel); pt.scale.set(.6, 1.2, .6); pt.position.set(s * .12, .8, -.06); g.add(pt); }
      const bk = new THREE.Mesh(new THREE.ConeGeometry(.035, .16, 8), std(0x2a2a2a)); bk.rotation.x = -Math.PI / 2 - .2; bk.position.set(0, .86, -.2); g.add(bk); const bks = new THREE.Mesh(new THREE.BoxGeometry(.03, .015, .09), yel); bks.position.set(0, .84, -.17); g.add(bks); eyes(g, .07, .92, -.12, .02);
      A.flip = [-1, 1].map(s => { const f = new THREE.Mesh(new THREE.CapsuleGeometry(.04, .28, 4, 8), blk); f.position.set(s * .22, .5, 0); f.rotation.z = s * .25; g.add(f); return f; });
      for (const s of [-1, 1]) { const ft = new THREE.Mesh(new THREE.BoxGeometry(.1, .03, .14), std(0x3a2a20)); ft.position.set(s * .08, .02, -.05); g.add(ft); } A.speed = .5; A.waddle = true; }
    if (kind === 'monkey') { const fur = std(0x5a3a1e, { roughness: .9 }), skin = std(0xd9a880, { roughness: .7 });
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .25, 8, 16), fur); b.position.y = .55; b.rotation.x = .25; g.add(b);
      const h = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 12), fur); h.position.set(0, .9, -.08); g.add(h); const face = new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 10), skin); face.scale.set(1, .9, .55); face.position.set(0, .88, -.18); g.add(face); eyes(g, .05, .92, -.23, .022);
      for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), skin); ear.position.set(s * .16, .92, -.05); g.add(ear); }
      const tc = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .45, .15), new THREE.Vector3(0, .35, .5), new THREE.Vector3(0, .7, .7), new THREE.Vector3(0, .85, .5)]); g.add(new THREE.Mesh(new THREE.TubeGeometry(tc, 16, .025, 6), fur));
      A.legs = [[-.18, .72, -.05], [.18, .72, -.05], [-.1, .38, .05], [.1, .38, .05]].map(([x, y, z], i) => limb(g, x, y, z, i < 2 ? .55 : .42, .045, fur, skin)); A.speed = 1.6; A.hop = true; }
    if (kind === 'flamingo') { const pk = std(0xff8ab0, { roughness: .6 }), dk = std(0xe0507a, { roughness: .6 });
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), pk); b.scale.set(.2, .19, .36); b.position.y = 1.15; g.add(b); const wg = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), dk); wg.scale.set(.21, .12, .3); wg.position.set(0, 1.2, .06); g.add(wg);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.2, -.3), new THREE.Vector3(0, 1.55, -.42), new THREE.Vector3(0, 1.75, -.22), new THREE.Vector3(0, 1.95, -.38)]); g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, .035, 8), pk));
      const h = new THREE.Mesh(new THREE.SphereGeometry(.065, 12, 10), pk); h.position.set(0, 1.97, -.43); g.add(h); const bk = new THREE.Mesh(new THREE.ConeGeometry(.028, .15, 8), std(0x1a1a1a)); bk.rotation.x = -2.3; bk.position.set(0, 1.92, -.53); g.add(bk);
      A.legs = [limb(g, -.04, 1.05, 0, 1.05, .016, std(0xff6a96), null), limb(g, .04, 1.05, 0, 1.05, .016, std(0xff6a96), null)]; A.legs[1].rotation.x = -.6; A.legs[1].knee.rotation.x = 2.2; A.speed = .5; A.oneLeg = true; }
    (BG || scene).add(g); return A;
  }
  function addAnimal(kind, pen, n) { const [a, b, c, d] = PENS[pen]; for (let i = 0; i < n; i++) { const A = animal(kind); A.box = [a + 2.5, b + 2.5, c - 2.5, d - 2.5]; A.x = a + 3 + Math.random() * (c - a - 6); A.z = b + 3 + Math.random() * (d - b - 6); A.tx = A.x; A.tz = A.z; A.yaw = Math.random() * 6; A.wait = Math.random() * 4; A.ph = Math.random() * 6; zooAnimals.push(A); } }
  function fence(a, b, c, d, low) { // une clôture en bois arrondie (ou un muret en verre pour les pingouins)
    const pts = []; for (let x = a; x <= c + .01; x += 2.5) pts.push([x, b], [x, d]); for (let z = b + 2.5; z < d; z += 2.5) pts.push([a, z], [c, z]);
    const wood = std(0x7a5232, { roughness: .85 });
    if (!low) { const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(.09, .11, 1.4, 10), wood, pts.length), caps = new THREE.InstancedMesh(new THREE.SphereGeometry(.11, 10, 8), wood, pts.length), q = new THREE.Object3D(); pts.forEach(([x, z], i) => { q.position.set(x, .7, z); q.updateMatrix(); posts.setMatrixAt(i, q.matrix); q.position.y = 1.4; q.updateMatrix(); caps.setMatrixAt(i, q.matrix); }); BG.add(posts, caps); }
    const railM = low ? new THREE.MeshPhysicalMaterial({ color: 0xcfeeff, transparent: true, opacity: .25, roughness: .02, depthWrite: false }) : wood;
    const rail = (x1, z1, x2, z2, y) => { const L = Math.hypot(x2 - x1, z2 - z1), m = low ? new THREE.Mesh(new THREE.BoxGeometry(L, 1, .05), railM) : new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, L, 8), railM); m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); if (!low) m.rotation.z = Math.PI / 2; m.rotation.y = -Math.atan2(z2 - z1, x2 - x1); BG.add(m); };
    for (const y of low ? [.55] : [.55, 1.15]) { rail(a, b, c, b, y); rail(a, d, c, d, y); rail(a, b, a, d, y); rail(c, b, c, d, y); }
    if (low) { const top = std(0x9aa4ae, { metalness: .8, roughness: .2 }); for (const [x1, z1, x2, z2] of [[a, b, c, b], [a, d, c, d], [a, b, a, d], [c, b, c, d]]) { const L = Math.hypot(x2 - x1, z2 - z1), m = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, L, 8), top); m.rotation.z = Math.PI / 2; m.rotation.y = -Math.atan2(z2 - z1, x2 - x1); m.position.set((x1 + x2) / 2, 1.06, (z1 + z2) / 2); BG.add(m); } }
  }
  let leafMs0 = null; const leafMs = new Proxy([], { get: (t, k) => { if (!leafMs0) leafMs0 = [0x2f6a2a, 0x3a7a30, 0x4a8a36, 0x285a26].map(c => std(c, { roughness: .9 })); return leafMs0[k]; } }); // créés seulement quand la 3D est prête
  function tree(x, z, acacia, s = 1) { // un arbre avec un tronc qui se divise et un feuillage en touffes
    const bark = std(0x5a3a20, { roughness: 1 }); const t = new THREE.Mesh(new THREE.CylinderGeometry(.18 * s, .32 * s, 3.2 * s, 10), bark); t.position.set(x, 1.6 * s, z); BG.add(t); const sh = blob(3.5 * s, 3.5 * s); sh.position.set(x, .03, z); BG.add(sh);
    if (acacia) { for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2, br = new THREE.Mesh(new THREE.CylinderGeometry(.07 * s, .12 * s, 1.6 * s, 8), bark); br.position.set(x + Math.cos(a) * .45 * s, 3.6 * s, z + Math.sin(a) * .45 * s); br.rotation.set(Math.sin(a) * .6, 0, -Math.cos(a) * .6); BG.add(br); }
      for (let k = 0; k < 7; k++) { const a = Math.random() * 6.28, r = Math.random() * 1.6 * s, c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 1), leafMs[k % 4]); c.scale.set(1.4, .35, 1.4); c.position.set(x + Math.cos(a) * r, (4.2 + Math.random() * .3) * s, z + Math.sin(a) * r); BG.add(c); } }
    else for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, c = new THREE.Mesh(new THREE.IcosahedronGeometry((1 + Math.random() * .4) * s, 1), leafMs[k % 4]); c.position.set(x + Math.cos(a) * .8 * s, (3.6 + Math.random() * 1.2) * s, z + Math.sin(a) * .8 * s); BG.add(c); }
  }
  function rock(x, z, s, col = 0x8a8072) { const g = new THREE.IcosahedronGeometry(s, 3), P = g.attributes.position; const sd = Math.random() * 10; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), zz = P.getZ(i), k = 1 + (Math.sin(x * 2.1 + sd) * Math.cos(zz * 1.7 + sd) + Math.sin(y * 3.3 + sd * 2)) * .12; P.setXYZ(i, x * k, y * k * .7, zz * k); } g.computeVertexNormals(); /* une roche bosselée et douce */ const m = new THREE.Mesh(g, std(col, { roughness: .95 })); m.position.set(x, s * .25, z); m.rotation.y = Math.random() * 6; BG.add(m); return m; }
  function water(x, z, rx, rz, col = 0x2a7ab8) { const w = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshPhysicalMaterial({ color: col, roughness: .04, metalness: .1, clearcoat: 1, transparent: true, opacity: .9 })); w.scale.set(rx, rz, 1); w.rotation.x = -Math.PI / 2; w.position.set(x, .05, z); BG.add(w); const rim = new THREE.Mesh(new THREE.RingGeometry(.96, 1.12, 48), std(0x6a5a3a, { roughness: 1 })); rim.scale.set(rx, rz, 1); rim.rotation.x = -Math.PI / 2; rim.position.set(x, .045, z); BG.add(rim); return w; }
  function infoPanel(x, z, ry, title) { const [c, g] = cnv(512, 256); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2f5a22'); gr.addColorStop(1, '#1e3a16'); g.fillStyle = gr; g.beginPath(); g.roundRect?.(0, 0, 512, 256, 30); g.fill(); g.strokeStyle = '#f2d28a'; g.lineWidth = 8; g.beginPath(); g.roundRect?.(8, 8, 496, 240, 24); g.stroke(); g.fillStyle = '#fff'; g.font = '900 54px Outfit, Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(title, 256, 128, 470);
    const G = new THREE.Group(); G.position.set(x, 0, z); G.rotation.y = ry; BG.add(G); const p = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshStandardMaterial({ map: tex(c), roughness: .6 })); p.position.y = 1.6; G.add(p); for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, 2.2, 10), std(0x5a3a1a)); l.position.set(s * 1, 1.1, -.05); G.add(l); } }
  let zooSun = null, zooSky = null, zooEnv = null, glbFlyers = [];
  function buildZoo() {
    BG = ZG.zoo = new THREE.Group(); scene.add(BG); BG.visible = false; zooAnimals.length = 0; glbFlyers = []; const ZOOG = BG; // pour les animaux qui arrivent après (chargement)
    const { x0, x1, z0, z1 } = ZO, MX = (x0 + x1) / 2, MZ = (z0 + z1) / 2;
    // le ciel photo (le même que la Ville) et un dôme de secours en attendant
    const [sc, sg] = cnv(32, 256); const gr = sg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#3a82d8'); gr.addColorStop(.55, '#a8d4f4'); gr.addColorStop(1, '#eef6ff'); sg.fillStyle = gr; sg.fillRect(0, 0, 32, 256);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(170, 24, 16), new THREE.MeshBasicMaterial({ map: tex(sc), side: THREE.BackSide, fog: false })); dome.position.set(MX, 0, MZ); BG.add(dome);
    new K.LIB.RGBELoader().loadAsync('/city3d/sky.hdr').then(t => { t.mapping = THREE.EquirectangularReflectionMapping; zooSky = t; const pm = new THREE.PMREMGenerator(R); zooEnv = pm.fromEquirectangular(t).texture; pm.dispose(); dome.visible = false; if (me.zone === 'zoo') { scene.background = zooSky; scene.environment = zooEnv; } }).catch(() => {});
    // l'herbe en photo, et des collines tout autour
    const gT = new THREE.TextureLoader().load('/city3d/grass.jpg', t => { t.needsUpdate = true; }); gT.colorSpace = THREE.SRGBColorSpace; gT.wrapS = gT.wrapT = THREE.RepeatWrapping; gT.repeat.set(60, 60); gT.anisotropy = 8;
    addPlane(320, 320, new THREE.MeshStandardMaterial({ map: gT, roughness: 1, color: 0xb8d8a0 }), MX, -.01, MZ, 0, -Math.PI / 2);
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, r = 95 + Math.random() * 15, hl = new THREE.Mesh(new THREE.SphereGeometry(30 + Math.random() * 20, 24, 12), new THREE.MeshStandardMaterial({ map: gT, color: 0x8ab878, roughness: 1 })); hl.scale.y = .25 + Math.random() * .15; hl.position.set(MX + Math.cos(a) * r, -4, MZ + Math.sin(a) * r); BG.add(hl); }
    // une forêt autour du zoo
    const trunkI = new THREE.InstancedMesh(new THREE.CylinderGeometry(.25, .4, 4, 8), std(0x4a3018, { roughness: 1 }), 120), crownI = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.4, 1), std(0x2a5a26, { roughness: .9 }), 240), q = new THREE.Object3D(); let ti = 0, ci = 0;
    for (let k = 0; k < 120; k++) { const side = k % 4, f = Math.random(); const [x, z] = side === 0 ? [x0 - 6 - Math.random() * 14, z0 + f * (z1 - z0)] : side === 1 ? [x1 + 6 + Math.random() * 14, z0 + f * (z1 - z0)] : side === 2 ? [x0 + f * (x1 - x0), z0 - 6 - Math.random() * 14] : [x0 + f * (x1 - x0), z1 + 8 + Math.random() * 14]; const s = .8 + Math.random() * .6;
      q.position.set(x, 2 * s, z); q.scale.setScalar(s); q.rotation.set(0, 0, 0); q.updateMatrix(); trunkI.setMatrixAt(ti++, q.matrix); for (let j = 0; j < 2; j++) { q.position.set(x + (Math.random() - .5), (4.6 + j * 1.6) * s, z + (Math.random() - .5)); q.scale.setScalar(s * (1 - j * .25)); q.rotation.set(Math.random(), Math.random(), 0); q.updateMatrix(); crownI.setMatrixAt(ci++, q.matrix); } }
    BG.add(trunkI, crownI);
    // les allées pavées avec une bordure
    const pathT = (() => { const [c, g] = cnv(256, 256); g.fillStyle = '#d8c49a'; g.fillRect(0, 0, 256, 256); for (let k = 0; k < 3000; k++) { g.fillStyle = `rgba(${Math.random() < .5 ? '160,130,90' : '240,225,190'},${Math.random() * .4})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } return tex(c, [3, 20]); })();
    const pathM = std(0xffffff, { map: pathT, roughness: .95 }), curb = std(0xb0a48a, { roughness: .8 });
    addPlane(6, z1 - z0, pathM, MX, .015, MZ, 0, -Math.PI / 2); const pm2 = pathM.clone(); pm2.map = pathT.clone(); pm2.map.repeat.set(20, 3); pm2.map.needsUpdate = true; addPlane(x1 - x0, 6, pm2, MX, .016, 0, 0, -Math.PI / 2); addPlane(x1 - x0, 8, pm2, MX, .014, 30, 0, -Math.PI / 2);
    for (const s of [-1, 1]) { addBox(.25, .12, z1 - z0, curb, MX + s * 3.1, .06, MZ); addBox(x1 - x0, .12, .25, curb, MX, .06, s * 3.1); }
    // 🦒 la savane : herbe sèche, acacias, rochers, termitière, point d'eau
    const sv = PENS.savane, dryM = new THREE.MeshStandardMaterial({ map: gT, color: 0xe8c88a, roughness: 1 }); addPlane(sv[2] - sv[0], sv[3] - sv[1], dryM, (sv[0] + sv[2]) / 2, .02, (sv[1] + sv[3]) / 2, 0, -Math.PI / 2);
    water(232, -28, 5, 3.6, 0x3a7aa0); for (const [x, z] of [[230, -12], [247, -31], [250, -14], [236, -35], [244, -22]]) tree(x, z, true, 1.25);
    for (let k = 0; k < 7; k++) rock(sv[0] + 3 + Math.random() * 24, sv[1] + 3 + Math.random() * 25, .6 + Math.random() * .9, 0xa08a6a);
    const mound = new THREE.Mesh(new THREE.ConeGeometry(1, 2.6, 10), std(0xa0703a, { roughness: 1, flatShading: true })); mound.position.set(252, 1.3, -33); BG.add(mound);
    fence(...sv); addAnimal('giraffe', 'savane', 3); addAnimal('elephant', 'savane', 2);
    // 🦁 les lions : le grand rocher, de l'herbe haute
    const li = PENS.lions; addPlane(li[2] - li[0], li[3] - li[1], dryM, (li[0] + li[2]) / 2, .02, (li[1] + li[3]) / 2, 0, -Math.PI / 2); fence(...li);
    const pr = rock(282, -30, 4.2, 0x8a7458); pr.scale.y = 1.25; for (let k = 0; k < 5; k++) rock(li[0] + 4 + Math.random() * 23, li[1] + 3 + Math.random() * 13, .8 + Math.random() * 1.2, 0xa8927a);
    // (pas de touffes d'herbe : l'herbe sèche suffit)
    tree(270, -34, true, 1.1); addAnimal('lion', 'lions', 1); addAnimal('lioness', 'lions', 2);
    // 🐒 l'île des singes : de l'eau tout autour, un grand arbre, des cordes et des plateformes
    const si = PENS.singes; fence(...si); const moat = new THREE.Mesh(new THREE.PlaneGeometry(si[2] - si[0] - .6, si[3] - si[1] - .6), new THREE.MeshPhysicalMaterial({ color: 0x2a6a98, roughness: .03, clearcoat: 1 })); moat.rotation.x = -Math.PI / 2; moat.position.set((si[0] + si[2]) / 2, .04, (si[1] + si[3]) / 2); BG.add(moat);
    const isl = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.4, .7, 32), new THREE.MeshStandardMaterial({ map: gT, color: 0x9ac07a, roughness: 1 })); isl.position.set(280.5, .35, -10.5); BG.add(isl); tree(280.5, -10.5, false, 1.5);
    const wood = std(0x8a6a3a, { roughness: .8 }); for (const [x, y] of [[277.2, 2.2], [283.8, 3.2]]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(.95, .95, .14, 16), wood); pl.position.set(x, y, -10.5); BG.add(pl); const po = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, y, 8), std(0x5a3a1a)); po.position.set(x, y / 2, -10.5); BG.add(po); }
    for (const [a, b] of [[[277.2, 2.2, -10.5], [280.5, 4.2, -10.2]], [[283.8, 3.2, -10.5], [280.5, 4.6, -10.8]], [[277.2, 2.2, -10.5], [283.8, 3.2, -10.5]]]) { const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...a), new THREE.Vector3((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - .8, (a[2] + b[2]) / 2), new THREE.Vector3(...b)); BG.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, .035, 6), std(0xc8a870))); }
    addAnimal('monkey', 'singes', 6); zooAnimals.filter(a => a.kind === 'monkey').forEach(a => { a.box = [276.5, -13.5, 284.5, -7.5]; a.x = 278 + Math.random() * 5; a.z = -12 + Math.random() * 3; a.base = .7; });
    // 🐧 la banquise : neige, rochers de glace, bassin d'eau glacée
    const pg = PENS.pingouins; fence(...pg, true); addPlane(pg[2] - pg[0], pg[3] - pg[1], std(0xf2f8ff, { roughness: .5 }), (pg[0] + pg[2]) / 2, .025, (pg[1] + pg[3]) / 2, 0, -Math.PI / 2);
    water(246, 15, 6.5, 4.5, 0x1a7ac8); for (let k = 0; k < 8; k++) rock(pg[0] + 2 + Math.random() * 13, pg[1] + 2 + Math.random() * 13, .5 + Math.random() * .9, 0xdcecff);
    const iceberg = rock(250, 9, 2.2, 0xe4f2ff); iceberg.scale.y = 1.2;
    addAnimal('penguin', 'pingouins', 12); zooAnimals.filter(a => a.kind === 'penguin').forEach(a => { a.box = [227, 8, 239, 20]; a.x = 228 + Math.random() * 10; a.z = 9 + Math.random() * 10; });
    // 🦩 les flamants roses : un lagon et des roseaux
    const fl = PENS.flamants; fence(...fl); water(280.5, 14, 8, 5.5, 0x4a9ab8);
    const reedI = new THREE.InstancedMesh(new THREE.CylinderGeometry(.015, .025, 1.4, 4), std(0x6a8a2a), 70); for (let k = 0; k < 70; k++) { const a = Math.random() * 6.28, r = 1.02 + Math.random() * .12; q.position.set(280.5 + Math.cos(a) * 8 * r, .7, 14 + Math.sin(a) * 5.5 * r); q.rotation.set((Math.random() - .5) * .3, 0, (Math.random() - .5) * .3); q.updateMatrix(); reedI.setMatrixAt(k, q.matrix); } BG.add(reedI);
    addAnimal('flamingo', 'flamants', 8); zooAnimals.filter(a => a.kind === 'flamingo').forEach(a => { a.box = [274, 10, 287, 18]; a.x = 275 + Math.random() * 11; a.z = 10.5 + Math.random() * 7; });
    // les panneaux, l'entrée, le kiosque, la boutique, les bancs, les lampadaires, des arbres
    infoPanel(256.5, -10, Math.PI / 2, '🦒 La savane'); infoPanel(263.5, -22, -Math.PI / 2, '🦁 Les lions'); infoPanel(263.5, -10.5, -Math.PI / 2, '🐒 L\'île des singes'); infoPanel(256.5, 14, Math.PI / 2, '🐧 La banquise'); infoPanel(263.5, 14, -Math.PI / 2, '🦩 Les flamants');
    const gate = new THREE.Group(); gate.position.set(MX, 0, 37.5); BG.add(gate); const stone = std(0xb8a888, { roughness: .9 });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new LIB2.RoundedBoxGeometry(1.2, 5.6, 1.2, 3, .15), stone); p.position.set(s * 4.4, 2.8, 0); gate.add(p); const top = new THREE.Mesh(new THREE.SphereGeometry(.55, 16, 12), std(0x3a7a2a)); top.position.set(s * 4.4, 6, 0); gate.add(top); }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(4.4, .35, 10, 40, Math.PI), std(0x2f6a22, { roughness: .6 })); arch.position.y = 5.5; gate.add(arch);
    const gs = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 1.1), (() => { const [c, g] = cnv(1024, 150); g.fillStyle = '#2f6a22'; g.beginPath(); g.roundRect?.(0, 0, 1024, 150, 40); g.fill(); g.fillStyle = '#ffe08a'; g.font = '900 100px Outfit, Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🦁 PARADISE ZOO 🦒', 512, 80, 980); return new THREE.MeshStandardMaterial({ map: tex(c), roughness: .6 }); })()); gs.position.set(0, 7, -.36); gs.rotation.y = Math.PI; gate.add(gs);
    const kiosk = (x, z, label, col) => { const g = new THREE.Group(); g.position.set(x, 0, z); BG.add(g); const b = new THREE.Mesh(new LIB2.RoundedBoxGeometry(4, 2.6, 3, 3, .2), std(0xfff4e8, { roughness: .6 })); b.position.y = 1.3; g.add(b); const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.4, 4), std(new THREE.Color(col).getHex(), { roughness: .5 })); roof.rotation.y = Math.PI / 4; roof.position.y = 3.3; g.add(roof); const sgn = new THREE.Mesh(new THREE.PlaneGeometry(3.6, .6), neon(label, col, 512, 100)); sgn.position.set(0, 2.2, -1.52); sgn.rotation.y = Math.PI; g.add(sgn); };
    kiosk(235, 31, '🍦 GLACES', '#ff7ad9'); kiosk(285, 31, '🎁 SOUVENIRS', '#2bff88'); zooBoxes.push([233, 29.5, 237, 32.5], [283, 29.5, 287, 32.5]);
    for (const [x, z] of [[252, 27], [268, 27], [252, 33], [268, 33]]) { const b = new THREE.Mesh(new LIB2.RoundedBoxGeometry(2.2, .14, .6, 2, .05), std(0x8a5a32)); b.position.set(x, .45, z); BG.add(b); const bk = new THREE.Mesh(new LIB2.RoundedBoxGeometry(2.2, .5, .1, 2, .04), std(0x8a5a32)); bk.position.set(x, .75, z + .28); BG.add(bk); for (const s of [-1, 1]) addBox(.08, .45, .5, std(0x222222, { metalness: .6 }), x + s * .95, .22, z); zooBoxes.push([x - 1.1, z - .3, x + 1.1, z + .3]); }
    for (let z = 34; z > -36; z -= 10) for (const s of [-1, 1]) { const x = MX + s * 3.5; const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, 3.6, 8), std(0x2a3a22, { metalness: .5 })); p.position.set(x, 1.8, z); BG.add(p); const l = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff0c0, emissiveIntensity: .6 })); l.position.set(x, 3.65, z); BG.add(l); }
    for (const [x, z] of [[226, 30], [296, 30], [226, 0], [296, 0], [244, 2.5], [276, 2.5], [244, -3], [276, -3]]) { tree(x, z, false, 1); zooBoxes.push([x - .5, z - .5, x + .5, z + .5]); }
    zooSun = new THREE.DirectionalLight(0xfff0d8, 0); zooSun.position.set(MX + 40, 70, MZ + 30); zooSun.target.position.set(MX, 0, MZ); scene.add(zooSun, zooSun.target);
    // 🦓 les vrais animaux animés : des zèbres (cheval rayé), et des oiseaux qui volent (flamants, perroquets, cigognes)
    const gl = new K.LIB.GLTFLoader(), zebraMat = M0 => { const m = new THREE.MeshStandardMaterial({ vertexColors: false, roughness: .7, color: 0xffffff, flatShading: true }); /* le modèle n'a pas de normales : on les calcule par facette */
      m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vZP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvZP = transformed;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vZP;').replace('#include <color_fragment>', '#include <color_fragment>\nfloat zs = vZP.y < 95.0 ? sin(vZP.y * .16) : sin(vZP.z * .09 + sin(vZP.y * .05) * 2.5 + vZP.x * .02);\nfloat zb = smoothstep(-.15, .15, zs);\ndiffuseColor.rgb *= mix(vec3(.06), vec3(.96), zb);'); }; return m; };
    const loadFly = (file, n, opts) => gl.loadAsync('/city3d/' + file).then(G => { for (let i = 0; i < n; i++) { const s = G.scene.clone(true), mx = new THREE.AnimationMixer(s); s.traverse(o => { if (o.isMesh) o.material = o.material.clone(); }); const act = mx.clipAction(G.animations[0]); act.play(); act.time = Math.random() * 2; s.scale.setScalar(opts.scale); ZOOG.add(s); glbFlyers.push({ s, mx, i, n, ...opts }); } }).catch(e => console.warn('zoo glb', e));
    gl.loadAsync('/city3d/horse.glb').then(G => { const [a, b, c, d] = PENS.savane; for (let i = 0; i < 5; i++) { const s = G.scene.clone(true); s.traverse(o => { if (o.isMesh) o.material = zebraMat(o.material); }); s.scale.setScalar(.0078); const mx = new THREE.AnimationMixer(s), act = mx.clipAction(G.animations[0]); act.play(); act.time = Math.random(); const g = new THREE.Group(); g.add(s); g.add(blob(1.4, 2.6)); ZOOG.add(g);
      zooAnimals.push({ g, kind: 'zebra', legs: [], mixer: mx, act, box: [a + 3, b + 3, c - 3, d - 3], x: a + 4 + Math.random() * 22, z: b + 4 + Math.random() * 22, tx: 0, tz: 0, yaw: Math.random() * 6, wait: Math.random() * 3, ph: 0, speed: 1.4 }); } zooAnimals.filter(z => z.kind === 'zebra').forEach(z => { z.tx = z.x; z.tz = z.z; }); }).catch(e => console.warn('zebra', e));
    loadFly('flamingo.glb', 4, { scale: .028, cx: 280.5, cz: 14, r: 9, h: 6, sp: .25 }); loadFly('parrot.glb', 3, { scale: .008, cx: MX, cz: -5, r: 28, h: 14, sp: .18 }); loadFly('stork.glb', 2, { scale: .011, cx: MX, cz: 5, r: 40, h: 22, sp: .1 });
    // tout le monde bouge : les animaux se promènent dans leur enclos, les oiseaux tournent dans le ciel
    anims.push((dt, t) => { if (me.zone !== 'zoo') return;
      for (const A of zooAnimals) {
        if (A.wait > 0) { A.wait -= dt; } else { const dx = A.tx - A.x, dz = A.tz - A.z, d = Math.hypot(dx, dz);
          if (d < .3) { A.wait = 2 + Math.random() * 6; const [a, b, c, e] = A.box; A.tx = a + Math.random() * (c - a); A.tz = b + Math.random() * (e - b); }
          else { const s = Math.min(d, A.speed * dt); A.x += dx / d * s; A.z += dz / d * s; const want = Math.atan2(-dx, -dz); let da = ((want - A.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; A.yaw += da * Math.min(1, dt * 3); A.ph += dt * A.speed * 5; } }
        const moving = A.wait <= 0, sw = moving ? Math.sin(A.ph) : 0;
        A.g.position.set(A.x, (A.base || 0) + (A.hop && moving ? Math.abs(Math.sin(A.ph)) * .35 : 0), A.z); A.g.rotation.y = A.yaw + (A.kind === 'zebra' ? Math.PI : 0); A.g.rotation.z = A.waddle && moving ? Math.sin(A.ph * 1.5) * .15 : 0;
        if (A.mixer) { A.act.timeScale = moving ? .55 : 0; A.mixer.update(dt); continue; }
        A.legs.forEach((l, i) => { if (A.oneLeg && i === 1) return; const ph = sw * (i % 2 === (i < 2 ? 0 : 1) ? .45 : -.45); l.rotation.x = ph; if (l.knee) l.knee.rotation.x = Math.max(0, -ph) * 1.1; });
        if (A.trunk) A.trunk.forEach((s, k) => { s.rotation.x = Math.sin(t * 1.2 + A.ph * .2 + k * .3) * .12 + (k ? .1 : 0); });
        if (A.ears) A.ears.forEach((e, k) => { e.rotation.y = (k ? 1 : -1) * (.4 + Math.sin(t * 2 + A.ph) * .2); });
        if (A.neck) A.neck.rotation.x = -.38 + Math.sin(t * .8 + A.ph * .3) * .07;
        if (A.tail) A.tail.rotation.z = Math.sin(t * 2 + A.ph) * .4;
        if (A.flip) A.flip.forEach((f, k) => { f.rotation.z = (k ? 1 : -1) * (.25 + (moving ? Math.abs(Math.sin(A.ph * 1.5)) * .5 : 0)); });
      }
      for (const F of glbFlyers) { const a = t * F.sp + F.i / F.n * Math.PI * 2; F.s.position.set(F.cx + Math.cos(a) * F.r, F.h + Math.sin(t * .7 + F.i) * 1.5, F.cz + Math.sin(a) * F.r * .8); F.s.rotation.y = -a; F.mx.update(dt); }
    });
    BG = null;
  }
  const ZOO_INFO = {
    savane: ['🦒 La savane', ['La girafe est l\'animal le plus grand du monde : jusqu\'à 5,5 m !', 'Chaque zèbre a des rayures uniques, comme nos empreintes digitales.', 'L\'éléphant d\'Afrique peut peser 6 tonnes et boire 200 litres d\'eau par jour.']],
    lions: ['🦁 Les lions', ['Le rugissement d\'un lion s\'entend jusqu\'à 8 km !', 'Ce sont surtout les lionnes qui chassent pour le groupe.', 'Un lion dort jusqu\'à 20 heures par jour.']],
    singes: ['🐒 L\'île des singes', ['Les singes utilisent leur queue comme une cinquième main.', 'Ils communiquent avec des cris, des grimaces et des gestes.']],
    pingouins: ['🐧 La banquise', ['Les manchots ne volent pas, mais nagent jusqu\'à 35 km/h !', 'Ils se serrent les uns contre les autres pour avoir chaud.']],
    flamants: ['🦩 Les flamants roses', ['Ils sont roses grâce aux petites crevettes qu\'ils mangent.', 'Ils dorment souvent sur une seule patte.']] };
  function zooInfo(k) { const [t, L] = ZOO_INFO[k]; showPanel(el('h3', {}, t), el('ul', { class: 'cs-rules' }, ...L.map(x => el('li', {}, x)))); }
  function aquaInfo(k) {
    const D = { bassin: ['🦈 Le grand bassin', ['Des requins, des raies, une tortue de mer et des bancs de poissons de toutes les couleurs.', 'Passe dans le tunnel de verre : les poissons nagent au-dessus de ta tête !', 'Les requins n\'ont pas d\'os : leur squelette est en cartilage.']],
      meduses: ['🪼 Les méduses', ['Les méduses sont composées à 95 % d\'eau.', 'Elles existent depuis plus de 500 millions d\'années, bien avant les dinosaures !', 'Certaines brillent dans le noir : c\'est la bioluminescence.']] }[k];
    showPanel(el('h3', {}, D[0]), el('ul', { class: 'cs-rules' }, ...D[1].map(x => el('li', {}, x)))); }

  // ---------- 🎡 Paradise Fête Foraine : grande roue, carrousel, montagnes russes, chaises volantes, tour de chute, auto-tamponneuses ----------
  // Les manèges tournent tous en même temps pour tout le monde (ils suivent l'horloge) ; on monte dedans et on voit par ses yeux.
  const FR = { x0: 330, x1: 410, z0: -40, z1: 40, LED: 5 };
  const fairBoxes = [[340, -25.5, 356, -18.5], [340.5, 10.5, 355.5, 25.5], [378, -38, 408, -8.6], [384.5, 10.5, 399.5, 25.5], [392.5, 2.5, 397.5, 7.5], [335, -12.6, 359, -3.4], [364, -40, 376, -34.5]];
  function fairFits(x, z) { return x > 330.5 && x < 409.5 && z > -39.5 && z < 39.5 && !fairBoxes.some(([a, b, c, d]) => x > a - RAD && x < c + RAD && z > b - RAD && z < d + RAD); }
  const clock = () => Date.now() / 1000; // la même heure pour tout le monde
  let bulbs = null, bulbN = 0, bulbHue = [];
  function bulbLine(pts) { for (const [x, y, z] of pts) { bulbHue.push([x, y, z, Math.random()]); } }
  function festoon(a, b, n, sag) { const P = []; for (let i = 0; i <= n; i++) { const t = i / n; P.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t]); } bulbLine(P); const g = new THREE.BufferGeometry().setFromPoints(P.map(p => new THREE.Vector3(...p))); BG.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x222222 }))); }
  function stripes(c1, c2) { const [c, g] = cnv(128, 32); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(i * 16, 0, 16, 32); } return tex(c); }
  function stall(x, z, ry, name, col, deco) {
    const G = new THREE.Group(); G.position.set(x, 0, z); G.rotation.y = ry; BG.add(G);
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 2), std(0xf4ecd8, { roughness: .6 })); body.position.y = .55; G.add(body);
    for (const sx of [-1.9, 1.9]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 2.8), std(0xd42020)); p.position.set(sx, 1.4, .9); G.add(p); const p2 = p.clone(); p2.position.z = -.9; G.add(p2); }
    const aw = new THREE.Mesh(new THREE.BoxGeometry(4.4, .12, 2.6), new THREE.MeshStandardMaterial({ map: stripes(col, '#ffffff'), roughness: .7 })); aw.position.set(0, 2.85, .1); aw.rotation.x = .12; G.add(aw);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.8, .7), neon(name, col, 1024, 96)); sg.position.set(0, 3.3, 1.35); G.add(sg);
    if (deco) deco(G); G.updateMatrixWorld(true);
    for (let i = 0; i <= 8; i++) { const v = new THREE.Vector3(-2.1 + i * .525, 2.75, 1.4); G.localToWorld(v); bulbHue.push([v.x, v.y, v.z, Math.random()]); }
  }
  const coaster = { curve: null, S: [], T: [], L: 0, lap: 0, pts: [] };
  function buildCoasterTrack() {
    const P = [[383, 1.5, -9], [391, 1.5, -9], [398, 6, -9.5], [403, 16, -12], [405, 20, -16], [405, 18, -20], [404, 3, -27], [400, 4, -35], [392, 10, -36], [385, 13, -33], [381, 6, -27], [383, 2.5, -21], [388, 7, -18], [386, 10, -14], [381, 4, -12], [379, 2, -10]];
    const curve = new THREE.CatmullRomCurve3(P.map(p => new THREE.Vector3(...p)), true, 'catmullrom', .5); coaster.curve = curve;
    const N = 900, pts = curve.getSpacedPoints(N); coaster.pts = pts; coaster.L = curve.getLength();
    // la vitesse à chaque endroit : la chaîne tire le train jusqu'en haut, puis il descend en prenant de la vitesse
    const ds = coaster.L / N; let t = 0; const topIdx = pts.reduce((b, p, i) => (p.y > pts[b].y ? i : b), 0);
    for (let i = 0; i <= N; i++) { const p = pts[i % N]; let v; if (i <= topIdx && i > 8) v = 3.5; else if (p.y < 1.8 && (i < 30 || i > N - 40)) v = 4; else v = Math.max(4, Math.sqrt(3.5 * 3.5 + 2 * 9.81 * Math.max(0, 20 - p.y)) * .93); coaster.S.push(i * ds); coaster.T.push(t); t += ds / v; }
    coaster.lap = t + 4; // + l'arrêt en gare
  }
  function coasterAt(tt) { const T = coaster.T, N = T.length - 1; let lo = 0, hi = N; if (tt >= T[N]) return { i: 0, u: 0 }; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (T[m] <= tt) lo = m; else hi = m - 1; } return { i: lo, u: (tt - T[lo]) / Math.max(1e-6, T[lo + 1] - T[lo]) }; }
  function coasterPos(trainOffset, carK, out) { // la position d'un wagon : train 0 ou 1, wagon 0 à 2
    const tt = ((clock() + trainOffset * coaster.lap / 2) % coaster.lap); const { i, u } = coasterAt(tt); const N = coaster.pts.length; const k = ((i - carK * 9) % N + N) % N, k2 = (k + 1) % N;
    out.p.copy(coaster.pts[k]).lerp(coaster.pts[k2], u); out.d.copy(coaster.pts[(k + 3) % N]).sub(coaster.pts[k]).normalize(); out.v = coaster.S[1] / Math.max(1e-6, coaster.T[Math.min(N, i + 1)] - coaster.T[i]); return out;
  }
  const RIDES = {}; let fireworks = [];
  function horse(col) { const g = new THREE.Group(), m = std(col, { roughness: .4, metalness: .2 }), gold = std(0xd4a24a, { metalness: .9, roughness: .2 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), m); b.scale.set(.28, .3, .6); g.add(b);
    const nk = new THREE.Mesh(new THREE.CylinderGeometry(.1, .16, .55, 8), m); nk.position.set(0, .3, -.45); nk.rotation.x = -.6; g.add(nk); const hd = new THREE.Mesh(new THREE.BoxGeometry(.18, .2, .42), m); hd.position.set(0, .52, -.66); hd.rotation.x = .4; g.add(hd);
    for (const [x, z, r] of [[-.15, -.35, .5], [.15, -.35, -.6], [-.15, .35, -.5], [.15, .35, .6]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.04, .03, .55, 6), m); l.position.set(x, -.35, z); l.rotation.x = r; g.add(l); }
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(.3, .06, .3), std(0xd42020)); saddle.position.y = .3; g.add(saddle); const mane = new THREE.Mesh(new THREE.BoxGeometry(.04, .14, .5), gold); mane.position.set(0, .45, -.45); mane.rotation.x = -.6; g.add(mane); return g; }
  function buildFair() {
    BG = ZG.fair = new THREE.Group(); scene.add(BG); BG.visible = false; bulbHue = []; Object.assign(SG, { built: false, ducks: [], balloons: [], cans: [], balls: [], kind: null }); anims.push(animTargets);
    const { x0, x1, z0, z1 } = FR, MX = (x0 + x1) / 2, MZ = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
    const RB = (w, h, d, r, m) => new THREE.Mesh(new LIB2.RoundedBoxGeometry(w, h, d, 3, r), m); // boîte aux coins arrondis
    const glowM = (c, k = 2.2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false }); // ça brille (lueur)
    const gold = std(0xd4a24a, { metalness: .9, roughness: .25 }), chrome = std(0xe8e8f0, { metalness: 1, roughness: .15 }), white = std(0xf4f0ea, { roughness: .5 });
    // ---- le ciel : dégradé violet, la lune, des étoiles, la ville au loin
    const [sc, sg] = cnv(512, 512); const gr = sg.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#050318'); gr.addColorStop(.6, '#1c0c3a'); gr.addColorStop(1, '#5a1a5a'); sg.fillStyle = gr; sg.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 900; k++) { sg.fillStyle = `rgba(255,255,255,${Math.random() * .9})`; sg.fillRect(Math.random() * 512, Math.random() * 330, Math.random() < .1 ? 2 : 1, Math.random() < .1 ? 2 : 1); }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 20), new THREE.MeshBasicMaterial({ map: tex(sc), side: THREE.BackSide, fog: false })); dome.position.set(MX, -20, MZ); BG.add(dome);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false, toneMapped: false })); moon.position.set(MX - 70, 75, MZ - 100); BG.add(moon);
    const winT = (() => { const [c, g] = cnv(128, 256); g.fillStyle = '#0c0a1a'; g.fillRect(0, 0, 128, 256); for (let y = 6; y < 256; y += 12) for (let x = 6; x < 128; x += 12) if (Math.random() < .35) { g.fillStyle = Math.random() < .6 ? '#ffd890' : '#ff9be8'; g.fillRect(x, y, 5, 6); } return tex(c); })();
    for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2, r = 95 + Math.random() * 20, h = 20 + Math.random() * 45, w = 10 + Math.random() * 12; const b = addBox(w, h, w, new THREE.MeshBasicMaterial({ map: winT, fog: false }), MX + Math.cos(a) * r, h / 2 - 1, MZ + Math.sin(a) * r); b.lookAt(MX, h / 2, MZ); }
    // ---- le sol : pavés, pelouses, massifs de fleurs
    const pavers = (() => { const [c, g] = cnv(256, 256); g.fillStyle = '#4a3a48'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 32) for (let x = (y / 32 % 2) * 16; x < 256; x += 32) { const v = 70 + Math.random() * 30 | 0; g.fillStyle = `rgb(${v + 10},${v},${v + 14})`; g.beginPath(); g.roundRect?.(x + 2, y + 2, 28, 28, 6); g.fill(); } return tex(c, [20, 20]); })();
    addPlane(W + 60, D + 60, std(0xffffff, { map: pavers, roughness: .55, metalness: .1 }), MX, -.01, MZ, 0, -Math.PI / 2);
    const lawn = (() => { const [c, g] = cnv(128, 128); g.fillStyle = '#1f4a26'; g.fillRect(0, 0, 128, 128); for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(${50 + Math.random() * 40 | 0},${110 + Math.random() * 60 | 0},${50},.55)`; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 2); } return tex(c, [4, 4]); })();
    for (const [x, z, r] of [[362, 32, 3], [378, 32, 3], [370, 12, 2.2], [370, -14, 2.6]]) { const l = new THREE.Mesh(new THREE.CircleGeometry(r, 28), std(0xffffff, { map: lawn, roughness: 1 })); l.rotation.x = -Math.PI / 2; l.position.set(x, .02, z); BG.add(l); const bor = new THREE.Mesh(new THREE.TorusGeometry(r, .1, 6, 32), white); bor.rotation.x = Math.PI / 2; bor.position.set(x, .06, z); BG.add(bor);
      for (let k = 0; k < 18; k++) { const a = Math.random() * 6.28, rr = Math.random() * (r - .3), f = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), std([0xff5f9a, 0xffd23f, 0xb06bff, 0xffffff][k % 4])); f.position.set(x + Math.cos(a) * rr, .15, z + Math.sin(a) * rr); BG.add(f); } fairBoxes.push([x - r, z - r, x + r, z + r]); }
    // ---- des lampadaires à l'ancienne avec un globe lumineux
    const lamp = (x, z) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(.07, .12, 4.2, 10), std(0x1a1a22, { metalness: .7, roughness: .3 })); p.position.set(x, 2.1, z); BG.add(p); const arm = new THREE.Mesh(new THREE.TorusGeometry(.35, .04, 6, 16, Math.PI), std(0x1a1a22, { metalness: .7 })); arm.position.set(x, 4.2, z); BG.add(arm);
      for (const s of [-1, 1]) { const gl = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12), glowM(0xfff1c8, 2.6)); gl.position.set(x + s * .35, 3.95, z); BG.add(gl); } };
    for (let z = 34; z > -32; z -= 9) { lamp(MX - 4.6, z); lamp(MX + 4.6, z); }
    // ---- l'entrée : une grande arche dorée couverte d'ampoules, avec des fanions
    { const G = new THREE.Group(); G.position.set(MX, 0, z1 - 1.5); BG.add(G);
      for (const s of [-1, 1]) { const col = new THREE.Mesh(new THREE.CylinderGeometry(.5, .6, 7, 20), std(0xd42050, { roughness: .35, metalness: .3 })); col.position.set(s * 6, 3.5, 0); G.add(col); const top = new THREE.Mesh(new THREE.SphereGeometry(.7, 16, 12), gold); top.position.set(s * 6, 7.3, 0); G.add(top); for (let y = .8; y < 7; y += .55) bulbHue.push([MX + s * 6 + (s < 0 ? .55 : -.55), y, z1 - 1.5 + .2, y / 7]); }
      const arc = new THREE.Mesh(new THREE.TorusGeometry(6, .45, 12, 60, Math.PI), std(0xd42050, { roughness: .35, metalness: .3 })); arc.position.y = 7; G.add(arc);
      for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI; bulbHue.push([MX + Math.cos(a) * 6, 7 + Math.sin(a) * 6, z1 - 1.5 + .5, i / 40]); }
      const sg2 = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.6), neon('🎡 PARADISE FÊTE FORAINE 🎢', '#ffd23f')); sg2.material.toneMapped = false; sg2.position.set(0, 10.2, .1); sg2.rotation.y = Math.PI; G.add(sg2); }
    // ---- les fanions colorés au-dessus de l'allée
    const flags = (a, b, n) => { const P = []; for (let i = 0; i <= n; i++) { const t = i / n; P.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * .9, a[2] + (b[2] - a[2]) * t)); }
      BG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(P), new THREE.LineBasicMaterial({ color: 0x333333 })));
      const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-.22, 0, 0, .22, 0, 0, 0, -.5, 0], 3)); tri.computeVertexNormals();
      P.forEach((p, i) => { if (i === n) return; const f = new THREE.Mesh(tri, new THREE.MeshStandardMaterial({ color: [0xff2bd6, 0xffd23f, 0x38e8ff, 0x2bff88, 0xff6a3d][i % 5], side: THREE.DoubleSide, roughness: .7 })); f.position.copy(p); f.lookAt(p.x + (b[2] - a[2]), p.y, p.z - (b[0] - a[0])); BG.add(f); }); };
    // ---- les guirlandes d'ampoules (poteaux décorés de chaque côté de l'allée)
    for (let z = z1 - 6; z > z0 + 6; z -= 7) { festoon([MX - 4.6, 5.6, z], [MX + 4.6, 5.6, z], 16, .9); for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, 5.6, 10), std(0x2a2433, { metalness: .6 })); p.position.set(MX + s * 4.6, 2.8, z); BG.add(p); const ball = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 10), gold); ball.position.set(MX + s * 4.6, 5.75, z); BG.add(ball); } }
    for (let k = 0; k < 9; k++) flags([MX - 4.6, 5.3, z1 - 6 - k * 7], [MX + 4.6, 5.3, z1 - 6 - k * 7 - 3.5], 10);
    for (let x = x0 + 4; x < x1 - 4; x += 8) { festoon([x, 4.8, 2.6], [x + 8, 4.8, 2.6], 14, .8); festoon([x, 4.8, -2.6], [x + 8, 4.8, -2.6], 14, .8); }
    // ---- des arbres illuminés
    for (const [x, z] of [[334, 36], [406, 36], [334, -36], [406, 30], [362, -30], [378, 30], [334, 0], [406, -2]]) { const t2 = new THREE.Mesh(new THREE.CylinderGeometry(.18, .28, 3, 8), std(0x3a2414, { roughness: 1 })); t2.position.set(x, 1.5, z); BG.add(t2); const cr = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 12), std(0x1f5a2a, { roughness: .9 })); cr.position.set(x, 4, z); cr.scale.y = 1.15; BG.add(cr); for (let k = 0; k < 26; k++) { const a = Math.random() * 6.28, b2 = Math.acos(Math.random() * 2 - 1); bulbHue.push([x + Math.sin(b2) * Math.cos(a) * 2, 4 + Math.cos(b2) * 2.15, z + Math.sin(b2) * Math.sin(a) * 2, .12 + Math.random() * .06]); } fairBoxes.push([x - .5, z - .5, x + .5, z + .5]); }
    // ---- 🎡 la grande roue : double jante blanche, rayons en câbles, ampoules sur chaque rayon, nacelles arrondies
    { const C = new THREE.Vector3(348, 16, -22), Rw = 13.5, NG = 16; const G = new THREE.Group(); G.position.copy(C); BG.add(G);
      for (const dz of [-.7, .7]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(Rw, .18, 10, 120), white); rim.position.z = dz; G.add(rim); const inner = new THREE.Mesh(new THREE.TorusGeometry(Rw * .55, .12, 8, 80), white); inner.position.z = dz; G.add(inner);
        const lines = []; for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2; lines.push(0, 0, dz, Math.cos(a) * Rw, Math.sin(a) * Rw, dz); } const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)); G.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xdcdcdc }))); }
      for (let k = 0; k < NG; k++) { const a = k / NG * Math.PI * 2, bar = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.6), chrome); bar.rotation.x = Math.PI / 2; bar.position.set(Math.cos(a) * Rw, Math.sin(a) * Rw, 0); G.add(bar); }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2, 32), std(0xd42050, { metalness: .5, roughness: .3 })); hub.rotation.x = Math.PI / 2; hub.position.copy(C); BG.add(hub); const hubG = new THREE.Mesh(new THREE.CircleGeometry(.8, 24), glowM(0xffd23f, 2)); hubG.position.set(C.x, C.y, C.z + 1.02); BG.add(hubG);
      for (const s of [-1, 1]) for (const zz of [-2.6, 2.6]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.22, .36, 17.6, 12), white); leg.position.set(C.x + s * 4.3, 8, C.z + zz); leg.rotation.z = s * .26; BG.add(leg); }
      const spokeBulbs = []; for (let k = 0; k < 16; k++) for (let j = 1; j <= 6; j++) { spokeBulbs.push([bulbHue.length, k, j]); bulbHue.push([0, 0, 0, k / 16]); }
      const gond = []; for (let k = 0; k < NG; k++) { const g = new THREE.Group(); const cab = new THREE.Mesh(new THREE.CapsuleGeometry(.75, .7, 8, 16), std([0xff2b7a, 0x38c8ff, 0xffc83f, 0x2bdf88][k % 4], { roughness: .3, metalness: .2 })); cab.scale.set(1, .9, .85); cab.position.y = -1.3; g.add(cab);
        const win = new THREE.Mesh(new THREE.CapsuleGeometry(.77, .35, 6, 16), new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: .45, roughness: .05 })); win.scale.set(1, .5, .87); win.position.y = -1.05; g.add(win);
        const roof = new THREE.Mesh(new THREE.SphereGeometry(.55, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold); roof.position.y = -.35; g.add(roof); const lt = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), glowM(0xfff1c8)); lt.position.y = -.05; g.add(lt); BG.add(g); gond.push(g); }
      const plat = RB(7, .6, 5, .2, std(0x3a2a48, { roughness: .6 })); plat.position.set(C.x, .3, C.z + 1.6); BG.add(plat); addPlane(5.5, .9, neon('🎡 GRANDE ROUE', '#ff2bd6', 1024, 100), C.x, 2.4, C.z + 4.15, 0).material.toneMapped = false;
      const W0 = Math.PI * 2 / 48;
      RIDES.wheel = { name: '🎡 La grande roue', angle: () => clock() * W0, gond, C, Rw, NG, seat(i) { const a = this.angle() + i / NG * Math.PI * 2 - Math.PI / 2; return new THREE.Vector3(C.x + Math.cos(a) * Rw, C.y + Math.sin(a) * Rw - 1.6, C.z); } };
      anims.push(() => { if (me.zone !== 'fair') return; const a0 = RIDES.wheel.angle(); G.rotation.z = a0; for (let k = 0; k < NG; k++) gond[k].position.copy(RIDES.wheel.seat(k)).add(new THREE.Vector3(0, 1.6, 0));
        for (const [bi, k, j] of spokeBulbs) { const a = a0 + k / 16 * Math.PI * 2, r = j / 6 * Rw * .97; bulbHue[bi][0] = C.x + Math.cos(a) * r; bulbHue[bi][1] = C.y + Math.sin(a) * r; bulbHue[bi][2] = C.z + .85; } }); }
    // ---- 🎠 le carrousel : toit à deux étages festonné, miroirs, barres dorées, chevaux de bois
    { const C = new THREE.Vector3(348, 0, 18); const G = new THREE.Group(); G.position.copy(C); BG.add(G);
      const plat = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.8, .55, 48), std(0x7a1030, { roughness: .4 })); plat.position.y = .28; G.add(plat); const edge = new THREE.Mesh(new THREE.TorusGeometry(6.7, .08, 6, 64), gold); edge.rotation.x = Math.PI / 2; edge.position.y = .55; G.add(edge);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 4.4, 24), new THREE.MeshPhysicalMaterial({ color: 0xffe0b0, metalness: 1, roughness: .05 })); col.position.y = 2.75; G.add(col);
      const roofM = new THREE.MeshStandardMaterial({ map: stripes('#ff2b7a', '#fff4e0'), roughness: .5 }); const roof = new THREE.Mesh(new THREE.ConeGeometry(7.6, 2.4, 32, 1, true), roofM); roof.position.y = 6.15; G.add(roof); const roof2 = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.6, 24), roofM); roof2.position.y = 8.1; G.add(roof2);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(.45, 16, 12), gold); crown.position.y = 9.1; G.add(crown);
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, sc2 = new THREE.Mesh(new THREE.CircleGeometry(.48, 16, 0, Math.PI), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xd4a24a : 0xff2b7a, side: THREE.DoubleSide, metalness: .4 })); sc2.position.set(Math.cos(a) * 7.55, 4.95, Math.sin(a) * 7.55); sc2.rotation.set(Math.PI, -a + Math.PI / 2, 0); G.add(sc2); }
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, mi = new THREE.Mesh(new THREE.PlaneGeometry(.5, 1.1), new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: .05 })); mi.position.set(Math.cos(a) * 1.32, 3.2, Math.sin(a) * 1.32); mi.rotation.y = -a + Math.PI / 2; G.add(mi); }
      const horses = []; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, r = k % 2 ? 4.8 : 3.5; const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 4.4, 8), gold); pole.position.set(Math.cos(a) * r, 2.75, Math.sin(a) * r); G.add(pole); const h = horse([0xffffff, 0xf4e0b0, 0xc8905a, 0xf0f0ff][k % 4]); h.scale.setScalar(1.25); h.position.set(Math.cos(a) * r, 1.7, Math.sin(a) * r); h.rotation.y = -a; G.add(h); horses.push({ h, a, r }); }
      const ring = []; for (let k = 0; k < 48; k++) { ring.push(bulbHue.length); bulbHue.push([0, 0, 0, k / 48]); } const ribs = []; for (let k = 0; k < 12; k++) for (let j = 1; j <= 5; j++) { ribs.push([bulbHue.length, k, j]); bulbHue.push([0, 0, 0, j / 5]); }
      const RPM = Math.PI * 2 / 16;
      RIDES.carousel = { name: '🎠 Le carrousel', G, horses, C, angle: () => clock() * RPM, seat(i) { const H = horses[i], a = this.angle(), ang = H.a - a; return new THREE.Vector3(C.x + Math.cos(ang) * H.r, 2.1 + Math.sin(clock() * 2 + i) * .3, C.z + Math.sin(ang) * H.r); } };
      anims.push(() => { if (me.zone !== 'fair') return; const a = RIDES.carousel.angle(); G.rotation.y = a; horses.forEach((H, i) => { H.h.position.y = 1.7 + Math.sin(clock() * 2 + i) * .3; });
        ring.forEach((bi, k) => { const aa = k / 48 * Math.PI * 2 - a; bulbHue[bi][0] = C.x + Math.cos(aa) * 7.4; bulbHue[bi][1] = 4.98; bulbHue[bi][2] = C.z + Math.sin(aa) * 7.4; });
        for (const [bi, k, j] of ribs) { const aa = k / 12 * Math.PI * 2 - a, r = 7.4 - j * 1.1; bulbHue[bi][0] = C.x + Math.cos(aa) * r; bulbHue[bi][1] = 5 + j * .4; bulbHue[bi][2] = C.z + Math.sin(aa) * r; } });
      addPlane(4.6, .8, neon('🎠 CARROUSEL', '#ffd23f', 1024, 100), 357.2, 3, 18, Math.PI / 2).material.toneMapped = false; }
    // ---- 🎢 les montagnes russes : rails ronds, colonne centrale, piliers en treillis, wagons arrondis avec phares
    { buildCoasterTrack(); const C = coaster, N = C.pts.length, up = new THREE.Vector3(0, 1, 0), side = [];
      for (let i = 0; i < N; i++) { const d = C.pts[(i + 1) % N].clone().sub(C.pts[i]).normalize(); side.push(new THREE.Vector3().crossVectors(d, up).normalize()); }
      const railM = std(0xff2b4a, { metalness: .6, roughness: .25 }), spineM = std(0xffd23f, { metalness: .5, roughness: .3 });
      for (const off of [-.55, .55]) { const rp = C.pts.map((p, i) => p.clone().addScaledVector(side[i], off)); BG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp, true), N, .1, 8, true), railM)); }
      BG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(C.pts.map(p => p.clone().add(new THREE.Vector3(0, -.35, 0))), true), N, .18, 8, true), spineM));
      const tieG = new THREE.CylinderGeometry(.05, .05, 1.2, 6); tieG.rotateZ(Math.PI / 2); const ties = new THREE.InstancedMesh(tieG, std(0x777777, { metalness: .6 }), Math.floor(N / 4)), q = new THREE.Object3D();
      for (let k = 0; k < ties.count; k++) { const i = k * 4, n2 = C.pts[(i + 1) % N]; q.position.copy(C.pts[i]); q.position.y -= .12; q.lookAt(n2.x, n2.y - .12, n2.z); q.updateMatrix(); ties.setMatrixAt(k, q.matrix); } BG.add(ties);
      const supM = std(0xe8e8f0, { metalness: .5, roughness: .35 });
      for (let i = 0; i < N; i += 16) { const p = C.pts[i]; if (p.y < 1.4) continue; for (const s of [-1, 1]) { const c2 = new THREE.Mesh(new THREE.CylinderGeometry(.1, .14, p.y - .4, 8), supM); c2.position.set(p.x + side[i].x * s * .9, (p.y - .4) / 2, p.z + side[i].z * s * .9); BG.add(c2); }
        for (let y = 2; y < p.y - .6; y += 2.5) { const br = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1.9, 6), supM); br.position.set(p.x, y, p.z); br.rotation.set(0, Math.atan2(side[i].x, side[i].z), Math.PI / 2 - .6); BG.add(br); }
        if (i % 32 === 0) bulbHue.push([p.x + side[i].x * .7, p.y - .2, p.z + side[i].z * .7, i / N], [p.x - side[i].x * .7, p.y - .2, p.z - side[i].z * .7, i / N + .5]); }
      const st = RB(10, .9, 4.4, .2, std(0x3a2a48, { roughness: .6 })); st.position.set(387, .45, -9); BG.add(st);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 11, 24, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ map: stripes('#ff2b4a', '#ffffff'), side: THREE.DoubleSide })); roof.rotation.z = Math.PI / 2; roof.position.set(387, 4.4, -9); BG.add(roof);
      for (const x of [382.5, 391.5]) for (const z of [-11, -7]) { const c3 = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 4.4, 10), chrome); c3.position.set(x, 2.3, z); BG.add(c3); }
      for (let x = 382; x <= 392; x += .8) bulbHue.push([x, 4.35, -6.05, x / 10]);
      addPlane(6, 1, neon('🎢 MÉGA COASTER', '#ff2b4a'), 387, 6.2, -7, 0).material.toneMapped = false;
      const trains = [0, 1].map(o => [0, 1, 2].map(k => { const g = new THREE.Group(); const car = new THREE.Mesh(new THREE.CapsuleGeometry(.6, 1.1, 8, 16), std(k ? 0x2a5aff : 0xffc83f, { metalness: .5, roughness: .2 })); car.rotation.x = Math.PI / 2; car.scale.set(1, 1, .75); car.position.y = .5; g.add(car);
        const seat2 = RB(1.05, .5, .5, .12, std(0x111111)); seat2.position.set(0, .95, -.1); g.add(seat2); if (!k) for (const s of [-1, 1]) { const hl = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), glowM(0xffffff, 3)); hl.position.set(s * .35, .55, 1.15); g.add(hl); } BG.add(g); return g; }));
      const tmp = { p: new THREE.Vector3(), d: new THREE.Vector3(), v: 0 };
      RIDES.coaster = { name: '🎢 Les montagnes russes', trains, pos: (o, k) => coasterPos(o, k, { p: new THREE.Vector3(), d: new THREE.Vector3(), v: 0 }) };
      anims.push(() => { if (me.zone !== 'fair') return; trains.forEach((cars, o) => cars.forEach((g, k) => { coasterPos(o, k, tmp); g.position.copy(tmp.p); g.lookAt(tmp.p.x + tmp.d.x, tmp.p.y + tmp.d.y, tmp.p.z + tmp.d.z); })); }); }
    // ---- 🪂 les chaises volantes : grand mât, couronne illuminée, sièges suspendus
    { const C = new THREE.Vector3(392, 0, 18), NS = 16; const mast = new THREE.Mesh(new THREE.CylinderGeometry(.55, .95, 10, 24), std(0x2a6aff, { metalness: .5, roughness: .25 })); mast.position.set(C.x, 5, C.z); BG.add(mast);
      for (let y = 1; y < 10; y += 1.2) bulbHue.push([C.x + .7, y, C.z, y / 10], [C.x - .7, y, C.z, y / 10 + .3]);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, .6, 32), std(0x3a2a48)); base.position.set(C.x, .3, C.z); BG.add(base);
      const top = new THREE.Group(); top.position.set(C.x, 10, C.z); BG.add(top); const cap = new THREE.Mesh(new THREE.ConeGeometry(4.8, 1.8, 32, 1, true), new THREE.MeshStandardMaterial({ map: stripes('#38c8ff', '#ffffff'), side: THREE.DoubleSide })); cap.position.y = .9; top.add(cap); const capTop = new THREE.Mesh(new THREE.SphereGeometry(.6, 16, 12), gold); capTop.position.y = 1.9; top.add(capTop);
      const seats = []; for (let k = 0; k < NS; k++) { const arm = new THREE.Group(); arm.rotation.y = k / NS * Math.PI * 2; top.add(arm); const piv = new THREE.Group(); piv.position.x = 4.2; arm.add(piv);
        for (const dz of [-.22, .22]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 4.4), chrome); ch.position.set(0, -2.2, dz); piv.add(ch); }
        const st2 = RB(.55, .12, .55, .05, std([0xff2b7a, 0xffc83f, 0x2bdf88, 0x9b5cff][k % 4], { roughness: .3 })); st2.position.y = -4.45; piv.add(st2); const bk = RB(.55, .5, .08, .04, st2.material); bk.position.set(-.25, -4.2, 0); bk.rotation.y = Math.PI / 2; piv.add(bk); seats.push({ arm, piv }); }
      const speedAt = () => { const c = clock() % 40; return c < 6 ? c / 6 : c < 30 ? 1 : c < 35 ? 1 - (c - 30) / 5 : 0; };
      const ring = []; for (let k = 0; k < 40; k++) { ring.push(bulbHue.length); bulbHue.push([0, 0, 0, k / 40]); }
      let ang = 0, lastT = clock();
      RIDES.swing = { name: '🪂 Les chaises volantes', speedAt, seats, C, angle: () => ang, seat(i) { const v = speedAt(), tilt = v * .95, a = ang + i / NS * Math.PI * 2, r = 4.2 + Math.sin(tilt) * 4.4; return new THREE.Vector3(C.x + Math.cos(a) * r, 10 - Math.cos(tilt) * 4.4 + .4, C.z - Math.sin(a) * r); } };
      anims.push(() => { const now0 = clock(), dt0 = Math.min(.1, now0 - lastT); lastT = now0; const v = speedAt(); ang += v * 1.6 * dt0; if (me.zone !== 'fair') return; top.rotation.y = ang; top.rotation.z = Math.sin(now0 * .5) * .08 * v; seats.forEach(s => { s.piv.rotation.z = v * .95; });
        ring.forEach((bi, k) => { const a = ang + k / 40 * Math.PI * 2; bulbHue[bi][0] = C.x + Math.cos(a) * 4.75; bulbHue[bi][1] = 10.05; bulbHue[bi][2] = C.z - Math.sin(a) * 4.75; }); });
      addPlane(5, .8, neon('🪂 CHAISES VOLANTES', '#38e8ff', 1024, 100), 383.7, 3, 18, -Math.PI / 2).material.toneMapped = false; }
    // ---- 🗼 la tour de chute libre : tour lumineuse, couronne au sommet, anneau de sièges
    { const C = new THREE.Vector3(395, 0, 5), H = 34; const tw = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.1, H, 24), std(0x1a1630, { metalness: .6, roughness: .3 })); tw.position.set(C.x, H / 2, C.z); BG.add(tw);
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) { const led = new THREE.Mesh(new THREE.BoxGeometry(.08, H - 1, .08), glowM(0xff2bd6, 1.8)); led.position.set(C.x + Math.cos(a) * .95, H / 2, C.z + Math.sin(a) * .95); BG.add(led); }
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.4, 24), gold); crown.position.set(C.x, H + 1.2, C.z); BG.add(crown); const star = new THREE.Mesh(new THREE.SphereGeometry(.4, 16, 12), glowM(0xffd23f, 3)); star.position.set(C.x, H + 2.6, C.z); BG.add(star);
      const ring = new THREE.Group(); BG.add(ring); const rm = new THREE.Mesh(new THREE.TorusGeometry(1.8, .25, 10, 32), std(0xffc83f, { metalness: .6, roughness: .25 })); rm.rotation.x = Math.PI / 2; ring.add(rm);
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, st3 = RB(.6, .8, .5, .12, std(0xd42050, { roughness: .3 })); st3.position.set(Math.cos(a) * 2.1, -.3, Math.sin(a) * 2.1); st3.rotation.y = -a + Math.PI / 2; ring.add(st3); }
      const yAt = () => { const c = clock() % 30; return c < 12 ? 2 + (c / 12) * (H - 4) : c < 15 ? H - 2 : c < 16.4 ? H - 2 - Math.pow((c - 15) / 1.4, 2) * (H - 10) : c < 18 ? 8 - (c - 16.4) / 1.6 * 6 : 2; };
      RIDES.drop = { name: '🗼 La tour de chute libre', yAt, C, seat() { return new THREE.Vector3(C.x, yAt() - .3, C.z + 2.1); } };
      anims.push(() => { if (me.zone !== 'fair') return; ring.position.set(C.x, RIDES.drop.yAt(), C.z); });
      addPlane(4.6, .8, neon('🗼 CHUTE LIBRE', '#ffd23f', 1024, 100), 390.6, 2.6, 5, -Math.PI / 2).material.toneMapped = false; }
    // ---- 🚗 les auto-tamponneuses : piste brillante, toit arrondi plein d'ampoules, voitures toutes rondes
    { const A0 = [336, -12, 358, -4]; addPlane(A0[2] - A0[0], A0[3] - A0[1], std(0x1a1430, { roughness: .15, metalness: .6 }), (A0[0] + A0[2]) / 2, .02, (A0[1] + A0[3]) / 2, 0, -Math.PI / 2);
      for (const [w, d, x, z] of [[22, .5, 347, -12.2], [22, .5, 347, -3.8], [.5, 8.4, 335.8, -8], [.5, 8.4, 358.2, -8]]) { const b = RB(w, .7, d, .2, std(0xffc83f, { roughness: .4 })); b.position.set(x, .35, z); BG.add(b); }
      for (let x = 337; x < 358; x += 4) for (const z of [-11.5, -4.5]) { const c4 = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 4.4, 10), chrome); c4.position.set(x, 2.2, z); BG.add(c4); }
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 23, 24, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ map: stripes('#9b5cff', '#ffffff'), side: THREE.DoubleSide })); roof.rotation.z = Math.PI / 2; roof.scale.set(1, 1, .9); roof.position.set(347, 3.9, -8); BG.add(roof);
      for (let x = 337; x <= 357; x += 1.2) for (const z of [-11.8, -8, -4.2]) bulbHue.push([x, z === -8 ? 8.4 : 4.5, z, x / 20]);
      addPlane(6.5, 1, neon('🚗 AUTO-TAMPONNEUSES', '#ff8a1f', 1024, 100), 347, 5.2, -3.6, 0).material.toneMapped = false;
      const cars = []; for (let k = 0; k < 6; k++) { const g = new THREE.Group(), cm = std([0xff2b4a, 0x2a5aff, 0x2bdf88, 0xffc83f, 0xff2bd6, 0xf4f4f4][k], { metalness: .5, roughness: .2 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(.55, .7, 8, 16), cm); body.rotation.x = Math.PI / 2; body.scale.set(1.15, 1, .55); body.position.y = .45; g.add(body);
        const bump = new THREE.Mesh(new THREE.TorusGeometry(.95, .16, 10, 32), std(0x111111, { roughness: .6 })); bump.rotation.x = Math.PI / 2; bump.scale.set(.78, 1.05, 1); bump.position.y = .28; g.add(bump);
        const seat3 = RB(.6, .5, .45, .1, std(0x111111)); seat3.position.set(0, .75, .25); g.add(seat3); const wheel = new THREE.Mesh(new THREE.TorusGeometry(.14, .03, 6, 16), chrome); wheel.position.set(0, .85, -.25); wheel.rotation.x = -1; g.add(wheel);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 3.4), chrome); pole.position.set(0, 2.2, .55); g.add(pole); const spark = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), glowM(0x9fe6ff, 3)); spark.position.set(0, 3.9, .55); g.add(spark);
        BG.add(g); cars.push({ g, x: 338 + k * 3.5, z: -8 + (k % 2 ? 2 : -2), yaw: Math.random() * 6, v: 3, me: false }); }
      RIDES.bump = { name: '🚗 Les auto-tamponneuses', cars, box: A0 };
      anims.push((dt) => { if (me.zone !== 'fair') return; const [a, b, c, d] = A0;
        for (const C2 of cars) { if (!C2.me) { if (Math.random() < .01) C2.yaw += (Math.random() - .5) * 2; C2.v = 3.2; } C2.x += -Math.sin(C2.yaw) * C2.v * dt; C2.z += -Math.cos(C2.yaw) * C2.v * dt;
          if (C2.x < a + 1 || C2.x > c - 1) { C2.x = Math.max(a + 1, Math.min(c - 1, C2.x)); C2.yaw = -C2.yaw; if (C2.me) { C2.v *= -.4; noise(.12, 400, 1, .3); } } if (C2.z < b + 1 || C2.z > d - 1) { C2.z = Math.max(b + 1, Math.min(d - 1, C2.z)); C2.yaw = Math.PI - C2.yaw; if (C2.me) { C2.v *= -.4; noise(.12, 400, 1, .3); } } }
        for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) { const A = cars[i], B = cars[j], dx = B.x - A.x, dz = B.z - A.z, dd = Math.hypot(dx, dz); if (dd < 1.9 && dd > .01) { const push = (1.9 - dd) / 2; A.x -= dx / dd * push; A.z -= dz / dd * push; B.x += dx / dd * push; B.z += dz / dd * push; if (!A.me) A.yaw += Math.PI * .8; if (!B.me) B.yaw += Math.PI * .8; if (A.me || B.me) { noise(.15, 300, 1, .45); tone(180, 80, .15, .2); } } }
        for (const C2 of cars) { C2.g.position.set(C2.x, 0, C2.z); C2.g.rotation.y = C2.yaw; } }); }
    // ---- les stands arrondis : comptoir, toit rayé festonné, enseigne lumineuse, ampoules
    const fancyStall = (x, z, ry, name, col, deco) => { const G = new THREE.Group(); G.position.set(x, 0, z); G.rotation.y = ry; BG.add(G);
      const ctr = RB(4, 1.1, 1.8, .25, std(0xfff2e0, { roughness: .5 })); ctr.position.y = .55; G.add(ctr); const trim = RB(4.1, .16, 1.9, .07, std(new THREE.Color(col).getHex(), { roughness: .4 })); trim.position.y = 1.12; G.add(trim);
      for (const sx of [-1.85, 1.85]) for (const sz of [-.8, .8]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 2.7, 10), std(0xfff2e0, { metalness: .3 })); p.position.set(sx, 1.35, sz); G.add(p); }
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 4.4, 24, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ map: stripes(col, '#ffffff'), side: THREE.DoubleSide, roughness: .6 })); roof.rotation.z = Math.PI / 2; roof.position.y = 2.7; G.add(roof);
      for (let k = 0; k < 9; k++) { const sc3 = new THREE.Mesh(new THREE.CircleGeometry(.25, 12, 0, Math.PI), new THREE.MeshStandardMaterial({ color: k % 2 ? col : '#ffffff', side: THREE.DoubleSide })); sc3.position.set(-2 + k * .5, 2.72, 1.31); sc3.rotation.z = Math.PI; G.add(sc3); }
      const sg3 = new THREE.Mesh(new THREE.PlaneGeometry(3.8, .7), neon(name, col, 1024, 96)); sg3.material.toneMapped = false; sg3.position.set(0, 4.35, .2); G.add(sg3);
      if (deco) deco(G); G.updateMatrixWorld(true); for (let i = 0; i <= 10; i++) { const v = new THREE.Vector3(-2.1 + i * .42, 2.55, 1.32); G.localToWorld(v); bulbHue.push([v.x, v.y, v.z, i / 10]); } };
    const plush = G => { for (let k = 0; k < 7; k++) { const g = new THREE.Group(), cl = [0xff7ad9, 0x7ad9ff, 0xffd23f, 0x9b5cff, 0xffffff][k % 5], m = std(cl, { roughness: 1 }); const b = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 10), m); g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 10), m); h.position.y = .25; g.add(h); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), m); e.position.set(s * .1, .37, 0); g.add(e); } g.position.set(-1.6 + k * .53, 1.7, -.5); G.add(g); } };
    const ducks = G => { const w = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, .12, 24), std(0x2a9fd8, { roughness: .05, metalness: .3 })); w.scale.x = 2.2; w.position.y = 1.2; G.add(w); for (let k = 0; k < 9; k++) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(.11, 10, 8), std(0xffd23f)); g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), std(0xffd23f)); h.position.set(0, .1, .07); g.add(h); const bk = new THREE.Mesh(new THREE.ConeGeometry(.03, .07, 6), std(0xff8a1f)); bk.rotation.x = Math.PI / 2; bk.position.set(0, .1, .15); g.add(bk); const a = k / 9 * Math.PI * 2; g.position.set(Math.cos(a) * 1.4, 1.3, Math.sin(a) * .5); G.add(g); anims.push((dt, t) => { if (me.zone !== 'fair') return; const aa = a + t * .5; g.position.set(Math.cos(aa) * 1.4, 1.3, Math.sin(aa) * .5); g.rotation.y = -aa; }); } };
    const candy = G => { for (let k = 0; k < 5; k++) { const c2 = new THREE.Mesh(new THREE.SphereGeometry(.3, 14, 12), std(0xffb8e6, { roughness: 1 })); c2.scale.y = .8; c2.position.set(-1.4 + k * .7, 1.75, -.3); G.add(c2); const st4 = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .5), white); st4.position.set(-1.4 + k * .7, 1.42, -.3); G.add(st4); } };
    const churro = G => { for (let k = 0; k < 8; k++) { const c2 = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .6, 8), std(0xc8843a, { roughness: .8 })); c2.position.set(-1.4 + k * .4, 1.45, -.3); c2.rotation.z = .3; G.add(c2); } };
    const cans = G => { for (let r = 0; r < 4; r++) for (let k = 0; k <= 3 - r; k++) { const c2 = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .26, 12), std([0xff2b4a, 0x2a5aff, 0xffd23f][(r + k) % 3], { metalness: .7, roughness: .3 })); c2.position.set(-.4 + k * .26 + r * .13, 1.25 + r * .27, -.3); G.add(c2); } };
    fancyStall(363, 10, Math.PI / 2, '🍭 BARBE À PAPA', '#ff7ad9', candy); fancyStall(363, 17, Math.PI / 2, '🥨 CHURROS', '#ffb070', churro); fancyStall(363, 24, Math.PI / 2, '🦆 PÊCHE AUX CANARDS', '#38e8ff', ducks);
    fancyStall(377, 10, -Math.PI / 2, '🎯 TIR À LA CARABINE', '#2bff88'); fancyStall(377, 24, -Math.PI / 2, '🥫 CHAMBOULE-TOUT', '#ffd23f'); // les cibles et les boîtes sont de vrais jeux (voir plus bas)
    for (const z of [10, 17, 24]) fairBoxes.push([361.5, z - 2.2, 364.6, z + 2.2]); for (const z of [10, 24]) fairBoxes.push([375.4, z - 2.2, 378.5, z + 2.2]);
    // ---- la scène : écran géant (musique YouTube), arche de projecteurs, enceintes
    const stage = RB(13, 1, 5.5, .3, std(0x1a1430, { metalness: .5, roughness: .3 })); stage.position.set(MX, .5, -37.3); BG.add(stage);
    const [cc, gg] = cnv(512, 230), tt = tex(cc), scr = addPlane(10, 5.6, new THREE.MeshBasicMaterial({ map: tt, fog: false }), MX, 4.6, -39.4); salleScreens[FR.LED] = { ctx: gg, tex: tt }; screens.push({ m: scr, w: 10, h: 5.6, salle: FR.LED });
    const sArc = new THREE.Mesh(new THREE.TorusGeometry(7, .22, 10, 48, Math.PI), chrome); sArc.position.set(MX, 1, -39); BG.add(sArc); for (let i = 0; i <= 28; i++) { const a = i / 28 * Math.PI; bulbHue.push([MX + Math.cos(a) * 7, 1 + Math.sin(a) * 7, -38.7, i / 28]); }
    for (const s of [-1, 1]) { const sp = RB(1.6, 3.6, 1.4, .2, std(0x0c0c10)); sp.position.set(MX + s * 7.6, 2.8, -38); BG.add(sp); for (const y of [1.8, 3.4]) { const cone = new THREE.Mesh(new THREE.CircleGeometry(.45, 20), std(0x2a2a30, { metalness: .5 })); cone.position.set(MX + s * 7.6, y, -37.29); BG.add(cone); } }
    // ---- toutes les ampoules en une fois, avec leur lueur (elles changent de couleur en vague)
    bulbN = bulbHue.length; bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), bulbN); const qb = new THREE.Object3D(), cb = new THREE.Color();
    bulbHue.forEach(([x, y, z, h], i) => { qb.position.set(x, y, z); qb.updateMatrix(); bulbs.setMatrixAt(i, qb.matrix); bulbs.setColorAt(i, cb.setHSL(h, 1, .6).multiplyScalar(2)); }); BG.add(bulbs);
    let bAcc = 0; anims.push((dt, t) => { if (me.zone !== 'fair') return; bAcc += dt; if (bAcc < .08) return; bAcc = 0;
      for (let i = 0; i < bulbN; i++) { const [x, y, z, h] = bulbHue[i]; qb.position.set(x, y, z); qb.updateMatrix(); bulbs.setMatrixAt(i, qb.matrix); const on = Math.sin(t * 4 + i * .4) > -.6; bulbs.setColorAt(i, cb.setHSL((h + t * .08) % 1, 1, .62).multiplyScalar(on ? 2.4 : .7)); }
      bulbs.instanceMatrix.needsUpdate = true; bulbs.instanceColor.needsUpdate = true; });
    // ---- 🎆 les feux d'artifice
    for (let k = 0; k < 3; k++) { const n = 160, pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const m = new THREE.PointsMaterial({ size: .55, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }); BG.add(new THREE.Points(g, m)); fireworks.push({ pos, vel, g, m, t: 99, n }); }
    let fwAcc = 0; anims.push((dt) => { if (me.zone !== 'fair') return; fwAcc += dt; if (fwAcc > 2.6) { fwAcc = 0; const F = fireworks.find(f => f.t > 2.5); if (F) { F.t = 0; const cx = MX + (Math.random() - .5) * 60, cy = 32 + Math.random() * 14, cz = -10 + (Math.random() - .5) * 40; for (let i = 0; i < F.n; i++) { const a = Math.random() * 6.28, b = Math.acos(Math.random() * 2 - 1), s = 9 + Math.random() * 3; F.pos.set([cx, cy, cz], i * 3); F.vel.set([Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s], i * 3); } F.m.color.setHSL(Math.random(), 1, .6).multiplyScalar(2); tone(90, 40, .6, .12 * nearVol(cx, cz) + .05); noise(.4, 200, .7, .1); } }
      for (const F of fireworks) { if (F.t > 2.5) { F.m.opacity = 0; continue; } F.t += dt; for (let i = 0; i < F.n; i++) { F.vel[i * 3 + 1] -= 6 * dt; F.vel[i * 3] *= .985; F.vel[i * 3 + 2] *= .985; F.pos[i * 3] += F.vel[i * 3] * dt; F.pos[i * 3 + 1] += F.vel[i * 3 + 1] * dt; F.pos[i * 3 + 2] += F.vel[i * 3 + 2] * dt; } F.g.attributes.position.needsUpdate = true; F.m.opacity = Math.max(0, 1 - F.t / 2.5); } });
    // ---- une lumière chaude et colorée sur toute la fête (allumée seulement ici)
    fairLights = [[0xff5fb0, MX - 22, -16], [0x5fb8ff, MX + 22, -16], [0xffb070, MX, 18]].map(([c, x, z]) => { const l = new THREE.PointLight(c, 0, 60, 1.2); l.position.set(x, 12, z); scene.add(l); return l; });
    BG = null;
  }
  let fairLights = [];
  // ----- monter dans un manège -----
  const ride = { kind: null, idx: 0, until: 0, start: 0, look: { yaw: 0, pitch: 0 }, wait: 0, carMe: null };
  function boardRide(kind) {
    const now0 = clock(); Object.assign(ride, { kind, look: { yaw: 0, pitch: 0 }, wait: 0, dir: null });
    if (kind === 'wheel') { const R0 = RIDES.wheel; let best = 0, by = 1e9; for (let i = 0; i < R0.NG; i++) { const y = R0.seat(i).y; if (y < by) { by = y; best = i; } } ride.idx = best; ride.start = now0; ride.until = now0 + 48; }
    if (kind === 'carousel') { ride.idx = Math.floor(Math.random() * 12); ride.start = now0; ride.until = now0 + 40; }
    if (kind === 'swing') { ride.idx = Math.floor(Math.random() * 16); const c = now0 % 40; ride.wait = c < 28 ? 0 : 40 - c; ride.start = now0 + ride.wait; ride.until = now0 + (c < 28 ? 36 - c : 40 - c + 36); } // si ça tourne déjà, on saute dedans ; on descend quand ça s'arrête
    if (kind === 'drop') { const c = now0 % 30; ride.wait = c < 1 ? 0 : 30 - c; ride.start = now0 + ride.wait; ride.until = ride.start + 19; }
    if (kind === 'coaster') { const lap = coaster.lap; let best = null; for (const o of [0, 1]) { const tt = ((now0 + o * lap / 2) % lap), w = tt < 2 ? 0 : lap - tt; if (!best || w < best.w) best = { o, w }; } ride.idx = best.o; ride.wait = best.w; ride.start = now0 + best.w; ride.until = ride.start + lap - 3; }
    if (kind === 'bump') { const C2 = RIDES.bump.cars[0]; C2.me = true; C2.v = 0; ride.carMe = C2; ride.until = now0 + 9999; }
    mode = 'ride'; hidePanel(); hud.emotes.classList.add('hidden'); hud.joy.classList.toggle('hidden', !(kind === 'bump' && mobile())); hud.ride.classList.remove('hidden'); sDing();
    toast(kind === 'bump' ? (mobile() ? '🚗 Joystick : en haut pour avancer, sur les côtés pour tourner. Fonce dans les autres !' : '🚗 Z / ↑ pour avancer, S / ↓ pour reculer, Q D / ← → pour tourner. Fonce dans les autres !') : ride.wait > 1 ? `${RIDES[kind].name} : départ dans ${Math.ceil(ride.wait)} s… installe-toi !` : `${RIDES[kind].name} : c'est parti ! Glisse pour regarder autour de toi`);
  }
  function leaveRide(quiet) { if (ride.carMe) { ride.carMe.me = false; ride.carMe = null; } const k = ride.kind; ride.kind = null; mode = 'walk'; hud.ride?.classList.add('hidden'); hud.emotes?.classList.remove('hidden'); hud.joy?.classList.toggle('hidden', !mobile());
    const exits = { wheel: [348, -16.5], carousel: [357.5, 18], coaster: [380, -5.5], swing: [382.5, 18], drop: [389.5, 5], bump: [347, -2] }, e = exits[k] || [370, 30]; me.x = e[0]; me.z = e[1]; me.y = 0; if (!quiet) socket.emit('cs_move', { x: me.x, z: me.z, y: 0, yaw: me.yaw, k: 0 }); }
  function rideFrame(dt, ts) { // la caméra suit mon siège
    const now0 = clock(), k = ride.kind; if (!k) return; let p, look;
    if (k === 'wheel') { p = RIDES.wheel.seat(ride.idx); look = [p.x, p.y - 1.5, p.z + 10]; }
    else if (k === 'carousel') { p = RIDES.carousel.seat(ride.idx); const C = RIDES.carousel.C, d = new THREE.Vector3(p.x - C.x, 0, p.z - C.z).normalize(); look = [p.x + d.z * 5, p.y, p.z - d.x * 5]; p = p.clone(); p.y += 1.1; }
    else if (now0 < ride.start && (k === 'swing' || k === 'drop')) { const C = RIDES[k].C; p = k === 'swing' ? new THREE.Vector3(382.2, 1.7, 18) : new THREE.Vector3(384.5, 2.2, 8); look = [C.x, k === 'drop' ? 14 : 6, C.z]; } // en attendant le départ : on regarde le manège depuis le quai
    else if (k === 'swing') { p = RIDES.swing.seat(ride.idx); const C = RIDES.swing.C, d = new THREE.Vector3(p.x - C.x, 0, p.z - C.z).normalize(); look = [p.x + d.z * 6, p.y - 1, p.z - d.x * 6]; }
    else if (k === 'drop') { p = RIDES.drop.seat(); look = [p.x, p.y - 2, p.z + 10]; }
    else if (k === 'coaster') { if (now0 < ride.start) { p = new THREE.Vector3(387, 2.4, -8); look = [395, 2, -9]; } else { const o = RIDES.coaster.pos(ride.idx, 0); p = o.p.clone(); p.y += 1.25; ride.dir = ride.dir ? ride.dir.lerp(o.d, Math.min(1, dt * 6)).normalize() : o.d.clone(); const dd = ride.dir; look = [p.x + dd.x * 6, p.y + dd.y * 6 - .3, p.z + dd.z * 6]; ride.v = o.v; } }
    else if (k === 'bump') { const C2 = ride.carMe; let f = 0, s = 0; if (keys.has('z') || keys.has('w') || keys.has('ArrowUp')) f += 1; if (keys.has('s') || keys.has('ArrowDown')) f -= 1; if (keys.has('q') || keys.has('a') || keys.has('ArrowLeft')) s -= 1; if (keys.has('d') || keys.has('ArrowRight')) s += 1; if (stick.on) { f = Math.abs(stick.y) > .15 ? -stick.y : 0; s = stick.x; }
      C2.v += f * 7 * dt; C2.v -= C2.v * 1.2 * dt; C2.v = Math.max(-3, Math.min(6, C2.v)); C2.yaw -= s * 2.2 * dt; p = new THREE.Vector3(C2.x + Math.sin(C2.yaw) * 4, 2.6, C2.z + Math.cos(C2.yaw) * 4); look = [C2.x - Math.sin(C2.yaw) * 3, .5, C2.z - Math.cos(C2.yaw) * 3]; }
    // regarder autour (glisser le doigt / la souris)
    const lx = look[0] - p.x, lz = look[2] - p.z, ly = look[1] - p.y, base = Math.atan2(lx, lz), L = Math.hypot(lx, lz), a = base + ride.look.yaw;
    camera.position.copy(p); camera.lookAt(p.x + Math.sin(a) * L, p.y + ly + Math.tan(ride.look.pitch) * L, p.z + Math.cos(a) * L);
    // le vent et les cris dans les montagnes russes / la chute
    const fast = k === 'coaster' ? (ride.v || 0) / 18 : k === 'drop' ? (now0 % 30 > 15 && now0 % 30 < 16.4 ? 1 : 0) : 0; if (fast > .6 && Math.random() < .15) noise(.15, 900, .5, .08 * fast);
    // le compte à rebours / la fin du tour
    const left = ride.until - now0, txt = now0 < ride.start ? `⏳ Départ dans ${Math.ceil(ride.start - now0)} s` : k === 'bump' ? '🚗 Fonce dans les autres voitures !' : `⏱️ Encore ${Math.max(0, Math.ceil(left))} s`;
    if (hud.rideTxt.textContent !== txt) hud.rideTxt.textContent = txt;
    if (k !== 'bump' && now0 > ride.until) { leaveRide(); toast('🎉 Fin du tour ! Ça t\'a plu ?'); return; }
    // les autres me voient sur le manège
    const sp = k === 'bump' ? { x: ride.carMe.x, z: ride.carMe.z, y: 0 } : { x: p.x, z: p.z, y: Math.max(0, p.y - 1.4) }; me.x = sp.x; me.z = sp.z; me.y = sp.y;
    if (ts - lastSend > 90) { lastSend = ts; socket.emit('cs_move', { x: me.x, z: me.z, y: me.y, yaw: me.yaw, k: 2 }); }
  }
  function fairGame(kind) {
    const prizes = ['🧸 un nounours géant', '🐰 un lapin en peluche', '🦄 une licorne', '🐻 un ours tout doux', '🎈 un ballon', '🐶 un petit chien en peluche'];
    if (kind === 'tir') { const sc = Math.floor(Math.random() * 11); sDing(); toast(sc >= 8 ? `🎯 ${sc}/10 ! Bravo, tu gagnes ${prizes[Math.random() * prizes.length | 0]} !` : `🎯 ${sc}/10… retente ta chance !`); if (sc >= 8) socket.emit('cs_emote', '🧸'); }
    if (kind === 'canards') { const w = Math.random() < .5; sDing(); toast(w ? `🦆 Gagné ! Tu repars avec ${prizes[Math.random() * prizes.length | 0]}` : '🦆 Pas de chance, ce canard n\'avait pas de numéro gagnant !'); }
    if (kind === 'chamboule') { const n = Math.floor(Math.random() * 11); sDing(); toast(n === 10 ? '🥫 Toutes les boîtes sont tombées : tu gagnes une peluche !' : `🥫 ${n} boîtes sur 10 tombées !`); }
  }

  // ---------- 🎯🥫 les vrais jeux des stands : tir à la carabine et chamboule-tout ----------
  const SG = { built: false, ducks: [], balloons: [], cans: [], balls: [], kind: null, shots: 0, score: 0, rifle: null, flash: 0, done: false };
  const CAN = { r: .11, h: .26, x: 377.3, z: 24, top: 1.2 }; // les boîtes posées sur le comptoir du chamboule-tout
  function buildStandGames() { // construit une fois les canards, les ballons et la pyramide de boîtes
    if (SG.built) return; SG.built = true; const G = ZG.fair;
    // le tir : 7 canards qui défilent sur un rail, 4 ballons qui flottent au-dessus
    const rail = new THREE.Mesh(new THREE.BoxGeometry(.05, .06, 3.6), std(0x333333, { metalness: .7 })); rail.position.set(377.75, 1.5, 10); G.add(rail);
    const bgP = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 1.7), new THREE.MeshStandardMaterial({ map: stripes('#1f6a3a', '#2a8a4a'), roughness: .8 })); bgP.position.set(377.85, 2.05, 10); bgP.rotation.y = -Math.PI / 2; G.add(bgP);
    for (let k = 0; k < 7; k++) { const g = new THREE.Group(), y = std(0xffd23f, { roughness: .5 }); const b = new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 10), y); b.scale.set(1, .85, 1.3); g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(.08, 12, 10), y); h.position.set(0, .12, -.1); g.add(h); const bk = new THREE.Mesh(new THREE.ConeGeometry(.035, .09, 8), std(0xff7a1f)); bk.rotation.x = -Math.PI / 2; bk.position.set(0, .11, -.2); g.add(bk);
      const tg = new THREE.Mesh(new THREE.CircleGeometry(.09, 20), new THREE.MeshBasicMaterial({ map: (() => { const [c, gg] = cnv(64, 64); for (let r = 4; r > 0; r--) { gg.fillStyle = r % 2 ? '#d42020' : '#ffffff'; gg.beginPath(); gg.arc(32, 32, r * 7.5, 0, 7); gg.fill(); } return tex(c); })() })); tg.position.set(-.135, .02, 0); tg.rotation.y = -Math.PI / 2; g.add(tg);
      g.rotation.y = Math.PI / 2; G.add(g); SG.ducks.push({ g, s: k / 7, hit: 0 }); }
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.14, 16, 12), std([0xff2b7a, 0x2a8aff, 0xffd23f, 0x2bdf88][k], { roughness: .2, metalness: .1 })); b.scale.y = 1.2; G.add(b); const str = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .35), white0()); str.position.y = -.33; b.add(str); SG.balloons.push({ g: b, z: 8.8 + k * .8, ph: k * 1.7, hit: 0 }); }
    // le chamboule-tout : une pyramide de 10 boîtes (4, 3, 2, 1)
    const cg = new THREE.CylinderGeometry(CAN.r, CAN.r, CAN.h, 16);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 4 - row; i++) { const m = new THREE.Mesh(cg, std([0xff2b4a, 0x2a5aff, 0xffd23f, 0x2bdf88][(row + i) % 4], { metalness: .7, roughness: .3 })); const z = CAN.z + (i - (3 - row) / 2) * (CAN.r * 2 + .01), y = CAN.top + CAN.h / 2 + row * CAN.h; m.position.set(CAN.x, y, z); G.add(m); SG.cans.push({ m, home: [CAN.x, y, z], p: new THREE.Vector3(CAN.x, y, z), v: new THREE.Vector3(), awake: false, row }); }
    // la carabine (accrochée à la caméra quand on joue)
    const rf = new THREE.Group(); const stock = new THREE.Mesh(new THREE.BoxGeometry(.06, .08, .35), std(0x6b3a1a, { roughness: .6 })); stock.position.z = .15; rf.add(stock); const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .55, 10), std(0x222222, { metalness: .9, roughness: .3 })); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .03, -.25); rf.add(barrel);
    rf.position.set(.18, -.2, -.45); rf.visible = false; camera.add(rf); scene.add(camera); SG.rifle = rf;
  }
  const white0 = () => std(0xffffff);
  function resetCans() { for (const c of SG.cans) { c.p.set(...c.home); c.v.set(0, 0, 0); c.awake = false; c.m.position.copy(c.p); c.m.rotation.set(0, 0, 0); } for (const b of SG.balls) ZG.fair.remove(b.m); SG.balls = []; }
  function startStandGame(kind) {
    buildStandGames(); Object.assign(SG, { kind, shots: kind === 'tir' ? 10 : 3, score: 0, done: false }); if (kind === 'chamboule') resetCans();
    SG.ducks.forEach(d => { d.hit = 0; }); SG.balloons.forEach(b => { b.hit = 0; b.g.visible = true; });
    mode = 'game'; hidePanel(); hud.emotes.classList.add('hidden'); hud.joy.classList.add('hidden'); hud.game.classList.remove('hidden'); SG.rifle.visible = kind === 'tir'; renderGame();
    toast(kind === 'tir' ? (mobile() ? '🎯 Touche un canard ou un ballon pour tirer : 10 balles !' : '🎯 Clique sur un canard ou un ballon pour tirer : 10 balles !') : (mobile() ? '🥫 Touche l\'écran là où tu veux lancer la balle : fais tout tomber en 3 lancers !' : '🥫 Clique là où tu veux lancer la balle : fais tout tomber en 3 lancers !'));
  }
  function endStandGame() { mode = 'walk'; SG.kind = null; if (SG.rifle) SG.rifle.visible = false; hud.game.classList.add('hidden'); hud.emotes.classList.remove('hidden'); hud.joy.classList.toggle('hidden', !mobile()); }
  const PRIZES = ['🧸 un nounours géant', '🐰 un lapin en peluche', '🦄 une licorne en peluche', '🐻 un ours tout doux', '🐶 un petit chien en peluche', '🐬 un dauphin en peluche'];
  function renderGame() {
    const T = SG.kind === 'tir', knocked = SG.cans.filter(c => c.p.distanceTo(new THREE.Vector3(...c.home)) > .12).length;
    hud.gameTxt.textContent = T ? `🎯 Score : ${SG.score} · 🔫 ${SG.shots} balle${SG.shots > 1 ? 's' : ''}` : `🥫 ${knocked}/10 boîtes tombées · ⚾ ${SG.shots} balle${SG.shots > 1 ? 's' : ''}`;
    hud.gameAgain.classList.toggle('hidden', !SG.done);
  }
  function finishGame() {
    SG.done = true; const T = SG.kind === 'tir', knocked = SG.cans.filter(c => c.p.distanceTo(new THREE.Vector3(...c.home)) > .12).length;
    const win = T ? SG.score >= 7 : knocked === 10, prize = PRIZES[Math.random() * PRIZES.length | 0];
    if (win) { sDing(); setTimeout(sDing, 250); window.LC?.confetti?.(['🧸', '🎉', '✨']); socket.emit('cs_emote', '🧸'); toast(T ? `🏆 ${SG.score} cibles touchées : tu gagnes ${prize} !` : `🏆 Tout est tombé : tu gagnes ${prize} !`); }
    else toast(T ? `🎯 ${SG.score} cibles sur 10… il en faut 7 pour gagner une peluche. Rejoue !` : `🥫 ${knocked} boîtes sur 10… il faut tout faire tomber. Rejoue !`);
    renderGame();
  }
  const _rc = () => new THREE.Raycaster(), _nd = new (function () { this.x = 0; this.y = 0; })();
  function gameClick(e) {
    if (mode !== 'game' || SG.done || SG.shots <= 0) return; const r = canvas.getBoundingClientRect(), v = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), rc = _rc(); rc.setFromCamera(v, camera);
    if (SG.kind === 'tir') {
      SG.shots--; noise(.08, 2500, 1, .35); tone(220, 90, .08, .2); SG.flash = 1;
      const targets = [...SG.ducks.filter(d => !d.hit).map(d => ({ o: d.g, d })), ...SG.balloons.filter(b => !b.hit).map(b => ({ o: b.g, b }))];
      const hits = rc.intersectObjects(targets.map(t => t.o), true); if (hits.length) { const obj = hits[0].object; const t = targets.find(t => t.o === obj || t.o.getObjectById(obj.id)); if (t) { SG.score++; tone(880, 1320, .12, .15); if (t.d) t.d.hit = 1.2; else { t.b.hit = 1; t.b.g.visible = false; noise(.15, 1500, 1, .3); } } }
      renderGame(); if (SG.shots <= 0) setTimeout(finishGame, 600);
    } else {
      SG.shots--; const m = new THREE.Mesh(new THREE.SphereGeometry(.09, 14, 10), std(0xf4f0ea, { roughness: .6 })), p = camera.position.clone().addScaledVector(rc.ray.direction, .5);
      const vel = rc.ray.direction.clone().multiplyScalar(11); vel.y += 1.2; m.position.copy(p); ZG.fair.add(m); SG.balls.push({ m, p, v: vel, t: 0 }); noise(.1, 600, 1, .2); renderGame();
      if (SG.shots <= 0) setTimeout(finishGame, 3200);
    }
  }
  function gameFrame(dt, t) {
    // la caméra devant le stand
    if (SG.kind === 'tir') { camera.position.set(373.3, 1.75, 10); camera.lookAt(377.8, 1.85, 10); } else { camera.position.set(375.2, 1.7, 24); camera.lookAt(377.3, 1.55, 24); }
    if (SG.rifle) { SG.flash = Math.max(0, SG.flash - dt * 8); SG.rifle.position.z = -.45 + SG.flash * .05; SG.rifle.rotation.x = SG.flash * .15; }
    // les boîtes : la gravité, le comptoir, les chocs entre boîtes et avec les balles
    if (SG.kind === 'chamboule') {
      const onCounter = p => p.x > 376.15 && p.x < 377.95 && p.z > 22 && p.z < 26, R = CAN.r + .015, steps = 4, h = dt / steps;
      for (let s = 0; s < steps; s++) {
        for (const b of SG.balls) { b.v.y -= 9.8 * h; b.p.addScaledVector(b.v, h); if (b.p.y < .09) { b.p.y = .09; b.v.y *= -.3; b.v.multiplyScalar(.8); } if (onCounter(b.p) && b.p.y < CAN.top + .09 && b.p.y > CAN.top - .2) { b.p.y = CAN.top + .09; b.v.y *= -.3; } b.t += h;
          for (const c of SG.cans) { const d = c.p.clone().sub(b.p), dist = d.length(); if (dist < R + .09 && dist > 1e-4) { d.normalize(); const rel = b.v.dot(d) - c.v.dot(d); if (rel > 0) { c.v.addScaledVector(d, rel * 1.2); b.v.addScaledVector(d, -rel * .6); if (!c.awake) { c.awake = true; tone(500 + Math.random() * 300, 300, .08, .2); } } c.p.addScaledVector(d, (R + .09 - dist) * .5); } } }
        for (const c of SG.cans) { if (!c.awake) continue; c.v.y -= 9.8 * h; c.p.addScaledVector(c.v, h); const floor = onCounter(c.p) ? CAN.top + CAN.h / 2 : CAN.h / 2; if (c.p.y < floor) { c.p.y = floor; c.v.y *= -.25; c.v.x *= .9; c.v.z *= .9; } }
        for (let i = 0; i < SG.cans.length; i++) for (let j = i + 1; j < SG.cans.length; j++) { const A = SG.cans[i], B = SG.cans[j]; if (!A.awake && !B.awake) continue; const d = B.p.clone().sub(A.p), dist = d.length(); if (dist < R * 2 && dist > 1e-4) { d.normalize(); const push = (R * 2 - dist) / 2; if (A.awake) A.p.addScaledVector(d, -push); if (B.awake) B.p.addScaledVector(d, push); const rel = A.v.dot(d) - B.v.dot(d); if (rel > 0) { A.v.addScaledVector(d, -rel * .5); B.v.addScaledVector(d, rel * .5); if (!B.awake) B.awake = true; if (!A.awake) A.awake = true; } } }
        // une boîte du dessus tombe si celle du dessous n'est plus là
        for (const c of SG.cans) { if (c.awake || !c.row) continue; const below = SG.cans.filter(o => o.row === c.row - 1 && Math.abs(o.home[2] - c.home[2]) < CAN.r * 2.2); if (below.some(o => o.awake && o.p.distanceTo(new THREE.Vector3(...o.home)) > .05)) c.awake = true; }
      }
      for (const c of SG.cans) { c.m.position.copy(c.p); if (c.awake) { c.m.rotation.x += c.v.z * dt * 3; c.m.rotation.z -= c.v.x * dt * 3; } }
      for (const b of SG.balls) b.m.position.copy(b.p);
      SG.hudT = (SG.hudT || 0) + dt; if (SG.hudT > .25) { SG.hudT = 0; renderGame(); }
    }
  }
  function animTargets(dt, t) { // les canards défilent, les ballons flottent (aussi quand on ne joue pas)
    if (!SG.built || me.zone !== 'fair') return;
    for (const d of SG.ducks) { d.s = (d.s + dt * .12) % 1; const z = 8.3 + d.s * 3.4; d.g.position.set(377.7, 1.62, z); if (d.hit > 0) { d.hit -= dt; d.g.rotation.z = Math.min(1.5, (1.2 - d.hit) * 6); if (d.hit <= 0) d.g.rotation.z = 0; } }
    for (const b of SG.balloons) { b.g.position.set(377.75, 2.35 + Math.sin(t * 1.5 + b.ph) * .1, b.z); if (b.hit && !SG.kind) { b.hit = 0; b.g.visible = true; } }
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
      a.tag.set(`${window.ProxVoice?.speaking(id) ? '🔊 ' : ''}${people.get(id)?.k === 1 || (id === myId() && mode === 'kart') ? '🏎️ ' : ''}${name}${extra}${p.tag ? ' · ' + p.tag : ''}`, bot ? '#ffd23f' : id === myId() ? '#2bff88' : '#38e8ff');
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
      const inKart = a.id === myId() ? mode === 'kart' : people.get(a.id)?.k === 1; // en kart : on s'assoit dedans
      if (inKart && !a.kart) { a.kart = makeKart([0xd42020, 0x1c4fd8, 0xffd23f, 0x2bff88, 0xff2bd6, 0xff8a3d][Math.abs(a.id) % 6], Math.abs(a.id) % 100); scene.add(a.kart); const hm = new THREE.Mesh(new THREE.SphereGeometry(.17, 16, 12), std(0xffffff, { metalness: .3, roughness: .2 })); hm.position.set(0, 1.08, .3); a.kart.add(hm); }
      if (!inKart && a.kart) { scene.remove(a.kart); a.kart = null; }
      if (a.kart) { if (a.id === myId()) { a.x = a.tx; a.z = a.tz; a.yaw = a.tyaw; } a.kart.position.set(a.x, 0, a.z); a.kart.rotation.y = a.yaw; }
      const oy = a.y ?? 0; a.y = oy + ((a.ty || 0) - oy) * Math.min(1, dt * (a.id === myId() ? 30 : 8)); if (Math.abs(a.ty - a.y) > 3) a.y = a.ty; const vy = Math.abs(a.y - oy) / Math.max(dt, 1e-3);
      a.g.position.set(a.x - (a.kart ? Math.sin(a.yaw) * -.3 : 0), a.y - (a.kart ? .62 : 0), a.z - (a.kart ? Math.cos(a.yaw) * -.3 : 0)); a.g.rotation.y = a.yaw + Math.PI;
      a.spd = (a.spd || 0) + (Math.min(sp, 8) - (a.spd || 0)) * Math.min(1, dt * 6); // vitesse lissée
      const cur0 = a.cur === 'dance' ? 'idle' : a.cur, v = a.spd;
      const still = !!a.kart || vy > .3 || (a.id === myId() ? !!(me.ride || me.seat) : people.get(a.id)?.k === 2); // en kart, sur l'escalator ou assis : on ne marche pas
      const w = a.dance > 0 ? 'dance' : still ? 'idle' : cur0 === 'run' ? (v > 2.4 ? 'run' : v > .3 ? 'walk' : 'idle') : cur0 === 'walk' ? (v > 3.4 ? 'run' : v > .2 ? 'walk' : 'idle') : (v > 3.4 ? 'run' : v > .5 ? 'walk' : 'idle');
      if (a.dance > 0) a.dance -= dt;
      if (w !== a.cur && a.act[w]) { const n = a.act[w]; n.reset().play(); a.act[a.cur]?.crossFadeTo(n, .25, false); a.cur = w; }
      a.mixer.update(dt);
      a.tag.visible = camera.position.distanceTo(a.g.position) > (mode === 'walk' ? 1.5 : 2.4); // pas d'étiquette géante devant la caméra
      if (a.bubble && a.bubbleT > 0) { a.bubbleT -= dt; if (a.bubbleT <= 0) a.bubble.visible = false; }
      a.g.visible = !(a.id === myId() && (mode === 'ride' || mode === 'seat' || mode === 'poker' || (mode === 'pool' && myTurnPool() && poolView !== 'top')));
    }
  }

  // ---------- 🚪 entrer / sortir ----------
  async function open(opts = {}) {
    const want = opts.zone || (opts.cine ? 'cine' : null);
    if (active) { if (want && me.zone !== want) goZone(want); return; } if (!window.City3D?.kit) return toast('😕 La 3D ne marche pas sur cet appareil');
    active = true; mode = 'walk'; poolT = -1;
    ov = el('div', { class: 'lgame cs' }, el('div', { class: 'lg-load' }, el('div', { class: 'lg-logo' }, '🎰'), el('b', {}, 'On ouvre les portes du Paradise Complex…'))); document.body.append(ov); document.body.classList.add('casino-open');
    try { K = await window.City3D.kit(); THREE = K.THREE;
      const V = '/js/vendor/jsm/', [RBm, EC, RP, UB, OP] = await Promise.all([import(V + 'geometries/RoundedBoxGeometry.js'), import(V + 'postprocessing/EffectComposer.js'), import(V + 'postprocessing/RenderPass.js'), import(V + 'postprocessing/UnrealBloomPass.js'), import(V + 'postprocessing/OutputPass.js')]);
      LIB2 = { RoundedBoxGeometry: RBm.RoundedBoxGeometry, EffectComposer: EC.EffectComposer, RenderPass: RP.RenderPass, UnrealBloomPass: UB.UnrealBloomPass, OutputPass: OP.OutputPass }; } catch (e) { console.warn(e); toast('😕 La 3D ne marche pas sur cet appareil'); return close(); }
    if (!active) return;
    const d = await ack('cs_enter', {}); if (!active) return; if (d.error) { toast(d.error); return close(); }
    canvas = el('canvas', { class: 'lg-cv' });
    R = new THREE.WebGLRenderer({ canvas, antialias: !mobile(), powerPreference: 'high-performance' }); R.setPixelRatio(Math.min(devicePixelRatio || 1, mobile() ? 1.35 : 1.75));
    R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
    avatars.clear(); people.clear(); build(); applyEnter(d);
    try { composer = new LIB2.EffectComposer(R); composer.addPass(new LIB2.RenderPass(scene, camera)); bloom = new LIB2.UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .75, .45, 1.05); composer.addPass(bloom); composer.addPass(new LIB2.OutputPass()); } catch (e) { console.warn('bloom', e); composer = null; }
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
    ytOn = ''; engine(false); try { composer?.dispose?.(); } catch (e) {} composer = null; fairLights = []; try { R?.dispose(); } catch (e) {} R = null; scene = null; ov?.remove(); ov = null; avatars.clear(); people.clear(); tables.length = 0; pk.meshes = null; pk.st = null;
    document.body.classList.remove('casino-open'); mode = 'walk'; window.ProxVoice?.use('casino', null);
  }
  function leave() { socket.emit('cs_leave'); close(); }
  const fit = () => { if (!R) return; const w = innerWidth, h = innerHeight; R.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); if (composer) { composer.setSize(w, h); bloom?.resolution.set(w / 2, h / 2); } };
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
    hud.gameTxt = el('b', {}); hud.gameAgain = el('button', { class: 'btn btn-sm btn-primary hidden', onclick: () => startStandGame(SG.kind) }, '🔁 Rejouer');
    hud.game = el('div', { class: 'cs-ride hidden' }, hud.gameTxt, hud.gameAgain, el('button', { class: 'btn btn-sm', onclick: () => backToWalk() }, '🚶 Partir'));
    hud.rideTxt = el('b', {}); hud.ride = el('div', { class: 'cs-ride hidden' }, hud.rideTxt, el('button', { class: 'btn btn-sm', onclick: () => backToWalk() }, '🚶 Descendre'));
    hud.kart = el('div', { class: 'cs-kart hidden' }, hud.kartSpd, hud.kartLap, hud.kartBest, el('div', { class: 'cs-krow' }, el('button', { class: 'btn btn-sm', onclick: () => kartBoardPanel() }, '🏁 Classement'), el('button', { class: 'btn btn-sm', onclick: () => backToWalk() }, '🚶 Descendre du kart')));
    const tvBtns = el('div', { class: 'cs-tv' }, hud.zoneBtn, el('button', { class: 'cs-tvb yt', onclick: () => ytPanel() }, '📺 YouTube'), hud.mute);
    const box = el('div', { class: 'lg-hud cs-hud' }, hud.frame, hud.kart, hud.ride, hud.game, tvBtns, window.ProxVoice ? ProxVoice.button('cs-pv') : null, window.Needs ? Needs.bar('cs-nd') : null, hud.top, hud.emotes, hud.act, hud.poolTop, hud.pool, hud.poker, hud.panel, hud.hint, quit);
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
  function renderTop() { const n = people.size, k = salleAt(me.x, me.z); hud.top.textContent = me.zone === 'hall' ? `🏬 Paradise Complex · ${me.lvl ? 'Niveau 1' : 'Niveau 0'} · ${n} joueur${n > 1 ? 's' : ''}` : me.zone === 'night' ? '🪩 The Paradise Night' : me.zone === 'kart' ? '🏎️ Paradise Karting' : me.zone === 'aqua' ? '🐠 Paradise Aquarium' : me.zone === 'zoo' ? '🦁 Paradise Zoo' : me.zone === 'fair' ? '🎡 Fête foraine' : me.zone === 'cine' ? (k >= 0 ? `🎬 Paradise Ciné · Salle ${k + 1}` : `🎬 Paradise Ciné · ${me.lvl ? 'Étage des salles' : 'Hall'}`) : '🎰 Casino & jeux'; }
  function doAct() { if (mode === 'seat') return standUp(); if (mode === 'kart' || mode === 'ride' || mode === 'game') return; if (nearSpot && mode === 'walk') { ac(); nearSpot.act(); } }
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
    if (mode === 'game') return endStandGame();
    if (mode === 'ride') return leaveRide();
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
    if (mode === 'ride') { ride.look.yaw = Math.max(-2.6, Math.min(2.6, ride.look.yaw - dx * .006)); ride.look.pitch = Math.max(-.9, Math.min(.9, ride.look.pitch - dy * .004)); }
  };
  const onUp = e => {
    if (!drag || e.pointerId !== drag.id) return; const tap = drag.moved < 10; drag = null;
    if (tap && mode === 'game') return gameClick(e);
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
      me.z = z; me.y = Math.max(0, Math.min(1, (e.z0 - z) / Dz)) * e.h + (z < e.z0 && z > e.z1 ? .09 : 0); me.yaw = R0.dir > 0 ? 0 : Math.PI; // les pieds posés sur la marche
      if (u >= 1) { me.lvl = R0.dir > 0 ? 1 : 0; me.y = me.lvl ? e.h : 0; me.z = R0.dir > 0 ? e.z1 - .75 : e.z0 + .9; me.ride = null;
        if (me.lvl) toast(e.zone === 'cine' ? '🎬 Les salles sont devant toi : entre, assieds-toi et lance un film !' : '🪩 À l\'étage : la boîte de nuit (à gauche) et le cinéma (à droite) !'); }
      if (ts - lastSend > 90) { lastSend = ts; socket.emit('cs_move', { x: me.x, z: me.z, y: me.y, yaw: me.yaw }); }
    }
    if (mode === 'seat' && (keys.size || stick.on)) standUp();
    if (mode === 'kart') driveKart(dt, ts);
    R.toneMappingExposure = me.zone === 'night' ? 1.05 + strobe * 2.5 : me.zone === 'kart' ? 1.15 : me.zone === 'zoo' ? 1.0 : me.zone === 'aqua' ? 1.25 : me.zone === 'fair' ? .95 : 1.05;
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
        const sl = window.Needs?.slow?.() || 1, vx = (fx * f + rx * s) * SPEED * sl, vz = (fz * f + rz * s) * SPEED * sl, dx = vx * dt, dz = vz * dt;
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
    } else if (mode === 'game') {
      gameFrame(dt, t);
    } else if (mode === 'ride') {
      rideFrame(dt, ts);
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
    if (composer && (me.zone === 'fair' || me.zone === 'night')) composer.render(); else R.render(scene, camera);
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
  return { open, active: () => active && !paused, go: { poolSit, pokerSit, drinkMenu, slotGame, goTo, tp: (x, z) => { me.x = x; me.z = z; }, goCine, goZone, takeKart, boardRide, startStandGame, shoot: (x, y) => gameClick({ clientX: x, clientY: y }), proj: w => { const L = w === 'cans' ? SG.cans.map(c => c.m) : SG.ducks.filter(d => !d.hit).map(d => d.g); return L.map(o => { const v = o.getWorldPosition(new THREE.Vector3()).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }); }, sg: () => ({ score: SG.score, shots: SG.shots, done: SG.done, down: SG.cans.filter(c => c.p.distanceTo(new THREE.Vector3(...c.home)) > .12).length }), sitDown, me: () => ({ ...me }), set: o => Object.assign(me, o), av: () => { const a = avatars.get(myId()); return a && { cur: a.cur, spd: +(a.spd || 0).toFixed(2), y: +(a.y || 0).toFixed(2), ty: a.ty, w: Object.fromEntries(Object.entries(a.act).map(([k, x]) => [k, [+x.getEffectiveWeight().toFixed(2), x.isRunning(), +x.time.toFixed(2), x.enabled]])) }; } } };
})();
window.Casino = Casino;
