// Interface da defesa: HUD, onda, painel dos botões do chão, menus, minimapa e controles.
import * as C from './cena.js';
import { G, entrada, stats, habLiberada, comecarOnda, restantes, tentarDeNovo, construir, melhorarDefesa, venderDefesa, valorVenda, melhorarMuro, consertarMuro, custoConserto, melhorarMina, melhorarForja, apagarSave } from './jogo.js';
import { CLASSES, xpProx, DEFESAS, statsDefesa, custoDefesa, MAXNV, MURALHA, MINA, FORJA } from './dados.js';
import { LIM, MURO, SLOTS, ESTRADAS } from './mundo.js';

const $ = s => document.querySelector(s);
export const ui = { pausado: false, qualidade: 'media' };
let ov, g, mini, mg, mapaBase;
const fmt = n => n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.floor(n).toString();

// ---------------- montagem ----------------
export function montarHUD() {
  const cls = CLASSES[G.jog.cls];
  $('#hud').innerHTML = `
    <div id="perfil"><div id="retrato" style="--c:${cls.cor}">${cls.icone}<b id="nv"></b></div>
      <div id="barras"><div class="barra vida"><i></i><span></span></div><div class="barra mana"><i></i><span></span></div><div class="barra xp"><i></i></div>
      <div id="ouro"></div></div></div>
    <div id="ondaBox"><div id="ondaT"></div><div class="barra muro"><i></i><span></span></div><div id="ondaSub"></div><button id="bOnda" class="btn sm">⚔️ Começar agora</button></div>
    <div id="topoD"><canvas id="mini" width="220" height="220"></canvas><button id="bMenu" aria-label="Menu">📜</button></div>
    <div id="chefeBar" hidden><span></span><div class="barra"><i></i></div></div>
    <div id="painel" hidden></div>
    <div id="acoes">
      <button id="bAtk" class="bt grande">⚔️</button>
      ${cls.hab.map((hb, i) => `<button class="bt hab" data-i="${i}"><b>${hb.icone}</b><em></em><small>${hb.mana}</small></button>`).join('')}
      <button id="bEsq" class="bt esq">🦶</button>
    </div>
    <div id="faixa"></div><div id="toast"></div>`;
  ov = $('#ov'); g = ov.getContext('2d'); mini = $('#mini'); mg = mini.getContext('2d');
  mapaBase = desenharMapaBase();
  medirOv(); addEventListener('resize', medirOv);
  const segurar = (el, on, off) => {
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); on(); el.classList.add('ap'); });
    const fim = () => { off && off(); el.classList.remove('ap'); };
    el.addEventListener('pointerup', fim); el.addEventListener('pointercancel', fim); el.addEventListener('lostpointercapture', fim);
  };
  segurar($('#bAtk'), () => { entrada.atacar = true; }, () => { entrada.atacar = false; });
  document.querySelectorAll('.hab').forEach(b => segurar(b, () => { const hb = CLASSES[G.jog.cls].hab[+b.dataset.i]; if (!habLiberada(hb)) return toast(`${hb.nome}: libera no nível ${hb.nivel} do herói`); entrada.hab[+b.dataset.i] = true; }));
  segurar($('#bEsq'), () => { entrada.esquivar = true; });
  $('#bOnda').onclick = () => comecarOnda();
  $('#bMenu').addEventListener('click', () => abrirMenu('heroi'));
  controlesToque(); teclado();
}
function medirOv() { const d = Math.min(devicePixelRatio, 2); ov.width = innerWidth * d; ov.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0); }

