'use strict';
/* =====================================================================
   Coroa de Ferro — estratégia de reino (estilo Kingshot / Rise of Kingdoms)

   Arquitetura pensada para virar multiplayer:
   - Todo reino (você ou bot) é um objeto K com o MESMO formato.
   - Todas as ações (evoluir, treinar, marchar...) recebem o reino e o
     instante `now`. Bots e jogador usam exatamente as mesmas funções.
   - O mundo (S) avança por eventos em ordem de tempo (advance()).
     No futuro isso roda num servidor e os bots são trocados por pessoas.
   ===================================================================== */

const SAVE_KEY = 'coroa_save_v2';
const MAXLV = 20, RMAX = 10, N = 60, CX = 30, CY = 30, NBOTS = 24;
const RES = ['comida', 'madeira', 'pedra', 'ouro'];
const RI = { comida: '🌾', madeira: '🪵', pedra: '🪨', ouro: '🪙' };
const SHIELD_NEW = 48 * 3600e3, SHIELD_BUY = 8 * 3600e3, SHIELD_GEMS = 150;

const B = {
  castelo:  { n: 'Castelo', i: '🏰', d: 'Coração do reino. As outras construções não passam do nível dele.', c: { madeira: 250, pedra: 150 }, t: 20 },
  fazenda:  { n: 'Fazenda', i: '🌾', d: 'Produz comida.', c: { madeira: 80 }, t: 8, prod: 'comida', p: 900 },
  serraria: { n: 'Serraria', i: '🪵', d: 'Produz madeira.', c: { comida: 80 }, t: 8, prod: 'madeira', p: 900 },
  pedreira: { n: 'Pedreira', i: '🪨', d: 'Produz pedra.', c: { comida: 80, madeira: 80 }, t: 10, prod: 'pedra', p: 600, req: 2 },
  mina:     { n: 'Mina de Ouro', i: '🪙', d: 'Produz ouro.', c: { comida: 120, madeira: 120, pedra: 60 }, t: 12, prod: 'ouro', p: 400, req: 4 },
  armazem:  { n: 'Armazém', i: '📦', d: 'Aumenta o limite de recursos e protege parte deles de saques.', c: { madeira: 120, pedra: 60 }, t: 10 },
  quartel:  { n: 'Quartel', i: '⚔️', d: 'Treina tropas. Nível maior: lotes maiores e novas tropas.', c: { madeira: 150, pedra: 50 }, t: 12 },
  hospital: { n: 'Hospital', i: '🏥', d: 'Guarda feridos em batalha para serem curados em vez de morrerem.', c: { madeira: 150, pedra: 100 }, t: 12, req: 2 },
  muralha:  { n: 'Muralha', i: '🧱', d: '+3% de defesa por nível quando atacam sua cidade.', c: { madeira: 100, pedra: 200 }, t: 14, req: 2 },
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

const ALS = [
  { id: 1, tag: 'LOB', nome: 'Lobos do Norte', cor: '#6ac0ff' },
  { id: 2, tag: 'FNX', nome: 'Fênix Rubra', cor: '#ff7a5a' },
  { id: 3, tag: 'COR', nome: 'Coroa Dourada', cor: '#f2d16b' },
  { id: 4, tag: 'VRD', nome: 'Guardiões Verdes', cor: '#7ad46a' },
];
const NAMES = ['Aldric', 'Brunhilda', 'Cassius', 'Dagmar', 'Eowyn', 'Fausto', 'Gunnar', 'Helena', 'Ivar', 'Joana', 'Kael', 'Leonor',
  'Magnus', 'Nuno', 'Olga', 'Percival', 'Quitéria', 'Ragnar', 'Sancho', 'Tereza', 'Ulrich', 'Valquíria', 'Wilhelm', 'Ximena',
  'Yago', 'Zaira', 'Baltazar', 'Isolda', 'Rodrigo', 'Morgana'];
const CHAT = ['Bom dia, aliança! ☀️', 'Alguém caçando bárbaros?', 'Obrigado pelas ajudas!', 'Cuidado, tem gente forte no leste.',
  'Vamos crescer juntos 💪', 'Castelo subindo!', 'Quem precisa de ajuda?', 'Boa noite, pessoal 🌙', 'Essa jazida de ouro é minha 😅'];

let me; // reino do jogador (referência rápida)
const Q = [
  { t: 'Evolua o Castelo ao nível 2', ok: () => me.b.castelo >= 2, r: { madeira: 300, pedra: 100 } },
  { t: 'Construa o Quartel', ok: () => me.b.quartel >= 1, r: { comida: 400, madeira: 200 } },
  { t: 'Treine 30 tropas', ok: () => me.st.treinadas >= 30, r: { comida: 500, gemas: 50 } },
  { t: 'Derrote um Bárbaro nível 1 no mapa', ok: () => me.st.barbMax >= 1, r: { madeira: 600, pedra: 300 } },
  { t: 'Entre em uma aliança', ok: () => !!me.al, r: { gemas: 100 } },
  { t: 'Evolua o Castelo ao nível 3', ok: () => me.b.castelo >= 3, r: { comida: 800, madeira: 800, pedra: 400 } },
  { t: 'Peça ajuda à aliança numa construção', ok: () => me.st.ajudas >= 1, r: { madeira: 800, pedra: 400 } },
  { t: 'Construa o Hospital', ok: () => me.b.hospital >= 1, r: { comida: 800, pedra: 400 } },
  { t: 'Colete 1.000 recursos no mapa', ok: () => me.st.coletado >= 1000, r: { comida: 1000, gemas: 50 } },
  { t: 'Construa a Academia', ok: () => me.b.academia >= 1, r: { ouro: 300, madeira: 500 } },
  { t: 'Pesquise Economia nível 1', ok: () => me.rs.eco >= 1, r: { comida: 1500, madeira: 1500 } },
  { t: 'Derrote um Bárbaro nível 3', ok: () => me.st.barbMax >= 3, r: { ouro: 500, gemas: 100 } },
  { t: 'Evolua o Castelo ao nível 5', ok: () => me.b.castelo >= 5, r: { comida: 3000, madeira: 3000, pedra: 2000, ouro: 500 } },
  { t: 'Vença um ataque contra outro reino', ok: () => me.st.pvp >= 1, r: { gemas: 150 } },
  { t: 'Alcance 5.000 de Poder', ok: () => power(me) >= 5000, r: { gemas: 150 } },
  { t: 'Entre no Top 10 de Poder', ok: () => rankOf(me) <= 10, r: { gemas: 300 } },
  { t: 'Evolua o Castelo ao nível 8', ok: () => me.b.castelo >= 8, r: { comida: 10000, madeira: 10000, pedra: 6000, ouro: 2000 } },
  { t: 'Derrote um Bárbaro nível 6', ok: () => me.st.barbMax >= 6, r: { gemas: 200 } },
  { t: 'Evolua o Castelo ao nível 10', ok: () => me.b.castelo >= 10, r: { comida: 30000, madeira: 30000, pedra: 20000, ouro: 8000, gemas: 300 } },
  { t: 'Seja o nº 1 do ranking de Poder', ok: () => rankOf(me) === 1, r: { gemas: 1000 } },
  { t: 'Derrote um Bárbaro nível 10', ok: () => me.st.barbMax >= 10, r: { gemas: 500 } },
  { t: 'Evolua o Castelo ao nível 15', ok: () => me.b.castelo >= 15, r: { gemas: 1000 } },
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
const rnd = Math.random;
const pick = a => a[Math.floor(rnd() * a.length)];
const dxy = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const dist = (x, y) => dxy(x, y, CX, CY);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sum = o => TT.reduce((s, t) => s + (o[t] || 0), 0);
const zero = () => ({ inf: 0, arq: 0, cav: 0 });

/* ---------------- fórmulas (todas por reino) ---------------- */
const bcost = (id, lv) => { const o = {}; for (const k in B[id].c) o[k] = Math.round(B[id].c[k] * 1.55 ** (lv - 1)); return o; };
const btime = (k, id, lv) => B[id].t * 1.62 ** (lv - 1) * (1 - 0.05 * k.rs.constr) * 1000;
const rcost = lv => { const o = {}; const base = { comida: 300, madeira: 300, pedra: 200, ouro: 120 }; for (const r in base) o[r] = Math.round(base[r] * 1.6 ** (lv - 1)); return o; };
const rtime = lv => 30 * 1.55 ** (lv - 1) * 1000;
const cap = k => Math.round(5000 * (k.b.armazem + 1) ** 1.9);
const protect = k => Math.round(2000 * Math.max(1, k.b.armazem) ** 1.7);
const hospCap = k => k.b.hospital ? Math.round(200 * k.b.hospital ** 1.6) : 0;
function rate(k, r) { // por hora
  let v = 150;
  for (const id in B) if (B[id].prod === r && k.b[id] > 0) v += B[id].p * k.b[id] * 1.2 ** (k.b[id] - 1);
  return v * (1 + 0.08 * k.rs.eco);
}
const ttime = k => 2000 * (1 - 0.07 * k.rs.trein);
const tmax = k => 20 + 30 * k.b.quartel;
const maxMarches = k => 1 + Math.floor(k.b.castelo / 5);
const mods = k => ({ atk: 1 + 0.06 * k.rs.fer, def: 1 + 0.06 * k.rs.arm });
const defMods = k => { const m = mods(k); m.def *= 1 + 0.03 * k.b.muralha; return m; };
const canPay = (k, c) => RES.every(r => (k.res[r] || 0) >= (c[r] || 0));
const pay = (k, c) => { for (const r in c) k.res[r] -= c[r]; };
function give(k, r) { for (const x in r) { if (x === 'gemas') k.gemas += r[x]; else k.res[x] = (k.res[x] || 0) + r[x]; } }
const armyPow = (tr, m) => TT.reduce((s, t) => s + (tr[t] || 0) * (T[t].atk + T[t].def), 0) * m.atk;
function power(k) {
  let p = 0;
  for (const id in B) p += 10 * k.b[id] ** 2;
  for (const id in R) p += 25 * k.rs[id] ** 2;
  const all = { ...k.tr };
  for (const m of S.M) if (m.k === k.id) for (const t of TT) all[t] += m.tropas[t];
  for (const t of TT) p += (all[t] + k.fer[t]) * (T[t].atk + T[t].def) / 4;
  return Math.round(p);
}
const costHTML = (k, c) => '<div class="cost">' + Object.keys(c).map(r =>
  `<span class="${(k.res[r] || 0) >= c[r] ? '' : 'no'}">${RI[r]} ${fmt(c[r])}</span>`).join('') + '</div>';
const rewHTML = r => Object.keys(r).map(k => `${k === 'gemas' ? '💎' : RI[k]} ${fmt(r[k])}`).join(' · ');
const trHTML = tr => TT.filter(t => tr[t]).map(t => T[t].i + fmt(tr[t])).join(' ') || '—';

/* ---------------- estado ---------------- */
let S;
const kById = id => S.K.find(k => k.id === id);
const alById = id => ALS.find(a => a.id === id);
const alTag = k => k.al ? `[${alById(k.al).tag}]` : '';
const shielded = (k, now) => k.escudo > now;
const ranking = () => [...S.K].sort((a, b) => power(b) - power(a));
const rankOf = k => ranking().indexOf(k) + 1;

function mkKingdom(nome, bot, x, y) {
  return {
    id: S.nid++, nome, bot, x, y, al: null, gemas: bot ? 0 : 300, escudo: 0,
    res: { comida: 1500, madeira: 1500, pedra: 800, ouro: 300 },
    b: { castelo: 1, fazenda: 1, serraria: 1, pedreira: 0, mina: 0, armazem: 1, quartel: 0, hospital: 0, muralha: 0, academia: 0 },
    rs: { eco: 0, constr: 0, fer: 0, arm: 0, trein: 0, log: 0 },
    tr: { inf: 40, arq: 0, cav: 0 }, fer: zero(),
    bq: null, tq: null, rq: null, hq: null,
    st: { treinadas: 0, barbMax: 0, coletado: 0, vitorias: 0, pvp: 0, abates: 0, ajudas: 0 },
    ai: bot ? { next: S.t + rnd() * 120e3, ritmo: 0.6 + rnd(), agress: 0.02 + rnd() * 0.13, raiva: null, pvpEm: 0, visto: S.t } : null,
  };
}
function boostBot(k, L) { // bots começam em estágios diferentes, como num servidor real
  const r = () => Math.floor(rnd() * 2);
  k.b.castelo = L;
  for (const id of ['fazenda', 'serraria', 'armazem', 'quartel']) k.b[id] = Math.max(1, L - r());
  if (L >= 2) { k.b.pedreira = L - 1; k.b.hospital = Math.max(1, L - 1 - r()); k.b.muralha = Math.max(1, L - 1 - r()); }
  if (L >= 3) k.b.academia = L - 2 || 1;
  if (L >= 4) k.b.mina = L - 2;
  for (const id in R) k.rs[id] = Math.min(k.b.academia, Math.floor(rnd() * (k.b.academia + 1)));
  const tot = Math.round(40 * L ** 1.8);
  k.tr.inf = Math.round(tot * (k.b.quartel >= 3 ? 0.5 : 1));
  if (k.b.quartel >= 3) k.tr.arq = Math.round(tot * (k.b.quartel >= 5 ? 0.25 : 0.5));
  if (k.b.quartel >= 5) k.tr.cav = Math.round(tot * 0.25);
  for (const r of RES) k.res[r] = Math.round(cap(k) * (0.2 + rnd() * 0.4));
  k.st.barbMax = Math.max(0, L - 1);
}
function newGame() {
  const now = Date.now();
  S = { v: 2, t: now, nid: 1, K: [], map: [], M: [], rel: [], feed: [], q: 0, me: 0 };
  me = mkKingdom('Você', false, CX, CY);
  me.escudo = now + SHIELD_NEW;
  S.K.push(me); S.me = me.id;
  const names = [...NAMES].sort(() => rnd() - 0.5);
  for (let i = 0; i < NBOTS; i++) {
    let x, y, ok = false;
    for (let t = 0; t < 400 && !ok; t++) {
      x = 2 + Math.floor(rnd() * (N - 4)); y = 2 + Math.floor(rnd() * (N - 4));
      ok = dist(x, y) >= 5 && S.K.every(k => dxy(k.x, k.y, x, y) >= 4);
    }
    const nome = names[i] + (rnd() < 0.4 ? (1 + Math.floor(rnd() * 98)) : '');
    const k = mkKingdom(nome, true, x, y);
    const roll = rnd();
    boostBot(k, roll < 0.45 ? 1 + Math.floor(rnd() * 2) : roll < 0.85 ? 3 + Math.floor(rnd() * 3) : 6 + Math.floor(rnd() * 3));
    if (rnd() < 0.8) k.al = pick(ALS).id;
    S.K.push(k);
  }
  for (let i = 0; i < 110; i++) spawn('bar');
  for (let i = 0; i < 70; i++) spawn('res');
}
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 2) { S = s; me = kById(S.me); return; } } catch (e) {}
  newGame();
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }

