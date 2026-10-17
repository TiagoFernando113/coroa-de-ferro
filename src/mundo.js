// Mapa de Guerra (etapa 1): um mapa só para todos os jogadores. Cada um tem 2 exércitos comandados pelo herói,
// que marcham em tempo real (o servidor guarda o caminho e a hora da saída; cada celular calcula onde o exército está).
// O terreno é gerado igual em todo celular (mesma semente); quem está com o mapa aberto também dá as ordens dos bots.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as C from './cena.js';
import { S, salvar } from './meta.js';
import { HEROIS } from './herois.js';
import { fmt } from './dados.js';
import { desenharTropas } from './tropas.js';
import { ico, som, $, flashTela } from './util.js';
import { sfx } from './musica.js';
import { t as tr } from './i18n.js';
import * as ON from './online.js';

const N = 56, T = 4, WX = 6000, WZ = 0, VEL = 0.6; // tiles por lado, tamanho do tile, onde fica o mapa no mundo, velocidade (tiles/s)
const GRAMA = 0, FLORESTA = 1, MONTANHA = 2, AGUA = 3, PONTE = 4;
const CORES_CLA = [0xe8503a, 0x2f7ae8, 0x2bb84a, 0xa24ae8, 0xf2b51a, 0x1fb8b8, 0xe85aa8, 0x6a6a7a];
const passa = t => t === GRAMA || t === FLORESTA || t === PONTE;
let K = null, el = null, op = null;
const cn = () => C.obterCena();
const wx = x => WX + (x - N / 2) * T, wz = y => WZ + (y - N / 2) * T; // tile (com fração) → mundo

// ---- terreno (igual em todo celular) ----
function rng(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function ruido(r, esc) {
  const m = Math.ceil(N / esc) + 2, g = Array.from({ length: m * m }, r), s = t => t * t * (3 - 2 * t);
  return (x, y) => { const fx = x / esc, fy = y / esc, ix = Math.floor(fx), iy = Math.floor(fy), tx = s(fx - ix), ty = s(fy - iy), v = (i, j) => g[j * m + i];
    return (v(ix, iy) * (1 - tx) + v(ix + 1, iy) * tx) * (1 - ty) + (v(ix, iy + 1) * (1 - tx) + v(ix + 1, iy + 1) * tx) * ty; };
}
let MAPA = null;
function gerarMapa() {
  if (MAPA) return MAPA;
  const r = rng(2026), n1 = ruido(r, 9), n2 = ruido(r, 4), nf = ruido(r, 6), tipo = new Uint8Array(N * N), at = (x, y) => tipo[y * N + x];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const h = 0.65 * n1(x, y) + 0.35 * n2(x, y), borda = Math.min(x, y, N - 1 - x, N - 1 - y);
    tipo[y * N + x] = borda < 2 || (borda < 4 && r() < 0.35) ? AGUA : h < 0.26 ? AGUA : h > 0.73 ? MONTANHA : nf(x, y) > 0.6 ? FLORESTA : GRAMA;
  }
  // dois rios cruzando o mapa, com pontes de tempos em tempos
  for (const vert of [true, false]) { let p = 12 + Math.floor(r() * (N - 24)), k = 0;
    for (let q = 2; q < N - 2; q++) { p = Math.max(5, Math.min(N - 6, p + (r() < 0.33 ? -1 : r() < 0.5 ? 1 : 0))); k++;
      const ponte = k % 9 === 4; for (const d of [0, 1]) { const x = vert ? p + d : q, y = vert ? q : p + d; tipo[y * N + x] = ponte ? PONTE : AGUA; } } }
  // lugares de castelo e acampamento: longe um do outro e da borda
  const cand = []; for (let y = 5; y < N - 5; y++) for (let x = 5; x < N - 5; x++) if (at(x, y) === GRAMA) cand.push([x, y]);
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  let sitios = []; for (const c of cand) if (sitios.length < 30 && sitios.every(s => Math.hypot(s[0] - c[0], s[1] - c[1]) >= 8.5)) sitios.push(c);
  for (const [sx, sy] of sitios) for (let y = sy - 2; y <= sy + 2; y++) for (let x = sx - 2; x <= sx + 2; x++) if (at(x, y) !== PONTE) tipo[y * N + x] = GRAMA;
  // tudo que não dá para alcançar do primeiro lugar vira montanha (assim todo caminho existe)
  const visto = new Uint8Array(N * N), fila = [sitios[0][1] * N + sitios[0][0]]; visto[fila[0]] = 1;
  while (fila.length) { const i = fila.pop(), x = i % N, y = (i / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy, j = b * N + a; if (a >= 0 && b >= 0 && a < N && b < N && !visto[j] && passa(tipo[j])) { visto[j] = 1; fila.push(j); } } }
  for (let i = 0; i < N * N; i++) if (!visto[i] && passa(tipo[i])) tipo[i] = MONTANHA;
  sitios = sitios.filter(([x, y]) => visto[y * N + x]);
  return MAPA = { tipo, at, sitios, r };
}
const livre = (x, y) => x >= 0 && y >= 0 && x < N && y < N && passa(MAPA.tipo[y * N + x]);
function linhaLivre(a, b) { const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 0.2); for (let i = 0; i <= n; i++) { const k = i / n; if (!livre(Math.floor(a[0] + (b[0] - a[0]) * k), Math.floor(a[1] + (b[1] - a[1]) * k))) return false; } return true; }
// caminho (A*) entre dois pontos (tiles com fração), já alisado: só os pontos onde precisa virar
function caminho(de, para) {
  const s = Math.floor(de[1]) * N + Math.floor(de[0]), g = Math.floor(para[1]) * N + Math.floor(para[0]); if (!passa(MAPA.tipo[g])) return null;
  const custo = new Float32Array(N * N).fill(1e9), veio = new Int32Array(N * N).fill(-1), heap = [[0, s]], gx = g % N, gy = (g / N) | 0; custo[s] = 0;
  const push = e => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], ult = heap.pop(); if (heap.length) { heap[0] = ult; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) { const [, i] = pop(); if (i === g) break; const x = i % N, y = (i / N) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const a = x + dx, b = y + dy; if (!livre(a, b) || (dx && dy && (!livre(x + dx, y) || !livre(x, y + dy)))) continue;
      const j = b * N + a, c = custo[i] + (dx && dy ? 1.414 : 1) * (MAPA.tipo[j] === FLORESTA ? 1.3 : 1); if (c < custo[j]) { custo[j] = c; veio[j] = i; push([c + Math.hypot(a - gx, b - gy), j]); } } }
  if (veio[g] < 0 && g !== s) return null;
  const tiles = []; for (let i = g; i >= 0 && i !== s; i = veio[i]) tiles.push([i % N + 0.5, ((i / N) | 0) + 0.5]); tiles.reverse(); tiles[tiles.length - 1] = [para[0], para[1]];
  const pts = [[de[0], de[1]]]; let i = 0, atual = pts[0];
  while (i < tiles.length) { let j = tiles.length - 1; while (j > i && !linhaLivre(atual, tiles[j])) j--; atual = tiles[j]; pts.push(atual); i = j + 1; }
  return pts.map(p => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]);
}
const comprimento = cam => { let d = 0; for (let i = 1; i < cam.length; i++) d += Math.hypot(cam[i][0] - cam[i - 1][0], cam[i][1] - cam[i - 1][1]); return d; };

