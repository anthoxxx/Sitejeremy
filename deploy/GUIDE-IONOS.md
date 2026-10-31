# Mettre The Paradise en ligne sur IONOS (avec ton nom de domaine)

> ⚠️ L'**« Hébergement Web »** classique d'IONOS ne fait pas tourner Node.js, donc pas le chat.
> Il faut un **VPS** (un petit serveur à toi). Le plus petit suffit pour commencer.

## 1. Commander le VPS
1. Sur ionos.fr : **Serveurs & Cloud → VPS** → prends un **VPS Linux** (le moins cher, 1 vCPU / 1 à 2 Go suffit au début).
2. Système : **Ubuntu 24.04** (ou 22.04).
3. Une fois prêt, dans **Serveurs & Cloud → ton serveur**, note :
   - l'**adresse IP** (ex. `82.165.xx.xx`)
   - le **mot de passe root** (ou « Afficher le mot de passe initial »).

## 2. Ouvrir les ports dans IONOS
Dans **Serveurs & Cloud → Réseau → Stratégies de pare-feu** (ou l'onglet *Pare-feu* du serveur), autorise :

| Port | Protocole | À quoi ça sert |
|---|---|---|
| 22 | TCP | connexion SSH (déjà ouvert) |
| 80 | TCP | site web (http) |
| 443 | TCP | site web sécurisé (https) |
| 3478 | TCP et UDP | appels / vocal (serveur TURN) |
| 49160-49200 | UDP | appels / vocal (serveur TURN) |

## 3. Brancher ton nom de domaine sur le VPS
Dans **Domaines & SSL → theparadise.fr → DNS** :
1. Modifie l'enregistrement **A** de `@` → mets l'**IP du VPS**.
2. Modifie (ou crée) l'enregistrement **A** de `www` → même IP (ou un CNAME `www` → `theparadise.fr`).
3. S'il existe des enregistrements **AAAA** pour `@` ou `www`, **supprime-les** (ils pointent vers la page d'attente IONOS).
4. Attends 5 à 30 minutes que ça se propage.

## 4. Se connecter au VPS
- **Windows** : ouvre *PowerShell* · **Mac** : ouvre *Terminal*, puis tape (avec ton IP) :
  ```
  ssh root@82.165.xx.xx
  ```
- Réponds `yes`, puis colle le mot de passe root (il ne s'affiche pas quand tu tapes, c'est normal).

## 5. Installer le site (une seule commande)
Copie-colle ceci en remplaçant l'email par le tien :
```
curl -fsSL https://raw.githubusercontent.com/anthoxxx/Sitejeremy/ccr-bcda11d0-qn8psc/deploy/install-ionos.sh -o install.sh && bash install.sh theparadise.fr ton-email@exemple.fr
```
Le script installe tout tout seul (Node.js, le site, le serveur web, le HTTPS gratuit, le serveur d'appels, le pare-feu) en 3 à 5 minutes.

À la fin il affiche **✅ C'est en ligne : https://theparadise.fr**.
👉 Va sur le site et **inscris-toi tout de suite** : le premier compte devient **super-admin**.

## Ensuite
- **Mettre à jour le site** (quand de nouvelles fonctions sont ajoutées) :
  ```
  ssh root@IP
  bash /opt/theparadis/deploy/update.sh
  ```
  (une sauvegarde de la base est faite automatiquement avant chaque mise à jour)
- **Voir ce qui se passe / les erreurs** : `journalctl -u theparadis -f`
- **Redémarrer** : `systemctl restart theparadis`
- **Où sont les données** (comptes, messages, photos, vocaux) : `/var/lib/theparadis` — pense à le sauvegarder de temps en temps.

## 🔐 Régler l'espace admin (`/admin`)
Connecte-toi au VPS puis ouvre le fichier des réglages :
```
nano /etc/theparadis.env
```
Ajoute ces deux lignes (avec ton propre mot de passe), enregistre (Ctrl+O, Entrée, Ctrl+X) :
```
ADMIN_LOGIN=admin
ADMIN_PASSWORD=ton-mot-de-passe
```
Puis redémarre : `systemctl restart theparadis`. Va sur `https://theparadise.fr/admin` et connecte-toi avec ces identifiants : tu as tous les droits (super-admin).

## En cas de problème
- **« Le certificat HTTPS n'a pas pu être créé »** → le domaine ne pointe pas encore vers le VPS (étape 3). Attends un peu et relance : `bash install.sh theparadise.fr ton-email@exemple.fr`
- **La page ne s'affiche pas** → vérifie les ports 80/443 (étape 2).
- **Les appels ne se connectent pas en 4G** → vérifie les ports 3478 et 49160-49200 (étape 2).
