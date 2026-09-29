// Modo manual: você controla o líder no mapa do mundo (joystick), vai até o acampamento e luta.
// Os outros heróis da equipe seguem e lutam sozinhos. Vencer todos os monstros cumpre a missão.
import * as C from './cena.js';
import * as E from './estado.js';
import { S } from './estado.js';
import { missao, REGIOES, CLASSES, fmt } from './dados.js';
import { armaInfo, animAtaque } from './aparencia.js';
import { GUILDA_W, posCampo, ESC_MUNDO } from './mundo.js';
import { ico, som, ui } from './ui.js';
import { gerarItem, sortearRaridade, atributosEquip, RARIDADE_ITEM } from './itens.js';

const $ = s => document.querySelector(s);
const difAng = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
let L = null;
export const emLuta = () => !!L;
window.__luta = () => L; // para testes

// monstros de cada tipo de missão: [modelo, armas, escala, vida, dano, alcance, distância?]
const TIPOS = {
  lacaio: ['lacaio', [['lamina', 'r']], 1, 100, 8, 2.4, false],
  batedor: ['batedor', [['besta', 'r']], 1, 80, 7, 13, true],
  guerreiro: ['guerreiro', [['machado', 'r'], ['escudoP', 'l']], 1.15, 180, 12, 2.6, false],
  chefe: ['guerreiro', [['machado', 'r'], ['escudoG', 'l']], 2, 900, 22, 3.6, false],
};
// animais das emboscadas: [modelo, escala, vida, dano, anim de ataque]
const BICHOS = { lobo: ['bicho:Wolf', 1, 90, 9, 'Attack'], raposa: ['bicho:Fox', 0.9, 60, 7, 'Attack'], touro: ['bicho:Bull', 1, 220, 14, 'Attack_Headbutt'],
  cervo: ['bicho:Stag', 1, 160, 11, 'Attack_Headbutt'], husky: ['bicho:Husky', 1, 120, 10, 'Attack'] };
// encontros no caminho (como nos animes de MMO): bando comum, monstro raro ou um Monstro Único com nome
const ENCONTROS = [
  { txt: 'Um bando de lobos cercou você!', grupo: [['lobo'], ['lobo'], ['lobo']], peso: 5 },
  { txt: 'Raposas ladras no caminho!', grupo: [['raposa'], ['raposa']], peso: 3 },
  { txt: 'Um LOBO FEROZ apareceu!', grupo: [['lobo', 'Lobo Feroz', 1.7, 4, 0x8a2a2a]], peso: 3, raro: true },
  { txt: 'Um TOURO SELVAGEM investe contra você!', grupo: [['touro', 'Touro Selvagem', 1.5, 3, 0x6a3a2a]], peso: 2, raro: true },
  { txt: 'MONSTRO ÚNICO: Fenrir, o Lobo do Crepúsculo!', grupo: [['husky', 'Fenrir, o Lobo do Crepúsculo', 2.6, 12, 0x3a2a6a]], peso: 0.5, unico: true },
  { txt: 'MONSTRO ÚNICO: Cervo Espectral de Prata!', grupo: [['cervo', 'Cervo Espectral de Prata', 2.2, 10, 0x9ad8ff]], peso: 0.5, unico: true },
];
const GRUPOS = [['lacaio', 'lacaio'], ['lacaio', 'batedor', 'lacaio'], ['guerreiro', 'batedor', 'lacaio', 'lacaio', 'batedor'], ['chefe', 'lacaio', 'lacaio']];
const alcanceArma = v => ({ arco: 14, besta: 13, magia: 12 }[armaInfo(v.arma).tipo] || 2.8);

