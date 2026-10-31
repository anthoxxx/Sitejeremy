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
- Thème sombre / clair, interface adaptée au mobile

**Panneau d'administration** (`/admin`)
- Tableau de bord : connectés, membres, invités, messages du jour, fréquentation des salons
- **Utilisateurs** : recherche, filtres, changer le rôle (membre / modérateur / admin), expulser, rendre muet, bannir / débannir, supprimer, voir l'historique des messages
- **Signalements** : traiter ou rouvrir
- **Messages** : recherche et suppression (aussi possible directement dans le chat)
- **Salons** : créer, modifier, réordonner, vider, supprimer, réserver aux membres
- **Réglages** : annonce permanente, mots interdits, accès invité, inscriptions ouvertes, âge minimum
- **Annonce instantanée** à tous les connectés
- **Journal** de toutes les actions de modération

Les **modérateurs** ont accès au tableau de bord, aux utilisateurs (sauf rôles et suppression), aux signalements, aux messages et au journal. Les **admins** ont tout.

## Technique

Node.js, Express, Socket.io, SQLite (better-sqlite3), bcrypt. Aucun framework front : HTML, CSS et JS natifs dans `public/`.

Pour héberger le site, il faut un hébergeur qui fait tourner Node.js (Render, Railway, Fly.io, un VPS…), car un hébergement statique ne suffit pas. Pense à conserver le dossier `data/` (disque persistant).
