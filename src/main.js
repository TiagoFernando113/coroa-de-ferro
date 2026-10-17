// Ponto de entrada: carrega modelos e recursos, monta a ponte e roda o laço.
import * as C from './cena.js';
import { VERSAO } from './dados.js';
import { carregar } from './meta.js';
import { iniciarPets } from './pets.js';
import { iniciarIdioma, idiomaEscolhido, mudarIdioma, IDIOMAS } from './i18n.js';
import { $, carregarRecursos, som } from './util.js';
import { montarPonte, abrirLobby, passo, ondeEsta, _G, _sim, _construir } from './ponte.js';
import * as Q from './queda.js';

window.VERSAO = VERSAO;
let qualidade = 'media';
try { qualidade = localStorage.getItem('guilda_q') || ((navigator.deviceMemory || 8) <= 4 ? 'baixa' : 'media'); } catch (e) {} // celular com pouca memória já começa no modo leve

async function baixar(url, prog) {
  const resp = await fetch(url), total = +resp.headers.get('content-length') || 0;
  if (!resp.body || !total) return resp.arrayBuffer();
  const leitor = resp.body.getReader(), partes = []; let lido = 0;
  for (;;) { const { done, value } = await leitor.read(); if (done) break; partes.push(value); lido += value.length; prog(lido / total); }
  const u8 = new Uint8Array(lido); let o = 0; for (const p of partes) { u8.set(p, o); o += p.length; } return u8.buffer;
}

async function comecar() {
  iniciarIdioma();
  C.iniciar($('#cena'), qualidade);
  const barra = $('#carga i'); let pm = 0, pr = 0; const prog = () => { barra.style.width = Math.round((pm * 0.9 + pr * 0.1) * 100) + '%'; };
  try {
    const [, rec] = await Promise.all([
      C.carregar('modelos.bin', p => { pm = p; prog(); }),
      baixar('recursos.bin', p => { pr = p; prog(); }),
    ]);
    await carregarRecursos(rec);
  } catch (e) { Q.reportar('carga', e.message, e.stack, 'carga'); $('.tMenu').innerHTML = `<p>Não foi possível carregar 😢<br><small>${e.message}</small></p>`; return; }
  $('#carga').hidden = true;
  carregar(); Q.iniciarQuedas(ondeEsta); iniciarPets(); montarPonte(); abrirLobby();
  let ultimo = performance.now();
  // mede o FPS: se ficar travando por ~8 s seguidos, liga o modo leve sozinho (e guarda para a próxima vez)
  let jan = 0, quadros = 0, ruins = 0;
  const medirFps = dt => { if (document.hidden || C.qualidadeAtual() === 'baixa') return; jan += dt; quadros++;
    if (jan >= 4) { const fps = quadros / jan; Q.medirFps(fps); ruins = fps < 24 ? ruins + 1 : 0; jan = 0; quadros = 0;
      if (ruins >= 2) { C.modoLeve(); try { localStorage.setItem('guilda_q', 'baixa'); } catch (e) {} avisoLeve(); } } };
  const laco = agora => { const dt0 = (agora - ultimo) / 1000, dt = Math.min(0.1, dt0); ultimo = agora; if (dt0 < 1) medirFps(dt0); passo(dt); requestAnimationFrame(laco); };
  requestAnimationFrame(laco);
  const entrar = () => { const b = document.createElement('button'); b.className = 'btn verde grande'; b.textContent = 'Defender a ponte';
    b.onclick = () => { som('confirma'); $('#titulo').classList.add('sai'); setTimeout(() => $('#titulo').remove(), 600); };
    $('.tMenu').innerHTML = ''; $('.tMenu').append(b); };
  // primeira vez: escolher o idioma
  if (idiomaEscolhido()) entrar();
  else { $('.tMenu').innerHTML = `<p class="tIdiomaT" data-nt>🌎 Idioma · Language</p><div class="idiomas" data-nt>${IDIOMAS.map(([k, n, f]) => `<button class="btn azul" data-idioma="${k}"><span class="flag">${f}</span>${n}</button>`).join('')}</div>`;
    $('.tMenu').onclick = e => { const b = e.target.closest('[data-idioma]'); if (!b) return; som('clique'); mudarIdioma(b.dataset.idioma); $('.tMenu').onclick = null; entrar(); }; }
  window.__C = C; window.__cam = C.camera; window.__G = _G; window.__sim = _sim; window.__construir = _construir; // para testes
}

function avisoLeve() {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = 'Modo leve ligado para o jogo rodar melhor'; document.body.append(d); setTimeout(() => d.remove(), 3500);
}
comecar();
