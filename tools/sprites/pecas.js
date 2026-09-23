// Composições dos sprites a partir dos kits 3D da Kenney (CC0).
// Cada entrada vira uma imagem isométrica no atlas.
// Castelos por nível (tier 1..4)
function ring(n, v) { // anel de muralha n x n (meia-largura n), torres nos cantos, portão na frente (+z)
  const P = [];
  for (let i = -n + 1; i <= n - 1; i++) {
    if (i === 0) P.push({ n: 'wall-doorway', x: 0, z: n, r: 0, v }); else P.push({ n: 'wall', x: i, z: n, r: 0, v });
    P.push({ n: 'wall', x: i, z: -n, r: 0, v });
    P.push({ n: 'wall', x: n, z: i, r: 90, v });
    P.push({ n: 'wall', x: -n, z: i, r: 90, v });
  }
  for (const [x, z] of [[n, n], [-n, n], [n, -n], [-n, -n]]) P.push({ st: ['tower-square-base', 'tower-square-mid', 'tower-square-top-roof'], x, z, v });
  return P;
}
function castle(t, v) {
  if (t === 1) return [
    { st: ['tower-square-base', 'tower-square-mid-windows', 'tower-square-top-roof'], x: 0, z: 0, v },
    { n: 'wall', x: 1, z: 0, r: 90, v }, { n: 'wall', x: 0, z: 1, v },
    { st: ['tower-hexagon-base', 'tower-hexagon-roof'], x: 1, z: 1, v },
    { n: 'tree-large', x: -1.2, z: 1.1 }, { n: 'flag', x: 0.3, z: 0.3, y: 2.62, v },
  ];
  if (t === 2) return [...ring(1, v),
    { st: ['tower-square-base', 'tower-square-mid-windows', 'tower-square-mid', 'tower-square-top-roof-high'], x: 0, z: 0, v },
    { n: 'tree-large', x: -2, z: 1.6 }];
  if (t === 3) return [...ring(2, v),
    { st: ['tower-square-base', 'tower-square-mid-windows', 'tower-square-mid', 'tower-square-top-roof-high'], x: -0.5, z: -0.5, v },
    { st: ['tower-hexagon-base', 'tower-hexagon-mid', 'tower-hexagon-roof'], x: 0.8, z: -0.6, v },
    { st: ['tower-hexagon-base', 'tower-hexagon-roof'], x: -0.6, z: 0.8, v },
    { n: 'flag-banner-long', x: 1.2, z: 2.5, v }, { n: 'flag-banner-long', x: -1.2, z: 2.5, v },
    { n: 'tree-large', x: 3.1, z: 1.2 }, { n: 'tree-large', x: -3.1, z: 2.4 }];
  return [...ring(2, v),
    { st: ['tower-square-base', 'tower-square-mid-windows', 'tower-square-mid', 'tower-square-mid-windows', 'tower-square-top-roof-high'], x: -0.5, z: -0.5, v },
    { st: ['tower-hexagon-base', 'tower-hexagon-mid', 'tower-hexagon-mid', 'tower-hexagon-roof'], x: 0.9, z: -0.7, v },
    { st: ['tower-hexagon-base', 'tower-hexagon-mid', 'tower-hexagon-roof'], x: -0.7, z: 0.9, v },
    { st: ['tower-hexagon-base', 'tower-hexagon-roof'], x: 0.9, z: 0.9, v },
    { n: 'flag-banner-long', x: 1.2, z: 2.5, v }, { n: 'flag-banner-long', x: -1.2, z: 2.5, v },
    { n: 'flag-banner-long', x: 2.5, z: 1.2, r: 90, v }, { n: 'flag-banner-long', x: 2.5, z: -1.2, r: 90, v },
    { n: 'siege-ballista', x: 3.3, z: 3.3, r: 45 }, { n: 'tree-large', x: 3.3, z: -1 }, { n: 'tree-large', x: -3.2, z: 2.6 }];
}

