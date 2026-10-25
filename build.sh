#!/usr/bin/env bash
# Regenerate the single-file game from src/.
# index.html = src/head.html + <script> + src/data.js + src/game.js + closing tags.
set -euo pipefail
cd "$(dirname "$0")"

for f in src/head.html src/data.js src/game.js; do
  if [[ ! -f "$f" ]]; then
    echo "missing $f" >&2
    exit 1
  fi
done

tmp="$(mktemp)"
{
  cat src/head.html
  printf '<script>\n'
  cat src/data.js
  cat src/game.js
  printf '</script>\n</body>\n</html>\n'
} > "$tmp"

cp "$tmp" index.html
cp "$tmp" "人生升級-安麗闖關v2.html"
rm -f "$tmp"
echo "wrote index.html and 人生升級-安麗闖關v2.html"
