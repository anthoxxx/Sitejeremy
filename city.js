// The Paradise — Les boutiques de la Ville 🏙️ : on entre vraiment dedans et on y fait des choses
// (coiffeur et vêtements côté client avec l'atelier du personnage ; ici : nourriture, animaux, sport, banque, fleurs, cartes postales, livres)
const DAY = 86400000;

// 🍽️ Ce qu'on peut acheter à manger / à boire (le personnage le tient ensuite dans la Ville)
const FOOD = {
  Boulangerie: [['🥖', 'Baguette', 3], ['🥐', 'Croissant', 3], ['🥨', 'Bretzel', 4], ['🧁', 'Cupcake', 6], ['🍩', 'Donut', 5], ['🍰', 'Fraisier', 8]],
  Pizzeria: [['🍕', 'Margherita', 10], ['🍕', 'Quatre fromages', 12], ['🌮', 'Calzone', 12], ['🥗', 'Salade italienne', 8], ['🍝', 'Pâtes bolo', 11]],
  Sushi: [['🍣', 'Plateau sushi', 14], ['🍙', 'Onigiri', 6], ['🍜', 'Ramen', 12], ['🥟', 'Gyoza', 8], ['🍡', 'Mochi', 6]],
  Burger: [['🍔', 'Burger', 10], ['🍟', 'Frites', 5], ['🌭', 'Hot-dog', 7], ['🥤', 'Soda', 4], ['🍗', 'Nuggets', 8]],
  Glacier: [['🍦', 'Glace italienne', 5], ['🍨', 'Coupe glacée', 8], ['🍧', 'Granité', 5], ['🧋', 'Bubble tea', 7], ['🍓', 'Smoothie fraise', 6]],
  Bar: [['🍹', 'Cocktail des îles', 9], ['🍸', 'Mojito sans alcool', 8], ['🥂', 'Champagne', 15], ['🍾', 'Bouteille pour la table', 30], ['🧃', 'Jus de fruits', 4], ['☕', 'Café', 3]],
  Supermarché: [['🍎', 'Pomme', 2], ['🍫', 'Tablette de chocolat', 4], ['🍬', 'Bonbons', 3], ['🥤', 'Canette', 3], ['🍿', 'Pop-corn', 4]],
  Hôtel: [['🥞', 'Petit-déjeuner', 10], ['🍾', 'Champagne en chambre', 25]],
};
// 🐾 Les soins pour l'animal
const PET = {
  croquettes: { shop: 'Supermarché', icon: '🥫', name: 'Croquettes premium', price: 12, food: 45, joy: 5, xp: 6 },
  jouet: { shop: 'Supermarché', icon: '🧸', name: 'Jouet qui couine', price: 15, food: 0, joy: 40, xp: 8 },
  vitamines: { shop: 'Pharmacie', icon: '💊', name: 'Vitamines', price: 20, food: 15, joy: 25, xp: 20 },
  pansement: { shop: 'Pharmacie', icon: '🩹', name: 'Pansement magique', price: 8, food: 0, joy: 15, xp: 4 },
  checkup: { shop: 'Hôpital', icon: '🩺', name: 'Visite chez le vétérinaire', price: 0, food: 0, joy: 0, xp: 10, minTo: 60, daily: true },
};
// 💐 Les bouquets et 📮 les cartes postales
const FLOWERS = { roses: ['🌹', 'Bouquet de roses', 25], tulipes: ['🌷', 'Tulipes', 15], tournesols: ['🌻', 'Tournesols', 15], mixte: ['💐', 'Grand bouquet', 35], sakura: ['🌸', 'Fleurs de cerisier', 20], unique: ['🥀', 'Une seule rose', 8] };
const CARDS = { plage: '🏝️ Bisous de la plage', ville: '🌃 Une pensée depuis la Ville néon', coeur: '💖 Je pense à toi', merci: '🙏 Merci pour tout', fete: '🎉 Joyeuse fête', soleil: '☀️ Passe une belle journée' };
// 📚 La librairie
const BOOKS = [
  ['😂 Blague', 'Pourquoi les plongeurs plongent-ils toujours en arrière ? Parce que sinon ils tombent dans le bateau !'],
  ['😂 Blague', 'Que dit une imprimante dans l\'eau ? J\'ai papier !'],
  ['😂 Blague', 'Quel est le comble pour un électricien ? De ne pas être au courant.'],
  ['😂 Blague', 'Pourquoi le livre de maths est triste ? Parce qu\'il a trop de problèmes.'],
  ['😂 Blague', 'Que fait une fraise sur un cheval ? Tagada tagada !'],
  ['😂 Blague', 'Comment appelle-t-on un chat tombé dans un pot de peinture le jour de Noël ? Un chat-peint de Noël !'],
  ['😂 Blague', 'Pourquoi les poissons détestent l\'ordinateur ? À cause du net.'],
  ['🧠 Le savais-tu ?', 'Une pieuvre a trois cœurs et du sang bleu.'],
  ['🧠 Le savais-tu ?', 'Les loutres de mer se tiennent par la main pour dormir et ne pas dériver.'],
  ['🧠 Le savais-tu ?', 'Le miel ne périme jamais : on en a trouvé de 3 000 ans encore mangeable dans des tombes égyptiennes.'],
  ['🧠 Le savais-tu ?', 'Un éclair est cinq fois plus chaud que la surface du Soleil.'],
  ['🧠 Le savais-tu ?', 'Les flamants roses sont roses grâce aux crevettes qu\'ils mangent.'],
  ['🧠 Le savais-tu ?', 'La tour Eiffel grandit d\'environ 15 cm en été à cause de la chaleur.'],
  ['🧠 Le savais-tu ?', 'Les vaches ont des meilleures amies et stressent quand on les sépare.'],
  ['🧠 Le savais-tu ?', 'Il y a plus d\'arbres sur Terre que d\'étoiles dans la Voie lactée.'],
  ['✨ Citation', '« La vie, ce n\'est pas d\'attendre que l\'orage passe, c\'est d\'apprendre à danser sous la pluie. » — Sénèque'],
  ['✨ Citation', '« Le bonheur est la seule chose qui se double si on le partage. » — Albert Schweitzer'],
  ['✨ Citation', '« Sois toi-même, les autres sont déjà pris. » — Oscar Wilde'],
  ['✨ Citation', '« On ne voit bien qu\'avec le cœur. L\'essentiel est invisible pour les yeux. » — Saint-Exupéry'],
  ['✨ Citation', '« Il n\'y a pas de chemin vers le bonheur, le bonheur est le chemin. » — Bouddha'],
  ['✨ Citation', '« Un sourire coûte moins cher que l\'électricité, mais donne autant de lumière. » — Abbé Pierre'],
  ['🌙 Horoscope du jour', 'Les astres te sourient : une belle rencontre t\'attend dans un salon du Paradise 💫'],
  ['🌙 Horoscope du jour', 'Journée parfaite pour envoyer un message à quelqu\'un que tu n\'as pas vu depuis longtemps 💌'],
  ['🌙 Horoscope du jour', 'Ta bonne humeur sera contagieuse aujourd\'hui : partage-la dans Général ☀️'],
];

