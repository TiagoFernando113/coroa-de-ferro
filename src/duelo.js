// Duelo 1x1 (online): dois heróis numa arena do castelo, em cima da ponte. Melhor de 3 rodadas.
// Arraste para andar; parado, o herói atira sozinho no rival. Cada rodada começa com a escolha de 1 de 3 habilidades (e mais uma no meio).
// Rede: cada celular manda a posição do seu herói e os tiros que deu; quem leva o tiro confere o acerto (esquiva, escudo, estrela) e avisa a vida.
// O placar das rodadas é decidido por quem criou a sala (ou por este celular, contra o computador).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as C from './cena.js';
import { S, salvar, fimDeSemana, ganharBau, BAUS } from './meta.js';
import { HEROIS, heroiAtual } from './herois.js';
import { fmt } from './dados.js';
import { sfx, intensidade } from './musica.js';
import { ico, som, $, voarMoedas, flashTela, contarAte } from './util.js';
import { t as tr } from './i18n.js';
import * as ON from './online.js';
import * as Q from './queda.js';

const ZC = -45, LX = 12.5, LZ = 20, R = 1.1, VEL = 10, VEL_TIRO = 26, T_RODADA = 60, MEIO_RODADA = 25, VITORIAS = 2;
// obstáculos [x, z, meia largura, meia profundidade]; a arena é igual girando 180° (os dois veem a mesma coisa)
const BLOCOS = (() => { const b = [[-6.5, 8, 2.4, 0.9], [6.5, 3.5, 1.2, 1.2], [-10.4, 0.5, 0.9, 2.4], [0, 0, 2.2, 0.9]]; return [...b, ...b.filter(q => q[0] || q[1]).map(([x, z, w, d]) => [-x, -z, w, d])]; })();
// habilidades com as regras do Archero (flecha frontal -25% de dano, rajada dupla -15% de cadência e -10% de dano, parede -50% depois de quicar...)
const HAB = {
  frente: { nome: 'Flecha frontal', desc: '+1 flecha (-25% de dano)', icone: 'h_triplo', max: 2 },
  multi: { nome: 'Rajada dupla', desc: 'Atira 2 vezes seguidas (-15% de cadência)', icone: 'h_adagas', max: 1 },
  diag: { nome: 'Diagonais', desc: '+2 flechas em diagonal', icone: 'h_lamina', max: 2 },
  parede: { nome: 'Ricochete', desc: 'Tiros quicam nas paredes (-50% depois)', icone: 'girar', max: 1 },
  rapido: { nome: 'Cadência', desc: '+25% de velocidade de tiro', icone: 'raio', max: 3 },
  forca: { nome: 'Força', desc: '+25% de dano', icone: 'forca', max: 3 },
  critico: { nome: 'Crítico', desc: '+20% de chance e de dano crítico', icone: 'estrela', max: 2 },
  furia: { nome: 'Fúria', desc: 'Quanto menos vida, mais dano', icone: 'h_furia', max: 1 },
  esquiva: { nome: 'Esquiva', desc: '+20% de chance de desviar', icone: 'esquiva', max: 1 },
  estrela: { nome: 'Estrela', desc: '2 s invencível a cada 10 s', icone: 'coroa', max: 1 },
  escudo: { nome: 'Escudo', desc: 'Bloqueia os 2 próximos tiros', icone: 'escudo', max: 3 },
  vida: { nome: 'Coração', desc: '+20% de vida e cura tudo', icone: 'coracao', max: 2 },
  fogo: { nome: 'Fogo', desc: 'Tiros queimam o rival', icone: 'h_fogo', max: 1 },
  gelo: { nome: 'Gelo', desc: 'Tiros deixam o rival lento', icone: 'h_gelo', max: 1 },
  botas: { nome: 'Botas', desc: '+15% de velocidade', icone: 'botas', max: 2 },
};
let K = null, el = null, op = null;
const cn = () => C.obterCena();
const GEO_BALA = new THREE.SphereGeometry(0.45, 8, 6), mats = {}, matCor = c => mats[c] ||= new THREE.MeshBasicMaterial({ color: c });

