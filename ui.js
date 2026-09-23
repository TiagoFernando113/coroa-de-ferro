'use strict';
/* =====================================================================
   Interface: cena isométrica (cidade e mapa) com HUD por cima, no estilo
   Rise of Kingdoms / Kingshot. A lógica do jogo fica em game.js.
   ===================================================================== */

/* ---------------- UI ---------------- */
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

function questHTML() {
  const q = Q[S.q];
  if (!q) return `<div class="card quest"><b>👑 Todas as missões concluídas.</b></div>`;
  return `<div class="card quest"><div class="row" style="justify-content:space-between;flex-wrap:nowrap">
    <div><div class="mut">🎯 Missão ${S.q + 1}/${Q.length}</div><b>${q.t}</b><div class="mut">${rewHTML(q.r)}</div></div>
    <button class="btn sm" data-act="claim" ${q.ok() ? '' : 'disabled'}>${q.ok() ? 'Resgatar' : '…'}</button></div></div>`;
}


function vExercito() {
  let h = `<div><div class="grid">`;
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
  let h = `<div>`;
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
  let h = `<div>`;
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
  let h = `<div><div class="card quest"><b>Sua posição: #${rankOf(me)} de ${rk.length}</b> · ⚡ ${fmt(power(me))}</div><div class="card tbw"><table class="tb"><tr class="mut"><td>#</td><td>Governante</td><td>🏰</td><td>⚡ Poder</td></tr>`;
  rk.forEach((k, i) => {
    const a = k.al && alById(k.al);
    h += `<tr class="${k === me ? 'meRow' : ''}"><td>${i + 1}</td><td>${a ? `<span style="color:${a.cor}">[${a.tag}]</span> ` : ''}${esc(k.nome)}${k.bot ? ' <span class="tag">bot</span>' : ''}</td><td>${k.b.castelo}</td><td>${fmt(power(k))}</td></tr>`;
  });
  h += `</table></div><h3>Alianças</h3><div class="card tbw"><table class="tb">`;
  ALS.map(a => ({ a, p: S.K.filter(k => k.al === a.id).reduce((s, k) => s + power(k), 0) })).sort((x, y) => y.p - x.p)
    .forEach((x, i) => { h += `<tr class="${me.al === x.a.id ? 'meRow' : ''}"><td>${i + 1}</td><td style="color:${x.a.cor}">[${x.a.tag}] ${x.a.nome}</td><td>⚡${fmt(x.p)}</td></tr>`; });
  h += `</table></div><h3>Suas estatísticas</h3><div class="card"><div>🏆 Vitórias contra bárbaros: ${me.st.vitorias} (maior nv ${me.st.barbMax})</div>
    <div>⚔️ Ataques vencidos a reinos: ${me.st.pvp}</div><div>💀 Abates: ${fmt(me.st.abates)}</div><div>🎯 Tropas treinadas: ${fmt(me.st.treinadas)}</div><div>🧺 Coletado: ${fmt(me.st.coletado)}</div></div>
    <h3>Jogo</h3><p class="mut">Versão ${VERSAO}</p><button class="btn sec sm" data-act="reset">Recomeçar do zero</button></div>`;
  return h;
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


/* ---------------- sprites (atlas gerado dos modelos 3D) ---------------- */
const PPU = 48; // pixels por unidade de modelo no atlas (ver tools/sprites)
const ATLAS = { img: new Image(), meta: null };
ATLAS.img.src = 'atlas.png';
fetch('atlas.json').then(r => r.json()).then(m => { ATLAS.meta = m; }).catch(() => {});
const ALCOR = { 1: 'azul', 2: 'vermelho', 3: 'dourado', 4: 'verde' };
const tierOf = lv => lv >= 15 ? 4 : lv >= 10 ? 3 : lv >= 5 ? 2 : 1;
const citySprite = k => `castelo${tierOf(k.b.castelo)}_${k.al ? ALCOR[k.al] : k === me ? 'azul' : 'cinza'}`;
const barbSprite = lv => lv >= 10 ? 'barbaro3' : lv >= 5 ? 'barbaro2' : 'barbaro1';

/* ---------------- câmera isométrica 2:1 ---------------- */
const cv = $('#scene'), g = cv.getContext('2d');
let view = 'cidade';                       // 'cidade' | 'mapa'
const cams = { cidade: { x: 6.5, y: 6.5, z: 0.82 }, mapa: { x: CX + 0.5, y: CY + 0.5, z: 1 } };
let W = 0, H = 0, DPR = 1;
const cam = () => cams[view];
const TW = () => 64 * cam().z, TH = () => 32 * cam().z;
function w2s(x, y) { const c = cam(); return [(x - y - (c.x - c.y)) * TW() / 2 + W / 2, (x + y - (c.x + c.y)) * TH() / 2 + H / 2]; }
function s2w(sx, sy) {
  const c = cam(), a = (sx - W / 2) / (TW() / 2) + (c.x - c.y), b = (sy - H / 2) / (TH() / 2) + (c.x + c.y);
  return [(a + b) / 2, (b - a) / 2];
}
function resize() {
  DPR = Math.min(3, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
}
addEventListener('resize', resize); resize();

// desenha um sprite com a base (origem do modelo) no ponto (x,y) do mundo; U = unidades de modelo por tile
function sprite(name, x, y, U, alpha = 1) {
  const m = ATLAS.meta && ATLAS.meta[name];
  if (!m || !ATLAS.img.complete) return null;
  const s = (TW() / U) / (Math.SQRT2 * PPU), [sx, sy] = w2s(x, y);
  const dx = sx - m.ax * s, dy = sy - m.ay * s;
  if (dx > W || dy > H || dx + m.w * s < 0 || dy + m.h * s < 0) return null;
  g.globalAlpha = alpha;
  g.drawImage(ATLAS.img, m.x, m.y, m.w, m.h, dx, dy, m.w * s, m.h * s);
  g.globalAlpha = 1;
  return { x: dx, y: dy, w: m.w * s, h: m.h * s };
}
function diamond(x, y, r, fill, stroke, dash) { // losango de raio r tiles centrado em (x,y)
  const p = [w2s(x - r, y - r), w2s(x + r, y - r), w2s(x + r, y + r), w2s(x - r, y + r)];
  g.beginPath(); g.moveTo(...p[0]); for (const q of p.slice(1)) g.lineTo(...q); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.setLineDash(dash || []); g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); g.setLineDash([]); }
}
// textura de grama (gerada uma vez)
const grass = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = '#6ea84a'; x.fillRect(0, 0, 256, 256);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) { x.fillStyle = r() < 0.5 ? 'rgba(90,150,55,.35)' : 'rgba(140,190,90,.28)'; x.beginPath(); x.ellipse(r() * 256, r() * 256, 10 + r() * 30, 6 + r() * 16, 0, 0, 7); x.fill(); }
  for (let i = 0; i < 500; i++) { x.strokeStyle = r() < 0.5 ? 'rgba(60,120,40,.5)' : 'rgba(160,210,110,.45)'; x.lineWidth = 1; const a = r() * 256, b = r() * 256; x.beginPath(); x.moveTo(a, b); x.lineTo(a + r() * 3 - 1.5, b - 3 - r() * 3); x.stroke(); }
  return c;
})();
let grassPat = null;
function ground(x0, y0, x1, y1, base, pad) {
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  if (!grassPat) grassPat = g.createPattern(grass, 'repeat');
  const p = [w2s(x0, y0), w2s(x1, y0), w2s(x1, y1), w2s(x0, y1)];
  const [ox, oy] = w2s(0, 0);
  grassPat.setTransform(new DOMMatrix().translateSelf(ox, oy).scaleSelf(cam().z * 0.8, cam().z * 0.8));
  g.save(); g.beginPath(); g.moveTo(...p[0]); for (const q of p.slice(1)) g.lineTo(...q); g.closePath();
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 30 * cam().z; g.fillStyle = grassPat; g.fill(); g.restore();
  if (pad) { g.strokeStyle = pad; g.lineWidth = 3; g.beginPath(); g.moveTo(...p[0]); for (const q of p.slice(1)) g.lineTo(...q); g.closePath(); g.stroke(); }
}
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// placas de nome no estilo do jogo: círculo com o nível + faixa escura com o nome
function plate(sx, sy, lv, txt, col) {
  g.font = `600 ${12 * Math.min(1.3, Math.max(0.8, cam().z))}px system-ui,sans-serif`;
  const tw = txt ? g.measureText(txt).width + 14 : 0, r = 10 * Math.min(1.3, Math.max(0.8, cam().z));
  const x0 = sx - (tw + r * 2) / 2;
  if (txt) { g.fillStyle = 'rgba(20,14,8,.78)'; roundRect(x0 + r, sy - r * 0.8, tw + r, r * 1.6, r * 0.8); g.fill(); g.fillStyle = col || '#f1e6d0'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, x0 + r * 2 + 4, sy + 1); }
  if (lv != null) {
    g.fillStyle = '#e9dcc0'; g.beginPath(); g.arc(x0 + r, sy, r, 0, 7); g.fill();
    g.strokeStyle = '#6b4a2b'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#3a2412'; g.textAlign = 'center'; g.fillText(lv, x0 + r, sy + 1);
  }
}
function roundRect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function badge(sx, sy, txt, bg, fg = '#fff') {
  const r = 11 * Math.min(1.3, Math.max(0.8, cam().z));
  g.fillStyle = bg; g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = fg; g.font = `700 ${r * 1.1}px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, sx, sy + 1);
}

/* ---------------- cena: MAPA DO MUNDO ---------------- */
const MAP_U = 1.9;
let sel = null; // {city:id} | {id: tileId}
function drawMap() {
  const now = Date.now();
  ground(0, 0, N, N, '#2d4f25', 'rgba(30,50,20,.8)');
  // territórios das cidades
  for (const k of S.K) {
    const col = k === me ? '#f2d16b' : k.al ? alById(k.al).cor : '#cfcfcf';
    diamond(k.x + 0.5, k.y + 0.5, 2.4, col + '22', col + 'aa', [6, 5]);
  }
  if (sel) {
    const t = sel.city ? kById(sel.city) : tileById(sel.id);
    if (t) diamond(t.x + 0.5, t.y + 0.5, sel.city ? 1.6 : 0.6, 'rgba(255,255,255,.18)', '#ffe08a');
  }
  // objetos em ordem de profundidade
  const occ = new Set(S.map.map(t => t.x + ',' + t.y));
  const objs = [];
  const [ax, ay] = s2w(0, 0), [bx, by] = s2w(W, 0), [cx2, cy2] = s2w(0, H), [dx, dy] = s2w(W, H);
  const x0 = Math.max(-3, Math.floor(Math.min(ax, bx, cx2, dx)) - 3), x1 = Math.min(N + 3, Math.ceil(Math.max(ax, bx, cx2, dx)) + 3);
  const y0 = Math.max(-3, Math.floor(Math.min(ay, by, cy2, dy)) - 3), y1 = Math.min(N + 3, Math.ceil(Math.max(ay, by, cy2, dy)) + 3);
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) {
    const h = hash(x, y);
    const inside = x >= 0 && y >= 0 && x < N && y < N;
    if ((inside ? h < 0.07 : h < 0.5) && !occ.has(x + ',' + y) && !S.K.some(k => Math.abs(k.x - x) < 3 && Math.abs(k.y - y) < 3))
      objs.push({ d: x + y, f: () => sprite(['arvore', 'arvore2', 'arvore3', 'rocha', 'arvore'][Math.floor(hash(y, x) * 5)], x + 0.5, y + 0.5, inside ? 2.4 : 1.8) });
  }
  for (const t of S.map) objs.push({ d: t.x + t.y + 1, f: () => {
    if (t.k === 'bar') sprite(barbSprite(t.lv), t.x + 0.5, t.y + 0.5, MAP_U * 1.1, t.lv > me.st.barbMax + 1 ? 0.6 : 1);
    else sprite(t.rt, t.x + 0.5, t.y + 0.5, MAP_U * 1.2);
  } });
  for (const k of S.K) objs.push({ d: k.x + k.y + 1, f: () => sprite(citySprite(k), k.x + 0.5, k.y + 0.5, MAP_U * 1.15) });
  objs.sort((a, b) => a.d - b.d);
  for (const o of objs) o.f();
  // escudos
  for (const k of S.K) if (shielded(k, now)) {
    const [sx, sy] = w2s(k.x + 0.5, k.y + 0.5);
    g.strokeStyle = 'rgba(127,196,245,.8)'; g.fillStyle = 'rgba(127,196,245,.12)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(sx, sy - TH() * 0.8, TW() * 1.5, TH() * 2.2, 0, 0, 7); g.fill(); g.stroke();
  }
  // marchas
  for (const m of S.M) {
    const k = kById(m.k); if (!k) continue;
    const [kx, ky] = w2s(k.x + 0.5, k.y + 0.5), [tx, ty] = w2s(m.x + 0.5, m.y + 0.5);
    const p = Math.min(1, Math.max(0, (now - m.start) / (m.end - m.start)));
    const mine = k === me, hostil = m.tid === me.id;
    const col = mine ? '#6ee06a' : hostil ? '#ff3b2f' : me.al && k.al === me.al ? '#6ac0ff' : 'rgba(255,255,255,.55)';
    if (mine || hostil || (me.al && k.al === me.al) || m.fase !== 'col') {
      g.strokeStyle = col; g.lineWidth = mine || hostil ? 3 : 1.5; g.setLineDash([8, 6]); g.lineDashOffset = -now / 60;
      g.beginPath(); g.moveTo(kx, ky); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
    }
    let px = tx, py = ty;
    if (m.fase === 'ida') { px = kx + (tx - kx) * p; py = ky + (ty - ky) * p; }
    if (m.fase === 'volta') { px = tx + (kx - tx) * p; py = ty + (ky - ty) * p; }
    badge(px, py - 6, m.tipo === 'col' ? '⛏' : '⚔', mine ? '#2f8f3a' : hostil ? '#c0392b' : '#35506e');
  }
  // placas (por cima de tudo)
  for (const k of S.K) {
    const [sx, sy] = w2s(k.x + 0.5, k.y + 0.5);
    if (sx < -200 || sx > W + 200 || sy < -100 || sy > H + 100) continue;
    const a = k.al && alById(k.al);
    plate(sx, sy + TH() * 0.9, k.b.castelo, (a ? `[${a.tag}]` : '') + (k === me ? 'Minha Cidade' : k.nome), k === me ? '#ffd76a' : a ? a.cor : '#f1e6d0');
  }
  for (const t of S.map) {
    const [sx, sy] = w2s(t.x + 0.5, t.y + 0.5);
    if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) continue;
    if (t.k === 'bar') plate(sx, sy + TH() * 0.55, t.lv > me.st.barbMax + 1 ? '🔒' : t.lv, null);
    else if (cam().z > 0.7) badge(sx, sy + TH() * 0.55, t.busy ? '⛏' : t.lv, t.busy ? '#2f8f3a' : '#3a6ea5');
  }
  const [wx, wy] = [Math.floor(cam().x), Math.floor(cam().y)];
  $('#coords').textContent = `X: ${wx}  Y: ${wy}`;
}

/* ---------------- cena: CIDADE ---------------- */
const CITY_N = 13, GATE = [6.5, 12.75];
const SLOTS = { castelo: [6.5, 6.5], academia: [3, 3], quartel: [6.5, 2.4], armazem: [10, 3], serraria: [2.4, 6.5],
  pedreira: [10.6, 6.3], fazenda: [3, 10], mina: [4.9, 10.9], hospital: [10, 10], muralha: GATE };
const BSPR = { fazenda: 'b_fazenda', serraria: 'b_serraria', pedreira: 'b_pedreira', mina: 'b_mina', armazem: 'b_armazem',
  quartel: 'b_quartel', hospital: 'b_hospital', academia: 'b_academia' };
// casas e enfeites: aparecem aos poucos conforme o castelo cresce
const DECOR = [[8.6, 9.2, 'barraca1'], [4.5, 8.7, 'barraca2'], [8.4, 11.1, 'fonte'], [1.3, 1.3, 'casa1'], [11.7, 1.4, 'casa4'],
  [4.8, 1.2, 'casa2'], [8.4, 1.2, 'casa3'], [1.2, 4.7, 'casa2'], [11.8, 4.6, 'casa1'], [1.2, 8.4, 'casa3'], [11.8, 8.4, 'casa2'],
  [1.4, 11.7, 'casa4'], [11.6, 11.6, 'casa1'], [8.2, 4.5, 'carroca'], [4.8, 4.4, 'lampiao'], [8.6, 8.3, 'lampiao'], [5.2, 12.2, 'casa3'], [11.9, 10.3, 'casa2']];
const FOLK = Array.from({ length: 16 }, (_, i) => ({ to: Object.keys(SLOTS)[1 + (i % 9)], sp: 9000 + (i * 1373) % 7000, ph: (i * 0.137) % 1,
  roupa: ['#b8452f', '#3f6fb0', '#6d8f3a', '#8a5a2b', '#c9a23a', '#7a4f9a'][i % 6], off: ((i * 37) % 10) / 25 - 0.2 }));
function drawCity() {
  const now = Date.now();
  ground(0, 0, CITY_N, CITY_N, '#2d4f25', 'rgba(60,40,20,.5)');
  // plantações perto da fazenda
  if (me.b.fazenda) for (const [fx, fy] of [[1.4, 10.4], [3.4, 11.9]]) {
    diamond(fx, fy, 0.7, '#8a6a3a');
    g.strokeStyle = '#9fbf4a'; g.lineWidth = Math.max(1, 2 * cam().z);
    for (let k = -0.55; k <= 0.55; k += 0.18) { const [a, b] = w2s(fx - 0.6, fy + k), [c, d] = w2s(fx + 0.6, fy + k); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
  }
  // caminhos de terra (castelo → construções e portão)
  g.lineCap = 'round';
  for (const pass of [['rgba(110,80,45,.8)', 0.7], ['rgba(190,150,95,.95)', 0.5]])
    for (const id in SLOTS) if (id !== 'castelo') {
      const [a, b] = w2s(...SLOTS.castelo), [c, d] = w2s(...SLOTS[id]);
      g.strokeStyle = pass[0]; g.lineWidth = TH() * pass[1]; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke();
    }
  if (sel && sel.b) diamond(...SLOTS[sel.b], sel.b === 'castelo' ? 2.2 : 1.2, 'rgba(255,255,255,.2)', '#ffe08a');
  const objs = [];
  // floresta fora da muralha
  for (let x = -5; x < CITY_N + 5; x++) for (let y = -5; y < CITY_N + 5; y++) {
    const inside = x >= 0 && y >= 0 && x < CITY_N && y < CITY_N;
    if (!inside && hash(x + 99, y + 7) < 0.6) objs.push({ d: x + y, f: () => sprite(['arvore', 'arvore2', 'arvore3', 'arvore', 'rocha'][Math.floor(hash(y, x + 3) * 5)], x + 0.5, y + 0.5, 1.5) });
  }
  // muralha em volta (segmentos a cada ~0,65 tile), torres nos cantos
  const e0 = 0.25, e1 = CITY_N - 0.25, st = 0.65;
  for (let t = e0 + st; t < e1 - 0.3; t += st) {
    objs.push({ d: t + e0, f: () => sprite('muro_x', t, e0, 1.55) });          // fundo
    objs.push({ d: e0 + t, f: () => sprite('muro_z', e0, t, 1.55) });          // esquerda
    objs.push({ d: e1 + t, f: () => sprite('muro_z', e1, t, 1.55) });          // direita (frente)
    if (Math.abs(t - GATE[0]) > 0.7) objs.push({ d: t + e1, f: () => sprite('muro_x', t, e1, 1.55) }); // frente, com vão do portão
  }
  for (const [x, y] of [[e0, e0], [e1, e0], [e0, e1], [e1, e1]]) objs.push({ d: x + y + 0.1, f: () => sprite('muro_torre', x, y, 1.55) });
  objs.push({ d: GATE[0] + GATE[1] + 0.1, f: () => sprite('muro_portao', GATE[0], GATE[1], 1.55) });
  // casas e enfeites
  const nDec = Math.min(DECOR.length, 3 + me.b.castelo * 2);
  for (const [x, y, n] of DECOR.slice(0, nDec)) objs.push({ d: x + y, f: () => sprite(n, x, y, n.startsWith('casa') ? 1.7 : 1.6) });
  // construções
  for (const id in SLOTS) if (id !== 'muralha') objs.push({ d: SLOTS[id][0] + SLOTS[id][1], f: () => {
    const [x, y] = SLOTS[id];
    if (id === 'castelo') sprite(citySprite(me), x, y, 1.3);
    else if (me.b[id]) sprite(BSPR[id], x, y, 1.55);
    else { diamond(x, y, 0.8, 'rgba(120,85,45,.55)', 'rgba(233,185,73,.6)', [5, 4]); sprite('rocha', x - 0.4, y + 0.3, 2.6); }
  } });
  // moradores andando pelos caminhos (vai e volta)
  for (const f of FOLK) {
    const [ax, ay] = SLOTS.castelo, [bx, by] = SLOTS[f.to];
    let p = ((now / f.sp) + f.ph) % 2; p = p > 1 ? 2 - p : p; p = 0.25 + p * 0.6;
    const x = ax + (bx - ax) * p + f.off, y = ay + (by - ay) * p - f.off;
    objs.push({ d: x + y, f: () => person(x, y, f.roupa, now / 120 + f.ph * 10) });
  }
  objs.sort((a, b) => a.d - b.d);
  for (const o of objs) o.f();
  // selos: nível, obra, pode evoluir
  for (const id in SLOTS) {
    const [x, y] = SLOTS[id], [sx, sy] = w2s(x, y), lv = me.b[id];
    const oy = sy + TH() * (id === 'castelo' ? 1.9 : id === 'muralha' ? 0.5 : 0.9);
    if (me.bq && me.bq.id === id) {
      const p = Math.min(1, (now - me.bq.start) / (me.bq.end - me.bq.start));
      badge(sx, sy - TH() * 2.2, '🔨', '#c98a1c');
      g.fillStyle = 'rgba(0,0,0,.6)'; roundRect(sx - 30, oy + 12, 60, 7, 3); g.fill();
      g.fillStyle = '#6ee06a'; roundRect(sx - 30, oy + 12, 60 * p, 7, 3); g.fill();
    } else if (!me.bq && !canBuild(me, id) && canPay(me, bcost(id, lv + 1))) badge(sx + 34, oy - 4, '⬆', '#2f8f3a');
    if (lv) plate(sx, oy, lv, B[id].n, '#f1e6d0'); else plate(sx, oy, '+', B[id].n + (canBuild(me, id) ? ' 🔒' : ''), '#c9b99a');
  }
  $('#coords').textContent = '';
}
// bonequinho: sombra, corpo com a cor da roupa, cabeça; balança ao andar
function person(x, y, roupa, t) {
  const [sx, sy] = w2s(x, y), k = cam().z, b = Math.abs(Math.sin(t)) * 2 * k;
  if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) return;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(sx, sy, 5 * k, 2.5 * k, 0, 0, 7); g.fill();
  g.fillStyle = roupa; roundRect(sx - 3.5 * k, sy - 13 * k - b, 7 * k, 10 * k, 3 * k); g.fill();
  g.fillStyle = '#f0c9a0'; g.beginPath(); g.arc(sx, sy - 16 * k - b, 3.2 * k, 0, 7); g.fill();
}

/* ---------------- toque / arrasto / zoom ---------------- */
(function input() {
  const pts = new Map(); let moved = 0, pinch = 0;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; });
  cv.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX; p.y = e.clientY;
      const d1 = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch && d0) zoom(d1 / d0);
      pinch = 1; moved = 99; return;
    }
    p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    // arrastar move a câmera no sentido contrário (converte o deslocamento de tela em mundo)
    const c = cam(), a = dx / (TW() / 2), b = dy / (TH() / 2);
    c.x -= (a + b) / 2; c.y -= (b - a) / 2; clampCam();
  });
  cv.addEventListener('pointerup', e => {
    const p = pts.get(e.pointerId); pts.delete(e.pointerId);
    if (pts.size < 2) pinch = 0;
    if (!p || moved > 10 || pts.size) return;
    tap(e.clientX, e.clientY);
  });
  cv.addEventListener('pointercancel', e => pts.delete(e.pointerId));
  cv.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : 0.9); }, { passive: false });
})();
function zoom(f) { const c = cam(); c.z = Math.min(2.2, Math.max(view === 'mapa' ? 0.35 : 0.6, c.z * f)); }
function clampCam() { const c = cam(), n = view === 'mapa' ? N : CITY_N; c.x = Math.min(n, Math.max(0, c.x)); c.y = Math.min(n, Math.max(0, c.y)); }
function tap(sx, sy) {
  const [wx, wy] = s2w(sx, sy);
  if (view === 'cidade') {
    let best = null, bd = 1e9;
    for (const id in SLOTS) {
      const [x, y] = SLOTS[id], d = Math.hypot(x - wx, y - wy) - (id === 'castelo' ? 1.2 : 0);
      if (d < bd) { bd = d; best = id; }
    }
    sel = bd < 1.6 ? { b: best } : null;
  } else {
    let best = null, bd = 1e9;
    for (const k of S.K) { const d = Math.hypot(k.x + 0.5 - wx, k.y + 0.5 - wy) - 0.3 * tierOf(k.b.castelo); if (d < bd) { bd = d; best = k; } }
    const t = tileAt(Math.floor(wx), Math.floor(wy));
    sel = bd < 1 ? { city: best.id } : t ? { id: t.id } : null;
  }
  renderSheet();
}

/* ---------------- folha inferior (detalhes do que foi tocado) ---------------- */
function buildingSheet(id) {
  const b = B[id], lv = me.b[id], to = lv + 1, why = canBuild(me, id), now = Date.now();
  let act;
  if (me.bq && me.bq.id === id) act = queueHTML('bq', `🔨 Evoluindo para nv ${me.bq.to}`);
  else if (why) act = `<span class="${lv >= MAXLV ? 'mut' : 'lock'}">${why}</span>`;
  else {
    const c = bcost(id, to);
    act = costHTML(me, c) + `<div class="row"><button class="btn" data-act="up" data-id="${id}" ${me.bq || !canPay(me, c) ? 'disabled' : ''}>${lv ? 'Evoluir' : 'Construir'}</button><span class="mut">⏱ ${ftime(btime(me, id, to))}</span>${me.bq ? `<span class="mut">Construtor ocupado: ${B[me.bq.id].n}</span>` : ''}</div>`;
  }
  let info = '';
  if (b.prod) info = `<p>${RI[b.prod]} ${lv ? '+' + fmt(b.p * lv * 1.2 ** (lv - 1) * (1 + 0.08 * me.rs.eco)) + '/h' : '—'}</p>`;
  if (id === 'armazem') info = `<p>📦 Limite ${fmt(cap(me))} · 🔒 protegido ${fmt(protect(me))}</p>`;
  if (id === 'quartel') info = `<p>Lote máx. ${lv ? tmax(me) : 0}</p>${lv ? `<button class="btn sec sm" data-act="panel" data-p="exercito">⚔️ Treinar tropas</button>` : ''}`;
  if (id === 'hospital') info = `<p>🏥 ${fmt(sum(me.fer))}/${fmt(hospCap(me))} feridos</p>`;
  if (id === 'muralha') info = `<p>🛡️ +${3 * lv}% defesa</p>`;
  if (id === 'castelo') info = `<p>Marchas: ${maxMarches(me)} · ${shielded(me, now) ? '🛡️ Escudo ativo' : 'Sem escudo'}</p>`;
  if (id === 'academia' && lv) info = `<button class="btn sec sm" data-act="panel" data-p="pesquisa">📜 Abrir pesquisas</button>`;
  return `<div class="hd"><div class="ic">${b.i}</div><div><div class="nm">${b.n}</div><div class="lv">${lv ? 'Nível ' + lv : 'Não construído'}</div></div><button class="x" data-act="unsel">✕</button></div>
    <p>${b.d}</p>${info}${act}`;
}
function mapSheet() {
  const now = Date.now();
  if (sel.city) {
    const k = kById(sel.city), a = k.al && alById(k.al);
    let h = `<div class="hd"><div class="ic">🏰</div><div><div class="nm">${a ? `<span style="color:${a.cor}">[${a.tag}]</span> ` : ''}${esc(k === me ? 'Minha Cidade' : k.nome)}${k.bot ? ' <span class="tag">bot</span>' : ''}</div>
      <div class="lv">Castelo ${k.b.castelo} · ⚡${fmt(power(k))} · #${rankOf(k)} · (${k.x},${k.y})</div></div><button class="x" data-act="unsel">✕</button></div>`;
    if (k === me) h += `<p>Tropas na cidade: ${trHTML(me.tr)}</p><button class="btn sec sm" data-act="toggle">🏰 Entrar na cidade</button>`;
    else if (me.al && k.al === me.al) h += `<p class="mut">Membro da sua aliança.</p>`;
    else if (shielded(k, now)) h += `<p class="mut">🛡️ Protegido por escudo.</p>`;
    else h += `<p class="mut">${a ? a.nome : 'Sem aliança'} · distância ${fmt(dxy(me.x, me.y, k.x, k.y))}</p><button class="btn" data-act="pvp">⚔️ Atacar</button>`;
    return h;
  }
  const t = tileById(sel.id);
  if (!t) { sel = null; return ''; }
  if (t.k === 'bar') {
    const locked = t.lv > me.st.barbMax + 1;
    return `<div class="hd"><div class="ic">⛺</div><div><div class="nm">Bárbaros nv ${t.lv}</div><div class="lv">(${t.x},${t.y}) · distância ${fmt(dxy(me.x, me.y, t.x, t.y))}</div></div><button class="x" data-act="unsel">✕</button></div>
      <p>Tropas: ${trHTML(barbArmy(t))}<br>Saque: ${rewHTML(barbLoot(t.lv))} · 💎${5 * t.lv}</p>
      ${locked ? `<span class="lock">🔒 Derrote Bárbaros nv ${t.lv - 1} primeiro</span>` : `<button class="btn" data-act="atk">⚔️ Atacar</button>`}`;
  }
  return `<div class="hd"><div class="ic">${RI[t.rt]}</div><div><div class="nm">Jazida de ${t.rt} nv ${t.lv}</div><div class="lv">(${t.x},${t.y}) · distância ${fmt(dxy(me.x, me.y, t.x, t.y))}</div></div><button class="x" data-act="unsel">✕</button></div>
    <p>Restante: ${fmt(t.qty)}</p>${t.busy ? `<span class="mut">⛏ Sendo coletada</span>` : `<button class="btn" data-act="col">⛏ Coletar</button>`}`;
}
function renderSheet() {
  const el = $('#sheet');
  const html = !sel ? '' : sel.b ? buildingSheet(sel.b) : mapSheet();
  el.hidden = !html;
  if (html) el.innerHTML = html;
  timers();
}

