# STATUS DO PRODUTO — Checklist de Funcionalidades (Fases 1, 2 e 3)
### Única fonte de verdade sobre o que está CONSTRUÍDO vs. PLANEJADO
*O CLAUDE.md descreve COMO cada coisa deve funcionar (regras de negócio) e CONTA a história (sprint a sprint, em prosa). Este documento responde a uma pergunta diferente e específica: **de tudo que o produto precisa, em todas as fases, o que já existe de verdade no código?** Atualizar sempre que um item mudar de status — idealmente confirmando contra o código, não de memória.*

*Sprints são um guia, não uma prisão: se uma sessão não terminar um bloco inteiro, sem problema — é só retomar no mesmo ponto na próxima vez.*

---

## 📋 COMANDO DE RETOMADA
*Cole isto no Claude Code no início de cada sessão. Serve para qualquer sprint, módulo ou fase — não existe mais um comando por sprint.*

```
Releia o CLAUDE.md e o Status_Produto_Checklist.md.

Antes de propor qualquer coisa, CONFIRME NO CÓDIGO o status dos itens que
pretende tocar. O Checklist pode estar desatualizado, e item marcado 📄
nunca foi auditado — não confie nele sem verificar.

Depois me diga, nesta ordem:
1. Qual o próximo bloco segundo o Checklist e a seção de dependências
2. O que esse bloco exige que ainda não existe
3. Um plano em 3–5 linhas

Não comece a construir antes do meu ok.

Ao terminar: atualize o CLAUDE.md (histórico e decisões) e o Checklist
(marque os itens com 🔍 e a referência de código), e confirme que está
tudo no GitHub.

LEMBRETE PERMANENTE: se você sugerir pular alguma regra do CLAUDE.md
(cobrar taxa do jogador, painel mono-esporte "para simplificar"), isso é
sinal de alerta — pare e me chame antes de aprovar.
```

---

**Legenda:**
- ✅ **Pronto e testado no celular pelo fundador**
- 🔧 **Código existe, mas parcial ou não testado no celular ainda**
- ⏳ **Planejado, não iniciado**
- ⚠️ **Existe uma versão manual/provisória, não a versão final**

**Origem da informação em cada linha:**
- 🔍 = confirmado por auditoria direta no código (27 e 29/07/2026, a pedido do fundador)
- 📄 = baseado no CLAUDE.md / relatos de sprint, ainda não re-auditado — **confirmar com o Claude Code antes de confiar 100%**

---

## Onde estamos e o que trava o quê
*Esta seção substitui a ordem que o antigo Comandos_de_Retomada_Sprints.md codificava. Ler antes de escolher o próximo bloco — item sem dependência atendida não deve ser iniciado.*

*Revisado em 17/08/2026: os três primeiros itens da lista antiga já foram resolvidos (barra de navegação, registro de resultado e push existem). Sobrou o que segue.*

- **Tudo que envolve dinheiro real depende do GATEWAY** (fornecedor não decidido): repasse ao clube, reembolso, e o pacote do modelo de pagamento — que o fundador definiu em 09/08 como **pré-requisito de beta**. A homologação leva dias que não dependem de nós, então a decisão do fornecedor é o gargalo mais caro em aberto
- **WhatsApp automático destrava DOIS módulos ao mesmo tempo** (1.3 e 1.4) — depende de contratar um BSP
- **Chat NÃO depende de fornecedor nenhum** — o Supabase Realtime já roda no projeto (3 canais). Só o *fallback* WhatsApp precisa de BSP
- **LGPD (Módulo 1.8): construída** (`038`, 17/08/2026) — exportação, exclusão por anonimização e consentimento versionado. **O que ainda trava o lançamento não é código: é o TEXTO jurídico da política**, que depende da marca decidida e de revisão de advogado. A página existe com texto provisório e avisa o usuário disso
- **Bloquear a exclusão de quem deve encosta na revisão jurídica (CDC)** já registrada no CLAUDE.md: a dívida costuma ser entre jogadores, não com a plataforma. A trava está construída; a validação legal não
- **Liga e torneio (Fase 2) destravam dois pesos do rating** que já existem nos parâmetros e hoje não têm de onde vir
- **A análise de UX/design do app inteiro** foi decidida para **depois** de o produto estar pronto — e o cache da casca do app foi adiado para depois dela. Não redesenhar por conta própria antes dessa conversa

---

## 🔜 SPRINT 5 — ESCOPO DECIDIDO (29/07/2026)

**Resultados + Rating + Categorias + barra de navegação fixa + sessão em grupo com convite e aceite.**

> ✅ **DESBLOQUEADO EM 01/08/2026.** A regra nº 5 foi revisada e as duas decisões que travavam o sprint estão fechadas (detalhe completo no CLAUDE.md, em "Ideias Futuras"):
> - **Decisão 1:** a reserva vira **sessão** com participantes aceitos, e **cada set é um mini-resultado** entre duas duplas, com travas de validade, confirmação e origem, em janela de 24h.
> - **Decisão 2:** o set vale **0,5x** a partida cheia de 4. Competitivo por padrão, sem limite de sets repetidos no mesmo dia. Gamificação é eixo separado — **menos** a trava de origem no app, que é universal.
>
> ⚠️ **O escopo cresceu:** entra também transformar a reserva em sessão com convite e aceite. Dimensionar contando com isso.

