'use strict';
/* =====================================================================
   Coroa de Ferro — jogo de estratégia de reino (single-player, offline)
   Todo o estado vive em S e é salvo no localStorage. O tempo corre de
   verdade: timers terminam mesmo com o jogo fechado (advance()).
   ===================================================================== */

const SAVE_KEY = 'coroa_save_v1';
const MAXLV = 20, RMAX = 10, N = 50, CX = 25, CY = 25;
const RES = ['comida', 'madeira', 'pedra', 'ouro'];
const RI = { comida: '🌾', madeira: '🪵', pedra: '🪨', ouro: '🪙' };

const B = {
  castelo:  { n: 'Castelo', i: '🏰', d: 'Coração do reino. As outras construções não passam do nível dele.', c: { madeira: 250, pedra: 150 }, t: 20 },
  fazenda:  { n: 'Fazenda', i: '🌾', d: 'Produz comida.', c: { madeira: 80 }, t: 8, prod: 'comida', p: 900 },
  serraria: { n: 'Serraria', i: '🪵', d: 'Produz madeira.', c: { comida: 80 }, t: 8, prod: 'madeira', p: 900 },
  pedreira: { n: 'Pedreira', i: '🪨', d: 'Produz pedra.', c: { comida: 80, madeira: 80 }, t: 10, prod: 'pedra', p: 600, req: 2 },
  mina:     { n: 'Mina de Ouro', i: '🪙', d: 'Produz ouro.', c: { comida: 120, madeira: 120, pedra: 60 }, t: 12, prod: 'ouro', p: 400, req: 4 },
  armazem:  { n: 'Armazém', i: '📦', d: 'Aumenta o limite de recursos guardados.', c: { madeira: 120, pedra: 60 }, t: 10 },
  quartel:  { n: 'Quartel', i: '⚔️', d: 'Treina tropas. Nível maior: lotes maiores e novas tropas.', c: { madeira: 150, pedra: 50 }, t: 12 },
  academia: { n: 'Academia', i: '📜', d: 'Pesquisa tecnologias.', c: { madeira: 200, pedra: 120, ouro: 40 }, t: 15, req: 3 },
};

const T = {
  inf: { n: 'Infantaria', i: '🛡️', atk: 10, def: 10, hp: 30, spd: 1,   carga: 12, c: { comida: 40, madeira: 20 }, req: 1 },
  arq: { n: 'Arqueiros',  i: '🏹', atk: 14, def: 6,  hp: 22, spd: 1,   carga: 8,  c: { comida: 40, madeira: 35 }, req: 3 },
  cav: { n: 'Cavalaria',  i: '🐎', atk: 12, def: 8,  hp: 26, spd: 1.5, carga: 10, c: { comida: 50, ouro: 15 },    req: 5 },
};
const TT = Object.keys(T);
const BEATS = { inf: 'cav', cav: 'arq', arq: 'inf' };

const R = {
  eco:    { n: 'Economia',    i: '🌾', d: '+8% produção por nível' },
  constr: { n: 'Engenharia',  i: '🔨', d: '-5% tempo de construção por nível' },
  fer:    { n: 'Ferraria',    i: '⚒️', d: '+6% ataque por nível' },
  arm:    { n: 'Armaduras',   i: '🛡️', d: '+6% defesa por nível' },
  trein:  { n: 'Treinamento', i: '🎯', d: '-7% tempo de treino por nível' },
  log:    { n: 'Logística',   i: '🐴', d: '+10% velocidade e carga por nível' },
};

const Q = [
  { t: 'Evolua o Castelo ao nível 2', ok: () => S.b.castelo >= 2, r: { madeira: 300, pedra: 100 } },
  { t: 'Construa o Quartel', ok: () => S.b.quartel >= 1, r: { comida: 400, madeira: 200 } },
  { t: 'Treine 30 tropas', ok: () => S.st.treinadas >= 30, r: { comida: 500, gemas: 50 } },
  { t: 'Derrote um Bárbaro nível 1 no mapa', ok: () => S.st.barbMax >= 1, r: { madeira: 600, pedra: 300 } },
  { t: 'Evolua o Castelo ao nível 3', ok: () => S.b.castelo >= 3, r: { comida: 800, madeira: 800, pedra: 400 } },
  { t: 'Construa a Pedreira', ok: () => S.b.pedreira >= 1, r: { pedra: 500 } },
  { t: 'Colete 1.000 recursos no mapa', ok: () => S.st.coletado >= 1000, r: { comida: 1000, gemas: 50 } },
  { t: 'Construa a Academia', ok: () => S.b.academia >= 1, r: { ouro: 300, madeira: 500 } },
  { t: 'Pesquise Economia nível 1', ok: () => S.rs.eco >= 1, r: { comida: 1500, madeira: 1500 } },
  { t: 'Derrote um Bárbaro nível 3', ok: () => S.st.barbMax >= 3, r: { ouro: 500, gemas: 100 } },
  { t: 'Evolua o Castelo ao nível 5', ok: () => S.b.castelo >= 5, r: { comida: 3000, madeira: 3000, pedra: 2000, ouro: 500 } },
  { t: 'Alcance 5.000 de Poder', ok: () => power() >= 5000, r: { gemas: 150 } },
  { t: 'Evolua o Castelo ao nível 8', ok: () => S.b.castelo >= 8, r: { comida: 10000, madeira: 10000, pedra: 6000, ouro: 2000 } },
  { t: 'Derrote um Bárbaro nível 6', ok: () => S.st.barbMax >= 6, r: { gemas: 200 } },
  { t: 'Evolua o Castelo ao nível 10', ok: () => S.b.castelo >= 10, r: { comida: 30000, madeira: 30000, pedra: 20000, ouro: 8000, gemas: 300 } },
  { t: 'Derrote um Bárbaro nível 10', ok: () => S.st.barbMax >= 10, r: { gemas: 500 } },
  { t: 'Evolua o Castelo ao nível 15', ok: () => S.b.castelo >= 15, r: { gemas: 1000 } },
];

