// Mapa do mundo em 3D (estilo modo conquista): regiões com terreno próprio, acampamentos de monstros
// (os papéis do quadro de missões) e os heróis marchando até lá, lutando e voltando.
import * as C from './cena.js';
import * as E from './estado.js';
import { S } from './estado.js';
import { REGIOES, missao } from './dados.js';
import { animAtaque } from './aparencia.js';
import { casa } from './base.js';

export const MUNDO = { x: 1100, z: 0 };
const ESC = 10; // 1 unidade do mapa (0–100) = 10 m: um mundo de 1 km para explorar
export const TAM_MUNDO = 1150, MEIO_MUNDO = 520;
const W = (px, py) => ({ x: MUNDO.x + (px - 50) * ESC, z: MUNDO.z + (py - 50) * ESC });
export const GUILDA_W = W(8, 94);
export const CENTROS = REGIOES.map(r => W(r.x, r.y));
export const ESTILO = [
  { chao: '#2f6a2a', pecas: ['Q:Pine_1', 'Q:Pine_3', 'Q:CommonTree_2', 'Q:Pine_5', 'Q:CommonTree_4', 'Q:Fern_1'], s: 5 },
  { chao: '#4a5a2a', pecas: ['Q:DeadTree_1', 'Q:DeadTree_3', 'N:tree_blocks_dark', 'Q:Fern_1', 'N:lily_large', 'Q:Rock_Medium_2'], s: 5 },
  { chao: '#c9d2da', pecas: ['N:rock_tallA', 'N:rock_largeC', 'N:cliff_block_rock', 'N:rock_tallE', 'N:tree_pineSmallA'], s: 6 },
  { chao: '#e2c27e', pecas: ['N:cactus_tall', 'N:cactus_short', 'N:tree_palmTall', 'N:rock_largeD', 'N:tree_palmShort'], s: 5 },
  { chao: '#8a9a7a', pecas: ['N:statue_column', 'N:statue_columnDamaged', 'N:statue_head', 'N:statue_obelisk', 'N:tree_blocks_fall'], s: 5 },
  { chao: '#3a2a26', pecas: ['N:rock_tallJ', 'N:rock_tallA', 'N:cliff_block_rock', 'N:rock_largeC'], s: 6 },
  { chao: '#4a4a5a', pecas: ['N:tree_blocks_dark', 'N:statue_obelisk', 'N:tree_default_dark', 'N:stone_tallB'], s: 5 },
  { chao: '#3a2a3a', pecas: ['C:tower-square', 'C:wall', 'C:tower-hexagon-base', 'N:rock_tallJ'], s: 4 },
];
// trilha: guilda → região 0 → 1 → ...
export const TRILHA = [GUILDA_W, ...CENTROS];
function distSeg(p, a, b) { const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz))); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); }
// a estrada é uma curva suave: a distância é medida nos pontos da curva (numa grade de 20 m para ser rápido)
let GRADE = null;
function guardarEstrada(pts) { GRADE = new Map(); for (const q of pts) { const k = Math.floor(q.x / 20) + ',' + Math.floor(q.z / 20); if (!GRADE.has(k)) GRADE.set(k, []); GRADE.get(k).push(q); } }
const pertoTrilha = (p, m = 7) => {
  if (!GRADE) { for (let i = 1; i < TRILHA.length; i++) if (distSeg(p, TRILHA[i - 1], TRILHA[i]) < m) return true; return false; }
  const cx = Math.floor(p.x / 20), cz = Math.floor(p.z / 20), r = Math.ceil(m / 20);
  for (let i = -r; i <= r; i++) for (let k = -r; k <= r; k++) for (const q of GRADE.get((cx + i) + ',' + (cz + k)) || []) if (Math.hypot(q.x - p.x, q.z - p.z) < m) return true;
  return false;
};
export const regiaoDe = p => { let r = 0, d0 = 1e9; CENTROS.forEach((c, i) => { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < d0) { d0 = d; r = i; } }); return r; };
const RAIO_REG = 110;
// ---------------- pontos de interesse: locais para descobrir, baús escondidos e covis de chefes ----------------
const LOCAIS = [
  [['Carvalho Ancião', 'Q:TwistedTree_1', 2.6], ['Moinho Abandonado', 'T:windmill', 5], ['Círculo das Fadas', 'N:mushroom_redGroup', 9]],
  [['Árvore dos Enforcados', 'Q:DeadTree_1', 2.6], ['Roda d\'Água Podre', 'T:watermill', 5], ['Totem do Brejo', 'N:statue_column', 7]],
  [['Pico do Eco', 'N:rock_tallE', 12], ['Vigia Congelada', 'C:tower-hexagon-base', 5], ['Cabeça do Gigante', 'N:statue_head', 9]],
  [['Obelisco do Sol', 'N:statue_obelisk', 8], ['Oásis Perdido', 'T:fountain-round', 5], ['Carroça da Caravana', 'T:cart', 5]],
  [['Colunata Élfica', 'N:statue_columnDamaged', 8], ['Rosto de Pedra', 'N:statue_head', 11], ['Torre Partida', 'C:tower-square-base', 5]],
  [['Catapulta Queimada', 'C:siege-catapult-demolished', 5], ['Pilar de Obsidiana', 'N:rock_tallJ', 12], ['Altar de Lava', 'N:statue_obelisk', 7]],
  [['Mausoléu Esquecido', 'C:tower-square', 4], ['Obelisco dos Mortos', 'N:statue_obelisk', 8], ['Árvore Chorona', 'Q:DeadTree_3', 2.6]],
  [['Portão do Rei', 'C:gate', 5], ['Balista Esquecida', 'C:siege-ballista', 5], ['Estandarte Negro', 'C:flag-banner-long', 5]],
];
// vilas: [nome, ponto da estrada (0–1), lado]
const VILAS = [['Vila do Carvalho', 0.1, 1], ['Aldeia do Brejo', 0.3, -1], ['Posto da Montanha', 0.5, 1], ['Oásis de Areia Dourada', 0.66, -1], ['Última Fogueira', 0.86, 1]];
const COVIS = [['Toca do Coelho Maldito', 'coelho', 'Sr. Fofinho, o Coelho do Apocalipse'], ['Trono dos Esporos', 'reiCogu', 'Rei Cogumelo, Senhor dos Esporos'],
  ['Caverna do Yeti', 'yeti', 'Yeti Ancestral'], ['Ninho do Raptor Rei', 'raptor', 'Raptor Rei'], ['Salão do Golem', 'golem', 'Golem Primordial'],
  ['Ninho de Tiamat', 'draco', 'Tiamat, a Dragoa Escarlate'], ['Cripta de Grumak', 'orcCaveira', 'Grumak, o Orc Imortal'], ['Fortaleza do Orc Rei', 'orc', 'Orc Rei']];
