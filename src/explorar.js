// Exploração do mundo aberto: névoa de guerra (minimapa), baús escondidos, locais para descobrir e covis de chefes.
import * as C from './cena.js';
import * as E from './estado.js';
import { S } from './estado.js';
import { POIS, MUNDO, TAM_MUNDO, MEIO_MUNDO, CENTROS, GUILDA_W, TRILHA, ESTILO, ESC_MUNDO } from './mundo.js';
import { visualAleatorio } from './aparencia.js';
import { REGIOES, fmt } from './dados.js';
import { gerarItem, sortearRaridade, precoItem } from './itens.js';
import { ico, som, ui } from './ui.js';

const N = 48, CEL = TAM_MUNDO / N, RAIO_VER = 55, BAU_VOLTA = 3 * 3600e3, COVIL_VOLTA = 40 * 60e3;
window.__pois = POIS; window.__trilha = TRILHA; // para testes
let nev = null, H = null, baus = {}, tMapa = 0, tPoi = 0, sujo = false, npcs = null, perto = null;
export function estadoExpl() {
  if (!S.expl) S.expl = { nevoa: '', baus: {}, locais: {}, covis: {} };
  if (!S.expl.portais) S.expl.portais = { pg: 1 }; if (S.pocoes == null) S.pocoes = 3;
  if (!nev) { nev = new Uint8Array(N * N); const s = S.expl.nevoa; for (let i = 0; i < s.length && i < N * N; i++) nev[i] = s.charCodeAt(i) === 49 ? 1 : 0; }
  return S.expl;
}
const celula = (x, z) => [Math.floor((x - MUNDO.x + TAM_MUNDO / 2) / CEL), Math.floor((z - MUNDO.z + TAM_MUNDO / 2) / CEL)];
const visto = (x, z) => { const [i, k] = celula(x, z); return i >= 0 && k >= 0 && i < N && k < N && nev[k * N + i] === 1; };
export function porcentagem() { estadoExpl(); let n = 0; for (const v of nev) n += v; return Math.round(n / (N * N) * 100); }
export const locaisAchados = () => Object.keys(estadoExpl().locais).length;
export const totalLocais = () => POIS.filter(o => o.tipo === 'local').length;

