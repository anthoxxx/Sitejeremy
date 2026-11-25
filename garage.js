// The Paradise — 🔧 Le Garage Paradise (le mécano de la zone commerciale de la Ville)
// On personnalise sa voiture 3D : la peinture, les néons sous la caisse et la couleur des jantes.
const PAINT = {
  rouge: { name: 'Rouge Ferrari', hex: '#c0161c' }, noir: { name: 'Noir brillant', hex: '#0d0e12' }, blanc: { name: 'Blanc nacré', hex: '#f2f2f0' },
  gris: { name: 'Gris métal', hex: '#7a8088' }, bleu: { name: 'Bleu électrique', hex: '#1d4fd8' }, cyan: { name: 'Bleu lagon', hex: '#16b3c9' },
  vert: { name: 'Vert racing', hex: '#0f6b3a' }, jaune: { name: 'Jaune soleil', hex: '#f2c40c' }, orange: { name: 'Orange fluo', hex: '#ff6a00' },
  rose: { name: 'Rose bonbon', hex: '#ff4fa8' }, violet: { name: 'Violet', hex: '#6a2bd8' }, or: { name: 'Or', hex: '#d4a24a' },
};
const NEON = { rose: '#ff2bd6', bleu: '#2f9bff', vert: '#2bff88', violet: '#a24dff', rouge: '#ff2d3d', blanc: '#ffffff' };
const RIMS = { argent: { name: 'Argent', hex: '#c8ccd2' }, noir: { name: 'Noir mat', hex: '#18181c' }, or: { name: 'Or', hex: '#e0b04a' }, rose: { name: 'Rose', hex: '#ff6fbf' } };
const PRICE = { paint: 25, neon: 40, rims: 30 };
module.exports = function setupGarage({ db, coins = null, emitToUser = () => {} }) {
  try { if (!db.prepare('PRAGMA table_info(users)').all().some(x => x.name === 'car3d')) db.exec("ALTER TABLE users ADD COLUMN car3d TEXT NOT NULL DEFAULT '{}'"); } catch (e) {}
  const get = uid => { let c = {}; try { c = JSON.parse(db.prepare('SELECT car3d FROM users WHERE id = ?').get(uid)?.car3d || '{}') || {}; } catch (e) {} return { paint: PAINT[c.paint] ? c.paint : '', neon: NEON[c.neon] ? c.neon : '', rims: RIMS[c.rims] ? c.rims : '' }; };
  const out = c => ({ ...c, paintHex: PAINT[c.paint]?.hex || '', neonHex: NEON[c.neon] || '', rimsHex: RIMS[c.rims]?.hex || '' });
  function set(uid, part, id) {
    const T = { paint: PAINT, neon: NEON, rims: RIMS }[part]; if (!T) return { error: 'Je ne connais pas cette option' };
    id = String(id || ''); if (id && !T[id]) return { error: 'Cette couleur n\'existe pas' };
    const c = get(uid); if (c[part] === id) return { ok: true, car: out(c) };
    if (id && coins && !coins.spend(uid, PRICE[part], `🔧 Garage : ${part === 'paint' ? 'peinture' : part === 'neon' ? 'néons' : 'jantes'}`)) return { error: `Il te faut ${PRICE[part]} pièces 💰` };
    c[part] = id; db.prepare('UPDATE users SET car3d = ? WHERE id = ?').run(JSON.stringify(c), uid);
    emitToUser(uid, 'garage_car', out(c));
    return { ok: true, car: out(c), coins: coins ? coins.balance(uid) : null };
  }
  return {
    get: uid => out(get(uid)),
    routes(app, auth) {
      app.get('/api/garage', auth, (req, res) => res.json({ car: out(get(req.user.id)), paint: PAINT, neon: NEON, rims: RIMS, price: PRICE }));
      app.post('/api/garage', auth, (req, res) => { if (req.user.is_guest) return res.status(403).json({ error: 'Inscris-toi d\'abord' }); const r = set(req.user.id, String(req.body?.part || ''), req.body?.id); res.status(r.error ? 400 : 200).json(r); });
    },
  };
};
