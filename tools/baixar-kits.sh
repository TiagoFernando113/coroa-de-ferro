#!/bin/sh
# Baixa os modelos 3D usados pelo jogo (todos com licença CC0) para tools/kits:
# kits da Kenney (vila, castelo, natureza, masmorra) e personagens KayKit (Kay Lousberg).
# Depois: cd tools && npm install && node empacotar.mjs && node build.mjs
set -e
cd "$(dirname "$0")"
mkdir -p kits/kaykit/armas
for p in castle-kit fantasy-town-kit nature-kit mini-dungeon interface-sounds rpg-audio music-jingles; do
  [ -d "kits/$p" ] && continue
  url=$(curl -s "https://kenney.nl/assets/$p" | grep -oE 'https://kenney.nl/media/pages/assets/[^"]+\.zip' | head -1)
  curl -sL -o "kits/$p.zip" "$url" && unzip -qo "kits/$p.zip" -d "kits/$p" && rm "kits/$p.zip"
done
A=https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf
S=https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/main/addons/kaykit_character_pack_skeletons
for n in Knight Barbarian Mage Rogue Rogue_Hooded; do
  [ -f "kits/kaykit/$n.glb" ] || curl -sfL -o "kits/kaykit/$n.glb" "$A/$n.glb"
done
for n in Skeleton_Minion Skeleton_Warrior Skeleton_Rogue Skeleton_Mage; do
  [ -f "kits/kaykit/$n.glb" ] || curl -sfL -o "kits/kaykit/$n.glb" "$S/Characters/gltf/$n.glb"
done
for n in Skeleton_Axe Skeleton_Blade Skeleton_Staff Skeleton_Crossbow Skeleton_Shield_Large_A Skeleton_Shield_Small_A; do
  for e in gltf bin; do [ -f "kits/kaykit/armas/$n.$e" ] || curl -sfL -o "kits/kaykit/armas/$n.$e" "$S/Assets/gltf/$n.$e"; done
done
[ -f kits/kaykit/armas/skeleton_texture.png ] || curl -sfL -o kits/kaykit/armas/skeleton_texture.png "$S/Assets/gltf/skeleton_texture.png"
mkdir -p kits/fontes
[ -f kits/fontes/LilitaOne.ttf ] || curl -sfL -o kits/fontes/LilitaOne.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/lilitaone/LilitaOne-Regular.ttf
[ -f kits/fontes/Fredoka.ttf ] || curl -sfL -o kits/fontes/Fredoka.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/fredoka/Fredoka%5Bwdth,wght%5D.ttf"
