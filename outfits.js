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
module.exports = function setupOutfits({ db, coins = null, onChange = () => {} }) {
  for (const [c, d] of [['outfit', "TEXT NOT NULL DEFAULT ''"], ['outfits_owned', "TEXT NOT NULL DEFAULT '[]'"]]) {
    try { if (!db.prepare('PRAGMA table_info(users)').all().some(x => x.name === c)) db.exec(`ALTER TABLE users ADD COLUMN ${c} ${d}`); } catch (e) {}
  }
  const row = uid => db.prepare('SELECT outfit, outfits_owned FROM users WHERE id = ?').get(uid);
  const ownedOf = uid => { try { const a = JSON.parse(row(uid)?.outfits_owned || '[]'); return Array.isArray(a) ? a.filter(id => LIST[id]) : []; } catch (e) { return []; } };
  const has = (uid, id) => LIST[id] && (LIST[id].price === 0 || ownedOf(uid).includes(id));
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
    const o = LIST[id]; if (!o) return { error: 'Cette tenue n\'existe pas' };
    if (has(uid, id)) return wear(uid, id);
    if (coins && !coins.spend(uid, o.price, `👗 ${o.name}`)) return { error: `Il te faut ${o.price} pièces 💰` };
    const owned = ownedOf(uid); owned.push(id);
    db.prepare('UPDATE users SET outfits_owned = ? WHERE id = ?').run(JSON.stringify(owned), uid);
    const r = wear(uid, id);
    return { ...r, bought: true, coins: coins ? coins.balance(uid) : null };
  }
  return {
    LIST, of, wear, buy,
    routes(app, auth) {
      const guest = (req, res) => { if (req.user.is_guest) { res.status(403).json({ error: 'Inscris-toi pour acheter des vêtements 🛍️' }); return true; } return false; };
      app.get('/api/outfits', auth, (req, res) => res.json({ list: LIST, owned: ownedOf(req.user.id), current: of(req.user.id) }));
      app.post('/api/outfits/buy', auth, (req, res) => { if (guest(req, res)) return; const r = buy(req.user.id, String(req.body?.id || '')); res.status(r.error ? 400 : 200).json(r); });
      app.post('/api/outfits/wear', auth, (req, res) => { if (guest(req, res)) return; const r = wear(req.user.id, String(req.body?.id || '')); res.status(r.error ? 400 : 200).json(r); });
    },
  };
};
