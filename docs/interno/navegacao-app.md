# Barra de navegação, tela de Início e Perfil (01/08/2026)

## O que é
O app do jogador ganhou uma **barra fixa no rodapé** com quatro destinos (Início, Descobrir, Partidas, Perfil), presente em todas as telas. Com isso, a tela de Início deixou de ser um menu de links e virou um **resumo** do que importa agora, e nasceu uma tela de **Perfil**.

Resolve uma pendência antiga do CLAUDE.md: o app não tinha navegação consistente e o botão "Sair" só existia na tela inicial.

## Onde fica no código
- Barra: `src/components/BarraNavegacao.tsx`
- Layout que a injeta: `src/app/app/layout.tsx`
- Tela de Início: `src/app/app/page.tsx`
- Tela de Perfil: `src/app/app/perfil/page.tsx`
- Rótulo de nível da categoria (compartilhado): `src/lib/partidas.ts` (`ROTULO_NIVEL`)

Não houve mudança nenhuma no banco.

## A barra

**Por que um layout novo.** Antes existia só o layout raiz (`src/app/layout.tsx`), que cobre o site inteiro. A barra é da experiência do jogador — não pode aparecer no painel do clube (`/clube`) nem no login (`/entrar`). Um layout em `src/app/app/layout.tsx` resolve isso pela própria estrutura de pastas, sem nenhum "se a rota for X, esconde".

**Some nas telas de cadastro.** Em `/app/onboarding` e `/app/completar-perfil` a barra não aparece: quem ainda não terminou o cadastro não deve conseguir escapar dele pela navegação. É a única exceção, e está numa constante no topo do componente (`ROTAS_SEM_BARRA`).

**Item aceso por rota.** "Início" acende só em `/app` exato — se fosse por prefixo, acenderia em todas as telas. Os outros acendem por prefixo, mais uma lista de rotas irmãs: a página de um clube acende "Descobrir" (foi de onde o jogador veio), e "Minhas reservas" acende "Perfil" (é de lá que se chega nela).

**O espaçador não é detalhe.** A barra é `fixed`, então sai do fluxo da página e taparia o fim do conteúdo na rolagem. O componente devolve um `<div>` espaçador junto com a barra — e como ele é irmão da barra, some sozinho nas telas em que a barra não aparece. Medido: espaçador de 72px, barra de 59px.

## Tela de Início: de menu para resumo

Antes: quatro cards de link (Descobrir, Partidas abertas, Minhas partidas, Minhas reservas). Com a barra assumindo a navegação, esses cards viraram duplicata — então saíram, e a tela passou a mostrar:

1. Saudação e **categoria atual** (o que já existia)
2. **Pendência de pagamento**, quando houver
3. Dois **atalhos**: "Jogar agora" e "Reservar"
4. **Seus próximos jogos**
5. Link para o feed de partidas abertas

### A lista única de próximos jogos — e por que ela é só visual
Reservas e partidas aparecem na mesma lista, com uma etiqueta dizendo qual é qual.

Isso nasceu de um incômodo do fundador: "Minhas partidas" não mostrava as quadras reservadas, e para ele as duas coisas são "meu próximo jogo". A união é **só de apresentação** — nada muda no banco, uma reserva continua reserva e uma partida continua partida.

Foi feito assim de propósito: a decisão de **partida privada** (transformar reserva em partida rastreável) depende da regra nº 5 e ainda não foi tomada. Se ela acontecer, a tela já está no formato certo; se não acontecer, nada foi comprometido.

**Cuidado que evita jogo duplicado:** quem cria partida aberta também vira dono da reserva por baixo (`criar_partida` grava nas duas tabelas). Sem tratar isso, o mesmo jogo apareceria duas vezes. A lista descarta as reservas cujo `id` está em `partidas.reserva_id` das minhas partidas.

### Pendência de pagamento
Dois níveis, calculados com `statusDoPagamento` (o mesmo de "Minhas partidas"):
- **Inadimplente** → bloco vermelho, porque isso trava reservar e entrar em partidas. É o caso urgente.
- **Aguardando** (partida já jogada, ainda no prazo) → bloco âmbar, mais leve.

Só conta partida que **já aconteceu** — partida futura nunca gera pendência.

### O atalho "Reservar"
Aponta para a página de reserva do **clube da última reserva do jogador**. Sem reserva anterior, cai no mapa.

Isso é um paliativo assumido: o ideal é apontar para os **clubes favoritos**, ideia já aprovada no CLAUDE.md mas ainda não construída. Quando ela existir, muda só a fonte do clube — o resto da tela continua igual.

## Tela de Perfil (`/app/perfil`)
Mostra o que já está guardado hoje: nome, foto, cidade, categoria atual, selo "em calibração", atalhos para Minhas reservas e Minhas partidas, e o botão **Sair** — que saiu da tela inicial e veio para cá.

**Não tem nada de rating, de propósito.** Histórico, evolução e estatísticas entram no Sprint 5, depois que a regra nº 5 for decidida. Colocar um espaço reservado agora seria presumir o desenho do motor de cálculo antes da decisão. Há um comentário no arquivo avisando disso, para ninguém achar que é esquecimento.

## O mapa passou a aceitar `?agora=1`
O atalho "Jogar agora" precisa chegar no mapa com o filtro já ligado. O filtro era estado interno do componente, sem entrada pela URL.

**Detalhe que quase virou bug:** ligar só o estado não bastaria. Os horários ocupados são carregados dentro da função do botão, e a lista trata "sem dados de ocupação" como quadra livre — o mapa mostraria **todos os clubes como livres**, uma resposta errada. Por isso o atalho dispara a mesma função do botão, por um efeito de montagem com trava de execução única.

## Como foi testado (navegador, 01/08/2026)
- **Rodrigo** (sem dados): estados vazios, atalho "Reservar" caindo no mapa
- **Bruno** (inadimplente pelo seed): bloco vermelho de pendência e atalho apontando para o Clube Teste
- **Conta nova** (`5551999992222`, criada para isto): barra **ausente** nas cinco telas do cadastro e **presente** assim que ele termina, caindo no Início

Também verificado: barra ausente em `/clube`; item correto aceso em cada rota, inclusive `/app/partidas/minhas` acendendo "Partidas"; navegação por toque sem recarregar a página; conteúdo não coberto pela barra numa tela que não foi modificada (`/app/reservas`); layout correto em 375px. `tsc` e `eslint` limpos, zero erro de console.

**Não testado:** nada além do que está acima. O teste do fundador no celular confirmou o funcionamento geral.

## Efeito colateral tratado
Cinco artigos de cliente mandavam tocar em "Minhas partidas" ou "Minhas reservas" **na tela inicial** — instrução que deixou de valer, porque as duas foram para o Perfil. Os cinco foram corrigidos junto com esta entrega.

## O que isto deixou exposto
Testando no celular, o fundador notou que quase todo caminho termina no **Descobrir**. Investigado: não é só falta de dados, é estrutural — criar partida e reservar só existem dentro da página de um clube, e o único jeito de escolher um clube é o mapa. Registrado no CLAUDE.md em "Ideias Futuras" como assunto de UX a analisar, com o "favoritar clubes" apontado como antídoto natural.

## Métricas
- `navegacao_barra` (com o destino tocado)
