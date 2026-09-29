// Junta todos os modelos 3D do jogo em modelos.bin (um único download).
//  - personagens KayKit: só as animações usadas e só as armas de cada um;
//  - peças de cenário (Kenney): todas num GLB "cenario" com um nó por peça,
//    para as texturas repetidas (colormap) virem uma só.
// Formato: [u32 tamanho do cabeçalho][cabeçalho JSON {nome:[início,tamanho]}][GLBs]
import { NodeIO, Document } from '@gltf-transform/core';
import { prune, dedup, resample, quantize, mergeDocuments, meshopt, getBounds } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const KITS = path.join(AQUI, 'kits');
const KAY = path.join(KITS, 'kaykit'), ARM = path.join(KAY, 'armas');
const T = path.join(KITS, 'fantasy-town-kit/Models/GLB format');
const C = path.join(KITS, 'castle-kit/Models/GLB format');
const N = path.join(KITS, 'nature-kit/Models/GLTF format');
const D = path.join(KITS, 'mini-dungeon/Models/GLB format');
const AV = path.join(KITS, 'aventureiros2'), ANI = path.join(KITS, 'animacoes/Animations/gltf/Rig_Medium');
const A = path.join(AV, 'Assets/gltf'), W = path.join(KITS, 'armas-bits/Assets/gltf');
const QN = path.join(KITS, 'natureza2/leve');
const ANIMAIS = ['Wolf', 'Fox', 'Stag', 'Bull', 'Husky']; // Quaternius Ultimate Animated Animals (CC0) // Quaternius Stylized Nature MegaKit (CC0), texturas reduzidas

