// Pets: saem de ovos, seguem o herói (atiram junto) e lutam sozinhos no modo Conquista.
// 3 iguais viram 1 dourado (★, 3x mais forte). Moedas sobem o nível de cada pet.
import { S, salvar } from './meta.js';

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
// m: modelo, o: modelo da forma dourada (evoluída), r: raridade, cor: cor do tiro
export const PETS = {
  cao: { nome: 'Totó', m: 'mb:Dog', r: 0, c: 'lutador' },
  gato: { nome: 'Bigode', m: 'mb:Cat', r: 0, c: 'atirador', cor: 0xffd84a },
  galinha: { nome: 'Cocó', m: 'mb:Chicken', r: 0, c: 'atirador', cor: 0xfff2a0 },
  gosma: { nome: 'Gosma', m: 'mb:GreenBlob', r: 0, c: 'tanque' },
  pombo: { nome: 'Pombão', m: 'mv:Pigeon', r: 0, c: 'atirador', cor: 0xd8e0ea },
  cogu: { nome: 'Cogumelito', m: 'mb:Mushnub', o: 'mb:Mushnub_Evolved', r: 1, c: 'tanque' },
  chiclete: { nome: 'Chiclete', m: 'mb:PinkBlob', r: 1, c: 'tanque' },
  bolhudo: { nome: 'Bolhudo', m: 'mb:Fish', r: 1, c: 'atirador', cor: 0x6ad8ff },
  neve: { nome: 'Pé de Neve', m: 'mb:Yeti', r: 1, c: 'lutador' },
  ferrao: { nome: 'Ferrão', m: 'mv:Armabee', o: 'mv:Armabee_Evolved', r: 1, c: 'lutador' },
  glub: { nome: 'Glub', m: 'mv:Glub', o: 'mv:Glub_Evolved', r: 2, c: 'atirador', cor: 0x8aff6a },
  pedrinha: { nome: 'Pedrinha', m: 'mv:Goleling', o: 'mv:Goleling_Evolved', r: 2, c: 'tanque' },
  alpaca: { nome: 'Rei Alpaca', m: 'mv:Alpaking', o: 'mv:Alpaking_Evolved', r: 2, c: 'lutador' },
  merlin: { nome: 'Merlinzinho', m: 'mb:Wizard', r: 2, c: 'atirador', cor: 0xb07aff },
  ninja: { nome: 'Ninja', m: 'mb:Ninja', r: 3, c: 'lutador' },
  fantasma: { nome: 'Assombro', m: 'mv:Ghost', o: 'mv:Ghost_Skull', r: 3, c: 'tanque' },
  dragao: { nome: 'Dragãozinho', m: 'mv:Dragon', o: 'mv:Dragon_Evolved', r: 3, c: 'atirador', cor: 0xff6a1a },
};
// ovos: chances de cada raridade
export const OVOS = {
  comum: { nome: 'Ovo Comum', preco: 300, chances: [70, 25, 4.5, 0.5], cor: ['#f4ead8', '#c8b48a'] },
  magico: { nome: 'Ovo Mágico', preco: 1500, chances: [15, 50, 29, 6], cor: ['#c8a0ff', '#6a3ab0'] },
};
export const MAX_EQUIPE = 5;
export const MAX_NV = 60;