/* ---------------- mapa: geração ---------------- */
function spawn(kind) {
  const occ = new Set(S.map.map(t => t.x + ',' + t.y));
  for (const k of S.K) occ.add(k.x + ',' + k.y);
  for (let tries = 0; tries < 300; tries++) {
    const x = Math.floor(rnd() * N), y = Math.floor(rnd() * N);
    const d = dist(x, y);
    if (occ.has(x + ',' + y) || S.K.some(k => dxy(k.x, k.y, x, y) < 1.5)) continue;
    const t = { id: S.nid++, x, y, k: kind };
    if (kind === 'bar') {
      t.lv = Math.max(1, Math.min(15, Math.round(d / 2.6 + (rnd() * 2 - 1))));
      const a = 0.2 + rnd() * 0.6, b = (1 - a) * rnd();
      t.mix = [a, b, 1 - a - b];
    } else {
      t.rt = RES[Math.floor(rnd() * (d < 8 ? 2 : 4))];
      t.lv = Math.max(1, Math.min(8, Math.round(d / 4 + rnd())));
      t.qty = 6000 * t.lv;
    }
    S.map.push(t);
    return t;
  }
}
const tileAt = (x, y) => S.map.find(t => t.x === x && t.y === y);
const cityAt = (x, y) => S.K.find(k => k.x === x && k.y === y);
const tileById = id => S.map.find(t => t.id === id);
function barbArmy(t) {
  const tot = Math.round(22 * t.lv ** 1.8);
  return { inf: Math.round(tot * t.mix[0]), arq: Math.round(tot * t.mix[1]), cav: Math.round(tot * t.mix[2]) };
}
const barbMods = lv => ({ atk: 1 + 0.04 * lv, def: 1 + 0.04 * lv });
const barbLoot = lv => ({ comida: Math.round(350 * lv ** 1.6), madeira: Math.round(350 * lv ** 1.6), pedra: Math.round(180 * lv ** 1.6), ouro: Math.round(80 * lv ** 1.6) });

