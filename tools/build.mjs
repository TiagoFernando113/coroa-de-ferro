// Gera jogo.js (código do jogo + three.js num arquivo só).
import { build } from 'esbuild';
import path from 'path'; import { fileURLToPath } from 'url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [path.join(AQUI, '..', 'src', 'main.js')],
  outfile: path.join(AQUI, '..', 'jogo.js'),
  bundle: true, minify: true, format: 'iife', target: ['es2019'], legalComments: 'none',
  nodePaths: [path.join(AQUI, 'node_modules')],
  logLevel: 'info',
});
