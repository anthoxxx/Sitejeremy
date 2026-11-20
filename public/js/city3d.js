// The Paradise — 🎥 La Ville en 3D : vue à la 1ʳᵉ personne (par tes yeux) ou à la 3ᵉ personne (derrière ton personnage).
// Les dessins de la Ville (boutiques, lieux, palmiers, lampadaires, personnages) sont posés debout dans un vrai monde 3D.
// La bibliothèque 3D (three.js) n'est chargée que si on choisit la vue 3D.
const City3D = (() => {
  let mode = 'top'; // 'top' = vue du dessus (2D) · 'third' = 3ᵉ personne · 'first' = 1ʳᵉ personne
  try { mode = localStorage.getItem('lc_city_view') || 'top'; } catch (e) {}
  let THREE = null, R = null, scene = null, camera = null, canvas = null, A = null, built = false, pad = null;
  let yaw = 0, pitch = -0.08, pos = { x: 0, y: 0 }, bob = 0;
  const bills = [], people = new Map(), held = new Set(), solids = [];
  const mobile = () => innerWidth < 700;
  const PS = .78; // 🧍 la taille des personnages en 3D (plus petits que sur la carte, pour faire vrai à côté des bâtiments)

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
    if (!quiet) toast(m === 'first' ? '👀 Vue à la 1ʳᵉ personne : tu vois la Ville par tes yeux' : '🎥 Vue à la 3ᵉ personne : la caméra est derrière toi');
    try { THREE = await loadThree(); } catch (e) { toast('😕 La 3D ne marche pas sur cet appareil'); mode = 'top'; return ensureButton(); }
    start();
  }
  // ---------- on construit le monde 3D ----------
  function start() {
    const root = window.Island.root(); if (!root) return;
    A = window.Island.api3d();
    if (!canvas) {
      canvas = el('canvas', { class: 'isl-3d' }); root.insertBefore(canvas, root.querySelector('canvas').nextSibling);
      R = new THREE.WebGLRenderer({ canvas, antialias: !mobile(), powerPreference: 'high-performance' });
      R.setPixelRatio(Math.min(devicePixelRatio || 1, mobile() ? 1.25 : 1.75));
      R.outputColorSpace = THREE.SRGBColorSpace;
      camera = new THREE.PerspectiveCamera(70, 1, 2, 7000);
      addEventListener('resize', fit);
      // regarder autour : on fait glisser le doigt ou la souris
      let drag = null;
      canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture?.(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!drag) return; yaw -= (e.clientX - drag.x) * .006; pitch = Math.max(-.7, Math.min(.5, pitch - (e.clientY - drag.y) * .004)); drag = { x: e.clientX, y: e.clientY }; });
      const end = () => { drag = null; }; canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      buildPad(root);
    }
    if (!built) build();
    canvas.classList.remove('hidden'); pad.classList.remove('hidden'); root.classList.add('view3d');
    const m = A.players.get(A.me); if (m) { pos = { x: m.x, y: m.y }; }
    fit();
    window.Island.set3d({ step });
  }
  function stop() {
    window.Island?.set3d?.(null);
    canvas?.classList.add('hidden'); pad?.classList.add('hidden'); window.Island?.root?.()?.classList.remove('view3d');
  }
  function fit() { if (!canvas || !R) return; const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; R.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 80 : 68; camera.updateProjectionMatrix(); }
  const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  // une image découpée, posée debout. face = toujours face à la caméra (palmier, lampadaire, personnage)
  // le bas de ce qui est vraiment dessiné (sans l'ombre transparente) : c'est ça qu'on pose sur le sol
  function groundOf(c, H2) {
    const g = c.getContext('2d'), w = c.width, h = c.height, k = h / H2, d = g.getImageData(0, 0, w, h).data;
    for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x += 2) if (d[(y * w + x) * 4 + 3] > 120) return (y + 1) / k;
    return H2;
  }
  function stand(c, W2, H2, AX, AY, x, y, opt = {}) {
    if (opt.ground) AY = Math.min(H2, groundOf(c, H2) - 4); // posé sur le sol, plus à moitié enterré
    const mat = new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, alphaTest: .35, side: opt.face ? THREE.DoubleSide : THREE.FrontSide, fog: true });
    const geo = new THREE.PlaneGeometry(W2, H2); geo.translate(W2 / 2 - AX, AY - H2 / 2, 0);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, 0, y + (opt.dz || 0)); if (opt.s) m.scale.setScalar(opt.s);
    scene.add(m); if (opt.face) bills.push(m);
    // la même façade à l'arrière du bâtiment (dans le bon sens, pas en miroir)
    if (opt.back) { const b = new THREE.Mesh(geo, mat); b.rotation.y = Math.PI; b.position.set(x, 0, y - opt.back); scene.add(b); solids.push(b); }
    return m;
  }
  // un vrai bâtiment : des murs avec des fenêtres (allumées la nuit) et un toit
  const wallTex = new Map();
  function wallsOf(col, dark) {
    const key = col + dark; if (wallTex.has(key)) return wallTex.get(key);
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = col; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(0,0,0,.06)'; for (let y = 0; y < 128; y += 8) g.fillRect(0, y, 128, 1);
    const n = A.nightLevel();
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) { const on = (r * 3 + k) % 4; g.fillStyle = dark ? (on ? (n > .2 ? '#ffe28a' : '#9fd8ff') : '#2a2e44') : (n > .2 && on ? '#ffe28a' : '#9fd8ff'); g.fillRect(12 + k * 40, 14 + r * 40, 26, 24); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(12 + k * 40, 14 + r * 40, 26, 3); }
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; wallTex.set(key, t); return t;
  }
  function block(w, h, d, col, x, y, dark) {
    const t = wallsOf(col, dark).clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(w / 60)), Math.max(1, Math.round(h / 50)));
    const side = new THREE.MeshLambertMaterial({ map: t }), roof = new THREE.MeshLambertMaterial({ color: new THREE.Color(col).multiplyScalar(dark ? .7 : .78) });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roof, roof, side, side]); m.position.set(x, h / 2, y); scene.add(m); solids.push(m);
    // le petit rebord du toit
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 6, 6, d + 6), roof); lip.position.set(x, h + 3, y); scene.add(lip);
    return m;
  }
  let sun = null, amb = null;
  function build() {
    built = true;
    scene = new THREE.Scene();
    amb = new THREE.AmbientLight(0xffffff, .75); scene.add(amb);
    sun = new THREE.DirectionalLight(0xffffff, .9); sun.position.set(-800, 1600, 1400); scene.add(sun);
    // le sol de la Ville (les rues, l'herbe, la place…), et la mer tout autour
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(A.W, A.H), new THREE.MeshBasicMaterial({ map: tex(A.terrain) }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(A.W / 2, 0, A.H / 2); scene.add(ground);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.MeshBasicMaterial({ color: 0x2a86d6 })); sea.rotation.x = -Math.PI / 2; sea.position.set(A.W / 2, -2, A.H / 2); scene.add(sea);
    const n = A.nightLevel();
    // 🏪 les boutiques : une façade dessinée + un vrai bâtiment derrière
    const WALL = ['#f4e4c8', '#e6eef7', '#f7d6e2', '#dfe9d8', '#ece2f7', '#fbe7c6'];
    for (const o of A.shops) {
      const hgt = o.h > .5 ? 110 + Math.round(o.h * 45) : 78;
      solids.push(stand(A.sprite3d(() => A.draw.shop(o, n), o.x, o.y, 170, 260, 85, 230), 170, 260, 85, 230, o.x, o.y, { dz: 1, back: 83 }));
      block(118, hgt, 80, WALL[o.k % 6], o.x, o.y - 41);
    }
    // 🏙️ les tours
    for (const tw of A.TOWERS) { const hgt = 40 + tw[3] * 34; solids.push(stand(A.sprite3d(() => A.draw.tower(tw, n), tw[0], tw[1], 140, hgt + 80, 70, hgt + 50), 140, hgt + 80, 70, hgt + 50, tw[0], tw[1], { dz: 1, back: 79 })); block(76, hgt, 76, '#4a5070', tw[0], tw[1] - 39, true); }
    // 📍 les lieux (club, cinéma, café, salons…)
    for (const p of A.PLACES) stand(A.sprite3d(() => A.draw.place(p), p.x, p.y, 340, 360, 170, 270), 340, 360, 170, 270, p.x, p.y, { face: true, ground: true });
    for (const a of A.ARCHES) stand(A.sprite3d(() => A.draw.arch(a, n), a[0], a[1], 300, 320, 150, 260), 300, 320, 150, 260, a[0], a[1], { face: true, ground: true });
    stand(A.sprite3d(() => A.draw.fountain(n), A.FOUNTAIN.x, A.FOUNTAIN.y, 420, 300, 210, 200), 420, 300, 210, 200, A.FOUNTAIN.x, A.FOUNTAIN.y, { face: true, ground: true });
    // 🌴 les palmiers et 💡 les lampadaires (une seule image chacun, réutilisée partout)
    const palmImg = A.palms[0] ? A.sprite3d(() => A.draw.palm({ ...A.palms[0], s: 1 }), A.palms[0].x, A.palms[0].y, 200, 240, 100, 210) : null;
    const pt = palmImg ? tex(palmImg) : null;
    for (const p of A.palms) { if (!pt) break; const geo = new THREE.PlaneGeometry(200, 240); geo.translate(0, 210 - 120, 0); const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: pt, transparent: true, alphaTest: .35, side: THREE.DoubleSide })); m.position.set(p.x, 0, p.y); m.scale.setScalar(p.s || 1); scene.add(m); bills.push(m); }
    const lampTex = new Map();
    for (const l of A.lamps) {
      if (!lampTex.has(l.c)) lampTex.set(l.c, tex(A.sprite3d(() => A.draw.lamp(l, n), l.x, l.y, 90, 150, 45, 135)));
      const geo = new THREE.PlaneGeometry(90, 150); geo.translate(0, 135 - 75, 0);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: lampTex.get(l.c), transparent: true, alphaTest: .3, side: THREE.DoubleSide })); m.position.set(l.x, 0, l.y); scene.add(m); bills.push(m);
    }
    sky();
  }
  function sky() {
    const n = A.nightLevel(), day = new THREE.Color('#8fd3ff'), nightC = new THREE.Color('#0b1640');
    const c = day.clone().lerp(nightC, n); scene.background = c; scene.fog = new THREE.Fog(c, 900, mode === 'first' ? 3200 : 3800);
    amb.intensity = .8 - n * .4; sun.intensity = 1 - n * .7;
  }
  // ---------- 🧍 les autres promeneurs (et moi en 3ᵉ personne) ----------
  function person(p, t) {
    let o = people.get(p.id);
    if (!o) {
      const c = document.createElement('canvas'); const k = mobile() ? 1 : 1.5; c.width = 300 * k; c.height = 230 * k;
      const geo = new THREE.PlaneGeometry(300, 230); geo.translate(0, 160 - 115 + 38, 0); // les pieds posés sur le sol
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, alphaTest: .3, side: THREE.DoubleSide })); scene.add(m);
      m.scale.setScalar(PS); o = { c, k, m, at: 0, x: p.x, y: p.y }; people.set(p.id, o);
    }
    const tx = p.id === A.me ? pos.x : p.x, ty = p.id === A.me ? pos.y : p.y;
    o.x += (tx - o.x) * .25; o.y += (ty - o.y) * .25;
    o.m.position.set(o.x, 0, o.y);
    tag(p, o); o.tag.position.set(o.x, 78, o.y);
    if (t - o.at > .12) { // on redessine le personnage 8 fois par seconde (il bouge, il danse…)
      o.at = t; const g = o.c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, o.c.width, o.c.height);
      const img = A.sprite3d(() => A.draw.player({ ...p, dx: tx, dy: ty, pose: null, said: '', action: p.action === 'sit' || p.action === 'sleep' ? '' : p.action }, t), tx, ty, 300, 230, 150, 160, o.k);
      g.drawImage(img, 0, 0); g.clearRect(0, (160 + 27) * o.k, o.c.width, o.c.height); o.m.material.map.needsUpdate = true; // on coupe sous les pieds : le pseudo est au-dessus de la tête
    }
    return o;
  }
  // ---------- 🏷️ le pseudo (et la bulle de ce qu'on dit) au-dessus de la tête ----------
  function tag(p, o) {
    const said = p.said && Date.now() - (p.saidAt || 0) < 7000 ? p.said : '', key = (p.username || '') + '|' + said + '|' + (p.role || '') + (p.gender || '');
    if (o.tagKey === key) return; o.tagKey = key;
    const W = 512, H = 256, c = o.tagC || (o.tagC = document.createElement('canvas')); c.width = W; c.height = H; const g = c.getContext('2d');
    g.clearRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'middle';
    const col = (p.role === 'admin' || p.role === 'superadmin') ? '#ff2d55' : p.gender === 'f' ? '#ff4fd8' : p.gender === 'h' ? '#2fa8ff' : '#c3b8ff'; // la même couleur que dans la vue du dessus
    // le pseudo, en néon
    g.font = '900 46px Outfit, Inter, sans-serif'; const nm = p.username || ''; const tw = Math.min(W - 20, g.measureText(nm).width + 40);
    g.fillStyle = 'rgba(15,8,30,.72)'; const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    rr(W / 2 - tw / 2, H - 70, tw, 62, 31); g.fill(); g.strokeStyle = col; g.lineWidth = 3; g.stroke();
    g.shadowColor = col; g.shadowBlur = 14; g.fillStyle = col; g.fillText(nm, W / 2, H - 38, W - 40); g.shadowBlur = 0;
    // la bulle de ce qu'il dit
    if (said) {
      g.font = '700 34px Outfit, Inter, sans-serif'; const words = said.split(' '), lines = []; let line = '';
      for (const w of words) { const t2 = line ? line + ' ' + w : w; if (g.measureText(t2).width > W - 80 && line) { lines.push(line); line = w; } else line = t2; } if (line) lines.push(line);
      const L = lines.slice(0, 3), bw = Math.min(W - 16, Math.max(...L.map(l => g.measureText(l).width)) + 40), bh = L.length * 40 + 22, by = H - 84 - bh;
      g.fillStyle = '#ffffff'; rr(W / 2 - bw / 2, by, bw, bh, 22); g.fill(); g.beginPath(); g.moveTo(W / 2 - 12, by + bh); g.lineTo(W / 2, by + bh + 14); g.lineTo(W / 2 + 12, by + bh); g.fill();
      g.fillStyle = '#1c1430'; L.forEach((l, i) => g.fillText(l, W / 2, by + 30 + i * 40));
    }
    if (!o.tag) { o.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false })); o.tag.scale.set(96, 48, 1); o.tag.renderOrder = 10; scene.add(o.tag); }
    else o.tag.material.map.needsUpdate = true;
  }
  // ---------- 🎮 les flèches à l'écran (téléphone) ----------
  // 🕹️ le joystick : on pose le pouce et on le pousse (vers le haut = avancer, sur les côtés = tourner)
  const stick = { x: 0, y: 0, on: false };
  function buildPad(root) {
    const knob = el('div', { class: 'joy-knob' });
    pad = el('div', { class: 'joy hidden', 'aria-label': 'Se déplacer' }, el('i', { class: 'joy-ring' }), knob);
    let id = null;
    const move = e => { const r = pad.getBoundingClientRect(), R = r.width / 2; let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const d = Math.hypot(dx, dy), max = R * .62; if (d > max) { dx *= max / d; dy *= max / d; } knob.style.transform = `translate(${dx}px, ${dy}px)`; stick.x = dx / max; stick.y = dy / max; };
    pad.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; pad.setPointerCapture?.(id); stick.on = true; pad.classList.add('on'); move(e); });
    pad.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    const up = e => { if (e.pointerId !== id) return; id = null; stick.on = false; stick.x = stick.y = 0; knob.style.transform = ''; pad.classList.remove('on'); };
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
    root.append(pad);
  }
  // ---------- chaque image : on bouge et on dessine ----------
  let lastSky = 0, starting = false, ray = null, lift = 0, dbg = null;
  function step(t, dt) {
    if (!window.Island.isOpen() || window.Island.kind() !== 'island') return;
    const K = A.keys, fwd = K.has('ArrowUp') || K.has('z') || K.has('w') || held.has('up'), back = K.has('ArrowDown') || K.has('s') || held.has('down');
    const left = K.has('ArrowLeft') || K.has('q') || K.has('a') || held.has('left'), right = K.has('ArrowRight') || K.has('d') || held.has('right');
    if (left) yaw += 2.2 * dt; if (right) yaw -= 2.2 * dt;
    // le joystick : la vitesse dépend de combien on le pousse
    let push = 0; if (stick.on) { const dz = v => (Math.abs(v) < .18 ? 0 : v); yaw -= dz(stick.x) * 2.4 * dt; push = -dz(stick.y); }
    const dir = { x: -Math.sin(yaw), y: -Math.cos(yaw) };
    const m = A.players.get(A.me);
    const going = fwd || back || push !== 0;
    if (m && !going) { pos.x += (m.x - pos.x) * .3; pos.y += (m.y - pos.y) * .3; m.moving = false; }
    if (m && going) {
      const sp = (fwd ? 260 : back ? -170 : push > 0 ? 260 * push : 170 * push) * (window.CityGames?.speed?.() ?? 1) * dt, nx = m.x + dir.x * sp, ny = m.y + dir.y * sp;
      if (!A.moveMine(nx, ny)) { if (!A.moveMine(nx, m.y)) A.moveMine(m.x, ny); }
      pos = { x: m.x, y: m.y }; bob += dt * 10;
    }
    // la caméra
    const eye = 96 + (mode === 'first' && going ? Math.sin(bob) * 3 : 0);
    if (mode === 'first') { camera.position.set(pos.x, eye, pos.y); camera.lookAt(pos.x + dir.x * 100, eye + Math.tan(pitch) * 100, pos.y + dir.y * 100); }
    else {
      // la caméra derrière moi… mais si un bâtiment est entre nous, elle se rapproche pour ne pas me perdre de vue
      let d = 215; const h = Math.max(30, 150 - pitch * 220), head = new THREE.Vector3(pos.x, 70, pos.y), want = new THREE.Vector3(pos.x - dir.x * d, h, pos.y - dir.y * d);
      ray = ray || new THREE.Raycaster(); const v = want.clone().sub(head), len = v.length(); ray.set(head, v.normalize()); ray.far = len;
      const hit = ray.intersectObjects(solids, false)[0];
      // un bâtiment gêne : la caméra monte au-dessus des toits et regarde vers le bas (en douceur)
      lift += ((hit ? 1 : 0) - lift) * Math.min(1, dt * 4);
      const dd = 215 - lift * 80, hh = h + lift * 230;
      camera.position.set(pos.x - dir.x * dd, hh, pos.y - dir.y * dd); camera.lookAt(pos.x, 62 - lift * 25, pos.y);
    }
    // les images « face caméra »
    const cx = camera.position.x, cz = camera.position.z;
    for (const b of bills) b.rotation.y = Math.atan2(cx - b.position.x, cz - b.position.z);
    // les promeneurs
    const seen = new Set();
    for (const p of A.players.values()) {
      if (p.id === A.me && mode === 'first') { const o = people.get(p.id); if (o) { o.m.visible = false; if (o.tag) o.tag.visible = false; } seen.add(p.id); continue; }
      const o = person(p, t); o.m.visible = true; if (o.tag) o.tag.visible = true; o.m.rotation.y = Math.atan2(cx - o.m.position.x, cz - o.m.position.z); seen.add(p.id);
    }
    for (const [id, o] of people) if (!seen.has(id)) { if (o.tag) { scene.remove(o.tag); o.tag.material.map.dispose(); o.tag.material.dispose(); } scene.remove(o.m); o.m.geometry.dispose(); o.m.material.map.dispose(); o.m.material.dispose(); people.delete(id); }
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
  return { setMode, mode: () => mode, face: a => { yaw = a; } };
})();
window.City3D = City3D;
