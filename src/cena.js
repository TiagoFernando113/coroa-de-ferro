// Renderização 3D (three.js): carrega modelos.bin, monta o mundo com a geometria
// estática fundida (poucas chamadas de desenho — importante no celular),
// personagens animados, efeitos e a câmera (orbitando um ponto que pode ser arrastado).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ORIGENS, pecasDo } from './aparencia.js';

export const ESC_PERS = 0.75; // personagens KayKit (~2,5 u) → ~1,85 m
let renderer, scene, cam, sol, hemi, relogio = 0;
const modelos = {}; // nome → gltf
const pecas = {};   // 'kit:nome' → Object3D modelo
let qualidade = 'media';

export function iniciar(canvas, q) {
  qualidade = q || 'media';
  renderer = new THREE.WebGLRenderer({ canvas, antialias: qualidade !== 'baixa', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, qualidade === 'alta' ? 2 : qualidade === 'media' ? 1.5 : 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = qualidade !== 'baixa';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  const ceu = new THREE.Color(0xa9d4f5);
  scene.background = ceu; scene.fog = new THREE.Fog(ceu, 70, 150);
  cam = new THREE.PerspectiveCamera(45, 1, 0.5, 220);
  hemi = new THREE.HemisphereLight(0xdff1ff, 0x5a7a3a, 1.35); scene.add(hemi);
  sol = new THREE.DirectionalLight(0xfff1d6, 2.4); sol.position.set(20, 40, 10);
  sol.castShadow = renderer.shadowMap.enabled;
  const tam = qualidade === 'alta' ? 2048 : 1024;
  sol.shadow.mapSize.set(tam, tam);
  Object.assign(sol.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 100 });
  sol.shadow.bias = -0.0008; sol.shadow.normalBias = 0.03;
  scene.add(sol, sol.target);
  medir();
  addEventListener('resize', medir);
}
function medir() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 50 : 40; cam.updateProjectionMatrix();
}

export async function carregar(url, progresso) {
  const resp = await fetch(url);
  const total = +resp.headers.get('content-length') || 0;
  let buf;
  if (resp.body && total && progresso) {
    const leitor = resp.body.getReader(), partes = []; let lido = 0;
    for (;;) { const { done, value } = await leitor.read(); if (done) break; partes.push(value); lido += value.length; progresso(lido / total); }
    const u8 = new Uint8Array(lido); let o = 0; for (const p of partes) { u8.set(p, o); o += p.length; } buf = u8.buffer;
  } else buf = await resp.arrayBuffer();
  const tam = new DataView(buf).getUint32(0, true);
  const cab = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, tam)));
  const base = 4 + tam, loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  await Promise.all(Object.entries(cab).map(async ([nome, [ini, len]]) => {
    modelos[nome] = await loader.parseAsync(buf.slice(base + ini, base + ini + len), '');
  }));
  // o GLTFLoader tira o ':' dos nomes ('T:wall' vira 'Twall')
  for (const no of modelos.cenario.scene.children) pecas[no.name] = no;
  // materiais: sem brilho metálico (os kits são "flat")
  for (const g of Object.values(modelos)) g.scene.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; for (const m of [].concat(o.material)) { m.metalness = 0; if (m.map) m.map.anisotropy = 4; } }
  });
}

