// Nível do herói: XP de todos os modos (o que junta tudo). Cada nível dá moedas e estrelas dos Desejos.
import { S, salvar } from './meta.js';
import * as EQ from './equip.js';
import { ico } from './util.js';
import { t as tr } from './i18n.js';
let ultimo = null; // resultado da última partida (para a tela de fim)

export const xpPara = n => Math.round(100 * 1.18 ** (n - 1));
export function nivelInfo() { let n = 1, x = S.xp || 0; while (x >= xpPara(n)) { x -= xpPara(n); n++; } return { n, x, prox: xpPara(n) }; }
// XP por modo (valor = fase, onda, chefes ou estágio)
const XP = { fase: (v, ok) => ok ? 40 + v * 3 : 15, dupla: (v, ok) => ok ? 50 + v * 3 : 20, infinito: v => 20 + v * 8, castelo: v => 10 + v * 6, arvore: v => 10 + v * 8, defesa: v => 10 + v * 7, conquista: (v, ok) => ok ? 40 : 15 };
// estrelas dos Desejos também fora dos modos em grupo (Árvore e Defesa já dão as suas)
const ESTRELAS = { fase: (v, ok) => ok && v % 5 === 0 ? 1 : 0, dupla: (v, ok) => ok ? 1 : 0, infinito: v => Math.floor(v / 3), castelo: v => Math.floor(v / 4), conquista: (v, ok) => ok ? 1 : 0 };
export const premioNivel = n => ({ moedas: 100 * n, est: n % 5 === 0 ? 3 : 1 });
export function xpDireto(xp) { // missões dão XP também
  const antes = nivelInfo().n; S.xp = (S.xp || 0) + xp; const depois = nivelInfo().n;
  for (let n = antes + 1; n <= depois; n++) { const P = premioNivel(n); S.moedas += P.moedas; EQ.ganharEstrelas(P.est); (S.nivelNovo ||= []).push(n); } salvar();
}
export function ganhar(modo, valor, venceu) {
  const f = XP[modo]; if (!f) return null; const antes = nivelInfo().n, xp = Math.round(f(valor || 0, !!venceu)); S.xp = (S.xp || 0) + xp;
  const est = ESTRELAS[modo]?.(valor || 0, !!venceu) || 0; if (est) EQ.ganharEstrelas(est);
  const depois = nivelInfo().n; for (let n = antes + 1; n <= depois; n++) { const P = premioNivel(n); S.moedas += P.moedas; EQ.ganharEstrelas(P.est); (S.nivelNovo ||= []).push(n); }
  salvar(); ultimo = { xp, est, nivel: depois, subiu: depois > antes }; return ultimo;
}
// bloco da tela de fim (o mesmo em todos os modos): XP ganho, barra do nível e estrelas
export function htmlUltimo() {
  if (!ultimo) return ''; const N = nivelInfo(), r = ultimo; ultimo = null;
  return `<div class="fimXp"><span>${ico('coroa')} ${tr('Nível')} <b>${N.n}</b>${r.subiu ? ` <em>${tr('SUBIU!')}</em>` : ''}</span><div class="barra"><i style="width:${Math.round(100 * N.x / N.prox)}%"></i></div><small>+${r.xp} XP${r.est ? ` · ${ico('estrela')} +${r.est}` : ''}</small></div>`;
}
