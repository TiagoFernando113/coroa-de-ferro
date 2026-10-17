// Tropas da ponte: soldados instanciados em partes (corpo, pernas, braço com espada) para andar e lutar,
// e os que caem saem voando (boneco inteiro girando) antes de sumir.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as C from './cena.js';

const ESC = 1.3, MAXU = 900, MAXV = 320;
const pinta = (g, c) => {
  const k = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = k.r; a[i * 3 + 1] = k.g; a[i * 3 + 2] = k.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g;
};
// alturas (antes da escala): quadril 0.62, ombro 1.28
const QUADRIL = 0.62, OMBRO = 1.28, OMBRO_X = 0.43;
// tipos: az (espadachim), arco, lanca, mago — azuis; vm — orc
export const TIPOS = ['az', 'arco', 'lanca', 'mago', 'vm'];
function pecas(t) {
  const azul = t !== 'vm';
  const ROUPA = { az: [0x2f74e0, 0x1a3f9a], arco: [0x3aa84a, 0x1e5a24], lanca: [0x8a96a8, 0x3a4250], mago: [0x8a4ae0, 0x3e1a7a], vm: [0xc8302a, 0x6a1410] };
  const pele = azul ? 0xf3c9a0 : 0x7ab84a, [roupa, escura] = ROUPA[t], metal = azul ? 0x8fb4f0 : 0x5a5050;
  const corpo = [
    pinta(new THREE.CylinderGeometry(0.33, 0.4, 0.72, 8).translate(0, 0.98, 0), roupa),                 // tronco
    pinta(new THREE.CylinderGeometry(0.41, 0.41, 0.12, 8).translate(0, 0.66, 0), 0x5a3a1a),              // cinto
    pinta(new THREE.SphereGeometry(0.3, 8, 6).translate(0, 1.58, 0), pele),                              // cabeça
    pinta(new THREE.CylinderGeometry(0.22, t === 'mago' ? 0.5 : 0.42, t === 'mago' ? 0.7 : 0.5, 8).translate(0, t === 'mago' ? 0.5 : 0.67, 0).scale(1, 1, 0.9), escura), // saia / manto
    pinta(new THREE.CylinderGeometry(0.13, 0.13, 0.45, 6).rotateZ(0.25).translate(-OMBRO_X, 1.08, 0.12), roupa), // outro braço
  ];
  if (t === 'az' || t === 'vm') corpo.push( // escudo redondo
    pinta(new THREE.CylinderGeometry(0.4, 0.4, 0.09, 9).rotateX(Math.PI / 2).translate(-0.42, 1.0, 0.3), escura),
    pinta(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10).rotateX(Math.PI / 2).translate(-0.42, 1.0, 0.36), azul ? 0xffd23a : 0x2a2a2a));
  if (t === 'lanca') corpo.push( // escudo grande retangular
    pinta(new THREE.BoxGeometry(0.62, 0.95, 0.1).translate(-0.42, 1.0, 0.34), 0xd8dde6),
    pinta(new THREE.BoxGeometry(0.5, 0.12, 0.12).translate(-0.42, 1.05, 0.38), 0x2f74e0));
  if (t === 'arco') corpo.push(pinta(new THREE.BoxGeometry(0.22, 0.6, 0.22).rotateX(0.3).translate(0.1, 1.15, -0.32), 0x7a4a20)); // aljava
  if (t === 'az') corpo.push( // elmo de cavaleiro com penacho
    pinta(new THREE.SphereGeometry(0.33, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.62, 0), metal),
    pinta(new THREE.BoxGeometry(0.08, 0.2, 0.36).translate(0, 1.96, -0.04), 0xffd23a),
    pinta(new THREE.BoxGeometry(0.42, 0.05, 0.05).translate(0, 1.6, 0.29), 0x3a3f45));
  if (t === 'arco') corpo.push(pinta(new THREE.ConeGeometry(0.36, 0.55, 8).translate(0, 1.88, -0.04), escura)); // capuz
  if (t === 'lanca') corpo.push( // elmo fechado
    pinta(new THREE.CylinderGeometry(0.34, 0.34, 0.42, 10).translate(0, 1.66, 0), 0xc8ccd2),
    pinta(new THREE.BoxGeometry(0.4, 0.05, 0.06).translate(0, 1.62, 0.32), 0x2a2a2a),
    pinta(new THREE.ConeGeometry(0.1, 0.25, 6).translate(0, 2.0, 0), 0x2f74e0));
  if (t === 'mago') corpo.push( // chapéu pontudo com aba
    pinta(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 12).translate(0, 1.78, 0), escura),
    pinta(new THREE.ConeGeometry(0.3, 0.8, 10).rotateX(-0.15).translate(0, 2.18, -0.05), roupa),
    pinta(new THREE.CylinderGeometry(0.31, 0.31, 0.08, 10).translate(0, 1.84, 0), 0xffd23a));
  if (t === 'vm') corpo.push( // orc: capacete com chifres e presas
    pinta(new THREE.SphereGeometry(0.33, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.64, 0), 0x3a2a22),
    pinta(new THREE.ConeGeometry(0.08, 0.36, 6).rotateZ(-0.9).translate(0.36, 1.9, 0), 0xf0e6d0),
    pinta(new THREE.ConeGeometry(0.08, 0.36, 6).rotateZ(0.9).translate(-0.36, 1.9, 0), 0xf0e6d0),
    pinta(new THREE.ConeGeometry(0.04, 0.12, 4).translate(0.1, 1.5, 0.27), 0xffffff),
    pinta(new THREE.ConeGeometry(0.04, 0.12, 4).translate(-0.1, 1.5, 0.27), 0xffffff));
  // perna com pivô no quadril, bota no pé
  const perna = mergeGeometries([pinta(new THREE.BoxGeometry(0.2, 0.5, 0.22).translate(0, -0.25, 0), escura), pinta(new THREE.BoxGeometry(0.23, 0.14, 0.32).translate(0, -0.55, 0.05), 0x3a2414)]);
  // braço com pivô no ombro e a arma de cada tipo apontando para a frente
  const mao = [pinta(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 6).translate(0, -0.25, 0), roupa), pinta(new THREE.SphereGeometry(0.12, 6, 5).translate(0, -0.52, 0), pele)];
  const ARMA = {
    az: () => [pinta(new THREE.BoxGeometry(0.3, 0.06, 0.08).translate(0, -0.55, 0.1), 0x8a5a2b), pinta(new THREE.BoxGeometry(0.07, 0.05, 1.0).translate(0, -0.55, 0.62), 0xd8dde6)],
    vm: () => ARMA.az(),
    arco: () => [pinta(new THREE.TorusGeometry(0.55, 0.04, 4, 12, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, -0.55, 0.15), 0x8a5a2b),
      pinta(new THREE.BoxGeometry(0.02, 1.1, 0.02).translate(0, -0.55, 0.15), 0xf0e6d0)],
    lanca: () => [pinta(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6).rotateX(Math.PI / 2).translate(0, -0.55, 0.6), 0x8a5a2b),
      pinta(new THREE.ConeGeometry(0.11, 0.35, 6).rotateX(Math.PI / 2).translate(0, -0.55, 1.85), 0xd8dde6)],
    mago: () => [pinta(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 6).translate(0, -0.25, 0.12), 0x6a3a1a),
      pinta(new THREE.SphereGeometry(0.17, 10, 8).translate(0, 0.65, 0.12), 0x7ae0ff)],
  };
  const braco = mergeGeometries([...mao, ...ARMA[t]()]);
  const geoCorpo = mergeGeometries(corpo);
  // boneco inteiro (para os que saem voando), centrado na cintura
  const m = new THREE.Matrix4();
  const inteiro = mergeGeometries([geoCorpo.clone(),
    perna.clone().applyMatrix4(m.makeTranslation(-0.15, QUADRIL, 0)), perna.clone().applyMatrix4(m.makeTranslation(0.15, QUADRIL, 0)),
    braco.clone().applyMatrix4(m.makeTranslation(OMBRO_X, OMBRO, 0))]).translate(0, -0.9, 0);
  for (const g of [geoCorpo, perna, braco, inteiro]) g.scale(ESC, ESC, ESC);
  return { corpo: geoCorpo, perna, braco, inteiro };
}

