// The Paradise — section mini-jeux (solo, à deux en direct, contre l'ordinateur)
const GAME_LIST = {
  solo: [
    { id: 'serpent', icon: '🐍', name: 'Serpent', desc: 'Mange les fruits sans te mordre la queue', unit: 'pts', order: 'higher' },
    { id: 'demineur', icon: '💣', name: 'Démineur', desc: 'Découvre toutes les cases sans mine', unit: 's', order: 'lower' },
    { id: 'memory', icon: '🃏', name: 'Memory', desc: 'Retrouve les paires en un minimum de coups', unit: 'coups', order: 'lower' },
    { id: 'pendu', icon: '🔤', name: 'Pendu', desc: 'Devine les mots lettre par lettre', unit: 'mots', order: 'higher' },
    { id: 'taquin', icon: '🧩', name: 'Taquin', desc: 'Remets les chiffres dans l\'ordre', unit: 'coups', order: 'lower' },
    { id: 'reflexes', icon: '⚡', name: 'Réflexes', desc: 'Clique dès que l\'écran devient vert', unit: 'ms', order: 'lower' },
    { id: 'quiz', icon: '🧠', name: 'Quiz', desc: '10 questions de culture générale', unit: 'pts', order: 'higher' },
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
