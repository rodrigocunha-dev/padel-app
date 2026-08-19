-- ============================================================
-- 040 — EDITAR PARTIDA ABERTA
-- ============================================================
-- Entrega 3. Regra aprovada no CLAUDE.md: só o organizador edita; se já há
-- outros jogadores, a mudança vira uma SOLICITAÇÃO aprovada por TODOS.
--
-- O motivo da aprovação: quem entrou numa partida entrou naquelas condições.
-- Deixar o organizador trocar a faixa de categoria depois seria mudar o jogo
-- por baixo de quem já disse sim — e, no limite, empurrar alguém para fora.
--
-- ⚠️ RECORTE (decidido com o fundador em 17/08/2026): horário e quadra NÃO
-- entram. Mexer neles mexe na reserva por baixo, no preço, na trava de
-- overbooking e no divisor congelado de quem já pagou. Fica pendente no
-- CLAUDE.md, para ser desenhado com calma.


-- ============================================================
-- 1) A PROPOSTA
-- ============================================================
-- Uma linha por mudança pedida. Guardar a proposta separada da partida é o
-- que permite ela existir SEM valer ainda — e é o que dá para mostrar a
-- quem vai votar o que exatamente muda.

create table if not exists public.partida_edicoes (
  id             uuid primary key default gen_random_uuid(),
  partida_id     uuid not null references public.partidas (id) on delete cascade,
  proposta_por   uuid not null references auth.users (id) on delete cascade,
  categoria_min  smallint,
  categoria_max  smallint,
  competitiva    boolean,
  sexo_jogo      text,
  max_jogadores  smallint,
  criada_em      timestamptz not null default now(),
  aplicada_em    timestamptz,
  recusada_em    timestamptz,
  cancelada_em   timestamptz
);

create index if not exists idx_edicoes_partida
  on public.partida_edicoes (partida_id, criada_em desc);

-- No máximo UMA proposta em aberto por partida. Duas ao mesmo tempo
-- deixariam os jogadores votando em coisas que se contradizem.
create unique index if not exists idx_edicao_aberta_unica
  on public.partida_edicoes (partida_id)
  where aplicada_em is null and recusada_em is null and cancelada_em is null;

create table if not exists public.partida_edicao_votos (
  edicao_id    uuid not null references public.partida_edicoes (id) on delete cascade,
  jogador_id   uuid not null references auth.users (id) on delete cascade,
  aprovou      boolean not null,
  respondido_em timestamptz not null default now(),
  primary key (edicao_id, jogador_id)
);

alter table public.partida_edicoes enable row level security;
alter table public.partida_edicao_votos enable row level security;

-- Quem enxerga a partida enxerga a proposta dela. Reusa `posso_ver_partida`
-- do script 023 de propósito: a regra de quem vê o quê é UMA, e não uma
-- cópia por tabela — foi a cópia que produziu os furos da varredura de 08/08.
drop policy if exists "edicoes_leitura" on public.partida_edicoes;
create policy "edicoes_leitura"
  on public.partida_edicoes for select to authenticated
  using (public.posso_ver_partida(partida_id));

drop policy if exists "edicao_votos_leitura" on public.partida_edicao_votos;
create policy "edicao_votos_leitura"
  on public.partida_edicao_votos for select to authenticated
  using (exists (
    select 1 from public.partida_edicoes e
    where e.id = edicao_id and public.posso_ver_partida(e.partida_id)
  ));

-- Gravação só por função: as regras (quem pode, o que é válido, quando
-- aplica) ficam num lugar só.


-- ============================================================
-- 2) PROPOR (ou aplicar direto, quando se está sozinho)
-- ============================================================

