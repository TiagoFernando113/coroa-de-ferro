// Armas em pixel art: cada arma é uma grade de pixels gerada aqui (sem modelos) e vira blocos 3D (voxels).
// Chave "tipo:raridade" (armas comuns) ou "L:lenda" (armas únicas). O cabo fica no ponto 0 e a lâmina sobe em +Y.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const CORES_R = ['#b8bcc4', '#7ae07a', '#5aa8ff', '#c07aff', '#ffb43a', '#ff4a5a']; // cor de destaque por raridade
const K = '#1a1420', CABO = '#7a4a24', CABO2 = '#4a2a14', OURO = '#ffd23a', OURO2 = '#b8860b', ACO = '#dde3ea', ACO2 = '#8a96a6';
// lendas: formato + cores + brilho
const LENDA = {
  fenda: { tipo: 'espada', lam: '#3a1a5a', fio: '#c07aff', brilho: '#e0b0ff', guarda: '#6a3ab0', dentes: 1, comp: 26 },
  celeste: { tipo: 'espada', lam: '#fff4c8', fio: '#ffd23a', brilho: '#ffffff', guarda: OURO, comp: 28, asas: 1 },
  trovao: { tipo: 'martelo', lam: '#5a6a8a', fio: '#7ac8ff', brilho: '#c8f0ff', guarda: OURO },
  solar: { tipo: 'arco', lam: '#c8501a', fio: '#ffb43a', brilho: '#fff0a0', guarda: OURO },
  glacial: { tipo: 'cajado', lam: '#2a6a9a', fio: '#9ae8ff', brilho: '#ffffff', guarda: '#c8e8ff' },
  sangue: { tipo: 'foice', lam: '#5a0a1a', fio: '#ff3a4a', brilho: '#ff9aa0', guarda: '#2a0a10' },
  vulcao: { tipo: 'machado', lam: '#3a2a2a', fio: '#ff7a1a', brilho: '#ffd06a', guarda: '#5a2a1a' },
  sombra: { tipo: 'adaga', lam: '#2a1a3a', fio: '#9a5ae8', brilho: '#d0a8ff', guarda: '#4a2a6a', dentes: 1 },
};
export const TIPOS_PX = ['espada', 'machado', 'martelo', 'lanca', 'cajado', 'arco', 'adaga', 'foice'];

// ---- desenho (grade [y][x], y = 0 embaixo) ----
function grade(w, h) { const g = Array.from({ length: h }, () => Array(w).fill(null)); g.p = (x, y, c, luz) => { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = luz ? { c, luz: 1 } : { c }; }; return g; }
function contorno(g) { // borda escura em volta de tudo (estilo pixel art)
  const h = g.length, w = g[0].length, out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!g[y][x]) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = g[y + dy]?.[x + dx]; if (q && q.c !== K) { out.push([x, y]); break; } }
  for (const [x, y] of out) g[y][x] = { c: K };
}
function cabo(g, cx, y0, n, pomo) { for (let y = y0; y < y0 + n; y++) { g.p(cx, y, (y - y0) % 2 ? CABO : CABO2); } if (pomo) { g.p(cx, y0 - 1, pomo); g.p(cx - 1, y0 - 1, pomo); g.p(cx + 1, y0 - 1, pomo); } }
function desenhar(chave) {
  const [a, b] = chave.split(':'), L = a === 'L' ? LENDA[b] : null, tipo = L ? L.tipo : a, r = L ? 5 : +b || 0;
  const lam = L?.lam || ACO, fio = L?.fio || CORES_R[r], brilho = L?.brilho || (r >= 3 ? CORES_R[r] : null), guarda = L?.guarda || (r >= 4 ? OURO : r >= 2 ? CORES_R[r] : ACO2), luz = !!L || r >= 4;
  let g;
  if (tipo === 'espada' || tipo === 'adaga') {
    const comp = L?.comp || (tipo === 'adaga' ? 12 : 20 + r), larg = tipo === 'adaga' ? 1 : r >= 3 ? 2 : 1, W = 13, H = comp + 10, cx = 6; g = grade(W, H);
    cabo(g, cx, 2, 5, guarda);
    for (let x = cx - 3 - (r >= 3 ? 1 : 0); x <= cx + 3 + (r >= 3 ? 1 : 0); x++) g.p(x, 7, guarda); if (r >= 2 || L) { g.p(cx - 3, 8, guarda); g.p(cx + 3, 8, guarda); }
    if (L?.asas) for (let k = 0; k < 4; k++) { g.p(cx - 4 - k, 8 + k, '#ffffff', 1); g.p(cx + 4 + k, 8 + k, '#ffffff', 1); }
    g.p(cx, 7, brilho || fio, luz); // gema
    for (let y = 8; y < 8 + comp; y++) { const fim = 8 + comp - y, l = fim <= 2 ? 0 : larg;
      for (let x = cx - l; x <= cx + l; x++) g.p(x, y, x === cx ? (brilho || fio) : x < cx ? fio : lam, x === cx && luz);
      if (L?.dentes && y % 4 === 0 && fim > 3) g.p(cx + l + 1, y, fio, 1); }
  } else if (tipo === 'machado' || tipo === 'foice') {
    const H = 26 + r, W = 15, cx = 4; g = grade(W, H); cabo(g, cx, 1, H - 3, null); g.p(cx, H - 2, guarda);
    if (tipo === 'machado') { for (let y = H - 11; y < H - 2; y++) { const d = Math.round(5 - Math.abs(y - (H - 6.5)) * 0.7) + 2; for (let x = cx + 1; x <= cx + d; x++) g.p(x, y, x === cx + d ? fio : x === cx + d - 1 && luz ? brilho : lam, x === cx + d - 1 && luz); }
      if (r >= 3 || L) for (let y = H - 9; y < H - 4; y++) for (let x = cx - 3; x < cx; x++) g.p(x, y, x === cx - 3 ? fio : lam); }
    else { for (let k = 0; k < 11; k++) { const x = cx + 1 + k, y = H - 3 - Math.round((k / 10) ** 2 * 8); for (let t = 0; t < 2 + (k < 7 ? 1 : 0); t++) g.p(x, y - t, t === 0 ? fio : t === 1 && luz ? brilho : lam, t === 1 && luz); } }
  } else if (tipo === 'martelo') {
    const H = 24 + r, W = 13, cx = 6; g = grade(W, H); cabo(g, cx, 1, H - 8, guarda);
    for (let y = H - 7; y < H - 1; y++) for (let x = cx - 4; x <= cx + 4; x++) g.p(x, y, y === H - 4 ? (brilho || fio) : Math.abs(x - cx) === 4 ? fio : lam, y === H - 4 && luz);
    if (L) for (let k = 0; k < 3; k++) g.p(cx + 5, H - 3 - k * 2, brilho, 1);
  } else if (tipo === 'lanca') {
    const H = 32 + r, W = 9, cx = 4; g = grade(W, H); cabo(g, cx, 1, H - 9, null); for (let x = cx - 2; x <= cx + 2; x++) g.p(x, H - 9, guarda);
    for (let y = H - 8; y < H - 1; y++) { const l = Math.max(0, Math.min(2, Math.round((H - 1 - y) / 2.5))); for (let x = cx - l; x <= cx + l; x++) g.p(x, y, x === cx ? (brilho || ACO) : fio, x === cx && luz); }
  } else if (tipo === 'cajado') {
    const H = 30 + r, W = 11, cx = 5; g = grade(W, H); cabo(g, cx, 1, H - 8, null); for (let x = cx - 2; x <= cx + 2; x++) g.p(x, H - 8, guarda); g.p(cx - 2, H - 7, guarda); g.p(cx + 2, H - 7, guarda);
    for (let y = H - 7; y < H - 1; y++) { const l = Math.max(0, 2 - Math.abs(y - (H - 4)) + (y < H - 4 ? 0 : 0)); for (let x = cx - l; x <= cx + l; x++) g.p(x, y, Math.abs(x - cx) < l || l === 0 ? (brilho || fio) : fio, true); }
  } else { // arco
    const H = 28, W = 12, cx = 3; g = grade(W, H);
    for (let k = 0; k <= 26; k++) { const t = k / 26, x = Math.round(cx + Math.sin(t * Math.PI) * 6), y = 1 + k; g.p(x, y, k > 11 && k < 15 ? CABO : lam); g.p(x + 1, y, fio, luz && k % 3 === 0); }
    for (let y = 2; y < 27; y++) g.p(cx, y, '#f0e8d0');
  }
  contorno(g); return g;
}

