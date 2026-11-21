// The Paradise — ⛅ La météo du site : pluie, neige, orage, brouillard, vent… la même pour tout le monde, en direct.
// Les effets tombent sur tout le site et dans la Ville. Chacun peut les couper ou les rendre plus discrets (pour lui).
const Weather = (() => {
  let data = null, cv = null, g = null, parts = [], flash = 0, nextBolt = 0, raf = 0, last = 0, btn = null;
  const pref = (k, d) => { try { return localStorage.getItem('lc_wx_' + k) ?? d; } catch (e) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem('lc_wx_' + k, v); } catch (e) {} };
  const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const now = () => data?.now || null;
  const type = () => now()?.type || 'soleil';
  // dans un lieu fermé de la Ville (maison, cinéma, club…), il ne pleut pas !
  const indoors = () => window.Island?.isOpen?.() && window.Island.kind?.() !== 'island';
  const on = () => pref('fx', '1') === '1' && !reduce();
  const level = () => +pref('lvl', '60') / 100;

  // ---------- la bulle météo en haut du site ----------
  function renderBtn() {
    const w = now(); if (!w) return;
    if (!btn) {
      btn = el('button', { class: 'btn btn-sm wx-btn', id: 'wxBtn', onclick: () => open() });
      const s = document.getElementById('soundBtn'); if (s?.parentNode) s.parentNode.insertBefore(btn, s); else return;
    }
    btn.title = `Météo : ${w.name}, ${w.temp}°`;
    btn.replaceChildren(el('span', { class: 'wx-ico' }, w.icon), el('b', {}, w.temp + '°'));
  }
  // ---------- les effets sur l'écran ----------
  function ensureCanvas() {
    if (cv) return;
    cv = document.createElement('canvas'); cv.className = 'wx-canvas'; cv.setAttribute('aria-hidden', 'true'); document.body.append(cv); g = cv.getContext('2d');
    const fit = () => { const d = Math.min(devicePixelRatio || 1, 1.5); cv.width = innerWidth * d; cv.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0); };
    addEventListener('resize', fit); fit();
  }
  const spawn = (n, mk) => { while (parts.length < n) parts.push(mk(true)); if (parts.length > n) parts.length = n; };
  let staticKey = '', waitT = 0;
  function step(ts) {
    const W = innerWidth, H = innerHeight, t = type(), k = level(), lite = !!window.LC_LITE?.();
    // ⚡ soleil, brouillard, arc-en-ciel, beau temps : rien ne bouge, on dessine une seule fois (puis on vérifie de temps en temps)
    const moving = on() && !indoors() && (['pluie', 'orage', 'neige', 'vent', 'nuageux', 'eclaircies'].includes(t) || flash > 0 || bolts.length > 0);
    if (!moving) {
      raf = 0; if (!waitT) waitT = setTimeout(() => { waitT = 0; if (!raf) raf = requestAnimationFrame(loop); }, 1500);
      const key = [t, k, W, H, on(), indoors(), now()?.night].join('|'); if (key === staticKey) return; staticKey = key;
    } else {
      staticKey = ''; raf = requestAnimationFrame(loop);
      if (lite && ts - last < 31) return; // appareil lent : 30 images par seconde suffisent pour la pluie et la neige
    }
    const dt = Math.min(.05, (ts - last) / 1000 || .016); last = ts;
    const q = k * (lite ? .5 : 1); // et deux fois moins de gouttes ou de flocons
    cv.style.display = on() ? '' : 'none'; if (!on()) return;
    g.clearRect(0, 0, W, H);
    if (indoors()) { document.body.dataset.wx = ''; return; }
    document.body.dataset.wx = t;
    const wind = (now()?.wind || 10) / 30;
    // 🌧️ pluie et ⛈️ orage
    if (t === 'pluie' || t === 'orage') {
      const n = Math.round((t === 'orage' ? 260 : 170) * q * (W / 1400 + .4));
      spawn(n, init => ({ x: Math.random() * (W + 200) - 100, y: init ? Math.random() * H : -20, v: 700 + Math.random() * 500, l: 10 + Math.random() * 14 }));
      g.strokeStyle = 'rgba(180,210,255,.55)'; g.lineWidth = 1.2; g.beginPath();
      for (const p of parts) { p.y += p.v * dt; p.x += wind * 120 * dt; if (p.y > H) { if (Math.random() < .35) splash(p.x, H - 2); p.y = -20; p.x = Math.random() * (W + 200) - 100; } g.moveTo(p.x, p.y); g.lineTo(p.x - wind * 4, p.y - p.l); }
      g.stroke();
      drawSplashes(dt);
      if (t === 'orage') { if (ts > nextBolt) { flash = 1; nextBolt = ts + 4000 + Math.random() * 9000; bolt(W, H); } }
    }
    // 🌨️ neige
    else if (t === 'neige') {
      const n = Math.round(140 * q * (W / 1400 + .4));
      spawn(n, init => ({ x: Math.random() * W, y: init ? Math.random() * H : -10, v: 30 + Math.random() * 60, r: 1.5 + Math.random() * 3, a: Math.random() * 6 }));
      g.fillStyle = 'rgba(255,255,255,.9)';
      for (const p of parts) { p.y += p.v * dt; p.a += dt; p.x += Math.sin(p.a) * 20 * dt + wind * 20 * dt; if (p.y > H) { p.y = -10; p.x = Math.random() * W; } g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
    }
    // 💨 grand vent : des feuilles et des traits qui filent
    else if (t === 'vent') {
      spawn(Math.round(40 * q + 10), init => ({ x: init ? Math.random() * W : -40, y: Math.random() * H, v: 300 + Math.random() * 400, e: ['🍃', '🍂', '〰️'][Math.floor(Math.random() * 3)], a: Math.random() * 6 }));
      g.font = '18px "Noto Color Emoji", sans-serif';
      for (const p of parts) { p.x += p.v * dt; p.a += dt * 4; p.y += Math.sin(p.a) * 40 * dt; if (p.x > W + 40) { p.x = -40; p.y = Math.random() * H; } g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.globalAlpha = .7; g.fillText(p.e, 0, 0); g.restore(); }
    }
    // ☀️ soleil, 🔥 canicule : de légers reflets ; ☁️ nuageux : des nuages qui passent ; 🌈 un arc-en-ciel
    else if (t === 'nuageux' || t === 'eclaircies') {
      spawn(t === 'nuageux' ? 6 : 3, init => ({ x: init ? Math.random() * W : -300, y: 20 + Math.random() * H * .35, v: 10 + Math.random() * 20, s: .7 + Math.random() * .8 }));
      for (const p of parts) { p.x += p.v * dt * (1 + wind); if (p.x > W + 300) { p.x = -300; } cloud(p.x, p.y, p.s, t === 'nuageux' ? .16 : .1); }
    } else {
      parts.length = 0;
      if (t === 'brouillard') { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, `rgba(225,228,236,${.18 * k})`); gr.addColorStop(1, `rgba(225,228,236,${.6 * k})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
      if ((t === 'soleil' || t === 'canicule') && !now()?.night) { const gr = g.createRadialGradient(W - 60, 40, 10, W - 60, 40, 380); gr.addColorStop(0, `rgba(255,220,120,${(t === 'canicule' ? .35 : .18) * k})`); gr.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); if (t === 'canicule') { g.fillStyle = `rgba(255,120,40,${.06 * k})`; g.fillRect(0, 0, W, H); } }
      if (t === 'arcenciel') { g.lineWidth = 10; ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#5856d6', '#af52de'].forEach((c, i) => { g.strokeStyle = c; g.globalAlpha = .18 * k + .05; g.beginPath(); g.arc(W * .75, H * .55, Math.min(W, H) * .5 - i * 10, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }); g.globalAlpha = 1; }
    }
    if (flash > 0) { g.fillStyle = `rgba(230,240,255,${flash * .55})`; g.fillRect(0, 0, W, H); flash = Math.max(0, flash - dt * 3); }
  }
  let splashes = [];
  const splash = (x, y) => { if (splashes.length < 60) splashes.push({ x, y, r: 0 }); };
  function drawSplashes(dt) { g.strokeStyle = 'rgba(180,210,255,.4)'; for (const s of splashes) { s.r += dt * 30; g.beginPath(); g.ellipse(s.x, s.y, s.r, s.r * .3, 0, Math.PI, 0); g.stroke(); } splashes = splashes.filter(s => s.r < 8); }
  function cloud(x, y, s, a) { g.fillStyle = `rgba(255,255,255,${a})`; for (const [dx, dy, r] of [[0, 0, 40], [40, -14, 50], [90, 0, 42], [50, 12, 46]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, 7); g.fill(); } }
  function bolt(W, H) {
    let x = W * (.2 + Math.random() * .6), y = 0; const pts = [[x, y]];
    while (y < H * .55) { y += 20 + Math.random() * 40; x += (Math.random() - .5) * 60; pts.push([x, y]); }
    const b = { pts, a: 1 }; bolts.push(b);
    if (pref('snd', '0') === '1') thunder();
  }
  const bolts = [];
  function drawBolts() { for (const b of bolts) { g.strokeStyle = `rgba(255,255,230,${b.a})`; g.lineWidth = 3; g.shadowColor = '#fff'; g.shadowBlur = 18; g.beginPath(); b.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.shadowBlur = 0; b.a -= .06; } for (let i = bolts.length - 1; i >= 0; i--) if (bolts[i].a <= 0) bolts.splice(i, 1); }
  const _step = step; // les éclairs se dessinent par-dessus
  function loop(ts) { _step(ts); if (on() && !indoors() && bolts.length && !document.querySelector('.island.view3d:not(.hidden)')) drawBolts(); } // en 3D, pas de trait d'éclair dessiné par-dessus (juste le flash)
  // 🔊 le tonnerre (si on l'a allumé)
  function thunder() { try { const A = new (window.AudioContext || window.webkitAudioContext)(), len = 2.5, b = A.createBuffer(1, A.sampleRate * len, A.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2); const s = A.createBufferSource(), f = A.createBiquadFilter(), gn = A.createGain(); s.buffer = b; f.type = 'lowpass'; f.frequency.value = 280; gn.gain.value = .5; s.connect(f).connect(gn).connect(A.destination); s.start(A.currentTime + .4); } catch (e) {} }

  // ---------- 🪟 la météo vue par les fenêtres des maisons ----------
  function drawWindows(c, rects, t) {
    const w = type();
    for (const [x, y, ww, hh] of rects) {
      c.save(); c.beginPath(); c.rect(x + 3, y + 3, ww - 6, hh - 6); c.clip();
      if (w === 'pluie' || w === 'orage') { c.fillStyle = 'rgba(40,60,90,.35)'; c.fillRect(x, y, ww, hh); c.strokeStyle = 'rgba(200,225,255,.7)'; c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i < 14; i++) { const px = x + ((i * 37 + t * 60) % ww), py = y + ((i * 53 + t * 260) % hh); c.moveTo(px, py); c.lineTo(px - 2, py - 10); } c.stroke(); if (w === 'orage' && Math.sin(t * 1.3) > .985) { c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x, y, ww, hh); } }
      else if (w === 'neige') { c.fillStyle = 'rgba(220,230,255,.3)'; c.fillRect(x, y, ww, hh); c.fillStyle = '#fff'; for (let i = 0; i < 16; i++) { c.beginPath(); c.arc(x + ((i * 41 + Math.sin(t + i) * 10) % ww + ww) % ww, y + ((i * 29 + t * 30) % hh), 2.2, 0, 7); c.fill(); } }
      else if (w === 'brouillard') { c.fillStyle = 'rgba(230,230,235,.6)'; c.fillRect(x, y, ww, hh); }
      else if (w === 'nuageux') { c.fillStyle = 'rgba(200,205,215,.45)'; c.fillRect(x, y, ww, hh); }
      else if (w === 'arcenciel') { ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de'].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.arc(x + ww / 2, y + hh + 30, hh - i * 5, Math.PI, 0); c.stroke(); }); }
      c.restore();
    }
  }

  // ---------- la fenêtre « Météo » ----------
  let close = null;
  function open() {
    const box = el('div', { class: 'wx' });
    const hh = ts => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
    const draw = () => {
      const w = now(); if (!w) return;
      const staff = LC.rank?.(state.me) >= 1;
      box.replaceChildren(
        el('div', { class: 'wx-head wx-' + w.type + (w.night ? ' night' : '') }, el('small', {}, '📍 Le Paradise · en direct'), el('div', { class: 'wx-big' }, w.icon), el('b', { class: 'wx-temp' }, w.temp + '°'), el('div', {}, w.name), el('small', {}, `💨 Vent ${w.wind} km/h` + (w.forced ? ` · 🛡️ choisie par ${w.by} jusqu'à ${hh(w.until)}` : ` · prochain changement vers ${hh(w.next)}`))),
        el('h4', { class: 'wx-h' }, '🔮 Les prévisions'),
        el('div', { class: 'wx-fc' }, ...data.forecast.map(f => el('div', {}, el('small', {}, hh(f.at)), el('span', {}, f.icon), el('b', {}, f.temp + '°')))),
        el('h4', { class: 'wx-h' }, '⚙️ Mes réglages (rien que pour moi)'),
        el('label', { class: 'wx-row' }, el('input', { type: 'checkbox', checked: pref('fx', '1') === '1', onchange: e => { setPref('fx', e.target.checked ? '1' : '0'); draw(); } }), ' Voir la pluie, la neige et les éclairs sur le site'),
        el('label', { class: 'wx-row' }, '🔅', el('input', { type: 'range', min: 15, max: 100, value: pref('lvl', '60'), oninput: e => setPref('lvl', e.target.value) }), '🔆 Quantité'),
        el('label', { class: 'wx-row' }, el('input', { type: 'checkbox', checked: pref('snd', '0') === '1', onchange: e => setPref('snd', e.target.checked ? '1' : '0') }), ' 🔊 Entendre le tonnerre pendant les orages'),
        staff ? el('h4', { class: 'wx-h' }, '🛡️ Choisir la météo pour tout le site (équipe)') : null,
        staff ? el('div', { class: 'wx-set' }, ...Object.entries(data.types).map(([k, v]) => el('button', { class: 'btn btn-sm' + (w.forced && w.type === k ? ' btn-primary' : ''), onclick: () => { const m = prompt(`${v.icon} ${v.name} pendant combien de minutes ?`, '60'); if (!m) return; socket.emit('weather_set', { type: k, minutes: +m }, r => r?.error && toast(r.error)); } }, v.icon + ' ' + v.name)),
          el('button', { class: 'btn btn-sm', onclick: () => socket.emit('weather_set', null, r => r?.error && toast(r.error)) }, '🔄 Météo automatique')) : null,
        el('div', { style: 'text-align:right;margin-top:10px' }, el('button', { class: 'btn btn-primary', onclick: () => close && close() }, 'OK')));
    };
    draw(); close = modal(box);
    const re = () => { if (!box.isConnected) return socket.off('weather', re); draw(); }; socket.on('weather', re);
  }
  // ---------- on reçoit la météo du serveur ----------
  let lastType = '';
  socket.on('weather', d => {
    const before = lastType; data = d; lastType = d.now.type; renderBtn();
    if (before && before !== lastType) toast(`${d.now.icon} Changement de météo : ${d.now.name.toLowerCase()}, ${d.now.temp}°`);
    ensureCanvas(); if (!raf) raf = requestAnimationFrame(loop);
    document.dispatchEvent(new CustomEvent('weather', { detail: d }));
  });
  return { open, now, data: () => data, type, drawWindows };
})();
window.Weather = Weather;
