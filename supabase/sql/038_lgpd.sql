-- ============================================================
-- 038 — LGPD + IDENTIFICAÇÃO DO CLIENTE PARA O CLUBE
-- ============================================================
-- Módulo 1.8. Regra nº 10 do CLAUDE.md desde o dia 1, e o que trava o
-- lançamento. Até aqui existia só privacidade POR DESIGN (RLS, telefone
-- fechado, agenda pública sem dado pessoal) — que é outra coisa: protege o
-- dado de terceiros, não dá direito a quem é DONO do dado.
--
-- Este script faz duas coisas que parecem opostas e não são:
--   (1) dá ao jogador o direito de levar seus dados e de sumir do app;
--   (2) garante ao clube o registro de quem reservou e quem pagou.
--
-- Elas convivem porque o produto tem DOIS lados: app para o jogador, SaaS de
-- gestão para o clube. O que o jogador apaga é a IDENTIDADE dele no app; o
-- que o clube guarda é o REGISTRO DE UMA TRANSAÇÃO, com base legal própria
-- (obrigação fiscal e contábil).
--
-- ⚠️ POR QUE EXCLUIR É ANONIMIZAR, E NÃO APAGAR — conferido no esquema antes
-- de escrever: quase toda tabela aponta para `auth.users` com `on delete
-- cascade` (partida_jogadores, sets, set_votos, pagamentos, rating_jogadores).
-- Apagar a linha do login levaria junto os SETS que a pessoa jogou, e o
-- rating de quem jogou com ela seria recalculado sem aqueles jogos. Ou seja:
-- apagar uma conta reescreveria a categoria de terceiros que não pediram
-- nada. Por isso a linha de `auth.users` nunca é apagada — só esvaziada.


-- ============================================================
-- 1) DADOS FISCAIS DO JOGADOR — todos OPCIONAIS por enquanto
-- ============================================================
-- Decisão do fundador (17/08/2026): a emissão de nota/cupom vai entrar
-- quando o SaaS amadurecer, e acrescentar coluna depois, com histórico já
-- acumulado, é o caro. Então os campos nascem agora e ficam opcionais até a
-- emissão ser ligada.
--
-- `nome_completo` existe separado de `nome` porque o nome de exibição pode
-- ser apelido ("Vitão"), e a nota precisa do nome de registro.
--
-- Endereço é para nota de SERVIÇO (NFS-e), que é o caso de aluguel de
-- quadra em boa parte dos municípios. No cupom (NFC-e) não faz falta.

alter table public.jogadores
  add column if not exists nome_completo text,
  add column if not exists cpf text,
  add column if not exists email text,
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade_fiscal text,
  add column if not exists uf text,
  add column if not exists anonimizado_em timestamptz;

-- ⚠️ NENHUM `grant` nas colunas fiscais, e isso é a decisão.
--
-- A tabela `jogadores` é legível por QUALQUER pessoa logada (é assim que a
-- busca por nome acha quem convidar). Liberar `cpf` por `grant` deixaria o
-- CPF de todo mundo visível para todo mundo. O padrão do projeto para este
-- caso já existe (foi o do `codigo_convite`, no script 035): o dado fica
-- fechado e volta por FUNÇÃO, que devolve só o do próprio dono.
--
-- `anonimizado_em` é a exceção: não é sensível e a tela precisa saber.
grant select (anonimizado_em) on public.jogadores to authenticated;


-- ============================================================
-- 2) CONSENTIMENTO
-- ============================================================
-- Guarda QUANDO a pessoa aceitou e QUAL versão do texto. A versão importa:
-- quando a política mudar, é preciso saber quem aceitou o quê e pedir de
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

