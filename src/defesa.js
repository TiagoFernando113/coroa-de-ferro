// Defesa em Grupo: até 4 jogadores no mesmo mapa (como os tower defense do Roblox).
// Mapa "Árvore Sagrada" (até 6): a árvore fica no meio, os inimigos vêm de todos os lados e a cada 3 ondas cada um escolhe um poder para o time.
// Cada um anda com o herói no joystick (3ª pessoa), mata os inimigos que vêm pelo caminho, ganha moedas e constrói torres.
// Quem cria a sala é o anfitrião: ele simula inimigos, torres e moedas e manda a foto da partida; os outros mandam herói, dano e pedidos de torre.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as C from './cena.js';
import { S, salvar, fimDeSemana } from './meta.js';
import { tiros, fmt, CHEFES } from './dados.js';
import { HEROIS, heroiAtual } from './herois.js';
import { bonusEquipe } from './pets.js';
import { desenharTropas, voar, passoVoo, limparTropas } from './tropas.js';
import { sfx, intensidade } from './musica.js';
import { ico, som, $, voarMoedas, flashTela } from './util.js';
import { ICONES } from './icones.js';
import { t as tr } from './i18n.js';
import * as ON from './online.js';
import { evento } from './missoes.js';
import * as A from './analise.js';
import * as EQ from './equip.js';

const OX = -6000, cn = () => C.obterCena();
// caminho dos inimigos (zigue-zague) e lugares de torre
const CAM = [[-44, -48], [26, -48], [26, -28], [-26, -28], [-26, -8], [26, -8], [26, 12], [0, 12], [0, 28]];
const PADS = [[0, -38], [-14, -38], [14, -38], [36, -38], [0, -18], [-14, -18], [14, -18], [-36, -18], [0, 2], [14, 2], [-14, 2], [36, 2], [13, 22], [-10, 20]];
const SEGS = []; let LCAM = 0;
for (let i = 1; i < CAM.length; i++) { const [ax, az] = CAM[i - 1], [bx, bz] = CAM[i], len = Math.hypot(bx - ax, bz - az); SEGS.push({ ax, az, bx, bz, len, l0: LCAM }); LCAM += len; }
function noCaminho(s) {
  s = Math.max(0, Math.min(LCAM, s)); let g = SEGS[SEGS.length - 1]; for (const q of SEGS) if (s <= q.l0 + q.len) { g = q; break; }
  const k = (s - g.l0) / g.len; return { x: OX + g.ax + (g.bx - g.ax) * k, z: g.az + (g.bz - g.az) * k, ry: Math.atan2(g.bx - g.ax, g.bz - g.az) };
}
const TORRES = {
  arq: { nome: 'Arqueira', custo: 100, alc: 17, cad: 0.7, dano: 3, cor: 0xffd84a, topo: 'C:siege-ballista', desc: 'rápida, um alvo' },
  can: { nome: 'Canhão', custo: 160, alc: 15, cad: 2, dano: 7, area: 4, cor: 0xff7a2a, topo: 'C:siege-catapult', desc: 'explode em área' },
  mag: { nome: 'Mago', custo: 220, alc: 18, cad: 1.1, dano: 3.5, lento: 1.6, cor: 0xb07aff, desc: 'deixa lento' },
};
const NV_DANO = [1, 1.8, 3.2, 4.6], custoUp = (t, nv) => Math.round(TORRES[t].custo * (nv === 1 ? 0.9 : nv === 2 ? 1.6 : 2.6));
// nível 4: cada torre escolhe um caminho
const RAMOS = {
  arq: { a: { nome: 'Besta Pesada', desc: 'dano x2,4, mais lenta', dano: 2.4, cad: 1.6 }, b: { nome: 'Saraivada', desc: '3 flechas em 3 alvos', multi: 3 } },
  can: { a: { nome: 'Morteiro', desc: 'explosão gigante', area: 2, dano: 1.4 }, b: { nome: 'Metralha', desc: 'atira 3x mais rápido', cad: 0.33, dano: 0.6 } },
  mag: { a: { nome: 'Gelo Eterno', desc: 'deixa bem mais lento', lento: 2.2, dano: 1.3 }, b: { nome: 'Tempestade', desc: 'o raio pula em 3', perf: 3, dano: 1.2 } },
};
// inimigos (os mesmos do Castelo): vida, velocidade, moedas e dano na base
const TIPOS = {
  orc: { hp: 1, vel: 4.2, moedas: 5, base: 3, atk: 2 },
  elite: { hp: 7, vel: 3, moedas: 20, base: 8, atk: 5, m: 'mb:Orc', h: 3.4 },
  voador: { hp: 3, vel: 5.5, moedas: 10, base: 5, atk: 3, m: 'mv:Armabee', h: 3, voa: true },
  escudeiro: { hp: 6, vel: 2.8, moedas: 15, base: 6, atk: 4, m: 'mb:Cactoro', h: 3.4 },
  xama: { hp: 5, vel: 2.6, moedas: 15, base: 5, atk: 0, longe: 18, m: 'mv:Hywirl', h: 3.4, voa: true },
  sabotador: { hp: 2, vel: 6.5, moedas: 8, base: 15, atk: 22, m: 'mb:GreenSpikyBlob', h: 2.6 },
  gigante: { hp: 40, vel: 1.7, moedas: 80, base: 25, atk: 10, m: 'mg:Yeti', h: 7 },
  chefe: { hp: 60, vel: 1.4, moedas: 200, base: 60, atk: 20, h: 10 },
  arqueiro: { hp: 2, vel: 3.6, moedas: 8, base: 2, atk: 3, longe: 16 },
};
const LTIPOS = Object.keys(TIPOS);
const hpBase = n => 4 * 1.15 ** (n - 1);
function montarOnda(n, modo) {
  const f = [], orcs = Math.min(40, 6 + 2 * n);
  if (modo === 'arvore' && n >= 2) for (let i = 0; i < Math.min(10, Math.floor(n / 2) + 1); i++) f.push({ tipo: 'arqueiro', t: 1 + i * 1.3 });
  for (let i = 0; i < orcs; i++) f.push({ tipo: 'orc', t: i * (10 / orcs) });
  if (n >= 3) for (let i = 0; i < Math.min(5, Math.floor((n + 1) / 4)); i++) f.push({ tipo: 'elite', t: 2 + i * 2 });
  if (n >= 4) for (let i = 0; i < Math.min(5, Math.floor((n - 2) / 3)); i++) f.push({ tipo: 'voador', t: 1 + i * 1.6 });
  if (n >= 6) for (let i = 0; i < Math.min(4, Math.floor((n - 2) / 4)); i++) f.push({ tipo: 'sabotador', t: 3 + i * 1.8 });
  if (n >= 7) for (let i = 0; i < Math.min(4, Math.floor((n - 3) / 4)); i++) f.push({ tipo: 'escudeiro', t: 0.5 + i * 2.2 });
  if (n >= 9) for (let i = 0; i < Math.min(3, Math.floor((n - 5) / 4)); i++) f.push({ tipo: 'xama', t: 2.5 + i * 2.5 });
  if (modo === 'arvore') { if (n % 5 === 0) f.push({ tipo: 'chefe', t: 3 }); else if (n % 5 === 3 && n > 5) f.push({ tipo: 'gigante', t: 4 }); } // Árvore: chefe a cada 5 ondas
  else { if (n % 5 === 0) f.push({ tipo: 'chefe', t: 3 }); else if (n % 5 === 3 && n > 5) f.push({ tipo: 'gigante', t: 4 }); } // chefe a cada 5 ondas nos dois modos
  return f.sort((a, b) => a.t - b.t);
}
// ---- Árvore Sagrada ----
const ARV = { x: OX, z: -10 }, R_ARV = 5, PORTAS = Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3 + Math.PI / 6; return { x: ARV.x + Math.sin(a) * 50, z: ARV.z + Math.cos(a) * 50 }; });
const BUFFS = {
  escudo: { nome: 'Escudo da Árvore', ic: 'escudo', desc: '-30% do dano dos tiros na árvore' },
  cura: { nome: 'Campo de Cura', ic: 'coracao', desc: 'cura os heróis e a árvore perto dela' },
  guardioes: { nome: 'Guardiões', ic: 'herois', desc: '+3 soldados nascem da árvore para defender' },
  seiva: { nome: 'Seiva Vital', ic: 'pocao', desc: '+25% de vida da árvore e cura 40% agora' },
  raizes: { nome: 'Raízes', ic: 'pantano', desc: 'inimigos perto da árvore ficam lentos e tomam dano' },
  espinhos: { nome: 'Espinhos', ic: 'h_perfura', desc: 'quem bate na árvore toma dano' },
  furia: { nome: 'Fúria', ic: 'h_furia', desc: '+25% de dano dos heróis' },
  pressa: { nome: 'Pressa', ic: 'agi', desc: 'heróis andam e atiram 15% mais rápido' },
  almas: { nome: 'Alma Guerreira', ic: 'sombras', desc: '+2 espíritos no máximo e eles duram mais' },
};
const bnv = k => K.buffs[k] || 0;
function posMob(u) {
  if (K.modo !== 'arvore') return noCaminho(u.s);
  const P = PORTAS[u.porta], dx = ARV.x - P.x, dz = ARV.z - P.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d, s = Math.min(u.s, u.L);
  return { x: P.x + ux * s - uz * u.off, z: P.z + uz * s + ux * u.off, ry: Math.atan2(ux, uz) };
}
function prepararMob(u) { if (K.modo !== 'arvore') return; const T = TIPOS[u.tipo]; u.porta ??= Math.floor(Math.random() * Math.min(6, 1 + Math.ceil(K.onda / 2))); u.off = (Math.random() - 0.5) * 6;
  u.L = Math.hypot(ARV.x - PORTAS[u.porta].x, ARV.z - PORTAS[u.porta].z) - (T.longe || R_ARV + 1 + (T.h || 2) * 0.3); u.cdA = Math.random(); }
const GEO_CORTE = new THREE.TorusGeometry(0.9, 0.12, 4, 12, Math.PI).rotateX(Math.PI / 2), GEO_TIRO = new THREE.SphereGeometry(0.35, 8, 6), GEO_ORBE = new THREE.IcosahedronGeometry(0.35, 1), GEO_FLECHA = new THREE.BoxGeometry(0.14, 0.14, 1.5), GEO_BALA = new THREE.SphereGeometry(0.6, 10, 8), GEO_RAIO = new THREE.BoxGeometry(1, 1, 1), GEO_ANEL = new THREE.RingGeometry(0.96, 1, 64).rotateX(-Math.PI / 2), matT = {}, matTiro = c => matT[c] ||= new THREE.MeshBasicMaterial({ color: c });
let K = null, el = null, aoSair = null;

// ---- cenário: chão com manchas, caminho de pedra, cercas, lanternas, flores, acampamento orc e castelo ----
function longeDoCaminho(x, z, m) { return SEGS.every(q => { const minx = Math.min(q.ax, q.bx) - m, maxx = Math.max(q.ax, q.bx) + m, minz = Math.min(q.az, q.bz) - m, maxz = Math.max(q.az, q.bz) + m; return !(x > minx && x < maxx && z > minz && z < maxz); }); }
const longeDosPads = (x, z, m) => PADS.every(([px, pz]) => Math.hypot(x - px, z - pz) > m);
function montarCenario() {
  let sd = 11; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647), cor = new THREE.Color();
  // chão: grama em tons diferentes (manchas) e terra embaixo
  const pl = new THREE.PlaneGeometry(130, 130, 52, 52).rotateX(-Math.PI / 2).translate(OX, 0, -10), pos = pl.attributes.position, cs = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) - OX, z = pos.getZ(i), n = Math.sin(x * 0.13) * Math.cos(z * 0.11) + Math.sin(x * 0.31 + z * 0.27) * 0.5;
    cor.setHSL(0.27 + n * 0.02, 0.55, 0.42 + n * 0.05 + r() * 0.03); cs.set([cor.r, cor.g, cor.b], i * 3); }
  pl.setAttribute('color', new THREE.BufferAttribute(cs, 3)); pl.deleteAttribute('uv');
  const g = [pl], add = (geo, c) => { const n = geo.attributes.position.count, a = new Float32Array(n * 3); cor.set(c); for (let i = 0; i < n; i++) a.set([cor.r, cor.g, cor.b], i * 3); geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); geo.deleteAttribute('uv'); g.push(geo); };
  add(new THREE.BoxGeometry(130, 6, 130).translate(OX, -3.05, -10), 0x8a6a48);
  for (const [x, z] of PADS) { add(new THREE.CylinderGeometry(2.7, 3, 0.35, 20).translate(OX + x, 0.15, z), 0x9a8a76); add(new THREE.CylinderGeometry(2.2, 2.2, 0.38, 20).translate(OX + x, 0.17, z), 0xb8a888); }
  add(new THREE.CylinderGeometry(5, 5, 0.1, 24).translate(OX - 36, 0.03, 16), 0x3aa8e0); // laguinho
  const chao = new THREE.Mesh(mergeGeometries(g), new THREE.MeshLambertMaterial({ vertexColors: true })); chao.receiveShadow = true;
  const grupo = new THREE.Group(); grupo.add(chao); cn().add(grupo);
  // caminho de pedras (o mesmo zigue-zague dos inimigos, com as curvas)
  const pts = []; for (let k = 0; k < CAM.length; k++) { const [x, z] = CAM[k]; if (k && k < CAM.length - 1) { const [ax, az] = CAM[k - 1], [bx, bz] = CAM[k + 1], la = Math.hypot(x - ax, z - az), lb = Math.hypot(bx - x, bz - z);
      const r = Math.min(5, la * 0.45, lb * 0.45), p0 = [x - (x - ax) / la * r, z - (z - az) / la * r], p2 = [x + (bx - x) / lb * r, z + (bz - z) / lb * r]; // curva arredondada (sem a faixa dobrar)
      for (let i = 0; i <= 8; i++) { const t = i / 8, u = 1 - t; pts.push({ x: OX + u * u * p0[0] + 2 * u * t * x + t * t * p2[0], z: u * u * p0[1] + 2 * u * t * z + t * t * p2[1] }); } } else pts.push({ x: OX + x, z }); }
  const estrada = C.estrada(pts, 6.4); grupo.add(estrada.grupo);
  const pecas = [], arv = ['F:Tree_1_A_Color1', 'F:Tree_2_A_Color1', 'F:Tree_3_A_Color1', 'F:Tree_4_A_Color1', 'F:Tree_2_C_Color1', 'N:tree_pineTallA', 'N:tree_oak'];
  const enfeites = ['Q:Grass_Common_Tall', 'Q:Grass_Wispy_Tall', 'Q:Flower_3_Group', 'Q:Flower_4_Group', 'Q:Clover_1', 'Q:Fern_1', 'N:mushroom_redGroup', 'F:Bush_1_A_Color1', 'F:Bush_2_C_Color1', 'Q:Rock_Medium_1', 'Q:Rock_Medium_2', 'Q:Pebble_Round_2', 'N:stump_round', 'N:log'];
  for (let i = 0; i < 170; i++) { const a = r() * 6.283, d = 54 + r() * 12; pecas.push({ m: arv[Math.floor(r() * arv.length)], x: OX + Math.cos(a) * d, z: -10 + Math.sin(a) * d, s: 2.4 + r() * 1.6, ry: r() * 6 }); }
  for (let i = 0; i < 260; i++) { const x = -50 + r() * 100, z = -60 + r() * 92; if (!longeDoCaminho(x, z, 4.2) || !longeDosPads(x, z, 4) || Math.hypot(x, z - 33) < 12 || Math.hypot(x + 36, z - 16) < 6) continue;
    const m = enfeites[Math.floor(r() * enfeites.length)]; pecas.push({ m, x: OX + x, z, s: m.includes('Rock') || m.includes('Pebble') ? 0.5 + r() * 0.5 : m.startsWith('Q:') ? 0.8 + r() * 0.6 : m.startsWith('F:') ? 1.2 + r() * 0.8 : 1.6 + r(), ry: r() * 6 }); }
  for (let i = 0; i < 8; i++) { const x = -50 + r() * 100, z = -60 + r() * 90; if (longeDoCaminho(x, z, 6) && longeDosPads(x, z, 6) && Math.hypot(x, z - 33) > 14) pecas.push({ m: arv[Math.floor(r() * arv.length)], x: OX + x, z, s: 2.2 + r(), ry: r() * 6 }); }
  // cerca nas bordas de fora do caminho e lanternas nas curvas
  for (const q of SEGS) { const n = Math.floor(q.len / 3.2), dx = (q.bx - q.ax) / q.len, dz = (q.bz - q.az) / q.len, ry = Math.atan2(dx, dz) + Math.PI / 2;
    for (const lado of [-1, 1]) for (let k = 1; k < n; k++) { if (r() < 0.45) continue; const x = q.ax + dx * k * 3.2 - dz * lado * 4.3, z = q.az + dz * k * 3.2 + dx * lado * 4.3; if (longeDoCaminho(x, z, 3.6) && longeDosPads(x, z, 3.6)) pecas.push({ m: 'N:fence_simple', x: OX + x, z, s: 2.2, ry }); } }
  for (let k = 1; k < CAM.length - 1; k++) { const [x, z] = CAM[k]; pecas.push({ m: 'T:lantern', x: OX + x + (x > 0 ? 4.5 : -4.5), z: z + 4.5, s: 2.2 }); }
  // acampamento dos orcs (de onde eles saem)
  pecas.push({ m: 'C:gate', x: OX - 47, z: -48, s: 4.2, ry: Math.PI / 2 }, { m: 'N:tent_detailedOpen', x: OX - 50, z: -40, s: 3.4, ry: 1 }, { m: 'N:tent_detailedOpen', x: OX - 52, z: -56, s: 3.4, ry: 2.4 },
    { m: 'N:campfire_logs', x: OX - 42, z: -40, s: 2.6 }, { m: 'C:flag-banner-long', x: OX - 46, z: -43, s: 3 }, { m: 'C:flag-banner-long', x: OX - 46, z: -53, s: 3 }, { m: 'N:log_stack', x: OX - 40, z: -56, s: 2.4 });
  // castelo que defendemos
  pecas.push({ m: 'C:tower-square-base', x: OX - 7, z: 35, s: 3.2 }, { m: 'C:tower-square-mid-windows', x: OX - 7, y: 3.2, z: 35, s: 3.2 }, { m: 'C:tower-square-top-roof-high', x: OX - 7, y: 6.4, z: 35, s: 3.2 },
    { m: 'C:tower-square-base', x: OX + 7, z: 35, s: 3.2 }, { m: 'C:tower-square-mid-windows', x: OX + 7, y: 3.2, z: 35, s: 3.2 }, { m: 'C:tower-square-top-roof-high', x: OX + 7, y: 6.4, z: 35, s: 3.2 },
    { m: 'C:gate', x: OX, z: 35, s: 3.4 }, { m: 'C:wall', x: OX - 13, z: 35, s: 3.2 }, { m: 'C:wall', x: OX + 13, z: 35, s: 3.2 }, { m: 'C:flag', x: OX - 7, y: 12.5, z: 35, s: 2.6 }, { m: 'C:flag', x: OX + 7, y: 12.5, z: 35, s: 2.6 },
    { m: 'N:lily_large', x: OX - 35, z: 15, s: 2 }, { m: 'N:lily_large', x: OX - 38, z: 17, s: 1.6 }, { m: 'T:banner-red', x: OX - 3.5, z: 31, s: 2.4 }, { m: 'T:banner-red', x: OX + 3.5, z: 31, s: 2.4 });
  return [grupo, C.montarEstatico(pecas)];
}

