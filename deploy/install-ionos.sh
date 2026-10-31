#!/usr/bin/env bash
# =====================================================================
#  The Paradise — installation automatique sur un VPS (IONOS ou autre)
#  Système : Ubuntu 22.04 ou 24.04, à lancer en root :
#     bash install-ionos.sh theparadise.fr ton-email@exemple.fr
#  Le script peut être relancé sans risque (il met à jour sans rien effacer).
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
apt-get install -y curl git nginx ufw build-essential python3 certbot python3-certbot-nginx coturn openssl

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
echo " 👑 Inscris-toi en premier sur le site : le premier compte devient super-admin."
sleep 2
if [ -f "$DATA_DIR/code-super-admin.txt" ]; then
  echo " 🔑 Code de secours super-admin (à entrer sur https://$DOMAIN/staff) : $(cat "$DATA_DIR/code-super-admin.txt")"
  echo "    Pour le revoir plus tard :  cat $DATA_DIR/code-super-admin.txt"
fi
echo " 📁 Données (base + photos + vocaux) : $DATA_DIR"
echo " 🔄 Mettre à jour plus tard :  bash $APP_DIR/deploy/update.sh"
echo " 📜 Voir les journaux :         journalctl -u theparadis -f"
echo "====================================================================="