/* ---------------- utilidades ---------------- */
const $ = s => document.querySelector(s);
const fmt = n => {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'K';
  return n.toLocaleString('pt-BR');
};
const ftime = ms => {
  let s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
};
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rnd = Math.random;
const dist = (x, y) => Math.hypot(x - CX, y - CY);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------------- fórmulas ---------------- */
const bcost = (id, lv) => { const o = {}; for (const k in B[id].c) o[k] = Math.round(B[id].c[k] * 1.55 ** (lv - 1)); return o; };
const btime = (id, lv) => B[id].t * 1.5 ** (lv - 1) * (1 - 0.05 * S.rs.constr) * 1000;
const rcost = lv => { const o = {}; const base = { comida: 300, madeira: 300, pedra: 200, ouro: 120 }; for (const k in base) o[k] = Math.round(base[k] * 1.6 ** (lv - 1)); return o; };
const rtime = lv => 30 * 1.55 ** (lv - 1) * 1000;
const cap = () => Math.round(5000 * (S.b.armazem + 1) ** 1.9);
function rate(r) { // por hora
  let v = 150;
  for (const id in B) if (B[id].prod === r && S.b[id] > 0) v += B[id].p * S.b[id] * 1.2 ** (S.b[id] - 1);
  return v * (1 + 0.08 * S.rs.eco);
}
const ttime = () => 2000 * (1 - 0.07 * S.rs.trein);
const tmax = () => 20 + 30 * S.b.quartel;
const maxMarches = () => 1 + Math.floor(S.b.castelo / 5);
const mods = () => ({ atk: 1 + 0.06 * S.rs.fer, def: 1 + 0.06 * S.rs.arm });
const canPay = c => RES.every(k => (S.res[k] || 0) >= (c[k] || 0));
const pay = c => { for (const k in c) S.res[k] -= c[k]; };
function give(r) {
  for (const k in r) {
    if (k === 'gemas') S.gemas += r[k];
    else S.res[k] = (S.res[k] || 0) + r[k];
  }
}
const costHTML = c => '<div class="cost">' + Object.keys(c).map(k =>
  `<span class="${(S.res[k] || 0) >= c[k] ? '' : 'no'}">${RI[k]} ${fmt(c[k])}</span>`).join('') + '</div>';
const rewHTML = r => Object.keys(r).map(k => `${k === 'gemas' ? '💎' : RI[k]} ${fmt(r[k])}`).join(' · ');
function power() {
  let p = 0;
  for (const id in B) p += 10 * S.b[id] ** 2;
  for (const id in R) p += 25 * S.rs[id] ** 2;
  const all = { ...S.tr };
  for (const m of S.marches) for (const t in m.tropas) all[t] += m.tropas[t];
  for (const t of TT) p += all[t] * (T[t].atk + T[t].def) / 4;
  return Math.round(p);
}

/* ---------------- estado ---------------- */
let S;
function newGame() {
  const now = Date.now();
  S = {
    v: 1, t: now, nid: 1,
    res: { comida: 1500, madeira: 1500, pedra: 800, ouro: 300 }, gemas: 300,
    b: { castelo: 1, fazenda: 1, serraria: 1, pedreira: 0, mina: 0, armazem: 1, quartel: 0, academia: 0 },
    rs: { eco: 0, constr: 0, fer: 0, arm: 0, trein: 0, log: 0 },
    tr: { inf: 40, arq: 0, cav: 0 },
    bq: null, tq: null, rq: null,
    marches: [], rel: [], q: 0,
    st: { treinadas: 0, barbMax: 0, coletado: 0, vitorias: 0 },
    map: [],
  };
  const r = rng(now & 0xffffff);
  for (let i = 0; i < 80; i++) spawn('bar', r);
  for (let i = 0; i < 50; i++) spawn('res', r);
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 1) { S = s; return; } } catch (e) {}
  newGame();
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }

/* ---------------- mapa: geração ---------------- */
function spawn(kind, r = rnd) {
  const occ = new Set(S.map.map(t => t.x + ',' + t.y));
  occ.add(CX + ',' + CY);
  for (let tries = 0; tries < 300; tries++) {
    const x = Math.floor(r() * N), y = Math.floor(r() * N);
    const d = dist(x, y);
    if (occ.has(x + ',' + y) || d < 2.5) continue;
    const t = { id: S.nid++, x, y, k: kind };
    if (kind === 'bar') {
      t.lv = Math.max(1, Math.min(15, Math.round(d / 2.6 + (r() * 2 - 1))));
      const a = 0.2 + r() * 0.6, b = (1 - a) * r();
      t.mix = [a, b, 1 - a - b];
    } else {
      t.rt = RES[Math.floor(r() * (d < 8 ? 2 : 4))];
      t.lv = Math.max(1, Math.min(8, Math.round(d / 4 + r())));
      t.qty = 6000 * t.lv;
    }
    S.map.push(t);
    return t;
  }
}
const tileAt = (x, y) => S.map.find(t => t.x === x && t.y === y);
const tileById = id => S.map.find(t => t.id === id);
function barbArmy(t) {
  const tot = Math.round(22 * t.lv ** 1.8);
  return { inf: Math.round(tot * t.mix[0]), arq: Math.round(tot * t.mix[1]), cav: Math.round(tot * t.mix[2]) };
}
const barbLoot = lv => ({ comida: Math.round(350 * lv ** 1.6), madeira: Math.round(350 * lv ** 1.6), pedra: Math.round(180 * lv ** 1.6), ouro: Math.round(80 * lv ** 1.6) });

