// Simulação da defesa: ondas de esqueletos, muralha, defesas com 8 níveis, soldados,
// mina de ouro (tycoon), forja e o herói que luta junto.
import * as C from './cena.js';
import { CLASSES, INIMIGOS, statsBase, statsInimigo, xpProx, onda, bonusOnda, DEFESAS, statsDefesa, custoDefesa, estagio, MAXNV, MURALHA, MINA, FORJA } from './dados.js';
import { criarMundo, colidir, MURO, NASCER, ESTRADAS, SLOTS, PADS, MINA as POS_MINA } from './mundo.js';

const SAVE = 'coroa_td_v1';
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angPara = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const difAng = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export const G = { M: null, jog: null, inim: [], sold: [], def: {}, vazios: {}, proj: [], areas: [], fila: [], txt: [], t: 0, onda: null, muro: null, mina: null, pads: {}, padAtual: null, ouro: 0 };
export const entrada = { mx: 0, mz: 0, atacar: false, hab: [false, false, false], esquivar: false };
const evento = (tipo, dados = {}) => G.fila.push({ tipo, ...dados });
export const texto = (x, y, z, s, cor = '#fff', grande = false) => G.txt.push({ x, y, z, s, cor, grande, t: 0 });

// ---------------- save ----------------
export function temSave() { try { return !!JSON.parse(localStorage.getItem(SAVE)); } catch (e) { return false; } }
export function salvar() {
  const j = G.jog; if (!j) return;
  const def = {}; for (const [k, d] of Object.entries(G.def)) def[k] = { tipo: d.tipo, nivel: d.nivel };
  const s = { v: 1, cls: j.cls, nivel: j.nivel, xp: j.xp, ouro: Math.floor(G.ouro), forja: j.forja, onda: G.onda.n, recorde: G.onda.recorde, def, muro: G.muro.nivel, mina: G.mina.nivel, cofre: G.mina.cofre, abates: j.abates };
  try { localStorage.setItem(SAVE, JSON.stringify(s)); } catch (e) {}
}
export function apagarSave() { try { localStorage.removeItem(SAVE); } catch (e) {} }

// ---------------- início ----------------
export function iniciar(cls) {
  G.M = criarMundo(); C.montarMundo(G.M);
  let s = null; try { s = JSON.parse(localStorage.getItem(SAVE)); } catch (e) {}
  if (cls) s = null;
  G.ouro = s ? s.ouro : 150;
  const j = G.jog = {
    cls: s?.cls || cls, nivel: s?.nivel || 1, xp: s?.xp || 0, forja: s?.forja || { arma: 0, armadura: 0 }, abates: s?.abates || 0,
    x: NASCER.x, z: NASCER.z, ang: Math.PI, estado: 'livre', t: 0, dur: 0, combo: 0, comboT: 0, cds: {}, buffs: [], iframes: 0, semDano: 10,
  };
  const st = stats(); j.hp = st.vida; j.mp = st.mana;
  j.vis = C.personagem(CLASSES[j.cls].modelo); j.vis.tocar('Idle');
  G.onda = { n: s?.onda || 1, recorde: s?.recorde || 0, estado: 'preparo', contagem: s ? 25 : 45, fila: [], spawnT: 0, total: 0 };
  G.muro = { nivel: s?.muro || 1, hp: 0, max: 0, vis: null };
  G.muro.max = G.muro.hp = MURALHA.vida[G.muro.nivel - 1]; visualMuro();
  G.mina = { nivel: s?.mina || 0, cofre: s?.cofre || 0 };
  for (const sl of SLOTS) { const d = s?.def?.[sl.id]; if (d) montarDefesa(sl.id, d.tipo, d.nivel, true); else visualVazio(sl.id); }
  for (const [k, p] of Object.entries(PADS)) G.pads[k] = { ...p, v: C.pad(p.x, p.z) };
  for (const sl of SLOTS) G.pads[sl.id] = { ...sl.pad, slot: sl.id, v: C.pad(sl.pad.x, sl.pad.z) };
  C.camera.yaw = Math.PI;
  if (!s) evento('boasVindas');
  salvar();
}

// ---------------- herói ----------------
export function stats() {
  const j = G.jog, b = statsBase(j.cls, j.nivel), s = { ...b };
  s.atk *= 1 + 0.12 * j.forja.arma; s.def *= 1 + 0.12 * j.forja.armadura; s.vida = Math.round(s.vida * (1 + 0.08 * j.forja.armadura));
  for (const bf of j.buffs) { if (bf.atk) s.atk *= 1 + bf.atk; if (bf.def) s.def *= 1 + bf.def; if (bf.vel) s.vel *= 1 + bf.vel; }
  return s;
}
export const habLiberada = h => G.jog.nivel >= h.nivel;
function calcDano(atk, mult, def) { return Math.max(1, Math.round(atk * mult * rnd(0.9, 1.1) * 100 / (100 + def * 6))); }
const vivo = e => e.estado !== 'morto' && e.estado !== 'surgir';

