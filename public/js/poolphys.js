// The Paradise — 🎱 La physique du billard (vue de dessus, en mètres) et les règles du « 8 » (billard américain).
// Le même fichier sert au serveur (qui calcule chaque coup, pour que tout le monde voie la même chose et que personne ne triche)
// et au navigateur (qui rejoue l'animation et dessine la ligne de visée).
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.PoolPhys = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  const T = { L: 2.24, W: 1.12 }, R = .0286, HX = T.L / 2, HZ = T.W / 2;
  // les 6 poches : 4 coins + 2 au milieu des grands côtés
  const POCKETS = [[-HX, -HZ, .062], [0, -HZ - .01, .058], [HX, -HZ, .062], [-HX, HZ, .062], [0, HZ + .01, .058], [HX, HZ, .062]];
  const HEAD = [-HX / 2, 0], FOOT = [HX / 2, 0];
  const kind = n => n === 0 ? 'cue' : n === 8 ? 'eight' : n < 8 ? 'solid' : 'stripe';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // la mise en place : le triangle, la noire au milieu, une pleine et une rayée dans les coins du fond
  function rack(seed = Math.random()) {
    let s = Math.floor(seed * 2147483647) || 1; const rnd = () => (s = s * 16807 % 2147483647) / 2147483647;
    const rest = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    // coins du fond : une pleine et une rayée
    const sol = rest.findIndex(n => n < 8), a = rest.splice(sol, 1)[0], str = rest.findIndex(n => n > 8), b = rest.splice(str, 1)[0];
    const balls = Array(16).fill(null); balls[0] = [HEAD[0], 0];
    const dx = R * 2 * Math.cos(Math.PI / 6) + .0004, dz = R + .0002;
    let k = 0;
    for (let row = 0; row < 5; row++) for (let i = 0; i <= row; i++) {
      const p = [FOOT[0] + row * dx, (i - row / 2) * dz * 2];
      let n; if (row === 2 && i === 1) n = 8; else if (row === 4 && i === 0) n = a; else if (row === 4 && i === 4) n = b; else n = rest[k++];
      balls[n] = p;
    }
    return balls;
  }

  // un coup : angle (radians, 0 = vers +x), power (0 à 1), spin (-1 = rétro, +1 = coulé)
  function simulate(balls0, shot) {
    const ang = +shot.angle || 0, pw = clamp(+shot.power || 0, .02, 1), spin = clamp(+shot.spin || 0, -1, 1);
    const B = balls0.map((p, n) => p ? { n, x: p[0], z: p[1], vx: 0, vz: 0, on: true } : { n, on: false });
    const cue = B[0]; const sp = .25 + pw * 5.2; cue.vx = Math.cos(ang) * sp; cue.vz = Math.sin(ang) * sp;
    const dt = 1 / 480, frames = [], events = [], potted = []; let t = 0, k = 0, first = null, spun = false, rails = 0;
    const snap = () => frames.push(B.map(b => b.on ? [+b.x.toFixed(4), +b.z.toFixed(4)] : b.pk != null ? [99, b.pk] : null));
    snap();
    while (t < 14) {
      let moving = false;
      for (const b of B) {
        if (!b.on) continue;
        const v = Math.hypot(b.vx, b.vz);
        if (v > 0) { const f = Math.max(0, v - (v > .08 ? .32 : .5) * dt) / v; b.vx *= f; b.vz *= f; } // le tapis freine la bille
        if (v > .004) moving = true; else { b.vx = b.vz = 0; }
        b.x += b.vx * dt; b.z += b.vz * dt;
        // dans une poche ?
        for (let p = 0; p < 6; p++) { const [px, pz, pr] = POCKETS[p]; if (Math.hypot(b.x - px, b.z - pz) < pr) { b.on = false; b.pk = p; potted.push(b.n); events.push([+t.toFixed(3), 'pocket', b.n, p]); break; } }
        if (!b.on) continue;
        // les bandes (sauf devant l'ouverture des poches)
        const nearCornerZ = Math.abs(b.z) > HZ - .075, nearCornerX = Math.abs(b.x) > HX - .075, nearSide = Math.abs(b.x) < .065;
        if (Math.abs(b.x) > HX - R && !nearCornerZ) { b.x = Math.sign(b.x) * (HX - R); b.vx = -b.vx * .78; b.vz *= .96; rails++; events.push([+t.toFixed(3), 'rail', +Math.abs(b.vx).toFixed(2)]); }
        if (Math.abs(b.z) > HZ - R && !nearCornerX && !nearSide) { b.z = Math.sign(b.z) * (HZ - R); b.vz = -b.vz * .78; b.vx *= .96; rails++; events.push([+t.toFixed(3), 'rail', +Math.abs(b.vz).toFixed(2)]); }
        // sortie par l'ouverture d'une poche = dans la poche
        if (Math.abs(b.x) > HX + .02 || Math.abs(b.z) > HZ + .02) { let bp = 0, bd = 9; POCKETS.forEach(([px, pz], i) => { const d = Math.hypot(b.x - px, b.z - pz); if (d < bd) { bd = d; bp = i; } }); b.on = false; b.pk = bp; potted.push(b.n); events.push([+t.toFixed(3), 'pocket', b.n, bp]); }
      }
      // les chocs entre billes
      for (let i = 0; i < 16; i++) { const a = B[i]; if (!a.on) continue;
        for (let j = i + 1; j < 16; j++) { const b = B[j]; if (!b.on) continue;
          const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz; if (d2 >= 4 * R * R || d2 < 1e-12) continue;
          const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
          const push = (2 * R - d) / 2; a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
          if (rel <= 0) continue;
          const j2 = rel * .97; a.vx -= j2 * nx; a.vz -= j2 * nz; b.vx += j2 * nx; b.vz += j2 * nz;
          events.push([+t.toFixed(3), 'click', +rel.toFixed(2)]);
          if (first === null && (a.n === 0 || b.n === 0)) first = a.n === 0 ? b.n : a.n;
          // l'effet : la blanche continue (coulé) ou revient (rétro) après le premier choc
          if (!spun && (a.n === 0 || b.n === 0)) { spun = true; const c = a.n === 0 ? a : b, s0 = rel * .55 * spin; c.vx += Math.cos(ang) * s0; c.vz += Math.sin(ang) * s0; }
        }
      }
      if (k++ % 16 === 0) snap();
      t += dt;
      if (!moving && t > .1) break;
    }
    snap();
    return { frames, events, potted, first, rails, balls: B.map(b => b.on ? [+b.x.toFixed(4), +b.z.toFixed(4)] : null) };
  }

  // la ligne de visée : où la blanche va toucher (une bille ou une bande)
  function aimLine(balls, ang) {
    const c = balls[0]; if (!c) return null; const dx = Math.cos(ang), dz = Math.sin(ang);
    let best = 9, hit = null;
    for (let n = 1; n < 16; n++) { const b = balls[n]; if (!b) continue;
      const ex = b[0] - c[0], ez = b[1] - c[1], tt = ex * dx + ez * dz; if (tt <= 0) continue;
      const px = ex - dx * tt, pz = ez - dz * tt, off = Math.hypot(px, pz); if (off >= 2 * R) continue;
      const d = tt - Math.sqrt(4 * R * R - off * off); if (d < best) { best = d; hit = n; } }
    let wall = 9; if (dx) wall = Math.min(wall, ((dx > 0 ? HX : -HX) - Math.sign(dx) * R - c[0]) / dx); if (dz) wall = Math.min(wall, ((dz > 0 ? HZ : -HZ) - Math.sign(dz) * R - c[1]) / dz);
    if (hit === null || wall < best) return { end: [c[0] + dx * wall, c[1] + dz * wall], hit: null };
    const gx = c[0] + dx * best, gz = c[1] + dz * best, b = balls[hit], nx = b[0] - gx, nz = b[1] - gz, l = Math.hypot(nx, nz) || 1;
    return { end: [gx, gz], hit, dir: [nx / l, nz / l] };
  }

  // ---------- les règles du 8 ----------
  // st = { balls, groups: { [uid]: 'solid'|'stripe' } | null, open: true, turn: uid, opp: uid, broke: false }
  // renvoie { foul, keep (le joueur rejoue), win (uid gagnant) | null, assign, msg }
  function judge(st, shooter, other, res) {
    const g = st.groups ? st.groups[shooter] : null, mine = n => g ? kind(n) === g : (kind(n) === 'solid' || kind(n) === 'stripe');
    const left = (grp, balls) => balls.some((p, n) => p && kind(n) === grp);
    const scratch = res.potted.includes(0), eight = res.potted.includes(8);
    let foul = null;
    if (res.first === null) foul = 'La blanche n\'a touché aucune bille';
    else if (g && res.first === 8 && left(g, st.balls)) foul = 'Il faut toucher une de tes billes avant la noire';
    else if (g && res.first !== 8 && kind(res.first) !== g) foul = 'Tu as touché une bille de l\'autre joueur en premier';
    else if (!g && res.first === 8 && st.broke) foul = 'On ne touche pas la noire en premier tant que les couleurs ne sont pas choisies';
    if (scratch) foul = 'La blanche est tombée dans une poche';
    // la noire
    if (eight) {
      const cleared = g && !left(g, res.balls);
      if (cleared && !scratch && !foul) return { win: shooter, msg: '🎱 La noire au fond : victoire !' };
      return { win: other, msg: scratch ? '💥 La noire et la blanche tombées : perdu !' : '💥 La noire est tombée trop tôt : perdu !' };
    }
    let assign = null;
    if (!st.groups && !foul && st.broke) { const p = res.potted.find(n => n !== 0 && n !== 8); if (p) assign = kind(p); }
    const legalPot = res.potted.some(n => n !== 0 && n !== 8 && (assign ? kind(n) === assign : mine(n)));
    return { foul, keep: !foul && (legalPot || (!st.broke && res.potted.some(n => n !== 0))), win: null, assign };
  }
  return { T, R, POCKETS, HEAD, FOOT, kind, rack, simulate, aimLine, judge };
});
