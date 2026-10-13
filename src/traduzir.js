// Tradução das mensagens do chat do clã (só deste jogo): MyMemory (grátis, sem chave) e, se falhar, o tradutor público do Google.
// Só traduz quando o jogador toca em "Traduzir"; a primeira tradução de cada mensagem fica salva no servidor para os próximos.
const CHAVE = 'ponte_trad', MAX = 300;
let cache = {};
try { cache = JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) {}
const pendentes = {};
export const idioma = () => (localStorage.getItem('ponte_idioma') || navigator.language || 'pt-BR');
const curto = l => String(l || '').toLowerCase().split(/[-_]/)[0];
function guardar(k, v) {
  cache[k] = v; const ks = Object.keys(cache); if (ks.length > MAX) for (const x of ks.slice(0, ks.length - MAX)) delete cache[x];
  try { localStorage.setItem(CHAVE, JSON.stringify(cache)); } catch (e) {}
}
async function buscar(url) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('erro ' + r.status); return await r.json(); } finally { clearTimeout(t); }
}
async function memory(txt, para) {
  const j = await buscar(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(txt)}&langpair=autodetect%7C${encodeURIComponent(para)}`);
  if (j.responseStatus !== 200 || j.quotaFinished || !j.responseData?.translatedText) throw new Error('sem cota');
  const de = j.responseData.detectedLanguage, tr = j.responseData.translatedText;
  if (/MYMEMORY WARNING|INVALID/i.test(tr)) throw new Error('aviso');
  return { de, tr };
}
async function google(txt, para) {
  const j = await buscar(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(curto(para))}&dt=t&q=${encodeURIComponent(txt)}`);
  return { de: j[2], tr: (j[0] || []).map(p => p[0]).join('') };
}
// só emoji, números ou risadas (kkkk, hahaha, rsrs, lol, xD): não traduz
export const precisa = txt => txt.split(/\s+/).some(w => /\p{L}{2}/u.test(w) && !/^(k{2,}|(ha)+h?|(he)+h?|(hu)+e?|(rs)+|lol|lmao|xd+|kek|jaja(ja)*|ok|gg|wp)[!?.]*$/iu.test(w));
// devolve { de, tr } ou null quando já está no idioma do celular
export function traduzir(id, txt, para = idioma()) {
  const k = id + ':' + curto(para);
  if (k in cache) return Promise.resolve(cache[k]);
  if (!precisa(txt)) return Promise.resolve(null);
  return pendentes[k] ||= (async () => {
    let r = null;
    try { r = await memory(txt, para); } catch (e) { try { r = await google(txt, para); } catch (e2) { return null; } }
    const v = !r || !r.tr || curto(r.de) === curto(para) || r.tr.trim().toLowerCase() === txt.trim().toLowerCase() ? null : { de: curto(r.de), tr: r.tr };
    guardar(k, v); return v;
  })().finally(() => { delete pendentes[k]; });
}
export function nomeIdioma(l) { try { return new Intl.DisplayNames([idioma()], { type: 'language' }).of(l) || l; } catch (e) { return l; } }