/* ---------------- batalha ---------------- */
function battle(A, B_, mA, mB) {
  const a = { ...A }, b = { ...B_ };
  const tot = x => TT.reduce((s, t) => s + x[t], 0);
  const hit = (att, def, ma, md) => {
    const loss = { inf: 0, arq: 0, cav: 0 }, td = tot(def);
    if (td <= 0) return loss;
    for (const ta of TT) {
      if (att[ta] <= 0) continue;
      for (const tb of TT) {
        if (def[tb] <= 0) continue;
        const bonus = BEATS[ta] === tb ? 1.35 : (BEATS[tb] === ta ? 0.8 : 1);
        const dmg = att[ta] * T[ta].atk * ma.atk * bonus * (def[tb] / td) * 0.6;
        loss[tb] += dmg / (T[tb].hp * (1 + T[tb].def / 20) * md.def);
      }
    }
    return loss;
  };
  for (let r = 0; r < 12 && tot(a) >= 0.5 && tot(b) >= 0.5; r++) {
    const la = hit(b, a, mB, mA), lb = hit(a, b, mA, mB);
    for (const t of TT) { a[t] = Math.max(0, a[t] - la[t]); b[t] = Math.max(0, b[t] - lb[t]); }
  }
  const out = x => { const o = {}; for (const t of TT) o[t] = x[t] < 0.5 ? 0 : Math.round(x[t]); return o; };
  const ra = out(a), rb = out(b);
  return { win: tot(rb) === 0 && tot(ra) > 0, a: ra, b: rb };
}

/* ---------------- motor de tempo ---------------- */
function produce(t) {
  const dt = (t - S.t) / 3600000;
  if (dt <= 0) return;
  const c = cap();
  for (const r of RES) if (S.res[r] < c) S.res[r] = Math.min(c, S.res[r] + rate(r) * dt);
  S.t = t;
}
function nextEvent() {
  let e = null;
  const c = (t, k, m) => { if (!e || t < e.t) e = { t, k, m }; };
  if (S.bq) c(S.bq.end, 'bq');
  if (S.tq) c(S.tq.end, 'tq');
  if (S.rq) c(S.rq.end, 'rq');
  for (const m of S.marches) c(m.end, 'm', m);
  return e;
}
let dirty = true;
function advance(to) {
  for (let g = 0; g < 2000; g++) {
    const e = nextEvent();
    if (!e || e.t > to) break;
    produce(e.t);
    fire(e);
    dirty = true;
  }
  produce(to);
}
function fire(e) {
  const now = e.t;
  if (e.k === 'bq') {
    S.b[S.bq.id] = S.bq.to;
    toast(`${B[S.bq.id].i} ${B[S.bq.id].n} chegou ao nível ${S.bq.to}!`);
    S.bq = null;
  } else if (e.k === 'tq') {
    S.tr[S.tq.t] += S.tq.n;
    S.st.treinadas += S.tq.n;
    toast(`${T[S.tq.t].i} ${S.tq.n} ${T[S.tq.t].n} prontos!`);
    S.tq = null;
  } else if (e.k === 'rq') {
    S.rs[S.rq.id] = S.rq.to;
    toast(`📜 ${R[S.rq.id].n} nível ${S.rq.to} concluída!`);
    S.rq = null;
  } else marchEvent(e.m, now);
}

/* ---------------- marchas ---------------- */
const march = tropas => {
  const spd = Math.min(...TT.filter(t => tropas[t] > 0).map(t => T[t].spd));
  return { spd: spd * (1 + 0.1 * S.rs.log), carga: TT.reduce((s, t) => s + tropas[t] * T[t].carga, 0) * (1 + 0.1 * S.rs.log) };
};
const travelMs = (tile, tropas) => dist(tile.x, tile.y) * 4000 / march(tropas).spd;
const gatherRate = () => 4 * (1 + 0.08 * S.rs.eco); // por segundo