/* ---------------- batalha ---------------- */
function battle(A, B_, mA, mB) {
  const a = { ...A }, b = { ...B_ };
  const hit = (att, def, ma, md) => {
    const loss = zero(), td = sum(def);
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
  for (let r = 0; r < 12 && sum(a) >= 0.5 && sum(b) >= 0.5; r++) {
    const la = hit(b, a, mB, mA), lb = hit(a, b, mA, mB);
    for (const t of TT) { a[t] = Math.max(0, a[t] - la[t]); b[t] = Math.max(0, b[t] - lb[t]); }
  }
  const out = (x, orig) => { const o = {}; for (const t of TT) o[t] = x[t] < 0.5 ? 0 : Math.min(Math.round(x[t]), orig[t] || 0); return o; };
  const ra = out(a, A), rb = out(b, B_);
  return { win: sum(rb) === 0 && sum(ra) > 0, a: ra, b: rb };
}
// perdas viram feridos até a capacidade livre do hospital; o resto morre
function wound(k, loss, share = 1) {
  let free = Math.max(0, hospCap(k) - sum(k.fer));
  const w = zero();
  for (const t of TT) { const n = Math.min(free, Math.floor(loss[t] * share)); w[t] = n; free -= n; k.fer[t] += n; }
  return w;
}

/* ---------------- motor de tempo ---------------- */
function produce(t) {
  const dt = (t - S.t) / 3600000;
  if (dt <= 0) return;
  for (const k of S.K) {
    const c = cap(k);
    for (const r of RES) if (k.res[r] < c) k.res[r] = Math.min(c, k.res[r] + rate(k, r) * dt);
  }
  S.t = t;
}
function nextEvent() {
  let e = null;
  const c = (t, tp, k, m) => { if (!e || t < e.t) e = { t, tp, k, m }; };
  for (const k of S.K) {
    if (k.bq) c(k.bq.end, 'bq', k);
    if (k.tq) c(k.tq.end, 'tq', k);
    if (k.rq) c(k.rq.end, 'rq', k);
    if (k.hq) c(k.hq.end, 'hq', k);
    if (k.ai) c(k.ai.next, 'ai', k);
  }
  for (const m of S.M) c(m.end, 'm', null, m);
  return e;
}
let dirty = true;
function advance(to) {
  for (let g = 0; g < 500000; g++) {
    const e = nextEvent();
    if (!e || e.t > to) break;
    produce(e.t);
    fire(e);
    if (e.tp !== 'ai' || e.k === me) dirty = true;
  }
  produce(to);
}
function fire(e) {
  const k = e.k, now = e.t, mine = k === me;
  if (e.tp === 'bq') {
    k.b[k.bq.id] = k.bq.to;
    if (mine) toast(`${B[k.bq.id].i} ${B[k.bq.id].n} chegou ao nível ${k.bq.to}!`);
    else if (k.bq.id === 'castelo' && k.bq.to >= 3) feed(k, `evoluiu o Castelo para o nível ${k.bq.to} 🏰`);
    k.bq = null;
  } else if (e.tp === 'tq') {
    k.tr[k.tq.t] += k.tq.n; k.st.treinadas += k.tq.n;
    if (mine) toast(`${T[k.tq.t].i} ${k.tq.n} ${T[k.tq.t].n} prontos!`);
    k.tq = null;
  } else if (e.tp === 'rq') {
    k.rs[k.rq.id] = k.rq.to;
    if (mine) toast(`📜 ${R[k.rq.id].n} nível ${k.rq.to} concluída!`);
    k.rq = null;
  } else if (e.tp === 'hq') {
    for (const t of TT) k.tr[t] += k.hq.tr[t];
    if (mine) toast(`🏥 ${fmt(sum(k.hq.tr))} tropas curadas!`);
    k.hq = null;
  } else if (e.tp === 'ai') think(k, now);
  else marchEvent(e.m, now);
}

/* ---------------- ações (jogador e bots usam as mesmas) ---------------- */
function err(k, msg) { if (k === me) toast(msg); return false; }
function canBuild(k, id) {
  const lv = k.b[id], to = lv + 1, b = B[id];
  if (lv >= MAXLV) return 'Nível máximo';
  if (b.req && k.b.castelo < b.req && lv === 0) return `🔒 Requer Castelo nv ${b.req}`;
  if (id !== 'castelo' && to > k.b.castelo) return `🔒 Requer Castelo nv ${to}`;
  return '';
}
function upgrade(k, id, now) {
  const to = k.b[id] + 1, c = bcost(id, to);
  if (k.bq) return err(k, 'Já há uma construção em andamento.');
  if (canBuild(k, id)) return err(k, canBuild(k, id));
  if (!canPay(k, c)) return err(k, 'Recursos insuficientes.');
  pay(k, c);
  const dur = btime(k, id, to);
  k.bq = { id, to, start: now, end: now + dur, dur };
  if (k.bot) askHelp(k, now);
  return true;
}
function research(k, id, now) {
  const to = k.rs[id] + 1, c = rcost(to);
  if (k.rq) return err(k, 'Já há uma pesquisa em andamento.');
  if (to > k.b.academia || to > RMAX) return err(k, 'Academia em nível baixo.');
  if (!canPay(k, c)) return err(k, 'Recursos insuficientes.');
  pay(k, c);
  const dur = rtime(to);
  k.rq = { id, to, start: now, end: now + dur, dur };
  if (k.bot) askHelp(k, now, 'rq');
  return true;
}
function train(k, t, n, now) {
  n = Math.floor(n);
  if (k.tq) return err(k, 'O quartel já está treinando.');
  if (k.b.quartel < T[t].req) return err(k, 'Quartel em nível baixo.');
  const c = {}; for (const r in T[t].c) c[r] = T[t].c[r] * n;
  if (n <= 0 || !canPay(k, c)) return err(k, 'Recursos insuficientes.');
  pay(k, c);
  k.tq = { t, n, start: now, end: now + ttime(k) * n };
  return true;
}
function healCost(k) {
  const c = {};
  for (const t of TT) for (const r in T[t].c) c[r] = (c[r] || 0) + Math.ceil(T[t].c[r] * 0.4 * k.fer[t]);
  return c;
}
function heal(k, now) {
  if (k.hq || !sum(k.fer)) return false;
  const c = healCost(k);
  if (!canPay(k, c)) return err(k, 'Recursos insuficientes para curar.');
  pay(k, c);
  k.hq = { tr: { ...k.fer }, start: now, end: now + sum(k.fer) * 600 * (1 - 0.05 * k.rs.constr) };
  k.fer = zero();
  return true;
}
// Ajuda da aliança: cada membro reduz 1% do tempo total (mínimo 1 min)
function askHelp(k, now, qk = 'bq') {
  const q = k[qk];
  if (!q || q.help || !k.al) return 0;
  const n = Math.min(20, S.K.filter(o => o !== k && o.al === k.al).length);
  q.help = n;
  q.end = Math.max(now, q.end - n * Math.max(60e3, q.dur * 0.01));
  k.st.ajudas++;
  return n;
}
function buyShield(k, now) {
  if (k.gemas < SHIELD_GEMS) return err(k, 'Gemas insuficientes.');
  k.gemas -= SHIELD_GEMS;
  k.escudo = Math.max(k.escudo, now) + SHIELD_BUY;
  return true;
}
function joinAlliance(k, id) { k.al = id; if (k === me) S.feed = []; }

/* ---------------- marchas ---------------- */
const march = (k, tropas) => {
  const spd = Math.min(...TT.filter(t => tropas[t] > 0).map(t => T[t].spd));
  return { spd: spd * (1 + 0.1 * k.rs.log), carga: TT.reduce((s, t) => s + tropas[t] * T[t].carga, 0) * (1 + 0.1 * k.rs.log) };
};
const travelMs = (k, x, y, tropas) => dxy(k.x, k.y, x, y) * 4000 / march(k, tropas).spd;
const gatherRate = k => 4 * (1 + 0.08 * k.rs.eco);
const marchesOf = k => S.M.filter(m => m.k === k.id);

function sendMarch(k, tipo, alvo, tropas, now) {
  if (sum(tropas) <= 0) return err(k, 'Escolha as tropas.');
  if (marchesOf(k).length >= maxMarches(k)) return err(k, 'Todas as marchas estão ocupadas.');
  for (const t of TT) if ((tropas[t] || 0) > k.tr[t]) return err(k, 'Tropas insuficientes.');
  if (tipo === 'pvp') {
    if (alvo.al && alvo.al === k.al) return err(k, 'Não dá para atacar a própria aliança.');
    if (shielded(alvo, now)) return err(k, 'Esse reino está protegido por escudo.');
    k.escudo = 0; // atacar quebra o seu escudo
  }
  tropas = { ...zero(), ...tropas };
  for (const t of TT) k.tr[t] -= tropas[t];
  const dur = travelMs(k, alvo.x, alvo.y, tropas);
  S.M.push({ id: S.nid++, k: k.id, tipo, tid: alvo.id, x: alvo.x, y: alvo.y, tropas, fase: 'ida', start: now, end: now + dur, dur, carga: {} });
  if (tipo === 'pvp' && alvo === me) toast(`⚠️ ${esc(k.nome)} está marchando contra você!`);
  return true;
}
function back(m, now) { m.fase = 'volta'; m.start = now; m.end = now + m.dur; }
function report(win, titulo, txt) {
  S.rel.unshift({ t: S.t, win, titulo, txt });
  S.rel.length = Math.min(S.rel.length, 40);
}
function feed(k, txt) {
  if (!me.al || k.al !== me.al) return;
  S.feed.unshift({ t: S.t, n: k.nome, txt });
  S.feed.length = Math.min(S.feed.length, 40);
}
function marchEvent(m, now) {
  const k = kById(m.k), mine = k === me;
  if (m.fase === 'volta') {
    for (const t of TT) k.tr[t] += m.tropas[t];
    give(k, m.carga);
    S.M = S.M.filter(x => x !== m);
    if (mine) toast('🏰 Marcha voltou' + (Object.keys(m.carga).length ? ' com ' + rewHTML(m.carga) : ''));
    return;
  }
  if (m.tipo === 'pvp') return pvpArrive(m, k, now);
  const tile = tileById(m.tid);
  if (m.fase === 'col') {
    const got = Math.min(m.amt, tile ? tile.qty : m.amt);
    if (tile) { tile.qty -= got; tile.busy = null; if (tile.qty <= 0) { S.map = S.map.filter(t => t !== tile); spawn('res'); } }
    m.carga = { [m.rt]: got };
    k.st.coletado += got;
    return back(m, now);
  }
  if (!tile || (m.tipo === 'col' && tile.busy && tile.busy !== m.id)) {
    if (mine) report(false, 'Alvo perdido', 'O alvo não estava mais lá. A marcha está voltando.');
    return back(m, now);
  }
  if (m.tipo === 'col') {
    tile.busy = m.id;
    m.amt = Math.floor(Math.min(tile.qty, march(k, m.tropas).carga));
    m.rt = tile.rt;
    m.fase = 'col'; m.start = now; m.end = now + (m.amt / gatherRate(k)) * 1000;
    return;
  }
  // ataque a bárbaros
  const res = battle(m.tropas, barbArmy(tile), mods(k), barbMods(tile.lv));
  const lost = {}; for (const t of TT) lost[t] = m.tropas[t] - res.a[t];
  const w = wound(k, lost, 0.7);
  m.tropas = res.a;
  const lostTxt = `${trHTML(lost)} (🏥 ${fmt(sum(w))} feridos)`;
  if (res.win) {
    const loot = barbLoot(tile.lv); loot.gemas = 5 * tile.lv;
    m.carga = loot;
    k.st.barbMax = Math.max(k.st.barbMax, tile.lv); k.st.vitorias++;
    S.map = S.map.filter(t => t !== tile); spawn('bar');
    if (mine) { report(true, `Vitória contra Bárbaros nv ${tile.lv}`, `Perdas: ${lostTxt}. Saque: ${rewHTML(loot)}`); toast(`🏆 Vitória contra Bárbaros nv ${tile.lv}!`); }
    else if (tile.lv >= 4) feed(k, `derrotou Bárbaros nv ${tile.lv} ⚔️`);
  } else if (mine) {
    report(false, `Derrota contra Bárbaros nv ${tile.lv}`, `Perdas: ${lostTxt}.`);
    toast(`💀 Derrota contra Bárbaros nv ${tile.lv}`);
  }
  if (!sum(m.tropas)) { S.M = S.M.filter(x => x !== m); return; }
  back(m, now);
}
function pvpArrive(m, k, now) {
  const d = kById(m.tid);
  if (!d || shielded(d, now) || (d.al && d.al === k.al)) {
    if (k === me) report(false, 'Ataque cancelado', 'O alvo ativou um escudo ou mudou de aliança. A marcha está voltando.');
    return back(m, now);
  }
  const res = battle(m.tropas, d.tr, mods(k), defMods(d));
  const la = {}, ld = {};
  for (const t of TT) { la[t] = m.tropas[t] - res.a[t]; ld[t] = d.tr[t] - res.b[t]; }
  const wa = wound(k, la, 0.5), wd = wound(d, ld, 1);
  m.tropas = res.a; d.tr = res.b;
  k.st.abates += sum(ld); d.st.abates += sum(la);
  const loot = {};
  if (res.win) {
    const room = march(k, m.tropas).carga;
    const avail = {}; let tot = 0;
    for (const r of RES) { avail[r] = Math.max(0, d.res[r] - protect(d)) * 0.35; tot += avail[r]; }
    const f = tot > 0 ? Math.min(1, room / tot) : 0;
    for (const r of RES) { const v = Math.floor(avail[r] * f); if (v > 0) { loot[r] = v; d.res[r] -= v; } }
    m.carga = loot; k.st.pvp++;
  }
  if (d.ai) d.ai.raiva = k.id;
  const txt = `Atacante perdeu ${trHTML(la)} (🏥${fmt(sum(wa))}). Defensor perdeu ${trHTML(ld)} (🏥${fmt(sum(wd))}).` +
    (res.win ? ` Saque: ${rewHTML(loot) || 'nada'}` : '');
  if (k === me) { report(res.win, `${res.win ? 'Vitória' : 'Derrota'} atacando ${esc(d.nome)}`, txt); toast(res.win ? `🏆 Você saqueou ${esc(d.nome)}!` : `💀 Ataque a ${esc(d.nome)} falhou`); }
  if (d === me) { report(!res.win, `${res.win ? 'Sua cidade foi saqueada' : 'Você defendeu a cidade'} — ${esc(k.nome)} ${alTag(k)}`, txt); toast(res.win ? `🔥 ${esc(k.nome)} saqueou sua cidade!` : `🛡️ Você repeliu ${esc(k.nome)}!`); }
  if (k !== me && d !== me && me.al) {
    if (k.al === me.al) feed(k, `${res.win ? 'saqueou' : 'atacou sem sucesso'} ${esc(d.nome)}`);
    else if (d.al === me.al) feed(d, `${res.win ? 'foi saqueado(a) por' : 'defendeu-se de'} ${esc(k.nome)}`);
  }
  if (!sum(m.tropas)) { S.M = S.M.filter(x => x !== m); return; }
  back(m, now);
}
function recall(k, id, now) {
  const m = S.M.find(x => x.id === id && x.k === k.id);
  if (!m || m.fase === 'volta') return;
  if (m.fase === 'ida') { m.fase = 'volta'; const el = now - m.start; m.start = now; m.end = now + el; }
  else {
    const got = Math.floor(m.amt * (now - m.start) / (m.end - m.start));
    const tile = tileById(m.tid);
    if (tile) { tile.qty -= got; tile.busy = null; }
    m.carga = { [m.rt]: got }; k.st.coletado += got;
    back(m, now);
  }
}

/* ---------------- IA dos bots ---------------- */
function think(k, now) {
  const ai = k.ai;
  ai.visto = now;
  // construção: castelo quando o resto acompanha, senão o prédio mais atrasado
  if (!k.bq) {
    const behind = ['fazenda', 'serraria', 'armazem', 'quartel'].some(id => k.b[id] < k.b.castelo);
    const score = id => id === 'castelo' ? (behind ? 99 : -1) : k.b[id];
    const ids = Object.keys(B).filter(id => !canBuild(k, id)).sort((a, b) => score(a) - score(b));
    for (const id of ids.slice(0, 3)) if (canPay(k, bcost(id, k.b[id] + 1))) { upgrade(k, id, now); break; }
  }
  if (k.b.academia && !k.rq) {
    const ids = Object.keys(R).sort((a, b) => k.rs[a] - k.rs[b]);
    for (const id of ids) if (k.rs[id] < Math.min(RMAX, k.b.academia) && canPay(k, rcost(k.rs[id] + 1))) { research(k, id, now); break; }
  }
  if (!k.hq && sum(k.fer)) heal(k, now);
  if (k.b.quartel && !k.tq) {
    const t = pick(TT.filter(t => k.b.quartel >= T[t].req));
    const afford = Math.min(...Object.keys(T[t].c).map(r => k.res[r] / T[t].c[r]));
    const n = Math.min(tmax(k), Math.floor(afford * (k.bq ? 0.6 : 0.3)));
    if (n >= 5) train(k, t, n, now);
  }
  // marchas: vingança/saque, depois bárbaros, depois coleta
  for (let g = 0; g < 3 && marchesOf(k).length < maxMarches(k) && sum(k.tr) >= 15; g++) {
    const army = { ...k.tr }, ap = armyPow(army, mods(k));
    let ok = false;
    if ((rnd() < ai.agress || ai.raiva) && now - (ai.pvpEm || 0) > 3600e3) {
      const alvos = S.K.filter(o => o !== k && (!k.al || o.al !== k.al) && !shielded(o, now) &&
        dxy(k.x, k.y, o.x, o.y) <= 20 && armyPow(o.tr, defMods(o)) * 2 < ap &&
        RES.some(r => o.res[r] - protect(o) > 2000))
        .sort((a, b) => (b.id === ai.raiva) - (a.id === ai.raiva) || dxy(k.x, k.y, a.x, a.y) - dxy(k.x, k.y, b.x, b.y));
      if (alvos.length && (ok = sendMarch(k, 'pvp', alvos[0], army, now))) ai.pvpEm = now;
      ai.raiva = null;
    }
    if (!ok) {
      const bar = S.map.filter(t => t.k === 'bar' && t.lv <= k.st.barbMax + 1 && dxy(k.x, k.y, t.x, t.y) <= 15 &&
        armyPow(barbArmy(t), barbMods(t.lv)) * 1.7 < ap).sort((a, b) => b.lv - a.lv || dxy(k.x, k.y, a.x, a.y) - dxy(k.x, k.y, b.x, b.y));
      if (bar.length) ok = sendMarch(k, 'atk', bar[0], army, now);
    }
    if (!ok) {
      const res = S.map.filter(t => t.k === 'res' && !t.busy && !S.M.some(m => m.tid === t.id) && dxy(k.x, k.y, t.x, t.y) <= 15)
        .sort((a, b) => dxy(k.x, k.y, a.x, a.y) - dxy(k.x, k.y, b.x, b.y));
      if (res.length) {
        const tr = zero(); let need = res[0].qty;
        for (const t of TT) { const n = Math.min(k.tr[t], Math.ceil(need / T[t].carga)); tr[t] = n; need -= n * T[t].carga; if (need <= 0) break; }
        ok = sendMarch(k, 'col', res[0], tr, now);
      }
    }
    if (!ok) break;
  }
  if (rnd() < 0.03) feed(k, '💬 ' + pick(CHAT));
  // como gente de verdade: às vezes some por horas (dormindo, trabalhando)
  ai.next = now + (rnd() < 0.12 / ai.ritmo ? (1 + rnd() * 5) * 3600e3 : (90 + rnd() * 300) * 1000 / ai.ritmo);
}

/* ---------------- UI ---------------- */
let tab = 'cidade', sel = null;
function toast(msg) {
  const d = document.createElement('div'); d.innerHTML = msg;
  $('#toast').appendChild(d);
  setTimeout(() => d.remove(), 3200);
}
const gemCost = q => Math.max(1, Math.ceil((q.end - Date.now()) / 60000));
function speed(qk, free) {
  const q = me[qk]; if (!q) return;
  if (free) { if (q.end - Date.now() > 300000) return; }
  else { const g = gemCost(q); if (me.gemas < g) return toast('Gemas insuficientes.'); me.gemas -= g; }
  q.end = Date.now();
  advance(Date.now());
}
function claim() {
  const q = Q[S.q];
  if (!q || !q.ok()) return;
  give(me, q.r); S.q++;
  toast('🎁 Recompensa: ' + rewHTML(q.r));
}
const queueHTML = (qk, label) => {
  const q = me[qk]; if (!q) return '';
  const left = q.end - Date.now();
  const help = (qk === 'bq' || qk === 'rq') && me.al && !q.help;
  return `<div class="card queue"><div class="row" style="justify-content:space-between">
    <b>${label}</b><span class="cd" data-end="${q.end}">${ftime(left)}</span></div>
    <div class="bar"><i class="pb" data-s="${q.start}" data-e="${q.end}"></i></div>
    <div class="row">${help ? `<button class="btn sec sm" data-act="help" data-k="${qk}">🤝 Pedir ajuda</button>` : ''}
    ${q.help ? `<span class="mut">🤝 ${q.help} ajudas</span>` : ''}
    ${qk !== 'tq' && qk !== 'hq' && left <= 300000
      ? `<button class="btn sm" data-act="free" data-k="${qk}">Grátis ✨</button>`
      : `<button class="btn gem sm" data-act="speed" data-k="${qk}">Acelerar 💎${gemCost(q)}</button>`}</div></div>`;
};

const incoming = () => S.M.filter(m => m.tipo === 'pvp' && m.tid === me.id && m.fase === 'ida');
function renderTop() {
  const c = cap(me), now = Date.now();
  $('#resbar').innerHTML = RES.map(r => `<div class="r ${me.res[r] >= c ? 'full' : ''}">${RI[r]} <b>${fmt(me.res[r])}</b><small>+${fmt(rate(me, r))}/h</small></div>`).join('');
  const inc = incoming().sort((a, b) => a.end - b.end)[0];
  $('#meta').innerHTML = inc
    ? `<span class="alert">⚠️ Ataque de ${esc(kById(inc.k).nome)} em <b class="cd" data-end="${inc.end}">${ftime(inc.end - now)}</b></span>`
    : `<span>⚡ <b>${fmt(power(me))}</b> · #${rankOf(me)}</span>${shielded(me, now) ? `<span>🛡️ <b class="cd" data-end="${me.escudo}">${ftime(me.escudo - now)}</b></span>` : ''}<span>💎 <b>${fmt(me.gemas)}</b></span>`;
}

function questHTML() {
  const q = Q[S.q];
  if (!q) return `<div class="card quest"><b>👑 Todas as missões concluídas.</b></div>`;
  return `<div class="card quest"><div class="row" style="justify-content:space-between;flex-wrap:nowrap">
    <div><div class="mut">🎯 Missão ${S.q + 1}/${Q.length}</div><b>${q.t}</b><div class="mut">${rewHTML(q.r)}</div></div>
    <button class="btn sm" data-act="claim" ${q.ok() ? '' : 'disabled'}>${q.ok() ? 'Resgatar' : '…'}</button></div></div>`;
}

function vCidade() {
  const now = Date.now();
  let h = `<div>${questHTML()}<h2>🏰 Seu Reino ${alTag(me)}</h2>`;
  h += queueHTML('bq', me.bq ? `${B[me.bq.id].i} ${B[me.bq.id].n} → nv ${me.bq.to}` : '');
  if (!me.bq) h += `<p class="mut">🔨 Construtor livre — escolha algo para evoluir.</p>`;
  h += `<div class="grid" style="margin-top:10px">`;
  for (const id in B) {
    const b = B[id], lv = me.b[id], to = lv + 1, why = canBuild(me, id);
    let act;
    if (why) act = `<span class="${lv >= MAXLV ? 'mut' : 'lock'}">${why}</span>`;
    else {
      const c = bcost(id, to);
      act = costHTML(me, c) + `<div class="row"><button class="btn sm" data-act="up" data-id="${id}" ${me.bq || !canPay(me, c) ? 'disabled' : ''}>${lv ? 'Evoluir' : 'Construir'}</button><span class="mut">⏱ ${ftime(btime(me, id, to))}</span></div>`;
    }
    let info = '';
    if (b.prod) info = `<p>${RI[b.prod]} ${lv ? '+' + fmt(b.p * lv * 1.2 ** (lv - 1) * (1 + 0.08 * me.rs.eco)) + '/h' : '—'}</p>`;
    if (id === 'armazem') info = `<p>📦 Limite ${fmt(cap(me))} · 🔒 protegido ${fmt(protect(me))}</p>`;
    if (id === 'quartel') info = `<p>Lote máx. ${lv ? tmax(me) : 0}</p>`;
    if (id === 'hospital') info = `<p>🏥 ${fmt(sum(me.fer))}/${fmt(hospCap(me))} feridos</p>`;
    if (id === 'muralha') info = `<p>🛡️ +${3 * lv}% defesa</p>`;
    if (id === 'castelo') info = `<p>Marchas: ${maxMarches(me)} · ${shielded(me, now) ? '🛡️ Escudo ativo' : 'Sem escudo'}</p>
      <p><button class="btn gem sm" data-act="shield">🛡️ Escudo 8h · 💎${SHIELD_GEMS}</button></p>`;
    if (id === 'academia' && lv) info = `<p><button class="btn sec sm" data-act="goRes">📜 Abrir pesquisas</button></p>`;
    h += `<div class="card ${me.bq && me.bq.id === id ? 'busy' : ''}"><div class="hd"><div class="ic">${b.i}</div><div><div class="nm">${b.n}</div><div class="lv">${lv ? 'Nível ' + lv : 'Não construído'}</div></div></div><p>${b.d}</p>${info}${act}</div>`;
  }
  return h + `</div></div>`;
}

function vExercito() {
  let h = `<div><h2>⚔️ Exército</h2><div class="grid">`;
  for (const t of TT) {
    const u = T[t], ok = me.b.quartel >= u.req;
    h += `<div class="card"><div class="hd"><div class="ic">${u.i}</div><div><div class="nm">${u.n}</div><div class="lv">${fmt(me.tr[t])} na cidade${me.fer[t] ? ` · 🏥${fmt(me.fer[t])}` : ''}</div></div></div>
      <p>⚔️${u.atk} 🛡️${u.def} ❤️${u.hp} 🎒${u.carga}${u.spd > 1 ? ' 💨rápida' : ''}<br>Forte contra ${T[BEATS[t]].n}</p>
      ${ok ? `<button class="btn sm" data-act="trainM" data-t="${t}" ${me.tq ? 'disabled' : ''}>Treinar</button>` : `<span class="lock">🔒 Requer Quartel nv ${u.req}</span>`}</div>`;
  }
  h += `</div>`;
  if (me.tq) h += `<h3>Treinando</h3>` + queueHTML('tq', `${T[me.tq.t].i} ${me.tq.n} ${T[me.tq.t].n}`);
  if (me.hq) h += `<h3>Curando</h3>` + queueHTML('hq', `🏥 ${fmt(sum(me.hq.tr))} tropas`);
  else if (sum(me.fer)) h += `<h3>Feridos</h3><div class="card"><div>🏥 ${trHTML(me.fer)}</div>${costHTML(me, healCost(me))}<button class="btn sm" data-act="heal" ${canPay(me, healCost(me)) ? '' : 'disabled'}>Curar todos</button></div>`;
  const inc = incoming();
  if (inc.length) {
    h += `<h3 class="alert">⚠️ Ataques a caminho</h3><div class="list">`;
    for (const m of inc) { const k = kById(m.k); h += `<div class="card rep lose"><b>${esc(k.nome)} ${alTag(k)}</b> · chega em <span class="cd" data-end="${m.end}">${ftime(m.end - Date.now())}</span><div class="mut">Tropas: ${trHTML(m.tropas)}</div></div>`; }
    h += `</div><p class="mut">Dica: ative um escudo no Castelo ou reforce a defesa.</p>`;
  }
  h += `<h3>Marchas (${marchesOf(me).length}/${maxMarches(me)})</h3><div class="list">`;
  if (!marchesOf(me).length) h += `<p class="mut">Nenhuma marcha. Vá ao 🗺️ Mapa para atacar ou coletar.</p>`;
  for (const m of marchesOf(me)) {
    const alvo = m.tipo === 'pvp' ? kById(m.tid) : null;
    const f = { ida: m.tipo === 'col' ? 'Indo coletar' : 'Indo atacar' + (alvo ? ' ' + esc(alvo.nome) : ''), col: 'Coletando', volta: 'Voltando' }[m.fase];
    h += `<div class="card"><div class="row" style="justify-content:space-between"><b>${f} (${m.x},${m.y})</b><span class="cd" data-end="${m.end}">${ftime(m.end - Date.now())}</span></div>
      <div class="bar"><i class="pb" data-s="${m.start}" data-e="${m.end}"></i></div>
      <div class="row"><span class="mut">${trHTML(m.tropas)}</span>
      ${m.fase !== 'volta' ? `<button class="btn sec sm" data-act="recall" data-id="${m.id}">Chamar de volta</button>` : ''}</div></div>`;
  }
  h += `</div><h3>Relatórios</h3><div class="list">`;
  if (!S.rel.length) h += `<p class="mut">Sem relatórios ainda.</p>`;
  for (const r of S.rel) h += `<div class="card rep ${r.win ? 'win' : 'lose'}"><b>${r.titulo}</b> <span class="tag">${new Date(r.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span><div class="mut">${r.txt}</div></div>`;
  return h + `</div></div>`;
}

function vPesquisa() {
  let h = `<div><button class="btn sec sm" data-act="goCity">← Cidade</button><h2 style="margin-top:10px">📜 Academia</h2>`;
  if (!me.b.academia) return h + `<p class="mut">Construa a Academia (requer Castelo nv 3).</p></div>`;
  h += queueHTML('rq', me.rq ? `${R[me.rq.id].i} ${R[me.rq.id].n} → nv ${me.rq.to}` : '');
  h += `<div class="grid" style="margin-top:10px">`;
  for (const id in R) {
    const lv = me.rs[id], to = lv + 1;
    let act;
    if (lv >= RMAX) act = `<span class="mut">Nível máximo</span>`;
    else if (to > me.b.academia) act = `<span class="lock">🔒 Requer Academia nv ${to}</span>`;
    else {
      const c = rcost(to);
      act = costHTML(me, c) + `<div class="row"><button class="btn sm" data-act="res" data-id="${id}" ${me.rq || !canPay(me, c) ? 'disabled' : ''}>Pesquisar</button><span class="mut">⏱ ${ftime(rtime(to))}</span></div>`;
    }
    h += `<div class="card ${me.rq && me.rq.id === id ? 'busy' : ''}"><div class="hd"><div class="ic">${R[id].i}</div><div><div class="nm">${R[id].n}</div><div class="lv">Nível ${lv}/${RMAX}</div></div></div><p>${R[id].d}</p>${act}</div>`;
  }
  return h + `</div></div>`;
}

const ago = t => { const m = Math.floor((Date.now() - t) / 60000); return m < 3 ? '🟢 online' : m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)} h`; };
function vAlianca() {
  let h = `<div><h2>🤝 Aliança</h2>`;
  if (!me.al) {
    h += `<p class="mut">Aliados ajudam a acelerar construções e pesquisas e nunca atacam você.</p><div class="list">`;
    for (const a of ALS) {
      const mem = S.K.filter(k => k.al === a.id);
      h += `<div class="card"><div class="row" style="justify-content:space-between"><div><b style="color:${a.cor}">[${a.tag}] ${a.nome}</b>
        <div class="mut">👥 ${mem.length} membros · ⚡ ${fmt(mem.reduce((s, k) => s + power(k), 0))}</div></div>
        <button class="btn sm" data-act="join" data-id="${a.id}">Entrar</button></div></div>`;
    }
    return h + `</div></div>`;
  }
  const a = alById(me.al), mem = S.K.filter(k => k.al === a.id).sort((x, y) => power(y) - power(x));
  h += `<div class="card"><b style="color:${a.cor};font-size:17px">[${a.tag}] ${a.nome}</b>
    <div class="mut">👥 ${mem.length} membros · ⚡ ${fmt(mem.reduce((s, k) => s + power(k), 0))}</div>
    <div class="row" style="margin-top:8px"><button class="btn sec sm" data-act="leave">Sair da aliança</button></div></div>
    <h3>Mural</h3><div class="card feed">${S.feed.length ? S.feed.map(f => `<div><b>${esc(f.n)}</b> ${f.txt} <span class="tag">${ago(f.t)}</span></div>`).join('') : '<span class="mut">Ainda quieto por aqui…</span>'}</div>
    <h3>Membros</h3><div class="card tbw"><table class="tb">`;
  for (const k of mem) h += `<tr class="${k === me ? 'meRow' : ''}"><td>${esc(k.nome)}${k.bot ? ' <span class="tag">bot</span>' : ''}</td><td>🏰${k.b.castelo}</td><td>⚡${fmt(power(k))}</td><td class="mut">${k === me ? 'você' : ago(k.ai.visto)}</td></tr>`;
  return h + `</table></div></div>`;
}

function vRanking() {
  const rk = ranking();
  let h = `<div><h2>🏆 Ranking do Reino</h2><div class="card tbw"><table class="tb"><tr class="mut"><td>#</td><td>Governante</td><td>🏰</td><td>⚡ Poder</td></tr>`;
  rk.forEach((k, i) => {
    const a = k.al && alById(k.al);
    h += `<tr class="${k === me ? 'meRow' : ''}"><td>${i + 1}</td><td>${a ? `<span style="color:${a.cor}">[${a.tag}]</span> ` : ''}${esc(k.nome)}${k.bot ? ' <span class="tag">bot</span>' : ''}</td><td>${k.b.castelo}</td><td>${fmt(power(k))}</td></tr>`;
  });
  h += `</table></div><h3>Alianças</h3><div class="card tbw"><table class="tb">`;
  ALS.map(a => ({ a, p: S.K.filter(k => k.al === a.id).reduce((s, k) => s + power(k), 0) })).sort((x, y) => y.p - x.p)
    .forEach((x, i) => { h += `<tr class="${me.al === x.a.id ? 'meRow' : ''}"><td>${i + 1}</td><td style="color:${x.a.cor}">[${x.a.tag}] ${x.a.nome}</td><td>⚡${fmt(x.p)}</td></tr>`; });
  h += `</table></div><h3>Suas estatísticas</h3><div class="card"><div>🏆 Vitórias contra bárbaros: ${me.st.vitorias} (maior nv ${me.st.barbMax})</div>
    <div>⚔️ Ataques vencidos a reinos: ${me.st.pvp}</div><div>💀 Abates: ${fmt(me.st.abates)}</div><div>🎯 Tropas treinadas: ${fmt(me.st.treinadas)}</div><div>🧺 Coletado: ${fmt(me.st.coletado)}</div></div>
    <h3>Jogo</h3><button class="btn sec sm" data-act="reset">Recomeçar do zero</button></div>`;
  return h;
}

