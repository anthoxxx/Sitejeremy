// The Paradise — Quêtes du jour 🎯, Succès 🏆 et Niveaux ⭐
// Tout ce que fait un membre sur le site compte (messages, jeux, île, animal, voyante…) :
// ça fait avancer ses 3 quêtes du jour, débloque des succès pour toujours, et lui donne de l'expérience (XP) pour monter de niveau.
const QUESTS = [
  { id: 'msg10', kind: 'message', goal: 10, coins: 15, xp: 30, icon: '💬', text: 'Envoie 10 messages dans les salons' },
  { id: 'msg30', kind: 'message', goal: 30, coins: 30, xp: 50, icon: '🗣️', text: 'Envoie 30 messages dans les salons' },
  { id: 'game1', kind: 'game', goal: 1, coins: 15, xp: 30, icon: '🎮', text: 'Joue une partie à un jeu (Mot d\'Or, Roue, Blind Test, Sommet, Paroles d\'Or)' },
  { id: 'win1', kind: 'game_win', goal: 1, coins: 30, xp: 50, icon: '🏆', text: 'Gagne une partie à un jeu' },
  { id: 'bf1', kind: 'babyfoot', goal: 1, coins: 20, xp: 30, icon: '⚽', text: 'Joue une partie de babyfoot' },
  { id: 'island', kind: 'island', goal: 1, coins: 10, xp: 20, icon: '🏝️', text: 'Va te promener sur l\'Île du Paradise' },
  { id: 'visit', kind: 'visit_house', goal: 1, coins: 20, xp: 30, icon: '🏡', text: 'Rends visite à la maison d\'un autre membre' },
  { id: 'places', kind: 'visit_place', goal: 3, coins: 15, xp: 30, icon: '🗺️', text: 'Entre dans 3 lieux de l\'Île (club, ciné, café, piscine…)' },
  { id: 'dance', kind: 'dance', goal: 3, coins: 15, xp: 25, icon: '💃', text: 'Danse 3 fois sur l\'Île' },
  { id: 'cafe', kind: 'cafe', goal: 1, coins: 10, xp: 20, icon: '☕', text: 'Commande quelque chose au Café Paradise' },
  { id: 'pet', kind: 'pet', goal: 3, coins: 15, xp: 30, icon: '🐾', text: 'Nourris, câline ou joue 3 fois avec ton animal' },
  { id: 'fortune', kind: 'fortune', goal: 1, coins: 10, xp: 20, icon: '🔮', text: 'Va voir la Voyante du Paradise' },
  { id: 'arcade', kind: 'arcade', goal: 5, coins: 20, xp: 30, icon: '🕹️', text: 'Joue 5 fois à l\'Arcade (machine à sous, fléchettes, pince)' },
  { id: 'emote', kind: 'emote', goal: 5, coins: 10, xp: 20, icon: '👋', text: 'Envoie 5 gestes sur l\'Île' },
  { id: 'daily', kind: 'daily', goal: 1, coins: 5, xp: 15, icon: '🎁', text: 'Prends ton bonus du jour' },
];
const ACHIEVEMENTS = [
  { id: 'member', kind: 'member', goal: 1, icon: '🧍', name: 'Habitant du Paradise', desc: 'Inscrit sur The Paradise', coins: 10 },
  { id: 'room', kind: 'room_create', goal: 1, icon: '🏗️', name: 'Bâtisseur', desc: 'Crée un salon permanent', coins: 50 },
  { id: 'temproom', kind: 'temp_room', goal: 1, icon: '⏳', name: 'Animateur', desc: 'Crée un salon temporaire', coins: 20 },
  { id: 'photo', kind: 'photo', goal: 1, icon: '📸', name: 'Photogénique', desc: 'Mets une photo de profil', coins: 20 },
  { id: 'verified', kind: 'verified', goal: 1, icon: '✅', name: 'Membre vérifié', desc: 'Validé par l\'équipe à la douane', coins: 40 },
  { id: 'friend1', kind: 'friend', goal: 1, icon: '🤝', name: 'Premier ami', desc: 'Ton premier ami sur le site', coins: 20 },
  { id: 'friend10', kind: 'friend', goal: 10, icon: '👥', name: 'Populaire', desc: '10 amis', coins: 100 },
  { id: 'pm1', kind: 'pm', goal: 1, icon: '💌', name: 'Premier message privé', desc: 'Envoie un message privé', coins: 10 },
  { id: 'voice', kind: 'voice', goal: 1, icon: '🎙️', name: 'Au micro', desc: 'Va dans le vocal d\'un salon', coins: 20 },
  { id: 'look', kind: 'look', goal: 1, icon: '🧑‍🎨', name: 'Styliste', desc: 'Crée ton personnage de l\'Île', coins: 20 },
  { id: 'deco', kind: 'house_deco', goal: 1, icon: '🛋️', name: 'Décorateur', desc: 'Place tes meubles chez toi', coins: 20 },
  { id: 'shop1', kind: 'shop', goal: 1, icon: '🛍️', name: 'Premier achat', desc: 'Achète quelque chose dans la boutique', coins: 15 },
  { id: 'msg100', kind: 'message', goal: 100, icon: '💬', name: 'Bavard', desc: '100 messages envoyés', coins: 50 },
  { id: 'msg1000', kind: 'message', goal: 1000, icon: '🗣️', name: 'Pipelette légendaire', desc: '1 000 messages envoyés', coins: 300 },
  { id: 'night', kind: 'night', goal: 1, icon: '🦉', name: 'Noctambule', desc: 'Un message entre 2 h et 5 h du matin', coins: 30 },
  { id: 'win1', kind: 'game_win', goal: 1, icon: '🏆', name: 'Première victoire', desc: 'Gagne ta première partie', coins: 30 },
  { id: 'win25', kind: 'game_win', goal: 25, icon: '🥇', name: 'Champion du Paradise', desc: '25 parties gagnées', coins: 250 },
  { id: 'bf10', kind: 'babyfoot_win', goal: 10, icon: '⚽', name: 'Roi du babyfoot', desc: '10 victoires au babyfoot', coins: 150 },
  { id: 'island', kind: 'island', goal: 1, icon: '🏝️', name: 'Explorateur', desc: 'Première balade sur l\'Île', coins: 20 },
  { id: 'places50', kind: 'visit_place', goal: 50, icon: '🧭', name: 'Grand voyageur', desc: '50 visites de lieux sur l\'Île', coins: 150 },
  { id: 'visit10', kind: 'visit_house', goal: 10, icon: '🏡', name: 'Voisin sympa', desc: '10 visites chez les autres', coins: 100 },
  { id: 'dance50', kind: 'dance', goal: 50, icon: '🕺', name: 'Roi de la piste', desc: 'Danse 50 fois', coins: 120 },
  { id: 'cafe20', kind: 'cafe', goal: 20, icon: '☕', name: 'Habitué du café', desc: '20 commandes au Café Paradise', coins: 100 },
  { id: 'pet1', kind: 'pet_adopt', goal: 1, icon: '🐣', name: 'Nouveau compagnon', desc: 'Adopte un animal', coins: 30 },
  { id: 'pet100', kind: 'pet', goal: 100, icon: '🐾', name: 'Ami des bêtes', desc: '100 câlins, repas et jeux avec ton animal', coins: 200 },
  { id: 'petadult', kind: 'pet_adult', goal: 1, icon: '🦁', name: 'Il a bien grandi !', desc: 'Ton animal devient adulte', coins: 150 },
  { id: 'fortune7', kind: 'fortune', goal: 7, icon: '🔮', name: 'Esprit mystique', desc: '7 visites chez la Voyante', coins: 80 },
  { id: 'arcade50', kind: 'arcade', goal: 50, icon: '🕹️', name: 'Pro de l\'arcade', desc: '50 parties à l\'Arcade', coins: 150 },
  { id: 'daily7', kind: 'daily', goal: 7, icon: '📅', name: 'Fidèle', desc: '7 bonus du jour', coins: 100 },
  { id: 'daily30', kind: 'daily', goal: 30, icon: '💎', name: 'Pilier du Paradise', desc: '30 bonus du jour', coins: 400 },
  { id: 'party', kind: 'party', goal: 1, icon: '🎉', name: 'Fêtard', desc: 'Participe à une soirée événement', coins: 50 },
  { id: 'quest10', kind: 'quest', goal: 10, icon: '🎯', name: 'Aventurier', desc: '10 quêtes du jour réussies', coins: 120 },
  { id: 'quest50', kind: 'quest', goal: 50, icon: '🗡️', name: 'Héros du Paradise', desc: '50 quêtes du jour réussies', coins: 400 },
  { id: 'gift', kind: 'gift', goal: 1, icon: '💝', name: 'Cœur généreux', desc: 'Offre des pièces à quelqu\'un', coins: 30 },
  { id: 'lvl10', kind: 'level', goal: 10, icon: '🌟', name: 'Étoile montante', desc: 'Atteins le niveau 10', coins: 200 },
  { id: 'lvl25', kind: 'level', goal: 25, icon: '👑', name: 'Légende du Paradise', desc: 'Atteins le niveau 25', coins: 600 },
];
// Expérience gagnée pour chaque chose qu'on fait
const XP = { room_create: 20, temp_room: 5, photo: 10, verified: 20, friend: 5, pm: 1, voice: 5, look: 10, house_deco: 5, shop: 5, member: 5, message: 1, game: 5, game_win: 25, babyfoot: 8, babyfoot_win: 15, island: 5, visit_place: 3, visit_house: 8, dance: 1, cafe: 3, pet: 2, pet_adopt: 20, fortune: 5, arcade: 1, emote: 0, daily: 10, party: 20, gift: 5, night: 0 };
const XP_CAP = { pm: 20, voice: 15, message: 120, dance: 20, arcade: 30, pet: 30, visit_place: 30 }; // XP maximum par jour pour ces actions
// Niveau : il faut 100 XP pour passer au niveau 2, puis 50 de plus à chaque niveau
const levelOf = xp => { let lvl = 1, need = 100, rest = xp; while (rest >= need) { rest -= need; lvl++; need += 50; } return { level: lvl, into: rest, need }; };
const parisDay = (ts = Date.now()) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts);
const parisHour = (ts = Date.now()) => +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(ts);
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

