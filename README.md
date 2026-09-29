# Coroa de Ferro

Defesa + tycoon em 3D para celular (Android, via WebView). Ondas de esqueletos atacam a
muralha; você constrói e melhora torres de arqueiros, catapultas, balistas, torres mágicas e
quartéis (8 níveis cada), reforça a muralha, junta ouro com a mina e luta junto com um herói
(Cavaleiro, Bárbaro, Arqueira ou Maga). Estilo tycoon: pise nos botões do chão para comprar.

## Como é feito
- `src/` — código do jogo (módulos JS): `dados.js` (classes, habilidades, inimigos, ondas,
  defesas), `mundo.js` (mapa e colisões), `jogo.js` (simulação), `cena.js` (three.js),
  `ui.js` (HUD, controles, menus), `main.js` (entrada).
- `jogo.js` — tudo empacotado com three.js (`node tools/build.mjs`).
- `modelos.bin` — modelos 3D num arquivo só (`node tools/empacotar.mjs`): personagens
  KayKit (Kay Lousberg) e cenário Kenney, todos CC0. Baixe os kits com `tools/baixar-kits.sh`.
- `versao.json` — versão e arquivos. O app baixa os arquivos novos sozinho quando a versão
  sobe (a versão também fica em `src/dados.js`).

## Desenvolvimento
```sh
cd tools && npm install && sh baixar-kits.sh && node empacotar.mjs && node build.mjs
cd .. && node tools/checar.js && python3 -m http.server   # abra http://localhost:8000
```
Controles no PC: WASD anda, J ataca, 1/2/3 habilidades, espaço esquiva, G começa a onda.

Equilíbrio: `node tools/simular.mjs 25` roda as ondas sem gráficos com um jogador automático.
