-- Sprint 4 (correção de integridade) — cancelar só partida futura
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- Bug: cancelar_partida deixava cancelar uma partida que JÁ ACONTECEU.
-- Isso é um furo: o organizador de uma partida vencida e não paga podia
-- cancelá-la e apagar a própria dívida (partida cancelada não conta para
-- inadimplência). Esconder o botão na tela NÃO basta — a trava tem que
-- estar aqui no servidor. Agora só dá para cancelar partida que ainda não
-- começou.

create or replace function public.cancelar_partida(p_partida_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jog uuid := auth.uid();
  v_partida public.partidas;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_jog <> v_partida.organizador_id then
    raise exception 'SO_O_ORGANIZADOR_CANCELA' using errcode = 'P0001';
  end if;

  -- Partida que já começou/aconteceu não pode ser cancelada (fecha o furo
  -- de apagar a dívida cancelando a partida vencida).
  if v_partida.inicio <= now() then
    raise exception 'PARTIDA_JA_COMECOU' using errcode = 'P0001';
  end if;

  perform set_config('app.pular_politica', '1', true);

  update public.partidas set status = 'cancelada' where id = p_partida_id;
  update public.reservas set status = 'cancelada' where id = v_partida.reserva_id;
end;
$$;

revoke all on function public.cancelar_partida(uuid) from public, anon;
grant execute on function public.cancelar_partida(uuid) to authenticated;
