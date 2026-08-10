-- Sprint 5 — MOTOR DE RATING (Glicko-1)
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- O QUE ESTE SCRIPT FAZ
-- ============================================================
-- Implementa o desenho fechado com o fundador em 08/08/2026 (bloco "Motor
-- de rating" do CLAUDE.md). Em uma frase: **a conta é refeita do zero, em
-- ordem cronológica, em blocos de um dia, e o resultado fica guardado com
-- o histórico de quanto cada pessoa mudou e por quê.**
--
-- TODOS OS NÚMEROS SÃO PONTO DE PARTIDA AJUSTÁVEL. Eles moram na tabela
-- `rating_parametros`, não espalhados pelo código, justamente porque vão
-- mudar com os dados do beta. Trocar um número e mandar recalcular é a
-- operação normal, não uma cirurgia.
--
-- ⚠️ Com as contas de teste dá para provar que a conta está CORRETA
-- (ganhar de quem é melhor sobe mais; 6x0 pesa mais que 7x6; refazer do
-- zero dá sempre o mesmo resultado). Não dá para provar que ela está
-- JUSTA — isso só o beta responde.

-- ============================================================
-- 1) A ESCALA — 21 degraus de largura igual
-- ============================================================
-- Decisão do fundador (09/08/2026), com referência de mercado: LoL, Dota 2
-- e o Playtomic usam faixa FIXA, não relativa. Faixa relativa deixaria a
-- pessoa cair de categoria sem perder jogo nenhum, só porque outros
-- melhoraram — impossível de explicar, e briga com a regra nº 4.
--
-- 21 degraus (7 categorias × Forte/Médio/Fraco), largura igual. O degrau 0
-- é 7ª Fraco e o 20 é 1ª Forte.
--
--   rating do degrau i = ESCALA_BASE + PASSO × i
--
-- Com base 1000 e passo 50: de 1000 (7ª Fraco) a 2000 (1ª Forte), e o
-- centro cai exatamente em 1500 = **4ª Médio**, que é também o valor
-- inicial padrão do Glicko. Isso não foi escolhido: com larguras iguais, o
-- centro matemático é consequência.
--
-- ⚠️ A LARGURA NÃO É COSMÉTICA — ela é a alavanca do anti-farming.
-- Quanto mais larga, menos rende ganhar de quem está muito abaixo. Com
-- passo 50: uma categoria de distância (3 degraus = 150 pontos) dá ~70% de
-- chance de vitória; três categorias (9 degraus = 450) dá ~94%, então
-- vencer rende quase nada. Faixa mais larga protegeria ainda mais contra
-- farming, mas faria um 4ª x 5ª parecer mais desequilibrado do que é na
-- quadra de verdade. Este é o equilíbrio provisório; é exatamente o número
-- que a conversa das ÂNCORAS (jogadores de nível conhecido nos clubes
-- piloto) vai calibrar antes do beta.

create table if not exists public.rating_parametros (
  id boolean primary key default true check (id),  -- garante uma linha só

  -- Escala dos 21 degraus
  escala_base numeric not null default 1000,
  escala_passo numeric not null default 50,

  -- Glicko
  rd_inicial numeric not null default 150,   -- incerteza de quem nunca jogou
  rd_maximo numeric not null default 200,    -- teto que a inatividade alcança
  rd_minimo numeric not null default 50,     -- piso: nunca temos certeza total
  c_inatividade numeric not null default 6.5, -- ver item 18 (comentário abaixo)

  -- Pesos por contexto (unidade = o set comum, item 12)
  peso_sessao_privada numeric not null default 1.0,
  peso_aberta_competitiva numeric not null default 1.0,
  peso_liga numeric not null default 1.5,
  peso_torneio numeric not null default 2.5,

  -- Calibração (itens 6 e 17)
  peso_calibracao numeric not null default 1.0,
  calibracao_alvo numeric not null default 20,

  -- Teto do peso final (item 14)
  teto_peso numeric not null default 8.0,

  -- Fuso usado para fechar o "bloco de um dia" (item 11)
  fuso text not null default 'America/Sao_Paulo'
);

insert into public.rating_parametros (id) values (true)
on conflict (id) do nothing;