export function iniciarLuta(qid, ids, aoFim) {
  const q = S.quadro.find(x => x.id === qid); if (!q || L) return false;
  ids = ids.filter(id => E.heroi(id)?.estado === 'livre'); if (!ids.length) return false;
  const guiaId = ids[0]; // o primeiro escolhido comanda a equipe
  const m = missao(q.r, q.t), razao = Math.max(0.2, E.poderEquipe(ids, q.r) / m.req), forca = Math.sqrt(razao);
  q.emLuta = true; for (const id of ids) E.heroi(id).estado = 'missao';
  const campo = posCampo(q.r, q.dx, q.dy), s = E.sis();
  const mk = (h, x, z) => { const v = C.heroi(h.visual); v.raiz.scale.setScalar(ESC_MUNDO); v.raiz.position.set(x, 0, z); v.tocar('Idle_A'); return { h, v, x, z, ang: 0, cd: 0, alc: alcanceArma(h.visual) }; };
  const lider = mk(E.heroi(guiaId), GUILDA_W.x + 6, GUILDA_W.z - 6);
  const eq = guiaId === S.lider ? atributosEquip(S.equip) : { atk: 0, vida: 0, crit: 0, def: 0, vel: 0 };
  lider.max = lider.hp = 120 + (guiaId === S.lider ? s.a.vit * 8 : 0) + eq.vida; lider.dano = 26 * forca * (1 + eq.atk / 100); lider.cds = [0, 0, 0];
  lider.crit = 0.12 + eq.crit / 100; lider.def = Math.min(0.6, eq.def / 100); lider.vel = Math.min(0.5, eq.vel / 100);
  const aliados = ids.filter(id => id !== guiaId).map((id, i) => { const a = mk(E.heroi(id), lider.x - 3 - i * 2, lider.z + 3); a.dano = 12 * forca; return a; });
  const inimigos = GRUPOS[q.t].map((tp, i) => {
    const [mod, armas, esc, vida, dano, alc, longe] = TIPOS[tp], v = C.personagem(mod, armas, esc); v.raiz.scale.setScalar(ESC_MUNDO * (tp === 'chefe' ? 1 : 1));
    const a = i * 2.1, x = campo.x + Math.cos(a) * (i ? 5 : 0), z = campo.z + Math.sin(a) * (i ? 5 : 0);
    v.raiz.position.set(x, 0, z); v.tocar(v.tem('Idle_Combat') ? 'Idle_Combat' : 'Idle');
    return { tp, v, x, z, hp: vida, max: vida, dano: dano / forca, alc, longe, cd: 1 + Math.random(), ang: 0, acordado: false, chefe: tp === 'chefe' };
  });
  L = { q, ids, lider, aliados, inimigos, proj: [], txt: [], joy: null, mx: 0, mz: 0, t: 0, campo, aoFim, fim: false, reg: REGIOES[q.r], m, forca, loot: [],
    distTotal: Math.hypot(campo.x - lider.x, campo.z - lider.z), emboscada: Math.random() < 0.6 + q.rank * 0.05 ? 0.35 + Math.random() * 0.3 : null };
  ui.foco = { x: lider.x, z: lider.z }; C.camera.dist = 44; C.camera.pitch = 0.9; C.camera.yaw = Math.PI - 0.3; C.camera.suave = 8;
  montarHud(); som('enviar');
  return true;
}

// ---------------- HUD e controles ----------------
function montarHud() {
  $('#hud').style.visibility = 'hidden';
  const el = document.createElement('div'); el.id = 'luta';
  el.innerHTML = `<div class="lTopo"><button class="btn vermelho peq" data-l="sair">${ico('sair')} Desistir</button>
      <div class="lMissao"><b>${L.q.nome}</b><small>${ico(L.reg.icone)} ${L.reg.nome} · <span id="lRest"></span></small></div></div>
    <div class="lVida"><span class="retrato">${ico(CLASSES[L.lider.h.cls].icone)}</span><div class="barra vida"><i></i><span></span></div></div>
    <div id="lSeta">${ico('seta')}</div>
    <canvas id="lJoy"></canvas><div id="lNums"></div><div id="lBarras"></div>
    <div class="lAcoes">
      <button class="lb h1" data-hab="0">${ico(L.lider.alc > 5 ? 'h_chuva' : 'h_giro')}<i></i></button>
      <button class="lb h2" data-hab="1">${ico(L.lider.alc > 5 ? 'h_fogo' : 'h_investida')}<i></i></button>
      <button class="lb esq" data-hab="2">${ico('esquiva')}<i></i></button>
    </div>`;
  document.body.append(el);
  const cv = $('#lJoy'), g = cv.getContext('2d'); L.g = g;
  const medir = () => { cv.width = innerWidth; cv.height = innerHeight; }; medir(); L.medir = medir; addEventListener('resize', medir);
  cv.addEventListener('pointerdown', e => { if (L.joy) return; L.joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (L.joy && e.pointerId === L.joy.id) { L.joy.x = e.clientX; L.joy.y = e.clientY; } });
  const solta = e => { if (L?.joy && e.pointerId === L.joy.id) L.joy = null; };
  cv.addEventListener('pointerup', solta); cv.addEventListener('pointercancel', solta);
  el.addEventListener('pointerdown', e => { const b = e.target.closest('[data-hab]'); if (b) { e.preventDefault(); usarHab(+b.dataset.hab); } });
  el.addEventListener('click', e => { if (e.target.closest('[data-l="sair"]')) terminar(false, true); });
}
function numero(x, y, z, txt, cor, grande = false) { L.txt.push({ x, y, z, txt, cor, grande, t: 0 }); }

