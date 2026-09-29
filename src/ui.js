// Interface: HUD, controles (joystick + botões + teclado), diálogos, menus e minimapa.
import * as C from './cena.js';
import { G, entrada, stats, habLiberada, interativoPerto, missaoDisponivel, aceitarMissao, entregarMissao, equipar, vender, renascer, salvar, apagarSave, texto } from './jogo.js';
import { CLASSES, RARIDADES, xpProx, precoItem, POCAO, ETER, novoItem, MISSOES } from './dados.js';
import { LIM, CASTELO, zonaDe } from './mundo.js';

const $ = s => document.querySelector(s);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const ui = { pausado: false, qualidade: 'media' };
let ov, g, mini, mg, mapaBase;

// ---------------- montagem ----------------
export function montarHUD() {
  const cls = CLASSES[G.jog.cls];
  $('#hud').innerHTML = `
    <div id="perfil"><div id="retrato" style="--c:${cls.cor}">${cls.icone}<b id="nv"></b></div>
      <div id="barras"><div class="barra vida"><i></i><span></span></div><div class="barra mana"><i></i><span></span></div><div class="barra xp"><i></i></div>
      <div id="ouro"></div></div></div>
    <div id="missao"></div>
    <div id="topoD"><canvas id="mini" width="220" height="220"></canvas><button id="bMenu" aria-label="Menu">🎒</button></div>
    <div id="chefeBar" hidden><span></span><div class="barra"><i></i></div></div>
    <div id="acoes">
      <button id="bAtk" class="bt grande">⚔️</button>
      ${cls.hab.map((hb, i) => `<button class="bt hab" data-i="${i}"><b>${hb.icone}</b><em></em><small>${hb.mana}</small></button>`).join('')}
      <button id="bEsq" class="bt esq">🦶</button>
      <button id="bPoc" class="bt poc">🧪<small></small></button>
      <button id="bEter" class="bt eter">💧<small></small></button>
      <button id="bFalar" class="bt falar" hidden>💬<span>Falar</span></button>
    </div>
    <div id="faixa"></div><div id="toast"></div>`;
  ov = $('#ov'); g = ov.getContext('2d'); mini = $('#mini'); mg = mini.getContext('2d');
  mapaBase = desenharMapaBase();
  medirOv(); addEventListener('resize', medirOv);
  // botões
  const segurar = (el, on, off) => {
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); on(); el.classList.add('ap'); });
    const fim = e => { off && off(); el.classList.remove('ap'); };
    el.addEventListener('pointerup', fim); el.addEventListener('pointercancel', fim); el.addEventListener('lostpointercapture', fim);
  };
  segurar($('#bAtk'), () => { entrada.atacar = true; }, () => { entrada.atacar = false; });
  document.querySelectorAll('.hab').forEach(b => segurar(b, () => { const hb = CLASSES[G.jog.cls].hab[+b.dataset.i]; if (!habLiberada(hb)) return toast(`${hb.nome}: libera no nível ${hb.nivel}`); entrada.hab[+b.dataset.i] = true; }));
  segurar($('#bEsq'), () => { entrada.esquivar = true; });
  segurar($('#bPoc'), () => { entrada.pocao = true; });
  segurar($('#bEter'), () => { entrada.eter = true; });
  segurar($('#bFalar'), () => { entrada.interagir = true; });
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
    if (e.clientX < innerWidth * 0.45 && !joy) { joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY }; }
    else if (!cam) cam = { id: e.pointerId, x: e.clientX, y: e.clientY };
    area.setPointerCapture(e.pointerId);
  });
  area.addEventListener('pointermove', e => {
    if (joy && e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; }
    if (cam && e.pointerId === cam.id) { C.camera.yaw -= (e.clientX - cam.x) * 0.006; C.camera.pitch = Math.max(0.2, Math.min(1.0, C.camera.pitch + (e.clientY - cam.y) * 0.004)); cam.x = e.clientX; cam.y = e.clientY; cam.mexeu = G.t; }
  });
  const fim = e => { if (joy && e.pointerId === joy.id) joy = null; if (cam && e.pointerId === cam.id) cam = null; };
  area.addEventListener('pointerup', fim); area.addEventListener('pointercancel', fim);
  area.addEventListener('wheel', e => { C.camera.dist = Math.max(5, Math.min(13, C.camera.dist + e.deltaY * 0.01)); }, { passive: true });
}
const teclas = new Set();
function teclado() {
  addEventListener('keydown', e => {
    if (ui.pausado) return; teclas.add(e.code);
    if (e.code === 'KeyJ' || e.code === 'Enter') entrada.atacar = true;
    if (e.code === 'Digit1') entrada.hab[0] = true; if (e.code === 'Digit2') entrada.hab[1] = true; if (e.code === 'Digit3') entrada.hab[2] = true;
    if (e.code === 'Space') entrada.esquivar = true; if (e.code === 'KeyE') entrada.interagir = true; if (e.code === 'KeyQ') entrada.pocao = true; if (e.code === 'KeyR') entrada.eter = true;
    if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); abrirMenu('mochila'); }
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
  // câmera acompanha devagar a direção do herói quando ele anda (e você não está girando)
  const j = G.jog;
  if (Math.hypot(jx, jy) > 0.3 && (!cam || G.t - (cam.mexeu || 0) > 0.5) && j.estado === 'livre') {
    const d = Math.atan2(Math.sin(j.ang - y), Math.cos(j.ang - y)); C.camera.yaw += Math.sin(d) * 0.7 * dt * Math.min(1, Math.abs(jx) + 0.2);
  }
}