create or replace function public.propor_edicao_partida(
  p_partida_id uuid,
  p_categoria_min smallint,
  p_categoria_max smallint,
  p_competitiva boolean,
  p_sexo_jogo text,
  p_max_jogadores smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := (select auth.uid());
  p public.partidas;
  v_outros integer;
  v_id uuid;
begin
  select * into p from public.partidas where id = p_partida_id;

  if p.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA';
  end if;
  if p.organizador_id <> eu then
    raise exception 'SO_O_ORGANIZADOR';
  end if;
  if p.tipo <> 'aberta' then
    raise exception 'SO_PARTIDA_ABERTA';
  end if;
  if p.status = 'cancelada' then
    raise exception 'PARTIDA_CANCELADA';
  end if;
  if p.inicio <= now() then
    raise exception 'PARTIDA_JA_COMECOU';
  end if;

  if p_categoria_min > p_categoria_max
     or p_categoria_min < 1 or p_categoria_max > 7 then
    raise exception 'FAIXA_INVALIDA';
  end if;

  if p_sexo_jogo not in ('masculino', 'feminino', 'mista') then
    raise exception 'SEXO_INVALIDO';
  end if;

  if p_max_jogadores < 4 or p_max_jogadores > 8 then
    raise exception 'JOGADORES_INVALIDO';
  end if;

  -- ⚠️ A MESMA regra que `criar_partida` aplica desde o script 008:
  -- competitiva é só com 4. Sem repetir aqui, a edição viraria a porta dos
  -- fundos para um estado que a criação proíbe — que é exatamente a família
  -- de furo da varredura de 08/08 ("caminho novo, regra antiga não relida").
  --
  -- Se um dia essa regra mudar (a regra nº 5 evoluiu bastante desde então),
  -- ela precisa mudar NOS DOIS lugares.
  if p_competitiva and p_max_jogadores <> 4 then
    raise exception 'COMPETITIVA_SO_COM_4';
  end if;

  -- Quantos jogadores ativos existem hoje, fora o organizador.
  select count(*) into v_outros
  from public.partida_jogadores pj
  where pj.partida_id = p_partida_id
    and pj.papel = 'jogador'
    and pj.estado = 'aceito'
    and pj.jogador_id <> eu;

  -- Não dá para encolher a partida abaixo de quem já está dentro: alguém
  -- teria de ser expulso por causa de uma edição.
  if p_max_jogadores < v_outros + 1 then
    raise exception 'MENOS_QUE_OS_JOGADORES';
  end if;

  -- Sozinho: vale na hora. Não há quem consultar.
  if v_outros = 0 then
    update public.partidas set
      categoria_min = p_categoria_min,
      categoria_max = p_categoria_max,
      competitiva = p_competitiva,
      sexo_jogo = p_sexo_jogo,
      max_jogadores = p_max_jogadores
    where id = p_partida_id;

    return jsonb_build_object('aplicada', true, 'faltam', 0);
  end if;

  -- Com gente dentro: vira proposta.
  insert into public.partida_edicoes (
    partida_id, proposta_por, categoria_min, categoria_max,
    competitiva, sexo_jogo, max_jogadores
  ) values (
    p_partida_id, eu, p_categoria_min, p_categoria_max,
    p_competitiva, p_sexo_jogo, p_max_jogadores
  )
  returning id into v_id;

  -- Todo mundo que precisa aprovar recebe aviso (e push, pelo gatilho do 033).
  insert into public.avisos (jogador_id, tipo, partida_id)
  select pj.jogador_id, 'edicao_proposta', p_partida_id
  from public.partida_jogadores pj
  where pj.partida_id = p_partida_id
    and pj.papel = 'jogador'
    and pj.estado = 'aceito'
    and pj.jogador_id <> eu;

  return jsonb_build_object('aplicada', false, 'faltam', v_outros, 'edicao_id', v_id);
exception
  when unique_violation then
    raise exception 'JA_HA_PROPOSTA';
end;
$fn$;


-- ============================================================
-- 3) RESPONDER
-- ============================================================
-- Aplica quando TODOS aprovarem. Uma recusa derruba na hora — não faz
-- sentido continuar coletando votos de uma mudança que já não passa.

