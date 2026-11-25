// The Paradise — 🔫 Le Laser Game (côté écran) : le salon d'attente (choix de la carte et de l'équipe), puis le jeu en 3D
// à la 1ʳᵉ personne. Sur ordinateur : la souris pour viser, ZQSD / WASD / flèches pour bouger, clic pour tirer.
// Sur téléphone : le joystick à gauche pour bouger, glisser le doigt à droite pour viser, le gros bouton pour tirer.
const LaserGame = (() => {
  const TEAM = { red: { name: 'Rouges', icon: '🔴', col: '#ff2d4a', hex: 0xff2d4a }, blue: { name: 'Bleus', icon: '🔵', col: '#2f9bff', hex: 0x2f9bff } };
  const NEON = { neon: [0xff3df0, 0x38e8ff], entrepot: [0xffa23a, 0xffe08a], laby: [0x39ff8a, 0x2fd0ff] };
  const EYE = 1.6, SPEED = 5.2, RAD = .38, FIRE_MS = 280;
  let room = null, maps = {}, closePanel = null, panelBox = null, view = 'list', form = { map: 'neon', team: 'red', bots: true };
  let active = false, K = null, THREE = null, R = null, scene = null, camera = null, canvas = null, ov = null, raf = 0, last = 0;
  let M = null, gun = null, flashS = null, recoil = 0, lastShot = 0, firing = false, lastSend = 0, beams = [], hud = {}, feed = [], deadUntil = 0, killer = '', hitMark = 0, hurt = 0;
  const me = { x: 0, z: 0, yaw: 0, pitch: 0, alive: false, shield: false };
  const others = new Map(), keys = new Set(), stick = { x: 0, y: 0, on: false };
  const mobile = () => innerWidth < 760 || matchMedia('(pointer: coarse)').matches;
  const myId = () => state.me?.id;
  const myTeam = () => room?.players.find(p => p.id === myId())?.team || 'red';
  const ack = (ev, ...a) => new Promise(res => socket.emit(ev, ...a, res));

  // ---------- 🔊 les bruitages (fabriqués directement, sans fichier) ----------
  let AC = null;
  const ac = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) {} return AC; };
  function tone(type, f0, f1, dur, vol) {
    const a = ac(); if (!a) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
  }
  const sPew = (v = .12) => { tone('square', 1500, 220, .16, v); tone('sine', 2600, 900, .08, v * .6); };
  const sHit = () => { tone('sine', 880, 880, .07, .18); setTimeout(() => tone('sine', 1320, 1320, .1, .18), 70); };
  const sHurt = () => { tone('sawtooth', 300, 60, .45, .2); };
  const sGo = () => { tone('square', 660, 660, .12, .12); setTimeout(() => tone('square', 990, 990, .3, .12), 140); };

  // ---------- 🚪 le salon d'attente ----------
  async function panel() {
    const d = await ack('lg_list'); maps = d.maps; room = d.current; view = room ? 'room' : 'list';
    panelBox = el('div', { class: 'lg-panel' });
    closePanel = modal(panelBox);
    list = d.rooms; renderPanel();
  }
  let list = [];
  function renderPanel() {
    if (!panelBox || !panelBox.isConnected) return;
    const kids = [el('div', { class: 'lg-logo' }, '🔫'), el('h3', {}, 'Laser Game')];
    if (view === 'room' && room) {
      const host = room.host === myId(), team = t => room.players.filter(p => p.team === t);
      kids.push(el('p', { class: 'help' }, `${maps[room.map]?.icon || ''} ${maps[room.map]?.name || ''} · ${room.status === 'lobby' ? 'en attente des joueurs' : room.status === 'ended' ? 'partie terminée' : 'partie en cours'}`));
      kids.push(el('div', { class: 'lg-teams' }, ...['red', 'blue'].map(t => el('div', { class: 'lg-team ' + t + (myTeam() === t ? ' mine' : '') },
        el('b', {}, TEAM[t].icon + ' ' + TEAM[t].name + ` (${team(t).length})`),
        el('ul', {}, ...team(t).map(p => el('li', { class: p.id === myId() ? 'me' : '' }, (p.host ? '👑 ' : '') + p.name))),
        myTeam() !== t ? el('button', { class: 'btn btn-sm', onclick: () => socket.emit('lg_team', t) }, 'Rejoindre les ' + TEAM[t].name) : el('small', {}, '✅ Ton équipe')))));
      if (room.bots) kids.push(el('p', { class: 'help' }, '🤖 Des robots compléteront les équipes au lancement (au moins 2 contre 2).'));
      if (host && room.status === 'lobby') {
        kids.push(el('h4', {}, '🗺️ La carte'), mapPicker(room.map, k => socket.emit('lg_set', { map: k })));
        kids.push(el('label', { class: 'lg-check' }, el('input', { type: 'checkbox', checked: room.bots, onchange: e => socket.emit('lg_set', { bots: e.target.checked }) }), ' 🤖 Ajouter des robots s\'il manque des joueurs'));
        kids.push(el('button', { class: 'btn btn-primary lg-go', onclick: () => socket.emit('lg_start') }, '▶️ Lancer la partie'));
      } else if (room.status === 'lobby') kids.push(el('p', { class: 'lg-wait' }, `⏳ En attente que ${room.players.find(p => p.host)?.name || 'le chef'} lance la partie…`));
      else if (room.status !== 'ended') kids.push(el('button', { class: 'btn btn-primary lg-go', onclick: () => enterGame() }, '🎮 Rejoindre le jeu'));
      kids.push(el('p', { class: 'help' }, `🎯 Touche les joueurs d'en face avec ton laser. La première équipe à ${room.win || 25} points gagne (ou celle qui mène après 4 minutes). Les gagnants reçoivent 20 💰, les autres 5 💰.`));
      kids.push(el('button', { class: 'btn', style: 'width:100%', onclick: () => { socket.emit('lg_leave'); room = null; view = 'list'; ack('lg_list').then(d => { list = d.rooms; renderPanel(); }); } }, '🚪 Quitter la partie'));
    } else if (view === 'create') {
      kids.push(el('h4', {}, '🗺️ Choisis la carte'), mapPicker(form.map, k => { form.map = k; renderPanel(); }));
      kids.push(el('h4', {}, '🎽 Ton équipe'), el('div', { class: 'lg-pick2' }, ...['red', 'blue'].map(t => el('button', { class: 'lg-tbtn ' + t + (form.team === t ? ' on' : ''), onclick: () => { form.team = t; renderPanel(); } }, TEAM[t].icon + ' ' + TEAM[t].name))));
      kids.push(el('label', { class: 'lg-check' }, el('input', { type: 'checkbox', checked: form.bots, onchange: e => { form.bots = e.target.checked; } }), ' 🤖 Ajouter des robots s\'il manque des joueurs'));
      kids.push(el('button', { class: 'btn btn-primary lg-go', onclick: async () => { const r = await ack('lg_create', form); if (r.error) return toast(r.error); room = r.room; view = 'room'; renderPanel(); } }, '✅ Créer la partie'));
      kids.push(el('button', { class: 'btn', style: 'width:100%', onclick: () => { view = 'list'; renderPanel(); } }, '← Retour'));
    } else {
      kids.push(el('p', { class: 'help' }, 'Équipe Rouge contre équipe Bleue, dans une arène en 3D. Choisis ta carte, ton équipe, et tire au laser !'));
      kids.push(el('button', { class: 'btn btn-primary lg-go', onclick: () => { view = 'create'; renderPanel(); } }, '➕ Créer une partie'));
      kids.push(el('h4', {}, '🎮 Les parties ouvertes'));
      kids.push(list.length ? el('div', { class: 'lg-list' }, ...list.map(r => el('div', { class: 'lg-row' },
        el('span', { class: 'lg-mi' }, maps[r.map]?.icon || '🔫'), el('div', {}, el('b', {}, r.name), el('small', {}, `${maps[r.map]?.name || ''} · ${r.n} joueur${r.n > 1 ? 's' : ''} · ${r.status === 'lobby' ? 'en attente' : r.status === 'ended' ? 'terminée' : 'en cours'}`)),
        el('button', { class: 'btn btn-sm btn-primary', onclick: async () => { const x = await ack('lg_join', r.id); if (x.error) return toast(x.error); room = x.room; view = 'room'; renderPanel(); if (room.status === 'playing' || room.status === 'countdown') enterGame(); } }, 'Rejoindre'))))
        : el('p', { class: 'help' }, 'Aucune partie pour le moment : crée la tienne, des robots joueront avec toi !'));
    }
    panelBox.replaceChildren(...kids);
  }
  function mapPicker(cur, pick) {
    return el('div', { class: 'lg-maps' }, ...Object.entries(maps).map(([k, m]) => el('button', { class: 'lg-map' + (k === cur ? ' on' : ''), onclick: () => pick(k) }, el('span', { class: 'lg-mi' }, m.icon), el('b', {}, m.name), el('small', {}, m.desc))));
  }

  // ---------- 🧱 la carte en 3D ----------
  const solid = (cx, cz) => !M || cx < 0 || cz < 0 || cx >= M.W || cz >= M.H || M.grid[cz][cx] === '#' || M.grid[cz][cx] === 'c';
  const solidAt = (x, z) => solid(Math.floor(x / M.cell), Math.floor(z / M.cell));
  const fits = (x, z) => !solidAt(x - RAD, z - RAD) && !solidAt(x + RAD, z - RAD) && !solidAt(x - RAD, z + RAD) && !solidAt(x + RAD, z + RAD);
  function wallDist(x, z, dx, dz, max) {
    const C = M.cell, len = Math.hypot(dx, dz); if (len < 1e-6) return max; dx /= len; dz /= len;
    let cx = Math.floor(x / C), cz = Math.floor(z / C); const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1, tdx = Math.abs(C / dx), tdz = Math.abs(C / dz);
    let tx = dx ? ((dx > 0 ? (cx + 1) * C - x : x - cx * C) / Math.abs(dx)) : Infinity, tz = dz ? ((dz > 0 ? (cz + 1) * C - z : z - cz * C) / Math.abs(dz)) : Infinity;
    for (let i = 0; i < 200; i++) { let t; if (tx < tz) { cx += sx; t = tx; tx += tdx; } else { cz += sz; t = tz; tz += tdz; } if (t > max) return max; if (solid(cx, cz)) return t; }
    return max;
  }
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(...rep); t.anisotropy = 8; return t; };
  const hexCss = h => '#' + h.toString(16).padStart(6, '0');
  function buildScene() {
    const [c1, c2] = NEON[M.key] || NEON.neon, C = M.cell, W = M.W * C, H = M.H * C;
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x04050b); scene.fog = new THREE.Fog(0x070912, 14, 70);
    scene.add(new THREE.HemisphereLight(0xb8c4ff, 0x302840, 2.2));
    const dl = new THREE.DirectionalLight(0xffffff, .8); dl.position.set(10, 20, 6); scene.add(dl);
    for (const [t, col] of [['red', 0xff2d4a], ['blue', 0x2f9bff]]) { const sp = M.grid.flatMap((r, z) => [...r].map((ch, x) => [ch, x, z])).filter(([ch]) => ch === (t === 'red' ? 'R' : 'B')); if (!sp.length) continue; const [, x, z] = sp[0]; const l = new THREE.PointLight(col, 40, 22, 1.6); l.position.set((x + 1) * C, 2.6, (z + .5) * C); scene.add(l); }
    // le sol : des dalles sombres avec des lignes lumineuses
    const [fc, fg] = cnv(256, 256); fg.fillStyle = '#1e2234'; fg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { fg.fillStyle = `rgba(255,255,255,${Math.random() * .04})`; fg.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    fg.strokeStyle = 'rgba(120,140,255,.35)'; fg.lineWidth = 3; fg.strokeRect(2, 2, 252, 252); fg.strokeStyle = 'rgba(120,140,255,.12)'; fg.lineWidth = 1; fg.beginPath(); fg.moveTo(128, 0); fg.lineTo(128, 256); fg.moveTo(0, 128); fg.lineTo(256, 128); fg.stroke();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex(fc, [M.W, M.H]), roughness: .35, metalness: .4 })); floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, H / 2); scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0x0b0d18 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(W / 2, 3.4, H / 2); scene.add(ceil);
    // les murs : panneaux sombres avec des bandes de néon
    const [wc, wg] = cnv(256, 256), [we, weg] = cnv(256, 256);
    wg.fillStyle = '#3a4066'; wg.fillRect(0, 0, 256, 256); wg.fillStyle = '#2c3150'; for (const [x, y] of [[12, 60], [134, 60]]) wg.fillRect(x, y, 110, 128); wg.fillStyle = 'rgba(255,255,255,.06)'; wg.fillRect(0, 0, 256, 30); for (let i = 0; i < 1500; i++) { wg.fillStyle = `rgba(255,255,255,${Math.random() * .05})`; wg.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    wg.strokeStyle = 'rgba(0,0,0,.6)'; wg.lineWidth = 4; wg.strokeRect(0, 0, 256, 256); weg.fillStyle = '#000'; weg.fillRect(0, 0, 256, 256);
    for (const [y, col] of [[40, c1], [200, c2]]) for (const G of [wg, weg]) { G.fillStyle = hexCss(col); G.fillRect(0, y, 256, 8); }
    for (const G of [wg, weg]) { G.fillStyle = hexCss(c2); for (let x = 30; x < 256; x += 64) G.fillRect(x, 90, 4, 70); }
    const wallMat = new THREE.MeshStandardMaterial({ map: tex(wc), emissiveMap: tex(we), emissive: 0xffffff, emissiveIntensity: 1.2, roughness: .6, metalness: .2 });
    // les caisses / barricades
    const [cc, cg] = cnv(256, 256), [ce, ceg] = cnv(256, 256); const wood = M.key === 'entrepot';
    cg.fillStyle = wood ? '#6b4a2a' : '#1c2133'; cg.fillRect(0, 0, 256, 256); ceg.fillStyle = '#000'; ceg.fillRect(0, 0, 256, 256);
    if (wood) { for (let y = 0; y < 256; y += 32) { cg.fillStyle = `rgba(0,0,0,${.15 + Math.random() * .1})`; cg.fillRect(0, y, 256, 3); } cg.strokeStyle = '#3d2814'; cg.lineWidth = 18; cg.strokeRect(9, 9, 238, 238); cg.beginPath(); cg.moveTo(18, 18); cg.lineTo(238, 238); cg.stroke(); }
    for (const G of [cg, ceg]) { G.strokeStyle = hexCss(c1); G.lineWidth = 6; G.strokeRect(4, 4, 248, 248); }
    const crateMat = new THREE.MeshStandardMaterial({ map: tex(cc), emissiveMap: tex(ce), emissive: 0xffffff, emissiveIntensity: wood ? .5 : 1, roughness: .7 });
    const walls = [], crates = [];
    M.grid.forEach((r, z) => [...r].forEach((ch, x) => { if (ch === '#') walls.push([x, z]); if (ch === 'c') crates.push([x, z]); }));
    const q = new THREE.Object3D();
    const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(C, 3.4, C), wallMat, walls.length); walls.forEach(([x, z], i) => { q.position.set((x + .5) * C, 1.7, (z + .5) * C); q.updateMatrix(); wm.setMatrixAt(i, q.matrix); }); scene.add(wm);
    if (crates.length) { const cm = new THREE.InstancedMesh(new THREE.BoxGeometry(C * .82, 1.9, C * .82), crateMat, crates.length); crates.forEach(([x, z], i) => { q.position.set((x + .5) * C, .95, (z + .5) * C); q.rotation.y = (x * 7 + z * 3) % 2 ? 0 : .08; q.updateMatrix(); cm.setMatrixAt(i, q.matrix); }); scene.add(cm); }
    // les bases des deux équipes : le sol s'allume de leur couleur
    for (const [ch, col] of [['R', 0xff2d4a], ['B', 0x2f9bff]]) M.grid.forEach((r, z) => [...r].forEach((c, x) => { if (c !== ch) return; const p = new THREE.Mesh(new THREE.PlaneGeometry(C * .92, C * .92), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .28 })); p.rotation.x = -Math.PI / 2; p.position.set((x + .5) * C, .02, (z + .5) * C); scene.add(p); }));
    // ma caméra et mon pistolet laser
    camera = new THREE.PerspectiveCamera(mobile() ? 78 : 72, 1, .05, 120); camera.rotation.order = 'YXZ'; scene.add(camera);
    gun = blaster(TEAM[myTeam()].hex); gun.scale.setScalar(.75); camera.add(gun); camera.add(new THREE.PointLight(0xffffff, 1.2, 1.5)); // une petite lumière pour voir le pistolet
    const [sc, sg] = cnv(64, 64), gr = sg.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
    glowTex = tex(sc);
    flashS = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: TEAM[myTeam()].hex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); flashS.scale.set(.25, .25, 1); flashS.position.set(0, .03, -.36); gun.add(flashS);
  }
  let glowTex = null;
  function blaster(col) {
    const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x4a505e, metalness: .6, roughness: .35 }), glow = new THREE.MeshBasicMaterial({ color: col });
    const body = new THREE.Mesh(new THREE.BoxGeometry(.08, .1, .34), dark); g.add(body);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(.06, .14, .07), dark); grip.position.set(0, -.1, .1); grip.rotation.x = .25; g.add(grip);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.022, .026, .2, 12), dark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .02, -.25); g.add(barrel);
    for (const x of [-.042, .042]) { const s = new THREE.Mesh(new THREE.BoxGeometry(.006, .02, .28), glow); s.position.set(x, .02, -.02); g.add(s); }
    const tip = new THREE.Mesh(new THREE.TorusGeometry(.028, .008, 6, 16), glow); tip.position.set(0, .02, -.35); g.add(tip);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(.012, .012, .05), glow); sight.position.set(0, .058, .02); g.add(sight);
    return g;
  }
  // un joueur : le vrai personnage, une ceinture lumineuse de la couleur de son équipe, son pseudo, et son pistolet
  function nameTag(name, col) {
    const [c, g] = cnv(512, 128); g.font = '800 54px Outfit, Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = Math.min(500, g.measureText(name).width + 40); g.fillStyle = 'rgba(5,6,12,.7)'; g.beginPath(); g.roundRect?.(256 - w / 2, 22, w, 84, 42); g.fill(); g.fillStyle = col; g.fillText(name, 256, 66, 470);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false, depthTest: false })); s.scale.set(1.4, .35, 1); s.renderOrder = 5; return s;
  }
  function makeOther(p) {
    const L = p.gender === 'f' ? K.people.women : K.people.men, src = (K.pick && K.pick(p)) || L[Math.abs(p.id) % L.length], h = K.makeHuman(src, src.k * 1.78 / 43); h.mk = K.outfitKey ? K.outfitKey(p) : '';
    const col = TEAM[p.team].hex, g = h.g;
    const belt = new THREE.Mesh(new THREE.TorusGeometry(.2, .03, 6, 24), new THREE.MeshBasicMaterial({ color: col })); belt.rotation.x = Math.PI / 2; belt.scale.set(1.05, .8, 1); belt.position.y = 1.0; g.add(belt);
    const vest = new THREE.Mesh(new THREE.TorusGeometry(.19, .025, 6, 24), new THREE.MeshBasicMaterial({ color: col })); vest.rotation.x = Math.PI / 2; vest.scale.set(1.1, .75, 1); vest.position.y = 1.36; g.add(vest);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.set(1.3, 1.3, 1); halo.position.y = 1.2; g.add(halo);
    const gn = blaster(col); gn.scale.setScalar(1.3); gn.position.set(-.22, 1.2, .3); gn.rotation.y = Math.PI; g.add(gn);
    const tag = nameTag(p.name, TEAM[p.team].col); tag.position.y = 2.2; g.add(tag);
    scene.add(g);
    return { ...h, team: p.team, belt, vest, halo, x: me.x, z: me.z, tx: 0, tz: 0, tyaw: 0, yaw: 0, alive: true, shield: false, seen: false };
  }

  // ---------- 🎮 entrer dans le jeu ----------
  async function enterGame() {
    if (active || !room) return;
    active = true; closePanel?.(); closePanel = null;
    ov = el('div', { class: 'lgame' }); document.body.append(ov);
    ov.append(el('div', { class: 'lg-load' }, el('div', { class: 'lg-logo' }, '🔫'), el('b', {}, 'Chargement de l\'arène…')));
    try {
      K = await window.City3D.kit(); THREE = K.THREE;
      const m = await ack('lg_map', room.map); M = { key: m.key, grid: m.grid, cell: m.cell, W: m.grid[0].length, H: m.grid.length, name: m.name };
    } catch (e) { console.warn(e); toast('😕 Le Laser Game ne marche pas sur cet appareil'); return exitGame(); }
    if (!active) return;
    canvas = el('canvas', { class: 'lg-cv' });
    R = new THREE.WebGLRenderer({ canvas, antialias: !mobile(), powerPreference: 'high-performance' }); R.setPixelRatio(Math.min(devicePixelRatio || 1, mobile() ? 1.4 : 1.75));
    R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.1;
    others.clear(); beams = []; feed = [];
    buildScene();
    ov.replaceChildren(canvas, buildHud());
    fit(); addEventListener('resize', fit);
    bindInput();
    last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function exitGame() {
    active = false; cancelAnimationFrame(raf); removeEventListener('resize', fit); unbindInput();
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    try { R?.dispose(); } catch (e) {}
    R = null; scene = null; ov?.remove(); ov = null; others.clear();
  }
  const fit = () => { if (!R) return; const w = innerWidth, h = innerHeight; R.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };

  // ---------- l'écran de jeu (score, viseur, mini-carte…) ----------
  function buildHud() {
    hud.score = el('div', { class: 'lg-score' }); hud.feed = el('div', { class: 'lg-feed' }); hud.me = el('div', { class: 'lg-me' });
    hud.big = el('div', { class: 'lg-big hidden' }); hud.dead = el('div', { class: 'lg-dead hidden' }); hud.hurt = el('div', { class: 'lg-hurt' });
    hud.cross = el('div', { class: 'lg-cross' }, el('i'), el('i'), el('i'), el('i')); hud.end = el('div', { class: 'lg-end hidden' });
    hud.mini = el('canvas', { class: 'lg-mini', width: 260, height: 160 });
    hud.hint = el('div', { class: 'lg-hint' }, mobile() ? '🕹️ Joystick pour bouger · glisse à droite pour viser · 🔫 pour tirer' : '🖱️ Clique pour viser à la souris · ZQSD / WASD pour bouger · clic pour tirer · Échap pour libérer la souris');
    setTimeout(() => hud.hint?.classList.add('gone'), 7000);
    const quit = el('button', { class: 'lg-quit', title: 'Quitter', onclick: () => { if (room?.status === 'playing' && !confirm('Quitter la partie de Laser Game ?')) return; leaveAll(); } }, '✕');
    const box = el('div', { class: 'lg-hud' }, hud.hurt, hud.score, hud.mini, hud.feed, hud.cross, hud.me, hud.big, hud.dead, hud.end, hud.hint, quit);
    if (mobile()) {
      const knob = el('div', { class: 'joy-knob' }), pad = el('div', { class: 'joy lg-joy' }, el('i', { class: 'joy-ring' }), knob);
      let id = null;
      const mv = e => { const r = pad.getBoundingClientRect(), Rr = r.width / 2; let dx = e.clientX - (r.left + Rr), dy = e.clientY - (r.top + Rr); const d = Math.hypot(dx, dy), mx = Rr * .62; if (d > mx) { dx *= mx / d; dy *= mx / d; } knob.style.transform = `translate(${dx}px, ${dy}px)`; stick.x = dx / mx; stick.y = dy / mx; };
      pad.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); id = e.pointerId; pad.setPointerCapture?.(id); stick.on = true; mv(e); });
      pad.addEventListener('pointermove', e => { if (e.pointerId === id) mv(e); });
      const up = e => { if (e.pointerId !== id) return; id = null; stick.on = false; stick.x = stick.y = 0; knob.style.transform = ''; }; pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
      const fire = el('button', { class: 'lg-fire' }, '🔫');
      fire.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); firing = true; ac(); }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) fire.addEventListener(ev, () => { firing = false; });
      box.append(pad, fire);
    }
    return box;
  }
  function renderHud() {
    if (!hud.score || !room) return;
    const left = Math.max(0, tickEnd - (performance.now() - tickAt)), mm = Math.floor(left / 60000), ss = Math.floor(left / 1000) % 60;
    const s = room.score || { red: 0, blue: 0 };
    hud.score.replaceChildren(el('span', { class: 'red' + (myTeam() === 'red' ? ' mine' : '') }, '🔴 ' + s.red), el('b', {}, `${mm}:${String(ss).padStart(2, '0')}`), el('span', { class: 'blue' + (myTeam() === 'blue' ? ' mine' : '') }, s.blue + ' 🔵'));
    const p = room.players.find(x => x.id === myId());
    hud.me.textContent = `${TEAM[myTeam()].icon} ${TEAM[myTeam()].name} · 🎯 ${p?.tags || 0} · 💀 ${p?.deaths || 0}${me.shield ? ' · 🛡️' : ''}`;
    const nowT = Date.now(); feed = feed.filter(f => nowT - f.at < 5000);
    hud.feed.replaceChildren(...feed.map(f => el('div', { class: 'lg-kill' }, el('b', { style: `color:${TEAM[f.team].col}` }, f.by), ' 🔫 ', el('b', { style: `color:${TEAM[f.team === 'red' ? 'blue' : 'red'].col}` }, f.victim))));
    const cd = room.status === 'countdown' ? Math.ceil((room.startAt - (Date.now() - clockSkew)) / 1000) : 0;
    hud.big.classList.toggle('hidden', !(cd > 0 || (room.status === 'playing' && Date.now() - clockSkew - room.startAt < 900)));
    hud.big.textContent = cd > 0 ? String(cd) : 'GO !';
    const d = deadUntil - performance.now();
    hud.dead.classList.toggle('hidden', me.alive || d <= 0 || room.status !== 'playing');
    if (!me.alive && d > 0) hud.dead.replaceChildren(el('b', {}, '💥 Touché !'), el('small', {}, `par ${killer} · retour dans ${Math.ceil(d / 1000)} s`));
    hud.cross.classList.toggle('hit', performance.now() - hitMark < 180);
    hud.hurt.style.opacity = Math.max(0, hurt);
    drawMini();
  }
  function drawMini() {
    const c = hud.mini, g = c.getContext('2d'); if (!M) return;
    const k = Math.min(c.width / M.W, c.height / M.H); g.clearRect(0, 0, c.width, c.height); g.fillStyle = 'rgba(5,6,14,.75)'; g.fillRect(0, 0, c.width, c.height);
    M.grid.forEach((r, z) => [...r].forEach((ch, x) => { if (ch === '#' || ch === 'c') { g.fillStyle = ch === '#' ? '#5b6488' : '#3a405a'; g.fillRect(x * k, z * k, k, k); } else if (ch === 'R' || ch === 'B') { g.fillStyle = ch === 'R' ? 'rgba(255,45,74,.35)' : 'rgba(47,155,255,.35)'; g.fillRect(x * k, z * k, k, k); } }));
    const s = k / M.cell;
    for (const [id, o] of others) { if (o.team !== myTeam() || !o.alive) continue; g.fillStyle = TEAM[o.team].col; g.beginPath(); g.arc(o.x * s, o.z * s, 3.5, 0, 7); g.fill(); }
    g.save(); g.translate(me.x * s, me.z * s); g.rotate(-me.yaw); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(-5, 5); g.closePath(); g.fill(); g.restore();
  }
  function showEnd() {
    const r = room.results; if (!r || !hud.end) return;
    hud.end.classList.remove('hidden');
    const mine = r.players.find(p => p.id === myId());
    hud.end.replaceChildren(el('div', { class: 'lg-endbox' },
      el('div', { class: 'lg-logo' }, r.win ? (r.win === myTeam() ? '🏆' : '😢') : '🤝'),
      el('h3', {}, r.win ? `Victoire des ${TEAM[r.win].name} !` : 'Égalité !'),
      el('div', { class: 'lg-score big' }, el('span', { class: 'red' }, '🔴 ' + r.score.red), el('b', {}, '–'), el('span', { class: 'blue' }, r.score.blue + ' 🔵')),
      mine?.earned ? el('p', { class: 'lg-earn' }, `+${mine.earned} 💰 pour toi !`) : null,
      el('table', { class: 'lg-table' }, el('tr', {}, el('th', {}, 'Joueur'), el('th', {}, '🎯'), el('th', {}, '💀')),
        ...r.players.map((p, i) => el('tr', { class: (p.id === myId() ? 'me ' : '') + p.team }, el('td', {}, (i === 0 ? '⭐ ' : '') + p.name), el('td', {}, p.tags), el('td', {}, p.deaths)))),
      el('p', { class: 'help' }, 'Retour au salon dans quelques secondes pour une nouvelle partie…'),
      el('button', { class: 'btn', onclick: () => leaveAll() }, '🚪 Quitter')));
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    if (r.win === myTeam()) LC.confetti?.(['🏆', '🔫', '✨']);
  }
  function leaveAll() { socket.emit('lg_leave'); room = null; exitGame(); }

  // ---------- les commandes ----------
  let look = null;
  const onKey = e => {
    if (!active) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['z', 'q', 's', 'd', 'w', 'a', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === 'keydown') keys.add(k); else keys.delete(k); if (k === ' ') firing = e.type === 'keydown'; }
  };
  const onMouse = e => { if (document.pointerLockElement === canvas) { me.yaw -= e.movementX * .0024; me.pitch = Math.max(-1.2, Math.min(1.2, me.pitch - e.movementY * .0024)); } };
  const onDown = e => {
    if (e.target !== canvas) return; ac();
    if (mobile() || e.pointerType === 'touch') { look = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture?.(e.pointerId); return; }
    if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
    if (e.button === 0) firing = true;
  };
  const onMove = e => { if (look && e.pointerId === look.id) { me.yaw -= (e.clientX - look.x) * .006; me.pitch = Math.max(-1.1, Math.min(1.1, me.pitch - (e.clientY - look.y) * .005)); look.x = e.clientX; look.y = e.clientY; } };
  const onUp = e => { if (look && e.pointerId === look.id) look = null; if (e.button === 0 && !mobile()) firing = false; };
  function bindInput() { addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true); document.addEventListener('mousemove', onMouse); canvas.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); }
  function unbindInput() { removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true); document.removeEventListener('mousemove', onMouse); canvas?.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); keys.clear(); firing = false; stick.on = false; }

  // ---------- 🔫 tirer ----------
  function shoot() {
    const t = performance.now();
    if (!me.alive || room?.status !== 'playing' || t - lastShot < FIRE_MS) return;
    lastShot = t; recoil = 1; flashS.material.opacity = 1; sPew();
    socket.emit('lg_shoot', { yaw: me.yaw, pitch: me.pitch });
    // le rayon tout de suite à l'écran (le serveur dira si quelqu'un est touché)
    const h = Math.cos(me.pitch), d = new THREE.Vector3(-Math.sin(me.yaw) * h, Math.sin(me.pitch), -Math.cos(me.yaw) * h);
    let end = Math.min(45, wallDist(me.x, me.z, d.x, d.z, 45 * h) / Math.max(h, 1e-3)); if (EYE + d.y * end < 0) end = -EYE / d.y; if (EYE + d.y * end > 3.4) end = (3.4 - EYE) / d.y;
    for (const o of others.values()) { if (o.team === myTeam() || !o.alive) continue; const ex = o.x - me.x, ez = o.z - me.z, hh = d.x * d.x + d.z * d.z, tt = (ex * d.x + ez * d.z) / hh; if (tt <= 0 || tt > end) continue; const px = me.x + d.x * tt - o.x, pz = me.z + d.z * tt - o.z, py = EYE + d.y * tt; if (Math.hypot(px, pz) < .5 && py > 0 && py < 1.95) end = tt; }
    const from = gun.localToWorld(new THREE.Vector3(0, .02, -.36)), to = new THREE.Vector3(me.x, EYE, me.z).addScaledVector(d, end);
    beam(from, to, TEAM[myTeam()].hex);
  }
  function beam(a, b, col) {
    const len = a.distanceTo(b); if (len < .05) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, len, 6, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); scene.add(m);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, len, 4, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); core.position.copy(m.position); core.quaternion.copy(m.quaternion); scene.add(core);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.copy(b); sp.scale.set(.6, .6, 1); scene.add(sp);
    beams.push({ parts: [m, core, sp], t: 0 });
  }

  // ---------- chaque image ----------
  let tickEnd = 0, tickAt = 0, clockSkew = 0;
  function loop(ts) {
    if (!active || !R) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (ts - last) / 1000); last = ts;
    // je bouge
    if (me.alive && room?.status === 'playing') {
      let f = 0, s = 0;
      if (keys.has('z') || keys.has('w') || keys.has('ArrowUp')) f += 1; if (keys.has('s') || keys.has('ArrowDown')) f -= 1;
      if (keys.has('q') || keys.has('a')) s -= 1; if (keys.has('d')) s += 1;
      if (keys.has('ArrowLeft')) me.yaw += dt * 2.4; if (keys.has('ArrowRight')) me.yaw -= dt * 2.4;
      if (stick.on) { f = -stick.y; s = stick.x; }
      const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
      const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw), rx = Math.cos(me.yaw), rz = -Math.sin(me.yaw);
      const dx = (fx * f + rx * s) * SPEED * dt, dz = (fz * f + rz * s) * SPEED * dt;
      if (fits(me.x + dx, me.z)) me.x += dx; if (fits(me.x, me.z + dz)) me.z += dz;
      me.bob = (me.bob || 0) + Math.hypot(dx, dz) * 2.2;
    }
    if (ts - lastSend > 80) { lastSend = ts; socket.emit('lg_move', { x: me.x, z: me.z, yaw: me.yaw, pitch: me.pitch }); }
    if (firing) shoot();
    // la caméra et le pistolet
    camera.position.set(me.x, EYE + Math.sin(me.bob || 0) * .03, me.z); camera.rotation.set(me.pitch, me.yaw, 0);
    recoil = Math.max(0, recoil - dt * 7); gun.position.set(.17, -.16 + Math.sin((me.bob || 0) * .5) * .008, -.4 + recoil * .05); gun.rotation.x = recoil * .18;
    flashS.material.opacity = Math.max(0, flashS.material.opacity - dt * 12); gun.visible = me.alive;
    hurt = Math.max(0, hurt - dt * 1.5);
    // les autres joueurs
    for (const o of others.values()) {
      const ox = o.x, oz = o.z; o.x += (o.tx - o.x) * Math.min(1, dt * 12); o.z += (o.tz - o.z) * Math.min(1, dt * 12);
      let da = ((o.tyaw - o.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; o.yaw += da * Math.min(1, dt * 12);
      o.g.position.set(o.x, 0, o.z); o.g.rotation.y = o.yaw + Math.PI; o.g.visible = o.alive && (!o.shield || Math.floor(ts / 120) % 2 === 0);
      const sp = Math.hypot(o.x - ox, o.z - oz) / Math.max(dt, 1e-3), want = sp > 3.8 ? 'run' : sp > .6 ? 'walk' : 'idle';
      if (want !== o.cur) { const a = o.act[want]; a.reset().play(); o.act[o.cur].crossFadeTo(a, .2, false); o.cur = want; }
      o.mixer.update(dt);
    }
    // les rayons s'effacent
    for (const b of beams) { b.t += dt; const k = Math.max(0, 1 - b.t / .22); b.parts[0].material.opacity = k * .95; b.parts[1].material.opacity = k; b.parts[2].material.opacity = Math.max(0, 1 - b.t / .35); }
    for (const b of beams.filter(b => b.t > .4)) for (const p of b.parts) { scene.remove(p); p.geometry?.dispose(); p.material.dispose(); }
    beams = beams.filter(b => b.t <= .4);
    renderHud();
    R.render(scene, camera);
  }

  // ---------- les nouvelles du serveur ----------
  socket.on('lg_list', l => { list = l; if (view === 'list') renderPanel(); });
  socket.on('lg_room', r => {
    if (!room || room.id !== r.id) { if (!room) return; }
    const was = room?.status; room = r; clockSkew = Date.now() - r.serverNow;
    if ((r.status === 'countdown' || r.status === 'playing') && !active && was !== r.status) enterGame();
    if (r.status === 'countdown' && was !== 'countdown') { setTimeout(() => { if (active) sGo(); }, Math.max(0, r.startAt - r.serverNow)); }
    if (r.status === 'ended' && active) showEnd();
    if (r.status === 'lobby' && active && was === 'ended') { exitGame(); view = 'room'; panel(); }
    // l'équipe a changé : couleur du pistolet
    if (active && gun) { const col = TEAM[myTeam()].hex; gun.traverse(o => { if (o.material?.isMeshBasicMaterial) o.material.color.setHex(col); }); flashS.material.color.setHex(col); }
    for (const [id, o] of others) { const p = r.players.find(x => x.id === id); if (!p || p.team !== o.team) { scene?.remove(o.g); others.delete(id); } }
    renderPanel();
  });
  socket.on('lg_tick', d => {
    if (!active || !scene || !room) return;
    tickEnd = d.end; tickAt = performance.now(); room.score = d.s;
    for (const [id, x, z, yaw, pitch, alive, shield] of d.p) {
      if (id === myId()) { if (!alive && me.alive) me.alive = false; me.shield = !!shield; continue; }
      let o = others.get(id);
      if (!o) { const p = room.players.find(q => q.id === id); if (!p || !K) continue; o = makeOther(p); o.x = o.tx = x; o.z = o.tz = z; others.set(id, o); }
      else if (K?.outfitKey) { const p = room.players.find(q => q.id === id); if (p && o.mk !== K.outfitKey(p)) { /* 👗 tenue chargée ou changée */ scene.remove(o.g); const n = makeOther(p); Object.assign(n, { x: o.x, z: o.z, tx: o.tx, tz: o.tz, yaw: o.yaw, tyaw: o.tyaw }); o = n; others.set(id, o); } }
      o.tx = x; o.tz = z; o.tyaw = yaw; o.alive = !!alive; o.shield = !!shield;
      if (Math.hypot(o.x - x, o.z - z) > 6) { o.x = x; o.z = z; } // il vient de réapparaître
    }
  });
  socket.on('lg_spawn', s => { me.x = s.x; me.z = s.z; me.yaw = s.yaw; me.pitch = 0; me.alive = true; });
  socket.on('lg_fix', s => { me.x = s.x; me.z = s.z; });
  socket.on('lg_shot', s => {
    if (!active || !scene || s.id === myId()) { if (s.hit && s.id === myId()) { hitMark = performance.now(); sHit(); } return; }
    const o = others.get(s.id), a = o ? new THREE.Vector3(o.x, 1.25, o.z).add(new THREE.Vector3(-Math.sin(o.yaw), 0, -Math.cos(o.yaw)).multiplyScalar(.45)) : new THREE.Vector3(...s.o);
    beam(a, new THREE.Vector3(...s.e), TEAM[o?.team || 'red'].hex);
    const d = Math.hypot(s.o[0] - me.x, s.o[2] - me.z); sPew(Math.max(.015, .09 - d * .003));
  });
  socket.on('lg_tag', t => {
    if (!room) return;
    feed.push({ by: t.byName, victim: t.victimName, team: t.team, at: Date.now() }); feed = feed.slice(-5);
    for (const p of room.players) { if (p.id === t.by) p.tags++; if (p.id === t.victim) p.deaths++; }
    if (t.victim === myId()) { me.alive = false; deadUntil = performance.now() + 3000; killer = t.byName; hurt = 1; sHurt(); }
  });
  socket.on('lg_notice', m => toast(m));
  // pour les tests : se tourner vers le joueur le plus proche
  const faceNearest = () => { let b = null, bd = 1e9; for (const o of others.values()) { const d = Math.hypot(o.x - me.x, o.z - me.z); if (o.alive && d < bd) { bd = d; b = o; } } if (b) { me.yaw = Math.atan2(-(b.x - me.x), -(b.z - me.z)); me.pitch = -.05; } return b ? Math.round(bd) : -1; };
  return { panel, active: () => active, faceNearest };
})();
window.LaserGame = LaserGame;
