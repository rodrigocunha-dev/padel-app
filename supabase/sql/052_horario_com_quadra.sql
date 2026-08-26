-- ============================================================
-- 052 — O HORÁRIO AVISADO PRECISA CARREGAR A QUADRA
-- ============================================================
-- O fundador testou o aviso de horários livres: ao tocar num horário, a tela
-- de reserva abria em HOJE e na PRIMEIRA quadra — não no que foi anunciado.
-- A pessoa tinha de procurar de novo o horário que o aviso acabara de
-- mostrar, que é o oposto do que o aviso existe para fazer.
--
-- A tela já foi ajustada para receber quadra, dia e hora pelo endereço.
-- Faltava a função devolver o ID DA QUADRA — ela mandava só o nome, e nome
-- de quadra não serve para reservar: o Clube Teste tem duas chamadas
-- "Quadra 1", uma de padel e uma de beach tennis.
--
-- ⚠️ PRECISA APAGAR ANTES DE RECRIAR: a função ganha uma coluna no retorno,
-- e o Postgres recusa `create or replace` quando o formato muda ("cannot
-- change return type of existing function"). Mesma pedra do script 044.
--
-- Apagar é seguro: nada no banco depende dela — quem chama é o app, por RPC.
-- O `grant` é reaplicado no fim, porque o `drop` leva as permissões junto.

drop function if exists public.horarios_para_mim(uuid);

create function public.horarios_para_mim(p_promocao_id uuid)
returns table (
  quadra_id uuid,
  quadra text,
  esporte text,
  coberta boolean,
  inicio timestamptz,
  fim timestamptz,
  clube_id uuid
)
language sql
security definer
set search_path = public
stable
as $fn$
  select q.id, q.nome, q.esporte, q.coberta, ph.inicio, ph.fim, q.clube_id
  from public.promocao_horarios ph
  join public.quadras q on q.id = ph.quadra_id
  where ph.promocao_id = p_promocao_id
    -- Só quem recebeu o aviso enxerga os horários dele.
    and exists (
      select 1 from public.avisos a
      where a.promocao_id = p_promocao_id
        and a.jogador_id = (select auth.uid())
    )
    and public.horario_na_disponibilidade((select auth.uid()), ph.inicio)
    -- Pode ter sido reservado depois do aviso. Some da lista, em vez de
    -- levar a pessoa a um horário que não existe mais.
    and not exists (
      select 1 from public.reservas r
      where r.quadra_id = ph.quadra_id
        and r.status = 'confirmada'
        and tstzrange(r.inicio, r.fim) && tstzrange(ph.inicio, ph.fim)
    )
  order by ph.inicio;
$fn$;

revoke all on function public.horarios_para_mim(uuid) from public, anon;
grant execute on function public.horarios_para_mim(uuid) to authenticated;


-- ============================================================
-- COMO CONFERIR
-- ============================================================
-- Rodando logado como um jogador que recebeu o aviso, a primeira coluna
-- agora é o id da quadra:
--     select * from public.horarios_para_mim('<promocao_id>');
--
-- E no app: tocar num horário do aviso tem de abrir a reserva JÁ na quadra,
-- no dia e na hora anunciados, com o horário marcado.