/* ---------------- HUD ---------------- */
function renderTop() {
  const c = cap(me), now = Date.now();
  $('#resbar').innerHTML = RES.map(r => `<div class="r ${me.res[r] >= c ? 'full' : ''}"><i class="ico ico-${r}"></i><b>${fmt(me.res[r])}</b></div>`).join('') +
    `<div class="r gem"><i class="ico ico-gema"></i><b>${fmt(me.gemas)}</b></div>`;
  $('#perfil').innerHTML = `<div class="av"><i class="ico ico-coroa"></i><span class="avl">${me.b.castelo}</span></div><div><div class="pw">Poder ${fmt(power(me))}</div><div class="rk">#${rankOf(me)} · ${alTag(me) || 'sem aliança'}${shielded(me, now) ? ` · 🛡️<span class="cd" data-end="${me.escudo}">${ftime(me.escudo - now)}</span>` : ''}</div></div>`;
  const q = Q[S.q];
  $('#quest').innerHTML = q ? `<b><i class="ico ico-missoes"></i></b><span>${q.t}</span>${q.ok() ? '<em>Resgatar</em>' : ''}` : '<b>👑</b><span>Missões concluídas</span>';
  $('#quest').classList.toggle('ok', !!(q && q.ok()));
  const ms = marchesOf(me);
  $('#marchas').innerHTML = `<div class="mh" data-act="marchas">▾ Marchando ${ms.length}/${maxMarches(me)}</div>` + ms.map(m => {
    const f = { ida: m.tipo === 'col' ? 'Indo coletar' : 'Indo atacar', col: 'Coletando', volta: 'Voltando' }[m.fase];
    return `<div class="mi"><span class="mic">${m.tipo === 'col' ? '⛏' : '⚔️'}</span><div class="mt"><b>${f}</b><div class="bar"><i class="pb" data-s="${m.start}" data-e="${m.end}"></i></div><span class="cd" data-end="${m.end}">${ftime(m.end - now)}</span></div>
      ${m.fase !== 'volta' ? `<button class="mr" data-act="recall" data-id="${m.id}" aria-label="Chamar de volta">↩</button>` : ''}</div>`;
  }).join('');
  const inc = incoming().sort((a, b) => a.end - b.end)[0];
  $('#alerta').hidden = !inc;
  if (inc) $('#alerta').innerHTML = `⚠️ Ataque de ${esc(kById(inc.k).nome)} em <b class="cd" data-end="${inc.end}">${ftime(inc.end - now)}</b>`;
  const n = S.feed[0] || S.rel[0];
  $('#news').innerHTML = n ? (S.feed[0] ? `<b>Aliança:</b> ${esc(n.n)} ${n.txt}` : `<b>Relatório:</b> ${n.titulo}`) : '<b>Dica:</b> toque nas construções para evoluir.';
  $('#tgl').innerHTML = view === 'cidade' ? '<b><i class="ico ico-mapa"></i></b>Mapa' : '<b><i class="ico ico-cidade"></i></b>Cidade';
  $('#qdot').hidden = !(Q[S.q] && Q[S.q].ok());
}
function timers() {
  const now = Date.now();
  document.querySelectorAll('.cd').forEach(e => e.textContent = ftime(+e.dataset.end - now));
  document.querySelectorAll('.pb').forEach(e => {
    const s = +e.dataset.s, en = +e.dataset.e;
    e.style.width = Math.min(100, Math.max(0, (now - s) / (en - s) * 100)) + '%';
  });
}

