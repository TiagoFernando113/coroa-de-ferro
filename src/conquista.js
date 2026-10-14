// Conquista: a equipe de pets luta sozinha na ponte contra pets inimigos, estágio após estágio.
// A cada 10 estágios vem um chefe dourado. O estágio alcançado define o lucro ocioso.
import * as THREE from 'three';
import * as C from './cena.js';
import { S, salvar, fimDeSemana } from './meta.js';
import { PETS, RARIDADES, CLASSES, MAX_NV, MAX_EST, atributos, forca, modeloDe, tinta, base, est, ESTRELAS, lucroHora, lucroOcioso, tempoOcioso, MAX_OCIOSO, coletarOcioso, OVOS } from './pets.js';
import { fmt } from './dados.js';
import { sfx } from './musica.js';
import { ico, som, $, voarMoedas, flashTela } from './util.js';
import { t as tr } from './i18n.js';
import { evento } from './missoes.js';
import * as ON from './online.js';
import { forcaEquipe } from './pets.js';

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const Z_NOS = -24, Z_ELES = -50, ALT = 4.2; // altura de um pet na tela
let Q = null, aoSair = null, el = null;

// ---- equipe inimiga do estágio (sorteio fixo por estágio) ----
export function inimigos(est) {
  let sd = est * 4441 + 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const chefe = est % 10 === 0, n = Math.min(5, 1 + Math.ceil(est / 2)), rarMax = Math.min(3, Math.floor(est / 8));
  const total = 150 * 1.155 ** (est - 1) * (chefe ? 1.5 : 1), lista = [];
  for (let i = 0; i < n; i++) {
    const ks = Object.keys(PETS).filter(k => PETS[k].r <= rarMax), k0 = ks[Math.floor(r() * ks.length)], k = chefe && i === 0 ? k0 + '*' : k0;
    const parte = total / n * (chefe && i === 0 ? 2 : 1) / (chefe ? (n + 1) / n : 1);
    lista.push({ k, extra: parte / forca(atributos(k, 1)), chefe: chefe && i === 0 });
  }
  return lista;
}
const forcaInimiga = est => inimigos(est).reduce((s, e) => s + forca(atributos(e.k, 1, e.extra)), 0);

// ---- unidades ----
const GEO_ANEL = new THREE.RingGeometry(0.85, 1.05, 28).rotateX(-Math.PI / 2), GEO_TIRO = new THREE.SphereGeometry(0.42, 10, 8);
const MAT_ANEL = [new THREE.MeshBasicMaterial({ color: 0x4ab0ff, transparent: true, opacity: 0.8, depthWrite: false }), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.8, depthWrite: false })];
const matTiro = {}, corTiro = c => matTiro[c] ||= new THREE.MeshBasicMaterial({ color: c });
function criar(k, lado, nv, extra, x, z, chefe, sem3d, real) {
  const a = atributos(k, nv, extra), u = { k, lado, nv, ...a, max: a.hp, x, z, cd: 0.4 + Math.random() * 0.6, alvo: null, morto: false, flash: 0, atkT: 0, tm: 0, chefe, raio: chefe ? 2.2 : 1.3,
    nvVis: lado && !real ? Math.max(1, Math.round(1 + Math.log(Math.max(1, extra)) / Math.log(1.12))) : nv };
  if (sem3d) return u;
  const m = modeloDe(k), v = C.personagem(m, [], 1); if (tinta(k) != null) C.tingirOuro(v.corpo, false, tinta(k));
  const h = C.alturaModelo(m); u.alt = ALT * (chefe ? 1.7 : 1 + 0.07 * est(k)) * (h / 2.5) ** 0.5; u.esc = u.alt / (h * C.ESC_PERS); // maiores continuam maiores
  v.raiz.scale.setScalar(u.esc); v.raiz.position.set(x, 0, z); v.raiz.rotation.y = lado ? 0 : Math.PI; v.tocar('Idle'); v.mixer.update(Math.random());
  u.anel = new THREE.Mesh(GEO_ANEL, MAT_ANEL[lado]); u.anel.scale.setScalar(u.raio * 1.1); u.anel.position.set(x, 0.08, z); C.obterCena().add(u.anel);
  u.v = v; return u;
}
function formacao(lista, lado) { // tanques na frente, atiradores atrás
  const ordem = [...lista].sort((a, b) => ['tanque', 'lutador', 'atirador'].indexOf(PETS[base(a.k)].c) - ['tanque', 'lutador', 'atirador'].indexOf(PETS[base(b.k)].c));
  const z0 = lado ? Z_ELES : Z_NOS, dir = lado ? -1 : 1;
  return ordem.map((e, i) => { const fila = PETS[base(e.k)].c === 'atirador' ? 1 : 0, nFila = ordem.filter(o => (PETS[base(o.k)].c === 'atirador' ? 1 : 0) === fila).length, j = ordem.filter((o, i2) => i2 < i && (PETS[base(o.k)].c === 'atirador' ? 1 : 0) === fila).length;
    return { ...e, x: (j - (nFila - 1) / 2) * 5.2, z: z0 + dir * fila * 6 }; });
}
// equipe salva de outro jogador: só pets que existem, nível dentro do limite
export const equipeValida = l => (Array.isArray(l) ? l : []).filter(e => e && typeof e.k === 'string' && PETS[base(e.k)] && est(e.k) <= MAX_EST).slice(0, 5)
  .map(e => ({ k: e.k, nv: Math.max(1, Math.min(MAX_NV, Math.floor(+e.nv || 1))), extra: 1 }));