export const POIS = [];
const RAIO_POI = { bau: 4, vila: 34, portal: 8 }, raioPoi = o => RAIO_POI[o.tipo] ?? 12;
function gerarPOIs(rnd) {
  const livre = (p, m, estrada = 10) => !pertoTrilha(p, estrada) && Math.hypot(GUILDA_W.x - p.x, GUILDA_W.z - p.z) > 40 && !POIS.some(o => Math.hypot(o.x - p.x, o.z - p.z) < m)
    && Math.abs(p.x - MUNDO.x) < MEIO_MUNDO - 20 && Math.abs(p.z - MUNDO.z) < MEIO_MUNDO - 20;
  const achar = (c, d0, d1, m, estrada) => { for (let k = 0; k < 80; k++) { const a = rnd() * 6.28, d = d0 + rnd() * (d1 - d0), p = { x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d }; if (livre(p, m, estrada)) return p; } return null; };
  CENTROS.forEach((c, r) => {
    const cv = achar(c, 60, 100, 40, 28); if (cv) POIS.push({ id: 'c' + r, tipo: 'covil', r, ...cv, nome: COVIS[r][0], chefe: COVIS[r][1], nomeChefe: COVIS[r][2] });
    LOCAIS[r].forEach(([nome, m, s], i) => { const p = achar(c, 30, 105, 45, 16); if (p) POIS.push({ id: 'l' + r + i, tipo: 'local', r, ...p, nome, m, s }); });
  });
  for (let k = 0; k < 95; k++) { const p = { x: MUNDO.x + (rnd() - 0.5) * (TAM_MUNDO - 80), z: MUNDO.z + (rnd() - 0.5) * (TAM_MUNDO - 80) }; if (livre(p, 25)) POIS.push({ id: 'b' + k, tipo: 'bau', r: regiaoDe(p), ...p }); }
}