// ---------------- joystick e câmera ----------------
let joy = null, cam = null;
function controlesToque() {
  const area = $('#toque');
  area.addEventListener('pointerdown', e => {
    if (ui.pausado) return;
    if (e.clientX < innerWidth * 0.45 && !joy) joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY };
    else if (!cam) cam = { id: e.pointerId, x: e.clientX, y: e.clientY };
    area.setPointerCapture(e.pointerId);
  });
  area.addEventListener('pointermove', e => {
    if (joy && e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; }
    if (cam && e.pointerId === cam.id) { C.camera.yaw -= (e.clientX - cam.x) * 0.006; C.camera.pitch = Math.max(0.3, Math.min(1.15, C.camera.pitch + (e.clientY - cam.y) * 0.004)); cam.x = e.clientX; cam.y = e.clientY; cam.mexeu = G.t; }
  });
  const fim = e => { if (joy && e.pointerId === joy.id) joy = null; if (cam && e.pointerId === cam.id) cam = null; };
  area.addEventListener('pointerup', fim); area.addEventListener('pointercancel', fim);
  area.addEventListener('wheel', e => { C.camera.dist = Math.max(6, Math.min(22, C.camera.dist + e.deltaY * 0.01)); }, { passive: true });
}
const teclas = new Set();
function teclado() {
  addEventListener('keydown', e => {
    if (ui.pausado) return; teclas.add(e.code);
    if (e.code === 'KeyJ' || e.code === 'Enter') entrada.atacar = true;
    if (e.code === 'Digit1') entrada.hab[0] = true; if (e.code === 'Digit2') entrada.hab[1] = true; if (e.code === 'Digit3') entrada.hab[2] = true;
    if (e.code === 'Space') entrada.esquivar = true; if (e.code === 'KeyG') comecarOnda();
    if (e.code === 'Equal') C.camera.dist = Math.max(6, C.camera.dist - 1); if (e.code === 'Minus') C.camera.dist = Math.min(22, C.camera.dist + 1);
  });
  addEventListener('keyup', e => { teclas.delete(e.code); if (e.code === 'KeyJ' || e.code === 'Enter') entrada.atacar = false; });
}
function lerMovimento(dt) {
  let jx = 0, jy = 0;
  if (joy) { const dx = joy.x - joy.sx, dy = joy.y - joy.sy, m = Math.hypot(dx, dy); if (m > 6) { const f = Math.min(1, m / 55); jx = dx / m * f; jy = dy / m * f; } }
  if (teclas.has('KeyW') || teclas.has('ArrowUp')) jy -= 1; if (teclas.has('KeyS') || teclas.has('ArrowDown')) jy += 1;
  if (teclas.has('KeyA') || teclas.has('ArrowLeft')) jx -= 1; if (teclas.has('KeyD') || teclas.has('ArrowRight')) jx += 1;
  const m = Math.hypot(jx, jy); if (m > 1) { jx /= m; jy /= m; }
  const y = C.camera.yaw, sy = Math.sin(y), cy = Math.cos(y);
  entrada.mx = -jy * sy - jx * cy; entrada.mz = -jy * cy + jx * sy;
  const j = G.jog; // câmera acompanha devagar a direção do herói
  if (Math.hypot(jx, jy) > 0.3 && (!cam || G.t - (cam.mexeu || 0) > 0.5) && j.estado === 'livre') { const d = Math.atan2(Math.sin(j.ang - y), Math.cos(j.ang - y)); C.camera.yaw += Math.sin(d) * 0.6 * dt * Math.min(1, Math.abs(jx) + 0.2); }
}

