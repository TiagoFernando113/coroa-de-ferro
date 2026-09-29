// Gera src/icones.js com os ícones SVG usados no jogo (game-icons.net, CC BY 3.0).
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const AQUI = path.dirname(fileURLToPath(import.meta.url)), req = createRequire(import.meta.url);
const set = req('@iconify-json/game-icons/icons.json');
const USADOS = {
  ouro: 'two-coins', gema: 'cut-diamond', fama: 'laurels', xp: 'upgrade', poder: 'crossed-swords', tempo: 'stopwatch', cadeado: 'padlock',
  taverna: 'beer-stein', quadro: 'scroll-unfurled', alojamento: 'bunk-beds', treino: 'target-dummy', forja: 'anvil-impact', enfermaria: 'health-potion',
  biblioteca: 'bookshelf', mercado: 'shop', portal: 'magic-portal',
  cav: 'visored-helm', bar: 'battle-axe', arq: 'bow-arrow', mag: 'wizard-staff', lad: 'hood',
  guilda: 'castle', herois: 'three-friends', missoes: 'treasure-map', recrutar: 'magic-swirl', objetivos: 'trophy-cup', config: 'cog',
  floresta: 'pine-tree', pantano: 'swamp', montanha: 'mountains', deserto: 'desert', ruinas: 'castle-ruins', vulcao: 'volcano', cemiterio: 'tombstone', trono: 'crowned-skull',
  bau: 'open-treasure-chest', chefe: 'skull-crossed-bones', estrela: 'round-star', check: 'check-mark', fechar: 'cross-mark', seta: 'fast-forward-button',
  ferido: 'bandage-roll', coracao: 'heart-plus', raio: 'lightning-arc', som: 'speaker', mudo: 'speaker-off', presente: 'present', relogio: 'hourglass',
  coroa: 'crown', pergaminho: 'quill-ink', escudo: 'checked-shield', treinar: 'muscle-up',
};
const out = {}, faltam = [];
for (const [k, n] of Object.entries(USADOS)) { const i = set.icons[n] || set.icons[set.aliases?.[n]?.parent]; if (!i) { faltam.push(n); continue; } out[k] = i.body; }
if (faltam.length) { console.error('faltam:', faltam.join(', ')); process.exit(1); }
fs.writeFileSync(path.join(AQUI, '..', 'src', 'icones.js'), `// Ícones de game-icons.net (Lorc, Delapouite e outros) — licença CC BY 3.0. Gerado por tools/icones.mjs\nexport const ICONES = ${JSON.stringify(out)};\n`);
console.log(Object.keys(out).length, 'ícones');
