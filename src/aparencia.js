// Aparência dos heróis (sem gráficos): catálogo de peças misturáveis, cores e presets.
// Peças: KayKit Adventurers 2.0 (todas no mesmo esqueleto). Armas: KayKit Adventurers + Fantasy Weapons Bits.

// modelos de origem (nó "h:Nome" no GLB) e o prefixo das peças de cada um
export const ORIGENS = {
  Knight: { nome: 'Cavaleiro', pref: 'Knight' }, Barbarian: { nome: 'Bárbaro', pref: 'Barbarian' }, Mage: { nome: 'Maga', pref: 'Mage' },
  Ranger: { nome: 'Patrulheira', pref: 'Ranger' }, Rogue: { nome: 'Ladina', pref: 'Rogue' }, Rogue_Hooded: { nome: 'Encapuzado', pref: 'RogueHooded' },
};
const O = Object.keys(ORIGENS);
// peças do corpo: cada opção é uma lista de [origem, peça]
export const PARTES = {
  cab: { nome: 'Rosto', ops: O.map(o => ({ id: o, nome: ORIGENS[o].nome, pecas: [[o, 'Head']] })) },
  cha: { nome: 'Chapéu', ops: [{ id: '', nome: 'Nenhum', pecas: [] }, { id: 'elmo', nome: 'Elmo', pecas: [['Knight', 'Helmet']] },
    { id: 'viseira', nome: 'Elmo com viseira', pecas: [['Knight', 'Helmet'], ['Knight', 'HelmetVisor']] }, { id: 'urso', nome: 'Pele de urso', pecas: [['Barbarian', 'BearHat']] },
    { id: 'mago', nome: 'Chapéu de mago', pecas: [['Mage', 'Hat']] }] },
  mas: { nome: 'Máscara', ops: [{ id: '', nome: 'Nenhuma', pecas: [] }, { id: 'lenco', nome: 'Lenço', pecas: [['Rogue_Hooded', 'Mask']] }] },
  tro: { nome: 'Tronco', ops: O.map(o => ({ id: o, nome: ORIGENS[o].nome, pecas: [[o, 'Body']] })) },
  bra: { nome: 'Braços', ops: O.map(o => ({ id: o, nome: ORIGENS[o].nome, pecas: [[o, 'ArmLeft'], [o, 'ArmRight']] })) },
  per: { nome: 'Pernas', ops: O.map(o => ({ id: o, nome: ORIGENS[o].nome, pecas: [[o, 'LegLeft'], [o, 'LegRight']] })) },
  capa: { nome: 'Capa', ops: [{ id: '', nome: 'Nenhuma', pecas: [] }, ...O.filter(o => o !== 'Barbarian').map(o => ({ id: o, nome: ORIGENS[o].nome, pecas: [[o, 'Cape']] }))] },
  cos: { nome: 'Costas', ops: [{ id: '', nome: 'Nada', pecas: [] }, { id: 'aljava', nome: 'Aljava', pecas: [['Ranger', 'Quiver']] }] },
};
// armas: 'kit:peça' do cenário (A = Adventurers, W = Weapons Bits)
const arma = (id, nome, tipo) => ({ id, nome, tipo });
export const ARMAS = [
  arma('', 'Mãos livres', 'soco'),
  arma('A:sword_1handed', 'Espada', '1m'), arma('W:sword_A', 'Espada larga', '1m'), arma('W:sword_B', 'Sabre', '1m'), arma('W:sword_C', 'Espada rúnica', '1m'),
  arma('W:sword_D', 'Cimitarra', '1m'), arma('W:sword_E', 'Espada real', '1m'), arma('A:sword_2handed', 'Montante', '2m'), arma('A:sword_2handed_color', 'Montante heráldico', '2m'),
  arma('A:axe_1handed', 'Machadinha', '1m'), arma('W:axe_A', 'Machado', '1m'), arma('W:axe_B', 'Machado duplo', '1m'), arma('W:axe_C', 'Machado de guerra', '1m'),
  arma('A:axe_2handed', 'Machadão', '2m'), arma('W:hammer_A', 'Martelo', '1m'), arma('W:hammer_B', 'Marreta', '2m'), arma('W:hammer_C', 'Maça', '1m'),
  arma('W:halberd', 'Alabarda', '2m'), arma('W:spear_A', 'Lança', '2m'), arma('A:dagger', 'Adaga', 'ad'), arma('W:dagger_A', 'Punhal', 'ad'), arma('W:dagger_B', 'Faca curva', 'ad'),
  arma('W:fistweapon_A', 'Soqueira', 'soco'), arma('W:fistweapon_B', 'Garra', 'soco'), arma('A:bow_withString', 'Arco', 'arco'), arma('W:bow_A_withString', 'Arco longo', 'arco'),
  arma('W:bow_B_withString', 'Arco élfico', 'arco'), arma('A:crossbow_1handed', 'Besta de mão', 'besta'), arma('A:crossbow_2handed', 'Besta', 'besta'),
  arma('A:staff', 'Cajado', 'magia'), arma('W:staff_A', 'Cajado de cristal', 'magia'), arma('W:staff_B', 'Cajado rúnico', 'magia'), arma('A:wand', 'Varinha', 'magia'),
  arma('W:wand_A', 'Varinha de osso', 'magia'), arma('A:mug_full', 'Caneca', 'soco'),
];
export const ESQUERDA = [
  arma('', 'Nada'), arma('A:shield_round', 'Escudo redondo'), arma('A:shield_round_color', 'Escudo redondo pintado'), arma('A:shield_round_barbarian', 'Escudo viking'),
  arma('A:shield_badge', 'Escudo brasão'), arma('A:shield_badge_color', 'Escudo real'), arma('A:shield_square', 'Escudo quadrado'), arma('A:shield_square_color', 'Escudo de torre'),
  arma('A:shield_spikes', 'Escudo de espinhos'), arma('A:shield_spikes_color', 'Escudo de guerra'), arma('W:shield_A', 'Broquel'), arma('W:shield_B', 'Escudo de ferro'),
  arma('W:shield_C', 'Pavês'), arma('A:dagger', 'Adaga'), arma('W:dagger_A', 'Punhal'), arma('W:sword_B', 'Sabre'), arma('W:axe_A', 'Machado'),
  arma('A:spellbook_open', 'Grimório aberto'), arma('A:spellbook_closed', 'Grimório'), arma('A:wand', 'Varinha'), arma('A:smokebomb', 'Bomba de fumaça'), arma('A:mug_full', 'Caneca'),
];
export const armaInfo = id => ARMAS.find(a => a.id === id) || ARMAS[0];

