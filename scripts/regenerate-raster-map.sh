#!/usr/bin/env bash
# Regenerate raster-map.png from the official PDF (requires poppler: brew install poppler)
set -euo pipefail

PDF="${1:-$HOME/Downloads/260731 AH01-CD Definitief A1 Telefoonversie.pdf}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/app/assets/images/raster-map.png"
WIDTH="${2:-4096}"

if [[ ! -f "$PDF" ]]; then
  echo "PDF not found: $PDF" >&2
  exit 1
fi

if ! command -v pdftoppm >/dev/null; then
  echo "Install poppler: brew install poppler" >&2
  exit 1
fi

TMP="$(mktemp -t raster-map.XXXXXX)"
pdftoppm -png -scale-to-x "$WIDTH" -singlefile "$PDF" "$TMP"
mv "${TMP}.png" "$OUT"
rm -f "$TMP"
echo "Wrote $OUT ($(sips -g pixelWidth -g pixelHeight "$OUT" 2>/dev/null | awk '/pixel/ {print $2}' | tr '\n' x | sed 's/x$//'))"