// ---------------- mensagens ----------------
let toastT = 0;
export function toast(txt, dur = 2.6) { const t = $('#toast'); t.textContent = txt; t.classList.add('on'); toastT = dur; }
function faixa(txt, sub = '', dur = 3) { const f = $('#faixa'); f.innerHTML = `<b>${txt}</b>${sub ? `<span>${sub}</span>` : ''}`; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); clearTimeout(f._t); f._t = setTimeout(() => f.classList.remove('on'), dur * 1000); }
let chefeAtivo = null;
function processarEventos() {
  while (G.fila.length) {
    const e = G.fila.shift();
    if (e.tipo === 'toast') toast(e.txt);
    if (e.tipo === 'zona') faixa(e.nome, e.segura ? 'Zona segura' : '');
    if (e.tipo === 'nivel') { faixa(`Nível ${e.nivel}!`, e.hab ? `Nova habilidade: ${e.hab.icone} ${e.hab.nome}` : 'Vida e força aumentaram'); }
    if (e.tipo === 'item') { const r = RARIDADES[e.item.rar]; toast(`🎁 ${e.item.nome} (${r.n})`); }
    if (e.tipo === 'missaoOk') faixa('Objetivo concluído!', `${e.nome} — volte ao Ancião`);
    if (e.tipo === 'morte') morte(e.perda);
    if (e.tipo === 'dialogo') dialogoNPC(e.npc, e.abertura);
    if (e.tipo === 'chefe') { chefeAtivo = e.e; falaRapida('Rei Esqueleto', 'Quem ousa invadir MEU castelo? Vou adicionar seus ossos à coleção!'); }
    if (e.tipo === 'fala') falaRapida(e.quem, e.txt);
    if (e.tipo === 'chefeMorto') { chefeAtivo = null; faixa('👑 Rei Esqueleto derrotado!', 'Leve a Coroa de Ferro ao Ancião'); }
  }
}
function falaRapida(quem, txt) { const t = $('#toast'); t.innerHTML = `<b>${quem}:</b> ${txt}`; t.classList.add('on'); toastT = 4; }

