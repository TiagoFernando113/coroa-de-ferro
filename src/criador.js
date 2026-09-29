// Criador de heróis: escolhe peças, cores (cada zona da roupa), corpo e armas, com prévia 3D girando no palco.
import * as C from './cena.js';
import { S, heroi, salvar } from './estado.js';
import { PARTES, ARMAS, ESQUERDA, PELES, PALETA, CORPO, ESTILOS, visualPadrao, visualAleatorio, animAtaque } from './aparencia.js';
import { CLASSES, nomeAleatorio } from './dados.js';
import { ico, som, ui } from './ui.js';

const $ = s => document.querySelector(s);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ABAS = [['estilo', 'Estilo', 'c_estilo'], ['rosto', 'Rosto', 'c_rosto'], ['corpo', 'Corpo', 'c_corpo'], ['roupa', 'Roupa', 'c_roupa'],
  ['armas', 'Armas', 'c_armas'], ['cores', 'Cores', 'c_cores'], ['nome', 'Nome', 'c_nome']];
const ROTULO = { cab: 'Rosto', cha: 'Chapéu', mas: 'Máscara', tro: 'Tronco', bra: 'Braços', per: 'Pernas', capa: 'Capa', cos: 'Costas' };
let E = null; // estado do criador aberto
export const criadorAberto = () => !!E;

