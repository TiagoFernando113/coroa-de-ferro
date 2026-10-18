// Equipamentos (estilo RPG): arma, armadura, anel e amuleto com raridade, atributos e nível.
// Caem no fim da Árvore Sagrada e da Defesa em Grupo e deixam o herói mais forte nesses modos.
import { S, salvar } from './meta.js';
import { fmt } from './dados.js';
import { som, $ } from './util.js';
import { sfx } from './musica.js';
import { t as tr } from './i18n.js';

export const SLOTS = {
  arma: { nome: 'Arma', ic: '⚔️', nomes: ['Lâmina', 'Machado', 'Arco', 'Cajado', 'Martelo', 'Lança'], st: { dano: 8, cad: 4 } },
  armadura: { nome: 'Armadura', ic: '🛡️', nomes: ['Couraça', 'Cota de Malha', 'Manto', 'Peitoral', 'Armadura'], st: { vida: 15, def: 3 } },
  anel: { nome: 'Anel', ic: '💍', nomes: ['Anel', 'Aliança', 'Selo'], st: { crit: 3, roubo: 1 } },
  amuleto: { nome: 'Amuleto', ic: '📿', nomes: ['Amuleto', 'Talismã', 'Pingente', 'Relíquia'], st: { recarga: 5, cura: 0.5 } },
};
export const RARIDADES = [
  { nome: 'Comum', cor: '#a8a8a8', m: 1, adj: ['Velho', 'Velha'] }, { nome: 'Incomum', cor: '#4ac85a', m: 1.5, adj: ['Afiado', 'Afiada'] }, { nome: 'Raro', cor: '#3a8aff', m: 2.2, adj: ['Rúnico', 'Rúnica'] },
  { nome: 'Épico', cor: '#b04aff', m: 3.2, adj: ['Sombrio', 'Sombria'] }, { nome: 'Lendário', cor: '#ff9a1a', m: 4.5, adj: ['Dourado', 'Dourada'] }, { nome: 'Mítico', cor: '#ff3a4a', m: 6.5, adj: ['Celestial', 'Celestial'] },
];
// armas únicas (aparecem a partir de Épico): cada uma tem um efeito especial e aparece na mão do herói
export const LENDAS = {
  fenda: { nome: 'Rasgadora do Vazio', r: 5, modelo: 'W:sword_E', cor: 0xb04aff, desc: 'a cada 6 golpes abre uma fenda que explode em área' },
  celeste: { nome: 'Lâmina Celestial', r: 5, modelo: 'W:sword_D', cor: 0xffe27a, desc: 'golpes seguidos aumentam o dano (até +50%)' },
  trovao: { nome: 'Martelo do Trovão', r: 4, modelo: 'W:hammer_C', cor: 0x7ac8ff, desc: '25% de chance de um raio pular em 3 inimigos' },
  solar: { nome: 'Arco Solar', r: 4, modelo: 'W:bow_B_withString', cor: 0xff9a1a, desc: 'incendeia o alvo por 3 segundos' },
  glacial: { nome: 'Cajado Glacial', r: 4, modelo: 'W:staff_B', cor: 0x9ae8ff, desc: 'deixa lento e às vezes congela' },
  sangue: { nome: 'Foice Sangrenta', r: 3, modelo: 'W:axe_C', cor: 0xff3a4a, desc: 'cura 5% de todo dano causado' },
  vulcao: { nome: 'Machado Vulcânico', r: 3, modelo: 'W:axe_B', cor: 0xff5a1a, desc: '20% de chance de explodir em área' },
  sombra: { nome: 'Adagas da Sombra', r: 3, modelo: 'W:dagger_B', cor: 0x9a5ae8, desc: '15% de chance de golpe triplo' },
};
const MODELO_ARMA = { 'Lâmina': 'W:sword_A', 'Machado': 'W:axe_A', 'Arco': 'W:bow_A_withString', 'Cajado': 'W:staff_A', 'Martelo': 'W:hammer_A', 'Lança': 'W:spear_A' };
export function armaEquipada() { const E = eq(), it = E.itens.find(x => x.id === E.usando.arma); return it || null; }
export function visualCom(v, modelo) { if (!modelo) return v; return { ...v, arma: modelo, esq: /bow/.test(modelo) ? '' : v.esq }; }
export const tipoGolpe = modelo => !modelo ? null : /bow/.test(modelo) ? 'arco' : /staff|wand/.test(modelo) ? 'cajado' : /hammer/.test(modelo) ? 'martelo' : 'corte';
const ST = { dano: ['Dano', '%'], cad: ['Velocidade de ataque', '%'], vida: ['Vida', ''], def: ['Defesa', '%'], crit: ['Crítico', '%'], roubo: ['Roubo de vida', '%'], recarga: ['Recarga do poder', '%'], cura: ['Cura', '/s'] };
const MAX_NV = 10, MAX_MOCHILA = 40;
const eq = () => (S.equip ||= { itens: [], usando: {}, id: 1 });
export const valor = (it, k) => (it.st[k] || 0) * (1 + 0.1 * (it.nv - 1));