function ferir(e, v, cor, efeito = {}, grande = false) {
  if (!vivo(e)) return;
  e.hp -= v; e.flash = 0.12;
  texto(e.x, 2.2 * (e.d.esc || 1), e.z, (grande ? '💥' : '') + Math.round(v), cor, grande);
  if (efeito.atordoa && !e.d.chefe) e.atordoado = Math.max(e.atordoado, efeito.atordoa);
  if (efeito.lento) { e.lento = Math.max(e.lento, efeito.dur || 2); e.lentoF = Math.max(e.lentoF || 0, efeito.lento); }
  if (efeito.empurra && !e.d.chefe) { const a = efeito.de ? angPara(efeito.de, e) : Math.PI; e.x += Math.sin(a) * efeito.empurra; e.z += Math.cos(a) * efeito.empurra; }
  if (e.hp <= 0) matar(e);
}
function danoHeroi(e, mult, efeito = {}) {
  if (!vivo(e)) return;
  let v = calcDano(stats().atk, mult, e.st.def); const crit = Math.random() < 0.12; if (crit) v = Math.round(v * 1.7);
  C.faiscas(e.x, 1.1, e.z, crit ? 0xffd84a : 0xffffff, crit ? 12 : 6, 3);
  ferir(e, v, crit ? '#ffd84a' : '#ffffff', { ...efeito, de: G.jog }, crit);
}
function danoJogador(v0) {
  const j = G.jog; if (j.estado === 'morto') return;
  if (j.iframes > 0) { texto(j.x, 2.3, j.z, 'esquivou!', '#9fe3ff'); return; }
  const v = calcDano(v0, 1, stats().def); j.hp -= v; j.semDano = 0; j.flash = 0.15; C.camera.tremor = Math.max(C.camera.tremor, 0.12);
  texto(j.x, 2.3, j.z, '-' + v, '#ff5a4a');
  if (j.hp <= 0) { j.hp = 0; j.estado = 'morto'; j.t = 0; j.vis.tocar('Death_A', { loop: false, reinicia: true }); evento('toast', { txt: '💀 Você caiu! Volta em 6 segundos...' }); }
}
function alvoMaisProximo(raio, frente = 0.5) {
  const j = G.jog; let best = null, bs = 1e9;
  for (const e of G.inim) { if (!vivo(e)) continue; const d = dist(j, e); if (d > raio) continue; const score = d + Math.abs(difAng(j.ang, angPara(j, e))) * frente * 4; if (score < bs) { bs = score; best = e; } }
  return best;
}
function usarBasico() {
  const j = G.jog, b = CLASSES[j.cls].basico, s = stats();
  const alvo = alvoMaisProximo(b.tipo === 'melee' ? b.alcance + 3 : b.alcance, 0.6);
  if (alvo) j.ang = angPara(j, alvo);
  if (G.t - j.comboT > 1.1) j.combo = 0;
  const anim = b.anims[j.combo % b.anims.length]; j.combo++; j.comboT = G.t;
  const vel = s.vel / CLASSES[j.cls].vel;
  j.estado = 'atk'; j.t = 0; j.dur = b.dur / vel; j.acertou = false; j.alvo = alvo; j.hab = null;
  j.vis.tocar(anim, { loop: false, reinicia: true, fade: 0.08, vel: vel * 1.15 });
}
function impactoBasico() {
  const j = G.jog, b = CLASSES[j.cls].basico;
  if (b.tipo === 'melee') {
    C.arco(j.x, j.z, j.ang, b.alcance, b.arco, 0xfff2c0);
    for (const e of G.inim) { if (!vivo(e)) continue; if (dist(j, e) < b.alcance + 0.6 * (e.d.esc || 1) && Math.abs(difAng(j.ang, angPara(j, e))) < b.arco / 2 * Math.PI / 180 + 0.2) danoHeroi(e, 1, { empurra: 0.4 }); }
  } else {
    const alvo = j.alvo && vivo(j.alvo) ? j.alvo : null;
    atirar(j, alvo ? angPara(j, alvo) : j.ang, b.proj, b.vel, { dono: 'jog', mult: 1, alcance: b.alcance + 4 });
  }
}
function atirar(de, ang, tipo, vel, o = {}) {
  const obj = C.projetil(tipo), y = o.y ?? 1.2 * (de.d?.esc || 1);
  const p = { x: de.x + Math.sin(ang) * 0.8, z: de.z + Math.cos(ang) * 0.8, y, vx: Math.sin(ang) * vel, vz: Math.cos(ang) * vel, tipo, obj, andou: 0, maxDist: o.alcance || 20, acertados: new Set(), ...o };
  obj.position.set(p.x, y, p.z); obj.rotation.y = ang; G.proj.push(p); return p;
}
function usarHab(i) {
  const j = G.jog, h = CLASSES[j.cls].hab[i];
  if (!h || !habLiberada(h) || (j.cds[h.id] || 0) > 0) return;
  if (j.mp < h.mana) { evento('toast', { txt: 'Mana insuficiente 💧' }); return; }
  j.mp -= h.mana; j.cds[h.id] = h.cd;
  const alvo = alvoMaisProximo(h.tipo === 'salto' ? h.dist : h.tipo === 'investida' ? h.dist + 3 : 18, 0.6);
  if (alvo && h.tipo !== 'buff') j.ang = angPara(j, alvo);
  j.estado = 'hab'; j.t = 0; j.dur = h.dur; j.hab = h; j.alvo = alvo; j.tick = 0; j.atingidos = new Set(); j.saltoDe = { x: j.x, z: j.z };
  if (h.tipo === 'salto') { const d = alvo ? Math.min(h.dist, dist(j, alvo)) : h.dist * 0.6; j.saltoPara = { x: j.x + Math.sin(j.ang) * d, z: j.z + Math.cos(j.ang) * d }; C.aviso(j.saltoPara.x, j.saltoPara.z, h.raio, h.impacto, 0x3aaaff); }
  if (h.tipo === 'chuva') j.chuvaEm = alvo ? { x: alvo.x, z: alvo.z } : { x: j.x + Math.sin(j.ang) * 8, z: j.z + Math.cos(j.ang) * 8 };
  j.vis.tocar(h.anim, { loop: h.tipo === 'giro', reinicia: true, fade: 0.08, vel: h.tipo === 'giro' ? 1.2 : 1 });
}
function atualizarHab(dt) {
  const j = G.jog, h = j.hab, antes = j.t - dt, passou = tt => antes < tt && j.t >= tt;
  if (h.tipo === 'investida') {
    const v = h.dist / h.dur; j.x += Math.sin(j.ang) * v * dt; j.z += Math.cos(j.ang) * v * dt; j.iframes = 0.1;
    for (const e of G.inim) if (vivo(e) && !j.atingidos.has(e) && dist(j, e) < 1.6 * (e.d.esc || 1)) { j.atingidos.add(e); danoHeroi(e, h.mult, { atordoa: h.atordoa, empurra: 2 }); }
  }
  if (h.tipo === 'area' && passou(h.impacto)) {
    C.onda(j.x, j.z, h.raio, h.cor || 0xfff2c0, 0.45); C.camera.tremor = 0.15;
    for (const e of G.inim) if (vivo(e) && dist(j, e) < h.raio + 0.5) danoHeroi(e, h.mult, { lento: h.lento ? 0.5 : 0, dur: h.lento, empurra: 1.2 });
    if (h.cor) C.faiscas(j.x, 0.5, j.z, h.cor, 30, 5);
  }
  if (h.tipo === 'giro') {
    j.tick -= dt; if (entrada.mx || entrada.mz) { const v = stats().vel * 0.55; j.x += entrada.mx * v * dt; j.z += entrada.mz * v * dt; }
    if (j.tick <= 0) { j.tick = h.tick; C.onda(j.x, j.z, h.raio, 0xffe0a0, 0.3); for (const e of G.inim) if (vivo(e) && dist(j, e) < h.raio + 0.4) danoHeroi(e, h.mult); }
  }
  if (h.tipo === 'salto') {
    const k = Math.min(1, j.t / h.impacto); j.x = j.saltoDe.x + (j.saltoPara.x - j.saltoDe.x) * k; j.z = j.saltoDe.z + (j.saltoPara.z - j.saltoDe.z) * k;
    j.vis.raiz.position.y = Math.sin(k * Math.PI) * 2.5; j.iframes = 0.1;
    if (passou(h.impacto)) { C.onda(j.x, j.z, h.raio, 0xffcf7a, 0.5); C.camera.tremor = 0.35; C.faiscas(j.x, 0.3, j.z, 0xc9a36a, 30, 5); for (const e of G.inim) if (vivo(e) && dist(j, e) < h.raio + 0.5) danoHeroi(e, h.mult, { atordoa: 0.8 }); }
  }
  if (h.tipo === 'buff' && passou(0.15)) {
    j.buffs = j.buffs.filter(b => b.id !== h.id); j.buffs.push({ id: h.id, ...h.buff, t: h.buff.dur });
    if (h.cura) { const c = Math.round(stats().vida * h.cura); j.hp = Math.min(stats().vida, j.hp + c); texto(j.x, 2.4, j.z, '+' + c, '#7dff7a'); }
    if (h.recuo) j.recuoT = 0.3;
    C.faiscas(j.x, 1, j.z, h.id === 'furia' ? 0xff5a2a : 0x9fe3ff, 20, 3); texto(j.x, 2.8, j.z, h.nome + '!', '#ffe08a');
  }
  if (h.recuo && j.recuoT > 0) { j.recuoT -= dt; j.x -= Math.sin(j.ang) * h.recuo / 0.3 * dt; j.z -= Math.cos(j.ang) * h.recuo / 0.3 * dt; j.iframes = 0.1; }
  if (h.tipo === 'projetil' && passou(h.impacto)) for (let k = 0; k < h.n; k++) { const off = h.n > 1 ? (k / (h.n - 1) - 0.5) * h.leque * Math.PI / 180 : 0; atirar(j, j.ang + off, h.proj, h.vel, { dono: 'jog', mult: h.mult, alcance: 22, explode: h.explode }); }
  if (h.tipo === 'chuva' && passou(0.25)) { const p = j.chuvaEm; C.aviso(p.x, p.z, h.raio, h.atraso, h.cor || 0x3aaaff); G.areas.push({ x: p.x, z: p.z, r: h.raio, t: 0, atraso: h.atraso, mult: h.mult, cor: h.cor, meteoro: h.id === 'meteoro' }); }
}
function atualizarJogador(dt) {
  const j = G.jog, s = stats();
  j.flash = Math.max(0, (j.flash || 0) - dt); j.iframes = Math.max(0, j.iframes - dt);
  for (const k in j.cds) j.cds[k] = Math.max(0, j.cds[k] - dt);
  j.buffs = j.buffs.filter(b => (b.t -= dt) > 0);
  if (j.estado === 'morto') { j.t += dt; if (j.t > 6) { j.x = NASCER.x; j.z = NASCER.z; j.hp = s.vida; j.mp = s.mana; j.estado = 'livre'; j.vis.tocar('Idle', { reinicia: true }); } return; }
  j.semDano += dt;
  j.mp = Math.min(s.mana, j.mp + s.mana * 0.04 * dt);
  if (j.semDano > 3) j.hp = Math.min(s.vida, j.hp + s.vida * (j.z > 1 ? 0.06 : 0.02) * dt);
  if (entrada.esquivar && (j.estado === 'livre' || j.estado === 'atk') && !(j.cds.esq > 0)) {
    j.cds.esq = 0.9; if (entrada.mx || entrada.mz) j.ang = Math.atan2(entrada.mx, entrada.mz);
    j.estado = 'esquiva'; j.t = 0; j.dur = 0.42; j.iframes = 0.45; j.vis.tocar('Dodge_Forward', { loop: false, reinicia: true, fade: 0.05, vel: 1.3 });
  }
  entrada.esquivar = false;
  for (let i = 0; i < 3; i++) if (entrada.hab[i]) { entrada.hab[i] = false; if (j.estado === 'livre' || (j.estado === 'atk' && j.t > j.dur * 0.5)) usarHab(i); }
  if (j.estado === 'livre' && entrada.atacar) usarBasico();
  if (j.estado === 'livre') {
    const m = Math.hypot(entrada.mx, entrada.mz);
    if (m > 0.05) {
      const v = s.vel * Math.min(1, m); j.x += entrada.mx / m * v * dt; j.z += entrada.mz / m * v * dt;
      j.ang += difAng(j.ang, Math.atan2(entrada.mx, entrada.mz)) * Math.min(1, dt * 14);
      j.vis.tocar(m > 0.55 ? 'Running_A' : 'Walking_A', { vel: m > 0.55 ? 1 : 1.2 });
    } else j.vis.tocar('Idle');
  } else {
    j.t += dt;
    if (j.estado === 'atk') {
      const b = CLASSES[j.cls].basico; if (!j.acertou && j.t >= b.impacto / b.dur * j.dur) { j.acertou = true; impactoBasico(); }
      if (j.alvo && vivo(j.alvo)) j.ang += difAng(j.ang, angPara(j, j.alvo)) * Math.min(1, dt * 12);
    }
    if (j.estado === 'esquiva') { const v = 12 * (1 - j.t / j.dur) + 3; j.x += Math.sin(j.ang) * v * dt; j.z += Math.cos(j.ang) * v * dt; }
    if (j.estado === 'hab') atualizarHab(dt);
    if (j.t >= j.dur) { j.estado = 'livre'; j.vis.raiz.position.y = 0; if (entrada.atacar) usarBasico(); }
  }
  colidir(G.M, j, 0.5);
}
function ganharXP(v) {
  const j = G.jog; j.xp += v;
  while (j.xp >= xpProx(j.nivel)) {
    j.xp -= xpProx(j.nivel); j.nivel++; const s = stats(); j.hp = s.vida; j.mp = s.mana;
    evento('nivel', { nivel: j.nivel, hab: CLASSES[j.cls].hab.find(h => h.nivel === j.nivel) });
    C.faiscas(j.x, 1, j.z, 0xffd84a, 40, 5); C.onda(j.x, j.z, 4, 0xffd84a, 0.6);
  }
}

