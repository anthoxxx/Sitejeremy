// The Paradise — 🔧 Le Garage Paradise : ta voiture 3D tourne sur le pont élévateur, tu choisis la peinture, les néons et les jantes.
// Ta voiture garde son style quand tu touches « 🚗 Conduire » dans la Ville.
const Garage = (() => {
  let open_ = false, root = null, R = null, scene = null, camera = null, K = null, THREE = null, raf = 0, clock = null;
  let data = null, car = null, tab = 'paint', trial = {}, spin = 0, drag = null;
  const mob = () => innerWidth < 760;
  const coinsTxt = () => `💰 ${state.me?.coins ?? 0}`;
  const say = t => { const s = root?.querySelector('.ofs-say'); if (s) s.textContent = t; };
  const TABS = { paint: '🎨 Peinture', neon: '💡 Néons', rims: '🛞 Jantes' };

  async function open() {
    if (open_) return;
    if (state.me?.isGuest) return toast('Inscris-toi pour aller au garage 🔧');
    if (!window.City3D?.kit) return toast('😕 La 3D ne marche pas sur cet appareil');
    open_ = true;
    root = el('div', { class: 'ofs gar' },
      el('canvas', { class: 'ofs-cv' }),
      el('div', { class: 'ofs-top' },
        el('div', { class: 'ofs-sign' }, el('span', {}, '🔧'), el('div', {}, el('b', {}, 'Garage Paradise'), el('small', {}, 'Peinture, néons et jantes pour ta voiture'))),
        el('span', { class: 'ofs-coins' }, coinsTxt()),
        el('button', { class: 'btn btn-sm ofs-x', title: 'Sortir du garage', onclick: close }, '✕')),
      el('div', { class: 'ofs-npc' }, el('b', {}, '🧰 Momo, le mécano'), el('span', { class: 'ofs-say' }, 'Salut ! Choisis une couleur, je te la montre direct sur ta voiture 😎')),
      el('div', { class: 'ofs-load' }, el('div', { class: 'ofs-spin' }), el('span', {}, 'On ouvre le garage…')),
      el('div', { class: 'ofs-panel' }));
    document.body.append(root); document.body.classList.add('ofs-on');
    try {
      [K, data] = await Promise.all([window.City3D.kit(), api('/api/garage')]);
      if (!open_) return;
      THREE = K.THREE; trial = { ...data.car }; build(); showCar();
      root.querySelector('.ofs-load')?.remove(); renderPanel();
    } catch (e) { console.warn('garage', e); toast('😕 Le garage n\'a pas pu s\'ouvrir'); close(); }
  }
  function close() {
    open_ = false; cancelAnimationFrame(raf); removeEventListener('resize', resize);
    try { R?.dispose(); R?.forceContextLoss?.(); } catch (e) {}
    R = scene = camera = car = null; root?.remove(); root = null; document.body.classList.remove('ofs-on');
  }
  // ---------- 🏭 l'atelier en 3D ----------
  function build() {
    const cv = root.querySelector('.ofs-cv');
    R = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); R.setPixelRatio(Math.min(devicePixelRatio || 1, mob() ? 1.6 : 2));
    R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.shadowMap.enabled = true;
    scene = new THREE.Scene(); scene.background = new THREE.Color('#1a1c22'); scene.fog = new THREE.Fog('#1a1c22', 420, 900);
    camera = new THREE.PerspectiveCamera(38, 1, 1, 3000); clock = new THREE.Clock();
    const STD = o => new THREE.MeshStandardMaterial(o);
    { const env = new THREE.Scene(), pm = new THREE.PMREMGenerator(R); env.background = new THREE.Color('#30343c');
      for (const [x, y, z, c, s] of [[0, 300, 0, '#ffffff', 400], [-300, 120, 100, '#ffd9a8', 200], [300, 120, 100, '#a8d8ff', 200]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); }
      scene.environment = pm.fromScene(env, .04).texture; pm.dispose(); }
    // le sol en béton peint, les lignes jaunes, les murs en tôle
    const conc = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.fillStyle = '#5a5d63'; g.fillRect(0, 0, 512, 512); for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .06})`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); } for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(20,18,15,.12)'; g.beginPath(); g.ellipse(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 50, 10 + Math.random() * 30, Math.random() * 3, 0, 7); g.fill(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), STD({ map: conc, roughness: .7, metalness: .1 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const yellow = new THREE.MeshBasicMaterial({ color: '#f2c40c' });
    for (const x of [-95, 95]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(4, 260), yellow); l.rotation.x = -Math.PI / 2; l.position.set(x, .3, 0); scene.add(l); }
    const wallM = STD({ color: '#3a3f48', roughness: .6, metalness: .5 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1400, 400), wallM); back.position.set(0, 200, -260); scene.add(back);
    for (let i = -6; i <= 6; i++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(4, 400, 6), STD({ color: '#2c3038', metalness: .6, roughness: .5 })); rib.position.set(i * 60, 200, -257); scene.add(rib); }
    // le panneau à outils et l'enseigne
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(300, 70), new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, map: (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 240; const g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 120px Outfit, Arial'; g.shadowColor = '#ff8a1f'; g.shadowBlur = 30; g.fillStyle = '#ffd6a8'; g.fillText('🔧 GARAGE', 512, 125); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() }));
    sign.position.set(0, 230, -255); scene.add(sign);
    const board = new THREE.Mesh(new THREE.BoxGeometry(160, 90, 3), STD({ color: '#c94a1a', roughness: .7 })); board.position.set(-230, 110, -255); scene.add(board);
    for (let i = 0; i < 12; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(4, 22 + (i % 3) * 8, 3), STD({ color: '#d8dce2', metalness: .9, roughness: .3 })); t.position.set(-290 + i * 11, 110, -252); scene.add(t); }
    // des pneus empilés et une servante (le chariot à outils)
    for (let i = 0; i < 4; i++) { const ti = new THREE.Mesh(new THREE.TorusGeometry(16, 7, 10, 24), STD({ color: '#121214', roughness: .9 })); ti.rotation.x = Math.PI / 2; ti.position.set(230, 7 + i * 14, -200); ti.castShadow = true; scene.add(ti); }
    { const cart = new THREE.Mesh(new THREE.BoxGeometry(50, 60, 30), STD({ color: '#c0161c', metalness: .5, roughness: .35 })); cart.position.set(-210, 30, -170); cart.castShadow = true; scene.add(cart); }
    // le pont élévateur
    const lift = new THREE.Group(); lift.name = 'lift'; scene.add(lift);
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(70, 74, 6, 48), STD({ color: '#2a2d33', metalness: .8, roughness: .3 })); plat.position.y = 3; plat.receiveShadow = true; lift.add(plat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(72, 1.2, 8, 64), new THREE.MeshBasicMaterial({ color: '#ff8a1f', toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 6.2; lift.add(ring);
    // les lumières
    scene.add(new THREE.HemisphereLight('#e8eef8', '#30343c', .8));
    const key = new THREE.SpotLight('#fff4e6', 9000, 900, Math.PI / 6, .5, 1.2); key.position.set(120, 380, 260); key.target.position.set(0, 10, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key, key.target);
    for (const x of [-200, 0, 200]) { const l = new THREE.PointLight('#e0ecff', 1800, 600, 1.3); l.position.set(x, 300, -60); scene.add(l); const tube = new THREE.Mesh(new THREE.BoxGeometry(110, 3, 8), new THREE.MeshBasicMaterial({ color: '#f4f8ff' })); tube.position.set(x, 330, -60); scene.add(tube); }
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, s: spin }; });
    cv.addEventListener('pointermove', e => { if (drag) spin = drag.s + (e.clientX - drag.x) * .01; });
    const up = () => { drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    addEventListener('resize', resize); resize();
    const loop = () => { if (!open_) return; raf = requestAnimationFrame(loop); const dt = Math.min(.05, clock.getDelta()); if (!drag) spin += dt * .3; const L = scene.getObjectByName('lift'); if (L) L.rotation.y = spin; R.render(scene, camera); };
    loop();
  }
  function resize() {
    if (!R || !root) return; const w = innerWidth, h = innerHeight; R.setSize(w, h, false); camera.aspect = w / h; camera.clearViewOffset();
    if (mob()) { camera.fov = 42; camera.position.set(0, 120, 300); camera.lookAt(0, 20, 0); camera.setViewOffset(w, h, 0, h * .16, w, h); }
    else { camera.fov = 36; camera.position.set(60, 95, 230); camera.lookAt(60, 22, 0); }
    camera.updateProjectionMatrix();
  }
  const cfgOf = t => ({ paintHex: data.paint[t.paint]?.hex || '', neonHex: data.neon[t.neon] || '', rimsHex: data.rims[t.rims]?.hex || '' });
  function showCar() {
    const L = scene.getObjectByName('lift'); if (car) L.remove(car);
    car = K.car(cfgOf(trial)); car.position.y = 6; car.traverse(o => { if (o.isMesh) o.castShadow = true; }); L.add(car);
  }
  function renderPanel() {
    const P = root?.querySelector('.ofs-panel'); if (!P || !data) return;
    const tabs = el('div', { class: 'ofs-tabs' }, ...Object.entries(TABS).map(([k, l]) => el('button', { class: 'ofs-tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; renderPanel(); } }, l)));
    const list = tab === 'paint' ? Object.entries(data.paint).map(([id, c]) => [id, c.name, c.hex]) : tab === 'rims' ? Object.entries(data.rims).map(([id, c]) => [id, c.name, c.hex]) : Object.entries(data.neon).map(([id, hex]) => [id, id[0].toUpperCase() + id.slice(1), hex]);
    const cur = data.car[tab] || '', want = trial[tab] || '';
    const sw = (id, name, hex) => el('button', { class: 'ofs-dye' + (want === id ? ' sel' : '') + (cur === id ? ' wear' : ''), onclick: () => { trial[tab] = id; showCar(); say(id ? `${name} ? Ça claque ! 🔥` : 'Comme à la sortie de l\'usine 👌'); renderPanel(); } },
      el('i', { style: hex ? `background:${hex}${tab === 'neon' ? `;box-shadow:0 0 14px ${hex}` : ''}` : 'background:repeating-linear-gradient(45deg,#555 0 6px,#333 6px 12px)' }), el('small', {}, name));
    const none = tab === 'paint' ? 'D\'origine' : tab === 'neon' ? 'Pas de néons' : 'D\'origine';
    // tout ce qui a changé (peinture, néons, jantes) se fait en une fois
    const todo = Object.keys(TABS).filter(k => (trial[k] || '') !== (data.car[k] || '')), total = todo.reduce((a, k) => a + (trial[k] ? data.price[k] : 0), 0);
    const main = !todo.length ? el('button', { class: 'btn ofs-buy done', disabled: true }, '✅ C\'est ta voiture')
      : el('button', { class: 'btn btn-primary ofs-buy' + ((state.me.coins || 0) >= total ? '' : ' poor'), onclick: () => save(todo, total) }, total ? `🔧 Faire le travail (${todo.length}) · ${total} 💰` : '↩️ Remettre d\'origine · gratuit');
    P.replaceChildren(tabs, el('div', { class: 'ofs-dyes' }, sw('', none, ''), ...list.map(([id, n, h]) => sw(id, n, h))),
      el('p', { class: 'help', style: 'margin:0;font-size:.78rem;opacity:.75' }, '🚗 Ta voiture garde ce style quand tu touches « Conduire » dans la Ville.'), el('div', { class: 'ofs-act' }, main));
  }
  async function save(todo, total) {
    if (total && (state.me.coins || 0) < total) { say(`Il te manque ${total - (state.me.coins || 0)} pièces 💰`); return toast(`Il te faut ${total} pièces 💰`); }
    const id = todo.some(k => trial[k]);
    try { let r = null; const want = { ...trial }; for (const k of todo) { r = await api('/api/garage', { method: 'POST', body: { part: k, id: want[k] || '' } }); data.car = r.car; } trial = { ...data.car };
      if (r?.coins != null) { state.me.coins = r.coins; window.Shop?.counter?.(); } root.querySelector('.ofs-coins').textContent = coinsTxt();
      say(id ? '🔧 Et voilà le travail ! Va la montrer dans la Ville 😎' : 'C\'est remis d\'origine 👌'); toast('🚗 Ta voiture est prête !'); try { if (id) window.LC?.confetti?.(['🔧', '🚗', '✨']); } catch (e) {} renderPanel(); } catch (e) { toast(e.message); }
  }
  // 🧽 le lavage auto : ta voiture brille
  function wash() { try { window.LC?.confetti?.(['🫧', '🧽', '✨', '💦']); } catch (e) {} toast('🧽 Lavage terminé : ta voiture brille comme neuve ✨ (touche « Conduire » pour la sortir)'); }
  return { open, close, wash, isOpen: () => open_ };
})();
window.Garage = Garage;
