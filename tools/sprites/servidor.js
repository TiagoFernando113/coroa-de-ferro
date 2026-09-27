// Servidor local + Chromium com WebGL por software, para renderizar os kits 3D.
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const map = { '/dungeon/': 'kits/mini-dungeon/Models/GLB format/', '/mini/': 'kits/mini-characters/Models/GLB format/',
  '/castle/': 'kits/castle-kit/Models/GLB format/', '/town/': 'kits/fantasy-town-kit/Models/GLB format/',
  '/ctex/': 'kits/castle-kit/Models/Textures/', '/three/': 'node_modules/three/' };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png' };
module.exports = async function abrir() {
  const srv = http.createServer((q, s) => {
    let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/render.html';
    for (const k in map) if (u.startsWith(k)) u = '/' + map[k] + u.slice(k.length);
    const f = path.join(__dirname, u);
    fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
  }).listen(8765);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('page:', m.text()); });
  await p.goto('http://localhost:8765/'); await p.waitForFunction('window.ready');
  return { p, fechar: async () => { await b.close(); srv.close(); } };
};