// ---- bases: castelos dos clãs (lugares fixos, pela ordem dos clãs) e acampamentos de quem não tem clã ----
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
function bases() {
  const sitios = MAPA.sitios, usado = new Set(); K.castelos = [];
  for (const c of K.clas) { let i = hash('c' + c.id) % sitios.length; while (usado.has(i) && usado.size < sitios.length) i = (i + 1) % sitios.length; usado.add(i); K.castelos.push({ ...c, x: sitios[i][0] + 0.5, y: sitios[i][1] + 0.5 }); }
  K.livresSitios = sitios.map((s, i) => i).filter(i => !usado.has(i));
}
function baseDe(e) {
  const c = e.cla != null && K.castelos.find(q => q.id === e.cla), h = hash(e.dono), viz = [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2]];
  if (c) { const v = viz[(h + e.slot * 3) % 8]; return [c.x + v[0] * 0.8, c.y + v[1] * 0.8]; }
  const L = K.livresSitios.length ? K.livresSitios : MAPA.sitios.map((s, i) => i), s = MAPA.sitios[L[h % L.length]], o = ((h >> 8) % 3) - 1;
  return [s[0] + 0.5 + o + e.slot * 1.2, s[1] + 0.5 + ((h >> 4) % 3) - 1];
}
const agora = () => Date.now() / 1000 + (K?.dif || 0);
function posicao(e) { // onde o exército está agora (e para onde olha)
  if (!e.cam || !e.cam.length) { const b = e.base || baseDe(e); return { x: b[0], y: b[1], dir: 0, anda: false, fim: true }; }
  if (e.cam.length === 1) return { x: e.cam[0][0], y: e.cam[0][1], dir: e.dir || 0, anda: false, fim: true }; // parou onde estava (ex.: foi atacado no caminho)
  let d = Math.max(0, (agora() - e.t0) * VEL);
  for (let i = 1; i < e.cam.length; i++) { const a = e.cam[i - 1], b = e.cam[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= l) { const k = l ? d / l : 1; return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, dir: Math.atan2(b[0] - a[0], b[1] - a[1]), anda: true, falta: (comprimento(e.cam.slice(i)) + l - d) / VEL }; }
    d -= l; }
  const p = e.cam[e.cam.length - 1], q = e.cam[e.cam.length - 2]; return { x: p[0], y: p[1], dir: Math.atan2(p[0] - q[0], p[1] - q[1]), anda: false, fim: true };
}

// ---- cena ----
function montarTerreno() {
  const g = [], cor = new THREE.Color(), cores = { [GRAMA]: [0x7cc24a, 0x86cc52], [FLORESTA]: [0x4f9a3a, 0x58a240], [MONTANHA]: [0x9a8a76, 0x8f806c], [PONTE]: [0x7cc24a, 0x7cc24a] };
  const add = (geo, c) => { const n = geo.attributes.position.count, a = new Float32Array(n * 3); cor.set(c); for (let i = 0; i < n; i++) a.set([cor.r, cor.g, cor.b], i * 3); geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); geo.deleteAttribute('uv'); g.push(geo); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const t = MAPA.at(x, y); if (t === AGUA || t === PONTE) continue;
    const alto = t === MONTANHA ? 1.6 : 0; add(new THREE.BoxGeometry(T, 3 + alto, T).translate(wx(x + 0.5), -1.5 + alto / 2, wz(y + 0.5)), cores[t][(x + y) & 1]); }
  // fundo de terra e água
  add(new THREE.BoxGeometry(N * T, 6, N * T).translate(WX, -5.2, WZ), 0x8a6a48);
  const terra = new THREE.Mesh(mergeGeometries(g), new THREE.MeshLambertMaterial({ vertexColors: true })); terra.receiveShadow = true;
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(N * T, N * T).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3aa8e0, transparent: true, opacity: 0.88 })); agua.position.set(WX, -0.55, WZ);
  const pontes = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (MAPA.at(x, y) === PONTE) pontes.push(new THREE.BoxGeometry(T, 0.4, T * 0.9).translate(wx(x + 0.5), -0.1, wz(y + 0.5)));
  const ponte = new THREE.Mesh(mergeGeometries(pontes), new THREE.MeshLambertMaterial({ color: 0x9a6a3a })); ponte.receiveShadow = true;
  const grupo = new THREE.Group(); grupo.add(terra, agua, ponte); cn().add(grupo);
  // árvores, pedras, castelos e acampamentos (peças do kit, juntadas)
  const r = rng(77), pecas = [], arv = ['N:tree_pineRoundB', 'N:tree_oak', 'N:tree_default', 'N:tree_pineTallA', 'N:tree_fat'];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const t = MAPA.at(x, y);
    if (t === FLORESTA) for (let k = 0; k < 2; k++) pecas.push({ m: arv[Math.floor(r() * arv.length)], x: wx(x + 0.2 + r() * 0.6), z: wz(y + 0.2 + r() * 0.6), s: 2.6 + r() * 1.4, ry: r() * 6 });
    if (t === MONTANHA) pecas.push({ m: r() < 0.5 ? 'N:rock_tallA' : 'N:rock_largeA', x: wx(x + 0.5), y: 1.6, z: wz(y + 0.5), s: 3 + r() * 2.5, ry: r() * 6 });
    if (t === GRAMA && r() < 0.04) pecas.push({ m: r() < 0.5 ? 'N:plant_bush' : 'N:flower_redA', x: wx(x + r()), z: wz(y + r()), s: 2.5 }); }
  for (const c of K.castelos) { const x = wx(c.x), z = wz(c.y);
    pecas.push({ m: 'C:tower-square', x, z, s: 5 }, { m: 'C:tower-square', x: x - 4, z: z + 3, s: 3.5 }, { m: 'C:tower-square', x: x + 4, z: z + 3, s: 3.5 }, { m: 'C:flag', x, y: 10.5, z, s: 3.5 }); }
  const usados = new Set(K.castelos.map(c => `${Math.floor(c.x)},${Math.floor(c.y)}`));
  for (const i of K.livresSitios) { const [sx, sy] = MAPA.sitios[i]; if (usados.has(`${sx},${sy}`)) continue; pecas.push({ m: 'N:tent_detailedOpen', x: wx(sx + 0.5), z: wz(sy + 0.5), s: 3.5 }, { m: 'N:campfire_logs', x: wx(sx + 1.3), z: wz(sy + 1.2), s: 2.5 }); }
  return [grupo, C.montarEstatico(pecas)];
}
function bandeira(cor) { // mastro + pano na cor do clã
  const g = new THREE.Group(), m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 5), new THREE.MeshLambertMaterial({ color: 0x5a3a1a })); m.position.y = 1.6;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), new THREE.MeshLambertMaterial({ color: cor, side: THREE.DoubleSide })); p.position.set(0.66, 2.75, 0); g.add(m, p); cn().add(g); return g;
}

// ---- abrir / fechar ----
export function abrir(container, opcoes) {
  el = container; op = opcoes; el.hidden = false; gerarMapa();
  K = { ex: new Map(), bat: new Map(), bandeiras: [], flags: new Map(), clas: [], castelos: [], livresSitios: [], dif: 0, sel: null, prev: null, zoom: 95, cam: null, toques: new Map(), arrasto: null, tPoll: 0, carregou: false, txt: [], erro: '' };
  C.ceu(0x9ad8f8); C.neblina(180, 520); C.diaNoite(0);
  el.innerHTML = `<div class="muTopo"><button class="lSair" data-mu="sair">${ico('fechar')}</button><b>${tr('Mapa de Guerra')}</b><small id="muOn"></small></div>
    <div class="muAviso" id="muAviso">${tr('Carregando o mapa...')}</div>
    <div class="muConf" id="muConf" hidden></div><div class="muInfo" id="muInfo" hidden></div><div class="muExs" id="muExs"></div><div class="cqJanela" id="muRel" hidden></div>`;
  ligarToque(); atualizar(true);
}
export function fechar() {
  if (K) { for (const e of K.ex.values()) limparEx(e); if (K.cena) { C.descartar(K.cena[0]); C.removerGrupo(K.cena[1]); } C.descartar(K.linha); C.descartar(K.terr); for (const f of K.flags.values()) C.descartar(f.o); desenharTropas('az', [], 0, 0); desenharTropas('vm', [], 0, 0); }
  desligarToque(); K = null; if (el) { el.hidden = true; el.innerHTML = ''; }
}
function limparEx(e) { C.descartar(e.flag); e.v?.remover(); C.descartar(e.linha); }