// ---------------- habilidades ----------------
function usarHab(i) {
  const j = L.lider; if (L.fim || j.cds[i] > 0 || j.hp <= 0) return;
  const longe = j.alc > 5;
  if (i === 2) { // esquiva: impulso na direção do joystick
    j.cds[2] = 1.2; j.iframes = 0.45; j.dash = { t: 0.35, ax: L.mx || Math.sin(j.ang), az: L.mz || Math.cos(j.ang) };
    j.v.tocar('Dodge_Forward', { loop: false, reinicia: true, vel: 1.3 }); som('clique'); return;
  }
  const alvo = maisPerto(j, 20);
  if (i === 0) { // área: giro (perto) ou chuva de flechas/magia (longe) no alvo
    j.cds[0] = 6; const c = longe && alvo ? alvo : j, r = longe ? 6 : 5.5;
    j.v.tocar(longe ? 'Ranged_Magic_Raise' : 'Melee_2H_Attack_Spin', { loop: false, reinicia: true });
    if (longe) C.aviso(c.x, c.z, r, 0.7, 0x3aaaff);
    setTimeout(() => { if (!L) return; C.onda(c.x, c.z, r, longe ? 0x7ad0ff : 0xffe0a0, 0.5); C.faiscas(c.x, 1, c.z, longe ? 0x7ad0ff : 0xffd84a, 30, 5); C.camera.tremor = 0.25;
      for (const e of L.inimigos) if (e.hp > 0 && dist(e, c) < r + 1) ferir(e, j.dano * 2.4); }, longe ? 700 : 300);
  } else { // investida (perto) ou bola de fogo (longe)
    j.cds[1] = 8;
    if (alvo) j.ang = Math.atan2(alvo.x - j.x, alvo.z - j.z);
    if (longe) { j.v.tocar('Ranged_Magic_Shoot', { loop: false, reinicia: true }); atirar(j, j.ang, 'fogo', 22, j.dano * 3, true, 4); }
    else { j.dash = { t: 0.35, ax: Math.sin(j.ang), az: Math.cos(j.ang), bate: new Set() }; j.iframes = 0.4; j.v.tocar('Melee_1H_Attack_Stab', { loop: false, reinicia: true }); }
  }
  som('espada');
}
function maisPerto(de, raio) { let m = null, d0 = raio; for (const e of L.inimigos) if (e.hp > 0) { const d = dist(de, e); if (d < d0) { d0 = d; m = e; } } return m; }
function atirar(de, ang, tipo, vel, dano, dono, explode = 0) {
  const o = C.projetil(tipo); o.scale.setScalar(1.6); const p = { x: de.x + Math.sin(ang) * 1.5, z: de.z + Math.cos(ang) * 1.5, vx: Math.sin(ang) * vel, vz: Math.cos(ang) * vel, o, dano, dono, explode, andou: 0 };
  o.position.set(p.x, 2, p.z); o.rotation.y = ang; L.proj.push(p);
}
function ferir(e, v) {
  if (e.hp <= 0) return; v = Math.round(v * (0.9 + Math.random() * 0.2)); const crit = Math.random() < (L.lider.crit || 0.12); if (crit) v = Math.round(v * 1.8);
  e.hp -= v; e.acordado = true; e.flash = 0.12; numero(e.x, e.chefe ? 7 : 4, e.z, (crit ? '!' : '') + fmt(v), crit ? '#ffd84a' : '#fff', crit);
  C.faiscas(e.x, 1.5, e.z, crit ? 0xffd84a : 0xffffff, crit ? 12 : 6, 3);
  if (e.hp <= 0) { e.v.tocar(e.bicho ? 'Death' : 'Death_A', { loop: false, reinicia: true }); e.morreu = 0; som('compra'); soltarLoot(e); }
  else if (!e.chefe && !e.grande && Math.random() < 0.4) e.v.tocar(e.bicho ? 'Idle_HitReact1' : 'Hit_A', { loop: false, reinicia: true });
}
function ferirHeroi(a, v) {
  if (a.iframes > 0 || a.hp <= 0) return;
  if (a === L.lider) { v *= 1 - (a.def || 0); a.hp -= v; a.flash = 0.15; numero(a.x, 4, a.z, '-' + fmt(Math.round(v)), '#ff5a4a'); C.camera.tremor = Math.max(C.camera.tremor, 0.12);
    if (a.hp <= 0) { a.hp = 0; a.v.tocar('Death_A', { loop: false, reinicia: true }); setTimeout(() => terminar(false), 1800); L.fim = true; } }
}

