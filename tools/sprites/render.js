// Gera atlas.png + atlas.json (na raiz: o app só lida com arquivos soltos) a partir de pecas.js.
// Uso: sh tools/sprites/baixar-kits.sh && node tools/sprites/render.js
// (precisa do playwright com Chromium e de `npm i three@0.160.0` em tools/sprites)
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const dir = __dirname, repo = path.join(dir, '..', '..');
const map = { '/castle/': 'kits/castle-kit/Models/GLB format/', '/town/': 'kits/fantasy-town-kit/Models/GLB format/', '/ctex/': 'kits/castle-kit/Models/Textures/', '/three/': 'node_modules/three/' };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png' };
const srv = http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/render.html';
  for (const k in map) if (u.startsWith(k)) u = '/' + map[k] + u.slice(k.length);
  const f = path.join(dir, u);
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
}).listen(8765);
(async () => {
  const specs = require('./pecas.js');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/'); await p.waitForFunction('window.ready');
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
  await b.close(); srv.close();
})();