// ---------------- ondas ----------------
export function comecarOnda() {
  const o = G.onda; if (o.estado === 'ativa') return;
  const lista = []; for (const [tipo, q] of onda(o.n)) for (let k = 0; k < q; k++) lista.push(tipo);
  lista.sort(() => Math.random() - 0.5);
  const chefes = lista.filter(t => INIMIGOS[t].chefe || INIMIGOS[t].elite);
  o.fila = lista.filter(t => !chefes.includes(t)).concat(chefes);
  o.total = o.fila.length; o.estado = 'ativa'; o.spawnT = 0;
  evento('onda', { n: o.n, chefe: chefes.length > 0 });
}
export const restantes = () => G.onda.fila.length + G.inim.filter(e => e.estado !== 'morto' && !e.invocado).length;
function atualizarOnda(dt) {
  const o = G.onda;
  if (o.estado === 'preparo') { o.contagem -= dt; if (o.contagem <= 0) comecarOnda(); return; }
  if (o.estado !== 'ativa') return;
  o.spawnT -= dt;
  if (o.fila.length && o.spawnT <= 0) {
    o.spawnT = Math.max(0.45, 1.35 - o.n * 0.035);
    const lanes = o.n < 3 ? [0, 1] : [0, 1, 2];
    nascerInimigo(o.fila.shift(), o.n, lanes[Math.floor(Math.random() * lanes.length)]);
  }
  if (!o.fila.length && !G.inim.some(e => e.estado !== 'morto' && !e.invocado)) {
    const b = bonusOnda(o.n); G.ouro += b; o.recorde = Math.max(o.recorde, o.n);
    evento('vitoria', { n: o.n, bonus: b });
    for (const e of G.inim) if (e.estado !== 'morto') matar(e, true);
    o.n++; o.estado = 'preparo'; o.contagem = 25; G.muro.hp = Math.min(G.muro.max, G.muro.hp + G.muro.max * 0.35); salvar();
  }
}
function derrota() {
  const o = G.onda; o.estado = 'derrota';
  for (const e of G.inim) if (e.estado !== 'morto') matar(e, true);
  for (const p of G.proj) C.remover(p.obj); G.proj = [];
  evento('derrota', { n: o.n }); C.camera.tremor = 0.6;
}
export function tentarDeNovo() { const o = G.onda; o.estado = 'preparo'; o.contagem = 30; G.muro.hp = G.muro.max; salvar(); }

