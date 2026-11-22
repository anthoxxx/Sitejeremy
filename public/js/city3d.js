// The Paradise — 🏙️ La Ville en vraie 3D, rendu réaliste : lumière « appareil photo » (ACES), reflets du ciel sur les vitres,
// immeubles détaillés (étages, encadrements, fenêtres éclairées la nuit), tours en verre, trottoirs en relief, feux tricolores,
// voitures arrondies (qui roulent, garées, et la tienne), personnages arrondis, arbres, ciel avec soleil et nuages.
// La bibliothèque 3D (three.js) n'est chargée que si on choisit la vue 3D.
const City3D = (() => {
  let mode = 'top'; // 'top' = vue du dessus (2D) · 'third' = 3ᵉ personne · 'first' = 1ʳᵉ personne
  try { mode = localStorage.getItem('lc_city_view') || 'top'; } catch (e) {}
  let THREE = null, R = null, scene = null, camera = null, canvas = null, A = null, built = false, pad = null, carBtn = null;
  let camLen = 120, yaw = 0, pitch = -0.08, pos = { x: 0, y: 0 }, bob = 0, driving = false, speed = 0, lift = 0, lastSky = 0, starting = false, ray = null, nightNow = -1;
  const people = new Map(), solids = [], cars = [], glowMats = [], walls = []; // walls = le sol occupé par les bâtiments (on ne passe pas à travers)
  const mobile = () => innerWidth < 700;
  const FLOOR = 54, CURB = 3, HS = .62; // HS = taille des personnages (plus petits = plus réaliste à côté des immeubles)
  const SH = !mobile() || (navigator.hardwareConcurrency || 4) >= 6; // les ombres (aussi sur les téléphones assez puissants)
  const rnd = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const pick = l => l[Math.floor(rnd() * l.length)];

  // three.js et ses outils (chargeur de modèles 3D, ciel photo HDR, copie de personnages animés)
  let LIB = null, ASSET = null;
  const MEN = ['h1', 'h2'], WOMEN = ['f1', 'f2'];
  async function loadThree() {
    const V = '/js/vendor/';
    const [T, G, H, SK, MO, BGU] = await Promise.all([import(V + 'three.module.min.js'), import(V + 'jsm/loaders/GLTFLoader.js'), import(V + 'jsm/loaders/RGBELoader.js'), import(V + 'jsm/utils/SkeletonUtils.js'), import(V + 'jsm/libs/meshopt_decoder.module.js'), import(V + 'jsm/utils/BufferGeometryUtils.js')]);
    LIB = { GLTFLoader: G.GLTFLoader, RGBELoader: H.RGBELoader, SK, Meshopt: MO.MeshoptDecoder, BGU };
    return T;
  }
  // 🧍🚗🌤️ les vrais modèles : des humains animés (marche, course, danse), une vraie voiture, un ciel en photo, de l'herbe en photo
  function loadAssets() {
    if (ASSET) return Promise.resolve(ASSET);
    const gl = new LIB.GLTFLoader(); gl.setMeshoptDecoder(LIB.Meshopt);
    const glb = f => gl.loadAsync('/city3d/' + f);
    const hdr = new LIB.RGBELoader().loadAsync('/city3d/sky.hdr');
    const grass = new THREE.TextureLoader().loadAsync('/city3d/grass.jpg');
    const all = Promise.all([glb('anim_m.glb'), glb('anim_f.glb'), ...MEN.map(n => glb(n + '.glb')), ...WOMEN.map(n => glb(n + '.glb')), glb(mobile() ? 'car_lo.glb' : 'car_hi.glb'), glb('car_lo.glb'), hdr, grass]).then(([am, af, ...rest]) => {
      const ppl = rest.splice(0, MEN.length + WOMEN.length), [carHi, carLo, sky, gr] = rest;
      const { men, women } = PEOPLE || (PEOPLE = peopleFrom(am, af, ppl));
      // la voiture : on regroupe ses ~30 morceaux en 5 (carrosserie, vitres, noir, chrome, feux) pour que ça reste fluide
      const carMats = { body: null, glass: STD({ color: 0x080b10, metalness: .9, roughness: .06, envMapIntensity: .7 }), dark: STD({ color: 0x141518, roughness: .55, metalness: .1 }), metal: STD({ color: 0xc4c8ce, metalness: .95, roughness: .22 }), red: STD({ color: 0x8a0d0d, emissive: 0xff2020, emissiveIntensity: .5, roughness: .25, metalness: .2 }) };
      const kindOf = (n, mesh) => /Body_Color/.test(n) ? 'body' : /Taillight|Turn_Signal/i.test(n) ? 'red' : /Glass/.test(n) ? 'glass' : /Leather|Interior|Carpet|Carbon|plastic|Tires/i.test(n) ? 'dark' : /chrome|metal_gray|Yellow|DodgerBlue/i.test(n) ? 'metal' : /lights_red|Taillight|Turn_Signal/i.test(n + ' ' + mesh) ? 'red' : 'dark';
      const car = g => {
        g.scene.updateMatrixWorld(true); const parts = {};
        g.scene.traverse(o => { if (!o.isMesh) return; const k = kindOf(o.material.name || '', o.name + ' ' + (o.parent?.name || '')), ge = o.geometry.clone(); for (const a of Object.keys(ge.attributes)) { if (a !== 'position' && a !== 'normal') { ge.deleteAttribute(a); continue; } const at = ge.attributes[a], f = new Float32Array(at.count * 3); for (let i = 0; i < at.count; i++) { f[i * 3] = at.getX(i); f[i * 3 + 1] = at.getY(i); f[i * 3 + 2] = at.getZ(i); } ge.setAttribute(a, new THREE.BufferAttribute(f, 3)); } /* en vrais nombres (le fichier les stocke compressés) */ if (!ge.attributes.normal) ge.computeVertexNormals(); ge.applyMatrix4(o.matrixWorld); (parts[k] = parts[k] || []).push(ge.index ? ge : ge); if (k === 'body' && !carMats.body) carMats.body = o.material;  });
        { const cab = new THREE.CylinderGeometry(.62, .78, .5, 4, 1); cab.rotateY(Math.PI / 4); cab.scale(1.25, 1, 1.35); cab.deleteAttribute('uv'); cab.translate(0, .86, -.2); (parts.glass = parts.glass || []).push(cab.toNonIndexed()); } // l'habitacle fermé, en vitres teintées
        const out = new THREE.Group();
        for (const k in parts) { const list = parts[k].map(x => x.index ? x : x), merged = LIB.BGU.mergeGeometries(list.some(x => !x.index) ? list.map(x => x.index ? x.toNonIndexed() : x) : list); if (!merged) continue; const m = new THREE.Mesh(merged, carMats[k] || carMats.dark); m.castShadow = SH; if (k === 'body') m.userData.body = true; out.add(m); }
        return out;
      };
      sky.mapping = THREE.EquirectangularReflectionMapping;
      gr.wrapS = gr.wrapT = THREE.RepeatWrapping; gr.colorSpace = THREE.SRGBColorSpace; gr.anisotropy = R.capabilities.getMaxAnisotropy();
      ASSET = { men, women, carHi: car(carHi), carLo: car(carLo), sky, skyEnv: pmremOf(sky), grass: gr };
      return ASSET;
    });
    // si c'est trop long (mauvaise connexion), on démarre avec les formes simples
    return Promise.race([all, new Promise(r => setTimeout(() => r(null), 20000))]).catch(e => { console.warn('ville 3D : modèles', e); return null; });
  }
  // 🧍 les vrais personnages et leurs animations (aussi utilisés par le Laser Game)
  let PEOPLE = null;
  function peopleFrom(am, af, ppl) {
    const clip = (g, n) => g.animations.find(a => a.name === n);
    const inPlace = c => { const k = c.clone(); k.tracks = k.tracks.filter(t => !t.name.endsWith('.position')); return k; };
    // les os des animations (Mixamo) → les os des personnages (squelette « Bip01 »)
    const MAP = { Pelvis: 'Hips', Spine: 'Spine', Spine1: 'Spine1', Spine2: 'Spine2', Neck: 'Neck', Head: 'Head' };
    for (const [b, m] of [['L', 'Left'], ['R', 'Right']]) Object.assign(MAP, { [b + '_Clavicle']: m + 'Shoulder', [b + '_UpperArm']: m + 'Arm', [b + '_Forearm']: m + 'ForeArm', [b + '_Hand']: m + 'Hand', [b + '_Thigh']: m + 'UpLeg', [b + '_Calf']: m + 'Leg', [b + '_Foot']: m + 'Foot', [b + '_Toe0']: m + 'ToeBase' });
    const CHILD = {}; for (const b of ['L', 'R']) Object.assign(CHILD, { [b + '_Clavicle']: b + '_UpperArm', [b + '_UpperArm']: b + '_Forearm', [b + '_Forearm']: b + '_Hand', [b + '_Thigh']: b + '_Calf', [b + '_Calf']: b + '_Foot' });
    const nodes = (sc, f) => { const o = {}; sc.traverse(n => { const k = f(n.name); if (k) o[k] = n; }); return o; };
    const srcKey = n => (n.match(/^mixamorig:?(.+)$/) || [])[1], dstKey = n => (n.match(/^Bip01[_ ](.+)$/) || [])[1];
    const wq = o => o.getWorldQuaternion(new THREE.Quaternion()), wp = o => o.getWorldPosition(new THREE.Vector3());
    const yawOf = (L, Rr) => { const f = new THREE.Vector3(0, 1, 0).cross(wp(Rr).sub(wp(L))); return Math.atan2(f.x, f.z); }; // vers où regarde le personnage
    // on recopie chaque mouvement « dans l'espace » : la même rotation dans le monde, depuis la même pose en T
    const retarget = (c, src, tpose, dst) => {
      const sb = nodes(src, srcKey), db = nodes(dst, dstKey), order = []; dst.traverse(n => { const k = dstKey(n.name); if (k && n.isBone) order.push(k); });
      const mixer = new THREE.AnimationMixer(src), tp = tpose ? mixer.clipAction(tpose) : null; if (tp) { tp.play(); mixer.setTime(0); }
      src.updateMatrixWorld(true); dst.updateMatrixWorld(true);
      const F = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawOf(db.L_Thigh, db.R_Thigh) - yawOf(sb.LeftUpLeg, sb.RightUpLeg)), Fi = F.clone().invert();
      // le personnage n'a pas les bras en T au repos : on aligne chaque os des bras et des jambes sur la pose en T de l'animation
      const saveD = order.map(k => [db[k], db[k].quaternion.clone()]);
      for (const k of order) { const ch = CHILD[k]; if (!ch || !db[ch] || !sb[MAP[k]] || !sb[MAP[ch]]) continue;
        const sDir = wp(sb[MAP[ch]]).sub(wp(sb[MAP[k]])).normalize().applyQuaternion(F), tDir = wp(db[ch]).sub(wp(db[k])).normalize();
        const w = new THREE.Quaternion().setFromUnitVectors(tDir, sDir).multiply(wq(db[k])); db[k].quaternion.copy(wq(db[k].parent).invert().multiply(w)); dst.updateMatrixWorld(true); }
      const sRest = {}, dRest = {}, pRest = {}; for (const k of order) { dRest[k] = wq(db[k]); pRest[k] = wq(db[k].parent); const s0 = sb[MAP[k]]; if (s0) sRest[k] = wq(s0); } // la pose en T, prise pendant qu'elle est jouée
      if (tp) tp.stop();
      mixer.clipAction(c).play();
      const fps = 30, n = Math.ceil(c.duration * fps) + 1, times = new Float32Array(n), vals = {}; for (const k of order) vals[k] = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        times[i] = Math.min(c.duration, i / fps); mixer.setTime(times[i]); src.updateMatrixWorld(true); const W = {};
        for (const k of order) {
          const d = db[k], pk = dstKey(d.parent.name), pW = pk && W[pk] ? W[pk] : pRest[k], s0 = sb[MAP[k]];
          const w = s0 && sRest[k] ? F.clone().multiply(wq(s0).multiply(sRest[k].clone().invert())).multiply(Fi).multiply(dRest[k]) : pW.clone().multiply(d.quaternion);
          W[k] = w; pW.clone().invert().multiply(w).toArray(vals[k], i * 4);
        }
      }
      mixer.stopAllAction(); mixer.uncacheRoot(src); for (const [o, q] of saveD) o.quaternion.copy(q); dst.updateMatrixWorld(true);
      return new THREE.AnimationClip(c.name, c.duration, order.map(k => new THREE.QuaternionKeyframeTrack(db[k].name + '.quaternion', times, vals[k])));
    };
    const A0 = { idle: [am, 'Idle'], walk: [am, 'Walk'], run: [am, 'Run'], dance: [af, 'SambaDance'] };
    const prep = g => {
      g.scene.traverse(o => { if (o.isMesh) { o.castShadow = SH; o.frustumCulled = false; if (o.material.map) o.material.map.anisotropy = 4; } });
      g.scene.updateMatrixWorld(true); const b = nodes(g.scene, dstKey), hy = b.Head ? wp(b.Head).y - Math.min(wp(b.L_Foot).y, wp(b.R_Foot).y) + 4e-9 : 0;
      const clips = {}; for (const k in A0) { const [src, nm] = A0[k]; clips[k] = retarget(inPlace(clip(src, nm)), src.scene, clip(src, 'TPose'), g.scene); }
      return { scene: g.scene, k: hy > 0 ? 39 / hy : 1, turn: -yawOf(b.L_Thigh, b.R_Thigh), clips, foot: b.L_Foot ? Math.min(wp(b.L_Foot).y, wp(b.R_Foot).y) : 0 };
    };
    const people3d = ppl.map(prep);
    return { men: people3d.slice(0, 2), women: people3d.slice(2) };
  }
  const pmremOf = t => { const g = new THREE.PMREMGenerator(R); const rt = g.fromEquirectangular(t); g.dispose(); return rt.texture; };
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
    if (!LIB) return;
    const root = window.Island.root(); if (!root) return;
    A = window.Island.api3d();
    if (!canvas) {
      canvas = el('canvas', { class: 'isl-3d' }); root.insertBefore(canvas, root.querySelector('canvas').nextSibling);
      R = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      R.setPixelRatio(Math.min(devicePixelRatio || 1, mobile() ? 1.5 : 1.75));
      R.outputColorSpace = THREE.SRGBColorSpace;
      R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; // la lumière d'un appareil photo
      if (SH) { R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; }
      camera = new THREE.PerspectiveCamera(60, 1, 2, 14000);
      addEventListener('resize', fit);
      let drag = null; // regarder autour : on fait glisser le doigt ou la souris
      canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture?.(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!drag) return; yaw -= (e.clientX - drag.x) * .006; pitch = Math.max(-.7, Math.min(.5, pitch - (e.clientY - drag.y) * .004)); drag = { x: e.clientX, y: e.clientY }; });
      const end = () => { drag = null; }; canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      buildPad(root);
      carBtn = el('button', { class: 'btn car3d', onclick: () => toggleCar() }, '🚗 Conduire'); root.append(carBtn);
    }
    if (!built) { if (!ASSET) { toast('🏙️ Chargement de la ville 3D…'); loadAssets().then(() => start()); return; } build(); }
    canvas.classList.remove('hidden'); pad.classList.remove('hidden'); carBtn.classList.remove('hidden'); root.classList.add('view3d');
    const m = A.players.get(A.me); if (m) pos = { x: m.x, y: m.y };
    fit(); window.Island.set3d({ step });
  }
  function stop() {
    window.Island?.set3d?.(null);
    canvas?.classList.add('hidden'); pad?.classList.add('hidden'); carBtn?.classList.add('hidden'); window.Island?.root?.()?.classList.remove('view3d');
    if (driving) toggleCar();
  }
  function fit() { if (!canvas || !R) return; const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; R.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 72 : 58; camera.updateProjectionMatrix(); }
  const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = R.capabilities.getMaxAnisotropy(); return t; };
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const noise = (g, w, h, n, a, s = 2) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '0,0,0'},${rnd() * a})`; g.fillRect(rnd() * w, rnd() * h, s, s); } };
  const STD = (o) => new THREE.MeshStandardMaterial(o);

  // 🌆 la suite de la ville tout autour : sol, rues qui continuent, quartiers d'immeubles, puis les gratte-ciel au loin.
  // Les immeubles lointains sont regroupés par style en un seul objet chacun (8 en tout) : c'est très léger, même sur téléphone.
  function outerCity() {
    const SP = 800, X = [...A.STREETS_X], Y = [...A.STREETS_Y];
    for (let k = 1; k <= 3; k++) { X.unshift(A.STREETS_X[0] - k * SP); X.push(A.STREETS_X[A.STREETS_X.length - 1] + k * SP); Y.unshift(A.STREETS_Y[0] - k * SP); Y.push(A.STREETS_Y[A.STREETS_Y.length - 1] + k * SP); }
    const gx0 = X[0] - SP, gx1 = X[X.length - 1] + SP, gz0 = Y[0] - SP, gz1 = Y[Y.length - 1] + SP, G = -1;
    // le sol : des dalles de trottoir partout
    const pt = paverTex(); pt.repeat.set(60000 / 90, 60000 / 90);
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), STD({ map: pt, color: 0xb9b9b9, roughness: .95 })); gm.rotation.x = -Math.PI / 2; gm.position.set(A.W / 2, G, A.H / 2); gm.receiveShadow = SH; scene.add(gm);
    // les rues qui continuent, avec leurs pointillés
    const road = horiz => { const [c, g] = cnv(horiz ? 512 : 128, horiz ? 128 : 512); g.fillStyle = '#35373b'; g.fillRect(0, 0, c.width, c.height); for (let i = 0; i < 9000; i++) { const v = 35 + rnd() * 60 | 0; g.fillStyle = `rgba(${v},${v},${v + 3},.6)`; g.fillRect(rnd() * c.width, rnd() * c.height, 2, 2); } g.fillStyle = 'rgba(235,235,230,.9)'; if (horiz) { g.fillRect(0, 62, 260, 4); g.fillRect(0, 6, 512, 3); g.fillRect(0, 119, 512, 3); } else { g.fillRect(62, 0, 4, 260); g.fillRect(6, 0, 3, 512); g.fillRect(119, 0, 3, 512); } const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
    const rh = road(true), rv = road(false);
    for (const x of X) { const L = gz1 - gz0, t = rv.clone(); t.needsUpdate = true; t.repeat.set(1, L / 420); const m = new THREE.Mesh(new THREE.PlaneGeometry(RW, L), STD({ map: t, roughness: .9 })); m.rotation.x = -Math.PI / 2; m.position.set(x, G + .25, (gz0 + gz1) / 2); m.receiveShadow = SH; scene.add(m); }
    for (const z of Y) { const L = gx1 - gx0, t = rh.clone(); t.needsUpdate = true; t.repeat.set(L / 420, 1); const m = new THREE.Mesh(new THREE.PlaneGeometry(L, RW), STD({ map: t, roughness: .9 })); m.rotation.x = -Math.PI / 2; m.position.set((gx0 + gx1) / 2, G + .3, z); m.receiveShadow = SH; scene.add(m); }
    // les immeubles, rangés par style
    const parts = STYLES.map(() => []);
    const box = (cx, cz, w, h, d, si, y0 = G) => {
      const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, fl = h / FLOOR;
      for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; if (f === 2 || f === 3) uv.setXY(i, .04, .5); else uv.setXY(i, uv.getX(i) * Math.max(1, Math.round((f < 2 ? d : w) / 64)), uv.getY(i) * fl / 2); }
      g.translate(cx, y0 + h / 2, cz); parts[si].push(g);
    };
    const city = { x0: -30, x1: A.W + 30, z0: -30, z1: A.H + 30 };
    const near = mobile() ? .75 : 1;
    for (let a = 0; a < X.length - 1; a++) for (let b = 0; b < Y.length - 1; b++) {
      let x0 = X[a] + 80, x1 = X[a + 1] - 80, z0 = Y[b] + 80, z1 = Y[b + 1] - 80;
      const inX = x0 < city.x1 && x1 > city.x0, inZ = z0 < city.z1 && z1 > city.z0;
      if (inX && inZ) { // le pâté de maisons touche la Ville : on ne garde que la partie dehors
        const opts = [[x0, Math.min(x1, city.x0), z0, z1], [Math.max(x0, city.x1), x1, z0, z1], [x0, x1, z0, Math.min(z1, city.z0)], [x0, x1, Math.max(z0, city.z1), z1]].filter(o => o[1] - o[0] > 120 && o[3] - o[2] > 120);
        if (!opts.length) continue; [x0, x1, z0, z1] = opts.sort((p, q) => (q[1] - q[0]) * (q[3] - q[2]) - (p[1] - p[0]) * (p[3] - p[2]))[0];
      }
      const w = x1 - x0, h = z1 - z0, n = Math.max(1, Math.round(w / 230)), m = Math.max(1, Math.round(h / 230));
      const dd = Math.max(0, city.x0 - x1, x0 - city.x1, city.z0 - z1, z0 - city.z1); // loin de la Ville = plus haut
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
        if (rnd() > near) continue;
        const lw = w / n, lh = h / m, bw = lw - 14 - rnd() * 30, bd = lh - 14 - rnd() * 30, cx = x0 + lw * (i + .5), cz = z0 + lh * (j + .5);
        const floors = Math.round(4 + rnd() * 7 + Math.min(26, dd / 90) * (.5 + rnd() * .7)), si = floors > 18 && rnd() < .5 ? 7 : Math.floor(rnd() * 7), H = floors * FLOOR;
        box(cx, cz, bw, H, bd, si);
        if (floors > 12 && rnd() < .45) { const f2 = Math.round(floors * (.25 + rnd() * .3)); box(cx, cz, bw * .7, f2 * FLOOR, bd * .7, si, G + H); }
      }
    }
    // tout au loin : les gratte-ciel de l'horizon
    for (let i = 0; i < (mobile() ? 70 : 120); i++) {
      const a = rnd() * Math.PI * 2, r = 1 + rnd() * .5, x = A.W / 2 + Math.cos(a) * (gx1 - gx0) / 2 * r, z = A.H / 2 + Math.sin(a) * (gz1 - gz0) / 2 * r, w = 160 + rnd() * 220;
      box(x, z, w, (20 + rnd() * 40) * FLOOR, w * (.7 + rnd() * .5), rnd() < .5 ? 7 : Math.floor(rnd() * 7));
    }
    parts.forEach((list, si) => { if (!list.length) return; const geo = LIB.BGU.mergeGeometries(list); list.forEach(g => g.dispose()); const mesh = new THREE.Mesh(geo, material(si, 1, 1)); mesh.castShadow = mesh.receiveShadow = SH; scene.add(mesh); });
  }
  // de vraies matières qui se répètent : l'asphalte (avec ses petits graviers) et les dalles du trottoir
  function asphaltTex() {
    const [c, g] = cnv(512, 512); g.fillStyle = '#35373b'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 26000; i++) { const v = 30 + rnd() * 70 | 0; g.fillStyle = `rgba(${v},${v},${v + 3},${.35 + rnd() * .5})`; g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 2, 1 + rnd() * 2); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * .08})`; g.beginPath(); g.arc(rnd() * 512, rnd() * 512, 20 + rnd() * 70, 0, 7); g.fill(); }
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function paverTex() {
    const [c, g] = cnv(256, 256); g.fillStyle = '#8f8c86'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = 160 + rnd() * 30 | 0; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); noise(g, 0, 0, 0, 0); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '0,0,0'},${rnd() * .12})`; g.fillRect(x * 64 + 2 + rnd() * 58, y * 64 + 2 + rnd() * 58, 2, 2); } }
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  // ---------- 🛣️ le sol : herbe, asphalte, passages piétons, la grande place et le lac ----------
  const RW = 92, SW = 28;
  function makeGround() {
    const k = mobile() ? .4 : .6, [c, g] = cnv(Math.round(A.W * k), Math.round(A.H * k)); g.scale(k, k);
    // de l'herbe avec des nuances
    if (!ASSET) { g.fillStyle = '#56763f'; g.fillRect(0, 0, A.W, A.H); noise(g, A.W, A.H, 60000, .12, 2); } // sinon : l'herbe en photo est dessous, le sol est transparent
    else for (let i = 0; i < 1400; i++) { const r = 30 + rnd() * 90; g.fillStyle = `rgba(${rnd() < .5 ? '40,30,10' : '170,190,90'},${rnd() * .1})`; g.beginPath(); g.arc(rnd() * A.W, rnd() * A.H, r, 0, 7); g.fill(); }
    // les trottoirs (en béton, posés plus haut en 3D) : sous les rues sur le sol pour les bords
    g.fillStyle = '#a4a29d';
    if (!ASSET) for (const y of A.STREETS_Y) g.fillRect(0, y - RW / 2 - SW, A.W, RW + SW * 2);
    if (!ASSET) for (const x of A.STREETS_X) g.fillRect(x - RW / 2 - SW, 0, RW + SW * 2, A.H);
    // l'asphalte, avec son grain et ses taches
    if (!ASSET) { g.fillStyle = '#2f3136';
    for (const y of A.STREETS_Y) g.fillRect(0, y - RW / 2, A.W, RW);
    for (const x of A.STREETS_X) g.fillRect(x - RW / 2, 0, RW, A.H); }
    for (const y of A.STREETS_Y) for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '0,0,0'},${rnd() * .07})`; g.fillRect(rnd() * A.W, y - RW / 2 + rnd() * RW, 3, 3); }
    for (const x of A.STREETS_X) for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '0,0,0'},${rnd() * .07})`; g.fillRect(x - RW / 2 + rnd() * RW, rnd() * A.H, 3, 3); }
    for (let i = 0; i < 160; i++) { const y = pick(A.STREETS_Y); g.fillStyle = 'rgba(0,0,0,.16)'; g.beginPath(); g.ellipse(rnd() * A.W, y + (rnd() - .5) * 60, 10 + rnd() * 26, 4 + rnd() * 8, 0, 0, 7); g.fill(); }
    // le marquage : pointillés blancs au milieu, lignes continues sur les bords
    g.strokeStyle = 'rgba(240,240,235,.92)'; g.lineWidth = 3; g.setLineDash([30, 26]);
    for (const y of A.STREETS_Y) { g.beginPath(); g.moveTo(0, y); g.lineTo(A.W, y); g.stroke(); }
    for (const x of A.STREETS_X) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, A.H); g.stroke(); }
    g.setLineDash([]); g.strokeStyle = 'rgba(240,240,235,.6)'; g.lineWidth = 2.5;
    for (const y of A.STREETS_Y) for (const d of [-RW / 2 + 6, RW / 2 - 6]) { g.beginPath(); g.moveTo(0, y + d); g.lineTo(A.W, y + d); g.stroke(); }
    for (const x of A.STREETS_X) for (const d of [-RW / 2 + 6, RW / 2 - 6]) { g.beginPath(); g.moveTo(x + d, 0); g.lineTo(x + d, A.H); g.stroke(); }
    for (const x of A.STREETS_X) for (const y of A.STREETS_Y) {
      if (!ASSET) { g.fillStyle = '#2f3136'; g.fillRect(x - RW / 2, y - RW / 2, RW, RW); } else g.clearRect(x - RW / 2, y - RW / 2, RW, RW);
      g.fillStyle = 'rgba(240,240,235,.9)';
      for (let i = -RW / 2 + 8; i < RW / 2 - 8; i += 13) { g.fillRect(x + i, y - RW / 2 - 24, 7, 20); g.fillRect(x + i, y + RW / 2 + 4, 7, 20); g.fillRect(x - RW / 2 - 24, y + i, 20, 7); g.fillRect(x + RW / 2 + 4, y + i, 20, 7); }
    }
    // l'ombre douce au pied des immeubles et sous les arbres
    g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 40;
    for (const w of walls) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(w.x0 + 4, w.z0 + 4, w.x1 - w.x0 - 8, w.z1 - w.z0 - 8); }
    g.shadowBlur = 22; for (const t of trees) { g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.arc(t.x, t.y, 20 * t.s, 0, 7); g.fill(); }
    g.restore();
    // la grande place pavée et le lac
    const P = A.PLAZA; g.fillStyle = '#c9bca3'; g.beginPath(); g.arc(P.x, P.y, P.r + 40, 0, 7); g.fill();
    g.strokeStyle = 'rgba(90,75,55,.28)'; g.lineWidth = 1.5; for (let r = 14; r < P.r + 40; r += 14) { g.beginPath(); g.arc(P.x, P.y, r, 0, 7); g.stroke(); }
    for (let a = 0; a < 6.28; a += .08) { g.beginPath(); g.moveTo(P.x, P.y); g.lineTo(P.x + Math.cos(a) * (P.r + 40), P.y + Math.sin(a) * (P.r + 40)); g.stroke(); }
    const L = A.LAKE; g.fillStyle = '#bfae86'; g.beginPath(); g.ellipse(L.x, L.y, L.rx + 20, L.ry + 16, 0, 0, 7); g.fill();
    const gr = g.createRadialGradient(L.x, L.y, 10, L.x, L.y, L.rx); gr.addColorStop(0, '#1a5f8f'); gr.addColorStop(1, '#2f86b8'); g.fillStyle = gr; g.beginPath(); g.ellipse(L.x, L.y, L.rx, L.ry, 0, 0, 7); g.fill();
    return c;
  }
  // ---------- 🏢 les façades réalistes : la couleur, et une deuxième image pour les fenêtres qui s'allument la nuit ----------
  const STYLES = [
    { wall: '#d8d2c6', glass: ['#9db8cf', '#3f5a75'], frame: '#f2efe8', kind: 'pierre' },
    { wall: '#9c4a2c', glass: ['#a7c2d6', '#465f78'], frame: '#e9e2d8', kind: 'brique' },
    { wall: '#e6e0d3', glass: ['#8fb0cc', '#36506b'], frame: '#ffffff', kind: 'pierre' },
    { wall: '#6f7a86', glass: ['#b5d2ea', '#4b6a88'], frame: '#3b434d', kind: 'beton' },
    { wall: '#c5ab84', glass: ['#97b4cf', '#3e5874'], frame: '#efe6d3', kind: 'pierre' },
    { wall: '#7f3a26', glass: ['#9fbbd2', '#3d5670'], frame: '#d9d0c4', kind: 'brique' },
    { wall: '#ece7de', glass: ['#a9c5dd', '#4a6784'], frame: '#c9c2b6', kind: 'beton' },
    { wall: '#2e3a48', glass: ['#7fb2dc', '#1c2f45'], frame: '#1b232d', kind: 'verre' },
  ];
  const facadeCache = new Map();
  function facadeTex(si) {
    if (facadeCache.has(si)) return facadeCache.get(si);
    const S = STYLES[si % STYLES.length], q = mobile() ? 1 : 2, [c, g] = cnv(256 * q, 256 * q), [e, ge] = cnv(256 * q, 256 * q); g.scale(q, q); ge.scale(q, q);
    ge.fillStyle = '#000'; ge.fillRect(0, 0, 256, 256);
    g.fillStyle = S.wall; g.fillRect(0, 0, 256, 256);
    if (S.kind === 'brique') { for (let y = 0; y < 256; y += 8) for (let x = (y / 8) % 2 ? -10 : 0; x < 256; x += 20) { g.fillStyle = `rgba(${rnd() < .5 ? '255,220,200' : '40,10,0'},${rnd() * .14})`; g.fillRect(x + 1, y + 1, 18, 6); } g.strokeStyle = 'rgba(230,220,210,.18)'; g.lineWidth = 1; for (let y = 0; y < 256; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); } }
    else noise(g, 256, 256, 3500, S.kind === 'verre' ? .04 : .09, 2);
    // le bandeau entre les étages
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 124, 256, 6); g.fillRect(0, 252, 256, 4); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 122, 256, 2);
    // 2 étages × 2 fenêtres par image, avec encadrement, rebord, reflet du ciel, rideaux parfois
    for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) {
      const x = k * 128 + 22, y = r * 128 + 18, w = 84, h = S.kind === 'verre' ? 98 : 84;
      if (S.kind !== 'verre') { g.fillStyle = S.frame; g.fillRect(x - 6, y - 6, w + 12, h + 12); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 8, y + h + 6, w + 16, 6); }
      const gl = g.createLinearGradient(x, y, x + w * .6, y + h); gl.addColorStop(0, S.glass[0]); gl.addColorStop(.55, S.glass[1]); gl.addColorStop(1, '#1b2633'); g.fillStyle = gl; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * .45, y); g.lineTo(x, y + h * .6); g.closePath(); g.fill(); // reflet
      g.fillStyle = S.kind === 'verre' ? 'rgba(20,30,40,.7)' : S.frame; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h * .42, w, 3);
      if (rnd() < .3 && S.kind !== 'verre') { g.fillStyle = pick(['rgba(230,215,180,.85)', 'rgba(200,90,80,.7)', 'rgba(240,240,240,.8)']); g.fillRect(x + 2, y + 2, w * .3, h - 4); }
      // la nuit : certaines fenêtres sont allumées (chaudes), d'autres non
      if (rnd() < .65) { const wg = ge.createLinearGradient(x, y, x, y + h); wg.addColorStop(0, '#ffd890'); wg.addColorStop(1, '#ffb45a'); ge.fillStyle = wg; ge.fillRect(x, y, w, h); ge.fillStyle = '#000'; ge.fillRect(x + w / 2 - 2, y, 4, h); }
    }
    const t = tex(c), te = tex(e); for (const x of [t, te]) { x.wrapS = x.wrapT = THREE.RepeatWrapping; }
    const out = { map: t, emissive: te, S }; facadeCache.set(si, out); return out;
  }
  function material(si, rx, ry) {
    const F = facadeTex(si), map = F.map.clone(), em = F.emissive.clone(); map.needsUpdate = em.needsUpdate = true; map.repeat.set(rx, ry); em.repeat.set(rx, ry);
    const glass = F.S.kind === 'verre';
    const m = STD({ map, emissiveMap: em, emissive: new THREE.Color('#ffcf8a'), emissiveIntensity: 0, roughness: glass ? .18 : .86, metalness: glass ? .55 : .02, envMapIntensity: glass ? 1.4 : .5 });
    glowMats.push(m); return m;
  }
  // une vitrine au rez-de-chaussée, avec l'enseigne lumineuse
  function storefront(name, icon, col) {
    const [c, g] = cnv(512, 256), [e, ge] = cnv(512, 256);
    ge.fillStyle = '#000'; ge.fillRect(0, 0, 512, 256);
    g.fillStyle = '#26272c'; g.fillRect(0, 0, 512, 256); noise(g, 512, 256, 2000, .08);
    g.fillStyle = '#121318'; rr(g, 18, 10, 476, 74, 12); g.fill();
    g.font = '900 48px Outfit, Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const G of [g, ge]) { G.font = g.font; G.textAlign = 'center'; G.textBaseline = 'middle'; G.shadowColor = col; G.shadowBlur = 16; G.fillStyle = col; G.fillText(`${icon} ${name}`, 256, 48, 450); G.shadowBlur = 0; }
    for (const x of [22, 302]) { const gl = g.createLinearGradient(x, 100, x + 190, 252); gl.addColorStop(0, '#d6ecff'); gl.addColorStop(.6, '#5e86a8'); gl.addColorStop(1, '#2a3e52'); g.fillStyle = gl; g.fillRect(x, 100, 188, 152); g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(x, 100); g.lineTo(x + 90, 100); g.lineTo(x, 200); g.fill(); g.fillStyle = '#a7a9ae'; g.fillRect(x - 4, 96, 196, 6); ge.fillStyle = 'rgba(255,220,160,.55)'; ge.fillRect(x, 100, 188, 152); }
    g.fillStyle = '#3d2a1a'; g.fillRect(222, 116, 68, 140); g.fillStyle = 'rgba(180,220,255,.5)'; g.fillRect(230, 124, 52, 70); g.fillStyle = '#d4af37'; g.fillRect(276, 190, 6, 14);
    const t = tex(c), te = tex(e);
    const m = STD({ map: t, emissiveMap: te, emissive: new THREE.Color('#ffffff'), emissiveIntensity: .6, roughness: .5, metalness: .1 }); glowMats.push(m); m.userData.sign = true; return m;
  }
  function signMat(text, col) {
    const [c, g] = cnv(512, 128); g.fillStyle = 'rgba(12,10,20,.92)'; rr(g, 6, 6, 500, 116, 18); g.fill(); g.strokeStyle = col; g.lineWidth = 5; g.stroke();
    g.font = '900 54px Outfit, Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = 18; g.fillStyle = col; g.fillText(text, 256, 66, 470);
    const t = tex(c); return new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false });
  }
  // un immeuble : parfois en plusieurs blocs (les étages du haut sont plus petits), avec un toit et des choses dessus
  function building(x, z, w, d, floors, si, opt = {}) {
    if (!opt.far) walls.push({ x0: x - w / 2 - 6, x1: x + w / 2 + 6, z0: z - d / 2 - 6, z1: z + d / 2 + 6 });
    const parts = !opt.simple && floors > 6 && rnd() < .55 ? 2 : 1; let base = opt.shop ? 70 : 0, top = 0, cw = w, cd = d, fl = floors;
    const roofM = STD({ color: new THREE.Color(STYLES[si % STYLES.length].wall).multiplyScalar(.55), roughness: .95 });
    for (let p = 0; p < parts; p++) {
      const f = p === 0 ? Math.ceil(fl * (parts > 1 ? .62 : 1)) : fl - Math.ceil(fl * .62), h = f * FLOOR;
      const mW = material(si, Math.max(1, Math.round(cw / 64)), f / 2), mD = material(si, Math.max(1, Math.round(cd / 64)), f / 2);
      const m = new THREE.Mesh(new THREE.BoxGeometry(cw, h, cd), [mD, mD, roofM, roofM, mW, mW]);
      m.position.set(x, base + h / 2, z); m.castShadow = m.receiveShadow = SH; scene.add(m); solids.push(m);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(cw + 4, 4, cd + 4), roofM); lip.position.set(x, base + h + 2, z); scene.add(lip);
      top = base + h; base = top; cw *= .72; cd *= .72;
    }
    // sur le toit : clim, château d'eau ou antenne
    const r = rnd(), metal = STD({ color: 0x8d939c, metalness: .6, roughness: .45 });
    if (r < .35) { const ac = new THREE.Mesh(new THREE.BoxGeometry(w * .22, 12, d * .22), metal); ac.position.set(x + w * .18, top + 8, z - d * .12); ac.castShadow = SH; scene.add(ac); }
    else if (r < .5 && floors > 4) { const wt = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 18, 12), STD({ color: 0x6b4a2f, roughness: .9 })); wt.position.set(x - w * .15, top + 22, z); scene.add(wt); const legs = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 12, 6), metal); legs.position.set(x - w * .15, top + 7, z); scene.add(legs); }
    else if (r < .62 && floors > 10) { const an = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.5, 60, 6), metal); an.position.set(x, top + 30, z); scene.add(an); }
    return { h: top };
  }
  // ---------- on construit toute la ville ----------
  let dome = null, hemi = null, sun = null, skyMat = null, skyGeo = null, sunDisc = null, clouds = [];
  function build() {
    built = true;
    scene = new THREE.Scene();
    hemi = new THREE.HemisphereLight(0xcfe6ff, 0x55623e, .6); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xfff0d6, 2.6); sun.position.set(-700, 1100, 800);
    if (SH) { const ms = mobile() ? 1024 : 2048, e = mobile() ? 520 : 800; sun.castShadow = true; sun.shadow.mapSize.set(ms, ms); Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 10, far: 4000 }); sun.shadow.bias = -.0005; sun.shadow.normalBias = 1.5; }
    scene.add(sun); scene.add(sun.target);
    // le ciel (dégradé), le soleil et les nuages
    skyGeo = new THREE.SphereGeometry(11000, 32, 16); const cols = []; for (let i = 0; i < skyGeo.attributes.position.count; i++) cols.push(1, 1, 1);
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false });
    dome = new THREE.Mesh(skyGeo, skyMat); dome.position.set(A.W / 2, 0, A.H / 2); dome.renderOrder = -2; scene.add(dome);
    const [sc, sg] = cnv(128, 128); const sgr = sg.createRadialGradient(64, 64, 4, 64, 64, 64); sgr.addColorStop(0, 'rgba(255,255,240,1)'); sgr.addColorStop(.2, 'rgba(255,245,210,.9)'); sgr.addColorStop(1, 'rgba(255,230,180,0)'); sg.fillStyle = sgr; sg.fillRect(0, 0, 128, 128);
    sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(sc), transparent: true, fog: false, depthWrite: false, toneMapped: false })); sunDisc.scale.set(1400, 1400, 1); scene.add(sunDisc);
    const [cc, cg] = cnv(256, 128); for (let i = 0; i < 24; i++) { const x = 40 + rnd() * 176, y = 50 + rnd() * 40, r = 18 + rnd() * 30, grd = cg.createRadialGradient(x, y, 2, x, y, r); grd.addColorStop(0, 'rgba(255,255,255,.95)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); cg.fillStyle = grd; cg.beginPath(); cg.arc(x, y, r, 0, 7); cg.fill(); }
    const ct = tex(cc);
    for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, fog: false, depthWrite: false, opacity: .85 })); const a = rnd() * 6.28, r = 3500 + rnd() * 4500; s.position.set(A.W / 2 + Math.cos(a) * r, 1700 + rnd() * 1500, A.H / 2 + Math.sin(a) * r); s.scale.set(2200 + rnd() * 2000, 900 + rnd() * 600, 1); scene.add(s); clouds.push(s); }
    // la mer
    outerCity(); // autour : la suite de la grande ville (plus de vide au bord)
    // les trottoirs en relief, avec leur bordure
    if (ASSET) { const at = asphaltTex(), mk = (rx, ry) => { const t = at.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return STD({ map: t, roughness: .92 }); }, mh = mk(A.W / 140, RW / 140), mv = mk(RW / 140, A.H / 140);
      for (const y of A.STREETS_Y) { const r = new THREE.Mesh(new THREE.PlaneGeometry(A.W, RW), mh); r.rotation.x = -Math.PI / 2; r.position.set(A.W / 2, -.1, y); r.receiveShadow = SH; scene.add(r); }
      for (const x of A.STREETS_X) { const r = new THREE.Mesh(new THREE.PlaneGeometry(RW, A.H), mv); r.rotation.x = -Math.PI / 2; r.position.set(x, -.15, A.H / 2); r.receiveShadow = SH; scene.add(r); } }
    const pv = ASSET ? paverTex() : null, pvM = (rx, ry) => { if (!pv) return STD({ color: 0xa8a8aa, roughness: .9 }); const t = pv.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return STD({ map: t, roughness: .9 }); };
    const walkH = pvM(A.W / 64, SW / 64), walkV = pvM(SW / 64, A.H / 64), curbM = STD({ color: 0xcfcfd2, roughness: .8 });
    const strip = (cx, cz, w, d) => { const s = new THREE.Mesh(new THREE.BoxGeometry(w, CURB, d), w > d ? walkH : walkV); s.position.set(cx, CURB / 2, cz); s.receiveShadow = SH; scene.add(s); };
    for (const y of A.STREETS_Y) for (const sd of [-1, 1]) strip(A.W / 2, y + sd * (RW / 2 + SW / 2), A.W, SW);
    for (const x of A.STREETS_X) for (const sd of [-1, 1]) strip(x + sd * (RW / 2 + SW / 2), A.H / 2, SW, A.H);
    for (const y of A.STREETS_Y) for (const sd of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(A.W, CURB + 1, 3), curbM); c.position.set(A.W / 2, (CURB + 1) / 2, y + sd * (RW / 2 + 1.5)); scene.add(c); }
    for (const x of A.STREETS_X) for (const sd of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(3, CURB + 1, A.H), curbM); c.position.set(x + sd * (RW / 2 + 1.5), (CURB + 1) / 2, A.H / 2); scene.add(c); }
    // 🏪 les boutiques : immeubles avec vitrine, auvent, enseigne, des deux côtés
    for (const o of A.shops) {
      const [name, icon, col] = A.SHOP_TYPES[o.k], floors = o.h > .5 ? 3 + Math.round(o.h * 5) : 2, sf = storefront(name, icon, col);
      building(o.x, o.y - 52, 124, 100, floors, o.k % STYLES.length, { shop: true, simple: true });
      const ground0 = new THREE.Mesh(new THREE.BoxGeometry(124, 70, 100), [STD({ color: 0x2a2b30 }), STD({ color: 0x2a2b30 }), STD({ color: 0x2a2b30 }), STD({ color: 0x2a2b30 }), sf, sf]); ground0.position.set(o.x, 35, o.y - 52); ground0.castShadow = SH; scene.add(ground0); solids.push(ground0);
      const awM = STD({ color: col, roughness: .7 });
      for (const [z, s] of [[o.y + 8, 1], [o.y - 112, -1]]) { const aw = new THREE.Mesh(new THREE.BoxGeometry(118, 3, 20), awM); aw.position.set(o.x, 64, z); aw.rotation.x = .3 * s; aw.castShadow = SH; scene.add(aw); }
    }
    // 🏙️ les tours (en verre)
    for (const tw of A.TOWERS) building(tw[0], tw[1] - 52, 120, 104, 10 + tw[3] * 3, 7);
    // 📍 les lieux : bâtiments avec leur enseigne néon
    for (const p of A.PLACES) {
      const col = p.c === 'rainbow' ? '#ff4fd8' : p.c === 'gold' ? '#ffd34d' : p.c, big = p.big || p.inst;
      const w = big ? 190 : 124, d = big ? 120 : 92, floors = big ? 3 : 2, z = p.y - 46 - d / 2; // le bâtiment est derrière le point d'entrée
      const b = building(p.x, z, w, d, floors, (p.label.length * 3) % 7, { simple: true });
      const sm = signMat(`${p.icon} ${p.label}`, col);
      for (const [zz, ry] of [[z + d / 2 + 2, 0], [z - d / 2 - 2, Math.PI]]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w + 10, 230), 36), sm); s.position.set(p.x, b.h + 24, zz); s.rotation.y = ry; scene.add(s); }
      const door = new THREE.Mesh(new THREE.BoxGeometry(44, 58, 4), STD({ color: new THREE.Color(col).multiplyScalar(.6), emissive: new THREE.Color(col), emissiveIntensity: .35, roughness: .4 })); door.position.set(p.x, 29, z + d / 2 + 1); scene.add(door);
    }
    // le sol (après les bâtiments, pour dessiner leur ombre douce à leurs pieds)
    trees.push(...A.palms.map(p => ({ x: p.x, y: p.y, s: (p.s || 1) * (.9 + rnd() * .45) })), ...streetTrees());
    if (ASSET) { const gt = ASSET.grass.clone(); gt.needsUpdate = true; gt.repeat.set(A.W / 260, A.H / 260); const gm = new THREE.Mesh(new THREE.PlaneGeometry(A.W, A.H), STD({ map: gt, color: 0xc4cfb0, roughness: 1 })); gm.rotation.x = -Math.PI / 2; gm.position.set(A.W / 2, -.3, A.H / 2); gm.receiveShadow = SH; scene.add(gm); }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(A.W, A.H), STD({ map: tex(makeGround()), roughness: .95, transparent: !!ASSET }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(A.W / 2, 0, A.H / 2); ground.receiveShadow = SH; scene.add(ground);
    // 🌳 les arbres : tronc + plusieurs boules de feuillage
    const N = trees.length;
    if (N) {
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(3, 5, 50, 7), STD({ color: 0x5a3d26, roughness: 1 }), N);
      if (ASSET) { realTrees(trunk); return finishTrees(); }
      const leafG = new THREE.IcosahedronGeometry(1, 2), leaf = new THREE.InstancedMesh(leafG, STD({ color: 0xffffff, roughness: .95 }), N * 5);
      const q = new THREE.Object3D(); let li = 0;
      trees.forEach((p, i) => {
        const s = p.s; q.position.set(p.x, 25 * s, p.y); q.scale.set(s, s, s); q.rotation.set(0, 0, 0); q.updateMatrix(); trunk.setMatrixAt(i, q.matrix);
        for (let k = 0; k < 5; k++) { const r = (13 + rnd() * 9) * s; q.position.set(p.x + (rnd() - .5) * 30 * s, (50 + k * 7 + rnd() * 10) * s, p.y + (rnd() - .5) * 30 * s); q.scale.set(r, r * .85, r); q.rotation.set(rnd(), rnd(), rnd()); q.updateMatrix(); leaf.setMatrixAt(li, q.matrix); leaf.setColorAt(li, new THREE.Color().setHSL(.22 + rnd() * .07, .32 + rnd() * .16, .18 + rnd() * .1)); li++; }
      });
      trunk.castShadow = leaf.castShadow = SH; scene.add(trunk, leaf);
    }
    finishTrees();
  }
  function finishTrees() {
    // 💡 les lampadaires (vrais poteaux courbés avec leur lampe)
    const NL = A.lamps.length;
    if (NL) {
      const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.4, 2.2, 84, 7), STD({ color: 0x2b2f36, metalness: .7, roughness: .4 }), NL);
      const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(22, 2, 2), STD({ color: 0x2b2f36, metalness: .7, roughness: .4 }), NL);
      lampMat = STD({ color: 0xfff4d6, emissive: 0xffe2a8, emissiveIntensity: 0, roughness: .3 });
      const head = new THREE.InstancedMesh(new THREE.BoxGeometry(12, 4, 7), lampMat, NL);
      const q = new THREE.Object3D();
      A.lamps.forEach((l, i) => { q.position.set(l.x, 42, l.y); q.rotation.set(0, 0, 0); q.updateMatrix(); pole.setMatrixAt(i, q.matrix); q.position.set(l.x + 9, 83, l.y); q.updateMatrix(); arm.setMatrixAt(i, q.matrix); q.position.set(l.x + 18, 81, l.y); q.updateMatrix(); head.setMatrixAt(i, q.matrix); });
      pole.castShadow = SH; scene.add(pole, arm, head);
    }
    // 🚦 les feux tricolores aux carrefours
    const tlM = STD({ color: 0x1d2026, metalness: .5, roughness: .5 }), lights = [];
    for (const x of A.STREETS_X) for (const y of A.STREETS_Y) for (const [dx, dy] of [[-1, -1], [1, 1]]) {
      const px = x + dx * (RW / 2 + 10), pz = y + dy * (RW / 2 + 10);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 64, 6), tlM); p.position.set(px, 32, pz); scene.add(p);
      const b = new THREE.Mesh(new THREE.BoxGeometry(8, 24, 8), tlM); b.position.set(px, 70, pz); scene.add(b);
      ['#ff3b30', '#ffcc00', '#34c759'].forEach((c, k) => { const l = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); l.position.set(px, 78 - k * 8, pz + 4.2 * -dy); scene.add(l); lights.push({ l, k, c }); });
    }
    traffic = lights;
    // 🚗 des voitures qui roulent, et d'autres garées le long des trottoirs
    const CC = [0xb3261e, 0x1f4f9c, 0xe8e8e8, 0x16171b, 0xc9a227, 0x2c6b3f, 0x8f949c, 0xd65f12, 0x5a2a6e, 0xf4f1ea];
    for (let i = 0; i < (ASSET ? (mobile() ? 14 : 26) : (mobile() ? 24 : 42)); i++) {
      const horiz = i % 2 === 0, lines = horiz ? A.STREETS_Y : A.STREETS_X, line = lines[Math.floor(i / 2) % lines.length], dir = (i >> 1) % 2 ? 1 : -1;
      const car = carMesh(CC[i % CC.length]); scene.add(car);
      cars.push({ car, horiz, line: line + dir * 22, dir, off: rnd() * (horiz ? A.W : A.H), sp: 110 + rnd() * 120 });
    }
    for (let i = 0; i < (ASSET ? 0 : mobile() ? 20 : 40); i++) {
      const horiz = rnd() < .6, line = horiz ? pick(A.STREETS_Y) : pick(A.STREETS_X), sd = rnd() < .5 ? -1 : 1, along = 120 + rnd() * ((horiz ? A.W : A.H) - 240);
      if ((horiz ? A.STREETS_X : A.STREETS_Y).some(v => Math.abs(v - along) < 110)) continue;
      const car = carMesh(pick(CC)); car.position.set(horiz ? along : line + sd * 38, 0, horiz ? line + sd * 38 : along); car.rotation.y = horiz ? (sd > 0 ? 0 : Math.PI) : (sd > 0 ? -Math.PI / 2 : Math.PI / 2); scene.add(car);
    }
    // l'éclairage du ciel pour les reflets
    pmrem = new THREE.PMREMGenerator(R);
    sky(true);
  }
  // des arbres alignés le long des trottoirs, comme dans une vraie avenue (pas aux carrefours ni devant les portes)
  const trees = [];
  function streetTrees() {
    const out = [], free = (x, y) => !walls.some(w => x > w.x0 - 8 && x < w.x1 + 8 && y > w.z0 - 8 && y < w.z1 + 8) && !A.PLACES.some(p => Math.hypot(p.x - x, p.y - y) < 70) && !A.lamps.some(l => Math.hypot(l.x - x, l.y - y) < 40);
    const lim = mobile() ? 140 : 260;
    for (const y of A.STREETS_Y) for (const sd of [-1, 1]) for (let x = 80; x < A.W - 80; x += 150) { const ty = y + sd * (RW / 2 + SW + 12); if (A.STREETS_X.some(v => Math.abs(v - x) < 110) || !free(x, ty) || !A.onLand(x, ty)) continue; out.push({ x, y: ty, s: .75 + rnd() * .3 }); }
    for (const x of A.STREETS_X) for (const sd of [-1, 1]) for (let y = 80; y < A.H - 80; y += 150) { const tx = x + sd * (RW / 2 + SW + 12); if (A.STREETS_Y.some(v => Math.abs(v - y) < 110) || !free(tx, y) || !A.onLand(tx, y)) continue; out.push({ x: tx, y, s: .75 + rnd() * .3 }); }
    return out.slice(0, lim);
  }
  function leafTex() {
    const [c, g] = cnv(256, 256), blobs = [];
    for (let i = 0; i < 16; i++) { const a = rnd() * 6.28, r = rnd() * 70; blobs.push([128 + Math.cos(a) * r, 118 + Math.sin(a) * r * .8, 34 + rnd() * 26]); }
    for (let i = 0; i < 5200; i++) {
      const [bx, by, br] = pick(blobs), a = rnd() * 6.28, d = Math.sqrt(rnd()) * br, x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d;
      const light = 1 - y / 256 * .9 + (rnd() - .5) * .3; // plus clair en haut (le soleil), plus sombre dessous
      g.fillStyle = `hsl(${88 + rnd() * 26},${30 + rnd() * 25}%,${Math.max(8, Math.min(48, 12 + light * 30))}%)`;
      g.save(); g.translate(x, y); g.rotate(rnd() * 6.28); g.beginPath(); g.ellipse(0, 0, 2.2 + rnd() * 2.6, 1.2 + rnd() * 1.4, 0, 0, 7); g.fill(); g.restore();
    }
    g.strokeStyle = 'rgba(70,48,30,.9)'; g.lineWidth = 3; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(128, 250); g.quadraticCurveTo(128 + (rnd() - .5) * 40, 190, 128 + (rnd() - .5) * 120, 120 + rnd() * 50); g.stroke(); }
    const t = tex(c); return t;
  }
  function realTrees(trunk) {
    const t = leafTex(), parts = [];
    for (let k = 0; k < 4; k++) { const pg = new THREE.PlaneGeometry(96, 96); pg.rotateY(k * Math.PI / 4); pg.translate(0, 76, 0); parts.push(pg); }
    const geo = LIB.BGU.mergeGeometries(parts), P = geo.attributes.position, Nn = geo.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) { v.set(P.getX(i), (P.getY(i) - 70) * 1.2, P.getZ(i)).normalize(); v.y = Math.max(v.y, -.2) + .9; v.normalize(); Nn.setXYZ(i, v.x, v.y, v.z); } // un feuillage « rond » pour la lumière
    const mat = STD({ map: t, alphaTest: .45, side: THREE.DoubleSide, roughness: .9 });
    const leaf = new THREE.InstancedMesh(geo, mat, trees.length); leaf.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: .45 });
    const q = new THREE.Object3D();
    trees.forEach((p, i) => { const s = p.s; q.position.set(p.x, 25 * s, p.y); q.rotation.set(0, 0, 0); q.scale.set(s, s * 1.1, s); q.updateMatrix(); trunk.setMatrixAt(i, q.matrix); q.position.set(p.x, 0, p.y); q.rotation.set(0, rnd() * 3.14, 0); q.scale.setScalar(s * (.9 + rnd() * .25)); q.updateMatrix(); leaf.setMatrixAt(i, q.matrix); leaf.setColorAt(i, new THREE.Color().setHSL(.25, .2, .75 + rnd() * .25)); });
    trunk.castShadow = leaf.castShadow = SH; scene.add(trunk, leaf);
  }
  let lampMat = null, traffic = [], pmrem = null, envRT = null;
  // une voiture aux formes arrondies : carrosserie, vitres teintées, jantes, phares
  function carMesh(color, hi) {
    if (ASSET) { // la vraie voiture, avec sa couleur
      const g = new THREE.Group(), m = (hi ? ASSET.carHi : ASSET.carLo).clone(true), paint = new THREE.Color(color);
      m.traverse(o => { if (o.isMesh && o.userData.body) { o.material = o.material.clone(); o.material.color = paint; o.material.metalness = .7; o.material.roughness = .22; } });
      m.scale.setScalar(19); m.rotation.y = -Math.PI / 2; g.add(m); return g; // l'avant de la voiture dans le sens où elle roule
    }
    const g = new THREE.Group();
    const paint = STD({ color, metalness: .55, roughness: .28, envMapIntensity: 1.2 }), glass = STD({ color: 0x0f1a24, metalness: .3, roughness: .05, envMapIntensity: 1.5 });
    const tire = STD({ color: 0x111214, roughness: .9 }), rim = STD({ color: 0xc8ccd2, metalness: .9, roughness: .25 });
    const prof = new THREE.Shape(); prof.moveTo(-38, 6); prof.lineTo(38, 6); prof.quadraticCurveTo(40, 6, 40, 12); prof.lineTo(39, 18); prof.quadraticCurveTo(36, 21, 26, 21); prof.lineTo(14, 22); prof.lineTo(4, 33); prof.lineTo(-18, 33); prof.lineTo(-27, 22); prof.lineTo(-36, 21); prof.quadraticCurveTo(-40, 20, -40, 14); prof.lineTo(-40, 10); prof.quadraticCurveTo(-40, 6, -38, 6);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(prof, { depth: 32, bevelEnabled: true, bevelThickness: 2.5, bevelSize: 2, bevelSegments: 2, curveSegments: 6 }), paint); body.position.z = -16; g.add(body);
    const win = new THREE.Shape(); win.moveTo(12, 23); win.lineTo(3, 32); win.lineTo(-17, 32); win.lineTo(-25, 23); win.closePath();
    const wm = new THREE.Mesh(new THREE.ExtrudeGeometry(win, { depth: 34.5, bevelEnabled: false }), glass); wm.position.z = -17.25; wm.scale.set(1, 1, 1); g.add(wm);
    for (const x of [-24, 24]) for (const z of [-17.5, 17.5]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 6, 16), tire); w.rotation.x = Math.PI / 2; w.position.set(x, 7.5, z); g.add(w); const r = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 6.4, 10), rim); r.rotation.x = Math.PI / 2; r.position.set(x, 7.5, z); g.add(r); }
    const head = new THREE.MeshBasicMaterial({ color: 0xfff7e0, toneMapped: false }), tail = new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false });
    for (const z of [-11, 11]) { const h = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.5, 7), head); h.position.set(41.5, 14, z); g.add(h); const t = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.5, 7), tail); t.position.set(-41.5, 15, z); g.add(t); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = SH; } });
    return g;
  }
  function sky(force) {
    const n = A.nightLevel(), bucket = Math.round(n * 10);
    if (!force && bucket === nightNow) return; nightNow = bucket;
    const top = new THREE.Color('#2f6fc0').lerp(new THREE.Color('#03071a'), n), mid = new THREE.Color('#8ec0ec').lerp(new THREE.Color('#0d1638'), n), hor = new THREE.Color('#e9f2fb').lerp(new THREE.Color('#2a2f55'), n);
    const p = skyGeo.attributes.position, c = skyGeo.attributes.color;
    for (let i = 0; i < p.count; i++) { const k = Math.max(0, p.getY(i) / 11000); const col = k < .25 ? hor.clone().lerp(mid, k / .25) : mid.clone().lerp(top, Math.min(1, (k - .25) / .75)); c.setXYZ(i, col.r, col.g, col.b); }
    c.needsUpdate = true;
    scene.fog = new THREE.Fog(hor.clone().lerp(mid, .35), 1600, 9000);
    hemi.intensity = .6 - n * .45; sun.intensity = 2.6 - n * 2.4; sun.color.set(n > .3 ? 0xaab8ff : 0xfff0d6);
    sunDisc.material.opacity = 1 - n; for (const cl of clouds) cl.material.opacity = .85 - n * .6;
    for (const m of glowMats) m.emissiveIntensity = m.userData.sign ? .6 + n * .8 : n * 1.6; // les fenêtres et les vitrines s'allument la nuit
    if (ASSET) { // le jour : un vrai ciel en photo (nuages, lumière), la nuit : le ciel étoilé sombre
      const day = n < .55; dome.visible = !day; sunDisc.visible = !day; for (const cl of clouds) cl.visible = !day;
      R.toneMappingExposure = day ? .82 : 1.05; hemi.intensity *= day ? .45 : 1; sun.intensity *= day ? .85 : 1;
      if (day) { scene.background = ASSET.sky; scene.backgroundIntensity = 1 - n * 1.2; scene.backgroundBlurriness = 0; scene.environment = ASSET.skyEnv; scene.fog.color.set('#c3ccd6').lerp(new THREE.Color('#2a2f55'), n); if (lampMat) lampMat.emissiveIntensity = .2 + n * 3; return; }
      scene.background = null;
    }
    if (lampMat) lampMat.emissiveIntensity = .2 + n * 3;
    // les reflets du ciel (sur les vitres, la peinture des voitures…)
    const env = new THREE.Scene(); const eg = new THREE.SphereGeometry(100, 24, 12), ec = [];
    for (let i = 0; i < eg.attributes.position.count; i++) { const k = Math.max(-1, eg.attributes.position.getY(i) / 100); const col = k < 0 ? new THREE.Color(0x3a3f45).lerp(hor, 1 + k) : hor.clone().lerp(top, k); ec.push(col.r, col.g, col.b); }
    eg.setAttribute('color', new THREE.Float32BufferAttribute(ec, 3)); env.add(new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const sunB = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .95, .85).multiplyScalar(n > .3 ? 2 : 30) })); sunB.position.set(-50, 70, 55); env.add(sunB);
    envRT?.dispose(); envRT = pmrem.fromScene(env, .02); scene.environment = envRT.texture;
    eg.dispose();
  }
  // ---------- 🧍 les personnages, aux formes arrondies ----------
  const SKIN = ['#f1c7a4', '#e0ac85', '#c68863', '#8d5a3b', '#5c3a24'], HAIR = ['#2a1a10', '#6b3f1f', '#d8a64a', '#151515', '#8a4a24', '#c43b2b'];
  // un personnage animé : src = un des modèles, k = sa taille
  function makeHuman(src, k = src.k) {
    const g = new THREE.Group(), m = LIB.SK.clone(src.scene);
    m.scale.multiplyScalar(k); m.rotation.y = src.turn; g.add(m);
    const mixer = new THREE.AnimationMixer(m), act = {};
    for (const n in src.clips) act[n] = mixer.clipAction(src.clips[n]);
    act.idle.play();
    return { g, mixer, act, cur: 'idle', model: m };
  }
  // pour les autres jeux 3D : three.js, ses outils, et les personnages
  async function kit() {
    if (!THREE) THREE = await loadThree();
    if (!PEOPLE) {
      const gl = new LIB.GLTFLoader(); gl.setMeshoptDecoder(LIB.Meshopt); const glb = f => gl.loadAsync('/city3d/' + f);
      const [am, af, ...ppl] = await Promise.all([glb('anim_m.glb'), glb('anim_f.glb'), ...MEN.map(n => glb(n + '.glb')), ...WOMEN.map(n => glb(n + '.glb'))]);
      if (!PEOPLE) PEOPLE = peopleFrom(am, af, ppl);
    }
    return { THREE, LIB, people: PEOPLE, makeHuman };
  }
  function human(p) {
    if (ASSET) {
      const L = p.gender === 'f' ? ASSET.women : ASSET.men, src = L[(p.id || 0) % L.length];
      return makeHuman(src);
    }
    const id = p.id || 0, g = new THREE.Group();
    const shirt = STD({ color: p.color || '#8b6cff', roughness: .8 }), pants = STD({ color: [0x2a3550, 0x3b3b40, 0x5a4632, 0x1d2430][id % 4], roughness: .85 }), skin = STD({ color: SKIN[id % SKIN.length], roughness: .7 }), hair = STD({ color: HAIR[id % HAIR.length], roughness: .9 }), shoe = STD({ color: 0x141414, roughness: .6 });
    const legL = new THREE.Group(), legR = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group();
    for (const [L, x] of [[legL, -4.5], [legR, 4.5]]) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(3.8, 22, 4, 8), pants); m.position.y = -14; L.add(m); const s = new THREE.Mesh(new THREE.CapsuleGeometry(3.4, 5, 4, 8), shoe); s.rotation.x = Math.PI / 2; s.position.set(0, -28, 2.5); L.add(s); L.position.set(x, 31, 0); g.add(L); }
    const hips = new THREE.Mesh(new THREE.CapsuleGeometry(7.5, 4, 4, 10), pants); hips.rotation.z = Math.PI / 2; hips.position.y = 32; g.add(hips);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(8.5, 12, 6, 12), shirt); torso.position.y = 45; torso.scale.set(1, 1, .7); g.add(torso);
    for (const [Ar, x] of [[armL, -11.5], [armR, 11.5]]) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(2.8, 18, 4, 8), shirt); m.position.y = -10; Ar.add(m); const h = new THREE.Mesh(new THREE.SphereGeometry(2.8, 8, 6), skin); h.position.y = -22; Ar.add(h); Ar.position.set(x, 55, 0); g.add(Ar); }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 4, 8), skin); neck.position.y = 58.5; g.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), skin); head.position.y = 66; head.scale.set(.92, 1.05, .95); g.add(head);
    const hr = new THREE.Mesh(new THREE.SphereGeometry(7.4, 16, 10, 0, Math.PI * 2, 0, Math.PI * .55), hair); hr.position.y = 67; hr.rotation.x = -.25; g.add(hr);
    if (p.gender === 'f') { const lh = new THREE.Mesh(new THREE.CapsuleGeometry(5.5, 10, 4, 8), hair); lh.position.set(0, 60, -4.5); lh.scale.set(1.1, 1, .6); g.add(lh); }
    for (const x of [-2.6, 2.6]) { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: 0x1a1a1a })); e.position.set(x, 67, 6.4); g.add(e); }
    g.traverse(o => { if (o.isMesh) o.castShadow = SH; }); g.scale.setScalar(HS);
    return { g, legL, legR, armL, armR };
  }
  function tag(p, o) {
    const said = p.said && Date.now() - (p.saidAt || 0) < 7000 ? p.said : '', key = (p.username || '') + '|' + said + '|' + (p.role || '') + (p.gender || '');
    if (o.tagKey === key) return; o.tagKey = key;
    const W = 512, H = 256, c = o.tagC || (o.tagC = document.createElement('canvas')); c.width = W; c.height = H; const g = c.getContext('2d');
    g.clearRect(0, 0, W, H); g.textAlign = 'center'; g.textBaseline = 'middle';
    const col = (p.role === 'admin' || p.role === 'superadmin') ? '#ff2d55' : p.gender === 'f' ? '#ff4fd8' : p.gender === 'h' ? '#2fa8ff' : '#c3b8ff';
    g.font = '800 40px Outfit, Inter, sans-serif'; const nm = p.username || '', tw = Math.min(W - 20, g.measureText(nm).width + 36);
    g.fillStyle = 'rgba(10,8,20,.6)'; rr(g, W / 2 - tw / 2, H - 62, tw, 54, 27); g.fill();
    g.fillStyle = col; g.fillText(nm, W / 2, H - 34, W - 40);
    if (said) {
      g.font = '700 32px Outfit, Inter, sans-serif'; const words = said.split(' '), lines = []; let line = '';
      for (const w of words) { const t2 = line ? line + ' ' + w : w; if (g.measureText(t2).width > W - 80 && line) { lines.push(line); line = w; } else line = t2; } if (line) lines.push(line);
      const L = lines.slice(0, 3), bw = Math.min(W - 16, Math.max(...L.map(l => g.measureText(l).width)) + 40), bh = L.length * 38 + 22, by = H - 78 - bh;
      g.fillStyle = 'rgba(255,255,255,.96)'; rr(g, W / 2 - bw / 2, by, bw, bh, 22); g.fill(); g.beginPath(); g.moveTo(W / 2 - 12, by + bh); g.lineTo(W / 2, by + bh + 14); g.lineTo(W / 2 + 12, by + bh); g.fill();
      g.fillStyle = '#1c1430'; L.forEach((l, i) => g.fillText(l, W / 2, by + 29 + i * 38));
    }
    if (!o.tag) { o.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false, toneMapped: false })); o.tag.scale.set(56, 28, 1); o.tag.renderOrder = 10; scene.add(o.tag); }
    else o.tag.material.map.needsUpdate = true;
  }
  function person(p, t, dt) {
    let o = people.get(p.id);
    if (!o) { const h = human(p); scene.add(h.g); o = { ...h, x: p.x, y: p.y, face: 0, walk: 0 }; people.set(p.id, o); }
    const mine = p.id === A.me, tx = mine ? pos.x : p.x, ty = mine ? pos.y : p.y;
    const nx = o.x + (tx - o.x) * .25, ny = o.y + (ty - o.y) * .25, dx = nx - o.x, dy = ny - o.y, sp = Math.hypot(dx, dy) / Math.max(dt, .001);
    if (Math.hypot(dx, dy) > .3) o.face = Math.atan2(dx, dy);
    o.x = nx; o.y = ny; o.g.position.set(o.x, onWalk(o.x, o.y) ? CURB : 0, o.y);
    o.g.rotation.y = mine ? Math.atan2(-Math.sin(yaw), -Math.cos(yaw)) : o.face;
    const moving = sp > 20 || (mine && Math.abs(speed) > 5), run = mine && Math.abs(speed) > 200;
    if (o.mixer) { // le vrai personnage : on passe en douceur d'une animation à l'autre
      const want = p.action === 'dance' ? 'dance' : moving ? (run || (!mine && sp > 230) ? 'run' : 'walk') : 'idle';
      if (want !== o.cur) { const a = o.act[want]; a.reset().play(); o.act[o.cur].crossFadeTo(a, .25, false); o.cur = want; }
      o.mixer.update(dt);
      tag(p, o); o.tag.position.set(o.x, o.g.position.y + 54, o.y);
      return o;
    }
    o.walk += dt * (moving ? (run ? 15 : 10) : 0); const sw = moving ? Math.sin(o.walk) * (run ? .9 : .6) : 0;
    o.legL.rotation.x = sw; o.legR.rotation.x = -sw; o.armL.rotation.x = -sw * .9; o.armR.rotation.x = sw * .9;
    if (p.action === 'dance') { o.armL.rotation.z = Math.sin(t * 8) * 1.2 + .4; o.armR.rotation.z = -Math.sin(t * 8) * 1.2 - .4; o.g.position.y += Math.abs(Math.sin(t * 8)) * 2.5; } else { o.armL.rotation.z = .06; o.armR.rotation.z = -.06; }
    tag(p, o); o.tag.position.set(o.x, o.g.position.y + 60, o.y);
    return o;
  }
  // est-ce qu'on est sur un trottoir (un peu plus haut que la route) ?
  const onWalk = (x, y) => A.STREETS_Y.some(sy => { const d = Math.abs(y - sy); return d > RW / 2 && d < RW / 2 + SW; }) || A.STREETS_X.some(sx => { const d = Math.abs(x - sx); return d > RW / 2 && d < RW / 2 + SW; });
  // ---------- 🚗 conduire une voiture ----------
  let myCar = null;
  function toggleCar() {
    driving = !driving; speed = 0;
    if (driving) { if (!myCar) { myCar = carMesh(new THREE.Color(A.players.get(A.me)?.color || '#c0392b'), true); scene.add(myCar); } myCar.visible = true; toast('🚗 Tu conduis ! Pousse le joystick (ou ▲) pour accélérer, et tourne à gauche ou à droite'); }
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
    if (!window.Island.isOpen() || window.Island.kind() !== 'island' || window.LaserGame?.active?.() || window.Bowling?.active?.() || window.Casino?.active?.()) return;
    const K = A.keys, fwd = K.has('ArrowUp') || K.has('z') || K.has('w'), back = K.has('ArrowDown') || K.has('s');
    const left = K.has('ArrowLeft') || K.has('q') || K.has('a'), right = K.has('ArrowRight') || K.has('d');
    const dz = v => (Math.abs(v) < .18 ? 0 : v);
    let push = fwd ? 1 : back ? -.7 : 0, turn = (left ? 1 : 0) - (right ? 1 : 0);
    if (stick.on) { push = -dz(stick.y); turn = -dz(stick.x); }
    const m = A.players.get(A.me);
    if (driving) { const target = push * 620; speed += (target - speed) * Math.min(1, dt * (push ? 1.6 : 2.5)); yaw += turn * 1.9 * dt * Math.max(-1, Math.min(1, speed / 200)); }
    else { yaw += turn * 2.3 * dt; speed = push * (Math.abs(push) > .85 ? 250 : 160); }
    const dir = { x: -Math.sin(yaw), y: -Math.cos(yaw) };
    if (m && Math.abs(speed) > 2) {
      const sp = speed * (window.CityGames?.speed?.() ?? 1) * dt, nx = m.x + dir.x * sp, ny = m.y + dir.y * sp;
      // on se cogne contre les bâtiments (mais si on est déjà dedans, on peut en sortir)
      const inWall = (x, y) => walls.some(w => x > w.x0 && x < w.x1 && y > w.z0 && y < w.z1), stuck = inWall(m.x, m.y), ok = (x, y) => stuck || !inWall(x, y);
      const tryMove = (x, y) => ok(x, y) && A.moveMine(x, y);
      if (!tryMove(nx, ny)) { if (!tryMove(nx, m.y) && !tryMove(m.x, ny)) { if (driving) speed *= -.3; } }
      pos = { x: m.x, y: m.y }; bob += dt * 10;
    } else if (m) { pos.x += (m.x - pos.x) * .3; pos.y += (m.y - pos.y) * .3; m.moving = false; }
    if (driving && myCar) { myCar.position.set(pos.x, 0, pos.y); myCar.rotation.y = yaw + Math.PI / 2; }
    // la caméra
    if (mode === 'first' && !driving) {
      const eye = 42 + (onWalk(pos.x, pos.y) ? CURB : 0) + (Math.abs(speed) > 5 ? Math.sin(bob) * 1.4 : 0);
      camera.position.set(pos.x, eye, pos.y); camera.lookAt(pos.x + dir.x * 100, eye + Math.tan(pitch) * 100, pos.y + dir.y * 100);
    } else {
      const d = driving ? 210 : 118, h = Math.max(22, (driving ? 100 : 60) - pitch * (driving ? 190 : 130)), head = new THREE.Vector3(pos.x, driving ? 50 : 36, pos.y), want = new THREE.Vector3(pos.x - dir.x * d, h, pos.y - dir.y * d);
      ray = ray || new THREE.Raycaster(); const v = want.clone().sub(head), len = v.length(); ray.set(head, v.normalize()); ray.far = len;
      const hit = ray.intersectObjects(solids, false)[0];
      // un mur gêne : la caméra se rapproche de moi tout de suite (elle ne passe jamais derrière un mur), puis repart doucement
      const want2 = hit ? Math.max(16, hit.distance - 10) : len;
      camLen = want2 < camLen ? want2 : camLen + (want2 - camLen) * Math.min(1, dt * 3);
      camera.position.copy(head).addScaledVector(v, camLen); camera.lookAt(pos.x, driving ? 42 : 32, pos.y);
    }
    if (sun.castShadow) { sun.position.set(pos.x - 700, 1100, pos.y + 800); sun.target.position.set(pos.x, 0, pos.y); }
    sunDisc.position.set(camera.position.x - 5200, 3400, camera.position.z + 6000);
    // les voitures roulent ; les feux changent de couleur
    for (const c of cars) {
      const L = c.horiz ? A.W : A.H; c.off = (c.off + c.sp * c.dir * dt + L) % L;
      if (c.horiz) { c.car.position.set(c.off, 0, c.line); c.car.rotation.y = c.dir > 0 ? 0 : Math.PI; }
      else { c.car.position.set(c.line, 0, c.off); c.car.rotation.y = c.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
    }
    const phase = Math.floor(t / 4) % 3; for (const L of traffic) L.l.material.color.set(L.k === [2, 1, 0][phase] ? L.c : '#1a1a1a');
    // les promeneurs (et moi)
    const seen = new Set();
    for (const p of A.players.values()) {
      const hide = p.id === A.me && (mode === 'first' || driving);
      const o = person(p, t, dt); o.g.visible = !hide; o.tag.visible = !hide; seen.add(p.id);
    }
    for (const [id, o] of people) if (!seen.has(id)) { scene.remove(o.g); if (o.tag) { scene.remove(o.tag); o.tag.material.map.dispose(); o.tag.material.dispose(); } people.delete(id); }
    if (t - lastSky > 15) { lastSky = t; sky(); }
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
  return { kit, setMode, mode: () => mode, yaw: () => yaw, face: a => { yaw = a; }, drive: () => toggleCar(), debug: () => ({ m: (() => { const m = A?.players.get(A.me); return m ? [Math.round(m.x), Math.round(m.y), Math.round(m.dx), Math.round(m.dy)] : null; })(), pos: [Math.round(pos.x), Math.round(pos.y)], people: people.size, me: A?.me, players: A ? [...A.players.keys()] : [], vis: [...people.values()].map(o => [o.g.visible, Math.round(o.g.position.x), Math.round(o.g.position.y), Math.round(o.g.position.z)]), cam: camera ? camera.position.toArray().map(Math.round) : null, calls: R?.info.render.calls, car: cars[0] ? (() => { const g = cars[0].car; const b = new THREE.Box3().setFromObject(g); return [g.children.length, g.children[0]?.children.map(m => m.geometry?.attributes.position.count), b.min.toArray().map(Math.round), b.max.toArray().map(Math.round)]; })() : null }) };
})();
window.City3D = City3D;
