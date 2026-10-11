# CYRON Pet

A CYRON em versão chibi, passeando pela borda de baixo da tela por cima de qualquer app,
com o Mundinho (o planetinha) flutuando do lado. Só Android: o iPhone não deixa um app
desenhar por cima dos outros.

**Baixar:** https://github.com/TiagoFernando113/coroa-de-ferro/releases/download/pet/CyronPet.apk
(instale por cima da versão anterior; o pet não se perde).

## Como se joga
- **Na tela:** ela anda, para, senta, acena, fala oi em várias línguas e dorme quando cansa.
  Toque nela para um carinho (ela pula e solta coraçõezinhos), arraste para mudar de lugar,
  toque duas vezes para abrir a tela de cuidar. Segurando o dedo nela, ela sai para dar uma
  volta e volta em 10 minutos (bom quando ela fica em cima do teclado).
- **Cuidar:** barriga, energia e humor caem com o tempo de verdade, mesmo com o app fechado.
  Comida (biscoito, onigiri, pudim), brincar e dormir.
- **Moedas:** uma por minuto em que ela fica na tela com o celular aceso, duas se ela estiver
  feliz. Servem para comida e acessórios (laço, gorro, óculos, fone grande, coroa), que também
  pedem um nível de amizade.

## Permissões
- *Aparecer sobre outros apps*: a pessoa libera uma vez; o app leva até a tela certa.
- *Serviço em primeiro plano* (tipo `specialUse`) e *notificações*: enquanto ela está na tela
  fica um aviso fixo, com o botão **Guardar**. Na Play Store esse tipo de serviço precisa de
  uma justificativa no cadastro (o texto está no `AndroidManifest.xml`).

## Como é feito
Java puro, sem bibliotecas e sem imagens: a CYRON é desenhada em código (`Desenho.java`),
então cada pose é só um jeito diferente de montar as mesmas peças.

- `Pet.java`: o estado (barriga, energia, humor, moedas, amizade) e o tempo passando.
- `Desenho.java`: a CYRON chibi, o Mundinho e os coraçõezinhos.
- `PetService.java`: as janelinhas por cima dos apps, o passeio e o toque.
- `Balao.java`: o balão de fala, numa janela que deixa o toque passar.
- `MainActivity.java`: a tela de cuidar e a loja.

Bateria: 20 quadros por segundo só quando ela se mexe, menos parada ou dormindo, e nada com
a tela apagada.

```sh
cd pet && gradle assembleRelease   # precisa do Android SDK (ANDROID_HOME)
```
O APK sai com a mesma chave de desenvolvimento da Coroa (`dev.keystore`), então cada versão
nova instala por cima da anterior.
