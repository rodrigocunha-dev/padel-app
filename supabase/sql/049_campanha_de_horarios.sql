-- ============================================================
-- 049 — CAMPANHA DE HORÁRIOS LIVRES
-- ============================================================
-- Substitui o "avisar um horário" do script 046/039. O fundador achou o
-- problema dos dois extremos:
--
--   um aviso por CLUBE a cada 6h  → avisar a quadra de padel bloqueia
--                                    avisar a de beach tennis
--   um aviso por HORÁRIO          → metralha o jogador
--
-- O meio-termo que ele propôs: o clube seleciona VÁRIOS horários de uma vez,
-- e cada jogador recebe UM aviso com os horários que servem para ELE.
--
-- ⚠️ O QUE FILTRA PELO JOGADOR, E O QUE NÃO.
--
-- O clube escolhe os horários usando o que quiser (esporte, cobertura,
-- piso) — isso é atributo da QUADRA e ele decide na tela.
--
-- Do lado do jogador, o filtro é a DISPONIBILIDADE que ele declarou no
-- cadastro (dias × turnos) e a cidade. Preferência de esporte, de piso ou
-- de cobertura NÃO existe no perfil: ninguém nunca perguntou. Fica como
-- ideia futura no CLAUDE.md; sem esse dado, filtrar por isso seria inventar
-- uma preferência que a pessoa não deu.


-- ============================================================
-- 1) A CAMPANHA E SEUS HORÁRIOS
-- ============================================================

create table if not exists public.promocoes (
  id         uuid primary key default gen_random_uuid(),
  clube_id   uuid not null references public.clubes (id) on delete cascade,
  criada_por uuid not null references auth.users (id) on delete cascade,
  criada_em  timestamptz not null default now()
);

create table if not exists public.promocao_horarios (
  promocao_id uuid not null references public.promocoes (id) on delete cascade,
  quadra_id   uuid not null references public.quadras (id) on delete cascade,
  inicio      timestamptz not null,
  fim         timestamptz not null,
  primary key (promocao_id, quadra_id, inicio)
);

create index if not exists idx_promocoes_clube
  on public.promocoes (clube_id, criada_em desc);

alter table public.promocoes enable row level security;
alter table public.promocao_horarios enable row level security;

-- Quem recebeu o aviso pode ler a campanha. Sem isto o jogador teria a
-- notificação e não conseguiria abrir os horários.
drop policy if exists "promocoes_leitura" on public.promocoes;
create policy "promocoes_leitura"
  on public.promocoes for select to authenticated
  using (exists (
    select 1 from public.avisos a
    where a.promocao_id = id and a.jogador_id = (select auth.uid())
  ));

drop policy if exists "promocao_horarios_leitura" on public.promocao_horarios;
create policy "promocao_horarios_leitura"
  on public.promocao_horarios for select to authenticated
  using (exists (
    select 1 from public.avisos a
    where a.promocao_id = promocao_id and a.jogador_id = (select auth.uid())
  ));

alter table public.avisos
  add column if not exists promocao_id uuid references public.promocoes (id) on delete cascade;

alter table public.avisos drop constraint if exists avisos_tipo_check;
alter table public.avisos
  add constraint avisos_tipo_check
  check (tipo in ('set_registrado', 'votacao_aberta', 'promovido',
                  'horario_livre', 'edicao_proposta', 'chat_novas_mensagens',
                  'vaga_aberta', 'horarios_livres'));


-- ============================================================
-- 2) O HORÁRIO SERVE PARA ESTE JOGADOR?
-- ============================================================
-- Compara o horário com a disponibilidade declarada. O fuso é o de São
-- Paulo, como no resto do sistema: senão um jogo de sábado 21h cairia em
-- domingo e bateria com a disponibilidade errada.

create or replace function public.horario_na_disponibilidade(
  p_jogador_id uuid,
  p_inicio timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $fn$
declare
  v_disp jsonb;
  v_dia text;
  v_turno text;
  v_hora integer;
begin
  select disponibilidade into v_disp
  from public.jogadores where id = p_jogador_id;

  -- Sem disponibilidade declarada, não dá para filtrar — e, na dúvida, é
  -- melhor avisar do que deixar a pessoa de fora por um campo em branco.
  if v_disp is null or jsonb_array_length(v_disp) = 0 then
    return true;
  end if;

  v_dia := case extract(dow from (p_inicio at time zone 'America/Sao_Paulo'))::int
    when 0 then 'dom' when 1 then 'seg' when 2 then 'ter' when 3 then 'qua'
    when 4 then 'qui' when 5 then 'sex' else 'sab' end;

  v_hora := extract(hour from (p_inicio at time zone 'America/Sao_Paulo'))::int;
  v_turno := case
    when v_hora < 12 then 'manha'
    when v_hora < 18 then 'tarde'
    else 'noite' end;

  return exists (
    select 1
    from jsonb_array_elements(v_disp) d
    where d->>'dia' = v_dia
      and d->'turnos' ? v_turno
  );
end;
$fn$;

revoke all on function public.horario_na_disponibilidade(uuid, timestamptz)
  from public, anon;
grant execute on function public.horario_na_disponibilidade(uuid, timestamptz)
  to authenticated;


-- ============================================================
-- 3) CRIAR A CAMPANHA
-- ============================================================
-- Recebe os horários como jsonb: [{"quadra_id":"...","inicio":"...","fim":"..."}]

