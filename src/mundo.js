// Mapa de Guerra (etapa 1): um mapa só para todos os jogadores. Cada um tem 2 exércitos comandados pelo herói,
// que marcham em tempo real (o servidor guarda o caminho e a hora da saída; cada celular calcula onde o exército está).
// O terreno é gerado igual em todo celular (mesma semente); quem está com o mapa aberto também dá as ordens dos bots.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as C from './cena.js';
import { S } from './meta.js';
import { HEROIS } from './herois.js';
import { fmt } from './dados.js';
import { desenharTropas } from './tropas.js';
import { ico, som, $ } from './util.js';
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
  if (!e.cam || e.cam.length < 2) { const b = e.base || baseDe(e); return { x: b[0], y: b[1], dir: 0, anda: false, fim: true }; }
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
  K = { ex: new Map(), clas: [], castelos: [], livresSitios: [], dif: 0, sel: null, prev: null, zoom: 95, cam: null, toques: new Map(), arrasto: null, tPoll: 0, carregou: false, txt: [], erro: '' };
  C.ceu(0x9ad8f8); C.neblina(180, 520); C.diaNoite(0);
  el.innerHTML = `<div class="muTopo"><button class="lSair" data-mu="sair">${ico('fechar')}</button><b>${tr('Mapa de Guerra')}</b><small id="muOn"></small></div>
    <div class="muAviso" id="muAviso">${tr('Carregando o mapa...')}</div>
    <div class="muConf" id="muConf" hidden></div><div class="muInfo" id="muInfo" hidden></div><div class="muExs" id="muExs"></div>`;
  ligarToque(); atualizar(true);
}
export function fechar() {
  if (K) { for (const e of K.ex.values()) limparEx(e); for (const g of K.cena || []) cn().remove(g); if (K.linha) cn().remove(K.linha); desenharTropas('az', [], 0, 0); desenharTropas('vm', [], 0, 0); }
  desligarToque(); K = null; if (el) { el.hidden = true; el.innerHTML = ''; }
}
function limparEx(e) { if (e.flag) cn().remove(e.flag); e.v?.remover(); if (e.linha) cn().remove(e.linha); }

