// Batalha da Ponte: o herói atira flechas nas pilhas de +N das laterais para ganhar soldados.
// O exército azul marcha pelo meio contra o exército vermelho e o chefe no fim da ponte.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as C from './cena.js';
import { fase as dadosFase, tiros, vidaMuralha, escudo, fmt, UPGRADES } from './dados.js';
import { S, salvar, comprar, BAUS, MAX_BAUS, ganharBau, abrirBau, cartasPara, CARTAS, DIARIO, diarioPronto, diaDoPresente, pegarDiario } from './meta.js';
import { visualPadrao } from './aparencia.js';
import { ico, som, $, alternarSom, estaMudo } from './util.js';
import { tema, sfx, intensidade } from './musica.js';
import { criarTropas, desenharTropas, voar, passoVoo, limparTropas } from './tropas.js';

// ---------------- medidas da ponte (frente = -z) ----------------
const MEIA = 17;            // meia largura da ponte
const DIV = 5.8;            // divisórias entre as pistas (x = ±DIV)
const XL = 11.4;            // centro das pistas laterais
const XC = 4.4;             // meia largura da pista do meio
const ZH = -1;              // herói
const ZMURO = -4.5;         // muralha (os vermelhos batem nela)
const ZSPAWN = -9;          // onde surgem os soldados azuis
const ZLANE = -12;          // começo das pistas
const PASSO = 3.4, NB = 20;
const ZBOSS = ZLANE - NB * PASSO - 10;
const MAXU = 900, VEL_AZ = 8, VEL_VM = 4.4;
const ZFRENTE = ZBOSS - 35, ZTRAS = 40;
const ZFORK0 = ZLANE - 5, ZFORK1 = ZBOSS + 15; // trecho com duas rotas
// torres que o jogador constrói durante a batalha com o ouro ⚔ dos orcs derrotados
const TORRES = {
  balista: { nome: 'Balista', modelo: 'C:siege-ballista', esc: 4.6, icone: 'h_perfura', custo: [25, 45, 80], alcance: 20, cad: [0.9, 0.6, 0.4] },
  catapulta: { nome: 'Catapulta', modelo: 'C:siege-catapult', esc: 4.2, icone: 'h_meteoro', custo: [50, 90, 140], alcance: 34, cad: [3, 2.3, 1.7], raio: [3.2, 3.9, 4.6] },
};
const GEO_VAGA = new THREE.CylinderGeometry(1.5, 1.7, 0.4, 16), MAT_VAGA = new THREE.MeshLambertMaterial({ color: 0x9a9088 });
const GEO_PEDRA = new THREE.SphereGeometry(0.55, 10, 8), MAT_PEDRA_T = new THREE.MeshLambertMaterial({ color: 0x6a6460 });
const xRota = r => G.rotas > 1 ? r * (1 + Math.random() * 2.8) : (Math.random() - 0.5) * XC * 1.8;
function tipoNovo() { // cada tropa escolhida vem em ~22% (+1% por nível); o resto são espadachins
  let r = Math.random(); for (const k of G.deck) { const p = 0.22 + 0.01 * S.pd[k].nv; if (r < p) return k; r -= p; } return 'az'; }
function novoAzul(x, z, ax, extra) { const tipo = extra?.tipo || tipoNovo(), u = { x, z, ph: Math.random() * 6, ax, tipo, ...extra, cd: Math.random(), tiroT: 0 };
  u.tipo = tipo; if (tipo === 'lanca') u.hp = 2 + Math.floor(S.pd.lanca.nv / 3); return u; }
const ladoHeroi = () => G.heroi.x < -0.5 ? -1 : G.heroi.x > 0.5 ? 1 : (Math.random() < 0.5 ? -1 : 1);

let G = null;                // partida atual
let tela = 'lobby';          // 'lobby' | 'jogo' | 'fim'
let foco = { x: 0, z: -30 };

