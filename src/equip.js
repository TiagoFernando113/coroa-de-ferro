// Equipamentos (estilo RPG): arma, armadura, anel e amuleto com raridade, atributos e nível.
// Caem no fim da Árvore Sagrada e da Defesa em Grupo (ou saem dos baús da Forja) e deixam o herói mais forte nesses modos.
// Elmo, armadura e capa mudam a aparência do herói (com a cor da raridade); a arma aparece na mão.
import { S, salvar, fimDeSemana } from './meta.js';
import * as C from './cena.js';
import { heroiAtual, HEROIS } from './herois.js';
import { modeloItem, armaModelo, tipoDe } from './itens3d.js';
import { fmt, tiros } from './dados.js';
import { som, $, ico } from './util.js';
import { sfx } from './musica.js';
import { t as tr } from './i18n.js';
import { evento } from './missoes.js';

// nomes: [nome, visual, gênero] (o visual vai para o herói)
export const SLOTS = {
  arma: { nome: 'Arma', ic: 'h_lamina', nomes: [['Espada', 'espada', 'f'], ['Lâmina', 'espada', 'f'], ['Machado', 'machado'], ['Arco', 'arco'], ['Cajado', 'cajado'], ['Martelo', 'martelo'], ['Lança', 'lanca', 'f'], ['Adaga', 'adaga', 'f'], ['Foice', 'foice', 'f']], st: { dano: 8, cad: 4 } },
  elmo: { nome: 'Elmo', ic: 'c_rosto', nomes: [['Elmo', 'elmo'], ['Elmo de Viseira', 'viseira'], ['Chapéu Arcano', 'mago'], ['Pele de Urso', 'urso', 'f'], ['Máscara do Ladrão', 'lenco', 'f']], st: { vida: 8, crit: 1.5 } },
  armadura: { nome: 'Armadura', ic: 'c_roupa', nomes: [['Armadura de Placas', 'Knight', 'f'], ['Couraça Bárbara', 'Barbarian', 'f'], ['Manto Arcano', 'Mage'], ['Traje de Patrulheiro', 'Ranger'], ['Traje Sombrio', 'Rogue']], st: { vida: 15, def: 3 } },
  capa: { nome: 'Capa', ic: 'capa', nomes: [['Capa Real', 'Knight', 'f'], ['Capa Arcana', 'Mage', 'f'], ['Capa do Patrulheiro', 'Ranger', 'f'], ['Capa Sombria', 'Rogue', 'f'], ['Capuz Errante', 'Rogue_Hooded']], st: { def: 2, recarga: 3 } },
  anel: { nome: 'Anel', ic: 'gema', nomes: [['Anel'], ['Aliança', '', 'f'], ['Selo']], st: { crit: 3, roubo: 1 } },
  amuleto: { nome: 'Amuleto', ic: 'coroa', nomes: [['Amuleto'], ['Talismã'], ['Pingente'], ['Relíquia', '', 'f']], st: { recarga: 5, cura: 0.5 } },
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
// classes: cada herói só usa as armas da sua classe (mago de cajado, arqueiro de arco...)
export const CLASSES = { guerreiro: { nome: 'Guerreiro', ic: 'escudo', armas: ['espada', 'machado', 'martelo', 'lanca'], perto: true }, ladino: { nome: 'Ladino', ic: 'lad', armas: ['adaga', 'foice'], perto: true },
  arqueiro: { nome: 'Arqueiro', ic: 'arq', armas: ['arco'] }, mago: { nome: 'Mago', ic: 'mag', armas: ['cajado'] } };
export const CLASSE_HEROI = { lyra: 'arqueiro', brann: 'arqueiro', grom: 'arqueiro', selene: 'mago', zarak: 'mago', raiden: 'mago', kira: 'ladino', nyx: 'ladino', thalia: 'guerreiro', bjorn: 'guerreiro' };
export const BASE_CLASSE = { guerreiro: 'thalia', arqueiro: 'lyra', mago: 'selene', ladino: 'kira' }; // herói que vem com a classe (os outros são visuais dela)
export const PAPEL = { guerreiro: 'Provoca: os inimigos vêm em você e você toma 25% menos dano', arqueiro: 'Marca o alvo: o time causa +25% de dano nele', mago: 'Cura o grupo em volta a cada 5s', ladino: 'Golpe pelas costas: dano quase dobrado' };
const DESC_CLASSE = { guerreiro: 'Luta de perto, aguenta muito', arqueiro: 'Ataca de longe, rápido', mago: 'Magias em área', ladino: 'Golpes rápidos de perto' };
const VISUAIS_CLASSE = { guerreiro: ['Knight', 'Barbarian', 'elmo', 'viseira'], arqueiro: ['Ranger', 'urso', 'elmo'], mago: ['Mage', 'mago'], ladino: ['Rogue', 'Rogue_Hooded', 'lenco'] };
export const classeAtual = () => CLASSE_HEROI[S.heroi] || S.classe || 'arqueiro'; // a classe segue o herói em uso
const lendasDaClasse = () => Object.entries(LENDAS).filter(([, L]) => CLASSES[classeAtual()].armas.includes(tipoDe(L.modelo.slice(2))));
export const tipoArma = it => it?.modelo?.startsWith('P:') ? tipoDe(it.modelo.slice(2)) : null;
export const classeDaArma = it => Object.keys(CLASSES).find(c => CLASSES[c].armas.includes(tipoArma(it))) || 'guerreiro';
export const serveNoHeroi = it => it.slot !== 'arma' || classeDaArma(it) === classeAtual();
// o que está em uso: a arma é guardada por classe (trocar de herói troca a arma)
const usando = () => { const E = eq(), u = { ...E.usando }, c = classeAtual(); delete u.arma;
  if (!E.itens.some(x => x.id === E.armas[c])) { const m = E.itens.filter(x => x.slot === 'arma' && classeDaArma(x) === c).sort((p, q) => poderItem(q) - poderItem(p))[0]; if (m) E.armas[c] = m.id; else delete E.armas[c]; } // sem arma da classe: usa a melhor que tiver
  if (E.armas[c]) u.arma = E.armas[c]; return u; };
const emUso = id => { const E = eq(); return Object.values(E.usando).includes(id) || Object.values(E.armas).includes(id); };
function equipar(it) { const E = eq(); if (it.slot === 'arma') E.armas[classeDaArma(it)] = it.id; else E.usando[it.slot] = it.id; }
// aparência do herói com o que está equipado (comArma: só nos modos em grupo, onde o golpe muda junto)
export function visualHeroi(base, comArma = false) {
  const E = eq(), U = usando(), v = { ...base }, de = s => E.itens.find(x => x.id === U[s]);
  const ar = de('armadura'); if (ar?.vis) { v.tro = v.bra = v.per = ar.vis; if (ar.r >= 1) v.tinta = RARIDADES[ar.r].cor; v.cores = {}; }
  const el = de('elmo'); if (el?.vis) { if (el.vis === 'lenco') v.mas = 'lenco'; else v.cha = el.vis; if (el.r >= 1) v.tintaCha = RARIDADES[el.r].cor; }
  const ca = de('capa'); if (ca?.vis) { v.capa = ca.vis; if (ca.r >= 1) v.tintaCapa = RARIDADES[ca.r].cor; if (ca.r >= 4) v.aura = 'sim'; if (ca.r >= 5 && !v.asas) v.asas = 'anjo'; }
  const cj = conjunto(); if (cj?.n >= 3) v.aura = 'sim';
  const a = de('arma'); if (comArma && a?.modelo) return visualCom(v, a.modelo);
  return v;
}
export const assinatura = () => { const E = eq(); return Object.entries(usando()).map(([s, id]) => { const it = E.itens.find(x => x.id === id); return it ? `${s}${it.vis || it.modelo || ''}${it.r}` : ''; }).join('|'); };
export function armaEquipada() { const E = eq(), it = E.itens.find(x => x.id === usando().arma); return it || null; }
export const armaDePerto = () => { const a = armaEquipada(); return !!a && !!CLASSES[classeDaArma(a)].perto; };
export function visualCom(v, modelo) { if (!modelo) return v; return { ...v, arma: modelo, esq: tipoGolpe(modelo) === 'arco' || tipoGolpe(modelo) === 'martelo' ? '' : v.esq }; }
export const tipoGolpe = modelo => !modelo ? null : modelo.startsWith('P:') ? ({ arco: 'arco', cajado: 'cajado', martelo: 'martelo' }[tipoDe(modelo.slice(2))] || 'corte') : /bow/.test(modelo) ? 'arco' : /staff|wand/.test(modelo) ? 'cajado' : /hammer/.test(modelo) ? 'martelo' : 'corte';
const ST = { dano: ['Dano', '%'], cad: ['Velocidade de ataque', '%'], vida: ['Vida', ''], def: ['Defesa', '%'], crit: ['Crítico', '%'], roubo: ['Roubo de vida', '%'], recarga: ['Recarga do poder', '%'], cura: ['Cura', '/s'] };
const MAX_NV = 10, MAX_MOCHILA = 40;
const TIPO_ANTIGO = m => /bow/.test(m) ? 'arco' : /staff|wand/.test(m) ? 'cajado' : /axe/.test(m) ? 'machado' : /hammer/.test(m) ? 'martelo' : /spear|halberd/.test(m) ? 'lanca' : /dagger|knife/.test(m) ? 'adaga' : /scythe/.test(m) ? 'foice' : 'espada';
function eq() {
  const E = (S.equip ||= { itens: [], usando: {}, id: 1 });
  if (!E.armas) { E.armas = {}; // versão nova: armas 3D (modelo "P:tipo:raridade") e uma arma por classe
    for (const it of E.itens) if (it.slot === 'arma' && !it.modelo?.startsWith('P:')) it.modelo = it.lenda ? LENDAS[it.lenda].modelo : `P:${TIPO_ANTIGO(it.modelo || '')}:${it.r}`;
    const a = E.itens.find(x => x.id === E.usando.arma); if (a) E.armas[classeDaArma(a)] = a.id; delete E.usando.arma; }
  return E;
}
export const valor = (it, k) => (it.st[k] || 0) * (1 + 0.1 * (it.nv - 1));

// novo item: quanto mais longe foi a partida, mais chance de raridade alta
export function gerarItem(onda, minR = 0, maxR = 5, lk = null) { // lk: lenda garantida (Desejos)
  const E = eq(), slots = Object.keys(SLOTS), slot = lk ? 'arma' : slots[Math.floor(Math.random() * slots.length)], sorte = onda / 2.4 + Math.random() * 4 + Math.random() * Math.random() * 6;
  const r = Math.min(maxR, Math.max(minR, sorte > 11 ? 5 : sorte > 8.5 ? 4 : sorte > 6.2 ? 3 : sorte > 4.2 ? 2 : sorte > 2.4 ? 1 : 0)), R = RARIDADES[r], D = SLOTS[slot], st = {};
  for (const [k, v] of Object.entries(D.st)) st[k] = Math.round(v * R.m * (0.8 + Math.random() * 0.4) * 10) / 10;
  const vc = VISUAIS_CLASSE[classeAtual()], nomes = D.nomes.filter(n => !n[1] || slot === 'arma' || vc.includes(n[1])), [nm, vis, gen] = (nomes.length ? nomes : D.nomes)[Math.floor(Math.random() * (nomes.length || D.nomes.length))];
  const it = { id: E.id++, slot, r, nv: 1, st, nome: `${nm} ${R.adj[gen === 'f' ? 1 : 0]}` };
  if (vis && slot !== 'arma') it.vis = vis;
  if (slot === 'arma') { const minhas = CLASSES[classeAtual()].armas, tp = minhas[Math.floor(Math.random() * minhas.length)], nn = D.nomes.find(n => n[1] === tp) || [nm, vis, gen];
    it.modelo = `P:${tp}:${r}`; it.nome = `${nn[0]} ${R.adj[nn[2] === 'f' ? 1 : 0]}`;
    const ls = lendasDaClasse().filter(([, L]) => L.r <= r); if (lk || (r >= 3 && ls.length && Math.random() < 0.5)) { const [k, L] = lk ? [lk, LENDAS[lk]] : ls[Math.floor(Math.random() * ls.length)]; Object.assign(it, { lenda: k, nome: L.nome, modelo: L.modelo }); } }
  evento('equip'); E.itens.push(it); if (E.itens.length > MAX_MOCHILA) { const pior = E.itens.filter(x => !emUso(x.id)).sort((a, b) => a.r - b.r || poderItem(a) - poderItem(b))[0]; if (pior) E.itens.splice(E.itens.indexOf(pior), 1); }
  const atual = slot === 'arma' ? E.armas[classeDaArma(it)] : E.usando[slot]; if (!atual || poderItem(it) > poderItem(E.itens.find(x => x.id === atual) || { st: {}, nv: 1, r: 0 })) equipar(it); // equipa sozinho se for melhor
  salvar(); return it;
}
export function poderItem(it) { let p = 0; for (const k of Object.keys(it.st)) p += valor(it, k) * ({ vida: 2, cura: 40, def: 8, crit: 8, roubo: 15 }[k] || 6); return Math.round(p * (it.lenda ? 1.35 : 1)); }
// soma dos atributos do que está equipado
// conjuntos: elmo + armadura + capa da mesma linha dão bônus (2 peças: metade; 3 peças: tudo e o herói brilha)
export const CONJUNTOS = {
  cavaleiro: { nome: 'Cavaleiro', ic: 'escudo', pecas: { elmo: ['elmo', 'viseira'], armadura: ['Knight', 'Barbarian'], capa: ['Knight'] }, bonus: { vida: 40, def: 8 } },
  mago: { nome: 'Arcano', ic: 'mag', pecas: { elmo: ['mago'], armadura: ['Mage'], capa: ['Mage'] }, bonus: { dano: 14, recarga: 12 } },
  patrulheiro: { nome: 'Patrulheiro', ic: 'arq', pecas: { elmo: ['urso'], armadura: ['Ranger'], capa: ['Ranger'] }, bonus: { cad: 14, crit: 8 } },
  ladino: { nome: 'Sombra', ic: 'lad', pecas: { elmo: ['lenco'], armadura: ['Rogue'], capa: ['Rogue', 'Rogue_Hooded'] }, bonus: { crit: 10, roubo: 4 } },
};
export function conjunto() {
  const E = eq(), U = usando(); let m = null;
  for (const [k, C] of Object.entries(CONJUNTOS)) { const n = Object.entries(C.pecas).filter(([sl, l]) => { const it = E.itens.find(x => x.id === U[sl]); return it && l.includes(it.vis); }).length; if (n >= 2 && (!m || n > m.n)) m = { k, n, ...C }; }
  return m;
}
export function atributos() {
  const E = eq(), a = { dano: 0, cad: 0, vida: 0, def: 0, crit: 0, roubo: 0, recarga: 0, cura: 0 };
  for (const id of Object.values(usando())) { const it = E.itens.find(x => x.id === id); if (it) for (const k of Object.keys(it.st)) a[k] += valor(it, k); }
  const cj = conjunto(); if (cj) for (const [k, v] of Object.entries(cj.bonus)) a[k] += v * (cj.n >= 3 ? 1 : 0.5);
  a.def = Math.min(60, a.def); a.crit = Math.min(60, a.crit); a.recarga = Math.min(60, a.recarga); return a;
}
export function poder() { const E = eq(); let p = 0; for (const id of Object.values(usando())) { const it = E.itens.find(x => x.id === id); if (it) p += poderItem(it); } return p; }
export function melhorRaridade() { const E = eq(); let m = -1; for (const id of Object.values(usando())) { const it = E.itens.find(x => x.id === id); if (it) m = Math.max(m, it.r); } return m; }
export const BAUS = [{ nome: 'Baú de Ferro', preco: 400, min: 0, max: 2, ic: 'bau' }, { nome: 'Baú Raro', preco: 1500, min: 2, max: 3, ic: 'bau' }, { nome: 'Baú Épico', preco: 5000, min: 3, max: 4, ic: 'bau' }, { nome: 'Baú Lendário', preco: 15000, min: 4, max: 5, ic: 'bau' }];
// ---- Desejos: estrelas ganhas nas partidas (ou moedas), 1 grátis por dia, lenda da semana em destaque e garantia ----
export const PRECO_DESEJO = 600, PITY = 50;
const hoje = () => new Date().toISOString().slice(0, 10);
export const destaque = () => { const ks = lendasDaClasse().map(([k]) => k); return ks[Math.floor((Date.now() / 864e5 + 3) / 7) % ks.length] || 'fenda'; }; // lenda da semana da sua classe
export const estrelas = () => eq().est || 0;
export const estrelasPartida = ondas => ondas < 2 ? 0 : Math.max(1, Math.floor(ondas / 4)) * (fimDeSemana() ? 2 : 1);
export function ganharEstrelas(n) { if (n > 0) { const E = eq(); E.est = (E.est || 0) + n; salvar(); } }
function desejar() { // Mítico 1,5% (garantido em 50), Lendário+ garantido a cada 10
  const E = eq(), x = Math.random(); E.pity = (E.pity || 0) + 1; E.p4 = (E.p4 || 0) + 1;
  const r = E.pity >= PITY || x < 0.015 ? 5 : E.p4 >= 10 || x < 0.085 ? 4 : x < 0.265 ? 3 : x < 0.565 ? 2 : 1;
  if (r >= 4) E.p4 = 0; if (r === 5) E.pity = 0;
  const dk = destaque(); return gerarItem(0, r, r, r === 5 || (r >= LENDAS[dk].r && Math.random() < 0.25) ? dk : null);
}
function revelar(itens) {
  const j = $('#janela'), m = Math.max(...itens.map(i => i.r));
  j.innerHTML = `<div class="jOnline eqTela dsTela r${m}" style="--r:${RARIDADES[m].cor}"><h2>${ico('estrela')} ${tr('Desejos')}</h2><div class="dsRev">${itens.map((it, i) => `<div class="dsCarta r${it.r}" style="--i:${i};--r:${RARIDADES[it.r].cor}">${itemHtml(it, 'novo')}<small>${tr(RARIDADES[it.r].nome)}</small></div>`).join('')}</div>
    ${m >= 4 ? `<p class="dsUau">${ico('estrela')} ${itens.filter(i => i.r >= 4).map(i => `<b style="color:${RARIDADES[i.r].cor}">${i.nome}</b>`).join(' · ')}</p>` : ''}<button class="btn verde grande" data-eq="abrir">OK</button></div>`;
  setTimeout(() => sfx(m >= 4 ? 'vitoria' : 'brilho'), itens.length * 180);
}
const custoUp = it => Math.round(80 * it.nv * (1 + it.r) * (1 + it.r * 0.5));
const valorDesmontar = it => Math.round(20 * (1 + it.r) ** 2 * it.nv);

// ---- tela da mochila ----
export const itemHtml = (it, cls = '') => `<button class="eqItem r${it.r} ${cls} ${it.lenda ? 'lenda' : ''} ${serveNoHeroi(it) ? '' : 'naoServe'}" data-eq="ver" data-id="${it.id}" style="--r:${RARIDADES[it.r].cor}"><img src="${iconeItem(it)}" alt=""><em>${it.nv > 1 ? '+' + (it.nv - 1) : ''}</em>${it.lenda ? `<u>${ico('estrela')}</u>` : ''}${it.slot === 'arma' ? `<s>${ico(CLASSES[classeDaArma(it)].ic)}</s>` : ''}${comparar(it)}</button>`;
const NOME_TIPO = { espada: 'Espadas', machado: 'Machados', martelo: 'Martelos', lanca: 'Lanças', arco: 'Arcos', cajado: 'Cajados', adaga: 'Adagas', foice: 'Foices' };
// ícone = foto do modelo 3D do item (guardada)
const fotos = new Map(), GIRO = { arma: [0.15, 0.35, -0.72], capa: [0.2, Math.PI + 0.5, 0] };
export function iconeItem(it, tam = 96) {
  const k = `${it.slot}:${it.modelo || it.vis || it.nome.split(' ')[0]}:${it.r}:${tam}`; if (fotos.has(k)) return fotos.get(k);
  let u = ''; try { // elmo, armadura e capa: foto da própria peça do kit (igual ao que aparece no herói)
    const vis = it.vis, kit = vis && { elmo: vis === 'lenco' ? 'mas' : 'cha', armadura: 'tro', capa: 'capa' }[it.slot];
    if (kit) u = C.fotoPeca({ ...heroiAtual(S).visual, cab: '', tro: it.slot === 'armadura' ? vis : '', bra: '', per: '', cha: kit === 'cha' ? vis : '', mas: kit === 'mas' ? vis : '', capa: kit === 'capa' ? vis : '', cos: '', cores: {}, tinta: '', tintaCha: '', tintaCapa: '', [{ armadura: 'tinta', elmo: 'tintaCha', capa: 'tintaCapa' }[it.slot]]: it.r >= 1 ? RARIDADES[it.r].cor : '' }, kit, { tam, rot: it.slot === 'capa' ? [0.2, Math.PI + 0.35, 0] : [0.15, 0.45, 0] }) || '';
    if (!u) u = C.fotoObjeto(modeloItem(it), { tam, rot: GIRO[it.slot] || [0.3, 0.55, 0] }) || ''; } catch (e) {} if (u) fotos.set(k, u); return u;
}
// ficha: os números finais do herói nos modos com equipamento (nível das melhorias + equipamentos + conjunto)
export function ficha() {
  const H = heroiAtual(S), A = atributos(), up = S.up || {}, perto = armaDePerto();
  const dano = 3 * H.ataque.dano * (1 + (up.flechas || 0) * 0.35) * (1 + A.dano / 100) * (perto ? 1.6 : 1), vel = tiros(up.fogo || 0) * H.ataque.cad * 0.6 * (1 + A.cad / 100);
  return { dano, vel, dps: dano * vel * (1 + A.crit / 100 * 1.2), vida: Math.round(100 * (1 + 0.2 * (up.vida || 0)) + A.vida), def: A.def, crit: A.crit, roubo: A.roubo };
}
function htmlFicha() { const F = ficha(), c = (ic, n, v) => `<div><i>${ico(ic)}</i><b>${v}</b><small>${tr(n)}</small></div>`;
  return `<div class="eqFicha">${c('h_fogo', 'Dano por segundo', fmt(Math.round(F.dps * 10)))}${c('h_lamina', 'Dano', fmt(Math.round(F.dano * 10)))}${c('raio', 'Ataques/s', F.vel.toFixed(1))}${c('coracao', 'Vida', fmt(F.vida))}${c('escudo', 'Defesa', Math.round(F.def) + '%')}${c('h_perfura', 'Crítico', Math.round(F.crit) + '%')}</div>`; }
// vitrine: o herói equipado que os outros veem no perfil (ranking, clã, chat)
const CHAVES_VIS = ['cab', 'tro', 'bra', 'per', 'cha', 'mas', 'capa', 'cos', 'tinta', 'tintaCha', 'tintaCapa', 'aura', 'asas', 'arma', 'esq', 'pele', 'corPelo', 'orelha', 'barba', 'chifre', 'presas', 'rabo', 'alt', 'larg', 'cabT', 'musc'];
export function vitrine() {
  const v = visualHeroi(heroiAtual(S).visual, true), E = eq(), U = usando();
  return { c: classeAtual(), h: S.heroi, p: poder(), v: Object.fromEntries(CHAVES_VIS.filter(k => v[k] != null && v[k] !== '').map(k => [k, v[k]])),
    it: Object.entries(U).map(([sl, id]) => { const x = E.itens.find(i => i.id === id); return x ? [sl, x.modelo || x.vis || '', x.r, x.nv, x.nome.slice(0, 30), x.lenda || ''] : null; }).filter(Boolean) };
}
export function htmlVitrine(d, chave) {
  if (!d?.v) return ''; const CL = CLASSES[d.c] || CLASSES.arqueiro; let foto = '';
  try { const q = C.quadrosAnim({ ...(HEROIS[d.h] || HEROIS.lyra).visual, ...d.v }, 'Idle_A', { n: 1, tam: 180, chave: 'vt:' + chave + JSON.stringify(d.v).length + d.p }); foto = q?.q?.[0]?.toDataURL() || ''; } catch (e) {}
  const itens = (d.it || []).map(([sl, m, r, nv, nome, lenda]) => ({ id: -1, slot: sl, modelo: sl === 'arma' ? m : undefined, vis: sl !== 'arma' ? m : undefined, r: Math.min(5, r | 0), nv: nv | 0 || 1, nome: String(nome || ''), lenda: LENDAS[lenda] ? lenda : undefined, st: {} }));
  return `<div class="vtHeroi">${foto ? `<img class="eqFoto" src="${foto}" alt="">` : ''}<div><b>${ico(CL.ic)} ${tr(CL.nome)}</b><small>${tr('Poder')} <b>${fmt(d.p || 0)}</b></small>
    <div class="vtItens">${itens.map(it => `<span class="eqItem r${it.r} ${it.lenda ? 'lenda' : ''}" style="--r:${RARIDADES[it.r].cor}" title="${it.nome.replace(/"/g, '')}"><img src="${iconeItem(it, 72)}" alt=""><em>${it.nv > 1 ? '+' + (it.nv - 1) : ''}</em></span>`).join('')}</div></div></div>`;
}
// item novo que caiu: modelo girando, atributos comparados com o equipado e "Equipar agora"
export function novoItem(it) {
  if (!it) return; const E = eq(), cur = E.itens.find(x => x.id === usando()[it.slot]), serve = serveNoHeroi(it), R = RARIDADES[it.r], d = poderItem(it) - (cur ? poderItem(cur) : 0);
  const quadros = []; for (let i = 0; i < 8; i++) { try { quadros.push(C.fotoObjeto(modeloItem(it), { tam: 200, rot: [0.15, i * Math.PI / 4, it.slot === 'arma' ? -0.5 : 0] })); } catch (e) {} }
  const ks = new Set([...Object.keys(it.st), ...Object.keys(cur?.st || {})]), j = $('#janela'); j.hidden = false; sfx(it.r >= 4 ? 'vitoria' : 'brilho');
  j.innerHTML = `<div class="jOnline eqNovo r${it.r}" style="--r:${R.cor}"><div class="novoRaios"></div><em class="eqNovoTag">${tr(R.nome)}</em><img class="eqGira" src="${quadros[0] || iconeItem(it, 200)}" alt="">
    <h2>${it.nome}</h2>${it.lenda ? `<p class="eqLenda">${ico('estrela')} ${tr(LENDAS[it.lenda].desc)}</p>` : ''}
    <div class="eqCmpT">${[...ks].map(k => { const a = valor(it, k), b = cur ? valor(cur, k) : 0, df = Math.round((a - b) * 10) / 10; return `<span>${tr(ST[k][0])} <b>${fmt(Math.round(a * 10) / 10)}${ST[k][1]}</b>${df ? `<i class="${df > 0 ? 'mais' : 'menos'}">${df > 0 ? '▲' : '▼'}${fmt(Math.abs(df))}</i>` : ''}</span>`; }).join('')}</div>
    <p class="eqPoderD">${tr('Poder')} ${fmt(poderItem(it))} ${d ? `<i class="${d > 0 ? 'mais' : 'menos'}">${d > 0 ? '▲' : '▼'}${fmt(Math.abs(d))}</i>` : ''}</p>
    ${serve ? `<button class="btn verde grande" data-eq="usarNovo" data-id="${it.id}">${tr('Equipar agora')}</button>` : `<p class="eqClasse nao">${tr('Não serve para sua classe')}</p>`}<button class="btn cinza" data-eq="fecharNovo">${tr('Guardar na mochila')}</button></div>`;
  if (quadros.length > 1) { let i = 0; const img = j.querySelector('.eqGira'), t = setInterval(() => { if (!img.isConnected) return clearInterval(t); i = (i + 1) % quadros.length; img.src = quadros[i]; }, 140); }
}
export const melhorQueEquipado = it => { if (!serveNoHeroi(it)) return false; const cur = eq().itens.find(x => x.id === usando()[it.slot]); return !cur || poderItem(it) > poderItem(cur); };
// seta no item: melhor (verde) ou pior (vermelha) que o que está equipado no mesmo lugar
function comparar(it) {
  if (!serveNoHeroi(it) || emUso(it.id)) return ''; const E = eq(), cur = E.itens.find(x => x.id === usando()[it.slot]);
  if (!cur) return '<b class="eqCmp mais">▲</b>'; const d = poderItem(it) - poderItem(cur); return d > 0 ? '<b class="eqCmp mais">▲</b>' : d < 0 ? '<b class="eqCmp menos">▼</b>' : '';
}
// ações em massa: equipar o melhor de cada lugar e desmontar os fracos (até Raro, sem lenda, piores que o equipado)
function melhores() { const E = eq(); for (const sl of Object.keys(SLOTS)) { const m = E.itens.filter(x => x.slot === sl && serveNoHeroi(x)).sort((a, b) => poderItem(b) - poderItem(a))[0]; if (m) equipar(m); } }
function fracos() { const E = eq(), U = usando(); return E.itens.filter(x => !emUso(x.id) && !x.lenda && x.r <= 2 && (() => { const cur = E.itens.find(y => y.id === U[x.slot]); return cur && poderItem(x) < poderItem(cur); })()); }
const linhaSt = (it, k) => { const [n, u] = ST[k]; return `<span>${tr(n)} <b>+${fmt(Math.round(valor(it, k) * 10) / 10)}${u}</b></span>`; };
export function mostrar(sel = null) {
  const p = $('#eqPainel'); if (p && !p.closest('[hidden]')) { p.innerHTML = painel(sel); return; } // na aba Herói: atualiza ali mesmo
  const j = $('#janela'); j.hidden = false; j.innerHTML = `<div class="jOnline eqTela">${painel(sel)}<button class="btn verde grande" data-a="fecharJanela">OK</button></div>`;
}
export function painel(sel = null) {
  const E = eq(), U = usando(), emUsoAgora = new Set(Object.values(U)), A = atributos(), CL = CLASSES[classeAtual()];
  const it = sel != null && E.itens.find(x => x.id === sel);
  const det = it ? (() => { const R = RARIDADES[it.r], eq1 = emUsoAgora.has(it.id), serve = serveNoHeroi(it), CA = CLASSES[classeDaArma(it)], c = custoUp(it);
    return `<div class="eqDet" style="--r:${R.cor}"><div class="eqDetT"><img class="eqPx" src="${iconeItem(it, 160)}" alt=""><span><b>${it.nome}${it.nv > 1 ? ` +${it.nv - 1}` : ''}</b><small>${tr(R.nome)} · ${tr(SLOTS[it.slot].nome)} · ${tr('Poder')} ${fmt(poderItem(it))}</small>${it.slot === 'arma' ? `<small class="eqClasse ${serve ? '' : 'nao'}">${ico(CA.ic)} ${tr('Só para')} ${tr(CA.nome)}${CA.perto ? ` · ${tr('ataca de perto')}` : ` · ${tr('ataca de longe')}`}</small>` : ''}</span></div>
      <div class="eqSt">${Object.keys(it.st).map(k => linhaSt(it, k)).join('')}</div>${it.lenda ? `<p class="eqLenda">${ico('estrela')} ${tr(LENDAS[it.lenda].desc)}</p>` : ''}
      <div class="eqBts">${eq1 ? `<button class="btn cinza peq" disabled>${tr('Equipado')}</button>` : serve ? `<button class="btn verde peq" data-eq="usar" data-id="${it.id}">${tr('Equipar')}</button>` : `<button class="btn cinza peq" disabled>${ico(CA.ic)} ${tr(CA.nome)}</button>`}
        ${it.nv < MAX_NV ? `<button class="btn amarelo peq" data-eq="up" data-id="${it.id}" ${S.moedas < c ? 'disabled' : ''}>${tr('Melhorar')} ${ico('ouro')}${fmt(c)}</button>` : `<small>MAX</small>`}
        ${emUso(it.id) ? '' : `<button class="btn vermelho peq" data-eq="des" data-id="${it.id}">${tr('Desmontar')} +${fmt(valorDesmontar(it))}</button>`}</div></div>`; })() : '';
  let foto = ''; try { const q = C.quadrosAnim(visualHeroi(heroiAtual(S).visual, true), 'Idle_A', { n: 1, tam: 200, chave: 'eqv:' + S.heroi + assinatura() }); if (q?.q?.[0]) foto = q.q[0].toDataURL(); } catch (e) {}
  return `<p class="eqPoder">${tr('Poder')} <b>${fmt(poder())}</b> · <small>${tr('vale na Árvore Sagrada e na Defesa em Grupo')}</small></p>
    ${foto ? `<img class="eqFoto" src="${foto}" alt="">` : ''}${htmlFicha()}<p class="eqClasseH">${ico(CL.ic)} <b>${tr(CL.nome)}</b> <button class="eqTrocaC" data-eq="classes">${tr('trocar')}</button> · ${tr('usa')} ${CL.armas.map(a => tr(NOME_TIPO[a])).join(', ')}${CL.perto ? ` · ${tr('ataca de perto')}` : ''}<br><small class="clPapel">${tr(PAPEL[classeAtual()])}</small></p>
    <div class="eqSlots">${Object.entries(SLOTS).map(([k, D]) => { const x = E.itens.find(i => i.id === U[k]); return `<div class="eqSlot"><small>${tr(D.nome)}</small>${x ? itemHtml(x, sel === x.id ? 'sel' : '') : `<span class="eqVazio">${ico(D.ic)}</span>`}</div>`; }).join('')}</div>
    <div class="eqTot">${Object.entries(A).filter(([, v]) => v).map(([k, v]) => `<span>${tr(ST[k][0])} +${fmt(Math.round(v * 10) / 10)}${ST[k][1]}</span>`).join('') || `<span>${tr('Jogue a Árvore Sagrada para ganhar equipamentos!')}</span>`}</div>
    ${det}${(() => { const dk = destaque(), L = LENDAS[dk], est = estrelas(), gratis = E.dia !== hoje(), cus = n => est >= n ? `${ico('estrela')} ${n}` : `${ico('ouro')} ${fmt(PRECO_DESEJO * n * (n >= 10 ? 0.9 : 1))}`, pode = n => est >= n || S.moedas >= PRECO_DESEJO * n * (n >= 10 ? 0.9 : 1);
      return `<h3>${ico('estrela')} ${tr('Desejos')} <small>${ico('estrela')} ${fmt(est)}${fimDeSemana() ? ` · ${tr('fim de semana: estrelas em dobro!')}` : ''}</small></h3>
      <div class="dsBanner" style="--r:${RARIDADES[5].cor}"><img src="${iconeItem({ slot: 'arma', modelo: L.modelo, r: 5 }, 128)}" alt=""><div><small>${tr('Lenda da semana')}</small><b>${L.nome}</b><small>${tr(L.desc)}</small><small class="dsPity">${tr('Mítico garantido em')} <b>${PITY - (E.pity || 0)}</b> · ${tr('Lendário+ a cada 10')}</small></div></div>
      <div class="dsBts">${gratis ? `<button class="btn verde" data-eq="dj" data-n="0">${ico('presente')} ${tr('Grátis hoje')}</button>` : ''}<button class="btn azul" data-eq="dj" data-n="1" ${pode(1) ? '' : 'disabled'}>1x · ${cus(1)}</button><button class="btn roxo" data-eq="dj" data-n="10" ${pode(10) ? '' : 'disabled'}>10x · ${cus(10)}</button></div>
      <p class="eqDica">${ico('estrela')} ${tr('Ganhe estrelas na Árvore Sagrada e na Defesa em Grupo')}</p>`; })()}
    <h3>${ico('forja')} ${tr('Forja')} <small>${tr('baús com raridade garantida')}</small></h3>
    <div class="eqForja">${BAUS.map((B, i) => `<button class="eqBau" data-eq="bau" data-n="${i}" ${S.moedas < B.preco ? 'disabled' : ''} style="--r:${RARIDADES[B.min].cor}"><i>${ico(B.ic)}</i><b>${tr(B.nome)}</b><small>${tr(RARIDADES[B.min].nome)}+</small><em>${ico('ouro')} ${fmt(B.preco)}</em></button>`).join('')}</div>
    ${(() => { const cj = conjunto(); return cj ? `<p class="eqConj">${ico(cj.ic)} ${tr('Conjunto')} <b>${tr(cj.nome)}</b> ${cj.n}/3 · ${Object.entries(cj.bonus).map(([k, v]) => `${tr(ST[k][0])} +${fmt(v * (cj.n >= 3 ? 1 : 0.5))}${ST[k][1]}`).join(' · ')}${cj.n < 3 ? ` · <small>${tr('3 peças: bônus completo e brilho')}</small>` : ` ${ico('estrela')}`}</p>` : `<p class="eqConj vazio">${tr('Vista elmo, armadura e capa da mesma linha para ganhar bônus de conjunto')}</p>`; })()}
    <h3>${tr('Mochila')} <small>${E.itens.length}/${MAX_MOCHILA}</small></h3>
    <div class="eqMassa"><button class="btn azul peq" data-eq="melhores">${ico('raio')} ${tr('Equipar melhores')}</button>${(() => { const f = fracos(); return f.length ? `<button class="btn vermelho peq" data-eq="fracos">${ico('girar')} ${tr('Desmontar fracos')} (${f.length}) +${fmt(f.reduce((t, x) => t + valorDesmontar(x), 0))}</button>` : ''; })()}</div>
    <div class="eqMochila">${[...E.itens].sort((a, b) => serveNoHeroi(b) - serveNoHeroi(a) || b.r - a.r || poderItem(b) - poderItem(a)).map(x => itemHtml(x, `${emUsoAgora.has(x.id) ? 'usando' : ''} ${sel === x.id ? 'sel' : ''}`)).join('') || `<p>${tr('Vazia')}</p>`}</div>`;
}
// escolha da classe (no começo do jogo, ou trocar depois na aba Herói)
export function escolherClasse(primeira = false) {
  const j = $('#janela'); j.hidden = false; sfx('brilho'); const atual = S.classe || CLASSE_HEROI[S.heroi];
  const foto = c => { try { const q = C.quadrosAnim(HEROIS[BASE_CLASSE[c]].visual, 'Idle_A', { n: 1, tam: 150, chave: 'cl:' + c }); return q?.q?.[0]?.toDataURL() || ''; } catch (e) { return ''; } };
  j.innerHTML = `<div class="jOnline jClasse"><h2>${tr(primeira ? 'Escolha sua classe' : 'Trocar de classe')}</h2><p>${tr('Os equipamentos que caem são da sua classe')}</p>
    <div class="clGrade">${Object.entries(CLASSES).map(([k, CL]) => `<button class="clCard ${k === atual ? 'sel' : ''}" data-eq="classe" data-c="${k}"><img src="${foto(k)}" alt=""><b>${ico(CL.ic)} ${tr(CL.nome)}</b><small>${tr(DESC_CLASSE[k])}</small><i class="clPapel">${tr(PAPEL[k])}</i><em>${CL.armas.map(a => tr(NOME_TIPO[a])).join(' · ')}</em></button>`).join('')}</div>
    ${primeira ? '' : `<button class="btn cinza" data-a="fecharJanela">${tr('Cancelar')}</button>`}</div>`;
}
export function clique(b) {
  const a = b.dataset.eq, id = +b.dataset.id, E = eq(), it = E.itens.find(x => x.id === id);
  if (a === 'abrir') { som('abrir'); mostrar(); return true; }
  if (a === 'classes') { som('clique'); escolherClasse(); return true; }
  if (a === 'usarNovo' || a === 'fecharNovo') { const x = E.itens.find(y => y.id === id); if (a === 'usarNovo' && x && serveNoHeroi(x)) { equipar(x); salvar(); sfx('brilho'); } else som('fechar'); $('#janela').hidden = true; mostrar(); return 'heroi'; }
  if (a === 'melhores') { melhores(); salvar(); sfx('brilho'); mostrar(); return true; }
  if (a === 'fracos') { const f = fracos(); for (const x of f) { S.moedas += valorDesmontar(x); E.itens.splice(E.itens.indexOf(x), 1); } salvar(); som('moedas'); mostrar(); return true; }
  if (a === 'classe') { const c = b.dataset.c; if (!CLASSES[c]) return true; S.classe = c; const h = BASE_CLASSE[c]; if (!S.herois.includes(h)) S.herois.push(h);
    if (CLASSE_HEROI[S.heroi] !== c) S.heroi = h; salvar(); sfx('vitoria'); $('#janela').hidden = true; return 'heroi'; }
  if (a === 'ver') { som('clique'); mostrar(id); return true; }
  if (a === 'bau') { const B = BAUS[+b.dataset.n]; if (!B || S.moedas < B.preco) { som('erro'); return true; } S.moedas -= B.preco; const novo = gerarItem(B.min * 4, B.min, B.max); salvar(); som('compra'); mostrar(); novoItem(novo); return true; }
  if (a === 'dj') { const n = +b.dataset.n; if (n === 0) { if (E.dia === hoje()) return true; E.dia = hoje(); }
    else if (estrelas() >= n) E.est -= n; else { const c = PRECO_DESEJO * n * (n >= 10 ? 0.9 : 1); if (S.moedas < c) { som('erro'); return true; } S.moedas -= c; }
    som('compra'); const itens = []; for (let i = 0; i < Math.max(1, n); i++) itens.push(desejar()); evento('desejos', Math.max(1, n)); salvar(); revelar(itens); return true; }
  if (!it) return false;
  if (a === 'usar') { if (!serveNoHeroi(it)) { som('erro'); return true; } equipar(it); salvar(); sfx('brilho'); mostrar(id); return true; }
  if (a === 'up') { const c = custoUp(it); if (S.moedas < c || it.nv >= MAX_NV) { som('erro'); return true; } S.moedas -= c; it.nv++; salvar(); som('compra'); sfx('vitoria'); mostrar(id); return true; }
  if (a === 'des') { if (emUso(it.id)) return true; S.moedas += valorDesmontar(it); E.itens.splice(E.itens.indexOf(it), 1); salvar(); som('moedas'); mostrar(); return true; }
  return false;
}
