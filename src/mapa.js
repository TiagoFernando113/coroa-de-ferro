// Mapa de fases do menu: mini ilhas flutuantes (uma por fase, no tema do bioma) ligadas por pontezinhas,
// em fila para o lado. Fica no alto do céu, longe da ponte da batalha; a câmera do menu olha para cá.
import * as THREE from 'three';
import * as C from './cena.js';

export const MAPA = { y: 260, z: 0, D: 25 }; // altura do mapa no mundo e distância entre ilhas
let grupo = null, chave = '', atores = [], ilhasPos = [], agua = null, andar = null, ilhaNova = null, heroiM = null;
const posIlha = n => ({ x: (n - 1) * MAPA.D, y: MAPA.y + Math.sin(n * 1.7) * 1.2, z: MAPA.z + (n % 2 ? -4.5 : 4.5) });
export const xDaFase = n => posIlha(n).x;
export const ilhas = () => ilhasPos;
const GEO_TABUA = new THREE.BoxGeometry(1.05, 0.35, 3.4), MAT_TABUA = new THREE.MeshLambertMaterial({ color: 0x9a6a3a }), MAT_TABUA2 = new THREE.MeshLambertMaterial({ color: 0x7a4e26 });
const GEO_POSTE = new THREE.BoxGeometry(0.5, 2.2, 0.5), MAT_CORDA = new THREE.MeshLambertMaterial({ color: 0x5a3a1e });

