// Batalha da Ponte: o herói atira flechas nas pilhas de +N das laterais para ganhar soldados.
// O exército azul marcha pelo meio contra o exército vermelho e o chefe no fim da ponte.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as C from './cena.js';
import { fase as dadosFase, tiros, vidaMuralha, escudo, fmt, UPGRADES } from './dados.js';
import { S, salvar, comprar } from './meta.js';
import { visualPadrao } from './aparencia.js';
import { ico, som, $, alternarSom, estaMudo } from './util.js';
import { tema, sfx } from './musica.js';
import { criarTropas, desenharTropas, voar, passoVoo, limparTropas } from './tropas.js';

// ---------------- medidas da ponte (frente = -z) ----------------
const MEIA = 17;            // meia largura da ponte
const DIV = 5.8;            // divisórias entre as pistas (x = ±DIV)
const XL = 11.4;            // centro das pistas laterais
const XC = 4.4;             // meia largura da pista do meio
const ZH = -1;              // herói
const ZMURO = -4.5;         // muralha (os vermelhos batem nela)
const ZSPAWN = -9;          // onde surgem os soldados azuis
const ZLANE = -12;          // começo das pistas
const PASSO = 3.4, NB = 20;
const ZBOSS = ZLANE - NB * PASSO - 10;
const MAXU = 900, VEL_AZ = 8, VEL_VM = 4.4;
const ZFRENTE = ZBOSS - 35, ZTRAS = 40;

let G = null;                // partida atual
let tela = 'lobby';          // 'lobby' | 'jogo' | 'fim'
let foco = { x: 0, z: -30 };