/* ---------------- painéis (janelas por cima da cena) ---------------- */
function vMissoes() {
  const q = Q[S.q];
  let h = '<div>';
  if (q) h += `<div class="card queue"><div class="mut">Missão ${S.q + 1} de ${Q.length}</div><div class="nm" style="margin:4px 0">${q.t}</div>
    <div class="mut">Recompensa: ${rewHTML(q.r)}</div><div style="margin-top:8px"><button class="btn" data-act="claim" ${q.ok() ? '' : 'disabled'}>${q.ok() ? 'Resgatar 🎁' : 'Em andamento'}</button></div></div>`;
  else h += `<p>👑 Todas as missões concluídas.</p>`;
  h += `<h3>Próximas</h3><div class="list">` + Q.slice(S.q + 1, S.q + 6).map(x => `<div class="card mut">${x.t} · ${rewHTML(x.r)}</div>`).join('') + '</div>';
  return h + '</div>';
}
const PANELS = { exercito: ['⚔️ Exército', vExercito], pesquisa: ['📜 Academia', vPesquisa], alianca: ['🤝 Aliança', vAlianca], ranking: ['🏆 Ranking', vRanking], missoes: ['🎯 Missões', vMissoes] };
let panel = null;
function openPanel(p) { panel = p; sel = null; renderSheet(); $('#panel').hidden = false; $('#pbody').scrollTop = 0; renderPanel(); }
function closePanel() { panel = null; $('#panel').hidden = true; }
function renderPanel() {
  if (!panel) return;
  const [t, f] = PANELS[panel];
  $('#ptitle').textContent = t;
  const sc = $('#pbody').scrollTop;
  $('#pbody').innerHTML = f();
  $('#pbody').scrollTop = sc;
  document.querySelectorAll('#nav [data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === panel));
}
function render() { dirty = false; renderTop(); renderPanel(); renderSheet(); timers(); }

/* ---------------- laço de desenho ---------------- */
function frame() {
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (view === 'mapa') drawMap(); else drawCity();
  requestAnimationFrame(frame);
}
function setView(v) {
  view = v; sel = null; closePanel(); renderSheet(); renderTop();
  if (v === 'mapa') { cams.mapa.x = me.x + 0.5; cams.mapa.y = me.y + 0.5; }
}

/* ---------------- eventos ---------------- */
document.addEventListener('click', e => {
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
    case 'panel': openPanel(d.p); break;
    case 'closePanel': closePanel(); break;
    case 'toggle': setView(view === 'cidade' ? 'mapa' : 'cidade'); break;
    case 'quest': Q[S.q] && Q[S.q].ok() ? claim() : openPanel('missoes'); break;
    case 'atk': case 'col': { const t = tileById(sel && sel.id); if (t) marchModal(d.act, t); return; }
    case 'pvp': { const k = kById(sel && sel.city); if (k) marchModal('pvp', k); return; }
    case 'go': {
      const tr = {}; for (const t of TT) tr[t] = +$('#m_' + t).value;
      const alvo = d.k === 'pvp' ? kById(+d.id) : tileById(+d.id);
      if (alvo && sendMarch(me, d.k, alvo, tr, now)) toast(d.k === 'col' ? '⛏ Marcha enviada para coletar!' : '⚔️ Marcha enviada!');
      closeModal(); sel = null; break;
    }
    case 'unsel': sel = null; break;
    case 'zoom': zoom(+d.v); return;
    case 'home': if (view === 'mapa') { cams.mapa.x = me.x + 0.5; cams.mapa.y = me.y + 0.5; sel = { city: me.id }; } else { cams.cidade.x = cams.cidade.y = 6.5; } break;
    case 'marchas': $('#marchas').classList.toggle('min'); return;
    case 'reset':
      if (d.sure) { newGame(); toast('Novo reino fundado.'); closePanel(); setView('cidade'); break; }
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
requestAnimationFrame(frame);
let saveTick = 0;
setInterval(() => {
  advance(Date.now());
  if ($('#modal').hidden) render(); else { renderTop(); timers(); }
  if (++saveTick % 5 === 0) save();
}, 1000);
