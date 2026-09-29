// Mapa do mundo em 3D (estilo modo conquista): regiões com terreno próprio, acampamentos de monstros
// (os papéis do quadro de missões) e os heróis marchando até lá, lutando e voltando.
import * as C from './cena.js';
import * as E from './estado.js';
import { S } from './estado.js';
import { REGIOES, missao } from './dados.js';
import { animAtaque } from './aparencia.js';

export const MUNDO = { x: 900, z: 0 };
const ESC = 3.4; // 1 unidade do mapa (0–100) = 3,4 m
const W = (px, py) => ({ x: MUNDO.x + (px - 50) * ESC, z: MUNDO.z + (py - 50) * ESC });
export const GUILDA_W = W(8, 94);
const CENTROS = REGIOES.map(r => W(r.x, r.y));
const ESTILO = [
  { chao: '#2f6a2a', pecas: ['N:tree_pineTallA', 'N:tree_pineRoundB', 'N:tree_oak_dark', 'N:tree_pineRoundD', 'N:tree_pineSmallA'], s: 5 },
  { chao: '#4a5a2a', pecas: ['N:tree_default_dark', 'N:tree_blocks_dark', 'N:lily_large', 'N:rock_largeA', 'N:mushroom_redGroup'], s: 5 },
  { chao: '#c9d2da', pecas: ['N:rock_tallA', 'N:rock_largeC', 'N:cliff_block_rock', 'N:rock_tallE', 'N:tree_pineSmallA'], s: 6 },
  { chao: '#e2c27e', pecas: ['N:cactus_tall', 'N:cactus_short', 'N:tree_palmTall', 'N:rock_largeD', 'N:tree_palmShort'], s: 5 },
  { chao: '#8a9a7a', pecas: ['N:statue_column', 'N:statue_columnDamaged', 'N:statue_head', 'N:statue_obelisk', 'N:tree_blocks_fall'], s: 5 },
  { chao: '#3a2a26', pecas: ['N:rock_tallJ', 'N:rock_tallA', 'N:cliff_block_rock', 'N:rock_largeC'], s: 6 },
  { chao: '#4a4a5a', pecas: ['N:tree_blocks_dark', 'N:statue_obelisk', 'N:tree_default_dark', 'N:stone_tallB'], s: 5 },
  { chao: '#3a2a3a', pecas: ['C:tower-square', 'C:wall', 'C:tower-hexagon-base', 'N:rock_tallJ'], s: 4 },
];
// trilha: guilda → região 0 → 1 → ...
const TRILHA = [GUILDA_W, ...CENTROS];
function distSeg(p, a, b) { const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz))); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); }
const pertoTrilha = p => { for (let i = 1; i < TRILHA.length; i++) if (distSeg(p, TRILHA[i - 1], TRILHA[i]) < 7) return true; return false; };

