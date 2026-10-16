// Batalha da Ponte: o herói atira flechas nas pilhas de +N das laterais para ganhar soldados.
// O exército azul marcha pelo meio contra o exército vermelho e o chefe no fim da ponte.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as C from './cena.js';
import { HABILIDADES, fase as dadosFase, tiros, vidaMuralha, escudo, fmt, UPGRADES } from './dados.js';
import { S, salvar, fimDeSemana, mudouDesdeBackup, backupFeito, darCartas, comprar, BAUS, MAX_BAUS, ganharBau, abrirBau, cartasPara, CARTAS, DIARIO, diarioPronto, diaDoPresente, pegarDiario } from './meta.js';
import { visualPadrao } from './aparencia.js';
import { ico, som, $, alternarSom, estaMudo, voarMoedas, flashTela, contarAte } from './util.js';
import { tema, sfx, intensidade } from './musica.js';
import * as ON from './online.js';
import { HEROIS, heroiAtual } from './herois.js';
import { criarTropas, desenharTropas, voar, passoVoo, limparTropas } from './tropas.js';
import { PETS, RARIDADES, CLASSES, OVOS, BONUS as BONUS_PET, ESTRELAS, MAX_EQUIPE, MAX_NV, MAX_EST, base, est, qtd, temPet, modeloDe, tinta, atributos, forca, forcaEquipe, custoNivel, subirNivel, juntar, equipar, equiparMelhores, chocar, bonusPet, bonusEquipe, txtBonus, lucroOcioso, coletarOcioso, tempoOcioso, lucroHora, MAX_OCIOSO, GOLPES, golpe, cdGolpe, forcaGolpe } from './pets.js';
import * as CQ from './conquista.js';
import * as CT from './castelo.js';
import { MEDALHAS, NIVEIS_MEDALHA, nivelMedalha, pegas, medalhasProntas, premioMedalha, pegarMedalha } from './perfil.js';
import { ofertas, lojaDia, comprarOferta, temOferta } from './loja.js';
import { TIPOS as TIPOS_MISSAO, PTS_NIVEL, NIVEIS_PASSE, atualizarMissoes, evento, prontas, pegarMissao, premioNivel, nivelPasse, pegarNivel, fimTemporada } from './missoes.js';
import { traduzir, nomeIdioma, idioma, precisa } from './traduzir.js';
import { t as tr, IDIOMAS, idiomaJogo, mudarIdioma } from './i18n.js';

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
const maxFila = () => G?.inf ? Math.min(1500, 400 + 150 * G.chefesMortos) : 400;
const ZFRENTE = ZBOSS - 35, ZTRAS = 40;
const ZFORK0 = ZLANE - 5, ZFORK1 = ZBOSS + 15; // trecho com duas rotas
// torres que o jogador constrói durante a batalha com o ouro ⚔ dos orcs derrotados
const TORRES = {
  balista: { nome: 'Balista', modelo: 'C:siege-ballista', esc: 4.6, icone: 'h_perfura', custo: [25, 45, 80], alcance: 30, cad: [0.9, 0.6, 0.4] },
  catapulta: { nome: 'Catapulta', modelo: 'C:siege-catapult', esc: 4.2, icone: 'h_meteoro', custo: [50, 90, 140], alcance: 42, cad: [3, 2.3, 1.7], raio: [3.2, 3.9, 4.6] },
};
// sacada de pedra presa do lado de fora da ponte, com mureta
const XVAGA = MEIA + 3.2;
const GEO_VAGA = mergeGeometries([new THREE.CylinderGeometry(3.4, 3.4, 1.2, 20).translate(0, -0.6, 0), new THREE.ConeGeometry(3.4, 5, 20).rotateX(Math.PI).translate(0, -3.7, 0),
  ...Array.from({ length: 10 }, (_, i) => { const a = Math.PI * 0.5 + (i / 9) * Math.PI, s = 1; return new THREE.BoxGeometry(0.9, 0.9, 0.9).translate(Math.cos(a) * 3.1 * s, 0.45, Math.sin(a) * 3.1); })]);
const MAT_VAGA = new THREE.MeshLambertMaterial({ color: 0x9a9088 });
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
  txt = tr(txt); const k = txt + fundo + w; if (texCache[k]) return texCache[k];
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
const MUROS_PISTA = [];
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
    const m = new THREE.Mesh(mergeGeometries(geos), MAT_MURO); m.castShadow = true; m.receiveShadow = true; cena.add(m); return m;
  };
  muro(-MEIA - 0.6, -MEIA - 0.6, ZTRAS, ZFRENTE, 1.6); muro(MEIA + 0.6, MEIA + 0.6, ZTRAS, ZFRENTE, 1.6);
  MUROS_PISTA.push(muro(-DIV, -DIV, ZLANE, ZBOSS - 6, 1.6), muro(DIV, DIV, ZLANE, ZBOSS - 6, 1.6), muro(-MEIA, MEIA, ZMURO, ZMURO, 1.3));
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
    const amarelo = b.valor >= 10, txt = b.tipo === 'vezes' ? `x${b.valor}` : `+${b.valor}`, fundo = b.tipo === 'vezes' ? '#2bb84a' : amarelo ? '#f2b51a' : '#2f7ae8', borda = b.tipo === 'vezes' ? '#13702a' : amarelo ? '#a8740a' : '#173f9a';
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

