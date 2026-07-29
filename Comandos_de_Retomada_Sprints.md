# COMANDOS DE RETOMADA — Sprint a Sprint, Módulo a Módulo
### Cole no Claude Code no início de cada sessão para retomar exatamente de onde parou
*Cada comando pede que o Claude releia o CLAUDE.md antes de agir e proponha um plano antes de executar — é o hábito que mantém o controle nas suas mãos.*

---

## Como usar este documento
1. Confira no seu CLAUDE.md (seção "Sprint atual") qual é o próximo sprint pendente.
2. Copie o comando correspondente abaixo, cole no Claude Code e ajuste o que estiver entre [colchetes] se precisar.
3. Ao final da sessão, sempre peça: *"Atualize o CLAUDE.md com o que foi feito, o que ficou pendente e marque o próximo sprint."*
4. Sprints são um guia, não uma prisão — se uma sessão não terminar um sprint inteiro, sem problema: retome no mesmo comando na próxima vez.

---

# FASE 1 — MVP (meses 1–4)

## Sprint 1 — Módulo 1.1: Contas e Onboarding
> Estamos avançando do Sprint 0 para o Sprint 1. Releia o CLAUDE.md. Sprint 0 (landing + lista de espera) está concluído e publicado. Agora quero começar o Módulo 1.1 do Plano de Execução: infraestrutura de autenticação (login por WhatsApp/OTP), cadastro de jogador (nome, foto, cidade, telefone, categoria 1ª–7ª, posição, disponibilidade, raio de deslocamento) e cadastro de clube com quadras multiesporte (esporte, tipo vidro/alvenaria/areia/saibro/grama, coberta ou não, preço por faixa horária). Inclua também o fluxo de calibração inicial (questionário curto + selo "em calibração"). Me proponha o plano antes de começar.

## Sprint 2 — Módulo 1.2: Descoberta e Mapa + Painel do Clube v0
> Estamos no Sprint 2. Releia o CLAUDE.md. O Sprint 1 (contas, onboarding, cadastros) está concluído. Agora quero o Módulo 1.2: mapa com clubes geolocalizados e preço no pin, filtros (esporte, tipo de quadra, coberta, distância, preço), modo "Jogar agora" (livres nas próximas 3h) e página do clube com fotos/avaliações. Junto, comece o Painel do Clube v0 (Módulo 1.7 parcial): agenda visível e reserva manual pelo dono do clube. Me proponha o plano antes de começar.

## Sprint 3 — Módulo 1.4 (parte 1): Agenda em Tempo Real
> Estamos no Sprint 3. Releia o CLAUDE.md. Mapa, descoberta e painel v0 estão prontos. Agora quero a agenda de quadras em tempo real com trava de concorrência (impossível dar overbooking), reserva pelo app em até 3 toques, e reserva editável dentro da política de cada clube. Me proponha o plano antes de começar.

## Sprint 4 — Módulo 1.4 (parte 2): Pagamentos
> Estamos no Sprint 4. Releia o CLAUDE.md. A agenda em tempo real está funcionando. Agora quero integrar o gateway de pagamento (Asaas ou Pagar.me) com split de PIX: pagamento em valor cheio ou dividido automaticamente entre os jogadores da partida (lembrando: 4 a 8 jogadores, conforme o CLAUDE.md), cobrança dos pendentes via WhatsApp, repasse direto à conta do clube, e políticas de cancelamento/reembolso exibidas antes do pagamento. Me proponha o plano antes de começar — inclusive sobre o processo de homologação do gateway, que pode levar alguns dias.

## Sprint 5 — Módulo 1.3 + 1.6: Partidas Abertas, Chat e Notificações
> Estamos no Sprint 5. Releia o CLAUDE.md. Reserva e pagamento por PIX split já funcionam. Agora quero as partidas abertas: criar partida (clube, quadra, data/hora, faixa de categoria, competitivo/amistoso, sexo do jogo masculino/feminino/mista, número de jogadores de 4 a 8 com modo revezamento acima de 4), feed de partidas compatíveis por nível/sexo/região, entrar com 1 toque. Junto, o chat automático da partida (grupo dos participantes) e notificações push com fallback para WhatsApp. Me proponha o plano antes de começar.

## Sprint 6 — Módulo 1.3 (fila) + 1.5: Substitutos, Resultados, Rating e Categorias
> Estamos no Sprint 6. Releia o CLAUDE.md. Partidas abertas, chat e notificações estão prontos. Agora quero: a fila de substitutos automática (quando alguém sai da partida, notifica jogadores compatíveis em cascata); o registro de resultado por sets com confirmação de 1 jogador da dupla adversária; o motor de rating tipo Elo/Glicko para duplas com os pesos definidos no CLAUDE.md (nível do adversário, tipo de jogo, placar); a transparência de "quanto mudou e por quê"; o mapeamento para as 7 categorias × Forte/Médio/Fraco; e a proteção de rebaixamento por janela de 10 partidas. Lembrete importante: só partidas de 4 jogadores em modo competitivo devem afetar o rating. Me proponha o plano antes de começar — esta é a parte mais delicada do produto, quero entender a lógica antes de aprovar.