// ---------------- texturas desenhadas ----------------
const texCache = {};
function texRotulo(txt, fundo, borda, w = 256, h = 128) {
  const k = txt + fundo + w; if (texCache[k]) return texCache[k];
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  desenharRotulo(g, txt, fundo, borda, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (texCache[k] = t);
}
function desenharRotulo(g, txt, fundo, borda, w, h) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, new THREE.Color(fundo).offsetHSL(0, 0, 0.12).getStyle()); gr.addColorStop(1, fundo);
  g.fillStyle = borda; g.fillRect(0, 0, w, h); g.fillStyle = gr; g.fillRect(8, 8, w - 16, h - 16);
  let fs = Math.round(h * 0.62); g.font = `${fs}px Titulo, sans-serif`;
  while (fs > 20 && g.measureText(txt).width > w - 30) g.font = `${fs -= 4}px Titulo, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = h * 0.09; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(txt, w / 2, h / 2 + 4); g.fillStyle = '#fff'; g.fillText(txt, w / 2, h / 2 + 4);
}
function texPedra() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = '#a9a39a'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
    const ox = (y % 2) * 32, l = 62 + Math.random() * 14;
    g.fillStyle = `hsl(35,6%,${l}%)`; g.fillRect(x * 64 + ox + 2 - 64 * (ox && x === 3 ? 0 : 0), y * 32 + 2, 60, 28);
    if (ox && x === 3) g.fillRect(-32 + 2, y * 32 + 2, 30, 28);
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------------- cenário em volta: a ponte cruza um cânion (o bioma muda a cada 2 fases) ----------------
const Y_RIO = -30;
const BIOMAS = [
  { nome: 'Floresta', ceu: 0x7fb6e0, nevoa: [240, 560], rio: ['#1f6a8a', '180,235,255', 0xbfe8ff], chao: ['#5fa848', 95, 20, 40, 36], rocha: [0x9a7a5a, 0x86684c], mont: [0x6a8a7a, 0xf2f6ff], ponte: [0xffffff, 0x8f8a84],
    enfeites: [[['Q:CommonTree_1', 3], ['Q:CommonTree_2', 3], ['Q:CommonTree_3', 3], ['Q:CommonTree_4', 3], ['Q:Pine_1', 3], ['Q:Pine_2', 3]], [['Q:Bush_Common', 2.4], ['Q:Bush_Common_Flowers', 2.4], ['Q:Plant_1_Big', 2.4], ['Q:Flower_3_Group', 2.4]], [['Q:Rock_Medium_1', 2], ['Q:Rock_Medium_2', 2]]] },
  { nome: 'Deserto', ceu: 0x9fd0f0, nevoa: [240, 560], rio: ['#2a8aa8', '200,245,255', 0xd8f4ff], chao: ['#e2c27a', 38, 15, 50, 62], rocha: [0xc88a5a, 0xb07448], mont: [0xc8955a, 0xd8a868], ponte: [0xffe2b8, 0xc8a478],
    enfeites: [[['N:tree_palmTall', 17], ['N:cactus_tall', 28], ['N:cactus_short', 30]], [['N:cactus_short', 26], ['N:rock_tallA', 9]], [['N:rock_largeA', 12], ['Q:Rock_Medium_3', 2.2]]] },
  { nome: 'Gelo', ceu: 0xcfe2f2, nevoa: [200, 520], rio: ['#5ab0d8', '235,250,255', 0xe8faff], chao: ['#eef4fa', 210, 25, 10, 88], rocha: [0x8a9aac, 0x76869a], mont: [0x9aaabf, 0xffffff], ponte: [0xe2eeff, 0xa8bcd4],
    enfeites: [[['Q:Pine_1', 3], ['Q:Pine_2', 3], ['Q:Pine_3', 3.2], ['N:tree_pineSmallA', 22]], [['N:rock_tallA', 10], ['Q:Rock_Medium_1', 2.2]], [['Q:Pine_4', 2.6]]] },
  { nome: 'Vulcão', ceu: 0x5a3a36, nevoa: [180, 460], rio: ['#d8401a', '255,220,90', 0xffffff], chao: ['#4a403c', 20, 10, 10, 22], rocha: [0x3a302c, 0x2a2422], mont: [0x3a2c2a, 0xff6a2a], ponte: [0x9a8a86, 0x5a4a46],
    lava: true, enfeites: [[['Q:DeadTree_1', 2.6], ['Q:DeadTree_3', 2.6], ['F:Tree_Bare_1_A_Color1', 7]], [['Q:Rock_Medium_1', 2.4], ['Q:Rock_Medium_2', 2.4], ['F:Rock_1_A_Color1', 10]], [['Q:Rock_Medium_3', 3]]] },
];
export const biomaDe = n => Math.floor((n - 1) / 2) % BIOMAS.length;
let texAgua = null, cenGrupo = null, cenEstat = null, biomaAtual = -1;
function texturaAgua(B) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = B.rio[0]; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) { const x = Math.random() * 256, y = Math.random() * 256, w = 20 + Math.random() * 50;
    g.strokeStyle = `rgba(${B.rio[1]},${0.15 + Math.random() * 0.3})`; g.lineWidth = 2 + Math.random() * 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 5, x + w, y); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 60); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function texturaChao(B) {
  const [base, h, dh, s, l] = B.chao, cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 600; i++) { g.fillStyle = `hsl(${h + Math.random() * dh},${s + Math.random() * 15}%,${l + Math.random() * 12}%)`; g.fillRect(Math.random() * 128, Math.random() * 128, 3, 3); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function montarCenario(bi) {
  if (bi === biomaAtual) return; biomaAtual = bi; const B = BIOMAS[bi];
  if (cenGrupo) cena.remove(cenGrupo); if (cenEstat) C.removerGrupo(cenEstat);
  cenGrupo = new THREE.Group(); cena.add(cenGrupo); const add = m => { cenGrupo.add(m); return m; };
  C.ceu(B.ceu); C.neblina(...B.nevoa); MAT_PEDRA.color.set(B.ponte[0]); MAT_MURO.color.set(B.ponte[1]);
  let sd = 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647), sorteio = l => l[Math.floor(r() * l.length)];
  // rio (ou lava) lá embaixo
  texAgua = texturaAgua(B);
  const agua = add(new THREE.Mesh(new THREE.PlaneGeometry(400, 1200), B.lava ? new THREE.MeshBasicMaterial({ map: texAgua }) : new THREE.MeshLambertMaterial({ map: texAgua, color: B.rio[2] })));
  agua.rotation.x = -Math.PI / 2; agua.position.set(0, Y_RIO, -150);
  // paredões do cânion com o chão do bioma em cima, borda irregular
  const tg = texturaChao(B); tg.repeat.set(6, 2);
  const topo = new THREE.MeshLambertMaterial({ map: tg }), rocha = new THREE.MeshLambertMaterial({ color: B.rocha[0] }), rocha2 = new THREE.MeshLambertMaterial({ color: B.rocha[1] });
  const enfeites = [];
  for (const lado of [-1, 1]) for (let z = ZTRAS + 30; z > ZFRENTE - 260; z -= 9) {
    const borda = 25 + r() * 5 + Math.max(0, (-z - 100) * 0.05), larg = 140, alt = -Y_RIO + 2 + r() * 2;
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(larg, alt, 9.4), [r() < 0.5 ? rocha : rocha2, r() < 0.5 ? rocha : rocha2, topo, rocha, rocha, rocha]));
    m.position.set(lado * (borda + larg / 2), Y_RIO + alt / 2 - 1.2, z); m.receiveShadow = true;
    if (r() < 0.6) { const d = add(new THREE.Mesh(new THREE.BoxGeometry(4 + r() * 4, 6 + r() * 10, 6 + r() * 4), rocha2)); d.position.set(lado * (borda - 1), Y_RIO + 6 + r() * 12, z + r() * 4); d.rotation.y = r(); }
    for (let k = 0; k < 3; k++) { const q = r(), grupo = B.enfeites[q < 0.5 ? 0 : q < 0.8 ? 1 : 2], [m2, s] = sorteio(grupo);
      enfeites.push({ m: m2, x: lado * (borda + 3 + r() * 55), y: 0.8, z: z + r() * 9, ry: r() * 6.28, s: s * (0.8 + r() * 0.5) }); }
  }
  for (let i = 0; i < 26; i++) { const lado = r() < 0.5 ? -1 : 1; enfeites.push({ m: ['Q:Rock_Medium_1', 'Q:Rock_Medium_2', 'Q:Rock_Medium_3'][i % 3], x: lado * (19 + r() * 9), y: Y_RIO - 0.5, z: ZTRAS - r() * 260, ry: r() * 6, s: 3 + r() * 4 }); }
  cenEstat = C.montarEstatico(enfeites);
  // pilares da ponte descendo até o rio
  const pil = new THREE.MeshLambertMaterial({ color: 0x8f8a84 });
  for (let z = ZTRAS - 12; z > ZFRENTE + 10; z -= 26) for (const lado of [-1, 1]) {
    const m = add(new THREE.Mesh(new THREE.BoxGeometry(5, -Y_RIO - 4, 6), pil)); m.position.set(lado * (MEIA - 3), (Y_RIO - 4) / 2, z); m.castShadow = true;
    const b = add(new THREE.Mesh(new THREE.BoxGeometry(7, 3, 8), pil)); b.position.set(lado * (MEIA - 3), Y_RIO + 1, z);
  }
  // montanhas (ou vulcões) no horizonte
  const mont = new THREE.MeshLambertMaterial({ color: B.mont[0], flatShading: true }), pico = B.lava ? new THREE.MeshBasicMaterial({ color: B.mont[1] }) : new THREE.MeshLambertMaterial({ color: B.mont[1], flatShading: true });
  for (let i = 0; i < 14; i++) { const x = (r() - 0.5) * 520, z = ZFRENTE - 120 - r() * 160, h = 60 + r() * 90, rr = 40 + r() * 50;
    const m = add(new THREE.Mesh(new THREE.ConeGeometry(rr, h, 6 + Math.floor(r() * 3)), mont)); m.position.set(x, h / 2 - 10, z); m.rotation.y = r();
    const c = add(new THREE.Mesh(new THREE.ConeGeometry(rr * 0.32, h * 0.32, m.geometry.parameters.radialSegments), pico)); c.position.set(x, h - 10 - h * 0.16 + 0.5, z); c.rotation.y = m.rotation.y; }
}

// ---------------- ponte fixa ----------------
let cena, MAT_PEDRA, MAT_MURO, GEO_FLECHA, MAT_FLECHA;
export function montarPonte() {
  cena = C.obterCena();
  const tp = texPedra(), len = ZTRAS - ZFRENTE;
  const chao = tp.clone(); chao.needsUpdate = true; chao.repeat.set(MEIA * 2 / 8, len / 8);
  MAT_PEDRA = new THREE.MeshLambertMaterial({ map: chao });
  MAT_MURO = new THREE.MeshLambertMaterial({ color: 0x8f8a84 });
  const add = (geo, mat, x, y, z, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = true; m.castShadow = sombra; cena.add(m); return m; };
  // água
  montarCenario(0);
  // piso e laterais da ponte
  add(new THREE.BoxGeometry(MEIA * 2, 4, len), MAT_PEDRA, 0, -2, (ZTRAS + ZFRENTE) / 2, false);
  // muros com ameias: laterais, divisórias e a muralha do herói
  const muro = (x0, x1, z0, z1, h) => { // caixa + ameias, de (x0,z0) a (x1,z1) alinhada a um eixo
    const geos = [], lx = Math.abs(x1 - x0), lz = Math.abs(z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, esp = 1.2;
    geos.push(new THREE.BoxGeometry(Math.max(esp, lx), h, Math.max(esp, lz)).translate(cx, h / 2, cz));
    const n = Math.floor(Math.max(lx, lz) / 2.4);
    for (let i = 0; i <= n; i++) { const k = n ? i / n : 0.5, x = lx > lz ? x0 + (x1 - x0) * k : cx, z = lx > lz ? cz : z0 + (z1 - z0) * k; geos.push(new THREE.BoxGeometry(esp, 0.9, esp).translate(x, h + 0.45, z)); }
    const m = new THREE.Mesh(mergeGeometries(geos), MAT_MURO); m.castShadow = true; m.receiveShadow = true; cena.add(m);
  };
  muro(-MEIA - 0.6, -MEIA - 0.6, ZTRAS, ZFRENTE, 1.6); muro(MEIA + 0.6, MEIA + 0.6, ZTRAS, ZFRENTE, 1.6);
  muro(-DIV, -DIV, ZLANE, ZBOSS - 6, 1.6); muro(DIV, DIV, ZLANE, ZBOSS - 6, 1.6);
  muro(-MEIA, MEIA, ZMURO, ZMURO, 1.3);
  muro(-MEIA, MEIA, ZBOSS - 14, ZBOSS - 14, 2.2);
  // torres do castelo (kit Kenney) nas pontas
  C.montarEstatico([
    { m: 'C:tower-square', x: -MEIA - 3, z: ZMURO + 1, s: 5 }, { m: 'C:tower-square', x: MEIA + 3, z: ZMURO + 1, s: 5 },
    { m: 'C:flag', x: -MEIA - 3, y: 10, z: ZMURO + 1, s: 4 }, { m: 'C:flag', x: MEIA + 3, y: 10, z: ZMURO + 1, s: 4 },
    { m: 'C:tower-square', x: -MEIA - 3, z: ZBOSS - 12, s: 6 }, { m: 'C:tower-square', x: MEIA + 3, z: ZBOSS - 12, s: 6 },
    { m: 'C:gate', x: 0, z: ZBOSS - 16, s: 7 },
  ]);
  criarTropas(cena);
  GEO_FLECHA = mergeGeometries([new THREE.CylinderGeometry(0.07, 0.07, 2.2, 5).rotateX(Math.PI / 2), new THREE.ConeGeometry(0.2, 0.6, 6).rotateX(-Math.PI / 2).translate(0, 0, -1.3)]);
  MAT_FLECHA = new THREE.MeshBasicMaterial({ color: 0xffd84a });
  montarHud();
}

// ---------------- fase ----------------
const GEO_BLOCO = new THREE.BoxGeometry(9.4, 2.4, 3);
const GEO_BARREIRA = new THREE.BoxGeometry(10.4, 3.6, 1.4);
const MAT_LADO_AZUL = new THREE.MeshLambertMaterial({ color: 0x2a6ad8 }), MAT_LADO_AMAR = new THREE.MeshLambertMaterial({ color: 0xe0a818 }), MAT_MADEIRA = new THREE.MeshLambertMaterial({ color: 0x8a5a2b }), MAT_ROXO = new THREE.MeshLambertMaterial({ color: 0x8a3ad8, emissive: 0x3a0a6a });
const GEO_POSTE = new THREE.BoxGeometry(1.3, 5.2, 1.3), GEO_PAINEL = new THREE.PlaneGeometry(9.6, 2.8), MAT_POSTE = new THREE.MeshLambertMaterial({ color: 0xe8e8f0 });
function criarPortao(p) {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ map: texRotulo(p.tipo === 'vezes' ? `x${p.valor}` : `+${p.valor}`, '#2fa8ff', '#0f5ab0'), transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false });
  for (const x of [-XC - 0.6, XC + 0.6]) { const m = new THREE.Mesh(GEO_POSTE, MAT_POSTE); m.position.set(x, 2.6, 0); m.castShadow = true; g.add(m); }
  const pn = new THREE.Mesh(GEO_PAINEL, mat); pn.position.y = 3.6; g.add(pn); p.painel = pn;
  g.position.set(0, 0, p.z); cena.add(g); p.o = g; p.ganho = 0; p.tt = 0; p.pulso = 0;
}
function criarBloco(b, lado) {
  const x = lado * XL;
  if (b.tipo === 'barreira') {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    b.cv = cv; b.tex = t; b.hpMax = b.hp; redesenharBarreira(b);
    const mf = new THREE.MeshLambertMaterial({ map: t }); b.mesh = new THREE.Mesh(GEO_BARREIRA, [MAT_MADEIRA, MAT_MADEIRA, mf, MAT_MADEIRA, mf, MAT_MADEIRA]);
  } else if (b.tipo === 'poder') {
    const mf = new THREE.MeshLambertMaterial({ map: texRotulo(b.p === 'flecha' ? 'FLECHA +1' : 'RÁPIDO', '#a24ae8', '#5a1a9a') });
    b.mesh = new THREE.Mesh(GEO_BLOCO, [MAT_ROXO, MAT_ROXO, mf, MAT_ROXO, mf, MAT_ROXO]);
  } else {
    const amarelo = lado > 0, txt = b.tipo === 'vezes' ? `x${b.valor}` : `+${b.valor}`, fundo = b.tipo === 'vezes' ? '#2bb84a' : amarelo ? '#f2b51a' : '#2f7ae8', borda = b.tipo === 'vezes' ? '#13702a' : amarelo ? '#a8740a' : '#173f9a';
    const mf = new THREE.MeshLambertMaterial({ map: texRotulo(txt, fundo, borda) }), ml = b.tipo === 'vezes' ? new THREE.MeshLambertMaterial({ color: 0x2bb84a }) : amarelo ? MAT_LADO_AMAR : MAT_LADO_AZUL;
    b.mesh = new THREE.Mesh(GEO_BLOCO, [ml, ml, mf, ml, mf, ml]);
  }
  b.mesh.castShadow = true; b.mesh.receiveShadow = true; b.mesh.position.set(x, b.tipo === 'barreira' ? 1.8 : 1.2, b.z); cena.add(b.mesh);
}
function redesenharBarreira(b) {
  const g = b.cv.getContext('2d'); g.clearRect(0, 0, 256, 96);
  g.fillStyle = '#6a4220'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#8a5a2b'; for (let i = 0; i < 4; i++) g.fillRect(4, 4 + i * 23, 248, 19);
  g.fillStyle = '#7a7f86'; g.fillRect(0, 0, 18, 96); g.fillRect(238, 0, 18, 96);
  g.font = '64px Titulo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.6)';
  g.strokeText(b.hp, 128, 52); g.fillStyle = '#fff'; g.fillText(b.hp, 128, 52); b.tex.needsUpdate = true;
}

export function iniciarFase(n, inf = false) {
  limparFase(); montarCenario(biomaDe(n));
  const F = dadosFase(n), up = S.up;
  G = { F, n, t: 0, az: [], vm: [], flechas: [], txt: [], fila: 8 * up.exercito, acum: 0, cd: 0.5, pistas: [[], []], spawnVm: 0, golpePend: 0,
    muro: vidaMuralha(up.vida), muroMax: vidaMuralha(up.vida), tiro: tiros(up.fogo), nFlechas: 1 + up.flechas, escudo: escudo(up.escudos),
    heroi: { x: 0, alvo: 0 }, golpeT: 4, fim: null, mortesVm: 0, portoes: [], ondaT: 16, banner: null, punch: 0, lento: 0, brilhoH: 0,
    pd: { chuva: { cd: 4, max: Math.max(6, 11 - 0.6 * (S.pd.chuva.nv - 1)), nv: S.pd.chuva.nv }, gigante: { cd: 12, max: Math.max(16, 30 - 1.8 * (S.pd.gigante.nv - 1)), nv: S.pd.gigante.nv } }, chuvas: [], gigante: null, puloT: 0,
    inf, chefesMortos: 0, rotas: F.rotas, ouro: 25, deck: S.deck.filter(k => S.pd[k]?.nv > 0), vagas: [], tiros: [], menuVaga: null };
  // duas rotas: um muro baixo divide a pista do meio
  if (G.rotas > 1) { G.forquilha = new THREE.Mesh(new THREE.BoxGeometry(1, 1.6, ZFORK0 - ZFORK1).translate(0, 0.8, (ZFORK0 + ZFORK1) / 2), MAT_MURO); G.forquilha.castShadow = G.forquilha.receiveShadow = true; cena.add(G.forquilha); }
  // vagas de torre em cima das divisórias
  for (let i = 0; i < F.vagas; i++) { const x = (i % 2 ? 1 : -1) * DIV, z = ZLANE - 10 - Math.floor(i / 2) * 20;
    const base = new THREE.Mesh(GEO_VAGA, MAT_VAGA); base.position.set(x, 1.7, z); base.receiveShadow = true; cena.add(base);
    G.vagas.push({ i, x, z, base, tipo: null, nv: 0, cd: 0, o: null }); }
  montarVagas();
  for (const p0 of F.portoes) { const p = { ...p0, z: ZLANE - 2 - p0.i * PASSO }; criarPortao(p); G.portoes.push(p); }
  [F.esq, F.dir].forEach((lista, k) => lista.forEach((b0, i) => novoBloco(b0, k, ZLANE - 2 - i * PASSO, F.duro)));
  criarChefe(F);
  // herói arqueiro
  if (!G.heroiV) { const v = C.heroi(S.visual || visualPadrao('arq')); v.raiz.scale.setScalar(2.4); v.raiz.rotation.y = Math.PI; v.tocar('Ranged_Bow_Aiming_Idle'); G.heroiV = v; }
  G.heroiV.raiz.position.set(0, 0, ZH);
}
function novoBloco(b0, k, z, duro) {
  const b = { ...b0, z }; if (b.tipo !== 'barreira') b.hp = b.hpMax = (b.tipo === 'mais' ? Math.max(1, Math.round(1.3 * Math.log(b.valor))) : 3) + duro;
  criarBloco(b, k ? 1 : -1); G.pistas[k].push(b);
}
function criarChefe(F) {
  const ch = C.personagem(F.chefe.modelo, [], 1); ch.raiz.scale.setScalar(5); ch.raiz.position.set(0, 0, ZBOSS); ch.tocar('Idle');
  G.chefe = { v: ch, hp: F.chefe.hp, max: F.chefe.hp, nome: F.chefe.nome, flash: 0, z: ZBOSS, y: 0, esc: 5, mats: [] };
  ch.raiz.traverse(o => { if (o.material?.emissive) G.chefe.mats.push(o.material); });
}
// ponte sem fim: chefe derrotado explode e vem o próximo, mais forte (pistas e portões se renovam)
function proximoChefe() {
  const ch = G.chefe; G.chefesMortos++; G.n++; const F = dadosFase(G.n);
  C.faiscas(0, 6, ch.z, 0xffd84a, 120, 12); C.camera.tremor = 1; G.lento = 1; G.punch = 1; sfx('vitoria');
  for (const v of G.vm) arremessar('vm', v, 0, ch.z, 14); G.vm = []; G.chuvas.length = 0;
  ch.v.remover(); G.F = F; G.t = 0; G.ondaT = 16; G.puloT = 0; G.golpePend = 0; intensidade(1);
  criarChefe(F); $('#jChefeN').textContent = G.chefe.nome; $('#jN').textContent = `∞ · ${G.chefesMortos + 1}`;
  for (const p of G.portoes) cena.remove(p.o); G.portoes = [];
  for (const p0 of F.portoes) { const p = { ...p0, z: ZLANE - 2 - p0.i * PASSO }; criarPortao(p); G.portoes.push(p); }
  G.ouro += 30; G.muro = Math.min(G.muroMax, G.muro + Math.ceil(G.muroMax * 0.25));
  faixa(`CHEFE ${G.chefesMortos} DERROTADO!`, '#ffd84a'); G.txt.push({ x: 0, y: 8, z: -40, txt: '+1000', cor: '#ffd84a', t: 0, grande: true });
  montarCenario(biomaDe(G.n));
}
const pontosInf = () => G.chefesMortos * 1000 + G.mortesVm;
function limparFase() {
  if (!G) return;
  for (const p of G.pistas) for (const b of p) cena.remove(b.mesh);
  for (const f of G.flechas) cena.remove(f.o);
  for (const p of G.portoes) cena.remove(p.o);
  G.chefe?.v.remover(); G.heroiV?.remover(); G.gigante?.v.remover();
  for (const c of G.chuvas) for (const f of c.fl) cena.remove(f.o);
  for (const v of G.vagas) { cena.remove(v.base); if (v.o) cena.remove(v.o); }
  for (const s of G.tiros) cena.remove(s.o);
  if (G.forquilha) cena.remove(G.forquilha);
  limparTropas(); G = null;
}

// ---------------- HUD ----------------
let fx, gfx;
function montarHud() {
  $('#hud').innerHTML = `<div id="lobby"></div>
    <div id="jogo" hidden><div class="jTopo"><button class="lSair" data-a="sair">${ico('fechar')}</button><div class="jFase">Fase <b id="jN"></b></div><div class="pilula ouro">${ico('ouro')}<b id="jMoedas"></b></div></div>
      <div class="pilula guerra" id="jGuerra">${ico('forca')}<b id="jOuro"></b></div>
      <div id="jVagas"></div><div id="jMenuT" hidden></div>
      <div class="jChefe"><b id="jChefeN"></b><div class="barra vm"><i id="jChefeB"></i><span id="jChefeT"></span></div></div>
      <div class="jPoderes"><button class="poder" data-pd="chuva">${ico('h_chuva')}<small>Chuva</small></button><button class="poder" data-pd="gigante">${ico('cav')}<small>Gigante</small></button></div>
      <div class="jMuro">${ico('escudo')}<div class="barra muro"><i id="jMuroB"></i><span id="jMuroT"></span></div></div>
      <p class="jDica" id="jDica">Arraste para mover · as flechas saem sozinhas</p></div>
    <div id="fim" hidden></div><div id="janela" hidden></div>`;
  fx = document.createElement('canvas'); fx.id = 'fx'; document.body.append(fx); gfx = fx.getContext('2d');
  const medir = () => { fx.width = innerWidth * devicePixelRatio; fx.height = innerHeight * devicePixelRatio; gfx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
  medir(); addEventListener('resize', medir);
  // arrastar para mover o herói
  let toque = null;
  const alvo = $('#toque');
  alvo.addEventListener('pointerdown', e => { if (tela !== 'jogo' || !G) return; toque = { id: e.pointerId, x0: e.clientX, h0: G.heroi.alvo }; alvo.setPointerCapture(e.pointerId); $('#jDica').hidden = true; });
  alvo.addEventListener('pointermove', e => { if (!toque || e.pointerId !== toque.id || !G) return; G.heroi.alvo = Math.max(-MEIA + 2.5, Math.min(MEIA - 2.5, toque.h0 + (e.clientX - toque.x0) * (MEIA * 2.4 / innerWidth))); });
  const solta = e => { if (toque && e.pointerId === toque.id) toque = null; };
  alvo.addEventListener('pointerup', solta); alvo.addEventListener('pointercancel', solta);
  $('#hud').addEventListener('click', clique);
}
export function abrirLobby() {
  roleta = null;
  tela = 'lobby'; $('#jogo').hidden = true; $('#fim').hidden = true; $('#lobby').hidden = false; tema('guilda');
  iniciarFase(S.fase); desenharLobby();
  if (!diarioVisto && diarioPronto()) { diarioVisto = true; setTimeout(mostrarDiario, 900); }
}
let diarioVisto = false;
function desenharLobby() {
  const F = dadosFase(S.fase);
  $('#lobby').innerHTML = `<div class="lbTopo"><div class="pilula ouro">${ico('ouro')}<b>${fmt(S.moedas)}</b></div><button class="redondo presente" data-a="diario">${ico('presente')}${diarioPronto() ? '<i class="ponto"></i>' : ''}</button><button class="redondo" data-a="som">${ico(estaMudo() ? 'mudo' : 'som')}</button></div>
    <div class="lbTitulo"><small>Batalha da</small><h1>Ponte</h1></div>
    <div class="lbPainel"><div class="lbFase"><span>FASE</span><b>${S.fase}</b><small>${ico('chefe')} ${F.chefe.nome} · vida ${fmt(F.chefe.hp)} · ${BIOMAS[biomaDe(S.fase)].nome}</small></div>
      <div class="ups">${Object.entries(UPGRADES).map(([k, U]) => { const n = S.up[k], max = n >= U.max, c = U.custo(n);
        return `<button class="up ${!max && S.moedas >= c ? 'pode' : ''}" data-up="${k}"><span class="upIco">${ico(U.icone)}</span><b>${U.nome}</b><small>${U.desc(n)}</small><em>${max ? 'MÁX' : `${ico('ouro')}${fmt(c)}`}</em><i>Nv ${n}</i></button>`; }).join('')}</div>
      <div class="lbCartas"><small class="lbRot">Poderes</small><small class="lbRot">Tropas · escolha 2</small>${CARTAS_INFO.map(([k, nome, icone]) => { const P = S.pd[k], need = cartasPara(P.nv), tropa = !!TROPAS[k], sel = S.deck.includes(k);
        return `<${tropa ? `button data-tropa="${k}"` : 'div'} class="cartaM ${k} ${tropa ? 'tropa' : ''} ${sel ? 'sel' : ''} ${P.nv ? '' : 'bloq'}"><span>${ico(icone)}</span><b>${nome}</b>
          ${P.nv ? `<i>Nv ${P.nv}</i><div class="pdBarra"><i style="width:${P.nv >= 10 ? 100 : 100 * P.c / need}%"></i><small>${P.nv >= 10 ? 'MÁX' : `${P.c}/${need}`}</small></div>` : `<i>${ico('cadeado')} nos baús</i>`}
          ${sel ? `<em>${ico('check')}</em>` : ''}</${tropa ? 'button' : 'div'}>`; }).join('')}</div>
      <div class="baus">${Array.from({ length: MAX_BAUS }, (_, i) => { const b = S.baus[i];
        return b ? `<button class="slotBau" data-bau="${i}">${bauHtml(b.tipo, 'mini')}<small>Abrir!</small></button>` : `<div class="slotBau vazio"><small>Vença para ganhar baú</small></div>`; }).join('')}</div>
      <button class="btn verde grande" data-a="jogar">${ico('h_triplo')} JOGAR</button>
      <button class="btn roxo infBtn ${S.melhor < 3 ? 'sem' : ''}" data-a="infinito"><span>∞ Ponte sem fim</span><em>${S.melhor < 3 ? `${ico('cadeado')} vença a fase 3` : `${ico('estrela')} ${fmt(S.recInf || 0)}`}</em></button></div>`;
}
const PODERES = [['chuva', 'Chuva', 'h_chuva'], ['gigante', 'Gigante', 'cav']];
// tropas especiais: misturam-se aos espadachins; o nível melhora cada uma
const TROPAS = {
  arco: { nome: 'Arqueiros', icone: 'arq', cor: 0x3aa84a },
  lanca: { nome: 'Lanceiros', icone: 'bar', cor: 0x8a96a8 },
  mago: { nome: 'Magos', icone: 'mag', cor: 0x8a4ae0 },
};
const CARTAS_INFO = [...PODERES, ...Object.entries(TROPAS).map(([k, T]) => [k, T.nome, T.icone])];
// baú desenhado em SVG: madeira com tábuas, cintas de metal, rebites e fechadura (cores por tipo)
const COR_BAU = { madeira: ['#c98a4a', '#7a4a20', '#9aa3ad', '#5a626c', '#ffd23a'], prata: ['#5a7ad8', '#26387a', '#eef3fa', '#9aa8bc', '#ffffff'], ouro: ['#d8403a', '#7a1414', '#ffe27a', '#d89a10', '#fff6c8'] };
let idBau = 0;
function bauHtml(tipo, cls = '') {
  const [m1, m2, f1, f2, br] = COR_BAU[tipo], i = ++idBau;
  const cinta = x => `<rect x="${x}" y="14" width="11" height="80" rx="2" fill="url(#f${i})" stroke="#2a1a0c" stroke-width="2"/>`;
  const rebites = (y) => [16, 27, 93, 104].map(x => `<circle cx="${x}" cy="${y}" r="2.2" fill="${br}" stroke="#2a1a0c" stroke-width="1"/>`).join('');
  return `<div class="bauG ${tipo} ${cls}"><svg viewBox="0 0 120 100">
    <defs><linearGradient id="m${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m1}"/><stop offset="1" stop-color="${m2}"/></linearGradient>
      <linearGradient id="f${i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${f1}"/><stop offset=".55" stop-color="${f2}"/><stop offset="1" stop-color="${f1}"/></linearGradient></defs>
    <ellipse cx="60" cy="95" rx="52" ry="5" fill="rgba(0,0,0,.25)"/>
    <g class="corpo"><rect x="8" y="50" width="104" height="44" rx="6" fill="url(#m${i})" stroke="#2a1a0c" stroke-width="3"/>
      <path d="M10 64H110M10 79H110" stroke="rgba(0,0,0,.22)" stroke-width="2"/><rect x="8" y="86" width="104" height="8" rx="3" fill="url(#f${i})" stroke="#2a1a0c" stroke-width="2"/>
      ${cinta(16).replace('y="14" width="11" height="80"', 'y="50" width="11" height="44"')}${cinta(93).replace('y="14" width="11" height="80"', 'y="50" width="11" height="44"')}</g>
    <g class="tampa"><path d="M8 52V34Q8 14 30 12H90Q112 14 112 34V52Z" fill="url(#m${i})" stroke="#2a1a0c" stroke-width="3"/>
      <path d="M14 30Q16 18 32 17H88" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="3" stroke-linecap="round"/><path d="M9 40H111" stroke="rgba(0,0,0,.2)" stroke-width="2"/>
      <path d="M16 52V30Q16 18 27 15V52Z" fill="url(#f${i})" stroke="#2a1a0c" stroke-width="2"/><path d="M104 52V30Q104 18 93 15V52Z" fill="url(#f${i})" stroke="#2a1a0c" stroke-width="2"/>
      <rect x="6" y="47" width="108" height="8" rx="3" fill="url(#f${i})" stroke="#2a1a0c" stroke-width="2"/>${rebites(51)}</g>
    <g class="fecho"><rect x="49" y="42" width="22" height="26" rx="4" fill="url(#f${i})" stroke="#2a1a0c" stroke-width="2.5"/><circle cx="60" cy="52" r="3.5" fill="#2a1a0c"/><path d="M58.5 54h3l1 7h-5z" fill="#2a1a0c"/></g>
    ${tipo === 'ouro' ? '<g class="brilhos"><path d="M100 8l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#fff"/><path d="M18 4l1.4 4 4 1.4-4 1.4-1.4 4-1.4-4-4-1.4 4-1.4z" fill="#fff"/></g>' : ''}
  </svg></div>`;
}
// janela de baú: toca para abrir, os prêmios aparecem um a um
function mostrarBau(tipo, titulo, aoAbrir) {
  const j = $('#janela'); j.hidden = false;
  j.innerHTML = `<div class="jBau"><h2>${titulo}</h2><div class="raios"></div>${bauHtml(tipo, 'grande treme')}<p class="dicaBau">Toque para abrir</p><div class="premios"></div></div>`;
  let aberto = false;
  j.querySelector('.jBau').onclick = () => {
    if (aberto) return; aberto = true; const p = aoAbrir(); const b = j.querySelector('.bauG'); b.classList.remove('treme'); b.classList.add('aberto'); j.querySelector('.raios').classList.add('liga');
    j.querySelector('.dicaBau').remove(); sfx('brilho'); setTimeout(() => sfx('vitoria'), 250);
    const itens = [`<div class="premio">${ico('ouro')}<b>+${fmt(p.moedas)}</b><small>moedas</small></div>`];
    for (const [k, nome, icone] of CARTAS_INFO) if (p.cartas[k]) { const P = S.pd[k], need = cartasPara(P.nv);
      itens.push(`<div class="premio carta ${k}">${ico(icone)}<b>x${p.cartas[k]}</b><small>${nome}${p.sobe[k] ? ` · <em>${P.nv === 1 ? 'Liberado!' : `Nível ${P.nv}!`}</em>` : ` · ${P.c}/${need}`}</small></div>`); }
    const box = j.querySelector('.premios'); itens.forEach((h, i) => setTimeout(() => { box.insertAdjacentHTML('beforeend', h); sfx('nota', 3 + i * 2); }, 500 + i * 380));
    setTimeout(() => box.insertAdjacentHTML('afterend', `<button class="btn verde grande" data-a="fecharJanela">Pegar</button>`), 600 + itens.length * 380);
  };
}
function mostrarDiario() {
  const j = $('#janela'); j.hidden = false; const pronto = diarioPronto(), dia = diaDoPresente(), hojeI = pronto ? dia : (dia + 6) % 7;
  j.innerHTML = `<div class="jDiario"><h2>${ico('presente')} Presente diário</h2><p>Entre todo dia: o presente cresce. Se faltar um dia, volta ao começo.</p>
    <div class="dias">${DIARIO.map((D, i) => `<div class="dia ${i < hojeI || (!pronto && i === hojeI) ? 'pego' : i === hojeI ? 'hoje' : ''}"><small>Dia ${i + 1}</small>
      ${D.bau ? bauHtml(D.bau, 'mini') : `${ico('ouro')}<b>${fmt(Math.round((40 + 12 * S.fase) * D.moedas))}</b>`}${i < hojeI || (!pronto && i === hojeI) ? `<i>${ico('check')}</i>` : ''}</div>`).join('')}</div>
    ${pronto ? `<button class="btn amarelo grande" data-a="pegarDiario">${ico('presente')} Pegar presente</button>` : '<p class="volte">Volte amanhã para o próximo!</p>'}
    <button class="btn azul" data-a="fecharJanela">Fechar</button></div>`;
}
function clique(e) {
  const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
  if (a === 'som') { alternarSom(); som('clique'); desenharLobby(); }
  if (b.dataset.up) { if (comprar(b.dataset.up)) { som('compra'); desenharLobby(); } else som('erro'); }
  if (a === 'jogar') { som('confirma'); comecarFase(); }
  if (a === 'infinito') { if (S.melhor < 3) { som('erro'); return; } som('confirma'); comecarFase(true); }
  if (a === 'denovoInf') { som('confirma'); comecarFase(true); }
  if (a === 'sair') { som('fechar'); abrirLobby(); }
  if (a === 'proxima') { som('confirma'); comecarFase(); }
  if (a === 'lobby') { som('clique'); abrirLobby(); }
  if (b.dataset.pd) usarPoder(b.dataset.pd);
  if (a === 'roleta') pararRoleta();
  if (a === 'diario') { som('clique'); mostrarDiario(); }
  if (a === 'fecharJanela') { som('fechar'); $('#janela').hidden = true; if (tela === 'lobby') desenharLobby(); }
  if (a === 'pegarDiario') { const D = DIARIO[diaDoPresente()];
    if (D.bau) mostrarBau(D.bau, 'Presente do dia!', () => pegarDiario());
    else { const p = pegarDiario(); if (p) { sfx('vitoria'); mostrarDiario(); $('#janela .jDiario h2').insertAdjacentHTML('afterend', `<div class="premio grande">${ico('ouro')}<b>+${fmt(p.moedas)}</b></div>`); } } }
  if (b.dataset.tropa) { const k = b.dataset.tropa; if (!S.pd[k].nv) { som('erro'); return; }
    S.deck = S.deck.includes(k) ? S.deck.filter(x => x !== k) : [...S.deck, k].slice(-2); salvar(); som('clique'); desenharLobby(); }
  if (b.dataset.bau) { const i = +b.dataset.bau, tipo = S.baus[i]?.tipo; if (tipo) { som('clique'); mostrarBau(tipo, BAUS[tipo].nome, () => abrirBau(i)); } }
  if (b.dataset.vaga) tocarVaga(+b.dataset.vaga);
  if (b.dataset.tor) construir(G.menuVaga, b.dataset.tor);
}
function montarVagas() {
  $('#jVagas').innerHTML = G.vagas.map(v => `<button class="vaga" data-vaga="${v.i}"></button>`).join(''); $('#jMenuT').hidden = true; G.menuVaga = null; atualizarVagas();
}
function atualizarVagas() {
  for (const v of G.vagas) { const b = document.querySelector(`[data-vaga="${v.i}"]`); if (!b) continue;
    const T = v.tipo && TORRES[v.tipo], c = T ? T.custo[v.nv] : TORRES.balista.custo[0];
    b.innerHTML = !T ? `+<small>${ico('forca')}${c}</small>` : v.nv >= 3 ? `<i>${'★'.repeat(v.nv)}</i>` : `${ico('seta', 'up')}<small>${ico('forca')}${c}</small>`;
    b.classList.toggle('vazia', !T); b.classList.toggle('pode', !!c && v.nv < 3 && G.ouro >= c); b.classList.toggle('max', v.nv >= 3); }
  const m = $('#jMenuT'); if (G.menuVaga == null) { m.hidden = true; return; }
  m.innerHTML = Object.entries(TORRES).map(([k, T]) => `<button data-tor="${k}" class="${G.ouro >= T.custo[0] ? 'pode' : ''}">${ico(T.icone)}<b>${T.nome}</b><small>${ico('forca')}${T.custo[0]}</small></button>`).join('');
}
function tocarVaga(i) {
  const v = G.vagas[i]; if (!v || G.fim) return;
  if (!v.tipo) { G.menuVaga = G.menuVaga === i ? null : i; $('#jMenuT').hidden = G.menuVaga == null; atualizarVagas(); som('clique'); return; }
  construir(i, v.tipo);
}
export function construir(i, tipo) { // nova torre ou sobe de nível
  const v = G.vagas[i], T = TORRES[tipo]; if (!v || !T || v.nv >= 3 || (v.tipo && v.tipo !== tipo)) return false;
  const c = T.custo[v.nv]; if (G.ouro < c) { som('erro'); return false; }
  G.ouro -= c; v.tipo = tipo; v.nv++; G.menuVaga = null;
  if (v.o) cena.remove(v.o);
  v.o = C.objeto(T.modelo, T.esc * (1 + 0.12 * (v.nv - 1))); v.o.position.set(v.x, 1.9, v.z); v.o.rotation.y = Math.PI; v.o.traverse(o => { if (o.isMesh) o.castShadow = true; });
  C.faiscas(v.x, 3, v.z, 0xffd84a, 30, 6); som('compra'); G.txt.push({ x: v.x, y: 6, z: v.z, txt: v.nv > 1 ? `Nível ${v.nv}!` : T.nome + '!', cor: '#ffd84a', t: 0, grande: true });
  atualizarVagas(); return true;
}
function comecarFase(inf = false) {
  roleta = null;
  if (inf) iniciarFase(1, true); else if (!G || G.inf || G.n !== S.fase || G.t > 0) iniciarFase(S.fase);
  tela = 'jogo'; $('#lobby').hidden = true; $('#fim').hidden = true; $('#jogo').hidden = false; $('#jDica').hidden = false;
  $('#jN').textContent = G.inf ? '∞ · 1' : G.n; $('#jChefeN').textContent = G.chefe.nome; tema((G.n - 1) % 8);
  if (G.inf) faixa('PONTE SEM FIM!', '#c88aff');
  $('#jDica').textContent = G.rotas > 1 ? 'Duas rotas! Seus soldados vão pelo lado do herói' : 'Arraste para mover · toque nas vagas para construir torres';
  if (G.rotas > 1) faixa('DUAS ROTAS!', '#ffd84a');
}
const ROLETA = [2, 3, 5, 3, 2];
let roleta = null;
function pararRoleta() {
  if (!roleta || roleta.parada) return; roleta.parada = true; const extra = roleta.ganho * (roleta.m - 1);
  S.moedas += extra; salvar(); sfx('vitoria'); $('#fGanho').textContent = `+${fmt(roleta.ganho * roleta.m)}`; $('#fGanho').parentElement.classList.add('pulo');
  $('#fBotoes').hidden = true; $('#fSeguir').hidden = false;
}
function terminarInf() {
  G.fim = 'd'; tela = 'fim'; const pts = pontosInf(), novo = pts > (S.recInf || 0), ganho = Math.floor(pts / 40);
  if (novo) S.recInf = pts; S.moedas += ganho; const bau = G.chefesMortos > 0 ? ganharBau(G.n) : null; salvar();
  setTimeout(() => {
    $('#jogo').hidden = true; const f = $('#fim'); f.hidden = false;
    f.innerHTML = `<div class="fimCaixa ${novo ? 'vit' : 'der'}"><h2>${novo ? 'NOVO RECORDE!' : 'Fim da linha!'}</h2>
      <p>${G.chefesMortos} chefe${G.chefesMortos === 1 ? '' : 's'} · ${fmt(G.mortesVm)} orcs derrotados</p>
      <div class="ganho">${ico('estrela')}<b>${fmt(pts)}</b></div><p>Recorde: ${fmt(S.recInf || 0)}</p>
      <div class="ganho">${ico('ouro')}<b>+${fmt(ganho)}</b></div>
      ${bau ? `<div class="fBau">${bauHtml(bau, 'mini')}<b>${BAUS[bau].nome}!</b></div>` : ''}
      <button class="btn roxo grande" data-a="denovoInf">∞ Jogar de novo</button><button class="btn azul" data-a="lobby">${ico('raio')} Melhorias</button></div>`;
    sfx(novo ? 'vitoria' : 'derrota');
  }, 1200);
}
function terminar(venceu) {
  if (G.fim) return; if (G.inf) return terminarInf(); G.fim = venceu ? 'v' : 'd'; tela = 'fim';
  const ganho = venceu ? G.F.moedas + Math.floor(G.az.length / 4) : Math.round(G.F.moedas * 0.25);
  S.moedas += ganho; let bau = null; if (venceu) { bau = ganharBau(G.n); S.fase++; S.melhor = Math.max(S.melhor, G.n); } salvar();
  setTimeout(() => {
    $('#jogo').hidden = true; const f = $('#fim'); f.hidden = false;
    f.innerHTML = `<div class="fimCaixa ${venceu ? 'vit' : 'der'}"><h2>${venceu ? 'VITÓRIA!' : 'A muralha caiu!'}</h2>
      <p>${venceu ? `${G.chefe.nome} foi derrotado!` : 'Melhore o exército e tente de novo.'}</p>
      <div class="ganho">${ico('ouro')}<b id="fGanho">+${fmt(ganho)}</b></div>
      ${venceu ? `<div class="fBau">${bau ? `${bauHtml(bau, 'mini')}<b>${BAUS[bau].nome}!</b>` : `<small>Espaços de baú cheios: abra seus baús!</small>`}</div>` : ''}
      ${venceu ? `<div class="roleta">${ROLETA.map(m => `<span class="m${m}">x${m}</span>`).join('')}<i id="rAgulha"></i></div>
      <div id="fBotoes"><button class="btn amarelo grande" data-a="roleta">${ico('ouro')} Pegar <b id="rMult">x2</b></button>
      <button class="fSo" data-a="proxima">Só +${fmt(ganho)}, próxima fase</button></div>` : ''}
      <div id="fSeguir" ${venceu ? 'hidden' : ''}><button class="btn verde grande" data-a="proxima">${venceu ? `Fase ${S.fase} ${ico('seta')}` : 'Tentar de novo'}</button>
      <button class="btn azul" data-a="lobby">${ico('raio')} Melhorias</button></div></div>`;
    sfx(venceu ? 'vitoria' : 'derrota');
    if (venceu) { roleta = { ganho, t0: performance.now(), m: 2 }; const gira = () => { if (!roleta || roleta.parada) return;
      const k = (Math.sin((performance.now() - roleta.t0) / 1000 * 3.2 - Math.PI / 2) + 1) / 2; roleta.m = ROLETA[Math.min(ROLETA.length - 1, Math.floor(k * ROLETA.length))];
      $('#rAgulha').style.left = (k * 100) + '%'; $('#rMult').textContent = 'x' + roleta.m; requestAnimationFrame(gira); }; gira(); }
  }, venceu ? 1800 : 1200);
}

// ---------------- laço ----------------
export const _G = () => G; // para testes
export const _sim = dt => passoJogo(dt);
export const _construir = (i, k) => construir(i, k);
let distCam = 106;
export function passo(dt0) {
  let dt = dt0; if (G && G.lento > 0) { G.lento -= dt0; dt = dt0 * 0.25; }
  const t = C.tempo();
  if (G) {
    G.heroiV.mixer.update(dt);
    if (tela === 'jogo' && !G.fim) passoJogo(dt);
    else if (G.fim === 'v') { G.chefe.v.mixer.update(dt); }
    else G.chefe.v.mixer.update(dt);
    // desenha os exércitos
    desenharTropas('az', G.az, Math.PI, t); desenharTropas('vm', G.vm, 0, t); passoVoo(dt);
    // pilhas deslizam para a frente da pista
    if (G.inf && tela === 'jogo') G.pistas.forEach((p, k) => { if (p.length >= 8) return; const F = dadosFase(G.n + Math.floor(Math.random() * 3)), l = k ? F.dir : F.esq;
      for (let i = 0; i < 12; i++) novoBloco(l[8 + i], k, (p.length ? p[p.length - 1].z : ZLANE) - PASSO - 6, F.duro); });
    for (const p of G.pistas) p.forEach((b, i) => { const zAlvo = ZLANE - 2 - i * PASSO; b.z += (zAlvo - b.z) * Math.min(1, dt * 5); b.mesh.position.z = b.z; });
    const ch = G.chefe; ch.flash = Math.max(0, ch.flash - dt);
    { const f = ch.flash > 0 ? 0.45 : 0, r = ch.furia ? 0.28 + 0.12 * Math.sin(t * 9) : 0; for (const m of ch.mats) m.emissive.setRGB(f + r, f, f); }
    ch.esc += ((ch.furia ? 6 : 5) - ch.esc) * Math.min(1, dt * 3); ch.v.raiz.scale.setScalar(ch.esc);
    G.heroiV.raiz.position.x = G.heroi.x; ch.v.raiz.position.set(0, ch.y, ch.z);
    if (G.gigante) { G.gigante.v.mixer.update(dt); G.gigante.v.raiz.position.set(G.gigante.x, 0, G.gigante.z); }
    G.brilhoH = Math.max(0, G.brilhoH - dt); G.heroiV.brilho(G.brilhoH > 0 ? 0.5 * G.brilhoH : 0);
    for (const p of G.portoes) { p.pulso = Math.max(0, p.pulso - dt * 4); p.painel.scale.setScalar(1 + p.pulso * 0.12); }
    G.punch = Math.max(0, G.punch - dt * 3);
    if (G.comboT > 0 && (G.comboT -= dt) <= 0) G.combo = 0;
  }
  if (texAgua) texAgua.offset.y += dt0 * (biomaAtual === 3 ? 0.015 : biomaAtual === 2 ? 0.02 : 0.05);
  const final = G && G.fim === 'v';
  foco.x = final ? 0 : (G ? G.heroi.x : 0) * 0.25; foco.z = final ? G.chefe.z + 14 : -42;
  if (tela === 'lobby') foco.z = -42 + Math.sin(t * 0.3) * 2;
  distCam += ((final ? 62 : 106) - distCam) * Math.min(1, dt0 * 2);
  C.camera.yaw = Math.PI; C.camera.pitch = 0.9; C.camera.dist = distCam - (G ? G.punch * 7 : 0); C.camera.altura = 0; C.camera.suave = final ? 2.5 : 4;
  if (G && tela === 'jogo') posicionarVagas();
  if (window.__ov) { Object.assign(C.camera, window.__ov.cam); Object.assign(foco, window.__ov.foco); } // para testes
  C.quadro(dt, foco);
  desenharFx(dt);
}
function posicionarVagas() {
  for (const v of G.vagas) { const b = document.querySelector(`[data-vaga="${v.i}"]`), p = C.tela(v.x, v.tipo ? 6.5 : 3, v.z); if (!b) continue;
    const ver = p && p[1] > 100 && p[1] < innerHeight - 60; b.style.display = ver ? '' : 'none'; if (ver) { b.style.left = p[0] + 'px'; b.style.top = p[1] + 'px'; } }
  if (G.menuVaga != null) { const v = G.vagas[G.menuVaga], p = C.tela(v.x, 3, v.z), m = $('#jMenuT');
    if (p) { m.style.left = Math.max(92, Math.min(innerWidth - 92, p[0])) + 'px'; m.style.top = Math.max(200, p[1] - 26) + 'px'; } }
}
function limparVm() { let n = 0; G.vm = G.vm.filter(v => { if (!v.morto) return true; if (!v.muro) n++; return false; }); G.ouro += n; }
function passoJogo(dt) {
  G.t += dt; const h = G.heroi, ch = G.chefe;
  // herói anda e atira
  h.x += (h.alvo - h.x) * Math.min(1, dt * 14);
  G.cd -= dt;
  if (G.cd <= 0) {
    G.cd = 1 / G.tiro; G.heroiV.tocar('Ranged_Bow_Release', { loop: false, reinicia: true, vel: Math.max(1.2, G.tiro * 0.6) });
    for (let k = 0; k < G.nFlechas; k++) { const x = h.x + (k - (G.nFlechas - 1) / 2) * 1.1, o = new THREE.Mesh(GEO_FLECHA, MAT_FLECHA); o.position.set(x, 2.6, ZH - 1); cena.add(o); G.flechas.push({ x, z: ZH - 1, o }); }
    if (Math.random() < 0.5) sfx('arco');
  }
  // vermelhos saem do portão do chefe
  G.ondaT -= dt;
  const ritmo = G.F.ritmo * (1 + G.t / 45);
  const novoVm = r => G.vm.push({ x: xRota(r) * 0.6, z: ch.z + 5 + Math.random() * 2, ph: Math.random() * 6, ax: xRota(r) });
  if (G.ondaT <= 0) { G.ondaT = 17; const lado = Math.random() < 0.5 ? -1 : 1;
    for (let k = Math.round(ritmo * 5); k > 0 && G.vm.length < MAXU; k--) novoVm(G.rotas > 1 ? lado : 0);
    faixa(G.rotas > 1 ? `ONDA PELA ${lado < 0 ? 'ESQUERDA' : 'DIREITA'}!` : 'ONDA DE INIMIGOS!', '#ff5a4a'); ch.v.tocar('Attack2', { loop: false, reinicia: true }); som('pancada', 0.5); C.camera.tremor = 0.5; }
  if (G.t > 2) { G.spawnVm += dt * ritmo; while (G.spawnVm >= 1 && G.vm.length < MAXU) { G.spawnVm--; novoVm(Math.random() < 0.5 ? -1 : 1); } }
  // azuis entram pela base da pista do meio
  G.acum += dt * 40;
  while (G.acum >= 1 && G.fila > 0 && G.az.length < MAXU) { G.acum--; G.fila--; G.az.push(novoAzul((Math.random() - 0.5) * XC * 1.6, ZSPAWN + Math.random(), xRota(ladoHeroi()))); }
  if (G.acum > 2) G.acum = 2;
  // portões: cada azul que atravessa vira dois (x2) ou o primeiro chama reforços (+N)
  const novos = [];
  for (const p of G.portoes) {
    if (p.quebrado) continue;
    for (const a of G.az) {
      if (a.z > p.z || a.z < p.z - 3 || a.p & (1 << p.i)) continue;
      a.p = (a.p || 0) | (1 << p.i); p.pulso = 1;
      const n = p.tipo === 'vezes' ? p.valor - 1 : (p.usado ? 0 : p.valor); p.usado = true;
      for (let k = 0; k < n && G.az.length + novos.length < MAXU; k++) novos.push(novoAzul(Math.max(-XC, Math.min(XC, a.x + (Math.random() - 0.5) * 2.4)), a.z - Math.random() * 1.5, xRota(a.x < 0 ? -1 : 1), { p: a.p }));
      p.ganho += n;
    }
    p.tt -= dt;
    if (p.ganho > 0 && p.tt <= 0) { G.txt.push({ x: (Math.random() - 0.5) * 4, y: 6, z: p.z, txt: '+' + fmt(p.ganho), cor: '#8ae0ff', t: 0, grande: true }); p.ganho = 0; p.tt = 0.35; sfx('nota', 6 + Math.floor(Math.random() * 4)); }
    // o chefe passa por cima e quebra o portão
    if (ch.z + 4 >= p.z) { p.quebrado = true; cena.remove(p.o); C.faiscas(0, 3, p.z, 0x8ae0ff, 50, 8); C.camera.tremor = 0.6; som('pancada'); faixa('O CHEFE QUEBROU O PORTÃO!', '#ff9a3a'); }
  }
  if (novos.length) G.az.push(...novos);
  // grade dos vermelhos por faixa de z (para choques e flechas)
  const grade = new Map(), K = 1.6; for (const v of G.vm) { const k = Math.floor(v.z / K); let l = grade.get(k); if (!l) grade.set(k, l = []); l.push(v); }
  // marcha
  for (const a of G.az) if (!a.luta && !a.parado) { a.z -= VEL_AZ * dt; a.x += (a.ax - a.x) * Math.min(1, dt * 3); }
  for (const v of G.vm) { if (v.luta && (v.luta.morto || v.luta.luta !== v)) v.luta = null; if (!v.luta) { v.z += VEL_VM * dt; v.x += (v.ax - v.x) * Math.min(1, dt * 2); } }
  // choques: cada azul procura um vermelho à frente e mira nele; encostou, os dois caem
  let poeira = 0;
  for (const a of G.az) {
    if (a.morto) continue;
    if (a.luta) { // duelo: troca espadadas por um instante, depois resolve
      const v = a.luta; if (v.morto) { a.luta = null; continue; }
      if ((a.tl -= dt) > 0) continue;
      v.morto = true; G.mortesVm++; voar('vm', v.x, v.z, (Math.random() - 0.5) * 4, 6 + Math.random() * 4, -4 - Math.random() * 3); if (poeira++ < 6) C.faiscas(v.x, 1.4, v.z, 0xffffff, 4, 3);
      if (a.tipo === 'mago') { // explosão arcana: derruba mais orcs em volta
        let n = 1 + Math.floor(S.pd.mago.nv / 2); C.faiscas(v.x, 1.6, v.z, 0xb07aff, 14, 5);
        for (let d = -2; d <= 2 && n > 0; d++) for (const o of grade.get(Math.floor(v.z / K) + d) || []) if (n > 0 && !o.morto && Math.hypot(o.x - v.x, o.z - v.z) < 3.2) { o.morto = true; n--; G.mortesVm++; voar('vm', o.x, o.z, (o.x - v.x) * 3, 7, -3); } }
      if (a.tipo === 'lanca' && a.hp > 1) { a.hp--; C.faiscas(a.x, 1.6, a.z, 0xd8dde6, 5, 3); }
      else if (Math.random() >= G.escudo) { a.morto = true; voar(a.tipo, a.x, a.z, (Math.random() - 0.5) * 4, 5 + Math.random() * 3, 3 + Math.random() * 2); }
      a.luta = null; continue;
    }
    const k = Math.floor(a.z / K); let perto = null, d0 = 1e9;
    a.tiroT = Math.max(0, a.tiroT - dt); a.parado = false;
    if (a.tipo === 'arco') { // arqueiro: para e atira no orc mais perto à frente (ou no chefe)
      let alvo = null, da = 12; for (let d = -8; d <= 0; d++) for (const v of grade.get(k + d) || []) { if (v.morto || (G.rotas > 1 && a.z < ZFORK0 && (v.x < 0) !== (a.x < 0))) continue; const dz = a.z - v.z; if (dz > 1.6 && dz < da) { da = dz; alvo = v; } }
      const chefe = !alvo && a.z - (ch.z + 5) < 12;
      if (alvo || chefe) { a.parado = true; if ((a.cd -= dt) <= 0) { a.cd = 1.1; a.tiroT = 0.3;
        const o = new THREE.Mesh(GEO_FLECHA, MAT_FLECHA), tx = alvo ? alvo.x : a.x, tz = alvo ? alvo.z : ch.z + 4; o.position.set(a.x, 2.2, a.z); o.scale.setScalar(0.6); o.lookAt(tx, 1.2, tz); o.rotateY(Math.PI); cena.add(o);
        const acerta = Math.random() < 0.55 + 0.04 * S.pd.arco.nv; G.tiros.push({ o, tipo: 'balista', nv: 1, x0: a.x, z0: a.z, tx, tz, alvo: alvo && acerta ? alvo : null, erra: alvo && !acerta, t: 0, dur: 0.22, y0: 2.2 }); } }
    }
    for (let d = -4; d <= 1; d++) for (const v of grade.get(k + d) || []) { if (v.morto || (G.rotas > 1 && a.z < ZFORK0 && (v.x < 0) !== (a.x < 0))) continue; const dz = a.z - v.z, dx = Math.abs(a.x - v.x); if (dz > -1.5 && dz < d0) { d0 = dz; perto = v; } }
    if (!perto) continue;
    a.ax = perto.x; perto.ax = a.x;
    if (d0 < 1.4 && Math.abs(a.x - perto.x) < 1.5) { a.luta = perto; a.tl = 0.2 + Math.random() * 0.3; perto.luta = a; }
  }
  // azuis que passaram batem no chefe
  for (const a of G.az) if (!a.morto && a.z <= ch.z + 5) { a.morto = true; ferirChefe(1, a.x, a.z); voar(a.tipo, a.x, a.z, (Math.random() - 0.5) * 10, 10 + Math.random() * 6, 7 + Math.random() * 5); }
  // vermelhos que chegaram batem na muralha
  for (const v of G.vm) if (!v.morto && v.z >= ZMURO - 1.2) { v.morto = true; v.muro = true; G.muro--; C.faiscas(v.x, 1.5, v.z, 0xff5a3a, 10, 4); C.camera.tremor = Math.max(C.camera.tremor, 0.25); som('pancada', 0.3); }
  // torres
  for (const v of G.vagas) {
    if (!v.tipo || (v.cd -= dt) > 0) continue; const T = TORRES[v.tipo];
    let alvo = null, za = -1e9; for (const u of G.vm) if (!u.morto && u.z > za && Math.hypot(u.x - v.x, u.z - v.z) < T.alcance) { za = u.z; alvo = u; }
    const noChefe = !alvo && Math.hypot(v.x, ch.z + 3 - v.z) < T.alcance + 6; if (!alvo && !noChefe) continue;
    v.cd = T.cad[v.nv - 1]; const tx = alvo ? alvo.x : 0, tz = alvo ? alvo.z : ch.z + 3;
    v.o.rotation.y = Math.atan2(tx - v.x, tz - v.z) + Math.PI;
    const o = new THREE.Mesh(v.tipo === 'balista' ? GEO_FLECHA : GEO_PEDRA, v.tipo === 'balista' ? MAT_FLECHA : MAT_PEDRA_T); o.position.set(v.x, 3.5, v.z); cena.add(o);
    if (v.tipo === 'balista') o.lookAt(tx, 1.2, tz), o.rotateY(Math.PI);
    G.tiros.push({ o, tipo: v.tipo, nv: v.nv, x0: v.x, z0: v.z, tx, tz, alvo, t: 0, dur: v.tipo === 'balista' ? 0.18 : 0.8 });
    if (v.tipo === 'balista') { if (Math.random() < 0.4) sfx('arco'); } else som('pancada', 0.15);
  }
  for (const s of G.tiros) {
    s.t += dt; const k = Math.min(1, s.t / s.dur);
    s.o.position.set(s.x0 + (s.tx - s.x0) * k, 3.5 + (1.2 - 3.5) * k + (s.tipo === 'catapulta' ? Math.sin(Math.PI * k) * 12 : 0), s.z0 + (s.tz - s.z0) * k);
    if (k < 1) continue; s.fim = true; cena.remove(s.o);
    if (s.tipo === 'balista') {
      if (s.alvo && !s.alvo.morto) { s.alvo.morto = true; voar('vm', s.alvo.x, s.alvo.z, (Math.random() - 0.5) * 4, 6, -5); C.faiscas(s.tx, 1.4, s.tz, 0xffd84a, 5, 3); }
      else if (!s.alvo && !s.erra) ferirChefe(s.y0 ? 1 : 2, 0, ch.z + 3);
    } else {
      const r = TORRES.catapulta.raio[s.nv - 1]; let n = 0;
      for (const u of G.vm) if (!u.morto && Math.hypot(u.x - s.tx, u.z - s.tz) < r) { u.morto = true; n++; arremessar('vm', u, s.tx, s.tz, 9); }
      if (Math.abs(ch.z + 3 - s.tz) < r + 3) ferirChefe(4 + 2 * s.nv, 0, ch.z + 3, true);
      C.faiscas(s.tx, 1, s.tz, 0xc8a878, 24, 6); C.camera.tremor = Math.max(C.camera.tremor, 0.2); som('pancada', 0.35);
      if (n >= 3) G.txt.push({ x: s.tx, y: 5, z: s.tz, txt: `${n}!`, cor: '#ffa04a', t: 0, grande: true });
    }
  }
  G.tiros = G.tiros.filter(s => !s.fim);
  // flechas
  for (const f of G.flechas) {
    if (f.morta) continue; f.z -= 95 * dt; f.o.position.z = f.z;
    const ax = Math.abs(f.x);
    if (f.z < ZLANE && ax > DIV - 0.9 && ax < DIV + 0.9) { f.morta = true; continue; } // bateu na divisória
    if (ax >= DIV + 0.9) { // pista lateral: acerta a primeira pilha
      const p = G.pistas[f.x < 0 ? 0 : 1], b = p[0];
      if (b && f.z <= b.z + 2) { f.morta = true; acertarBloco(b, p, f.x < 0 ? -1 : 1); }
      else if (f.z < ZBOSS) f.morta = true;
    } else { // pista do meio: vermelhos e depois o chefe
      const k = Math.floor(f.z / K); let alvo = null;
      for (let d = 0; d <= 1 && !alvo; d++) for (const v of grade.get(k + d) || []) if (!v.morto && Math.abs(v.x - f.x) < 1.3 && Math.abs(v.z - f.z) < 1.8) { alvo = v; break; }
      if (alvo) { alvo.morto = true; G.mortesVm++; f.morta = true; voar('vm', alvo.x, alvo.z, (Math.random() - 0.5) * 3, 5, -6); C.faiscas(alvo.x, 1.4, alvo.z, 0xff6a4a, 6, 3); }
      else if (f.z <= ch.z + 3) { f.morta = true; ferirChefe(1, f.x, ch.z + 3); }
    }
  }
  for (const f of G.flechas) if (f.morta) cena.remove(f.o);
  G.flechas = G.flechas.filter(f => !f.morta); G.az = G.az.filter(a => !a.morto); limparVm();
  // golpe do chefe: esmaga os azuis que chegam perto
  G.golpeT -= dt;
  if (G.golpeT <= 0 && !ch.pulo && (G.az.some(a => a.z < ch.z + 22) || G.gigante?.estado === 'luta')) {
    G.golpeT = ch.furia ? 3.5 : 5; G.golpePend = 0.45; ch.v.tocar('Attack', { loop: false, reinicia: true });
  }
  if (G.golpePend > 0 && (G.golpePend -= dt) <= 0) { const zc = ch.z + 9; C.onda(0, zc, 9, 0xff9a3a, 0.5); C.faiscas(0, 1, zc, 0xc8a878, 40, 7); C.camera.tremor = 0.6; som('pancada');
    for (const a of G.az) if (Math.hypot(a.x, a.z - zc) < 9) { a.morto = true; arremessar(a.tipo, a, 0, zc, 12); } G.az = G.az.filter(a => !a.morto); if (G.gigante && Math.abs(G.gigante.z - zc) < 10) G.gigante.hp -= 15; } else if (!/Attack/.test(ch.v.anim) || G.golpeT < 4) ch.v.tocar(G.t > 6 ? 'Gallop' : 'Idle', { vel: 0.45 });
  // o chefe avança devagar até a muralha (mais rápido furioso)
  if (G.t > 6 && !ch.pulo) ch.z = Math.min(ZMURO - 7, ch.z + (0.45 + 0.02 * G.n) * (ch.furia ? 1.6 : 1) * dt);
  // com metade da vida ele fica furioso: cresce, fica vermelho, chama uma onda e começa a pular
  if (!ch.furia && ch.hp < ch.max / 2) { ch.furia = true; G.puloT = 4; G.spawnVm += Math.round(ritmo * 6); faixa(`${ch.nome.toUpperCase()} FICOU FURIOSO!`, '#ff4a3a'); intensidade(2);
    ch.v.tocar('Attack2', { loop: false, reinicia: true }); C.camera.tremor = 1; som('pancada'); }
  if (ch.furia) {
    if (Math.random() < dt * 4) C.faiscas((Math.random() - 0.5) * 6, 4 + Math.random() * 6, ch.z, 0xff4a2a, 3, 2);
    G.puloT -= dt;
    if (G.puloT <= 0 && !ch.pulo) { G.puloT = 11; const z1 = Math.min(ch.z + 10, ZMURO - 8); ch.pulo = { t: 0, z0: ch.z, z1 }; C.aviso(0, z1 + 4, 11, 0.9, 0xff3322); faixa('CUIDADO: SALTO!', '#ff9a3a'); }
    if (ch.pulo) { const P = ch.pulo; P.t += dt; const k = Math.min(1, P.t / 0.9); ch.z = P.z0 + (P.z1 - P.z0) * k; ch.y = Math.sin(Math.PI * k) * 9;
      if (k >= 1) { ch.pulo = null; ch.y = 0; const zc = ch.z + 4; C.onda(0, zc, 13, 0xff7a2a, 0.6); C.faiscas(0, 1, zc, 0xc8a878, 70, 10); C.camera.tremor = 1.2; G.punch = 1; som('pancada');
        for (const a of G.az) if (Math.hypot(a.x, a.z - zc) < 11) { a.morto = true; arremessar(a.tipo, a, 0, zc, 16); } G.az = G.az.filter(a => !a.morto); if (G.gigante && Math.abs(G.gigante.z - zc) < 12) G.gigante.hp -= 30; } }
  }
  // poderes: recarga, chuva de flechas caindo e o gigante
  for (const [k, P] of Object.entries(G.pd)) { P.cd = Math.max(0, P.cd - dt); const b = document.querySelector(`[data-pd=${k}]`); if (b) { b.style.setProperty('--h', `${100 * P.cd / P.max}%`); b.classList.toggle('pronto', P.cd <= 0); } }
  for (const c of G.chuvas) {
    c.t += dt; for (const f of c.fl) { f.o.position.y = Math.max(0.5, f.y0 - 55 * Math.max(0, c.t - f.atraso)); }
    if (c.t >= 0.75 && !c.feito) { c.feito = true; let n = 0;
      const raio = 7.5 + 0.5 * (G.pd.chuva.nv - 1);
      for (const v of G.vm) if (Math.hypot(v.x, v.z - c.z) < raio) { v.morto = true; n++; arremessar('vm', v, 0, c.z, 9); } limparVm();
      if (Math.abs(ch.z + 3 - c.z) < 9) ferirChefe(Math.round(ch.max * (0.05 + 0.008 * (G.pd.chuva.nv - 1))), 0, ch.z + 3, true);
      C.faiscas(0, 1, c.z, 0xffd84a, 50, 8); C.camera.tremor = 0.5; som('pancada', 0.5);
      if (n) G.txt.push({ x: 0, y: 5, z: c.z, txt: `${n} derrotados!`, cor: '#ffd84a', t: 0, grande: true }); }
    if (c.t > 1.4) { for (const f of c.fl) cena.remove(f.o); c.fim = true; }
  }
  G.chuvas = G.chuvas.filter(c => !c.fim);
  const gi = G.gigante;
  if (gi) {
    gi.t += dt; gi.hp -= dt * 3;
    if (gi.estado === 'anda') {
      gi.z -= 6 * dt; gi.v.tocar('Running_A', { vel: 0.8 });
      for (const v of G.vm) if (Math.abs(v.z - gi.z) < 3 && Math.abs(v.x - gi.x) < (G.rotas > 1 ? 3.2 : 5)) { v.morto = true; gi.hp -= 0.5; voar('vm', v.x, v.z, (v.x < 0 ? -1 : 1) * (8 + Math.random() * 8), 9 + Math.random() * 6, -4); if (Math.random() < 0.3) C.faiscas(v.x, 1.5, v.z, 0xff6a4a, 5, 4); }
      limparVm();
      if (gi.z <= ch.z + 8) gi.estado = 'luta';
    } else if (gi.estado === 'luta') {
      gi.z = ch.z + 8; gi.golpe -= dt;
      if (gi.golpe <= 0) { gi.golpe = 0.7; gi.v.tocar('Melee_2H_Attack_Chop', { loop: false, reinicia: true }); if (!gi.v.tem('Melee_2H_Attack_Chop')) gi.v.tocar('Melee_1H_Attack_Chop', { loop: false, reinicia: true });
        ferirChefe(Math.round(ch.max * (0.012 + 0.002 * (G.pd.gigante.nv - 1))) + 1, 0, ch.z + 4, true); C.faiscas(0, 5, ch.z + 5, 0xffffff, 12, 6); C.camera.tremor = Math.max(C.camera.tremor, 0.3); som('pancada', 0.35); }
    }
    if (gi.hp <= 0 && gi.estado !== 'cai') { gi.estado = 'cai'; gi.v.tocar('Death_A', { loop: false, reinicia: true }); gi.tFim = gi.t + 1.6; }
    if (gi.estado === 'cai' && gi.t > gi.tFim) { C.faiscas(0, 3, gi.z, 0x8ac8ff, 30, 5); gi.v.remover(); G.gigante = null; }
  }
  ch.v.mixer.update(dt);
  // HUD
  $('#jMoedas').textContent = fmt(S.moedas);
  if (G.ouroVisto !== G.ouro) { G.ouroVisto = G.ouro; $('#jOuro').textContent = fmt(G.ouro); atualizarVagas(); }
  $('#jChefeB').style.width = (100 * ch.hp / ch.max) + '%'; $('#jChefeT').textContent = `${fmt(Math.max(0, ch.hp))} / ${fmt(ch.max)}`;
  $('#jMuroB').style.width = (100 * Math.max(0, G.muro) / G.muroMax) + '%'; $('#jMuroT').textContent = `${Math.max(0, G.muro)} / ${G.muroMax}`;
  if (ch.hp <= 0 && G.inf) proximoChefe();
  else if (ch.hp <= 0) { ch.v.tocar('Death', { loop: false, reinicia: true }); for (const v of G.vm) arremessar('vm', v, 0, ch.z, 14); G.vm = []; C.camera.tremor = 1;
    G.lento = 1.6; C.faiscas(0, 6, ch.z, 0xffd84a, 120, 12); C.onda(0, ch.z, 16, 0xffd84a, 0.9); faixa('VITÓRIA!', '#ffd84a'); G.heroiV.tocar('Cheering'); terminar(true); }
  else if (ch.z >= ZMURO - 7) { G.muro = 0; C.camera.tremor = 1; faixa('O CHEFE DERRUBOU A MURALHA!', '#ff5a4a'); G.heroiV.tocar('Death_A', { loop: false, reinicia: true }); terminar(false); }
  else if (G.muro <= 0) { G.heroiV.tocar('Death_A', { loop: false, reinicia: true }); terminar(false); }
}
// joga o soldado para longe do ponto (x0, z0)
function arremessar(t, u, x0, z0, f) { const dx = u.x - x0, dz = u.z - z0, d = Math.hypot(dx, dz) || 1; voar(t, u.x, u.z, dx / d * f * 0.8, f * (0.9 + Math.random() * 0.5), dz / d * f * 0.8); }
function ferirChefe(d, x, z, forte) {
  const ch = G.chefe; ch.hp -= d; ch.flash = forte ? 0.15 : 0.08; if (forte || Math.random() < 0.3) C.faiscas(x, 3, z, 0xffffff, 4, 4);
  if (forte || Math.random() < 0.25) G.txt.push({ x, y: 9, z, txt: '-' + fmt(d), cor: forte ? '#ffd84a' : '#fff', t: 0, grande: forte });
}
function usarPoder(k) {
  if (!G || G.fim || tela !== 'jogo') return; const P = G.pd[k]; if (P.cd > 0) { som('erro'); return; }
  P.cd = P.max; const ch = G.chefe;
  if (k === 'chuva') { // cai em cima dos vermelhos mais perto da muralha (ou no chefe)
    let z = ch.z + 3; for (const v of G.vm) if (v.z > z) z = v.z; z = Math.min(z - 2, ZMURO - 8);
    const c = { t: 0, z, fl: [] };
    for (let i = 0; i < 26; i++) { const o = new THREE.Mesh(GEO_FLECHA, MAT_FLECHA), a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 7, y0 = 30 + Math.random() * 15;
      o.rotation.x = -Math.PI / 2; o.position.set(Math.cos(a) * r, y0, z + Math.sin(a) * r); cena.add(o); c.fl.push({ o, y0, atraso: Math.random() * 0.2 }); }
    G.chuvas.push(c); faixa('CHUVA DE FLECHAS!', '#8ac8ff'); G.heroiV.tocar('Ranged_Bow_Release', { loop: false, reinicia: true }); sfx('arco');
  } else {
    const v = C.heroi(visualPadrao('cav')); v.raiz.scale.setScalar(4.2); v.raiz.rotation.y = Math.PI; const gx = G.rotas > 1 ? ladoHeroi() * 2.4 : 0; v.raiz.position.set(gx, 0, ZSPAWN);
    G.gigante?.v.remover(); G.gigante = { v, x: gx, z: ZSPAWN, hp: (40 + 4 * G.n) * (1 + 0.25 * (G.pd.gigante.nv - 1)), t: 0, estado: 'anda', golpe: 0 };
    C.faiscas(0, 3, ZSPAWN, 0x8ac8ff, 40, 7); faixa('GIGANTE ALIADO!', '#8ac8ff'); sfx('magia'); C.camera.tremor = 0.5;
  }
  G.brilhoH = 1; som('confirma');
}
function acertarBloco(b, pista, lado) {
  if (b.tipo === 'barreira') {
    b.hp--; C.faiscas(b.mesh.position.x + (Math.random() - 0.5) * 6, 2.5, b.z + 0.8, 0xc89a5a, 5, 3);
    if (b.hp > 0) { redesenharBarreira(b); return; }
    som('pancada', 0.5); C.faiscas(b.mesh.position.x, 2, b.z, 0x8a5a2b, 40, 7); C.camera.tremor = 0.3;
  } else if (b.hp > 1) { // pilha resistente: encolhe a cada flechada
    b.hp--; b.mesh.scale.y = 0.45 + 0.55 * b.hp / b.hpMax; b.mesh.position.y = 1.2 * b.mesh.scale.y; C.faiscas(b.mesh.position.x + (Math.random() - 0.5) * 6, 2, b.z + 1.5, 0xffffff, 3, 2); return;
  } else if (b.tipo === 'poder') {
    if (b.p === 'flecha') { G.nFlechas = Math.min(8, G.nFlechas + 1); faixa('FLECHA EXTRA!', '#c88aff'); }
    else { G.tiro *= 1.35; faixa('TIRO RÁPIDO!', '#c88aff'); }
    G.brilhoH = 1; G.punch = 1; C.faiscas(b.mesh.position.x, 2, b.z + 1, 0xc88aff, 40, 7); C.faiscas(G.heroi.x, 3, ZH, 0xc88aff, 30, 5); sfx('magia'); sfx('brilho');
  } else {
    const n = b.tipo === 'vezes' ? Math.min(250, G.az.length + G.fila) : b.valor;
    G.fila += n; G.txt.push({ x: lado * XL, y: 4, z: b.z, txt: b.tipo === 'vezes' ? `x${b.valor}!` : `+${b.valor}`, cor: b.tipo === 'vezes' ? '#7aff8a' : lado > 0 ? '#ffd84a' : '#8ac8ff', t: 0, grande: n >= 10 });
    C.faiscas(b.mesh.position.x, 2, b.z + 1, b.tipo === 'vezes' ? 0x4aff6a : lado > 0 ? 0xffd84a : 0x5aa8ff, n >= 10 ? 26 : 12, 5);
    G.combo = (G.combo || 0) + 1; G.comboT = 1.2; sfx('nota', G.combo - 1); if (n >= 10) sfx('brilho');
    if (b.tipo === 'vezes') { faixa('EXÉRCITO DOBRADO!', '#7aff8a'); G.punch = 1; }
    else if (b.valor >= 50) { faixa(b.valor >= 99 ? 'MEGA!' : 'INCRÍVEL!', '#ffd84a'); G.punch = 0.8; }
  }
  cena.remove(b.mesh); pista.splice(pista.indexOf(b), 1);
}
function faixa(txt, cor) { G.banner = { txt, cor, t: 0 }; }
// textos flutuantes e contadores dos exércitos
function desenharFx(dt) {
  gfx.clearRect(0, 0, innerWidth, innerHeight); if (!G) return;
  const selo = (lista, cor, borda) => { if (!lista.length) return; let sx = 0, sz = 0; const n = Math.min(lista.length, 60); for (let i = 0; i < n; i++) { sx += lista[i].x; sz += lista[i].z; }
    const p = C.tela(sx / n, 5, sz / n); if (!p) return; const txt = fmt(lista.length);
    gfx.font = '22px Titulo, sans-serif'; const w = gfx.measureText(txt).width + 22;
    gfx.fillStyle = borda; gfx.beginPath(); gfx.roundRect(p[0] - w / 2 - 2, p[1] - 17, w + 4, 34, 12); gfx.fill();
    gfx.fillStyle = cor; gfx.beginPath(); gfx.roundRect(p[0] - w / 2, p[1] - 15, w, 30, 10); gfx.fill();
    gfx.fillStyle = '#fff'; gfx.textAlign = 'center'; gfx.textBaseline = 'middle'; gfx.fillText(txt, p[0], p[1] + 1); };
  if (tela === 'jogo') {
    if (G.rotas > 1) for (const s of [-1, 1]) { selo(G.az.filter(u => u.z < ZFORK0 && (u.x < 0) === (s < 0)), '#2f74e0', '#0f2f6a'); selo(G.vm.filter(u => (u.x < 0) === (s < 0)), '#d8342a', '#5a0e0a'); }
    else { selo(G.az, '#2f74e0', '#0f2f6a'); selo(G.vm, '#d8342a', '#5a0e0a'); }
    if (G.fila > 0) { const p = C.tela(0, 3, ZSPAWN); if (p) { gfx.font = '20px Titulo, sans-serif'; gfx.textAlign = 'center'; gfx.lineWidth = 4; gfx.strokeStyle = '#0f2f6a'; gfx.strokeText(`+${fmt(G.fila)}`, p[0], p[1]); gfx.fillStyle = '#8ac8ff'; gfx.fillText(`+${fmt(G.fila)}`, p[0], p[1]); } }
  }
  for (const t of G.txt) { t.t += dt; const p = C.tela(t.x, t.y + t.t * 3, t.z); if (!p) continue; gfx.globalAlpha = Math.max(0, 1 - Math.max(0, t.t - 0.5) / 0.5);
    gfx.font = `${t.grande ? 34 : 24}px Titulo, sans-serif`; gfx.textAlign = 'center'; gfx.lineWidth = 5; gfx.strokeStyle = 'rgba(0,0,0,.7)'; gfx.strokeText(t.txt, p[0], p[1]); gfx.fillStyle = t.cor; gfx.fillText(t.txt, p[0], p[1]); gfx.globalAlpha = 1; }
  G.txt = G.txt.filter(t => t.t < 1);
  const B = G.banner;
  if (B) { B.t += dt; const k = Math.min(1, B.t / 0.18), s = k < 1 ? 0.4 + 0.9 * k : 1 + 0.08 * Math.max(0, 1 - (B.t - 0.18) * 4), a = Math.max(0, 1 - Math.max(0, B.t - 1.1) / 0.4);
    gfx.save(); gfx.globalAlpha = a; gfx.translate(innerWidth / 2, innerHeight * 0.36); gfx.scale(s, s); gfx.rotate(-0.04);
    let fs = 40; gfx.font = `${fs}px Titulo, sans-serif`; while (fs > 18 && gfx.measureText(B.txt).width > innerWidth - 40) gfx.font = `${fs -= 2}px Titulo, sans-serif`;
    gfx.textAlign = 'center'; gfx.textBaseline = 'middle'; gfx.lineWidth = 9; gfx.lineJoin = 'round'; gfx.strokeStyle = 'rgba(30,10,0,.85)'; gfx.strokeText(B.txt, 0, 0); gfx.fillStyle = B.cor; gfx.fillText(B.txt, 0, 0);
    gfx.restore(); if (B.t > 1.5) G.banner = null; }
}