let montado = false, visivel = false;
export function montarMundoMapa() {
  if (montado) return; montado = true;
  const TAM = 420;
  C.chaoPintado(MUNDO.x, MUNDO.z, TAM, (g, P) => {
    g.fillStyle = '#5c8f3a'; g.fillRect(0, 0, 2048, 2048);
    let sd = 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 7000; i++) { g.fillStyle = `hsla(${85 + r() * 25},40%,${30 + r() * 12}%,.3)`; g.beginPath(); g.arc(r() * 2048, r() * 2048, 3 + r() * 12, 0, 7); g.fill(); }
    CENTROS.forEach((c, i) => {
      const gr = g.createRadialGradient(P(c.x), P(c.z, 'z'), 0, P(c.x), P(c.z, 'z'), 34 * 2048 / TAM);
      gr.addColorStop(0, ESTILO[i].chao); gr.addColorStop(0.7, ESTILO[i].chao); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 2048, 2048);
      if (i === 5) { g.strokeStyle = '#ff6a1a'; g.lineWidth = 6; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(P(c.x), P(c.z, 'z')); g.lineTo(P(c.x + (r() - 0.5) * 50), P(c.z + (r() - 0.5) * 50, 'z')); g.stroke(); } }
    });
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [cor, w] of [['#6a4a26', 7], ['#b89a64', 5]]) { g.strokeStyle = cor; g.lineWidth = w * 2048 / TAM; g.beginPath(); TRILHA.forEach((p, i) => i ? g.lineTo(P(p.x), P(p.z, 'z')) : g.moveTo(P(p.x), P(p.z, 'z'))); g.stroke(); }
  });
  let sd = 11; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const L = [];
  // cenário de cada região (com uma clareira no meio para os acampamentos)
  CENTROS.forEach((c, i) => {
    const e = ESTILO[i];
    for (let k = 0; k < 34; k++) {
      const a = rnd() * 6.28, d = 14 + rnd() * 18, p = { x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d };
      if (pertoTrilha(p)) continue;
      L.push({ m: e.pecas[Math.floor(rnd() * e.pecas.length)], x: p.x, z: p.z, ry: rnd() * 6.28, s: e.s * (0.8 + rnd() * 0.5) });
    }
  });
  // árvores e pedras no resto do mapa
  for (let k = 0; k < 260; k++) {
    const p = { x: MUNDO.x + (rnd() - 0.5) * TAM * 0.95, z: MUNDO.z + (rnd() - 0.5) * TAM * 0.95 };
    if (pertoTrilha(p) || CENTROS.some(c => Math.hypot(c.x - p.x, c.z - p.z) < 36) || Math.hypot(GUILDA_W.x - p.x, GUILDA_W.z - p.z) < 22) continue;
    L.push({ m: rnd() < 0.8 ? ['N:tree_oak', 'N:tree_default', 'N:tree_pineRoundB', 'N:tree_fat'][Math.floor(rnd() * 4)] : 'N:rock_largeA', x: p.x, z: p.z, ry: rnd() * 6.28, s: 5 + rnd() * 2 });
  }
  // a sua guilda no mapa
  const g = GUILDA_W;
  L.push({ m: 'C:tower-square', x: g.x, z: g.z, s: 5 }, { m: 'C:flag', x: g.x, y: 10, z: g.z, s: 4 }, { m: 'C:wall', x: g.x - 5, z: g.z, s: 5, ry: Math.PI / 2 }, { m: 'C:wall', x: g.x + 5, z: g.z, s: 5, ry: Math.PI / 2 },
    { m: 'T:banner-red', x: g.x + 3, z: g.z - 4, s: 3 }, { m: 'N:tent_detailedOpen', x: g.x - 8, z: g.z - 8, s: 4 });
  C.montarEstatico(L);
}

// ---------------- acampamentos e marchas ----------------
const campos = {}; // id do papel ou da missão → { vis, x, z }
const marchas = {}; // uid da missão → { herois: [{id, v}] }
const MODELO = [['lacaio', [['lamina', 'r']], 1], ['batedor', [['besta', 'r']], 1], ['guerreiro', [['machado', 'r'], ['escudoP', 'l']], 1.15], ['guerreiro', [['machado', 'r'], ['escudoG', 'l']], 2]];
// acampamento numa clareira em volta do centro da região, fora da estrada
export function posCampo(r, dx, dy) {
  const c = CENTROS[r]; let a = Math.atan2(dy || 0.3, dx || 0.3); const d = 12 + Math.abs(dx || 0) * 0.9;
  for (let k = 0; k < 12; k++, a += 0.52) { const p = { x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d }; if (!pertoTrilha(p)) return p; }
  return { x: c.x + d, z: c.z };
}
export const ESC_MUNDO = 1.7; // unidades maiores no mapa (como nos jogos de conquista)
function criarCampo(chave, r, t, dx, dy) {
  const p = posCampo(r, dx, dy), [mod, armas, esc] = MODELO[t], v = C.personagem(mod, armas, esc); v.raiz.scale.setScalar(ESC_MUNDO);
  v.raiz.position.set(p.x, 0, p.z); v.raiz.rotation.y = Math.atan2(GUILDA_W.x - p.x, GUILDA_W.z - p.z); v.tocar(v.tem('Idle_Combat') ? 'Idle_Combat' : 'Idle');
  const fogo = C.objeto('N:campfire_logs', 6); fogo.position.set(p.x + 4, 0, p.z + 2.5);
  const tenda = C.objeto('N:tent_detailedOpen', 5); tenda.position.set(p.x - 4.5, 0, p.z - 3); tenda.rotation.y = Math.random() * 6;
  return (campos[chave] = { v, fogo, tenda, x: p.x, z: p.z, r, t });
}
function tirarCampo(chave) { const c = campos[chave]; if (!c) return; c.v.remover(); C.remover(c.fogo); C.remover(c.tenda); delete campos[chave]; }
// posição na trilha até o acampamento (f de 0 a 1)
function caminho(r, alvo) { return [...TRILHA.slice(0, r + 2), alvo]; }
function ponto(pts, f) {
  const seg = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); seg.push(d); tot += d; }
  let a = Math.max(0, Math.min(1, f)) * tot;
  for (let i = 0; i < seg.length; i++) { if (a <= seg[i] || i === seg.length - 1) { const k = seg[i] ? Math.min(1, a / seg[i]) : 1; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, z: pts[i].z + (pts[i + 1].z - pts[i].z) * k }; } a -= seg[i]; }
  return pts[pts.length - 1];
}