create or replace function public.promover_horarios(
  p_clube_id uuid,
  p_horarios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := (select auth.uid());
  v_promocao uuid;
  h jsonb;
  v_quadra uuid;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_validos integer := 0;
  v_avisados integer := 0;
begin
  if not exists (
    select 1 from public.clubes where id = p_clube_id and dono_id = eu
  ) then
    raise exception 'SO_O_DONO';
  end if;

  if jsonb_array_length(p_horarios) = 0 then
    raise exception 'NENHUM_HORARIO';
  end if;

  -- ⚠️ Teto por campanha. Sem ele, o clube poderia mandar a agenda inteira
  -- num aviso só — o que resolve o spam de notificação e cria outro
  -- problema: uma lista que ninguém lê.
  if jsonb_array_length(p_horarios) > 12 then
    raise exception 'HORARIOS_DEMAIS';
  end if;

  -- Uma campanha por clube a cada 6h. Agora isso não trava mais o clube
  -- multiesporte, porque a campanha leva vários horários de várias quadras.
  if exists (
    select 1 from public.promocoes
    where clube_id = p_clube_id and criada_em > now() - interval '6 hours'
  ) then
    raise exception 'AGUARDE_6H';
  end if;

  insert into public.promocoes (clube_id, criada_por)
  values (p_clube_id, eu)
  returning id into v_promocao;

  for h in select * from jsonb_array_elements(p_horarios) loop
    v_quadra := (h->>'quadra_id')::uuid;
    v_inicio := (h->>'inicio')::timestamptz;
    v_fim := (h->>'fim')::timestamptz;

    -- A quadra é deste clube?
    if not exists (
      select 1 from public.quadras where id = v_quadra and clube_id = p_clube_id
    ) then
      continue;
    end if;

    -- No passado não é oferta.
    if v_inicio <= now() then
      continue;
    end if;

    -- Ocupado não é oferta: anunciar quadra vendida faz a pessoa correr
    -- para uma porta fechada.
    if exists (
      select 1 from public.reservas r
      where r.quadra_id = v_quadra
        and r.status = 'confirmada'
        and tstzrange(r.inicio, r.fim) && tstzrange(v_inicio, v_fim)
    ) then
      continue;
    end if;

    insert into public.promocao_horarios (promocao_id, quadra_id, inicio, fim)
    values (v_promocao, v_quadra, v_inicio, v_fim)
    on conflict do nothing;

    v_validos := v_validos + 1;
  end loop;

  if v_validos = 0 then
    delete from public.promocoes where id = v_promocao;
    raise exception 'NENHUM_HORARIO_VALIDO';
  end if;

  -- UM aviso por jogador, e só para quem tem ao menos um horário compatível
  -- com a disponibilidade dele.
  with alvo as (
    select j.id
    from public.jogadores j
    join public.clubes c on c.id = p_clube_id
    where j.cidade = c.cidade
      and j.id <> eu
      and j.anonimizado_em is null
      and not public.jogador_inadimplente(j.id)
      and exists (
        select 1 from public.promocao_horarios ph
        where ph.promocao_id = v_promocao
          and public.horario_na_disponibilidade(j.id, ph.inicio)
      )
  ), criados as (
    insert into public.avisos (jogador_id, tipo, clube_id, promocao_id)
    select alvo.id, 'horarios_livres', p_clube_id, v_promocao from alvo
    returning 1
  )
  select count(*) into v_avisados from criados;

  return jsonb_build_object(
    'promocao_id', v_promocao,
    'horarios', v_validos,
    'descartados', jsonb_array_length(p_horarios) - v_validos,
    'avisados', v_avisados
  );
end;
$fn$;

revoke all on function public.promover_horarios(uuid, jsonb) from public, anon;
grant execute on function public.promover_horarios(uuid, jsonb) to authenticated;


-- ============================================================
-- 4) O QUE O JOGADOR VÊ
-- ============================================================
-- Só os horários que servem para ELE — não a campanha inteira. Mostrar
-- horários que não batem com a disponibilidade dele é ruído.

create or replace function public.horarios_para_mim(p_promocao_id uuid)
returns table (
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
  select q.nome, q.esporte, q.coberta, ph.inicio, ph.fim, q.clube_id
  from public.promocao_horarios ph
  join public.quadras q on q.id = ph.quadra_id
  where ph.promocao_id = p_promocao_id
    and exists (
      select 1 from public.avisos a
      where a.promocao_id = p_promocao_id
        and a.jogador_id = (select auth.uid())
    )
    and public.horario_na_disponibilidade((select auth.uid()), ph.inicio)
    -- Pode ter sido reservado depois do aviso. Some da lista em vez de
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
-- Depois de criar uma campanha, ver quantos foram avisados e quem:
--     select tipo, count(*) from public.avisos
--     where tipo = 'horarios_livres' group by tipo;
--
-- E, logado como jogador, o que sobrou para ele:
--     select * from public.horarios_para_mim('<promocao_id>');
