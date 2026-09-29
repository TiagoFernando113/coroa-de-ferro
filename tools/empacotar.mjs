// Junta todos os modelos 3D do jogo em modelos.bin (um único download).
//  - personagens KayKit: só as animações usadas e só as armas de cada um;
//  - peças de cenário (Kenney): todas num GLB "cenario" com um nó por peça,
//    para as texturas repetidas (colormap) virem uma só.
// Formato: [u32 tamanho do cabeçalho][cabeçalho JSON {nome:[início,tamanho]}][GLBs]
import { NodeIO, Document } from '@gltf-transform/core';
import { prune, dedup, resample, quantize, mergeDocuments } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const KITS = path.join(AQUI, 'kits');
const KAY = path.join(KITS, 'kaykit'), ARM = path.join(KAY, 'armas');
const T = path.join(KITS, 'fantasy-town-kit/Models/GLB format');
const C = path.join(KITS, 'castle-kit/Models/GLB format');
const N = path.join(KITS, 'nature-kit/Models/GLTF format');
const D = path.join(KITS, 'mini-dungeon/Models/GLB format');

const COMUM = ['Idle', 'Running_A', 'Walking_A', 'Death_A', 'Hit_A', 'Dodge_Forward', 'Cheer', 'Interact'];
const ESQ = ['Spawn_Ground_Skeletons', 'Death_C_Skeletons', 'Idle_Combat'];
// nome: [arquivo, animações extras, nós (armas) a remover]
const PERSONAGENS = {
  cav: ['Knight', ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '2H_Melee_Attack_Spin', 'Block'],
    ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '2H_Sword']],
  bar: ['Barbarian', ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Spinning', 'Jump_Full_Short'],
    ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', 'Mug']],
  arq: ['Rogue_Hooded', ['2H_Ranged_Shoot', 'Dodge_Backward', 'Throw'], ['Knife_Offhand', '1H_Crossbow', 'Knife', 'Throwable']],
  mag: ['Mage', ['Spellcast_Shoot', 'Spellcast_Long', 'Spellcast_Raise'], ['Spellbook', 'Spellbook_open', '1H_Wand']],
  npc: ['Rogue', [], ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable']],
  lacaio: ['Skeleton_Minion', ['1H_Melee_Attack_Chop', ...ESQ], []],
  guerreiro: ['Skeleton_Warrior', ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spinning', 'Spellcast_Summon', 'Taunt', ...ESQ], []],
  batedor: ['Skeleton_Rogue', ['2H_Ranged_Shoot', ...ESQ], []],
  necro: ['Skeleton_Mage', ['Spellcast_Shoot', 'Spellcast_Summon', ...ESQ], []],
};
const AVULSOS = { // armas dos esqueletos e itens do chão
  machado: [ARM, 'Skeleton_Axe.gltf'], lamina: [ARM, 'Skeleton_Blade.gltf'], cajado: [ARM, 'Skeleton_Staff.gltf'],
  besta: [ARM, 'Skeleton_Crossbow.gltf'], escudoG: [ARM, 'Skeleton_Shield_Large_A.gltf'], escudoP: [ARM, 'Skeleton_Shield_Small_A.gltf'],
};
const CENARIO = {
  T: ['wall', 'wall-door', 'wall-window-shutters', 'wall-wood', 'wall-wood-door', 'wall-wood-window-shutters', 'roof', 'roof-gable', 'roof-gable-end',
    'roof-point', 'roof-corner', 'chimney', 'fountain-round', 'stall-red', 'stall-green', 'stall-bench', 'lantern', 'fence', 'fence-gate', 'hedge',
    'cart', 'banner-red', 'pillar-wood', 'windmill', 'wheel', 'planks', 'tree', 'tree-high-round', 'watermill', 'wall-wood-broken'],
  C: ['wall', 'wall-corner', 'tower-square', 'tower-square-roof', 'tower-hexagon-base', 'tower-hexagon-top', 'gate', 'flag', 'stairs-stone',
    'siege-catapult-demolished', 'wall-half', 'tower-base', 'tower-square-base', 'tower-square-mid', 'tower-square-mid-windows', 'tower-square-top',
    'tower-square-top-roof-high', 'tower-hexagon-mid', 'tower-hexagon-roof', 'siege-catapult', 'siege-ballista', 'siege-trebuchet', 'metal-gate',
    'flag-banner-long', 'wall-doorway'],
  N: ['tree_oak', 'tree_oak_dark', 'tree_default', 'tree_pineTallA', 'tree_pineRoundB', 'tree_fat', 'tree_detailed', 'tree_default_dark',
    'rock_largeA', 'rock_largeC', 'rock_tallA', 'stone_tallB', 'stone_largeB', 'grass', 'grass_large', 'flower_redA', 'flower_yellowA', 'flower_purpleA',
    'plant_bush', 'plant_bushLarge', 'mushroom_red', 'mushroom_redGroup', 'stump_round', 'log', 'campfire_stones', 'campfire_logs', 'tent_detailedOpen',
    'statue_column', 'statue_columnDamaged', 'statue_obelisk', 'statue_head', 'sign', 'cliff_block_rock', 'pot_large', 'crop_pumpkin',
    'crops_wheatStageB', 'fence_simple', 'log_stack'],
  D: ['coin', 'chest', 'potion', 'key', 'barrel', 'banner', 'column', 'weapon-sword', 'shield-round'],
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const Q = quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 });
const out = {};

for (const [k, [arq, extras, tirar]] of Object.entries(PERSONAGENS)) {
  const doc = await io.read(path.join(KAY, arq + '.glb'));
  const usadas = new Set([...COMUM, ...extras]);
  for (const a of doc.getRoot().listAnimations()) if (!usadas.has(a.getName())) {
    for (const s of a.listSamplers()) s.dispose();
    for (const c of a.listChannels()) c.dispose();
    a.dispose();
  }
  for (const nd of doc.getRoot().listNodes()) if (tirar.includes(nd.getName())) nd.dispose();
  await doc.transform(resample({ tolerance: 1e-3 }), prune(), dedup(), Q);
  out[k] = Buffer.from(await io.writeBinary(doc));
}
for (const [k, [dir, arq]] of Object.entries(AVULSOS)) {
  const doc = await io.read(path.join(dir, arq));
  await doc.transform(prune(), dedup(), Q);
  out[k] = Buffer.from(await io.writeBinary(doc));
}

// cenário: um documento só, cada peça vira um nó "kit:nome" na cena principal
const cen = new Document(); const cena = cen.createScene('cenario'); cen.createBuffer();
for (const [kit, nomes] of Object.entries(CENARIO)) {
  const dir = { T, C, N, D }[kit];
  for (const n of nomes) {
    const src = await io.read(path.join(dir, n + '.glb'));
    for (const b of src.getRoot().listBuffers()) b.dispose(); // um buffer só no destino
    mergeDocuments(cen, src);
    const cenas = cen.getRoot().listScenes(), nova = cenas[cenas.length - 1];
    const no = cen.createNode(kit + ':' + n);
    for (const filho of nova.listChildren()) { nova.removeChild(filho); no.addChild(filho); }
    cena.addChild(no); nova.dispose();
  }
}
const buf = cen.getRoot().listBuffers()[0];
for (const a of cen.getRoot().listAccessors()) a.setBuffer(buf);
for (const b of cen.getRoot().listBuffers()) if (b !== buf) b.dispose();
await cen.transform(prune({ keepLeaves: true }), dedup(), Q);
out.cenario = Buffer.from(await io.writeBinary(cen));

const cab = {}; let pos = 0;
for (const [k, b] of Object.entries(out)) { cab[k] = [pos, b.length]; pos += b.length; }
const cj = Buffer.from(JSON.stringify(cab)), tam = Buffer.alloc(4); tam.writeUInt32LE(cj.length);
const dest = path.join(AQUI, '..', 'modelos.bin');
fs.writeFileSync(dest, Buffer.concat([tam, cj, ...Object.values(out)]));
for (const [k, b] of Object.entries(out)) console.log(k.padEnd(10), Math.round(b.length / 1024), 'KB');
console.log('total', Math.round(fs.statSync(dest).size / 1024), 'KB');
