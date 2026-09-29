// Interface da Guilda: barra de recursos, abas, painéis, janelas, dicas, rótulos 3D, sons e controles da câmera.
import * as C from './cena.js';
import * as E from './estado.js';
import { S } from './estado.js';
import { ICONES } from './icones.js';
import { EDIFICIOS, EF, custoEd, descEfeito, proxMarco, marcosAte, CLASSES, RARIDADES, chancesRecrutar, xpHeroi, custoTreinar, custoRecrutar, GEMAS_RECRUTAR,
  REGIOES, missao, reqRegiao, chanceSucesso, xpFama, OBJETIVOS, fmt, fmtTempo, ATRIBUTOS, xpSistema, rankDe, RANKS, RANKING, rankPoder, RANK_REGIAO, LETRAS, GEMAS_TROCAR, ORDEM_SEG, GEMAS_ORDENS } from './dados.js';
import { POS, atualizarPredio, revestir } from './base.js';
import { abrirCriador } from './criador.js';
import { MUNDO, GUILDA_W, mostrarMundo, mundoVisivel, camposVisiveis } from './mundo.js';
import { iniciarLuta } from './luta.js';
import { RARIDADE_ITEM, ESPACOS, ATR_ITEM, textoAtr, precoItem, atributosEquip } from './itens.js';
import { ETAPAS, avancar, etapaAtual, revelado, visivel, livre, proximoTrancado } from './etapas.js';

const $ = s => document.querySelector(s);
export const ico = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 512 512" aria-hidden="true">${ICONES[n] || ''}</svg>`;
export const ui = { aba: null, foco: { x: 0, z: 0 }, qualidade: 'media' };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------- sons ----------------
let actx = null, sons = {}, mudo = false;
try { mudo = localStorage.getItem('guilda_mudo') === '1'; } catch (e) {}
export async function carregarRecursos(buf) {
  const tam = new DataView(buf).getUint32(0, true), cab = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, tam))), base = 4 + tam;
  const pedaco = ([i, l]) => buf.slice(base + i, base + i + l);
  for (const [k, pos] of Object.entries(cab)) if (k.startsWith('fonte:')) {
    const f = new FontFace(k === 'fonte:titulo' ? 'Titulo' : 'Texto', pedaco(pos)); await f.load(); document.fonts.add(f);
  }
  const iniciarAudio = () => {
    if (actx) return; actx = new (window.AudioContext || window.webkitAudioContext)();
    for (const [k, pos] of Object.entries(cab)) if (!k.startsWith('fonte:')) actx.decodeAudioData(pedaco(pos)).then(b => { sons[k] = b; }).catch(() => {});
  };
  addEventListener('pointerdown', iniciarAudio, { once: true });
}
export function som(n, vol = 0.6) {
  if (mudo || !actx || !sons[n]) return;
  const s = actx.createBufferSource(), g = actx.createGain(); g.gain.value = vol; s.buffer = sons[n]; s.connect(g).connect(actx.destination); s.start();
}

// ---------------- montagem ----------------
export function montar() {
  $('#hud').innerHTML = `
    <div id="topo">
      <div class="pilula ouro">${ico('ouro')}<b id="vOuro"></b><small id="vRenda"></small></div>
      <div class="pilula gema" id="pGema">${ico('gema')}<b id="vGema"></b></div>
      <button id="bFama" class="fama"><i id="anelFama"></i>${ico('fama')}<b id="vFama"></b></button>
      <button id="bConfig" class="redondo">${ico('config')}</button>
    </div>
    <div id="ativas"></div>
    <div id="dica" hidden></div>
    <div id="rotulos"></div><div id="rotulosMundo" hidden></div>
    <button id="bMundo" class="bMundo">${ico('missoes')}<span>Mundo</span></button>
    <nav id="nav">
      ${[['guilda', 'Guilda'], ['herois', 'Herói'], ['missoes', 'Missões'], ['recrutar', 'Convidar'], ['objetivos', 'Objetivos']].map(([k, t]) => `<button data-aba="${k}">${ico(k)}<span>${t}</span><em class="selo" hidden></em></button>`).join('')}
    </nav>
    <section id="folha" hidden><header><div id="fIco"></div><h2 id="fTit"></h2><button class="xis" data-fechar>${ico('fechar')}</button></header><div id="fCorpo"></div></section>
    <div id="modal" hidden></div>
    <div id="avisos"></div>
    <div id="flutua"></div>
    <div id="guia" hidden>${ico('mao')}</div>`;
  $('#nav').onclick = e => { const b = e.target.closest('[data-aba]'); if (b) { som('clique'); abrirAba(b.dataset.aba === ui.aba ? null : b.dataset.aba); } };
  $('#folha').addEventListener('click', e => { if (e.target.closest('[data-fechar]')) { som('fechar'); abrirAba(null); } });
  $('#bConfig').onclick = () => { som('clique'); configuracoes(); };
  $('#bFama').onclick = () => { som('clique'); janelaFama(); };
  $('#ativas').onclick = () => { som('clique'); if (!mundoVisivel()) irMundo(true); };
  $('#bMundo').onclick = () => { som('abrir'); irMundo(!mundoVisivel()); };
  $('#rotulosMundo').onclick = e => { const b = e.target.closest('[data-q]'); if (b) { som('abrir'); escolherEquipe(b.dataset.q); } };
  // rótulos dos prédios
  $('#rotulos').innerHTML = Object.keys(EDIFICIOS).map(id => `<button class="rotulo" data-ed="${id}"><span class="rIco" style="--c:${EDIFICIOS[id].cor}">${ico(EDIFICIOS[id].icone)}</span><b></b><i class="seta">${ico('xp')}</i></button>`).join('');
  $('#rotulos').onclick = e => { const b = e.target.closest('[data-ed]'); if (b) { som('abrir'); abrirPredio(b.dataset.ed); } };
  controles();
}

// ---------------- controles da câmera (arrastar, pinça, toque) ----------------
function controles() {
  const area = $('#toque'), dedos = new Map(); let arrastou = false, pinca = 0, ini = null;
  area.addEventListener('pointerdown', e => { area.setPointerCapture(e.pointerId); dedos.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (dedos.size === 1) { arrastou = false; ini = { x: e.clientX, y: e.clientY }; } pinca = 0; });
  area.addEventListener('pointermove', e => {
    const d = dedos.get(e.pointerId); if (!d) return;
    if (dedos.size === 2) {
      const [a, b] = [...dedos.values()], antes = Math.hypot(a.x - b.x, a.y - b.y); d.x = e.clientX; d.y = e.clientY;
      const [a2, b2] = [...dedos.values()], agora = Math.hypot(a2.x - b2.x, a2.y - b2.y);
      if (pinca) C.camera.dist = Math.max(22, Math.min(mundoVisivel() ? 160 : 100, C.camera.dist * antes / agora)); pinca = 1; arrastou = true; return;
    }
    const p0 = C.chaoEm(d.x, d.y), p1 = C.chaoEm(e.clientX, e.clientY);
    if (Math.hypot(e.clientX - ini.x, e.clientY - ini.y) > 8) arrastou = true;
    if (p0 && p1 && arrastou) { const m = mundoVisivel(), cx = m ? MUNDO.x : 0, cz = m ? MUNDO.z : 0, L = m ? 190 : 26; ui.foco.x = Math.max(cx - L, Math.min(cx + L, ui.foco.x + p0.x - p1.x)); ui.foco.z = Math.max(cz - L, Math.min(cz + (m ? L : 30), ui.foco.z + p0.z - p1.z)); C.camera.suave = 30; }
    d.x = e.clientX; d.y = e.clientY;
  });
  const fim = e => {
    if (dedos.size === 1 && !arrastou && !mundoVisivel()) { const id = C.tocado(e.clientX, e.clientY); if (id) { som('abrir'); abrirPredio(id); } }
    dedos.delete(e.pointerId); if (!dedos.size) C.camera.suave = 10;
  };
  area.addEventListener('pointerup', fim); area.addEventListener('pointercancel', e => dedos.delete(e.pointerId));
  area.addEventListener('wheel', e => { C.camera.dist = Math.max(22, Math.min(mundoVisivel() ? 160 : 100, C.camera.dist + e.deltaY * 0.03)); }, { passive: true });
}

