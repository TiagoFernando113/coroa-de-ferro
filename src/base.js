// A sede da guilda em 3D: prédios (visual muda com o nível), decoração e heróis passeando.
import * as C from './cena.js';
import { EDIFICIOS, CLASSES } from './dados.js';
import { S, nivel, renda } from './estado.js';
import { visivel, proximoTrancado } from './etapas.js';
import { visualAleatorio, animAtaque } from './aparencia.js';

const P = Math.PI;
export const PORTAO = { x: 0, z: 30 };
const R_ANEL = 16;
// prédios num anel ao redor da praça (ângulo 90° = sul, onde fica o portão)
const ANG = { treino: 170, taverna: -145, alojamento: -108, portal: -72, biblioteca: -36, forja: 0, enfermaria: 40, mercado: 135 };
export const POS = {};
for (const [k, a] of Object.entries(ANG)) { const t = a * P / 180; POS[k] = { x: Math.cos(t) * R_ANEL, z: Math.sin(t) * R_ANEL }; }
POS.quadro = { x: 6.5, z: 6.5 };
for (const k of Object.keys(POS)) POS[k].ry = Math.atan2(-POS[k].x, -POS[k].z); // frente para a praça

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// casa modular (kit da vila): frente em +z local
function casa(L, { prof = 2, madeira = false, S = 3, x = 0, z = 0, chamine = true }) {
  const W = madeira ? 'T:wall-wood' : 'T:wall', PORTA = W + '-door', JAN = W + '-window-shutters';
  const put = (m, lx, ly, lz, ry) => L.push({ m, x: x + lx * S, y: ly * S, z: z + lz * S, ry, s: S });
  const zs = []; for (let i = 0; i < prof; i++) zs.push(i - (prof - 1) / 2);
  const zMax = zs[zs.length - 1], zMin = zs[0];
  for (const zz of zs) { put(zz === zMax ? W : JAN, 0.5, 0, zz, 0); put(zz === zMin ? JAN : W, -0.5, 0, zz, P); put('T:roof', -0.5, 1, zz, 0); put('T:roof', 0.5, 1, zz, P); }
  put(PORTA, 0.5, 0, zMax, -P / 2); put(JAN, -0.5, 0, zMax, -P / 2); put(W, -0.5, 0, zMin, P / 2); put(JAN, 0.5, 0, zMin, P / 2);
  if (chamine) put('T:chimney', -0.3, 1.2, zMin, 0);
}
// peças de cada prédio por estágio (1: nv 1-24, 2: 25-99, 3: 100+); 0 = em obras/bloqueado
export const estagioEd = n => n <= 0 ? 0 : n < 25 ? 1 : n < 100 ? 2 : 3;
function pecasEd(id, t) {
  const L = [];
  if (t === 0) { L.push({ m: 'T:planks', s: [5, 1, 5] }, { m: 'N:log_stack', x: -1.8, z: -1.2, s: 4 }, { m: 'N:sign', x: 1.6, z: 1.8, s: 3.5 }); return L; }
  switch (id) {
    case 'taverna':
      casa(L, { prof: t === 1 ? 2 : 3, madeira: true, S: t === 3 ? 3.6 : 3.2 });
      L.push({ m: 'T:banner-red', x: 3.8, z: 3.6, s: 2.6 }, { m: 'D:barrel', x: -4.2, z: 3, s: 2.4 }, { m: 'D:barrel', x: -4.6, z: 1.6, s: 2.2 });
      if (t >= 2) L.push({ m: 'T:stall-bench', x: 0, z: 5.8, s: 2.6 }, { m: 'T:lantern', x: 4.2, z: 5.6, s: 2.2 }, { m: 'T:lantern', x: -4.2, z: 5.6, s: 2.2 });
      if (t >= 3) L.push({ m: 'T:cart', x: 5.6, z: 0, ry: 0.4, s: 2.6 }, { m: 'C:flag', x: 0, y: 7.2, z: 0, s: 3.5 });
      break;
    case 'alojamento':
      if (t === 1) L.push({ m: 'N:tent_detailedOpen', x: -2, s: 5.5, ry: P }, { m: 'N:tent_detailedOpen', x: 2.4, z: 0.4, s: 5, ry: P });
      else { casa(L, { prof: t === 2 ? 2 : 3, madeira: false, S: 3.1 }); if (t === 3) L.push({ m: 'N:tent_detailedOpen', x: 5.2, z: 1, s: 5, ry: P }); }
      L.push({ m: 'N:campfire_stones', x: 0, z: 4.5, s: 4 }, { m: 'N:campfire_logs', x: 0, z: 4.5, s: 3 });
      break;
    case 'portal': {
      const Sh = 2.4, alt = t;
      for (const x of [-2.8, 2.8]) { let y = 0; L.push({ m: 'C:tower-hexagon-base', x, s: Sh }); y += 1.31 * Sh; for (let i = 0; i < alt; i++) { L.push({ m: 'C:tower-hexagon-mid', x, y, s: Sh }); y += 0.46 * Sh; } L.push({ m: 'C:tower-hexagon-top', x, y, s: Sh }); if (t >= 2) L.push({ m: 'C:tower-hexagon-roof', x, y: y + 0.13 * Sh, s: Sh }); }
      L.anel = { y: 2.6 + t * 0.3, r: 1.8 + t * 0.2 };
      break;
    }
    case 'quadro':
      L.push({ m: 'T:pillar-wood', x: -1.4, s: [2.2, 2.4, 2.2] }, { m: 'T:pillar-wood', x: 1.4, s: [2.2, 2.4, 2.2] }, { m: 'N:sign', y: 0.2, s: 5 });
      if (t >= 2) L.push({ m: 'D:table', x: 0, z: 2.2, s: 3 }, { m: 'D:banner', x: -2.4, z: 0, s: 2.6 });
      if (t >= 3) L.push({ m: 'C:flag-banner-long', x: 2.6, z: -0.5, s: 2 });
      break;
    case 'treino':
      for (let i = -1; i <= 1; i++) { L.push({ m: 'T:fence', x: i * 3, z: -4.5, ry: P / 2, s: 3 }); L.push({ m: 'T:fence', x: -4.5, z: i * 3, ry: 0, s: 3 }); }
      L.push({ m: 'N:stump_round', x: -1.5, z: -1.5, s: 5 }, { m: 'D:shield-round', x: -1.5, y: 0.9, z: -1.5, s: 3.2 }, { m: 'D:weapon-sword', x: 2.5, z: -3, s: 3 });
      if (t >= 2) L.push({ m: 'N:stump_round', x: 1.8, z: -1, s: 5 }, { m: 'D:shield-round', x: 1.8, y: 0.9, z: -1, s: 3.2 });
      if (t >= 3) L.push({ m: 'D:banner', x: -3.8, z: 3.5, s: 3 }, { m: 'C:flag', x: 3.8, z: -3.8, s: 3.5 });
      break;
    case 'forja':
      if (t === 1) L.push({ m: 'T:stall-red', s: 3.2 }, { m: 'T:chimney', x: 1.2, y: 3.6, s: 3 });
      else casa(L, { prof: t === 2 ? 2 : 3, madeira: false, S: 3 });
      L.push({ m: 'D:barrel', x: 3.4, z: 2.4, s: 2.3 }, { m: 'D:weapon-sword', x: -3.2, z: 2.8, s: 3 }, { m: 'D:shield-round', x: -3.8, y: 0.3, z: 1.5, s: 3 });
      if (t >= 3) L.push({ m: 'C:flag', x: 3.8, z: -2, s: 3.5 });
      break;
    case 'mercado':
      L.push({ m: 'T:stall-red', x: -2.2, s: 2.8 }, { m: 'T:stall-green', x: 2.2, s: 2.8 });
      if (t >= 2) L.push({ m: 'T:cart', x: 0, z: 3.4, ry: 0.2, s: 2.4 }, { m: 'D:barrel', x: -4.2, z: 2, s: 2.2 });
      if (t >= 3) L.push({ m: 'T:stall-red', x: 0, z: -3.2, s: 2.8 }, { m: 'T:banner-red', x: 4.4, z: 2.2, s: 2.6 });
      break;
    case 'enfermaria':
      if (t === 1) L.push({ m: 'N:tent_detailedOpen', s: 6, ry: P });
      else casa(L, { prof: 2, madeira: true, S: t === 2 ? 3 : 3.4 });
      L.push({ m: 'D:potion', x: 3.4, z: 3, s: 3 }, { m: 'D:potion', x: 2.6, z: 3.6, s: 2.2 });
      if (t >= 3) L.push({ m: 'D:banner', x: -3.6, z: 3, s: 3 });
      break;
    case 'biblioteca': {
      const Sh = 3.2; let y = 0; L.push({ m: 'C:tower-hexagon-base', s: Sh }); y += 1.31 * Sh;
      for (let i = 0; i < t; i++) { L.push({ m: 'C:tower-hexagon-mid', y, s: Sh }); y += 0.46 * Sh; }
      L.push({ m: 'C:tower-hexagon-top', y, s: Sh }, { m: 'C:tower-hexagon-roof', y: y + 0.13 * Sh, s: Sh });
      L.push({ m: 'D:table', x: 3, z: 2.6, s: 2.6 });
      break;
    }
  }
  return L;
}

