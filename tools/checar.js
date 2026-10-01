// Checagem rápida (CI): jogo.js compila, a versão dele bate com versao.json
// (o app só baixa atualização quando versao.json sobe) e os arquivos listados existem.
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('jogo.js', 'utf8');
new vm.Script(src, { filename: 'jogo.js' });
const info = JSON.parse(fs.readFileSync('versao.json', 'utf8'));
const dados = fs.readFileSync('src/dados.js', 'utf8').match(/export const VERSAO = (\d+);/);
if (!dados) throw new Error('VERSAO não encontrada em src/dados.js');
if (+dados[1] !== info.versao) throw new Error(`src/dados.js VERSAO=${dados[1]} mas versao.json=${info.versao}`);
if (!src.includes(`=${info.versao}`)) throw new Error('jogo.js desatualizado: rode "node tools/build.mjs"');
for (const a of info.arquivos) if (!fs.existsSync(a)) throw new Error(`versao.json lista ${a}, que não existe`);
console.log(`ok — versão ${info.versao}`);