// ---- arena: muralhas com ameias, muros e caixotes do castelo, torres nos cantos ----
function texCaixote() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#b07a42'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#9a6634'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 16 + 14, 64, 2);
  g.strokeStyle = '#6a4220'; g.lineWidth = 6; g.strokeRect(3, 3, 58, 58); g.beginPath(); g.moveTo(5, 5); g.lineTo(59, 59); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function muroAmeias(x, z, w, d, h, mat) { // caixa + ameias em cima, centrada em (x, z)
  const geos = [new THREE.BoxGeometry(w * 2, h, d * 2).translate(x, h / 2, z)], longo = w >= d, n = Math.max(1, Math.floor((longo ? w : d) * 2 / 1.6));
  for (let i = 0; i < n; i++) { const k = (i + 0.5) / n * 2 - 1; geos.push(new THREE.BoxGeometry(0.8, 0.7, 0.8).translate(longo ? x + k * (w - 0.4) : x, h + 0.35, longo ? z : z + k * (d - 0.4))); }
  const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = m.receiveShadow = true; return m;
}
function montarArena() {
  const grupo = new THREE.Group(), pedra = new THREE.MeshLambertMaterial({ color: 0x8f8a84 }), caixa = new THREE.MeshLambertMaterial({ map: texCaixote() });
  // piso de lajes mais escuras e o brasão no meio
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(LX * 2, LZ * 2).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x6a6460, transparent: true, opacity: 0.35 })); piso.position.set(0, 0.02, ZC); grupo.add(piso);
  const anel = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.8, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.5 })); anel.position.set(0, 0.04, ZC); grupo.add(anel);
  const linha = new THREE.Mesh(new THREE.PlaneGeometry(LX * 2, 0.25).rotateX(-Math.PI / 2), anel.material); linha.position.set(0, 0.04, ZC); grupo.add(linha);
  for (const s of [-1, 1]) { grupo.add(muroAmeias(s * (LX + 0.6), ZC, 0.6, LZ + 1.2, 1.6, pedra)); grupo.add(muroAmeias(0, ZC + s * (LZ + 0.6), LX + 1.2, 0.6, 1.6, pedra)); }
  for (const [x, z, w, d] of BLOCOS) {
    if (Math.abs(w - d) < 0.5) { // caixotes empilhados
      const g = [new THREE.BoxGeometry(w * 2, w * 2, d * 2).translate(x, w, ZC + z), new THREE.BoxGeometry(w * 1.3, w * 1.3, d * 1.3).rotateY(0.4).translate(x + 0.2, w * 2 + w * 0.65, ZC + z - 0.1)];
      const m = new THREE.Mesh(mergeGeometries(g), caixa); m.castShadow = m.receiveShadow = true; grupo.add(m);
    } else grupo.add(muroAmeias(x, ZC + z, w, d, 2, pedra));
  }
  cn().add(grupo);
  const torres = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) torres.push({ m: 'C:tower-square', x: sx * (LX + 2.2), z: ZC + sz * (LZ + 2.2), s: 4.5 }, { m: 'C:flag', x: sx * (LX + 2.2), y: 9, z: ZC + sz * (LZ + 2.2), s: 3.5 });
  return [grupo, C.montarEstatico(torres)];
}
const dentroBloco = (x, z, m = 0) => BLOCOS.find(([bx, bz, w, d]) => Math.abs(x - bx) < w + m && Math.abs(z - bz) < d + m);
function linhaLivre(a, b) { // nenhum obstáculo entre os dois
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.8); for (let i = 1; i < n; i++) { const k = i / n; if (dentroBloco(a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k, 0.3)) return false; } return true;
}
function empurrar(p) { // não atravessa paredes nem obstáculos
  p.x = Math.max(-LX + R, Math.min(LX - R, p.x)); p.z = Math.max(-LZ + R, Math.min(LZ - R, p.z));
  const b = dentroBloco(p.x, p.z, R); if (!b) return false; const [bx, bz, w, d] = b, px = w + R - Math.abs(p.x - bx), pz = d + R - Math.abs(p.z - bz);
  if (px < pz) p.x += Math.sign(p.x - bx || 1) * px; else p.z += Math.sign(p.z - bz || 1) * pz; return true;
}

// ---- heróis ----
function criarHeroi(hr, z) {
  const H = HEROIS[hr] || HEROIS.lyra, v = C.heroi(H.visual); v.raiz.scale.setScalar(2.3); v.tocar('Idle_A');
  const p = { hr, H, v, x: 0, z, z0: z, tx: 0, tz: z, ang: z > 0 ? Math.PI : 0, mov: false, cd: 0.6, flash: 0, lento: 0, escudo: 0, hab: {}, anim: '', queima: null, estrelaT: 8, inv: 0 };
  v.raiz.position.set(0, 0, ZC + z); return p;
}
function meusAtributos() {
  const H = heroiAtual(S), up = S.up, mult = 1 + Math.min(0.6, 0.03 * (up.fogo || 0)), hp = Math.round(1000 * (1 + Math.min(0.6, 0.03 * (up.vida || 0))));
  return { cadBase: 1.3 * H.ataque.cad, danoBase: Math.round(70 / H.ataque.cad * mult), hp };
}
const cadDe = p => p.cadBase * (1 + 0.25 * (p.hab.rapido || 0)) * (p.hab.multi ? 0.85 : 1);
const danoDe = p => p.danoBase * (1 + 0.25 * (p.hab.forca || 0)) * 0.75 ** (p.hab.frente || 0) * (p.hab.multi ? 0.9 : 1) * (p.hab.furia ? 1 + Math.max(0, 1 - p.hp / p.max) : 1);
const velDe = p => VEL * (1 + 0.15 * (p.hab.botas || 0)) * (p.lento > 0 ? 0.6 : 1);
function animar(p, nome, o) { if (p.anim === nome && !o) return; p.anim = nome; p.v.tocar(p.v.tem(nome) ? nome : 'Idle_A', o); }