let montado = false, visivel = false;
export function montarMundoMapa() {
  if (montado) return; montado = true;
  const TAM = TAM_MUNDO;
  C.chaoPintado(MUNDO.x, MUNDO.z, TAM, (g, P) => {
    g.fillStyle = '#5c8f3a'; g.fillRect(0, 0, 2048, 2048);
    let sd = 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 7000; i++) { g.fillStyle = `hsla(${85 + r() * 25},40%,${30 + r() * 12}%,.3)`; g.beginPath(); g.arc(r() * 2048, r() * 2048, 3 + r() * 12, 0, 7); g.fill(); }
    CENTROS.forEach((c, i) => {
      const gr = g.createRadialGradient(P(c.x), P(c.z, 'z'), 0, P(c.x), P(c.z, 'z'), RAIO_REG * 2048 / TAM);
      gr.addColorStop(0, ESTILO[i].chao); gr.addColorStop(0.7, ESTILO[i].chao); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 2048, 2048);
      if (i === 5) { g.strokeStyle = '#ff6a1a'; g.lineWidth = 6; for (let k = 0; k < 14; k++) { g.beginPath(); g.moveTo(P(c.x), P(c.z, 'z')); g.lineTo(P(c.x + (r() - 0.5) * 160), P(c.z + (r() - 0.5) * 160, 'z')); g.stroke(); } }
    });
    g.lineCap = 'round'; g.lineJoin = 'round';
  }, 7);
  let sd = 11; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const L = [];
  const est = C.estrada(TRILHA, 5); guardarEstrada(est.pontos(2500)); const EP = est.pontos(300); window.__estrada = EP; // para testes
  gerarPOIs(rnd);
  // estrada de pedras com as beiradas bem enfeitadas (é por onde o jogador mais passa), com o tema de cada região
  // portais de teletransporte (um em cada região, na beira da estrada) e vilas com NPCs
  CENTROS.forEach((c, r) => { let m = EP[0], d0 = 1e9; for (const p of EP) { const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < d0) { d0 = d; m = p; } }
    POIS.push({ id: 'p' + r, tipo: 'portal', r, x: m.x + m.nx * 8, z: m.z + m.nz * 8, nome: 'Portal: ' + REGIOES[r].nome }); });
  POIS.push({ id: 'pg', tipo: 'portal', r: 0, x: GUILDA_W.x + 12, z: GUILDA_W.z - 10, nome: 'Portal da Guilda' });
  VILAS.forEach(([nome, f, lado], i) => { const p = EP[Math.floor(f * (EP.length - 1))], x = p.x + p.nx * 28 * lado, z = p.z + p.nz * 28 * lado;
    POIS.push({ id: 'v' + i, tipo: 'vila', r: regiaoDe(p), x, z, nome, px: p.x + p.nx * 9 * lado, pz: p.z + p.nz * 9 * lado }); });
  for (const o of POIS) {
    if (o.tipo === 'portal') L.push({ m: 'N:statue_obelisk', x: o.x, z: o.z, s: 6 }, { m: 'C:stairs-stone', x: o.x, z: o.z + 2.5, s: 2.5 });
    if (o.tipo === 'vila') { // casas em volta de uma praça com poço, barracas e lampiões
      for (let k = 0; k < 5; k++) { const a = Math.atan2(o.x - o.px, o.z - o.pz) + (k - 2) * 0.62, hx = o.x + Math.sin(a) * 17, hz = o.z + Math.cos(a) * 17;
        casa(L, { prof: 2, madeira: k % 2 === 1, S: 5.2, x: hx, z: hz, chamine: k !== 2 }); }
      L.push({ m: 'T:fountain-round', x: o.x, z: o.z, s: 5 }, { m: 'T:stall-red', x: o.x - 8, z: o.z + 6, s: 4.5, ry: 0.4 }, { m: 'T:stall-green', x: o.x + 8, z: o.z + 6, s: 4.5, ry: -0.4 },
        { m: 'T:lantern', x: o.x - 6, z: o.z - 7, s: 4 }, { m: 'T:lantern', x: o.x + 6, z: o.z - 7, s: 4 }, { m: 'T:banner-red', x: o.px, z: o.pz, s: 4 }, { m: 'N:sign', x: o.px + 2, z: o.pz, s: 6 },
        { m: 'D:barrel', x: o.x - 10, z: o.z + 2, s: 3.5 }, { m: 'T:cart', x: o.x + 11, z: o.z - 2, s: 4.2, ry: 1 }); }
  }
  const F = n => 'F:' + n + '_Color1', um = l => l[Math.floor(rnd() * l.length)];
  const ARV_F = ['Tree_1_A', 'Tree_1_B', 'Tree_1_C', 'Tree_2_A', 'Tree_2_B', 'Tree_2_C', 'Tree_2_D', 'Tree_2_E'].map(F), PIN_F = ['Tree_4_A', 'Tree_4_B', 'Tree_4_C'].map(F);
  const SECA = ['Tree_Bare_1_A', 'Tree_Bare_1_B', 'Tree_Bare_1_C', 'Tree_Bare_2_A', 'Tree_Bare_2_B', 'Tree_Bare_2_C'].map(F), ACACIA = ['Tree_3_A', 'Tree_3_B', 'Tree_3_C'].map(F);
  const ARB = ['Bush_1_A', 'Bush_1_C', 'Bush_1_E', 'Bush_2_A', 'Bush_2_C', 'Bush_2_E', 'Bush_3_A', 'Bush_3_C', 'Bush_4_A', 'Bush_4_C', 'Bush_4_E'].map(F);
  const GRAMA = ['Grass_1_A', 'Grass_1_C', 'Grass_2_A', 'Grass_2_C', 'Grass_2_D'].map(F), PEQ = ['Rock_1_A', 'Rock_1_D', 'Rock_1_H', 'Rock_2_A', 'Rock_2_D', 'Rock_2_G'].map(F);
  const GRD = ['Rock_1_K', 'Rock_1_O', 'Rock_3_A', 'Rock_3_E', 'Rock_3_I', 'Rock_3_M', 'Rock_3_Q'].map(F), FLOR = ['N:flower_redA', 'N:flower_yellowA', 'N:flower_purpleA', 'Q:Flower_3_Group', 'Q:Flower_4_Group'];
  // [árvores, arbustos, chão (grama/flores), pedras grandes, densidade de árvores]
  const TEMA = [
    [[...ARV_F, ...PIN_F], ARB, [...GRAMA, ...GRAMA, ...FLOR, 'N:mushroom_red'], GRD, 1],
    [[...SECA, 'Q:DeadTree_1', 'Q:DeadTree_3'], ['F:Bush_4_A_Color1', 'F:Bush_4_C_Color1', 'Q:Fern_1'], [...GRAMA, 'N:lily_large', 'N:mushroom_redGroup'], GRD, 0.8],
    [[...PIN_F, 'N:tree_pineTallA', 'N:tree_pineRoundB', 'N:tree_pineSmallA'], ['F:Bush_3_A_Color1', 'F:Bush_3_C_Color1'], [...GRAMA, ...PEQ], [...GRD, 'N:rock_tallA'], 0.9],
    [[...ACACIA, 'N:cactus_tall', 'N:tree_palmTall', 'N:tree_palmShort'], ['N:cactus_short'], PEQ, ['F:Rock_2_A_Color1', 'F:Rock_2_D_Color1', 'N:rock_largeD'], 0.5],
    [[...ARV_F, ...ACACIA], ARB, [...GRAMA, ...FLOR, 'N:statue_columnDamaged'], GRD, 0.9],
    [SECA, ['F:Bush_4_A_Color1'], PEQ, [...GRD, 'N:rock_tallJ'], 0.6],
    [[...SECA, 'N:tree_blocks_dark'], ['F:Bush_4_C_Color1', 'F:Bush_4_E_Color1'], [...GRAMA, 'N:mushroom_red', 'N:mushroom_redGroup'], GRD, 0.8],
    [[...SECA, ...PIN_F], ['F:Bush_3_A_Color1'], PEQ, [...GRD, 'N:rock_tallJ'], 0.6],
  ];
  const BEIRA = ['Q:Pebble_Round_1', 'Q:Pebble_Round_2', 'Q:Pebble_Round_3', 'F:Grass_1_A_Color1', 'F:Grass_2_A_Color1', 'Q:Grass_Common_Short', 'Q:Grass_Wispy_Tall', 'Q:Flower_3_Group', 'Q:Clover_1'];
  const escala = m => m.startsWith('F:Tree') ? 1.9 + rnd() * 0.7 : m.startsWith('F:Bush') ? 4 + rnd() * 2.5 : m.startsWith('F:Grass') ? 2.4 + rnd() * 1.4
    : m.startsWith('F:Rock_1_K') || m.startsWith('F:Rock_1_O') || m.startsWith('F:Rock_3') ? 2.5 + rnd() * 2 : m.startsWith('F:Rock') ? 2.5 + rnd() * 2
    : m.startsWith('Q:') ? 1.3 + rnd() * 0.5 : m.startsWith('N:statue') ? 4 : m.startsWith('N:tree') || m.startsWith('N:cactus') ? 5 + rnd() * 2 : 4 + rnd() * 2;
  const perto = (x, z) => POIS.some(o => o.tipo !== 'bau' && Math.hypot(o.x - x, o.z - z) < raioPoi(o)) || Math.hypot(GUILDA_W.x - x, GUILDA_W.z - z) < 14;
  let cerca = 0;
  for (const p of est.pontos(1400)) {
    const t = TEMA[regiaoDe(p)], [arv, arb, chao, grd, dens] = t;
    for (const lado of [-1, 1]) {
      const em = d => ({ x: p.x + p.nx * d * lado, z: p.z + p.nz * d * lado });
      // beirada: pedrinhas e grama coladas no calçamento
      if (rnd() < 0.55) { const q = em(3.3 + rnd() * 1.2), m = um(BEIRA); L.push({ m, ...q, ry: rnd() * 6.28, s: m.startsWith('F:') ? 1.6 + rnd() * 0.8 : m.startsWith('Q:Pebble') ? 1.4 + rnd() * 0.8 : 1 + rnd() * 0.4 }); }
      // faixa de arbustos e flores
      if (rnd() < 0.35) { const q = em(7.5 + rnd() * 3), m = um(rnd() < 0.5 ? arb : chao); if (!perto(q.x, q.z)) L.push({ m, ...q, ry: rnd() * 6.28, s: Math.min(escala(m), m.startsWith('F:Bush') ? 3.4 : 3) }); }
      // árvores fazendo corredor ao longo da estrada
      if (rnd() < 0.2 * dens) { const q = em(12 + rnd() * 9), m = um(arv); if (!perto(q.x, q.z)) L.push({ m, ...q, ry: rnd() * 6.28, s: escala(m) }); }
      // pedras grandes de vez em quando
      if (rnd() < 0.04) { const q = em(11 + rnd() * 7), m = um(grd); if (!perto(q.x, q.z)) L.push({ m, ...q, ry: rnd() * 6.28, s: escala(m) }); }
    }
    // trechos de cerca nas regiões verdes
    if (cerca > 0) { cerca--; const lado = cerca % 2 ? 1 : -1; L.push({ m: 'T:fence', x: p.x + p.nx * 4.6 * lado, z: p.z + p.nz * 4.6 * lado, ry: Math.atan2(p.nz, -p.nx), s: 5 }); }
    else if (rnd() < 0.012 && dens >= 0.9) cerca = 10 + Math.floor(rnd() * 12);
    // carroças, tocos e placas de vez em quando
    if (rnd() < 0.006) { const lado = rnd() < 0.5 ? 1 : -1, x = p.x + p.nx * 6 * lado, z = p.z + p.nz * 6 * lado; if (!perto(x, z)) L.push({ m: um(['T:cart', 'N:log_stack', 'N:stump_round', 'N:sign', 'N:campfire_stones']), x, z, ry: rnd() * 6.28, s: 4.5 }); }
  }
  // placa em cada região
  CENTROS.forEach((c, i) => L.push({ m: 'N:sign', x: c.x + 6, z: c.z + 6, ry: rnd() * 6, s: 7 }));
  for (const p of est.pontos(36)) L.push({ m: 'T:lantern', x: p.x + p.nx * 4.2, z: p.z + p.nz * 4.2, s: 3 });
  // cenário de cada região (com uma clareira no meio para os acampamentos)
  CENTROS.forEach((c, i) => {
    const e = ESTILO[i];
    for (let k = 0; k < 190; k++) {
      const a = rnd() * 6.28, d = 16 + Math.sqrt(rnd()) * (RAIO_REG - 10), p = { x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d };
      if (pertoTrilha(p, 10) || POIS.some(o => Math.hypot(o.x - p.x, o.z - p.z) < raioPoi(o))) continue;
      const m = e.pecas[Math.floor(rnd() * e.pecas.length)]; // peças da Quaternius já estão em metros
      L.push({ m, x: p.x, z: p.z, ry: rnd() * 6.28, s: (m.startsWith('Q:') ? 1.4 : e.s) * (0.8 + rnd() * 0.5) });
    }
  });
  // bosques (grupos de árvores), pedras e arbustos no resto do mapa
  const ocupado = p => pertoTrilha(p, 10) || CENTROS.some(c => Math.hypot(c.x - p.x, c.z - p.z) < RAIO_REG * 0.8) || Math.hypot(GUILDA_W.x - p.x, GUILDA_W.z - p.z) < 25
    || POIS.some(o => Math.hypot(o.x - p.x, o.z - p.z) < raioPoi(o));
  const ARV = ['N:tree_oak', 'N:tree_default', 'N:tree_pineRoundB', 'N:tree_fat', 'N:tree_detailed', 'N:tree_pineTallA'];
  for (let b = 0; b < 110; b++) {
    const c = { x: MUNDO.x + (rnd() - 0.5) * TAM * 0.95, z: MUNDO.z + (rnd() - 0.5) * TAM * 0.95 }, tipo = ARV[Math.floor(rnd() * ARV.length)], raio = 12 + rnd() * 22;
    for (let k = 0; k < 14 + rnd() * 16; k++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * raio, p = { x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d }; if (ocupado(p)) continue;
      L.push({ m: rnd() < 0.8 ? tipo : ARV[Math.floor(rnd() * ARV.length)], x: p.x, z: p.z, ry: rnd() * 6.28, s: 5 + rnd() * 2.5 }); }
  }
  for (let k = 0; k < 2200; k++) {
    const p = { x: MUNDO.x + (rnd() - 0.5) * TAM * 0.97, z: MUNDO.z + (rnd() - 0.5) * TAM * 0.97 }; if (ocupado(p)) continue; const q = rnd();
    L.push(q < 0.3 ? { m: ARV[Math.floor(rnd() * ARV.length)], x: p.x, z: p.z, ry: rnd() * 6.28, s: 5 + rnd() * 2 } : q < 0.45 ? { m: ['N:rock_largeA', 'N:rock_largeC', 'N:stone_largeB'][Math.floor(rnd() * 3)], x: p.x, z: p.z, ry: rnd() * 6.28, s: 4 + rnd() * 3 }
      : q < 0.75 ? { m: ['N:plant_bushLarge', 'N:plant_bush', 'N:grass_large'][Math.floor(rnd() * 3)], x: p.x, z: p.z, ry: rnd() * 6.28, s: 4 + rnd() * 2 }
      : { m: ['N:flower_redA', 'N:flower_yellowA', 'N:flower_purpleA', 'N:mushroom_red', 'N:stump_round', 'N:log'][Math.floor(rnd() * 6)], x: p.x, z: p.z, ry: rnd() * 6.28, s: 4 + rnd() * 2 });
  }
  // locais e covis
  for (const o of POIS) {
    if (o.tipo === 'local') L.push({ m: o.m, x: o.x, z: o.z, ry: rnd() * 6.28, s: o.s });
    if (o.tipo === 'covil') { for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28 + 0.4; L.push({ m: k % 2 ? 'N:rock_tallA' : 'N:rock_largeC', x: o.x + Math.cos(a) * 11, z: o.z + Math.sin(a) * 11, ry: rnd() * 6, s: 6 + rnd() * 3 }); }
      L.push({ m: 'D:banner', x: o.x, z: o.z - 9, s: 4 }, { m: 'N:campfire_stones', x: o.x + 4, z: o.z + 4, s: 5 }); }
  }
  // a sua guilda no mapa
  const g = GUILDA_W;
  L.push({ m: 'C:tower-square', x: g.x, z: g.z, s: 5 }, { m: 'C:flag', x: g.x, y: 10, z: g.z, s: 4 }, { m: 'C:wall', x: g.x - 5, z: g.z, s: 5, ry: Math.PI / 2 }, { m: 'C:wall', x: g.x + 5, z: g.z, s: 5, ry: Math.PI / 2 },
    { m: 'T:banner-red', x: g.x + 3, z: g.z - 4, s: 3 }, { m: 'N:tent_detailedOpen', x: g.x - 8, z: g.z - 8, s: 4 });
  window.__pecas = L; // para testes
  if (C.qualidadeAtual() === 'baixa') { let sd2 = 3; const r2 = () => ((sd2 = (sd2 * 16807) % 2147483647) / 2147483647);
    const enfeite = m => /^(F:Grass|F:Bush|F:Rock_2|Q:Pebble|Q:Grass|Q:Flower|Q:Clover|N:flower|N:grass|N:plant|N:mushroom)/.test(m);
    for (let n = L.length - 1; n >= 0; n--) if (enfeite(L[n].m) && r2() < 0.6) L.splice(n, 1); }
  C.montarEstatico(L);
}