// ---------------- mensagens ----------------
let toastT = 0, chefeAtivo = null;
export function toast(txt, dur = 2.6) { const t = $('#toast'); t.innerHTML = txt; t.classList.add('on'); toastT = dur; }
function faixa(txt, sub = '', dur = 3) { const f = $('#faixa'); f.innerHTML = `<b>${txt}</b>${sub ? `<span>${sub}</span>` : ''}`; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); clearTimeout(f._t); f._t = setTimeout(() => f.classList.remove('on'), dur * 1000); }
function processarEventos() {
  while (G.fila.length) {
    const e = G.fila.shift();
    if (e.tipo === 'toast') toast(e.txt);
    if (e.tipo === 'nivel') faixa(`Herói nível ${e.nivel}!`, e.hab ? `Nova habilidade: ${e.hab.icone} ${e.hab.nome}` : 'Vida e força aumentaram');
    if (e.tipo === 'onda') faixa(`Onda ${e.n}`, e.chefe ? '⚠️ Um chefe está vindo!' : 'Os esqueletos estão vindo!');
    if (e.tipo === 'vitoria') faixa(`Onda ${e.n} vencida!`, `+${e.bonus} 🪙 de bônus`);
    if (e.tipo === 'derrota') derrota(e.n);
    if (e.tipo === 'construiu') toast(`🔨 ${e.nome} — nível ${e.nivel}`);
    if (e.tipo === 'pad') abrirPainel(e.k);
    if (e.tipo === 'chefe') { chefeAtivo = e.e; toast(`<b>${e.e.d.nome}:</b> Sua muralha vai virar pó!`, 4); }
    if (e.tipo === 'fala') toast(`<b>${e.quem}:</b> ${e.txt}`, 4);
    if (e.tipo === 'chefeMorto') { chefeAtivo = null; faixa('👑 Chefe derrotado!'); }
    if (e.tipo === 'boasVindas') boasVindas();
  }
}
function boasVindas() {
  ui.pausado = true;
  const d = $('#dialogo'); d.hidden = false;
  d.innerHTML = `<div class="dBox" style="--c:#ffd84a"><b>Defenda a Coroa de Ferro!</b>
    <p>🧟 Os esqueletos vêm pelas estradas do norte e atacam a <b>muralha</b>. Se ela cair, a onda recomeça.</p>
    <p>🟢 Pise nos <b>botões verdes</b> para construir e melhorar: torre de arqueiros, catapulta, balista, torre mágica e quartel. Cada uma tem <b>8 níveis</b>.</p>
    <p>⛏️ Construa a <b>mina de ouro</b> e passe no <b>cofre 💰</b> para coletar. Melhore o herói na <b>forja</b>.</p>
    <div class="dOp"></div></div>`;
  const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Vamos lá!'; b.onclick = () => { d.hidden = true; ui.pausado = false; }; d.querySelector('.dOp').append(b);
}
function derrota(n) {
  const m = $('#morte'); m.hidden = false;
  m.innerHTML = `<div class="mBox"><h2>A muralha caiu!</h2><p>A onda ${n} foi forte demais. Melhore suas defesas e tente de novo — seu ouro e suas construções continuam.</p></div>`;
  const b = document.createElement('button'); b.className = 'btn grande'; b.textContent = '🔁 Tentar de novo'; b.onclick = () => { m.hidden = true; tentarDeNovo(); }; m.querySelector('.mBox').append(b);
}

