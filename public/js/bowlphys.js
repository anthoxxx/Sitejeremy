// The Paradise — 🎳 La physique du bowling (vue de dessus, en mètres) et le calcul des scores.
// Le même fichier sert au serveur (qui calcule chaque lancer, pour que tout le monde voie la même chose)
// et au navigateur (qui rejoue l'animation).
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.BowlPhys = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  const LANE = { half: .53, length: 18.29, gutter: .66, pit: 19.9, deckZ: 17.8, wall: .76 };
  const BALL = { r: .109, m: 7 }, PIN = { r: .062, rFall: .11, m: 1.6 };
  // les 10 quilles : 1 devant, puis 2, 3, 4 rangées (de gauche à droite)
  const PINS = []; for (let row = 0; row < 4; row++) for (let i = 0; i <= row; i++) PINS.push([(i - row / 2) * .3048, LANE.length + row * .264]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // un lancer : x = position de départ, angle (radians), speed (m/s), spin (-1 à 1 : l'effet), standing = quilles debout (10 booléens)
  function simulate(p, standing) {
    const x0 = clamp(+p.x || 0, -.45, .45), ang = clamp(+p.angle || 0, -.08, .08), sp = clamp(+p.speed || 7, 3, 10), spin = clamp(+p.spin || 0, -1, 1);
    const b = { x: x0, z: 0, vx: Math.sin(ang) * sp, vz: Math.cos(ang) * sp, gutter: false, gone: false, rot: 0 };
    const pins = PINS.map(([x, z], i) => ({ i, x, z, vx: 0, vz: 0, up: !!standing[i], fallen: false, gone: !standing[i], dir: 0, wob: 0 }));
    const out = [], dt = 1 / 240; let t = 0, k = 0, settle = 0;
    const hitPin = (q, vx, vz) => { // une quille touchée assez fort tombe
      const s = Math.hypot(vx, vz);
      if (q.up && s > .6) { q.up = false; q.fallen = true; q.dir = Math.atan2(vx, vz); }
      else if (q.up) { q.wob = Math.max(q.wob, s * 2); vx = vz = 0; }
      q.vx = vx; q.vz = vz;
    };
    while (t < 8) {
      // la boule
      if (!b.gone) {
        if (!b.gutter && b.z > 9 && b.z < LANE.length) b.vx += spin * .5 * dt; // l'effet : la boule tourne en fin de piste (la partie sèche)
        const v = Math.hypot(b.vx, b.vz); if (v > .01) { const f = Math.max(0, v - .12 * dt) / v; b.vx *= f; b.vz *= f; }
        b.x += b.vx * dt; b.z += b.vz * dt; b.rot += Math.hypot(b.vx, b.vz) * dt / BALL.r;
        if (!b.gutter && Math.abs(b.x) > LANE.half && b.z < LANE.deckZ) { b.gutter = true; b.x = Math.sign(b.x) * LANE.gutter; b.vx = 0; } // dans la rigole
        if (b.gutter) b.x = Math.sign(b.x) * LANE.gutter;
        if (b.z > LANE.deckZ && Math.abs(b.x) > LANE.wall - BALL.r) { b.x = Math.sign(b.x) * (LANE.wall - BALL.r); b.vx = -b.vx * .4; }
        if (b.z > LANE.pit) b.gone = true;
        // la boule contre les quilles
        if (!b.gutter) for (const q of pins) {
          if (q.gone) continue;
          const r = BALL.r + (q.up ? PIN.r : PIN.r * 1.4), dx = q.x - b.x, dz = q.z - b.z, d = Math.hypot(dx, dz);
          if (d < r && d > 1e-6) {
            const nx = dx / d, nz = dz / d, rel = (b.vx - q.vx) * nx + (b.vz - q.vz) * nz;
            if (rel > 0) { const j = (1 + .7) * rel / (1 / BALL.m + 1 / PIN.m); b.vx -= j / BALL.m * nx; b.vz -= j / BALL.m * nz; hitPin(q, q.vx + j / PIN.m * nx, q.vz + j / PIN.m * nz); }
            const push = r - d; q.x += nx * push; q.z += nz * push;
          }
        }
      }
      // les quilles qui volent
      for (const q of pins) {
        if (q.gone || q.up) continue;
        const v = Math.hypot(q.vx, q.vz); if (v > 1e-4) { const f = Math.max(0, v - 1.6 * dt) / v; q.vx *= f; q.vz *= f; }
        q.x += q.vx * dt; q.z += q.vz * dt;
        if (Math.abs(q.x) > LANE.wall) { q.x = Math.sign(q.x) * LANE.wall; q.vx = -q.vx * .55; } // les parois du fond
        if (q.z > LANE.pit || q.z < LANE.deckZ - .6) q.gone = true;
        for (const o of pins) { // une quille en touche une autre
          if (o === q || o.gone) continue;
          const r = (o.up ? PIN.r : PIN.rFall) + PIN.rFall, dx = o.x - q.x, dz = o.z - q.z, d = Math.hypot(dx, dz);
          if (d < r && d > 1e-6) {
            const nx = dx / d, nz = dz / d, rel = (q.vx - o.vx) * nx + (q.vz - o.vz) * nz;
            if (rel > 0) { const j = (1 + .35) * rel / 2; q.vx -= j * nx; q.vz -= j * nz; hitPin(o, o.vx + j * nx, o.vz + j * nz); }
            if (!o.up) { const push = (r - d) / 2; o.x += nx * push; o.z += nz * push; q.x -= nx * push; q.z -= nz * push; }
          }
        }
      }
      for (const q of pins) q.wob *= .995;
      // une image sur 8 (30 images par seconde) pour l'animation
      if (k++ % 8 === 0) out.push([+b.x.toFixed(3), +b.z.toFixed(3), +b.rot.toFixed(2), b.gone ? 1 : 0, pins.map(q => q.gone && !q.fallen ? null : [+q.x.toFixed(3), +q.z.toFixed(3), q.up ? 0 : 1, +q.dir.toFixed(2), +q.wob.toFixed(2), q.gone ? 1 : 0])]);
      t += dt;
      const still = pins.every(q => q.gone || q.up || Math.hypot(q.vx, q.vz) < .03);
      if ((b.gone || (b.gutter && b.z > LANE.pit)) && still) { if ((settle += dt) > .6) break; } else settle = 0;
    }
    const knocked = pins.filter(q => standing[q.i] && !q.up).map(q => q.i);
    return { frames: out, knocked, gutter: b.gutter };
  }

  // ---------- le score (règles officielles : 10 cases, strike = 10 + 2 lancers suivants, spare = 10 + 1 lancer) ----------
  function score(rolls) {
    const frames = []; let i = 0, total = 0;
    for (let f = 0; f < 10; f++) {
      if (i >= rolls.length) { frames.push({ marks: [], total: null }); continue; }
      if (f === 9) { // la 10e case : jusqu'à 3 lancers
        const r = rolls.slice(i, i + 3), marks = []; let prev = 0;
        r.forEach((v, k) => { const fresh = k === 0 || prev === 10 || (k === 2 && r[0] + r[1] === 10 && r[0] !== 10) || (k === 2 && r[0] === 10 && r[1] === 10);
          marks.push(v === 10 && fresh ? 'X' : !fresh && prev + v === 10 ? '/' : v === 0 ? '-' : String(v)); prev = fresh ? v : prev + v; if (prev === 10 && k < 2) prev = 10; });
        const need = r.length >= 2 && r[0] + r[1] < 10 ? 2 : 3, done = r.length >= need;
        if (done) total += r.slice(0, need).reduce((a, b) => a + b, 0);
        frames.push({ marks, total: done ? total : null }); i += r.length; continue;
      }
      const a = rolls[i];
      if (a === 10) { frames.push({ marks: ['', 'X'], total: rolls.length > i + 2 ? (total += 10 + rolls[i + 1] + rolls[i + 2]) : null }); i += 1; continue; }
      const b = rolls[i + 1];
      if (b === undefined) { frames.push({ marks: [a === 0 ? '-' : String(a)], total: null }); i += 1; continue; }
      if (a + b === 10) { frames.push({ marks: [a === 0 ? '-' : String(a), '/'], total: rolls.length > i + 2 ? (total += 10 + rolls[i + 2]) : null }); i += 2; continue; }
      frames.push({ marks: [a === 0 ? '-' : String(a), b === 0 ? '-' : String(b)], total: (total += a + b) }); i += 2;
    }
    // où en est le joueur : quelle case, quel lancer, partie finie ?
    let f = 0, j = 0; while (f < 9 && j < rolls.length) { if (rolls[j] === 10) { j++; } else { if (j + 1 >= rolls.length) break; j += 2; } f++; }
    const left = rolls.slice(j), tenthNeed = f === 9 ? (left.length >= 2 && left[0] + left[1] < 10 ? 2 : 3) : 0;
    const over = f === 9 && left.length >= tenthNeed;
    const best = frames.reduce((s, x) => (x.total != null ? x.total : s), 0);
    return { frames, total: best, frame: f, roll: f === 9 ? left.length : (j < rolls.length ? 1 : 0), over };
  }
  // les quilles debout au prochain lancer
  function standingAfter(rolls, knockedLists) {
    const s = score(rolls); const fresh = Array(10).fill(true);
    if (s.over) return fresh;
    if (s.frame < 9) { if (s.roll === 0) return fresh; const last = knockedLists[knockedLists.length - 1] || []; return fresh.map((_, i) => !last.includes(i)); }
    // 10e case : on remet les quilles après un strike ou un spare
    const left = rolls.slice(rolls.length - s.roll);
    if (s.roll === 0) return fresh;
    if (s.roll === 1) { if (left[0] === 10) return fresh; const last = knockedLists[knockedLists.length - 1] || []; return fresh.map((_, i) => !last.includes(i)); }
    if (left[0] === 10 && left[1] === 10) return fresh;
    if (left[0] === 10 || left[0] + left[1] === 10) { if (left[0] + left[1] === 10 && left[0] !== 10) return fresh; const last = knockedLists[knockedLists.length - 1] || []; return fresh.map((_, i) => !last.includes(i)); }
    return fresh;
  }
  return { simulate, score, standingAfter, LANE, BALL, PIN, PINS };
});
