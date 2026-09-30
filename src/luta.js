// Modo manual: você controla o líder no mapa do mundo (joystick), vai até o acampamento e luta.
// Os outros heróis da equipe seguem e lutam sozinhos. Vencer todos os monstros cumpre a missão.
import * as C from './cena.js';
import * as E from './estado.js';
import { S } from './estado.js';
import { missao, REGIOES, CLASSES, fmt } from './dados.js';
import { armaInfo, animAtaque } from './aparencia.js';
import { GUILDA_W, posCampo, ESC_MUNDO, CENTROS } from './mundo.js';
import { ico, som, ui } from './ui.js';
import { gerarItem, sortearRaridade, atributosEquip, RARIDADE_ITEM } from './itens.js';
import { MONSTROS } from './bestiario.js';
import { iniciarExpl, passoExpl, covilDerrotado, mapaGrande } from './explorar.js';

const $ = s => document.querySelector(s);
const difAng = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
let L = null;
export const emLuta = () => !!L;
window.__luta = () => L; // para testes
window.__monstro = (tp, dx, dz, elite) => L && L.inimigos.push(criarMonstro(tp, 0, L.lider.x + dx, L.lider.z + dz, elite));

// monstros de cada tipo de missão: [modelo, armas, escala, vida, dano, alcance, distância?]
const TIPOS = {
  lacaio: ['lacaio', [['lamina', 'r']], 1, 100, 8, 2.4, false],
  batedor: ['batedor', [['besta', 'r']], 1, 80, 7, 13, true],
  guerreiro: ['guerreiro', [['machado', 'r'], ['escudoP', 'l']], 1.15, 180, 12, 2.6, false],
  chefe: ['guerreiro', [['machado', 'r'], ['escudoG', 'l']], 2, 900, 22, 3.6, false],
};
// animais das emboscadas: [modelo, escala, vida, dano, anim de ataque]
const BICHOS = { lobo: ['bicho:Wolf', 1, 90, 9, 'Attack'], raposa: ['bicho:Fox', 0.9, 60, 7, 'Attack'], touro: ['bicho:Bull', 1, 220, 14, 'Attack_Headbutt'],
  cervo: ['bicho:Stag', 1, 160, 11, 'Attack_Headbutt'], husky: ['bicho:Husky', 1, 120, 10, 'Attack'] };
