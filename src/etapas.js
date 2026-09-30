// Etapas guiadas: uma tarefa por vez. Cada etapa revela o que ela pede (prédio, aba, recurso)
// e aponta onde tocar. Depois da última, o resto vai aparecendo conforme a Fama libera.
import { S, nivel, desbloqueado } from './estado.js';
import { EDIFICIOS } from './dados.js';

// ctx.folha: painel aberto ('predio:taverna', 'missoes', 'herois', 'heroi', ...); ctx.modal: janela aberta ('equipe', ...)
// alvo: lista de seletores tentados em ordem ('ed:x' = rótulo do prédio no mapa)
export const ETAPAS = [
  { txt: 'Esta é a <b>Associação dos Aventureiros</b>, o QG de todos os aventureiros. Toque nela para ver as missões.', revela: ['ed:quadro', 'nav:missoes'], alvo: ['ed:quadro', 'nav:missoes'],
    feito: c => c.folha === 'missoes' || S.missoes.length > 0 || S.st.missoes > 0, foco: 'quadro' },
  { txt: 'Pegue um papel do <b>Quadro de Missões</b>.', alvo: ['[data-ir]', '.papel:not(.procurado)', 'nav:missoes'], feito: () => S.missoes.length > 0 || S.st.missoes > 0 },
  { txt: 'Seu herói partiu! Ele volta em instantes.', alvo: ['#ativas .miniM'], feito: () => S.st.missoes > 0 },
  { txt: 'Missão cumprida! Abra <b>Herói</b> para ver seu progresso.', revela: ['nav:herois'], alvo: ['nav:herois'], feito: c => c.folha === 'herois' || c.folha === 'heroi' },
  { txt: 'Toque no seu herói e <b>treine</b> para deixá-lo mais forte.', alvo: ['[data-a="treinar"]', '.heroi.lider', 'nav:herois'], feito: () => (S.st.treinos || 0) > 0 },
  { txt: 'Você completou um objetivo! Pegue suas <b>gemas</b>.', revela: ['nav:objetivos', 'gemas', 'fama'], alvo: ['[data-obj]:not(.sem)', 'nav:objetivos'], feito: () => Object.keys(S.obj).length > 0 },
  { txt: 'Abra <b>Baús</b> e pegue seu baú grátis: um item para o seu herói!', revela: ['nav:recrutar'], alvo: ['[data-a="gratis"]', 'nav:recrutar'], feito: () => (S.st.baus || 0) >= 1 },
  { txt: 'Entre numa <b>guilda</b>! Juntos vocês ganham prédios, bônus e a Força da guilda (+XP).', revela: ['nav:guilda'], alvo: ['[data-entrar]:not(.sem)', 'nav:guilda'], feito: () => !!S.guilda },
  { txt: 'Doe ouro para melhorar um <b>prédio da guilda</b>.', alvo: ['[data-a="melhorar"]', '.rotulo.pode', 'nav:guilda'], feito: () => !S.guilda || (S.doacoes?.[S.lider] || 0) > 0 },
  { txt: 'Fique forte e derrote o <b>chefe da Floresta Sombria</b>!', alvo: ['nav:missoes'], feito: () => S.regiao >= 1 },
];
export const TUDO = ['ed:quadro', 'nav:missoes', 'nav:herois', 'nav:objetivos', 'nav:recrutar', 'nav:guilda', 'gemas', 'fama'];

export function iniciarEtapas() {
  if (S.revelado) return;
  const veterano = S.st.missoes > 0; // save antigo (antes das etapas): já mostra tudo
  S.etapa = veterano ? ETAPAS.length : 0; S.novos = {};
  S.revelado = veterano ? [...TUDO, ...Object.keys(EDIFICIOS).filter(desbloqueado).map(k => 'ed:' + k)] : [];
}
export const revelado = k => S.revelado.includes(k);
export function revelar(k) { if (!revelado(k)) { S.revelado.push(k); if (k.startsWith('ed:')) S.novos[k.slice(3)] = true; return true; } return false; }
export const etapaAtual = () => ETAPAS[S.etapa] || null;
// avança as etapas concluídas; devolve as coisas recém-reveladas
export function avancar(ctx) {
  const novas = [];
  for (let guarda = 0; guarda < 20; guarda++) {
    const e = ETAPAS[S.etapa]; if (!e) break;
    for (const k of e.revela || []) if (revelar(k)) novas.push(k);
    if (!e.feito(ctx)) break;
    S.etapa++;
  }
  // fim das etapas: tudo aparece, e cada prédio novo surge quando a Fama libera
  if (livre()) for (const k of [...TUDO, ...Object.keys(EDIFICIOS).filter(desbloqueado).map(k => 'ed:' + k)]) if (revelar(k)) novas.push(k);
  return novas;
}
// prédio aparece no mapa só depois de revelado
export const visivel = id => id === 'quadro' ? revelado('ed:quadro') || S.etapa > 0 : desbloqueado(id) && (revelado('ed:' + id) || livre() || !!S.guilda);
// depois das etapas, o próximo prédio trancado aparece em obras (mostra o que vem pela frente)
export function proximoTrancado() {
  if (!livre() || !S.guilda) return null;
  const l = Object.entries(EDIFICIOS).filter(([k]) => !desbloqueado(k)).sort((a, b) => a[1].fama - b[1].fama);
  return l.length ? l[0][0] : null;
}
export const terminou = () => S.etapa >= ETAPAS.length;
// na última etapa (chefe) o resto já vai aparecendo conforme a Fama libera
export const livre = () => S.etapa >= ETAPAS.length - 1;
