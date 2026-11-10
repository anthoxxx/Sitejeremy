// The Paradise — le Babyfoot de l'Île ⚽
// Un vrai babyfoot en direct : 2 équipes (🔴 rouge et 🔵 bleue), 1 ou 2 joueurs par équipe, ou un robot 🤖.
// Le serveur fait rouler la balle (60 fois par seconde) et envoie la partie à tout le monde 20 fois par seconde.
// Chaque joueur bouge ses barres (haut / bas) et tire. À 2 dans une équipe : l'un a la défense, l'autre l'attaque.
const W = 600, H = 340, R = 8, FW = 12, FH = 20, GOAL = 58, WIN = 5;
// Les 8 barres, de gauche à droite (les rouges défendent le but de gauche)
const RODS = [
  { x: 40, team: 'red', n: 1, gap: 0, group: 0 },
  { x: 110, team: 'red', n: 2, gap: 140, group: 0 },
  { x: 190, team: 'blue', n: 3, gap: 95, group: 1 },
  { x: 270, team: 'red', n: 4, gap: 70, group: 1 },
  { x: 330, team: 'blue', n: 4, gap: 70, group: 1 },
  { x: 410, team: 'red', n: 3, gap: 95, group: 1 },
  { x: 490, team: 'blue', n: 2, gap: 140, group: 0 },
  { x: 560, team: 'blue', n: 1, gap: 0, group: 0 },
];
// Position des petits joueurs d'une barre selon la position de la barre (0 = en haut, 1 = en bas)
function figures(rod, v) {
  const span = (rod.n - 1) * rod.gap;
  const lo = rod.n === 1 ? H / 2 - 70 : 25, hi = rod.n === 1 ? H / 2 + 70 : H - 25 - span;
  return Array.from({ length: rod.n }, (_, i) => lo + v * (hi - lo) + i * rod.gap);
}
const DIR = { red: 1, blue: -1 };

