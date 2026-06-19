#!/bin/bash
cd /home/antonho/caddy/greva/public
if [ -f index.coming.html ]; then
    mv index.html index.real.html
    mv index.coming.html index.html
    pm2 stop greva
    echo "✅ Site-ul e OFFLINE (Coming Soon)"
else
    echo "⚠️  Deja offline"
fi