// ---------------- mapa do mundo ----------------
let focoGuilda = null;
export function irMundo(sim) {
  if (sim === mundoVisivel()) return;
  mostrarMundo(sim); abrirAba(null);
  if (sim) { focoGuilda = { x: ui.foco.x, z: ui.foco.z, dist: C.camera.dist }; ui.foco = { x: GUILDA_W.x + 40, z: GUILDA_W.z - 40 }; C.camera.dist = 95; }
  else { ui.foco = { x: focoGuilda?.x || 0, z: focoGuilda?.z || 0 }; C.camera.dist = focoGuilda?.dist || 74; }
  C.camera.suave = 60; if (sim) C.neblina(160, 420); else C.neblina(70, 150);
  $('#bMundo').innerHTML = sim ? `${ico('guilda')}<span>Guilda</span>` : `${ico('missoes')}<span>Mundo</span>`;
  $('#rotulos').hidden = sim; $('#rotulosMundo').hidden = !sim;
  if (sim) aviso(`${ico('missoes')} Mapa do mundo: toque num acampamento para enviar heróis`, '', 3200);
}
function rotulosMundo() {
  if (!mundoVisivel()) return;
  const box = $('#rotulosMundo'), vivos = new Set();
  const por = (chave, x, y, z, html, cls, dataQ) => {
    vivos.add(chave); let el = box.querySelector(`[data-k="${chave}"]`);
    if (!el) { el = document.createElement(dataQ ? 'button' : 'div'); el.dataset.k = chave; el.className = cls; if (dataQ) el.dataset.q = dataQ; box.append(el); }
    if (el._h !== html) { el._h = html; el.innerHTML = html; }
    const t = C.tela(x, y, z); if (!t || t[1] < 50 || t[1] > innerHeight - 80) { el.style.display = 'none'; return; }
    el.style.display = ''; el.style.transform = `translate(${t[0]}px,${t[1]}px) translate(-50%,-100%)`;
  };
  REGIOES.forEach((r, i) => { const p = { x: MUNDO.x + (r.x - 50) * 3.4, z: MUNDO.z + (r.y - 50) * 3.4 };
    por('r' + i, p.x, 14, p.z - 12, `${i > S.regiao ? ico('cadeado') : ico(r.icone)}<b>${r.nome}</b>${selo(RANK_REGIAO[i], 'mini')}`, 'regM ' + (i > S.regiao ? 'trancado' : '')); });
  for (const [k, c] of camposVisiveis()) {
    if (c.q) { const q = c.q; por(k, c.x, c.t === 3 ? 7 : 4.5, c.z, `${selo(q.rank, 'mini')}<b>${q.t === 3 ? 'PROCURADO' : esc(q.nome)}</b>`, 'campoM ' + (q.t === 3 ? 'chefeM' : ''), q.id); }
    else { const ms = S.missoes.find(m => 'm' + m.uid === k); if (ms) por(k, c.x, 5, c.z, `${ico('poder')}<b>${fmtTempo((ms.fim - Date.now()) / 1000)}</b>`, 'campoM lutaM'); }
  }
  for (const el of [...box.children]) if (!vivos.has(el.dataset.k)) el.remove();
}

// ---------------- loot e equipamento ----------------
const cartaoItem = (it, extra = '') => { const R = RARIDADE_ITEM[it.rar]; return `<div class="item" style="--ri:${R.cor}"><span class="iIco">${ico(ESPACOS[it.slot].icone)}</span>
  <div class="cTxt"><b>${esc(it.nome)}</b><small style="color:${R.cor}">${R.nome} · ${ESPACOS[it.slot].nome} · Nv ${it.nivel}</small>
  <small>${Object.entries(it.st).map(([k, v]) => textoAtr(k, v)).join(' · ')}</small></div>${extra}</div>`; };
export function janelaLoot(itens) {
  const guardados = itens.filter(it => E.guardarItem(it));
  som(itens.some(it => it.rar >= 3) ? 'lendario' : 'moedas');
  const c = modal(`<div class="faixaTit">Loot!</div><div class="bauAberto">${ico('bau')}</div>
    <div class="lista">${guardados.map(it => cartaoItem(it, `<button class="btn verde peq" data-eq="${it.id}">Equipar</button>`)).join('')}</div>
    ${guardados.length < itens.length ? '<p class="alerta">Mochila cheia: alguns itens ficaram para trás.</p>' : ''}
    <button class="btn azul" data-ok>Guardar na mochila</button>`);
  c.onclick = e => { const b = e.target.closest('[data-eq]'); if (!b) return; e.stopPropagation(); if (E.equipar(b.dataset.eq)) { revestir(S.lider); som('espada'); b.outerHTML = `<em class="chip verde">Equipado</em>`; } };
}
let itemAberto = null;
export function janelaEquip() {
  E.mochila(); const q = atributosEquip(S.equip), l = E.lider();
  const sel = itemAberto && (S.mochila.find(x => x.id === itemAberto) || Object.values(S.equip).find(x => x?.id === itemAberto));
  const equipado = sel && S.equip[sel.slot]?.id === sel.id, atual = sel && S.equip[sel.slot];
  const cmp = sel && !equipado ? Object.keys(ATR_ITEM).map(k => { const d = (sel.st[k] || 0) - (atual?.st[k] || 0); return d ? `<span class="${d > 0 ? 'mais' : 'menos'}">${d > 0 ? '+' : ''}${d}${ATR_ITEM[k][1]} ${ATR_ITEM[k][0]}</span>` : ''; }).join('') : '';
  const c = modal(`<div class="faixaTit">Equipamento</div><p class="suave">${ico('coroa')} ${esc(l?.nome || '')} · vale nas lutas do modo manual</p>
    <div class="espacos">${Object.entries(ESPACOS).map(([k, e]) => { const it = S.equip[k], R = it && RARIDADE_ITEM[it.rar];
      return `<button class="espaco ${it ? 'cheio' : ''}" data-it="${it?.id || ''}" style="--ri:${R?.cor || '#c9c3b8'}">${ico(e.icone)}<small>${it ? esc(it.nome) : e.nome}</small></button>`; }).join('')}</div>
    <div class="totais">${Object.keys(ATR_ITEM).map(k => `<span>${ATR_ITEM[k][0]} <b>+${q[k]}${ATR_ITEM[k][1]}</b></span>`).join('')}</div>
    ${sel ? `<div class="detalhe">${cartaoItem(sel)}${cmp ? `<div class="cmp">${cmp}</div>` : ''}<div class="linha">
      ${equipado ? '<button class="btn cinza peq" data-acao="tirar">Tirar</button>' : `<button class="btn verde peq" data-acao="eq">Equipar</button><button class="btn amarelo peq" data-acao="vender">Vender ${fmt(precoItem(sel))}${ico('ouro', 'mini')}</button>`}</div></div>` : ''}
    <h4 class="mochT">Mochila ${S.mochila.length}/${E.MOCHILA_MAX}</h4>
    <div class="mochila">${S.mochila.map(it => `<button class="slotM ${it.id === itemAberto ? 'on' : ''}" data-it="${it.id}" style="--ri:${RARIDADE_ITEM[it.rar].cor}">${ico(ESPACOS[it.slot].icone)}<i>${it.nivel}</i></button>`).join('') || '<p class="suave">Vazia. Lute no modo manual para achar itens!</p>'}</div>
    <button class="btn azul" data-ok>Fechar</button>`);
  c.onclick = e => {
    const b = e.target.closest('button'); if (!b || b.dataset.ok != null) return; e.stopPropagation();
    if (b.dataset.it != null) { itemAberto = b.dataset.it || null; som('clique'); return janelaEquip(); }
    if (b.dataset.acao === 'eq' && E.equipar(sel.id)) { revestir(S.lider); som('espada'); }
    if (b.dataset.acao === 'tirar' && E.desequipar(sel.slot)) { som('clique'); }
    if (b.dataset.acao === 'vender') { const v = E.venderItem(sel.id); if (v) { som('moedas'); aviso(`${ico('ouro')} +${fmt(v)} ouro`); itemAberto = null; } }
    janelaEquip();
  };
}