// ---- partida ----
export function abrir(container, d, opcoes) {
  el = container; op = opcoes; el.hidden = false;
  const A = meusAtributos(), bot = !d.sala;
  K = { t: 0, estado: 'espera', esperaT: bot ? 1 : 10, conta: 0, bot, host: !!d.host || bot, nome: d.apelido || 'Rival', arena: montarArena(), tiros: [], txt: [], banner: null,
    eu: Object.assign(criarHeroi(S.heroi || 'lyra', 16), A, { hp: A.hp, max: A.hp }), ele: null, escolha: null, toque: null, tH: 0, tHp: 0, saiu: 0, rodada: 0, placar: [0, 0], tMorri: 0 };
  if (bot) criarBot();
  else { K.canal = ON.conectarSala(d.sala, receber, !!d.host); K.tPronto = 0; }
  desenhar(); ligarToque(); intensidade(1); Q.emFase(true);
  K.banner = { txt: bot ? 'PREPARAR...' : 'ESPERANDO O RIVAL...', cor: '#ffd84a', t: 0 };
}
function criarBot() {
  const hrs = Object.keys(HEROIS), O = K.ele = criarHeroi(hrs[Math.floor(Math.random() * hrs.length)], -16), M = K.eu, F = 0.88 + Math.random() * 0.1;
  Object.assign(O, { hp: Math.round(M.max * F), max: Math.round(M.max * F), cadBase: M.cadBase * F, danoBase: Math.round(M.danoBase * F), ia: { estado: 'anda', t: 0.8, dx: 0, dz: 0 } });
  K.bot = true; K.host = true;
}
export function fechar() {
  if (K) { K.eu?.v.remover(); K.ele?.v.remover(); for (const s of K.tiros) cn().remove(s.o); for (const g of K.arena) cn().remove(g); K.canal?.fechar(); }
  desligarToque(); K = null; Q.emFase(false); if (el) { el.hidden = true; el.innerHTML = ''; }
}
export const ativo = () => !!K;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function desenhar() {
  el.innerHTML = `<div class="duTopo"><button class="lSair" data-du="sair">${ico('fechar')}</button>
      <div class="duVida ele"><b data-nt>${esc(K.nome)} <span class="duPts" id="duPtsE"></span></b><div class="barra vm"><i id="duHpE"></i><span id="duHpET"></span></div></div><em id="duRelogio">1:00</em></div>
    <div class="duHabs" id="duHabs"></div><div class="duEsc" id="duEsc" hidden></div>
    <div class="duBaixo"><div class="duVida eu"><b data-nt>${esc(S.online?.apelido || tr('Você'))} <span class="duPts" id="duPtsM"></span></b><div class="barra muro"><i id="duHpM"></i><span id="duHpMT"></span></div></div></div>
    <div class="duJoy" id="duJoy" hidden><i></i></div><div class="cqJanela" id="duJanela" hidden></div>`;
  hud();
}
function hud() {
  const E = K.ele, M = K.eu, b = $('#duHpM'); if (!b) return;
  b.style.width = 100 * Math.max(0, M.hp) / M.max + '%'; $('#duHpMT').innerHTML = `${fmt(Math.max(0, Math.round(M.hp)))}${M.escudo ? ` ${ico('escudo')}${M.escudo}` : ''}`;
  if (E && E.max) { $('#duHpE').style.width = 100 * Math.max(0, E.hp) / E.max + '%'; $('#duHpET').textContent = fmt(Math.max(0, Math.round(E.hp))); }
  const pts = n => [0, 1].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join(''); $('#duPtsM').innerHTML = pts(K.placar[0]); $('#duPtsE').innerHTML = pts(K.placar[1]);
  const s = Math.max(0, Math.ceil(T_RODADA - (K.estado === 'luta' ? K.t : 0))); $('#duRelogio').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; $('#duRelogio').classList.toggle('pouco', s <= 10 && K.estado === 'luta');
  const hs = Object.entries(M.hab).map(([k, n]) => `<span>${ico(HAB[k].icone)}${n > 1 ? `<i>${n}</i>` : ''}</span>`).join(''); if (hs !== K.habsHtml) { K.habsHtml = hs; $('#duHabs').innerHTML = hs; }
}
// arrastar em qualquer lugar = controle; soltar = parar (e atirar)
let toqueEl = null;
const dn = e => { if (!K || K.estado === 'fim') return; K.toque = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }; try { toqueEl.setPointerCapture(e.pointerId); } catch (er) {}
  const j = $('#duJoy'); if (j) { j.hidden = false; j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; j.firstChild.style.transform = ''; } };
const mv = e => { const T = K?.toque; if (!T || e.pointerId !== T.id) return; T.dx = e.clientX - T.x0; T.dy = e.clientY - T.y0; const d = Math.hypot(T.dx, T.dy), k = Math.min(1, 40 / (d || 1));
  const j = $('#duJoy'); if (j) j.firstChild.style.transform = `translate(${T.dx * k}px, ${T.dy * k}px)`; };
const up = e => { if (K?.toque && e.pointerId === K.toque.id) { K.toque = null; const j = $('#duJoy'); if (j) j.hidden = true; } };
function ligarToque() { toqueEl = $('#toque'); toqueEl.addEventListener('pointerdown', dn); toqueEl.addEventListener('pointermove', mv); toqueEl.addEventListener('pointerup', up); toqueEl.addEventListener('pointercancel', up); }
function desligarToque() { if (!toqueEl) return; toqueEl.removeEventListener('pointerdown', dn); toqueEl.removeEventListener('pointermove', mv); toqueEl.removeEventListener('pointerup', up); toqueEl.removeEventListener('pointercancel', up); toqueEl = null; }