function montarArvore() { // arena redonda: a árvore no meio, 6 portais em volta, flores e pedras
  let sd = 23; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647), cor = new THREE.Color();
  const pl = new THREE.CircleGeometry(66, 72, 0, Math.PI * 2).rotateX(-Math.PI / 2).translate(ARV.x, 0, ARV.z), pos = pl.attributes.position, cs = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) - ARV.x, z = pos.getZ(i) - ARV.z, d = Math.hypot(x, z), n = Math.sin(x * 0.15) * Math.cos(z * 0.12) + Math.sin(x * 0.3 + z * 0.25) * 0.5;
    cor.setHSL(0.27 + n * 0.02 - (d < 12 ? 0.02 : 0), 0.55, 0.42 + n * 0.05 + (d < 12 ? 0.05 : 0)); cs.set([cor.r, cor.g, cor.b], i * 3); }
  pl.setAttribute('color', new THREE.BufferAttribute(cs, 3)); pl.deleteAttribute('uv');
  const g = [pl], add = (geo, c) => { const n = geo.attributes.position.count, a = new Float32Array(n * 3); cor.set(c); for (let i = 0; i < n; i++) a.set([cor.r, cor.g, cor.b], i * 3); geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); geo.deleteAttribute('uv'); g.push(geo); };
  add(new THREE.CylinderGeometry(66, 66, 6, 72).translate(ARV.x, -3.05, ARV.z), 0x8a6a48);
  add(new THREE.CylinderGeometry(R_ARV + 1.6, R_ARV + 2, 0.5, 32).translate(ARV.x, 0.2, ARV.z), 0x9a8a76); add(new THREE.CylinderGeometry(R_ARV + 0.6, R_ARV + 0.6, 0.55, 32).translate(ARV.x, 0.25, ARV.z), 0x6a8a3a);
  for (const P of PORTAS) { const dx = ARV.x - P.x, dz = ARV.z - P.z, d = Math.hypot(dx, dz); for (let k = 4; k < d - 8; k += 3.2) add(new THREE.CylinderGeometry(1.4 + r() * 0.5, 1.6, 0.12, 7).translate(P.x + dx / d * k + (r() - 0.5) * 2, 0.04, P.z + dz / d * k + (r() - 0.5) * 2), 0xc8b088); }
  const chao = new THREE.Mesh(mergeGeometries(g), new THREE.MeshLambertMaterial({ vertexColors: true })); chao.receiveShadow = true;
  const grupo = new THREE.Group(); grupo.add(chao); cn().add(grupo);
  const pecas = [], arv = ['F:Tree_1_A_Color1', 'F:Tree_2_A_Color1', 'F:Tree_3_A_Color1', 'F:Tree_4_A_Color1', 'N:tree_pineTallA', 'N:tree_oak'];
  const enfeites = ['Q:Grass_Common_Tall', 'Q:Grass_Wispy_Tall', 'Q:Flower_3_Group', 'Q:Flower_4_Group', 'Q:Clover_1', 'Q:Fern_1', 'N:mushroom_redGroup', 'F:Bush_1_A_Color1', 'Q:Rock_Medium_1', 'Q:Pebble_Round_2', 'N:stump_round'];
  const naTrilha = (x, z) => PORTAS.some(P => { const dx = ARV.x - P.x, dz = ARV.z - P.z, d = Math.hypot(dx, dz), t = Math.max(0, Math.min(d, ((x - P.x) * dx + (z - P.z) * dz) / d)); return Math.hypot(x - (P.x + dx / d * t), z - (P.z + dz / d * t)) < 5; });
  for (let i = 0; i < 180; i++) { const a = r() * 6.283, d = 58 + r() * 10; pecas.push({ m: arv[Math.floor(r() * arv.length)], x: ARV.x + Math.sin(a) * d, z: ARV.z + Math.cos(a) * d, s: 2.4 + r() * 1.6, ry: r() * 6 }); }
  const baixos = ['Q:Clover_1', 'Q:Pebble_Round_2', 'Q:Flower_3_Group', 'Q:Rock_Medium_1', 'N:mushroom_redGroup']; // no meio da arena só coisas baixas (a câmera fica perto do herói)
  for (let i = 0; i < 280; i++) { const a = r() * 6.283, d = 9 + r() * 52, x = ARV.x + Math.sin(a) * d, z = ARV.z + Math.cos(a) * d; if (naTrilha(x, z)) continue;
    const m = d < 46 ? baixos[Math.floor(r() * baixos.length)] : enfeites[Math.floor(r() * enfeites.length)]; pecas.push({ m, x, z, s: m.includes('Rock') || m.includes('Pebble') ? 0.5 + r() * 0.5 : m.startsWith('Q:') ? 0.8 + r() * 0.6 : m.startsWith('F:') ? 1.2 + r() * 0.8 : 1.6 + r(), ry: r() * 6 }); }
  for (let i = 0; i < 10; i++) { const a = r() * 6.283, d = 50 + r() * 6, x = ARV.x + Math.sin(a) * d, z = ARV.z + Math.cos(a) * d; if (!naTrilha(x, z)) pecas.push({ m: arv[Math.floor(r() * arv.length)], x, z, s: 2 + r(), ry: r() * 6 }); }
  for (const P of PORTAS) { const ry = Math.atan2(ARV.x - P.x, ARV.z - P.z);
    pecas.push({ m: 'C:gate', x: P.x, z: P.z, s: 4, ry }, { m: 'N:campfire_logs', x: P.x + Math.cos(ry) * 6, z: P.z - Math.sin(ry) * 6, s: 2.2 }, { m: 'C:flag-banner-long', x: P.x - Math.cos(ry) * 5, z: P.z + Math.sin(ry) * 5, s: 2.8 }); }
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; pecas.push({ m: 'N:stone_tallB', x: ARV.x + Math.sin(a) * (R_ARV + 2.6), z: ARV.z + Math.cos(a) * (R_ARV + 2.6), s: 1.4, ry: a }); }
  pecas.push({ m: 'F:Tree_3_A_Color1', x: ARV.x, y: 0.4, z: ARV.z, s: 5.5 }, { m: 'N:mushroom_redGroup', x: ARV.x + 3, y: 0.4, z: ARV.z + 2, s: 2 }, { m: 'Q:Flower_3_Group', x: ARV.x - 3, y: 0.4, z: ARV.z - 2, s: 1.4 });
  return [grupo, C.montarEstatico(pecas)];
}

// ---- abrir / fechar ----
export function abrir(container, sair, modo = 'caminho') {
  el = container; aoSair = sair; el.hidden = false;
  const H = heroiAtual(S), up = S.up, B = bonusEquipe(), eu = ON.conta()?.codigo || 'eu' + Math.floor(Math.random() * 1e6);
  K = { eu, nome: ON.conta()?.apelido || 'Você', host: true, sala: null, canal: null, jogs: new Map(), mobs: [], torres: new Map(), tiros: [], raios: [], txt: [], banner: null,
    onda: 0, estado: 'conectando', pausaT: 10, fila: [], t: 0, base: 0, baseMax: 0, cofre: 0, poder: 0, abates: {}, id: 1, yaw: Math.PI, joy: null, cam: null, tS: 0, tH: 0, tD: 0, tPing: 0, ultS: 0, danos: [], pronto: false, modo, buffs: {}, guardas: [], meus: new Map(), esp: [], itensChefe: [] };
  const base = Math.round((modo === 'arvore' ? 300 : 100) * (1 + 0.15 * up.vida)); K.base = K.baseMax = base;
  K.heroi = { x: OX, z: 22, dir: Math.PI, cd: 0.6, cad: 1 / (tiros(up.fogo) * H.ataque.cad * 0.6 * (1 + (B.tiro || 0) / 100)), dano: 3 * H.ataque.dano * (1 + up.flechas * 0.35),
    area: H.ataque.area, perf: H.ataque.perf, cor: H.ataque.cor, alc: 15, anda: false, tiroT: 9, habT: 5, forma: /flecha|virote|adaga/.test(H.ataque.proj) ? 'flecha' : 'orbe' };
  K.heroi.hp = K.heroi.hpMax = Math.round(100 * (1 + 0.2 * up.vida) * (1 + (B.vida || 0) / 100));
  // equipamentos (arma, armadura, anel, amuleto)
  const G = EQ.atributos(); K.eqA = G; K.poderEq = EQ.poder(); K.rarEq = EQ.melhorRaridade();
  K.heroi.dano *= 1 + G.dano / 100; K.heroi.cad /= 1 + G.cad / 100; K.heroi.hp = K.heroi.hpMax = Math.round(K.heroi.hpMax + G.vida); if (modo === 'arvore') { K.heroi.x = ARV.x; K.heroi.z = ARV.z + 9; }
  const ARM = EQ.armaEquipada(); K.arma = ARM ? { modelo: ARM.modelo, lenda: ARM.lenda, tipo: EQ.tipoGolpe(ARM.modelo), cor: ARM.lenda ? EQ.LENDAS[ARM.lenda].cor : ARM.r >= 4 ? [0, 0, 0, 0, 0xffc23a, 0xff4a5a][ARM.r] : null, r: ARM.r } : null; K.perto = EQ.armaDePerto(); // arma de perto: só acerta quem está do lado (e bate mais forte)
  K.visH = EQ.visualHeroi(H.visual, true); K.v = C.heroi(K.visH); K.v.raiz.scale.setScalar(0.8); K.H = H;
  if (K.arma) { const an = { corte: 'Melee_1H_Attack_Chop', martelo: 'Melee_2H_Attack_Chop', cajado: 'Ranged_Magic_Shoot', arco: 'Ranged_Bow_Release' }[K.arma.tipo]; K.animTiro = K.v.tem(an) ? an : K.v.tem('Melee_1H_Attack_Chop') && K.arma.tipo !== 'arco' ? 'Melee_1H_Attack_Chop' : null; }
  K.cena = modo === 'arvore' ? montarArvore() : montarCenario(); C.ceu(0x9ad8f8); C.neblina(90, 220); C.diaNoite(0); intensidade(1); A.comecou(modo === 'arvore' ? 'arvore' : 'defesa');
  desenhar(); ligarToque(); ligarCamPad(); conectar(); if (modo === 'arvore' && !S.tutArv) { K.tut = 0; mostrarTut(); }
}
export function fechar() {
  if (!K) return; try { K.canal?.enviar('tchau', { p: K.eu }); } catch (e) {} setTimeout(((c) => () => c?.fechar())(K.canal), 300);
  K.v.remover(); for (const j of K.jogs.values()) { j.v?.remover(); if (j.aro) cn().remove(j.aro); } if (K.aroEu) cn().remove(K.aroEu); for (const u of K.mobs) u.v?.remover(); for (const b of K.bots || []) b.v.remover(); limparCirculos(); for (const e of K.esp) cn().remove(e.o); if (K.manto) { cn().remove(K.manto); K.manto.geometry.dispose(); K.manto.material.dispose(); } for (const s of K.tiros) cn().remove(s.o); for (const r of K.raios) cn().remove(r.o); if (K.anel) { cn().remove(K.anel); K.anel.material.dispose(); } for (const m of Object.values(K.vis || {})) C.descartar(m); for (const t of K.torres.values()) cn().remove(t.o);
  C.descartar(K.cena[0]); C.removerGrupo(K.cena[1]); desligarToque(); limparTropas(); K = null; if (el) { el.hidden = true; el.innerHTML = ''; }
}
export const ativo = () => !!K;

// ---- rede ----
async function conectar() {
  let r = null; try { r = await ON.defEntrar2(K.modo); } catch (e) {}
  if (!K) return;
  if (!r) { comecarSolo(); return; }
  K.sala = r.sala; K.host = r.host; K.canal = ON.salaGrupo('def' + r.sala, receber);
  if (K.host) { comecarSolo(); return; }
  K.estado = 'entrando'; avisar(tr('Entrando na partida...'));
  const oi = () => { if (!K || K.pronto) return; K.canal.enviar('oi', { p: K.eu, n: K.nome, h: S.heroi || 'lyra' }); setTimeout(oi, 900); }; oi();
  setTimeout(() => { if (K && !K.pronto) { K.canal.fechar(); K.canal = null; K.host = true; comecarSolo(); ON.defEntrar2(K.modo).then(r2 => { if (!K || !r2?.host) return; K.sala = r2.sala; K.canal = ON.salaGrupo('def' + r2.sala, receber); }).catch(() => {}); } }, 7000);
}
function comecarSolo() { K.host = true; K.pronto = true; K.estado = 'pausa'; K.pausaT = 10; K.cofre = 200; avisar(''); atualizarHud(); }
function receber(ev, p) {
  if (!K) return;
  if (ev === 'h') { if (p.p === K.eu) return; let j = K.jogs.get(p.p); if (!j) { j = { p: p.p, nome: p.n || '?', h: p.h || 'lyra', x: p.x, z: p.z, r: p.r }; K.jogs.set(p.p, j); }
    Object.assign(j, { tx: p.x, tz: p.z, r: p.r, visto: performance.now(), caido: !!p.m }); if (p.n) j.nome = p.n; if (p.a >= 0) j.atira = p.a; if (p.g != null) { j.g = p.g; j.rr = p.rr; } if (p.vs && JSON.stringify(p.vs) !== JSON.stringify(j.vs)) { j.vs = p.vs; if (j.v) { j.v.remover(); j.v = null; } } return; }
  if (K.host) {
    if (ev === 'oi') { if (!K.jogs.has(p.p) && K.jogs.size >= (K.modo === 'arvore' ? 5 : 3)) return; let j = K.jogs.get(p.p); if (!j) { j = { p: p.p, nome: p.n, h: p.h, x: OX, z: 22, tx: OX, tz: 22, visto: performance.now() }; K.jogs.set(p.p, j); toast(`${p.n} ${tr('entrou!')}`); sfx('brilho'); }
      if (!j.somou) { j.somou = true; K.cofre += 100; } K.canal.enviar('pl', { l: lista() }); K.canal.enviar('tw', { l: listaTorres() }); return; }
    if (ev === 'd') { for (const [id, d] of p.l || []) { const u = K.mobs.find(m => m.id === id); if (u) ferir(u, Math.min(d, 9999), p.p); } return; }
    if (ev === 'b') { construir(p.pad, p.t, p.p); return; }
    if (ev === 'u') { melhorar(p.pad, p.p, p.r); return; }
    if (ev === 'v') { vender(p.pad); return; }
    if (ev === 'hab') { C.onda(p.x, p.z, 12, p.c, 0.5); C.faiscas(p.x, 2, p.z, p.c, 30, 8); return; }
    if (ev === 'poder') { usarPoder(); return; }
    if (ev === 'bf') { if (K.estado === 'buff') aplicarBuff(p.k, p.p, p.n); return; }
    if (ev === 'pular') { if (K.estado === 'pausa') K.pausaT = Math.min(K.pausaT, 1); return; }
    if (ev === 'tchau') { const j = K.jogs.get(p.p); if (j) { j.v?.remover(); K.jogs.delete(p.p); toast(`${j.nome} ${tr('saiu')}`); } return; }
    return;
  }
  // cliente
  if (ev === 'pl') { K.pronto = true; if (K.estado === 'entrando') { K.estado = 'pausa'; avisar(''); sfx('vitoria'); toast(tr('Você entrou na partida!')); }
    for (const [pid, nome, h] of p.l) if (pid !== K.eu && !K.jogs.has(pid)) K.jogs.set(pid, { p: pid, nome, h, x: OX, z: 22, tx: OX, tz: 22, visto: performance.now() }); return; }
  if (ev === 'tw') { aplicarTorres(p.l); return; }
  if (ev === 's') { K.ultS = performance.now(); K.pronto = true; if (K.estado === 'entrando') K.estado = 'pausa';
    if (p.o !== K.onda && p.o > 0) { K.onda = p.o; bannerOnda(); } K.estado = p.e; K.pausaT = p.pt; K.base = p.b; K.baseMax = p.bm;
    const vivos = new Set();
    if (p.bf) { const antes = JSON.stringify(K.buffs); K.buffs = p.bf; if (antes !== JSON.stringify(p.bf)) aplicarBuffsVisuais(); } K.buffT = p.bt;
    for (const [id, ti, s, hp, mx, porta, off, mc] of p.m) { vivos.add(id); let u = K.mobs.find(m => m.id === id); if (!u) { u = criarMob(LTIPOS[ti], 1, id, porta); u.off = (off || 0) / 10; u.s = s; K.mobs.push(u); }
      if (Math.abs(u.s - s) > 3) u.s = s; else u.s += (s - u.s) * 0.5; u.hp = hp; u.max = mx; u.marcaT = mc ? 1 : 0; }
    for (const u of K.mobs) if (!vivos.has(u.id) && !u.morto) { if (K.modo === 'arvore' ? u.tipo !== 'sabotador' : u.s < LCAM - 3) K.txt.push({ x: u.x, y: u.y + 2.5, z: u.z, txt: `+${TIPOS[u.tipo].moedas}`, cor: '#ffd84a', t: 0 }); matarMob(u, K.modo !== 'arvore' && u.s >= LCAM - 3); }
    K.cofre = p.c; if (p.pw != null) K.poder = p.pw;
    if (K.estado === 'buff' && p.bo) { if (!K.circ || K.cartas?.join() !== p.bo.join()) { K.cartas = p.bo; montarCirculos(); } (p.bc || []).forEach((n, i) => { if (K.circ?.[i]) K.circ[i].n = n; }); } else if (K.circ) fecharBuffs();
    atualizarHud(); return; }
  if (ev === 'fim') { acabar(p); return; }
  if (ev === 'hab') { C.onda(p.x, p.z, 12, p.c, 0.5); C.faiscas(p.x, 2, p.z, p.c, 30, 8); return; }
  if (ev === 'gp') { if (p.p !== K.eu) golpeDeOutro(p); return; }
  if (ev === 'cura') { curaArea(p.x, p.z); return; }
  if (ev === 'cpa') { avisoPancada(p.x, p.z, p.r); return; }
  if (ev === 'cb') { K.txt.push({ x: p.x, y: 4, z: p.z, txt: `COMBO x${p.n}!`, cor: '#7affea', t: 0 }); return; }
  if (ev === 'pw') { efeitoPoder(); return; }
  if (ev === 'bfx') { if (BUFFS[p.k]) toast(`${p.n}: ${tr(BUFFS[p.k].nome)}`); return; }
  if (ev === 'tchau' && K.jogs.has(p.p)) { const j = K.jogs.get(p.p); j.v?.remover(); K.jogs.delete(p.p); }
}
const lista = () => [[K.eu, K.nome, S.heroi || 'lyra'], ...[...K.jogs.values()].map(j => [j.p, j.nome, j.h])];
const listaTorres = () => [...K.torres.entries()].map(([pad, t]) => [pad, t.tipo, t.nv, t.ramo || '']);
function aplicarTorres(l) {
  const vistos = new Set(); for (const [pad, tipo, nv, ramo] of l) { vistos.add(pad); const t0 = K.torres.get(pad); if (t0) t0.ramo = ramo || undefined; const t = t0; if (!t || t.tipo !== tipo) { if (t) cn().remove(t.o); K.torres.set(pad, novaTorre(pad, tipo, nv)); } else if (t.nv !== nv) { t.nv = nv; enfeitarTorre(t); } }
  for (const [pad, t] of K.torres) if (!vistos.has(pad)) { cn().remove(t.o); K.torres.delete(pad); }
}