function sendMarch(tile, tipo, tropas) {
  const n = TT.reduce((s, t) => s + (tropas[t] || 0), 0);
  if (n <= 0) return toast('Escolha as tropas.');
  if (S.marches.length >= maxMarches()) return toast('Todas as marchas estão ocupadas.');
  for (const t of TT) if ((tropas[t] || 0) > S.tr[t]) return toast('Tropas insuficientes.');
  for (const t of TT) S.tr[t] -= tropas[t];
  const now = Date.now(), dur = travelMs(tile, tropas);
  S.marches.push({ id: S.nid++, tipo, tid: tile.id, x: tile.x, y: tile.y, tropas, fase: 'ida', start: now, end: now + dur, dur, carga: {} });
  dirty = true; save();
  toast(tipo === 'atk' ? '⚔️ Marcha enviada para o ataque!' : '🧺 Marcha enviada para coletar!');
}
function back(m, now) { m.fase = 'volta'; m.start = now; m.end = now + m.dur; }
function marchEvent(m, now) {
  if (m.fase === 'volta') {
    for (const t of TT) S.tr[t] += m.tropas[t];
    give(m.carga);
    S.marches = S.marches.filter(x => x !== m);
    const got = Object.keys(m.carga).length ? ' com ' + rewHTML(m.carga) : '';
    toast('🏰 Marcha voltou' + got);
    return;
  }
  const tile = tileById(m.tid);
  if (m.fase === 'col') {
    const got = Math.min(m.amt, tile ? tile.qty : m.amt);
    if (tile) { tile.qty -= got; tile.busy = null; if (tile.qty <= 0) { S.map = S.map.filter(t => t !== tile); spawn('res'); } }
    m.carga = { [m.rt]: got };
    S.st.coletado += got;
    return back(m, now);
  }
  // chegou ao destino
  if (!tile || (m.tipo === 'col' && tile.busy && tile.busy !== m.id)) {
    report(false, 'Alvo perdido', 'O alvo não estava mais lá. A marcha está voltando.');
    return back(m, now);
  }
  if (m.tipo === 'col') {
    tile.busy = m.id;
    m.amt = Math.floor(Math.min(tile.qty, march(m.tropas).carga));
    m.rt = tile.rt;
    m.fase = 'col'; m.start = now; m.end = now + (m.amt / gatherRate()) * 1000;
    return;
  }
  // ataque a bárbaro
  const enemy = barbArmy(tile);
  const res = battle(m.tropas, enemy, mods(), { atk: 1 + 0.04 * tile.lv, def: 1 + 0.04 * tile.lv });
  const lost = {}; for (const t of TT) lost[t] = m.tropas[t] - res.a[t];
  const lostTxt = TT.filter(t => lost[t] > 0).map(t => `${T[t].i}${fmt(lost[t])}`).join(' ') || 'nenhuma';
  m.tropas = res.a;
  if (res.win) {
    const loot = barbLoot(tile.lv);
    loot.gemas = 5 * tile.lv;
    m.carga = loot;
    S.st.barbMax = Math.max(S.st.barbMax, tile.lv);
    S.st.vitorias++;
    S.map = S.map.filter(t => t !== tile);
    spawn('bar');
    report(true, `Vitória contra Bárbaros nv ${tile.lv}`, `Perdas: ${lostTxt}. Saque: ${rewHTML(loot)}`);
    toast(`🏆 Vitória contra Bárbaros nv ${tile.lv}!`);
  } else {
    report(false, `Derrota contra Bárbaros nv ${tile.lv}`, `Perdas: ${lostTxt}. Inimigos restantes: ${TT.map(t => T[t].i + fmt(res.b[t])).join(' ')}`);
    toast(`💀 Derrota contra Bárbaros nv ${tile.lv}`);
  }
  if (TT.every(t => m.tropas[t] === 0)) { S.marches = S.marches.filter(x => x !== m); return; }
  back(m, now);
}
function recall(id) {
  const m = S.marches.find(x => x.id === id), now = Date.now();
  if (!m || m.fase === 'volta') return;
  if (m.fase === 'ida') { m.fase = 'volta'; const el = now - m.start; m.start = now; m.end = now + el; }
  else {
    const got = Math.floor(m.amt * (now - m.start) / (m.end - m.start));
    const tile = tileById(m.tid);
    if (tile) { tile.qty -= got; tile.busy = null; }
    m.carga = { [m.rt]: got }; S.st.coletado += got;
    back(m, now);
  }
  dirty = true; save();
}
function report(win, titulo, txt) {
  S.rel.unshift({ t: S.t, win, titulo, txt });
  S.rel.length = Math.min(S.rel.length, 30);
}

/* ---------------- ações ---------------- */
function upgrade(id) {
  const to = S.b[id] + 1, c = bcost(id, to);
  if (S.bq) return toast('Já há uma construção em andamento.');
  if (!canPay(c)) return toast('Recursos insuficientes.');
  pay(c);
  const now = Date.now();
  S.bq = { id, to, start: now, end: now + btime(id, to) };
  dirty = true; save();
}
function research(id) {
  const to = S.rs[id] + 1, c = rcost(to);
  if (S.rq) return toast('Já há uma pesquisa em andamento.');
  if (!canPay(c)) return toast('Recursos insuficientes.');
  pay(c);
  const now = Date.now();
  S.rq = { id, to, start: now, end: now + rtime(to) };
  dirty = true; save();
}
function train(t, n) {
  n = Math.floor(n);
  if (S.tq) return toast('O quartel já está treinando.');
  const c = {}; for (const k in T[t].c) c[k] = T[t].c[k] * n;
  if (n <= 0 || !canPay(c)) return toast('Recursos insuficientes.');
  pay(c);
  const now = Date.now();
  S.tq = { t, n, start: now, end: now + ttime() * n };
  dirty = true; save();
}
const gemCost = q => Math.max(1, Math.ceil((q.end - Date.now()) / 60000));
function speed(k, free) {
  const q = S[k]; if (!q) return;
  if (free) { if (q.end - Date.now() > 300000) return; }
  else { const g = gemCost(q); if (S.gemas < g) return toast('Gemas insuficientes.'); S.gemas -= g; }
  q.end = Date.now();
  advance(Date.now()); save();
}
function claim() {
  const q = Q[S.q];
  if (!q || !q.ok()) return;
  give(q.r); S.q++;
  toast('🎁 Recompensa: ' + rewHTML(q.r));
  dirty = true; save();
}

/* ---------------- UI ---------------- */
let tab = 'cidade', sel = null;
function toast(msg) {
  const d = document.createElement('div'); d.innerHTML = msg;
  $('#toast').appendChild(d);
  setTimeout(() => d.remove(), 3200);
}
const queueHTML = (k, label) => {
  const q = S[k]; if (!q) return '';
  const left = q.end - Date.now();
  return `<div class="card queue"><div class="row" style="justify-content:space-between">
    <b>${label}</b><span class="cd" data-end="${q.end}">${ftime(left)}</span></div>
    <div class="bar"><i class="pb" data-s="${q.start}" data-e="${q.end}"></i></div>
    <div class="row">${k !== 'tq' && left <= 300000
      ? `<button class="btn sm" data-act="free" data-k="${k}">Grátis ✨</button>`
      : `<button class="btn gem sm" data-act="speed" data-k="${k}">Acelerar 💎${gemCost(q)}</button>`}</div></div>`;
};