for (const [k, [mod, e0, vida, dano, nome, longe]] of Object.entries(MONSTROS)) BICHOS[k] = [mod, e0, vida, dano, 'Attack', nome, longe];
// encontros no caminho (como nos animes de MMO): bando comum, monstro raro ou um Monstro Único com nome
const ENCONTROS = [
  { txt: 'Um bando de lobos cercou você!', grupo: [['lobo'], ['lobo'], ['lobo']], peso: 5 },
  { txt: 'Raposas ladras no caminho!', grupo: [['raposa'], ['raposa']], peso: 3 },
  { txt: 'Um LOBO FEROZ apareceu!', grupo: [['lobo', 'Lobo Feroz', 1.7, 4, 0x8a2a2a]], peso: 3, raro: true },
  { txt: 'Um TOURO SELVAGEM investe contra você!', grupo: [['touro', 'Touro Selvagem', 1.5, 3, 0x6a3a2a]], peso: 2, raro: true },
  { txt: 'MONSTRO ÚNICO: Fenrir, o Lobo do Crepúsculo!', grupo: [['husky', 'Fenrir, o Lobo do Crepúsculo', 2.6, 12, 0x3a2a6a]], peso: 0.5, unico: true },
  { txt: 'MONSTRO ÚNICO: Cervo Espectral de Prata!', grupo: [['cervo', 'Cervo Espectral de Prata', 2.2, 10, 0x9ad8ff]], peso: 0.5, unico: true },
  { txt: 'Gosmas pularam do mato!', grupo: [['gosma'], ['gosmaR'], ['gosma'], ['gosmaR']], peso: 4 },
  { txt: 'Uma galinha possuída e seus capangas!', grupo: [['galinha', 'Galinha do Caos', 1.6, 3, 0xff4a2a], ['piu'], ['piu']], peso: 2, raro: true },
  { txt: 'Orquinhos saqueadores!', grupo: [['orquinho'], ['orquinho'], ['orc']], peso: 3 },
  { txt: 'Ninjas caíram das árvores!', grupo: [['ninjinha'], ['ninja'], ['ninjinha']], peso: 2 },
  { txt: 'Um enxame de abelhas blindadas!', grupo: [['abelha'], ['abelha'], ['abelha'], ['vespa']], peso: 3 },
  { txt: 'Fantasmas saíram da névoa...', grupo: [['fantasma'], ['espectro'], ['fantasma']], peso: 2 },
  { txt: 'Um COELHO BRUTAMONTES quer briga!', grupo: [['coelho', 'Coelho Brutamontes', 1.4, 4, 0xffffff]], peso: 2, raro: true },
  { txt: 'Um YETI furioso desceu da montanha!', grupo: [['yeti', 'Yeti Furioso', 1.4, 4, 0x9ad8ff], ['yetinho'], ['yetinho']], peso: 2, raro: true },
  { txt: 'Visitantes estelares desceram!', grupo: [['alien'], ['alienzinho'], ['alienzinho']], peso: 1.5, raro: true },
  { txt: 'MONSTRO ÚNICO: Rei Cogumelo, Senhor dos Esporos!', grupo: [['reiCogu', 'Rei Cogumelo, Senhor dos Esporos', 1.8, 12, 0xb84aff], ['cogu'], ['cogu']], peso: 0.5, unico: true },
  { txt: 'MONSTRO ÚNICO: Tiamat, a Dragoa Escarlate!', grupo: [['draco', 'Tiamat, a Dragoa Escarlate', 2, 14, 0xff2a2a]], peso: 0.4, unico: true },
  { txt: 'MONSTRO ÚNICO: Grumak, o Orc Imortal!', grupo: [['orcCaveira', 'Grumak, o Orc Imortal', 1.8, 13, 0x5a2a8a], ['orquinho'], ['orquinho']], peso: 0.4, unico: true },
  { txt: 'MONSTRO ÚNICO: Sr. Fofinho, o Coelho do Apocalipse!', grupo: [['coelho', 'Sr. Fofinho, o Coelho do Apocalipse', 2, 12, 0xff6ab8]], peso: 0.4, unico: true },
];
// habilidades dos monstros (estilo Brawl Stars): aviso no chão, depois o golpe — dá para esquivar
const HAB = {
  lobo: 'investida', husky: 'investida', touro: 'investida', cervo: 'investida', raptor: 'investida', alpaca: 'investida', alpacaRei: ['investida', 'salto'],
  abelha: 'investida', vespa: 'investida', galinha: 'investida', cao: 'investida', gato: 'teleporte', raposa: 'teleporte',
  gosma: 'salto', gosmaR: 'salto', sapo: 'salto', coelho: 'salto', yeti: ['salto', 'giro'], golem: 'salto', demonio: ['salto', 'anel'], yetinho: 'salto', golenzinho: 'salto',
  lula: 'leque', bruxo: 'leque', piu: 'leque', passaro: 'leque', draguinho: 'leque', pombo: 'leque', peixe: 'leque', glub: 'leque',
  alien: 'rajada', alienzinho: 'rajada', mascara: 'rajada', espectro: 'rajada', xama: ['rajada', 'veneno'], batedor: 'rajada',
  draco: ['anel', 'leque'], demonioA: 'anel', redemoinho: 'anel', cactoro: 'anel', cactinho: 'anel',
  orc: 'giro', orcCaveira: ['giro', 'invocar'], tritao: 'giro', mangusto: 'giro', guerreiro: 'giro', chefe: ['salto', 'giro'], orquinho: 'giro',
  espinho: 'veneno', cogu: 'veneno', cogumelao: 'veneno', glubao: 'veneno', reiCogu: ['invocar', 'veneno'],
  fantasma: 'teleporte', ninja: 'teleporte', ninjinha: 'teleporte',
};
const NOME_HAB = { investida: 'Investida!', salto: 'Salto!', leque: 'Leque!', rajada: 'Rajada!', anel: 'Explosão!', giro: 'Giro!', veneno: 'Veneno!', teleporte: 'Sumiu!', invocar: 'Invocação!' };
const ALC_HAB = { investida: 12, salto: 13, leque: 12, rajada: 15, anel: 8, giro: 4.5, veneno: 13, teleporte: 16, invocar: 14 };
const INVOCA = { reiCogu: 'cogu', orcCaveira: 'orquinho' };
function habMonstro(e, hb, a) {
  const j = L.lider, ang = Math.atan2(a.x - e.x, a.z - e.z), s = Math.max(1, (e.v.raiz.scale.x / ESC_MUNDO) * 0.8);
  const anim = (...ns) => { const n = ns.find(n => e.v.tem(n)) || (e.bicho ? 'Attack' : '1H_Melee_Attack_Chop'); e.v.tocar(n, { loop: false, reinicia: true }); };
  const lanc = (t, f) => { e.lanc = { t, f }; };
  e.ang = ang; numero(e.x, (e.alt || 4) + 1.2, e.z, NOME_HAB[hb], '#ffb02e');
  if (hb === 'investida') { const c = 13; C.avisoLinha(e.x, e.z, ang, c, 2.2 * s, 0.7); e.v.tocar(e.bicho ? 'Idle' : 'Idle_Combat');
    lanc(0.7, () => { e.investe = { t: 0.35, vx: Math.sin(ang) * c / 0.35, vz: Math.cos(ang) * c / 0.35, acertou: false, r: 1.6 * s }; e.v.tocar(e.bicho ? 'Gallop' : 'Running_A', { vel: 2 }); }); }
  if (hb === 'salto') { const r = 3.3 * s; C.aviso(a.x, a.z, r, 0.9); anim('Attack2', 'Jump_Full_Short', '1H_Melee_Attack_Jump_Chop');
    e.pulo = { t: 0, dur: 0.9, x0: e.x, z0: e.z, x1: a.x, z1: a.z, r, h: 4 + s * 2 }; }
  if (hb === 'leque') { C.avisoCone(e.x, e.z, ang, 12, 0.5, 0.55);
    lanc(0.55, () => { anim('Attack'); for (let k = -2; k <= 2; k++) atirar(e, ang + k * 0.2, 'fogo', 13, e.dano * 0.8, false); }); }
  if (hb === 'rajada') { C.avisoLinha(e.x, e.z, ang, 16, 0.7, 0.4, 0xb84aff);
    lanc(0.4, () => { for (let i = 0; i < 3; i++) setTimeout(() => { if (!L || e.hp <= 0) return; anim('Attack', '2H_Ranged_Shoot'); atirar(e, Math.atan2(j.x - e.x, j.z - e.z), 'magia', 17, e.dano * 0.7, false); }, i * 230); }); }
  if (hb === 'anel') { C.aviso(e.x, e.z, 2.5 * s, 0.6, 0xff7a2a);
    lanc(0.6, () => { anim('Attack2', 'Attack'); C.onda(e.x, e.z, 3 * s, 0xff7a2a, 0.4); for (let i = 0; i < 12; i++) atirar(e, i * Math.PI / 6, 'fogo', 11, e.dano * 0.8, false); }); }
  if (hb === 'giro') { const r = 4 * s; C.aviso(e.x, e.z, r, 0.7);
    lanc(0.7, () => { anim('2H_Melee_Attack_Spinning', 'Attack2', 'Attack'); C.onda(e.x, e.z, r, 0xffc07a, 0.4); C.camera.tremor = Math.max(C.camera.tremor, 0.2);
      for (const h of [j, ...L.aliados]) if (dist(h, e) < r + 0.6) ferirHeroi(h, e.dano * 1.8); }); }
  if (hb === 'veneno') { const r = 3.2, x = a.x, z = a.z; C.aviso(x, z, r, 0.8, 0x6aff3a);
    lanc(0.8, () => { anim('Attack'); C.faiscas(x, 1, z, 0x7aff4a, 20, 4); L.zonas.push({ x, z, r, t: 4, tick: 0, dano: e.dano * 0.45, o: C.poca(x, z, r, 4) }); }); }
  if (hb === 'teleporte') { C.faiscas(e.x, 2, e.z, 0xb84aff, 25, 4); e.v.raiz.visible = false; e.sumido = true;
    lanc(0.55, () => { const b = j.ang + Math.PI; e.x = j.x + Math.sin(b) * 2.6; e.z = j.z + Math.cos(b) * 2.6; e.v.raiz.visible = true; e.sumido = false; C.faiscas(e.x, 2, e.z, 0xb84aff, 25, 4);
      C.aviso(e.x, e.z, 2.8, 0.4); e.ang = Math.atan2(j.x - e.x, j.z - e.z);
      lanc(0.4, () => { anim('Attack', '1H_Melee_Attack_Chop'); if (dist(j, e) < 3.3) ferirHeroi(j, e.dano * 1.6); }); }); }
  if (hb === 'invocar') { C.aviso(e.x, e.z, 3.5, 0.8, 0xb84aff); anim('Attack2', 'Spellcast_Summon', 'Attack');
    lanc(0.8, () => { if (L.inimigos.filter(m => m.invocado && m.hp > 0).length >= 4) return;
      for (let k = 0; k < 2; k++) { const aa = Math.random() * 6.28, m = criarMonstro(INVOCA[e.tp] || 'gosma', e.r ?? L.q.r, e.x + Math.cos(aa) * 3, e.z + Math.sin(aa) * 3);
        Object.assign(m, { acordado: true, invocado: true, mundo: !!L.explorar, nome: null }); C.faiscas(m.x, 1, m.z, 0xb84aff, 15, 3); L.inimigos.push(m); } }); }
}
const GRUPOS = [['lacaio', 'lacaio'], ['lacaio', 'batedor', 'lacaio'], ['guerreiro', 'batedor', 'lacaio', 'lacaio', 'batedor'], ['chefe', 'lacaio', 'lacaio']];
const alcanceArma = v => ({ arco: 14, besta: 13, magia: 12 }[armaInfo(v.arma).tipo] || 2.8);