// ---------------- texturas desenhadas ----------------
const texCache = {};
function texRotulo(txt, fundo, borda, w = 256, h = 128) {
  const k = txt + fundo + w; if (texCache[k]) return texCache[k];
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  desenharRotulo(g, txt, fundo, borda, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (texCache[k] = t);
}
function desenharRotulo(g, txt, fundo, borda, w, h) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, new THREE.Color(fundo).offsetHSL(0, 0, 0.12).getStyle()); gr.addColorStop(1, fundo);
  g.fillStyle = borda; g.fillRect(0, 0, w, h); g.fillStyle = gr; g.fillRect(8, 8, w - 16, h - 16);
  let fs = Math.round(h * 0.62); g.font = `${fs}px Titulo, sans-serif`;
  while (fs > 20 && g.measureText(txt).width > w - 30) g.font = `${fs -= 4}px Titulo, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = h * 0.09; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(txt, w / 2, h / 2 + 4); g.fillStyle = '#fff'; g.fillText(txt, w / 2, h / 2 + 4);
}
function texPedra() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = '#a9a39a'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
    const ox = (y % 2) * 32, l = 62 + Math.random() * 14;
    g.fillStyle = `hsl(35,6%,${l}%)`; g.fillRect(x * 64 + ox + 2 - 64 * (ox && x === 3 ? 0 : 0), y * 32 + 2, 60, 28);
    if (ox && x === 3) g.fillRect(-32 + 2, y * 32 + 2, 30, 28);
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------------- ponte fixa ----------------
let cena, MAT_PEDRA, MAT_MURO, GEO_FLECHA, MAT_FLECHA;
export function montarPonte() {
  cena = C.obterCena(); C.ceu(0x8cc4ee); C.neblina(260, 520);
  const tp = texPedra(), len = ZTRAS - ZFRENTE;
  const chao = tp.clone(); chao.needsUpdate = true; chao.repeat.set(MEIA * 2 / 8, len / 8);
  MAT_PEDRA = new THREE.MeshLambertMaterial({ map: chao });
  MAT_MURO = new THREE.MeshLambertMaterial({ color: 0x8f8a84 });
  const add = (geo, mat, x, y, z, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = true; m.castShadow = sombra; cena.add(m); return m; };
  // água
  const agua = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: 0x24527e })); agua.rotation.x = -Math.PI / 2; agua.position.y = -7; cena.add(agua);
  // piso e laterais da ponte
  add(new THREE.BoxGeometry(MEIA * 2, 6, len), MAT_PEDRA, 0, -3, (ZTRAS + ZFRENTE) / 2, false);
  // muros com ameias: laterais, divisórias e a muralha do herói
  const muro = (x0, x1, z0, z1, h) => { // caixa + ameias, de (x0,z0) a (x1,z1) alinhada a um eixo
    const geos = [], lx = Math.abs(x1 - x0), lz = Math.abs(z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, esp = 1.2;
    geos.push(new THREE.BoxGeometry(Math.max(esp, lx), h, Math.max(esp, lz)).translate(cx, h / 2, cz));
    const n = Math.floor(Math.max(lx, lz) / 2.4);
    for (let i = 0; i <= n; i++) { const k = n ? i / n : 0.5, x = lx > lz ? x0 + (x1 - x0) * k : cx, z = lx > lz ? cz : z0 + (z1 - z0) * k; geos.push(new THREE.BoxGeometry(esp, 0.9, esp).translate(x, h + 0.45, z)); }
    const m = new THREE.Mesh(mergeGeometries(geos), MAT_MURO); m.castShadow = true; m.receiveShadow = true; cena.add(m);
  };
  muro(-MEIA - 0.6, -MEIA - 0.6, ZTRAS, ZFRENTE, 1.6); muro(MEIA + 0.6, MEIA + 0.6, ZTRAS, ZFRENTE, 1.6);
  muro(-DIV, -DIV, ZLANE, ZBOSS - 6, 1.6); muro(DIV, DIV, ZLANE, ZBOSS - 6, 1.6);
  muro(-MEIA, MEIA, ZMURO, ZMURO, 1.3);
  muro(-MEIA, MEIA, ZBOSS - 14, ZBOSS - 14, 2.2);
  // torres do castelo (kit Kenney) nas pontas
  C.montarEstatico([
    { m: 'C:tower-square', x: -MEIA - 3, z: ZMURO + 1, s: 5 }, { m: 'C:tower-square', x: MEIA + 3, z: ZMURO + 1, s: 5 },
    { m: 'C:flag', x: -MEIA - 3, y: 10, z: ZMURO + 1, s: 4 }, { m: 'C:flag', x: MEIA + 3, y: 10, z: ZMURO + 1, s: 4 },
    { m: 'C:tower-square', x: -MEIA - 3, z: ZBOSS - 12, s: 6 }, { m: 'C:tower-square', x: MEIA + 3, z: ZBOSS - 12, s: 6 },
    { m: 'C:gate', x: 0, z: ZBOSS - 16, s: 7 },
  ]);
  criarTropas(cena);
  GEO_FLECHA = mergeGeometries([new THREE.CylinderGeometry(0.07, 0.07, 2.2, 5).rotateX(Math.PI / 2), new THREE.ConeGeometry(0.2, 0.6, 6).rotateX(-Math.PI / 2).translate(0, 0, -1.3)]);
  MAT_FLECHA = new THREE.MeshBasicMaterial({ color: 0xffd84a });
  montarHud();
}

// ---------------- fase ----------------
const GEO_BLOCO = new THREE.BoxGeometry(9.4, 2.4, 3);
const GEO_BARREIRA = new THREE.BoxGeometry(10.4, 3.6, 1.4);
const MAT_LADO_AZUL = new THREE.MeshLambertMaterial({ color: 0x2a6ad8 }), MAT_LADO_AMAR = new THREE.MeshLambertMaterial({ color: 0xe0a818 }), MAT_MADEIRA = new THREE.MeshLambertMaterial({ color: 0x8a5a2b }), MAT_ROXO = new THREE.MeshLambertMaterial({ color: 0x8a3ad8, emissive: 0x3a0a6a });
const GEO_POSTE = new THREE.BoxGeometry(1.3, 5.2, 1.3), GEO_PAINEL = new THREE.PlaneGeometry(9.6, 2.8), MAT_POSTE = new THREE.MeshLambertMaterial({ color: 0xe8e8f0 });
function criarPortao(p) {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ map: texRotulo(p.tipo === 'vezes' ? `x${p.valor}` : `+${p.valor}`, '#2fa8ff', '#0f5ab0'), transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false });
  for (const x of [-XC - 0.6, XC + 0.6]) { const m = new THREE.Mesh(GEO_POSTE, MAT_POSTE); m.position.set(x, 2.6, 0); m.castShadow = true; g.add(m); }
  const pn = new THREE.Mesh(GEO_PAINEL, mat); pn.position.y = 3.6; g.add(pn); p.painel = pn;
  g.position.set(0, 0, p.z); cena.add(g); p.o = g; p.ganho = 0; p.tt = 0; p.pulso = 0;
}
function criarBloco(b, lado) {
  const x = lado * XL;
  if (b.tipo === 'barreira') {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    b.cv = cv; b.tex = t; b.hpMax = b.hp; redesenharBarreira(b);
    const mf = new THREE.MeshLambertMaterial({ map: t }); b.mesh = new THREE.Mesh(GEO_BARREIRA, [MAT_MADEIRA, MAT_MADEIRA, mf, MAT_MADEIRA, mf, MAT_MADEIRA]);
  } else if (b.tipo === 'poder') {
    const mf = new THREE.MeshLambertMaterial({ map: texRotulo(b.p === 'flecha' ? 'FLECHA +1' : 'RÁPIDO', '#a24ae8', '#5a1a9a') });
    b.mesh = new THREE.Mesh(GEO_BLOCO, [MAT_ROXO, MAT_ROXO, mf, MAT_ROXO, mf, MAT_ROXO]);
  } else {
    const amarelo = lado > 0, txt = b.tipo === 'vezes' ? `x${b.valor}` : `+${b.valor}`, fundo = b.tipo === 'vezes' ? '#2bb84a' : amarelo ? '#f2b51a' : '#2f7ae8', borda = b.tipo === 'vezes' ? '#13702a' : amarelo ? '#a8740a' : '#173f9a';
    const mf = new THREE.MeshLambertMaterial({ map: texRotulo(txt, fundo, borda) }), ml = b.tipo === 'vezes' ? new THREE.MeshLambertMaterial({ color: 0x2bb84a }) : amarelo ? MAT_LADO_AMAR : MAT_LADO_AZUL;
    b.mesh = new THREE.Mesh(GEO_BLOCO, [ml, ml, mf, ml, mf, ml]);
  }
  b.mesh.castShadow = true; b.mesh.receiveShadow = true; b.mesh.position.set(x, b.tipo === 'barreira' ? 1.8 : 1.2, b.z); cena.add(b.mesh);
}
function redesenharBarreira(b) {
  const g = b.cv.getContext('2d'); g.clearRect(0, 0, 256, 96);
  g.fillStyle = '#6a4220'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#8a5a2b'; for (let i = 0; i < 4; i++) g.fillRect(4, 4 + i * 23, 248, 19);
  g.fillStyle = '#7a7f86'; g.fillRect(0, 0, 18, 96); g.fillRect(238, 0, 18, 96);
  g.font = '64px Titulo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.6)';
  g.strokeText(b.hp, 128, 52); g.fillStyle = '#fff'; g.fillText(b.hp, 128, 52); b.tex.needsUpdate = true;
}

export function iniciarFase(n) {
  limparFase();
  const F = dadosFase(n), up = S.up;
  G = { F, n, t: 0, az: [], vm: [], flechas: [], txt: [], fila: 8 * up.exercito, acum: 0, cd: 0.5, pistas: [[], []], spawnVm: 0, golpePend: 0,
    muro: vidaMuralha(up.vida), muroMax: vidaMuralha(up.vida), tiro: tiros(up.fogo), nFlechas: 1 + up.flechas, escudo: escudo(up.escudos),
    heroi: { x: 0, alvo: 0 }, golpeT: 4, fim: null, mortesVm: 0, portoes: [], ondaT: 16, banner: null, punch: 0, lento: 0, brilhoH: 0,
    pd: { chuva: { cd: 4, max: 11 }, gigante: { cd: 12, max: 30 } }, chuvas: [], gigante: null, puloT: 0 };
  for (const p0 of F.portoes) { const p = { ...p0, z: ZLANE - 2 - p0.i * PASSO }; criarPortao(p); G.portoes.push(p); }
  [F.esq, F.dir].forEach((lista, k) => lista.forEach((b0, i) => { const b = { ...b0, z: ZLANE - 2 - i * PASSO };
    if (b.tipo !== 'barreira') b.hp = b.hpMax = (b.tipo === 'mais' ? Math.max(1, Math.round(1.3 * Math.log(b.valor))) : 3) + F.duro; criarBloco(b, k ? 1 : -1); G.pistas[k].push(b); }));
  // chefe
  const ch = C.personagem(F.chefe.modelo, [], 1); ch.raiz.scale.setScalar(5); ch.raiz.position.set(0, 0, ZBOSS); ch.tocar('Idle');
  G.chefe = { v: ch, hp: F.chefe.hp, max: F.chefe.hp, nome: F.chefe.nome, flash: 0, z: ZBOSS, y: 0, esc: 5, mats: [] };
  ch.raiz.traverse(o => { if (o.material?.emissive) G.chefe.mats.push(o.material); });
  // herói arqueiro
  if (!G.heroiV) { const v = C.heroi(S.visual || visualPadrao('arq')); v.raiz.scale.setScalar(2.4); v.raiz.rotation.y = Math.PI; v.tocar('Ranged_Bow_Aiming_Idle'); G.heroiV = v; }
  G.heroiV.raiz.position.set(0, 0, ZH);
}
function limparFase() {
  if (!G) return;
  for (const p of G.pistas) for (const b of p) cena.remove(b.mesh);
  for (const f of G.flechas) cena.remove(f.o);
  for (const p of G.portoes) cena.remove(p.o);
  G.chefe?.v.remover(); G.heroiV?.remover(); G.gigante?.v.remover();
  for (const c of G.chuvas) for (const f of c.fl) cena.remove(f.o);
  limparTropas(); G = null;
}

// ---------------- HUD ----------------
let fx, gfx;
function montarHud() {
  $('#hud').innerHTML = `<div id="lobby"></div>
    <div id="jogo" hidden><div class="jTopo"><button class="lSair" data-a="sair">${ico('fechar')}</button><div class="jFase">Fase <b id="jN"></b></div><div class="pilula ouro">${ico('ouro')}<b id="jMoedas"></b></div></div>
      <div class="jChefe"><b id="jChefeN"></b><div class="barra vm"><i id="jChefeB"></i><span id="jChefeT"></span></div></div>
      <div class="jPoderes"><button class="poder" data-pd="chuva">${ico('h_chuva')}<small>Chuva</small></button><button class="poder" data-pd="gigante">${ico('cav')}<small>Gigante</small></button></div>
      <div class="jMuro">${ico('escudo')}<div class="barra muro"><i id="jMuroB"></i><span id="jMuroT"></span></div></div>
      <p class="jDica" id="jDica">Arraste para mover · as flechas saem sozinhas</p></div>
    <div id="fim" hidden></div>`;
  fx = document.createElement('canvas'); fx.id = 'fx'; document.body.append(fx); gfx = fx.getContext('2d');
  const medir = () => { fx.width = innerWidth * devicePixelRatio; fx.height = innerHeight * devicePixelRatio; gfx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
  medir(); addEventListener('resize', medir);
  // arrastar para mover o herói
  let toque = null;
  const alvo = $('#toque');
  alvo.addEventListener('pointerdown', e => { if (tela !== 'jogo' || !G) return; toque = { id: e.pointerId, x0: e.clientX, h0: G.heroi.alvo }; alvo.setPointerCapture(e.pointerId); $('#jDica').hidden = true; });
  alvo.addEventListener('pointermove', e => { if (!toque || e.pointerId !== toque.id || !G) return; G.heroi.alvo = Math.max(-MEIA + 2.5, Math.min(MEIA - 2.5, toque.h0 + (e.clientX - toque.x0) * (MEIA * 2.4 / innerWidth))); });
  const solta = e => { if (toque && e.pointerId === toque.id) toque = null; };
  alvo.addEventListener('pointerup', solta); alvo.addEventListener('pointercancel', solta);
  $('#hud').addEventListener('click', clique);
}
export function abrirLobby() {
  roleta = null;
  tela = 'lobby'; $('#jogo').hidden = true; $('#fim').hidden = true; $('#lobby').hidden = false; tema('guilda');
  iniciarFase(S.fase); desenharLobby();
}
function desenharLobby() {
  const F = dadosFase(S.fase);
  $('#lobby').innerHTML = `<div class="lbTopo"><div class="pilula ouro">${ico('ouro')}<b>${fmt(S.moedas)}</b></div><button class="redondo" data-a="som">${ico(estaMudo() ? 'mudo' : 'som')}</button></div>
    <div class="lbTitulo"><small>Batalha da</small><h1>Ponte</h1></div>
    <div class="lbPainel"><div class="lbFase"><span>FASE</span><b>${S.fase}</b><small>${ico('chefe')} ${F.chefe.nome} · vida ${fmt(F.chefe.hp)}</small></div>
      <div class="ups">${Object.entries(UPGRADES).map(([k, U]) => { const n = S.up[k], max = n >= U.max, c = U.custo(n);
        return `<button class="up ${!max && S.moedas >= c ? 'pode' : ''}" data-up="${k}"><span class="upIco">${ico(U.icone)}</span><b>${U.nome}</b><small>${U.desc(n)}</small><em>${max ? 'MÁX' : `${ico('ouro')}${fmt(c)}`}</em><i>Nv ${n}</i></button>`; }).join('')}</div>
      <button class="btn verde grande" data-a="jogar">${ico('h_triplo')} JOGAR</button></div>`;
}
function clique(e) {
  const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
  if (a === 'som') { alternarSom(); som('clique'); desenharLobby(); }
  if (b.dataset.up) { if (comprar(b.dataset.up)) { som('compra'); desenharLobby(); } else som('erro'); }
  if (a === 'jogar') { som('confirma'); comecarFase(); }
  if (a === 'sair') { som('fechar'); abrirLobby(); }
  if (a === 'proxima') { som('confirma'); comecarFase(); }
  if (a === 'lobby') { som('clique'); abrirLobby(); }
  if (b.dataset.pd) usarPoder(b.dataset.pd);
  if (a === 'roleta') pararRoleta();
}
function comecarFase() {
  roleta = null;
  if (!G || G.n !== S.fase || G.t > 0) iniciarFase(S.fase);
  tela = 'jogo'; $('#lobby').hidden = true; $('#fim').hidden = true; $('#jogo').hidden = false; $('#jDica').hidden = false;
  $('#jN').textContent = G.n; $('#jChefeN').textContent = G.chefe.nome; tema((G.n - 1) % 8);
}
const ROLETA = [2, 3, 5, 3, 2];
let roleta = null;
function pararRoleta() {
  if (!roleta || roleta.parada) return; roleta.parada = true; const extra = roleta.ganho * (roleta.m - 1);
  S.moedas += extra; salvar(); som('lendario'); $('#fGanho').textContent = `+${fmt(roleta.ganho * roleta.m)}`; $('#fGanho').parentElement.classList.add('pulo');
  $('#fBotoes').hidden = true; $('#fSeguir').hidden = false;
}
function terminar(venceu) {
  if (G.fim) return; G.fim = venceu ? 'v' : 'd'; tela = 'fim';
  const ganho = venceu ? G.F.moedas + Math.floor(G.az.length / 4) : Math.round(G.F.moedas * 0.25);
  S.moedas += ganho; if (venceu) { S.fase++; S.melhor = Math.max(S.melhor, G.n); } salvar();
  setTimeout(() => {
    $('#jogo').hidden = true; const f = $('#fim'); f.hidden = false;
    f.innerHTML = `<div class="fimCaixa ${venceu ? 'vit' : 'der'}"><h2>${venceu ? 'VITÓRIA!' : 'A muralha caiu!'}</h2>
      <p>${venceu ? `${G.chefe.nome} foi derrotado!` : 'Melhore o exército e tente de novo.'}</p>
      <div class="ganho">${ico('ouro')}<b id="fGanho">+${fmt(ganho)}</b></div>
      ${venceu ? `<div class="roleta">${ROLETA.map(m => `<span class="m${m}">x${m}</span>`).join('')}<i id="rAgulha"></i></div>
      <div id="fBotoes"><button class="btn amarelo grande" data-a="roleta">${ico('ouro')} Pegar <b id="rMult">x2</b></button>
      <button class="fSo" data-a="proxima">Só +${fmt(ganho)}, próxima fase</button></div>` : ''}
      <div id="fSeguir" ${venceu ? 'hidden' : ''}><button class="btn verde grande" data-a="proxima">${venceu ? `Fase ${S.fase} ${ico('seta')}` : 'Tentar de novo'}</button>
      <button class="btn azul" data-a="lobby">${ico('raio')} Melhorias</button></div></div>`;
    som(venceu ? 'lendario' : 'falha');
    if (venceu) { roleta = { ganho, t0: performance.now(), m: 2 }; const gira = () => { if (!roleta || roleta.parada) return;
      const k = (Math.sin((performance.now() - roleta.t0) / 1000 * 3.2 - Math.PI / 2) + 1) / 2; roleta.m = ROLETA[Math.min(ROLETA.length - 1, Math.floor(k * ROLETA.length))];
      $('#rAgulha').style.left = (k * 100) + '%'; $('#rMult').textContent = 'x' + roleta.m; requestAnimationFrame(gira); }; gira(); }
  }, venceu ? 1800 : 1200);
}

// ---------------- laço ----------------
export const _G = () => G; // para testes
export const _sim = dt => passoJogo(dt);
let distCam = 106;
export function passo(dt0) {
  let dt = dt0; if (G && G.lento > 0) { G.lento -= dt0; dt = dt0 * 0.25; }
  const t = C.tempo();
  if (G) {
    G.heroiV.mixer.update(dt);
    if (tela === 'jogo' && !G.fim) passoJogo(dt);
    else if (G.fim === 'v') { G.chefe.v.mixer.update(dt); }
    else G.chefe.v.mixer.update(dt);
    // desenha os exércitos
    desenharTropas('az', G.az, Math.PI, t); desenharTropas('vm', G.vm, 0, t); passoVoo(dt);
    // pilhas deslizam para a frente da pista
    for (const p of G.pistas) p.forEach((b, i) => { const zAlvo = ZLANE - 2 - i * PASSO; b.z += (zAlvo - b.z) * Math.min(1, dt * 5); b.mesh.position.z = b.z; });
    const ch = G.chefe; ch.flash = Math.max(0, ch.flash - dt);
    { const f = ch.flash > 0 ? 0.45 : 0, r = ch.furia ? 0.28 + 0.12 * Math.sin(t * 9) : 0; for (const m of ch.mats) m.emissive.setRGB(f + r, f, f); }
    ch.esc += ((ch.furia ? 6 : 5) - ch.esc) * Math.min(1, dt * 3); ch.v.raiz.scale.setScalar(ch.esc);
    G.heroiV.raiz.position.x = G.heroi.x; ch.v.raiz.position.set(0, ch.y, ch.z);
    if (G.gigante) { G.gigante.v.mixer.update(dt); G.gigante.v.raiz.position.z = G.gigante.z; }
    G.brilhoH = Math.max(0, G.brilhoH - dt); G.heroiV.brilho(G.brilhoH > 0 ? 0.5 * G.brilhoH : 0);
    for (const p of G.portoes) { p.pulso = Math.max(0, p.pulso - dt * 4); p.painel.scale.setScalar(1 + p.pulso * 0.12); }
    G.punch = Math.max(0, G.punch - dt * 3);
  }
  const final = G && G.fim === 'v';
  foco.x = final ? 0 : (G ? G.heroi.x : 0) * 0.25; foco.z = final ? G.chefe.z + 14 : -42;
  if (tela === 'lobby') foco.z = -42 + Math.sin(t * 0.3) * 2;
  distCam += ((final ? 62 : 106) - distCam) * Math.min(1, dt0 * 2);
  C.camera.yaw = Math.PI; C.camera.pitch = 0.9; C.camera.dist = distCam - (G ? G.punch * 7 : 0); C.camera.altura = 0; C.camera.suave = final ? 2.5 : 4;
  if (window.__ov) { Object.assign(C.camera, window.__ov.cam); Object.assign(foco, window.__ov.foco); } // para testes
  C.quadro(dt, foco);
  desenharFx(dt);
}
function passoJogo(dt) {
  G.t += dt; const h = G.heroi, ch = G.chefe;
  // herói anda e atira
  h.x += (h.alvo - h.x) * Math.min(1, dt * 14);
  G.cd -= dt;
  if (G.cd <= 0) {
    G.cd = 1 / G.tiro; G.heroiV.tocar('Ranged_Bow_Release', { loop: false, reinicia: true, vel: Math.max(1.2, G.tiro * 0.6) });
    for (let k = 0; k < G.nFlechas; k++) { const x = h.x + (k - (G.nFlechas - 1) / 2) * 1.1, o = new THREE.Mesh(GEO_FLECHA, MAT_FLECHA); o.position.set(x, 2.6, ZH - 1); cena.add(o); G.flechas.push({ x, z: ZH - 1, o }); }
    if (Math.random() < 0.5) sfx('arco');
  }
  // vermelhos saem do portão do chefe
  G.ondaT -= dt;
  const ritmo = G.F.ritmo * (1 + G.t / 45);
  if (G.ondaT <= 0) { G.ondaT = 17; G.spawnVm += Math.round(ritmo * 5); faixa('ONDA DE INIMIGOS!', '#ff5a4a'); ch.v.tocar('Attack2', { loop: false, reinicia: true }); som('pancada', 0.5); C.camera.tremor = 0.5; }
  if (G.t > 2) { G.spawnVm += dt * ritmo; while (G.spawnVm >= 1 && G.vm.length < MAXU) { G.spawnVm--; G.vm.push({ x: (Math.random() - 0.5) * XC * 1.8, z: ch.z + 5 + Math.random() * 2, ph: Math.random() * 6, ax: (Math.random() - 0.5) * XC * 1.8 }); } }
  // azuis entram pela base da pista do meio
  G.acum += dt * 40;
  while (G.acum >= 1 && G.fila > 0 && G.az.length < MAXU) { G.acum--; G.fila--; G.az.push({ x: (Math.random() - 0.5) * XC * 1.6, z: ZSPAWN + Math.random(), ph: Math.random() * 6, ax: (Math.random() - 0.5) * XC * 1.8 }); }
  if (G.acum > 2) G.acum = 2;
  // portões: cada azul que atravessa vira dois (x2) ou o primeiro chama reforços (+N)
  const novos = [];
  for (const p of G.portoes) {
    if (p.quebrado) continue;
    for (const a of G.az) {
      if (a.z > p.z || a.z < p.z - 3 || a.p & (1 << p.i)) continue;
      a.p = (a.p || 0) | (1 << p.i); p.pulso = 1;
      const n = p.tipo === 'vezes' ? p.valor - 1 : (p.usado ? 0 : p.valor); p.usado = true;
      for (let k = 0; k < n && G.az.length + novos.length < MAXU; k++) novos.push({ x: Math.max(-XC, Math.min(XC, a.x + (Math.random() - 0.5) * 2.4)), z: a.z - Math.random() * 1.5, ph: Math.random() * 6, ax: (Math.random() - 0.5) * XC * 1.8, p: a.p });
      p.ganho += n;
    }
    p.tt -= dt;
    if (p.ganho > 0 && p.tt <= 0) { G.txt.push({ x: (Math.random() - 0.5) * 4, y: 6, z: p.z, txt: '+' + fmt(p.ganho), cor: '#8ae0ff', t: 0, grande: true }); p.ganho = 0; p.tt = 0.35; som('moedas', 0.25); }
    // o chefe passa por cima e quebra o portão
    if (ch.z + 4 >= p.z) { p.quebrado = true; cena.remove(p.o); C.faiscas(0, 3, p.z, 0x8ae0ff, 50, 8); C.camera.tremor = 0.6; som('pancada'); faixa('O CHEFE QUEBROU O PORTÃO!', '#ff9a3a'); }
  }
  if (novos.length) G.az.push(...novos);
  // grade dos vermelhos por faixa de z (para choques e flechas)
  const grade = new Map(), K = 1.6; for (const v of G.vm) { const k = Math.floor(v.z / K); let l = grade.get(k); if (!l) grade.set(k, l = []); l.push(v); }
  // marcha
  for (const a of G.az) if (!a.luta) { a.z -= VEL_AZ * dt; a.x += (a.ax - a.x) * Math.min(1, dt * 3); }
  for (const v of G.vm) { if (v.luta && (v.luta.morto || v.luta.luta !== v)) v.luta = null; if (!v.luta) { v.z += VEL_VM * dt; v.x += (v.ax - v.x) * Math.min(1, dt * 2); } }
  // choques: cada azul procura um vermelho à frente e mira nele; encostou, os dois caem
  let poeira = 0;
  for (const a of G.az) {
    if (a.morto) continue;
    if (a.luta) { // duelo: troca espadadas por um instante, depois resolve
      const v = a.luta; if (v.morto) { a.luta = null; continue; }
      if ((a.tl -= dt) > 0) continue;
      v.morto = true; G.mortesVm++; voar('vm', v.x, v.z, (Math.random() - 0.5) * 4, 6 + Math.random() * 4, -4 - Math.random() * 3); if (poeira++ < 6) C.faiscas(v.x, 1.4, v.z, 0xffffff, 4, 3);
      if (Math.random() >= G.escudo) { a.morto = true; voar('az', a.x, a.z, (Math.random() - 0.5) * 4, 5 + Math.random() * 3, 3 + Math.random() * 2); }
      a.luta = null; continue;
    }
    const k = Math.floor(a.z / K); let perto = null, d0 = 1e9;
    for (let d = -4; d <= 1; d++) for (const v of grade.get(k + d) || []) { if (v.morto) continue; const dz = a.z - v.z, dx = Math.abs(a.x - v.x); if (dz > -1.5 && dz < d0) { d0 = dz; perto = v; } }
    if (!perto) continue;
    a.ax = perto.x; perto.ax = a.x;
    if (d0 < 1.4 && Math.abs(a.x - perto.x) < 1.5) { a.luta = perto; a.tl = 0.2 + Math.random() * 0.3; perto.luta = a; }
  }
  // azuis que passaram batem no chefe
  for (const a of G.az) if (!a.morto && a.z <= ch.z + 5) { a.morto = true; ferirChefe(1, a.x, a.z); voar('az', a.x, a.z, (Math.random() - 0.5) * 10, 10 + Math.random() * 6, 7 + Math.random() * 5); }
  // vermelhos que chegaram batem na muralha
  for (const v of G.vm) if (!v.morto && v.z >= ZMURO - 1.2) { v.morto = true; G.muro--; C.faiscas(v.x, 1.5, v.z, 0xff5a3a, 10, 4); C.camera.tremor = Math.max(C.camera.tremor, 0.25); som('pancada', 0.3); }
  // flechas
  for (const f of G.flechas) {
    if (f.morta) continue; f.z -= 95 * dt; f.o.position.z = f.z;
    const ax = Math.abs(f.x);
    if (f.z < ZLANE && ax > DIV - 0.9 && ax < DIV + 0.9) { f.morta = true; continue; } // bateu na divisória
    if (ax >= DIV + 0.9) { // pista lateral: acerta a primeira pilha
      const p = G.pistas[f.x < 0 ? 0 : 1], b = p[0];
      if (b && f.z <= b.z + 2) { f.morta = true; acertarBloco(b, p, f.x < 0 ? -1 : 1); }
      else if (f.z < ZBOSS) f.morta = true;
    } else { // pista do meio: vermelhos e depois o chefe
      const k = Math.floor(f.z / K); let alvo = null;
      for (let d = 0; d <= 1 && !alvo; d++) for (const v of grade.get(k + d) || []) if (!v.morto && Math.abs(v.x - f.x) < 1.3 && Math.abs(v.z - f.z) < 1.8) { alvo = v; break; }
      if (alvo) { alvo.morto = true; G.mortesVm++; f.morta = true; voar('vm', alvo.x, alvo.z, (Math.random() - 0.5) * 3, 5, -6); C.faiscas(alvo.x, 1.4, alvo.z, 0xff6a4a, 6, 3); }
      else if (f.z <= ch.z + 3) { f.morta = true; ferirChefe(1, f.x, ch.z + 3); }
    }
  }
  for (const f of G.flechas) if (f.morta) cena.remove(f.o);
  G.flechas = G.flechas.filter(f => !f.morta); G.az = G.az.filter(a => !a.morto); G.vm = G.vm.filter(v => !v.morto);
  // golpe do chefe: esmaga os azuis que chegam perto
  G.golpeT -= dt;
  if (G.golpeT <= 0 && !ch.pulo && (G.az.some(a => a.z < ch.z + 22) || G.gigante?.estado === 'luta')) {
    G.golpeT = ch.furia ? 3.5 : 5; G.golpePend = 0.45; ch.v.tocar('Attack', { loop: false, reinicia: true });
  }
  if (G.golpePend > 0 && (G.golpePend -= dt) <= 0) { const zc = ch.z + 9; C.onda(0, zc, 9, 0xff9a3a, 0.5); C.faiscas(0, 1, zc, 0xc8a878, 40, 7); C.camera.tremor = 0.6; som('pancada');
    for (const a of G.az) if (Math.hypot(a.x, a.z - zc) < 9) { a.morto = true; arremessar('az', a, 0, zc, 12); } G.az = G.az.filter(a => !a.morto); if (G.gigante && Math.abs(G.gigante.z - zc) < 10) G.gigante.hp -= 15; } else if (!/Attack/.test(ch.v.anim) || G.golpeT < 4) ch.v.tocar(G.t > 6 ? 'Gallop' : 'Idle', { vel: 0.45 });
  // o chefe avança devagar até a muralha (mais rápido furioso)
  if (G.t > 6 && !ch.pulo) ch.z = Math.min(ZMURO - 7, ch.z + (0.45 + 0.02 * G.n) * (ch.furia ? 1.6 : 1) * dt);
  // com metade da vida ele fica furioso: cresce, fica vermelho, chama uma onda e começa a pular
  if (!ch.furia && ch.hp < ch.max / 2) { ch.furia = true; G.puloT = 4; G.spawnVm += Math.round(ritmo * 6); faixa(`${ch.nome.toUpperCase()} FICOU FURIOSO!`, '#ff4a3a');
    ch.v.tocar('Attack2', { loop: false, reinicia: true }); C.camera.tremor = 1; C.onda(0, ch.z + 3, 14, 0xff3a2a, 0.8); som('pancada'); }
  if (ch.furia) {
    if (Math.random() < dt * 4) C.faiscas((Math.random() - 0.5) * 6, 4 + Math.random() * 6, ch.z, 0xff4a2a, 3, 2);
    G.puloT -= dt;
    if (G.puloT <= 0 && !ch.pulo) { G.puloT = 11; const z1 = Math.min(ch.z + 10, ZMURO - 8); ch.pulo = { t: 0, z0: ch.z, z1 }; C.aviso(0, z1 + 4, 11, 0.9, 0xff3322); faixa('CUIDADO: SALTO!', '#ff9a3a'); }
    if (ch.pulo) { const P = ch.pulo; P.t += dt; const k = Math.min(1, P.t / 0.9); ch.z = P.z0 + (P.z1 - P.z0) * k; ch.y = Math.sin(Math.PI * k) * 9;
      if (k >= 1) { ch.pulo = null; ch.y = 0; const zc = ch.z + 4; C.onda(0, zc, 13, 0xff7a2a, 0.6); C.faiscas(0, 1, zc, 0xc8a878, 70, 10); C.camera.tremor = 1.2; G.punch = 1; som('pancada');
        for (const a of G.az) if (Math.hypot(a.x, a.z - zc) < 11) { a.morto = true; arremessar('az', a, 0, zc, 16); } G.az = G.az.filter(a => !a.morto); if (G.gigante && Math.abs(G.gigante.z - zc) < 12) G.gigante.hp -= 30; } }
  }
  // poderes: recarga, chuva de flechas caindo e o gigante
  for (const [k, P] of Object.entries(G.pd)) { P.cd = Math.max(0, P.cd - dt); const b = document.querySelector(`[data-pd=${k}]`); if (b) { b.style.setProperty('--p', `${360 * P.cd / P.max}deg`); b.classList.toggle('pronto', P.cd <= 0); } }
  for (const c of G.chuvas) {
    c.t += dt; for (const f of c.fl) { f.o.position.y = Math.max(0.5, f.y0 - 55 * Math.max(0, c.t - f.atraso)); }
    if (c.t >= 0.75 && !c.feito) { c.feito = true; let n = 0;
      for (const v of G.vm) if (Math.hypot(v.x, v.z - c.z) < 7.5) { v.morto = true; n++; arremessar('vm', v, 0, c.z, 9); } G.vm = G.vm.filter(v => !v.morto);
      if (Math.abs(ch.z + 3 - c.z) < 9) ferirChefe(Math.round(ch.max * 0.05), 0, ch.z + 3, true);
      C.onda(0, c.z, 9, 0x8ac8ff, 0.5); C.faiscas(0, 1, c.z, 0xffd84a, 50, 8); C.camera.tremor = 0.5; som('pancada', 0.5);
      if (n) G.txt.push({ x: 0, y: 5, z: c.z, txt: `${n} derrotados!`, cor: '#ffd84a', t: 0, grande: true }); }
    if (c.t > 1.4) { for (const f of c.fl) cena.remove(f.o); c.fim = true; }
  }
  G.chuvas = G.chuvas.filter(c => !c.fim);
  const gi = G.gigante;
  if (gi) {
    gi.t += dt; gi.hp -= dt * 3;
    if (gi.estado === 'anda') {
      gi.z -= 6 * dt; gi.v.tocar('Running_A', { vel: 0.8 });
      for (const v of G.vm) if (Math.abs(v.z - gi.z) < 3 && Math.abs(v.x) < 5) { v.morto = true; gi.hp -= 0.5; voar('vm', v.x, v.z, (v.x < 0 ? -1 : 1) * (8 + Math.random() * 8), 9 + Math.random() * 6, -4); if (Math.random() < 0.3) C.faiscas(v.x, 1.5, v.z, 0xff6a4a, 5, 4); }
      G.vm = G.vm.filter(v => !v.morto);
      if (gi.z <= ch.z + 8) gi.estado = 'luta';
    } else if (gi.estado === 'luta') {
      gi.z = ch.z + 8; gi.golpe -= dt;
      if (gi.golpe <= 0) { gi.golpe = 0.7; gi.v.tocar('Melee_2H_Attack_Chop', { loop: false, reinicia: true }); if (!gi.v.tem('Melee_2H_Attack_Chop')) gi.v.tocar('Melee_1H_Attack_Chop', { loop: false, reinicia: true });
        ferirChefe(Math.round(ch.max * 0.012) + 1, 0, ch.z + 4, true); C.faiscas(0, 5, ch.z + 5, 0xffffff, 12, 6); C.camera.tremor = Math.max(C.camera.tremor, 0.3); som('pancada', 0.35); }
    }
    if (gi.hp <= 0 && gi.estado !== 'cai') { gi.estado = 'cai'; gi.v.tocar('Death_A', { loop: false, reinicia: true }); gi.tFim = gi.t + 1.6; }
    if (gi.estado === 'cai' && gi.t > gi.tFim) { C.faiscas(0, 3, gi.z, 0x8ac8ff, 30, 5); gi.v.remover(); G.gigante = null; }
  }
  ch.v.mixer.update(dt);
  // HUD
  $('#jMoedas').textContent = fmt(S.moedas);
  $('#jChefeB').style.width = (100 * ch.hp / ch.max) + '%'; $('#jChefeT').textContent = `${fmt(Math.max(0, ch.hp))} / ${fmt(ch.max)}`;
  $('#jMuroB').style.width = (100 * Math.max(0, G.muro) / G.muroMax) + '%'; $('#jMuroT').textContent = `${Math.max(0, G.muro)} / ${G.muroMax}`;
  if (ch.hp <= 0) { ch.v.tocar('Death', { loop: false, reinicia: true }); for (const v of G.vm) arremessar('vm', v, 0, ch.z, 14); G.vm = []; C.camera.tremor = 1;
    G.lento = 1.6; C.faiscas(0, 6, ch.z, 0xffd84a, 120, 12); C.onda(0, ch.z, 16, 0xffd84a, 0.9); faixa('VITÓRIA!', '#ffd84a'); G.heroiV.tocar('Cheering'); terminar(true); }
  else if (ch.z >= ZMURO - 7) { G.muro = 0; C.camera.tremor = 1; faixa('O CHEFE DERRUBOU A MURALHA!', '#ff5a4a'); G.heroiV.tocar('Death_A', { loop: false, reinicia: true }); terminar(false); }
  else if (G.muro <= 0) { G.heroiV.tocar('Death_A', { loop: false, reinicia: true }); terminar(false); }
}
// joga o soldado para longe do ponto (x0, z0)
function arremessar(t, u, x0, z0, f) { const dx = u.x - x0, dz = u.z - z0, d = Math.hypot(dx, dz) || 1; voar(t, u.x, u.z, dx / d * f * 0.8, f * (0.9 + Math.random() * 0.5), dz / d * f * 0.8); }
function ferirChefe(d, x, z, forte) {
  const ch = G.chefe; ch.hp -= d; ch.flash = forte ? 0.15 : 0.08; if (forte || Math.random() < 0.3) C.faiscas(x, 3, z, 0xffffff, 4, 4);
  if (forte || Math.random() < 0.25) G.txt.push({ x, y: 9, z, txt: '-' + fmt(d), cor: forte ? '#ffd84a' : '#fff', t: 0, grande: forte });
}
function usarPoder(k) {
  if (!G || G.fim || tela !== 'jogo') return; const P = G.pd[k]; if (P.cd > 0) { som('erro'); return; }
  P.cd = P.max; const ch = G.chefe;
  if (k === 'chuva') { // cai em cima dos vermelhos mais perto da muralha (ou no chefe)
    let z = ch.z + 3; for (const v of G.vm) if (v.z > z) z = v.z; z = Math.min(z - 2, ZMURO - 8);
    const c = { t: 0, z, fl: [] }; C.aviso(0, z, 7.5, 0.75, 0x4aa8ff);
    for (let i = 0; i < 26; i++) { const o = new THREE.Mesh(GEO_FLECHA, MAT_FLECHA), a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 7, y0 = 30 + Math.random() * 15;
      o.rotation.x = -Math.PI / 2; o.position.set(Math.cos(a) * r, y0, z + Math.sin(a) * r); cena.add(o); c.fl.push({ o, y0, atraso: Math.random() * 0.2 }); }
    G.chuvas.push(c); faixa('CHUVA DE FLECHAS!', '#8ac8ff'); G.heroiV.tocar('Ranged_Bow_Release', { loop: false, reinicia: true }); sfx('arco');
  } else {
    const v = C.heroi(visualPadrao('cav')); v.raiz.scale.setScalar(4.2); v.raiz.rotation.y = Math.PI; v.raiz.position.set(0, 0, ZSPAWN);
    G.gigante?.v.remover(); G.gigante = { v, z: ZSPAWN, hp: 40 + 4 * G.n, t: 0, estado: 'anda', golpe: 0 };
    C.onda(0, ZSPAWN, 8, 0x8ac8ff, 0.6); C.faiscas(0, 3, ZSPAWN, 0x8ac8ff, 40, 7); faixa('GIGANTE ALIADO!', '#8ac8ff'); sfx('magia'); C.camera.tremor = 0.5;
  }
  G.brilhoH = 1; som('confirma');
}
function acertarBloco(b, pista, lado) {
  if (b.tipo === 'barreira') {
    b.hp--; C.faiscas(b.mesh.position.x + (Math.random() - 0.5) * 6, 2.5, b.z + 0.8, 0xc89a5a, 5, 3);
    if (b.hp > 0) { redesenharBarreira(b); return; }
    som('pancada', 0.5); C.faiscas(b.mesh.position.x, 2, b.z, 0x8a5a2b, 40, 7); C.camera.tremor = 0.3;
  } else if (b.hp > 1) { // pilha resistente: encolhe a cada flechada
    b.hp--; b.mesh.scale.y = 0.45 + 0.55 * b.hp / b.hpMax; b.mesh.position.y = 1.2 * b.mesh.scale.y; C.faiscas(b.mesh.position.x + (Math.random() - 0.5) * 6, 2, b.z + 1.5, 0xffffff, 3, 2); return;
  } else if (b.tipo === 'poder') {
    if (b.p === 'flecha') { G.nFlechas = Math.min(8, G.nFlechas + 1); faixa('FLECHA EXTRA!', '#c88aff'); }
    else { G.tiro *= 1.35; faixa('TIRO RÁPIDO!', '#c88aff'); }
    G.brilhoH = 1; G.punch = 1; C.faiscas(b.mesh.position.x, 2, b.z + 1, 0xc88aff, 40, 7); C.faiscas(G.heroi.x, 3, ZH, 0xc88aff, 30, 5); sfx('magia');
  } else {
    const n = b.tipo === 'vezes' ? Math.min(250, G.az.length + G.fila) : b.valor;
    G.fila += n; G.txt.push({ x: lado * XL, y: 4, z: b.z, txt: b.tipo === 'vezes' ? `x${b.valor}!` : `+${b.valor}`, cor: b.tipo === 'vezes' ? '#7aff8a' : lado > 0 ? '#ffd84a' : '#8ac8ff', t: 0, grande: n >= 10 });
    C.faiscas(b.mesh.position.x, 2, b.z + 1, b.tipo === 'vezes' ? 0x4aff6a : lado > 0 ? 0xffd84a : 0x5aa8ff, n >= 10 ? 26 : 12, 5);
    som('moedas', n >= 10 ? 0.45 : 0.2);
    if (b.tipo === 'vezes') { faixa('EXÉRCITO DOBRADO!', '#7aff8a'); G.punch = 1; }
    else if (b.valor >= 50) { faixa(b.valor >= 99 ? 'MEGA!' : 'INCRÍVEL!', '#ffd84a'); G.punch = 0.8; }
  }
  cena.remove(b.mesh); pista.splice(pista.indexOf(b), 1);
}
function faixa(txt, cor) { G.banner = { txt, cor, t: 0 }; }
// textos flutuantes e contadores dos exércitos
function desenharFx(dt) {
  gfx.clearRect(0, 0, innerWidth, innerHeight); if (!G) return;
  const selo = (lista, cor, borda) => { if (!lista.length) return; let sx = 0, sz = 0; const n = Math.min(lista.length, 60); for (let i = 0; i < n; i++) { sx += lista[i].x; sz += lista[i].z; }
    const p = C.tela(sx / n, 5, sz / n); if (!p) return; const txt = fmt(lista.length);
    gfx.font = '22px Titulo, sans-serif'; const w = gfx.measureText(txt).width + 22;
    gfx.fillStyle = borda; gfx.beginPath(); gfx.roundRect(p[0] - w / 2 - 2, p[1] - 17, w + 4, 34, 12); gfx.fill();
    gfx.fillStyle = cor; gfx.beginPath(); gfx.roundRect(p[0] - w / 2, p[1] - 15, w, 30, 10); gfx.fill();
    gfx.fillStyle = '#fff'; gfx.textAlign = 'center'; gfx.textBaseline = 'middle'; gfx.fillText(txt, p[0], p[1] + 1); };
  if (tela === 'jogo') {
    selo(G.az, '#2f74e0', '#0f2f6a'); selo(G.vm, '#d8342a', '#5a0e0a');
    if (G.fila > 0) { const p = C.tela(0, 3, ZSPAWN); if (p) { gfx.font = '20px Titulo, sans-serif'; gfx.textAlign = 'center'; gfx.lineWidth = 4; gfx.strokeStyle = '#0f2f6a'; gfx.strokeText(`+${fmt(G.fila)}`, p[0], p[1]); gfx.fillStyle = '#8ac8ff'; gfx.fillText(`+${fmt(G.fila)}`, p[0], p[1]); } }
  }
  for (const t of G.txt) { t.t += dt; const p = C.tela(t.x, t.y + t.t * 3, t.z); if (!p) continue; gfx.globalAlpha = Math.max(0, 1 - Math.max(0, t.t - 0.5) / 0.5);
    gfx.font = `${t.grande ? 34 : 24}px Titulo, sans-serif`; gfx.textAlign = 'center'; gfx.lineWidth = 5; gfx.strokeStyle = 'rgba(0,0,0,.7)'; gfx.strokeText(t.txt, p[0], p[1]); gfx.fillStyle = t.cor; gfx.fillText(t.txt, p[0], p[1]); gfx.globalAlpha = 1; }
  G.txt = G.txt.filter(t => t.t < 1);
  const B = G.banner;
  if (B) { B.t += dt; const k = Math.min(1, B.t / 0.18), s = k < 1 ? 0.4 + 0.9 * k : 1 + 0.08 * Math.max(0, 1 - (B.t - 0.18) * 4), a = Math.max(0, 1 - Math.max(0, B.t - 1.1) / 0.4);
    gfx.save(); gfx.globalAlpha = a; gfx.translate(innerWidth / 2, innerHeight * 0.36); gfx.scale(s, s); gfx.rotate(-0.04);
    let fs = 40; gfx.font = `${fs}px Titulo, sans-serif`; while (fs > 18 && gfx.measureText(B.txt).width > innerWidth - 40) gfx.font = `${fs -= 2}px Titulo, sans-serif`;
    gfx.textAlign = 'center'; gfx.textBaseline = 'middle'; gfx.lineWidth = 9; gfx.lineJoin = 'round'; gfx.strokeStyle = 'rgba(30,10,0,.85)'; gfx.strokeText(B.txt, 0, 0); gfx.fillStyle = B.cor; gfx.fillText(B.txt, 0, 0);
    gfx.restore(); if (B.t > 1.5) G.banner = null; }
}