function renderTop() {
  const c = cap();
  $('#resbar').innerHTML = RES.map(r => `<div class="r ${S.res[r] >= c ? 'full' : ''}">${RI[r]} <b>${fmt(S.res[r])}</b><small>+${fmt(rate(r))}/h</small></div>`).join('');
  $('#meta').innerHTML = `<span>⚡ Poder <b>${fmt(power())}</b></span><span>📦 Limite <b>${fmt(c)}</b></span><span>💎 <b>${fmt(S.gemas)}</b></span>`;
  $('#qdot').hidden = !(Q[S.q] && Q[S.q].ok());
}

function vCidade() {
  let h = `<div><h2>🏰 Seu Reino</h2>`;
  h += queueHTML('bq', S.bq ? `${B[S.bq.id].i} ${B[S.bq.id].n} → nv ${S.bq.to}` : '');
  if (!S.bq) h += `<p class="mut">🔨 Construtor livre — escolha algo para evoluir.</p>`;
  h += `<div class="grid" style="margin-top:10px">`;
  for (const id in B) {
    const b = B[id], lv = S.b[id], to = lv + 1;
    let act;
    if (lv >= MAXLV) act = `<span class="mut">Nível máximo</span>`;
    else if (b.req && S.b.castelo < b.req && lv === 0) act = `<span class="lock">🔒 Requer Castelo nv ${b.req}</span>`;
    else if (id !== 'castelo' && to > S.b.castelo) act = `<span class="lock">🔒 Requer Castelo nv ${to}</span>`;
    else {
      const c = bcost(id, to);
      act = costHTML(c) + `<div class="row"><button class="btn sm" data-act="up" data-id="${id}" ${S.bq || !canPay(c) ? 'disabled' : ''}>${lv ? 'Evoluir' : 'Construir'}</button><span class="mut">⏱ ${ftime(btime(id, to))}</span></div>`;
    }
    let info = '';
    if (b.prod) info = `<p>${RI[b.prod]} ${lv ? '+' + fmt(b.p * lv * 1.2 ** (lv - 1) * (1 + 0.08 * S.rs.eco)) + '/h' : '—'}</p>`;
    if (id === 'armazem') info = `<p>📦 Limite ${fmt(cap())}</p>`;
    if (id === 'quartel') info = `<p>Lote máx. ${lv ? tmax() : 0}</p>`;
    if (id === 'castelo') info = `<p>Marchas: ${maxMarches()}</p>`;
    h += `<div class="card ${S.bq && S.bq.id === id ? 'busy' : ''}"><div class="hd"><div class="ic">${b.i}</div><div><div class="nm">${b.n}</div><div class="lv">${lv ? 'Nível ' + lv : 'Não construído'}</div></div></div><p>${b.d}</p>${info}${act}</div>`;
  }
  return h + `</div></div>`;
}

function vExercito() {
  let h = `<div><h2>⚔️ Exército</h2><div class="grid">`;
  for (const t of TT) {
    const u = T[t], ok = S.b.quartel >= u.req;
    h += `<div class="card"><div class="hd"><div class="ic">${u.i}</div><div><div class="nm">${u.n}</div><div class="lv">${fmt(S.tr[t])} na cidade</div></div></div>
      <p>⚔️${u.atk} 🛡️${u.def} ❤️${u.hp} 🎒${u.carga}${u.spd > 1 ? ' 💨rápida' : ''}<br>Forte contra ${T[BEATS[t]].n}</p>
      ${ok ? `<button class="btn sm" data-act="trainM" data-t="${t}" ${S.tq ? 'disabled' : ''}>Treinar</button>` : `<span class="lock">🔒 Requer Quartel nv ${u.req}</span>`}</div>`;
  }
  h += `</div>`;
  if (S.tq) h += `<h3>Treinando</h3>` + queueHTML('tq', `${T[S.tq.t].i} ${S.tq.n} ${T[S.tq.t].n}`);
  h += `<h3>Marchas (${S.marches.length}/${maxMarches()})</h3><div class="list">`;
  if (!S.marches.length) h += `<p class="mut">Nenhuma marcha. Vá ao 🗺️ Mapa para atacar bárbaros ou coletar recursos.</p>`;
  for (const m of S.marches) {
    const f = { ida: m.tipo === 'atk' ? 'Indo atacar' : 'Indo coletar', col: 'Coletando', volta: 'Voltando' }[m.fase];
    h += `<div class="card"><div class="row" style="justify-content:space-between"><b>${f} (${m.x},${m.y})</b><span class="cd" data-end="${m.end}">${ftime(m.end - Date.now())}</span></div>
      <div class="bar"><i class="pb" data-s="${m.start}" data-e="${m.end}"></i></div>
      <div class="row"><span class="mut">${TT.filter(t => m.tropas[t]).map(t => T[t].i + fmt(m.tropas[t])).join(' ')}</span>
      ${m.fase !== 'volta' ? `<button class="btn sec sm" data-act="recall" data-id="${m.id}">Chamar de volta</button>` : ''}</div></div>`;
  }
  h += `</div><h3>Relatórios</h3><div class="list">`;
  if (!S.rel.length) h += `<p class="mut">Sem relatórios ainda.</p>`;
  for (const r of S.rel) h += `<div class="card rep ${r.win ? 'win' : 'lose'}"><b>${esc(r.titulo)}</b> <span class="tag">${new Date(r.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span><div class="mut">${r.txt}</div></div>`;
  return h + `</div></div>`;
}

