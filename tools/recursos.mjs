// Junta fontes (Google Fonts, OFL) e sons (Kenney, CC0) em recursos.bin (um download só).
// Formato igual ao modelos.bin: [u32 tamanho do cabeçalho][JSON {nome:[início,tamanho]}][dados]
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const AQUI = path.dirname(fileURLToPath(import.meta.url)), K = path.join(AQUI, 'kits');
const I = path.join(K, 'interface-sounds/Audio'), R = path.join(K, 'rpg-audio/Audio'), J = path.join(K, 'music-jingles/Audio');
const ARQ = {
  'fonte:titulo': path.join(K, 'fontes/LilitaOne.ttf'), 'fonte:texto': path.join(K, 'fontes/Fredoka.ttf'),
  clique: path.join(I, 'click_002.ogg'), abrir: path.join(I, 'open_001.ogg'), fechar: path.join(I, 'close_001.ogg'), erro: path.join(I, 'error_004.ogg'),
  compra: path.join(R, 'handleCoins.ogg'), moedas: path.join(R, 'handleCoins2.ogg'), enviar: path.join(R, 'doorOpen_1.ogg'), livro: path.join(R, 'bookFlip2.ogg'),
  espada: path.join(R, 'drawKnife2.ogg'), confirma: path.join(I, 'confirmation_001.ogg'), marco: path.join(J, 'Hit jingles/jingles_HIT00.ogg'), nivel: path.join(J, 'Sax jingles/jingles_SAX07.ogg'),
  lendario: path.join(J, 'Steel jingles/jingles_STEEL04.ogg'), falha: path.join(J, 'Sax jingles/jingles_SAX02.ogg'), recrutar: path.join(J, 'Hit jingles/jingles_HIT02.ogg'),
};
const partes = [], cab = {}; let pos = 0;
for (const [k, f] of Object.entries(ARQ)) { const b = fs.readFileSync(f); cab[k] = [pos, b.length]; partes.push(b); pos += b.length; }
const cj = Buffer.from(JSON.stringify(cab)), t = Buffer.alloc(4); t.writeUInt32LE(cj.length);
fs.writeFileSync(path.join(AQUI, '..', 'recursos.bin'), Buffer.concat([t, cj, ...partes]));
console.log(Object.keys(ARQ).length, 'recursos,', Math.round(pos / 1024), 'KB');
