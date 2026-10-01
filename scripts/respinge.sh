#!/bin/bash
# Respinge (șterge) o înscriere fără să o aprobe
# Folosire:
#   scripts/respinge.sh       -> afișează lista cu numere
#   scripts/respinge.sh 3     -> șterge înscrierea #3
#
# Necesită jq (sudo apt install jq).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PENDING="$ROOT/data/inscrieri-pending.jsonl"

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
    echo "❌ Dă numărul înscrierii, ex: scripts/respinge.sh 3"
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

echo "Vrei să ȘTERGI această înscriere?"
echo ""
echo "$INREG" | jq -r '"📋 Companie: \(.companie)\n📍 Locație: \(.locatie)\n📅 Data: \(.data_start)\n📧 Email: \(.contact_email)\n💬 Motiv: \(.motiv)"'
echo ""
echo "⚠️  Atenție: ștergerea este definitivă (nu se poate recupera)."
read -p "Continui? [y/N]: " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Anulat."
    exit 0
fi

sed -i "${LINE_NUM}d" "$PENDING"

echo ""
echo "✅ Înscriere ștearsă din pending."
echo ""

# Afișează ce a rămas
REMAINING=$(wc -l < "$PENDING")
if [ "$REMAINING" -gt 0 ]; then
    echo "📥 Au mai rămas $REMAINING înscrieri pending:"
    echo ""
    show_list
else
    echo "📭 Nu mai sunt înscrieri pending."
fi
