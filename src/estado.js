// Lógica da Guilda (sem gráficos): economia, heróis, missões, fama, objetivos e save.
// O tempo das missões e o ganho offline usam o relógio real (Date.now).
import { visualAleatorio } from './aparencia.js';
import { gerarItem, precoItem, atributosEquip, BAUS, custoBau, GEMAS_BAU, sortearRaridade } from './itens.js';
import { EDIFICIOS, EF, custoEd, CLASSES, RARIDADES, chancesRecrutar, xpHeroi, custoTreinar, custoRecrutar, GEMAS_RECRUTAR, nomeAleatorio,
  REGIOES, missao, chanceSucesso, xpFama, OBJETIVOS, gemasObjetivo, OFFLINE_MAX, xpSistema, PONTOS_NIVEL, rankDe,
  RANK_REGIAO, rankIdx, TITULOS, RANKING, rankPoder, MAX_QUADRO, GEMAS_TROCAR, MAX_ORDENS, ORDEM_SEG, GEMAS_ORDENS, AUTO_MULT, GUILDAS, predioGuilda } from './dados.js';

const SAVE = 'coroa_guilda_v1';
export let S = null;
export const fila = [];
const ev = (tipo, d = {}) => fila.push({ tipo, ...d });
let seq = 1;
const uid = () => Date.now().toString(36) + (seq++).toString(36);

function novoHeroi(cls, rar, usados = S ? S.herois.map(h => h.nome) : []) {
  return { id: uid(), nome: nomeAleatorio(usados), cls, rar, nivel: 1, xp: 0, estado: 'livre', ate: 0, visual: visualAleatorio(cls) };
}
export function novo(agora = Date.now()) {
  S = {
    v: 1, ouro: 30, gemas: 30, fama: { nivel: 1, xp: 0 },
    ed: Object.fromEntries(Object.keys(EDIFICIOS).map(k => [k, k === 'quadro' ? 1 : 0])), guilda: null, g2: true,
    herois: [], missoes: [], regiao: 0, chefes: {},
    st: { missoes: 0, recrutados: 2, ouroTotal: 0, lendarios: 0, falhas: 0 }, obj: {}, ultimo: agora, gratisEm: agora, etapa: 0, revelado: [], novos: {},
  };
  S.herois.push(novoHeroi('cav', 0, [])); S.lider = S.herois[0].id;
  return S;
}
export function carregar() { try { const s = JSON.parse(localStorage.getItem(SAVE)); if (s && s.v === 1) { S = s; for (const h of S.herois) if (!h.visual) h.visual = visualAleatorio(h.cls);
    // luta manual interrompida (jogo fechado no meio): libera tudo
    for (const q of S.quadro || []) delete q.emLuta;
    for (const h of S.herois) if (h.estado === 'missao' && !S.missoes.some(m => m.herois.includes(h.id))) h.estado = 'livre';
    migrarGuilda();
    return true; } } catch (e) {} return false; }
// saves de antes da Associação/guilda: os prédios e os heróis recrutados viram a sua guilda antiga
function migrarGuilda() {
  if (S.g2) return; S.g2 = true;
  const temAlgo = S.herois.length > 1 || Object.entries(S.ed).some(([k, n]) => k !== 'quadro' && n > 0);
  S.guilda = temAlgo ? { id: 'antiga', nome: S.nomeGuilda || 'Guilda dos Heróis', cor: '#c98a3a', icone: 'guilda', lema: 'A guilda onde tudo começou.', nv0: S.fama.nivel, base: somaPredios() } : null;
  for (const h of S.herois) if (h.id !== S.lider) h.membro = true;
  S.ed.quadro = Math.max(1, S.ed.quadro || 0);
  S.etapa = (S.etapa || 0) >= 14 ? 10 : S.st.missoes > 0 ? 3 : 0; // tutorial novo
  if (S.revelado) for (const k of Object.keys(EDIFICIOS)) if (!S.revelado.includes('ed:' + k)) S.revelado.push('ed:' + k);
}
export function salvar(agora = Date.now()) { if (!S) return; S.ultimo = agora; try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) {} }
export function apagar() { try { localStorage.removeItem(SAVE); } catch (e) {} }