function vPesquisa() {
  let h = `<div><h2>📜 Pesquisa</h2>`;
  if (!S.b.academia) return h + `<p class="mut">Construa a Academia (requer Castelo nv 3) para pesquisar.</p></div>`;
  h += queueHTML('rq', S.rq ? `${R[S.rq.id].i} ${R[S.rq.id].n} → nv ${S.rq.to}` : '');
  h += `<div class="grid" style="margin-top:10px">`;
  for (const id in R) {
    const lv = S.rs[id], to = lv + 1;
    let act;
    if (lv >= RMAX) act = `<span class="mut">Nível máximo</span>`;
    else if (to > S.b.academia) act = `<span class="lock">🔒 Requer Academia nv ${to}</span>`;
    else {
      const c = rcost(to);
      act = costHTML(c) + `<div class="row"><button class="btn sm" data-act="res" data-id="${id}" ${S.rq || !canPay(c) ? 'disabled' : ''}>Pesquisar</button><span class="mut">⏱ ${ftime(rtime(to))}</span></div>`;
    }
    h += `<div class="card ${S.rq && S.rq.id === id ? 'busy' : ''}"><div class="hd"><div class="ic">${R[id].i}</div><div><div class="nm">${R[id].n}</div><div class="lv">Nível ${lv}/${RMAX}</div></div></div><p>${R[id].d}</p>${act}</div>`;
  }
  return h + `</div></div>`;
}

function vMissoes() {
  const q = Q[S.q];
  let h = `<div><h2>🎯 Missões</h2>`;
  if (q) h += `<div class="card queue"><div class="mut">Missão ${S.q + 1} de ${Q.length}</div><div class="nm" style="margin:4px 0">${q.t}</div>
    <div class="mut">Recompensa: ${rewHTML(q.r)}</div><div style="margin-top:8px"><button class="btn" data-act="claim" ${q.ok() ? '' : 'disabled'}>${q.ok() ? 'Resgatar 🎁' : 'Em andamento'}</button></div></div>`;
  else h += `<p>👑 Todas as missões concluídas. Longa vida ao rei!</p>`;
  h += `<h3>Estatísticas</h3><div class="card"><div>⚡ Poder: <b>${fmt(power())}</b></div><div>🏆 Vitórias: ${S.st.vitorias}</div>
    <div>⛺ Maior bárbaro derrotado: nv ${S.st.barbMax}</div><div>🎯 Tropas treinadas: ${fmt(S.st.treinadas)}</div><div>🧺 Recursos coletados: ${fmt(S.st.coletado)}</div></div>
    <h3>Jogo</h3><button class="btn sec sm" data-act="reset">Recomeçar do zero</button></div>`;
  return h;
}

function render() {
  dirty = false;
  renderTop();
  $('#view').hidden = tab === 'mapa';
  $('#mapWrap').hidden = tab !== 'mapa';
  if (tab === 'mapa') { renderMapPanel(); return; }
  const sc = $('#view').scrollTop;
  $('#view').innerHTML = { cidade: vCidade, exercito: vExercito, pesquisa: vPesquisa, missoes: vMissoes }[tab]();
  $('#view').scrollTop = sc;
  timers();
}
function timers() {
  const now = Date.now();
  document.querySelectorAll('.cd').forEach(e => e.textContent = ftime(+e.dataset.end - now));
  document.querySelectorAll('.pb').forEach(e => {
    const s = +e.dataset.s, en = +e.dataset.e;
    e.style.width = Math.min(100, Math.max(0, (now - s) / (en - s) * 100)) + '%';
  });
}

/* ---------------- modais ---------------- */
function modal(html) { $('#modalBox').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; dirty = true; }
function trainModal(t) {
  const u = T[t];
  const afford = Math.floor(Math.min(...Object.keys(u.c).map(k => S.res[k] / u.c[k])));
  const max = Math.max(0, Math.min(tmax(), afford));
  modal(`<h2>${u.i} Treinar ${u.n}</h2>
    <div class="sl"><label><span>Quantidade</span><b id="tn">${max}</b></label><input id="tr" type="range" min="0" max="${max}" value="${max}"></div>
    <div id="tc"></div>
    <div class="row"><button class="btn" data-act="train" data-t="${t}">Treinar</button><button class="btn sec" data-act="close">Cancelar</button></div>`);
  const upd = () => {
    const n = +$('#tr').value, c = {};
    for (const k in u.c) c[k] = u.c[k] * n;
    $('#tn').textContent = n;
    $('#tc').innerHTML = costHTML(c) + `<p class="mut">⏱ ${ftime(ttime() * n)}</p>`;
  };
  $('#tr').oninput = upd; upd();
}
function marchModal(tile, tipo) {
  const d = {};
  let h = `<h2>${tipo === 'atk' ? '⚔️ Atacar Bárbaros nv ' + tile.lv : '🧺 Coletar ' + RI[tile.rt]} <span class="tag">(${tile.x},${tile.y})</span></h2>`;
  for (const t of TT) {
    d[t] = tipo === 'atk' ? S.tr[t] : Math.min(S.tr[t], Math.ceil(tile.qty / T[t].carga));
    h += `<div class="sl"><label><span>${T[t].i} ${T[t].n}</span><b id="mv_${t}">${d[t]}</b></label><input id="m_${t}" type="range" min="0" max="${S.tr[t]}" value="${d[t]}" ${S.tr[t] ? '' : 'disabled'}></div>`;
  }
  h += `<div id="mi" class="mut"></div><div class="row" style="margin-top:10px"><button class="btn" data-act="go" data-id="${tile.id}" data-k="${tipo}">Marchar</button><button class="btn sec" data-act="close">Cancelar</button></div>`;
  modal(h);
  const upd = () => {
    const tr = {}; for (const t of TT) { tr[t] = +$('#m_' + t).value; $('#mv_' + t).textContent = tr[t]; }
    if (!TT.some(t => tr[t])) return $('#mi').textContent = 'Nenhuma tropa selecionada.';
    const m = march(tr), my = TT.reduce((s, t) => s + tr[t] * (T[t].atk + T[t].def), 0) * mods().atk;
    let txt = `⏱ Viagem ${ftime(travelMs(tile, tr))} · 🎒 Carga ${fmt(m.carga)}`;
    if (tipo === 'atk') {
      const e = barbArmy(tile), en = TT.reduce((s, t) => s + e[t] * (T[t].atk + T[t].def), 0) * (1 + 0.04 * tile.lv);
      const r = my / en;
      txt += `<br>Chance: <b style="color:${r > 1.6 ? 'var(--good)' : r > 1.05 ? 'var(--gold)' : 'var(--bad)'}">${r > 1.6 ? 'Alta' : r > 1.05 ? 'Arriscada' : 'Baixa'}</b>`;
    } else txt += `<br>Coleta ${fmt(Math.min(tile.qty, m.carga))} em ${ftime(Math.min(tile.qty, m.carga) / gatherRate() * 1000)}`;
    $('#mi').innerHTML = txt;
  };
  for (const t of TT) $('#m_' + t).oninput = upd;
  upd();
}

