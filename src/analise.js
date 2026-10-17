// O que está sendo jogado: cada partida terminada vira um registro (modo, fase/onda, resultado, duração)
// e o app avisa a cada minuto que está aberto (painel "online agora" no Discord).
import * as ON from './online.js';

const inicio = {};
export const comecou = modo => { inicio[modo] = Date.now(); };
export function partida(modo, fase = null, venceu = null, dados = null) {
  const dur = inicio[modo] ? Math.round((Date.now() - inicio[modo]) / 1000) : null; delete inicio[modo];
  ON.evento(modo, fase, venceu, dur, dados).catch(() => {});
}
export function iniciarPing(onde) {
  const p = () => { if (!document.hidden) ON.ping(onde()).catch(() => {}); };
  setTimeout(p, 4000); setInterval(p, 60000); document.addEventListener('visibilitychange', p);
}
