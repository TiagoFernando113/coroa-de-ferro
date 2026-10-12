// Save da Batalha da Ponte: fase atual, moedas e melhorias.
import { UPGRADES } from './dados.js';
const CHAVE = 'ponte_v1';
export let S = null;
export function carregar() {
  try { S = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { S = null; }
  if (!S || S.v !== 1) S = { v: 1, fase: 1, moedas: 0, up: {}, melhor: 0 };
  for (const k of Object.keys(UPGRADES)) S.up[k] = S.up[k] || 0;
  return S;
}
export function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch (e) {} }
export function comprar(k) {
  const U = UPGRADES[k], n = S.up[k]; if (n >= U.max) return false;
  const c = U.custo(n); if (S.moedas < c) return false;
  S.moedas -= c; S.up[k]++; salvar(); return true;
}