// ---- inimigos ----
function criarMob(tipo, n, id, porta) {
  const T = TIPOS[tipo], M = K.modo === 'arvore' ? MUNDOS[mundoDe(n)] : {}, jog = 1 + 0.5 * K.jogs.size + 0.3 * (K.bots?.length || 0), hp = Math.round(hpBase(n) * T.hp * jog * (M.hp || 1) * (K.modo === 'arvore' ? 1 + 0.03 * Math.max(0, n - 8) : 1)); // aliados e ondas altas deixam os inimigos mais fortes
  const u = { id: id ?? K.id++, tipo, s: 0, hp, max: hp, vel: T.vel * (0.92 + Math.random() * 0.16) * (M.vel || 1), ph: Math.random() * 6, off: (Math.random() - 0.5) * 3, alt: T.h || 2, y: T.voa ? 3 : 0, escudo: tipo === 'escudeiro' ? 5 : 0, porta };
  if (T.m || tipo === 'chefe') { const ic = (Math.floor(Math.max(5, n) / 5) - 1) % CHEFES.length, m = T.m || CHEFES[ic][0]; if (tipo === 'chefe') u.nome = CHEFES[ic][1]; const v = C.personagem(m, [], 1); u.esc = T.h / (C.alturaModelo(m) * C.ESC_PERS); v.raiz.scale.setScalar(u.esc); v.tocar('Gallop'); u.v = v; }
  prepararMob(u); return u;
}
function ferir(u, d, pid) {
  if (u.morto) return; if (u.marcaT > 0) d *= 1.25; if (pid && classeDoPid(pid) === 'arqueiro') u.marcaT = 4; // alvo marcado pelo arqueiro if (u.escudo > 0) { u.escudo--; return; }
  if (pid && pid !== 'torre') { const agora = performance.now(); (u.hits ||= {})[pid] = agora; const n = Object.values(u.hits).filter(t => agora - t < 1500).length;
    if (n >= 2) { d *= 1 + 0.5 * (n - 1); if (!u.comboT || agora - u.comboT > 900) { u.comboT = agora; K.txt.push({ x: u.x, y: u.y + u.alt + 2, z: u.z, txt: `COMBO x${n}!`, cor: '#7affea', t: 0 }); K.canal?.enviar('cb', { x: u.x, z: u.z, n }); } } }
  u.hp -= d; u.flash = 0.12; u.ult = pid; if (u.v) K.txt.push({ x: u.x, y: u.y + u.alt + 1, z: u.z, txt: fmt(Math.round(d)), cor: '#fff', t: 0 });
  if (u.hp <= 0 && K.host) { const T = TIPOS[u.tipo]; K.cofre += T.moedas; K.abates[pid] = (K.abates[pid] || 0) + 1; K.poder = Math.min(100, K.poder + (u.tipo === 'chefe' ? 25 : u.tipo === 'gigante' ? 12 : u.v ? 4 : 1.5)); K.txt.push({ x: u.x, y: u.y + 2.5, z: u.z, txt: `+${T.moedas}`, cor: '#ffd84a', t: 0 }); matarMob(u); }
}
function matarMob(u, longe) {
  if (u.morto) return; u.morto = true; u.tm = 0;
  if (K.modo === 'arvore') { if (K.host ? u.ult === K.eu : performance.now() - (K.meus.get(u.id) || 0) < 2000) ganharEspirito(u); if (u.tipo === 'chefe') premioChefe(u); }
  if (u.tipo === 'chefe') evento('chefeGrupo');
  if (u.v) { u.v.tocar('Death', { loop: false }); C.impacto(u.x, u.y + u.alt * 0.5, u.z, 0xff6a4a, u.tipo === 'chefe' ? 3 : 1.4); if (u.tipo === 'chefe') { sfx('vitoria'); C.camera.tremor = 1; K.banner = { txt: 'CHEFE DERROTADO!', cor: '#ffd84a', t: 0 }; } }
  else if (!longe) voar('vm', u.x, u.z, (Math.random() - 0.5) * 4, 6 + Math.random() * 3, -4);
}
function bannerOnda() { const c = K.onda % 5 === 0; K.banner = { txt: c ? `ONDA ${K.onda}: CHEFE!` : `ONDA ${K.onda}`, cor: c ? '#ff5a4a' : '#ffd84a', t: 0 }; som('espada'); intensidade(c ? 2 : 1); }

// ---- torres ----
function novaTorre(pad, tipo, nv = 1) {
  const [lx, lz] = PADS[pad], T = TORRES[tipo], o = new THREE.Group(); o.position.set(OX + lx, 0, lz);
  const b = C.objeto('C:tower-square', 2.6); o.add(b);
  let topo = null, orbe = null;
  if (T.topo) { topo = C.objeto(T.topo, 1.6); topo.position.y = 5.2; topo.rotation.y = Math.PI / 2; o.add(topo); }
  else { orbe = new THREE.Mesh(GEO_ORBE, matTiro(T.cor)); orbe.position.y = 6.6; orbe.scale.setScalar(2.6); o.add(orbe); }
  cn().add(o); const torre = { pad, tipo, nv, o, topo, orbe, cd: 0.5, x: OX + lx, z: lz, gasto: T.custo + (nv > 1 ? custoUp(tipo, 1) : 0) + (nv > 2 ? custoUp(tipo, 2) : 0) + (nv > 3 ? custoUp(tipo, 3) : 0) }; enfeitarTorre(torre); C.onda(OX + lx, lz, 6, T.cor, 0.5); return torre;
}
function enfeitarTorre(t) { t.o.scale.setScalar(1 + 0.12 * (t.nv - 1)); }
function construir(pad, tipo, pid) {
  const T = TORRES[tipo]; if (!T || K.torres.has(pad) || K.cofre < T.custo) return false;
  K.cofre -= T.custo; K.torres.set(pad, novaTorre(pad, tipo)); K.canal?.enviar('tw', { l: listaTorres() }); sfx('brilho'); return true;
}
function melhorar(pad, pid, ramo) {
  const t = K.torres.get(pad); if (!t || t.nv >= 4 || (t.nv === 3 && !RAMOS[t.tipo][ramo])) return false; const c = custoUp(t.tipo, t.nv); if (K.cofre < c) return false;
  K.cofre -= c; t.gasto += c; t.nv++; if (t.nv === 4) t.ramo = ramo; enfeitarTorre(t); C.onda(t.x, t.z, 7, 0xffd84a, 0.5); K.canal?.enviar('tw', { l: listaTorres() }); sfx('vitoria'); return true;
}

function vender(pad) {
  const t = K.torres.get(pad); if (!t) return false; K.cofre += Math.round(t.gasto * 0.5); cn().remove(t.o); K.torres.delete(pad); C.faiscas(t.x, 3, t.z, 0xffd84a, 20, 5);
  K.canal?.enviar('tw', { l: listaTorres() }); som('moedas'); return true;
}
// ---- poder do herói: explosão em volta dele (recarga de 20 s) ----
const RECARGA_HAB = 20;
// ---- combate ativo: golpe em combo (o 3º é um giro mais forte) e desviar (avanço rápido sem levar dano) ----
const COMBO = [['Melee_1H_Attack_Slice_Diagonal', 1.4, 4.2, 140], ['Melee_1H_Attack_Slice_Horizontal', 1.7, 4.4, 180], ['Melee_2H_Attack_Spin', 3, 5.4, 360]], RECARGA_DESVIO = 2.5;
const ALC_PERTO = 4.6;
function golpear() {
  const h = K.heroi, agora = performance.now(); if (h.morto || K.estado === 'fim' || agora - (K.comboT || 0) < 280) return;
  if (!K.perto) return tiroForte(agora);
  K.combo = agora - (K.comboT || 0) < 900 ? (K.combo + 1) % 3 : 0; K.comboT = agora; if (K.combo === 2) tut('golpe');
  const [an, mult, alc, graus] = COMBO[K.combo]; h.gT = 0.3; h.tiroT = -0.25; h.cd = Math.max(h.cd, 0.4);
  let a = null, dm = alc + 4; for (const u of K.mobs) { if (u.morto) continue; const d = Math.hypot(u.x - h.x, u.z - h.z); if (d < dm) { dm = d; a = u; } } // mira sozinho no mais perto
  if (a) { h.dir = Math.atan2(a.x - h.x, a.z - h.z); if (dm > alc - 1.5) { const p = Math.min(2.5, dm - alc + 1.5); h.x += Math.sin(h.dir) * p; h.z += Math.cos(h.dir) * p; limitar(h); } }
  const ma = K.arma?.tipo === 'martelo' && K.combo < 2 ? 'Melee_2H_Attack_Chop' : an; if (K.v.tem(ma)) { K.v.tocar(ma, { loop: false, reinicia: true, vel: 1.5 }); K.anim = 'golpe'; }
  const cor = K.arma?.cor ?? h.cor, forte = K.arma?.r >= 4; C.arco(h.x, h.z, h.dir, alc, Math.min(graus, 359), cor); if (forte) C.arco(h.x, h.z, h.dir, alc * 0.78, Math.min(graus, 359), 0xffffff); if (K.combo === 2) C.onda(h.x, h.z, alc, cor, 0.3); sfx('espada');
  const crit = Math.random() * 100 < K.eqA.crit, d = h.dano * mult * (1 + 0.25 * bnv('furia')) * (crit ? 2.2 : 1) * multEsp(); let n = 0;
  for (const u of K.mobs) { if (u.morto) continue; const dx = u.x - h.x, dz = u.z - h.z, dd = Math.hypot(dx, dz); if (dd > alc + (u.tipo === 'gigante' || u.tipo === 'chefe' ? 1.5 : 0.5)) continue;
    if (graus < 360 && dd > 1.2) { let da = Math.atan2(dx, dz) - h.dir; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > graus * Math.PI / 360) continue; }
    const dc = costas(u) ? d * 1.8 : d; if (dc > d) K.txt.push({ x: u.x, y: 5.5, z: u.z, txt: tr('COSTAS!'), cor: '#c89aff', t: 0 }); danoEm(u, dc); C.impacto(u.x, 1.2, u.z, crit ? 0xff9a1a : cor, 0.6); if (forte) C.faiscas(u.x, 1.6, u.z, cor, 8, 5); empurrar(u, K.combo === 2 ? 2.4 : 1.1);
    { const ult = K.txt[K.txt.length - 1], g = crit || K.combo === 2 ? 2 : 1; if (ult && ult.t === 0 && ult.txt === fmt(Math.round(d))) Object.assign(ult, { g, cor: crit ? '#ff9a1a' : '#ffffff' }); else K.txt.push({ x: u.x, y: (u.y || 0) + (u.alt || 2) + 1.4, z: u.z, txt: fmt(Math.round(d)), cor: crit ? '#ff9a1a' : '#ffffff', t: 0, g }); } if (!n++ && K.arma?.lenda) efeitoLenda(K.arma.lenda, u, d); }
  if (n) { K.hitStop = K.combo === 2 ? 0.09 : 0.05; C.camera.tremor = Math.max(C.camera.tremor, 0.15 + 0.15 * K.combo); if (K.eqA.roubo) h.hp = Math.min(h.hpMax, h.hp + d * n * K.eqA.roubo / 100); if (crit) K.txt.push({ x: h.x, y: 4.5, z: h.z, txt: tr('CRÍTICO!'), cor: '#ff9a1a', t: 0 }); }
  K.canal?.enviar('gp', { p: K.eu, c: K.combo, x: Math.round(h.x * 10) / 10, z: Math.round(h.z * 10) / 10, r: Math.round(h.dir * 100) / 100, k: cor });
}
function tiroForte(agora) { // arqueiros e magos: tiro carregado; o 3º do combo solta uma rajada em 5 inimigos
  const h = K.heroi; K.combo = agora - (K.comboT || 0) < 1100 ? (K.combo + 1) % 3 : 0; K.comboT = agora; if (K.combo === 2) tut('golpe');
  const alvos = K.mobs.filter(u => !u.morto && Math.hypot(u.x - h.x, u.z - h.z) < h.alc * 1.15).sort((p, q) => Math.hypot(p.x - h.x, p.z - h.z) - Math.hypot(q.x - h.x, q.z - h.z)).slice(0, K.combo === 2 ? 5 : 1);
  if (!alvos.length) { som('erro'); return; } h.dir = h.alvoDir = Math.atan2(alvos[0].x - h.x, alvos[0].z - h.z); h.tiroT = -0.2; h.cd = Math.max(h.cd, 0.35);
  const at = K.animTiro || K.H.tiro; if (K.v.tem(at)) { K.v.tocar(at, { loop: false, reinicia: true, vel: 1.8 }); K.anim = 'golpe'; h.gT = 0.25; }
  const crit = Math.random() * 100 < K.eqA.crit, d = h.dano * [1.6, 1.9, 1.5][K.combo] * (1 + 0.25 * bnv('furia')) * (crit ? 2.2 : 1) * multEsp(), cor = crit ? 0xff9a1a : K.arma?.cor ?? h.cor;
  const forma = K.arma ? { cajado: 'orbe', arco: 'flecha' }[K.arma.tipo] || h.forma : h.forma; sfx(forma === 'flecha' ? 'arco' : 'magia');
  for (const a of alvos) disparo(h.x, h.z, a, cor, d, { area: h.area + 0.8, perf: h.perf, pid: K.eu, forma, grande: true, lenda: K.arma?.lenda });
  if (K.combo === 2) { C.onda(h.x, h.z, 4, cor, 0.3); C.camera.tremor = Math.max(C.camera.tremor, 0.25); }
  K.atirou = alvos[0].id;
}
function empurrar(u, k) { if (K.host && K.modo === 'arvore' && u.tipo !== 'chefe' && u.tipo !== 'gigante') { u.s = Math.max(0, u.s - k); u.lutaT = 0.5; } } // o inimigo voa para trás
function desviar() {
  const h = K.heroi; if (h.morto || K.estado === 'fim' || h.dsT > 0) return;
  tut('desvio'); h.dsT = RECARGA_DESVIO * (1 - K.eqA.recarga / 200); h.invT = 0.45; h.dash = { t: 0.22, vx: Math.sin(h.dir) * 32, vz: Math.cos(h.dir) * 32 }; h.tiroT = -0.1;
  if (K.v.tem('Dodge_Forward')) { K.v.tocar('Dodge_Forward', { loop: false, reinicia: true, vel: 1.6 }); K.anim = 'desvio'; } sfx('arco'); C.faiscas(h.x, 0.6, h.z, 0xffffff, 12, 4); C.onda(h.x, h.z, 2.5, 0xffffff, 0.25);
}
function golpeDeOutro(p) { const j = K.jogs.get(p.p), [an, , alc, graus] = COMBO[p.c] || COMBO[0]; C.arco(p.x, p.z, p.r, alc, Math.min(graus, 359), p.k ?? 0xffffff); if (p.c === 2) C.onda(p.x, p.z, alc, p.k ?? 0xffffff, 0.3);
  if (j?.v?.tem(an)) { j.v.tocar(an, { loop: false, reinicia: true, vel: 1.5 }); j.anim = 'golpe'; j.tiroT = -0.25; } }
