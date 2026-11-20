// The Paradise — 🏙️ La Ville en vraie 3D : immeubles, gratte-ciel, rues avec trottoirs et passages piétons, lampadaires,
// voitures qui circulent, personnages en 3D… et on peut conduire une voiture ! Vue à la 3ᵉ personne ou à la 1ʳᵉ personne.
// La bibliothèque 3D (three.js) n'est chargée que si on choisit la vue 3D.
const City3D = (() => {
  let mode = 'top'; // 'top' = vue du dessus (2D) · 'third' = 3ᵉ personne · 'first' = 1ʳᵉ personne
  try { mode = localStorage.getItem('lc_city_view') || 'top'; } catch (e) {}
  let THREE = null, R = null, scene = null, camera = null, canvas = null, A = null, built = false, pad = null, carBtn = null;
  let yaw = 0, pitch = -0.08, pos = { x: 0, y: 0 }, bob = 0, driving = false, speed = 0, lift = 0, lastSky = 0, starting = false, ray = null;
  const people = new Map(), solids = [], cars = [], winMats = [];
  const mobile = () => innerWidth < 700;
  const FLOOR = 42, HUMAN = 1; // hauteur d'un étage · taille des personnages
  const rnd = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/js/vendor/three.min.js'; s.onload = () => res(window.THREE); s.onerror = () => rej(new Error('3D indisponible')); document.head.append(s); });
  }
  // ---------- le bouton « 🎥 Vue » en haut de la Ville ----------
  const LABEL = { top: ['🗺️', 'Vue du dessus'], third: ['🎥', '3ᵉ personne'], first: ['👀', '1ʳᵉ personne'] };
  function ensureButton() {
    const root = window.Island?.root?.(); if (!root || !window.Island.isOpen()) return;
    const top = root.querySelector('.isl-top'); if (!top) return;
    let b = top.querySelector('.isl-cam');
    if (!b) { b = el('button', { class: 'btn btn-sm isl-cam', title: 'Changer de vue', onclick: () => cycle() }); top.insertBefore(b, top.querySelector('.isl-zoom') || null); }
    b.textContent = LABEL[mode][0] + ' ' + (mobile() ? '' : LABEL[mode][1]);
    b.classList.toggle('hidden', window.Island.kind() !== 'island');
  }
  function cycle() { setMode({ top: 'third', third: 'first', first: 'top' }[mode]); }
  async function setMode(m, quiet) {
    mode = m; try { localStorage.setItem('lc_city_view', m); } catch (e) {}
    ensureButton();
    if (m === 'top') return stop();
    if (!quiet) toast(m === 'first' ? '👀 Vue à la 1ʳᵉ personne : tu vois la Ville par tes yeux' : '🎥 Vue à la 3ᵉ personne · 🚗 touche « Conduire » pour prendre une voiture');
    try { THREE = await loadThree(); } catch (e) { toast('😕 La 3D ne marche pas sur cet appareil'); mode = 'top'; return ensureButton(); }
    start();
  }
  // ---------- démarrage ----------
  function start() {
    const root = window.Island.root(); if (!root) return;
    A = window.Island.api3d();
    if (!canvas) {
      canvas = el('canvas', { class: 'isl-3d' }); root.insertBefore(canvas, root.querySelector('canvas').nextSibling);
      R = new THREE.WebGLRenderer({ canvas, antialias: !mobile(), powerPreference: 'high-performance' });
      R.setPixelRatio(Math.min(devicePixelRatio || 1, mobile() ? 1.25 : 1.75));
      R.outputColorSpace = THREE.SRGBColorSpace;
      if (!mobile()) { R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; }
      camera = new THREE.PerspectiveCamera(65, 1, 2, 12000);
      addEventListener('resize', fit);
      let drag = null; // regarder autour : on fait glisser le doigt ou la souris
      canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture?.(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!drag) return; yaw -= (e.clientX - drag.x) * .006; pitch = Math.max(-.7, Math.min(.5, pitch - (e.clientY - drag.y) * .004)); drag = { x: e.clientX, y: e.clientY }; });
      const end = () => { drag = null; }; canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      buildPad(root);
      carBtn = el('button', { class: 'btn car3d', onclick: () => toggleCar() }, '🚗 Conduire'); root.append(carBtn);
    }
    if (!built) build();
    canvas.classList.remove('hidden'); pad.classList.remove('hidden'); carBtn.classList.remove('hidden'); root.classList.add('view3d');
    const m = A.players.get(A.me); if (m) pos = { x: m.x, y: m.y };
    fit(); window.Island.set3d({ step });
  }
  function stop() {
    window.Island?.set3d?.(null);
    canvas?.classList.add('hidden'); pad?.classList.add('hidden'); carBtn?.classList.add('hidden'); window.Island?.root?.()?.classList.remove('view3d');
    if (driving) toggleCar();
  }
  function fit() { if (!canvas || !R) return; const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; R.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 78 : 62; camera.updateProjectionMatrix(); }
  const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };

  // ---------- 🛣️ le sol : herbe, rues, trottoirs, passages piétons, la grande place et le lac ----------
  function makeGround() {
    const k = mobile() ? .34 : .5, [c, g] = cnv(Math.round(A.W * k), Math.round(A.H * k)); g.scale(k, k);
    g.fillStyle = '#5f9e4a'; g.fillRect(0, 0, A.W, A.H);
    for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() < .5 ? 'rgba(40,90,30,.18)' : 'rgba(150,200,110,.14)'; g.beginPath(); g.arc(rnd() * A.W, rnd() * A.H, 6 + rnd() * 26, 0, 7); g.fill(); }
    const RW = 92, SW = 26;
    g.fillStyle = '#b9b9bf'; // les trottoirs
    for (const y of A.STREETS_Y) g.fillRect(0, y - RW / 2 - SW, A.W, RW + SW * 2);
    for (const x of A.STREETS_X) g.fillRect(x - RW / 2 - SW, 0, RW + SW * 2, A.H);
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2;
    for (const y of A.STREETS_Y) for (let x = 0; x < A.W; x += 30) { g.beginPath(); g.moveTo(x, y - RW / 2 - SW); g.lineTo(x, y - RW / 2); g.moveTo(x, y + RW / 2); g.lineTo(x, y + RW / 2 + SW); g.stroke(); }
    for (const x of A.STREETS_X) for (let y = 0; y < A.H; y += 30) { g.beginPath(); g.moveTo(x - RW / 2 - SW, y); g.lineTo(x - RW / 2, y); g.moveTo(x + RW / 2, y); g.lineTo(x + RW / 2 + SW, y); g.stroke(); }
    g.fillStyle = '#3b3d44'; // l'asphalte
    for (const y of A.STREETS_Y) g.fillRect(0, y - RW / 2, A.W, RW);
    for (const x of A.STREETS_X) g.fillRect(x - RW / 2, 0, RW, A.H);
    for (let i = 0; i < 9000; i++) { g.fillStyle = rnd() < .5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.08)'; const y = A.STREETS_Y[i % A.STREETS_Y.length] - RW / 2 + rnd() * RW; g.fillRect(rnd() * A.W, y, 3, 3); }
    g.strokeStyle = '#f2f2f2'; g.lineWidth = 3; g.setLineDash([26, 22]); // les pointillés au milieu
    for (const y of A.STREETS_Y) { g.beginPath(); g.moveTo(0, y); g.lineTo(A.W, y); g.stroke(); }
    for (const x of A.STREETS_X) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, A.H); g.stroke(); }
    g.setLineDash([]); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; // les lignes de bord
    for (const y of A.STREETS_Y) for (const d of [-RW / 2 + 5, RW / 2 - 5]) { g.beginPath(); g.moveTo(0, y + d); g.lineTo(A.W, y + d); g.stroke(); }
    for (const x of A.STREETS_X) for (const d of [-RW / 2 + 5, RW / 2 - 5]) { g.beginPath(); g.moveTo(x + d, 0); g.lineTo(x + d, A.H); g.stroke(); }
    for (const x of A.STREETS_X) for (const y of A.STREETS_Y) { // les carrefours et leurs passages piétons
      g.fillStyle = '#3b3d44'; g.fillRect(x - RW / 2, y - RW / 2, RW, RW);
      g.fillStyle = '#f4f4f4';
      for (let i = -RW / 2 + 8; i < RW / 2 - 8; i += 14) { g.fillRect(x + i, y - RW / 2 - 22, 8, 18); g.fillRect(x + i, y + RW / 2 + 4, 8, 18); g.fillRect(x - RW / 2 - 22, y + i, 18, 8); g.fillRect(x + RW / 2 + 4, y + i, 18, 8); }
    }
    const P = A.PLAZA; g.fillStyle = '#d8cbb3'; g.beginPath(); g.arc(P.x, P.y, P.r + 40, 0, 7); g.fill(); // la grande place
    g.strokeStyle = 'rgba(120,100,70,.35)'; g.lineWidth = 2; for (let r = 30; r < P.r + 40; r += 22) { g.beginPath(); g.arc(P.x, P.y, r, 0, 7); g.stroke(); }
    const L = A.LAKE; g.fillStyle = '#c9b98f'; g.beginPath(); g.ellipse(L.x, L.y, L.rx + 18, L.ry + 14, 0, 0, 7); g.fill(); // le lac
    const gr = g.createRadialGradient(L.x, L.y, 10, L.x, L.y, L.rx); gr.addColorStop(0, '#1f7fc4'); gr.addColorStop(1, '#3aa3e0'); g.fillStyle = gr; g.beginPath(); g.ellipse(L.x, L.y, L.rx, L.ry, 0, 0, 7); g.fill();
    return c;
  }
  // ---------- 🏢 les façades : béton, briques ou verre, avec des fenêtres (allumées la nuit) ----------
  const FACADES = [['#d9d4cc', '#8fb6d6'], ['#b5552e', '#9fc1db'], ['#e8e2d6', '#7aa0c4'], ['#5b6b80', '#a9d3f5'], ['#c9b28f', '#89a9c9'], ['#2f3e52', '#7fc8ff'], ['#efe9e1', '#a3c2dd'], ['#8a8f99', '#b8d8f0']];
  const facadeTex = new Map();
  function facade(i, lit) {
    const key = i + ':' + lit; if (facadeTex.has(key)) return facadeTex.get(key);
    const [wall, glass] = FACADES[i % FACADES.length], [c, g] = cnv(128, 128);
    g.fillStyle = wall; g.fillRect(0, 0, 128, 128);
    if (i % FACADES.length === 1) { g.strokeStyle = 'rgba(60,20,10,.25)'; g.lineWidth = 1; for (let y = 0; y < 128; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); } } // des briques
    for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) {
      const x = 14 + k * 64, y = 14 + r * 64, on = lit && ((i * 7 + r * 3 + k * 5) % 3 !== 0);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 3, y - 3, 42, 42);
      const gl = g.createLinearGradient(x, y, x + 36, y + 36); gl.addColorStop(0, on ? '#ffe9a8' : glass); gl.addColorStop(1, on ? '#f5c35a' : '#3d5e80');
      g.fillStyle = gl; g.fillRect(x, y, 36, 36); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, y, 36, 3); g.fillStyle = wall; g.fillRect(x + 17, y, 2, 36);
    }
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; facadeTex.set(key, t); return t;
  }
  // une vitrine au rez-de-chaussée, avec l'enseigne lumineuse
  function storefront(name, icon, col) {
    const [c, g] = cnv(512, 256);
    g.fillStyle = '#2a2a30'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#14141a'; rr(g, 20, 12, 472, 70, 14); g.fill(); g.strokeStyle = col; g.lineWidth = 5; g.stroke();
    g.font = '900 46px Outfit, Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = 18; g.fillStyle = col; g.fillText(`${icon} ${name}`, 256, 48, 450); g.shadowBlur = 0;
    for (const x of [24, 300]) { const gl = g.createLinearGradient(x, 100, x + 190, 250); gl.addColorStop(0, '#bfe3ff'); gl.addColorStop(1, '#4f7ea8'); g.fillStyle = gl; g.fillRect(x, 100, 188, 150); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 10, 104, 16, 140); }
    g.fillStyle = '#5a3a1c'; g.fillRect(222, 120, 68, 136); g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(278, 190, 5, 0, 7); g.fill();
    return tex(c);
  }
  function signTex(text, col) {
    const [c, g] = cnv(512, 128); g.fillStyle = 'rgba(15,10,30,.88)'; rr(g, 6, 6, 500, 116, 22); g.fill(); g.strokeStyle = col; g.lineWidth = 6; g.stroke();
    g.font = '900 54px Outfit, Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = 20; g.fillStyle = col; g.fillText(text, 256, 66, 470);
    return tex(c);
  }
  const lit = () => A.nightLevel() > .35;
  // un immeuble : murs avec fenêtres, toit, rebord, et parfois une clim sur le toit
  function building(x, z, w, d, floors, fi, opt = {}) {
    const h = floors * FLOOR + (opt.shop ? 14 : 0);
    const side = new THREE.MeshLambertMaterial({ map: facade(fi, lit()).clone() }); side.map.needsUpdate = true; side.map.repeat.set(Math.max(1, Math.round(w / 40)), floors); winMats.push({ m: side, fi });
    const sideD = new THREE.MeshLambertMaterial({ map: facade(fi, lit()).clone() }); sideD.map.needsUpdate = true; sideD.map.repeat.set(Math.max(1, Math.round(d / 40)), floors); winMats.push({ m: sideD, fi });
    const roof = new THREE.MeshLambertMaterial({ color: new THREE.Color(FACADES[fi % FACADES.length][0]).multiplyScalar(.7) });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideD, sideD, roof, roof, side, side]);
    m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = !mobile(); scene.add(m); solids.push(m);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 6, 5, d + 6), roof); lip.position.set(x, h + 2, z); scene.add(lip);
    if (floors > 3 && rnd() < .6) { const ac = new THREE.Mesh(new THREE.BoxGeometry(w * .25, 12, d * .25), new THREE.MeshLambertMaterial({ color: 0x9aa0aa })); ac.position.set(x + w * .2, h + 10, z - d * .1); scene.add(ac); }
    return { m, h };
  }
  // ---------- on construit toute la ville ----------
  let hemi = null, sun = null, skyMat = null, skyGeo = null;
  function build() {
    built = true;
    scene = new THREE.Scene();
    hemi = new THREE.HemisphereLight(0xdfefff, 0x4a6a3a, .95); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff2d8, 1.1); sun.position.set(-600, 1200, 900);
    if (!mobile()) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 10, far: 4000 }); sun.shadow.bias = -.0006; }
    scene.add(sun); scene.add(sun.target);
    // le ciel : un grand dôme en dégradé
    skyGeo = new THREE.SphereGeometry(10000, 24, 12); const cols = [];
    skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
    for (let i = 0; i < skyGeo.attributes.position.count; i++) cols.push(1, 1, 1);
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); const dome = new THREE.Mesh(skyGeo, skyMat); dome.position.set(A.W / 2, 0, A.H / 2); dome.renderOrder = -1; scene.add(dome);
    // le sol et la mer
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(A.W, A.H), new THREE.MeshLambertMaterial({ map: tex(makeGround()) }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(A.W / 2, 0, A.H / 2); ground.receiveShadow = !mobile(); scene.add(ground);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshLambertMaterial({ color: 0x1f6fb5 })); sea.rotation.x = -Math.PI / 2; sea.position.set(A.W / 2, -3, A.H / 2); scene.add(sea);
    // 🏪 les boutiques : de vrais immeubles avec leur vitrine, leur auvent et leur enseigne
    for (const o of A.shops) {
      const [name, icon, col] = A.SHOP_TYPES[o.k], floors = o.h > .5 ? 3 + Math.round(o.h * 4) : 2, sf = new THREE.MeshLambertMaterial({ map: storefront(name, icon, col) });
      building(o.x, o.y - 50, 124, 96, floors, o.k, { shop: true });
      for (const [z, ry] of [[o.y + 1.5, 0], [o.y - 101.5, Math.PI]]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(124, 62), sf); f.position.set(o.x, 31, z); f.rotation.y = ry; scene.add(f); }
      const aw = new THREE.Mesh(new THREE.BoxGeometry(128, 5, 18), new THREE.MeshLambertMaterial({ color: col })); aw.position.set(o.x, 64, o.y + 8); aw.rotation.x = .25; scene.add(aw);
    }
    // 🏙️ les tours du quartier des affaires
    for (const tw of A.TOWERS) building(tw[0], tw[1] - 50, 110, 100, 8 + tw[3] * 2, 3 + (tw[3] % 3) * 2);
    // 📍 les lieux : des bâtiments avec leur enseigne néon (club, cinéma, café, salons…)
    for (const p of A.PLACES) {
      const col = p.c === 'rainbow' ? '#ff4fd8' : p.c === 'gold' ? '#ffd34d' : p.c, big = p.big || p.inst;
      const w = big ? 190 : 120, d = big ? 120 : 90, floors = big ? 3 : 2, z = p.y - 10 - d / 2;
      const b = building(p.x, z, w, d, floors, (p.label.length * 3) % FACADES.length);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w + 20, 34), new THREE.MeshBasicMaterial({ map: signTex(`${p.icon} ${p.label}`, col), transparent: true })); s.position.set(p.x, b.h + 26, z + d / 2 - 4); scene.add(s);
      const s2 = s.clone(); s2.rotation.y = Math.PI; s2.position.z = z - d / 2 + 4; scene.add(s2);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(40, 56), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(.9) })); door.position.set(p.x, 28, z + d / 2 + 1); scene.add(door);
      const neon = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 2, b.h + 2, d + 2)), new THREE.LineBasicMaterial({ color: col })); neon.position.set(p.x, b.h / 2, z); scene.add(neon);
    }
    // 🌆 au loin, les gratte-ciel de la grande ville (on ne peut pas y aller, mais ça fait vrai)
    for (let i = 0; i < 90; i++) {
      const sd = i % 4, t = rnd(), far = 260 + rnd() * 900;
      const x = sd === 0 ? t * A.W : sd === 1 ? A.W + far : sd === 2 ? t * A.W : -far, z = sd === 0 ? -far : sd === 1 ? t * A.H : sd === 2 ? A.H + far : t * A.H, w = 120 + rnd() * 160;
      building(x, z, w, w * (.7 + rnd() * .5), 10 + Math.round(rnd() * 30), Math.floor(rnd() * 8));
    }
    // 🌳 les arbres, 💡 les lampadaires
    const N = A.palms.length;
    if (N) {
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(4, 6, 46, 6), new THREE.MeshLambertMaterial({ color: 0x6b4423 }), N);
      const leaf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(30, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), N);
      const q = new THREE.Object3D();
      A.palms.forEach((p, i) => { const s = (p.s || 1) * (.9 + rnd() * .4); q.position.set(p.x, 23 * s, p.y); q.scale.setScalar(s); q.rotation.set(0, 0, 0); q.updateMatrix(); trunk.setMatrixAt(i, q.matrix); q.position.y = 60 * s; q.rotation.y = rnd() * 6; q.updateMatrix(); leaf.setMatrixAt(i, q.matrix); leaf.setColorAt(i, new THREE.Color().setHSL(.27 + rnd() * .07, .55, .28 + rnd() * .1)); });
      trunk.castShadow = leaf.castShadow = !mobile(); scene.add(trunk, leaf);
    }
    const NL = A.lamps.length;
    if (NL) {
      const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.6, 2.2, 74, 6), new THREE.MeshLambertMaterial({ color: 0x2a2e36 }), NL);
      const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), NL);
      const q = new THREE.Object3D();
      A.lamps.forEach((l, i) => { q.position.set(l.x, 37, l.y); q.updateMatrix(); pole.setMatrixAt(i, q.matrix); q.position.y = 76; q.updateMatrix(); heads.setMatrixAt(i, q.matrix); heads.setColorAt(i, new THREE.Color(l.c)); });
      scene.add(pole, heads);
    }
    // 🚗 les voitures qui roulent dans les rues
    const CC = [0xd62d2d, 0x2f6fd6, 0xf2f2f2, 0x1c1c22, 0xffcc00, 0x34a853, 0x9aa0aa, 0xff7a00];
    for (let i = 0; i < (mobile() ? 26 : 44); i++) {
      const horiz = i % 2 === 0, lines = horiz ? A.STREETS_Y : A.STREETS_X, line = lines[Math.floor(i / 2) % lines.length], dir = (i >> 1) % 2 ? 1 : -1;
      const car = carMesh(CC[i % CC.length]); scene.add(car);
      cars.push({ car, horiz, line: line + dir * 22, dir, off: rnd() * (horiz ? A.W : A.H), sp: 120 + rnd() * 110 });
    }
    sky();
  }
  function carMesh(color) {
    const g = new THREE.Group(), paint = new THREE.MeshLambertMaterial({ color }), dark = new THREE.MeshLambertMaterial({ color: 0x15161a }), glass = new THREE.MeshLambertMaterial({ color: 0x8fb8d8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(72, 16, 34), paint); body.position.y = 14; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(38, 14, 30), glass); cab.position.set(-4, 29, 0); g.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(32, 3, 30), paint); roof.position.set(-4, 37, 0); g.add(roof);
    for (const x of [-24, 24]) for (const z of [-17, 17]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 6, 10), dark); w.rotation.x = Math.PI / 2; w.position.set(x, 7, z); g.add(w); }
    const head = new THREE.MeshBasicMaterial({ color: 0xfff6d0 }), tail = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    for (const z of [-11, 11]) { const h = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 7), head); h.position.set(36.5, 16, z); g.add(h); const t = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 7), tail); t.position.set(-36.5, 16, z); g.add(t); }
    g.traverse(o => { if (o.isMesh) o.castShadow = !mobile(); });
    return g;
  }
  function sky() {
    const n = A.nightLevel(), top = new THREE.Color('#3f86d6').lerp(new THREE.Color('#050a24'), n), hor = new THREE.Color('#cfe8ff').lerp(new THREE.Color('#1b2350'), n);
    const p = skyGeo.attributes.position, c = skyGeo.attributes.color;
    for (let i = 0; i < p.count; i++) { const k = Math.max(0, p.getY(i) / 10000); const col = hor.clone().lerp(top, Math.pow(k, .6)); c.setXYZ(i, col.r, col.g, col.b); }
    c.needsUpdate = true;
    scene.fog = new THREE.Fog(hor, 1500, 7000);
    hemi.intensity = .95 - n * .6; sun.intensity = 1.1 - n * .9;
    for (const w of winMats) { const t = facade(w.fi, lit()).clone(); t.needsUpdate = true; t.repeat.copy(w.m.map.repeat); w.m.map = t; w.m.needsUpdate = true; } // les fenêtres s'allument la nuit
  }
  // ---------- 🧍 les personnages en 3D ----------
  const SKIN = ['#f1c7a4', '#e0ac85', '#c68863', '#8d5a3b', '#5c3a24'];
  function human(p) {
    const g = new THREE.Group(), id = p.id || 0, shirt = new THREE.MeshLambertMaterial({ color: p.color || '#8b6cff' }), pants = new THREE.MeshLambertMaterial({ color: 0x2a3550 }), skin = new THREE.MeshLambertMaterial({ color: SKIN[id % SKIN.length] }), hair = new THREE.MeshLambertMaterial({ color: ['#2a1a10', '#6b3f1f', '#e0b04a', '#151515', '#a0522d'][id % 5] }), shoe = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const legL = new THREE.Group(), legR = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group();
    for (const [L, x] of [[legL, -5], [legR, 5]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(8, 26, 9), pants); m.position.y = -13; L.add(m); const s = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 13), shoe); s.position.set(0, -27, 2); L.add(s); L.position.set(x, 30, 0); g.add(L); }
    const body = new THREE.Mesh(new THREE.BoxGeometry(20, 24, 11), shirt); body.position.y = 43; g.add(body);
    for (const [Ar, x] of [[armL, -13.5], [armR, 13.5]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(6, 22, 7), shirt); m.position.y = -10; Ar.add(m); const h = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), skin); h.position.y = -23; Ar.add(h); Ar.position.set(x, 54, 0); g.add(Ar); }
    const head = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 13), skin); head.position.y = 63; g.add(head);
    const hr = new THREE.Mesh(new THREE.BoxGeometry(15, 6, 14), hair); hr.position.y = 71; g.add(hr);
    const bk = new THREE.Mesh(new THREE.BoxGeometry(15, 10, 3), hair); bk.position.set(0, 66, -6.5); g.add(bk);
    for (const x of [-3.5, 3.5]) { const e = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 1), new THREE.MeshBasicMaterial({ color: 0x111111 })); e.position.set(x, 64, 6.6); g.add(e); }
    g.traverse(o => { if (o.isMesh) o.castShadow = !mobile(); });
    g.scale.setScalar(HUMAN);
    return { g, legL, legR, armL, armR };
  }
  function tag(p, o) {
    const said = p.said && Date.now() - (p.saidAt || 0) < 7000 ? p.said : '', key = (p.username || '') + '|' + said + '|' + (p.role || '') + (p.gender || '');
    if (o.tagKey === key) return; o.tagKey = key;
    const W = 512, H = 256, c = o.tagC || (o.tagC = document.createElement('canvas')); c.width = W; c.height = H; const g = c.getContext('2d');
    g.clearRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'middle';
    const col = (p.role === 'admin' || p.role === 'superadmin') ? '#ff2d55' : p.gender === 'f' ? '#ff4fd8' : p.gender === 'h' ? '#2fa8ff' : '#c3b8ff';
    g.font = '900 46px Outfit, Inter, sans-serif'; const nm = p.username || '', tw = Math.min(W - 20, g.measureText(nm).width + 40);
    g.fillStyle = 'rgba(15,8,30,.72)'; rr(g, W / 2 - tw / 2, H - 70, tw, 62, 31); g.fill(); g.strokeStyle = col; g.lineWidth = 3; g.stroke();
    g.shadowColor = col; g.shadowBlur = 14; g.fillStyle = col; g.fillText(nm, W / 2, H - 38, W - 40); g.shadowBlur = 0;
    if (said) {
      g.font = '700 34px Outfit, Inter, sans-serif'; const words = said.split(' '), lines = []; let line = '';
      for (const w of words) { const t2 = line ? line + ' ' + w : w; if (g.measureText(t2).width > W - 80 && line) { lines.push(line); line = w; } else line = t2; } if (line) lines.push(line);
      const L = lines.slice(0, 3), bw = Math.min(W - 16, Math.max(...L.map(l => g.measureText(l).width)) + 40), bh = L.length * 40 + 22, by = H - 84 - bh;
      g.fillStyle = '#ffffff'; rr(g, W / 2 - bw / 2, by, bw, bh, 22); g.fill(); g.beginPath(); g.moveTo(W / 2 - 12, by + bh); g.lineTo(W / 2, by + bh + 14); g.lineTo(W / 2 + 12, by + bh); g.fill();
      g.fillStyle = '#1c1430'; L.forEach((l, i) => g.fillText(l, W / 2, by + 30 + i * 40));
    }
    if (!o.tag) { o.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false })); o.tag.scale.set(80, 40, 1); o.tag.renderOrder = 10; scene.add(o.tag); }
    else o.tag.material.map.needsUpdate = true;
  }
  function person(p, t, dt) {
    let o = people.get(p.id);
    if (!o) { const h = human(p); scene.add(h.g); o = { ...h, x: p.x, y: p.y, face: 0, walk: 0 }; people.set(p.id, o); }
    const mine = p.id === A.me, tx = mine ? pos.x : p.x, ty = mine ? pos.y : p.y;
    const nx = o.x + (tx - o.x) * .25, ny = o.y + (ty - o.y) * .25, dx = nx - o.x, dy = ny - o.y, sp = Math.hypot(dx, dy) / Math.max(dt, .001);
    if (Math.hypot(dx, dy) > .3) o.face = Math.atan2(dx, dy);
    o.x = nx; o.y = ny; o.g.position.set(o.x, 0, o.y);
    o.g.rotation.y = mine ? Math.atan2(-Math.sin(yaw), -Math.cos(yaw)) : o.face;
    // marcher : les jambes et les bras se balancent ; danser : les bras en l'air
    const moving = sp > 20 || (mine && Math.abs(speed) > 5);
    o.walk += dt * (moving ? 11 : 0); const sw = moving ? Math.sin(o.walk) * .7 : 0;
    o.legL.rotation.x = sw; o.legR.rotation.x = -sw; o.armL.rotation.x = -sw * .8; o.armR.rotation.x = sw * .8;
    if (p.action === 'dance') { o.armL.rotation.z = Math.sin(t * 8) * 1.2; o.armR.rotation.z = -Math.sin(t * 8) * 1.2; o.g.position.y = Math.abs(Math.sin(t * 8)) * 4; } else { o.armL.rotation.z = o.armR.rotation.z = 0; }
    tag(p, o); o.tag.position.set(o.x, 92 * HUMAN, o.y);
    return o;
  }
  // ---------- 🚗 conduire une voiture ----------
  let myCar = null;
  function toggleCar() {
    driving = !driving; speed = 0;
    if (driving) { if (!myCar) { myCar = carMesh(new THREE.Color(A.players.get(A.me)?.color || '#ff2d55')); scene.add(myCar); } myCar.visible = true; toast('🚗 Tu conduis ! Pousse le joystick (ou ▲) pour accélérer, et tourne à gauche ou à droite'); }
    else if (myCar) myCar.visible = false;
    carBtn.textContent = driving ? '🚶 Descendre' : '🚗 Conduire'; carBtn.classList.toggle('on', driving);
  }
  // ---------- 🕹️ le joystick (téléphone) ----------
  const stick = { x: 0, y: 0, on: false };
  function buildPad(root) {
    const knob = el('div', { class: 'joy-knob' });
    pad = el('div', { class: 'joy hidden', 'aria-label': 'Se déplacer' }, el('i', { class: 'joy-ring' }), knob);
    let id = null;
    const move = e => { const r = pad.getBoundingClientRect(), Rr = r.width / 2; let dx = e.clientX - (r.left + Rr), dy = e.clientY - (r.top + Rr); const d = Math.hypot(dx, dy), max = Rr * .62; if (d > max) { dx *= max / d; dy *= max / d; } knob.style.transform = `translate(${dx}px, ${dy}px)`; stick.x = dx / max; stick.y = dy / max; };
    pad.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; pad.setPointerCapture?.(id); stick.on = true; pad.classList.add('on'); move(e); });
    pad.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    const up = e => { if (e.pointerId !== id) return; id = null; stick.on = false; stick.x = stick.y = 0; knob.style.transform = ''; pad.classList.remove('on'); };
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
    root.append(pad);
  }
  // ---------- chaque image ----------
  function step(t, dt) {
    if (!window.Island.isOpen() || window.Island.kind() !== 'island') return;
    const K = A.keys, fwd = K.has('ArrowUp') || K.has('z') || K.has('w'), back = K.has('ArrowDown') || K.has('s');
    const left = K.has('ArrowLeft') || K.has('q') || K.has('a'), right = K.has('ArrowRight') || K.has('d');
    const dz = v => (Math.abs(v) < .18 ? 0 : v);
    let push = fwd ? 1 : back ? -.7 : 0, turn = (left ? 1 : 0) - (right ? 1 : 0);
    if (stick.on) { push = -dz(stick.y); turn = -dz(stick.x); }
    const m = A.players.get(A.me);
    // en voiture on tourne en roulant ; à pied on tourne sur place (et on court si on pousse à fond)
    if (driving) { const target = push * 620; speed += (target - speed) * Math.min(1, dt * (push ? 1.6 : 2.5)); yaw += turn * 1.9 * dt * Math.max(-1, Math.min(1, speed / 200)); }
    else { yaw += turn * 2.3 * dt; speed = push * (Math.abs(push) > .85 ? 320 : 230); }
    const dir = { x: -Math.sin(yaw), y: -Math.cos(yaw) };
    if (m && Math.abs(speed) > 2) {
      const sp = speed * (window.CityGames?.speed?.() ?? 1) * dt, nx = m.x + dir.x * sp, ny = m.y + dir.y * sp;
      if (!A.moveMine(nx, ny)) { if (!A.moveMine(nx, m.y) && !A.moveMine(m.x, ny) && driving) speed *= -.3; }
      pos = { x: m.x, y: m.y }; bob += dt * 10;
    } else if (m) { pos.x += (m.x - pos.x) * .3; pos.y += (m.y - pos.y) * .3; m.moving = false; }
    if (driving && myCar) { myCar.position.set(pos.x, 0, pos.y); myCar.rotation.y = yaw + Math.PI / 2; }
    // la caméra
    if (mode === 'first' && !driving) {
      const eye = 62 * HUMAN + (Math.abs(speed) > 5 ? Math.sin(bob) * 1.5 : 0);
      camera.position.set(pos.x, eye, pos.y); camera.lookAt(pos.x + dir.x * 100, eye + Math.tan(pitch) * 100, pos.y + dir.y * 100);
    } else {
      const d = driving ? 250 : 205, h = Math.max(30, (driving ? 130 : 112) - pitch * 200), head = new THREE.Vector3(pos.x, 55, pos.y), want = new THREE.Vector3(pos.x - dir.x * d, h, pos.y - dir.y * d);
      ray = ray || new THREE.Raycaster(); const v = want.clone().sub(head), len = v.length(); ray.set(head, v.normalize()); ray.far = len;
      const hit = ray.intersectObjects(solids, false)[0];
      lift += ((hit ? 1 : 0) - lift) * Math.min(1, dt * 4); // un immeuble gêne : la caméra monte au-dessus
      const dd = d - lift * 60, hh = h + lift * 260;
      camera.position.set(pos.x - dir.x * dd, hh, pos.y - dir.y * dd); camera.lookAt(pos.x, 48 - lift * 20, pos.y);
    }
    if (sun.castShadow) { sun.position.set(pos.x - 600, 1200, pos.y + 900); sun.target.position.set(pos.x, 0, pos.y); }
    // les voitures roulent
    for (const c of cars) {
      const L = c.horiz ? A.W : A.H; c.off = (c.off + c.sp * c.dir * dt + L) % L;
      if (c.horiz) { c.car.position.set(c.off, 0, c.line); c.car.rotation.y = c.dir > 0 ? 0 : Math.PI; }
      else { c.car.position.set(c.line, 0, c.off); c.car.rotation.y = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
    }
    // les promeneurs (et moi)
    const seen = new Set();
    for (const p of A.players.values()) {
      const hide = p.id === A.me && (mode === 'first' || driving);
      const o = person(p, t, dt); o.g.visible = !hide; o.tag.visible = !hide; seen.add(p.id);
    }
    for (const [id, o] of people) if (!seen.has(id)) { scene.remove(o.g); if (o.tag) { scene.remove(o.tag); o.tag.material.map.dispose(); o.tag.material.dispose(); } people.delete(id); }
    if (t - lastSky > 20) { lastSky = t; sky(); }
    R.render(scene, camera);
  }
  // on ajoute le bouton quand la Ville s'ouvre, et on relance la 3D si c'était la vue choisie
  setInterval(() => {
    if (!window.Island?.isOpen?.()) { if (canvas && !canvas.classList.contains('hidden')) stop(); return; }
    ensureButton();
    const inCity = window.Island.kind() === 'island';
    if (!inCity && canvas && !canvas.classList.contains('hidden')) stop();
    if (inCity && mode !== 'top' && (!canvas || canvas.classList.contains('hidden')) && !starting) { starting = true; setMode(mode, true).finally(() => { starting = false; }); }
  }, 700);
  return { setMode, mode: () => mode, face: a => { yaw = a; }, drive: () => toggleCar() };
})();
window.City3D = City3D;
