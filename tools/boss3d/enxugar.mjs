// Remove animações não usadas dos personagens e junta tudo em modelos3d.json (texturas embutidas).
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const KITS = path.join(AQUI, '..', 'sprites', 'kits');
process.chdir(path.join(AQUI, '..', 'sprites')); // node_modules ficam em tools/sprites
const DUN = path.join(KITS, 'mini-dungeon/Models/GLB format'), MIN = path.join(KITS, 'mini-characters/Models/GLB format');
const MODELOS = {
  humano: [DUN, 'character-human'], orc: [DUN, 'character-orc'],
  lanceira: [MIN, 'character-female-b'], maga: [MIN, 'character-female-e'], paladino: [MIN, 'character-male-e'],
  espada: [DUN, 'weapon-sword'], lanca: [DUN, 'weapon-spear'], escudoR: [DUN, 'shield-round'], escudoQ: [DUN, 'shield-rectangle'],
  parede: [DUN, 'wall'], coluna: [DUN, 'column'], bandeira: [DUN, 'banner'], barril: [DUN, 'barrel'], pedras: [DUN, 'rocks'], bau: [DUN, 'chest'],
};
const USADAS = new Set(['idle', 'walk', 'sprint', 'attack-melee-right', 'die', 'emote-yes']);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const out = {};
for (const [k, [dir, n]] of Object.entries(MODELOS)) {
  const doc = await io.read(path.join(dir, n + '.glb'));
  for (const a of doc.getRoot().listAnimations()) if (!USADAS.has(a.getName())) a.dispose();
  await doc.transform(prune(), dedup());
  out[k] = Buffer.from(await io.writeBinary(doc)).toString('base64'); // writeBinary embute a textura no GLB
}
const dest = path.join(AQUI, '..', '..', 'modelos3d.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log(Object.keys(out).length, 'modelos,', Math.round(fs.statSync(dest).size / 1024), 'KB');
