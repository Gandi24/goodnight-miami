#!/usr/bin/env bash
# Renders the social preview and app icons from the HTML sources in tools/.
# Requires Google Chrome (headless) and network access for Google Fonts.
set -euo pipefail

cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT=assets/img

shot() { # <html> <width> <height> <output>
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --virtual-time-budget=8000 --window-size="$2,$3" \
    --screenshot="$4" "file://$PWD/$1" >/dev/null 2>&1
  echo "wrote $4"
}

icon() { # <size> <output>
  shot "tools/icon.html?size=$1" "$1" "$1" "$2"
}

shot tools/og-image.html 1200 630 "$OUT/og-image.png"
icon 180 "$OUT/apple-touch-icon.png"
icon 192 "$OUT/icon-192.png"
icon 512 "$OUT/icon-512.png"
icon 32 "$OUT/favicon-32.png"