// ---- servidor ----
function minhasTropas() { const up = S.up || {}; return Math.round(60 + 30 * (up.exercito || 0) + 8 * (up.vida || 0) + (S.equipe || []).length * 15); }
async function atualizar() {
  if (!K || K.buscando) return; K.buscando = true;
  try {
    const r = await ON.mapaEstado(S.heroi || 'lyra', minhasTropas()); if (!K) return;
    K.dif = r.agora - Date.now() / 1000; K.erro = '';
    if (!K.carregou || JSON.stringify(r.clas) !== K.clasSig) { K.clasSig = JSON.stringify(r.clas); K.clas = r.clas; bases(); if (!K.carregou) { K.cena = montarTerreno(); } }
    const vistos = new Set();
    for (const d of r.exercitos) { vistos.add(d.id); let e = K.ex.get(d.id);
      if (!e) { e = { ...d }; K.ex.set(d.id, e); } else if (!(e.eu && e.local && e.t0 > d.t0 + 0.5)) Object.assign(e, d, { local: false }); // a ordem que acabei de dar vale até o servidor confirmar
      e.base = baseDe(e); }
    for (const [id, e] of K.ex) if (!vistos.has(id)) { limparEx(e); K.ex.delete(id); }
    K.bandeiras = r.bandeiras || []; atualizarTerritorio();
    if (!K.castEnviado) { K.castEnviado = true; const faltam = K.castelos.filter(c => c.mx == null).map(c => ({ id: c.id, x: Math.floor(c.x), y: Math.floor(c.y) })); if (faltam.length) ON.mapaCastelos(faltam).catch(() => {}); }
    for (const b of r.batalhas) if (!K.bat.has(b.id)) { K.bat.set(b.id, { ...b, visto: -1 }); const a = K.ex.get(b.a), d = K.ex.get(b.b); if (a?.eu || d?.eu) { som('pancada'); toast(tr('Batalha!')); } }
    else Object.assign(K.bat.get(b.id), { fim: b.fim, recuou: b.recuou, linha: b.linha });
    for (const [id, b] of K.bat) if (!r.batalhas.some(q => q.id === id) && agora() > b.fim + 6) K.bat.delete(id);
    if (!K.carregou) { K.carregou = true; $('#muAviso').hidden = true; const m = meus()[0]; if (m) { const p = posicao(m); K.cam = { x: wx(p.x), z: wz(p.y) + 10 }; } }
    $('#muOn').textContent = `${[...K.ex.values()].filter(e => !e.bot).length / 2 | 0} ${tr('jogadores')} · ${[...K.ex.values()].filter(e => e.bot).length} bots`;
    perseguir(); darOrdensBots(r.livres || []); cards();
    if (r.relatorios?.length) mostrarRelatorios(r.relatorios);
  } catch (e) { if (K) { K.erro = e.message; const a = $('#muAviso'); if (a && !K.carregou) a.textContent = tr('Sem conexão com o mapa') + ' 😢'; } }
  finally { if (K) K.buscando = false; }
}
const emBatalha = e => { for (const b of K.bat.values()) if ((b.a === e.id || b.b === e.id) && agora() < b.fim + 0.5) return b; return null; };
const naBase = (e, p = posicao(e)) => Math.hypot(p.x - e.base[0], p.y - e.base[1]) < 2.5;
function tropasAgora(e) { // durante a batalha, a contagem vem da linha do tempo da luta
  const b = emBatalha(e); if (!b) return e.tropas; const k = Math.max(0, Math.min(b.linha.length - 1, Math.floor(agora() - b.t0)));
  return b.linha[k][b.a === e.id ? 0 : 1];
}
function perseguir() { // RoK: quem ataca segue o alvo; se ele andou, refaz o caminho até onde ele está
  for (const e of meus()) { if (!e.alvo || emBatalha(e)) continue; const a = K.ex.get(e.alvo); if (!a) continue; const pa = posicao(a), fim = e.cam?.[e.cam.length - 1];
    if (fim && Math.hypot(fim[0] - pa.x, fim[1] - pa.y) > 1.5 && !posicao(e).fim) atacar(e, a, true); }
}
function darOrdensBots(ids) { // bots andam pelo mapa e às vezes atacam outro exército que está fora de casa
  const ordens = [];
  for (const id of ids.slice(0, 4)) { const e = K.ex.get(id); if (!e) continue; const p = posicao(e), r = Math.random(); let alvo = null, alvoEx = null;
    if (r < 0.3) { let dm = 14; for (const o of K.ex.values()) { if (o === e || (o.cla != null && o.cla === e.cla) || o.tropas <= 0 || emBatalha(o)) continue; const q = posicao(o); if (naBase(o, q)) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < dm) { dm = d; alvoEx = o; alvo = [q.x, q.y]; } } }
    let flag = null, cerco = null;
    if (!alvo && e.cla != null && Math.random() < 0.12) { let dm = 14; for (const f of K.bandeiras) { if (f.cla === e.cla || f.pronta > agora()) continue; const d = Math.hypot(f.x + 0.5 - p.x, f.y + 0.5 - p.y); if (d < dm) { dm = d; cerco = f; } }
      if (cerco) { const a0 = Math.random() * 6.28, x = cerco.x + 0.5 + Math.sin(a0) * 1.3, y = cerco.y + 0.5 + Math.cos(a0) * 1.3; if (livre(Math.floor(x), Math.floor(y))) alvo = [x, y]; else cerco = null; } }
    if (!alvo && e.cla != null && oficial(e) && Math.random() < 0.35) { const pts = [...K.bandeiras.filter(f => f.cla === e.cla).map(f => [f.x, f.y]), ...K.castelos.filter(c => c.id === e.cla).map(c => [Math.floor(c.x), Math.floor(c.y)])];
      for (let k = 0; k < 10 && pts.length && !flag; k++) { const [bx, by] = pts[Math.floor(Math.random() * pts.length)], a = Math.random() * 6.28, d = 6 + Math.random() * 2.5, x = Math.round(bx + Math.cos(a) * d), y = Math.round(by + Math.sin(a) * d);
        if (!pontoBandeira(e.cla, x, y)) { flag = [x, y]; alvo = [x + 0.5, y + 0.5]; } } }
    for (let k = 0; k < 12 && !alvo; k++) { let x, y;
      if (r < 0.45 && K.castelos.length) { const c = K.castelos[Math.floor(Math.random() * K.castelos.length)]; x = c.x + (Math.random() - 0.5) * 6; y = c.y + (Math.random() - 0.5) * 6; }
      else if (r < 0.6 || e.tropas < (e.cap || 100) * 0.4) { [x, y] = e.base; }
      else { x = p.x + (Math.random() - 0.5) * 22; y = p.y + (Math.random() - 0.5) * 22; }
      if (livre(Math.floor(x), Math.floor(y))) alvo = [x, y]; }
    if (!alvo) continue; const cam = caminho([p.x, p.y], alvo); if (!cam || cam.length < 2) continue;
    const dur = comprimento(cam) / VEL; ordens.push({ id, cam, dur, alvo: alvoEx?.id ?? null, ...(flag ? { b: flag } : {}), ...(cerco ? { c: ['band', cerco.id] } : {}) }); if (flag) K.bandeiras.push({ id: -Date.now() - id, cla: e.cla, x: flag[0], y: flag[1], pronta: agora() + dur + 45 }); Object.assign(e, { cam, t0: agora(), t1: agora() + dur, alvo: alvoEx?.id ?? null }); }
  if (ordens.length) ON.mapaBots(ordens).catch(() => {});
}
async function enviar(e, cam, alvoId) {
  const dur = comprimento(cam) / VEL; Object.assign(e, { cam, t0: agora(), t1: agora() + dur, local: true, alvo: alvoId });
  try { const t0 = await ON.mapaMarchar(e.slot, cam, dur, alvoId, e.tipo); if (K && e.cam === cam) e.t0 = t0; } catch (er) { toast(tr(er.message)); }
  cards();
}
function marchar(e, alvo) {
  if (emBatalha(e)) { som('erro'); toast(tr('Em batalha! Use Recuar')); return; }
  const p = posicao(e), cam = caminho([p.x, p.y], alvo); if (!cam || cam.length < 2) { som('erro'); toast(tr('Não dá para chegar lá')); return; }
  sfx('brilho'); som('confirma'); enviar(e, cam, null);
}
function atacar(e, a, quieto) {
  if (emBatalha(e)) { if (!quieto) { som('erro'); toast(tr('Em batalha! Use Recuar')); } return; }
  if (e.tropas <= 0) { if (!quieto) { som('erro'); toast(tr('Sem tropas: espere os feridos se recuperarem')); } return; }
  const p = posicao(e), q = posicao(a); let cam = null;
  for (const [dx, dy] of [[0, 1.2], [1.2, 0], [-1.2, 0], [0, -1.2], [0.9, 0.9], [-0.9, 0.9], [0.9, -0.9], [-0.9, -0.9]]) { const x = q.x + dx, y = q.y + dy; if (livre(Math.floor(x), Math.floor(y))) { cam = caminho([p.x, p.y], [x, y]); if (cam) break; } }
  if (!cam || cam.length < 2) { if (!quieto) { som('erro'); toast(tr('Não dá para chegar lá')); } return; }
  if (!quieto) { sfx('vitoria'); toast(`${tr('Atacando')} ${a.nome}!`); }
  enviar(e, cam, a.id);
}
async function recuar(e) {
  const p = posicao(e), cam = caminho([p.x, p.y], e.base); som('fechar');
  try { await ON.mapaRecuar(e.slot, cam || [[p.x, p.y]], cam ? comprimento(cam) / VEL : 0); toast(tr('Recuando!')); setTimeout(atualizar, 300); } catch (er) { toast(er.message); }
}

