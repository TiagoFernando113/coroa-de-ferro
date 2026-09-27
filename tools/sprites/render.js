// Gera atlas.png + atlas.json (na raiz: o app só lida com arquivos soltos) a partir de pecas.js.
// Uso: sh tools/sprites/baixar-kits.sh && node tools/sprites/render.js
// (precisa do playwright com Chromium e de `npm i three@0.160.0` em tools/sprites)
const fs = require('fs'), path = require('path');
const abrir = require('./servidor.js');
const dir = __dirname, repo = path.join(dir, '..', '..');
(async () => {
  const specs = require('./pecas.js');
  const { p, fechar } = await abrir();
  const items = [];
  for (const [name, spec] of Object.entries(specs)) {
    if (typeof spec === 'function') continue;
    const r = await p.evaluate(parts => window.renderSprite(parts), spec);
    items.push({ name, ...r });
  }
  const at = await p.evaluate(it => window.makeAtlas(it), items);
  fs.writeFileSync(path.join(repo, 'atlas.png'), Buffer.from(at.url.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(repo, 'atlas.json'), JSON.stringify(at.meta));
  console.log(Object.keys(at.meta).length, 'sprites');
  await fechar();
})();