// ---------------- inimigos ----------------
function nascerInimigo(tipo, nivel, lane, pos) {
  const d = INIMIGOS[tipo], st = statsInimigo(tipo, nivel), [x0, z0] = pos || ESTRADAS[lane][0];
  const e = { tipo, d, nivel, st, hp: st.vida, max: st.vida, lane, wp: 1, x: x0 + (pos ? 0 : rnd(-3, 3)), z: z0 + (pos ? 0 : rnd(-2, 2)), ang: 0, vx: 0, vz: 0,
    estado: 'surgir', t: 0, cd: rnd(0.3, 1), atordoado: 0, lento: 0, flash: 0, invocT: d.invoca || 0, especialT: 7, fases: 0 };
  e.vis = C.personagem(d.modelo, d.armas, d.esc || 1); e.vis.raiz.position.set(e.x, 0, e.z);
  if (e.vis.tem('Spawn_Ground_Skeletons')) e.vis.tocar('Spawn_Ground_Skeletons', { loop: false }); else e.estado = 'andar';
  if (d.chefe) evento('chefe', { e });
  G.inim.push(e); return e;
}
function matar(e, sumir = false) {
  e.estado = 'morto'; e.t = sumir ? 2.5 : 0; e.hp = 0;
  e.vis.tocar(e.vis.tem('Death_C_Skeletons') && !e.d.chefe ? 'Death_C_Skeletons' : 'Death_A', { loop: false, reinicia: true });
  if (sumir) return;
  C.faiscas(e.x, 1, e.z, 0xd8e0ff, 14, 3);
  const ouro = e.invocado ? 1 : e.st.ouro; G.ouro += ouro; G.jog.abates++;
  texto(e.x, 2.6 * (e.d.esc || 1), e.z, `+${ouro} 🪙`, '#ffd84a');
  ganharXP(e.st.xp * (e.invocado ? 0.3 : 1));
  if (e.d.chefe) evento('chefeMorto', {});
}
function alvosProximos(e, raio) { // herói e soldados que o inimigo pode atacar
  let best = null, bd = raio; const j = G.jog;
  if (j.estado !== 'morto') { const d = dist(e, j); if (d < bd) { bd = d; best = j; } }
  for (const s of G.sold) if (s.estado !== 'morto') { const d = dist(e, s); if (d < bd) { bd = d; best = s; } }
  return best;
}
function danoAliado(alvo, v) { if (alvo === G.jog) return danoJogador(v); alvo.hp -= calcDano(v, 1, alvo.def || 0); alvo.flash = 0.12; if (alvo.hp <= 0 && alvo.estado !== 'morto') morrerSoldado(alvo); }
export function danoMuro(v) {
  if (G.onda.estado !== 'ativa') return;
  G.muro.hp -= v; G.muro.flash = 0.15;
  if (G.muro.hp <= 0) { G.muro.hp = 0; derrota(); }
}
function atualizarInimigo(e, dt) {
  const d = e.d, vis = e.vis;
  e.flash = Math.max(0, e.flash - dt); e.atordoado = Math.max(0, e.atordoado - dt); e.lento = Math.max(0, e.lento - dt); e.t += dt;
  if (e.estado === 'morto') { if (e.t > 3) vis.raiz.position.y = -(e.t - 3) * 0.8; if (e.t > 4.3) { e.removido = true; vis.remover(); } return; }
  if (e.estado === 'surgir') { if (e.t > 1.3) e.estado = 'andar'; return; }
  if (e.atordoado > 0) { vis.tocar('Idle'); return; }
  const vel = d.vel * (e.lento > 0 ? 1 - (e.lentoF || 0.45) : 1) * (e.fases >= 2 ? 1.2 : 1);
  const ox = e.x, oz = e.z;
  const mover = (ax, az, v) => { const m = Math.hypot(ax, az) || 1; e.x += ax / m * v * dt; e.z += az / m * v * dt; e.ang += difAng(e.ang, Math.atan2(ax, az)) * Math.min(1, dt * 10); };
  e.cd -= dt;
  if (d.chefe) chefe(e, dt);
  if (e.estado === 'especial') { especialChefe(e, dt); return; }
  if (d.invoca) { e.invocT -= dt; if (e.invocT <= 0 && e.z < -6) { e.invocT = d.invoca; invocar(e, 2, Math.max(1, e.nivel - 1)); vis.tocar('Spellcast_Summon', { loop: false, reinicia: true }); e.estado = 'atacar'; e.t = 0; e.atkDur = 1.2; e.impactoFeito = true; e.alvoAtk = null; return; } }
  if (e.estado === 'atacar') {
    const a = e.alvoAtk; if (a && a !== 'muro') e.ang += difAng(e.ang, angPara(e, a)) * Math.min(1, dt * 6); else if (a === 'muro') e.ang += difAng(e.ang, 0) * Math.min(1, dt * 6);
    if (!e.impactoFeito && e.t >= d.impacto) { e.impactoFeito = true; impactoInimigo(e); }
    if (e.rajada > 0 && e.t >= d.impacto + 0.25) { e.rajada--; e.t = d.impacto; e.impactoFeito = false; }
    if (e.t >= (e.atkDur || 1)) e.estado = 'andar';
    return;
  }
  // alvo: herói/soldado por perto tem prioridade; senão segue a estrada até a muralha
  const alcance = d.alcance * (d.esc || 1) * (d.tipo === 'melee' ? 0.55 : 1) + (d.tipo === 'melee' ? 0.9 : 0);
  const alvo = alvosProximos(e, d.tipo === 'melee' ? 5 : Math.min(d.alcance, 10));
  if (alvo && alvo.z < 1.5) {
    const dj = dist(e, alvo);
    if (dj > alcance) { mover(alvo.x - e.x, alvo.z - e.z, vel); vis.tocar('Running_A', { vel: vel / 3.5 }); }
    else { e.ang += difAng(e.ang, angPara(e, alvo)) * Math.min(1, dt * 10); vis.tocar(vis.tem('Idle_Combat') ? 'Idle_Combat' : 'Idle'); if (e.cd <= 0) atacar(e, alvo); }
  } else {
    const rota = ESTRADAS[e.lane];
    if (e.wp < rota.length) {
      const [wx, wz] = rota[e.wp]; if (Math.hypot(wx - e.x, wz - e.z) < 2.5) e.wp++;
      mover(wx - e.x, wz - e.z, vel); vis.tocar('Running_A', { vel: vel / 3.5 });
      if (d.tipo !== 'melee' && e.z > -d.alcance + 1.5) e.wp = rota.length; // atiradores param antes
    } else {
      if (!e.pontoMuro) e.pontoMuro = { x: Math.max(-26, Math.min(26, e.x + rnd(-12, 12))), z: d.tipo === 'melee' ? -1.6 - 0.5 * (d.esc || 1) : Math.min(e.z, -d.alcance + 2) };
      const pm = e.pontoMuro, dm = Math.hypot(pm.x - e.x, pm.z - e.z);
      if (dm > 0.6) { mover(pm.x - e.x, pm.z - e.z, vel); vis.tocar('Running_A', { vel: vel / 3.5 }); }
      else { e.ang += difAng(e.ang, 0) * Math.min(1, dt * 8); vis.tocar(vis.tem('Idle_Combat') ? 'Idle_Combat' : 'Idle'); if (e.cd <= 0) atacar(e, 'muro'); }
    }
  }
  e.z = Math.min(e.z, -1.2 - 0.4 * (d.esc || 1)); // não atravessa a muralha
  e.vx = (e.x - ox) / Math.max(dt, 1e-3); e.vz = (e.z - oz) / Math.max(dt, 1e-3);
}
function atacar(e, alvo) {
  const d = e.d; e.estado = 'atacar'; e.t = 0; e.impactoFeito = false; e.alvoAtk = alvo;
  e.cd = d.cd * rnd(0.85, 1.2) * (e.fases >= 2 ? 0.75 : 1); e.atkDur = d.impacto + 0.55; e.rajada = d.rajada ? d.rajada - 1 : 0;
  e.vis.tocar(d.atkAnim, { loop: false, reinicia: true, fade: 0.1 });
}
function impactoInimigo(e) {
  const d = e.d, a = e.alvoAtk;
  if (a === 'muro') {
    if (d.tipo === 'melee') { danoMuro(e.st.atk); C.faiscas(e.x, 1.4, -0.9, 0xc9b79a, 5, 2); }
    else atirar(e, 0, d.tipo === 'caster' ? 'sombra' : 'virote', d.tipo === 'caster' ? 13 : 20, { dono: 'inim', dano: e.st.atk, alcance: Math.abs(e.z) + 1, alvoMuro: true });
    return;
  }
  if (!a || a.estado === 'morto') return;
  if (d.tipo === 'melee') { const alc = d.alcance * (d.esc || 1) * 0.6 + 1.3; if (dist(e, a) < alc) danoAliado(a, e.st.atk); C.arco(e.x, e.z, e.ang, alc, 100, 0xff7a6a); }
  else atirar(e, angPara(e, a), d.tipo === 'caster' ? 'sombra' : 'virote', d.tipo === 'caster' ? 13 : 20, { dono: 'inim', dano: e.st.atk, alcance: d.alcance + 6 });
}
function invocar(e, n, nivel) {
  for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, m = nascerInimigo('lacaio', nivel, e.lane, [e.x + Math.cos(a) * 3, Math.min(-3, e.z + Math.sin(a) * 3)]); m.invocado = true; m.wp = e.wp; }
}
function chefe(e, dt) {
  if (e.fases === 0 && e.hp < e.max * 0.7) { e.fases = 1; invocar(e, 3, e.nivel); evento('fala', { quem: 'Rei Esqueleto', txt: 'Levantem-se, meus soldados!' }); }
  if (e.fases === 1 && e.hp < e.max * 0.35) { e.fases = 2; invocar(e, 4, e.nivel); evento('fala', { quem: 'Rei Esqueleto', txt: 'CHEGA! Esta muralha vai CAIR!' }); C.camera.tremor = 0.4; }
  e.especialT -= dt;
  if (e.especialT <= 0 && e.estado === 'andar') {
    e.especialT = e.fases >= 2 ? 5 : 7.5; e.estado = 'especial'; e.t = 0;
    const alvo = alvosProximos(e, 12);
    const p = alvo ? { x: alvo.x, z: Math.min(-2, alvo.z) } : { x: e.x, z: Math.min(-2.5, e.z + 6) };
    e.de = { x: e.x, z: e.z }; e.para = p; C.aviso(p.x, p.z, 4.5, 1.1); e.vis.tocar('1H_Melee_Attack_Jump_Chop', { loop: false, reinicia: true, vel: 0.8 });
  }
}
function especialChefe(e, dt) {
  const antes = e.t - dt, k = Math.min(1, e.t / 1.1);
  e.x = e.de.x + (e.para.x - e.de.x) * k; e.z = e.de.z + (e.para.z - e.de.z) * k; e.vis.raiz.position.y = Math.sin(k * Math.PI) * 3.5;
  e.ang = Math.atan2(e.para.x - e.de.x, e.para.z - e.de.z) || e.ang;
  if (antes < 1.1 && e.t >= 1.1) {
    C.onda(e.x, e.z, 4.5, 0xff7a3a, 0.5); C.camera.tremor = 0.5; C.faiscas(e.x, 0.3, e.z, 0xc9a36a, 40, 6);
    const j = G.jog; if (j.estado !== 'morto' && dist(e, j) < 4.7) danoJogador(e.st.atk * 1.5);
    for (const s of G.sold) if (s.estado !== 'morto' && dist(e, s) < 4.7) danoAliado(s, e.st.atk * 1.5);
    if (e.z > -6) danoMuro(e.st.atk * 2);
  }
  if (e.t > 1.7) { e.estado = 'andar'; e.vis.raiz.position.y = 0; }
}