create or replace function public.responder_edicao_partida(
  p_edicao_id uuid,
  p_aprovou boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := (select auth.uid());
  e public.partida_edicoes;
  v_elegiveis integer;
  v_aprovacoes integer;
begin
  select * into e from public.partida_edicoes where id = p_edicao_id;

  if e.id is null then
    raise exception 'PROPOSTA_NAO_ENCONTRADA';
  end if;
  if e.aplicada_em is not null or e.recusada_em is not null
     or e.cancelada_em is not null then
    raise exception 'PROPOSTA_ENCERRADA';
  end if;

  -- Só quem está DENTRO da partida vota, e o proponente não vota na
  -- própria proposta.
  if not exists (
    select 1 from public.partida_jogadores pj
    where pj.partida_id = e.partida_id
      and pj.jogador_id = eu
      and pj.papel = 'jogador'
      and pj.estado = 'aceito'
  ) or eu = e.proposta_por then
    raise exception 'NAO_PODE_VOTAR';
  end if;

  insert into public.partida_edicao_votos (edicao_id, jogador_id, aprovou)
  values (p_edicao_id, eu, p_aprovou)
  on conflict (edicao_id, jogador_id)
  do update set aprovou = excluded.aprovou, respondido_em = now();

  if not p_aprovou then
    update public.partida_edicoes set recusada_em = now() where id = p_edicao_id;
    return jsonb_build_object('resultado', 'recusada');
  end if;

  select count(*) into v_elegiveis
  from public.partida_jogadores pj
  where pj.partida_id = e.partida_id
    and pj.papel = 'jogador'
    and pj.estado = 'aceito'
    and pj.jogador_id <> e.proposta_por;

  select count(*) into v_aprovacoes
  from public.partida_edicao_votos v
  where v.edicao_id = p_edicao_id and v.aprovou;

  if v_aprovacoes >= v_elegiveis then
    update public.partidas set
      categoria_min = coalesce(e.categoria_min, categoria_min),
      categoria_max = coalesce(e.categoria_max, categoria_max),
      competitiva   = coalesce(e.competitiva, competitiva),
      sexo_jogo     = coalesce(e.sexo_jogo, sexo_jogo),
      max_jogadores = coalesce(e.max_jogadores, max_jogadores)
    where id = e.partida_id;

    update public.partida_edicoes set aplicada_em = now() where id = p_edicao_id;
    return jsonb_build_object('resultado', 'aplicada');
  end if;

  return jsonb_build_object(
    'resultado', 'aguardando',
    'faltam', v_elegiveis - v_aprovacoes
  );
end;
$fn$;


-- ============================================================
-- 4) CANCELAR A PRÓPRIA PROPOSTA
-- ============================================================

create or replace function public.cancelar_edicao_partida(p_edicao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := (select auth.uid());
begin
  update public.partida_edicoes
  set cancelada_em = now()
  where id = p_edicao_id
    and proposta_por = eu
    and aplicada_em is null and recusada_em is null and cancelada_em is null;

  if not found then
    raise exception 'NAO_PODE_CANCELAR';
  end if;
end;
$fn$;


-- ============================================================
-- 5) O AVISO NOVO
-- ============================================================
alter table public.avisos drop constraint if exists avisos_tipo_check;
alter table public.avisos
  add constraint avisos_tipo_check
  check (tipo in ('set_registrado', 'votacao_aberta', 'promovido',
                  'horario_livre', 'edicao_proposta'));


revoke all on function public.propor_edicao_partida(uuid, smallint, smallint, boolean, text, smallint)
  from public, anon;
grant execute on function public.propor_edicao_partida(uuid, smallint, smallint, boolean, text, smallint)
  to authenticated;

revoke all on function public.responder_edicao_partida(uuid, boolean) from public, anon;
grant execute on function public.responder_edicao_partida(uuid, boolean) to authenticated;

revoke all on function public.cancelar_edicao_partida(uuid) from public, anon;
grant execute on function public.cancelar_edicao_partida(uuid) to authenticated;


-- ============================================================
-- COMO CONFERIR
-- ============================================================
-- Sozinho aplica na hora; com gente dentro vira proposta:
--     select public.propor_edicao_partida('<partida>', 1::smallint, 7::smallint,
--                                         true, 'mista', 4::smallint);
--
-- Duas propostas abertas na mesma partida têm de falhar (JA_HA_PROPOSTA).
-- Uma recusa encerra na hora, sem esperar os outros.