// eventos de fase (a partir da fase 3, ~70% das fases): mudam o clima e as regras
export const EVENTOS = {
  noite: { nome: 'Noite', icone: 'h_sombra', desc: 'Tudo escuro · +30% moedas', cor: '#8a9aff' },
  meteoros: { nome: 'Chuva de meteoros', icone: 'h_meteoro', desc: 'Meteoros acertam os dois exércitos', cor: '#ff8a3a' },
  ouro: { nome: 'Febre do ouro', icone: 'ouro', desc: 'Pilhas valem +50% · orcs mais rápidos', cor: '#ffd23a' },
  nevoa: { nome: 'Neblina', icone: 'h_gelo', desc: 'Não dá para ver longe · orcs mais lentos', cor: '#c8d8e8' },
  furia: { nome: 'Chefe furioso', icone: 'h_furia', desc: 'O chefe já começa furioso · +50% moedas', cor: '#ff5a4a' },
};
export function eventoDaFase(n) { if (n < 3 || ((n * 2654435761) >>> 0) % 100 < 30) return null; const ks = Object.keys(EVENTOS); return ks[(n * 7 + 3) % ks.length]; }
export const ehCorrida = () => false; // fase Corrida desligada (código guardado para uma versão futura)
export function iniciarFase(n, inf = false, semCorrida = false) {
  limparFase(); montarCenario(biomaDe(n));
  { const B = BIOMAS[biomaDe(n)]; C.diaNoite(0); C.ceu(B.ceu); C.neblina(...B.nevoa); } // clima normal (o evento muda abaixo)
  const F = dadosFase(n), up = S.up, corrida = !inf && !semCorrida && ehCorrida(n);
  for (const m of MUROS_PISTA) m.visible = !corrida;
  G = { F, n, t: 0, az: [], vm: [], flechas: [], txt: [], fila: 8 * up.exercito, acum: 0, cd: 0.5, pistas: [[], []], spawnVm: 0, golpePend: 0,
    muro: vidaMuralha(up.vida), muroMax: vidaMuralha(up.vida), tiro: tiros(up.fogo), tiroMax: tiros(up.fogo) * 2.2, nFlechas: 1 + up.flechas, flechasMax: up.flechas + 5, escudo: escudo(up.escudos),
    heroi: { x: 0, alvo: 0 }, golpeT: 4, fim: null, mortesVm: 0, portoes: [], ondaT: 16, banner: null, punch: 0, lento: 0, brilhoH: 0,
    pd: { chuva: { cd: 4, max: Math.max(6, 11 - 0.6 * (S.pd.chuva.nv - 1)), nv: S.pd.chuva.nv }, gigante: { cd: 12, max: Math.max(16, 30 - 1.8 * (S.pd.gigante.nv - 1)), nv: S.pd.gigante.nv } }, chuvas: [], gigante: null, puloT: 0,
    inf, chefesMortos: 0, tornados: [], medoT: 0, fogos: [], congelado: 0, multPilha: 1, velVm: 1, perfura: 0, autoChuva: false, escolhas: 0, proxEscolha: 14, pausa: false, pedras: [], pedraT: 9, tonto: 0, bonus: [], rotas: F.rotas, ouro: 25, deck: S.deck.filter(k => S.pd[k]?.nv > 0), vagas: [], tiros: [], menuVaga: null };
  if (corrida) { G.rotas = 1; F.vagas = 0; }
  aplicarBonusPets();
  G.evento = inf || semCorrida ? null : eventoDaFase(n); G.multMoedas = 1; G.meteoros = []; G.metT = 7;
  if (G.evento === 'noite') { C.diaNoite(0.47); C.ceu(0x141c34); C.neblina(140, 420); G.multMoedas = 1.3; }
  if (G.evento === 'nevoa') { C.ceu(0xc8d2dc); C.neblina(45, 150); G.velVm *= 0.8; }
  if (G.evento === 'ouro') { G.multPilha *= 1.5; F.ritmo *= 1.3; }
  if (G.evento === 'furia') G.multMoedas = 1.5;
  // duas rotas: um muro baixo divide a pista do meio
  if (G.rotas > 1) { G.forquilha = new THREE.Mesh(new THREE.BoxGeometry(1, 1.6, ZFORK0 - ZFORK1).translate(0, 0.8, (ZFORK0 + ZFORK1) / 2), MAT_MURO); G.forquilha.castShadow = G.forquilha.receiveShadow = true; cena.add(G.forquilha); }
  // vagas de torre em cima das divisórias
  for (let i = 0; i < F.vagas; i++) { const lado = i % 2 ? 1 : -1, x = lado * XVAGA, z = ZLANE - 12 - Math.floor(i / 2) * 24;
    const base = new THREE.Mesh(GEO_VAGA, MAT_VAGA); base.position.set(x, 0, z); base.rotation.y = lado > 0 ? 0 : Math.PI; base.receiveShadow = base.castShadow = true; cena.add(base);
    G.vagas.push({ i, x, z, base, tipo: null, nv: 0, cd: 0, o: null }); }
  montarVagas();
  if (!corrida) {
    for (const p0 of F.portoes) { const p = { ...p0, z: ZLANE - 2 - p0.i * PASSO }; criarPortao(p); G.portoes.push(p); }
    [F.esq, F.dir].forEach((lista, k) => lista.forEach((b0, i) => novoBloco(b0, k, ZLANE - 2 - i * PASSO, F.duro)));
  }
  criarChefe(F); if (G.evento === 'furia') { G.chefe.furia = true; G.puloT = 6; }
  if (corrida) montarCorrida(F, n);
  // herói arqueiro
  G.heroiDef = heroiAtual(S); G.tiro *= G.heroiDef.ataque.cad; G.tiroMax *= G.heroiDef.ataque.cad;
  if (!G.heroiV) { const v = C.heroi(G.heroiDef.visual); v.raiz.scale.setScalar(2.4); v.raiz.rotation.y = Math.PI; v.tocar(v.tem(G.heroiDef.pose) ? G.heroiDef.pose : 'Idle_A'); G.heroiV = v; }
  G.heroiV.raiz.position.set(0, 0, ZH);
  criarPetsHeroi();
}
// bônus dos pets da equipe na ponte
const assinaturaPets = () => S.equipe.map(k => k + S.pets[base(k)]?.nv).join();
function aplicarBonusPets() {
  const B = { ...bonusEquipe() }, R = bonusRenasc(S.renasc || 0); for (const k in R) B[k] = (B[k] || 0) + R[k];
  const f = t => (B[t] || 0) / 100; G.bonusPets = B; G.assinatura = assinaturaPets();
  G.fila += Math.round((G.fila + 20) * f('soldados')); G.tiro *= 1 + f('tiro'); G.tiroMax *= 1 + f('tiro');
  G.muroMax = G.muro = Math.round(G.muroMax * (1 + f('muralha'))); G.multPilha *= 1 + f('pilhas'); G.escudo = Math.min(0.8, G.escudo + f('escudo'));
  for (const P of Object.values(G.pd)) P.max /= 1 + f('recarga'); G.velVm *= 1 - f('lento') * 0.5;
  G.multChefe = 1 + f('chefe'); G.crit = f('critico'); G.reviver = f('reviver'); G.perfura += B.fogo || 0;
}
// pets da equipe (até 3) andam atrás do herói e atiram junto
const POS_PET = [[-3.4, 2.6], [3.4, 2.6], [0, 4.6]];
function criarPetsHeroi() {
  G.petsV = S.equipe.slice(0, 3).map((k, i) => { const m = modeloDe(k), v = C.personagem(m, [], 1); if (tinta(k) != null) C.tingirOuro(v.corpo, false, tinta(k));
    v.raiz.scale.setScalar(2.7 * (1 + 0.08 * est(k)) / (C.alturaModelo(m) * C.ESC_PERS)); v.raiz.rotation.y = Math.PI; v.tocar('Idle'); v.mixer.update(Math.random());
    const D = PETS[base(k)]; return { k, v, x: POS_PET[i][0], dz: POS_PET[i][1], cd: 1 + i * 0.4, cor: D.cor || 0xffe08a, dano: 1 + (D.r >= 2 ? 1 : 0) + est(k), cad: D.c === 'atirador' ? 1.1 : 1.6, gcd: golpe(k) ? cdGolpe(k) * 0.5 : null }; });
}
function passoPetsHeroi(dt, atira) {
  const h = G.heroi, anda = Math.abs(h.alvo - h.x) > 0.6;
  for (const p of G.petsV || []) {
    const ax = h.x + POS_PET[G.petsV.indexOf(p)][0]; p.x += (ax - p.x) * Math.min(1, dt * 6);
    p.v.raiz.position.set(p.x, Math.abs(Math.sin(C.tempo() * 9 + p.dz)) * (anda ? 0.5 : 0), ZH + p.dz); p.v.mixer.update(dt);
    if (atira && (p.cd -= dt) <= 0) { p.cd = p.cad; const o = projetilHeroi('orbe', p.cor); o.scale.setScalar(0.7); o.position.set(p.x, 2.2, ZH + p.dz - 1); cena.add(o);
      G.flechas.push({ x: p.x, z: ZH + p.dz - 1, o, dano: p.dano, perf: 0, area: 0, proj: 'orbe' }); p.v.tocar('Attack', { loop: false, reinicia: true }); p.atk = 0.5; }
    if (atira && p.gcd != null && (p.gcd -= dt) <= 0 && golpePonte(p)) p.gcd = cdGolpe(p.k);
    if ((p.atk = (p.atk || 0) - dt) <= 0) p.v.tocar(anda ? 'Gallop' : 'Idle');
  }
}
// golpe especial dos pets épicos/lendários na Ponte (sai sozinho)
function golpePonte(p) {
  const id = base(p.k), F = forcaGolpe(p.k), ch = G.chefe, vivos = G.vm.filter(v => !v.morto), Gp = GOLPES[id];
  if (!ch || ch.hp <= 0) return false;
  if ((id === 'dragao' || id === 'ninja') && !vivos.length && ch.z < ZMURO - 60) return false; // espera ter alvo
  const matar = l => { for (const v of l) { v.morto = true; G.mortesVm++; voar('vm', v.x, v.z, (Math.random() - 0.5) * 6, 9, -3); } limparVm(); };
  if (id === 'dragao') { const l = vivos.sort((a, b) => b.z - a.z).slice(0, Math.round(10 * F)); matar(l); for (const v of l.slice(0, 8)) C.faiscas(v.x, 1.5, v.z, 0xff6a1a, 6, 4);
    if (!l.length) ferirChefe(Math.round(ch.max * 0.012 * F), 0, ch.z + 3, true); }
  if (id === 'ninja') { const l = vivos.sort(() => Math.random() - 0.5).slice(0, Math.round(7 * F)); matar(l); ferirChefe(Math.round(ch.max * 0.006 * F), 0, ch.z + 3); }
  if (id === 'fantasma') { G.medoT = Math.max(G.medoT || 0, 2.5 + est(p.k)); for (const v of vivos) v.z -= 3; C.onda(p.x, ZH - 8, 14, 0xc8d8ff, 0.6); }
  if (id === 'lula') { ch.habT += 4; G.medoT = Math.max(G.medoT || 0, 2); ferirChefe(Math.round(ch.max * 0.01 * F), 0, ch.z + 3); C.faiscas(0, 5, ch.z + 3, 0x6a3ab0, 40, 7); }
  if (id === 'totem') { if (G.muro >= G.muroMax) return false; G.muro = Math.min(G.muroMax, G.muro + Math.ceil(G.muroMax * 0.1 * F)); C.faiscas(0, 2, ZMURO, 0x6aff8a, 30, 6); }
  if (id === 'merlin') { ferirChefe(Math.round(ch.max * 0.02 * F), 0, ch.z + 3, true); C.onda(0, ch.z + 3, 7, 0xb07aff, 0.5); }
  G.txt.push({ x: p.x, y: 6, z: ZH + p.dz, txt: Gp.nome, cor: '#ffd84a', t: 0, grande: true });
  p.v.tocar('Attack2', { loop: false, reinicia: true }); p.atk = 0.7; sfx('magia'); return true;
}
const REDONDOS = [1, 2, 3, 5, 10, 15, 20, 25, 50, 75, 99, 150, 200, 250, 300, 400, 500, 750, 1000];
function blocoInf(b, k) { // ponte sem fim: cada chefe derrotado deixa as pilhas maiores (e mais duras)
  if (b.tipo === 'poder') return { tipo: 'mais', valor: k ? 5 : 3 };
  if (b.tipo === 'vezes') return { tipo: 'vezes', valor: G.chefesMortos >= 3 && Math.random() < 0.35 ? 3 : 2 };
  if (b.tipo !== 'mais') return b;
  const alvo = b.valor * (1 + 0.7 * G.chefesMortos), valor = REDONDOS.reduce((m, v) => Math.abs(v - alvo) < Math.abs(m - alvo) ? v : m, 1);
  return { tipo: 'mais', valor };
}
function novoBloco(b0, k, z, duro) {
  const b = { ...b0, z }; if (b.tipo !== 'barreira') b.hp = b.hpMax = (b.tipo === 'mais' ? Math.max(1, Math.round(1.3 * Math.log(b.valor))) : 3) + duro;
  criarBloco(b, k ? 1 : -1); G.pistas[k].push(b);
}
function criarChefe(F) {
  const ch = C.personagem(F.chefe.modelo, [], 1); ch.raiz.scale.setScalar(5); ch.raiz.position.set(0, 0, ZBOSS); ch.tocar('Idle');
  G.chefe = { v: ch, hp: F.chefe.hp, max: F.chefe.hp, nome: F.chefe.nome, flash: 0, z: ZBOSS, y: 0, esc: 5, mats: [], hab: HABILIDADES[F.chefe.modelo]?.id, habT: 10, avisoHab: 0 };
  ch.raiz.traverse(o => { if (o.material?.emissive) G.chefe.mats.push(o.material); });
}
// ponte sem fim: chefe derrotado explode e vem o próximo, mais forte (pistas e portões se renovam)
function proximoChefe() {
  const ch = G.chefe; G.chefesMortos++; G.n++; const F = dadosFase(G.n);
  C.faiscas(0, 6, ch.z, 0xffd84a, 120, 12); C.camera.tremor = 1; G.lento = 1; G.punch = 1; sfx('vitoria');
  for (const v of G.vm) arremessar('vm', v, 0, ch.z, 14); G.vm = []; G.chuvas.length = 0;
  if (ch.bolha) cena.remove(ch.bolha); for (const fg of G.fogos) cena.remove(fg.o); G.fogos = []; G.congelado = 0;
  ch.v.remover(); G.F = F; G.t = 0; G.proxEscolha = 14; G.ondaT = 16; G.puloT = 0; G.golpePend = 0; intensidade(1);
  criarChefe(F); G.chefe.hp = G.chefe.max = Math.round(F.chefe.hp * (1 + 0.25 * G.chefesMortos)); $('#jChefeN').textContent = G.chefe.nome; $('#jN').textContent = `∞ · ${G.chefesMortos + 1}`;
  for (const p of G.portoes) cena.remove(p.o); G.portoes = [];
  for (const p0 of F.portoes) { const p = { ...p0, z: ZLANE - 2 - p0.i * PASSO }; criarPortao(p); G.portoes.push(p); }
  G.ouro += 30; G.muro = Math.min(G.muroMax, G.muro + Math.ceil(G.muroMax * 0.25));
  faixa(`CHEFE ${G.chefesMortos} DERROTADO!`, '#ffd84a'); G.txt.push({ x: 0, y: 8, z: -40, txt: '+1000', cor: '#ffd84a', t: 0, grande: true });
  montarCenario(biomaDe(G.n));
}
// ---- bônus no meio da fase: escolha 1 de 3 ----
const BONUS = {
  flechas: { nome: 'Tiro triplo', icone: 'h_triplo', desc: '+2 flechas por tiro', usar: () => { G.nFlechas = Math.min(G.flechasMax, G.nFlechas + 2); } },
  furia: { nome: 'Fúria', icone: 'raio', desc: 'Atira 40% mais rápido', usar: () => { G.tiro = Math.min(G.tiroMax, G.tiro * 1.4); } },
  recrutas: { nome: 'Reforços', icone: 'herois', desc: () => `+${40 + 10 * G.n} soldados agora`, usar: () => { G.fila = Math.min(maxFila(), G.fila + 40 + 10 * G.n); } },
  escudos: { nome: 'Escudos de ferro', icone: 'escudo', desc: '+20% dos soldados sobrevivem', usar: () => { G.escudo = Math.min(0.8, G.escudo + 0.2); } },
  muralha: { nome: 'Muralha reforçada', icone: 'forja', desc: 'Muralha +50% e curada', usar: () => { G.muroMax = Math.round(G.muroMax * 1.5); G.muro = G.muroMax; } },
  ouro: { nome: 'Ouro de guerra', icone: 'forca', desc: '+80 de ouro para torres', usar: () => { G.ouro += 80; } },
  recarga: { nome: 'Recarga rápida', icone: 'relogio', desc: 'Poderes prontos e 40% mais rápidos', usar: () => { for (const P of Object.values(G.pd)) { P.max *= 0.6; P.cd = 0; } } },
  gelo: { nome: 'Flechas de gelo', icone: 'h_gelo', desc: 'Orcs andam 30% mais devagar', usar: () => { G.velVm *= 0.7; } },
  fogo: { nome: 'Flechas de fogo', icone: 'h_fogo', desc: 'Cada flecha atravessa +2 orcs', usar: () => { G.perfura += 2; } },
  pilhas: { nome: 'Pilhas em dobro', icone: 'estrela', desc: 'Pilhas dão +50% soldados', usar: () => { G.multPilha *= 1.5; } },
  chuvaAuto: { nome: 'Chuva automática', icone: 'h_chuva', desc: 'A chuva cai sozinha quando pronta', usar: () => { G.autoChuva = true; } },
};
function abrirEscolha() {
  const ops = Object.keys(BONUS).filter(k => !(k === 'chuvaAuto' && G.autoChuva) && !(k === 'escudos' && G.escudo >= 0.8)).sort(() => Math.random() - 0.5).slice(0, 3);
  G.pausa = true; G.escolhas++; sfx('brilho');
  const j = $('#janela'); j.hidden = false;
  j.innerHTML = `<div class="jEscolha"><h2>Escolha um bônus!</h2><div class="opcoes">${ops.map(k => { const B = BONUS[k];
    return `<button class="opcao" data-bonus="${k}"><span>${ico(B.icone)}</span><b>${B.nome}</b><small>${typeof B.desc === 'function' ? B.desc() : B.desc}</small></button>`; }).join('')}</div></div>`;
}
function escolherBonus(k) {
  const B = BONUS[k]; if (!B || !G) return; B.usar(); G.bonus.push(k); $('#janela').hidden = true; G.pausa = false;
  faixa(B.nome.toUpperCase() + '!', '#c88aff'); G.brilhoH = 1; G.punch = 1; C.faiscas(G.heroi.x, 3, ZH, 0xc88aff, 40, 6); sfx('magia'); sfx('vitoria');
}
const pontosInf = () => G.chefesMortos * 1000 + G.mortesVm;
function limparFase() {
  if (!G) return;
  for (const p of G.pistas) for (const b of p) cena.remove(b.mesh);
  for (const f of G.flechas) cena.remove(f.o);
  for (const p of G.portoes) cena.remove(p.o);
  G.chefe?.v.remover(); G.heroiV?.remover(); G.gigante?.v.remover(); for (const p of G.petsV || []) p.v.remover();
  if (G.dupla) { G.dupla.v.remover(); if (!G.dupla.manter) G.dupla.canal?.fechar(); }
  for (const c of G.chuvas) for (const f of c.fl) cena.remove(f.o);
  for (const p of G.pedras) cena.remove(p.o);
  if (G.corrida) for (const o of G.corrida.objs) cena.remove(o);
  for (const tn of G.tornados) cena.remove(tn.o); for (const fg of G.fogos) cena.remove(fg.o); if (G.chefe?.bolha) cena.remove(G.chefe.bolha); for (const c of G.chuvas) if (c.o) cena.remove(c.o); if (G.escudoO) cena.remove(G.escudoO);
  for (const v of G.vagas) { cena.remove(v.base); if (v.o) cena.remove(v.o); }
  for (const s of G.tiros) cena.remove(s.o); for (const m of G.meteoros || []) cena.remove(m.o);
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
      <div class="jEmojis" id="jEmojis" hidden>${['👍', '😂', '🔥', '😱'].map(e => `<button data-emo="${e}">${e}</button>`).join('')}</div>
      <div class="jPoderes"><button class="poder" data-pd="chuva">${ico('h_chuva')}<small>Chuva</small></button><button class="poder" data-pd="gigante">${ico('cav')}<small>Gigante</small></button></div>
      <div class="jMuro">${ico('escudo')}<div class="barra muro"><i id="jMuroB"></i><span id="jMuroT"></span></div></div>
      <p class="jDica" id="jDica">Arraste para mover · as flechas saem sozinhas</p>
      <div id="tut" hidden><p class="tutBalao"></p><div class="tutMao">${ico('mao')}</div></div></div>
    <div id="fim" hidden></div><div id="conq" hidden></div><div id="castelo" hidden></div><div id="janela" hidden></div>`;
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
  roleta = null; abaLobby = 'home';
  tela = 'lobby'; $('#jogo').hidden = true; $('#fim').hidden = true; $('#lobby').hidden = false; tema('guilda');
  iniciarFase(S.fase); desenharLobby();
  if (!diarioVisto && diarioPronto()) { diarioVisto = true; setTimeout(mostrarDiario, 900); }
  else setTimeout(coletarPremios, 1200);
  if (!resumoFeito) { resumoFeito = true; const fora = Date.now() - (S.vistoT || Date.now()); if (fora > 20 * 60e3) setTimeout(() => mostrarResumo(fora), 1500); }
  marcarVisto();
  setTimeout(enviarPerfil, 2500); setTimeout(() => salvarDefesa().catch(() => {}), 5000); setTimeout(() => ON.botsTick().catch(() => {}), 7000); setTimeout(() => { backupNuvem(!nuvemT); if (S.temSenha == null && S.online?.codigo) ON.temSenha().then(t => { S.temSenha = !!t; salvar(); }).catch(() => {}); }, 4000);
}
let diarioVisto = false, resumoFeito = false;
// ---- notificações do celular (só no APK, que expõe window.Avisos): agenda ao sair, cancela ao voltar ----
function agendarAvisos() {
  const A = window.Avisos; if (!A || !S) return; cancelarAvisos();
  try {
    const falta = MAX_OCIOSO - tempoOcioso(); if (S.cq?.est > 1 && falta > 60e3) A.agendar(1, Math.round(falta / 1000), tr('Lucro ocioso cheio!'), tr(`Seus pets juntaram ${fmt(lucroHora() * 9)} moedas. Venha coletar!`));
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); A.agendar(2, Math.round((d - Date.now()) / 1000), tr('Presente diário pronto!'), tr('Abra o jogo e pegue o presente de hoje.'));
    A.agendar(3, 26 * 3600, tr('Os orcs estão atacando a ponte!'), tr('Volte e defenda a ponte com seus pets.'));
  } catch (e) {}
}
function cancelarAvisos() { const A = window.Avisos; if (!A) return; try { for (const id of [1, 2, 3]) A.cancelar(id); } catch (e) {} }
{ const orig = window.__pausar; window.__pausar = p => { orig?.(p); if (p) agendarAvisos(); else cancelarAvisos(); }; }
document.addEventListener('visibilitychange', () => { if (document.hidden) agendarAvisos(); else cancelarAvisos(); });
const marcarVisto = () => { S.vistoT = Date.now(); salvar(); };
setInterval(() => { if (S && tela) marcarVisto(); }, 60e3);
// ---- bem-vindo de volta: o que aconteceu enquanto a pessoa estava fora ----
async function mostrarResumo(fora, tentativas = 0) {
  if (tela !== 'lobby') return; if (!$('#janela').hidden) { if (tentativas < 30) setTimeout(() => mostrarResumo(fora, tentativas + 1), 1000); return; }
  let def = 0; try { if (S.online?.codigo) def = (await ON.arenaDefesas() || []).filter(d => d.novo).length; } catch (e) {}
  const L = lucroOcioso(), baus = S.baus.length, miss = prontas(), h = Math.floor(fora / 3600e3), m = Math.floor(fora / 60e3) % 60;
  if (!L && !baus && !miss && !def) return;
  const item = (icone, txt, extra = '') => `<div class="rsItem">${ico(icone)}<span>${txt}</span>${extra}</div>`;
  const j = $('#janela'); if (!j.hidden || tela !== 'lobby') return; j.hidden = false; sfx('brilho');
  j.innerHTML = `<div class="jOnline jResumo"><h2>${ico('presente')} Bem-vindo de volta!</h2><p class="sub">Você ficou fora ${h ? `${h}h ` : ''}${m}min</p>
    ${L ? item('ouro', `Lucro ocioso: <b>${fmt(L)}</b> moedas`, `<button class="btn amarelo peq" data-a="rsColetar">Coletar</button>`) : ''}
    ${baus ? item('bau', `${baus} baú${baus > 1 ? 's' : ''} para abrir`) : ''}
    ${miss ? item('missoes', `${miss} missão${miss > 1 ? 'ões' : ''} pronta${miss > 1 ? 's' : ''} para pegar`) : ''}
    ${def ? item('pata', `${def} jogador${def > 1 ? 'es' : ''} enfrentou${def > 1 ? 'aram' : ''} sua equipe na Conquista`) : ''}
    <button class="btn verde grande" data-a="fecharJanela">Vamos lá!</button></div>`;
}
// ---- lobby: cena 3D atrás do herói, card da fase, JOGAR, baús e abas embaixo ----
let abaLobby = 'home';
const ABAS = [['home', 'Batalha', 'h_triplo'], ['up', 'Melhorias', 'raio'], ['cartas', 'Heróis', 'herois'], ['pets', 'Pets', 'pata'], ['cla', 'Clã', 'escudo'], ['rank', 'Ranking', 'rank']];
// ---- renascer: volta para a fase 1 com bônus permanentes ----
const reqRenascer = () => 20 + 10 * (S.renasc || 0);
const bonusRenasc = r => ({ moedas: 50 * r, tiro: 10 * r, chefe: 25 * r, soldados: 20 * r });
function htmlRenascer() {
  const r = S.renasc || 0, B = bonusRenasc(r), N = bonusRenasc(r + 1), pode = S.fase >= reqRenascer();
  return `<div class="rnCard ${pode ? 'pode' : ''}"><div class="rnTopo">${ico('girar')}<div><b>Renascer${r ? ` <small>×${r}</small>` : ''}</b>
      <small>Volte para a fase 1 e fique mais forte para sempre</small></div></div>
    ${r ? `<p class="rnAgora">Agora: ${ico('ouro')} +${B.moedas}% · ${ico('raio')} +${B.tiro}% · ${ico('chefe')} +${B.chefe}% · ${ico('herois')} +${B.soldados}%</p>` : ''}
    <p class="rnProx">Próximo: ${ico('ouro')} +${N.moedas}% · ${ico('raio')} +${N.tiro}% · ${ico('chefe')} +${N.chefe}% · ${ico('herois')} +${N.soldados}% · ${ico('ovo')} Ovo Mágico</p>
    <small class="rnPerde">Perde: fase, moedas e melhorias. Fica: pets, heróis, cartas, baús e Conquista.</small>
    <button class="btn ${pode ? 'roxo' : 'cinza'}" data-a="renascer" ${pode ? '' : 'disabled'}>${pode ? 'Renascer' : `Chegue na fase ${reqRenascer()}`}</button></div>`;
}
function renascer(b) {
  if (S.fase < reqRenascer()) { som('erro'); return; }
  if (b.dataset.certeza !== '1') { b.dataset.certeza = '1'; b.textContent = tr('Toque de novo para confirmar'); som('clique'); return; }
  S.renasc = (S.renasc || 0) + 1; S.fase = 1; S.moedas = 0; for (const k of Object.keys(S.up)) S.up[k] = 0; S.ovos.magico++; salvar();
  sfx('vitoria'); som('lendario'); C.camera.tremor = 0.6; iniciarFase(1); desenharLobby(); if (G) faixa(`RENASCEU! ×${S.renasc}`, '#c88aff');
}
function htmlMelhorias() {
  return `${htmlRenascer()}<div class="ups">${Object.entries(UPGRADES).map(([k, U]) => { const n = S.up[k], max = n >= U.max, c = U.custo(n);
    return `<button class="up ${!max && S.moedas >= c ? 'pode' : ''}" data-up="${k}"><span class="upIco">${ico(U.icone)}</span><b>${U.nome}</b><small>${U.desc(n)}</small><em>${max ? 'MÁX' : `${ico('ouro')}${fmt(c)}`}</em><i>Nv ${n}</i></button>`; }).join('')}</div>`;
}
const DESC_CARTA = { chuva: 'Sobe o poder especial do herói', gigante: 'Cavaleiro enorme aliado', arco: 'Atiram de longe', lanca: 'Aguentam mais duelos', mago: 'Explosão em área' };
const ICONE_HEROI = { lyra: 'arq', brann: 'h_perfura', selene: 'mag', grom: 'r_orc', kira: 'lad', zarak: 'r_demonio', thalia: 'r_anjo', raiden: 'h_raio' };
function htmlHerois() {
  return `<h3>Herói <small>toque para escolher</small></h3><div class="heroisG">${Object.entries(HEROIS).map(([k, H]) => { const tem = S.herois.includes(k), sel = S.heroi === k;
    return `<button class="heroiC ${sel ? 'sel' : ''} ${tem ? '' : 'bloq'}" data-heroi="${k}" style="--c:${H.cor}"><span>${ico(ICONE_HEROI[k])}</span><b>${H.nome}</b><small>${H.titulo}</small>
      <i>${ico('raio')} ${H.ataque.nome}</i><i>${ico(H.poder.icone)} ${H.poder.desc}</i>
      ${sel ? '<em class="esc">Escolhido</em>' : tem ? '<em class="esc">Escolher</em>' : `<em class="preco ${S.moedas >= H.preco ? 'pode' : ''}">${ico('ouro')} ${fmt(H.preco)}</em>`}</button>`; }).join('')}</div>`;
}
function htmlCartas() {
  const carta = ([k, nome, icone]) => { const P = S.pd[k], need = cartasPara(P.nv), tropa = !!TROPAS[k], sel = S.deck.includes(k);
    return `<${tropa ? `button data-tropa="${k}"` : 'div'} class="cartaG ${k} ${sel ? 'sel' : ''} ${P.nv ? '' : 'bloq'}"><span>${ico(icone)}</span><b>${nome}</b><small>${DESC_CARTA[k]}</small>
      ${P.nv ? `<i>Nível ${P.nv}</i><div class="pdBarra"><i style="width:${P.nv >= 10 ? 100 : 100 * P.c / need}%"></i><small>${P.nv >= 10 ? 'MÁX' : `${P.c}/${need} cartas`}</small></div>` : `<i>${ico('cadeado')} nos baús</i>`}
      ${sel ? `<em>${ico('check')}</em>` : ''}</${tropa ? 'button' : 'div'}>`; };
  return `${htmlHerois()}<h3>Poderes <small>botões na batalha</small></h3><div class="cartasG">${CARTAS_INFO.filter(c => !TROPAS[c[0]]).map(carta).join('')}</div>
    <h3>Tropas <small>toque para escolher 2</small></h3><div class="cartasG">${CARTAS_INFO.filter(c => TROPAS[c[0]]).map(carta).join('')}</div>
    <p class="sub">Cartas saem dos baús. Junte cartas para subir o nível.</p>`;
}
function desenharLobby() {
  const F = dadosFase(S.fase), O = S.online, upPode = Object.entries(UPGRADES).some(([k, U]) => S.up[k] < U.max && S.moedas >= U.custo(S.up[k]));
  const nav = `<nav class="lbNav">${ABAS.map(([k, nome, icone]) => `<button class="${abaLobby === k ? 'on' : ''}" data-aba-lobby="${k}">${ico(icone)}<small>${nome}</small>${(k === 'up' && upPode) || (k === 'pets' && (S.ovos.comum || S.ovos.magico)) ? '<i class="ponto"></i>' : ''}</button>`).join('')}</nav>`;
  const topo = `<div class="lbTopo"><button class="avatarBtn" data-a="perfil"><img src="${fotoPet(avatarAtual())}" alt="">${medalhasProntas() ? '<i class="ponto"></i>' : ''}</button><div class="pilula ouro">${ico('ouro')}<b>${fmt(S.moedas)}</b></div>
    <button class="redondo loja" data-a="loja">${ico('mercado')}${temOferta() ? '<i class="ponto"></i>' : ''}</button><button class="redondo missoes" data-a="missoes">${ico('missoes')}${prontas() ? '<i class="ponto"></i>' : ''}</button><button class="redondo presente" data-a="diario">${ico('presente')}${diarioPronto() ? '<i class="ponto"></i>' : ''}</button><button class="redondo" data-a="config">${ico('config')}</button></div>`;
  let meio;
  if (abaLobby === 'home') meio = `
    <div class="lbLogo"><small>Batalha da</small><h1>Ponte</h1></div>
    <div class="lbFaseCard"><span class="fN ${ehCorrida(S.fase) ? 'corrida' : ''}"><small>${ehCorrida(S.fase) ? 'CORRIDA' : 'FASE'}</small><b>${S.fase}</b></span><span class="fInfo"><b>${ico('chefe')} ${F.chefe.nome}</b><small>${HABILIDADES[F.chefe.modelo]?.desc || ''} · ${BIOMAS[biomaDe(S.fase)].nome} · vida ${fmt(F.chefe.hp)}${O?.apelido ? ` · <span data-nt>${esc(O.apelido)}</span>` : ''}</small>
      ${eventoDaFase(S.fase) ? (E => `<em class="fEvento" style="--c:${E.cor}">${ico(E.icone)}<b>${E.nome}:</b> ${E.desc}</em>`)(EVENTOS[eventoDaFase(S.fase)]) : ''}</span></div>
    <div class="lbBase">
      ${fimDeSemana() ? `<div class="fdsFaixa">${ico('festa')}<span><b>Fim de semana dourado!</b><small>Moedas x2 · ovos com sorte x2 · guerra de clãs</small></span></div>` : ''}
      <div class="baus">${Array.from({ length: MAX_BAUS }, (_, i) => { const b = S.baus[i];
        return b ? `<button class="slotBau" data-bau="${i}">${bauHtml(b.tipo, 'mini')}<small>Abrir!</small></button>` : `<div class="slotBau vazio">${ico('bau')}</div>`; }).join('')}</div>
      <div class="lbJogar"><button class="modo roxo modosBtn" data-a="modos">${ico('dado')}<small>Modos</small>${lucroOcioso() > 0 ? '<i class="ponto"></i>' : ''}</button>
        <button class="btn verde grande jogar" data-a="jogar">JOGAR<small>Fase ${S.fase}</small></button></div></div>`;
  else if (abaLobby === 'cla' || abaLobby === 'rank') meio = `<div class="lbFolha"><h2>${ABAS.find(a => a[0] === abaLobby)[1]}</h2><div class="lbFolhaCorpo jOnline2" id="onCorpo"></div></div>`;
  else meio = `<div class="lbFolha"><h2>${ABAS.find(a => a[0] === abaLobby)[1]}</h2><div class="lbFolhaCorpo">${abaLobby === 'up' ? htmlMelhorias() : abaLobby === 'pets' ? htmlPets() : htmlCartas()}</div></div>`;
  $('#lobby').innerHTML = topo + meio + nav;
  if (abaLobby === 'cla' || abaLobby === 'rank') carregarOnline(abaLobby);
}
// ---- pets ----
const fotoPet = (k, tam = 160) => C.retrato(modeloDe(k), { cor: tinta(k), tam });
const estrelas = k => est(k) ? `<span class="estr" style="color:${ESTRELAS[est(k)].cor}">${'★'.repeat(est(k))}</span>` : '';
const bonusHtml = (k, curto) => bonusPet(k).map(([t, v]) => `<span class="bn">${ico(BONUS_PET[t].icone)}${curto ? (BONUS_PET[t].un ? `+${v}` : `${t === 'recarga' || t === 'lento' ? '-' : '+'}${v}%`) : txtBonus(t, v)}</span>`).join('');
function cardPet(k, cls = '') {
  const D = PETS[base(k)], P = S.pets[base(k)], eq = S.equipe.includes(k), e = est(k), n = qtd(k);
  return `<button class="ptCard r${D.r} ${e ? 'est est' + e : ''} ${eq ? 'eq' : ''} ${cls}" data-pet="${k}" style="--r:${RARIDADES[D.r].cor}${e ? `;--e:${ESTRELAS[e].cor}` : ''}"><img src="${fotoPet(k)}" alt="">
    ${estrelas(k)}<b>${D.nome}</b><i>Nv ${P.nv}</i><small class="cls">${ico(CLASSES[D.c].icone)}</small>
    ${cls === 'mini' ? '' : `<em class="${n >= 3 && e < MAX_EST ? 'pode' : ''}">${e >= MAX_EST ? `x${n}` : `${n}/3`}</em><div class="bns">${bonusHtml(k, true)}</div>`}${eq && cls !== 'mini' ? `<span class="eqM">${ico('check')}</span>` : ''}</button>`;
}
function htmlPets() {
  const eq = S.equipe, chances = O => O.chances.map((c, i) => `<i style="color:${RARIDADES[i].cor}">${c}%</i>`).join(' '), B = bonusEquipe();
  const colecao = Object.keys(PETS).sort((a, b) => PETS[a].r - PETS[b].r).flatMap(k => { const P = S.pets[k];
    if (!P) return [`<div class="ptCard bloq r${PETS[k].r}" style="--r:${RARIDADES[PETS[k].r].cor}"><img src="${fotoPet(k)}" alt=""><b>???</b><i>${RARIDADES[PETS[k].r].nome}</i></div>`];
    const l = P.e.map((n, e) => n > 0 ? cardPet(k + '*'.repeat(e)) : '').filter(Boolean); return l.length ? l : [cardPet(k)]; });
  return `<div class="ptEquipe"><h3>Equipe <small>${eq.length}/${MAX_EQUIPE} · ${ico('forca')} ${fmt(forcaEquipe())}</small><button class="btn peq azul" data-pet-a="melhores">Equipar melhores</button></h3>
      <div class="ptSlots">${Array.from({ length: MAX_EQUIPE }, (_, i) => eq[i] ? cardPet(eq[i], 'mini') : '<div class="ptSlot">+</div>').join('')}</div>
      <div class="ptBonus">${Object.keys(BONUS_PET).filter(t => B[t]).map(t => `<span class="bn">${ico(BONUS_PET[t].icone)}${txtBonus(t, B[t])}</span>`).join('') || '<small>Equipe pets para ganhar bônus na ponte</small>'}</div>
      <button class="btn verde cqBtn" data-a="conquista">${ico('bandeira')} Conquista · estágio ${S.cq.est}</button></div>
    <h3>Ovos</h3><div class="ptOvos">${Object.entries(OVOS).map(([k, O]) => `<button class="ptOvo ${S.ovos[k] || S.moedas >= O.preco ? 'pode' : ''}" data-ovo="${k}">${CQ.ovoHtml(k)}
      <b>${O.nome}</b><small>${chances(O)}</small><em>${S.ovos[k] ? `Chocar (${S.ovos[k]})` : `${ico('ouro')} ${fmt(O.preco)}`}</em></button>`).join('')}</div>
    <h3>Coleção <small>3 iguais = 1 com estrela ★ (até ★5)</small></h3><div class="ptGrade">${colecao.join('')}</div>
    <p class="sub">Os bônus da equipe valem na ponte e no ∞. Cada estrela deixa o pet 3x mais forte e aumenta o bônus. Até 3 pets seguem o herói e atiram junto.</p>`;
}
function mostrarPet(k) {
  if (!temPet(k)) return; const D = PETS[base(k)], P = S.pets[base(k)], R = RARIDADES[D.r], A = atributos(k), eq = S.equipe.includes(k), c = custoNivel(k), max = P.nv >= MAX_NV, e = est(k), n = qtd(k);
  const j = $('#janela'); j.hidden = false;
  j.innerHTML = `<div class="jPet" style="--r:${e ? ESTRELAS[e].cor : R.cor}"><div class="raios liga"></div><img src="${fotoPet(k, 256)}" alt="">
    <h2>${D.nome}</h2>${estrelas(k)}<p class="raridade">${R.nome}${e ? ` ${ESTRELAS[e].nome}` : ''} · ${ico(CLASSES[D.c].icone)} ${CLASSES[D.c].nome}</p>
    <div class="ptBonus grande">${bonusHtml(k)}</div>
    ${golpe(k) ? `<div class="ptGolpe">${ico(golpe(k).icone)}<span><b>${golpe(k).nome}</b><small>${golpe(k).desc} · a cada ${Math.round(cdGolpe(k))}s</small></span></div>` : ''}
    <div class="ptStats"><span>${ico('coracao')} ${fmt(A.hp)}</span><span>${ico('forca')} ${fmt(A.atk)}</span><span>Nv <b>${P.nv}</b></span><span>${ico('poder')} ${fmt(forca(A))}</span></div>
    <button class="btn amarelo" data-pet-a="nivel" data-k="${k}" ${max || S.moedas < c ? 'disabled' : ''}>${max ? 'Nível máximo' : `${ico('seta', 'up')} Nível ${P.nv + 1} · ${ico('ouro')} ${fmt(c)}`}</button>
    ${e < MAX_EST ? `<button class="btn roxo" data-pet-a="juntar" data-k="${k}" ${n >= 3 ? '' : 'disabled'}>Juntar 3 → <span style="color:${ESTRELAS[e + 1].cor}">${'★'.repeat(e + 1)}</span> ${ESTRELAS[e + 1].nome} (${n}/3)</button>` : ''}
    <button class="btn ${eq ? 'azul' : 'verde'}" data-pet-a="equipar" data-k="${k}">${eq ? 'Tirar da equipe' : `Pôr na equipe${S.equipe.length >= MAX_EQUIPE ? ' (troca o 1º)' : ''}`}</button>
    <button class="fSo" data-a="fecharJanela">Fechar</button></div>`;
}
function acaoPet(a, k) {
  if (a === 'melhores') { equiparMelhores(); som('confirma'); recriarPetsLobby(); desenharLobby(); return; }
  if (a === 'nivel') { if (subirNivel(k)) { som('compra'); sfx('brilho'); evento('nivelPet'); } else { som('erro'); return; } }
  if (a === 'juntar') { const novo = juntar(k); if (!novo) { som('erro'); return; } sfx('estrela'); setTimeout(() => sfx('vitoria'), 450); k = novo;
    if (est(k) >= 2) avisarCla(`juntou ${PETS[base(k)].nome} ${'★'.repeat(est(k))} ${ESTRELAS[est(k)].nome}!`); }
  if (a === 'equipar') { if (!equipar(k)) { som('erro'); return; } som('clique'); }
  recriarPetsLobby(); desenharLobby(); mostrarPet(k);
}
function recriarPetsLobby() { if (G && tela === 'lobby') { for (const p of G.petsV || []) p.v.remover(); criarPetsHeroi(); } }
function abrirOvo(tipo) {
  const O = OVOS[tipo]; if (!S.ovos[tipo] && S.moedas < O.preco) { som('erro'); return; }
  const r = chocar(tipo); if (!r) { som('erro'); return; } evento('ovos');
  const j = $('#janela'); j.hidden = false; som('compra');
  j.innerHTML = `<div class="jOvo"><h2>${O.nome}</h2><div class="raios"></div><div class="ovoPalco">${CQ.ovoHtml(tipo, 'treme')}</div><p class="dicaBau">Chocando...</p><div class="ovoRes"></div></div>`;
  [250, 650, 1000, 1300].forEach((d, i) => setTimeout(() => { if (j.querySelector('.ovoG.treme')) sfx('ovo', i); }, d));
  setTimeout(() => { const e = j.querySelector('.ovoG'); if (!e) return; e.classList.remove('treme'); e.classList.add('quebra'); sfx('quebra'); }, 1500);
  setTimeout(() => { if (!j.querySelector('.jOvo')) return; const D = PETS[r.k], R = RARIDADES[D.r], P = S.pets[r.k];
    j.querySelector('.ovoPalco').remove(); j.querySelector('.dicaBau').remove(); j.querySelector('.raios').classList.add('liga'); j.querySelector('.jOvo').style.setProperty('--r', R.cor);
    j.querySelector('.ovoRes').innerHTML = `<img src="${fotoPet(r.k, 256)}" alt=""><b>${D.nome}</b><small style="color:${R.cor}">${R.nome} · ${CLASSES[D.c].nome}</small>
      <div class="ptBonus">${bonusHtml(r.k)}</div><em>${r.novo ? 'NOVO!' : P.e[0] >= 3 ? 'Já dá para juntar ★!' : `${P.e[0]}/3 para ★`}</em>
      <div class="ovoBotoes">${S.ovos[tipo] || S.moedas >= O.preco ? `<button class="btn amarelo" data-ovo="${tipo}">${S.ovos[tipo] ? `De novo (${S.ovos[tipo]})` : `De novo ${ico('ouro')}${fmt(O.preco)}`}</button>` : ''}
      <button class="btn verde" data-a="fecharJanela">Pegar</button></div>`;
    sfx(D.r >= 2 ? 'vitoria' : 'brilho'); if (D.r >= 3) som('lendario'); if (D.r >= 2) avisarCla(`tirou ${D.nome} (${R.nome}) num ovo!`); C.camera.tremor = 0.3; recriarPetsLobby(); }, 2100);
}
function abrirCastelo() {
  limparFase(); MUROS_PISTA[0].visible = MUROS_PISTA[1].visible = false; MUROS_PISTA[2].visible = true; $('#janela').hidden = true;
  tela = 'castelo'; $('#lobby').hidden = true; $('#jogo').hidden = true; $('#fim').hidden = true; tema(1);
  CT.abrir($('#castelo'), () => { CT.fechar(); abrirLobby(); desenharLobby(); });
}
// ---- configurações: idioma, som e qualidade gráfica num lugar só ----
function mostrarConfig(reabrir) {
  const j = $('#janela'); j.hidden = false; let q = 'media'; try { q = localStorage.getItem('guilda_q') || 'media'; } catch (e) {}
  j.innerHTML = `<div class="jOnline jConfig"><h2>${ico('config')} Configurações</h2>
    <h3>Idioma</h3><div class="idiomas" data-nt>${IDIOMAS.map(([k, n, f]) => `<button class="btn peq ${k === idiomaJogo() ? 'verde' : 'azul'}" data-idioma="${k}"><span class="flag">${f}</span>${n}</button>`).join('')}</div>
    <h3>Som</h3><button class="btn ${estaMudo() ? 'cinza' : 'verde'}" data-a="som">${ico(estaMudo() ? 'mudo' : 'som')} ${estaMudo() ? 'Som desligado' : 'Som ligado'}</button>
    <h3>Gráficos</h3><div class="cfgQual">${[['baixa', 'Leve'], ['media', 'Normal'], ['alta', 'Bonito']].map(([k, n]) => `<button class="${q === k ? 'sel' : ''}" data-qual="${k}">${n}</button>`).join('')}</div>
    <small class="cfgDica">${reabrir ? 'Vale quando abrir o jogo de novo.' : 'Leve: roda melhor em celular simples.'}</small>
    <p class="cfgVer">Versão ${window.VERSAO || ''}</p><button class="fSo" data-a="fecharJanela">Fechar</button></div>`;
}
// ---- tela de modos: tudo que não é a campanha fica aqui (a tela inicial só tem JOGAR) ----
function mostrarModos() {
  const j = $('#janela'); j.hidden = false;
  const card = (k, cor, icone, nome, desc, info, livre, req) => `<button class="modoC ${livre ? '' : 'bloq'}" data-modo="${k}" style="--c:${cor}">${ico(livre ? icone : 'cadeado')}
    <span><b>${nome}</b><small>${desc}</small></span><em>${livre ? info : req}</em></button>`;
  j.innerHTML = `<div class="jOnline jModos"><h2>${ico('dado')} Modos</h2>
    <h3>${ico('herois')} Com o herói</h3>
    ${card('infinito', '#8a4ae8', 'estrela', 'Ponte sem fim', 'Chefes sem parar até cair', `${ico('rank')} ${fmt(S.recInf || 0)}`, S.melhor >= 3, 'Fase 3')}
    ${card('castelo', '#4a6ae8', 'h_muralha', 'Castelo', 'Defenda a muralha em ondas', `Onda ${S.castelo?.rec || 0}`, S.melhor >= 3, 'Fase 3')}
    ${card('dupla', '#2a8ae8', 'herois', 'Dupla', 'Jogue junto com outra pessoa', 'Online', true, '')}
    <h3>${ico('pata')} Com os pets</h3>
    ${card('conquista', '#d8501a', 'bandeira', 'Conquista', 'Seus pets contra equipes de outros jogadores', lucroOcioso() > 0 ? `${ico('ouro')} ${fmt(lucroOcioso())}` : `Estágio ${S.cq.est}`, true, '')}
    <button class="fSo" data-a="fecharJanela">Fechar</button></div>`;
}
// ---- a equipe de pets fica salva no servidor: vira o inimigo da Conquista de outros jogadores ----
const equipeArena = () => S.equipe.map(k => ({ k, nv: S.pets[base(k)]?.nv || 1 }));
async function salvarDefesa() { if (!S.equipe.length) return; const eq = equipeArena(), sig = JSON.stringify(eq); if (sig === S.arena?.sig) return; await ON.garantir();
  const t = await ON.arenaSalvar(eq, forcaEquipe()); S.arena = { ...(S.arena || {}), sig, trofeus: t }; salvar(); }
function abrirConquista() {
  limparFase(); for (const m of MUROS_PISTA) m.visible = false; $('#janela').hidden = true;
  tela = 'conq'; $('#lobby').hidden = true; $('#jogo').hidden = true; $('#fim').hidden = true; tema(4);
  salvarDefesa().catch(() => {});
  CQ.abrir($('#conq'), destino => { CQ.fechar(); abrirLobby(); abaLobby = destino; desenharLobby(); });
}
const PODERES = [['chuva', 'Especial', 'estrela'], ['gigante', 'Gigante', 'cav']];
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
    if (aberto) return; aberto = true; let p = null; try { p = aoAbrir(); } catch (e) { console.error(e); }
    if (!p) { j.hidden = true; if (tela === 'lobby') desenharLobby(); return; } const b = j.querySelector('.bauG'); b.classList.remove('treme'); b.classList.add('aberto'); j.querySelector('.raios').classList.add('liga');
    j.querySelector('.dicaBau').remove(); sfx('brilho'); setTimeout(() => sfx('vitoria'), 250);
    const itens = [`<div class="premio">${ico('ouro')}<b>+${fmt(p.moedas)}</b><small>moedas</small></div>`];
    for (const [k, nome, icone] of CARTAS_INFO) if (p.cartas[k]) { const P = S.pd[k], need = cartasPara(P.nv);
      itens.push(`<div class="premio carta ${k}">${ico(icone)}<b>x${p.cartas[k]}</b><small>${nome}${p.sobe[k] ? ` · <em>${P.nv === 1 ? 'Liberado!' : `Nível ${P.nv}!`}</em>` : ` · ${P.c}/${need}`}</small></div>`); }
    const box = j.querySelector('.premios'); itens.forEach((h, i) => setTimeout(() => { box.insertAdjacentHTML('beforeend', h); sfx('nota', 3 + i * 2); }, 500 + i * 380));
    setTimeout(() => box.insertAdjacentHTML('afterend', `<button class="btn verde grande" data-a="fecharJanela">Pegar</button>`), 600 + itens.length * 380);
  };
}
// ---- online: ranking e amigos ----
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const hojeTxt = () => new Date().toLocaleDateString('sv');
let abaOnline = 'rank';
const CORES_CLA = ['#e8503a', '#2f7ae8', '#2bb84a', '#a24ae8', '#f2b51a', '#1fb8b8', '#e85aa8', '#6a6a7a'];
const escudoCla = (cor, txt = '') => `<span class="escCla" style="--c:${CORES_CLA[cor % 8]}">${ico('escudo')}<i>${esc(txt.slice(0, 2).toUpperCase())}</i></span>`;
const tagHtml = (tag, cor) => tag ? `<em class="tagCla" style="--c:${CORES_CLA[(cor || 0) % 8]}">[${esc(tag)}]</em>` : '';
let rankModo = null;
const PLACAR = {
  cla_nivel: { nome: 'Nível do clã', icone: 'escudo', un: 'Nv' }, cla_forca: { nome: 'Força do clã', icone: 'forca', un: '' }, cla_semana: { nome: 'Dano da semana', icone: 'chefe', un: '' },
  fase: { nome: 'Fase máxima', icone: 'bandeira', un: 'fase' }, forca: { nome: 'Força dos pets', icone: 'pata', un: '' }, infinito: { nome: 'Ponte sem fim', icone: 'estrela', un: '' },
  conquista: { nome: 'Conquista', icone: 'bandeira', un: 'estágio' }, castelo: { nome: 'Castelo', icone: 'h_muralha', un: 'onda' }, orcs: { nome: 'Orcs derrotados', icone: 'caveira', un: '' },
};
const PLACAR_CLA = ['cla_nivel', 'cla_forca'], PLACAR_IND = ['fase', 'forca', 'infinito', 'conquista', 'castelo', 'orcs'];
const fotoPlacar = (k, r, tam = 64) => k.startsWith('cla_') ? escudoCla(r.cor || 0, r.tag || r.nome) : `<img src="${fotoPet(petValido(r.avatar), tam)}" alt="">`;
// ficha de um clã (de qualquer lugar): membros, nível, e entrar/pedir
async function verCla(id) {
  const j = $('#janela'); j.hidden = false; j.innerHTML = `<div class="jOnline"><p>Carregando...</p></div>`;
  try { const c = await ON.claInfo(+id); if (!c) { j.hidden = true; return; } const meu = lerCache('meucla')?.d?.id === c.id;
    j.innerHTML = `<div class="jOnline jClaVer"><div class="claTopo">${escudoCla(c.cor, c.tag || c.nome)}<div><b data-nt>${tagHtml(c.tag, c.cor)}${esc(c.nome)}</b><small>Nível ${c.nivel} · ${c.membros.length}/30 membros</small>
      ${c.descricao ? `<p class="claDesc" data-nt>${esc(c.descricao)}</p>` : ''}<small class="claModo">${c.fechado ? `${ico('cadeado')} Fechado: só entra com pedido` : `${ico('check')} Aberto`}${c.faseMin ? ` · fase ${c.faseMin}+` : ''}</small></div></div>
      <div class="lista">${c.membros.map(m => `<div class="linha"><span class="plMini"><img src="${fotoPet(petValido(m.avatar), 96)}" alt=""></span><button class="nomeBtn" data-perfil="${m.codigo}" data-nt>${esc(m.apelido)}</button>
        ${m.cargo === 'lider' ? `<span class="cargo lider">${ico('coroa')}Líder</span>` : m.cargo === 'colider' ? `<span class="cargo colider">${ico('estrela')}Colíder</span>` : ''}<small>fase ${m.fase}</small></div>`).join('')}</div>
      ${meu || lerCache('meucla')?.d ? '' : c.fechado ? `<button class="btn amarelo" data-cla-pedir="${c.id}">${ico('cadeado')} Pedir para entrar</button>` : `<button class="btn verde" data-cla="${c.id}">Entrar no clã</button>`}
      <p class="erro" id="onErro"></p><button class="fSo" data-a="fecharJanela">Fechar</button></div>`; }
  catch (e) { j.innerHTML = `<div class="jOnline"><p class="erro">${esc(e.message)}</p><button class="fSo" data-a="fecharJanela">Fechar</button></div>`; }
}
function mostrarListaPlacar(el, nome, k, mostrarNomeEu) {
  const P = PLACAR[k], cla = k.startsWith('cla_'), val = r => `${P.un === 'Nv' ? 'Nv ' : ''}${fmt(r.valor)}`;
  el.innerHTML = `${nome}<div class="plTopo"><button class="plVoltar" data-rk="voltar">${ico('seta')}</button><b>${P.nome}</b></div>
    <div class="plCab"><span>Rank</span><span>${cla ? 'Clã' : 'Jogador'}</span><span>${P.un && P.un !== 'Nv' ? P.un : cla && k === 'cla_nivel' ? 'Nível' : 'Valor'}</span></div><div class="lista plLista" id="lista"><p>Carregando...</p></div><div id="plEu"></div>`;
  const linha = r => `<div class="linha plLinha p${Math.min(4, r.posicao)} ${r.eu ? 'eu' : ''}"><b class="plPos">${r.posicao <= 3 ? `<i class="medalha m${r.posicao}">${r.posicao}</i>` : r.posicao}</b>
    <span class="plMini">${fotoPlacar(k, r, 128)}</span>${cla ? `<button class="nomeBtn" data-cla-ver="${r.codigo}" data-nt>${tagHtml(r.tag, r.cor)}${esc(r.nome)}</button>` : `<button class="nomeBtn" data-perfil="${r.codigo}" data-nt>${tagHtml(r.tag, r.cor)}${esc(r.nome)}</button>`}<em>${val(r)}</em></div>`;
  comCache('pl_' + k, () => ON.garantir().then(() => ON.placarLista(k)), l => { if (rankModo !== k) return; const e = $('#lista'); if (!e) return; mostrarNomeEu();
    const top = l.filter(r => r.posicao <= 50), eu = l.find(r => r.eu);
    e.innerHTML = top.length ? top.map(linha).join('') : '<p>Ninguém ainda.</p>';
    const pe = $('#plEu'); if (pe) pe.innerHTML = eu ? `<div class="plFixo">${linha(eu)}</div>` : ''; },
    er => { const x = $('#lista'); if (x) x.innerHTML = `<p class="erro">${esc(er.message)}</p>`; }, 30000);
}
// conteúdo das abas Clã e Ranking (dentro da folha do lobby)
// ---- cache das telas online: mostra na hora o último resultado e atualiza em segundo plano ----
const CACHE = {};
function lerCache(k) { if (CACHE[k]) return CACHE[k]; try { const v = JSON.parse(localStorage.getItem('pc_' + k)); if (v) CACHE[k] = v; return v; } catch (e) { return null; } }
function gravarCache(k, d) { const v = { t: Date.now(), d }; CACHE[k] = v; try { localStorage.setItem('pc_' + k, JSON.stringify(v)); } catch (e) {} }
const esquecer = (...ks) => { for (const k of ks) { delete CACHE[k]; try { localStorage.removeItem('pc_' + k); } catch (e) {} } };
// render(dados) roda já com o cache; a busca só acontece se o cache tiver mais de ttl ms, e só redesenha se mudou
function comCache(k, buscar, render, erro, ttl = 20000) {
  const c = lerCache(k); if (c) render(c.d);
  if (c && Date.now() - c.t < ttl) return;
  buscar().then(d => { const mudou = !c || JSON.stringify(c.d) !== JSON.stringify(d); gravarCache(k, d); if (mudou) render(d); }).catch(e => { if (!c) erro?.(e); });
}
function carregarOnline(aba) {
  const el = $('#onCorpo'); if (!el) return; const O = ON.conta(); el.classList.remove('comChat'); ON.garantir().then(enviarPerfil).catch(() => {});
  const nome = `<div class="nomeEu">Seu nome: <b data-nt>${esc(O?.apelido || '...')}</b> <button class="fSo" data-a="trocarNome">trocar</button></div>`;
  const mostrarNomeEu = () => { const b = document.querySelector('.nomeEu b'); if (b) b.textContent = ON.conta()?.apelido || ''; };
  if (aba === 'nome') {
    el.innerHTML = `<p class="sub">Esse nome aparece no ranking, no clã e na dupla.</p><input id="apelido" maxlength="16" placeholder="Seu apelido" value="${esc(O?.apelido || '')}"><p class="erro" id="onErro"></p>
      <button class="btn verde grande" data-a="salvarNome">Salvar</button><button class="btn azul" data-a="voltarOnline">Voltar</button>`; return;
  }
  if (aba === 'rank') { // placar: cards com o 1º de cada categoria; tocar abre a lista completa
    if (rankModo && PLACAR[rankModo]) return mostrarListaPlacar(el, nome, rankModo, mostrarNomeEu);
    const card = k => { const P = PLACAR[k]; return `<button class="plCard" data-rk="${k}"><b>${P.nome}</b><span class="plFoto" id="plF_${k}">${ico(P.icone)}</span><small class="plNome" id="plN_${k}">...</small></button>`; };
    el.innerHTML = `${nome}<div class="plSecao">${ico('escudo')} Clãs</div><div class="plGrade">${PLACAR_CLA.map(card).join('')}</div>
      <div class="plSecao">${ico('herois')} Individual</div><div class="plGrade">${PLACAR_IND.map(card).join('')}</div>`;
    comCache('placar', () => ON.garantir().then(ON.placar), d => { mostrarNomeEu(); for (const k of [...PLACAR_CLA, ...PLACAR_IND]) { const r = d?.[k], f = $('#plF_' + k), n = $('#plN_' + k); if (!f || !n) continue;
      if (!r) { n.textContent = '—'; continue; } f.innerHTML = fotoPlacar(k, r, 160); n.innerHTML = `<span data-nt>${tagHtml(r.tag, r.cor)}${esc(r.nome)}</span>`; } },
      e => { const x = $('.plGrade'); if (x) x.insertAdjacentHTML('beforebegin', `<p class="erro">${esc(e.message)}</p>`); }, 60000);
    return;
  }
  el.innerHTML = `${nome}<div id="claCorpo"><p>Carregando...</p></div>`;
  comCache('meucla', () => ON.meuCla(), c => { const e = $('#claCorpo'); if (!e) return; mostrarNomeEu();
    if (c) { const k = Math.min(1, c.dano / c.vida), abas = `<div class="abas"><button class="${claModo === 'chat' ? 'on' : ''}" data-cm="chat">${ico('pergaminho')} Chat</button><button class="${claModo === 'info' ? 'on' : ''}" data-cm="info">${ico('escudo')} Clã</button></div>`;
      if (claModo === 'chat') { if (e.classList.contains('modoChat') && $('#chatLista')) return; // o chat já está aberto: não redesenha
        e.innerHTML = abas + htmlChat(); e.classList.add('modoChat'); $('#onCorpo')?.classList.add('comChat'); abrirChat(); return; }
      e.classList.remove('modoChat');
      claAtual = c;
      e.innerHTML = abas + `<div class="claTopo">${escudoCla(c.cor, c.tag || c.nome)}<div><b data-nt>${tagHtml(c.tag, c.cor)}${esc(c.nome)}</b><small>Nível ${c.nivel} · ${c.membros.length}/30 membros</small>
          ${c.descricao ? `<p class="claDesc" data-nt>${esc(c.descricao)}</p>` : ''}<small class="claModo">${c.fechado ? `${ico('cadeado')} Fechado: só entra com pedido` : `${ico('check')} Aberto`}${c.faseMin ? ` · fase ${c.faseMin}+` : ''}</small></div>${c.meuCargo === 'lider' ? `<button class="btn peq azul" data-a="claEditarAbrir">${ico('pincel')}</button>` : ''}</div>
        ${(c.meuCargo === 'lider' || c.meuCargo === 'colider') && c.pedidos > 0 ? `<button class="btn amarelo pedidosBtn" data-a="claPedidosAbrir">${ico('mao')} ${c.pedidos} pedido${c.pedidos > 1 ? 's' : ''} para entrar</button>` : ''}
        <div class="claChefe"><small>${ico('chefe')} Chefe do clã (semana) — todo dano que vocês dão nas batalhas conta</small>
          <div class="barra vm"><i style="width:${100 - 100 * k}%"></i><span>${fmt(c.vida - c.dano)} / ${fmt(c.vida)}</span></div>
          <small>Derrotar dá ${ico('ouro')} ${150 + 50 * c.nivel} para cada membro</small></div>
        <div id="guerraCard"></div>
        <div class="lista">${c.membros.map(m => `<div class="linha ${m.eu ? 'eu' : ''}"><i class="pontoOn ${m.online ? 'on' : ''}"></i><button class="nomeBtn" data-perfil="${m.codigo}" data-nt>${esc(m.apelido)}</button>
          ${m.cargo === 'lider' ? `<span class="cargo lider">${ico('coroa')}Líder</span>` : m.cargo === 'colider' ? `<span class="cargo colider">${ico('estrela')}Colíder</span>` : ''}<small>fase ${m.fase}</small><em>${fmt(m.dano)}</em>
          ${!m.eu && podeGerir(c.meuCargo, m.cargo) ? `<button class="gerirBtn" data-gerir="${m.codigo}">⋯</button>` : ''}</div>`).join('')}</div>
        <button class="fSo" data-a="claSair">Sair do clã</button>`;
      comCache('guerra', () => ON.guerra(), pintarGuerra, null, 30000);
      return; }
    e.classList.remove('modoChat'); $('#onCorpo')?.classList.remove('comChat');
    comCache('clas', () => ON.clas(), l => { const e2 = $('#claCorpo'); if (!e2 || lerCache('meucla')?.d) return;
      e2.innerHTML = `<p class="sub">Entre num clã: membros se ajudam sozinhos nas batalhas e derrotam juntos o chefe da semana. A sigla aparece antes do seu nome.</p>
        <div class="lista">${l.length ? l.map(c => `<div class="linha">${escudoCla(c.cor, c.tag || c.nome)}<div class="lnTxt"><span data-nt>${tagHtml(c.tag, c.cor)}${esc(c.nome)}</span><small>Nv ${c.nivel} · ${c.membros}/30${c.fase_min ? ` · fase ${c.fase_min}+` : ''}</small>${c.descricao ? `<small class="claDescP" data-nt>${esc(c.descricao)}</small>` : ''}</div>
          ${c.fechado ? (c.pedi ? `<button class="btn cinza peq" disabled>${ico('relogio')} Pedido enviado</button>` : `<button class="btn amarelo peq" data-cla-pedir="${c.id}">${ico('cadeado')} Pedir</button>`)
            : `<button class="btn verde peq" data-cla="${c.id}">Entrar</button>`}</div>`).join('') : '<p>Nenhum clã ainda. Crie o primeiro!</p>'}</div>
        <div class="criarCla"><input id="tagCla" maxlength="4" placeholder="SIGLA"><input id="nomeCla" maxlength="18" placeholder="Nome do novo clã"></div>
        <button class="btn amarelo" data-a="claCriar">Criar clã ${ico('ouro')}200</button><p class="erro" id="onErro"></p>`; });
  }, e => { const x = $('#claCorpo'); if (x) x.innerHTML = `<p class="erro">${esc(e.message)}</p>`; });
}
function mostrarOnline(aba) { if (tela !== 'lobby') abrirLobby(); abaLobby = aba === 'cla' ? 'cla' : 'rank'; $('#janela').hidden = true; desenharLobby(); }
function mostrarNome() { const b = document.querySelector('.nomeEu b'); if (b) b.textContent = ON.conta()?.apelido || ''; }
async function cliqueOnline(b) {
  const a = b.dataset.a, erro = m => { const e = $('#onErro'); if (e) e.textContent = m; som('erro'); };
  if (b.dataset.rk) { som('clique'); rankModo = b.dataset.rk === 'voltar' ? null : b.dataset.rk; carregarOnline('rank'); return; }
  if (b.dataset.cm) { som('clique'); claModo = b.dataset.cm; const e = $('#claCorpo'); if (e) e.classList.remove('modoChat'); carregarOnline('cla'); return; }
  if (a === 'chatEnviar') { const i = $('#chatTxt'), t = i.value.trim(); if (!t) return; b.disabled = true;
    try { await ON.chatEnviar(t); i.value = ''; som('clique'); lerChat(); } catch (e) { erro(e.message); } b.disabled = false; }
  if (b.dataset.trad) { traduzirMsg(b); return; }
  if (b.dataset.trVer) { b.closest('.chM').classList.toggle('orig'); return; }
  if (a === 'chatPedirAbrir') { som('clique'); const p = $('#chatPedir'); p.hidden = !p.hidden; }
  if (b.dataset.pedir) { b.disabled = true; try { const min = await ON.chatPedir(b.dataset.pedir); if (min > 0) erro(`Próximo pedido em ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`); else { sfx('brilho'); $('#chatPedir').hidden = true; lerChat(); } } catch (e) { erro(e.message); } b.disabled = false; }
  if (b.dataset.doar) { b.disabled = true; try { await ON.chatDoar(+b.dataset.doar); evento('doar'); sfx('brilho'); som('moedas'); lerChat(); setTimeout(coletarPremios, 400); } catch (e) { b.disabled = false; erro(e.message); } }
  if (a === 'trocarNome') { som('clique'); carregarOnline('nome'); }
  if (a === 'voltarOnline') { som('clique'); carregarOnline(abaLobby); }
  if (a === 'salvarNome') { const ap = $('#apelido').value.trim(); if (ap.length < 2) return erro('Pelo menos 2 letras');
    b.disabled = true; try { await ON.registrar(ap); som('confirma'); carregarOnline(abaLobby); } catch (e) { b.disabled = false; erro(e.message); } }
  if (b.dataset.claPedir) { b.disabled = true; try { await ON.claPedir(+b.dataset.claPedir); esquecer('clas'); sfx('brilho'); b.outerHTML = `<button class="btn cinza peq" disabled>${ico('relogio')} ${tr('Pedido enviado')}</button>`; } catch (e) { b.disabled = false; erro(e.message); } return; }
  if (b.dataset.cla) { b.disabled = true; try { await ON.claEntrar(+b.dataset.cla); esquecer('meucla', 'clas', 'chat', 'placar'); sfx('vitoria'); $('#janela').hidden = true; if (abaLobby !== 'cla') { abaLobby = 'cla'; desenharLobby(); } else carregarOnline('cla'); } catch (e) { b.disabled = false; erro(e.message); } }
  if (a === 'claCriar') { const n = $('#nomeCla').value.trim(), tg = $('#tagCla').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (tg.length < 2) return erro('Sigla com 2 a 4 letras'); if (n.length < 3) return erro('Nome com pelo menos 3 letras'); if (S.moedas < 200) return erro('Precisa de 200 moedas');
    b.disabled = true; try { await ON.claCriar(n, tg, Math.floor(Math.random() * 8)); esquecer('meucla', 'clas', 'chat'); S.moedas -= 200; salvar(); sfx('vitoria'); carregarOnline('cla'); } catch (e) { b.disabled = false; erro(e.message); } }
  if (a === 'claSair') { if (b.dataset.certeza !== '1') { b.dataset.certeza = '1'; b.textContent = 'Toque de novo para sair'; return; }
    try { await ON.claSair(); esquecer('meucla', 'clas', 'chat'); som('fechar'); carregarOnline('cla'); } catch (e) { erro(e.message); } }
}
// ---- cargos do clã: líder edita e gerencia; colíder pode expulsar membros ----
let claAtual = null;
const podeGerir = (eu, alvo) => eu === 'lider' || (eu === 'colider' && alvo === 'membro');
function menuMembro(codigo) {
  const c = claAtual, m = c?.membros.find(x => x.codigo === codigo); if (!m) return; const j = $('#janela'); j.hidden = false; const lider = c.meuCargo === 'lider';
  j.innerHTML = `<div class="jOnline"><h2 data-nt>${esc(m.apelido)}</h2>
    <button class="btn azul" data-perfil="${codigo}">${ico('herois')} Ver perfil</button>
    ${lider && m.cargo === 'membro' ? `<button class="btn verde" data-cla-acao="promover" data-k="${codigo}">${ico('estrela')} Promover a colíder</button>` : ''}
    ${lider && m.cargo === 'colider' ? `<button class="btn cinza" data-cla-acao="rebaixar" data-k="${codigo}">Rebaixar a membro</button>` : ''}
    ${lider ? `<button class="btn amarelo" data-cla-acao="lider" data-k="${codigo}">${ico('coroa')} Passar a liderança</button>` : ''}
    <button class="btn vermelho" data-cla-acao="expulsar" data-k="${codigo}">${ico('sair')} Expulsar do clã</button>
    <p class="erro" id="gerErro"></p><button class="fSo" data-a="fecharJanela">Fechar</button></div>`;
}
async function acaoCla(b) {
  const acao = b.dataset.claAcao, perigosa = acao === 'expulsar' || acao === 'lider';
  if (perigosa && b.dataset.certeza !== '1') { b.dataset.certeza = '1'; b.textContent = tr('Toque de novo para confirmar'); som('clique'); return; }
  b.disabled = true;
  try { await ON.claGerir(b.dataset.k, acao); som('confirma'); esquecer('meucla'); $('#janela').hidden = true; carregarOnline('cla'); }
  catch (e) { b.disabled = false; const x = $('#gerErro'); if (x) x.textContent = e.message; som('erro'); }
}
function mostrarPedidos() {
  const j = $('#janela'); j.hidden = false;
  j.innerHTML = `<div class="jOnline"><h2>${ico('mao')} Pedidos para entrar</h2><div class="lista" id="pedLista"><p>Carregando...</p></div><p class="erro" id="gerErro"></p><button class="fSo" data-a="fecharJanela">Fechar</button></div>`;
  ON.claPedidos().then(l => { const e = $('#pedLista'); if (!e) return;
    e.innerHTML = l?.length ? l.map(p => `<div class="linha"><button class="nomeBtn" data-perfil="${p.codigo}" data-nt>${esc(p.apelido)}</button><small>fase ${p.fase}</small>
      <button class="btn verde peq" data-ped="${p.codigo}" data-ok="1">${ico('check')}</button><button class="btn vermelho peq" data-ped="${p.codigo}" data-ok="0">${ico('fechar')}</button></div>`).join('') : '<p>Nenhum pedido agora.</p>'; })
    .catch(e => { const x = $('#gerErro'); if (x) x.textContent = e.message; });
}
async function responderPedido(b) {
  const ok = b.dataset.ok === '1'; b.closest('.linha').querySelectorAll('button[data-ped]').forEach(x => { x.disabled = true; });
  try { await ON.claResponder(b.dataset.ped, ok); som(ok ? 'confirma' : 'clique'); if (ok) sfx('vitoria'); b.closest('.linha').remove(); esquecer('meucla', 'chat');
    if (!$('#pedLista .linha')) { $('#janela').hidden = true; carregarOnline('cla'); } }
  catch (e) { b.closest('.linha')?.querySelectorAll('button[data-ped]').forEach(x => { x.disabled = false; }); const x = $('#gerErro'); if (x) x.textContent = e.message; som('erro'); }
}
function editarCla() {
  const c = claAtual; if (!c) return; const j = $('#janela'); j.hidden = false; let cor = c.cor % 8;
  j.innerHTML = `<div class="jOnline editarCla"><h2>${ico('pincel')} Editar clã</h2>
    <input id="edNome" maxlength="18" value="${esc(c.nome)}" placeholder="Nome do novo clã"><input id="edTag" maxlength="4" value="${esc(c.tag || '')}" placeholder="SIGLA">
    <div class="cores">${CORES_CLA.map((k, i) => `<button class="${i === cor ? 'sel' : ''}" data-cor-cla="${i}" style="background:${k}"></button>`).join('')}</div>
    <textarea id="edDesc" maxlength="120" rows="3" placeholder="Descrição do clã">${esc(c.descricao || '')}</textarea>
    <div class="edModo"><button class="${c.fechado ? '' : 'sel'}" data-ed-modo="0">${ico('check')} Aberto</button><button class="${c.fechado ? 'sel' : ''}" data-ed-modo="1">${ico('cadeado')} Fechado</button></div>
    <label class="edFase">Fase mínima para entrar <input id="edFase" type="number" min="0" max="500" inputmode="numeric" value="${c.faseMin || 0}"></label>
    <button class="btn verde" data-a="claEditarSalvar">Salvar</button><p class="erro" id="gerErro"></p><button class="fSo" data-a="fecharJanela">Fechar</button></div>`;
}
async function salvarEdicaoCla(b) {
  const cor = +(document.querySelector('.cores .sel')?.dataset.corCla || 0); b.disabled = true;
  try { await ON.claEditar($('#edNome').value.trim(), $('#edTag').value.trim().toUpperCase(), cor, $('#edDesc').value.trim(), !!document.querySelector('[data-ed-modo="1"].sel'), Math.max(0, Math.floor(+$('#edFase').value || 0))); som('confirma'); esquecer('meucla', 'clas', 'rank_cla'); $('#janela').hidden = true; carregarOnline('cla'); }
  catch (e) { b.disabled = false; const x = $('#gerErro'); if (x) x.textContent = e.message; som('erro'); }
}
// ---- guerra de clãs (sábado e domingo): o dano de todos nas batalhas conta ----
const tempoTxt = seg => { seg = Math.max(0, seg); const d = Math.floor(seg / 86400), h = Math.floor(seg / 3600) % 24, m = Math.floor(seg / 60) % 60; return d ? `${d}d ${h}h` : h ? `${h}h ${m}min` : `${m}min`; };
function pintarGuerra(g) {
  const e = $('#guerraCard'); if (!e || !g) return;
  if (!g.ativa) { e.innerHTML = `<div class="gcCard calma">${ico('poder')}<div><b>Guerra de clãs</b><small>Começa no sábado · em ${tempoTxt(g.comeca)}</small>
    ${g.ultima ? `<small>Última: ${fmt(g.ultima.nos)} × ${fmt(g.ultima.eles)} · ${g.ultima.nos >= g.ultima.eles ? 'vitória!' : 'derrota'}</small>` : ''}</div></div>`; return; }
  if (g.procurando) { e.innerHTML = `<div class="gcCard">${ico('poder')}<div><b>Guerra de clãs</b><small>Procurando um clã adversário...</small></div></div>`; return; }
  const tot = Math.max(1, g.nos.dano + g.eles.dano), k = 100 * g.nos.dano / tot;
  e.innerHTML = `<div class="gcCard ativa"><b>${ico('poder')} Guerra de clãs <small>termina em ${tempoTxt(g.termina)}</small></b>
    <div class="gcVs"><span data-nt>${tagHtml(g.nos.tag, g.nos.cor)}${esc(g.nos.nome)}</span><em>VS</em><span data-nt>${tagHtml(g.eles.tag, g.eles.cor)}${esc(g.eles.nome)}</span></div>
    <div class="gcBarra"><i style="width:${k}%"></i><span class="a">${fmt(g.nos.dano)}</span><span class="b">${fmt(g.eles.dano)}</span></div>
    <small>Todo dano nas batalhas conta. Quem vencer ganha ${ico('ouro')} para cada membro!</small></div>`;
}
// ---- chat do clã: mensagens, pedidos de cartas e avisos (atualiza a cada 4 s com a aba aberta) ----
let claModo = 'chat', chatTimer = null, chatAssin = '';
const NOME_CARTA = { chuva: ['Especial', 'estrela'], gigante: ['Gigante', 'cav'], arco: ['Arqueiros', 'arq'], lanca: ['Lanceiros', 'bar'], mago: ['Magos', 'mag'] };
function htmlChat() {
  return `<div class="chatLista" id="chatLista"><p class="sub">Carregando...</p></div>
    <div class="chatPedir" id="chatPedir" hidden><small>Peça uma carta (1 pedido a cada 4h, até 8 doações):</small><div>${Object.entries(NOME_CARTA).filter(([k]) => S.pd[k]?.nv > 0)
      .map(([k, [n, i]]) => `<button class="cartaMini ${k}" data-pedir="${k}">${ico(i)}<small>${n}</small></button>`).join('')}</div></div>
    <p class="erro" id="onErro"></p>
    <div class="chatEnviar"><button class="chatBtnPedir" data-a="chatPedirAbrir" title="Pedir cartas">${ico('bau')}</button><input id="chatTxt" maxlength="140" placeholder="Mensagem para o clã" enterkeyhint="send"><button class="btn verde peq" data-a="chatEnviar">${ico('seta')}</button></div>`;
}
function abrirChat() {
  clearInterval(chatTimer); chatAssin = ''; lerChat(); receberDoacoes();
  chatTimer = setInterval(() => { if (!$('#chatLista') || tela !== 'lobby') { clearInterval(chatTimer); chatTimer = null; return; } lerChat(); }, 4000);
  $('#chatTxt').addEventListener('keydown', e => { if (e.key === 'Enter') document.querySelector('[data-a=chatEnviar]')?.click(); });
}
function lerChat() {
  const pinta = l => { const el = $('#chatLista'); if (!el) return; l = l || [];
    const assin = l.map(m => m.id + ':' + m.doado + (m.doei ? 'd' : '')).join(); if (assin === chatAssin) return; const noFim = el.scrollTop + el.clientHeight >= el.scrollHeight - 30; chatAssin = assin;
    el.innerHTML = l.length ? l.map(m => {
      if (m.tipo === 'aviso') return `<div class="chM aviso">${ico('estrela')}<span data-nt><b>${esc(m.apelido)}</b> ${esc(m.texto)}</span></div>`;
      if (m.tipo === 'pedido') { const [n, i] = NOME_CARTA[m.item] || ['Carta', 'bau'], cheio = m.doado >= m.maximo;
        return `<div class="chM pedido ${m.eu ? 'eu' : ''}"><button class="nomeBtn chatNome" data-perfil="${m.codigo}" data-nt>${esc(m.apelido)}</button><div class="pedCorpo"><span class="cartaMini ${m.item}">${ico(i)}</span><div><small>pede ${n}</small>
          <div class="barra"><i style="width:${100 * m.doado / m.maximo}%"></i><span>${m.doado}/${m.maximo}</span></div></div>
          ${m.eu ? '' : cheio ? `<em>Completo</em>` : m.doei ? `<em>${ico('check')} Doado</em>` : `<button class="btn amarelo peq" data-doar="${m.id}">Doar<small>${ico('ouro')}20</small></button>`}</div></div>`; }
      return `<div class="chM ${m.eu ? 'eu' : ''}" ${m.eu ? '' : `data-tr="${m.id}"`}>${m.eu ? '' : `<button class="nomeBtn chatNome" data-perfil="${m.codigo}" data-nt>${esc(m.apelido)}</button>`}<span class="tOrig" data-nt>${esc(m.texto)}</span>${!m.eu && precisa(m.texto) ? `<button class="trVer" data-trad="${m.id}">${ico('pergaminho')} Traduzir</button>` : ''}</div>`; }).join('')
      : '<p class="sub">Nenhuma mensagem ainda. Diga oi para o clã!</p>';
    if (noFim || !el.dataset.foi) { el.scrollTop = el.scrollHeight; el.dataset.foi = '1'; }
    chatMsgs = l;
  };
  // na primeira leitura mostra as mensagens guardadas; o resto vem a cada 4 s
  if (!chatAssin) { const c = lerCache('chat'); if (c) pinta(c.d); }
  ON.chatLer(idioma().slice(0, 5)).then(l => { gravarCache('chat', l); pinta(l); }).catch(e => { const el = $('#chatLista'); if (el && !chatAssin) el.innerHTML = `<p class="erro">${esc(e.message)}</p>`; });
}
// tradução no toque: usa a que já está salva no servidor; se não houver, traduz e salva para os próximos
let chatMsgs = [];
async function traduzirMsg(b) {
  const id = +b.dataset.trad, m = chatMsgs.find(x => x.id === id), e = b.closest('.chM'); if (!m || !e) return;
  b.disabled = true; b.lastChild.textContent = ' traduzindo...';
  let r = m.tr; if (!r) { r = await traduzir(m.id, m.texto, idioma()); if (r) ON.tradSalvar(m.id, idioma().slice(0, 5), r.tr, r.de).catch(() => {}); }
  if (!r) { b.lastChild.textContent = ' já está no seu idioma'; return; }
  e.insertAdjacentHTML('beforeend', `<span class="tTrad" data-nt>${esc(r.tr)}</span><button class="trVer" data-tr-ver="${m.id}">${ico('pergaminho')} ${esc(nomeIdioma(r.de))} · <span class="lO">ver original</span><span class="lT">ver tradução</span></button>`);
  e.classList.add('trad'); b.remove(); som('clique');
}
// cartas que o clã doou chegam quando o jogador abre o jogo ou o chat
function receberDoacoes() {
  if (!S.online?.codigo) return; ON.doacoesReceber().then(l => { if (!l?.length) return; let tot = 0;
    for (const { item, n } of l) if (S.pd[item]) { darCartas(item, n); tot += n; }
    if (!tot) return; salvar(); sfx('vitoria'); if (G) faixa(`O CLÃ DOOU ${tot} CARTA${tot > 1 ? 'S' : ''}!`, '#8ae0ff'); if (tela === 'lobby' && abaLobby !== 'cla') desenharLobby(); }).catch(() => {});
}
// aviso automático no chat do clã (pet raro, estrelas...)
function avisarCla(txt) { if (S.online?.codigo) ON.chatEnviar(txt, 'aviso').catch(() => {}); }
// prêmios que chegaram (ajudas dadas, chefe do clã)
function coletarPremios() {
  receberDoacoes(); if (!S.online?.codigo) return; ON.premios().then(l => { if (!l?.length) return; let m = 0; const motivos = {};
    for (const p of l) { m += p.moedas; const k = p.motivo.startsWith('Ajudou') ? 'Você ajudou outros jogadores' : p.motivo; motivos[k] = (motivos[k] || 0) + 1; }
    S.moedas += m; salvar(); if (tela === 'lobby') desenharLobby();
    const j = $('#janela'); if (!j.hidden) return; j.hidden = false; sfx('vitoria');
    j.innerHTML = `<div class="jOnline"><h2>${ico('presente')} Recompensas</h2><div class="premio grande">${ico('ouro')}<b>+${fmt(m)}</b></div>
      ${Object.entries(motivos).map(([k, n]) => `<p>${esc(k)}${n > 1 ? ` ×${n}` : ''}</p>`).join('')}<button class="btn verde grande" data-a="fecharJanela">Pegar</button></div>`; }).catch(() => {});
}
// ---- jogar em dupla: procura parceiro; sem ninguém em 20 s, oferece parceiro do computador ----
let busca = null;
const NOMES_BOT = ['LucasBR', 'DarkPlayer', 'AlexStorm', 'Ghost771', 'ShadowX', 'KevinFox', 'Danielツ', 'NightWolf', 'ZeroSkill', 'RavenBR'];
function procurarDupla() {
  const j = $('#janela'); j.hidden = false; busca = { t0: Date.now(), ativo: true };
  j.innerHTML = `<div class="jOnline"><h2>${ico('herois')} Jogar em dupla</h2><div class="radar"><i></i><i></i>${ico('herois')}</div>
    <p id="buscaTxt">Procurando um parceiro...</p><p class="sub" id="buscaN"></p><button class="btn azul" data-a="cancelarDupla">Cancelar</button></div>`;
  const b0 = busca;
  const passo = async () => {
    if (!b0.ativo) return;
    try {
      const r = await ON.procurar(S.fase);
      if (!b0.ativo) return;
      if (r?.sala) { b0.ativo = false; j.hidden = true; sfx('vitoria'); comecarDupla({ sala: r.sala, apelido: r.apelido, fase: r.fase, host: r.host }); return; }
    } catch (e) { /* sem conexão: segue e cai no parceiro da lista */ }
    // ninguém em ~8 s: entra um parceiro da lista
    if ((Date.now() - b0.t0) / 1000 > 7 + Math.random() * 3) { b0.ativo = false; ON.cancelar(); const nome = NOMES_BOT[Math.floor(Math.random() * NOMES_BOT.length)];
      const el = $('#buscaTxt'); if (el) el.innerHTML = `Parceiro encontrado: <b>${nome}</b>!`; sfx('vitoria');
      setTimeout(() => { if (busca !== b0) return; busca = null; j.hidden = true; comecarDupla({ apelido: nome }); }, 1100); return; }
    setTimeout(passo, 2000);
  };
  passo();
}
// ---- convite direto para a dupla ----
let convite = null, convitesVistos = new Set();
async function convidarDupla(codigo, nome) {
  const j = $('#janela'); j.hidden = false;
  j.innerHTML = `<div class="jOnline"><h2>${ico('herois')} Jogar junto</h2><div class="radar"><i></i><i></i>${ico('herois')}</div>
    <p id="convTxt">Convidando <b data-nt>${esc(nome || '')}</b>... esperando aceitar</p><button class="btn azul" data-a="cancelarConvite">Cancelar</button></div>`;
  let id; try { id = await ON.convidar(codigo, S.fase); } catch (e) { const t = $('#convTxt'); if (t) t.textContent = e.message; som('erro'); return; }
  const c = convite = { id, ativo: true };
  const passo = async () => { if (!c.ativo) return;
    try { const r = await ON.conviteEstado(id); if (!c.ativo) return;
      if (r?.estado === 'aceito') { c.ativo = false; convite = null; j.hidden = true; sfx('vitoria'); comecarDupla({ sala: r.sala, apelido: r.apelido, fase: r.fase, host: true }); return; }
      if (r && r.estado !== 'pendente') { c.ativo = false; convite = null; const t = $('#convTxt'); if (t) t.textContent = tr(r.estado === 'recusado' ? 'Convite recusado.' : 'Ninguém respondeu.'); som('erro'); return; }
    } catch (e) {}
    setTimeout(passo, 2000); };
  setTimeout(passo, 2000);
}
// quem está no lobby recebe os convites (consulta a cada 6 s)
setInterval(() => {
  if (!S || tela !== 'lobby' || !S.online?.codigo || busca || convite || !$('#janela').hidden) return;
  ON.convites().then(l => { const c = (l || []).find(x => !convitesVistos.has(x.id)); if (!c || tela !== 'lobby' || !$('#janela').hidden) return; convitesVistos.add(c.id);
    const j = $('#janela'); j.hidden = false; sfx('brilho'); som('confirma');
    j.innerHTML = `<div class="jOnline convite"><h2>${ico('herois')} Convite!</h2><p><b data-nt>${esc(c.apelido)}</b> chamou você para jogar em dupla (fase ${c.fase}).</p>
      <button class="btn verde grande" data-responder="${c.id}" data-aceita="1">${ico('check')} Aceitar</button><button class="btn cinza" data-responder="${c.id}" data-aceita="0">Recusar</button></div>`; }).catch(() => {});
}, 6000);
async function responderConvite(id, aceita) {
  const j = $('#janela');
  try { const r = await ON.conviteResponder(id, aceita); j.hidden = true;
    if (aceita && r?.sala) { sfx('vitoria'); comecarDupla({ sala: r.sala, apelido: r.apelido, fase: r.fase, host: false }); } else som('fechar'); }
  catch (e) { j.innerHTML = `<div class="jOnline"><p class="erro">${esc(e.message)}</p><button class="btn azul" data-a="fecharJanela">Fechar</button></div>`; som('erro'); }
}
function pararBusca() { if (busca) busca.ativo = false; busca = null; ON.cancelar(); }
function comecarDupla(d) {
  const bot = !d.sala; comecarFase(false, { apelido: d.apelido || NOMES_BOT[Math.floor(Math.random() * NOMES_BOT.length)], bot, host: d.host, fase: d.fase || S.fase });
  if (!bot) { G.dupla.canal = ON.conectarSala(d.sala, (ev, p) => receberDupla(ev, p)); esperarParceiro(); }
}
// os dois começam juntos: cada um avisa "pronto" até ouvir o outro (no máximo 8 s esperando)
const seguidor = () => G?.dupla && !G.dupla.bot && !G.dupla.host && !G.dupla.saiu; // o host manda no chefe; o outro segue
function esperarParceiro() {
  const D = G.dupla; G.espera = 8; faixa('ESPERANDO O PARCEIRO...', '#8ae0ff');
  const tick = () => { if (G?.dupla !== D || !G.espera) return; D.canal?.enviar('pronto', {}); setTimeout(tick, 700); }; tick();
}
function receberDupla(ev, p) {
  const D = G?.dupla; if (!D) return;
  if (ev === '_reconectando') { if (!G.fim) faixa('RECONECTANDO...', '#ffd84a'); return; }
  if (ev === '_voltou') { if (!G.fim) faixa('CONECTADO!', '#7aff8a'); return; }
  if (ev === '_caiu') { if (!D.saiu) { D.saiu = true; if (!G.fim) faixa(`${D.apelido.toUpperCase()} SAIU`, '#ff9a3a'); atualizarRevanche(); } return; }
  if (ev === 'sair') { D.saiu = true; if (!G.fim) faixa(`${D.apelido.toUpperCase()} SAIU`, '#ff9a3a'); atualizarRevanche(); return; }
  if (ev === 'rv') { D.rvParc = true; if (G.fim) { sfx('brilho'); atualizarRevanche(); tentarRevanche(); } }
  if (ev === 'go') { if (D.rvEu) iniciarRevanche(p.fase); return; }
  if (ev === 'pronto') { if (G.espera) { D.canal?.enviar('pronto', {}); G.espera = 0; faixa('VALENDO!', '#7aff8a'); } }
  if (ev === 'c' && !D.host) { D.c = p; return; } // estado do chefe vindo do host
  if (ev === 'pulo' && !D.host && !G.fim) { const ch = G.chefe; if (!ch.pulo) { ch.pulo = { t: 0, z0: ch.z, z1: p.z1 }; C.aviso(0, p.z1 + 4, 11, 0.9, 0xff3322); faixa('CUIDADO: SALTO!', '#ff9a3a'); } return; }
  if (ev === 'hab' && !D.host && !G.fim) { const ch = G.chefe; if (!(ch.avisoHab > 0)) iniciarHab(ch); return; }
  D.visto = performance.now();
  if (D.saiu && D.caiuRede && ev !== 'sair') { D.saiu = false; D.caiuRede = false; if (!G.fim) faixa(`${D.apelido.toUpperCase()} VOLTOU!`, '#7aff8a'); }
  if (ev === 'pd' && !G.fim && !G.espera) { poderDoParceiro(p.id); return; }
  if (ev === 'pi') { D.canal?.enviar('po', { t: p.t }); return; }
  if (ev === 'po') { D.ping = Math.round(performance.now() - p.t); return; }
  if (ev === 'em') { (D.balao ||= []).push({ e: String(p.e).slice(0, 4), t: 0 }); sfx('brilho'); return; }
  if (ev === 'h') { D.px = -p.x; D.pv = -(p.vx || 0); D.pt = performance.now(); D.alvo = Math.max(-MEIA + 2.5, Math.min(MEIA - 2.5, -p.x)); // o parceiro aparece espelhado (do outro lado)
    if (p.hr && HEROIS[p.hr] && p.hr !== D.hr) { D.hr = p.hr; const pos = D.v.raiz.position.clone(); D.v.remover(); D.v = C.heroi(HEROIS[p.hr].visual); D.v.raiz.scale.setScalar(2.4); D.v.raiz.rotation.y = Math.PI; D.v.raiz.position.copy(pos); D.v.tocar('Idle_A'); } }
  if (ev === 'd' && D.host && p.t > D.dano) { const k = p.t - D.dano; D.dano = p.t; if (!G.fim) { G.chefe.hp -= k; G.chefe.flash = 0.06; } }
  if (ev === 'r' && p.n > 0 && !G.fim) { G.fila = Math.min(maxFila(), G.fila + p.n); G.txt.push({ x: D.x, y: 5, z: ZSPAWN, txt: `+${p.n} ${D.apelido}`, cor: '#8ae0ff', t: 0, grande: p.n >= 10 }); }
  if (ev === 'f') { D.fim = p.v ? 'v' : 'd'; if (G.fim) atualizarRevanche(); if (p.v && !G.fim) G.chefe.hp = 0; else if (!p.v && !G.fim) faixa(`${D.apelido.toUpperCase()} CAIU! AGUENTE!`, '#ff5a4a'); }
}
function passoDupla(dt) {
  const D = G.dupla; if (!D) return; D.tEnvio -= dt; D.tTiro -= dt;
  if (D.bot) { // parceiro do computador: anda, atira, causa dano e manda reforços
    D.tBot -= dt; if (D.tBot <= 0) { D.tBot = 2 + Math.random() * 3; D.alvo = (Math.random() - 0.5) * 2 * (MEIA - 3); }
    D.danoBot += dt * G.chefe.max * 0.004 * (G.t > 4 ? 1 : 0); if (D.danoBot >= 1) { const k = Math.floor(D.danoBot); D.danoBot -= k; G.chefe.hp -= k; }
    if (Math.random() < dt * 0.25) receberDupla('r', { n: 3 + Math.floor(Math.random() * (6 + G.n)) });
  } else if (D.canal) {
    if (D.tEnvio <= 0) { const vx = (G.heroi.x - (D.xAnt ?? G.heroi.x)) / 0.1; D.xAnt = G.heroi.x; D.tEnvio = 0.1; D.canal.enviar('h', { x: +G.heroi.x.toFixed(2), vx: +vx.toFixed(2), hr: S.heroi });
      if (!D.host && D.meuDano !== D.danoEnviado && (D.tDano -= 0.16) <= 0) { D.tDano = 0.25; D.danoEnviado = D.meuDano; D.canal.enviar('d', { t: D.meuDano }); }
      if (D.host && !G.espera && (D.tC = (D.tC || 0) - 0.16) <= 0) { D.tC = 0.25; const ch = G.chefe; D.canal.enviar('c', { hp: Math.round(ch.hp), z: +ch.z.toFixed(2), dg: D.dano, dh: Math.round(D.meuDano) }); }
      if (D.reforco >= 1 && (D.tRef -= 0.16) <= 0) { D.tRef = 1; D.canal.enviar('r', { n: Math.floor(D.reforco) }); D.reforco -= Math.floor(D.reforco); } }
    if ((D.tPing = (D.tPing ?? 1) - dt) <= 0) { D.tPing = 2; D.canal.enviar('pi', { t: performance.now() }); }
    if (!D.saiu && D.visto && performance.now() - D.visto > 8000) { D.saiu = true; D.caiuRede = true; faixa(`${D.apelido.toUpperCase()} DESCONECTOU`, '#ff9a3a'); }
    // prevê o movimento do parceiro entre uma mensagem e outra (anda liso mesmo com atraso)
    if (D.pt) { const ad = Math.min(0.25, (performance.now() - D.pt) / 1000); D.alvo = Math.max(-MEIA + 2.5, Math.min(MEIA - 2.5, D.px + D.pv * ad)); }
    // quem segue: vida e posição do chefe iguais às do host (o próprio dano ainda não confirmado fica descontado)
    if (seguidor() && D.c && !G.fim) { const ch = G.chefe, alvo = D.c.hp - Math.max(0, D.meuDano - (D.c.dg || 0));
      ch.hp = Math.min(ch.max, alvo); if (!ch.pulo && !ch.inv) ch.z += (D.c.z - ch.z) * Math.min(1, dt * 5); }
  }
  // herói do parceiro e as flechas dele (derrubam orcs da pista do meio)
  D.x += (D.alvo - D.x) * Math.min(1, dt * 12); D.v.raiz.position.x = D.x; D.v.mixer.update(dt);
  if (!D.saiu && D.fim !== 'd' && D.tTiro <= 0) { D.tTiro = 0.4; D.v.tocar('Ranged_Magic_Shoot', { loop: false, reinicia: true });
    const A = HEROIS[D.hr]?.ataque, o = A ? projetilHeroi(A.proj, A.cor) : new THREE.Mesh(GEO_FLECHA, MAT_FLECHA_P); o.position.set(D.x, 2.6, ZH - 1); cena.add(o); G.flechas.push({ x: D.x, z: ZH - 1, o, parc: true, perf: 0, dano: 1 }); }
}
const MAT_FLECHA_P = new THREE.MeshBasicMaterial({ color: 0x8ae0ff });
// projéteis de cada herói (materiais em cache por cor)
const MATS_P = {}, matP = c => MATS_P[c] ||= new THREE.MeshBasicMaterial({ color: c });
const GEO_ORBE = new THREE.SphereGeometry(0.45, 10, 8), GEO_ADAGA = new THREE.BoxGeometry(0.12, 0.12, 1.1), GEO_VIROTE = new THREE.CylinderGeometry(0.1, 0.1, 1.6, 5).rotateX(Math.PI / 2);
function projetilHeroi(tipo, cor) {
  const geo = tipo === 'orbe' || tipo === 'fogo' ? GEO_ORBE : tipo === 'adaga' ? GEO_ADAGA : tipo === 'virote' ? GEO_VIROTE : GEO_FLECHA;
  const o = new THREE.Mesh(geo, matP(cor)); if (tipo === 'fogo') o.scale.setScalar(1.3); return o;
}
// tela final da dupla: dano de cada um no chefe e o MVP
function placarDupla() {
  const D = G.dupla, eu = Math.round(D.meuDano || 0), ele = Math.round(D.host ? D.dano || 0 : D.c?.dh || 0), tot = Math.max(1, eu + ele), mvpEu = eu >= ele;
  const linha = (nome, v, mvp, cls) => `<div class="dpLinha ${cls}"><b data-nt>${mvp ? ico('coroa') : ''}${esc(nome)}</b><div class="dpBarra"><i style="width:${100 * v / tot}%"></i></div><em>${fmt(v)}</em></div>`;
  return `<div class="dpPlacar"><small>Dano no chefe</small>${linha(S.online?.apelido || 'Você', eu, mvpEu, 'eu')}${linha(D.apelido, ele, !mvpEu, 'ele')}<p class="dpMvp">${ico('coroa')} MVP: <b data-nt>${esc(mvpEu ? (S.online?.apelido || 'Você') : D.apelido)}</b></p></div>`;
}
function fimDupla(venceu) { const D = G.dupla; if (D?.canal) D.canal.enviar('f', { v: venceu }); }
// ---- jogar de novo com o mesmo parceiro: os dois precisam aceitar ----
function pedirRevanche() {
  const D = G?.dupla; if (!D || D.rvEu) return; D.rvEu = true; som('confirma');
  if (D.bot) setTimeout(() => { if (G?.dupla === D) { D.rvParc = true; tentarRevanche(); } }, 1200 + Math.random() * 1200);
  else D.canal?.enviar('rv', {});
  atualizarRevanche(); tentarRevanche();
  setTimeout(() => { if (G?.dupla === D && G.fim && !D.rvParc) { D.semResposta = true; atualizarRevanche(); } }, 20000);
}
function tentarRevanche() {
  const D = G?.dupla; if (!D || !D.rvEu || !D.rvParc || !G.fim) return;
  if (D.bot || D.host) { const fase = G.fim === 'v' || D.fim === 'v' ? G.n + 1 : G.n; D.canal?.enviar('go', { fase }); iniciarRevanche(fase); }
}
function iniciarRevanche(fase) {
  const A = G.dupla; A.manter = true; $('#fim').hidden = true; sfx('vitoria');
  comecarFase(false, { apelido: A.apelido, bot: A.bot, host: A.host, fase, hr: A.hr }); G.dupla.canal = A.canal;
}
function atualizarRevanche() {
  const D = G?.dupla, el = $('#rvTxt'), b = document.querySelector('[data-a=revanche]'); if (!D || !el || !b) return;
  const nome = esc(D.apelido);
  if (D.saiu || D.semResposta) { el.textContent = D.saiu ? `${D.apelido} saiu da sala.` : `${D.apelido} não respondeu.`; b.dataset.a = 'dupla'; b.innerHTML = `${ico('herois')} Procurar outro parceiro`; b.classList.remove('pulsa'); return; }
  b.classList.toggle('pulsa', D.rvParc && !D.rvEu);
  if (D.rvEu && !D.rvParc) { el.innerHTML = D.fim ? `Esperando <b>${nome}</b> aceitar...` : `<b>${nome}</b> ainda está jogando. Esperando...`; b.disabled = true; b.innerHTML = `${ico('relogio')} Esperando...`; }
  else if (D.rvParc && !D.rvEu) { el.innerHTML = `<b>${nome}</b> quer jogar de novo!`; b.innerHTML = `${ico('check')} Aceitar e jogar de novo`; }
  else if (!D.fim) el.innerHTML = `<b>${nome}</b> ainda está jogando...`;
  else el.textContent = '';
}
// ---- perfil e medalhas ----
const avatarAtual = () => (S.avatar && temPet(S.avatar) ? S.avatar : S.equipe[0] || 'cao');
function mostrarPerfil() {
  const j = $('#janela'), re = !j.hidden && !!j.querySelector('.jPerfil'); j.hidden = false; const O = ON.conta(); enviarPerfil();
  const med = k => { const M = MEDALHAS[k], nv = nivelMedalha(k), pg = pegas(k), v = M.valor(), prox = M.metas[Math.min(nv, 2)], cor = nv ? NIVEIS_MEDALHA[nv - 1][1] : '#b8b0a4';
    const p = pg < nv ? premioMedalha(pg + 1) : null;
    return `<div class="pfMed ${nv ? 'tem' : ''}" style="--m:${cor}"><span class="pfMedIco">${ico(M.icone)}</span><div><b>${M.nome}</b><small>${nv ? NIVEIS_MEDALHA[nv - 1][0] : '—'}${'★'.repeat(nv)}</small>
      ${nv < 3 ? `<div class="barra"><i style="width:${Math.min(100, 100 * v / prox)}%"></i><span>${fmt(v)}/${fmt(prox)}</span></div>` : ''}</div>
      ${p ? `<button class="btn verde peq" data-medalha="${k}">${p.ovo ? ico('ovo') : ico('ouro')}${p.moedas ? fmt(p.moedas) : ''}</button>` : ''}</div>`; };
  const vars = Object.keys(S.pets).flatMap(b => S.pets[b].e.map((n, e) => n > 0 ? b + '*'.repeat(e) : null).filter(Boolean));
  setTimeout(carregarAmigos, 0); j.innerHTML = `<div class="jMissoes jPerfil ${re ? 'semAnim' : ''}"><div class="pfTopo"><img src="${fotoPet(avatarAtual(), 256)}" alt=""><div><b data-nt>${esc(O?.apelido || 'Herói')}</b>
      <small>${S.renasc ? `${ico('girar')} ×${S.renasc} · ` : ''}Fase ${S.fase}</small></div></div>
    <div class="pfAvatares">${vars.map(k => `<button class="${k === avatarAtual() ? 'sel' : ''}" data-avatar="${k}"><img src="${fotoPet(k)}" alt=""></button>`).join('')}</div>
    <div class="pfLista"><h3>Estatísticas</h3>${htmlStats(dadosPerfil())}
    <h3>Amigos ${O?.codigo ? `<small>seu código: <b data-nt>${O.codigo}</b></small>` : ''}</h3>
    <div class="codigo"><input id="amCod" maxlength="6" inputmode="numeric" placeholder="Código do amigo"><button class="btn verde peq" data-a="amigoCod">${ico('herois')}</button></div><p class="erro" id="amErro"></p>
    <div id="amLista"><p class="sub">Carregando...</p></div>
    <h3>Medalhas <small>cada nível dá um prêmio</small></h3>${Object.keys(MEDALHAS).map(med).join('')}${htmlConta()}</div>
    <button class="btn azul" data-a="fecharJanela">Fechar</button></div>`;
}
// ---- nuvem: backup automático (sem o segredo da conta) a cada 60 s se algo mudou ----
let nuvemT = 0; try { nuvemT = +localStorage.getItem('ponte_nuvem') || 0; } catch (e) {}
let enviandoNuvem = false;
// a conta foi recuperada em outro celular: o segredo deste ficou velho e nada mais salva na nuvem
let avisouConta = false;
addEventListener('contaInvalida', () => { if (!S) return; S.contaInvalida = true; salvar(); if (avisouConta) return; avisouConta = true; setTimeout(avisoConta, 600); });
function avisoConta() {
  const j = $('#janela'); if (!j.hidden && !j.querySelector('.jConta')) { setTimeout(avisoConta, 2000); return; } j.hidden = false; som('erro');
  j.innerHTML = `<div class="jOnline jConta"><h2>${ico('cadeado')} Conta aberta em outro celular</h2>
    <p class="ctNome" data-nt>${ico('herois')} ${esc(S.online?.apelido || '')}</p><p>Sua conta foi recuperada em outro aparelho. Este celular não salva mais na nuvem.</p>
    <p>Para continuar com ela aqui, recupere com seu código e senha (o progresso da nuvem vem junto).</p>
    <button class="btn roxo grande" data-a="contaRecuperar">${ico('girar')} Recuperar conta</button>
    <button class="btn azul" data-a="contaNova">Criar conta nova neste celular</button><button class="fSo" data-a="fecharJanela">Depois</button></div>`;
}
function backupNuvem(forcar) {
  if (S.contaInvalida) return Promise.resolve();
  if (enviandoNuvem || (!forcar && !mudouDesdeBackup())) return Promise.resolve();
  const { online, ...dados } = S; enviandoNuvem = true;
  return ON.saveEnviar(dados).then(() => { backupFeito(); nuvemT = Date.now(); try { localStorage.setItem('ponte_nuvem', nuvemT); } catch (e) {} }).catch(() => {}).finally(() => { enviandoNuvem = false; });
}
setInterval(() => { if (S && tela !== 'jogo') backupNuvem(); }, 60000);
const haQuanto = t => { const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.floor(m / 60)} h` : `há ${Math.floor(m / 1440)} dias`; };
function htmlConta() {
  const O = ON.conta();
  return `<h3>${ico('escudo')} Conta e nuvem</h3><div class="ctCaixa">
    <p>${ico('check')} Progresso salvo na nuvem: <b>${nuvemT ? haQuanto(nuvemT) : 'ainda não'}</b></p>
    ${S.temSenha ? `<p>${ico('cadeado')} Senha de recuperação criada. Seu código: <b data-nt>${O?.codigo || '...'}</b></p><button class="fSo" data-a="ctTrocarSenha">trocar senha</button>`
      : `<p>Crie uma senha para recuperar tudo em outro celular (com seu código <b data-nt>${O?.codigo || '...'}</b>).</p>`}
    <div class="codigo ${S.temSenha ? 'oculto' : ''}" id="ctSenhaBox"><input id="ctSenha" type="password" maxlength="32" placeholder="Nova senha"><button class="btn verde peq" data-a="ctSalvarSenha">Salvar</button></div>
    <details><summary>Recuperar progresso de outro celular</summary><p class="aviso">Isso troca o progresso deste celular pelo da outra conta.</p>
      <div class="codigo"><input id="ctCod" maxlength="6" inputmode="numeric" placeholder="Código"><input id="ctPass" type="password" maxlength="32" placeholder="Senha"></div>
      <button class="btn roxo" data-a="ctRecuperar">Recuperar</button></details><p class="erro" id="ctErro"></p></div>`;
}
async function acaoConta(a, b) {
  const e = $('#ctErro'), msg = (t, ok) => { if (e) { e.textContent = tr(t); e.className = ok ? 'ok' : 'erro'; } som(ok ? 'confirma' : 'erro'); };
  if (a === 'ctTrocarSenha') { $('#ctSenhaBox')?.classList.remove('oculto'); return; }
  if (a === 'ctSalvarSenha') { const v = $('#ctSenha').value; if (v.length < 4) return msg('Senha com pelo menos 4 caracteres');
    b.disabled = true; try { await ON.senhaDefinir(v); S.temSenha = true; salvar(); await backupNuvem(true); mostrarPerfil(); } catch (er) { b.disabled = false; msg(er.message); } return; }
  if (a === 'ctRecuperar') { const c = $('#ctCod').value.trim(), v = $('#ctPass').value; if (c.length < 4 || v.length < 4) return msg('Preencha o código e a senha');
    if (b.dataset.certeza !== '1') { b.dataset.certeza = '1'; b.textContent = tr('Toque de novo para confirmar'); return; }
    b.disabled = true;
    try { const r = await ON.recuperar(c, v); const novo = r.dados && typeof r.dados === 'object' ? r.dados : { v: 1, fase: 1, moedas: 0, up: {}, melhor: 0 };
      novo.online = { id: r.id, segredo: r.segredo, apelido: r.apelido, codigo: r.codigo }; novo.temSenha = true; novo.contaInvalida = false;
      localStorage.setItem('ponte_v1', JSON.stringify(novo)); try { localStorage.setItem('ponte_nuvem', Date.now()); } catch (er) {}
      msg('Progresso recuperado! Reiniciando...', true); setTimeout(() => location.reload(), 900); }
    catch (er) { b.disabled = false; b.dataset.certeza = ''; b.textContent = tr('Recuperar'); msg(er.message); } }
}
// perfil público: o que os outros veem ao tocar no seu nome (enviado ao abrir o lobby)
function dadosPerfil() { const E = S.est || {}; return { fase: Math.max(S.melhor || 0, S.fase - 1), renasc: S.renasc || 0, recInf: S.recInf || 0, cq: S.cq.est - 1, orcs: E.orcs || 0, chefes: E.chefes || 0, ovos: E.ovos || 0,
  pets: Object.keys(S.pets).length, medalhas: Object.fromEntries(Object.keys(MEDALHAS).map(k => [k, nivelMedalha(k)])), equipe: S.equipe.slice(0, 5), forca: forcaEquipe(), heroi: S.heroi }; }
