// Itens em 3D montados por código (no estilo arredondado dos heróis): armas, elmos, armaduras, capas, anéis e amuletos.
// Cada peça junta formas simples (lâminas recortadas com bisel, cilindros, anéis, cristais) com cores e brilho da raridade.
// As armas seguram no ponto 0 com a lâmina para +Y (igual às armas do kit na mão do herói).
import * as THREE from 'three';

const RAR = ['#b8bcc4', '#5ad86a', '#4a9aff', '#b05aff', '#ffaa2a', '#ff3a4a'];
const mats = new Map();
// material: metal brilha mais, gema/runa acende sozinha
function mat(cor, { metal = 0, brilho = 0, rug = 0.55 } = {}) {
  const k = cor + metal + brilho + rug; let m = mats.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: cor, metalness: metal, roughness: rug, flatShading: true, emissive: brilho ? cor : 0x000000, emissiveIntensity: brilho }); mats.set(k, m); }
  return m;
}
const malha = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.castShadow = true; return o; };
// recorte 2D (pontos) virado peça com espessura e bisel (fio da lâmina)
function recorte(pts, esp = 0.06, bis = 0.025) {
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y));
  const g = new THREE.ExtrudeGeometry(s, { depth: esp, bevelEnabled: true, bevelThickness: bis, bevelSize: bis, bevelSegments: 1, curveSegments: 6 }); g.translate(0, 0, -esp / 2); return g;
}
const esp = pts => [...pts, ...pts.slice().reverse().map(([x, y]) => [-x, y])];
const cil = (r1, r2, h, n = 8) => new THREE.CylinderGeometry(r1, r2, h, n);
const gema = r => new THREE.OctahedronGeometry(r, 0);
const cristal = r => new THREE.IcosahedronGeometry(r, 0);

// cores por raridade
function paleta(r, L) {
  return {
    lam: mat(L?.lam || ['#9aa2ae', '#b8c4d0', '#c8d8ee', '#d0c4f4', '#ffd86a', '#ff8a8a'][r], { metal: 0.65, rug: 0.3 }),
    gua: mat(L?.gua || ['#6a5a4a', '#8a6a3a', '#3a6ad0', '#7a3ad0', '#ffc23a', '#ffc23a'][r], { metal: r >= 2 ? 0.6 : 0.3, rug: 0.35 }),
    cabo: mat(L?.cabo || (r >= 3 ? '#3a2a4a' : '#7a4424'), { rug: 0.8 }), faixa: mat(r >= 3 ? '#ffc23a' : '#4a2a14', { metal: r >= 3 ? 0.6 : 0, rug: 0.5 }),
    gem: mat(L?.gem || RAR[Math.max(1, r)], { brilho: r >= 2 || L ? 0.7 : 0.15, rug: 0.2 }), runa: mat(L?.run || RAR[r], { brilho: 1.2, rug: 0.3 }),
  };
}
function cabo(g, P, y0, y1, r = 0.07) { g.add(malha(cil(r, r, y1 - y0), P.cabo, 0, (y0 + y1) / 2)); for (let y = y0 + 0.08; y < y1 - 0.04; y += 0.12) g.add(malha(new THREE.TorusGeometry(r, 0.022, 4, 8), P.faixa, 0, y, 0, Math.PI / 2)); }
function brilhos(g, cor, n, raio, y0, y1) { // cristaizinhos flutuando em volta das armas fortes
  for (let i = 0; i < n; i++) { const a = i * 2.4, y = y0 + (y1 - y0) * ((i * 0.37) % 1); g.add(malha(gema(0.035), mat(cor, { brilho: 1.5 }), Math.cos(a) * raio, y, Math.sin(a) * raio, a, a)); }
}

