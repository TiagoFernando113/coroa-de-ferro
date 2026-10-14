// Perfil: estatísticas da conta e medalhas (bronze, prata e ouro) com prêmio em cada nível.
import { S, salvar } from './meta.js';
import { PETS, est } from './pets.js';
export const NIVEIS_MEDALHA = [['Bronze', '#cd7f32'], ['Prata', '#c0c8d0'], ['Ouro', '#ffd23a']];
const maxEstrela = () => Math.max(0, ...Object.values(S.pets || {}).map(P => P.e.reduce((m, n, i) => n > 0 ? i : m, 0)));
export const MEDALHAS = {
  orcs: { nome: 'Matador de orcs', icone: 'caveira', metas: [1000, 10000, 100000], valor: () => S.est?.orcs || 0 },
  chefes: { nome: 'Caçador de chefes', icone: 'chefe', metas: [10, 50, 200], valor: () => S.est?.chefes || 0 },
  fase: { nome: 'Defensor da ponte', icone: 'escudo', metas: [10, 25, 50], valor: () => Math.max(S.melhor || 0, (S.fase || 1) - 1) },
  colecao: { nome: 'Colecionador', icone: 'pata', metas: [5, 10, Object.keys(PETS).length], valor: () => Object.keys(S.pets || {}).length },
  ovos: { nome: 'Chocador', icone: 'ovo', metas: [10, 50, 200], valor: () => S.est?.ovos || 0 },
  estrela: { nome: 'Estrelado', icone: 'estrela', metas: [1, 3, 5], valor: maxEstrela },
  conquista: { nome: 'Conquistador', icone: 'bandeira', metas: [10, 30, 60], valor: () => (S.cq?.est || 1) - 1 },
  castelo: { nome: 'Guardião do castelo', icone: 'h_muralha', metas: [10, 25, 50], valor: () => S.castelo?.rec || 0 },
  infinito: { nome: 'Ponte sem fim', icone: 'h_triplo', metas: [5000, 20000, 100000], valor: () => S.recInf || 0 },
  renascer: { nome: 'Renascido', icone: 'girar', metas: [1, 3, 10], valor: () => S.renasc || 0 },
};
// estatísticas que só existem aqui (o resto já está no save)
export function contar(tipo, n) { S.est ||= {}; S.est[tipo] = (S.est[tipo] || 0) + n; }
export const nivelMedalha = k => MEDALHAS[k].metas.filter(m => MEDALHAS[k].valor() >= m).length;
export const pegas = k => (S.medalhas ||= {})[k] || 0;
export const medalhasProntas = () => Object.keys(MEDALHAS).filter(k => nivelMedalha(k) > pegas(k)).length;
export const premioMedalha = nv => nv >= 3 ? { ovo: 'magico' } : nv === 2 ? { ovo: 'comum', moedas: 500 } : { moedas: 250 };
export function pegarMedalha(k) {
  const nv = pegas(k) + 1; if (nv > nivelMedalha(k)) return null;
  const p = premioMedalha(nv); S.medalhas[k] = nv; if (p.moedas) S.moedas += p.moedas; if (p.ovo) S.ovos[p.ovo]++; salvar(); return p;
}
