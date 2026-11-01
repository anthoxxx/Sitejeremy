# ✨ The Paradise — theparadise.fr

Chat gratuit en temps réel : salons, messages privés, vocal et visio, radio, profils personnalisables et panneau d'administration complet. Le site est adapté aux téléphones, aux tablettes et aux ordinateurs.

## Lancer le site

```bash
npm install
npm start          # http://localhost:3000
```

Variables d'environnement facultatives :

| Variable     | Rôle                                                        |
|--------------|-------------------------------------------------------------|
| `PORT`       | Port HTTP (3000 par défaut)                                 |
| `DATA_DIR`   | Dossier de la base SQLite et des images (`./data` par défaut) |
| `ADMIN_USER` | Pseudo qui devient automatiquement super-admin à son inscription |
| `TURN_URL`, `TURN_USER`, `TURN_PASS` | Serveur TURN facultatif pour que le vocal et la visio passent les réseaux très fermés (4G, entreprise) |
| `ADMIN_LOGIN` | Nom d'utilisateur de l'espace admin `/admin` (`admin` par défaut) |
| `ADMIN_PASSWORD` | Mot de passe de l'espace admin. Sans lui, la connexion à `/admin` par identifiant est désactivée. **Ne l'écris jamais dans le code** (le dépôt est public) |
| `RADIO_CHECK` | Mettre `0` pour désactiver la vérification automatique des radios |

👑 **Le tout premier compte inscrit devient super-admin.** Inscris-toi en premier avec ton pseudo.

## Rôles

| Rôle | Peut faire |
|------|-----------|
| **Super-admin** | **Tout** (+ mode fantôme 👻 et adresses IP dans les logs) : nom du site, textes de l'accueil, couleurs, pages Histoire et Règlement, limite de comptes, nommer / retirer des admins et d'autres super-admins, sanctionner n'importe qui, plus tout ce que font les admins |
| **Admin** | Salons officiels, radios, réglages, nommer des modérateurs, sanctionner les modérateurs et les membres |
| **Modérateur** | Sanctionner les membres, signalements, messages, journal |
| **Membre** | Utiliser le chat, créer ses salons |

## Fonctionnalités