// ---------------- mundo estático ----------------
const toF32 = a => {
  const n = a.count, s = a.itemSize, arr = new Float32Array(n * s);
  const f = [a.getX, a.getY, a.getZ, a.getW];
  for (let i = 0; i < n; i++) for (let k = 0; k < s; k++) arr[i * s + k] = f[k].call(a, i);
  return new THREE.BufferAttribute(arr, s);
};
// M = { tam, pecas:[{m,x,y,z,ry,s}], caminhos:[{w,pts}], patios:[{x0,z0,x1,z1,cor}], pracas:[{x,z,r,cor}] }
export function montarMundo(M) {
  const LIM = M.tam / 2;
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(LIM * 2 + 40, LIM * 2 + 40), new THREE.MeshLambertMaterial({ map: texturaChao(M) }));
  chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; scene.add(chao);
  const longe = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshLambertMaterial({ color: 0x4f7a34 }));
  longe.rotation.x = -Math.PI / 2; longe.position.y = -0.05; scene.add(longe);

  // funde a geometria por material
  const grupos = new Map(), tmp = new THREE.Object3D(), filhos = [];
  for (const p of M.pecas) {
    const modelo = pecas[p.m.replace(':', '')]; if (!modelo) { console.warn('peça ausente', p.m); continue; }
    tmp.position.set(p.x, p.y || 0, p.z); tmp.rotation.set(0, p.ry || 0, 0); tmp.scale.setScalar(p.s || 1); tmp.updateMatrixWorld(true);
    modelo.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(modelo.matrixWorld).invert();
    modelo.traverse(o => {
      if (!o.isMesh) return;
      const mat = new THREE.Matrix4().multiplyMatrices(tmp.matrixWorld, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      const g = new THREE.BufferGeometry();
      for (const nome of ['position', 'normal', 'uv', 'color']) if (o.geometry.attributes[nome]) g.setAttribute(nome, toF32(o.geometry.attributes[nome]));
      g.setIndex(o.geometry.index ? Array.from(o.geometry.index.array) : [...Array(o.geometry.attributes.position.count).keys()]);
      g.applyMatrix4(mat);
      const pequeno = /grass|flower|mushroom_red$|plant_bush$/.test(p.m);
      // blocos de 40 m: o que está fora da câmera (ou da sombra) nem é desenhado
      const bloco = Math.floor((p.x + LIM + 20) / 40) + ',' + Math.floor((p.z + LIM + 20) / 40);
      const chave = o.material.uuid + '|' + Object.keys(g.attributes).join(',') + (pequeno ? '|p' : '') + '|' + bloco;
      if (!grupos.has(chave)) grupos.set(chave, { mat: o.material, geos: [], pequeno });
      grupos.get(chave).geos.push(g);
    });
  }
  for (const { mat, geos, pequeno } of grupos.values()) {
    const g = mergeGeometries(geos, false); if (!g) continue;
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat); mesh.castShadow = !pequeno; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    scene.add(mesh); filhos.push(mesh);
  }
  return filhos.length;
}
// peças estáticas fundidas por material em blocos de 40 m (outra área além da guilda); devolve o grupo
// recorte: o cenário entre a câmera e o herói some (dá para ver o herói atrás de árvores e pedras)
const RECORTE = { rHeroi: { value: new THREE.Vector3() }, rCam: { value: new THREE.Vector3() }, rAtivo: { value: 0 } };
export const recorte = v => { RECORTE.rAtivo.value = v ? 1 : 0; };
const comRecorte = new Set();
function aplicarRecorte(mat) {
  if (comRecorte.has(mat) || mat.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return; comRecorte.add(mat);
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, RECORTE);
    sh.vertexShader = 'varying vec3 vPosMundo;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vPosMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vPosMundo; uniform vec3 rHeroi; uniform vec3 rCam; uniform float rAtivo;\n' + sh.fragmentShader.replace('void main() {', `void main() {
      if (rAtivo > 0.5) { vec3 d = rHeroi - rCam; float L = length(d); vec3 u = d / L; vec3 w = vPosMundo - rCam; float t = dot(w, u);
        if (t > 0.0 && t < L - 2.5 && length(w - u * t) < 3.2 + 1.5 * (1.0 - t / L)) discard; }`);
  };
  mat.needsUpdate = true;
}
// base de cada malha das peças (convertida uma vez só): atributos em Float32 e índices
const baseMalha = new Map();
function base(o, inv) {
  let b = baseMalha.get(o); if (b) return b;
  const at = o.geometry.attributes, nomes = ['position', 'normal', 'uv', 'color'].filter(n => at[n]);
  b = { nomes, dados: nomes.map(n => toF32(at[n]).array), tam: nomes.map(n => at[n].itemSize), n: at.position.count,
    idx: o.geometry.index ? Uint32Array.from(o.geometry.index.array) : Uint32Array.from({ length: at.position.count }, (_, i) => i),
    local: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), chave: o.material.uuid + '|' + nomes.join(',') };
  baseMalha.set(o, b); return b;
}
export function montarEstatico(lista) {
  const grupos = new Map(), tmp = new THREE.Object3D(), raiz = new THREE.Group();
  for (const p of lista) {
    const modelo = pecas[p.m.replace(':', '')]; if (!modelo) { console.warn('peça ausente', p.m); continue; }
    tmp.position.set(p.x, p.y || 0, p.z); tmp.rotation.set(0, p.ry || 0, 0); tmp.scale.setScalar(p.s || 1); tmp.updateMatrixWorld(true);
    if (!modelo._inv) { modelo.updateMatrixWorld(true); modelo._inv = new THREE.Matrix4().copy(modelo.matrixWorld).invert(); modelo._malhas = []; modelo.traverse(o => { if (o.isMesh) modelo._malhas.push(o); }); }
    for (const o of modelo._malhas) {
      const b = base(o, modelo._inv), chave = b.chave + '|' + Math.floor(p.x / 40) + ',' + Math.floor(p.z / 40);
      if (!grupos.has(chave)) grupos.set(chave, { mat: o.material, b0: b, itens: [] });
      grupos.get(chave).itens.push([b, new THREE.Matrix4().multiplyMatrices(tmp.matrixWorld, b.local)]);
    }
  }
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const { mat, b0, itens } of grupos.values()) {
    let nv = 0, ni = 0; for (const [b] of itens) { nv += b.n; ni += b.idx.length; }
    const saida = b0.nomes.map((n, k) => new Float32Array(nv * b0.tam[k])), idx = new Uint32Array(ni); let ov = 0, oi = 0;
    for (const [b, m] of itens) {
      nm.getNormalMatrix(m);
      b.nomes.forEach((n, k) => {
        const src = b.dados[k], dst = saida[k], t = b.tam[k];
        if (n === 'position' || n === 'normal') for (let i = 0; i < b.n; i++) { v.fromArray(src, i * 3); if (n === 'position') v.applyMatrix4(m); else v.applyMatrix3(nm).normalize(); v.toArray(dst, (ov + i) * 3); }
        else dst.set(src, ov * t);
      });
      for (let i = 0; i < b.idx.length; i++) idx[oi + i] = b.idx[i] + ov;
      ov += b.n; oi += b.idx.length;
    }
    const g = new THREE.BufferGeometry(); b0.nomes.forEach((n, k) => g.setAttribute(n, new THREE.BufferAttribute(saida[k], b0.tam[k]))); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
    aplicarRecorte(mat); const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; raiz.add(mesh);
  }
  scene.add(raiz); return raiz;
}
// chão pintado num canvas: desenhar(g, W, k) com W(x|z) → pixel e k = px por metro
// estrada de pedras: faixa 3D que segue uma curva suave pelos pontos, com calçamento desenhado
let texPedra = null;
function texturaPedras() {
  if (texPedra) return texPedra;
  const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
  let sd = 3; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#5a4a3a'; g.fillRect(0, 0, N, N); // rejunte
  const linhas = 7, alt = N / linhas;
  for (let l = 0; l < linhas; l++) {
    let x = -r() * 40; const y = l * alt;
    while (x < N + 40) {
      const w = 50 + r() * 40, tom = 150 + r() * 40, cor = `rgb(${tom},${tom * 0.93},${tom * 0.82})`;
      for (const dx of [0, -N, N]) { // repete nas bordas (textura contínua)
        const px = x + dx + 3, py = y + 3, pw = w - 6, ph = alt - 6;
        g.fillStyle = '#3a2e22'; g.beginPath(); g.roundRect(px + 2, py + 3, pw, ph, 12); g.fill();
        const gr = g.createLinearGradient(0, py, 0, py + ph); gr.addColorStop(0, cor); gr.addColorStop(1, `rgb(${tom * 0.75},${tom * 0.7},${tom * 0.6})`);
        g.fillStyle = gr; g.beginPath(); g.roundRect(px, py, pw, ph, 12); g.fill();
        g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(px + pw * 0.35, py + ph * 0.3, pw * 0.25, ph * 0.15, 0, 0, 7); g.fill();
      }
      x += w;
    }
  }
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,60,20' : '0,0,0'},${0.08 + r() * 0.12})`; g.fillRect(r() * N, r() * N, 2 + r() * 4, 2 + r() * 4); }
  texPedra = new THREE.CanvasTexture(cv); texPedra.wrapS = texPedra.wrapT = THREE.RepeatWrapping; texPedra.colorSpace = THREE.SRGBColorSpace; texPedra.anisotropy = 8;
  return texPedra;
}
export function estrada(pts, largura = 5) {
  const curva = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal', 0.5);
  const n = Math.max(2, Math.ceil(curva.getLength() / 1.2)), grupo = new THREE.Group();
  for (const [w, y, mat] of [[largura + 1.6, 0.04, new THREE.MeshLambertMaterial({ color: 0x6a5238 })], [largura, 0.07, new THREE.MeshLambertMaterial({ map: texturaPedras() })]]) {
    const pos = [], uv = [], idx = []; let dist = 0, ant = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = curva.getPointAt(t), tg = curva.getTangentAt(t), nx = -tg.z, nz = tg.x;
      if (ant) dist += p.distanceTo(ant); ant = p;
      pos.push(p.x + nx * w / 2, y, p.z + nz * w / 2, p.x - nx * w / 2, y, p.z - nz * w / 2); uv.push(0, dist / largura, 1, dist / largura);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; grupo.add(m);
  }
  scene.add(grupo);
  return { grupo, pontos: n => Array.from({ length: n }, (_, i) => { const t = (i + 0.5) / n, p = curva.getPointAt(t), tg = curva.getTangentAt(t); return { x: p.x, z: p.z, nx: -tg.z, nz: tg.x }; }) };
}
// textura de detalhe (cinza ~0,5): manchas e folhinhas de grama, repetida no chão para ficar nítido de perto
let texDet = null;
function texturaDetalhe() {
  if (texDet) return texDet;
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
  let sd = 3; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#808080'; g.fillRect(0, 0, N, N);
  const cir = (x, y, rr, c) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.fillStyle = c; g.beginPath(); g.arc(x + dx, y + dy, rr, 0, 7); g.fill(); } };
  for (let i = 0; i < 70; i++) cir(r() * N, r() * N, 10 + r() * 26, `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + r() * 0.06})`);
  for (let i = 0; i < 900; i++) { const x = r() * N, y = r() * N, h = 3 + r() * 6, cl = r() < 0.55; g.strokeStyle = cl ? `rgba(255,255,230,${0.18 + r() * 0.2})` : `rgba(0,20,0,${0.15 + r() * 0.2})`;
    g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - h); g.stroke(); }
  texDet = new THREE.CanvasTexture(cv); texDet.wrapS = texDet.wrapT = THREE.RepeatWrapping; texDet.anisotropy = 4; return texDet;
}
export function chaoPintado(x0, z0, tam, desenhar, detalhe = 0) {
  const N = 2048, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), k = N / tam;
  desenhar(g, (v, eixo) => (v - (eixo === 'z' ? z0 : x0) + tam / 2) * k, k);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const mat = new THREE.MeshLambertMaterial({ map: t });
  if (detalhe) mat.onBeforeCompile = sh => { // multiplica pela textura de detalhe repetida a cada `detalhe` metros
    sh.uniforms.detalhe = { value: texturaDetalhe() }; sh.uniforms.repete = { value: tam / detalhe };
    sh.fragmentShader = 'uniform sampler2D detalhe; uniform float repete;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= texture2D(detalhe, vMapUv * repete).rgb * 2.0;');
  };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(x0, 0.02, z0); m.receiveShadow = true; scene.add(m); return m;
}
const clonar = o => { const c = o.clone(); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); return c; };