**Por que chat e notificações ficaram para depois:** o critério de pronto do MVP no CLAUDE.md termina em "registra resultado → vê categoria evoluir" — chat não está nele. Rating é a cunha contra o Playtomic e está em 0%, enquanto o trilho de descoberta já está quase pronto. Decisão consciente, não esquecimento.

- [x] ✅ 🔍 **Barra de navegação fixa** (início, descobrir, partidas, perfil) — `BarraNavegacao.tsx` + `app/app/layout.tsx`. Testada no navegador com 3 contas (inclusive conta nova, confirmando que some no cadastro) e **aprovada pelo fundador no celular em 01/08/2026**

### ✅ ENTREGA A — fechada em 04/08/2026 (7 scripts: `014` a `020`)
Sessão com convite e aceite, sets com contestação e votação, divisão do valor, "Desistir", avisos dentro do app. Detalhe em `docs/interno/sessoes-e-sets.md`.

### 🔜 O que falta no Sprint 5
- [x] ✅ **Motor de rating (Glicko-1)** — scripts `025` a `030`. Fórmula conferida contra o exemplo publicado do autor do Glicko; recálculo reproduzível; proteção de queda vista funcionando com dados reais. Detalhe em `docs/interno/motor-de-rating.md`
- [x] ✅ **Sets em partida aberta** — a área de sets passou a valer para os dois tipos de partida (`024`); sem isso o motor nasceria cego para o jogo entre desconhecidos
- [x] ✅ **Tela do rating** — categoria, barra de progresso e a trilha do "quanto mudou e por quê", com o número privado
- [x] ✅ **Agendar o recálculo** (`037`) — de hora em hora, aos :07. A dúvida que travava ("não adianta rodar de hora em hora se o bloco é de um dia") era confusão entre duas coisas: o **bloco** é a unidade da conta, a **frequência** é só quando ela é refeita. Rodar mais vezes nunca muda o resultado, só o faz aparecer mais cedo
- [x] ✅ **Web Push + PWA instalável** (`031`) — testado no iPhone do fundador com um aviso real. Junto veio o PWA, que **não existia**: sem manifesto, ícones e service worker o push nem é possível no iPhone
- [x] ✅ **Push automático** (`033`) — gatilho no banco no instante em que o aviso nasce (medido: 6s) e varredura a cada 15 min como rede de segurança. Não depende mais de ninguém estar com o app aberto
- [x] ✅ **A fila de substitutos ficou visível** (`032`) — bloco próprio na Início e em Minhas partidas, com a posição, e **aviso quando a promoção acontece**. Antes o substituto perdia o acesso à partida quando o jogo começava, e subia a jogador em silêncio
- [ ] ⏳ **Decidir o fallback para quem não instala no iPhone** — aceitar a imperfeição ou antecipar o BSP. Com o número real de alcance, antes do beta
- [x] ✅ **Entrega B** (`034`–`036`) — convite por telefone em sessão privada, com vinculação automática quando a pessoa cria a conta. Testado de ponta a ponta com um número que nunca existira no app
- [x] ✅ **Chamar um amigo para o app** — convite genérico, com código no link para o dono do app saber quem trouxe quem (sem tela, sem exposição a ninguém)

---

---

# FASE 1 — MVP (meses 1–4)

## Módulo 1.1 — Contas e Onboarding *(Sprint 1)*
- [x] ✅ 🔍 Login por telefone/OTP (fase A, número de teste) — `signInWithOtp` / `verifyOtp`
- [x] ✅ 🔍 Onboarding do jogador (nome, foto, cidade, posição, disponibilidade, raio) — colunas `posicao`, `disponibilidade`, `raio_km`
- [x] ✅ 🔍 Calibração inicial (questionário + selo "em calibração") — `calibracao_respostas`, `em_calibracao`
- [x] ✅ 🔍 Cadastro de clube com quadras multiesporte
- [x] ✅ 🔍 Preços por faixa horária, trava contra sobreposição (script 003)
- [ ] ⏳ Fase B da autenticação (Twilio real) — pendência com prazo (antes de 31/10/2026)

## Módulo 1.2 — Descoberta e Mapa *(Sprint 2)*
- [x] ✅ 🔍 Mapa com clubes geolocalizados (Leaflet + OpenStreetMap)
- [x] ✅ 🔍 Filtros: esporte, tipo de quadra, coberta, preço, cidade, distância — `Descobrir.tsx`
- [x] ✅ 🔍 "Jogar agora" (livre nas próximas 3h)
- [x] ✅ 🔍 Busca por data futura
- [x] ✅ 🔍 Página do clube (fotos, descrição, avaliações, política)
- [x] ✅ 🔍 Painel do clube v0 (edição de informações, localização)