export function iniciarLuta(qid, ids, aoFim) {
  const q = S.quadro.find(x => x.id === qid); if (!q || L) return false;
  ids = ids.filter(id => E.heroi(id)?.estado === 'livre'); if (!ids.length) return false;
  const guiaId = ids.includes(S.lider) ? S.lider : ids[0]; // você sempre controla o seu herói principal
  const m = missao(q.r, q.t), razao = Math.max(0.2, E.poderEquipe(ids, q.r) / m.req), forca = Math.sqrt(razao);
  q.emLuta = true; for (const id of ids) E.heroi(id).estado = 'missao';
  const campo = posCampo(q.r, q.dx, q.dy), s = E.sis();
  const mk = (h, x, z) => { const v = C.heroi(h.visual); v.raiz.scale.setScalar(ESC_MUNDO); v.raiz.position.set(x, 0, z); v.tocar('Idle_A'); return { h, v, x, z, ang: 0, cd: 0, alc: alcanceArma(h.visual) }; };
  const lider = mk(E.heroi(guiaId), GUILDA_W.x + 6, GUILDA_W.z - 6);
  // o nível já entra no poder da equipe (forca); aqui entram os atributos e o equipamento do seu herói
  const st = E.statsHeroi(), eq = atributosEquip(S.equip), meu = guiaId === S.lider;
  lider.max = lider.hp = 120 + (meu ? s.a.vit * 12 + eq.vida : 0); lider.dano = 26 * forca * (meu ? (1 + s.a.for * 0.03) * (1 + eq.atk / 100) : 1); lider.cds = [0, 0, 0];
  Object.assign(lider, meu ? { crit: st.crit, def: st.def, vel: st.vel, hab: st.hab, recarga: st.recarga } : { crit: 0.1, def: 0, vel: 0, hab: 1, recarga: 1 });
  const aliados = ids.filter(id => id !== guiaId).map((id, i) => { const a = mk(E.heroi(id), lider.x - 3 - i * 2, lider.z + 3); a.dano = 12 * forca; return a; });
  const inimigos = GRUPOS[q.t].map((tp, i) => {
    const [mod, armas, esc, vida, dano, alc, longe] = TIPOS[tp], v = C.personagem(mod, armas, esc); v.raiz.scale.setScalar(ESC_MUNDO * (tp === 'chefe' ? 1 : 1));
    const a = i * 2.1, x = campo.x + Math.cos(a) * (i ? 5 : 0), z = campo.z + Math.sin(a) * (i ? 5 : 0);
    v.raiz.position.set(x, 0, z); v.tocar(v.tem('Idle_Combat') ? 'Idle_Combat' : 'Idle');
    return { tp, v, x, z, hp: vida, max: vida, dano: dano / forca, alc, longe, cd: 1 + Math.random(), ang: 0, acordado: false, chefe: tp === 'chefe' };
  });
  L = { q, ids, lider, aliados, inimigos, proj: [], txt: [], joy: null, mx: 0, mz: 0, t: 0, campo, aoFim, fim: false, reg: REGIOES[q.r], m, forca, loot: [],
    distTotal: Math.hypot(campo.x - lider.x, campo.z - lider.z), emboscada: Math.random() < 0.6 + q.rank * 0.05 ? 0.35 + Math.random() * 0.3 : null };
  ui.foco = { x: lider.x, z: lider.z }; C.camera.dist = 27; C.camera.pitch = 0.78; C.camera.yaw = Math.PI - 0.3; C.camera.suave = 8; L.neblina = C.neblinaAtual(); C.neblina(55, 135); C.recorte(true);
  montarHud(); som('enviar');
  return true;
}

// ---------------- mundo aberto: explorar livremente ----------------
// monstros de cada região (reaparecem): tipos de TIPOS (esqueletos) ou BICHOS (animais)
const FAUNA = [
  ['lobo', 'raposa', 'gosma', 'gosmaR', 'cogu', 'galinha', 'gato', 'cao', 'abelha', 'pombo', 'coelho'],
  ['sapo', 'peixe', 'tritao', 'glub', 'lula', 'espinho', 'bruxo', 'reiCogu', 'lacaio'],
  ['yeti', 'yetinho', 'alpaca', 'passaro', 'piu', 'husky', 'lobo'],
  ['cactoro', 'cactinho', 'raptor', 'mangusto', 'xama', 'redemoinho', 'batedor', 'touro'],
  ['golenzinho', 'golem', 'cogumelao', 'ninja', 'ninjinha', 'alien', 'alienzinho', 'cervo'],
  ['demonio', 'demonioA', 'draguinho', 'draco', 'mascara', 'vespa', 'guerreiro'],
  ['fantasma', 'espectro', 'orcCaveira', 'glubao', 'lacaio', 'batedor', 'guerreiro'],
  ['orc', 'orquinho', 'orcCaveira', 'alpacaRei', 'draco', 'guerreiro', 'batedor']];
