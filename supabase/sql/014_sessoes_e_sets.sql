-- Sprint 5 (parte A) — Sessões em grupo, convite com aceite, sets e contestação
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- Implementa as Decisões 1 e 2 da regra nº 5 (ver CLAUDE.md). Em resumo:
--   • a reserva pode virar uma SESSÃO com participantes convidados e aceitos
--   • dentro dela, cada SET é um mini-resultado entre duas duplas
--   • silêncio vale como concordância: o set conta se ninguém contestar em 24h
--   • contestar exige propor OUTRO placar; o grupo desempata por votação
--
-- NADA aqui calcula rating. O motor é o próximo passo, e lê o que este
-- script grava. A elegibilidade ("este set pode contar?") mora aqui.


-- ============================================================
-- 1) PARTIDAS ganha TIPO: aberta (estranhos) ou privada (grupo)
-- ============================================================
-- Decisão: estender `partidas` em vez de criar uma tabela `sessoes`. Motivo:
-- a partida privada PODE ter vagas abertas (o caso híbrido já aprovado) —
-- com duas tabelas, o híbrido ficaria metade em cada uma.

alter table public.partidas
  add column if not exists tipo text not null default 'aberta'
    check (tipo in ('aberta', 'privada'));

-- Faixa de categoria e sexo do jogo existem para FILTRAR ESTRANHOS. Numa
-- sessão privada não há estranho — o organizador escolhe pessoa por pessoa.
-- Então lá eles podem ficar vazios.
alter table public.partidas alter column categoria_min drop not null;
alter table public.partidas alter column categoria_max drop not null;
alter table public.partidas alter column sexo_jogo   drop not null;

-- ...mas continuam OBRIGATÓRIOS na partida aberta, com a mesma força de antes.
-- Tornar a coluna aceitável como vazia é uma coisa; permitir criar uma partida
-- aberta sem ela é outra. Esta trava garante a segunda.
alter table public.partidas drop constraint if exists aberta_exige_filtros;
alter table public.partidas add constraint aberta_exige_filtros check (
  tipo <> 'aberta'
  or (categoria_min is not null and categoria_max is not null and sexo_jogo is not null)
);


-- ============================================================
-- 2) DECLARAÇÃO COMPETITIVA congelada quando a partida começa
-- ============================================================
-- `competitiva` já existia. O que muda: ela passa a valer também para sessão
-- privada, e não pode mais ser alterada depois que a bola rola — senão alguém
-- joga, vê que ganhou e muda para competitiva depois.

create or replace function public.congelar_declaracao_competitiva()
returns trigger
language plpgsql
as $$
begin
  if new.competitiva is distinct from old.competitiva
     and old.inicio <= now() then
    raise exception 'PARTIDA_JA_COMECOU' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_congelar_competitiva on public.partidas;
create trigger trg_congelar_competitiva
  before update on public.partidas
  for each row execute function public.congelar_declaracao_competitiva();


-- ============================================================
-- 3) PARTIDA_JOGADORES ganha o ciclo de CONVITE → ACEITE
-- ============================================================
-- Até aqui, cada pessoa só se adicionava (entrar_na_partida usa auth.uid()).
-- O convite é a PRIMEIRA vez que alguém é adicionado por outra pessoa — por
-- isso a regra de "conta obrigatória" passa a viver na função de convidar.

alter table public.partida_jogadores
  add column if not exists estado text not null default 'aceito'
    check (estado in ('convidado', 'aceito', 'recusado')),
  add column if not exists telefone text,
  add column if not exists convidado_por uuid references auth.users (id) on delete set null,
  add column if not exists convidado_em timestamptz,
  add column if not exists respondido_em timestamptz;

-- As linhas que já existem são todas de gente que entrou por conta própria —
-- o default 'aceito' já as deixa corretas.

-- Preparação para a Entrega B (convite por telefone de quem ainda não tem
-- conta): o participante pode existir SEM jogador_id, identificado só pelo
-- telefone. Fazer isso agora custa zero; depois seria migração com dados vivos.
alter table public.partida_jogadores alter column jogador_id drop not null;

alter table public.partida_jogadores drop constraint if exists participante_identificado;
alter table public.partida_jogadores add constraint participante_identificado check (
  jogador_id is not null or telefone is not null
);

-- Postgres permite vários NULL num unique, então o unique (partida_id,
-- jogador_id) que já existe não atrapalha os convites por telefone. Falta só
-- impedir convidar o MESMO telefone duas vezes para a mesma partida.
create unique index if not exists partida_jogadores_telefone_unico
  on public.partida_jogadores (partida_id, telefone)
  where telefone is not null;