// ---------------- emboscadas e loot ----------------
function sortearEncontro() {
  const peso = e => e.peso * (e.unico ? 1 + L.q.rank : 1), tot = ENCONTROS.reduce((s, e) => s + peso(e), 0); let x = Math.random() * tot;
  for (const e of ENCONTROS) { x -= peso(e); if (x <= 0) return e; } return ENCONTROS[0];
}
function emboscar() {
  const enc = sortearEncontro(), j = L.lider; L.emboscada = null; L.encontro = enc;
  enc.grupo.forEach(([tp, nome, esc = 1, vidaX = 1, cor], i) => {
    const [mod, e0, vida, dano, atk] = BICHOS[tp], v = C.personagem(mod, [], 1); v.raiz.scale.setScalar(ESC_MUNDO * e0 * esc);
    if (cor != null) v.corpo.traverse(o => { if (o.isMesh) { o.material.color.lerp(new C.Cor(cor), 0.55); if (o.material.emissive) o.material.emissive.setHex(cor).multiplyScalar(0.15); } });
    const a = Math.random() * 6.28, x = j.x + Math.cos(a) * (10 + i * 2), z = j.z + Math.sin(a) * (10 + i * 2); v.raiz.position.set(x, 0, z); v.tocar('Idle');
    const vv = vida * vidaX * (1 + L.q.r * 0.3);
    L.inimigos.push({ tp, v, x, z, hp: vv, max: vv, dano: dano * (1 + L.q.r * 0.2) * (enc.unico ? 1.6 : 1) / L.forca, alc: 2.8 * esc, cd: 1.5, ang: 0, acordado: true, bicho: true, atkAnim: atk,
      nome, raro: enc.raro, unico: enc.unico, grande: esc > 1.4, emb: true });
  });
  faixa(enc.unico ? '★ MONSTRO ÚNICO ★' : 'EMBOSCADA!', enc.txt, enc.unico ? 'unico' : ''); C.camera.tremor = 0.4; som(enc.unico ? 'lendario' : 'falha');
}
function soltarLoot(e) {
  const nivel = Math.max(1, E.lider()?.nivel || 1) + L.q.r * 3;
  const chance = e.unico || e.raro || e.chefe ? 1 : 0.14, bonus = e.unico ? 1 : e.raro || e.chefe ? 0.6 : 0;
  if (Math.random() > chance) return;
  const itens = [gerarItem(nivel, e.unico ? Math.max(3, sortearRaridade(1)) : sortearRaridade(bonus))];
  if (e.unico) itens.push(gerarItem(nivel, sortearRaridade(1)));
  for (const it of itens) { L.loot.push(it); const R = RARIDADE_ITEM[it.rar]; numero(e.x, 6, e.z, `${R.nome}!`, R.cor, true); C.faiscas(e.x, 2, e.z, parseInt(R.cor.slice(1), 16), 30, 5); }
  const bau = C.objeto('D:chest', 2.4); bau.position.set(e.x, 0, e.z); L.baus = [...(L.baus || []), bau];
}
function faixa(tit, sub, cls = '') {
  const f = document.createElement('div'); f.className = 'lFaixa ' + cls; f.innerHTML = `<b>${tit}</b><span>${sub}</span>`; $('#luta').append(f); setTimeout(() => f.remove(), 3200);
}