// ---------------- números derivados ----------------
export const nivel = id => S.ed[id] || 0;
// ---------------- guilda (aliança) ----------------
export const naGuilda = () => !!S.guilda;
// nível da guilda: cresce com os prédios (libera prédios novos, como a Fama fazia)
const somaPredios = () => Object.entries(S.ed).reduce((t, [k, n]) => t + (k === 'quadro' ? 0 : n), 0);
export const nivelGuilda = () => !S.guilda ? 0 : (S.guilda.nv0 || 1) + Math.floor(Math.max(0, somaPredios() - (S.guilda.base || 0)) / 15);
export const membros = () => S.herois.filter(h => h.id !== S.lider);
// Força da guilda: bônus de XP que cresce com os membros ativos e o nível da guilda
export const forcaGuilda = () => !S.guilda ? 0 : Math.min(60, membros().length * 2 + nivelGuilda() * 2);
export function podeEntrar(g) { return !S.guilda && g.membros < 12 && poderCombate() >= g.req; }
export function entrarGuilda(id) {
  const g = GUILDAS.find(x => x.id === id); if (!g || !podeEntrar(g)) return false;
  S.guilda = { id: g.id, nome: g.nome, cor: g.cor, icone: g.icone, lema: g.lema };
  for (const k of Object.keys(EDIFICIOS)) if (k !== 'quadro') S.ed[k] = predioGuilda(g, k);
  S.guilda.nv0 = g.nv; S.guilda.base = somaPredios();
  // os outros membros (jogadores da guilda) e os heróis deles
  const usados = S.herois.map(h => h.nome); S.herois = [lider()]; S.doacoes = {};
  for (let i = 0; i < g.membros; i++) {
    const cls = Object.keys(CLASSES)[Math.floor(Math.random() * 5)], h = novoHeroi(cls, Math.random() < 0.15 ? 2 : Math.random() < 0.4 ? 1 : 0, usados);
    h.nivel = Math.max(1, Math.round(g.nv * (3 + Math.random() * 5))); h.membro = true; usados.push(h.nome);
    S.herois.push(h); S.doacoes[h.id] = Math.round(custoEd('taverna', g.nv * 3) * (1 + Math.random() * 6));
  }
  S.st.guildas = (S.st.guildas || 0) + 1; ev('guilda', { nome: g.nome }); return true;
}
export function sairGuilda() {
  if (!S.guilda) return false; S.guilda = null;
  for (const k of Object.keys(EDIFICIOS)) if (k !== 'quadro') S.ed[k] = 0;
  S.herois = [lider()]; S.doacoes = {}; S.missoes = S.missoes.filter(m => m.herois.every(id => heroi(id)));
  return true;
}
// ---------------- membros da guilda doam para os prédios ----------------
// (por enquanto os membros são simulados; depois serão jogadores de verdade)
let doacaoT = 60;
export function doacoesMembros(dt, agora = Date.now(), silencioso = false) {
  if (!S.guilda) return; const membros = S.herois.filter(h => h.id !== S.lider); if (!membros.length) return;
  if ((doacaoT -= dt) > 0) return; doacaoT = 600 / Math.sqrt(membros.length) * (0.6 + Math.random() * 0.8);
  const abertos = Object.keys(EDIFICIOS).filter(id => desbloqueado(id) && nivel(id) > 0).sort((a, b) => custoEd(a, nivel(a)) - custoEd(b, nivel(b))).slice(0, 3);
  if (!abertos.length) return;
  const m = membros[Math.floor(Math.random() * membros.length)], ed = abertos[Math.floor(Math.random() * abertos.length)], valor = custoEd(ed, nivel(ed));
  S.ed[ed] = nivel(ed) + 1; S.doacoes = S.doacoes || {}; S.doacoes[m.id] = (S.doacoes[m.id] || 0) + valor;
  if (Math.random() < 0.5) m.nivel++; // os outros jogadores também evoluem
  if (!silencioso) ev('doacao', { nome: m.nome, ed, valor });
}
export function doar(id, qtd = 1) { const antes = S.ouro, n = melhorarVarias(id, qtd); if (n) { S.doacoes = S.doacoes || {}; S.doacoes[S.lider] = (S.doacoes[S.lider] || 0) + (antes - S.ouro); } return n; }

