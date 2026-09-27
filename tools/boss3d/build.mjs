// Empacota boss3d.src.js + three.js num arquivo só (boss3d.js na raiz do repositório).
// Uso: node tools/boss3d/build.mjs   (dependências em tools/sprites: npm i three@0.160.0 esbuild@0.24.0)
import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(AQUI, '..', 'sprites', 'package.json'));
const esbuild = require('esbuild');
await esbuild.build({
  entryPoints: [path.join(AQUI, 'boss3d.src.js')], bundle: true, minify: true, format: 'iife', target: 'es2019',
  nodePaths: [path.join(AQUI, '..', 'sprites', 'node_modules')], outfile: path.join(AQUI, '..', '..', 'boss3d.js'), logLevel: 'info',
  legalComments: 'none', banner: { js: '/* Modo Chefão 3D — gerado por tools/boss3d/build.mjs a partir de boss3d.src.js. three.js (MIT) embutido. */' },
});