-- ============================================================
-- 4) SETS — cada set é um mini-resultado entre duas duplas
-- ============================================================
-- Não existe "placar único da sessão": o jogo real de grupo acontece um set
-- por combinação de dupla, e capturar assim é fiel ao que acontece em quadra.
--
-- Sets INCOMPLETOS podem ser gravados (viram histórico), mas nunca contam para
-- rating. Por isso o formato NÃO é uma trava de gravação — é elegibilidade,
-- calculada mais abaixo.

create table if not exists public.sets (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references public.partidas (id) on delete cascade,
  ordem smallint not null check (ordem > 0),

  -- As duas duplas do set. Quatro pessoas distintas, todas participantes.
  a1 uuid not null references auth.users (id) on delete cascade,
  a2 uuid not null references auth.users (id) on delete cascade,
  b1 uuid not null references auth.users (id) on delete cascade,
  b2 uuid not null references auth.users (id) on delete cascade,

  games_a smallint not null check (games_a between 0 and 7),
  games_b smallint not null check (games_b between 0 and 7),

  registrado_por uuid not null references auth.users (id) on delete cascade,
  registrado_em timestamptz not null default now(),

  -- Cooldown de 6h do aviso de votação — por VOTAÇÃO, não por jogador.
  ultimo_aviso_votacao timestamptz,

  unique (partida_id, ordem),
  constraint duplas_sem_repetido check (
    a1 <> a2 and b1 <> b2
    and a1 <> b1 and a1 <> b2
    and a2 <> b1 and a2 <> b2
  )
);

alter table public.sets enable row level security;

-- Quem participou da partida lê os sets dela. Ninguém de fora.
drop policy if exists "sets_leitura_participantes" on public.sets;
create policy "sets_leitura_participantes"
  on public.sets for select to authenticated
  using (
    exists (
      select 1 from public.partida_jogadores pj
      where pj.partida_id = sets.partida_id
        and pj.jogador_id = (select auth.uid())
        and pj.estado = 'aceito'
    )
  );


-- ============================================================
-- 5) CONTESTAÇÃO — discordar exige propor OUTRO placar
-- ============================================================
-- "Discordo" é vago e não dá para auditar. "Foi 6-4, não 6-2" é uma alegação
-- concreta, que o grupo pode confrontar — e que compromete quem age de má-fé.

create table if not exists public.set_contestacoes (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets (id) on delete cascade,
  contestado_por uuid not null references auth.users (id) on delete cascade,
  games_a smallint not null check (games_a between 0 and 7),
  games_b smallint not null check (games_b between 0 and 7),
  criado_em timestamptz not null default now(),
  -- Um set só admite uma contestação: a partir dela, quem decide é a votação.
  unique (set_id)
);

alter table public.set_contestacoes enable row level security;

drop policy if exists "contestacoes_leitura_participantes" on public.set_contestacoes;
create policy "contestacoes_leitura_participantes"
  on public.set_contestacoes for select to authenticated
  using (
    exists (
      select 1 from public.sets s
      join public.partida_jogadores pj on pj.partida_id = s.partida_id
      where s.id = set_contestacoes.set_id
        and pj.jogador_id = (select auth.uid())
        and pj.estado = 'aceito'
    )
  );


-- ============================================================
-- 6) VOTOS — o grupo desempata
-- ============================================================
-- Votam os participantes da sessão MENOS os dois em disputa. Vence quem tiver
-- mais de 50% dos ELEGÍVEIS (não dos votos dados) — abstenção não ajuda a
-- resolver. É o que impede um amigo de plantão de virar o resultado sozinho.

create table if not exists public.set_votos (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets (id) on delete cascade,
  votante_id uuid not null references auth.users (id) on delete cascade,
  -- 'original' = o placar de quem registrou; 'contestado' = o proposto
  voto text not null check (voto in ('original', 'contestado')),
  criado_em timestamptz not null default now(),
  unique (set_id, votante_id)
);

alter table public.set_votos enable row level security;

drop policy if exists "votos_leitura_participantes" on public.set_votos;
create policy "votos_leitura_participantes"
  on public.set_votos for select to authenticated
  using (
    exists (
      select 1 from public.sets s
      join public.partida_jogadores pj on pj.partida_id = s.partida_id
      where s.id = set_votos.set_id
        and pj.jogador_id = (select auth.uid())
        and pj.estado = 'aceito'
    )
  );