// ---------------- equipamento e mochila do líder ----------------
export const MOCHILA_MAX = 60;
export function mochila() { if (!S.mochila) S.mochila = []; if (!S.equip) S.equip = {}; return S.mochila; }
export const atrEquip = () => atributosEquip(S.equip);
export function guardarItem(it) { mochila(); if (S.mochila.length >= MOCHILA_MAX) { ev('aviso', { txt: 'Mochila cheia! Venda alguns itens.' }); return false; } S.mochila.push(it); return true; }
export function equipar(id) {
  mochila(); const i = S.mochila.findIndex(x => x.id === id); if (i < 0) return false;
  const it = S.mochila[i], velho = S.equip[it.slot]; S.mochila.splice(i, 1); if (velho) S.mochila.push(velho); S.equip[it.slot] = it;
  aplicarVisualEquip(); return true;
}
export function desequipar(slot) { mochila(); const it = S.equip[slot]; if (!it || S.mochila.length >= MOCHILA_MAX) return false; delete S.equip[slot]; S.mochila.push(it); aplicarVisualEquip(); return true; }
export function venderItem(id) { mochila(); const i = S.mochila.findIndex(x => x.id === id); if (i < 0) return 0; const v = precoItem(S.mochila[i]); S.mochila.splice(i, 1); ganharOuro(v); return v; }
// o que está equipado aparece no boneco do líder
const PARTE_EQUIP = { arma: 'arma', elmo: 'cha', armadura: 'tro', luvas: 'bra', botas: 'per', capa: 'capa', escudo: 'esq' };
export function aplicarVisualEquip() { const l = heroi(S.lider); if (!l) return; for (const [slot, k] of Object.entries(PARTE_EQUIP)) if (S.equip[slot]?.visual) l.visual[k] = S.equip[slot].visual; }
export const novoItem = gerarItem;
export const precoBau = () => custoBau(S.st.baus || 0);
// baús de itens (como o recrutamento, mas para o seu herói)
export function abrirBau(tipo, agora = Date.now()) {
  mochila(); if (S.mochila.length >= MOCHILA_MAX) { ev('aviso', { txt: 'Mochila cheia! Venda alguns itens.' }); return null; }
  if (tipo === 'gratis') { if (agora < S.gratisEm) return null; S.gratisEm = agora + 4 * 3600e3; }
  else if (tipo === 'gemas') { if (S.gemas < GEMAS_BAU) return null; S.gemas -= GEMAS_BAU; }
  else { const c = precoBau(); if (S.ouro < c) return null; S.ouro -= c; }
  const b = BAUS[tipo]; let rar = sortearRaridade(b.bonus); if (rar < b.min) rar = b.min;
  const it = gerarItem(Math.max(1, sis().nivel), rar); S.mochila.push(it); S.st.baus = (S.st.baus || 0) + 1; return it;
}

// ---------------- Sistema do líder ----------------
export function sis() { if (!S.sis) S.sis = { nivel: 1, xp: 0, pontos: 0, a: { for: 0, agi: 0, vit: 0, int: 0 } }; return S.sis; }
// bônus da guilda vindos do líder: agora os atributos valem só para o herói (ver statsHeroi)
export const bonus = () => ({ poder: 1, tempo: 1, ferir: 1, ouro: 1 });
// atributos de luta do herói principal (nível do Sistema + pontos + equipamento)
export function statsHeroi() {
  const s = sis(), a = s.a, q = atributosEquip(S.equip), n = s.nivel;
  return { dano: 18 * 1.09 ** (n - 1) * (1 + a.for * 0.03) * (1 + q.atk / 100), vida: Math.round(140 * 1.08 ** (n - 1) + a.vit * 12 + q.vida),
    crit: 0.1 + a.agi * 0.003 + q.crit / 100, vel: Math.min(0.5, a.agi * 0.012 + q.vel / 100), def: Math.min(0.7, a.vit * 0.004 + q.def / 100),
    hab: 1 + a.int * 0.04, recarga: 1 - Math.min(0.4, a.int * 0.01) };
}
export function ganharXPSis(v) {
  const s = sis(); s.xp += v * (1 + forcaGuilda() / 100);
  while (s.xp >= xpSistema(s.nivel)) {
    s.xp -= xpSistema(s.nivel); const rAntes = rankDe(s.nivel)[1]; s.nivel++; s.pontos += PONTOS_NIVEL;
    const r = rankDe(s.nivel); ev('sistema', { nivel: s.nivel, rank: r[1] !== rAntes ? r : null });
  }
}
export function distribuir(at, n = 1) { const s = sis(); n = Math.min(n, s.pontos); if (n <= 0) return 0; s.pontos -= n; s.a[at] += n; return n; }
export const lider = () => heroi(S.lider) || S.herois[0];
export const poderCombate = () => { const h = lider(); return h ? Math.round(poder(h) * 10) : 0; };
export const renda = () => EF.taverna(nivel('taverna')) * EF.mercado(nivel('mercado')) * bonus().ouro;
export const capacidade = () => EF.alojamento(nivel('alojamento'));
export const vagasMissao = () => EF.quadro(nivel('quadro')).vagas;
export function poder(h, r = null) {
  const c = CLASSES[h.cls];
  let p = c.poder * RARIDADES[h.rar].mult * 1.1 ** (h.nivel - 1) * EF.forja(nivel('forja')) * bonus().poder;
  if (h.id === S.lider) { const a = sis().a; p *= 1.06 ** (sis().nivel - 1) * (1 + (a.for * 3 + a.agi * 1.2 + a.vit + a.int * 2) / 100); const q = atributosEquip(S.equip); p *= 1 + (q.atk + q.crit + q.def) / 100 + q.vida / 2000; } // o líder cresce com o Sistema e o equipamento
  if (r != null && REGIOES[r].afin === h.cls) p *= 1.25;
  return p;
}
export const poderEquipe = (ids, r) => ids.reduce((s, id) => { const h = heroi(id); return s + (h ? poder(h, r) : 0); }, 0);
export const heroi = id => S.herois.find(h => h.id === id);
export const livres = () => S.herois.filter(h => h.estado === 'livre');
export const desbloqueado = id => id === 'quadro' || (!!S.guilda && nivelGuilda() >= EDIFICIOS[id].fama);