// ---------------- diálogos ----------------
// sequência de falas; opcoes = [{txt, acao}] no final
function dialogo(nome, cor, falas, opcoes = [{ txt: 'Continuar' }]) {
  ui.pausado = true; entrada.atacar = false;
  const d = $('#dialogo'); d.hidden = false; let i = 0;
  const mostrar = () => {
    d.innerHTML = `<div class="dBox" style="--c:${cor}"><b>${nome}</b><p>${falas[i]}</p><div class="dOp"></div></div>`;
    const op = d.querySelector('.dOp');
    if (i < falas.length - 1) { op.append(botao('Continuar ▸', () => { i++; mostrar(); })); return; }
    for (const o of opcoes) op.append(botao(o.txt, () => { fechar(); o.acao && o.acao(); }, o.desab));
  };
  const fechar = () => { d.hidden = true; ui.pausado = false; };
  mostrar();
}
function botao(txt, fn, desab) { const b = h('button', 'btn', txt); b.disabled = !!desab; b.onclick = fn; return b; }

function dialogoNPC(id, abertura) {
  const j = G.jog, npc = G.npcs.find(n => n.id === id);
  if (id === 'anciao') {
    const nome = npc.nome, cor = '#b89bff';
    if (j.mis && j.mis.estado === 'completa') {
      const m = j.mis; const rec = entregarMissao();
      return dialogo(nome, cor, m.falaFim, [{ txt: 'Receber recompensa', acao: () => { recompensa(rec); } }]);
    }
    if (j.mis) return dialogo(nome, cor, [`${j.mis.nome}: ${j.mis.obj.txt}${j.mis.obj.qtd ? ` (${j.mis.prog}/${j.mis.obj.qtd})` : ''}.`, `Dica: ${j.mis.dica}. Siga a ⭐ no mapa.`], [{ txt: 'Estou indo!' }]);
    const m = missaoDisponivel();
    const intro = abertura ? ['Bem-vindo à Vila Carvalho, forasteiro.', 'Sou Tomé, o ancião. Tempos sombrios chegaram ao reino...'] : [];
    return dialogo(nome, cor, [...intro, ...m.falaInicio], [{ txt: `✅ Aceitar: ${m.nome}`, acao: () => { aceitarMissao(); faixa('Nova missão', m.nome); } }, { txt: 'Agora não' }]);
  }
  if (id === 'mercadora') {
    const cor = '#7fd88a';
    const loja = () => dialogo(npc.nome, cor, [`Tenho de tudo um pouco! Você tem ${j.ouro} 🪙.`], [
      { txt: `🧪 Poção de vida — ${POCAO.preco} 🪙`, desab: j.ouro < POCAO.preco, acao: () => { j.ouro -= POCAO.preco; j.pocoes++; salvar(); loja(); } },
      { txt: `💧 Éter de mana — ${ETER.preco} 🪙`, desab: j.ouro < ETER.preco, acao: () => { j.ouro -= ETER.preco; j.eteres++; salvar(); loja(); } },
      { txt: `🎁 Equipamento surpresa — ${60 * j.nivel} 🪙`, desab: j.ouro < 60 * j.nivel, acao: () => { j.ouro -= 60 * j.nivel; const it = novoItem(['arma', 'armadura', 'amuleto'][Math.floor(Math.random() * 3)], j.nivel, Math.random() < 0.25 ? 2 : 1, j.cls); j.inv.push(it); salvar(); toast(`🎁 ${it.nome} (${RARIDADES[it.rar].n})`); loja(); } },
      { txt: '💰 Vender itens', acao: () => abrirMenu('mochila', true) },
      { txt: 'Tchau' },
    ]);
    return loja();
  }
  if (id === 'ferreiro') {
    const cor = '#ff9a5a';
    const forja = () => {
      const ops = [];
      for (const slot of ['arma', 'armadura']) {
        const it = j.equip[slot]; if (!it) continue;
        const up = it.up || 0, custo = Math.round(35 * (up + 1) * (1 + it.nivel * 0.5));
        ops.push({ txt: `🔨 ${it.nome} +${up} → +${up + 1} — ${custo} 🪙`, desab: j.ouro < custo || up >= 10, acao: () => { j.ouro -= custo; it.up = up + 1; salvar(); C.faiscas(j.x, 1.2, j.z, 0xffa040, 20, 3); toast(`${it.nome} agora é +${it.up}!`); forja(); } });
      }
      ops.push({ txt: 'Tchau' });
      dialogo(npc.nome, cor, ['Minha forja deixa qualquer arma afiada! Cada reforço dá +15% ao item.'], ops);
    };
    return forja();
  }
}
function recompensa(r) {
  if (!r) return;
  const itens = [`+${r.xp} XP`, `+${r.ouro} 🪙`]; if (r.pocoes) itens.push(`+${r.pocoes} 🧪`); if (r.item) itens.push(`<span style="color:${RARIDADES[r.item.rar].cor}">${r.item.nome}</span>`);
  dialogo('Recompensa', '#ffd84a', [itens.join(' · ')], [{ txt: 'Equipar agora', acao: () => r.item && abrirMenu('mochila') }, { txt: 'Ótimo!', acao: () => G.jog.hist >= MISSOES.length && G.jog.cacadas === 0 && G.jog.mis === null && dialogoNPC('anciao') }]);
}
function morte(perda) {
  const m = $('#morte'); m.hidden = false; ui.pausado = false;
  m.innerHTML = `<div class="mBox"><h2>Você caiu...</h2><p>Os esqueletos venceram desta vez.${perda ? ` Você perdeu ${perda} 🪙.` : ''}</p></div>`;
  m.querySelector('.mBox').append(botao('🏠 Voltar à vila', () => { m.hidden = true; renascer(); }));
}

