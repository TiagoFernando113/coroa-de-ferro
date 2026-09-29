// Dados da Guilda de Heróis: prédios, heróis, raridades, regiões/missões e objetivos.
// Os números crescem de forma exponencial (estilo idle): cada melhoria custa mais e rende mais.

export const VERSAO = 22;

// ---------------- números grandes ----------------
const SUF = ['', 'K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah'];
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n).toString();
  let i = 0; while (n >= 1000 && i < SUF.length - 1) { n /= 1000; i++; }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + SUF[i];
}
export function fmtTempo(s) {
  s = Math.max(0, Math.ceil(s));
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60 ? (s % 60) + 's' : '');
  return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
}

// ---------------- prédios ----------------
// custo(n) = preço para ir do nível n para n+1 (n = 0: construir)
// marcos: a cada marco o efeito principal dobra (clássico dos idles)
export const MARCOS = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500];
export const marcosAte = n => MARCOS.filter(m => n >= m).length;
export const proxMarco = n => MARCOS.find(m => m > n) || null;
export const EDIFICIOS = {
  taverna: { nome: 'Taverna', icone: 'taverna', fama: 1, base: 10, cresc: 1.12, cor: '#e0923a', desc: 'Aventureiros comem, bebem e pagam. Sua renda principal de ouro.' },
  quadro: { nome: 'Quadro de Missões', icone: 'quadro', fama: 1, base: 60, cresc: 1.42, cor: '#c9a46a', desc: 'Mais missões ao mesmo tempo e recompensas maiores.' },
  alojamento: { nome: 'Alojamento', icone: 'alojamento', fama: 1, base: 80, cresc: 1.5, cor: '#8a6a4a', desc: 'Camas para mais heróis na guilda.' },
  portal: { nome: 'Portal de Recrutamento', icone: 'portal', fama: 2, base: 250, cresc: 1.55, cor: '#8a5ad8', desc: 'Heróis mais raros aparecem no recrutamento.' },
  treino: { nome: 'Campo de Treino', icone: 'treino', fama: 3, base: 400, cresc: 1.3, cor: '#5fb83a', desc: 'Heróis descansando na guilda ganham experiência.' },
  forja: { nome: 'Forja', icone: 'forja', fama: 4, base: 1200, cresc: 1.32, cor: '#d8543a', desc: 'Armas melhores: mais poder para todos os heróis.' },
  mercado: { nome: 'Mercado', icone: 'mercado', fama: 5, base: 5000, cresc: 1.3, cor: '#3aa0c8', desc: 'Vende os troféus das missões: mais ouro de tudo.' },
  enfermaria: { nome: 'Enfermaria', icone: 'enfermaria', fama: 6, base: 15000, cresc: 1.36, cor: '#e05a7a', desc: 'Heróis feridos se recuperam mais rápido e se ferem menos.' },
  biblioteca: { nome: 'Biblioteca Arcana', icone: 'biblioteca', fama: 8, base: 60000, cresc: 1.34, cor: '#4a6ad8', desc: 'Mapas e magias: missões mais rápidas.' },
};
export const custoEd = (id, n) => Math.ceil(EDIFICIOS[id].base * EDIFICIOS[id].cresc ** n);
// efeitos no nível n
export const EF = {
  taverna: n => n <= 0 ? 0 : 1.5 * n * 2 ** marcosAte(n),                 // ouro/s
  quadro: n => ({ vagas: Math.min(6, 1 + Math.floor(n / 4)), bonus: 1 + 0.04 * n }),
  alojamento: n => Math.min(30, 3 + n),                                   // capacidade de heróis
  portal: n => n,                                                         // nível do portal
  treino: n => n <= 0 ? 0 : 0.6 * n * 1.06 ** n,                          // XP/s por herói na guilda
  forja: n => 1 + 0.06 * n * (1 + 0.5 * marcosAte(n)),                    // multiplicador de poder
  mercado: n => 1 + 0.05 * n * (1 + 0.5 * marcosAte(n)),                  // multiplicador de ouro
  enfermaria: n => ({ tempo: 0.93 ** n, chance: Math.max(0.1, 0.6 - 0.02 * n) }),
  biblioteca: n => Math.max(0.35, 1 - 0.025 * n),                         // multiplicador do tempo das missões
};
export function descEfeito(id, n) {
  const e = EF[id](n);
  switch (id) {
    case 'taverna': return `${fmt(e)} de ouro/s`;
    case 'quadro': return `${e.vagas} missões ao mesmo tempo · recompensas +${Math.round((e.bonus - 1) * 100)}%`;
    case 'alojamento': return `${e} vagas para heróis`;
    case 'portal': return `Chance de raros: ${chancesRecrutar(n).slice(1).map((c, i) => `${RARIDADES[i + 1].nome} ${(c * 100).toFixed(1)}%`).join(' · ')}`;
    case 'treino': return `+${fmt(e)} XP/s por herói descansando`;
    case 'forja': return `Poder dos heróis ×${e.toFixed(2)}`;
    case 'mercado': return `Ouro ×${e.toFixed(2)}`;
    case 'enfermaria': return `Recuperação ${Math.round(e.tempo * 100)}% do tempo · chance de ferir ${Math.round(e.chance * 100)}%`;
    case 'biblioteca': return `Missões levam ${Math.round(e * 100)}% do tempo`;
  }
}

