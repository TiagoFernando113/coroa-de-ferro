// Música gerada por código (Web Audio), sem arquivos: bateria, baixo, acordes e uma melodia composta.
// 'menu' é calmo; 'batalha' tem bateria cheia e o tema heroico (intensidade 2 = chefe furioso).
import { SONS } from './sons.js';
let ctx = null, mestre = null, bus = null, eco = null, mudo = false, atual = null, prox = 0, passo = 0, timer = null, nivel = 1, ruido = null, transp = 0;
const VOL = 0.55;
const hz = m => 440 * 2 ** ((m - 69) / 12);
// ---- composição (passos de 1/16; null = sem nota nova) ----
const _ = null;
const MUSICAS = {
  menu: { bpm: 92, acordes: [[60, 64, 67], [55, 59, 62, 67], [57, 60, 64], [53, 57, 60, 65]], baixo: [48, 43, 45, 41],
    melodia: [
      [72, _, _, _, 74, _, 76, _, _, _, 79, _, 76, _, _, _], [74, _, _, _, 71, _, _, _, 74, _, 76, _, 74, _, _, _],
      [72, _, _, _, 76, _, 79, _, _, _, 81, _, 79, _, 76, _], [77, _, _, _, 76, _, 74, _, _, _, 72, _, _, _, _, _]] },
  batalha: { bpm: 128, acordes: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], baixo: [45, 41, 48, 43],
    melodia: [
      [76, _, 76, _, 74, _, 72, _, 74, _, 76, _, _, _, 69, _], [72, _, 72, _, 74, _, 76, _, 77, _, 76, _, 74, _, 72, _],
      [79, _, _, _, 76, _, 72, _, 74, _, 76, _, 79, _, 77, _], [76, _, _, _, 74, _, _, _, 71, _, 72, _, 74, _, _, _]] },
};
export function iniciarMusica(c, semSom) {
  if (ctx) return; ctx = c; mudo = semSom;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
  mestre = ctx.createGain(); mestre.gain.value = mudo ? 0 : VOL; mestre.connect(comp).connect(ctx.destination);
  bus = ctx.createGain(); bus.gain.value = 1; bus.connect(mestre);
  // eco (delay com realimentação) para a melodia ganhar espaço
  eco = ctx.createDelay(1); const fb = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; fb.gain.value = 0.32;
  eco.connect(lp).connect(fb).connect(eco); lp.connect(mestre);
  ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  timer = setInterval(agendar, 60);
}
export function musicaMudo(m) { mudo = m; if (mestre) mestre.gain.setTargetAtTime(m ? 0 : VOL, ctx.currentTime, 0.2); }
// k: 'menu' | 'batalha' | número da fase (batalha com tom diferente)
export function tema(k) {
  if (!ctx) return; const m = k === 'menu' || k === 'guilda' ? MUSICAS.menu : MUSICAS.batalha;
  const tr = typeof k === 'number' ? [0, 2, -2, 3, -3, 1, 5, -1][k % 8] : 0;
  nivel = 1; if (m === atual && tr === transp) return;
  atual = m; transp = tr; passo = 0; prox = Math.max(prox, ctx.currentTime + 0.15);
}
export function intensidade(n) { nivel = n; }
// ---- instrumentos ----
function env(g, t, a, v, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
function osc(tipo, f, t, dur, v, destino, a = 0.005, det = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = tipo; o.frequency.value = f; o.detune.value = det; env(g, t, a, v, dur);
  o.connect(g).connect(destino); o.start(t); o.stop(t + dur + 0.05); return o;
}
function bumbo(t, v = 0.9) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); env(g, t, 0.002, v, 0.32); o.connect(g).connect(bus); o.start(t); o.stop(t + 0.35); }
function barulho(t, dur, v, tipo, f, q = 1, destino = bus) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = ruido; fl.type = tipo; fl.frequency.value = f; fl.Q.value = q; env(g, t, 0.002, v, dur);
  s.connect(fl).connect(g).connect(destino); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02); return fl;
}
const caixa = (t, v = 0.38) => { barulho(t, 0.16, v, 'bandpass', 1800, 0.8); osc('triangle', 190, t, 0.08, v * 0.5, bus); };
const chimbal = (t, aberto, v = 0.1) => barulho(t, aberto ? 0.18 : 0.045, v, 'highpass', 7500);
function baixo(t, f, dur) {
  const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f;
  fl.type = 'lowpass'; fl.Q.value = 6; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(220, t + dur); env(g, t, 0.005, 0.22, dur);
  o.connect(fl).connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
}
function acorde(t, notas, dur, v) {
  const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = nivel >= 2 ? 2600 : 1500; fl.connect(bus);
  for (const n of notas) for (const det of [-8, 8]) osc('sawtooth', hz(n + transp), t, dur, v, fl, 0.03, det);
}
function lider(t, f, dur, v = 0.09) {
  const fl = ctx.createBiquadFilter(), g = ctx.createGain(); fl.type = 'lowpass'; fl.frequency.value = 3200; g.gain.value = 1; fl.connect(g); g.connect(bus); g.connect(eco);
  osc('square', f, t, dur, v * 0.6, fl, 0.01, -6); osc('triangle', f * 2, t, dur, v * 0.5, fl, 0.01, 4);
}
function dedilhado(t, f, v = 0.07) { osc('triangle', f, t, 0.5, v, bus, 0.003); osc('sine', f * 2, t, 0.25, v * 0.4, eco, 0.003); }
// ---- agenda (1/16 por passo) ----
function agendar() {
  if (!ctx || !atual || mudo || ctx.state !== 'running') return;
  const M = atual, s16 = 60 / M.bpm / 4;
  while (prox < ctx.currentTime + 0.25) {
    const comp = Math.floor(passo / 16), p = passo % 16, i = comp % 4, ciclo = Math.floor(comp / 4), t = prox;
    if (M === MUSICAS.menu) {
      if (p === 0) { acorde(t, M.acordes[i], s16 * 16, 0.018); bumbo(t, 0.35); }
      if (p % 4 === 2) chimbal(t, false, 0.04);
      if (p % 2 === 0) { const n = M.acordes[i][(p / 2) % M.acordes[i].length] + 12; dedilhado(t, hz(n + transp), 0.05); }
      if (ciclo % 2 === 1) { const n = M.melodia[i][p]; if (n) lider(t, hz(n + transp), s16 * 3, 0.05); }
      if (p === 0 || p === 8) baixo(t, hz(M.baixo[i] + transp), s16 * 7);
    } else {
      // bateria: bumbo e caixa marcados, chimbal em colcheias (semicolcheias na fúria)
      if (p % 4 === 0) bumbo(t); if (p === 4 || p === 12) caixa(t); if (nivel >= 2 && (p === 14 || p === 15)) caixa(t, 0.2);
      if (nivel >= 2 ? true : p % 2 === 0) chimbal(t, p % 8 === 6, p % 4 === 2 ? 0.12 : 0.07);
      if (i === 3 && p >= 12 && ciclo % 2 === 1) caixa(t, 0.15 + (p - 12) * 0.06); // virada
      // baixo pulsando em colcheias com oitava
      if (p % 2 === 0) baixo(t, hz(M.baixo[i] + transp + ([0, 0, 12, 0, 0, 12, 0, 12][(p / 2) % 8])), s16 * 1.8);
      if (p === 0 || p === 6 || p === 10) acorde(t, M.acordes[i], s16 * (p === 0 ? 5 : 3), 0.016);
      // melodia: entra no segundo ciclo e alterna (fica marcante sem cansar)
      if (ciclo % 3 !== 0 || nivel >= 2) { const n = M.melodia[i][p]; if (n) lider(t, hz(n + transp + (nivel >= 2 && ciclo % 2 ? 12 : 0)), s16 * 2.5); }
      else if (p % 2 === 0) dedilhado(t, hz(M.acordes[i][(p / 2) % 3] + 12 + transp), 0.04);
    }
    prox += s16; passo++;
  }
}
// ---- efeitos ----
const ESCALA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]; // pentatônica menor: tudo combina com a música
let ultimo = {};
export function sfx(n, k = 0) {
  if (!ctx || mudo) return; const a = ctx.currentTime;
  if (ultimo[n] && a - ultimo[n] < (n === 'arco' ? 0.09 : 0.04)) return; ultimo[n] = a;
  if (n === 'arco') { const f = barulho(a, 0.12, 0.05, 'bandpass', 2400, 2, mestre); f.frequency.exponentialRampToValueAtTime(700, a + 0.12); }
  if (n === 'nota') { // bloco quebrado: notas subindo a cada acerto seguido
    const m = 69 + transp + ESCALA[Math.min(k, ESCALA.length - 1)];
    osc('triangle', hz(m), a, 0.35, 0.13, mestre, 0.002); osc('sine', hz(m + 12), a, 0.2, 0.06, eco, 0.002); }
  if (n === 'brilho') { [0, 4, 7, 12].forEach((s, i) => osc('triangle', hz(81 + transp + s), a + i * 0.05, 0.3, 0.07, mestre, 0.002)); }
  if (n === 'magia') { for (const [f0, f1] of [[300, 1200], [450, 1800]]) { const o = osc('sine', f0, a, 0.3, 0.08, mestre, 0.01); o.frequency.exponentialRampToValueAtTime(f1, a + 0.25); } }
  if (n === 'impacto') { bumbo(a, 0.7); barulho(a, 0.25, 0.25, 'lowpass', 900); }
  if (n === 'vitoria') { [[69, 0], [73, 0.12], [76, 0.24], [81, 0.36]].forEach(([m, d]) => lider(a + d, hz(m + transp), d === 0.36 ? 1.2 : 0.2, 0.1)); acorde(a + 0.36, [57, 61, 64, 69], 1.4, 0.03); }
  if (n === 'ovo') { osc('triangle', hz(76 + transp + (k % 3) * 2), a, 0.12, 0.08, mestre, 0.002); barulho(a, 0.06, 0.12, 'bandpass', 3200, 3, mestre); } // toc-toc no ovo
  if (n === 'quebra') { barulho(a, 0.3, 0.3, 'highpass', 2500, 1, mestre); [0, 4, 7, 12, 16].forEach((s, i) => osc('triangle', hz(76 + transp + s), a + 0.08 + i * 0.06, 0.4, 0.08, eco, 0.002)); }
  if (n === 'estrela') { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => { osc('square', hz(72 + transp + s), a + i * 0.07, 0.25, 0.05, mestre, 0.002); osc('sine', hz(84 + transp + s), a + i * 0.07, 0.4, 0.04, eco, 0.002); }); }
  if (n === 'pet') { const o = osc('square', 520 + Math.random() * 200, a, 0.08, 0.05, mestre, 0.002); o.frequency.exponentialRampToValueAtTime(260, a + 0.08); barulho(a, 0.05, 0.08, 'bandpass', 1400, 2, mestre); }
  if (n === 'trombeta') { [[60, 0], [64, 0.14], [67, 0.28], [72, 0.42]].forEach(([m, d]) => { const f = hz(m + transp); osc('sawtooth', f, a + d, d === 0.42 ? 0.7 : 0.16, 0.06, mestre, 0.01); osc('square', f * 2, a + d, d === 0.42 ? 0.7 : 0.16, 0.025, mestre, 0.01); }); }
  if (n === 'medalha') { [[72, 0], [79, 0.1], [84, 0.2], [88, 0.3]].forEach(([m, d]) => osc('triangle', hz(m + transp), a + d, 0.5, 0.09, eco, 0.002)); osc('sine', hz(96 + transp), a + 0.3, 0.8, 0.05, eco, 0.002); }
  if (n === 'derrota') { [[64, 0], [63, 0.25], [62, 0.5], [57, 0.75]].forEach(([m, d]) => osc('triangle', hz(m), a + d, 0.6, 0.1, mestre, 0.01)); }
}
// sons das figurinhas da dupla (curtinhos e engraçados)
export function somFigurinha(k) {
  if (!ctx || mudo) return; const a = ctx.currentTime;
  if (SONS[k]) return tocarAmostra(k, SONS[k], k === 'toma' ? 1 : 0.75); // som gravado; os de baixo ficam de reserva
  const desliza = (tipo, f0, f1, t, dur, v) => { const o = osc(tipo, f0, t, dur, v, mestre, 0.005); o.frequency.exponentialRampToValueAtTime(f1, t + dur); return o; };
  if (k === 'gg') { [[72, 0], [76, 0.09], [79, 0.18]].forEach(([m, d]) => osc('square', hz(m), a + d, 0.12, 0.06, mestre, 0.003)); [72, 76, 79, 84].forEach(m => osc('triangle', hz(m), a + 0.27, 0.6, 0.05, eco, 0.003)); }
  if (k === 'bora') { barulho(a, 0.25, 0.18, 'bandpass', 1200, 0.7, mestre).frequency.exponentialRampToValueAtTime(3500, a + 0.22); osc('square', hz(67), a + 0.18, 0.1, 0.07, mestre); osc('square', hz(74), a + 0.3, 0.22, 0.07, mestre); }
  if (k === 'socorro') { const o = desliza('sine', 1300, 260, a, 0.7, 0.1); const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 9; lg.gain.value = 40; lfo.connect(lg).connect(o.frequency); lfo.start(a); lfo.stop(a + 0.75); }
  if (k === 'ajuda') { [0, 0.16, 0.42, 0.58].forEach((d, i) => osc('square', i % 2 ? 660 : 880, a + d, 0.12, 0.05, mestre, 0.003)); }
  if (k === 'toma') { bumbo(a, 0.9); barulho(a, 0.12, 0.3, 'lowpass', 1400, 1, mestre); desliza('square', 900, 120, a + 0.02, 0.18, 0.05); }
  if (k === 'facil') { [0, 0.14, 0.28].forEach((d, i) => desliza('triangle', 300 + i * 120, 520 + i * 120, a + d, 0.09, 0.08)); }
  if (k === 'top') { const o = desliza('sine', 180, 820, a, 0.35, 0.1); const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 18; lg.gain.value = 60; lfo.connect(lg).connect(o.frequency); lfo.start(a); lfo.stop(a + 0.4);
    [0, 4, 7, 12].forEach((s, i) => osc('triangle', hz(84 + s), a + 0.32 + i * 0.05, 0.25, 0.05, eco, 0.002)); }
}
// som gravado (base64): decodifica uma vez e toca
const amostras = {};
function tocarAmostra(nome, b64, vol = 1) {
  const tocar = buf => { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; g.gain.value = vol; s.connect(g).connect(mestre); s.start(); };
  if (amostras[nome]) { if (amostras[nome] !== 'carregando') tocar(amostras[nome]); return; }
  amostras[nome] = 'carregando'; const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  ctx.decodeAudioData(bin.buffer).then(buf => { amostras[nome] = buf; tocar(buf); }).catch(() => { delete amostras[nome]; });
}