export function iniciarPets() {
  S.pets = S.pets || { cao: { n: 1, o: 0, nv: 1 } }; S.equipe = S.equipe || ['cao']; S.ovos = S.ovos || { comum: 1, magico: 0 };
  S.cq = S.cq || { est: 1, t: Date.now() };
}
// chave na equipe: 'cao' (normal) ou 'cao*' (dourado)
export const ehOuro = k => k.endsWith('*');
export const base = k => k.replace('*', '');
export const temPet = k => { const P = S.pets[base(k)]; return !!P && (ehOuro(k) ? P.o > 0 : P.n > 0); };
export const modeloDe = k => { const D = PETS[base(k)]; return ehOuro(k) && D.o ? D.o : D.m; };
export const tingido = k => ehOuro(k) && !PETS[base(k)].o; // dourado sem forma evoluída: pinta de ouro
// atributos de um pet (nível nv; inimigos usam mult extra)
export function atributos(k, nv = S.pets[base(k)]?.nv || 1, extra = 1) {
  const D = PETS[base(k)], Cl = CLASSES[D.c], m = RARIDADES[D.r].mult * 1.12 ** (nv - 1) * (ehOuro(k) ? 3 : 1) * extra;
  return { hp: Math.round(Cl.hp * m), atk: Math.round(Cl.atk * m), alc: Cl.alc, cad: Cl.cad, vel: Cl.vel, classe: D.c };
}
export const forca = a => Math.round(a.hp / 3 + a.atk * 4 / a.cad);
export const forcaEquipe = () => S.equipe.reduce((s, k) => s + forca(atributos(k)), 0);
export const custoNivel = k => { const P = S.pets[base(k)]; return Math.round(RARIDADES[PETS[base(k)].r].custo * 1.28 ** (P.nv - 1)); };
export function subirNivel(k) {
  const P = S.pets[base(k)]; if (!P || P.nv >= MAX_NV) return false; const c = custoNivel(k); if (S.moedas < c) return false;
  S.moedas -= c; P.nv++; salvar(); return true;
}
// 3 normais viram 1 dourado
export function juntar(k) {
  const P = S.pets[k]; if (!P || P.n < 3) return false;
  P.n -= 3; P.o++;
  if (P.n === 0) { const i = S.equipe.indexOf(k); if (i >= 0) S.equipe[i] = k + '*'; }
  S.equipe = [...new Set(S.equipe)]; salvar(); return true;
}
export function equipar(k) {
  const i = S.equipe.indexOf(k);
  if (i >= 0) { if (S.equipe.length > 1) S.equipe.splice(i, 1); else return false; }
  else { if (!temPet(k)) return false; if (S.equipe.length >= MAX_EQUIPE) S.equipe.shift(); S.equipe.push(k); }
  salvar(); return true;
}
// sorteia o pet de um ovo (paga com moedas ou usa um ovo guardado)
export function chocar(tipo) {
  const O = OVOS[tipo]; if (!O) return null;
  if (S.ovos[tipo] > 0) S.ovos[tipo]--; else if (S.moedas >= O.preco) S.moedas -= O.preco; else return null;
  let r = Math.random() * 100, rar = 0; for (let i = 0; i < 4; i++) { if (r < O.chances[i]) { rar = i; break; } r -= O.chances[i]; }
  const lista = Object.keys(PETS).filter(k => PETS[k].r === rar), k = lista[Math.floor(Math.random() * lista.length)];
  const novo = !S.pets[k]; S.pets[k] = S.pets[k] || { n: 0, o: 0, nv: 1 }; S.pets[k].n++;
  if (novo && S.equipe.length < MAX_EQUIPE) S.equipe.push(k);
  salvar(); return { k, novo };
}
// bônus dos pets equipados nas moedas da ponte
export const bonusMoedas = () => S.equipe.reduce((s, k) => s + RARIDADES[PETS[base(k)].r].moedas * (ehOuro(k) ? 3 : 1), 0);
// ---- lucro ocioso da Conquista ----
export const MAX_OCIOSO = 9 * 3600e3;
export const lucroHora = () => 40 + 18 * (S.cq.est - 1);
export const tempoOcioso = () => Math.min(MAX_OCIOSO, Math.max(0, Date.now() - S.cq.t));
export const lucroOcioso = () => Math.floor(lucroHora() * tempoOcioso() / 3600e3);
export function coletarOcioso() { const m = lucroOcioso(); S.moedas += m; S.cq.t = Date.now(); salvar(); return m; }
