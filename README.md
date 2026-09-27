# Coroa de Ferro

Jogo de estratégia de reino no navegador (estilo Kingshot / Rise of Kingdoms). Por enquanto o mundo é povoado por **24 reinos-bot** que usam exatamente as mesmas regras e ações do jogador — a ideia é trocá-los por jogadores reais depois (servidor autoritativo). Salva no `localStorage`; o mundo continua rodando com o jogo fechado.

- **Cidade**: 8 construções com evolução por tempo (Castelo limita as demais), produção de 🌾🪵🪨🪙 e limite do Armazém.
- **Exército**: Infantaria > Cavalaria > Arqueiros > Infantaria; treino em lotes no Quartel.
- **Mapa 50×50**: ataque bárbaros (desbloqueio nível a nível), colete jazidas, marchas com ida/volta e chamar de volta.
- **Pesquisa**: 6 tecnologias na Academia.
- **Bots**: constroem, pesquisam, treinam, caçam bárbaros, coletam, saqueiam e se vingam; ficam offline por horas como gente.
- **PvP**: ataque cidades, saque acima do protegido pelo Armazém, feridos vão ao Hospital, Muralha defende, escudo de iniciante (48h) e escudo por gemas.
- **Alianças**: 4 alianças, ajuda que acelera construção/pesquisa, mural de atividade.
- **Ranking** de poder de reinos e alianças; alerta de ataque chegando.
- **Missões** guiadas com recompensas; 💎 gemas aceleram; construções/pesquisas < 5 min são grátis.

Rodar: abrir `index.html` (ou GitHub Pages).

## Visual

A cena (cidade e mapa) é isométrica, desenhada em canvas com sprites gerados a partir dos kits 3D **Castle Kit** e **Fantasy Town Kit** da [Kenney](https://kenney.nl) (licença CC0). As composições ficam em `tools/sprites/pecas.js`; para regerar `atlas.png`/`atlas.json`:

```sh
sh tools/sprites/baixar-kits.sh
(cd tools/sprites && npm i three@0.160.0)
node tools/sprites/render.js
```

### Personagens (Modo Chefão)

`chars.png`/`chars.json` são personagens animados (parado, andando, atacando, morrendo em 4 direções) gerados dos kits **Mini Dungeon** e **Mini Characters** da Kenney (CC0): `node tools/sprites/personagens.js`.

### Modo Chefão em 3D

A luta pode ser vista em 3D (câmera atrás do chefão). `boss3d.js` é gerado de `tools/boss3d/boss3d.src.js` com o three.js embutido (`node tools/boss3d/build.mjs`); `modelos3d.bin` junta os modelos GLB (personagens **KayKit Adventurers** e **KayKit Skeletons** de Kay Lousberg, CC0, baixados de github.com/KayKit-Game-Assets para `tools/sprites/kits/kaykit`; arena com peças da Kenney) com textura embutida e só as animações usadas (`node tools/boss3d/enxugar.mjs`). Dependências em `tools/sprites`: `npm i three@0.160.0 esbuild@0.24.0 @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4`.

## App Android

Como no Cyron: o jogo vai **dentro do APK** (abre sem internet). A cada abertura o app confere `versao.json` no repositório (ramo de desenvolvimento, depois `main`); se a versão for maior, baixa os arquivos e recarrega. Para entregar uma mudança: subir `versao` em `versao.json` e `VERSAO` em `game.js` (o workflow Testes confere que batem).

APK novo só quando `android/` muda (workflow `APK`, publica em Releases). Link fixo:
https://github.com/TiagoFernando113/coroa-de-ferro/releases/latest/download/CoroaDeFerro.apk

`android/dev.keystore` é chave só de desenvolvimento (versionada para todo APK instalar por cima do anterior). Para a Play Store, usar outra chave fora do repositório.
