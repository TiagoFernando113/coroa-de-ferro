// Renderização 3D (three.js): carrega modelos.bin, monta o mundo com a geometria
// estática fundida (poucas chamadas de desenho — importante no celular),
// personagens animados, efeitos e a câmera em 3ª pessoa.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LIM, CASTELO, ZONAS } from './mundo.js';

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
  scene.background = ceu; scene.fog = new THREE.Fog(ceu, 38, 92);
  cam = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  hemi = new THREE.HemisphereLight(0xdff1ff, 0x5a7a3a, 1.35); scene.add(hemi);
  sol = new THREE.DirectionalLight(0xfff1d6, 2.4); sol.position.set(20, 40, 10);
  sol.castShadow = renderer.shadowMap.enabled;
  const tam = qualidade === 'alta' ? 2048 : 1024;
  sol.shadow.mapSize.set(tam, tam);
  Object.assign(sol.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
  sol.shadow.bias = -0.0008; sol.shadow.normalBias = 0.03;
  scene.add(sol, sol.target);
  medir();
  addEventListener('resize', medir);
}
function medir() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 62 : 52; cam.updateProjectionMatrix();
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
export function montarMundo(M) {
  // chão
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
  // portão do castelo (se abre com a chave)
  portao = clonar(pecas.Cgate); portao.scale.set(6, 5.5, 12.5); portao.rotation.y = Math.PI / 2;
  portao.position.set(CASTELO.portao.x, 0, CASTELO.portao.z); scene.add(portao);
  // baús
  for (const b of M.baus) { const o = clonar(pecas.Dchest); o.scale.setScalar(3); o.position.set(b.x, 0, b.z); o.rotation.y = b.ang; scene.add(o); bausObj[b.id] = o; }
  // luz fraca de fogueira no acampamento e tochas no castelo: pontos brilhantes (sem luzes reais)
  return filhos.length;
}
let portao = null; const bausObj = {};
export function abrirPortao(aberto) { if (portao) portao.visible = !aberto; }
export function bauAberto(id, aberto) { const b = bausObj[id]; if (b) b.rotation.x = aberto ? -0.3 : 0; }
const clonar = o => { const c = o.clone(); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1); return c; };

function texturaChao(M) {
  const N = 2048, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d'), k = N / (LIM * 2 + 40), W = (x) => (x + LIM + 20) * k;
  g.fillStyle = '#5c8f3a'; g.fillRect(0, 0, N, N);
  // manchas por zona
  const r = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < 9000; i++) {
    const x = r() * N, y = r() * N, wx = x / k - LIM - 20, wz = y / k - LIM - 20;
    const flo = wz < -28 && wx < 45, rui = wx > 40 && Math.abs(wz) < 40, cas = wz > 45 && Math.abs(wx) < 40;
    const h = flo ? 95 + r() * 20 : rui ? 60 + r() * 20 : 85 + r() * 25, s = flo ? 35 : rui ? 25 : 40 + r() * 15, l = flo ? 20 + r() * 8 : rui ? 32 + r() * 10 : 30 + r() * 12;
    g.fillStyle = `hsla(${h},${s}%,${l}%,${0.25 + r() * 0.3})`;
    g.beginPath(); g.arc(x, y, 3 + r() * 14, 0, 7); g.fill();
  }
  // caminhos de terra
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [cor, extra] of [['#7a5f3a', 1.2], ['#a58a5c', 0]]) for (const c of M.caminhos) {
    g.strokeStyle = cor; g.lineWidth = (c.w + extra) * k; g.beginPath();
    c.pts.forEach(([x, z], i) => i ? g.lineTo(W(x), W(z)) : g.moveTo(W(x), W(z))); g.stroke();
  }
  // praça de pedra
  g.fillStyle = '#9c9488'; g.beginPath(); g.arc(W(0), W(0), 11 * k, 0, 7); g.fill();
  g.strokeStyle = 'rgba(60,55,50,.35)'; g.lineWidth = 1.5;
  for (let rr = 2; rr < 11; rr += 1.6) { g.beginPath(); g.arc(W(0), W(0), rr * k, 0, 7); g.stroke(); }
  // pátio do castelo e clareira das ruínas
  g.fillStyle = '#8b857c'; g.fillRect(W(CASTELO.x0), W(CASTELO.z0), (CASTELO.x1 - CASTELO.x0) * k, (CASTELO.z1 - CASTELO.z0) * k);
  g.strokeStyle = 'rgba(50,45,40,.3)';
  for (let x = CASTELO.x0; x < CASTELO.x1; x += 3) { g.beginPath(); g.moveTo(W(x), W(CASTELO.z0)); g.lineTo(W(x), W(CASTELO.z1)); g.stroke(); }
  for (let z = CASTELO.z0; z < CASTELO.z1; z += 3) { g.beginPath(); g.moveTo(W(CASTELO.x0), W(z)); g.lineTo(W(CASTELO.x1), W(z)); g.stroke(); }
  g.fillStyle = '#a0916c'; g.beginPath(); g.arc(W(78), W(0), 13 * k, 0, 7); g.fill();
  g.fillStyle = '#6b5a3c'; g.beginPath(); g.arc(W(-31), W(-84), 11 * k, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
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
export function objeto(nome, esc = 1) { // peça avulsa (drops)
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
export const camera = { yaw: 0, pitch: 0.62, dist: 9, alvo: new THREE.Vector3(), tremor: 0 };
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
  c.alvo.lerp(olharTmp.set(foco.x, 1.3, foco.z), Math.min(1, dt * 10));
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
