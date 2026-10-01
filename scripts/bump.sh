#!/bin/bash
# Incrementează versiunea ?v=N în toate paginile HTML, ca browserele
# (și Cloudflare) să ia CSS-ul și JS-ul nou după o modificare.
# Adaugă ?v= dacă lipsește pe vreun fișier JS sau CSS.

DIR="$(cd "$(dirname "$0")/../public" && pwd)"

# 1. Găsește versiunea curentă (din primul ?v= găsit)
CURRENT=$(grep -oh 'v=[0-9]*' "$DIR/index.html" | head -1 | sed 's/v=//')
if [ -z "$CURRENT" ]; then
    CURRENT=0
fi
NEXT=$((CURRENT + 1))

# 2. Incrementează ?v= existente
sed -i "s/?v=$CURRENT/?v=$NEXT/g" "$DIR"/*.html

# 3. Adaugă ?v= unde lipsește (JS și CSS)
sed -i "s|<script src=\"/js/\([^\"?]*\)\.js\"|<script src=\"/js/\1.js?v=$NEXT\"|g" "$DIR"/*.html
sed -i "s|<link rel=\"stylesheet\" href=\"/css/\([^\"?]*\)\.css\"|<link rel=\"stylesheet\" href=\"/css/\1.css?v=$NEXT\"|g" "$DIR"/*.html

echo "✅ Versiune: $CURRENT → $NEXT"
echo ""
echo "Verifică:"
grep -h "src=\"/js/\|href=\"/css/" "$DIR/index.html" | head -10
echo ""
echo "☁️  Acum dă Cloudflare Purge Everything!"