const LENDA = {
  fenda: { tipo: 'espada', lam: '#5a2a9a', gua: '#2a1a4a', gem: '#e0a0ff', run: '#d080ff', cabo: '#1a1028', dentes: 1 },
  celeste: { tipo: 'espada', lam: '#fff4c8', gua: '#ffd23a', gem: '#7ae8ff', run: '#ffffff', cabo: '#e8e0f8', asas: 1 },
  trovao: { tipo: 'martelo', lam: '#6a7ab0', gua: '#ffd23a', gem: '#9ae8ff', run: '#9ae8ff', cabo: '#3a2a4a' },
  solar: { tipo: 'arco', lam: '#ff9a2a', gua: '#ffe27a', gem: '#fff0a0', run: '#ffd04a', cabo: '#8a3a1a' },
  glacial: { tipo: 'cajado', lam: '#8ad8ff', gua: '#e0f4ff', gem: '#bff4ff', run: '#ffffff', cabo: '#3a6a9a' },
  sangue: { tipo: 'foice', lam: '#9a1a2a', gua: '#3a0a14', gem: '#ff4a5a', run: '#ff4a5a', cabo: '#2a0a10' },
  vulcao: { tipo: 'machado', lam: '#3a2a2a', gua: '#6a2a1a', gem: '#ffb03a', run: '#ff7a1a', cabo: '#2a1a14' },
  sombra: { tipo: 'adaga', lam: '#3a2a5a', gua: '#1a1028', gem: '#b07aff', run: '#9a5ae8', cabo: '#1a1028', dentes: 1 },
};
export const tipoDe = chave => { const [a, b] = chave.split(':'); return a === 'L' ? LENDA[b]?.tipo : a; };