function usarHabilidade() {
  const h = K.heroi; if (h.habT > 0 || K.estado === 'fim' || h.morto) { som('erro'); return; } h.habT = RECARGA_HAB * (1 - K.eqA.recarga / 100);
  sfx('magia'); C.camera.tremor = 0.6; C.onda(h.x, h.z, 12, h.cor, 0.5); C.onda(h.x, h.z, 7, 0xffffff, 0.35); C.faiscas(h.x, 2, h.z, h.cor, 40, 9);
  if (K.v.tem('Spellcast_Raise') || K.v.tem(K.H.tiro)) K.v.tocar(K.v.tem('Spellcast_Raise') ? 'Spellcast_Raise' : K.H.tiro, { loop: false, reinicia: true });
  K.banner = { txt: (K.H.poder?.nome || 'Poder').toUpperCase() + '!', cor: '#ffd84a', t: 0 };
  for (const u of K.mobs) { if (u.morto || Math.hypot(u.x - h.x, u.z - h.z) > 10) continue; const d = h.dano * (u.tipo === 'chefe' ? 6 : 10); u.lentoT = 2.5;
    if (K.host) ferir(u, d, K.eu); else { u.hp -= d; K.meus.set(u.id, performance.now()); K.danos.push([u.id, Math.round(d)]); } C.impacto(u.x, 1, u.z, h.cor, 0.8); }
  K.canal?.enviar('hab', { x: h.x, z: h.z, c: h.cor });
}

// ---- espíritos (como no Lâmina de Pixel): cada inimigo que você derrota solta um espírito que gira em volta de você; cada um dá +5% de dano e +3% de velocidade ----
const GEO_ESP = new THREE.IcosahedronGeometry(0.22, 0), MAT_ESP = new THREE.MeshBasicMaterial({ color: 0xc8a0ff });
const maxEsp = () => 5 + 2 * bnv('almas'), duraEsp = () => 14 + 4 * bnv('almas');
export const multEsp = () => 1 + 0.05 * (K?.esp.length || 0);
function ganharEspirito(u) {
  if (K.esp.length >= maxEsp()) { const v = K.esp.reduce((a, b) => a.t > b.t ? a : b); cn().remove(v.o); K.esp.splice(K.esp.indexOf(v), 1); } // cheio: troca o mais velho
  tut('espirito'); const o = new THREE.Mesh(GEO_ESP, MAT_ESP); cn().add(o); K.esp.push({ t: 0, o, x: u.x, y: (u.y || 0) + 1.5, z: u.z, ph: Math.random() * 6 });
}
function passoEspiritos(dt) {
  const h = K.heroi, tt = C.tempo(), dur = duraEsp();
  for (const e of K.esp) e.t += dt;
  for (const e of K.esp) if (e.t > dur || h.morto) cn().remove(e.o);
  K.esp = K.esp.filter(e => e.t <= dur && !h.morto);
  K.esp.forEach((e, i) => { const a = tt * 2.2 + i * 6.283 / Math.max(1, K.esp.length), tx = h.x + Math.cos(a) * 1.6, tz = h.z + Math.sin(a) * 1.6, ty = 2 + Math.sin(tt * 3 + e.ph) * 0.3, k = Math.min(1, dt * (e.t < 0.6 ? 6 : 12));
    e.x += (tx - e.x) * k; e.y += (ty - e.y) * k; e.z += (tz - e.z) * k; e.o.position.set(e.x, e.y, e.z); e.o.rotation.y = tt * 3; e.o.scale.setScalar(e.t > dur - 2 ? 0.5 + 0.5 * Math.abs(Math.sin(tt * 10)) : 1); });
}
// ---- chefe da Árvore: pancada em área (círculo vermelho de aviso) e chama ajuda na metade da vida ----
function passoChefe(u, dt) {
  if (!K.host || u.morto) return;
  if ((u.golpeT = (u.golpeT ?? 6) - dt) <= 0) { u.golpeT = 7; const r = 7; K.canal?.enviar('cpa', { x: Math.round(u.x * 10) / 10, z: Math.round(u.z * 10) / 10, r }); avisoPancada(u.x, u.z, r); }
  if (!u.chamou && u.hp < u.max * 0.5) { u.chamou = true; for (let i = 0; i < 6; i++) { const m = criarMob('orc', K.onda, undefined, u.porta); m.s = Math.max(0, u.s - 2 - i); m.off = (i - 2.5) * 1.5; K.mobs.push(m); } K.banner = { txt: 'O CHEFE CHAMOU REFORÇOS!', cor: '#ff6a5a', t: 0 }; }
}
function avisoPancada(x, z, r) { // círculo vermelho por 1,3s; quem ficar dentro apanha
  const o = new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.35, depthWrite: false })); o.position.set(x, 0.25, z); cn().add(o); sfx('magia');
  setTimeout(() => { if (!K) return; cn().remove(o); o.geometry.dispose(); o.material.dispose(); C.onda(x, z, r, 0xff5a3a, 0.4); C.faiscas(x, 1, z, 0xffa03a, 30, 8); C.camera.tremor = Math.max(C.camera.tremor, 0.6); som('pancada');
    const h = K.heroi; if (!h.morto && !(h.invT > 0) && Math.hypot(h.x - x, h.z - z) < r) { h.hp -= h.hpMax * 0.35 * (1 - K.eqA.def / 100); K.v.brilho(0.6); setTimeout(() => K?.v.brilho(0), 120); flashTela('#ff3a2a', 0.25); }
    for (const b of K.bots || []) if (!b.morto && Math.hypot(b.x - x, b.z - z) < r) b.hp -= b.hpMax * 0.35; }, 1300);
}
function premioChefe(u) { // baú do chefe: um equipamento garantido (Raro ou melhor) para cada jogador
  const it = EQ.gerarItem(K.onda * 1.5, 2); K.itensChefe.push(it); toast(`${tr('Baú do chefe')}: ${it.nome}`); sfx('vitoria');
}
// ---- mundos da Árvore: a cada 10 ondas o lugar muda (e os inimigos também) ----
const MUNDOS = [{ nome: 'Floresta Sagrada', ceu: 0x9ad8f8 }, { nome: 'Tundra Gelada', ceu: 0xd8e8f4, chao: 0xf4f8ff, op: 0.72, vel: 0.85, hp: 1.2 }, { nome: 'Areias Antigas', ceu: 0xf8dca8, chao: 0xe8c890, op: 0.7, vel: 1.2, hp: 1 }];
const mundoDe = onda => onda ? Math.floor((onda - 1) / 10) % MUNDOS.length : 0;
function passoMundo() {
  const i = mundoDe(K.onda); if (i === (K.mundo || 0)) return; K.mundo = i; const M = MUNDOS[i]; C.ceu(M.ceu);
  if (!K.manto) { K.manto = new THREE.Mesh(new THREE.CircleGeometry(66, 64).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false })); K.manto.position.set(ARV.x, 0.06, ARV.z); K.manto.receiveShadow = true; cn().add(K.manto); }
  K.manto.visible = !!M.chao; if (M.chao) { K.manto.material.color.set(M.chao); K.manto.material.opacity = M.op; }
  K.banner = { txt: `${tr('MUNDO')} ${i + 1}: ${tr(M.nome).toUpperCase()}`, cor: '#9ae8ff', t: 0 }; flashTela('#ffffff', 0.4); sfx('vitoria');
}
// botão de girar a câmera (arqueiro e mago, que atacam sozinhos)
function ligarCamPad() {
  const e = $('#dfCamPad'); if (!e) return; let id = null, x0 = 0;
  e.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); id = ev.pointerId; x0 = ev.clientX; e.classList.add('on'); tut('golpe'); try { e.setPointerCapture(id); } catch (er) {} });
  e.addEventListener('pointermove', ev => { if (ev.pointerId !== id || !K) return; K.yaw -= (ev.clientX - x0) * 0.014; x0 = ev.clientX; K.camManual = performance.now(); tut('golpe'); });
  const fim = ev => { if (ev.pointerId === id) { id = null; e.classList.remove('on'); } }; e.addEventListener('pointerup', fim); e.addEventListener('pointercancel', fim);
}
// ---- tutorial da primeira Árvore ----
const TUT = [['andar', 'Arraste do lado esquerdo para andar'], ['golpe', 'Toque no botão vermelho para atacar. 3 seguidos fazem um combo!'], ['desvio', 'Toque no botão azul para desviar: você fica invencível por um instante'],
  ['espirito', 'Derrote inimigos: eles soltam espíritos que deixam você mais forte'], ['fim', 'Proteja a árvore! A cada 3 ondas pisem num círculo para escolher um poder. A cada 5 ondas vem um chefe.']];
function tut(ev) {
  if (K?.tut == null || TUT[K.tut]?.[0] !== ev) return; K.tut++; sfx('brilho'); mostrarTut();
  if (TUT[K.tut]?.[0] === 'fim') setTimeout(() => { if (K?.tut != null) { K.tut = null; S.tutArv = 1; salvar(); mostrarTut(); } }, 9000);
}
function mostrarTut() {
  const e = $('#dfTut'); if (!e) return; const P = K.tut != null && TUT[K.tut]; e.hidden = !P; e.onclick = () => { if (K?.tut != null && TUT[K.tut]) tut(TUT[K.tut][0]); }; // tocar no balão passa a dica if (P) e.innerHTML = `<small>${K.tut + 1}/${TUT.length}</small> ${tr(P[0] === 'golpe' && !K.perto ? 'Seu herói ataca sozinho. Use o botão redondo para girar a câmera' : P[1])} <em>${tr('toque para seguir')}</em>`;
  $('#dfGolpe')?.classList.toggle('tutAlvo', P?.[0] === 'golpe'); $('#dfCamPad')?.classList.toggle('tutAlvo', P?.[0] === 'golpe'); $('#dfDesvio')?.classList.toggle('tutAlvo', P?.[0] === 'desvio');
}
// ---- papel de cada classe no grupo ----
// Guerreiro provoca (inimigos vão nele, toma 25% menos dano) · Mago cura em área · Arqueiro marca o alvo (+25% de dano do time) · Ladino crítico pelas costas
const classeDoPid = pid => pid === K.eu ? EQ.classeAtual() : String(pid).startsWith('bot:') ? String(pid).slice(4) : EQ.CLASSE_HEROI[K.jogs.get(pid)?.h] || null;
const ehGuerreiro = h => (h === K.heroi ? EQ.classeAtual() : h.c || EQ.CLASSE_HEROI[h.h]) === 'guerreiro';
const costas = u => EQ.classeAtual() === 'ladino' && ((K.heroi.x - u.x) * Math.sin(u.ry || 0) + (K.heroi.z - u.z) * Math.cos(u.ry || 0)) < 0;
function curaArea(x, z) {
  C.onda(x, z, 9, 0x6aff8a, 0.5); C.faiscas(x, 1.5, z, 0x6aff8a, 12, 4); const h = K.heroi;
  if (!h.morto && Math.hypot(h.x - x, h.z - z) < 9) { const v = Math.round(h.hpMax * 0.08); h.hp = Math.min(h.hpMax, h.hp + v); K.txt.push({ x: h.x, y: 4, z: h.z, txt: `+${v}`, cor: '#6aff8a', t: 0 }); }
  if (K.host) for (const b of K.bots || []) if (!b.morto && Math.hypot(b.x - x, b.z - z) < 9) b.hp = Math.min(b.hpMax, b.hp + b.hpMax * 0.08);
}
function passoPapeis(dt) {
  const h = K.heroi; if (EQ.classeAtual() === 'mago' && !h.morto && (K.curaT = (K.curaT ?? 5) - dt) <= 0) { K.curaT = 5; curaArea(h.x, h.z); K.canal?.enviar('cura', { x: Math.round(h.x * 10) / 10, z: Math.round(h.z * 10) / 10 }); }
  for (const b of K.bots || []) if (b.c === 'mago' && !b.morto && (b.curaT = (b.curaT ?? 5) - dt) <= 0) { b.curaT = 5; curaArea(b.x, b.z); }
}
// ---- aliados do jogo: jogando sozinho na Árvore, 2 heróis de outras classes lutam junto ----
const BOT_CLASSE = { guerreiro: 'thalia', mago: 'selene', arqueiro: 'lyra', ladino: 'kira' };
function passoBots(dt) {
  if (K.modo !== 'arvore') return; K.bots ||= [];
  const quer = K.host && !K.jogs.size && K.estado !== 'fim' ? 2 : 0;
  while (K.bots.length > quer) { const b = K.bots.pop(); b.v.remover(); }
  if (K.bots.length < quer) { const minha = EQ.classeAtual(), cls = Object.keys(BOT_CLASSE).filter(c => c !== minha && !K.bots.some(b => b.c === c));
    const c = cls[K.bots.length % cls.length], hk = BOT_CLASSE[c], H = HEROIS[hk], r = Math.min(4, 1 + Math.floor(K.onda / 6)), tipo = EQ.CLASSES[c].armas[0];
    const v = C.heroi({ ...H.visual, arma: `P:${tipo}:${r}`, esq: c === 'arqueiro' || c === 'mago' ? '' : H.visual.esq }); v.raiz.scale.setScalar(0.8); const a = (K.bots.length ? -1 : 1) * 1.2;
    K.bots.push({ c, h: hk, nome: `${H.nome} (${tr('aliado')})`, v, x: ARV.x + Math.sin(a) * 9, z: ARV.z + Math.cos(a) * 9, dir: 0, hp: K.heroi.hpMax * 0.8, hpMax: K.heroi.hpMax * 0.8, cd: 1, perto: !!EQ.CLASSES[c].perto, cor: H.ataque.cor, anim: '' }); }
  const mult = multAtk();
  for (const b of K.bots) {
    b.v.mixer.update(dt);
    if (b.morto) { const ok = !K.heroi.morto && Math.hypot(K.heroi.x - b.x, K.heroi.z - b.z) < 3; b.revT = ok ? (b.revT || 0) + dt : 0;
      if (b.revT >= 2.5 || (b.mortoT -= dt) <= 0) { const aqui = b.revT >= 2.5; b.morto = false; b.revT = 0; b.hp = b.hpMax * (aqui ? 0.4 : 1); if (!aqui) { b.x = ARV.x; b.z = ARV.z + 9; } b.anim = ''; C.onda(b.x, b.z, 3, 0x6aff8a, 0.4); } continue; }
    if (K.heroi.morto) { const dx = K.heroi.x - b.x, dz = K.heroi.z - b.z, d = Math.hypot(dx, dz); b.dir = Math.atan2(dx, dz); if (d > 2) { b.x += dx / d * 9 * dt; b.z += dz / d * 9 * dt; if (b.anim !== 'Running_A') { b.anim = 'Running_A'; b.v.tocar('Running_A'); } } else if (b.anim !== 'Idle_A') { b.anim = 'Idle_A'; b.v.tocar('Idle_A'); } b.v.raiz.position.set(b.x, 0, b.z); b.v.raiz.rotation.y = b.dir; continue; } // vai te levantar
    let alvo = null, dm = 1e9; for (const u of K.mobs) { if (u.morto) continue; const d = Math.hypot(u.x - b.x, u.z - b.z) + Math.hypot(u.x - ARV.x, u.z - ARV.z) * 0.5; if (d < dm) { dm = d; alvo = u; } }
    const alc = b.perto ? 3 : 13; let anda = false;
    if (alvo) { const dx = alvo.x - b.x, dz = alvo.z - b.z, d = Math.hypot(dx, dz); b.dir = Math.atan2(dx, dz);
      if (d > alc) { b.x += dx / d * 9 * dt; b.z += dz / d * 9 * dt; anda = true; limitar(b); }
      else if ((b.cd -= dt) <= 0) { b.cd = b.perto ? 0.8 : 1; const dano = K.heroi.dano * (b.perto ? 0.9 : 0.6), an = b.perto ? 'Melee_1H_Attack_Chop' : HEROIS[b.h].tiro;
        if (b.v.tem(an)) { b.v.tocar(an, { loop: false, reinicia: true, vel: 1.5 }); b.anim = 'golpe'; b.golpeT = 0.5; }
        if (b.perto) { C.arco(b.x, b.z, b.dir, 3, 140, b.cor); acertar({ dano, cor: b.cor, op: { area: 1.2, pid: 'bot:' + b.c } }, alvo); empurrar(alvo, 0.8); }
        else disparo(b.x, b.z, alvo, b.cor, dano, { area: HEROIS[b.h].ataque.area, pid: 'bot:' + b.c, forma: b.c === 'arqueiro' ? 'flecha' : 'orbe', grande: true }); } }
    else { const d = Math.hypot(b.x - ARV.x, b.z - ARV.z); if (d > 12) { b.x += (ARV.x - b.x) / d * 6 * dt; b.z += (ARV.z - b.z) / d * 6 * dt; anda = true; } }
    let dano = 0; for (const u of K.mobs) if (!u.morto && !TIPOS[u.tipo].longe && Math.hypot(u.x - b.x, u.z - b.z) < 2.6) dano += TIPOS[u.tipo].atk * 0.5; b.hp -= dano * mult * dt;
    if (b.hp <= 0) { b.morto = true; b.mortoT = 10; b.revT = 0; if (b.v.tem('Death')) { b.v.tocar('Death', { loop: false }); b.anim = 'morto'; } C.faiscas(b.x, 2, b.z, 0x9ad8ff, 20, 5); }
    b.golpeT = (b.golpeT || 0) - dt; const an = b.golpeT > 0 ? null : anda ? 'Running_A' : 'Idle_A'; if (an && b.anim !== an) { b.anim = an; b.v.tocar(an); }
    b.v.raiz.position.set(b.x, 0, b.z); b.v.raiz.rotation.y = b.dir;
  }
}
// ---- poder do time: enche com os abates de todos; qualquer um solta (chuva de meteoros em todos os inimigos) ----
function usarPoder() {
  if (!K.host || K.poder < 100 || K.estado === 'fim') return; K.poder = 0;
  for (const u of K.mobs) if (!u.morto) { const d = u.tipo === 'chefe' ? u.max * 0.08 : u.tipo === 'gigante' ? u.max * 0.25 : u.max * 0.6; u.lentoT = 3; ferir(u, d, K.eu); }
  K.canal?.enviar('pw', {}); efeitoPoder();
}
function efeitoPoder() {
  sfx('magia'); setTimeout(() => sfx('vitoria'), 300); C.camera.tremor = 1; flashTela('#ffb03a', 0.4); K.banner = { txt: 'PODER DO TIME!', cor: '#ffb03a', t: 0 };
  for (const u of K.mobs) if (!u.morto) { C.impacto(u.x, 1, u.z, 0xff7a2a, 1.2); C.faiscas(u.x, 2, u.z, 0xffb03a, 12, 6); }
}

