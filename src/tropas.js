// Tropas da ponte: soldados instanciados em partes (corpo, pernas, braço com espada) para andar e lutar,
// e os que caem saem voando (boneco inteiro girando) antes de sumir.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const ESC = 1.3, MAXU = 900, MAXV = 320;
const pinta = (g, c) => {
  const k = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = k.r; a[i * 3 + 1] = k.g; a[i * 3 + 2] = k.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g;
};
// alturas (antes da escala): quadril 0.62, ombro 1.28
const QUADRIL = 0.62, OMBRO = 1.28, OMBRO_X = 0.43;
function pecas(t) {
  const azul = t === 'az';
  const pele = azul ? 0xf3c9a0 : 0x7ab84a, roupa = azul ? 0x2f74e0 : 0xc8302a, escura = azul ? 0x1a3f9a : 0x6a1410, metal = azul ? 0x8fb4f0 : 0x5a5050;
  const corpo = [
    pinta(new THREE.CylinderGeometry(0.33, 0.4, 0.72, 8).translate(0, 0.98, 0), roupa),                 // tronco
    pinta(new THREE.CylinderGeometry(0.41, 0.41, 0.12, 8).translate(0, 0.66, 0), 0x5a3a1a),              // cinto
    pinta(new THREE.SphereGeometry(0.3, 10, 8).translate(0, 1.58, 0), pele),                              // cabeça
    pinta(new THREE.CylinderGeometry(0.22, 0.42, 0.5, 8).translate(0, 0.42 + 0.25, 0).scale(1, 1, 0.9), escura), // saia da túnica
    pinta(new THREE.CylinderGeometry(0.13, 0.13, 0.45, 6).rotateZ(0.25).translate(-OMBRO_X, 1.08, 0.12), roupa), // braço do escudo
    pinta(new THREE.CylinderGeometry(0.4, 0.4, 0.09, 12).rotateX(Math.PI / 2).translate(-0.42, 1.0, 0.3), escura), // escudo
    pinta(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10).rotateX(Math.PI / 2).translate(-0.42, 1.0, 0.36), azul ? 0xffd23a : 0x2a2a2a), // bossa
  ];
  if (azul) corpo.push( // elmo de cavaleiro com penacho
    pinta(new THREE.SphereGeometry(0.33, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.62, 0), metal),
    pinta(new THREE.BoxGeometry(0.08, 0.2, 0.36).translate(0, 1.96, -0.04), 0xffd23a),
    pinta(new THREE.BoxGeometry(0.42, 0.05, 0.05).translate(0, 1.6, 0.29), 0x3a3f45));
  else corpo.push( // orc: capacete com chifres e presas
    pinta(new THREE.SphereGeometry(0.33, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.64, 0), 0x3a2a22),
    pinta(new THREE.ConeGeometry(0.08, 0.36, 6).rotateZ(-0.9).translate(0.36, 1.9, 0), 0xf0e6d0),
    pinta(new THREE.ConeGeometry(0.08, 0.36, 6).rotateZ(0.9).translate(-0.36, 1.9, 0), 0xf0e6d0),
    pinta(new THREE.ConeGeometry(0.04, 0.12, 4).translate(0.1, 1.5, 0.27), 0xffffff),
    pinta(new THREE.ConeGeometry(0.04, 0.12, 4).translate(-0.1, 1.5, 0.27), 0xffffff));
  // perna com pivô no quadril, bota no pé
  const perna = mergeGeometries([pinta(new THREE.BoxGeometry(0.2, 0.5, 0.22).translate(0, -0.25, 0), escura), pinta(new THREE.BoxGeometry(0.23, 0.14, 0.32).translate(0, -0.55, 0.05), 0x3a2414)]);
  // braço da espada com pivô no ombro; a espada aponta para a frente
  const braco = mergeGeometries([
    pinta(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 6).translate(0, -0.25, 0), roupa),
    pinta(new THREE.SphereGeometry(0.12, 6, 5).translate(0, -0.52, 0), pele),
    pinta(new THREE.BoxGeometry(0.3, 0.06, 0.08).translate(0, -0.55, 0.1), 0x8a5a2b),
    pinta(new THREE.BoxGeometry(0.07, 0.05, 1.0).translate(0, -0.55, 0.62), 0xd8dde6),
  ]);
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
  for (const t of ['az', 'vm']) {
    const g = pecas(t), mk = (geo, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.castShadow = true; m.frustumCulled = false; cena.add(m); return m; };
    T[t] = { corpo: mk(g.corpo, MAXU), pe: mk(g.perna, MAXU), pd: mk(g.perna, MAXU), braco: mk(g.braco, MAXU), voo: mk(g.inteiro, MAXV) };
  }
}
const base = new THREE.Matrix4(), m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1);
// lista: unidades {x, z, ph, luta}; rotY: para onde olham
export function desenharTropas(t, lista, rotY, tempo) {
  const M = T[t]; let i = 0;
  for (const u of lista) {
    if (i >= MAXU) break;
    const fase = tempo * 9 + u.ph, luta = u.luta, pulo = luta ? 0 : Math.abs(Math.sin(fase)) * 0.18;
    e.set(luta ? 0.12 : 0.06, rotY + (luta ? Math.sin(tempo * 20 + u.ph) * 0.15 : 0), 0); q.setFromEuler(e);
    base.compose(v3.set(u.x, pulo, u.z), q, s3); M.corpo.setMatrixAt(i, base);
    const passo = luta ? 0.15 : Math.sin(fase) * 0.75;
    m1.makeTranslation(-0.15 * ESC, QUADRIL * ESC, 0).multiply(m2.makeRotationX(passo)); M.pe.setMatrixAt(i, m1.premultiply(base));
    m1.makeTranslation(0.15 * ESC, QUADRIL * ESC, 0).multiply(m2.makeRotationX(-passo)); M.pd.setMatrixAt(i, m1.premultiply(base));
    const golpe = luta ? -1.2 + Math.sin(tempo * 18 + u.ph) * 1.1 : -0.25 + Math.sin(fase) * 0.3; // luta: espadada; marcha: balança
    m1.makeTranslation(OMBRO_X * ESC, OMBRO * ESC, 0).multiply(m2.makeRotationX(golpe)); M.braco.setMatrixAt(i, m1.premultiply(base));
    i++;
  }
  for (const k of ['corpo', 'pe', 'pd', 'braco']) { M[k].count = i; M[k].instanceMatrix.needsUpdate = true; }
}
// soldado derrubado: sai voando girando e some
export function voar(t, x, z, vx, vy, vz) {
  if (voando.length >= MAXV * 2) return;
  voando.push({ t, x, y: 0.9, z, vx, vy, vz, rx: Math.random() * 6, rz: Math.random() * 6, gx: (Math.random() - 0.5) * 16, gz: (Math.random() - 0.5) * 16, vida: 0, chao: false });
}
export function passoVoo(dt) {
  const n = { az: 0, vm: 0 };
  for (const p of voando) {
    p.vida += dt;
    if (!p.chao) { p.vy -= 30 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rx += p.gx * dt; p.rz += p.gz * dt;
      if (p.y <= 0.3 && p.vy < 0) { p.chao = true; p.y = 0.3; p.rx = Math.PI / 2 * Math.sign(Math.cos(p.rx) || 1); p.rz = 0; } }
    else p.y -= dt * 0.6; // afunda no chão
    const M = T[p.t]; if (n[p.t] >= MAXV) continue;
    e.set(p.rx, 0, p.rz); q.setFromEuler(e); m1.compose(v3.set(p.x, p.y, p.z), q, s3); M.voo.setMatrixAt(n[p.t]++, m1);
  }
  for (let i = voando.length - 1; i >= 0; i--) if (voando[i].vida > 2.2 || Math.abs(voando[i].x) > 60) voando.splice(i, 1);
  for (const t of ['az', 'vm']) { T[t].voo.count = n[t]; T[t].voo.instanceMatrix.needsUpdate = true; }
}
export function limparTropas() { voando.length = 0; for (const t of ['az', 'vm']) for (const m of Object.values(T[t])) m.count = 0; }