## Sprint 7 — Módulo 1.5/1.6 (perfil) + 1.7 (relatórios): Perfil, Estatísticas e Relatórios do Clube
> Estamos no Sprint 7. Releia o CLAUDE.md. O motor de rating e categorias está funcionando. Agora quero completar o perfil do jogador (histórico, estatísticas básicas, conquistas iniciais) e os relatórios do painel do clube (ocupação, faturamento, origem das reservas, horários ociosos) com o botão de "promover horário ocioso" que notifica jogadores compatíveis. Me proponha o plano antes de começar.

## Sprint 8 — Beta Fechado e Preparação para as Lojas
> Estamos no Sprint 8, o último do MVP. Releia o CLAUDE.md. Todos os módulos da Fase 1 estão implementados. Agora quero: revisar o "Critério de MVP pronto" do CLAUDE.md item por item e apontar o que falta; preparar o app para o beta fechado nos clubes-piloto (testes em internet fraca, textos revisados, eventos de análise no PostHog); e me orientar nos passos para submeter às lojas (App Store e Google Play) — incluindo o que só eu posso fazer (contas de desenvolvedor). Antes de qualquer coisa, me lembre: preciso agendar a revisão externa de segurança/LGPD antes de ligar pagamentos reais para usuários de verdade. Me proponha o plano antes de começar.

---

# FASE 2 — Competição e Gestão (meses 5–10)
*Use estes comandos só depois do MVP validado no beta. Antes de iniciar a Fase 2, vale revisar com o fundador se a ordem dos módulos abaixo ainda faz sentido à luz do que os clubes e jogadores pedirem no beta.*

## Módulo 2.1: Torneios
> Estamos iniciando a Fase 2. Releia o CLAUDE.md e o Plano de Execução. O MVP está em produção e validado no beta. Agora quero o Módulo 2.1: criação de torneio pelo clube/organizador (categorias, formato grupos+mata-mata/americano/king of the court, datas, valor de inscrição), inscrição e pagamento pelo app, chaveamento automático com agenda por quadra, placar ao vivo e notificações de "seu jogo é em 30 min", com pontuação integrada ao rating e ao ranking de temporada. Me proponha o plano antes de começar.

## Módulo 2.2: Ligas e Rachões Recorrentes
> Releia o CLAUDE.md. Quero o Módulo 2.2: criação de grupo recorrente (ex.: racha de quarta) com ranking interno próprio, sorteio de duplas balanceado por rating, e presença confirmada por rodada com fila de espera. Me proponha o plano antes de começar.

## Módulo 2.3: Gamificação Completa
> Releia o CLAUDE.md. Quero o Módulo 2.3: temporadas trimestrais com promoção/rebaixamento cerimonial, rankings por clube/cidade/categoria, sistema de XP e conquistas, sequências (streaks), desafios semanais, cartaz compartilhável de conquista para Instagram/WhatsApp, e MVP da partida votado pelos 4 jogadores. Me proponha o plano antes de começar.

## Módulo 2.4: Premium do Jogador
> Releia o CLAUDE.md. Quero o Módulo 2.4: estatísticas avançadas (evolução do rating, desempenho por parceiro/adversário/clube/horário, head-to-head), badge premium, prioridade na fila de substitutos, e o paywall com gestão de assinatura mensal/anual (R$ 19–29/mês conforme o plano). Me proponha o plano antes de começar, incluindo as opções de processador de assinatura recorrente.

## Módulo 2.5: Gestão Avançada do Clube
> Releia o CLAUDE.md. Quero o Módulo 2.5: comanda digital de bar/loja com pagamento por QR/PIX, mensalistas com cobrança recorrente automática, CRM básico (aniversariantes, inativos há 30 dias, cupons), precificação dinâmica assistida para horários ociosos, e integração para emissão de nota fiscal. Lembrete do CLAUDE.md: este módulo é estrategicamente importante (é onde o Gripo tem vantagem hoje), então capriche na experiência. Me proponha o plano antes de começar.

## Módulo 2.6: Aulas e Professores (v1)
> Releia o CLAUDE.md. Quero o Módulo 2.6: perfil de professor (valores, horários, clubes onde atende), agendamento de aula experimental e pacotes, e avaliação de professores. Me proponha o plano antes de começar.

---

# FASE 3 — Ecossistema (meses 11–18)
*Fase distante e mais sujeita a mudança de prioridade conforme o aprendizado das Fases 1 e 2. Um único comando de abertura — o detalhamento por módulo deve ser revisado junto com o fundador quando chegar a hora.*

## Abertura da Fase 3
> Estamos iniciando a Fase 3. Releia o CLAUDE.md e o Plano de Execução, seção Fase 3. Antes de escolher o que construir primeiro, me ajude a revisar com dados reais do produto (retenção, receita, pedidos de clubes e jogadores) qual destes faz mais sentido priorizar agora: vertical de professores, expansão para beach tennis no lado do jogador, marketplace de equipamentos, vídeo/replay das quadras, funcionalidades de IA (sugestão de parceiro, previsão de demanda), ou expansão geográfica. Não comece a construir ainda — quero decidir a ordem primeiro.

---

## Lembrete permanente
Em qualquer sprint, se o Claude Code sugerir pular alguma regra do CLAUDE.md (por exemplo, cobrar taxa do jogador, ou deixar o painel do clube mono-esporte "para simplificar"), isso é sinal de alerta — pare e me chame antes de aprovar. As regras do CLAUDE.md existem para proteger o posicionamento do produto mesmo quando parece mais fácil no curto prazo não segui-las.