// ---- interface ----
function desenhar() {
  el.innerHTML = `<div class="dfTopo"><button class="lSair" data-df="sair">${ico('fechar')}</button><b id="dfOnda">${tr('Defesa em Grupo')}</b><span class="pilula ouro" ${K.modo === 'arvore' ? 'hidden' : ''}>${ico('ouro')}<b id="dfMoedas">0</b></span><small id="dfJog">${ico('herois')} 1/4</small></div>
    <div class="dfBase">${ico(K.modo === 'arvore' ? 'floresta' : 'h_muralha')}<div class="barra muro"><i id="dfBaseB"></i><span id="dfBaseT"></span></div></div>
    ${K.modo === 'arvore' ? `<div class="dfVida">${ico('coracao')}<div class="barra"><i id="dfHpB"></i><span id="dfHpT"></span></div><b id="dfEsp" class="dfEsp"></b></div><div class="dfChefe" id="dfChefe" hidden><b id="dfChefeN"></b><div class="barra"><i id="dfChefeB"></i></div></div>` : ''}
    <div class="dfAviso" id="dfAviso" hidden></div><div class="dfTut" id="dfTut" hidden></div><div class="dfEspera" id="dfEspera" hidden></div>
    <div class="dfJoy" id="dfJoy" hidden><i></i></div><div class="dfDica" id="dfDica">${tr('Arraste do lado esquerdo para andar · do direito para girar a câmera')}</div>
    <button class="dfHab" id="dfHab" data-df="hab"><i id="dfHabB"></i><span>${ico('h_fogo')}</span><small id="dfHabT"></small></button><button class="dfPoder" id="dfPoder" data-df="poder"><i id="dfPoderB"></i><span>${ico('raio')}</span></button>${K.perto ? `<button class="dfGolpe ${K.modo}" id="dfGolpe" data-df="golpe">${ico('h_lamina')}</button>` : `<div class="dfCamPad ${K.modo}" id="dfCamPad">${ico('girar')}<small>${tr('câmera')}</small></div>`}<button class="dfDesvio ${K.modo}" id="dfDesvio" data-df="desviar"><i id="dfDesvioB"></i><span>${ico('esquiva')}</span></button><div class="dfAcoes" id="dfAcoes"></div><div class="cqJanela" id="dfJanela" hidden></div>`;
}
function avisar(t) { const a = $('#dfAviso'); if (!a) return; a.hidden = !t; a.textContent = t; }
function toast(t) { const a = $('#dfAviso'); if (!a || !K) return; a.hidden = false; a.textContent = t; clearTimeout(K.tToast); K.tToast = setTimeout(() => { if (K && K.estado !== 'entrando') a.hidden = true; }, 2000); }
function atualizarHud() {
  if (!K) return; const m = $('#dfMoedas'); if (!m) return; m.textContent = fmt(K.cofre);
  $('#dfBaseB').style.width = 100 * Math.max(0, K.base) / Math.max(1, K.baseMax) + '%'; $('#dfBaseT').textContent = `${fmt(Math.max(0, Math.round(K.base)))} / ${fmt(K.baseMax)}`;
  $('#dfOnda').textContent = K.onda ? `${tr('Onda')} ${K.onda}` : tr(K.modo === 'arvore' ? 'Árvore Sagrada' : 'Defesa em Grupo');
  if (K.estado === 'buff' && K.circ) avisar(`${tr('Pise no círculo do poder que você quer')} · ${Math.ceil(Math.max(0, K.buffT || 0))}s`); else if (K.avisoBuff) avisar(''); K.avisoBuff = K.estado === 'buff'; $('#dfJog').innerHTML = `${ico('herois')} ${1 + K.jogs.size}/${K.modo === 'arvore' ? 6 : 4}`;
  const hp = $('#dfHpB'); if (hp) { hp.style.width = 100 * Math.max(0, K.heroi.hp) / K.heroi.hpMax + '%'; $('#dfHpT').textContent = K.heroi.morto ? (K.heroi.revT > 0 ? `${tr('Levantando')} ${Math.round(K.heroi.revT / 2.5 * 100)}%` : `${tr('Renascendo em')} ${Math.ceil(K.heroi.mortoT)}s`) : `${Math.ceil(K.heroi.hp)} / ${K.heroi.hpMax}`; }
  { const e = $('#dfEsp'); if (e) e.innerHTML = K.esp.length ? `${ico('sombras')} ${K.esp.length}/${maxEsp()}` : ''; const ch = K.mobs.find(u => u.tipo === 'chefe' && !u.morto), cb = $('#dfChefe');
    if (cb) { cb.hidden = !ch; if (ch) { $('#dfChefeN').innerHTML = `${ico('caveira')} ${ch.nome || tr('Chefe')}`; $('#dfChefeB').style.width = 100 * Math.max(0, ch.hp) / ch.max + '%'; } } }
  const hb = $('#dfHab'); if (hb) { const r = Math.max(0, K.heroi.habT || 0); hb.classList.toggle('pronto', !r); $('#dfHabB').style.height = (r / RECARGA_HAB * 100) + '%'; $('#dfHabT').textContent = r ? Math.ceil(r) : ''; }
  const dv = $('#dfDesvio'); if (dv) { const r = Math.max(0, K.heroi.dsT || 0); dv.classList.toggle('pronto', !r); $('#dfDesvioB').style.height = (r / RECARGA_DESVIO * 100) + '%'; }
  const pw = $('#dfPoder'); if (pw) { pw.classList.toggle('pronto', K.poder >= 100); $('#dfPoderB').style.height = Math.min(100, K.poder) + '%'; }
  const e = $('#dfEspera'); if (e) { const v = K.estado === 'pausa' && K.pronto; e.hidden = !v; if (v) { const t = `${tr(K.onda ? 'Próxima onda em' : 'Começa em')} ${Math.ceil(Math.max(0, K.pausaT))}s`; if (e.dataset.t !== t) { e.dataset.t = t; const ic = { arqueiro: 'arq', orc: 'r_orc', elite: 'forca', voador: 'monstro', escudeiro: 'escudo', xama: 'mag', sabotador: 'h_fogo', gigante: 'r_gigante', chefe: 'chefe' }, n = {}; for (const f of montarOnda(K.onda + 1, K.modo)) n[f.tipo] = (n[f.tipo] || 0) + 1;
      e.innerHTML = `<span>${t}<small>${Object.entries(n).map(([k, q]) => `${ico(ic[k])}${q}`).join(' ')}</small></span><button class="btn verde peq" data-df="pular">${tr('Já!')}</button>`; } } }
  acoes();
}
function tocarMapa(sx, sy) { // tocou num lugar de torre: escolhe ele (se o herói não estiver longe demais)
  if (K.modo === 'arvore') return;
  let m = null, dm = 48; PADS.forEach(([x, z], i) => { const p = C.tela(OX + x, 0.5, z); if (!p) return; const d = Math.hypot(p[0] - sx, p[1] - sy); if (d < dm) { dm = d; m = i; } });
  if (m == null) return; const [x, z] = PADS[m]; if (Math.hypot(OX + x - K.heroi.x, z - K.heroi.z) > 22) { som('erro'); toast(tr('Chegue mais perto desse lugar')); return; }
  K.padSel = m; K.menu = !K.torres.has(m); K.sigAcoes = null; som('clique'); acoes();
}
function padPerto() { if (K.modo === 'arvore') return null; const h = K.heroi; if (K.padSel != null) { const [x, z] = PADS[K.padSel]; if (Math.hypot(OX + x - h.x, z - h.z) < 22) return K.padSel; K.padSel = null; } let m = null, dm = 5.5; PADS.forEach(([x, z], i) => { const d = Math.hypot(OX + x - h.x, z - h.z); if (d < dm) { dm = d; m = i; } }); return m; }
function acoes() { // botão grande do lado direito: construir ou melhorar a torre do lugar onde o herói está
  const a = $('#dfAcoes'); if (!a) return; const pad = K.estado === 'fim' ? null : padPerto(), t = pad != null && K.torres.get(pad), eu = K.cofre;
  const sig = `${pad}|${t ? t.tipo + t.nv : ''}|${K.menu ? 1 : 0}|${Math.floor(eu / 10)}`; if (sig === K.sigAcoes) return; K.sigAcoes = sig;
  if (pad == null) { a.innerHTML = ''; K.menu = false; return; }
  if (t) { const c = t.nv < 4 ? custoUp(t.tipo, t.nv) : 0, nomeR = t.ramo ? ` · ${tr(RAMOS[t.tipo][t.ramo].nome)}` : '';
    const botoes = t.nv < 3 ? `<button class="btn amarelo" data-df="up" data-pad="${pad}" ${eu < c ? 'disabled' : ''}>${ico('treinar')} ${tr('Melhorar')} ${ico('ouro')}${fmt(c)}</button>`
      : t.nv === 3 ? `<div class="dfRamos">${Object.entries(RAMOS[t.tipo]).map(([r, R]) => `<button class="btn roxo dfRamo" data-df="ramo" data-r="${r}" data-pad="${pad}" ${eu < c ? 'disabled' : ''}><b>${tr(R.nome)}</b><small>${tr(R.desc)}</small><em>${ico('ouro')}${fmt(c)}</em></button>`).join('')}</div>` : `<small>${tr('Nível máximo')}</small>`;
    a.innerHTML = `<div class="dfTorreInfo"><b>${tr(TORRES[t.tipo].nome)} ${'★'.repeat(t.nv)}${nomeR}</b></div>${botoes}<button class="btn cinza peq" data-df="vender" data-pad="${pad}">${tr('Vender')} +${fmt(Math.round(t.gasto * 0.5))}</button>`; return; }
  if (!K.menu) { a.innerHTML = `<button class="btn verde grande dfConstruir" data-df="menu">${ico('forja')} ${tr('Construir torre')}</button>`; return; }
  a.innerHTML = `<div class="dfMenu">${Object.entries(TORRES).map(([k, T]) => `<button class="dfOp" data-df="torre" data-t="${k}" data-pad="${pad}" ${eu < T.custo ? 'disabled' : ''}><b>${tr(T.nome)}</b><small>${tr(T.desc)}</small><em>${ico('ouro')}${T.custo}</em></button>`).join('')}
    <button class="btn cinza peq" data-df="fecharMenu">${ico('fechar')}</button></div>`;
}
export function clique(b, toque) {
  if (!K) return; if (!toque && K.pd && performance.now() - K.pd.t < 600) return; // o clique que vem depois do toque não conta (senão abre e já fecha o menu)
  const a = b.dataset.df;
  if (a === 'sair') { som('fechar'); if (K.estado !== 'fim' && K.onda > 1) acabar({ saiu: true }); else aoSair(); return; }
  if (a === 'menu') { K.menu = true; K.sigAcoes = null; som('clique'); acoes(); return; }
  if (a === 'fecharMenu') { K.menu = false; K.padSel = null; K.sigAcoes = null; som('fechar'); acoes(); return; }
  if (a === 'torre') { const pad = +b.dataset.pad, t = b.dataset.t; K.menu = false; K.sigAcoes = null; K.padSel = null;
    if (K.host) { if (!construir(pad, t, K.eu)) som('erro'); } else { if (K.cofre < TORRES[t].custo) { som('erro'); return; } K.canal?.enviar('b', { p: K.eu, pad, t }); som('confirma'); }
    atualizarHud(); return; }
  if (a === 'ramo') { const pad = +b.dataset.pad, r = b.dataset.r; if (K.host) { if (!melhorar(pad, K.eu, r)) som('erro'); } else { K.canal?.enviar('u', { p: K.eu, pad, r }); som('confirma'); } K.sigAcoes = null; atualizarHud(); return; }
  if (a === 'up') { const pad = +b.dataset.pad; if (K.host) { if (!melhorar(pad, K.eu)) som('erro'); } else { K.canal?.enviar('u', { p: K.eu, pad }); som('confirma'); } K.sigAcoes = null; atualizarHud(); return; }
  if (a === 'hab') { usarHabilidade(); atualizarHud(); return; }
  if (a === 'golpe') { golpear(); return; }
  if (a === 'desviar') { desviar(); atualizarHud(); return; }
  if (a === 'vender') { const pad = +b.dataset.pad; K.padSel = null; if (K.host) vender(pad); else { K.canal?.enviar('v', { p: K.eu, pad }); som('moedas'); } K.sigAcoes = null; return; }
  if (a === 'poder') { if (K.poder < 100) { som('erro'); toast(tr('Matem mais inimigos juntos para encher o poder')); return; } if (K.host) usarPoder(); else { K.canal?.enviar('poder', {}); K.poder = 0; } return; }
  if (a === 'pular') { som('clique'); if (K.host) K.pausaT = Math.min(K.pausaT, 1); else K.canal?.enviar('pular', {}); return; }
  if (a === 'denovo') { som('confirma'); const s = aoSair, m = K.modo; fechar(); abrir(el || $('#defesa'), s, m); return; }
  if (a === 'menuFim') { som('clique'); aoSair(); }
}

// ---- toque: joystick à esquerda, câmera à direita (e WASD no computador) ----
let toqueEl = null; const teclas = new Set();
const dn = e => { if (!K) return; K.tq = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }; if (e.clientX < innerWidth * 0.5 && !K.joy) { K.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }; const j = $('#dfJoy'); j.hidden = false; j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; $('#dfDica')?.remove(); }
  else if (!K.cam) K.cam = { id: e.pointerId, x: e.clientX }; try { toqueEl.setPointerCapture(e.pointerId); } catch (er) {} };
const mv = e => { if (!K) return; if (K.joy?.id === e.pointerId) { let dx = e.clientX - K.joy.x0, dy = e.clientY - K.joy.y0; const d = Math.hypot(dx, dy), m = 55; if (d > m) { dx *= m / d; dy *= m / d; } K.joy.dx = dx / m; K.joy.dy = dy / m; const k = document.querySelector('#dfJoy i'); if (k) k.style.transform = `translate(${dx}px,${dy}px)`; }
  else if (K.cam?.id === e.pointerId) { K.yaw -= (e.clientX - K.cam.x) * 0.008; K.cam.x = e.clientX; K.camManual = performance.now(); } };
const up = e => { if (!K) return; const q = K.tq; if (q?.id === e.pointerId && Math.hypot(e.clientX - q.x, e.clientY - q.y) < 10 && performance.now() - q.t < 350) tocarMapa(e.clientX, e.clientY); if (K.joy?.id === e.pointerId) { K.joy = null; const j = $('#dfJoy'); if (j) j.hidden = true; const k = document.querySelector('#dfJoy i'); if (k) k.style.transform = ''; } if (K.cam?.id === e.pointerId) K.cam = null; };
const kd = e => { if (/^(KeyW|KeyA|KeyS|KeyD|Arrow\w+|KeyQ|KeyE)$/.test(e.code)) teclas.add(e.code); if (!K || e.repeat || /INPUT|TEXTAREA/.test(e.target?.tagName)) return; if (e.code === 'Space' || e.code === 'KeyJ') { e.preventDefault(); golpear(); } else if (/^Shift|^KeyK$/.test(e.code)) { desviar(); atualizarHud(); } }, ku = e => teclas.delete(e.code);
function apertou(e) { const b = e.target.closest?.('[data-df]'); if (!b || b.disabled || !K) return; e.preventDefault(); K.pd = { b, t: performance.now() }; clique(b, true); }
function ligarToque() { el.addEventListener('pointerdown', apertou); toqueEl = $('#toque'); for (const [ev, f] of [['pointerdown', dn], ['pointermove', mv], ['pointerup', up], ['pointercancel', up]]) toqueEl.addEventListener(ev, f); addEventListener('keydown', kd); addEventListener('keyup', ku); }
function desligarToque() { el?.removeEventListener('pointerdown', apertou); if (toqueEl) for (const [ev, f] of [['pointerdown', dn], ['pointermove', mv], ['pointerup', up], ['pointercancel', up]]) toqueEl.removeEventListener(ev, f); toqueEl = null; removeEventListener('keydown', kd); removeEventListener('keyup', ku); teclas.clear(); }

