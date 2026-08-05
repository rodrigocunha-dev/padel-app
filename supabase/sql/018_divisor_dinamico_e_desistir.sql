-- Sprint 5 (Entrega A) — Divisor dinâmico até o 1º pagamento + "Desistir"
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- POR QUE ISTO EXISTE
-- ============================================================
-- No teste, uma sessão de R$130 foi dividida por quem já tinha aceitado.
-- Rodrigo e Carlos pagaram R$65 cada (quadra quitada). Quando o Diego
-- aceitou, o divisor virou 3 e a tela passou a dizer que os dois tinham
-- pago R$43,33 — e a cobrar mais R$43,33 do Diego, para uma quadra que
-- já estava paga.
--
-- O erro: divisor que se mexe depois que o dinheiro andou. Quem pagou
-- fica sempre "errado", e o total arrecadado passa do valor da quadra.
--
-- Regra nova (decidida com o fundador):
--   • NÃO existe número de vagas declarado. O divisor é simplesmente
--     quantas pessoas estão na sessão (organizador + convidados).
--   • ANTES do 1º pagamento: recalcula à vontade — convite novo, recusa,
--     tanto faz. O grupo ainda está se formando e nada foi pago.
--   • A PARTIR do 1º pagamento: CONGELA. Ninguém que já pagou pode ter a
--     conta alterada por decisão de outra pessoa.
--   • EXCEÇÃO: quem recusa ou desiste depois do congelamento libera
--     exatamente 1 vaga, pelo mesmo valor já congelado. O organizador
--     pode preencher. Duas recusas liberam duas vagas. Sem recálculo.


-- ============================================================
-- 1) O DIVISOR CONGELADO
-- ============================================================
alter table public.partidas
  add column if not exists divisor_congelado smallint
    check (divisor_congelado is null or divisor_congelado > 0);

-- Quantas pessoas ocupam vaga agora. Quem recusou não ocupa; quem
-- avisou que desiste também não, porque a vaga está aberta para troca.
create or replace function public.vagas_ocupadas(p_partida_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $fn$
  select count(*)::int
  from public.partida_jogadores
  where partida_id = p_partida_id
    and estado in ('convidado', 'aceito')
    and desistiu_em is null;
$fn$;

-- O divisor que vale AGORA: o congelado, se já houver; senão o número
-- de pessoas na sessão. É o que a tela usa para mostrar o valor por
-- pessoa, e é a mesma conta que o servidor faz.
create or replace function public.divisor_da_partida(p_partida_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $fn$
  select greatest(
    1,
    coalesce(
      (select divisor_congelado from public.partidas where id = p_partida_id),
      public.vagas_ocupadas(p_partida_id)
    )
  );
$fn$;


-- ============================================================
-- 2) CONGELAR NO PRIMEIRO PAGAMENTO
-- ============================================================
-- Gatilho, e não a tela: o congelamento tem que valer mesmo que o
-- pagamento venha por outro caminho (o gateway real, amanhã).
create or replace function public.congelar_divisor()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.partidas
  set divisor_congelado = public.vagas_ocupadas(new.partida_id)
  where id = new.partida_id
    and divisor_congelado is null;
  return new;
end;
$fn$;

drop trigger if exists trg_congelar_divisor on public.pagamentos;
create trigger trg_congelar_divisor
  after insert on public.pagamentos
  for each row execute function public.congelar_divisor();


-- ============================================================
-- 3) "DESISTIR" — avisa o grupo, não some da sessão
-- ============================================================
-- Situação real: a pessoa avisa que talvez não consiga ir, mas mantém a
-- vaga se ninguém assumir. Por isso desistir NÃO remove — só marca a
-- vaga como disponível para troca.
alter table public.partida_jogadores
  add column if not exists desistiu_em timestamptz;

-- Estado novo: 'saiu' é quem desistiu E foi substituído. Diferente de
-- 'recusado', que é quem nunca aceitou.
alter table public.partida_jogadores
  drop constraint if exists partida_jogadores_estado_check;
alter table public.partida_jogadores
  add constraint partida_jogadores_estado_check
  check (estado in ('convidado', 'aceito', 'recusado', 'saiu'));