let cena, T = {};
const voando = [];
export function criarTropas(c) {
  cena = c; const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  for (const t of TIPOS) {
    const g = pecas(t), mk = (geo, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.castShadow = C.qualidadeAtual() === 'alta'; m.frustumCulled = false; /* sombra de centenas de soldados pesa: só no gráfico Bonito */ cena.add(m); return m; };
    const n = t === 'az' || t === 'vm' ? MAXU : 400, nv = t === 'az' || t === 'vm' ? MAXV : 120;
    T[t] = { corpo: mk(g.corpo, n), pe: mk(g.perna, n), pd: mk(g.perna, n), braco: mk(g.braco, n), voo: mk(g.inteiro, nv), max: n, maxV: nv };
  }
}
const base = new THREE.Matrix4(), m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1);
// lista: unidades {x, z, ph, luta, tipo}; rotY: para onde olham. Azuis são separados pelo tipo.
const cont = {};
export function desenharTropas(t, lista, rotY, tempo) {
  const leve = C.qualidadeAtual() === 'baixa'; // Leve: desenha até 140 de cada tipo (o contador continua mostrando todos)
  const tipos = t === 'vm' ? ['vm'] : ['az', 'arco', 'lanca', 'mago'];
  for (const k of tipos) cont[k] = 0;
  for (const u of lista) {
    const k = t === 'vm' ? 'vm' : u.tipo || 'az', M = T[k], i = cont[k];
    if (i >= (leve ? Math.min(M.max, 140) : M.max)) continue; cont[k]++;
    const fase = tempo * 9 + u.ph, luta = u.luta, pulo = luta ? 0 : Math.abs(Math.sin(fase)) * 0.18;
    e.set(luta ? 0.12 : 0.06, (u.ry ?? rotY) + (luta ? Math.sin(tempo * 20 + u.ph) * 0.15 : 0), 0); q.setFromEuler(e);
    base.compose(v3.set(u.x, pulo, u.z), q, s3); M.corpo.setMatrixAt(i, base);
    const passo = luta ? 0.15 : Math.sin(fase) * 0.75;
    m1.makeTranslation(-0.15 * ESC, QUADRIL * ESC, 0).multiply(m2.makeRotationX(passo)); M.pe.setMatrixAt(i, m1.premultiply(base));
    m1.makeTranslation(0.15 * ESC, QUADRIL * ESC, 0).multiply(m2.makeRotationX(-passo)); M.pd.setMatrixAt(i, m1.premultiply(base));
    const atira = u.tiroT > 0, golpe = atira ? -1.45 : luta ? -1.2 + Math.sin(tempo * 18 + u.ph) * 1.1 : u.tipo === 'mago' ? -0.1 : -0.25 + Math.sin(fase) * 0.3; // luta: espadada; arco: mira
    m1.makeTranslation(OMBRO_X * ESC, OMBRO * ESC, 0).multiply(m2.makeRotationX(golpe)); M.braco.setMatrixAt(i, m1.premultiply(base));
  }
  for (const k of tipos) { const M = T[k]; for (const p of ['corpo', 'pe', 'pd', 'braco']) { M[p].count = cont[k]; M[p].instanceMatrix.needsUpdate = true; } }
}
// soldado derrubado: sai voando girando e some
export function voar(t, x, z, vx, vy, vz) {
  if (voando.length >= (C.qualidadeAtual() === 'baixa' ? 60 : MAXV * 2)) return;
  voando.push({ t, x, y: 0.9, z, vx, vy, vz, rx: Math.random() * 6, rz: Math.random() * 6, gx: (Math.random() - 0.5) * 16, gz: (Math.random() - 0.5) * 16, vida: 0, chao: false });
}
export function passoVoo(dt) {
  const n = {}; for (const k of TIPOS) n[k] = 0;
  for (const p of voando) {
    p.vida += dt;
    if (!p.chao) { p.vy -= 30 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rx += p.gx * dt; p.rz += p.gz * dt;
      if (p.y <= 0.3 && p.vy < 0) { p.chao = true; p.y = 0.3; p.rx = Math.PI / 2 * Math.sign(Math.cos(p.rx) || 1); p.rz = 0; } }
    else p.y -= dt * 0.6; // afunda no chão
    const M = T[p.t] || T.az; if (!T[p.t]) p.t = 'az'; if (n[p.t] >= M.maxV) continue;
    e.set(p.rx, 0, p.rz); q.setFromEuler(e); m1.compose(v3.set(p.x, p.y, p.z), q, s3); M.voo.setMatrixAt(n[p.t]++, m1);
  }
  for (let i = voando.length - 1; i >= 0; i--) if (voando[i].vida > 2.2 || Math.abs(voando[i].x) > 60) voando.splice(i, 1);
  for (const t of TIPOS) { T[t].voo.count = n[t]; T[t].voo.instanceMatrix.needsUpdate = true; }
}
export function limparTropas() { voando.length = 0; for (const t of TIPOS) for (const m of Object.values(T[t])) if (m.isMesh) m.count = 0; }