## Módulo 1.3 — Partidas Abertas *(Sprint 4)*
- [x] ✅ 🔍 Criar partida (categoria, competitivo/amistoso, sexo, 4–8 jogadores com revezamento) — `CriarPartida.tsx`, 408 linhas
- [x] ✅ 🔍 Feed de partidas compatíveis por nível e sexo
- [x] ✅ 🔍 Entrar na partida com 1 toque
- [x] ✅ 🔍 Fila de substitutos: promoção automática do primeiro da fila — testada com 5 contas, `008_partidas.sql:328`
- [x] ✅ 🔍 **Minhas partidas** (`/app/partidas/minhas`) com status de partida (Futura/Jogada) e de pagamento (Paga/Aguardando/Inadimplente) + filtros por ambos — CLAUDE.md registra como FEITA em 26/07/2026
- [ ] ⏳ 🔍 **Notificação em cascata aos compatíveis quando abre vaga** — não existe. O plano original definia a fila incluindo isso; só o mecanismo de promoção foi feito
- [ ] ⏳ 🔍 **Filtro por região no feed** — hoje mostra partidas de todas as cidades (busca a cidade do jogador mas não usa). Travado: o fundador quer pesquisar referências de filtros antes (🔍 Em avaliação no CLAUDE.md)
- [x] ✅ 🔍 **Editar partida aberta** (`040`) — só o organizador. **Sozinho, vale na hora; com outros jogadores, vira solicitação aprovada por TODOS**, e uma recusa encerra sem esperar o resto. A tela descreve a mudança em palavras ("de 1ª–7ª para 1ª–5ª") em vez de só mostrar os valores novos, porque quem vota não lembra como era
  - **Testado de ponta a ponta com 4 contas:** Carlos propôs → a partida NÃO mudou → Rodrigo aprovou ("falta o resto") → Diego aprovou ("faltam 1") → Eduardo aprovou → aplicada, e só aí a partida mudou
  - **Travas:** uma proposta por vez (índice único), não dá para encolher abaixo de quem já está dentro, e **competitiva só com 4** — a mesma regra que `criar_partida` tem desde o `008`, repetida aqui para a edição não virar a porta dos fundos
- [ ] ⏳ **Editar HORÁRIO e QUADRA da partida aberta** — fora do recorte por decisão do fundador (17/08/2026), que quer pensar melhor. Mexe na reserva por baixo, no preço, na trava de overbooking e no divisor congelado de quem já pagou. Detalhe no CLAUDE.md
- [ ] ⏳ **Partida "grupo de amigos + vagas abertas"** — convidar 1–3 conhecidos e deixar o resto aberto. ✅ Aprovada no CLAUDE.md
- [ ] ⏳ Filtros gerais no feed (esporte, quadra, categoria, dia, cidade) — ✅ Aprovada, mesmo travamento do filtro por região

> Chat da partida e notificações: ver **Módulo 1.6** (lugar canônico, para não contar duas vezes).

## Módulo 1.4 — Reservas e Pagamentos *(Sprints 3 e 4)*
- [x] ✅ 🔍 Agenda em tempo real (3 canais `postgres_changes`), zero overbooking (`exclude using gist` + `tstzrange`)
- [x] ✅ 🔍 Reserva pelo app em 3 toques
- [x] ✅ 🔍 Reserva editável / remarcar — `remarcar_reserva`, move a MESMA reserva
- [x] ✅ 🔍 Cancelamento respeitando a política do clube (bloqueio no servidor)
- [x] ✅ 🔍 Divisão de pagamento entre jogadores (split sem taxa, sobra de centavos nos primeiros)
- [x] ✅ 🔍 Bloqueio de inadimplente (não reserva, não cria nem entra em partida nova)
- [ ] ⚠️ **Pagamento é PIX SIMULADO** — não há gateway real conectado (Iugu vs. Mercado Pago, decisão pendente)
- [ ] ⏳ 🔍 **Repasse direto à conta do clube** (regra nº 7) — não existe, depende do gateway real
- [ ] ⏳ 🔍 **Reembolso / estorno** — não existe
- [ ] ⏳ 🔍 **Política de cancelamento exibida na tela de pagamento da partida** — regra nº 7 cumprida pela metade: aparece na página do clube e na reserva, não no pagamento da partida
- [ ] ⏳ Cobrança automática de pendentes via WhatsApp (hoje é o botão manual "💬 Cobrar")

## Módulo 1.5 — Resultados, Rating e Categorias *(🔜 SPRINT 5 — ver escopo no topo)*

> ✅ A regra nº 5 foi **revisada e decidida em 01/08/2026** — este módulo está liberado. Conta a partida cheia de 4 (peso 1x) e cada set de sessão em grupo (peso 0,5x), com travas de validade, confirmação e origem. Texto completo da regra no CLAUDE.md.

