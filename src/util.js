// Ícones, sons e fontes.
import { ICONES } from './icones.js';
import { iniciarMusica, musicaMudo, tema } from './musica.js';
export const $ = s => document.querySelector(s);
export const ico = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 512 512" aria-hidden="true">${ICONES[n] || ''}</svg>`;
let actx = null, sons = {}, mudo = false;
try { mudo = localStorage.getItem('guilda_mudo') === '1'; } catch (e) {}
export const estaMudo = () => mudo;
export function alternarSom() { mudo = !mudo; musicaMudo(mudo); try { localStorage.setItem('guilda_mudo', mudo ? '1' : '0'); } catch (e) {} return mudo; }
export async function carregarRecursos(buf) {
  const tam = new DataView(buf).getUint32(0, true), cab = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, tam))), base = 4 + tam;
  const pedaco = ([i, l]) => buf.slice(base + i, base + i + l);
  for (const [k, pos] of Object.entries(cab)) if (k.startsWith('fonte:')) {
    const f = new FontFace(k === 'fonte:titulo' ? 'Titulo' : 'Texto', pedaco(pos)); await f.load(); document.fonts.add(f);
  }
  const iniciarAudio = () => {
    if (actx) return; actx = new (window.AudioContext || window.webkitAudioContext)();
    for (const [k, pos] of Object.entries(cab)) if (!k.startsWith('fonte:')) actx.decodeAudioData(pedaco(pos)).then(b => { sons[k] = b; }).catch(() => {});
    iniciarMusica(actx, mudo); tema('guilda');
  };
  addEventListener('pointerdown', iniciarAudio, { once: true });
}
const ultimoSom = {};
export function som(n, vol = 0.6) {
  if (mudo || !actx || !sons[n]) return;
  const a = actx.currentTime; if (ultimoSom[n] && a - ultimoSom[n] < 0.08) return; ultimoSom[n] = a; // evita metralhadora de sons iguais
  const s = actx.createBufferSource(), g = actx.createGain(); g.gain.value = vol * 0.8; s.buffer = sons[n]; s.playbackRate.value = 0.92 + Math.random() * 0.16;
  s.connect(g).connect(actx.destination); s.start();
}
