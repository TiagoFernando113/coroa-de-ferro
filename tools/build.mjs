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
// versao.json: impressão digital de cada arquivo (o app só baixa o que mudou; os modelos 3D quase nunca mudam)
import fs from 'fs'; import crypto from 'crypto';
{ const raiz = path.join(AQUI, '..'), arq = path.join(raiz, 'versao.json'), info = JSON.parse(fs.readFileSync(arq, 'utf8'));
  info.hash = Object.fromEntries(info.arquivos.map(a => [a, crypto.createHash('sha1').update(fs.readFileSync(path.join(raiz, a))).digest('hex').slice(0, 16)]));
  fs.writeFileSync(arq, JSON.stringify(info)); }