// ---- laço ----
export function passo(dt) {
  if (!K) return; dt = Math.min(dt, 0.1); if (K.hitStop > 0) { K.hitStop -= dt; dt *= 0.08; } const tt = C.tempo(); // golpe forte: o tempo quase para por um instante
  moverHeroi(dt); outrosHerois(dt);
  if (K.host && K.pronto && K.estado !== 'fim') simular(dt);
  else if (!K.host && K.estado !== 'fim') { for (const u of K.mobs) if (!u.morto) { u.s += u.vel * dt * (u.lentoT > 0 ? 0.5 : 1); if (u.L) u.s = Math.min(u.s, u.L); } if (K.pronto && performance.now() - K.ultS > 8000 && K.ultS) acabar({ saiu: true, host: true }); }
  for (const u of K.mobs) { if (u.lentoT > 0) u.lentoT -= dt; if (u.marcaT > 0 && K.host) u.marcaT -= dt; const p = posMob(u); u.x = p.x + Math.cos(p.ry) * u.off; u.z = p.z - Math.sin(p.ry) * u.off; u.ry = p.ry;
    if (u.v) { u.v.mixer.update(dt); u.flash = Math.max(0, (u.flash || 0) - dt); u.v.brilho(u.flash > 0 ? 0.5 : 0); u.v.raiz.position.set(u.x, u.y, u.z); u.v.raiz.rotation.y = u.ry; if (u.morto) { u.tm += dt; if (u.tm > 1.2) u.v.raiz.visible = false; } } }
  for (const u of K.mobs) if (u.morto && u.v && u.tm >= 1.3) u.v.remover();
  K.mobs = K.mobs.filter(u => !u.morto || (u.v && u.tm < 1.3));
  desenharTropas('vm', K.mobs.filter(u => !u.v && !u.morto), 0, tt); passoVoo(dt);
  if (K.modo === 'arvore') passoArvore(dt);
  heroiAtira(dt); passoBots(dt); passoCirculos(); if (K.modo === 'arvore') { passoEspiritos(dt); passoPapeis(dt); passoMundo(); } torresAtiram(dt); passoTiros(dt); passoQueimas(dt); if (K.heroi.habT > 0) K.heroi.habT -= dt;
  for (const t of K.torres.values()) if (t.orbe) t.orbe.position.y = 6.6 + Math.sin(tt * 2.5 + t.pad) * 0.35;
  { const pad = K.estado === 'fim' ? null : padPerto(), t = pad != null && K.torres.get(pad); if (!K.anel) { K.anel = new THREE.Mesh(GEO_ANEL, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false })); cn().add(K.anel); }
    K.anel.visible = pad != null && (!!t || K.menu); if (K.anel.visible) { const [x, z] = PADS[pad], alc = t ? TORRES[t.tipo].alc * (1 + 0.1 * (t.nv - 1)) : TORRES.arq.alc; K.anel.position.set(OX + x, 0.4, z); K.anel.scale.setScalar(alc); } }
  if (K.baseAnt != null && K.base < K.baseAnt - 0.5) { flashTela('#ff3a2a', 0.22); C.camera.tremor = Math.max(C.camera.tremor, 0.35); K.txt.push({ x: OX, y: 9, z: 33, txt: `-${Math.round(K.baseAnt - K.base)}`, cor: '#ff6a5a', t: 0 }); } K.baseAnt = K.base;
  // rede: herói (todos), foto da partida (anfitrião), dano (clientes)
  if (K.canal) {
    if ((K.tH -= dt) <= 0) { K.tH = 0.1; const h = K.heroi; K.canal.enviar('h', { m: h.morto ? 1 : 0, p: K.eu, n: K.nome, h: S.heroi || 'lyra', x: Math.round(h.x * 10) / 10, z: Math.round(h.z * 10) / 10, r: Math.round(h.dir * 100) / 100, a: K.atirou ?? -1, g: K.poderEq, rr: K.rarEq, ...((K.tVis = (K.tVis || 0) - 1) <= 0 ? (K.tVis = 20, { vs: visCurto(K.visH) }) : {}) }); K.atirou = null; }
    if (K.host && (K.tS -= dt) <= 0) { K.tS = 0.25; K.canal.enviar('s', { o: K.onda, e: K.estado, pt: Math.round(K.pausaT * 10) / 10, b: Math.round(K.base), bm: K.baseMax,
      m: K.mobs.filter(u => !u.morto).slice(0, 80).map(u => [u.id, LTIPOS.indexOf(u.tipo), Math.round(u.s * 10) / 10, Math.round(u.hp), u.max, u.porta ?? 0, Math.round((u.off || 0) * 10), u.marcaT > 0 ? 1 : 0]), c: K.cofre, pw: Math.round(K.poder), bf: K.buffs, bt: Math.round(K.buffT || 0), ...(K.estado === 'buff' && K.circ ? { bo: K.cartas, bc: K.circ.map(c => c.n) } : {}) });
      if ((K.tTw = (K.tTw || 0) - 0.25) <= 0) { K.tTw = 3; K.canal.enviar('tw', { l: listaTorres() }); } }
    if (!K.host && K.danos.length && (K.tD -= dt) <= 0) { K.tD = 0.15; K.canal.enviar('d', { p: K.eu, l: K.danos.splice(0) }); }
    if (K.host && K.sala && (K.tPing -= dt) <= 0) { K.tPing = 3; ON.defPing(K.sala, 1 + K.jogs.size, K.onda, K.estado !== 'fim' && K.onda < 15).catch(() => {}); }
  }
  if ((K.tHud = (K.tHud || 0) - dt) <= 0) { K.tHud = 0.25; atualizarHud(); }
}
function limitar(h) {
  if (K.modo === 'arvore') { const dx = h.x - ARV.x, dz = h.z - ARV.z, d = Math.hypot(dx, dz) || 1; if (d > 52) { h.x = ARV.x + dx / d * 52; h.z = ARV.z + dz / d * 52; } if (d < R_ARV + 1.5) { h.x = ARV.x + dx / d * (R_ARV + 1.5); h.z = ARV.z + dz / d * (R_ARV + 1.5); } }
  else { h.x = Math.max(OX - 48, Math.min(OX + 48, h.x)); h.z = Math.max(-58, Math.min(30, h.z)); }
}
function moverHeroi(dt) {
  const h = K.heroi; let jx = h.morto ? 0 : K.joy?.dx || 0, jy = h.morto ? 0 : K.joy?.dy || 0;
  if (teclas.has('KeyA') || teclas.has('ArrowLeft')) jx -= 1; if (teclas.has('KeyD') || teclas.has('ArrowRight')) jx += 1; if (teclas.has('KeyW') || teclas.has('ArrowUp')) jy -= 1; if (teclas.has('KeyS') || teclas.has('ArrowDown')) jy += 1;
  if (teclas.has('KeyQ')) K.yaw += dt * 2; if (teclas.has('KeyE')) K.yaw -= dt * 2;
  const m = Math.hypot(jx, jy); if (m > 1) { jx /= m; jy /= m; }
  const sy = Math.sin(K.yaw), cy = Math.cos(K.yaw), vel = 11 * (1 + 0.15 * bnv('pressa')) * (1 + 0.03 * K.esp.length), vx = (-cy * jx + sy * -jy) * vel, vz = (sy * jx + cy * -jy) * vel;
  h.anda = m > 0.15 && !h.dash; if (h.anda) { tut('andar'); h.x += vx * dt; h.z += vz * dt; limitar(h); h.dir = Math.atan2(vx, vz);
    if (m > 0.3 && performance.now() - (K.camManual || 0) > 1500) { let d = h.dir - K.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < 2.2) K.yaw += d * Math.min(1, dt * 1.8); } } // a câmera vira devagar para onde o herói anda
  else if (h.alvoDir != null && !h.dash && !(h.gT > -0.3)) h.dir = h.alvoDir;
  if (h.dash) { h.x += h.dash.vx * dt; h.z += h.dash.vz * dt; limitar(h); if ((h.dash.t -= dt) <= 0) h.dash = null; }
  for (const k of ['gT', 'dsT', 'invT']) if (h[k] > -1) h[k] -= dt;
  h.tiroT += dt; K.v.mixer.update(dt); K.v.raiz.position.set(h.x, 0, h.z); K.v.raiz.rotation.y = h.dir;
  const an = h.morto || h.gT > -0.3 || h.dash ? null : h.anda ? 'Running_A' : h.tiroT < 0.5 ? null : K.v.tem(K.H.pose) ? K.H.pose : 'Idle_A'; if (an && K.anim !== an) { K.anim = an; K.v.tocar(an); }
}
const GEO_ARO = new THREE.RingGeometry(1.1, 1.6, 32).rotateX(-Math.PI / 2), matAro = {}, aroDe = r => matAro[r] ||= new THREE.MeshBasicMaterial({ color: EQ.RARIDADES[r].cor, transparent: true, opacity: 0.7, depthWrite: false });
function aro(o, r, x, z, vis) { if (r == null || r < 1) return o; if (!o) { o = new THREE.Mesh(GEO_ARO, aroDe(r)); cn().add(o); } o.material = aroDe(r); o.position.set(x, 0.15, z); o.visible = vis; o.scale.setScalar(1 + 0.08 * Math.sin(C.tempo() * 4)); return o; }
const visCurto = v => Object.fromEntries(['tro', 'bra', 'per', 'cha', 'mas', 'capa', 'tinta', 'tintaCha', 'tintaCapa', 'aura', 'asas', 'arma', 'esq'].filter(k => v[k] != null).map(k => [k, v[k]]));
function outrosHerois(dt) {
  K.aroEu = aro(K.aroEu, K.rarEq, K.heroi.x, K.heroi.z, !K.heroi.morto);
  for (const [pid, j] of K.jogs) {
    j.aro = aro(j.aro, j.rr, j.x, j.z, true);
    if (performance.now() - (j.visto || 0) > 7000) { j.v?.remover(); if (j.aro) cn().remove(j.aro); K.jogs.delete(pid); if (K.host) toast(`${j.nome} ${tr('saiu')}`); continue; }
    if (!j.v) { j.v = C.heroi({ ...(HEROIS[j.h] || HEROIS.lyra).visual, ...(j.vs || {}) }); j.v.raiz.scale.setScalar(0.8); j.x = j.tx ?? OX; j.z = j.tz ?? 22; }
    const ox = j.x, oz = j.z; j.x += ((j.tx ?? j.x) - j.x) * Math.min(1, dt * 10); j.z += ((j.tz ?? j.z) - j.z) * Math.min(1, dt * 10);
    const anda = Math.hypot(j.x - ox, j.z - oz) > dt * 1.5; j.v.mixer.update(dt); j.v.raiz.position.set(j.x, 0, j.z); j.v.raiz.rotation.y = j.r ?? 0;
    if (j.atira != null) { const u = K.mobs.find(m => m.id === j.atira && !m.morto); if (u) disparo(j.x, j.z, u, (HEROIS[j.h] || HEROIS.lyra).ataque.cor, 0, { forma: /flecha|virote|adaga/.test((HEROIS[j.h] || HEROIS.lyra).ataque.proj) ? 'flecha' : 'orbe', grande: true }); j.atira = null; j.tiroT = 0;
      const H = HEROIS[j.h] || HEROIS.lyra; if (!anda && j.v.tem(H.tiro)) { j.v.tocar(H.tiro, { loop: false, reinicia: true, vel: 1.6 }); j.anim = 'tiro'; } }
    j.tiroT = (j.tiroT || 9) + dt; if (j.caido && j.anim !== 'morto' && j.v.tem('Death')) { j.v.tocar('Death', { loop: false }); j.anim = 'morto'; } const an = j.caido ? null : anda ? 'Running_A' : j.tiroT < 0.5 ? null : 'Idle_A'; if (an && j.anim !== an) { j.anim = an; j.v.tocar(an); }
  }
}
function alvoPerto(x, z, alc) { let m = null, ms = -1; for (const u of K.mobs) { if (u.morto || Math.hypot(u.x - x, u.z - z) > alc) continue; if (u.s > ms) { ms = u.s; m = u; } } return m; }
function heroiAtira(dt) {
  const h = K.heroi; if ((h.cd -= dt) > 0 || K.estado === 'fim' || h.morto || h.dash) return; let a = null, dm = K.perto ? ALC_PERTO : h.alc;
  for (const u of K.mobs) { if (u.morto) continue; const d = Math.hypot(u.x - h.x, u.z - h.z); if (d < dm) { dm = d; a = u; } }
  if (!a) { h.alvoDir = null; return; } h.cd = h.cad / (1 + 0.15 * bnv('pressa')) / (1 + 0.03 * K.esp.length); h.alvoDir = Math.atan2(a.x - h.x, a.z - h.z); h.tiroT = 0; if (!K.perto) K.atirou = a.id;
  const at = K.animTiro || K.H.tiro; if (!h.anda && K.v.tem(at)) { K.v.tocar(at, { loop: false, reinicia: true, vel: 1.6 }); K.anim = 'tiro'; } if (Math.random() < 0.35) sfx(K.arma?.tipo === 'corte' ? 'espada' : 'arco');
  const crit = Math.random() * 100 < K.eqA.crit; if (crit) K.txt.push({ x: h.x, y: 4.5, z: h.z, txt: tr('CRÍTICO!'), cor: '#ff9a1a', t: 0 });
  let d = h.dano * (1 + 0.25 * bnv('furia')) * (crit ? 2.2 : 1) * multEsp(), lenda = K.arma?.lenda;
  if (lenda === 'celeste') { K.serie = performance.now() - (K.serieT || 0) < 2000 ? Math.min(10, (K.serie || 0) + 1) : 1; K.serieT = performance.now(); d *= 1 + 0.05 * K.serie; }
  if (lenda === 'sombra' && Math.random() < 0.15) { d *= 3; K.txt.push({ x: h.x, y: 5, z: h.z, txt: tr('TRIPLO!'), cor: '#c89aff', t: 0 }); }
  if (K.perto) { const cor = crit ? 0xff9a1a : K.arma.cor ?? 0xffffff; C.arco(h.x, h.z, h.alvoDir, ALC_PERTO, 150, cor); if (K.arma.r >= 4) C.arco(h.x, h.z, h.alvoDir, ALC_PERTO * 0.78, 150, 0xffffff); acertar({ dano: d * 1.6 * (costas(a) ? 1.8 : 1), cor, op: { area: K.arma.tipo === 'martelo' ? 2 : 1.3, pid: K.eu, lenda, brilho: K.arma.r >= 4 } }, a); empurrar(a, 0.8); K.hitStop = 0.035;
    K.canal?.enviar('gp', { p: K.eu, c: 0, x: Math.round(h.x * 10) / 10, z: Math.round(h.z * 10) / 10, r: Math.round(h.alvoDir * 100) / 100, k: cor }); return; }
  const forma = K.arma ? { corte: 'corte', martelo: 'orbe', cajado: 'orbe', arco: 'flecha' }[K.arma.tipo] : h.forma;
  disparo(h.x, h.z, a, crit ? 0xff9a1a : K.arma?.cor ?? h.cor, d, { area: h.area + (K.arma?.tipo === 'martelo' ? 1.5 : 0), perf: h.perf, pid: K.eu, forma, grande: true, lenda, brilho: K.arma?.r >= 4 });
}
function torresAtiram(dt) {
  if (K.estado === 'fim') return; const mult = 1.1 ** Math.max(0, K.onda - 1);
  for (const t of K.torres.values()) { if ((t.cd -= dt) > 0) continue; const T = TORRES[t.tipo], R = t.ramo ? RAMOS[t.tipo][t.ramo] : {}, alc = T.alc * (1 + 0.1 * (t.nv - 1)), a = alvoPerto(t.x, t.z, alc); if (!a) continue; t.cd = T.cad * (R.cad || 1);
    if (t.topo) t.topo.rotation.y = Math.atan2(t.z - a.z, a.x - t.x); if (t.tipo === 'can') som('pancada', 0.25);
    const alvos = R.multi ? [a, ...K.mobs.filter(u => u !== a && !u.morto && Math.hypot(u.x - t.x, u.z - t.z) < alc).slice(0, R.multi - 1)] : [a];
    for (const u of alvos) disparo(t.x, t.z, u, T.cor, K.host ? T.dano * NV_DANO[t.nv - 1] * mult * (R.dano || 1) : 0, { area: T.area && T.area * (R.area || 1), lento: T.lento && T.lento * (R.lento || 1), perf: R.perf, pid: null, torre: t, y: 6.5, forma: t.tipo === 'arq' ? 'flecha' : t.tipo === 'can' ? 'bala' : 'raio' }); }
}
function disparo(x, z, a, cor, dano, op) {
  const y = op?.y ?? 2.4, forma = op?.forma || 'orbe';
  if (forma === 'raio') { const ty = a.y + a.alt * 0.5, d = Math.hypot(a.x - x, ty - y, a.z - z), o = new THREE.Mesh(GEO_RAIO, matTiro(cor)); o.scale.set(0.3, 0.3, d); o.position.set((x + a.x) / 2, (y + ty) / 2, (z + a.z) / 2); o.lookAt(a.x, ty, a.z); cn().add(o);
    K.raios.push({ o, t: 0.14 }); if (dano > 0 || !K.host) acertar({ cor, dano, op }, a); else C.impacto(a.x, ty, a.z, cor, 0.5); return; }
  const o = new THREE.Mesh(forma === 'flecha' ? GEO_FLECHA : forma === 'bala' ? GEO_BALA : forma === 'corte' ? GEO_CORTE : GEO_TIRO, matTiro(forma === 'bala' ? 0x3a3a3a : cor)); o.position.set(x, y, z); if (forma === 'orbe' && op?.grande) o.scale.setScalar(1.6); cn().add(o);
  K.tiros.push({ o, a, x, y, z, x0: x, y0: y, z0: z, k: 0, cor, dano, op, forma });
}
function passoTiros(dt) {
  for (const r of K.raios) if ((r.t -= dt) <= 0) { r.fim = true; cn().remove(r.o); } K.raios = K.raios.filter(r => !r.fim);
  for (const s of K.tiros) { const a = s.a, ty = a.y + a.alt * 0.5;
    if (s.forma === 'bala') { // bala de canhão: arco até onde o alvo está
      s.dur ??= Math.max(0.5, Math.hypot(a.x - s.x0, a.z - s.z0) / 26); s.k += dt / s.dur; const k = Math.min(1, s.k);
      s.x = s.x0 + (a.x - s.x0) * k; s.z = s.z0 + (a.z - s.z0) * k; s.y = s.y0 + (ty - s.y0) * k + Math.sin(Math.PI * k) * 7; s.o.position.set(s.x, s.y, s.z);
      if (k >= 1) { s.fim = true; cn().remove(s.o); C.onda(a.x, a.z, (s.op.area || 3) * 1.6, 0xff7a2a, 0.35); C.faiscas(a.x, 1, a.z, 0xff9a3a, 14, 6); if (s.dano > 0 || !K.host) acertar(s, a); }
      continue; }
    const dx = a.x - s.x, dy = ty - s.y, dz = a.z - s.z, d = Math.hypot(dx, dy, dz), p = 55 * dt;
    if (s.forma === 'flecha' || s.forma === 'corte') s.o.lookAt(a.x, ty, a.z);
    if (d <= p && s.naArvore != null) { s.fim = true; cn().remove(s.o); C.impacto(s.x, s.y, s.z, 0xff7a4a, 0.6); if (K.host) K.base -= s.naArvore; continue; }
    if (d <= p || a.morto) { s.fim = true; cn().remove(s.o); if (!a.morto && (s.dano > 0)) acertar(s, a); else if (!a.morto) C.impacto(a.x, ty, a.z, s.cor, 0.35); continue; }
    s.x += dx / d * p; s.y += dy / d * p; s.z += dz / d * p; s.o.position.set(s.x, s.y, s.z); }
  K.tiros = K.tiros.filter(s => !s.fim);
}
function acertar(s, a) { // o dano conta no anfitrião; o cliente mostra na hora e manda para ele
  if (!(s.dano > 0)) { C.impacto(a.x, a.y + a.alt * 0.5, a.z, s.cor, 0.4); return; }
  const op = s.op || {}, pid = op.pid ?? (op.torre ? 'torre' : null), alvos = [a];
  if (op.area) for (const u of K.mobs) if (u !== a && !u.morto && Math.hypot(u.x - a.x, u.z - a.z) < op.area * 1.5) alvos.push(u);
  for (let k = 0, ult = a; k < (op.perf || 0); k++) { const n = K.mobs.find(u => !u.morto && !alvos.includes(u) && Math.hypot(u.x - ult.x, u.z - ult.z) < 6); if (!n) break; alvos.push(n); ult = n; }
  if (pid === K.eu && K.eqA.roubo && !K.heroi.morto) K.heroi.hp = Math.min(K.heroi.hpMax, K.heroi.hp + s.dano * K.eqA.roubo / 100);
  if (pid === K.eu && op.lenda) efeitoLenda(op.lenda, a, s.dano);
  for (const u of alvos) { const d = u === a ? s.dano : s.dano * 0.6; if (op.lento) u.lentoT = op.lento;
    if (K.host) ferir(u, d, pid === 'torre' ? K.eu : pid); else { u.hp -= d; u.flash = 0.12; K.meus.set(u.id, performance.now()); K.danos.push([u.id, Math.round(d * 10) / 10]); if (u.v) K.txt.push({ x: u.x, y: u.y + u.alt + 1, z: u.z, txt: fmt(Math.round(d)), cor: '#fff', t: 0 }); } }
  C.impacto(a.x, a.y + a.alt * 0.5, a.z, s.cor, op.area ? 1 : 0.5); if (op.brilho) C.faiscas(a.x, a.y + a.alt * 0.6, a.z, s.cor, 8, 5); // armas Lendárias e Míticas soltam faíscas
}
// ---- efeitos das armas únicas (só o dono calcula; o dano vai para o anfitrião como os outros) ----
function danoEm(u, d) { if (u.morto) return; if (K.host) ferir(u, d, K.eu); else { u.hp -= d; u.flash = 0.12; K.meus.set(u.id, performance.now()); K.danos.push([u.id, Math.round(d * 10) / 10]); } }
function raio(a, b, cor) { const ty = 2, d = Math.hypot(b.x - a.x, b.z - a.z), o = new THREE.Mesh(GEO_RAIO, matTiro(cor)); o.scale.set(0.25, 0.25, d); o.position.set((a.x + b.x) / 2, ty, (a.z + b.z) / 2); o.lookAt(b.x, ty, b.z); cn().add(o); K.raios.push({ o, t: 0.18 }); }
function efeitoLenda(k, a, dano) {
  const L = EQ.LENDAS[k], vivos = () => K.mobs.filter(u => !u.morto && u !== a);
  if (k === 'fenda' && (K.golpes = (K.golpes || 0) + 1) % 6 === 0) { C.onda(a.x, a.z, 7, L.cor, 0.6); C.onda(a.x, a.z, 4, 0xffffff, 0.4); C.faiscas(a.x, 2, a.z, L.cor, 30, 8); som('pancada');
    K.txt.push({ x: a.x, y: 5, z: a.z, txt: tr('FENDA!'), cor: '#c89aff', t: 0 }); for (const u of K.mobs) if (!u.morto && Math.hypot(u.x - a.x, u.z - a.z) < 6) danoEm(u, dano * 3); }
  if (k === 'trovao' && Math.random() < 0.25) { let ult = a; for (const u of vivos().sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z)).slice(0, 3)) { if (Math.hypot(u.x - ult.x, u.z - ult.z) > 10) break; raio(ult, u, L.cor); danoEm(u, dano * 0.7); ult = u; } }
  if (k === 'solar') (K.queimas ||= []).push({ u: a, t: 3, d: dano * 0.3, cd: 1 });
  if (k === 'glacial') { a.lentoT = 2; if (Math.random() < 0.15) { a.lentoT = 3.5; K.txt.push({ x: a.x, y: 4, z: a.z, txt: tr('CONGELOU!'), cor: '#9ae8ff', t: 0 }); C.faiscas(a.x, 1.5, a.z, 0x9ae8ff, 14, 3); } }
  if (k === 'sangue' && !K.heroi.morto) K.heroi.hp = Math.min(K.heroi.hpMax, K.heroi.hp + dano * 0.05);
  if (k === 'vulcao' && Math.random() < 0.2) { C.onda(a.x, a.z, 5, L.cor, 0.4); C.faiscas(a.x, 1, a.z, 0xff7a2a, 20, 7); for (const u of vivos()) if (Math.hypot(u.x - a.x, u.z - a.z) < 4.5) danoEm(u, dano * 1.2); }
}
function passoQueimas(dt) { if (!K.queimas?.length) return; for (const q of K.queimas) { q.t -= dt; if ((q.cd -= dt) <= 0) { q.cd = 1; danoEm(q.u, q.d); C.faiscas(q.u.x, 1.5, q.u.z, 0xff7a2a, 5, 2); } } K.queimas = K.queimas.filter(q => q.t > 0 && !q.u.morto); }
function simular(dt) {
  if (K.estado === 'pausa') { if ((K.pausaT -= dt) <= 0) { K.onda++; K.fila = montarOnda(K.onda, K.modo); K.t = 0; K.estado = 'onda'; bannerOnda(); } return; }
  if (K.estado === 'buff') { K.buffT -= dt; if (K.circ && Math.max(...K.circ.map(c => c.n)) >= 1 + K.jogs.size) K.buffT = Math.min(K.buffT, 2.5); if (K.buffT <= 0) { if (K.circ) decidirBuff(); else { K.estado = 'pausa'; K.pausaT = 4; } } return; } // todos no mesmo círculo: decide em 2,5s
  K.t += dt; while (K.fila.length && K.fila[0].t <= K.t) K.mobs.push(criarMob(K.fila.shift().tipo, K.onda));
  for (const u of K.mobs) { if (u.morto) continue;
    if (u.tipo === 'xama' && (u.curaT = (u.curaT ?? 3) - dt) <= 0) { u.curaT = 3; C.onda(u.x, u.z, 8, 0x6aff8a, 0.5); for (const o of K.mobs) if (!o.morto && o !== u && Math.hypot(o.x - u.x, o.z - u.z) < 8) o.hp = Math.min(o.max, o.hp + o.max * 0.2); }
    if (K.modo === 'arvore') { passoMobArvore(u, dt); if (u.tipo === 'chefe') passoChefe(u, dt); continue; }
    u.s += u.vel * dt * (u.lentoT > 0 ? 0.5 : 1);
    if (u.tipo === 'chefe' && !u.chamou && u.hp < u.max * 0.5) { u.chamou = true; for (let i = 0; i < 6; i++) { const m = criarMob('orc', K.onda); m.s = Math.max(0, u.s - 2 - i); K.mobs.push(m); } K.banner = { txt: 'O CHEFE CHAMOU REFORÇOS!', cor: '#ff6a5a', t: 0 }; }
    if (u.s >= LCAM) { K.base -= TIPOS[u.tipo].base; u.morto = true; u.tm = 2; if (u.v) u.v.raiz.visible = false; C.faiscas(OX, 4, 30, 0xff5a4a, 20, 5); C.camera.tremor = 0.4; som('pancada'); } }
  if (!K.fila.length && !K.mobs.some(u => !u.morto)) { K.estado = 'pausa'; K.pausaT = 8; if (K.modo === 'arvore' && K.onda % 3 === 0) abrirBuffs(); const bonus = (30 + 5 * K.onda) * (1 + K.jogs.size); K.cofre += bonus; sfx('brilho'); K.banner = { txt: `+${bonus} ${tr('moedas')}`, cor: '#ffd84a', t: 0 }; intensidade(1); }
  if (K.base <= 0) { const p = { onda: K.onda, ab: Object.entries(K.abates) }; K.canal?.enviar('fim', p); setTimeout(() => K?.canal?.enviar('fim', p), 600); acabar(p); }
}
// ---- Árvore Sagrada: ataques na árvore, poderes do time, guardiões e vida do herói ----
const multAtk = () => 1 + 0.06 * K.onda;
function alvosHerois() { const l = [K.heroi.morto ? null : K.heroi, ...[...K.jogs.values()].filter(j => j.x != null && !j.caido), ...(K.bots || []).filter(b => !b.morto)]; return l.filter(Boolean); }
function passoMobArvore(u, dt) {
  const T = TIPOS[u.tipo], perto = u.s > u.L - 9, nr = bnv('raizes');
  if (!T.longe && u.tipo !== 'sabotador' && u.tipo !== 'chefe' && (u.lutaT = (u.lutaT || 0) - dt) <= 0) { // herói por perto: o inimigo sai da trilha e vai brigar com ele
    let alvo = null, dm = 8; for (const h of alvosHerois()) { const d = Math.hypot(h.x - u.x, h.z - u.z) - (ehGuerreiro(h) ? 5 : 0); if (d < dm) { dm = d; alvo = h; } } if (alvo) dm = Math.hypot(alvo.x - u.x, alvo.z - u.z);
    if (alvo) { const P = PORTAS[u.porta], dx = ARV.x - P.x, dz = ARV.z - P.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d, rx = alvo.x - P.x, rz = alvo.z - P.z, sAlvo = rx * ux + rz * uz, oAlvo = -rx * uz + rz * ux, v = u.vel * dt * (u.lentoT > 0 ? 0.5 : 1);
      if (dm > 1.9) { u.s += Math.max(-v, Math.min(v, sAlvo - 1.2 - u.s)); u.off += Math.max(-v, Math.min(v, oAlvo - u.off)); u.s = Math.max(0, Math.min(u.L, u.s)); } return; } }
  if (u.s < u.L) { u.s = Math.min(u.L, u.s + u.vel * dt * (u.lentoT > 0 ? 0.5 : 1) * (perto && nr ? 0.6 : 1)); }
  else if (u.tipo === 'sabotador') { K.base -= T.atk * multAtk(); u.morto = true; u.tm = 2; if (u.v) u.v.raiz.visible = false; C.faiscas(u.x, 2, u.z, 0x9aff3a, 40, 9); C.onda(u.x, u.z, 6, 0x9aff3a, 0.4); som('pancada'); return; }
  else if (T.longe) { if (T.atk && (u.cdA -= dt) <= 0) { u.cdA = 1.6; tiroNaArvore(u, T.atk * multAtk() * Math.max(0, 1 - 0.3 * bnv('escudo'))); } }
  else { K.base -= T.atk * multAtk() * dt; u.batendo = true; }
  if ((u.cdR = (u.cdR || 0) - dt) <= 0) { u.cdR = 1; const ne = bnv('espinhos'), m = 1.12 ** Math.max(0, K.onda - 1);
    if (nr && perto) ferir(u, 1.5 * nr * m, K.eu); if (ne && u.batendo && !u.morto) ferir(u, 2.5 * ne * m, K.eu); }
}
const ALVO_ARV = { x: ARV.x, z: ARV.z, y: 0, alt: 9, morto: false };
function tiroNaArvore(u, dano) { const o = new THREE.Mesh(GEO_FLECHA, matTiro(0xff5a3a)); o.position.set(u.x, 2.4, u.z); cn().add(o); K.tiros.push({ o, a: ALVO_ARV, x: u.x, y: 2.4, z: u.z, cor: 0xff5a3a, dano: 0, op: {}, forma: 'flecha', naArvore: dano }); }
function levantar(f, naArvore) {
  const h = K.heroi; h.morto = false; h.revT = 0; h.hp = h.hpMax * f; if (naArvore) { h.x = ARV.x; h.z = ARV.z + 9; } K.v.raiz.visible = true; K.anim = ''; K.v.tocar('Idle_A');
  toast(tr(naArvore ? 'Você voltou!' : 'Te levantaram!')); sfx('brilho'); C.onda(h.x, h.z, 4, 0x6aff8a, 0.4);
}
function passoArvore(dt) { // vale para todos: herói apanha, cura, renasce; guardiões e efeitos
  const h = K.heroi, mult = multAtk();
  if (h.morto) { // caído: um amigo (ou aliado) parado do lado por 2,5s levanta você; senão volta na árvore depois de 10s
    const perto = [...K.jogs.values()].some(j => !j.caido && j.x != null && Math.hypot(j.x - h.x, j.z - h.z) < 3) || (K.bots || []).some(b => !b.morto && Math.hypot(b.x - h.x, b.z - h.z) < 3);
    h.revT = perto ? (h.revT || 0) + dt : Math.max(0, (h.revT || 0) - dt);
    if (h.revT >= 2.5) levantar(0.4, false); else if ((h.mortoT -= dt) <= 0) levantar(1, true); }
  else { let dano = 0; for (const u of K.mobs) if (!u.morto && !TIPOS[u.tipo].longe && Math.hypot(u.x - h.x, u.z - h.z) < 2.6) dano += TIPOS[u.tipo].atk * 0.6; 
    if (dano && h.invT > 0) dano = 0;
    if (dano) { h.hp -= dano * mult * dt * (1 - K.eqA.def / 100) * (EQ.classeAtual() === 'guerreiro' ? 0.75 : 1); h.dor = (h.dor || 0) + dt; if (h.dor > 0.4) { h.dor = 0; K.v.brilho(0.5); setTimeout(() => K?.v.brilho(0), 90); } }
    const nc = bnv('cura'); if (nc && Math.hypot(h.x - ARV.x, h.z - ARV.z) < 13) h.hp = Math.min(h.hpMax, h.hp + 6 * nc * dt);
    if (K.eqA.cura) h.hp = Math.min(h.hpMax, h.hp + K.eqA.cura * dt);
    if (h.hp <= 0) { h.morto = true; h.mortoT = 10; h.revT = 0; if (K.v.tem('Death')) { K.v.tocar('Death', { loop: false }); K.anim = 'morto'; } C.faiscas(h.x, 2, h.z, 0xff5a4a, 30, 6); som('pancada'); toast(tr('Você caiu! Um amigo pode te levantar')); } }
  if (K.host && bnv('cura')) K.base = Math.min(K.baseMax, K.base + K.baseMax * 0.004 * bnv('cura') * dt);
  // guardiões nascidos da árvore
  const n = 3 * bnv('guardioes'); while (K.guardas.length < n) { const i = K.guardas.length, a = i * 2.39996; K.guardas.push({ x: ARV.x + Math.sin(a) * 8.5, z: ARV.z + Math.cos(a) * 8.5, ph: i * 1.3, ry: a, tipo: i % 3 === 2 ? 'lanca' : 'az', cd: Math.random() }); }
  for (const g of K.guardas) { let alvo = null, dm = 11; for (const u of K.mobs) { if (u.morto) continue; const d = Math.hypot(u.x - g.x, u.z - g.z); if (d < dm) { dm = d; alvo = u; } }
    g.luta = !!alvo; if (alvo) { g.ry = Math.atan2(alvo.x - g.x, alvo.z - g.z); if ((g.cd -= dt) <= 0) { g.cd = 0.9; C.faiscas(alvo.x, 1.5, alvo.z, 0x8ac8ff, 3, 2); if (K.host) ferir(alvo, 2 * 1.13 ** Math.max(0, K.onda - 1), K.eu); } } }
  if (K.guardas.length) desenharTropas('az', K.guardas, 0, C.tempo());
}
function aplicarBuffsVisuais() {
  const mk = (k, geo, cor, op) => { if (!K.vis) K.vis = {}; if (!K.vis[k]) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide })); m.position.set(ARV.x, 0.3, ARV.z); cn().add(m); K.vis[k] = m; } return K.vis[k]; };
  if (bnv('escudo')) { const d = mk('escudo', new THREE.SphereGeometry(8, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), 0x6ad8ff, 0.12 + 0.04 * bnv('escudo')); d.position.y = 0; }
  if (bnv('cura')) mk('cura', new THREE.RingGeometry(12.4, 13, 64).rotateX(-Math.PI / 2), 0x6aff8a, 0.6);
  if (bnv('raizes')) mk('raizes', new THREE.RingGeometry(R_ARV + 2, 14, 64).rotateX(-Math.PI / 2), 0x6a4a1a, 0.25);
}
// escolha do poder no chão: 3 círculos na frente da árvore; quem pisa vota, o círculo com mais heróis vence (todos num só: decide na hora)
const GEO_CIRC = new THREE.RingGeometry(2.6, 3.2, 40).rotateX(-Math.PI / 2), GEO_LUZ = new THREE.CylinderGeometry(3, 3, 7, 24, 1, true).translate(0, 3.5, 0), CORES_BUFF = [0x7affea, 0xffd84a, 0xff8ae0];
const posCirculo = i => [ARV.x + (i - 1) * 9, ARV.z + 15];
function abrirBuffs() { K.estado = 'buff'; K.buffT = 15; K.buffOnda = K.onda; K.escolheram = new Set(); K.cartas = Object.keys(BUFFS).filter(k => bnv(k) < 5).sort(() => Math.random() - 0.5).slice(0, 3); montarCirculos(); K.banner = { txt: 'ESCOLHAM UM PODER!', cor: '#7affea', t: 0 }; }
function montarCirculos() {
  limparCirculos(); sfx('brilho');
  K.circ = K.cartas.map((k, i) => { const [x, z] = posCirculo(i), g = new THREE.Group(), cor = CORES_BUFF[i];
    g.add(new THREE.Mesh(GEO_CIRC, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.85, depthWrite: false })), new THREE.Mesh(GEO_LUZ, new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })));
    g.position.set(x, 0.2, z); cn().add(g); C.onda(x, z, 4, cor, 0.5); return { k, x, z, g, n: 0 }; });
}
function limparCirculos() { for (const c of K.circ || []) { cn().remove(c.g); c.g.traverse(o => o.material?.dispose()); } K.circ = null; }
function passoCirculos() {
  if (!K.circ) return; const quem = [K.heroi, ...K.jogs.values()].filter(h => !h.morto && h.x != null), t = C.tempo();
  for (const c of K.circ) { if (K.host) c.n = quem.filter(h => Math.hypot(h.x - c.x, h.z - c.z) < 3.2).length; c.g.scale.setScalar(1 + (c.n ? 0.12 : 0) + 0.04 * Math.sin(t * 4)); c.g.children[1].material.opacity = c.n ? 0.32 : 0.16; }
  const meu = K.circ.find(c => Math.hypot(K.heroi.x - c.x, K.heroi.z - c.z) < 3.2); if (meu && K.meuCirc !== meu.k) { K.meuCirc = meu.k; som('confirma'); } else if (!meu) K.meuCirc = null;
}
function decidirBuff() {
  const max = Math.max(...K.circ.map(c => c.n)), l = K.circ.filter(c => c.n === max), c = l[Math.floor(Math.random() * l.length)];
  aplicarBuff(c.k, 'time', tr('Time')); C.onda(c.x, c.z, 10, 0xffffff, 0.6); C.faiscas(c.x, 2, c.z, 0xffd84a, 30, 7); sfx('vitoria'); K.banner = { txt: `${tr(BUFFS[c.k].nome)}!`.toUpperCase(), cor: '#ffd84a', t: 0 };
  K.estado = 'pausa'; K.pausaT = 4; limparCirculos();
}
function fecharBuffs() { limparCirculos(); K.cartas = null; }
function aplicarBuff(k, pid, nome) {
  if (!BUFFS[k] || K.escolheram?.has(pid)) return; K.escolheram?.add(pid); K.buffs[k] = bnv(k) + 1;
  if (k === 'seiva') { K.baseMax = Math.round(K.baseMax * 1.25); K.base = Math.min(K.baseMax, K.base + K.baseMax * 0.4); }
  aplicarBuffsVisuais(); K.canal?.enviar('bfx', { n: nome, k }); toast(`${tr(BUFFS[k].nome)}: ${tr(BUFFS[k].desc)}`);
}