function texturaChao(M) {
  const N = 2048, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const LIM = M.tam / 2, g = cv.getContext('2d'), k = N / (LIM * 2 + 40), W = (x) => (x + LIM + 20) * k;
  g.fillStyle = '#5c8f3a'; g.fillRect(0, 0, N, N);
  const r = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < 9000; i++) {
    const x = r() * N, y = r() * N;
    g.fillStyle = `hsla(${85 + r() * 25},${40 + r() * 15}%,${30 + r() * 12}%,${0.25 + r() * 0.3})`;
    g.beginPath(); g.arc(x, y, 3 + r() * 14, 0, 7); g.fill();
  }
  for (const p of M.patios || []) { g.fillStyle = p.cor; g.globalAlpha = 0.45; g.fillRect(W(p.x0), W(p.z0), (p.x1 - p.x0) * k, (p.z1 - p.z0) * k); g.globalAlpha = 1; }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [cor, extra] of [['#7a5f3a', 1.2], ['#a58a5c', 0]]) for (const c of M.caminhos) {
    g.strokeStyle = cor; g.lineWidth = (c.w + extra) * k; g.beginPath();
    c.pts.forEach(([x, z], i) => i ? g.lineTo(W(x), W(z)) : g.moveTo(W(x), W(z))); g.stroke();
  }
  for (const p of M.pracas || []) {
    g.fillStyle = p.cor || '#a39a8c'; g.beginPath(); g.arc(W(p.x), W(p.z), p.r * k, 0, 7); g.fill();
    g.strokeStyle = 'rgba(60,55,50,.3)'; g.lineWidth = 1.5; for (let rr = 1.6; rr < p.r; rr += 1.6) { g.beginPath(); g.arc(W(p.x), W(p.z), rr * k, 0, 7); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// grupo de peças do cenário (construções que mudam de nível); id: pode ser tocado (pick)
export function grupo(lista, x = 0, z = 0, id = null) {
  const G = new THREE.Group(); G.position.set(x, 0, z); if (id) G.userData.ed = id;
  for (const p of lista) {
    const src = pecas[p.m.replace(':', '')]; if (!src) { console.warn('peça ausente', p.m); continue; }
    const o = clonar(src); o.position.set(p.x || 0, p.y || 0, p.z || 0); o.rotation.y = p.ry || 0;
    if (Array.isArray(p.s)) o.scale.set(...p.s); else o.scale.setScalar(p.s || 1);
    G.add(o);
  }
  scene.add(G); return G;
}
// orbe brilhante da torre mágica
export function orbe(x, y, z, r) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const n = new THREE.Mesh(GEO_BOLA, new THREE.MeshBasicMaterial({ color: 0xd8b0ff })); n.scale.setScalar(r * 0.55);
  const a = new THREE.Mesh(GEO_BOLA, MAT_ADD(0x7a3aff)); a.material.opacity = 0.45; a.scale.setScalar(r * 1.1);
  g.add(n, a); scene.add(g); return g;
}
// anel mágico girando (portal)
export function anel(x, y, z, r, cor = 0x9a5aff) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const t = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.08, 8, 40), MAT_ADD(cor)); const d = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 32), MAT_ADD(cor)); d.material.opacity = 0.35;
  g.add(t, d); scene.add(g); return g;
}
// toque na tela → id do prédio (grupo com userData.ed) sob o dedo
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
export function tocado(sx, sy) {
  ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
  const alvos = scene.children.filter(o => o.userData.ed);
  const hit = ray.intersectObjects(alvos, true)[0]; if (!hit) return null;
  let o = hit.object; while (o && !o.userData.ed) o = o.parent; return o ? o.userData.ed : null;
}
// ponto do chão sob um ponto da tela (para arrastar a câmera)
const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pTmp = new THREE.Vector3();
export function chaoEm(sx, sy) { ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); return ray.ray.intersectPlane(plano, pTmp) ? { x: pTmp.x, z: pTmp.z } : null; }
// botão no chão (estilo tycoon)
const GEO_PAD = new THREE.CylinderGeometry(1.25, 1.35, 0.18, 32), GEO_ANEL = new THREE.TorusGeometry(1.3, 0.08, 6, 40).rotateX(Math.PI / 2);
export function pad(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0.09, z);
  const base = new THREE.Mesh(GEO_PAD, new THREE.MeshStandardMaterial({ color: 0x3ad05a, emissive: 0x1a8a2a, emissiveIntensity: 0.6, roughness: 0.5 }));
  const anel = new THREE.Mesh(GEO_ANEL, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); anel.position.y = 0.12;
  g.add(base, anel); scene.add(g);
  return { g, cor(c, e) { base.material.color.set(c); base.material.emissive.set(e); }, pulso(t) { anel.scale.setScalar(1 + 0.08 * Math.sin(t * 4)); anel.material.opacity = 0.5 + 0.4 * Math.sin(t * 4); } };
}