// ---------------- ganhos ----------------
function ganharOuro(v) { S.ouro += v; S.st.ouroTotal += v; }
function ganharFama(v) {
  S.fama.xp += v;
  while (S.fama.xp >= xpFama(S.fama.nivel)) {
    S.fama.xp -= xpFama(S.fama.nivel); S.fama.nivel++; const g = 2 + S.fama.nivel; S.gemas += g;
    const novos = [];
    ev('fama', { nivel: S.fama.nivel, gemas: g, novos });
  }
}
function ganharXP(h, v) {
  h.xp += v; let subiu = false;
  while (h.xp >= xpHeroi(h.nivel)) { h.xp -= xpHeroi(h.nivel); h.nivel++; subiu = true; }
  if (subiu) ev('heroiNivel', { id: h.id });
}

// ---------------- ações ----------------
export function melhorar(id) {
  if (id === 'quadro' || !desbloqueado(id)) return false;
  const c = custoEd(id, nivel(id)); if (S.ouro < c) return false;
  S.ouro -= c; S.ed[id] = nivel(id) + 1; ganharFama(1 + Math.floor(S.ed[id] / 10));
  ganharXPSis(2 + Math.floor(S.ed[id] / 5)); ev('melhorou', { id, nivel: S.ed[id] }); return true;
}
// compra várias vezes seguidas (x10, máx.)
export function melhorarVarias(id, qtd) { let n = 0; while (n < qtd && melhorar(id)) n++; return n; }
export function quantasPode(id, max = 1000) { let n = nivel(id), o = S.ouro, k = 0; while (k < max && o >= custoEd(id, n)) { o -= custoEd(id, n); n++; k++; } return k; }
export function custoVarias(id, qtd) { let n = nivel(id), t = 0; for (let k = 0; k < qtd; k++) t += custoEd(id, n + k); return t; }

