# Guilda dos Heróis

Tycoon de administração em 3D para celular (Android, via WebView). Você comanda uma guilda:
melhora prédios (Taverna, Quadro de Missões, Alojamento, Portal, Campo de Treino, Forja,
Mercado, Enfermaria, Biblioteca), recruta heróis de 5 classes e 4 raridades, manda equipes em
missões por 8 regiões com chefes e acompanha os números crescerem — inclusive com o jogo fechado.

## Como é feito
- `src/` — código (módulos JS): `dados.js` (números e textos), `estado.js` (lógica e save, sem
  gráficos), `base.js` (a sede em 3D e os heróis passeando), `cena.js` (three.js), `ui.js`
  (interface, sons, controles), `icones.js` (gerado), `main.js` (entrada).
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
