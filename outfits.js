// The Paradise — 👗 Le magasin de vêtements 3D de la Ville : de vraies tenues pour le personnage 3D
// Chaque tenue est un vrai personnage 3D (Microsoft Rocketbox, licence MIT). On l'essaie dans la cabine, on l'achète, on la porte :
// tout le monde la voit dans la Ville et le Paradise Complex.
const LIST = {
  // 🆓 les tenues de départ (gratuites)
  h1: { g: 'h', name: 'Sweat bleu et blanc', price: 0, tag: 'Décontracté' },
  h2: { g: 'h', name: 'T-shirt noir et jean', price: 0, tag: 'Décontracté' },
  f1: { g: 'f', name: 'Top violet et pantalon noir', price: 0, tag: 'Décontracté' },
  f2: { g: 'f', name: 'Top et mini-jupe', price: 0, tag: 'Soirée' },
  // 👔 homme
  m16: { g: 'h', name: 'T-shirt bleu et jean', price: 30, tag: 'Décontracté' },
  m01: { g: 'h', name: 'Polo rayé et bermuda', price: 35, tag: 'Été' },
  m08: { g: 'h', name: 'Chemise bleu ciel', price: 50, tag: 'Chic' },
  m04: { g: 'h', name: 'Blouson noir et pantalon kaki', price: 60, tag: 'Streetwear' },
  m13: { g: 'h', name: 'Pull à losanges', price: 70, tag: 'Chic' },
  m06: { g: 'h', name: 'Pull rouge', price: 75, tag: 'Décontracté' },
  m10: { g: 'h', name: 'Veste de survêtement rouge', price: 85, tag: 'Sport' },
  m12: { g: 'h', name: 'Veste en jean', price: 95, tag: 'Tendance' },
  // 👗 femme
  f08: { g: 'f', name: 'T-shirt gris et jean', price: 30, tag: 'Décontracté' },
  f17: { g: 'f', name: 'T-shirt vert et jean clair', price: 35, tag: 'Été' },
  f01: { g: 'f', name: 'Chemise rose et jean', price: 45, tag: 'Décontracté' },
  f15: { g: 'f', name: 'Chemisier violet et jupe noire', price: 55, tag: 'Chic' },
  f02: { g: 'f', name: 'Chemise blanche et jupe en jean', price: 65, tag: 'Chic' },
  f12: { g: 'f', name: 'Sweat à capuche et bermuda', price: 80, tag: 'Streetwear' },
  f04: { g: 'f', name: 'Blouson en cuir et bottes', price: 95, tag: 'Tendance' },
  fp1: { g: 'f', name: 'Débardeur blanc, short et bottes', price: 120, tag: 'Soirée' },
};
// 💇 le coiffeur : teintures (gratuites) des cheveux et de la barbe du personnage 3D
const DYES = {
  noir: { name: 'Noir', hex: '#16110d' }, brun: { name: 'Brun', hex: '#4a2a17' }, chatain: { name: 'Châtain', hex: '#7b4a24' }, roux: { name: 'Roux', hex: '#b5401b' },
  blond: { name: 'Blond', hex: '#d8b062' }, platine: { name: 'Blond platine', hex: '#efe6cf' }, gris: { name: 'Gris argent', hex: '#b9bcc2' },
  rose: { name: 'Rose bonbon', hex: '#ff4fa8' }, violet: { name: 'Violet', hex: '#8a4dff' }, bleu: { name: 'Bleu électrique', hex: '#2f78ff' },
  vert: { name: 'Vert menthe', hex: '#2bd18a' }, rouge: { name: 'Rouge cerise', hex: '#d3122e' },
};
// 💍 la bijouterie : de vrais accessoires 3D, portés sur la tête, le visage, le dos ou le cou
const ACC = {
  crown: { slot: 'head', icon: '👑', name: 'Couronne dorée', price: 90 },
  tiara: { slot: 'head', icon: '💎', name: 'Diadème de princesse', price: 75 },
  halo: { slot: 'head', icon: '😇', name: 'Auréole d\'ange', price: 60 },
  flowers: { slot: 'head', icon: '🌸', name: 'Couronne de fleurs', price: 35 },
  cat: { slot: 'head', icon: '🐱', name: 'Oreilles de chat', price: 30 },
  horns: { slot: 'head', icon: '😈', name: 'Cornes de diable', price: 40 },
  cap: { slot: 'head', icon: '🧢', name: 'Casquette', price: 25 },
  beanie: { slot: 'head', icon: '🎿', name: 'Bonnet à pompon', price: 20 },
  phones: { slot: 'head', icon: '🎧', name: 'Casque audio', price: 45 },
  sun: { slot: 'face', icon: '🕶️', name: 'Lunettes de soleil', price: 25 },
  heart: { slot: 'face', icon: '😍', name: 'Lunettes cœur', price: 30 },
  round: { slot: 'face', icon: '👓', name: 'Lunettes rondes', price: 20 },
  mask: { slot: 'face', icon: '🎭', name: 'Masque de bal', price: 35 },
  wings: { slot: 'back', icon: '🪽', name: 'Ailes d\'ange', price: 120 },
  dwings: { slot: 'back', icon: '🦇', name: 'Ailes de démon', price: 120 },
  fly: { slot: 'back', icon: '🦋', name: 'Ailes de papillon', price: 100 },
  cape: { slot: 'back', icon: '🦸', name: 'Cape de héros', price: 60 },
  chain: { slot: 'neck', icon: '📿', name: 'Chaîne en or', price: 50 },
  pearls: { slot: 'neck', icon: '🤍', name: 'Collier de perles', price: 45 },
  bow: { slot: 'neck', icon: '🎀', name: 'Nœud papillon', price: 15 },
};
const SLOTS = ['head', 'face', 'back', 'neck'];
module.exports = function setupOutfits({ db, coins = null, onChange = () => {} }) {
  for (const [c, d] of [['outfit', "TEXT NOT NULL DEFAULT ''"], ['outfits_owned', "TEXT NOT NULL DEFAULT '[]'"], ['deco3d', "TEXT NOT NULL DEFAULT '{}'"]]) {
    try { if (!db.prepare('PRAGMA table_info(users)').all().some(x => x.name === c)) db.exec(`ALTER TABLE users ADD COLUMN ${c} ${d}`); } catch (e) {}
  }
  const row = uid => db.prepare('SELECT outfit, outfits_owned FROM users WHERE id = ?').get(uid);
  const ownedOf = uid => { try { const a = JSON.parse(row(uid)?.outfits_owned || '[]'); return Array.isArray(a) ? a.filter(id => LIST[id] || ACC[id]) : []; } catch (e) { return []; } };
  const has = (uid, id) => (LIST[id] && (LIST[id].price === 0 || ownedOf(uid).includes(id))) || (ACC[id] && ownedOf(uid).includes(id));
  // 💇💍 la teinture et les accessoires portés : { hair, head, face, back, neck }
  const decoObj = uid => { let d = {}; try { d = JSON.parse(db.prepare('SELECT deco3d FROM users WHERE id = ?').get(uid)?.deco3d || '{}') || {}; } catch (e) {} const o = {}; if (DYES[d.hair]) o.hair = d.hair; for (const k of SLOTS) if (ACC[d[k]] && ACC[d[k]].slot === k) o[k] = d[k]; return o; };
  // la version courte envoyée aux autres joueurs : « hair=rose;head=crown »
  const deco = uid => Object.entries(decoObj(uid)).map(([k, v]) => k + '=' + v).join(';');
  function setDeco(uid, slot, id) {
    id = String(id || ''); const d = decoObj(uid);
    if (slot === 'hair') { if (id && !DYES[id]) return { error: 'Cette couleur n\'existe pas' }; if (id) d.hair = id; else delete d.hair; }
    else if (SLOTS.includes(slot)) { if (id && (!ACC[id] || ACC[id].slot !== slot)) return { error: 'Cet accessoire n\'existe pas' }; if (id && !has(uid, id)) return { error: 'Achète d\'abord cet accessoire 💍' }; if (id) d[slot] = id; else delete d[slot]; }
    else return { error: 'Emplacement inconnu' };
    db.prepare('UPDATE users SET deco3d = ? WHERE id = ?').run(JSON.stringify(d), uid);
    onChange(uid);
    return { ok: true, deco: d };
  }
  // la tenue portée ('' = celle de départ, choisie par le site)
  const of = uid => { const o = row(uid)?.outfit || ''; return LIST[o] ? o : ''; };
  function wear(uid, id) {
    id = String(id || '');
    if (id && !LIST[id]) return { error: 'Cette tenue n\'existe pas' };
    if (id && !has(uid, id)) return { error: 'Achète d\'abord cette tenue 🛍️' };
    db.prepare('UPDATE users SET outfit = ? WHERE id = ?').run(id, uid);
    onChange(uid);
    return { ok: true, current: id };
  }
  function buy(uid, id) {
    if (ACC[id]) { // 💍 un accessoire : on l'achète et on le porte tout de suite
      const a = ACC[id];
      if (!has(uid, id)) { if (coins && !coins.spend(uid, a.price, `💍 ${a.name}`)) return { error: `Il te faut ${a.price} pièces 💰` }; const owned = ownedOf(uid); owned.push(id); db.prepare('UPDATE users SET outfits_owned = ? WHERE id = ?').run(JSON.stringify(owned), uid); }
      const r = setDeco(uid, a.slot, id); return { ...r, bought: true, coins: coins ? coins.balance(uid) : null };
    }
    const o = LIST[id]; if (!o) return { error: 'Cette tenue n\'existe pas' };
    if (has(uid, id)) return wear(uid, id);
    if (coins && !coins.spend(uid, o.price, `👗 ${o.name}`)) return { error: `Il te faut ${o.price} pièces 💰` };
    const owned = ownedOf(uid); owned.push(id);
    db.prepare('UPDATE users SET outfits_owned = ? WHERE id = ?').run(JSON.stringify(owned), uid);
    const r = wear(uid, id);
    return { ...r, bought: true, coins: coins ? coins.balance(uid) : null };
  }
  return {
    LIST, ACC, DYES, of, deco, wear, buy, setDeco,
    routes(app, auth) {
      const guest = (req, res) => { if (req.user.is_guest) { res.status(403).json({ error: 'Inscris-toi pour acheter des vêtements 🛍️' }); return true; } return false; };
      app.get('/api/outfits', auth, (req, res) => res.json({ list: LIST, acc: ACC, dyes: DYES, owned: ownedOf(req.user.id), current: of(req.user.id), deco: decoObj(req.user.id) }));
      app.post('/api/outfits/deco', auth, (req, res) => { if (guest(req, res)) return; const r = setDeco(req.user.id, String(req.body?.slot || ''), String(req.body?.id || '')); res.status(r.error ? 400 : 200).json(r); });
      app.post('/api/outfits/buy', auth, (req, res) => { if (guest(req, res)) return; const r = buy(req.user.id, String(req.body?.id || '')); res.status(r.error ? 400 : 200).json(r); });
      app.post('/api/outfits/wear', auth, (req, res) => { if (guest(req, res)) return; const r = wear(req.user.id, String(req.body?.id || '')); res.status(r.error ? 400 : 200).json(r); });
    },
  };
};
