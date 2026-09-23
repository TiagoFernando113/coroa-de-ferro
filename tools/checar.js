// Checagem rápida: game.js compila e a versão dele bate com versao.json
// (o app só baixa atualização quando versao.json sobe).
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('game.js', 'utf8');
new vm.Script(src, { filename: 'game.js' });
const info = JSON.parse(fs.readFileSync('versao.json', 'utf8'));
const m = src.match(/const VERSAO = (\d+);/);
if (!m) throw new Error('VERSAO não encontrada em game.js');
if (+m[1] !== info.versao) throw new Error(`game.js VERSAO=${m[1]} mas versao.json=${info.versao}`);
for (const a of info.arquivos) if (!fs.existsSync(a)) throw new Error(`versao.json lista ${a}, que não existe`);
console.log(`ok — versão ${info.versao}`);
