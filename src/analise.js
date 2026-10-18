// O que está sendo jogado: cada partida terminada vira um registro (modo, fase/onda, resultado, duração)
// e o app avisa a cada minuto que está aberto (painel "online agora" no Discord).
import * as ON from './online.js';
import * as C from './cena.js';
import * as Q from './queda.js';

const inicio = {};
export const comecou = modo => { inicio[modo] = Date.now(); };
export function partida(modo, fase = null, venceu = null, dados = null) {
  const dur = inicio[modo] ? Math.round((Date.now() - inicio[modo]) / 1000) : null; delete inicio[modo];
  ON.evento(modo, fase, venceu, dur, dados).catch(() => {});
}
// impressão do aparelho: igual para todas as contas criadas no mesmo celular (para o Discord juntar)
function impressao() {
  const n = navigator, txt = [n.userAgent, screen.width + 'x' + screen.height, devicePixelRatio, n.hardwareConcurrency, n.deviceMemory, Intl.DateTimeFormat().resolvedOptions().timeZone, n.language, C.gpuNome()].join('|');
  let h = 2166136261, h2 = 5381; for (let i = 0; i < txt.length; i++) { const c = txt.charCodeAt(i); h = Math.imul(h ^ c, 16777619); h2 = Math.imul(h2, 33) ^ c; }
  return (h >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
export function iniciarPing(onde) {
  const p = () => { if (!document.hidden) ON.ping(onde()).catch(() => {}); };
  setTimeout(p, 4000); setInterval(p, 60000); document.addEventListener('visibilitychange', p);
  setTimeout(() => ON.disp(impressao(), Q.aparelho()).catch(() => {}), 6000);
}
