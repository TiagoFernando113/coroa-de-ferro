#!/bin/sh
# Baixa os kits 3D da Kenney (licença CC0) usados para gerar os sprites.
set -e
cd "$(dirname "$0")"
mkdir -p kits
for p in castle-kit fantasy-town-kit; do
  [ -d "kits/$p" ] && continue
  url=$(curl -s "https://kenney.nl/assets/$p" | grep -oE 'https://kenney.nl/media/pages/assets/[^"]+\.zip' | head -1)
  curl -s -o "kits/$p.zip" "$url" && unzip -qo "kits/$p.zip" -d "kits/$p" && rm "kits/$p.zip"
done
