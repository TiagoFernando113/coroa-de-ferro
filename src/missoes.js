// Missões diárias (3), semanais (3) e o passe da temporada (30 níveis por mês, só prêmios grátis).
// O jogo avisa o que aconteceu com evento('orcs', 120) e as missões contam sozinhas.
import { S, salvar, ganharBau } from './meta.js';

export const TIPOS = {
  orcs: { txt: 'Derrote # orcs', icone: 'caveira', dia: [300, 600, 1000], sem: [5000] },
  fases: { txt: 'Vença # fases', icone: 'h_triplo', dia: [2, 3], sem: [12] },
  chefes: { txt: 'Derrote # chefes', icone: 'chefe', dia: [2, 3], sem: [15] },
  ovos: { txt: 'Choque # ovos', icone: 'ovo', dia: [1, 2], sem: [6] },
  conquista: { txt: 'Vença # estágios na Conquista', icone: 'bandeira', dia: [2, 4], sem: [15] },
  baus: { txt: 'Abra # baús', icone: 'bau', dia: [1, 2], sem: [8] },
  nivelPet: { txt: 'Suba de nível # vezes um pet', icone: 'pata', dia: [2, 3], sem: [10] },
  infinito: { txt: 'Jogue # vezes a Ponte sem fim', icone: 'estrela', dia: [1], sem: [5] },
};
export const PTS_DIA = 40, PTS_SEM = 150, PTS_NIVEL = 100, NIVEIS_PASSE = 30;
const hoje = () => new Date().toLocaleDateString('sv');
const semana = () => { const d = new Date(), dia = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dia); return d.toLocaleDateString('sv'); };
const temporada = () => new Date().toLocaleDateString('sv').slice(0, 7);
function sortear(n, chave, semente) {
  let sd = [...semente].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7) >>> 0 || 1; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const tipos = Object.keys(TIPOS).sort(() => r() - 0.5).slice(0, n);
  return tipos.map(t => { const l = TIPOS[t][chave]; return { t, meta: l[Math.floor(r() * l.length)], prog: 0, pego: false }; });
}
// renova as listas quando vira o dia / a semana / o mês
export function atualizarMissoes() {
  const M = S.missoes ||= {}; let mudou = false;
  if (M.dia !== hoje()) { M.dia = hoje(); M.diarias = sortear(3, 'dia', M.dia + (S.online?.id || '')); mudou = true; }
  if (M.semana !== semana()) { M.semana = semana(); M.semanais = sortear(3, 'sem', 's' + M.semana + (S.online?.id || '')); mudou = true; }
  const P = S.passe ||= {}; if (P.temp !== temporada()) { P.temp = temporada(); P.pts = 0; P.pegos = []; mudou = true; }
  if (mudou) salvar();
}
export function evento(tipo, n = 1) {
  if (!n) return; atualizarMissoes();
  for (const m of [...S.missoes.diarias, ...S.missoes.semanais]) if (m.t === tipo && !m.pego) m.prog = Math.min(m.meta, m.prog + n);
  salvar();
}
export const prontas = () => { atualizarMissoes(); return [...S.missoes.diarias, ...S.missoes.semanais].filter(m => !m.pego && m.prog >= m.meta).length + niveisProntos().length; };
export function pegarMissao(semanal, i) {
  const m = (semanal ? S.missoes.semanais : S.missoes.diarias)[i]; if (!m || m.pego || m.prog < m.meta) return null;
  m.pego = true; const pts = semanal ? PTS_SEM : PTS_DIA, moedas = semanal ? 300 + 40 * S.fase : 60 + 10 * S.fase;
  S.passe.pts += pts; S.moedas += moedas; if (semanal) S.ovos.comum++;
  salvar(); return { pts, moedas, ovo: semanal };
}
// ---- passe: prêmio de cada nível ----
export function premioNivel(n) {
  if (n % 10 === 0) return { ovo: 'magico' };
  if (n % 5 === 0) return { bau: n % 15 === 0 ? 'ouro' : 'prata' };
  if (n % 3 === 0) return { ovo: 'comum' };
  return { moedas: Math.round((80 + 20 * n) * (1 + S.fase / 20)) };
}
export const nivelPasse = () => Math.min(NIVEIS_PASSE, Math.floor((S.passe?.pts || 0) / PTS_NIVEL));
export const niveisProntos = () => Array.from({ length: nivelPasse() }, (_, i) => i + 1).filter(n => !S.passe.pegos.includes(n));
export function pegarNivel(n) {
  if (n > nivelPasse() || S.passe.pegos.includes(n)) return null;
  const p = premioNivel(n);
  if (p.bau && !ganharBau(S.fase)) return { cheio: true };
  if (p.bau) { const b = S.baus[S.baus.length - 1]; b.tipo = p.bau; }
  if (p.ovo) S.ovos[p.ovo]++; if (p.moedas) S.moedas += p.moedas;
  S.passe.pegos.push(n); salvar(); return p;
}
export function fimTemporada() { const d = new Date(), f = new Date(d.getFullYear(), d.getMonth() + 1, 1); return Math.ceil((f - d) / 864e5); }