// ---------------- acampamentos e marchas ----------------
const campos = {}; // id do papel ou da missão → { vis, x, z }
const marchas = {}; // uid da missão → { herois: [{id, v}] }
const MODELO = [['lacaio', [['lamina', 'r']], 1], ['batedor', [['besta', 'r']], 1], ['guerreiro', [['machado', 'r'], ['escudoP', 'l']], 1.15], ['guerreiro', [['machado', 'r'], ['escudoG', 'l']], 2]];
// acampamento numa clareira em volta do centro da região, fora da estrada
export function posCampo(r, dx, dy) {
  const c = CENTROS[r]; let a = Math.atan2(dy || 0.3, dx || 0.3); const d = 16 + Math.abs(dx || 0) * 1.6;
  for (let k = 0; k < 12; k++, a += 0.52) { const p = { x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d }; if (!pertoTrilha(p)) return p; }
  return { x: c.x + d, z: c.z };
}
export const ESC_MUNDO = 1.7; // unidades maiores no mapa (como nos jogos de conquista)
function criarCampo(chave, r, t, dx, dy) {
  const p = posCampo(r, dx, dy), [mod, armas, esc] = MODELO[t], v = C.personagem(mod, armas, esc); v.raiz.scale.setScalar(ESC_MUNDO);
  v.raiz.position.set(p.x, 0, p.z); v.raiz.rotation.y = Math.atan2(GUILDA_W.x - p.x, GUILDA_W.z - p.z); v.tocar(v.tem('Idle_Combat') ? 'Idle_Combat' : 'Idle');
  const fogo = C.objeto('N:campfire_logs', 6); fogo.position.set(p.x + 4, 0, p.z + 2.5);
  const tenda = C.objeto('N:tent_detailedOpen', 5); tenda.position.set(p.x - 4.5, 0, p.z - 3); tenda.rotation.y = Math.random() * 6;
  return (campos[chave] = { v, fogo, tenda, x: p.x, z: p.z, r, t });
}
function tirarCampo(chave) { const c = campos[chave]; if (!c) return; c.v.remover(); C.remover(c.fogo); C.remover(c.tenda); delete campos[chave]; }
// posição na trilha até o acampamento (f de 0 a 1)
function caminho(r, alvo) { return [...TRILHA.slice(0, r + 2), alvo]; }
function ponto(pts, f) {
  const seg = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); seg.push(d); tot += d; }
  let a = Math.max(0, Math.min(1, f)) * tot;
  for (let i = 0; i < seg.length; i++) { if (a <= seg[i] || i === seg.length - 1) { const k = seg[i] ? Math.min(1, a / seg[i]) : 1; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, z: pts[i].z + (pts[i + 1].z - pts[i].z) * k }; } a -= seg[i]; }
  return pts[pts.length - 1];
}