-- ============================================================
-- POR QUE ESTES NÚMEROS, E NÃO OS "PADRÃO" DO GLICKO
-- ============================================================
-- Os valores clássicos (RD inicial 350) foram medidos ANTES de escrever o
-- motor, com a fórmula rodando de verdade, e davam resultado absurdo aqui.
-- Dois motivos, os dois vale registrar porque não são óbvios:
--
-- 1) A ESCALA É ESTREITA. O Glicko nasceu no xadrez, onde os ratings se
--    espalham por ~1800 pontos. Nós empacotamos 21 degraus em 1000 pontos.
--    RD 350 numa escala dessas é enorme em proporção: uma única noite
--    atirava a pessoa 6 degraus (duas categorias), e um cadastro muito
--    errado jogava o número para FORA da escala (cheguei a ver -1467 e
--    +2752 nos testes). O número saía do intervalo e demorava a voltar.
--
-- 2) O MULTIPLICADOR DE CALIBRAÇÃO ERA CONTAR A MESMA COISA DUAS VEZES.
--    "Os primeiros jogos valem mais" (item 6) JÁ É o que a incerteza alta
--    faz — é o mecanismo nativo do Glicko, não algo que precisamos
--    acrescentar. Multiplicar o peso por 2 além disso aplicava a mesma
--    ideia em cima dela mesma, e era o que mais estourava a escala.
--    Por isso `peso_calibracao` nasce em **1,0 (desligado)**. O parâmetro
--    fica, para o caso de o beta mostrar convergência lenta demais; o
--    `peso_acumulado` continua sendo gravado, porque ele é quem responde
--    "já saiu da calibração?" (item 17) e alimenta a proteção de
--    rebaixamento (item 7). O conceito fica; o que sai é a contagem dupla.
--
-- Com RD inicial 150 e sem o multiplicador, medido: uma noite normal de 3
-- sets move ~2,5 degraus (menos de uma categoria), e um cadastro
-- grosseiramente errado se corrige em ~3 noites, sem nunca sair da escala.
--
-- `c_inatividade` = 6,5: quem estava bem estabelecido (RD 50) volta a ser
-- "incerto" (RD 100, metade do teto) depois de ~180 dias parado.
--   RD(t) = min(raiz(RD² + c² × dias), rd_maximo)
--   raiz(50² + 6,5² × 180) ≈ 100  ✔
-- ⚠️ Ponto de partida, não referência de mercado: a velocidade de
-- decaimento é escolha de cada sistema conforme o ritmo do esporte. Padel
-- de clube (jogo semanal) não se compara a xadrez.

alter table public.rating_parametros enable row level security;

drop policy if exists "parametros_leitura" on public.rating_parametros;
create policy "parametros_leitura"
  on public.rating_parametros for select to authenticated using (true);
-- Escrita só por quem tem acesso ao banco. Não é tela de app.


-- ============================================================
-- 2) DEGRAU ⇄ RATING ⇄ CATEGORIA
-- ============================================================
-- O degrau é o número de 0 a 20. A categoria (1 a 7) e o nível
-- (forte/medio/fraco) são duas leituras do mesmo degrau — nunca campos
-- independentes que possam divergir.
--
-- Ordem: degrau 0 = 7ª Fraco (mais fraco) … degrau 20 = 1ª Forte.
--   categoria = 7 - (degrau / 3)
--   nível     = fraco | medio | forte conforme degrau % 3

create or replace function public.degrau_de_categoria(
  p_categoria smallint, p_nivel text
)
returns smallint
language sql
immutable
as $$
  select ((7 - p_categoria) * 3
    + case p_nivel when 'fraco' then 0 when 'medio' then 1 else 2 end)::smallint;
$$;

create or replace function public.categoria_do_degrau(p_degrau smallint)
returns table (categoria smallint, nivel text)
language sql
immutable
as $$
  select (7 - (greatest(0, least(20, p_degrau)) / 3))::smallint,
         case greatest(0, least(20, p_degrau)) % 3
           when 0 then 'fraco' when 1 then 'medio' else 'forte' end;
$$;