// ---------------- personagens ----------------
export function personagem(nome, armas = [], esc = 1) {
  const gltf = modelos[nome], raiz = new THREE.Group(), corpo = SkeletonUtils.clone(gltf.scene);
  corpo.scale.setScalar(ESC_PERS * esc); raiz.add(corpo);
  for (const [arma, lado] of armas) {
    const osso = corpo.getObjectByName(lado === 'l' ? 'handslotl' : 'handslotr') || corpo.getObjectByName(lado === 'l' ? 'handslot.l' : 'handslot.r');
    if (osso && modelos[arma]) osso.add(modelos[arma].scene.clone());
  }
  // todas as partes do corpo usam o mesmo esqueleto (1 textura de ossos por personagem, não 10)
  let esq = null;
  corpo.traverse(o => {
    if (!o.isSkinnedMesh) return;
    if (!esq) esq = o.skeleton;
    // só compartilha se as matrizes de bind forem iguais (senão a parte do corpo deforma: herói "deitado")
    else if (o.skeleton.bones.length === esq.bones.length && o.skeleton.bones.every((b, i) => b.name === esq.bones[i].name
      && o.skeleton.boneInverses[i].elements.every((v, j) => Math.abs(v - esq.boneInverses[i].elements[j]) < 1e-4))) o.bind(esq, o.bindMatrix);
  });
  const mats = []; // materiais próprios (para piscar ao levar dano)
  corpo.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.material = o.material.clone(); mats.push(o.material);
    if (o.isSkinnedMesh) o.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.3, 0), 2.4); // folga para as animações
  });
  const mixer = new THREE.AnimationMixer(corpo), acoes = {};
  for (const c of gltf.animations) acoes[c.name] = mixer.clipAction(c);
  scene.add(raiz);
  let atual = null, nomeAtual = '';
  const P = {
    raiz, corpo, mixer, acoes,
    tem: n => !!acoes[n],
    // loop: repete; senão toca uma vez e para no último quadro
    tocar(n, { loop = true, fade = 0.15, vel = 1, reinicia = false } = {}) {
      const a = acoes[n]; if (!a) return;
      if (nomeAtual === n && !reinicia) { a.timeScale = vel; return; }
      a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1); a.clampWhenFinished = !loop; a.timeScale = vel;
      a.play(); if (atual && atual !== a) atual.crossFadeTo(a, fade, false); else a.fadeIn(fade);
      atual = a; nomeAtual = n;
    },
    get anim() { return nomeAtual; },
    remover() { scene.remove(raiz); mixer.stopAllAction(); },
    brilho(v) { if (v === P._b) return; P._b = v; for (const m of mats) m.emissive?.setScalar(v); },
  };
  return P;
}
// ---------------- heróis modulares (peças misturáveis + cores) ----------------
// Todos os aventureiros usam o mesmo esqueleto (mesma pose de bind, só a ordem dos ossos muda):
// cada peça é religada ao esqueleto do Cavaleiro e pintada com uma cópia da textura (grade de 8×4 cores).
export const ESC_HEROI = 1.55;
const APELIDOS = { Idle: 'Idle_A', Cheer: 'Cheering', '1H_Melee_Attack_Chop': 'Melee_1H_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal': 'Melee_1H_Attack_Slice_Diagonal',
  '2H_Melee_Attack_Chop': 'Melee_2H_Attack_Chop', '2H_Ranged_Shoot': 'Ranged_Bow_Release', Spellcast_Shoot: 'Ranged_Magic_Shoot', Block: 'Melee_Block' };
let H = null;
const TX = 256, CW = TX / 8, CH = TX / 4; // textura de cor reduzida (cada célula é um degradê vertical)
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b + 1;
function prepararHerois() {
  const grupos = {};
  for (const g of modelos.herois.scene.children) grupos[g.name.replace(/^h/, '')] = g;
  const k = grupos.Knight, corpoK = k.getObjectByName('Knight_Body');
  const nomes = corpoK.skeleton.bones.map(b => b.name), inversos = corpoK.skeleton.boneInverses.map(m => m.clone());
  const raizOsso = corpoK.skeleton.bones[0];
  const atlas = {}, partes = {};
  for (const [o, { pref }] of Object.entries(ORIGENS)) {
    grupos[o].traverse(m => {
      if (!m.isSkinnedMesh || !m.name.startsWith(pref + '_')) return;
      const peca = m.name.slice(pref.length + 1), tex = m.material.map, aid = tex.name || tex.source.uuid;
      if (!atlas[aid]) {
        const cv = document.createElement('canvas'); cv.width = cv.height = TX; const g = cv.getContext('2d', { willReadFrequently: true });
        g.drawImage(tex.image, 0, 0, TX, TX); const dados = g.getImageData(0, 0, TX, TX);
        const media = []; // cor média de cada célula
        for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 8; cx++) {
          let r = 0, gg = 0, b = 0, n = 0;
          for (let y = cy * CH; y < (cy + 1) * CH; y += 4) for (let x = cx * CW; x < (cx + 1) * CW; x += 4) { const i = (y * TX + x) * 4; r += dados.data[i]; gg += dados.data[i + 1]; b += dados.data[i + 2]; n++; }
          media.push([r / n, gg / n, b / n]);
        }
        const pele = media.map(([r, g2, b]) => Math.hypot(r - 243, g2 - 190, b - 155) < 42);
        atlas[aid] = { id: aid, tex, dados, media, pele };
      }
      // religa os ossos na ordem do Cavaleiro
      const mapa = m.skeleton.bones.map(b => nomes.indexOf(b.name.replace(/_\d+$/, ''))), // ossos repetidos vêm como hips_1...
        si = m.geometry.attributes.skinIndex, novo = new Uint16Array(si.count * 4);
      for (let i = 0; i < si.count; i++) for (let c = 0; c < 4; c++) novo[i * 4 + c] = Math.max(0, mapa[si.getComponent ? si.getComponent(i, c) : [si.getX, si.getY, si.getZ, si.getW][c].call(si, i)]);
      const geo = new THREE.BufferGeometry();
      for (const [n, a] of Object.entries(m.geometry.attributes)) if (n !== 'skinIndex') geo.setAttribute(n, a);
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(novo, 4)); geo.setIndex(m.geometry.index);
      // células da textura usadas pela peça (as zonas que dá para pintar)
      const uv = m.geometry.attributes.uv, cont = {};
      for (let i = 0; i < uv.count; i++) { const cx = Math.min(7, Math.max(0, Math.floor(uv.getX(i) * 8))), cy = Math.min(3, Math.max(0, Math.floor(uv.getY(i) * 4))); cont[cx + ',' + cy] = (cont[cx + ',' + cy] || 0) + 1; }
      const zonas = Object.entries(cont).sort((a, b) => b[1] - a[1]).map(([c]) => c);
      partes[o + ':' + peca] = { geo, mat: m.material, atlas: atlas[aid], zonas, bind: m.bindMatrix.clone() };
    });
  }
  const clips = {};
  for (const [n, g] of Object.entries(modelos)) if (n.startsWith('a:')) for (const c of g.animations) clips[c.name] = c;
  H = { nomes, inversos, raizOsso, atlas, partes, clips };
}
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(Math.min(255, v)).toString(16).padStart(2, '0')).join('');
const deHex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// zonas pintáveis de cada parte do visual: { cab: [{chave, cor}], ... } (a pele é separada)
export function zonasDe(v) {
  if (!H) prepararHerois();
  const out = {};
  for (const k of ['cab', 'cha', 'mas', 'tro', 'bra', 'per', 'capa', 'cos']) {
    const vistas = new Set(), l = [];
    for (const [o, p] of pecasDo({ ...v, cha: k === 'cha' ? v.cha : '', mas: k === 'mas' ? v.mas : '', capa: k === 'capa' ? v.capa : '', cos: k === 'cos' ? v.cos : '' }).filter(([o, p]) => parteDe(p) === k)) {
      const pt = H.partes[o + ':' + p]; if (!pt) continue;
      for (const z of pt.zonas) { const [cx, cy] = z.split(',').map(Number), idx = cy * 8 + cx; if (pt.atlas.pele[idx]) continue; const chave = pt.atlas.id + ':' + z; if (vistas.has(chave)) continue; vistas.add(chave); l.push({ chave, cor: v.cores?.[chave] || hex(pt.atlas.media[idx]) }); }
    }
    out[k] = l;
  }
  return out;
}
const parteDe = p => ({ Head: 'cab', Helmet: 'cha', HelmetVisor: 'cha', BearHat: 'cha', Hat: 'cha', Mask: 'mas', Body: 'tro', ArmLeft: 'bra', ArmRight: 'bra', LegLeft: 'per', LegRight: 'per', Cape: 'capa', Quiver: 'cos' }[p]);
// textura pintada de um atlas para um visual (null = cores originais)
function texturaPintada(at, v, extra) {
  const trocas = [];
  for (let idx = 0; idx < 32; idx++) {
    const chave = at.id + ':' + (idx % 8) + ',' + Math.floor(idx / 8);
    const c = v.cores?.[chave] || extra[chave] || (at.pele[idx] && v.pele) || null;
    if (c) trocas.push([idx, deHex(c)]);
  }
  if (!trocas.length) return null;
  const img = new ImageData(new Uint8ClampedArray(at.dados.data), TX, TX), d = img.data;
  for (const [idx, [R, G, B]] of trocas) {
    const cx = idx % 8, cy = Math.floor(idx / 8), m = at.media[idx], lm = lum(...m);
    for (let y = cy * CH; y < (cy + 1) * CH; y++) for (let x = cx * CW; x < (cx + 1) * CW; x++) {
      const i = (y * TX + x) * 4, f = Math.min(2.2, lum(d[i], d[i + 1], d[i + 2]) / lm);
      d[i] = R * f; d[i + 1] = G * f; d[i + 2] = B * f;
    }
  }
  const cv = document.createElement('canvas'); cv.width = cv.height = TX; cv.getContext('2d').putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; return t;
}

