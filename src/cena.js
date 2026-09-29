// Renderização 3D (three.js): carrega modelos.bin, monta o mundo com a geometria
// estática fundida (poucas chamadas de desenho — importante no celular),
// personagens animados, efeitos e a câmera (orbitando um ponto que pode ser arrastado).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
  const base = 4 + tam, loader = new GLTFLoader();
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
      for (const nome of ['position', 'normal', 'uv']) if (o.geometry.attributes[nome]) g.setAttribute(nome, toF32(o.geometry.attributes[nome]));
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
    const osso = corpo.getObjectByName(lado === 'l' ? 'handslot.l' : 'handslot.r');
    if (osso && modelos[arma]) osso.add(modelos[arma].scene.clone());
  }
  // todas as partes do corpo usam o mesmo esqueleto (1 textura de ossos por personagem, não 10)
  let esq = null;
  corpo.traverse(o => {
    if (!o.isSkinnedMesh) return;
    if (!esq) esq = o.skeleton;
    else if (o.skeleton.bones.length === esq.bones.length && o.skeleton.bones.every((b, i) => b.name === esq.bones[i].name)) o.bind(esq, o.bindMatrix);
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
  relogio += dt;
  if (!pontos) criarPontos();
  // efeitos
  for (let i = efeitos.length - 1; i >= 0; i--) {
    const e = efeitos[i]; e.t += dt; const k = e.t / e.dur;
    if (e.tipo === 'fade') e.o.material.opacity = Math.max(0, 0.55 * (1 - k));
    if (e.tipo === 'onda') { e.o.scale.setScalar(0.3 + k * e.raio); e.o.material.opacity = Math.max(0, 0.9 * (1 - k)); }
    if (e.tipo === 'aviso') e.cheio.scale.setScalar(Math.min(1, k));
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