// ---- armas ----
function arma(chave) {
  const [a, b] = chave.split(':'), L = a === 'L' ? LENDA[b] : null, tipo = L ? L.tipo : a, r = L ? 5 : Math.min(5, +b || 0), P = paleta(r, L), g = new THREE.Group();
  if (tipo === 'espada' || tipo === 'adaga') {
    const ad = tipo === 'adaga', C = ad ? 0.6 + 0.04 * r : 1.15 + 0.08 * r, W = (ad ? 0.08 : 0.1) + 0.012 * r, G = (ad ? 0.18 : 0.26) + 0.03 * r;
    cabo(g, P, -0.3, 0.12);
    g.add(malha(r >= 2 ? gema(0.09) : new THREE.SphereGeometry(0.08, 8, 6), r >= 2 ? P.gem : P.gua, 0, -0.36));
    const gp = esp([[0, 0.1], [G * 0.6, 0.1], [G, 0.14], [G + 0.06, 0.24], [G - 0.02, 0.22], [G * 0.5, 0.2], [0, 0.22]]); g.add(malha(recorte(gp, 0.08, 0.02), P.gua));
    if (r >= 3 || L) for (const s of [1, -1]) g.add(malha(new THREE.ConeGeometry(0.03, 0.14, 5), P.gua, s * (G + 0.06), 0.3, 0, 0, 0, -s * 0.3));
    g.add(malha(gema(0.06), P.gem, 0, 0.17, 0.05, 0, 0, 0, 1, 1.3, 0.8));
    const dir = [[W, 0.22]]; if (L?.dentes) for (let y = 0.35; y < 0.22 + C * 0.65; y += 0.16) dir.push([W, y], [W + 0.07, y + 0.04], [W, y + 0.08]); // dentes no fio
    g.add(malha(recorte([[-W, 0.22], ...dir, [W * 0.95, 0.22 + C * 0.75], [0, 0.22 + C], [-W * 0.95, 0.22 + C * 0.75]], 0.03, 0.035), P.lam));
    if (r >= 2) g.add(malha(new THREE.BoxGeometry(0.025, C * 0.6, 0.11), P.runa, 0, 0.3 + C * 0.3));
    if (L?.asas) for (const s of [1, -1]) for (let i = 0; i < 3; i++) g.add(malha(new THREE.ConeGeometry(0.05, 0.4 - i * 0.08, 4), P.lam, s * (0.2 + i * 0.1), 0.3 + i * 0.06, 0, 0, 0, -s * (0.9 + i * 0.25), 1, 1, 0.3));
    if (r >= 4) brilhos(g, L?.run || RAR[r], 5, 0.22, 0.3, 0.2 + C);
  } else if (tipo === 'machado') {
    const s = 1 + 0.05 * r; cabo(g, P, -0.45, 0.85, 0.06); g.add(malha(new THREE.ConeGeometry(0.06, 0.14, 6), P.lam, 0, 0.92));
    const cab = [[0.04, 0.45], [0.18, 0.5], [0.34, 0.38], [0.44, 0.52], [0.46, 0.66], [0.44, 0.8], [0.34, 0.92], [0.18, 0.8], [0.04, 0.84]].map(([x, y]) => [x * s, 0.45 + (y - 0.45) * s]);
    g.add(malha(recorte(cab, 0.05, 0.035), P.lam));
    if (r >= 2 || L) g.add(malha(recorte([[-0.04, 0.55], [-0.24 * s, 0.62], [-0.3 * s, 0.68], [-0.24 * s, 0.74], [-0.04, 0.78]], 0.04, 0.03), P.lam));
    g.add(malha(cil(0.085, 0.085, 0.42, 8), P.gua, 0, 0.66)); g.add(malha(gema(0.06), P.gem, 0.16 * s, 0.66, 0.06));
    if (L) g.add(malha(new THREE.BoxGeometry(0.03, 0.3, 0.1), P.runa, 0.3 * s, 0.66, 0, 0, 0, 0.3));
    if (r >= 4) brilhos(g, L?.run || RAR[r], 5, 0.35, 0.4, 0.9);
  } else if (tipo === 'martelo') {
    const w = 0.24 + 0.02 * r; cabo(g, P, -0.45, 0.7, 0.06); g.add(malha(new THREE.SphereGeometry(0.08, 8, 6), P.gua, 0, -0.5));
    g.add(malha(new THREE.BoxGeometry(w * 2, 0.32, 0.3), P.lam, 0, 0.82)); for (const x of [-w, w]) g.add(malha(cil(0.19, 0.19, 0.1, 8), P.gua, x, 0.82, 0, 0, 0, Math.PI / 2));
    g.add(malha(gema(0.08), P.gem, 0, 0.82, 0.16)); if (r >= 2 || L) g.add(malha(new THREE.ConeGeometry(0.07, 0.18, 6), P.gua, 0, 1.06));
    if (L) for (const s of [1, -1]) g.add(malha(new THREE.BoxGeometry(0.03, 0.22, 0.03), P.runa, s * 0.1, 0.82, 0.16, 0, 0, s * 0.5));
    if (r >= 4) brilhos(g, L?.run || RAR[r], 6, 0.35, 0.6, 1);
  } else if (tipo === 'lanca') {
    cabo(g, P, -0.7, 1.05, 0.045); g.add(malha(cil(0.07, 0.07, 0.08, 8), P.gua, 0, 1.08));
    g.add(malha(recorte([[0, 1.1], [0.1, 1.24], [0.07, 1.48], [0, 1.66], [-0.07, 1.48], [-0.1, 1.24]], 0.03, 0.03), P.lam));
    if (r >= 2) for (const s of [1, -1]) g.add(malha(new THREE.ConeGeometry(0.03, 0.18, 4), P.gua, s * 0.1, 1.1, 0, 0, 0, -s * 1.1));
    g.add(malha(new THREE.ConeGeometry(0.06, 0.25, 6), mat(RAR[r]), 0.04, 0.96, 0, Math.PI, 0, 0.2));
    if (r >= 4) brilhos(g, RAR[r], 4, 0.18, 1.1, 1.6);
  } else if (tipo === 'cajado') {
    const o = 0.13 + 0.012 * r; cabo(g, P, -0.7, 0.85, 0.045);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; g.add(malha(new THREE.ConeGeometry(0.03, 0.32, 5), P.gua, Math.cos(a) * 0.1, 1.0, Math.sin(a) * 0.1, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)); }
    g.add(malha(cil(0.08, 0.05, 0.08, 8), P.gua, 0, 0.88));
    g.add(malha(L?.tipo === 'cajado' ? new THREE.OctahedronGeometry(o, 0) : cristal(o), mat(L?.gem || RAR[Math.max(2, r)], { brilho: 0.9, rug: 0.15 }), 0, 1.06 + o, 0, 0, 0, 0, 1, L ? 1.8 : 1));
    if (r >= 3) g.add(malha(new THREE.TorusGeometry(o + 0.08, 0.012, 4, 20), P.runa, 0, 1.06 + o, 0, Math.PI / 2 - 0.3));
    if (r >= 4) brilhos(g, L?.run || RAR[r], 6, o + 0.15, 0.95, 1.4);
  } else if (tipo === 'arco') {
    const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.32, 0.75, 0), new THREE.Vector3(0.25, 0, 0), new THREE.Vector3(-0.32, -0.75, 0));
    g.add(malha(new THREE.TubeGeometry(curva, 14, 0.035, 6), mat(L?.lam || (r >= 3 ? '#4a2a3a' : '#8a5a2a'), { rug: 0.6 })));
    g.add(malha(cil(0.006, 0.006, 1.5, 4), mat('#f0e8d8'), -0.32, 0));
    g.add(malha(cil(0.05, 0.05, 0.2, 8), P.cabo, -0.03, 0));
    for (const s of [1, -1]) { g.add(malha(new THREE.ConeGeometry(0.04, 0.12, 6), P.gua, -0.32, s * 0.79, 0, s > 0 ? 0 : Math.PI)); if (r >= 2) g.add(malha(gema(0.045), P.gem, 0.02, s * 0.3, 0.03)); }
    if (L) for (const s of [1, -1]) g.add(malha(new THREE.ConeGeometry(0.05, 0.2, 5), P.runa, -0.36, s * 0.9, 0, s > 0 ? 0 : Math.PI));
    if (r >= 4) brilhos(g, L?.run || RAR[r], 5, 0.2, -0.6, 0.6);
    g.rotation.set(0, 0, 0);
  } else { // foice
    cabo(g, P, -0.7, 1.0, 0.045); g.add(malha(cil(0.07, 0.07, 0.1, 8), P.gua, 0, 1.0));
    g.add(malha(recorte([[0.05, 0.98], [-0.1, 1.1], [-0.35, 1.13], [-0.6, 1.05], [-0.8, 0.88], [-0.9, 0.66], [-0.72, 0.84], [-0.5, 0.97], [-0.28, 1.02], [-0.06, 0.98]], 0.03, 0.03), P.lam));
    if (r >= 3) g.add(malha(gema(0.05), P.gem, -0.05, 1.04, 0.05));
    if (r >= 4) brilhos(g, L?.run || RAR[r], 5, 0.3, 0.7, 1.15);
  }
  return g;
}