-- Sem update e sem delete, de propósito: consentimento é histórico, não
-- estado. Apagar destruiria a prova de que foi dado — que é para o que ele
-- serve.
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
-- 3) A FOTOGRAFIA DO PAGADOR
-- ============================================================
-- O registro financeiro do clube não pode depender de um perfil que muda.
-- Se a pessoa trocar de nome amanhã, o recibo do ano passado não pode mudar
-- junto — e se ela apagar a conta, o recibo não pode virar "Jogador
-- removido" na contabilidade do clube.
--
-- Então o pagamento COPIA quem pagou, no instante em que pagou.
--
-- ⚠️ A costura entre as fotografias é o `jogador_id`, que já existia e nunca
-- muda: o recibo de março diz "Vitor Felipe" e o de agosto diz "Vitor", mas
-- os dois carregam o mesmo código de conta. Fotografia = quem a pessoa ERA;
-- código = quem ela É.

alter table public.pagamentos
  add column if not exists pagador_nome text,
  add column if not exists pagador_telefone text,
  add column if not exists pagador_cpf text,
  add column if not exists pagador_email text;

create or replace function public.pagamento_fotografa_pagador()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  select j.nome, j.telefone, j.cpf, j.email
    into new.pagador_nome, new.pagador_telefone, new.pagador_cpf, new.pagador_email
  from public.jogadores j
  where j.id = new.jogador_id;

  return new;
end;
$fn$;

-- BEFORE INSERT: a fotografia é tirada uma vez, no nascimento da linha. Em
-- UPDATE não se mexe — senão o recibo antigo seria reescrito, que é
-- exatamente o que estamos evitando.
drop trigger if exists trg_pagamento_fotografa on public.pagamentos;
create trigger trg_pagamento_fotografa
  before insert on public.pagamentos
  for each row execute function public.pagamento_fotografa_pagador();

-- ⚠️ As colunas novas ficam FECHADAS para o app: os outros jogadores da
-- partida enxergam os pagamentos dela (é o "caderninho" de quem pagou), e
-- sem isto passariam a enxergar também o CPF e o telefone uns dos outros.
-- O clube recebe esses dados por função, mais abaixo.
--
-- Revogar a TABELA antes é obrigatório: permissão de tabela cobre todas as
-- colunas, então `revoke` só da coluna não faz nada (lição do script 035).
-- Conferido antes: nenhuma consulta do app usa `select *` em pagamentos.
revoke select, insert, update on public.pagamentos from anon, authenticated;
grant select (id, partida_id, jogador_id, valor_centavos, status, provedor,
              cobranca_externa_id, qr_code, copia_e_cola, pago_em, criado_em)
  on public.pagamentos to authenticated;
grant insert (partida_id, jogador_id, valor_centavos, status, provedor,
              cobranca_externa_id, qr_code, copia_e_cola)
  on public.pagamentos to authenticated;
grant update (status, pago_em, valor_centavos, provedor,
              cobranca_externa_id, qr_code, copia_e_cola)
  on public.pagamentos to authenticated;


-- ============================================================
-- 4) O CLUBE PASSA A IDENTIFICAR QUEM RESERVOU PELO APP
-- ============================================================
-- Decisão do fundador (17/08/2026). Até aqui o clube só tinha nome e
-- telefone de quem reservava no BALCÃO; quem reservava pelo app aparecia só
-- pelo nome, por ligação com o perfil.
--
-- É uma porta que o Sprint 4 fechou de propósito — mas o que ela protegia
-- era jogador contra jogador. O clube é a outra ponta do negócio: está
-- alugando a quadra para aquela pessoa, e já anota isso no balcão.
--
-- As colunas `cliente_nome` e `cliente_telefone` já existiam para o balcão.
-- Reaproveitá-las faz a reserva do app virar um registro auto-suficiente,
-- que também sobrevive à anonimização.

create or replace function public.reserva_fotografa_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Só para reserva do app com dono identificado; a de balcão já vem com os
  -- campos preenchidos à mão pelo clube.
  if new.jogador_id is not null and new.cliente_nome is null then
    select j.nome, j.telefone
      into new.cliente_nome, new.cliente_telefone
    from public.jogadores j
    where j.id = new.jogador_id;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_reserva_fotografa on public.reservas;
create trigger trg_reserva_fotografa
  before insert on public.reservas
  for each row execute function public.reserva_fotografa_cliente();


