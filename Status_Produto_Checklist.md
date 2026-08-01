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

- **Chat e notificações pedem a BARRA DE NAVEGAÇÃO FIXA antes** — hoje não há onde eles morarem
- **Rating (Módulo 1.5) depende do registro de resultado**, que não existe — os dois andam juntos
- **Repasse ao clube e reembolso dependem do gateway real** (fornecedor não decidido)
- **WhatsApp automático destrava DOIS módulos ao mesmo tempo** (1.3 e 1.4) — depende de contratar um BSP
- **Chat e push NÃO dependem de fornecedor nenhum** — Supabase Realtime já roda no projeto (3 canais) e Web Push é nativo do navegador. Só o *fallback* WhatsApp precisa de BSP
- **LGPD (Módulo 1.8) não depende de nada** — pode ser feito a qualquer momento, e trava o lançamento

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
- [ ] ⏳ Todos os itens do **Módulo 1.5** abaixo

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
- [ ] ⏳ **Editar partida aberta** — só o organizador; com jogadores dentro, vira solicitação aprovada por TODOS. ✅ Aprovada no CLAUDE.md
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

- [ ] ⏳ **Sessão em grupo**: reserva com participantes convidados e aceitos (entrou no escopo pela Decisão 1)
- [ ] ⏳ Registro de set por set, com as três travas (formato completo, confirmação anti-invenção, origem no app)
- [ ] ⏳ Aviso dentro do app para cobrar quem não confirmou (cooldown de 6h por pendência)
- [ ] ⏳ 🔍 Registro de placar por sets — não existe
- [ ] ⏳ 🔍 Confirmação do resultado por 1 jogador da dupla adversária — não existe
- [ ] ⏳ 🔍 Motor de rating Elo/Glicko para duplas — não existe. A palavra "rating" só aparece em texto de tela ("Competitiva — vale rating"), sem cálculo por trás
- [ ] ⏳ Pesos do rating: nível dos adversários, tipo de jogo (amistoso 1x / liga 1,5x / torneio 2–3x), placar (regra nº 4)
- [ ] ⏳ **Índice de confiabilidade** do rating (regra nº 4)
- [ ] ⏳ **Transparência: mostrar quanto o rating mudou e por quê** após cada jogo (regra nº 4)
- [ ] ⏳ 🔍 Categorias 7 × Forte/Médio/Fraco (21 degraus) — não existe
- [ ] ⏳ Proteção de rebaixamento (janela de 10 partidas)
- [ ] ⏳ 🔍 Calibração por pares (validação por 2 jogadores) — não existe. Só o questionário do Sprint 1 (`calibracao_respostas`) e o selo (`em_calibracao`); a validação aparece apenas como comentário em `calibracao.ts:4`
- [ ] ⏳ 🔍 **Saída do selo "em calibração"** — hoje o selo NÃO TEM COMO SAIR: não há validação por pares nem contagem das 5 primeiras partidas. Todo jogador fica marcado para sempre
- [ ] ⏳ **Reputação de conduta** (paga? aparece? comportamento?) — **EIXO SEPARADO do rating de habilidade, nunca misturar** (decisão registrada no CLAUDE.md)

## Módulo 1.6 — Social Básico *(ADIADO — não entra no Sprint 5)*
*Lugar canônico do chat e das notificações. Nenhum dos dois depende de fornecedor externo (Supabase Realtime já roda; Web Push é nativo do navegador) — só o fallback WhatsApp depende de BSP.*

- [ ] ⏳ 🔍 **Chat automático da partida** (grupo dos participantes) — não existe. Nenhuma tabela de mensagens, nenhum componente
- [ ] ⏳ 🔍 **Notificações push** — não existem. Nenhum service worker, nenhuma inscrição de push
- [ ] ⚠️ 🔍 **Fallback WhatsApp** — só manual: o organizador clica um botão e abre o WhatsApp com texto pronto. Nada dispara sozinho (sem BSP/Z-API ligado)

## Módulo 1.7 — Painel do Clube
- [x] ✅ 🔍 Agenda visual unificada multiesporte (Dia/Semana/Mês)
- [x] ✅ 🔍 Reserva manual de balcão no mesmo calendário
- [x] ✅ 🔍 Cancelamento de reserva pelo clube — `AgendaDia.tsx:178`
- [ ] ⏳ 🔍 **Bloqueio de horário pelo clube** (manutenção, chuva, evento) — **não existe**. Hoje o único jeito é criar uma reserva de balcão falsa
- [ ] ⏳ 🔍 **Relatórios (ocupação, faturamento, origem das reservas, horários ociosos)** — não existe. Só o mapa de calor da agenda, que mostra ocupação visualmente mas não é relatório de números
- [ ] ⏳ 🔍 **Botão "promover horário ocioso" que notifica jogadores compatíveis** — não existe. "Ocioso" só aparece como texto de ajuda no mapa de calor
- [ ] ⏳ Evoluir a agenda: bloqueios recorrentes/mensalistas, arrastar para remarcar, filtro por esporte/quadra

## Módulo 1.8 — LGPD e Direitos do Titular *(regra nº 10 — NÃO INICIADO)*
*Regra inegociável do CLAUDE.md desde o dia 1. Estava ausente deste Checklist até 29/07/2026 — é justamente o tipo de coisa que o documento existe para não deixar passar.*

- [ ] ⏳ 🔍 **Tela de consentimento** — não existe
- [ ] ⏳ 🔍 **Exportação dos dados do jogador** — não existe
- [ ] ⏳ 🔍 **Exclusão de conta e dados** — não existe
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
- [ ] ⏳ Botão de troca de modo jogador ↔ painel do clube (para donos e funcionários)

## Perfil e Estatísticas do Jogador
- [x] ✅ 🔍 **Tela de perfil mínima** (`/app/perfil`, 01/08/2026): nome, foto, cidade, categoria, selo de calibração, atalhos e o botão Sair (que saiu da tela inicial)
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
- [ ] Registra resultado ⏳ ← **Sprint 5**
- [ ] Vê categoria evoluir ⏳ ← **Sprint 5**
- [x] Clube opera agenda sem caderno ✅ (relatórios e bloqueio de horário ainda faltam)

**Resumindo:** o "trilho de descoberta e organização" do MVP está pronto. O "trilho de competição" (resultado/rating/categoria) é o Sprint 5 e fecha o critério acima. O "trilho de comunicação" (chat/notificação) foi conscientemente adiado — não está no critério de pronto.

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
