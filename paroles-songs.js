// The Paradise — chansons du jeu « Les Paroles d'Or »
// Chansons originales écrites pour le site + chansons traditionnelles du domaine public.
// Dans chaque chanson, les mots entre [crochets] sont ceux à retrouver : la musique s'arrête juste avant.
// Accords : une liste de [note MIDI de la fondamentale, 'M' (majeur) ou 'm' (mineur)], un accord par mesure, en boucle.
// melody (facultatif) : la vraie mélodie, ligne par ligne, en [note MIDI, durée en temps]. Sinon elle est composée automatiquement.
const C = 60, D = 62, E = 64, F = 65, G = 67, A = 69, B = 71, A3 = 57, B3 = 59, G3 = 55;

module.exports = [
  {
    id: 'paradise', title: 'Bienvenue au Paradise', artist: 'Création The Paradise', bpm: 118,
    chords: [[C, 'M'], [G3, 'M'], [A3, 'm'], [F, 'M']],
    lines: [
      'Quand la nuit tombe sur la ville', 'On se retrouve tous en ligne', 'Un petit mot, un grand sourire', 'Ici personne ne veut partir',
      'Bienvenue au Paradise', 'Là où les cœurs se font la bise', 'Allume ton micro, monte le son', 'Au Paradise on est à la maison',
      'Des salons qui brillent en néon', 'Des amis de tous les horizons', 'On rigole, on chante, on danse', 'Chaque soir une nouvelle chance',
      'Bienvenue au Paradise', 'Là où les cœurs se font la bise', 'Allume ton micro, monte le son', 'Au Paradise on est [à la maison]',
    ],
  },
  {
    id: 'soleil', title: 'Soleil de minuit', artist: 'Création The Paradise', bpm: 124,
    chords: [[A3, 'm'], [F, 'M'], [C, 'M'], [G3, 'M']],
    lines: [
      'J\'ai mis mes lunettes de soleil', 'Même la lune est en éveil', 'Le sable chaud sous nos pieds nus', 'On danse jusqu\'au bout de la rue',
      'Soleil de minuit, soleil de folie', 'Reste encore un peu avec nous ici', 'Les vagues chantent, le ciel est rose', 'Ce soir l\'été prend la pose',
      'Un dernier verre de limonade', 'Une guitare et une balade', 'Les étoiles font la farandole', 'Et nos soucis prennent leur envol',
      'Soleil de minuit, soleil de folie', 'Reste encore un peu avec nous ici', 'Les vagues chantent, le ciel est rose', 'Ce soir l\'été [prend la pose]',
    ],
  },
  {
    id: 'boum', title: 'Mon cœur fait boum', artist: 'Création The Paradise', bpm: 112,
    chords: [[F, 'M'], [C, 'M'], [D, 'm'], [B3 - 1, 'M']],
    lines: [
      'Je t\'ai croisé au coin du chat', 'Un simple bonjour et puis voilà', 'Ton petit pseudo en couleur', 'A fait trembler tout mon cœur',
      'Mon cœur fait boum, boum, boum', 'Quand tu entres dans la room', 'Mon cœur fait bam, bam, bam', 'Tu as allumé ma flamme',
      'On s\'écrit jusqu\'au petit matin', 'Des émoticônes et des câlins', 'Tu me fais rire, tu me fais rêver', 'Je crois bien que je suis piqué',
      'Mon cœur fait boum, boum, boum', 'Quand tu entres dans la room', 'Mon cœur fait bam, bam, bam', 'Tu as [allumé ma flamme]',
    ],
  },
  {
    id: 'bande', title: 'La bande à nous', artist: 'Création The Paradise', bpm: 120,
    chords: [[G3, 'M'], [D, 'M'], [E, 'm'], [C, 'M']],
    lines: [
      'On s\'est connus un soir d\'hiver', 'Autour d\'un jeu, d\'un verre, d\'un air', 'Depuis on ne se lâche plus', 'Même quand le ciel est tout perdu',
      'C\'est la bande à nous, la bande à nous', 'On se serre les coudes jusqu\'au bout', 'Si l\'un de nous tombe on le relève', 'Ensemble on va au bout de nos rêves',
      'Il y a celui qui rit trop fort', 'Celle qui chante toujours encore', 'Celui qui dort pendant le film', 'Et celle qui danse comme dans un clip',
      'C\'est la bande à nous, la bande à nous', 'On se serre les coudes jusqu\'au bout', 'Si l\'un de nous tombe on le relève', 'Ensemble on va [au bout de nos rêves]',
    ],
  },
  {
    id: 'flocon', title: 'Flocon d\'argent', artist: 'Création The Paradise', bpm: 104,
    chords: [[D, 'M'], [A3, 'M'], [B3, 'm'], [G3, 'M']],
    lines: [
      'La neige tombe sur les toits', 'Le chocolat chauffe pour toi', 'Le froid dehors, la joie dedans', 'On se réchauffe en chantant',
      'Flocon d\'argent, flocon d\'hiver', 'Viens danser dans la lumière', 'Tourne, tourne, petit flocon', 'Tu fais briller toute la maison',
      'Les bonnets et les grandes écharpes', 'Les rires qui sonnent comme des harpes', 'Un feu de bois, une couverture', 'Et des histoires d\'aventure',
      'Flocon d\'argent, flocon d\'hiver', 'Viens danser dans la lumière', 'Tourne, tourne, petit flocon', 'Tu fais briller [toute la maison]',
    ],
  },
  {
    id: 'danse', title: 'Danse avec moi ce soir', artist: 'Création The Paradise', bpm: 126,
    chords: [[A3, 'm'], [G3, 'M'], [F, 'M'], [G3, 'M']],
    lines: [
      'La musique monte, les lumières aussi', 'Laisse tes soucis au vestiaire ici', 'Lève les bras, ferme les yeux', 'On va danser jusqu\'aux cieux',
      'Danse avec moi ce soir', 'Sous la boule à facettes', 'Danse avec moi ce soir', 'Jusqu\'à en perdre la tête',
      'La piste est pleine, l\'ambiance est parfaite', 'Tout le monde tourne comme une planète', 'Le DJ sourit, il lève la main', 'Personne ne rentre avant demain',
      'Danse avec moi ce soir', 'Sous la boule à facettes', 'Danse avec moi ce soir', 'Jusqu\'à en [perdre la tête]',
    ],
  },
  {
    id: 'voyage', title: 'Petit voyage', artist: 'Création The Paradise', bpm: 116,
    chords: [[C, 'M'], [A3, 'm'], [F, 'M'], [G3, 'M']],
    lines: [
      'J\'ai fait ma valise en deux minutes', 'Sans oublier ma vieille flûte', 'Le train démarre, la ville s\'en va', 'Et la mer m\'attend là-bas',
      'Petit voyage, grand bonheur', 'Le vent me chante des couleurs', 'Je pars loin mais pas pour longtemps', 'Je reviens avec le printemps',
      'Des cartes postales pour les amis', 'Des coquillages et des photos aussi', 'Un coucher de soleil orange', 'Et plus rien ne me dérange',
      'Petit voyage, grand bonheur', 'Le vent me chante des couleurs', 'Je pars loin mais pas pour longtemps', 'Je reviens [avec le printemps]',
    ],
  },
  {
    id: 'roi', title: 'Le roi du karaoké', artist: 'Création The Paradise', bpm: 122,
    chords: [[E, 'm'], [C, 'M'], [G3, 'M'], [D, 'M']],
    lines: [
      'Il arrive avec sa chemise à fleurs', 'Il prend le micro, il n\'a jamais peur', 'Il chante faux mais il chante fort', 'Et tout le salon en redemande encore',
      'C\'est le roi, le roi du karaoké', 'Il ne connaît jamais les couplets', 'Mais quand arrive le refrain', 'Il fait lever tout le monde soudain',
      'Il fait des clins d\'œil au public', 'Il danse comme dans un clip', 'Il se prend pour une star', 'Il nous fait rire jusqu\'à tard',
      'C\'est le roi, le roi du karaoké', 'Il ne connaît jamais les couplets', 'Mais quand arrive le refrain', 'Il fait lever [tout le monde soudain]',
    ],
  },
  // ----- Chansons traditionnelles (domaine public), avec leur vraie mélodie -----
  {
    id: 'lune', title: 'Au clair de la lune', artist: 'Chanson traditionnelle', bpm: 110,
    chords: [[C, 'M'], [G3, 'M'], [C, 'M'], [G3, 'M']],
    lines: ['Au clair de la lune', 'Mon ami Pierrot', 'Prête-moi ta plume', 'Pour écrire un mot', 'Ma chandelle est morte', 'Je n\'ai plus de feu', 'Ouvre-moi ta porte', 'Pour [l\'amour de Dieu]'],
    melody: (() => {
      const a = [[C, 1], [C, 1], [C, 1], [D, 1], [E, 2], [D, 2]], b = [[C, 1], [E, 1], [D, 1], [D, 1], [C, 4]];
      const c = [[D, 1], [D, 1], [D, 1], [D, 1], [A3, 2], [A3, 2]], d = [[D, 1], [C, 1], [B3, 1], [A3, 1], [G3, 4]];
      return [a, b, a, b, c, d, a, b];
    })(),
  },
  {
    id: 'jacques', title: 'Frère Jacques', artist: 'Chanson traditionnelle', bpm: 112,
    chords: [[C, 'M'], [C, 'M'], [C, 'M'], [C, 'M']],
    lines: ['Frère Jacques, frère Jacques', 'Dormez-vous ? Dormez-vous ?', 'Sonnez les matines, sonnez les matines', 'Ding, dang, dong. Ding, dang, dong.',
      'Frère Jacques, frère Jacques', 'Dormez-vous ? Dormez-vous ?', 'Sonnez [les matines], sonnez les matines', 'Ding, dang, dong. Ding, dang, dong.'],
    melody: (() => {
      const a = [[C, 1], [D, 1], [E, 1], [C, 1], [C, 1], [D, 1], [E, 1], [C, 1]], b = [[E, 1], [F, 1], [G, 2], [E, 1], [F, 1], [G, 2]];
      const c = [[G, .5], [A, .5], [G, .5], [F, .5], [E, 1], [C, 1], [G, .5], [A, .5], [G, .5], [F, .5], [E, 1], [C, 1]], d = [[C, 1], [G3, 1], [C, 2], [C, 1], [G3, 1], [C, 2]];
      return [a, b, c, d, a, b, c, d];
    })(),
  },
];