// ---- território e bandeiras do clã (como as bandeiras de aliança do RoK) ----
const CUSTO_BANDEIRA = 300;
const oficial = e => e.cargo === 'lider' || e.cargo === 'colider'; // bandeira é trabalho do líder e do colíder (como no RoK)
function donoTile(tx, ty, t = agora()) { // igual ao servidor: bandeira pronta (raio 4) ou castelo (raio 5)
  for (const f of K.bandeiras) if (f.pronta <= t && Math.abs(f.x - tx) <= 4 && Math.abs(f.y - ty) <= 4) return f.cla;
  for (const c of K.castelos) if (Math.abs(Math.floor(c.x) - tx) <= 5 && Math.abs(Math.floor(c.y) - ty) <= 5) return c.id;
  return null;
}
const corCla = id => CORES_CLA[(K.clas.find(c => c.id === id)?.cor || 0) % 8];
function atualizarTerritorio() {
  K.bandeiras.sort((a, b) => a.id - b.id); const t = agora(), sig = K.bandeiras.map(f => `${f.id}${f.pronta <= t ? '+' : '-'}`).join() + '|' + K.castelos.map(c => c.id).join();
  if (sig === K.terrSig) return; K.terrSig = sig;
  // área pintada na cor do clã e a borda mais forte
  const dono = new Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) dono[y * N + x] = donoTile(x, y, t);
  const pos = [], cor = [], lp = [], lc = [], c3 = new THREE.Color(), q = (x, y) => [wx(x), wz(y)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = dono[y * N + x]; if (d == null) continue; c3.set(corCla(d));
    if (MAPA.at(x, y) !== AGUA) { const [x0, z0] = q(x, y), [x1, z1] = q(x + 1, y + 1); pos.push(x0, 0.08, z0, x1, 0.08, z0, x1, 0.08, z1, x0, 0.08, z0, x1, 0.08, z1, x0, 0.08, z1); for (let k = 0; k < 6; k++) cor.push(c3.r, c3.g, c3.b); }
    for (const [dx, dy, ax, ay, bx, by] of [[1, 0, 1, 0, 1, 1], [-1, 0, 0, 0, 0, 1], [0, 1, 0, 1, 1, 1], [0, -1, 0, 0, 1, 0]]) { const a = x + dx, b = y + dy, o = a >= 0 && b >= 0 && a < N && b < N ? dono[b * N + a] : null;
      if (o !== d) { const [p0, r0] = q(x + ax, y + ay), [p1, r1] = q(x + bx, y + by); lp.push(p0, 0.15, r0, p1, 0.15, r1); lc.push(c3.r, c3.g, c3.b, c3.r, c3.g, c3.b); } } }
  C.descartar(K.terr); K.terr = new THREE.Group();
  if (pos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
    K.terr.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4, depthWrite: false }))); }
  if (lp.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3)); K.terr.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true }))); }
  cn().add(K.terr);
  // bandeiras: mastro alto com o pano do clã; em construção fica com andaime e meio transparente
  const vivas = new Set(K.bandeiras.map(f => f.id));
  for (const [id, f] of K.flags) if (!vivas.has(id) || f.pronta !== (K.bandeiras.find(b => b.id === id).pronta <= t)) { C.descartar(f.o); K.flags.delete(id); }
  for (const b of K.bandeiras) { if (K.flags.has(b.id)) continue; const pronta = b.pronta <= t, g = new THREE.Group(), al = pronta ? 1 : 0.55;
    const m = (geo, c, x, y, z) => { const o = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c, transparent: !pronta, opacity: al, side: THREE.DoubleSide })); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    m(new THREE.CylinderGeometry(1.1, 1.4, 0.8, 8), 0x8f8a84, 0, 0.4, 0); m(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), 0x5a3a1a, 0, 3.5, 0); m(new THREE.PlaneGeometry(2.6, 1.6), corCla(b.cla), 1.35, 5.9, 0);
    if (!pronta) for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) m(new THREE.BoxGeometry(0.15, 4, 0.15), 0xb08a5a, x, 2, z);
    g.position.set(wx(b.x + 0.5), 0, wz(b.y + 0.5)); cn().add(g); K.flags.set(b.id, { o: g, pronta }); }
}
function pontoBandeira(cla, tx, ty) { // as mesmas regras do servidor, para avisar na hora
  if (!livre(tx, ty)) return 'Não dá para ir aí';
  if (K.bandeiras.some(f => Math.max(Math.abs(f.x - tx), Math.abs(f.y - ty)) < 4)) return 'muito perto de outra bandeira';
  const d = donoTile(tx, ty, agora() + 1e6); if (d != null && d !== cla) return 'território inimigo';
  const c = K.castelos.find(q => q.id === cla);
  if (!K.bandeiras.some(f => f.cla === cla && Math.max(Math.abs(f.x - tx), Math.abs(f.y - ty)) <= 9) && !(c && Math.max(Math.abs(Math.floor(c.x) - tx), Math.abs(Math.floor(c.y) - ty)) <= 10)) return 'longe do território do clã';
  return null;
}
async function erguerBandeira(e, alvo, cam) {
  const tx = Math.floor(alvo[0]), ty = Math.floor(alvo[1]), erro = pontoBandeira(e.cla, tx, ty);
  if (erro) { som('erro'); toast(tr(erro)); return; }
  if ((S.moedas || 0) < CUSTO_BANDEIRA) { som('erro'); toast(`${tr('Precisa de')} ${CUSTO_BANDEIRA} ${tr('moedas')}`); return; }
  const dur = comprimento(cam) / VEL;
  try { const r = await ON.mapaBandeira(e.slot, tx, ty, cam, dur); if (r) { som('erro'); toast(tr(r)); return; }
    S.moedas -= CUSTO_BANDEIRA; salvar(); Object.assign(e, { cam, t0: agora(), t1: agora() + dur, local: true, alvo: null }); sfx('vitoria'); toast(tr('Bandeira em construção!')); atualizar(); }
  catch (er) { toast(tr(er.message)); }
}