// rival: equipe real de outro jogador, com a força ajustada para a do estágio (a dificuldade não muda)
function equipeRival(est, rival) {
  const l = equipeValida(rival.equipe); if (!l.length) return null;
  const f = l.reduce((s, e) => s + forca(atributos(e.k, e.nv)), 0), ext = forcaInimiga(est) / Math.max(1, f);
  return l.map(e => ({ ...e, extra: ext, real: true }));
}
export function montar(est, sem3d = false, rival = null) {
  limpar();
  const doRival = rival && equipeRival(est, rival);
  const nos = formacao(S.equipe.map(k => ({ k, nv: S.pets[base(k)].nv, extra: 1 })), 0), eles = formacao(doRival || inimigos(est).map(e => ({ ...e, nv: 1 })), 1);
  Q = { est, us: [], tiros: [], golpes: [], txt: [], estado: 'prep', vel: S.cqVel || 1, t: 0, banner: null, sem3d, rival: doRival ? rival : null };
  for (const e of nos) Q.us.push(criar(e.k, 0, e.nv, 1, e.x, e.z, false, sem3d));
  for (const e of eles) Q.us.push(criar(e.k, 1, e.nv || 1, e.extra, e.x, e.z, e.chefe, sem3d, e.real));
  Q.forca = [forcaEquipeQ(0), forcaEquipeQ(1)];
  return Q;
}
const forcaEquipeQ = l => Q.us.filter(u => u.lado === l).reduce((s, u) => s + forca(u), 0);
export function limpar() {
  if (!Q) return; const cn = C.obterCena();
  for (const u of Q.us) { u.v?.remover(); if (u.anel) cn.remove(u.anel); }
  for (const t of Q.tiros) cn.remove(t.o);
  Q = null;
}
// ---- batalha ----
function ferir(alvo, dano, de) {
  if (alvo.morto) return; alvo.hp -= dano; alvo.flash = 0.15; alvo.punch = 0.14;
  // empurrãozinho para trás (sente o golpe)
  if (de && !Q.sem3d) { const dx = alvo.x - de.x, dz = alvo.z - de.z, d = Math.hypot(dx, dz) || 1; alvo.x += dx / d * 0.35; alvo.z += dz / d * 0.35; }
  const forte = dano >= alvo.max * 0.12;
  if (!Q.sem3d) Q.txt.push({ x: alvo.x + (Math.random() - 0.5), y: alvo.alt + 0.5, z: alvo.z, txt: fmt(dano), cor: forte ? '#ffd84a' : alvo.lado ? '#fff' : '#ff8a7a', t: 0, forte });
  if (alvo.hp <= 0) { alvo.hp = 0; alvo.morto = true; alvo.tm = 0;
    if (alvo.v) { alvo.v.tocar('Death', { loop: false, fade: 0.1 }); const cor = alvo.lado ? 0xff6a4a : 0x6ab8ff; C.impacto(alvo.x, 1.5, alvo.z, cor, 2); C.faiscas(alvo.x, 1.5, alvo.z, 0xffffff, 14, 7);
      C.camera.tremor = Math.max(C.camera.tremor, alvo.chefe ? 0.8 : 0.3); som('pancada', 0.5); } }
}
function golpear(u) {
  const a = u.alvo; if (!a || a.morto) return;
  if (u.classe === 'atirador') {
    if (Q.sem3d) { Q.golpes.push({ u, a, t: Math.hypot(a.x - u.x, a.z - u.z) / 28, dano: u.atk }); return; }
    const o = new THREE.Mesh(GEO_TIRO, corTiro(PETS[base(u.k)].cor || 0xffffff)); o.position.set(u.x, u.alt * 0.55, u.z); C.obterCena().add(o);
    Q.tiros.push({ o, u, a, x: u.x, z: u.z, y0: u.alt * 0.55, k: 0, d: Math.max(1, Math.hypot(a.x - u.x, a.z - u.z)), dano: u.atk });
  } else Q.golpes.push({ u, a, t: 0.25, dano: u.atk });
}
export function passo(dt0) {
  if (!Q) return; const dt = dt0 * (Q.estado === 'luta' ? Q.vel : 1), cn = C.obterCena();
  for (const u of Q.us) if (u.v) {
    u.v.mixer.update(dt); u.flash = Math.max(0, u.flash - dt); u.v.brilho(u.flash > 0 ? 0.5 : 0);
    u.punch = Math.max(0, (u.punch || 0) - dt); u.v.raiz.scale.setScalar(u.esc * (1 + 0.16 * u.punch / 0.14));
    if (u.morto) { u.tm += dt; if (u.tm > 1.4) { const k = Math.min(1, (u.tm - 1.4) / 0.8); u.v.raiz.position.y = -k * 3; u.anel.visible = false; if (k >= 1) u.v.raiz.visible = false; } }
  }
  if (Q.estado === 'luta') luta(dt);
  for (const u of Q.us) if (u.v && !u.morto) { u.v.raiz.position.set(u.x, 0, u.z); u.anel.position.set(u.x, 0.08, u.z); }
  // tiros em arco
  for (const t of Q.tiros) { t.k += dt * 28 / t.d; const k = Math.min(1, t.k), ax = t.a.x, az = t.a.z;
    t.o.position.set(t.x + (ax - t.x) * k, t.y0 + Math.sin(Math.PI * k) * Math.min(5, t.d * 0.25), t.z + (az - t.z) * k);
    if (!t.fim && Math.random() < 0.7) C.faiscas(t.o.position.x, t.o.position.y, t.o.position.z, PETS[base(t.u.k)].cor || 0xffffff, 1, 0.4); // rastro
    if (k >= 1) { t.fim = true; cn.remove(t.o); ferir(t.a, t.dano, t.u); C.impacto(ax, 1.5, az, PETS[base(t.u.k)].cor || 0xffffff, 0.7); } }
  Q.tiros = Q.tiros.filter(t => !t.fim);
}
function luta(dt) {
  Q.t += dt;
  const vivos = Q.us.filter(u => !u.morto);
  for (const u of vivos) {
    u.cd -= dt; u.atkT -= dt;
    if (!u.alvo || u.alvo.morto) { let m = null, md = 1e9; for (const o of vivos) if (o.lado !== u.lado) { const d = Math.hypot(o.x - u.x, o.z - u.z) + (o.classe === 'tanque' ? -3 : 0); if (d < md) { md = d; m = o; } } u.alvo = m; }
    const a = u.alvo; if (!a) { if (u.v && u.atkT <= 0) u.v.tocar('Idle'); continue; }
    const dx = a.x - u.x, dz = a.z - u.z, d = Math.hypot(dx, dz) || 1;
    if (u.v) u.v.raiz.rotation.y = Math.atan2(dx, dz);
    if (d > u.alc + a.raio + u.raio * 0.5) { const p = Math.min(d, u.vel * dt); u.x += dx / d * p; u.z += dz / d * p; if (u.v && u.atkT <= 0) u.v.tocar('Gallop', { vel: 1.3 }); }
    else if (u.cd <= 0) { u.cd = u.cad; u.atkT = 0.55; golpear(u); if (u.v) { u.v.tocar(Math.random() < 0.3 && u.v.tem('Attack2') ? 'Attack2' : 'Attack', { loop: false, reinicia: true, vel: 1.4 }); sfx(u.classe === 'atirador' ? 'magia' : 'pet'); } }
    else if (u.v && u.atkT <= 0) u.v.tocar('Idle');
  }
  // não se amontoam
  for (let i = 0; i < vivos.length; i++) for (let j = i + 1; j < vivos.length; j++) { const a = vivos[i], b = vivos[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 0.01, m = a.raio + b.raio;
    if (d < m) { const p = (m - d) / 2; a.x -= dx / d * p; a.z -= dz / d * p; b.x += dx / d * p; b.z += dz / d * p; } }
  for (const g of Q.golpes) if ((g.t -= dt) <= 0) { g.fim = true; if (!g.u.morto) { ferir(g.a, g.dano, g.u);
    if (!Q.sem3d && g.u.classe !== 'atirador') { const ang = Math.atan2(g.a.x - g.u.x, g.a.z - g.u.z); C.arco(g.a.x, g.a.z, ang, 2.4, 150, g.u.lado ? 0xffb0a0 : 0xfff2c0); C.impacto(g.a.x, 1.6, g.a.z, g.u.classe === 'tanque' ? 0xffd27a : 0xffffff, g.u.classe === 'tanque' ? 1.2 : 0.8); } } }
  Q.golpes = Q.golpes.filter(g => !g.fim);
  const vivosL = l => Q.us.some(u => u.lado === l && !u.morto);
  if (!vivosL(1)) acabar(true); else if (!vivosL(0)) acabar(false); else if (Q.t > 90) acabar(false);
}
// simulação sem 3D (balanceamento): devolve true se a equipe atual vence o estágio
export function simular(est) { montar(est, true); Q.estado = 'luta'; Q.vel = 1; while (Q.estado === 'luta') luta(0.05); const v = Q.venceu; Q = null; return v; }

// ---- tela ----
export function abrir(container, sair) {
  el = container; aoSair = sair; el.hidden = false; montar(S.cq.est); desenhar(); buscarRival();
  if (!S.dicas?.conquista) { (S.dicas ||= {}).conquista = 1; salvar(); const j = $('#cqJanela'); j.hidden = false;
    j.innerHTML = `<div class="cqFim dica"><h2>${ico('bandeira')} Conquista</h2>
      <p>Seus pets lutam sozinhos contra equipes de outros jogadores.</p><p>${ico('ouro')} Cada estágio vencido aumenta o lucro ocioso (até 9h).</p>
      <p>${ico('chefe')} A cada 10 estágios vem um chefe com Ovo Mágico.</p><p>${ico('pata')} Sua equipe também defende quando você está fora!</p>
      <button class="btn verde grande" data-cq="fecharJ">Entendi!</button></div>`; }
}
// nos estágios normais o inimigo é a equipe salva de um jogador real (chefes continuam sendo chefes)
function buscarRival() {
  const est = Q?.est; if (!est || est % 10 === 0 || !S.online?.codigo) return;
  ON.arenaDefesas().then(l => { const n = (l || []).filter(d => d.novo).length; if (n && Q && !Q.sem3d) Q.banner = { txt: n === 1 ? '1 JOGADOR ENFRENTOU SUA EQUIPE' : `${n} JOGADORES ENFRENTARAM SUA EQUIPE`, cor: '#8ae0ff', t: 0 }; }).catch(() => {});
  ON.cqRival(Math.round(forcaInimiga(est))).then(r => { if (r && Q && !Q.sem3d && Q.estado === 'prep' && Q.est === est) { montar(est, false, r); desenhar(); } }).catch(() => {});
}
export function fechar() { limpar(); if (el) { el.hidden = true; el.innerHTML = ''; } }
export const ativo = () => !!Q && !Q.sem3d;
function trilha() {
  const e = S.cq.est, ini = Math.max(1, e - 2);
  return `<div class="cqTrilha">${Array.from({ length: 6 }, (_, i) => { const n = ini + i; return `<span class="${n < e ? 'feito' : n === e ? 'atual' : ''} ${n % 10 === 0 ? 'chefe' : ''}">${n % 10 === 0 ? ico('chefe') : n}</span>`; }).join('<i></i>')}</div>`;
}
function desenhar() {
  if (!el || !Q) return; const L = lucroOcioso();
  const P = Q.rival;
  el.innerHTML = `<div class="cqTopo"><button class="lSair" data-cq="sair">${ico('fechar')}</button><b>Conquista</b>
      <div class="cqForcas"><span class="nos">${ico('forca')}${fmt(Q.forca[0])}</span><em>${Q.est}</em><span class="eles">${fmt(Q.forca[1])}${ico('forca')}</span></div></div>
    ${Q.estado === 'prep' ? `<button class="cqOcioso ${L > 0 ? 'tem' : ''}" data-cq="ocioso">${ico('bau')}<small>${L > 0 ? fmt(L) : 'Lucro'}</small></button>
    <div class="cqBaixo">${trilha()}${P ? `<p class="cqDica cqRival">${ico('herois')} Equipe de <b data-nt>${P.tag ? `[${esc(P.tag)}] ` : ''}${esc(P.apelido)}</b></p>` : ''}<p class="cqDica">${Q.est % 10 === 0 ? 'Estágio de CHEFE! Vence e ganha um Ovo Mágico.' : Q.forca[0] < Q.forca[1] * 0.8 ? 'Inimigos fortes: suba o nível dos pets ou choque ovos.' : 'Os pets lutam sozinhos. Boa sorte!'}</p>
      <div class="cqBotoes"><button class="btn azul" data-cq="pets">${ico('pata')} Pets</button><button class="btn verde grande" data-cq="lutar">Lutar</button></div></div>`
    : Q.estado === 'luta' ? `<div class="cqLuta"><button class="cqVel" data-cq="vel">x${Q.vel}</button></div>` : ''}
    <div class="cqJanela" id="cqJanela" hidden></div>`;
}
function lutar() { if (Q.estado !== 'prep') return; Q.estado = 'luta'; Q.banner = { txt: 'LUTEM!', cor: '#ffd84a', t: 0 }; sfx('trombeta'); som('espada'); desenhar(); }
function acabar(venceu) {
  Q.estado = 'fim'; Q.venceu = venceu; if (Q.sem3d) return;
  Q.banner = { txt: venceu ? 'VITÓRIA!' : 'DERROTA!', cor: venceu ? '#ffd84a' : '#ff6a5a', t: 0 }; sfx(venceu ? 'vitoria' : 'derrota'); if (venceu) flashTela('#fff', 0.4);
  for (const u of Q.us) if (!u.morto && u.v) u.v.tocar('Idle');
  const est = Q.est; let premio = 0, ovo = null;
  if (venceu && Q.rival) { evento('arena'); ON.cqDerrotou(Q.rival.codigo).catch(() => {}); }
  if (venceu) { evento('conquista'); premio = (15 + 6 * est) * (fimDeSemana() ? 2 : 1); if (est % 10 === 0) { ovo = 'magico'; premio *= 4; } else if (est % 5 === 0) ovo = 'comum';
    S.moedas += premio; if (ovo) S.ovos[ovo]++; S.cq.est = Math.max(S.cq.est, est + 1); salvar(); if (S.online?.codigo) ON.cqEnviar(S.cq.est - 1, forcaEquipe()).catch(() => {}); }
  setTimeout(() => { if (!Q || !el) return; const j = $('#cqJanela'); j.hidden = false; el.querySelector('.cqLuta')?.remove();
    j.innerHTML = `<div class="cqFim ${venceu ? 'vit' : 'der'}"><h2>${venceu ? `Estágio ${est} conquistado!` : 'Seus pets caíram!'}</h2>
      ${venceu ? `<div class="ganho">${ico('ouro')}<b>+${fmt(premio)}</b></div>${ovo ? `<div class="cqOvo">${ovoHtml(ovo)}<b>+1 ${OVOS[ovo].nome}!</b></div>` : ''}<p>Lucro ocioso agora: ${fmt(lucroHora())}/h</p>`
        : '<p>Suba o nível dos pets, junte 3 iguais para um dourado ★ ou choque ovos.</p>'}
      <button class="btn verde grande" data-cq="seguir">${venceu ? `Estágio ${S.cq.est} ${ico('seta')}` : 'Tentar de novo'}</button>
      <button class="btn azul" data-cq="pets">${ico('pata')} Pets</button></div>`;
    if (venceu) { flashTela('#ffe27a', 0.45); setTimeout(() => voarMoedas('#cqJanela .ganho', 10), 120); } }, 1600);
}
export function ovoHtml(tipo, cls = '') {
  const [c1, c2] = OVOS[tipo].cor, i = Math.random().toString(36).slice(2, 7);
  return `<div class="ovoG ${tipo} ${cls}"><svg viewBox="0 0 100 120"><defs><radialGradient id="o${i}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs>
    <path d="M50 4C24 4 8 52 8 76c0 24 19 40 42 40s42-16 42-40C92 52 76 4 50 4z" fill="url(#o${i})" stroke="rgba(0,0,0,.35)" stroke-width="3"/>
    ${tipo === 'magico' ? '<path d="M30 40l6 6-6 6-6-6zM66 62l7 7-7 7-7-7zM40 84l5 5-5 5-5-5z" fill="#fff6" />' : '<circle cx="34" cy="58" r="6" fill="#0001"/><circle cx="64" cy="44" r="5" fill="#0001"/><circle cx="58" cy="88" r="7" fill="#0001"/>'}
    <path class="trinca" d="M14 70l14-8 10 10 12-12 12 12 12-10 14 8" fill="none" stroke="#2a1a0a" stroke-width="3" stroke-linejoin="round"/></svg></div>`;
}
function mostrarOcioso() {
  const j = $('#cqJanela'); j.hidden = false; const t = tempoOcioso(), L = lucroOcioso(), h = n => String(Math.floor(n)).padStart(2, '0');
  j.innerHTML = `<div class="cqFim ocioso"><h2>Lucro ocioso</h2><p>Tempo fora</p>
    <div class="cqBarra"><i style="width:${100 * t / MAX_OCIOSO}%"></i><span>${h(t / 3600e3)}:${h(t / 60e3 % 60)}:${h(t / 1e3 % 60)}${t >= MAX_OCIOSO ? ' (MÁX)' : ''}</span></div>
    <p>${ico('ouro')} ${fmt(lucroHora())}/h · máximo 9h · sobe a cada estágio</p>
    <div class="ganho">${ico('ouro')}<b>${fmt(L)}</b></div>
    <button class="btn verde grande" data-cq="coletar" ${L > 0 ? '' : 'disabled'}>Coletar</button><button class="btn azul" data-cq="fecharJ">Fechar</button></div>`;
}
export function clique(b) {
  const a = b.dataset.cq; if (!a || !Q) return;
  if (a === 'sair') { som('fechar'); aoSair('home'); }
  if (a === 'pets') { som('clique'); aoSair('pets'); }
  if (a === 'lutar') lutar();
  if (a === 'vel') { Q.vel = Q.vel === 1 ? 2 : 1; S.cqVel = Q.vel; salvar(); b.textContent = 'x' + Q.vel; som('clique'); }
  if (a === 'seguir') { som('confirma'); montar(S.cq.est); desenhar(); buscarRival(); }
  if (a === 'ocioso') { som('clique'); mostrarOcioso(); }
  if (a === 'coletar') { const m = coletarOcioso(); if (m > 0) { som('moedas'); sfx('vitoria'); } $('#cqJanela').hidden = true; desenhar(); Q.txt.push({ x: 0, y: 8, z: -36, txt: `+${fmt(m)}`, cor: '#ffd84a', t: 0, grande: true }); }
  if (a === 'fecharJ') { som('fechar'); $('#cqJanela').hidden = true; }
}
// câmera: de lado, um pouco de cima, olhando as duas equipes
export function vista() {
  let cz = (Z_NOS + Z_ELES) / 2;
  if (Q?.estado === 'luta') { const v = Q.us.filter(u => !u.morto); if (v.length) cz = v.reduce((s, u) => s + u.z, 0) / v.length; }
  return { foco: { x: 0, z: cz + 2 }, yaw: Math.PI + 0.3, pitch: 0.72, dist: 64 };
}
// barras de vida, nível e números de dano (canvas 2D por cima)
export function desenharFx(g, dt) {
  if (!Q) return;
  for (const u of Q.us) { if (u.morto || !u.v) continue; const p = C.tela(u.x, u.alt + 1.2, u.z); if (!p) continue;
    const w = u.chefe ? 70 : 46, x = p[0] - w / 2, y = p[1];
    g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.roundRect(x - 2, y - 2, w + 4, 10, 4); g.fill();
    g.fillStyle = u.lado ? '#e8423a' : '#3ac85a'; g.fillRect(x, y, w * u.hp / u.max, 6);
    const R = RARIDADES[PETS[base(u.k)].r], e = est(u.k), txt = `${e ? `★${e} ` : ''}Nv.${u.nvVis}`;
    g.font = '13px Titulo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; const tt = tr(txt); g.strokeText(tt, p[0], y - 3); g.fillStyle = e ? ESTRELAS[e].cor : R.cor === '#9aa3ad' ? '#fff' : R.cor; g.fillText(tt, p[0], y - 3); }
  for (const t of Q.txt) { t.t += dt; const p = C.tela(t.x, t.y + t.t * 3, t.z); if (!p) continue; g.globalAlpha = Math.max(0, 1 - Math.max(0, t.t - 0.4) / 0.4);
    const pop = t.t < 0.1 ? 0.6 + t.t * 9 : Math.max(1, 1.5 - (t.t - 0.1) * 2.5); g.font = `${Math.round((t.grande ? 34 : t.forte ? 26 : 18) * pop)}px Titulo, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(tr(t.txt), p[0], p[1]); g.fillStyle = t.cor; g.fillText(tr(t.txt), p[0], p[1]); g.globalAlpha = 1; }
  Q.txt = Q.txt.filter(t => t.t < 0.8);
  const B = Q.banner;
  if (B) { B.t += dt; const k = Math.min(1, B.t / 0.18), s = k < 1 ? 0.4 + 0.9 * k : 1, a = Math.max(0, 1 - Math.max(0, B.t - 1.1) / 0.4);
    g.save(); g.globalAlpha = a; g.translate(innerWidth / 2, innerHeight * 0.34); g.scale(s, s); g.rotate(-0.04); g.font = '46px Titulo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 9; g.lineJoin = 'round'; g.strokeStyle = 'rgba(30,10,0,.85)'; g.strokeText(tr(B.txt), 0, 0); g.fillStyle = B.cor; g.fillText(tr(B.txt), 0, 0); g.restore(); if (B.t > 1.5) Q.banner = null; }
}
export { forcaInimiga, CLASSES };
window.__cq = { passo }; // testes