// ---- rede ----
function receber(ev, p) {
  if (!K) return;
  if (ev === '_caiu') { if (!K.saiu) { K.saiu = performance.now(); faixa(`${K.nome.toUpperCase()} CAIU DA CONEXÃO...`, '#ff9a3a'); } return; }
  if (ev === '_voltou') { K.saiu = 0; return; }
  if (ev === '_reconectando') { faixa('RECONECTANDO...', '#ffd84a'); return; }
  if (ev === 'sair') { if (K.estado !== 'fim') { faixa(`${K.nome.toUpperCase()} DESISTIU!`, '#7aff8a'); acabar(true); } return; }
  K.saiu = 0;
  if (ev === 'pronto') { if (!K.ele) { const O = K.ele = criarHeroi(HEROIS[p.hr] ? p.hr : 'lyra', -16); O.hp = O.max = +p.hp || 1000; }
    if (!K.ok) { K.ok = true; K.canal?.enviar('pronto', prontoMsg()); if (K.estado === 'espera') K.esperaT = 0.01; } return; }
  const O = K.ele; if (!O || K.estado === 'fim') return;
  if (ev === 'h') { O.tx = -p.x; O.tz = -p.z; O.ang = p.a + Math.PI; O.mov = !!p.m; return; }
  if (ev === 't') { if (K.estado !== 'luta') return; for (const [x, z, a, d, c] of p.l || []) criarTiro(O, -x, -z, a + Math.PI, { dano: +d || 0, crit: !!c, ric: p.r | 0, gelo: !!p.g, fogo: !!p.f }); animar(O, O.H.tiro, { loop: false, reinicia: true }); O.animT = 0.35; return; }
  if (ev === 'hp') { if (p.r !== K.rodada) return; O.hp = +p.hp; O.max = +p.mx || O.max; O.escudo = p.e | 0; O.inv = p.i ? 0.3 : 0; if (p.hab) O.hab = p.hab; return; }
  if (ev === 'morri' && K.host) { if (p.r === K.rodada && K.estado === 'luta') fimRodada(true); return; }
  if (ev === 'rod' && !K.host) { if (p.r !== K.rodada || K.estado === 'entre') return; aplicarRodada([p.a[1], p.a[0]], p.v == null ? null : !p.v); }
}
const prontoMsg = () => ({ hr: K.eu.hr, hp: K.eu.max });
function enviarEstado(dt) {
  if (!K.canal) return; const M = K.eu;
  if ((K.tH -= dt) <= 0) { K.tH = 0.07; K.canal.enviar('h', { x: +M.x.toFixed(2), z: +M.z.toFixed(2), a: +M.ang.toFixed(2), m: M.mov ? 1 : 0 }); }
  if ((K.tHp -= dt) <= 0) { K.tHp = 0.5; enviarVida(); }
}
const enviarVida = () => K.canal?.enviar('hp', { r: K.rodada, hp: Math.max(0, Math.round(K.eu.hp)), mx: K.eu.max, e: K.eu.escudo, i: K.eu.inv > 0 ? 1 : 0, hab: K.eu.hab });