// cores
export const PELES = ['#ffe0c7', '#f7c9a5', '#e8b38a', '#d99a6c', '#b87a4b', '#8d5a36', '#6a3f25', '#4a2a18', '#9fd4a0', '#a9c4ff', '#c8a2ff', '#e0e0e0'];
export const PALETA = ['#ffffff', '#c8ccd2', '#7d848c', '#3a3f45', '#161819', '#f2d27a', '#e0a02a', '#c0602a', '#8a3a1a', '#5a3620', '#ff6a5a', '#d8243a',
  '#8a1030', '#ff8ac0', '#c040a0', '#7a3ab0', '#3a2a80', '#2a60d8', '#3aa0e0', '#2ac0b0', '#2a8a5a', '#5ab83a', '#a8d84a', '#e8e070'];
export const CORPO = { alt: [0.6, 1.25, 'Altura'], larg: [0.85, 1.35, 'Porte'], cabT: [0.8, 1.6, 'Cabeça'], musc: [0.8, 1.45, 'Músculos'] };
// raças: só aparência (proporções + acessórios); depois dá para ajustar tudo à mão
export const RACAS = [
  { id: 'humano', nome: 'Humano', icone: 'r_humano', c: { alt: 1, larg: 1, cabT: 1, musc: 1 }, a: {} },
  { id: 'bebe', nome: 'Bebê', icone: 'r_bebe', c: { alt: 0.62, larg: 1.08, cabT: 1.5, musc: 0.85 }, a: {} },
  { id: 'elfo', nome: 'Meio-elfo', icone: 'r_elfo', c: { alt: 1.05, larg: 0.92, cabT: 1, musc: 0.9 }, a: { orelha: 'elfo' } },
  { id: 'anao', nome: 'Anão', icone: 'r_anao', c: { alt: 0.74, larg: 1.3, cabT: 1.12, musc: 1.3 }, a: { barba: 'longa', orelha: '' } },
  { id: 'orc', nome: 'Orc', icone: 'r_orc', c: { alt: 1.1, larg: 1.25, cabT: 1, musc: 1.4 }, a: { presas: 'sim', orelha: 'elfo' }, pele: '#8fb86a' },
  { id: 'demonio', nome: 'Demônio', icone: 'r_demonio', c: { alt: 1.05, larg: 1, cabT: 1, musc: 1.1 }, a: { chifre: 'demonio', rabo: 'demonio', orelha: 'elfo' }, pele: '#d8675a' },
  { id: 'fera', nome: 'Meio-fera', icone: 'r_fera', c: { alt: 0.97, larg: 0.95, cabT: 1.05, musc: 1 }, a: { orelha: 'gato', rabo: 'gato' } },
  { id: 'anjo', nome: 'Celestial', icone: 'r_anjo', c: { alt: 1.05, larg: 0.95, cabT: 1, musc: 1 }, a: { asas: 'anjo', aura: 'sim' } },
  { id: 'gigante', nome: 'Meio-gigante', icone: 'r_gigante', c: { alt: 1.25, larg: 1.35, cabT: 0.85, musc: 1.45 }, a: { barba: 'curta' } },
];
// acessórios (malhas simples presas nos ossos da cabeça, quadril e peito)
export const ACESSORIOS = {
  orelha: { nome: 'Orelhas', ops: [['', 'Normais'], ['elfo', 'Pontudas'], ['gato', 'De gato'], ['lobo', 'De lobo'], ['coelho', 'De coelho']] },
  barba: { nome: 'Barba', ops: [['', 'Nenhuma'], ['curta', 'Curta'], ['longa', 'Longa'], ['bigode', 'Bigode'], ['cavanhaque', 'Cavanhaque']] },
  chifre: { nome: 'Chifres', ops: [['', 'Nenhum'], ['demonio', 'De demônio'], ['carneiro', 'De carneiro'], ['unicornio', 'Unicórnio'], ['cervo', 'Galhada']] },
  presas: { nome: 'Presas', ops: [['', 'Não'], ['sim', 'Sim']] },
  rabo: { nome: 'Rabo', ops: [['', 'Nenhum'], ['gato', 'De gato'], ['raposa', 'De raposa'], ['demonio', 'De demônio'], ['dragao', 'De dragão']] },
  asas: { nome: 'Asas', ops: [['', 'Nenhuma'], ['anjo', 'De anjo'], ['morcego', 'De morcego'], ['fada', 'De fada']] },
  aura: { nome: 'Auréola', ops: [['', 'Não'], ['sim', 'Sim']] },
};
export const PELOS = ['#1e1a18', '#4a2e1c', '#7a4a26', '#b0703a', '#d8a860', '#f0e0b0', '#e8e8e8', '#8a8a8a', '#c8402a', '#ff8ac0', '#6a4ab0', '#3a8ad8', '#2a8a5a', '#ffd84a'];
export function aplicarRaca(v, id) {
  const r = RACAS.find(x => x.id === id) || RACAS[0];
  Object.assign(v, r.c); for (const k of Object.keys(ACESSORIOS)) v[k] = r.a[k] || ''; v.raca = r.id;
  if (r.pele) v.pele = r.pele; else if (RACAS.some(x => x.pele && x.pele === v.pele)) v.pele = ''; // tira a pele verde/vermelha ao voltar
  return v;
}

