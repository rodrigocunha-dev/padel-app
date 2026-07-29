# STATUS DO PRODUTO — Checklist de Funcionalidades (Fases 1, 2 e 3)
### Única fonte de verdade sobre o que está CONSTRUÍDO vs. PLANEJADO
*O CLAUDE.md descreve COMO cada coisa deve funcionar (regras de negócio) e CONTA a história (sprint a sprint, em prosa). Este documento responde a uma pergunta diferente e específica: **de tudo que o produto precisa, em todas as fases, o que já existe de verdade no código?** Atualizar sempre que um item mudar de status — idealmente confirmando contra o código, não de memória.*

**Legenda:**
- ✅ **Pronto e testado no celular pelo fundador**
- 🔧 **Código existe, mas parcial ou não testado no celular ainda**
- ⏳ **Planejado, não iniciado**
- ⚠️ **Existe uma versão manual/provisória, não a versão final**

**Origem da informação em cada linha:**
- 🔍 = confirmado por auditoria direta no código (27/07/2026, a pedido do fundador)
- 📄 = baseado no CLAUDE.md / relatos de sprint, ainda não re-auditado — **confirmar com o Claude Code antes de confiar 100%**

---

---

# FASE 1 — MVP (meses 1–4)

## Módulo 1.1 — Contas e Onboarding *(Sprint 1)*
- [x] ✅ 📄 Login por telefone/OTP (fase A, número de teste)
- [x] ✅ 📄 Onboarding do jogador (nome, foto, cidade, posição, disponibilidade, raio)
- [x] ✅ 📄 Calibração inicial (questionário + selo "em calibração")
- [x] ✅ 📄 Cadastro de clube com quadras multiesporte
- [x] ✅ 📄 Preços por faixa horária, trava contra sobreposição
- [ ] ⏳ Fase B da autenticação (Twilio real) — pendência com prazo (antes de 31/10/2026)

## Módulo 1.2 — Descoberta e Mapa *(Sprint 2)*
- [x] ✅ 📄 Mapa com clubes geolocalizados (Leaflet + OpenStreetMap)
- [x] ✅ 📄 Filtros: esporte, tipo de quadra, coberta, preço, cidade, distância
- [x] ✅ 📄 "Jogar agora" (livre nas próximas 3h)
- [x] ✅ 📄 Busca por data futura
- [x] ✅ 📄 Página do clube (fotos, descrição, avaliações, política)
- [x] ✅ 📄 Painel do clube v0 (edição de informações, localização)

## Módulo 1.3 — Partidas Abertas *(Sprint 4)*
- [x] ✅ 🔍 Criar partida (categoria, competitivo/amistoso, sexo, 4–8 jogadores com revezamento) — `CriarPartida.tsx`, 408 linhas
- [x] ✅ 🔍 Feed de partidas compatíveis por nível e sexo
- [ ] ⏳ 🔍 **Filtro por região no feed** — hoje mostra partidas de todas as cidades (bug confirmado: busca a cidade do jogador mas não usa). Status: 🔍 Em avaliação no CLAUDE.md (pesquisar referências antes de implementar)
- [x] ✅ 🔍 Entrar na partida com 1 toque
- [x] ✅ 🔍 Fila de substitutos automática — testada com 5 contas, `008_partidas.sql:328`
- [ ] ⏳ 🔍 **Chat automático da partida** — não existe. Nenhuma tabela de mensagens, nenhum componente.
- [ ] ⏳ 🔍 **Notificações push** — não existem. Nenhum service worker, nenhuma inscrição de push.
- [ ] ⚠️ 🔍 **Fallback WhatsApp** — só manual: organizador clica um botão e abre o WhatsApp com texto pronto. Nada dispara sozinho (sem BSP/Z-API ligado ainda).

