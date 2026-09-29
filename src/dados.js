// Dados do jogo: classes, habilidades, inimigos, itens e missões.

export const VERSAO = 19;

// ---------------- classes do herói ----------------
// basico: ataque normal. Corpo a corpo acerta um cone; à distância solta um projétil.
// hab: habilidades liberadas por nível. tipos (ver combate em jogo.js):
//   investida  avança e atordoa quem atropelar
//   area       dano em volta de você (raio) depois de "impacto" segundos
//   giro       dano repetido em volta durante "dur" segundos
//   salto      pula até o inimigo mais próximo e causa dano em área na queda
//   buff       bônus temporário (atk/def/vel/cura)
//   projetil   dispara "n" projéteis em leque
//   chuva      marca uma área no inimigo mais próximo e causa dano depois de "atraso"
export const CLASSES = {
  cav: {
    nome: 'Cavaleiro', icone: '🛡️', cor: '#4a7bd0', modelo: 'cav',
    desc: 'Resistente e protetor. Espada e escudo, atordoa e aguenta pancada.',
    vida: 150, mana: 60, atk: 11, def: 7, vel: 5.4,
    basico: { tipo: 'melee', anims: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal'], dur: 0.55, impacto: 0.22, alcance: 2.6, arco: 130 },
    hab: [
      { id: 'investida', nome: 'Investida', icone: '💨', nivel: 1, mana: 12, cd: 6, tipo: 'investida', anim: 'Dodge_Forward', dist: 7, dur: 0.35, mult: 1.6, atordoa: 1.5, desc: 'Avança com o escudo e atordoa' },
      { id: 'giro', nome: 'Giro', icone: '🌀', nivel: 3, mana: 18, cd: 8, tipo: 'area', anim: '2H_Melee_Attack_Spin', dur: 0.8, impacto: 0.35, raio: 3.6, mult: 2.2, desc: 'Golpe giratório em volta' },
      { id: 'muralha', nome: 'Muralha', icone: '🏰', nivel: 5, mana: 25, cd: 18, tipo: 'buff', anim: 'Block', dur: 0.6, buff: { def: 1.0, dur: 6 }, cura: 0.15, desc: 'Defesa dobrada por 6s e cura 15%' },
    ],
  },
  bar: {
    nome: 'Bárbaro', icone: '🪓', cor: '#c9582a', modelo: 'bar',
    desc: 'Força bruta. Machado de duas mãos, golpes lentos e devastadores.',
    vida: 135, mana: 50, atk: 15, def: 4, vel: 5.2,
    basico: { tipo: 'melee', anims: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice'], dur: 0.75, impacto: 0.35, alcance: 2.9, arco: 150 },
    hab: [
      { id: 'salto', nome: 'Salto', icone: '⬇️', nivel: 1, mana: 14, cd: 7, tipo: 'salto', anim: 'Jump_Full_Short', dist: 9, dur: 0.75, impacto: 0.6, raio: 3.4, mult: 2, desc: 'Salta no inimigo e esmaga a área' },
      { id: 'redemoinho', nome: 'Redemoinho', icone: '🌪️', nivel: 3, mana: 22, cd: 10, tipo: 'giro', anim: '2H_Melee_Attack_Spinning', dur: 2, tick: 0.33, raio: 3.2, mult: 0.8, desc: 'Gira o machado por 2s' },
      { id: 'furia', nome: 'Fúria', icone: '🔥', nivel: 5, mana: 20, cd: 20, tipo: 'buff', anim: 'Cheer', dur: 0.7, buff: { atk: 0.5, vel: 0.2, dur: 8 }, cura: 0.1, desc: '+50% de dano e +20% de velocidade por 8s' },
    ],
  },
  arq: {
    nome: 'Arqueira', icone: '🏹', cor: '#3f8f4a', modelo: 'arq',
    desc: 'Ágil e letal à distância com a besta. Frágil de perto.',
    vida: 105, mana: 70, atk: 12, def: 3, vel: 5.8,
    basico: { tipo: 'proj', anims: ['2H_Ranged_Shoot'], dur: 0.5, impacto: 0.2, alcance: 16, proj: 'flecha', vel: 30 },
    hab: [
      { id: 'triplo', nome: 'Tiro Triplo', icone: '🎯', nivel: 1, mana: 12, cd: 5, tipo: 'projetil', anim: '2H_Ranged_Shoot', dur: 0.5, impacto: 0.2, n: 5, leque: 40, proj: 'flecha', vel: 30, mult: 1.1, desc: 'Cinco flechas em leque' },
      { id: 'chuva', nome: 'Chuva de Flechas', icone: '🌧️', nivel: 3, mana: 22, cd: 10, tipo: 'chuva', anim: 'Throw', dur: 0.6, atraso: 0.9, raio: 4.5, mult: 2.4, cor: 0x7ad0ff, desc: 'Flechas caem numa área' },
      { id: 'rolar', nome: 'Rolamento', icone: '🤸', nivel: 5, mana: 10, cd: 8, tipo: 'buff', anim: 'Dodge_Backward', dur: 0.45, recuo: 6, buff: { atk: 0.6, dur: 4 }, desc: 'Salta para trás e ganha +60% de dano' },
    ],
  },
  mag: {
    nome: 'Maga', icone: '🔮', cor: '#7a4fb0', modelo: 'mag',
    desc: 'Magia poderosa em área. Muita mana, pouca vida.',
    vida: 100, mana: 110, atk: 13, def: 2, vel: 5.3,
    basico: { tipo: 'proj', anims: ['Spellcast_Shoot'], dur: 0.6, impacto: 0.3, alcance: 15, proj: 'magia', vel: 20 },
    hab: [
      { id: 'fogo', nome: 'Bola de Fogo', icone: '☄️', nivel: 1, mana: 15, cd: 5, tipo: 'projetil', anim: 'Spellcast_Shoot', dur: 0.6, impacto: 0.3, n: 1, proj: 'fogo', vel: 18, mult: 2, explode: 3.2, desc: 'Explode ao acertar' },
      { id: 'gelo', nome: 'Nova de Gelo', icone: '❄️', nivel: 3, mana: 24, cd: 10, tipo: 'area', anim: 'Spellcast_Raise', dur: 0.8, impacto: 0.4, raio: 5, mult: 1.3, lento: 4, cor: 0x9fe8ff, desc: 'Congela e deixa lento em volta' },
      { id: 'meteoro', nome: 'Meteoro', icone: '🌠', nivel: 5, mana: 35, cd: 14, tipo: 'chuva', anim: 'Spellcast_Long', dur: 0.9, atraso: 1.2, raio: 5.5, mult: 4, cor: 0xff7a2a, desc: 'Um meteoro gigante cai no alvo' },
    ],
  },
};

// valores do herói no nível n (sem equipamento)
export function statsBase(cls, n) {
  const c = CLASSES[cls];
  return { vida: Math.round(c.vida * (1 + 0.14 * (n - 1))), mana: Math.round(c.mana * (1 + 0.08 * (n - 1))), atk: c.atk * (1 + 0.12 * (n - 1)), def: c.def * (1 + 0.1 * (n - 1)), vel: c.vel };
}
export const xpProx = n => Math.round(60 * n ** 1.55);

// ---------------- inimigos ----------------
// armas: [modelo, osso] — 'r' = mão direita, 'l' = esquerda
export const INIMIGOS = {
  lacaio: { nome: 'Esqueleto', modelo: 'lacaio', armas: [['lamina', 'r']], vida: 42, atk: 7, def: 1, vel: 3.4, alcance: 1.9, cd: 1.5, xp: 14, tipo: 'melee', atkAnim: '1H_Melee_Attack_Chop', impacto: 0.45 },
  batedor: { nome: 'Batedor', modelo: 'batedor', armas: [['besta', 'r']], vida: 34, atk: 7, def: 0, vel: 3.8, alcance: 11, cd: 2.2, xp: 16, tipo: 'ranged', atkAnim: '2H_Ranged_Shoot', impacto: 0.35 },
  guerreiro: { nome: 'Guerreiro Esqueleto', modelo: 'guerreiro', armas: [['machado', 'r'], ['escudoP', 'l']], vida: 95, atk: 12, def: 5, vel: 3.1, alcance: 2.3, cd: 1.8, xp: 30, tipo: 'melee', atkAnim: '1H_Melee_Attack_Chop', impacto: 0.5, esc: 1.08 },
  necro: { nome: 'Necromante', modelo: 'necro', armas: [['cajado', 'r']], vida: 55, atk: 10, def: 1, vel: 3.0, alcance: 10, cd: 2.6, xp: 28, tipo: 'caster', atkAnim: 'Spellcast_Shoot', impacto: 0.4, invoca: 12 },
  capitao: { nome: 'Capitão Batedor', modelo: 'batedor', armas: [['besta', 'r'], ['lamina', 'l']], vida: 260, atk: 12, def: 3, vel: 4.2, alcance: 12, cd: 1.6, xp: 150, tipo: 'ranged', atkAnim: '2H_Ranged_Shoot', impacto: 0.35, esc: 1.4, elite: true, rajada: 3 },
  rei: { nome: 'Rei Esqueleto', modelo: 'guerreiro', armas: [['machado', 'r'], ['escudoG', 'l']], vida: 1400, atk: 20, def: 8, vel: 3.6, alcance: 3.2, cd: 1.7, xp: 800, tipo: 'melee', atkAnim: '1H_Melee_Attack_Chop', impacto: 0.5, esc: 2.0, chefe: true },
};
export function statsInimigo(tipo, nivel) {
  const d = INIMIGOS[tipo], m = nivel - 1;
  return { vida: Math.round(d.vida * (1 + 0.38 * m)), atk: d.atk * (1 + 0.24 * m), def: d.def * (1 + 0.15 * m), xp: Math.round(d.xp * (1 + 0.3 * m)) };
}

// ---------------- itens ----------------
export const RARIDADES = [
  { n: 'Comum', cor: '#d8d8d8', m: 1 },
  { n: 'Raro', cor: '#4aa3ff', m: 1.35 },
  { n: 'Épico', cor: '#c07bff', m: 1.8 },
  { n: 'Lendário', cor: '#ffb02e', m: 2.4 },
];
const NOMES_ARMA = { cav: 'Espada', bar: 'Machado', arq: 'Besta', mag: 'Cajado' };
const ADJ = ['Velha', 'de Ferro', 'de Aço', 'Rúnica', 'do Guardião', 'Sombria', 'Real'];
const ARMADURAS = ['Gibão', 'Cota de Malha', 'Couraça', 'Armadura de Placas'];
const AMULETOS = ['Amuleto', 'Talismã', 'Pingente', 'Relíquia'];
let seqItem = 1;
export function novoItem(slot, nivel, rar, cls) {
  const r = RARIDADES[rar], id = Date.now().toString(36) + (seqItem++);
  const adj = ADJ[Math.min(ADJ.length - 1, Math.floor(nivel / 2) + rar)];
  if (slot === 'arma') return { id, slot, nivel, rar, nome: `${NOMES_ARMA[cls]} ${adj}`, atk: Math.round((3 + nivel * 2.2) * r.m) };
  if (slot === 'armadura') return { id, slot, nivel, rar, nome: `${ARMADURAS[Math.min(3, Math.floor(nivel / 3))]} ${rar >= 2 ? adj : ''}`.trim(), def: Math.round((2 + nivel * 1.3) * r.m), vida: Math.round(nivel * 6 * r.m) };
  return { id, slot, nivel, rar, nome: `${AMULETOS[Math.min(3, rar)]} ${adj}`, vida: Math.round((10 + nivel * 7) * r.m), atk: Math.round(nivel * 0.6 * r.m) };
}
export const precoItem = it => Math.round((8 + it.nivel * 6) * RARIDADES[it.rar].m);
export const POCAO = { preco: 20, cura: 0.45 };
export const ETER = { preco: 15, mana: 0.5 };

// ---------------- missões da história ----------------
// obj: matar (zona/tipos, qtd) | bau (id) — ao completar, volte ao Ancião
export const MISSOES = [
  {
    id: 'm1', nome: 'Ossos na Floresta', dica: 'Floresta Sombria (norte)',
    falaInicio: ['Herói! Graças aos céus você chegou.', 'O Rei Esqueleto roubou a Coroa de Ferro, e desde então os mortos andam pela floresta.', 'Vá ao norte e derrote 5 esqueletos. Mostre que eles podem cair!'],
    falaFim: ['Incrível! Os esqueletos caíram mesmo.', 'Pegue esta arma. Você vai precisar dela.'],
    obj: { tipo: 'matar', zona: 'floresta', qtd: 5, txt: 'Derrote esqueletos na floresta' }, xp: 140, ouro: 60, item: { slot: 'arma', nivel: 3, rar: 1 },
  },
  {
    id: 'm2', nome: 'O Acampamento', dica: 'Acampamento a noroeste da floresta',
    falaInicio: ['Os batedores têm um acampamento no fundo da floresta, a noroeste.', 'Quem comanda é o Capitão Batedor. Sem ele, a floresta fica em paz.'],
    falaFim: ['O Capitão caiu? Você é mesmo o herói da profecia!', 'Leve estas poções e esta armadura.'],
    obj: { tipo: 'matar', tipos: ['capitao'], qtd: 1, txt: 'Derrote o Capitão Batedor' }, xp: 320, ouro: 120, pocoes: 3, item: { slot: 'armadura', nivel: 4, rar: 1 },
  },
  {
    id: 'm3', nome: 'As Ruínas do Leste', dica: 'Ruínas (leste)',
    falaInicio: ['A chave do castelo foi escondida num baú antigo nas Ruínas do Leste.', 'Guerreiros e necromantes guardam o lugar. Cuidado!'],
    falaFim: ['A Chave do Castelo! Agora o portão ao sul pode ser aberto.', 'Este amuleto era do meu avô. Que te proteja.'],
    obj: { tipo: 'bau', id: 'bau_ruinas', txt: 'Abra o baú antigo nas ruínas' }, xp: 500, ouro: 200, item: { slot: 'amuleto', nivel: 6, rar: 2 },
  },
  {
    id: 'm4', nome: 'A Coroa de Ferro', dica: 'Castelo (sul)',
    falaInicio: ['Chegou a hora. O Rei Esqueleto está no pátio do castelo, ao sul.', 'Traga a Coroa de Ferro de volta para o reino!'],
    falaFim: ['A COROA DE FERRO! O reino está salvo!', 'Você será lembrado para sempre. Mas ainda há mortos vagando...', 'Se quiser, tenho caçadas para você. Os esqueletos voltam cada vez mais fortes.'],
    obj: { tipo: 'matar', tipos: ['rei'], qtd: 1, txt: 'Derrote o Rei Esqueleto' }, xp: 1500, ouro: 600, item: { slot: 'amuleto', nivel: 10, rar: 3, nome: 'Coroa de Ferro' },
  },
];
// caçadas repetíveis depois da história
export function cacada(n, nivelJog) {
  const zonas = [['floresta', 'Floresta Sombria'], ['ruinas', 'Ruínas do Leste'], ['castelo', 'Castelo']];
  const [z, nz] = zonas[n % 3], qtd = 8 + (n % 4) * 2;
  return {
    id: 'c' + n, nome: `Caçada #${n + 1}`, dica: nz, cacada: true,
    falaInicio: [`Os mortos voltaram em ${nz}. Derrote ${qtd} deles.`],
    falaFim: ['Bom trabalho! Aqui está a recompensa.'],
    obj: { tipo: 'matar', zona: z, qtd, txt: `Derrote inimigos: ${nz}` },
    xp: Math.round(80 * nivelJog * (1 + qtd / 10)), ouro: 40 * nivelJog, item: { slot: ['arma', 'armadura', 'amuleto'][n % 3], nivel: nivelJog, rar: 1 + (n % 3 === 2 ? 1 : 0) },
  };
}
