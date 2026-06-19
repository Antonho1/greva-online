#!/bin/bash
cd /home/antonho/caddy/greva/public
if [ -f index.real.html ]; then
    mv index.html index.coming.html
    mv index.real.html index.html
    pm2 start greva 2>/dev/null || pm2 restart greva
    echo "✅ Site-ul GREVA e LIVE!"
else
    echo "⚠️  Deja live"
fi