const vis = {}; // id → { grupo, estagio, anel }
export function atualizarPredio(id, forcar = false) {
  const n = nivel(id), t = visivel(id) ? estagioEd(n) : id === proximoTrancado() ? 0 : -1, v = vis[id]; // -1: ainda escondido
  if (v && v.estagio === t && !forcar) return;
  if (v) { if (v.grupo) C.remover(v.grupo); if (v.anel) C.remover(v.anel); }
  const p = POS[id];
  if (t < 0) { vis[id] = { grupo: null, estagio: t, anel: null }; return; }
  const L = pecasEd(id, t);
  const g = C.grupo(L, p.x, p.z, id); g.rotation.y = p.ry;
  let anel = null; if (L.anel) anel = C.anel(p.x, L.anel.y, p.z, L.anel.r); if (anel) anel.rotation.y = p.ry;
  vis[id] = { grupo: g, estagio: t, anel };
  if (v) { C.faiscas(p.x, 3, p.z, 0xffd84a, 40, 5); C.onda(p.x, p.z, 7, 0xffd84a, 0.6); }
}
export function montarBase() {
  const L = [], caminhos = [], r = rng(5);
  // caminhos da praça até cada prédio e até o portão
  for (const [k, p] of Object.entries(POS)) if (k !== 'quadro') caminhos.push({ w: 2.6, pts: [[p.x * 0.45, p.z * 0.45], [p.x * 0.78, p.z * 0.78]] });
  caminhos.push({ w: 4, pts: [[0, 7], [0, PORTAO.z + 6]] });
  L.push({ m: 'T:fountain-round', x: 0, z: 0, s: 2.2 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * P * 2 + P / 8; L.push({ m: 'T:lantern', x: Math.cos(a) * 8.4, z: Math.sin(a) * 8.4, s: 2.1 }); }
  // muralhinha de madeira em volta e portão
  for (let a = 0; a < 360; a += 7) {
    const t = a * P / 180, x = Math.cos(t) * 29, z = Math.sin(t) * 29; if (Math.abs(x) < 4 && z > 0) continue;
    L.push({ m: 'T:fence', x, z, ry: -t, s: 3 });
  }
  L.push({ m: 'C:tower-square-base', x: -4.5, z: 29, s: 2.4 }, { m: 'C:tower-square-top', x: -4.5, y: 2.42, z: 29, s: 2.4 }, { m: 'C:flag', x: -4.5, y: 3.1, z: 29, s: 3 });
  L.push({ m: 'C:tower-square-base', x: 4.5, z: 29, s: 2.4 }, { m: 'C:tower-square-top', x: 4.5, y: 2.42, z: 29, s: 2.4 }, { m: 'C:flag', x: 4.5, y: 3.1, z: 29, s: 3 });
  // floresta em volta
  const ARV = ['N:tree_oak', 'N:tree_default', 'N:tree_fat', 'N:tree_pineTallA', 'N:tree_pineRoundB', 'N:tree_detailed', 'N:tree_oak_dark'];
  for (let i = 0; i < 260; i++) {
    const a = r() * P * 2, d = 33 + r() * 30, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.abs(x) < 6 && z > 28) continue;
    L.push({ m: ARV[Math.floor(r() * ARV.length)], x, z, ry: r() * 6, s: 4.5 + r() * 2 });
  }
  for (let i = 0; i < 26; i++) { const a = r() * P * 2, d = 20 + r() * 8; L.push({ m: r() < 0.5 ? 'N:plant_bushLarge' : 'N:rock_largeA', x: Math.cos(a) * d, z: Math.sin(a) * d, ry: r() * 6, s: 3 + r() * 1.5 }); }
  const ENF = ['N:grass', 'N:grass_large', 'N:flower_redA', 'N:flower_yellowA', 'N:flower_purpleA'];
  for (let i = 0; i < 500; i++) {
    const a = r() * P * 2, d = 9 + r() * 50, x = Math.cos(a) * d, z = Math.sin(a) * d;
    let ok = true; for (const p of Object.values(POS)) if (Math.hypot(x - p.x, z - p.z) < 7) ok = false; if (Math.abs(x) < 3 && z > 6) ok = false; if (!ok) continue;
    L.push({ m: ENF[Math.floor(r() * ENF.length)], x, z, ry: r() * 6, s: 3 + r() * 1.2 });
  }
  C.montarMundo({ tam: 130, pecas: L, caminhos, pracas: [{ x: 0, z: 0, r: 10 }] });
  for (const id of Object.keys(EDIFICIOS)) atualizarPredio(id, true);
}