// monta (ou reaproveita) o mapa em volta da fase atual
// d = { atual, biomas, biomaDe, chefeDe(n) -> modelo, heroi (visual), texAgua }
export function montarMapa(cena, d) {
  const k = `${d.atual}|${d.heroiK}`; if (grupo && k === chave) return; limparMapa(cena); chave = k;
  grupo = new THREE.Group(); cena.add(grupo); ilhasPos = [];
  const add = m => { grupo.add(m); return m; };
  let sd = 11; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  // mar lá embaixo e nuvens
  agua = add(new THREE.Mesh(new THREE.PlaneGeometry(1600, 500), new THREE.MeshBasicMaterial({ color: 0x8adcf2 })));
  agua.rotation.x = -Math.PI / 2; agua.position.set(xDaFase(d.atual), MAPA.y - 16, MAPA.z - 60);
  const MAT_NUVEM = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }), GEO_NUVEM = new THREE.IcosahedronGeometry(1, 1);
  const n0 = Math.max(1, d.atual - 5), n1 = d.atual + 7;
  for (let i = 0; i < 14; i++) { const nv = add(new THREE.Group()); for (let j = 0; j < 4; j++) { const b = new THREE.Mesh(GEO_NUVEM, MAT_NUVEM); b.scale.set(2.2 + r() * 1.6, 1.1 + r() * 0.6, 1.8 + r()); b.position.set(j * 3.2 - 5, r() * 1.2, r() * 2); nv.add(b); }
    nv.position.set((n0 - 2 + r() * (n1 - n0 + 4)) * MAPA.D, MAPA.y - 9 + r() * 4, MAPA.z - 28 + r() * 46); }
  for (let n = n0; n <= n1; n++) {
    const B = d.biomas[d.biomaDe(n)], p = posIlha(n), g = add(new THREE.Group()), grande = n % 10 === 0; g.position.set(p.x, p.y, p.z); if (grande) g.scale.setScalar(1.3); g.userData.esc = grande ? 1.3 : 1;
    if (d.andar && n === d.atual) ilhaNova = g;
    const topoCor = new THREE.Color(B.chao[0]), lado = new THREE.MeshLambertMaterial({ color: B.rocha[0], flatShading: true });
    const topo = new THREE.MeshLambertMaterial({ color: topoCor, flatShading: true });
    const disco = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 7.6, 2.4, 11), [lado, topo, lado]); g.add(disco);
    const borda = new THREE.Mesh(new THREE.CylinderGeometry(8.8, 8.8, 0.5, 11), topo); borda.position.y = 1.05; g.add(borda);
    const baixo = new THREE.Mesh(new THREE.ConeGeometry(7.6, 10, 11), new THREE.MeshLambertMaterial({ color: B.rocha[1], flatShading: true })); baixo.rotation.x = Math.PI; baixo.position.y = -6.2; g.add(baixo);
    for (let j = 0; j < 3; j++) { const pd = new THREE.Mesh(new THREE.ConeGeometry(1.4 + r(), 3 + r() * 3, 6), lado); pd.rotation.x = Math.PI; const a = r() * 6.28; pd.position.set(Math.cos(a) * 4.5, -9 - r() * 3, Math.sin(a) * 4.5); g.add(pd); }
    if (B.lava) { const lv = new THREE.Mesh(new THREE.CircleGeometry(2.4, 12), new THREE.MeshBasicMaterial({ color: 0xff6a1a })); lv.rotation.x = -Math.PI / 2; lv.position.set(-4, 1.35, -3); g.add(lv); }
    // enfeites do bioma (árvores, cactos, pinheiros, pedras), longe do meio
    const qtd = 4 + Math.floor(r() * 3);
    for (let j = 0; j < qtd; j++) { const lista = B.enfeites[j < 2 ? 0 : j < 4 ? 1 : 2], [m, s] = lista[Math.floor(r() * lista.length)];
      const a = Math.PI * (0.85 + r() * 1.3) + (j % 2 ? 0 : Math.PI * 0.15), rr = 4.6 + r() * 2.6;
      try { const o = C.objeto(m, s * 0.42); C.remover(o); o.position.set(Math.cos(a) * rr, 1.2, Math.sin(a) * rr); o.rotation.y = r() * 6.28; g.add(o); } catch (e) {} }
    if (grande) { // ilha de chefe (a cada 10 fases): torres com bandeira atrás
      for (const l of [-1, 1]) { try { const t = C.objeto('C:tower-square', 2.2); C.remover(t); t.position.set(l * 4.4, 1.2, -4.6); g.add(t); const f = C.objeto('C:flag', 1.8); C.remover(f); f.position.set(l * 4.4, 5.6, -4.6); g.add(f); } catch (e) {} } }
    ilhasPos.push({ n, x: p.x, y: p.y + (grande ? 2 : 0), z: p.z, grande });
    // pontezinha até a próxima ilha
    if (n < n1) { const q = posIlha(n + 1), dx = q.x - p.x, dz = q.z - p.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, ini = 8.2, fim = len - 8.2, ang = Math.atan2(dx, dz);
      const nt = Math.floor((fim - ini) / 1.3);
      for (let t = 0; t <= nt; t++) { const f = t / nt, s = ini + (fim - ini) * f, tb = new THREE.Mesh(GEO_TABUA, t % 2 ? MAT_TABUA : MAT_TABUA2);
        tb.position.set(p.x + ux * s, p.y + (q.y - p.y) * (s / len) + 1 - Math.sin(Math.PI * f) * 1.3, p.z + uz * s); tb.rotation.y = ang + Math.PI / 2; add(tb); }
      for (const s of [ini, fim]) for (const l of [-1.6, 1.6]) { const pt = new THREE.Mesh(GEO_POSTE, MAT_CORDA); pt.position.set(p.x + ux * s - uz * l, p.y + (q.y - p.y) * (s / len) + 1.8, p.z + uz * s + ux * l); add(pt); } }
  }
  // herói e chefe na ilha da fase atual
  const p = posIlha(d.atual);
  if (d.heroi) { const h = C.heroi(d.heroi); h.raiz.scale.setScalar(1.7); h.raiz.position.set(p.x - 2.6, p.y + 1.3, p.z + 2.4); h.raiz.rotation.y = 0.9; h.tocar('Idle_A'); atores.push(h); heroiM = h;
    // venceu a fase anterior: o herói sai da ilha de trás e atravessa a pontezinha
    if (d.andar && d.atual > 1) { const a = posIlha(d.atual - 1); andar = { t: 0, dur: 2.6, de: { x: a.x - 2.6, y: a.y + 1.3, z: a.z + 2.4 }, para: { x: p.x - 2.6, y: p.y + 1.3, z: p.z + 2.4 }, a, p }; h.raiz.position.set(andar.de.x, andar.de.y, andar.de.z); h.raiz.rotation.y = Math.PI / 2; h.tocar('Running_A');
      if (ilhaNova) ilhaNova.scale.setScalar(0.01); } }
  const mc = d.chefeDe(d.atual); if (mc) { try { const c = C.personagem(mc, [], 1); c.raiz.scale.setScalar(3.2); c.raiz.position.set(p.x + 2.6, p.y + 1.3, p.z - 1.2); c.raiz.rotation.y = -0.9; c.tocar('Idle'); atores.push(c); } catch (e) {} }
}
export function passoMapa(dt) {
  for (const a of atores) a.mixer.update(dt);
  if (ilhaNova && andar) { const k = Math.min(1, andar.t / 0.7); ilhaNova.scale.setScalar((ilhaNova.userData.esc || 1) * (k < 1 ? 0.01 + k * 1.15 : 1.15 - Math.min(0.15, (andar.t - 0.7) * 0.6))); } // a ilha nova surge
  else if (ilhaNova && !andar) ilhaNova.scale.setScalar(ilhaNova.userData.esc || 1);
  if (andar && heroiM) { const A = andar; A.t += dt; const f = Math.min(1, Math.max(0, (A.t - 0.5) / A.dur)), h = heroiM.raiz.position;
    h.x = A.de.x + (A.para.x - A.de.x) * f; h.z = A.de.z + (A.para.z - A.de.z) * f;
    // altura: em cima das tábuas a ponte afunda no meio
    const dx = A.p.x - A.a.x, dz = A.p.z - A.a.z, len = Math.hypot(dx, dz), s = ((h.x - A.a.x) * dx + (h.z - A.a.z) * dz) / len, ini = 8.2, fim = len - 8.2;
    const sag = s > ini && s < fim ? Math.sin(Math.PI * (s - ini) / (fim - ini)) * 1.3 - 0.15 : 0; h.y = A.de.y + (A.para.y - A.de.y) * f - sag;
    if (f >= 1) { andar = null; heroiM.raiz.rotation.y = 0.9; heroiM.tocar('Cheering', { loop: false, reinicia: true }); setTimeout(() => heroiM?.tocar('Idle_A'), 1800);
      C.faiscas(A.p.x, A.p.y + 4, A.p.z, 0xffd84a, 60, 8); C.onda(A.p.x, A.p.z, 10, 0xffd84a, 0.6); } }
}
export const andando = () => andar ? heroiM.raiz.position.x : null; // a câmera acompanha o herói enquanto ele atravessa
export function limparMapa(cena) { if (grupo) { cena.remove(grupo); grupo = null; } for (const a of atores) a.remover(); atores = []; chave = ''; andar = null; ilhaNova = null; heroiM = null; }