// ---------------- avisos e números flutuantes ----------------
export function aviso(html, tipo = '', ms = 2800) {
  const a = document.createElement('div'); a.className = 'aviso ' + tipo; a.innerHTML = html; $('#avisos').prepend(a);
  while ($('#avisos').children.length > 4) $('#avisos').lastChild.remove();
  setTimeout(() => { a.classList.add('sai'); setTimeout(() => a.remove(), 400); }, ms);
}
const flut = [];
export function flutuar3d(x, y, z, valor) { flut.push({ x, y, z, t: 0, txt: '+' + fmt(valor) }); }
function desenharFlutuantes(dt) {
  const box = $('#flutua');
  for (let i = flut.length - 1; i >= 0; i--) { const f = flut[i]; f.t += dt; if (f.t > 1.2) { f.el?.remove(); flut.splice(i, 1); continue; }
    if (!f.el) { f.el = document.createElement('div'); f.el.className = 'num'; f.el.innerHTML = `${ico('ouro')}${f.txt}`; box.append(f.el); }
    const p = C.tela(f.x, f.y + f.t * 1.5, f.z); if (!p) { f.el.style.opacity = 0; continue; }
    f.el.style.transform = `translate(${p[0]}px,${p[1]}px) translate(-50%,-50%)`; f.el.style.opacity = Math.min(1, (1.2 - f.t) * 2);
  }
}

// ---------------- janelas (modal) ----------------
function modal(html, classe = '') {
  const m = $('#modal'); m.innerHTML = `<div class="caixa ${classe}">${html}</div>`; m.hidden = false;
  m.onclick = e => { if (e.target === m || e.target.closest('[data-ok]')) { som('fechar'); m.hidden = true; } };
  return m.firstElementChild;
}
export function novidadeCriador() {
  const forte = [...S.herois].sort((a, b) => E.poder(b) - E.poder(a))[0]; S.lider = forte.id;
  const c = modal(`<div class="faixaTit">Novidade!</div><div class="famaG">${ico('pincel')}</div><p>Agora você pode <b>personalizar seus heróis</b>: rosto, pele, corpo, roupas, armas e a cor de cada detalhe.</p>
    <button class="btn verde grande" data-cria>Criar meu herói</button><button class="btn cinza peq" data-ok>Depois</button>`);
  c.querySelector('[data-cria]').onclick = () => { $('#modal').hidden = true; abrirCriador(forte.id, { aoFechar: () => revestir(forte.id) }); };
}
export function boasVindas(off) {
  const partes = [];
  if (off.ouro > 0) partes.push(`<div class="ganho">${ico('ouro')}<b>+${fmt(off.ouro)}</b><span>ouro da taverna</span></div>`);
  if (off.missoes > 0) partes.push(`<div class="ganho">${ico('missoes')}<b>${off.missoes}</b><span>missões concluídas</span></div>`);
  if (!partes.length) return;
  modal(`<div class="faixaTit">Bem-vindo de volta!</div><p class="suave">Enquanto você estava fora (${fmtTempo(off.seg)}):</p>${partes.join('')}<button class="btn verde grande" data-ok>Coletar</button>`, 'volta');
  som('moedas');
}
function janelaFama() {
  const f = S.fama, prox = Object.entries(EDIFICIOS).filter(([, e]) => e.fama > f.nivel).sort((a, b) => a[1].fama - b[1].fama)[0];
  modal(`<div class="faixaTit">Fama da Guilda</div><div class="famaG">${ico('fama')}<b>${f.nivel}</b></div>
    <div class="barra xp"><i style="width:${f.xp / xpFama(f.nivel) * 100}%"></i><span>${fmt(f.xp)} / ${fmt(xpFama(f.nivel))}</span></div>
    <p class="suave">Ganhe fama melhorando prédios e completando missões. Cada nível dá gemas${prox ? ` e o nível ${prox[1].fama} libera <b>${prox[1].nome}</b>` : ''}.</p><button class="btn azul" data-ok>Fechar</button>`);
}
function configuracoes() {
  const c = modal(`<div class="faixaTit">Ajustes</div>
    <button class="btn ${mudo ? 'cinza' : 'azul'}" data-a="som">${ico(mudo ? 'mudo' : 'som')} Som: ${mudo ? 'desligado' : 'ligado'}</button>
    <div class="linha">${['baixa', 'media', 'alta'].map(q => `<button class="btn peq ${ui.qualidade === q ? 'verde' : 'cinza'}" data-q="${q}">${{ baixa: 'Leve', media: 'Normal', alta: 'Bonito' }[q]}</button>`).join('')}</div>
    <p class="suave">Gráficos: vale ao abrir o jogo de novo.</p>
    <details><summary>Créditos</summary><p class="suave">Modelos 3D: KayKit (Kay Lousberg) e Kenney — CC0. Ícones: game-icons.net (Lorc, Delapouite e outros) — CC BY 3.0. Sons: Kenney — CC0. Fontes: Lilita One e Fredoka — OFL. Motor 3D: three.js — MIT.</p></details>
    <button class="btn vermelho peq" data-a="reset">Apagar progresso</button><button class="btn azul" data-ok>Fechar</button>`);
  c.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'som') { mudo = !mudo; try { localStorage.setItem('guilda_mudo', mudo ? '1' : '0'); } catch (x) {} configuracoes(); }
    if (b.dataset.q) { ui.qualidade = b.dataset.q; try { localStorage.setItem('guilda_q', b.dataset.q); } catch (x) {} configuracoes(); }
    if (b.dataset.a === 'reset' && confirm('Apagar todo o progresso da guilda?')) { E.apagar(); location.reload(); }
  };
}

