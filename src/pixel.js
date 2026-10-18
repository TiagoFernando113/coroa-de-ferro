// Pixel art gerada por código (sem imagens): armas e ícones dos equipamentos.
// Cada peça é desenhada com formas (polígonos e círculos) numa grade; depois cada parte ganha volume (luz vinda de cima/esquerda),
// 5 tons por material, contorno da cor do material e pixels que brilham (gemas, runas). As armas viram blocos 3D (voxels).
// Chave da arma: "tipo:raridade" (comuns) ou "L:lenda" (únicas). O cabo fica no ponto 0 e a lâmina sobe em +Y.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const CORES_R = ['#b8bcc4', '#5ad86a', '#4a9aff', '#b05aff', '#ffaa2a', '#ff3a4a'];
const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
// rampa de 5 tons: sombra puxada para o roxo, luz puxada para o amarelo claro (como em pixel art feita à mão)
const rampas = new Map();
const rampa = base => { let r = rampas.get(base); if (!r) { r = [mix(base, '#100620', 0.8), mix(base, '#1c0c38', 0.42), base, mix(base, '#fff2cc', 0.36), mix(base, '#ffffff', 0.72)]; rampas.set(base, r); } return r; };

// ---- tela: formas com material e modo de volume ----
function tela() {
  const cel = new Map(); let id = 0;
  const pinta = (x, y, m, modo, i) => cel.set(x + ',' + y, { x, y, m, modo, id: i });
  return {
    cel, novoId: () => ++id,
    poli(pts, m, modo = 'bevel') { id++; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d; } if (d) pinta(x, y, m, modo, id); } return this; },
    ret(x0, y0, x1, y1, m, modo) { return this.poli([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], m, modo); },
    circ(cx, cy, r, m, modo = 'redondo') { id++; for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) pinta(x, y, m, modo, id); return this; },
    linha(pts, larg, m, modo = 'plano') { for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], d = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / d * larg / 2, ny = (bx - ax) / d * larg / 2; this.poli([[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]], m, modo); } return this; },
  };
}
// luz vem de cima, da esquerda e um pouco da frente
const LX = -0.545, LY = 0.636, LZ = 0.545, V4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// mats: { nome: { cor, luz (brilha no escuro), trama (cabo enrolado), ruido (pelo), liso (sem sombra forte) } }
function sombrear(T, mats) {
  const C = T.cel, k = (x, y) => x + ',' + y, d = new Map(), fila = [];
  for (const c of C.values()) if (V4.some(([a, b]) => C.get(k(c.x + a, c.y + b))?.id !== c.id)) { d.set(c, 1); fila.push(c); }
  for (let i = 0; i < fila.length; i++) { const c = fila[i], n = d.get(c); for (const [a, b] of V4) { const q = C.get(k(c.x + a, c.y + b)); if (q && q.id === c.id && !d.has(q)) { d.set(q, n + 1); fila.push(q); } } }
  const alt = c => { const n = d.get(c) || 1; return c.modo === 'aresta' ? n : c.modo === 'redondo' ? Math.sqrt(n) * 1.6 : c.modo === 'plano' ? 1 : Math.min(n, c.modo === 'bevel3' ? 3 : 2); };
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const c of C.values()) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); }
  x0--; y0--; x1++; y1++; const W = x1 - x0 + 1, H = y1 - y0 + 1, g = Array.from({ length: H }, () => Array(W).fill(null));
  for (const c of C.values()) { const f = (x, y) => { const q = C.get(k(x, y)); return q && q.id === c.id ? alt(q) : 0; };
    const gx = f(c.x + 1, c.y) - f(c.x - 1, c.y), gy = f(c.x, c.y + 1) - f(c.x, c.y - 1), nl = Math.hypot(gx, gy, 2), s = (-gx * LX - gy * LY + 2 * LZ) / nl;
    const M = mats[c.m] || { cor: '#ff00ff' }; let t = s > 0.8 ? 4 : s > 0.6 ? 3 : s > 0.3 ? 2 : 1;
    if (M.trama && (((c.x + c.y * 2) % 4) + 4) % 4 === 0) t = Math.max(1, t - 1); if (M.ruido && (((c.x * 7 + c.y * 13) % 5) + 5) % 5 === 0) t = Math.max(1, t - 1); if (M.liso) t = Math.max(2, Math.min(3, t));
    const n = d.get(c) || 1, z = c.modo === 'aresta' ? 1.4 + Math.min(n - 1, 4) * 1.15 : c.modo === 'redondo' ? 2 + Math.sqrt(n) * 1.5 : c.modo === 'plano' ? 2.4 : 2.2 + Math.min(n - 1, c.modo === 'bevel3' ? 3 : 2) * 1.1; // espessura: mais grossa no meio
    g[c.y - y0][c.x - x0] = { c: rampa(M.cor)[t], luz: !!M.luz, m: c.m, z }; }
  // contorno da cor mais escura do material vizinho
  const out = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!g[y][x]) for (const [a, b] of V4) { const q = g[y + b]?.[x + a]; if (q) { out.push([x, y, rampa(mats[q.m]?.cor || '#000')[0]]); break; } }
  for (const [x, y, c] of out) { let z = 1; for (const [a, b] of V4) z = Math.max(z, (g[y + b]?.[x + a]?.z || 0) - 0.6); g[y][x] = { c, cont: true, z }; } // contorno acompanha a espessura do vizinho
  return { g, ox: -x0, oy: -y0 };
}

