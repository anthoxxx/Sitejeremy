// The Paradise — Les Paradise Coins 💰 et la boutique
// On gagne des pièces en étant actif (bonus du jour, discuter, gagner aux jeux, venir aux soirées…)
// et on les dépense dans la boutique : cadres photo, effets de pseudo, badges, entrées en scène, meubles rares.
// Ce sont des pièces virtuelles : elles ne s'achètent pas avec de l'argent et ne valent rien en dehors du site.

// Le catalogue de la boutique. slot = où l'objet s'utilise ; value = ce qu'il change
const SHOP = [
  // ⭕ Cadres photo exclusifs
  { id: 'frame_diamond', slot: 'frame', value: 'diamond', name: 'Cadre Diamant', icon: '💎', price: 600, desc: 'Un anneau de diamant qui scintille' },
  { id: 'frame_galaxy', slot: 'frame', value: 'galaxy', name: 'Cadre Galaxie', icon: '🌌', price: 450, desc: 'Une galaxie qui tourne autour de ta photo' },
  { id: 'frame_hearts', slot: 'frame', value: 'hearts', name: 'Cadre Cœurs', icon: '💖', price: 300, desc: 'Des cœurs qui battent autour de toi' },
  { id: 'frame_crown', slot: 'frame', value: 'crown', name: 'Cadre Royal', icon: '👑', price: 900, desc: 'Un cadre doré avec une couronne sur ta photo' },
  { id: 'frame_electric', slot: 'frame', value: 'electric', name: 'Cadre Électrique', icon: '⚡', price: 400, desc: 'Des éclairs bleus qui crépitent' },
  { id: 'frame_sakura', slot: 'frame', value: 'sakura', name: 'Cadre Sakura', icon: '🌸', price: 350, desc: 'Des fleurs de cerisier roses' },
  // ✨ Effets de pseudo exclusifs
  { id: 'name_galaxy', slot: 'name', value: 'galaxy', name: 'Pseudo Galaxie', icon: '🌌', price: 500, desc: 'Ton pseudo brille comme les étoiles' },
  { id: 'name_fire', slot: 'name', value: 'fire', name: 'Pseudo en Feu', icon: '🔥', price: 450, desc: 'Des flammes qui dansent dans ton pseudo' },
  { id: 'name_ice', slot: 'name', value: 'ice', name: 'Pseudo Glacé', icon: '❄️', price: 350, desc: 'Un reflet glacé qui passe sur ton pseudo' },
  { id: 'name_glitter', slot: 'name', value: 'glitter', name: 'Pseudo Paillettes', icon: '✨', price: 400, desc: 'Des paillettes dorées et roses' },
  { id: 'name_pulse', slot: 'name', value: 'pulse', name: 'Pseudo Néon Pulsé', icon: '💡', price: 300, desc: 'Ton néon s\'allume et s\'éteint en rythme' },
  { id: 'name_matrix', slot: 'name', value: 'matrix', name: 'Pseudo Hacker', icon: '💻', price: 350, desc: 'Vert lumineux, façon Matrix' },
  // 🏅 Badges à côté du pseudo
  { id: 'badge_star', slot: 'badge', value: '⭐', name: 'Badge Étoile', icon: '⭐', price: 150, desc: 'Une étoile à côté de ton pseudo' },
  { id: 'badge_fire', slot: 'badge', value: '🔥', name: 'Badge Flamme', icon: '🔥', price: 250, desc: 'Pour les personnes en feu' },
  { id: 'badge_clover', slot: 'badge', value: '🍀', name: 'Badge Chance', icon: '🍀', price: 300, desc: 'Le trèfle porte-bonheur' },
  { id: 'badge_mic', slot: 'badge', value: '🎤', name: 'Badge Star du micro', icon: '🎤', price: 300, desc: 'Pour les chanteurs et chanteuses' },
  { id: 'badge_game', slot: 'badge', value: '🎮', name: 'Badge Gamer', icon: '🎮', price: 200, desc: 'Pour les fans de jeux' },
  { id: 'badge_unicorn', slot: 'badge', value: '🦄', name: 'Badge Licorne', icon: '🦄', price: 600, desc: 'Rare et magique' },
  { id: 'badge_crown', slot: 'badge', value: '👑', name: 'Badge Couronne', icon: '👑', price: 1000, desc: 'Le badge des rois et des reines' },
  { id: 'badge_dragon', slot: 'badge', value: '🐉', name: 'Badge Dragon', icon: '🐉', price: 1200, desc: 'Le plus impressionnant' },
  { id: 'badge_diamond', slot: 'badge', value: '💎', name: 'Badge Diamant', icon: '💎', price: 2000, desc: 'Le plus rare de tous' },
  // ⭕ Nouveaux cadres photo
  { id: 'frame_fire', slot: 'frame', value: 'fire', name: 'Cadre Flammes', icon: '🔥', price: 450, desc: 'Des flammes orange qui dansent autour de ta photo' },
  { id: 'frame_ocean', slot: 'frame', value: 'ocean', name: 'Cadre Océan', icon: '🌊', price: 400, desc: 'Des vagues bleues qui tournent autour de toi' },
  { id: 'frame_rainbow', slot: 'frame', value: 'rainbow', name: 'Cadre Arc-en-ciel', icon: '🌈', price: 550, desc: 'Toutes les couleurs qui tournent sans fin' },
  { id: 'frame_gold', slot: 'frame', value: 'gold', name: 'Cadre Or massif', icon: '🏆', price: 750, desc: 'Un double anneau en or qui brille' },
  { id: 'frame_butterfly', slot: 'frame', value: 'butterfly', name: 'Cadre Papillon', icon: '🦋', price: 350, desc: 'Un papillon bleu posé sur ta photo' },
  { id: 'frame_stars', slot: 'frame', value: 'stars', name: 'Cadre Étoilé', icon: '⭐', price: 300, desc: 'Des étoiles qui scintillent autour de toi' },
  { id: 'frame_frost', slot: 'frame', value: 'frost', name: 'Cadre Givré', icon: '❄️', price: 400, desc: 'Un anneau de glace avec un flocon' },
  { id: 'frame_cupid', slot: 'frame', value: 'cupid', name: 'Cadre Cupidon', icon: '💘', price: 500, desc: 'La flèche de Cupidon et un halo rose' },
  { id: 'frame_neon', slot: 'frame', value: 'neon', name: 'Cadre Néon violet', icon: '💜', price: 350, desc: 'Un tube de néon violet qui s’allume' },
  { id: 'frame_spooky', slot: 'frame', value: 'spooky', name: 'Cadre Hanté', icon: '👻', price: 300, desc: 'Un petit fantôme qui flotte près de toi' },
  { id: 'frame_money', slot: 'frame', value: 'money', name: 'Cadre Billets', icon: '💸', price: 1500, desc: 'Un cadre vert et or pour les plus riches' },
  { id: 'frame_planet', slot: 'frame', value: 'planet', name: 'Cadre Planète', icon: '🪐', price: 650, desc: 'Un anneau comme celui de Saturne' },
  // ✨ Nouveaux effets de pseudo
  { id: 'name_gold', slot: 'name', value: 'gold', name: 'Pseudo Or', icon: '🏆', price: 600, desc: 'Ton pseudo en or brillant' },
  { id: 'name_rainbow', slot: 'name', value: 'rainbow', name: 'Pseudo Arc-en-ciel', icon: '🌈', price: 550, desc: 'Toutes les couleurs qui défilent' },
  { id: 'name_ocean', slot: 'name', value: 'ocean', name: 'Pseudo Océan', icon: '🌊', price: 350, desc: 'Des vagues bleues dans ton pseudo' },
  { id: 'name_candy', slot: 'name', value: 'candy', name: 'Pseudo Bonbon', icon: '🍬', price: 300, desc: 'Rose et bleu comme un bonbon' },
  { id: 'name_lava', slot: 'name', value: 'lava', name: 'Pseudo Lave', icon: '🌋', price: 450, desc: 'De la lave rouge et orange qui coule' },
  { id: 'name_aurora', slot: 'name', value: 'aurora', name: 'Pseudo Aurore boréale', icon: '🌌', price: 500, desc: 'Vert, bleu et violet comme le ciel du Nord' },
  { id: 'name_toxic', slot: 'name', value: 'toxic', name: 'Pseudo Toxique', icon: '☢️', price: 350, desc: 'Vert fluo qui brille dans le noir' },
  { id: 'name_love', slot: 'name', value: 'love', name: 'Pseudo Love', icon: '💗', price: 350, desc: 'Rose et rouge, plein d’amour' },
  { id: 'name_chrome', slot: 'name', value: 'chrome', name: 'Pseudo Chrome', icon: '🪙', price: 650, desc: 'Un reflet métal argenté qui passe' },
  { id: 'name_sunset', slot: 'name', value: 'sunset', name: 'Pseudo Coucher de soleil', icon: '🌅', price: 400, desc: 'Orange, rose et violet' },
  // 🏅 Plein de nouveaux badges
  { id: 'badge_moon', slot: 'badge', value: '🌙', name: 'Badge Lune', icon: '🌙', price: 150, desc: 'Pour les oiseaux de nuit' },
  { id: 'badge_sun', slot: 'badge', value: '☀️', name: 'Badge Soleil', icon: '☀️', price: 150, desc: 'Toujours de bonne humeur' },
  { id: 'badge_rainbow', slot: 'badge', value: '🌈', name: 'Badge Arc-en-ciel', icon: '🌈', price: 200, desc: 'Plein de couleurs' },
  { id: 'badge_ghost', slot: 'badge', value: '👻', name: 'Badge Fantôme', icon: '👻', price: 200, desc: 'Bouh !' },
  { id: 'badge_skull', slot: 'badge', value: '💀', name: 'Badge Tête de mort', icon: '💀', price: 250, desc: 'Pour les durs à cuire' },
  { id: 'badge_devil', slot: 'badge', value: '😈', name: 'Badge Petit diable', icon: '😈', price: 300, desc: 'Un peu coquin' },
  { id: 'badge_angel', slot: 'badge', value: '😇', name: 'Badge Ange', icon: '😇', price: 300, desc: 'Sage comme une image' },
  { id: 'badge_cat', slot: 'badge', value: '🐱', name: 'Badge Chat', icon: '🐱', price: 150, desc: 'Pour les fans de chats' },
  { id: 'badge_dog', slot: 'badge', value: '🐶', name: 'Badge Chien', icon: '🐶', price: 150, desc: 'Pour les fans de chiens' },
  { id: 'badge_fox', slot: 'badge', value: '🦊', name: 'Badge Renard', icon: '🦊', price: 200, desc: 'Malin comme un renard' },
  { id: 'badge_panda', slot: 'badge', value: '🐼', name: 'Badge Panda', icon: '🐼', price: 200, desc: 'Tout doux' },
  { id: 'badge_wolf', slot: 'badge', value: '🐺', name: 'Badge Loup', icon: '🐺', price: 350, desc: 'Le loup solitaire' },
  { id: 'badge_lion', slot: 'badge', value: '🦁', name: 'Badge Lion', icon: '🦁', price: 450, desc: 'Le roi de la jungle' },
  { id: 'badge_tiger', slot: 'badge', value: '🐯', name: 'Badge Tigre', icon: '🐯', price: 400, desc: 'Rapide et fort' },
  { id: 'badge_butterfly', slot: 'badge', value: '🦋', name: 'Badge Papillon', icon: '🦋', price: 200, desc: 'Léger et libre' },
  { id: 'badge_rose', slot: 'badge', value: '🌹', name: 'Badge Rose', icon: '🌹', price: 250, desc: 'Romantique' },
  { id: 'badge_cherry', slot: 'badge', value: '🌸', name: 'Badge Fleur de cerisier', icon: '🌸', price: 200, desc: 'Tout en douceur' },
  { id: 'badge_pizza', slot: 'badge', value: '🍕', name: 'Badge Pizza', icon: '🍕', price: 150, desc: 'Fan de pizza' },
  { id: 'badge_donut', slot: 'badge', value: '🍩', name: 'Badge Donut', icon: '🍩', price: 150, desc: 'Gourmand' },
  { id: 'badge_strawberry', slot: 'badge', value: '🍓', name: 'Badge Fraise', icon: '🍓', price: 150, desc: 'Sucré' },
  { id: 'badge_football', slot: 'badge', value: '⚽', name: 'Badge Foot', icon: '⚽', price: 200, desc: 'Fan de foot' },
  { id: 'badge_basket', slot: 'badge', value: '🏀', name: 'Badge Basket', icon: '🏀', price: 200, desc: 'Fan de basket' },
  { id: 'badge_guitar', slot: 'badge', value: '🎸', name: 'Badge Guitare', icon: '🎸', price: 250, desc: 'Rockeur ou rockeuse' },
  { id: 'badge_headphones', slot: 'badge', value: '🎧', name: 'Badge Casque', icon: '🎧', price: 200, desc: 'Toujours en musique' },
  { id: 'badge_camera', slot: 'badge', value: '📸', name: 'Badge Photo', icon: '📸', price: 200, desc: 'Toujours un appareil photo à la main' },
  { id: 'badge_rocket', slot: 'badge', value: '🚀', name: 'Badge Fusée', icon: '🚀', price: 400, desc: 'Direction les étoiles' },
  { id: 'badge_ufo', slot: 'badge', value: '🛸', name: 'Badge OVNI', icon: '🛸', price: 450, desc: 'Venu d’une autre planète' },
  { id: 'badge_bolt', slot: 'badge', value: '⚡', name: 'Badge Éclair', icon: '⚡', price: 300, desc: 'Plein d’énergie' },
  { id: 'badge_bomb', slot: 'badge', value: '💣', name: 'Badge Bombe', icon: '💣', price: 350, desc: 'Explosif' },
  { id: 'badge_target', slot: 'badge', value: '🎯', name: 'Badge Cible', icon: '🎯', price: 250, desc: 'Toujours dans le mille' },
  { id: 'badge_brain', slot: 'badge', value: '🧠', name: 'Badge Cerveau', icon: '🧠', price: 400, desc: 'Le génie du site' },
  { id: 'badge_kiss', slot: 'badge', value: '💋', name: 'Badge Bisou', icon: '💋', price: 300, desc: 'Plein de bisous' },
  { id: 'badge_clown', slot: 'badge', value: '🤡', name: 'Badge Clown', icon: '🤡', price: 200, desc: 'Le rigolo de la bande' },
  { id: 'badge_ninja', slot: 'badge', value: '🥷', name: 'Badge Ninja', icon: '🥷', price: 500, desc: 'Silencieux et rapide' },
  { id: 'badge_mermaid', slot: 'badge', value: '🧜‍♀️', name: 'Badge Sirène', icon: '🧜‍♀️', price: 450, desc: 'Venue de la mer' },
  { id: 'badge_fairy', slot: 'badge', value: '🧚', name: 'Badge Fée', icon: '🧚', price: 450, desc: 'Un peu de magie' },
  { id: 'badge_planet', slot: 'badge', value: '🪐', name: 'Badge Planète', icon: '🪐', price: 500, desc: 'La tête dans les étoiles' },
  { id: 'badge_champagne', slot: 'badge', value: '🍾', name: 'Badge Champagne', icon: '🍾', price: 600, desc: 'Toujours la fête' },
  { id: 'badge_money', slot: 'badge', value: '💸', name: 'Badge Billets', icon: '💸', price: 800, desc: 'Pour ceux qui ont des sous' },
  { id: 'badge_trophy', slot: 'badge', value: '🏆', name: 'Badge Trophée', icon: '🏆', price: 900, desc: 'Un vrai champion' },
  { id: 'badge_dice', slot: 'badge', value: '🎲', name: 'Badge Dés', icon: '🎲', price: 200, desc: 'Joueur dans l’âme' },
  { id: 'badge_chess', slot: 'badge', value: '♟️', name: 'Badge Échecs', icon: '♟️', price: 300, desc: 'Le stratège' },
  { id: 'badge_volcano', slot: 'badge', value: '🌋', name: 'Badge Volcan', icon: '🌋', price: 500, desc: 'Bouillant' },
  { id: 'badge_shark', slot: 'badge', value: '🦈', name: 'Badge Requin', icon: '🦈', price: 550, desc: 'Le prédateur des salons' },
  { id: 'badge_phoenix', slot: 'badge', value: '🐦‍🔥', name: 'Badge Phénix', icon: '🐦‍🔥', price: 1500, desc: 'Il renaît toujours de ses cendres' },
  { id: 'badge_gem', slot: 'badge', value: '💍', name: 'Badge Bague', icon: '💍', price: 1300, desc: 'Précieux' },
  { id: 'badge_alien', slot: 'badge', value: '👽', name: 'Badge Extraterrestre', icon: '👽', price: 350, desc: 'Pas d’ici' },
  { id: 'badge_robot', slot: 'badge', value: '🤖', name: 'Badge Robot', icon: '🤖', price: 300, desc: 'Bip bip' },
  { id: 'badge_heartfire', slot: 'badge', value: '❤️‍🔥', name: 'Badge Cœur en feu', icon: '❤️‍🔥', price: 700, desc: 'Un cœur qui brûle' },
  { id: 'badge_crystal', slot: 'badge', value: '🔮', name: 'Badge Boule de cristal', icon: '🔮', price: 600, desc: 'Voit l’avenir' },
  // 🎬 Entrées en scène (quand tu arrives dans un salon)
  { id: 'entry_sparkles', slot: 'entry', value: 'sparkles', name: 'Entrée Paillettes', icon: '✨', price: 200, desc: 'Tu arrives sous une pluie de paillettes' },
  { id: 'entry_hearts', slot: 'entry', value: 'hearts', name: 'Entrée Cœurs', icon: '💖', price: 200, desc: 'Une pluie de cœurs pour ton arrivée' },
  { id: 'entry_fireworks', slot: 'entry', value: 'fireworks', name: 'Entrée Feu d\'artifice', icon: '🎆', price: 400, desc: 'Un feu d\'artifice quand tu arrives' },
  { id: 'entry_thunder', slot: 'entry', value: 'thunder', name: 'Entrée Tonnerre', icon: '⚡', price: 350, desc: 'Tu arrives dans un éclair' },
  { id: 'entry_carpet', slot: 'entry', value: 'carpet', name: 'Entrée Tapis rouge', icon: '🌟', price: 600, desc: 'Tapis rouge et flashs des photographes' },
  { id: 'entry_rainbow', slot: 'entry', value: 'rainbow', name: 'Entrée Arc-en-ciel', icon: '🌈', price: 300, desc: 'Un arc-en-ciel annonce ton arrivée' },
  { id: 'entry_snow', slot: 'entry', value: 'snow', name: 'Entrée Tempête de neige', icon: '❄️', price: 300, desc: 'Tu arrives dans un tourbillon de flocons' },
  { id: 'entry_money', slot: 'entry', value: 'money', name: 'Entrée Pluie de billets', icon: '💸', price: 800, desc: 'Une pluie de billets et de pièces pour ton arrivée' },
  { id: 'entry_rocket', slot: 'entry', value: 'rocket', name: 'Entrée Fusée', icon: '🚀', price: 450, desc: 'Tu atterris en fusée' },
  { id: 'entry_party', slot: 'entry', value: 'party', name: 'Entrée Fête', icon: '🎉', price: 250, desc: 'Confettis et ballons quand tu arrives' },
  { id: 'entry_roses', slot: 'entry', value: 'roses', name: 'Entrée Pluie de roses', icon: '🌹', price: 400, desc: 'Des pétales de roses tombent à ton arrivée' },
  { id: 'entry_ghost', slot: 'entry', value: 'ghost', name: 'Entrée Fantôme', icon: '👻', price: 300, desc: 'Tu apparais comme un fantôme' },
  { id: 'entry_dragon', slot: 'entry', value: 'dragon', name: 'Entrée Dragon', icon: '🐉', price: 900, desc: 'Un dragon crache du feu pour toi' },
  { id: 'entry_stars', slot: 'entry', value: 'stars', name: 'Entrée Étoiles filantes', icon: '🌠', price: 350, desc: 'Des étoiles filantes traversent l’écran' },
  { id: 'entry_disco', slot: 'entry', value: 'disco', name: 'Entrée Disco', icon: '🪩', price: 500, desc: 'Boule disco et musique dans l’air' },
  { id: 'entry_king', slot: 'entry', value: 'king', name: 'Entrée Royale', icon: '👑', price: 1200, desc: 'Trompettes et couronne : place au roi ou à la reine !' },
  { id: 'entry_pizza', slot: 'entry', value: 'pizza', name: 'Entrée Livraison pizza', icon: '🍕', price: 200, desc: 'Tu arrives avec les pizzas pour tout le monde' },
  { id: 'entry_love', slot: 'entry', value: 'love', name: 'Entrée Coup de foudre', icon: '💘', price: 450, desc: 'Des flèches de Cupidon partout' },
  // 🛋️ Meubles rares pour sa maison sur l'Île
  // 🎄 objets exclusifs du Calendrier de l'Avent (on ne peut pas les acheter)
  { id: 'badge_voice', slot: 'badge', value: '🎙️', name: 'Badge The Voice', icon: '🎙️', price: 0, exclusive: true, desc: 'Gagné en remportant The Voice du Paradise' },
  { id: 'badge_santa', slot: 'badge', value: '🎅', name: 'Badge Père Noël', icon: '🎅', price: 0, exclusive: true, desc: 'Gagné dans le Calendrier de l\'Avent' },
  { id: 'furn_xmastree', slot: 'furniture', value: 'xmastree', name: 'Sapin de Noël', icon: '🎄', price: 0, exclusive: true, desc: 'Gagné dans le Calendrier de l\'Avent' },
  { id: 'furn_snowman', slot: 'furniture', value: 'snowman', name: 'Bonhomme de neige', icon: '⛄', price: 0, exclusive: true, desc: 'Gagné dans le Calendrier de l\'Avent' },
  { id: 'furn_gifts', slot: 'furniture', value: 'gifts', name: 'Pile de cadeaux', icon: '🎁', price: 0, exclusive: true, desc: 'Gagné dans le Calendrier de l\'Avent' },
  { id: 'furn_throne', slot: 'furniture', value: 'throne', name: 'Trône royal', icon: '👑', price: 700, desc: 'Un trône doré pour ta maison (on peut s\'y asseoir)' },
  { id: 'furn_jacuzzi', slot: 'furniture', value: 'jacuzzi', name: 'Jacuzzi', icon: '🫧', price: 800, desc: 'Un jacuzzi avec des bulles' },
  { id: 'furn_djbooth', slot: 'furniture', value: 'djbooth', name: 'Platines de DJ', icon: '🎧', price: 600, desc: 'Mixe chez toi comme au club' },
  { id: 'furn_statue', slot: 'furniture', value: 'statue', name: 'Statue en or', icon: '🗿', price: 500, desc: 'Une statue dorée qui brille' },
  { id: 'furn_neonsign', slot: 'furniture', value: 'neonsign', name: 'Néon « Paradise »', icon: '💡', price: 300, desc: 'Une enseigne néon pour ton mur' },
];
const BY_ID = new Map(SHOP.map(i => [i.id, i]));
const CHAT_CAP = 40; // pièces maximum par jour en discutant

