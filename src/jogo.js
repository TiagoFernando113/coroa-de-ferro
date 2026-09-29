// Simulação do RPG: herói, combate, IA dos inimigos, itens, missões e save.
import * as C from './cena.js';
import { CLASSES, INIMIGOS, MISSOES, statsBase, statsInimigo, xpProx, novoItem, RARIDADES, POCAO, ETER, cacada } from './dados.js';
import { criarMundo, colidir, zonaDe, ZONAS, NASCER, CASTELO } from './mundo.js';

const SAVE = 'coroa_rpg_v1';
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angPara = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const difAng = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export const G = { M: null, jog: null, inim: [], npcs: [], proj: [], areas: [], drops: [], fila: [], t: 0, entrada: null };
export const entrada = { mx: 0, mz: 0, atacar: false, hab: [false, false, false], esquivar: false, pocao: false, eter: false, interagir: false };
G.entrada = entrada;
const evento = (tipo, dados = {}) => G.fila.push({ tipo, ...dados });
export const texto = (x, y, z, s, cor = '#fff', grande = false) => G.txt.push({ x, y, z, s, cor, grande, t: 0 });
G.txt = [];

// ---------------- save ----------------
export function temSave() { try { return !!JSON.parse(localStorage.getItem(SAVE)); } catch (e) { return false; } }
export function salvar() {
  const j = G.jog; if (!j) return;
  const d = { v: 1, cls: j.cls, nivel: j.nivel, xp: j.xp, ouro: j.ouro, pocoes: j.pocoes, eteres: j.eteres, equip: j.equip, inv: j.inv, hist: j.hist, mis: j.mis, cacadas: j.cacadas, portao: j.portao, baus: j.baus, x: j.x, z: j.z, hp: j.hp, mp: j.mp, mortes: j.mortes, abates: j.abates };
  try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch (e) {}
}
export function apagarSave() { try { localStorage.removeItem(SAVE); } catch (e) {} }

// ---------------- início ----------------
export function iniciar(cls) {
  G.M = criarMundo();
  C.montarMundo(G.M);
  let s = null; try { s = JSON.parse(localStorage.getItem(SAVE)); } catch (e) {}
  if (cls) s = null;
  const j = G.jog = {
    cls: s?.cls || cls, nivel: s?.nivel || 1, xp: s?.xp || 0, ouro: s?.ouro ?? 20, pocoes: s?.pocoes ?? 3, eteres: s?.eteres ?? 1,
    equip: s?.equip || { arma: null, armadura: null, amuleto: null }, inv: s?.inv || [], hist: s?.hist || 0, mis: s?.mis || null,
    cacadas: s?.cacadas || 0, portao: !!s?.portao, baus: s?.baus || {}, mortes: s?.mortes || 0, abates: s?.abates || 0,
    x: s?.x ?? NASCER.x, z: s?.z ?? NASCER.z, ang: Math.PI, estado: 'livre', t: 0, dur: 0, combo: 0, comboT: 0, cds: {}, buffs: [], iframes: 0,
    zona: '', semDano: 10, regen: 0, alvo: null, hab: null, acertou: false,
  };
  if (!j.equip.arma) j.equip.arma = novoItem('arma', 1, 0, j.cls);
  const st = stats(); j.hp = s?.hp ? Math.min(s.hp, st.vida) : st.vida; j.mp = s?.mp ?? st.mana;
  const cl = CLASSES[j.cls];
  j.vis = C.personagem(cl.modelo); j.vis.tocar('Idle');
  C.abrirPortao(j.portao);
  // NPCs
  for (const n of G.M.npcs) {
    const v = C.personagem(n.modelo); v.raiz.position.set(n.x, 0, n.z); v.raiz.rotation.y = n.ang; v.tocar('Idle');
    G.npcs.push({ ...n, vis: v, ang0: n.ang });
  }
  // inimigos
  for (const sp of G.M.spawns) for (let k = 0; k < sp.qtd; k++) nascerInimigo(sp, false);
  C.camera.yaw = j.ang;
  if (!s) evento('dialogo', { npc: 'anciao', abertura: true });
  salvar();
}

// ---------------- estatísticas ----------------
export function stats() {
  const j = G.jog, b = statsBase(j.cls, j.nivel), s = { ...b };
  for (const it of Object.values(j.equip)) if (it) { const up = 1 + 0.15 * (it.up || 0); s.atk += (it.atk || 0) * up; s.def += (it.def || 0) * up; s.vida += Math.round((it.vida || 0) * up); }
  for (const bf of j.buffs) { if (bf.atk) s.atk *= 1 + bf.atk; if (bf.def) s.def *= 1 + bf.def; if (bf.vel) s.vel *= 1 + bf.vel; }
  return s;
}
export const habLiberada = (h) => G.jog.nivel >= h.nivel;

// ---------------- dano ----------------
function calcDano(atk, mult, def) { return Math.max(1, Math.round(atk * mult * rnd(0.9, 1.1) * 100 / (100 + def * 6))); }
function danoInimigo(e, mult, efeito = {}) {
  if (e.estado === 'morto' || e.estado === 'surgir') return;
  const s = stats(); let v = calcDano(s.atk, mult, e.st.def), crit = Math.random() < 0.12;
  if (crit) v = Math.round(v * 1.7);
  e.hp -= v; e.flash = 0.12; e.aggro = true;
  texto(e.x, 2.2 * (e.d.esc || 1), e.z, (crit ? '💥' : '') + v, crit ? '#ffd84a' : '#ffffff', crit);
  C.faiscas(e.x, 1.1, e.z, crit ? 0xffd84a : 0xffffff, crit ? 12 : 6, 3);
  if (efeito.atordoa && !e.d.chefe) e.atordoado = Math.max(e.atordoado, efeito.atordoa);
  if (efeito.lento) e.lento = Math.max(e.lento, efeito.lento);
  if (efeito.empurra && !e.d.chefe) { const a = angPara(G.jog, e); e.x += Math.sin(a) * efeito.empurra; e.z += Math.cos(a) * efeito.empurra; }
  if (e.hp <= 0) matar(e);
  else if (e.estado !== 'atacar' && !e.d.chefe && e.vis.tem('Hit_A') && Math.random() < 0.5) { e.vis.tocar('Hit_A', { loop: false, reinicia: true }); e.hitT = 0.3; }
}
function danoJogador(v0, fonte) {
  const j = G.jog; if (j.estado === 'morto') return;
  if (j.iframes > 0) { texto(j.x, 2.3, j.z, 'esquivou!', '#9fe3ff'); return; }
  const v = calcDano(v0, 1, stats().def);
  j.hp -= v; j.semDano = 0; j.flash = 0.15; C.camera.tremor = Math.max(C.camera.tremor, 0.12);
  texto(j.x, 2.3, j.z, '-' + v, '#ff5a4a');
  if (j.hp <= 0) morrer();
}