export function iniciarExploracao(aoFim) {
  if (L) return false; const h = E.lider(); if (!h || h.estado !== 'livre') return false;
  h.estado = 'missao'; const st = E.statsHeroi();
  const v = C.heroi(h.visual); v.raiz.scale.setScalar(ESC_MUNDO);
  const lider = { h, v, x: GUILDA_W.x + 6, z: GUILDA_W.z - 6, ang: 0, cd: 0, alc: alcanceArma(h.visual), cds: [0, 0, 0], max: st.vida, hp: st.vida, dano: st.dano, crit: st.crit, def: st.def, vel: st.vel, hab: st.hab, recarga: st.recarga };
  v.raiz.position.set(lider.x, 0, lider.z); v.tocar('Idle_A');
  L = { explorar: true, q: { nome: 'Explorando o mundo', r: 0, rank: 0, mult: 1 }, ids: [h.id], lider, aliados: [], inimigos: [], proj: [], txt: [], joy: null, mx: 0, mz: 0, t: 0,
    campo: null, aoFim, fim: false, reg: REGIOES[0], forca: 1, loot: [], emboscada: null, spawnT: 0, ganhos: { xp: 0, ouro: 0, mortes: 0 } };
  ui.foco = { x: lider.x, z: lider.z }; C.camera.dist = 27; C.camera.pitch = 0.78; C.camera.yaw = Math.PI - 0.3; C.camera.suave = 8; L.neblina = C.neblinaAtual(); C.neblina(55, 135); C.recorte(true);
  montarHud(); som('enviar');
  iniciarExpl({ L: () => L, criarMonstro, numero, faixa });
  return true;
}
function criarMonstro(tp, r, x, z, elite = false) {
  const bicho = !!BICHOS[tp], hpM = 1.9 ** r * (elite ? 3 : 1), dM = 1.65 ** r * (elite ? 1.6 : 1);
  let v, d;
  if (bicho) { const [mod, e0, vida, dano, atk, nome, longe] = BICHOS[tp]; v = C.personagem(mod, [], 1); v.raiz.scale.setScalar(ESC_MUNDO * e0 * (elite ? 1.5 : 1)); d = { vida, dano, alc: longe ? 11 : 2.8 * (elite ? 1.5 : 1), atkAnim: atk, nome, longe }; }
  else { const [mod, armas, esc, vida, dano, alc, longe] = TIPOS[tp]; v = C.personagem(mod, armas, esc * (elite ? 1.4 : 1)); v.raiz.scale.setScalar(ESC_MUNDO); d = { vida, dano, alc, longe }; }
  if (elite) v.corpo.traverse(o => { if (o.isMesh) o.material.color.lerp(new C.Cor(0xff4a2a), 0.35); });
  v.raiz.position.set(x, 0, z); v.tocar('Idle');
  return { tp, v, x, z, hp: d.vida * hpM, max: d.vida * hpM, dano: d.dano * dM, alc: d.alc, longe: d.longe, atkAnim: d.atkAnim, bicho, cd: 1, ang: Math.random() * 6, acordado: false,
    r, raro: elite, grande: elite, nome: d.nome || elite ? `${[elite && (bicho ? 'Alfa' : 'Capitão'), d.nome].filter(Boolean).join(' ')} · Nv ${Math.round(1 + r * 8) + (elite ? 3 : 0)}` : null, mundo: true, alt: altura(v) };
}
function povoarMundo(dt) {
  const j = L.lider; L.spawnT -= dt; if (L.spawnT > 0) return; L.spawnT = 1.2;
  // região mais perto define o nível e os tipos de monstro
  let r = 0, d0 = 1e9; CENTROS.forEach((c, i) => { const d = Math.hypot(c.x - j.x, c.z - j.z); if (d < d0) { d0 = d; r = i; } });
  if (L.reg !== REGIOES[r]) { L.reg = REGIOES[r]; L.q.r = r; const t = $('#luta .lMissao small'); if (t) t.innerHTML = `${ico(L.reg.icone)} ${L.reg.nome} · <span id="lRest"></span>`; if (r > S.regiao) faixa('ZONA PERIGOSA', `${L.reg.nome}: monstros muito fortes!`); }
  // some quem ficou longe; nasce gente nova perto (fora da vista imediata)
  for (const e of L.inimigos) if (!e.sumiu && Math.hypot(e.x - j.x, e.z - j.z) > 110) { e.sumiu = true; e.v.remover(); }
  L.inimigos = L.inimigos.filter(e => !e.sumiu && !(e.hp <= 0 && e.morreu > 5));
  const vivos = L.inimigos.filter(e => e.hp > 0 && Math.hypot(e.x - j.x, e.z - j.z) < 70).length;
  if (vivos >= 7 || Math.hypot(GUILDA_W.x - j.x, GUILDA_W.z - j.z) < 25) return;
  const a = Math.random() * 6.28, dd = 26 + Math.random() * 22, x = j.x + Math.cos(a) * dd, z = j.z + Math.sin(a) * dd;
  const elite = Math.random() < 0.06, tipos = FAUNA[r], tp = tipos[Math.floor(Math.random() * tipos.length)];
  const grupo = BICHOS[tp] && !elite && BICHOS[tp][2] < 130 ? 1 + Math.floor(Math.random() * 3) : 1; // só os pequenos andam em bando
  for (let k = 0; k < grupo; k++) L.inimigos.push(criarMonstro(tp, r, x + k * 2.5, z + k * 1.5, elite));
}
// altura real do modelo na tela (barra de vida e nome logo acima da cabeça)
const _cx = new C.Caixa();
function altura(v) { v.raiz.updateMatrixWorld(true); _cx.setFromObject(v.corpo); return Math.max(2.5, _cx.max.y - _cx.min.y); }
function recompensaMundo(e) {
  const xp = Math.round(12 * 2.2 ** e.r * (e.raro ? 5 : 1)), ouro = Math.round(6 * 2.6 ** e.r * (e.raro ? 6 : 1) * (0.7 + Math.random() * 0.6));
  E.ganharXPSis(xp); S.ouro += ouro; S.st.ouroTotal += ouro; L.ganhos.xp += xp; L.ganhos.ouro += ouro; L.ganhos.mortes++;
  numero(e.x, 5, e.z, `+${xp} XP`, '#9fe3ff'); numero(e.x + 1, 3.5, e.z, `+${fmt(ouro)} ouro`, '#ffd84a');
}