// ---- tiros ----
function criarTiro(dono, x, z, ang, o) {
  const H = dono.H, m = op?.projetil ? op.projetil(H.ataque.proj, H.ataque.cor) : new THREE.Mesh(GEO_BALA, matCor(H.ataque.cor));
  m.position.set(x, 2.2, ZC + z); m.rotation.y = ang + Math.PI; if (o.crit) m.scale.multiplyScalar(1.4); cn().add(m);
  K.tiros.push({ o: m, x, z, vx: Math.sin(ang) * VEL_TIRO, vz: Math.cos(ang) * VEL_TIRO, dono, dano: o.dano, crit: o.crit, ric: o.ric || 0, gelo: o.gelo, fogo: o.fogo, vida: 2.2 });
}
function atirar(p, alvo) {
  const a = Math.atan2(alvo.x - p.x, alvo.z - p.z), n = 1 + (p.hab.frente || 0), lista = [], base = danoDe(p), cc = 0.05 + 0.2 * (p.hab.critico || 0), cm = 2 * (1 + 0.2 * (p.hab.critico || 0));
  const um = (x, z, an) => { const c = Math.random() < cc; lista.push([x, z, an, Math.round(base * (c ? cm : 1)), c ? 1 : 0]); };
  for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * 0.8; um(p.x + Math.cos(a) * off, p.z - Math.sin(a) * off, a); }
  for (let k = 1; k <= (p.hab.diag || 0); k++) for (const s of [-1, 1]) um(p.x, p.z, a + s * 0.42 * k);
  const o = { ric: p.hab.parede ? 2 : 0, gelo: !!p.hab.gelo, fogo: !!p.hab.fogo };
  for (const [x, z, an, d, c] of lista) criarTiro(p, x, z, an, { ...o, dano: d, crit: !!c });
  p.ang = a; animar(p, p.H.tiro, { loop: false, reinicia: true, vel: Math.max(1.2, cadDe(p) * 0.8) }); p.animT = 0.35;
  if (p === K.eu) { K.canal?.enviar('t', { l: lista.map(([x, z, an, d, c]) => [+x.toFixed(2), +z.toFixed(2), +an.toFixed(3), d, c]), r: o.ric, g: o.gelo ? 1 : 0, f: o.fogo ? 1 : 0 });
    if (Math.random() < 0.6) sfx(p.H.ataque.proj === 'orbe' || p.H.ataque.proj === 'fogo' ? 'magia' : 'arco'); }
}
function passoTiros(dt) {
  const n = Math.max(1, Math.ceil(VEL_TIRO * dt / 0.6)); // passos curtos: o tiro não atravessa ninguém
  for (let i = 0; i < n; i++) passoTiros1(dt / n);
  for (const s of K.tiros) if (s.morto) cn().remove(s.o);
  K.tiros = K.tiros.filter(s => !s.morto);
}
function passoTiros1(dt) {
  for (const s of K.tiros) {
    if (s.morto) continue; s.vida -= dt; const nx = s.x + s.vx * dt, nz = s.z + s.vz * dt;
    const pX = Math.abs(nx) > LX - 0.3, pZ = Math.abs(nz) > LZ - 0.3, b = !pX && !pZ && dentroBloco(nx, nz, 0.3);
    if (pX || pZ || b) {
      if (s.ric > 0) { s.ric--; s.dano = Math.round(s.dano * 0.5); // quica na parede (e perde metade do dano)
        if (b) { const [bx, , w] = b; if (Math.abs(s.x - bx) >= w + 0.3) s.vx = -s.vx; else s.vz = -s.vz; } else { if (pX) s.vx = -s.vx; if (pZ) s.vz = -s.vz; }
        s.o.rotation.y = Math.atan2(s.vx, s.vz) + Math.PI; C.faiscas(s.x, 2.2, ZC + s.z, 0xffffff, 4, 2); continue; }
      s.morto = true; C.faiscas(nx, 2.2, ZC + nz, 0xd8c8a8, 5, 2); continue;
    }
    s.x = nx; s.z = nz; s.o.position.set(s.x, 2.2, ZC + s.z);
    const alvo = s.dono === K.eu ? K.ele : K.eu;
    if (alvo && alvo.hp > 0 && Math.hypot(alvo.x - s.x, alvo.z - s.z) < R + 0.35) { s.morto = true; acertar(alvo, s); }
    if (s.vida <= 0) s.morto = true;
  }
}
const texto = (p, txt, cor, y = 5) => K.txt.push({ x: p.x, z: p.z, y, txt, cor, t: 0 });
function acertar(alvo, s) {
  C.faiscas(alvo.x, 2.2, ZC + alvo.z, s.crit ? 0xffd84a : 0xffffff, s.crit ? 14 : 8, 3); alvo.flash = 0.12;
  if (!(alvo === K.eu || K.bot)) { texto(alvo, s.crit ? `${fmt(s.dano)}!` : fmt(s.dano), s.crit ? '#ffd84a' : '#fff'); return; } // no rival só o efeito: a vida vem dele
  if (alvo.inv > 0) { texto(alvo, 'INVENCÍVEL', '#ffd84a'); return; }
  if (alvo.hab.esquiva && Math.random() < 0.2) { texto(alvo, 'ESQUIVOU', '#8ae0ff'); return; }
  if (alvo.escudo > 0) { alvo.escudo--; texto(alvo, 'BLOQUEOU', '#8ac8ff'); if (alvo === K.eu) enviarVida(); return; }
  texto(alvo, s.crit ? `${fmt(s.dano)}!` : fmt(s.dano), alvo === K.eu ? '#ff6a5a' : s.crit ? '#ffd84a' : '#fff');
  ferir(alvo, s.dano); if (s.gelo) alvo.lento = 1.2; if (s.fogo) alvo.queima = { t: 2, dps: s.dano * 0.15, tt: 0 };
  if (alvo.hp > 0) { animar(alvo, 'Hit_A', { loop: false, reinicia: true }); alvo.animT = 0.25; }
  if (alvo === K.eu) { C.camera.tremor = Math.max(C.camera.tremor, 0.35); som('pancada', 0.3); enviarVida(); }
}
function ferir(p, d) { if (p.hp <= 0 || K.estado !== 'luta') return; p.hp -= d; if (p.hp <= 0) morreu(p); }
function morreu(p) {
  animar(p, 'Death_A', { loop: false, reinicia: true }); C.faiscas(p.x, 2, ZC + p.z, 0xff6a4a, 30, 6); C.camera.tremor = 0.8;
  const euMorri = p === K.eu; if (euMorri) enviarVida();
  if (K.host) fimRodada(!euMorri);
  else if (euMorri) { K.tMorri = 0.01; K.canal?.enviar('morri', { r: K.rodada }); } // quem decide é o host; reenvia até ele responder
}

// ---- rodadas (melhor de 3) ----
function iniciarRodada() {
  K.rodada++; K.t = 0; K.meio = false; for (const s of K.tiros) cn().remove(s.o); K.tiros = [];
  for (const p of [K.eu, K.ele]) { p.x = p.tx = 0; p.z = p.tz = p.z0; p.hp = p.max; p.lento = 0; p.queima = null; p.estrelaT = 8; p.inv = 0; p.cd = 0.6; p.anim = ''; p.ang = p.z0 > 0 ? Math.PI : 0; }
  K.estado = 'conta'; K.conta = 3.99; K.banner = { txt: `RODADA ${K.rodada}`, cor: '#ffd84a', t: 0 }; som('clique');
  abrirEscolha(); hud();
}
function fimRodada(venceuEu) { // só no host (ou contra o computador)
  if (K.estado !== 'luta') return; const pl = [...K.placar]; if (venceuEu != null) pl[venceuEu ? 0 : 1]++;
  K.canal?.enviar('rod', { r: K.rodada, a: pl, v: venceuEu }); const r = K.rodada; setTimeout(() => { if (K?.rodada === r) K.canal?.enviar('rod', { r, a: pl, v: venceuEu }); }, 600);
  aplicarRodada(pl, venceuEu);
}
function aplicarRodada(pl, venceuEu) {
  K.placar = pl; K.estado = 'entre'; K.entreT = 2.6; K.tMorri = 0; fecharEscolha(); K.toque = null; const j = $('#duJoy'); if (j) j.hidden = true;
  const perdedor = venceuEu === true ? K.ele : venceuEu === false ? K.eu : null, vencedor = perdedor === K.ele ? K.eu : perdedor === K.eu ? K.ele : null;
  if (perdedor && perdedor.hp > 0) { perdedor.hp = 0; animar(perdedor, 'Death_A', { loop: false, reinicia: true }); } if (vencedor) animar(vencedor, 'Cheering');
  hud(); sfx(venceuEu ? 'vitoria' : 'derrota');
  if (pl[0] >= VITORIAS || pl[1] >= VITORIAS) { setTimeout(() => acabar(pl[0] > pl[1]), 1200); K.banner = { txt: pl[0] > pl[1] ? 'VITÓRIA!' : 'DERROTA', cor: pl[0] > pl[1] ? '#7aff8a' : '#ff5a4a', t: 0 }; return; }
  K.banner = { txt: venceuEu == null ? 'EMPATE!' : venceuEu ? 'RODADA SUA!' : `RODADA DE ${K.nome.toUpperCase()}`, cor: venceuEu == null ? '#ffd84a' : venceuEu ? '#7aff8a' : '#ff7a5a', t: 0 };
}