// ---------------- folha (abas e painéis) ----------------
let folhaAtual = null, modoCompra = 1;
function folha(tipo, titulo, icone, cor) {
  folhaAtual = tipo; $('#folha').hidden = false; $('#fTit').textContent = titulo;
  $('#fIco').innerHTML = `<span class="circ" style="--c:${cor || '#c98a3a'}">${ico(icone)}</span>`;
  desenharFolha(true);
}
export function abrirAba(aba) {
  ui.aba = aba; document.querySelectorAll('#nav [data-aba]').forEach(b => { b.classList.toggle('on', b.dataset.aba === aba); if (b.dataset.aba === aba) b.classList.remove('novo'); });
  if (!aba) { $('#folha').hidden = true; folhaAtual = null; return; }
  const T = { guilda: ['Guilda', 'guilda', '#c98a3a'], herois: ['Seu herói e companheiros', 'herois', '#4a7bd0'], missoes: ['Missões', 'missoes', '#3f8f4a'], recrutar: ['Convidar membros', 'recrutar', '#8a5ad8'], objetivos: ['Objetivos', 'objetivos', '#e0a83a'] }[aba];
  folha(aba, ...T);
}
let predioAberto = null, heroiAberto = null, regiaoAberta = 0;
function abrirPredio(id) {
  predioAberto = id; delete S.novos[id]; ui.aba = null; document.querySelectorAll('#nav [data-aba]').forEach(b => b.classList.remove('on'));
  const p = POS[id]; ui.foco.x = p.x * 0.8; ui.foco.z = p.z * 0.8 + 6;
  folha('predio', EDIFICIOS[id].nome, EDIFICIOS[id].icone, EDIFICIOS[id].cor);
}
function abrirHeroi(id) { heroiAberto = id; folha('heroi', E.heroi(id)?.nome || 'Herói', CLASSES[E.heroi(id).cls].icone, CLASSES[E.heroi(id).cls].cor); }
let ultimoHtml = '';
function desenharFolha(forcar = false) {
  if (!folhaAtual) return;
  const html = { predio: htmlPredio, guilda: htmlGuilda, herois: htmlHerois, heroi: htmlHeroi, missoes: htmlMissoes, recrutar: htmlRecrutar, objetivos: htmlObjetivos }[folhaAtual]();
  if (!forcar && html === ultimoHtml) return;
  ultimoHtml = html; const corpo = $('#fCorpo'), rol = corpo.scrollTop; corpo.innerHTML = html; if (!forcar) corpo.scrollTop = rol;
  corpo.onclick = cliqueFolha;
}
const pode = c => S.ouro >= c;
function botaoCompra(txt, custo, acao, cor = 'verde', extra = '') { return `<button class="btn ${cor} ${pode(custo) ? '' : 'sem'}" data-a="${acao}" ${extra}><span>${txt}</span><em>${ico('ouro')}${fmt(custo)}</em></button>`; }
function htmlPredio() {
  const id = predioAberto, e = EDIFICIOS[id], n = E.nivel(id);
  if (!E.desbloqueado(id)) return `<div class="bloqueado">${ico('cadeado')}<p>Libera com a <b>Fama nível ${e.fama}</b>.</p><p class="suave">${e.desc}</p></div>`;
  const qtd = modoCompra === 0 ? Math.max(1, E.quantasPode(id)) : modoCompra, custo = E.custoVarias(id, qtd), m = proxMarco(n), ant = [0, ...[10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500]].filter(x => x <= n).pop();
  return `<p class="suave">${e.desc}</p>
    <div class="nivelG"><span>Nível</span><b>${n}</b></div>
    ${m ? `<div class="marco"><div class="barra ouro"><i style="width:${(n - ant) / (m - ant) * 100}%"></i><span>Marco ${m}: efeito ×2</span></div></div>` : ''}
    <div class="efeito"><div><small>Agora</small><b>${n ? descEfeito(id, n) : '—'}</b></div><div class="seta">${ico('seta')}</div><div class="prox"><small>Nível ${n + qtd}</small><b>${descEfeito(id, n + qtd)}</b></div></div>
    <div class="modos">${[[1, 'x1'], [10, 'x10'], [0, 'MÁX']].map(([v, t]) => `<button class="modo ${modoCompra === v ? 'on' : ''}" data-modo="${v}">${t}</button>`).join('')}</div>
    ${botaoCompra(n ? `Doar e melhorar ${qtd > 1 ? `×${qtd}` : ''}` : 'Doar para construir', custo, 'melhorar', 'verde grande')}`;
}
function htmlGuilda() {
  const doa = Object.entries(S.doacoes || {}).map(([id, v]) => ({ h: E.heroi(id), v })).filter(x => x.h).sort((a, b) => b.v - a.v).slice(0, 12);
  return `<div class="gCard"><span class="circ" style="--c:#c98a3a">${ico('guilda')}</span><div class="cTxt"><b>${esc(S.nomeGuilda || 'Guilda dos Heróis')}</b><small>Nível (Fama) ${S.fama.nivel} · ${S.herois.length}/12 membros</small></div></div>
    <p class="suave">Os prédios são da guilda: todos os membros doam ouro para melhorar e todos ganham os bônus.</p>
    ${doa.length ? `<h3 class="secT">${ico('objetivos')} Maiores doadores</h3><div class="doacoes">${doa.map((x, i) => `<div class="${x.h.id === S.lider ? 'eu' : ''}"><em>${i + 1}</em><b>${esc(x.h.nome)}${x.h.id === S.lider ? ' (você)' : ''}</b><span>${ico('ouro')}${fmt(x.v)}</span></div>`).join('')}</div>` : ''}
    <h3 class="secT">${ico('guilda')} Prédios da guilda</h3><div class="lista">` +
    Object.entries(EDIFICIOS).filter(([id]) => visivel(id) || id === proximoTrancado()).map(([id, e]) => {
      const n = E.nivel(id), ok = E.desbloqueado(id), c = custoEd(id, n);
      return `<button class="card ${ok ? '' : 'trancado'}" data-predio="${id}"><span class="circ" style="--c:${e.cor}">${ico(ok ? e.icone : 'cadeado')}</span>
        <div class="cTxt"><b>${e.nome}</b><small>${ok ? (n ? `Nível ${n} · ${descEfeito(id, n)}` : 'Toque para construir') : `Fama ${e.fama}`}</small></div>
        ${ok ? `<em class="preco ${pode(c) ? 'ok' : ''}">${ico('ouro')}${fmt(c)}</em>` : ''}</button>`;
    }).join('') + '</div>';
}
// ---------------- Sistema do líder ----------------
function medidorRanking(p) {
  const rk = rankPoder(p);
  return `<div class="medidor2">${RANKING.map(([, l, c], i) => `<span class="${i < rk.i ? 'feito' : i === rk.i ? 'atual' : ''}" style="--rk:${c}">${l}</span>`).join('')}</div>
    <div class="estrelasR">${Array.from({ length: 5 }, (_, i) => `<i class="${i < rk.estrelas ? 'on' : ''}">${ico('estrela')}</i>`).join('')}<small>${rk.prox ? `${fmt(p)} / ${fmt(rk.prox)} para o rank ${RANKING[rk.i + 1][1]}` : 'Rank máximo!'}</small></div>`;
}
function cartaoSistema() {
  const s = E.sis(), l = E.lider(), rk = rankPoder(E.poderCombate()), r = [0, rk.letra, rk.cor, rk.titulo];
  return `<button class="sisCard" data-a="sistema" style="--rk:${r[2]}"><span class="rank">${r[1]}</span><div class="cTxt"><b>${esc(l?.nome || 'Líder')} · Nv ${s.nivel}</b>
    <small>${r[3]} · Poder de combate ${fmt(E.poderCombate())}</small><div class="barra sis"><i style="width:${s.xp / xpSistema(s.nivel) * 100}%"></i></div></div>
    ${s.pontos ? `<em class="pts">+${s.pontos}</em>` : ''}</button>`;
}
function despertar(rk) {
  som('lendario');
  modal(`<div class="sisJan despertar"><div class="sisTopo">${ico('rank')} DESPERTAR</div><div class="rankUp"><span class="rank g" style="--rk:${rk.cor}">${rk.letra}</span></div>
    <p><b>Seu herói alcançou o rank ${rk.letra}!</b><br>${rk.titulo}</p>${medidorRanking(E.poderCombate())}<button class="btn azul grande" data-ok>Continuar</button></div>`, 'semFundo');
}
export function janelaSistema() {
  const s = E.sis(), l = E.lider(), rk = rankPoder(E.poderCombate()), r = [0, rk.letra, rk.cor, rk.titulo], prox = null, b = E.bonus();
  const c = modal(`<div class="sisJan"><div class="sisTopo">${ico('rank')} STATUS DO LÍDER</div>
    <div class="sisNome"><span class="rank g" style="--rk:${r[2]}">${r[1]}</span><div><b>${esc(l?.nome || 'Líder')}</b><small>Rank ${r[1]} · ${r[3]}</small></div></div>
    ${medidorRanking(E.poderCombate())}
    <div class="sisLinha"><span>Nível</span><b>${s.nivel}</b></div>
    <div class="barra sis"><i style="width:${s.xp / xpSistema(s.nivel) * 100}%"></i><span>XP ${fmt(s.xp)} / ${fmt(xpSistema(s.nivel))}</span></div>
    <div class="sisLinha"><span>Poder de combate</span><b>${fmt(E.poderCombate())}</b></div>
    <div class="sisLinha"><span>Pontos livres</span><b class="${s.pontos ? 'brilha' : ''}">${s.pontos}</b></div>
    ${Object.entries(ATRIBUTOS).map(([k, a]) => `<div class="sisAt" style="--ac:${a.cor}"><span class="ai">${ico(a.icone)}</span><div><b>${a.nome} <i>${s.a[k]}</i></b><small>${a.txt(s.a[k])}</small></div>
      <button class="sisMais" data-at="${k}" ${s.pontos ? '' : 'disabled'}>+</button></div>`).join('')}
    <button class="btn roxo" data-eqp>${ico('c_armas')} Equipamento e mochila</button>
    <p class="sisDica">O líder ganha XP com missões (mais se ele for junto), melhorias de prédios, objetivos e o Campo de Treino.</p>
    <button class="btn azul" data-ok>Fechar</button></div>`, 'semFundo');
  c.onclick = e => { if (e.target.closest('[data-eqp]')) { itemAberto = null; return janelaEquip(); } const bt = e.target.closest('[data-at]'); if (!bt) return; e.stopPropagation(); if (E.distribuir(bt.dataset.at)) { som('marco'); janelaSistema(); } };
}
function estrelas(rar) { return `<span class="estrelas">${Array.from({ length: rar + 1 }, () => ico('estrela')).join('')}</span>`; }
function chipEstado(h) {
  if (h.estado === 'missao') return `<em class="chip azul">${ico('missoes')}Em missão</em>`;
  if (h.estado === 'ferido') return `<em class="chip vermelho">${ico('ferido')}${fmtTempo((h.ate - Date.now()) / 1000)}</em>`;
  return `<em class="chip verde">Livre</em>`;
}
function htmlHerois() {
  const hs = [...S.herois].sort((a, b) => E.poder(b) - E.poder(a));
  return cartaoSistema() + `<h3 class="secT">Companheiros da guilda</h3><div class="resumo"><span>${ico('herois')}${S.herois.length}/${E.capacidade()} membros</span><span>${ico('treino')}Treino: +${fmt(EF.treino(E.nivel('treino')))} XP/s</span></div><div class="grade">` +
    hs.map(h => { const c = CLASSES[h.cls], r = RARIDADES[h.rar];
      return `<button class="heroi ${h.id === S.lider ? 'lider' : ''}" data-heroi="${h.id}" style="--r:${r.cor};--c:${c.cor}">${h.id === S.lider ? `<i class="coroaL">${ico('coroa')}</i>` : ''}${selo(E.rankHeroi(h), 'mini canto')}<span class="retrato">${ico(c.icone)}</span>${estrelas(h.rar)}<b>${esc(h.nome)}${h.id === S.lider ? ' (você)' : ''}</b><small>${c.nome} · Nv ${h.nivel}</small>
        <div class="poder">${ico('poder')}${fmt(E.poder(h))}</div>${chipEstado(h)}</button>`; }).join('') + '</div>';
}
function htmlHeroi() {
  const h = E.heroi(heroiAberto); if (!h) return '<p>Herói não encontrado.</p>';
  const c = CLASSES[h.cls], r = RARIDADES[h.rar], afins = REGIOES.filter(x => x.afin === h.cls).map(x => x.nome).join(', ');
  return `<div class="fichaH" style="--r:${r.cor};--c:${c.cor}"><span class="retrato g">${ico(c.icone)}</span><div><b>${esc(h.nome)}</b><small style="color:${r.cor}">${r.nome} · ${c.nome}</small>${estrelas(h.rar)}</div></div>
    <div class="stats"><div>${ico('xp')}<small>Nível</small><b>${h.nivel}</b></div><div>${ico('poder')}<small>Poder</small><b>${fmt(E.poder(h))}</b></div><div>${ico('estrela')}<small>Raridade</small><b>×${r.mult}</b></div></div>
    <div class="barra xp"><i style="width:${h.xp / xpHeroi(h.nivel) * 100}%"></i><span>XP ${fmt(h.xp)} / ${fmt(xpHeroi(h.nivel))}</span></div>
    <p class="suave">${chipEstado(h)} ${afins ? `Bônus de +25% em: ${afins}.` : ''}</p>
    ${botaoCompra('Treinar (+1 nível)', custoTreinar(h), 'treinar', 'verde grande')}
    <div class="linha"><button class="btn azul" data-a="visual">${ico('pincel')} Aparência</button>${h.id === S.lider ? `<button class="btn roxo" data-a="equip">${ico('c_armas')} Equipamento</button>` : ''}</div>
    ${h.id === S.lider ? `<p class="suave">${ico('coroa')} Seu herói principal</p>` : `<p class="suave">Membro da guilda: ajuda nas missões e doa para os prédios.</p><button class="btn cinza peq" data-a="aposentar">Expulsar da guilda</button>`}`;
}
let vistaM = 'quadro', filtroReg = null;
const GUILDA_M = { x: 8, y: 94 };
// posição ao longo da trilha (guilda → região 0 → ... → região r), f de 0 a 1
function pontoTrilha(r, f) {
  const pts = [GUILDA_M, ...REGIOES.slice(0, r + 1)], seg = []; let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(d); tot += d; }
  let alvo = f * tot;
  for (let i = 0; i < seg.length; i++) { if (alvo <= seg[i] || i === seg.length - 1) { const k = seg[i] ? Math.min(1, alvo / seg[i]) : 1; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k }; } alvo -= seg[i]; }
  return pts[pts.length - 1];
}
// ida (0–35%), luta na região (35–75%), volta (75–100%)
function animarMapa() {
  const cam = document.querySelector('.mapa .tokens'); if (!cam) return;
  const agora = Date.now(), vivos = new Set();
  for (const ms of S.missoes) {
    const k = Math.min(1, (agora - ms.inicio) / (ms.fim - ms.inicio)), fase = k < 0.35 ? 'ida' : k < 0.75 ? 'luta' : 'volta';
    const f = fase === 'ida' ? k / 0.35 : fase === 'luta' ? 1 : 1 - (k - 0.75) / 0.25;
    ms.herois.forEach((id, i) => {
      const h = E.heroi(id); if (!h) return; const chave = ms.uid + id; vivos.add(chave);
      let el = cam.querySelector(`[data-t="${chave}"]`);
      if (!el) { el = document.createElement('span'); el.className = 'tok'; el.dataset.t = chave; el.style.setProperty('--c', CLASSES[h.cls].cor); el.innerHTML = ico(CLASSES[h.cls].icone); cam.append(el); }
      const atraso = fase === 'luta' ? 0 : i * 0.04, p = pontoTrilha(ms.r, Math.max(0, Math.min(1, f - (fase === 'ida' ? atraso : -atraso))));
      const ox = fase === 'luta' ? Math.cos(i * 1.7 + C.tempo() * 2) * 4 : 0, oy = fase === 'luta' ? Math.sin(i * 1.7 + C.tempo() * 2) * 3 : 0;
      el.style.transform = `translate(${cam.clientWidth * (p.x + ox) / 100}px,${cam.clientHeight * (p.y + oy) / 100}px)`;
      el.className = 'tok ' + (fase === 'luta' ? 'luta' : fase === 'volta' ? 'volta' : '');
    });
    const ck = 'c' + ms.uid; let ch = cam.querySelector(`[data-t="${ck}"]`);
    if (fase === 'luta') { vivos.add(ck); if (!ch) { ch = document.createElement('span'); ch.className = 'choque'; ch.dataset.t = ck; ch.innerHTML = ico('poder'); cam.append(ch); }
      const reg = REGIOES[ms.r]; ch.style.transform = `translate(${cam.clientWidth * reg.x / 100}px,${cam.clientHeight * (reg.y - 7) / 100}px)`; }
  }
  for (const el of [...cam.children]) if (!vivos.has(el.dataset.t)) el.remove();
}
const corRank = i => RANKS[i][2];
const selo = (i, cls = '') => `<span class="rkSelo ${cls}" style="--rk:${corRank(i)}">${LETRAS[i]}</span>`;
function htmlMissoes() {
  const agora = Date.now();
  let h = `<div class="resumo"><span>${ico('quadro')}${S.missoes.length}/${E.vagasMissao()} em andamento</span><span>${ico('herois')}${E.livres().length} livres</span></div>`;
  if (S.missoes.length) h += '<div class="ativasL">' + S.missoes.map(ms => { const m = missao(ms.r, ms.t), k = Math.min(1, (agora - ms.inicio) / (ms.fim - ms.inicio)), reg = REGIOES[ms.r];
    return `<div class="ativa"><span class="circ peq" style="--c:${reg.cor}">${ico(reg.icone)}</span><div class="cTxt"><b>${esc(ms.nome || m.nome)}</b><div class="barra verde"><i style="width:${k * 100}%"></i><span>${fmtTempo((ms.fim - agora) / 1000)} · ${Math.round(ms.chance * 100)}%</span></div></div>
      <button class="btn roxo peq" data-acel="${ms.uid}">${ico('raio')}${E.custoAcelerar(ms, agora)}${ico('gema', 'mini')}</button></div>`; }).join('') + '</div>';
  E.regenOrdens(agora); const mo = E.maxOrdens(), prox = S.ordens < mo ? fmtTempo((S.ordensT + ORDEM_SEG * 1000 - agora) / 1000) : '';
  h += `<div class="autoM"><b>Modo automático<small>Heróis livres pegam sozinhos papéis com 80%+ de chance (recompensa 90%). Funciona até com o jogo fechado.</small></b><button class="chave ${S.auto ? 'on' : ''}" data-a="auto"></button></div>
    <div class="ordens"><span>${ico('pergaminho')} Ordens <b>${S.ordens}/${mo}</b></span><small>${prox ? `+1 em ${prox}` : 'cheias'}</small>
      ${S.ordens < mo ? `<button class="btn roxo peq" data-a="ordens">Encher ${GEMAS_ORDENS}${ico('gema', 'mini')}</button>` : ''}</div>`;
  h += `<div class="vistas"><button class="${vistaM === 'quadro' ? 'on' : ''}" data-vista="quadro">${ico('quadro')} Quadro</button><button data-a="irmundo">${ico('missoes')} Ver no mapa</button></div>`;
  const papeis = (S.quadro || []).filter(q => filtroReg == null || q.r === filtroReg).sort((a, b) => (b.t === 3) - (a.t === 3) || a.rank - b.rank);
  if (vistaM === 'mapa') {
    h += `<div class="mapa"><svg class="trilhas" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${[GUILDA_M, ...REGIOES].map(r => r.x + ',' + r.y).join(' ')}"/></svg>
      <button class="lugar guildaM" style="left:${GUILDA_M.x}%;top:${GUILDA_M.y}%"><span class="circ" style="--c:#c98a3a">${ico('guilda')}</span><small>Sua guilda</small></button>` +
      REGIOES.map((r, i) => { const tr = i > S.regiao, qs = (S.quadro || []).filter(q => q.r === i);
        return `<button class="lugar ${tr ? 'trancado' : ''} ${S.chefes[i] ? 'limpo' : ''}" data-lugar="${i}" style="left:${r.x}%;top:${r.y}%;--c:${r.cor}"><span class="circ" style="--c:${r.cor}">${ico(tr ? 'cadeado' : r.icone)}</span>
          <small>${r.nome}</small>${selo(RANK_REGIAO[i], 'mini')}${qs.length && !tr ? `<em class="pinos">${qs.length}</em>` : ''}${qs.some(q => q.t === 3) ? `<b class="procurado">${ico('chefe')}</b>` : ''}</button>`; }).join('') + '</div>';
    h = h.replace(/<\/div>$/, '') + '<div class="tokens"></div></div>';
    h += `<p class="suave">Seus heróis viajam, lutam e voltam pelo mapa. Toque num lugar para ver os papéis de lá.</p>`;
  } else {
    if (filtroReg != null) h += `<div class="filtro">${ico(REGIOES[filtroReg].icone)} ${REGIOES[filtroReg].nome} <button data-lugar="-1">${ico('fechar')}</button></div>`;
    h += '<div class="quadroM">' + (papeis.map(q => {
      const m = missao(q.r, q.t), reg = REGIOES[q.r], dur = m.dur * EF.biblioteca(E.nivel('biblioteca')) * E.bonus().tempo, ouro = m.ouro * q.mult * EF.quadro(E.nivel('quadro')).bonus * EF.mercado(E.nivel('mercado')) * E.bonus().ouro;
      const pode = S.herois.some(x => E.rankHeroi(x) >= q.rank);
      return `<button class="papel ${q.t === 3 ? 'procurado' : ''} ${pode ? '' : 'alto'}" data-q="${q.id}" style="--g:${q.gira}deg"><i class="prego"></i>${selo(q.rank)}
        ${q.t === 3 ? `<span class="cartaz">PROCURADO</span><span class="rosto">${ico('chefe')}</span><b>${reg.chefe}</b>` : `<b>${esc(q.nome)}</b>`}
        <small class="onde" style="--c:${reg.cor}">${ico(reg.icone)}${reg.nome}</small>
        <span class="recomp2">${ico('ouro')}${fmt(ouro)}${m.bau ? ` ${ico('bau')}` : ''}${q.mult >= 1.3 ? '<em>bônus!</em>' : ''}</span>
        <small>${ico('tempo')}${fmtTempo(dur)} · ${ico('herois')}${m.max} · ${ico('poder')}${fmt(m.req)}</small>
        ${q.ate ? `<small class="some">some em ${fmtTempo((q.ate - agora) / 1000)}</small>` : ''}</button>`;
    }).join('') || `<p class="suave vazio">Nenhum papel aqui agora.</p>`) + '</div>';
    h += `<div class="linha rodape"><small>${ico('relogio')} Novo papel em ${fmtTempo(Math.max(0, (S.quadroT - agora) / 1000))}</small><button class="btn roxo peq" data-a="trocar">${ico('dado')} Trocar papéis ${GEMAS_TROCAR}${ico('gema', 'mini')}</button></div>`;
  }
  return h;
}
function htmlRecrutar() {
  const ch = chancesRecrutar(E.nivel('portal')), chP = chancesRecrutar(E.nivel('portal'), true), c = custoRecrutar(S.st.recrutados), agora = Date.now(), cheio = S.herois.length >= E.capacidade();
  const barras = (l) => `<div class="chances">${l.map((x, i) => `<span style="--r:${RARIDADES[i].cor}"><i style="width:${Math.max(2, x * 100)}%"></i>${RARIDADES[i].nome} ${(x * 100).toFixed(1)}%</span>`).join('')}</div>`;
  return `<div class="portalG">${ico('portal')}</div>${cheio ? `<div class="alerta">${ico('alojamento')} Guilda cheia (${S.herois.length}/${E.capacidade()}). Melhore o Alojamento (até 12 membros).</div>` : ''}
    <p class="suave">Convide aventureiros para a guilda. Eles doam para os prédios e o herói deles luta ao seu lado.</p>
    <div class="recrut"><h3>Convite comum</h3>${barras(ch)}${botaoCompra('Convidar', c, 'recrutar', 'verde')}
      ${agora >= S.gratisEm ? `<button class="btn amarelo" data-a="gratis"><span>${ico('presente')} Convite grátis!</span></button>` : `<p class="suave">${ico('relogio')} Grátis de novo em ${fmtTempo((S.gratisEm - agora) / 1000)}</p>`}</div>
    <div class="recrut premium"><h3>Convite de elite</h3>${barras(chP)}<button class="btn roxo ${S.gemas >= GEMAS_RECRUTAR ? '' : 'sem'}" data-a="premium"><span>Invocar</span><em>${ico('gema')}${GEMAS_RECRUTAR}</em></button></div>
    <p class="suave">O Portal de Recrutamento aumenta a chance de heróis raros.</p>`;
}
function htmlObjetivos() {
  return '<div class="lista">' + OBJETIVOS.map(o => {
    const a = E.objetivoAtual(o), p = E.progressoObj(o.id);
    if (!a) return `<div class="obj feito"><span class="circ peq" style="--c:#5fb83a">${ico('check')}</span><div class="cTxt"><b>${o.nome}</b><small>Tudo concluído!</small></div></div>`;
    return `<div class="obj"><span class="circ peq" style="--c:#e0a83a">${ico(o.icone)}</span><div class="cTxt"><b>${o.nome}: ${fmt(a.meta)}</b><div class="barra ouro"><i style="width:${Math.min(100, p / a.meta * 100)}%"></i><span>${fmt(Math.min(p, a.meta))} / ${fmt(a.meta)}</span></div></div>
      <button class="btn ${a.feito ? 'verde' : 'cinza sem'} peq" data-obj="${o.id}">${ico('gema')}${a.gemas}</button></div>`;
  }).join('') + '</div>';
}
function cliqueFolha(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.modo != null) { modoCompra = +b.dataset.modo; som('clique'); desenharFolha(true); return; }
  if (b.dataset.a === 'melhorar') {
    const id = predioAberto, qtd = modoCompra === 0 ? E.quantasPode(id) : modoCompra, antes = E.nivel(id);
    const feitas = E.doar(id, qtd || 1);
    if (!feitas) { som('erro'); aviso(`${ico('ouro')} Ouro insuficiente`, 'erro'); return; }
    som(marcosAte(E.nivel(id)) > marcosAte(antes) ? 'marco' : 'compra'); atualizarPredio(id);
    if (marcosAte(E.nivel(id)) > marcosAte(antes)) aviso(`${ico('estrela')} Marco atingido! ${EDIFICIOS[id].nome}: efeito ×2`, 'ouro');
    const p = POS[id]; C.faiscas(p.x, 3, p.z, 0xffd84a, 12, 3);
  }
  if (b.dataset.predio) { som('abrir'); abrirPredio(b.dataset.predio); return; }
  if (b.dataset.heroi) { som('abrir'); abrirHeroi(b.dataset.heroi); return; }
  if (b.dataset.a === 'treinar') { if (E.treinar(heroiAberto)) som('espada'); else { som('erro'); aviso(`${ico('ouro')} Ouro insuficiente`, 'erro'); } }
  if (b.dataset.a === 'sistema') { som('abrir'); janelaSistema(); return; }
  if (b.dataset.a === 'equip') { som('abrir'); itemAberto = null; janelaEquip(); return; }
  if (b.dataset.a === 'visual') { som('abrir'); const id = heroiAberto; abrirCriador(id, { aoFechar: () => { revestir(id); abrirHeroi(id); } }); return; }
  if (b.dataset.a === 'aposentar') { const h = E.heroi(heroiAberto); if (h && confirm(`Aposentar ${h.nome}? Você recebe um pouco de ouro.`)) { const v = E.aposentar(h.id); if (v) { som('moedas'); aviso(`${esc(h.nome)} se aposentou. +${fmt(v)} ouro`); abrirAba('herois'); } } return; }
  if (b.dataset.a === 'auto') { S.auto = !S.auto; som('clique'); aviso(S.auto ? `${ico('raio')} Modo automático ligado` : 'Modo automático desligado'); }
  if (b.dataset.a === 'ordens') { if (E.recarregarOrdens()) { som('confirma'); aviso(`${ico('pergaminho')} Ordens recarregadas!`); } else { som('erro'); aviso(`${ico('gema')} Gemas insuficientes`, 'erro'); } }
  if (b.dataset.a === 'irmundo') { som('abrir'); irMundo(true); return; }
  if (b.dataset.vista) { vistaM = b.dataset.vista; som('livro'); desenharFolha(true); return; }
  if (b.dataset.lugar != null) { const r = +b.dataset.lugar; if (r > S.regiao) { som('erro'); aviso(`${ico('cadeado')} Derrote o chefe anterior para liberar`, 'erro'); return; } filtroReg = r < 0 ? null : r; vistaM = 'quadro'; som('livro'); desenharFolha(true); return; }
  if (b.dataset.q) { som('abrir'); escolherEquipe(b.dataset.q); return; }
  if (b.dataset.a === 'trocar') { if (E.trocarPapeis()) { som('livro'); aviso(`${ico('quadro')} Papéis novos no quadro!`); } else { som('erro'); aviso(`${ico('gema')} Gemas insuficientes`, 'erro'); } }
  if (b.dataset.acel) { if (E.acelerar(b.dataset.acel)) som('confirma'); else { som('erro'); aviso(`${ico('gema')} Gemas insuficientes`, 'erro'); } }
  if (b.dataset.a === 'recrutar' || b.dataset.a === 'premium' || b.dataset.a === 'gratis') {
    const h = E.recrutar(b.dataset.a === 'premium', b.dataset.a === 'gratis');
    if (h) revelar(h); else { som('erro'); if (S.herois.length < E.capacidade()) aviso(b.dataset.a === 'premium' ? `${ico('gema')} Gemas insuficientes` : `${ico('ouro')} Ouro insuficiente`, 'erro'); }
  }
  if (b.dataset.obj) { const g = E.coletarObjetivo(b.dataset.obj); if (g) { som('confirma'); aviso(`${ico('gema')} +${g} gemas`, 'gema'); } }
  desenharFolha(true);
}
function revelar(h) {
  const c = CLASSES[h.cls], r = RARIDADES[h.rar];
  const cx = modal(`<div class="revela r${h.rar}" style="--r:${r.cor};--c:${c.cor}"><div class="raios"></div><span class="retrato g">${ico(c.icone)}</span>${estrelas(h.rar)}<b>${esc(h.nome)}</b><small style="color:${r.cor}">${r.nome} · ${c.nome}</small><div class="poder">${ico('poder')}${fmt(E.poder(h))}</div></div><button class="btn verde grande" data-ok>Bem-vindo à guilda!</button>`, 'semFundo');
  som(h.rar >= 2 ? 'lendario' : 'recrutar');
}
const lideraPrimeiro = l => l.includes(S.lider) ? [S.lider, ...l.filter(x => x !== S.lider)] : l;
function escolherEquipe(qid) {
  const q = S.quadro.find(x => x.id === qid); if (!q) return;
  const r = q.r, t = q.t, m = missao(r, t), ok = id => E.rankHeroi(E.heroi(id)) >= q.rank;
  const auto = () => { const l = lideraPrimeiro(E.melhorEquipe(r, t)); if (l.some(ok)) return l; const cap = E.livres().filter(h => ok(h.id)).sort((a, b) => E.poder(b, r) - E.poder(a, r))[0]; return cap ? [cap.id, ...l.filter(x => x !== cap.id)].slice(0, m.max) : l; };
  let sel = auto();
  const desenhar = () => {
    const pw = E.poderEquipe(sel, r), ch = chanceSucesso(pw, m.req), hs = E.livres().sort((a, b) => E.poder(b, r) - E.poder(a, r)), temRank = sel.some(ok), liderLivre = E.lider()?.estado === 'livre', guia = E.lider()?.estado === 'livre' ? E.lider() : null;
    const cx = modal(`<div class="faixaTit">${esc(q.nome)}</div><p class="suave">${ico(REGIOES[r].icone)} ${REGIOES[r].nome} · exige herói ${selo(q.rank, 'mini')} ou maior</p>
      <div class="chance"><div class="medidor" style="--p:${ch * 360}deg;--cor:${ch >= 0.8 ? '#5fd84a' : ch >= 0.4 ? '#ffcf3a' : '#ff5a4a'}"><b>${Math.round(ch * 100)}%</b><small>sucesso</small></div>
        <div><small>Poder da equipe</small><b>${fmt(pw)} / ${fmt(m.req)}</b><small>${sel.length}/${m.max} heróis</small></div></div>
      <p class="suave">${ico('coroa')} No modo manual você controla seu herói; os companheiros escolhidos lutam ao lado.</p>
      ${temRank ? '' : `<div class="alerta">${ico('cadeado')} Coloque um herói rank ${LETRAS[q.rank]} ou maior na equipe.</div>`}
      <div class="escolha">${hs.map(h => { const c = CLASSES[h.cls], rk = E.rankHeroi(h); return `<button class="mini ${sel.includes(h.id) ? 'on' : ''}" data-h="${h.id}" style="--r:${RARIDADES[h.rar].cor};--c:${c.cor}">${sel[0] === h.id ? `<i class="coroaL">${ico('coroa')}</i>` : ''}${selo(rk, 'mini canto')}<span class="retrato">${ico(c.icone)}</span><b>${esc(h.nome)}</b><small>${ico('poder')}${fmt(E.poder(h, r))}${REGIOES[r].afin === h.cls ? ' ★' : ''}</small></button>`; }).join('') || '<p class="suave">Nenhum herói livre.</p>'}</div>
      <div class="linha"><button class="btn cinza peq" data-auto>Escolher melhores</button></div>
      <div class="modoM">
        <button class="btn verde" data-ir ${sel.length && temRank ? '' : 'disabled'}><span>${ico('missoes')} Automático</span><small>Os heróis vão sozinhos</small></button>
        <button class="btn roxo" data-manual ${guia && temRank ? '' : 'disabled'}><span>${ico('c_armas')} Manual</span><small>${guia ? `Você luta com ${esc(guia.nome)} (+25%)` : 'Seu herói está ocupado'}</small></button></div>`);
    cx.onclick = e => {
      e.stopPropagation(); const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.h) { const id = b.dataset.h; sel = sel.includes(id) ? sel.filter(x => x !== id) : sel.length < m.max ? [...sel, id] : sel; som('clique'); desenhar(); }
      if (b.dataset.auto != null) { sel = auto(); som('clique'); desenhar(); }
      if (b.dataset.manual != null) { $('#modal').hidden = true; abrirAba(null); irMundo(true); const eq = [S.lider, ...sel.filter(x => x !== S.lider)].slice(0, m.max);
                iniciarLuta(q.id, eq, (venceu, desistiu, loot) => { if (!desistiu) aviso(venceu ? `${ico('check')} Missão cumprida no modo manual!` : `${ico('ferido')} Seu líder caiu... tente de novo`, venceu ? 'ok' : 'erro', 3500); if (loot && loot.length) setTimeout(() => janelaLoot(loot), 400); }); }
      if (b.dataset.ir != null) { if (E.pegar(q.id, sel)) { som('enviar'); $('#modal').hidden = true; aviso(`${ico('missoes')} Missão aceita: ${esc(q.nome)}`); desenharFolha(true); } else som('erro'); }
    };
  };
  desenhar();
}