-- ============================================================
-- 5) O EXTRATO DO CLUBE
-- ============================================================
-- Por função, e não por política de tabela, porque o clube precisa ver
-- colunas que os jogadores não podem ver. É também o alicerce dos
-- relatórios do clube (Entrega 2).

create or replace function public.pagamentos_do_clube(
  p_clube_id uuid,
  p_de timestamptz default now() - interval '90 days',
  p_ate timestamptz default now()
)
returns table (
  pagamento_id uuid,
  quando timestamptz,
  jogador_id uuid,
  nome text,
  telefone text,
  cpf text,
  email text,
  valor_centavos integer,
  status text,
  quadra text,
  inicio timestamptz
)
language sql
security definer
set search_path = public
stable
as $fn$
  select pg.id, pg.criado_em, pg.jogador_id,
         -- Preferir a FOTOGRAFIA: é quem a pessoa era na hora da transação.
         -- O perfil de hoje é só o remendo para linhas antigas, anteriores
         -- a este script.
         coalesce(pg.pagador_nome, j.nome),
         coalesce(pg.pagador_telefone, j.telefone),
         pg.pagador_cpf,
         pg.pagador_email,
         pg.valor_centavos, pg.status,
         q.nome, p.inicio
  from public.pagamentos pg
  join public.partidas p on p.id = pg.partida_id
  join public.quadras q on q.id = p.quadra_id
  left join public.jogadores j on j.id = pg.jogador_id
  where q.clube_id = p_clube_id
    and pg.criado_em between p_de and p_ate
    -- Só o dono do clube. Sem isto, qualquer pessoa logada leria o extrato
    -- de qualquer clube passando o id na mão.
    and exists (
      select 1 from public.clubes c
      where c.id = p_clube_id and c.dono_id = (select auth.uid())
    )
  order by pg.criado_em desc;
$fn$;

revoke all on function public.pagamentos_do_clube(uuid, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.pagamentos_do_clube(uuid, timestamptz, timestamptz)
  to authenticated;


-- ============================================================
-- 6) O JOGADOR VÊ E EDITA OS PRÓPRIOS DADOS FISCAIS
-- ============================================================
-- Por função porque as colunas estão fechadas (ver a seção 1).

create or replace function public.meus_dados_fiscais()
returns jsonb
language sql
security definer
set search_path = public
stable
as $fn$
  select to_jsonb(x) from (
    select nome_completo, cpf, email, cep, logradouro, numero,
           complemento, bairro, cidade_fiscal, uf
    from public.jogadores where id = (select auth.uid())
  ) x;
$fn$;

create or replace function public.salvar_dados_fiscais(
  p_nome_completo text default null,
  p_cpf text default null,
  p_email text default null,
  p_cep text default null,
  p_logradouro text default null,
  p_numero text default null,
  p_complemento text default null,
  p_bairro text default null,
  p_cidade text default null,
  p_uf text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := (select auth.uid());
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g'), '');
begin
  if eu is null then
    raise exception 'PRECISA_ESTAR_LOGADO';
  end if;

  -- Só o formato. Validar dígito verificador fica para quando a emissão
  -- fiscal existir — hoje seria travar o cadastro sem nada usar o dado.
  if v_cpf is not null and length(v_cpf) <> 11 then
    raise exception 'CPF_INVALIDO';
  end if;

  update public.jogadores set
    nome_completo = p_nome_completo,
    cpf = v_cpf,
    email = p_email,
    cep = nullif(regexp_replace(coalesce(p_cep, ''), '[^0-9]', '', 'g'), ''),
    logradouro = p_logradouro,
    numero = p_numero,
    complemento = p_complemento,
    bairro = p_bairro,
    cidade_fiscal = p_cidade,
    uf = upper(nullif(p_uf, ''))
  where id = eu;
end;
$fn$;

revoke all on function public.meus_dados_fiscais() from public, anon;
grant execute on function public.meus_dados_fiscais() to authenticated;
revoke all on function public.salvar_dados_fiscais(text,text,text,text,text,text,text,text,text,text)
  from public, anon;
grant execute on function public.salvar_dados_fiscais(text,text,text,text,text,text,text,text,text,text)
  to authenticated;


-- ============================================================
-- 7) EXPORTAÇÃO — "me dê tudo que vocês têm sobre mim"
-- ============================================================
-- ⚠️ O que ela NÃO traz, de propósito: contato de outras pessoas, e nada de
-- partida da qual o titular não participou. Exportar os dados de alguém não
-- pode virar porta para os dados dos outros. Onde o registro é
-- inevitavelmente compartilhado (um set tem quatro jogadores), vai o nome,
-- que a pessoa já vê na tela do jogo, e nunca o contato.