// ---------------- heróis ----------------
export const CLASSES = {
  cav: { nome: 'Cavaleiro', modelo: 'cav', icone: 'cav', poder: 12, cor: '#4a7bd0' },
  bar: { nome: 'Bárbaro', modelo: 'bar', icone: 'bar', poder: 14, cor: '#d0663a' },
  arq: { nome: 'Arqueira', modelo: 'arq', icone: 'arq', poder: 11, cor: '#4aa84a' },
  mag: { nome: 'Maga', modelo: 'mag', icone: 'mag', poder: 13, cor: '#8a5ad8' },
  lad: { nome: 'Ladino', modelo: 'npc', icone: 'lad', poder: 10, cor: '#6a6a7a' },
};
export const RARIDADES = [
  { nome: 'Comum', cor: '#b8b8b8', mult: 1 },
  { nome: 'Raro', cor: '#4aa3ff', mult: 1.7 },
  { nome: 'Épico', cor: '#b86bff', mult: 2.9 },
  { nome: 'Lendário', cor: '#ffb02e', mult: 5 },
];
export function chancesRecrutar(portal, premium = false) {
  let l = premium ? 0.05 + 0.004 * portal : 0.004 + 0.0015 * portal, e = premium ? 0.25 + 0.01 * portal : 0.04 + 0.006 * portal, r = premium ? 0.5 : 0.22 + 0.012 * portal;
  l = Math.min(l, 0.2); e = Math.min(e, 0.4); r = Math.min(r, 0.55);
  return [Math.max(0, 1 - l - e - r), r, e, l];
}
export const xpHeroi = n => Math.round(25 * 1.22 ** (n - 1));
export const custoTreinar = (h) => Math.ceil(15 * 1.24 ** (h.nivel - 1) * (1 + h.rar * 0.5));
export const custoRecrutar = total => Math.ceil(40 * 1.75 ** total);
export const GEMAS_RECRUTAR = 40;
const NOMES = ['Aldo', 'Bruna', 'Caio', 'Dora', 'Enzo', 'Fia', 'Gael', 'Hana', 'Ivo', 'Júlia', 'Kael', 'Luna', 'Mauro', 'Nina', 'Otto', 'Pietra', 'Quim', 'Rosa', 'Saulo', 'Tainá', 'Ugo', 'Vera', 'Wado', 'Yara', 'Zeca', 'Rurik', 'Isolda', 'Tibério', 'Morgana', 'Bento', 'Íris', 'Leão', 'Cora', 'Davi', 'Elba', 'Fausto', 'Greta', 'Heitor', 'Inês', 'Joca'];
export const nomeAleatorio = (usados = []) => { const l = NOMES.filter(n => !usados.includes(n)); const p = l.length ? l : NOMES; return p[Math.floor(Math.random() * p.length)]; };

