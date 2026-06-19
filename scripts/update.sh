#!/bin/bash
#
# update.sh — Update rapid după modificări de cod (fără reinstall deps).
#
# Utilizare: bash scripts/update.sh

set -e

cd /home/antonho/caddy/grevabanca

echo "[1/2] Restart Node prin PM2..."
pm2 reload grevabanca

echo "[2/2] Reload Caddy..."
sudo systemctl reload caddy

echo "===== Update complet! ====="
pm2 status