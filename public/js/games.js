// The Paradise — section mini-jeux (solo, à deux en direct, contre l'ordinateur)
const GAME_LIST = {
  solo: [
    { id: 'serpent', icon: '🐍', name: 'Serpent', desc: 'Mange les fruits sans te mordre la queue', unit: 'pts', order: 'higher' },
    { id: 'demineur', icon: '💣', name: 'Démineur', desc: 'Découvre toutes les cases sans mine', unit: 's', order: 'lower' },
    { id: 'memory', icon: '🃏', name: 'Memory', desc: 'Retrouve les paires en un minimum de coups', unit: 'coups', order: 'lower' },
    { id: 'pendu', icon: '🔤', name: 'Pendu', desc: 'Devine les mots lettre par lettre', unit: 'mots', order: 'higher' },
    { id: 'taquin', icon: '🧩', name: 'Taquin', desc: 'Remets les chiffres dans l\'ordre', unit: 'coups', order: 'lower' },
    { id: 'reflexes', icon: '⚡', name: 'Réflexes', desc: 'Clique dès que l\'écran devient vert', unit: 'ms', order: 'lower' },
    { id: 'cache', icon: '🔍', name: 'Objets cachés', desc: 'Retrouve tous les objets cachés dans la scène', unit: 's', order: 'lower' },
    { id: 'quiz', icon: '🧠', name: 'Quiz', desc: '10 questions de culture générale', unit: 'pts', order: 'higher' },
    { id: 'bowling', icon: '🎳', name: 'Bowling', desc: '5 manches : glisse pour lancer la boule et fais des strikes', unit: 'pts', order: 'higher' },
    { id: 'billard', icon: '🎱', name: 'Billard', desc: 'Rentre les 10 boules en un minimum de coups', unit: 'coups', order: 'lower' },
  ],
  multi: [
    { id: 'morpion', icon: '⭕', name: 'Morpion', desc: 'Aligne 3 symboles avant l\'autre', bot: true },
    { id: 'quatre', icon: '🔴', name: '4 alignés', desc: 'Aligne 4 jetons à la verticale, l\'horizontale ou en diagonale', bot: true },
    { id: 'chifoumi', icon: '✊', name: 'Chifoumi', desc: 'Pierre, feuille, ciseaux : 3 manches gagnantes', bot: true },
    { id: 'frappe', icon: '⌨️', name: 'Course de frappe', desc: 'Le premier à recopier la phrase gagne', bot: true },
    { id: 'quizduel', icon: '🏆', name: 'Quiz duel', desc: '7 questions : réponds juste et vite' },
  ],
};
const gameInfo = id => [...GAME_LIST.solo, ...GAME_LIST.multi].find(g => g.id === id);

// ---------- Fenêtre des jeux ----------
const Hub = {
  el: null, body: null, cleanups: [], tab: 'solo', myScores: {},
  open(tab) {
    if (!this.el) {
      this.body = el('div', { class: 'gh-body' });
      this.el = el('div', { class: 'games-hub' },
        el('div', { class: 'gh-card' },
          el('div', { class: 'gh-head' }, el('h2', {}, '🎮 Mini-jeux'), el('button', { class: 'btn btn-icon', title: 'Fermer', onclick: () => this.close() }, '✕')),
          this.body));
      document.body.append(this.el);
    }
    this.el.classList.remove('hidden');
    document.body.classList.add('hub-open');
    if (tab) this.tab = tab;
    if (!Match.active) this.home();
  },
  close() {
    if (Match.active && !Match.over && !Match.bot) { if (!confirm('Quitter la partie ? Tu vas perdre.')) return; Match.leave(); }
    this.stop();
    Match.reset();
    this.el?.classList.add('hidden');
    document.body.classList.remove('hub-open');
    if (location.hash === '#jeux') history.replaceState(null, '', location.pathname);
  },
  stop() { this.cleanups.splice(0).forEach(fn => { try { fn(); } catch (e) {} }); },
  // La liste s'affiche tout de suite ; les records arrivent ensuite
  home() {
    this.renderHome();
    api('/api/games/me').then(d => {
      this.myScores = d.scores;
      if (!Match.active && this.body.querySelector('.game-grid')) this.renderHome();
    }).catch(() => {});
  },
  renderHome() {
    this.stop();
    const tabs = [['solo', '🎯 Solo'], ['multi', '👥 À deux'], ['top', '🏆 Classements']];
    const content = el('div', { class: 'gh-content' });
    this.body.replaceChildren(
      el('div', { class: 'tabs' }, ...tabs.map(([k, l]) => el('button', { class: this.tab === k ? 'active' : '', onclick: () => { this.tab = k; this.home(); } }, l))),
      content);
    if (this.tab === 'top') { if (!content.childNodes.length) this.leaderboard(content); return; }
    const list = GAME_LIST[this.tab];
    content.append(el('div', { class: 'game-grid' }, ...list.map(g => {
      const sc = this.myScores[g.id];
      const stat = this.tab === 'solo'
        ? (sc?.best != null ? `🏅 Record : ${sc.best} ${g.unit}` : 'Pas encore joué')
        : (sc ? `🏅 ${sc.wins} V · ${sc.losses} D · ${sc.draws} N` : 'Pas encore joué');
      return el('button', { class: 'game-card', onclick: () => (this.tab === 'solo' ? Solo.start(g.id) : chooseOpponent(g)) },
        el('span', { class: 'gc-ico' }, g.icon), el('b', {}, g.name), el('small', {}, g.desc), el('span', { class: 'gc-stat' }, stat));
    })));
  },
  async leaderboard(box, game = 'serpent') {
    const all = [...GAME_LIST.solo, ...GAME_LIST.multi];
    const table = el('div', {});
    const chips = el('div', { class: 'choice-row', style: 'margin-bottom:12px' });
    const draw = async g => {
      chips.replaceChildren(...all.map(x => el('button', { class: 'choice' + (x.id === g ? ' active' : ''), onclick: () => draw(x.id) }, `${x.icon} ${x.name}`)));
      table.replaceChildren(el('p', { class: 'empty' }, 'Chargement…'));
      try {
        const { rows } = await api('/api/games/leaderboard?game=' + g);
        const info = gameInfo(g);
        const solo = !!info.unit;
        table.replaceChildren(rows.length ? el('div', { class: 'lb' }, ...rows.map((r, i) => el('div', { class: 'lb-row' + (r.userId === state.me.id ? ' me' : '') },
          el('span', { class: 'lb-rank' }, ['🥇', '🥈', '🥉'][i] || i + 1), el('b', {}, r.username),
          el('span', { class: 'lb-score' }, solo ? `${r.best} ${info.unit}` : `${r.wins} victoire${r.wins > 1 ? 's' : ''} · ${r.losses} défaite${r.losses > 1 ? 's' : ''}`))))
          : el('p', { class: 'empty' }, 'Personne n\'a encore joué à ce jeu. Sois le premier !'));
      } catch (e) { table.replaceChildren(el('p', { class: 'empty' }, e.message)); }
    };
    box.append(chips, table);
    draw(game);
  },
  // Écran d'un jeu : barre du haut + zone de jeu
  screen(title, { onBack } = {}) {
    this.stop();
    const info = el('span', { class: 'gh-info' });
    const area = el('div', { class: 'game-area' });
    this.body.replaceChildren(
      el('div', { class: 'gh-bar' }, el('button', { class: 'btn btn-sm', onclick: onBack || (() => this.home()) }, '← Jeux'), el('b', {}, title), info),
      area);
    return { area, info };
  },
};
$('gamesBtn').onclick = () => Hub.open();
$('gamesLink').onclick = () => { closeDrawers(); Hub.open(); };
if (location.hash === '#jeux') setTimeout(() => Hub.open(), 600);

// ---------- Jeux solo ----------
const Solo = {
  start(id) {
    const g = gameInfo(id);
    const { area, info } = Hub.screen(`${g.icon} ${g.name}`);
    const end = async (score, text) => {
      let rec = null;
      if (score !== null && score !== undefined) { try { rec = await api('/api/games/score', { method: 'POST', body: { game: id, score } }); } catch (e) {} }
      const over = el('div', { class: 'game-over' },
        el('div', { class: 'go-ico' }, rec?.record ? '🏆' : score === null ? '😵' : '🎉'),
        el('h3', {}, text || 'Partie terminée'),
        score !== null && score !== undefined ? el('p', {}, `Score : ${score} ${g.unit}${rec ? ` · Record : ${rec.best} ${g.unit}` : ''}`) : null,
        rec?.record ? el('p', { class: 'go-rec' }, '✨ Nouveau record personnel !') : null,
        rec?.gain ? el('p', { class: 'go-gain' }, `+${rec.gain} 💰 gagnées !`) : rec ? el('p', { class: 'help' }, '💰 Plus de pièces pour ce jeu aujourd\'hui (8 parties payées par jour)') : null,
        el('div', { class: 'actions' },
          el('button', { class: 'btn btn-primary', onclick: () => Solo.start(id) }, '🔁 Rejouer'),
          el('button', { class: 'btn', onclick: () => Hub.home() }, 'Autres jeux')));
      if (rec?.record) LC.confetti(['🏆', '⭐']);
      area.append(over);
    };
    SOLO_GAMES[id](area, { info: t => { info.textContent = t; }, end, onCleanup: fn => Hub.cleanups.push(fn) });
  },
};