function render() {
  dirty = false;
  renderTop();
  $('#qdot').hidden = !(Q[S.q] && Q[S.q].ok());
  $('#view').hidden = tab === 'mapa';
  $('#mapWrap').hidden = tab !== 'mapa';
  if (tab === 'mapa') { renderMapPanel(); return; }
  const sc = $('#view').scrollTop;
  $('#view').innerHTML = { cidade: vCidade, exercito: vExercito, pesquisa: vPesquisa, alianca: vAlianca, ranking: vRanking }[tab]();
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
  const afford = Math.floor(Math.min(...Object.keys(u.c).map(r => me.res[r] / u.c[r])));
  const max = Math.max(0, Math.min(tmax(me), afford));
  modal(`<h2>${u.i} Treinar ${u.n}</h2>
    <div class="sl"><label for="tr"><span>Quantidade</span><b id="tn">${max}</b></label><input id="tr" type="range" min="0" max="${max}" value="${max}"></div>
    <div id="tc"></div>
    <div class="row"><button class="btn" data-act="train" data-t="${t}">Treinar</button><button class="btn sec" data-act="close">Cancelar</button></div>`);
  const upd = () => {
    const n = +$('#tr').value, c = {};
    for (const r in u.c) c[r] = u.c[r] * n;
    $('#tn').textContent = n;
    $('#tc').innerHTML = costHTML(me, c) + `<p class="mut">⏱ ${ftime(ttime(me) * n)}</p>`;
  };
  $('#tr').oninput = upd; upd();
}
function marchModal(tipo, alvo) {
  const title = tipo === 'atk' ? '⚔️ Atacar Bárbaros nv ' + alvo.lv : tipo === 'col' ? '🧺 Coletar ' + RI[alvo.rt] : `⚔️ Atacar ${esc(alvo.nome)} ${alTag(alvo)}`;
  let h = `<h2>${title} <span class="tag">(${alvo.x},${alvo.y})</span></h2>`;
  for (const t of TT) {
    const v = tipo === 'col' ? Math.min(me.tr[t], Math.ceil(alvo.qty / T[t].carga)) : me.tr[t];
    h += `<div class="sl"><label for="m_${t}"><span>${T[t].i} ${T[t].n}</span><b id="mv_${t}">${v}</b></label><input id="m_${t}" type="range" min="0" max="${me.tr[t]}" value="${v}" ${me.tr[t] ? '' : 'disabled'}></div>`;
  }
  if (tipo === 'pvp' && shielded(me, Date.now())) h += `<p class="lock">Atacar remove o seu escudo.</p>`;
  h += `<div id="mi" class="mut"></div><div class="row" style="margin-top:10px"><button class="btn" data-act="go" data-id="${alvo.id}" data-k="${tipo}">Marchar</button><button class="btn sec" data-act="close">Cancelar</button></div>`;
  modal(h);
  const fog = 0.85 + 0.3 * rnd(); // espionagem imprecisa
  const upd = () => {
    const tr = {}; for (const t of TT) { tr[t] = +$('#m_' + t).value; $('#mv_' + t).textContent = tr[t]; }
    if (!sum(tr)) return $('#mi').textContent = 'Nenhuma tropa selecionada.';
    const m = march(me, tr), my = armyPow(tr, mods(me));
    let txt = `⏱ Viagem ${ftime(travelMs(me, alvo.x, alvo.y, tr))} · 🎒 Carga ${fmt(m.carga)}`;
    if (tipo !== 'col') {
      const en = tipo === 'atk' ? armyPow(barbArmy(alvo), barbMods(alvo.lv)) : armyPow(alvo.tr, defMods(alvo)) * fog;
      const r = en ? my / en : 9;
      txt += `<br>Chance${tipo === 'pvp' ? ' (estimada)' : ''}: <b style="color:${r > 1.6 ? 'var(--good)' : r > 1.05 ? 'var(--gold)' : 'var(--bad)'}">${r > 1.6 ? 'Alta' : r > 1.05 ? 'Arriscada' : 'Baixa'}</b>`;
    } else txt += `<br>Coleta ${fmt(Math.min(alvo.qty, m.carga))} em ${ftime(Math.min(alvo.qty, m.carga) / gatherRate(me) * 1000)}`;
    $('#mi').innerHTML = txt;
  };
  for (const t of TT) $('#m_' + t).oninput = upd;
  upd();
}