// ---- servidor ----
function minhasTropas() { const up = S.up || {}; return Math.round(60 + 30 * (up.exercito || 0) + 8 * (up.vida || 0) + (S.equipe || []).length * 15); }
async function atualizar(primeira) {
  if (!K || K.buscando) return; K.buscando = true;
  try {
    const r = await ON.mapaEstado(S.heroi || 'lyra', minhasTropas()); if (!K) return;
    K.dif = r.agora - Date.now() / 1000; K.erro = '';
    if (!K.carregou || JSON.stringify(r.clas) !== K.clasSig) { K.clasSig = JSON.stringify(r.clas); K.clas = r.clas; bases(); if (!K.carregou) { K.cena = montarTerreno(); } }
    const vistos = new Set();
    for (const d of r.exercitos) { vistos.add(d.id); let e = K.ex.get(d.id);
      if (!e) { e = { ...d }; K.ex.set(d.id, e); } else if (!(e.eu && e.local && e.t0 > d.t0)) Object.assign(e, d); // a ordem que acabei de dar vale até o servidor confirmar
      e.base = baseDe(e); }
    for (const [id, e] of K.ex) if (!vistos.has(id)) { limparEx(e); K.ex.delete(id); }
    if (!K.carregou) { K.carregou = true; $('#muAviso').hidden = true; const m = [...K.ex.values()].find(e => e.eu); if (m) { const p = posicao(m); K.cam = { x: wx(p.x), z: wz(p.y) + 10 }; } }
    $('#muOn').textContent = `${[...K.ex.values()].filter(e => !e.bot).length / 2 | 0} ${tr('jogadores')} · ${[...K.ex.values()].filter(e => e.bot).length} bots`;
    darOrdensBots(r.livres || []); cards();
  } catch (e) { if (K) { K.erro = e.message; const a = $('#muAviso'); if (a && !K.carregou) a.textContent = tr('Sem conexão com o mapa') + ' 😢'; } }
  finally { if (K) K.buscando = false; }
}
function darOrdensBots(ids) { // bots andam pelo mapa: às vezes perto de casa, às vezes rumo a outro castelo
  const ordens = [];
  for (const id of ids.slice(0, 4)) { const e = K.ex.get(id); if (!e) continue; const p = posicao(e), r = Math.random(); let alvo = null;
    for (let k = 0; k < 12 && !alvo; k++) { let x, y;
      if (r < 0.2 && K.castelos.length) { const c = K.castelos[Math.floor(Math.random() * K.castelos.length)]; x = c.x + (Math.random() - 0.5) * 6; y = c.y + (Math.random() - 0.5) * 6; }
      else if (r < 0.4) { [x, y] = e.base; }
      else { x = p.x + (Math.random() - 0.5) * 22; y = p.y + (Math.random() - 0.5) * 22; }
      if (livre(Math.floor(x), Math.floor(y))) alvo = [x, y]; }
    if (!alvo) continue; const cam = caminho([p.x, p.y], alvo); if (!cam || cam.length < 2) continue;
    const dur = comprimento(cam) / VEL; ordens.push({ id, cam, dur }); Object.assign(e, { cam, t0: agora(), t1: agora() + dur }); }
  if (ordens.length) ON.mapaBots(ordens).catch(() => {});
}
async function marchar(e, alvo) {
  const p = posicao(e), cam = caminho([p.x, p.y], alvo); if (!cam || cam.length < 2) { som('erro'); toast(tr('Não dá para chegar lá')); return; }
  const dur = comprimento(cam) / VEL; Object.assign(e, { cam, t0: agora(), t1: agora() + dur, local: true }); sfx('brilho'); som('confirma');
  try { const t0 = await ON.mapaMarchar(e.slot, cam, dur); if (K && e.cam === cam) e.t0 = t0; } catch (er) { toast(er.message); }
  cards();
}

