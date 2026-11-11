// The Paradise — Les animaux de compagnie 🐾
// Chaque membre peut adopter un animal qui le suit sur l'Île du Paradise.
// On le nourrit, on joue avec lui, on le câline : il grandit (bébé → ado → adulte → légendaire) et il a son humeur.
// S'il a trop faim ou s'il s'ennuie, il devient triste… et il prévient son maître !
const SPECIES = {
  chiot: { name: 'Chiot', icon: '🐶', price: 0 }, chaton: { name: 'Chaton', icon: '🐱', price: 0 }, lapin: { name: 'Lapin', icon: '🐰', price: 0 },
  hamster: { name: 'Hamster', icon: '🐹', price: 0 }, renard: { name: 'Renard', icon: '🦊', price: 0 }, pingouin: { name: 'Pingouin', icon: '🐧', price: 0 },
  panda: { name: 'Panda', icon: '🐼', price: 150 }, koala: { name: 'Koala', icon: '🐨', price: 150 }, tigre: { name: 'Tigre', icon: '🐯', price: 300 },
  dragon: { name: 'Dragon', icon: '🐉', price: 600 }, licorne: { name: 'Licorne', icon: '🦄', price: 800 }, phoenix: { name: 'Phénix', icon: '🐦‍🔥', price: 1200 },
};
const ACCESSORIES = {
  noeud: { name: 'Nœud', icon: '🎀', price: 40 }, fleur: { name: 'Fleur', icon: '🌸', price: 40 }, casquette: { name: 'Casquette', icon: '🧢', price: 60 },
  lunettes: { name: 'Lunettes de soleil', icon: '🕶️', price: 80 }, chapeau: { name: 'Chapeau haut-de-forme', icon: '🎩', price: 120 }, fete: { name: 'Chapeau de fête', icon: '🥳', price: 90 },
  couronne: { name: 'Couronne', icon: '👑', price: 300 }, halo: { name: 'Auréole', icon: '😇', price: 250 }, coeur: { name: 'Cœur flottant', icon: '💖', price: 150 },
};
const STAGES = [['bebe', 'Bébé', 0], ['ado', 'Ado', 150], ['adulte', 'Adulte', 500], ['legende', 'Légendaire ✨', 1500]];
const ACTIONS = {
  feed: { name: 'Nourrir', icon: '🍖', cd: 20 * 60000, food: 35, joy: 3, xp: 6 },
  play: { name: 'Jouer', icon: '🎾', cd: 10 * 60000, food: -6, joy: 25, xp: 8 },
  hug: { name: 'Câliner', icon: '💖', cd: 4 * 60000, food: 0, joy: 10, xp: 3 },
  treat: { name: 'Friandise', icon: '🍬', cd: 0, food: 20, joy: 20, xp: 15, price: 20 },
};
const DECAY = { food: 4, joy: 3 }; // points perdus par heure

