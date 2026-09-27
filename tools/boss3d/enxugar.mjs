// Remove animações não usadas dos personagens e junta tudo em modelos3d.json (texturas embutidas).
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, resample, quantize } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const KITS = path.join(AQUI, '..', 'sprites', 'kits');
// node_modules: link para tools/sprites/node_modules
const DUN = path.join(KITS, 'mini-dungeon/Models/GLB format'), MIN = path.join(KITS, 'mini-characters/Models/GLB format');
const KAY = path.join(KITS, 'kaykit');
const COMUM = ['Idle', 'Walking_A', 'Running_A', 'Death_A', 'Hit_A', 'Cheer', 'Dodge_Forward'];
// [pasta, arquivo, animações extras, nós (armas/acessórios) a remover]
const MODELOS = {
  cavaleiro: [KAY, 'Knight', ['1H_Melee_Attack_Chop', 'Block'], ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '2H_Sword']],
  arqueira: [KAY, 'Rogue_Hooded', ['1H_Ranged_Shoot'], ['Knife_Offhand', '2H_Crossbow', 'Knife', 'Throwable']],
  maga: [KAY, 'Mage', ['Spellcast_Shoot'], ['Spellbook', 'Spellbook_open', '1H_Wand']],
  barbaro: [KAY, 'Barbarian', ['2H_Melee_Attack_Chop'], ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', 'Mug']],
  rei: [KAY, 'Skeleton_Warrior', ['2H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', 'Spellcast_Shoot', 'Spellcast_Summon', 'Spellcast_Raise', '2H_Melee_Attack_Spinning', 'Taunt', 'Idle_Combat'], []],
  lacaio: [KAY, 'Skeleton_Minion', ['1H_Melee_Attack_Chop', 'Spawn_Ground_Skeletons', 'Walking_D_Skeletons', 'Death_C_Skeletons'], []],
  machado: [path.join(KAY, 'armas'), 'Skeleton_Axe.gltf'], escudo: [path.join(KAY, 'armas'), 'Skeleton_Shield_Large_A.gltf'], lamina: [path.join(KAY, 'armas'), 'Skeleton_Blade.gltf'],
  parede: [DUN, 'wall'], coluna: [DUN, 'column'], bandeira: [DUN, 'banner'], barril: [DUN, 'barrel'], pedras: [DUN, 'rocks'], bau: [DUN, 'chest'],
};
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const out = {}; // nome -> Buffer GLB
for (const [k, [dir, n, anims, tirar]] of Object.entries(MODELOS)) {
  const doc = await io.read(path.join(dir, n.includes('.') ? n : n + '.glb'));
  const usadas = new Set(anims ? [...COMUM, ...anims] : []);
  for (const a of doc.getRoot().listAnimations()) if (!usadas.has(a.getName())) {
    for (const s of a.listSamplers()) s.dispose();
    for (const c of a.listChannels()) c.dispose();
    a.dispose();
  }
  for (const nd of doc.getRoot().listNodes()) if ((tirar || []).includes(nd.getName())) nd.dispose();
  await doc.transform(resample({ tolerance: 1e-3 }), prune(), dedup(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
  out[k] = Buffer.from(await io.writeBinary(doc)); // writeBinary embute a textura no GLB
}
// pacote binário: [u32 tamanho do cabeçalho][cabeçalho JSON {nome:[início,tamanho]}][GLBs]
const cab = {}; let pos = 0;
for (const [k, b] of Object.entries(out)) { cab[k] = [pos, b.length]; pos += b.length; }
const cj = Buffer.from(JSON.stringify(cab)), tam = Buffer.alloc(4); tam.writeUInt32LE(cj.length);
const dest = path.join(AQUI, '..', '..', 'modelos3d.bin');
fs.writeFileSync(dest, Buffer.concat([tam, cj, ...Object.values(out)]));
console.log(Object.keys(out).length, 'modelos,', Math.round(fs.statSync(dest).size / 1024), 'KB');
