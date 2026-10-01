// Música gerada por código (Web Audio): um tema por lugar, sem arquivos de música.
// Cada tema tem tom, escala, andamento e progressão; à noite fica mais calma e escura.
let ctx = null, mestre = null, filtro = null, atual = null, noite = false, mudo = false, prox = 0, passo = 0, timer = null;
const TEMAS = {
  guilda: { raiz: 55, esc: [0, 2, 4, 5, 7, 9, 11], bpm: 88, prog: [0, 3, 4, 0], onda: 'triangle', dens: 0.7 },
  0: { raiz: 50, esc: [0, 2, 3, 5, 7, 9, 10], bpm: 84, prog: [0, 3, 0, 6], onda: 'triangle', dens: 0.6 },   // Floresta (dórico)
  1: { raiz: 52, esc: [0, 1, 3, 5, 7, 8, 10], bpm: 68, prog: [0, 1, 0, 5], onda: 'sine', dens: 0.4 },       // Pântano (frígio)
  2: { raiz: 57, esc: [0, 2, 3, 5, 7, 8, 10], bpm: 76, prog: [0, 5, 3, 4], onda: 'sine', dens: 0.5 },       // Montanhas
  3: { raiz: 50, esc: [0, 1, 4, 5, 7, 8, 10], bpm: 92, prog: [0, 1, 0, 6], onda: 'triangle', dens: 0.7 },   // Deserto
  4: { raiz: 53, esc: [0, 2, 4, 6, 7, 9, 11], bpm: 72, prog: [0, 1, 4, 0], onda: 'sine', dens: 0.5 },       // Ruínas Élficas (lídio)
  5: { raiz: 48, esc: [0, 2, 3, 5, 7, 8, 11], bpm: 104, prog: [0, 5, 4, 0], onda: 'sawtooth', dens: 0.8 },  // Vulcão
  6: { raiz: 47, esc: [0, 2, 3, 5, 7, 8, 10], bpm: 62, prog: [0, 5, 3, 4], onda: 'sine', dens: 0.3 },       // Cemitério
  7: { raiz: 48, esc: [0, 1, 3, 5, 6, 8, 10], bpm: 94, prog: [0, 1, 5, 4], onda: 'square', dens: 0.6 },     // Trono
};
const hz = m => 440 * 2 ** ((m - 69) / 12);
const nota = (t, grau, oit = 0) => { const e = t.esc, n = e.length; return t.raiz + e[((grau % n) + n) % n] + 12 * (oit + Math.floor(grau / n)); };
export function iniciarMusica(c, semSom) {
  if (ctx) return; ctx = c; mudo = semSom;
  filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 2400;
  mestre = ctx.createGain(); mestre.gain.value = mudo ? 0 : 0.09; filtro.connect(mestre).connect(ctx.destination);
  timer = setInterval(agendar, 100);
}
export function musicaMudo(m) { mudo = m; if (mestre) mestre.gain.setTargetAtTime(m ? 0 : 0.09, ctx.currentTime, 0.3); }
export function tema(k, ehNoite = false) {
  if (!ctx) return; const t = TEMAS[k] || TEMAS.guilda;
  if (ehNoite !== noite) { noite = ehNoite; filtro.frequency.setTargetAtTime(noite ? 900 : 2400, ctx.currentTime, 1.5); }
  if (t === atual) return; atual = t; passo = 0; prox = Math.max(prox, ctx.currentTime + 0.3);
}
function voz(f, ini, dur, tipo, vol, ataque = 0.02) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = tipo; o.frequency.value = f;
  g.gain.setValueAtTime(0, ini); g.gain.linearRampToValueAtTime(vol, ini + ataque); g.gain.exponentialRampToValueAtTime(0.0008, ini + dur);
  o.connect(g).connect(filtro); o.start(ini); o.stop(ini + dur + 0.05);
}
function agendar() {
  if (!ctx || !atual || mudo || ctx.state !== 'running') return;
  const t = atual, colc = 60 / t.bpm / 2; // colcheia
  while (prox < ctx.currentTime + 0.4) {
    const compasso = Math.floor(passo / 8), grau = t.prog[compasso % t.prog.length], p8 = passo % 8;
    if (p8 === 0) { // acorde longo (pad) e baixo
      for (const g of [0, 2, 4]) { voz(hz(nota(t, grau + g)), prox, colc * 8.5, 'sine', 0.05, 0.4); voz(hz(nota(t, grau + g)) * 1.004, prox, colc * 8.5, 'triangle', 0.025, 0.5); }
      voz(hz(nota(t, grau, -1)), prox, colc * 6, 'triangle', 0.09, 0.05);
    }
    // arpejo (menos notas à noite)
    if (Math.random() < t.dens * (noite ? 0.45 : 1)) { const g = grau + [0, 2, 4, 7, 4, 2, 9, 4][p8]; voz(hz(nota(t, g, 1)), prox, colc * 1.6, t.onda, t.onda === 'sawtooth' || t.onda === 'square' ? 0.018 : 0.04); }
    prox += colc; passo++;
  }
}
// efeitos sintetizados (arco, magia)
export function sfx(n) {
  if (!ctx || mudo) return; const a = ctx.currentTime;
  if (n === 'arco') { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(420, a); o.frequency.exponentialRampToValueAtTime(140, a + 0.15);
    g.gain.setValueAtTime(0.25, a); g.gain.exponentialRampToValueAtTime(0.001, a + 0.2); o.connect(g).connect(ctx.destination); o.start(a); o.stop(a + 0.22); }
  if (n === 'magia') { for (const [f0, f1] of [[300, 1200], [450, 1800]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, a); o.frequency.exponentialRampToValueAtTime(f1, a + 0.25);
    g.gain.setValueAtTime(0.12, a); g.gain.exponentialRampToValueAtTime(0.001, a + 0.3); o.connect(g).connect(ctx.destination); o.start(a); o.stop(a + 0.32); } }
}