const out = {};
// casinha 1x1 do kit da vila: 4 paredes (painel fica na face +x, então giramos) e telhado
function house(x, z, { w = 'wall-wood', floors = 1, roof = 'roof-point', door = 'wall-wood-door', win = 'wall-wood-window-shutters', s = 1, r = 0 } = {}) {
  const P = [];
  for (let f = 0; f < floors; f++)
    for (const [rot, kind] of [[0, f ? win : door], [90, w], [180, w], [270, f ? w : win]])
      P.push({ k: 'town', n: kind, x, z, y: f * s, r: rot + r, s });
  P.push({ k: 'town', n: roof, x, z, y: floors * s, r, s });
  return P;
}
// cores: padrão = azul/areia (LOB), a vermelho (FNX), c dourado (COR), b verde (VRD), d azul/pedra (sem aliança)
for (const [cor, v] of [['azul', undefined], ['vermelho', 'a'], ['dourado', 'c'], ['verde', 'b'], ['cinza', 'd']])
  for (const t of [1, 2, 3, 4]) out[`castelo${t}_${cor}`] = castle(t, v);
// bárbaros: acampamento em pedra escura com telhado vermelho
out.barbaro1 = [{ n: 'siege-catapult', x: 0, z: 0, r: 30, v: 'e' }, { n: 'flag-pennant', x: 0.9, z: -0.6, v: 'e' }, { n: 'rocks-small', x: -0.9, z: 0.6 }];
out.barbaro2 = [{ n: 'siege-tower', x: -0.3, z: -0.3, r: 20, v: 'e' }, { n: 'siege-catapult', x: 1, z: 0.8, r: 60, v: 'e' }, { n: 'flag-pennant', x: -1.1, z: 0.9, v: 'e' }];
out.barbaro3 = [{ n: 'siege-tower', x: -0.6, z: -0.6, r: 20, v: 'e' }, { n: 'siege-ram', x: 1.1, z: 0, r: 80, v: 'e' }, { n: 'siege-trebuchet', x: 0, z: 1.2, r: -20, v: 'e' },
  { st: ['tower-square-base', 'tower-slant-roof'], x: -1.3, z: 1, v: 'e' }, { n: 'flag-pennant', x: 0.8, z: -1.2, v: 'e' }];
