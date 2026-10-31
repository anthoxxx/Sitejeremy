# ✨ GajoxGaming

Chat gratuit en temps réel : salons, messages privés, connexion invité ou membre, et panneau d'administration complet.

## Lancer le site

```bash
npm install
npm start          # http://localhost:3000
```

Variables d'environnement facultatives :

| Variable     | Rôle                                                        |
|--------------|-------------------------------------------------------------|
| `PORT`       | Port HTTP (3000 par défaut)                                 |
| `DATA_DIR`   | Dossier de la base SQLite (`./data` par défaut)             |
| `ADMIN_USER` | Pseudo qui devient automatiquement admin à son inscription  |
| `TURN_URL`, `TURN_USER`, `TURN_PASS` | Serveur TURN facultatif pour que le vocal passe les réseaux très fermés (4G, entreprise) |

👑 **Le tout premier compte inscrit devient administrateur.** Inscris-toi en premier avec ton pseudo.

## Fonctionnalités

**Côté utilisateurs**
- Connexion **invité** (pseudo + âge + genre) ou **compte membre** (pseudo réservé, mot de passe)
- 9 **salons** par défaut (Général, Rencontres, tranches d'âge, Amitié, Jeux vidéo, Musique, Salon VIP réservé aux membres)
- **Messages privés** avec notifications, compteur de non-lus et indicateur de saisie
- Liste des **connectés** avec recherche et filtres (femmes / hommes / salon actuel)
- **Profils** : âge, ville, description, couleur du pseudo
- **@mentions**, liens cliquables, émojis, son de notification
- **Bloquer** et **signaler** un utilisateur
- 🎙️ **Chat vocal** dans chaque salon : micro on/off, couper le son, indicateur de qui parle (WebRTC, jusqu'à 8 personnes par défaut)
- 🏠 **Salons créés par les membres** : nom, icône, description, **salon fermé** sur invitation, inviter / retirer des personnes, **exclure** quelqu'un, retirer quelqu'un du vocal, supprimer son salon
- 📻 **Radio & musique** : lecteur intégré avec NRJ, Chérie FM, Nostalgie, Skyrock, Fun Radio, RTL2, Mouv', FIP, France Inter…, lecture d'un lien audio perso, et **radio du salon** choisie par son propriétaire
- Thème sombre / clair, interface adaptée au mobile

**Panneau d'administration** (`/admin`)
- Tableau de bord : connectés, membres, invités, messages du jour, fréquentation des salons
- **Utilisateurs** : recherche, filtres, changer le rôle (membre / modérateur / admin), expulser, rendre muet, bannir / débannir, supprimer, voir l'historique des messages
- **Signalements** : traiter ou rouvrir
- **Messages** : recherche et suppression (aussi possible directement dans le chat)
- **Salons** : créer, modifier, réordonner, vider, supprimer, réserver aux membres
- **Radios** : ajouter, modifier, tester et supprimer les radios
- **Réglages** : annonce permanente, mots interdits, accès invité, inscriptions ouvertes, âge minimum, vocal on/off, nombre max par vocal, création de salons par les membres on/off, nombre max de salons par membre
- **Annonce instantanée** à tous les connectés
- **Journal** de toutes les actions de modération

Les **modérateurs** ont accès au tableau de bord, aux utilisateurs (sauf rôles et suppression), aux signalements, aux messages et au journal. Les **admins** ont tout.

## Technique

Node.js, Express, Socket.io, SQLite (better-sqlite3), bcrypt. Aucun framework front : HTML, CSS et JS natifs dans `public/`.

Pour héberger le site, il faut un hébergeur qui fait tourner Node.js (Render, Railway, Fly.io, un VPS…), car un hébergement statique ne suffit pas. Pense à conserver le dossier `data/` (disque persistant).

## Notes

- Le **vocal** a besoin d'un site en **https** (ou de `localhost`) pour accéder au micro. Les hébergeurs comme Render fournissent le https automatiquement.
- Les liens des **radios** peuvent changer avec le temps : si une radio ne marche plus, mets à jour son lien dans Admin → Radios (bouton « Tester »).