const rand = n => Math.floor(Math.random() * n);
const SOLO_GAMES = {
  // 🎳 Bowling : 5 manches, glisse vers le haut pour lancer la boule (le côté où tu touches place la boule)
  bowling(area, g) {
    const W = 300, H = 560, LX0 = 40, LX1 = 260, k = Math.min(1, ((area.clientWidth || 340) - 10) / W, (innerHeight - 250) / H);
    const cv = el('canvas', { class: 'phys-cv', width: W * 2, height: H * 2, style: `width:${W * k}px;height:${H * k}px` });
    const ctx = cv.getContext('2d'); ctx.scale(2, 2);
    const board = el('div', { class: 'bowl-board' });
    area.append(board, cv, el('p', { class: 'help', style: 'text-align:center' }, '👆 Pose ton doigt sur la piste (là où tu veux placer la boule), puis glisse vers le haut. Plus tu glisses vite, plus elle va fort !'));
    const FRAMES = 5, rolls = [];
    let frame = 0, roll = 0, pins = [], ball = null, rolling = false, raf = 0, startAt = 0, drag = null, msg = '', msgAt = 0;
    const rack = () => { pins = []; for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) pins.push({ x: 150 + (i - r / 2) * 26, y: 150 - r * 26, ox: 150 + (i - r / 2) * 26, oy: 150 - r * 26, vx: 0, vy: 0, r: 9, m: 1, down: false, a: 0 }); };
    const newBall = () => { ball = { x: 150, y: 505, vx: 0, vy: 0, r: 14, m: 5, gutter: false }; };
    rack(); newBall();
    // le score officiel du bowling (strike = 10 + 2 lancers suivants, spare = 10 + 1 lancer suivant)
    function score() {
      let s = 0, i = 0; const out = [];
      for (let f = 0; f < FRAMES; f++) {
        if (rolls[i] === undefined) { out.push(null); continue; }
        if (f === FRAMES - 1) { s += (rolls[i] || 0) + (rolls[i + 1] || 0) + (rolls[i + 2] || 0); out.push(s); break; }
        if (rolls[i] === 10) { if (rolls[i + 2] === undefined) { out.push(null); i++; continue; } s += 10 + rolls[i + 1] + rolls[i + 2]; out.push(s); i++; }
        else { if (rolls[i + 1] === undefined) { out.push(null); i += 2; continue; } if (rolls[i] + rolls[i + 1] === 10) { if (rolls[i + 2] === undefined) { out.push(null); i += 2; continue; } s += 10 + rolls[i + 2]; } else s += rolls[i] + rolls[i + 1]; out.push(s); i += 2; }
      }
      return { total: s, out };
    }
    function drawBoard() {
      const sc = score(); let i = 0; const cells = [];
      for (let f = 0; f < FRAMES; f++) {
        const a = rolls[i], b = rolls[i + 1], c = rolls[i + 2];
        let t;
        if (f === FRAMES - 1) { t = [a, b, c].filter(v => v !== undefined).map((v, j, arr) => (v === 10 ? 'X' : j > 0 && arr[j - 1] !== 10 && arr[j - 1] + v === 10 ? '/' : v === 0 ? '-' : v)).join(' '); }
        else if (a === 10) { t = 'X'; i += 1; } else { t = [a, b].filter(v => v !== undefined).map((v, j) => (j === 1 && a + v === 10 ? '/' : v === 0 ? '-' : v)).join(' '); i += 2; }
        cells.push(el('div', { class: 'bowl-cell' + (f === frame ? ' on' : '') }, el('small', {}, f + 1), el('b', {}, t || ' '), el('em', {}, sc.out[f] ?? '')));
      }
      board.replaceChildren(...cells, el('div', { class: 'bowl-cell total' }, el('small', {}, 'Total'), el('b', {}, sc.total)));
      g.info(`Manche ${Math.min(frame + 1, FRAMES)}/${FRAMES} · lancer ${roll + 1}`);
    }
    drawBoard();
    function collide(a, b) {
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
      if (!d || d >= min) return;
      const nx = dx / d, ny = dy / d, over = min - d, tm = a.m + b.m;
      a.x -= nx * over * b.m / tm; a.y -= ny * over * b.m / tm; b.x += nx * over * a.m / tm; b.y += ny * over * a.m / tm;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; if (rel <= 0) return;
      const j = 2 * rel / tm * .92;
      a.vx -= j * b.m * nx; a.vy -= j * b.m * ny; b.vx += j * a.m * nx; b.vy += j * a.m * ny;
      // une quille touchée tombe
      if (b.m === 1 && !b.down && Math.hypot(b.vx, b.vy) > 40) b.down = true;
      if (a.m === 1 && !a.down && Math.hypot(a.vx, a.vy) > 40) a.down = true;
    }
    function step(dt) {
      const all = [ball, ...pins.filter(p => !p.gone)];
      for (const o of all) {
        o.x += o.vx * dt; o.y += o.vy * dt;
        const f = o === ball ? .15 : 2.2; o.vx *= Math.max(0, 1 - f * dt); o.vy *= Math.max(0, 1 - f * dt);
        if (o !== ball) { if (o.down) o.a = Math.min(1, o.a + dt * 4); if (o.x < LX0 - 4 || o.x > LX1 + 4 || o.y < 20) { o.down = true; o.gone = true; } }
      }
      if (!ball.gutter && (ball.x < LX0 + ball.r - 6 || ball.x > LX1 - ball.r + 6)) { ball.gutter = true; ball.x = ball.x < 150 ? LX0 - 14 : LX1 + 14; ball.vx = 0; }
      if (!ball.gutter) for (const p of pins) if (!p.gone) collide(ball, p);
      for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) if (!pins[i].gone && !pins[j].gone) collide(pins[i], pins[j]);
      for (const p of pins) if (!p.gone && !p.down && Math.hypot(p.x - p.ox, p.y - p.oy) > 7) p.down = true;
    }
    function settle() {
      rolling = false;
      const fell = pins.filter(p => p.down && !p.counted).length;
      pins.forEach(p => { if (p.down) p.counted = true; });
      rolls.push(fell);
      const standing = pins.filter(p => !p.down).length;
      const last = frame === FRAMES - 1;
      msg = fell === 10 && roll === 0 ? '🎳 STRIKE !' : standing === 0 ? '✨ SPARE !' : fell === 0 ? (ball.gutter ? '😬 Dans la rigole…' : '😅 Raté !') : `${fell} quille${fell > 1 ? 's' : ''}`;
      msgAt = performance.now();
      if (fell === 10 && roll === 0) LC.confetti(['🎳', '💥', '⭐']);
      let nextFrame = false, reset = false;
      if (!last) { if (roll === 0 && standing > 0) roll = 1; else { nextFrame = true; reset = true; } }
      else {
        const fr = rolls.slice(rolls.length - roll - 1);
        if (roll === 0) { roll = 1; if (standing === 0) reset = true; }
        else if (roll === 1) { if (fr[0] === 10 || fr[0] + fr[1] === 10) { roll = 2; if (standing === 0) reset = true; } else nextFrame = true; }
        else nextFrame = true;
      }
      if (nextFrame) { frame++; roll = 0; reset = true; }
      setTimeout(() => {
        if (frame >= FRAMES) { drawBoard(); return g.end(score().total, score().total >= 100 ? '🎳 Champion du bowling !' : 'Partie terminée'); }
        if (reset) rack(); else pins = pins.filter(p => !p.down);
        newBall(); drawBoard();
      }, 900);
      drawBoard();
    }
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H, t: performance.now() }; };
    cv.addEventListener('pointerdown', e => { if (rolling || frame >= FRAMES) return; const p = pos(e); if (p.y < 300) return; drag = { a: p, b: p }; ball.x = Math.max(LX0 + 16, Math.min(LX1 - 16, p.x)); cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (!drag) return; drag.b = pos(e); if (drag.b.y > 380) ball.x = Math.max(LX0 + 16, Math.min(LX1 - 16, drag.b.x)); });
    cv.addEventListener('pointerup', e => {
      if (!drag) return; const a = drag.a, b = pos(e); drag = null;
      const dy = b.y - a.y, dx = b.x - a.x, dt = Math.max(60, b.t - a.t);
      if (dy > -30) return;
      const sp = Math.min(900, Math.max(260, -dy / dt * 1000 * .9));
      const ang = Math.atan2(dx, -dy); const lim = Math.max(-.35, Math.min(.35, ang));
      ball.vx = Math.sin(lim) * sp; ball.vy = -Math.cos(lim) * sp; rolling = true; startAt = performance.now();
    });
    let lastT = 0;
    function draw(ts) {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(.033, (ts - lastT) / 1000 || 0); lastT = ts;
      if (rolling) { for (let i = 0; i < 4; i++) step(dt / 4); const moving = [ball, ...pins.filter(p => !p.gone)].some(o => Math.hypot(o.vx, o.vy) > 8); if ((ball.y < -20 || !moving) && (performance.now() - startAt > 900) && !pins.some(p => !p.gone && Math.hypot(p.vx, p.vy) > 8) || performance.now() - startAt > 6000) settle(); }
      // la piste en bois
      ctx.fillStyle = '#1a1030'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#2b2440'; ctx.fillRect(LX0 - 26, 0, 26, H); ctx.fillRect(LX1, 0, 26, H);
      const wood = ctx.createLinearGradient(LX0, 0, LX1, 0); wood.addColorStop(0, '#d9a066'); wood.addColorStop(.5, '#f0c58e'); wood.addColorStop(1, '#d9a066');
      ctx.fillStyle = wood; ctx.fillRect(LX0, 0, LX1 - LX0, H);
      ctx.strokeStyle = 'rgba(120,70,30,.25)'; for (let x = LX0; x < LX1; x += 11) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      ctx.fillStyle = '#7a3ccf'; for (let i = 0; i < 7; i++) { const x = LX0 + 25 + i * 28.5; ctx.beginPath(); ctx.moveTo(x, 360); ctx.lineTo(x - 5, 372); ctx.lineTo(x + 5, 372); ctx.fill(); }
      ctx.strokeStyle = '#ff2d55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(LX0, 470); ctx.lineTo(LX1, 470); ctx.stroke();
      // les quilles (couchées quand elles tombent)
      for (const p of pins) { if (p.gone) continue; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a * 1.4); ctx.globalAlpha = p.down ? .75 : 1;
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(2, 3, 9, 9, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.strokeStyle = '#ff2d55'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); ctx.stroke(); ctx.restore(); }
      // la boule
      if (drag) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(ball.x + (drag.b.x - drag.a.x) * 2, ball.y + (drag.b.y - drag.a.y) * 2); ctx.stroke(); ctx.setLineDash([]); }
      const bg = ctx.createRadialGradient(ball.x - 5, ball.y - 5, 2, ball.x, ball.y, ball.r); bg.addColorStop(0, '#8fd0ff'); bg.addColorStop(1, '#1f4fd6');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#0b1440'; for (const [a, b] of [[-3, -5], [3, -5], [0, 1]]) { ctx.beginPath(); ctx.arc(ball.x + a, ball.y + b, 2, 0, 7); ctx.fill(); }
      if (msg && ts - msgAt < 1500) { ctx.font = '900 30px Outfit, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#7a3ccf'; ctx.lineWidth = 6; ctx.strokeText(msg, W / 2, 270); ctx.fillText(msg, W / 2, 270); }
    }
    raf = requestAnimationFrame(draw);
    g.onCleanup(() => cancelAnimationFrame(raf));
  },

  // 🎱 Billard : vide la table en un minimum de coups (tire en arrière depuis la boule blanche, comme un lance-pierre)
  billard(area, g) {
    const W = 600, H = 330, X0 = 22, X1 = 578, Y0 = 22, Y1 = 308, R = 9, PR = 17;
    const k = Math.min(1, ((area.clientWidth || 360) - 6) / W);
    const cv = el('canvas', { class: 'phys-cv', width: W * 2, height: H * 2, style: `width:${W * k}px;height:${H * k}px` });
    const ctx = cv.getContext('2d'); ctx.scale(2, 2);
    area.append(cv, el('p', { class: 'help', style: 'text-align:center' }, '👆 Touche la table et tire en arrière (comme un lance-pierre) : la boule blanche part dans l\'autre sens. Plus tu tires loin, plus c\'est fort. Rentre toutes les boules en un minimum de coups !'));
    const POCKETS = [[X0, Y0], [W / 2, Y0 - 4], [X1, Y0], [X0, Y1], [W / 2, Y1 + 4], [X1, Y1]];
    const COLORS = ['#ffd34d', '#2f6fd6', '#ff2d55', '#8b5cf6', '#ff8a1f', '#2bd07a', '#8a1f2b', '#1c1c24', '#ffd34d', '#2f6fd6'];
    const balls = [{ x: 150, y: H / 2, vx: 0, vy: 0, cue: true }];
    let n = 0; for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) balls.push({ x: 420 + r * 16.2, y: H / 2 + (i - r / 2) * 18.6, vx: 0, vy: 0, c: COLORS[n], num: ++n, stripe: n > 7 });
    let shots = 0, moving = false, aim = null, raf = 0, potted = 0, msg = '', msgAt = 0, scratched = false;
    const cue = () => balls.find(b => b.cue);
    const info = () => g.info(`🎱 ${10 - potted} boule${10 - potted > 1 ? 's' : ''} sur la table · ${shots} coup${shots > 1 ? 's' : ''}`);
    info();
    function step(dt) {
      for (const b of balls) {
        if (b.in) continue;
        b.x += b.vx * dt; b.y += b.vy * dt;
        const sp = Math.hypot(b.vx, b.vy); if (sp > 0) { const ns = Math.max(0, sp - 120 * dt); b.vx *= ns / sp; b.vy *= ns / sp; }
        for (const [px, py] of POCKETS) if (Math.hypot(b.x - px, b.y - py) < PR) { b.in = true; b.vx = b.vy = 0; if (b.cue) scratched = true; else { potted++; msg = `🎱 Boule ${b.num} rentrée !`; msgAt = performance.now(); } }
        if (b.in) continue;
        if (b.x < X0 + R) { b.x = X0 + R; b.vx = Math.abs(b.vx) * .85; } if (b.x > X1 - R) { b.x = X1 - R; b.vx = -Math.abs(b.vx) * .85; }
        if (b.y < Y0 + R) { b.y = Y0 + R; b.vy = Math.abs(b.vy) * .85; } if (b.y > Y1 - R) { b.y = Y1 - R; b.vy = -Math.abs(b.vy) * .85; }
      }
      for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j]; if (a.in || b.in) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (!d || d >= 2 * R) continue;
        const nx = dx / d, ny = dy / d, o = (2 * R - d) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; if (rel <= 0) continue;
        const j2 = rel * .96; a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny;
      }
    }
    function stopped() {
      moving = false;
      if (scratched) { scratched = false; shots++; msg = '😬 Blanche rentrée : +1 coup de pénalité'; msgAt = performance.now(); const c = cue(); c.in = false; c.x = 150; c.y = H / 2; while (balls.some(b => b !== c && !b.in && Math.hypot(b.x - c.x, b.y - c.y) < 2 * R + 1)) c.y += 4; }
      info();
      if (potted >= 10) { LC.confetti(['🎱', '🏆', '✨']); setTimeout(() => g.end(shots, shots <= 12 ? '🎱 Un vrai pro du billard !' : 'Table vidée !'), 600); }
    }
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
    cv.addEventListener('pointerdown', e => { if (moving || potted >= 10) return; aim = { a: pos(e), b: pos(e) }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (aim) aim.b = pos(e); });
    cv.addEventListener('pointerup', () => {
      if (!aim) return; const c = cue(); const dx = aim.a.x - aim.b.x, dy = aim.a.y - aim.b.y, d = Math.hypot(dx, dy); aim = null;
      if (d < 8) return;
      const p = Math.min(d, 160) / 160, sp = 120 + p * 980;
      c.vx = dx / d * sp; c.vy = dy / d * sp; shots++; moving = true; info();
    });
    let lastT = 0;
    function draw(ts) {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(.033, (ts - lastT) / 1000 || 0); lastT = ts;
      if (moving) { for (let i = 0; i < 6; i++) step(dt / 6); if (!balls.some(b => !b.in && Math.hypot(b.vx, b.vy) > 4)) { balls.forEach(b => { b.vx = b.vy = 0; }); stopped(); } }
      ctx.fillStyle = '#5a3417'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#7a4a22'; ctx.fillRect(6, 6, W - 12, H - 12);
      const felt = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W / 2); felt.addColorStop(0, '#1fa463'); felt.addColorStop(1, '#0e6b3d');
      ctx.fillStyle = felt; ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(150, Y0); ctx.lineTo(150, Y1); ctx.stroke();
      ctx.fillStyle = '#fff'; for (const x of [150, 300, 450]) for (const y of [10, H - 10]) { ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); }
      for (const [px, py] of POCKETS) { ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(px, py, PR - 2, 0, 7); ctx.fill(); }
      for (const b of balls) {
        if (b.in) continue;
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(b.x + 2, b.y + 2, R, 0, 7); ctx.fill();
        ctx.fillStyle = b.cue ? '#fffef4' : b.stripe ? '#fff' : b.c; ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, 7); ctx.fill();
        if (b.stripe) { ctx.save(); ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, 7); ctx.clip(); ctx.fillStyle = b.c; ctx.fillRect(b.x - R, b.y - 4.5, 2 * R, 9); ctx.restore(); }
        if (!b.cue) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, 4.2, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.font = '800 6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.num, b.x, b.y + .3); }
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(b.x - 3, b.y - 3, 2.2, 0, 7); ctx.fill();
      }
      const c = cue();
      if (aim && c && !c.in) {
        const dx = aim.a.x - aim.b.x, dy = aim.a.y - aim.b.y, d = Math.hypot(dx, dy);
        if (d > 4) {
          const ux = dx / d, uy = dy / d, p = Math.min(d, 160) / 160;
          ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.setLineDash([5, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + ux * 420, c.y + uy * 420); ctx.stroke(); ctx.setLineDash([]);
          // la queue de billard
          ctx.strokeStyle = '#e8c08a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c.x - ux * (14 + p * 40), c.y - uy * (14 + p * 40)); ctx.lineTo(c.x - ux * (200 + p * 40), c.y - uy * (200 + p * 40)); ctx.stroke();
          ctx.fillStyle = `hsl(${120 - p * 120},90%,55%)`; ctx.fillRect(X0 + 10, Y1 - 14, 120 * p, 6);
        }
      }
      if (msg && ts - msgAt < 1400) { ctx.font = '900 20px Outfit, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 5; ctx.strokeStyle = '#0e3b22'; ctx.strokeText(msg, W / 2, H / 2); ctx.fillStyle = '#fff'; ctx.fillText(msg, W / 2, H / 2); }
    }
    raf = requestAnimationFrame(draw);
    g.onCleanup(() => cancelAnimationFrame(raf));
  },
  // 🐍 Serpent
  serpent(area, g) {
    const N = 18;
    const size = Math.min(area.clientWidth || 360, 440, innerHeight - 260);
    const cv = el('canvas', { class: 'snake-cv', width: N * 20, height: N * 20, style: `width:${size}px;height:${size}px` });
    const ctx = cv.getContext('2d');
    let snake = [[9, 9], [8, 9], [7, 9]], dir = [1, 0], next = [1, 0], fruit = null, score = 0, speed = 140, dead = false;
    const fruits = ['🍎', '🍓', '🍒', '🍇', '🍑', '🍌'];
    let fruitIcon = fruits[0];
    const place = () => { do { fruit = [rand(N), rand(N)]; } while (snake.some(([x, y]) => x === fruit[0] && y === fruit[1])); fruitIcon = fruits[rand(fruits.length)]; };
    place();
    const css = getComputedStyle(document.documentElement);
    const draw = () => {
      ctx.fillStyle = css.getPropertyValue('--bg-2'); ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.font = '17px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(fruitIcon, fruit[0] * 20 + 10, fruit[1] * 20 + 11);
      snake.forEach(([x, y], i) => { ctx.fillStyle = i === 0 ? css.getPropertyValue('--rose') : css.getPropertyValue('--violet'); ctx.beginPath(); ctx.roundRect(x * 20 + 1, y * 20 + 1, 18, 18, 6); ctx.fill(); });
    };
    const turn = d => { if (d[0] !== -dir[0] || d[1] !== -dir[1]) next = d; };
    const step = () => {
      if (dead) return;
      dir = next;
      const head = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
      if (head[0] < 0 || head[1] < 0 || head[0] >= N || head[1] >= N || snake.some(([x, y]) => x === head[0] && y === head[1])) {
        dead = true; clearInterval(timer); return g.end(score, score >= 100 ? 'Bien joué !' : 'Aïe, perdu !');
      }
      snake.unshift(head);
      if (head[0] === fruit[0] && head[1] === fruit[1]) { score += 10; place(); if (speed > 70) { speed -= 4; clearInterval(timer); timer = setInterval(step, speed); } } else snake.pop();
      g.info(`🍎 ${score} pts`);
      draw();
    };
    let timer = setInterval(step, speed);
    const keys = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], z: [0, -1], s: [0, 1], q: [-1, 0], d: [1, 0], w: [0, -1], a: [-1, 0] };
    const onKey = e => { if (keys[e.key]) { e.preventDefault(); turn(keys[e.key]); } };
    document.addEventListener('keydown', onKey);
    let touch = null;
    cv.addEventListener('touchstart', e => { touch = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
    cv.addEventListener('touchmove', e => {
      if (!touch) return;
      const dx = e.touches[0].clientX - touch[0], dy = e.touches[0].clientY - touch[1];
      if (Math.abs(dx) + Math.abs(dy) < 24) return;
      turn(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]); touch = null;
    }, { passive: true });
    const pad = (l, d) => el('button', { class: 'pad-btn', onclick: () => turn(d) }, l);
    area.append(cv, el('div', { class: 'dpad' }, el('span'), pad('▲', [0, -1]), el('span'), pad('◀', [-1, 0]), pad('▼', [0, 1]), pad('▶', [1, 0])),
      el('p', { class: 'help center' }, 'Flèches du clavier, glisse le doigt sur la grille ou utilise les boutons.'));
    g.info('🍎 0 pts');
    draw();
    g.onCleanup(() => { clearInterval(timer); document.removeEventListener('keydown', onKey); });
  },

  // 💣 Démineur
  demineur(area, g) {
    const W = 9, H = 9, MINES = 10;
    let cells = [], started = false, over = false, flagMode = false, t0 = 0, revealed = 0;
    const grid = el('div', { class: 'mine-grid', style: `grid-template-columns:repeat(${W},1fr)` });
    const flagBtn = el('button', { class: 'btn btn-sm', onclick: () => { flagMode = !flagMode; flagBtn.classList.toggle('btn-primary', flagMode); flagBtn.textContent = flagMode ? '🚩 Mode drapeau : ON' : '🚩 Mode drapeau : OFF'; } }, '🚩 Mode drapeau : OFF');
    const timer = setInterval(() => { if (started && !over) g.info(`⏱️ ${Math.floor((Date.now() - t0) / 1000)} s · 🚩 ${MINES - cells.filter(c => c.flag).length}`); }, 500);
    g.onCleanup(() => clearInterval(timer));
    const around = i => { const x = i % W, y = Math.floor(i / W), out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if ((dx || dy) && nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(ny * W + nx); } return out; };
    const plant = safe => {
      const forbidden = new Set([safe, ...around(safe)]);
      let n = 0;
      while (n < MINES) { const i = rand(W * H); if (!cells[i].mine && !forbidden.has(i)) { cells[i].mine = true; n++; } }
      cells.forEach((c, i) => { c.n = around(i).filter(j => cells[j].mine).length; });
    };
    const colors = ['', '#4fb3ff', '#33d6a6', '#ff5a6e', '#8b6cff', '#ff7a18', '#00bcd4', '#ffd23f', '#aaa'];
    const paint = () => cells.forEach((c, i) => {
      const b = c.btn;
      b.className = 'mine-cell' + (c.open ? ' open' : '') + (c.open && c.mine ? ' boom' : '');
      b.textContent = c.open ? (c.mine ? '💣' : c.n || '') : c.flag ? '🚩' : '';
      b.style.color = colors[c.n] || '';
    });
    const open = i => {
      const c = cells[i];
      if (c.open || c.flag) return;
      c.open = true; revealed++;
      if (c.mine) return;
      if (c.n === 0) around(i).forEach(open);
    };
    const click = (i, flag) => {
      if (over) return;
      const c = cells[i];
      if (flag || flagMode) { if (!c.open) c.flag = !c.flag; paint(); return; }
      if (!started) { started = true; t0 = Date.now(); plant(i); }
      if (c.flag) return;
      open(i);
      if (c.mine) {
        over = true; cells.forEach(x => { if (x.mine) x.open = true; }); paint();
        return g.end(null, '💥 Boum ! Tu as touché une mine');
      }
      paint();
      if (revealed === W * H - MINES) { over = true; const s = Math.round((Date.now() - t0) / 1000); LC.confetti(); g.end(s, `Bravo, terrain déminé en ${s} s !`); }
    };
    for (let i = 0; i < W * H; i++) {
      const btn = el('button', { class: 'mine-cell' });
      let press = null, long = false;
      btn.addEventListener('contextmenu', e => { e.preventDefault(); click(i, true); });
      btn.addEventListener('touchstart', () => { long = false; press = setTimeout(() => { long = true; click(i, true); navigator.vibrate?.(30); }, 450); }, { passive: true });
      btn.addEventListener('touchend', () => clearTimeout(press));
      btn.addEventListener('click', () => { if (long) { long = false; return; } click(i, false); });
      cells.push({ btn, mine: false, open: false, flag: false, n: 0 });
      grid.append(btn);
    }
    g.info(`💣 ${MINES} mines`);
    area.append(grid, el('div', { class: 'center', style: 'margin-top:12px' }, flagBtn),
      el('p', { class: 'help center' }, 'Clic droit ou appui long pour poser un drapeau.'));
  },

  // 🃏 Memory
  memory(area, g) {
    const pool = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦄', '🐙', '🦋', '🍕', '🍩', '⚽', '🎸'];
    const icons = pool.sort(() => Math.random() - .5).slice(0, 8);
    const deck = [...icons, ...icons].sort(() => Math.random() - .5).map(v => ({ v, open: false, done: false }));
    let first = null, lock = false, moves = 0, found = 0;
    const grid = el('div', { class: 'memory-grid' });
    deck.forEach(c => {
      c.btn = el('button', { class: 'mem-card' }, el('span', { class: 'mem-front' }, c.v), el('span', { class: 'mem-back' }, '✨'));
      c.btn.onclick = () => {
        if (lock || c.open || c.done) return;
        c.open = true; c.btn.classList.add('flip');
        if (!first) { first = c; return; }
        moves++; g.info(`🔁 ${moves} coups · ${found}/8 paires`);
        if (first.v === c.v) {
          first.done = c.done = true; first.btn.classList.add('done'); c.btn.classList.add('done'); first = null; found++;
          g.info(`🔁 ${moves} coups · ${found}/8 paires`);
          if (found === 8) { LC.confetti(); g.end(moves, `Toutes les paires en ${moves} coups !`); }
        } else {
          lock = true;
          const a = first; first = null;
          setTimeout(() => { a.open = c.open = false; a.btn.classList.remove('flip'); c.btn.classList.remove('flip'); lock = false; }, 550);
        }
      };
      grid.append(c.btn);
    });
    g.info('🔁 0 coup · 0/8 paires');
    area.append(grid);
  },

  // 🔤 Pendu (score = mots trouvés d'affilée)
  pendu(area, g) {
    const WORDS = ['PARADIS', 'SOLEIL', 'GUITARE', 'CHOCOLAT', 'PAPILLON', 'MONTAGNE', 'ORDINATEUR', 'VACANCES', 'FROMAGE', 'DAUPHIN', 'BALEINE', 'ETOILE', 'PLANETE',
      'MUSIQUE', 'TELEPHONE', 'CROISSANT', 'BICYCLETTE', 'GIRAFE', 'CHATEAU', 'DRAGON', 'PIRATE', 'TRESOR', 'VOLCAN', 'CHAMPION', 'AVENTURE', 'PRINTEMPS', 'HIVER',
      'CITROUILLE', 'SAPIN', 'CADEAU', 'NUAGE', 'TONNERRE', 'CAMION', 'FUSEE', 'ASTRONAUTE', 'JARDIN', 'TULIPE', 'BANANE', 'ANANAS', 'KANGOUROU', 'PINGOUIN',
      'ROBOT', 'MAGICIEN', 'SORCIERE', 'LICORNE', 'PIZZA', 'SALADE', 'CAPITAINE', 'FORET', 'RIVIERE', 'OCEAN', 'ECHARPE', 'LUNETTES', 'HORLOGE', 'BOUGIE'];
    let streak = 0;
    const word = el('div', { class: 'pendu-word' });
    const lives = el('div', { class: 'pendu-lives' });
    const kb = el('div', { class: 'pendu-kb' });
    const round = () => {
      const w = WORDS[rand(WORDS.length)];
      const tried = new Set();
      let errors = 0, done = false;
      const draw = () => {
        word.textContent = [...w].map(c => (tried.has(c) ? c : '_')).join(' ');
        lives.textContent = '❤️'.repeat(7 - errors) + '🖤'.repeat(errors);
        g.info(`🔥 ${streak} mot${streak > 1 ? 's' : ''} d'affilée`);
      };
      const guess = c => {
        if (done || tried.has(c)) return;
        tried.add(c);
        kb.querySelector(`[data-l="${c}"]`)?.classList.add(w.includes(c) ? 'good' : 'bad');
        if (!w.includes(c)) errors++;
        draw();
        if ([...w].every(x => tried.has(x))) { done = true; streak++; draw(); toast(`✅ Bravo, c'était ${w} !`); setTimeout(round, 500); }
        else if (errors >= 7) { done = true; word.textContent = [...w].join(' '); g.end(streak, `Le mot était ${w}`); }
      };
      kb.replaceChildren(...'AZERTYUIOPQSDFGHJKLMWXCVBN'.split('').map(c => el('button', { 'data-l': c, onclick: () => guess(c) }, c)));
      Hub.penduKey = e => { const c = e.key.toUpperCase(); if (/^[A-Z]$/.test(c)) guess(c); };
      draw();
    };
    const onKey = e => Hub.penduKey && Hub.penduKey(e);
    document.addEventListener('keydown', onKey);
    g.onCleanup(() => { document.removeEventListener('keydown', onKey); Hub.penduKey = null; });
    area.append(lives, word, kb);
    round();
  },

  // 🧩 Taquin 3×3
  taquin(area, g) {
    let tiles, moves = 0;
    const solvable = t => { let inv = 0; const a = t.filter(Boolean); for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) inv++; return inv % 2 === 0; };
    do { tiles = [1, 2, 3, 4, 5, 6, 7, 8, 0].sort(() => Math.random() - .5); } while (!solvable(tiles) || tiles.join() === '1,2,3,4,5,6,7,8,0');
    const grid = el('div', { class: 'taquin-grid' });
    const draw = () => {
      grid.replaceChildren(...tiles.map((v, i) => el('button', { class: 'taq-tile' + (v ? '' : ' empty'), onclick: () => move(i) }, v || '')));
      g.info(`🔁 ${moves} coups`);
    };
    const move = i => {
      const e = tiles.indexOf(0);
      const [x, y, ex, ey] = [i % 3, Math.floor(i / 3), e % 3, Math.floor(e / 3)];
      if (Math.abs(x - ex) + Math.abs(y - ey) !== 1) return;
      [tiles[i], tiles[e]] = [tiles[e], tiles[i]]; moves++; draw();
      if (tiles.join() === '1,2,3,4,5,6,7,8,0') { LC.confetti(); g.end(moves, `Résolu en ${moves} coups !`); }
    };
    draw();
    area.append(grid, el('p', { class: 'help center' }, 'Clique sur une case à côté de la case vide pour la déplacer.'));
  },

  // ⚡ Réflexes (moyenne de 5 essais)
  reflexes(area, g) {
    const times = [];
    let stateR = 'idle', t0 = 0, timer = null;
    const zone = el('button', { class: 'reflex-zone' }, 'Clique pour commencer');
    const go = () => {
      stateR = 'wait'; zone.className = 'reflex-zone wait'; zone.textContent = 'Attends le vert…';
      timer = setTimeout(() => { stateR = 'go'; zone.className = 'reflex-zone go'; zone.textContent = 'CLIQUE !'; t0 = performance.now(); }, 900 + Math.random() * 2100);
    };
    zone.onclick = () => {
      if (stateR === 'idle' || stateR === 'result') return go();
      if (stateR === 'wait') { clearTimeout(timer); stateR = 'result'; zone.className = 'reflex-zone early'; zone.textContent = 'Trop tôt ! 😅 Clique pour réessayer'; return; }
      if (stateR === 'go') {
        const ms = Math.round(performance.now() - t0);
        times.push(ms);
        g.info(`Essai ${times.length}/5 · ${ms} ms`);
        if (times.length >= 5) {
          stateR = 'done';
          const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
          zone.className = 'reflex-zone'; zone.textContent = `Moyenne : ${avg} ms`;
          return g.end(avg, avg < 250 ? 'Réflexes de ninja 🥷' : avg < 350 ? 'Très bons réflexes !' : 'Pas mal !');
        }
        stateR = 'result'; zone.className = 'reflex-zone'; zone.textContent = `${ms} ms — clique pour l'essai suivant`;
      }
    };
    g.onCleanup(() => clearTimeout(timer));
    g.info('Essai 0/5');
    area.append(zone);
  },

  // 🔍 Objets cachés : retrouve les 10 objets dans une scène pleine de bazar
  cache(area, g) {
    const SCENES = [
      { name: 'Le grenier', icon: '🏚️', sky: ['#4a2c17', '#2a160a'], floor: '#6b4423', pool: ['🧸', '📦', '🕯️', '🗝️', '📻', '🎻', '🪆', '🧶', '👒', '🕰️', '📚', '🎩', '🪞', '🧳', '🎈', '🪀', '🏺', '🔦', '🧦', '🪕', '🖼️', '🪑', '🧵', '📷'] },
      { name: 'La plage', icon: '🏖️', sky: ['#7fd3ff', '#bdf0ff'], floor: '#f1d9a3', pool: ['🐚', '🦀', '⭐', '🏐', '🩴', '🕶️', '🍦', '⛱️', '🪣', '🐠', '🌴', '🥥', '🧴', '👙', '🏄', '🐢', '🦩', '🍉', '⚓', '🪁', '🎣', '🦞', '🌺', '🍹'] },
      { name: 'La chambre', icon: '🛏️', sky: ['#ffd1e8', '#ffb6d5'], floor: '#c08a5a', pool: ['🧸', '💄', '👟', '🎧', '📱', '💍', '👗', '🎀', '🪥', '⏰', '📔', '🖍️', '🎮', '🕹️', '🧦', '👠', '💎', '🌸', '🍭', '🪮', '🎒', '📸', '🧁', '🪩'] },
      { name: 'La cuisine', icon: '🍳', sky: ['#fff3d6', '#ffe0a8'], floor: '#d9dde4', pool: ['🍳', '🥐', '🧀', '🍕', '🥕', '🍋', '🍓', '🥄', '🔪', '🧂', '🥚', '🍯', '🫖', '☕', '🍞', '🥑', '🍩', '🧇', '🥛', '🍪', '🫑', '🧅', '🍒', '🥨'] },
      { name: 'L\'espace', icon: '🚀', sky: ['#0b0b3a', '#2a0f48'], floor: '#1c1c2e', pool: ['🚀', '🛸', '🌍', '🌙', '⭐', '☄️', '🪐', '👽', '🛰️', '🔭', '👨‍🚀', '🌟', '💫', '🌌', '🤖', '📡', '🌞', '🧑‍🚀', '🌠', '🔋', '🧭', '🌑', '🛰', '🎆'] },
      { name: 'Le jardin', icon: '🌳', sky: ['#9fe0ff', '#d8f5c8'], floor: '#5fbf6a', pool: ['🌻', '🐝', '🐞', '🦋', '🐌', '🍄', '🌷', '🐸', '🪺', '🐿️', '🌹', '🪴', '🧺', '🍎', '🐛', '🌼', '🦔', '🐦', '🪨', '🍐', '🥕', '🪱', '🐇', '🌵'] },
    ];
    const sc = SCENES[rand(SCENES.length)];
    const mobile = (area.clientWidth || 360) < 600;
    const W = mobile ? 520 : 900, H = mobile ? 700 : 560, N = mobile ? 52 : 74, TARGETS = 10;
    const cv = el('canvas', { class: 'hid-cv', width: W * 2, height: H * 2 });
    const ctx = cv.getContext('2d'); ctx.scale(2, 2);
    // on place le bazar : les objets à trouver sont uniques, les autres peuvent se répéter
    const pool = sc.pool, targets = [...pool].sort(() => Math.random() - .5).slice(0, TARGETS);
    const decoys = pool.filter(e => !targets.includes(e));
    const items = [];
    const place = (e, isTarget) => {
      for (let k = 0; k < 40; k++) {
        const s = isTarget ? 26 + rand(12) : 22 + rand(26), x = 20 + Math.random() * (W - 40), y = 30 + Math.random() * (H - 50);
        if (isTarget && items.some(o => o.target && Math.hypot(o.x - x, o.y - y) < 55)) continue;
        items.push({ e, x, y, s, r: (Math.random() - .5) * 1.2, a: isTarget ? .82 + Math.random() * .18 : 1, target: isTarget, found: false });
        return;
      }
    };
    for (let i = 0; i < N - TARGETS; i++) place(decoys[rand(decoys.length)], false);
    targets.forEach(e => place(e, true));
    items.sort(() => Math.random() - .5); // les objets à trouver se cachent un peu sous les autres
    const stars = Array.from({ length: 40 }, () => [Math.random() * W, Math.random() * H, Math.random() * 1.5 + .5]);
    let start = performance.now(), penalty = 0, done = false, marks = [], hint = null, raf = 0;
    const chips = el('div', { class: 'hid-list' });
    const drawList = () => chips.replaceChildren(...targets.map(e => { const f = items.find(o => o.e === e && o.target).found; return el('span', { class: 'hid-chip' + (f ? ' ok' : '') }, e, f ? ' ✓' : ''); }));
    const bg = () => {
      ctx.fillStyle = (() => { const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, sc.sky[0]); gr.addColorStop(1, sc.sky[1]); return gr; })(); ctx.fillRect(0, 0, W, H);
      if (sc.name === 'L\'espace') { ctx.fillStyle = '#fff'; for (const [x, y, r] of stars) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); } }
      else { ctx.fillStyle = sc.floor; ctx.fillRect(0, H * .62, W, H * .38); ctx.fillStyle = 'rgba(0,0,0,.08)'; for (let x = 0; x < W; x += 60) ctx.fillRect(x, H * .62, 2, H * .38); }
      if (sc.name === 'La plage') { ctx.fillStyle = '#1fb7d6'; ctx.fillRect(0, H * .45, W, H * .17); }
      if (sc.name === 'Le grenier') { ctx.fillStyle = 'rgba(255,230,160,.12)'; ctx.beginPath(); ctx.moveTo(W * .6, 0); ctx.lineTo(W * .3, H); ctx.lineTo(W * .7, H); ctx.lineTo(W * .75, 0); ctx.fill(); }
    };
    const draw = now => {
      bg();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000000'; // couleur pleine : sinon les émojis prennent la transparence du décor
      for (const o of items) { if (o.found) continue; ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.r); ctx.globalAlpha = o.a; ctx.font = `${o.s}px "Noto Color Emoji", "Apple Color Emoji", sans-serif`; ctx.fillText(o.e, 0, 0); ctx.restore(); }
      // cercles des objets trouvés, croix des erreurs
      marks = marks.filter(m => now - m.at < (m.ok ? 900 : 700));
      for (const m of marks) { const k = (now - m.at) / (m.ok ? 900 : 700); ctx.globalAlpha = 1 - k; ctx.strokeStyle = m.ok ? '#2bff88' : '#ff2d55'; ctx.lineWidth = 4; ctx.beginPath(); if (m.ok) ctx.arc(m.x, m.y, 18 + k * 20, 0, 7); else { ctx.moveTo(m.x - 12, m.y - 12); ctx.lineTo(m.x + 12, m.y + 12); ctx.moveTo(m.x + 12, m.y - 12); ctx.lineTo(m.x - 12, m.y + 12); } ctx.stroke(); ctx.globalAlpha = 1; if (!m.ok) { ctx.fillStyle = '#ff2d55'; ctx.font = '900 16px Outfit, sans-serif'; ctx.fillText('+5 s', m.x, m.y - 26 - k * 10); } }
      if (hint && now - hint.at < 2200) { const k = (now - hint.at) / 2200; ctx.strokeStyle = `rgba(255,215,106,${1 - k})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(hint.x, hint.y, 70 - k * 40, 0, 7); ctx.stroke(); }
      if (!done) g.info(`${sc.icon} ${sc.name} · ${items.filter(o => o.target && o.found).length}/${TARGETS} · ⏱ ${Math.floor((now - start) / 1000) + penalty} s`);
      raf = requestAnimationFrame(draw);
    };
    cv.addEventListener('pointerdown', e => {
      if (done) return;
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H, now = performance.now();
      const hit = [...items].reverse().find(o => o.target && !o.found && Math.hypot(o.x - x, o.y - y) < o.s * .62 + 6);
      if (hit) {
        hit.found = true; marks.push({ x: hit.x, y: hit.y, ok: true, at: now }); drawList();
        if (items.every(o => !o.target || o.found)) {
          done = true; const secs = Math.floor((now - start) / 1000) + penalty;
          LC.confetti(['🔍', '⭐', '🎉']); setTimeout(() => g.end(secs, secs < 60 ? 'Œil de lynx ! 🐱' : secs < 120 ? 'Bravo, tout trouvé ! 🔍' : 'Tout trouvé !'), 600);
        }
      } else { penalty += 5; marks.push({ x, y, ok: false, at: now }); }
    });
    const hintBtn = el('button', { class: 'btn btn-sm', onclick: () => { const o = items.find(o => o.target && !o.found); if (!o || done) return; penalty += 15; hint = { x: o.x, y: o.y, at: performance.now() }; } }, '💡 Un indice (+15 s)');
    drawList();
    area.append(el('div', { class: 'hid-wrap' }, el('div', { class: 'hid-top' }, el('b', {}, 'Retrouve ces objets :'), hintBtn), chips, cv));
    raf = requestAnimationFrame(draw);
    g.onCleanup(() => cancelAnimationFrame(raf));
  },

  // 🧠 Quiz solo
  async quiz(area, g) {
    let questions;
    try { questions = (await api('/api/games/quiz')).questions; } catch (e) { return area.append(el('p', { class: 'empty' }, e.message)); }
    let i = 0, score = 0, timer = null;
    const box = el('div', { class: 'quiz-box' });
    area.append(box);
    const show = () => {
      if (i >= questions.length) return g.end(score, `${score} points sur ${questions.length * 15} possibles`);
      const q = questions[i];
      const t0 = Date.now();
      const bar = el('div', { class: 'quiz-timer' }, el('i'));
      let answered = false;
      const pick = (c, btn) => {
        if (answered) return;
        answered = true; clearTimeout(timer);
        const ok = c === q.answer;
        if (ok) score += 10 + Math.max(0, Math.round(5 - (Date.now() - t0) / 3000));
        box.querySelectorAll('.quiz-choice').forEach((b, k) => b.classList.add(k === q.answer ? 'good' : k === c ? 'bad' : 'dim'));
        g.info(`Question ${i + 1}/${questions.length} · ${score} pts`);
        setTimeout(() => { i++; show(); }, 700);
      };
      box.replaceChildren(el('div', { class: 'quiz-q' }, q.q), bar,
        el('div', { class: 'quiz-choices' }, ...q.choices.map((c, k) => el('button', { class: 'quiz-choice', onclick: e => pick(k, e.target) }, c))));
      bar.style.setProperty('--qt', '12s');
      requestAnimationFrame(() => bar.firstChild.classList.add('run'));
      g.info(`Question ${i + 1}/${questions.length} · ${score} pts`);
      timer = setTimeout(() => pick(-1), 12000);
    };
    g.onCleanup(() => clearTimeout(timer));
    show();
  },
};

// ---------- Parties à deux (en ligne ou contre l'ordinateur) ----------
const Match = {
  active: false, id: null, game: null, you: 0, players: [], state: null, over: false, bot: false, pending: null,
  reset() { Object.assign(this, { active: false, id: null, game: null, state: null, over: false, bot: false }); },
  move(m) {
    if (this.bot) return Bot.play(m);
    socket.emit('game_move', { id: this.id, move: m }, r => { if (r?.error) toast(r.error); });
  },
  leave() { if (this.id && !this.bot) socket.emit('game_leave', this.id); },
};

function chooseOpponent(g, presetUser) {
  const others = state.online.filter(u => u.id !== state.me.id && !u.ghost && !state.blocked.has(u.id));
  const search = el('input', { class: 'input', placeholder: 'Chercher un joueur…' });
  const list = el('div', { class: 'people-list', style: 'max-height:280px' });
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const xs = others.filter(u => !q || u.username.toLowerCase().includes(q));
    list.replaceChildren(...(xs.length ? xs.map(u => el('div', { class: 'person' }, LC.avatar(u), el('span', { style: 'flex:1' }, LC.name(u)),
      el('button', { class: 'btn btn-sm btn-primary', onclick: () => { close(); invite(g, u); } }, '⚔️ Défier'))) : [el('div', { class: 'side-empty' }, 'Personne d\'autre n\'est connecté pour le moment')]));
  };
  search.oninput = draw;
  if (presetUser) return invite(g, presetUser);
  const close = modal(
    el('h3', {}, `${g.icon} ${g.name}`), el('p', { class: 'help', style: 'margin-top:-6px' }, g.desc),
    g.bot ? el('button', { class: 'btn btn-primary', style: 'width:100%;margin-bottom:14px', onclick: () => { close(); Bot.start(g.id); } }, g.id === 'frappe' ? '⌨️ S\'entraîner seul' : '🤖 Jouer contre l\'ordinateur') : null,
    el('div', { class: 'field' }, el('label', {}, '👥 Défier une personne connectée'), search), list,
    el('button', { class: 'btn btn-ghost', style: 'width:100%;margin-top:12px', onclick: () => close() }, 'Annuler'));
  draw();
}
// Choisir un jeu pour défier quelqu'un (depuis son profil)
function challengeUser(u) {
  const close = modal(el('h3', {}, `⚔️ Défier ${u.username}`),
    el('div', { class: 'game-grid small' }, ...GAME_LIST.multi.map(g => el('button', { class: 'game-card', onclick: () => { close(); invite(g, u); } }, el('span', { class: 'gc-ico' }, g.icon), el('b', {}, g.name)))),
    el('button', { class: 'btn btn-ghost', style: 'width:100%;margin-top:12px', onclick: () => close() }, 'Annuler'));
}

let waitClose = null;
function invite(g, u) {
  socket.emit('game_invite', { to: u.id, game: g.id }, r => {
    if (r?.error) return toast('🎮 ' + r.error);
    Match.pending = r.id;
    const left = el('p', { class: 'help' }, `Invitation envoyée à ${u.username}… 20 s`);
    const end = Date.now() + 20000;
    const tick = setInterval(() => {
      const s2 = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      left.textContent = `Invitation envoyée à ${u.username}… ${s2} s`;
      if (!document.body.contains(left)) clearInterval(tick);
    }, 500);
    waitClose = modal(el('div', { class: 'center' },
      el('div', { class: 'ring-avatar' }, LC.avatar(u, true)),
      el('h3', {}, `${g.icon} ${g.name}`), left,
      el('button', { class: 'btn', onclick: () => { socket.emit('game_invite_cancel', r.id); waitClose(); waitClose = null; } }, 'Annuler')));
  });
}
socket.on('game_invite_result', ({ accepted, reason }) => {
  if (waitClose) { waitClose(); waitClose = null; }
  if (!accepted) toast('🎮 ' + reason);
});
let incomingClose = null;
socket.on('game_invite', ({ id, game, from }) => {
  if (state.blocked.has(from.id) || (typeof isUserMuted === 'function' && isUserMuted(from.id))) return socket.emit('game_answer', { id, accept: false });
  const g = gameInfo(game);
  ding();
  if (incomingClose) incomingClose();
  incomingClose = modal(el('div', { class: 'center' },
    el('div', { class: 'ring-avatar' }, LC.avatar(from, true)),
    el('h3', {}, `${from.username} te défie !`), el('p', {}, `${g.icon} ${g.name} — ${g.desc}`),
    el('div', { class: 'actions', style: 'margin-top:14px' },
      el('button', { class: 'btn', onclick: () => { socket.emit('game_answer', { id, accept: false }); incomingClose(); incomingClose = null; } }, 'Refuser'),
      el('button', { class: 'btn btn-primary', onclick: () => { socket.emit('game_answer', { id, accept: true }); incomingClose(); incomingClose = null; } }, '⚔️ Accepter'))));
  desktopNotify({ id: 'game' + id, title: `🎮 ${from.username} te défie`, text: `${g.name} — reviens sur le site pour jouer` });
});
socket.on('game_invite_cancel', () => { if (incomingClose) { incomingClose(); incomingClose = null; toast('🎮 Invitation annulée'); } });
socket.on('game_start', ({ id, game, you, players }) => {
  document.querySelectorAll('.modal-back').forEach(m => m.remove());
  incomingClose = waitClose = null;
  Object.assign(Match, { active: true, id, game, you, players, over: false, bot: false, state: null });
  Hub.open();
  renderMatch();
});
socket.on('game_state', ({ id, state: st, you }) => {
  if (id !== Match.id) return;
  Match.state = st; Match.you = you;
  renderMatch();
});
socket.on('game_over', ({ id, winner, reason }) => {
  if (id !== Match.id) return;
  Match.over = true;
  showMatchEnd(winner, reason);
});
socket.on('game_rematch_ask', ({ id, from }) => {
  if (id !== Match.id) return;
  toast(`🔁 ${from} veut une revanche ! Clique sur « Revanche » pour accepter.`);
});

// ---------- Affichage d'une partie à deux ----------
let matchUI = null;
function renderMatch() {
  const g = gameInfo(Match.game);
  if (!matchUI || matchUI.id !== Match.id || !document.body.contains(matchUI.area)) {
    const { area, info } = Hub.screen(`${g.icon} ${g.name}`, { onBack: () => {
      if (!Match.over && !Match.bot && !confirm('Abandonner la partie ?')) return;
      if (!Match.over) Match.leave();
      Match.reset(); Hub.home();
    } });
    const head = el('div', { class: 'vs-head' });
    const board = el('div', { class: 'vs-board' });
    const foot = el('div', { class: 'vs-foot' });
    area.append(head, board, foot);
    matchUI = { id: Match.id, area, info, head, board, foot, mem: {} };
  }
  const ui = matchUI, st = Match.state, you = Match.you;
  const [p0, p1] = Match.players;
  const me = Match.players[you], other = Match.players[1 - you];
  ui.head.replaceChildren(
    el('div', { class: 'vs-player' + (st && st.turn === 0 && !st.over ? ' turn' : '') }, LC.avatar(p0), el('b', {}, p0.username), el('small', {}, MARKS[Match.game]?.[0] || '')),
    el('span', { class: 'vs-x' }, scoreText(st)),
    el('div', { class: 'vs-player' + (st && st.turn === 1 && !st.over ? ' turn' : '') }, LC.avatar(p1), el('b', {}, p1.username), el('small', {}, MARKS[Match.game]?.[1] || '')));
  if (!st) return;
  RENDER[Match.game](ui, st, you, me, other);
}
const MARKS = { morpion: ['❌', '⭕'], quatre: ['🔴', '🟡'] };
function scoreText(st) {
  if (!st) return 'VS';
  if (st.score) return `${st.score[0]} – ${st.score[1]}`;
  if (st.scores) return `${st.scores[0]} – ${st.scores[1]}`;
  return 'VS';
}
const turnText = (st, you, other) => (st.over ? '' : st.turn === you ? '👉 À toi de jouer !' : `⏳ ${other.username} réfléchit…`);

const RENDER = {
  morpion(ui, st, you, me, other) {
    ui.board.replaceChildren(el('div', { class: 'ttt' }, ...st.board.map((v, i) => el('button', {
      class: 'ttt-cell' + (st.line?.includes(i) ? ' win' : ''), disabled: v !== null || st.over || st.turn !== you, onclick: () => Match.move({ cell: i }),
    }, v === null ? '' : MARKS.morpion[v]))));
    ui.foot.textContent = turnText(st, you, other);
  },
  quatre(ui, st, you, me, other) {
    const win = new Set((st.line || []).map(([r, c]) => r + ',' + c));
    ui.board.replaceChildren(el('div', { class: 'c4' }, ...st.board.flatMap((row, r) => row.map((v, c) => el('button', {
      class: 'c4-cell' + (v === 0 ? ' p0' : v === 1 ? ' p1' : '') + (win.has(r + ',' + c) ? ' win' : '') + (st.last && st.last[0] === r && st.last[1] === c ? ' last' : ''),
      disabled: st.over || st.turn !== you, onclick: () => Match.move({ col: c }), 'aria-label': 'Colonne ' + (c + 1),
    })))));
    ui.foot.textContent = turnText(st, you, other) || '';
  },
  chifoumi(ui, st, you, me, other) {
    const EMO = { pierre: '✊', feuille: '✋', ciseaux: '✌️' };
    const mine = st.picks[you], theirs = st.picks[1 - you];
    ui.board.replaceChildren(
      el('div', { class: 'rps' }, ...Object.entries(EMO).map(([k, e]) => el('button', { class: 'rps-btn' + (mine === k ? ' picked' : ''), disabled: !!mine || st.over, onclick: () => Match.move({ pick: k }) }, el('span', {}, e), el('small', {}, k)))),
      el('div', { class: 'rps-hist' }, ...st.history.slice(-5).reverse().map((h, i) => el('div', { class: 'rps-row' + (i === 0 ? ' last' : '') },
        el('span', {}, EMO[h.picks[you]]), el('b', {}, h.winner === null ? 'Égalité' : h.winner === you ? 'Gagné ✅' : 'Perdu ❌'), el('span', {}, EMO[h.picks[1 - you]])))));
    ui.foot.textContent = st.over ? '' : mine ? (theirs ? '…' : `⏳ En attente du choix de ${other.username}…`) : `Choisis ! Premier à ${st.target} manches.`;
  },
  frappe(ui, st, you, me, other) {
    const mem = ui.mem;
    if (!mem.input || mem.phrase !== st.phrase) {
      mem.phrase = st.phrase;
      mem.text = el('div', { class: 'frappe-text' });
      mem.input = el('textarea', { class: 'input frappe-input', rows: 2, placeholder: 'Attends le départ…', disabled: true, autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false' });
      mem.input.addEventListener('paste', e => e.preventDefault());
      mem.input.oninput = () => { paintPhrase(); Match.move({ typed: mem.input.value }); };
      mem.bars = el('div', { class: 'frappe-bars' });
      mem.count = el('div', { class: 'frappe-count' });
      ui.board.replaceChildren(mem.count, mem.text, mem.input, mem.bars);
      const tick = () => {
        const left = Math.ceil((st.startAt - Date.now()) / 1000);
        if (left > 0) { mem.count.textContent = `Départ dans ${left}…`; mem.t = setTimeout(tick, 200); }
        else { mem.count.textContent = '🏁 Partez !'; mem.input.disabled = false; mem.input.placeholder = 'Recopie la phrase ici…'; mem.input.focus(); mem.start = Date.now(); }
      };
      tick();
      Hub.cleanups.push(() => clearTimeout(mem.t));
    }
    const paintPhrase = () => {
      const typed = mem.input.value;
      let ok = 0; while (ok < typed.length && typed[ok] === st.phrase[ok]) ok++;
      mem.text.replaceChildren(el('span', { class: 'ok' }, st.phrase.slice(0, ok)),
        typed.length > ok ? el('span', { class: 'ko' }, st.phrase.slice(ok, typed.length)) : '', el('span', {}, st.phrase.slice(Math.max(ok, typed.length))));
    };
    paintPhrase();
    mem.bars.replaceChildren(...Match.players.map((p, i) => el('div', { class: 'frappe-bar' }, el('span', {}, i === you ? 'Toi' : p.username),
      el('div', { class: 'bar' }, el('i', { style: `width:${Math.round((st.progress[i] / st.phrase.length) * 100)}%` })),
      el('small', {}, st.times[i] ? `${(st.times[i] / 1000).toFixed(1)} s` : ''))));
    if (st.over) mem.input.disabled = true;
    ui.foot.textContent = '';
  },
  quizduel(ui, st, you, me, other) {
    const mem = ui.mem;
    if (!st.question) return;
    if (mem.idx !== st.idx || mem.reveal !== st.reveal) {
      mem.idx = st.idx; mem.reveal = st.reveal;
      const bar = el('div', { class: 'quiz-timer' }, el('i'));
      ui.board.replaceChildren(el('div', { class: 'quiz-box' },
        el('div', { class: 'help center' }, `Question ${st.idx + 1}/${st.total}`),
        el('div', { class: 'quiz-q' }, st.question.q), bar,
        el('div', { class: 'quiz-choices' }, ...st.question.choices.map((c, k) => el('button', {
          class: 'quiz-choice' + (st.reveal ? (k === st.question.answer ? ' good' : k === st.mine ? ' bad' : ' dim') : st.mine === k ? ' picked' : ''),
          disabled: st.reveal || st.mine !== null, onclick: () => Match.move({ choice: k }),
        }, c, st.reveal && st.other === k ? el('span', { class: 'quiz-other' }, ` ← ${other.username}`) : '')))));
      if (!st.reveal) {
        const delay = Math.max(0, st.qStart - Date.now());
        bar.style.setProperty('--qt', '10s');
        setTimeout(() => bar.firstChild?.classList.add('run'), delay);
      }
    } else {
      ui.board.querySelectorAll('.quiz-choice').forEach((b, k) => { b.disabled = st.reveal || st.mine !== null; b.classList.toggle('picked', st.mine === k); });
    }
    ui.foot.textContent = st.over ? '' : st.reveal ? 'Question suivante…' : st.mine !== null ? (st.otherAnswered ? '' : `⏳ ${other.username} n'a pas encore répondu`) : st.otherAnswered ? `⚡ ${other.username} a déjà répondu !` : '';
  },
};