// ---------------- menu (herói, mochila, missão, ajustes) ----------------
let abaMenu = 'heroi', modoVenda = false;
export function abrirMenu(aba, venda = false) {
  abaMenu = aba; modoVenda = venda; ui.pausado = true; entrada.atacar = false;
  $('#menu').hidden = false; desenharMenu();
}
function fecharMenu() { $('#menu').hidden = true; ui.pausado = false; modoVenda = false; }
function itemHTML(it, extra = '') {
  const r = RARIDADES[it.rar], up = it.up ? ` +${it.up}` : '', k = 1 + 0.15 * (it.up || 0);
  const st = [it.atk ? `⚔️ ${Math.round(it.atk * k)}` : '', it.def ? `🛡️ ${Math.round(it.def * k)}` : '', it.vida ? `❤️ ${Math.round(it.vida * k)}` : ''].filter(Boolean).join(' ');
  const ic = { arma: CLASSES[G.jog.cls].icone === '🏹' ? '🏹' : G.jog.cls === 'mag' ? '🪄' : G.jog.cls === 'bar' ? '🪓' : '🗡️', armadura: '🥋', amuleto: '📿' }[it.slot];
  return `<div class="item" style="--r:${r.cor}"><i>${ic}</i><div><b>${it.nome}${up}</b><span>Nv ${it.nivel} · ${r.n}</span><span>${st}</span></div>${extra}</div>`;
}
function desenharMenu() {
  const j = G.jog, s = stats(), cls = CLASSES[j.cls], m = $('#menu');
  const abas = [['heroi', '🧙 Herói'], ['mochila', '🎒 Mochila'], ['missao', '📜 Missão'], ['ajustes', '⚙️ Ajustes']];
  let corpo = '';
  if (abaMenu === 'heroi') {
    corpo = `<div class="ficha"><div class="fRet" style="--c:${cls.cor}">${cls.icone}</div><div><h3>${cls.nome} — Nível ${j.nivel}</h3>
      <p>XP ${Math.floor(j.xp)}/${xpProx(j.nivel)} · 🪙 ${j.ouro} · 💀 ${j.abates} abates</p></div></div>
      <div class="stats"><span>❤️ Vida <b>${Math.round(s.vida)}</b></span><span>💧 Mana <b>${Math.round(s.mana)}</b></span><span>⚔️ Ataque <b>${Math.round(s.atk)}</b></span><span>🛡️ Defesa <b>${Math.round(s.def)}</b></span></div>
      <h4>Equipado</h4>${['arma', 'armadura', 'amuleto'].map(sl => j.equip[sl] ? itemHTML(j.equip[sl]) : `<div class="item vazio">${sl} — vazio</div>`).join('')}
      <h4>Habilidades</h4>${cls.hab.map(hb => `<div class="habL ${habLiberada(hb) ? '' : 'bloq'}"><i>${hb.icone}</i><div><b>${hb.nome}</b><span>${habLiberada(hb) ? hb.desc : `Libera no nível ${hb.nivel}`} · ${hb.mana} mana · ${hb.cd}s</span></div></div>`).join('')}`;
  }
  if (abaMenu === 'mochila') {
    corpo = modoVenda ? '<p class="dica">Toque em VENDER para vender um item.</p>' : '<p class="dica">Toque em EQUIPAR para usar. Itens melhores ficam com a borda colorida.</p>';
    corpo += `<p>🧪 ${j.pocoes} poções · 💧 ${j.eteres} éteres · 🪙 ${j.ouro}</p>`;
    if (!j.inv.length) corpo += '<p class="dica">Mochila vazia. Derrote inimigos para achar itens!</p>';
    corpo += j.inv.map(it => {
      const eq = j.equip[it.slot], melhor = eq ? pontos(it) > pontos(eq) : true;
      const bt = modoVenda ? `<button class="btn sm" data-vender="${it.id}">Vender ${precoItem(it)} 🪙</button>` : `<button class="btn sm ${melhor ? 'ok' : ''}" data-eq="${it.id}">${melhor ? '⬆️ ' : ''}Equipar</button>`;
      return itemHTML(it, bt);
    }).join('');
  }
  if (abaMenu === 'missao') {
    const mm = j.mis;
    corpo = mm ? `<div class="mCard"><h3>${mm.nome}</h3><p>${mm.obj.txt}${mm.obj.qtd ? ` — ${mm.prog}/${mm.obj.qtd}` : ''}</p><p class="dica">${mm.estado === 'completa' ? '✅ Concluída! Volte ao Ancião na vila.' : '📍 ' + mm.dica}</p></div>`
      : `<div class="mCard"><h3>Sem missão ativa</h3><p class="dica">Fale com o Ancião Tomé na praça da vila (❗ no mapa).</p></div>`;
    corpo += `<h4>História</h4>` + MISSOES.map((ms, i) => `<div class="habL ${i < j.hist ? '' : 'bloq'}"><i>${i < j.hist ? '✅' : i === j.hist ? '▶️' : '🔒'}</i><div><b>${ms.nome}</b><span>${i <= j.hist ? ms.dica : '???'}</span></div></div>`).join('');
    if (j.cacadas) corpo += `<p>🏹 Caçadas completas: ${j.cacadas}</p>`;
  }
  if (abaMenu === 'ajustes') {
    corpo = `<h4>Gráficos</h4><div class="linha">${['baixa', 'media', 'alta'].map(q => `<button class="btn sm ${ui.qualidade === q ? 'ok' : ''}" data-q="${q}">${{ baixa: 'Leve', media: 'Normal', alta: 'Bonito' }[q]}</button>`).join('')}</div>
      <p class="dica">Muda na próxima vez que abrir o jogo. "Leve" desliga sombras (mais rápido).</p>
      <h4>Controles</h4><p class="dica">Arraste do lado esquerdo para andar. Arraste do lado direito para girar a câmera. ⚔️ ataca (segure para atacar sem parar), 💨 esquiva (fica invulnerável).</p>
      <h4>Jogo</h4><button class="btn perigo" data-novo="1">Começar um novo jogo</button>`;
  }
  m.innerHTML = `<div class="mTopo">${abas.map(([k, t]) => `<button class="aba ${k === abaMenu ? 'on' : ''}" data-aba="${k}">${t}</button>`).join('')}<button class="x" data-fechar="1">✕</button></div><div class="mCorpo">${corpo}</div>`;
  m.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.aba) { abaMenu = b.dataset.aba; desenharMenu(); }
    if (b.dataset.fechar) fecharMenu();
    if (b.dataset.eq) { equipar(b.dataset.eq); desenharMenu(); }
    if (b.dataset.vender) { const it = j.inv.find(x => x.id === b.dataset.vender); vender(it.id, precoItem(it)); desenharMenu(); }
    if (b.dataset.q) { ui.qualidade = b.dataset.q; try { localStorage.setItem('coroa_rpg_q', ui.qualidade); } catch (e) {} desenharMenu(); }
    if (b.dataset.novo) { if (confirm('Apagar o progresso e começar do zero?')) { apagarSave(); location.reload(); } }
  };
}
const pontos = it => (it.atk || 0) * 3 + (it.def || 0) * 3 + (it.vida || 0) * 0.5;