- [x] ✅ 🔍 **Sessão em grupo**: reserva vira partida com participantes convidados e aceitos — `014` + `ConvidarParticipantes.tsx`. Testado com 4 contas e pelo fundador no celular
- [x] ✅ 🔍 **Registro de set por set**, com as travas de formato, janela de 24h, origem no app, teto de plausibilidade e liberação 15 min após o início (`016`)
- [x] ✅ 🔍 **Contestação com placar alternativo e votação do grupo** (mais de 50% dos elegíveis, com "Confirmar voto" em dois passos) — testado: 1 voto de 2 não resolve, 2 de 2 resolvem
- [x] ✅ 🔍 **Aviso dentro do app** — na Início e em Minhas partidas; um bloco por tipo, diz de qual jogo e de qual set, e some quando a pessoa **chega** no jogo (não ao tocar — marcar no toque apagava avisos que nunca chegaram a abrir). Testado pelo fundador no celular
- [x] ✅ 🔍 **Divisão do valor da quadra** (`018`, `019`): divisor sem vagas declaradas, mínimo 4, congelado no 1º pagamento. Nasceu de um bug real — divisor móvel fazia quem pagou R$65 aparecer com R$43,33
- [x] ✅ 🔍 **"Desistir"** — a vaga fica disponível sem a pessoa sair; ela só sai quando alguém assume, e o convite diz qual vaga preenche (`020`)
- [x] ✅ 🔍 **Remover participante** pelo organizador — quem já pagou não pode ser removido (`020`)
- [x] ✅ 🔍 **Web Push** (`031`) — service worker, inscrições por aparelho, envio idempotente e limpeza de inscrição morta. Testado em produção no iPhone, com um aviso real. Doc em `docs/interno/web-push.md`
- [x] ✅ 🔍 **PWA instalável** — manifesto, ícones e meta tags. **Não existia nada disso**; o "PWA primeiro" da stack era intenção, não código. ⚠️ Ícone e nome são **provisórios** e agora aparecem na tela de início do usuário, o que torna visíveis as pendências de marca e cor
- [x] ✅ 🔒 **Next.js 16.2.10 → 16.3.0** — fecha o *Middleware/Proxy bypass* (GHSA-6gpp-xcg3-4w24), que afetava justamente a proteção de `/app` e `/clube`. De 5 vulnerabilidades para zero. Verificado que, sem sessão, as rotas protegidas continuam caindo no login
- [x] ✅ 🔍 **Entrega B** (`034`–`036`): convite por telefone de quem ainda não tem conta. Só em sessão privada; o convite fica pendente até existir conta e, mesmo depois, a pessoa ainda precisa **aceitar**. Doc em `docs/interno/convite-por-telefone.md`
  - ⚠️ Três correções achadas testando: `revoke` de coluna sem revogar a tabela **não fecha nada** (o telefone do convidado ficou visível para o grupo); coluna nova em `jogadores` **nasce fechada** para o app; e o telefone tinha **dois formatos** que nunca bateriam (13 dígitos contra 11), o que deixaria o convite pendente para sempre sem erro nenhum
- [x] ✅ 🔍 **Sets em partida aberta** (`024`) — a área de sets vale para os dois tipos. Junto veio a trava que faltava: o substituto da fila tem `estado = 'aceito'` e, sem olhar o `papel`, registrava set, era escalado em set que não jogou, contestava e votava
- [x] ✅ 🔍 **Motor de rating Glicko-1** (`025`–`030`) — conta refeita do zero em blocos de um dia, força da dupla, placar mexendo na intensidade, calibração e proteção de queda por peso acumulado, número privado. Doc em `docs/interno/motor-de-rating.md`
- [x] ✅ 🔍 **Onboarding com janela de ±2 degraus** — as 4 perguntas de fato definem o degrau, a autoavaliação virou o ajuste. Antes a escolha era livre e o questionário não decidia nada
- [x] ✅ 🔍 **Tela do rating** — categoria + barra dentro da faixa (só para o dono) e a trilha do "quanto mudou e por quê", com placar e impacto de cada set
- [x] ✅ 🔍 **Recálculo agendado** (`037`, 17/08/2026) — roda sozinho de hora em hora via `pg_cron`, aos :07. Cada rodada fica registrada em `rating_execucoes`. **Comprovado disparando sozinho**, não só agendado
- [ ] ⏳ **Conversa das âncoras** — usar jogadores de nível conhecido nos clubes-piloto para calibrar a largura das faixas. Decide também a força do anti-farming
- [ ] ⏳ **Reputação de conduta** (paga? aparece? comportamento?) — **EIXO SEPARADO do rating de habilidade, nunca misturar** (decisão registrada no CLAUDE.md). Os dados que ela vai usar (quem registrou, contestou, votou o quê) **já estão sendo gravados** desde a Entrega A
- [ ] ⏳ 🔍 **Calibração por pares (validação por 2 jogadores)** — não existe, e **está em avaliação, não aprovada** (item 5 do motor no CLAUDE.md): a resposta do adversário tende a seguir o placar, que o motor já leu, então pode ser eco em vez de informação nova. Decidir depois do beta
- [ ] ⏳ **Peso de liga (1,5x) e torneio (2–3x)** — os pesos existem na tabela de parâmetros, mas **não há como marcar um jogo como de liga ou torneio**: falta o tipo de partida, que é Fase 2 (Módulos 2.1 e 2.2)

