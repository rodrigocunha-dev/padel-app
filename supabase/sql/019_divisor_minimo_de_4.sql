-- Sprint 5 (ajuste) — o divisor nunca é menor que 4
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- POR QUE
-- ============================================================
-- Achado pelo fundador testando o script 018: com o divisor sendo apenas
-- "quantas pessoas estão na sessão", uma sessão com 2 pessoas congelava
-- em 2 no primeiro pagamento. A partir daí o convite era recusado por
-- SEM_VAGA_ABERTA — o grupo ficava trancado com 2, e não dá para jogar
-- padel com 2.
--
-- Regra nova: a divisão parte de 4, que é o mínimo para fechar um jogo.
--   • 1, 2, 3 ou 4 pessoas na sessão  → divide por 4
--   • 5 pessoas                        → divide por 5
--   • 6 pessoas                        → divide por 6
--
-- Efeito colateral bom: com 2 pessoas e divisor 4, existem 2 vagas
-- abertas — então convidar continua liberado mesmo depois do
-- congelamento, que era exatamente o problema.
--
-- Nota para quando a sessão sair do padel: 4 é o mínimo do padel. Se um
-- dia a sessão valer para tênis de simples, este número precisa vir do
-- esporte da quadra, não fixo.

-- Mínimo de jogadores para fechar uma partida de padel.
create or replace function public.minimo_de_jogadores()
returns integer
language sql
immutable
as $fn$ select 4; $fn$;


-- O divisor que vale AGORA: o congelado, se já houver; senão o número de
-- pessoas na sessão — nunca menor que o mínimo.
create or replace function public.divisor_da_partida(p_partida_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $fn$
  select greatest(
    public.minimo_de_jogadores(),
    coalesce(
      (select divisor_congelado from public.partidas where id = p_partida_id),
      public.vagas_ocupadas(p_partida_id)
    )
  );
$fn$;


-- O congelamento também respeita o mínimo. Assim, depois de congelado,
-- `vagas_ocupadas < divisor_congelado` continua abrindo espaço para
-- convite enquanto o grupo não chegou a 4.
create or replace function public.congelar_divisor()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.partidas
  set divisor_congelado = greatest(
    public.minimo_de_jogadores(),
    public.vagas_ocupadas(new.partida_id)
  )
  where id = new.partida_id
    and divisor_congelado is null;
  return new;
end;
$fn$;


-- ============================================================
-- Conserta as sessões que já congelaram abaixo do mínimo
-- ============================================================
-- Sessões de teste criadas antes deste ajuste podem ter congelado em 1 ou
-- 2. Elas ficariam trancadas para sempre. Aqui elas sobem para 4.
-- ⚠️ Isto altera o valor por pessoa dessas sessões. Só é seguro porque
-- ainda não há dinheiro real no sistema (PIX simulado).
update public.partidas
set divisor_congelado = public.minimo_de_jogadores()
where divisor_congelado is not null
  and divisor_congelado < public.minimo_de_jogadores();


revoke all on function public.minimo_de_jogadores() from public, anon;
grant execute on function public.minimo_de_jogadores() to authenticated;
revoke all on function public.divisor_da_partida(uuid) from public, anon;
grant execute on function public.divisor_da_partida(uuid) to authenticated;
