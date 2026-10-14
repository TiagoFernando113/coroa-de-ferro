// Modo Castelo: o herói e os pets defendem a muralha contra ondas de inimigos.
// Sem melhorias durante a partida: a força vem das melhorias, cartas, pets e estrelas que o jogador já tem.
import * as THREE from 'three';
import * as C from './cena.js';
import { S, salvar, fimDeSemana } from './meta.js';
import { tiros, fmt, CHEFES } from './dados.js';
import { PETS, atributos, modeloDe, tinta, base, est, bonusEquipe, GOLPES, golpe, cdGolpe, forcaGolpe } from './pets.js';
import { heroiAtual } from './herois.js';
import { desenharTropas, voar, passoVoo, limparTropas } from './tropas.js';
import { sfx, intensidade } from './musica.js';
import { ico, som, $ } from './util.js';
import { t as tr } from './i18n.js';
import { evento } from './missoes.js';
import * as ON from './online.js';

const Z_MURO = -4.5, Z_DEF = -1.5, Z_INICIO = -82, SLOTS = [-14, -8.4, -2.8, 2.8, 8.4, 14];
const MAGIAS = {
  meteoro: { nome: 'Meteoro', icone: 'h_meteoro', custo: 40 },
  gelo: { nome: 'Congelar', icone: 'h_gelo', custo: 30 },
  cura: { nome: 'Curar muralha', icone: 'coracao', custo: 50 },
};
let K = null, el = null, aoSair = null;
const cn = () => C.obterCena();
const GEO_TIRO = new THREE.SphereGeometry(0.4, 8, 6), matTiro = {}, mat = c => matTiro[c] ||= new THREE.MeshBasicMaterial({ color: c });
const GEO_MET = new THREE.IcosahedronGeometry(2.6, 1), MAT_MET = new THREE.MeshBasicMaterial({ color: 0xff6a1a });

