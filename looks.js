// The Paradise — Les personnages de l'Île 🧍 (côté serveur) : on vérifie ce que chacun choisit et on fait payer les pièces rares.
// Le même catalogue est dans public/js/look.js (avec le dessin).
const CAT = {
  hair: ['court', 'pique', 'meche', 'long', 'queue', 'chignon', 'carre', 'boucles', 'afro', 'tresses', 'iroquoise', 'chauve'],
  eyes: ['normal', 'grands', 'rieurs', 'clin', 'cils', 'etoiles'],
  mouth: ['sourire', 'grand', 'neutre', 'langue', 'bisou'],
  face: ['', 'joues', 'taches', 'barbe', 'moustache', 'maquillage'],
  top: ['tshirt', 'debardeur', 'chemise', 'hoodie', 'veste', 'maillot', 'crop', 'pull', 'robe', 'costume', 'robe_soiree', 'cuir'],
  bottom: ['jean', 'pantalon', 'short', 'jupe', 'jogging'],
  shoes: ['baskets', 'bottes', 'talons', 'sandales', 'dorees'],
  acc: ['', 'casquette', 'bonnet', 'chapeau', 'lunettes', 'soleil', 'casque', 'noeud', 'fleur', 'couronne', 'aureole', 'cornes', 'chat', 'lapin'],
  extra: ['', 'sac', 'ailes', 'ailes_demon', 'cape', 'papillon'],
};
// Les pièces rares (prix en Paradise Coins)
const PRICES = { 'eyes:etoiles': 80, 'top:costume': 150, 'top:robe_soiree': 200, 'top:cuir': 180, 'shoes:dorees': 120, 'acc:couronne': 300, 'acc:aureole': 250, 'acc:cornes': 200, 'acc:chat': 150, 'acc:lapin': 150, 'extra:ailes': 500, 'extra:ailes_demon': 500, 'extra:cape': 300, 'extra:papillon': 450 };
const COLOR_KEYS = ['skin', 'hairColor', 'topColor', 'bottomColor', 'shoesColor'];

module.exports = function setupLooks({ db, coins, onChange = () => {} }) {
  try { db.exec("ALTER TABLE users ADD COLUMN look TEXT NOT NULL DEFAULT ''"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN look_mode TEXT NOT NULL DEFAULT 'look'"); } catch (e) {}
  const owned = uid => db.prepare("SELECT item FROM inventory WHERE user_id=? AND item LIKE 'look:%'").all(uid).map(r => r.item.slice(5));
  const get = uid => { const u = db.prepare('SELECT look, look_mode FROM users WHERE id=?').get(uid); let look = null; try { look = u?.look ? JSON.parse(u.look) : null; } catch (e) {} return { look, mode: u?.look_mode === 'photo' ? 'photo' : 'look' }; };
  function save(uid, raw, mode) {
    if (!raw || typeof raw !== 'object') return { error: 'Personnage invalide' };
    const look = {};
    for (const [slot, list] of Object.entries(CAT)) { const v = String(raw[slot] ?? ''); look[slot] = list.includes(v) ? v : list[0]; }
    for (const k of COLOR_KEYS) { const v = String(raw[k] || ''); if (/^#[0-9a-f]{6}$/i.test(v)) look[k] = v.toLowerCase(); }
    const mine = new Set(owned(uid));
    const need = Object.keys(CAT).map(s => s + ':' + look[s]).filter(k => PRICES[k] && !mine.has(k));
    const total = need.reduce((s, k) => s + PRICES[k], 0);
    if (total && !coins.spend(uid, total, `🧍 Tenue rare pour mon personnage (${need.length} pièce${need.length > 1 ? 's' : ''})`)) return { error: `Il te faut ${total} pièces pour ces pièces rares 💰` };
    for (const k of need) db.prepare('INSERT OR IGNORE INTO inventory (user_id,item,created_at) VALUES (?,?,?)').run(uid, 'look:' + k, Date.now());
    db.prepare('UPDATE users SET look=?, look_mode=? WHERE id=?').run(JSON.stringify(look), mode === 'photo' ? 'photo' : 'look', uid);
    onChange(uid);
    return { ok: true, look, owned: owned(uid), bought: need };
  }
  return { get, save, owned };
};