// ---------------- acessórios de raça: orelhas, barba, chifres, presas, rabo, asas, auréola ----------------
// malhas simples (low poly) presas nos ossos; medidas no espaço do osso da cabeça (cabeça ~1,05 de altura, ±0,54 de largura, rosto em z≈0,53)
const matAc = (cor, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.8, metalness: 0, flatShading: true, ...extra });
const cone = (r, h, seg, mat) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat);
function pos(o, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.castShadow = true; return o; }
function tubo(pts, r, mat, seg = 16) { return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), seg, r, 6, false), mat); }
export function acessorios(v) {
  if (v.mas) v = { ...v, barba: '', presas: '' }; // máscara cobre a boca
  const pele = matAc(v.pele || '#f3bd98'), pelo = matAc(v.corPelo || '#4a2e1c'), chifre = matAc(v.corChifre || '#2a2226'), rosa = matAc('#f0a0a8');
  const cab = [], quadril = [], peito = [];
  for (const s of [-1, 1]) {
    if (v.orelha === 'elfo') cab.push(pos(cone(0.1, 0.55, 5, pele), s * 0.6, 0.5, -0.05, -0.35, 0, -s * 1.15, 1, 1, 0.45));
    if (v.orelha === 'gato' || v.orelha === 'lobo') {
      const g = new THREE.Group(), h = v.orelha === 'lobo' ? 0.46 : 0.36;
      g.add(pos(cone(0.19, h, 4, pelo), 0, 0, 0, 0, Math.PI / 4, 0, 1, 1, 0.55), pos(cone(0.11, h * 0.7, 4, rosa), 0, -0.03, 0.05, 0, Math.PI / 4, 0, 1, 1, 0.4));
      cab.push(pos(g, s * 0.33, 1.08, -0.05, 0, 0, -s * 0.35));
    }
    if (v.orelha === 'coelho') { const g = new THREE.Group(); g.add(pos(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), pelo), 0, 0.35, 0, 0, 0, 0, 1, 3, 0.5), pos(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), rosa), 0, 0.35, 0.05, 0, 0, 0, 1, 3.2, 0.4)); cab.push(pos(g, s * 0.22, 0.95, -0.05, -0.15, 0, -s * 0.2)); }
    if (v.chifre === 'demonio') { const c = tubo([[0, 0, 0], [s * 0.12, 0.14, -0.02], [s * 0.2, 0.28, -0.1], [s * 0.15, 0.4, -0.22]], 0.07, chifre, 10), ponta = pos(cone(0.07, 0.16, 6, chifre), s * 0.13, 0.46, -0.27, -0.9, 0, s * 0.3), base = pos(cone(0.13, 0.2, 6, chifre), 0, 0.02, 0, 0, 0, 0); cab.push(pos(new THREE.Group().add(c, ponta, base), s * 0.3, 0.98, 0.12, 0, 0, -s * 0.25)); }
    if (v.chifre === 'carneiro') cab.push(pos(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 6, 14, Math.PI * 1.6), chifre), s * 0.52, 0.72, -0.02, 0, s * Math.PI / 2, 0.4));
    if (v.chifre === 'cervo') { const g = new THREE.Group(); g.add(tubo([[0, 0, 0], [s * 0.15, 0.3, 0], [s * 0.3, 0.6, -0.05], [s * 0.35, 0.85, -0.1]], 0.04, chifre, 8), tubo([[s * 0.15, 0.3, 0], [s * 0.05, 0.55, 0.05]], 0.03, chifre, 4), tubo([[s * 0.27, 0.55, -0.04], [s * 0.45, 0.7, 0]], 0.03, chifre, 4)); cab.push(pos(g, s * 0.25, 1, 0)); }
    if (v.presas === 'sim') cab.push(pos(cone(0.05, 0.16, 5, matAc('#fff6e0')), s * 0.17, 0.2, 0.52, 0.2, 0, 0));
  }
  if (v.chifre === 'unicornio') cab.push(pos(cone(0.08, 0.55, 8, matAc('#ffd84a', { emissive: 0x6a4a00 })), 0, 1.05, 0.35, 0.55, 0, 0));
  if (v.barba === 'curta' || v.barba === 'longa') {
    const longa = v.barba === 'longa';
    cab.push(pos(new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), pelo), 0, 0.04, 0.36, 0, 0, 0, 1.15, 0.6, 0.5));
    if (longa) cab.push(pos(cone(0.28, 0.6, 8, pelo), 0, -0.28, 0.42, Math.PI + 0.15, 0, 0, 1, 1, 0.5));
    cab.push(pos(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 3, 6), pelo), 0, 0.32, 0.56, 0, 0, Math.PI / 2));
  }
  if (v.barba === 'bigode') for (const s of [-1, 1]) cab.push(pos(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 3, 6), pelo), s * 0.14, 0.3, 0.56, 0, 0, s * 1.2));
  if (v.barba === 'cavanhaque') cab.push(pos(cone(0.12, 0.3, 6, pelo), 0, 0.02, 0.52, Math.PI + 0.3, 0, 0, 1, 1, 0.6));
  if (v.aura === 'sim') cab.push(pos(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 6, 24), matAc('#ffe27a', { emissive: 0xffc830, emissiveIntensity: 0.9 })), 0, 1.4, -0.05, Math.PI / 2 - 0.25, 0, 0));
  // rabo (no quadril): sai das costas e sobe fazendo curva
  const R = { gato: [0.055, pelo], raposa: [0.13, pelo], demonio: [0.035, chifre], dragao: [0.1, pele] }[v.rabo];
  if (R) {
    const pts = [[0, 0.05, -0.25], [0, -0.1, -0.55], [0, 0.05, -0.9], [0, 0.4, -1.05], [0, 0.65, -0.95]];
    quadril.push(tubo(pts, R[0], R[1], 20));
    if (v.rabo === 'raposa') quadril.push(pos(new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), matAc('#f5f0e8')), 0, 0.68, -0.93, 0, 0, 0, 1, 1.4, 1));
    if (v.rabo === 'demonio') quadril.push(pos(cone(0.12, 0.2, 3, chifre), 0, 0.72, -0.93, -0.3, 0, 0, 1, 1, 0.35));
    if (v.rabo === 'dragao') quadril.push(pos(cone(0.1, 0.3, 4, pele), 0, 0.3, -0.35, -2.2, 0, 0));
  }
  // asas (no peito, atrás das costas)
  if (v.asas) {
    const cor = { anjo: '#ffffff', morcego: v.corChifre || '#3a2030', fada: '#a8e8ff' }[v.asas];
    const m = matAc(cor, v.asas === 'fada' ? { transparent: true, opacity: 0.55, emissive: 0x3a8aaa, side: THREE.DoubleSide, flatShading: false } : { side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      if (v.asas === 'anjo') for (let i = 0; i < 5; i++) g.add(pos(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), m), s * (0.25 + i * 0.17), 0.35 - i * 0.12 + (i === 4 ? -0.05 : 0), 0, 0, 0, -s * (0.5 + i * 0.22), 1, 3.2 - i * 0.35, 0.3));
      else {
        const f = new THREE.Shape(); if (v.asas === 'morcego') { f.moveTo(0, 0); f.lineTo(0.5, 0.55); f.lineTo(1.2, 0.5); f.lineTo(1, 0.05); f.lineTo(0.8, -0.2); f.lineTo(0.55, 0); f.lineTo(0.35, -0.3); f.lineTo(0.2, 0); }
        else { f.moveTo(0, 0); f.bezierCurveTo(0.3, 0.9, 1.1, 0.9, 0.9, 0.3); f.bezierCurveTo(0.8, 0, 0.3, 0, 0, 0); f.bezierCurveTo(0.4, -0.2, 0.7, -0.6, 0.35, -0.6); f.bezierCurveTo(0.1, -0.6, 0.05, -0.3, 0, 0); }
        const me = new THREE.Mesh(new THREE.ShapeGeometry(f, 6), m); me.scale.set(s, 1, 1); g.add(me);
      }
      peito.push(pos(g, s * 0.15, 0.45, -0.75, 0.2, -s * 0.35, s * 0.3, 1.45, 1.45, 1.45));
    }
  }
  return { head: cab, hips: quadril, chest: peito };
}
// armas modeladas em outro eixo (arcos e bestas): giro para ficarem certas na mão
const ROT_ARMA = { 'A:crossbow_1handed': [-Math.PI / 2, 0, 0], 'A:crossbow_2handed': [-Math.PI / 2, 0, 0],
  'W:bow_A_withString': [0, Math.PI / 2, 0], 'W:bow_B_withString': [0, Math.PI / 2, 0], 'A:spellbook_open': [-Math.PI / 2, 0, 0] }; // arcos do outro kit e grimório com as páginas de frente
