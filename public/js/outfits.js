// The Paradise — 👗 « Paradise Mode » : le magasin de vêtements 3D de la Ville
// On entre dans une vraie boutique en 3D : portants de vêtements, miroirs, et ton personnage sur un podium.
// Touche une tenue pour l'essayer (ton personnage se change devant toi), achète-la, porte-la :
// tout le monde la voit sur ton personnage 3D dans la Ville et au Paradise Complex.
const Outfits = (() => {
  let open_ = false, root = null, R = null, scene = null, camera = null, K = null, THREE = null, raf = 0;
  let data = null, sel = '', tab = '', hum = null, anim = 'idle', spin = 0, drag = null, clock = null, loadingId = '';
  const IMG = id => `/city3d/outfits/img/${id}.jpg`;
  const mob = () => innerWidth < 760;
  const myKey = () => K?.outfitKey ? K.outfitKey({ id: state.me.id, gender: state.me.gender, outfit: data?.current || '' }) : 'h1';
  const coinsTxt = () => `💰 ${state.me?.coins ?? 0}`;

  async function open() {
    if (open_) return;
    if (state.me?.isGuest) return toast('Inscris-toi pour entrer au magasin de vêtements 🛍️');
    if (!window.City3D?.kit) return toast('😕 La 3D ne marche pas sur cet appareil');
    open_ = true;
    root = el('div', { class: 'ofs' },
      el('canvas', { class: 'ofs-cv' }),
      el('div', { class: 'ofs-top' },
        el('div', { class: 'ofs-sign' }, el('span', {}, '👗'), el('div', {}, el('b', {}, 'Paradise Mode'), el('small', {}, 'La boutique de vêtements'))),
        el('span', { class: 'ofs-coins' }, coinsTxt()),
        el('button', { class: 'btn btn-sm ofs-x', title: 'Sortir du magasin', onclick: close }, '✕')),
      el('div', { class: 'ofs-npc' }, el('b', {}, '🛍️ Inès, la vendeuse'), el('span', { class: 'ofs-say' }, 'Bienvenue ! Touche une tenue pour l\'essayer, ton personnage se change devant toi ✨')),
      el('div', { class: 'ofs-load' }, el('div', { class: 'ofs-spin' }), el('span', {}, 'On ouvre la boutique…')),
      el('div', { class: 'ofs-panel' }));
    document.body.append(root);
    document.body.classList.add('ofs-on');
    try {
      [K, data] = await Promise.all([window.City3D.kit(), api('/api/outfits')]);
      if (!open_) return;
      THREE = K.THREE;
      tab = state.me.gender === 'f' ? 'f' : 'h';
      sel = data.current || myKey();
      build();
      await tryOn(sel);
      root.querySelector('.ofs-load')?.remove();
      renderPanel();
    } catch (e) { console.warn('boutique 3D', e); toast('😕 La boutique 3D n\'a pas pu s\'ouvrir'); close(); }
  }
  function close() {
    open_ = false; cancelAnimationFrame(raf);
    try { R?.dispose(); R?.forceContextLoss?.(); } catch (e) {}
    scene?.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) { o.geometry?.dispose?.(); } });
    R = scene = camera = hum = null;
    removeEventListener('resize', resize);
    root?.remove(); root = null; document.body.classList.remove('ofs-on');
  }

  // ---------- 🏬 la boutique en 3D ----------
  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  function build() {
    const cv = root.querySelector('.ofs-cv');
    R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    R.setPixelRatio(Math.min(devicePixelRatio || 1, mob() ? 1.6 : 2));
    R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.1;
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); scene.background = new THREE.Color('#2a1d2e'); scene.fog = new THREE.Fog('#2a1d2e', 9, 22);
    camera = new THREE.PerspectiveCamera(36, 1, .05, 60);
    clock = new THREE.Clock();
    const STD = o => new THREE.MeshStandardMaterial(o);
    // reflets doux (pour les miroirs et le chrome) : une petite pièce lumineuse
    { const env = new THREE.Scene(), pm = new THREE.PMREMGenerator(R); env.background = new THREE.Color('#3a2a3a');
      for (const [x, y, z, c, s] of [[0, 4, 0, '#fff4e6', 6], [-4, 2, 2, '#ff9ad8', 2], [4, 2, 2, '#9ad8ff', 2], [0, 2, -5, '#ffe2b0', 3]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 1, 0); env.add(m); }
      scene.environment = pm.fromScene(env, .04).texture; pm.dispose(); }
    // le sol en parquet
    const wood = canvasTex(512, 512, (g, w, h) => { for (let i = 0; i < 8; i++) { const l = 46 + (i * 37 % 14); g.fillStyle = `hsl(28,38%,${l}%)`; g.fillRect(0, i * h / 8, w, h / 8); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, i * h / 8, w, 2); for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(60,30,10,${Math.random() * .08})`; g.fillRect(Math.random() * w, i * h / 8 + Math.random() * h / 8, 60 + Math.random() * 120, 1.5); } g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect((i * 173) % w, i * h / 8, 2, h / 8); } });
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(4, 4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), STD({ map: wood, roughness: .45, metalness: 0 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    // les murs
    const wallM = STD({ color: '#f4e9e1', roughness: .9 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), wallM); back.position.set(0, 3, -4.2); back.receiveShadow = true; scene.add(back);
    for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), wallM); w.position.set(sx * 5.2, 3, 0); w.rotation.y = -sx * Math.PI / 2; w.receiveShadow = true; scene.add(w); }
    // plinthes et bandeau rose
    const pink = STD({ color: '#ff4fa8', emissive: '#ff2d8a', emissiveIntensity: 1.6, roughness: .4 });
    { const strip = new THREE.Mesh(new THREE.BoxGeometry(10.4, .05, .05), pink); strip.position.set(0, 3.6, -4.15); scene.add(strip); }
    // l'enseigne « Paradise Mode » au mur
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, .85), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, map: canvasTex(1024, 256, (g, w, h) => { g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff2d8a'; g.shadowBlur = 28; g.fillStyle = '#ffd6ec'; g.font = 'italic 800 120px Outfit, Georgia, serif'; g.fillText('Paradise Mode', w / 2, h / 2 + 6); g.shadowBlur = 50; g.fillText('Paradise Mode', w / 2, h / 2 + 6); }) }));
    sign.position.set(0, 3.05, -4.15); scene.add(sign);
    // le podium où se tient le personnage
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(.85, .9, .16, 48), STD({ color: '#fbfbfd', roughness: .25, metalness: .1 })); pod.position.y = .08; pod.receiveShadow = pod.castShadow = true; scene.add(pod);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.875, .018, 8, 64), pink); ring.rotation.x = Math.PI / 2; ring.position.y = .16; scene.add(ring);
    // les portants : une barre chromée et des vêtements suspendus (couleurs des tenues du magasin)
    const chrome = STD({ color: '#e8e8ee', metalness: 1, roughness: .15 });
    const COLS = ['#1b3d8f', '#f0f0f0', '#2b2b2b', '#c0283a', '#6d4b2f', '#8fd3ff', '#ff7ab8', '#3a8f4a', '#7b4ec9', '#e8d9c0', '#111', '#d94f2a'];
    const rack = (x, z, ry, seed) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 2.2, 10), chrome); bar.rotation.z = Math.PI / 2; bar.position.y = 1.62; g.add(bar);
      for (const sx of [-1.1, 1.1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.62, 10), chrome); p.position.set(sx, .81, 0); g.add(p); const f = new THREE.Mesh(new THREE.CylinderGeometry(.2, .22, .03, 20), chrome); f.position.set(sx, .015, 0); g.add(f); }
      for (let i = 0; i < 9; i++) {
        const c = COLS[(i * 5 + seed) % COLS.length], m = STD({ color: c, roughness: .85 }), long = (i + seed) % 3 === 0;
        const cloth = new THREE.Mesh(new THREE.BoxGeometry(.06, long ? .95 : .7, .52), m); cloth.position.set(-.95 + i * .238, 1.56 - (long ? .52 : .4), 0); cloth.rotation.y = (Math.random() - .5) * .25; cloth.castShadow = true; g.add(cloth);
        const sh = new THREE.Mesh(new THREE.BoxGeometry(.07, .08, .58), m); sh.position.set(cloth.position.x, 1.5, 0); g.add(sh);
        const hook = new THREE.Mesh(new THREE.TorusGeometry(.035, .005, 6, 12, Math.PI * 1.4), chrome); hook.position.set(cloth.position.x, 1.64, 0); hook.rotation.y = Math.PI / 2; g.add(hook);
      }
    };
    rack(-3.6, -1.2, Math.PI / 2.4, 0); rack(3.6, -1.2, -Math.PI / 2.4, 3); rack(-2.2, -3.4, 0, 6); rack(2.2, -3.4, 0, 9);
    // une table de présentation avec des pulls pliés
    { const t = new THREE.Mesh(new THREE.BoxGeometry(1.2, .75, .6), STD({ color: '#ffffff', roughness: .3 })); t.position.set(-3.1, .375, 1.6); t.castShadow = t.receiveShadow = true; scene.add(t);
      for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(.32, .06, .3), STD({ color: COLS[(i * 3 + k) % COLS.length], roughness: .9 })); f.position.set(-3.5 + i * .4, .78 + k * .062, 1.6); f.castShadow = true; scene.add(f); } }
    // les miroirs des cabines d'essayage, avec leurs rideaux
    const mirror = STD({ color: '#ffffff', metalness: 1, roughness: .02, envMapIntensity: 1.4 });
    for (const sx of [-1, 1]) {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(.95, 2.2, .06), STD({ color: '#c9a24a', metalness: .9, roughness: .3 })); fr.position.set(sx * 3.9, 1.25, 2.4); fr.rotation.y = -sx * Math.PI / 2.6; scene.add(fr);
      const mi = new THREE.Mesh(new THREE.PlaneGeometry(.82, 2.05), mirror); mi.position.copy(fr.position); mi.rotation.copy(fr.rotation); mi.translateZ(.035); scene.add(mi);
    }
    { const cur = STD({ color: '#8a1d4a', roughness: .95, side: THREE.DoubleSide }); for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, 2.4, 24, 1, true, 0, Math.PI), cur); c.position.set(sx * 4.4, 1.25, -3.2 + 0); c.scale.set(1, 1, .25); scene.add(c); } }
    // des plantes
    for (const [x, z] of [[-4.6, -3.7], [4.6, -3.7]]) { const pot = new THREE.Mesh(new THREE.CylinderGeometry(.22, .17, .45, 16), STD({ color: '#ffffff', roughness: .4 })); pot.position.set(x, .225, z); scene.add(pot); for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), STD({ color: '#2f7d3a', roughness: .8 })); l.position.set(x + Math.sin(i * 2.4) * .18, .7 + i * .12, z + Math.cos(i * 2.4) * .18); l.scale.set(1, 1.5, .6); scene.add(l); } }
    // les lumières : un grand spot sur le podium, des spots chauds au plafond
    scene.add(new THREE.HemisphereLight('#fff6ee', '#4a3040', .9));
    const key = new THREE.SpotLight('#fff3e6', 60, 14, Math.PI / 7, .45, 1.4); key.position.set(1.6, 5.2, 3.2); key.target.position.set(0, .9, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0004; scene.add(key, key.target);
    const rim = new THREE.SpotLight('#ff9ad8', 25, 12, Math.PI / 6, .6, 1.5); rim.position.set(-2.4, 4, -2.6); rim.target.position.set(0, 1.1, 0); scene.add(rim, rim.target);
    const fill = new THREE.PointLight('#9ad8ff', 6, 10, 1.6); fill.position.set(2.6, 2, 2.4); scene.add(fill);
    for (const [x, z] of [[-2.2, -2.6], [2.2, -2.6], [-3.4, .4], [3.4, .4]]) { const s = new THREE.SpotLight('#ffe0b8', 14, 8, Math.PI / 5, .7, 1.5); s.position.set(x, 4.6, z); s.target.position.set(x, 0, z - .6); scene.add(s, s.target); }
    // tourner le personnage en glissant le doigt (ou la souris)
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, s: spin }; cv.setPointerCapture?.(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (drag) spin = drag.s + (e.clientX - drag.x) * .012; });
    const up = () => { drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    addEventListener('resize', resize); resize();
    const loop = () => { if (!open_) return; raf = requestAnimationFrame(loop); frame(); };
    loop();
  }
  function resize() {
    if (!R || !root) return; const w = innerWidth, h = innerHeight; R.setSize(w, h, false); camera.aspect = w / h;
    // téléphone : le personnage au-dessus du panneau des tenues ; ordinateur : à gauche du panneau
    camera.clearViewOffset();
    if (mob()) { camera.fov = 34; camera.position.set(0, 1.4, 8.4); camera.lookAt(0, .9, 0); camera.setViewOffset(w, h, 0, h * .15, w, h); /* le personnage au-dessus du panneau */ }
    else { camera.fov = 34; camera.position.set(.85, 1.2, 4.3); camera.lookAt(.85, .92, 0); }
    camera.updateProjectionMatrix();
  }
  function frame() {
    const dt = Math.min(.05, clock.getDelta());
    if (!drag) spin += dt * .35; // le personnage tourne doucement sur le podium
    if (hum) { hum.g.rotation.y = spin; hum.mixer.update(dt); }
    R.render(scene, camera);
  }

  // ---------- 🧍 essayer une tenue ----------
  async function tryOn(id) {
    sel = id; loadingId = id; renderPanel();
    let src = K.people.by?.[id];
    if (!src) { say('Je vais te chercher ça en réserve… ⏳'); src = await K.loadOutfit(id); }
    if (!open_ || loadingId !== id) return;
    loadingId = '';
    if (!src) { say('😕 Cette tenue n\'a pas pu se charger, réessaie'); renderPanel(); return; }
    if (hum) scene.remove(hum.g);
    hum = K.makeHuman(src, src.k * 1.72 / 43);
    hum.g.position.y = .16; hum.g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    scene.add(hum.g);
    playAnim(anim, true);
    const o = data.list[id]; say(o ? `${o.name} : ${o.price ? 'trop beau sur toi ! 😍' : 'un classique qui te va bien 👌'}` : '✨');
    renderPanel();
  }
  function playAnim(n, now) {
    if (!hum) return; anim = n; const a = hum.act[n] || hum.act.idle; if (!a) return;
    if (now || !hum.act[hum.cur]) { for (const k in hum.act) hum.act[k].stop(); a.reset().play(); }
    else if (hum.cur !== n) { a.reset().play(); hum.act[hum.cur].crossFadeTo(a, .3, false); }
    hum.cur = n;
  }
  const say = t => { const s = root?.querySelector('.ofs-say'); if (s) s.textContent = t; };

  // ---------- 🛍️ le panneau des tenues ----------
  function renderPanel() {
    const P = root?.querySelector('.ofs-panel'); if (!P || !data) return;
    const owned = new Set(data.owned || []), wearing = data.current || myKey();
    const has = id => data.list[id].price === 0 || owned.has(id);
    const ids = Object.keys(data.list).filter(id => data.list[id].g === tab);
    const tabs = el('div', { class: 'ofs-tabs' }, ...[['f', '👗 Femme'], ['h', '👔 Homme'], ['mine', '✅ Mes tenues']].map(([k, l]) => el('button', { class: 'ofs-tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; renderPanel(); } }, l)));
    const list = tab === 'mine' ? Object.keys(data.list).filter(has) : ids;
    const cards = el('div', { class: 'ofs-cards' }, ...list.map(id => { const o = data.list[id];
      return el('button', { class: 'ofs-card' + (sel === id ? ' sel' : '') + (wearing === id ? ' wear' : ''), onclick: () => tryOn(id) },
        el('img', { src: IMG(id), alt: '', loading: 'lazy' }),
        el('b', {}, o.name), el('small', {}, o.tag),
        el('span', { class: 'ofs-price' + (has(id) ? ' own' : '') }, wearing === id ? '👕 Portée' : has(id) ? (o.price ? '✅ À toi' : '🆓 Gratuit') : `💰 ${o.price}`),
        loadingId === id ? el('i', { class: 'ofs-cl' }) : null);
    }));
    const o = data.list[sel], canAfford = o && (state.me.coins || 0) >= o.price;
    const main = !o ? null : wearing === sel ? el('button', { class: 'btn ofs-buy done', disabled: true }, '👕 Tu portes cette tenue')
      : has(sel) ? el('button', { class: 'btn btn-primary ofs-buy', onclick: () => act('wear') }, '👕 Porter cette tenue')
      : el('button', { class: 'btn btn-primary ofs-buy' + (canAfford ? '' : ' poor'), onclick: () => act('buy') }, `🛍️ Acheter et porter · ${o.price} 💰`);
    const anims = el('div', { class: 'ofs-anims' }, ...[['idle', '🧍', 'Pose'], ['walk', '🚶', 'Défilé'], ['dance', '💃', 'Danse']].map(([k, ic, l]) => el('button', { class: 'ofs-an' + (anim === k ? ' on' : ''), title: l, onclick: () => { playAnim(k); renderPanel(); } }, ic, el('span', {}, ' ' + l))));
    P.replaceChildren(tabs, cards, el('div', { class: 'ofs-act' }, anims, main));
    const c = cards.querySelector('.sel'); if (c && !P.__scrolled) { P.__scrolled = true; c.scrollIntoView({ block: 'nearest', inline: 'center' }); }
  }
  async function act(what) {
    const o = data.list[sel]; if (!o) return;
    if (what === 'buy' && (state.me.coins || 0) < o.price) { say(`Il te manque ${o.price - (state.me.coins || 0)} pièces 💰 Joue dans la Ville ou au complexe pour en gagner !`); return toast(`Il te faut ${o.price} pièces 💰`); }
    try {
      const r = await api('/api/outfits/' + what, { method: 'POST', body: { id: sel } });
      if (r.bought) { data.owned = [...new Set([...(data.owned || []), sel])]; if (r.coins != null) { state.me.coins = r.coins; window.Shop?.counter?.(); } try { window.LC?.confetti?.(['👗', '✨', '🛍️']); } catch (e) {} }
      data.current = r.current ?? sel;
      root.querySelector('.ofs-coins').textContent = coinsTxt();
      say(r.bought ? `🛍️ Merci pour ton achat ! Tu portes maintenant « ${o.name} » 😍` : `👕 Tu portes « ${o.name} » : va te montrer dans la Ville !`);
      toast(`👕 Nouvelle tenue : ${o.name}`);
      renderPanel();
    } catch (e) { toast(e.message); }
  }
  return { open, close, isOpen: () => open_ };
})();
window.Outfits = Outfits;
