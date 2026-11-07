// The Paradise — Patch notes publiées par le bot dans le salon « Patch note »
// Pour annoncer une nouveauté : ajouter une entrée À LA FIN de la liste (id unique, date AAAA-MM-JJ).
// Le bot commence chaque message par « theparadise bonjour » et le termine par « create by Anthony ».
module.exports = [
  {
    id: 1,
    date: '2026-11-05',
    title: 'Tout ce qui a été fait jusqu\'ici',
    added: [
      'Nouveau logo animé du site',
      'Salons Karaoké (avec le KaraoBot) et Musique (avec le DJ Bot) : chacun choisit sa musique',
      'Salon TV du monde avec le TV Bot pour regarder des chaînes du monde entier',
      'ModoBot : il masque les gros mots et les insultes dans tous les salons',
      'Validation de la voix 🎙️ et de la caméra 📷 par l\'équipe dans le salon Vérification',
      'Badge V pour les photos de profil vérifiées par l\'équipe',
      'Notification quand quelqu\'un fait une capture d\'écran ou regarde ta caméra',
      'Écouter un vocal 🎧 sans y aller avec son micro',
      'Le vocal reste connecté quand tu changes de salon ou de page',
      'Caméras déplaçables, et on peut les agrandir ou les réduire',
      'Tu vois qui regarde ta caméra, et tu peux refuser qu\'une personne la voie',
      'Modérateurs niveau 1 (bleu clair), 2 (bleu foncé) et 3 (orange), et l\'équipe en rouge',
      'La modération en ligne s\'affiche en haut du site',
      'Signature « Anthony développeur JS »',
    ],
    changed: [
      'Thème automne / hiver 🍂❄️',
      'Le salon 25 – 40 ans devient 26 – 40 ans',
      'Caméra plus petite pour garder de la place pour lire les messages',
      'Le vocal a été réparé : tout le monde s\'entend',
      'Le site est maintenant en ligne sur theparadise.fr',
    ],
    removed: [
      'Le thème Halloween 🎃',
    ],
  },
  {
    id: 2,
    date: '2026-11-06',
    title: 'Modération des salons et micros',
    added: [
      'Modérateurs de salon (badge blanc « Modo salon »), 4 maximum par salon',
      'Clic droit (ou appui long sur téléphone) sur un pseudo : expulsion 1 h, exclusion 5 h avec motif, bannissement à vie et débannissement',
      'Temps de micro : le 1er micro n\'a pas de limite, le 2e a 20 min, le 3e 30 min, etc.',
      'Bouton ✏️ pour corriger ses messages pendant 15 minutes (salons et messages privés), avec la mention « (modifié) »',
    ],
    changed: [
      '10 micros par vocal, réglables dans l\'espace admin',
      'Les cases à nombre des réglages admin sont plus grandes : on peut écrire dedans',
    ],
    removed: [
      'L\'ancien bouton « Exclure du salon », remplacé par les nouvelles sanctions',
    ],
  },
  {
    id: 3,
    date: '2026-11-07',
    title: 'Messages privés et Patch note',
    added: [
      'Bouton 🗑 pour supprimer son message privé pour tout le monde',
      'Salon 📝 Patch note : le bot y annonce toutes les nouveautés du site (personne ne peut écrire dedans)',
    ],
    changed: [],
    removed: [],
  },
];