create or replace function public.rating_do_degrau(p_degrau smallint)
returns numeric
language sql
stable
as $$
  select p.escala_base + p.escala_passo * greatest(0, least(20, p_degrau))
  from public.rating_parametros p;
$$;

-- O caminho de volta: o rating cai no degrau mais próximo. Fora da escala,
-- gruda nas pontas — ninguém fica sem categoria.
create or replace function public.degrau_do_rating(p_rating numeric)
returns smallint
language sql
stable
as $$
  select greatest(0, least(20,
    round((p_rating - p.escala_base) / p.escala_passo)::int
  ))::smallint
  from public.rating_parametros p;
$$;


-- ============================================================
-- 3) O FATOR DO PLACAR (item 15)
-- ============================================================
-- ⚠️ Esta parte é EXTENSÃO NOSSA, não Glicko publicado — o algoritmo é
-- desenhado para vitória/derrota. É o ponto do motor onde mais podemos
-- errar a mão, e por isso a faixa é estreita de propósito (0,8 a 1,3).
--
-- ⚠️ ARMADILHA QUE ISTO EVITA: tratar 6x4 como "60% de uma vitória". Se
-- fizéssemos isso, ganhar apertado de alguém muito mais fraco faria a
-- pessoa PERDER rating — venceu e caiu. Já quebrou sistemas de ranking
-- reais. Aqui quem ganhou vale vitória cheia SEMPRE; o placar mexe só no
-- quanto aquele set é levado em conta, para os dois lados.
create or replace function public.fator_do_placar(
  p_games_a smallint, p_games_b smallint
)
returns numeric
language sql
immutable
as $$
  select case abs(p_games_a - p_games_b)
    when 6 then 1.30   -- 6x0
    when 5 then 1.20   -- 6x1
    when 4 then 1.10   -- 6x2
    when 3 then 1.00   -- 6x3 · o neutro
    when 2 then 0.90   -- 6x4 e 7x5
    else 0.80          -- 7x6 (tie-break)
  end;
$$;


-- ============================================================
-- 4) ONDE O NÚMERO MORA
-- ============================================================
create table if not exists public.rating_jogadores (
  jogador_id uuid primary key references auth.users (id) on delete cascade,
  rating numeric not null,
  rd numeric not null,
  peso_acumulado numeric not null default 0,
  degrau smallint not null,
  jogou_em date,                 -- último dia com set válido
  calculado_em timestamptz not null default now()
);

alter table public.rating_jogadores enable row level security;

-- Rating é público entre jogadores logados: é o que permite ver o nível de
-- quem se quer convidar ou enfrentar. Mesma leitura já valia para a
-- categoria, que fica em `jogadores`.
drop policy if exists "rating_leitura" on public.rating_jogadores;
create policy "rating_leitura"
  on public.rating_jogadores for select to authenticated using (true);


-- ============================================================
-- 5) A TRANSPARÊNCIA (regra nº 4)
-- ============================================================
-- Sem isto o motor é uma caixa-preta, e a regra nº 4 — "após cada jogo,
-- mostrar quanto mudou e por quê" — não teria onde morar. Um bloco por
-- jogador por DIA (item 11), com os sets que o compuseram.
create table if not exists public.rating_blocos (
  id uuid primary key default gen_random_uuid(),
  jogador_id uuid not null references auth.users (id) on delete cascade,
  dia date not null,
  rating_antes numeric not null,
  rating_depois numeric not null,
  rd_antes numeric not null,
  rd_depois numeric not null,
  peso_do_bloco numeric not null,
  sets_no_bloco smallint not null,
  unique (jogador_id, dia)
);

create table if not exists public.rating_bloco_sets (
  bloco_id uuid not null references public.rating_blocos (id) on delete cascade,
  set_id uuid not null references public.sets (id) on delete cascade,
  venceu boolean not null,
  peso numeric not null,
  rating_adversarios numeric not null,  -- média da dupla adversária, no início do dia
  primary key (bloco_id, set_id)
);

alter table public.rating_blocos enable row level security;
alter table public.rating_bloco_sets enable row level security;