// novo item: quanto mais longe foi a partida, mais chance de raridade alta
export function gerarItem(onda) {
  const E = eq(), slots = Object.keys(SLOTS), slot = slots[Math.floor(Math.random() * slots.length)], sorte = onda / 3 + Math.random() * 4 + Math.random() * Math.random() * 6;
  const r = sorte > 11 ? 5 : sorte > 8.5 ? 4 : sorte > 6.2 ? 3 : sorte > 4.2 ? 2 : sorte > 2.4 ? 1 : 0, R = RARIDADES[r], D = SLOTS[slot], st = {};
  for (const [k, v] of Object.entries(D.st)) st[k] = Math.round(v * R.m * (0.8 + Math.random() * 0.4) * 10) / 10;
  const nm = D.nomes[Math.floor(Math.random() * D.nomes.length)], fem = /^(Lâmina|Couraça|Cota|Armadura|Lança|Aliança|Relíquia)/.test(nm);
  const it = { id: E.id++, slot, r, nv: 1, st, nome: `${nm} ${R.adj[fem ? 1 : 0]}` };
  if (slot === 'arma') { it.modelo = MODELO_ARMA[nm];
    const ls = Object.entries(LENDAS).filter(([, L]) => L.r <= r); if (r >= 3 && ls.length && Math.random() < 0.5) { const [k, L] = ls[Math.floor(Math.random() * ls.length)]; Object.assign(it, { lenda: k, nome: L.nome, modelo: L.modelo }); } }
  E.itens.push(it); if (E.itens.length > MAX_MOCHILA) { const pior = E.itens.filter(x => !Object.values(E.usando).includes(x.id)).sort((a, b) => a.r - b.r || poderItem(a) - poderItem(b))[0]; if (pior) E.itens.splice(E.itens.indexOf(pior), 1); }
  if (!E.usando[slot] || poderItem(it) > poderItem(E.itens.find(x => x.id === E.usando[slot]) || { st: {}, nv: 1, r: 0 })) E.usando[slot] = it.id; // equipa sozinho se for melhor
  salvar(); return it;
}
export function poderItem(it) { let p = 0; for (const k of Object.keys(it.st)) p += valor(it, k) * ({ vida: 2, cura: 40, def: 8, crit: 8, roubo: 15 }[k] || 6); return Math.round(p * (it.lenda ? 1.35 : 1)); }
// soma dos atributos do que está equipado
export function atributos() {
  const E = eq(), a = { dano: 0, cad: 0, vida: 0, def: 0, crit: 0, roubo: 0, recarga: 0, cura: 0 };
  for (const id of Object.values(E.usando)) { const it = E.itens.find(x => x.id === id); if (it) for (const k of Object.keys(it.st)) a[k] += valor(it, k); }
  a.def = Math.min(60, a.def); a.crit = Math.min(60, a.crit); a.recarga = Math.min(60, a.recarga); return a;
}
export function poder() { const E = eq(); let p = 0; for (const id of Object.values(E.usando)) { const it = E.itens.find(x => x.id === id); if (it) p += poderItem(it); } return p; }
export function melhorRaridade() { const E = eq(); let m = -1; for (const id of Object.values(E.usando)) { const it = E.itens.find(x => x.id === id); if (it) m = Math.max(m, it.r); } return m; }
const custoUp = it => Math.round(80 * it.nv * (1 + it.r) * (1 + it.r * 0.5));
const valorDesmontar = it => Math.round(20 * (1 + it.r) ** 2 * it.nv);

