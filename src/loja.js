// Loja diária: 4 ofertas que mudam todo dia (compradas com moedas, uma vez cada).
import { S, salvar, ganharBau, darCartas, CARTAS } from './meta.js';
import { PETS } from './pets.js';
const hoje = () => new Date().toLocaleDateString('sv');
export function ofertas() {
  const d = hoje(); let sd = [...d].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 11) >>> 0 || 1; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const f = Math.max(1, S.fase), cartaK = CARTAS.filter(k => S.pd[k]?.nv > 0)[Math.floor(r() * 5) % Math.max(1, CARTAS.filter(k => S.pd[k]?.nv > 0).length)] || 'chuva';
  const comuns = Object.keys(PETS).filter(k => PETS[k].r === 0), raros = Object.keys(PETS).filter(k => PETS[k].r === 1);
  return [
    { tipo: 'ovo', ovo: 'comum', preco: 240, desconto: 20 },
    { tipo: 'cartas', carta: cartaK, n: 6, preco: Math.round(80 + 18 * f) },
    r() < 0.3 ? { tipo: 'pet', pet: raros[Math.floor(r() * raros.length)], preco: 1100 } : { tipo: 'pet', pet: comuns[Math.floor(r() * comuns.length)], preco: 380 },
    r() < 0.15 ? { tipo: 'ovo', ovo: 'magico', preco: 1200, desconto: 20 } : { tipo: 'bau', bau: 'prata', preco: Math.round(150 + 25 * f) },
  ];
}
export function lojaDia() { if (S.loja?.dia !== hoje()) { S.loja = { dia: hoje(), comprados: [] }; salvar(); } return S.loja; }
export function comprarOferta(i) {
  const L = lojaDia(), o = ofertas()[i]; if (!o || L.comprados.includes(i) || S.moedas < o.preco) return null;
  if (o.tipo === 'bau' && !ganharBau(S.fase)) return { cheio: true };
  if (o.tipo === 'bau') S.baus[S.baus.length - 1].tipo = o.bau;
  S.moedas -= o.preco;
  if (o.tipo === 'ovo') S.ovos[o.ovo]++;
  if (o.tipo === 'cartas') darCartas(o.carta, o.n);
  if (o.tipo === 'pet') { const P = S.pets[o.pet] ||= { e: [0, 0, 0, 0, 0, 0], nv: 1 }; P.e[0]++; }
  L.comprados.push(i); salvar(); return o;
}
export const temOferta = () => { const L = lojaDia(); return ofertas().some((o, i) => !L.comprados.includes(i) && S.moedas >= o.preco); };
