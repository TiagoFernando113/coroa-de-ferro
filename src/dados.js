// Batalha da Ponte: números das fases e das melhorias.
export const VERSAO = 62;

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
  ['mg:MushroomKing', 'Rei Cogumelo'], ['mg:BlueDemon', 'Demônio Azul'], ['mg:Dino', 'Raptor Rei'], ['mg:Tribal', 'Xamã Tribal']];

// configuração de cada fase (n = 1, 2, 3...)
export function fase(n) {
  let sd = n * 7919 + 13; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const NB = 20, esq = [], dir = [];
  // pista da esquerda: valores pequenos, sempre aberta; um x2 de vez em quando
  for (let i = 0; i < NB; i++) {
    if (i === 10 && n >= 3) { esq.push({ tipo: 'barreira', hp: 3 + n }); continue; }
    if (i % 7 === 6) { esq.push({ tipo: 'vezes', valor: 2 }); continue; }
    if (i === 4) { esq.push({ tipo: 'poder', p: 'flecha' }); continue; }
    if (i === 15) { esq.push({ tipo: 'poder', p: 'rapido' }); continue; }
    const l = [1, 1, 2, 2, 3, 5]; esq.push({ tipo: 'mais', valor: l[Math.floor(r() * Math.min(l.length, 3 + Math.floor(i / 5)))] });
  }
  // pista da direita: rica, mas fechada por barreiras
  const grandes = [10, 15, 20, 25, 50, 99];
  for (let i = 0; i < NB; i++) {
    if (i === 0) { dir.push({ tipo: 'barreira', hp: 6 + 4 * n }); continue; }
    if (i === 10) { dir.push({ tipo: 'barreira', hp: 10 + 7 * n }); continue; }
    if (i === 6) { dir.push({ tipo: 'poder', p: 'rapido' }); continue; }
    if (i === 15) { dir.push({ tipo: 'poder', p: 'flecha' }); continue; }
    dir.push({ tipo: 'mais', valor: grandes[Math.min(grandes.length - 1, Math.floor(i / 3.4 + r() * 1.5))] });
  }
  const [modelo, nome] = CHEFES[(n - 1) % CHEFES.length];
  return { n, esq, dir, chefe: { modelo, nome: n > CHEFES.length ? `${nome} +${Math.floor((n - 1) / CHEFES.length)}` : nome, hp: Math.round(220 + 160 * n ** 1.1) },
    // portões no meio da ponte: os soldados azuis que passam se multiplicam
    portoes: [{ tipo: 'vezes', valor: 2, i: 6 }, { tipo: 'mais', valor: 10 + 5 * n, i: 13 }],
    ritmo: 2 + 0.9 * n ** 1.15, duro: Math.floor(n / 3), moedas: 20 + 12 * n }; // ritmo: vermelhos por segundo no começo (cresce com o tempo)
}