// h = { criarMonstro, numero, faixa, L } (funções da luta)
export function iniciarExpl(h) {
  H = h; perto = null; const st = estadoExpl(), agora = Date.now();
  for (const o of POIS) if (o.tipo === 'bau' && !baus[o.id]) { const b = C.objeto('D:chest', 3); b.position.set(o.x, 0, o.z); b.rotation.y = (o.x * 7) % 6; baus[o.id] = b; }
  for (const o of POIS) if (o.tipo === 'bau') baus[o.id].visible = !(st.baus[o.id] > agora);
  if (!npcs) { npcs = [];
    for (const o of POIS) if (o.tipo === 'vila') NPCS.forEach(([tipo, nome, cls], k) => {
      const dx = o.px - o.x, dz = o.pz - o.z, m = Math.hypot(dx, dz), ux = dx / m, uz = dz / m, x = o.x + ux * 6 + uz * (k - 1) * 6, z = o.z + uz * 6 - ux * (k - 1) * 6;
      const v = C.heroi(visualAleatorio(cls)); v.raiz.scale.setScalar(ESC_MUNDO); v.raiz.position.set(x, 0, z); v.raiz.rotation.y = Math.atan2(ux, uz); v.tocar('Idle_A');
      npcs.push({ v, x, z, tipo, nome, vila: o }); }); }
  document.querySelector('#luta')?.insertAdjacentHTML('beforeend', `<button id="lFalar" class="btn amarelo" hidden></button><div id="lTarefa" hidden></div>`);
  document.querySelector('#lFalar').onclick = () => { if (perto) abrirNpc(perto); };
}
const NPCS = [['mercador', 'Mercador', 'lad'], ['curandeira', 'Curandeira', 'mag'], ['cacador', 'Caçador', 'arq']];
const ICO_NPC = { mercador: 'ouro', curandeira: 'coracao', cacador: 'chefe' };
const precoPocao = () => Math.round(15 + E.sis().nivel * 6);
export function passoExpl(dt) {
  const L = H.L(), j = L.lider, st = estadoExpl(), agora = Date.now();
  j.x = Math.max(MUNDO.x - MEIO_MUNDO, Math.min(MUNDO.x + MEIO_MUNDO, j.x)); j.z = Math.max(MUNDO.z - MEIO_MUNDO, Math.min(MUNDO.z + MEIO_MUNDO, j.z));
  // revela a névoa em volta do herói
  const [ci, ck] = celula(j.x, j.z), rc = Math.ceil(RAIO_VER / CEL);
  for (let k = ck - rc; k <= ck + rc; k++) for (let i = ci - rc; i <= ci + rc; i++) {
    if (i < 0 || k < 0 || i >= N || k >= N || nev[k * N + i]) continue;
    const cx = MUNDO.x - TAM_MUNDO / 2 + (i + 0.5) * CEL, cz = MUNDO.z - TAM_MUNDO / 2 + (k + 0.5) * CEL;
    if (Math.hypot(cx - j.x, cz - j.z) < RAIO_VER) { nev[k * N + i] = 1; sujo = true; }
  }
  if (sujo) { sujo = false; let s = ''; for (const v of nev) s += v; st.nevoa = s; }
  tPoi -= dt;
  if (tPoi <= 0) { tPoi = 0.2;
    for (const o of POIS) {
      const d = Math.hypot(o.x - j.x, o.z - j.z);
      if (o.tipo === 'bau' && d < 5 && !(st.baus[o.id] > agora)) abrirBau(o, st, agora);
      if (o.tipo === 'local' && d < 16 && !st.locais[o.id]) descobrir(o, st);
      if (o.tipo === 'portal' && d < 8 && !st.portais[o.id]) { st.portais[o.id] = 1; H.faixa('PORTAL ATIVADO', `${o.nome} · abra o mapa para viajar`); som('lendario'); C.onda(o.x, o.z, 10, 0x7ad0ff, 0.8); }
      if (o.tipo === 'covil' && d < 70 && !(st.covis[o.id] > agora) && !L.inimigos.some(e => e.covil === o.id && e.hp > 0)) acordarCovil(o, L);
    }
  }
  // NPCs das vilas
  let np = null, d0 = 5.5;
  for (const n of npcs || []) { const d = Math.hypot(n.x - j.x, n.z - j.z); if (d < 70) n.v.mixer.update(dt); if (d < d0) { d0 = d; np = n; } }
  if (np !== perto) { perto = np; const b = document.querySelector('#lFalar'); if (b) { b.hidden = !np; if (np) b.innerHTML = `${ico(ICO_NPC[np.tipo])} Falar com ${np.nome}`; } }
  tMapa -= dt; if (tMapa <= 0) { tMapa = 0.25; desenharMapa(document.querySelector('#lMapa'), j, false); atualizarTarefa(); }
}
// ---------------- NPCs: mercador, curandeira e caçador (tarefas de caça, como no Tibia) ----------------
function atualizarTarefa() {
  const el = document.querySelector('#lTarefa'); if (!el) return; const t = S.tarefa;
  el.hidden = !t; if (t) el.innerHTML = `${ico('chefe')} <b>${t.nome}</b> ${Math.min(t.feito, t.meta)}/${t.meta}${t.feito >= t.meta ? ' ✓' : ''}`;
}
export function abateTarefa(e) {
  const t = S.tarefa; if (!t || e.tp !== t.tp || t.feito >= t.meta) return;
  t.feito++; if (t.feito === t.meta) { H.faixa('CAÇADA COMPLETA!', `Volte a um Caçador para receber a recompensa`); som('marco'); }
}
function abrirNpc(n) {
  const L = H.L(), j = L.lider, box = document.querySelector('#luta'); if (!box) return;
  document.querySelector('.lPainel')?.remove(); som('abrir');
  const p = document.createElement('div'); p.className = 'lPainel';
  const desenhar = () => {
    let h = `<h3>${ico(ICO_NPC[n.tipo])} ${n.nome} · ${n.vila.nome}</h3>`;
    if (n.tipo === 'mercador') { const comuns = (S.mochila || []).filter(i => i.rar <= 1 && !Object.values(S.equip || {}).some(x => x?.id === i.id)), val = comuns.reduce((a, i) => a + Math.round(precoItem(i)), 0);
      h += `<p>Poções: <b>${S.pocoes}</b> · Ouro: <b>${fmt(S.ouro)}</b></p><div class="linha"><button class="btn verde peq" data-n="p1">Poção ${ico('ouro')}${precoPocao()}</button><button class="btn verde peq" data-n="p5">5 poções ${ico('ouro')}${precoPocao() * 5}</button></div>
        <p class="suave">Vender itens Comuns e Incomuns da mochila (${comuns.length}): ${ico('ouro')}${fmt(val)}</p><button class="btn amarelo peq ${comuns.length ? '' : 'sem'}" data-n="vender">Vender</button>`; }
    if (n.tipo === 'curandeira') h += `<p>"Descanse, aventureiro. Eu cuido das suas feridas."</p><p>Vida: <b>${Math.round(j.hp)}/${Math.round(j.max)}</b></p><button class="btn verde peq" data-n="curar">${ico('coracao')} Curar tudo</button>
      <p class="suave">Se você cair no mundo, perde 10% do ouro e 30% do XP do nível. A <b>Bênção</b> protege da próxima queda.</p>
      ${S.bencao ? `<p>${ico('estrela')} <b>Abençoado:</b> a próxima queda não tira nada.</p>` : `<button class="btn roxo peq" data-n="bencao">${ico('estrela')} Bênção ${ico('ouro')}${fmt(E.precoBencao())}</button>`}`;
    if (n.tipo === 'cacador') { const t = S.tarefa;
      if (!t) { const o = oferta(n); h += `<p>"Os monstros estão atacando as caravanas. Me ajude!"</p><p>Caçada: derrote <b>${o.meta} ${o.nome}</b></p><p class="suave">Recompensa: ${ico('ouro')}${fmt(o.ouro)} · ${fmt(o.xp)} XP · ${ico('gema')}${o.gemas}</p><button class="btn verde peq" data-n="aceitar">Aceitar</button>`; }
      else if (t.feito >= t.meta) h += `<p>"Excelente trabalho!"</p><button class="btn amarelo peq" data-n="entregar">Receber ${ico('ouro')}${fmt(t.ouro)} · ${fmt(t.xp)} XP · ${ico('gema')}${t.gemas} · 2 pergaminhos</button>`;
      else h += `<p>Caçada: <b>${t.nome}</b> ${t.feito}/${t.meta}</p><p class="suave">Eles vivem em: ${REGIOES[t.r].nome}</p><button class="btn cinza peq" data-n="desistir">Desistir da caçada</button>`; }
    p.innerHTML = h + `<button class="btn azul peq" data-n="fechar">Fechar</button>`;
  };
  desenhar(); box.append(p);
  p.onclick = e => { const b = e.target.closest('[data-n]'); if (!b) return; e.stopPropagation(); const a = b.dataset.n;
    if (a === 'fechar') { p.remove(); som('fechar'); return; }
    if (a === 'p1' || a === 'p5') { const q = a === 'p5' ? 5 : 1, c = precoPocao() * q; if (S.ouro >= c) { S.ouro -= c; S.pocoes += q; som('moedas'); } else som('erro'); }
    if (a === 'vender') { let t = 0; for (const i of [...(S.mochila || [])]) if (i.rar <= 1 && !Object.values(S.equip || {}).some(x => x?.id === i.id)) t += E.venderItem(i.id); if (t) { som('moedas'); H.numero(j.x, 5, j.z, `+${fmt(t)} ouro`, '#ffd84a', true); } }
    if (a === 'bencao') { if (E.comprarBencao()) { som('lendario'); C.onda(j.x, j.z, 6, 0xfff2a0, 0.7); C.faiscas(j.x, 3, j.z, 0xfff2a0, 40, 4); } else som('erro'); }
    if (a === 'curar') { j.hp = j.max; C.faiscas(j.x, 2, j.z, 0x7aff9a, 30, 4); som('marco'); }
    if (a === 'aceitar') { S.tarefa = oferta(n); som('confirma'); }
    if (a === 'entregar') { const t = S.tarefa; S.ouro += t.ouro; S.st.ouroTotal += t.ouro; S.gemas += t.gemas; E.ganharXPSis(t.xp); E.ganharPergaminho(2); S.tarefa = null; S.st.tarefas = (S.st.tarefas || 0) + 1;
      H.faixa('RECOMPENSA!', `+${fmt(t.ouro)} ouro · +${fmt(t.xp)} XP · +${t.gemas} gemas`); som('lendario'); C.faiscas(j.x, 3, j.z, 0xffd84a, 50, 6); }
    if (a === 'desistir') { S.tarefa = null; som('fechar'); }
    atualizarTarefa(); desenhar(); };
}
// caçada oferecida por um caçador: um monstro da região da vila (sempre o mesmo por vila e dia, para não ficar trocando)
function oferta(n) {
  const r = n.vila.r, tipos = H.fauna(r), dia = Math.floor(Date.now() / 86400e3), tp = tipos[(dia + n.vila.id.charCodeAt(1)) % tipos.length], meta = 10 + r * 2;
  return { tp, nome: H.nomeMonstro(tp), meta, feito: 0, r, ouro: Math.round(25 * 2.4 ** r * meta), xp: Math.round(10 * 2.2 ** r * meta), gemas: 5 + r * 2 };
}
export const pocoes = () => S.pocoes || 0;
export function usarPocao(j) { if (!S.pocoes || j.hp >= j.max) return false; S.pocoes--; j.hp = Math.min(j.max, j.hp + j.max * 0.4); C.faiscas(j.x, 2, j.z, 0x7aff9a, 25, 4); som('marco'); return true; }
function abrirBau(o, st, agora) {
  const L = H.L(), r = o.r, ouro = Math.round(40 * 2.4 ** r * (0.8 + Math.random() * 0.5)); st.baus[o.id] = agora + BAU_VOLTA; baus[o.id].visible = false;
  S.ouro += ouro; S.st.ouroTotal += ouro; L.ganhos && (L.ganhos.ouro += ouro); E.ganharXPSis(Math.round(8 * 2.2 ** r));
  H.numero(o.x, 5, o.z, `+${fmt(ouro)} ouro`, '#ffd84a', true); C.faiscas(o.x, 1.5, o.z, 0xffd84a, 30, 5); som('moedas');
  if (Math.random() < 0.3) { const it = gerarItem(Math.max(1, E.sis().nivel) + r * 3, sortearRaridade(0.3)); L.loot.push(it); H.numero(o.x, 7, o.z, 'Item!', '#7ad0ff', true); }
  if (Math.random() < 0.15) { const g = 3 + Math.floor(Math.random() * 6); S.gemas += g; H.numero(o.x + 1, 6, o.z, `+${g} gemas`, '#b88bff'); }
  if (Math.random() < 0.2) { E.ganharPergaminho(); H.numero(o.x - 1, 8, o.z, 'Pergaminho de treino!', '#c9a0ff'); }
  S.st.bausMundo = (S.st.bausMundo || 0) + 1;
}
function descobrir(o, st) {
  st.locais[o.id] = 1; const xp = Math.round(60 * 2.2 ** o.r); E.ganharXPSis(xp); S.gemas += 5;
  H.numero(o.x, 8, o.z, `+${fmt(xp)} XP · +5 gemas`, '#9fe3ff', true); C.onda(o.x, o.z, 14, 0x9fe3ff, 0.8); C.faiscas(o.x, 3, o.z, 0x9fe3ff, 40, 6);
  H.faixa('LOCAL DESCOBERTO', `${o.nome} · ${locaisAchados()}/${totalLocais()}`); som('lendario');
}
function acordarCovil(o, L) {
  const m = H.criarMonstro(o.chefe, o.r, o.x, o.z, true);
  Object.assign(m, { nome: `${o.nomeChefe} · Chefe`, unico: true, raro: true, covil: o.id, acordado: false, hp: m.hp * 3, max: m.max * 3, dano: m.dano * 1.3 });
  m.v.raiz.scale.multiplyScalar(1.3); m.alt *= 1.3; L.inimigos.push(m);
  H.faixa(o.nome.toUpperCase(), 'Um chefe guarda este lugar!', 'unico');
}
export function covilDerrotado(e) {
  const st = estadoExpl(); st.covis[e.covil] = Date.now() + COVIL_VOLTA; S.gemas += 15;
  H.numero(e.x, 9, e.z, '+15 gemas', '#b88bff', true); H.faixa('CHEFE DERROTADO!', 'Ele volta em 40 minutos', 'unico');
}

