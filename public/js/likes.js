// The Paradise — les phrases « J'aime… » qu'on peut choisir dans son profil (même liste pour le site et le serveur)
(function (root) {
  const LIKES = [
    '👻 J\'aime le paranormal', '🔮 J\'aime la voyance', '♈ J\'aime l\'astrologie', '🃏 J\'aime le tarot', '🌙 J\'aime la lune et les étoiles',
    '🎵 J\'aime la musique', '🎤 J\'aime chanter', '💃 J\'aime danser', '🎮 J\'aime les jeux vidéo', '🎬 J\'aime les films d\'horreur',
    '🍿 J\'aime les séries', '📚 J\'aime lire', '✍️ J\'aime écrire', '🎨 J\'aime dessiner', '📸 J\'aime la photo',
    '🍳 J\'aime cuisiner', '🍕 J\'aime manger', '☕ J\'aime le café', '🍷 J\'aime les apéros', '✈️ J\'aime voyager',
    '🏖️ J\'aime la plage', '⛰️ J\'aime la montagne', '🌿 J\'aime la nature', '🐱 J\'aime les chats', '🐶 J\'aime les chiens',
    '🐴 J\'aime les chevaux', '⚽ J\'aime le foot', '🏋️ J\'aime le sport', '🧘 J\'aime le yoga', '🚗 J\'aime les voitures',
    '🏍️ J\'aime la moto', '🛍️ J\'aime le shopping', '💄 J\'aime le maquillage', '👗 J\'aime la mode', '🌈 J\'aime la vie',
    '😂 J\'aime rire', '💬 J\'aime discuter', '🌃 J\'aime sortir la nuit', '🛋️ J\'aime rester chez moi', '🎲 J\'aime les jeux de société',
    '🎌 J\'aime les mangas', '🧩 J\'aime les énigmes', '🔬 J\'aime les sciences', '🌍 J\'aime l\'histoire', '🛸 J\'aime les ovnis',
    '🧛 J\'aime les vampires', '🎃 J\'aime Halloween', '🎄 J\'aime Noël', '💤 J\'aime dormir', '❤️ J\'aime l\'amour',
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = LIKES; else root.LIKES = LIKES;
})(this);
