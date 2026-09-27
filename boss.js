'use strict';
/* =====================================================================
   Modo Chefão — você é o BOSS (o Rei Esqueleto) e luta contra os heróis.
   Os heróis são IAs que percebem os avisos, desviam, rolam, se curam e
   atacam juntos. O chefão já nasce forte; quem evolui são os heróis.
   Personagens: sprites animados de chars.png (Kenney Mini Dungeon /
   Mini Characters, CC0; gerados por tools/sprites/personagens.js).
   ===================================================================== */
const Boss = (() => {
  const KEY = 'coroa_boss_v1';
  const AW = 100, AH = 150;                       // arena em unidades
  const HEROIS = [
    { id: 'cav', n: 'Cavaleiro', cor: '#3f6fb0', alcance: 8, arma: 'espada', escudo: true, fala: ['Pelo reino!', 'Sua hora chegou, esqueleto!', 'Não tenho medo de você!'] },
    { id: 'lan', n: 'Arqueira', fem: true, cor: '#3f8f4a', alcance: 38, arma: 'lanca', fala: ['Nunca erro um alvo!', 'Fica paradinho aí...', 'Muito lento!'] },
    { id: 'mag', n: 'Maga', fem: true, cor: '#7a4fb0', alcance: 34, arma: 'magia', cura: true, fala: ['Luz, nos proteja!', 'Sua magia é fraca!', 'Eu estudei você!'] },
    { id: 'pal', n: 'Bárbaro', cor: '#c9582a', alcance: 8, arma: 'machado', forte: 1.35, fala: ['RAAAAH!', 'Vou quebrar esses ossos!', 'Mais forte que você!'] },
  ];
  const HAB = [
    { id: 'pisao', n: 'Pisão', i: '💥', cd: 4 },
    { id: 'fogo', n: 'Fogo', i: '🔥', cd: 2 },
    { id: 'capangas', n: 'Capangas', i: '👹', cd: 10 },
    { id: 'meteoro', n: 'Meteoros', i: '☄️', cd: 8 },
    { id: 'ira', n: 'Ira do Rei', i: '👑', cd: 0 },
  ];
  // o chefão já nasce poderoso; quem evolui são os heróis
  const BOSS_VIDA = 1500, BOSS_DANO = 3, BOSS_CD = 0.7;
  // o que os heróis aprendem ao subir de nível
  const ESP_LV = 4; // nível em que os heróis aprendem golpes especiais
  const ESPECIAIS = {
    cav: { n: 'Escudo do Reino', d: 'avança com o escudo e te ATORDOA', cd: 9, grito: 'Escudo do Reino!' },
    lan: { n: 'Chuva de Flechas', d: 'marca um círculo azul em você — saia dele!', cd: 8, grito: 'Chuva de flechas!' },
    mag: { n: 'Raio de Gelo', d: 'te deixa LENTO por 3s', cd: 9, grito: 'Congela!' },
    pal: { n: 'Fúria Bárbara', d: 'ataca muito mais rápido e forte por 5s', cd: 12, grito: 'FÚRIAAAA!' },
  };
  const NOVIDADES = { 2: 'Os heróis treinaram: mais vida e dano', 4: 'Aprenderam GOLPES ESPECIAIS: atordoar, chuva de flechas, gelo e fúria!', 3: 'Agora vêm em DUPLA e aprendem a rolar para desviar', 5: 'Reagem mais rápido aos seus avisos', 7: 'Agora vêm em TRIO', 9: 'Rolam com mais frequência', 12: 'Agora vêm em QUARTETO', 15: 'Lendas do reino: reflexo máximo' };
  const XINGA = ['Mais um herói pro meu museu!', 'Achou que ia ser fácil?', 'HAHAHAHA!', 'Vem, vem...', 'Meu castelo, minhas regras!', 'Esmagar!'];

  let P = { nivel: 1, vitorias: 0, derrotas: 0, recorde: 0 };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.nivel) P = Object.assign(P, s); } catch (e) {}
  const salvar = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };
  const tamGrupo = lv => lv >= 12 ? 4 : lv >= 7 ? 3 : lv >= 3 ? 2 : 1;
  const grupoDe = lv => Array.from({ length: tamGrupo(lv) }, (_, k) => HEROIS[(lv - 1 + k) % HEROIS.length]);

  // sprites animados
  const CH = { img: new Image(), m: null };
  CH.img.src = 'chars.png';
  fetch('chars.json').then(r => r.json()).then(m => { CH.m = m; }).catch(() => {});
  const ANIM = { idle: [2, 3, true], walk: [4, 9, true], atk: [4, 11, false], die: [4, 7, false] }; // quadros, fps, repete

  let el, cv, g, W, H, DPR, sc, ox, oy, raf = 0, R = null, last = 0, shake = 0, freeze = 0, joy = null;
  const $b = s => el.querySelector(s);

  /* ---------------- montagem da tela ---------------- */
  function montar() {
    el = document.createElement('div'); el.id = 'boss'; el.hidden = true;
    el.innerHTML = `<canvas id="bcv"></canvas>
      <div class="bTop"><div class="bBar boss"><span>👑 Você — Rei Esqueleto</span><i></i><b></b></div><div class="bParty"></div></div>
      <button class="bX" data-b="sair" aria-label="Sair">✕</button>
      <div class="bHab"></div>
      <div class="bPapo"></div>
      <div class="bCena" data-b="cena" hidden><div class="bCine top"></div><div class="bCine bot"></div>
        <div class="bFalaBox"><b></b><p></p><small>toque ▸</small></div><button class="bPular" data-b="pular">Pular ⏭</button></div>
      <div class="bLobby"></div>`;
    document.body.appendChild(el);
    cv = $b('#bcv'); g = cv.getContext('2d');
    if (window.M3D) M3D.iniciar(el); // cena 3D por trás do canvas 2D
    $b('.bHab').innerHTML = HAB.map((h, i) => `<button class="hb${h.id === 'ira' ? ' ira' : ''}" data-b="hab" data-i="${i}"><b>${h.i}</b><span>${h.n}</span><em></em></button>`).join('');
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-b]'); if (!a) return;
      const k = a.dataset.b;
      if (k === 'sair') fechar();
      if (k === 'hab') usar(+a.dataset.i);
      if (k === 'lutar') lutar();
      if (k === 'lobby') lobby();
      if (k === 'pular') fimCena();
      if (k === 'cena') proxFala();
      if (k === 'modo') { P.modo3d = !(P.modo3d !== false); salvar(); lobby(); }
    });
    // joystick: arrastar move na hora; toque rápido manda andar até o ponto
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); joy = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, arr: false }; });
    cv.addEventListener('pointermove', e => { if (!joy) return; joy.x = e.clientX; joy.y = e.clientY; if (Math.hypot(joy.x - joy.sx, joy.y - joy.sy) > 12) joy.arr = true; });
    const solta = e => {
      if (joy && !joy.arr && R && !R.fim) { const [x, y] = (usa3d() && M3D.tap(e.clientX, e.clientY)) || s2a(e.clientX, e.clientY); R.boss.alvo = [clamp(x, 10, AW - 10), clamp(y, 12, AH - 12)]; }
      joy = null;
    };
    cv.addEventListener('pointerup', solta); cv.addEventListener('pointercancel', () => { joy = null; });
    addEventListener('resize', () => { if (!el.hidden) medir(); });
  }
  function medir() {
    DPR = Math.min(3, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    const topo = 84, base = 116;
    sc = Math.min(W / AW, (H - topo - base) / AH);
    ox = (W - AW * sc) / 2; oy = topo + (H - topo - base - AH * sc) / 2;
  }
  const a2s = (x, y) => [ox + x * sc, oy + y * sc];
  const usa3d = () => P.modo3d !== false && window.M3D && M3D.pronto && !M3D.falhou;
  const s2a = (x, y) => [(x - ox) / sc, (y - oy) / sc];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function abrir() {
    if (!el) montar();
    el.hidden = false; window.bossAberto = true; medir(); lobby();
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function fechar() { el.hidden = true; window.bossAberto = false; cancelAnimationFrame(raf); R = null; }

  /* ---------------- covil (entre lutas) ---------------- */
  function lobby() {
    R = null;
    const grp = grupoDe(P.nivel);
    $b('.bHab').hidden = true; $b('.bTop').hidden = true; $b('.bCena').hidden = true;
    const L = $b('.bLobby'); L.hidden = false;
    L.innerHTML = `<h2>☠️ Covil do Rei Esqueleto</h2>
      <p class="mut">Você é o chefão: ❤️ ${BOSS_VIDA} de vida e golpes devastadores. Os heróis voltam a cada derrota <b>mais fortes</b> — até onde você aguenta?</p>
      <div class="bCard"><div style="flex:1"><div class="mut">Heróis — nível ${P.nivel}</div>
        ${grp.map(h => `<div><b style="color:${h.cor}">${h.n}</b> <span class="mut">❤️ ${Math.round(vidaHeroi(P.nivel, grp.length))} · ⚔️ ${Math.round(danoHeroi(P.nivel) * (h.forte || 1))}</span></div>`).join('')}
        <div class="mut">reflexo ${Math.round((1 - reacao(P.nivel) / 0.5) * 100)}%</div>
        ${P.nivel >= ESP_LV ? grp.map(h => `<div class="mut">⭐ <b>${ESPECIAIS[h.id].n}</b>: ${ESPECIAIS[h.id].d}</div>`).join('') : `<div class="mut">⭐ Golpes especiais a partir do nível ${ESP_LV}</div>`}</div></div>
      <div class="bAlmas">🏆 ${P.vitorias} vitórias · recorde: nível ${P.recorde || 0}</div>
      <p class="mut">Arraste o dedo na arena para andar (ou toque num ponto). Os círculos vermelhos avisam os heróis — os bons desviam! Causar dano enche a <b>Ira do Rei</b>.</p>
      <div class="row" style="justify-content:center"><button class="btn sec sm" data-b="modo">🎥 Visão: ${P.modo3d !== false ? '3D' : '2D'}${window.M3D && M3D.falhou ? ' (3D indisponível)' : ''}</button></div>
      <button class="btn bGo" data-b="lutar">⚔️ Lutar!</button>`;
  }

  /* ---------------- luta ---------------- */
  const vidaHeroi = (lv, n) => 90 * 1.25 ** (lv - 1) * (n > 1 ? 0.8 : 1);
  const danoHeroi = lv => 7 * 1.18 ** (lv - 1);
  const reacao = lv => Math.max(0.08, 0.45 - 0.026 * (lv - 1)); // segundos para perceber o perigo
  function lutar() {
    const lv = P.nivel, bv = BOSS_VIDA, grp = grupoDe(lv);
    R = {
      t: 0, fim: null, lv, ira: 0, furia: false,
      boss: { x: AW / 2, y: 40, r: 10, hp: bv, max: bv, atordoado: 0, lento: 0, alvo: null, flash: 0, carga: 0, fala: null, anim: 'idle', at: 0, fx: 0, fy: 1, atkT: 0 },
      herois: grp.map((cls, k) => ({
        x: AW / 2 + (k - (grp.length - 1) / 2) * 14, y: AH - 16, r: 4, hp: vidaHeroi(lv, grp.length), max: vidaHeroi(lv, grp.length), cls,
        spd: 25 + lv * 1.2, dano: danoHeroi(lv), atk: 0.5 + k * 0.3, dash: 0, dashT: 0, cura: 5, orb: k * 2.1, flash: 0, fala: null,
        vx: 0, vy: 0, fx: 0, fy: -1, anim: 'idle', at: 0, atkT: 0, morto: false, mt: 0, esp: 4 + k * 2.5, furiaT: 0, carrega: 0, investida: 0,
      })),
      cap: [], proj: [], zonas: [], ondas: [], part: [], txt: [], cd: HAB.map(() => 0),
    };
    R.ditos = new Set(); R.papo = [];
    $b('.bLobby').hidden = true;
    cenaInicio();
    $b('.bParty').innerHTML = R.herois.map((h, i) => `<div class="bBar heroi" data-h="${i}" style="--c:${h.cls.cor}"><span>${h.cls.n}</span><i></i><b></b></div>`).join('');
  }
  const vivos = () => R.herois.filter(h => !h.morto);
  const mulDano = () => BOSS_DANO * (R && R.furia ? 1.3 : 1);
  const mulCd = () => BOSS_CD * (R && R.furia ? 0.6 : 1);
  function falar(q, txt, t = 2) { q.fala = { txt, t }; }
  function maisPerto(x, y) { let best = null, bd = 1e9; for (const h of vivos()) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } } return best; }
  function olhar(q, x, y) { const dx = x - q.x, dy = y - q.y, m = Math.hypot(dx, dy) || 1; q.fx = dx / m; q.fy = dy / m; }
  function anima(q, a) { if (q.anim !== a) { q.anim = a; q.at = 0; } }

  function usar(i) {
    if (!R || R.fim || R.cena || R.cd[i] > 0) return;
    if (R.boss.atordoado > 0) { R.txt.push({ x: R.boss.x, y: R.boss.y - 16, s: 'atordoado!', cor: '#ffd76a', t: 0 }); return; }
    const b = R.boss, id = HAB[i].id, h = maisPerto(b.x, b.y);
    if (id === 'ira') { if (R.ira < 100) return; R.ira = 0; }
    else R.cd[i] = HAB[i].cd * mulCd();
    if (!h) return;
    if (!b.andando) olhar(b, h.x, h.y); b.esp = id; anima(b, 'atk'); b.at = 0; b.atkT = id === 'fogo' ? 0.7 : 0.95;
    if (Math.random() < 0.3) falar(b, XINGA[Math.floor(Math.random() * XINGA.length)], 1.6);
    if (id === 'pisao') { b.carga = 0.55; R.zonas.push({ x: b.x, y: b.y, r: 22, t: 0, delay: 0.55, dano: 24, tipo: 'pisao', segue: true }); }
    if (id === 'fogo') {
      const d = Math.hypot(h.x - b.x, h.y - b.y), tv = d / 55;
      const px = h.x + h.vx * tv * 0.8, py = h.y + h.vy * tv * 0.8, a = Math.atan2(py - b.y, px - b.x);
      const n = R.furia ? 5 : 3;
      for (let k = 0; k < n; k++) { const off = (k - (n - 1) / 2) * 0.2; R.proj.push({ x: b.x, y: b.y - 4, vx: Math.cos(a + off) * 55, vy: Math.sin(a + off) * 55, r: 2.6, dano: 11, dono: 'boss', ttl: 3, nasce: R.t }); }
    }
    if (id === 'capangas') for (let k = 0; k < 3; k++) {
      const a = Math.random() * 6.28;
      R.cap.push({ x: b.x + Math.cos(a) * 14, y: b.y + Math.sin(a) * 10 + 6, r: 2.6, hp: 14 + R.lv * 2, max: 14 + R.lv * 2, atk: 0, flash: 0, anim: 'walk', at: Math.random(), fx: 0, fy: 1, atkT: 0 });
      poeira(b.x + Math.cos(a) * 14, b.y + Math.sin(a) * 10 + 6, '#7ad46a', 10);
    }
    if (id === 'meteoro') for (let k = 0; k < (R.furia ? 7 : 5); k++) {
      const alvo = vivos()[k % vivos().length], a = Math.random() * 6.28, dd = k < vivos().length ? 0 : 6 + Math.random() * 12;
      R.zonas.push({ x: clamp(alvo.x + Math.cos(a) * dd, 4, AW - 4), y: clamp(alvo.y + Math.sin(a) * dd, 4, AH - 4), r: 8, t: 0, delay: 0.9 + k * 0.15, dano: 16, tipo: 'meteoro' });
    }
    if (id === 'ira') {
      falar(b, 'SINTAM A IRA DO REI!', 2.2); shake = 0.6;
      for (let k = 0; k < 3; k++) R.ondas.push({ x: b.x, y: b.y, t: -k * 0.45, v: 55, dano: 20, acertou: new Set() });
      for (let k = 0; k < 8; k++) R.zonas.push({ x: 8 + Math.random() * (AW - 16), y: 8 + Math.random() * (AH - 16), r: 9, t: 0, delay: 1.2 + k * 0.12, dano: 18, tipo: 'meteoro' });
    }
  }
  function dano(q, v, cor) {
    if (q.morto) return;
    if (R.herois.includes(q)) {
      if (q.dashT > 0) { R.txt.push({ x: q.x, y: q.y - 8, s: 'desviou!', cor: '#9fe3ff', t: 0 }); return; }
      if (q.cls.escudo && Math.random() < 0.25) { v *= 0.4; R.txt.push({ x: q.x, y: q.y - 11, s: 'bloqueou', cor: '#ffd76a', t: 0 }); }
      R.ira = Math.min(100, R.ira + v * 0.7);
      if (v >= 15) freeze = 0.06;
    }
    q.hp -= v; q.flash = 0.15;
    R.txt.push({ x: q.x + (Math.random() - 0.5) * 4, y: q.y - 8, s: Math.round(v), cor: cor || '#fff', t: 0, grande: v >= 15 });
  }
  function poeira(x, y, cor, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 10 + Math.random() * 30; R.part.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 0.4 + Math.random() * 0.4, cor }); } }

  /* ---------------- diálogos ---------------- */
  const COR_REI = '#ff6a4a';
  const sorteia = a => a[Math.floor(Math.random() * a.length)];
  const FALA_CLS = {
    cav: [['Meu escudo aguentou seu último pisão. Aguenta o próximo!', 'Vou transformar esse escudo em prato de sopa.'], ['Juro pela coroa do reino: hoje você cai!', 'A única coroa aqui é a minha.']],
    lan: [['Uma flecha no joelho e você cai, ossudo!', 'Eu nem tenho joelho... só osso! HAHAHA!'], ['Minha mira não erra duas vezes.', 'Então erra uma vez só e pronto.']],
    mag: [['Estudei seus feitiços. Sei onde cada meteoro vai cair.', 'Então estude isto: CORRA!'], ['A luz vai apagar essa sua fogueira.', 'Minha chama queima há mil anos, mocinha.']],
    pal: [['RAAAH! Vim quebrar essa coroa!', 'Essa coroa já rachou cabeças mais duras que a sua.'], ['Meu machado é maior que o seu!', 'Tamanho não é força, bárbaro.']],
  };
  // conversa antes da luta: [quem, fala] — quem é 'rei' ou o índice do herói
  function roteiro(lv, hs) {
    const L = [];
    if (lv === 1) L.push([0, 'Então é você o tal Rei Esqueleto que assusta o reino?'], ['rei', 'Assustar? Eu GOVERNO este castelo. Quem ousa entrar no meu covil?'], [0, `Sou ${hs[0].cls.fem ? 'a' : 'o'} ${hs[0].cls.n}, e vim acabar com seu reinado de ossos!`], ['rei', 'Sozinho? Vou pendurar seu elmo na minha parede. HAHAHA!']);
    else {
      if (P.ultima === 'derrota') L.push([0, 'Lembra da última vez? Você caiu feio, esqueleto.'], ['rei', 'Um tropeço. Hoje eu levanto... e vocês deitam.']);
      else L.push([0, sorteia(['Voltamos, esqueleto! Treinamos dia e noite.', 'O reino inteiro está torcendo por nós!', 'Seus capangas não vão nos segurar desta vez.'])], ['rei', sorteia(['Treinaram? Eu tenho a eternidade inteira pra treinar.', 'Mais heróis pro meu museu. Que gentileza.', 'Vocês de novo? Nem limpei o chão da última vez.'])]);
      if (hs.length > tamGrupo(lv - 1)) { const k = hs.length - 1; L.push([k, `Desta vez eu vim junto. Prepare-se para ${hs[k].cls.fem ? 'a' : 'o'} ${hs[k].cls.n}!`], ['rei', 'Mais um? Ótimo. Mais ossos pra coleção!']); }
      const k = lv % hs.length, f = FALA_CLS[hs[k].cls.id][lv % 2];
      L.push([k, f[0]], ['rei', f[1]]);
    }
    L.push([0, hs.length > 1 ? 'Todos juntos! PELO REINO!' : 'PELO REINO!'], ['rei', 'Venham! Meu castelo, minhas regras!']);
    return L;
  }
  const quemFala = k => k === 'rei' ? R.boss : R.herois[k];
  function cenaInicio() {
    R.cena = { falas: roteiro(R.lv, R.herois), i: 0, t: 0 };
    const b = R.boss; olhar(b, AW / 2, AH); for (const h of R.herois) { olhar(h, b.x, b.y); anima(h, 'idle'); }
    $b('.bHab').hidden = true; $b('.bTop').hidden = true; $b('.bCena').hidden = false;
  }
  function proxFala() {
    const c = R && R.cena; if (!c) return;
    if (c.t * 40 < c.falas[c.i][1].length) { c.t = 99; return; } // completa o texto primeiro
    c.i++; c.t = 0;
    if (c.i >= c.falas.length) fimCena();
  }
  function fimCena() {
    if (!R || !R.cena) return;
    R.cena = null; $b('.bCena').hidden = true; $b('.bHab').hidden = false; $b('.bTop').hidden = false;
    falar(R.herois[0], 'Ataquem!', 1.5);
  }
  // conversa rápida durante a luta (uma vez por luta cada)
  function conversa(id, linhas) {
    if (!R || R.ditos.has(id)) return; R.ditos.add(id);
    for (const [q, txt] of linhas) if (q) R.papo.push({ q, txt, t: 2.6 });
  }
  function papo(dt) {
    const p = R.papo[0]; if (!p) return;
    if (!p.dito) { p.dito = true; falar(p.q, p.txt, 2.4); }
    p.t -= dt; if (p.t <= 0) R.papo.shift();
  }
  function gatilhos() {
    const b = R.boss, vv = vivos();
    if (!vv.length) return;
    if (b.hp < b.max * 0.7) { const h = sorteia(vv); conversa('rei70', [[h, sorteia(['Ele está rachando! Continuem!', 'Olha só, o osso trincou!', 'Ele não é invencível!'])], [b, sorteia(['Foi só um arranhão no osso.', 'Isso? Cócegas.', 'Agora vocês me irritaram.'])]]); }
    for (const h of vv) if (h.hp < h.max * 0.3) { const m = vv.find(o => o.cls.cura && o !== h); conversa('ferido', [[h, h.cls.fem ? 'Estou muito ferida!' : 'Estou muito ferido!'], m ? [m, 'Aguenta! Vou te curar!'] : [b, 'Já pode escolher sua lápide.']]); }
  }

  /* ---------------- IA dos heróis ---------------- */
  function pensarHeroi(h, dt) {
    const b = R.boss, cls = h.cls, reac = reacao(R.lv);
    let mx = 0, my = 0, perigo = 0;
    for (const z of R.zonas) {
      if (z.t < reac || z.foi) continue;
      const d = Math.hypot(h.x - z.x, h.y - z.y), falta = z.delay - z.t;
      if (d < z.r + 3) {
        const k = 1 / Math.max(0.5, d); mx += (h.x - z.x) * k * 3; my += (h.y - z.y) * k * 3; perigo++;
        if (falta < 0.35 && h.dash <= 0 && d < z.r) dash(h, h.x - z.x, h.y - z.y);
      }
    }
    for (const o of R.ondas) { // ondas da Ira: foge para longe do rei ou rola quando está chegando
      if (o.t < reac) continue;
      const d = Math.hypot(h.x - o.x, h.y - o.y), raio = o.t * o.v;
      if (raio < d && d - raio < 14) { perigo++; if (h.dash <= 0 && d - raio < 6) dash(h, h.x - o.x, h.y - o.y); else { mx += (h.x - o.x) / d * 2; my += (h.y - o.y) / d * 2; } }
    }
    for (const p of R.proj) {
      if (p.dono !== 'boss' || R.t - p.nasce < reac) continue;
      const rx = h.x - p.x, ry = h.y - p.y, dist = Math.hypot(rx, ry), v = Math.hypot(p.vx, p.vy);
      const aprox = (rx * p.vx + ry * p.vy) / (dist * v);
      if (aprox > 0.85 && dist < 45) {
        const lado = (p.vx * ry - p.vy * rx) > 0 ? 1 : -1;
        mx += -p.vy / v * lado * 2.5; my += p.vx / v * lado * 2.5; perigo++;
        if (dist < 12 && h.dash <= 0 && R.lv >= 3) dash(h, -p.vy * lado, p.vx * lado);
      }
    }
    // separa dos companheiros (não andam grudados)
    for (const o of vivos()) if (o !== h) { const d = Math.hypot(h.x - o.x, h.y - o.y); if (d < 8 && d > 0) { mx += (h.x - o.x) / d * 0.8; my += (h.y - o.y) / d * 0.8; } }
    let alvo = b, dAlvo = Math.hypot(b.x - h.x, b.y - h.y) - b.r;
    for (const c of R.cap) { const d = Math.hypot(c.x - h.x, c.y - h.y); if (d < 12 && d < dAlvo) { alvo = c; dAlvo = d; } }
    if (cls.cura) { // a maga cura quem estiver pior
      h.cura -= dt;
      const ferido = vivos().sort((a, c) => a.hp / a.max - c.hp / c.max)[0];
      if (h.cura <= 0 && ferido && ferido.hp < ferido.max * 0.55) { ferido.hp = Math.min(ferido.max, ferido.hp + ferido.max * 0.22); h.cura = 9; poeira(ferido.x, ferido.y, '#b8f0ff', 14); falar(h, ferido === h ? 'Cura!' : 'Te curei!', 1.2); }
    }
    const ax = alvo.x - h.x, ay = alvo.y - h.y, d = Math.hypot(ax, ay) || 1;
    if (!perigo) {
      const quer = cls.alcance + (alvo === b ? b.r : 0);
      if (d > quer) { mx += ax / d; my += ay / d; }
      else if (d < quer * 0.6 && cls.alcance > 10) { mx -= ax / d; my -= ay / d; }
      h.orb += dt * (0.6 + R.lv * 0.05);
      mx += -ay / d * 0.6 * Math.sin(h.orb); my += ax / d * 0.6 * Math.sin(h.orb);
    }
    { // ataca mesmo enquanto desvia (mas não no meio de uma rolada)
      const quer = cls.alcance + (alvo === b ? b.r : 0);
      h.atk -= dt;
      if (h.atk <= 0 && d <= quer + 2 && h.dashT <= 0) {
        olhar(h, alvo.x, alvo.y); anima(h, 'atk'); h.atkT = 0.36;
        if (cls.alcance > 10) {
          const v = cls.arma === 'lanca' ? 75 : 60, a = Math.atan2(alvo.y - h.y, alvo.x - h.x);
          R.proj.push({ x: h.x, y: h.y - 3, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: cls.arma === 'lanca' ? 1.4 : 2, dano: h.dano * (cls.arma === 'lanca' ? 0.8 : 0.95), dono: 'heroi', ttl: 1.5, magia: cls.arma === 'magia' });
          h.atk = cls.arma === 'lanca' ? 0.8 : 1.1;
        } else { dano(alvo, h.dano * (cls.forte || 1) * (alvo === b ? 1 : 1.5) * (h.furiaT > 0 ? 1.4 : 1), '#ffe08a'); h.atk = h.furiaT > 0 ? 0.4 : 0.8; poeira(alvo.x, alvo.y - 4, '#fff', 5); }
      }
    }
    especial(h, dt, perigo);
    if (h.carrega > 0) mx = my = 0; // parado preparando o golpe
    if (h.investida > 0) { mx = b.x - h.x; my = b.y - h.y; }
    h.dash -= dt; h.dashT -= dt;
    const m = Math.hypot(mx, my), spd = h.spd * (h.dashT > 0 ? 3 : 1);
    if (m > 0.05) { h.vx = mx / m * spd; h.vy = my / m * spd; } else { h.vx = h.vy = 0; }
    h.x = clamp(h.x + h.vx * dt, 3, AW - 3); h.y = clamp(h.y + h.vy * dt, 3, AH - 3);
    const db = Math.hypot(h.x - b.x, h.y - b.y), min = b.r + h.r;
    if (db < min) { h.x = b.x + (h.x - b.x) / db * min; h.y = b.y + (h.y - b.y) / db * min; }
    if (h.atkT <= 0) { if (Math.hypot(h.vx, h.vy) > 1) { olhar(h, h.x + h.vx, h.y + h.vy); anima(h, 'walk'); } else { olhar(h, b.x, b.y); anima(h, 'idle'); } }
    if (Math.random() < dt * 0.06) falar(h, cls.fala[Math.floor(Math.random() * cls.fala.length)], 1.8);
  }
  // golpes especiais (a partir do nível ESP_LV) — sempre com aviso para o chefão reagir
  function especial(h, dt, perigo) {
    const b = R.boss, e = ESPECIAIS[h.cls.id], db = Math.hypot(b.x - h.x, b.y - h.y);
    h.furiaT -= dt;
    if (h.furiaT > 0 && Math.random() < dt * 20) poeira(h.x, h.y - 3, '#ff4a2a', 1);
    if (h.carrega > 0) { // cavaleiro: prepara e avança
      h.carrega -= dt; olhar(h, b.x, b.y);
      if (h.carrega <= 0) { dash(h, b.x - h.x, b.y - h.y); h.dashT = 0.3; h.investida = 0.35; }
      return;
    }
    if (h.investida > 0) {
      h.investida -= dt;
      if (db < b.r + h.r + 3) {
        h.investida = 0; b.atordoado = 1.3; dano(b, h.dano * 2, '#ffe08a'); shake = Math.max(shake, 0.3);
        R.txt.push({ x: b.x, y: b.y - 18, s: 'ATORDOADO!', cor: '#ffd76a', t: 0, grande: true }); poeira(b.x, b.y - 6, '#ffd76a', 14);
        conversa('atordoado', [[b, 'Grr... minha cabeça!'], [h, 'Agora, pessoal! Ataquem!']]);
      }
      return;
    }
    if (R.lv < ESP_LV) return;
    h.esp -= dt;
    const id = h.cls.id;
    if (h.esp > 0 || (perigo && id !== 'cav') || h.dashT > 0) return; // o cavaleiro é corajoso: avança mesmo sob perigo
    if (id === 'cav' && db > b.r + 24) return; // só avança se estiver perto
    h.esp = e.cd * Math.max(0.6, 1 - (R.lv - ESP_LV) * 0.03);
    falar(h, e.grito, 1.3);
    if (id === 'cav') { h.carrega = 0.7; R.txt.push({ x: h.x, y: h.y - 10, s: '❗', cor: '#ffd76a', t: 0, grande: true }); }
    if (id === 'lan') { olhar(h, b.x, b.y); anima(h, 'atk'); h.atkT = 0.36; R.zonas.push({ x: b.x, y: b.y, r: 13, t: 0, delay: 1.3, dano: h.dano * 3, tipo: 'flechas', dono: 'heroi' }); }
    if (id === 'mag') { const a = Math.atan2(b.y - h.y, b.x - h.x); olhar(h, b.x, b.y); anima(h, 'atk'); h.atkT = 0.36; R.proj.push({ x: h.x, y: h.y - 3, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, r: 3, dano: h.dano, dono: 'heroi', ttl: 2.5, magia: true, gelo: true }); }
    if (id === 'pal') { h.furiaT = 5; poeira(h.x, h.y, '#ff4a2a', 18); conversa('furiaBarb', [[b, 'Fúria? Eu inventei a fúria!']]); }
  }
  function dash(h, dx, dy) { const m = Math.hypot(dx, dy) || 1; h.dash = Math.max(1.2, 3.2 - R.lv * 0.15); h.dashT = 0.22; h.vx = dx / m; h.vy = dy / m; poeira(h.x, h.y, '#ddd', 6); }

  /* ---------------- atualização ---------------- */
  function passo(dt) {
    R.t += dt;
    const b = R.boss;
    for (let i = 0; i < R.cd.length; i++) R.cd[i] = Math.max(0, R.cd[i] - dt);
    if (!R.furia && b.hp < b.max * 0.35) { R.furia = true; conversa('furia', [[b, 'AGORA CHEGA!!! Chega de brincadeira!'], [sorteia(vivos()), 'Cuidado! Ele ficou furioso!']]); shake = 0.5; poeira(b.x, b.y, '#ff3a2a', 30); }
    // movimento do rei: joystick tem prioridade sobre o toque
    const vel = R.furia ? 24 : 19;
    let mvx = 0, mvy = 0;
    if (joy && joy.arr) { const dx = joy.x - joy.sx, dy = joy.y - joy.sy, m = Math.hypot(dx, dy); if (m > 8) {
      const f = Math.min(1, m / 60) * vel, ux = dx / m, uy = dy / m;
      if (usa3d()) { // relativo à câmera 3D: cima = frente da câmera
        const yw = M3D.yaw || 0, sy = Math.sin(yw), cy = Math.cos(yw);
        mvx = (-uy * sy - ux * cy) * f; mvy = (-uy * cy + ux * sy) * f;
      } else { mvx = ux * f; mvy = uy * f; }
    } b.alvo = null; }
    else if (b.alvo) { const dx = b.alvo[0] - b.x, dy = b.alvo[1] - b.y, d = Math.hypot(dx, dy); if (d < 1) b.alvo = null; else { mvx = dx / d * vel; mvy = dy / d * vel; } }
    b.andando = !!(mvx || mvy); if (b.andando) olhar(b, b.x + mvx, b.y + mvy); // olha para onde o jogador quer ir (até atacando)
    if (b.carga > 0 || b.atordoado > 0) { mvx = mvy = 0; }
    if (b.lento > 0) { mvx *= 0.5; mvy *= 0.5; }
    b.atordoado -= dt; b.lento -= dt;
    b.x = clamp(b.x + mvx * dt, 10, AW - 10); b.y = clamp(b.y + mvy * dt, 12, AH - 10);
    b.carga -= dt; b.flash -= dt; b.atkT -= dt;
    // golpe automático de machado em quem chegar perto
    b.golpe = (b.golpe || 0) - dt;
    if (b.golpe <= 0 && b.atkT <= 0 && b.carga <= 0 && b.atordoado <= 0) {
      const perto = vivos().filter(h => Math.hypot(h.x - b.x, h.y - b.y) < b.r + h.r + 7);
      if (perto.length) {
        if (!b.andando) olhar(b, perto[0].x, perto[0].y); b.esp = null; anima(b, 'atk'); b.at = 0; b.atkT = 0.5; b.golpe = R.furia ? 0.8 : 1.1;
        for (const h of perto) dano(h, 12 * mulDano(), '#ff8a6a');
        shake = Math.max(shake, 0.12); poeira(perto[0].x, perto[0].y, '#c9a36a', 8);
      }
    }
    if (b.atkT <= 0) { b.esp = null; anima(b, mvx || mvy ? 'walk' : 'idle'); }
    for (const h of R.herois) {
      if (h.morto) { h.mt += dt; continue; }
      if (Math.hypot(h.x - b.x, h.y - b.y) < b.r + h.r + 0.5) { h.contato = (h.contato || 0) + 6 * dt * mulDano(); if (h.contato >= 5) { dano(h, h.contato, '#ff8a6a'); h.contato = 0; } }
      if (!R.fim) pensarHeroi(h, dt);
      h.flash -= dt; h.atkT -= dt;
      if (h.hp <= 0) { h.morto = true; h.mt = 0; anima(h, 'die'); poeira(h.x, h.y, '#c9a0ff', 16); falar(h, 'Nããão...', 1.5);
        const vv = vivos();
        if (vv.length > 1) conversa('morte1', [[vv[0], `${h.cls.n}! NÃÃÃO!`], [b, 'Um a menos. Quem é o próximo?']]);
        else if (vv.length === 1) conversa('ultimo', [[vv[0], 'Sobrou só eu... mas não vou fugir!'], [b, 'Coragem não é armadura, pequeno.']]);
      }
    }
    for (const z of R.zonas) {
      if (z.segue) { z.x = b.x; z.y = b.y; }
      z.t += dt;
      if (z.t >= z.delay && !z.foi) {
        z.foi = true;
        if (z.dono === 'heroi') {
          if (Math.hypot(b.x - z.x, b.y - z.y) < z.r + b.r * 0.5) { dano(b, z.dano, '#9fe3ff'); R.txt.push({ x: b.x, y: b.y - 18, s: 'flechas!', cor: '#9fe3ff', t: 0 }); }
          else conversa('errou', [[b, 'Errou! HAHAHA!']]);
          poeira(z.x, z.y, '#9fe3ff', 16); continue;
        }
        for (const h of vivos()) if (Math.hypot(h.x - z.x, h.y - z.y) < z.r + h.r) dano(h, z.dano * mulDano(), '#ff8a6a');
        for (const c of R.cap) if (z.tipo === 'meteoro' && Math.hypot(c.x - z.x, c.y - z.y) < z.r) c.hp -= 5;
        shake = Math.max(shake, z.tipo === 'pisao' ? 0.35 : 0.2);
        poeira(z.x, z.y, z.tipo === 'pisao' ? '#c9a36a' : '#ff7a3a', 22);
      }
    }
    R.zonas = R.zonas.filter(z => z.t < z.delay + 0.25);
    for (const o of R.ondas) {
      o.t += dt; if (o.t < 0) continue;
      const raio = o.t * o.v;
      for (const h of vivos()) { const d = Math.hypot(h.x - o.x, h.y - o.y); if (!o.acertou.has(h) && Math.abs(d - raio) < 3) { o.acertou.add(h); dano(h, o.dano * mulDano(), '#ff5a3a'); } }
    }
    R.ondas = R.ondas.filter(o => o.t * o.v < 190);
    for (const p of R.proj) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.ttl -= dt;
      if (p.dono === 'boss') {
        for (const h of vivos()) if (p.ttl > 0 && Math.hypot(p.x - h.x, p.y - h.y) < p.r + h.r) { dano(h, p.dano * mulDano(), '#ff8a6a'); p.ttl = 0; poeira(p.x, p.y, '#ff7a3a', 8); }
      } else {
        if (Math.hypot(p.x - b.x, p.y - b.y + 4) < p.r + b.r) { dano(b, p.dano, '#ffe08a'); if (p.gelo) { b.lento = 3; R.txt.push({ x: b.x, y: b.y - 18, s: 'LENTO ❄️', cor: '#9fe3ff', t: 0, grande: true }); poeira(b.x, b.y, '#b8f0ff', 14); } p.ttl = 0; poeira(p.x, p.y, p.magia ? '#c9a0ff' : '#fff', 5); }
        for (const c of R.cap) if (p.ttl > 0 && Math.hypot(p.x - c.x, p.y - c.y) < p.r + c.r) { dano(c, p.dano * 1.3); p.ttl = 0; }
      }
      if (p.x < -5 || p.x > AW + 5 || p.y < -5 || p.y > AH + 5) p.ttl = 0;
    }
    R.proj = R.proj.filter(p => p.ttl > 0);
    for (const c of R.cap) {
      const h = maisPerto(c.x, c.y); c.flash -= dt; c.atkT -= dt;
      if (!h) { anima(c, 'idle'); continue; }
      const dx = h.x - c.x, dy = h.y - c.y, d = Math.hypot(dx, dy) || 1;
      olhar(c, h.x, h.y);
      if (d > c.r + h.r) { c.x += dx / d * 20 * dt; c.y += dy / d * 20 * dt; if (c.atkT <= 0) anima(c, 'walk'); }
      else { c.atk -= dt; if (c.atk <= 0) { dano(h, 3.5 * mulDano(), '#ff8a6a'); c.atk = 0.7; anima(c, 'atk'); c.atkT = 0.36; } }
      if (c.hp <= 0) poeira(c.x, c.y, '#7ad46a', 10);
    }
    R.cap = R.cap.filter(c => c.hp > 0);
    fx(dt);
    if (!R.fim && !vivos().length) terminar(true);
    if (!R.fim && b.hp <= 0) { terminar(false); anima(b, 'die'); }
  }
  function fx(dt) {
    for (const q of [R.boss, ...R.herois, ...R.cap]) q.at += dt;
    for (const p of R.part) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; }
    R.part = R.part.filter(p => p.t < p.vida);
    for (const t of R.txt) t.t += dt;
    R.txt = R.txt.filter(t => t.t < 0.9);
    for (const q of [R.boss, ...R.herois]) if (q.fala) { q.fala.t -= dt; if (q.fala.t <= 0) q.fala = null; }
    shake = Math.max(0, shake - dt);
  }
  function terminar(venceu) {
    const lv = R.lv, gemas = venceu ? 5 * lv : 0;
    R.fim = { venceu, gemas, t: 0 };
    if (venceu) { R.boss.vitoria = true; P.nivel++; P.vitorias++; P.recorde = Math.max(P.recorde || 0, lv); P.ultima = 'vitoria'; R.papo = [{ q: R.boss, txt: sorteia(['HAHAHAHA! Voltem quando crescerem!', 'Próximos! Meu museu tem espaço.', 'Ninguém derruba o Rei Esqueleto!']), t: 3 }]; if (typeof me !== 'undefined' && me) { me.gemas += gemas; if (typeof save === 'function') save(); } }
    else { P.derrotas++; for (const h of vivos()) h.vitoria = true; P.ultima = 'derrota'; const v = vivos()[0]; R.papo = [v && { q: v, txt: 'O reino está salvo!', t: 1.6 }, { q: R.boss, txt: 'Isso... não... acabou...', t: 2 }].filter(Boolean); }
    salvar();
    setTimeout(() => {
      if (!R || !R.fim) return;
      const L = $b('.bLobby'); L.hidden = false; $b('.bHab').hidden = true;
      L.innerHTML = `<h2>${venceu ? '🏆 Vitória do Chefão!' : '💀 Derrotado...'}</h2>
        <p>${venceu ? `Os heróis do nível ${lv} caíram diante de você.` : `Os heróis do nível ${lv} te derrubaram. Mude a estratégia e tente de novo!`}</p>
        ${venceu ? `<div class="bCard"><div>⬆️ <b>Os heróis evoluíram para o nível ${lv + 1}</b><div class="mut">${NOVIDADES[lv + 1] || 'Mais vida (+25%) e mais dano (+18%)'}</div></div></div>` : ''}
        ${gemas ? `<div class="bAlmas">+💎 ${gemas} gemas no reino</div>` : ''}
        <button class="btn bGo" data-b="lobby">Voltar ao covil</button>`;
    }, 1600);
  }

  /* ---------------- desenho ---------------- */
  function circ(x, y, r) { g.beginPath(); g.arc(x, y, r, 0, 7); }
  function chao() {
    g.fillStyle = '#120c10'; g.fillRect(0, 0, W, H);
    const [x0, y0] = a2s(0, 0), w = AW * sc, h = AH * sc, t = 10 * sc;
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    for (let i = 0; i * t < w + t; i++) for (let j = 0; j * t < h + t; j++) {
      const n = ((i * 73856093) ^ (j * 19349663)) >>> 0;
      g.fillStyle = `hsl(${20 + n % 12}, ${8 + n % 6}%, ${17 + (n >> 4) % 7}%)`;
      g.fillRect(x0 + i * t + 1, y0 + j * t + 1, t - 2, t - 2);
    }
    g.strokeStyle = R && R.furia ? 'rgba(255,60,20,.6)' : 'rgba(255,90,20,.35)'; g.lineWidth = 2; g.shadowColor = '#ff5a14'; g.shadowBlur = 8;
    for (let k = 0; k < 7; k++) { g.beginPath(); let x = x0 + ((k * 37) % 100) / 100 * w, y = y0 + ((k * 61) % 100) / 100 * h; g.moveTo(x, y); for (let s = 0; s < 5; s++) { x += ((k * s * 13) % 40 - 20) * sc * 0.4; y += ((k + s) * 7 % 30 - 8) * sc * 0.4; g.lineTo(x, y); } g.stroke(); }
    g.restore(); g.shadowBlur = 0;
    g.strokeStyle = '#3a2418'; g.lineWidth = 6; g.strokeRect(x0, y0, w, h);
    const fl = 0.8 + Math.sin(R ? R.t * 13 : 0) * 0.1 + Math.random() * 0.1;
    for (const [x, y] of [[4, 4], [AW - 4, 4], [4, AH - 4], [AW - 4, AH - 4]]) {
      const [sx, sy] = a2s(x, y), gr = g.createRadialGradient(sx, sy, 0, sx, sy, 20 * sc * fl);
      gr.addColorStop(0, 'rgba(255,170,60,.55)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
      g.fillStyle = gr; circ(sx, sy, 20 * sc * fl); g.fill();
      g.fillStyle = '#ffcf6a'; circ(sx, sy, 1.4 * sc); g.fill();
    }
  }
  // desenha um personagem animado com a base no ponto (x,y) da arena
  function boneco(id, q, esc, tint) {
    const [sx, sy] = a2s(q.x, q.y);
    const [n, fps, rep] = ANIM[q.anim] || ANIM.idle;
    let fr = Math.floor(q.at * fps); fr = rep ? fr % n : Math.min(n - 1, fr);
    let dir = 'd', flip = false;
    if (Math.abs(q.fx) > Math.abs(q.fy) * 1.2) { dir = 'r'; flip = q.fx < 0; } else dir = q.fy < 0 ? 'u' : 'd';
    const m = CH.m && CH.m[`${id}_${q.anim}_${dir}_${fr}`];
    if (!m || !CH.img.complete) { g.fillStyle = '#888'; circ(sx, sy - 4 * sc, 3 * sc); g.fill(); return; }
    const k = sc * esc;
    let src = CH.img, srx = m.x, sry = m.y;
    if (q.flash > 0 || tint) { // tinta/flash num canvas à parte, só sobre os pixels do boneco
      TMP.width = m.w; TMP.height = m.h;
      tg.clearRect(0, 0, m.w, m.h); tg.globalCompositeOperation = 'source-over';
      tg.drawImage(CH.img, m.x, m.y, m.w, m.h, 0, 0, m.w, m.h);
      tg.globalCompositeOperation = 'source-atop'; tg.fillStyle = q.flash > 0 ? 'rgba(255,255,255,.7)' : tint; tg.fillRect(0, 0, m.w, m.h);
      src = TMP; srx = 0; sry = 0;
    }
    g.save(); g.translate(sx, sy); if (flip) g.scale(-1, 1);
    if (q.morto) g.globalAlpha = Math.max(0, 1 - Math.max(0, q.mt - 0.8));
    g.drawImage(src, srx, sry, m.w, m.h, -m.ax * k, -m.ay * k, m.w * k, m.h * k);
    g.restore();
    return { topo: sy - m.ay * k, alt: m.h * k };
  }
  const TMP = document.createElement('canvas'), tg = TMP.getContext('2d');
  function desenharBoss(b) {
    const [sx, sy] = a2s(b.x, b.y), r = b.r * sc;
    if (R.furia) { const gr = g.createRadialGradient(sx, sy - r, r * 0.3, sx, sy - r, r * 2.2); gr.addColorStop(0, 'rgba(255,40,20,.35)'); gr.addColorStop(1, 'rgba(255,40,20,0)'); g.fillStyle = gr; circ(sx, sy - r, r * 2.2); g.fill(); }
    if (b.carga > 0) { g.strokeStyle = `rgba(255,60,30,${0.5 + Math.sin(R.t * 40) * 0.3})`; g.lineWidth = 3; g.beginPath(); g.ellipse(sx, sy, r * 1.3, r * 0.6, 0, 0, 7); g.stroke(); }
    const bb = boneco('rei', b, 0.19, null);
    // coroa por cima da cabeça
    if (bb && b.anim !== 'die') {
      const cy = bb.topo + bb.alt * 0.2, cw = 4.6 * sc, bob = b.anim === 'walk' ? Math.abs(Math.sin(b.at * 9)) * sc : 0;
      g.fillStyle = '#f2c94c'; g.strokeStyle = '#8a5a10'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(sx - cw, cy - bob); for (let k = 0; k <= 4; k++) g.lineTo(sx - cw + k * cw / 2, cy - bob - (k % 2 ? 1.6 : 3.4) * sc); g.lineTo(sx + cw, cy - bob); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#e0402a'; circ(sx, cy - bob - 1.2 * sc, 0.7 * sc); g.fill();
    }
  }
  function balao(q, txt) {
    const alto = q === R.boss ? 31 : 16;
    const [sx, sy] = a2s(q.x, q.y - alto);
    g.font = '700 13px system-ui'; const w = g.measureText(txt).width + 14;
    g.fillStyle = 'rgba(255,250,240,.95)'; g.beginPath(); g.roundRect ? g.roundRect(sx - w / 2, sy - 24, w, 22, 8) : g.rect(sx - w / 2, sy - 24, w, 22); g.fill();
    g.fillStyle = '#2a1a0a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, sx, sy - 13);
  }
  const TINT = { pal: 'rgba(240,200,60,.18)', mag: 'rgba(150,90,220,.22)', lan: null, cav: null };
  function desenhar() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (shake > 0) g.translate((Math.random() - 0.5) * 12 * shake, (Math.random() - 0.5) * 12 * shake);
    chao();
    if (!R) return;
    for (const z of R.zonas) {
      const [sx, sy] = a2s(z.x, z.y), r = z.r * sc, p = Math.min(1, z.t / z.delay);
      if (z.foi) { g.fillStyle = `rgba(255,140,40,${0.5 - (z.t - z.delay) * 2})`; g.beginPath(); g.ellipse(sx, sy, r, r, 0, 0, 7); g.fill(); continue; }
      const az = z.dono === 'heroi';
      g.fillStyle = az ? 'rgba(60,170,255,.2)' : 'rgba(255,40,20,.18)'; circ(sx, sy, r); g.fill();
      g.strokeStyle = az ? 'rgba(90,200,255,.9)' : 'rgba(255,60,30,.8)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = az ? 'rgba(60,170,255,.35)' : 'rgba(255,40,20,.35)'; circ(sx, sy, r * p); g.fill();
      if (z.tipo === 'meteoro' && p > 0.4) { // meteoro caindo
        const my = sy - (1 - p) * 60 * sc / 3; g.fillStyle = '#ff9a3a'; g.shadowColor = '#ff5a14'; g.shadowBlur = 14; circ(sx, my, 2.2 * sc); g.fill(); g.shadowBlur = 0;
      }
    }
    for (const o of R.ondas) { if (o.t < 0) continue; const [sx, sy] = a2s(o.x, o.y), rr = o.t * o.v * sc; g.strokeStyle = `rgba(255,90,30,${Math.max(0, 0.9 - o.t * 0.3)})`; g.lineWidth = 5; circ(sx, sy, rr); g.stroke(); }
    const ents = [R.boss, ...R.herois, ...R.cap].sort((a, b) => a.y - b.y);
    for (const q of ents) {
      const [sx, sy] = a2s(q.x, q.y);
      if (q === R.boss) { desenharBoss(q); continue; }
      if (R.herois.includes(q)) {
        if (q.morto && q.mt > 1.8) continue;
        if (q.dashT > 0) { g.globalAlpha = 0.3; boneco(q.cls.id, { ...q, x: q.x - q.vx * 0.05, y: q.y - q.vy * 0.05, flash: 0 }, 0.2, TINT[q.cls.id]); g.globalAlpha = 1; }
        if (q.cls.arma === 'magia' && !q.morto) { const gr = g.createRadialGradient(sx + 3 * sc, sy - 7 * sc, 0, sx + 3 * sc, sy - 7 * sc, 2.5 * sc); gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, '#c9a0ff'); gr.addColorStop(1, 'rgba(160,112,255,0)'); g.fillStyle = gr; circ(sx + 3 * sc, sy - 7 * sc, 2.5 * sc); g.fill(); }
        boneco(q.cls.id, q, 0.2, TINT[q.cls.id]);
        if (!q.morto) { g.fillStyle = '#1a0e0e'; g.fillRect(sx - 4 * sc, sy - 14 * sc, 8 * sc, 3); g.fillStyle = q.cls.cor; g.fillRect(sx - 4 * sc, sy - 14 * sc, 8 * sc * Math.max(0, q.hp / q.max), 3); }
      } else {
        boneco('orc', q, 0.15, null);
        g.fillStyle = '#2a1a0a'; g.fillRect(sx - 3 * sc, sy - 11 * sc, 6 * sc, 3); g.fillStyle = '#7ad46a'; g.fillRect(sx - 3 * sc, sy - 11 * sc, 6 * sc * q.hp / q.max, 3);
      }
    }
    for (const p of R.proj) {
      const [sx, sy] = a2s(p.x, p.y);
      if (p.dono === 'boss') { const gr = g.createRadialGradient(sx, sy, 0, sx, sy, p.r * sc * 1.8); gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.4, '#ff8a2a'); gr.addColorStop(1, 'rgba(255,60,10,0)'); g.fillStyle = gr; circ(sx, sy, p.r * sc * 1.8); g.fill(); }
      else if (p.magia) { g.fillStyle = '#c9a0ff'; g.shadowColor = '#a070ff'; g.shadowBlur = 10; circ(sx, sy, p.r * sc); g.fill(); g.shadowBlur = 0; }
      else { const m = Math.hypot(p.vx, p.vy); g.strokeStyle = '#d8dde6'; g.lineWidth = 3; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - p.vx / m * 6 * sc, sy - p.vy / m * 6 * sc); g.stroke(); g.strokeStyle = '#8a5a2b'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx - p.vx / m * 2 * sc, sy - p.vy / m * 2 * sc); g.lineTo(sx - p.vx / m * 6 * sc, sy - p.vy / m * 6 * sc); g.stroke(); }
    }
    for (const p of R.part) { const [sx, sy] = a2s(p.x, p.y); g.globalAlpha = 1 - p.t / p.vida; g.fillStyle = p.cor; g.fillRect(sx - 2, sy - 2, 4, 4); }
    g.globalAlpha = 1;
    for (const t of R.txt) { const [sx, sy] = a2s(t.x, t.y - t.t * 8); g.globalAlpha = 1 - t.t / 0.9; g.font = `800 ${t.grande ? 22 : 16}px system-ui`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(t.s, sx, sy); g.fillStyle = t.cor; g.fillText(t.s, sx, sy); }
    g.globalAlpha = 1;
    for (const q of [R.boss, ...R.herois]) if (q.fala && !(q.morto && q.mt > 1.5)) balao(q, q.fala.txt);
    if (joy && joy.arr) { // joystick visível
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; circ(joy.sx, joy.sy, 60); g.stroke();
      const dx = joy.x - joy.sx, dy = joy.y - joy.sy, m = Math.hypot(dx, dy), f = Math.min(1, 60 / (m || 1));
      g.fillStyle = 'rgba(255,255,255,.45)'; circ(joy.sx + dx * f, joy.sy + dy * f, 22); g.fill();
    }
    if (R.furia) { g.fillStyle = 'rgba(160,0,0,.08)'; g.fillRect(0, 0, W, H); }
  }
  function desenhar3d() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
    if (!R) return;
    const P3 = (x, y, h) => M3D.proj(x, y, h);
    for (const h of R.herois) if (!h.morto) {
      const [sx, sy, vis] = P3(h.x, h.y, 1.35); if (!vis) continue;
      g.fillStyle = 'rgba(20,10,10,.8)'; g.fillRect(sx - 22, sy, 44, 6); g.fillStyle = h.cls.cor; g.fillRect(sx - 22, sy, 44 * Math.max(0, h.hp / h.max), 6);
    }
    for (const c of R.cap) { const [sx, sy, vis] = P3(c.x, c.y, 1.0); if (!vis) continue; g.fillStyle = '#2a1a0a'; g.fillRect(sx - 14, sy, 28, 4); g.fillStyle = '#7ad46a'; g.fillRect(sx - 14, sy, 28 * c.hp / c.max, 4); }
    for (const t of R.txt) { const [sx, sy, vis] = P3(t.x, t.y, 1.2 + t.t * 1.2); if (!vis) continue; g.globalAlpha = 1 - t.t / 0.9; g.font = `800 ${t.grande ? 24 : 17}px system-ui`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(t.s, sx, sy); g.fillStyle = t.cor; g.fillText(t.s, sx, sy); }
    g.globalAlpha = 1;
    for (const q of [R.boss, ...R.herois]) if (q.fala && !(q.morto && q.mt > 1.5)) {
      const [sx, sy, vis] = P3(q.x, q.y, q === R.boss ? 3.0 : 1.55); if (!vis) continue;
      g.font = '700 13px system-ui'; const w = g.measureText(q.fala.txt).width + 14;
      g.fillStyle = 'rgba(255,250,240,.95)'; g.beginPath(); g.roundRect ? g.roundRect(sx - w / 2, sy - 24, w, 22, 8) : g.rect(sx - w / 2, sy - 24, w, 22); g.fill();
      g.fillStyle = '#2a1a0a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(q.fala.txt, sx, sy - 13); g.textBaseline = 'alphabetic';
    }
    if (joy && joy.arr) {
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; circ(joy.sx, joy.sy, 60); g.stroke();
      const dx = joy.x - joy.sx, dy = joy.y - joy.sy, m = Math.hypot(dx, dy), f = Math.min(1, 60 / (m || 1));
      g.fillStyle = 'rgba(255,255,255,.45)'; circ(joy.sx + dx * f, joy.sy + dy * f, 22); g.fill();
    }
    if (R.furia) { g.fillStyle = 'rgba(160,0,0,.1)'; g.fillRect(0, 0, W, H); }
  }
  function hud() {
    const pp = $b('.bPapo');
    if (!R) { pp.innerHTML = ''; return; }
    if (R.cena) {
      const [k, txt] = R.cena.falas[R.cena.i], q = quemFala(k), box = $b('.bFalaBox');
      box.style.setProperty('--c', k === 'rei' ? COR_REI : q.cls.cor);
      box.querySelector('b').textContent = k === 'rei' ? '👑 Rei Esqueleto (você)' : q.cls.n;
      box.querySelector('p').textContent = txt.slice(0, Math.floor(R.cena.t * 40));
      return;
    }
    const p = R.papo[0], html = p ? `<div style="--c:${p.q === R.boss ? COR_REI : p.q.cls.cor}"><b>${p.q === R.boss ? 'Rei' : p.q.cls.n}:</b> ${p.txt}</div>` : '';
    if (pp.innerHTML !== html) pp.innerHTML = html;
    const b = R.boss;
    $b('.bBar.boss i').style.width = Math.max(0, b.hp / b.max * 100) + '%';
    $b('.bBar.boss b').textContent = `${Math.max(0, Math.ceil(b.hp))}/${Math.round(b.max)}${R.furia ? ' 🔥' : ''}${b.atordoado > 0 ? ' 💫' : ''}${b.lento > 0 ? ' ❄️' : ''}`;
    R.herois.forEach((h, i) => { const e = $b(`.bBar.heroi[data-h="${i}"]`); if (!e) return; e.querySelector('i').style.width = Math.max(0, h.hp / h.max * 100) + '%'; e.querySelector('b').textContent = h.morto ? '💀' : Math.ceil(h.hp); });
    el.querySelectorAll('.hb').forEach((btn, i) => {
      if (HAB[i].id === 'ira') {
        btn.style.setProperty('--p', (100 - R.ira) / 100 * 360 + 'deg');
        btn.querySelector('em').textContent = R.ira >= 100 ? '' : Math.floor(R.ira) + '%';
        btn.disabled = R.ira < 100 || !!R.fim; btn.classList.toggle('pronto', R.ira >= 100);
        return;
      }
      const c = R.cd[i], tot = HAB[i].cd * mulCd();
      btn.style.setProperty('--p', c > 0 ? (c / tot * 360) + 'deg' : '0deg');
      btn.querySelector('em').textContent = c > 0 ? Math.ceil(c) : '';
      btn.disabled = c > 0 || !!R.fim || b.atordoado > 0;
    });
  }
  function loop(now) {
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (freeze > 0) { freeze -= dt; dt = 0; }
    if (R && R.cena) { R.cena.t += dt; fx(dt); }
    else if (R && !R.fim) { passo(dt); gatilhos(); papo(dt); }
    else if (R) { R.t += dt; fx(dt); papo(dt); for (const h of R.herois) if (h.morto) h.mt += dt; }
    if (usa3d()) { M3D.mostrar(true); M3D.render(R, dt, { tremor: shake, foco: R && R.cena ? quemFala(R.cena.falas[R.cena.i][0]) : null }); desenhar3d(); }
    else { if (window.M3D) M3D.mostrar(false); desenhar(); }
    hud();
    raf = requestAnimationFrame(loop);
  }
  return { abrir, fechar, P, get luta() { return R; } };
})();
