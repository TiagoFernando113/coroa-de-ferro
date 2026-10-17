// Online (Supabase, projeto batalha-da-ponte): ranking, clãs, ajuda automática e jogar em dupla (pareamento + canal ao vivo).
// Sem cadastro: o celular gera um id e um segredo na primeira vez; o servidor só confere os dois.
import { S, salvar } from './meta.js';

const BASE = 'diqpppuaqnxvelexgepw.supabase.co';
const CHAVE = 'sb_publishable_97ELBSCkPhv2pwpPVTMDww_tzHwxJku'; // chave pública (só chama as funções do jogo)

async function rpc(fn, corpo = {}) {
  const ctl = new AbortController(), tempo = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://${BASE}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: CHAVE, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal: ctl.signal });
    const j = await r.json().catch(() => null);
    if (!r.ok) { const m = j?.message || `erro ${r.status}`; if (/segredo inválido/.test(m) && S.online?.codigo) dispatchEvent(new CustomEvent('contaInvalida')); throw new Error(m); }
    return j;
  } catch (e) { throw new Error(e.name === 'AbortError' || e.message === 'Failed to fetch' ? 'sem conexão' : e.message); }
  finally { clearTimeout(tempo); }
}
const aleatorio = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); };
function uuid() { if (crypto.randomUUID) return crypto.randomUUID(); const h = aleatorio(16); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; }
export const conta = () => S.online;
export const erroReg = (tipo, msg, pilha, tela, aparelho) => rpc('ponte_erro_reg', { p_id: S.online?.id || null, p_versao: window.VERSAO | 0, p_tipo: tipo, p_msg: msg, p_pilha: pilha, p_tela: tela, p_aparelho: aparelho });
export const nomeEspera = () => S.online?.codigo ? rpc('ponte_nome_espera', { p_id: S.online.id }) : Promise.resolve(0);
// cria a conta (ou troca o apelido)
export async function registrar(apelido) {
  if (!S.online) { S.online = { id: uuid(), segredo: aleatorio(24), apelido: '', codigo: '' }; salvar(); }
  const O = S.online, ap = apelido || O.apelido || `Herói${Math.floor(1000 + Math.random() * 9000)}`;
  O.codigo = await rpc('ponte_registrar', { p_id: O.id, p_segredo: O.segredo, p_apelido: ap }); O.apelido = ap; salvar(); return O.codigo;
}
// conta criada sozinha na primeira vez que algo online é usado
let garantindo = null;
export function garantir() { if (S.online?.codigo) return Promise.resolve(); return garantindo ||= registrar().finally(() => { garantindo = null; }); }
const id = () => ({ p_id: S.online.id, p_segredo: S.online.segredo });
const comConta = fn => async (...a) => { await garantir(); return fn(...a); };
export const mapaEstado = comConta((heroi, tropas) => rpc('ponte_mapa_estado', { ...id(), p_heroi: heroi, p_tropas: tropas }));
export const mapaMarchar = comConta((slot, cam, dur, alvo = null, tipo = null) => rpc('ponte_mapa_marchar2', { ...id(), p_slot: slot, p_cam: cam, p_dur: dur, p_alvo: alvo, p_tipo: tipo }));
export const mapaTipo = comConta((slot, tipo) => rpc('ponte_mapa_tipo', { ...id(), p_slot: slot, p_tipo: tipo }));
export const mapaRecuar = comConta((slot, cam, dur) => rpc('ponte_mapa_recuar', { ...id(), p_slot: slot, p_cam: cam, p_dur: dur }));
export const mapaLidos = comConta(() => rpc('ponte_mapa_lidos', id()));
export const mapaBots = comConta(ordens => rpc('ponte_mapa_bots', { ...id(), p_ordens: ordens }));