export function mostrarMundo(v) { visivel = v; }
export const mundoVisivel = () => visivel;
export const camposVisiveis = () => Object.entries(campos);

export function atualizarMundo(dt) {
  if (!montado) return;
  const agora = Date.now(), vivos = new Set();
  // papéis do quadro = acampamentos esperando heróis
  for (const q of S.quadro || []) { if (q.emLuta) continue; vivos.add(q.id); if (!campos[q.id]) criarCampo(q.id, q.r, q.t, q.dx, q.dy).q = q; }
  // missões em andamento
  for (const ms of S.missoes) {
    const ck = 'm' + ms.uid; vivos.add(ck);
    const campo = campos[ck] || criarCampo(ck, ms.r, ms.t, ms.dx, ms.dy);
    let mc = marchas[ms.uid];
    if (!mc) mc = marchas[ms.uid] = { herois: ms.herois.map(id => { const h = E.heroi(id); const v = C.heroi(h.visual); v.raiz.scale.setScalar(ESC_MUNDO); v.raiz.position.set(GUILDA_W.x, 0, GUILDA_W.z); return { id, v, h }; }) };
    const k = Math.min(1, (agora - ms.inicio) / (ms.fim - ms.inicio)), fase = k < 0.35 ? 'ida' : k < 0.75 ? 'luta' : 'volta';
    const pts = caminho(ms.r, { x: campo.x, z: campo.z + 3 });
    mc.herois.forEach((hh, i) => {
      const v = hh.v; let p, ang;
      if (fase === 'luta') {
        const a = (i / mc.herois.length) * Math.PI * 1.2 - 0.6 + Math.atan2(GUILDA_W.x - campo.x, GUILDA_W.z - campo.z);
        p = { x: campo.x + Math.sin(a) * 5, z: campo.z + Math.cos(a) * 5 }; ang = Math.atan2(campo.x - p.x, campo.z - p.z);
        const fim = k > 0.72; v.tocar(fim && !ms.ok ? 'Hit_A' : fim && ms.ok ? 'Cheering' : animAtaque(hh.h.visual), { loop: true });
      } else {
        const f = fase === 'ida' ? k / 0.35 - i * 0.02 : 1 - (k - 0.75) / 0.25 - i * 0.02;
        p = ponto(pts, f); const p2 = ponto(pts, f + (fase === 'ida' ? 0.01 : -0.01)); ang = Math.atan2(p2.x - p.x, p2.z - p.z);
        const lado = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 1.8; p = { x: p.x + Math.cos(ang) * lado, z: p.z - Math.sin(ang) * lado };
        v.tocar(ms.fim - ms.inicio < 60e3 ? 'Running_A' : 'Walking_A');
      }
      v.raiz.position.set(p.x, 0, p.z); v.raiz.rotation.y = ang;
      if (visivel) v.mixer.update(dt);
    });
    // o monstro luta e cai (ou vence) no fim da luta
    const ev = campo.v;
    if (fase === 'luta') { ev.raiz.visible = true; if (k > 0.72 && ms.ok) { if (!campo.morto) { campo.morto = true; ev.tocar('Death_A', { loop: false, reinicia: true }); C.faiscas(campo.x, 1.5, campo.z, 0xffd84a, 30, 5); } } else ev.tocar(MODELO[ms.t][0] === 'batedor' ? '2H_Ranged_Shoot' : '1H_Melee_Attack_Chop'); }
    else if (fase === 'volta' && ms.ok) ev.raiz.visible = false;
  }
  for (const [uid, mc] of Object.entries(marchas)) if (!S.missoes.some(m => m.uid === uid)) { for (const hh of mc.herois) hh.v.remover(); delete marchas[uid]; }
  for (const chave of Object.keys(campos)) if (!vivos.has(chave)) tirarCampo(chave);
  if (visivel) for (const c of Object.values(campos)) c.v.mixer.update(dt);
}