/* ---------------- mapa ---------------- */
const cv = $('#map'), cx = cv.getContext('2d');
let cam = { x: CX + 0.5, y: CY + 0.5, z: 44 };
function mapSize() {
  const r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) {
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  }
  return { w: r.width, h: r.height, dpr };
}
const toScreen = (x, y, w, h) => [(x - cam.x) * cam.z + w / 2, (y - cam.y) * cam.z + h / 2];
function drawMap() {
  if (tab !== 'mapa') return;
  const { w, h, dpr } = mapSize(), z = cam.z;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.fillStyle = '#1d2a14'; cx.fillRect(0, 0, w, h);
  const [ox, oy] = toScreen(0, 0, w, h);
  cx.fillStyle = '#3d5c2c'; cx.fillRect(ox, oy, N * z, N * z);
  // grade
  cx.strokeStyle = '#ffffff10'; cx.lineWidth = 1; cx.beginPath();
  for (let i = 0; i <= N; i++) { cx.moveTo(ox + i * z, oy); cx.lineTo(ox + i * z, oy + N * z); cx.moveTo(ox, oy + i * z); cx.lineTo(ox + N * z, oy + i * z); }
  cx.stroke();
  // território
  const [kx, ky] = toScreen(CX + 0.5, CY + 0.5, w, h);
  cx.fillStyle = '#e9b94922'; cx.beginPath(); cx.arc(kx, ky, z * 2.2, 0, 7); cx.fill();
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  const icon = (s, x, y, size) => { cx.font = `${size}px system-ui, "Apple Color Emoji","Segoe UI Emoji",sans-serif`; cx.fillText(s, x, y); };
  const lvTag = (txt, x, y, col) => {
    cx.font = `bold ${Math.max(9, z * 0.26)}px system-ui`; const tw = cx.measureText(txt).width + 6;
    cx.fillStyle = '#000b'; cx.fillRect(x - tw / 2, y - z * 0.17, tw, z * 0.34); cx.fillStyle = col; cx.fillText(txt, x, y + 1);
  };
  for (const t of S.map) {
    const [sx, sy] = toScreen(t.x + 0.5, t.y + 0.5, w, h);
    if (sx < -z || sy < -z || sx > w + z || sy > h + z) continue;
    if (sel && sel.id === t.id) { cx.strokeStyle = '#e9b949'; cx.lineWidth = 2; cx.strokeRect(sx - z / 2 + 1, sy - z / 2 + 1, z - 2, z - 2); }
    if (t.k === 'bar') {
      const locked = t.lv > S.st.barbMax + 1;
      cx.globalAlpha = locked ? 0.55 : 1; icon('⛺', sx, sy - z * 0.08, z * 0.6); cx.globalAlpha = 1;
      lvTag((locked ? '🔒' : '') + t.lv, sx, sy + z * 0.32, locked ? '#aaa' : '#ff8a6a');
    } else {
      icon({ comida: '🌾', madeira: '🌲', pedra: '⛰️', ouro: '💰' }[t.rt], sx, sy - z * 0.08, z * 0.6);
      lvTag((t.busy ? '🧺' : '') + t.lv, sx, sy + z * 0.32, '#cfe8ff');
    }
  }
  icon('🏰', kx, ky - z * 0.05, z * 0.85);
  lvTag('Você', kx, ky + z * 0.42, '#e9b949');
  // marchas
  const now = Date.now();
  for (const m of S.marches) {
    const [tx, ty] = toScreen(m.x + 0.5, m.y + 0.5, w, h);
    const p = Math.min(1, Math.max(0, (now - m.start) / (m.end - m.start)));
    cx.strokeStyle = m.tipo === 'atk' ? '#ff6a4a' : '#6ac0ff'; cx.setLineDash([5, 5]); cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(kx, ky); cx.lineTo(tx, ty); cx.stroke(); cx.setLineDash([]);
    let px = tx, py = ty;
    if (m.fase === 'ida') { px = kx + (tx - kx) * p; py = ky + (ty - ky) * p; }
    if (m.fase === 'volta') { px = tx + (kx - tx) * p; py = ty + (ky - ty) * p; }
    icon(m.tipo === 'atk' ? '⚔️' : '🧺', px, py, z * 0.45);
  }
}
function mapLoop() { drawMap(); requestAnimationFrame(mapLoop); }

