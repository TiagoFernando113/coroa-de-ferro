// Ponto de entrada: carrega modelos e recursos, abre o save (com ganhos offline) e roda o laço.
import * as C from './cena.js';
import * as E from './estado.js';
import { montarBase, atualizarHerois, efeitosBase, posHeroi, revestir } from './base.js';
import { abrirCriador, passoCriador, criadorAberto } from './criador.js';
import { montarMundoMapa, atualizarMundo } from './mundo.js';
import { passoLuta } from './luta.js';
import { montar, atualizar, ui, carregarRecursos, boasVindas, flutuar3d, som, novidadeCriador, novidadeRacas } from './ui.js';
import { VERSAO } from './dados.js';
import { iniciarEtapas } from './etapas.js';

const $ = s => document.querySelector(s);
window.VERSAO = VERSAO;
try { ui.qualidade = localStorage.getItem('guilda_q') || 'media'; } catch (e) {}

async function baixar(url, prog) {
  const resp = await fetch(url), total = +resp.headers.get('content-length') || 0;
  if (!resp.body || !total) return resp.arrayBuffer();
  const leitor = resp.body.getReader(), partes = []; let lido = 0;
  for (;;) { const { done, value } = await leitor.read(); if (done) break; partes.push(value); lido += value.length; prog(lido / total); }
  const u8 = new Uint8Array(lido); let o = 0; for (const p of partes) { u8.set(p, o); o += p.length; } return u8.buffer;
}

async function comecar() {
  C.iniciar($('#cena'), ui.qualidade);
  const barra = $('#carga i'); let pm = 0, pr = 0; const prog = () => { barra.style.width = Math.round((pm * 0.9 + pr * 0.1) * 100) + '%'; };
  try {
    const [, rec] = await Promise.all([
      C.carregar('modelos.bin', p => { pm = p; prog(); }),
      baixar('recursos.bin', p => { pr = p; prog(); }),
    ]);
    await carregarRecursos(rec);
  } catch (e) { $('.tMenu').innerHTML = `<p>Não foi possível carregar 😢<br><small>${e.message}</small></p>`; return; }
  $('#carga').hidden = true;
  const novo = !E.carregar(); if (novo) E.novo();
  const b = document.createElement('button'); b.className = 'btn verde grande'; b.textContent = novo ? 'Fundar minha guilda' : 'Entrar na guilda';
  b.onclick = () => { som('confirma'); entrar(novo); };
  $('.tMenu').innerHTML = ''; $('.tMenu').append(b);
}

function entrar(novo) {
  $('#titulo').classList.add('sai'); setTimeout(() => $('#titulo').remove(), 600);
  const off = novo ? null : E.offline();
  iniciarEtapas(); montarBase(); montarMundoMapa(); montar();
  C.camera.yaw = Math.PI - 0.45; C.camera.pitch = 0.95; C.camera.dist = 74;
  if (novo) E.S.viuRacas = true;
  if (novo) abrirCriador(E.S.lider, { primeiro: true, aoFechar: () => revestir(E.S.lider) });
  else if (!E.S.lider) novidadeCriador();
  else if (!E.S.viuRacas) { E.S.viuRacas = true; novidadeRacas(); }
  else if (off) boasVindas(off);
  let ultimo = performance.now(), salvarT = 0;
  const laco = agora => {
    const dt = Math.min(0.1, (agora - ultimo) / 1000); ultimo = agora;
    E.passo(dt);
    passoCriador(dt);
    atualizarHerois(dt); atualizarMundo(dt); passoLuta(dt); efeitosBase(dt, (x, y, z, v) => flutuar3d(x, y, z, v));
    if (!criadorAberto()) atualizar(dt);
    C.quadro(dt, ui.foco);
    salvarT += dt; if (salvarT > 5) { salvarT = 0; E.salvar(); }
    requestAnimationFrame(laco);
  };
  requestAnimationFrame(laco);
  addEventListener('visibilitychange', () => { if (document.hidden) E.salvar(); else { const o = E.offline(); if (o.seg > 60) boasVindas(o); } });
  window.__E = E; window.__info = C.info; window.__cam = C.camera; window.__ui = ui; window.__pos = posHeroi; window.__C = C; // para testes
}

comecar();