function showMatchEnd(winner, reason) {
  const ui = matchUI;
  if (!ui) return;
  const won = winner === Match.you, draw = winner === null;
  if (won) LC.confetti(['🏆', '🎉']);
  ui.foot.replaceChildren(el('div', { class: 'game-over inline' },
    el('div', { class: 'go-ico' }, draw ? '🤝' : won ? '🏆' : '😢'),
    el('h3', {}, draw ? 'Égalité !' : won ? 'Tu as gagné !' : `${Match.players[winner]?.username || 'L\'adversaire'} a gagné`),
    reason ? el('p', { class: 'help' }, reason) : null,
    el('div', { class: 'actions' },
      el('button', { class: 'btn btn-primary', onclick: () => (Match.bot ? Bot.start(Match.game) : (socket.emit('game_rematch', Match.id), toast('🔁 Demande de revanche envoyée'))) }, '🔁 Revanche'),
      el('button', { class: 'btn', onclick: () => { Match.reset(); Hub.home(); } }, 'Autres jeux'))));
}

// ---------- Contre l'ordinateur ----------
const BOT_USER = { id: -1, username: 'Ordinateur 🤖', color: '#4fb3ff' };
const Bot = {
  start(game) {
    const me = state.me;
    const init = {
      morpion: () => ({ board: Array(9).fill(null), turn: 0 }),
      quatre: () => ({ board: Array.from({ length: 6 }, () => Array(7).fill(null)), turn: 0 }),
      chifoumi: () => ({ picks: [null, null], score: [0, 0], history: [], target: 3 }),
      frappe: () => ({ phrase: FRAPPE_PHRASES[rand(FRAPPE_PHRASES.length)], startAt: Date.now() + 2500, progress: [0, 0], times: [null, null] }),
    }[game]();
    matchUI = null;
    Object.assign(Match, { active: true, id: 'bot-' + Date.now(), game, you: 0, players: game === 'frappe' ? [me, { ...me, username: '—' }] : [me, BOT_USER], over: false, bot: true, state: init });
    Hub.open();
    renderMatch();
  },
  play(m) {
    const s = Match.state;
    if (s.over) return;
    const done = () => { renderMatch(); if (s.over) { Match.over = true; showMatchEnd(s.winner ?? null, ''); } };
    if (Match.game === 'morpion') {
      if (s.turn !== 0 || s.board[m.cell] !== null) return;
      tttPlay(s, m.cell, 0); done();
      if (!s.over) setTimeout(() => { tttPlay(s, tttBest(s.board), 1); done(); }, 250);
    } else if (Match.game === 'quatre') {
      if (s.turn !== 0 || !c4Drop(s, m.col, 0)) return;
      done();
      if (!s.over) setTimeout(() => { c4Drop(s, c4Bot(s.board), 1); done(); }, 300);
    } else if (Match.game === 'chifoumi') {
      if (s.picks[0]) return;
      s.picks[0] = m.pick; done();
      setTimeout(() => {
        const opts = ['pierre', 'feuille', 'ciseaux'];
        const b = opts[rand(3)], a = s.picks[0];
        const beats = { pierre: 'ciseaux', feuille: 'pierre', ciseaux: 'feuille' };
        const r = a === b ? null : beats[a] === b ? 0 : 1;
        if (r !== null) s.score[r]++;
        s.history.push({ picks: [a, b], winner: r });
        s.picks = [null, null];
        if (s.score[0] >= s.target || s.score[1] >= s.target) { s.over = true; s.winner = s.score[0] > s.score[1] ? 0 : 1; }
        done();
      }, 300);
    } else if (Match.game === 'frappe') {
      if (Date.now() < s.startAt) return;
      const t = String(m.typed || '');
      let n = 0; while (n < t.length && t[n] === s.phrase[n]) n++;
      s.progress[0] = n;
      if (t === s.phrase) {
        s.times[0] = Date.now() - s.startAt; s.over = true; s.winner = 0;
        const words = s.phrase.length / 5, min = s.times[0] / 60000;
        renderMatch(); Match.over = true;
        showMatchEnd(0, `⌨️ ${(s.times[0] / 1000).toFixed(1)} s — environ ${Math.round(words / min)} mots par minute`);
        return;
      }
      renderMatch();
    }
  },
};
const FRAPPE_PHRASES = ['Le soleil brille sur la mer et les mouettes chantent au loin.', 'Un bon ami vaut mieux que mille connaissances.', 'Rien ne sert de courir, il faut partir à point.', 'Le chat noir saute sur le toit pour attraper la lune.', 'Petit à petit, l\'oiseau fait son nid.'];
const L3 = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function tttWinner(b) { for (const l of L3) if (b[l[0]] !== null && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return { p: b[l[0]], l }; return null; }
function tttPlay(s, i, p) {
  s.board[i] = p; s.turn = 1 - p;
  const w = tttWinner(s.board);
  if (w) { s.over = true; s.winner = w.p; s.line = w.l; } else if (s.board.every(x => x !== null)) { s.over = true; s.winner = null; }
}
// Ordinateur imbattable… sauf 1 fois sur 4 où il fait une erreur, pour laisser une chance 😉
function tttBest(b) {
  const free = b.map((v, i) => (v === null ? i : -1)).filter(i => i >= 0);
  if (Math.random() < 0.25) return free[rand(free.length)];
  const mm = (bd, p) => {
    const w = tttWinner(bd); if (w) return w.p === 1 ? 10 : -10;
    if (bd.every(x => x !== null)) return 0;
    let best = p === 1 ? -99 : 99;
    bd.forEach((v, i) => { if (v === null) { bd[i] = p; const sc = mm(bd, 1 - p); bd[i] = null; best = p === 1 ? Math.max(best, sc) : Math.min(best, sc); } });
    return best;
  };
  let best = -99, move = free[0];
  for (const i of free) { b[i] = 1; const sc = mm(b, 0); b[i] = null; if (sc > best) { best = sc; move = i; } }
  return move;
}
function c4Drop(s, col, p) {
  let row = -1;
  for (let r = 5; r >= 0; r--) if (s.board[r][col] === null) { row = r; break; }
  if (row < 0) return false;
  s.board[row][col] = p; s.last = [row, col]; s.turn = 1 - p;
  const w = c4Check(s.board, row, col, p);
  if (w) { s.over = true; s.winner = p; s.line = w; } else if (s.board[0].every(x => x !== null)) { s.over = true; s.winner = null; }
  return true;
}
function c4Check(b, r, c, p) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = [[r, c]];
    for (const sg of [1, -1]) { let rr = r + dr * sg, cc = c + dc * sg; while (rr >= 0 && rr < 6 && cc >= 0 && cc < 7 && b[rr][cc] === p) { cells.push([rr, cc]); rr += dr * sg; cc += dc * sg; } }
    if (cells.length >= 4) return cells;
  }
  return null;
}
function c4Bot(b) {
  const cols = [0, 1, 2, 3, 4, 5, 6].filter(c => b[0][c] === null);
  const test = (c, p) => { const copy = b.map(r => [...r]); const s = { board: copy }; c4Drop(s, c, p); return s; };
  for (const c of cols) if (test(c, 1).winner === 1) return c;       // gagner
  for (const c of cols) if (test(c, 0).winner === 0) return c;       // bloquer
  const safe = cols.filter(c => { const s = test(c, 1); if (s.over) return true; return !cols.some(c2 => s.board[0][c2] === null && test2(s.board, c2)); });
  function test2(board, c2) { const copy = board.map(r => [...r]); const s = { board: copy }; c4Drop(s, c2, 0); return s.winner === 0; }
  const pool = safe.length ? safe : cols;
  return pool.sort((a, z) => Math.abs(3 - a) - Math.abs(3 - z) + (Math.random() - .5))[0];
}
