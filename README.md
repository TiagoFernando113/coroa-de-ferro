# Batalha da Ponte

Jogo 3D de celular (Android, via WebView). Seu arqueiro atira sozinho: arraste para mirar nas
pilhas das laterais (+1, +99, x2, barricadas) e ganhar soldados. O exército azul marcha pelo
meio da ponte contra o exército vermelho e o chefe. Moedas compram melhorias entre as fases.
O jogo antigo (Guilda dos Heróis / Coroa) fica no histórico do git, commit `9c78232`.

## Como é feito
- `src/` — código (módulos JS): `dados.js` (fases e melhorias), `meta.js` (save), `ponte.js`
  (a partida e a interface), `cena.js` (three.js), `util.js` (sons, ícones), `main.js` (entrada).
- `jogo.js` — tudo empacotado com three.js (`node tools/build.mjs`).
- `modelos.bin` — modelos 3D (`node tools/empacotar.mjs`); `recursos.bin` — fontes e sons
  (`node tools/recursos.mjs`); `src/icones.js` — ícones (`node tools/icones.mjs`).
- `versao.json` — versão e arquivos; o app baixa os arquivos novos quando a versão sobe.

## Créditos (tudo livre)
- Modelos 3D: KayKit (Kay Lousberg) e Kenney — CC0.
- Ícones: game-icons.net (Lorc, Delapouite e outros) — CC BY 3.0.
- Sons: Kenney — CC0. Fontes: Lilita One e Fredoka (Google Fonts) — OFL. Motor: three.js — MIT.

## Desenvolvimento
```sh
cd tools && npm install && npm i --no-save @iconify-json/game-icons && sh baixar-kits.sh
node empacotar.mjs && node icones.mjs && node recursos.mjs && node build.mjs
cd .. && node tools/checar.js && python3 -m http.server   # abra http://localhost:8000
node tools/simular.mjs 24   # simula 24h de jogo para equilibrar a economia
```
