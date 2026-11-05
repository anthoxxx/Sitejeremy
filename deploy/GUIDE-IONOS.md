# Mettre The Paradise en ligne sur un VPS IONOS (theparadise.fr)

> ⚠️ L'**« Hébergement Web »** classique d'IONOS ne fait pas tourner Node.js, donc pas le chat.
> Il faut un **VPS** (un petit serveur à toi). Un **VPS Linux M** (ou M+) convient très bien.

Durée totale : **environ 30 minutes**, dont la plupart à attendre.

---

## Étape 0 — Sauvegarder tes membres sur Render (si le site y tourne encore)
Sur Render (offre gratuite), les données peuvent disparaître à chaque redémarrage. Récupère-les avant de changer :
1. Va sur ton site Render → **Admin** → **💾 Sauvegardes**.
2. Dans « ⬇️ Télécharger une sauvegarde », clique sur **👥 Membres + rôles (.json)** : tu obtiens un fichier avec tous les comptes inscrits, leurs rôles et leurs mots de passe (chiffrés).
3. Garde ce fichier sur ton ordinateur, il servira à l'étape 7.

## Étape 1 — Commander le VPS
1. Sur **ionos.fr** : **Serveurs & Cloud → VPS** → choisis un **VPS Linux** (M ou M+).
2. Système d'exploitation : **Ubuntu 24.04**, **sans Plesk** (Plesk n'est pas utile et prend de la place).
3. Une fois le serveur prêt (quelques minutes), ouvre-le dans **Serveurs & Cloud** et note :
   - son **adresse IP** (ex. `82.165.12.34`) ;
   - le **mot de passe root** (bouton « Afficher le mot de passe initial »).

## Étape 2 — Ouvrir les ports dans le pare-feu IONOS
Dans **Serveurs & Cloud → ton serveur → Réseau → Stratégie de pare-feu** (ou *Pare-feu*), ajoute ces règles « Autoriser » :

| Port | Protocole | À quoi ça sert |
|---|---|---|
| 22 | TCP | connexion SSH (souvent déjà ouvert) |
| 80 | TCP | site web (http) |
| 443 | TCP | site web sécurisé (https) |
| 3478 | TCP **et** UDP | vocal et appels (relais TURN) |
| 49160-49200 | UDP | vocal et appels (relais TURN) |

## Étape 3 — Faire pointer theparadise.fr vers le VPS
Dans **Domaines & SSL → theparadise.fr → DNS** :
1. Enregistrement **A** pour `@` → mets l'**IP du VPS**.
2. Enregistrement **A** pour `www` → la même IP (ou un **CNAME** `www` → `theparadise.fr`).
3. S'il existe des enregistrements **AAAA** pour `@` ou `www`, **supprime-les** (ils mènent à la page d'attente IONOS).
4. Attends **10 à 30 minutes**. Pour vérifier : ouvre `http://theparadise.fr`, tu ne dois plus voir la page IONOS (une erreur, c'est normal à ce stade).

## Étape 4 — Se connecter au VPS
- **Windows** : ouvre **PowerShell** (touche Windows, tape « PowerShell »).
- **Mac** : ouvre **Terminal**.
- **Téléphone** : une appli comme **Termius** marche aussi.

Tape (avec ton IP) :
```
ssh root@82.165.12.34
```
Réponds `yes`, puis colle le mot de passe root. **Il ne s'affiche pas quand tu tapes, c'est normal.**

## Étape 5 — Installer le site (une seule commande)
Copie-colle cette ligne en mettant **ton e-mail** (il sert seulement pour le certificat HTTPS gratuit) :
```
curl -fsSL https://raw.githubusercontent.com/anthoxxx/Sitejeremy/ccr-bcda11d0-qn8psc/deploy/install-ionos.sh -o install.sh && bash install.sh theparadise.fr ton-email@exemple.fr
```
Le script installe tout seul, en 5 à 10 minutes :
- Node.js et le site, qui redémarre tout seul si le serveur redémarre ;
- Nginx, l'adresse web, et le **HTTPS gratuit** (cadenas) ;
- le **relais TURN** pour que le vocal et les appels marchent partout, même en 4G : rien à régler chez Cloudflare ;
- le pare-feu, les mises à jour de sécurité automatiques, et de la mémoire d'appoint si le VPS est petit.

👉 **Pendant l'installation, il te demande le mot de passe de l'espace admin** (tape-le deux fois, il ne s'affiche pas). Évite seulement l'apostrophe `'` et la barre `\`.

À la fin, tu dois voir : **✅ C'est en ligne : https://theparadise.fr** et **🟢 Le site tourne.**

## Étape 6 — Se connecter en admin
Va sur **https://theparadise.fr/admin** → identifiant **admin** + le mot de passe choisi. Tu as tous les droits (super-admin).

## Étape 7 — Remettre tes membres
**Admin → 💾 Sauvegardes → ⬆️ Restaurer les membres** → choisis le fichier `sauvegarde-membres-….json` téléchargé à l'étape 0. Les comptes reviennent avec leurs rôles (et le niveau des modérateurs) : chacun se reconnecte avec son pseudo et son mot de passe habituels.

## Étape 8 — Arrêter l'ancien site sur Render
Pour que tout le monde aille sur le nouveau : sur **dashboard.render.com** → ton service → **Settings** → **Suspend** (ou **Delete**). Les réglages Render (ADMIN_PASSWORD, Cloudflare…) ne servent plus.

---

## Au quotidien
- **Mettre le site à jour** quand de nouvelles fonctions sont ajoutées :
  ```
  ssh root@IP-DU-VPS
  bash /opt/theparadis/deploy/update.sh
  ```
  La base est sauvegardée juste avant, et les pages ouvertes se rechargent toutes seules.
- **Voir ce qui se passe / les erreurs** : `journalctl -u theparadis -f` (Ctrl+C pour sortir)
- **Redémarrer le site** : `systemctl restart theparadis`
- **Changer le mot de passe admin** : `nano /etc/theparadis.env` → modifie la ligne `ADMIN_PASSWORD='…'` → Ctrl+O, Entrée, Ctrl+X → `systemctl restart theparadis`
- **Où sont les données** (comptes, messages, photos, vocaux) : `/var/lib/theparadis`
  - sauvegardes automatiques chaque jour : `/var/lib/theparadis/backups`
  - sauvegardes avant chaque mise à jour : `/var/lib/theparadis/sauvegardes`
  - pour en garder une copie sur ton ordinateur : **Admin → 💾 Sauvegardes → 👥 Membres + rôles** ou **🗄️ Sauvegarde complète**.

## En cas de problème
- **« Le certificat HTTPS n'a pas pu être créé »** → le domaine ne pointe pas encore vers le VPS (étape 3). Attends un peu, puis relance : `bash install.sh theparadise.fr ton-email@exemple.fr` (sans risque, rien n'est effacé).
- **La page ne s'affiche pas** → vérifie les ports 80 et 443 (étape 2), puis `systemctl status theparadis`.
- **Le vocal ou les appels ne se connectent pas** → vérifie les ports 3478 (TCP et UDP) et 49160-49200 (UDP) à l'étape 2. Le vocal des salons passe quand même par le site si besoin (📡).
- **« 🔴 Le site ne démarre pas »** → `journalctl -u theparadis -n 50` et envoie-moi ce qui s'affiche.
