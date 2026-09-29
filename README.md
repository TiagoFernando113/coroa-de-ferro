# Coroa de Ferro

RPG de ação 3D para celular (Android, via WebView). Escolha um herói (Cavaleiro, Bárbaro,
Arqueira ou Maga), explore a vila, a floresta, as ruínas e o castelo, suba de nível, junte
equipamentos e recupere a Coroa de Ferro do Rei Esqueleto.

## Como é feito
- `src/` — código do jogo (módulos JS): `dados.js` (classes, habilidades, inimigos, itens,
  missões), `mundo.js` (mapa e colisões), `jogo.js` (simulação), `cena.js` (three.js),
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
Controles no PC: WASD anda, J ataca, 1/2/3 habilidades, espaço esquiva, E fala, Q poção.
