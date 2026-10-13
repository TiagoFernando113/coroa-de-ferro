// Online (Supabase, projeto batalha-da-ponte): ranking da ponte sem fim e reforços entre amigos.
// Sem cadastro: o celular gera um id e um segredo na primeira vez; o servidor só confere os dois.
import { S, salvar } from './meta.js';

const URL = 'https://diqpppuaqnxvelexgepw.supabase.co/rest/v1/rpc/';
const CHAVE = 'sb_publishable_97ELBSCkPhv2pwpPVTMDww_tzHwxJku'; // chave pública (só chama as funções do jogo)

async function rpc(fn, corpo) {
  const ctl = new AbortController(), tempo = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(URL + fn, { method: 'POST', headers: { apikey: CHAVE, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal: ctl.signal });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.message || `erro ${r.status}`);
    return j;
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'sem conexão' : e.message === 'Failed to fetch' ? 'sem conexão' : e.message); }
  finally { clearTimeout(tempo); }
}
const aleatorio = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); };
function uuid() { if (crypto.randomUUID) return crypto.randomUUID(); const h = aleatorio(16); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; }
export const conta = () => S.online;
// cria a conta na primeira vez (ou troca o apelido); devolve o código de amigo
export async function registrar(apelido) {
  if (!S.online) { S.online = { id: uuid(), segredo: aleatorio(24), apelido: '', codigo: '' }; salvar(); }
  const O = S.online; const codigo = await rpc('ponte_registrar', { p_id: O.id, p_segredo: O.segredo, p_apelido: apelido || O.apelido || 'Herói' });
  O.codigo = codigo; O.apelido = apelido || O.apelido || 'Herói'; salvar(); return codigo;
}
const id = () => ({ p_id: S.online.id, p_segredo: S.online.segredo });
export async function enviarRecorde(pontos, chefes) { if (!S.online?.codigo) return null; return rpc('ponte_enviar_recorde', { ...id(), p_pontos: pontos, p_chefes: chefes }); }
export async function ranking() { return rpc('ponte_top', { p_limite: 50, p_id: S.online?.id || null }); }
export async function quem(codigo) { return rpc('ponte_quem', { p_codigo: codigo }); }
export async function ajudar(codigo, soldados) { return rpc('ponte_ajudar', { ...id(), p_codigo: codigo, p_soldados: soldados }); }
export async function receber() { if (!S.online?.codigo) return []; return rpc('ponte_receber', id()); }
