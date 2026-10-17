// Mapa de fases do menu: mini ilhas flutuantes (uma por fase, no tema do bioma) ligadas por pontezinhas,
// em fila para o lado. Fica no alto do céu, longe da ponte da batalha; a câmera do menu olha para cá.
// As ilhas são montadas em blocos de 10 fases, só perto da câmera, e cada bloco vira poucas malhas (leve para arrastar).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as C from './cena.js';

export const MAPA = { y: 260, z: 2500, D: 25, max: 20 }; // longe da ponte da batalha (senão ela também seria desenhada) // altura no mundo, distância entre ilhas, quantas fases à frente aparecem
let raiz = null, chave = '', atores = [], agua = null, andar = null, ilhaNova = null, heroiM = null, blocos = new Map(), dados = null;
const posIlha = n => ({ x: (n - 1) * MAPA.D, y: MAPA.y + Math.sin(n * 1.7) * 1.2, z: MAPA.z + (n % 2 ? -4.5 : 4.5) });
export const xDaFase = n => posIlha(n).x;
export const ultimaFase = () => dados ? dados.atual + MAPA.max : 1;
const GEO_TABUA = new THREE.BoxGeometry(1.05, 0.35, 3.4), MAT_TABUA = new THREE.MeshLambertMaterial({ color: 0x9a6a3a }), MAT_TABUA2 = new THREE.MeshLambertMaterial({ color: 0x7a4e26 });
const GEO_POSTE = new THREE.BoxGeometry(0.5, 2.2, 0.5), MAT_CORDA = new THREE.MeshLambertMaterial({ color: 0x5a3a1e });
const MAT_NUVEM = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }), GEO_NUVEM = new THREE.IcosahedronGeometry(1, 1);
const MAT_ILHA = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const corT = new THREE.Color();
const pintar = (g, c) => { corT.set(c); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) corT.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const semGrupos = g => { g.clearGroups(); return g; };
const meu = g => { g.userData.mapa = true; return g; }; // geometrias criadas aqui (as dos kits são compartilhadas e não podem ser apagadas)