// ---------------- regiões e missões ----------------
// requisito de poder cresce ×12 por região; cada região tem 3 missões repetíveis e 1 chefe
export const REGIOES = [
  { id: 'floresta', nome: 'Floresta Sombria', icone: 'floresta', cor: '#3f8f4a', afin: 'arq', chefe: 'Lobo Gigante' },
  { id: 'pantano', nome: 'Pântano Venenoso', icone: 'pantano', cor: '#6a8a3a', afin: 'mag', chefe: 'Bruxa do Pântano' },
  { id: 'montanha', nome: 'Montanhas Gélidas', icone: 'montanha', cor: '#7aa0c8', afin: 'bar', chefe: 'Gigante de Gelo' },
  { id: 'deserto', nome: 'Deserto Escaldante', icone: 'deserto', cor: '#d8a84a', afin: 'lad', chefe: 'Escorpião Rei' },
  { id: 'ruinas', nome: 'Ruínas Élficas', icone: 'ruinas', cor: '#8aa08a', afin: 'mag', chefe: 'Golem Antigo' },
  { id: 'vulcao', nome: 'Vulcão Rugidor', icone: 'vulcao', cor: '#d8543a', afin: 'cav', chefe: 'Dragão de Fogo' },
  { id: 'cemiterio', nome: 'Cemitério Maldito', icone: 'cemiterio', cor: '#6a6a8a', afin: 'cav', chefe: 'Necromante' },
  { id: 'trono', nome: 'Trono do Rei Esqueleto', icone: 'trono', cor: '#8a3a5a', afin: 'bar', chefe: 'Rei Esqueleto' },
];
export const TIPOS_MISSAO = [
  { id: 'patrulha', nome: 'Patrulha', dur: 30, req: 1, ouro: 8, xp: 1, fama: 1, bau: 0, max: 1 },
  { id: 'cacada', nome: 'Caçada', dur: 120, req: 2.2, ouro: 40, xp: 3, fama: 3, bau: 0.08, max: 2 },
  { id: 'expedicao', nome: 'Expedição', dur: 600, req: 5, ouro: 260, xp: 10, fama: 8, bau: 0.35, max: 4 },
  { id: 'chefe', nome: 'Chefe', dur: 300, req: 12, ouro: 900, xp: 20, fama: 25, bau: 1, max: 4, chefe: true },
];
export const reqRegiao = r => 10 * 12 ** r;
export function missao(r, t) {
  const T = TIPOS_MISSAO[t], base = reqRegiao(r);
  return { r, t, req: Math.round(base * T.req), dur: T.dur, ouro: Math.round(base * T.ouro), xp: Math.round(6 * 3.2 ** r * T.xp), fama: T.fama * (r + 1), bau: T.bau, max: T.max, chefe: !!T.chefe, nome: T.chefe ? REGIOES[r].chefe : T.nome };
}
// chance de sucesso: poder igual ao requisito = 100%
export const chanceSucesso = (poder, req) => Math.max(0.05, Math.min(1, (poder / req) ** 2));

// ---------------- fama (nível da guilda) ----------------
export const xpFama = n => Math.round(12 * 1.55 ** (n - 1));

// ---------------- objetivos (dão gemas) ----------------
export const OBJETIVOS = [
  { id: 'missoes', nome: 'Missões concluídas', icone: 'missoes', metas: [1, 5, 15, 50, 150, 500, 2000, 8000] },
  { id: 'recrutados', nome: 'Heróis recrutados', icone: 'recrutar', metas: [3, 6, 10, 15, 22, 30] },
  { id: 'taverna', nome: 'Nível da Taverna', icone: 'taverna', metas: [10, 25, 50, 100, 150, 200, 300] },
  { id: 'ouroTotal', nome: 'Ouro ganho no total', icone: 'ouro', metas: [1e3, 1e5, 1e7, 1e9, 1e11, 1e13, 1e15] },
  { id: 'regioes', nome: 'Chefes derrotados', icone: 'chefe', metas: [1, 2, 3, 4, 5, 6, 7, 8] },
  { id: 'nivelHeroi', nome: 'Nível do melhor herói', icone: 'treinar', metas: [10, 25, 50, 75, 100, 150] },
  { id: 'lendarios', nome: 'Heróis lendários', icone: 'estrela', metas: [1, 3, 5, 10] },
];
export const gemasObjetivo = i => 5 * 2 ** i;
export const OFFLINE_MAX = 4 * 3600; // ganhos offline até 4h
