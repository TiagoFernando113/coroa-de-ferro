// Loot e equipamento do herói: 5 espaços, 5 raridades, atributos aleatórios.
// A arma e o elmo aparecem no boneco (mudam a arma na mão e o chapéu).
import { ARMAS } from './aparencia.js';

export const RARIDADE_ITEM = [
  { nome: 'Comum', cor: '#b8bcc4', mult: 1 }, { nome: 'Incomum', cor: '#5fd84a', mult: 1.35 }, { nome: 'Raro', cor: '#3aa0ff', mult: 1.8 },
  { nome: 'Épico', cor: '#b36bff', mult: 2.5 }, { nome: 'Lendário', cor: '#ff9a1a', mult: 3.6 },
];
export const ESPACOS = { arma: { nome: 'Arma', icone: 'c_armas' }, elmo: { nome: 'Elmo', icone: 'escudo' }, armadura: { nome: 'Armadura', icone: 'c_roupa' },
  amuleto: { nome: 'Amuleto', icone: 'estrela' }, anel: { nome: 'Anel', icone: 'gema' } };
export const ATR_ITEM = { atk: ['Ataque', '%'], vida: ['Vida', ''], crit: ['Crítico', '%'], def: ['Defesa', '%'], vel: ['Velocidade', '%'] };
const SUFIXOS = [['', 'Velho', 'de Ferro'], ['de Aço', 'do Caçador', 'Afiado'], ['Rúnico', 'do Lobo', 'Élfico'], ['Flamejante', 'do Dragão', 'Sombrio'], ['do Rei Esqueleto', 'Celestial', 'do Monarca']];
const ELMOS = [['elmo', 'Elmo'], ['viseira', 'Elmo com viseira'], ['urso', 'Pele de urso'], ['mago', 'Chapéu de mago']];
const ARMADURAS = ['Gibão', 'Cota de malha', 'Couraça', 'Armadura de placas', 'Manto encantado'];
const AMULETOS = ['Amuleto', 'Talismã', 'Pingente', 'Relíquia', 'Coração de dragão'];
const ANEIS = ['Anel', 'Anel de prata', 'Anel rúnico', 'Anel do vazio', 'Anel do monarca'];
const sorte = l => l[Math.floor(Math.random() * l.length)];
let seq = 1;

// sorteia a raridade: sorte extra de 0 (comum) a 1 (chefe/emboscada rara)
export function sortearRaridade(bonus = 0) {
  const x = Math.random() * (1 - bonus * 0.6);
  return x < 0.012 ? 4 : x < 0.06 ? 3 : x < 0.2 ? 2 : x < 0.48 ? 1 : 0;
}
export function gerarItem(nivel, rar = sortearRaridade(), slot = sorte(Object.keys(ESPACOS))) {
  const R = RARIDADE_ITEM[rar], base = (4 + nivel * 1.6) * R.mult, id = Date.now().toString(36) + (seq++).toString(36);
  const it = { id, slot, rar, nivel, st: {} };
  const extra = () => { const k = sorte(['crit', 'def', 'vel', 'atk', 'vida']); it.st[k] = (it.st[k] || 0) + (k === 'vida' ? Math.round(base * 1) : Math.round(base * 0.35 + 1)); };
  if (slot === 'arma') { const a = sorte(ARMAS.filter(x => x.id)); it.visual = a.id; it.nome = `${a.nome} ${sorte(SUFIXOS[rar])}`.trim(); it.st.atk = Math.round(base * 1.4 + 3); }
  if (slot === 'elmo') { const [v, n] = sorte(ELMOS); it.visual = v; it.nome = `${n} ${sorte(SUFIXOS[rar])}`.trim(); it.st.vida = Math.round(base * 1.5); it.st.def = Math.round(base * 0.3 + 1); }
  if (slot === 'armadura') { it.nome = `${ARMADURAS[Math.min(4, rar + (Math.random() < 0.3 ? 1 : 0))]} ${sorte(SUFIXOS[rar])}`.trim(); it.st.vida = Math.round(base * 2.5); it.st.def = Math.round(base * 0.5 + 2); }
  if (slot === 'amuleto') { it.nome = `${AMULETOS[rar]} ${sorte(SUFIXOS[rar])}`.trim(); it.st.crit = Math.round(base * 0.4 + 2); }
  if (slot === 'anel') { it.nome = `${ANEIS[rar]} ${sorte(SUFIXOS[rar])}`.trim(); it.st.atk = Math.round(base * 0.6 + 1); }
  for (let i = 0; i < rar; i++) extra(); // raridades altas têm mais atributos
  it.poder = poderItem(it);
  return it;
}
export const poderItem = it => Math.round((it.st.atk || 0) * 3 + (it.st.vida || 0) * 0.25 + (it.st.crit || 0) * 3 + (it.st.def || 0) * 3 + (it.st.vel || 0) * 2.5);
export const precoItem = it => Math.round((20 + it.nivel * 12) * RARIDADE_ITEM[it.rar].mult ** 2);
// soma dos atributos do que está equipado
export function atributosEquip(equip) {
  const t = { atk: 0, vida: 0, crit: 0, def: 0, vel: 0 };
  for (const it of Object.values(equip || {})) if (it) for (const [k, v] of Object.entries(it.st)) t[k] += v;
  return t;
}
export const textoAtr = (k, v) => `+${v}${ATR_ITEM[k][1]} ${ATR_ITEM[k][0]}`;
