// Mapa do mundo: peças de cenário, colisões, zonas, inimigos e NPCs.
// Coordenadas em metros: x = leste, z = sul (norte é -z). O mapa vai de -LIM a +LIM.

export const LIM = 104;
const P = Math.PI;

// gerador aleatório com semente (o mapa é sempre igual)
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export const ZONAS = {
  vila: { nome: 'Vila Carvalho', x: 0, z: 0, r: 24, segura: true },
  floresta: { nome: 'Floresta Sombria', cor: '#2f5a2a' },
  ruinas: { nome: 'Ruínas do Leste', cor: '#8a7a55' },
  castelo: { nome: 'Castelo do Rei Esqueleto', cor: '#6a6a70' },
  campos: { nome: 'Campos', cor: '#5f8f3f' },
};
export function zonaDe(x, z) {
  if (Math.hypot(x, z) < ZONAS.vila.r) return 'vila';
  if (z < -28 && x < 45) return 'floresta';
  if (x > 40 && z > -40 && z < 40) return 'ruinas';
  if (z > 45 && Math.abs(x) < 40) return 'castelo';
  return 'campos';
}

export const CASTELO = { x0: -24, x1: 24, z0: 56, z1: 96, portao: { x: 0, z: 56 } };
export const NASCER = { x: 0, z: 5 };