// La date du jour à Paris (AAAA-MM-JJ)
const parisDay = (ts = Date.now()) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts);

module.exports = function setupCoins({ db, emitToUser, notify, getUser, multiplier = () => 1, log = () => {}, onBalance = () => {} }) {
  const now = () => Date.now();
  const owned = uid => db.prepare('SELECT item FROM inventory WHERE user_id=?').all(uid).map(r => r.item);
  const owns = (uid, item) => !!db.prepare('SELECT 1 FROM inventory WHERE user_id=? AND item=?').get(uid, item);
  const balance = uid => db.prepare('SELECT coins FROM users WHERE id=?').get(uid)?.coins || 0;
  const push = (uid, gain, reason) => { const c = balance(uid); emitToUser(uid, 'coins', { coins: c, gain, reason }); try { onBalance(uid, c - gain); onBalance(uid, c); } catch (e) {} };

  // Gagner des pièces (pendant une soirée, les jeux rapportent le double)
  function earn(uid, amount, reason, { boost = true, silent = false } = {}) {
    const u = getUser(uid);
    if (!u || u.is_guest || amount <= 0) return 0;
    const n = Math.round(amount * (boost ? multiplier() : 1));
    db.prepare('UPDATE users SET coins=coins+?, coins_total=coins_total+? WHERE id=?').run(n, n, uid);
    db.prepare('INSERT INTO coin_log (user_id,amount,reason,created_at) VALUES (?,?,?,?)').run(uid, n, reason, now());
    if (!silent) push(uid, n, reason);
    return n;
  }
  function spend(uid, amount, reason) {
    const r = db.prepare('UPDATE users SET coins=coins-? WHERE id=? AND coins>=?').run(amount, uid, amount);
    if (!r.changes) return false;
    db.prepare('INSERT INTO coin_log (user_id,amount,reason,created_at) VALUES (?,?,?,?)').run(uid, -amount, reason, now());
    push(uid, -amount, reason);
    return true;
  }

  // Les jeux rapportent des pièces, mais pas plus de quelques fois par jour et par jeu (pour éviter la triche)
  const caps = new Map();
  function earnCapped(uid, key, amount, reason, max = 5) {
    const k = `${uid}:${key}:${parisDay()}`, n = caps.get(k) || 0;
    if (n >= max) return 0;
    caps.set(k, n + 1);
    if (caps.size > 50000) caps.clear();
    return earn(uid, amount, reason);
  }
  // 💬 Discuter rapporte 1 pièce par message (au plus une toutes les 20 secondes, 40 par jour)
  const chat = new Map(); // uid -> { day, got, last }
  function onMessage(uid) {
    const day = parisDay(), t = now();
    let c = chat.get(uid);
    if (!c || c.day !== day) { c = { day, got: 0, last: 0 }; chat.set(uid, c); }
    if (c.got >= CHAT_CAP || t - c.last < 20000) return;
    c.last = t; c.got++;
    earn(uid, 1, '💬 Message dans le chat', { boost: false, silent: true });
    if (c.got % 10 === 0) push(uid, 10, '💬 10 messages dans le chat');
    if (chat.size > 20000) chat.clear();
  }

  // 🎁 Bonus du jour : 20 pièces, +5 par jour de suite (jusqu'à 50), et 100 de plus le 7e jour
  function dailyInfo(u) {
    const today = parisDay(), yesterday = parisDay(now() - 86400000);
    const claimed = u.daily_date === today;
    const streak = claimed ? u.daily_streak : u.daily_date === yesterday ? u.daily_streak + 1 : 1;
    const amount = Math.min(50, 20 + (streak - 1) * 5) + (streak % 7 === 0 ? 100 : 0);
    return { claimed, streak, amount };
  }
  function claimDaily(uid) {
    const u = getUser(uid);
    if (!u || u.is_guest) return { error: 'Inscris-toi pour gagner des pièces' };
    const d = dailyInfo(u);
    if (d.claimed) return { error: 'Tu as déjà pris ton bonus aujourd\'hui : reviens demain 😉' };
    db.prepare('UPDATE users SET daily_date=?, daily_streak=? WHERE id=?').run(parisDay(), d.streak, uid);
    const got = earn(uid, d.amount, `🎁 Bonus du jour (${d.streak} jour${d.streak > 1 ? 's' : ''} de suite)`, { boost: false });
    return { ok: true, got, streak: d.streak };
  }

  // ---------- La boutique ----------
  function shopOut(uid) {
    const u = getUser(uid), mine = new Set(owned(uid));
    const equipped = { frame: u.avatar_frame, name: u.name_effect, badge: u.shop_badge, entry: u.shop_entry };
    const rank = db.prepare('SELECT COUNT(*)+1 r FROM users WHERE coins_total>? AND is_guest=0').get(u.coins_total || 0).r;
    return {
      coins: u.coins || 0, total: u.coins_total || 0, rank, daily: dailyInfo(u),
      items: SHOP.filter(i => !i.exclusive || mine.has(i.id)).map(i => ({ ...i, owned: mine.has(i.id), equipped: i.slot !== 'furniture' && equipped[i.slot] === i.value })),
      history: db.prepare('SELECT amount, reason, created_at FROM coin_log WHERE user_id=? ORDER BY id DESC LIMIT 15').all(uid),
    };
  }
  function buy(uid, id) {
    const item = BY_ID.get(id);
    if (!item) return { error: 'Cet objet n\'existe pas' };
    if (owns(uid, id)) return { error: 'Tu l\'as déjà !' };
    if (item.exclusive) return { error: '🎄 Cet objet se gagne seulement dans le Calendrier de l\'Avent' };
    if (!spend(uid, item.price, `🛍️ Achat : ${item.name}`)) return { error: `Il te manque ${item.price - balance(uid)} pièces 💰` };
    db.prepare('INSERT OR IGNORE INTO inventory (user_id,item,created_at) VALUES (?,?,?)').run(uid, id, now());
    log(getUser(uid), 'shop_buy', `${item.name} (${item.price} pièces)`);
    if (item.slot !== 'furniture') equip(uid, id);
    return { ok: true, item };
  }
  function equip(uid, id, slot) {
    const item = id ? BY_ID.get(id) : null;
    if (id && (!item || !owns(uid, id))) return { error: 'Tu n\'as pas cet objet' };
    const s = item?.slot || slot;
    const col = { frame: 'avatar_frame', name: 'name_effect', badge: 'shop_badge', entry: 'shop_entry' }[s];
    if (!col) return { error: 'Impossible' };
    db.prepare(`UPDATE users SET ${col}=? WHERE id=?`).run(item ? item.value : (s === 'frame' || s === 'name' ? 'none' : ''), uid);
    return { ok: true };
  }
  // Les cadres et effets exclusifs ne s'utilisent que si on les a achetés
  const premium = slot => SHOP.filter(i => i.slot === slot).map(i => i.value);
  const ownedValues = (uid, slot) => { const mine = new Set(owned(uid)); return SHOP.filter(i => i.slot === slot && mine.has(i.id)).map(i => i.value); };

  // 🎁 Offrir des pièces à quelqu'un
  function gift(from, toId, amount, message) {
    amount = Math.floor(Number(amount));
    const a = getUser(from), b = getUser(toId);
    if (!a || !b || b.is_guest || from === toId) return { error: 'Impossible d\'offrir des pièces à cette personne' };
    if (!(amount >= 5)) return { error: '5 pièces minimum' };
    if (!spend(from, amount, `🎁 Cadeau pour ${b.username}`)) return { error: 'Tu n\'as pas assez de pièces' };
    earn(toId, amount, `🎁 Cadeau de ${a.username}`, { boost: false });
    notify(toId, { type: 'coins_gift', icon: '🎁', title: `${a.username} t'a offert ${amount} pièces 💰`, text: message ? `« ${String(message).slice(0, 120)} »` : 'Va voir la boutique pour les dépenser !', data: { userId: from }, important: true });
    log(a, 'coins_gift', `${amount} pièces offertes à ${b.username}`);
    return { ok: true };
  }
  const top = () => db.prepare('SELECT id, username, color, avatar, gender, role, coins, coins_total, avatar_frame, name_effect, shop_badge FROM users WHERE is_guest=0 AND banned=0 ORDER BY coins_total DESC LIMIT 20').all()
    .map(u => ({ id: u.id, username: u.username, color: u.color, avatar: u.avatar || '', gender: u.gender, role: u.role, coins: u.coins, total: u.coins_total, frame: u.avatar_frame, nameEffect: u.name_effect, shopBadge: u.shop_badge }));

  return { SHOP, earn, earnCapped, spend, onMessage, claimDaily, dailyInfo, shopOut, buy, equip, gift, top, owned, owns, ownedValues, premium, balance };
};
module.exports.SHOP = SHOP;
module.exports.SHOP = SHOP; // le catalogue (pour donner tous les objets au créateur du site)