> ⚠️ **CORRIGIDO EM 17/08/2026 — este bloco listava sete itens como "não existe" que existem desde 08–12/08.** Auditado linha a linha contra o código:
> - *"Motor de rating Elo/Glicko não existe"* → **existe** (`025`–`030`, Glicko-1, tabelas `rating_*`)
> - *"Categorias 21 degraus não existe"* → **existe** (`categoria_do_degrau`, escala inteira no `025`)
> - *"Transparência: quanto mudou e por quê"* → **existe** (trilha em `/app/perfil/rating`, com placar e impacto por set)
> - *"Índice de confiabilidade"* → **existe por dentro** (o RD do Glicko); só não aparece na tela, o que é decisão reversível registrada
> - *"Proteção de rebaixamento (janela de 10 partidas)"* → **existe**, com desenho diferente do previsto: período de prova por peso acumulado (peso 5), não janela de 10 partidas
> - *"Pesos do rating"* → **existem** os de contexto, placar e calibração; só liga e torneio não têm de onde vir
> - *"O selo 'em calibração' não tem como sair"* → **sai sozinho** desde o `030` (`em_calibracao = peso < calibracao_alvo`)
>
> **Por que aconteceu:** o bloco antigo foi escrito na auditoria de 29/07, antes do motor existir, e os itens novos foram **acrescentados por cima** sem apagar os antigos. O documento passou a afirmar as duas coisas ao mesmo tempo. É exatamente o risco que a regra "não confiar no documento contra o código" existe para pegar.

## Módulo 1.6 — Social Básico *(ADIADO — não entra no Sprint 5)*
*Lugar canônico do chat e das notificações. Nenhum dos dois depende de fornecedor externo (Supabase Realtime já roda; Web Push é nativo do navegador) — só o fallback WhatsApp depende de BSP.*

- [x] ✅ 🔍 **Chat da partida** (`041` + `042`, 17/08/2026) — conversa por partida, nos dois tipos, em tempo real. **Quem conversa é mais estreito que quem VÊ:** entra quem está dentro do jogo (jogador aceito), e o substituto entra no instante em que for promovido, sem código a mais. Sem editar e sem apagar mensagem
  - **Aviso: UM por conversa, não um por mensagem** (decisão do fundador). Medido: 5 mensagens seguidas geraram **1 aviso** e **5 não lidas** — que é exatamente o desenho. Também não avisa quem leu nos últimos 2 minutos
  - **Privacidade testada com sessão real:** quem não está na partida lê **0 mensagens** e recebe **403** ao tentar escrever
  - 💡 **A VISUALIZAÇÃO da janela do chat ficou para rever** (fundador, 17/08/2026) — ver CLAUDE.md. Conversa com a análise de UX do app inteiro, e provavelmente deve ser resolvida lá
  - **O ciclo de leitura fecha nos DOIS marcadores** (a pergunta que o fundador fez antes de rodar): abrir a partida some com o aviso da Início E zera o selo de não lidas em Minhas partidas. São marcadores separados de propósito — um é "vi que tem mensagem", o outro é "li até aqui"
- [x] ✅ 🔍 **Notificações push** — **existem** (`031` + `033`). ⚠️ Esta linha dizia "não existem, nenhum service worker" até 17/08/2026, quando o push já estava em produção e testado no iPhone do fundador desde 12/08. Mesma causa do bloco corrigido no Módulo 1.5
- [ ] ⚠️ 🔍 **Fallback WhatsApp** — só manual: o organizador clica um botão e abre o WhatsApp com texto pronto. Nada dispara sozinho (sem BSP/Z-API ligado)
- [ ] ⏳ **Decidir o fallback para quem não instala o app no iPhone** — sem instalar na tela de início, o Safari não deixa nem pedir permissão de notificação. Aceitar a imperfeição ou antecipar o BSP, com o número real de alcance na mão, antes do beta

## Módulo 1.7 — Painel do Clube
- [x] ✅ 🔍 Agenda visual unificada multiesporte (Dia/Semana/Mês)
- [x] ✅ 🔍 Reserva manual de balcão no mesmo calendário
- [x] ✅ 🔍 Cancelamento de reserva pelo clube — `AgendaDia.tsx:178`
- [x] ✅ 🔍 **Bloqueio de horário pelo clube** (`039`) — manutenção, chuva, evento, com motivo. Aba "Bloquear" na agenda do dia; aparece em cinza com 🚧. **É uma reserva com `origem = 'bloqueio'`, não tabela nova**: um bloqueio ocupa a quadra igual a uma reserva, e em tabela separada seria preciso reimplementar a trava de sobreposição cruzando duas fontes — o jeito de o furo de overbooking voltar. **Fica fora do faturamento, da contagem de reservas e da quebra por origem**
- [x] ✅ 🔍 **Relatórios** (`/clube/relatorios`, `039`) — faturamento, número de reservas, ocupação, de onde vieram as reservas e horários que mais ficam vazios, em 7/30/90 dias. **A ocupação é calculada sobre as horas em que o clube ABRE** (derivadas das faixas de preço), não sobre 24h — senão todo clube pareceria ter 20% e o número não decidiria nada. Bloqueio sai dos dois lados da conta, e a tela mostra a conta aberta para o número não ser um palpite
- [x] ✅ 🔍 **Promover horário ocioso** (`039`) — aba "Avisar" na agenda. Vira `avisos` e o push sai sozinho pelo gatilho do `033`. Avisa jogadores da cidade do clube, **sem filtrar por categoria** (horário livre não tem nível, é oferta de quadra), pulando inadimplentes e contas anonimizadas. Recusa horário já ocupado e horário no passado. **Cooldown de 6h por clube** — o mesmo intervalo das cobranças de set, para o produto ter uma noção só de "não encher o saco"
  - **Testado de ponta a ponta:** clube avisou 4 jogadores → o aviso apareceu na Início de outra conta → levou à página do clube → sumiu ao chegar lá. A segunda tentativa devolveu `AGUARDE_6H`
  - ⚠️ Dois buracos achados e fechados no caminho: o aviso novo não tinha ícone nem destino na tela (cairia como "Aviso" sem link), e **nunca seria marcado como lido**, porque a marcação buscava só por partida e este aviso não tem partida — ficaria na tela para sempre
