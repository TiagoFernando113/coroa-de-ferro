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
  coroa: 'crown', pergaminho: 'quill-ink', mao: 'pointing', novo: 'sparkles', escudo: 'checked-shield', treinar: 'muscle-up',
  h_investida: 'shield-bash', h_giro: 'sword-spin', h_muralha: 'shield-reflect', h_salto: 'boot-stomp', h_redemoinho: 'whirlwind', h_furia: 'enrage',
  h_triplo: 'striking-arrows', h_chuva: 'arrow-cluster', h_rolar: 'dodge', h_fogo: 'fireball', h_gelo: 'frozen-orb', h_meteoro: 'meteor-impact',
  h_lamina: 'backstab', h_adagas: 'thrown-daggers', h_fumaca: 'smoke-bomb', esquiva: 'sprint', pocao: 'heart-bottle', masmorra: 'dungeon-gate', sair: 'exit-door',
  forca: 'fist', agi: 'running-shoe', vit: 'heart-plus', int: 'brain', sombras: 'raise-skeleton', rank: 'rank-3', caveira: 'broken-skull',
  c_estilo: 'person', c_rosto: 'woman-elf-face', c_corpo: 'body-height', c_roupa: 'cape', c_armas: 'sword-brandish', c_cores: 'palette', c_nome: 'quill-ink',
  c_raca: 'elf-ear', r_humano: 'person', r_bebe: 'baby-face', r_elfo: 'woman-elf-face', r_anao: 'dwarf-face', r_orc: 'orc-head', r_demonio: 'devil-mask',
  r_fera: 'cat', r_anjo: 'angel-wings', r_gigante: 'troll', monstro: 'slime', capa: 'wing-cloak', botas: 'boots', luvas: 'gauntlet',
  dado: 'perspective-dice-six-faces-random', girar: 'clockwise-rotation', pincel: 'paint-brush', andar: 'walk', festa: 'party-popper', mao2: 'hand',
};
const out = {}, faltam = [];
for (const [k, n] of Object.entries(USADOS)) { const i = set.icons[n] || set.icons[set.aliases?.[n]?.parent]; if (!i) { faltam.push(n); continue; } out[k] = i.body; }
if (faltam.length) { console.error('faltam:', faltam.join(', ')); process.exit(1); }
fs.writeFileSync(path.join(AQUI, '..', 'src', 'icones.js'), `// Ícones de game-icons.net (Lorc, Delapouite e outros) — licença CC BY 3.0. Gerado por tools/icones.mjs\nexport const ICONES = ${JSON.stringify(out)};\n`);
console.log(Object.keys(out).length, 'ícones');