-- Cada um vê o próprio histórico de rating. O de terceiros, não: o número
-- atual é público, o caminho até ele não precisa ser.
drop policy if exists "blocos_leitura_dono" on public.rating_blocos;
create policy "blocos_leitura_dono"
  on public.rating_blocos for select to authenticated
  using (jogador_id = (select auth.uid()));

drop policy if exists "bloco_sets_leitura_dono" on public.rating_bloco_sets;
create policy "bloco_sets_leitura_dono"
  on public.rating_bloco_sets for select to authenticated
  using (exists (
    select 1 from public.rating_blocos b
    where b.id = rating_bloco_sets.bloco_id
      and b.jogador_id = (select auth.uid())
  ));


-- ============================================================
-- 6) OS SETS QUE ENTRAM NA CONTA
-- ============================================================
-- O motor NÃO reimplementa nenhuma regra de validade, contestação ou
-- votação: ele pergunta ao `situacao_do_set`, que já é a autoridade sobre
-- qual placar vale e se conta. Se a regra mudar lá, o motor acompanha.
--
-- O peso do contexto sai da tabela de parâmetros. Liga e torneio ainda não
-- existem como tipo de partida — os parâmetros já estão lá para quando
-- existirem, e hoje todo set válido pesa 1,0.
create or replace function public.sets_para_rating()
returns table (
  set_id uuid,
  dia date,
  a1 uuid, a2 uuid, b1 uuid, b2 uuid,
  games_a smallint, games_b smallint,
  peso_base numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id,
         (p.inicio at time zone par.fuso)::date,
         s.a1, s.a2, s.b1, s.b2,
         sit.games_a, sit.games_b,
         case p.tipo
           when 'privada' then par.peso_sessao_privada
           else par.peso_aberta_competitiva
         end * public.fator_do_placar(sit.games_a, sit.games_b)
  from public.sets s
  join public.partidas p on p.id = s.partida_id
  cross join public.rating_parametros par
  cross join lateral public.situacao_do_set(s.id) sit
  where sit.conta_para_rating
  order by (p.inicio at time zone par.fuso)::date, p.inicio, s.ordem;
$$;

revoke all on function public.sets_para_rating() from public, anon;


-- ============================================================
-- 7) O MOTOR
-- ============================================================
-- Glicko-1 (o original), não Glicko-2. O Glicko-2 acrescenta volatilidade e
-- exige uma constante de sistema que só se calibra com dados reais — não
-- temos nenhum, e calibrar no chute sai pior que não usar. O decaimento por
-- inatividade, ao contrário do que se costuma pensar, NÃO é do Glicko-2:
-- está no original, e é o `c_inatividade` acima.
--
-- Por que refazer do ZERO em vez de somar conforme cada set fica pronto:
-- um set não fica pronto quando é registrado. Ele vira válido 24h depois,
-- ou quando a votação resolve — e a votação pode TROCAR o placar. Logo os
-- resultados ficam prontos fora de ordem, e somar faria o número de uma
-- pessoa depender de QUANDO os outros resolveram suas disputas.
--
-- Dupla: o adversário é tratado como um oponente só, com rating e RD
-- médios dos dois. É uma simplificação consciente (o rigoroso combinaria as
-- variâncias); com a precisão que temos, não muda o resultado prático.
create or replace function public.recalcular_ratings()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  par public.rating_parametros;
  q constant numeric := 0.0057564627324851142;  -- ln(10)/400
  pi2 constant numeric := 9.8696044010893586;   -- π²
  v_dia date;
  v_bloco_id uuid;
  r record;
  v_blocos integer := 0;
