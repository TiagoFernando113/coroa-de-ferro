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
// app em segundo plano ou tela desligada: o som para (e volta quando o jogo aparece de novo)
function pausarSom(p) { if (!actx) return; if (p) actx.suspend().catch(() => {}); else actx.resume().catch(() => {}); }
window.__pausar = pausarSom;
document.addEventListener('visibilitychange', () => pausarSom(document.hidden));
addEventListener('pagehide', () => pausarSom(true));
addEventListener('pageshow', () => pausarSom(false));
export function som(n, vol = 0.6) {
  if (mudo || !actx || !sons[n]) return;
  const a = actx.currentTime; if (ultimoSom[n] && a - ultimoSom[n] < 0.08) return; ultimoSom[n] = a; // evita metralhadora de sons iguais
  const s = actx.createBufferSource(), g = actx.createGain(); g.gain.value = vol * 0.8; s.buffer = sons[n]; s.playbackRate.value = 0.92 + Math.random() * 0.16;
  s.connect(g).connect(actx.destination); s.start();
}

// ---- efeitos de interface: moedas voando até o contador, brilho na tela, número subindo ----
export function voarMoedas(alvo, n = 10, de = null) {
  const t = typeof alvo === 'string' ? document.querySelector(alvo) : alvo; if (!t || !t.getClientRects().length) return;
  const r = t.getBoundingClientRect(), x1 = r.left + r.width / 2, y1 = r.top + r.height / 2, x0 = de?.x ?? innerWidth / 2, y0 = de?.y ?? innerHeight * 0.45;
  for (let i = 0; i < n; i++) { const m = document.createElement('div'); m.className = 'moedaVoa'; m.innerHTML = ico('ouro');
    const dx = (Math.random() - 0.5) * 140, dy = (Math.random() - 0.5) * 100; m.style.left = x0 + 'px'; m.style.top = y0 + 'px'; document.body.append(m);
    const a = m.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 }, { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1.1)`, opacity: 1, offset: 0.35 },
      { transform: `translate(calc(-50% + ${x1 - x0}px),calc(-50% + ${y1 - y0}px)) scale(.6)`, opacity: 1 }], { duration: 750 + i * 45, easing: 'cubic-bezier(.5,0,.6,1)', delay: i * 35, fill: 'forwards' });
    a.onfinish = () => { m.remove(); t.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 160 }); if (i % 3 === 0) som('moedas', 0.25); }; }
}
export function flashTela(cor = '#fff', forca = 0.55) {
  const f = document.createElement('div'); f.className = 'flashTela'; f.style.background = cor; document.body.append(f);
  f.animate([{ opacity: forca }, { opacity: 0 }], { duration: 450, easing: 'ease-out' }).onfinish = () => f.remove();
}
export function contarAte(el, ate, ms = 700, pre = '+', formatar = String, de = 0) {
  if (!el) return; const t0 = performance.now(), passo = agora => { const k = Math.min(1, (agora - t0) / ms), v = Math.round(de + (ate - de) * (1 - (1 - k) ** 3)); el.textContent = pre + formatar(v); if (k < 1) requestAnimationFrame(passo); }; requestAnimationFrame(passo);
}
