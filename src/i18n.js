// Idiomas do jogo: o texto em português é a chave; os números viram '#' (ex.: 'Fase #' → 'Stage #').
// Um observador troca os textos da interface sozinho; nomes de jogadores, clãs e o chat ficam de fora (data-nt).
import { TEXTOS, PADROES } from './textos.js';
export const IDIOMAS = [['pt-BR', 'Português', '🇧🇷'], ['en', 'English', '🇺🇸'], ['es', 'Español', '🇪🇸']];
let lang = 'pt-BR';
try { lang = localStorage.getItem('ponte_idioma') || ''; } catch (e) {}
export const idiomaEscolhido = () => !!lang;
if (!lang) lang = 'pt-BR';
export const idiomaJogo = () => lang;
export function mudarIdioma(l) { lang = l; try { localStorage.setItem('ponte_idioma', l); } catch (e) {} document.documentElement.lang = l; traduzirTudo(); }
const NUM = /[+\-x×]?\d[\d.,]*[KMBT%]?/g;
const cache = new Map();
window.__textos = window.__textos || null; // para coletar textos nos testes
export function t(txt) {
  if (txt == null) return txt; const s = String(txt), limpo = s.trim(); if (!limpo || !/\p{L}/u.test(limpo)) return s;
  if (limpo.includes(' · ')) { const partes = limpo.split(' · '); if (partes.length > 1 && !(lang.startsWith('pt') && !window.__textos)) return s.replace(limpo, partes.map(p => t(p)).join(' · ')); }
  const nums = limpo.match(NUM) || [], k = limpo.replace(NUM, '#');
  if (window.__textos) window.__textos.add(k);
  if (lang.startsWith('pt')) return s;
  const D = TEXTOS[lang.slice(0, 2)]; if (!D) return s;
  const ck = lang + k; let tr = cache.get(ck);
  if (tr === undefined) { tr = D[k] ?? D[k.toLowerCase()] ?? null; cache.set(ck, tr); }
  if (tr == null) { for (const [re, out] of PADROES[lang.slice(0, 2)] || []) if (re.test(limpo)) return s.replace(limpo, limpo.replace(re, out)); return s; }
  let i = 0; const out = tr.replace(/#/g, () => nums[i++] ?? '');
  return s.replace(limpo, out);
}
// troca os textos de um elemento (e dos filhos), guardando o original para poder trocar de novo
const ORIG = new WeakMap();
function trocar(raiz) {
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => n.nodeType === 1 ? (n.hasAttribute('data-nt') || n.tagName === 'STYLE' || n.tagName === 'SCRIPT' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT });
  if (raiz.nodeType === 1) traduzirAtributos(raiz);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const o = ORIG.get(n) ?? n.nodeValue; ORIG.set(n, o); const v = t(o); if (v !== n.nodeValue) n.nodeValue = v;
  }
  if (raiz.querySelectorAll) for (const e of raiz.querySelectorAll('[placeholder],[title]')) if (!e.closest('[data-nt]')) traduzirAtributos(e);
}
function traduzirAtributos(e) { for (const a of ['placeholder', 'title']) if (e.hasAttribute?.(a)) { const k = 'i18n_' + a; e.dataset[k] ??= e.getAttribute(a); e.setAttribute(a, t(e.dataset[k])); } }
let obs = null;
export function iniciarIdioma() {
  document.documentElement.lang = lang;
  obs = new MutationObserver(ms => { for (const m of ms) {
    if (m.type === 'characterData') { const n = m.target; if (n.parentElement?.closest('[data-nt]')) continue; if (n.nodeValue !== t(ORIG.get(n) ?? '')) { ORIG.set(n, n.nodeValue); const v = t(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } continue; }
    for (const n of m.addedNodes) { if (n.nodeType === 3) { if (!n.parentElement?.closest('[data-nt]')) { ORIG.set(n, n.nodeValue); const v = t(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } } else if (n.nodeType === 1 && !n.closest('[data-nt]')) trocar(n); } } });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  trocar(document.body);
}
function traduzirTudo() { obs?.disconnect(); trocar(document.body); obs?.observe(document.body, { childList: true, subtree: true, characterData: true }); }