create or replace function public.meus_dados()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := (select auth.uid());
  resultado jsonb;
begin
  if eu is null then
    raise exception 'PRECISA_ESTAR_LOGADO';
  end if;

  select jsonb_build_object(
    'gerado_em', now(),
    'aviso', 'Estes sao os dados que o app guarda sobre voce. Nomes de outros jogadores aparecem porque fazem parte dos jogos que voce jogou; o contato deles nao e incluido.',

    'perfil', (
      select to_jsonb(j) - 'id' from public.jogadores j where j.id = eu
    ),

    'consentimentos', coalesce((
      select jsonb_agg(jsonb_build_object('versao', c.versao, 'aceito_em', c.aceito_em) order by c.aceito_em)
      from public.consentimentos c where c.jogador_id = eu
    ), '[]'::jsonb),

    'reservas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'inicio', r.inicio, 'fim', r.fim, 'status', r.status,
        'preco_centavos', r.preco_centavos, 'quadra', q.nome, 'clube', cl.nome
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

    'categoria', (
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
-- 8) EXCLUSÃO DE CONTA — anonimização
-- ============================================================
-- Some: nome, foto, telefone, cidade, preferências, dados fiscais do
-- PERFIL, avisos e inscrições de notificação.
-- Fica: os JOGOS, e a fotografia de cada transação já feita — que é do
-- registro do clube, com base legal própria.

create or replace function public.anonimizar_minha_conta()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := (select auth.uid());
  v_clubes integer;
begin
  if eu is null then
    raise exception 'PRECISA_ESTAR_LOGADO';
  end if;

  -- ⚠️ DÍVIDA ABERTA BLOQUEIA (decisão do fundador, 17/08/2026).
  --
  -- Sem esta trava existe a saída perfeita para o caloteiro: apagar a conta,
  -- recadastrar com o MESMO telefone (que esta função libera do login),
  -- receber um código de conta novo e voltar limpo. A dívida ficaria órfã
  -- numa conta anônima, fora do alcance do bloqueio de inadimplente.
  if public.jogador_inadimplente(eu) then
    raise exception 'TEM_DIVIDA';
  end if;

  -- Dono de clube não pode sumir e deixar o clube órfão: quadras, agenda e
  -- reservas de outras pessoas dependem dele.
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
    nome_completo = null,
    cpf = null,
    email = null,
    cep = null, logradouro = null, numero = null, complemento = null,
    bairro = null, cidade_fiscal = null, uf = null,
    anonimizado_em = now()
  where id = eu;

  delete from public.push_inscricoes where jogador_id = eu;
  delete from public.avisos where jogador_id = eu;

  -- ⚠️ O telefone também vive em `auth.users`, que é onde o login acontece.
  -- Deixá-lo lá seria guardar o dado justamente de quem pediu para sair — e
  -- permitiria a pessoa entrar de novo na conta anonimizada.
  --
  -- A LINHA NÃO É APAGADA, só esvaziada: apagar dispararia o `on delete
  -- cascade` de meia dúzia de tabelas e levaria os jogos junto.
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
-- Contas anonimizadas:
--     select id, nome, anonimizado_em from public.jogadores
--     where anonimizado_em is not null;
--
-- Depois de anonimizar uma conta de teste, os jogos NÃO podem cair:
--     select count(*) from public.sets;
--     select count(*) from public.partida_jogadores;
--
-- E o extrato do clube tem que continuar sabendo quem era (rodar logado
-- como dono do clube, pelo app):
--     select * from public.pagamentos_do_clube('<id-do-clube>');