// ---------------- heróis passeando ----------------
const pers = {}; // id do herói → { v, x, z, ang, alvo, espera, fora }
// o que cada herói faz ao chegar num lugar da guilda
const sorte = l => l[Math.floor(Math.random() * l.length)];
function animLocal(oq, h) {
  if (h.estado === 'ferido') return oq === 'enfermaria' ? 'Lie_Idle' : 'Sit_Floor_Idle';
  switch (oq) {
    case 'treino': return sorte([animAtaque(h.visual), animAtaque(h.visual), 'Push_Ups', 'Sit_Ups']);
    case 'taverna': return sorte(['Cheering', 'Sit_Floor_Idle', 'Idle_B', 'Waving']);
    case 'forja': return sorte(['Hammering', 'Working_A']);
    case 'quadro': case 'mercado': case 'biblioteca': return 'Interact';
    case 'portal': return 'Ranged_Magic_Spellcasting';
  }
  return sorte(['Idle_A', 'Idle_B']);
}
// herói editado no criador: troca as peças do boneco
export function revestir(id) { const p = pers[id], h = S.herois.find(x => x.id === id); if (p && h) p.v.vestir(h.visual); }
function destino(h) {
  if (h.estado === 'ferido') { const p = POS.enfermaria; return { x: p.x * 0.7 + (Math.random() - 0.5) * 3, z: p.z * 0.7 + (Math.random() - 0.5) * 3, oq: 'ferido' }; }
  const ops = Object.keys(POS).filter(k => visivel(k) && nivel(k) > 0);
  const k = ops[Math.floor(Math.random() * ops.length)] || 'taverna', p = POS[k];
  const f = k === 'quadro' ? 0.5 : 0.62;
  return { x: p.x * f + (Math.random() - 0.5) * 4, z: p.z * f + (Math.random() - 0.5) * 4, oq: k };
}
export function atualizarHerois(dt) {
  const ids = new Set(S.herois.map(h => h.id));
  for (const id of Object.keys(pers)) if (!ids.has(id)) { pers[id].v.remover(); delete pers[id]; }
  for (const h of S.herois) {
    let p = pers[h.id];
    if (!p) {
      const v = C.heroi(h.visual || (h.visual = visualAleatorio(h.cls)));
      const vindo = h.estado !== 'missao';
      p = pers[h.id] = { v, x: vindo ? PORTAO.x : 0, z: vindo ? PORTAO.z : 0, ang: P, alvo: null, espera: 0, fora: !vindo };
      if (!vindo) v.raiz.visible = false;
      if (h.rar === 3) p.aura = C.anel(0, 0.05, 0, 0.7, 0xffb02e), p.aura.rotation.x = -P / 2;
    }
    const v = p.v;
    if (h.estado === 'missao') { // vai até o portão e some
      if (!p.fora) { p.alvo = { x: PORTAO.x, z: PORTAO.z + 3, oq: 'sair' }; if (Math.hypot(p.x - PORTAO.x, p.z - PORTAO.z - 3) < 1) { p.fora = true; v.raiz.visible = false; if (p.aura) p.aura.visible = false; } }
    } else if (p.fora) { p.fora = false; p.x = PORTAO.x; p.z = PORTAO.z + 2; p.alvo = null; v.raiz.visible = true; if (p.aura) p.aura.visible = true; }
    if (p.fora) continue;
    if (!p.alvo) { p.espera -= dt; if (p.espera <= 0) p.alvo = destino(h); }
    if (p.alvo) {
      const dx = p.alvo.x - p.x, dz = p.alvo.z - p.z, d = Math.hypot(dx, dz), vel = h.estado === 'ferido' ? 0.9 : p.alvo.oq === 'sair' ? 3.2 : 1.6;
      if (d < 0.3) {
        p.chegou = p.alvo.oq; p.alvo = null; p.espera = 3 + Math.random() * 7;
        v.tocar(animLocal(p.chegou, h), { loop: true });
      } else {
        // contorna a fonte da praça
        let tx = dx / d, tz = dz / d; const cd = Math.hypot(p.x, p.z); if (cd < 4.5) { tx += p.x / cd * 0.8; tz += p.z / cd * 0.8; }
        p.x += tx * vel * dt; p.z += tz * vel * dt; p.ang += Math.atan2(Math.sin(Math.atan2(tx, tz) - p.ang), Math.cos(Math.atan2(tx, tz) - p.ang)) * Math.min(1, dt * 8);
        v.tocar(vel > 2 ? 'Running_A' : 'Walking_A', { vel: vel > 2 ? 1 : 0.9 });
      }
    }
    v.raiz.position.set(p.x, 0, p.z); v.raiz.rotation.y = p.ang; v.mixer.update(dt);
    if (p.aura) p.aura.position.set(p.x, 0.05, p.z);
  }
}
export const posHeroi = id => pers[id] && !pers[id].fora ? pers[id] : null;

// moedinhas saindo da taverna (retorno visual da renda)
let moedaT = 0; const moedas = [];
export function efeitosBase(dt, texto) {
  moedaT -= dt;
  if (moedaT <= 0 && nivel('taverna') > 0) {
    moedaT = 2; const p = POS.taverna, o = C.objeto('D:coin', 1.6); o.position.set(p.x * 0.8, 4, p.z * 0.8); moedas.push({ o, t: 0 });
    texto && texto(p.x * 0.8, 5.5, p.z * 0.8, renda() * 2);
  }
  for (let i = moedas.length - 1; i >= 0; i--) { const m = moedas[i]; m.t += dt; m.o.position.y = 4 + m.t * 2; m.o.rotation.y += dt * 6; if (m.t > 1) { C.remover(m.o); moedas.splice(i, 1); } }
  for (const v of Object.values(vis)) if (v.anel) v.anel.children[1].material.opacity = 0.25 + 0.15 * Math.sin(C.tempo() * 3);
}
