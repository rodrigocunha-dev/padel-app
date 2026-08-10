-- Sprint 5 (correção do 025) — o motor não estava trancado, e quebrava ao rodar
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- DOIS BUGS, ACHADOS TESTANDO O 025 PELO APP
-- ============================================================
--
-- BUG 1 — A FUNÇÃO ESTAVA ABERTA PARA QUALQUER PESSOA LOGADA.
-- O `025` termina com `revoke all on function ... from public, anon`, e a
-- intenção escrita ali era clara: "ninguém recalcula o próprio rating de
-- dentro da tela". Só que no Supabase o papel `authenticated` recebe
-- permissão por um caminho próprio, que aquele revoke não alcança — então
-- qualquer jogador logado conseguia disparar um recálculo COMPLETO do
-- rating de todo mundo. Não era furo de dado (a conta é a mesma), mas é um
-- botão caro exposto a quem não deveria ter acesso a ele.
--
-- Lição para os próximos scripts: `revoke ... from public, anon` NÃO basta
-- neste banco. Tem de citar `authenticated` explicitamente.
--
-- BUG 2 — A FUNÇÃO QUEBRAVA NA PRIMEIRA LINHA DE LIMPEZA.
-- Erro real ao chamar: `DELETE requires a WHERE clause`. Este banco tem uma
-- proteção contra DELETE/UPDATE sem WHERE — uma rede de segurança contra o
-- clássico "apaguei a tabela inteira sem querer". Ela é boa e não deve ser
-- desligada; o certo é o motor dizer explicitamente que quer apagar tudo.
--
-- As três limpezas do motor são intencionais: `rating_blocos` é refeita do
-- zero a cada recálculo (é o desenho — item 10), e as duas temporárias são
-- esvaziadas a cada dia processado. Agora dizem `where true`, que é a forma
-- de declarar "sim, tudo mesmo" sem desarmar a proteção.
--
-- ⚠️ Os dois só apareceram porque a função foi CHAMADA. Ler o script não
-- teria mostrado nenhum dos dois.

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

  delete from public.rating_blocos where true;  -- refazer do zero, sempre

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
    delete from _inicio where true;
    insert into _inicio select jogador_id, rating, rd from _estado;

    -- Cada set vira 4 linhas: uma por jogador, com a dupla adversária
    -- resumida em um adversário só.
    delete from _jogos where true;
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

-- Agora sim: fora do alcance do app. Quem dispara o recálculo é o servidor
-- (por ora, você no SQL Editor; depois, um agendamento).
revoke all on function public.recalcular_ratings() from public, anon, authenticated;

-- `sets_para_rating` é peça interna do motor pela mesma razão.
revoke all on function public.sets_para_rating() from public, anon, authenticated;


-- ============================================================
-- PARA RODAR O CÁLCULO
-- ============================================================
-- Aqui no SQL Editor, quando quiser recalcular:
--
--     select public.recalcular_ratings();
--
-- Devolve quantos blocos (jogador × dia) foram gerados. Zero significa que
-- nenhum set está válido ainda — os sets só contam 24h depois de
-- registrados, ou quando uma votação resolve a disputa.
