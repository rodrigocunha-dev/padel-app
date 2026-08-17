-- ============================================================
-- 038 — LGPD: CONSENTIMENTO, EXPORTAÇÃO E EXCLUSÃO DE CONTA
-- ============================================================
-- Módulo 1.8. Regra nº 10 do CLAUDE.md desde o dia 1, e o que trava o
-- lançamento. Até aqui existia só privacidade POR DESIGN (RLS, telefone
-- fechado, agenda pública sem dado pessoal) — que é outra coisa: protege o
-- dado de terceiros, não dá direito ao titular.
--
-- ⚠️ POR QUE EXCLUIR É ANONIMIZAR, E NÃO APAGAR (decidido pelo fundador em
-- 17/08/2026, e confirmado no esquema antes de escrever isto):
--
-- Quase toda tabela aponta para `auth.users` com `on delete cascade` —
-- partida_jogadores, sets, set_votos, pagamentos, rating_jogadores. Apagar a
-- linha do login levaria junto os SETS que essa pessoa jogou, e o rating de
-- quem jogou com ela seria recalculado sem aqueles jogos.
--
-- Ou seja: apagar uma conta reescreveria a categoria de terceiros que não
-- pediram nada. É o oposto do que o app promete. Por isso a linha de
-- `auth.users` NUNCA é apagada — o que se apaga é a IDENTIDADE.


-- ============================================================
-- 1) CONSENTIMENTO
-- ============================================================
-- Guarda QUANDO a pessoa aceitou e QUAL versão do texto. A versão importa:
-- quando a política mudar, é preciso saber quem aceitou o quê, e pedir de
-- novo a quem só viu a versão antiga.

create table if not exists public.consentimentos (
  id         bigint generated always as identity primary key,
  jogador_id uuid not null references auth.users (id) on delete cascade,
  versao     text not null,
  aceito_em  timestamptz not null default now()
);

create index if not exists idx_consentimentos_jogador
  on public.consentimentos (jogador_id, aceito_em desc);

alter table public.consentimentos enable row level security;

-- Cada um vê e grava só o próprio. Não há update nem delete de propósito:
-- consentimento é histórico, não estado — apagar destruiria a prova de que
-- foi dado, que é justamente para o que ele serve.
drop policy if exists "consentimentos_le_proprio" on public.consentimentos;
create policy "consentimentos_le_proprio"
  on public.consentimentos for select
  to authenticated
  using ((select auth.uid()) = jogador_id);

drop policy if exists "consentimentos_grava_proprio" on public.consentimentos;
create policy "consentimentos_grava_proprio"
  on public.consentimentos for insert
  to authenticated
  with check ((select auth.uid()) = jogador_id);


-- ============================================================
-- 2) A MARCA DE CONTA ANONIMIZADA
-- ============================================================
-- ⚠️ Coluna nova em `jogadores` NASCE FECHADA para o app (a tabela é
-- revogada desde o `008` e as colunas liberadas uma a uma). Já esqueci
-- disso duas vezes — `categoria_inicial` e `codigo_convite`. Por isso o
-- `grant` vem logo abaixo, junto.

alter table public.jogadores
  add column if not exists anonimizado_em timestamptz;

grant select (anonimizado_em) on public.jogadores to authenticated;


-- ============================================================
-- 3) EXPORTAÇÃO — "me dê tudo que vocês têm sobre mim"
-- ============================================================
-- Devolve um JSON com os dados do próprio titular.
--
-- ⚠️ O que ele NÃO traz, de propósito: telefone de outras pessoas, e nada
-- de partida da qual o titular não participou. Exportar os dados de alguém
-- não pode virar uma porta para os dados dos outros. Onde o registro é
-- inevitavelmente compartilhado (um set tem quatro jogadores), vai o nome,
-- que a pessoa já vê na tela do jogo, e nunca o contato.

create or replace function public.meus_dados()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := auth.uid();
  resultado jsonb;
