// Equipamentos (estilo RPG): arma, armadura, anel e amuleto com raridade, atributos e nível.
// Caem no fim da Árvore Sagrada e da Defesa em Grupo (ou saem dos baús da Forja) e deixam o herói mais forte nesses modos.
// Elmo, armadura e capa mudam a aparência do herói (com a cor da raridade); a arma aparece na mão.
import { S, salvar, fimDeSemana } from './meta.js';
import * as C from './cena.js';
import { heroiAtual } from './herois.js';
import { iconePixel, tipoDe } from './pixel.js';
import { fmt } from './dados.js';
import { som, $ } from './util.js';
import { sfx } from './musica.js';
import { t as tr } from './i18n.js';

// nomes: [nome, visual, gênero] (o visual vai para o herói)
export const SLOTS = {
  arma: { nome: 'Arma', ic: '⚔️', nomes: [['Espada', 'espada', 'f'], ['Lâmina', 'espada', 'f'], ['Machado', 'machado'], ['Arco', 'arco'], ['Cajado', 'cajado'], ['Martelo', 'martelo'], ['Lança', 'lanca', 'f'], ['Adaga', 'adaga', 'f'], ['Foice', 'foice', 'f']], st: { dano: 8, cad: 4 } },
  elmo: { nome: 'Elmo', ic: '⛑️', nomes: [['Elmo', 'elmo'], ['Elmo de Viseira', 'viseira'], ['Chapéu Arcano', 'mago'], ['Pele de Urso', 'urso', 'f'], ['Máscara do Ladrão', 'lenco', 'f']], st: { vida: 8, crit: 1.5 } },
  armadura: { nome: 'Armadura', ic: '🛡️', nomes: [['Armadura de Placas', 'Knight', 'f'], ['Couraça Bárbara', 'Barbarian', 'f'], ['Manto Arcano', 'Mage'], ['Traje de Patrulheiro', 'Ranger'], ['Traje Sombrio', 'Rogue']], st: { vida: 15, def: 3 } },
  capa: { nome: 'Capa', ic: '🧥', nomes: [['Capa Real', 'Knight', 'f'], ['Capa Arcana', 'Mage', 'f'], ['Capa do Patrulheiro', 'Ranger', 'f'], ['Capa Sombria', 'Rogue', 'f'], ['Capuz Errante', 'Rogue_Hooded']], st: { def: 2, recarga: 3 } },
  anel: { nome: 'Anel', ic: '💍', nomes: [['Anel'], ['Aliança', '', 'f'], ['Selo']], st: { crit: 3, roubo: 1 } },
  amuleto: { nome: 'Amuleto', ic: '📿', nomes: [['Amuleto'], ['Talismã'], ['Pingente'], ['Relíquia', '', 'f']], st: { recarga: 5, cura: 0.5 } },
};
export const RARIDADES = [
  { nome: 'Comum', cor: '#a8a8a8', m: 1, adj: ['Velho', 'Velha'] }, { nome: 'Incomum', cor: '#4ac85a', m: 1.5, adj: ['Afiado', 'Afiada'] }, { nome: 'Raro', cor: '#3a8aff', m: 2.2, adj: ['Rúnico', 'Rúnica'] },
  { nome: 'Épico', cor: '#b04aff', m: 3.2, adj: ['Sombrio', 'Sombria'] }, { nome: 'Lendário', cor: '#ff9a1a', m: 4.5, adj: ['Dourado', 'Dourada'] }, { nome: 'Mítico', cor: '#ff3a4a', m: 6.5, adj: ['Celestial', 'Celestial'] },
];
// armas únicas (aparecem a partir de Épico): cada uma tem um efeito especial e aparece na mão do herói
export const LENDAS = {
  fenda: { nome: 'Rasgadora do Vazio', r: 5, modelo: 'P:L:fenda', cor: 0xb04aff, desc: 'a cada 6 golpes abre uma fenda que explode em área' },
  celeste: { nome: 'Lâmina Celestial', r: 5, modelo: 'P:L:celeste', cor: 0xffe27a, desc: 'golpes seguidos aumentam o dano (até +50%)' },
  trovao: { nome: 'Martelo do Trovão', r: 4, modelo: 'P:L:trovao', cor: 0x7ac8ff, desc: '25% de chance de um raio pular em 3 inimigos' },
  solar: { nome: 'Arco Solar', r: 4, modelo: 'P:L:solar', cor: 0xff9a1a, desc: 'incendeia o alvo por 3 segundos' },
  glacial: { nome: 'Cajado Glacial', r: 4, modelo: 'P:L:glacial', cor: 0x9ae8ff, desc: 'deixa lento e às vezes congela' },
  sangue: { nome: 'Foice Sangrenta', r: 3, modelo: 'P:L:sangue', cor: 0xff3a4a, desc: 'cura 5% de todo dano causado' },
  vulcao: { nome: 'Machado Vulcânico', r: 3, modelo: 'P:L:vulcao', cor: 0xff5a1a, desc: '20% de chance de explodir em área' },
  sombra: { nome: 'Adagas da Sombra', r: 3, modelo: 'P:L:sombra', cor: 0x9a5ae8, desc: '15% de chance de golpe triplo' },
};
// aparência do herói com o que está equipado (comArma: só nos modos em grupo, onde o golpe muda junto)
export function visualHeroi(base, comArma = false) {
  const E = eq(), v = { ...base }, de = s => E.itens.find(x => x.id === E.usando[s]);
  const ar = de('armadura'); if (ar?.vis) { v.tro = v.bra = v.per = ar.vis; if (ar.r >= 1) v.tinta = RARIDADES[ar.r].cor; v.cores = {}; }
  const el = de('elmo'); if (el?.vis) { if (el.vis === 'lenco') v.mas = 'lenco'; else v.cha = el.vis; }
  const ca = de('capa'); if (ca?.vis) { v.capa = ca.vis; if (ca.r >= 4) v.aura = 'sim'; if (ca.r >= 5 && !v.asas) v.asas = 'anjo'; }
  const a = de('arma'); if (comArma && a?.modelo) return visualCom(v, a.modelo);
  return v;
}
export const assinatura = () => { const E = eq(); return Object.entries(E.usando).map(([s, id]) => { const it = E.itens.find(x => x.id === id); return it ? `${s}${it.vis || it.modelo || ''}${it.r}` : ''; }).join('|'); };
export function armaEquipada() { const E = eq(), it = E.itens.find(x => x.id === E.usando.arma); return it || null; }
export function visualCom(v, modelo) { if (!modelo) return v; return { ...v, arma: modelo, esq: tipoGolpe(modelo) === 'arco' || tipoGolpe(modelo) === 'martelo' ? '' : v.esq }; }
export const tipoGolpe = modelo => !modelo ? null : modelo.startsWith('P:') ? ({ arco: 'arco', cajado: 'cajado', martelo: 'martelo' }[tipoDe(modelo.slice(2))] || 'corte') : /bow/.test(modelo) ? 'arco' : /staff|wand/.test(modelo) ? 'cajado' : /hammer/.test(modelo) ? 'martelo' : 'corte';
const ST = { dano: ['Dano', '%'], cad: ['Velocidade de ataque', '%'], vida: ['Vida', ''], def: ['Defesa', '%'], crit: ['Crítico', '%'], roubo: ['Roubo de vida', '%'], recarga: ['Recarga do poder', '%'], cura: ['Cura', '/s'] };
const MAX_NV = 10, MAX_MOCHILA = 40;
const eq = () => (S.equip ||= { itens: [], usando: {}, id: 1 });
export const valor = (it, k) => (it.st[k] || 0) * (1 + 0.1 * (it.nv - 1));