// ---------------- HUD e controles ----------------
function montarHud() {
  $('#hud').style.visibility = 'hidden';
  const el = document.createElement('div'); el.id = 'luta';
  el.innerHTML = `<div class="lTopo"><button class="btn vermelho peq" data-l="sair">${ico('sair')} ${L.explorar ? 'Voltar' : 'Desistir'}</button>
      <div class="lMissao"><b>${L.q.nome}</b><small>${ico(L.reg.icone)} ${L.reg.nome} · <span id="lRest"></span></small></div></div>
    <div class="lVida"><span class="retrato">${ico(CLASSES[L.lider.h.cls].icone)}</span><div class="barra vida"><i></i><span></span></div></div>
    <div id="lSeta">${ico('seta')}</div>
    <canvas id="lJoy"></canvas>${L.explorar ? '<canvas id="lMapa" width="260" height="260"></canvas>' : ''}<div id="lNums"></div><div id="lBarras"></div>
    <div class="lAcoes">
      <button class="lb h1" data-hab="0">${ico(L.lider.alc > 5 ? 'h_chuva' : 'h_giro')}<i></i></button>
      <button class="lb h2" data-hab="1">${ico(L.lider.alc > 5 ? 'h_fogo' : 'h_investida')}<i></i></button>
      <button class="lb esq" data-hab="2">${ico('esquiva')}<i></i></button>
    </div>`;
  document.body.append(el);
  const cv = $('#lJoy'), g = cv.getContext('2d'); L.g = g;
  const medir = () => { cv.width = innerWidth; cv.height = innerHeight; }; medir(); L.medir = medir; addEventListener('resize', medir);
  // toque: eventos de toque nativos (multitoque confiável no WebView do Android): um dedo no joystick e outro nas habilidades
  const hab = alvo => alvo?.closest?.('[data-hab]');
  el.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) {
      const b = hab(t.target); if (b) { e.preventDefault(); usarHab(+b.dataset.hab); continue; }
      if (t.target === cv && !L.joy) { e.preventDefault(); L.joy = { id: 't' + t.identifier, sx: t.clientX, sy: t.clientY, x: t.clientX, y: t.clientY }; }
    }
  }, { passive: false });
  el.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (L?.joy?.id === 't' + t.identifier) { e.preventDefault(); L.joy.x = t.clientX; L.joy.y = t.clientY; } }, { passive: false });
  const soltaT = e => { for (const t of e.changedTouches) if (L?.joy?.id === 't' + t.identifier) L.joy = null; };
  el.addEventListener('touchend', soltaT); el.addEventListener('touchcancel', soltaT);
  // mouse (computador)
  cv.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || L.joy) return; L.joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (L.joy && e.pointerId === L.joy.id) { L.joy.x = e.clientX; L.joy.y = e.clientY; } });
  const solta = e => { if (L?.joy && e.pointerId === L.joy.id) L.joy = null; };
  cv.addEventListener('pointerup', solta); cv.addEventListener('pointercancel', solta);
  el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; const b = hab(e.target); if (b) { e.preventDefault(); usarHab(+b.dataset.hab); } });
  el.addEventListener('click', e => { if (e.target.closest('[data-l="sair"]')) terminar(false, true); if (e.target.id === 'lMapa') { som('abrir'); mapaGrande(L.lider); } });
}
function numero(x, y, z, txt, cor, grande = false) { L.txt.push({ x, y, z, txt, cor, grande, t: 0 }); }

// ---------------- habilidades ----------------
function usarHab(i) {
  const j = L.lider; if (L.fim || j.cds[i] > 0 || j.hp <= 0) return;
  const longe = j.alc > 5;
  if (i === 2) { // esquiva: impulso na direção do joystick
    j.cds[2] = 1.2 * j.recarga; j.iframes = 0.45; j.dash = { t: 0.35, ax: L.mx || Math.sin(j.ang), az: L.mz || Math.cos(j.ang) };
    j.v.tocar('Dodge_Forward', { loop: false, reinicia: true, vel: 1.3 }); som('clique'); return;
  }
  const alvo = maisPerto(j, 20);
  if (i === 0) { // área: giro (perto) ou chuva de flechas/magia (longe) no alvo
    j.cds[0] = 6 * j.recarga; const c = longe && alvo ? alvo : j, r = longe ? 6 : 5.5;
    j.v.tocar(longe ? 'Ranged_Magic_Raise' : 'Melee_2H_Attack_Spin', { loop: false, reinicia: true }); j.trava = L.t + 0.7;
    if (longe) C.aviso(c.x, c.z, r, 0.7, 0x3aaaff);
    setTimeout(() => { if (!L) return; C.onda(c.x, c.z, r, longe ? 0x7ad0ff : 0xffe0a0, 0.5); C.faiscas(c.x, 1, c.z, longe ? 0x7ad0ff : 0xffd84a, 30, 5); C.camera.tremor = 0.25;
      for (const e of L.inimigos) if (e.hp > 0 && dist(e, c) < r + 1) ferir(e, j.dano * 2.4 * j.hab); }, longe ? 700 : 300);
  } else { // investida (perto) ou bola de fogo (longe)
    j.cds[1] = 8 * j.recarga;
    if (alvo) j.ang = Math.atan2(alvo.x - j.x, alvo.z - j.z);
    if (longe) { j.v.tocar('Ranged_Magic_Shoot', { loop: false, reinicia: true }); j.trava = L.t + 0.5; atirar(j, j.ang, 'fogo', 22, j.dano * 3 * j.hab, true, 4); }
    else { j.dash = { t: 0.35, ax: Math.sin(j.ang), az: Math.cos(j.ang), bate: new Set() }; j.iframes = 0.4; j.v.tocar('Melee_1H_Attack_Stab', { loop: false, reinicia: true }); }
  }
  som('espada');
}
function maisPerto(de, raio) { let m = null, d0 = raio; for (const e of L.inimigos) if (e.hp > 0 && !e.sumido) { const d = dist(de, e); if (d < d0) { d0 = d; m = e; } } return m; }
function atirar(de, ang, tipo, vel, dano, dono, explode = 0) {
  const o = C.projetil(tipo); o.scale.setScalar(1.6); const p = { x: de.x + Math.sin(ang) * 1.5, z: de.z + Math.cos(ang) * 1.5, vx: Math.sin(ang) * vel, vz: Math.cos(ang) * vel, o, dano, dono, explode, andou: 0 };
  o.position.set(p.x, 2, p.z); o.rotation.y = ang; L.proj.push(p);
}
function ferir(e, v) {
  if (e.hp <= 0) return; v = Math.round(v * (0.9 + Math.random() * 0.2)); const crit = Math.random() < (L.lider.crit || 0.12); if (crit) v = Math.round(v * 1.8);
  e.hp -= v; e.acordado = true; e.flash = 0.12; numero(e.x, e.chefe ? 7 : 4, e.z, (crit ? '!' : '') + fmt(v), crit ? '#ffd84a' : '#fff', crit);
  C.faiscas(e.x, 1.5, e.z, crit ? 0xffd84a : 0xffffff, crit ? 12 : 6, 3);
  if (e.hp <= 0) { e.lanc = e.pulo = e.investe = null; e.sumido = false; e.v.raiz.visible = true; e.v.raiz.position.y = 0; e.v.tocar(e.bicho ? 'Death' : 'Death_A', { loop: false, reinicia: true }); e.morreu = 0; som('compra'); if (e.covil) covilDerrotado(e); if (e.mundo) { recompensaMundo(e); if (Math.random() < (e.raro ? 1 : 0.08)) soltarLoot(e); } else soltarLoot(e); }
  else if (!e.chefe && !e.grande && Math.random() < 0.4) e.v.tocar(e.bicho ? 'Idle_HitReact1' : 'Hit_A', { loop: false, reinicia: true });
}
function ferirHeroi(a, v) {
  if (a.iframes > 0 || a.hp <= 0) return;
  if (a === L.lider) { v *= 1 - (a.def || 0); a.hp -= v; a.flash = 0.15; numero(a.x, 4, a.z, '-' + fmt(Math.round(v)), '#ff5a4a'); C.camera.tremor = Math.max(C.camera.tremor, 0.12);
    if (a.hp <= 0) { a.hp = 0; a.v.tocar('Death_A', { loop: false, reinicia: true }); if (L.explorar) faixa('VOCÊ CAIU', 'Voltando para a guilda...'); setTimeout(() => terminar(false), 1800); L.fim = true; } }
}