-- ============================================================
-- 7) AVISOS dentro do app
-- ============================================================
-- O aviso DENTRO do app existe sempre, independente do canal externo (push ou
-- WhatsApp, ainda em aberto). Isso não depende do trilho de notificações que
-- foi adiado: é um dado marcado e mostrado numa tela que já existe.
--
-- Notificar não é conforto: "silêncio vale como concordância" só é justo se a
-- pessoa teve chance real de saber.

create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  jogador_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('set_registrado', 'votacao_aberta')),
  set_id uuid references public.sets (id) on delete cascade,
  criado_em timestamptz not null default now(),
  lido_em timestamptz
);

create index if not exists avisos_por_jogador
  on public.avisos (jogador_id, lido_em);

alter table public.avisos enable row level security;

drop policy if exists "avisos_leitura_dono" on public.avisos;
create policy "avisos_leitura_dono"
  on public.avisos for select to authenticated
  using (jogador_id = (select auth.uid()));

drop policy if exists "avisos_marcar_lido" on public.avisos;
create policy "avisos_marcar_lido"
  on public.avisos for update to authenticated
  using (jogador_id = (select auth.uid()))
  with check (jogador_id = (select auth.uid()));


-- ============================================================
-- 8) ELEGIBILIDADE — este set pode contar para o rating?
-- ============================================================
-- Calculada na leitura, não gravada. Assim não precisa de tarefa agendada
-- para "virar" o estado quando as 24h passam.

-- Trava 1: formato completo. 6-0..6-4, 7-5 ou 7-6 (tie-break).
create or replace function public.set_formato_completo(p_a smallint, p_b smallint)
returns boolean
language sql
immutable
as $$
  select (greatest(p_a, p_b) = 6 and least(p_a, p_b) <= 4)
      or (greatest(p_a, p_b) = 7 and least(p_a, p_b) in (5, 6));
$$;