- [ ] ⏳ Evoluir a agenda: bloqueios recorrentes/mensalistas, arrastar para remarcar, filtro por esporte/quadra

## Módulo 1.8 — LGPD e Direitos do Titular *(regra nº 10 — NÃO INICIADO)*
*Regra inegociável do CLAUDE.md desde o dia 1. Estava ausente deste Checklist até 29/07/2026 — é justamente o tipo de coisa que o documento existe para não deixar passar.*

- [x] ✅ 🔍 **Exportação dos dados do jogador** (`038`) — `/app/perfil/privacidade` baixa um arquivo com perfil, reservas, partidas, sets, pagamentos e avaliações. A regra do que entra fica na função `meus_dados()`, no banco. **Não inclui contato de terceiros** nem partida da qual o titular não participou
- [x] ✅ 🔍 **Exclusão de conta** (`038`) — por **anonimização**, e não apagando. Conferido no esquema: quase toda tabela aponta para `auth.users` com `on delete cascade`, então apagar o login levaria junto os sets da pessoa e **reescreveria o rating de terceiros**. Some nome, foto, telefone, cidade, preferências, dados fiscais, avisos e inscrições de push — inclusive o telefone em `auth.users`, senão guardaríamos o dado de quem pediu para sair
  - **Dívida aberta bloqueia a exclusão** (`TEM_DIVIDA`). Sem isso havia a saída perfeita para o caloteiro: apagar, recadastrar com o mesmo número e voltar limpo
  - **Dono de clube é recusado** (`DONO_DE_CLUBE`): o clube ficaria órfão
  - ⚠️ **O que a trava NÃO resolve, e não tem conserto técnico:** abandonar a conta e criar outra com outro número. Nenhuma âncora funciona (telefone muda, CPF é opcional e não verificado, aparelho é trocável). Quem fecha isso é a POLÍTICA de pagamento — o pagar-ao-entrar em partida aberta, já registrado no CLAUDE.md
- [x] ✅ 🔍 **Consentimento** — o aceite é gravado **com a versão do texto** ao fim do cadastro, junto do botão que cria o perfil (aceitar numa tela isolada antes seria aceite no vazio). Gravado **depois** de o perfil existir, senão sobraria consentimento de quem nunca entrou
- [x] ✅ 🔍 **Página da política** (`/politica-privacidade`) — ⚠️ **texto PROVISÓRIO**, com aviso disso no topo para o usuário. Descreve com honestidade o que o app faz hoje e serve de rascunho para o advogado
- [ ] ⏳ **Texto jurídico definitivo da política** — depende da marca decidida e de revisão jurídica. Ao publicar, trocar `VERSAO_POLITICA` de `rascunho-1` para `1.0`: é isso que faz o app pedir o aceite de novo a quem só viu o rascunho
- [x] ✅ 🔍 **Tela dos dados fiscais** (`/app/perfil/dados-fiscais`) — nome completo, CPF, e-mail e endereço, com máscara. Entra e sai **por função**; leitura direta da coluna dá 403, testado com sessão real
- [x] ✅ 🔍 **Registro financeiro do clube sobrevive à exclusão** (`038`) — o pagamento tira uma **fotografia** de quem pagou (nome, telefone, CPF, e-mail) no instante do pagamento, e a reserva pelo app passa a gravar nome e telefone como já fazia a de balcão. A costura entre fotografias é o código da conta, que nunca muda. Extrato por `pagamentos_do_clube()`, só para o dono
- [x] ✅ 🔍 **Campos fiscais no perfil** (`038`) — nome completo, CPF, e-mail e endereço, **todos opcionais** até a emissão de nota ser ligada. Ficam **fechados por permissão** e voltam por função: a tabela `jogadores` é legível por qualquer pessoa logada, então um `grant` deixaria o CPF de todos visível para todos. Falta a tela de preenchimento
- [x] ✅ 🔍 Privacidade por design (RLS em todas as tabelas, telefone fechado por column privileges, `agenda_publica` sem dado pessoal, evento de métrica sem nome/telefone) — existe e está bem-feito, **mas é OUTRA coisa**: protege dado de terceiro, não dá direito ao titular
- [ ] ⏳ Política de privacidade LGPD (texto) — depende da marca decidida

## Módulo 1.9 — Beta Fechado e Lojas *(último bloco do MVP — NÃO INICIADO)*