let perfilEnviado = '';
function enviarPerfil() { if (!S.online?.codigo) return; const d = dadosPerfil(), a = avatarAtual(), k = a + JSON.stringify(d); if (k === perfilEnviado) return; perfilEnviado = k; ON.perfilSalvar(a, d).catch(() => { perfilEnviado = ''; }); }
const petValido = k => { if (k && typeof k === 'object') k = k.k; return typeof k === 'string' && PETS[base(k)] ? k : 'cao'; };
function htmlStats(d) { const st = (icone, nome, v) => `<div class="pfStat">${ico(icone)}<b>${v}</b><small>${nome}</small></div>`;
  return `<div class="pfStats">${st('escudo', 'Fase máxima', d.fase || 0)}${st('caveira', 'Orcs derrotados', fmt(d.orcs || 0))}${st('chefe', 'Chefes', fmt(d.chefes || 0))}${st('ovo', 'Ovos chocados', fmt(d.ovos || 0))}
    ${st('pata', 'Pets', `${d.pets || 0}/${Object.keys(PETS).length}`)}${st('bandeira', 'Conquista', d.cq || 0)}${st('h_triplo', 'Recorde ∞', fmt(d.recInf || 0))}${st('girar', 'Renascer', d.renasc || 0)}</div>`; }
