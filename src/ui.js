// Interface da Guilda: barra de recursos, abas, painéis, janelas, dicas, rótulos 3D, sons e controles da câmera.
import * as C from './cena.js';
import * as E from './estado.js';
import { S } from './estado.js';
import { ICONES } from './icones.js';
import { EDIFICIOS, EF, custoEd, descEfeito, proxMarco, marcosAte, CLASSES, RARIDADES, chancesRecrutar, xpHeroi, custoTreinar, custoRecrutar, GEMAS_RECRUTAR,
  REGIOES, missao, reqRegiao, chanceSucesso, xpFama, OBJETIVOS, fmt, fmtTempo } from './dados.js';
import { POS, atualizarPredio } from './base.js';

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
      <div class="pilula gema">${ico('gema')}<b id="vGema"></b></div>
      <button id="bFama" class="fama"><i id="anelFama"></i>${ico('fama')}<b id="vFama"></b></button>
      <button id="bConfig" class="redondo">${ico('config')}</button>
    </div>
    <div id="ativas"></div>
    <div id="dica" hidden></div>
    <div id="rotulos"></div>
    <nav id="nav">
      ${[['guilda', 'Guilda'], ['herois', 'Heróis'], ['missoes', 'Missões'], ['recrutar', 'Recrutar'], ['objetivos', 'Objetivos']].map(([k, t]) => `<button data-aba="${k}">${ico(k)}<span>${t}</span><em class="selo" hidden></em></button>`).join('')}
    </nav>
    <section id="folha" hidden><header><div id="fIco"></div><h2 id="fTit"></h2><button class="xis" data-fechar>${ico('fechar')}</button></header><div id="fCorpo"></div></section>
    <div id="modal" hidden></div>
    <div id="avisos"></div>
    <div id="flutua"></div>`;
  $('#nav').onclick = e => { const b = e.target.closest('[data-aba]'); if (b) { som('clique'); abrirAba(b.dataset.aba === ui.aba ? null : b.dataset.aba); } };
  $('#folha').addEventListener('click', e => { if (e.target.closest('[data-fechar]')) { som('fechar'); abrirAba(null); } });
  $('#bConfig').onclick = () => { som('clique'); configuracoes(); };
  $('#bFama').onclick = () => { som('clique'); janelaFama(); };
  $('#ativas').onclick = () => { som('clique'); abrirAba('missoes'); };
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
      if (pinca) C.camera.dist = Math.max(22, Math.min(100, C.camera.dist * antes / agora)); pinca = 1; arrastou = true; return;
    }
    const p0 = C.chaoEm(d.x, d.y), p1 = C.chaoEm(e.clientX, e.clientY);
    if (Math.hypot(e.clientX - ini.x, e.clientY - ini.y) > 8) arrastou = true;
    if (p0 && p1 && arrastou) { ui.foco.x = Math.max(-26, Math.min(26, ui.foco.x + p0.x - p1.x)); ui.foco.z = Math.max(-24, Math.min(30, ui.foco.z + p0.z - p1.z)); C.camera.suave = 30; }
    d.x = e.clientX; d.y = e.clientY;
  });
  const fim = e => {
    if (dedos.size === 1 && !arrastou) { const id = C.tocado(e.clientX, e.clientY); if (id) { som('abrir'); abrirPredio(id); } }
    dedos.delete(e.pointerId); if (!dedos.size) C.camera.suave = 10;
  };
  area.addEventListener('pointerup', fim); area.addEventListener('pointercancel', e => dedos.delete(e.pointerId));
  area.addEventListener('wheel', e => { C.camera.dist = Math.max(22, Math.min(100, C.camera.dist + e.deltaY * 0.03)); }, { passive: true });
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
  ui.aba = aba; document.querySelectorAll('#nav [data-aba]').forEach(b => b.classList.toggle('on', b.dataset.aba === aba));
  if (!aba) { $('#folha').hidden = true; folhaAtual = null; return; }
  const T = { guilda: ['Prédios da Guilda', 'guilda', '#c98a3a'], herois: ['Heróis', 'herois', '#4a7bd0'], missoes: ['Missões', 'missoes', '#3f8f4a'], recrutar: ['Portal de Recrutamento', 'recrutar', '#8a5ad8'], objetivos: ['Objetivos', 'objetivos', '#e0a83a'] }[aba];
  folha(aba, ...T);
}
let predioAberto = null, heroiAberto = null, regiaoAberta = 0;
function abrirPredio(id) {
  predioAberto = id; ui.aba = null; document.querySelectorAll('#nav [data-aba]').forEach(b => b.classList.remove('on'));
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
    ${botaoCompra(n ? `Melhorar ${qtd > 1 ? `×${qtd}` : ''}` : 'Construir', custo, 'melhorar', 'verde grande')}`;
}
function htmlGuilda() {
  return `<p class="suave">Toque nos prédios (aqui ou no mapa) para melhorar. Cada marco de nível dobra o efeito!</p><div class="lista">` +
    Object.entries(EDIFICIOS).map(([id, e]) => {
      const n = E.nivel(id), ok = E.desbloqueado(id), c = custoEd(id, n);
      return `<button class="card ${ok ? '' : 'trancado'}" data-predio="${id}"><span class="circ" style="--c:${e.cor}">${ico(ok ? e.icone : 'cadeado')}</span>
        <div class="cTxt"><b>${e.nome}</b><small>${ok ? (n ? `Nível ${n} · ${descEfeito(id, n)}` : 'Toque para construir') : `Fama ${e.fama}`}</small></div>
        ${ok ? `<em class="preco ${pode(c) ? 'ok' : ''}">${ico('ouro')}${fmt(c)}</em>` : ''}</button>`;
    }).join('') + '</div>';
}
function estrelas(rar) { return `<span class="estrelas">${Array.from({ length: rar + 1 }, () => ico('estrela')).join('')}</span>`; }
function chipEstado(h) {
  if (h.estado === 'missao') return `<em class="chip azul">${ico('missoes')}Em missão</em>`;
  if (h.estado === 'ferido') return `<em class="chip vermelho">${ico('ferido')}${fmtTempo((h.ate - Date.now()) / 1000)}</em>`;
  return `<em class="chip verde">Livre</em>`;
}
function htmlHerois() {
  const hs = [...S.herois].sort((a, b) => E.poder(b) - E.poder(a));
  return `<div class="resumo"><span>${ico('herois')}${S.herois.length}/${E.capacidade()} heróis</span><span>${ico('treino')}Treino: +${fmt(EF.treino(E.nivel('treino')))} XP/s</span></div><div class="grade">` +
    hs.map(h => { const c = CLASSES[h.cls], r = RARIDADES[h.rar];
      return `<button class="heroi" data-heroi="${h.id}" style="--r:${r.cor};--c:${c.cor}"><span class="retrato">${ico(c.icone)}</span>${estrelas(h.rar)}<b>${esc(h.nome)}</b><small>${c.nome} · Nv ${h.nivel}</small>
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
    <button class="btn cinza peq" data-a="aposentar">Aposentar herói</button>`;
}
function htmlMissoes() {
  const agora = Date.now();
  let h = `<div class="resumo"><span>${ico('quadro')}${S.missoes.length}/${E.vagasMissao()} missões em andamento</span><span>${ico('herois')}${E.livres().length} livres</span></div>`;
  if (S.missoes.length) h += '<div class="ativasL">' + S.missoes.map(ms => { const m = missao(ms.r, ms.t), k = Math.min(1, (agora - ms.inicio) / (ms.fim - ms.inicio)), reg = REGIOES[ms.r];
    return `<div class="ativa"><span class="circ peq" style="--c:${reg.cor}">${ico(reg.icone)}</span><div class="cTxt"><b>${m.nome} · ${reg.nome}</b><div class="barra verde"><i style="width:${k * 100}%"></i><span>${fmtTempo((ms.fim - agora) / 1000)} · ${Math.round(ms.chance * 100)}%</span></div></div>
      <button class="btn roxo peq" data-acel="${ms.uid}">${ico('raio')}${E.custoAcelerar(ms, agora)}${ico('gema', 'mini')}</button></div>`; }).join('') + '</div>';
  h += '<div class="regioes">' + REGIOES.map((r, i) => `<button class="reg ${i === regiaoAberta ? 'on' : ''} ${i > S.regiao ? 'trancado' : ''}" data-reg="${i}" style="--c:${r.cor}">${ico(i > S.regiao ? 'cadeado' : r.icone)}<small>${i + 1}</small>${S.chefes[i] ? `<i class="ok">${ico('check')}</i>` : ''}</button>`).join('') + '</div>';
  const r = REGIOES[regiaoAberta];
  if (regiaoAberta > S.regiao) return h + `<div class="bloqueado">${ico('cadeado')}<p>Derrote o chefe da região anterior para liberar <b>${r.nome}</b>.</p></div>`;
  h += `<h3 class="regTit" style="--c:${r.cor}">${r.nome}<small>Poder recomendado: ${fmt(reqRegiao(regiaoAberta))}+ · bônus para ${CLASSES[r.afin].nome}</small></h3><div class="lista">`;
  for (let t = 0; t < 4; t++) {
    if (t === 3 && S.chefes[regiaoAberta]) continue;
    const m = missao(regiaoAberta, t), eq = E.melhorEquipe(regiaoAberta, t), ch = eq.length ? chanceSucesso(E.poderEquipe(eq, regiaoAberta), m.req) : 0;
    const dur = m.dur * EF.biblioteca(E.nivel('biblioteca')), ouro = m.ouro * EF.quadro(E.nivel('quadro')).bonus * EF.mercado(E.nivel('mercado'));
    h += `<div class="missao ${m.chefe ? 'chefe' : ''}"><div class="mTopo"><span class="circ peq" style="--c:${m.chefe ? '#b8203a' : r.cor}">${ico(m.chefe ? 'chefe' : r.icone)}</span><div class="cTxt"><b>${m.nome}</b><small>${ico('tempo')}${fmtTempo(dur)} · ${ico('herois')}até ${m.max} · ${ico('poder')}${fmt(m.req)}</small></div></div>
      <div class="recomp"><span>${ico('ouro')}${fmt(ouro)}</span><span>${ico('xp')}${fmt(m.xp)} XP</span>${m.bau ? `<span>${ico('bau')}${Math.round(m.bau * 100)}%</span>` : ''}${m.chefe ? `<span>${ico('cadeado')}libera próxima região</span>` : ''}</div>
      <button class="btn ${ch >= 0.8 ? 'verde' : ch >= 0.4 ? 'amarelo' : 'vermelho'}" data-enviar="${t}" ${eq.length ? '' : 'disabled'}><span>${eq.length ? 'Enviar equipe' : 'Sem heróis livres'}</span><em>${Math.round(ch * 100)}%</em></button></div>`;
  }
  return h + '</div>';
}
function htmlRecrutar() {
  const ch = chancesRecrutar(E.nivel('portal')), chP = chancesRecrutar(E.nivel('portal'), true), c = custoRecrutar(S.st.recrutados), agora = Date.now(), cheio = S.herois.length >= E.capacidade();
  const barras = (l) => `<div class="chances">${l.map((x, i) => `<span style="--r:${RARIDADES[i].cor}"><i style="width:${Math.max(2, x * 100)}%"></i>${RARIDADES[i].nome} ${(x * 100).toFixed(1)}%</span>`).join('')}</div>`;
  return `<div class="portalG">${ico('portal')}</div>${cheio ? `<div class="alerta">${ico('alojamento')} Alojamento cheio (${S.herois.length}/${E.capacidade()}). Melhore o Alojamento ou aposente alguém.</div>` : ''}
    <div class="recrut"><h3>Chamado comum</h3>${barras(ch)}${botaoCompra('Recrutar', c, 'recrutar', 'verde')}
      ${agora >= S.gratisEm ? `<button class="btn amarelo" data-a="gratis"><span>${ico('presente')} Recrutamento grátis!</span></button>` : `<p class="suave">${ico('relogio')} Grátis de novo em ${fmtTempo((S.gratisEm - agora) / 1000)}</p>`}</div>
    <div class="recrut premium"><h3>Invocação mística</h3>${barras(chP)}<button class="btn roxo ${S.gemas >= GEMAS_RECRUTAR ? '' : 'sem'}" data-a="premium"><span>Invocar</span><em>${ico('gema')}${GEMAS_RECRUTAR}</em></button></div>
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
    const feitas = E.melhorarVarias(id, qtd || 1);
    if (!feitas) { som('erro'); aviso(`${ico('ouro')} Ouro insuficiente`, 'erro'); return; }
    som(marcosAte(E.nivel(id)) > marcosAte(antes) ? 'marco' : 'compra'); atualizarPredio(id);
    if (marcosAte(E.nivel(id)) > marcosAte(antes)) aviso(`${ico('estrela')} Marco atingido! ${EDIFICIOS[id].nome}: efeito ×2`, 'ouro');
    const p = POS[id]; C.faiscas(p.x, 3, p.z, 0xffd84a, 12, 3);
  }
  if (b.dataset.predio) { som('abrir'); abrirPredio(b.dataset.predio); return; }
  if (b.dataset.heroi) { som('abrir'); abrirHeroi(b.dataset.heroi); return; }
  if (b.dataset.a === 'treinar') { if (E.treinar(heroiAberto)) som('espada'); else { som('erro'); aviso(`${ico('ouro')} Ouro insuficiente`, 'erro'); } }
  if (b.dataset.a === 'aposentar') { const h = E.heroi(heroiAberto); if (h && confirm(`Aposentar ${h.nome}? Você recebe um pouco de ouro.`)) { const v = E.aposentar(h.id); if (v) { som('moedas'); aviso(`${esc(h.nome)} se aposentou. +${fmt(v)} ouro`); abrirAba('herois'); } } return; }
  if (b.dataset.reg != null) { const r = +b.dataset.reg; regiaoAberta = r; som('livro'); desenharFolha(true); return; }
  if (b.dataset.enviar != null) { escolherEquipe(regiaoAberta, +b.dataset.enviar); return; }
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
function escolherEquipe(r, t) {
  const m = missao(r, t); let sel = E.melhorEquipe(r, t);
  const desenhar = () => {
    const pw = E.poderEquipe(sel, r), ch = chanceSucesso(pw, m.req), hs = E.livres().sort((a, b) => E.poder(b, r) - E.poder(a, r));
    const cx = modal(`<div class="faixaTit">${m.nome} · ${REGIOES[r].nome}</div>
      <div class="chance"><div class="medidor" style="--p:${ch * 360}deg;--cor:${ch >= 0.8 ? '#5fd84a' : ch >= 0.4 ? '#ffcf3a' : '#ff5a4a'}"><b>${Math.round(ch * 100)}%</b><small>sucesso</small></div>
        <div><small>Poder da equipe</small><b>${fmt(pw)} / ${fmt(m.req)}</b><small>${sel.length}/${m.max} heróis</small></div></div>
      <div class="escolha">${hs.map(h => { const c = CLASSES[h.cls]; return `<button class="mini ${sel.includes(h.id) ? 'on' : ''}" data-h="${h.id}" style="--r:${RARIDADES[h.rar].cor};--c:${c.cor}"><span class="retrato">${ico(c.icone)}</span><b>${esc(h.nome)}</b><small>${ico('poder')}${fmt(E.poder(h, r))}${REGIOES[r].afin === h.cls ? ' ★' : ''}</small></button>`; }).join('') || '<p class="suave">Nenhum herói livre.</p>'}</div>
      <div class="linha"><button class="btn cinza" data-auto>Automático</button><button class="btn verde" data-ir ${sel.length ? '' : 'disabled'}>${ico('missoes')} Enviar</button></div>`);
    cx.onclick = e => {
      e.stopPropagation(); const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.h) { const id = b.dataset.h; sel = sel.includes(id) ? sel.filter(x => x !== id) : sel.length < m.max ? [...sel, id] : sel; som('clique'); desenhar(); }
      if (b.dataset.auto != null) { sel = E.melhorEquipe(r, t); som('clique'); desenhar(); }
      if (b.dataset.ir != null) { if (E.enviar(r, t, sel)) { som('enviar'); $('#modal').hidden = true; aviso(`${ico('missoes')} Equipe enviada: ${m.nome}`); desenharFolha(true); } else som('erro'); }
    };
  };
  desenhar();
}

// ---------------- eventos da lógica ----------------
function processarEventos() {
  while (E.fila.length) {
    const e = E.fila.shift();
    if (e.tipo === 'aviso') { som('erro'); aviso(e.txt, 'erro'); }
    if (e.tipo === 'fama') { som('nivel'); modal(`<div class="faixaTit">Fama nível ${e.nivel}!</div><div class="famaG">${ico('fama')}<b>${e.nivel}</b></div><div class="ganho">${ico('gema')}<b>+${e.gemas}</b><span>gemas</span></div>${e.novos.map(id => `<div class="ganho">${ico(EDIFICIOS[id].icone)}<b>${EDIFICIOS[id].nome}</b><span>liberado!</span></div>`).join('')}<button class="btn verde grande" data-ok>Oba!</button>`); for (const id of e.novos) atualizarPredio(id, true); }
    if (e.tipo === 'resultado' && !e.silencioso) {
      const r = e.res, reg = REGIOES[r.m.r];
      if (r.ok) { som(r.bau ? 'moedas' : 'compra'); aviso(`${ico(r.m.chefe ? 'chefe' : reg.icone)} <b>${r.m.nome}</b> concluída! +${fmt(r.ouro)} ${ico('ouro')}${r.gemas ? ` +${r.gemas} ${ico('gema')}` : ''}`, 'ok', 3500); }
      else { som('falha'); aviso(`${ico('ferido')} <b>${r.m.nome}</b> falhou${r.feridos.length ? ` · ${r.feridos.length} ferido(s)` : ''}`, 'erro', 3500); }
      if (r.desbloqueou != null) { som('marco'); modal(`<div class="faixaTit">Nova região!</div><div class="famaG" style="--c:${REGIOES[r.desbloqueou].cor}">${ico(REGIOES[r.desbloqueou].icone)}</div><p><b>${REGIOES[r.desbloqueou].nome}</b> foi liberada. Missões mais difíceis e recompensas maiores!</p><button class="btn verde grande" data-ok>Explorar</button>`); regiaoAberta = r.desbloqueou; }
    }
  }
}

// ---------------- dicas de começo ----------------
const DICAS = [
  { txt: 'Toque na <b>Taverna</b> e melhore até o nível 5 para ganhar mais ouro.', feito: () => E.nivel('taverna') >= 5 },
  { txt: 'Abra <b>Missões</b> e envie seus heróis para uma Patrulha.', feito: () => S.st.missoes >= 1 || S.missoes.length > 0 },
  { txt: 'Construa o <b>Portal de Recrutamento</b> e recrute um novo herói.', feito: () => S.st.recrutados >= 3 },
  { txt: 'Em <b>Objetivos</b>, colete suas primeiras gemas.', feito: () => Object.keys(S.obj).length > 0 },
  { txt: 'Derrote o chefe da <b>Floresta Sombria</b> para liberar a próxima região!', feito: () => S.regiao >= 1 },
];

// ---------------- atualização por quadro ----------------
let tFolha = 0;
export function atualizar(dt) {
  processarEventos();
  $('#vOuro').textContent = fmt(S.ouro); $('#vRenda').textContent = `+${fmt(E.renda())}/s`; $('#vGema').textContent = fmt(S.gemas);
  $('#vFama').textContent = S.fama.nivel; $('#anelFama').style.setProperty('--p', (S.fama.xp / xpFama(S.fama.nivel) * 360) + 'deg');
  // selos das abas
  const selo = (aba, n) => { const s = document.querySelector(`[data-aba="${aba}"] .selo`); s.hidden = !n; s.textContent = n; };
  selo('objetivos', E.objetivosProntos()); selo('recrutar', Date.now() >= S.gratisEm && S.herois.length < E.capacidade() ? 1 : 0);
  selo('missoes', E.vagasMissao() - S.missoes.length > 0 && E.livres().length ? E.vagasMissao() - S.missoes.length : 0);
  // missões em andamento (topo)
  const agora = Date.now(), at = S.missoes.map(ms => { const reg = REGIOES[ms.r], k = Math.min(1, (agora - ms.inicio) / (ms.fim - ms.inicio)); return `<div class="miniM" style="--c:${reg.cor}">${ico(reg.icone)}<i style="--k:${k}"></i><small>${fmtTempo((ms.fim - agora) / 1000)}</small></div>`; }).join('');
  if ($('#ativas').innerHTML !== at) $('#ativas').innerHTML = at;
  // dica
  const d = DICAS.find(x => !x.feito()), dica = $('#dica');
  if (d && folhaAtual == null) { dica.hidden = false; if (dica.dataset.t !== d.txt) { dica.dataset.t = d.txt; dica.innerHTML = `${ico('pergaminho')}<span>${d.txt}</span>`; } } else dica.hidden = true;
  // rótulos 3D dos prédios
  for (const el of document.querySelectorAll('.rotulo')) {
    const id = el.dataset.ed, p = POS[id], t = C.tela(p.x, id === 'quadro' ? 5.5 : id === 'biblioteca' || id === 'portal' ? 10 : 8, p.z);
    if (!t || t[1] < 60 || t[1] > innerHeight - 70) { el.style.display = 'none'; continue; }
    el.style.display = ''; el.style.transform = `translate(${t[0]}px,${t[1]}px) translate(-50%,-50%)`;
    const ok = E.desbloqueado(id), n = E.nivel(id), texto = ok ? (n ? `${n}` : 'Construir') : `Fama ${EDIFICIOS[id].fama}`;
    const b = el.querySelector('b'); if (b.textContent !== texto) b.textContent = texto;
    el.classList.toggle('pode', ok && S.ouro >= custoEd(id, n)); el.classList.toggle('trancado', !ok);
  }
  desenharFlutuantes(dt);
  tFolha += dt; if (tFolha > 0.25) { tFolha = 0; desenharFolha(); }
}