const COMUM = ['Idle', 'Running_A', 'Walking_A', 'Death_A', 'Hit_A', 'Dodge_Forward', 'Cheer', 'Interact'];
const ESQ = ['Spawn_Ground_Skeletons', 'Death_C_Skeletons', 'Idle_Combat'];
// nome: [arquivo, animações extras, nós (armas) a remover]
const PERSONAGENS = {
  lacaio: ['Skeleton_Minion', ['1H_Melee_Attack_Chop', ...ESQ], []],
  guerreiro: ['Skeleton_Warrior', ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Jump_Chop', '2H_Melee_Attack_Spinning', 'Spellcast_Summon', 'Taunt', ...ESQ], []],
  batedor: ['Skeleton_Rogue', ['2H_Ranged_Shoot', ...ESQ], []],
  necro: ['Skeleton_Mage', ['Spellcast_Shoot', 'Spellcast_Summon', ...ESQ], []],
};
const AVULSOS = { // armas dos esqueletos e itens do chão
  machado: [ARM, 'Skeleton_Axe.gltf'], lamina: [ARM, 'Skeleton_Blade.gltf'], cajado: [ARM, 'Skeleton_Staff.gltf'],
  besta: [ARM, 'Skeleton_Crossbow.gltf'], escudoG: [ARM, 'Skeleton_Shield_Large_A.gltf'], escudoP: [ARM, 'Skeleton_Shield_Small_A.gltf'],
};
// heróis modulares (KayKit Adventurers 2.0): todos usam o mesmo esqueleto, então as peças se misturam
const HEROIS = ['Knight', 'Barbarian', 'Mage', 'Ranger', 'Rogue', 'Rogue_Hooded'];
// animações do Rig_Medium (KayKit Character Animations): um GLB por arquivo, só as usadas
const ANIMS = {
  geral: ['General', ['Idle_A', 'Idle_B', 'Hit_A', 'Death_A', 'Interact', 'PickUp', 'Spawn_Ground', 'Throw', 'Use_Item']],
  mov: ['MovementBasic', ['Walking_A', 'Walking_B', 'Running_A', 'Running_B', 'Jump_Full_Short']],
  mov2: ['MovementAdvanced', ['Dodge_Forward', 'Dodge_Backward', 'Sneaking', 'Walking_Backwards']],
  corpo: ['CombatMelee', ['Melee_1H_Attack_Chop', 'Melee_1H_Attack_Slice_Diagonal', 'Melee_1H_Attack_Slice_Horizontal', 'Melee_1H_Attack_Stab', 'Melee_1H_Attack_Jump_Chop',
    'Melee_2H_Attack_Chop', 'Melee_2H_Attack_Slice', 'Melee_2H_Attack_Spin', 'Melee_2H_Attack_Spinning', 'Melee_2H_Idle', 'Melee_Block', 'Melee_Blocking',
    'Melee_Dualwield_Attack_Chop', 'Melee_Dualwield_Attack_Slice', 'Melee_Dualwield_Attack_Stab', 'Melee_Unarmed_Attack_Punch_A', 'Melee_Unarmed_Attack_Kick', 'Melee_Unarmed_Idle']],
  dist: ['CombatRanged', ['Ranged_Bow_Draw', 'Ranged_Bow_Release', 'Ranged_Bow_Idle', 'Ranged_Bow_Aiming_Idle', 'Ranged_1H_Shoot', 'Ranged_2H_Shoot',
    'Ranged_Magic_Shoot', 'Ranged_Magic_Raise', 'Ranged_Magic_Spellcasting', 'Ranged_Magic_Summon', 'Ranged_Magic_Spellcasting_Long']],
  vida: ['Simulation', ['Cheering', 'Waving', 'Push_Ups', 'Sit_Ups', 'Sit_Floor_Idle', 'Sit_Chair_Idle', 'Lie_Idle']],
  oficio: ['Tools', ['Hammering', 'Chopping', 'Working_A', 'Digging']],
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
    'cactus_short', 'cactus_tall', 'tree_palmTall', 'tree_palmShort', 'tree_blocks_dark', 'tree_blocks_fall', 'rock_largeD', 'rock_tallE', 'rock_tallJ', 'tree_pineSmallA', 'tree_pineRoundD', 'lily_large',
    'crops_wheatStageB', 'fence_simple', 'log_stack'],
  A: ['sword_1handed', 'sword_2handed', 'sword_2handed_color', 'axe_1handed', 'axe_2handed', 'dagger', 'staff', 'wand', 'bow_withString', 'crossbow_1handed',
    'crossbow_2handed', 'shield_badge', 'shield_badge_color', 'shield_round', 'shield_round_barbarian', 'shield_round_color', 'shield_spikes',
    'shield_spikes_color', 'shield_square', 'shield_square_color', 'spellbook_closed', 'spellbook_open', 'mug_full', 'quiver', 'smokebomb'],
  W: ['axe_A', 'axe_B', 'axe_C', 'bow_A_withString', 'bow_B_withString', 'dagger_A', 'dagger_B', 'fistweapon_A', 'fistweapon_B', 'halberd', 'hammer_A',
    'hammer_B', 'hammer_C', 'shield_A', 'shield_B', 'shield_C', 'spear_A', 'staff_A', 'staff_B', 'sword_A', 'sword_B', 'sword_C', 'sword_D', 'sword_E', 'wand_A'],
  Q: ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5', 'Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5', 'TwistedTree_1', 'TwistedTree_3',
    'DeadTree_1', 'DeadTree_3', 'Bush_Common', 'Bush_Common_Flowers', 'Fern_1', 'Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wispy_Tall', 'Flower_3_Group', 'Flower_4_Group',
    'Mushroom_Common', 'Plant_1_Big', 'Plant_7_Big', 'Clover_1', 'Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3', 'RockPath_Round_Small_1', 'RockPath_Round_Small_2',
    'RockPath_Round_Small_3', 'RockPath_Round_Wide', 'Pebble_Round_1', 'Pebble_Round_2', 'Pebble_Round_3'],
  D: ['coin', 'chest', 'potion', 'key', 'barrel', 'banner', 'column', 'weapon-sword', 'shield-round', 'wall', 'wall-half', 'wall-opening', 'gate',
    'rocks', 'stones', 'trap', 'dirt', 'floor', 'floor-detail', 'wood-support', 'table'],
};

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
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
for (const n of ANIMAIS) {
  const doc = await io.read(path.join(KITS, 'animais', n + '.gltf'));
  await doc.transform(resample({ tolerance: 1e-3 }), prune(), dedup());
  out['bicho:' + n] = Buffer.from(await io.writeBinary(doc));
}
// monstros (Quaternius Ultimate Monsters, CC0): animações renomeadas para o padrão dos bichos
// (Idle, Gallop = andar, Attack, Death, Idle_HitReact1) e comprimidas com meshopt
const MONSTROS = {
  mg: ['big', { Idle: 'Idle', Run: 'Gallop', Punch: 'Attack', Weapon: 'Attack2', Death: 'Death', HitReact: 'Idle_HitReact1' }],
  mb: ['blob', { Idle: 'Idle', Walk: 'Gallop', Bite_Front: 'Attack', Jump: 'Attack2', Death: 'Death', HitRecieve: 'Idle_HitReact1' }],
  mv: ['flying', { Flying_Idle: 'Idle', Fast_Flying: 'Gallop', Headbutt: 'Attack', Punch: 'Attack2', Death: 'Death', HitReact: 'Idle_HitReact1' }],
};
const alturas = {};
for (const [pre, [dir, ren]] of Object.entries(MONSTROS)) for (const f of fs.readdirSync(path.join(KITS, 'monstros', dir)).filter(f => f.endsWith('.gltf'))) {
  const doc = await io.read(path.join(KITS, 'monstros', dir, f));
  const an = doc.getRoot().listAnimations(); if (an.length < 3) continue; // sem animações suficientes
  for (const a of an) if (ren[a.getName()]) a.setName(ren[a.getName()]); else { for (const s of a.listSamplers()) s.dispose(); for (const c of a.listChannels()) c.dispose(); a.dispose(); }
  const b = getBounds(doc.getRoot().listScenes()[0]); alturas[pre + ':' + f.replace('.gltf', '')] = +(b.max[1] - b.min[1]).toFixed(2);
  await doc.transform(resample({ tolerance: 1e-3 }), prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  out[pre + ':' + f.replace('.gltf', '')] = Buffer.from(await io.writeBinary(doc));
}
fs.writeFileSync(path.join(AQUI, 'alturas.json'), JSON.stringify(alturas, null, 1));
for (const [k, [dir, arq]] of Object.entries(AVULSOS)) {
  const doc = await io.read(path.join(dir, arq));
  await doc.transform(prune(), dedup(), Q);
  out[k] = Buffer.from(await io.writeBinary(doc));
}

// heróis: um documento só, um nó "h:Nome" por aventureiro (esqueleto + peças)
{
  const doc = new Document(); const cena = doc.createScene('herois'); doc.createBuffer();
  for (const n of HEROIS) {
    const src = await io.read(path.join(AV, 'Characters/gltf', n + '.glb'));
    for (const b of src.getRoot().listBuffers()) b.dispose();
    mergeDocuments(doc, src);
    const cenas = doc.getRoot().listScenes(), nova = cenas[cenas.length - 1], no = doc.createNode('h:' + n);
    for (const f of nova.listChildren()) { nova.removeChild(f); no.addChild(f); }
    cena.addChild(no); nova.dispose();
  }
  const buf = doc.getRoot().listBuffers()[0];
  for (const a of doc.getRoot().listAccessors()) a.setBuffer(buf);
  for (const b of doc.getRoot().listBuffers()) if (b !== buf) b.dispose();
  // sem quantize: ele mexe nas matrizes de bind de cada peça e aí as peças não compartilham o esqueleto
  await doc.transform(prune({ keepLeaves: true }), dedup());
  out.herois = Buffer.from(await io.writeBinary(doc));
}
for (const [k, [arq, usadas]] of Object.entries(ANIMS)) {
  const doc = await io.read(path.join(ANI, `Rig_Medium_${arq}.glb`));
  for (const a of doc.getRoot().listAnimations()) if (!usadas.includes(a.getName())) { for (const s of a.listSamplers()) s.dispose(); for (const c of a.listChannels()) c.dispose(); a.dispose(); }
  for (const nd of doc.getRoot().listNodes()) if (nd.getMesh()) nd.setMesh(null).setSkin(null);
  for (const m of doc.getRoot().listMeshes()) m.dispose();
  await doc.transform(resample({ tolerance: 1e-3 }), prune({ keepLeaves: true }), dedup());
  out['a:' + k] = Buffer.from(await io.writeBinary(doc));
}

// cenário: um documento só, cada peça vira um nó "kit:nome" na cena principal
const cen = new Document(); const cena = cen.createScene('cenario'); cen.createBuffer();
for (const [kit, nomes] of Object.entries(CENARIO)) {
  const dir = { T, C, N, D, A, W, Q: QN }[kit], ext = kit === 'A' || kit === 'W' || kit === 'Q' ? '.gltf' : '.glb';
  for (const n of nomes) {
    const src = await io.read(path.join(dir, n + (kit === 'N' ? '.glb' : ext)));
    for (const b of src.getRoot().listBuffers()) b.dispose(); // um buffer só no destino
    mergeDocuments(cen, src);
    const cenas = cen.getRoot().listScenes(), nova = cenas[cenas.length - 1];
    const no = cen.createNode(kit + ':' + n);
    for (const filho of nova.listChildren()) { nova.removeChild(filho); no.addChild(filho); }
    cena.addChild(no); nova.dispose();
  }
}
for (const m of cen.getRoot().listMaterials()) m.setNormalTexture(null); // sem normal maps (celular)
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