// ---------------- defesas ----------------
const posSlot = id => SLOTS.find(s => s.id === id);
function visualVazio(id) {
  const s = posSlot(id);
  if (G.vazios[id]) C.remover(G.vazios[id]);
  G.vazios[id] = C.grupo([{ m: 'T:planks', s: [4.4, 1, 4.4] }, { m: 'N:sign', x: 1.6, z: 1.8, s: 3 }], s.x, s.z);
}
function limparVisual(d) { C.remover(d.vis.grupo); if (d.vis.fixo) C.remover(d.vis.fixo); if (d.vis.orbe) C.remover(d.vis.orbe); for (const p of d.vis.pers) p.remover(); }
// peças de cada defesa por estágio visual (1..4)
function pecasDefesa(tipo, t) {
  const S = 2.6, L = [], pers = []; let topo = 3, gira = false, orbe = null;
  if (tipo === 'arqueiros') {
    const partes = [['C:tower-square-top'], ['C:tower-square-mid', 'C:tower-square-top'], ['C:tower-square-mid-windows', 'C:tower-square-mid', 'C:tower-square-top'], ['C:tower-square-mid', 'C:tower-square-mid-windows', 'C:tower-square-mid', 'C:tower-square-top']][t - 1];
    let y = 1.01 * S; L.push({ m: 'C:tower-square-base', s: S });
    for (const p of partes) { L.push({ m: p, y, s: S }); if (!p.includes('top')) y += 1.01 * S; }
    topo = y;
    const n = [1, 2, 2, 3][t - 1], xs = n === 1 ? [0] : n === 2 ? [-0.55, 0.55] : [-0.75, 0, 0.75];
    for (const x of xs) pers.push({ modelo: 'arq', x, y: topo, z: -0.3, esc: 0.8 });
    if (t >= 3) L.push({ m: 'C:flag', x: 1.1, y: topo, z: 1.1, s: 3 });
    if (t >= 4) L.push({ m: 'C:flag', x: -1.1, y: topo, z: 1.1, s: 3 });
  } else if (tipo === 'catapulta') {
    gira = true;
    if (t >= 2) L.push({ m: 'T:planks', y: 0.02, s: [4.6, 1, 4.6], fixo: true });
    if (t <= 2) L.push({ m: 'C:siege-catapult', s: t === 1 ? 2.6 : 3.2 }); else L.push({ m: 'C:siege-trebuchet', s: t === 3 ? 2.6 : 3.1 });
    if (t >= 4) L.push({ m: 'C:flag', x: 1.8, z: 1.8, s: 3.5, fixo: true });
    topo = 3;
  } else if (tipo === 'balista') {
    gira = true;
    const alta = t >= 3, y0 = alta ? 1.01 * 2.8 : 0;
    if (alta) L.push({ m: 'C:tower-square-base', s: 2.8, fixo: true });
    L.push({ m: 'C:siege-ballista', y: y0, s: t % 2 ? 2.6 : 3.1 });
    if (t >= 4) L.push({ m: 'C:flag', x: 1.2, y: y0, z: 1.2, s: 3, fixo: true });
    topo = y0 + 2;
  } else if (tipo === 'magia') {
    const Sh = 3; let y = 0;
    L.push({ m: 'C:tower-hexagon-base', s: Sh }); y += 1.31 * Sh;
    for (let i = 0; i < t - 1; i++) { L.push({ m: 'C:tower-hexagon-mid', y, s: Sh }); y += 0.46 * Sh; }
    L.push({ m: 'C:tower-hexagon-top', y, s: Sh }); y += 0.13 * Sh;
    topo = y; if (t >= 3) pers.push({ modelo: 'mag', x: 0, y, z: 0, esc: 0.85 });
    orbe = { y: y + (t >= 3 ? 3.2 : 0.9), r: 0.3 + t * 0.06 };
  } else if (tipo === 'quartel') {
    L.push({ m: 'N:tent_detailedOpen', s: 5 + t * 0.6, ry: Math.PI });
    if (t >= 2) L.push({ m: 'D:banner', x: 2.2, z: 1.6, s: 3 }, { m: 'D:barrel', x: -2.2, z: 1.8, s: 2 });
    if (t >= 3) L.push({ m: 'D:shield-round', x: 2.3, y: 0.2, z: -1.4, s: 3 }, { m: 'D:weapon-sword', x: -2.3, z: -1.4, s: 3 });
    if (t >= 4) L.push({ m: 'C:flag', x: 2.3, z: -0.4, s: 4 }, { m: 'C:flag', x: -2.3, z: -0.4, s: 4 });
    topo = 3;
  }
  return { L, pers, topo, gira, orbe };
}
function montarDefesa(id, tipo, nivel, silencioso) {
  const s = posSlot(id), antigo = G.def[id];
  const giroAnt = antigo?.vis?.grupo.rotation.y;
  if (antigo?.vis) limparVisual(antigo);
  if (G.vazios[id]) { C.remover(G.vazios[id]); delete G.vazios[id]; }
  const { L, pers, topo, gira, orbe } = pecasDefesa(tipo, estagio(nivel));
  const vis = { grupo: C.grupo(L.filter(p => !p.fixo), s.x, s.z), pers: [], fixo: L.some(p => p.fixo) ? C.grupo(L.filter(p => p.fixo), s.x, s.z) : null };
  if (orbe) vis.orbe = C.orbe(s.x, orbe.y, s.z, orbe.r);
  for (const p of pers) { const v = C.personagem(p.modelo, [], p.esc); v.raiz.position.set(s.x + p.x, p.y, s.z + p.z); v.raiz.rotation.y = Math.PI; v.tocar('Idle'); vis.pers.push(v); }
  if (gira) vis.grupo.rotation.y = giroAnt ?? Math.PI / 2;
  const d = { id, tipo, nivel, st: statsDefesa(tipo, nivel), cd: 0.5, x: s.x, z: s.z, topo, gira, vis, soldados: antigo?.tipo === tipo ? antigo.soldados : [] };
  G.def[id] = d;
  if (tipo === 'quartel') ajustarSoldados(d);
  if (!silencioso) { C.faiscas(s.x, 2, s.z, 0xffd84a, 30, 4); C.onda(s.x, s.z, 4, 0xffd84a, 0.5); }
}
function alvosDefesa(d, n = 1) {
  const r = d.st.alcance, min = d.st.minimo || 0, l = [];
  for (const e of G.inim) { if (!vivo(e)) continue; const dd = dist(d, e); if (dd <= r && dd >= min) l.push(e); }
  l.sort((a, b) => b.z - a.z); // o mais perto da muralha primeiro
  return l.slice(0, n);
}
function atualizarDefesa(d, dt) {
  for (const p of d.vis.pers) p.mixer.update(dt);
  if (d.vis.orbe) d.vis.orbe.rotation.y += dt * 2;
  if (d.tipo === 'quartel') return atualizarQuartel(d, dt);
  d.cd -= dt; if (d.cd > 0 || G.onda.estado !== 'ativa') return;
  const alvos = alvosDefesa(d, d.st.alvos || 1); if (!alvos.length) return;
  d.cd = d.st.cad; const a = alvos[0], st = d.st;
  // máquinas de cerco (modelos virados para -x) giram para o alvo
  if (d.gira) d.vis.grupo.rotation.y = angPara(d, a) + Math.PI / 2;
  if (d.tipo === 'arqueiros') {
    alvos.forEach((e, i) => {
      const p = d.vis.pers[i % d.vis.pers.length], o = p ? { x: p.raiz.position.x, z: p.raiz.position.z } : { x: d.x, z: d.z };
      if (p) { p.raiz.rotation.y = angPara(o, e); p.tocar('2H_Ranged_Shoot', { loop: false, reinicia: true }); p.voltaIdle = 0.6; }
      atirar(o, angPara(o, e), 'flecha', 34, { dono: 'def', dano: st.dano, alvo: e, y: d.topo + 1.2, alcance: st.alcance + 8, guiado: true });
    });
  } else if (d.tipo === 'catapulta') {
    const T = 0.6 + dist(d, a) / 18, px = a.x + a.vx * T * 0.9, pz = Math.min(-1, a.z + a.vz * T * 0.9);
    const obj = C.projetil('pedra'); obj.position.set(d.x, 3, d.z);
    G.proj.push({ tipo: 'pedra', obj, arco: true, x0: d.x, z0: d.z, x1: px, z1: pz, T, t: 0, dano: st.dano, raio: st.raio, dono: 'def', x: d.x, z: d.z, y: 3 });
    C.aviso(px, pz, st.raio, T, 0xffa040);
  } else if (d.tipo === 'balista') {
    atirar({ x: d.x, z: d.z }, angPara(d, a), 'lanca', 42, { dono: 'def', dano: st.dano, perfura: st.perfura, y: d.topo, alcance: st.alcance + 10 });
  } else if (d.tipo === 'magia') {
    atirar({ x: d.x, z: d.z }, angPara(d, a), 'magia', 26, { dono: 'def', dano: st.dano, alvo: a, guiado: true, y: d.vis.orbe ? d.vis.orbe.position.y : d.topo, lento: st.lento, corrente: st.corrente, alcance: st.alcance + 8 });
    const m = d.vis.pers[0]; if (m) { m.raiz.rotation.y = angPara(d, a); m.tocar('Spellcast_Shoot', { loop: false, reinicia: true }); m.voltaIdle = 0.7; }
  }
}
// quartel: mantém a quantidade certa de soldados; mortos voltam depois de um tempo
function ajustarSoldados(d) {
  while (d.soldados.length < d.st.soldados) d.soldados.push({ ref: null, renasce: 0.5 });
  for (const s of d.soldados) if (s.ref && s.ref.estado !== 'morto') { s.ref.max = d.st.vida; s.ref.hp = d.st.vida; s.ref.atk = d.st.atk; s.ref.dono = d; }
}
function atualizarQuartel(d, dt) {
  const k = SLOTS.findIndex(s => s.id === d.id);
  d.soldados.forEach((s, i) => {
    if (s.ref && s.ref.estado !== 'morto') return;
    s.renasce -= dt; if (s.renasce > 0) return;
    const arq = d.st.arqueiro && i % 2 === 1;
    const v = C.personagem(arq ? 'arq' : 'cav', [], 0.9);
    const ponto = { x: Math.max(-26, Math.min(26, SLOTS[k].x * 0.35 + (i - (d.soldados.length - 1) / 2) * 2.2)), z: arq ? -3.5 : -6 - (i % 2) * 1.5 };
    const sol = { x: d.x, z: d.z + 2, hp: d.st.vida, max: d.st.vida, atk: d.st.atk, def: 2, ang: Math.PI, estado: 'andar', cd: 0, t: 0, vis: v, ponto, arq, casa: s, dono: d };
    v.raiz.position.set(sol.x, 0, sol.z); s.ref = sol; s.renasce = d.st.renasce; G.sold.push(sol);
  });
}
function morrerSoldado(s) { s.estado = 'morto'; s.t = 0; s.hp = 0; s.vis.tocar('Death_A', { loop: false, reinicia: true }); s.casa.renasce = s.dono.st.renasce; }
function atualizarSoldado(s, dt) {
  s.flash = Math.max(0, (s.flash || 0) - dt);
  if (s.estado === 'morto') { s.t += dt; if (s.t > 2.5 && !s.removido) { s.removido = true; s.vis.remover(); } return; }
  if (G.def[s.dono.id] !== s.dono && G.def[s.dono.id]?.tipo !== 'quartel') { s.removido = true; s.vis.remover(); return; } // quartel vendido
  if (G.def[s.dono.id] && G.def[s.dono.id] !== s.dono) s.dono = G.def[s.dono.id];
  s.cd -= dt;
  const mover = (x, z, v) => { const dx = x - s.x, dz = z - s.z, m = Math.hypot(dx, dz) || 1; s.x += dx / m * v * dt; s.z += dz / m * v * dt; s.ang += difAng(s.ang, Math.atan2(dx, dz)) * Math.min(1, dt * 10); };
  if (s.estado === 'atacando') { s.t += dt; if (s.t > 0.6) s.estado = 'andar'; return; }
  let alvo = null, bd = s.arq ? 13 : 8;
  if (s.z < 1.5) for (const e of G.inim) { if (!vivo(e)) continue; const d = dist(s, e); if (d < bd && Math.hypot(e.x - s.ponto.x, e.z - s.ponto.z) < 14) { bd = d; alvo = e; } }
  if (alvo) {
    const alc = s.arq ? 12 : 1.6 + 0.5 * (alvo.d.esc || 1);
    if (bd > alc) { mover(alvo.x, alvo.z, 4.5); s.vis.tocar('Running_A'); }
    else if (s.cd <= 0) {
      s.cd = s.arq ? 1.3 : 1.0; s.ang = angPara(s, alvo); s.estado = 'atacando'; s.t = 0;
      if (s.arq) { s.vis.tocar('2H_Ranged_Shoot', { loop: false, reinicia: true }); atirar(s, s.ang, 'flecha', 30, { dono: 'def', dano: s.atk * 0.8, alvo, guiado: true, alcance: 18 }); }
      else { s.vis.tocar('1H_Melee_Attack_Chop', { loop: false, reinicia: true }); if (vivo(alvo)) ferir(alvo, calcDano(s.atk, 1, alvo.st.def), '#bcd8ff'); }
    } else s.vis.tocar('Idle');
  } else {
    // sai pelo portão (x≈0) antes de ir para o ponto de guarda (e volta por ele)
    const dentro = s.z > 1.5, fora = s.ponto.z < 0;
    const alvoP = dentro && fora && Math.abs(s.x) > 1.2 ? { x: 0, z: 3 } : s.ponto;
    if (Math.hypot(alvoP.x - s.x, alvoP.z - s.z) > 0.5) { mover(alvoP.x, alvoP.z, 4.5); s.vis.tocar('Running_A'); } else { s.ang += difAng(s.ang, Math.PI) * dt * 5; s.vis.tocar('Idle'); }
  }
}