module.exports = function setupBabyfoot({ emitScene, inScene, bump, allowed }) {
  const now = () => Date.now();
  const games = new Map(); // scene -> partie
  const fresh = () => ({
    phase: 'lobby', slots: { red: [], blue: [] }, bot: null, score: { red: 0, blue: 0 }, msg: '', until: 0, winner: null,
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 }, pos: { red: [.5, .5], blue: [.5, .5] }, want: { red: [.5, .5], blue: [.5, .5] }, vel: { red: [0, 0], blue: [0, 0] },
    kick: { red: [0, 0], blue: [0, 0] }, still: 0, tick: 0, botAt: 0, botKick: 0, lastTouch: null,
  });
  const gameOf = scene => { let g = games.get(scene); if (!g) { g = fresh(); games.set(scene, g); } return g; };
  const out = (g, full) => ({
    phase: g.phase, score: g.score, msg: g.msg, until: g.until, winner: g.winner, bot: g.bot,
    ball: { x: Math.round(g.ball.x * 10) / 10, y: Math.round(g.ball.y * 10) / 10, vx: Math.round(g.ball.vx), vy: Math.round(g.ball.vy) },
    pos: { red: g.pos.red.map(v => Math.round(v * 1000) / 1000), blue: g.pos.blue.map(v => Math.round(v * 1000) / 1000) },
    kick: { red: g.kick.red.map(k => k > now()), blue: g.kick.blue.map(k => k > now()) },
    slots: full ? g.slots : undefined, t: now(),
  });
  const send = (scene, g, full = true) => emitScene(scene, 'bf', { scene, ...out(g, full) });
  const teamOf = (g, uid) => (g.slots.red.some(p => p.id === uid) ? 'red' : g.slots.blue.some(p => p.id === uid) ? 'blue' : null);
  // Quelle(s) barre(s) contrôle ce joueur : seul = tout, à deux = défense (0) ou attaque (1)
  const groupsOf = (g, team, uid) => { const s = g.slots[team]; if (s.length < 2) return [0, 1]; return [s.findIndex(p => p.id === uid)]; };

  function serve(g, toward) {
    g.ball = { x: W / 2, y: H / 2 + (Math.random() * 60 - 30), vx: (toward === 'red' ? -1 : 1) * 170, vy: Math.random() * 200 - 100 };
    g.still = 0;
  }
  function start(scene, g) {
    g.score = { red: 0, blue: 0 }; g.winner = null; g.phase = 'count'; g.until = now() + 3000; g.msg = '';
    g.pos = { red: [.5, .5], blue: [.5, .5] }; g.want = { red: [.5, .5], blue: [.5, .5] };
    g.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
    send(scene, g); loop();
  }
  const teamReady = (g, t) => g.slots[t].length > 0 || g.bot === t;

  // ---------- La physique ----------
  function step(scene, g, dt) {
    const t = now();
    // les barres glissent vers la position voulue (pas de téléportation)
    for (const team of ['red', 'blue']) for (const k of [0, 1]) {
      const d = g.want[team][k] - g.pos[team][k], mv = Math.max(-3.2 * dt, Math.min(3.2 * dt, d));
      g.pos[team][k] += mv; g.vel[team][k] = mv / dt;
    }
    const b = g.ball;
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.vx *= 0.9965; b.vy *= 0.9965;
    if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * .85; }
    if (b.y > H - R) { b.y = H - R; b.vy = -Math.abs(b.vy) * .85; }
    const inMouth = Math.abs(b.y - H / 2) < GOAL;
    if (b.x < R && !inMouth) { b.x = R; b.vx = Math.abs(b.vx) * .85; }
    if (b.x > W - R && !inMouth) { b.x = W - R; b.vx = -Math.abs(b.vx) * .85; }
    if (b.x < -R) return goal(scene, g, 'blue');
    if (b.x > W + R) return goal(scene, g, 'red');
    // les petits joueurs touchent la balle
    for (const rod of RODS) {
      const kicking = g.kick[rod.team][rod.group] > t;
      const reach = R + FW / 2 + (kicking ? 12 : 0);
      if (Math.abs(b.x - rod.x) > reach) continue;
      const ys = figures(rod, g.pos[rod.team][rod.group]);
      const fy = ys.find(y => Math.abs(b.y - y) < R + FH / 2);
      if (fy == null) continue;
      const side = Math.sign(b.x - rod.x) || DIR[rod.team];
      b.x = rod.x + side * (R + FW / 2 + .5);
      if (kicking) { b.vx = DIR[rod.team] * (600 + Math.random() * 160); b.vy = (b.y - fy) * 9 + g.vel[rod.team][rod.group] * 60 + (Math.random() * 80 - 40); g.kick[rod.team][rod.group] = 0; }
      else { b.vx = side * Math.max(Math.abs(b.vx) * .55, 70); b.vy += (b.y - fy) * 4 + g.vel[rod.team][rod.group] * 40; }
      const sp = Math.hypot(b.vx, b.vy); if (sp > 950) { b.vx *= 950 / sp; b.vy *= 950 / sp; }
      g.lastTouch = rod.team;
      break;
    }
    // balle bloquée trop longtemps : on la remet au milieu
    if (Math.hypot(b.vx, b.vy) < 22) { g.still += dt; if (g.still > 4) serve(g, Math.random() < .5 ? 'red' : 'blue'); } else g.still = 0;
    if (g.bot) robot(g, g.bot, t);
  }
  function goal(scene, g, team) {
    g.score[team]++;
    const other = team === 'red' ? 'blue' : 'red';
    const scorer = g.lastTouch === other ? 'Contre son camp !' : 'BUT !';
    g.ball = { x: team === 'red' ? W + 30 : -30, y: H / 2, vx: 0, vy: 0 };
    bump(scene, 8);
    if (g.score[team] >= WIN) {
      g.phase = 'end'; g.winner = team; g.until = now() + 7000;
      g.msg = `🏆 Les ${team === 'red' ? 'Rouges 🔴' : 'Bleus 🔵'} gagnent ${g.score[team]} à ${g.score[other]} !`;
      bump(scene, 25);
    } else { g.phase = 'goal'; g.until = now() + 1700; g.msg = `⚽ ${scorer} ${team === 'red' ? '🔴' : '🔵'}`; g.serveTo = other; }
    send(scene, g);
  }
  // 🤖 Le robot suit la balle avec un petit temps de retard (on peut le battre !)
  function robot(g, team, t) {
    if (t - g.botAt < 110) return;
    g.botAt = t;
    const b = g.ball, d = DIR[team];
    for (const k of [0, 1]) {
      const rods = RODS.filter(r => r.team === team && r.group === k);
      // la barre la plus proche de la balle (côté de son but)
      const rod = rods.sort((a, c) => Math.abs(a.x - b.x) - Math.abs(c.x - b.x))[0];
      const aim = b.y + b.vy * .08 + (Math.random() * 24 - 12);
      let best = g.want[team][k], bd = 1e9;
      for (let i = 0; i < rod.n; i++) {
        const lo = rod.n === 1 ? H / 2 - 70 : 25, hi = rod.n === 1 ? H / 2 + 70 : H - 25 - (rod.n - 1) * rod.gap;
        const v = Math.max(0, Math.min(1, (aim - lo - i * rod.gap) / (hi - lo)));
        const dist = Math.abs(v - g.pos[team][k]);
        if (dist < bd) { bd = dist; best = v; }
      }
      g.want[team][k] = best;
      // tirer quand la balle est juste devant
      const front = (b.x - rod.x) * d;
      if (front > -4 && front < 24 && t - g.botKick > 420 && Math.random() < .75) { g.kick[team][k] = t + 180; g.botKick = t; }
    }
  }

  // Une seule horloge pour toutes les parties en cours
  let timer = null;
  function loop() {
    if (timer) return;
    timer = setInterval(() => {
      let active = 0;
      for (const [scene, g] of games) {
        const t = now();
        if (g.phase === 'count') { active++; if (t >= g.until) { g.phase = 'play'; serve(g, Math.random() < .5 ? 'red' : 'blue'); send(scene, g); } continue; }
        if (g.phase === 'goal') { active++; if (t >= g.until) { g.phase = 'play'; g.msg = ''; serve(g, g.serveTo); send(scene, g); } continue; }
        if (g.phase === 'end') { if (t >= g.until) { g.phase = 'lobby'; g.msg = ''; send(scene, g); } else active++; continue; }
        if (g.phase !== 'play') continue;
        active++;
        for (let i = 0; i < 2 && g.phase === 'play'; i++) step(scene, g, 1 / 120); // 2 petits pas par image : la balle ne traverse pas les joueurs
        if (g.phase === 'play' && ++g.tick % 3 === 0) send(scene, g, false);
      }
      if (!active) { clearInterval(timer); timer = null; }
    }, 1000 / 60);
    timer.unref?.();
  }

  // Quelqu'un quitte la pièce : il quitte aussi la partie
  function leaveScene(uid, scene) {
    const g = games.get(scene);
    if (!g) return;
    const team = teamOf(g, uid);
    if (!team) return;
    g.slots[team] = g.slots[team].filter(p => p.id !== uid);
    if (g.phase !== 'lobby' && g.phase !== 'end' && !teamReady(g, team)) { g.phase = 'end'; g.winner = team === 'red' ? 'blue' : 'red'; g.until = now() + 5000; g.msg = `🏳️ Les ${team === 'red' ? 'Rouges' : 'Bleus'} ont quitté la partie`; }
    if (!g.slots.red.length && !g.slots.blue.length) g.bot = null;
    send(scene, g);
  }

  function onConnection(socket, uid, currentUser, sceneOf) {
    const ack = (cb, v) => typeof cb === 'function' && cb(v);
    const ctx = () => { const scene = sceneOf(); return scene && allowed(scene) ? { scene, g: gameOf(scene) } : null; };
    let lastMove = 0, lastKick = 0;
    socket.on('bf_state', cb => { const c = ctx(); if (!c) return ack(cb, { error: 'Il n\'y a pas de babyfoot ici' }); ack(cb, { scene: c.scene, ...out(c.g, true) }); });
    socket.on('bf_join', (team, cb) => {
      const c = ctx(), u = currentUser();
      if (!c || !u || !['red', 'blue'].includes(team)) return ack(cb, { error: 'Impossible' });
      const { g, scene } = c;
      if (g.phase !== 'lobby' && g.phase !== 'end' && !teamOf(g, uid)) return ack(cb, { error: 'Une partie est en cours : attends la fin ⏳' });
      if (g.bot === team) g.bot = null;
      const cur = teamOf(g, uid);
      if (cur === team) return ack(cb, { ok: true });
      if (g.slots[team].length >= 2) return ack(cb, { error: 'Cette équipe est complète (2 joueurs)' });
      if (cur) g.slots[cur] = g.slots[cur].filter(p => p.id !== uid);
      g.slots[team].push({ id: uid, username: u.username, color: u.color });
      send(scene, g); ack(cb, { ok: true });
    });
    socket.on('bf_leave', cb => { const c = ctx(); if (c) leaveScene(uid, c.scene); ack(cb, { ok: true }); });
    socket.on('bf_bot', cb => {
      const c = ctx();
      if (!c) return;
      const { g, scene } = c, team = teamOf(g, uid);
      if (!team) return ack(cb, { error: 'Choisis d\'abord ton équipe' });
      const other = team === 'red' ? 'blue' : 'red';
      if (g.slots[other].length) return ack(cb, { error: 'L\'autre équipe a déjà un joueur' });
      g.bot = g.bot ? null : other;
      send(scene, g); ack(cb, { ok: true });
    });
    socket.on('bf_start', cb => {
      const c = ctx();
      if (!c) return;
      const { g, scene } = c;
      if (!teamOf(g, uid)) return ack(cb, { error: 'Rejoins une équipe pour lancer la partie' });
      if (g.phase !== 'lobby' && g.phase !== 'end') return ack(cb, { error: 'La partie a déjà commencé' });
      if (!teamReady(g, 'red') || !teamReady(g, 'blue')) return ack(cb, { error: 'Il faut quelqu\'un dans chaque équipe (ou le robot 🤖)' });
      start(scene, g); ack(cb, { ok: true });
    });
    socket.on('bf_move', v => {
      const c = ctx();
      if (!c) return;
      const t = now();
      if (t - lastMove < 25) return;
      lastMove = t;
      const team = teamOf(c.g, uid); v = Number(v);
      if (!team || !Number.isFinite(v)) return;
      for (const k of groupsOf(c.g, team, uid)) c.g.want[team][k] = Math.max(0, Math.min(1, v));
    });
    socket.on('bf_kick', () => {
      const c = ctx();
      if (!c || c.g.phase !== 'play') return;
      const t = now();
      if (t - lastKick < 300) return;
      lastKick = t;
      const team = teamOf(c.g, uid);
      if (!team) return;
      for (const k of groupsOf(c.g, team, uid)) c.g.kick[team][k] = t + 180;
    });
  }
  return { onConnection, leaveScene };
};
module.exports.RODS = RODS;