export function abrirCriador(id, { primeiro = false, aoFechar = null } = {}) {
  const h = heroi(id); if (!h || E) return;
  const v = JSON.parse(JSON.stringify(h.visual || visualPadrao(h.cls)));
  E = { h, v, nome: h.nome, cls: h.cls, primeiro, aoFechar, aba: primeiro ? 'estilo' : 'rosto', zona: null, giro: 0, anim: 'Idle', camAntes: { ...C.camera, alvo: null }, focoAntes: { ...ui.foco } };
  C.estudio(true);
  E.P = C.heroi(v); E.P.raiz.position.set(C.ESTUDIO.x, 0, C.ESTUDIO.z); E.P.tocar('Idle');
  ui.foco = { x: C.ESTUDIO.x, z: C.ESTUDIO.z }; C.camera.yaw = Math.PI; C.camera.pitch = 0.18; C.camera.dist = 12; C.camera.suave = 30;
  C.deslocarVista(0.2);
  const el = document.createElement('div'); el.id = 'criador';
  el.innerHTML = `<div id="crTopo"><h2>${primeiro ? 'Crie seu herói' : 'Personalizar'}</h2>
      <div class="crAnims">${[['Idle', 'Parado', 'c_estilo'], ['Walking_A', 'Andar', 'andar'], ['ataque', 'Atacar', 'c_armas'], ['Cheering', 'Festejar', 'festa'], ['Waving', 'Acenar', 'mao2']]
        .map(([a, t, i]) => `<button data-anim="${a}" title="${t}">${ico(i)}</button>`).join('')}</div></div>
    <div id="crGiro"></div>
    <section id="crPainel"><nav>${ABAS.map(([k, t, i]) => `<button data-aba="${k}">${ico(i)}<span>${t}</span></button>`).join('')}</nav>
      <div id="crCorpo"></div>
      <footer>${primeiro ? '' : '<button class="btn cinza" data-cr="cancelar">Cancelar</button>'}<button class="btn verde" data-cr="pronto">${ico('check')} Pronto!</button></footer></section>`;
  document.body.append(el); $('#hud').style.visibility = 'hidden';
  el.addEventListener('click', clique); el.addEventListener('input', entrada);
  el.addEventListener('change', e => { if (E && (e.target.dataset.pelelivre != null || e.target.dataset.pintarlivre != null)) setTimeout(desenhar, 80); });
  // arrastar a prévia gira o herói
  const g = $('#crGiro'); let x0 = null;
  g.addEventListener('pointerdown', e => { x0 = e.clientX; g.setPointerCapture(e.pointerId); });
  g.addEventListener('pointermove', e => { if (x0 == null) return; E.giro += (e.clientX - x0) * 0.012; x0 = e.clientX; });
  g.addEventListener('pointerup', () => { x0 = null; });
  desenhar();
}
function fechar(ok) {
  const { h, v, P } = E;
  if (ok) { h.visual = v; h.nome = (E.nome || '').trim().slice(0, 16) || h.nome; if (E.primeiro) h.cls = E.cls; S.lider = h.id; salvar(); }
  P.remover(); C.estudio(false); C.deslocarVista(0);
  Object.assign(C.camera, { yaw: E.camAntes.yaw, pitch: E.camAntes.pitch, dist: E.camAntes.dist, suave: 10 }); ui.foco = E.focoAntes;
  $('#criador').remove(); $('#hud').style.visibility = '';
  const cb = E.aoFechar; E = null; cb && cb(ok);
}
export function passoCriador(dt) {
  if (!E) return;
  E.giro *= 1; E.P.raiz.rotation.y = E.giro + Math.sin(C.tempo() * 0.5) * 0.08;
  E.P.mixer.update(dt);
  if (E.animFim && C.tempo() > E.animFim) { E.animFim = 0; E.animAtual = 'Idle'; E.P.tocar('Idle'); }
}
// troca de peça/cor: recria o boneco inteiro (religar peças novas num esqueleto já animado deixava o corpo parado)
function refazer() {
  const P = C.heroi(E.v); P.raiz.position.copy(E.P.raiz.position); P.raiz.rotation.y = E.P.raiz.rotation.y;
  E.P.remover(); E.P = P; P.tocar(E.animAtual || 'Idle', { loop: !E.animFim });
}
function mudou() { refazer(); desenhar(); }
function tocar(a) {
  const n = a === 'ataque' ? animAtaque(E.v) : a;
  E.animAtual = n; E.P.tocar(n, { loop: a === 'Idle' || a === 'Walking_A', reinicia: true });
  E.animFim = a === 'Idle' || a === 'Walking_A' ? 0 : C.tempo() + 1.6;
}
const chip = (k, id, nome, on) => `<button class="crOp ${on ? 'on' : ''}" data-k="${k}" data-v="${esc(id)}">${esc(nome)}</button>`;
const grupo = (tit, k) => `<h4>${tit}</h4><div class="crOps">${PARTES[k].ops.map(o => chip(k, o.id, o.nome, E.v[k] === o.id)).join('')}</div>`;
const barra = k => { const [a, b, t] = CORPO[k], v = E.v[k] || 1; return `<label class="crBarra"><span>${t}</span><input type="range" min="${a}" max="${b}" step="0.01" value="${v}" data-corpo="${k}"><b>${Math.round(v * 100)}%</b></label>`; };
function desenhar() {
  document.querySelectorAll('#crPainel nav [data-aba]').forEach(b => b.classList.toggle('on', b.dataset.aba === E.aba));
  const v = E.v; let h = '';
  if (E.aba === 'estilo') {
    if (E.primeiro) h += `<h4>Classe (como luta nas missões)</h4><div class="crClasses">${Object.entries(CLASSES).map(([k, c]) => `<button class="crCls ${E.cls === k ? 'on' : ''}" data-cls="${k}" style="--c:${c.cor}"><span class="circ" style="--c:${c.cor}">${ico(c.icone)}</span><b>${c.nome}</b></button>`).join('')}</div>`;
    h += `<h4>Visual pronto</h4><div class="crOps">${ESTILOS.map(e => `<button class="crOp" data-estilo="${e.id}">${e.nome}</button>`).join('')}<button class="crOp dado" data-estilo="?">${ico('dado')} Aleatório</button></div>
      <p class="suave">Depois ajuste cada detalhe nas outras abas: rosto, corpo, roupa, armas e a cor de cada pedacinho.</p>`;
  }
  if (E.aba === 'rosto') h += grupo('Rosto e cabelo', 'cab') + `<h4>Pele</h4><div class="crCores">${['', ...PELES].map(c => `<button class="crCor ${v.pele === c ? 'on' : ''}" data-pele="${c}" style="--cor:${c || '#f3bd98'}">${c ? '' : ico('check')}</button>`).join('')}<label class="crCor livre" style="--cor:${v.pele || '#f3bd98'}">${ico('pincel')}<input type="color" data-pelelivre value="${v.pele || '#f3bd98'}"></label></div>`
    + barra('cabT') + grupo('Chapéu e elmo', 'cha') + grupo('Máscara', 'mas');
  if (E.aba === 'corpo') h += barra('alt') + barra('larg') + barra('musc') + grupo('Tronco', 'tro') + grupo('Braços', 'bra') + grupo('Pernas', 'per');
  if (E.aba === 'roupa') h += grupo('Capa', 'capa') + grupo('Costas', 'cos');
  if (E.aba === 'armas') h += `<h4>Mão direita</h4><div class="crOps">${ARMAS.map(a => chip('arma', a.id, a.nome, v.arma === a.id)).join('')}</div>
    <h4>Mão esquerda</h4><div class="crOps">${ESQUERDA.map(a => chip('esq', a.id, a.nome, v.esq === a.id)).join('')}</div>`;
  if (E.aba === 'cores') {
    const zs = C.zonasDe(v);
    h += `<p class="suave">Toque numa bolinha para pintar aquela parte.</p>`;
    for (const [k, l] of Object.entries(zs)) if (l.length) h += `<div class="crZonas"><span>${ROTULO[k]}</span>${l.map(z => `<button class="crCor ${E.zona === z.chave ? 'on' : ''}" data-zona="${z.chave}" style="--cor:${z.cor}"></button>`).join('')}</div>`;
    if (E.zona) {
      const atual = v.cores[E.zona];
      h += `<div class="crPaleta"><div class="crCores">${PALETA.map(c => `<button class="crCor ${atual === c ? 'on' : ''}" data-pintar="${c}" style="--cor:${c}"></button>`).join('')}
        <label class="crCor livre" style="--cor:${atual || '#888888'}">${ico('pincel')}<input type="color" data-pintarlivre value="${atual || '#888888'}"></label></div>
        <button class="btn cinza peq" data-cr="original">Cor original</button></div>`;
    }
    h += `<button class="btn cinza peq" data-cr="limpar">Restaurar todas as cores</button>`;
  }
  if (E.aba === 'nome') h += `<h4>Nome do herói</h4><div class="crNome"><input maxlength="16" data-nome value="${esc(E.nome)}"><button class="btn azul peq" data-cr="sortear">${ico('dado')}</button></div>
    <p class="suave">${E.primeiro ? 'Este é o líder da sua guilda. Você pode mudar a aparência depois, em Heróis.' : 'Mude quando quiser.'}</p>`;
  $('#crCorpo').innerHTML = h;
}
function clique(e) {
  const b = e.target.closest('button'); if (!b || !E) return;
  const d = b.dataset;
  if (d.aba) { E.aba = d.aba; som('clique'); desenhar(); $('#crCorpo').scrollTop = 0; return; }
  if (d.anim) { som('clique'); tocar(d.anim); return; }
  if (d.cr === 'pronto') { som('confirma'); fechar(true); return; }
  if (d.cr === 'cancelar') { som('fechar'); fechar(false); return; }
  if (d.cls) { E.cls = d.cls; E.v = { ...visualPadrao(d.cls), cores: {} }; som('clique'); mudou(); tocar('ataque'); return; }
  if (d.estilo) { E.v = d.estilo === '?' ? visualAleatorio(E.cls) : visualPadrao(d.estilo); if (d.estilo === '?') { E.v.cores = {}; } som('clique'); mudou(); tocar('Cheering'); return; }
  if (d.k) { E.v[d.k] = d.v; som('clique'); mudou(); if (d.k === 'arma' || d.k === 'esq') tocar('ataque'); return; }
  if (d.pele != null) { E.v.pele = d.pele; som('clique'); mudou(); return; }
  if (d.zona) { E.zona = E.zona === d.zona ? null : d.zona; som('clique'); desenhar(); return; }
  if (d.pintar) { E.v.cores[E.zona] = d.pintar; delete E.v.tinta; som('clique'); mudou(); return; }
  if (d.cr === 'original') { delete E.v.cores[E.zona]; som('clique'); mudou(); return; }
  if (d.cr === 'limpar') { E.v.cores = {}; delete E.v.tinta; E.v.pele = ''; E.zona = null; som('clique'); mudou(); return; }
  if (d.cr === 'sortear') { E.nome = nomeAleatorio(S.herois.map(x => x.nome)); som('clique'); desenhar(); }
}
let tEntrada = 0;
function entrada(e) {
  const t = e.target, d = t.dataset; if (!E) return;
  if (d.corpo) { E.v[d.corpo] = +t.value; t.nextElementSibling.textContent = Math.round(t.value * 100) + '%'; E.P.ajustarCorpo(E.v); return; }
  if (d.nome != null) { E.nome = t.value; return; }
  // seletor de cor livre: repinta com um pequeno intervalo (gerar textura custa um pouco)
  const aplicar = () => { if (d.pelelivre != null) E.v.pele = t.value; if (d.pintarlivre != null) E.v.cores[E.zona] = t.value; refazer(); t.parentElement.style.setProperty('--cor', t.value); };
  clearTimeout(tEntrada); tEntrada = setTimeout(aplicar, 60);
}
