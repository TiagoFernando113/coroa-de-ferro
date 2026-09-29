// Mapa da defesa: base atrás da muralha (z > 0) e o campo por onde os esqueletos vêm (z < 0).
// Coordenadas em metros: x = leste, z = sul. Os inimigos chegam do norte (-z).

export const LIM = 72;
const P = Math.PI;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export const MURO = { x0: -36, x1: 36, z: 0, vao: 3 };       // muralha com portão no meio
export const NASCER = { x: 0, z: 18 };
// estradas: os inimigos seguem os pontos e no fim escolhem um trecho da muralha
export const ESTRADAS = [
  [[-50, -70], [-36, -48], [-16, -28], [-4, -8]],
  [[50, -70], [36, -48], [16, -28], [4, -8]],
  [[0, -72], [-3, -48], [2, -26], [0, -8]],
];
export const SLOTS = [
  { id: 's1', x: -24, z: 6 }, { id: 's2', x: -15, z: 6 }, { id: 's3', x: -6, z: 7 },
  { id: 's4', x: 6, z: 7 }, { id: 's5', x: 15, z: 6 }, { id: 's6', x: 24, z: 6 },
  { id: 's7', x: -11, z: 16 }, { id: 's8', x: 11, z: 16 },
].map(s => ({ ...s, pad: { x: s.x, z: s.z + 4.2 } }));
export const PADS = {
  muralha: { x: 0, z: 7, icone: '🧱' },
  mina: { x: -21, z: 27, icone: '⛏️' },
  cofre: { x: -21, z: 33, icone: '💰' },
  arma: { x: 21, z: 27, icone: '🗡️' },
  armadura: { x: 21, z: 33, icone: '🛡️' },
};
export const MINA = { x: -28, z: 30 };
export const FORJA = { x: 28, z: 30 };

export function zonaDe(x, z) { return z > 1 ? 'base' : 'campo'; }

