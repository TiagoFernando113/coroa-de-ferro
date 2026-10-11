# CYRON Pet: a aventura no cantinho

Um mini RPG que roda numa janelinha no canto da tela, por cima de qualquer app, enquanto você
usa o celular. A CYRON (em versão chibi, com o Mundinho do lado) anda por um mundinho, luta
sozinha com os monstros, junta moedas e sobe de nível. Só Android: o iPhone não deixa um app
desenhar por cima dos outros.

**Baixar:** https://github.com/TiagoFernando113/coroa-de-ferro/releases/download/pet/CyronPet.apk
(instale por cima da versão anterior; o progresso não se perde).

## Como se joga
- **No canto:** ela anda e luta sozinha. A cada 10 monstros vem um chefe com 30 segundos para
  cair; a cada 5 zonas muda a região (campina, bosque, brejo, minas, dunas, picos, cripta, vulcão).
  Se ela apanhar demais, desmaia, descansa uns segundos e volta.
- **Toques:** tocar na janelinha dá um golpe extra; baús aparecem no chão e moedas douradas
  passam voando, e só ficam um tempinho. Arrastar muda a janelinha de lugar (ela encosta na
  borda mais perto). O **–** vira uma bolinha com o rosto dela; tocar na bolinha volta.
  A bolsa abre o app.
- **No app:** melhorias com moedas (arma, moletom, tênis, Mundinho, sorte, toque). A cada 25
  níveis de arma, arma nova (varinha, espada, martelo de cristal, cajado do Mundo, lâmina
  arco-íris). Acessórios (laço, gorro, óculos, fone, coroa) com cristais dos baús.
- **Com o celular parado:** ela continua caçando na zona em que estava, com metade do
  rendimento e até 8 horas. Passar de zona é com você por perto.

## Permissões
- *Aparecer sobre outros apps*: liberada uma vez; o app leva até a tela certa.
- *Serviço em primeiro plano* (tipo `specialUse`) e *notificações*: enquanto a aventura está
  na tela fica um aviso fixo com o botão **Guardar**. Na Play Store esse tipo de serviço precisa
  de uma justificativa no cadastro (o texto está no `AndroidManifest.xml`).

## Como é feito
Java puro, sem bibliotecas e sem imagens: tudo é desenhado em código.

- `Jogo.java`: a regra inteira (luta, zonas, chefes, baús, melhorias, tempo fora, save em texto).
  Não depende do Android, então dá para simular horas de jogo no computador.
- `Desenho.java`: a CYRON chibi, as armas, o golpe e o Mundinho.
- `Monstros.java`: gosma, cogumelo, morcego, assombração, golem e diabrete, com cor por região.
- `CenaView.java`: a cena (janelinha, tela do app e bolinha) e o que cada toque faz.
- `PetService.java`: a janelinha por cima dos apps, arrastar, encostar e minimizar.
- `MainActivity.java`: a base, com melhorias, acessórios e o botão de jogar no canto.
- `Salvo.java`: guarda o jogo e traz o progresso da primeira versão (o pet de cuidar).

Bateria: 20 quadros por segundo com a janelinha aberta, 2 com a bolinha, nada com a tela apagada.

```sh
cd pet && gradle assembleRelease   # precisa do Android SDK (ANDROID_HOME)
```
O APK sai com a mesma chave de desenvolvimento da Coroa (`dev.keystore`), então cada versão
nova instala por cima da anterior.