// ---------------- minimapa ----------------
const ALVOS = { m1: { x: 5, z: -55 }, m2: { x: -32, z: -86 }, m3: { x: 78, z: 0 }, m4: { x: 0, z: 84 } };
const ZC = { floresta: { x: 0, z: -60 }, ruinas: { x: 72, z: 0 }, castelo: { x: 0, z: 76 } };
function alvoMissao() {
  const j = G.jog, m = j.mis, anc = G.npcs.find(n => n.id === 'anciao');
  if (!m || m.estado === 'completa') return anc;
  return ALVOS[m.id] || ZC[m.obj.zona] || anc;
}
function desenharMapaBase() {
  const N = 440, cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d'), k = N / (LIM * 2), W = v => (v + LIM) * k;
  c.fillStyle = '#4f7a34'; c.fillRect(0, 0, N, N);
  for (let x = -LIM; x < LIM; x += 4) for (let z = -LIM; z < LIM; z += 4) {
    const zn = zonaDe(x, z); c.fillStyle = zn === 'floresta' ? '#2c4f25' : zn === 'ruinas' ? '#8a7c55' : zn === 'vila' ? '#7a8f5a' : zn === 'castelo' ? '#555' : '#4f7a34'; c.fillRect(W(x), W(z), 4 * k + 1, 4 * k + 1);
  }
  c.strokeStyle = '#c9b07a'; c.lineCap = 'round'; for (const cm of G.M.caminhos) { c.lineWidth = cm.w * k; c.beginPath(); cm.pts.forEach(([x, z], i) => i ? c.lineTo(W(x), W(z)) : c.moveTo(W(x), W(z))); c.stroke(); }
  c.fillStyle = '#b3a996'; c.beginPath(); c.arc(W(0), W(0), 11 * k, 0, 7); c.fill();
  c.fillStyle = '#8b6a4a'; for (const cs of G.M.casas) c.fillRect(W(cs.x - cs.ax), W(cs.z - cs.az), cs.ax * 2 * k, cs.az * 2 * k);
  c.strokeStyle = '#ddd'; c.lineWidth = 2.5; c.strokeRect(W(CASTELO.x0), W(CASTELO.z0), (CASTELO.x1 - CASTELO.x0) * k, (CASTELO.z1 - CASTELO.z0) * k);
  c.fillStyle = 'rgba(20,40,15,.55)'; for (const t of G.M.circ) if (t.r < 0.8) c.fillRect(W(t.x) - 1, W(t.z) - 1, 2, 2);
  return { cv, k };
}
function desenharMini() {
  const S = mini.width, R = S / 2, j = G.jog, esc = 1.6; // px do minimapa por metro
  mg.save(); mg.clearRect(0, 0, S, S); mg.beginPath(); mg.arc(R, R, R - 2, 0, 7); mg.clip();
  mg.translate(R, R); mg.rotate(C.camera.yaw + Math.PI); // "para cima" = para onde a câmera olha
  const k = mapaBase.k; mg.scale(esc / k, esc / k); mg.translate(-(j.x + LIM) * k, -(j.z + LIM) * k);
  mg.drawImage(mapaBase.cv, 0, 0);
  mg.setTransform(1, 0, 0, 1, 0, 0);
  const P = (x, z) => { const dx = (x - j.x) * esc, dz = (z - j.z) * esc, a = C.camera.yaw + Math.PI, c = Math.cos(a), s = Math.sin(a); return [R + dx * c - dz * s, R + dx * s + dz * c]; };
  for (const e of G.inim) if (e.estado !== 'morto' && Math.hypot(e.x - j.x, e.z - j.z) < 70) { const [x, y] = P(e.x, e.z); mg.fillStyle = e.d.chefe ? '#ff2a2a' : '#ff6a5a'; mg.beginPath(); mg.arc(x, y, e.d.chefe || e.d.elite ? 5 : 3, 0, 7); mg.fill(); }
  for (const n of G.npcs) { const [x, y] = P(n.x, n.z); mg.fillStyle = '#ffd84a'; mg.beginPath(); mg.arc(x, y, 3.5, 0, 7); mg.fill(); }
  // alvo da missão (preso na borda se estiver longe)
  const a = alvoMissao(); if (a) { let [x, y] = P(a.x, a.z); const dx = x - R, dy = y - R, d = Math.hypot(dx, dy); if (d > R - 12) { x = R + dx / d * (R - 12); y = R + dy / d * (R - 12); } mg.font = '18px sans-serif'; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText('⭐', x, y); }
  mg.restore();
  // seta do herói
  mg.save(); mg.translate(R, R); mg.rotate(C.camera.yaw - j.ang); mg.fillStyle = '#fff'; mg.strokeStyle = '#000'; mg.lineWidth = 1.5;
  mg.beginPath(); mg.moveTo(0, -8); mg.lineTo(6, 6); mg.lineTo(0, 3); mg.lineTo(-6, 6); mg.closePath(); mg.fill(); mg.stroke(); mg.restore();
  mg.strokeStyle = 'rgba(255,230,170,.9)'; mg.lineWidth = 3; mg.beginPath(); mg.arc(R, R, R - 2, 0, 7); mg.stroke();
  mg.fillStyle = '#fff'; mg.font = 'bold 14px sans-serif'; mg.textAlign = 'center'; const nx = R - Math.sin(C.camera.yaw) * (R - 12), ny = R + Math.cos(C.camera.yaw) * (R - 12); mg.fillText('N', nx, ny + 5);
}

