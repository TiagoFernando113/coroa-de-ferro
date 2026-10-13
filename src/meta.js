// Save da Batalha da Ponte: fase atual, moedas, melhorias, baús, cartas de poder e presente diário.
import { UPGRADES } from './dados.js';
const CHAVE = 'ponte_v1';
export let S = null;
// fim de semana dourado (sábado e domingo): moedas x2 e ovos com mais sorte
export const fimDeSemana = () => [0, 6].includes(new Date().getDay());
export function carregar() {
  try { S = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { S = null; }
  if (!S || S.v !== 1) S = { v: 1, fase: 1, moedas: 0, up: {}, melhor: 0 };
  for (const k of Object.keys(UPGRADES)) S.up[k] = S.up[k] || 0;
  S.baus = S.baus || []; S.diario = S.diario || { ultimo: '', seq: 0 };
  S.pd = S.pd || {}; for (const k of CARTAS) S.pd[k] = S.pd[k] || { nv: k === 'lanca' || k === 'mago' ? 0 : 1, c: 0 };
  S.deck = S.deck || ['arco'];
  S.heroi = S.heroi || 'lyra'; S.herois = S.herois || ['lyra'];
  return S;
}
let sujo = false; // mudou desde o último backup na nuvem
export const mudouDesdeBackup = () => sujo;
export const backupFeito = () => { sujo = false; };
export function salvar() { sujo = true; try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch (e) {} }
export function comprar(k) {
  const U = UPGRADES[k], n = S.up[k]; if (n >= U.max) return false;
  const c = U.custo(n); if (S.moedas < c) return false;
  S.moedas -= c; S.up[k]++; salvar(); return true;
}
// ---- cartas de poder: juntar cartas sobe o nível ----
// poderes (chuva, gigante) e tropas (arco, lanca, mago); tropa com nível 0 está bloqueada até a primeira carta
export const CARTAS = ['chuva', 'gigante', 'arco', 'lanca', 'mago'];
export const cartasPara = nv => 3 + nv * 2;
export function darCartas(k, n) {
  const P = S.pd[k], antes = P.nv; if (!n) return false;
  if (P.nv === 0) { P.nv = 1; n--; }
  P.c += n;
  while (P.nv < 10 && P.c >= cartasPara(P.nv)) { P.c -= cartasPara(P.nv); P.nv++; }
  return P.nv > antes;
}
// ---- baús ----
export const MAX_BAUS = 4;
export const BAUS = {
  madeira: { nome: 'Baú de Madeira', moedas: 1, cartas: 2 },
  prata: { nome: 'Baú de Prata', moedas: 3, cartas: 6 },
  ouro: { nome: 'Baú de Ouro', moedas: 8, cartas: 15 },
};
export function ganharBau(n) {
  if (S.baus.length >= MAX_BAUS) return null;
  const r = Math.random(), tipo = n % 5 === 0 ? 'ouro' : r < 0.07 ? 'ouro' : r < 0.32 ? 'prata' : 'madeira';
  S.baus.push({ tipo, fase: n }); salvar(); return tipo;
}
// abre o baú i e devolve o que veio
function premio(tipo, fase) {
  const B = BAUS[tipo], total = B.cartas, moedas = Math.round((25 + 10 * fase) * B.moedas * (0.85 + Math.random() * 0.3));
  // as cartas se dividem entre 2 ou 3 tipos sorteados
  const tipos = [...CARTAS].sort(() => Math.random() - 0.5).slice(0, total >= 6 ? 3 : 2), cartas = {}, sobe = {};
  let resto = total; tipos.forEach((k, i) => { const n = i === tipos.length - 1 ? resto : Math.max(1, Math.round(resto * (0.35 + Math.random() * 0.3))); cartas[k] = n; resto -= n; });
  S.moedas += moedas; for (const k of tipos) sobe[k] = darCartas(k, cartas[k]);
  return { tipo, moedas, cartas, sobe };
}
export function abrirBau(i) {
  const b = S.baus[i]; if (!b) return null;
  const p = premio(b.tipo, b.fase); S.baus.splice(i, 1); salvar(); return p;
}
// ---- presente diário (7 dias; perder um dia volta ao começo) ----
export const DIARIO = [{ moedas: 1 }, { moedas: 1.5 }, { bau: 'madeira' }, { moedas: 2.5 }, { bau: 'prata' }, { moedas: 4 }, { bau: 'ouro' }];
const hoje = () => new Date().toLocaleDateString('sv');
const ontem = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('sv'); };
export const diarioPronto = () => S.diario.ultimo !== hoje();
export function diaDoPresente() { return S.diario.ultimo === ontem() || S.diario.ultimo === hoje() ? S.diario.seq % 7 : 0; }
export function pegarDiario() {
  if (!diarioPronto()) return null;
  const dia = diaDoPresente(), D = DIARIO[dia]; S.diario = { ultimo: hoje(), seq: dia + 1 };
  let p;
  if (D.bau) p = premio(D.bau, Math.max(1, S.fase));
  else { const m = Math.round((40 + 12 * S.fase) * D.moedas); S.moedas += m; p = { moedas: m, cartas: {}, sobe: {} }; }
  salvar(); return { dia, ...p };
}