> 🔒 **PRÉ-CONDIÇÕES OBRIGATÓRIAS DO BETA** (nada disso é opcional):
> - **Módulo 1.8 (LGPD) completo** — consentimento, exportação e exclusão funcionando
> - **Revisão externa de segurança** antes de ligar pagamentos reais
> - **Fase B da autenticação** (Twilio real), com prazo próprio: 31/10/2026
> - **Limpar os dados de teste do banco**

- [ ] ⏳ Beta fechado nos clubes-piloto
- [ ] ⏳ Testes em internet fraca
- [ ] ⏳ Revisão de textos do produto
- [ ] ⏳ Migração PWA → Flutter para as lojas (builds via Codemagic, nunca Android Studio local)
- [ ] ⏳ Submissão App Store / Google Play — inclui contas de desenvolvedor (só o fundador faz)

## Navegação e Experiência Geral
- [x] ✅ 🔍 Barra de navegação fixa — ver o bloco do Sprint 5 no topo
- [x] ✅ 🔍 **Tela de Início como resumo** (01/08/2026): deixou de ser menu de links e passou a mostrar categoria, pendência de pagamento, atalhos "Jogar agora" e "Reservar", e a lista de próximos jogos
- [x] ✅ 🔍 **Lista única de próximos jogos** juntando reservas e partidas — **união só visual**, nada muda no banco. Não presume a decisão de partida privada; se ela acontecer, a tela já está no formato certo
- [x] ✅ 🔍 **Botão de troca de modo jogador ↔ clube** (17/08/2026) — no Perfil (para o painel) e no painel (para o app). Só aparece para quem TEM clube; para os demais seria porta para lugar nenhum. Pendência aberta desde o Sprint 3

## Perfil e Estatísticas do Jogador
- [x] ✅ 🔍 **Tela de perfil mínima** (`/app/perfil`, 01/08/2026): nome, foto, cidade, categoria, selo de calibração, atalhos e o botão Sair (que saiu da tela inicial)
- [x] ✅ 🔍 **Editar perfil** (`/app/perfil/editar`, 17/08/2026) — nome, foto, cidade, lado que joga, disponibilidade e raio. ⚠️ **Até esta data NÃO EXISTIA edição nenhuma:** o jogador preenchia tudo no cadastro e não podia mudar nem o nome. O buraco passou por duas auditorias sem ser visto e só apareceu quando o fundador perguntou como alguém trocaria de telefone. **A categoria não é editável de propósito** — ela vem do motor de rating; se fosse escolha, o matchmaking passaria a valer o que cada um digita
- [x] ✅ 🔍 **Trocar telefone** (`/app/perfil/telefone`) — com confirmação por código no número NOVO, senão bastaria digitar o número de outra pessoa. O telefone vive em dois lugares (login e perfil) e os dois mudam juntos
  - **Passo de revisão antes de enviar o código**, com o número em destaque: o erro comum aqui não é má-fé, é dígito trocado — e dígito trocado manda o código para o celular de um estranho
  - **Convites pendentes migram sozinhos**: depois da troca, o app roda a mesma vinculação do fim do cadastro, então convite mandado para o número novo (antes de ele ser seu) aparece na hora
  - **Número já ligado a outra conta é recusado** — o telefone é único no login, então a troca não aconteceria nem com o código certo
- [ ] ⏳ 🔍 Histórico, estatísticas e conquistas — não existem. **De propósito:** dependem do rating, que depende da regra nº 5. Não colocar placeholder na tela de perfil antes dessa decisão

---

## Pendências transversais (não são funcionalidades novas, mas bloqueiam produção real)
- [ ] Decidir fornecedor do gateway de pagamento (Iugu vs. Mercado Pago) e sair do PIX simulado
- [ ] Conectar um BSP/Z-API de verdade para WhatsApp automático (afeta os Módulos 1.3 e 1.4 ao mesmo tempo)
- [ ] Fase B da autenticação (Twilio real) — prazo 31/10/2026
- [ ] Decidir variante de cor (verde vs. azul) e nome da marca (FaltaUm vs. Fechou)
- [ ] Política de privacidade LGPD (após marca decidida)
- [ ] Revisão externa de segurança antes de pagamentos reais
- [ ] ⚠️ **Limpar os dados de teste do banco antes do lançamento** (jogadores Bruno/Diego/Eduardo, clubes de teste). Atenção: o script `seed_dados_teste.sql` **APAGA TODAS as reservas** — só rodar em ambiente de teste
- [ ] Substituir o rodapé `[DEFINIR]` pelo WhatsApp de suporte nos 13 artigos de cliente
- [ ] Elaborar perguntas de calibração melhores (as atuais são provisórias)
- [ ] Definir o escopo do Premium do jogador (candidata já identificada: busca de quadra por cidade + data futura, hoje liberada para todos)

---

## Critério de "MVP pronto" (do Plano de Execução) — status geral
> Jogador descobre clube → entra/cria partida → reserva e paga dividido → registra resultado → vê categoria evoluir; clube opera 100% da agenda sem caderno.

- [x] Descobre clube ✅
- [x] Entra/cria partida ✅
- [x] Reserva e paga dividido ✅ (com pagamento simulado)
- [x] Registra resultado ✅ (set a set, com contestação e votação — Entrega A)
- [x] Vê categoria evoluir ✅ (motor Glicko-1 + trilha do "quanto mudou e por quê", rodando sozinho desde o `037`)
- [x] Clube opera agenda sem caderno ✅ (relatórios e bloqueio de horário ainda faltam)