// escudos: de frente, em pé (com a ponta para baixo) no braço esquerdo
for (const id of ['A:shield_round', 'A:shield_round_color', 'A:shield_round_barbarian', 'A:shield_badge', 'A:shield_badge_color', 'A:shield_square', 'A:shield_square_color',
  'A:shield_spikes', 'A:shield_spikes_color', 'W:shield_A', 'W:shield_B', 'W:shield_C']) ROT_ARMA[id] = [-Math.PI / 2, 0, -Math.PI / 2];
export function heroi(v) {
  if (!H) prepararHerois();
  const raiz = new THREE.Group(), corpo = new THREE.Group(), rig = H.raizOsso.clone(true);
  corpo.add(rig); raiz.add(corpo);
  const ossos = H.nomes.map(n => rig.name === n ? rig : rig.getObjectByName(n));
  const esq = new THREE.Skeleton(ossos, H.inversos);
  const cabeca = ossos[H.nomes.indexOf('head')], bracos = ['upperarml', 'upperarmr'].map(n => ossos[H.nomes.indexOf(n)]).filter(Boolean);
  let malhas = [], armas = [], mats = [], visual = v;
  const mixer = new THREE.AnimationMixer(corpo), atualizarMixer = mixer.update.bind(mixer);
  mixer.update = dt => { // escala da cabeça e dos braços por cima da animação
    cabeca.scale.set(1, 1, 1); for (const b of bracos) b.scale.set(1, 1, 1);
    atualizarMixer(dt);
    if (visual.cabT !== 1) cabeca.scale.multiplyScalar(visual.cabT || 1);
    const mu = visual.musc || 1; if (mu !== 1) for (const b of bracos) { b.scale.x *= mu; b.scale.z *= mu; }
    return mixer;
  };
  const acoes = {};
  const acao = n => { n = H.clips[n] ? n : APELIDOS[n]; if (!n || !H.clips[n]) return null; return acoes[n] || (acoes[n] = mixer.clipAction(H.clips[n])); };
  function vestir(nv) {
    visual = nv;
    for (const m of malhas) corpo.remove(m); for (const a of armas) a.parent?.remove(a); malhas = []; armas = []; mats = [];
    // cor principal sorteada dos heróis da guilda: na zona maior do tronco
    const extra = {};
    if (nv.tinta) { const pt = H.partes[nv.tro + ':Body']; const z = pt?.zonas.find(z => { const [cx, cy] = z.split(',').map(Number); return !pt.atlas.pele[cy * 8 + cx]; }); if (z) extra[pt.atlas.id + ':' + z] = nv.tinta; }
    const matsAtlas = new Map();
    for (const [o, p] of pecasDo(nv)) {
      const pt = H.partes[o + ':' + p]; if (!pt) continue;
      let mat = matsAtlas.get(pt.atlas.id);
      if (!mat) { mat = pt.mat.clone(); const t = texturaPintada(pt.atlas, nv, extra); if (t) mat.map = t; matsAtlas.set(pt.atlas.id, mat); mats.push(mat); }
      const sm = new THREE.SkinnedMesh(pt.geo, mat); sm.bind(esq, pt.bind); sm.castShadow = true; sm.frustumCulled = false;
      corpo.add(sm); malhas.push(sm);
    }
    const arco = /bow/.test(nv.arma || ''); // o arco vai na mão esquerda (as animações de arco puxam a corda com a direita)
    for (const [id, lado] of arco ? [[nv.arma, 'l']] : [[nv.arma, 'r'], [nv.esq, 'l']]) {
      if (!id) continue; const src = pecas[id.replace(':', '')]; if (!src) continue;
      const a = clonar(src); a.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); mats.push(o.material); } });
      const r = ROT_ARMA[id]; if (r) a.rotation.set(r[0], r[1], r[2]);
      const osso = ossos[H.nomes.indexOf('handslot' + lado)]; if (osso) { osso.add(a); armas.push(a); }
    }
    for (const [osso, l] of Object.entries(acessorios(nv))) { const o = ossos[H.nomes.indexOf(osso)]; if (!o) continue; for (const m of l) { o.add(m); armas.push(m); m.traverse(x => { if (x.isMesh) mats.push(x.material); }); } }
    corpo.scale.set(ESC_HEROI * (nv.larg || 1), ESC_HEROI * (nv.alt || 1), ESC_HEROI * (nv.larg || 1));
  }
  vestir(v);
  scene.add(raiz);
  let atual = null, nomeAtual = '';
  const P = {
    raiz, corpo, mixer, acoes, vestir,
    // só proporções (sem trocar peças)
    ajustarCorpo(nv) { visual = nv; corpo.scale.set(ESC_HEROI * (nv.larg || 1), ESC_HEROI * (nv.alt || 1), ESC_HEROI * (nv.larg || 1)); },
    tem: n => !!acao(n),
    tocar(n, { loop = true, fade = 0.15, vel = 1, reinicia = false } = {}) {
      const a = acao(n); if (!a) return;
      if (nomeAtual === n && !reinicia) { a.timeScale = vel; return; }
      a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1); a.clampWhenFinished = !loop; a.timeScale = vel;
      a.play(); if (atual && atual !== a) atual.crossFadeTo(a, fade, false); else a.fadeIn(fade);
      atual = a; nomeAtual = n;
    },
    get anim() { return nomeAtual; },
    remover() { scene.remove(raiz); mixer.stopAllAction(); },
    brilho(x) { if (x === P._b) return; P._b = x; for (const m of mats) m.emissive?.setScalar(x); },
  };
  return P;
}

