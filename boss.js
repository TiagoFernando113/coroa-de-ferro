'use strict';
/* =====================================================================
   Modo Chefão — você é o BOSS e luta contra o herói.
   O herói é uma IA que esquiva dos seus ataques, ataca e aprende:
   a cada vitória vem um herói mais forte e mais rápido para reagir.
   Tudo aqui é independente do reino; só as gemas ganhas vão para `me`.
   ===================================================================== */
const Boss = (() => {
  const KEY = 'coroa_boss_v1';
  const AW = 100, AH = 150;                       // arena em unidades
  const HEROIS = [
    { id: 'cav', n: 'Cavaleiro', cor: '#3f6fb0', alcance: 7, arma: 'espada', fala: ['Pelo reino!', 'Sua hora chegou, monstro!', 'Não tenho medo de você!'] },
    { id: 'arq', n: 'Arqueira', cor: '#3f8f4a', alcance: 38, arma: 'arco', fala: ['Nunca erro um alvo!', 'Fica paradinho aí...', 'Muito lento!'] },
    { id: 'mag', n: 'Maga', cor: '#7a4fb0', alcance: 34, arma: 'magia', cura: true, fala: ['Luz, me proteja!', 'Sua magia é fraca!', 'Eu estudei você!'] },
    { id: 'pal', n: 'Paladino', cor: '#c9a23a', alcance: 7, arma: 'martelo', escudo: true, fala: ['A justiça chegou!', 'Meu escudo aguenta!', 'Renda-se, trevas!'] },
  ];
  const HAB = [
    { id: 'pisao', n: 'Pisão', i: '💥', cd: 4, d: 'Onda de choque em volta de você' },
    { id: 'fogo', n: 'Fogo', i: '🔥', cd: 2, d: '3 bolas de fogo na direção do herói' },
    { id: 'capangas', n: 'Capangas', i: '👹', cd: 10, d: 'Invoca capangas que perseguem o herói' },
    { id: 'meteoro', n: 'Meteoros', i: '☄️', cd: 8, d: 'Chuva de meteoros em volta do herói' },
  ];
  const UPS = [
    { id: 'vida', n: 'Vida', i: '❤️', d: '+15% de vida' },
    { id: 'forca', n: 'Força', i: '💪', d: '+12% de dano' },
    { id: 'rapidez', n: 'Rapidez', i: '⚡', d: '-7% de recarga' },
    { id: 'capangas', n: 'Horda', i: '👹', d: '+1 capanga por invocação' },
  ];
  const XINGA = ['Mais um herói pro meu museu!', 'Achou que ia ser fácil?', 'Hahahaha!', 'Vem, vem...', 'Meu castelo, minhas regras!'];

  let P = { nivel: 1, almas: 0, up: { vida: 0, forca: 0, rapidez: 0, capangas: 0 }, vitorias: 0, derrotas: 0 };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.up) P = s; } catch (e) {}
  const salvar = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };
  const upCusto = id => Math.round(20 * (P.up[id] + 1) ** 1.5);
  const heroiDe = lv => HEROIS[(lv - 1) % HEROIS.length];

  let el, cv, g, W, H, DPR, sc, ox, oy, raf = 0, R = null, last = 0, shake = 0;
  const $b = s => el.querySelector(s);

  /* ---------------- montagem da tela ---------------- */
  function montar() {
    el = document.createElement('div'); el.id = 'boss'; el.hidden = true;
    el.innerHTML = `<canvas id="bcv"></canvas>
      <div class="bTop"><div class="bBar boss"><span>👑 Você — Rei Sombrio</span><i></i><b></b></div>
        <div class="bBar heroi"><span></span><i></i><b></b></div></div>
      <button class="bX" data-b="sair" aria-label="Sair">✕</button>
      <div class="bHab"></div>
      <div class="bLobby"></div>`;
    document.body.appendChild(el);
    cv = $b('#bcv'); g = cv.getContext('2d');
    $b('.bHab').innerHTML = HAB.map((h, i) => `<button class="hb" data-b="hab" data-i="${i}"><b>${h.i}</b><span>${h.n}</span><em></em></button>`).join('');
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-b]'); if (!a) return;
      const k = a.dataset.b;
      if (k === 'sair') fechar();
      if (k === 'hab') usar(+a.dataset.i);
      if (k === 'lutar') lutar();
      if (k === 'up') comprar(a.dataset.u);
      if (k === 'lobby') lobby();
    });
    cv.addEventListener('pointerdown', e => {
      if (!R || R.fim) return;
      const [x, y] = s2a(e.clientX, e.clientY);
      R.boss.alvo = [Math.max(10, Math.min(AW - 10, x)), Math.max(12, Math.min(AH - 12, y))];
    });
    addEventListener('resize', () => { if (!el.hidden) medir(); });
  }
  function medir() {
    DPR = Math.min(3, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    const topo = 70, base = 120;
    sc = Math.min(W / AW, (H - topo - base) / AH);
    ox = (W - AW * sc) / 2; oy = topo + (H - topo - base - AH * sc) / 2;
  }
  const a2s = (x, y) => [ox + x * sc, oy + y * sc];
  const s2a = (x, y) => [(x - ox) / sc, (y - oy) / sc];

  function abrir() {
    if (!el) montar();
    el.hidden = false; window.bossAberto = true; medir(); lobby();
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function fechar() { el.hidden = true; window.bossAberto = false; cancelAnimationFrame(raf); R = null; }

  /* ---------------- covil (entre lutas) ---------------- */
  function lobby() {
    R = null;
    const h = heroiDe(P.nivel), hp = heroiVida(P.nivel);
    $b('.bHab').hidden = true; $b('.bTop').hidden = true;
    const L = $b('.bLobby'); L.hidden = false;
    L.innerHTML = `<h2>☠️ Covil do Rei Sombrio</h2>
      <p class="mut">Você é o chefão. Os heróis do reino vêm te derrubar — e ficam mais espertos a cada vez.</p>
      <div class="bCard"><div class="bHero" style="--c:${h.cor}">⚔</div><div><div class="mut">Próximo desafiante</div>
        <b>${h.n} nível ${P.nivel}</b><div class="mut">❤️ ${Math.round(hp)} · reflexo ${Math.round((1 - reacao(P.nivel) / 0.5) * 100)}%</div></div></div>
      <div class="bAlmas">👻 ${P.almas} almas · 🏆 ${P.vitorias} vitórias</div>
      <div class="bUps">${UPS.map(u => `<button class="bUp" data-b="up" data-u="${u.id}" ${P.almas < upCusto(u.id) ? 'disabled' : ''}>
        <b>${u.i} ${u.n} <small>nv ${P.up[u.id]}</small></b><span>${u.d}</span><em>👻 ${upCusto(u.id)}</em></button>`).join('')}</div>
      <p class="mut">Como jogar: toque na arena para andar. Use os 4 poderes embaixo. Os círculos vermelhos avisam o herói — os bons desviam!</p>
      <button class="btn bGo" data-b="lutar">⚔️ Lutar!</button>`;
  }
  function comprar(id) {
    const c = upCusto(id); if (P.almas < c) return;
    P.almas -= c; P.up[id]++; salvar(); lobby();
  }

  /* ---------------- luta ---------------- */
  const heroiVida = lv => 90 * 1.22 ** (lv - 1);
  const reacao = lv => Math.max(0.1, 0.45 - 0.035 * (lv - 1)); // segundos para perceber o perigo
  function lutar() {
    const lv = P.nivel, h = heroiDe(lv), bv = 320 * (1 + 0.15 * P.up.vida);
    R = {
      t: 0, fim: null, lv,
      boss: { x: AW / 2, y: 38, r: 10, hp: bv, max: bv, alvo: null, flash: 0, carga: 0, fala: null },
      heroi: { x: AW / 2, y: AH - 18, r: 4.2, hp: heroiVida(lv), max: heroiVida(lv), cls: h, spd: 26 + lv * 1.2,
        dano: 7 * 1.17 ** (lv - 1), atk: 0, dash: 0, dashT: 0, cura: 6, orb: Math.random() * 6, flash: 0, fala: null, vx: 0, vy: 0, visto: new Map() },
      cap: [], proj: [], zonas: [], part: [], txt: [], cd: HAB.map(() => 0),
    };
    falar(R.heroi, h.fala[0], 2.5);
    $b('.bLobby').hidden = true; $b('.bHab').hidden = false; $b('.bTop').hidden = false;
    $b('.bBar.heroi span').textContent = `${h.n} nv ${lv}`;
  }
  const mulDano = () => 1 + 0.12 * P.up.forca;
  const mulCd = () => Math.max(0.4, 1 - 0.07 * P.up.rapidez);
  function falar(q, txt, t = 2) { q.fala = { txt, t }; }

  function usar(i) {
    if (!R || R.fim || R.cd[i] > 0) return;
    const b = R.boss, h = R.heroi, id = HAB[i].id;
    R.cd[i] = HAB[i].cd * mulCd();
    if (Math.random() < 0.3) falar(b, XINGA[Math.floor(Math.random() * XINGA.length)], 1.6);
    if (id === 'pisao') { b.carga = 0.55; R.zonas.push({ x: b.x, y: b.y, r: 22, t: 0, delay: 0.55, dano: 24, tipo: 'pisao', segue: true }); }
    if (id === 'fogo') {
      // mira onde o herói vai estar
      const d = Math.hypot(h.x - b.x, h.y - b.y), tv = d / 55;
      const px = h.x + h.vx * tv * 0.8, py = h.y + h.vy * tv * 0.8, a = Math.atan2(py - b.y, px - b.x);
      for (const off of [-0.22, 0, 0.22]) R.proj.push({ x: b.x, y: b.y + 2, vx: Math.cos(a + off) * 55, vy: Math.sin(a + off) * 55, r: 2.6, dano: 11, dono: 'boss', ttl: 3, nasce: R.t });
    }
    if (id === 'capangas') for (let k = 0; k < 2 + P.up.capangas; k++) {
      const a = Math.random() * 6.28;
      R.cap.push({ x: b.x + Math.cos(a) * 14, y: b.y + Math.sin(a) * 10 + 6, r: 2.4, hp: 14 + R.lv * 2, max: 14 + R.lv * 2, atk: 0, flash: 0 });
      poeira(b.x + Math.cos(a) * 14, b.y + Math.sin(a) * 10 + 6, '#7ad46a', 10);
    }
    if (id === 'meteoro') for (let k = 0; k < 5; k++) {
      const a = Math.random() * 6.28, dd = k ? 6 + Math.random() * 12 : 0;
      R.zonas.push({ x: clamp(h.x + Math.cos(a) * dd, 4, AW - 4), y: clamp(h.y + Math.sin(a) * dd, 4, AH - 4), r: 8, t: 0, delay: 0.9 + k * 0.18, dano: 16, tipo: 'meteoro' });
    }
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function dano(q, v, cor) {
    if (q === R.heroi && q.dashT > 0) { R.txt.push({ x: q.x, y: q.y - 6, s: 'desviou!', cor: '#9fe3ff', t: 0 }); return; }
    if (q === R.heroi && q.cls.escudo && Math.random() < 0.25) { v *= 0.4; R.txt.push({ x: q.x, y: q.y - 9, s: 'bloqueou', cor: '#ffd76a', t: 0 }); }
    q.hp -= v; q.flash = 0.15;
    R.txt.push({ x: q.x + (Math.random() - 0.5) * 4, y: q.y - 6, s: Math.round(v), cor: cor || '#fff', t: 0 });
  }
  function poeira(x, y, cor, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 10 + Math.random() * 30; R.part.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 0.4 + Math.random() * 0.4, cor }); } }

  /* ---------------- IA do herói ---------------- */
  function pensarHeroi(dt) {
    const h = R.heroi, b = R.boss, cls = h.cls, reac = reacao(R.lv);
    let mx = 0, my = 0, perigo = 0;
    // 1) zonas de perigo que ele já percebeu
    for (const z of R.zonas) {
      if (z.t < reac) continue;
      const d = Math.hypot(h.x - z.x, h.y - z.y), falta = z.delay - z.t;
      if (d < z.r + 3) {
        const k = 1 / Math.max(0.5, d); mx += (h.x - z.x) * k * 3; my += (h.y - z.y) * k * 3; perigo++;
        if (falta < 0.35 && h.dash <= 0 && d < z.r) dash(h, h.x - z.x, h.y - z.y);
      }
    }
    // 2) projéteis vindo na direção dele
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
    // 3) alvo: capanga perto ou o boss
    let alvo = b, dAlvo = Math.hypot(b.x - h.x, b.y - h.y) - b.r;
    for (const c of R.cap) { const d = Math.hypot(c.x - h.x, c.y - h.y); if (d < 12 && d < dAlvo) { alvo = c; dAlvo = d; } }
    // cura da maga
    if (cls.cura) { h.cura -= dt; if (h.cura <= 0 && h.hp < h.max * 0.55) { h.hp = Math.min(h.max, h.hp + h.max * 0.22); h.cura = 9; poeira(h.x, h.y, '#b8f0ff', 14); falar(h, 'Cura!', 1.2); } }
    if (!perigo) {
      const ax = alvo.x - h.x, ay = alvo.y - h.y, d = Math.hypot(ax, ay) || 1;
      const quer = cls.alcance + (alvo === b ? b.r : 0);
      if (d > quer) { mx += ax / d; my += ay / d; }
      else if (d < quer * 0.6 && cls.alcance > 10) { mx -= ax / d; my -= ay / d; }
      // anda em volta (não fica parado feito alvo)
      h.orb += dt * (0.6 + R.lv * 0.05);
      mx += -ay / d * 0.6 * Math.sin(h.orb); my += ax / d * 0.6 * Math.sin(h.orb);
      // ataque
      h.atk -= dt;
      if (h.atk <= 0 && d <= quer + 2) {
        if (cls.alcance > 10) {
          const v = cls.arma === 'arco' ? 80 : 60, a = Math.atan2(alvo.y - h.y, alvo.x - h.x);
          R.proj.push({ x: h.x, y: h.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: cls.arma === 'arco' ? 1.2 : 2, dano: h.dano * (cls.arma === 'arco' ? 0.75 : 0.95), dono: 'heroi', ttl: 1.5, magia: cls.arma === 'magia' });
          h.atk = cls.arma === 'arco' ? 0.7 : 1.1;
        } else { dano(alvo, h.dano * (alvo === b ? 1 : 1.5), '#ffe08a'); h.atk = 0.8; h.golpe = 0.15; poeira(alvo.x, alvo.y, '#fff', 5); }
      }
    }
    h.dash -= dt; h.dashT -= dt;
    const m = Math.hypot(mx, my) || 1, spd = h.spd * (h.dashT > 0 ? 3 : 1);
    h.vx = mx / m * spd * (m > 0.05 ? 1 : 0); h.vy = my / m * spd * (m > 0.05 ? 1 : 0);
    h.x = clamp(h.x + h.vx * dt, 3, AW - 3); h.y = clamp(h.y + h.vy * dt, 3, AH - 3);
    const d = Math.hypot(h.x - b.x, h.y - b.y), min = b.r + h.r;
    if (d < min) { h.x = b.x + (h.x - b.x) / d * min; h.y = b.y + (h.y - b.y) / d * min; }
    if (Math.random() < dt * 0.08) falar(h, cls.fala[Math.floor(Math.random() * cls.fala.length)], 1.8);
  }
  function dash(h, dx, dy) { const m = Math.hypot(dx, dy) || 1; h.dash = Math.max(1.2, 3.2 - R.lv * 0.15); h.dashT = 0.22; h.vx = dx / m; h.vy = dy / m; poeira(h.x, h.y, '#ddd', 6); }

  /* ---------------- atualização ---------------- */
  function passo(dt) {
    R.t += dt;
    const b = R.boss, h = R.heroi;
    for (let i = 0; i < R.cd.length; i++) R.cd[i] = Math.max(0, R.cd[i] - dt);
    // boss anda até o toque
    if (b.alvo && b.carga <= 0) {
      const dx = b.alvo[0] - b.x, dy = b.alvo[1] - b.y, d = Math.hypot(dx, dy);
      if (d < 1) b.alvo = null; else { const v = Math.min(d, 16 * dt); b.x += dx / d * v; b.y += dy / d * v; }
    }
    b.carga -= dt; b.flash -= dt;
    // contato com o corpo do boss machuca
    if (Math.hypot(h.x - b.x, h.y - b.y) < b.r + h.r + 0.5) { h.contato = (h.contato || 0) + 6 * dt * mulDano(); if (h.contato >= 5) { dano(h, h.contato, '#ff8a6a'); h.contato = 0; } }
    if (!R.fim) pensarHeroi(dt);
    h.flash -= dt; if (h.golpe) h.golpe -= dt;
    // zonas
    for (const z of R.zonas) {
      if (z.segue) { z.x = b.x; z.y = b.y; }
      z.t += dt;
      if (z.t >= z.delay && !z.foi) {
        z.foi = true;
        if (Math.hypot(h.x - z.x, h.y - z.y) < z.r + h.r) dano(h, z.dano * mulDano(), '#ff8a6a');
        shake = z.tipo === 'pisao' ? 0.35 : 0.2;
        poeira(z.x, z.y, z.tipo === 'pisao' ? '#c9a36a' : '#ff7a3a', 22);
      }
    }
    R.zonas = R.zonas.filter(z => z.t < z.delay + 0.25);
    // projéteis
    for (const p of R.proj) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.ttl -= dt;
      if (p.dono === 'boss') {
        if (Math.hypot(p.x - h.x, p.y - h.y) < p.r + h.r) { dano(h, p.dano * mulDano(), '#ff8a6a'); p.ttl = 0; poeira(p.x, p.y, '#ff7a3a', 8); }
      } else {
        if (Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r) { dano(b, p.dano, '#ffe08a'); p.ttl = 0; poeira(p.x, p.y, p.magia ? '#c9a0ff' : '#fff', 5); }
        for (const c of R.cap) if (p.ttl > 0 && Math.hypot(p.x - c.x, p.y - c.y) < p.r + c.r) { dano(c, p.dano * 1.3); p.ttl = 0; }
      }
      if (p.x < -5 || p.x > AW + 5 || p.y < -5 || p.y > AH + 5) p.ttl = 0;
    }
    R.proj = R.proj.filter(p => p.ttl > 0);
    // capangas
    for (const c of R.cap) {
      const dx = h.x - c.x, dy = h.y - c.y, d = Math.hypot(dx, dy) || 1;
      if (d > c.r + h.r) { c.x += dx / d * 20 * dt; c.y += dy / d * 20 * dt; }
      else { c.atk -= dt; if (c.atk <= 0) { dano(h, 3.5 * mulDano(), '#ff8a6a'); c.atk = 0.7; } }
      c.flash -= dt;
      if (c.hp <= 0) poeira(c.x, c.y, '#7ad46a', 10);
    }
    R.cap = R.cap.filter(c => c.hp > 0);
    for (const p of R.part) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; }
    R.part = R.part.filter(p => p.t < p.vida);
    for (const t of R.txt) t.t += dt;
    R.txt = R.txt.filter(t => t.t < 0.9);
    for (const q of [b, h]) if (q.fala) { q.fala.t -= dt; if (q.fala.t <= 0) q.fala = null; }
    shake = Math.max(0, shake - dt);
    // fim
    if (!R.fim && h.hp <= 0) terminar(true);
    if (!R.fim && b.hp <= 0) terminar(false);
  }
  function terminar(venceu) {
    const lv = R.lv, almas = venceu ? 10 * lv : 3 * lv, gemas = venceu ? 5 * lv : 0;
    R.fim = { venceu, almas, gemas, t: 0 };
    P.almas += almas;
    if (venceu) { P.nivel++; P.vitorias++; falar(R.boss, 'HAHAHAHA! Próximo!', 3); if (typeof me !== 'undefined' && me) { me.gemas += gemas; if (typeof save === 'function') save(); } }
    else { P.derrotas++; falar(R.heroi, 'O reino está salvo!', 3); }
    salvar();
    setTimeout(() => {
      if (!R || !R.fim) return;
      const L = $b('.bLobby'); L.hidden = false; $b('.bHab').hidden = true;
      L.innerHTML = `<h2>${venceu ? '🏆 Vitória do Chefão!' : '💀 Derrotado...'}</h2>
        <p>${venceu ? `${R.heroi.cls.n} nível ${lv} caiu diante de você.` : `${R.heroi.cls.n} nível ${lv} te derrubou. Fortaleça-se e tente de novo.`}</p>
        <div class="bAlmas">+👻 ${almas} almas${gemas ? ` · +💎 ${gemas} gemas no reino` : ''}</div>
        <button class="btn bGo" data-b="lobby">Voltar ao covil</button>`;
    }, 1400);
  }

  /* ---------------- desenho ---------------- */
  function circ(x, y, r) { g.beginPath(); g.arc(x, y, r, 0, 7); }
  function sombra(x, y, r) { const [sx, sy] = a2s(x, y); g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(sx, sy + r * sc * 0.2, r * sc, r * sc * 0.45, 0, 0, 7); g.fill(); }
  function chao() {
    g.fillStyle = '#120c10'; g.fillRect(0, 0, W, H);
    const [x0, y0] = a2s(0, 0), w = AW * sc, h = AH * sc, t = 10 * sc;
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    for (let i = 0; i * t < w + t; i++) for (let j = 0; j * t < h + t; j++) {
      const n = ((i * 73856093) ^ (j * 19349663)) >>> 0;
      g.fillStyle = `hsl(${20 + n % 12}, ${8 + n % 6}%, ${17 + (n >> 4) % 7}%)`;
      g.fillRect(x0 + i * t + 1, y0 + j * t + 1, t - 2, t - 2);
    }
    // rachaduras de lava
    g.strokeStyle = 'rgba(255,90,20,.35)'; g.lineWidth = 2; g.shadowColor = '#ff5a14'; g.shadowBlur = 8;
    for (let k = 0; k < 7; k++) { g.beginPath(); let x = x0 + ((k * 37) % 100) / 100 * w, y = y0 + ((k * 61) % 100) / 100 * h; g.moveTo(x, y); for (let s = 0; s < 5; s++) { x += ((k * s * 13) % 40 - 20) * sc * 0.4; y += ((k + s) * 7 % 30 - 8) * sc * 0.4; g.lineTo(x, y); } g.stroke(); }
    g.restore(); g.shadowBlur = 0;
    g.strokeStyle = '#3a2418'; g.lineWidth = 6; g.strokeRect(x0, y0, w, h);
    // tochas nos cantos
    const fl = 0.8 + Math.sin(R ? R.t * 13 : 0) * 0.1 + Math.random() * 0.1;
    for (const [x, y] of [[4, 4], [AW - 4, 4], [4, AH - 4], [AW - 4, AH - 4]]) {
      const [sx, sy] = a2s(x, y), gr = g.createRadialGradient(sx, sy, 0, sx, sy, 60 * sc / 3 * fl);
      gr.addColorStop(0, 'rgba(255,170,60,.55)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
      g.fillStyle = gr; circ(sx, sy, 60 * sc / 3 * fl); g.fill();
      g.fillStyle = '#ffcf6a'; circ(sx, sy, 1.4 * sc); g.fill();
    }
  }
  function desenharBoss(b) {
    const [sx, sy] = a2s(b.x, b.y), r = b.r * sc, bob = Math.sin(R.t * 3) * r * 0.05;
    sombra(b.x, b.y + b.r * 0.6, b.r);
    if (b.carga > 0) { g.strokeStyle = `rgba(255,60,30,${0.5 + Math.sin(R.t * 40) * 0.3})`; g.lineWidth = 3; circ(sx, sy, r * 1.25); g.stroke(); }
    // capa
    g.fillStyle = '#3a0f1a'; g.beginPath(); g.moveTo(sx - r * 1.1, sy + r * 0.9); g.quadraticCurveTo(sx, sy - r * 0.2, sx + r * 1.1, sy + r * 0.9); g.lineTo(sx + r * 0.7, sy - r * 0.2); g.lineTo(sx - r * 0.7, sy - r * 0.2); g.closePath(); g.fill();
    // corpo
    const gr = g.createLinearGradient(sx, sy - r, sx, sy + r);
    gr.addColorStop(0, b.flash > 0 ? '#fff' : '#5a4a6e'); gr.addColorStop(1, b.flash > 0 ? '#fdd' : '#22182c');
    g.fillStyle = gr; g.beginPath(); g.ellipse(sx, sy + bob, r * 0.85, r, 0, 0, 7); g.fill();
    g.strokeStyle = '#140c18'; g.lineWidth = 2; g.stroke();
    // ombreiras
    g.fillStyle = '#2a2233'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(sx + s * r * 0.8, sy - r * 0.35 + bob, r * 0.38, r * 0.28, 0, 0, 7); g.fill(); g.fillStyle = '#b0a0c0'; for (const k of [0, 1, 2]) { g.beginPath(); g.moveTo(sx + s * r * (0.6 + k * 0.15), sy - r * 0.55 + bob); g.lineTo(sx + s * r * (0.66 + k * 0.15), sy - r * 0.85 + bob); g.lineTo(sx + s * r * (0.72 + k * 0.15), sy - r * 0.55 + bob); g.fill(); } g.fillStyle = '#2a2233'; }
    // cabeça com chifres e coroa
    const hy = sy - r * 0.95 + bob;
    g.fillStyle = '#1a1220'; g.beginPath(); g.ellipse(sx, hy, r * 0.42, r * 0.38, 0, 0, 7); g.fill();
    g.fillStyle = '#d8ccb0'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(sx + s * r * 0.3, hy - r * 0.15); g.quadraticCurveTo(sx + s * r * 0.75, hy - r * 0.4, sx + s * r * 0.62, hy - r * 0.85); g.quadraticCurveTo(sx + s * r * 0.55, hy - r * 0.35, sx + s * r * 0.2, hy - r * 0.28); g.fill(); }
    g.fillStyle = '#f2c94c'; g.beginPath(); g.moveTo(sx - r * 0.28, hy - r * 0.3); for (let k = 0; k <= 4; k++) g.lineTo(sx - r * 0.28 + k * r * 0.14, hy - r * (k % 2 ? 0.42 : 0.62)); g.lineTo(sx + r * 0.28, hy - r * 0.3); g.fill();
    g.shadowColor = '#ff2a1a'; g.shadowBlur = 10; g.fillStyle = '#ff3a2a';
    for (const s of [-1, 1]) { circ(sx + s * r * 0.15, hy, r * 0.07); g.fill(); }
    g.shadowBlur = 0;
  }
  function desenharHeroi(h) {
    const [sx, sy] = a2s(h.x, h.y), r = h.r * sc, passo = Math.sin(R.t * 14) * (Math.hypot(h.vx, h.vy) > 1 ? 1 : 0);
    sombra(h.x, h.y + h.r * 0.8, h.r * 0.9);
    if (h.dashT > 0) { g.globalAlpha = 0.35; g.fillStyle = h.cls.cor; circ(sx - h.vx * 0.04 * sc, sy - h.vy * 0.04 * sc, r); g.fill(); g.globalAlpha = 1; }
    g.fillStyle = h.flash > 0 ? '#fff' : h.cls.cor;
    g.beginPath(); g.ellipse(sx, sy + passo, r * 0.75, r, 0, 0, 7); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#f0c9a0'; circ(sx, sy - r * 1.1 + passo, r * 0.5); g.fill();
    g.fillStyle = '#c0c8d8'; g.beginPath(); g.arc(sx, sy - r * 1.2 + passo, r * 0.52, Math.PI, 0); g.fill();
    // arma
    const a = Math.atan2(R.boss.y - h.y, R.boss.x - h.x) + (h.golpe > 0 ? -0.9 : 0);
    g.strokeStyle = h.cls.arma === 'arco' ? '#8a5a2b' : h.cls.arma === 'magia' ? '#c9a0ff' : '#e8eef8'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a) * r * 2, sy + Math.sin(a) * r * 2); g.stroke();
    if (h.cls.escudo) { g.fillStyle = '#e9c25a'; g.beginPath(); g.ellipse(sx - Math.cos(a) * r * 0.2 + Math.sin(a) * r * 0.8, sy - Math.cos(a) * r * 0.8, r * 0.45, r * 0.6, 0, 0, 7); g.fill(); }
  }
  function balao(q, txt) {
    const [sx, sy] = a2s(q.x, q.y - (q === R.boss ? q.r * 2.2 : 8));
    g.font = `700 ${13}px system-ui`; const w = g.measureText(txt).width + 14;
    g.fillStyle = 'rgba(255,250,240,.95)'; g.beginPath(); g.roundRect ? g.roundRect(sx - w / 2, sy - 24, w, 22, 8) : g.rect(sx - w / 2, sy - 24, w, 22); g.fill();
    g.fillStyle = '#2a1a0a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, sx, sy - 13);
  }
  function desenhar() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (shake > 0) g.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);
    chao();
    if (!R) return;
    for (const z of R.zonas) {
      const [sx, sy] = a2s(z.x, z.y), r = z.r * sc, p = Math.min(1, z.t / z.delay);
      if (z.foi) { g.fillStyle = `rgba(255,140,40,${0.5 - (z.t - z.delay) * 2})`; circ(sx, sy, r); g.fill(); continue; }
      g.fillStyle = 'rgba(255,40,20,.18)'; circ(sx, sy, r); g.fill();
      g.strokeStyle = 'rgba(255,60,30,.8)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(255,40,20,.35)'; circ(sx, sy, r * p); g.fill();
    }
    const ents = [R.boss, R.heroi, ...R.cap].sort((a, b) => a.y - b.y);
    for (const q of ents) {
      if (q === R.boss) desenharBoss(q);
      else if (q === R.heroi) { if (q.hp > 0) desenharHeroi(q); }
      else {
        const [sx, sy] = a2s(q.x, q.y), r = q.r * sc; sombra(q.x, q.y + q.r * 0.7, q.r);
        g.fillStyle = q.flash > 0 ? '#fff' : '#4f8a3a'; circ(sx, sy, r); g.fill();
        g.fillStyle = '#ff3a2a'; circ(sx - r * 0.3, sy - r * 0.2, r * 0.15); circ(sx + r * 0.3, sy - r * 0.2, r * 0.15); g.fill();
        g.fillStyle = '#2a1a0a'; g.fillRect(sx - r, sy - r * 1.5, r * 2, 3); g.fillStyle = '#7ad46a'; g.fillRect(sx - r, sy - r * 1.5, r * 2 * q.hp / q.max, 3);
      }
    }
    for (const p of R.proj) {
      const [sx, sy] = a2s(p.x, p.y);
      if (p.dono === 'boss') { const gr = g.createRadialGradient(sx, sy, 0, sx, sy, p.r * sc * 1.8); gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.4, '#ff8a2a'); gr.addColorStop(1, 'rgba(255,60,10,0)'); g.fillStyle = gr; circ(sx, sy, p.r * sc * 1.8); g.fill(); }
      else if (p.magia) { g.fillStyle = '#c9a0ff'; g.shadowColor = '#a070ff'; g.shadowBlur = 10; circ(sx, sy, p.r * sc); g.fill(); g.shadowBlur = 0; }
      else { const m = Math.hypot(p.vx, p.vy); g.strokeStyle = '#f1e6d0'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - p.vx / m * 4 * sc, sy - p.vy / m * 4 * sc); g.stroke(); }
    }
    for (const p of R.part) { const [sx, sy] = a2s(p.x, p.y); g.globalAlpha = 1 - p.t / p.vida; g.fillStyle = p.cor; g.fillRect(sx - 2, sy - 2, 4, 4); }
    g.globalAlpha = 1;
    for (const t of R.txt) { const [sx, sy] = a2s(t.x, t.y - t.t * 8); g.globalAlpha = 1 - t.t / 0.9; g.font = '800 16px system-ui'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(t.s, sx, sy); g.fillStyle = t.cor; g.fillText(t.s, sx, sy); }
    g.globalAlpha = 1;
    for (const q of [R.boss, R.heroi]) if (q.fala) balao(q, q.fala.txt);
  }
  function hud() {
    if (!R) return;
    const b = R.boss, h = R.heroi;
    $b('.bBar.boss i').style.width = Math.max(0, b.hp / b.max * 100) + '%';
    $b('.bBar.boss b').textContent = `${Math.max(0, Math.ceil(b.hp))}/${Math.round(b.max)}`;
    $b('.bBar.heroi i').style.width = Math.max(0, h.hp / h.max * 100) + '%';
    $b('.bBar.heroi b').textContent = `${Math.max(0, Math.ceil(h.hp))}`;
    el.querySelectorAll('.hb').forEach((btn, i) => {
      const c = R.cd[i], tot = HAB[i].cd * mulCd();
      btn.style.setProperty('--p', c > 0 ? (c / tot * 360) + 'deg' : '0deg');
      btn.querySelector('em').textContent = c > 0 ? Math.ceil(c) : '';
      btn.disabled = c > 0 || !!R.fim;
    });
  }
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (R && !R.fim) passo(dt); else if (R) { R.t += dt; for (const p of R.part) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; } }
    desenhar(); hud();
    raf = requestAnimationFrame(loop);
  }
  return { abrir, fechar, P };
})();