// ---- habilidades ----
function abrirEscolha() {
  const M = K.eu, ops = Object.keys(HAB).filter(k => (M.hab[k] || 0) < HAB[k].max).sort(() => Math.random() - 0.5).slice(0, 3); if (!ops.length) return;
  K.escolha = { ops, t: 8 }; sfx('brilho');
  const e = $('#duEsc'); e.hidden = false;
  e.innerHTML = `<p>${tr('Escolha uma habilidade!')} <b id="duEscT">8</b></p><div>${ops.map(k => `<button data-du-hab="${k}">${ico(HAB[k].icone)}<b>${tr(HAB[k].nome)}</b><small>${tr(HAB[k].desc)}</small></button>`).join('')}</div>`;
  if (K.ele?.ia) { const oo = Object.keys(HAB).filter(k => (K.ele.hab[k] || 0) < HAB[k].max); pegarHab(K.ele, oo[Math.floor(Math.random() * oo.length)]); }
}
function fecharEscolha() { if (K.escolha) pegarHab(K.eu, K.escolha.ops[0]); }
function pegarHab(p, k) {
  if (!k || !HAB[k]) return; p.hab[k] = (p.hab[k] || 0) + 1;
  if (k === 'vida') { p.max = Math.round(p.max * 1.2); p.hp = p.max; }
  if (k === 'escudo') p.escudo += 2;
  C.faiscas(p.x, 3, ZC + p.z, 0xc88aff, 26, 5);
  if (p === K.eu) { K.escolha = null; $('#duEsc').hidden = true; texto(p, tr(HAB[k].nome).toUpperCase() + '!', '#c88aff', 7); sfx('magia'); enviarVida(); hud(); }
}

// ---- computador ----
function passoBot(dt) {
  const O = K.ele, M = K.eu, I = O.ia; if (O.hp <= 0) return;
  for (const s of K.tiros) { if (s.dono !== M || I.desvio > 0) continue; const rx = O.x - s.x, rz = O.z - s.z, v = Math.hypot(s.vx, s.vz), ao = (rx * s.vx + rz * s.vz) / v; // desvia de tiro vindo nele
    if (ao > 0 && ao < 9) { const lat = Math.abs(rx * s.vz - rz * s.vx) / v; if (lat < 1.8 && Math.random() < 0.4) { const s2 = Math.random() < 0.5 ? 1 : -1; I.estado = 'anda'; I.t = 0.45; I.dx = s.vz / v * s2; I.dz = -s.vx / v * s2; I.desvio = 0.9; } } }
  I.desvio = Math.max(0, (I.desvio || 0) - dt);
  if ((I.t -= dt) <= 0) {
    if (I.estado === 'anda' && linhaLivre(O, M)) { I.estado = 'atira'; I.t = 0.7 + Math.random() * 1.1; }
    else if (I.estado === 'anda') { I.t = 0.3; I.dx = (O.x > M.x ? -1 : 1) * 0.9; I.dz = (Math.random() - 0.5) * 0.8; } // atrás de um obstáculo: sai para ter linha de tiro
    else { I.estado = 'anda'; I.t = 0.5 + Math.random() * 0.8; const dist = Math.hypot(M.x - O.x, M.z - O.z) || 1, ax = (M.x - O.x) / dist, az = (M.z - O.z) / dist, lado = Math.random() < 0.5 ? 1 : -1;
      const perto = dist < 14 ? -1 : dist > 26 ? 1 : 0; I.dx = -az * lado + ax * perto; I.dz = ax * lado + az * perto; const n = Math.hypot(I.dx, I.dz) || 1; I.dx /= n; I.dz /= n; }
  }
  if (I.estado === 'atira' && !linhaLivre(O, M)) I.t = Math.min(I.t, 0.2);
  if (I.estado === 'anda') { O.x += I.dx * velDe(O) * dt; O.z += I.dz * velDe(O) * dt; if (empurrar(O)) I.t = Math.min(I.t, 0.1); O.mov = true; O.ang = Math.atan2(I.dx, I.dz); O.z = Math.min(O.z, -2); }
  else O.mov = false;
}