export function recrutar(premium = false, gratis = false, agora = Date.now()) {
  if (S.herois.length >= capacidade()) { ev('aviso', { txt: 'Alojamento cheio! Melhore o Alojamento.' }); return null; }
  if (gratis) { if (agora < S.gratisEm) return null; S.gratisEm = agora + 4 * 3600e3; }
  else if (premium) { if (S.gemas < GEMAS_RECRUTAR) return null; S.gemas -= GEMAS_RECRUTAR; }
  else { const c = custoRecrutar(S.st.recrutados); if (S.ouro < c) return null; S.ouro -= c; }
  const ch = chancesRecrutar(nivel('portal'), premium); let x = Math.random(), rar = 0;
  for (let i = 3; i >= 0; i--) { if (x < ch[i]) { rar = i; break; } x -= ch[i]; }
  const cls = Object.keys(CLASSES)[Math.floor(Math.random() * 5)];
  const h = novoHeroi(cls, rar); h.nivel = Math.max(1, Math.floor(S.fama.nivel / 2));
  S.herois.push(h); S.st.recrutados++; if (rar === 3) S.st.lendarios++;
  ev('recrutou', { id: h.id }); return h;
}
// ---------------- Ascensão de rank (prova para subir de rank: poder + pontos de treino) ----------------
export const metaAsc = i => Math.round(60 * 2 ** (i - 1)); // pontos de treino para subir para o rank i
export function rankOficial() { if (S.rankOf == null) S.rankOf = S.rankMax ?? rankPoder(poderCombate()).i; return S.rankOf; }
// mesmo formato do rankPoder, mas preso ao rank oficial (o poder mostra só o progresso até o próximo)
export function infoRank() { const i = rankOficial(), ini = RANKING[i][0], fim = RANKING[i + 1]?.[0] ?? Infinity; return { ...rankPoder(Math.max(ini, Math.min(poderCombate(), fim - 1))), i, letra: RANKING[i][1], cor: RANKING[i][2], titulo: RANKING[i][3] }; }
const asc = () => { if (!S.asc) S.asc = { pts: 0 }; if (S.pergaminhos == null) S.pergaminhos = 0; return S.asc; };
export const ptsAsc = () => asc().pts + ptsTreinoAgora();
export const elegivel = () => rankOficial() < RANKING.length - 1 && poderCombate() >= RANKING[rankOficial() + 1][0];
export const podeAscender = () => elegivel() && ptsAsc() >= metaAsc(rankOficial() + 1);
export function ascender() {
  if (!podeAscender()) return false; coletarTreino(); const a = asc(), i = rankOficial() + 1;
  a.pts = Math.max(0, a.pts - metaAsc(i)); S.rankOf = i; S.rankMax = Math.max(S.rankMax || 0, i); const g = 10 * i; S.gemas += g;
  ev('ascensao', { i, gemas: g }); return true;
}
// treino por tempo (como o treino offline do Tibia): o herói fica no Campo de Treino e junta pontos
export const taxaTreino = () => 1 + 0.15 * nivel('treino'); // pontos por minuto
export const OPCOES_TREINO = [30, 120, 480];
export function iniciarTreino(min, agora = Date.now()) {
  const l = lider(); if (!l || l.estado !== 'livre' || S.treino) return false; asc();
  S.treino = { inicio: agora, fim: agora + min * 60e3 }; l.estado = 'treino'; S.st.treinos = (S.st.treinos || 0) + 1; return true;
}
function ptsTreinoAgora(agora = Date.now()) { const t = S.treino; return t ? Math.floor((Math.min(agora, t.fim) - t.inicio) / 60e3 * taxaTreino()) : 0; }
export function coletarTreino(agora = Date.now()) {
  if (!S.treino) return 0; const n = ptsTreinoAgora(agora); asc().pts += n; S.treino = null;
  const l = lider(); if (l && l.estado === 'treino') l.estado = 'livre'; if (n) ev('treino', { n }); return n;
}
export const valorPergaminho = () => Math.max(10, Math.round(metaAsc(rankOficial() + 1) * 0.15));
export function usarPergaminho() { asc(); if (!S.pergaminhos) return 0; S.pergaminhos--; const v = valorPergaminho(); S.asc.pts += v; return v; }
export function ganharPergaminho(n = 1) { asc(); S.pergaminhos += n; ev('pergaminho', { n }); }
// ---------------- morte no mundo aberto (como no Tibia) e a Bênção que protege ----------------
export const precoBencao = () => Math.round(80 * sis().nivel ** 1.5);
export function comprarBencao() { const c = precoBencao(); if (S.bencao || S.ouro < c) return false; S.ouro -= c; S.bencao = true; return true; }
export function penalidadeMorte() {
  if (S.bencao) { S.bencao = false; return { protegido: true }; }
  const ouro = Math.floor(S.ouro * 0.1), s = sis(), xp = Math.floor(s.xp * 0.3); S.ouro -= ouro; s.xp -= xp; S.st.mortes = (S.st.mortes || 0) + 1;
  return { ouro, xp };
}
export function treinar(id) {
  const h = heroi(id); if (!h || h.id !== S.lider) return false; const c = custoTreinar(h); if (S.ouro < c) return false;
  S.ouro -= c; h.nivel++; h.xp = 0; S.st.treinos = (S.st.treinos || 0) + 1; ev('heroiNivel', { id }); return true;
}
export function aposentar(id) {
  const h = heroi(id); if (!h || h.estado === 'missao' || S.herois.length <= 1 || h.id === S.lider) return 0;
  const v = Math.ceil(custoRecrutar(Math.max(0, S.st.recrutados - 3)) * 0.3 * (1 + h.rar));
  S.herois = S.herois.filter(x => x !== h); ganharOuro(v); return v;
}

