// Etapas guiadas: uma tarefa por vez. Cada etapa revela o que ela pede (prédio, aba, recurso)
// e aponta onde tocar. Depois da última, o resto vai aparecendo conforme a Fama libera.
import { S, nivel, desbloqueado } from './estado.js';
import { EDIFICIOS } from './dados.js';

// ctx.folha: painel aberto ('predio:taverna', 'missoes', 'herois', 'heroi', ...); ctx.modal: janela aberta ('equipe', ...)
// alvo: lista de seletores tentados em ordem ('ed:x' = rótulo do prédio no mapa)
export const ETAPAS = [
  { txt: 'Toque na <b>Taverna</b>. É lá que seus aventureiros gastam ouro.', revela: ['ed:taverna'], alvo: ['ed:taverna'],
    feito: c => c.folha === 'predio:taverna' || nivel('taverna') >= 2 },
  { txt: 'Melhore a <b>Taverna</b> até o nível 3 para ganhar mais ouro.', alvo: ['melhorar:taverna', 'ed:taverna'], feito: () => nivel('taverna') >= 3 },
  { txt: 'Novo prédio! Construa o <b>Quadro de Missões</b>.', revela: ['ed:quadro'], alvo: ['melhorar:quadro', 'ed:quadro'], feito: () => nivel('quadro') >= 1, foco: 'quadro' },
  { txt: 'Abra a aba <b>Missões</b>.', revela: ['nav:missoes'], alvo: ['nav:missoes'], feito: c => c.folha === 'missoes' || S.missoes.length > 0 || S.st.missoes > 0 },
  { txt: 'Pegue um papel do <b>Quadro de Missões</b>.', alvo: ['[data-ir]', '.papel:not(.procurado)', 'nav:missoes'], feito: () => S.missoes.length > 0 || S.st.missoes > 0 },
  { txt: 'Seus heróis partiram! Eles voltam em instantes.', alvo: ['#ativas .miniM'], feito: () => S.st.missoes > 0 },
  { txt: 'Missão cumprida! Seus heróis ganharam experiência. Abra <b>Heróis</b>.', revela: ['nav:herois'], alvo: ['nav:herois'], feito: c => c.folha === 'herois' || c.folha === 'heroi' },
  { txt: 'Toque num herói e <b>treine</b> para deixá-lo mais forte.', alvo: ['[data-a="treinar"]', '.heroi', 'nav:herois'], feito: () => (S.st.treinos || 0) > 0 },
  { txt: 'Você completou um objetivo! Pegue suas <b>gemas</b>.', revela: ['nav:objetivos', 'gemas'], alvo: ['[data-obj]:not(.sem)', 'nav:objetivos'], feito: () => Object.keys(S.obj).length > 0 },
  { txt: 'Construa o <b>Alojamento</b>: mais camas, mais heróis.', revela: ['ed:alojamento'], alvo: ['melhorar:alojamento', 'ed:alojamento'], feito: () => nivel('alojamento') >= 1, foco: 'alojamento' },
  { txt: 'Ganhe <b>Fama</b> melhorando prédios e completando missões até o nível 2.', revela: ['fama'], alvo: ['.rotulo.pode', 'nav:missoes'], feito: () => S.fama.nivel >= 2 },
  { txt: 'A Fama liberou o <b>Portal de Recrutamento</b>. Construa!', revela: ['ed:portal'], alvo: ['melhorar:portal', 'ed:portal'], feito: () => nivel('portal') >= 1, foco: 'portal' },
  { txt: 'Abra <b>Recrutar</b> e chame um novo herói para a guilda.', revela: ['nav:recrutar'], alvo: ['[data-a="gratis"]', '[data-a="recrutar"]', 'nav:recrutar'], feito: () => S.st.recrutados >= 3 },
  { txt: 'Fique forte e derrote o <b>chefe da Floresta Sombria</b>!', revela: ['nav:guilda'], alvo: ['nav:missoes'], feito: () => S.regiao >= 1 },
];
export const TUDO = ['ed:taverna', 'ed:quadro', 'ed:alojamento', 'ed:portal', 'nav:missoes', 'nav:herois', 'nav:objetivos', 'nav:recrutar', 'nav:guilda', 'gemas', 'fama'];

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
export const visivel = id => desbloqueado(id) && revelado('ed:' + id);
// depois das etapas, o próximo prédio trancado aparece em obras (mostra o que vem pela frente)
export function proximoTrancado() {
  if (!livre()) return null;
  const l = Object.entries(EDIFICIOS).filter(([k]) => !desbloqueado(k)).sort((a, b) => a[1].fama - b[1].fama);
  return l.length ? l[0][0] : null;
}
export const terminou = () => S.etapa >= ETAPAS.length;
// na última etapa (chefe) o resto já vai aparecendo conforme a Fama libera
export const livre = () => S.etapa >= ETAPAS.length - 1;
