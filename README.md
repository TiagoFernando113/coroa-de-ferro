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

## App Android

Como no Cyron: o jogo vai **dentro do APK** (abre sem internet). A cada abertura o app confere `versao.json` no repositório (ramo de desenvolvimento, depois `main`); se a versão for maior, baixa os arquivos e recarrega. Para entregar uma mudança: subir `versao` em `versao.json` e `VERSAO` em `game.js` (o workflow Testes confere que batem).

APK novo só quando `android/` muda (workflow `APK`, publica em Releases). Link fixo:
https://github.com/TiagoFernando113/coroa-de-ferro/releases/latest/download/CoroaDeFerro.apk

`android/dev.keystore` é chave só de desenvolvimento (versionada para todo APK instalar por cima do anterior). Para a Play Store, usar outra chave fora do repositório.