// ---------------- projéteis e áreas ----------------
function atualizarProjeteis(dt) {
  const j = G.jog;
  for (let i = G.proj.length - 1; i >= 0; i--) {
    const p = G.proj[i]; if (!p) continue; let fim = false;
    if (p.arco) { // pedra da catapulta em parábola
      p.t += dt; const k = Math.min(1, p.t / p.T);
      p.x = p.x0 + (p.x1 - p.x0) * k; p.z = p.z0 + (p.z1 - p.z0) * k; p.y = 3 * (1 - k) + Math.sin(k * Math.PI) * (4 + p.T * 4);
      p.obj.position.set(p.x, p.y, p.z); p.obj.rotation.x += dt * 5;
      if (k >= 1) {
        fim = true; C.onda(p.x, p.z, p.raio, 0xffa040, 0.45); C.faiscas(p.x, 0.4, p.z, 0xa08a6a, 25, 5); C.camera.tremor = Math.max(C.camera.tremor, 0.08);
        for (const e of G.inim) if (vivo(e) && Math.hypot(e.x - p.x, e.z - p.z) < p.raio + 0.5 * (e.d.esc || 1)) ferir(e, calcDano(p.dano, 1, e.st.def), '#ffc070', { atordoa: 0.3 });
      }
      if (fim && G.proj[i] === p) { C.remover(p.obj); G.proj.splice(i, 1); } continue;
    }
    if (p.guiado && p.alvo && vivo(p.alvo)) { const a = angPara(p, p.alvo), v = Math.hypot(p.vx, p.vz); p.vx = Math.sin(a) * v; p.vz = Math.cos(a) * v; p.y += (1.2 - p.y) * Math.min(1, dt * 5); }
    p.x += p.vx * dt; p.z += p.vz * dt; p.andou += Math.hypot(p.vx, p.vz) * dt;
    p.obj.position.set(p.x, p.y, p.z); p.obj.rotation.y = Math.atan2(p.vx, p.vz);
    fim = p.andou > p.maxDist;
    if (p.dono === 'jog' || p.dono === 'def') {
      for (const e of G.inim) {
        if (!vivo(e) || p.acertados.has(e)) continue;
        if (Math.hypot(e.x - p.x, e.z - p.z) < 0.8 * (e.d.esc || 1)) {
          p.acertados.add(e);
          if (p.explode) { explodir(p); fim = true; break; }
          if (p.dono === 'jog') danoHeroi(e, p.mult);
          else ferir(e, calcDano(p.dano, 1, e.st.def), p.tipo === 'magia' ? '#d8b8ff' : '#e8f0ff', p.lento ? { lento: p.lento, dur: 2.5 } : {});
          C.faiscas(p.x, p.y, p.z, p.tipo === 'magia' ? 0xc9a0ff : 0xffffff, 6, 2);
          if (p.corrente > 1) { // raio que pula para o próximo inimigo
            const prox = G.inim.filter(o => vivo(o) && !p.acertados.has(o) && Math.hypot(o.x - p.x, o.z - p.z) < 7).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
            if (prox) { p.corrente--; p.alvo = prox; p.andou = 0; continue; }
          }
          if (p.perfura > 1) { p.perfura--; continue; }
          fim = true; break;
        }
      }
    } else {
      if (p.alvoMuro && p.z > -0.8) { danoMuro(p.dano); C.faiscas(p.x, p.y, p.z, 0xc9b79a, 5, 2); fim = true; }
      else if (j.estado !== 'morto' && Math.hypot(j.x - p.x, j.z - p.z) < 0.7) { danoJogador(p.dano); fim = true; }
      else for (const s of G.sold) if (s.estado !== 'morto' && Math.hypot(s.x - p.x, s.z - p.z) < 0.7) { danoAliado(s, p.dano); fim = true; break; }
    }
    if (fim && G.proj[i] === p) { if (p.explode && !p.explodiu && p.andou > p.maxDist) explodir(p); C.remover(p.obj); G.proj.splice(i, 1); }
  }
  for (let i = G.areas.length - 1; i >= 0; i--) {
    const a = G.areas[i]; a.t += dt;
    if (a.t >= a.atraso) {
      C.onda(a.x, a.z, a.r, a.cor || 0x7ad0ff, 0.5); C.faiscas(a.x, 0.4, a.z, a.cor || 0x7ad0ff, a.meteoro ? 50 : 25, a.meteoro ? 7 : 4); if (a.meteoro) C.camera.tremor = 0.4;
      for (const e of G.inim) if (vivo(e) && Math.hypot(e.x - a.x, e.z - a.z) < a.r + 0.5) danoHeroi(e, a.mult, { atordoa: a.meteoro ? 1 : 0 });
      G.areas.splice(i, 1);
    }
  }
}
function explodir(p) { p.explodiu = true; C.onda(p.x, p.z, p.explode, 0xff7a2a, 0.4); C.faiscas(p.x, p.y, p.z, 0xff7a2a, 30, 5); for (const e of G.inim) if (vivo(e) && Math.hypot(e.x - p.x, e.z - p.z) < p.explode + 0.5) danoHeroi(e, p.mult); }