// ---------------- herói ----------------
function alvoMaisProximo(raio, frente = 0.5) {
  const j = G.jog; let best = null, bs = 1e9;
  for (const e of G.inim) {
    if (e.estado === 'morto' || e.estado === 'surgir') continue;
    const d = dist(j, e); if (d > raio) continue;
    const da = Math.abs(difAng(j.ang, angPara(j, e)));
    const score = d + da * frente * 4; if (score < bs) { bs = score; best = e; }
  }
  return best;
}
function usarBasico() {
  const j = G.jog, b = CLASSES[j.cls].basico, s = stats();
  const alvo = alvoMaisProximo(b.tipo === 'melee' ? b.alcance + 3 : b.alcance, 0.6);
  if (alvo) j.ang = angPara(j, alvo);
  if (G.t - j.comboT > 1.1) j.combo = 0;
  const anim = b.anims[j.combo % b.anims.length]; j.combo++; j.comboT = G.t;
  const vel = 1 + (s.vel / CLASSES[j.cls].vel - 1);
  j.estado = 'atk'; j.t = 0; j.dur = b.dur / vel; j.acertou = false; j.alvo = alvo; j.hab = null;
  j.vis.tocar(anim, { loop: false, reinicia: true, fade: 0.08, vel: vel * 1.15 });
}
function impactoBasico() {
  const j = G.jog, b = CLASSES[j.cls].basico;
  if (b.tipo === 'melee') {
    C.arco(j.x, j.z, j.ang, b.alcance, b.arco, 0xfff2c0);
    for (const e of G.inim) {
      if (e.estado === 'morto') continue;
      const d = dist(j, e), r = 0.6 * (e.d.esc || 1);
      if (d < b.alcance + r && Math.abs(difAng(j.ang, angPara(j, e))) < b.arco / 2 * Math.PI / 180 + 0.2) danoInimigo(e, 1, { empurra: 0.4 });
    }
  } else {
    const alvo = j.alvo && j.alvo.estado !== 'morto' ? j.alvo : null;
    const a = alvo ? angPara(j, alvo) : j.ang;
    atirar(j, a, b.proj, b.vel, 1, { dono: 'jog', alcance: b.alcance + 4 });
  }
}
function atirar(de, ang, tipo, vel, mult, o = {}) {
  const obj = C.projetil(tipo), y = 1.2 * (de.d?.esc || 1);
  const p = { x: de.x + Math.sin(ang) * 0.8, z: de.z + Math.cos(ang) * 0.8, y, vx: Math.sin(ang) * vel, vz: Math.cos(ang) * vel, mult, tipo, obj, dono: o.dono, dano: o.dano || 0, perc: 0, maxDist: o.alcance || 20, andou: 0, explode: o.explode, lento: o.lento, persegue: o.persegue, acertados: new Set() };
  obj.position.set(p.x, y, p.z); obj.rotation.y = ang; G.proj.push(p); return p;
}
function usarHab(i) {
  const j = G.jog, h = CLASSES[j.cls].hab[i];
  if (!h || !habLiberada(h)) return;
  if ((j.cds[h.id] || 0) > 0) return;
  if (j.mp < h.mana) { evento('toast', { txt: 'Mana insuficiente 💧' }); return; }
  j.mp -= h.mana; j.cds[h.id] = h.cd;
  const alvo = alvoMaisProximo(h.tipo === 'salto' ? h.dist : h.tipo === 'investida' ? h.dist + 3 : 18, 0.6);
  if (alvo && h.tipo !== 'buff') j.ang = angPara(j, alvo);
  j.estado = 'hab'; j.t = 0; j.dur = h.dur; j.hab = h; j.acertou = false; j.alvo = alvo; j.tick = 0; j.atingidos = new Set();
  j.saltoDe = { x: j.x, z: j.z };
  if (h.tipo === 'salto') { const d = alvo ? Math.min(h.dist, dist(j, alvo)) : h.dist * 0.6; j.saltoPara = { x: j.x + Math.sin(j.ang) * d, z: j.z + Math.cos(j.ang) * d }; C.aviso(j.saltoPara.x, j.saltoPara.z, h.raio, h.impacto, 0x3aaaff); }
  if (h.tipo === 'chuva') { const p = alvo ? { x: alvo.x, z: alvo.z } : { x: j.x + Math.sin(j.ang) * 8, z: j.z + Math.cos(j.ang) * 8 }; j.chuvaEm = p; }
  j.vis.tocar(h.anim, { loop: h.tipo === 'giro', reinicia: true, fade: 0.08, vel: h.tipo === 'giro' ? 1.2 : 1 });
  evento('hab', { id: h.id });
}
function atualizarHab(dt) {
  const j = G.jog, h = j.hab, antes = j.t - dt;
  const passou = (tt) => antes < tt && j.t >= tt;
  if (h.tipo === 'investida') {
    const v = h.dist / h.dur; j.x += Math.sin(j.ang) * v * dt; j.z += Math.cos(j.ang) * v * dt; j.iframes = 0.1;
    for (const e of G.inim) if (e.estado !== 'morto' && !j.atingidos.has(e) && dist(j, e) < 1.6 * (e.d.esc || 1)) { j.atingidos.add(e); danoInimigo(e, h.mult, { atordoa: h.atordoa, empurra: 2 }); C.faiscas(e.x, 1.2, e.z, 0x9fd8ff, 10); }
    if (Math.random() < 0.6) C.faiscas(j.x, 0.3, j.z, 0xcfcfcf, 2, 1.5);
  }
  if (h.tipo === 'area' && passou(h.impacto)) {
    C.onda(j.x, j.z, h.raio, h.cor || 0xfff2c0, 0.45); C.camera.tremor = 0.15;
    for (const e of G.inim) if (e.estado !== 'morto' && dist(j, e) < h.raio + 0.5) danoInimigo(e, h.mult, { lento: h.lento, empurra: 1.2 });
    if (h.cor) C.faiscas(j.x, 0.5, j.z, h.cor, 30, 5);
  }
  if (h.tipo === 'giro') {
    j.tick -= dt;
    const mv = entrada.mx || entrada.mz ? stats().vel * 0.55 : 0; if (mv) { j.x += entrada.mx * mv * dt; j.z += entrada.mz * mv * dt; }
    if (j.tick <= 0) { j.tick = h.tick; C.onda(j.x, j.z, h.raio, 0xffe0a0, 0.3); for (const e of G.inim) if (e.estado !== 'morto' && dist(j, e) < h.raio + 0.4) danoInimigo(e, h.mult); }
  }
  if (h.tipo === 'salto') {
    const k = Math.min(1, j.t / h.impacto);
    j.x = j.saltoDe.x + (j.saltoPara.x - j.saltoDe.x) * k; j.z = j.saltoDe.z + (j.saltoPara.z - j.saltoDe.z) * k;
    j.vis.raiz.position.y = Math.sin(k * Math.PI) * 2.5; j.iframes = 0.1;
    if (passou(h.impacto)) { C.onda(j.x, j.z, h.raio, 0xffcf7a, 0.5); C.camera.tremor = 0.35; C.faiscas(j.x, 0.3, j.z, 0xc9a36a, 30, 5); for (const e of G.inim) if (e.estado !== 'morto' && dist(j, e) < h.raio + 0.5) danoInimigo(e, h.mult, { atordoa: 0.8 }); }
  }
  if (h.tipo === 'buff' && passou(0.15)) {
    const s = stats(); j.buffs = j.buffs.filter(b => b.id !== h.id); j.buffs.push({ id: h.id, ...h.buff, t: h.buff.dur });
    if (h.cura) { const c = Math.round(s.vida * h.cura); j.hp = Math.min(stats().vida, j.hp + c); texto(j.x, 2.4, j.z, '+' + c, '#7dff7a'); }
    if (h.recuo) { j.recuoT = 0.3; }
    C.faiscas(j.x, 1, j.z, h.id === 'furia' ? 0xff5a2a : 0x9fe3ff, 20, 3); texto(j.x, 2.8, j.z, h.nome + '!', '#ffe08a');
  }
  if (h.recuo && j.recuoT > 0) { j.recuoT -= dt; j.x -= Math.sin(j.ang) * h.recuo / 0.3 * dt; j.z -= Math.cos(j.ang) * h.recuo / 0.3 * dt; j.iframes = 0.1; }
  if (h.tipo === 'projetil' && passou(h.impacto)) {
    for (let k = 0; k < h.n; k++) { const off = h.n > 1 ? (k / (h.n - 1) - 0.5) * h.leque * Math.PI / 180 : 0; atirar(j, j.ang + off, h.proj, h.vel, h.mult, { dono: 'jog', alcance: 22, explode: h.explode }); }
  }
  if (h.tipo === 'chuva' && passou(0.25)) {
    const p = j.chuvaEm; C.aviso(p.x, p.z, h.raio, h.atraso, h.cor || 0x3aaaff);
    G.areas.push({ x: p.x, z: p.z, r: h.raio, t: 0, atraso: h.atraso, dono: 'jog', mult: h.mult, cor: h.cor, meteoro: h.id === 'meteoro' });
  }
}
function atualizarJogador(dt) {
  const j = G.jog, s = stats();
  j.flash = Math.max(0, (j.flash || 0) - dt); j.iframes = Math.max(0, j.iframes - dt);
  for (const k in j.cds) j.cds[k] = Math.max(0, j.cds[k] - dt);
  j.buffs = j.buffs.filter(b => (b.t -= dt) > 0);
  if (j.estado === 'morto') { j.t += dt; return; }
  j.semDano += dt;
  j.mp = Math.min(s.mana, j.mp + s.mana * 0.025 * dt);
  if (j.semDano > 5) j.hp = Math.min(s.vida, j.hp + s.vida * (G.jog.zona === 'vila' ? 0.08 : 0.02) * dt);
  if (j.hp > s.vida) j.hp = s.vida;
  // ações pontuais
  if (entrada.pocao) { entrada.pocao = false; beber('pocao'); }
  if (entrada.eter) { entrada.eter = false; beber('eter'); }
  if (entrada.interagir) { entrada.interagir = false; interagir(); }
  const livre = j.estado === 'livre';
  if (entrada.esquivar && (livre || j.estado === 'atk') && !(j.cds.esq > 0)) {
    entrada.esquivar = false; j.cds.esq = 0.9;
    if (entrada.mx || entrada.mz) j.ang = Math.atan2(entrada.mx, entrada.mz);
    j.estado = 'esquiva'; j.t = 0; j.dur = 0.42; j.iframes = 0.45; j.vis.tocar('Dodge_Forward', { loop: false, reinicia: true, fade: 0.05, vel: 1.3 });
  }
  entrada.esquivar = false;
  for (let i = 0; i < 3; i++) if (entrada.hab[i]) { entrada.hab[i] = false; if (j.estado === 'livre' || (j.estado === 'atk' && j.t > j.dur * 0.5)) usarHab(i); }
  if (j.estado === 'livre' && entrada.atacar) usarBasico();

  if (j.estado === 'livre') {
    const m = Math.hypot(entrada.mx, entrada.mz);
    if (m > 0.05) {
      const v = s.vel * Math.min(1, m);
      j.x += entrada.mx / m * v * dt; j.z += entrada.mz / m * v * dt;
      const alvoAng = Math.atan2(entrada.mx, entrada.mz); j.ang += difAng(j.ang, alvoAng) * Math.min(1, dt * 14);
      j.vis.tocar(m > 0.55 ? 'Running_A' : 'Walking_A', { vel: m > 0.55 ? 1 : 1.2 });
    } else j.vis.tocar('Idle');
  } else {
    j.t += dt;
    if (j.estado === 'atk') {
      const b = CLASSES[j.cls].basico, imp = b.impacto / b.dur * j.dur;
      if (!j.acertou && j.t >= imp) { j.acertou = true; impactoBasico(); }
      if (j.alvo && j.alvo.estado !== 'morto') j.ang += difAng(j.ang, angPara(j, j.alvo)) * Math.min(1, dt * 12);
    }
    if (j.estado === 'esquiva') { const v = 12 * (1 - j.t / j.dur) + 3; j.x += Math.sin(j.ang) * v * dt; j.z += Math.cos(j.ang) * v * dt; }
    if (j.estado === 'hab') atualizarHab(dt);
    if (j.t >= j.dur) { j.estado = 'livre'; j.vis.raiz.position.y = 0; if (entrada.atacar) usarBasico(); }
  }
  colidir(G.M, j, 0.5, j.portao);
  // zona
  const z = zonaDe(j.x, j.z);
  if (z !== j.zona) { if (j.zona) evento('zona', { nome: ZONAS[z].nome, segura: ZONAS[z].segura }); j.zona = z; }
  // portão trancado
  if (!j.portao && Math.abs(j.x) < 5 && Math.abs(j.z - CASTELO.portao.z) < 2.5 && !j.avisouPortao) { j.avisouPortao = true; evento('toast', { txt: '🔒 O portão está trancado. Talvez haja uma chave...' }); }
  if (Math.abs(j.z - CASTELO.portao.z) > 6) j.avisouPortao = false;
}
function beber(tipo) {
  const j = G.jog, s = stats();
  if (tipo === 'pocao') {
    if (j.pocoes <= 0) return evento('toast', { txt: 'Sem poções de vida' });
    if (j.hp >= s.vida) return; j.pocoes--; const c = Math.round(s.vida * POCAO.cura); j.hp = Math.min(s.vida, j.hp + c);
    texto(j.x, 2.4, j.z, '+' + c, '#7dff7a'); C.faiscas(j.x, 1, j.z, 0x7dff7a, 16, 2);
  } else {
    if (j.eteres <= 0) return evento('toast', { txt: 'Sem éter de mana' });
    if (j.mp >= s.mana) return; j.eteres--; const c = Math.round(s.mana * ETER.mana); j.mp = Math.min(s.mana, j.mp + c);
    texto(j.x, 2.4, j.z, '+' + c, '#7ab8ff'); C.faiscas(j.x, 1, j.z, 0x7ab8ff, 16, 2);
  }
}
function morrer() {
  const j = G.jog; j.hp = 0; j.estado = 'morto'; j.t = 0; j.mortes++;
  j.vis.tocar('Death_A', { loop: false, reinicia: true });
  const perda = Math.floor(j.ouro * 0.1); j.ouro -= perda;
  evento('morte', { perda });
}
export function renascer() {
  const j = G.jog, s = stats();
  j.x = NASCER.x; j.z = NASCER.z; j.hp = s.vida; j.mp = s.mana; j.estado = 'livre'; j.buffs = []; j.vis.tocar('Idle', { reinicia: true });
  for (const e of G.inim) if (e.estado !== 'morto') { e.aggro = false; e.estado = 'voltar'; }
  salvar();
}
function ganharXP(v) {
  const j = G.jog; j.xp += v;
  while (j.xp >= xpProx(j.nivel)) {
    j.xp -= xpProx(j.nivel); j.nivel++;
    const s = stats(); j.hp = s.vida; j.mp = s.mana;
    const nova = CLASSES[j.cls].hab.find(h => h.nivel === j.nivel);
    evento('nivel', { nivel: j.nivel, hab: nova });
    C.faiscas(j.x, 1, j.z, 0xffd84a, 40, 5); C.onda(j.x, j.z, 4, 0xffd84a, 0.6);
    j.vis.tocar('Cheer', { loop: false, reinicia: true }); j.estado = 'hab'; j.hab = { tipo: 'nada' }; j.t = 0; j.dur = 1.2;
  }
}