// ---------------- eventos da lógica ----------------
function processarEventos() {
  while (E.fila.length) {
    const e = E.fila.shift();
    if (e.tipo === 'aviso') { som('erro'); aviso(e.txt, 'erro'); }
    if (e.tipo === 'doacao') { aviso(`${ico('ouro')} <b>${esc(e.nome)}</b> doou ${fmt(e.valor)} para ${EDIFICIOS[e.ed].nome}!`, 'ouro', 3000); atualizarPredio(e.ed); }
    if (e.tipo === 'sistema') {
      som('nivel'); aviso(`${ico('rank')} <b>Líder</b> subiu para o nível ${e.nivel}! +3 pontos de atributo`, 'sis', 3500);
      if (e.rank) modal(`<div class="sisJan"><div class="sisTopo">${ico('rank')} STATUS DO LÍDER</div><div class="rankUp" style="--rk:${e.rank[2]}"><span class="rank g">${e.rank[1]}</span></div>
        <p><b>Rank ${e.rank[1]} alcançado!</b><br>${e.rank[3]}</p><button class="btn azul grande" data-ok>Continuar</button></div>`, 'semFundo');
    }
    if (e.tipo === 'fama') { som('nivel'); modal(`<div class="faixaTit">Fama nível ${e.nivel}!</div><div class="famaG">${ico('fama')}<b>${e.nivel}</b></div><div class="ganho">${ico('gema')}<b>+${e.gemas}</b><span>gemas</span></div>${e.novos.filter(() => livre()).map(id => `<div class="ganho">${ico(EDIFICIOS[id].icone)}<b>${EDIFICIOS[id].nome}</b><span>liberado!</span></div>`).join('')}<button class="btn verde grande" data-ok>Oba!</button>`); for (const id of e.novos) atualizarPredio(id, true); }
    if (e.tipo === 'resultado' && !e.silencioso) {
      const r = e.res, reg = REGIOES[r.m.r];
      if (r.ok) { som(r.bau ? 'moedas' : 'compra'); aviso(`${ico(r.m.chefe ? 'chefe' : reg.icone)} <b>${r.m.nome}</b> concluída! +${fmt(r.ouro)} ${ico('ouro')}${r.gemas ? ` +${r.gemas} ${ico('gema')}` : ''}`, 'ok', 3500); }
      else { som('falha'); aviso(`${ico('ferido')} <b>${r.m.nome}</b> falhou${r.feridos.length ? ` · ${r.feridos.length} ferido(s)` : ''}`, 'erro', 3500); }
      if (r.desbloqueou != null) { som('marco'); modal(`<div class="faixaTit">Nova região!</div><div class="famaG" style="--c:${REGIOES[r.desbloqueou].cor}">${ico(REGIOES[r.desbloqueou].icone)}</div><p><b>${REGIOES[r.desbloqueou].nome}</b> foi liberada. Missões mais difíceis e recompensas maiores!</p><button class="btn verde grande" data-ok>Explorar</button>`); }
    }
  }
}

