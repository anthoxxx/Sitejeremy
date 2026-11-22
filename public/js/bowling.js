// The Paradise — 🎳 Le Bowling en 3D (côté écran) : la salle néon, la piste en bois, les quilles et la boule.
// On glisse le doigt (ou la souris) de côté pour placer la boule, puis vers le haut pour la lancer :
// plus le geste est rapide, plus la boule va vite. Les boutons ↶ ↑ ↷ donnent de l'effet.
const Bowling = (() => {
  let lane = null, panelBox = null, closePanel = null, view = 'list', list = [];
  let active = false, K = null, THREE = null, R = null, scene = null, camera = null, ov = null, raf = 0, last = 0;
  let roomCam = false, intro = 0, ball = null, pins = [], anim = null, aimX = 0, spin = 0, drag = null, hud = {}, camZ = -1.7, msgT = 0;
  const RADIO = () => (typeof Media !== 'undefined' ? Media : null); // le lecteur radio du site
  const P = window.BowlPhys, myId = () => state.me?.id;
  const mobile = () => innerWidth < 760 || matchMedia('(pointer: coarse)').matches;
  const ack = (ev, ...a) => new Promise(res => socket.emit(ev, ...a, res));
  const myTurn = () => lane?.status === 'playing' && lane.players[lane.turn]?.id === myId() && !lane.busy && !anim;

  // ---------- 🔊 les bruitages ----------
  let AC = null; const ac = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) {} return AC; };
  // des sons fabriqués comme au cinéma : un vrai grondement de boule sur le bois, le choc, et le claquement de chaque quille
  let master = null, nb = null;
  const out = () => { const a = ac(); if (!a) return null; if (!master) { master = a.createDynamicsCompressor(); master.threshold.value = -14; master.ratio.value = 4; const g = a.createGain(); g.gain.value = .9; master.connect(g).connect(a.destination); } return master; };
  const noiseBuf = () => { const a = ac(); if (nb) return nb; const n = a.sampleRate * 2; nb = a.createBuffer(1, n, a.sampleRate); const d = nb.getChannelData(0); let br = 0; for (let i = 0; i < n; i++) { br = (br + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = br * 3.5; } return nb; }; // un bruit « brun », grave
  const white = () => { const a = ac(), n = a.sampleRate * .5, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; };
  let whiteB = null;
  // le claquement d'une quille : un « tok » en bois (plusieurs résonances) + un petit clic
  function knock(when = 0, vol = 1, pitch = 1, pan = 0) {
    const a = ac(), o = out(); if (!a || !o) return; const t = a.currentTime + when, P2 = a.createStereoPanner ? a.createStereoPanner() : a.createGain(); if (P2.pan) P2.pan.value = pan; P2.connect(o);
    for (const [f, q, d, v] of [[1180, 9, .09, 1], [2350, 12, .06, .6], [3900, 14, .035, .35], [640, 6, .12, .5]]) {
      const s = a.createBufferSource(); s.buffer = whiteB || (whiteB = white()); const fl = a.createBiquadFilter(), g = a.createGain();
      fl.type = 'bandpass'; fl.frequency.value = f * pitch * (.92 + Math.random() * .16); fl.Q.value = q; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v * vol * 1.6, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + d * (1.3 + Math.random() * .6));
      s.connect(fl).connect(g).connect(P2); s.start(t, Math.random() * .3, .25);
    }
  }
  // une quille qui retombe sur le bois (plus grave)
  function thud(when = 0, vol = .6) { const a = ac(), o = out(); if (!a || !o) return; const t = a.currentTime + when, os = a.createOscillator(), g = a.createGain(); os.frequency.setValueAtTime(190, t); os.frequency.exponentialRampToValueAtTime(70, t + .12); g.gain.setValueAtTime(vol * .5, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16); os.connect(g).connect(o); os.start(t); os.stop(t + .2); knock(when, vol * .35, .55); }
  // le premier choc de la boule dans les quilles
  function impact(n) { const a = ac(), o = out(); if (!a || !o) return; const t = a.currentTime, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = whiteB || (whiteB = white()); f.type = 'lowpass'; f.frequency.value = 2600; g.gain.setValueAtTime(.9, t); g.gain.exponentialRampToValueAtTime(.0001, t + .35); s.connect(f).connect(g).connect(o); s.start(t, 0, .4); for (let k = 0; k < 3 + n; k++) knock(Math.random() * .07, 1.1 - k * .05, .9 + Math.random() * .25, (Math.random() - .5) * .6); }
  // la boule qui roule : un grondement grave qui suit la vitesse, et se rapproche des quilles
  let roll = null;
  function rolling(on) {
    const a = ac(), o = out(); if (!a || !o) return;
    if (on && !roll) { const s = a.createBufferSource(); s.buffer = noiseBuf(); s.loop = true; const lp = a.createBiquadFilter(), hp = a.createBiquadFilter(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain(); lp.type = 'lowpass'; lp.frequency.value = 260; hp.type = 'highpass'; hp.frequency.value = 40; g.gain.value = 0; lfo.frequency.value = 7; lg.gain.value = .12; lfo.connect(lg).connect(g.gain); s.connect(hp).connect(lp).connect(g).connect(o); s.start(); lfo.start(); g.gain.setTargetAtTime(.55, a.currentTime, .08); roll = { s, g, lp, lfo }; // le petit « boum » du lâcher
      const os = a.createOscillator(), og = a.createGain(); os.frequency.setValueAtTime(95, a.currentTime); os.frequency.exponentialRampToValueAtTime(40, a.currentTime + .25); og.gain.setValueAtTime(.7, a.currentTime); og.gain.exponentialRampToValueAtTime(.0001, a.currentTime + .3); os.connect(og).connect(o); os.start(); os.stop(a.currentTime + .35); }
    if (!on && roll) { const r = roll; roll = null; r.g.gain.setTargetAtTime(0, a.currentTime, .12); setTimeout(() => { try { r.s.stop(); r.lfo.stop(); } catch (e) {} }, 800); }
  }
  const rollAt = z => { if (roll) { roll.lp.frequency.value = 200 + z * 9; roll.g.gain.value = .35 + Math.min(.4, z / 40); } };
  // la foule qui crie sur un strike, et applaudit
  function cheer(big) { const a = ac(), o = out(); if (!a || !o) return; const t = a.currentTime, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = noiseBuf(); s.loop = true; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = .7; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(big ? .9 : .45, t + .35); g.gain.exponentialRampToValueAtTime(.0001, t + (big ? 2.4 : 1.5)); s.connect(f).connect(g).connect(o); s.start(t); s.stop(t + 2.6);
    for (let k = 0; k < (big ? 26 : 12); k++) knock(.2 + Math.random() * 1.6, .25, 1.9 + Math.random() * .6, (Math.random() - .5)); }
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
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(14, 13), new THREE.MeshStandardMaterial({ map: carpet, roughness: .9 })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, -.01, -6); scene.add(fl);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 1.6, .3), new THREE.MeshStandardMaterial({ color: 0x0d0b1c, roughness: .6 })); wall.position.set(0, 1.55, 18.2); scene.add(wall);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.5, .86), neonSign('BOWLING PARADISE', '#ff2bd6')); sign.position.set(0, 1.6, 18.04); scene.add(sign);
    for (const [y, col] of [[.8, 0x38e8ff], [2.32, 0xff2bd6]]) { const s = new THREE.Mesh(new THREE.BoxGeometry(14, .04, .02), new THREE.MeshBasicMaterial({ color: col })); s.position.set(0, y, 18.03); scene.add(s); }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 4), new THREE.MeshStandardMaterial({ color: 0x050409 })); back.position.set(0, 1, 20.6); back.rotation.y = Math.PI; scene.add(back);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 30), new THREE.MeshBasicMaterial({ color: 0x0a0814 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.8, 4); ceil.scale.set(1, 1.4, 1); scene.add(ceil);
    const glowM = new THREE.MeshBasicMaterial({ color: 0xfff3d6 });
    for (let z = -2; z < 18; z += 3.2) for (const x of [-3.4, 0, 3.4]) { const l = new THREE.Mesh(new THREE.CircleGeometry(.12, 16), glowM); l.rotation.x = Math.PI / 2; l.position.set(x, 4.79, z); scene.add(l); }
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(36, 4.8), new THREE.MeshStandardMaterial({ color: 0x120c24 })); w.rotation.y = -s * Math.PI / 2; w.position.set(s * 6.6, 2.4, 4); scene.add(w); const n = new THREE.Mesh(new THREE.BoxGeometry(.02, .05, 36), new THREE.MeshBasicMaterial({ color: s < 0 ? 0x38e8ff : 0xffd23f })); n.position.set(s * 6.58, 2.6, 4); scene.add(n); }
    room();
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
  // 🛋️ la salle : la zone d'élan, les retours de boules, les écrans des scores, les fauteuils, le bar et l'écran géant
  let screenTex = null, screenCtx = null, bigScreen = null;
  function room() {
    const std = o => new THREE.MeshStandardMaterial(o), q = new THREE.Object3D();
    // la zone d'élan en bois et la marche vers les fauteuils
    const [pc, pg] = cnv(512, 512); for (let i = 0; i < 16; i++) { const v = 150 + Math.random() * 40 | 0; pg.fillStyle = `rgb(${v},${v - 45 | 0},${v - 90 | 0})`; pg.fillRect(0, i * 32, 512, 31); } for (let i = 0; i < 3000; i++) { pg.fillStyle = `rgba(80,40,10,${Math.random() * .08})`; pg.fillRect(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 40, 1); }
    const appr = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 4.6), new THREE.MeshPhysicalMaterial({ map: tex(pc, [3, 1]), roughness: .3, clearcoat: .6 })); appr.rotation.x = -Math.PI / 2; appr.position.set(0, .001, -2.3); scene.add(appr);
    const step = new THREE.Mesh(new THREE.BoxGeometry(13.2, .18, .3), std({ color: 0x1c1830, roughness: .5 })); step.position.set(0, .09, -4.75); scene.add(step);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(13.2, .02, .02), new THREE.MeshBasicMaterial({ color: 0x38e8ff })); strip.position.set(0, .19, -4.62); scene.add(strip);
    // les retours de boules entre les pistes, avec des boules de toutes les couleurs
    const hood = std({ color: 0x2b2f3a, metalness: .6, roughness: .3 }), BC = [0xff2bd6, 0x38e8ff, 0xffd23f, 0x2bff88, 0xff6a00, 0x8b5cff, 0xe8e8e8];
    for (let k = -2; k < 2; k++) {
      const x = k * 1.7 + .85, base = new THREE.Mesh(new THREE.BoxGeometry(.34, .5, 1.3), hood); base.position.set(x, .25, -1.5); scene.add(base);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, 1.3, 16, 1, false, 0, Math.PI), hood); top.rotation.set(Math.PI / 2, 0, -Math.PI / 2); top.position.set(x, .5, -1.5); scene.add(top);
      for (let b = 0; b < 3; b++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.105, 24, 16), new THREE.MeshPhysicalMaterial({ color: BC[(k + 2 + b * 3) % BC.length], roughness: .1, clearcoat: 1 })); m.position.set(x, .62, -1.9 + b * .26); scene.add(m); }
      // l'écran des scores suspendu au-dessus des pistes
      const mon = new THREE.Mesh(new THREE.BoxGeometry(1.2, .7, .06), std({ color: 0x111111 })); mon.position.set(x, 2.9, -.9); mon.rotation.x = .12; scene.add(mon);
      const [mc, mg] = cnv(256, 150); const gr = mg.createLinearGradient(0, 0, 256, 150); gr.addColorStop(0, '#1b0b3a'); gr.addColorStop(1, '#0b2a4a'); mg.fillStyle = gr; mg.fillRect(0, 0, 256, 150); mg.font = '900 30px Outfit, sans-serif'; mg.textAlign = 'center'; mg.fillStyle = '#ffd23f'; mg.fillText(`PISTES ${(k + 2) * 2 + 1}-${(k + 2) * 2 + 2}`, 128, 50); mg.fillStyle = '#38e8ff'; mg.font = '800 22px Outfit, sans-serif'; mg.fillText('🎳 BOWLING PARADISE', 128, 92); mg.fillStyle = '#ff2bd6'; mg.fillRect(20, 112, 216, 6);
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.12, .63), new THREE.MeshBasicMaterial({ map: tex(mc) })); sc.position.set(x, 2.9, -.94); sc.rotation.set(.12, Math.PI, 0); scene.add(sc);
    }
    // les fauteuils en cuir, en U, devant chaque piste, avec une petite table
    const leather = [std({ color: 0x8a1238, roughness: .38, metalness: .05 }), std({ color: 0x3b1f8a, roughness: .38 }), std({ color: 0x0f5f73, roughness: .38 })], chrome = std({ color: 0xcfd3da, metalness: .9, roughness: .2 });
    for (let k = -2; k <= 2; k++) {
      const x = k * 1.7, L = leather[(k + 2) % 3];
      const seat = (w, d, px, pz, ry) => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.BoxGeometry(w, .2, d), L); c.position.y = .32; g.add(c); const back = new THREE.Mesh(new THREE.BoxGeometry(w, .55, .16), L); back.position.set(0, .62, -d / 2 + .06); g.add(back); const foot = new THREE.Mesh(new THREE.BoxGeometry(w * .96, .22, d * .9), std({ color: 0x111014 })); foot.position.y = .11; g.add(foot); for (let i = 1; i < w / .55; i++) { const line = new THREE.Mesh(new THREE.BoxGeometry(.01, .21, d * .9), std({ color: 0x000000 })); line.position.set(-w / 2 + i * .55, .32, 0); g.add(line); } g.position.set(px, .18, pz); g.rotation.y = ry; scene.add(g); };
      seat(1.4, .6, x, -7.1, 0); seat(1.1, .6, x - .95, -6.15, Math.PI / 2); seat(1.1, .6, x + .95, -6.15, -Math.PI / 2);
      const tb = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .04, 24), std({ color: 0x15121f, metalness: .3, roughness: .2 })); tb.position.set(x, .72, -6.1); scene.add(tb);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .55, 8), chrome); leg.position.set(x, .45, -6.1); scene.add(leg);
      for (const [dx, c] of [[-.1, 0xff6a00], [.12, 0x38e8ff]]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(.04, .03, .12, 12), std({ color: c, roughness: .2, emissive: c, emissiveIntensity: .25 })); cup.position.set(x + dx, .8, -6.05); scene.add(cup); }
    }
    // le sol de la salle (moquette) jusqu'au bar
    // le bar : comptoir lumineux, tabourets, étagères de bouteilles, enseigne néon
    const bz = -10.6, counter = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.05, .7), std({ color: 0x1a1426, roughness: .4 })); counter.position.set(0, .52, bz); scene.add(counter);
    const topM = new THREE.Mesh(new THREE.BoxGeometry(7.7, .06, .85), new THREE.MeshPhysicalMaterial({ color: 0x0d0d10, roughness: .05, clearcoat: 1, metalness: .3 })); topM.position.set(0, 1.08, bz); scene.add(topM);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(7.5, .03, .02), new THREE.MeshBasicMaterial({ color: 0xff2bd6 })); glow.position.set(0, .1, bz + .36); scene.add(glow);
    const glow2 = glow.clone(); glow2.material = new THREE.MeshBasicMaterial({ color: 0x38e8ff }); glow2.position.y = 1.0; scene.add(glow2);
    for (let i = 0; i < 7; i++) { const x = -3 + i; const st = new THREE.Group(); const top = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .08, 20), leather[i % 3]); top.position.y = .78; st.add(top); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .74, 8), chrome); pole.position.y = .4; st.add(pole); const foot = new THREE.Mesh(new THREE.CylinderGeometry(.18, .2, .03, 20), chrome); foot.position.y = .015; st.add(foot); st.position.set(x, 0, bz + .75); scene.add(st); }
    const wallB = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 4.8), std({ color: 0x0f0b1e, roughness: .8 })); wallB.position.set(0, 2.4, -12.2); scene.add(wallB);
    const BOT = [0x2bff88, 0xffd23f, 0xff6a00, 0x38e8ff, 0xff2bd6, 0xe8e8ff, 0x9b5cff];
    for (const y of [1.45, 2.05]) { const shelf = new THREE.Mesh(new THREE.BoxGeometry(6, .04, .3), std({ color: 0x2a2236 })); shelf.position.set(0, y, -12.05); scene.add(shelf); const led = new THREE.Mesh(new THREE.BoxGeometry(6, .015, .015), new THREE.MeshBasicMaterial({ color: 0xffb547 })); led.position.set(0, y - .03, -11.9); scene.add(led);
      for (let i = 0; i < 22; i++) { const c = BOT[(i * 3 + (y > 2 ? 1 : 0)) % BOT.length], h = .22 + (i % 3) * .06; const b = new THREE.Mesh(new THREE.CylinderGeometry(.035, .045, h, 10), new THREE.MeshPhysicalMaterial({ color: c, transmission: .3, roughness: .1, emissive: c, emissiveIntensity: .35, transparent: true, opacity: .9 })); b.position.set(-2.8 + i * .27, y + h / 2 + .02, -12.02); scene.add(b); } }
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .5), neonSign('BAR', '#38e8ff')); bar.position.set(0, 2.75, -12.15); scene.add(bar);
    const barL = new THREE.PointLight(0xff4fd8, 8, 9, 1.5); barL.position.set(0, 2.6, -10); scene.add(barL);
    const loungeL = new THREE.PointLight(0xffb070, 10, 10, 1.4); loungeL.position.set(0, 3.2, -6); scene.add(loungeL);
    // 📺 l'écran géant au-dessus des quilles (et un autre au-dessus du bar) : ce qui passe à la musique
    const [c2, g2] = cnv(1024, 512); screenCtx = g2; screenTex = tex(c2);
    const sm = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
    const s1 = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), sm); s1.position.set(0, 3.25, 18.0); s1.rotation.y = Math.PI; scene.add(s1); bigScreen = s1;
    const f1 = new THREE.Mesh(new THREE.BoxGeometry(7.3, 3.8, .1), std({ color: 0x050505 })); f1.position.set(0, 3.25, 18.1); scene.add(f1);
    const s2 = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), sm); s2.position.set(0, 3.75, -12.15); scene.add(s2);
    drawScreen(0);
  }
  // l'écran géant : la radio ou la musique en cours, avec un égaliseur qui danse
  let scrT = 0;
  function drawScreen(ts) {
    if (!screenCtx) return; const g = screenCtx, W = 1024, H = 512, M = RADIO(), st = M?.current, on = !!(M && M.playing);
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#2a0a4a'); gr.addColorStop(.5, '#0b1a3a'); gr.addColorStop(1, '#3a0a2a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 48; i++) { const h = on ? (Math.sin(ts / 180 + i * .7) * .5 + .5) * (Math.sin(ts / 97 + i * 1.3) * .3 + .7) * 220 + 20 : 12; const x = 40 + i * 20; const c = g.createLinearGradient(0, H - 40, 0, H - 40 - h); c.addColorStop(0, '#38e8ff'); c.addColorStop(1, '#ff2bd6'); g.fillStyle = c; g.fillRect(x, H - 40 - h, 14, h); }
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.shadowColor = '#ff2bd6'; g.shadowBlur = 24; g.font = '900 64px Outfit, Inter, sans-serif';
    const yv = lane?.video; g.fillText(yv ? `📺 ${yv.title}` : st ? `${st.icon || '🎵'} ${st.name}` : '🎳 BOWLING PARADISE', W / 2, 120, W - 60); g.shadowBlur = 0;
    g.font = '700 34px Outfit, Inter, sans-serif'; g.fillStyle = on ? '#2bff88' : '#ffd23f'; g.fillText(on ? '♪ EN CE MOMENT ♪' : 'Touche 🎵 Musique pour lancer le son', W / 2, 180, W - 60);
    screenTex.needsUpdate = true;
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
    build(); placePins(lane.standing || Array(10).fill(true)); ov.replaceChildren(canvas, buildHud(canvas)); ytOn = ''; syncVideo(); fit(); addEventListener('resize', fit);
    intro = performance.now(); // une petite visite de la salle en arrivant
    last = performance.now(); raf = requestAnimationFrame(loop); renderHud();
  }
  function exit() { active = false; cancelAnimationFrame(raf); removeEventListener('resize', fit); rolling(false); try { R?.dispose(); } catch (e) {} R = null; scene = null; ov?.remove(); ov = null; anim = null; }
  const fit = () => { if (!R) return; R.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };

  // ---------- l'écran : tableau des scores, consignes, effet ----------
  function buildHud(canvas) {
    hud.board = el('div', { class: 'bw-board' }); hud.msg = el('div', { class: 'bw-msg' }); hud.big = el('div', { class: 'bw-big hidden' }); hud.end = el('div', { class: 'lg-end hidden' });
    hud.spin = el('div', { class: 'bw-spin' }, ...[[-1, '↶ Effet'], [0, '↑ Droit'], [1, 'Effet ↷']].map(([v, l]) => el('button', { type: 'button', class: v === spin ? 'on' : '', onclick: e => { e.stopPropagation(); spin = v * .6; hud.spin.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, l)));
    // 🎵 la musique de l'écran géant (notre mix du bowling, puis les radios du site)
    const MIX = { name: 'Paradise Bowling Mix', url: '/city3d/bowling-music.mp3', icon: '🎳' };
    const tracks = () => [MIX, ...((RADIO()?.stations) || [])];
    const playIdx = i => { const L = tracks(), t = L[(i + L.length) % L.length]; RADIO()?.play(t); RADIO().audio.loop = t.url === MIX.url; };
    const curIdx = () => Math.max(0, tracks().findIndex(t => t.url === RADIO()?.current?.url));
    hud.music = el('div', { class: 'bw-music' },
      el('button', { type: 'button', title: 'Précédente', onclick: e => { e.stopPropagation(); playIdx(curIdx() - 1); } }, '⏮'),
      el('button', { type: 'button', class: 'bw-play', title: 'Musique', onclick: e => { e.stopPropagation(); const M = RADIO(); if (!M) return; if (M.playing) M.audio.pause(); else if (M.current) M.toggle(); else playIdx(0); } }, '🎵 Musique'),
      el('button', { type: 'button', title: 'Suivante', onclick: e => { e.stopPropagation(); playIdx(curIdx() + 1); } }, '⏭'),
      el('button', { type: 'button', class: 'bw-yt', title: 'Mettre une vidéo YouTube sur l\'écran géant', onclick: e => { e.stopPropagation(); ytPanel(); } }, '📺 YouTube'),
      el('button', { type: 'button', title: 'Voir la salle', onclick: e => { e.stopPropagation(); roomCam = !roomCam; e.currentTarget.classList.toggle('on', roomCam); } }, '🎥'));
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
    hud.yt = el('div', { class: 'bw-ytbox hidden' }); hud.frame = el('div', { class: 'bw-frame hidden' });
    return el('div', { class: 'lg-hud bw-hud' }, hud.frame, hud.board, hud.msg, hud.big, hud.spin, hud.music, hud.yt, hud.end, quit);
  }
  // 📺 chercher une musique (ou coller un lien YouTube) pour l'écran géant
  function ytPanel() {
    const box = hud.yt, input = el('input', { class: 'input', placeholder: 'Colle un lien YouTube ou cherche une musique…', maxlength: 120 }), res = el('div', { class: 'bw-ytres' }), err = el('small', { class: 'help' });
    const go = async () => { err.textContent = '⏳ Recherche…'; res.replaceChildren(); const r = await ack('bw_search', input.value); err.textContent = r.error || (r.results?.length ? '' : 'Aucun résultat');
      res.replaceChildren(...(r.results || []).map(v => el('button', { type: 'button', class: 'bw-ytitem', onclick: async () => { const x = await ack('bw_video', v); if (x.error) { err.textContent = x.error; return; } box.classList.add('hidden'); RADIO()?.audio.pause(); } },
        el('img', { src: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`, alt: '' }), el('span', {}, el('b', {}, v.title), el('small', {}, [v.channel, v.length].filter(Boolean).join(' · ')))))); };
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); });
    box.replaceChildren(el('div', { class: 'bw-ythead' }, el('b', {}, '📺 L\'écran géant'), el('button', { type: 'button', onclick: () => box.classList.add('hidden') }, '✕')),
      el('p', { class: 'help' }, 'Mets la musique que tu veux, avec son clip : tout le monde sur la piste la voit et l\'entend en même temps.'),
      el('div', { class: 'row', style: 'gap:6px' }, input, el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: go }, '🔎')), err, res,
      lane?.video ? el('button', { type: 'button', class: 'btn btn-sm', style: 'width:100%;margin-top:8px', onclick: () => { socket.emit('bw_video', { stop: true }, () => {}); box.classList.add('hidden'); } }, '⏹ Arrêter la vidéo') : null);
    box.classList.remove('hidden'); setTimeout(() => input.focus(), 50);
  }
  let ytOn = '';
  function syncVideo() { // la vidéo YouTube, posée sur l'écran géant
    const v = lane?.video;
    if (!v) { if (ytOn) { hud.frame.replaceChildren(); hud.frame.classList.add('hidden'); ytOn = ''; } return; }
    const key = v.videoId + v.at; if (ytOn === key) return; ytOn = key;
    const start = Math.max(0, Math.floor(((lane.serverNow || v.at) - v.at + (lane._recv ? Date.now() - lane._recv : 0)) / 1000)); // on reprend la vidéo là où en sont les autres
    const f = el('iframe', { src: `https://www.youtube-nocookie.com/embed/${v.videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&controls=0&enablejsapi=1&start=${start}&origin=${encodeURIComponent(location.origin)}`, allow: 'autoplay; encrypted-media', title: v.title });
    f.addEventListener('load', () => setTimeout(() => { for (const c of ['unMute', 'playVideo']) f.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: c, args: [] }), '*'); }, 600));
    hud.frame.replaceChildren(f, el('div', { class: 'bw-frame-t' }, `🎵 ${v.title} · par ${v.by}`)); hud.frame.classList.remove('hidden');
    RADIO()?.audio.pause();
  }
  const V3 = () => new THREE.Vector3();
  function placeFrame() { // à chaque image : l'écran géant vu par la caméra → la vidéo se met pile dessus (sinon en petit dans un coin)
    if (!ytOn || !bigScreen) return; const pts = [[-3.5, -1.75], [3.5, -1.75], [3.5, 1.75], [-3.5, 1.75]].map(([x, y]) => bigScreen.localToWorld(V3().set(x, y, 0)).project(camera));
    const ok = pts.every(p => p.z < 1 && Math.abs(p.x) < 1.15 && Math.abs(p.y) < 1.15) && !roomCam;
    const W = innerWidth, H = innerHeight, xs = pts.map(p => (p.x + 1) / 2 * W), ys = pts.map(p => (1 - p.y) / 2 * H);
    const st = hud.frame.style;
    if (ok && Math.max(...xs) - Math.min(...xs) > 90) { hud.frame.classList.remove('mini'); st.left = Math.min(...xs) + 'px'; st.top = Math.min(...ys) + 'px'; st.width = (Math.max(...xs) - Math.min(...xs)) + 'px'; st.height = (Math.max(...ys) - Math.min(...ys)) + 'px'; }
    else { hud.frame.classList.add('mini'); st.left = st.top = st.width = st.height = ''; }
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
      ball.visible = !f[3]; ball.position.set(f[0], P.BALL.r, f[1]); ball.rotation.x = f[2]; rollAt(f[1]); if (f[3] && roll) rolling(false);
      f[4].forEach((q, i) => { if (q && q[2] && !anim.fell[i]) { anim.fell[i] = 1; if (anim.hit) knock(0, .8 + Math.random() * .3, .85 + Math.random() * .4, q[0]); setTimeout(() => thud(0, .5), 200 + Math.random() * 250); } }); // chaque quille claque quand elle tombe
      f[4].forEach((q, i) => { const m = pins[i]; if (!q) { if (!anim.standing[i]) m.visible = false; return; } m.visible = anim.standing[i] && !q[5]; m.position.set(q[0], 0, q[1]);
        if (q[2]) { const tgt = Math.PI / 2 * .98; m.rotation.order = 'YXZ'; m.rotation.y = q[3]; m.rotation.x = Math.min(tgt, (m.rotation.x || 0) + dt * 9); if (m.rotation.x > .3 && !anim.hit) { anim.hit = true; impact(anim.count); } } else { m.rotation.z = Math.sin(ts / 40) * q[4] * .05; } });
      const bz = f[1]; camZ += ((bz < 14 ? bz - 2.4 : 12.2) - camZ) * Math.min(1, dt * 5);
      if (k >= fr.length - 1 && !anim.done) { anim.done = true; rolling(false); if (anim.kind === 'strike') big('STRIKE !', 'strike'); else if (anim.kind === 'spare') big('SPARE !', 'spare'); else if (anim.kind === 'gutter') big('Rigole… 😅', 'gutter'); else big(anim.count + (anim.count > 1 ? ' quilles' : ' quille'), ''); if (anim.kind === 'strike' || anim.kind === 'spare') cheer(anim.kind === 'strike'); if (anim.kind === 'strike' || anim.kind === 'spare') LC.confetti?.(anim.kind === 'strike' ? ['🎳', '💥', '✨'] : ['🎳', '✨']); setTimeout(() => { anim = null; renderHud(); }, 900); }
    } else {
      if (lane?.status === 'playing') { ball.visible = true; ball.position.set(aimX, P.BALL.r, 0); ball.rotation.set(0, 0, 0); }
      camZ += (-1.7 - camZ) * Math.min(1, dt * 3);
    }
    if (ts - scrT > 80) { scrT = ts; drawScreen(ts); }
    placeFrame();
    hud.arrow.visible = myTurn(); hud.arrow.position.x = aimX; hud.arrow.rotation.z = -spin * .08;
    const near = camZ > 6; camera.position.set(near ? 0 : aimX * .5, near ? 1.15 : 1.05, camZ); camera.lookAt(near ? 0 : aimX * .3, near ? .1 : 0, near ? 18.6 : camZ + 7.5);
    const it = intro ? (ts - intro) / 3800 : 1;
    if (it < 1 && !anim) { // l'arrivée : on part du bar, on passe au-dessus des fauteuils, et on arrive sur la piste
      const e = it * it * (3 - 2 * it), a = Math.PI * (1 - e) * .9;
      camera.position.set(Math.sin(a) * 4.2 * (1 - e) + aimX * .5 * e, 2.4 - 1.35 * e, -6 - Math.cos(a) * 4 * (1 - e) + (camZ + 6) * e);
      camera.lookAt(0, .4 * (1 - e), (camZ + 7.5) * e + -8 * (1 - e) * Math.cos(a) * .2 + 10 * (1 - e));
    } else intro = 0;
    if (roomCam && !anim) { const a = ts / 9000; camera.position.set(Math.sin(a) * 3.5, 2.2, -2.5 + Math.cos(a) * 1.5); camera.lookAt(0, .8, -8); } // 🎥 la vue de la salle
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
    lane._recv = Date.now(); if (active) syncVideo();
    renderHud(); render();
  });
  socket.on('bw_throw', d => {
    if (!active || !lane || d.lane !== lane.id) return;
    placePins(d.standing); anim = { fell: {}, frames: d.frames, t: 0, t0: performance.now(), kind: d.kind, count: d.count, standing: d.standing }; ac(); rolling(true);
    hud.msg.textContent = d.by === myId() ? '🎳 C\'est parti !' : `🎳 ${d.name} lance…`; hud.spin.classList.add('hidden');
  });
  return { panel, active: () => active };
})();
window.Bowling = Bowling;