// ---------------- inimigos ----------------
function nascerInimigo(sp, animado = true) {
  const d = INIMIGOS[sp.tipo], a = Math.random() * 6.28, r = Math.random() * sp.raio;
  const st = statsInimigo(sp.tipo, sp.nivel);
  const e = { tipo: sp.tipo, d, nivel: sp.nivel, st, hp: st.vida, max: st.vida, sp, x: sp.x + Math.cos(a) * r, z: sp.z + Math.sin(a) * r, ang: Math.random() * 6.28,
    estado: animado ? 'surgir' : 'ocioso', t: 0, cd: rnd(0.5, 1.5), atordoado: 0, lento: 0, flash: 0, vagarT: rnd(1, 4), especialT: 6, invocT: d.invoca || 0, fases: 0 };
  colidir(G.M, e, 0.5, true);
  e.vis = C.personagem(d.modelo, d.armas, d.esc || 1);
  e.vis.raiz.position.set(e.x, 0, e.z);
  if (animado && e.vis.tem('Spawn_Ground_Skeletons')) { e.vis.tocar('Spawn_Ground_Skeletons', { loop: false }); e.t = 0; }
  else { e.estado = 'ocioso'; e.vis.tocar('Idle'); }
  G.inim.push(e); return e;
}
function matar(e) {
  const j = G.jog; e.estado = 'morto'; e.t = 0; e.hp = 0;
  e.vis.tocar(e.vis.tem('Death_C_Skeletons') && !e.d.chefe ? 'Death_C_Skeletons' : 'Death_A', { loop: false, reinicia: true });
  C.faiscas(e.x, 1, e.z, 0xd8e0ff, 16, 3);
  ganharXP(e.st.xp); j.abates++;
  texto(e.x, 2.6, e.z, `+${e.st.xp} XP`, '#b5f0ff');
  // saque
  const ouro = Math.round(rnd(2, 5) * e.nivel * (e.d.elite ? 6 : e.d.chefe ? 20 : 1));
  soltar('ouro', e, ouro);
  if (Math.random() < (e.d.chefe || e.d.elite ? 1 : 0.1)) soltar('pocao', e, 1);
  const chItem = e.d.chefe ? 1 : e.d.elite ? 1 : 0.07 + 0.01 * e.nivel;
  if (Math.random() < chItem) {
    const rar = e.d.chefe ? 3 : e.d.elite ? 2 : Math.random() < 0.15 ? 2 : Math.random() < 0.4 ? 1 : 0;
    const slot = ['arma', 'armadura', 'amuleto'][Math.floor(Math.random() * 3)];
    soltar('item', e, novoItem(slot, Math.max(1, e.nivel + (Math.random() < 0.3 ? 1 : 0)), rar, j.cls));
  }
  // missão
  const m = j.mis;
  if (m && m.estado === 'ativa' && m.obj.tipo === 'matar') {
    const zOk = !m.obj.zona || zonaDe(e.x, e.z) === m.obj.zona, tOk = !m.obj.tipos || m.obj.tipos.includes(e.tipo);
    if (zOk && tOk && !e.invocado) { m.prog++; evento('progresso', {}); if (m.prog >= m.obj.qtd) { m.estado = 'completa'; evento('missaoOk', { nome: m.nome }); } }
  }
  if (e.tipo === 'rei') { evento('chefeMorto', {}); }
  salvar();
}
function soltar(tipo, e, valor) {
  const a = Math.random() * 6.28, r = rnd(0.5, 1.5), x = e.x + Math.cos(a) * r, z = e.z + Math.sin(a) * r;
  const modelo = tipo === 'ouro' ? 'D:coin' : tipo === 'pocao' ? 'D:potion' : 'D:chest';
  const obj = C.objeto(modelo, tipo === 'item' ? 1.6 : 1.3); obj.position.set(x, 0, z);
  G.drops.push({ tipo, valor, x, z, obj, t: 0 });
}
function atualizarInimigo(e, dt) {
  const j = G.jog, d = e.d, vis = e.vis;
  e.flash = Math.max(0, e.flash - dt); e.atordoado = Math.max(0, e.atordoado - dt); e.lento = Math.max(0, e.lento - dt); e.hitT = Math.max(0, (e.hitT || 0) - dt);
  e.t += dt;
  if (e.estado === 'morto') {
    if (e.t > 3) vis.raiz.position.y = -(e.t - 3) * 0.8;
    if (e.t > 4.5 && !e.removido) { e.removido = true; vis.remover(); if (!e.invocado) setTimeout(() => { if (G.jog) nascerInimigo(e.sp, true); }, (e.d.chefe ? 120 : e.d.elite ? 90 : 35) * 1000); }
    return;
  }
  if (e.estado === 'surgir') { if (e.t > 1.3) { e.estado = 'ocioso'; vis.tocar('Idle'); } return; }
  if (e.atordoado > 0) { vis.tocar('Idle'); if (Math.random() < dt * 8) C.faiscas(e.x, 2.1 * (d.esc || 1), e.z, 0xffd84a, 1, 0.5); return; }
  const dj = dist(e, j), vivo = j.estado !== 'morto', naVila = zonaDe(j.x, j.z) === 'vila';
  const longe = Math.hypot(e.x - e.sp.x, e.z - e.sp.z) > e.sp.raio + (d.chefe ? 16 : 24);
  const aggroR = d.chefe ? 15 : 11;
  if (e.estado !== 'voltar' && e.estado !== 'atacar') {
    if (vivo && !naVila && (dj < aggroR || (e.aggro && dj < 26)) && !longe) {
      if (!e.aggro && d.chefe) { evento('chefe', { e }); vis.tocar('Taunt', { loop: false, reinicia: true }); e.estado = 'provocar'; e.t = 0; }
      e.aggro = true; if (e.estado !== 'provocar') e.estado = 'perseguir';
    } else if (e.aggro || longe) { e.aggro = false; e.estado = 'voltar'; }
  }
  if (e.estado === 'provocar') { e.ang = angPara(e, j); if (e.t > 1.6) e.estado = 'perseguir'; return; }
  const vel = d.vel * (e.lento > 0 ? 0.5 : 1) * (e.fases >= 2 ? 1.25 : 1);
  const mover = (ax, az, v) => { const m = Math.hypot(ax, az) || 1; e.x += ax / m * v * dt; e.z += az / m * v * dt; e.ang += difAng(e.ang, Math.atan2(ax, az)) * Math.min(1, dt * 10); };
  e.cd -= dt;
  if (e.estado === 'ocioso') {
    e.vagarT -= dt; vis.tocar('Idle');
    if (e.vagarT <= 0) { e.estado = 'vagar'; const a = Math.random() * 6.28, r = Math.random() * e.sp.raio; e.dest = { x: e.sp.x + Math.cos(a) * r, z: e.sp.z + Math.sin(a) * r }; }
  } else if (e.estado === 'vagar') {
    const dx = e.dest.x - e.x, dz = e.dest.z - e.z;
    if (Math.hypot(dx, dz) < 0.5) { e.estado = 'ocioso'; e.vagarT = rnd(2, 6); } else { mover(dx, dz, vel * 0.45); vis.tocar('Walking_A'); }
  } else if (e.estado === 'voltar') {
    const dx = e.sp.x - e.x, dz = e.sp.z - e.z; e.hp = Math.min(e.max, e.hp + e.max * 0.3 * dt);
    if (Math.hypot(dx, dz) < e.sp.raio) { e.estado = 'ocioso'; e.vagarT = rnd(1, 3); } else { mover(dx, dz, vel * 1.2); vis.tocar('Running_A'); }
  } else if (e.estado === 'perseguir') {
    if (d.chefe) chefe(e, dt, dj);
    if (e.estado !== 'perseguir') return;
    // necromante invoca lacaios
    if (d.invoca) { e.invocT -= dt; if (e.invocT <= 0 && G.inim.filter(x => x.invocado && x.dono === e && x.estado !== 'morto').length < 2) { e.invocT = d.invoca; invocar(e, 2, Math.max(1, e.nivel - 2)); vis.tocar('Spellcast_Summon', { loop: false, reinicia: true }); e.estado = 'atacar'; e.t = 0; e.atkDur = 1.2; e.impactoFeito = true; return; } }
    const a = Math.atan2(j.x - e.x, j.z - e.z);
    if (d.tipo === 'melee') {
      if (dj > d.alcance * (d.esc || 1) * 0.55 + 0.9) { mover(j.x - e.x, j.z - e.z, vel); vis.tocar('Running_A', { vel: vel / 4 }); }
      else { e.ang += difAng(e.ang, a) * Math.min(1, dt * 10); vis.tocar(vis.tem('Idle_Combat') ? 'Idle_Combat' : 'Idle'); if (e.cd <= 0) atacar(e); }
    } else {
      const ideal = d.alcance * 0.7;
      if (dj > d.alcance) { mover(j.x - e.x, j.z - e.z, vel); vis.tocar('Running_A'); }
      else if (dj < ideal * 0.55) { mover(e.x - j.x, e.z - j.z, vel * 0.8); vis.tocar('Walking_A'); e.ang += difAng(e.ang, a) * dt * 4; }
      else { e.ang += difAng(e.ang, a) * Math.min(1, dt * 10); vis.tocar(vis.tem('Idle_Combat') ? 'Idle_Combat' : 'Idle'); if (e.cd <= 0) atacar(e); }
    }
  } else if (e.estado === 'atacar') {
    e.ang += difAng(e.ang, angPara(e, j)) * Math.min(1, dt * (d.tipo === 'melee' ? 3 : 8));
    if (!e.impactoFeito && e.t >= d.impacto) { e.impactoFeito = true; impactoInimigo(e); }
    if (e.rajada > 0 && e.t >= d.impacto + 0.25) { e.rajada--; e.t = d.impacto; e.impactoFeito = false; }
    if (e.t >= (e.atkDur || 1)) { e.estado = 'perseguir'; }
  }
  if (e.estado === 'especial') especialChefe(e, dt);
}
function atacar(e) {
  const d = e.d; e.estado = 'atacar'; e.t = 0; e.impactoFeito = false; e.cd = d.cd * rnd(0.85, 1.2) * (e.fases >= 2 ? 0.75 : 1); e.atkDur = d.impacto + 0.55;
  e.rajada = d.rajada ? d.rajada - 1 : 0;
  e.vis.tocar(d.atkAnim, { loop: false, reinicia: true, fade: 0.1 });
}
function impactoInimigo(e) {
  const j = G.jog, d = e.d;
  if (d.tipo === 'melee') {
    const alc = d.alcance * (d.esc || 1) * 0.6 + 1.2;
    if (dist(e, j) < alc && Math.abs(difAng(e.ang, angPara(e, j))) < 1.1) danoJogador(e.st.atk, e);
    C.arco(e.x, e.z, e.ang, alc, 100, 0xff7a6a);
  } else {
    const tv = dist(e, j) / 18, px = j.x + (entrada.mx || 0) * stats().vel * tv * 0.5, pz = j.z + (entrada.mz || 0) * stats().vel * tv * 0.5;
    const a = Math.atan2(px - e.x, pz - e.z);
    atirar(e, a, d.tipo === 'caster' ? 'sombra' : 'virote', d.tipo === 'caster' ? 13 : 20, 1, { dono: 'inim', dano: e.st.atk, alcance: d.alcance + 6, persegue: d.tipo === 'caster' });
  }
}
function invocar(e, n, nivel) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * 6.28, sp = { tipo: 'lacaio', nivel, x: e.x + Math.cos(a) * 3, z: e.z + Math.sin(a) * 3, raio: 1 };
    const m = nascerInimigo(sp, true); m.invocado = true; m.dono = e; m.aggro = true; m.sp = { ...e.sp, tipo: 'lacaio' };
  }
}
// Rei Esqueleto: salto com machado, giro, invocação e fúria
function chefe(e, dt, dj) {
  const j = G.jog;
  if (e.fases === 0 && e.hp < e.max * 0.7) { e.fases = 1; invocar(e, 3, 6); evento('fala', { quem: 'Rei Esqueleto', txt: 'Levantem-se, meus soldados!' }); }
  if (e.fases === 1 && e.hp < e.max * 0.35) { e.fases = 2; invocar(e, 4, 7); evento('fala', { quem: 'Rei Esqueleto', txt: 'CHEGA! Sintam a ira do Rei!' }); C.camera.tremor = 0.4; }
  e.especialT -= dt;
  if (e.especialT <= 0) {
    e.especialT = e.fases >= 2 ? 4.5 : 6.5;
    const tipo = dj > 5 || Math.random() < 0.5 ? 'salto' : 'giro';
    e.estado = 'especial'; e.t = 0; e.esp = tipo; e.hits = new Set();
    if (tipo === 'salto') { e.de = { x: e.x, z: e.z }; e.para = { x: j.x, z: j.z }; e.aviso = C.aviso(j.x, j.z, 4.2, 1.1); e.vis.tocar('1H_Melee_Attack_Jump_Chop', { loop: false, reinicia: true, vel: 0.8 }); }
    else { e.aviso = C.aviso(e.x, e.z, 4.8, 0.8); e.vis.tocar('2H_Melee_Attack_Spinning', { loop: true, reinicia: true }); e.giroTick = 0.8; }
  }
}
function especialChefe(e, dt) {
  const j = G.jog, antes = e.t - dt;
  if (e.esp === 'salto') {
    const k = Math.min(1, e.t / 1.1); e.x = e.de.x + (e.para.x - e.de.x) * k; e.z = e.de.z + (e.para.z - e.de.z) * k;
    e.vis.raiz.position.y = Math.sin(k * Math.PI) * 3; e.ang = Math.atan2(e.para.x - e.de.x, e.para.z - e.de.z);
    if (antes < 1.1 && e.t >= 1.1) { C.onda(e.x, e.z, 4.2, 0xff7a3a, 0.5); C.camera.tremor = 0.5; C.faiscas(e.x, 0.3, e.z, 0xc9a36a, 40, 6); if (dist(e, j) < 4.4) danoJogador(e.st.atk * 1.8, e); }
    if (e.t > 1.7) { e.estado = 'perseguir'; e.vis.raiz.position.y = 0; }
  } else {
    const ativo = e.t > 0.8;
    if (ativo) { mover2(e, j, dt, e.d.vel * 0.7); e.giroTick -= dt; if (e.giroTick <= 0) { e.giroTick = 0.4; C.onda(e.x, e.z, 4.8, 0xff7a3a, 0.3); if (dist(e, j) < 4.9) danoJogador(e.st.atk * 0.7, e); } }
    if (e.t > 3.2) { e.estado = 'perseguir'; e.vis.tocar('Idle_Combat'); }
  }
}
function mover2(e, j, dt, v) { const dx = j.x - e.x, dz = j.z - e.z, m = Math.hypot(dx, dz) || 1; e.x += dx / m * v * dt; e.z += dz / m * v * dt; }