// ---- defensores (herói escolhido + até 5 pets da equipe) ----
function criarDefensores() {
  const H = heroiAtual(S), up = S.up, B = bonusEquipe(), L = [];
  const hv = C.heroi(H.visual); hv.raiz.scale.setScalar(2.4); hv.raiz.rotation.y = Math.PI; hv.tocar(hv.tem(H.pose) ? H.pose : 'Idle_A');
  // herói: tiros por segundo das melhorias x cadência do herói; flechas por tiro viram dano
  L.push({ heroi: true, v: hv, x: SLOTS[2], z: Z_DEF, cd: 0.5, cad: 1 / (tiros(up.fogo) * H.ataque.cad * 0.6 * (1 + (B.tiro || 0) / 100)), dano: 3 * H.ataque.dano * (1 + up.flechas * 0.35),
    area: H.ataque.area, perf: H.ataque.perf, alc: 75, cor: H.ataque.cor, anim: H.tiro });
  const xs = SLOTS.filter((_, i) => i !== 2);
  S.equipe.slice(0, 5).forEach((k, i) => {
    const m = modeloDe(k), v = C.personagem(m, [], 1); if (tinta(k) != null) C.tingirOuro(v.corpo, false, tinta(k));
    v.raiz.scale.setScalar(4.6 * (1 + 0.08 * est(k)) / (C.alturaModelo(m) * C.ESC_PERS)); v.raiz.rotation.y = Math.PI; v.tocar('Idle');
    const A = atributos(k), D = PETS[base(k)];
    L.push({ v, x: xs[i], z: Z_DEF, cd: Math.random(), cad: A.cad * (D.c === 'atirador' ? 0.8 : 1.1), dano: A.atk * 0.35, area: D.c === 'tanque' ? 3 : 0, perf: 0,
      alc: D.c === 'atirador' ? 80 : 45, cor: D.cor || 0xffe08a, anim: 'Attack', classe: D.c, k, gcd: golpe(k) ? cdGolpe(k) * 0.5 : null });
  });
  for (const d of L) d.v.raiz.position.set(d.x, 0, d.z);
  return L;
}
// ---- ondas ----
const hpBase = n => 4 * 1.15 ** (n - 1);
function montarOnda(n) {
  const fila = [], orcs = Math.min(45, 6 + 2 * n);
  for (let i = 0; i < orcs; i++) fila.push({ tipo: 'orc', t: i * (8 / orcs) });
  if (n >= 3) for (let i = 0; i < Math.min(5, Math.floor((n + 1) / 4)); i++) fila.push({ tipo: 'elite', t: 2 + i * 2 });
  if (n >= 6) for (let i = 0; i < Math.min(5, Math.floor((n - 3) / 3)); i++) fila.push({ tipo: 'voador', t: 1 + i * 1.5 });
  if (n >= 5) for (let i = 0; i < Math.min(4, Math.floor((n - 1) / 4)); i++) fila.push({ tipo: 'sabotador', t: 3 + i * 1.7 });
  if (n >= 7) for (let i = 0; i < Math.min(4, Math.floor((n - 3) / 4)); i++) fila.push({ tipo: 'escudeiro', t: 0.5 + i * 2.2 });
  if (n >= 9) for (let i = 0; i < Math.min(3, Math.floor((n - 5) / 4)); i++) fila.push({ tipo: 'xama', t: 2.5 + i * 2.5 });
  if (n % 5 === 0 && n % 10) fila.push({ tipo: 'gigante', t: 4 });
  if (n % 10 === 0) fila.push({ tipo: 'chefe', t: 3 });
  return fila.sort((a, b) => a.t - b.t);
}
const TIPOS = {
  orc: { hp: 1, vel: 4.6, golpe: 1 },
  elite: { hp: 7, vel: 3.2, golpe: 4, m: 'mb:Orc', h: 3.4 },
  voador: { hp: 3, vel: 6, golpe: 2, m: 'mv:Armabee', h: 3, voa: true },
  // novos: o escudeiro bloqueia os primeiros golpes, o xamã cura quem está perto, o sabotador explode na muralha
  escudeiro: { hp: 4, vel: 3, golpe: 3, m: 'mb:Cactoro', h: 3.4, escudo: 5, nome: 'Escudeiro', desc: 'bloqueia os 5 primeiros golpes' },
  xama: { hp: 5, vel: 2.6, golpe: 2, m: 'mv:Hywirl', h: 3.4, voa: true, nome: 'Xamã', desc: 'cura os inimigos perto dele' },
  sabotador: { hp: 2, vel: 7, golpe: 0, m: 'mb:GreenSpikyBlob', h: 2.6, explode: 0.12, nome: 'Sabotador', desc: 'explode na muralha!' },
  gigante: { hp: 40, vel: 1.8, golpe: 6, m: 'mg:Yeti', h: 8 },
  chefe: { hp: 45, vel: 1.5, golpe: 10, h: 12 },
};
function criarInimigo(tipo, n) {
  const T = TIPOS[tipo], hp = Math.round(hpBase(n) * T.hp), x = (Math.random() * 2 - 1) * 13;
  const u = { tipo, x, z: Z_INICIO - Math.random() * 6, hp, max: hp, vel: T.vel * (0.9 + Math.random() * 0.2), golpe: T.golpe * (1 + n * 0.08), ph: Math.random() * 6, ax: x, raio: tipo === 'orc' ? 0.8 : T.h * 0.35, alt: T.h || 2, escudo: T.escudo || 0, curaT: 2 };
  if (T.m || tipo === 'chefe') { const m = T.m || CHEFES[Math.floor(n / 10 - 1) % CHEFES.length][0], v = C.personagem(m, [], 1);
    v.raiz.scale.setScalar(T.h / (C.alturaModelo(m) * C.ESC_PERS)); v.tocar('Gallop'); u.v = v; u.y = T.voa ? 3 : 0; }
  return u;
}
// ---- partida ----
export function abrir(container, sair) {
  el = container; aoSair = sair; el.hidden = false;
  const B = bonusEquipe(), muro = Math.round(100 * (1 + 0.15 * S.up.vida) * (1 + (B.muralha || 0) / 100));
  K = { onda: 0, estado: 'pausa', pausaT: 2, fila: [], t: 0, inim: [], tiros: [], mets: [], def: criarDefensores(), muro, muroMax: muro, mana: 60, gelo: 0, vel: 1, mortos: 0, txt: [], banner: null,
    lento: 1 - Math.min(0.5, (B.lento || 0) / 100) * 0.5, multChefe: 1 + (B.chefe || 0) / 100, crit: Math.min(0.6, (B.critico || 0) / 100), cartas: 1 + 0.15 * ((S.pd.chuva?.nv || 1) - 1) };
  desenhar(); intensidade(1);
  if (!S.dicas?.castelo) { K.pausaT = 1e9; const j = $('#ctJanela'); j.hidden = false;
    j.innerHTML = `<div class="cqFim dica"><h2>${ico('h_muralha')} Castelo</h2>
      <p>Seu herói e seus pets defendem a muralha sozinhos.</p><p>${ico('h_meteoro')} Use as 3 magias gastando mana (barra azul).</p>
      <p>${ico('chefe')} A cada 10 ondas vem um chefe.</p><p>${ico('raio')} Não dá para melhorar durante a partida: fique forte fora dela!</p>
      <button class="btn verde grande" data-ct="dicaOk">Entendi!</button></div>`; }
}
export function fechar() {
  if (K) { for (const d of K.def) d.v.remover(); for (const u of K.inim) u.v?.remover(); for (const s of K.tiros) cn().remove(s.o); for (const m of K.mets) cn().remove(m.o); }
  K = null; limparTropas(); if (el) { el.hidden = true; el.innerHTML = ''; }
}
export const ativo = () => !!K;
function desenhar() {
  if (!el || !K) return;
  el.innerHTML = `<div class="ctTopo"><button class="lSair" data-ct="sair">${ico('fechar')}</button><b id="ctOnda">Onda ${Math.max(1, K.onda)}</b><small>Recorde ${S.castelo?.rec || 0}</small>
      <button class="cqVel" data-ct="vel">x${K.vel}</button></div>
    <div class="ctMuro">${ico('escudo')}<div class="barra muro"><i id="ctMuroB"></i><span id="ctMuroT"></span></div></div>
    <div class="ctMagias">${Object.entries(MAGIAS).map(([k, M]) => `<button class="ctMagia" data-magia="${k}">${ico(M.icone)}<small>${M.nome}</small><em>${M.custo}</em></button>`).join('')}
      <div class="ctMana"><i id="ctManaB"></i><span id="ctManaT"></span></div></div>
    <div class="cqJanela" id="ctJanela" hidden></div>`;
  atualizarHud();
}
function atualizarHud() {
  const b = $('#ctMuroB'); if (!b) return;
  b.style.width = 100 * Math.max(0, K.muro) / K.muroMax + '%'; $('#ctMuroT').textContent = `${fmt(Math.max(0, K.muro))} / ${fmt(K.muroMax)}`;
  $('#ctManaB').style.width = K.mana + '%'; $('#ctManaT').textContent = Math.floor(K.mana);
  for (const [k, M] of Object.entries(MAGIAS)) document.querySelector(`[data-magia=${k}]`)?.classList.toggle('pode', K.mana >= M.custo);
}
function usarMagia(k) {
  const M = MAGIAS[k]; if (!K || K.estado === 'fim' || K.mana < M.custo) { som('erro'); return; }
  K.mana -= M.custo; sfx('magia');
  if (k === 'cura') { K.muro = Math.min(K.muroMax, K.muro + K.muroMax * 0.3); C.faiscas(0, 3, Z_MURO, 0x6aff8a, 40, 6); K.banner = { txt: 'MURALHA CURADA!', cor: '#6aff8a', t: 0 }; }
  if (k === 'gelo') { K.gelo = 3 + 0.3 * ((S.pd.gigante?.nv || 1) - 1); C.onda(0, -40, 60, 0x9ae8ff, 0.8); K.banner = { txt: 'CONGELADOS!', cor: '#9ae8ff', t: 0 }; }
  if (k === 'meteoro') { const alvo = K.inim.reduce((m, u) => (!m || u.z > m.z ? u : m), null), x = alvo ? alvo.x : 0, z = alvo ? alvo.z - 3 : -40;
    const o = new THREE.Mesh(GEO_MET, MAT_MET); o.position.set(x + 15, 60, z - 25); cn().add(o); K.mets.push({ o, x, z, t: 0 }); C.aviso(x, z, 9, 1.1, 0xff6a1a); }
  atualizarHud();
}
function ferir(u, d, forte) {
  if (u.morto) return; if (u.escudo > 0) { u.escudo--; u.flash = 0.12; K.txt.push({ x: u.x, y: u.alt + 1, z: u.z, txt: u.escudo ? 'BLOQUEOU' : 'ESCUDO QUEBROU!', cor: '#8ac8ff', t: 0 }); return; }
  if (u.tipo === 'chefe') d *= K.multChefe; if (K.crit && Math.random() < K.crit) { d *= 3; forte = true; }
  u.hp -= d; u.flash = 0.12; if (u.v || forte) K.txt.push({ x: u.x, y: (u.alt || 2) + 1 + (u.y || 0), z: u.z, txt: fmt(d), cor: forte ? '#ffd84a' : '#fff', t: 0 });
  if (u.hp <= 0) { u.morto = true; K.mortos++;
    if (u.v) { u.v.tocar('Death', { loop: false }); u.tm = 0; C.faiscas(u.x, 2, u.z, 0xff6a4a, u.tipo === 'chefe' ? 80 : 20, 8); if (u.tipo === 'chefe') { sfx('vitoria'); C.camera.tremor = 1; K.banner = { txt: 'CHEFE DERROTADO!', cor: '#ffd84a', t: 0 }; } }
    else voar('vm', u.x, u.z, (Math.random() - 0.5) * 4, 6 + Math.random() * 3, -4); }
}
function alvoDe(d) { let m = null, md = 1e9; for (const u of K.inim) { if (u.morto) continue; const dz = Z_DEF - u.z; if (dz > d.alc) continue; const dist = Math.hypot(u.x - d.x, dz) - (u.tipo === 'chefe' ? 30 : u.tipo === 'gigante' ? 12 : 0); if (dist < md) { md = dist; m = u; } } return m; }
export function passo(dt0) {
  if (!K) return; const dt = dt0 * (K.estado === 'fim' ? 1 : K.vel), tt = C.tempo();
  for (const d of K.def) d.v.mixer.update(dt);
  for (const u of K.inim) if (u.v) { u.v.mixer.update(dt); u.flash = Math.max(0, (u.flash || 0) - dt); u.v.brilho(u.flash > 0 ? 0.5 : 0); if (u.morto) { u.tm += dt; if (u.tm > 1.2) u.v.raiz.visible = false; } }
  if (K.estado !== 'fim') luta(dt);
  // desenha orcs (instâncias) e posiciona os modelos
  desenharTropas('vm', K.inim.filter(u => !u.v && !u.morto), 0, tt); passoVoo(dt);
  for (const u of K.inim) if (u.v && !u.morto) u.v.raiz.position.set(u.x, u.y || 0, u.z);
  K.inim = K.inim.filter(u => !u.morto || (u.v && u.tm < 1.3) || (!u.v && false));
  for (const u of K.inim) if (u.morto && u.v && u.tm >= 1.3) u.v.remover();
  if (Math.random() < 0.2) atualizarHud();
}
function luta(dt) {
  if (K.estado === 'pausa') { if ((K.pausaT -= dt) <= 0) { K.onda++; K.fila = montarOnda(K.onda); K.t = 0; K.estado = 'onda'; const e = $('#ctOnda'); if (e) e.textContent = `Onda ${K.onda}`;
    K.banner = { txt: K.onda % 10 === 0 ? `ONDA ${K.onda}: CHEFE!` : `ONDA ${K.onda}`, cor: K.onda % 10 === 0 ? '#ff5a4a' : '#ffd84a', t: 0 }; if (K.onda % 10 === 0) intensidade(2); som('espada'); } return; }
  K.t += dt; K.mana = Math.min(100, K.mana + dt * 5); K.gelo = Math.max(0, K.gelo - dt);
  while (K.fila.length && K.fila[0].t <= K.t) { const tp = K.fila.shift().tipo, T = TIPOS[tp]; K.inim.push(criarInimigo(tp, K.onda));
    if (T.nome && !(S.castelo ||= { rec: 0 }).vistos?.includes(tp)) { (S.castelo.vistos ||= []).push(tp); salvar(); K.banner = { txt: `NOVO: ${T.nome.toUpperCase()}`, sub: T.desc, cor: '#ff9a3a', t: 0 }; } }
  // inimigos andam até a muralha e batem nela
  for (const u of K.inim) { if (u.morto) continue;
    if (u.lentoT > 0) u.lentoT -= dt;
    if (u.tipo === 'xama' && (u.curaT -= dt) <= 0) { u.curaT = 3; C.onda(u.x, u.z, 10, 0x6aff8a, 0.5);
      for (const o of K.inim) if (!o.morto && o !== u && Math.hypot(o.x - u.x, o.z - u.z) < 10) { o.hp = Math.min(o.max, o.hp + o.max * 0.2); if (o.v) K.txt.push({ x: o.x, y: o.alt + 1 + (o.y || 0), z: o.z, txt: '+', cor: '#6aff8a', t: 0 }); } }
    const zMax = Z_MURO - 1.2 - u.raio, vel = K.gelo > 0 ? 0 : u.vel * K.lento * (u.lentoT > 0 ? 0.5 : 1);
    if (u.tipo === 'sabotador' && u.z >= zMax - 0.1) { u.morto = true; u.v.tocar('Death', { loop: false }); u.tm = 0; K.muro -= K.muroMax * TIPOS.sabotador.explode;
      C.faiscas(u.x, 2, u.z, 0x9aff3a, 50, 10); C.onda(u.x, u.z, 6, 0x9aff3a, 0.4); C.camera.tremor = 0.6; som('pancada'); continue; }
    if (u.z < zMax) { u.z = Math.min(zMax, u.z + vel * dt); u.x += (u.ax - u.x) * Math.min(1, dt); if (u.v && u.na) { u.na = false; u.v.tocar('Gallop'); } }
    else { K.muro -= u.golpe * dt * (K.gelo > 0 ? 0 : 1); if (u.v && !u.na) { u.na = true; u.v.tocar('Attack'); } u.luta = true; } }
  // golpes especiais dos pets
  for (const d of K.def) if (d.gcd != null && (d.gcd -= dt) <= 0 && golpeCastelo(d)) d.gcd = cdGolpe(d.k);
  // defensores atiram
  for (const d of K.def) { if ((d.cd -= dt) > 0) continue; const a = alvoDe(d); if (!a) continue; d.cd = d.cad;
    const o = new THREE.Mesh(GEO_TIRO, mat(d.cor)); o.position.set(d.x, 3, d.z); cn().add(o); K.tiros.push({ o, d, a, x: d.x, y: 3, z: d.z });
    if (d.v.tem(d.anim)) d.v.tocar(d.anim, { loop: false, reinicia: true, vel: 1.6 }); if (d.heroi && Math.random() < 0.4) sfx('arco'); }
  for (const s of K.tiros) { const a = s.a, ty = (a.y || 0) + (a.alt || 2) * 0.5, dx = a.x - s.x, dy = ty - s.y, dz = a.z - s.z, dist = Math.hypot(dx, dy, dz), p = 70 * dt;
    if (dist <= p || a.morto) { s.fim = true; cn().remove(s.o);
      if (!a.morto) { ferir(a, s.d.dano * K.cartas * (s.d.classe === 'lutador' && a.z > -22 ? 1.6 : 1)); if (s.d.classe === 'tanque') a.lentoT = 1.5;
        if (s.d.area) for (const u of K.inim) if (u !== a && !u.morto && Math.hypot(u.x - a.x, u.z - a.z) < s.d.area * 1.5) ferir(u, s.d.dano * 0.6);
        for (let k = 0, ult = a; k < s.d.perf; k++) { const n = K.inim.find(u => !u.morto && u !== ult && u.z < ult.z && Math.abs(u.x - ult.x) < 3); if (!n) break; ferir(n, s.d.dano * 0.7); ult = n; }
        if (s.d.area) C.faiscas(a.x, 1.5, a.z, s.d.cor, 6, 3); }
      continue; }
    s.x += dx / dist * p; s.y += dy / dist * p; s.z += dz / dist * p; s.o.position.set(s.x, s.y, s.z); }
  K.tiros = K.tiros.filter(s => !s.fim);
  // meteoros
  for (const m of K.mets) { m.t += dt; const k = Math.min(1, m.t / 1.1); m.o.position.set(m.x + 15 * (1 - k), 60 * (1 - k) + 1, m.z - 25 * (1 - k)); m.o.rotation.x += dt * 5;
    if (k >= 1) { m.fim = true; cn().remove(m.o); C.faiscas(m.x, 1, m.z, 0xff6a1a, 60, 12); C.camera.tremor = 0.7; som('pancada');
      for (const u of K.inim) if (!u.morto && Math.hypot(u.x - m.x, u.z - m.z) < 9) ferir(u, u.v ? u.max * 0.25 * K.cartas : u.max + 1, true); } }
  K.mets = K.mets.filter(m => !m.fim);
  // fim da onda / derrota
  if (!K.fila.length && !K.inim.some(u => !u.morto)) { K.estado = 'pausa'; K.pausaT = 2; K.mana = Math.min(100, K.mana + 15); sfx('brilho'); if (K.onda % 10 === 0) intensidade(1); }
  if (K.muro <= 0) acabar();
}
function golpeCastelo(d) {
  const id = base(d.k), F = forcaGolpe(d.k), vivos = K.inim.filter(u => !u.morto);
  if (id !== 'totem' && !vivos.length) return false;
  const perto = vivos.sort((a, b) => b.z - a.z);
  if (id === 'dragao') { const z0 = perto[0].z; for (const u of vivos) if (u.z > z0 - 12) { ferir(u, u.max * (u.tipo === 'chefe' ? 0.04 : u.tipo === 'gigante' ? 0.12 : 0.35) * F, true); C.faiscas(u.x, 1.5, u.z, 0xff6a1a, 4, 3); } }
  if (id === 'ninja') for (const u of vivos.sort(() => Math.random() - 0.5).slice(0, Math.round(6 * F))) ferir(u, d.dano * 3 * F, true);
  if (id === 'fantasma') { for (const u of vivos) { u.z -= 6; u.lentoT = 2 + est(d.k); } C.onda(0, perto[0].z, 16, 0xc8d8ff, 0.6); }
  if (id === 'lula') { for (const u of vivos) u.lentoT = 3 + est(d.k); C.onda(0, -30, 40, 0x6a3ab0, 0.7); }
  if (id === 'totem') { if (K.muro >= K.muroMax) return false; K.muro = Math.min(K.muroMax, K.muro + K.muroMax * 0.08 * F); C.faiscas(0, 3, Z_MURO, 0x6aff8a, 30, 6); }
  if (id === 'merlin') { const a = vivos.reduce((m, u) => (u.hp > m.hp ? u : m)); ferir(a, a.max * (a.tipo === 'chefe' ? 0.06 : 0.3) * F, true); C.onda(a.x, a.z, 4, 0xb07aff, 0.5); }
  K.txt.push({ x: d.x, y: 6, z: d.z, txt: tr(GOLPES[id].nome), cor: '#ffd84a', t: 0 }); if (d.v.tem('Attack2')) d.v.tocar('Attack2', { loop: false, reinicia: true }); sfx('magia'); return true;
}
function acabar() {
  K.estado = 'fim'; const ondas = K.onda - 1, novo = ondas > (S.castelo?.rec || 0); S.castelo ||= { rec: 0 }; if (novo) S.castelo.rec = ondas;
  const premio = Math.round((20 + 12 * ondas + 2 * K.mortos / 10) * (fimDeSemana() ? 2 : 1)); S.moedas += premio; salvar(); evento('orcs', K.mortos); evento('ondas', ondas); if (novo && S.online?.codigo) ON.ctEnviar(ondas, S.heroi || 'lyra').catch(() => {});
  sfx(novo ? 'vitoria' : 'derrota'); C.camera.tremor = 1; K.banner = { txt: 'A MURALHA CAIU!', cor: '#ff6a5a', t: 0 };
  setTimeout(() => { if (!K || !el) return; const j = $('#ctJanela'); j.hidden = false;
    j.innerHTML = `<div class="cqFim ${novo ? 'vit' : 'der'}"><h2>${novo ? 'NOVO RECORDE!' : 'A muralha caiu!'}</h2><p>Você aguentou ${ondas} onda${ondas === 1 ? '' : 's'} · ${fmt(K.mortos)} inimigos</p>
      <div class="ganho">${ico('ouro')}<b>+${fmt(premio)}</b></div><p>Fique mais forte com melhorias, cartas e pets para ir mais longe.</p>
      <button class="btn verde grande" data-ct="denovo">Jogar de novo</button><button class="btn azul" data-ct="sair">${ico('guilda')} Menu</button></div>`; }, 1500);
}
export function clique(b) {
  const a = b.dataset.ct, mg = b.dataset.magia;
  if (mg) { usarMagia(mg); return; }
  if (a === 'sair') { som('fechar'); aoSair(); }
  if (a === 'vel') { K.vel = K.vel === 1 ? 2 : 1; b.textContent = 'x' + K.vel; som('clique'); }
  if (a === 'dicaOk') { (S.dicas ||= {}).castelo = 1; salvar(); som('confirma'); $('#ctJanela').hidden = true; K.pausaT = 1; return; }
  if (a === 'denovo') { som('confirma'); const s = aoSair; fechar(); abrir(el || $('#castelo'), s); }
}
export function vista() { return { foco: { x: 0, z: -30 }, yaw: Math.PI, pitch: 0.95, dist: 100 }; }
export function desenharFx(g, dt) {
  if (!K) return;
  for (const u of K.inim) { if (u.morto || !u.v) continue; const p = C.tela(u.x, (u.y || 0) + u.alt + 0.8, u.z); if (!p) continue; const w = u.tipo === 'chefe' ? 90 : 40;
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(p[0] - w / 2 - 2, p[1] - 2, w + 4, 9); g.fillStyle = u.tipo === 'chefe' ? '#ff4a3a' : '#e8803a'; g.fillRect(p[0] - w / 2, p[1], w * u.hp / u.max, 5); }
  for (const t of K.txt) { t.t += dt; const p = C.tela(t.x, t.y + t.t * 3, t.z); if (!p) continue; g.globalAlpha = Math.max(0, 1 - t.t / 0.7);
    g.font = '16px Titulo, sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(t.txt, p[0], p[1]); g.fillStyle = t.cor; g.fillText(t.txt, p[0], p[1]); g.globalAlpha = 1; }
  K.txt = K.txt.filter(t => t.t < 0.7);
  const B = K.banner;
  if (B) { B.t += dt; const k = Math.min(1, B.t / 0.18), s = k < 1 ? 0.4 + 0.9 * k : 1, a = Math.max(0, 1 - Math.max(0, B.t - (B.sub ? 2 : 1.1)) / 0.4);
    g.save(); g.globalAlpha = a; g.translate(innerWidth / 2, innerHeight * 0.34); g.scale(s, s); g.font = '42px Titulo, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 9; g.lineJoin = 'round'; g.strokeStyle = 'rgba(30,10,0,.85)'; const tx = tr(B.txt); g.strokeText(tx, 0, 0); g.fillStyle = B.cor; g.fillText(tx, 0, 0);
    if (B.sub) { g.font = '20px Titulo, sans-serif'; g.lineWidth = 6; const st = tr(B.sub); g.strokeText(st, 0, 38); g.fillStyle = '#fff'; g.fillText(st, 0, 38); } g.restore(); if (B.t > (B.sub ? 2.4 : 1.5)) K.banner = null; }
}
window.__ct = { K: () => K, passo, usarMagia }; // testes