// visual padrão de cada classe
const PRESET = {
  cav: { o: 'Knight', cha: 'elmo', capa: 'Knight', arma: 'A:sword_1handed', esq: 'A:shield_badge_color' },
  bar: { o: 'Barbarian', cha: 'urso', capa: '', arma: 'A:axe_2handed', esq: '' },
  arq: { o: 'Ranger', cha: '', capa: 'Ranger', cos: 'aljava', arma: 'A:bow_withString', esq: '' },
  mag: { o: 'Mage', cha: 'mago', capa: 'Mage', arma: 'A:staff', esq: '' },
  lad: { o: 'Rogue_Hooded', mas: 'lenco', capa: 'Rogue_Hooded', arma: 'A:dagger', esq: 'W:dagger_A' },
};
export const ESTILOS = [
  { id: 'cav', nome: 'Cavaleiro' }, { id: 'bar', nome: 'Bárbaro' }, { id: 'arq', nome: 'Patrulheira' }, { id: 'mag', nome: 'Maga' }, { id: 'lad', nome: 'Ladino' },
  { id: 'Rogue', nome: 'Aventureira' },
];
export function visualPadrao(estilo) {
  const p = PRESET[estilo] || { o: estilo, capa: estilo, arma: 'A:sword_1handed', esq: '' };
  return { cab: p.o, cha: p.cha || '', mas: p.mas || '', tro: p.o, bra: p.o, per: p.o, capa: p.capa ?? p.o, cos: p.cos || '', arma: p.arma, esq: p.esq,
    pele: '', cores: {}, alt: 1, larg: 1, cabT: 1, musc: 1 };
}
const sorte = l => l[Math.floor(Math.random() * l.length)];
// heróis da guilda: base da classe com variações (cada um fica diferente)
export function visualAleatorio(cls) {
  const v = visualPadrao(cls), o = O;
  if (Math.random() < 0.35) v.cab = sorte(o);
  if (Math.random() < 0.25) v.per = sorte(o);
  if (Math.random() < 0.2) v.bra = sorte(o);
  if (Math.random() < 0.3) v.cha = sorte(PARTES.cha.ops).id;
  if (Math.random() < 0.5) v.pele = sorte(PELES.slice(0, 8));
  v.alt = +(0.93 + Math.random() * 0.14).toFixed(2); v.larg = +(0.92 + Math.random() * 0.18).toFixed(2);
  if (Math.random() < 0.45) { const r = sorte(RACAS.slice(1)); const a = v.alt, l = v.larg; aplicarRaca(v, r.id); v.alt = +(v.alt * a).toFixed(2); v.larg = +(v.larg * l).toFixed(2); v.corPelo = sorte(PELOS.slice(0, 8)); }
  v.tinta = sorte(PALETA.slice(5)); // cor principal da roupa (aplicada na zona mais usada do tronco)
  return v;
}
// animação de ataque conforme a arma
export function animAtaque(v) {
  const t = armaInfo(v.arma).tipo;
  return { '1m': 'Melee_1H_Attack_Chop', '2m': 'Melee_2H_Attack_Chop', ad: v.esq && /dagger|sword|axe/.test(v.esq) ? 'Melee_Dualwield_Attack_Chop' : 'Melee_1H_Attack_Stab',
    soco: 'Melee_Unarmed_Attack_Punch_A', arco: 'Ranged_Bow_Release', besta: 'Ranged_1H_Shoot', magia: 'Ranged_Magic_Shoot' }[t] || 'Melee_1H_Attack_Chop';
}

// lista de [origem, peça] de um visual
export function pecasDo(v) {
  const l = [];
  for (const [k, p] of Object.entries(PARTES)) { const op = p.ops.find(x => x.id === v[k]) || (k === 'cab' || k === 'tro' || k === 'bra' || k === 'per' ? p.ops[0] : null); if (op) l.push(...op.pecas); }
  return l;
}