// ---------------- projéteis, áreas e saques ----------------
function atualizarProjeteis(dt) {
  const j = G.jog;
  for (let i = G.proj.length - 1; i >= 0; i--) {
    const p = G.proj[i];
    if (p.persegue && j.estado !== 'morto') { const a = Math.atan2(j.x - p.x, j.z - p.z), v = Math.hypot(p.vx, p.vz), a0 = Math.atan2(p.vx, p.vz), na = a0 + difAng(a0, a) * Math.min(1, dt * 1.6); p.vx = Math.sin(na) * v; p.vz = Math.cos(na) * v; }
    p.x += p.vx * dt; p.z += p.vz * dt; p.andou += Math.hypot(p.vx, p.vz) * dt;
    p.obj.position.set(p.x, p.y, p.z); p.obj.rotation.y = Math.atan2(p.vx, p.vz);
    let fim = p.andou > p.maxDist;
    if (p.dono === 'jog') {
      for (const e of G.inim) {
        if (e.estado === 'morto' || e.estado === 'surgir' || p.acertados.has(e)) continue;
        if (Math.hypot(e.x - p.x, e.z - p.z) < 0.8 * (e.d.esc || 1)) {
          p.acertados.add(e);
          if (p.explode) { explodir(p); fim = true; break; }
          danoInimigo(e, p.mult); C.faiscas(p.x, p.y, p.z, p.tipo === 'magia' ? 0xc9a0ff : 0xffffff, 6, 2); fim = true; break;
        }
      }
    } else if (j.estado !== 'morto' && Math.hypot(j.x - p.x, j.z - p.z) < 0.7) {
      danoJogador(p.dano, null); C.faiscas(p.x, p.y, p.z, p.tipo === 'sombra' ? 0x7dff9a : 0xffffff, 6, 2); fim = true;
    }
    if (fim) { if (p.explode && !p.explodiu && p.andou > p.maxDist) explodir(p); C.remover(p.obj); G.proj.splice(i, 1); }
  }
  for (let i = G.areas.length - 1; i >= 0; i--) {
    const a = G.areas[i]; a.t += dt;
    if (a.meteoro && a.t < a.atraso) C.faiscas(a.x + (1 - a.t / a.atraso) * 6, 1 + (1 - a.t / a.atraso) * 14, a.z, 0xff7a2a, 2, 0.5);
    if (a.t >= a.atraso) {
      C.onda(a.x, a.z, a.r, a.cor || 0x7ad0ff, 0.5); C.faiscas(a.x, 0.4, a.z, a.cor || 0x7ad0ff, a.meteoro ? 50 : 25, a.meteoro ? 7 : 4);
      if (a.meteoro) C.camera.tremor = 0.4;
      for (const e of G.inim) if (e.estado !== 'morto' && Math.hypot(e.x - a.x, e.z - a.z) < a.r + 0.5) danoInimigo(e, a.mult, { atordoa: a.meteoro ? 1 : 0 });
      G.areas.splice(i, 1);
    }
  }
}
function explodir(p) {
  p.explodiu = true; C.onda(p.x, p.z, p.explode, 0xff7a2a, 0.4); C.faiscas(p.x, p.y, p.z, 0xff7a2a, 30, 5);
  for (const e of G.inim) if (e.estado !== 'morto' && Math.hypot(e.x - p.x, e.z - p.z) < p.explode + 0.5) danoInimigo(e, p.mult);
}
function atualizarDrops(dt) {
  const j = G.jog;
  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i]; d.t += dt;
    d.obj.position.y = 0.3 + Math.sin(d.t * 4) * 0.15; d.obj.rotation.y += dt * 2;
    const dj = Math.hypot(j.x - d.x, j.z - d.z);
    if (d.t > 0.6 && dj < 6 && j.estado !== 'morto') { const k = Math.min(1, dt * 8); d.x += (j.x - d.x) * k; d.z += (j.z - d.z) * k; d.obj.position.x = d.x; d.obj.position.z = d.z; }
    if (d.t > 0.6 && dj < 0.9) {
      if (d.tipo === 'ouro') { j.ouro += d.valor; texto(j.x, 2.2, j.z, `+${d.valor} 🪙`, '#ffd84a'); }
      if (d.tipo === 'pocao') { j.pocoes++; texto(j.x, 2.2, j.z, '+1 🧪', '#ff8a8a'); }
      if (d.tipo === 'item') { if (j.inv.length >= 30) { evento('toast', { txt: 'Mochila cheia!' }); continue; } j.inv.push(d.valor); evento('item', { item: d.valor }); }
      C.remover(d.obj); G.drops.splice(i, 1);
    }
    if (d.t > 90) { C.remover(d.obj); G.drops.splice(i, 1); }
  }
}