// ---- interface ----
const corDe = e => e.cla != null ? CORES_CLA[(K.clas.find(c => c.id === e.cla)?.cor || 0) % 8] : 0xd8d8d8;
const meus = () => [...K.ex.values()].filter(e => e.eu).sort((a, b) => a.slot - b.slot);
const tempoTxt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function cards() {
  const b = $('#muExs'); if (!b) return; const H = HEROIS[S.heroi] || HEROIS.lyra;
  b.innerHTML = meus().map(e => { const p = posicao(e), casa = Math.hypot(p.x - e.base[0], p.y - e.base[1]) < 1.5;
    return `<button class="muEx ${K.sel === e.id ? 'sel' : ''}" data-mu-ex="${e.id}"><span class="muExI">${ico('herois')}</span><div><b>${tr('Exército')} ${e.slot + 1}</b><small>${H.nome} · ${fmt(e.tropas)} ${ico('forca')}</small>
      <em data-mu-t="${e.id}">${p.anda ? `${tr('Marchando')} ${tempoTxt(p.falta)}` : casa ? tr('Na base') : tr('Parado')}</em></div></button>`; }).join('');
}
function toast(t) { const a = $('#muAviso'); if (!a) return; a.hidden = false; a.textContent = t; clearTimeout(K.tToast); K.tToast = setTimeout(() => { if (K?.carregou) a.hidden = true; }, 1800); }
function selecionar(id) {
  K.sel = K.sel === id ? null : id; K.prev = null; $('#muConf').hidden = true; $('#muInfo').hidden = true; som('clique');
  const e = K.ex.get(K.sel); if (e) { const p = posicao(e); K.cam = { x: wx(p.x), z: wz(p.y) + 10 }; toast(tr('Toque no mapa para onde o exército vai')); } cards();
}
function tocar(sx, sy) {
  // tocou num exército?
  let perto = null, dm = 34; for (const e of K.ex.values()) { const p = posicao(e), q = C.tela(wx(p.x), 1.5, wz(p.y)); if (!q) continue; const d = Math.hypot(q[0] - sx, q[1] - sy); if (d < dm) { dm = d; perto = e; } }
  if (perto?.eu) { selecionar(perto.id); return; }
  if (perto) { const c = K.clas.find(q => q.id === perto.cla), i = $('#muInfo'); i.hidden = false; $('#muConf').hidden = true; som('clique');
    i.innerHTML = `<b data-nt>${c ? `[${esc(c.tag)}] ` : ''}${esc(perto.nome)}</b><small>${fmt(perto.tropas)} ${tr('soldados')} · ${HEROIS[perto.heroi]?.nome || ''}</small><small class="muBreve">${tr('Ataques chegam na próxima etapa!')}</small>`; return; }
  const e = K.ex.get(K.sel); if (!e) { $('#muInfo').hidden = true; return; }
  const g = C.chaoEm(sx, sy); if (!g) return; const alvo = [(g.x - WX) / T + N / 2, (g.z - WZ) / T + N / 2];
  if (!livre(Math.floor(alvo[0]), Math.floor(alvo[1]))) { som('erro'); toast(tr('Não dá para ir aí')); return; }
  const p = posicao(e), cam = caminho([p.x, p.y], alvo); if (!cam) { som('erro'); toast(tr('Não dá para chegar lá')); return; }
  K.prev = { e, alvo, cam }; mostrarLinha(cam, 0xffffff); som('clique');
  const c = $('#muConf'); c.hidden = false; c.innerHTML = `<button class="btn verde" data-mu="marchar">${ico('seta')} ${tr('Marchar')} · ${tempoTxt(comprimento(cam) / VEL)}</button><button class="btn cinza peq" data-mu="cancelar">${ico('fechar')}</button>`;
}
function mostrarLinha(cam, cor) {
  if (K.linha) cn().remove(K.linha); const pts = cam.map(p => new THREE.Vector3(wx(p[0]), 0.35, wz(p[1])));
  K.linha = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: cor, dashSize: 1.2, gapSize: 0.8 })); K.linha.computeLineDistances(); cn().add(K.linha);
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function clique(b) {
  const a = b.dataset.mu, ex = b.dataset.muEx;
  if (ex) { selecionar(+ex); return; }
  if (a === 'sair') { som('fechar'); op.sair(); }
  if (a === 'cancelar') { K.prev = null; $('#muConf').hidden = true; if (K.linha) { cn().remove(K.linha); K.linha = null; } som('fechar'); }
  if (a === 'marchar' && K.prev) { const { e, alvo } = K.prev; K.prev = null; $('#muConf').hidden = true; if (K.linha) { cn().remove(K.linha); K.linha = null; } marchar(e, alvo); }
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
export function passo(dt) {
  if (!K) return; dt = Math.min(dt, 0.1); const t = C.tempo();
  if ((K.tPoll -= dt) <= 0) { K.tPoll = 4; atualizar(); }
  if (!K.carregou) return;
  if (K.cam) { K.cam.x = Math.max(wx(0), Math.min(wx(N), K.cam.x)); K.cam.z = Math.max(wz(0) + 10, Math.min(wz(N) + 18, K.cam.z)); }
  const az = [], vm = [], meuCla = meus()[0]?.cla;
  for (const e of K.ex.values()) {
    const p = posicao(e), x = wx(p.x), z = wz(p.y), amigo = e.eu || (meuCla != null && e.cla === meuCla);
    if (!e.flag) e.flag = bandeira(corDe(e));
    e.dir = e.dir == null ? p.dir : e.dir + Math.atan2(Math.sin(p.dir - e.dir), Math.cos(p.dir - e.dir)) * Math.min(1, dt * 8);
    e.flag.position.set(x - Math.sin(e.dir) * 1.6, 0, z - Math.cos(e.dir) * 1.6);
    if (e.eu && !e.v) { const H = HEROIS[S.heroi] || HEROIS.lyra; e.v = C.heroi(H.visual); e.v.raiz.scale.setScalar(1.6); }
    if (e.v) { e.v.raiz.position.set(x, 0, z); e.v.raiz.rotation.y = e.dir; e.v.mixer.update(dt); const an = p.anda ? 'Running_A' : 'Idle_A'; if (e.anim !== an) { e.anim = an; e.v.tocar(an); } }
    // soldados em fileiras atrás do comandante
    const n = Math.min(9, 3 + Math.floor(e.tropas / 70)), s = Math.sin(e.dir), c = Math.cos(e.dir), lista = amigo ? az : vm;
    for (let i = 0; i < n; i++) { const fila = 1 + Math.floor(i / 3), col = (i % 3) - 1, ox = col * 1.1, oz = -fila * 1.15 - (e.v ? 0.4 : -0.8);
      lista.push({ x: x + ox * c + oz * s, z: z - ox * s + oz * c, ph: e.id * 1.7 + i * 0.9 + (p.anda ? 0 : 99), ry: e.dir, tipo: 'az' }); }
    // caminho que falta (só os meus)
    if (e.eu && p.anda) { if (e.linhaCam !== e.cam) { if (e.linha) cn().remove(e.linha); const pts = e.cam.map(q => new THREE.Vector3(wx(q[0]), 0.3, wz(q[1]))); e.linha = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xffd84a, dashSize: 1, gapSize: 0.7 })); e.linha.computeLineDistances(); cn().add(e.linha); e.linhaCam = e.cam; } }
    else if (e.linha) { cn().remove(e.linha); e.linha = null; e.linhaCam = null; }
  }
  desenharTropas('az', az, 0, t); desenharTropas('vm', vm, 0, t);
  if (Math.random() < 0.1) for (const e of meus()) { const m = document.querySelector(`[data-mu-t="${e.id}"]`); if (!m) continue; const p = posicao(e), casa = Math.hypot(p.x - e.base[0], p.y - e.base[1]) < 1.5; m.textContent = p.anda ? `${tr('Marchando')} ${tempoTxt(p.falta)}` : casa ? tr('Na base') : tr('Parado'); }
}
export function vista() { return { foco: K?.cam || { x: WX, z: WZ }, yaw: Math.PI, pitch: 0.95, dist: K?.zoom || 95 }; }
export function desenharFx(g) {
  if (!K?.carregou) return; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.65)';
  for (const c of K.castelos) { const q = C.tela(wx(c.x), 13, wz(c.y)); if (!q || q[1] < 60) continue; g.font = '14px Titulo, sans-serif'; const t = `[${c.tag}] ${c.nome}`; g.strokeText(t, q[0], q[1]); g.fillStyle = '#' + CORES_CLA[(c.cor || 0) % 8].toString(16).padStart(6, '0'); g.fillText(t, q[0], q[1]); }
  if (K.zoom > 130) return;
  for (const e of K.ex.values()) { const p = posicao(e), q = C.tela(wx(p.x), 4.2, wz(p.y)); if (!q || q[1] < 60 || q[1] > innerHeight - 90) continue;
    if (e.eu) { g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(q[0], q[1] - 4, 9, 0, 7); g.fill(); g.stroke(); g.font = '13px Titulo, sans-serif'; g.fillStyle = '#3a1a08'; g.fillText(e.slot + 1, q[0], q[1] + 1); g.strokeStyle = 'rgba(0,0,0,.65)'; }
    else { g.font = '11px Titulo, sans-serif'; g.strokeText(e.nome, q[0], q[1]); g.fillStyle = '#fff'; g.fillText(e.nome, q[0], q[1]); }
    if (K.sel === e.id) { g.strokeStyle = '#ffd84a'; g.lineWidth = 3; g.beginPath(); g.arc(q[0], q[1] + 26, 18, 0, 7); g.stroke(); g.strokeStyle = 'rgba(0,0,0,.65)'; } }
}
window.__mu = { K: () => K, caminho, gerarMapa }; // testes