// ---------------- etapas guiadas ----------------
// a mãozinha aponta para o alvo da etapa atual (o primeiro que estiver visível e tocável)
function alvoEl(a) {
  const m = $('#modal'), aberto = !m.hidden;
  let el = null;
  if (a.startsWith('ed:')) el = aberto || folhaAtual ? null : document.querySelector(`.rotulo[data-ed="${a.slice(3)}"]`);
  else if (a.startsWith('nav:')) el = document.querySelector(`#nav [data-aba="${a.slice(4)}"]`);
  else if (a.startsWith('melhorar:')) el = folhaAtual === 'predio' && predioAberto === a.slice(9) ? document.querySelector('#fCorpo [data-a="melhorar"]') : null;
  else el = document.querySelector(a);
  if (!el || el.hidden || el.style.display === 'none') return null;
  if (aberto && !m.contains(el)) return null;
  const r = el.getBoundingClientRect(); if (r.width < 4 || r.bottom < 0 || r.top > innerHeight) return null;
  const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return topo && (el === topo || el.contains(topo)) ? el : null;
}
function revelarNovos(novas) {
  for (const id of Object.keys(EDIFICIOS)) atualizarPredio(id);
  for (const k of novas) {
    if (k.startsWith('ed:')) {
      const id = k.slice(3), p = POS[id]; atualizarPredio(id, true);
      ui.foco.x = p.x * 0.8; ui.foco.z = p.z * 0.8 + 6; C.faiscas(p.x, 4, p.z, 0xffe27a, 50, 6); C.onda(p.x, p.z, 9, 0xffe27a, 0.8);
      aviso(`${ico('novo')} Novo prédio: <b>${EDIFICIOS[id].nome}</b>`, 'ouro', 3500); som('marco');
    } else if (k.startsWith('nav:')) document.querySelector(`#nav [data-aba="${k.slice(4)}"]`)?.classList.add('novo');
  }
}
let etapaVista = -1;
function guiar() {
  const antes = S.etapa, novas = avancar({ folha: folhaAtual === 'predio' ? 'predio:' + predioAberto : folhaAtual });
  if (novas.length) revelarNovos(novas);
  if (S.etapa > antes && etapaVista >= 0) { som('confirma'); aviso(`${ico('check')} Tarefa concluída!`, 'ok', 2200); }
  etapaVista = S.etapa;
  // o que já foi revelado aparece
  for (const b of document.querySelectorAll('#nav [data-aba]')) b.hidden = !revelado('nav:' + b.dataset.aba);
  $('#bMundo').hidden = !revelado('nav:missoes'); $('#pGema').hidden = !revelado('gemas'); $('#bFama').hidden = !revelado('fama');
  const e = etapaAtual(), dica = $('#dica'), guia = $('#guia');
  if (e && folhaAtual == null && $('#modal').hidden) {
    dica.hidden = false; const k = S.etapa + '|' + e.txt;
    if (dica.dataset.t !== k) { dica.dataset.t = k; dica.innerHTML = `${ico('pergaminho')}<div><small>Tarefa ${S.etapa + 1}/${ETAPAS.length}</small><span>${e.txt}</span></div>`; dica.classList.remove('entra'); void dica.offsetWidth; dica.classList.add('entra'); }
  } else dica.hidden = true;
  // nada para tocar com o painel aberto? aponta o botão de fechar
  const el = e && (e.alvo.map(alvoEl).find(Boolean) || (folhaAtual && $('#modal').hidden ? alvoEl('[data-fechar]') : null));
  guia.hidden = !el;
  if (el) { const r = el.getBoundingClientRect(); guia.style.transform = `translate(${r.left + r.width / 2}px,${r.top + r.height * 0.6}px)`; }
}

