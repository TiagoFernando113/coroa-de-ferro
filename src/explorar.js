// Exploração do mundo aberto: névoa de guerra (minimapa), baús escondidos, locais para descobrir e covis de chefes.
import * as C from './cena.js';
import * as E from './estado.js';
import { S } from './estado.js';
import { POIS, MUNDO, TAM_MUNDO, MEIO_MUNDO, CENTROS, GUILDA_W, TRILHA, ESTILO } from './mundo.js';
import { REGIOES, fmt } from './dados.js';
import { gerarItem, sortearRaridade } from './itens.js';
import { ico, som } from './ui.js';

const N = 48, CEL = TAM_MUNDO / N, RAIO_VER = 55, BAU_VOLTA = 3 * 3600e3, COVIL_VOLTA = 40 * 60e3;
window.__pois = POIS; window.__trilha = TRILHA; // para testes
let nev = null, H = null, baus = {}, tMapa = 0, tPoi = 0, sujo = false;
export function estadoExpl() {
  if (!S.expl) S.expl = { nevoa: '', baus: {}, locais: {}, covis: {} };
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
  H = h; const st = estadoExpl(), agora = Date.now();
  for (const o of POIS) if (o.tipo === 'bau' && !baus[o.id]) { const b = C.objeto('D:chest', 3); b.position.set(o.x, 0, o.z); b.rotation.y = (o.x * 7) % 6; baus[o.id] = b; }
  for (const o of POIS) if (o.tipo === 'bau') baus[o.id].visible = !(st.baus[o.id] > agora);
}
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
      if (o.tipo === 'covil' && d < 70 && !(st.covis[o.id] > agora) && !L.inimigos.some(e => e.covil === o.id && e.hp > 0)) acordarCovil(o, L);
    }
  }
  tMapa -= dt; if (tMapa <= 0) { tMapa = 0.25; desenharMapa(document.querySelector('#lMapa'), j, false); }
}
function abrirBau(o, st, agora) {
  const L = H.L(), r = o.r, ouro = Math.round(40 * 2.4 ** r * (0.8 + Math.random() * 0.5)); st.baus[o.id] = agora + BAU_VOLTA; baus[o.id].visible = false;
  S.ouro += ouro; S.st.ouroTotal += ouro; L.ganhos && (L.ganhos.ouro += ouro); E.ganharXPSis(Math.round(8 * 2.2 ** r));
  H.numero(o.x, 5, o.z, `+${fmt(ouro)} ouro`, '#ffd84a', true); C.faiscas(o.x, 1.5, o.z, 0xffd84a, 30, 5); som('moedas');
  if (Math.random() < 0.3) { const it = gerarItem(Math.max(1, E.sis().nivel) + r * 3, sortearRaridade(0.3)); L.loot.push(it); H.numero(o.x, 7, o.z, 'Item!', '#7ad0ff', true); }
  if (Math.random() < 0.15) { const g = 3 + Math.floor(Math.random() * 6); S.gemas += g; H.numero(o.x + 1, 6, o.z, `+${g} gemas`, '#b88bff'); }
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
    if (o.tipo === 'covil') { g.fillStyle = st.covis[o.id] > agora ? '#777' : '#ff4a3a'; g.beginPath(); g.arc(x, y, 4 * k, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillText('☠', x, y + 3.5 * k); }
    if (grande && o.tipo !== 'bau' && (o.tipo === 'covil' || st.locais[o.id])) { g.font = `700 ${7 * k}px system-ui`; g.fillStyle = '#fff'; g.fillText(o.nome, x, y + 13 * k); g.font = `800 ${10 * k}px system-ui`; }
  }
  if (grande) REGIOES.forEach((r, i) => { if (!visto(CENTROS[i].x, CENTROS[i].z)) return; g.font = `800 ${8 * k}px system-ui`; g.fillStyle = '#ffe9b0'; g.fillText(r.nome, px(CENTROS[i]), pz(CENTROS[i])); g.font = `800 ${10 * k}px system-ui`; });
  if (j) { const x = px(j), y = pz(j); g.save(); g.translate(x, y); g.rotate(-j.ang + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5 * k;
    g.beginPath(); g.moveTo(0, -6 * k); g.lineTo(4.5 * k, 5 * k); g.lineTo(-4.5 * k, 5 * k); g.closePath(); g.fill(); g.stroke(); g.restore(); }
}
export function mapaGrande(j) {
  const d = document.createElement('div'); d.className = 'mapaG';
  d.innerHTML = `<div class="mapaCaixa"><h3>${ico('missoes')} Mapa do mundo</h3><canvas width="720" height="720"></canvas>
    <p><b>${porcentagem()}%</b> explorado · <b>${locaisAchados()}/${totalLocais()}</b> locais · ★ descoberto · ? a descobrir · ☠ covil de chefe · ▪ baú</p>
    <button class="btn azul">Fechar</button></div>`;
  document.body.append(d); desenharMapa(d.querySelector('canvas'), j, true);
  d.onclick = e => { if (e.target === d || e.target.closest('button')) { d.remove(); som('fechar'); } };
}
