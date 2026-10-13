// Ponto de entrada: carrega modelos e recursos, monta a ponte e roda o laço.
import * as C from './cena.js';
import { VERSAO } from './dados.js';
import { carregar } from './meta.js';
import { iniciarPets } from './pets.js';
import { iniciarIdioma, idiomaEscolhido, mudarIdioma, IDIOMAS } from './i18n.js';
import { $, carregarRecursos, som } from './util.js';
import { montarPonte, abrirLobby, passo, _G, _sim, _construir } from './ponte.js';

window.VERSAO = VERSAO;
let qualidade = 'media';
try { qualidade = localStorage.getItem('guilda_q') || 'media'; } catch (e) {}

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
  } catch (e) { $('.tMenu').innerHTML = `<p>Não foi possível carregar 😢<br><small>${e.message}</small></p>`; return; }
  $('#carga').hidden = true;
  carregar(); iniciarPets(); montarPonte(); abrirLobby();
  let ultimo = performance.now();
  const laco = agora => { const dt = Math.min(0.1, (agora - ultimo) / 1000); ultimo = agora; passo(dt); requestAnimationFrame(laco); };
  requestAnimationFrame(laco);
  const entrar = () => { const b = document.createElement('button'); b.className = 'btn verde grande'; b.textContent = 'Defender a ponte';
    b.onclick = () => { som('confirma'); $('#titulo').classList.add('sai'); setTimeout(() => $('#titulo').remove(), 600); };
    $('.tMenu').innerHTML = ''; $('.tMenu').append(b); };
  // primeira vez: escolher o idioma
  if (idiomaEscolhido()) entrar();
  else { $('.tMenu').innerHTML = `<div class="idiomas" data-nt>${IDIOMAS.map(([k, n, f]) => `<button class="btn azul" data-idioma="${k}"><span class="flag">${f}</span>${n}</button>`).join('')}</div>`;
    $('.tMenu').onclick = e => { const b = e.target.closest('[data-idioma]'); if (!b) return; som('clique'); mudarIdioma(b.dataset.idioma); $('.tMenu').onclick = null; entrar(); }; }
  window.__C = C; window.__cam = C.camera; window.__G = _G; window.__sim = _sim; window.__construir = _construir; // para testes
}

comecar();
