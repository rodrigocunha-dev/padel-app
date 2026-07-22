# Reserva pelo app, tempo real e política de cancelamento (Sprint 3)

## O que é
O jogador reserva uma quadra pelo app em **3 toques**: "Reservar quadra" na página do clube → toca no horário livre → confirma. Depois pode ver, cancelar ou remarcar em "Minhas reservas", dentro da regra de cada clube.

## Onde fica no código
- Tela de reserva: `src/app/app/clubes/[id]/reservar/page.tsx` + `src/components/reservas/ReservarQuadra.tsx`
- Minhas reservas: `src/app/app/reservas/page.tsx` + `src/components/reservas/MinhasReservas.tsx`
- Regras de horários e prazos: `src/lib/reservas.ts`
- Banco: `supabase/sql/006_reserva_app.sql` e `007_remarcar_reserva.sql`

## Zero overbooking — por que é impossível dar em duplicidade
A garantia mora **no banco de dados**, não na tela:
1. Uma "exclusion constraint" do PostgreSQL recusa qualquer reserva confirmada que cruze com outra da mesma quadra.
2. A reserva passa por uma função no servidor (`reservar_quadra`) que confere o horário de funcionamento, calcula o preço e grava de uma vez só.

**Testado de verdade:** duas reservas idênticas disparadas no mesmo instante — uma entrou (200) e a outra foi recusada (erro `23P01`). Também recusa sobreposição parcial (10:30 quando já existe 10:00–11:00), horário fora do funcionamento e horário no passado.

## Tempo real
- **Jogador:** a grade de horários se atualiza sozinha quando alguém reserva. Verificado: o horário sumiu da tela em segundos, sem recarregar a página.
- **Clube:** a agenda mostra na hora as reservas feitas pelo app (com 📱 e o nome do jogador) ou por outro dispositivo do balcão.

## Privacidade (LGPD)
O jogador **não** pode ler as reservas dos outros. Para saber o que está ocupado, o app lê a tabela `agenda_publica` — um espelho automático que contém **só quadra, início e fim**. Nome e telefone nunca entram ali. Quem escreve nesse espelho é um gatilho do banco, não o aplicativo.

## Política de cancelamento
- O clube escolhe **"cancelamento livre até X horas antes"** (0, 2, 6, 12, 24 ou 48h; padrão 12h) no painel, e pode complementar com um texto livre de detalhes.
- O jogador vê o prazo exato ("dá para cancelar até 23/07 às 20:00") na confirmação e em Minhas reservas.
- Passado o prazo, o app bloqueia cancelar e remarcar — e **a trava vale no servidor** (gatilho no banco), não só na tela.
- **Servidor × tela — a diferença é proposital:**
  - No **servidor**, o dono do clube é isento da política (verificado: cancelou uma reserva faltando 8,5h para o jogo, com limite de 12h). Isso existe porque o clube precisa poder mexer na própria agenda a qualquer momento.
  - Na **tela do jogador** (`/app/reservas`), a política vale para todos, inclusive para quem é dono de clube — ali a pessoa está agindo como jogador. Para operar como clube, use o painel `/clube/agenda`, que não tem trava.
  - Decisão do fundador em 22/07/2026: manter assim. Se um dia mudar, ver a pendência do "botão de troca de modo" no CLAUDE.md.

## Remarcar
Remarcar **move a mesma reserva** para outro horário (não cria uma nova). Isso importa porque: o preço é recalculado pelo servidor, dá para mover para um horário que encosta no atual, e se o novo horário for tomado no meio do caminho a reserva original continua de pé.

## O que ainda não faz
- **Pagamento:** a reserva é confirmada e paga-se no clube. O PIX dividido é o próximo módulo e encaixa aqui.
- Partidas abertas (juntar jogadores na mesma reserva) — módulo próprio.
- Lembrete por WhatsApp antes do jogo.

## Métricas
- `reserva_app_criada` (duração, preço, esporte), `reserva_app_remarcada`, `reserva_app_cancelada`