// ---------------- atualização por quadro ----------------
let tFolha = 0;
export function atualizar(dt) {
  processarEventos();
  $('#vOuro').textContent = fmt(S.ouro); $('#vRenda').textContent = `+${fmt(E.renda())}/s`; $('#vGema').textContent = fmt(S.gemas);
  $('#vFama').textContent = S.fama.nivel; $('#anelFama').style.setProperty('--p', (S.fama.xp / xpFama(S.fama.nivel) * 360) + 'deg');
  // selos das abas
  const selo = (aba, n) => { const s = document.querySelector(`[data-aba="${aba}"] .selo`); s.hidden = !n; s.textContent = n; };
  selo('objetivos', E.objetivosProntos()); selo('herois', E.sis().pontos); selo('recrutar', Date.now() >= S.gratisEm && S.herois.length < E.capacidade() ? 1 : 0);
  selo('missoes', E.vagasMissao() - S.missoes.length > 0 && E.livres().length ? E.vagasMissao() - S.missoes.length : 0);
  // missões em andamento (topo)
  const agora = Date.now(), at = S.missoes.map(ms => { const reg = REGIOES[ms.r], k = Math.min(1, (agora - ms.inicio) / (ms.fim - ms.inicio)); return `<div class="miniM" style="--c:${reg.cor}">${ico(reg.icone)}<i style="--k:${k}"></i><small>${fmtTempo((ms.fim - agora) / 1000)}</small></div>`; }).join('');
  if ($('#ativas').innerHTML !== at) $('#ativas').innerHTML = at;
  guiar();
  { const rk = rankPoder(E.poderCombate()); if (S.rankMax == null) S.rankMax = rk.i; else if (rk.i > S.rankMax && $('#modal').hidden) { S.rankMax = rk.i; despertar(rk); } }
  // rótulos 3D dos prédios
  for (const el of document.querySelectorAll('.rotulo')) {
    const id = el.dataset.ed, p = POS[id], t = C.tela(p.x, id === 'quadro' ? 5.5 : id === 'biblioteca' || id === 'portal' ? 10 : 8, p.z);
    if (!visivel(id) && id !== proximoTrancado() || !t || t[1] < 60 || t[1] > innerHeight - 70) { el.style.display = 'none'; continue; }
    el.style.display = ''; el.style.transform = `translate(${t[0]}px,${t[1]}px) translate(-50%,-50%)`;
    const ok = E.desbloqueado(id), n = E.nivel(id), texto = ok ? (n ? `${n}` : 'Construir') : `Fama ${EDIFICIOS[id].fama}`;
    const b = el.querySelector('b'); if (b.textContent !== texto) b.textContent = texto;
    el.classList.toggle('pode', ok && S.ouro >= custoEd(id, n)); el.classList.toggle('trancado', !ok); el.classList.toggle('novo', !!S.novos[id]);
  }
  desenharFlutuantes(dt); rotulosMundo();
  tFolha += dt; if (tFolha > 0.25) { tFolha = 0; desenharFolha(); }
}