// ---- armaduras e acessórios ----
const PANOS = { Knight: '#c83a3a', Barbarian: '#8a5a3a', Mage: '#4a5ad8', Ranger: '#3a8a4a', Rogue: '#4a4a5a', Rogue_Hooded: '#3a3a4a', mago: '#4a5ad8', lenco: '#3a3a4a', viseira: '#c83a3a', urso: '#7a4a2a' };
function cores(r, vis) {
  const metal = r >= 4 ? (r === 5 ? '#ffb84a' : '#ffd23a') : ['#9aa2ae', '#aab4c0', '#a8bcd8', '#b8a8e0'][r];
  return { metal: mat(metal, { metal: 0.7, rug: 0.3 }), enfeite: mat(r >= 3 ? '#ffc23a' : '#b07a3a', { metal: 0.6, rug: 0.35 }), gem: mat(RAR[Math.max(1, r)], { brilho: r >= 2 ? 0.8 : 0.2, rug: 0.2 }),
    pano: mat(new THREE.Color(PANOS[vis] || '#c83a3a').lerp(new THREE.Color(RAR[r]), r >= 2 ? 0.25 : 0).getStyle(), { rug: 0.85 }), couro: mat('#8a5a32', { rug: 0.8 }), pelo: mat('#7a4a2a', { rug: 1 }), escuro: mat('#1a1420', { rug: 0.9 }) };
}
function elmo(vis, r) {
  const K = cores(r, vis), g = new THREE.Group();
  if (vis === 'mago') { g.add(malha(new THREE.ConeGeometry(0.36, 0.9, 8), K.pano, 0, 0.45, 0, -0.25, 0, 0.15)); g.add(malha(cil(0.62, 0.62, 0.05, 12), K.pano, 0, 0)); g.add(malha(new THREE.TorusGeometry(0.4, 0.04, 4, 12), K.enfeite, 0, 0.05, 0, Math.PI / 2)); g.add(malha(gema(0.07), K.gem, 0, 0.16, 0.38)); return g; }
  if (vis === 'urso') { g.add(malha(new THREE.SphereGeometry(0.45, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), K.pelo, 0, 0)); for (const s of [1, -1]) g.add(malha(new THREE.SphereGeometry(0.12, 8, 6), K.pelo, s * 0.32, 0.36, 0)); g.add(malha(new THREE.SphereGeometry(0.14, 8, 6), mat('#c89a6a'), 0, 0.12, 0.42, 0, 0, 0, 1, 0.7, 1)); g.add(malha(new THREE.SphereGeometry(0.04, 6, 4), K.escuro, 0, 0.16, 0.54)); for (const s of [1, -1]) g.add(malha(new THREE.SphereGeometry(0.04, 6, 4), K.escuro, s * 0.15, 0.3, 0.38)); return g; }
  if (vis === 'lenco') { g.add(malha(new THREE.TorusGeometry(0.42, 0.1, 4, 16, Math.PI * 1.2), K.pano, 0, 0, 0, 0, 0, -0.1 + Math.PI * -0.1)); g.add(malha(new THREE.BoxGeometry(0.62, 0.2, 0.12), K.pano, 0, 0.02, 0.36)); for (const s of [1, -1]) g.add(malha(new THREE.BoxGeometry(0.16, 0.08, 0.04), K.escuro, s * 0.15, 0.04, 0.43)); return g; }
  // elmo de metal (aberto ou com viseira)
  g.add(malha(new THREE.SphereGeometry(0.46, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), K.metal, 0, 0));
  g.add(malha(new THREE.TorusGeometry(0.44, 0.045, 4, 16), K.enfeite, 0, 0.02, 0, Math.PI / 2));
  if (vis === 'viseira') { g.add(malha(new THREE.CylinderGeometry(0.44, 0.4, 0.38, 10, 1, true, -1.2, 2.4), K.metal, 0, -0.17)); g.add(malha(new THREE.BoxGeometry(0.5, 0.05, 0.08), K.escuro, 0, -0.08, 0.42));
    for (let i = 0; i < 4; i++) g.add(malha(new THREE.BoxGeometry(0.04, 0.04, 0.05), K.escuro, -0.12 + i * 0.08, -0.22, 0.41)); g.add(malha(new THREE.ConeGeometry(0.08, 0.45, 6), K.pano, 0, 0.6, -0.06, -0.4)); }
  else { g.add(malha(new THREE.BoxGeometry(0.07, 0.34, 0.08), K.metal, 0, -0.12, 0.44)); for (const s of [1, -1]) g.add(malha(new THREE.BoxGeometry(0.1, 0.36, 0.3), K.metal, s * 0.4, -0.14, 0.05)); }
  g.add(malha(gema(0.07), K.gem, 0, 0.3, 0.36));
  if (r >= 3) for (const s of [1, -1]) g.add(malha(new THREE.ConeGeometry(0.07, 0.35, 6), K.enfeite, s * 0.36, 0.34, 0, 0, 0, -s * 0.7));
  if (r >= 5) g.add(malha(new THREE.TorusGeometry(0.3, 0.025, 4, 20), mat('#ffe27a', { brilho: 1.4 }), 0, 0.62, 0, Math.PI / 2 - 0.2));
  return g;
}
function armadura(vis, r) {
  const K = cores(r, vis), g = new THREE.Group(), pano = vis === 'Mage' || vis === 'Rogue' || vis === 'Ranger';
  const peito = recorte(esp([[0, -0.42], [0.28, -0.42], [0.34, -0.1], [0.38, 0.25], [0.24, 0.36], [0.1, 0.3], [0, 0.26]]), 0.26, 0.06);
  g.add(malha(peito, vis === 'Knight' ? K.metal : vis === 'Barbarian' ? K.couro : K.pano));
  g.add(malha(new THREE.BoxGeometry(0.62, 0.08, 0.36), vis === 'Knight' ? K.enfeite : K.couro, 0, -0.32));
  g.add(malha(new THREE.BoxGeometry(0.1, 0.1, 0.06), K.enfeite, 0, -0.32, 0.2));
  if (vis === 'Knight') { for (const s of [1, -1]) g.add(malha(new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), K.metal, s * 0.42, 0.24, 0, 0, 0, -s * 0.4)); g.add(malha(new THREE.BoxGeometry(0.05, 0.5, 0.05), K.enfeite, 0, 0, 0.19)); }
  if (vis === 'Barbarian') for (let i = 0; i < 7; i++) g.add(malha(new THREE.SphereGeometry(0.11, 6, 5), K.pelo, -0.36 + i * 0.12, 0.3, 0.02 * (i % 2)));
  if (vis === 'Mage') { g.add(malha(new THREE.BoxGeometry(0.08, 0.68, 0.04), K.enfeite, 0, -0.04, 0.2)); g.add(malha(new THREE.ConeGeometry(0.4, 0.4, 8, 1, true), K.pano, 0, -0.6, 0)); }
  if (vis === 'Ranger') { g.add(malha(new THREE.BoxGeometry(0.06, 0.7, 0.04), K.couro, 0.05, 0, 0.19, 0, 0, 0.6)); for (const s of [1, -1]) g.add(malha(new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), K.couro, s * 0.4, 0.22, 0, 0, 0, -s * 0.4)); }
  if (vis === 'Rogue') for (const y of [-0.15, 0.05]) g.add(malha(new THREE.BoxGeometry(0.66, 0.05, 0.32), K.couro, 0, y, 0, 0, 0, 0.15));
  g.add(malha(gema(0.075), K.gem, 0, 0.1, 0.2)); if (r >= 4) g.add(malha(new THREE.TorusGeometry(0.1, 0.02, 4, 12), K.enfeite, 0, 0.1, 0.19));
  if (pano && r >= 3) for (const s of [1, -1]) g.add(malha(new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), K.metal, s * 0.42, 0.24, 0, 0, 0, -s * 0.4));
  return g;
}
function capa(vis, r) {
  const K = cores(r, vis), g = new THREE.Group(), geo = new THREE.PlaneGeometry(0.8, 1.1, 6, 6), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), abre = 1 + (0.55 - y) * 0.45; p.setX(i, x * abre); p.setZ(i, -Math.abs(x) * 0.35 - Math.sin((y + 0.55) * 3 + x * 6) * 0.03); }
  geo.computeVertexNormals(); const m = K.pano.clone(); m.side = THREE.DoubleSide; g.add(malha(geo, m, 0, -0.05, 0));
  g.add(malha(cil(0.03, 0.03, 0.7, 6), K.enfeite, 0, 0.5, 0.02, 0, 0, Math.PI / 2)); for (const s of [1, -1]) g.add(malha(gema(0.06), K.gem, s * 0.3, 0.5, 0.06));
  if (vis === 'Rogue_Hooded') g.add(malha(new THREE.SphereGeometry(0.3, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), K.pano, 0, 0.6, -0.08, -0.5));
  if (r >= 4) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.012, 3, 6), K.enfeite); for (let i = 0; i < 5; i++) g.add(malha(b.geometry, K.enfeite, -0.5 + i * 0.25, -0.6, -0.2, 0, 0, 0, 3)); }
  return g;
}
function anel(vis, r) {
  const K = cores(r), g = new THREE.Group(), grosso = vis === 'Aliança' ? 0.07 : 0.045;
  g.add(malha(new THREE.TorusGeometry(0.28, grosso, 6, 20), K.enfeite, 0, 0));
  if (vis !== 'Aliança') { if (vis === 'Selo') g.add(malha(new THREE.BoxGeometry(0.24, 0.08, 0.2), K.enfeite, 0, 0.32)); else for (const s of [1, -1]) g.add(malha(new THREE.ConeGeometry(0.03, 0.12, 4), K.enfeite, s * 0.07, 0.33, 0, 0, 0, s * 0.4));
    g.add(malha(vis === 'Selo' ? new THREE.BoxGeometry(0.16, 0.05, 0.14) : gema(0.11), K.gem, 0, vis === 'Selo' ? 0.37 : 0.42)); }
  else g.add(malha(new THREE.TorusGeometry(0.28, 0.02, 4, 24), K.gem, 0, 0, 0.05));
  return g;
}
function amuleto(vis, r) {
  const K = cores(r), g = new THREE.Group();
  g.add(malha(new THREE.TorusGeometry(0.42, 0.018, 4, 24, Math.PI), K.enfeite, 0, 0.1, 0, 0, 0, Math.PI));
  if (vis === 'Talismã') { g.add(malha(cil(0.18, 0.18, 0.05, 10), K.enfeite, 0, -0.42, 0, Math.PI / 2)); g.add(malha(cil(0.13, 0.13, 0.06, 10), K.metal, 0, -0.42, 0.01, Math.PI / 2)); g.add(malha(gema(0.06), K.gem, 0, -0.42, 0.06)); }
  else if (vis === 'Relíquia') { g.add(malha(new THREE.BoxGeometry(0.07, 0.36, 0.06), K.metal, 0, -0.5)); g.add(malha(new THREE.BoxGeometry(0.24, 0.07, 0.06), K.metal, 0, -0.44)); g.add(malha(gema(0.05), K.gem, 0, -0.44, 0.04)); }
  else { g.add(malha(new THREE.TorusGeometry(0.15, 0.03, 4, 12), K.enfeite, 0, -0.44)); g.add(malha(vis === 'Pingente' ? new THREE.OctahedronGeometry(0.13, 0) : cristal(0.13), K.gem, 0, -0.44, 0, 0, 0, 0, 1, vis === 'Pingente' ? 1.5 : 1, 0.7)); }
  return g;
}

// ---- entrada ----
// modelos montados uma vez e copiados (as cópias dividem geometria e material: nada para liberar depois)
const moldes = new Map(), copia = (k, f) => { let m = moldes.get(k); if (!m) { m = f(); moldes.set(k, m); } return m.clone(); };
export function modeloItem(it) {
  if (it.slot === 'arma') return armaModelo(it.modelo?.startsWith('P:') ? it.modelo.slice(2) : 'espada:' + it.r);
  const vis = it.vis || it.nome.split(' ')[0], r = it.r;
  return copia(`${it.slot}:${vis}:${r}`, () => it.slot === 'elmo' ? elmo(vis, r) : it.slot === 'armadura' ? armadura(vis, r) : it.slot === 'capa' ? capa(vis, r) : it.slot === 'anel' ? anel(vis, r) : amuleto(vis, r));
}
export const armaModelo = chave => copia('A:' + chave, () => arma(chave));
window.__i3 = { modeloItem, armaModelo }; // testes