**Côté utilisateurs**
- Connexion **invité** ou **compte membre**, avec **2 comptes maximum par personne** (même appareil ou même connexion, réglable par le super-admin)
- Choix **💙 Homme / 🩷 Femme / 💜 Autre**
- Salons officiels et **salons créés par les membres** (**co-gérants** nommés par le propriétaire, salon fermé sur invitation, exclusions, **fond d'écran** : 8 fonds animés tout prêts, GIF animé, vidéo MP4/WebM en boucle ou image)
- **Messages privés**, @mentions, émojis, blocage, signalement
- ⏳ **Salons temporaires** : tout le monde (même les invités) peut ouvrir en un clic un salon **à son pseudo** (« Salon de Lina ») ou **avec un nom au choix** ; il se ferme tout seul quelques minutes après le départ du dernier (réglable). Les noms des salons **permanents** et **temporaires** ont chacun leur couleur (modifiable dans Admin → Site)
- 🛂 **Douane** (activée par défaut) : un nouvel inscrit n'a **aucun rôle** et ne voit **que le salon « Douane »** (pas d'autres salons, pas de MP sauf au staff, pas d'appels, de défis ni de création de salon). Un **super-admin** le **valide** (✅) : il reçoit le **badge ✓ Validé** à côté de sa photo de profil et l'accès à tout le site. S'il est **refusé** (❌), il reste sans rôle et ne peut plus écrire. Le staff peut **ouvrir / fermer** la douane ; fermée, les arrivants attendent sans pouvoir écrire. Les comptes déjà inscrits avant restent validés
- 🔇 **Sourdine personnelle** : rendre quelqu'un muet *pour soi seul* pendant 30 s, 1 min, 5 min… ou une durée au choix en secondes / minutes / heures, avec compte à rebours ; ses messages sont repliés, il ne peut plus t'écrire en privé, t'appeler ni te défier, sa voix est coupée dans le vocal
- 🖼️ **Partage de médias** : photos (bouton 📎, coller, glisser-déposer, plein écran), liens **YouTube / Shorts**, Spotify, Dailymotion, Vimeo lus directement dans le chat, liens d'images / GIF / vidéos affichés, aperçu des autres liens (titre, image), et **galerie** des médias de chaque salon (bouton 🖼️)
- 🎤 **Messages vocaux** (jusqu'à 2 minutes) dans les salons et en privé, avec lecteur et forme d'onde
- 🗣️ **Dictée vocale** : on parle, le texte s'écrit (dire « point », « virgule », « point d'interrogation »…), plus correcteur orthographique du navigateur
- 🎙️ **Vocal dans les salons** avec **caméra** : mosaïque vidéo, micro / caméra / son, changement de caméra avant ou arrière sur téléphone
- 🔊 **Volume réglable de 0 à 200 %** pendant les appels et dans le vocal des salons (volume général + volume de chaque personne)
- 📹 **Appels audio et visio en tête-à-tête**, depuis le profil ou une conversation privée : sonnerie, répondre en audio ou en vidéo, appel manqué notifié
- 🎤 **Salon Karaoké** avec le **KaraoBot** : on choisit sa chanson (recherche de versions karaoké sur YouTube, idées de chansons par thème, ou lien YouTube collé), le bot gère la **file d'attente**, annonce à chacun quand c'est son tour, et tout le salon peut regarder la vidéo avec les paroles pendant que le chanteur chante dans le vocal. Commandes : `!chanson <titre>`, `!liste`, `!suivant`, `!retirer`, `!aide`
- 🎧 **DJ Bot dans le salon Musique** : chacun met **la musique qu'il veut** (recherche YouTube, idées par style ou lien collé), elle passe **pour tout le salon en même temps**, à son tour dans la file. On peut réduire la vidéo pour n'avoir que le son. Pour passer une musique : celui qui l'a mise, le staff, ou un **vote de la moitié du salon**. Commandes : `!play <titre>`, `!liste`, `!skip`, `!retirer`, `!aide`
- 📻 **Radio** : lecteur intégré, radio du salon, lien audio perso
- 🎮 **Mini-jeux** (bouton 🎮) : solo — Serpent, Démineur, Memory, Pendu, Taquin, Réflexes, Quiz ; à deux en direct — Morpion, 4 alignés, Chifoumi, Course de frappe, Quiz duel (invitation, revanche, arbitrage par le serveur) ; contre l'ordinateur pour Morpion, 4 alignés et Chifoumi ; records personnels et classements
- 🎨 **Profils personnalisables** : photo, bannière, effets de pseudo, cadres, statut, bio, jeux, réseaux
- 🔔 **Notifications** : sanctions, invitations, rôle, appels manqués…
- 📖 Pages **Notre histoire** et 📜 **Règlement**
- Thème sombre / clair, interface **pensée pour le téléphone** (menus en tiroir, fenêtres qui montent du bas, pas de zoom gênant sur iPhone)

**🛡️ ModoBot** (dans tous les salons)
- Masque automatiquement les **gros mots, insultes et propos haineux** (« c****** »), même écrits avec des astuces : majuscules, accents, lettres répétées (« connnnard »), chiffres (« c0nn4rd »), lettres séparées (« p.u.t.e ») ou expressions (« ta g***** »)
- Avertit la personne dans le salon (« Avertissement 1/3 ») ; une insulte grave compte double
- Au bout de 3 avertissements : **muet 5 minutes**, puis 10, 20… en cas de récidive dans la journée ; le staff est prévenu
- Le staff n'est jamais sanctionné (ses mots sont juste masqués). Tout est noté dans les Logs
- Réglable dans Admin → Réglages : activer / couper, nombre d'avertissements, durée du muet, mots interdits en plus

**Panneau d'administration** (`/admin`)
- Tableau de bord, utilisateurs (avec les **comptes liés** à une même personne), sanctions, signalements, messages, salons
- 📜 **Logs** (tout le staff) : connexions, inscriptions, invités, **messages supprimés avec leur contenu** (et les vocaux), salons, vocal, appels, signalements, sanctions, réglages… Filtres par catégorie, recherche, mise à jour **en direct**, gardés 90 jours. Les adresses IP ne sont visibles que par le super-admin.
- 👻 **Mode fantôme** (super-admin) : bouton 👻 en haut du chat. Invisible dans la liste des connectés, les compteurs et les messages « a rejoint / a quitté » ; on peut lire tous les salons et modérer (les sanctions apparaissent « par la modération »), mais pas écrire, appeler ni rejoindre le vocal tant qu'il est actif.
- 📻 **Radios avec vérification automatique** : au démarrage puis toutes les 6 heures, chaque radio est testée. Si elle ne marche plus, le site cherche un nouveau lien officiel sur l'annuaire libre radio-browser.info et la **répare** ; sinon il la **masque** pour les utilisateurs. Un bouton « 🔍 Vérifier et réparer » lance la vérification à la main.
- 🔐 **Espace admin** (`/admin`) : connexion avec un nom d'utilisateur et un mot de passe réglés sur le serveur (`ADMIN_LOGIN`, `ADMIN_PASSWORD`). On arrive directement dans le panneau avec tous les droits pour gérer les utilisateurs. Le pseudo de l'espace admin est réservé (personne ne peut le prendre dans le chat), les essais sont limités et enregistrés dans les logs.
- 💾 **Sauvegardes** (super-admin) : télécharger les membres inscrits **avec leurs rôles** (et mots de passe chiffrés) en un fichier, les **restaurer** en un clic (même sur un site vidé), sauvegarde complète de la base, et sauvegardes automatiques quotidiennes sur le serveur (14 jours gardés)
- 🌐 **Site** (super-admin) : nom, domaine, textes, couleurs, histoire, règlement, limite de comptes

## Mise en ligne

- **Sur un VPS IONOS (ou autre VPS Ubuntu)** : suis le guide [`deploy/GUIDE-IONOS.md`](deploy/GUIDE-IONOS.md) — une seule commande installe tout (Node.js, Nginx, HTTPS gratuit, serveur d'appels TURN, pare-feu).
- Mise à jour : `bash /opt/theparadis/deploy/update.sh`

## Technique

Node.js, Express, Socket.io, SQLite (better-sqlite3), bcrypt, WebRTC. Aucun framework front : HTML, CSS et JS natifs dans `public/`.

Pour héberger le site, il faut un hébergeur qui fait tourner Node.js (Render, Railway, Fly.io, un VPS…). Garde le dossier `data/` sur un disque persistant : il contient la base de données et les images (photos, bannières, fonds d'écran).

## Notes

- Le **vocal**, la **visio** et les **appels** ont besoin d'un site en **https** (fourni automatiquement par Render, Railway…).
- La limite de comptes se base sur l'appareil et l'adresse internet : deux personnes sur la même box peuvent être bloquées après 2 comptes. Le super-admin peut régler la limite, ou mettre 0 pour la retirer.
