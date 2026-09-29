// Simula o jogo sem gráficos (cena.js trocado por um stub) com um jogador automático
// que gasta o ouro em melhorias. Serve para equilibrar as ondas: node tools/simular.mjs [ondas] [estrategia]
import { build } from 'esbuild';
import path from 'path'; import { fileURLToPath } from 'url'; import fs from 'fs';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const stub = `
const noop = () => {}; const obj = () => ({ position: { set: noop, x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { setScalar: noop, set: noop } });
export const camera = { yaw: 0, pitch: 0.7, dist: 12, tremor: 0 };
export const iniciar = noop, montarMundo = () => 0, quadro = noop, tela = () => null, info = () => ({});
export function personagem() { const raiz = obj(); return { raiz, mixer: { update: noop }, tem: () => true, tocar: noop, remover: noop, brilho: noop }; }
export const grupo = () => obj(), orbe = () => obj(), objeto = () => obj(), projetil = () => obj(), remover = noop;
export const pad = () => ({ cor: noop, pulso: noop }), arco = noop, onda = noop, aviso = () => ({}), faiscas = noop;
`;
const r = await build({
  entryPoints: [path.join(AQUI, '..', 'src', 'jogo.js')], bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'stub', setup(b) { b.onResolve({ filter: /cena\.js$/ }, () => ({ path: 'stub', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stub, loader: 'js' })); } }],
});
const arq = path.join(AQUI, '.sim.mjs'); fs.writeFileSync(arq, r.outputFiles[0].text);
globalThis.localStorage = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; }, removeItem(k) { delete this.d[k]; } };
const J = await import(arq + '?' + Date.now()); fs.unlinkSync(arq);
const D = await import(path.join(AQUI, '..', 'src', 'dados.js'));
const M = await import(path.join(AQUI, '..', 'src', 'mundo.js'));
const MAXONDAS = +(process.argv[2] || 20), EST = process.argv[3] || 'misto', DEBUG = process.env.DEBUG;
J.iniciar('cav'); const G = J.G;
G.fila.length = 0;
const ordem = EST === 'arq' ? ['arqueiros'] : EST === 'cat' ? ['catapulta', 'arqueiros'] : ['arqueiros', 'catapulta', 'magia', 'balista', 'quartel', 'arqueiros', 'catapulta', 'balista'];
function gastar() {
  for (let guarda = 0; guarda < 50; guarda++) {
    const ops = [];
    D.MURALHA.custo[G.muro.nivel] && G.muro.nivel < 8 && ops.push([D.MURALHA.custo[G.muro.nivel] * 1.6, () => J.melhorarMuro()]);
    G.mina.nivel < 8 && ops.push([D.MINA.custo[G.mina.nivel] * 0.8, () => J.melhorarMina()]);
    ['s3', 's4', 's7', 's8', 's2', 's5', 's1', 's6'].map(id => M.SLOTS.find(x => x.id === id)).forEach((s, i) => { const d = G.def[s.id]; if (!d) ops.push([D.custoDefesa(ordem[i % ordem.length], 1) * 0.6, () => J.construir(s.id, ordem[i % ordem.length])]); else if (d.nivel < 8) ops.push([D.custoDefesa(d.tipo, d.nivel + 1), () => J.melhorarDefesa(s.id)]); });
    ops.sort((a, b) => a[0] - b[0]); const [, f] = ops[0] || []; const antes = G.ouro;
    if (!f) return; f(); if (G.ouro === antes) return;
  }
}
let t = 0, derrotas = 0, ultima = 0; const dt = 0.05, log = [];
G.onda.contagem = 5;
while (G.onda.n <= MAXONDAS && t < 3600 * 3) {
  // herói fica no portão atacando
  const j = G.jog; if (j.estado !== 'morto') { const alvo = G.inim.find(e => e.estado !== 'morto' && Math.hypot(e.x - j.x, e.z - j.z) < 10); J.entrada.atacar = !!alvo; if (Math.hypot(j.x - 0, j.z + 3) > 1) { const dx = -j.x, dz = -3 - j.z, m = Math.hypot(dx, dz); J.entrada.mx = dx / m; J.entrada.mz = dz / m; } else J.entrada.mx = J.entrada.mz = 0; }
  // coleta o cofre de vez em quando
  if (G.mina.nivel && G.mina.cofre > 50) { G.ouro += Math.floor(G.mina.cofre); G.mina.cofre = 0; }
  J.passo(dt); t += dt;
  if (DEBUG && Math.round(t * 20) % 40 === 0) console.log(t.toFixed(0), G.onda.estado, 'inim', G.inim.map(e => `${e.tipo[0]}${e.estado[0]}${Math.round(e.hp)}@${e.x.toFixed(0)},${e.z.toFixed(0)}`).join(' '), 'heroi', G.jog.x.toFixed(1), G.jog.z.toFixed(1), G.jog.estado, Math.round(G.jog.hp), 'slots', Object.keys(G.def).join(','), 'proj', G.proj.length, 'muro', Math.round(G.muro.hp), 'def', Object.values(G.def).map(d => d.cd.toFixed(1)).join(','));
  if (DEBUG && t > +DEBUG) break;
  for (const e of G.fila.splice(0)) {
    if (e.tipo === 'vitoria') { log.push(`onda ${String(e.n).padStart(2)} ✅ ${Math.round(t)}s  muro ${Math.round(G.muro.hp)}/${G.muro.max} nv${G.muro.nivel}  defesas ${Object.values(G.def).map(d => d.tipo[0] + d.nivel).join(' ')}  mina ${G.mina.nivel}  ouro ${Math.round(G.ouro)} heroi nv${G.jog.nivel}`); gastar(); G.onda.contagem = 3; }
    if (e.tipo === 'derrota') { derrotas++; log.push(`onda ${String(e.n).padStart(2)} ❌ muralha caiu (${derrotas})`); gastar(); J.tentarDeNovo(); G.onda.contagem = 20; if (derrotas > 12) { t = 1e9; } }
  }
  if (G.onda.estado === 'preparo' && G.onda.contagem > 3) gastar();
}
console.log(log.join('\n')); console.log(`fim: onda ${G.onda.n}, ${Math.round(Math.min(t, 1e5) / 60)} min de jogo, ${derrotas} derrotas`);