// ---- armas ----
const LENDA = {
  fenda: { tipo: 'espada', lam: '#5a2a9a', gua: '#3a1a5a', gem: '#e0a0ff', run: '#d080ff', cabo: '#2a1a3a' },
  celeste: { tipo: 'espada', lam: '#fff0b8', gua: '#ffd23a', gem: '#7ae8ff', run: '#ffffff', cabo: '#e8e0f8' },
  trovao: { tipo: 'martelo', lam: '#5a6aa0', gua: '#ffd23a', gem: '#9ae8ff', run: '#9ae8ff', cabo: '#3a2a4a' },
  solar: { tipo: 'arco', lam: '#ff9a2a', gua: '#ffe27a', gem: '#fff0a0', run: '#fff0a0', cabo: '#8a3a1a' },
  glacial: { tipo: 'cajado', lam: '#8ad8ff', gua: '#e0f4ff', gem: '#bff4ff', run: '#ffffff', cabo: '#3a6a9a' },
  sangue: { tipo: 'foice', lam: '#9a1a2a', gua: '#3a0a14', gem: '#ff4a5a', run: '#ff4a5a', cabo: '#2a0a10' },
  vulcao: { tipo: 'machado', lam: '#3a2a2a', gua: '#6a2a1a', gem: '#ffb03a', run: '#ff7a1a', cabo: '#2a1a14' },
  sombra: { tipo: 'adaga', lam: '#3a2a5a', gua: '#1a1028', gem: '#b07aff', run: '#9a5ae8', cabo: '#1a1028' },
};
export const TIPOS_PX = ['espada', 'machado', 'martelo', 'lanca', 'cajado', 'arco', 'adaga', 'foice'];
export const tipoDe = chave => { const [a, b] = chave.split(':'); return a === 'L' ? LENDA[b]?.tipo : a; };
function matsArma(r, L) {
  const lam = ['#8a929e', '#aab6c4', '#c4d4ea', '#c8bcf0', '#ffd86a', '#ff7a7a'][r], gua = ['#6a5a4a', '#8a7048', '#3a6ad0', '#7a3ad0', '#ffc23a', '#ffc23a'][r];
  return {
    lam: { cor: L?.lam || lam }, gua: { cor: L?.gua || gua }, gem: { cor: L?.gem || CORES_R[Math.max(1, r)], luz: !!L || r >= 2 }, run: { cor: L?.run || CORES_R[r], luz: true },
    cabo: { cor: L?.cabo || (r >= 3 ? '#3a2a4a' : '#7a4424'), trama: true }, mad: { cor: L?.cabo || (r >= 3 ? '#4a2a3a' : '#8a5a2a') }, corda: { cor: '#f0e8d8', liso: true }, pano: { cor: L?.gem || CORES_R[r] },
    fio: { cor: L?.run || '#ffffff', luz: !!L || r >= 4 },
  };
}
const esp = pts => [...pts, ...pts.slice().reverse().map(([x, y]) => [-x, y])]; // espelha meio contorno no eixo do cabo
function desenharArma(chave) {
  const [a, b] = chave.split(':'), L = a === 'L' ? LENDA[b] : null, tipo = L ? L.tipo : a, r = L ? 5 : Math.min(5, +b || 0), T = tela(), M = matsArma(r, L), lk = L ? b : null;
  if (tipo === 'espada' || tipo === 'adaga') {
    const ad = tipo === 'adaga', Lm = ad ? 15 + r : 30 + 2 * r, W = (ad ? 2.2 : 2.6) + 0.35 * r, G = (ad ? 4 : 6) + r * 0.8, gy = 6, b0 = gy + 3.6;
    T.ret(-1.5, -6, 1.5, gy, 'cabo', 'bevel');
    T.circ(0, -8, 2.6, 'gua'); T.circ(0, -8, 1.2, 'gem');
    T.poli(esp([[0, gy], [G, gy], [G + 1.8, gy + 2.5], [G - 0.5, b0], [0, b0]]), 'gua', 'bevel');
    T.circ(G + 1.2, gy + 2.6, 1.7, 'gua'); T.circ(-G - 1.2, gy + 2.6, 1.7, 'gua');
    if (lk === 'celeste') for (const s of [1, -1]) T.poli([[s * 3, gy + 3], [s * 9, gy + 5], [s * 15, gy + 11], [s * 13, gy + 11], [s * 15, gy + 15], [s * 11, gy + 12], [s * 11, gy + 16], [s * 7, gy + 10], [s * 3, gy + 7]], 'lam', 'bevel');
    T.poli([[-W, b0], [W, b0], [W * 0.95, b0 + Lm * 0.72], [0.3, b0 + Lm], [-0.3, b0 + Lm], [-W * 0.95, b0 + Lm * 0.72]], 'lam', 'aresta');
    if (lk === 'fenda' || lk === 'sombra') for (let y = b0 + 3; y < b0 + Lm * 0.7; y += 4) { T.poli([[W - 0.5, y], [W + 2.2, y + 1.5], [W - 0.5, y + 2.5]], 'lam', 'bevel'); T.poli([[-W + 0.5, y + 2], [-W - 2.2, y + 3.5], [-W + 0.5, y + 4.5]], 'lam', 'bevel'); }
    if (r >= 2 && !ad) T.linha(lk === 'fenda' ? [[0, b0 + 2], [1, b0 + 7], [-1, b0 + 12], [1, b0 + 17], [-1, b0 + 22], [0, b0 + Lm * 0.75]] : [[0, b0 + 2], [0, b0 + Lm * 0.66]], 1.1, 'run');
    if (r >= 4 && !L) for (const s of [1, -1]) T.poli([[s * (W + 0.5), b0], [s * (W + 3), b0 + 1], [s * (W + 0.5), b0 + 4]], 'gua', 'bevel');
    T.circ(0, gy + 1.8, ad ? 1.4 : 2.1, 'gem');
  } else if (tipo === 'machado') {
    const H = 26 + r, s = 1 + 0.05 * r, hy = H - 15 * s;
    T.ret(-1.3, -12, 1.3, H + 2, 'cabo', 'bevel'); T.circ(0, -12.5, 2, 'gua');
    T.poli([[1, hy], [5 * s, hy + 1], [10 * s, hy - 3 * s], [13 * s, hy + 2], [14 * s, hy + 7 * s], [13 * s, hy + 12 * s], [10 * s, hy + 17 * s], [5 * s, hy + 13 * s], [1, hy + 14 * s]], 'lam', 'bevel3');
    T.linha([[11 * s, hy - 1.5 * s], [13.2 * s, hy + 2.5], [13.6 * s, hy + 7 * s], [13 * s, hy + 11.5 * s], [10.5 * s, hy + 15.5 * s]], 1.3, 'fio');
    if (r >= 2 || L) T.poli([[-1, hy + 3], [-7 * s, hy + 5], [-9 * s, hy + 7 * s], [-7 * s, hy + 9 * s], [-1, hy + 11]], 'lam', 'bevel');
    if (lk === 'vulcao') T.linha([[3, hy + 3], [6, hy + 6], [5, hy + 9], [9, hy + 11], [11, hy + 8]], 1, 'run');
    T.ret(-2, hy - 1, 2, hy + 1, 'gua', 'bevel'); T.ret(-2, hy + 13 * s, 2, hy + 15 * s, 'gua', 'bevel'); T.poli([[-1.3, H + 2], [1.3, H + 2], [0, H + 5]], 'lam');
    T.circ(3, hy + 7 * s, 1.6, 'gem');
  } else if (tipo === 'martelo') {
    const H = 21 + r, w = 7 + 0.5 * r;
    T.ret(-1.3, -12, 1.3, H, 'cabo', 'bevel'); T.circ(0, -12.5, 2.2, 'gua');
    T.ret(-w, H, w, H + 10, 'lam', 'bevel3'); T.ret(-w - 1, H - 0.5, -w + 2, H + 10.5, 'gua', 'bevel'); T.ret(w - 2, H - 0.5, w + 1, H + 10.5, 'gua', 'bevel');
    if (lk === 'trovao') T.linha([[-w + 3, H + 8], [-2, H + 6], [-4, H + 3], [w - 3, H + 2]], 1.1, 'run');
    T.circ(0, H + 5, 2.8, 'gem'); if (r >= 2 || L) T.poli([[-2, H + 10], [2, H + 10], [0, H + 14]], 'gua');
  } else if (tipo === 'lanca') {
    const H = 32 + r;
    T.ret(-1, -16, 1, H, 'mad', 'bevel'); for (const y of [-16, -2, 12]) T.ret(-1.6, y, 1.6, y + 1.5, 'gua', 'bevel');
    T.ret(-2, H, 2, H + 2, 'gua', 'bevel'); if (r >= 2 || L) for (const s of [1, -1]) T.poli([[s * 1.5, H + 1], [s * 7, H + 4], [s * 2, H + 3]], 'gua');
    T.poli([[0, H + 2], [4, H + 7], [3, H + 14], [0.3, H + 21], [-0.3, H + 21], [-3, H + 14], [-4, H + 7]], 'lam', 'aresta');
    if (r >= 3) T.linha([[0, H + 4], [0, H + 14]], 1, 'run');
    T.poli([[1, H - 1], [3.5, H - 3], [4.5, H - 9], [2.5, H - 8], [1, H - 3]], 'pano');
  } else if (tipo === 'cajado') {
    const H = 26 + r, o = 3.6 + 0.35 * r;
    T.ret(-1.2, -16, 1.2, H, 'mad', 'bevel'); for (const y of [-16, -4, 8]) T.ret(-1.7, y, 1.7, y + 1.5, 'gua', 'bevel');
    for (const s of [1, -1]) T.poli([[s * 1, H - 1], [s * (o + 2), H + 2], [s * (o + 3), H + o + 3], [s * (o + 1.5), H + 2 * o + 3], [s * (o + 1), H + o + 2], [s * 1, H + 2]], 'gua', 'bevel');
    if (lk === 'glacial') T.poli([[0, H + o * 2 + 7], [o + 0.5, H + o + 3], [0, H], [-o - 0.5, H + o + 3]], 'gem', 'aresta'); else T.circ(0, H + o + 3, o, 'gem');
    if (r >= 3) for (const [dx, dy] of [[-o - 4, H + 2 * o + 3], [o + 4, H + 2 * o + 4]]) T.circ(dx, dy, 1, 'run');
  } else if (tipo === 'arco') {
    const top = [], bot = []; for (let i = 0; i <= 24; i++) { const t = i / 12 - 1, y = t * 22, x = 7 * (1 - t * t) - 7, w = 1.2 + 1.4 * (1 - Math.abs(t)); top.push([x + w / 2, y]); bot.push([x - w / 2, y]); }
    T.poli([...top, ...bot.reverse()], 'mad', 'bevel'); T.linha([[-7, 22], [-7, -22]], 0.9, 'corda');
    T.ret(-1.6, -3.5, 1.8, 3.5, 'cabo', 'bevel');
    for (const s of [1, -1]) { T.circ(-7, s * 22, 1.6, 'gua'); if (r >= 2 || L) T.poli([[-5.5, s * 17], [-2, s * 15], [-4.5, s * 13]], 'gua'); if (r >= 3) T.circ(-1.2, s * 9, 1.1, 'gem'); }
    if (lk === 'solar') for (const s of [1, -1]) T.poli([[-7, s * 23], [-9, s * 27], [-6, s * 25], [-5, s * 28], [-5, s * 24]], 'run');
  } else { // foice
    const H = 30 + r, ext = [[1.5, H - 1], [-3, H + 2.5], [-9, H + 3.5], [-15, H + 1.5], [-20, H - 3], [-23, H - 9]], inn = [[-19, H - 5], [-14, H - 1.5], [-9, H - 0.3], [-4, H - 1], [0, H - 3]];
    T.ret(-1.2, -16, 1.2, H, 'mad', 'bevel'); T.circ(0, -16.5, 2, 'gua'); T.ret(-1.8, H - 3, 1.8, H, 'gua', 'bevel');
    T.poli([...ext, ...inn], 'lam', 'bevel3'); T.linha(ext.slice(1), 1.2, 'fio');
    if (r >= 3) T.circ(-2, H + 0.5, 1.4, 'gem');
  }
  return sombrear(T, M);
}