// ---- 3D: um cubinho por pixel (juntados), pixels de brilho num material que não escurece ----
const PX = 0.05, cache = new Map(), matCor = new THREE.MeshLambertMaterial({ vertexColors: true }), matLuz = new THREE.MeshBasicMaterial({ vertexColors: true });
function geos(chave) {
  if (cache.has(chave)) return cache.get(chave);
  const g = desenhar(chave), H = g.length, W = g[0].length, cx = Math.floor(W / 2), base = [], luz = [], cor = new THREE.Color();
  let y0 = 0; for (let y = 0; y < H; y++) if (g[y].some(c => c?.c === CABO || c?.c === CABO2)) { y0 = y + 2; break; } // segura pelo cabo
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = g[y][x]; if (!c) continue;
    const bx = new THREE.BoxGeometry(PX, PX, PX * (c.c === K ? 1.4 : 1.8)).translate((x - cx) * PX, (y - y0) * PX, 0); bx.deleteAttribute('uv'); bx.deleteAttribute('normal');
    cor.set(c.c); const n = bx.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([cor.r, cor.g, cor.b], i * 3); bx.setAttribute('color', new THREE.BufferAttribute(a, 3)); (c.luz ? luz : base).push(bx); }
  const junta = l => { if (!l.length) return null; const m = mergeGeometries(l); m.computeVertexNormals(); return m; };
  const r = { base: junta(base), luz: junta(luz) }; cache.set(chave, r); return r;
}
export function armaPixel(chave) { const { base, luz } = geos(chave), o = new THREE.Group(); if (base) o.add(new THREE.Mesh(base, matCor)); if (luz) o.add(new THREE.Mesh(luz, matLuz)); o.traverse(m => { if (m.isMesh) m.castShadow = true; }); return o; }
// ícone (canvas) para a mochila: a própria pixel art
const icones = new Map();
export function iconePixel(chave, esc = 3) {
  if (icones.has(chave)) return icones.get(chave);
  const g = desenhar(chave), H = g.length, W = g[0].length, cv = document.createElement('canvas'); cv.width = W * esc; cv.height = H * esc; const c = cv.getContext('2d');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = g[y][x]; if (!p) continue; c.fillStyle = p.c; c.fillRect(x * esc, (H - 1 - y) * esc, esc, esc); }
  const url = cv.toDataURL(); icones.set(chave, url); return url;
}
export const tipoDe = chave => { const [a, b] = chave.split(':'); return a === 'L' ? LENDA[b]?.tipo : a; };