export function criarMundo() {
  const pecas = [], circ = [], caixas = [], casas = [], caminhos = [];
  const add = (m, x, z, ry = 0, s = 1, y = 0) => pecas.push({ m, x, y, z, ry, s });
  const r = rng(7);

  // livre de obstáculos? (caminhos, praça, castelo, clareiras)
  const livre = (x, z, folga = 0) => {
    if (Math.hypot(x, z) < 26 + folga) return false;
    for (const c of caminhos) for (let i = 0; i < c.pts.length - 1; i++) if (distSeg(x, z, c.pts[i], c.pts[i + 1]) < c.w / 2 + 2 + folga) return false;
    if (x > CASTELO.x0 - 6 && x < CASTELO.x1 + 6 && z > CASTELO.z0 - 10 && z < CASTELO.z1 + 6) return false;
    for (const [cx, cz, cr] of CLAREIRAS) if (Math.hypot(x - cx, z - cz) < cr + folga) return false;
    for (const c of circ) if (Math.hypot(x - c.x, z - c.z) < c.r + 1.2 + folga) return false;
    return true;
  };
  const CLAREIRAS = [[-32, -84, 13], [10, -60, 9], [78, 0, 14], [60, 25, 8], [58, -22, 8]];

  // ---------- caminhos (terra batida) ----------
  caminhos.push({ w: 4.5, pts: [[0, -6], [2, -30], [-4, -55], [-20, -72], [-30, -82]] }); // norte → acampamento
  caminhos.push({ w: 4, pts: [[-4, -55], [10, -60]] });
  caminhos.push({ w: 4.5, pts: [[6, 0], [30, 2], [55, -4], [76, 0]] });                   // leste → ruínas
  caminhos.push({ w: 5, pts: [[0, 6], [2, 30], [0, 52]] });                               // sul → castelo

  // ---------- vila ----------
  add('T:fountain-round', 0, 0, 0, 2.2); circ.push({ x: 0, z: 0, r: 2.4 });
  const casa = (cx, cz, prof, madeira, chamine) => {
    // porta (+z local) virada para a praça, em múltiplos de 90° (colisão alinhada aos eixos)
    const rot = Math.round(Math.atan2(-cx, -cz) / (P / 2)) * (P / 2);
    const S = 3, W = madeira ? 'T:wall-wood' : 'T:wall', PORTA = W + '-door', JAN = W + '-window-shutters';
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const put = (m, lx, ly, lz, ry) => { const x = lx * S, z = lz * S; add(m, cx + x * cs + z * sn, cz - x * sn + z * cs, ry + rot, S, ly * S); };
    const zs = []; for (let i = 0; i < prof; i++) zs.push(i - (prof - 1) / 2);
    const zMax = zs[zs.length - 1], zMin = zs[0];
    for (const z of zs) {
      put(z === zMax ? W : JAN, 0.5, 0, z, 0); put(z === zMin ? JAN : W, -0.5, 0, z, P); // laterais
      put('T:roof', -0.5, 1, z, 0); put('T:roof', 0.5, 1, z, P);
    }
    put(PORTA, 0.5, 0, zMax, -P / 2); put(JAN, -0.5, 0, zMax, -P / 2); // frente (+z local)
    put(W, -0.5, 0, zMin, P / 2); put(JAN, 0.5, 0, zMin, P / 2);        // fundos
    if (chamine) put('T:chimney', -0.3, 1.2, zMin, 0);
    const hx = S, hz = prof * S / 2, ax = Math.abs(cs) > 0.5 ? hx : hz, az = Math.abs(cs) > 0.5 ? hz : hx;
    caixas.push({ x0: cx - ax - 0.2, x1: cx + ax + 0.2, z0: cz - az - 0.2, z1: cz + az + 0.2 });
    casas.push({ x: cx, z: cz, ax, az });
  };
  casa(-13, -12, 2, false, true);  // noroeste
  casa(13, -13, 3, true, false);   // nordeste
  casa(-14, 13, 2, true, true);    // sudoeste
  casa(14, 13, 2, false, true);    // sudeste
  casa(-19, 0, 3, false, false);   // oeste
  casa(12, -25, 2, true, true);
  casa(-12, 25, 2, false, false);
  add('T:windmill', -30, -14, 0.4, 3); circ.push({ x: -30, z: -14, r: 3 });
  // barracas, lanternas, carroça, cercas
  add('T:stall-red', 6, 5, P, 2.6); caixas.push({ x0: 4.6, x1: 7.4, z0: 3.6, z1: 6.4 });
  add('T:stall-green', -6, 6, P, 2.6); caixas.push({ x0: -7.4, x1: -4.6, z0: 4.6, z1: 7.4 });
  add('T:stall-bench', 9, 6.5, P, 2.4);
  add('T:cart', 8, -6, 0.6, 2.4); circ.push({ x: 8, z: -6, r: 1.4 });
  add('D:barrel', -8.2, 4.5, 0, 2); add('D:barrel', -8.6, 7.4, 0, 2); circ.push({ x: -8.4, z: 6, r: 1 });
  add('D:weapon-sword', -8.3, 5.8, 0.5, 2, 0.95);
  for (let i = 0; i < 8; i++) { const a = i / 8 * P * 2 + P / 8; add('T:lantern', Math.cos(a) * 8.5, Math.sin(a) * 8.5, 0, 2.2); circ.push({ x: Math.cos(a) * 8.5, z: Math.sin(a) * 8.5, r: 0.35 }); }
  add('T:banner-red', 3, -7, 0, 2.5);
  for (let i = 0; i < 6; i++) add('N:crops_wheatStageB', -24 + (i % 3) * 2.2, 10 + Math.floor(i / 3) * 2.2, 0, 4);
  for (let i = 0; i < 4; i++) add('N:crop_pumpkin', -24 + i * 2, 16, i, 4);
  for (let i = 0; i < 6; i++) add('T:fence', -27 + i * 3, 19, P / 2, 3);

  // ---------- floresta (norte) ----------
  const ARV_F = ['N:tree_oak_dark', 'N:tree_pineTallA', 'N:tree_default_dark', 'N:tree_pineRoundB', 'N:tree_detailed', 'N:tree_fat'];
  const ARV_C = ['N:tree_oak', 'N:tree_default', 'N:tree_fat', 'N:tree_detailed', 'T:tree', 'T:tree-high-round'];
  const arvore = (x, z, lista) => { const m = lista[Math.floor(r() * lista.length)], s = 4.2 + r() * 1.8; add(m, x, z, r() * 6.28, m.startsWith('T:') ? s * 0.8 : s); circ.push({ x, z, r: 0.7 }); };
  for (let i = 0; i < 900; i++) {
    const x = -LIM + r() * LIM * 2, z = -LIM + r() * LIM * 2, zn = zonaDe(x, z);
    const dens = zn === 'floresta' ? 0.55 : zn === 'campos' ? 0.12 : zn === 'ruinas' ? 0.05 : 0;
    if (r() > dens || !livre(x, z, 1.5)) continue;
    arvore(x, z, zn === 'floresta' ? ARV_F : ARV_C);
  }
  // borda do mundo: anel de árvores e pedras
  for (let a = 0; a < 360; a += 1.6) {
    const t = a * P / 180, rr = LIM + 4 + r() * 6, x = Math.max(-LIM - 8, Math.min(LIM + 8, Math.cos(t) * rr * 1.42)), z = Math.max(-LIM - 8, Math.min(LIM + 8, Math.sin(t) * rr * 1.42));
    if (r() < 0.3) add('N:cliff_block_rock', x, z, r() * 6, 6); else add(ARV_F[Math.floor(r() * 6)], x, z, r() * 6, 5 + r() * 2);
  }
  // acampamento dos batedores
  add('N:tent_detailedOpen', -38, -88, 0.5, 6); circ.push({ x: -38, z: -88, r: 2.4 });
  add('N:tent_detailedOpen', -26, -92, -0.4, 6); circ.push({ x: -26, z: -92, r: 2.4 });
  add('N:campfire_stones', -31, -83, 0, 5); add('N:campfire_logs', -31, -83, 0, 4);
  add('N:log', -34, -80, 0.3, 5); add('N:log_stack', -40, -80, 0.2, 5); circ.push({ x: -40, z: -80, r: 1.4 });
  add('D:banner', -24, -80, 0, 3);
  // clareira com cogumelos
  for (let i = 0; i < 6; i++) add(i % 2 ? 'N:mushroom_redGroup' : 'N:mushroom_red', 10 + Math.cos(i) * 6, -60 + Math.sin(i) * 6, i, 5);
  add('N:stump_round', 12, -58, 0, 5); circ.push({ x: 12, z: -58, r: 0.8 });

  // ---------- ruínas (leste) ----------
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * P * 2, x = 78 + Math.cos(a) * 11, z = Math.sin(a) * 11;
    add(i % 3 === 0 ? 'N:statue_columnDamaged' : 'N:statue_column', x, z, a, 5); circ.push({ x, z, r: 0.8 });
  }
  add('N:statue_head', 70, 16, 0.8, 6); circ.push({ x: 70, z: 16, r: 1.6 });
  add('N:statue_obelisk', 90, -12, 0, 6); circ.push({ x: 90, z: -12, r: 1 });
  for (const [x, z, ry] of [[62, -18, 0.2], [66, -22, 1.4], [92, 14, 0.7], [60, 22, 2], [88, 20, 0.3], [95, -2, 1.6]]) {
    add('C:wall-half', x, z, ry, 4); circ.push({ x, z, r: 2 });
  }
  add('C:siege-catapult-demolished', 50, 18, 0.5, 4); circ.push({ x: 50, z: 18, r: 2 });
  for (let i = 0; i < 40; i++) { const x = 45 + r() * 58, z = -38 + r() * 76; if (livre(x, z)) { add(r() < 0.5 ? 'N:rock_largeA' : 'N:stone_largeB', x, z, r() * 6, 3 + r() * 3); circ.push({ x, z, r: 1.3 }); } }

  // ---------- castelo (sul) ----------
  const { x0, x1, z0, z1 } = CASTELO, CS = 4;
  const muro = (xa, za, xb, zb, pular) => {
    const n = Math.round(Math.hypot(xb - xa, zb - za) / CS), ry = Math.atan2(-(zb - za), xb - xa);
    for (let i = 0; i < n; i++) {
      const x = xa + (xb - xa) * (i + 0.5) / n, z = za + (zb - za) * (i + 0.5) / n;
      if (pular && pular(x, z)) continue;
      add('C:wall', x, z, ry, CS);
    }
    caixas.push({ x0: Math.min(xa, xb) - 1.2, x1: Math.max(xa, xb) + 1.2, z0: Math.min(za, zb) - 1.2, z1: Math.max(za, zb) + 1.2, pular });
  };
  const noPortao = x => Math.abs(x) < 4;
  // frente com vão do portão (colisão separada em duas caixas)
  muro(x0, z0, x1, z0, (x) => noPortao(x)); caixas.pop();
  caixas.push({ x0: x0 - 1.2, x1: -4, z0: z0 - 1.2, z1: z0 + 1.2 }, { x0: 4, x1: x1 + 1.2, z0: z0 - 1.2, z1: z0 + 1.2 });
  muro(x0, z1, x1, z1); muro(x0, z0, x0, z1); muro(x1, z0, x1, z1);
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [-5.5, z0], [5.5, z0]]) {
    add('C:tower-square', x, z, 0, CS + 0.6); add('C:tower-square-roof', x, z, 0, CS + 0.6, 1.31 * (CS + 0.6));
    circ.push({ x, z, r: 2.8 });
  }
  add('C:flag', -5.5, z0, 0, 4, 1.31 * 4.6 + 1.2); add('C:flag', 5.5, z0, 0, 4, 1.31 * 4.6 + 1.2);
  for (const [x, z] of [[-14, 70], [14, 70], [-14, 86], [14, 86]]) { add('D:column', x, z, 0, 4); circ.push({ x, z, r: 0.9 }); }
  add('D:banner', -8, 94, 0, 4); add('D:banner', 8, 94, 0, 4);
  add('C:stairs-stone', 0, 94, P, 4);

  // ---------- enfeites espalhados (grama, flores, arbustos) — sem colisão ----------
  const ENF = ['N:grass', 'N:grass_large', 'N:grass', 'N:flower_redA', 'N:flower_yellowA', 'N:flower_purpleA', 'N:plant_bush', 'N:grass_large'];
  for (let i = 0; i < 1400; i++) {
    const x = -LIM + r() * LIM * 2, z = -LIM + r() * LIM * 2, zn = zonaDe(x, z);
    if (zn === 'castelo' && x > x0 - 2 && x < x1 + 2 && z > z0 - 2) continue;
    if (Math.hypot(x, z) < 11) continue;
    let bad = false; for (const c of caminhos) for (let k = 0; k < c.pts.length - 1; k++) if (distSeg(x, z, c.pts[k], c.pts[k + 1]) < c.w / 2 + 0.4) bad = true;
    if (bad) continue;
    const m = zn === 'floresta' && r() < 0.3 ? 'N:mushroom_red' : ENF[Math.floor(r() * ENF.length)];
    add(m, x, z, r() * 6.28, m.includes('bush') ? 4 : 3 + r() * 1.5);
  }
  for (let i = 0; i < 70; i++) { const x = -LIM + r() * LIM * 2, z = -LIM + r() * LIM * 2; if (livre(x, z) && zonaDe(x, z) !== 'vila') { add('N:rock_largeC', x, z, r() * 6, 2.5 + r() * 2); circ.push({ x, z, r: 1 }); } }

  // ---------- inimigos ----------
  const spawns = [
    { tipo: 'lacaio', nivel: 1, x: 4, z: -40, raio: 8, qtd: 3 },
    { tipo: 'lacaio', nivel: 2, x: -14, z: -50, raio: 8, qtd: 3 },
    { tipo: 'lacaio', nivel: 2, x: 22, z: -48, raio: 9, qtd: 3 },
    { tipo: 'batedor', nivel: 2, x: 10, z: -62, raio: 7, qtd: 2 },
    { tipo: 'lacaio', nivel: 3, x: -8, z: -70, raio: 9, qtd: 4 },
    { tipo: 'batedor', nivel: 3, x: -28, z: -64, raio: 8, qtd: 2 },
    { tipo: 'lacaio', nivel: 3, x: 28, z: -78, raio: 9, qtd: 3 },
    { tipo: 'capitao', nivel: 4, x: -32, z: -86, raio: 4, qtd: 1 },
    { tipo: 'batedor', nivel: 4, x: -32, z: -86, raio: 7, qtd: 3 },
    { tipo: 'guerreiro', nivel: 4, x: 50, z: -8, raio: 7, qtd: 2 },
    { tipo: 'lacaio', nivel: 4, x: 58, z: 14, raio: 8, qtd: 3 },
    { tipo: 'necro', nivel: 5, x: 72, z: -14, raio: 6, qtd: 2 },
    { tipo: 'guerreiro', nivel: 5, x: 78, z: 0, raio: 8, qtd: 3 },
    { tipo: 'necro', nivel: 6, x: 84, z: 12, raio: 6, qtd: 2 },
    { tipo: 'guerreiro', nivel: 6, x: 90, z: -24, raio: 8, qtd: 2 },
    { tipo: 'lacaio', nivel: 5, x: -30, z: 40, raio: 9, qtd: 3 },
    { tipo: 'guerreiro', nivel: 7, x: 0, z: 66, raio: 8, qtd: 3 },
    { tipo: 'necro', nivel: 7, x: -12, z: 80, raio: 5, qtd: 2 },
    { tipo: 'necro', nivel: 7, x: 12, z: 80, raio: 5, qtd: 2 },
    { tipo: 'rei', nivel: 9, x: 0, z: 84, raio: 3, qtd: 1 },
  ];
  const npcs = [
    { id: 'anciao', nome: 'Ancião Tomé', modelo: 'mag', x: -3.5, z: -4.2, ang: 0.6 },
    { id: 'mercadora', nome: 'Mercadora Lia', modelo: 'npc', x: 6, z: 3.4, ang: 0 },
    { id: 'ferreiro', nome: 'Ferreiro Bruno', modelo: 'bar', x: -6, z: 4.4, ang: 0 },
  ];
  const baus = [{ id: 'bau_ruinas', x: 78, z: 0, ang: -P / 2 }];

  return { pecas, circ, caixas, casas, caminhos, spawns, npcs, baus };
}