// missões
export function disponiveis() { const l = []; for (let r = 0; r <= S.regiao && r < REGIOES.length; r++) for (let t = 0; t < 4; t++) if (t < 3 || !S.chefes[r]) l.push(missao(r, t)); return l; }
export function melhorEquipe(r, t) {
  const m = missao(r, t), l = livres().sort((a, b) => poder(b, r) - poder(a, r)), eq = [];
  for (const h of l) { if (eq.length >= m.max) break; eq.push(h.id); if (poderEquipe(eq, r) >= m.req) break; }
  return eq;
}
// ---------------- quadro de missões ----------------
const sorteio = l => l[Math.floor(Math.random() * l.length)];
function gerarPapel(agora, rFixo = null, tFixo = null) {
  const top = Math.min(S.regiao, REGIOES.length - 1);
  const r = rFixo ?? (Math.random() < 0.6 ? top : Math.floor(Math.random() * (top + 1)));
  const x = Math.random(), t = tFixo ?? (x < 0.45 ? 0 : x < 0.8 ? 1 : 2), reg = REGIOES[r];
  const nome = sorteio(TITULOS[t]).replace('{reg}', reg.nome).replace('{ini}', sorteio(reg.ini)).replace('{chefe}', reg.chefe);
  return { id: uid(), r, t, rank: RANK_REGIAO[r], nome, mult: t === 3 ? 1 : +(0.8 + Math.random() * 0.8).toFixed(2), ate: t === 3 ? 0 : agora + (25 + Math.random() * 50) * 60e3,
    dx: Math.random() * 10 - 5, dy: Math.random() * 8 - 4, gira: +(Math.random() * 5 - 2.5).toFixed(1) };
}
export function atualizarQuadro(agora = Date.now()) {
  if (!S.quadro) { S.quadro = [gerarPapel(agora, 0, 0), gerarPapel(agora, 0, 0), gerarPapel(agora, 0, 1)]; S.quadroT = agora + 90e3; }
  S.quadro = S.quadro.filter(q => (!q.ate || q.ate > agora) && !(q.t === 3 && S.chefes[q.r]));
  // cartaz de PROCURADO para cada chefe ainda vivo (se ninguém foi atrás dele)
  for (let r = 0; r <= Math.min(S.regiao, REGIOES.length - 1); r++)
    if (!S.chefes[r] && !S.quadro.some(q => q.t === 3 && q.r === r) && !S.missoes.some(m => m.t === 3 && m.r === r)) S.quadro.push(gerarPapel(agora, r, 3));
  const normais = () => S.quadro.filter(q => q.t !== 3).length;
  while (agora >= S.quadroT) { if (normais() < MAX_QUADRO(nivel('quadro'))) S.quadro.push(gerarPapel(agora)); S.quadroT += 90e3; if (agora - S.quadroT > 3600e3) S.quadroT = agora; }
}
export function trocarPapeis(agora = Date.now()) {
  if (S.gemas < GEMAS_TROCAR) return false; S.gemas -= GEMAS_TROCAR;
  const n = Math.max(3, S.quadro.filter(q => q.t !== 3).length);
  S.quadro = S.quadro.filter(q => q.t === 3); for (let i = 0; i < n; i++) S.quadro.push(gerarPapel(agora)); return true;
}
export const rankHeroi = h => h.id === S.lider ? Math.min(5, rankOficial()) : rankIdx(h.nivel);
// modo automático: heróis livres pegam sozinhos os papéis com boa chance de sucesso
let autoT = 0;
export const maxOrdens = () => MAX_ORDENS(nivel('quadro'));
export function regenOrdens(agora = Date.now()) {
  if (S.ordens == null) { S.ordens = maxOrdens(); S.ordensT = agora; }
  if (S.ordens >= maxOrdens()) { S.ordensT = agora; return; }
  while (agora - S.ordensT >= ORDEM_SEG * 1000 && S.ordens < maxOrdens()) { S.ordens++; S.ordensT += ORDEM_SEG * 1000; }
}
export function recarregarOrdens() { if (S.gemas < GEMAS_ORDENS) return false; S.gemas -= GEMAS_ORDENS; S.ordens = maxOrdens(); S.ordensT = Date.now(); return true; }
function autoMissoes(dt, agora, forcar = false) {
  if (!S.auto || (!forcar && (autoT -= dt) > 0)) return; autoT = 2;
  for (let n = 0; n < 3 && S.ordens >= 1 && S.missoes.length < vagasMissao() && livres().length; n++) {
    let melhor = null;
    for (const q of S.quadro) {
      const m = missao(q.r, q.t); let eq = melhorEquipe(q.r, q.t);
      if (!eq.some(id => rankHeroi(heroi(id)) >= q.rank)) { const cap = livres().filter(h => rankHeroi(h) >= q.rank).sort((a, b) => poder(b, q.r) - poder(a, q.r))[0]; if (!cap) continue; eq = [cap.id, ...eq.filter(x => x !== cap.id)].slice(0, m.max); }
      const ch = chanceSucesso(poderEquipe(eq, q.r), m.req); if (ch < 0.8) continue;
      const valor = m.ouro * q.mult / m.dur * (q.t === 3 ? 3 : 1);
      if (!melhor || valor > melhor.valor) melhor = { q, eq, valor };
    }
    const ms = melhor && pegar(melhor.q.id, melhor.eq, agora); if (!ms) break;
    ms.mult *= AUTO_MULT; ms.auto = true; S.ordens--;
  }
}
// pega um papel do quadro: precisa de ao menos um herói com o rank exigido
export function pegar(qid, ids, agora = Date.now()) {
  const q = S.quadro.find(x => x.id === qid); if (!q) return null;
  if (!ids.some(id => heroi(id) && rankHeroi(heroi(id)) >= q.rank)) { ev('aviso', { txt: 'A equipe precisa de um herói com o rank exigido.' }); return null; }
  const ms = enviar(q.r, q.t, ids, agora, q); if (ms) S.quadro = S.quadro.filter(x => x !== q); return ms;
}
export function enviar(r, t, ids, agora = Date.now(), q = null) {
  if (S.missoes.length >= vagasMissao()) { ev('aviso', { txt: 'Sem vagas no Quadro de Missões.' }); return null; }
  if (r > S.regiao || (t === 3 && S.chefes[r])) return null;
  const m = missao(r, t); ids = ids.filter(id => heroi(id)?.estado === 'livre').slice(0, m.max); if (!ids.length) return null;
  const dur = m.dur * EF.biblioteca(nivel('biblioteca')) * bonus().tempo;
  const ms = { uid: uid(), r, t, herois: ids, inicio: agora, fim: agora + dur * 1000, chance: chanceSucesso(poderEquipe(ids, r), m.req), nome: q?.nome, mult: q?.mult || 1, dx: q?.dx || 0, dy: q?.dy || 0 };
  ms.ok = Math.random() < ms.chance; // o resultado já é sorteado (o mapa mostra a luta)
  for (const id of ids) heroi(id).estado = 'missao';
  S.missoes.push(ms); ev('enviou', { m: ms }); return ms;
}
export const custoAcelerar = (ms, agora = Date.now()) => Math.max(1, Math.ceil((ms.fim - agora) / 60000));
export function acelerar(uidM, agora = Date.now()) {
  const ms = S.missoes.find(x => x.uid === uidM); if (!ms) return false; const c = custoAcelerar(ms, agora);
  if (S.gemas < c) return false; S.gemas -= c; ms.fim = agora; return true;
}
// missão feita no modo manual: ok = venceu a luta (recompensa 25% maior)
export function concluirManual(qid, ids, ok, agora = Date.now()) {
  const q = S.quadro.find(x => x.id === qid); if (!q) return null; delete q.emLuta;
  const ms = { uid: uid(), r: q.r, t: q.t, herois: ids, inicio: agora, fim: agora, chance: 1, nome: q.nome, mult: q.mult * 1.25, ok, manual: true };
  for (const id of ids) { const h = heroi(id); if (h) h.estado = 'missao'; }
  S.missoes.push(ms); if (ok) S.quadro = S.quadro.filter(x => x !== q);
  return concluir(ms, agora, false);
}
function concluir(ms, agora, silencioso) {
  const m = { ...missao(ms.r, ms.t), nome: ms.nome || missao(ms.r, ms.t).nome }, ok = ms.ok ?? Math.random() < ms.chance, res = { m, ok, ouro: 0, gemas: 0, xp: 0, herois: ms.herois, feridos: [], desbloqueou: null };
  const hs = ms.herois.map(heroi).filter(Boolean);
  if (ok) {
    res.ouro = Math.round(m.ouro * EF.quadro(nivel('quadro')).bonus * EF.mercado(nivel('mercado')) * bonus().ouro * (ms.mult || 1)); ganharOuro(res.ouro);
    ganharXPSis(m.xp * (ms.herois.includes(S.lider) ? 1.2 : 0.5));
    res.xp = Math.round(m.xp * (ms.mult || 1)); for (const h of hs) ganharXP(h, res.xp);
    ganharFama(m.fama); S.st.missoes++; if (Math.random() < 0.1) { ganharPergaminho(); res.pergaminho = true; }
    if (Math.random() < m.bau) { res.gemas = 1 + Math.floor(Math.random() * (2 + ms.r)); S.gemas += res.gemas; const extra = Math.round(renda() * 60); res.ouro += extra; ganharOuro(extra); res.bau = true; }
    if (m.chefe) { S.chefes[ms.r] = true; if (S.regiao < REGIOES.length - 1 && S.regiao === ms.r) { S.regiao++; res.desbloqueou = S.regiao; } }
  } else {
    S.st.falhas++; res.xp = Math.round(m.xp * 0.3); const enf = EF.enfermaria(nivel('enfermaria'));
    for (const h of hs) { ganharXP(h, res.xp); if (Math.random() < enf.chance * bonus().ferir) { h.estado = 'ferido'; h.ate = agora + m.dur * 0.6 * enf.tempo * 1000; res.feridos.push(h.id); } }
  }
  for (const h of hs) if (h.estado === 'missao') h.estado = 'livre';
  S.missoes = S.missoes.filter(x => x !== ms);
  ev('resultado', { res, silencioso });
  return res;
}