// ---- laço ----
export function passo(dt) {
  if (!K) return; dt = Math.min(dt, 0.1);
  for (const p of [K.eu, K.ele]) if (p) { p.v.mixer.update(dt); p.flash = Math.max(0, p.flash - dt); p.v.brilho(p.flash > 0 ? 0.6 : p.inv > 0 ? 0.45 + 0.2 * Math.sin(C.tempo() * 20) : p.lento > 0 ? 0.25 : 0); }
  if (K.estado === 'espera') {
    if (!K.bot && (K.tPronto -= dt) <= 0) { K.tPronto = 0.7; K.canal?.enviar('pronto', prontoMsg()); }
    if ((K.esperaT -= dt) <= 0) { if (!K.ele) { K.canal?.fechar(); K.canal = null; criarBot(); } iniciarRodada(); } // ninguém apareceu: segue contra o computador
    posicionar(dt); hud(); return;
  }
  if (K.escolha) { if ((K.escolha.t -= dt) <= 0) fecharEscolha(); else { const e = $('#duEscT'); if (e) e.textContent = Math.ceil(K.escolha.t); } }
  if (K.estado === 'conta') { const a = Math.ceil(K.conta); K.conta -= dt; if (Math.ceil(K.conta) !== a && K.conta > 0) { K.banner = { txt: String(Math.ceil(K.conta)), cor: '#fff', t: 0 }; som('clique'); }
    if (K.conta <= 0) { K.estado = 'luta'; K.banner = { txt: 'LUTEM!', cor: '#7aff8a', t: 0 }; sfx('vitoria'); } enviarEstado(dt); posicionar(dt); hud(); return; }
  if (K.estado === 'entre') { passoTiros(dt); posicionar(dt); if ((K.entreT -= dt) <= 0 && K.placar[0] < VITORIAS && K.placar[1] < VITORIAS) iniciarRodada(); return; }
  if (K.estado === 'fim') { passoTiros(dt); posicionar(dt); return; }
  K.t += dt; const M = K.eu, O = K.ele;
  // meu herói: anda com o dedo; parado, atira no rival
  const T = K.toque, d = T ? Math.hypot(T.dx, T.dy) : 0;
  if (d > 10 && M.hp > 0) { const vx = T.dx / d, vz = T.dy / d; M.x += vx * velDe(M) * dt; M.z += vz * velDe(M) * dt; empurrar(M); M.mov = true; M.ang = Math.atan2(vx, vz); }
  else M.mov = false;
  for (const p of K.bot ? [M, O] : [M]) { // estrela (invencível 2 s a cada 10 s) e fogo (dano por segundo)
    p.lento = Math.max(0, p.lento - dt); p.animT = Math.max(0, (p.animT || 0) - dt); p.inv = Math.max(0, p.inv - dt);
    if (p.hab.estrela && (p.estrelaT -= dt) <= 0) { p.estrelaT = 10; p.inv = 2; C.faiscas(p.x, 3, ZC + p.z, 0xffd84a, 20, 4); if (p === M) enviarVida(); }
    if (p.queima && p.hp > 0) { const Qm = p.queima; Qm.t -= dt; ferir(p, Qm.dps * dt); if ((Qm.tt -= dt) <= 0) { Qm.tt = 0.5; texto(p, fmt(Math.round(Qm.dps * 0.5)), '#ff8a3a', 4); C.faiscas(p.x, 2, ZC + p.z, 0xff6a1a, 4, 2); } if (Qm.t <= 0) p.queima = null; }
  }
  if (!K.bot) { O.x += (O.tx - O.x) * Math.min(1, dt * 12); O.z += (O.tz - O.z) * Math.min(1, dt * 12); O.lento = Math.max(0, O.lento - dt); O.inv = Math.max(0, O.inv - dt); O.animT = Math.max(0, (O.animT || 0) - dt); }
  if (K.estado !== 'luta') { posicionar(dt); return; } // alguém caiu neste quadro
  if (K.bot) passoBot(dt);
  for (const p of K.bot ? [M, O] : [M]) { // parado = atira (rajada dupla: o segundo tiro sai logo depois)
    p.cd -= dt; const alvo = p === M ? O : M;
    if (p.multiPend != null && (p.multiPend -= dt) <= 0) { p.multiPend = null; if (alvo.hp > 0 && p.hp > 0) atirar(p, alvo); }
    if (!p.mov && p.cd <= 0 && alvo.hp > 0 && p.hp > 0) { p.cd = 1 / cadDe(p); atirar(p, alvo); if (p.hab.multi) p.multiPend = 0.14; } else if (p.mov) p.cd = Math.max(p.cd, 0.15);
  }
  passoTiros(dt);
  if (!K.meio && K.t >= MEIO_RODADA && K.estado === 'luta') { K.meio = true; if (!K.escolha) abrirEscolha(); }
  enviarEstado(dt);
  if (K.tMorri > 0 && (K.tMorri += dt) > 1) { K.tMorri = 0.01; K.canal?.enviar('morri', { r: K.rodada }); }
  if (!K.bot && K.saiu && performance.now() - K.saiu > 12000) { faixa(`${K.nome.toUpperCase()} SAIU: VITÓRIA!`, '#7aff8a'); acabar(true); return; }
  if (K.host && K.t >= T_RODADA && K.estado === 'luta') { const a = M.hp / M.max, b = O.hp / O.max; fimRodada(Math.abs(a - b) < 0.005 ? null : a > b); }
  posicionar(dt); if (Math.random() < 0.3) hud();
}
function posicionar(dt) {
  for (const p of [K.eu, K.ele]) { if (!p) continue;
    p.v.raiz.position.set(p.x, 0, ZC + p.z);
    const alvo = p === K.eu ? K.ele : K.eu, olha = p.mov || !alvo ? p.ang : Math.atan2(alvo.x - p.x, alvo.z - p.z);
    let dr = olha - p.v.raiz.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); p.v.raiz.rotation.y += dr * Math.min(1, dt * 14);
    if (p.hp <= 0 || K.estado === 'entre' || K.estado === 'fim') continue;
    if (p.mov) animar(p, 'Running_A'); else if (!(p.animT > 0)) animar(p, p.v.tem(p.H.pose) ? p.H.pose : 'Idle_A'); }
}
function faixa(txt, cor) { if (K) K.banner = { txt, cor, t: 0 }; }