// ---- 3D: um cubinho por pixel (juntados); pixels de brilho num material que não escurece ----
const PX = 0.045, cache = new Map(), matCor = new THREE.MeshLambertMaterial({ vertexColors: true }), matLuz = new THREE.MeshBasicMaterial({ vertexColors: true });
const desenhos = new Map(), desenho = chave => { let d = desenhos.get(chave); if (!d) { d = desenharArma(chave); desenhos.set(chave, d); } return d; };
function geos(chave) {
  if (cache.has(chave)) return cache.get(chave);
  const { g, ox, oy } = desenho(chave), base = [], luz = [], cor = new THREE.Color();
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) { const c = g[y][x]; if (!c) continue;
    const bx = new THREE.BoxGeometry(PX, PX, PX * c.z * 1.25).translate((x - ox) * PX, (y - oy) * PX, 0); bx.deleteAttribute('uv'); bx.deleteAttribute('normal');
    cor.set(c.c); const n = bx.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([cor.r, cor.g, cor.b], i * 3); bx.setAttribute('color', new THREE.BufferAttribute(a, 3)); (c.luz ? luz : base).push(bx); }
  const junta = l => { if (!l.length) return null; const m = mergeGeometries(l); m.computeVertexNormals(); return m; };
  const r = { base: junta(base), luz: junta(luz) }; cache.set(chave, r); return r;
}
export function armaPixel(chave) { const { base, luz } = geos(chave), o = new THREE.Group(); if (base) o.add(new THREE.Mesh(base, matCor)); if (luz) o.add(new THREE.Mesh(luz, matLuz)); o.traverse(m => { if (m.isMesh) m.castShadow = true; }); return o; }