function acabar(p) {
  if (!K || K.estado === 'fim') return; K.estado = 'fim'; const ondas = Math.max(0, (p.onda ?? K.onda) - 1), ab = p.ab ? Object.fromEntries(p.ab)[K.eu] || 0 : K.abates[K.eu] || 0;
  A.partida(K.modo === 'arvore' ? 'arvore' : 'defesa', ondas, null, { abates: ab, jogadores: 1 + K.jogs.size });
  evento('grupo'); if (K.modo === 'arvore') evento('arvoreOndas', ondas); if (ondas > 0 && S.online?.codigo) ON.claDano(Math.round(ondas * Math.max(1, S.melhor || 1) * 8)).catch(() => {}); // tudo ajuda o clã
  if (K.modo === 'arvore' && ondas > 0) ON.arvoreEnviar(ondas, [K.eu, ...K.jogs.keys()].map(String)).catch(() => {}); // ranking semanal da Árvore (por grupo)
  const premio = Math.round((20 + 14 * ondas + ab * 0.5) * (fimDeSemana() ? 2 : 1)); S.moedas += premio; const est = EQ.estrelasPartida(ondas); EQ.ganharEstrelas(est);
  const itens = [...(K.itensChefe || [])]; for (let i = 0, n = ondas >= 2 ? Math.min(4, 1 + Math.floor(ondas / (K.modo === 'arvore' ? 4 : 6))) : 0; i < n; i++) itens.push(EQ.gerarItem(ondas)); S.defesa ||= { rec: 0 }; const rk = K.modo === 'arvore' ? 'arv' : 'rec', novo = ondas > (S.defesa[rk] || 0); if (novo) S.defesa[rk] = ondas; salvar();
  sfx(novo ? 'vitoria' : 'derrota'); C.camera.tremor = 1; K.banner = p.saiu ? null : { txt: K.modo === 'arvore' ? 'A ÁRVORE CAIU!' : 'O CASTELO CAIU!', cor: '#ff6a5a', t: 0 };
  setTimeout(() => { if (!K || !el) return; const j = $('#dfJanela'); j.hidden = false;
    j.innerHTML = `<div class="cqFim ${novo ? 'vit' : 'der'}"><h2>${p.host ? tr('O anfitrião saiu') : novo ? tr('NOVO RECORDE!') : tr(K.modo === 'arvore' ? 'A árvore caiu!' : 'O castelo caiu!')}</h2><p>${ondas} ${tr(ondas === 1 ? 'onda' : 'ondas')} · ${ab} ${tr('inimigos derrotados')}${K.jogs.size ? ` · ${1 + K.jogs.size} ${tr('jogadores')}` : ''}</p>
      <div class="ganho">${ico('ouro')}<b>+${fmt(premio)}</b>${est ? `<b class="dsGanho">${ico('estrela')} +${est}</b>` : ''}</div>
      ${itens.length ? `<div class="eqGanhos"><small>${tr('Equipamentos ganhos')}</small><div>${itens.map(it => EQ.itemHtml(it, 'novo')).join('')}</div></div>` : `<p class="eqDica">${tr('Passe da onda 2 para ganhar equipamentos!')}</p>`}<p>${tr('Recorde')}: ${S.defesa[rk] || 0} ${tr('ondas')}</p>
      <button class="btn verde grande" data-df="denovo">${tr('Jogar de novo')}</button><button class="btn azul" data-df="menuFim">${ico('guilda')} Menu</button></div>`;
    if (novo) flashTela('#ffe27a', 0.45); setTimeout(() => voarMoedas('#dfJanela .ganho', 8), 120);
    const bom = itens.filter(EQ.melhorQueEquipado).sort((x, y) => EQ.poderItem(y) - EQ.poderItem(x))[0]; if (bom) setTimeout(() => { if (K && $('#janela').hidden) EQ.novoItem(bom); }, 1600); }, p.saiu ? 100 : 1400);
}
export function vista() {
  const h = K?.heroi || { x: OX, z: 0 }, y = K?.yaw ?? Math.PI, foco = { x: h.x + Math.sin(y) * 10, z: h.z + Math.cos(y) * 10 }; let dist = 38;
  if (K?.modo === 'arvore') { // terceira pessoa de perto, atrás do herói (como nos jogos de ação)
    const f = { x: h.x + Math.sin(y) * 2.5, z: h.z + Math.cos(y) * 2.5 }; return { foco: f, yaw: y, pitch: 0.42, dist: 13, altura: 1.6 }; }
  return { foco: { x: h.x + Math.sin(y) * 6, z: h.z + Math.cos(y) * 6 }, yaw: y, pitch: 0.5, dist: 24, altura: 1.2 };
}
// ícone do jogo desenhado no canvas (no lugar de emoji)
const imgsIco = new Map();
function desenharIco(g, n, x, y, tam, cor) {
  const k = n + cor; let im = imgsIco.get(k);
  if (!im) { im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="color:${cor}"><g style="filter:drop-shadow(0 0 18px #000)">${ICONES[n] || ''}</g></svg>`); imgsIco.set(k, im); }
  if (im.complete && im.naturalWidth) { g.save(); g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 4; g.drawImage(im, x - tam / 2, y - tam / 2, tam, tam); g.restore(); }
}
export function desenharFx(g, dt) {
  if (!K) return; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.65)';
  for (const u of K.mobs) { if (u.morto || (!u.v && u.hp >= u.max)) continue; const p = C.tela(u.x, u.y + u.alt + 0.6, u.z); if (!p) continue; const w = u.tipo === 'chefe' ? 80 : u.v ? 40 : 22;
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(p[0] - w / 2 - 1, p[1] - 1, w + 2, 6); g.fillStyle = u.tipo === 'chefe' ? '#ff4a3a' : '#e8803a'; g.fillRect(p[0] - w / 2, p[1], w * Math.max(0, u.hp) / u.max, 4); }
  for (const j of K.jogs.values()) { const p = C.tela(j.x, 3.2, j.z); if (!p) continue; g.font = '13px Titulo, sans-serif'; g.strokeText(j.nome, p[0], p[1]); g.fillStyle = '#9ad8ff'; g.fillText(j.nome, p[0], p[1]);
    if (j.g) { g.font = '11px Titulo, sans-serif'; const t = fmt(j.g); desenharIco(g, 'h_lamina', p[0] - 14, p[1] + 9, 12, '#ffffff'); g.strokeText(t, p[0] + 6, p[1] + 13); g.fillStyle = j.rr >= 0 ? EQ.RARIDADES[j.rr].cor : '#fff'; g.fillText(t, p[0] + 6, p[1] + 13); } }
  for (const c of K.circ || []) { const p = C.tela(c.x, 4.2, c.z); if (!p) continue; const B = BUFFS[c.k]; desenharIco(g, B.ic, p[0], p[1] - 6, 38, '#ffffff');
    g.font = '14px Titulo, sans-serif'; const nm = tr(B.nome); g.strokeText(nm, p[0], p[1] + 22); g.fillStyle = '#fff'; g.fillText(nm, p[0], p[1] + 22);
    g.font = '11px sans-serif'; const ds = tr(B.desc), pal = ds.split(' '), linhas = ['']; for (const w of pal) { if ((linhas[linhas.length - 1] + ' ' + w).length > 22 && linhas[linhas.length - 1]) linhas.push(w); else linhas[linhas.length - 1] = (linhas[linhas.length - 1] + ' ' + w).trim(); }
    linhas.slice(0, 3).forEach((l, i) => { const y = p[1] + 60 + i * 13; g.strokeText(l, p[0], y); g.fillStyle = '#d8fff6'; g.fillText(l, p[0], y); }); // explicação curta do poder
    const v = `${c.n}`; desenharIco(g, 'herois', p[0] - 12, p[1] + 37, 18, c.n ? '#7affea' : '#cccccc'); g.font = '16px Titulo, sans-serif'; g.strokeText(v, p[0] + 10, p[1] + 42); g.fillStyle = c.n ? '#7affea' : '#ccc'; g.fillText(v, p[0] + 10, p[1] + 42); }
  for (const u of K.mobs) if (u.marcaT > 0 && !u.morto) { const p = C.tela(u.x, (u.y || 0) + u.alt + 1.6, u.z); if (p) desenharIco(g, 'h_perfura', p[0], p[1], 20, '#ff5a4a'); }
  const caido = (x, z, rev) => { const p = C.tela(x, 2.6, z); if (!p) return; g.font = '13px Titulo, sans-serif'; const t = rev > 0 ? `${tr('Levantando')} ${Math.round(rev / 2.5 * 100)}%` : tr('Caído! Fique do lado para levantar'); g.strokeText(t, p[0], p[1]); g.fillStyle = '#ff9a8a'; g.fillText(t, p[0], p[1]); };
  for (const j of K.jogs.values()) if (j.caido) caido(j.x, j.z, 0); for (const b of K.bots || []) if (b.morto) caido(b.x, b.z, b.revT);
  for (const b of K.bots || []) { if (b.morto) continue; const p = C.tela(b.x, 3.2, b.z); if (!p) continue; g.font = '12px Titulo, sans-serif'; g.strokeText(b.nome, p[0], p[1]); g.fillStyle = '#a8f0b8'; g.fillText(b.nome, p[0], p[1]);
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(p[0] - 16, p[1] + 4, 32, 5); g.fillStyle = '#5ae06a'; g.fillRect(p[0] - 15, p[1] + 5, 30 * Math.max(0, b.hp / b.hpMax), 3); }
  { const p = C.tela(K.heroi.x, 3.2, K.heroi.z); if (p && (K.jogs.size || K.bots?.length)) { g.font = '13px Titulo, sans-serif'; g.strokeText(K.nome, p[0], p[1]); g.fillStyle = '#ffd84a'; g.fillText(K.nome, p[0], p[1]); } }
  // lugares de torre livres (perto do herói mostram o +)
  if (K.modo !== 'arvore') PADS.forEach(([x, z], i) => { if (K.torres.has(i)) { const t = K.torres.get(i), p = C.tela(t.x, 9, t.z); if (p) { g.font = '12px Titulo, sans-serif'; const s = '★'.repeat(t.nv); g.strokeText(s, p[0], p[1]); g.fillStyle = '#ffd84a'; g.fillText(s, p[0], p[1]); } return; }
    const p = C.tela(OX + x, 0.5, z); if (!p) return; const perto = i === K.padSel || (K.padSel == null && Math.hypot(OX + x - K.heroi.x, z - K.heroi.z) < 5.5); g.font = `${perto ? 26 : 18}px Titulo, sans-serif`; g.strokeText('+', p[0], p[1] + 8); g.fillStyle = perto ? '#7aff8a' : 'rgba(255,255,255,.8)'; g.fillText('+', p[0], p[1] + 8); });
  for (const t of K.txt) { t.t += dt; const p = C.tela(t.x, t.y + t.t * 3, t.z); if (!p) continue; g.globalAlpha = Math.max(0, 1 - t.t / 0.8); g.font = `${t.g ? 18 + 6 * t.g : t.cor === '#ffd84a' ? 18 : 14}px Titulo, sans-serif`; g.strokeText(t.txt, p[0], p[1]); g.fillStyle = t.cor; g.fillText(t.txt, p[0], p[1]); g.globalAlpha = 1; }
  K.txt = K.txt.filter(t => t.t < 0.8);
  const B = K.banner;
  if (B) { B.t += dt; const k = Math.min(1, B.t / 0.18), s = k < 1 ? 0.4 + 0.9 * k : 1, a = Math.max(0, 1 - Math.max(0, B.t - 1.1) / 0.4);
    g.save(); g.globalAlpha = a; g.translate(innerWidth / 2, innerHeight * 0.3); g.scale(s, s); g.font = '40px Titulo, sans-serif'; g.textBaseline = 'middle'; g.lineWidth = 9; g.lineJoin = 'round'; g.strokeStyle = 'rgba(30,10,0,.85)';
    const tx = tr(B.txt); g.strokeText(tx, 0, 0); g.fillStyle = B.cor; g.fillText(tx, 0, 0); g.restore(); if (B.t > 1.5) K.banner = null; }
}
window.__df = { K: () => K, abrirBuffs: () => abrirBuffs() }; // testes