// ---------------- painel dos botões do chão ----------------
let painelK = null;
function abrirPainel(k) { painelK = k; desenharPainel(); }
function linhaStats(tipo, n) {
  const s = statsDefesa(tipo, n);
  if (tipo === 'quartel') return `🪖 ${s.soldados} soldado${s.soldados > 1 ? 's' : ''} · ❤️ ${Math.round(s.vida)} · ⚔️ ${Math.round(s.atk)}${s.arqueiro ? ' · 🏹 arqueiros' : ''}`;
  const extra = tipo === 'arqueiros' ? ` · 🎯 ${s.alvos} alvo${s.alvos > 1 ? 's' : ''}` : tipo === 'catapulta' ? ` · 💥 área ${s.raio.toFixed(1)}m` : tipo === 'balista' ? ` · atravessa ${s.perfura}` : tipo === 'magia' ? ` · ❄️ ${Math.round(s.lento * 100)}% lento${s.corrente > 1 ? ` · ⚡ salta ${s.corrente}` : ''}` : '';
  return `⚔️ ${Math.round(s.dano)} · ⏱️ ${s.cad.toFixed(1)}s · 📏 ${Math.round(s.alcance)}m${extra}`;
}
function desenharPainel() {
  const p = $('#painel'), k = painelK;
  if (!k || k === 'cofre' || G.onda.estado === 'derrota') { p.hidden = true; return; }
  const ouro = G.ouro, botao = (txt, custo, acao, cls = '') => `<button class="btn ${cls} ${custo != null && ouro < custo ? 'caro' : ''}" data-a="${acao}">${txt}${custo != null ? ` — ${fmt(custo)} 🪙` : ''}</button>`;
  let html = '';
  const slot = SLOTS.find(s => s.id === k);
  if (slot) {
    const d = G.def[k];
    if (!d) {
      html = `<h3>🟫 Terreno vazio</h3><div class="opcoes">` +
        Object.entries(DEFESAS).map(([t, df]) => `<button class="opc ${ouro < df.custo ? 'caro' : ''}" data-a="c:${t}" style="--c:${df.cor}"><i>${df.icone}</i><b>${df.nome}</b><span>${df.desc}</span><em>${fmt(df.custo)} 🪙</em></button>`).join('') + '</div>';
    } else {
      const df = DEFESAS[d.tipo], max = d.nivel >= MAXNV;
      html = `<h3>${df.icone} ${df.nome} <small>Nível ${d.nivel}/${MAXNV}</small></h3><div class="nivs">${Array.from({ length: MAXNV }, (_, i) => `<i class="${i < d.nivel ? 'on' : ''}"></i>`).join('')}</div>
        <p>${linhaStats(d.tipo, d.nivel)}</p>${max ? '<p class="dica">⭐ Nível máximo!</p>' : `<p class="prox">➡️ ${linhaStats(d.tipo, d.nivel + 1)}</p>`}
        <div class="linha">${max ? '' : botao('⬆️ Melhorar', custoDefesa(d.tipo, d.nivel + 1), 'm', 'ok')}${botao(`💰 Vender +${fmt(valorVenda(k))}`, null, 'v', 'sec')}</div>`;
    }
  } else if (k === 'muralha') {
    const m = G.muro, max = m.nivel >= 8, c = custoConserto();
    html = `<h3>🧱 ${MURALHA.nomes[m.nivel - 1]} <small>Nível ${m.nivel}/8</small></h3><div class="nivs">${Array.from({ length: 8 }, (_, i) => `<i class="${i < m.nivel ? 'on' : ''}"></i>`).join('')}</div>
      <p>❤️ ${Math.ceil(m.hp)}/${m.max}</p>${max ? '' : `<p class="prox">➡️ ${MURALHA.nomes[m.nivel]} · ❤️ ${MURALHA.vida[m.nivel]}</p>`}
      <div class="linha">${max ? '' : botao('⬆️ Melhorar', MURALHA.custo[m.nivel], 'mm', 'ok')}${c > 0 && G.onda.estado !== 'ativa' ? botao('🔧 Consertar', c, 'cm') : ''}</div>`;
  } else if (k === 'mina') {
    const m = G.mina, max = m.nivel >= 8;
    html = `<h3>⛏️ Mina de Ouro <small>${m.nivel ? `Nível ${m.nivel}/8` : 'Não construída'}</small></h3>
      <p>${m.nivel ? `🪙 ${MINA.renda[m.nivel - 1]}/s · o cofre guarda até ${Math.round(MINA.renda[m.nivel - 1] * MINA.cofre)}` : 'Gera ouro sozinha, o tempo todo.'}</p>
      ${max ? '' : `<p class="prox">➡️ 🪙 ${MINA.renda[m.nivel]}/s</p>`}<p class="dica">Passe no 💰 cofre para coletar.</p>
      <div class="linha">${max ? '' : botao(m.nivel ? '⬆️ Melhorar' : '🔨 Construir', MINA.custo[m.nivel], 'mi', 'ok')}</div>`;
  } else if (k === 'arma' || k === 'armadura') {
    const n = G.jog.forja[k], max = n >= FORJA.max;
    const bonus = n2 => k === 'arma' ? `⚔️ +${n2 * 12}% ataque` : `🛡️ +${n2 * 12}% defesa · ❤️ +${n2 * 8}% vida`;
    html = `<h3>${k === 'arma' ? '🗡️ Forja: Arma' : '🛡️ Forja: Armadura'} <small>+${n}</small></h3><p>${bonus(n)}</p>${max ? '' : `<p class="prox">➡️ ${bonus(n + 1)}</p>`}
      <div class="linha">${max ? '' : botao('🔨 Forjar', FORJA.custo(n), 'f', 'ok')}</div>`;
  }
  if (p.innerHTML !== html) p.innerHTML = html;
  p.hidden = !html;
  p.onclick = e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a.startsWith('c:')) construir(k, a.slice(2));
    if (a === 'm') melhorarDefesa(k);
    if (a === 'v' && confirm('Vender esta defesa por metade do valor?')) venderDefesa(k);
    if (a === 'mm') melhorarMuro(); if (a === 'cm') consertarMuro(); if (a === 'mi') melhorarMina();
    if (a === 'f') melhorarForja(k);
    desenharPainel();
  };
}

