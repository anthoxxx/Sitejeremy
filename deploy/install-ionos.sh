#!/usr/bin/env bash
# =====================================================================
#  The Paradise — installation automatique sur un VPS (IONOS ou autre)
#  Système : Ubuntu 22.04 ou 24.04, à lancer en root :
#     bash install-ionos.sh theparadise.fr ton-email@exemple.fr
#  Le script peut être relancé sans risque (il met à jour sans rien effacer).
#  Il installe : Node.js, le site, Nginx, le HTTPS gratuit, le serveur d'appels (TURN),
#  le pare-feu, les mises à jour de sécurité automatiques, et demande le mot de passe de l'espace admin.
# =====================================================================
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
REPO="https://github.com/anthoxxx/Sitejeremy.git"
BRANCH="${BRANCH:-ccr-bcda11d0-qn8psc}"
APP_DIR="/opt/theparadis"
DATA_DIR="/var/lib/theparadis"
APP_USER="theparadis"
PORT=3000

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Utilisation : bash install-ionos.sh theparadise.fr ton-email@exemple.fr"
  exit 1
fi
if [ "$(id -u)" -ne 0 ]; then echo "Lance ce script en root (ou avec sudo)."; exit 1; fi

step() { echo; echo "==> $*"; }

step "Mise à jour du système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git nginx ufw build-essential python3 certbot python3-certbot-nginx coturn openssl unattended-upgrades
# Mises à jour de sécurité automatiques
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true

step "Mémoire d'appoint (swap) pour les petits VPS"
if [ "$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)" -lt 2048 ] && ! swapon --show | grep -q .; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Swap de 1 Go ajouté"
fi

step "Installation de Node.js 22"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

step "Utilisateur et dossiers"
id "$APP_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$APP_USER"
mkdir -p "$DATA_DIR"
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"

step "Récupération du code ($BRANCH)"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout -q "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  git clone -b "$BRANCH" "$REPO" "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm ci --omit=dev"

step "Serveur TURN (pour que les appels et le vocal passent partout, même en 4G)"
ENV_FILE="/etc/theparadis.env"
if [ ! -f "$ENV_FILE" ]; then
  TURN_PASS="$(openssl rand -hex 16)"
  cat > "$ENV_FILE" <<EOF
PORT=$PORT
DATA_DIR=$DATA_DIR
NODE_ENV=production
TURN_URL=turn:$DOMAIN:3478?transport=udp,turn:$DOMAIN:3478?transport=tcp
TURN_USER=paradis
TURN_PASS=$TURN_PASS
EOF
  chmod 600 "$ENV_FILE"
fi

step "Espace admin (connexion sur https://$DOMAIN/admin)"
if ! grep -q '^ADMIN_PASSWORD=' "$ENV_FILE"; then
  if [ -n "${ADMIN_PASSWORD:-}" ]; then
    PASS1="$ADMIN_PASSWORD"
  else
    echo "Choisis le mot de passe de l'espace admin (identifiant : admin)."
    echo "Il ne s'affiche pas quand tu tapes, c'est normal. 8 caractères minimum conseillés."
    while true; do
      read -r -s -p "Mot de passe : " PASS1 </dev/tty; echo
      read -r -s -p "Encore une fois : " PASS2 </dev/tty; echo
      if [ -z "$PASS1" ]; then echo "Le mot de passe ne peut pas être vide."; continue; fi
      if [ "$PASS1" != "$PASS2" ]; then echo "Les deux mots de passe sont différents, recommence."; continue; fi
      case "$PASS1" in *"'"*|*'\'*) echo "Évite l'apostrophe et la barre oblique inverse dans le mot de passe."; continue ;; esac
      break
    done
  fi
  # Écrit entre guillemets simples pour garder les caractères spéciaux (@, !, $…)
  { echo "ADMIN_LOGIN=admin"; echo "ADMIN_PASSWORD='${PASS1}'"; } >> "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Mot de passe enregistré."
else
  echo "Déjà réglé (pour le changer : nano $ENV_FILE, puis systemctl restart theparadis)."
fi
# shellcheck disable=SC1090
. "$ENV_FILE"
PUBLIC_IP="$(curl -fsS4 https://api.ipify.org || hostname -I | awk '{print $1}')"
cat > /etc/turnserver.conf <<EOF
listening-port=3478
fingerprint
lt-cred-mech
user=$TURN_USER:$TURN_PASS
realm=$DOMAIN
external-ip=$PUBLIC_IP
min-port=49160
max-port=49200
no-cli
no-tls
no-dtls
# Sécurité : le relais ne sert qu'aux appels, jamais à atteindre le réseau interne
no-multicast-peers
no-loopback-peers
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
EOF
sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn 2>/dev/null || true
systemctl enable coturn
systemctl restart coturn

step "Service qui fait tourner le site en permanence"
cat > /etc/systemd/system/theparadis.service <<EOF
[Unit]
Description=The Paradise (chat)
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable theparadis
systemctl restart theparadis

step "Nginx (adresse web, WebSocket, envoi de fichiers)"
cat > /etc/nginx/sites-available/theparadis <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 15m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF
ln -sf /etc/nginx/sites-available/theparadis /etc/nginx/sites-enabled/theparadis
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

step "Pare-feu"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 49160:49200/udp
ufw --force enable

step "Certificat HTTPS gratuit (Let's Encrypt)"
if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -m "$EMAIL" --agree-tos --redirect -n; then
  HTTPS_OK=1
else
  HTTPS_OK=0
fi

echo
echo "====================================================================="
if [ "$HTTPS_OK" = 1 ]; then
  echo " ✅ C'est en ligne : https://$DOMAIN"
else
  echo " ⚠️  Le site tourne, mais le certificat HTTPS n'a pas pu être créé."
  echo "    Vérifie que le domaine $DOMAIN (et www.$DOMAIN) pointe bien vers $PUBLIC_IP"
  echo "    dans les DNS IONOS, attends quelques minutes, puis relance ce script."
fi
echo
echo " 🔐 Espace admin : https://$DOMAIN/admin  (identifiant : admin + le mot de passe choisi)"
echo " 👑 Le premier compte inscrit sur le site devient aussi super-admin."
sleep 2
if systemctl is-active --quiet theparadis; then echo " 🟢 Le site tourne."; else echo " 🔴 Le site ne démarre pas : journalctl -u theparadis -n 50"; fi
echo " 📁 Données (base + photos + vocaux) : $DATA_DIR"
echo " 🔄 Mettre à jour plus tard :  bash $APP_DIR/deploy/update.sh"
echo " 📜 Voir les journaux :         journalctl -u theparadis -f"
echo "====================================================================="