export function mostrarMundo(v) { visivel = v; }
export const mundoVisivel = () => visivel;
export const camposVisiveis = () => Object.entries(campos);

export function atualizarMundo(dt) {
  if (!montado) return;
  const agora = Date.now(), vivos = new Set();
  // papéis do quadro = acampamentos esperando heróis
  for (const q of S.quadro || []) { if (q.emLuta) continue; vivos.add(q.id); if (!campos[q.id]) criarCampo(q.id, q.r, q.t, q.dx, q.dy).q = q; }
  // missões em andamento
  for (const ms of S.missoes) {
    const ck = 'm' + ms.uid; vivos.add(ck);
    const campo = campos[ck] || criarCampo(ck, ms.r, ms.t, ms.dx, ms.dy);
    let mc = marchas[ms.uid];
    if (!mc) mc = marchas[ms.uid] = { herois: ms.herois.map(id => { const h = E.heroi(id); const v = C.heroi(h.visual); v.raiz.scale.setScalar(ESC_MUNDO); v.raiz.position.set(GUILDA_W.x, 0, GUILDA_W.z); return { id, v, h }; }) };
    const k = Math.min(1, (agora - ms.inicio) / (ms.fim - ms.inicio)), fase = k < 0.35 ? 'ida' : k < 0.75 ? 'luta' : 'volta';
    const pts = caminho(ms.r, { x: campo.x, z: campo.z + 3 });
    mc.herois.forEach((hh, i) => {
      const v = hh.v; let p, ang;
      if (fase === 'luta') {
        const a = (i / mc.herois.length) * Math.PI * 1.2 - 0.6 + Math.atan2(GUILDA_W.x - campo.x, GUILDA_W.z - campo.z);
        p = { x: campo.x + Math.sin(a) * 5, z: campo.z + Math.cos(a) * 5 }; ang = Math.atan2(campo.x - p.x, campo.z - p.z);
        const fim = k > 0.72; v.tocar(fim && !ms.ok ? 'Hit_A' : fim && ms.ok ? 'Cheering' : animAtaque(hh.h.visual), { loop: true });
      } else {
        const f = fase === 'ida' ? k / 0.35 - i * 0.02 : 1 - (k - 0.75) / 0.25 - i * 0.02;
        p = ponto(pts, f); const p2 = ponto(pts, f + (fase === 'ida' ? 0.01 : -0.01)); ang = Math.atan2(p2.x - p.x, p2.z - p.z);
        const lado = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 1.8; p = { x: p.x + Math.cos(ang) * lado, z: p.z - Math.sin(ang) * lado };
        v.tocar(ms.fim - ms.inicio < 60e3 ? 'Running_A' : 'Walking_A');
      }
      v.raiz.position.set(p.x, 0, p.z); v.raiz.rotation.y = ang;
      if (visivel) v.mixer.update(dt);
    });
    // o monstro luta e cai (ou vence) no fim da luta
    const ev = campo.v;
    if (fase === 'luta') { ev.raiz.visible = true; if (k > 0.72 && ms.ok) { if (!campo.morto) { campo.morto = true; ev.tocar('Death_A', { loop: false, reinicia: true }); C.faiscas(campo.x, 1.5, campo.z, 0xffd84a, 30, 5); } } else ev.tocar(MODELO[ms.t][0] === 'batedor' ? '2H_Ranged_Shoot' : '1H_Melee_Attack_Chop'); }
    else if (fase === 'volta' && ms.ok) ev.raiz.visible = false;
  }
  for (const [uid, mc] of Object.entries(marchas)) if (!S.missoes.some(m => m.uid === uid)) { for (const hh of mc.herois) hh.v.remover(); delete marchas[uid]; }
  for (const chave of Object.keys(campos)) if (!vivos.has(chave)) tirarCampo(chave);
  if (visivel) for (const c of Object.values(campos)) c.v.mixer.update(dt);
}