// ---------------- menu ----------------
let abaMenu = 'heroi';
export function abrirMenu(aba) { abaMenu = aba; ui.pausado = true; entrada.atacar = false; $('#menu').hidden = false; desenharMenu(); }
function fecharMenu() { $('#menu').hidden = true; ui.pausado = false; }
function desenharMenu() {
  const j = G.jog, s = stats(), cls = CLASSES[j.cls], m = $('#menu');
  const abas = [['heroi', '🧙 Herói'], ['defesas', '🏰 Defesas'], ['ajustes', '⚙️ Ajustes']];
  let corpo = '';
  if (abaMenu === 'heroi') {
    corpo = `<div class="ficha"><div class="fRet" style="--c:${cls.cor}">${cls.icone}</div><div><h3>${cls.nome} — Nível ${j.nivel}</h3>
      <p>XP ${Math.floor(j.xp)}/${xpProx(j.nivel)} · 💀 ${j.abates} abates · 🌊 recorde: onda ${G.onda.recorde}</p></div></div>
      <div class="stats"><span>❤️ Vida <b>${Math.round(s.vida)}</b></span><span>💧 Mana <b>${Math.round(s.mana)}</b></span><span>⚔️ Ataque <b>${Math.round(s.atk)}</b></span><span>🛡️ Defesa <b>${Math.round(s.def)}</b></span></div>
      <p class="dica">Forja: arma +${j.forja.arma} · armadura +${j.forja.armadura} (botões da forja, à direita da base)</p>
      <h4>Habilidades</h4>${cls.hab.map(hb => `<div class="habL ${habLiberada(hb) ? '' : 'bloq'}"><i>${hb.icone}</i><div><b>${hb.nome}</b><span>${habLiberada(hb) ? hb.desc : `Libera no nível ${hb.nivel}`} · ${hb.mana} mana · ${hb.cd}s</span></div></div>`).join('')}`;
  }
  if (abaMenu === 'defesas') {
    corpo = `<p class="dica">Pise no botão verde na frente de cada construção para melhorar.</p>` +
      SLOTS.map((sl, i) => { const d = G.def[sl.id]; return d ? `<div class="habL"><i>${DEFESAS[d.tipo].icone}</i><div><b>${DEFESAS[d.tipo].nome} — nível ${d.nivel}/8</b><span>${linhaStats(d.tipo, d.nivel)}</span></div></div>` : `<div class="habL bloq"><i>🟫</i><div><b>Terreno ${i + 1}</b><span>vazio</span></div></div>`; }).join('') +
      `<div class="habL"><i>🧱</i><div><b>${MURALHA.nomes[G.muro.nivel - 1]} — nível ${G.muro.nivel}/8</b><span>❤️ ${G.muro.max}</span></div></div>
       <div class="habL ${G.mina.nivel ? '' : 'bloq'}"><i>⛏️</i><div><b>Mina de Ouro — nível ${G.mina.nivel}/8</b><span>${G.mina.nivel ? `🪙 ${MINA.renda[G.mina.nivel - 1]}/s` : 'não construída'}</span></div></div>`;
  }
  if (abaMenu === 'ajustes') {
    corpo = `<h4>Gráficos</h4><div class="linha">${['baixa', 'media', 'alta'].map(q => `<button class="btn sm ${ui.qualidade === q ? 'ok' : ''}" data-q="${q}">${{ baixa: 'Leve', media: 'Normal', alta: 'Bonito' }[q]}</button>`).join('')}</div>
      <p class="dica">Muda na próxima vez que abrir o jogo. "Leve" desliga as sombras.</p>
      <h4>Controles</h4><p class="dica">Esquerda da tela: andar. Direita: girar a câmera. ⚔️ ataca, 🦶 esquiva. No PC: WASD, J, 1-3, espaço, G começa a onda, +/- zoom.</p>
      <h4>Jogo</h4><button class="btn perigo" data-novo="1">Começar um novo jogo</button>`;
  }
  m.innerHTML = `<div class="mTopo">${abas.map(([k, t]) => `<button class="aba ${k === abaMenu ? 'on' : ''}" data-aba="${k}">${t}</button>`).join('')}<button class="x" data-fechar="1">✕</button></div><div class="mCorpo">${corpo}</div>`;
  m.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.aba) { abaMenu = b.dataset.aba; desenharMenu(); }
    if (b.dataset.fechar) fecharMenu();
    if (b.dataset.q) { ui.qualidade = b.dataset.q; try { localStorage.setItem('coroa_rpg_q', ui.qualidade); } catch (e) {} desenharMenu(); }
    if (b.dataset.novo && confirm('Apagar o progresso e começar do zero?')) { apagarSave(); location.reload(); }
  };
}