// ---------------- minimapa ----------------
function fundo() {
  if (fundo.cv) return fundo.cv;
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'), P = v => (v + TAM_MUNDO / 2) / TAM_MUNDO * 256;
  g.fillStyle = '#5c8f3a'; g.fillRect(0, 0, 256, 256);
  CENTROS.forEach((c, i) => { const x = P(c.x - MUNDO.x), y = P(c.z - MUNDO.z), gr = g.createRadialGradient(x, y, 0, x, y, 26); gr.addColorStop(0, ESTILO[i].chao); gr.addColorStop(0.7, ESTILO[i].chao); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); });
  g.strokeStyle = '#c9b28a'; g.lineWidth = 2.5; g.lineJoin = 'round'; g.beginPath(); TRILHA.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](P(p.x - MUNDO.x), P(p.z - MUNDO.z))); g.stroke();
  return (fundo.cv = cv);
}
export function desenharMapa(cv, j, grande) {
  if (!cv) return; estadoExpl();
  const W = cv.width, g = cv.getContext('2d'), k = W / 256, P = v => (v + TAM_MUNDO / 2) / TAM_MUNDO * W, st = S.expl, agora = Date.now();
  g.drawImage(fundo(), 0, 0, W, W);
  g.fillStyle = 'rgba(12,16,24,.92)'; const c = W / N;
  for (let kk = 0; kk < N; kk++) for (let i = 0; i < N; i++) if (!nev[kk * N + i]) g.fillRect(i * c - 0.3, kk * c - 0.3, c + 0.6, c + 0.6);
  const px = o => P(o.x - MUNDO.x), pz = o => P(o.z - MUNDO.z);
  g.fillStyle = '#fff'; g.font = `800 ${10 * k}px system-ui`; g.textAlign = 'center';
  g.fillText('⌂', px(GUILDA_W), pz(GUILDA_W) + 4 * k);
  for (const o of POIS) {
    if (!visto(o.x, o.z)) continue; const x = px(o), y = pz(o);
    if (o.tipo === 'bau' && !(st.baus[o.id] > agora)) { g.fillStyle = '#ffd84a'; g.fillRect(x - 2 * k, y - 1.5 * k, 4 * k, 3 * k); }
    if (o.tipo === 'local') { g.fillStyle = st.locais[o.id] ? '#9fe3ff' : '#fff'; g.fillText(st.locais[o.id] ? '★' : '?', x, y + 4 * k); }
    if (o.tipo === 'portal') { const on = st.portais[o.id]; g.fillStyle = on ? '#7ad0ff' : '#667'; g.fillText('◈', x, y + 4 * k); }
    if (o.tipo === 'vila') { g.fillStyle = '#ffe9b0'; g.fillText('⌂', x, y + 4 * k); }
    if (o.tipo === 'covil') { g.fillStyle = st.covis[o.id] > agora ? '#777' : '#ff4a3a'; g.beginPath(); g.arc(x, y, 4 * k, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillText('☠', x, y + 3.5 * k); }
    if (grande && o.tipo !== 'bau' && o.tipo !== 'portal' && (o.tipo !== 'local' || st.locais[o.id])) { g.font = `700 ${7 * k}px system-ui`; g.fillStyle = '#fff'; g.fillText(o.nome, x, y + 13 * k); g.font = `800 ${10 * k}px system-ui`; }
  }
  if (grande) REGIOES.forEach((r, i) => { if (!visto(CENTROS[i].x, CENTROS[i].z)) return; g.font = `800 ${8 * k}px system-ui`; g.fillStyle = '#ffe9b0'; g.fillText(`${r.nome} · Nv ${1 + i * 8}+`, px(CENTROS[i]), pz(CENTROS[i])); g.font = `800 ${10 * k}px system-ui`; });
  if (j) { const x = px(j), y = pz(j); g.save(); g.translate(x, y); g.rotate(-j.ang + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5 * k;
    g.beginPath(); g.moveTo(0, -6 * k); g.lineTo(4.5 * k, 5 * k); g.lineTo(-4.5 * k, 5 * k); g.closePath(); g.fill(); g.stroke(); g.restore(); }
}
export function mapaGrande(j) {
  const d = document.createElement('div'); d.className = 'mapaG';
  d.innerHTML = `<div class="mapaCaixa"><h3>${ico('missoes')} Mapa do mundo</h3><canvas width="720" height="720"></canvas>
    <p><b>${porcentagem()}%</b> explorado · <b>${locaisAchados()}/${totalLocais()}</b> locais · ◈ portal (toque para viajar) · ⌂ vila · ★ local · ? a descobrir · ☠ covil · ▪ baú</p>
    <button class="btn azul">Fechar</button></div>`;
  document.body.append(d); const cv = d.querySelector('canvas'); desenharMapa(cv, j, true);
  d.onclick = e => {
    if (e.target === cv && j) { // viajar: toque num portal ativado
      const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) / r.width * TAM_MUNDO - TAM_MUNDO / 2 + MUNDO.x, mz = (e.clientY - r.top) / r.height * TAM_MUNDO - TAM_MUNDO / 2 + MUNDO.z;
      const o = POIS.filter(o => o.tipo === 'portal' && S.expl.portais[o.id]).sort((a, b) => Math.hypot(a.x - mx, a.z - mz) - Math.hypot(b.x - mx, b.z - mz))[0];
      if (o && Math.hypot(o.x - mx, o.z - mz) < 45) { j.x = o.x; j.z = o.z + 4; ui.foco = { x: j.x, z: j.z }; d.remove(); som('lendario'); C.onda(j.x, j.z, 8, 0x7ad0ff, 0.6); H.faixa('TELEPORTE', o.nome); }
      else som('erro');
      return; }
    if (e.target === d || e.target.closest('button')) { d.remove(); som('fechar'); } };
}
