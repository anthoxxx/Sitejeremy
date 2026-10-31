#!/usr/bin/env bash
# The Paradise — mettre le site à jour avec la dernière version (en root)
set -euo pipefail
APP_DIR="/opt/theparadis"
BRANCH="${BRANCH:-ccr-bcda11d0-qn8psc}"
cp "/var/lib/theparadis/gajoxgaming.db" "/var/lib/theparadis/sauvegarde-$(date +%Y%m%d-%H%M).db" 2>/dev/null || true
git -C "$APP_DIR" fetch origin "$BRANCH"
git -C "$APP_DIR" reset --hard "origin/$BRANCH"
chown -R theparadis:theparadis "$APP_DIR"
sudo -u theparadis bash -c "cd '$APP_DIR' && npm ci --omit=dev"
systemctl restart theparadis
sleep 2
systemctl --no-pager --lines=5 status theparadis
echo "✅ Mise à jour terminée"