// objetivos
export function progressoObj(id) {
  switch (id) {
    case 'missoes': return S.st.missoes; case 'recrutados': return S.st.recrutados; case 'taverna': return nivel('taverna');
    case 'ouroTotal': return S.st.ouroTotal; case 'regioes': return Object.keys(S.chefes).length;
    case 'nivelHeroi': return Math.max(0, ...S.herois.map(h => h.nivel)); case 'lendarios': return S.st.lendarios;
  }
  return 0;
}
export function objetivoAtual(o) { const i = S.obj[o.id] || 0; return i < o.metas.length ? { i, meta: o.metas[i], feito: progressoObj(o.id) >= o.metas[i], gemas: gemasObjetivo(i) } : null; }
export function coletarObjetivo(id) { const o = OBJETIVOS.find(x => x.id === id), a = objetivoAtual(o); if (!a || !a.feito) return 0; S.obj[id] = a.i + 1; S.gemas += a.gemas; ganharXPSis(15 * (a.i + 1)); return a.gemas; }
export const objetivosProntos = () => OBJETIVOS.filter(o => objetivoAtual(o)?.feito).length;

// ---------------- tempo ----------------
export function passo(dt, agora = Date.now()) {
  S.ed.quadro = Math.min(40, 1 + Math.floor(sis().nivel / 2)); // licença na Associação acompanha o seu nível
  { const l = lider(); if (l) l.nivel = sis().nivel; } if (S.treino && agora >= S.treino.fim) coletarTreino(agora);
  atualizarQuadro(agora); regenOrdens(agora); autoMissoes(dt, agora); doacoesMembros(dt, agora);
  ganharOuro(renda() * dt);
  const xps = EF.treino(nivel('treino')) * dt; if (xps > 0) { for (const h of S.herois) if (h.estado === 'livre') ganharXP(h, xps); ganharXPSis(xps * 0.15); }
  for (const h of S.herois) if (h.estado === 'ferido' && agora >= h.ate) { h.estado = 'livre'; ev('curado', { id: h.id }); }
  for (const ms of [...S.missoes]) if (agora >= ms.fim) concluir(ms, agora, false);
}
// o que aconteceu enquanto o jogo estava fechado
export function offline(agora = Date.now()) {
  const seg = Math.min(OFFLINE_MAX, Math.max(0, (agora - S.ultimo) / 1000));
  const antes = S.ouro, missoesAntes = S.st.missoes;
  if (seg > 5) {
    ganharOuro(renda() * seg);
    const xps = EF.treino(nivel('treino')) * seg; if (xps > 0) { for (const h of S.herois) if (h.estado === 'livre') ganharXP(h, xps); ganharXPSis(xps * 0.15); }
  }
  // o tempo passa em passos: missões terminam, ordens voltam e o modo automático continua enviando
  const ini = agora - seg * 1000, passo = Math.max(30e3, seg * 1000 / 400);
  if (S.quadroT > ini) S.quadroT = ini + 90e3; // papéis novos continuam chegando no quadro
  for (let tt = ini + passo; tt < agora; tt += passo) {
    for (const h of S.herois) if (h.estado === 'ferido' && tt >= h.ate) h.estado = 'livre';
    for (const ms of [...S.missoes]) if (tt >= ms.fim) concluir(ms, tt, true);
    atualizarQuadro(tt); regenOrdens(tt); autoMissoes(0, tt, true); doacoesMembros(passo / 1000, tt, true);
  }
  for (const h of S.herois) if (h.estado === 'ferido' && agora >= h.ate) h.estado = 'livre';
  for (const ms of [...S.missoes]) if (agora >= ms.fim) concluir(ms, agora, true);
  if (S.treino && agora >= S.treino.fim) coletarTreino(agora);
  return { seg, ouro: S.ouro - antes, missoes: S.st.missoes - missoesAntes };
}