export const enviarRecorde = comConta((pontos, chefes) => rpc('ponte_enviar_recorde', { ...id(), p_pontos: pontos, p_chefes: chefes }));
export const cqEnviar = comConta((est, forca) => rpc('ponte_cq_enviar', { ...id(), p_estagio: est, p_forca: forca }));
export const cqTop = () => rpc('ponte_cq_top2', { p_limite: 50, p_id: S.online?.id || null });
export const arenaSalvar = comConta((equipe, forca) => rpc('ponte_arena_salvar', { ...id(), p_equipe: equipe, p_forca: forca }));
export const arenaOponentes = comConta(() => rpc('ponte_arena_oponentes', id()));
export const arenaResultado = comConta((codigo, venceu) => rpc('ponte_arena_resultado', { ...id(), p_codigo: codigo, p_venceu: venceu }));
export const arenaDefesas = comConta(() => rpc('ponte_arena_defesas', id()));
export const arenaTop = () => rpc('ponte_arena_top', { p_limite: 50, p_id: S.online?.id || null });
export const botsTick = () => rpc('ponte_bots_tick');
export const claInfo = id => rpc('ponte_cla_info', { p_cla: id });
export const placar = () => rpc('ponte_placar', { p_id: S.online?.id || null });
export const placarLista = cat => rpc('ponte_placar_lista', { p_cat: cat, p_id: S.online?.id || null, p_limite: 50 });
export const cqRival = comConta(forca => rpc('ponte_cq_rival', { ...id(), p_forca: forca }));
export const cqDerrotou = comConta(codigo => rpc('ponte_cq_derrotou', { ...id(), p_codigo: codigo }));
export const ctEnviar = comConta((onda, heroi) => rpc('ponte_ct_enviar', { ...id(), p_onda: onda, p_heroi: heroi }));
export const ctTop = () => rpc('ponte_ct_top', { p_limite: 50, p_id: S.online?.id || null });
export const perfilSalvar = comConta((avatar, dados) => rpc('ponte_perfil_salvar', { ...id(), p_avatar: avatar, p_dados: dados }));
export const perfilVer = codigo => rpc('ponte_perfil_ver', { p_codigo: codigo });
export const amigoMarcar = comConta((codigo, ativo) => rpc('ponte_amigo_marcar', { ...id(), p_codigo: codigo, p_ativo: ativo }));
export const amigos = comConta(() => rpc('ponte_amigos', id()));
// nuvem: backup do save, senha de recuperação e recuperar em outro celular
export const saveEnviar = comConta(dados => rpc('ponte_save_enviar', { ...id(), p_dados: dados }));
export const senhaDefinir = comConta(senha => rpc('ponte_senha_definir', { ...id(), p_senha: senha }));
export const temSenha = comConta(() => rpc('ponte_tem_senha', id()));
export async function recuperar(codigo, senha) { const novo = aleatorio(24); const r = await rpc('ponte_recuperar', { p_codigo: codigo, p_senha: senha, p_novo_segredo: novo }); return { ...r, segredo: novo }; }
// convites para jogar em dupla
export const convidar = comConta((codigo, fase) => rpc('ponte_convidar', { ...id(), p_codigo: codigo, p_fase: fase }));
export const conviteEstado = comConta(conv => rpc('ponte_convite_estado', { ...id(), p_conv: conv }));
export const conviteCancelar = conv => S.online?.codigo ? rpc('ponte_convite_cancelar', { ...id(), p_conv: conv }).catch(() => {}) : Promise.resolve();
export const convites = comConta(() => rpc('ponte_convites', id()));
export const conviteResponder = comConta((conv, aceita) => rpc('ponte_convite_responder', { ...id(), p_conv: conv, p_aceita: aceita }));
export const guerra = comConta(() => rpc('ponte_guerra_info', id()));
export const claGerir = comConta((codigo, acao) => rpc('ponte_cla_gerir', { ...id(), p_codigo: codigo, p_acao: acao }));
export const claEditar = comConta((nome, tag, cor, desc, fechado, faseMin) => rpc('ponte_cla_editar2', { ...id(), p_nome: nome, p_tag: tag, p_cor: cor, p_desc: desc, p_fechado: fechado, p_fase_min: faseMin }));
export const claPedir = comConta(cla => rpc('ponte_cla_pedir2', { ...id(), p_cla: cla, p_fase: Math.max(S.fase || 1, S.melhor || 0) }));
export const claPedidos = comConta(() => rpc('ponte_cla_pedidos', id()));
export const claResponder = comConta((codigo, aceitar) => rpc('ponte_cla_responder', { ...id(), p_codigo: codigo, p_aceitar: aceitar }));
export const ranking = () => rpc('ponte_top3', { p_limite: 50, p_id: S.online?.id || null });
export const ajudaAuto = comConta(fase => rpc('ponte_ajuda_auto', { ...id(), p_fase: fase }));
export const premios = comConta(() => rpc('ponte_premios', id()));
// clãs
export const clas = (busca = '') => rpc('ponte_clas3', { p_busca: busca, p_id: S.online?.id || null });
export const meuCla = comConta(() => rpc('ponte_meu_cla', id()));
export const claCriar = comConta((nome, tag, cor) => rpc('ponte_cla_criar2', { ...id(), p_nome: nome, p_tag: tag, p_cor: cor }));
export const claEntrar = comConta(cla => rpc('ponte_cla_entrar2', { ...id(), p_cla: cla, p_fase: Math.max(S.fase || 1, S.melhor || 0) }));
export const claSair = comConta(() => rpc('ponte_cla_sair', id()));
export const claDano = comConta(dano => rpc('ponte_cla_dano', { ...id(), p_dano: Math.round(dano) }));
// chat do clã e doações de cartas
export const chatLer = comConta(idioma => rpc('ponte_chat_ler2', { ...id(), p_idioma: idioma }));
export const tradSalvar = comConta((msg, idioma, texto, de) => rpc('ponte_trad_salvar', { ...id(), p_msg: msg, p_idioma: idioma, p_texto: texto, p_de: de }));
export const chatEnviar = comConta((texto, tipo = 'msg') => rpc('ponte_chat_enviar', { ...id(), p_texto: texto, p_tipo: tipo }));
export const chatPedir = comConta(item => rpc('ponte_chat_pedir', { ...id(), p_item: item }));
export const chatDoar = comConta(msg => rpc('ponte_chat_doar', { ...id(), p_msg: msg }));
export const doacoesReceber = comConta(() => rpc('ponte_doacoes_receber', id()));
export const resgatar = comConta(codigo => rpc('ponte_resgatar', { ...id(), p_codigo: codigo }));
// pareamento
export const procurar = comConta(fase => rpc('ponte_procurar', { ...id(), p_fase: fase }));
export const cancelar = () => S.online?.codigo ? rpc('ponte_cancelar', id()).catch(() => {}) : Promise.resolve();
export const procurando = () => rpc('ponte_procurando');

