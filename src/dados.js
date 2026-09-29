// Dados do jogo: classes, habilidades, inimigos, itens e missões.

export const VERSAO = 20;

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
// armas: [modelo, osso] — 'r' = mão direita, 'l' = esquerda. ouro: recompensa base por abate.
export const INIMIGOS = {
  lacaio: { nome: 'Esqueleto', modelo: 'lacaio', armas: [['lamina', 'r']], vida: 30, atk: 6, def: 0, vel: 3.2, alcance: 1.9, cd: 1.4, xp: 8, ouro: 5, tipo: 'melee', atkAnim: '1H_Melee_Attack_Chop', impacto: 0.45 },
  batedor: { nome: 'Batedor', modelo: 'batedor', armas: [['besta', 'r']], vida: 24, atk: 7, def: 0, vel: 3.6, alcance: 13, cd: 2.2, xp: 10, ouro: 6, tipo: 'ranged', atkAnim: '2H_Ranged_Shoot', impacto: 0.35 },
  guerreiro: { nome: 'Guerreiro', modelo: 'guerreiro', armas: [['machado', 'r'], ['escudoP', 'l']], vida: 90, atk: 12, def: 4, vel: 2.7, alcance: 2.3, cd: 1.8, xp: 20, ouro: 12, tipo: 'melee', atkAnim: '1H_Melee_Attack_Chop', impacto: 0.5, esc: 1.12 },
  necro: { nome: 'Necromante', modelo: 'necro', armas: [['cajado', 'r']], vida: 45, atk: 9, def: 1, vel: 2.9, alcance: 12, cd: 2.6, xp: 18, ouro: 11, tipo: 'caster', atkAnim: 'Spellcast_Shoot', impacto: 0.4, invoca: 9 },
  capitao: { nome: 'Capitão Batedor', modelo: 'batedor', armas: [['besta', 'r'], ['lamina', 'l']], vida: 300, atk: 9, def: 2, vel: 3.4, alcance: 14, cd: 1.8, xp: 120, ouro: 90, tipo: 'ranged', atkAnim: '2H_Ranged_Shoot', impacto: 0.35, esc: 1.45, elite: true, rajada: 3 },
  rei: { nome: 'Rei Esqueleto', modelo: 'guerreiro', armas: [['machado', 'r'], ['escudoG', 'l']], vida: 1600, atk: 30, def: 8, vel: 2.4, alcance: 3.2, cd: 1.7, xp: 500, ouro: 400, tipo: 'melee', atkAnim: '1H_Melee_Attack_Chop', impacto: 0.5, esc: 2.1, chefe: true },
};
// o "nível" do inimigo é o número da onda
export function statsInimigo(tipo, nivel) {
  const d = INIMIGOS[tipo], m = nivel - 1;
  return { vida: Math.round(d.vida * (1 + 0.27 * m + 0.01 * m * m)), atk: d.atk * (1 + 0.16 * m), def: d.def * (1 + 0.1 * m), xp: Math.round(d.xp * (1 + 0.2 * m)), ouro: Math.round(d.ouro * (1 + 0.12 * m)) };
}
// composição da onda n: lista de [tipo, qtd]
export function onda(n) {
  const l = [['lacaio', 4 + Math.round(n * 1.6)]];
  if (n >= 2) l.push(['batedor', Math.floor(n / 2)]);
  if (n >= 4) l.push(['guerreiro', Math.floor((n - 2) / 2)]);
  if (n >= 6) l.push(['necro', Math.floor((n - 3) / 3)]);
  if (n % 5 === 0 && n % 10) l.push(['capitao', 1 + Math.floor(n / 20)]);
  if (n % 10 === 0) l.push(['rei', 1 + Math.floor(n / 30)]);
  return l;
}
export const bonusOnda = n => 30 + n * 12;

// ---------------- defesas (8 estágios cada) ----------------
export const MAXNV = 8;
export const estagio = n => Math.min(4, 1 + Math.floor((n - 1) / 2)); // 4 visuais: nv 1-2, 3-4, 5-6, 7-8
export const DEFESAS = {
  arqueiros: { nome: 'Torre de Arqueiros', icone: '🏹', cor: '#5fb83a', custo: 50, desc: 'Flechas rápidas. Nos níveis altos atira em vários inimigos.', dano: 6, cad: 1.0, alcance: 23 },
  catapulta: { nome: 'Catapulta', icone: '🪨', cor: '#c98a3a', custo: 120, desc: 'Pedra pesada com dano em área. Lenta, mas alcança longe.', dano: 20, cad: 3.4, alcance: 36, raio: 3, minimo: 6 },
  balista: { nome: 'Balista', icone: '🎯', cor: '#8a6a4a', custo: 100, desc: 'Virote gigante que atravessa a fila de inimigos.', dano: 26, cad: 2.6, alcance: 30 },
  magia: { nome: 'Torre Mágica', icone: '🔮', cor: '#8a5ad8', custo: 110, desc: 'Raio mágico que deixa os inimigos lentos.', dano: 8, cad: 1.3, alcance: 23, lento: 0.45 },
  quartel: { nome: 'Quartel', icone: '⚔️', cor: '#4a7bd0', custo: 90, desc: 'Treina soldados que saem pelo portão para lutar.', vida: 90, atk: 9 },
};
export function statsDefesa(tipo, n) {
  const d = DEFESAS[tipo], m = n - 1, s = { ...d };
  s.dano = (d.dano || 0) * 1.38 ** m;
  s.cad = (d.cad || 1) * 0.94 ** m;
  s.alcance = (d.alcance || 0) * (1 + 0.04 * m);
  if (tipo === 'arqueiros') s.alvos = n >= 7 ? 3 : n >= 5 ? 2 : 1;
  if (tipo === 'catapulta') s.raio = d.raio * (1 + 0.07 * m);
  if (tipo === 'magia') { s.lento = Math.min(0.7, d.lento + 0.03 * m); s.corrente = n >= 5 ? (n >= 7 ? 3 : 2) : 1; }
  if (tipo === 'balista') s.perfura = 2 + Math.floor(n / 2);
  if (tipo === 'quartel') { s.soldados = [1, 1, 2, 2, 3, 3, 4, 5][m]; s.vida = d.vida * 1.3 ** m; s.atk = d.atk * 1.32 ** m; s.renasce = Math.max(5, 14 - m * 1.2); s.arqueiro = n >= 5; }
  return s;
}
export const custoDefesa = (tipo, n) => Math.round(DEFESAS[tipo].custo * 1.55 ** (n - 1)); // preço para chegar ao nível n

// muralha, mina (tycoon) e forja do herói
export const MURALHA = { vida: [800, 1300, 2000, 3000, 4500, 6500, 9500, 14000], custo: [0, 150, 320, 600, 1000, 1700, 2800, 4500], nomes: ['Paliçada', 'Paliçada Reforçada', 'Muro de Pedra', 'Muro de Pedra II', 'Muralha', 'Muralha II', 'Fortaleza', 'Fortaleza Real'] };
export const MINA = { renda: [1, 1.8, 3, 4.5, 7, 10, 14, 20], custo: [60, 130, 240, 420, 720, 1200, 2000, 3300], cofre: 150 }; // cofre: segundos de renda que cabem
export const FORJA = { max: 12, custo: n => Math.round(70 * 1.55 ** n) }; // arma: +12% ataque / armadura: +12% defesa e +8% vida