// ---- fim ----
function acabar(venceu) {
  if (!K || K.estado === 'fim') return; K.estado = 'fim'; $('#duEsc').hidden = true; K.escolha = null; K.toque = null;
  const D = S.duelo = S.duelo || { v: 0, d: 0, tacas: 0 }, dt = venceu ? 30 : -15; D[venceu ? 'v' : 'd']++; D.tacas = Math.max(0, D.tacas + dt);
  const ganho = Math.round((venceu ? 40 + 10 * (S.fase || 1) : 10 + 2 * (S.fase || 1)) * (fimDeSemana() ? 2 : 1)); S.moedas += ganho; const bau = venceu ? ganharBau(S.fase || 1) : null; salvar();
  Q.emFase(false); hud();
  setTimeout(() => { if (!K || !el) return; const j = $('#duJanela'); j.hidden = false;
    j.innerHTML = `<div class="cqFim ${venceu ? 'vit' : 'der'}"><h2>${venceu ? 'VITÓRIA!' : 'DERROTA'}</h2><p>${tr('Duelo contra')} <b data-nt>${esc(K.nome)}</b> · ${K.placar[0]} x ${K.placar[1]}</p>
      <div class="dlTacas ${dt > 0 ? 'sobe' : 'desce'}">${ico('coroa')}<b>${fmt(D.tacas)}</b><em>${dt > 0 ? '+' : ''}${dt}</em></div>
      <div class="ganho">${ico('ouro')}<b id="duGanho">+${fmt(ganho)}</b></div>
      ${venceu ? `<div class="fBau">${bau ? `<b>${BAUS[bau].nome}!</b>` : `<small>Espaços de baú cheios: abra seus baús!</small>`}</div>` : ''}
      <p class="sub">${D.v} vitórias · ${D.d} derrotas</p>
      <button class="btn verde grande" data-du="denovo">${ico('h_lamina')} Duelar de novo</button><button class="btn azul" data-du="sair">${ico('guilda')} Menu</button></div>`;
    sfx(venceu ? 'vitoria' : 'derrota'); if (venceu) { flashTela('#ffe27a', 0.45); contarAte($('#duGanho'), ganho, 900, '+', fmt); setTimeout(() => voarMoedas('#duGanho', 10), 150); } }, 1400);
}
export function desistir() { // sair no meio conta como derrota
  if (!K || K.estado === 'fim' || K.estado === 'espera') return; K.canal?.enviar('sair', {}); const D = S.duelo = S.duelo || { v: 0, d: 0, tacas: 0 }; D.d++; D.tacas = Math.max(0, D.tacas - 15); salvar();
}
export function clique(b) {
  const a = b.dataset.du, h = b.dataset.duHab;
  if (h) { if (K?.escolha) pegarHab(K.eu, h); return; }
  if (a === 'sair') { som('fechar'); desistir(); op.sair(); }
  if (a === 'denovo') { som('confirma'); op.denovo(); }
}
export function vista() { return { foco: { x: 0, z: ZC + 2.5 }, yaw: Math.PI, pitch: 1.22, dist: 84 }; }
export function desenharFx(g, dt) {
  if (!K) return;
  for (const p of [K.eu, K.ele]) { if (!p || !p.max) continue; const q = C.tela(p.x, 6.2, ZC + p.z); if (!q) continue; const w = 54, eu = p === K.eu;
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(q[0] - w / 2 - 2, q[1] - 2, w + 4, 10); g.fillStyle = eu ? '#4ae86a' : '#ff5a4a'; g.fillRect(q[0] - w / 2, q[1], w * Math.max(0, p.hp) / p.max, 6);
    g.font = '13px Titulo, sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; const t = fmt(Math.max(0, Math.round(p.hp))); g.strokeText(t, q[0], q[1] - 6); g.fillStyle = '#fff'; g.fillText(t, q[0], q[1] - 6); }
  for (const t of K.txt) { t.t += dt; const p = C.tela(t.x, t.y + t.t * 3, ZC + t.z); if (!p) continue; g.globalAlpha = Math.max(0, 1 - t.t / 0.8);
    g.font = `${t.t < 0.1 ? 22 : 18}px Titulo, sans-serif`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; const tx = tr(t.txt); g.strokeText(tx, p[0], p[1]); g.fillStyle = t.cor; g.fillText(tx, p[0], p[1]); g.globalAlpha = 1; }
  K.txt = K.txt.filter(t => t.t < 0.8);
  const B = K.banner;
  if (B) { B.t += dt; const k = Math.min(1, B.t / 0.18), s = k < 1 ? 0.4 + 0.9 * k : 1, a = Math.max(0, 1 - Math.max(0, B.t - 1.1) / 0.4);
    g.save(); g.globalAlpha = a; g.translate(innerWidth / 2, innerHeight * 0.4); g.scale(s, s); g.font = '42px Titulo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 9; g.lineJoin = 'round'; g.strokeStyle = 'rgba(30,10,0,.85)'; const tx = tr(B.txt); g.strokeText(tx, 0, 0); g.fillStyle = B.cor; g.fillText(tx, 0, 0); g.restore();
    if (B.t > 1.5) { if (K.estado === 'espera') B.t = 0.3; else K.banner = null; } }
}
window.__du = { K: () => K }; // testes