begin
  select * into par from public.rating_parametros;

  -- Se a função for chamada duas vezes dentro da mesma transação, as tabelas
  -- temporárias da chamada anterior ainda existem. Barato de prevenir.
  drop table if exists _estado;
  drop table if exists _inicio;
  drop table if exists _jogos;
  drop table if exists _sets;

  -- Estado corrente de cada jogador durante a varredura.
  create temp table _estado (
    jogador_id uuid primary key,
    rating numeric, rd numeric, peso numeric, jogou_em date
  ) on commit drop;

  -- Estado congelado no início do dia. É contra ESTE que o dia inteiro é
  -- julgado — é o que impede o set 1 da noite de "engordar" você antes do
  -- set 2 da mesma noite (item 11).
  create temp table _inicio (
    jogador_id uuid primary key, rating numeric, rd numeric
  ) on commit drop;

  -- Os jogos de um dia, já vistos do ponto de vista de cada jogador.
  create temp table _jogos (
    jogador_id uuid, set_id uuid, venceu boolean,
    adv_rating numeric, adv_rd numeric, peso numeric
  ) on commit drop;

  -- Todo mundo parte do degrau escolhido no cadastro, com incerteza máxima.
  -- A incerteza NÃO é reduzida pelas respostas do questionário: RD
  -- significa "quanta evidência nós temos", e questionário é alegação, não
  -- evidência. Quem mente no cadastro é corrigido rápido justamente porque
  -- todo mundo começa incerto.
  insert into _estado (jogador_id, rating, rd, peso, jogou_em)
  select j.id,
         public.rating_do_degrau(
           public.degrau_de_categoria(j.categoria, j.nivel_categoria)
         ),
         par.rd_inicial, 0, null
  from public.jogadores j
  where j.categoria is not null;

  -- Os sets válidos, lidos UMA vez. `situacao_do_set` consulta contestação
  -- e votos a cada chamada; reler a cada dia multiplicaria isso à toa.
  create temp table _sets on commit drop as
    select * from public.sets_para_rating();

  delete from public.rating_blocos;  -- refazer do zero, sempre

  for v_dia in select distinct s.dia from _sets s order by 1
  loop
    -- A incerteza cresce com o tempo parado, ANTES de julgar o dia.
    update _estado e
    set rd = least(par.rd_maximo,
                   sqrt(e.rd * e.rd + par.c_inatividade * par.c_inatividade
                        * (v_dia - e.jogou_em)))
    where e.jogou_em is not null;

    -- Congela o estado do início do dia. É contra ELE que o dia inteiro é
    -- julgado, e por isso a cópia vem depois do crescimento do RD.
    delete from _inicio;
    insert into _inicio select jogador_id, rating, rd from _estado;

    -- Cada set vira 4 linhas: uma por jogador, com a dupla adversária
    -- resumida em um adversário só.
    delete from _jogos;
    insert into _jogos (jogador_id, set_id, venceu, adv_rating, adv_rd, peso)
    select v.jogador_id, s.set_id, v.venceu,
           (ia.rating + ib.rating) / 2, (ia.rd + ib.rd) / 2,
           least(par.teto_peso,
                 s.peso_base * case when est.peso < par.calibracao_alvo
                                    then par.peso_calibracao else 1 end)
    from _sets s
    cross join lateral (values
      (s.a1, s.games_a > s.games_b, s.b1, s.b2),
      (s.a2, s.games_a > s.games_b, s.b1, s.b2),
      (s.b1, s.games_b > s.games_a, s.a1, s.a2),
      (s.b2, s.games_b > s.games_a, s.a1, s.a2)
    ) as v(jogador_id, venceu, adv1, adv2)
    join _inicio ia on ia.jogador_id = v.adv1
    join _inicio ib on ib.jogador_id = v.adv2
    join _estado est on est.jogador_id = v.jogador_id
    where s.dia = v_dia;

    -- A conta do Glicko, jogador a jogador, com todos os jogos do dia de
    -- uma vez. O peso multiplica a contribuição de cada jogo.
    for r in
      select j.jogador_id,
             i.rating as r0, i.rd as rd0,
             sum(j.peso) as peso_total,
             -- g(RD) do adversário
             sum(
               power(1 / sqrt(1 + 3 * q * q * j.adv_rd * j.adv_rd / pi2), 2)
               * (1 / (1 + power(10, -(1 / sqrt(1 + 3 * q * q * j.adv_rd * j.adv_rd / pi2))
                                 * (i.rating - j.adv_rating) / 400)))
               * (1 - (1 / (1 + power(10, -(1 / sqrt(1 + 3 * q * q * j.adv_rd * j.adv_rd / pi2))
                                 * (i.rating - j.adv_rating) / 400))))
               * j.peso
             ) as soma_info,
             sum(
               (1 / sqrt(1 + 3 * q * q * j.adv_rd * j.adv_rd / pi2))
               * ((case when j.venceu then 1 else 0 end)
                  - (1 / (1 + power(10, -(1 / sqrt(1 + 3 * q * q * j.adv_rd * j.adv_rd / pi2))
                                 * (i.rating - j.adv_rating) / 400))))
               * j.peso
             ) as soma_desvio,
             count(*) as qtd
      from _jogos j
      join _inicio i on i.jogador_id = j.jogador_id
      group by j.jogador_id, i.rating, i.rd
    loop
      declare
        v_d2 numeric;
        v_denom numeric;
        v_novo_rating numeric;
        v_novo_rd numeric;
      begin
        if r.soma_info <= 0 then
          continue;  -- sem informação (adversário idêntico e certo): nada muda
        end if;
        v_d2 := 1 / (q * q * r.soma_info);
        v_denom := 1 / (r.rd0 * r.rd0) + 1 / v_d2;
        v_novo_rating := r.r0 + (q / v_denom) * r.soma_desvio;
        v_novo_rd := greatest(par.rd_minimo, sqrt(1 / v_denom));

        insert into public.rating_blocos (
          jogador_id, dia, rating_antes, rating_depois,
          rd_antes, rd_depois, peso_do_bloco, sets_no_bloco
        ) values (
          r.jogador_id, v_dia, r.r0, v_novo_rating,
          r.rd0, v_novo_rd, r.peso_total, r.qtd
        )
        returning id into v_bloco_id;

        insert into public.rating_bloco_sets (bloco_id, set_id, venceu, peso, rating_adversarios)
        select v_bloco_id, j.set_id, j.venceu, j.peso, j.adv_rating
        from _jogos j where j.jogador_id = r.jogador_id;

        update _estado
        set rating = v_novo_rating, rd = v_novo_rd,
            peso = peso + r.peso_total, jogou_em = v_dia
        where jogador_id = r.jogador_id;

        v_blocos := v_blocos + 1;
      end;
    end loop;
  end loop;

  -- A incerteza de hoje: quem parou de jogar continua ficando mais incerto
  -- mesmo sem bloco novo. Sem este passo, o número na tela seria o do
  -- último dia jogado, e a inatividade só apareceria quando a pessoa
  -- voltasse — tarde demais para servir de gatilho.
  update _estado e
  set rd = least(par.rd_maximo,
                 sqrt(e.rd * e.rd + par.c_inatividade * par.c_inatividade
                      * (current_date - e.jogou_em)))
  where e.jogou_em is not null;

  insert into public.rating_jogadores (
    jogador_id, rating, rd, peso_acumulado, degrau, jogou_em, calculado_em
  )
  select jogador_id, rating, rd, peso,
         public.degrau_do_rating(rating), jogou_em, now()
  from _estado
  on conflict (jogador_id) do update
  set rating = excluded.rating, rd = excluded.rd,
      peso_acumulado = excluded.peso_acumulado, degrau = excluded.degrau,
      jogou_em = excluded.jogou_em, calculado_em = excluded.calculado_em;

  return v_blocos;
end;
$fn$;

revoke all on function public.recalcular_ratings() from public, anon;
-- Quem dispara o recálculo é o servidor, não o app. Sem grant para
-- `authenticated`: ninguém recalcula o próprio rating de dentro da tela.


-- ============================================================
-- O QUE AINDA NÃO ESTÁ AQUI (de propósito)
-- ============================================================
-- · QUANDO o recálculo roda. Por ora é chamada manual. Agendar (pg_cron ou
--   um gatilho de fora) é peça própria, e depende de decidir a frequência —
--   que por sua vez depende do bloco diário: não adianta recalcular de hora
--   em hora se o bloco é de um dia.
-- · A proteção de rebaixamento (item 7). Ela precisa do peso acumulado, que
--   este script já grava — mas é regra de APRESENTAÇÃO da categoria, não do
--   rating, e entra junto com a tela.
-- · Liga e torneio. Os pesos existem nos parâmetros; os tipos de partida,
--   não. Quando existirem, é só passar a ler `p.tipo`.