// ---------------- minimapa ----------------
function desenharMapaBase() {
  const N = 440, cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d'), k = N / (LIM * 2), W = v => (v + LIM) * k;
  c.fillStyle = '#4f7a34'; c.fillRect(0, 0, N, N);
  c.fillStyle = '#2c4f25'; c.fillRect(0, 0, N, W(-66)); c.fillRect(0, 0, W(-58), N); c.fillRect(W(58), 0, N, N);
  c.fillStyle = '#7a8f5a'; c.fillRect(W(MURO.x0), W(1), (MURO.x1 - MURO.x0) * k, 40 * k);
  c.strokeStyle = '#c9b07a'; c.lineCap = 'round'; for (const cm of G.M.caminhos) { c.lineWidth = cm.w * k; c.beginPath(); cm.pts.forEach(([x, z], i) => i ? c.lineTo(W(x), W(z)) : c.moveTo(W(x), W(z))); c.stroke(); }
  c.fillStyle = '#8b6a4a'; for (const cs of G.M.casas) c.fillRect(W(cs.x - cs.ax), W(cs.z - cs.az), cs.ax * 2 * k, cs.az * 2 * k);
  c.fillStyle = '#ff5a4a'; for (const e of ESTRADAS) { c.beginPath(); c.arc(W(e[0][0]), W(e[0][1]), 5, 0, 7); c.fill(); }
  return { cv, k };
}
function desenharMini() {
  const S = mini.width, R = S / 2, j = G.jog, esc = 1.35;
  mg.save(); mg.clearRect(0, 0, S, S); mg.beginPath(); mg.arc(R, R, R - 2, 0, 7); mg.clip();
  mg.translate(R, R); mg.rotate(C.camera.yaw + Math.PI);
  const k = mapaBase.k; mg.scale(esc / k, esc / k); mg.translate(-(j.x + LIM) * k, -(j.z + LIM) * k);
  mg.drawImage(mapaBase.cv, 0, 0);
  mg.setTransform(1, 0, 0, 1, 0, 0);
  const P = (x, z) => { const dx = (x - j.x) * esc, dz = (z - j.z) * esc, a = C.camera.yaw + Math.PI, c = Math.cos(a), s = Math.sin(a); return [R + dx * c - dz * s, R + dx * s + dz * c]; };
  const [ax, ay] = P(MURO.x0, 0), [bx, by] = P(MURO.x1, 0); mg.strokeStyle = G.muro.flash > 0 ? '#ff6a4a' : '#e8e0d0'; mg.lineWidth = 4; mg.beginPath(); mg.moveTo(ax, ay); mg.lineTo(bx, by); mg.stroke();
  for (const sl of SLOTS) { const d = G.def[sl.id], [x, y] = P(sl.x, sl.z); mg.fillStyle = d ? DEFESAS[d.tipo].cor : '#6b5a3c'; mg.fillRect(x - 5, y - 5, 10, 10); }
  for (const e of G.inim) if (e.estado !== 'morto') { const [x, y] = P(e.x, e.z); mg.fillStyle = e.d.chefe ? '#ff2a2a' : '#ff6a5a'; mg.beginPath(); mg.arc(x, y, e.d.chefe || e.d.elite ? 5 : 2.8, 0, 7); mg.fill(); }
  for (const s of G.sold) if (s.estado !== 'morto') { const [x, y] = P(s.x, s.z); mg.fillStyle = '#6ab0ff'; mg.beginPath(); mg.arc(x, y, 2.8, 0, 7); mg.fill(); }
  mg.restore();
  mg.save(); mg.translate(R, R); mg.rotate(C.camera.yaw - j.ang); mg.fillStyle = '#fff'; mg.strokeStyle = '#000'; mg.lineWidth = 1.5;
  mg.beginPath(); mg.moveTo(0, -8); mg.lineTo(6, 6); mg.lineTo(0, 3); mg.lineTo(-6, 6); mg.closePath(); mg.fill(); mg.stroke(); mg.restore();
  mg.strokeStyle = 'rgba(255,230,170,.9)'; mg.lineWidth = 3; mg.beginPath(); mg.arc(R, R, R - 2, 0, 7); mg.stroke();
}