// estúdio do criador de heróis: um palco longe da guilda
export const ESTUDIO = { x: 0, z: -300 };
let palco = null, ceuNormal = null;
export function estudio(ligado) {
  if (!palco) {
    palco = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.3, 48), new THREE.MeshLambertMaterial({ color: 0x6a4a8a }));
    base.position.y = -0.15; base.receiveShadow = true;
    const aro = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.06, 8, 64), new THREE.MeshBasicMaterial({ color: 0xffd86a })); aro.rotation.x = -Math.PI / 2; aro.position.y = 0.01;
    const fundo = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshLambertMaterial({ color: 0x3a2a4a })); fundo.rotation.x = -Math.PI / 2; fundo.position.y = -0.02;
    palco.add(base, aro, fundo); palco.position.set(ESTUDIO.x, 0, ESTUDIO.z); scene.add(palco);
  }
  palco.visible = ligado;
  if (ligado) { ceuNormal = ceuNormal || scene.background.clone(); scene.background = new THREE.Color(0x2a1f38); scene.fog.color.set(0x2a1f38); scene.fog.near = 20; scene.fog.far = 60; }
  else if (ceuNormal) { scene.background = ceuNormal.clone(); scene.fog.color.copy(ceuNormal); scene.fog.near = 70; scene.fog.far = 150; }
}
// desloca a imagem na tela (fração da altura; positivo = conteúdo sobe)
export function deslocarVista(f) { const w = innerWidth, h = innerHeight; if (f) cam.setViewOffset(w, h, 0, h * f, w, h); else cam.clearViewOffset(); cam.updateProjectionMatrix(); }
export function objeto(nome, esc = 1) { // peça avulsa (moedas, efeitos)
  const src = pecas[nome.replace(':', '')] || modelos[nome]?.scene; const o = clonar(src); o.scale.setScalar(esc); scene.add(o); return o;
}
export function remover(o) { scene.remove(o); }

// ---------------- efeitos ----------------
const efeitos = [];
const MAT_ADD = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
export function arco(x, z, ang, raio, arcoGraus, cor = 0xffffff) { // rastro de golpe
  const th = arcoGraus * Math.PI / 180, g = new THREE.RingGeometry(raio * 0.72, raio, 24, 1, -th / 2, th);
  const m = new THREE.Mesh(g, MAT_ADD(cor)); m.rotation.x = -Math.PI / 2; m.rotation.z = -ang + Math.PI / 2; m.position.set(x, 1.0, z);
  m.material.opacity = 0.55; scene.add(m); efeitos.push({ o: m, t: 0, dur: 0.2, tipo: 'fade' });
}
export function onda(x, z, raio, cor = 0xffffff, dur = 0.4) { // anel que expande
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), MAT_ADD(cor)); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.15, z);
  scene.add(m); efeitos.push({ o: m, t: 0, dur, tipo: 'onda', raio });
}
// aviso no chão que enche até o impacto (inimigo = vermelho, herói = azul)
export function aviso(x, z, raio, dur, cor = 0xff3322) {
  const g = new THREE.Group(), base = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.22, depthWrite: false });
  const disco = new THREE.Mesh(new THREE.CircleGeometry(1, 36), base); const cheio = new THREE.Mesh(new THREE.CircleGeometry(1, 36), base.clone());
  const anel = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.85, depthWrite: false }));
  for (const m of [disco, cheio, anel]) { m.rotation.x = -Math.PI / 2; g.add(m); }
  cheio.position.y = 0.01; g.position.set(x, 0.08, z); g.scale.setScalar(raio); scene.add(g);
  const e = { o: g, t: 0, dur, tipo: 'aviso', cheio }; efeitos.push(e); return e;
}
// avisos no chão em linha (investida) e em cone (leque de tiros): o preenchimento cresce até o golpe sair
function avisoForma(geo, x, z, ang, dur, cor, eixo) {
  const g = new THREE.Group(), base = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const fundo = new THREE.Mesh(geo, base), cheio = new THREE.Mesh(geo, base.clone()); cheio.position.y = 0.01;
  const borda = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: 0.9 }));
  g.add(fundo, cheio, borda); g.position.set(x, 0.08, z); g.rotation.y = ang; scene.add(g);
  const e = { o: g, t: 0, dur, tipo: 'aviso', cheio, eixo }; efeitos.push(e); return e;
}
export function avisoLinha(x, z, ang, comp, larg, dur, cor = 0xff3322) {
  return avisoForma(new THREE.PlaneGeometry(larg, comp).rotateX(-Math.PI / 2).translate(0, 0, comp / 2), x, z, ang, dur, cor, 'z');
}
export function avisoCone(x, z, ang, raio, abertura, dur, cor = 0xff3322) {
  return avisoForma(new THREE.CircleGeometry(raio, 20, Math.PI / 2 - abertura, abertura * 2).rotateX(-Math.PI / 2).rotateY(Math.PI), x, z, ang, dur, cor);
}
// poça (veneno, lava): disco que pulsa e some no fim
export function poca(x, z, raio, dur, cor = 0x5ad82a) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(raio, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.45, depthWrite: false }));
  m.position.set(x, 0.07, z); scene.add(m); const e = { o: m, t: 0, dur, tipo: 'poca' }; efeitos.push(e); return e;
}
const GEO_FLECHA = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5).rotateX(Math.PI / 2);
const GEO_BOLA = new THREE.SphereGeometry(1, 12, 10);
export function projetil(tipo) {
  let o;
  if (tipo === 'flecha' || tipo === 'virote') o = new THREE.Mesh(GEO_FLECHA, new THREE.MeshBasicMaterial({ color: tipo === 'virote' ? 0x9a8a70 : 0xe8d9b0 }));
  else if (tipo === 'lanca') { o = new THREE.Mesh(GEO_FLECHA, new THREE.MeshLambertMaterial({ color: 0x7a5a3a })); o.scale.set(3, 3, 3.2); }
  else if (tipo === 'pedra') { o = new THREE.Mesh(GEO_BOLA, new THREE.MeshLambertMaterial({ color: 0x8a8378 })); o.scale.setScalar(0.55); o.castShadow = true; }
  else {
    const cor = { magia: 0xb88bff, fogo: 0xff7a2a, sombra: 0x7dff9a }[tipo] || 0xffffff;
    o = new THREE.Group(); const nucleo = new THREE.Mesh(GEO_BOLA, new THREE.MeshBasicMaterial({ color: 0xffffff })); nucleo.scale.setScalar(tipo === 'fogo' ? 0.28 : 0.16);
    const aura = new THREE.Mesh(GEO_BOLA, MAT_ADD(cor)); aura.scale.setScalar(tipo === 'fogo' ? 0.55 : 0.34); o.add(nucleo, aura);
  }
  scene.add(o); return o;
}
// partículas (um único Points para tudo)
const MAXP = 700, pPos = new Float32Array(MAXP * 3), pCor = new Float32Array(MAXP * 3), part = [];
let pontos;
function criarPontos() {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); g.setAttribute('color', new THREE.BufferAttribute(pCor, 3));
  pontos = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pontos.frustumCulled = false; scene.add(pontos);
}
const corTmp = new THREE.Color();
export function faiscas(x, y, z, cor, n = 10, forca = 3) {
  corTmp.set(cor);
  for (let i = 0; i < n && part.length < MAXP; i++) {
    const a = Math.random() * 6.28, v = forca * (0.4 + Math.random());
    part.push({ x, y, z, vx: Math.cos(a) * v, vy: Math.random() * forca * 1.2, vz: Math.sin(a) * v, t: 0, vida: 0.4 + Math.random() * 0.5, r: corTmp.r, g: corTmp.g, b: corTmp.b });
  }
}