module.exports = function setupProgress({ db, earn, notify, emitToUser, getUser, onBadge = () => {} }) {
  const now = () => Date.now();
  db.exec(`CREATE TABLE IF NOT EXISTS user_stats (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, kind))`);
  db.exec(`CREATE TABLE IF NOT EXISTS user_quests (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL, quest TEXT NOT NULL, progress INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day, quest))`);
  db.exec(`CREATE TABLE IF NOT EXISTS user_achievements (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, id))`);
  try { db.exec("ALTER TABLE users ADD COLUMN xp INTEGER NOT NULL DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN badges_show TEXT NOT NULL DEFAULT ''"); } catch (e) {}
  // 🏅 Les badges affichés sous le pseudo (6 au maximum) : ceux choisis par le membre, sinon les derniers gagnés
  const shownCache = new Map();
  function shown(uid) {
    if (shownCache.has(uid)) return shownCache.get(uid);
    const got = db.prepare('SELECT id FROM user_achievements WHERE user_id=? ORDER BY created_at DESC').all(uid).map(r => r.id);
    let pick = null; try { pick = JSON.parse(getUser(uid)?.badges_show || 'null'); } catch (e) {}
    const ids = Array.isArray(pick) ? pick.filter(id => got.includes(id)) : got.slice(0, 6);
    const out = ids.slice(0, 6).map(id => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean).map(a => ({ i: a.icon, n: a.name, d: a.desc }));
    shownCache.set(uid, out); if (shownCache.size > 5000) shownCache.clear();
    return out;
  }
  function setShown(uid, ids) {
    const got = new Set(db.prepare('SELECT id FROM user_achievements WHERE user_id=?').all(uid).map(r => r.id));
    const list = (Array.isArray(ids) ? ids : []).map(String).filter(id => got.has(id)).slice(0, 6);
    db.prepare('UPDATE users SET badges_show=? WHERE id=?').run(JSON.stringify(list), uid);
    shownCache.delete(uid); onBadge(uid);
    return { ok: true, shown: list };
  }

  // Les 3 quêtes du jour (toujours les mêmes pour une personne et un jour donnés)
  function questsOf(uid, day = parisDay()) {
    const pool = [...QUESTS], out = [];
    let h = hash(uid + ':' + day);
    while (out.length < 3 && pool.length) { out.push(pool.splice(h % pool.length, 1)[0]); h = hash(String(h)); }
    // jamais deux quêtes de messages le même jour
    return out.filter((q, i, a) => !(q.kind === 'message' && a.findIndex(x => x.kind === 'message') !== i)).slice(0, 3);
  }
  const xpToday = new Map();
  function addXp(uid, n, kind) {
    if (!n) return;
    if (XP_CAP[kind]) {
      const k = `${uid}:${kind}:${parisDay()}`, got = xpToday.get(k) || 0;
      if (got >= XP_CAP[kind]) return;
      n = Math.min(n, XP_CAP[kind] - got); xpToday.set(k, got + n);
      if (xpToday.size > 50000) xpToday.clear();
    }
    const before = levelOf(getUser(uid)?.xp || 0).level;
    db.prepare('UPDATE users SET xp=xp+? WHERE id=?').run(n, uid);
    const after = levelOf(getUser(uid)?.xp || 0);
    emitToUser(uid, 'progress', { xp: getUser(uid).xp, ...after });
    if (after.level > before) {
      const gift = after.level * 10;
      earn(uid, gift, `⭐ Niveau ${after.level} atteint !`, { boost: false });
      notify(uid, { type: 'level', icon: '⭐', title: `Bravo, tu passes au niveau ${after.level} !`, text: `+${gift} pièces 💰 Continue comme ça !`, important: true });
      emitToUser(uid, 'level_up', { level: after.level, gift });
      bump(uid, 'level', after.level, true);
    }
  }
  // Compteurs à vie (pour les succès)
  function bump(uid, kind, n = 1, absolute = false) {
    if (absolute) db.prepare('INSERT INTO user_stats (user_id,kind,n) VALUES (?,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET n=MAX(n, excluded.n)').run(uid, kind, n);
    else db.prepare('INSERT INTO user_stats (user_id,kind,n) VALUES (?,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET n=n+excluded.n').run(uid, kind, n);
    const total = db.prepare('SELECT n FROM user_stats WHERE user_id=? AND kind=?').get(uid, kind)?.n || 0;
    for (const a of ACHIEVEMENTS.filter(a => a.kind === kind && total >= a.goal)) {
      const r = db.prepare('INSERT OR IGNORE INTO user_achievements (user_id,id,created_at) VALUES (?,?,?)').run(uid, a.id, now());
      if (!r.changes) continue;
      shownCache.delete(uid); setTimeout(() => onBadge(uid), 0);
      earn(uid, a.coins, `🏅 Nouveau badge : ${a.name}`, { boost: false });
      notify(uid, { type: 'achievement', icon: a.icon, title: `Nouveau badge : ${a.name} ${a.icon}`, text: `${a.desc} · +${a.coins} pièces 💰`, important: true });
      emitToUser(uid, 'achievement', { ...a });
      addXp(uid, 40, 'achievement');
    }
  }
  // 📣 Une action du membre : quêtes, succès et XP
  function track(uid, kind, n = 1) {
    const u = getUser(uid);
    if (!u || u.is_guest) return;
    const kinds = kind === 'game_win' ? ['game_win', 'game'] : kind === 'babyfoot_win' ? ['babyfoot_win', 'babyfoot'] : [kind];
    for (const k of kinds) {
      bump(uid, k, n);
      addXp(uid, (XP[k] || 0) * n, k);
      const day = parisDay();
      for (const q of questsOf(uid, day).filter(q => q.kind === k)) {
        db.prepare('INSERT OR IGNORE INTO user_quests (user_id,day,quest) VALUES (?,?,?)').run(uid, day, q.id);
        const row = db.prepare('SELECT * FROM user_quests WHERE user_id=? AND day=? AND quest=?').get(uid, day, q.id);
        if (row.done) continue;
        const p = Math.min(q.goal, row.progress + n);
        db.prepare('UPDATE user_quests SET progress=?, done=? WHERE user_id=? AND day=? AND quest=?').run(p, p >= q.goal ? 1 : 0, uid, day, q.id);
        emitToUser(uid, 'quest', { id: q.id, progress: p, goal: q.goal, done: p >= q.goal });
        if (p >= q.goal) {
          earn(uid, q.coins, `🎯 Quête réussie : ${q.text}`, { boost: false });
          addXp(uid, q.xp, 'quest');
          emitToUser(uid, 'quest_done', { ...q });
          bump(uid, 'quest', 1);
          const all = questsOf(uid, day).every(x => x.id === q.id || db.prepare('SELECT done FROM user_quests WHERE user_id=? AND day=? AND quest=?').get(uid, day, x.id)?.done);
          if (all) { earn(uid, 50, '🎯 Les 3 quêtes du jour réussies !', { boost: false }); notify(uid, { type: 'quest', icon: '🎯', title: 'Les 3 quêtes du jour sont réussies ! +50 pièces bonus 💰', text: 'Reviens demain pour de nouvelles quêtes', important: true }); }
        }
      }
    }
    // 🦉 Message en pleine nuit
    if (kind === 'message') { const h = parisHour(); if (h >= 2 && h < 5) bump(uid, 'night', 1); }
  }

  function out(uid) {
    const u = getUser(uid), day = parisDay();
    const rows = new Map(db.prepare('SELECT * FROM user_quests WHERE user_id=? AND day=?').all(uid, day).map(r => [r.quest, r]));
    const stats = Object.fromEntries(db.prepare('SELECT kind, n FROM user_stats WHERE user_id=?').all(uid).map(r => [r.kind, r.n]));
    const got = new Map(db.prepare('SELECT id, created_at FROM user_achievements WHERE user_id=?').all(uid).map(r => [r.id, r.created_at]));
    return {
      ...levelOf(u.xp || 0), xp: u.xp || 0,
      quests: questsOf(uid, day).map(q => ({ ...q, progress: rows.get(q.id)?.progress || 0, done: !!rows.get(q.id)?.done })),
      achievements: ACHIEVEMENTS.map(a => ({ ...a, unlocked: got.get(a.id) || 0, progress: Math.min(a.goal, stats[a.kind] || 0) })),
      shown: (() => { let p = null; try { p = JSON.parse(u.badges_show || 'null'); } catch (e) {} return Array.isArray(p) ? p : [...got.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0]); })(),
      unlocked: got.size, total: ACHIEVEMENTS.length,
    };
  }
  // Ce qu'on montre sur le profil des autres
  const publicOf = uid => {
    const u = getUser(uid);
    const ach = db.prepare('SELECT id FROM user_achievements WHERE user_id=? ORDER BY created_at DESC').all(uid).map(r => ACHIEVEMENTS.find(a => a.id === r.id)).filter(Boolean);
    return { level: levelOf(u?.xp || 0).level, achievements: ach.map(a => ({ id: a.id, icon: a.icon, name: a.name, desc: a.desc })) };
  };
  // un badge donné une seule fois (ex. « Habitant du Paradise » à la connexion)
  const award = (uid, kind) => { const u = getUser(uid); if (!u || u.is_guest) return; if (!db.prepare('SELECT 1 FROM user_stats WHERE user_id=? AND kind=?').get(uid, kind)) bump(uid, kind, 1, true); };
  return { track, out, publicOf, levelOf, shown, setShown, award, ACHIEVEMENTS, QUESTS };
};
module.exports.levelOf = levelOf;