// novo item: quanto mais longe foi a partida, mais chance de raridade alta
export function gerarItem(onda, minR = 0, maxR = 5, lk = null) { // lk: lenda garantida (Desejos)
  const E = eq(), slots = Object.keys(SLOTS), slot = lk ? 'arma' : slots[Math.floor(Math.random() * slots.length)], sorte = onda / 2.4 + Math.random() * 4 + Math.random() * Math.random() * 6;
  const r = Math.min(maxR, Math.max(minR, sorte > 11 ? 5 : sorte > 8.5 ? 4 : sorte > 6.2 ? 3 : sorte > 4.2 ? 2 : sorte > 2.4 ? 1 : 0)), R = RARIDADES[r], D = SLOTS[slot], st = {};
  for (const [k, v] of Object.entries(D.st)) st[k] = Math.round(v * R.m * (0.8 + Math.random() * 0.4) * 10) / 10;
  const [nm, vis, gen] = D.nomes[Math.floor(Math.random() * D.nomes.length)];
  const it = { id: E.id++, slot, r, nv: 1, st, nome: `${nm} ${R.adj[gen === 'f' ? 1 : 0]}` };
  if (vis && slot !== 'arma') it.vis = vis;
  if (slot === 'arma') { it.modelo = `P:${vis}:${r}`;
    const ls = Object.entries(LENDAS).filter(([, L]) => L.r <= r); if (lk || (r >= 3 && ls.length && Math.random() < 0.5)) { const [k, L] = lk ? [lk, LENDAS[lk]] : ls[Math.floor(Math.random() * ls.length)]; Object.assign(it, { lenda: k, nome: L.nome, modelo: L.modelo }); } }
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
export const BAUS = [{ nome: 'Baú de Ferro', preco: 400, min: 0, max: 2, ic: '📦' }, { nome: 'Baú Raro', preco: 1500, min: 2, max: 3, ic: '🎁' }, { nome: 'Baú Épico', preco: 5000, min: 3, max: 4, ic: '💜' }, { nome: 'Baú Lendário', preco: 15000, min: 4, max: 5, ic: '🌟' }];
// ---- Desejos: estrelas ganhas nas partidas (ou moedas), 1 grátis por dia, lenda da semana em destaque e garantia ----
export const PRECO_DESEJO = 600, PITY = 50;
const hoje = () => new Date().toISOString().slice(0, 10);
export const destaque = () => { const ks = Object.keys(LENDAS); return ks[Math.floor((Date.now() / 864e5 + 3) / 7) % ks.length]; };
export const estrelas = () => eq().est || 0;
export const estrelasPartida = ondas => ondas < 2 ? 0 : Math.max(1, Math.floor(ondas / 3)) * (fimDeSemana() ? 2 : 1);
export function ganharEstrelas(n) { if (n > 0) { const E = eq(); E.est = (E.est || 0) + n; salvar(); } }
function desejar() { // Mítico 1,5% (garantido em 50), Lendário+ garantido a cada 10
  const E = eq(), x = Math.random(); E.pity = (E.pity || 0) + 1; E.p4 = (E.p4 || 0) + 1;
  const r = E.pity >= PITY || x < 0.015 ? 5 : E.p4 >= 10 || x < 0.085 ? 4 : x < 0.265 ? 3 : x < 0.565 ? 2 : 1;
  if (r >= 4) E.p4 = 0; if (r === 5) E.pity = 0;
  const dk = destaque(); return gerarItem(0, r, r, r === 5 || (r >= LENDAS[dk].r && Math.random() < 0.25) ? dk : null);
}
function revelar(itens) {
  const j = $('#janela'), m = Math.max(...itens.map(i => i.r));
  j.innerHTML = `<div class="jOnline eqTela dsTela r${m}" style="--r:${RARIDADES[m].cor}"><h2>🌠 ${tr('Desejos')}</h2><div class="dsRev">${itens.map((it, i) => `<div class="dsCarta r${it.r}" style="--i:${i};--r:${RARIDADES[it.r].cor}">${itemHtml(it, 'novo')}<small>${tr(RARIDADES[it.r].nome)}</small></div>`).join('')}</div>
    ${m >= 4 ? `<p class="dsUau">✨ ${itens.filter(i => i.r >= 4).map(i => `<b style="color:${RARIDADES[i.r].cor}">${i.nome}</b>`).join(' · ')}</p>` : ''}<button class="btn verde grande" data-eq="abrir">OK</button></div>`;
  setTimeout(() => sfx(m >= 4 ? 'vitoria' : 'brilho'), itens.length * 180);
}
const custoUp = it => Math.round(80 * it.nv * (1 + it.r) * (1 + it.r * 0.5));
const valorDesmontar = it => Math.round(20 * (1 + it.r) ** 2 * it.nv);

// ---- tela da mochila ----
export const itemHtml = (it, cls = '') => `<button class="eqItem r${it.r} ${cls} ${it.lenda ? 'lenda' : ''}" data-eq="ver" data-id="${it.id}" style="--r:${RARIDADES[it.r].cor}">${it.modelo?.startsWith('P:') ? `<img src="${iconePixel(it.modelo.slice(2), 2)}" alt="">` : `<i>${SLOTS[it.slot].ic}</i>`}<em>${it.nv > 1 ? '+' + (it.nv - 1) : ''}</em>${it.lenda ? '<u>✨</u>' : ''}</button>`;
const linhaSt = (it, k) => { const [n, u] = ST[k]; return `<span>${tr(n)} <b>+${fmt(Math.round(valor(it, k) * 10) / 10)}${u}</b></span>`; };
export function mostrar(sel = null) {
  const E = eq(), j = $('#janela'); j.hidden = false; const usando = new Set(Object.values(E.usando)), A = atributos();
  const it = sel != null && E.itens.find(x => x.id === sel);
  const det = it ? (() => { const R = RARIDADES[it.r], eq1 = usando.has(it.id), c = custoUp(it);
    return `<div class="eqDet" style="--r:${R.cor}"><div class="eqDetT">${it.modelo?.startsWith('P:') ? `<img class="eqPx" src="${iconePixel(it.modelo.slice(2), 3)}" alt="">` : SLOTS[it.slot].ic}<span><b>${it.nome}${it.nv > 1 ? ` +${it.nv - 1}` : ''}</b><small>${tr(R.nome)} · ${tr(SLOTS[it.slot].nome)} · ${tr('Poder')} ${fmt(poderItem(it))}</small></span></div>
      <div class="eqSt">${Object.keys(it.st).map(k => linhaSt(it, k)).join('')}</div>${it.lenda ? `<p class="eqLenda">✨ ${tr(LENDAS[it.lenda].desc)}</p>` : ''}
      <div class="eqBts">${eq1 ? `<button class="btn cinza peq" disabled>${tr('Equipado')}</button>` : `<button class="btn verde peq" data-eq="usar" data-id="${it.id}">${tr('Equipar')}</button>`}
        ${it.nv < MAX_NV ? `<button class="btn amarelo peq" data-eq="up" data-id="${it.id}" ${S.moedas < c ? 'disabled' : ''}>⬆️ ${fmt(c)}</button>` : `<small>MAX</small>`}
        ${eq1 ? '' : `<button class="btn vermelho peq" data-eq="des" data-id="${it.id}">${tr('Desmontar')} +${fmt(valorDesmontar(it))}</button>`}</div></div>`; })() : '';
  let foto = ''; try { const q = C.quadrosAnim(visualHeroi(heroiAtual(S).visual, true), 'Idle_A', { n: 1, tam: 150, chave: 'eqv:' + S.heroi + assinatura() }); if (q?.q?.[0]) foto = q.q[0].toDataURL(); } catch (e) {}
  j.innerHTML = `<div class="jOnline eqTela"><h2>🎒 ${tr('Equipamentos')}</h2><p class="eqPoder">${tr('Poder')} <b>${fmt(poder())}</b> · <small>${tr('vale na Árvore Sagrada e na Defesa em Grupo')}</small></p>
    ${foto ? `<img class="eqFoto" src="${foto}" alt="">` : ''}
    <div class="eqSlots">${Object.entries(SLOTS).map(([k, D]) => { const x = E.itens.find(i => i.id === E.usando[k]); return `<div class="eqSlot"><small>${tr(D.nome)}</small>${x ? itemHtml(x, sel === x.id ? 'sel' : '') : `<span class="eqVazio">${D.ic}</span>`}</div>`; }).join('')}</div>
    <div class="eqTot">${Object.entries(A).filter(([, v]) => v).map(([k, v]) => `<span>${tr(ST[k][0])} +${fmt(Math.round(v * 10) / 10)}${ST[k][1]}</span>`).join('') || `<span>${tr('Jogue a Árvore Sagrada para ganhar equipamentos!')}</span>`}</div>
    ${det}${(() => { const dk = destaque(), L = LENDAS[dk], est = estrelas(), gratis = E.dia !== hoje(), cus = n => est >= n ? `⭐ ${n}` : `🪙 ${fmt(PRECO_DESEJO * n * (n >= 10 ? 0.9 : 1))}`, pode = n => est >= n || S.moedas >= PRECO_DESEJO * n * (n >= 10 ? 0.9 : 1);
      return `<h3>🌠 ${tr('Desejos')} <small>⭐ ${fmt(est)}${fimDeSemana() ? ` · ${tr('fim de semana: estrelas em dobro!')}` : ''}</small></h3>
      <div class="dsBanner" style="--r:${RARIDADES[5].cor}"><img src="${iconePixel(L.modelo.slice(2), 3)}" alt=""><div><small>${tr('Lenda da semana')}</small><b>${L.nome}</b><small>${tr(L.desc)}</small><small class="dsPity">${tr('Mítico garantido em')} <b>${PITY - (E.pity || 0)}</b> · ${tr('Lendário+ a cada 10')}</small></div></div>
      <div class="dsBts">${gratis ? `<button class="btn verde" data-eq="dj" data-n="0">🎁 ${tr('Grátis hoje')}</button>` : ''}<button class="btn azul" data-eq="dj" data-n="1" ${pode(1) ? '' : 'disabled'}>1x · ${cus(1)}</button><button class="btn roxo" data-eq="dj" data-n="10" ${pode(10) ? '' : 'disabled'}>10x · ${cus(10)}</button></div>
      <p class="eqDica">${tr('Ganhe estrelas ⭐ na Árvore Sagrada e na Defesa em Grupo')}</p>`; })()}
    <h3>🔨 ${tr('Forja')} <small>${tr('baús com raridade garantida')}</small></h3>
    <div class="eqForja">${BAUS.map((B, i) => `<button class="eqBau" data-eq="bau" data-n="${i}" ${S.moedas < B.preco ? 'disabled' : ''} style="--r:${RARIDADES[B.min].cor}"><i>${B.ic}</i><b>${tr(B.nome)}</b><small>${tr(RARIDADES[B.min].nome)}+</small><em>🪙 ${fmt(B.preco)}</em></button>`).join('')}</div>
    <h3>${tr('Mochila')} <small>${E.itens.length}/${MAX_MOCHILA}</small></h3>
    <div class="eqMochila">${[...E.itens].sort((a, b) => b.r - a.r || poderItem(b) - poderItem(a)).map(x => itemHtml(x, `${usando.has(x.id) ? 'usando' : ''} ${sel === x.id ? 'sel' : ''}`)).join('') || `<p>${tr('Vazia')}</p>`}</div>
    <button class="btn verde grande" data-a="fecharJanela">OK</button></div>`;
}
export function clique(b) {
  const a = b.dataset.eq, id = +b.dataset.id, E = eq(), it = E.itens.find(x => x.id === id);
  if (a === 'abrir') { som('abrir'); mostrar(); return true; }
  if (a === 'ver') { som('clique'); mostrar(id); return true; }
  if (a === 'bau') { const B = BAUS[+b.dataset.n]; if (!B || S.moedas < B.preco) { som('erro'); return true; } S.moedas -= B.preco; const novo = gerarItem(B.min * 4, B.min, B.max); salvar(); som('compra'); sfx(novo.r >= 4 ? 'vitoria' : 'brilho'); mostrar(novo.id); return true; }
  if (a === 'dj') { const n = +b.dataset.n; if (n === 0) { if (E.dia === hoje()) return true; E.dia = hoje(); }
    else if (estrelas() >= n) E.est -= n; else { const c = PRECO_DESEJO * n * (n >= 10 ? 0.9 : 1); if (S.moedas < c) { som('erro'); return true; } S.moedas -= c; }
    som('compra'); const itens = []; for (let i = 0; i < Math.max(1, n); i++) itens.push(desejar()); salvar(); revelar(itens); return true; }
  if (!it) return false;
  if (a === 'usar') { E.usando[it.slot] = it.id; salvar(); sfx('brilho'); mostrar(id); return true; }
  if (a === 'up') { const c = custoUp(it); if (S.moedas < c || it.nv >= MAX_NV) { som('erro'); return true; } S.moedas -= c; it.nv++; salvar(); som('compra'); sfx('vitoria'); mostrar(id); return true; }
  if (a === 'des') { if (Object.values(E.usando).includes(it.id)) return true; S.moedas += valorDesmontar(it); E.itens.splice(E.itens.indexOf(it), 1); salvar(); som('moedas'); mostrar(); return true; }
  return false;
}
