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
    if (!r.ok) throw new Error(j?.message || `erro ${r.status}`);
    return j;
  } catch (e) { throw new Error(e.name === 'AbortError' || e.message === 'Failed to fetch' ? 'sem conexão' : e.message); }
  finally { clearTimeout(tempo); }
}
const aleatorio = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); };
function uuid() { if (crypto.randomUUID) return crypto.randomUUID(); const h = aleatorio(16); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; }
export const conta = () => S.online;
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

export const enviarRecorde = comConta((pontos, chefes) => rpc('ponte_enviar_recorde', { ...id(), p_pontos: pontos, p_chefes: chefes }));
export const cqEnviar = comConta((est, forca) => rpc('ponte_cq_enviar', { ...id(), p_estagio: est, p_forca: forca }));
export const cqTop = () => rpc('ponte_cq_top2', { p_limite: 50, p_id: S.online?.id || null });
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
export const ranking = () => rpc('ponte_top3', { p_limite: 50, p_id: S.online?.id || null });
export const ajudaAuto = comConta(fase => rpc('ponte_ajuda_auto', { ...id(), p_fase: fase }));
export const premios = comConta(() => rpc('ponte_premios', id()));
// clãs
export const clas = (busca = '') => rpc('ponte_clas2', { p_busca: busca });
export const meuCla = comConta(() => rpc('ponte_meu_cla', id()));
export const claCriar = comConta((nome, tag, cor) => rpc('ponte_cla_criar2', { ...id(), p_nome: nome, p_tag: tag, p_cor: cor }));
export const claEntrar = comConta(cla => rpc('ponte_cla_entrar', { ...id(), p_cla: cla }));
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
export function conectarSala(sala, aoReceber) {
  const topico = `realtime:ponte-${sala}`;
  let ws, ref = 0, batida = null, aberto = false, fila = [];
  const mandar = m => { if (ws?.readyState === 1) ws.send(JSON.stringify({ ...m, ref: String(++ref) })); };
  ws = new WebSocket(`wss://${BASE}/realtime/v1/websocket?apikey=${CHAVE}&vsn=1.0.0`);
  ws.onopen = () => {
    mandar({ topic: topico, event: 'phx_join', payload: { config: { broadcast: { self: false }, presence: { key: '' }, private: false } } });
    batida = setInterval(() => mandar({ topic: 'phoenix', event: 'heartbeat', payload: {} }), 25000);
  };
  ws.onmessage = e => {
    let d; try { d = JSON.parse(e.data); } catch (er) { return; }
    if (d.event === 'phx_reply' && d.topic === topico && !aberto) { aberto = d.payload?.status === 'ok'; for (const m of fila) mandar(m); fila = []; }
    if (d.event === 'broadcast' && d.payload) aoReceber(d.payload.event, d.payload.payload || {});
  };
  ws.onclose = () => { aberto = false; clearInterval(batida); aoReceber('_caiu', {}); };
  return {
    enviar(ev, p) { const m = { topic: topico, event: 'broadcast', payload: { type: 'broadcast', event: ev, payload: p } }; if (aberto) mandar(m); else if (fila.length < 20) fila.push(m); },
    fechar() { clearInterval(batida); ws.onclose = null; try { ws.close(); } catch (e) {} },
    get aberto() { return aberto; },
  };
}
