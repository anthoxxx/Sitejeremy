# ✨ The Paradis — theparadis.fr

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
- Choix **🩷 Rose / 💙 Bleu / 💜 Autre**
- Salons officiels et **salons créés par les membres** (salon fermé sur invitation, exclusions, **fond d'écran** : 8 fonds animés tout prêts, GIF animé, vidéo MP4/WebM en boucle ou image)
- **Messages privés**, @mentions, émojis, blocage, signalement
- 🔇 **Sourdine personnelle** : rendre quelqu'un muet *pour soi seul* pendant 30 s, 1 min, 5 min… ou une durée au choix en secondes / minutes / heures, avec compte à rebours ; ses messages sont repliés, il ne peut plus t'écrire en privé, t'appeler ni te défier, sa voix est coupée dans le vocal
- 🎤 **Messages vocaux** (jusqu'à 2 minutes) dans les salons et en privé, avec lecteur et forme d'onde
- 🗣️ **Dictée vocale** : on parle, le texte s'écrit (dire « point », « virgule », « point d'interrogation »…), plus correcteur orthographique du navigateur
- 🎙️ **Vocal dans les salons** avec **caméra** : mosaïque vidéo, micro / caméra / son, changement de caméra avant ou arrière sur téléphone
- 📹 **Appels audio et visio en tête-à-tête**, depuis le profil ou une conversation privée : sonnerie, répondre en audio ou en vidéo, appel manqué notifié
- 📻 **Radio** : lecteur intégré, radio du salon, lien audio perso
- 🎮 **Mini-jeux** (bouton 🎮) : solo — Serpent, Démineur, Memory, Pendu, Taquin, Réflexes, Quiz ; à deux en direct — Morpion, 4 alignés, Chifoumi, Course de frappe, Quiz duel (invitation, revanche, arbitrage par le serveur) ; contre l'ordinateur pour Morpion, 4 alignés et Chifoumi ; records personnels et classements
- 🎨 **Profils personnalisables** : photo, bannière, effets de pseudo, cadres, statut, bio, jeux, réseaux
- 🔔 **Notifications** : sanctions, invitations, rôle, appels manqués…
- 📖 Pages **Notre histoire** et 📜 **Règlement**
- Thème sombre / clair, interface **pensée pour le téléphone** (menus en tiroir, fenêtres qui montent du bas, pas de zoom gênant sur iPhone)

**Panneau d'administration** (`/admin`)
- Tableau de bord, utilisateurs (avec les **comptes liés** à une même personne), sanctions, signalements, messages, salons
- 📜 **Logs** (tout le staff) : connexions, inscriptions, invités, **messages supprimés avec leur contenu** (et les vocaux), salons, vocal, appels, signalements, sanctions, réglages… Filtres par catégorie, recherche, mise à jour **en direct**, gardés 90 jours. Les adresses IP ne sont visibles que par le super-admin.
- 👻 **Mode fantôme** (super-admin) : bouton 👻 en haut du chat. Invisible dans la liste des connectés, les compteurs et les messages « a rejoint / a quitté » ; on peut lire tous les salons et modérer (les sanctions apparaissent « par la modération »), mais pas écrire, appeler ni rejoindre le vocal tant qu'il est actif.
- 📻 **Radios avec vérification automatique** : au démarrage puis toutes les 6 heures, chaque radio est testée. Si elle ne marche plus, le site cherche un nouveau lien officiel sur l'annuaire libre radio-browser.info et la **répare** ; sinon il la **masque** pour les utilisateurs. Un bouton « 🔍 Vérifier et réparer » lance la vérification à la main.
- 🌐 **Site** (super-admin) : nom, domaine, textes, couleurs, histoire, règlement, limite de comptes

## Technique

Node.js, Express, Socket.io, SQLite (better-sqlite3), bcrypt, WebRTC. Aucun framework front : HTML, CSS et JS natifs dans `public/`.

Pour héberger le site, il faut un hébergeur qui fait tourner Node.js (Render, Railway, Fly.io, un VPS…). Garde le dossier `data/` sur un disque persistant : il contient la base de données et les images (photos, bannières, fonds d'écran).

## Notes

- Le **vocal**, la **visio** et les **appels** ont besoin d'un site en **https** (fourni automatiquement par Render, Railway…).
- La limite de comptes se base sur l'appareil et l'adresse internet : deux personnes sur la même box peuvent être bloquées après 2 comptes. Le super-admin peut régler la limite, ou mettre 0 pour la retirer.