// ---------------- NPCs, baús e missões ----------------
export function interativoPerto() {
  const j = G.jog; if (!j || j.estado === 'morto') return null;
  for (const n of G.npcs) if (dist(j, n) < 3.2) return { tipo: 'npc', n, txt: 'Falar' };
  for (const b of G.M.baus) if (Math.hypot(j.x - b.x, j.z - b.z) < 3.2 && !j.baus[b.id]) return { tipo: 'bau', b, txt: 'Abrir' };
  return null;
}
function interagir() {
  const j = G.jog, it = interativoPerto(); if (!it) return;
  if (it.tipo === 'npc') {
    j.ang = angPara(j, it.n); it.n.vis.raiz.rotation.y = angPara(it.n, j); it.n.vis.tocar('Interact', { loop: false, reinicia: true }); setTimeout(() => it.n.vis.tocar('Idle'), 1500);
    evento('dialogo', { npc: it.n.id });
  } else {
    const m = j.mis;
    if (!(m && m.obj.tipo === 'bau' && m.obj.id === it.b.id)) { evento('toast', { txt: '🔒 Trancado por magia. O Ancião deve saber algo.' }); return; }
    j.baus[it.b.id] = true; j.portao = true; C.abrirPortao(true); C.bauAberto(it.b.id, true);
    j.vis.tocar('Interact', { loop: false, reinicia: true });
    C.faiscas(it.b.x, 1, it.b.z, 0xffd84a, 40, 4); m.estado = 'completa'; m.prog = 1;
    evento('toast', { txt: '🗝️ Você encontrou a Chave do Castelo! O portão ao sul se abriu.' }); evento('missaoOk', { nome: m.nome });
    salvar();
  }
}
export function missaoDisponivel() { const j = G.jog; return j.hist < MISSOES.length ? MISSOES[j.hist] : cacada(j.cacadas, j.nivel); }
export function aceitarMissao() { const j = G.jog, m = missaoDisponivel(); j.mis = { ...m, prog: 0, estado: 'ativa' }; if (m.obj.tipo === 'bau' && j.baus[m.obj.id]) j.mis.estado = 'completa'; salvar(); evento('progresso', {}); }
export function entregarMissao() {
  const j = G.jog, m = j.mis; if (!m || m.estado !== 'completa') return null;
  ganharXP(m.xp); j.ouro += m.ouro; if (m.pocoes) j.pocoes += m.pocoes;
  let item = null; if (m.item) { item = novoItem(m.item.slot, m.item.nivel, m.item.rar, j.cls); if (m.item.nome) item.nome = m.item.nome; j.inv.push(item); }
  if (m.cacada) j.cacadas++; else j.hist++;
  j.mis = null; salvar(); evento('progresso', {});
  return { xp: m.xp, ouro: m.ouro, pocoes: m.pocoes, item };
}
export function equipar(id) {
  const j = G.jog, i = j.inv.findIndex(x => x.id === id); if (i < 0) return;
  const it = j.inv[i], velho = j.equip[it.slot]; j.equip[it.slot] = it; j.inv.splice(i, 1); if (velho) j.inv.push(velho);
  const s = stats(); j.hp = Math.min(j.hp, s.vida); salvar();
}
export function vender(id, preco) { const j = G.jog, i = j.inv.findIndex(x => x.id === id); if (i < 0) return; j.inv.splice(i, 1); j.ouro += preco; salvar(); }