// ---------------- emboscadas e loot ----------------
function sortearEncontro() {
  const peso = e => e.peso * (e.unico ? 1 + L.q.rank : 1), tot = ENCONTROS.reduce((s, e) => s + peso(e), 0); let x = Math.random() * tot;
  for (const e of ENCONTROS) { x -= peso(e); if (x <= 0) return e; } return ENCONTROS[0];
}
function emboscar() {
  const enc = sortearEncontro(), j = L.lider; L.emboscada = null; L.encontro = enc;
  enc.grupo.forEach(([tp, nome, esc = 1, vidaX = 1, cor], i) => {
    const [mod, e0, vida, dano, atk, nome0, longe] = BICHOS[tp], v = C.personagem(mod, [], 1); v.raiz.scale.setScalar(ESC_MUNDO * e0 * esc);
    if (cor != null) v.corpo.traverse(o => { if (o.isMesh) { o.material.color.lerp(new C.Cor(cor), 0.55); if (o.material.emissive) o.material.emissive.setHex(cor).multiplyScalar(0.15); } });
    const a = Math.random() * 6.28, x = j.x + Math.cos(a) * (10 + i * 2), z = j.z + Math.sin(a) * (10 + i * 2); v.raiz.position.set(x, 0, z); v.tocar('Idle');
    const vv = vida * vidaX * (1 + L.q.r * 0.3);
    L.inimigos.push({ tp, v, x, z, hp: vv, max: vv, dano: dano * (1 + L.q.r * 0.2) * (enc.unico ? 1.6 : 1) / L.forca, alc: longe ? 11 : 2.8 * esc, longe, cd: 1.5, ang: 0, acordado: true, bicho: true, atkAnim: atk,
      nome: nome || nome0, alt: altura(v), raro: enc.raro, unico: enc.unico, grande: esc > 1.4, emb: true });
  });
  faixa(enc.unico ? '★ MONSTRO ÚNICO ★' : 'EMBOSCADA!', enc.txt, enc.unico ? 'unico' : ''); C.camera.tremor = 0.4; som(enc.unico ? 'lendario' : 'falha');
}
function soltarLoot(e) {
  const r = e.r ?? L.q.r, nivel = Math.max(1, E.sis().nivel) + r * 3;
  const chance = e.unico || e.raro || e.chefe ? 1 : 0.14, bonus = e.unico ? 1 : e.raro || e.chefe ? 0.6 : 0;
  if (Math.random() > chance) return;
  const itens = [gerarItem(nivel, e.unico ? Math.max(3, sortearRaridade(1)) : sortearRaridade(bonus))];
  if (e.unico) itens.push(gerarItem(nivel, sortearRaridade(1)));
  for (const it of itens) { L.loot.push(it); const R = RARIDADE_ITEM[it.rar]; numero(e.x, 6, e.z, `${R.nome}!`, R.cor, true); C.faiscas(e.x, 2, e.z, parseInt(R.cor.slice(1), 16), 30, 5); }
  const bau = C.objeto('D:chest', 2.4); bau.position.set(e.x, 0, e.z); L.baus = [...(L.baus || []), bau];
}
let faixaAte = 0; // uma faixa por vez (as outras esperam na fila)
function faixa(tit, sub, cls = '') {
  const agora = performance.now(), espera = Math.max(0, faixaAte - agora); faixaAte = agora + espera + 2600;
  setTimeout(() => { const box = $('#luta'); if (!box) return; const f = document.createElement('div'); f.className = 'lFaixa ' + cls; f.innerHTML = `<b>${tit}</b><span>${sub}</span>`; box.append(f); setTimeout(() => f.remove(), 2600); }, espera);
}

