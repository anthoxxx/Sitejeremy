// The Paradise — 🍔💧❤️ La faim, la soif et la santé du personnage (dans la Ville et le Paradise Complex)
// Elles baissent doucement seulement quand on y joue. Manger et boire dans les boutiques les remonte.
// Si on ne mange pas, ne boit pas, ou qu'il pleut et qu'on est fatigué, on peut attraper un rhume (🤧 toux) puis la grippe (🤒 fièvre) :
// la pharmacie les soigne, l'hôpital remet en pleine forme.
const RATE = { hunger: 1.1, thirst: 1.6 }; // points perdus par minute de jeu (100 = plein)
const SICK = {
  rhume: { icon: '🤧', name: 'un rhume', de: 'du rhume', cure: 'sirop', hurt: .4, slow: .9, sound: 'cough' },
  grippe: { icon: '🤒', name: 'la grippe', de: 'de la grippe', cure: 'grippe', hurt: .9, slow: .7, sound: 'cough' },
  indigestion: { icon: '🤢', name: 'une indigestion', de: 'de ton indigestion', cure: 'digestion', hurt: .3, slow: .85, sound: '' },
};
// ce que font les aliments et les boissons (on reconnaît les mots dans le nom)
const DRINK = /(soda|café|cafe|jus|bubble|smoothie|cocktail|mojito|champagne|canette|bière|biere|eau|milkshake|slush|thé|the)/i;
function effectOf(name, emoji) {
  const n = String(name || '') + ' ' + String(emoji || '');
  const drink = DRINK.test(n) || /[🥤🧋🍹🍸🥂🍾🧃☕🍺🥛]/u.test(emoji || '');
  if (drink) return { hunger: /smoothie|milkshake|bubble/i.test(n) ? 8 : 0, thirst: /champagne|cocktail|mojito/i.test(n) ? 25 : 40 };
  const big = /(plateau|pizza|margherita|fromages|calzone|burger|ramen|pâtes|pates|petit-déjeuner|nachos|menu)/i.test(n);
  const small = /(bonbon|chocolat|pomme|croissant|cupcake|donut|mochi|glace|granité|popcorn|pop-corn|churros|barbe)/i.test(n);
  return { hunger: big ? 45 : small ? 15 : 28, thirst: /glace|granité|pomme|fruit|salade/i.test(n) ? 10 : 0 };
}
module.exports = function setupNeeds({ db, emitToUser, presentIn = () => false, weatherNow = () => null, coins = null, notify = () => {} }) {
  for (const [c, d] of [['hunger', 'REAL NOT NULL DEFAULT 100'], ['thirst', 'REAL NOT NULL DEFAULT 100'], ['health', 'REAL NOT NULL DEFAULT 100'], ['sick', "TEXT NOT NULL DEFAULT ''"], ['sick_at', 'INTEGER NOT NULL DEFAULT 0'], ['shield_until', 'INTEGER NOT NULL DEFAULT 0']]) {
    try { if (!db.prepare('PRAGMA table_info(users)').all().some(x => x.name === c)) db.exec(`ALTER TABLE users ADD COLUMN ${c} ${d}`); } catch (e) {}
  }
  const get = uid => db.prepare('SELECT hunger, thirst, health, sick, sick_at, shield_until FROM users WHERE id = ?').get(uid);
  const save = (uid, s) => db.prepare('UPDATE users SET hunger = ?, thirst = ?, health = ?, sick = ?, sick_at = ? WHERE id = ?').run(s.hunger, s.thirst, s.health, s.sick, s.sick_at, uid);
  const clamp = v => Math.max(0, Math.min(100, Math.round(v * 10) / 10));
  const out = s => ({ hunger: Math.round(s.hunger), thirst: Math.round(s.thirst), health: Math.round(s.health), sick: s.sick || '', sickInfo: s.sick ? SICK[s.sick] : null, slow: s.sick ? SICK[s.sick].slow : (s.hunger < 10 || s.thirst < 10 ? .8 : 1) });
  const send = (uid, s, msg) => emitToUser(uid, 'needs', { ...out(s), msg: msg || '' });
  const warned = new Map(); // pour ne pas répéter les mêmes avertissements
  const once = (uid, key, ms = 600000) => { const k = uid + ':' + key, t = warned.get(k) || 0; if (Date.now() - t < ms) return false; warned.set(k, Date.now()); return true; };
  // chaque minute : la faim et la soif baissent pour ceux qui jouent dans la Ville ou le complexe
  function tick(uid) {
    const s = get(uid); if (!s) return;
    s.hunger = clamp(s.hunger - RATE.hunger); s.thirst = clamp(s.thirst - RATE.thirst);
    let msg = '';
    if (s.hunger <= 0 || s.thirst <= 0) s.health = clamp(s.health - 2);
    else if (s.hunger > 50 && s.thirst > 50 && !s.sick) s.health = clamp(s.health + 1);
    if (s.sick) { s.health = clamp(s.health - SICK[s.sick].hurt); if (s.sick === 'rhume' && Date.now() - s.sick_at > 20 * 60000 && Math.random() < .08) { s.sick = 'grippe'; s.sick_at = Date.now(); msg = '🤒 Ton rhume s\'est transformé en grippe ! File à la pharmacie 💊'; } }
    else if (Date.now() > (s.shield_until || 0)) { // attraper froid : plus de risques s'il pleut, qu'il neige, ou qu'on est affaibli
      const w = weatherNow(), wet = w && /pluie|orage|neige|averse|brouillard/i.test((w.type || '') + ' ' + (w.name || ''));
      const risk = .002 + (wet ? .01 : 0) + (s.health < 50 ? .015 : 0) + (s.hunger < 15 || s.thirst < 15 ? .01 : 0);
      if (Math.random() < risk) { s.sick = 'rhume'; s.sick_at = Date.now(); msg = wet ? '🤧 Brrr, il pleut : tu as attrapé un rhume ! Va à la pharmacie acheter du sirop 💊' : '🤧 Tu as attrapé un rhume ! Va à la pharmacie acheter du sirop 💊'; }
    }
    if (!msg && s.hunger < 20 && once(uid, 'faim')) msg = '🍔 Tu as faim ! Va manger à la pizzeria, au sushi, au burger ou à la boulangerie';
    if (!msg && s.thirst < 20 && once(uid, 'soif')) msg = '💧 Tu as soif ! Va boire quelque chose au bar, au glacier ou au supermarché';
    if (s.health <= 0) { s.health = 60; s.hunger = Math.max(s.hunger, 50); s.thirst = Math.max(s.thirst, 50); s.sick = ''; msg = '😵 Tu t\'es évanoui… Les secours t\'ont soigné à l\'hôpital. Pense à manger et à boire !'; emitToUser(uid, 'needs_faint', {}); }
    save(uid, s); send(uid, s, msg);
  }
  setInterval(() => { try { for (const uid of presentIn()) tick(uid); } catch (e) { console.error('needs', e.message); } }, 60000).unref?.();
  // manger / boire (les boutiques de la Ville, le bar et les snacks du complexe)
  function consume(uid, name, emoji, extra = {}) {
    const s = get(uid); if (!s) return null; const e = { ...effectOf(name, emoji), ...extra };
    s.hunger = clamp(s.hunger + (e.hunger || 0)); s.thirst = clamp(s.thirst + (e.thirst || 0)); s.health = clamp(s.health + (e.health || 0));
    let msg = '';
    if (!e.health && s.hunger >= 100 && e.hunger > 20 && Math.random() < .25 && !s.sick) { s.sick = 'indigestion'; s.sick_at = Date.now(); msg = '🤢 Tu as trop mangé : indigestion ! Une tisane à la pharmacie et ça ira mieux'; }
    save(uid, s); send(uid, s, msg); return out(s);
  }
  // 💊 la pharmacie (pour toi, pas pour ton animal) et 🏥 l'hôpital
  const MEDS = {
    sirop: { icon: '🧴', name: 'Sirop contre la toux', price: 8, cures: ['rhume'], health: 5 },
    grippe: { icon: '💊', name: 'Médicament contre la grippe', price: 15, cures: ['grippe', 'rhume'], health: 10 },
    digestion: { icon: '🍵', name: 'Tisane digestive', price: 5, cures: ['indigestion'], health: 5 },
    vitamines: { icon: '🍊', name: 'Vitamine C (protège 1 h du rhume)', price: 10, cures: [], health: 15, shield: 3600000 },
    trousse: { icon: '🩹', name: 'Trousse de soin', price: 20, cures: [], health: 40 },
  };
  function buyMed(uid, id) {
    const m = MEDS[id]; if (!m) return { error: 'Ce médicament n\'existe pas' };
    if (coins && !coins.spend(uid, m.price, `${m.icon} ${m.name}`)) return { error: `Il te faut ${m.price} pièces 💰` };
    const s = get(uid); s.health = clamp(s.health + m.health); let msg = `${m.icon} ${m.name} : ça fait du bien !`;
    if (s.sick && m.cures.includes(s.sick)) { msg = `${m.icon} Tu es guéri ${SICK[s.sick].de} ! 🎉`; s.sick = ''; }
    else if (s.sick && m.cures.length) msg = `${m.icon} Ce n'est pas le bon médicament pour ${SICK[s.sick].name}…`;
    if (m.shield) db.prepare('UPDATE users SET shield_until = ? WHERE id = ?').run(Date.now() + m.shield, uid);
    save(uid, s); send(uid, s, msg); return { ok: true, msg, needs: out(s), coins: coins ? coins.balance(uid) : null };
  }
  function hospital(uid) {
    const k = 'hosp:' + uid + ':' + new Date().toDateString(); if (warned.get(k)) return { error: 'Tu as déjà eu ta consultation gratuite aujourd\'hui. La pharmacie peut t\'aider 💊' };
    warned.set(k, Date.now()); const s = get(uid); s.health = 100; s.sick = ''; s.hunger = Math.max(s.hunger, 40); s.thirst = Math.max(s.thirst, 40); save(uid, s); send(uid, s, '🩺 La Dre Bobo t\'a soigné : tu es en pleine forme !'); return { ok: true, needs: out(s) };
  }
  return {
    effectOf, consume, buyMed, hospital, MEDS, SICK, state: uid => { const s = get(uid); return s ? out(s) : null; },
    routes(app, auth) {
      app.get('/api/needs', auth, (req, res) => res.json(out(get(req.user.id) || { hunger: 100, thirst: 100, health: 100, sick: '' })));
      app.get('/api/needs/meds', auth, (req, res) => res.json({ meds: MEDS }));
      app.post('/api/needs/med', auth, (req, res) => { if (req.user.is_guest) return res.status(403).json({ error: 'Inscris-toi d\'abord' }); const r = buyMed(req.user.id, String(req.body?.id || '')); res.status(r.error ? 400 : 200).json(r); });
      app.post('/api/needs/hospital', auth, (req, res) => { if (req.user.is_guest) return res.status(403).json({ error: 'Inscris-toi d\'abord' }); const r = hospital(req.user.id); res.status(r.error ? 400 : 200).json(r); });
    },
  };
};
