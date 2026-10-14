// Pets: saem de ovos, seguem o herói (atiram junto) e lutam sozinhos no modo Conquista.
// 3 iguais viram 1 com estrela (★1 a ★5, cada estrela 3x mais forte). Cada pet dá um bônus na ponte.
import { S, salvar, fimDeSemana } from './meta.js';

export const RARIDADES = [
  { nome: 'Comum', cor: '#9aa3ad', mult: 1, moedas: 2, custo: 30 },
  { nome: 'Raro', cor: '#3a8af0', mult: 1.6, moedas: 4, custo: 60 },
  { nome: 'Épico', cor: '#a04ae8', mult: 2.6, moedas: 7, custo: 120 },
  { nome: 'Lendário', cor: '#f2b51a', mult: 4.2, moedas: 12, custo: 240 },
];
// classe: tanque (muita vida, na frente), lutador (corpo a corpo), atirador (de longe)
export const CLASSES = {
  tanque: { nome: 'Tanque', icone: 'escudo', hp: 260, atk: 13, alc: 2.8, cad: 1.2, vel: 4 },
  lutador: { nome: 'Lutador', icone: 'forca', hp: 165, atk: 24, alc: 2.8, cad: 0.9, vel: 5.5 },
  atirador: { nome: 'Atirador', icone: 'arq', hp: 105, atk: 19, alc: 15, cad: 1.1, vel: 4.5 },
};
// bônus que cada pet dá na ponte (somam na equipe). b: [[tipo, peso]]
export const BONUS = {
  soldados: { nome: 'Soldados iniciais', icone: 'herois' }, tiro: { nome: 'Velocidade de tiro', icone: 'raio' }, moedas: { nome: 'Moedas', icone: 'ouro' },
  muralha: { nome: 'Vida da muralha', icone: 'forja' }, pilhas: { nome: 'Valor das pilhas', icone: 'estrela' }, escudo: { nome: 'Soldados sobrevivem', icone: 'cav' },
  recarga: { nome: 'Recarga dos poderes', icone: 'relogio' }, lento: { nome: 'Orcs mais lentos', icone: 'h_gelo' }, chefe: { nome: 'Dano no chefe', icone: 'chefe' },
  sorte: { nome: 'Sorte nos ovos', icone: 'ovo' },
  fogo: { nome: 'Flechas de fogo: atravessam', icone: 'h_fogo', un: ' orcs', unico: true }, critico: { nome: 'Crítico x3 no chefe', icone: 'h_lamina', unico: true },
  reviver: { nome: 'Orc derrotado vira soldado', icone: 'caveira', unico: true },
};
// m: modelo, o: modelo evoluído (★ em diante), r: raridade, cor: cor do tiro
export const PETS = {
  cao: { nome: 'Totó', m: 'mb:Dog', r: 0, c: 'lutador', b: [['soldados', 1]] },
  gato: { nome: 'Bigode', m: 'mb:Cat', r: 0, c: 'atirador', cor: 0xffd84a, b: [['tiro', 1]] },
  galinha: { nome: 'Cocó', m: 'mb:Chicken', r: 0, c: 'atirador', cor: 0xfff2a0, b: [['sorte', 1.5]] },
  gosma: { nome: 'Gosma', m: 'mb:GreenBlob', r: 0, c: 'tanque', b: [['muralha', 1.5]] },
  pombo: { nome: 'Pombão', m: 'mv:Pigeon', r: 0, c: 'atirador', cor: 0xd8e0ea, b: [['pilhas', 1]] },
  cogu: { nome: 'Cogumelito', m: 'mb:Mushnub', o: 'mb:Mushnub_Evolved', r: 1, c: 'tanque', b: [['escudo', 0.5]] },
  chiclete: { nome: 'Chiclete', m: 'mb:PinkBlob', r: 1, c: 'tanque', b: [['moedas', 1]] },
  bolhudo: { nome: 'Bolhudo', m: 'mb:Fish', r: 1, c: 'atirador', cor: 0x6ad8ff, b: [['recarga', 1]] },
  neve: { nome: 'Pé de Neve', m: 'mb:Yeti', r: 1, c: 'lutador', b: [['lento', 0.6]] },
  ferrao: { nome: 'Ferrão', m: 'mv:Armabee', o: 'mv:Armabee_Evolved', r: 1, c: 'lutador', b: [['chefe', 1]] },
  glub: { nome: 'Glub', m: 'mv:Glub', o: 'mv:Glub_Evolved', r: 2, c: 'atirador', cor: 0x8aff6a, b: [['tiro', 1], ['pilhas', 1]] },
  pedrinha: { nome: 'Pedrinha', m: 'mv:Goleling', o: 'mv:Goleling_Evolved', r: 2, c: 'tanque', b: [['muralha', 1.5], ['escudo', 0.5]] },
  alpaca: { nome: 'Rei Alpaca', m: 'mv:Alpaking', o: 'mv:Alpaking_Evolved', r: 2, c: 'lutador', b: [['moedas', 1], ['soldados', 1]] },
  merlin: { nome: 'Merlinzinho', m: 'mb:Wizard', r: 2, c: 'atirador', cor: 0xb07aff, b: [['recarga', 1], ['chefe', 1]] },
  ninja: { nome: 'Ninja', m: 'mb:Ninja', r: 3, c: 'lutador', b: [['critico', 0.4], ['chefe', 1]] },
  fantasma: { nome: 'Assombro', m: 'mv:Ghost', o: 'mv:Ghost_Skull', r: 3, c: 'tanque', b: [['reviver', 0.3], ['lento', 0.6]] },
  piu: { nome: 'Piu', m: 'mb:Birb', r: 1, c: 'atirador', cor: 0xffb03a, b: [['pilhas', 1]] },
  zorp: { nome: 'Zorp', m: 'mb:Alien', r: 2, c: 'lutador', b: [['sorte', 1.5], ['chefe', 1]] },
  lula: { nome: 'Lulão', m: 'mv:Squidle', r: 3, c: 'atirador', cor: 0x9a6aff, b: [['critico', 0.4], ['recarga', 1]] },
  totem: { nome: 'Totem', m: 'mv:Tribal', r: 3, c: 'tanque', b: [['muralha', 1.5], ['moedas', 1]] },
  dragao: { nome: 'Dragãozinho', m: 'mv:Dragon', o: 'mv:Dragon_Evolved', r: 3, c: 'atirador', cor: 0xff6a1a, b: [['fogo', 1], ['tiro', 1]] },
};
// ovos: chances de cada raridade
export const OVOS = {
  comum: { nome: 'Ovo Comum', preco: 300, chances: [70, 25, 4.5, 0.5], cor: ['#f4ead8', '#c8b48a'] },
  magico: { nome: 'Ovo Mágico', preco: 1500, chances: [15, 50, 29, 6], cor: ['#c8a0ff', '#6a3ab0'] },
};
export const MAX_EQUIPE = 5, MAX_NV = 60, MAX_EST = 5;
// estrelas: 3 iguais de um nível viram 1 do próximo
export const ESTRELAS = [null, { nome: 'Dourado', cor: '#ffc81a', tinta: 0xffd23a }, { nome: 'Diamante', cor: '#4ad8ff', tinta: 0x6ae0ff },
  { nome: 'Rubi', cor: '#ff3a6a', tinta: 0xff3a6a }, { nome: 'Esmeralda', cor: '#2ae86a', tinta: 0x3aff7a }, { nome: 'Cósmico', cor: '#b04aff', tinta: 0xa040ff }];