-- Teto de plausibilidade: 1 set a cada 20 minutos de reserva (2h = 6 sets).
-- Não é regra de rating — é sanidade. Ninguém joga 20 sets em 2 horas.
create or replace function public.teto_de_sets(p_partida_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(1, floor(extract(epoch from (p.fim - p.inicio)) / 60 / 20)::int)
  from public.partidas p where p.id = p_partida_id;
$$;

-- Quantos participantes aceitos poderiam votar num set (todos menos os dois
-- em disputa: quem registrou e quem contestou).
create or replace function public.elegiveis_para_votar(p_set_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.partida_jogadores pj
  join public.sets s on s.id = p_set_id
  left join public.set_contestacoes c on c.set_id = s.id
  where pj.partida_id = s.partida_id
    and pj.estado = 'aceito'
    and pj.jogador_id is not null
    and pj.jogador_id <> s.registrado_por
    and (c.contestado_por is null or pj.jogador_id <> c.contestado_por);
$$;

-- O placar que vale hoje para este set, e se ele conta para rating.
-- Devolve: placar_a, placar_b, conta_para_rating, motivo.
create or replace function public.situacao_do_set(p_set_id uuid)
returns table (
  games_a smallint,
  games_b smallint,
  conta_para_rating boolean,
  motivo text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.sets;
  c public.set_contestacoes;
  v_partida public.partidas;
  v_elegiveis integer;
  v_orig integer;
  v_cont integer;
  v_corte integer;
begin
  select * into s from public.sets where id = p_set_id;
  if s.id is null then return; end if;

  select * into v_partida from public.partidas where id = s.partida_id;
  select * into c from public.set_contestacoes where set_id = p_set_id;

  -- Portão: declaração competitiva (congelada no início da partida).
  if not v_partida.competitiva then
    return query select s.games_a, s.games_b, false, 'AMISTOSA'::text;
    return;
  end if;

  -- Portão: origem no app. Trava universal — vale até para gamificação.
  if not exists (
    select 1 from public.reservas r
    where r.id = v_partida.reserva_id and r.origem = 'app'
  ) then
    return query select s.games_a, s.games_b, false, 'FORA_DO_APP'::text;
    return;
  end if;

  -- Sem contestação: silêncio vale como concordância, passadas as 24h.
  if c.id is null then
    if now() < s.registrado_em + interval '24 hours' then
      return query select s.games_a, s.games_b, false, 'AGUARDANDO_JANELA'::text;
    elsif not public.set_formato_completo(s.games_a, s.games_b) then
      return query select s.games_a, s.games_b, false, 'SET_INCOMPLETO'::text;
    else
      return query select s.games_a, s.games_b, true, 'ACEITO_POR_SILENCIO'::text;
    end if;
    return;
  end if;

  -- Com contestação: decide a votação, por mais de 50% dos ELEGÍVEIS.
  v_elegiveis := public.elegiveis_para_votar(p_set_id);
  select count(*) filter (where voto = 'original'),
         count(*) filter (where voto = 'contestado')
    into v_orig, v_cont
  from public.set_votos where set_id = p_set_id;

  v_corte := v_elegiveis / 2;  -- "mais de 50%" = estritamente maior que isto

  if v_orig > v_corte and public.set_formato_completo(s.games_a, s.games_b) then
    return query select s.games_a, s.games_b, true, 'VOTACAO_ORIGINAL'::text;
  elsif v_cont > v_corte and public.set_formato_completo(c.games_a, c.games_b) then
    return query select c.games_a, c.games_b, true, 'VOTACAO_CONTESTADO'::text;
  else
    -- Empate, votos insuficientes ou placar vencedor incompleto: nenhum conta.
    -- Os dois continuam visíveis no histórico.
    return query select s.games_a, s.games_b, false, 'EM_DISPUTA'::text;
  end if;
end;
$$;

revoke all on function public.situacao_do_set(uuid) from public, anon;
grant execute on function public.situacao_do_set(uuid) to authenticated;
revoke all on function public.teto_de_sets(uuid) from public, anon;
grant execute on function public.teto_de_sets(uuid) to authenticated;
revoke all on function public.elegiveis_para_votar(uuid) from public, anon;
grant execute on function public.elegiveis_para_votar(uuid) to authenticated;


-- ============================================================
-- 9) FUNÇÕES — as regras valem aqui, não na tela
-- ============================================================

-- Transforma uma reserva minha numa SESSÃO privada. A partir daí ela aceita
-- participantes convidados e sets. Quem só reserva quadra e não convida
-- ninguém não passa por aqui: não há sessão, não há set, não há rating.
create or replace function public.criar_sessao(
  p_reserva_id uuid,
  p_competitiva boolean default true,
  p_max_jogadores smallint default 4
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org uuid := auth.uid();
  v_reserva public.reservas;
  v_id uuid;
begin
  if v_org is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;
  if public.jogador_inadimplente(v_org) then
    raise exception 'PENDENCIA' using errcode = 'P0001';
  end if;

  select * into v_reserva from public.reservas where id = p_reserva_id;
  if v_reserva.id is null then
    raise exception 'RESERVA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_reserva.jogador_id <> v_org then
    raise exception 'SO_O_DONO_DA_RESERVA' using errcode = 'P0001';
  end if;
  -- Trava de origem: reserva de balcão nunca vira sessão que conta.
  if v_reserva.origem <> 'app' then
    raise exception 'FORA_DO_APP' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.partidas where reserva_id = p_reserva_id) then
    raise exception 'JA_EXISTE_PARTIDA' using errcode = 'P0001';
  end if;

  insert into public.partidas (
    reserva_id, organizador_id, tipo, competitiva, max_jogadores,
    quadra_id, inicio, fim, preco_centavos, status
  ) values (
    p_reserva_id, v_org, 'privada', p_competitiva, p_max_jogadores,
    v_reserva.quadra_id, v_reserva.inicio, v_reserva.fim,
    v_reserva.preco_centavos, 'aberta'
  )
  returning id into v_id;

  -- O organizador já entra aceito — ele não convida a si mesmo.
  insert into public.partida_jogadores (partida_id, jogador_id, papel, ordem, estado)
  values (v_id, v_org, 'jogador', 1, 'aceito');

  return v_id;
end;
$fn$;

-- Convida alguém QUE JÁ TEM CONTA. É aqui que a regra de conta obrigatória
-- passa a viver: até hoje ninguém era adicionado por terceiros.
-- (A Entrega B acrescenta o convite por telefone de quem ainda não tem conta.)
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
  v_ocupadas integer;
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

  -- Convite pendente e aceito ocupam vaga; recusado libera.
  select count(*) into v_ocupadas
  from public.partida_jogadores
  where partida_id = p_partida_id
    and papel = 'jogador'
    and estado in ('convidado', 'aceito');

  if v_ocupadas >= v_partida.max_jogadores then
    raise exception 'PARTIDA_CHEIA' using errcode = 'P0001';
  end if;

  insert into public.partida_jogadores (
    partida_id, jogador_id, papel, ordem, estado, convidado_por, convidado_em
  ) values (
    p_partida_id, p_jogador_id, 'jogador',
    coalesce((select max(ordem) from public.partida_jogadores where partida_id = p_partida_id), 0) + 1,
    'convidado', v_org, now()
  )
  on conflict (partida_id, jogador_id) do nothing;
end;
$fn$;

-- Aceitar ou recusar. Ninguém entra numa partida — e numa conta a pagar —
-- sem dizer sim.
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
end;
$fn$;

revoke all on function public.criar_sessao(uuid, boolean, smallint) from public, anon;
grant execute on function public.criar_sessao(uuid, boolean, smallint) to authenticated;
revoke all on function public.convidar_participante(uuid, uuid) from public, anon;
grant execute on function public.convidar_participante(uuid, uuid) to authenticated;
revoke all on function public.responder_convite(uuid, boolean) from public, anon;
grant execute on function public.responder_convite(uuid, boolean) to authenticated;


-- Registra um set. Qualquer participante aceito pode — entre um set e outro
-- sempre tem alguém do grupo com o celular na mão.
create or replace function public.registrar_set(
  p_partida_id uuid,
  p_a1 uuid, p_a2 uuid, p_b1 uuid, p_b2 uuid,
  p_games_a smallint, p_games_b smallint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  v_partida public.partidas;
  v_qtd integer;
  v_id uuid;
  v_p uuid;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_partida.status = 'cancelada' then
    raise exception 'PARTIDA_CANCELADA' using errcode = 'P0001';
  end if;
  if v_partida.inicio > now() then
    raise exception 'PARTIDA_NAO_COMECOU' using errcode = 'P0001';
  end if;
  -- Janela de 24h após o fim para registrar.
  if now() > v_partida.fim + interval '24 hours' then
    raise exception 'FORA_DA_JANELA' using errcode = 'P0001';
  end if;

  -- Quem registra precisa ser participante aceito.
  if not exists (
    select 1 from public.partida_jogadores
    where partida_id = p_partida_id and jogador_id = v_jog and estado = 'aceito'
  ) then
    raise exception 'SO_PARTICIPANTE_REGISTRA' using errcode = 'P0001';
  end if;

  -- Os quatro do set também precisam ser participantes aceitos.
  foreach v_p in array array[p_a1, p_a2, p_b1, p_b2] loop
    if not exists (
      select 1 from public.partida_jogadores
      where partida_id = p_partida_id and jogador_id = v_p and estado = 'aceito'
    ) then
      raise exception 'JOGADOR_NAO_ESTA_NA_SESSAO' using errcode = 'P0001';
    end if;
  end loop;

  -- Teto de plausibilidade física (1 set a cada 20 min de reserva).
  select count(*) into v_qtd from public.sets where partida_id = p_partida_id;
  if v_qtd >= public.teto_de_sets(p_partida_id) then
    raise exception 'TETO_DE_SETS' using errcode = 'P0001';
  end if;

  insert into public.sets (
    partida_id, ordem, a1, a2, b1, b2, games_a, games_b, registrado_por
  ) values (
    p_partida_id, v_qtd + 1, p_a1, p_a2, p_b1, p_b2, p_games_a, p_games_b, v_jog
  )
  returning id into v_id;

  -- Avisa os outros do set: eles têm 24h para contestar. Sem aviso, "silêncio
  -- vale como concordância" viraria arapuca para quem abre menos o app.
  insert into public.avisos (jogador_id, tipo, set_id)
  select distinct j, 'set_registrado', v_id
  from unnest(array[p_a1, p_a2, p_b1, p_b2]) as j
  where j <> v_jog;

  return v_id;
end;
$fn$;

-- Contestar exige propor OUTRO placar, não só discordar: vira uma alegação
-- concreta, que o grupo pode confrontar.
create or replace function public.contestar_set(
  p_set_id uuid,
  p_games_a smallint,
  p_games_b smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  s public.sets;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into s from public.sets where id = p_set_id;
  if s.id is null then
    raise exception 'SET_NAO_ENCONTRADO' using errcode = 'P0001';
  end if;
  if s.registrado_por = v_jog then
    raise exception 'QUEM_REGISTROU_NAO_CONTESTA' using errcode = 'P0001';
  end if;
  if now() > s.registrado_em + interval '24 hours' then
    raise exception 'FORA_DA_JANELA' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.partida_jogadores
    where partida_id = s.partida_id and jogador_id = v_jog and estado = 'aceito'
  ) then
    raise exception 'SO_PARTICIPANTE_CONTESTA' using errcode = 'P0001';
  end if;

  insert into public.set_contestacoes (set_id, contestado_por, games_a, games_b)
  values (p_set_id, v_jog, p_games_a, p_games_b);

  -- Abre a votação e avisa quem pode votar.
  insert into public.avisos (jogador_id, tipo, set_id)
  select pj.jogador_id, 'votacao_aberta', p_set_id
  from public.partida_jogadores pj
  where pj.partida_id = s.partida_id
    and pj.estado = 'aceito'
    and pj.jogador_id is not null
    and pj.jogador_id <> s.registrado_por
    and pj.jogador_id <> v_jog;

  update public.sets set ultimo_aviso_votacao = now() where id = p_set_id;
end;
$fn$;

-- Voto de desempate. Os dois em disputa não votam.
create or replace function public.votar_set(p_set_id uuid, p_voto text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  s public.sets;
  c public.set_contestacoes;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;
  if p_voto not in ('original', 'contestado') then
    raise exception 'VOTO_INVALIDO' using errcode = 'P0001';
  end if;

  select * into s from public.sets where id = p_set_id;
  select * into c from public.set_contestacoes where set_id = p_set_id;
  if c.id is null then
    raise exception 'SEM_CONTESTACAO' using errcode = 'P0001';
  end if;
  if v_jog in (s.registrado_por, c.contestado_por) then
    raise exception 'EM_DISPUTA_NAO_VOTA' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.partida_jogadores
    where partida_id = s.partida_id and jogador_id = v_jog and estado = 'aceito'
  ) then
    raise exception 'SO_PARTICIPANTE_VOTA' using errcode = 'P0001';
  end if;

  insert into public.set_votos (set_id, votante_id, voto)
  values (p_set_id, v_jog, p_voto)
  on conflict (set_id, votante_id) do update set voto = excluded.voto;
end;
$fn$;

-- Botão de avisar a votação: dispara para TODOS os elegíveis de uma vez, com
-- cooldown de 6h POR VOTAÇÃO (não por jogador). O cooldown individual
-- permitiria metralhar uma pessoa específica; o coletivo trata a votação como
-- o evento de grupo que ela é.
create or replace function public.avisar_votacao(p_set_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  s public.sets;
  c public.set_contestacoes;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into s from public.sets where id = p_set_id;
  select * into c from public.set_contestacoes where set_id = p_set_id;
  if c.id is null then
    raise exception 'SEM_CONTESTACAO' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.partida_jogadores
    where partida_id = s.partida_id and jogador_id = v_jog and estado = 'aceito'
  ) then
    raise exception 'SO_PARTICIPANTE_AVISA' using errcode = 'P0001';
  end if;
  if s.ultimo_aviso_votacao is not null
     and now() < s.ultimo_aviso_votacao + interval '6 hours' then
    raise exception 'COOLDOWN' using errcode = 'P0001';
  end if;

  -- Só quem ainda não votou.
  insert into public.avisos (jogador_id, tipo, set_id)
  select pj.jogador_id, 'votacao_aberta', p_set_id
  from public.partida_jogadores pj
  where pj.partida_id = s.partida_id
    and pj.estado = 'aceito'
    and pj.jogador_id is not null
    and pj.jogador_id <> s.registrado_por
    and pj.jogador_id <> c.contestado_por
    and not exists (
      select 1 from public.set_votos v
      where v.set_id = p_set_id and v.votante_id = pj.jogador_id
    );

  update public.sets set ultimo_aviso_votacao = now() where id = p_set_id;
end;
$fn$;

revoke all on function public.registrar_set(uuid, uuid, uuid, uuid, uuid, smallint, smallint) from public, anon;
grant execute on function public.registrar_set(uuid, uuid, uuid, uuid, uuid, smallint, smallint) to authenticated;
revoke all on function public.contestar_set(uuid, smallint, smallint) from public, anon;
grant execute on function public.contestar_set(uuid, smallint, smallint) to authenticated;
revoke all on function public.votar_set(uuid, text) from public, anon;
grant execute on function public.votar_set(uuid, text) to authenticated;
revoke all on function public.avisar_votacao(uuid) from public, anon;
grant execute on function public.avisar_votacao(uuid) to authenticated;