// ---------------- laço ----------------
export function passoLuta(dt) {
  if (!L) return;
  L.t += dt; const j = L.lider;
  if (L.emboscada != null && !L.fim && 1 - Math.hypot(L.campo.x - j.x, L.campo.z - j.z) / L.distTotal > L.emboscada) emboscar();
  // joystick → direção no mundo (relativa à câmera)
  let jx = 0, jy = 0; if (L.joy) { const dx = L.joy.x - L.joy.sx, dy = L.joy.y - L.joy.sy, m = Math.hypot(dx, dy); if (m > 6) { const f = Math.min(1, m / 55); jx = dx / m * f; jy = dy / m * f; } }
  const y = C.camera.yaw, sy = Math.sin(y), cy = Math.cos(y); L.mx = -jy * sy - jx * cy; L.mz = -jy * cy + jx * sy;
  for (let i = 0; i < 3; i++) j.cds[i] = Math.max(0, j.cds[i] - dt);
  j.iframes = Math.max(0, (j.iframes || 0) - dt);
  if (j.hp > 0 && !L.fim) {
    const mv = Math.hypot(L.mx, L.mz);
    if (j.dash) { j.dash.t -= dt; j.x += j.dash.ax * 22 * dt; j.z += j.dash.az * 22 * dt; if (j.dash.bate) for (const e of L.inimigos) if (e.hp > 0 && !j.dash.bate.has(e) && dist(e, j) < 2.5) { j.dash.bate.add(e); ferir(e, j.dano * 2); e.atordoado = 1.5; } if (j.dash.t <= 0) j.dash = null; }
    else if (mv > 0.05) { const v = 11 * Math.min(1, mv); j.x += L.mx / mv * v * dt; j.z += L.mz / mv * v * dt; j.ang += difAng(j.ang, Math.atan2(L.mx, L.mz)) * Math.min(1, dt * 12); j.v.tocar('Running_A'); }
    // ataque automático no monstro mais perto
    j.cd -= dt; const alvo = maisPerto(j, j.alc + 1);
    if (alvo && !j.dash) { if (mv < 0.05) j.ang += difAng(j.ang, Math.atan2(alvo.x - j.x, alvo.z - j.z)) * Math.min(1, dt * 12);
      if (j.cd <= 0) { j.cd = (j.alc > 5 ? 0.8 : 0.65) * (1 - (j.vel || 0)); j.v.tocar(animAtaque(j.h.visual), { loop: false, reinicia: true, vel: 1.3 });
        if (j.alc > 5 && dist(alvo, j) > 3) atirar(j, Math.atan2(alvo.x - j.x, alvo.z - j.z), armaInfo(j.h.visual.arma).tipo === 'magia' ? 'magia' : 'flecha', 30, j.dano, true);
        else if (j.alc > 5) ferir(alvo, j.dano); // colado no monstro: acerta direto
        else setTimeout(() => { if (L && alvo.hp > 0 && dist(alvo, j) < j.alc + 1.5) { ferir(alvo, j.dano); C.arco(j.x, j.z, j.ang, 3, 120, 0xfff2c0); } }, 180); } }
    else if (mv <= 0.05 && !j.dash && j.cd < 0.2) j.v.tocar('Idle_A');
  }
  // aliados seguem e lutam
  L.aliados.forEach((a, i) => {
    const alvo = maisPerto(a, 16); let dest = alvo, perto = alvo ? a.alc : 0;
    if (!alvo) { const ang = j.ang + Math.PI + (i - 0.5) * 0.9; dest = { x: j.x + Math.sin(ang) * 4, z: j.z + Math.cos(ang) * 4 }; perto = 1; }
    const d = dist(a, dest);
    if (d > perto) { const v = 10; a.x += (dest.x - a.x) / d * v * dt; a.z += (dest.z - a.z) / d * v * dt; a.ang = Math.atan2(dest.x - a.x, dest.z - a.z); a.v.tocar('Running_A'); }
    else if (alvo) { a.ang = Math.atan2(alvo.x - a.x, alvo.z - a.z); a.cd -= dt; if (a.cd <= 0) { a.cd = 1.1; a.v.tocar(animAtaque(a.h.visual), { loop: false, reinicia: true }); if (a.alc > 5 && dist(a, alvo) > 3) atirar(a, a.ang, 'flecha', 28, a.dano, true); else ferir(alvo, a.dano); } }
    else a.v.tocar('Idle_A');
  });
  // monstros
  for (const e of L.inimigos) {
    if (e.hp <= 0) { e.morreu += dt; if (e.morreu > 2.5) e.v.raiz.position.y = -(e.morreu - 2.5); if (e.morreu > 4) e.v.raiz.visible = false; continue; }
    e.atordoado = Math.max(0, (e.atordoado || 0) - dt);
    const alvos = [j, ...L.aliados].filter(a => a.hp === undefined || a.hp > 0); let alvo = null, d0 = 1e9; for (const a of alvos) { const d = dist(a, e); if (d < d0) { d0 = d; alvo = a; } }
    if (!e.acordado && d0 < 20) { e.acordado = true; if (e.chefe) { e.v.tocar('Taunt', { loop: false, reinicia: true }); e.cd = 1.8; C.camera.tremor = 0.3; } }
    if (!e.acordado || !alvo || e.atordoado > 0) continue;
    e.ang = Math.atan2(alvo.x - e.x, alvo.z - e.z); e.cd -= dt;
    if (d0 > e.alc * 0.9) { const v = e.chefe ? 5 : e.bicho ? 8 : 6.5; e.x += Math.sin(e.ang) * v * dt; e.z += Math.cos(e.ang) * v * dt; e.v.tocar(e.bicho ? 'Gallop' : 'Running_A'); }
    else if (e.cd <= 0) {
      e.cd = e.chefe ? 1.6 : e.longe ? 2 : 1.4; e.v.tocar(e.bicho ? e.atkAnim : e.longe ? '2H_Ranged_Shoot' : '1H_Melee_Attack_Chop', { loop: false, reinicia: true });
      if (e.longe) atirar(e, e.ang, 'virote', 20, e.dano, false);
      else { const a0 = alvo; setTimeout(() => { if (L && e.hp > 0 && dist(e, a0) < e.alc + 1.2) { ferirHeroi(a0, e.dano); if (e.chefe) { C.onda(e.x, e.z, 4, 0xff7a3a, 0.4); } } }, 400); }
    } else e.v.tocar(e.v.tem('Idle_Combat') ? 'Idle_Combat' : 'Idle');
  }
  // projéteis
  for (let i = L.proj.length - 1; i >= 0; i--) {
    const p = L.proj[i]; p.x += p.vx * dt; p.z += p.vz * dt; p.andou += Math.hypot(p.vx, p.vz) * dt; p.o.position.set(p.x, 2, p.z);
    let fim = p.andou > 26;
    if (p.dono) { for (const e of L.inimigos) if (e.hp > 0 && Math.hypot(e.x - p.x, e.z - p.z) < (e.chefe ? 2.5 : 1.4)) { if (p.explode) { C.onda(p.x, p.z, p.explode, 0xff7a2a, 0.4); for (const o of L.inimigos) if (o.hp > 0 && Math.hypot(o.x - p.x, o.z - p.z) < p.explode + 1) ferir(o, p.dano); } else ferir(e, p.dano); fim = true; break; } }
    else if (Math.hypot(j.x - p.x, j.z - p.z) < 1.3) { ferirHeroi(j, p.dano); fim = true; }
    if (fim) { C.remover(p.o); L.proj.splice(i, 1); }
  }
  // visual
  for (const a of [j, ...L.aliados]) { a.v.raiz.position.set(a.x, 0, a.z); a.v.raiz.rotation.y = a.ang; a.v.mixer.update(dt); a.flash = Math.max(0, (a.flash || 0) - dt); a.v.brilho(a.flash > 0 ? 0.35 : 0); }
  for (const e of L.inimigos) { e.v.raiz.position.x = e.x; e.v.raiz.position.z = e.z; e.v.raiz.rotation.y = e.ang; e.v.mixer.update(dt); e.flash = Math.max(0, (e.flash || 0) - dt); e.v.brilho(e.flash > 0 ? 0.4 : 0); }
  ui.foco.x += (j.x - ui.foco.x) * Math.min(1, dt * 6); ui.foco.z += (j.z - ui.foco.z) * Math.min(1, dt * 6);
  // vitória
  if (!L.fim && L.emboscada == null && L.inimigos.every(e => e.hp <= 0)) { L.fim = true; j.v.tocar('Cheering', { loop: true, reinicia: true }); for (const a of L.aliados) a.v.tocar('Cheering', { loop: true }); setTimeout(() => terminar(true), 2200); }
  desenharHud(dt);
}
function desenharHud(dt) {
  const j = L.lider, b = $('#luta .lVida .barra');
  b.querySelector('i').style.width = Math.max(0, j.hp / j.max * 100) + '%'; b.querySelector('span').textContent = `${Math.ceil(j.hp)} / ${j.max}`;
  $('#lRest').textContent = `${L.inimigos.filter(e => e.hp > 0).length} monstros`;
  document.querySelectorAll('#luta [data-hab]').forEach(bt => { const i = +bt.dataset.hab, cd = j.cds[i], tot = [6, 8, 1.2][i]; bt.style.setProperty('--p', cd > 0 ? (cd / tot * 360) + 'deg' : '0deg'); bt.querySelector('i').textContent = cd > 0 ? Math.ceil(cd) : ''; });
  // seta até o acampamento quando ele está fora da tela
  const s = $('#lSeta'), c = L.campo, t = C.tela(c.x, 2, c.z), dCampo = Math.hypot(c.x - j.x, c.z - j.z);
  if (dCampo > 22 && L.inimigos.some(e => e.hp > 0) && !L.inimigos.some(e => e.acordado)) { const cx = innerWidth / 2, cy = innerHeight / 2; let ax = (t ? t[0] : cx) - cx, ay = (t ? t[1] : cy) - cy; const m = Math.hypot(ax, ay) || 1; ax /= m; ay /= m;
    s.hidden = false; s.style.transform = `translate(${cx + ax * Math.min(cx, cy) * 0.7}px,${cy + ay * Math.min(cx, cy) * 0.7}px) translate(-50%,-50%) rotate(${Math.atan2(ay, ax)}rad)`; s.dataset.d = Math.round(dCampo) + 'm'; }
  else s.hidden = true;
  // barras de vida e números
  const g = L.g; g.clearRect(0, 0, innerWidth, innerHeight);
  if (L.joy) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.beginPath(); g.arc(L.joy.sx, L.joy.sy, 55, 0, 7); g.stroke(); const dx = L.joy.x - L.joy.sx, dy = L.joy.y - L.joy.sy, m = Math.hypot(dx, dy), f = Math.min(1, 55 / (m || 1)); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(L.joy.sx + dx * f, L.joy.sy + dy * f, 24, 0, 7); g.fill(); }
  for (const e of L.inimigos) { if (e.hp <= 0) continue; const p = C.tela(e.x, e.chefe || e.grande ? 8 : 4.6, e.z); if (!p) continue; const w = e.chefe || e.grande ? 90 : 46;
    if (e.nome) { g.font = '800 13px system-ui'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(e.nome, p[0], p[1] - 6); g.fillStyle = e.unico ? '#ffb02e' : '#ff8a7a'; g.fillText(e.nome, p[0], p[1] - 6); }
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(p[0] - w / 2 - 1, p[1] - 1, w + 2, 7); g.fillStyle = e.chefe ? '#ff7a2a' : '#e2412f'; g.fillRect(p[0] - w / 2, p[1], w * e.hp / e.max, 5); }
  for (const t of L.txt) { t.t += dt; const p = C.tela(t.x, t.y + t.t * 2, t.z); if (!p) continue; g.globalAlpha = Math.max(0, 1 - t.t / 1.1); g.font = `800 ${t.grande ? 26 : 18}px system-ui`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(t.txt, p[0], p[1]); g.fillStyle = t.cor; g.fillText(t.txt, p[0], p[1]); g.globalAlpha = 1; }
  L.txt = L.txt.filter(t => t.t < 1.1);
}
function terminar(ok, desistiu = false) {
  if (!L) return; const l = L; L = null;
  for (const a of [l.lider, ...l.aliados]) a.v.remover(); for (const e of l.inimigos) e.v.remover(); for (const p of l.proj) C.remover(p.o); for (const b of l.baus || []) C.remover(b);
  removeEventListener('resize', l.medir); $('#luta').remove(); $('#hud').style.visibility = '';
  if (desistiu) { delete l.q.emLuta; for (const id of l.ids) { const h = E.heroi(id); if (h) h.estado = 'livre'; } som('fechar'); }
  else E.concluirManual(l.q.id, l.ids, ok);
  ui.foco = { x: l.lider.x, z: l.lider.z }; C.camera.dist = 60; C.camera.suave = 10;
  l.aoFim && l.aoFim(ok, desistiu, desistiu ? [] : l.loot);
}
