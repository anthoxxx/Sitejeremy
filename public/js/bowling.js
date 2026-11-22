// The Paradise — 🎳 Le Bowling en 3D (côté écran) : la salle néon, la piste en bois, les quilles et la boule.
// On glisse le doigt (ou la souris) de côté pour placer la boule, puis vers le haut pour la lancer :
// plus le geste est rapide, plus la boule va vite. Les boutons ↶ ↑ ↷ donnent de l'effet.
const Bowling = (() => {
  let lane = null, panelBox = null, closePanel = null, view = 'list', list = [];
  let active = false, K = null, THREE = null, R = null, scene = null, camera = null, ov = null, raf = 0, last = 0;
  let ball = null, pins = [], anim = null, aimX = 0, spin = 0, drag = null, hud = {}, camZ = -1.7, msgT = 0;
  const P = window.BowlPhys, myId = () => state.me?.id;
  const mobile = () => innerWidth < 760 || matchMedia('(pointer: coarse)').matches;
  const ack = (ev, ...a) => new Promise(res => socket.emit(ev, ...a, res));
  const myTurn = () => lane?.status === 'playing' && lane.players[lane.turn]?.id === myId() && !lane.busy && !anim;

  // ---------- 🔊 les bruitages ----------
  let AC = null; const ac = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) {} return AC; };
  function noise(dur, vol, f0, f1) { const a = ac(); if (!a) return; const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain(); fl.type = 'bandpass'; fl.frequency.setValueAtTime(f0, a.currentTime); fl.frequency.exponentialRampToValueAtTime(f1, a.currentTime + dur); g.gain.value = vol; s.buffer = b; s.connect(fl).connect(g).connect(a.destination); s.start(); }
  let rollSnd = null;
  function rolling(on) { const a = ac(); if (!a) return; if (on && !rollSnd) { const o = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 55; f.type = 'lowpass'; f.frequency.value = 180; g.gain.value = .05; o.connect(f).connect(g).connect(a.destination); o.start(); rollSnd = { o, g }; } if (!on && rollSnd) { rollSnd.g.gain.setTargetAtTime(0, a.currentTime, .1); rollSnd.o.stop(a.currentTime + .4); rollSnd = null; } }
  const crash = n => { for (let i = 0; i < Math.min(6, n + 1); i++) setTimeout(() => noise(.18 + Math.random() * .2, .35, 2500 + Math.random() * 2000, 600), i * 40); };

  // ---------- 🚪 le salon d'attente ----------
  async function panel() {
    const d = await ack('bw_list'); list = d.lanes; lane = d.current; view = lane ? 'lane' : 'list';
    panelBox = el('div', { class: 'lg-panel bw-panel' }); closePanel = modal(panelBox); render();
  }
  function render() {
    if (!panelBox || !panelBox.isConnected) return;
    const kids = [el('div', { class: 'lg-logo' }, '🎳'), el('h3', {}, 'Bowling du Paradise')];
    if (view === 'lane' && lane) {
      const host = lane.host === myId();
      kids.push(el('p', { class: 'help' }, lane.status === 'lobby' ? 'Les joueurs de la piste (4 au maximum) :' : lane.status === 'ended' ? 'Partie terminée' : 'Partie en cours'));
      kids.push(el('ol', { class: 'bw-players' }, ...lane.players.map(p => el('li', { class: p.id === myId() ? 'me' : '' }, (p.id === lane.host ? '👑 ' : p.bot ? '🎖️ ' : '🎳 ') + p.name, lane.status !== 'lobby' ? el('b', {}, ' ' + p.total) : null))));
      if (host && lane.status === 'lobby') {
        if (lane.players.length < 4) kids.push(el('button', { class: 'btn', style: 'width:100%', onclick: () => socket.emit('bw_bot') }, '🎖️ Ajouter un soldat (robot) contre qui jouer'));
        kids.push(el('button', { class: 'btn btn-primary lg-go', onclick: () => socket.emit('bw_start') }, lane.players.length === 1 ? '▶️ Jouer seul' : '▶️ Lancer la partie'));
        kids.push(el('p', { class: 'help' }, 'Tes amis peuvent rejoindre ta piste depuis le bouton 🎳 Bowling de la Ville.'));
      } else if (lane.status === 'lobby') kids.push(el('p', { class: 'lg-wait' }, '⏳ En attente que le chef de la piste lance la partie…'));
      else kids.push(el('button', { class: 'btn btn-primary lg-go', onclick: () => enter() }, '🎳 Aller sur la piste'));
      kids.push(el('p', { class: 'help' }, '🎯 10 cases, 2 lancers par case. Strike = toutes les quilles d\'un coup ! Gagnant : 15 💰, les autres : 5 💰, et +30 💰 si tu fais plus de 200 points.'));
      kids.push(el('button', { class: 'btn', style: 'width:100%', onclick: () => { socket.emit('bw_leave'); lane = null; view = 'list'; ack('bw_list').then(d => { list = d.lanes; render(); }); } }, '🚪 Quitter la piste'));
    } else {
      kids.push(el('p', { class: 'help' }, 'Une vraie partie de bowling en 3D : seul, entre amis ou contre les soldats du Paradise.'));
      kids.push(el('button', { class: 'btn btn-primary lg-go', onclick: async () => { const r = await ack('bw_create', {}); if (r.error) return toast(r.error); lane = r.lane; view = 'lane'; render(); } }, '➕ Prendre une piste'));
      kids.push(el('h4', {}, '🎳 Les pistes ouvertes'));
      kids.push(list.length ? el('div', { class: 'lg-list' }, ...list.map(l => el('div', { class: 'lg-row' }, el('span', { class: 'lg-mi' }, '🎳'), el('div', {}, el('b', {}, l.name), el('small', {}, `${l.n}/${l.max} joueurs · ${l.status === 'lobby' ? 'en attente' : 'en cours'}`)),
        l.status === 'lobby' ? el('button', { class: 'btn btn-sm btn-primary', onclick: async () => { const x = await ack('bw_join', l.id); if (x.error) return toast(x.error); lane = x.lane; view = 'lane'; render(); } }, 'Rejoindre') : null)))
        : el('p', { class: 'help' }, 'Aucune piste pour le moment : prends la tienne !'));
    }
    panelBox.replaceChildren(...kids);
  }

  // ---------- 🎨 les textures ----------
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
  function laneTex() { // le bois clair de la piste, avec les flèches et les points
    const [c, g] = cnv(256, 4096), W = 256, H = 4096, k = H / 19.4;
    for (let i = 0; i < 39; i++) { const x = i * W / 39; const v = 200 + Math.random() * 35 | 0; g.fillStyle = `rgb(${v},${v - 40 | 0},${v - 95 | 0})`; g.fillRect(x, 0, W / 39 + 1, H); }
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(120,70,20,${Math.random() * .08})`; g.fillRect(Math.random() * W, Math.random() * H, 1, 8 + Math.random() * 30); }
    const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, 'rgba(255,255,255,.08)'); grad.addColorStop(.6, 'rgba(255,255,255,0)'); g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.fillStyle = '#c0392b'; g.fillRect(0, H - 1 - 0 * k - 4, W, 4); // la ligne de faute
    g.fillStyle = '#1b1b1b'; for (const i of [3, 8, 13, 18, 23, 28, 33]) { g.beginPath(); g.arc(i * W / 39 + 3, H - 2.1 * k, 3, 0, 7); g.fill(); }
    for (const [i, d] of [[5, 4.9], [10, 4.6], [15, 4.3], [19.5, 4.0], [24, 4.3], [29, 4.6], [34, 4.9]]) { const x = i * W / 39, y = H - d * k; g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x - 5, y + 6); g.lineTo(x + 5, y + 6); g.closePath(); g.fill(); }
    return tex(c);
  }
  function pinGeo() { // le profil d'une vraie quille (38 cm)
    const p = [[0, 0], [.026, 0], [.034, .02], [.05, .06], [.06, .1], [.059, .14], [.05, .18], [.035, .22], [.022, .25], [.02, .27], [.024, .3], [.03, .33], [.029, .355], [.02, .372], [0, .381]].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(p, 24); return g;
  }
  function pinTex() { const [c, g] = cnv(64, 256); g.fillStyle = '#f7f5f0'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#d4202a'; g.fillRect(0, 256 * (1 - .3), 64, 7); g.fillRect(0, 256 * (1 - .275), 64, 7); return tex(c); }
  function ballTex(col) { // une boule marbrée avec ses trois trous
    const [c, g] = cnv(512, 256); g.fillStyle = col; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(255,255,255,${.05 + Math.random() * .12})`; g.lineWidth = 3 + Math.random() * 10; g.beginPath(); let x = Math.random() * 512, y = Math.random() * 256; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - .5) * 120; y += (Math.random() - .5) * 60; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = '#0a0a0a'; for (const [x, y, r] of [[250, 110, 9], [278, 110, 9], [264, 150, 11]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    return tex(c);
  }
  function neonSign(text, col) { const [c, g] = cnv(1024, 160); g.font = '900 104px Outfit, Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = 30; g.fillStyle = '#fff'; g.fillText(text, 512, 84); g.shadowBlur = 12; g.fillStyle = col; g.fillText(text, 512, 84); return new THREE.MeshBasicMaterial({ map: tex(c), transparent: true }); }

  // ---------- 🏗️ la salle ----------
  function build() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x07060f); scene.fog = new THREE.Fog(0x07060f, 18, 34);
    scene.add(new THREE.HemisphereLight(0xb7b3ff, 0x2a1830, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(2, 6, -3); scene.add(key);
    const spot = new THREE.SpotLight(0xffffff, 60, 12, .5, .5, 1.5); spot.position.set(0, 3.2, 16); spot.target.position.set(0, 0, 18.8); scene.add(spot, spot.target);
    const wood = laneTex(), gutterM = new THREE.MeshStandardMaterial({ color: 0x23252c, metalness: .6, roughness: .35 });
    const laneM = new THREE.MeshPhysicalMaterial({ map: wood, roughness: .18, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: .8 });
    const pinM = new THREE.MeshPhysicalMaterial({ map: pinTex(), roughness: .25, clearcoat: .9 }), pg = pinGeo();
    // la piste du joueur et 2 pistes de chaque côté (le décor)
    for (let k = -2; k <= 2; k++) {
      const x = k * 1.7, L = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 19.4), laneM); L.rotation.x = -Math.PI / 2; L.position.set(x, 0, 9.7 - .02); scene.add(L);
      for (const s of [-1, 1]) { const gt = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 19.4, 16, 1, true, 0, Math.PI), gutterM); gt.rotation.set(Math.PI / 2, 0, Math.PI); gt.position.set(x + s * .65, .06, 9.7); scene.add(gt); }
      const cap = new THREE.Mesh(new THREE.BoxGeometry(.28, .09, 19.4), new THREE.MeshStandardMaterial({ color: 0x15131d, roughness: .5 })); cap.position.set(x + .85, .045, 9.7); scene.add(cap);
      if (k) for (const [px, pz] of P.PINS) { const m = new THREE.Mesh(pg, pinM); m.position.set(x + px, 0, pz); scene.add(m); }
    }
    // le sol, le mur du fond (cache des quilles) avec ses néons, le plafond et ses lumières
    const carpet = (() => { const [c, g] = cnv(256, 256); g.fillStyle = '#120b26'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 40; i++) { g.strokeStyle = ['#ff2bd6', '#38e8ff', '#ffd23f', '#2bff88'][i % 4]; g.globalAlpha = .55; g.lineWidth = 3; g.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; g.arc(x, y, 6 + Math.random() * 14, 0, Math.PI * (1 + Math.random())); g.stroke(); } return tex(c, [8, 4]); })();
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshStandardMaterial({ map: carpet, roughness: .9 })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, -.01, -5); scene.add(fl);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 1.6, .3), new THREE.MeshStandardMaterial({ color: 0x0d0b1c, roughness: .6 })); wall.position.set(0, 1.55, 18.2); scene.add(wall);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.5, .86), neonSign('BOWLING PARADISE', '#ff2bd6')); sign.position.set(0, 1.6, 18.04); scene.add(sign);
    for (const [y, col] of [[.8, 0x38e8ff], [2.32, 0xff2bd6]]) { const s = new THREE.Mesh(new THREE.BoxGeometry(14, .04, .02), new THREE.MeshBasicMaterial({ color: col })); s.position.set(0, y, 18.03); scene.add(s); }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 4), new THREE.MeshStandardMaterial({ color: 0x050409 })); back.position.set(0, 1, 20.6); back.rotation.y = Math.PI; scene.add(back);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 30), new THREE.MeshBasicMaterial({ color: 0x0a0814 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.4, 8); scene.add(ceil);
    const glowM = new THREE.MeshBasicMaterial({ color: 0xfff3d6 });
    for (let z = -2; z < 18; z += 3.2) for (const x of [-3.4, 0, 3.4]) { const l = new THREE.Mesh(new THREE.CircleGeometry(.12, 16), glowM); l.rotation.x = Math.PI / 2; l.position.set(x, 3.39, z); scene.add(l); }
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(30, 3.4), new THREE.MeshStandardMaterial({ color: 0x120c24 })); w.rotation.y = -s * Math.PI / 2; w.position.set(s * 6.6, 1.7, 8); scene.add(w); const n = new THREE.Mesh(new THREE.BoxGeometry(.02, .05, 30), new THREE.MeshBasicMaterial({ color: s < 0 ? 0x38e8ff : 0xffd23f })); n.position.set(s * 6.58, 2.6, 8); scene.add(n); }
    // les quilles et la boule du joueur
    pins = P.PINS.map(([x, z]) => { const m = new THREE.Mesh(pg, pinM); m.position.set(x, 0, z); m.castShadow = true; scene.add(m); return m; });
    const col = { red: '#c0392b', blue: '#1f4fd6', purple: '#7b2ff7', green: '#18a558', pink: '#ff4fa2', gold: '#d4a017' }[['red', 'blue', 'purple', 'green', 'pink', 'gold'][Math.abs(myId() || 0) % 6]];
    ball = new THREE.Mesh(new THREE.SphereGeometry(P.BALL.r, 40, 28), new THREE.MeshPhysicalMaterial({ map: ballTex(col), roughness: .08, clearcoat: 1, clearcoatRoughness: .02, metalness: .1 })); ball.position.set(0, P.BALL.r, 0); scene.add(ball);
    // la flèche de visée
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(.05, 3.5), new THREE.MeshBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: .45 })); arrow.rotation.x = -Math.PI / 2; arrow.position.set(0, .006, 2.2); scene.add(arrow); hud.arrow = arrow;
    // les reflets (une salle sombre et colorée)
    const pm = new THREE.PMREMGenerator(R), env = new THREE.Scene(); env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: 0x1a1430, side: THREE.BackSide })));
    for (const [x, y, z, c] of [[3, 4, 2, 0xff2bd6], [-3, 4, 6, 0x38e8ff], [0, 5, -4, 0xffffff]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: c })); s.position.set(x, y, z); env.add(s); }
    scene.environment = pm.fromScene(env, .04).texture;
    camera = new THREE.PerspectiveCamera(mobile() ? 62 : 52, 1, .05, 60);
  }
  function placePins(standing) { pins.forEach((m, i) => { const [x, z] = P.PINS[i]; m.visible = !!standing[i]; m.position.set(x, 0, z); m.rotation.set(0, 0, 0); }); }

  // ---------- 🎮 entrer sur la piste ----------
  async function enter() {
    if (active || !lane) return;
    active = true; closePanel?.(); closePanel = null;
    ov = el('div', { class: 'lgame bw' }, el('div', { class: 'lg-load' }, el('div', { class: 'lg-logo' }, '🎳'), el('b', {}, 'On prépare la piste…'))); document.body.append(ov);
    try { K = await window.City3D.kit(); THREE = K.THREE; } catch (e) { toast('😕 Le bowling ne marche pas sur cet appareil'); return exit(); }
    if (!active) return;
    const canvas = el('canvas', { class: 'lg-cv' });
    R = new THREE.WebGLRenderer({ canvas, antialias: true }); R.setPixelRatio(Math.min(devicePixelRatio || 1, mobile() ? 1.6 : 1.75)); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.15;
    build(); placePins(lane.standing || Array(10).fill(true)); ov.replaceChildren(canvas, buildHud(canvas)); fit(); addEventListener('resize', fit);
    last = performance.now(); raf = requestAnimationFrame(loop); renderHud();
  }
  function exit() { active = false; cancelAnimationFrame(raf); removeEventListener('resize', fit); rolling(false); try { R?.dispose(); } catch (e) {} R = null; scene = null; ov?.remove(); ov = null; anim = null; }
  const fit = () => { if (!R) return; R.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };

  // ---------- l'écran : tableau des scores, consignes, effet ----------
  function buildHud(canvas) {
    hud.board = el('div', { class: 'bw-board' }); hud.msg = el('div', { class: 'bw-msg' }); hud.big = el('div', { class: 'bw-big hidden' }); hud.end = el('div', { class: 'lg-end hidden' });
    hud.spin = el('div', { class: 'bw-spin' }, ...[[-1, '↶ Effet'], [0, '↑ Droit'], [1, 'Effet ↷']].map(([v, l]) => el('button', { type: 'button', class: v === spin ? 'on' : '', onclick: e => { e.stopPropagation(); spin = v * .6; hud.spin.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, l)));
    const quit = el('button', { class: 'lg-quit', title: 'Quitter', onclick: () => { if (lane?.status === 'playing' && !confirm('Quitter la partie de bowling ?')) return; socket.emit('bw_leave'); lane = null; exit(); } }, '✕');
    canvas.addEventListener('pointerdown', e => { ac(); if (!myTurn()) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), ax: aimX, pts: [[e.clientX, e.clientY, performance.now()]] }; canvas.setPointerCapture?.(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; drag.pts.push([e.clientX, e.clientY, performance.now()]); if (drag.pts.length > 12) drag.pts.shift(); const dy = drag.y - e.clientY; if (dy < 30) aimX = Math.max(-.45, Math.min(.45, drag.ax + (e.clientX - drag.x) * .0028)); });
    const up = e => {
      if (!drag || e.pointerId !== drag.id) return; const d = drag; drag = null;
      const [x0, y0, t0] = d.pts[0], dy = y0 - e.clientY, dx = e.clientX - x0, dt = Math.max(30, performance.now() - t0);
      if (dy < 60) return; // un petit geste : on a juste placé la boule
      const speed = Math.max(4.5, Math.min(9.5, 3.5 + (dy / dt) * 3.2)), angle = Math.max(-.05, Math.min(.05, Math.atan2(dx, dy) * .12));
      socket.emit('bw_throw', { x: aimX, angle, speed, spin }); hud.msg.textContent = '🎳 C\'est parti !';
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', () => { drag = null; });
    return el('div', { class: 'lg-hud bw-hud' }, hud.board, hud.msg, hud.big, hud.spin, hud.end, quit);
  }
  function renderHud() {
    if (!hud.board || !lane) return;
    hud.board.replaceChildren(el('table', {}, ...lane.players.map((p, i) => el('tr', { class: (i === lane.turn && lane.status === 'playing' ? 'turn ' : '') + (p.id === myId() ? 'me' : '') },
      el('th', {}, p.name), ...p.frames.map((f, k) => el('td', { class: k === 9 ? 'tenth' : '' }, el('i', {}, f.marks.join(' ')), el('b', {}, f.total ?? ''))), el('td', { class: 'sum' }, p.total)))));
    const cur = lane.players[lane.turn];
    if (lane.status === 'playing' && !anim) hud.msg.textContent = myTurn() ? (mobile() ? '👆 Glisse de côté pour viser, puis vers le haut pour lancer !' : '🖱️ Glisse de côté pour viser, puis vers le haut pour lancer !') : `⏳ C'est au tour de ${cur?.name || '…'}`;
    hud.spin.classList.toggle('hidden', !myTurn());
  }
  function showEnd() {
    const r = lane.results; if (!r || !hud.end) return; hud.end.classList.remove('hidden');
    const mine = r.find(x => x.id === myId());
    hud.end.replaceChildren(el('div', { class: 'lg-endbox' }, el('div', { class: 'lg-logo' }, r[0].id === myId() ? '🏆' : '🎳'), el('h3', {}, r.length > 1 ? `${r[0].name} gagne avec ${r[0].total} points !` : `Ton score : ${r[0].total} points`),
      mine?.earned ? el('p', { class: 'lg-earn' }, `+${mine.earned} 💰 pour toi !`) : null,
      el('table', { class: 'lg-table' }, el('tr', {}, el('th', {}, 'Joueur'), el('th', {}, 'Score'), el('th', {}, '❌ Strikes')), ...r.map((p, i) => el('tr', { class: p.id === myId() ? 'me' : '' }, el('td', {}, (i === 0 ? '🥇 ' : '') + p.name), el('td', {}, p.total), el('td', {}, p.strikes)))),
      el('p', { class: 'help' }, 'Retour à la piste dans quelques secondes pour rejouer…'), el('button', { class: 'btn', onclick: () => { socket.emit('bw_leave'); lane = null; exit(); } }, '🚪 Quitter')));
    if (r[0].id === myId()) LC.confetti?.(['🏆', '🎳', '✨']);
  }
  function big(text, cls) { hud.big.textContent = text; hud.big.className = 'bw-big ' + cls; clearTimeout(msgT); msgT = setTimeout(() => hud.big.classList.add('hidden'), 1800); }

  // ---------- chaque image ----------
  function loop(ts) {
    if (!active || !R) return; raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (ts - last) / 1000); last = ts;
    if (anim) { // on rejoue le lancer calculé par le serveur
      anim.t = (performance.now() - anim.t0) / 1000; /* sur l'horloge réelle : même un téléphone lent reste à l'heure */ const fr = anim.frames, k = Math.min(fr.length - 1, Math.floor(anim.t * 30)), f = fr[k];
      ball.visible = !f[3]; ball.position.set(f[0], P.BALL.r, f[1]); ball.rotation.x = f[2];
      f[4].forEach((q, i) => { const m = pins[i]; if (!q) { if (!anim.standing[i]) m.visible = false; return; } m.visible = anim.standing[i] && !q[5]; m.position.set(q[0], 0, q[1]);
        if (q[2]) { const tgt = Math.PI / 2 * .98; m.rotation.order = 'YXZ'; m.rotation.y = q[3]; m.rotation.x = Math.min(tgt, (m.rotation.x || 0) + dt * 9); if (m.rotation.x > .3 && !anim.hit) { anim.hit = true; crash(anim.count); } } else { m.rotation.z = Math.sin(ts / 40) * q[4] * .05; } });
      const bz = f[1]; camZ += ((bz < 14 ? bz - 2.4 : 12.2) - camZ) * Math.min(1, dt * 5);
      if (k >= fr.length - 1 && !anim.done) { anim.done = true; rolling(false); if (anim.kind === 'strike') big('STRIKE !', 'strike'); else if (anim.kind === 'spare') big('SPARE !', 'spare'); else if (anim.kind === 'gutter') big('Rigole… 😅', 'gutter'); else big(anim.count + (anim.count > 1 ? ' quilles' : ' quille'), ''); if (anim.kind === 'strike' || anim.kind === 'spare') LC.confetti?.(anim.kind === 'strike' ? ['🎳', '💥', '✨'] : ['🎳', '✨']); setTimeout(() => { anim = null; renderHud(); }, 900); }
    } else {
      if (lane?.status === 'playing') { ball.visible = true; ball.position.set(aimX, P.BALL.r, 0); ball.rotation.set(0, 0, 0); }
      camZ += (-1.7 - camZ) * Math.min(1, dt * 3);
    }
    hud.arrow.visible = myTurn(); hud.arrow.position.x = aimX; hud.arrow.rotation.z = -spin * .08;
    const near = camZ > 6; camera.position.set(near ? 0 : aimX * .5, near ? 1.15 : 1.05, camZ); camera.lookAt(near ? 0 : aimX * .3, near ? .1 : 0, near ? 18.6 : camZ + 7.5);
    R.render(scene, camera);
  }

  // ---------- les nouvelles du serveur ----------
  socket.on('bw_list', l => { list = l; if (view === 'list') render(); });
  socket.on('bw_lane', l => {
    if (!lane || lane.id !== l.id) return;
    const was = lane.status; lane = l;
    if (l.status === 'playing' && was !== 'playing' && !active) enter();
    if (active && !anim) placePins(l.standing);
    if (l.status === 'ended' && active) showEnd();
    if (l.status === 'lobby' && was === 'ended' && active) { exit(); view = 'lane'; panel(); }
    renderHud(); render();
  });
  socket.on('bw_throw', d => {
    if (!active || !lane || d.lane !== lane.id) return;
    placePins(d.standing); anim = { frames: d.frames, t: 0, t0: performance.now(), kind: d.kind, count: d.count, standing: d.standing }; ac(); rolling(true);
    hud.msg.textContent = d.by === myId() ? '🎳 C\'est parti !' : `🎳 ${d.name} lance…`; hud.spin.classList.add('hidden');
  });
  return { panel, active: () => active };
})();
window.Bowling = Bowling;
