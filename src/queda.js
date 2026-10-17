// Relatório de quedas: erros do JS, WebView que morreu (Android) e jogo fechado no meio de uma fase.
// Vai para a tabela ponte_erro (limitado no servidor) para descobrir por que o jogo fecha sozinho.
import { erroReg } from './online.js';

const VIVO = 'ponte_vivo';
let onde = () => '', enviados = 0;
const vistos = new Set();
const aparelho = () => { const u = navigator.userAgent; return `${(u.match(/\(([^)]*)\)/) || [])[1] || ''} ${(u.match(/Chrome\/[\d]+/) || [''])[0]} mem=${navigator.deviceMemory || '?'} tela=${screen.width}x${screen.height} q=${lerLocal('guilda_q') || 'media'}`; };
const memoria = () => performance.memory ? ` heap=${Math.round(performance.memory.usedJSHeapSize / 1048576)}MB` : '';
function lerLocal(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

export function reportar(tipo, msg, pilha = '', tela = onde()) {
  msg = String(msg || '').slice(0, 400); const k = tipo + msg;
  if (vistos.has(k) || enviados >= 10) return; vistos.add(k); enviados++;
  erroReg(tipo, msg, String(pilha || '').slice(0, 2000), String(tela || '').slice(0, 40), aparelho()).catch(() => {});
}

// fn() diz em que tela/fase o jogador está (ex.: 'jogo f12')
export function iniciarQuedas(fn) {
  onde = fn;
  addEventListener('error', e => reportar('js', e.message || 'erro', (e.error?.stack || '') + `\n@${e.filename}:${e.lineno}:${e.colno}` + memoria()));
  addEventListener('unhandledrejection', e => { const r = e.reason; if (/sem conexão|segredo|nome_espera/.test(r?.message || '')) return; reportar('promessa', r?.message || String(r), (r?.stack || '') + memoria()); });
  // queda registrada pelo Android (WebView morreu ou erro do Java)
  try { const q = window.App?.queda?.(); if (q) reportar('android', q.split('\n')[0], q, ''); } catch (e) {}
  // ficou marcado "em fase" e com a tela aberta: o jogo fechou na frente do jogador
  try { const v = JSON.parse(lerLocal(VIVO) || 'null');
    if (v && !v.fundo) reportar('fechou', `fechou em ${v.onde} depois de ${Math.round((v.u - v.t0) / 1000)}s`, `fps=${v.fps} heap=${v.heap}MB`, v.onde); } catch (e) {}
  try { localStorage.removeItem(VIVO); } catch (e) {}
  addEventListener('visibilitychange', () => batida(document.hidden));
  addEventListener('pagehide', () => batida(true));
  setInterval(() => batida(false), 10000);
}

// durante a fase o jogo marca que está vivo; ao sair da fase limpa
let marca = null, fps = 0;
export const medirFps = f => { fps = Math.round(f); };
export function emFase(sim) {
  marca = sim ? { t0: Date.now() } : null;
  if (!sim) { try { localStorage.removeItem(VIVO); } catch (e) {} return; }
  batida(false);
}
function batida(fundo) {
  if (!marca) return;
  try { localStorage.setItem(VIVO, JSON.stringify({ t0: marca.t0, u: Date.now(), onde: onde(), fundo: fundo || document.hidden, fps, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0 })); } catch (e) {}
}
