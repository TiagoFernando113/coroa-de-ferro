// Batalha da Ponte: números das fases e das melhorias.
export const VERSAO = 109;

const SUF = ['', 'K', 'M', 'B', 'T'];
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return Math.floor(n).toString();
  let i = 0; while (n >= 1000 && i < SUF.length - 1) { n /= 1000; i++; }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + SUF[i];
}

// melhorias compradas com moedas entre as fases
export const tiros = n => 2.4 * 1.09 ** n;            // flechas por segundo
export const vidaMuralha = n => 10 + 3 * n;
export const escudo = n => Math.min(0.6, n * 0.06);   // chance do soldado azul sobreviver ao choque
export const UPGRADES = {
  fogo: { nome: 'Tiro rápido', icone: 'raio', desc: n => `${tiros(n).toFixed(1)} tiros/s`, custo: n => Math.round(20 * 1.42 ** n), max: 30 },
  flechas: { nome: 'Flechas por tiro', icone: 'h_triplo', desc: n => `${1 + n} flecha${n ? 's' : ''}`, custo: n => Math.round(160 * 3.4 ** n), max: 4 },
  exercito: { nome: 'Exército inicial', icone: 'herois', desc: n => `+${8 * n} soldados`, custo: n => Math.round(25 * 1.38 ** n), max: 40 },
  vida: { nome: 'Muralha', icone: 'escudo', desc: n => `${vidaMuralha(n)} de vida`, custo: n => Math.round(20 * 1.38 ** n), max: 40 },
  escudos: { nome: 'Escudos', icone: 'cav', desc: n => `${Math.round(escudo(n) * 100)}% sobrevivem`, custo: n => Math.round(45 * 1.6 ** n), max: 10 },
};

// chefes (monstros Quaternius): [modelo, nome]
export const CHEFES = [['mg:Orc', 'Grom, o Brutal'], ['mg:Demon', 'Demônio da Ponte'], ['mg:Yeti', 'Yeti Furioso'], ['mg:Orc_Skull', 'Orc Caveira'],
  ['mg:MushroomKing', 'Rei Cogumelo'], ['mg:BlueDemon', 'Demônio Azul'], ['mg:Dino', 'Raptor Rei'], ['mg:Tribal', 'Xamã Tribal'],
  ['mg:Alien', 'Invasor Estelar'], ['mg:Frog', 'Sapo Rei']];
// habilidade de cada chefe (usada a cada ~11 s, sempre com aviso antes)
export const HABILIDADES = {
  'mg:Orc': { id: 'investida', desc: 'Investida que atropela' }, 'mg:Demon': { id: 'chamas', desc: 'Chamas no chão' },
  'mg:Yeti': { id: 'gelo', desc: 'Congela o herói' }, 'mg:Orc_Skull': { id: 'reviver', desc: 'Levanta os mortos' },
  'mg:MushroomKing': { id: 'esporos', desc: 'Cogumelinhos rápidos' }, 'mg:BlueDemon': { id: 'escudo', desc: 'Escudo mágico' },
  'mg:Dino': { id: 'salto', desc: 'Salta no exército' }, 'mg:Tribal': { id: 'cura', desc: 'Se cura' },
  'mg:Alien': { id: 'laser', desc: 'Raio laser numa pista' }, 'mg:Frog': { id: 'lingua', desc: 'Engole seus soldados' },
};

// configuração de cada fase (n = 1, 2, 3...)
export function fase(n) {
  let sd = n * 7919 + 13; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const NB = 20, esq = [], dir = [], pega = l => l.splice(Math.floor(r() * l.length), 1)[0];
  // posições especiais sorteadas por fase (cada fase tem outro desenho)
  const livresE = [3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18], livresD = [2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17, 18];
  const vezesE = [pega(livresE), pega(livresE), ...(r() < 0.5 ? [pega(livresE)] : [])], poderE = pega(livresE), poderD = [pega(livresD), pega(livresD)];
  const barrE = n >= 3 ? [10, ...(n >= 6 && r() < 0.5 ? [pega(livresE)] : [])] : [], barrD = [0, 10, ...(n >= 5 && r() < 0.4 ? [pega(livresD)] : [])];
  const poderes = ['flecha', 'rapido'], pd = () => poderes[Math.floor(r() * 2)];
  // pista pobre: valores pequenos, sempre aberta, com x2
  for (let i = 0; i < NB; i++) {
    if (barrE.includes(i)) { esq.push({ tipo: 'barreira', hp: 3 + n }); continue; }
    if (vezesE.includes(i)) { esq.push({ tipo: 'vezes', valor: 2 }); continue; }
    if (i === poderE) { esq.push({ tipo: 'poder', p: pd() }); continue; }
    const l = [1, 1, 2, 2, 3, 5]; esq.push({ tipo: 'mais', valor: l[Math.floor(r() * Math.min(l.length, 3 + Math.floor(i / 5)))] });
  }
  // pista rica, fechada por barreiras
  const grandes = [10, 15, 20, 25, 50, 99];
  for (let i = 0; i < NB; i++) {
    if (barrD.includes(i)) { dir.push({ tipo: 'barreira', hp: (i === 0 ? 6 + 4 * n : 10 + 7 * n) }); continue; }
    if (poderD.includes(i)) { dir.push({ tipo: 'poder', p: pd() }); continue; }
    dir.push({ tipo: 'mais', valor: grandes[Math.min(grandes.length - 1, Math.floor(i / 3.4 + r() * 1.5))] });
  }
  // a partir da fase 3 o lado rico pode trocar
  const troca = n >= 3 && r() < 0.5;
  // portões: quantidade, tipo e posição variam
  const posP = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], portoes = [{ tipo: 'vezes', valor: n >= 5 && r() < 0.3 ? 3 : 2, i: pega(posP) }, { tipo: 'mais', valor: 10 + 5 * n, i: pega(posP) }];
  if (n >= 6 && r() < 0.5) portoes.push({ tipo: 'vezes', valor: 2, i: pega(posP) });
  const [modelo, nome] = CHEFES[(n - 1) % CHEFES.length];
  return { n, esq: troca ? dir : esq, dir: troca ? esq : dir, chefe: { modelo, nome: n > CHEFES.length ? `${nome} +${Math.floor((n - 1) / CHEFES.length)}` : nome, hp: Math.round(220 + 160 * n ** 1.1) },
    portoes, ritmo: 2 + 0.9 * n ** 1.15, rotas: n >= 4 ? 2 : 1, vagas: n >= 4 ? 6 : n >= 2 ? 4 : 2, duro: Math.floor(n / 3), moedas: 20 + 12 * n }; // ritmo: vermelhos por segundo no começo (cresce com o tempo)
}
