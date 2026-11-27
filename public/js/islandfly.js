// The Paradise — ✈️🏝️ « Le survol de l'île » : avant de s'inscrire ou de se connecter, on survole l'île du Paradise en vraie 3D
// (mer qui bouge, plage, palmiers, coucher de soleil) jusqu'à se poser sur la plage… où le formulaire apparaît, en verre, par-dessus.
(() => {
  const card = document.getElementById('authCard'); if (!card) return;
  const q = new URLSearchParams(location.search);
  if (q.get('reset') || q.get('google') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try { const c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) return; } catch (e) { return; }
  const mob = innerWidth < 760;
  const gate = document.createElement('div'); gate.className = 'ifly';
  gate.innerHTML = `<canvas class="ifly-cv"></canvas><div class="ifly-shade"></div>
    <div class="ifly-intro"><div class="ifly-title">🌴 L'île du Paradise</div><div class="ifly-sub">Ton aventure commence ici</div>
      <button type="button" class="ifly-go">✈️ Survoler l'île</button></div>
    <div class="ifly-load"><i></i></div>
    <button type="button" class="ifly-skip">Passer ›</button>`;
  card.classList.add('flying'); card.prepend(gate);
  let THREE, R, scene, cam, water, t0 = performance.now(), prevT = 0, raf = 0, phase = 'idle', flyT = 0, path, look, landed = false, lastFrame = 0, visible = true;
  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const skip = () => { if (phase === 'done') return; phase = 'done'; showForm(); };
  gate.querySelector('.ifly-skip').addEventListener('click', e => { e.stopPropagation(); skip(); });
  gate.querySelector('.ifly-go').addEventListener('click', () => { if (phase !== 'idle' || !path) return; phase = 'fly'; flyT = 0; gate.classList.add('ifly-flying'); });
  document.querySelectorAll('a[href="#authCard"]').forEach(a => a.addEventListener('click', () => setTimeout(() => { if (phase === 'idle' && path) gate.querySelector('.ifly-go').click(); }, 600)));
  function showForm() {
    card.classList.remove('flying'); card.classList.add('landed', 'bg-revealed'); gate.classList.add('ifly-landed');
    setTimeout(() => card.classList.remove('bg-revealed'), 1300);
    card.querySelector('form:not(.hidden) input:not([type=hidden])')?.focus({ preventScroll: true });
  }
  import('/js/vendor/three.module.min.js').then(T => { THREE = T; build(); }).catch(() => { gate.remove(); card.classList.remove('flying'); });

  function build() {
    const cv = gate.querySelector('.ifly-cv');
    R = new THREE.WebGLRenderer({ canvas: cv, antialias: !mob, powerPreference: 'high-performance' });
    R.setPixelRatio(Math.min(devicePixelRatio || 1, mob ? 1.5 : 1.75)); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
    scene = new THREE.Scene(); const HZ = new THREE.Color('#ffb48a'); scene.fog = new THREE.Fog(HZ, 260, 900);
    cam = new THREE.PerspectiveCamera(mob ? 58 : 50, 1, .5, 3000);
    const SUN = new THREE.Vector3(-.55, .16, -1).normalize();
    // 🌅 le ciel : dégradé du coucher de soleil, avec le soleil
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: SUN } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `varying vec3 vD; uniform vec3 uSun; void main(){ float h = vD.y; vec3 top = vec3(.16,.12,.38), mid = vec3(.86,.38,.52), low = vec3(1.,.70,.47);
        vec3 c = mix(low, mid, smoothstep(.0, .18, h)); c = mix(c, top, smoothstep(.15, .6, h)); float s = max(dot(vD, uSun), 0.);
        c += vec3(1.,.75,.4) * pow(s, 8.) * .55 + vec3(1.,.95,.8) * smoothstep(.9985, .9995, s) * 2.; if (h < 0.) c = mix(low, vec3(.35,.25,.35), -h * 3.); gl_FragColor = vec4(c, 1.); }` }));
    scene.add(sky);
    // 🌊 la mer : de vraies vagues, la lumière du soleil qui brille dessus
    const wg = new THREE.PlaneGeometry(2400, 2400, mob ? 140 : 220, mob ? 140 : 220); wg.rotateX(-Math.PI / 2);
    water = new THREE.Mesh(wg, new THREE.ShaderMaterial({ fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSun: { value: SUN }, uCam: { value: new THREE.Vector3() } }]),
      vertexShader: `#include <fog_pars_vertex>
        uniform float uT; varying vec3 vW; varying float vH;
        varying vec3 vN;
        float wave(vec2 p){ return sin(p.x*.045+uT*1.1)*1.1 + sin(p.y*.06-uT*.9)*.8 + sin((p.x+p.y)*.11+uT*1.7)*.35 + sin((p.x-p.y)*.2-uT*2.3)*.15; }
        void main(){ vec3 p = position; float d = length(p.xz); float k = .25 + .75 * smoothstep(40., 110., d); p.y = wave(p.xz) * k; vH = p.y;
          float e = .8; float hx = (wave(p.xz + vec2(e, 0.)) - wave(p.xz - vec2(e, 0.))) * k / (2. * e), hz = (wave(p.xz + vec2(0., e)) - wave(p.xz - vec2(0., e))) * k / (2. * e);
          vN = normalize(vec3(-hx, 1., -hz));
          vec4 w = modelMatrix * vec4(p, 1.); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `#include <fog_pars_fragment>
        uniform vec3 uSun; uniform vec3 uCam; uniform float uT; varying vec3 vW; varying float vH; varying vec3 vN;
        void main(){ vec3 n = normalize(vN + vec3(sin(vW.x * .9 + uT * 2.) * .04, 0., cos(vW.z * .8 - uT * 1.7) * .04));
          vec3 v = normalize(uCam - vW); float fr = pow(1. - max(dot(n, v), 0.), 3.);
          float d = length(vW.xz); vec3 shallow = vec3(.10,.78,.80), deep = vec3(.03,.22,.40);
          vec3 c = mix(shallow, deep, smoothstep(55., 160., d)); c = mix(c, vec3(1.,.72,.55), fr * .65);
          vec3 h = normalize(uSun + v); c += vec3(1.,.85,.6) * pow(max(dot(n, h), 0.), 140.) * 2.2;
          float foam = smoothstep(.6, 1.4, vH) * .25 + (1. - smoothstep(48., 62., d)) * (.55 + .45 * sin(d * 1.3 - uT * 2.)) * .5; c = mix(c, vec3(1.), clamp(foam, 0., .8));
          gl_FragColor = vec4(c, 1.);
          #include <fog_fragment>
        }` }));
    scene.add(water);
    // 🏝️ l'île : plage de sable, collines vertes, un peu de relief
    const ig = new THREE.CircleGeometry(66, 160, 0, Math.PI * 2); ig.rotateX(-Math.PI / 2);
    const P = ig.attributes.position, col = []; const noise = (x, z) => Math.sin(x * .13) * Math.cos(z * .11) * 1.6 + Math.sin(x * .31 + z * .27) * .6 + Math.cos(x * .07 - z * .09) * 2.2;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), r = Math.hypot(x, z) / 66; const lump = Math.max(0, 1 - r * r) * 12 + noise(x, z) * Math.max(0, 1 - r) * 1.8 - 1.2 * r * r; P.setY(i, Math.max(-1.5, lump));
      const y = lump, sand = new THREE.Color('#fff0c8'), grass = new THREE.Color(r < .45 ? '#3fae4c' : '#62c45a'), wet = new THREE.Color('#e8cf98');
      const c = y < 1.2 ? wet.lerp(sand, Math.min(1, Math.max(0, y + .6))) : y < 3 ? sand.clone().lerp(grass, (y - 1.2) / 1.8) : grass.offsetHSL(0, 0, (noise(z, x) * .02)); col.push(c.r, c.g, c.b); }
    ig.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); ig.computeVertexNormals();
    const isle = new THREE.Mesh(ig, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 })); isle.position.y = .2; scene.add(isle);
    const heightAt = (x, z) => { const r = Math.hypot(x, z) / 66; return Math.max(-1.5, Math.max(0, 1 - r * r) * 12 + noise(x, z) * Math.max(0, 1 - r) * 1.8 - 1.2 * r * r) + .2; };
    // 🌴 les palmiers (tronc courbé + grandes palmes)
    const trunkM = new THREE.MeshStandardMaterial({ color: '#7a5532', roughness: .9 }), leafM = new THREE.MeshStandardMaterial({ color: '#2f8f3f', roughness: .8, side: THREE.DoubleSide }), leafM2 = new THREE.MeshStandardMaterial({ color: '#3fa84c', roughness: .8, side: THREE.DoubleSide });
    const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(3, 1.4, 9, .2); leafShape.quadraticCurveTo(3, -.6, 0, 0); const leafG = new THREE.ShapeGeometry(leafShape, 8);
    { const p = leafG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, -x * x * .045); } leafG.computeVertexNormals(); }
    const palm = (x, z, h, lean, rot) => { const g = new THREE.Group(), y0 = heightAt(x, z) - .3; g.position.set(x, y0, z); g.rotation.y = rot;
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * .3, h * .55, 0), new THREE.Vector3(lean, h, 0));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, .42, 7), trunkM));
      const top = new THREE.Group(); top.position.set(lean, h, 0); g.add(top);
      for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(leafG, i % 2 ? leafM : leafM2); l.rotation.set(-Math.PI / 2 + .25 + (i % 3) * .12, i / 9 * Math.PI * 2, 0, 'YXZ'); top.add(l); }
      for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(.45, 8, 6), trunkM); c.position.set(Math.cos(i * 2) * .5, -.4, Math.sin(i * 2) * .5); top.add(c); }
      scene.add(g); return top; };
    const tops = [];
    for (let i = 0; i < (mob ? 16 : 26); i++) { const a = i / (mob ? 16 : 26) * Math.PI * 2 + Math.sin(i * 7.3) * .2, r = 38 + (i % 3) * 6 + Math.sin(i * 3.1) * 3; tops.push(palm(Math.cos(a) * r, Math.sin(a) * r, 11 + (i % 4) * 2, 1.5 + (i % 3), -a + Math.PI / 2)); }
    for (let i = 0; i < 8; i++) { const a = i * 2.4, r = 8 + i * 2.6; tops.push(palm(Math.cos(a) * r, Math.sin(a) * r, 12 + (i % 3) * 2, 1 + (i % 2), a)); }
    // quelques rochers et une petite cabane sur pilotis
    const rockM = new THREE.MeshStandardMaterial({ color: '#8a8580', roughness: 1, flatShading: true });
    for (let i = 0; i < 10; i++) { const a = i * .63 + 1, r = 60 + (i % 3) * 3, m = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 + (i % 3) * .8, 0), rockM); m.position.set(Math.cos(a) * r, .2, Math.sin(a) * r); m.rotation.set(i, i * 2, 0); scene.add(m); }
    { const hut = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: '#a8743f', roughness: .9 }), roof = new THREE.MeshStandardMaterial({ color: '#d8b46a', roughness: 1 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(10, .5, 22), wood); deck.position.set(0, 2.2, 0); hut.add(deck);
      for (const [x, z] of [[-4, -10], [4, -10], [-4, 0], [4, 0], [-4, 10], [4, 10]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 4.5, 6), wood); p.position.set(x, 0, z); hut.add(p); }
      const box = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 8), wood); box.position.set(0, 4.7, 8); hut.add(box);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(7.4, 4.5, 4), roof); cone.position.set(0, 9.2, 8); cone.rotation.y = Math.PI / 4; hut.add(cone);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshBasicMaterial({ color: '#ffd27a' })); win.position.set(0, 5, 3.95); win.rotation.y = Math.PI; hut.add(win);
      hut.position.set(30, 0, -74); hut.rotation.y = -.55; scene.add(hut); }
    // ☀️ les lumières du coucher de soleil
    scene.add(new THREE.HemisphereLight('#ffe8d6', '#5a7a8a', 1.6));
    const sun = new THREE.DirectionalLight('#ffd2a0', 3.2); sun.position.copy(SUN).multiplyScalar(400); scene.add(sun);
    // ✈️ le trajet de la caméra : de loin, on plonge, on survole l'île, et on se pose sur la plage (face à la mer et au soleil)
    path = new THREE.CatmullRomCurve3([new THREE.Vector3(260, 120, 300), new THREE.Vector3(140, 70, 150), new THREE.Vector3(40, 32, 40), new THREE.Vector3(-20, 22, -10), new THREE.Vector3(-12, 11, -50), new THREE.Vector3(-2, 6.5, -66)], false, 'catmullrom', .3);
    look = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 4, 0), new THREE.Vector3(0, 4, 0), new THREE.Vector3(-10, 6, -20), new THREE.Vector3(-30, 8, -90), new THREE.Vector3(-60, 10, -180), new THREE.Vector3(-90, 14, -260)]);
    addEventListener('resize', size); size();
    gate.classList.add('ifly-ready');
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) loop(); });
    loop();
    function loop() { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    function frame(now) {
      if (!visible || !gate.isConnected) return; raf = requestAnimationFrame(frame);
      if (landed && now - lastFrame < 45) return; lastFrame = now; // posé sur la plage : on économise la batterie (environ 20 images/s)
      const t = (now - t0) / 1000, dt = Math.min(.1, Math.max(0, t - prevT)); prevT = t; water.material.uniforms.uT.value = t;
      if (phase === 'idle') { const a = t * .06; cam.position.set(Math.cos(a) * 300 + 0, 120, Math.sin(a) * 300 + 120); cam.position.copy(path.getPoint(0)).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(t * .2) * .08); cam.lookAt(0, 4, 0); }
      else if (phase === 'fly') { flyT = Math.min(1, flyT + dt / 6.5); const k = ease(flyT); cam.position.copy(path.getPoint(k)); cam.lookAt(look.getPoint(k)); if (flyT >= 1) { phase = 'done'; landed = true; showForm(); } }
      else if (phase === 'done' && !landed) { landed = true; cam.position.copy(path.getPoint(1)); cam.lookAt(look.getPoint(1)); }
      if (landed) { const b = Math.sin(t * .5) * .25; cam.position.y = path.getPoint(1).y + b; cam.lookAt(look.getPoint(1)); }
      for (let i = 0; i < tops.length; i++) tops[i].rotation.z = Math.sin(t * 1.2 + i) * .04;
      water.material.uniforms.uCam.value.copy(cam.position);
      R.render(scene, cam);
    }
  }
  function size() { if (!R) return; const r = gate.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height); R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  // la taille de la carte change quand le formulaire apparaît (ou qu'on change d'onglet) : la 3D suit
  new ResizeObserver(size).observe(card);
})();
