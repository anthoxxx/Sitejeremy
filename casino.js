// The Paradise — 🎰 Le Paradise Club : un grand complexe en 3D où l'on se promène ensemble (instances de 30 personnes max).
// Dedans : le bar, l'entrée du Bowling et du Laser Game, 2 billards en 3D (règles du « 8 ») et une table de poker (Texas Hold'em).
// Le serveur calcule chaque coup de billard (public/js/poolphys.js) et distribue les cartes du poker : personne ne peut tricher.
const Pool = require('./public/js/poolphys');
const MAX_INST = 30, POOL_TABLES = 2, SEATS = 6, START_CHIPS = 1000, SB = 10, BB = 20, POOL_TURN = 45000, PK_TURN = 25000;
const DRINKS = { mojito: '🍹 Mojito', cocktail: '🍸 Cocktail', biere: '🍺 Bière', soda: '🥤 Soda', cafe: '☕ Café', jus: '🧃 Jus de fruits', champ: '🍾 Champagne', milk: '🥛 Milkshake' };
const BOT_NAMES = ['Soldat76-Bluff', 'Soldat76-AllIn', 'Soldat76-Croupier', 'Soldat76-Jetons', 'Soldat76-As', 'Soldat76-Brelan'];
module.exports = function setupCasino({ io, coins = null, track = () => {} }) {
  const now = () => Date.now();
  const insts = new Map(), where = new Map(), sockets = new Map(); let nextInst = 1, botSeq = 1;
  const room = i => 'cs:' + i;
  const toUser = (uid, ev, d) => { for (const s of sockets.get(uid) || []) s.emit(ev, d); };

  // ---------- 🏛️ les instances ----------
  function makeInst() {
    const I = { id: nextInst++, players: new Map(), pool: [], poker: null, dirty: new Set() };
    for (let t = 0; t < POOL_TABLES; t++) I.pool.push(freeTable(t));
    I.poker = newPoker(I); insts.set(I.id, I); return I;
  }
  const pickInst = () => [...insts.values()].find(I => I.players.size < MAX_INST) || makeInst();
  const pubPlayer = p => ({ id: p.id, name: p.name, gender: p.gender, x: p.x, z: p.z, yaw: p.yaw, st: p.st || '', drink: p.drink || '' });
  // 10 fois par seconde : les positions de ceux qui ont bougé
  setInterval(() => { for (const I of insts.values()) { if (!I.dirty.size) continue; const L = []; for (const id of I.dirty) { const p = I.players.get(id); if (p) L.push([id, +p.x.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(2)]); } I.dirty.clear(); io.to(room(I.id)).emit('cs_pos', L); } }, 100).unref?.();

  // ---------- 🎱 le billard ----------
  function freeTable(t) { return { t, status: 'free', players: [], balls: Pool.rack(), groups: null, turn: 0, broke: false, busy: false, msg: '', inHand: false, turnEnd: 0, winner: null, timer: null }; }
  const poolOut = T => ({ t: T.t, status: T.status, players: T.players.map(p => ({ id: p.id, name: p.name, bot: !!p.bot, group: T.groups ? T.groups[p.id] : null, left: T.groups ? T.balls.filter((b, n) => b && Pool.kind(n) === T.groups[p.id]).length : 7 })), balls: T.balls, turn: T.turn, broke: T.broke, busy: T.busy, msg: T.msg, inHand: T.inHand, turnEnd: T.turnEnd, serverNow: now(), winner: T.winner });
  const sendPool = (I, T) => io.to(room(I.id)).emit('pl_table', poolOut(T));
  function poolStart(I, T) {
    T.status = 'playing'; T.balls = Pool.rack(); T.groups = null; T.broke = false; T.inHand = false; T.winner = null; T.turn = Math.floor(Math.random() * 2);
    T.msg = `🎱 ${T.players[T.turn].name} fait la casse !`; poolTurn(I, T);
  }
  function poolTurn(I, T) {
    clearTimeout(T.timer); T.turnEnd = now() + POOL_TURN; sendPool(I, T);
    const p = T.players[T.turn]; if (!p) return;
    T.timer = setTimeout(() => { if (T.status !== 'playing' || T.busy || T.players[T.turn] !== p) return; const s = p.bot ? botShot(T, p) : { angle: Math.random() * 6.28, power: .3, spin: 0 }; poolShoot(I, T, p, s); }, p.bot ? 2600 : POOL_TURN);
  }
  function poolShoot(I, T, p, s) {
    if (T.status !== 'playing' || T.busy || T.players[T.turn] !== p) return;
    clearTimeout(T.timer);
    // la blanche « en main » : on la pose où on veut (si la place est libre), sinon au point de départ
    if (T.inHand || !T.balls[0]) { let c = Array.isArray(s.cue) ? [Number(s.cue[0]), Number(s.cue[1])] : null; if (!c || !c.every(Number.isFinite) || !freeSpot(T.balls, c)) c = spot(T.balls); T.balls[0] = c; }
    const res = Pool.simulate(T.balls, s), other = T.players[1 - T.turn];
    // la noire tombée à la casse : on la replace au fond, ce n'est pas perdu
    if (!T.broke && res.potted.includes(8)) { res.potted = res.potted.filter(n => n !== 8); let f = [...Pool.FOOT]; while (!freeSpot(res.balls, f)) f = [f[0] + .03, f[1]]; res.balls[8] = f; }
    const st = { balls: T.balls, groups: T.groups, broke: T.broke }, j = Pool.judge(st, p.id, other.id, res);
    T.busy = true; T.balls = res.balls; T.inHand = false;
    io.to(room(I.id)).emit('pl_shot', { t: T.t, by: p.id, frames: res.frames, events: res.events, potted: res.potted, shot: { angle: +s.angle, power: +s.power, spin: +s.spin || 0 }, from: st.balls[0] });
    const dur = res.frames.length * 16 / 480 * 1000 + 700;
    setTimeout(() => {
      if (!I.pool.includes(T) || T.status !== 'playing') return; T.busy = false;
      if (j.assign) { T.groups = { [p.id]: j.assign, [other.id]: j.assign === 'solid' ? 'stripe' : 'solid' }; }
      const wasBreak = !T.broke; T.broke = true;
      if (j.win) return poolEnd(I, T, j.win === p.id ? p : other, j.msg);
      if (j.foul) { T.turn = 1 - T.turn; T.inHand = true; T.msg = `⚠️ Faute : ${j.foul}. ${other.name} a la blanche en main.`; }
      else if (j.keep) T.msg = j.assign ? `✨ ${p.name} joue les ${j.assign === 'solid' ? 'pleines' : 'rayées'} et rejoue !` : `👍 ${p.name} rentre une bille et rejoue`;
      else { T.turn = 1 - T.turn; T.msg = wasBreak ? `À ${other.name} de jouer` : `😬 Raté ! À ${other.name}`; }
      if (!T.balls[0]) T.inHand = true;
      poolTurn(I, T);
    }, dur);
  }
  const freeSpot = (balls, c) => Math.abs(c[0]) < Pool.T.L / 2 - Pool.R && Math.abs(c[1]) < Pool.T.W / 2 - Pool.R && balls.every((b, n) => !n || !b || Math.hypot(b[0] - c[0], b[1] - c[1]) > Pool.R * 2.05);
  function spot(balls) { for (let k = 0; k < 40; k++) { const c = [Pool.HEAD[0] - k * .03, (k % 2 ? 1 : -1) * Math.floor(k / 2) * .02]; if (freeSpot(balls, c)) return c; } return [Pool.HEAD[0], .3]; }
  function poolEnd(I, T, win, msg) {
    clearTimeout(T.timer); T.status = 'ended'; T.winner = win.id; T.msg = `${msg} 🏆 ${win.name} gagne la partie !`;
    for (const p of T.players) { if (p.bot) continue; const w = p === win; if (coins) coins.earnCapped(p.id, w ? 'pool_win' : 'pool', w ? 12 : 3, w ? '🎱 Victoire au billard' : '🎱 Partie de billard', 6); track(p.id, w ? 'game_win' : 'game'); }
    sendPool(I, T);
    T.timer = setTimeout(() => { if (T.status !== 'ended') return; T.players = T.players.filter(p => !p.bot); T.status = T.players.length ? 'lobby' : 'free'; T.winner = null; T.msg = ''; T.balls = Pool.rack(); T.groups = null; T.broke = false; if (T.players.length === 2) poolStart(I, T); else sendPool(I, T); }, 9000);
  }
  function poolLeave(I, uid) {
    for (const T of I.pool) { const i = T.players.findIndex(p => p.id === uid); if (i < 0) continue;
      if (T.status === 'playing') { const other = T.players[1 - i], gone = T.players[i].name; T.players.splice(i, 1); poolEnd(I, T, other, `🚪 ${gone} est parti.`); continue; }
      T.players.splice(i, 1); if (!T.players.some(p => !p.bot)) { clearTimeout(T.timer); Object.assign(T, freeTable(T.t)); } else T.status = 'lobby'; sendPool(I, T); }
  }
  // 🤖 le robot du billard : il cherche la bille la plus facile à rentrer (bille fantôme), avec un peu d'imprécision
  function botShot(T, p) {
    const b = T.balls, R = Pool.R; if (!T.broke) return { angle: (Math.random() - .5) * .012, power: .95 + Math.random() * .05, spin: 0 };
    const c = b[0] || spot(b); const g = T.groups ? T.groups[p.id] : null;
    const cleared = g && !b.some((x, n) => x && Pool.kind(n) === g);
    const legal = n => b[n] && n !== 0 && (cleared ? n === 8 : g ? Pool.kind(n) === g : n !== 8);
    const clear = (ax, az, bx, bz, skip) => { const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1; for (let n = 1; n < 16; n++) { if (!b[n] || skip.includes(n)) continue; const t = ((b[n][0] - ax) * dx + (b[n][1] - az) * dz) / (L * L); if (t <= 0 || t >= 1) continue; if (Math.hypot(ax + dx * t - b[n][0], az + dz * t - b[n][1]) < R * 2.05) return false; } return true; };
    let best = null;
    for (let n = 1; n < 16; n++) { if (!legal(n)) continue;
      for (const [px0, pz0] of Pool.POCKETS) { const px = px0 * .97, pz = pz0 * .96, dx = px - b[n][0], dz = pz - b[n][1], d2 = Math.hypot(dx, dz), ux = dx / d2, uz = dz / d2;
        const gx = b[n][0] - ux * 2 * R, gz = b[n][1] - uz * 2 * R, ex = gx - c[0], ez = gz - c[1], d1 = Math.hypot(ex, ez); if (d1 < .01) continue;
        const cos = (ex * ux + ez * uz) / d1; if (cos < .3) continue;
        if (!clear(c[0], c[1], gx, gz, [0, n]) || !clear(b[n][0], b[n][1], px, pz, [n])) continue;
        const sc = cos * cos / (d1 + d2 * 1.4); if (!best || sc > best.sc) best = { sc, ang: Math.atan2(ez, ex), d: d1 + d2 / Math.max(cos, .3) }; } }
    const err = (Math.random() + Math.random() - 1) * (p.skill || .02);
    if (best) return { angle: best.ang + err, power: Math.min(.8, .2 + best.d * .22), spin: Math.random() < .3 ? -.4 : 0, cue: c };
    let n0 = 0, dmin = 9; for (let n = 1; n < 16; n++) if (legal(n)) { const d = Math.hypot(b[n][0] - c[0], b[n][1] - c[1]); if (d < dmin) { dmin = d; n0 = n; } }
    return n0 ? { angle: Math.atan2(b[n0][1] - c[1], b[n0][0] - c[0]) + err, power: .45, spin: 0, cue: c } : { angle: Math.random() * 6.28, power: .4, spin: 0, cue: c };
  }

  // ---------- 🃏 le poker (Texas Hold'em, jetons de la table, gratuits) ----------
  function newPoker(I) { return { I, seats: Array(SEATS).fill(null), phase: 'wait', board: [], deck: [], dealer: -1, toAct: -1, curBet: 0, minRaise: BB, hand: 0, msg: 'Assieds-toi pour jouer !', timer: null, turnEnd: 0, show: null, log: [] }; }
  const RN = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R', 'A'];
  const CAT = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush'];
  function eval5(cs) {
    const r = cs.map(c => c % 13).sort((a, b) => b - a), fl = cs.every(c => Math.floor(c / 13) === Math.floor(cs[0] / 13));
    const cnt = {}; for (const x of r) cnt[x] = (cnt[x] || 0) + 1;
    const g = Object.entries(cnt).map(([k, n]) => [n, +k]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const u = [...new Set(r)]; let st = -1; if (u.length === 5) { if (u[0] - u[4] === 4) st = u[0]; else if (u[0] === 12 && u[1] === 3) st = 3; }
    let cat, ks;
    if (st >= 0 && fl) { cat = 8; ks = [st]; } else if (g[0][0] === 4) { cat = 7; ks = [g[0][1], g[1][1]]; } else if (g[0][0] === 3 && g[1][0] === 2) { cat = 6; ks = [g[0][1], g[1][1]]; }
    else if (fl) { cat = 5; ks = r; } else if (st >= 0) { cat = 4; ks = [st]; } else if (g[0][0] === 3) { cat = 3; ks = g.map(x => x[1]); } else if (g[0][0] === 2 && g[1][0] === 2) { cat = 2; ks = g.map(x => x[1]); }
    else if (g[0][0] === 2) { cat = 1; ks = g.map(x => x[1]); } else { cat = 0; ks = r; }
    let v = cat; for (let i = 0; i < 5; i++) v = v * 13 + (ks[i] || 0); return { v, cat };
  }
  function best7(cs) { let b = null; const n = cs.length; for (let a = 0; a < n; a++) for (let c = a + 1; c < n; c++) { const five = cs.filter((_, i) => i !== a && i !== c); const e = eval5(five); if (!b || e.v > b.v) b = { ...e, five }; } if (n === 5) return eval5(cs); return b; }
  const handName = e => CAT[e.cat];
  const pkOut = P => ({ seats: P.seats.map(s => s && { id: s.id, name: s.name, bot: !!s.bot, chips: s.chips, bet: s.bet, folded: s.folded, allin: s.allin, cards: s.hole.length ? 2 : 0, last: s.last || '', shown: P.show && P.show.cards[s.id] ? P.show.cards[s.id] : null }),
    phase: P.phase, board: P.board, dealer: P.dealer, toAct: P.toAct, curBet: P.curBet, minRaise: P.minRaise, pot: P.seats.reduce((a, s) => a + (s ? s.total : 0), 0) + (P.potExtra || 0), msg: P.msg, turnEnd: P.turnEnd, serverNow: now(), show: P.show ? { winners: P.show.winners } : null, hand: P.hand });
  const sendPk = P => io.to(room(P.I.id)).emit('pk_table', pkOut(P));
  const humansAt = P => P.seats.filter(s => s && !s.bot);
  const nextSeat = (P, i, ok) => { for (let k = 1; k <= SEATS; k++) { const j = (i + k) % SEATS; if (P.seats[j] && ok(P.seats[j])) return j; } return -1; };
  function fillBots(P) {
    const n = P.seats.filter(Boolean).length; if (!humansAt(P).length) return;
    for (let need = Math.max(0, 3 - n); need > 0; need--) { const j = P.seats.findIndex(s => !s); if (j < 0) break; P.seats[j] = { id: -(1000 + botSeq++), name: BOT_NAMES[(botSeq) % BOT_NAMES.length], bot: true, chips: START_CHIPS, hole: [], bet: 0, total: 0, folded: true, allin: false, skill: .5 + Math.random() * .4 }; }
  }
  function pkMaybeStart(P) {
    if (P.phase !== 'wait') return;
    P.seats = P.seats.map(s => s && s.ghost ? null : s); // les fantômes s'en vont
    // plus d'humains : les robots s'en vont
    if (!humansAt(P).length) { P.seats = P.seats.map(s => s && !s.bot ? s : null); P.msg = 'Assieds-toi pour jouer !'; return sendPk(P); }
    fillBots(P);
    for (const s of P.seats) if (s && s.chips <= 0) { s.chips = START_CHIPS; s.last = s.bot ? '' : '🔄 Recave'; }
    if (P.seats.filter(s => s && s.chips > 0).length < 2) return sendPk(P);
    clearTimeout(P.timer); P.timer = setTimeout(() => pkStart(P), 2500); P.msg = '🃏 Nouvelle main dans un instant…'; sendPk(P);
  }
  function pkStart(P) {
    if (P.phase !== 'wait') return; const live = P.seats.filter(s => s && s.chips > 0); if (live.length < 2 || !humansAt(P).length) { return pkMaybeStart(P); }
    P.hand++; P.board = []; P.show = null; P.potExtra = 0; P.deck = [...Array(52).keys()]; for (let i = 51; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [P.deck[i], P.deck[j]] = [P.deck[j], P.deck[i]]; }
    for (const s of P.seats) if (s) { s.hole = []; s.bet = 0; s.total = 0; s.folded = s.chips <= 0; s.allin = false; s.acted = false; s.last = ''; }
    P.dealer = nextSeat(P, P.dealer, s => !s.folded);
    const heads = live.length === 2, sb = heads ? P.dealer : nextSeat(P, P.dealer, s => !s.folded), bb = nextSeat(P, sb, s => !s.folded);
    const post = (i, n) => { const s = P.seats[i], a = Math.min(n, s.chips); s.chips -= a; s.bet += a; s.total += a; if (!s.chips) s.allin = true; s.last = n === SB ? 'Petite blinde' : 'Grosse blinde'; };
    post(sb, SB); post(bb, BB); P.curBet = BB; P.minRaise = BB;
    for (let r = 0; r < 2; r++) for (const s of P.seats) if (s && !s.folded) s.hole.push(P.deck.pop());
    for (const s of P.seats) if (s && !s.bot && !s.folded) toUser(s.id, 'pk_hole', { hand: P.hand, cards: s.hole });
    P.phase = 'preflop'; P.msg = `🃏 Main n°${P.hand}`;
    pkTurn(P, nextSeat(P, bb, s => !s.folded && !s.allin));
  }
  function pkTurn(P, i) {
    clearTimeout(P.timer);
    const inHand = P.seats.filter(s => s && !s.folded);
    if (inHand.length === 1) return pkWinAll(P, inHand[0]);
    const canAct = inHand.filter(s => !s.allin);
    const done = canAct.every(s => s.acted && s.bet === P.curBet) || (canAct.length <= 1 && canAct.every(s => s.bet >= P.curBet));
    if (done || i < 0) return pkStreet(P);
    P.toAct = i; P.turnEnd = now() + PK_TURN; sendPk(P);
    const s = P.seats[i];
    P.timer = setTimeout(() => { if (P.seats[i] !== s || P.toAct !== i) return; if (s.bot) botPoker(P, i); else pkAct(P, i, { type: s.bet >= P.curBet ? 'check' : 'fold' }); }, s.bot ? 1200 + Math.random() * 1800 : PK_TURN);
  }
  function pkAct(P, i, a) {
    const s = P.seats[i]; if (!s || P.toAct !== i || s.folded || s.allin || !['preflop', 'flop', 'turn', 'river'].includes(P.phase)) return false;
    const toCall = P.curBet - s.bet;
    if (a.type === 'fold') { s.folded = true; s.last = 'Se couche'; }
    else if (a.type === 'check') { if (toCall > 0) return false; s.last = 'Parole'; }
    else if (a.type === 'call') { const n = Math.min(toCall, s.chips); s.chips -= n; s.bet += n; s.total += n; if (!s.chips) s.allin = true; s.last = s.allin ? 'Tapis !' : n ? `Suit ${n}` : 'Parole'; }
    else if (a.type === 'raise') {
      let to = Math.floor(Number(a.to) || 0); const max = s.bet + s.chips;
      if (to >= max) to = max; else if (to < P.curBet + P.minRaise) to = Math.min(max, P.curBet + P.minRaise);
      if (to <= P.curBet) return pkAct(P, i, { type: 'call' });
      const n = to - s.bet; s.chips -= n; s.bet += n; s.total += n; if (to - P.curBet >= P.minRaise) P.minRaise = to - P.curBet; P.curBet = to; if (!s.chips) s.allin = true;
      s.last = s.allin ? 'Tapis !' : `Relance à ${to}`; for (const o of P.seats) if (o && o !== s) o.acted = false;
    } else return false;
    s.acted = true;
    pkTurn(P, nextSeat(P, i, o => !o.folded && !o.allin));
    return true;
  }
  function pkStreet(P) {
    for (const s of P.seats) if (s) { s.bet = 0; s.acted = false; if (!s.folded && !s.allin) s.last = ''; }
    P.curBet = 0; P.minRaise = BB;
    const next = { preflop: 'flop', flop: 'turn', turn: 'river', river: 'show' }[P.phase];
    if (next === 'show') return pkShow(P);
    P.deck.pop(); if (next === 'flop') P.board.push(P.deck.pop(), P.deck.pop(), P.deck.pop()); else P.board.push(P.deck.pop());
    P.phase = next; P.msg = { flop: '🃏 Le flop', turn: '🃏 Le tournant', river: '🃏 La rivière' }[next];
    const canAct = P.seats.filter(s => s && !s.folded && !s.allin);
    if (canAct.length <= 1) { sendPk(P); P.toAct = -1; clearTimeout(P.timer); P.timer = setTimeout(() => pkStreet(P), 1500); return; }
    pkTurn(P, nextSeat(P, P.dealer, s => !s.folded && !s.allin));
  }
  function pkWinAll(P, w) {
    const pot = P.seats.reduce((a, s) => a + (s ? s.total : 0), 0); w.chips += pot;
    P.show = { winners: [{ id: w.id, name: w.name, won: pot, hand: '' }], cards: {} }; P.msg = `🏆 ${w.name} remporte ${pot} jetons`;
    reward(P, w, pot); pkEnd(P);
  }
  function pkShow(P) {
    while (P.board.length < 5) P.board.push(P.deck.pop());
    const live = P.seats.filter(s => s && !s.folded), ev = new Map(live.map(s => [s, best7([...s.hole, ...P.board])]));
    // les pots (avec les pots annexes quand quelqu'un est à tapis)
    const all = P.seats.filter(s => s && s.total > 0), levels = [...new Set(all.map(s => s.total))].sort((a, b) => a - b);
    const won = new Map(); let prev = 0;
    for (const L of levels) {
      const pot = all.reduce((a, s) => a + Math.max(0, Math.min(s.total, L) - prev), 0); const elig = live.filter(s => s.total >= L); prev = L;
      if (!pot) continue; if (!elig.length) { const back = all.find(s => s.total >= L); if (back) won.set(back, (won.get(back) || 0) + pot); continue; }
      const top = Math.max(...elig.map(s => ev.get(s).v)), ws = elig.filter(s => ev.get(s).v === top), share = Math.floor(pot / ws.length);
      ws.forEach((s, k) => won.set(s, (won.get(s) || 0) + share + (k === 0 ? pot - share * ws.length : 0)));
    }
    P.show = { winners: [], cards: {} };
    for (const s of live) P.show.cards[s.id] = { cards: s.hole, hand: handName(ev.get(s)) };
    for (const [s, n] of won) { s.chips += n; if (live.includes(s)) { P.show.winners.push({ id: s.id, name: s.name, won: n, hand: handName(ev.get(s)) }); reward(P, s, n); } }
    const w0 = P.show.winners.sort((a, b) => b.won - a.won)[0];
    P.msg = w0 ? `🏆 ${P.show.winners.map(w => w.name).join(' et ')} ${P.show.winners.length > 1 ? 'se partagent' : 'remporte'} le pot avec : ${w0.hand}` : '';
    P.phase = 'show'; pkEnd(P);
  }
  function reward(P, s, n) { if (s.bot || !coins) return; const profit = n - s.total; if (profit >= BB * 2) coins.earnCapped(s.id, 'poker_win', 3, '🃏 Pot gagné au poker', 10); track(s.id, 'game'); }
  function pkEnd(P) {
    P.toAct = -1; if (P.phase !== 'show') P.phase = 'show'; sendPk(P); clearTimeout(P.timer);
    P.timer = setTimeout(() => { P.phase = 'wait'; for (const s of P.seats) if (s) { s.hole = []; s.bet = 0; s.total = 0; s.folded = false; s.allin = false; s.last = ''; } P.board = []; P.show = null; pkMaybeStart(P); }, 6500);
  }
  // 🤖 le robot du poker : il estime ses chances (des centaines de mains tirées au hasard) et joue en conséquence
  function equity(P, s) {
    const opp = P.seats.filter(o => o && o !== s && !o.folded).length; if (!opp) return 1;
    const known = new Set([...s.hole, ...P.board]), rest = [...Array(52).keys()].filter(c => !known.has(c)); let win = 0; const N = 140;
    for (let k = 0; k < N; k++) {
      const d = rest.slice(); for (let i = d.length - 1; i > d.length - 1 - (5 - P.board.length + opp * 2); i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
      let p = d.length; const board = [...P.board]; while (board.length < 5) board.push(d[--p]);
      const me = best7([...s.hole, ...board]).v; let ok = 1;
      for (let o = 0; o < opp; o++) { const v = best7([d[--p], d[--p], ...board]).v; if (v > me) { ok = 0; break; } if (v === me) ok = .5; }
      win += ok;
    }
    return win / N;
  }
  function botPoker(P, i) {
    const s = P.seats[i], toCall = P.curBet - s.bet, pot = P.seats.reduce((a, o) => a + (o ? o.total : 0), 0);
    const eq = equity(P, s), odds = toCall / Math.max(1, pot + toCall), bluff = Math.random() < .07;
    if ((eq > .72 || bluff) && s.chips > toCall) { const to = P.curBet + Math.max(P.minRaise, Math.floor(pot * (eq > .85 ? 1 : .55) / 10) * 10); return pkAct(P, i, { type: 'raise', to }); }
    if (toCall === 0) return pkAct(P, i, { type: 'check' });
    if (eq > odds + .06 || (toCall <= BB && eq > .25)) return pkAct(P, i, { type: 'call' });
    return pkAct(P, i, { type: 'fold' });
  }
  function pkLeave(P, uid) {
    const i = P.seats.findIndex(s => s && s.id === uid); if (i < 0) return;
    const s = P.seats[i];
    if (['preflop', 'flop', 'turn', 'river'].includes(P.phase)) {
      // ses jetons misés restent dans le pot : sa place devient un « fantôme » couché jusqu'à la fin de la main
      P.seats[i] = { ...s, id: -(9000 + botSeq++), bot: true, ghost: true, folded: true, last: 'Parti' };
      if (P.toAct === i) pkTurn(P, nextSeat(P, i, o => !o.folded && !o.allin)); else sendPk(P);
    } else { P.seats[i] = null; if (P.phase === 'wait') pkMaybeStart(P); else sendPk(P); }
  }

  // ---------- la connexion ----------
  function leave(uid) {
    const I = insts.get(where.get(uid)); where.delete(uid); if (!I) return;
    for (const s of sockets.get(uid) || []) s.leave(room(I.id));
    poolLeave(I, uid); pkLeave(I.poker, uid);
    I.players.delete(uid); io.to(room(I.id)).emit('cs_left', uid);
    if (!I.players.size) { for (const T of I.pool) clearTimeout(T.timer); clearTimeout(I.poker.timer); insts.delete(I.id); }
  }
  function onConnection(socket, uid, currentUser) {
    let set = sockets.get(uid); if (!set) sockets.set(uid, set = new Set()); set.add(socket);
    const ack = (cb, v) => typeof cb === 'function' && cb(v);
    const mine = () => insts.get(where.get(uid));
    socket.on('cs_enter', (o, cb) => {
      const u = currentUser(); if (!u) return ack(cb, { error: 'Connecte-toi d\'abord' });
      let I = mine();
      if (!I) { I = pickInst(); where.set(uid, I.id); I.players.set(uid, { id: uid, name: u.username, gender: u.gender || 'h', x: (Math.random() - .5) * 3, z: 11, yaw: Math.PI, st: '', drink: '' }); io.to(room(I.id)).emit('cs_join', pubPlayer(I.players.get(uid))); }
      for (const s of sockets.get(uid) || []) s.join(room(I.id));
      const P = I.poker, me = P.seats.find(s => s && s.id === uid);
      ack(cb, { inst: I.id, me: uid, drinks: DRINKS, players: [...I.players.values()].map(pubPlayer), pool: I.pool.map(poolOut), poker: pkOut(P), hole: me && me.hole.length ? { hand: P.hand, cards: me.hole } : null });
    });
    socket.on('cs_move', m => { const I = mine(), p = I && I.players.get(uid); if (!p || !m) return; const x = Number(m.x), z = Number(m.z), y = Number(m.yaw); if (![x, z, y].every(Number.isFinite)) return; p.x = Math.max(-20, Math.min(20, x)); p.z = Math.max(-16, Math.min(16, z)); p.yaw = y; I.dirty.add(uid); });
    socket.on('cs_status', st => { const I = mine(), p = I && I.players.get(uid); if (!p) return; p.st = String(st || '').slice(0, 40); io.to(room(I.id)).emit('cs_player', pubPlayer(p)); });
    socket.on('cs_drink', (k, cb) => { const I = mine(), p = I && I.players.get(uid); if (!p || !DRINKS[k]) return ack(cb, { error: 'Boisson inconnue' }); p.drink = k; io.to(room(I.id)).emit('cs_player', pubPlayer(p)); io.to(room(I.id)).emit('cs_say', { id: uid, text: `${DRINKS[k]}, s'il vous plaît !` }); ack(cb, { ok: true });
      clearTimeout(p.drinkT); p.drinkT = setTimeout(() => { if (p.drink === k) { p.drink = ''; io.to(room(I.id)).emit('cs_player', pubPlayer(p)); } }, 90000); });
    socket.on('cs_emote', e => { const I = mine(); if (!I || !I.players.has(uid)) return; const t = String(e || '').slice(0, 8); if (!/^\p{Extended_Pictographic}/u.test(t)) return; io.to(room(I.id)).emit('cs_emote', { id: uid, e: t }); });
    // billard
    socket.on('pl_sit', (t, cb) => {
      const I = mine(), u = currentUser(), T = I && I.pool[Number(t)]; if (!T || !u) return ack(cb, { error: 'Table introuvable' });
      if (T.players.some(p => p.id === uid)) return ack(cb, { ok: true });
      if (T.status === 'playing' || T.status === 'ended' || T.players.length >= 2) return ack(cb, { error: '🎱 Cette table est occupée : regarde la partie ou va à l\'autre table !' });
      poolLeave(I, uid); pkLeave(I.poker, uid);
      T.players.push({ id: uid, name: u.username, gender: u.gender || 'h' }); T.status = 'lobby'; T.msg = T.players.length === 1 ? `${u.username} attend un adversaire…` : '';
      if (T.players.length === 2) poolStart(I, T); else sendPool(I, T); ack(cb, { ok: true });
    });
    socket.on('pl_bot', t => { const I = mine(), T = I && I.pool[Number(t)]; if (!T || T.status !== 'lobby' || T.players.length !== 1 || T.players[0].id !== uid) return; T.players.push({ id: -(500 + T.t), name: 'Soldat76-Billard', bot: true, skill: .012 + Math.random() * .02 }); poolStart(I, T); });
    socket.on('pl_stand', () => { const I = mine(); if (I) poolLeave(I, uid); });
    socket.on('pl_shoot', s => { const I = mine(); if (!I || !s) return; const T = I.pool.find(T => T.players.some(p => p.id === uid)); if (!T) return; const p = T.players.find(p => p.id === uid);
      const v = { angle: Number(s.angle), power: Number(s.power), spin: Number(s.spin) || 0, cue: s.cue }; if (!Number.isFinite(v.angle) || !Number.isFinite(v.power)) return; poolShoot(I, T, p, v); });
    // poker
    socket.on('pk_sit', (seat, cb) => {
      const I = mine(), u = currentUser(); if (!I || !u) return ack(cb, { error: 'Entre d\'abord dans le club' }); const P = I.poker;
      if (P.seats.some(s => s && s.id === uid)) return ack(cb, { ok: true });
      let j = Number(seat); if (!(j >= 0 && j < SEATS) || (P.seats[j] && !(P.seats[j].bot && P.phase === 'wait'))) j = P.seats.findIndex(s => !s);
      if (j < 0 && P.phase === 'wait') j = P.seats.findIndex(s => s && s.bot);
      if (j < 0) return ack(cb, { error: '🃏 La table est pleine, attends qu\'une place se libère' });
      poolLeave(I, uid);
      P.seats[j] = { id: uid, name: u.username, chips: START_CHIPS, hole: [], bet: 0, total: 0, folded: P.phase !== 'wait', allin: false, last: P.phase !== 'wait' ? 'Prochaine main' : '' };
      if (P.phase === 'wait') pkMaybeStart(P); else sendPk(P);
      ack(cb, { ok: true, seat: j });
    });
    socket.on('pk_stand', () => { const I = mine(); if (I) pkLeave(I.poker, uid); });
    socket.on('pk_act', a => { const I = mine(); if (!I || !a) return; const P = I.poker, i = P.seats.findIndex(s => s && s.id === uid); if (i < 0) return; pkAct(P, i, { type: String(a.type), to: a.to }); });
    socket.on('cs_leave', () => leave(uid));
    socket.on('disconnect', () => { set.delete(socket); if (set.size) return; sockets.delete(uid); leave(uid); });
  }
  return { onConnection, _test: { eval5, best7 } };
};