// ---- cerco a bandeiras e castelos inimigos (etapa 4) ----
const posAlvo = (tipo, id) => { if (tipo === 'band') { const f = K.bandeiras.find(q => q.id === id); return f && [f.x + 0.5, f.y + 0.5]; } const c = K.castelos.find(q => q.id === id); return c && [c.x, c.y]; };
const bandeiraPerto = (cla, c) => K.bandeiras.some(f => f.cla === cla && f.pronta <= agora() && Math.max(Math.abs(f.x - Math.floor(c.x)), Math.abs(f.y - Math.floor(c.y))) <= 9);
async function cercar(e, tipo, id) {
  if (emBatalha(e)) { som('erro'); toast(tr('Em batalha! Use Recuar')); return; }
  if (e.tropas <= 0) { som('erro'); toast(tr('Sem tropas: espere os feridos se recuperarem')); return; }
  const alvo = posAlvo(tipo, id); if (!alvo) return; const p = posicao(e), r = tipo === 'band' ? 1.3 : 3; let cam = null;
  for (let a = 0; a < 6.3 && !cam; a += 0.6) { const x = alvo[0] + Math.sin(a + Math.atan2(p.x - alvo[0], p.y - alvo[1])) * r, y = alvo[1] + Math.cos(a + Math.atan2(p.x - alvo[0], p.y - alvo[1])) * r; if (livre(Math.floor(x), Math.floor(y))) cam = caminho([p.x, p.y], [x, y]); }
  if (!cam || cam.length < 2) { som('erro'); toast(tr('Não dá para chegar lá')); return; }
  const dur = comprimento(cam) / VEL;
  try { const r2 = await ON.mapaCercar(e.slot, tipo, id, cam, dur); if (r2) { som('erro'); toast(tr(r2)); return; }
    Object.assign(e, { cam, t0: agora(), t1: agora() + dur, local: true, alvo: null, cerco_tipo: tipo, cerco_id: id, cercando: false }); sfx('vitoria'); toast(tipo === 'band' ? tr('Rumo à bandeira inimiga!') : tr('Ataque ao castelo!')); cards(); }
  catch (er) { toast(tr(er.message)); }
}
function infoAlvo(tipo, alvo) { // painel ao tocar numa bandeira ou castelo
  const i = $('#muInfo'), eu = meus()[0], meuCla = eu?.cla; i.hidden = false; $('#muConf').hidden = true; som('clique');
  const botoes = () => `<div class="muAtk">${meus().map(e => `<button class="btn vermelho peq" data-mu="cercar" data-slot="${e.slot}" data-tipo="${tipo}" data-alvo="${alvo.id}" ${e.tropas <= 0 || emBatalha(e) ? 'disabled' : ''}>${ico('h_lamina')} ${tr('Atacar com')} ${e.slot + 1}</button>`).join('')}</div>`;
  if (tipo === 'band') { const c = K.clas.find(q => q.id === alvo.cla);
    i.innerHTML = `<b data-nt>${ico('bandeira')} ${tr('Bandeira')} ${c ? `[${esc(c.tag)}] ${esc(c.nome)}` : ''}</b><small>${tr('Durabilidade')}: ${fmt(Math.max(0, alvo.hp))}/1000</small>
      ${meuCla == null ? `<small>${tr('Entre num clã para atacar')}</small>` : alvo.cla === meuCla ? `<small>${tr('É do seu clã')}</small>` : `${botoes()}<small class="muDica">${tr('Fique perto dela até a durabilidade zerar')}</small>`}`; return; }
  const prot = (alvo.protegido || 0) - agora();
  i.innerHTML = `<b data-nt>${ico('h_muralha')} [${esc(alvo.tag)}] ${esc(alvo.nome)}</b><small>${tr('Muralha')}: ${fmt(alvo.hp)}/${fmt(alvo.hpMax)} · ${tr('Guarnição')}: ${fmt(alvo.guarnicao || 0)}</small>
    ${meuCla == null ? `<small>${tr('Entre num clã para atacar')}</small>` : alvo.id === meuCla ? `<small>${tr('Castelo do seu clã')}</small>` : prot > 0 ? `<small class="muBreve">${tr('Protegido por')} ${tempoTxt(prot)}</small>`
      : !bandeiraPerto(meuCla, alvo) ? `<small class="muBreve">${tr('Precisa de uma bandeira do seu clã perto do castelo')}</small>` : `${botoes()}<small class="muDica">${tr('Vença a guarnição e derrube a muralha. Juntem vários exércitos!')}</small>`}`;
}