module.exports = function setupCity({ onEat = () => null, db, coins, pets, getUser, publicUser, notify, emitToUser, areFriends, isBlocked, throttled, track = () => {}, filterWords = t => t, sendPm }) {
  const now = () => Date.now();
  const guestNo = u => !u || u.is_guest;
  const coinsNow = uid => coins.balance(uid);

  function buyFood(uid, shop, idx) {
    const list = FOOD[shop], it = list && list[Number(idx)];
    if (!it) return { error: 'Cet article n\'existe pas' };
    if (!coins.spend(uid, it[2], `${it[0]} ${it[1]} (${shop})`)) return { error: `Il te faut ${it[2]} pièces 💰` };
    track(uid, 'cafe');
    const needs = onEat(uid, it[1], it[0]); // 🍔💧 la faim et la soif remontent
    return { ok: true, emoji: it[0], name: it[1], coins: coinsNow(uid), needs };
  }
  function petCare(uid, id) {
    const c = PET[id]; if (!c) return { error: 'Introuvable' };
    if (!pets.get(uid)) return { error: 'Tu n\'as pas encore d\'animal 🐾 (adopte-en un dans le menu « Mon animal »)' };
    if (c.daily && db.prepare('SELECT 1 FROM coin_log WHERE user_id=? AND reason=? AND created_at>?').get(uid, '🩺 Visite chez le vétérinaire', now() - 20 * 3600000)) return { error: 'Ton animal a déjà vu le vétérinaire aujourd\'hui 🩺 Reviens demain' };
    if (c.price && !coins.spend(uid, c.price, `${c.icon} ${c.name} pour mon animal`)) return { error: `Il te faut ${c.price} pièces 💰` };
    if (c.daily) db.prepare('INSERT INTO coin_log (user_id,amount,reason,created_at) VALUES (?,?,?,?)').run(uid, 0, '🩺 Visite chez le vétérinaire', now());
    const r = pets.care(uid, c);
    return r.error ? r : { ...r, coins: coinsNow(uid) };
  }
  // 🏋️ La salle de sport : un mini-jeu, 3 séances payées par jour
  function gym(uid, score) {
    if (throttled(`gym:${uid}`, 15000)) return { error: 'Reprends ton souffle 😅 (15 secondes entre deux séances)' };
    const s = Math.max(0, Math.min(200, Math.floor(Number(score) || 0)));
    const gain = s >= 30 ? coins.earnCapped(uid, 'gym', Math.min(15, 3 + Math.floor(s / 10)), '🏋️ Séance de sport', 3) : 0;
    if (s >= 30) track(uid, 'game');
    return { ok: true, gain, coins: coinsNow(uid) };
  }
  // 🏦 La banque : le relevé de compte et les intérêts du jour
  function bank(uid) {
    const u = getUser(uid);
    const log = db.prepare('SELECT amount, reason, created_at FROM coin_log WHERE user_id=? AND amount<>0 ORDER BY id DESC LIMIT 15').all(uid);
    const took = !!db.prepare("SELECT 1 FROM coin_log WHERE user_id=? AND reason='🏦 Intérêts de la banque' AND created_at>?").get(uid, now() - 20 * 3600000);
    return { ok: true, coins: u.coins || 0, total: u.coins_total || 0, log, interestReady: !took, interest: interestOf(u.coins || 0) };
  }
  const interestOf = c => Math.max(2, Math.min(30, Math.floor(c * 0.02)));
  function interest(uid) {
    const b = bank(uid);
    if (!b.interestReady) return { error: 'Tu as déjà touché tes intérêts aujourd\'hui : reviens demain 🏦' };
    coins.earn(uid, b.interest, '🏦 Intérêts de la banque', { boost: false });
    return { ok: true, gain: b.interest, coins: coinsNow(uid) };
  }
  // 💐 Envoyer des fleurs / 📮 une carte postale à un ami
  function send(uid, kind, toId, item, text) {
    const u = getUser(uid), v = getUser(Number(toId));
    if (!v || v.id === uid) return { error: 'Choisis un ami' };
    if (!areFriends(uid, v.id)) return { error: 'Tu ne peux envoyer ça qu\'à tes amis 🤝' };
    if (isBlocked(v.id, uid) || isBlocked(uid, v.id)) return { error: 'Impossible' };
    const msg = filterWords(String(text || '').replace(/\s+/g, ' ').trim().slice(0, 140));
    if (kind === 'flowers') {
      const f = FLOWERS[item]; if (!f) return { error: 'Choisis un bouquet' };
      if (throttled(`flowers:${uid}:${v.id}`, 30000)) return { error: 'Attends un peu avant d\'en renvoyer 😉' };
      if (!coins.spend(uid, f[2], `${f[0]} ${f[1]} pour ${v.username}`)) return { error: `Il te faut ${f[2]} pièces 💰` };
      const content = `${f[0]} ${u.username} t'offre : ${f[1]} !${msg ? ' « ' + msg + ' »' : ''}`;
      sendPm(uid, v.id, content);
      notify(v.id, { type: 'gift', icon: f[0], title: `${u.username} t'a envoyé des fleurs ${f[0]}`, text: f[1] + (msg ? ' : « ' + msg + ' »' : ''), data: { userId: uid }, important: true });
      emitToUser(v.id, 'city_gift', { icon: f[0], from: u.username });
      track(uid, 'gift');
      return { ok: true, coins: coinsNow(uid) };
    }
    if (kind === 'postcard') {
      const c = CARDS[item]; if (!c) return { error: 'Choisis une carte' };
      const today = db.prepare("SELECT COUNT(*) n FROM coin_log WHERE user_id=? AND reason='📮 Carte postale' AND created_at>?").get(uid, now() - DAY).n;
      if (today >= 5) return { error: '5 cartes postales par jour au maximum 📮' };
      db.prepare('INSERT INTO coin_log (user_id,amount,reason,created_at) VALUES (?,?,?,?)').run(uid, 0, '📮 Carte postale', now());
      const content = `📮 Carte postale de ${u.username} : ${c}${msg ? ' — « ' + msg + ' »' : ''}`;
      sendPm(uid, v.id, content);
      notify(v.id, { type: 'gift', icon: '📮', title: `${u.username} t'a envoyé une carte postale`, text: c + (msg ? ' — « ' + msg + ' »' : ''), data: { userId: uid } });
      return { ok: true };
    }
    return { error: 'Impossible' };
  }
  // 📚 Lire un livre : une blague, une anecdote ou une citation (2 pièces, 3 fois par jour)
  function read(uid) {
    const b = BOOKS[Math.floor(Math.random() * BOOKS.length)];
    const gain = throttled(`read:${uid}`, 20000) ? 0 : coins.earnCapped(uid, 'read', 2, '📚 Lecture à la librairie', 3);
    return { ok: true, kind: b[0], text: b[1], gain };
  }

  function routes(app, auth) {
    const wrap = fn => (req, res) => { if (guestNo(req.user)) return res.status(403).json({ error: 'Inscris-toi pour profiter des boutiques de la Ville 🏙️' }); const r = fn(req.user.id, req.body || {}); res.status(r.error ? 400 : 200).json(r); };
    app.get('/api/city/catalog', auth, (req, res) => res.json({ food: FOOD, pet: PET, flowers: FLOWERS, cards: CARDS }));
    app.post('/api/city/food', auth, wrap((id, b) => buyFood(id, String(b.shop || ''), b.idx)));
    app.post('/api/city/pet', auth, wrap((id, b) => petCare(id, String(b.item || ''))));
    app.post('/api/city/gym', auth, wrap((id, b) => gym(id, b.score)));
    app.get('/api/city/bank', auth, wrap(id => bank(id)));
    app.post('/api/city/bank/interest', auth, wrap(id => interest(id)));
    app.post('/api/city/send', auth, wrap((id, b) => send(id, String(b.kind || ''), b.to, String(b.item || ''), b.text)));
    app.post('/api/city/read', auth, wrap(id => read(id)));
  }
  return { routes, FOOD };
};
module.exports.FOOD = FOOD;