// ---- ícones (canvas) ----
const icones = new Map();
function canvasDe(g, esc, brilhos) {
  const H = g.length, W = g[0].length, p = brilhos ? 3 : 0, cv = document.createElement('canvas'); cv.width = (W + p * 2) * esc; cv.height = (H + p * 2) * esc; const c = cv.getContext('2d');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = g[y][x]; if (!q) continue; c.fillStyle = q.c; c.fillRect((x + p) * esc, (H - 1 - y + p) * esc, esc, esc); }
  if (brilhos) { c.fillStyle = '#ffffff'; for (const [fx, fy] of [[0.15, 0.2], [0.85, 0.55], [0.3, 0.85]]) { const x = Math.round(fx * (W + p)), y = Math.round(fy * (H + p)); c.fillRect(x * esc, (y - 1) * esc, esc, esc * 3); c.fillRect((x - 1) * esc, y * esc, esc * 3, esc); } }
  return cv.toDataURL();
}
export function iconePixel(chave, esc = 2) { const k = chave + ':' + esc; if (!icones.has(k)) icones.set(k, canvasDe(desenho(chave).g, esc, chave.startsWith('L:') || chave.endsWith(':5'))); return icones.get(k); }

// ---- outros equipamentos: mapas 16x16 desenhados à mão, ampliados 2x e com o mesmo volume/sombra ----
// m metal, o enfeite, g gema, c pano, C dobra do pano, w couro, f pelo, p pele clara, k fresta escura
const MAPAS = {
  elmo: ['.......gg.......', '.....mmmmmm.....', '....mmmmmmmm....', '...mmmmmmmmmm...', '...mmmmmmmmmm...', '..oooooooooooo..', '..mmmkkmmkkmmm..', '..mmkkkmmkkkmm..', '..mmkkkmmkkkmm..', '..mm.kkmmkk.mm..', '..mm...mm...mm..', '..mm........mm..', '...m........m...'],
  viseira: ['.......cc.......', '......cccc......', '.....cmmmmc.....', '....mmmmmmmm....', '...mmmmmmmmmm...', '...mmmmggmmmm...', '..mmmmmmmmmmmm..', '..oooooooooooo..', '..mkkkkkkkkkkm..', '..mmmmmmmmmmmm..', '..mmkmkmmkmkmm..', '..mmmmmmmmmmmm..', '...mmmmmmmmmm...', '....oooooooo....'],
  mago: ['...........cc...', '..........ccc...', '.........ccc....', '........cccc....', '.......ccccc....', '.......cccccc...', '......cccgccc...', '......ccccccc...', '.....cccccccc...', '....oooooooooo..', '..cccccccccccccc', '.cccccccccccccc.', '..cccccccccccc..'],
  urso: ['..ff........ff..', '.fppf......fppf.', '.ffffffffffffff.', 'ffffffffffffffff', 'fffkffffffffkfff', 'ffffffffffffffff', 'fffffffppfffffff', '.ffffppkkppffff.', '.fff.pppppp.fff.', '.ff..........ff.', '.fff........fff.', '..ff........ff..'],
  lenco: ['................', '...cccc..cccc...', '.cccccccccccccc.', 'cccckkcccckkcccc', 'ccckkkkcckkkkccc', '.cccccc..cccccc.', '..cccc....cccc.c', '.............cc.', '............cc..'],
  Knight: ['..mmmo....ommm..', '.mmmmmo..ommmmm.', 'mmmmmmmmmmmmmmmm', 'mmmmmmmmmmmmmmmm', 'mm.mmmmggmmmm.mm', 'mm.mmmmggmmmm.mm', 'mm.mmmmmmmmmm.mm', 'mm.mmmmmmmmmm.mm', '...oooooooooo...', '...mmmmmmmmmm...', '...mmm.mm.mmm...', '...mmm....mmm...'],
  Barbarian: ['ffff........ffff', 'fffffff..fffffff', '.wwwwwwffwwwwww.', '.wwwwwoowwwwwww.', '.wwwwwwoowwwwww.', '.ww.wwwwoowww.ww', '.ww.wwwwwoowwww.', '.ww.wwwwwwoww.ww', '....oooooooooo..', '....wwwwgwwwww..', '....www.ww.www..', '....www....www..'],
  Mage: ['...ccc....ccc...', '..ccccco.occccc.', '.cccccco.occcccc', '.cccccco.occcccc', 'ccc.ccco.occc.cc', 'ccc.cccoooccc.cc', 'ccc.cccogocccc.c', '....cccoooccc...', '....ccccccccc...', '...ccccccccccc..', '..ccccccccccccc.', '..ooooooooooooo.'],
  Ranger: ['..ww........ww..', '.wwwc......cwww.', 'wwwwcc....ccwwww', 'wwwwccccccccwwww', 'ww.wwwwwwwwww.ww', 'ww.wccccccccw.ww', 'ww.wccccccccw.ww', '...oooogoooo....', '...wccccccccw...', '...wccc..cccw...', '...www....www...'],
  Rogue: ['...cc......cc...', '..cccc....cccc..', '.cccccckkcccccc.', '.ccccccckcccccc.', 'cc.ccccckccccc.c', 'cc.cwwwwwwwwcc.c', 'cc.ccccckccccc.c', '...ccccckccccc..', '...oooooooooo...', '...ccccccccccc..', '...cccc..cccc...'],
  capa: ['.....oooooo.....', '....ocgccgco....', '....cccccccc....', '...cccccccccc...', '...ccCccccCcc...', '..cccCccccCccc..', '..ccCccccccCcc..', '.cccCccccccCccc.', '.ccCccccccccCcc.', 'cccCccccccccCccc', 'ccCccccccccccCcc', 'cc.ccccc.cccc.cc', 'c...ccc...cc...c'],
  capuz: ['......cccc......', '....cccccccc....', '...cckkkkkkcc...', '...ckkkkkkkkc...', '...cckkkkkkcc...', '....ocgccgco....', '...cccccccccc...', '..cccCccccCccc..', '.cccCccccccCccc.', '.ccCccccccccCcc.', 'cccCccccccccCccc', 'cc.ccccc.cccc.cc', 'c...ccc...cc...c'],
  Anel: ['......gg......', '.....gggg.....', '....ogggggo...', '.....ooooo....', '....o.....o...', '...o.......o..', '...o.......o..', '...o.......o..', '....o.....o...', '.....ooooo....'],
  'Aliança': ['................', '.....oooooo.....', '...oooooooooo...', '..ooo......ooo..', '..oo........oo..', '..oo........oo..', '..oo........oo..', '..ooo......ooo..', '...oooooooooo...', '.....oooooo.....'],
  Selo: ['....oooooo....', '....oggggo....', '....oggggo....', '....oggggo....', '....oooooo....', '.....o..o.....', '....o....o....', '...o......o...', '...o......o...', '....o....o....', '.....oooo.....'],
  Amuleto: ['o..............o', '.o............o.', '..o..........o..', '...o........o...', '....o......o....', '.....o....o.....', '......oooo......', '.....oggggo.....', '....oggggggo....', '....oggggggo....', '.....oggggo.....', '......oggo......', '.......oo.......'],
  'Talismã': ['o..............o', '.o............o.', '..o..........o..', '...o........o...', '....o......o....', '.....oo..oo.....', '......oooo......', '....oommmmoo....', '...ommkmmkmmo...', '...ommmkkmmmo...', '...ommkmmkmmo...', '....oommmmoo....', '......oooo......'],
  Pingente: ['o..............o', '.o............o.', '..o..........o..', '...o........o...', '....o......o....', '.....o....o.....', '......o..o......', '.......oo.......', '.......gg.......', '......gggg......', '.....gggggg.....', '......gggg......', '.......gg.......'],
  'Relíquia': ['o..............o', '..o..........o..', '....o......o....', '......oooo......', '.......oo.......', '.......mm.......', '.....mmmmmm.....', '.....mmggmm.....', '.......mm.......', '.......mm.......', '.......mm.......', '........m.......'],
};
const PANOS = { Knight: '#c83a3a', Barbarian: '#8a5a3a', Mage: '#4a5ad8', Ranger: '#3a8a4a', Rogue: '#4a4a5a', Rogue_Hooded: '#3a3a4a', mago: '#4a5ad8', lenco: '#3a3a4a', viseira: '#c83a3a', urso: '#7a4a2a' };
const MODOS = { m: 'bevel3', o: 'bevel', g: 'redondo', c: 'bevel3', C: 'plano', w: 'bevel', f: 'bevel3', p: 'bevel', k: 'plano' };
function desenharItem(slot, vis, r) {
  const cr = CORES_R[r], key = slot === 'capa' ? (vis === 'Rogue_Hooded' ? 'capuz' : 'capa') : vis, mapa = MAPAS[key] || MAPAS[slot === 'anel' ? 'Anel' : slot === 'amuleto' ? 'Amuleto' : slot === 'elmo' ? 'elmo' : 'Knight'];
  const pano = mix(PANOS[vis] || '#c83a3a', cr, r >= 2 ? 0.3 : 0);
  const M = { m: { cor: r >= 4 ? (r === 5 ? '#ffb84a' : '#ffd23a') : mix('#a8b0bc', cr, 0.14 * r) }, o: { cor: r >= 3 ? '#ffc23a' : r >= 1 ? '#c8904a' : '#8a6a4a' }, g: { cor: cr, luz: r >= 2 }, c: { cor: pano }, C: { cor: mix(pano, '#000', 0.35), liso: true },
    w: { cor: mix('#9a6a3a', cr, 0.1 * r), trama: true }, f: { cor: mix('#8a5a32', cr, 0.08 * r), ruido: true }, p: { cor: '#f0c8a8' }, k: { cor: '#2a1a2a', liso: true } };
  // cada região ligada da mesma letra vira uma peça com volume próprio; cada pixel do mapa vira 2x2
  const T = tela(), H = mapa.length, feito = new Set(), letra = (x, y) => mapa[H - 1 - y]?.[x];
  for (let y = 0; y < H; y++) for (let x = 0; x < mapa[H - 1 - y].length; x++) { const q = letra(x, y); if (!q || q === '.' || feito.has(x + ',' + y)) continue;
    const id = T.novoId(), fila = [[x, y]]; feito.add(x + ',' + y);
    while (fila.length) { const [a, b] = fila.pop(); for (let i = 0; i < 4; i++) { const px = a * 2 + (i & 1), py = b * 2 + (i >> 1); T.cel.set(px + ',' + py, { x: px, y: py, m: q, modo: MODOS[q], id }); }
      for (const [dx, dy] of V4) { const k = (a + dx) + ',' + (b + dy); if (!feito.has(k) && letra(a + dx, b + dy) === q) { feito.add(k); fila.push([a + dx, b + dy]); } } } }
  return sombrear(T, M).g;
}
export function iconeItem(it, esc = 2) {
  if (it.modelo?.startsWith('P:')) return iconePixel(it.modelo.slice(2), esc);
  const vis = it.vis || it.nome.split(' ')[0], chave = `I:${it.slot}:${vis}:${it.r}:${esc}`; if (icones.has(chave)) return icones.get(chave);
  const url = canvasDe(desenharItem(it.slot, vis, it.r), esc, it.r >= 5); icones.set(chave, url); return url;
}
window.__px = { iconePixel, iconeItem }; // testes