// canal ao vivo da sala (Supabase Realtime, protocolo Phoenix): mensagens curtas entre os dois celulares
// sala da dupla: tenta ligar os dois celulares direto (WebRTC, sem gastar o Supabase);
// o Supabase só apresenta um ao outro e fica de reserva se a ligação direta não sair ou cair
const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
const RAPIDOS = new Set(['s', 'h', 'pi', 'po']); // mensagens que podem se perder (a próxima corrige)
export function conectarSala(sala, aoReceber, host = false) {
  let pc = null, rel = null, rap = null, direto = false, fechado = false, pendentes = [], tentativas = 0, ofT = 0;
  const ok = () => direto && rel?.readyState === 'open';
  const receber = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } if (Array.isArray(m)) aoReceber(m[0], m[1] || {}); };
  const canal = (dc, rapido) => { dc.onmessage = receber;
    if (!rapido) { dc.onopen = () => { direto = true; }; dc.onclose = () => { if (rel === dc) { direto = false; if (!fechado && host) setTimeout(() => { if (!direto && !fechado) oferta(); }, 1500); } }; }
    return dc; };
  const novaConexao = () => {
    try { pc?.close(); } catch (e) {} direto = false; pendentes = [];
    pc = new RTCPeerConnection({ iceServers: STUN });
    pc.onicecandidate = e => { if (e.candidate) sb.enviar('rtc-ice', { c: e.candidate.toJSON() }); };
    pc.ondatachannel = e => { if (e.channel.label === 'rap') rap = canal(e.channel, true); else rel = canal(e.channel, false); };
    pc.onconnectionstatechange = () => { if (pc && ['failed', 'closed'].includes(pc.connectionState)) direto = false; };
  };
  const oferta = async () => { // só o host oferece
    if (fechado || typeof RTCPeerConnection === 'undefined') return;
    ofT = Date.now(); try { novaConexao(); rel = canal(pc.createDataChannel('rel'), false); rap = canal(pc.createDataChannel('rap', { ordered: false, maxRetransmits: 0 }), true);
      await pc.setLocalDescription(await pc.createOffer()); sb.enviar('rtc-of', { d: pc.localDescription.toJSON() }); } catch (e) {}
  };
  const sinal = async (ev, p) => {
    if (typeof RTCPeerConnection === 'undefined') return;
    try {
      if (ev === 'rtc-oi') { if (host) { if (!ok() && Date.now() - ofT > 5000) oferta(); } else if (!ok()) sb.enviar('rtc-oi', {}); }
      if (ev === 'rtc-of' && !host && p.d) { novaConexao(); await pc.setRemoteDescription(p.d); await pc.setLocalDescription(await pc.createAnswer()); sb.enviar('rtc-re', { d: pc.localDescription.toJSON() });
        for (const c of pendentes) await pc.addIceCandidate(c); pendentes = []; }
      if (ev === 'rtc-re' && host && p.d && pc && !pc.remoteDescription) { await pc.setRemoteDescription(p.d); for (const c of pendentes) await pc.addIceCandidate(c); pendentes = []; }
      if (ev === 'rtc-ice' && p.c && pc) { if (pc.remoteDescription) await pc.addIceCandidate(p.c); else pendentes.push(p.c); }
    } catch (e) {}
  };
  const sb = salaSupabase(sala, (ev, p) => {
    if (ev.startsWith('rtc-')) return sinal(ev, p);
    if ((ev === '_reconectando' || ev === '_caiu') && ok()) return; // a ligação direta segue: ninguém caiu
    if (ev === '_voltou' || ev === '_aberto') { if (ev === '_voltou') aoReceber(ev, p); if (!ok()) sb.enviar('rtc-oi', {}); return; }
    aoReceber(ev, p);
  });
  // quem não recebeu a oferta pede de novo (o outro pode ter entrado depois)
  const insistir = () => { if (fechado || ok() || tentativas++ >= 6) return; sb.enviar('rtc-oi', {}); setTimeout(insistir, 3000); }; setTimeout(insistir, 1500);
  return {
    enviar(ev, p) { if (ok()) { const dc = RAPIDOS.has(ev) && rap?.readyState === 'open' ? rap : rel; try { dc.send(JSON.stringify([ev, p])); return; } catch (e) {} } sb.enviar(ev, p); },
    fechar() { fechado = true; direto = false; try { pc?.close(); } catch (e) {} pc = null; sb.fechar(); },
    get aberto() { return ok() || sb.aberto; },
    get direto() { return ok(); },
  };
}
function salaSupabase(sala, aoReceber) {
  // sala de tempo real da dupla; se a internet oscilar, reconecta sozinha (até ~20 s) antes de desistir
  const topico = `realtime:ponte-${sala}`;
  let ws, ref = 0, batida = null, aberto = false, fila = [], fechado = false, tentativas = 0;
  const mandar = m => { if (ws?.readyState === 1) ws.send(JSON.stringify({ ...m, ref: String(++ref) })); };
  const abrir = () => {
    ws = new WebSocket(`wss://${BASE}/realtime/v1/websocket?apikey=${CHAVE}&vsn=1.0.0`);
    ws.onopen = () => {
      mandar({ topic: topico, event: 'phx_join', payload: { config: { broadcast: { self: false }, presence: { key: '' }, private: false } } });
      clearInterval(batida); batida = setInterval(() => mandar({ topic: 'phoenix', event: 'heartbeat', payload: {} }), 25000);
    };
    ws.onmessage = e => {
      let d; try { d = JSON.parse(e.data); } catch (er) { return; }
      if (d.event === 'phx_reply' && d.topic === topico && !aberto) { aberto = d.payload?.status === 'ok'; if (aberto) { aoReceber(tentativas ? '_voltou' : '_aberto', {}); tentativas = 0; } for (const m of fila) mandar(m); fila = []; }
      if (d.event === 'broadcast' && d.payload) aoReceber(d.payload.event, d.payload.payload || {});
    };
    ws.onclose = () => { aberto = false; clearInterval(batida); if (fechado) return;
      if (tentativas < 30) { tentativas++; if (tentativas === 1) aoReceber('_reconectando', {}); setTimeout(() => { if (!fechado) abrir(); }, Math.min(4000, 600 * tentativas)); }
      else aoReceber('_caiu', {}); };
  };
  abrir();
  return {
    enviar(ev, p) { const m = { topic: topico, event: 'broadcast', payload: { type: 'broadcast', event: ev, payload: p } }; if (aberto) mandar(m); else if (fila.length < 20) fila.push(m); },
    fechar() { fechado = true; clearInterval(batida); if (ws) ws.onclose = null; try { ws.close(); } catch (e) {} },
    get aberto() { return aberto; },
  };
}