// ---------------- sobreposição 2D (barras, nomes, números) ----------------
function desenharOverlay() {
  g.clearRect(0, 0, innerWidth, innerHeight);
  const j = G.jog;
  if (joy) { g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 3; g.beginPath(); g.arc(joy.sx, joy.sy, 55, 0, 7); g.stroke(); const dx = joy.x - joy.sx, dy = joy.y - joy.sy, m = Math.hypot(dx, dy), f = Math.min(1, 55 / (m || 1)); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(joy.sx + dx * f, joy.sy + dy * f, 24, 0, 7); g.fill(); }
  for (const e of G.inim) {
    if (e.estado === 'morto' || e.d.chefe) continue;
    const d = Math.hypot(e.x - j.x, e.z - j.z); if (d > 26 || !(e.aggro || e.hp < e.max || d < 10)) continue;
    const p = C.tela(e.x, 2.35 * (e.d.esc || 1), e.z); if (!p) continue;
    const w = e.d.elite ? 70 : 46, [x, y] = p;
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - w / 2 - 1, y - 1, w + 2, 7);
    g.fillStyle = e.d.elite ? '#ff9a2a' : '#e2412f'; g.fillRect(x - w / 2, y, w * Math.max(0, e.hp / e.max), 5);
    g.font = '700 11px system-ui'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)';
    const nome = e.d.elite ? `${e.d.nome} · Nv ${e.nivel}` : `Nv ${e.nivel}`; g.strokeText(nome, x, y - 4); g.fillStyle = e.nivel > j.nivel + 2 ? '#ff8a7a' : '#fff'; g.fillText(nome, x, y - 4);
  }
  // NPCs: nome e ❗/❓
  for (const n of G.npcs) {
    const d = Math.hypot(n.x - j.x, n.z - j.z); if (d > 22) continue;
    const p = C.tela(n.x, 2.3, n.z); if (!p) continue; const [x, y] = p;
    g.font = '700 12px system-ui'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(n.nome, x, y); g.fillStyle = '#ffe9a8'; g.fillText(n.nome, x, y);
    if (n.id === 'anciao') { const m = j.mis, s = !m ? '❗' : m.estado === 'completa' ? '❓' : ''; if (s) { g.font = `${26 + Math.sin(G.t * 4) * 3}px system-ui`; g.fillText(s, x, y - 18); } }
  }
  for (const b of G.M.baus) if (j.mis && j.mis.obj.id === b.id && !j.baus[b.id]) { const p = C.tela(b.x, 2.4, b.z); if (p) { g.font = '26px system-ui'; g.textAlign = 'center'; g.fillText('❗', p[0], p[1] + Math.sin(G.t * 4) * 4); } }
  // números flutuantes
  for (const t of G.txt) {
    const p = C.tela(t.x, t.y + t.t * 1.3, t.z); if (!p) continue;
    g.globalAlpha = Math.max(0, 1 - t.t / 1.1); g.font = `800 ${t.grande ? 24 : 17}px system-ui`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.75)';
    g.strokeText(t.s, p[0], p[1]); g.fillStyle = t.cor; g.fillText(t.s, p[0], p[1]); g.globalAlpha = 1;
  }
}