// ---------------- câmera e quadro ----------------
export const camera = { yaw: Math.PI, pitch: 0.72, dist: 12, alvo: new THREE.Vector3(), tremor: 0, suave: 10 };
const olharTmp = new THREE.Vector3();
export function quadro(dt, foco) {
  relogio += dt; RECORTE.rHeroi.value.set(foco.x, 2.2, foco.z); RECORTE.rCam.value.copy(cam.position);
  if (!pontos) criarPontos();
  // efeitos
  for (let i = efeitos.length - 1; i >= 0; i--) {
    const e = efeitos[i]; e.t += dt; const k = e.t / e.dur;
    if (e.tipo === 'fade') e.o.material.opacity = Math.max(0, 0.55 * (1 - k));
    if (e.tipo === 'onda') { e.o.scale.setScalar(0.3 + k * e.raio); e.o.material.opacity = Math.max(0, 0.9 * (1 - k)); }
    if (e.tipo === 'aviso') { if (e.eixo === 'z') e.cheio.scale.set(1, 1, Math.min(1, k)); else e.cheio.scale.setScalar(Math.min(1, k)); }
    if (e.tipo === 'poca') e.o.material.opacity = (k > 0.85 ? (1 - k) / 0.15 : 1) * (0.35 + 0.12 * Math.sin(e.t * 6));
    if (k >= 1 || e.morto) { scene.remove(e.o); efeitos.splice(i, 1); }
  }
  // partículas
  let n = 0;
  for (let i = part.length - 1; i >= 0; i--) {
    const p = part[i]; p.t += dt; if (p.t > p.vida) { part.splice(i, 1); continue; }
    p.vy -= 6 * dt; p.x += p.vx * dt; p.y = Math.max(0.05, p.y + p.vy * dt); p.z += p.vz * dt; p.vx *= 0.96; p.vz *= 0.96;
  }
  for (const p of part) { const f = 1 - p.t / p.vida; pPos.set([p.x, p.y, p.z], n * 3); pCor.set([p.r * f, p.g * f, p.b * f], n * 3); n++; }
  pontos.geometry.setDrawRange(0, n); pontos.geometry.attributes.position.needsUpdate = true; pontos.geometry.attributes.color.needsUpdate = true;

  // câmera atrás do herói
  const c = camera, sy = Math.sin(c.yaw), cy = Math.cos(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  c.alvo.lerp(olharTmp.set(foco.x, 1.3, foco.z), Math.min(1, dt * c.suave));
  cam.position.set(c.alvo.x - sy * cp * c.dist, c.alvo.y + sp * c.dist, c.alvo.z - cy * cp * c.dist);
  if (c.tremor > 0) { cam.position.x += (Math.random() - 0.5) * c.tremor; cam.position.y += (Math.random() - 0.5) * c.tremor; c.tremor = Math.max(0, c.tremor - dt * 2); }
  cam.lookAt(c.alvo);
  // sombra acompanha o herói
  sol.position.set(foco.x + 20, 40, foco.z + 10); sol.target.position.set(foco.x, 0, foco.z);
  renderer.render(scene, cam);
}
// projeta um ponto 3D na tela (px CSS); null se estiver atrás da câmera
const vTmp = new THREE.Vector3();
export function tela(x, y, z) {
  vTmp.set(x, y, z).project(cam);
  if (vTmp.z > 1) return null;
  return [(vTmp.x + 1) / 2 * innerWidth, (1 - vTmp.y) / 2 * innerHeight];
}
export const tempo = () => relogio;
export const info = () => {
  const tex = new Set(), src = new Set(), mats = new Set(); let meshes = 0;
  scene.traverse(o => { if (o.isMesh) { meshes++; for (const m of [].concat(o.material)) { mats.add(m.uuid); if (m.map) { tex.add(m.map.uuid); src.add(m.map.source.uuid); } } } });
  return { ...renderer.info.render, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, texCena: tex.size, fontes: src.size, mats: mats.size, meshes };
};
export function medida(m) { const p = pecas[m.replace(':', '')]; if (!p) return null; const b = new THREE.Box3().setFromObject(p), s = b.getSize(new THREE.Vector3()); return [+s.x.toFixed(2), +s.y.toFixed(2), +s.z.toFixed(2), +b.min.x.toFixed(2), +b.min.z.toFixed(2)]; }
export function debugHerois() { const g = modelos.herois.scene.children[0]; const out = []; g.traverse(o => out.push(o.type + ' ' + o.name + ' p' + o.position.toArray().map(v => v.toFixed(2)) + ' r' + o.rotation.toArray().slice(0, 3).map(v => v.toFixed(2)) + ' s' + o.scale.toArray().map(v => v.toFixed(2)))); return out.slice(0, 14).join('\n'); }
export function debugCena(f) { scene.traverse(f); }
export const neblinaAtual = () => [scene.fog.near, scene.fog.far];
export function neblina(perto, longe) { scene.fog.near = perto; scene.fog.far = longe; cam.far = longe + 80; cam.updateProjectionMatrix(); }
export const Cor = THREE.Color;
export const Caixa = THREE.Box3;