// ---- interface ----
const corDe = e => e.cla != null ? CORES_CLA[(K.clas.find(c => c.id === e.cla)?.cor || 0) % 8] : 0xd8d8d8;
const meus = () => [...K.ex.values()].filter(e => e.eu).sort((a, b) => a.slot - b.slot);
const tempoTxt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const TIPOS = { esp: { nome: 'Espadachins', icone: 'h_lamina' }, arc: { nome: 'Arqueiros', icone: 'arq' }, lan: { nome: 'Lanceiros', icone: 'h_perfura' } };
function estadoTxt(e) {
  const p = posicao(e), b = emBatalha(e); if (b) return `<b class="muLuta">${tr('Em batalha!')}</b>`;
  if (e.tropas <= 0) return tr('Derrotado: se recuperando');
  if (e.cercando) return `<b class="muLuta">${e.cerco_tipo === 'band' ? tr('Cercando bandeira') : tr('Cercando castelo')}</b>`;
  if (p.anda) return `${e.alvo || e.cerco_tipo ? tr('Atacando') : tr('Marchando')} ${tempoTxt(p.falta)}`;
  return naBase(e, p) ? tr('Na base') : tr('Parado');
}
function cards() {
  const b = $('#muExs'); if (!b) return; const H = HEROIS[S.heroi] || HEROIS.lyra;
  b.innerHTML = meus().map(e => { const T0 = TIPOS[e.tipo] || TIPOS.esp, bat = emBatalha(e), rec = (e.feridos || 0) + (e.mortos || 0);
    return `<div class="muEx ${K.sel === e.id ? 'sel' : ''}"><button class="muExI" data-mu-tipo="${e.id}" title="${tr(T0.nome)}">${ico(T0.icone)}</button><button class="muExD" data-mu-ex="${e.id}"><b>${tr('Exército')} ${e.slot + 1} <small>${H.nome}</small></b>
      <small>${ico('forca')} <span data-mu-n="${e.id}">${fmt(tropasAgora(e))}</span>/${fmt(e.cap || e.tropas)}${rec ? ` · <i class="muFer">+${fmt(rec)} ${tr('feridos')}</i>` : ''}</small>
      <em data-mu-t="${e.id}">${estadoTxt(e)}</em></button>${bat ? `<button class="btn vermelho peq" data-mu="recuar" data-slot="${e.slot}">${tr('Recuar')}</button>` : ''}</div>`; }).join('');
}
function toast(t) { const a = $('#muAviso'); if (!a) return; a.hidden = false; a.textContent = t; clearTimeout(K.tToast); K.tToast = setTimeout(() => { if (K?.carregou) a.hidden = true; }, 1800); }
function selecionar(id) {
  K.sel = K.sel === id ? null : id; K.prev = null; $('#muConf').hidden = true; $('#muInfo').hidden = true; som('clique');
  const e = K.ex.get(K.sel); if (e) { const p = posicao(e); K.cam = { x: wx(p.x), z: wz(p.y) + 10 }; toast(tr('Toque no mapa ou num inimigo')); } cards();
}
function tocar(sx, sy) {
  let perto = null, dm = 34; for (const e of K.ex.values()) { const p = posicao(e), q = C.tela(wx(p.x), 1.5, wz(p.y)); if (!q) continue; const d = Math.hypot(q[0] - sx, q[1] - sy); if (d < dm) { dm = d; perto = e; } }
  if (perto?.eu) { selecionar(perto.id); return; }
  if (!perto) { let alvo = null, tipo = null, da = 40;
    for (const f of K.bandeiras) { const q = C.tela(wx(f.x + 0.5), 3, wz(f.y + 0.5)); if (q) { const d = Math.hypot(q[0] - sx, q[1] - sy); if (d < da) { da = d; alvo = f; tipo = 'band'; } } }
    for (const c of K.castelos) { const q = C.tela(wx(c.x), 4, wz(c.y)); if (q) { const d = Math.hypot(q[0] - sx, q[1] - sy); if (d < Math.max(da, 46)) { da = d; alvo = c; tipo = 'cast'; } } }
    if (alvo && !(K.sel && tipo === 'band' && alvo.cla === meus()[0]?.cla)) { infoAlvo(tipo, alvo); return; } }
  if (perto) { const c = K.clas.find(q => q.id === perto.cla), i = $('#muInfo'), amigo = meus()[0]?.cla != null && perto.cla === meus()[0].cla, T0 = TIPOS[perto.tipo] || TIPOS.esp; i.hidden = false; $('#muConf').hidden = true; som('clique');
    i.innerHTML = `<b data-nt>${c ? `[${esc(c.tag)}] ` : ''}${esc(perto.nome)}</b><small>${ico(T0.icone)} ${fmt(tropasAgora(perto))} ${tr(T0.nome).toLowerCase()} · ${HEROIS[perto.heroi]?.nome || ''}</small>
      ${amigo ? `<small>${tr('É do seu clã')}</small>` : emBatalha(perto) ? `<small class="muBreve">${tr('Já está em batalha')}</small>` : `<div class="muAtk">${meus().map(e => `<button class="btn vermelho peq" data-mu="atacar" data-slot="${e.slot}" data-alvo="${perto.id}" ${e.tropas <= 0 || emBatalha(e) ? 'disabled' : ''}>${ico('h_lamina')} ${tr('Atacar com')} ${e.slot + 1}</button>`).join('')}</div>
      <small class="muDica">${tr('Espadachim vence arqueiro, arqueiro vence lanceiro, lanceiro vence espadachim')}</small>`}`; return; }
  const e = K.ex.get(K.sel); if (!e) { $('#muInfo').hidden = true; return; }
  const g = C.chaoEm(sx, sy); if (!g) return; const alvo = [(g.x - WX) / T + N / 2, (g.z - WZ) / T + N / 2];
  if (!livre(Math.floor(alvo[0]), Math.floor(alvo[1]))) { som('erro'); toast(tr('Não dá para ir aí')); return; }
  const p = posicao(e), cam = caminho([p.x, p.y], alvo); if (!cam) { som('erro'); toast(tr('Não dá para chegar lá')); return; }
  K.prev = { e, alvo, cam }; mostrarLinha(cam, 0xffffff); som('clique');
  const c = $('#muConf'); c.hidden = false; c.innerHTML = `<button class="btn verde" data-mu="marchar">${ico('seta')} ${tr('Marchar')} · ${tempoTxt(comprimento(cam) / VEL)}</button>
    ${e.cla != null && oficial(e) ? `<button class="btn amarelo" data-mu="bandeira">${ico('bandeira')} ${CUSTO_BANDEIRA}${ico('ouro')}</button>` : ''}<button class="btn cinza peq" data-mu="cancelar">${ico('fechar')}</button>
    ${e.cla == null ? `<small class="muSemCla">${tr('Entre num clã para erguer bandeiras')}</small>` : !oficial(e) ? `<small class="muSemCla">${tr('Só o líder e o colíder erguem bandeiras')}</small>` : ''}`;
}
function mostrarLinha(cam, cor) {
  C.descartar(K.linha); const pts = cam.map(p => new THREE.Vector3(wx(p[0]), 0.35, wz(p[1])));
  K.linha = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: cor, dashSize: 1.2, gapSize: 0.8 })); K.linha.computeLineDistances(); cn().add(K.linha);
}
function mostrarRelatorios(lista) { // relatório de batalha (como o "battle report" do RoK)
  const j = $('#muRel'); if (!j) return; j.hidden = false; let venceu = false;
  j.innerHTML = `<div class="cqFim muRelC"><h2>${ico('pergaminho')} ${tr('Relatório')}</h2>${lista.slice(-4).map(({ dados: d }) => {
    if (d.tipo === 'guarnicao') { venceu ||= d.venceu; return `<div class="muRelL ${d.venceu ? 'vit' : 'der'}"><b>${d.venceu ? tr('GUARNIÇÃO VENCIDA') : tr('DERROTA')}</b> · ${tr('castelo de')} <b data-nt>${esc(d.contra)}</b>
      <small>${tr('Exército')} ${d.slot + 1}: ${fmt(d.eu0)} → ${fmt(d.eu1)} · ${tr('guarnição')} ${fmt(d.ele0)} → ${fmt(d.ele1)}</small>${d.venceu ? `<small>${tr('Agora o cerco começa: derrubem a muralha!')}</small>` : ''}</div>`; }
    if (d.tipo === 'defesa') return `<div class="muRelL der"><b>${tr('CASTELO ATACADO')}</b> · <b data-nt>${esc(d.contra)}</b> ${tr('atacou a guarnição')} <small>${tr('Guarnição')}: -${fmt(d.perdeu)} (${tr('restam')} ${fmt(d.resta)})</small></div>`;
    if (d.tipo === 'bandeira') { venceu ||= d.derrubou; return `<div class="muRelL ${d.derrubou ? 'vit' : 'der'}"><b>${d.derrubou ? tr('BANDEIRA DERRUBADA!') : tr('PERDEMOS UMA BANDEIRA')}</b> · <b data-nt>${esc(d.cla || '')}</b></div>`; }
    if (d.tipo === 'castelo') { venceu ||= d.conquistou; return `<div class="muRelL ${d.conquistou ? 'vit' : 'der'}"><b>${d.conquistou ? tr('CASTELO CONQUISTADO!') + ' 👑 +2000 ' + tr('pontos') : tr('NOSSO CASTELO CAIU!')}</b> · <b data-nt>${esc(d.cla || '')}</b></div>`; }
    if (d.tipo === 'fugiu') return `<div class="muRelL">${tr('Exército')} ${d.slot + 1}: <b data-nt>${esc(d.nome)}</b> ${tr('escapou antes do ataque')}</div>`;
    venceu ||= d.venceu; const perdi = d.eu0 - d.eu1, matei = d.ele0 - d.ele1;
    return `<div class="muRelL ${d.venceu ? 'vit' : 'der'}"><b>${d.venceu ? tr('VITÓRIA') : d.recuou ? tr('RECUO') : tr('DERROTA')}</b> · ${d.ataque ? tr('você atacou') : tr('você foi atacado por')} <b data-nt>${esc(d.contra)}</b>
      <small>${tr('Exército')} ${d.slot + 1}: ${fmt(d.eu0)} → ${fmt(d.eu1)} (${tr('feridos')} ${fmt(Math.round(perdi * 0.8))}, ${tr('mortos')} ${fmt(perdi - Math.round(perdi * 0.8))})</small>
      <small>${tr('Inimigos derrotados')}: ${fmt(matei)} · +${fmt(matei)} ${tr('pontos')}</small></div>`; }).join('')}
    <button class="btn verde grande" data-mu="relOk">OK</button></div>`;
  sfx(venceu ? 'vitoria' : 'derrota'); ON.mapaLidos().catch(() => {});
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function clique(b) {
  const a = b.dataset.mu, tp = b.dataset.muTipo, ex = b.dataset.muEx;
  if (tp) { const e = K.ex.get(+tp); if (!e || emBatalha(e)) { som('erro'); return; } const ks = Object.keys(TIPOS); e.tipo = ks[(ks.indexOf(e.tipo) + 1) % ks.length]; som('clique'); toast(tr(TIPOS[e.tipo].nome)); ON.mapaTipo(e.slot, e.tipo).catch(() => {}); cards(); return; }
  if (a === 'sair') { som('fechar'); op.sair(); return; }
  if (a === 'relOk') { som('clique'); $('#muRel').hidden = true; return; }
  if (a === 'recuar') { const e = meus().find(q => q.slot === +b.dataset.slot); if (e) recuar(e); return; }
  if (a === 'cercar') { const e = meus().find(q => q.slot === +b.dataset.slot); $('#muInfo').hidden = true; if (e) { K.sel = e.id; cercar(e, b.dataset.tipo, +b.dataset.alvo); } return; }
  if (a === 'atacar') { const e = meus().find(q => q.slot === +b.dataset.slot), alvo = K.ex.get(+b.dataset.alvo); $('#muInfo').hidden = true; if (e && alvo) { K.sel = e.id; atacar(e, alvo); } return; }
  if (a === 'cancelar') { K.prev = null; $('#muConf').hidden = true; C.descartar(K.linha); K.linha = null; som('fechar'); return; }
  if (a === 'bandeira' && K.prev) { const { e, alvo, cam } = K.prev; K.prev = null; $('#muConf').hidden = true; C.descartar(K.linha); K.linha = null; erguerBandeira(e, alvo, cam); return; }
  if (a === 'marchar' && K.prev) { const { e, alvo } = K.prev; K.prev = null; $('#muConf').hidden = true; C.descartar(K.linha); K.linha = null; marchar(e, alvo); return; }
  if (ex) selecionar(+ex);
}
// arrastar = mover a câmera; dois dedos (ou a roda do mouse) = zoom; tocar = escolher
let toqueEl = null;
const dn = e => { if (!K) return; K.toques.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() }); try { toqueEl.setPointerCapture(e.pointerId); } catch (er) {} if (K.toques.size === 2) K.pinca = null; };
const mv = e => { const P = K?.toques.get(e.pointerId); if (!P) return; const dx = e.clientX - P.x, dy = e.clientY - P.y; P.x = e.clientX; P.y = e.clientY;
  if (K.toques.size === 2) { const [a, b] = [...K.toques.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (K.pinca) K.zoom = Math.max(40, Math.min(170, K.zoom * K.pinca / d)); K.pinca = d; return; }
  if (!K.cam) return; const k = K.zoom / innerHeight * 1.1; K.cam.x -= dx * k; K.cam.z -= dy * k * 1.3; };
const up = e => { const P = K?.toques.get(e.pointerId); if (!P) return; K.toques.delete(e.pointerId);
  if (Math.hypot(e.clientX - P.x0, e.clientY - P.y0) < 9 && performance.now() - P.t < 450 && !K.toques.size) tocar(e.clientX, e.clientY); };
const roda = e => { if (K) K.zoom = Math.max(40, Math.min(170, K.zoom * (e.deltaY > 0 ? 1.1 : 0.9))); };
function ligarToque() { toqueEl = $('#toque'); toqueEl.addEventListener('pointerdown', dn); toqueEl.addEventListener('pointermove', mv); toqueEl.addEventListener('pointerup', up); toqueEl.addEventListener('pointercancel', up); toqueEl.addEventListener('wheel', roda, { passive: true }); }
function desligarToque() { if (!toqueEl) return; for (const [ev, f] of [['pointerdown', dn], ['pointermove', mv], ['pointerup', up], ['pointercancel', up], ['wheel', roda]]) toqueEl.removeEventListener(ev, f); toqueEl = null; }

// ---- laço ----
const SOLD = { esp: 'az', arc: 'arco', lan: 'lanca' };
function passoBatalhas() { // efeitos de cada segundo da luta: faíscas, números e a habilidade do comandante
  for (const b of K.bat.values()) {
    const a = K.ex.get(b.a), cast = b.b < 0 && K.castelos.find(c => c.id === -b.b), d = cast ? { id: b.b, heroi: 'grom', castelo: cast } : K.ex.get(b.b); if (!a || !d) continue; const k = Math.floor(agora() - b.t0);
    if (k < 1 || k <= b.visto || k >= b.linha.length || agora() > b.fim) continue; b.visto = k;
    const pa = posicao(a), pd = d.castelo ? { x: d.castelo.x, y: d.castelo.y } : posicao(d), mx = wx((pa.x + pd.x) / 2), mz = wz((pa.y + pd.y) / 2), [ta, tb, ev] = b.linha[k], [ta0, tb0] = b.linha[k - 1];
    C.faiscas(mx, 1.5, mz, 0xffe0a0, 8, 4);
    if (ta0 - ta > 0) K.txt.push({ x: wx(pa.x), z: wz(pa.y), y: 4, txt: `-${ta0 - ta}`, cor: '#ff6a5a', t: 0 });
    if (tb0 - tb > 0) K.txt.push({ x: wx(pd.x), z: wz(pd.y), y: 4, txt: `-${tb0 - tb}`, cor: '#ff6a5a', t: 0 });
    for (const [bit, e, p] of [[1, a, pa], [2, d, pd]]) if (ev & bit) { const H = HEROIS[e.heroi] || HEROIS.lyra; C.onda(wx(p.x), wz(p.y), 6, 0xffd84a, 0.6); C.faiscas(wx(p.x), 3, wz(p.y), 0xffd84a, 30, 6);
      K.txt.push({ x: wx(p.x), z: wz(p.y), y: 7, txt: `${H.poder?.nome || tr('Fúria')}!`, cor: '#ffd84a', t: 0, grande: true }); if (e.eu || (e === a ? d : a).eu) sfx('magia'); }
    if (k === b.linha.length - 1 && (a.eu || d.eu)) { const euA = a.eu, ganhei = euA ? tb === 0 : ta === 0; if (ganhei) { sfx('vitoria'); flashTela('#ffe27a', 0.3); } setTimeout(atualizar, 1500); }
  }
}
export function passo(dt) {
  if (!K) return; dt = Math.min(dt, 0.1); const t = C.tempo();
  if ((K.tPoll -= dt) <= 0) { K.tPoll = 4; atualizar(); }
  if (!K.carregou) return;
  if (K.cam) { K.cam.x = Math.max(wx(0), Math.min(wx(N), K.cam.x)); K.cam.z = Math.max(wz(0) + 10, Math.min(wz(N) + 18, K.cam.z)); }
  passoBatalhas(); if ((K.tTerr = (K.tTerr || 0) - dt) <= 0) { K.tTerr = 1; atualizarTerritorio(); }
  const az = [], vm = [], meuCla = meus()[0]?.cla;
  for (const e of K.ex.values()) {
    const p = posicao(e), x = wx(p.x), z = wz(p.y), amigo = e.eu || (meuCla != null && e.cla === meuCla), b = emBatalha(e), n0 = tropasAgora(e);
    let dir = p.dir; if (b) { const oid = b.a === e.id ? b.b : b.a, o = oid < 0 ? K.castelos.find(c => c.id === -oid) : K.ex.get(oid); if (o) { const q = oid < 0 ? o : posicao(o); dir = Math.atan2(q.x - p.x, q.y - p.y); } }
    if (e.cercando) { const al = posAlvo(e.cerco_tipo, e.cerco_id); if (al) dir = Math.atan2(al[0] - p.x, al[1] - p.y); if (al && Math.random() < dt * 2) C.faiscas(wx(al[0]), 2, wz(al[1]), 0xffc070, 5, 3); }
    if (!e.flag) e.flag = bandeira(corDe(e));
    e.dir = e.dir == null ? dir : e.dir + Math.atan2(Math.sin(dir - e.dir), Math.cos(dir - e.dir)) * Math.min(1, dt * 8);
    e.flag.position.set(x - Math.sin(e.dir) * 1.6, 0, z - Math.cos(e.dir) * 1.6); e.flag.visible = n0 > 0;
    if (e.eu && !e.v) { const H = HEROIS[S.heroi] || HEROIS.lyra; e.v = C.heroi(H.visual); e.v.raiz.scale.setScalar(1.6); }
    if (e.v) { e.v.raiz.visible = n0 > 0 || p.anda; e.v.raiz.position.set(x, 0, z); e.v.raiz.rotation.y = e.dir; e.v.mixer.update(dt);
      const an = b || e.cercando ? (Math.floor(t * 1.5) % 2 ? 'Melee_1H_Attack_Chop' : 'Idle_A') : p.anda ? 'Running_A' : 'Idle_A'; if (e.anim !== an) { e.anim = an; e.v.tocar(e.v.tem(an) ? an : 'Idle_A', b || e.cercando ? { loop: false, reinicia: true } : undefined); } }
    // soldados em fileiras atrás do comandante (na batalha, na frente dele, lutando)
    if (n0 <= 0) continue;
    const n = Math.min(9, 2 + Math.ceil(n0 / 60)), s = Math.sin(e.dir), c = Math.cos(e.dir), lista = amigo ? az : vm, tipo = SOLD[e.tipo] || 'az';
    for (let i = 0; i < n; i++) { const fila = 1 + Math.floor(i / 3), col = (i % 3) - 1, ox = col * 1.1, oz = b || e.cercando ? 0.9 + (fila - 1) * 0.9 : -fila * 1.15 - (e.v ? 0.4 : -0.8);
      lista.push({ x: x + ox * c + oz * s, z: z - ox * s + oz * c, ph: e.id * 1.7 + i * 0.9 + (p.anda ? 0 : 99), ry: e.dir, tipo, luta: !!b || !!e.cercando }); }
    if (e.eu && p.anda) { if (e.linhaCam !== e.cam) { C.descartar(e.linha); const pts = e.cam.map(q => new THREE.Vector3(wx(q[0]), 0.3, wz(q[1]))); e.linha = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: e.alvo ? 0xff5a4a : 0xffd84a, dashSize: 1, gapSize: 0.7 })); e.linha.computeLineDistances(); cn().add(e.linha); e.linhaCam = e.cam; } }
    else if (e.linha) { C.descartar(e.linha); e.linha = null; e.linhaCam = null; }
  }
  desenharTropas('az', az, 0, t); desenharTropas('vm', vm, 0, t);
  if ((K.tCards = (K.tCards || 0) - dt) <= 0) { K.tCards = 0.5; for (const e of meus()) { const m = document.querySelector(`[data-mu-t="${e.id}"]`), nn = document.querySelector(`[data-mu-n="${e.id}"]`); if (nn) nn.textContent = fmt(tropasAgora(e));
    if (m) { const h = estadoTxt(e); if (m.innerHTML !== h) { m.innerHTML = h; if (!!emBatalha(e) !== !!document.querySelector(`[data-mu=recuar][data-slot="${e.slot}"]`)) cards(); } } } }
}
export function vista() { return { foco: K?.cam || { x: WX, z: WZ }, yaw: Math.PI, pitch: 0.95, dist: K?.zoom || 95 }; }
export function desenharFx(g, dt) {
  if (!K?.carregou) return; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.65)';
  for (const c of K.castelos) { const q = C.tela(wx(c.x), 13, wz(c.y)); if (!q || q[1] < 60) continue; g.font = '14px Titulo, sans-serif'; const t = `[${c.tag}] ${c.nome}`; g.strokeText(t, q[0], q[1]); g.fillStyle = '#' + CORES_CLA[(c.cor || 0) % 8].toString(16).padStart(6, '0'); g.fillText(t, q[0], q[1]); }
  if (K.zoom <= 130) for (const e of K.ex.values()) { const p = posicao(e), q = C.tela(wx(p.x), 4.2, wz(p.y)), n0 = tropasAgora(e); if (!q || q[1] < 60 || q[1] > innerHeight - 90 || (n0 <= 0 && !p.anda)) continue; const b = emBatalha(e);
    if (e.eu) { g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(q[0], q[1] - 4, 9, 0, 7); g.fill(); g.stroke(); g.font = '13px Titulo, sans-serif'; g.fillStyle = '#3a1a08'; g.fillText(e.slot + 1, q[0], q[1] + 1); g.strokeStyle = 'rgba(0,0,0,.65)'; }
    else { g.font = '11px Titulo, sans-serif'; g.strokeText(e.nome, q[0], q[1]); g.fillStyle = '#fff'; g.fillText(e.nome, q[0], q[1]); }
    if (b || !e.eu) { const w = 40, f = Math.max(0, n0 / Math.max(1, e.cap || n0)); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(q[0] - w / 2 - 1, q[1] + 6, w + 2, 6); g.fillStyle = e.eu ? '#4ae86a' : '#ff5a4a'; g.fillRect(q[0] - w / 2, q[1] + 7, w * f, 4);
      g.font = '10px Titulo, sans-serif'; g.fillStyle = '#fff'; g.strokeText(fmt(n0), q[0], q[1] + 22); g.fillText(fmt(n0), q[0], q[1] + 22); }
    if (K.sel === e.id) { g.strokeStyle = '#ffd84a'; g.lineWidth = 3; g.beginPath(); g.arc(q[0], q[1] + 26, 18, 0, 7); g.stroke(); g.strokeStyle = 'rgba(0,0,0,.65)'; } }
  for (const b of K.bandeiras) if (b.hp < 1000 && b.pronta <= agora()) { const q = C.tela(wx(b.x + 0.5), 8, wz(b.y + 0.5)); if (!q) continue; const w = 44;
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(q[0] - w / 2 - 1, q[1] - 1, w + 2, 7); g.fillStyle = '#ffb03a'; g.fillRect(q[0] - w / 2, q[1], w * Math.max(0, b.hp) / 1000, 5); }
  for (const c of K.castelos) { const q = C.tela(wx(c.x), 13, wz(c.y)); if (!q || q[1] < 60) continue; const prot = (c.protegido || 0) - agora();
    if (prot > 0) { g.font = '12px Titulo, sans-serif'; const t = `🔥 ${tr('Protegido')} ${tempoTxt(prot)}`; g.strokeText(t, q[0], q[1] + 16); g.fillStyle = '#ffb03a'; g.fillText(t, q[0], q[1] + 16); }
    else if (c.hp < c.hpMax) { const w = 70; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(q[0] - w / 2 - 1, q[1] + 8, w + 2, 8); g.fillStyle = '#ff5a4a'; g.fillRect(q[0] - w / 2, q[1] + 9, w * c.hp / c.hpMax, 6); } }
  for (const b of K.bandeiras) { const falta = b.pronta - agora(); if (falta <= 0 || b.id < 0) continue; const q = C.tela(wx(b.x + 0.5), 8, wz(b.y + 0.5)); if (!q) continue;
    g.font = '12px Titulo, sans-serif'; const t = `${tr('Construindo')} ${tempoTxt(falta)}`; g.strokeText(t, q[0], q[1]); g.fillStyle = '#ffd84a'; g.fillText(t, q[0], q[1]); }
  for (const t of K.txt) { t.t += dt; const p = C.tela(t.x, t.y + t.t * 3, t.z); if (!p) continue; g.globalAlpha = Math.max(0, 1 - t.t / 1); g.font = `${t.grande ? 18 : 14}px Titulo, sans-serif`; g.strokeText(t.txt, p[0], p[1]); g.fillStyle = t.cor; g.fillText(t.txt, p[0], p[1]); g.globalAlpha = 1; }
  K.txt = K.txt.filter(t => t.t < 1);
}
window.__mu = { K: () => K, caminho, gerarMapa }; // testes
