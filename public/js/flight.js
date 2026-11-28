// The Paradise — ✈️ « Le vol pour The Paradise » : juste après l'inscription ou la connexion.
// 1) le hall de l'aéroport le plus proche de chez toi, le tableau des départs, ton perso marche jusqu'à la porte
// 2) ta carte d'embarquement (pseudo, ville, vol, date, heure, porte, siège) + le tampon « EMBARQUÉ »
// 3) le vol sur la vraie carte du monde : le tracé jusqu'à l'île, l'avion qui avance, les km qui défilent
// 4) l'atterrissage à l'aéroport international de The Paradise 🏝️ et « Bienvenue ! »
// La ville vient de l'adresse IP (approximative) : elle n'est montrée qu'à toi et n'est jamais enregistrée.
const Flight = (() => {
  let root = null, raf = 0, timers = [], done = false;
  const T = (fn, ms) => timers.push(setTimeout(fn, ms));
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let AC = null;
  const chime = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime; [[659, 0], [523, .55]].forEach(([f, d]) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.18, t + d + .03); g.gain.exponentialRampToValueAtTime(.0001, t + d + 1.2); o.connect(g).connect(AC.destination); o.start(t + d); o.stop(t + d + 1.3); }); } catch (e) {} };
  const whoosh = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime, n = Math.ceil(AC.sampleRate * 2.4), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / n) * .3; const s = AC.createBufferSource(), f = AC.createBiquadFilter(); s.buffer = b; f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1400, t + 1.2); f.frequency.linearRampToValueAtTime(250, t + 2.4); s.connect(f).connect(AC.destination); s.start(t); } catch (e) {} };

  async function play() {
    if (root || done) return; done = true;
    let F, land;
    try { [F, land] = await Promise.all([api('/api/flight'), fetch('/city3d/land.json').then(r => r.json())]); } catch (e) { return; }
    const me = state.me || {}, now = new Date(), board = new Date(now.getTime() + 5 * 60000);
    const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`, hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const seat = (12 + (me.id || 7) % 20) + 'ABCDEF'[(me.id || 3) % 6], gate = 'P' + (1 + (me.id || 5) % 9);
    const hours = F.km / 900, arr = new Date(now.getTime() + hours * 3600000);
    const name = (me.username || 'Voyageur').toUpperCase(), from = F.from;
    root = el('div', { class: 'fl' });
    root.innerHTML = `
      <section class="fl-s fl-hall">
        <div class="fl-windows"><i class="fl-plane-park">✈️</i><i class="fl-plane-take">✈️</i></div>
        <div class="fl-board"><div class="fl-board-h"><b>🛫 Départs</b><span>${esc(from.name)}</span><em class="fl-clock">${hm(now)}</em></div><div class="fl-rows"></div></div>
        <div class="fl-floor"></div>
        <div class="fl-gate"><b>${gate}</b><small>Embarquement</small><span>The Paradise 🏝️</span></div>
        <div class="fl-walker"><span class="fl-av"></span><i class="fl-bag">🧳</i></div>
        <div class="fl-cap">✈️ ${esc(F.home || from.city)} · ${esc(from.name)}</div>
      </section>
      <section class="fl-s fl-pass"><div class="fl-ticket">
        <div class="fl-t-top"><b>🌴 Paradise Airlines</b><span>Carte d'embarquement</span><span class="fl-t-class">Première ✨</span></div>
        <div class="fl-t-route"><div><small>Départ</small><b>${esc(from.code)}</b><span>${esc(from.city)}</span></div><div class="fl-t-arrow">✈️</div><div><small>Arrivée</small><b>TPR</b><span>The Paradise 🏝️</span></div></div>
        <div class="fl-t-grid"><div><small>Passager</small><b>${esc(name)}</b></div><div><small>Vol</small><b>${esc(F.flight)}</b></div><div><small>Date</small><b>${date}</b></div>
          <div><small>Embarquement</small><b>${hm(board)}</b></div><div><small>Porte</small><b>${gate}</b></div><div><small>Siège</small><b>${seat}</b></div></div>
        <div class="fl-t-bar"><i></i><span>${esc(F.flight)} · ${esc(from.code)} → TPR · ${date}</span></div>
        <div class="fl-stamp">EMBARQUÉ ✓</div>
      </div></section>
      <section class="fl-s fl-map"><canvas class="fl-cv"></canvas><div class="fl-clouds"><i></i><i></i><i></i></div>
        <div class="fl-hud"><div><small>Vol</small><b>${esc(F.flight)}</b></div><div><small>Altitude</small><b>11 000 m</b></div><div><small>Vitesse</small><b>905 km/h</b></div><div><small>Reste</small><b class="fl-left">${F.km.toLocaleString('fr-FR')} km</b></div><div><small>Arrivée</small><b>${hm(arr)}</b></div></div>
        <div class="fl-cap">🗺️ ${esc(from.city)} → The Paradise 🏝️ · ${F.km.toLocaleString('fr-FR')} km</div>
      </section>
      <section class="fl-s fl-land"><div class="fl-land-bg"></div><i class="fl-plane-land">✈️</i>
        <div class="fl-welcome"><small>🛬 Aéroport international The Paradise</small><b>Bienvenue au Paradise,</b><b class="fl-name">${esc(me.username || 'voyageur')} ! 🌴</b></div>
      </section>
      <button type="button" class="fl-skip">Passer ›</button>`;
    document.body.append(root); document.body.classList.add('fl-on');
    root.querySelector('.fl-av').append(LC.avatar(me));
    root.querySelector('.fl-skip').onclick = end;
    // 🛫 le tableau des départs qui s'affiche lettre par lettre
    const rows = [[F.flight, 'THE PARADISE 🏝️', hm(board), 'EMBARQUEMENT', 1], ['AF 1180', 'NEW YORK', hm(new Date(now.getTime() + 35 * 60000)), 'À L\'HEURE'], ['TP 0007', 'BORA-BORA', hm(new Date(now.getTime() + 50 * 60000)), 'À L\'HEURE'], ['IB 3402', 'MADRID', hm(new Date(now.getTime() + 70 * 60000)), 'RETARDÉ']];
    const R = root.querySelector('.fl-rows');
    rows.forEach(([v, d, h, st, hot], i) => { const r = el('div', { class: 'fl-row' + (hot ? ' hot' : '') }); [v, d, h, st].forEach((txt, k) => { const c = el('span', { class: 'fl-cell c' + k }); r.append(c); flap(c, txt, 300 + i * 220 + k * 90); }); R.append(r); });
    chime();
    const show = (sel, at) => T(() => { root.querySelectorAll('.fl-s').forEach(s => s.classList.toggle('on', s.matches(sel))); }, at);
    show('.fl-hall', 30); show('.fl-pass', 4200); show('.fl-map', 8200); show('.fl-land', 14200);
    T(() => root.querySelector('.fl-ticket')?.classList.add('stamped'), 6300);
    T(() => { mapStart(root.querySelector('.fl-cv'), land, from, F.to, F.km); whoosh(); }, 8200);
    T(() => { root.querySelector('.fl-land')?.classList.add('go'); }, 14300);
    T(end, 19000);
  }
  // une case du tableau : les lettres défilent puis se fixent (comme un vrai tableau à palettes)
  function flap(cell, text, delay) {
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    T(() => { let k = 0; const it = setInterval(() => { k++; const fixed = Math.floor(k / 2); cell.textContent = [...text].map((ch, i) => i < fixed || ch === ' ' ? ch : A[Math.floor(Math.random() * A.length)]).join(''); if (fixed >= text.length) clearInterval(it); }, 35); timers.push(it); }, delay);
  }
  // 🗺️ la carte du vol : vraie carte du monde, tracé en arc, l'avion qui avance
  function mapStart(cv, land, A, B, km) {
    const g = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
    const sizeIt = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
    sizeIt();
    const rad = x => x * Math.PI / 180, deg = x => x * 180 / Math.PI;
    const toV = (lat, lon) => [Math.cos(rad(lat)) * Math.cos(rad(lon)), Math.cos(rad(lat)) * Math.sin(rad(lon)), Math.sin(rad(lat))];
    const va = toV(A.lat, A.lon), vb = toV(B.lat, B.lon), om = Math.acos(Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
    const P = t => { const s = Math.sin(om) || 1, k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s; const v = [0, 1, 2].map(i => va[i] * k1 + vb[i] * k2); return [deg(Math.atan2(v[2], Math.hypot(v[0], v[1]))), deg(Math.atan2(v[1], v[0]))]; };
    const pts = Array.from({ length: 121 }, (_, i) => P(i / 120));
    // le cadre : les deux aéroports, avec de la marge
    const lats = pts.map(p => p[0]), lons = pts.map(p => p[1]);
    let la0 = Math.min(...lats), la1 = Math.max(...lats), lo0 = Math.min(...lons), lo1 = Math.max(...lons);
    const W = innerWidth, H = innerHeight, mx = (lo1 - lo0) * .22 + 6, my = (la1 - la0) * .22 + 6; lo0 -= mx; lo1 += mx; la0 -= my; la1 += my;
    const asp = W / H; { const w = lo1 - lo0, h = (la1 - la0) * 1.25; if (w / h < asp) { const add = (h * asp - w) / 2; lo0 -= add; lo1 += add; } else { const add = (w / asp - h) / 2 / 1.25; la0 -= add; la1 += add; } }
    const X = lon => (lon - lo0) / (lo1 - lo0) * W, Y = lat => (la1 - lat) / (la1 - la0) * H;
    const t0 = performance.now(), D = 5600, left = root.querySelector('.fl-left');
    const draw = now => {
      if (!root) return; const k = Math.min(1, (now - t0) / D), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sea = g.createLinearGradient(0, 0, 0, H); sea.addColorStop(0, '#0b2a4a'); sea.addColorStop(1, '#0a4f6e'); g.fillStyle = sea; g.fillRect(0, 0, W, H);
      // la grille (méridiens, parallèles)
      g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; for (let lo = Math.ceil(lo0 / 10) * 10; lo < lo1; lo += 10) { g.beginPath(); g.moveTo(X(lo), 0); g.lineTo(X(lo), H); g.stroke(); } for (let la = Math.ceil(la0 / 10) * 10; la < la1; la += 10) { g.beginPath(); g.moveTo(0, Y(la)); g.lineTo(W, Y(la)); g.stroke(); }
      // les terres
      g.fillStyle = '#2f7a6a'; g.strokeStyle = 'rgba(180,255,220,.35)'; g.lineWidth = 1;
      for (const r of land) { g.beginPath(); for (let i = 0; i < r.length; i += 2) { const x = X(r[i]), y = Y(r[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fill(); g.stroke(); }
      // le tracé : en pointillés pour tout le trajet, plein pour ce qui est déjà parcouru
      g.setLineDash([6, 8]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); pts.forEach(([la, lo], i) => i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))); g.stroke(); g.setLineDash([]);
      const n = Math.max(1, Math.round(e * 120)); g.strokeStyle = '#ffd36b'; g.lineWidth = 3.5; g.shadowColor = '#ffb02e'; g.shadowBlur = 12; g.beginPath(); pts.slice(0, n + 1).forEach(([la, lo], i) => i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))); g.stroke(); g.shadowBlur = 0;
      // les deux aéroports
      const pin = (la, lo, c, label, right) => { const x = X(lo), y = Y(la); g.fillStyle = c; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.font = '800 14px Outfit, sans-serif'; g.textAlign = right ? 'left' : 'right'; g.fillStyle = '#fff'; g.shadowColor = '#000'; g.shadowBlur = 6; g.fillText(label, x + (right ? 12 : -12), y + 5); g.shadowBlur = 0; };
      pin(A.lat, A.lon, '#ff5fa2', `${A.code} · ${A.city}`, X(A.lon) < W / 2);
      { const x = X(B.lon), y = Y(B.lat), r = 16 + Math.sin(now / 300) * 3; const gr = g.createRadialGradient(x, y, 2, x, y, r * 2); gr.addColorStop(0, 'rgba(255,220,120,.8)'); gr.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 2, 0, 7); g.fill(); g.font = '26px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.fillText('🏝️', x, y + 9); g.font = '800 14px Outfit, sans-serif'; g.fillStyle = '#ffe08a'; g.shadowColor = '#000'; g.shadowBlur = 6; g.fillText('TPR · The Paradise', x, y + 34); g.shadowBlur = 0; }
      // l'avion, tourné dans le sens du vol
      const i = Math.min(119, Math.floor(e * 120)), [la, lo] = P(e), [la2, lo2] = P(Math.min(1, e + .01)), ang = Math.atan2(Y(la2) - Y(la), X(lo2) - X(lo));
      g.save(); g.translate(X(lo), Y(la)); g.rotate(ang + Math.PI / 4); g.font = '34px "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 10; g.fillText('✈️', 0, 0); g.restore();
      if (left) left.textContent = Math.max(0, Math.round(km * (1 - e))).toLocaleString('fr-FR') + ' km';
      if (k < 1 || now - t0 < D + 1500) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
  }
  function end() {
    if (!root) return; cancelAnimationFrame(raf); timers.forEach(t => { clearTimeout(t); clearInterval(t); }); timers = [];
    const r = root; root = null; r.classList.add('fl-out'); document.body.classList.remove('fl-on'); setTimeout(() => r.remove(), 900);
  }
  // au chargement du chat : on part si on vient de s'inscrire ou de se connecter
  function maybe() {
    let go = false; try { go = sessionStorage.getItem('lc_flight') === '1'; sessionStorage.removeItem('lc_flight'); } catch (e) {}
    const q = new URLSearchParams(location.search); if (q.get('vol') === '1') { go = true; q.delete('vol'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '')); }
    if (!go || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const wait = () => (state.me ? play() : setTimeout(wait, 300)); setTimeout(wait, 600);
  }
  maybe();
  return { play: () => { done = false; play(); }, end };
})();
window.Flight = Flight;