/* ---------------- mapa ---------------- */
const cv = $('#map'), cx = cv.getContext('2d');
let cam = { x: CX + 0.5, y: CY + 0.5, z: 32 };
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
  const { w, h, dpr } = mapSize(), z = cam.z, now = Date.now();
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.fillStyle = '#1d2a14'; cx.fillRect(0, 0, w, h);
  const [ox, oy] = toScreen(0, 0, w, h);
  cx.fillStyle = '#3d5c2c'; cx.fillRect(ox, oy, N * z, N * z);
  cx.strokeStyle = '#ffffff10'; cx.lineWidth = 1; cx.beginPath();
  for (let i = 0; i <= N; i++) { cx.moveTo(ox + i * z, oy); cx.lineTo(ox + i * z, oy + N * z); cx.moveTo(ox, oy + i * z); cx.lineTo(ox + N * z, oy + i * z); }
  cx.stroke();
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  const icon = (s, x, y, size) => { cx.font = `${size}px system-ui, "Apple Color Emoji","Segoe UI Emoji",sans-serif`; cx.fillText(s, x, y); };
  const tag = (txt, x, y, col) => {
    cx.font = `bold ${Math.max(9, z * 0.26)}px system-ui`; const tw = cx.measureText(txt).width + 6;
    cx.fillStyle = '#000b'; cx.fillRect(x - tw / 2, y - z * 0.17, tw, z * 0.34); cx.fillStyle = col; cx.fillText(txt, x, y + 1);
  };
  const vis = (sx, sy) => sx > -z * 3 && sy > -z * 3 && sx < w + z * 3 && sy < h + z * 3;
  for (const k of S.K) { // territórios
    const [sx, sy] = toScreen(k.x + 0.5, k.y + 0.5, w, h); if (!vis(sx, sy)) continue;
    cx.fillStyle = (k === me ? '#e9b949' : k.al ? alById(k.al).cor : '#bbbbbb') + '22';
    cx.beginPath(); cx.arc(sx, sy, z * 1.8, 0, 7); cx.fill();
  }
  for (const t of S.map) {
    const [sx, sy] = toScreen(t.x + 0.5, t.y + 0.5, w, h); if (!vis(sx, sy)) continue;
    if (sel && sel.id === t.id) { cx.strokeStyle = '#e9b949'; cx.lineWidth = 2; cx.strokeRect(sx - z / 2 + 1, sy - z / 2 + 1, z - 2, z - 2); }
    if (t.k === 'bar') {
      const locked = t.lv > me.st.barbMax + 1;
      cx.globalAlpha = locked ? 0.55 : 1; icon('⛺', sx, sy - z * 0.08, z * 0.6); cx.globalAlpha = 1;
      tag((locked ? '🔒' : '') + t.lv, sx, sy + z * 0.32, locked ? '#aaa' : '#ff8a6a');
    } else {
      icon({ comida: '🌾', madeira: '🌲', pedra: '⛰️', ouro: '💰' }[t.rt], sx, sy - z * 0.08, z * 0.6);
      tag((t.busy ? '🧺' : '') + t.lv, sx, sy + z * 0.32, '#cfe8ff');
    }
  }
  for (const m of S.M) { // marchas de todos os reinos
    const k = kById(m.k);
    const [kx, ky] = toScreen(k.x + 0.5, k.y + 0.5, w, h), [tx, ty] = toScreen(m.x + 0.5, m.y + 0.5, w, h);
    const p = Math.min(1, Math.max(0, (now - m.start) / (m.end - m.start)));
    const col = k === me ? '#f2d16b' : m.tid === me.id ? '#ff3b2f' : me.al && k.al === me.al ? '#6ac0ff' : '#ffffff80';
    cx.strokeStyle = col; cx.setLineDash([5, 5]); cx.lineWidth = k === me || m.tid === me.id ? 2.5 : 1.2;
    cx.beginPath(); cx.moveTo(kx, ky); cx.lineTo(tx, ty); cx.stroke(); cx.setLineDash([]);
    let px = tx, py = ty;
    if (m.fase === 'ida') { px = kx + (tx - kx) * p; py = ky + (ty - ky) * p; }
    if (m.fase === 'volta') { px = tx + (kx - tx) * p; py = ty + (ky - ty) * p; }
    icon(m.tipo === 'col' ? '🧺' : '⚔️', px, py, z * 0.4);
  }
  for (const k of S.K) { // cidades
    const [sx, sy] = toScreen(k.x + 0.5, k.y + 0.5, w, h); if (!vis(sx, sy)) continue;
    if (sel && sel.city === k.id) { cx.strokeStyle = '#e9b949'; cx.lineWidth = 2; cx.strokeRect(sx - z / 2, sy - z / 2, z, z); }
    if (shielded(k, now)) { cx.strokeStyle = '#7fc4f5aa'; cx.lineWidth = 2; cx.beginPath(); cx.arc(sx, sy, z * 0.62, 0, 7); cx.stroke(); }
    icon(k === me ? '🏰' : '🏯', sx, sy - z * 0.05, z * (0.6 + Math.min(0.35, k.b.castelo * 0.03)));
    const a = k.al && alById(k.al);
    tag((a ? `[${a.tag}] ` : '') + k.nome, sx, sy + z * 0.45, k === me ? '#e9b949' : a ? a.cor : '#ddd');
  }
}
function mapLoop() { drawMap(); requestAnimationFrame(mapLoop); }