async function verPerfil(codigo) {
  if (codigo === S.online?.codigo) return mostrarPerfil();
  const j = $('#janela'); j.hidden = false; const ck = 'perfil_' + codigo, c = CACHE[ck];
  if (c) { pintarPerfil(codigo, c.d); if (Date.now() - c.t < 60000) return; } else j.innerHTML = `<div class="jMissoes jPerfil"><p class="sub">Carregando...</p></div>`;
  let P; try { P = await ON.perfilVer(codigo); } catch (e) { if (!c) j.innerHTML = `<div class="jMissoes jPerfil"><p class="erro">${esc(e.message)}</p><button class="btn azul" data-a="fecharJanela">Fechar</button></div>`; return; }
  if (!P) { if (!c) j.hidden = true; return; }
  const mudou = !c || JSON.stringify(c.d) !== JSON.stringify(P); CACHE[ck] = { t: Date.now(), d: P };
  if (mudou && !j.hidden) try { pintarPerfil(codigo, P); } catch (e) { j.innerHTML = `<div class="jMissoes jPerfil"><p class="erro">${esc(e.message)}</p><button class="btn azul" data-a="fecharJanela">Fechar</button></div>`; }
}
function pintarPerfil(codigo, P) {
  const j = $('#janela'), re = !!j.querySelector('.jPerfil .pfTopo'); const d = P.dados || {};
  const meds = Object.keys(MEDALHAS).map(k => { const nv = d.medalhas?.[k] || 0; return nv ? `<span class="pfMedP" style="--m:${NIVEIS_MEDALHA[nv - 1][1]}" title="${MEDALHAS[k].nome}">${ico(MEDALHAS[k].icone)}</span>` : ''; }).join('');
  j.innerHTML = `<div class="jMissoes jPerfil ${re ? 'semAnim' : ''}"><div class="pfTopo"><img src="${fotoPet(petValido(P.avatar), 256)}" alt=""><div><b data-nt>${tagHtml(P.tag, P.cor)}${esc(P.apelido)}</b>
      <small><i class="pontoOn ${P.online ? 'on' : ''}"></i>${P.online ? 'online' : 'offline'}${P.cla ? ` · <span data-nt>${esc(P.cla)}</span>` : ''}${d.renasc ? ` · ${ico('girar')} ×${d.renasc}` : ''}</small></div></div>
    <div class="pfLista">${(d.equipe || []).length ? `<h3>Equipe <small>${ico('forca')} ${fmt(d.forca || 0)}</small></h3><div class="pfEquipe">${d.equipe.filter(k => PETS[base(k)]).map(k => `<span class="r${PETS[base(k)].r}" style="--r:${RARIDADES[PETS[base(k)].r].cor}"><img src="${fotoPet(k)}" alt="">${est(k) ? `<i style="color:${ESTRELAS[est(k)].cor}">${'★'.repeat(est(k))}</i>` : ''}</span>`).join('')}</div>` : ''}
      <h3>Estatísticas</h3>${htmlStats(d)}${meds ? `<h3>Medalhas</h3><div class="pfMeds">${meds}</div>` : ''}</div>
    ${P.online ? `<button class="btn amarelo" data-convidar="${codigo}" data-nome="${esc(P.apelido)}">${ico('h_triplo')} Jogar junto (Dupla)</button>` : ''}
    ${(S.amigosC || []).includes(codigo) ? `<button class="btn cinza" data-amigo="${codigo}" data-ativo="0">${ico('check')} Amigo · remover</button>` : `<button class="btn verde" data-amigo="${codigo}" data-ativo="1">${ico('herois')} Adicionar amigo</button>`}
    <p class="erro" id="amErro"></p><button class="btn azul" data-a="fecharJanela">Fechar</button></div>`;
}
async function marcarAmigo(b) {
  const c = b.dataset.amigo, at = b.dataset.ativo === '1', e = $('#amErro'); b.disabled = true;
  try { await ON.amigoMarcar(c, at); esquecer('amigos'); S.amigosC = at ? [...new Set([...(S.amigosC || []), c])] : (S.amigosC || []).filter(x => x !== c); salvar(); som(at ? 'confirma' : 'clique'); if (at) sfx('brilho');
    b.disabled = false; if (j_perfilProprio()) carregarAmigos(); else verPerfil(c); }
  catch (er) { b.disabled = false; if (e) e.textContent = er.message; som('erro'); }
}
const j_perfilProprio = () => !!document.querySelector('#janela .jPerfil #amLista');
// lista de amigos no seu perfil
function carregarAmigos() {
  const el = $('#amLista'); if (!el) return; if (!S.online?.codigo) { el.innerHTML = '<p class="sub">Entre no Clã ou no Ranking uma vez para ter amigos.</p>'; return; }
  comCache('amigos', () => ON.amigos(), l => { const e = $('#amLista'); if (!e) return; l = l || []; S.amigosC = l.map(a => a.codigo); salvar();
    e.innerHTML = l.length ? l.map(a => `<div class="linha amigo"><img src="${fotoPet(petValido(a.avatar))}" alt=""><i class="pontoOn ${a.online ? 'on' : ''}"></i><button class="nomeBtn" data-perfil="${a.codigo}" data-nt>${tagHtml(a.tag, a.cor)}${esc(a.apelido)}</button><small>fase ${a.fase}</small>${a.mutuo ? `<em>${ico('herois')}</em>` : ''}</div>`).join('')
      : '<p class="sub">Nenhum amigo ainda. Toque no nome de alguém no clã, chat ou ranking, ou adicione pelo código.</p>'; },
    er => { const e = $('#amLista'); if (e) e.innerHTML = `<p class="erro">${esc(er.message)}</p>`; });
}
// ---- loja diária ----
function mostrarLoja() {
  const L = lojaDia(), j = $('#janela'); j.hidden = false; const ag = new Date(), meia = new Date(ag.getFullYear(), ag.getMonth(), ag.getDate() + 1), h = Math.floor((meia - ag) / 36e5), m = Math.floor((meia - ag) / 6e4) % 60;
  const item = o => o.tipo === 'ovo' ? `${CQ.ovoHtml(o.ovo)}<b>${OVOS[o.ovo].nome}</b>` : o.tipo === 'bau' ? `${bauHtml(o.bau)}<b>${BAUS[o.bau].nome}</b>`
    : o.tipo === 'pet' ? `<img src="${fotoPet(o.pet)}" alt=""><b data-nt>${PETS[o.pet].nome}</b><small style="color:${RARIDADES[PETS[o.pet].r].cor}">${RARIDADES[PETS[o.pet].r].nome}</small>`
    : `<span class="cartaMini ${o.carta}">${ico(NOME_CARTA[o.carta][1])}</span><b>${NOME_CARTA[o.carta][0]} x${o.n}</b>`;
  const re = !!j.querySelector('.jLoja'); j.innerHTML = `<div class="jMissoes jLoja ${re ? 'semAnim' : ''}"><h2>${ico('mercado')} Loja do dia</h2><p class="sub">Novas ofertas em ${h}h${String(m).padStart(2, '0')}</p>
    <div class="ljGrade">${ofertas().map((o, i) => { const feito = L.comprados.includes(i);
      return `<div class="ljItem ${feito ? 'feito' : ''}">${o.desconto ? `<i class="ljDesc">-${o.desconto}%</i>` : ''}<div class="ljImg">${item(o)}</div>
        ${feito ? `<em>${ico('check')} Comprado</em>` : `<button class="btn ${S.moedas >= o.preco ? 'verde' : 'cinza'} peq" data-oferta="${i}" ${S.moedas >= o.preco ? '' : 'disabled'}>${ico('ouro')} ${fmt(o.preco)}</button>`}</div>`; }).join('')}</div>
    <button class="btn azul" data-a="fecharJanela">Fechar</button></div>`;
}
// ---- missões e passe ----
let modoMissao = 'missoes';
function mostrarMissoes() {
  atualizarMissoes(); const j = $('#janela'), M = S.missoes, P = S.passe, nv = nivelPasse(); j.hidden = false;
  const linha = (m, i, sem) => { const T = TIPOS_MISSAO[m.t], ok = m.prog >= m.meta;
    return `<div class="msLinha ${m.pego ? 'pego' : ok ? 'ok' : ''}"><span class="msIco">${ico(T.icone)}</span><div><b>${T.txt.replace('#', fmt(m.meta))}</b>
      <div class="barra"><i style="width:${100 * m.prog / m.meta}%"></i><span>${fmt(m.prog)}/${fmt(m.meta)}</span></div></div>
      ${m.pego ? `<em>${ico('check')}</em>` : `<button class="btn ${ok ? 'verde' : 'cinza'} peq" data-missao="${sem ? 's' : 'd'}:${i}" ${ok ? '' : 'disabled'}>${ico('estrela')}+${sem ? 150 : 40}</button>`}</div>`; };
  const premioHtml = n => { const p = premioNivel(n); return p.ovo ? CQ.ovoHtml(p.ovo, 'mini') : p.bau ? bauHtml(p.bau, 'mini') : `${ico('ouro')}<small>${fmt(p.moedas)}</small>`; };
  const re = !!j.querySelector('.jMissoes'); j.innerHTML = `<div class="jMissoes ${re ? 'semAnim' : ''}"><div class="abas"><button class="${modoMissao === 'missoes' ? 'on' : ''}" data-mm="missoes">${ico('missoes')} Missões</button><button class="${modoMissao === 'passe' ? 'on' : ''}" data-mm="passe">${ico('coroa')} Passe</button></div>
    ${modoMissao === 'missoes' ? `<h3>Diárias <small>renovam todo dia</small></h3>${M.diarias.map((m, i) => linha(m, i, false)).join('')}
      <h3>Semanais <small>dão um Ovo Comum</small></h3>${M.semanais.map((m, i) => linha(m, i, true)).join('')}`
    : `<div class="psTopo"><b>Nível ${nv}/${NIVEIS_PASSE}</b><small>Temporada acaba em ${fimTemporada()} dias</small>
        <div class="barra"><i style="width:${nv >= NIVEIS_PASSE ? 100 : (P.pts % PTS_NIVEL)}%"></i><span>${nv >= NIVEIS_PASSE ? 'MÁX' : `${P.pts % PTS_NIVEL}/${PTS_NIVEL}`}</span></div><small>Missões dão ${ico('estrela')} para subir</small></div>
      <div class="psLista">${Array.from({ length: NIVEIS_PASSE }, (_, k) => { const n = k + 1, pego = P.pegos.includes(n), pode = n <= nv && !pego;
        return `<div class="psNivel ${pego ? 'pego' : pode ? 'pode' : n > nv ? 'bloq' : ''}"><span class="psN">${n}</span><div class="psPremio">${premioHtml(n)}</div>
          ${pego ? `<em>${ico('check')}</em>` : pode ? `<button class="btn verde peq" data-passe="${n}">Pegar</button>` : `<em>${ico('cadeado')}</em>`}</div>`; }).join('')}</div>`}
    <button class="btn azul" data-a="fecharJanela">Fechar</button></div>`;
  if (modoMissao === 'passe') { const alvo = j.querySelector('.psNivel.pode') || j.querySelectorAll('.psNivel')[Math.max(0, nv - 1)]; alvo?.scrollIntoView({ block: 'center' }); }
}
function mostrarDiario() {
  const j = $('#janela'); j.hidden = false; const pronto = diarioPronto(), dia = diaDoPresente(), hojeI = pronto ? dia : (dia + 6) % 7;
  j.innerHTML = `<div class="jDiario"><h2>${ico('presente')} Presente diário</h2><p>Entre todo dia: o presente cresce. Se faltar um dia, volta ao começo.</p>
    <div class="dias">${DIARIO.map((D, i) => `<div class="dia ${i < hojeI || (!pronto && i === hojeI) ? 'pego' : i === hojeI ? 'hoje' : ''}"><small>Dia ${i + 1}</small>
      ${D.bau ? bauHtml(D.bau, 'mini') : `${ico('ouro')}<b>${fmt(Math.round((40 + 12 * S.fase) * D.moedas))}</b>`}${i < hojeI || (!pronto && i === hojeI) ? `<i>${ico('check')}</i>` : ''}</div>`).join('')}</div>
    ${pronto ? `<button class="btn amarelo grande" data-a="pegarDiario">${ico('presente')} Pegar presente</button>` : '<p class="volte">Volte amanhã para o próximo!</p>'}
    <div class="codigo"><input id="codTxt" maxlength="20" placeholder="Tem um código?"><button class="btn amarelo peq" data-a="resgatar">Usar</button></div><p class="erro" id="codErro"></p>
    <button class="btn azul" data-a="fecharJanela">Fechar</button></div>`;
}
async function resgatarCodigo(b) {
  const i = $('#codTxt'), e = $('#codErro'), c = i.value.trim(); if (!c) return; b.disabled = true; e.textContent = '';
  try { const r = await ON.resgatar(c); S.moedas += r.moedas || 0; S.ovos.comum += r.comum || 0; S.ovos.magico += r.magico || 0; salvar(); sfx('vitoria'); som('moedas');
    e.className = 'ok'; e.textContent = [r.moedas && `+${fmt(r.moedas)} ${tr('moedas')}`, r.comum && `+${r.comum} ${tr('Ovo Comum')}`, r.magico && `+${r.magico} ${tr('Ovo Mágico')}`].filter(Boolean).join(' · '); i.value = '';
    if (tela === 'lobby') desenharLobby(); }
  catch (er) { e.className = 'erro'; e.textContent = er.message; som('erro'); }
  b.disabled = false;
}
function clique(e) {
  const b = e.target.closest('button'); if (!b) return; let a = b.dataset.a; if (b.dataset.modo) { $('#janela').hidden = true; a = b.dataset.modo; }
  if (a === 'som') { alternarSom(); som('clique'); if ($('#janela .jConfig')) mostrarConfig(); else desenharLobby(); }
  if (b.dataset.abaLobby) { som('clique'); abaLobby = b.dataset.abaLobby; desenharLobby(); }
  if (b.dataset.up) { if (comprar(b.dataset.up)) { som('compra'); desenharLobby(); } else som('erro'); }
  if (a === 'jogar') { som('confirma'); comecarFase(); }
  if (a === 'modos') { som('clique'); mostrarModos(); return; }
  if (b.dataset.emo) { const D = G?.dupla; if (!D || (D.emoT && performance.now() - D.emoT < 1200)) return; D.emoT = performance.now(); (D.balao ||= []).push({ e: b.dataset.emo, t: 0, eu: true }); D.canal?.enviar('em', { e: b.dataset.emo }); som('clique'); return; }
  if (b.dataset.claVer) { som('clique'); verCla(b.dataset.claVer); return; }
  if (a === 'contaRecuperar') { som('clique'); mostrarPerfil(); setTimeout(() => { const d = document.querySelector('#janela details'); if (d) { d.open = true; d.scrollIntoView({ block: 'center' }); } }, 300); return; }
  if (a === 'contaNova') { if (b.dataset.certeza !== '1') { b.dataset.certeza = '1'; b.textContent = tr('Toque de novo para confirmar'); som('clique'); return; }
    S.online = null; S.contaInvalida = false; S.temSenha = null; S.arena = null; salvar(); avisouConta = false; ON.garantir().then(() => { sfx('vitoria'); mostrarPerfil(); }).catch(() => {}); return; }
  if (a === 'rsColetar') { const q = b.getBoundingClientRect(), m = coletarOcioso(); if (m > 0) { sfx('vitoria'); desenharLobby(); voarMoedas('.lbTopo .pilula.ouro', 12, { x: q.left + q.width / 2, y: q.top + q.height / 2 }); } b.disabled = true; b.textContent = tr('Coletado!'); return; }
  if (a === 'infinito') { if (S.melhor < 3) { som('erro'); return; } som('confirma'); comecarFase(true); }
  if (a === 'denovoInf') { som('confirma'); comecarFase(true); }
  if (a === 'sair') { som('fechar'); G?.dupla?.canal?.enviar('sair', {}); $('#janela').hidden = true; abrirLobby(); }
  if (a === 'proxima') { som('confirma'); comecarFase(); }
  if (a === 'lobby') { som('clique'); abrirLobby(); }
  if (a === 'lobbyUp') { som('clique'); abrirLobby(); abaLobby = 'up'; desenharLobby(); }
  if (b.dataset.pd) usarPoder(b.dataset.pd);
  if (a === 'roleta') pararRoleta();
  if (a === 'diario') { som('clique'); mostrarDiario(); }
  if (a === 'renascer') renascer(b);
  if (a === 'resgatar') resgatarCodigo(b);
  if (a === 'missoes') { som('clique'); mostrarMissoes(); }
  if (a === 'perfil') { som('clique'); mostrarPerfil(); }
  if (a?.startsWith('ct')) { acaoConta(a, b); return; }
  if (b.dataset.perfil) { som('clique'); verPerfil(b.dataset.perfil); return; }
  if (b.dataset.amigo) { marcarAmigo(b); return; }
  if (b.dataset.gerir) { som('clique'); menuMembro(b.dataset.gerir); return; }
  if (b.dataset.claAcao) { acaoCla(b); return; }
  if (a === 'claEditarAbrir') { som('clique'); editarCla(); return; }
  if (a === 'claPedidosAbrir') { som('clique'); mostrarPedidos(); return; }
  if (b.dataset.ped) { responderPedido(b); return; }
  if (b.dataset.edModo) { document.querySelectorAll('.edModo button').forEach(x => x.classList.toggle('sel', x === b)); som('clique'); return; }
  if (a === 'claEditarSalvar') { salvarEdicaoCla(b); return; }
  if (b.dataset.corCla) { document.querySelectorAll('.cores button').forEach(x => x.classList.toggle('sel', x === b)); som('clique'); return; }
  if (b.dataset.convidar) { som('confirma'); convidarDupla(b.dataset.convidar, b.dataset.nome); return; }
  if (a === 'cancelarConvite') { som('fechar'); if (convite) { convite.ativo = false; ON.conviteCancelar(convite.id); convite = null; } $('#janela').hidden = true; return; }
  if (b.dataset.responder) { responderConvite(+b.dataset.responder, b.dataset.aceita === '1'); return; }
  if (a === 'amigoCod') { const c = $('#amCod').value.trim(); if (c.length < 4) { som('erro'); return; } b.dataset.amigo = c; b.dataset.ativo = '1'; marcarAmigo(b).then(() => { const i = $('#amCod'); if (i && !$('#amErro')?.textContent) i.value = ''; }); return; }
  if (b.dataset.avatar) { S.avatar = b.dataset.avatar; salvar(); som('clique'); mostrarPerfil(); desenharLobby(); }
  if (b.dataset.medalha) { const r = pegarMedalha(b.dataset.medalha); if (!r) { som('erro'); return; } sfx('medalha'); som('moedas'); mostrarPerfil(); desenharLobby(); }
  if (a === 'loja') { som('clique'); mostrarLoja(); }
  if (b.dataset.oferta) { const r = comprarOferta(+b.dataset.oferta); if (!r) { som('erro'); return; } if (r.cheio) { som('erro'); b.textContent = tr('Baús cheios'); return; }
    som('compra'); sfx('vitoria'); mostrarLoja(); if (tela === 'lobby') { recriarPetsLobby(); desenharLobby(); } }
  if (b.dataset.mm) { som('clique'); modoMissao = b.dataset.mm; mostrarMissoes(); }
  if (b.dataset.missao) { const [sem, i] = b.dataset.missao.split(':'), r = pegarMissao(sem === 's', +i); if (!r) { som('erro'); return; } sfx('vitoria'); som('moedas'); { const q = b.getBoundingClientRect(); setTimeout(() => voarMoedas('.lbTopo .pilula.ouro', 8, { x: q.left + q.width / 2, y: q.top + q.height / 2 }), 50); } mostrarMissoes(); if (tela === 'lobby') desenharLobby(); }
  if (b.dataset.passe) { const r = pegarNivel(+b.dataset.passe); if (!r) { som('erro'); return; } if (r.cheio) { som('erro'); b.textContent = tr('Baús cheios'); return; } sfx('vitoria'); mostrarMissoes(); if (tela === 'lobby') desenharLobby(); }
  if (a === 'config') { som('clique'); mostrarConfig(); return; }
  if (b.dataset.qual) { const q = b.dataset.qual; try { localStorage.setItem('guilda_q', q); } catch (e) {} if (q === 'baixa') C.modoLeve(); som('clique'); mostrarConfig(q !== 'baixa' && q !== C.qualidadeAtual()); return; }
  if (a === 'idioma') { som('clique'); const j = $('#janela'); j.hidden = false;
    j.innerHTML = `<div class="fimCaixa"><h2>${ico('pergaminho')}</h2><div class="idiomas" data-nt>${IDIOMAS.map(([k, n, f]) => `<button class="btn ${k === idiomaJogo() ? 'verde' : 'azul'}" data-idioma="${k}"><span class="flag">${f}</span>${n}</button>`).join('')}</div>
      <button class="fSo" data-a="fecharJanela">OK</button></div>`; }
  if (b.dataset.idioma) { som('clique'); mudarIdioma(b.dataset.idioma); if ($('#janela .jConfig')) mostrarConfig(); else $('#janela').hidden = true; desenharLobby(); }
  if (a === 'online') { som('clique'); mostrarOnline('rank'); }
  if (b.dataset.rk || b.dataset.cla || b.dataset.claPedir || b.dataset.cm || b.dataset.pedir || b.dataset.doar || ['trocarNome', 'salvarNome', 'voltarOnline', 'claCriar', 'claSair', 'chatEnviar', 'chatPedirAbrir'].includes(a) || b.dataset.trVer || b.dataset.trad) cliqueOnline(b);
  if (a === 'dupla') { som('confirma'); procurarDupla(); }
  if (a === 'revanche') pedirRevanche();
  if (a === 'sairDupla') { som('fechar'); G?.dupla?.canal?.enviar('sair', {}); abrirLobby(); }
  if (a === 'cancelarDupla') { som('fechar'); pararBusca(); $('#janela').hidden = true; }
  if (a === 'fecharJanela') { som('fechar'); $('#janela').hidden = true; if (tela === 'lobby') desenharLobby(); }
  if (a === 'pegarDiario') { const D = DIARIO[diaDoPresente()];
    if (D.bau) mostrarBau(D.bau, 'Presente do dia!', () => pegarDiario());
    else { const p = pegarDiario(); if (p) { sfx('vitoria'); mostrarDiario(); $('#janela .jDiario h2').insertAdjacentHTML('afterend', `<div class="premio grande">${ico('ouro')}<b>+${fmt(p.moedas)}</b></div>`); } } }
  if (b.dataset.bonus) escolherBonus(b.dataset.bonus);
  if (b.dataset.heroi) { const k = b.dataset.heroi, H = HEROIS[k];
    if (!S.herois.includes(k)) { if (S.moedas < H.preco) { som('erro'); return; } S.moedas -= H.preco; S.herois.push(k); sfx('vitoria'); }
    else som('clique');
    S.heroi = k; salvar(); if (G && tela === 'lobby') { G.heroiV?.remover(); G.heroiV = null; iniciarFase(S.fase); } desenharLobby(); return; }
  if (b.dataset.tropa) { const k = b.dataset.tropa; if (!S.pd[k].nv) { som('erro'); return; }
    S.deck = S.deck.includes(k) ? S.deck.filter(x => x !== k) : [...S.deck, k].slice(-2); salvar(); som('clique'); desenharLobby(); }
  if (b.dataset.bau) { const i = +b.dataset.bau, tipo = S.baus[i]?.tipo; if (tipo) { som('clique'); mostrarBau(tipo, BAUS[tipo].nome, () => { const p = abrirBau(i); if (p) evento('baus'); return p; }); } }
  if (b.dataset.vaga) tocarVaga(+b.dataset.vaga);
  if (b.dataset.cq) CQ.clique(b);
  if (b.dataset.ct || b.dataset.magia) CT.clique(b);
  if (a === 'conquista') { som('confirma'); abrirConquista(); }
  if (a === 'castelo') { if (S.melhor < 3) { som('erro'); return; } som('confirma'); abrirCastelo(); }
  if (b.dataset.ovo) abrirOvo(b.dataset.ovo);
  if (b.dataset.pet) { som('clique'); mostrarPet(b.dataset.pet); }
  if (b.dataset.petA) acaoPet(b.dataset.petA, b.dataset.k);
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
  G.ouro -= c; v.tipo = tipo; v.nv++; G.menuVaga = null; if (G.tut) G.tut.torre = true;
  if (v.o) cena.remove(v.o);
  v.o = C.objeto(T.modelo, T.esc * (1 + 0.12 * (v.nv - 1))); v.o.position.set(v.x, 0, v.z); v.o.rotation.y = Math.PI; v.o.traverse(o => { if (o.isMesh) o.castShadow = true; });
  C.faiscas(v.x, 3, v.z, 0xffd84a, 30, 6); som('compra'); G.txt.push({ x: v.x, y: 6, z: v.z, txt: v.nv > 1 ? `Nível ${v.nv}!` : T.nome + '!', cor: '#ffd84a', t: 0, grande: true });
  atualizarVagas(); return true;
}
function comecarFase(inf = false, dupla = null) {
  roleta = null;
  if (inf) iniciarFase(1, true); else if (dupla) iniciarFase(dupla.fase, false, true); else if (!G || G.inf || G.dupla || G.n !== S.fase || G.t > 0 || G.assinatura !== assinaturaPets()) iniciarFase(S.fase);
  if (dupla) { // chefe mais forte; o herói do parceiro aparece do outro lado
    const hr = dupla.hr || (dupla.bot ? Object.keys(HEROIS)[Math.floor(Math.random() * 6)] : 'selene');
    const v = C.heroi(HEROIS[hr].visual); v.raiz.scale.setScalar(2.4); v.raiz.rotation.y = Math.PI; v.raiz.position.set(6, 0, ZH + 0.5); v.tocar('Idle_A'); dupla = { ...dupla, hr };
    G.dupla = { ...dupla, v, x: 6, alvo: 6, dano: 0, meuDano: 0, danoEnviado: 0, reforco: 0, tEnvio: 0, tDano: 0, tRef: 0, tTiro: 1, tBot: 0, danoBot: 0, visto: 0 };
    G.chefe.hp = G.chefe.max = Math.round(G.chefe.max * 1.7); }
  tela = 'jogo'; $('#lobby').hidden = true; $('#fim').hidden = true; $('#jogo').hidden = false; $('#jDica').hidden = false;
  $('#jN').textContent = G.inf ? '∞ · 1' : G.n; $('#jChefeN').textContent = G.chefe.nome; tema((G.n - 1) % 8);
  { const P = G.heroiDef.poder, bt = document.querySelector('[data-pd=chuva]'); if (bt) bt.innerHTML = `${ico(P.icone)}<small>${P.nome}</small>`; }
  if (G.inf) faixa('PONTE SEM FIM!', '#c88aff');
  G.tut = !S.tut && !(S.melhor > 0) && !G.inf && !G.dupla && G.n === 1 ? { passo: 0, t: 0, x0: G.heroi.x, pilhas: 0 } : null; if (G.tut) $('#jDica').hidden = true;
  if (G.evento) { const E = EVENTOS[G.evento]; setTimeout(() => { if (G?.evento && !G.fim) faixa(E.nome.toUpperCase() + '!', E.cor); }, 1800); if (G.evento === 'furia') intensidade(2); }
  $('.jPoderes').hidden = !!G.corrida;

  if (G.dupla) faixa(`EM DUPLA COM ${G.dupla.apelido.toUpperCase()}!`, '#8ae0ff');
  const em = $('#jEmojis'); if (em) em.hidden = !G.dupla || G.dupla.bot;
  else { const g0 = G; ON.ajudaAuto(G.n).then(r => { if (G !== g0 || !r) return; setTimeout(() => { if (G !== g0 || G.fim) return; G.fila = Math.min(maxFila(), G.fila + r.soldados);
      faixa(`${r.apelido.toUpperCase()}${r.cla ? ' (CLÃ)' : ''} VEIO AJUDAR! +${r.soldados}`, '#8ae0ff'); sfx('brilho'); }, 5000); }).catch(() => {}); }
  $('#jDica').textContent = G.rotas > 1 ? 'Duas rotas! Seus soldados vão pelo lado do herói' : 'Arraste para mover · toque nas vagas para construir torres';
  if (G.rotas > 1) faixa('DUAS ROTAS!', '#ffd84a');
  if (G.corrida) { faixa('CORRIDA! ARRASTE PARA ESCOLHER', '#ffd84a'); $('#jDica').textContent = 'Arraste: atire nos barris, escolha portões, fuja das serras'; }
}
// ---- tutorial da primeira partida: balão com dica + mãozinha apontando ----
const PASSOS_TUT = [
  { txt: 'Arraste o dedo para mover o herói', ok: T => Math.abs(G.heroi.x - T.x0) > 6, alvo: () => ({ arrasta: true }) },
  { txt: 'As flechas saem sozinhas: acerte as pilhas +N para ganhar soldados', ok: T => T.pilhas >= 2, alvo: () => { const b = G.pistas.flat().sort((a, c) => c.z - a.z)[0]; return b && C.tela(b.mesh.position.x, 3, b.z); } },
  { txt: 'Seus soldados (azul) marcham sozinhos contra os orcs (vermelho)', ok: T => T.t > 4, alvo: () => G.az[0] && C.tela(G.az[0].x, 2, G.az[0].z) },
  { txt: 'Orcs derrotados dão ouro: toque no + para construir uma torre', ok: T => T.torre || T.t > 12, alvo: () => { const e = document.querySelector('.vaga.pode') || document.querySelector('.vaga'); if (!e || e.style.display === 'none') return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, quando: () => G.ouro >= 25 },
  { txt: 'Use o poder do herói quando estiver pronto!', ok: T => T.poder || T.t > 10, alvo: () => { const r = document.querySelector('[data-pd=chuva]')?.getBoundingClientRect(); return r && [r.left + r.width / 2, r.top + r.height / 2]; }, quando: () => G.pd.chuva.cd <= 0 },
  { txt: 'Derrote o chefe no fim da ponte antes que ele derrube sua muralha!', ok: T => T.t > 5, alvo: () => C.tela(0, 8, G.chefe.z) },
];
function passoTutorial(dt) {
  const T = G?.tut, el = $('#tut'); if (!T || G.fim) { if (el) el.hidden = true; return; }
  const P = PASSOS_TUT[T.passo]; if (!P) { G.tut = null; S.tut = true; salvar(); el.hidden = true; return; }
  if (P.quando && !P.quando()) { el.hidden = true; return; }
  T.t += dt; el.hidden = false;
  if (el.dataset.passo !== String(T.passo)) { el.dataset.passo = T.passo; el.querySelector('.tutBalao').textContent = tr(P.txt); el.querySelector('.tutBalao').classList.remove('entra'); void el.offsetWidth; el.querySelector('.tutBalao').classList.add('entra'); }
  const a = P.alvo(), mao = el.querySelector('.tutMao');
  if (a?.arrasta) { mao.hidden = false; mao.className = 'tutMao arrasta'; mao.style.left = innerWidth / 2 + 'px'; mao.style.top = innerHeight * 0.8 + 'px'; }
  else if (a) { mao.hidden = false; mao.className = 'tutMao'; mao.style.left = a[0] + 'px'; mao.style.top = a[1] + 'px'; } else mao.hidden = true;
  if (P.ok(T)) { T.passo++; T.t = 0; sfx('brilho'); }
}
const ROLETA = [2, 3, 5, 3, 2];
let roleta = null;
function pararRoleta() {
  if (!roleta || roleta.parada) return; roleta.parada = true; const extra = roleta.ganho * (roleta.m - 1);
  S.moedas += extra; salvar(); sfx('vitoria'); contarAte($('#fGanho'), roleta.ganho * roleta.m, 800, '+', fmt, roleta.ganho); if (roleta.m > 1) { voarMoedas('#fGanho', 6 + 2 * roleta.m); flashTela('#ffd23a', 0.35); } $('#fGanho').parentElement.classList.add('pulo');
  $('#fBotoes').hidden = true; $('#fSeguir').hidden = false;
}
function terminarInf() {
  G.fim = 'd'; tela = 'fim'; const pts = pontosInf(), novo = pts > (S.recInf || 0), ganho = Math.floor(pts / 40);
  if (novo) S.recInf = pts; S.moedas += ganho; const bau = G.chefesMortos > 0 ? ganharBau(G.n) : null; salvar();
  evento('orcs', G.mortesVm); evento('chefes', G.chefesMortos); evento('infinito');
  setTimeout(() => {
    $('#jogo').hidden = true; const f = $('#fim'); f.hidden = false;
    f.innerHTML = `<div class="fimCaixa ${novo ? 'vit' : 'der'}"><h2>${novo ? 'NOVO RECORDE!' : 'Fim da linha!'}</h2>
      <p>${G.chefesMortos} chefe${G.chefesMortos === 1 ? '' : 's'} · ${fmt(G.mortesVm)} orcs derrotados</p>
      <div class="ganho">${ico('estrela')}<b>${fmt(pts)}</b></div><p>Recorde: ${fmt(S.recInf || 0)}</p><p id="fPos" class="pos">${ON.conta()?.codigo ? 'Enviando para o ranking...' : '<button class="fSo" data-a="online">Entre no online para aparecer no ranking</button>'}</p>
      <div class="ganho">${ico('ouro')}<b>+${fmt(ganho)}</b></div>
      ${bau ? `<div class="fBau">${bauHtml(bau, 'mini')}<b>${BAUS[bau].nome}!</b></div>` : ''}
      <button class="btn roxo grande" data-a="denovoInf">∞ Jogar de novo</button><div class="fLinha"><button class="btn azul" data-a="lobbyUp">${ico('raio')} Melhorias</button><button class="btn cinza" data-a="lobby">${ico('guilda')} Menu</button></div></div>`;
    sfx(novo ? 'vitoria' : 'derrota');
    if (ON.conta()?.codigo) ON.enviarRecorde(S.recInf || pts, G.chefesMortos).then(pos => { const e = $('#fPos'); if (e) e.textContent = `Você está em #${pos} no ranking mundial!`; })
      .catch(() => { const e = $('#fPos'); if (e) e.textContent = 'Sem conexão: o recorde vai na próxima.'; });
  }, 1200);
}
function danoNoCla() { const d = G.danoTotal || 0; if (d > 0 && S.online?.codigo) ON.claDano(d).then(r => { if (r?.caiu) setTimeout(coletarPremios, 500); }).catch(() => {}); }
function terminar(venceu) {
  if (G.fim) return; danoNoCla(); fimDupla(venceu); if (G.inf) return terminarInf(); G.fim = venceu ? 'v' : 'd'; tela = 'fim';
  const ganho = Math.round((venceu ? G.F.moedas + Math.floor(G.az.length / 4) : G.F.moedas * 0.25) * (G.dupla ? 1.5 : 1) * (1 + ((bonusEquipe().moedas || 0) + bonusRenasc(S.renasc || 0).moedas) / 100) * (G.multMoedas || 1) * (fimDeSemana() ? 2 : 1));
  S.moedas += ganho; evento('orcs', G.mortesVm); if (venceu) { evento('fases'); evento('chefes'); } let bau = null; if (venceu) { bau = ganharBau(G.n); if (!G.dupla || G.n === S.fase) S.fase++; S.melhor = Math.max(S.melhor, G.n); } salvar();
  setTimeout(() => {
    $('#jogo').hidden = true; const f = $('#fim'); f.hidden = false;
    f.innerHTML = `<div class="fimCaixa ${venceu ? 'vit' : 'der'}"><h2>${venceu ? 'VITÓRIA!' : 'A muralha caiu!'}</h2>
      <p>${venceu ? `${G.chefe.nome} foi derrotado!` : 'Melhore o exército e tente de novo.'}${G.dupla ? ` <b>Em dupla com ${esc(G.dupla.apelido)}: +50% moedas</b>` : ''}</p>
      <div class="ganho">${ico('ouro')}<b id="fGanho">+${fmt(ganho)}</b></div>
      ${venceu ? `<div class="fBau">${bau ? `${bauHtml(bau, 'mini')}<b>${BAUS[bau].nome}!</b>` : `<small>Espaços de baú cheios: abra seus baús!</small>`}</div>` : ''}
      ${G.dupla && !G.dupla.bot ? placarDupla() : ''}
      ${G.dupla ? `<div id="fDupla"><button class="btn verde grande" data-a="revanche">${ico('herois')} Jogar de novo com ${esc(G.dupla.apelido)}</button><p id="rvTxt" class="pos"></p>
        <button class="btn azul" data-a="sairDupla">Sair</button></div>` : venceu ? `<div class="roleta">${ROLETA.map(m => `<span class="m${m}">x${m}</span>`).join('')}<i id="rAgulha"></i></div>
      <div id="fBotoes"><button class="btn amarelo grande" data-a="roleta">${ico('ouro')} Pegar <b id="rMult">x2</b></button>
      <button class="fSo" data-a="proxima">Só +${fmt(ganho)}, próxima fase</button></div>` : ''}
      <div id="fSeguir" ${venceu || G.dupla ? 'hidden' : ''}><button class="btn verde grande" data-a="proxima">${venceu ? `Fase ${S.fase} ${ico('seta')}` : 'Tentar de novo'}</button>
      <div class="fLinha"><button class="btn azul" data-a="lobbyUp">${ico('raio')} Melhorias</button><button class="btn cinza" data-a="lobby">${ico('guilda')} Menu</button></div></div></div>`;
    sfx(venceu ? 'vitoria' : 'derrota');
    if (venceu) { flashTela('#ffe27a', 0.5); contarAte($('#fGanho'), ganho, 900, '+', fmt); setTimeout(() => voarMoedas('#fGanho', 12), 150); }
    atualizarRevanche();
    if (venceu && !G.dupla) { roleta = { ganho, t0: performance.now(), m: 2 }; const gira = () => { if (!roleta || roleta.parada) return;
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
  if (tela === 'conq' || tela === 'castelo') { // Conquista (pets lutam sozinhos) e Castelo (defesa da muralha)
    const M = tela === 'conq' ? CQ : CT; if (tela === 'conq') { CQ.passo(dt0); passoVoo(dt0); } else CT.passo(dt0); const V = M.vista(); foco.x = V.foco.x; foco.z = V.foco.z;
    C.camera.yaw = V.yaw; C.camera.pitch = V.pitch; C.camera.dist = V.dist; C.camera.altura = 0; C.camera.suave = 2.5;
    if (texAgua) texAgua.offset.y += dt0 * 0.03;
    if (window.__ov) { Object.assign(C.camera, window.__ov.cam); Object.assign(foco, window.__ov.foco); }
    C.quadro(dt0, foco); gfx.clearRect(0, 0, innerWidth, innerHeight); M.desenharFx(gfx, dt0); return;
  }
  if (G) {
    G.heroiV.mixer.update(dt); passoPetsHeroi(dt, tela === 'jogo' && !G.fim && !G.pausa && !G.corrida);
    if (tela === 'jogo' && !G.fim && !G.pausa) passoJogo(dt);
    else if (G.fim === 'v') { G.chefe.v.mixer.update(dt); }
    else G.chefe.v.mixer.update(dt);
    // desenha os exércitos
    desenharTropas('az', G.az, Math.PI, t); desenharTropas('vm', G.vm, 0, t); passoVoo(dt);
    // pilhas deslizam para a frente da pista
    for (const p of G.pistas) p.forEach((b, i) => { const zAlvo = ZLANE - 2 - i * PASSO; b.z += (zAlvo - b.z) * Math.min(1, dt * 5); b.mesh.position.z = b.z; });
    const ch = G.chefe; ch.flash = Math.max(0, ch.flash - dt);
    { const f = ch.flash > 0 ? 0.45 : 0, r = ch.furia ? 0.28 + 0.12 * Math.sin(t * 9) : 0; for (const m of ch.mats) m.emissive.setRGB(f + r, f, f); }
    ch.esc += ((ch.furia ? 6 : 5) - ch.esc) * Math.min(1, dt * 3); ch.punch = Math.max(0, (ch.punch || 0) - dt); ch.v.raiz.scale.setScalar(ch.esc * (1 + 0.07 * ch.punch / 0.14));
    G.heroiV.raiz.position.x = G.heroi.x; ch.v.raiz.position.set(0, ch.y, ch.z);
    if (G.gigante) { G.gigante.v.mixer.update(dt); G.gigante.v.raiz.position.set(G.gigante.x, 0, G.gigante.z); }
    G.brilhoH = Math.max(0, G.brilhoH - dt); G.heroiV.brilho(G.brilhoH > 0 ? 0.5 * G.brilhoH : 0);
    for (const p of G.portoes) { p.pulso = Math.max(0, p.pulso - dt * 4); p.painel.scale.setScalar(1 + p.pulso * 0.12); }
    G.punch = Math.max(0, G.punch - dt * 3);
    if (G.comboT > 0 && (G.comboT -= dt) <= 0) G.combo = 0;
  }
  if (texAgua) texAgua.offset.y += dt0 * (biomaAtual === 3 ? 0.015 : biomaAtual === 2 ? 0.02 : 0.05);
  const final = G && G.fim === 'v', corre = G?.corrida && tela !== 'lobby';
  foco.x = final ? 0 : (G ? G.heroi.x : 0) * 0.25; foco.z = final ? G.chefe.z + 14 : -42;
  if (corre && !final) { foco.x = G.heroi.x * 0.3; foco.z = G.corrida.cz - 22; G.heroiV.raiz.position.z = G.corrida.cz; }
  const lobby = tela === 'lobby';
  if (lobby) { foco.x = Math.sin(t * 0.25) * 2; foco.z = -34; }
  distCam += ((final ? 62 : corre ? 82 : 106) - distCam) * Math.min(1, dt0 * 2);
  C.camera.yaw = Math.PI; C.camera.pitch = lobby ? 0.5 : 0.9; C.camera.dist = lobby ? 52 : distCam - (G ? G.punch * 7 : 0); C.camera.altura = lobby ? 2 : 0; C.camera.suave = final ? 2.5 : 4;
  if (G && tela === 'jogo') { posicionarVagas(); passoTutorial(dt0); }
  if (window.__ov) { Object.assign(C.camera, window.__ov.cam); Object.assign(foco, window.__ov.foco); } // para testes
  C.quadro(dt, foco);
  desenharFx(dt);
}
function posicionarVagas() {
  for (const v of G.vagas) { const b = document.querySelector(`[data-vaga="${v.i}"]`), p = C.tela(v.x, v.tipo ? 7 : 1.5, v.z); if (!b) continue;
    const ver = p && p[1] > 100 && p[1] < innerHeight - 60; b.style.display = ver ? '' : 'none'; if (ver) { b.style.left = p[0] + 'px'; b.style.top = p[1] + 'px'; } }
  if (G.menuVaga != null) { const v = G.vagas[G.menuVaga], p = C.tela(v.x, 3, v.z), m = $('#jMenuT');
    if (p) { m.style.left = Math.max(92, Math.min(innerWidth - 92, p[0])) + 'px'; m.style.top = Math.max(200, p[1] - 26) + 'px'; } }
}
function limparVm() { let n = 0; G.vm = G.vm.filter(v => { if (!v.morto) return true; if (!v.muro) { n++;
    if (G.reviver && Math.random() < G.reviver && G.az.length < MAXU) { G.az.push(novoAzul(v.x, v.z, v.x)); if (Math.random() < 0.2) C.faiscas(v.x, 1.5, v.z, 0x9aff9a, 6, 3); } } return false; }); G.ouro += n; }
function passoJogo(dt) {
  if (G.corrida) return passoCorrida(dt);
  if (G.espera > 0) { G.espera -= dt; if (G.espera <= 0) { G.espera = 0; faixa('VALENDO!', '#7aff8a'); } passoDupla(dt); return; }
  G.t += dt; const h = G.heroi, ch = G.chefe;
  // herói anda e atira
  h.x += (h.alvo - h.x) * Math.min(1, dt * 14);
  G.cd -= dt; G.tonto = Math.max(0, G.tonto - dt);
  if (G.cd <= 0 && G.tonto <= 0) {
    const D = G.heroiDef, A = D.ataque; G.cd = 1 / G.tiro; G.heroiV.tocar(G.heroiV.tem(D.tiro) ? D.tiro : 'Ranged_Bow_Release', { loop: false, reinicia: true, vel: Math.max(1.2, G.tiro * 0.6) });
    for (let k = 0; k < G.nFlechas; k++) { const x = h.x + (k - (G.nFlechas - 1) / 2) * 1.1, o = projetilHeroi(A.proj, A.cor); o.position.set(x, 2.6, ZH - 1); cena.add(o);
      G.flechas.push({ x, z: ZH - 1, o, dano: A.dano, perf: A.perf + G.perfura, area: A.area, proj: A.proj }); }
    if (Math.random() < 0.5) sfx(A.proj === 'orbe' || A.proj === 'fogo' ? 'magia' : 'arco');
  }
  passoDupla(dt);
  // ponte sem fim: as pistas se renovam
  if (G.inf) G.pistas.forEach((p, k) => { if (p.length >= 6) return; const F = dadosFase(G.n + Math.floor(Math.random() * 3)), l = k ? F.dir : F.esq;
      for (let i = 0; i < 10; i++) novoBloco(blocoInf(l[i + 8], k), k, (p.length ? p[p.length - 1].z : ZLANE) - PASSO - 6, F.duro + G.chefesMortos); });
  // hora de escolher um bônus
  if (G.t >= G.proxEscolha && !ch.pulo) { G.proxEscolha = G.t + 22 + 4 * G.escolhas; abrirEscolha(); }
  // evento: meteoros caem na ponte e acertam azuis e vermelhos
  if (G.evento === 'meteoros' && G.t > 6 && (G.metT -= dt) <= 0) { G.metT = Math.max(2.6, 5 - 0.05 * G.n);
    const x = (Math.random() * 2 - 1) * (MEIA - 4), z = ZSPAWN - 8 - Math.random() * Math.max(10, ZSPAWN - 8 - (ch.z + 20)), o = new THREE.Mesh(GEO_METEORO, MAT_METEORO);
    o.scale.setScalar(0.55); o.position.set(x + 20, 70, z - 30); cena.add(o); G.meteoros.push({ o, x, z, t: 0, dur: 1.6, av: C.aviso(x, z, 4.5, 1.6, 0xff6a1a) }); }
  for (const m of G.meteoros) { m.t += dt; const k = Math.min(1, m.t / m.dur); m.o.position.set(m.x + 20 * (1 - k), 70 * (1 - k) + 1, m.z - 30 * (1 - k)); m.o.rotation.x += dt * 5;
    if (Math.random() < 0.6) C.faiscas(m.o.position.x, m.o.position.y, m.o.position.z, 0xff8a2a, 2, 1);
    if (k >= 1) { m.fim = true; cena.remove(m.o); C.faiscas(m.x, 1, m.z, 0xff6a1a, 50, 10); C.onda(m.x, m.z, 6, 0xff8a3a, 0.5); C.camera.tremor = Math.max(C.camera.tremor, 0.6); som('pancada', 0.6);
      let na = 0, nv = 0; for (const a of G.az) if (!a.morto && Math.hypot(a.x - m.x, a.z - m.z) < 4.5) { a.morto = true; na++; arremessar(a.tipo, a, m.x, m.z, 14); }
      for (const v of G.vm) if (!v.morto && Math.hypot(v.x - m.x, v.z - m.z) < 4.5) { v.morto = true; nv++; G.mortesVm++; arremessar('vm', v, m.x, m.z, 14); }
      G.az = G.az.filter(a => !a.morto); if (nv) G.txt.push({ x: m.x, y: 5, z: m.z, txt: `${nv}!`, cor: '#ff8a3a', t: 0, grande: true }); } }
  G.meteoros = G.meteoros.filter(m => !m.fim);
  // o chefe joga pedras no herói: um círculo avisa onde cai, arraste para desviar
  if (G.t > 8 && (G.pedraT -= dt) <= 0) { G.pedraT = Math.max(3.5, 8 - 0.25 * G.n) * (ch.furia ? 0.65 : 1);
    const x = Math.max(-MEIA + 3, Math.min(MEIA - 3, h.x + (Math.random() - 0.5) * 4)), dur = 1.4;
    const o = new THREE.Mesh(GEO_PEDRA, MAT_PEDRA_T); o.scale.setScalar(2.6); o.position.set(0, 8, ch.z + 4); cena.add(o);
    G.pedras.push({ o, x, t: 0, dur, z0: ch.z + 4, av: C.aviso(x, ZH, 3.6, dur, 0xff3322) }); ch.v.tocar('Attack2', { loop: false, reinicia: true }); }
  for (const pd of G.pedras) { pd.t += dt; const k = Math.min(1, pd.t / pd.dur); pd.o.position.set(pd.x * k, 8 + Math.sin(Math.PI * k) * 26 - 6 * k, pd.z0 + (ZH - pd.z0) * k); pd.o.rotation.x += dt * 6;
    if (k >= 1) { pd.fim = true; cena.remove(pd.o); C.faiscas(pd.x, 1, ZH, 0xc8a878, 40, 8); C.camera.tremor = Math.max(C.camera.tremor, 0.5); som('pancada', 0.6);
      if (Math.abs(h.x - pd.x) < 3.6) { G.tonto = 1.6; G.muro--; G.heroiV.tocar('Hit_A', { loop: false, reinicia: true }); faixa('ATORDOADO!', '#ff9a3a'); C.faiscas(h.x, 5, ZH, 0xffff6a, 20, 4); }
      else G.txt.push({ x: h.x, y: 6, z: ZH, txt: 'Desviou!', cor: '#8aff8a', t: 0 }); } }
  G.pedras = G.pedras.filter(p => !p.fim);
  if (G.autoChuva && G.pd.chuva.cd <= 0 && G.vm.length > 8) usarPoder('chuva');
  // vermelhos saem do portão do chefe
  G.ondaT -= dt;
  const ritmo = G.F.ritmo * (1 + G.t / (G.inf ? 65 : 45)) * (G.inf ? 1 + 0.15 * G.chefesMortos : 1);
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
  for (const v of G.vm) { if (v.luta && (v.luta.morto || v.luta.luta !== v)) v.luta = null; if (!v.luta) { v.z += VEL_VM * (v.vel || 1) * G.velVm * (G.medoT > 0 ? 0.35 : 1) * dt; v.x += (v.ax - v.x) * Math.min(1, dt * 2); } }
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
  for (const v of G.vm) if (!v.morto && v.z >= ZMURO - 1.2) { v.morto = true; v.muro = true; if (G.invT > 0) { G.mortesVm++; C.faiscas(v.x, 1.5, v.z, 0xffe27a, 6, 3); continue; } G.muro--; C.faiscas(v.x, 1.5, v.z, 0xff5a3a, 10, 4); C.camera.tremor = Math.max(C.camera.tremor, 0.25); som('pancada', 0.3); }
  // torres
  for (const v of G.vagas) {
    if (!v.tipo || (v.cd -= dt) > 0) continue; const T = TORRES[v.tipo];
    let alvo = null, za = -1e9; for (const u of G.vm) if (!u.morto && u.z > za && Math.hypot(u.x - v.x, u.z - v.z) < T.alcance) { za = u.z; alvo = u; }
    const noChefe = !alvo && Math.hypot(v.x, ch.z + 3 - v.z) < T.alcance + 6; if (!alvo && !noChefe) continue;
    v.cd = T.cad[v.nv - 1]; const tx = alvo ? alvo.x : 0, tz = alvo ? alvo.z : ch.z + 3;
    v.o.rotation.y = Math.atan2(tx - v.x, tz - v.z) + Math.PI;
    const o = new THREE.Mesh(v.tipo === 'balista' ? GEO_FLECHA : GEO_PEDRA, v.tipo === 'balista' ? MAT_FLECHA : MAT_PEDRA_T); o.position.set(v.x, 2.5, v.z); cena.add(o);
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
    if (f.morta) continue; f.z -= (f.proj === 'orbe' ? 70 : 95) * dt; f.o.position.z = f.z; if (f.proj === 'adaga') f.o.rotation.x += dt * 25;
    const ax = Math.abs(f.x);
    if (f.z < ZLANE && ax > DIV - 0.9 && ax < DIV + 0.9) { f.morta = true; continue; } // bateu na divisória
    if (f.parc && (ax >= DIV + 0.9 || f.z <= ch.z + 3)) { if (f.z < ZLANE || f.z <= ch.z + 3) f.morta = true; continue; }
    if (ax >= DIV + 0.9) { // pista lateral: acerta a primeira pilha
      const p = G.pistas[f.x < 0 ? 0 : 1], b = p[0];
      if (b && f.z <= b.z + 2) { f.morta = true; acertarBloco(b, p, f.x < 0 ? -1 : 1, f.dano || 1); }
      else if (f.z < ZBOSS) f.morta = true;
    } else { // pista do meio: vermelhos e depois o chefe
      const k = Math.floor(f.z / K); let alvo = null;
      for (let d = 0; d <= 1 && !alvo; d++) for (const v of grade.get(k + d) || []) if (!v.morto && Math.abs(v.x - f.x) < 1.3 && Math.abs(v.z - f.z) < 1.8) { alvo = v; break; }
      if (alvo && f.area) { let n = 0; for (const v of G.vm) if (!v.morto && Math.hypot(v.x - alvo.x, v.z - alvo.z) < f.area) { v.morto = true; G.mortesVm++; n++; if (v !== alvo) voar('vm', v.x, v.z, (v.x - alvo.x) * 3, 6, -3); }
        C.faiscas(alvo.x, 1.4, alvo.z, f.o.material.color.getHex(), 8, 4); }
      if (alvo) { alvo.morto = true; G.mortesVm++; if ((f.perf = (f.perf ?? 0) - 1) < 0) f.morta = true; voar('vm', alvo.x, alvo.z, (Math.random() - 0.5) * 3, 5, -6); C.faiscas(alvo.x, 1.4, alvo.z, 0xff6a4a, 6, 3); }
      else if (f.z <= ch.z + 3) { f.morta = true; ferirChefe(f.dano || 1, f.x, ch.z + 3); }
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
  if (G.t > 6 && !ch.pulo && !ch.inv) ch.z = Math.min(ZMURO - 7, ch.z + (0.45 + 0.02 * G.n) * (ch.furia ? 1.6 : 1) * dt);
  // com metade da vida ele fica furioso: cresce, fica vermelho, chama uma onda e começa a pular
  if (!ch.furia && ch.hp < ch.max / 2) { ch.furia = true; G.puloT = 4; G.spawnVm += Math.round(ritmo * 6); faixa(`${ch.nome.toUpperCase()} FICOU FURIOSO!`, '#ff4a3a'); intensidade(2);
    ch.v.tocar('Attack2', { loop: false, reinicia: true }); C.camera.tremor = 1; som('pancada'); }
  if (ch.furia || ch.hab === 'salto') {
    if (ch.furia && Math.random() < dt * 4) C.faiscas((Math.random() - 0.5) * 6, 4 + Math.random() * 6, ch.z, 0xff4a2a, 3, 2);
    G.puloT -= dt;
    if (G.puloT <= 0 && !ch.pulo && G.t > 8 && !seguidor()) { G.puloT = ch.hab === 'salto' ? (ch.furia ? 7 : 10) : 11; const z1 = Math.min(ch.z + 10, ZMURO - 8); ch.pulo = { t: 0, z0: ch.z, z1 }; C.aviso(0, z1 + 4, 11, 0.9, 0xff3322); faixa('CUIDADO: SALTO!', '#ff9a3a');
      if (G.dupla?.host) G.dupla.canal?.enviar('pulo', { z1 }); }
    if (ch.pulo) { const P = ch.pulo; P.t += dt; const k = Math.min(1, P.t / 0.9); ch.z = P.z0 + (P.z1 - P.z0) * k; ch.y = Math.sin(Math.PI * k) * 9;
      if (k >= 1) { ch.pulo = null; ch.y = 0; const zc = ch.z + 4; C.onda(0, zc, 13, 0xff7a2a, 0.6); C.faiscas(0, 1, zc, 0xc8a878, 70, 10); C.camera.tremor = 1.2; G.punch = 1; som('pancada');
        for (const a of G.az) if (Math.hypot(a.x, a.z - zc) < 11) { a.morto = true; arremessar(a.tipo, a, 0, zc, 16); } G.az = G.az.filter(a => !a.morto); if (G.gigante && Math.abs(G.gigante.z - zc) < 12) G.gigante.hp -= 30; } }
  }
  passoHabilidade(dt);
  // poderes: recarga, chuva de flechas caindo e o gigante
  for (const [k, P] of Object.entries(G.pd)) { P.cd = Math.max(0, P.cd - dt); const b = document.querySelector(`[data-pd=${k}]`); if (b) { b.style.setProperty('--h', `${100 * P.cd / P.max}%`); b.classList.toggle('pronto', P.cd <= 0); } }
  for (const c of G.chuvas) {
    c.t += dt; for (const f of c.fl) { f.o.position.y = Math.max(0.5, f.y0 - 55 * Math.max(0, c.t - f.atraso)); }
    if (c.tipo) { const k = Math.min(1, c.t / 0.75);
      if (c.tipo === 'barril') { c.o.position.set(c.x0 * (1 - k), 3 + Math.sin(Math.PI * k) * 14, ZH + (c.z - ZH) * k); c.o.rotation.x += dt * 9; }
      if (c.tipo === 'meteoro') { c.o.position.set(0, 60 * (1 - k) + 2, c.z + 10 * (1 - k)); c.o.rotation.y += dt * 4; if (Math.random() < 0.5) C.faiscas(c.o.position.x, c.o.position.y, c.o.position.z, 0xffa040, 3, 2); }
      if (c.tipo === 'portal') { c.o.scale.setScalar(1 + 11 * k); c.o.rotation.y += dt * 5; } }
    if (c.t >= 0.75 && !c.feito) { c.feito = true; let n = 0;
      if (c.o && c.tipo !== 'portal') cena.remove(c.o);
      const nv = G.pd.chuva.nv, raio = c.tipo === 'barril' ? 9 + 0.6 * (nv - 1) : c.tipo === 'portal' ? 11 + 0.6 * (nv - 1) : c.tipo === 'meteoro' ? 9 : 7.5 + 0.5 * (nv - 1);
      const fc = c.parc ? () => {} : ferirChefe;
      if (c.tipo === 'meteoro') { fc(Math.round(ch.max * (0.08 + 0.01 * (nv - 1))), 0, ch.z + 3, true); C.faiscas(0, 2, c.z, 0xff6a1a, 90, 12); C.camera.tremor = 1.2; G.punch = 1; som('pancada'); }
      if (c.tipo === 'barril') { C.faiscas(0, 2, c.z, 0xff9a3a, 70, 11); C.faiscas(0, 2, c.z, 0x6a5a4a, 30, 6); som('pancada'); }
      if (c.tipo === 'portal') C.faiscas(0, 1, c.z, 0xb04aff, 60, 8);
      for (const v of G.vm) if (Math.hypot(v.x, v.z - c.z) < raio) { v.morto = true; n++; arremessar('vm', v, 0, c.z, 9); } limparVm();
      if (c.tipo !== 'meteoro' && Math.abs(ch.z + 3 - c.z) < 9) fc(Math.round(ch.max * (0.05 + 0.008 * (G.pd.chuva.nv - 1))), 0, ch.z + 3, true);
      if (!c.tipo) C.faiscas(0, 1, c.z, 0xffd84a, 50, 8); C.camera.tremor = Math.max(C.camera.tremor, 0.5); som('pancada', 0.5);
      if (n) G.txt.push({ x: 0, y: 5, z: c.z, txt: `${n} derrotados!`, cor: '#ffd84a', t: 0, grande: true }); }
    if (c.tipo === 'portal' && c.t > 0.75) { const k = Math.max(0, 1 - (c.t - 0.75) / 0.6); c.o.scale.setScalar(12 * k + 0.01); }
    if (c.t > 1.4) { for (const f of c.fl) cena.remove(f.o); if (c.o) cena.remove(c.o); c.fim = true; }
  }
  G.chuvas = G.chuvas.filter(c => !c.fim);
  // tornados de lâminas: sobem a pista derrubando orcs e batem no chefe
  for (const tn of G.tornados) {
    tn.z -= 26 * dt; tn.o.position.z = tn.z; tn.o.rotation.y += dt * 14; let n = 0;
    for (const v of G.vm) if (!v.morto && Math.abs(v.z - tn.z) < 2.6 && Math.abs(v.x - tn.x) < 3.4) { v.morto = true; G.mortesVm++; n++; voar('vm', v.x, v.z, (v.x - tn.x) * 4 + (Math.random() - 0.5) * 6, 12, -2); }
    if (n) limparVm();
    if (tn.z <= ch.z + 4) { tn.fim = true; cena.remove(tn.o); ferirChefe(Math.round(ch.max * (0.04 + 0.008 * (G.pd.chuva.nv - 1))), tn.x, ch.z + 4, true); C.faiscas(tn.x, 4, ch.z + 4, 0xe8f0ff, 40, 8); }
  }
  G.tornados = G.tornados.filter(tn => !tn.fim);
  G.medoT = Math.max(0, (G.medoT || 0) - dt);
  if (G.invT > 0) { G.invT -= dt; if (G.escudoO) G.escudoO.material.opacity = 0.25 + 0.12 * Math.sin(C.tempo() * 8); if (G.invT <= 0 && G.escudoO) G.escudoO.visible = false; }
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
  else if (ch.hp <= 0) { flashTela('#fff', 0.6); ch.v.tocar('Death', { loop: false, reinicia: true }); for (const v of G.vm) arremessar('vm', v, 0, ch.z, 14); G.vm = []; C.camera.tremor = 1;
    G.lento = 1.6; C.faiscas(0, 6, ch.z, 0xffd84a, 120, 12); C.onda(0, ch.z, 16, 0xffd84a, 0.9); faixa('VITÓRIA!', '#ffd84a'); G.heroiV.tocar('Cheering'); terminar(true); }
  else if (ch.z >= ZMURO - 7) { G.muro = 0; C.camera.tremor = 1; faixa('O CHEFE DERRUBOU A MURALHA!', '#ff5a4a'); G.heroiV.tocar('Death_A', { loop: false, reinicia: true }); terminar(false); }
  else if (G.muro <= 0) { G.heroiV.tocar('Death_A', { loop: false, reinicia: true }); terminar(false); }
}
// joga o soldado para longe do ponto (x0, z0)
function arremessar(t, u, x0, z0, f) { const dx = u.x - x0, dz = u.z - z0, d = Math.hypot(dx, dz) || 1; voar(t, u.x, u.z, dx / d * f * 0.8, f * (0.9 + Math.random() * 0.5), dz / d * f * 0.8); }
// ---- fase Corrida (a cada 3 fases): o exército corre com o herói, atira em barris, escolhe portões, foge das serras e enfrenta o chefe ----
const GEO_BARRIL_C = new THREE.CylinderGeometry(1.5, 1.5, 2.4, 14), GEO_SERRA = new THREE.CylinderGeometry(2.2, 2.2, 0.3, 20).rotateX(Math.PI / 2), MAT_SERRA = new THREE.MeshLambertMaterial({ color: 0xb8c0c8 });
function rotuloBarril(b) {
  const g = b.cv.getContext('2d'); g.clearRect(0, 0, 160, 96); g.fillStyle = 'rgba(30,20,10,.75)'; g.beginPath(); g.roundRect(4, 4, 152, 88, 18); g.fill();
  g.font = '44px Titulo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#7aff8a'; g.fillText('+' + b.val, 80, 38);
  g.fillStyle = '#5a2a10'; g.fillRect(18, 70, 124, 12); g.fillStyle = '#ffb84a'; g.fillRect(18, 70, 124 * Math.max(0, b.hp / b.hpMax), 12); b.tex.needsUpdate = true;
}
function montarCorrida(F, n) {
  let sd = n * 131 + 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const K = G.corrida = { cz: 34, zFim: ZBOSS + 26, fase: 'corre', ev: [], objs: [], sq: 0, golpeT: 5, avisoG: 0, serraT: 0, spawn: 0 };
  const add = o => { cena.add(o); K.objs.push(o); return o; };
  const ciclo = ['portao', 'barris', 'orcs', 'portao', 'serra', 'barris', 'orcs', 'portao', 'barris', 'serra'];
  let i = 0;
  for (let z = 18; z > K.zFim + 12; z -= 12, i++) {
    const tipo = ciclo[(i + n) % ciclo.length];
    if (tipo === 'portao') {
      const bom = () => r() < 0.5 ? { op: '+', v: 10 + 4 * n + Math.round(r() * 10) } : { op: 'x', v: n >= 6 && r() < 0.3 ? 3 : 2 };
      const ruim = () => ({ op: '-', v: 4 + 2 * n + Math.round(r() * 6) });
      const a = bom(), b = r() < 0.6 ? ruim() : bom(), [esq, dir] = r() < 0.5 ? [a, b] : [b, a];
      const ev = { tipo, z, esq, dir, feito: false, paineis: [] };
      for (const [lado, P] of [[-1, esq], [1, dir]]) {
        const txt = P.op === '+' ? `+${P.v}` : P.op === 'x' ? `x${P.v}` : `-${P.v}`, cor = P.op === '-' ? ['#e8403a', '#8a1410'] : P.op === 'x' ? ['#2fa8ff', '#0f5ab0'] : ['#2fbf4a', '#13702a'];
        const pn = add(new THREE.Mesh(new THREE.PlaneGeometry(MEIA - 1.2, 3.2), new THREE.MeshBasicMaterial({ map: texRotulo(txt, cor[0], cor[1]), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })));
        pn.position.set(lado * MEIA / 2, 3.4, z); ev.paineis.push(pn); }
      for (const x of [-MEIA + 0.4, 0, MEIA - 0.4]) { const m = add(new THREE.Mesh(GEO_POSTE, MAT_POSTE)); m.position.set(x, 2.6, z); }
      K.ev.push(ev);
    } else if (tipo === 'barris') {
      for (let k = 0, nb = r() < 0.5 ? 1 : 2; k < nb; k++) {
        const x = nb === 1 ? (r() - 0.5) * 18 : (k ? 1 : -1) * (5 + r() * 6), hp = Math.round(3 + n + r() * 3);
        const b = { tipo: 'barril', x, z: z - k * 2, hp, hpMax: hp, val: Math.round(8 + 3 * n + r() * 8) };
        b.o = add(new THREE.Mesh(GEO_BARRIL_C, MAT_BARRIL)); b.o.position.set(x, 1.2, b.z); b.o.castShadow = true;
        b.cv = document.createElement('canvas'); b.cv.width = 160; b.cv.height = 96; b.tex = new THREE.CanvasTexture(b.cv); b.tex.colorSpace = THREE.SRGBColorSpace; rotuloBarril(b);
        b.rot = add(new THREE.Mesh(new THREE.PlaneGeometry(4, 2.4), new THREE.MeshBasicMaterial({ map: b.tex, transparent: true, depthWrite: false }))); b.rot.position.set(x, 4.2, b.z);
        K.ev.push(b); }
    } else if (tipo === 'orcs') {
      const cx = (r() - 0.5) * 14, nq = Math.round(4 + 1.5 * n + r() * 5);
      for (let k = 0; k < nq; k++) G.vm.push({ x: Math.max(-MEIA + 1.5, Math.min(MEIA - 1.5, cx + (r() - 0.5) * 9)), z: z - r() * 6, ph: r() * 6, ax: 0, parado: true });
    } else if (tipo === 'serra') {
      const s = { tipo: 'serra', x0: (r() - 0.5) * 6, z, amp: 9 + r() * 4, vel: 1.2 + r() * 0.8 + n * 0.03, x: 0 };
      s.o = add(new THREE.Mesh(GEO_SERRA, MAT_SERRA)); s.o.position.set(0, 2.2, z); s.o.castShadow = true; K.ev.push(s);
    }
  }
  // tropa inicial: soldados em volta do herói
  const nIni = 12 + 3 * S.up.exercito; G.fila = 0;
  for (let k = 0; k < nIni; k++) G.az.push({ x: (Math.random() - 0.5) * 6, z: K.cz + 2 + Math.random() * 4, ph: Math.random() * 6, ax: 0, tipo: 'arco', slot: k });
  G.chefe.hp = G.chefe.max = Math.round(G.chefe.max * 0.5); G.proxEscolha = 1e9; G.muro = G.muroMax = 5 + S.up.vida;
}
const MAX_TROPA = 400;
function recrutar(n, x, z) { for (let k = 0; k < n && G.az.length < MAX_TROPA; k++) G.az.push({ x: x + (Math.random() - 0.5) * 4, z: z + (Math.random() - 0.5) * 3, ph: Math.random() * 6, ax: 0, tipo: 'arco' }); }
function perderTropa(n, x0, z0) { for (let k = 0; k < n && G.az.length; k++) { const a = G.az.splice(Math.floor(Math.random() * G.az.length), 1)[0]; arremessar(a.tipo, a, x0, z0, 10); } }
function heroiFerido(d) { G.muro -= d; C.camera.tremor = Math.max(C.camera.tremor, 0.6); G.heroiV.brilho(0.6); som('pancada', 0.5); G.txt.push({ x: G.heroi.x, y: 6, z: G.corrida.cz, txt: `-${d} ❤`, cor: '#ff6a5a', t: 0, grande: true }); }
function passoCorrida(dt) {
  const K = G.corrida, h = G.heroi, ch = G.chefe; G.t += dt;
  h.x += (h.alvo - h.x) * Math.min(1, dt * 12);
  if (K.fase === 'corre') { K.cz -= 5.5 * dt; if (K.cz <= K.zFim) { K.cz = K.zFim; K.fase = 'chefe'; faixa('ENFRENTE O CHEFE!', '#ff5a4a'); ch.v.tocar('Attack2', { loop: false, reinicia: true }); } }
  // formação em girassol em volta do herói
  G.az.forEach((u, i) => { const rr = 1.15 * Math.sqrt(i + 1.6), a = i * 2.39996, tx = Math.max(-MEIA + 1, Math.min(MEIA - 1, h.x + Math.cos(a) * rr)), tz = K.cz + 0.5 + Math.sin(a) * rr * 0.8;
    u.x += (tx - u.x) * Math.min(1, dt * 6); u.z += (tz - u.z) * Math.min(1, dt * 6); u.luta = null; });
  // tiros: herói e uma rajada da tropa
  G.cd -= dt;
  if (G.cd <= 0) { const D = G.heroiDef, A = D.ataque; G.cd = 1 / G.tiro; G.heroiV.tocar(G.heroiV.tem(D.tiro) ? D.tiro : 'Ranged_Bow_Release', { loop: false, reinicia: true, vel: Math.max(1.2, G.tiro * 0.6) });
    for (let k = 0; k < G.nFlechas; k++) { const x = h.x + (k - (G.nFlechas - 1) / 2) * 1.1, o = projetilHeroi(A.proj, A.cor); o.position.set(x, 2.6, K.cz - 1); cena.add(o);
      G.flechas.push({ x, z: K.cz - 1, o, dano: A.dano, perf: A.perf, area: A.area, proj: A.proj }); }
    if (Math.random() < 0.4) sfx('arco'); }
  if ((K.sq -= dt) <= 0 && G.az.length) { K.sq = 0.22; for (let k = 0, nk = Math.min(9, Math.ceil(G.az.length / 4)); k < nk; k++) { const u = G.az[Math.floor(Math.random() * G.az.length)];
    const o = new THREE.Mesh(GEO_FLECHA, MAT_FLECHA); o.scale.setScalar(0.7); o.position.set(u.x, 2, u.z - 1); cena.add(o); G.flechas.push({ x: u.x, z: u.z - 1, o, dano: 1, perf: 0, area: 0 }); } }
  // orcs: esperam e atacam quando a tropa chega perto; no chefe eles saem do portão
  if (K.fase === 'chefe' && (K.spawn -= dt) <= 0) { K.spawn = Math.max(0.35, 1.4 - 0.05 * G.n); G.vm.push({ x: (Math.random() - 0.5) * 14, z: ch.z + 5, ph: Math.random() * 6, ax: 0 }); }
  for (const v of G.vm) { if (v.morto) continue; const dz = K.cz - v.z;
    if (!v.parado || dz < 26) { v.parado = false; v.z += 7 * dt; v.x += (h.x - v.x) * Math.min(1, dt * 0.8); }
    for (const a of G.az) if (!a.morto && Math.abs(a.z - v.z) < 1.2 && Math.abs(a.x - v.x) < 1.2) { v.morto = true; G.mortesVm++; voar('vm', v.x, v.z, (Math.random() - 0.5) * 4, 6, -4); if (Math.random() >= G.escudo) { a.morto = true; voar(a.tipo, a.x, a.z, (Math.random() - 0.5) * 4, 5, 3); } break; }
    if (!v.morto && Math.abs(v.z - K.cz) < 1.4 && Math.abs(v.x - h.x) < 1.6) { v.morto = true; heroiFerido(1); voar('vm', v.x, v.z, 0, 8, -6); }
    if (!v.morto && v.z > K.cz + 8) v.morto = true; }
  // flechas
  for (const f of G.flechas) {
    if (f.morta) continue; f.z -= 95 * dt; f.o.position.z = f.z;
    for (const b of K.ev) if (b.tipo === 'barril' && b.hp > 0 && Math.abs(f.x - b.x) < 1.9 && f.z <= b.z + 1 && f.z > b.z - 2.5) { f.morta = true; b.hp -= f.dano || 1; C.faiscas(b.x, 2.5, b.z + 1, 0xc89a5a, 4, 3);
      if (b.hp <= 0) { cena.remove(b.o); cena.remove(b.rot); recrutar(b.val, b.x, b.z); G.txt.push({ x: b.x, y: 5, z: b.z, txt: `+${b.val}`, cor: '#7aff8a', t: 0, grande: true }); sfx('brilho'); } else rotuloBarril(b); break; }
    if (f.morta) continue;
    let alvo = null; for (const v of G.vm) if (!v.morto && Math.abs(v.x - f.x) < 1.3 && Math.abs(v.z - f.z) < 1.8) { alvo = v; break; }
    if (alvo) { if (f.area) for (const v of G.vm) if (!v.morto && Math.hypot(v.x - alvo.x, v.z - alvo.z) < f.area) { v.morto = true; G.mortesVm++; }
      alvo.morto = true; G.mortesVm++; voar('vm', alvo.x, alvo.z, (Math.random() - 0.5) * 3, 5, -6); if ((f.perf = (f.perf ?? 0) - 1) < 0) f.morta = true; }
    else if (f.z <= ch.z + 3 && Math.abs(f.x) < 7) { f.morta = true; ferirChefe(f.dano || 1, f.x, ch.z + 3); }
    else if (f.z < K.cz - 80) f.morta = true;
  }
  for (const f of G.flechas) if (f.morta) cena.remove(f.o);
  G.flechas = G.flechas.filter(f => !f.morta); G.az = G.az.filter(a => !a.morto); limparVm();
  // portões: o lado do herói decide
  for (const ev of K.ev) if (ev.tipo === 'portao' && !ev.feito && K.cz <= ev.z) { ev.feito = true; const P = h.x < 0 ? ev.esq : ev.dir, x = h.x < 0 ? -MEIA / 2 : MEIA / 2;
    for (const pn of ev.paineis) pn.visible = false;
    if (P.op === '+') { recrutar(P.v, h.x, K.cz); faixa(`+${P.v} SOLDADOS!`, '#7aff8a'); sfx('brilho'); }
    else if (P.op === 'x') { const n = G.az.length * (P.v - 1); recrutar(n, h.x, K.cz); faixa(`EXÉRCITO x${P.v}!`, '#8ae0ff'); sfx('vitoria'); G.punch = 1; }
    else { perderTropa(P.v, h.x, K.cz); faixa(`-${P.v} SOLDADOS!`, '#ff5a4a'); som('pancada'); C.camera.tremor = 0.5; } }
  // serras que vão e voltam
  K.serraT = Math.max(0, K.serraT - dt);
  for (const s of K.ev) if (s.tipo === 'serra') { s.x = s.x0 + Math.sin(G.t * s.vel) * s.amp; s.o.position.x = s.x; s.o.rotation.z -= dt * 12;
    if (Math.abs(s.z - K.cz) < 9) { for (const a of G.az) if (Math.abs(a.x - s.x) < 2 && Math.abs(a.z - s.z) < 1.3) { a.morto = true; arremessar(a.tipo, a, s.x, s.z, 9); }
      G.az = G.az.filter(a => !a.morto); if (K.serraT <= 0 && Math.abs(h.x - s.x) < 2 && Math.abs(K.cz - s.z) < 1.3) { K.serraT = 1; heroiFerido(1); } } }
  // chefe: anda até a tropa e dá pancadas com aviso
  if (K.fase === 'chefe') {
    if (ch.z < K.cz - 14) { ch.z += 3 * dt; ch.v.tocar('Gallop', { vel: 0.6 }); }
    if (K.avisoG > 0) { if ((K.avisoG -= dt) <= 0) { const zc = K.gz; C.faiscas(K.gx, 1, zc, 0xc8a878, 40, 8); C.camera.tremor = 0.9; som('pancada');
        for (const a of G.az) if (Math.hypot(a.x - K.gx, a.z - zc) < 5) { a.morto = true; arremessar(a.tipo, a, K.gx, zc, 13); } G.az = G.az.filter(a => !a.morto);
        if (Math.hypot(h.x - K.gx, K.cz - zc) < 5) heroiFerido(2); } }
    else if ((K.golpeT -= dt) <= 0 && ch.z >= K.cz - 16) { K.golpeT = Math.max(2.5, 4.5 - 0.1 * G.n); K.gx = h.x + (Math.random() - 0.5) * 6; K.gz = K.cz - 2; K.avisoG = 1.1;
      C.aviso(K.gx, K.gz, 5, 1.1, 0xff3322); ch.v.tocar('Attack', { loop: false, reinicia: true }); }
    else if (!/Attack/.test(ch.v.anim) && ch.z >= K.cz - 14) ch.v.tocar('Idle');
  }
  ch.v.mixer.update(dt);
  // HUD e fim
  $('#jMoedas').textContent = fmt(S.moedas);
  $('#jChefeB').style.width = (100 * Math.max(0, ch.hp) / ch.max) + '%'; $('#jChefeT').textContent = `${fmt(Math.max(0, ch.hp))} / ${fmt(ch.max)}`;
  $('#jMuroB').style.width = (100 * Math.max(0, G.muro) / G.muroMax) + '%'; $('#jMuroT').textContent = `${Math.max(0, G.muro)} / ${G.muroMax}`;
  if (ch.hp <= 0) { flashTela('#fff', 0.6); ch.v.tocar('Death', { loop: false, reinicia: true }); for (const v of G.vm) arremessar('vm', v, 0, ch.z, 14); G.vm = []; C.camera.tremor = 1;
    G.lento = 1.6; C.faiscas(0, 6, ch.z, 0xffd84a, 120, 12); faixa('VITÓRIA!', '#ffd84a'); G.heroiV.tocar('Cheering'); terminar(true); }
  else if (G.muro <= 0) { G.heroiV.tocar('Death_A', { loop: false, reinicia: true }); faixa('O HERÓI CAIU!', '#ff5a4a'); terminar(false); }
}

// ---- habilidades dos chefes: aviso (1,2 s) e depois o efeito ----
const GEO_BOLHA = new THREE.SphereGeometry(1, 20, 14), MAT_BOLHA = new THREE.MeshBasicMaterial({ color: 0x6ab8ff, transparent: true, opacity: 0.3, depthWrite: false });
const GEO_FOGO = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), MAT_FOGO = new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.55, depthWrite: false });
const AVISOS_HAB = { investida: 'VAI AVANÇAR!', chamas: 'VAI CUSPIR FOGO!', gelo: 'VAI CONGELAR VOCÊ!', reviver: 'VAI LEVANTAR OS MORTOS!', esporos: 'VAI SOLTAR ESPOROS!', escudo: 'VAI SE PROTEGER!', cura: 'VAI SE CURAR!', laser: 'VAI DISPARAR O LASER!', lingua: 'VAI ENGOLIR SEUS SOLDADOS!' };
const frenteAzul = () => { let z = ZSPAWN; for (const a of G.az) if (a.z < z) z = a.z; return z; };
function passoHabilidade(dt) {
  const ch = G.chefe; if (!ch.hab || ch.hab === 'salto' || G.t < 6) return;
  if (ch.avisoHab > 0) { ch.avisoHab -= dt; if (ch.avisoHab <= 0) efeitoHabilidade(ch.hab); }
  else if ((ch.habT -= dt) <= 0 && !ch.pulo && !seguidor()) { iniciarHab(ch); if (G.dupla?.host) G.dupla.canal?.enviar('hab', {}); }
  // efeitos que duram
  if (ch.inv) { const I = ch.inv; I.t += dt; const k = Math.min(1, I.t / 0.6); const z0 = ch.z; ch.z = I.z0 + (I.z1 - I.z0) * k;
    for (const a of G.az) if (!a.morto && a.z > z0 && a.z < ch.z + 6 && Math.abs(a.x) < 6) { a.morto = true; arremessar(a.tipo, a, a.x, ch.z, 14); }
    G.az = G.az.filter(a => !a.morto); if (k >= 1) { ch.inv = null; C.camera.tremor = 0.8; C.faiscas(0, 1, ch.z + 4, 0xc8a878, 50, 8); som('pancada'); } }
  for (const fg of G.fogos) { fg.t += dt; fg.o.material.opacity = 0.55 * Math.min(1, (fg.dur - fg.t) * 2);
    if (Math.random() < dt * 20) C.faiscas((Math.random() - 0.5) * 12, 1, fg.z + (Math.random() - 0.5) * 12, 0xff7a2a, 2, 3);
    for (const a of G.az) if (!a.morto && Math.hypot(a.x, a.z - fg.z) < fg.r) { a.morto = true; voar(a.tipo, a.x, a.z, (Math.random() - 0.5) * 4, 7, 2); }
    G.az = G.az.filter(a => !a.morto); if (fg.t >= fg.dur) { cena.remove(fg.o); fg.fim = true; } }
  G.fogos = G.fogos.filter(f => !f.fim);
  if (ch.escudoT > 0) { ch.escudoT -= dt; ch.bolha.position.set(0, 6 + ch.y, ch.z); ch.bolha.scale.setScalar(9 + Math.sin(G.t * 8) * 0.4); if (ch.escudoT <= 0) { cena.remove(ch.bolha); ch.bolha = null; faixa('ESCUDO QUEBROU!', '#8ae0ff'); } }
  if (ch.curaT > 0) { const k = Math.min(dt, ch.curaT); ch.curaT -= dt; ch.hp = Math.min(ch.max, ch.hp + ch.max * 0.035 * k); if (Math.random() < dt * 25) C.faiscas((Math.random() - 0.5) * 6, 3 + Math.random() * 6, ch.z, 0x6aff6a, 2, 2); }
  if (G.congelado > 0) { G.congelado -= dt; G.tonto = Math.max(G.tonto, 0.05); if (Math.random() < dt * 12) C.faiscas(G.heroi.x, 3, ZH, 0xbfe8ff, 2, 2); G.brilhoH = Math.max(G.brilhoH, 0.4); }
}
function iniciarHab(ch) {
  ch.habT = ch.furia ? 8 : 11; ch.avisoHab = 1.2; ch.v.tocar('Attack2', { loop: false, reinicia: true });
    faixa(`${ch.nome.split(',')[0].toUpperCase()} ${AVISOS_HAB[ch.hab]}`, '#ff9a3a');
    if (ch.hab === 'investida') ch.alvoInv = Math.min(ch.z + 16, ZMURO - 8), C.avisoLinha(0, ch.z + 3, 0, ch.alvoInv - ch.z + 4, 10, 1.2);
    if (ch.hab === 'chamas') { ch.zFogo = Math.max(ch.z + 8, Math.min(frenteAzul() - 2, ZMURO - 10)); C.aviso(0, ch.zFogo, 7, 1.2, 0xff5a1a); }
    if (ch.hab === 'gelo') C.aviso(G.heroi.x, ZH, 4, 1.2, 0x6ab8ff);
    if (ch.hab === 'laser') { ch.laserX = Math.max(-MEIA + 3, Math.min(MEIA - 3, G.heroi.x)); C.avisoLinha(ch.laserX, ch.z + 3, 0, ZH - ch.z, 5, 1.2, 0x9aff3a); }
    if (ch.hab === 'lingua') C.avisoLinha(0, ch.z + 3, 0, Math.max(6, frenteAzul() - ch.z), 7, 1.2, 0xff6aa0); 
}
function efeitoHabilidade(hab) {
  const ch = G.chefe;
  if (hab === 'investida') { ch.inv = { t: 0, z0: ch.z, z1: ch.alvoInv }; ch.v.tocar('Gallop', { vel: 2.5 }); faixa('INVESTIDA!', '#ff5a4a'); }
  if (hab === 'chamas') { const o = new THREE.Mesh(GEO_FOGO, MAT_FOGO.clone()); o.scale.setScalar(7); o.position.set(0, 0.25, ch.zFogo); cena.add(o);
    G.fogos.push({ o, z: ch.zFogo, r: 7, t: 0, dur: 3.5 }); C.faiscas(0, 6, ch.z + 4, 0xff5a1a, 60, 10); som('pancada', 0.5); }
  if (hab === 'gelo') { if (Math.abs(G.heroi.x - (G.geloX ?? G.heroi.x)) < 99) { G.congelado = 3; faixa('CONGELADO!', '#8ae0ff'); C.faiscas(G.heroi.x, 4, ZH, 0xbfe8ff, 40, 6); } }
  if (hab === 'reviver') { const n = Math.min(45, 8 + 2 * G.n); for (let i = 0; i < n && G.vm.length < MAXU; i++) G.vm.push({ x: (Math.random() - 0.5) * XC * 1.8, z: ch.z + 8 + Math.random() * 25, ph: Math.random() * 6, ax: (Math.random() - 0.5) * XC * 1.8 });
    C.faiscas(0, 2, ch.z + 18, 0x9aff6a, 60, 8); faixa('OS MORTOS SE LEVANTAM!', '#9aff6a'); }
  if (hab === 'esporos') { const n = Math.min(40, 10 + 2 * G.n); for (let i = 0; i < n && G.vm.length < MAXU; i++) G.vm.push({ x: (Math.random() - 0.5) * XC * 1.8, z: ch.z + 5 + Math.random() * 3, ph: Math.random() * 6, ax: (Math.random() - 0.5) * XC * 1.8, vel: 1.8 });
    C.faiscas(0, 6, ch.z + 3, 0xd88aff, 50, 7); faixa('COGUMELINHOS!', '#d88aff'); }
  if (hab === 'escudo') { ch.escudoT = 4.5; if (!ch.bolha) { ch.bolha = new THREE.Mesh(GEO_BOLHA, MAT_BOLHA); cena.add(ch.bolha); } faixa('ESCUDO MÁGICO! ATAQUE OS ORCS', '#6ab8ff'); }
  if (hab === 'laser') { const lx = ch.laserX ?? 0; C.feixe(lx, ch.z + 3, lx, ZH + 1, 0x9aff3a); C.feixe(lx + 0.6, ch.z + 3, lx + 0.6, ZH + 1, 0xeaffd0);
    for (const a of G.az) if (!a.morto && Math.abs(a.x - lx) < 2.5) { a.morto = true; voar(a.tipo, a.x, a.z, (a.x - lx) * 4, 8, 1); } G.az = G.az.filter(a => !a.morto);
    if (Math.abs(G.heroi.x - lx) < 2.5) { G.congelado = 1.5; faixa('ATORDOADO PELO LASER!', '#9aff3a'); } else faixa('ESQUIVOU DO LASER!', '#9aff3a');
    C.camera.tremor = 0.6; sfx('magia'); }
  if (hab === 'lingua') { const vivos = G.az.filter(a => !a.morto).sort((a, b) => a.z - b.z), n = Math.min(vivos.length, Math.max(5, Math.round(vivos.length * 0.3)));
    for (const a of vivos.slice(0, n)) { a.morto = true; arremessar(a.tipo, a, 0, ch.z + 2, 10); } G.az = G.az.filter(a => !a.morto);
    C.faiscas(0, 3, ch.z + 4, 0xff6aa0, 40, 7); faixa(n ? `NHAC! ENGOLIU ${n} SOLDADOS!` : 'A LÍNGUA ERROU!', '#ff6aa0'); som('pancada'); }
  if (hab === 'cura') { ch.curaT = 2; faixa('O XAMÃ SE CURA!', '#6aff6a'); sfx('magia'); }
}
function ferirChefe(d, x, z, forte) {
  const ch = G.chefe; if (ch.escudoT > 0) { if (Math.random() < 0.15) G.txt.push({ x, y: 9, z, txt: 'BLOQUEADO', cor: '#8ae0ff', t: 0 }); return; }
  d = Math.round(d * (G.multChefe || 1)); if (G.crit && Math.random() < G.crit) { d *= 3; G.txt.push({ x, y: 11, z, txt: 'CRÍTICO!', cor: '#ff5a3a', t: 0 }); forte = true; }
  ch.hp -= d; G.danoTotal = (G.danoTotal || 0) + d; if (G.dupla) G.dupla.meuDano += d; ch.flash = forte ? 0.15 : 0.08; if (forte) { C.impacto(x, 4, z, 0xffd84a, 1.4); ch.punch = 0.14; } else if (Math.random() < 0.3) { C.faiscas(x, 3, z, 0xffffff, 4, 4); if (Math.random() < 0.3) C.clarao(x, 4, z, 0xffffff, 1.6, 0.1); }
  if (forte || Math.random() < (G.corrida ? 0.04 : 0.25)) G.txt.push({ x, y: 9, z, txt: '-' + fmt(d), cor: forte ? '#ffd84a' : '#fff', t: 0, grande: forte });
}
// ponto onde está a horda mais perto da muralha (ou o chefe)
function zDaHorda() { const ch = G.chefe; let z = ch.z + 3; for (const v of G.vm) if (v.z > z) z = v.z; return Math.min(z - 2, ZMURO - 8); }
const GEO_BARRIL = new THREE.CylinderGeometry(1, 1, 1.6, 12), MAT_BARRIL = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
const GEO_METEORO = new THREE.IcosahedronGeometry(3, 1), MAT_METEORO = new THREE.MeshBasicMaterial({ color: 0xff6a1a });
const GEO_PORTAL = new THREE.TorusGeometry(1, 0.18, 8, 32).rotateX(Math.PI / 2), MAT_PORTAL = new THREE.MeshBasicMaterial({ color: 0xb04aff, transparent: true, opacity: 0.85 });
const GEO_TORNADO = new THREE.ConeGeometry(2.6, 7, 12, 1, true).rotateX(Math.PI).translate(0, 3.5, 0), MAT_TORNADO = new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
// poder especial de cada herói (o nível vem das cartas do botão de poder)
function poderHeroi(id) {
  const ch = G.chefe, nv = G.pd.chuva.nv, h = G.heroi;
  if (id === 'barril') { const z = zDaHorda(), o = new THREE.Mesh(GEO_BARRIL, MAT_BARRIL); o.position.set(h.x, 3, ZH); cena.add(o);
    G.chuvas.push({ t: 0, z, fl: [], tipo: 'barril', o, x0: h.x, parc: !!G.efParc }); faixa('BARRIL EXPLOSIVO!', '#ff9a3a'); animHeroi().tocar('Throw', { loop: false, reinicia: true }); }
  if (id === 'meteoro') { const z = ch.z + 3, o = new THREE.Mesh(GEO_METEORO, MAT_METEORO); o.position.set(0, 60, z + 10); cena.add(o);
    G.chuvas.push({ t: 0, z, fl: [], tipo: 'meteoro', o, parc: !!G.efParc }); faixa('METEORO!', '#ff6a1a'); animHeroi().tocar('Ranged_Magic_Summon', { loop: false, reinicia: true }); sfx('magia'); }
  if (id === 'portal') { const z = zDaHorda(), o = new THREE.Mesh(GEO_PORTAL, MAT_PORTAL); o.position.set(0, 0.4, z); o.scale.setScalar(0.1); cena.add(o);
    G.chuvas.push({ t: 0, z, fl: [], tipo: 'portal', o, parc: !!G.efParc }); faixa('PORTAL SOMBRIO!', '#c88aff'); animHeroi().tocar('Ranged_Magic_Spellcasting_Long', { loop: false, reinicia: true }); sfx('magia'); }
  if (id === 'rugido') { // empurra os orcs para trás e os deixa lentos (com medo)
    for (const v of G.vm) { v.z -= 10 + 2 * nv; v.luta = null; } for (const a of G.az) a.luta = null;
    if (!G.efParc) ch.z -= 3; G.medoT = 4 + 0.5 * nv; C.camera.tremor = 1; G.punch = 1; C.faiscas(h.x, 3, ZH - 3, 0xff9a3a, 60, 10);
    faixa('RUGIDO! OS ORCS RECUAM!', '#ff9a3a'); animHeroi().tocar('Cheering', { loop: false, reinicia: true }); som('pancada'); }
  if (id === 'escudo') { G.invT = 5 + 0.5 * nv; if (!G.escudoO) { G.escudoO = new THREE.Mesh(new THREE.BoxGeometry(MEIA * 2, 7, 1.2), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.35, depthWrite: false })); G.escudoO.position.set(0, 3.5, ZMURO - 0.6); cena.add(G.escudoO); }
    G.escudoO.visible = true; C.faiscas(0, 4, ZMURO, 0xffe27a, 60, 8); faixa('ESCUDO SAGRADO!', '#ffe27a'); animHeroi().tocar('Cheering', { loop: false, reinicia: true }); sfx('magia'); }
  if (id === 'tempestade') { // raios nos orcs mais perto da muralha e um no chefe
    const alvos = G.vm.filter(v => !v.morto).sort((a, b) => b.z - a.z).slice(0, 16 + 2 * nv); let n = 0;
    for (const v of alvos) { v.morto = true; G.mortesVm++; n++; if (n <= 12) C.onda(v.x, v.z, 2.2, 0x7ac8ff, 0.35); voar('vm', v.x, v.z, (Math.random() - 0.5) * 6, 10, -3); if (n % 3 === 0) C.faiscas(v.x, 2, v.z, 0x7ac8ff, 6, 5); }
    if (!G.efParc) ferirChefe(Math.round(ch.max * (0.03 + 0.005 * (nv - 1))), 0, ch.z + 3, true); C.onda(0, ch.z + 3, 6, 0x7ac8ff, 0.5); C.faiscas(0, 6, ch.z + 3, 0x7ac8ff, 40, 8); limparVm();
    C.camera.tremor = 0.8; G.punch = 1; faixa('TEMPESTADE DE RAIOS!', '#7ac8ff'); animHeroi().tocar('Ranged_Magic_Summon', { loop: false, reinicia: true }); sfx('magia'); som('pancada'); }
  if (id === 'tornado') { const o = new THREE.Mesh(GEO_TORNADO, MAT_TORNADO), x = Math.max(-XC, Math.min(XC, h.x)); o.position.set(x, 0, ZSPAWN); cena.add(o);
    G.tornados.push({ o, x, z: ZSPAWN }); faixa('TORNADO DE LÂMINAS!', '#e8f0ff'); animHeroi().tocar('Throw', { loop: false, reinicia: true }); sfx('magia'); }
}
function usarPoder(k) {
  if (!G || G.fim || tela !== 'jogo') return; const P = G.pd[k]; if (P.cd > 0) { som('erro'); return; }
  P.cd = P.max; const ch = G.chefe; if (G.tut) G.tut.poder = true;
  if (G.dupla && !G.dupla.bot) G.dupla.canal?.enviar('pd', { id: k === 'chuva' ? G.heroiDef.poder.id : 'gigante' });
  if (k === 'chuva' && G.heroiDef.poder.id !== 'chuva') { poderHeroi(G.heroiDef.poder.id); G.brilhoH = 1; som('confirma'); return; }
  if (k === 'chuva') soltarChuva(); else {
    const v = C.heroi(visualPadrao('cav')); v.raiz.scale.setScalar(4.2); v.raiz.rotation.y = Math.PI; const gx = G.rotas > 1 ? ladoHeroi() * 2.4 : 0; v.raiz.position.set(gx, 0, ZSPAWN);
    G.gigante?.v.remover(); G.gigante = { v, x: gx, z: ZSPAWN, hp: (40 + 4 * G.n) * (1 + 0.25 * (G.pd.gigante.nv - 1)), t: 0, estado: 'anda', golpe: 0 };
    C.faiscas(0, 3, ZSPAWN, 0x8ac8ff, 40, 7); faixa('GIGANTE ALIADO!', '#8ac8ff'); sfx('magia'); C.camera.tremor = 0.5;
  }
  G.brilhoH = 1; som('confirma');
}
// poder usado pelo parceiro: o efeito aparece aqui também e limpa os orcs desta tela (o dano no chefe já vem pela vida sincronizada)
function poderDoParceiro(id) {
  const D = G.dupla; G.efParc = true;
  try { if (id === 'chuva') soltarChuva(); else if (id !== 'gigante') poderHeroi(id); } finally { G.efParc = false; }
  G.txt.push({ x: D.x, y: 7, z: ZH, txt: D.apelido, cor: '#8ae0ff', t: 0, grande: true });
}
const animHeroi = () => (G.efParc && G.dupla?.v ? G.dupla.v : G.heroiV);
function soltarChuva() { // cai em cima dos vermelhos mais perto da muralha (ou no chefe)
  {
    const z = zDaHorda();
    const c = { t: 0, z, fl: [], parc: !!G.efParc };
    for (let i = 0; i < 26; i++) { const o = new THREE.Mesh(GEO_FLECHA, MAT_FLECHA), a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 7, y0 = 30 + Math.random() * 15;
      o.rotation.x = -Math.PI / 2; o.position.set(Math.cos(a) * r, y0, z + Math.sin(a) * r); cena.add(o); c.fl.push({ o, y0, atraso: Math.random() * 0.2 }); }
    G.chuvas.push(c); faixa('CHUVA DE FLECHAS!', '#8ac8ff'); animHeroi().tocar('Ranged_Bow_Release', { loop: false, reinicia: true }); sfx('arco');
  }
}
function acertarBloco(b, pista, lado, dano = 1) {
  if (b.tipo === 'barreira') {
    b.hp -= dano; C.faiscas(b.mesh.position.x + (Math.random() - 0.5) * 6, 2.5, b.z + 0.8, 0xc89a5a, 5, 3);
    if (b.hp > 0) { redesenharBarreira(b); return; }
    som('pancada', 0.5); C.faiscas(b.mesh.position.x, 2, b.z, 0x8a5a2b, 40, 7); C.camera.tremor = 0.3;
  } else if (b.hp > dano) { // pilha resistente: encolhe a cada flechada
    b.hp -= dano; b.mesh.scale.y = 0.45 + 0.55 * b.hp / b.hpMax; b.mesh.position.y = 1.2 * b.mesh.scale.y; C.faiscas(b.mesh.position.x + (Math.random() - 0.5) * 6, 2, b.z + 1.5, 0xffffff, 3, 2); return;
  } else if (b.tipo === 'poder') {
    if (b.p === 'flecha') { const m = G.nFlechas >= G.flechasMax; G.nFlechas = Math.min(G.flechasMax, G.nFlechas + 1); faixa(m ? 'FLECHAS NO MÁXIMO' : 'FLECHA EXTRA!', '#c88aff'); }
    else { const m = G.tiro >= G.tiroMax; G.tiro = Math.min(G.tiroMax, G.tiro * 1.35); faixa(m ? 'TIRO NO MÁXIMO' : 'TIRO RÁPIDO!', '#c88aff'); }
    G.brilhoH = 1; G.punch = 1; C.faiscas(b.mesh.position.x, 2, b.z + 1, 0xc88aff, 40, 7); C.faiscas(G.heroi.x, 3, ZH, 0xc88aff, 30, 5); sfx('magia'); sfx('brilho');
  } else {
    const n = Math.round((b.tipo === 'vezes' ? Math.min(150, G.az.length) : b.valor) * G.multPilha);
    G.fila = Math.min(maxFila(), G.fila + n); if (G.dupla) G.dupla.reforco += n * 0.25; G.txt.push({ x: lado * XL, y: 4, z: b.z, txt: b.tipo === 'vezes' ? `x${b.valor}!` : `+${b.valor}`, cor: b.tipo === 'vezes' ? '#7aff8a' : n >= 10 ? '#ffd84a' : '#8ac8ff', t: 0, grande: n >= 10 });
    C.faiscas(b.mesh.position.x, 2, b.z + 1, b.tipo === 'vezes' ? 0x4aff6a : n >= 10 ? 0xffd84a : 0x5aa8ff, n >= 10 ? 26 : 12, 5);
    G.combo = (G.combo || 0) + 1; G.comboT = 1.2; sfx('nota', G.combo - 1); if (n >= 10) sfx('brilho');
    if (b.tipo === 'vezes') { faixa('EXÉRCITO DOBRADO!', '#7aff8a'); G.punch = 1; }
    else if (b.valor >= 50) { faixa(b.valor >= 99 ? 'MEGA!' : 'INCRÍVEL!', '#ffd84a'); G.punch = 0.8; }
  }
  cena.remove(b.mesh); pista.splice(pista.indexOf(b), 1); if (G.tut) G.tut.pilhas++;
}
function faixa(txt, cor) { G.banner = { txt: tr(txt), cor, t: 0 }; }
// textos flutuantes e contadores dos exércitos
function nomeParceiro() {
  const D = G.dupla; if (!D || tela !== 'jogo') return; const p = C.tela(D.x, 7.5, ZH); if (!p) return;
  gfx.font = '16px Titulo, sans-serif'; gfx.textAlign = 'center'; gfx.textBaseline = 'middle'; gfx.lineWidth = 4; gfx.strokeStyle = '#0f2f6a';
  const t = D.saiu ? `${D.apelido} (saiu)` : D.apelido; gfx.strokeText(t, p[0], p[1]); gfx.fillStyle = D.saiu ? '#aab' : '#8ae0ff'; gfx.fillText(t, p[0], p[1]);
  if (!D.bot && !D.saiu) { // sinal da conexão: verde, amarelo ou vermelho, com o ping
    const w = gfx.measureText(t).width, x = p[0] + w / 2 + 10, ms = D.ping ?? null, cor = ms == null ? '#aab' : ms < 150 ? '#4ae86a' : ms < 350 ? '#ffd23a' : '#ff5a4a';
    gfx.beginPath(); gfx.arc(x, p[1], 5, 0, 7); gfx.fillStyle = cor; gfx.fill(); gfx.lineWidth = 2; gfx.strokeStyle = '#0f2f6a'; gfx.stroke();
    if (ms != null) { gfx.font = '11px Titulo, sans-serif'; gfx.textAlign = 'left'; gfx.lineWidth = 3; gfx.strokeText(`${ms}ms`, x + 8, p[1]); gfx.fillStyle = cor; gfx.fillText(`${ms}ms`, x + 8, p[1]); } }
  for (const b of D.balao || []) { b.t += 1 / 60; const q = C.tela(b.eu ? G.heroi.x : D.x, 9 + b.t * 1.5, ZH); if (!q) continue; gfx.globalAlpha = Math.max(0, 1 - Math.max(0, b.t - 1.6) / 0.5);
    gfx.font = `${Math.round(38 * (b.t < 0.12 ? 0.5 + b.t * 4.2 : 1))}px sans-serif`; gfx.textAlign = 'center'; gfx.fillText(b.e, q[0], q[1]); gfx.globalAlpha = 1; }
  if (D.balao) D.balao = D.balao.filter(b => b.t < 2.1);
}
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
    nomeParceiro();
    if (G.fila > 0) { const p = C.tela(0, 3, ZSPAWN); if (p) { gfx.font = '20px Titulo, sans-serif'; gfx.textAlign = 'center'; gfx.lineWidth = 4; gfx.strokeStyle = '#0f2f6a'; gfx.strokeText(`+${fmt(G.fila)}`, p[0], p[1]); gfx.fillStyle = '#8ac8ff'; gfx.fillText(`+${fmt(G.fila)}`, p[0], p[1]); } }
  }
  for (const t of G.txt) { t.t += dt; const p = C.tela(t.x, t.y + t.t * 3, t.z); if (!p) continue; gfx.globalAlpha = Math.max(0, 1 - Math.max(0, t.t - 0.5) / 0.5);
    const tx = tr(t.txt), pop = t.t < 0.1 ? 0.6 + t.t * 9 : Math.max(1, 1.5 - (t.t - 0.1) * 2.5); gfx.font = `${Math.round((t.grande ? 34 : 24) * pop)}px Titulo, sans-serif`; gfx.textAlign = 'center'; gfx.lineWidth = 5; gfx.strokeStyle = 'rgba(0,0,0,.7)'; gfx.strokeText(tx, p[0], p[1]); gfx.fillStyle = t.cor; gfx.fillText(tx, p[0], p[1]); gfx.globalAlpha = 1; }
  G.txt = G.txt.filter(t => t.t < 1);
  const B = G.banner;
  if (B) { B.t += dt; const k = Math.min(1, B.t / 0.18), s = k < 1 ? 0.4 + 0.9 * k : 1 + 0.08 * Math.max(0, 1 - (B.t - 0.18) * 4), a = Math.max(0, 1 - Math.max(0, B.t - 1.1) / 0.4);
    gfx.save(); gfx.globalAlpha = a; gfx.translate(innerWidth / 2, innerHeight * 0.36); gfx.scale(s, s); gfx.rotate(-0.04);
    let fs = 40; gfx.font = `${fs}px Titulo, sans-serif`; while (fs > 18 && gfx.measureText(B.txt).width > innerWidth - 40) gfx.font = `${fs -= 2}px Titulo, sans-serif`;
    gfx.textAlign = 'center'; gfx.textBaseline = 'middle'; gfx.lineWidth = 9; gfx.lineJoin = 'round'; gfx.strokeStyle = 'rgba(30,10,0,.85)'; gfx.strokeText(B.txt, 0, 0); gfx.fillStyle = B.cor; gfx.fillText(B.txt, 0, 0);
    gfx.restore(); if (B.t > 1.5) G.banner = null; }
}