## Módulo 1.4 — Reservas e Pagamentos *(Sprints 3 e 4)*
- [x] ✅ 📄 Agenda em tempo real, zero overbooking (exclusion constraint)
- [x] ✅ 📄 Reserva pelo app em 3 toques
- [x] ✅ 📄 Reserva editável / remarcar (move a mesma reserva)
- [x] ✅ 📄 Cancelamento respeitando a política do clube (bloqueio no servidor)
- [x] ✅ 📄 Divisão de pagamento entre jogadores (split)
- [x] ✅ 📄 Bloqueio de inadimplente (não reserva, não entra em partida nova)
- [ ] ⚠️ **Pagamento é PIX SIMULADO** — não há gateway real conectado ainda (Iugu vs. Mercado Pago, decisão pendente)
- [ ] ⏳ Cobrança automática de pendentes via WhatsApp (hoje é o botão manual "💬 Cobrar", mesma limitação do item de fallback acima)

## Módulo 1.5 — Resultados, Rating e Categorias *(ainda não iniciado)*
- [ ] ⏳ 🔍 Registro de placar por sets — não existe
- [ ] ⏳ 🔍 Confirmação do resultado pela dupla adversária — não existe
- [ ] ⏳ 🔍 Motor de rating Elo/Glicko — não existe. A palavra "rating" só aparece em texto de tela ("Competitiva — vale rating"), sem cálculo por trás
- [ ] ⏳ 🔍 Categorias 7 × Forte/Médio/Fraco — não existe
- [ ] ⏳ Proteção de rebaixamento (janela de 10 partidas) — não existe
- [ ] ⏳ Calibração por pares (validação por 2 jogadores) — verificar se ficou só o questionário do Sprint 1 ou se isso também falta

## Módulo 1.6 — Social Básico
- [ ] ⏳ Chat da partida — *(mesmo item do Módulo 1.3 acima — não existe)*
- [ ] ⏳ Notificações push com fallback WhatsApp de verdade — *(mesmo item acima — não existe / é manual)*

## Módulo 1.7 — Painel do Clube
- [x] ✅ 📄 Agenda visual unificada multiesporte (Dia/Semana/Mês)
- [x] ✅ 📄 Reserva manual de balcão no mesmo calendário
- [x] ✅ 📄 Bloqueios e cancelamento pelo clube
- [ ] ⏳ 🔍 **Relatórios (ocupação, faturamento, origem das reservas, horários ociosos)** — não existe. Só o mapa de calor da agenda (Sprint 2), que mostra ocupação visualmente mas não é um relatório de números
- [ ] ⏳ Botão "promover horário ocioso" — verificar se existe (não estava na lista auditada, checar com Claude Code)

## Perfil e Estatísticas do Jogador
- [ ] ⏳ 🔍 Perfil completo, estatísticas, conquistas — não existe ("Nada", confirmado na auditoria)

---

## Pendências transversais (não são funcionalidades novas, mas bloqueiam produção real)
- [ ] Decidir fornecedor do gateway de pagamento (Iugu vs. Mercado Pago) e sair do PIX simulado
- [ ] Conectar um BSP/Z-API de verdade para WhatsApp automático (afeta Partidas e Pagamentos ao mesmo tempo — ver módulos 1.3 e 1.4 acima)
- [ ] Fase B da autenticação (Twilio real) — prazo 31/10/2026
- [ ] Decidir variante de cor e nome da marca
- [ ] Política de privacidade LGPD (após marca decidida)
- [ ] Revisão externa de segurança antes de pagamentos reais

---

## Critério de "MVP pronto" (do Plano de Execução) — status geral
> Jogador descobre clube → entra/cria partida → reserva e paga dividido → registra resultado → vê categoria evoluir; clube opera 100% da agenda sem caderno.

- [x] Descobre clube ✅
- [x] Entra/cria partida ✅
- [x] Reserva e paga dividido ✅ (com pagamento simulado)
- [ ] Registra resultado ⏳
- [ ] Vê categoria evoluir ⏳
- [x] Clube opera agenda sem caderno ✅ (relatórios ainda faltam)

**Resumindo:** o "trilho de descoberta e organização" do MVP está pronto. O "trilho de comunicação" (chat/notificação) e o "trilho de competição" (resultado/rating/categoria) ainda não foram iniciados — são o grosso do que falta para fechar o ciclo completo.

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