function renderMapPanel() {
  const p = $('#mapPanel'), now = Date.now();
  if (!sel) { p.innerHTML = ''; return; }
  let h = `<div class="card">`;
  if (sel.city) {
    const k = kById(sel.city), a = k.al && alById(k.al);
    h += `<div class="hd"><div class="ic">${k === me ? '🏰' : '🏯'}</div><div><div class="nm">${a ? `<span style="color:${a.cor}">[${a.tag}]</span> ` : ''}${esc(k.nome)}${k.bot ? ' <span class="tag">bot</span>' : ''}</div>
      <div class="lv">Castelo ${k.b.castelo} · ⚡${fmt(power(k))} · #${rankOf(k)}</div></div></div>`;
    if (k === me) h += `<p>Tropas na cidade: ${trHTML(me.tr)}</p>`;
    else if (me.al && k.al === me.al) h += `<p class="mut">Membro da sua aliança.</p>`;
    else if (shielded(k, now)) h += `<p class="mut">🛡️ Protegido por escudo.</p>`;
    else h += `<p class="mut">${a ? a.nome : 'Sem aliança'} · distância ${fmt(dxy(me.x, me.y, k.x, k.y))}</p><button class="btn" data-act="pvp">⚔️ Atacar</button>`;
  } else {
    const t = tileById(sel.id);
    if (!t) { sel = null; p.innerHTML = ''; return; }
    if (t.k === 'bar') {
      const locked = t.lv > me.st.barbMax + 1;
      h += `<div class="hd"><div class="ic">⛺</div><div><div class="nm">Bárbaros nv ${t.lv}</div><div class="lv">(${t.x},${t.y}) · distância ${fmt(dxy(me.x, me.y, t.x, t.y))}</div></div></div>
        <p>Tropas: ${trHTML(barbArmy(t))}<br>Saque: ${rewHTML(barbLoot(t.lv))} · 💎${5 * t.lv}</p>
        ${locked ? `<span class="lock">🔒 Derrote Bárbaros nv ${t.lv - 1} primeiro</span>` : `<button class="btn" data-act="atk">⚔️ Atacar</button>`}`;
    } else {
      h += `<div class="hd"><div class="ic">${RI[t.rt]}</div><div><div class="nm">Jazida de ${t.rt} nv ${t.lv}</div><div class="lv">(${t.x},${t.y}) · distância ${fmt(dxy(me.x, me.y, t.x, t.y))}</div></div></div>
        <p>Restante: ${fmt(t.qty)}</p>
        ${t.busy ? `<span class="mut">🧺 Sendo coletada</span>` : `<button class="btn" data-act="col">🧺 Coletar</button>`}`;
    }
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
  cv.addEventListener('pointerup', e => {
    const p = pts.get(e.pointerId); pts.delete(e.pointerId);
    if (pts.size < 2) pinch = 0;
    if (!p || moved > 8 || pts.size) return;
    const r = cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left - r.width / 2) / cam.z + cam.x), y = Math.floor((e.clientY - r.top - r.height / 2) / cam.z + cam.y);
    const c = cityAt(x, y), t = tileAt(x, y);
    sel = c ? { city: c.id } : t ? { id: t.id } : null;
    renderMapPanel();
  });
  cv.addEventListener('pointercancel', e => pts.delete(e.pointerId));
  cv.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 0.9); }, { passive: false });
})();
function zoom(f) { cam.z = Math.min(90, Math.max(14, cam.z * f)); }
function clampCam() { cam.x = Math.min(N, Math.max(0, cam.x)); cam.y = Math.min(N, Math.max(0, cam.y)); }