// ---------------- laço ----------------
export function passo(dt) {
  if (!G.jog) return;
  G.t += dt;
  atualizarJogador(dt);
  for (const e of G.inim) atualizarInimigo(e, dt);
  G.inim = G.inim.filter(e => !e.removido);
  // separação entre inimigos e colisão com o cenário
  for (let a = 0; a < G.inim.length; a++) {
    const e = G.inim[a]; if (e.estado === 'morto') continue;
    for (let b = a + 1; b < G.inim.length; b++) {
      const o = G.inim[b]; if (o.estado === 'morto') continue;
      const dx = o.x - e.x, dz = o.z - e.z, d = Math.hypot(dx, dz), m = 0.6 * ((e.d.esc || 1) + (o.d.esc || 1));
      if (d < m && d > 1e-3) { const k = (m - d) / 2 / d; e.x -= dx * k; e.z -= dz * k; o.x += dx * k; o.z += dz * k; }
    }
    const j = G.jog, dx = j.x - e.x, dz = j.z - e.z, d = Math.hypot(dx, dz), m = 0.5 + 0.6 * (e.d.esc || 1);
    if (d < m && d > 1e-3 && j.estado !== 'morto') { const k = (m - d) / d; if (e.d.chefe) { j.x += dx * k; j.z += dz * k; } else { e.x -= dx * k * 0.5; e.z -= dz * k * 0.5; j.x += dx * k * 0.5; j.z += dz * k * 0.5; } }
    colidir(G.M, e, 0.5 * (e.d.esc || 1), true);
  }
  atualizarProjeteis(dt);
  atualizarDrops(dt);
  // NPCs olham o herói quando ele chega perto
  for (const n of G.npcs) { const d = dist(n, G.jog), alvo = d < 6 ? angPara(n, G.jog) : n.ang0; n.vis.raiz.rotation.y += difAng(n.vis.raiz.rotation.y, alvo) * Math.min(1, dt * 4); n.vis.mixer.update(dt); }
  // visual
  const j = G.jog;
  j.vis.raiz.position.x = j.x; j.vis.raiz.position.z = j.z; j.vis.raiz.rotation.y = j.ang; j.vis.mixer.update(dt); j.vis.brilho(j.flash > 0 ? 0.3 : 0);
  for (const e of G.inim) {
    const perto = Math.abs(e.x - j.x) < 60 && Math.abs(e.z - j.z) < 60; // longe: nem desenha nem anima
    e.vis.raiz.visible = perto; if (!perto) continue;
    e.vis.raiz.position.x = e.x; e.vis.raiz.position.z = e.z; e.vis.raiz.rotation.y = e.ang;
    e.vis.mixer.update(dt * (e.lento > 0 ? 0.6 : 1)); e.vis.brilho(e.flash > 0 ? 0.35 : e.lento > 0 ? 0.12 : 0);
  }
  for (const t of G.txt) t.t += dt; G.txt = G.txt.filter(t => t.t < 1.1);
  G.salvarT = (G.salvarT || 0) + dt; if (G.salvarT > 8) { G.salvarT = 0; salvar(); }
}
export { RARIDADES };