// ---- tela da mochila ----
export const itemHtml = (it, cls = '') => `<button class="eqItem r${it.r} ${cls} ${it.lenda ? 'lenda' : ''}" data-eq="ver" data-id="${it.id}" style="--r:${RARIDADES[it.r].cor}"><i>${SLOTS[it.slot].ic}</i><em>${it.nv > 1 ? '+' + (it.nv - 1) : ''}</em>${it.lenda ? '<u>✨</u>' : ''}</button>`;
const linhaSt = (it, k) => { const [n, u] = ST[k]; return `<span>${tr(n)} <b>+${fmt(Math.round(valor(it, k) * 10) / 10)}${u}</b></span>`; };
export function mostrar(sel = null) {
  const E = eq(), j = $('#janela'); j.hidden = false; const usando = new Set(Object.values(E.usando)), A = atributos();
  const it = sel != null && E.itens.find(x => x.id === sel);
  const det = it ? (() => { const R = RARIDADES[it.r], eq1 = usando.has(it.id), c = custoUp(it);
    return `<div class="eqDet" style="--r:${R.cor}"><div class="eqDetT">${SLOTS[it.slot].ic}<span><b>${it.nome}${it.nv > 1 ? ` +${it.nv - 1}` : ''}</b><small>${tr(R.nome)} · ${tr(SLOTS[it.slot].nome)} · ${tr('Poder')} ${fmt(poderItem(it))}</small></span></div>
      <div class="eqSt">${Object.keys(it.st).map(k => linhaSt(it, k)).join('')}</div>${it.lenda ? `<p class="eqLenda">✨ ${tr(LENDAS[it.lenda].desc)}</p>` : ''}
      <div class="eqBts">${eq1 ? `<button class="btn cinza peq" disabled>${tr('Equipado')}</button>` : `<button class="btn verde peq" data-eq="usar" data-id="${it.id}">${tr('Equipar')}</button>`}
        ${it.nv < MAX_NV ? `<button class="btn amarelo peq" data-eq="up" data-id="${it.id}" ${S.moedas < c ? 'disabled' : ''}>⬆️ ${fmt(c)}</button>` : `<small>MAX</small>`}
        ${eq1 ? '' : `<button class="btn vermelho peq" data-eq="des" data-id="${it.id}">${tr('Desmontar')} +${fmt(valorDesmontar(it))}</button>`}</div></div>`; })() : '';
  j.innerHTML = `<div class="jOnline eqTela"><h2>🎒 ${tr('Equipamentos')}</h2><p class="eqPoder">${tr('Poder')} <b>${fmt(poder())}</b> · <small>${tr('vale na Árvore Sagrada e na Defesa em Grupo')}</small></p>
    <div class="eqSlots">${Object.entries(SLOTS).map(([k, D]) => { const x = E.itens.find(i => i.id === E.usando[k]); return `<div class="eqSlot"><small>${tr(D.nome)}</small>${x ? itemHtml(x, sel === x.id ? 'sel' : '') : `<span class="eqVazio">${D.ic}</span>`}</div>`; }).join('')}</div>
    <div class="eqTot">${Object.entries(A).filter(([, v]) => v).map(([k, v]) => `<span>${tr(ST[k][0])} +${fmt(Math.round(v * 10) / 10)}${ST[k][1]}</span>`).join('') || `<span>${tr('Jogue a Árvore Sagrada para ganhar equipamentos!')}</span>`}</div>
    ${det}<h3>${tr('Mochila')} <small>${E.itens.length}/${MAX_MOCHILA}</small></h3>
    <div class="eqMochila">${[...E.itens].sort((a, b) => b.r - a.r || poderItem(b) - poderItem(a)).map(x => itemHtml(x, `${usando.has(x.id) ? 'usando' : ''} ${sel === x.id ? 'sel' : ''}`)).join('') || `<p>${tr('Vazia')}</p>`}</div>
    <button class="btn verde grande" data-a="fecharJanela">OK</button></div>`;
}
export function clique(b) {
  const a = b.dataset.eq, id = +b.dataset.id, E = eq(), it = E.itens.find(x => x.id === id);
  if (a === 'abrir') { som('abrir'); mostrar(); return true; }
  if (a === 'ver') { som('clique'); mostrar(id); return true; }
  if (!it) return false;
  if (a === 'usar') { E.usando[it.slot] = it.id; salvar(); sfx('brilho'); mostrar(id); return true; }
  if (a === 'up') { const c = custoUp(it); if (S.moedas < c || it.nv >= MAX_NV) { som('erro'); return true; } S.moedas -= c; it.nv++; salvar(); som('compra'); sfx('vitoria'); mostrar(id); return true; }
  if (a === 'des') { if (Object.values(E.usando).includes(it.id)) return true; S.moedas += valorDesmontar(it); E.itens.splice(E.itens.indexOf(it), 1); salvar(); som('moedas'); mostrar(); return true; }
  return false;
}