**Os cinco passos do critério de MVP estão fechados** (atualizado em 17/08/2026 — os dois últimos ainda apareciam como pendentes). Mas **isso não significa MVP pronto para o mundo**, e a diferença importa:

| O que fecha | O que ainda falta para valer |
|---|---|
| O trilho de competição funciona ponta a ponta | O dinheiro é **simulado** — sem gateway real não há produto |
| Descoberta e organização funcionam | **LGPD (1.8) não existe** e trava o lançamento |
| O clube opera a agenda | Falta a **Fase B da autenticação** (prazo 31/10/2026) |

O "trilho de comunicação" (chat) segue conscientemente adiado — não está no critério. As **notificações**, que estavam nesse mesmo trilho, acabaram sendo feitas antes, porque a Decisão 1 do rating passou a depender delas: "silêncio vale como concordância" só é justo se a pessoa tiver chance real de saber.

---

# FASE 2 — Competição e Gestão (meses 5–10)
*Nenhum item desta fase foi iniciado — o MVP (Fase 1) ainda não fechou. Listados aqui para não perder o escopo de vista, não como trabalho próximo.*

## Módulo 2.1 — Torneios
- [ ] ⏳ Criação de torneio (categorias, formato: grupos+mata-mata / americano / king of the court)
- [ ] ⏳ Inscrição e pagamento pelo app
- [ ] ⏳ Chaveamento automático + agenda de jogos por quadra
- [ ] ⏳ Placar ao vivo + notificação "seu jogo é em 30 min"
- [ ] ⏳ Pontuação de torneio integrada ao rating e ranking de temporada

## Módulo 2.2 — Ligas e Rachões Recorrentes
- [ ] ⏳ Criar grupo recorrente (ex.: racha de quarta) com ranking próprio
- [ ] ⏳ Sorteio de duplas balanceado por rating
- [ ] ⏳ Presença confirmada por rodada + fila de espera

## Módulo 2.3 — Gamificação Completa
- [ ] ⏳ Temporadas trimestrais com promoção/rebaixamento cerimonial
- [ ] ⏳ Rankings por clube, cidade e categoria
- [ ] ⏳ XP, conquistas, sequências (streaks), desafios semanais
- [ ] ⏳ Cartaz de conquista compartilhável (Instagram/WhatsApp)
- [ ] ⏳ MVP da partida votado pelos 4 jogadores

## Módulo 2.4 — Premium do Jogador
- [ ] ⏳ Estatísticas avançadas (evolução, desempenho por parceiro/adversário/clube/horário, head-to-head)
- [ ] ⏳ Badge premium + prioridade na fila de substitutos
- [ ] ⏳ Paywall e gestão de assinatura (R$ 19–29/mês)

## Módulo 2.5 — Gestão Avançada do Clube
*Estrategicamente importante: é onde o Gripo tem vantagem hoje. Caprichar na experiência.*
- [ ] ⏳ Comanda digital de bar/loja com PIX/QR
- [ ] ⏳ Mensalistas com cobrança recorrente automática
- [ ] ⏳ CRM básico (aniversariantes, inativos há 30 dias, cupons)
- [ ] ⏳ Precificação dinâmica assistida
- [ ] ⏳ Integração para emissão de nota fiscal

## Módulo 2.6 — Aulas e Professores (v1)
- [ ] ⏳ Perfil de professor (valores, horários, clubes)
- [ ] ⏳ Agendamento de aula experimental e pacotes
- [ ] ⏳ Avaliação de professores

---

# FASE 3 — Ecossistema (meses 11–18)
*Fase distante, sujeita a reordenação conforme o aprendizado das Fases 1 e 2. Listada aqui só para preservar o escopo completo do Plano de Execução — não é compromisso de ordem ou prazo.*

> **Antes de construir qualquer coisa desta fase:** revisar com dados reais do produto (retenção, receita, pedidos de clubes e jogadores) qual item faz mais sentido priorizar. Decidir a ordem primeiro, construir depois.

- [ ] ⏳ Vertical completa de professores (turmas, evolução do aluno ligada ao rating, pacotes)
- [ ] ⏳ Expansão do lado do jogador para beach tennis (categorias e comunidade próprias)
- [ ] ⏳ Circuitos regionais e ranking estadual
- [ ] ⏳ Marketplace de equipamentos (comissão) e parcerias com marcas
- [ ] ⏳ Vídeo: integração com câmeras de quadra, clipes compartilháveis
- [ ] ⏳ IA: sugestão de parceiro ideal, previsão de resultado, previsão de demanda para o clube
- [ ] ⏳ Multiesporte adicional (tênis, pickleball) reaproveitando o motor de matchmaking
- [ ] ⏳ Expansão geográfica (SC/PR/SP → Argentina/Uruguai)

---

*Instruções de manutenção: sempre que um sprint terminar, volte aqui e marque os itens correspondentes. Prefira marcar 🔍 (auditado) em vez de 📄 (relatado) sempre que possível — é a diferença entre confiar e verificar.*