// ---------------- atualização por quadro ----------------
export function atualizar(dt) {
  if (!G.jog) return;
  if (!ui.pausado) lerMovimento(dt); else { entrada.mx = entrada.mz = 0; }
  processarEventos();
  const j = G.jog, s = stats(), cls = CLASSES[j.cls];
  $('#nv').textContent = j.nivel;
  const barra = (sel, v, max, txt) => { const b = $(sel); b.querySelector('i').style.width = Math.max(0, Math.min(100, v / max * 100)) + '%'; const sp = b.querySelector('span'); if (sp) sp.textContent = txt; };
  barra('.barra.vida', j.hp, s.vida, `${Math.ceil(j.hp)}/${Math.round(s.vida)}`);
  barra('.barra.mana', j.mp, s.mana, `${Math.floor(j.mp)}/${Math.round(s.mana)}`);
  barra('.barra.xp', j.xp, xpProx(j.nivel));
  $('#ouro').textContent = `🪙 ${j.ouro}`;
  const m = j.mis, qm = $('#missao');
  const htmlM = m ? `<b>${m.nome}</b><span>${m.estado === 'completa' ? '✅ Volte ao Ancião' : m.obj.txt + (m.obj.qtd ? ` ${m.prog}/${m.obj.qtd}` : '')}</span>` : `<b>❗ Fale com o Ancião</b><span>na praça da vila</span>`;
  if (qm.innerHTML !== htmlM) qm.innerHTML = htmlM;
  cls.hab.forEach((hb, i) => {
    const b = document.querySelector(`.hab[data-i="${i}"]`), cd = j.cds[hb.id] || 0, lib = habLiberada(hb);
    b.classList.toggle('bloq', !lib); b.classList.toggle('semMana', lib && j.mp < hb.mana);
    b.style.setProperty('--p', cd > 0 ? (cd / hb.cd * 360) + 'deg' : '0deg');
    b.querySelector('em').textContent = !lib ? '🔒' : cd > 0 ? Math.ceil(cd) : '';
  });
  $('#bEsq').style.setProperty('--p', (j.cds.esq || 0) > 0 ? ((j.cds.esq / 0.9) * 360) + 'deg' : '0deg');
  $('#bPoc small').textContent = j.pocoes; $('#bEter small').textContent = j.eteres;
  const it = interativoPerto(), bf = $('#bFalar');
  bf.hidden = !it; if (it) bf.querySelector('span').textContent = it.txt;
  // barra do chefe
  const cb = $('#chefeBar');
  if (chefeAtivo && chefeAtivo.estado !== 'morto' && chefeAtivo.aggro) { cb.hidden = false; cb.querySelector('span').textContent = `👑 ${chefeAtivo.d.nome} · Nv ${chefeAtivo.nivel}`; cb.querySelector('i').style.width = Math.max(0, chefeAtivo.hp / chefeAtivo.max * 100) + '%'; }
  else cb.hidden = true;
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('#toast').classList.remove('on'); }
  desenharMini(); desenharOverlay();
}
