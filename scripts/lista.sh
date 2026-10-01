#!/bin/bash
# Afișează lista pending completă cu toate detaliile
#
# Necesită jq (sudo apt install jq).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PENDING="$ROOT/data/inscrieri-pending.jsonl"
PUBLIC="$ROOT/public/data/greve.json"

command -v jq >/dev/null || { echo "❌ Lipsește jq: sudo apt install jq"; exit 1; }

echo "📥 === PENDING (de aprobat/respins) ==="
echo ""

if [ ! -f "$PENDING" ] || [ ! -s "$PENDING" ]; then
    echo "  Nimic pending."
else
    nl -ba "$PENDING" | while IFS=$'\t' read -r num line; do
        num=$(echo "$num" | xargs)
        echo "─── [$num] ─────────────────────────"
        echo "$line" | jq -r '"  📋 \(.companie)\(if (.pancarta // "") != "" then "  (pancartă: \(.pancarta))" else "" end)\n  📅 \(.data_start) \(if (.ora_start // "") != "" then "ora \(.ora_start)" else "" end)\n  📍 \(.locatie)\(if (.oras // "") != "" then " · \(.oras)" else "" end)\n  🏢 \(.sector)\n  💬 \(.motiv)\n  👥 \(if (.organizator // "") != "" then .organizator else "(fără organizator)" end)\(if ((.news // []) | length) > 0 then "\n  📰 \((.news | map(.url)) | join("\n     "))" else "" end)\n  📧 \(.contact_email)"'
        echo ""
    done
fi

echo "📅 === ÎN CALENDAR ==="
echo ""
COUNT=$(jq '.greve | length' "$PUBLIC")
echo "  Total greve publicate: $COUNT"
echo ""
jq -r '.greve | sort_by(.data_start) | reverse | .[] | "  [\(.id)] \(.data_start) - \(.companie) \(if (.status_override // "") != "" then "(\(.status_override))" else "" end)"' "$PUBLIC"