export function criarMundo() {
  const pecas = [], circ = [], caixas = [], casas = [], caminhos = [];
  const add = (m, x, z, ry = 0, s = 1, y = 0) => pecas.push({ m, x, y, z, ry, s });
  const r = rng(11);
  for (const e of ESTRADAS) caminhos.push({ w: 5, pts: e.concat([[e[e.length - 1][0], -1]]) });
  caminhos.push({ w: 4, pts: [[0, 1], [0, 30]] });
  caminhos.push({ w: 3.5, pts: [[-24, 29], [24, 29]] });

  // muralha (colisão só para o herói; o portão fica aberto para ele)
  caixas.push({ x0: MURO.x0 - 1, x1: -MURO.vao, z0: -1.3, z1: 1.3 }, { x0: MURO.vao, x1: MURO.x1 + 1, z0: -1.3, z1: 1.3 });
  circ.push({ x: MURO.x0, z: 0, r: 2.6 }, { x: MURO.x1, z: 0, r: 2.6 });
  for (const s of SLOTS) circ.push({ x: s.x, z: s.z, r: 2.4 });

  // casas decorativas nos fundos da base
  const casa = (cx, cz, prof, madeira, chamine) => {
    const rot = cz > 30 ? P : 0, S = 3, W = madeira ? 'T:wall-wood' : 'T:wall', PORTA = W + '-door', JAN = W + '-window-shutters';
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const put = (m, lx, ly, lz, ry) => { const x = lx * S, z = lz * S; add(m, cx + x * cs + z * sn, cz - x * sn + z * cs, ry + rot, S, ly * S); };
    const zs = []; for (let i = 0; i < prof; i++) zs.push(i - (prof - 1) / 2);
    const zMax = zs[zs.length - 1], zMin = zs[0];
    for (const z of zs) { put(z === zMax ? W : JAN, 0.5, 0, z, 0); put(z === zMin ? JAN : W, -0.5, 0, z, P); put('T:roof', -0.5, 1, z, 0); put('T:roof', 0.5, 1, z, P); }
    put(PORTA, 0.5, 0, zMax, -P / 2); put(JAN, -0.5, 0, zMax, -P / 2); put(W, -0.5, 0, zMin, P / 2); put(JAN, 0.5, 0, zMin, P / 2);
    if (chamine) put('T:chimney', -0.3, 1.2, zMin, 0);
    const ax = S, az = prof * S / 2;
    caixas.push({ x0: cx - ax - 0.2, x1: cx + ax + 0.2, z0: cz - az - 0.2, z1: cz + az + 0.2 }); casas.push({ x: cx, z: cz, ax, az });
  };
  casa(-12, 44, 2, false, true); casa(0, 47, 2, true, false); casa(12, 44, 3, false, true); casa(-30, 46, 2, true, true); casa(30, 46, 2, false, false);
  add('T:fountain-round', 0, 26, 0, 2); circ.push({ x: 0, z: 26, r: 2.2 });
  for (const [x, z] of [[-6, 20], [6, 20], [-6, 32], [6, 32]]) { add('T:lantern', x, z, 0, 2.2); circ.push({ x, z, r: 0.35 }); }
  add('T:banner-red', -4, 2.5, 0, 2.5); add('T:banner-red', 4, 2.5, 0, 2.5);
  // mina e forja (prédios fixos; o nível aparece nos detalhes)
  add('N:rock_largeA', MINA.x - 2, MINA.z + 2, 0.4, 7); add('N:rock_largeC', MINA.x + 1, MINA.z + 3, 1.2, 5); circ.push({ x: MINA.x - 1, z: MINA.z + 2, r: 3.2 });
  add('T:cart', MINA.x + 2.5, MINA.z - 1, 0.3, 2.4); circ.push({ x: MINA.x + 2.5, z: MINA.z - 1, r: 1.3 });
  add('T:stall-red', FORJA.x, FORJA.z, P / 2, 3); caixas.push({ x0: FORJA.x - 1.6, x1: FORJA.x + 1.6, z0: FORJA.z - 1.6, z1: FORJA.z + 1.6 });
  add('D:barrel', FORJA.x - 2.5, FORJA.z + 2, 0, 2); add('D:weapon-sword', FORJA.x - 2.2, FORJA.z - 2, 0.4, 2.2); add('T:chimney', FORJA.x + 1.2, FORJA.z, 0, 3, 3.4);
  // cercas nas laterais da base
  for (let z = 4; z < 56; z += 3) { add('T:fence', MURO.x0 - 1, z, 0, 3); add('T:fence', MURO.x1 + 1, z, P, 3); }
  caixas.push({ x0: MURO.x0 - 3, x1: MURO.x0 - 0.6, z0: 1, z1: 58 }, { x0: MURO.x1 + 0.6, x1: MURO.x1 + 3, z0: 1, z1: 58 });

  // floresta ao redor (fora das estradas)
  const ARV = ['N:tree_oak', 'N:tree_default', 'N:tree_fat', 'N:tree_pineTallA', 'N:tree_pineRoundB', 'N:tree_detailed', 'N:tree_oak_dark', 'N:tree_default_dark'];
  const perto = (x, z, m) => { for (const c of caminhos) for (let i = 0; i < c.pts.length - 1; i++) if (distSeg(x, z, c.pts[i], c.pts[i + 1]) < c.w / 2 + m) return true; return false; };
  for (let i = 0; i < 700; i++) {
    const x = -LIM - 10 + r() * (LIM * 2 + 20), z = -LIM - 10 + r() * (LIM * 2 + 20);
    const dentro = x > MURO.x0 - 4 && x < MURO.x1 + 4 && z > -3 && z < 58;
    const campo = z < -3 && Math.abs(x) < 58 && z > -66;
    const dens = dentro ? 0 : campo ? 0.12 : 0.7;
    if (r() > dens || perto(x, z, 3)) continue;
    let ok = true; for (const c of circ) if (Math.hypot(x - c.x, z - c.z) < c.r + 1.5) ok = false; if (!ok) continue;
    const m = ARV[Math.floor(r() * ARV.length)]; add(m, x, z, r() * 6.28, 4.3 + r() * 1.8);
    if (Math.abs(x) < LIM + 2 && Math.abs(z) < LIM + 2) circ.push({ x, z, r: 0.7 });
  }
  for (let i = 0; i < 40; i++) { const x = -55 + r() * 110, z = -66 + r() * 60; if (!perto(x, z, 2)) { add(r() < 0.5 ? 'N:rock_largeA' : 'N:stone_largeB', x, z, r() * 6, 2.5 + r() * 2.5); circ.push({ x, z, r: 1.1 }); } }
  // túmulos de onde saem os esqueletos
  for (const e of ESTRADAS) { const [x, z] = e[0]; add('N:statue_obelisk', x - 4, z + 2, 0, 5); add('N:statue_columnDamaged', x + 4, z + 1, 1, 5); }
  // grama e flores
  const ENF = ['N:grass', 'N:grass_large', 'N:flower_redA', 'N:flower_yellowA', 'N:flower_purpleA', 'N:plant_bush'];
  for (let i = 0; i < 900; i++) {
    const x = -LIM + r() * LIM * 2, z = -LIM + r() * LIM * 2;
    if (perto(x, z, 0.5) || Math.abs(z) < 3) continue;
    let ok = true; for (const s of SLOTS) if (Math.hypot(x - s.x, z - s.z) < 3.5 || Math.hypot(x - s.pad.x, z - s.pad.z) < 2) ok = false; if (!ok) continue;
    const m = ENF[Math.floor(r() * ENF.length)]; add(m, x, z, r() * 6.28, m.includes('bush') ? 4 : 3 + r() * 1.5);
  }
  const patios = [{ x0: MURO.x0, x1: MURO.x1, z0: 1.5, z1: 38, cor: '#8f9a6a' }];
  return { pecas, circ, caixas, casas, caminhos, patios };
}

export function distSeg(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz;
  let t = l ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t);
}
// empurra um círculo (x,z,r) para fora dos obstáculos
export function colidir(M, o, r) {
  for (const c of M.circ) {
    const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
    if (d < m && d > 1e-4) { o.x = c.x + dx / d * m; o.z = c.z + dz / d * m; }
  }
  for (const b of M.caixas) {
    if (o.x < b.x0 - r || o.x > b.x1 + r || o.z < b.z0 - r || o.z > b.z1 + r) continue;
    const e = o.x - (b.x0 - r), d = (b.x1 + r) - o.x, n = o.z - (b.z0 - r), s = (b.z1 + r) - o.z, m = Math.min(e, d, n, s);
    if (m === e) o.x = b.x0 - r; else if (m === d) o.x = b.x1 + r; else if (m === n) o.z = b.z0 - r; else o.z = b.z1 + r;
  }
  o.x = Math.max(-LIM, Math.min(LIM, o.x)); o.z = Math.max(-LIM, Math.min(58, o.z));
}
