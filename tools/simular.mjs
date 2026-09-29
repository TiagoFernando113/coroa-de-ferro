// Simula horas de jogo da Guilda (sem gráficos) com um jogador automático razoável.
// Uso: node tools/simular.mjs [horas]  — mostra o progresso a cada 30 min de jogo.
globalThis.localStorage = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; }, removeItem(k) { delete this.d[k]; } };
const E = await import('../src/estado.js');
const D = await import('../src/dados.js');
const HORAS = +(process.argv[2] || 6);
let agora = 0; E.novo(agora); const S = E.S;
const eds = Object.keys(D.EDIFICIOS);
function jogar() {
  // missões: melhor ouro/segundo com boa chance; chefe quando der
  while (S.missoes.length < E.vagasMissao() && E.livres().length) {
    let melhor = null;
    for (const m of E.disponiveis()) {
      const eq = E.melhorEquipe(m.r, m.t); if (!eq.length) continue;
      const ch = D.chanceSucesso(E.poderEquipe(eq, m.r), m.req);
      const valor = m.chefe ? (ch >= 0.8 ? 1e99 : -1) : ch >= 0.85 ? m.ouro * ch / m.dur : -1;
      if (valor > 0 && (!melhor || valor > melhor.v)) melhor = { m, eq, v: valor };
    }
    if (!melhor) break; E.enviar(melhor.m.r, melhor.m.t, melhor.eq, agora);
  }
  for (const o of D.OBJETIVOS) E.coletarObjetivo(o.id);
  if (S.gemas >= D.GEMAS_RECRUTAR + 20) E.recrutar(true, false, agora);
  E.recrutar(false, true, agora);
  // gasta ouro: o mais barato entre prédios, recrutar e treinar o melhor herói
  for (let k = 0; k < 200; k++) {
    const ops = [];
    for (const id of eds) if (E.desbloqueado(id)) ops.push([D.custoEd(id, E.nivel(id)) * (id === 'taverna' ? 0.7 : 1), () => E.melhorar(id)]);
    if (S.herois.length < E.capacidade()) ops.push([D.custoRecrutar(S.st.recrutados) * 0.8, () => E.recrutar(false, false, agora)]);
    const top = [...S.herois].sort((a, b) => E.poder(b) - E.poder(a)).slice(0, 4);
    for (const h of top) ops.push([D.custoTreinar(h) * 1.2, () => E.treinar(h.id)]);
    ops.sort((a, b) => a[0] - b[0]); if (!ops.length || ops[0][0] > S.ouro) break; if (!ops[0][1]()) break;
  }
}
const log = [];
for (let t = 0; t <= HORAS * 3600; t++) {
  agora = t * 1000; E.passo(1, agora); E.fila.length = 0;
  if (t % 5 === 0) jogar();
  if (t % 1800 === 0) {
    const best = Math.max(...S.herois.map(h => E.poder(h)));
    log.push(`${String((t / 3600).toFixed(1)).padStart(4)}h  fama ${String(S.fama.nivel).padStart(2)}  região ${S.regiao + 1}/8  ouro/s ${D.fmt(E.renda()).padStart(6)}  ouro ${D.fmt(S.ouro).padStart(6)}  gemas ${String(S.gemas).padStart(4)}  heróis ${S.herois.length} (melhor ${D.fmt(best)})  missões ${S.st.missoes} falhas ${S.st.falhas}  prédios ${eds.map(id => E.nivel(id)).join('/')}`);
  }
}
console.log(log.join('\n'));