module.exports = function setupPets({ db, coins, notify, track, onChange = () => {} }) {
  const now = () => Date.now();
  db.exec(`CREATE TABLE IF NOT EXISTS pets (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, species TEXT NOT NULL, name TEXT NOT NULL,
    born_at INTEGER NOT NULL DEFAULT 0, xp INTEGER NOT NULL DEFAULT 0, food REAL NOT NULL DEFAULT 80, joy REAL NOT NULL DEFAULT 80, updated_at INTEGER NOT NULL DEFAULT 0,
    accessory TEXT NOT NULL DEFAULT '', items TEXT NOT NULL DEFAULT '[]', cooldowns TEXT NOT NULL DEFAULT '{}', warned_at INTEGER NOT NULL DEFAULT 0)`);
  const parse = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };
  const row = uid => db.prepare('SELECT * FROM pets WHERE user_id=?').get(uid);
  // L'état de l'animal maintenant (la faim et l'ennui avancent avec le temps)
  function live(r, t = now()) {
    const h = Math.max(0, (t - r.updated_at) / 3600000);
    return { food: Math.max(0, r.food - DECAY.food * h), joy: Math.max(0, r.joy - DECAY.joy * h) };
  }
  const stageOf = xp => { let s = STAGES[0]; for (const st of STAGES) if (xp >= st[2]) s = st; return s; };
  const moodOf = (food, joy) => { const m = (food + joy) / 2; if (food < 15) return ['starving', '😭', 'a très faim !']; if (m > 70) return ['happy', '😄', 'est très heureux']; if (m > 45) return ['ok', '🙂', 'va bien']; if (m > 20) return ['sad', '😢', 'est triste']; return ['sad', '😭', 'se sent seul']; };
  function out(r) {
    if (!r) return null;
    const { food, joy } = live(r), st = stageOf(r.xp), next = STAGES[STAGES.indexOf(st) + 1], mood = moodOf(food, joy), cds = parse(r.cooldowns, {});
    return {
      species: r.species, icon: SPECIES[r.species]?.icon || '🐾', speciesName: SPECIES[r.species]?.name || '', name: r.name, bornAt: r.born_at,
      xp: r.xp, stage: st[0], stageName: st[1], nextAt: next ? next[2] : null, nextName: next ? next[1] : null,
      food: Math.round(food), joy: Math.round(joy), mood: mood[0], moodIcon: mood[1], moodText: mood[2],
      accessory: r.accessory, accIcon: ACCESSORIES[r.accessory]?.icon || '', items: parse(r.items, []),
      ready: Object.fromEntries(Object.entries(ACTIONS).map(([k, a]) => [k, Math.max(0, (cds[k] || 0) + a.cd - now())])),
    };
  }
  // Version courte pour l'Île (le petit animal qui suit son maître)
  const mini = uid => { const r = row(uid); if (!r) return null; const o = out(r); return { icon: o.icon, stage: o.stage, acc: o.accIcon, name: o.name, mood: o.mood }; };

  function adopt(uid, species, name) {
    if (row(uid)) return { error: 'Tu as déjà un animal 🐾' };
    const sp = SPECIES[species];
    if (!sp) return { error: 'Choisis un animal' };
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 20) || sp.name;
    if (sp.price && !coins.spend(uid, sp.price, `🐾 Adoption : ${sp.name}`)) return { error: `Il te faut ${sp.price} pièces pour adopter ce ${sp.name.toLowerCase()} 💰` };
    db.prepare('INSERT INTO pets (user_id,species,name,born_at,updated_at) VALUES (?,?,?,?,?)').run(uid, species, name, now(), now());
    track(uid, 'pet_adopt');
    onChange(uid);
    return { ok: true, pet: out(row(uid)) };
  }
  function act(uid, action) {
    const r = row(uid), a = ACTIONS[action];
    if (!r || !a) return { error: 'Pas d\'animal' };
    const cds = parse(r.cooldowns, {}), wait = (cds[action] || 0) + a.cd - now();
    if (wait > 0) return { error: `${r.name} a besoin d'une pause : encore ${Math.ceil(wait / 60000)} min ⏳` };
    if (a.price && !coins.spend(uid, a.price, `🍬 Friandise pour ${r.name}`)) return { error: `Une friandise coûte ${a.price} pièces 💰` };
    const { food, joy } = live(r);
    const before = stageOf(r.xp)[0];
    cds[action] = now();
    db.prepare('UPDATE pets SET food=?, joy=?, xp=xp+?, updated_at=?, cooldowns=? WHERE user_id=?').run(Math.max(0, Math.min(100, food + a.food)), Math.max(0, Math.min(100, joy + a.joy)), a.xp, now(), JSON.stringify(cds), uid);
    track(uid, 'pet');
    const after = stageOf(row(uid).xp);
    if (after[0] !== before) {
      notify(uid, { type: 'pet', icon: SPECIES[r.species]?.icon || '🐾', title: `${r.name} a grandi ! Il est maintenant « ${after[1]} » 🎉`, text: 'Va le voir sur l\'Île du Paradise', important: true });
      if (after[0] === 'adulte' || after[0] === 'legende') track(uid, 'pet_adult');
    }
    onChange(uid);
    return { ok: true, pet: out(row(uid)), grew: after[0] !== before ? after[1] : null };
  }
  function buyAccessory(uid, id) {
    const r = row(uid), acc = ACCESSORIES[id];
    if (!r || !acc) return { error: 'Impossible' };
    const items = parse(r.items, []);
    if (!items.includes(id)) {
      if (!coins.spend(uid, acc.price, `🎀 Accessoire pour ${r.name} : ${acc.name}`)) return { error: `Il te faut ${acc.price} pièces 💰` };
      items.push(id);
    }
    db.prepare('UPDATE pets SET items=?, accessory=? WHERE user_id=?').run(JSON.stringify(items), id, uid);
    onChange(uid);
    return { ok: true, pet: out(row(uid)) };
  }
  function setAcc(uid, id) { const r = row(uid); if (!r) return { error: 'Pas d\'animal' }; if (id && !parse(r.items, []).includes(id)) return { error: 'Achète d\'abord cet accessoire' }; db.prepare('UPDATE pets SET accessory=? WHERE user_id=?').run(id || '', uid); onChange(uid); return { ok: true, pet: out(row(uid)) }; }
  function rename(uid, name) { const r = row(uid); name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 20); if (!r || !name) return { error: 'Choisis un nom' }; db.prepare('UPDATE pets SET name=? WHERE user_id=?').run(name, uid); onChange(uid); return { ok: true, pet: out(row(uid)) }; }
  function release(uid) { db.prepare('DELETE FROM pets WHERE user_id=?').run(uid); onChange(uid); return { ok: true }; }

  // ⏰ Toutes les 30 minutes : un animal qui a faim prévient son maître (une fois toutes les 12 heures)
  setInterval(() => {
    const t = now();
    for (const r of db.prepare('SELECT * FROM pets WHERE warned_at<?').all(t - 12 * 3600000)) {
      const { food, joy } = live(r, t);
      if (food > 20 && joy > 15) continue;
      db.prepare('UPDATE pets SET warned_at=? WHERE user_id=?').run(t, r.user_id);
      notify(r.user_id, { type: 'pet', icon: SPECIES[r.species]?.icon || '🐾', title: food <= 20 ? `${r.name} a faim ! 🍖` : `${r.name} s'ennuie sans toi… 😢`, text: 'Viens t\'occuper de lui (menu de ton compte → 🐾 Mon animal)' });
    }
  }, 30 * 60000).unref?.();

  return { SPECIES, ACCESSORIES, ACTIONS, STAGES, get: uid => out(row(uid)), mini, adopt, act, buyAccessory, setAcc, rename, release };
};
