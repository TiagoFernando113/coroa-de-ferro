// Gera chars.png + chars.json: personagens animados (Kenney Mini Dungeon / Mini Characters, CC0)
// renderizados em quadros, em 3 direções (baixo, cima, direita; esquerda = espelho da direita).
// Uso: node tools/sprites/personagens.js
const fs = require('fs'), path = require('path');
const abrir = require('./servidor.js');
const repo = path.join(__dirname, '..', '..');
const espada = { kit: 'dungeon', n: 'weapon-sword', osso: 'arm-right', pos: [-0.02, -0.1, 0.04], rot: [90, 0, 0] };
const lanca = { kit: 'dungeon', n: 'weapon-spear', osso: 'arm-right', pos: [-0.02, -0.1, 0.04], rot: [90, 0, 0] };
const escudoR = { kit: 'dungeon', n: 'shield-round', osso: 'arm-left', pos: [0.07, -0.07, 0.03], rot: [0, 90, 0], s: 0.75 };
const escudoQ = { kit: 'dungeon', n: 'shield-rectangle', osso: 'arm-left', pos: [0.07, -0.16, 0.03], rot: [0, 90, 0], s: 0.85 };
const P = {
  cav: { kit: 'dungeon', model: 'character-human', armas: [espada, escudoR] },
  lan: { kit: 'mini', model: 'character-female-b', armas: [lanca] },
  mag: { kit: 'mini', model: 'character-female-e', armas: [] },
  pal: { kit: 'mini', model: 'character-male-e', armas: [espada, escudoQ] },
  orc: { kit: 'dungeon', model: 'character-orc', armas: [espada] },
  rei: { kit: 'dungeon', model: 'character-orc', armas: [lanca], escala: 3, ppu: 26 },
};
const ANIMS = { idle: ['idle', 2], walk: ['walk', 4], atk: ['attack-melee-right', 4, true], die: ['die', 4, true] };
const DIRS = { d: 45, u: 225, r: 135 };
(async () => {
  const { p, fechar } = await abrir();
  const items = [];
  for (const [id, c] of Object.entries(P)) for (const [an, [clip, n, uma]] of Object.entries(ANIMS)) for (const [dn, face] of Object.entries(DIRS)) {
    const r = await p.evaluate(cfg => window.renderChar(cfg), { ...c, anim: clip, quadros: n, umaVez: !!uma, face, escala: 3 * (c.escala || 1), caixa: 0.33, altura: 0.72, ppu: c.ppu || 40, elev: 35 });
    r.frames.forEach((url, i) => items.push({ name: `${id}_${an}_${dn}_${i}`, url, ax: r.ax, ay: r.ay }));
  }
  const at = await p.evaluate(it => window.makeAtlas(it), items);
  fs.writeFileSync(path.join(repo, 'chars.png'), Buffer.from(at.url.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(repo, 'chars.json'), JSON.stringify(at.meta));
  console.log(items.length, 'quadros');
  await fechar();
})();