// ---------------- muralha, mina e forja (visual e compras) ----------------
function visualMuro() {
  const m = G.muro, t = estagio(m.nivel), L = [];
  if (m.vis) C.remover(m.vis);
  for (let x = MURO.x0; x < MURO.x1; x += 3) {
    const cx = x + 1.5; if (Math.abs(cx) < MURO.vao) continue;
    if (t <= 1) L.push({ m: 'T:wall-wood', x: cx, z: 1.35, ry: Math.PI / 2, s: 3 });
    else L.push({ m: 'C:wall', x: cx, s: [3, t >= 3 ? 3.4 : 2.6, 3] });
  }
  const torres = t >= 2 ? [MURO.x0, MURO.x1, -MURO.vao - 1.6, MURO.vao + 1.6] : [];
  if (t >= 4) torres.push(-18, 18);
  const alt = t >= 3 ? 3.4 : 2.8;
  for (const x of torres) { L.push({ m: 'C:tower-square-base', x, s: alt }, { m: 'C:tower-square-top', x, y: 1.01 * alt, s: alt }); if (t >= 3) L.push({ m: 'C:flag', x, y: 1.31 * alt, s: 3 }); }
  m.vis = C.grupo(L);
}
export function comprar(custo) { if (G.ouro < custo) { evento('toast', { txt: `Faltam ${Math.ceil(custo - G.ouro)} 🪙` }); return false; } G.ouro -= custo; return true; }
export function construir(id, tipo) { if (!comprar(custoDefesa(tipo, 1))) return; montarDefesa(id, tipo, 1); evento('construiu', { nome: DEFESAS[tipo].nome, nivel: 1 }); salvar(); }
export function melhorarDefesa(id) { const d = G.def[id]; if (!d || d.nivel >= MAXNV) return; if (!comprar(custoDefesa(d.tipo, d.nivel + 1))) return; montarDefesa(id, d.tipo, d.nivel + 1); evento('construiu', { nome: DEFESAS[d.tipo].nome, nivel: d.nivel + 1 }); salvar(); }
export function valorVenda(id) { const d = G.def[id]; let total = 0; for (let n = 1; n <= d.nivel; n++) total += custoDefesa(d.tipo, n); return Math.round(total * 0.5); }
export function venderDefesa(id) {
  const d = G.def[id]; if (!d) return; G.ouro += valorVenda(id); limparVisual(d); delete G.def[id];
  for (const s of d.soldados) if (s.ref && s.ref.estado !== 'morto') { s.ref.removido = true; s.ref.vis.remover(); }
  visualVazio(id); salvar();
}
export function melhorarMuro() {
  const m = G.muro; if (m.nivel >= 8 || !comprar(MURALHA.custo[m.nivel])) return;
  m.nivel++; const ant = m.max; m.max = MURALHA.vida[m.nivel - 1]; m.hp += m.max - ant; visualMuro(); C.onda(0, 0, 10, 0xffd84a, 0.6);
  evento('construiu', { nome: MURALHA.nomes[m.nivel - 1], nivel: m.nivel }); salvar();
}
export const custoConserto = () => Math.ceil((G.muro.max - G.muro.hp) * 0.15);
export function consertarMuro() { const m = G.muro, c = custoConserto(); if (c < 1 || G.onda.estado === 'ativa' || !comprar(c)) return; m.hp = m.max; salvar(); }
export function melhorarMina() {
  const m = G.mina; if (m.nivel >= 8 || !comprar(MINA.custo[m.nivel])) return;
  m.nivel++; evento('construiu', { nome: 'Mina de Ouro', nivel: m.nivel }); C.faiscas(POS_MINA.x, 2, POS_MINA.z, 0xffd84a, 30, 4); salvar();
}
export function melhorarForja(qual) {
  const j = G.jog, n = j.forja[qual]; if (n >= FORJA.max || !comprar(FORJA.custo(n))) return;
  j.forja[qual]++; C.faiscas(j.x, 1.2, j.z, 0xffa040, 25, 3); evento('construiu', { nome: qual === 'arma' ? 'Arma do herói' : 'Armadura do herói', nivel: j.forja[qual] }); salvar();
}
function padSobHeroi() {
  const j = G.jog; if (j.estado === 'morto') return null;
  for (const [k, p] of Object.entries(G.pads)) if (Math.hypot(j.x - p.x, j.z - p.z) < 1.4) return k;
  return null;
}

