#!/bin/bash
# Aprobă o înscriere și o mută în greve.json
# Folosire:
#   scripts/aproba.sh       -> afișează lista cu numere
#   scripts/aproba.sh 3     -> aprobă înscrierea #3
#
# Necesită jq (sudo apt install jq).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PENDING="$ROOT/data/inscrieri-pending.jsonl"
PUBLIC="$ROOT/public/data/greve.json"

command -v jq >/dev/null || { echo "❌ Lipsește jq: sudo apt install jq"; exit 1; }

# === Funcție: afișează lista pending ===
show_list() {
    if [ ! -f "$PENDING" ] || [ ! -s "$PENDING" ]; then
        echo "Nicio înscriere pending."
        return 1
    fi

    echo "=== Înscrieri pending ==="
    echo ""
    nl -ba "$PENDING" | while IFS=$'\t' read -r num line; do
        num=$(echo "$num" | xargs)
        echo "[$num] $(echo "$line" | jq -r '.companie + " | " + .data_start + " | " + .locatie + " | " + .contact_email')"
    done
    echo ""
}

# === Fără argument - afișează lista ===
if [ -z "$1" ]; then
    show_list || exit 0
    echo "Folosește:"
    echo "  scripts/aproba.sh <număr>     - aprobă înscrierea"
    echo "  scripts/respinge.sh <număr>   - șterge înscrierea"
    exit 0
fi

if ! [[ "$1" =~ ^[0-9]+$ ]]; then
    echo "❌ Dă numărul înscrierii, ex: scripts/aproba.sh 3"
    exit 1
fi

LINE_NUM=$1
INREG=$(sed -n "${LINE_NUM}p" "$PENDING")
if [ -z "$INREG" ]; then
    echo "❌ Linia $LINE_NUM nu există în pending."
    echo ""
    show_list
    exit 1
fi

echo "Vrei să aprobi această înscriere?"
echo ""
echo "$INREG" | jq
echo ""
read -p "Continui? [y/N]: " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Anulat."
    exit 0
fi

# === Generăm ID nou ===
NEW_ID=$(jq '[.greve[].id] | max // 0' "$PUBLIC")
NEW_ID=$((NEW_ID + 1))

# === Construim noul obiect (fără email și IP — rămân doar datele publice) ===
NEW_ENTRY=$(echo "$INREG" | jq --argjson id "$NEW_ID" '{
    id: $id,
    tip: (.tip // "greva"),
    data_start: .data_start,
    data_end: (.data_end // ""),
    ora_start: (.ora_start // .ora // ""),
    ora_end: (.ora_end // ""),
    companie: .companie,
    sector: .sector,
    locatie: .locatie,
    oras: (.oras // ""),
    pancarta: (.pancarta // ""),
    motiv: .motiv,
    organizator: (.organizator // ""),
    site: (.site // ""),
    status_override: "",
    rezultat: "",
    news: (.news // [])
}')

# === Adaugă în greve.json ===
TMP=$(mktemp)
jq --argjson new "$NEW_ENTRY" '.greve += [$new]' "$PUBLIC" > "$TMP"
mv "$TMP" "$PUBLIC"
chmod 644 "$PUBLIC"

# === Șterge linia din pending (și odată cu ea emailul și IP-ul) ===
sed -i "${LINE_NUM}d" "$PENDING"

echo ""
echo "✅ Aprobată și mutată în calendar!"
echo "ID nou: $NEW_ID"
echo ""
echo "📧 Email pentru notificare: $(echo "$INREG" | jq -r .contact_email)"
echo ""
echo "📝 Pentru a edita ulterior pancarta / status_override / rezultat / news:"
echo "   nano $PUBLIC"
echo ""
echo "Înregistrarea adăugată:"
echo "$NEW_ENTRY" | jq
