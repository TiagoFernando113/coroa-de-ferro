/* =====================================================================
   Modo Chefão em 3D — desenha a luta do boss.js com three.js.
   A simulação (IA, poderes, dano) continua toda em boss.js; aqui só
   sincronizamos malhas com o estado R a cada quadro.
   Câmera em terceira pessoa atrás do Rei Orc, olhando os heróis.
   Gerado em boss3d.js por: node tools/boss3d/build.mjs
   ===================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const AW = 100, AH = 150, S = 0.1;           // unidades da arena → mundo
const wx = x => (x - AW / 2) * S, wz = y => (y - AH / 2) * S;
const CLIPS = { idle: 'idle', walk: 'walk', atk: 'attack-melee-right', die: 'die' };
const ARMAS = {
  espada: { m: 'espada', osso: 'arm-right', pos: [-0.02, -0.1, 0.04], rot: [90, 0, 0] },
  lanca: { m: 'lanca', osso: 'arm-right', pos: [-0.02, -0.1, 0.04], rot: [90, 0, 0] },
  escudoR: { m: 'escudoR', osso: 'arm-left', pos: [0.07, -0.07, 0.03], rot: [0, 90, 0], s: 0.75 },
  escudoQ: { m: 'escudoQ', osso: 'arm-left', pos: [0.07, -0.16, 0.03], rot: [0, 90, 0], s: 0.85 },
};
const TIPOS = {
  rei: { m: 'orc', armas: ['lanca'], esc: 3.4, coroa: true },
  cav: { m: 'humano', armas: ['espada', 'escudoR'], esc: 1.45 },
  lan: { m: 'lanceira', armas: ['lanca'], esc: 1.45 },
  mag: { m: 'maga', armas: [], esc: 1.45, cor: 0xc8a8ff, orbe: true },
  pal: { m: 'paladino', armas: ['espada', 'escudoQ'], esc: 1.5, cor: 0xffe39a },
  orc: { m: 'orc', armas: ['espada'], esc: 1.15 },
};

let ok = false, falhou = false, renderer, scene, cam, modelos = {}, ents = new Map(), extras = new Map(), clock = 0;
let pontos, pontosGeo, luzFuria;
const ray = new THREE.Raycaster(), chaoPlano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

async function carregar() {
  const txt = await (await fetch('modelos3d.json')).text();
  const dados = JSON.parse(txt), loader = new GLTFLoader();
  for (const [k, b64] of Object.entries(dados)) {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
    modelos[k] = await new Promise((res, rej) => loader.parse(bin, '', res, rej));
  }
}

function iniciar(host) {
  const cv = document.createElement('canvas'); cv.id = 'b3d'; host.prepend(cv);
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120c10); scene.fog = new THREE.Fog(0x120c10, 14, 30);
  cam = new THREE.PerspectiveCamera(55, 1, 0.1, 60);
  scene.add(new THREE.HemisphereLight(0xffe0c0, 0x2a1830, 1.1));
  const sol = new THREE.DirectionalLight(0xfff0dd, 1.6); sol.position.set(-4, 10, -3); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024); Object.assign(sol.shadow.camera, { left: -9, right: 9, top: 10, bottom: -10, near: 1, far: 30 });
  scene.add(sol);
  luzFuria = new THREE.PointLight(0xff3a1a, 0, 10); luzFuria.position.y = 2; scene.add(luzFuria);
  pontosGeo = new THREE.BufferGeometry();
  pontosGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 3), 3));
  pontosGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(600 * 3), 3));
  pontos = new THREE.Points(pontosGeo, new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, depthWrite: false }));
  pontos.frustumCulled = false; scene.add(pontos);
  medir(); addEventListener('resize', medir);
}
function medir() { if (!renderer) return; renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }

// chão de pedra com rachaduras de lava (textura gerada)
function texturaChao() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const n = ((i * 73856093) ^ (j * 19349663)) >>> 0;
    g.fillStyle = `hsl(${20 + n % 12},${8 + n % 6}%,${16 + (n >> 4) % 8}%)`; g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
  }
  g.strokeStyle = 'rgba(255,100,30,.6)'; g.lineWidth = 3; g.shadowColor = '#ff5a14'; g.shadowBlur = 10;
  for (let k = 0; k < 6; k++) { g.beginPath(); let x = (k * 97) % 512, y = (k * 151) % 512; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (k * s * 29) % 80 - 40; y += (k + s) * 23 % 70 - 20; g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function copia(nome, esc = 1) { const o = modelos[nome].scene.clone(true); o.scale.setScalar(esc); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }
function montarArena() {
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(AW * S, AH * S), new THREE.MeshStandardMaterial({ map: texturaChao(), roughness: 0.95 }));
  chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; scene.add(chao);
  const fora = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x1a1216 }));
  fora.rotation.x = -Math.PI / 2; fora.position.y = -0.01; scene.add(fora);
  // paredes em volta (peça de 1 unidade de largura, escala 1.2)
  const e = 1.2, hx = AW * S / 2, hz = AH * S / 2;
  for (let x = -hx; x <= hx + 0.01; x += e) for (const z of [-hz - 0.6, hz + 0.6]) { const p = copia('parede', e); p.position.set(x, 0, z); scene.add(p); }
  for (let z = -hz; z <= hz + 0.01; z += e) for (const x of [-hx - 0.6, hx + 0.6]) { const p = copia('parede', e); p.position.set(x, 0, z); p.rotation.y = Math.PI / 2; scene.add(p); }
  // colunas, tochas, bandeiras e enfeites
  for (const [x, z] of [[-hx + 0.4, -hz + 0.4], [hx - 0.4, -hz + 0.4], [-hx + 0.4, hz - 0.4], [hx - 0.4, hz - 0.4], [-hx + 0.4, 0], [hx - 0.4, 0]]) {
    const c = copia('coluna', 1.6); c.position.set(x, 0, z); scene.add(c);
    const fogo = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffb040 }));
    fogo.position.set(x, 1.9, z); fogo.userData.tocha = true; scene.add(fogo);
  }
  for (const [x, z] of [[-hx + 0.4, -hz + 0.4], [hx - 0.4, hz - 0.4]]) { const l = new THREE.PointLight(0xff9a40, 6, 9); l.position.set(x, 2, z); l.userData.tocha = true; scene.add(l); }
  for (const x of [-2, 2]) { const b = copia('bandeira', 1.6); b.position.set(x, 0, -hz - 0.3); scene.add(b); }
  const deco = [['barril', -hx + 1, -hz + 2], ['barril', hx - 1, -hz + 2.6], ['pedras', -hx + 1, hz - 2], ['bau', hx - 1.1, -hz + 1.2], ['pedras', hx - 1, 2]];
  for (const [n, x, z] of deco) { const d = copia(n, 1.3); d.position.set(x, 0, z); d.rotation.y = x * 7; scene.add(d); }
}

// cria o personagem (clone com esqueleto próprio, armas nos ossos e animações)
function criar(tipo) {
  const T = TIPOS[tipo], base = modelos[T.m];
  const o = SkeletonUtils.clone(base.scene);
  const mats = [];
  o.traverse(m => {
    if (m.isMesh) {
      m.castShadow = true; m.frustumCulled = false;
      m.material = m.material.clone(); mats.push(m.material);
      if (T.cor) m.material.color.setHex(T.cor);
    }
  });
  for (const a of T.armas) {
    const A = ARMAS[a], w = copia(A.m, A.s || 1), osso = o.getObjectByName(A.osso);
    w.position.set(...A.pos); w.rotation.set(...A.rot.map(d => d * Math.PI / 180));
    w.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); mats.push(m.material); } });
    (osso || o).add(w);
  }
  if (T.coroa) { // coroa dourada presa na cabeça
    const cab = o.getObjectByName('head'), coroa = new THREE.Group(), ouro = new THREE.MeshStandardMaterial({ color: 0xf2c94c, metalness: 0.7, roughness: 0.3, emissive: 0x3a2400 });
    const aro = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.04, 12, 1, true), ouro); coroa.add(aro);
    for (let k = 0; k < 6; k++) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 4), ouro); const a = k / 6 * Math.PI * 2; p.position.set(Math.cos(a) * 0.085, 0.045, Math.sin(a) * 0.085); coroa.add(p); }
    const rubi = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), new THREE.MeshStandardMaterial({ color: 0xe0302a, emissive: 0x600000 })); rubi.position.set(0, 0.005, 0.09); coroa.add(rubi);
    coroa.position.set(0, 0.34, 0.01); coroa.scale.setScalar(1.3); (cab || o).add(coroa);
  }
  let orbe = null;
  if (T.orbe) { orbe = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), new THREE.MeshBasicMaterial({ color: 0xd8b8ff })); const l = new THREE.PointLight(0xa070ff, 1.5, 2.5); orbe.add(l); const mao = o.getObjectByName('arm-right'); orbe.position.set(0, -0.14, 0.06); (mao || o).add(orbe); }
  const raiz = new THREE.Group(); raiz.add(o); o.scale.setScalar(T.esc); scene.add(raiz);
  const mixer = new THREE.AnimationMixer(o), acoes = {};
  for (const [k, n] of Object.entries(CLIPS)) {
    const clip = base.animations.find(a => a.name === n); if (!clip) continue;
    const a = mixer.clipAction(clip); if (k === 'atk' || k === 'die') { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
    acoes[k] = a;
  }
  // sombra redonda por baixo (fica bonita mesmo sem luz direta)
  const somb = new THREE.Mesh(new THREE.CircleGeometry(0.35 * T.esc / 1.45, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35, depthWrite: false }));
  somb.rotation.x = -Math.PI / 2; somb.position.y = 0.01; raiz.add(somb);
  return { raiz, o, mixer, acoes, anim: null, mats, orbe, tipo };
}
function tocar(E, anim) {
  if (E.anim === anim) return;
  const nova = E.acoes[anim]; if (!nova) return;
  const velha = E.anim && E.acoes[E.anim];
  nova.reset(); nova.setEffectiveWeight(1); nova.play();
  if (velha) velha.crossFadeTo(nova, anim === 'atk' ? 0.08 : 0.18, false);
  E.anim = anim;
}
function sync(q, tipo, dt) {
  let E = ents.get(q);
  if (!E) { E = criar(tipo); ents.set(q, E); }
  E.vivo = true;
  E.raiz.position.set(wx(q.x), 0, wz(q.y));
  const alvoRot = Math.atan2(q.fx, q.fy);
  let d = alvoRot - E.raiz.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
  E.raiz.rotation.y += d * Math.min(1, dt * 12);
  tocar(E, q.anim === 'walk' && tipo !== 'rei' && q.dashT > 0 ? 'walk' : q.anim);
  const f = q.flash > 0 ? 1 : 0;
  for (const m of E.mats) if (m.emissive) m.emissive.setScalar(f * 0.8);
  if (q.morto) { const a = Math.max(0, 1 - Math.max(0, q.mt - 0.9)); E.raiz.visible = a > 0.02; E.raiz.position.y = -Math.max(0, q.mt - 0.9) * 0.6; }
  E.mixer.update(dt * (q.dashT > 0 ? 1.8 : 1));
  if (E.orbe) E.orbe.scale.setScalar(1 + Math.sin(clock * 6) * 0.15);
}
function extra(chave, criarFn) { let e = extras.get(chave); if (!e) { e = criarFn(); scene.add(e); extras.set(chave, e); } e.userData.vivo = true; return e; }
const MAT_ZONA = new THREE.MeshBasicMaterial({ color: 0xff2a14, transparent: true, opacity: 0.25, depthWrite: false });
const MAT_ANEL = new THREE.MeshBasicMaterial({ color: 0xff3a1e, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
const MAT_FOGO = new THREE.MeshBasicMaterial({ color: 0xffa040 });
const MAT_MAGIA = new THREE.MeshBasicMaterial({ color: 0xc9a0ff });
const MAT_LANCA = new THREE.MeshStandardMaterial({ color: 0xc8ccd6, metalness: 0.6 });

function render(R, dt, overlay) {
  if (!ok) return false;
  clock += dt;
  for (const e of ents.values()) e.vivo = false;
  for (const e of extras.values()) e.userData.vivo = false;
  for (const o of scene.children) if (o.userData.tocha) { if (o.isLight) o.intensity = 5 + Math.sin(clock * 13 + o.position.x) * 1.2; else o.scale.setScalar(1 + Math.sin(clock * 17 + o.position.z) * 0.2); }
  if (R) {
    sync(R.boss, 'rei', dt);
    for (const h of R.herois) if (!(h.morto && h.mt > 2)) sync(h, h.cls.id, dt);
    for (const c of R.cap) sync(c, 'orc', dt);
    // zonas de aviso (círculo que enche) e explosões
    for (const z of R.zonas) {
      const m = extra(z, () => { const g = new THREE.Group(); const disco = new THREE.Mesh(new THREE.CircleGeometry(1, 32), MAT_ZONA.clone()); disco.rotation.x = -Math.PI / 2; const anel = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 40), MAT_ANEL.clone()); anel.rotation.x = -Math.PI / 2; const cheio = new THREE.Mesh(new THREE.CircleGeometry(1, 32), MAT_ZONA.clone()); cheio.rotation.x = -Math.PI / 2; cheio.position.y = 0.01; g.add(disco, anel, cheio); if (z.tipo === 'meteoro') { const bola = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), MAT_FOGO); bola.name = 'bola'; g.add(bola); const l = new THREE.PointLight(0xff7a2a, 3, 4); bola.add(l); } return g; });
      const p = Math.min(1, z.t / z.delay), r = z.r * S;
      m.position.set(wx(z.x), 0.03, wz(z.y)); m.children[0].scale.setScalar(r); m.children[1].scale.setScalar(r); m.children[2].scale.setScalar(r * p);
      m.children[0].material.opacity = z.foi ? Math.max(0, 0.7 - (z.t - z.delay) * 3) : 0.2;
      const bola = m.getObjectByName('bola'); if (bola) { bola.visible = !z.foi; bola.position.set(-(1 - p) * 2, (1 - p) * 9, -(1 - p) * 2); }
    }
    for (const o of R.ondas) { if (o.t < 0) continue; const m = extra(o, () => { const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 48), MAT_ANEL.clone()); r.rotation.x = -Math.PI / 2; return r; }); const raio = Math.max(0.01, o.t * o.v * S); m.scale.set(raio, raio, 1); m.position.set(wx(o.x), 0.15, wz(o.y)); m.material.opacity = Math.max(0, 0.9 - o.t * 0.3); }
    for (const p of R.proj) {
      const m = extra(p, () => {
        if (p.dono === 'boss') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), MAT_FOGO); b.add(new THREE.PointLight(0xff7a2a, 2, 3)); return b; }
        if (p.magia) return new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), MAT_MAGIA);
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), MAT_LANCA); l.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(l); return g;
      });
      m.position.set(wx(p.x), p.dono === 'boss' ? 1.2 : 0.8, wz(p.y));
      m.rotation.y = Math.atan2(p.vx, p.vy);
    }
    // partículas
    const pos = pontosGeo.attributes.position.array, cor = pontosGeo.attributes.color.array, c = new THREE.Color();
    let n = 0;
    for (const p of R.part) { if (n >= 600) break; pos[n * 3] = wx(p.x); pos[n * 3 + 1] = 0.3 + (p.t / p.vida) * 0.8; pos[n * 3 + 2] = wz(p.y); c.set(p.cor); cor[n * 3] = c.r; cor[n * 3 + 1] = c.g; cor[n * 3 + 2] = c.b; n++; }
    pontosGeo.setDrawRange(0, n); pontosGeo.attributes.position.needsUpdate = true; pontosGeo.attributes.color.needsUpdate = true;
    luzFuria.intensity = R.furia ? 6 + Math.sin(clock * 8) * 2 : 0; luzFuria.position.set(wx(R.boss.x), 2.5, wz(R.boss.y));
    // câmera atrás do rei, olhando para a frente (onde vêm os heróis)
    const bx = wx(R.boss.x), bz = wz(R.boss.y), tr = overlay.tremor || 0;
    const alvo = new THREE.Vector3(bx * 0.5, 6.2, bz - 7.2);
    cam.position.lerp(alvo, Math.min(1, dt * 4));
    cam.position.x += (Math.random() - 0.5) * tr * 0.4; cam.position.y += (Math.random() - 0.5) * tr * 0.4;
    cam.lookAt(bx * 0.5, 0, bz + 3.8);
  } else {
    // covil: câmera girando devagar pela arena vazia
    cam.position.set(Math.sin(clock * 0.15) * 7, 5, Math.cos(clock * 0.15) * 9); cam.lookAt(0, 0.5, 0);
    pontosGeo.setDrawRange(0, 0);
  }
  for (const [q, e] of ents) if (!e.vivo) { scene.remove(e.raiz); ents.delete(q); }
  for (const [k, e] of extras) if (!e.userData.vivo) { scene.remove(e); extras.delete(k); }
  renderer.render(scene, cam);
  return true;
}
// arena (x,y, altura em unidades do mundo) → pixel na tela, para textos e balões
const v3 = new THREE.Vector3();
function proj(x, y, h = 0) { v3.set(wx(x), h, wz(y)).project(cam); return [(v3.x + 1) / 2 * innerWidth, (1 - v3.y) / 2 * innerHeight, v3.z < 1]; }
// toque na tela → ponto da arena
function tap(sx, sy) {
  ray.setFromCamera(new THREE.Vector2(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1), cam);
  const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(chaoPlano, p)) return null;
  return [p.x / S + AW / 2, p.z / S + AH / 2];
}

window.M3D = {
  get pronto() { return ok; }, get falhou() { return falhou; },
  iniciar(host) {
    try {
      const t = document.createElement('canvas');
      if (!(t.getContext('webgl2') || t.getContext('webgl'))) throw new Error('sem WebGL');
      iniciar(host);
      carregar().then(() => { montarArena(); ok = true; }).catch(e => { falhou = true; console.warn('3D:', e); });
    } catch (e) { falhou = true; console.warn('3D:', e); }
  },
  render, proj, tap,
  mostrar(v) { if (renderer) renderer.domElement.style.display = v ? 'block' : 'none'; },
};
