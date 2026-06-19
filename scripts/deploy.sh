#!/bin/bash
#
# deploy.sh — Deployment initial pentru Greva Banca.
# Presupune că setup-server.sh a rulat deja.
#
# Utilizare (de pe laptop sau direct pe server):
#   bash scripts/deploy.sh

set -e

APP_DIR="/home/antonho/caddy/grevabanca"

echo "===== Deployment Greva Banca ====="

# 1. Folder
if [ ! -d "$APP_DIR" ]; then
    sudo mkdir -p "$APP_DIR"
    sudo chown -R $USER:$USER "$APP_DIR"
fi

# 2. Copiere fișiere (presupune că rulezi din root-ul proiectului)
echo "[1/5] Copiere fișiere..."
rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'tests' ./ "$APP_DIR/"

# 3. Install dependencies
echo "[2/5] npm install..."
cd "$APP_DIR"
npm install --production

# 4. Copiere socket.io client în vendor
echo "[3/5] Copiere socket.io client în public/vendor..."
mkdir -p public/vendor
cp node_modules/socket.io/client-dist/socket.io.min.js public/vendor/

# 5. Caddy config
echo "[4/5] Caddyfile..."
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy

# 6. PM2
echo "[5/5] Pornire Node prin PM2..."
pm2 startOrReload ecosystem.config.js
pm2 save

echo ""
echo "===== Deploy complet! ====="
echo "Verifică: curl https://grevabanca.xyz/health"
pm2 status