// ---------------- sobreposição 2D ----------------
function rotuloPad(k) {
  const slot = SLOTS.find(s => s.id === k);
  if (slot) { const d = G.def[k]; if (!d) return ['🔨 Construir', null]; if (d.nivel >= MAXNV) return [`${DEFESAS[d.tipo].icone} MAX`, null]; return [`${DEFESAS[d.tipo].icone} Nv ${d.nivel + 1}`, custoDefesa(d.tipo, d.nivel + 1)]; }
  if (k === 'muralha') return G.muro.nivel >= 8 ? ['🧱 MAX', null] : [`🧱 Muralha ${G.muro.nivel + 1}`, MURALHA.custo[G.muro.nivel]];
  if (k === 'mina') return G.mina.nivel >= 8 ? ['⛏️ MAX', null] : [G.mina.nivel ? `⛏️ Mina ${G.mina.nivel + 1}` : '⛏️ Mina de ouro', MINA.custo[G.mina.nivel]];
  if (k === 'cofre') return [`💰 ${Math.floor(G.mina.cofre)}`, null];
  if (k === 'arma') return [`🗡️ Arma +${G.jog.forja.arma + 1}`, FORJA.custo(G.jog.forja.arma)];
  if (k === 'armadura') return [`🛡️ Armadura +${G.jog.forja.armadura + 1}`, FORJA.custo(G.jog.forja.armadura)];
  return ['', null];
}
function caixa(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function desenharOverlay() {
  g.clearRect(0, 0, innerWidth, innerHeight);
  const j = G.jog;
  if (joy) { g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 3; g.beginPath(); g.arc(joy.sx, joy.sy, 55, 0, 7); g.stroke(); const dx = joy.x - joy.sx, dy = joy.y - joy.sy, m = Math.hypot(dx, dy), f = Math.min(1, 55 / (m || 1)); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(joy.sx + dx * f, joy.sy + dy * f, 24, 0, 7); g.fill(); }
  g.textAlign = 'center';
  for (const [k, p] of Object.entries(G.pads)) {
    const [txt, custo] = rotuloPad(k), pode = custo == null || G.ouro >= custo;
    p.v.cor(k === 'cofre' ? 0xffc83a : pode ? 0x3ad05a : 0xd84a3a, k === 'cofre' ? 0x8a6a10 : pode ? 0x1a8a2a : 0x6a1a10);
    if (Math.hypot(p.x - j.x, p.z - j.z) > 30) continue;
    const t = C.tela(p.x, 1.1, p.z); if (!t) continue;
    const linha2 = custo != null ? `${fmt(custo)} 🪙` : '';
    g.font = '800 13px system-ui'; const w = Math.max(g.measureText(txt).width, g.measureText(linha2).width) + 14, h = linha2 ? 36 : 20;
    g.fillStyle = 'rgba(20,12,6,.75)'; caixa(t[0] - w / 2, t[1] - h - 4, w, h, 7); g.fill();
    g.fillStyle = '#fff'; g.fillText(txt, t[0], t[1] - h + 10);
    if (linha2) { g.fillStyle = pode ? '#ffd84a' : '#ff8a7a'; g.fillText(linha2, t[0], t[1] - 10); }
  }
  for (const e of G.inim) {
    if (e.estado === 'morto' || e.d.chefe || e.hp >= e.max) continue;
    if (Math.hypot(e.x - j.x, e.z - j.z) > 45) continue;
    const p = C.tela(e.x, 2.35 * (e.d.esc || 1), e.z); if (!p) continue;
    const w = e.d.elite ? 70 : 40, [x, y] = p;
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
    g.fillStyle = e.d.elite ? '#ff9a2a' : '#e2412f'; g.fillRect(x - w / 2, y, w * Math.max(0, e.hp / e.max), 4);
  }
  for (const s of G.sold) { if (s.estado === 'morto' || s.hp >= s.max) continue; const p = C.tela(s.x, 2.1, s.z); if (!p) continue; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(p[0] - 17, p[1] - 1, 34, 5); g.fillStyle = '#4aa3ff'; g.fillRect(p[0] - 16, p[1], 32 * Math.max(0, s.hp / s.max), 3); }
  for (const t of G.txt) {
    const p = C.tela(t.x, t.y + t.t * 1.3, t.z); if (!p) continue;
    g.globalAlpha = Math.max(0, 1 - t.t / 1.1); g.font = `800 ${t.grande ? 22 : 15}px system-ui`; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.75)';
    g.strokeText(t.s, p[0], p[1]); g.fillStyle = t.cor; g.fillText(t.s, p[0], p[1]); g.globalAlpha = 1;
  }
}

