# Agenda do clube v0 — reserva manual de balcão (Sprint 2)

## O que é
Em `/clube/agenda`, o dono vê o dia inteiro (06h–24h) com uma coluna por quadra e anota **reservas de balcão**: cliente que ligou, chegou no local ou mandou WhatsApp. Dá para navegar entre dias, reservar horário livre (nome, WhatsApp opcional, duração 1h/1h30/2h) e cancelar.

## Onde fica no código
- Página: `src/app/clube/agenda/page.tsx`
- Grade e formulário: `src/components/clube/AgendaDia.tsx`
- Tabela: `reservas` (script `supabase/sql/004_descoberta_reservas.sql`)

## Zero overbooking (regra nº 8) — como funciona
A proteção mora **no banco de dados**, não só na tela: uma "exclusion constraint" do PostgreSQL recusa qualquer reserva confirmada da mesma quadra com horários que se cruzem — mesmo que duas pessoas cliquem no mesmo segundo, uma delas recebe recusa. Testado tentando gravar por fora da interface: o banco barrou com o erro `sem_overbooking`, e a tela mostra "esse horário acabou de ser ocupado".

## Privacidade (LGPD)
Nome e telefone de quem reservou são visíveis **apenas para o dono do clube**. Jogadores consultando disponibilidade (mapa/"Jogar agora") recebem só quadra + horários ocupados, via função dedicada do banco.

## Visões Dia | Semana | Mês
- **Dia:** grade quadra × hora (06h–24h) para reservar e cancelar.
- **Semana:** quadra × dia, com o % do horário de funcionamento já reservado.
- **Mês:** calendário com a ocupação de todas as quadras somadas — serve para achar os dias ociosos.
- Nas visões semana e mês, **cada dia é clicável** e abre a agenda daquele dia. Há também um seletor de calendário para pular para qualquer data.

## O que ainda não faz (v0 de propósito)
- Reserva pelo jogador no app (vem no módulo de reservas + PIX split).
- Bloqueios recorrentes (mensalistas — Fase 2) e edição de reserva (por ora: cancelar e recriar).
- Cancelamento marca como "cancelada" (histórico preservado), não apaga.
- O fundador quer evoluir esta tela no futuro (ver pendências no CLAUDE.md).

## Métricas
- `reserva_balcao_criada` (duração), `reserva_balcao_cancelada`
