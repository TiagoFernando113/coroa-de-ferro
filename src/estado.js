// Lógica da Guilda (sem gráficos): economia, heróis, missões, fama, objetivos e save.
// O tempo das missões e o ganho offline usam o relógio real (Date.now).
import { visualAleatorio } from './aparencia.js';
import { gerarItem, precoItem, atributosEquip } from './itens.js';
import { EDIFICIOS, EF, custoEd, CLASSES, RARIDADES, chancesRecrutar, xpHeroi, custoTreinar, custoRecrutar, GEMAS_RECRUTAR, nomeAleatorio,
  REGIOES, missao, chanceSucesso, xpFama, OBJETIVOS, gemasObjetivo, OFFLINE_MAX, xpSistema, PONTOS_NIVEL, rankDe,
  RANK_REGIAO, rankIdx, TITULOS, MAX_QUADRO, GEMAS_TROCAR, MAX_ORDENS, ORDEM_SEG, GEMAS_ORDENS, AUTO_MULT } from './dados.js';

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
    ed: Object.fromEntries(Object.keys(EDIFICIOS).map(k => [k, k === 'taverna' ? 1 : 0])),
    herois: [], missoes: [], regiao: 0, chefes: {},
    st: { missoes: 0, recrutados: 2, ouroTotal: 0, lendarios: 0, falhas: 0 }, obj: {}, ultimo: agora, gratisEm: agora, etapa: 0, revelado: [], novos: {},
  };
  S.herois.push(novoHeroi('cav', 0, [])); S.herois.push(novoHeroi('arq', 0, [S.herois[0].nome])); S.lider = S.herois[0].id;
  return S;
}
export function carregar() { try { const s = JSON.parse(localStorage.getItem(SAVE)); if (s && s.v === 1) { S = s; for (const h of S.herois) if (!h.visual) h.visual = visualAleatorio(h.cls);
    // luta manual interrompida (jogo fechado no meio): libera tudo
    for (const q of S.quadro || []) delete q.emLuta;
    for (const h of S.herois) if (h.estado === 'missao' && !S.missoes.some(m => m.herois.includes(h.id))) h.estado = 'livre';
    return true; } } catch (e) {} return false; }
export function salvar(agora = Date.now()) { if (!S) return; S.ultimo = agora; try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) {} }
export function apagar() { try { localStorage.removeItem(SAVE); } catch (e) {} }

// ---------------- números derivados ----------------
export const nivel = id => S.ed[id] || 0;
// ---------------- equipamento e mochila do líder ----------------
export const MOCHILA_MAX = 30;
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
// a arma e o elmo equipados aparecem no boneco do líder
export function aplicarVisualEquip() { const l = heroi(S.lider); if (!l) return; if (S.equip.arma?.visual) l.visual.arma = S.equip.arma.visual; if (S.equip.elmo?.visual) l.visual.cha = S.equip.elmo.visual; }
export const novoItem = gerarItem;

// ---------------- Sistema do líder ----------------
export function sis() { if (!S.sis) S.sis = { nivel: 1, xp: 0, pontos: 0, a: { for: 0, agi: 0, vit: 0, int: 0 } }; return S.sis; }
export const bonus = () => { const a = sis().a; return { poder: 1 + 0.02 * a.for, tempo: Math.max(0.5, 1 - 0.01 * a.agi), ferir: Math.max(0.3, 1 - 0.02 * a.vit), ouro: 1 + 0.02 * a.int }; };
export function ganharXPSis(v) {
  const s = sis(); s.xp += v;
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
  if (h.id === S.lider) { p *= 1.06 ** (sis().nivel - 1); const q = atributosEquip(S.equip); p *= 1 + (q.atk + q.crit + q.def) / 100 + q.vida / 2000; } // o líder cresce com o Sistema e o equipamento
  if (r != null && REGIOES[r].afin === h.cls) p *= 1.25;
  return p;
}
export const poderEquipe = (ids, r) => ids.reduce((s, id) => { const h = heroi(id); return s + (h ? poder(h, r) : 0); }, 0);
export const heroi = id => S.herois.find(h => h.id === id);
export const livres = () => S.herois.filter(h => h.estado === 'livre');
export const desbloqueado = id => S.fama.nivel >= EDIFICIOS[id].fama;

// ---------------- ganhos ----------------
function ganharOuro(v) { S.ouro += v; S.st.ouroTotal += v; }
function ganharFama(v) {
  S.fama.xp += v;
  while (S.fama.xp >= xpFama(S.fama.nivel)) {
    S.fama.xp -= xpFama(S.fama.nivel); S.fama.nivel++; const g = 2 + S.fama.nivel; S.gemas += g;
    const novos = Object.entries(EDIFICIOS).filter(([, e]) => e.fama === S.fama.nivel).map(([k]) => k);
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
  if (!desbloqueado(id)) return false;
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
export function treinar(id) {
  const h = heroi(id); if (!h) return false; const c = custoTreinar(h); if (S.ouro < c) return false;
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
export const rankHeroi = h => rankIdx(h.nivel);
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
    ganharFama(m.fama); S.st.missoes++;
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
  atualizarQuadro(agora); regenOrdens(agora); autoMissoes(dt, agora);
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
    atualizarQuadro(tt); regenOrdens(tt); autoMissoes(0, tt, true);
  }
  for (const h of S.herois) if (h.estado === 'ferido' && agora >= h.ate) h.estado = 'livre';
  for (const ms of [...S.missoes]) if (agora >= ms.fim) concluir(ms, agora, true);
  return { seg, ouro: S.ouro - antes, missoes: S.st.missoes - missoesAntes };
}