/* ---------------- eventos ---------------- */
function setTab(t) {
  tab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $('#view').scrollTop = 0;
}
document.addEventListener('click', e => {
  const tb = e.target.closest('[data-tab]');
  if (tb) { setTab(tb.dataset.tab); render(); return; }
  if (e.target.id === 'modal') return closeModal();
  const a = e.target.closest('[data-act]'); if (!a || a.disabled) return;
  const d = a.dataset, now = Date.now();
  switch (d.act) {
    case 'up': upgrade(me, d.id, now); break;
    case 'res': research(me, d.id, now); break;
    case 'free': speed(d.k, true); break;
    case 'speed': speed(d.k, false); break;
    case 'help': { const n = askHelp(me, now, d.k); toast(n ? `🤝 ${n} aliados ajudaram!` : 'Ninguém para ajudar.'); advance(now); break; }
    case 'heal': heal(me, now); break;
    case 'shield': if (buyShield(me, now)) toast('🛡️ Escudo ativado por 8h.'); break;
    case 'trainM': trainModal(d.t); return;
    case 'train': train(me, d.t, +$('#tr').value, now); closeModal(); break;
    case 'close': closeModal(); break;
    case 'recall': recall(me, +d.id, now); break;
    case 'claim': claim(); break;
    case 'join': joinAlliance(me, +d.id); toast(`🤝 Bem-vindo à ${alById(+d.id).nome}!`); break;
    case 'leave': me.al = null; S.feed = []; break;
    case 'goRes': setTab('pesquisa'); break;
    case 'goCity': setTab('cidade'); break;
    case 'atk': case 'col': { const t = tileById(sel && sel.id); if (t) marchModal(d.act, t); return; }
    case 'pvp': { const k = kById(sel && sel.city); if (k) marchModal('pvp', k); return; }
    case 'go': {
      const tr = {}; for (const t of TT) tr[t] = +$('#m_' + t).value;
      const alvo = d.k === 'pvp' ? kById(+d.id) : tileById(+d.id);
      if (alvo && sendMarch(me, d.k, alvo, tr, now)) toast(d.k === 'col' ? '🧺 Marcha enviada para coletar!' : '⚔️ Marcha enviada!');
      closeModal(); sel = null; break;
    }
    case 'unsel': sel = null; break;
    case 'mapZoom': zoom(+d.v); return;
    case 'mapHome': cam.x = me.x + 0.5; cam.y = me.y + 0.5; sel = { city: me.id }; break;
    case 'reset':
      if (d.sure) { newGame(); toast('Novo reino fundado.'); setTab('cidade'); break; }
      d.sure = 1; a.textContent = 'Toque de novo para apagar tudo'; return;
  }
  save(); render();
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
