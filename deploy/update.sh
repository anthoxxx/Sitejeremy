#!/usr/bin/env bash
# The Paradise — mettre le site à jour avec la dernière version (en root) :
#    bash /opt/theparadis/deploy/update.sh
set -euo pipefail
APP_DIR="/opt/theparadis"
DATA_DIR="/var/lib/theparadis"
BRANCH="${BRANCH:-ccr-bcda11d0-qn8psc}"

echo "==> Sauvegarde de la base avant la mise à jour"
mkdir -p "$DATA_DIR/sauvegardes"
DEST="$DATA_DIR/sauvegardes/avant-maj-$(date +%Y%m%d-%H%M).db"
# Copie propre même pendant que le site tourne (sauvegarde intégrée de SQLite)
if sudo -u theparadis bash -c "cd '$APP_DIR' && node -e \"require('better-sqlite3')('$DATA_DIR/gajoxgaming.db',{readonly:true}).backup('$DEST').then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)})\""; then
  echo "    $DEST"
else
  echo "    ⚠️ Sauvegarde impossible (base absente ?) : on continue quand même."
fi
# On garde les 10 dernières
ls -1t "$DATA_DIR"/sauvegardes/avant-maj-*.db 2>/dev/null | tail -n +11 | xargs -r rm -f

echo "==> Récupération de la dernière version"
git -C "$APP_DIR" fetch origin "$BRANCH"
git -C "$APP_DIR" reset --hard "origin/$BRANCH"
chown -R theparadis:theparadis "$APP_DIR"
sudo -u theparadis bash -c "cd '$APP_DIR' && npm ci --omit=dev"

echo "==> Redémarrage"
systemctl restart theparadis
sleep 3
if systemctl is-active --quiet theparadis; then
  echo "✅ Mise à jour terminée : le site tourne (les pages ouvertes se rechargent toutes seules)."
else
  echo "🔴 Le site ne redémarre pas. Dernières lignes du journal :"
  journalctl -u theparadis -n 30 --no-pager
fi