create or replace function public.desistir_da_sessao(p_partida_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  v_partida public.partidas;
  v_estado text;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  -- Prazo: até o jogo começar. Depois disso a pessoa volta a ser
  -- confirmada normal e não há mais troca.
  if v_partida.inicio <= now() then
    raise exception 'PARTIDA_JA_COMECOU' using errcode = 'P0001';
  end if;

  select estado into v_estado
  from public.partida_jogadores
  where partida_id = p_partida_id and jogador_id = v_jog;

  if v_estado is null or v_estado <> 'aceito' then
    raise exception 'SO_QUEM_ACEITOU_DESISTE' using errcode = 'P0001';
  end if;

  update public.partida_jogadores
  set desistiu_em = now()
  where partida_id = p_partida_id and jogador_id = v_jog;
end;
$fn$;

-- Voltar atrás enquanto ninguém assumiu a vaga.
create or replace function public.cancelar_desistencia(p_partida_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  update public.partida_jogadores
  set desistiu_em = null
  where partida_id = p_partida_id
    and jogador_id = v_jog
    and estado = 'aceito'
    and desistiu_em is not null;

  if not found then
    raise exception 'NADA_PARA_CANCELAR' using errcode = 'P0001';
  end if;
end;
$fn$;


-- ============================================================
-- 4) CONVIDAR — respeitando o congelamento
-- ============================================================
-- Antes do congelamento: sem limite, o grupo cresce à vontade.
-- Depois: só cabe convite se houver vaga aberta (alguém recusou ou
-- desistiu). Assim o divisor nunca cresce depois que alguém pagou.
create or replace function public.convidar_participante(
  p_partida_id uuid,
  p_jogador_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org uuid := auth.uid();
  v_partida public.partidas;
begin
  if v_org is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_partida.organizador_id <> v_org then
    raise exception 'SO_O_ORGANIZADOR_CONVIDA' using errcode = 'P0001';
  end if;
  if v_partida.status = 'cancelada' then
    raise exception 'PARTIDA_CANCELADA' using errcode = 'P0001';
  end if;
  if v_partida.inicio <= now() then
    raise exception 'PARTIDA_JA_COMECOU' using errcode = 'P0001';
  end if;

  -- CONTA OBRIGATÓRIA: sem perfil, não entra na sessão.
  if not exists (select 1 from public.jogadores where id = p_jogador_id) then
    raise exception 'PRECISA_TER_CONTA' using errcode = 'P0001';
  end if;

  -- Depois que alguém pagou, o grupo não cresce: só repõe vaga aberta.
  if v_partida.divisor_congelado is not null
     and public.vagas_ocupadas(p_partida_id) >= v_partida.divisor_congelado then
    raise exception 'SEM_VAGA_ABERTA' using errcode = 'P0001';
  end if;

  insert into public.partida_jogadores (
    partida_id, jogador_id, papel, ordem, estado, convidado_por, convidado_em
  ) values (
    p_partida_id, p_jogador_id, 'jogador',
    coalesce((select max(ordem) from public.partida_jogadores where partida_id = p_partida_id), 0) + 1,
    'convidado', v_org, now()
  )
  on conflict (partida_id, jogador_id) do update
    set estado = 'convidado',
        desistiu_em = null,
        convidado_por = v_org,
        convidado_em = now(),
        respondido_em = null
    where public.partida_jogadores.estado in ('recusado', 'saiu');
end;
$fn$;


-- ============================================================
-- 5) ACEITAR — quem assume a vaga tira quem desistiu
-- ============================================================
create or replace function public.responder_convite(
  p_partida_id uuid,
  p_aceito boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  v_estado text;
  v_congelado smallint;
  v_substituido uuid;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;
  if p_aceito and public.jogador_inadimplente(v_jog) then
    raise exception 'PENDENCIA' using errcode = 'P0001';
  end if;

  select estado into v_estado
  from public.partida_jogadores
  where partida_id = p_partida_id and jogador_id = v_jog;

  if v_estado is null then
    raise exception 'CONVITE_NAO_ENCONTRADO' using errcode = 'P0001';
  end if;
  if v_estado <> 'convidado' then
    raise exception 'CONVITE_JA_RESPONDIDO' using errcode = 'P0001';
  end if;

  update public.partida_jogadores
  set estado = case when p_aceito then 'aceito' else 'recusado' end,
      respondido_em = now()
  where partida_id = p_partida_id and jogador_id = v_jog;

  -- Se o grupo já está congelado e alguém tinha desistido, quem acabou de
  -- aceitar assumiu a vaga: o desistente mais antigo sai da sessão.
  -- O pagamento dele, se houver, FICA COM ELE — a vaga segue quitada para
  -- o clube, e o acerto entre as duas pessoas é por fora (decisão do
  -- fundador; ver "MODELO DE PAGAMENTO" no CLAUDE.md).
  if p_aceito then
    select divisor_congelado into v_congelado
    from public.partidas where id = p_partida_id;

    if v_congelado is not null then
      select jogador_id into v_substituido
      from public.partida_jogadores
      where partida_id = p_partida_id
        and estado = 'aceito'
        and desistiu_em is not null
      order by desistiu_em
      limit 1;

      if v_substituido is not null then
        update public.partida_jogadores
        set estado = 'saiu'
        where partida_id = p_partida_id and jogador_id = v_substituido;
      end if;
    end if;
  end if;
end;
$fn$;


revoke all on function public.vagas_ocupadas(uuid) from public, anon;
grant execute on function public.vagas_ocupadas(uuid) to authenticated;
revoke all on function public.divisor_da_partida(uuid) from public, anon;
grant execute on function public.divisor_da_partida(uuid) to authenticated;
revoke all on function public.desistir_da_sessao(uuid) from public, anon;
grant execute on function public.desistir_da_sessao(uuid) to authenticated;
revoke all on function public.cancelar_desistencia(uuid) from public, anon;
grant execute on function public.cancelar_desistencia(uuid) to authenticated;
revoke all on function public.convidar_participante(uuid, uuid) from public, anon;
grant execute on function public.convidar_participante(uuid, uuid) to authenticated;
revoke all on function public.responder_convite(uuid, boolean) from public, anon;
grant execute on function public.responder_convite(uuid, boolean) to authenticated;