// ---------------- laço ----------------
export function passo(dt) {
  if (!G.jog) return;
  G.t += dt;
  const j = G.jog;
  atualizarJogador(dt);
  atualizarOnda(dt);
  if (G.mina.nivel) { const r = MINA.renda[G.mina.nivel - 1]; G.mina.cofre = Math.min(r * MINA.cofre, G.mina.cofre + r * dt); }
  for (const e of G.inim) atualizarInimigo(e, dt);
  G.inim = G.inim.filter(e => !e.removido);
  for (const d of Object.values(G.def)) { atualizarDefesa(d, dt); for (const p of d.vis.pers) if (p.voltaIdle > 0 && (p.voltaIdle -= dt) <= 0) p.tocar('Idle'); }
  for (const s of G.sold) atualizarSoldado(s, dt);
  G.sold = G.sold.filter(s => !s.removido);
  // separação entre inimigos e deles com herói/soldados
  for (let a = 0; a < G.inim.length; a++) {
    const e = G.inim[a]; if (e.estado === 'morto') continue;
    for (let b = a + 1; b < G.inim.length; b++) {
      const o = G.inim[b]; if (o.estado === 'morto') continue;
      const dx = o.x - e.x, dz = o.z - e.z, d = Math.hypot(dx, dz), m = 0.55 * ((e.d.esc || 1) + (o.d.esc || 1));
      if (d < m && d > 1e-3) { const k = (m - d) / 2 / d; e.x -= dx * k; e.z -= dz * k; o.x += dx * k; o.z += dz * k; }
    }
    for (const al of [j, ...G.sold]) {
      if (al.estado === 'morto') continue;
      const dx = al.x - e.x, dz = al.z - e.z, d = Math.hypot(dx, dz), m = 0.5 + 0.55 * (e.d.esc || 1);
      if (d < m && d > 1e-3) { const k = (m - d) / d; al.x += dx * k * 0.6; al.z += dz * k * 0.6; e.x -= dx * k * 0.4; e.z -= dz * k * 0.4; }
    }
  }
  atualizarProjeteis(dt);
  // botões do chão
  const pk = padSobHeroi();
  if (pk === 'cofre' && G.mina.cofre >= 1) { const v = Math.floor(G.mina.cofre); G.ouro += v; G.mina.cofre -= v; texto(j.x, 2.4, j.z, `+${v} 🪙`, '#ffd84a', true); C.faiscas(j.x, 1, j.z, 0xffd84a, 20, 3); salvar(); }
  if (pk !== G.padAtual) { G.padAtual = pk; evento('pad', { k: pk }); }
  for (const p of Object.values(G.pads)) p.v.pulso(G.t + p.x);
  // visual
  j.vis.raiz.position.x = j.x; j.vis.raiz.position.z = j.z; j.vis.raiz.rotation.y = j.ang; j.vis.mixer.update(dt); j.vis.brilho(j.flash > 0 ? 0.3 : 0);
  for (const e of G.inim) { e.vis.raiz.position.x = e.x; e.vis.raiz.position.z = e.z; e.vis.raiz.rotation.y = e.ang; e.vis.mixer.update(dt * (e.lento > 0 ? 0.6 : 1)); e.vis.brilho(e.flash > 0 ? 0.35 : e.lento > 0 ? 0.12 : 0); }
  for (const s of G.sold) { s.vis.raiz.position.x = s.x; s.vis.raiz.position.z = s.z; s.vis.raiz.rotation.y = s.ang; s.vis.mixer.update(dt); s.vis.brilho(s.flash > 0 ? 0.3 : 0); }
  G.muro.flash = Math.max(0, (G.muro.flash || 0) - dt);
  for (const t of G.txt) t.t += dt; G.txt = G.txt.filter(t => t.t < 1.1);
  G.salvarT = (G.salvarT || 0) + dt; if (G.salvarT > 10) { G.salvarT = 0; salvar(); }
}