// ---------------- atualização por quadro ----------------
let painelT = 0;
export function atualizar(dt) {
  if (!G.jog) return;
  if (!ui.pausado) lerMovimento(dt); else entrada.mx = entrada.mz = 0;
  processarEventos();
  const j = G.jog, s = stats(), cls = CLASSES[j.cls], o = G.onda;
  $('#nv').textContent = j.nivel;
  const barra = (sel, v, max, txt) => { const b = $(sel); b.querySelector('i').style.width = Math.max(0, Math.min(100, v / max * 100)) + '%'; const sp = b.querySelector('span'); if (sp) sp.textContent = txt; };
  barra('.barra.vida', j.hp, s.vida, `${Math.ceil(j.hp)}/${Math.round(s.vida)}`);
  barra('.barra.mana', j.mp, s.mana, `${Math.floor(j.mp)}/${Math.round(s.mana)}`);
  barra('.barra.xp', j.xp, xpProx(j.nivel));
  barra('.barra.muro', G.muro.hp, G.muro.max, `🧱 ${Math.ceil(G.muro.hp)}/${G.muro.max}`);
  $('.barra.muro').classList.toggle('dano', G.muro.flash > 0);
  $('#ouro').textContent = `🪙 ${fmt(G.ouro)}`;
  $('#ondaT').textContent = `🌊 Onda ${o.n}`;
  $('#ondaSub').textContent = o.estado === 'ativa' ? `💀 ${restantes()} inimigos` : o.estado === 'preparo' ? `Próxima onda em ${Math.ceil(o.contagem)}s` : '';
  $('#bOnda').hidden = o.estado !== 'preparo';
  cls.hab.forEach((hb, i) => {
    const b = document.querySelector(`.hab[data-i="${i}"]`), cd = j.cds[hb.id] || 0, lib = habLiberada(hb);
    b.classList.toggle('bloq', !lib); b.classList.toggle('semMana', lib && j.mp < hb.mana);
    b.style.setProperty('--p', cd > 0 ? (cd / hb.cd * 360) + 'deg' : '0deg');
    b.querySelector('em').textContent = !lib ? '🔒' : cd > 0 ? Math.ceil(cd) : '';
  });
  $('#bEsq').style.setProperty('--p', (j.cds.esq || 0) > 0 ? ((j.cds.esq / 0.9) * 360) + 'deg' : '0deg');
  const cb = $('#chefeBar');
  if (chefeAtivo && chefeAtivo.estado !== 'morto') { cb.hidden = false; cb.querySelector('span').textContent = `👑 ${chefeAtivo.d.nome}`; cb.querySelector('i').style.width = Math.max(0, chefeAtivo.hp / chefeAtivo.max * 100) + '%'; } else cb.hidden = true;
  if (painelK) { painelT += dt; if (painelT > 0.5) { painelT = 0; desenharPainel(); } }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('#toast').classList.remove('on'); }
  desenharMini(); desenharOverlay();
}