export function distSeg(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz;
  let t = l ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t);
}

// empurra um círculo (x,z,r) para fora dos obstáculos
export function colidir(M, o, r, portaoAberto) {
  for (const c of M.circ) {
    const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
    if (d < m && d > 1e-4) { o.x = c.x + dx / d * m; o.z = c.z + dz / d * m; }
  }
  for (const b of M.caixas) {
    if (o.x < b.x0 - r || o.x > b.x1 + r || o.z < b.z0 - r || o.z > b.z1 + r) continue;
    const e = o.x - (b.x0 - r), d = (b.x1 + r) - o.x, n = o.z - (b.z0 - r), s = (b.z1 + r) - o.z, m = Math.min(e, d, n, s);
    if (m === e) o.x = b.x0 - r; else if (m === d) o.x = b.x1 + r; else if (m === n) o.z = b.z0 - r; else o.z = b.z1 + r;
  }
  if (!portaoAberto && Math.abs(o.x - CASTELO.portao.x) < 4.2 && Math.abs(o.z - CASTELO.portao.z) < 1.2 + r) o.z = o.z < CASTELO.portao.z ? CASTELO.portao.z - 1.2 - r : CASTELO.portao.z + 1.2 + r;
  o.x = Math.max(-LIM, Math.min(LIM, o.x)); o.z = Math.max(-LIM, Math.min(LIM, o.z));
}