export function iniciarPets() {
  S.pets = S.pets || { cao: { e: [1], nv: 1 } }; S.equipe = S.equipe || ['cao']; S.ovos = S.ovos || { comum: 1, magico: 0 };
  for (const P of Object.values(S.pets)) { if (!P.e) { P.e = [P.n || 0, P.o || 0]; delete P.n; delete P.o; } while (P.e.length <= MAX_EST) P.e.push(0); }
  S.equipe = S.equipe.filter(k => PETS[base(k)] && temPet(k));
  S.cq = S.cq || { est: 1, t: Date.now() };
}
// chave na equipe: 'cao' (normal), 'cao*' (★1), 'cao**' (★2)...
export const est = k => (k.match(/\*/g) || []).length;
export const ehOuro = k => est(k) > 0;
export const base = k => k.replace(/\*/g, '');
export const chave = (b, e) => b + '*'.repeat(e);
export const temPet = k => (S.pets[base(k)]?.e[est(k)] || 0) > 0;
export const qtd = k => S.pets[base(k)]?.e[est(k)] || 0;
export const modeloDe = k => { const D = PETS[base(k)]; return est(k) && D.o ? D.o : D.m; };
export const tinta = k => { const e = est(k); return !e ? null : e === 1 && PETS[base(k)].o ? null : ESTRELAS[e].tinta; }; // ★1 com forma evoluída fica com as cores dela
// atributos de um pet (nível nv; inimigos usam mult extra)
export function atributos(k, nv = S.pets[base(k)]?.nv || 1, extra = 1) {
  const D = PETS[base(k)], Cl = CLASSES[D.c], m = RARIDADES[D.r].mult * 1.12 ** (nv - 1) * 3 ** est(k) * extra;
  return { hp: Math.round(Cl.hp * m), atk: Math.round(Cl.atk * m), alc: Cl.alc, cad: Cl.cad, vel: Cl.vel, classe: D.c };
}
export const forca = a => Math.round(a.hp / 3 + a.atk * 4 / a.cad);
export const forcaEquipe = () => S.equipe.reduce((s, k) => s + forca(atributos(k)), 0);
// bônus de um pet: raridade x nível x estrelas
const BASE_BONUS = [6, 10, 16, 25];
export function bonusPet(k) {
  const D = PETS[base(k)], nv = S.pets[base(k)]?.nv || 1, m = (1 + 0.04 * (nv - 1)) * (1 + est(k));
  return D.b.map(([t, p]) => [t, t === 'fogo' ? 1 + est(k) + Math.floor(nv / 15) : Math.round(BASE_BONUS[D.r] * p * m)]);
}
const LIMITE = { escudo: 50, critico: 60, reviver: 50, lento: 60, tiro: 150, pilhas: 200, chefe: 300, soldados: 300, muralha: 300, moedas: 300, sorte: 300, recarga: 150 };
export function bonusEquipe() {
  const B = {}; for (const k of S.equipe) for (const [t, v] of bonusPet(k)) B[t] = (B[t] || 0) + v;
  for (const t in LIMITE) if (B[t] > LIMITE[t]) B[t] = LIMITE[t];
  return B;
}
export const txtBonus = (t, v) => BONUS[t].un ? `${BONUS[t].nome} +${v}${BONUS[t].un}` : `${BONUS[t].nome} ${t === 'recarga' || t === 'lento' ? '-' : '+'}${v}%`;
export const custoNivel = k => { const P = S.pets[base(k)]; return Math.round(RARIDADES[PETS[base(k)].r].custo * 1.28 ** (P.nv - 1)); };
export function subirNivel(k) {
  const P = S.pets[base(k)]; if (!P || P.nv >= MAX_NV) return false; const c = custoNivel(k); if (S.moedas < c) return false;
  S.moedas -= c; P.nv++; salvar(); return true;
}
// 3 iguais com as mesmas estrelas viram 1 com uma estrela a mais
export function juntar(k) {
  const P = S.pets[base(k)], e = est(k); if (!P || e >= MAX_EST || P.e[e] < 3) return null;
  P.e[e] -= 3; P.e[e + 1]++; const novo = chave(base(k), e + 1);
  if (P.e[e] === 0) { const i = S.equipe.indexOf(k); if (i >= 0) S.equipe[i] = novo; }
  S.equipe = [...new Set(S.equipe)]; salvar(); return novo;
}
export function equipar(k) {
  const i = S.equipe.indexOf(k);
  if (i >= 0) { if (S.equipe.length > 1) S.equipe.splice(i, 1); else return false; }
  else { if (!temPet(k)) return false; if (S.equipe.length >= MAX_EQUIPE) S.equipe.shift(); S.equipe.push(k); }
  salvar(); return true;
}
export const variantes = () => Object.keys(S.pets).flatMap(b => S.pets[b].e.map((n, e) => n > 0 ? chave(b, e) : null).filter(Boolean));
export function equiparMelhores() { S.equipe = variantes().sort((a, b) => forca(atributos(b)) - forca(atributos(a))).slice(0, MAX_EQUIPE); salvar(); }
// sorteia o pet de um ovo (usa um ovo guardado ou paga com moedas); a sorte aumenta épico e lendário
export function chocar(tipo) {
  const O = OVOS[tipo]; if (!O) return null;
  if (S.ovos[tipo] > 0) S.ovos[tipo]--; else if (S.moedas >= O.preco) S.moedas -= O.preco; else return null;
  const sorte = (1 + (bonusEquipe().sorte || 0) / 100) * (fimDeSemana() ? 2 : 1), ch = O.chances.map((c, i) => i >= 2 ? c * sorte : c), tot = ch.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot, rar = 0; for (let i = 0; i < 4; i++) { if (r < ch[i]) { rar = i; break; } r -= ch[i]; }
  const lista = Object.keys(PETS).filter(k => PETS[k].r === rar), k = lista[Math.floor(Math.random() * lista.length)];
  const novo = !S.pets[k]; S.pets[k] = S.pets[k] || { e: [0, 0, 0, 0, 0, 0], nv: 1 }; S.pets[k].e[0]++;
  if (novo && S.equipe.length < MAX_EQUIPE) S.equipe.push(k);
  salvar(); return { k, novo };
}
// ---- lucro ocioso da Conquista ----
export const MAX_OCIOSO = 9 * 3600e3;
export const lucroHora = () => 40 + 18 * (S.cq.est - 1);
export const tempoOcioso = () => Math.min(MAX_OCIOSO, Math.max(0, Date.now() - S.cq.t));
export const lucroOcioso = () => Math.floor(lucroHora() * tempoOcioso() / 3600e3);
export function coletarOcioso() { const m = lucroOcioso(); S.moedas += m; S.cq.t = Date.now(); salvar(); return m; }