// jazidas
out.madeira = [{ n: 'tree-large', x: 0, z: 0 }, { n: 'tree-large', x: 0.8, z: -0.4, s: 0.85 }, { n: 'tree-large', x: -0.5, z: 0.7, s: 0.9 }, { n: 'tree-log', x: 0.6, z: 0.8, r: 30 }, { n: 'tree-trunk', x: -0.8, z: -0.4 }];
out.pedra = [{ n: 'rocks-large', x: 0, z: 0 }, { n: 'rocks-large', x: 0.8, z: 0.6, s: 0.6, r: 50 }, { n: 'rocks-small', x: -0.8, z: 0.5 }];
out.comida = [...house(0, 0, { floors: 2, roof: 'roof-high-point', w: 'wall', door: 'wall-door', win: 'wall-window-shutters', s: 0.8 }), { k: 'town', n: 'windmill', x: 0.5, y: 1.25, s: 0.5 }, { k: 'town', n: 'fence', x: 0.2, z: 1, s: 0.7 }, { k: 'town', n: 'cart', x: -0.9, z: 0.6, r: 40, s: 0.7 }];
out.ouro = [{ n: 'rocks-large', x: 0, z: 0, v: 'c' }, { n: 'rocks-small', x: 0.8, z: 0.5, v: 'c' }, { k: 'town', n: 'cart-high', x: -0.8, z: 0.7, r: 30, s: 0.7 }];
// decoração do mapa
out.arvore = [{ n: 'tree-large' }];
out.arvore2 = [{ n: 'tree-small' }, { n: 'tree-small', x: 0.5, z: 0.3, s: 0.8 }];
out.arvore3 = [{ k: 'town', n: 'tree-high-round', s: 0.8 }];
out.rocha = [{ n: 'rocks-small' }];
// construções da cidade (ícones)
out.b_fazenda = out.comida;
out.b_serraria = [...house(0, 0, { roof: 'roof-gable', s: 0.9 }), { k: 'town', n: 'watermill', x: 0.55, y: 0.45, s: 0.45 }, { n: 'tree-log', x: -0.2, z: 1, r: 20 }, { n: 'tree-large', x: -1, z: -0.4, s: 0.8 }];
out.b_pedreira = [{ n: 'rocks-large' }, { k: 'town', n: 'cart', x: 0.9, z: 0.6, r: 40, s: 0.8 }];
out.b_mina = [{ n: 'rocks-large', v: 'c' }, { k: 'town', n: 'cart-high', x: 0.9, z: 0.6, r: 40, s: 0.8 }];
out.b_armazem = [...house(0, 0, { w: 'wall', door: 'wall-door', win: 'wall-window-shutters', roof: 'roof-gable', s: 0.9 }), ...house(0, -0.9, { w: 'wall', door: 'wall', win: 'wall', roof: 'roof-gable', s: 0.9 }), { k: 'town', n: 'cart', x: 0.9, z: 0.7, r: 20, s: 0.8 }];
out.b_quartel = [{ n: 'siege-ballista', r: 30 }, { n: 'flag-banner-short', x: -0.8, z: -0.3 }, { n: 'flag-banner-short', x: 0.6, z: -0.8 }];
out.b_hospital = [...house(0, 0, { w: 'wall', door: 'wall-door', win: 'wall-window-shutters', roof: 'roof-high-point', floors: 2, s: 0.8 }), { k: 'town', n: 'banner-green', x: 0.05, z: 0, y: 0.5, s: 0.8 }, { k: 'town', n: 'stall-green', x: 0.2, z: 1.1, s: 0.7 }];
out.b_muralha = [{ n: 'wall', x: -1 }, { n: 'wall-doorway', x: 0 }, { n: 'wall', x: 1 }, { n: 'gate', x: 0, z: 0.35, r: 90 }];
out.b_academia = [{ st: ['tower-hexagon-base', 'tower-hexagon-mid', 'tower-hexagon-roof'] }, { k: 'town', n: 'lantern', x: 0.7, z: 0.4 }];
module.exports = out;

// ---- cidade cheia: muralha, casas, praça ----
out.muro_x = [{ n: 'wall', r: 0 }];
out.muro_z = [{ n: 'wall', r: 90 }];
out.muro_torre = [{ st: ['tower-square-base', 'tower-square-mid', 'tower-square-top-roof'] }, { n: 'flag', x: 0.3, z: 0.3, y: 2.62 }];
out.muro_portao = [{ n: 'wall-doorway', r: 0 }, { n: 'gate', z: 0.3, r: 90 }, { n: 'flag-banner-long', x: -0.45, z: 0.55 }, { n: 'flag-banner-long', x: 0.45, z: 0.55 }];
out.casa1 = [...house(0, 0, { roof: 'roof-gable', s: 0.8 })];
out.casa2 = [...house(0, 0, { w: 'wall', door: 'wall-door', win: 'wall-window-shutters', roof: 'roof-high-point', floors: 2, s: 0.75 })];
out.casa3 = [...house(0, 0, { w: 'wall', door: 'wall-door', win: 'wall-window-round', roof: 'roof-gable', s: 0.8 }), { k: 'town', n: 'chimney', x: -0.1, y: 1.05, s: 0.6 }];
out.casa4 = [...house(0, 0, { roof: 'roof-point', s: 0.8 }), ...house(0.8, 0, { w: 'wall-wood', door: 'wall-wood', win: 'wall-wood-window-small', roof: 'roof-gable', s: 0.8 })];
out.barraca1 = [{ k: 'town', n: 'stall-red', s: 0.8 }];
out.barraca2 = [{ k: 'town', n: 'stall-green', s: 0.8 }, { k: 'town', n: 'stall-bench', x: 0.7, z: 0.3, s: 0.8 }];
out.fonte = [{ k: 'town', n: 'fountain-round', s: 0.9 }, { k: 'town', n: 'fountain-center', s: 0.9 }];
out.lampiao = [{ k: 'town', n: 'lantern', s: 0.9 }];
out.carroca = [{ k: 'town', n: 'cart-high', r: 30, s: 0.8 }];