// d = { atual, biomas, biomaDe, chefeDe(n) -> modelo, heroi (visual), heroiK, andar }
export function montarMapa(cena, d) {
  const k = `${d.atual}|${d.heroiK}`; if (raiz && k === chave) return; limparMapa(cena); chave = k; dados = d;
  raiz = new THREE.Group(); cena.add(raiz);
  agua = new THREE.Mesh(meu(new THREE.PlaneGeometry(4000, 500)), new THREE.MeshBasicMaterial({ color: 0x8adcf2 })); agua.rotation.x = -Math.PI / 2; agua.position.set(xDaFase(d.atual), MAPA.y - 16, MAPA.z - 60); raiz.add(agua);
  // herói e chefe na ilha da fase atual
  const p = posIlha(d.atual);
  if (d.heroi) { const h = C.heroi(d.heroi); h.raiz.scale.setScalar(1.7); h.raiz.position.set(p.x - 2.6, p.y + 1.3, p.z + 2.4); h.raiz.rotation.y = 0.9; h.tocar('Idle_A'); atores.push(h); heroiM = h;
    if (d.andar && d.atual > 1) { const a = posIlha(d.atual - 1); andar = { t: 0, dur: 2.6, de: { x: a.x - 2.6, y: a.y + 1.3, z: a.z + 2.4 }, para: { x: p.x - 2.6, y: p.y + 1.3, z: p.z + 2.4 }, a, p };
      h.raiz.position.set(andar.de.x, andar.de.y, andar.de.z); h.raiz.rotation.y = Math.PI / 2; h.tocar('Running_A'); } }
  const mc = d.chefeDe(d.atual); if (mc) { try { const c = C.personagem(mc, [], 1); c.raiz.scale.setScalar(3.2); c.raiz.position.set(p.x + 2.6, p.y + 1.3, p.z - 1.2); c.raiz.rotation.y = -0.9; c.tocar('Idle'); atores.push(c); } catch (e) {} }
  garantirBlocos(xDaFase(d.atual));
}
// cria os blocos de ilhas perto da câmera e apaga os longe (a fila pode ir longe sem pesar)
export function garantirBlocos(camX) {
  if (!raiz || !dados) return; const n = Math.round(camX / MAPA.D) + 1, b0 = Math.floor((n - 1) / 10);
  const quero = new Set([b0 - 1, b0, b0 + 1].filter(b => b >= 0 && b * 10 + 1 <= ultimaFase()));
  for (const [b, g] of blocos) if (!quero.has(b)) { raiz.remove(g); g.traverse(o => { if (o.geometry?.userData.mapa) o.geometry.dispose(); }); blocos.delete(b); }
  for (const b of quero) if (!blocos.has(b)) blocos.set(b, montarBloco(b));
}
function montarBloco(b) {
  const d = dados, g = new THREE.Group(); raiz.add(g); const n0 = b * 10 + 1, n1 = Math.min(b * 10 + 10, ultimaFase());
  let sd = 11 + b * 7919; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const inst = { nuvem: [], t0: [], t1: [], poste: [] }, o3 = new THREE.Object3D(), enfeites = [];
  const guardar = (l, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) => { o3.position.set(x, y, z); o3.rotation.set(0, ry, 0); o3.scale.set(sx, sy, sz); o3.updateMatrix(); l.push(o3.matrix.clone()); };
  for (let i = 0; i < 6; i++) { const cx = (n0 - 1 + r() * 10) * MAPA.D, cy = MAPA.y - 9 + r() * 4, cz = MAPA.z - 28 + r() * 46;
    for (let j = 0; j < 4; j++) guardar(inst.nuvem, cx + j * 3.2 - 5, cy + r() * 1.2, cz + r() * 2, 0, 2.2 + r() * 1.6, 1.1 + r() * 0.6, 1.8 + r()); }
  const corpos = [];
  for (let n = n0; n <= n1; n++) {
    const B = d.biomas[d.biomaDe(n)], p = posIlha(n), grande = n % 10 === 0, esc = grande ? 1.3 : 1, nova = d.andar && n === d.atual;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion(), new THREE.Vector3(esc, esc, esc)), partes = [];
    partes.push(pintar(semGrupos(new THREE.CylinderGeometry(8.6, 7.6, 2.4, 11, 1, true)), B.rocha[0]), pintar(semGrupos(new THREE.CylinderGeometry(8.8, 8.8, 0.5, 11)).translate(0, 1.05, 0), B.chao[0]),
      pintar(new THREE.CircleGeometry(8.6, 11).rotateX(-Math.PI / 2).translate(0, 1.2, 0), B.chao[0]), pintar(semGrupos(new THREE.ConeGeometry(7.6, 10, 11)).rotateX(Math.PI).translate(0, -6.2, 0), B.rocha[1]));
    for (let j = 0; j < 3; j++) { const a = r() * 6.28; partes.push(pintar(semGrupos(new THREE.ConeGeometry(1.4 + r(), 3 + r() * 3, 6)).rotateX(Math.PI).translate(Math.cos(a) * 4.5, -9 - r() * 3, Math.sin(a) * 4.5), B.rocha[0])); }
    if (B.lava) partes.push(pintar(new THREE.CircleGeometry(2.4, 12).rotateX(-Math.PI / 2).translate(-4, 1.36, -3), 0xff6a1a));
    for (const q of partes) { q.deleteAttribute('uv'); }
    // enfeites do bioma (árvores, cactos, pinheiros, pedras), longe do meio; na ilha que vai surgir, ficam presos nela
    const qtd = 4 + Math.floor(r() * 2), props = [];
    for (let j = 0; j < qtd; j++) { const lista = B.enfeites[j < 2 ? 0 : j < 3 ? 1 : 2], [mod, s] = lista[Math.floor(r() * lista.length)], a = Math.PI * (0.85 + r() * 1.3) + (j % 2 ? 0 : Math.PI * 0.15), rr = 4.6 + r() * 2.6;
      props.push({ m: mod, x: Math.cos(a) * rr, z: Math.sin(a) * rr, ry: r() * 6.28, s: s * 0.42 }); }
    if (grande) for (const l of [-1, 1]) props.push({ m: 'C:tower-square', x: l * 4.4, z: -4.6, s: 2.2 }, { m: 'C:flag', x: l * 4.4, y: 4.4, z: -4.6, s: 1.8 });
    if (nova) { // ilha que surge depois da vitória: grupo próprio para crescer
      const ig = new THREE.Group(); ig.position.set(p.x, p.y, p.z); ig.userData.esc = esc; ig.scale.setScalar(andar ? 0.01 : esc); g.add(ig); ilhaNova = ig;
      ig.add(new THREE.Mesh(meu(mergeGeometries(partes)), MAT_ILHA));
      for (const q of props) { try { const o = C.objeto(q.m, q.s); C.remover(o); o.position.set(q.x, 1.2 + (q.y || 0), q.z); o.rotation.y = q.ry || 0; ig.add(o); } catch (e) {} }
    } else { for (const q of partes) corpos.push(q.applyMatrix4(m)); for (const q of props) enfeites.push({ m: q.m, x: p.x + q.x * esc, y: p.y + (1.2 + (q.y || 0)) * esc, z: p.z + q.z * esc, ry: q.ry || 0, s: q.s * esc }); }
    // pontezinha até a próxima ilha
    if (n < ultimaFase()) { const q = posIlha(n + 1), dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, ini = 8.2 * esc, fim = len - 8.2 * ((n + 1) % 10 === 0 ? 1.3 : 1), ang = Math.atan2(dx, dz);
      const nt = Math.floor((fim - ini) / 1.3);
      for (let t = 0; t <= nt; t++) { const f = t / nt, s = ini + (fim - ini) * f; guardar(t % 2 ? inst.t0 : inst.t1, p.x + ux * s, p.y + (q.y - p.y) * (s / len) + 1 - Math.sin(Math.PI * f) * 1.3, p.z + uz * s, ang + Math.PI / 2); }
      for (const s of [ini, fim]) for (const l of [-1.6, 1.6]) guardar(inst.poste, p.x + ux * s - uz * l, p.y + (q.y - p.y) * (s / len) + 1.8, p.z + uz * s + ux * l); }
  }
  if (corpos.length) g.add(new THREE.Mesh(meu(mergeGeometries(corpos)), MAT_ILHA));
  if (enfeites.length) { const e = C.montarEstatico(enfeites); C.remover(e); e.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; meu(o.geometry); } }); g.add(e); }
  for (const [l, geo, mat] of [[inst.nuvem, GEO_NUVEM, MAT_NUVEM], [inst.t0, GEO_TABUA, MAT_TABUA], [inst.t1, GEO_TABUA, MAT_TABUA2], [inst.poste, GEO_POSTE, MAT_CORDA]]) {
    if (!l.length) continue; const im = new THREE.InstancedMesh(geo, mat, l.length); l.forEach((mm, i) => im.setMatrixAt(i, mm)); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); g.add(im); }
  return g;
}
// ilhas por perto (para as placas de fase)
export const ilhas = camX => { const out = [], n = Math.round(camX / MAPA.D) + 1; for (let i = Math.max(1, n - 4); i <= Math.min(ultimaFase(), n + 4); i++) { const p = posIlha(i); out.push({ n: i, x: p.x, y: p.y + (i % 10 === 0 ? 2 : 0), z: p.z }); } return out; };
export function mostrarMapa(v) { if (raiz) raiz.visible = v; for (const a of atores) a.raiz.visible = v; } // fora do menu fica escondido (não pesa)
export function passoMapa(dt) {
  for (const a of atores) a.mixer.update(dt);
  if (ilhaNova && andar) { const k = Math.min(1, andar.t / 0.7); ilhaNova.scale.setScalar(ilhaNova.userData.esc * (k < 1 ? 0.01 + k * 1.15 : 1.15 - Math.min(0.15, (andar.t - 0.7) * 0.6))); } // a ilha nova surge
  else if (ilhaNova) ilhaNova.scale.setScalar(ilhaNova.userData.esc);
  if (andar && heroiM) { const A = andar; A.t += dt; const f = Math.min(1, Math.max(0, (A.t - 0.5) / A.dur)), h = heroiM.raiz.position;
    h.x = A.de.x + (A.para.x - A.de.x) * f; h.z = A.de.z + (A.para.z - A.de.z) * f;
    // altura: em cima das tábuas a ponte afunda no meio
    const dx = A.p.x - A.a.x, dz = A.p.z - A.a.z, len = Math.hypot(dx, dz), s = ((h.x - A.a.x) * dx + (h.z - A.a.z) * dz) / len, ini = 8.2, fim = len - 8.2;
    const sag = s > ini && s < fim ? Math.sin(Math.PI * (s - ini) / (fim - ini)) * 1.3 - 0.15 : 0; h.y = A.de.y + (A.para.y - A.de.y) * f - sag;
    if (f >= 1) { andar = null; heroiM.raiz.rotation.y = 0.9; heroiM.tocar('Cheering', { loop: false, reinicia: true }); setTimeout(() => heroiM?.tocar('Idle_A'), 1800);
      C.faiscas(A.p.x, A.p.y + 4, A.p.z, 0xffd84a, 60, 8); C.onda(A.p.x, A.p.z, 10, 0xffd84a, 0.6); } }
}
export const andando = () => andar ? heroiM.raiz.position.x : null; // a câmera acompanha o herói enquanto ele atravessa
export function limparMapa(cena) { if (raiz) { cena.remove(raiz); raiz.traverse(o => { if (o.geometry?.userData.mapa) o.geometry.dispose(); }); raiz = null; }
  for (const a of atores) a.remover(); atores = []; chave = ''; andar = null; ilhaNova = null; heroiM = null; blocos = new Map(); }
