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

// ---- ícones pixel dos outros equipamentos (elmo, armadura, capa, anel, amuleto) ----
// mapas 16x16: m metal, o enfeite, g gema, c pano, w couro, f pelo, p pele clara, k fresta escura; sombra e brilho são automáticos
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
  Anel: ['......gg......', '.....gGGg.....', '....ogggggo...', '.....ooooo....', '....o.....o...', '...o.......o..', '...o.......o..', '...o.......o..', '....o.....o...', '.....ooooo....'],
  'Aliança': ['................', '.....oooooo.....', '...oooooooooo...', '..ooo......ooo..', '..oo........oo..', '..oo........oo..', '..oo........oo..', '..ooo......ooo..', '...oooooooooo...', '.....oooooo.....'],
  Selo: ['....oooooo....', '....oggggo....', '....ogGggo....', '....oggggo....', '....oooooo....', '.....o..o.....', '....o....o....', '...o......o...', '...o......o...', '....o....o....', '.....oooo.....'],
  Amuleto: ['o..............o', '.o............o.', '..o..........o..', '...o........o...', '....o......o....', '.....o....o.....', '......oooo......', '.....oggggo.....', '....ogGGgggo....', '....oggggggo....', '.....oggggo.....', '......oggo......', '.......oo.......'],
  'Talismã': ['o..............o', '.o............o.', '..o..........o..', '...o........o...', '....o......o....', '.....oo..oo.....', '......oooo......', '....oommmmoo....', '...ommkmmkmmo...', '...ommmkkmmmo...', '...ommkmmkmmo...', '....oommmmoo....', '......oooo......'],
  Pingente: ['o..............o', '.o............o.', '..o..........o..', '...o........o...', '....o......o....', '.....o....o.....', '......o..o......', '.......oo.......', '.......gg.......', '......gGgg......', '.....gGgggg.....', '......gggg......', '.......gg.......'],
  'Relíquia': ['o..............o', '..o..........o..', '....o......o....', '......oooo......', '.......oo.......', '.......mm.......', '.....mmmmmm.....', '.....mmggmm.....', '.......mm.......', '.......mm.......', '.......mm.......', '........m.......'],
};
const PANOS = { Knight: '#c83a3a', Barbarian: '#8a5a3a', Mage: '#4a5ad8', Ranger: '#3a8a4a', Rogue: '#4a4a5a', Rogue_Hooded: '#3a3a4a', mago: '#4a5ad8', lenco: '#3a3a4a', viseira: '#c83a3a', urso: '#7a4a2a' };
const misturar = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const clarear = (c, t) => misturar(c, '#ffffff', t), escurecer = (c, t) => misturar(c, '#000000', t);
function desenharItem(slot, vis, r) {
  const cr = CORES_R[r], key = slot === 'capa' ? (vis === 'Rogue_Hooded' ? 'capuz' : 'capa') : vis, mapa = MAPAS[key] || MAPAS[slot === 'anel' ? 'Anel' : slot === 'amuleto' ? 'Amuleto' : slot === 'elmo' ? 'elmo' : 'Knight'];
  const metal = r >= 4 ? misturar('#ffd23a', cr, r === 5 ? 0.35 : 0) : misturar('#a8b0bc', cr, 0.12 * r), enfeite = r >= 3 ? (r >= 4 ? '#fff0a0' : OURO) : r >= 1 ? '#c8904a' : '#8a6a4a';
  const pano = misturar(PANOS[vis] || '#c83a3a', cr, r >= 2 ? 0.3 : 0), pal = { m: metal, o: enfeite, g: cr, G: '#ffffff', c: pano, C: escurecer(pano, 0.3), w: misturar('#9a6a3a', cr, 0.1 * r), f: misturar('#8a5a32', cr, 0.08 * r), p: '#f0c8a8', k: '#2a1a2a' };
  const H = mapa.length + 4, W = Math.max(...mapa.map(l => l.length)) + 4, g = grade(W, H);
  mapa.forEach((l, i) => { const y = H - 3 - i, dx = Math.floor((W - 4 - l.length) / 2) + 2; for (let x = 0; x < l.length; x++) { const q = l[x]; if (q !== '.') g.p(x + dx, y, pal[q], q === 'g' && r >= 3); g[y][x + dx] && (g[y][x + dx].q = q); } });
  // sombra e brilho: borda de cima/esquerda clara, de baixo/direita escura (fica com cara de pixel art "de verdade")
  const cel = (x, y) => g[y]?.[x];
  const novo = g.map((lin, y) => lin.map((c, x) => { if (!c || c.q === 'k' || c.q === 'G') return c;
    const cima = !cel(x, y + 1) || cel(x, y + 1).q !== c.q, esq = !cel(x - 1, y) || cel(x - 1, y).q !== c.q, baixo = !cel(x, y - 1), dir = !cel(x + 1, y);
    if (cima && esq) return { ...c, c: clarear(c.c, 0.55) }; if (cima || esq) return { ...c, c: clarear(c.c, 0.28) }; if (baixo || dir) return { ...c, c: escurecer(c.c, 0.32) }; return c; }));
  novo.p = g.p; for (let y = 0; y < H; y++) g[y] = novo[y];
  // reflexo diagonal no metal/gema dos raros
  if (r >= 2) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = g[y][x]; if (c && (c.q === 'm' || c.q === 'g') && (x + (H - y)) % 7 === 0) g[y][x] = { ...c, c: clarear(c.c, 0.6) }; }
  contorno(g); return g;
}
export function iconeItem(it, esc = 3) {
  if (it.modelo?.startsWith('P:')) return iconePixel(it.modelo.slice(2), esc);
  const vis = it.vis || it.nome.split(' ')[0], chave = `I:${it.slot}:${vis}:${it.r}:${esc}`; if (icones.has(chave)) return icones.get(chave);
  const g = desenharItem(it.slot, vis, it.r), H = g.length, W = g[0].length, cv = document.createElement('canvas'); cv.width = W * esc; cv.height = H * esc; const c = cv.getContext('2d');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = g[y][x]; if (!p) continue; c.fillStyle = p.c; c.fillRect(x * esc, (H - 1 - y) * esc, esc, esc); }
  const url = cv.toDataURL(); icones.set(chave, url); return url;
}