function renderMapPanel() {
  const p = $('#mapPanel');
  if (!sel) { p.innerHTML = ''; return; }
  const t = sel.home ? null : tileById(sel.id);
  if (!sel.home && !t) { sel = null; p.innerHTML = ''; return; }
  let h = `<div class="card">`;
  if (sel.home) {
    h += `<div class="hd"><div class="ic">🏰</div><div><div class="nm">Seu Castelo</div><div class="lv">Nível ${S.b.castelo} · ⚡${fmt(power())}</div></div></div>
      <p>Tropas na cidade: ${TT.map(k => T[k].i + fmt(S.tr[k])).join(' ')}</p>`;
  } else if (t.k === 'bar') {
    const e = barbArmy(t), locked = t.lv > S.st.barbMax + 1;
    h += `<div class="hd"><div class="ic">⛺</div><div><div class="nm">Bárbaros nv ${t.lv}</div><div class="lv">(${t.x},${t.y}) · ${fmt(dist(t.x, t.y))} de distância</div></div></div>
      <p>Tropas: ${TT.map(k => T[k].i + fmt(e[k])).join(' ')}<br>Saque: ${rewHTML(barbLoot(t.lv))} · 💎${5 * t.lv}</p>
      ${locked ? `<span class="lock">🔒 Derrote Bárbaros nv ${t.lv - 1} primeiro</span>` : `<button class="btn" data-act="atk">⚔️ Atacar</button>`}`;
  } else {
    h += `<div class="hd"><div class="ic">${RI[t.rt]}</div><div><div class="nm">Jazida de ${t.rt} nv ${t.lv}</div><div class="lv">(${t.x},${t.y}) · ${fmt(dist(t.x, t.y))} de distância</div></div></div>
      <p>Restante: ${fmt(t.qty)}</p>
      ${t.busy ? `<span class="mut">🧺 Sendo coletada</span>` : `<button class="btn" data-act="col">🧺 Coletar</button>`}`;
  }
  p.innerHTML = h + ` <button class="btn sec sm" data-act="unsel">Fechar</button></div>`;
}
(function mapInput() {
  const pts = new Map(); let moved = 0, pinch = 0;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; });
  cv.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d0 = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX; p.y = e.clientY;
      const d1 = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch && d0) zoom(d1 / d0);
      pinch = 1; moved = 99; return;
    }
    p.x = e.clientX; p.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    cam.x -= dx / cam.z; cam.y -= dy / cam.z; clampCam();
  });
  const up = e => {
    const p = pts.get(e.pointerId); pts.delete(e.pointerId);
    if (pts.size < 2) pinch = 0;
    if (!p || moved > 8 || pts.size) return;
    const r = cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left - r.width / 2) / cam.z + cam.x), y = Math.floor((e.clientY - r.top - r.height / 2) / cam.z + cam.y);
    const t = tileAt(x, y);
    sel = x === CX && y === CY ? { home: 1 } : t ? { id: t.id } : null;
    renderMapPanel();
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', e => pts.delete(e.pointerId));
  cv.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 0.9); }, { passive: false });
})();
function zoom(f) { cam.z = Math.min(90, Math.max(18, cam.z * f)); }
function clampCam() { cam.x = Math.min(N, Math.max(0, cam.x)); cam.y = Math.min(N, Math.max(0, cam.y)); }

/* ---------------- eventos ---------------- */
document.addEventListener('click', e => {
  const tb = e.target.closest('[data-tab]');
  if (tb) {
    tab = tb.dataset.tab;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b === tb));
    $('#view').scrollTop = 0;
    render(); return;
  }
  if (e.target.id === 'modal') return closeModal();
  const a = e.target.closest('[data-act]'); if (!a || a.disabled) return;
  const d = a.dataset;
  switch (d.act) {
    case 'up': upgrade(d.id); break;
    case 'res': research(d.id); break;
    case 'free': speed(d.k, true); break;
    case 'speed': speed(d.k, false); break;
    case 'trainM': trainModal(d.t); return;
    case 'train': train(d.t, +$('#tr').value); closeModal(); break;
    case 'close': closeModal(); break;
    case 'recall': recall(+d.id); break;
    case 'claim': claim(); break;
    case 'atk': case 'col': { const t = tileById(sel && sel.id); if (t) marchModal(t, d.act); return; }
    case 'go': {
      const t = tileById(+d.id); const tr = {};
      for (const k of TT) tr[k] = +$('#m_' + k).value;
      if (t) sendMarch(t, d.k, tr);
      closeModal(); sel = null; break;
    }
    case 'unsel': sel = null; break;
    case 'mapZoom': zoom(+d.v); return;
    case 'mapHome': cam.x = CX + 0.5; cam.y = CY + 0.5; sel = { home: 1 }; break;
    case 'reset':
      if (a.dataset.sure) { newGame(); save(); toast('Novo reino fundado.'); break; }
      a.dataset.sure = 1; a.textContent = 'Toque de novo para apagar tudo'; return;
  }
  render();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { advance(Date.now()); render(); } });
addEventListener('pagehide', save);

/* ---------------- início ---------------- */
load();
const away = Date.now() - S.t;
advance(Date.now());
render();
if (away > 60000) toast(`👋 Bem-vindo de volta! Você ficou fora ${ftime(away)}.`);
requestAnimationFrame(mapLoop);
let saveTick = 0;
setInterval(() => {
  advance(Date.now());
  if ($('#modal').hidden && (dirty || tab !== 'mapa')) render();
  else { renderTop(); timers(); }
  if (++saveTick % 5 === 0) save();
}, 1000);