begin
  if eu is null then
    raise exception 'PRECISA_ESTAR_LOGADO';
  end if;

  select jsonb_build_object(
    'gerado_em', now(),
    'aviso', 'Estes são os dados que o app guarda sobre você. Nomes de outros jogadores aparecem porque fazem parte dos jogos que você jogou; o contato deles não é incluído.',

    'perfil', (
      select to_jsonb(j) - 'id'
      from public.jogadores j where j.id = eu
    ),

    'consentimentos', coalesce((
      select jsonb_agg(jsonb_build_object('versao', c.versao, 'aceito_em', c.aceito_em) order by c.aceito_em)
      from public.consentimentos c where c.jogador_id = eu
    ), '[]'::jsonb),

    'reservas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'inicio', r.inicio, 'fim', r.fim, 'status', r.status,
        'preco_centavos', r.preco_centavos,
        'quadra', q.nome, 'clube', cl.nome
      ) order by r.inicio desc)
      from public.reservas r
      join public.quadras q on q.id = r.quadra_id
      join public.clubes cl on cl.id = q.clube_id
      where r.jogador_id = eu
    ), '[]'::jsonb),

    'partidas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'inicio', p.inicio, 'fim', p.fim, 'tipo', p.tipo,
        'competitiva', p.competitiva, 'status', p.status,
        'meu_papel', pj.papel, 'meu_estado', pj.estado,
        'fui_organizador', (p.organizador_id = eu)
      ) order by p.inicio desc)
      from public.partida_jogadores pj
      join public.partidas p on p.id = pj.partida_id
      where pj.jogador_id = eu
    ), '[]'::jsonb),

    'sets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'quando', s.registrado_em, 'ordem', s.ordem,
        'games_a', s.games_a, 'games_b', s.games_b,
        'eu_registrei', (s.registrado_por = eu)
      ) order by s.registrado_em desc)
      from public.sets s
      where eu in (s.a1, s.a2, s.b1, s.b2) or s.registrado_por = eu
    ), '[]'::jsonb),

    'pagamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'valor_centavos', pg.valor_centavos, 'status', pg.status,
        'criado_em', pg.criado_em
      ) order by pg.criado_em desc)
      from public.pagamentos pg where pg.jogador_id = eu
    ), '[]'::jsonb),

    'rating', (
      select jsonb_build_object('categoria', j.categoria, 'nivel', j.nivel_categoria,
                                'em_calibracao', j.em_calibracao)
      from public.jogadores j where j.id = eu
    ),

    'avaliacoes_que_fiz', coalesce((
      select jsonb_agg(jsonb_build_object('nota', a.nota, 'comentario', a.comentario,
                                          'clube', cl.nome, 'criado_em', a.criado_em)
             order by a.criado_em desc)
      from public.avaliacoes a
      join public.clubes cl on cl.id = a.clube_id
      where a.jogador_id = eu
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$fn$;

revoke all on function public.meus_dados() from public, anon;
grant execute on function public.meus_dados() to authenticated;


-- ============================================================
-- 4) EXCLUSÃO DE CONTA — anonimização
-- ============================================================
-- O que some: nome, foto, telefone, cidade, disponibilidade, respostas da
-- calibração, avisos e as inscrições de notificação.
-- O que fica: os JOGOS, os pagamentos e o rating de todo mundo — sem
-- identidade ligada a eles. A pessoa vira "Jogador removido".

create or replace function public.anonimizar_minha_conta()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := auth.uid();
  v_clubes integer;
begin
  if eu is null then
    raise exception 'PRECISA_ESTAR_LOGADO';
  end if;

  -- Dono de clube não pode sumir e deixar o clube órfão: as quadras, a
  -- agenda e as reservas de outras pessoas dependem dele. Recusa explícita,
  -- em vez de apagar algo grande por tabela.
  select count(*) into v_clubes from public.clubes where dono_id = eu;
  if v_clubes > 0 then
    raise exception 'DONO_DE_CLUBE';
  end if;

  update public.jogadores set
    nome = 'Jogador removido',
    foto_url = null,
    telefone = '',
    cidade = '',
    posicao = null,
    disponibilidade = '[]'::jsonb,
    calibracao_respostas = null,
    anonimizado_em = now()
  where id = eu;

  -- Não têm valor para terceiros e são inequivocamente pessoais.
  delete from public.push_inscricoes where jogador_id = eu;
  delete from public.avisos where jogador_id = eu;

  -- ⚠️ O telefone também vive em `auth.users`, que é onde o login acontece.
  -- Deixá-lo lá seria guardar o dado justamente de quem pediu para sair — e
  -- ainda permitiria a pessoa entrar de novo na conta anonimizada.
  --
  -- A LINHA NÃO É APAGADA, só esvaziada: apagar dispararia o `on delete
  -- cascade` de meia dúzia de tabelas e levaria os jogos junto (ver o
  -- cabeçalho deste script).
  update auth.users set
    phone = null,
    phone_confirmed_at = null,
    email = null,
    raw_user_meta_data = '{}'::jsonb
  where id = eu;
end;
$fn$;

revoke all on function public.anonimizar_minha_conta() from public, anon;
grant execute on function public.anonimizar_minha_conta() to authenticated;


-- ============================================================
-- COMO CONFERIR
-- ============================================================
-- Ver os próprios dados (rode logado pelo app, não aqui):
--     select public.meus_dados();
--
-- Contas já anonimizadas:
--     select id, nome, anonimizado_em from public.jogadores
--     where anonimizado_em is not null;
--
-- Depois de anonimizar uma conta de teste, CONFERIR que os jogos ficaram:
--     select count(*) from public.sets;              -- não pode cair
--     select count(*) from public.partida_jogadores; -- não pode cair