// ---------------- laço ----------------
export function passoLuta(dt) {
  if (!L) return;
  L.t += dt; const j = L.lider;
  if (L.explorar) { povoarMundo(dt); passoExpl(dt); if (j.hp > 0 && !L.inimigos.some(e => e.hp > 0 && e.acordado)) j.hp = Math.min(j.max, j.hp + j.max * 0.04 * dt); }
  if (L.campo && L.emboscada != null && !L.fim && 1 - Math.hypot(L.campo.x - j.x, L.campo.z - j.z) / L.distTotal > L.emboscada) emboscar();
  // joystick → direção no mundo (relativa à câmera)
  let jx = 0, jy = 0; if (L.joy) { const dx = L.joy.x - L.joy.sx, dy = L.joy.y - L.joy.sy, m = Math.hypot(dx, dy); if (m > 6) { const f = Math.min(1, m / 55); jx = dx / m * f; jy = dy / m * f; } }
  const y = C.camera.yaw, sy = Math.sin(y), cy = Math.cos(y); L.mx = -jy * sy - jx * cy; L.mz = -jy * cy + jx * sy;
  for (let i = 0; i < 3; i++) j.cds[i] = Math.max(0, j.cds[i] - dt);
  j.iframes = Math.max(0, (j.iframes || 0) - dt);
  if (j.hp > 0 && !L.fim) {
    const mv = Math.hypot(L.mx, L.mz);
    if (j.dash) { j.dash.t -= dt; j.x += j.dash.ax * 22 * dt; j.z += j.dash.az * 22 * dt; if (j.dash.bate) for (const e of L.inimigos) if (e.hp > 0 && !j.dash.bate.has(e) && dist(e, j) < 2.5) { j.dash.bate.add(e); ferir(e, j.dano * 2 * j.hab); e.atordoado = 1.5; } if (j.dash.t <= 0) j.dash = null; }
    else if (mv > 0.05) { const v = 11 * (1 + (j.vel || 0)) * Math.min(1, mv); j.x += L.mx / mv * v * dt; j.z += L.mz / mv * v * dt; j.ang += difAng(j.ang, Math.atan2(L.mx, L.mz)) * Math.min(1, dt * 12); if (L.t > (j.trava || 0)) j.v.tocar('Running_A'); }
    // ataque automático no monstro mais perto
    j.cd -= dt; const alvo = maisPerto(j, j.alc + 1);
    if (alvo && !j.dash) { if (mv < 0.05) j.ang += difAng(j.ang, Math.atan2(alvo.x - j.x, alvo.z - j.z)) * Math.min(1, dt * 12);
      if (j.cd <= 0) { j.cd = (j.alc > 5 ? 0.8 : 0.65) * (1 - (j.vel || 0)); j.v.tocar(animAtaque(j.h.visual), { loop: false, reinicia: true, vel: 1.3 }); j.trava = L.t + 0.4;
        if (j.alc > 5 && dist(alvo, j) > 3) atirar(j, Math.atan2(alvo.x - j.x, alvo.z - j.z), armaInfo(j.h.visual.arma).tipo === 'magia' ? 'magia' : 'flecha', 30, j.dano, true);
        else if (j.alc > 5) ferir(alvo, j.dano); // colado no monstro: acerta direto
        else setTimeout(() => { if (L && alvo.hp > 0 && dist(alvo, j) < j.alc + 1.5) { ferir(alvo, j.dano); C.arco(j.x, j.z, j.ang, 3, 120, 0xfff2c0); } }, 180); } }
    else if (mv <= 0.05 && !j.dash && j.cd < 0.2 && L.t > (j.trava || 0)) j.v.tocar('Idle_A');
  }
  // aliados seguem e lutam
  L.aliados.forEach((a, i) => {
    const alvo = maisPerto(a, 16); let dest = alvo, perto = alvo ? a.alc : 0;
    if (!alvo) { const ang = j.ang + Math.PI + (i - 0.5) * 0.9; dest = { x: j.x + Math.sin(ang) * 4, z: j.z + Math.cos(ang) * 4 }; perto = 1; }
    const d = dist(a, dest);
    if (d > perto) { const v = 10; a.x += (dest.x - a.x) / d * v * dt; a.z += (dest.z - a.z) / d * v * dt; a.ang = Math.atan2(dest.x - a.x, dest.z - a.z); a.v.tocar('Running_A'); }
    else if (alvo) { a.ang = Math.atan2(alvo.x - a.x, alvo.z - a.z); a.cd -= dt; if (a.cd <= 0) { a.cd = 1.1; a.v.tocar(animAtaque(a.h.visual), { loop: false, reinicia: true }); if (a.alc > 5 && dist(a, alvo) > 3) atirar(a, a.ang, 'flecha', 28, a.dano, true); else ferir(alvo, a.dano); } }
    else a.v.tocar('Idle_A');
  });
  // monstros
  for (const e of L.inimigos) {
    if (e.hp <= 0) { e.morreu += dt; if (e.morreu > 2.5) e.v.raiz.position.y = -(e.morreu - 2.5); if (e.morreu > 4) e.v.raiz.visible = false; continue; }
    e.atordoado = Math.max(0, (e.atordoado || 0) - dt);
    const alvos = [j, ...L.aliados].filter(a => a.hp === undefined || a.hp > 0); let alvo = null, d0 = 1e9; for (const a of alvos) { const d = dist(a, e); if (d < d0) { d0 = d; alvo = a; } }
    if (!e.acordado && d0 < 20) { e.acordado = true; if (e.chefe) { e.v.tocar('Taunt', { loop: false, reinicia: true }); e.cd = 1.8; C.camera.tremor = 0.3; } }
    if (!e.acordado || !alvo || e.atordoado > 0) continue;
    // habilidade em andamento (aviso no chão, investida, salto)
    if (e.lanc) { e.lanc.t -= dt; if (e.lanc.t <= 0) { const f = e.lanc.f; e.lanc = null; f(); } continue; }
    if (e.investe) { const iv = e.investe; iv.t -= dt; e.x += iv.vx * dt; e.z += iv.vz * dt;
      for (const h of [j, ...L.aliados]) if (!iv.acertou && dist(h, e) < iv.r + 0.8) { iv.acertou = true; ferirHeroi(h, e.dano * 1.8); C.camera.tremor = Math.max(C.camera.tremor, 0.2); }
      if (iv.t <= 0) e.investe = null; continue; }
    if (e.pulo) { const p = e.pulo; p.t += dt; const k = Math.min(1, p.t / p.dur); e.x = p.x0 + (p.x1 - p.x0) * k; e.z = p.z0 + (p.z1 - p.z0) * k; e.v.raiz.position.y = Math.sin(k * Math.PI) * p.h;
      if (k >= 1) { e.pulo = null; e.v.raiz.position.y = 0; C.onda(e.x, e.z, p.r, 0xffc07a, 0.45); C.faiscas(e.x, 0.5, e.z, 0xc8a878, 25, 5); C.camera.tremor = Math.max(C.camera.tremor, 0.3);
        for (const h of [j, ...L.aliados]) if (dist(h, e) < p.r + 0.5) ferirHeroi(h, e.dano * 2); }
      continue; }
    const hb0 = HAB[e.tp], hb = Array.isArray(hb0) ? hb0[Math.floor(Math.random() * hb0.length)] : hb0;
    e.hcd = (e.hcd ?? 1.5 + Math.random() * 3) - dt;
    if (hb && e.hcd <= 0 && d0 < ALC_HAB[hb]) { e.hcd = (e.unico || e.chefe ? 3.2 : e.raro ? 4.2 : 5.5) + Math.random() * 2.5; habMonstro(e, hb, alvo); continue; }
    e.ang = Math.atan2(alvo.x - e.x, alvo.z - e.z); e.cd -= dt;
    if (d0 > e.alc * 0.9) { const v = e.chefe ? 5 : e.bicho ? 8 : 6.5; e.x += Math.sin(e.ang) * v * dt; e.z += Math.cos(e.ang) * v * dt; e.v.tocar(e.bicho ? 'Gallop' : 'Running_A'); }
    else if (e.cd <= 0) {
      e.cd = e.chefe ? 1.6 : e.longe ? 2 : 1.4; e.v.tocar(e.bicho ? e.atkAnim : e.longe ? '2H_Ranged_Shoot' : '1H_Melee_Attack_Chop', { loop: false, reinicia: true });
      if (e.longe) atirar(e, e.ang, e.bicho ? 'fogo' : 'virote', e.bicho ? 16 : 20, e.dano, false);
      else { const a0 = alvo; setTimeout(() => { if (L && e.hp > 0 && dist(e, a0) < e.alc + 1.2) { ferirHeroi(a0, e.dano); if (e.chefe) { C.onda(e.x, e.z, 4, 0xff7a3a, 0.4); } } }, 400); }
    } else e.v.tocar(e.v.tem('Idle_Combat') ? 'Idle_Combat' : 'Idle');
  }
  // poças de veneno: dano enquanto pisa
  L.zonas = (L.zonas || []).filter(z => { z.t -= dt; z.tick -= dt; if (z.tick <= 0) { z.tick = 0.5; for (const h of [j, ...L.aliados]) if (Math.hypot(h.x - z.x, h.z - z.z) < z.r) ferirHeroi(h, z.dano); } return z.t > 0; });
  // projéteis
  for (let i = L.proj.length - 1; i >= 0; i--) {
    const p = L.proj[i]; p.x += p.vx * dt; p.z += p.vz * dt; p.andou += Math.hypot(p.vx, p.vz) * dt; p.o.position.set(p.x, 2, p.z);
    let fim = p.andou > 26;
    if (p.dono) { for (const e of L.inimigos) if (e.hp > 0 && !e.sumido && Math.hypot(e.x - p.x, e.z - p.z) < (e.chefe ? 2.5 : 1.4)) { if (p.explode) { C.onda(p.x, p.z, p.explode, 0xff7a2a, 0.4); for (const o of L.inimigos) if (o.hp > 0 && Math.hypot(o.x - p.x, o.z - p.z) < p.explode + 1) ferir(o, p.dano); } else ferir(e, p.dano); fim = true; break; } }
    else if (Math.hypot(j.x - p.x, j.z - p.z) < 1.3) { ferirHeroi(j, p.dano); fim = true; }
    if (fim) { C.remover(p.o); L.proj.splice(i, 1); }
  }
  // visual
  for (const a of [j, ...L.aliados]) { a.v.raiz.position.set(a.x, 0, a.z); a.v.raiz.rotation.y = a.ang; a.v.mixer.update(dt); a.flash = Math.max(0, (a.flash || 0) - dt); a.v.brilho(a.flash > 0 ? 0.35 : 0); }
  for (const e of L.inimigos) { e.v.raiz.position.x = e.x; e.v.raiz.position.z = e.z; e.v.raiz.rotation.y = e.ang; e.v.mixer.update(dt); e.flash = Math.max(0, (e.flash || 0) - dt); e.v.brilho(e.flash > 0 ? 0.4 : 0); }
  ui.foco.x += (j.x - ui.foco.x) * Math.min(1, dt * 6); ui.foco.z += (j.z - ui.foco.z) * Math.min(1, dt * 6);
  // vitória
  if (!L.explorar && !L.fim && L.emboscada == null && L.inimigos.every(e => e.hp <= 0)) { L.fim = true; j.v.tocar('Cheering', { loop: true, reinicia: true }); for (const a of L.aliados) a.v.tocar('Cheering', { loop: true }); setTimeout(() => terminar(true), 2200); }
  desenharHud(dt);
}
function desenharHud(dt) {
  const j = L.lider, b = $('#luta .lVida .barra');
  b.querySelector('i').style.width = Math.max(0, j.hp / j.max * 100) + '%'; b.querySelector('span').textContent = `${Math.ceil(j.hp)} / ${j.max}`;
  const rest = $('#lRest'); if (rest) rest.textContent = L.explorar ? `Nv ${E.sis().nivel} · ${L.ganhos.mortes} abates` : `${L.inimigos.filter(e => e.hp > 0).length} monstros`;
  document.querySelectorAll('#luta [data-hab]').forEach(bt => { const i = +bt.dataset.hab, cd = j.cds[i], tot = [6, 8, 1.2][i]; bt.style.setProperty('--p', cd > 0 ? (cd / tot * 360) + 'deg' : '0deg'); bt.querySelector('i').textContent = cd > 0 ? Math.ceil(cd) : ''; });
  // seta até o acampamento quando ele está fora da tela
  const s = $('#lSeta'), c = L.campo || j, t = C.tela(c.x, 2, c.z), dCampo = Math.hypot(c.x - j.x, c.z - j.z);
  if (dCampo > 22 && L.inimigos.some(e => e.hp > 0) && !L.inimigos.some(e => e.acordado)) { const cx = innerWidth / 2, cy = innerHeight / 2; let ax = (t ? t[0] : cx) - cx, ay = (t ? t[1] : cy) - cy; const m = Math.hypot(ax, ay) || 1; ax /= m; ay /= m;
    s.hidden = false; s.style.transform = `translate(${cx + ax * Math.min(cx, cy) * 0.7}px,${cy + ay * Math.min(cx, cy) * 0.7}px) translate(-50%,-50%) rotate(${Math.atan2(ay, ax)}rad)`; s.dataset.d = Math.round(dCampo) + 'm'; }
  else s.hidden = true;
  // barras de vida e números
  const g = L.g; g.clearRect(0, 0, innerWidth, innerHeight);
  if (L.joy) { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.beginPath(); g.arc(L.joy.sx, L.joy.sy, 55, 0, 7); g.stroke(); const dx = L.joy.x - L.joy.sx, dy = L.joy.y - L.joy.sy, m = Math.hypot(dx, dy), f = Math.min(1, 55 / (m || 1)); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(L.joy.sx + dx * f, L.joy.sy + dy * f, 24, 0, 7); g.fill(); }
  for (const e of L.inimigos) { if (e.hp <= 0) continue; const p = C.tela(e.x, e.alt ? e.alt + 1 : e.chefe || e.grande ? 8 : 4.6, e.z); if (!p) continue; const w = e.chefe || e.grande ? 90 : 46;
    if (e.nome) { g.font = '800 13px system-ui'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(e.nome, p[0], p[1] - 6); g.fillStyle = e.unico ? '#ffb02e' : '#ff8a7a'; g.fillText(e.nome, p[0], p[1] - 6); }
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(p[0] - w / 2 - 1, p[1] - 1, w + 2, 7); g.fillStyle = e.chefe ? '#ff7a2a' : '#e2412f'; g.fillRect(p[0] - w / 2, p[1], w * e.hp / e.max, 5); }
  for (const t of L.txt) { t.t += dt; const p = C.tela(t.x, t.y + t.t * 2, t.z); if (!p) continue; g.globalAlpha = Math.max(0, 1 - t.t / 1.1); g.font = `800 ${t.grande ? 26 : 18}px system-ui`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(t.txt, p[0], p[1]); g.fillStyle = t.cor; g.fillText(t.txt, p[0], p[1]); g.globalAlpha = 1; }
  L.txt = L.txt.filter(t => t.t < 1.1);
}
function terminar(ok, desistiu = false) {
  if (!L) return; const l = L; L = null; if (l.neblina) C.neblina(...l.neblina); C.recorte(false);
  for (const a of [l.lider, ...l.aliados]) a.v.remover(); for (const e of l.inimigos) e.v.remover(); for (const p of l.proj) C.remover(p.o); for (const b of l.baus || []) C.remover(b);
  removeEventListener('resize', l.medir); $('#luta').remove(); $('#hud').style.visibility = '';
  if (l.explorar) { for (const id of l.ids) { const h = E.heroi(id); if (h) h.estado = 'livre'; } som('fechar'); }
  else if (desistiu) { delete l.q.emLuta; for (const id of l.ids) { const h = E.heroi(id); if (h) h.estado = 'livre'; } som('fechar'); }
  else E.concluirManual(l.q.id, l.ids, ok);
  ui.foco = { x: l.lider.x, z: l.lider.z }; C.camera.dist = 60; C.camera.suave = 10;
  l.aoFim && l.aoFim(ok, desistiu, l.explorar || !desistiu ? l.loot : [], l.ganhos);
}
