-- Sprint 5 — o placar de cada set na trilha
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- O DEFEITO QUE ISTO CORRIGE
-- ============================================================
-- O fundador olhou a trilha e perguntou: por que dois sets com a MESMA
-- explicação renderam valores diferentes (+9,4 e +10,3)?
--
-- A resposta era o placar — 6x3 (fator 1,00) contra 6x2 (fator 1,10), e
-- 9,4 × 1,10 = 10,3. O motor estava certo. A TELA é que não mostrava o
-- placar, então duas linhas idênticas exibiam números diferentes sem
-- explicação. Isso é exatamente o oposto do que a regra nº 4 pede: a
-- explicação precisa se explicar sozinha.
--
-- ⚠️ POR QUE GRAVAR, EM VEZ DE LER DA TABELA `sets`:
-- quando uma contestação é resolvida por votação, o placar que VALE pode
-- não ser o que foi registrado. Se a tela lesse `sets.games_a/games_b`,
-- mostraria um placar diferente do que o motor usou para calcular — a
-- explicação passaria a contradizer a conta. Aqui fica o placar válido, do
-- ponto de vista de quem está olhando.

alter table public.rating_bloco_sets
  add column if not exists games_meus smallint,
  add column if not exists games_deles smallint;

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

  drop table if exists _estado;
  drop table if exists _inicio;
  drop table if exists _jogos;
  drop table if exists _sets;

  create temp table _estado (
    jogador_id uuid primary key,
    rating numeric, rd numeric, peso numeric, jogou_em date,
    degrau_exibido smallint, peso_abaixo numeric
  ) on commit drop;

  create temp table _inicio (
    jogador_id uuid primary key, rating numeric, rd numeric
  ) on commit drop;

  -- Agora com o parceiro: a expectativa sai da força da DUPLA contra a
  -- dupla adversária, e não do jogador sozinho contra a média dos outros.
  create temp table _jogos (
    jogador_id uuid, set_id uuid, venceu boolean,
    meu_time numeric,          -- (eu + parceiro) / 2, no início do dia
    adv_time numeric,          -- (adv1 + adv2) / 2, no início do dia
    adv_rd numeric,
    parceiro_rating numeric,
    peso numeric,
    -- O placar VÁLIDO, do ponto de vista de quem está na linha. Guardado
    -- aqui porque quando uma votação resolve uma contestação o placar que
    -- vale pode não ser o registrado — a tela não pode ler o original.
    games_meus smallint,
    games_deles smallint
  ) on commit drop;

  -- Todo mundo parte do degrau do CADASTRO (congelado), com incerteza
  -- máxima. A incerteza não é reduzida pelas respostas do questionário: RD
  -- significa "quanta evidência nós temos", e questionário é alegação, não
  -- evidência. Quem mente é corrigido rápido justamente por isso.
  insert into _estado (jogador_id, rating, rd, peso, jogou_em, degrau_exibido, peso_abaixo)
  select j.id,
         public.rating_do_degrau(
           public.degrau_de_categoria(
             coalesce(j.categoria_inicial, j.categoria),
             coalesce(j.nivel_inicial, j.nivel_categoria, 'medio')
           )
         ),
         par.rd_inicial, 0, null,
         public.degrau_de_categoria(
           coalesce(j.categoria_inicial, j.categoria),
           coalesce(j.nivel_inicial, j.nivel_categoria, 'medio')
         ),
         0
  from public.jogadores j
  where coalesce(j.categoria_inicial, j.categoria) is not null;

  create temp table _sets on commit drop as
    select * from public.sets_para_rating();

  delete from public.rating_blocos where true;

  for v_dia in select distinct s.dia from _sets s order by 1
  loop
    update _estado e
    set rd = least(par.rd_maximo,
                   sqrt(e.rd * e.rd + par.c_inatividade * par.c_inatividade
                        * (v_dia - e.jogou_em)))
    where e.jogou_em is not null;

    delete from _inicio where true;
    insert into _inicio select jogador_id, rating, rd from _estado;

    delete from _jogos where true;
    insert into _jogos (jogador_id, set_id, venceu, meu_time, adv_time, adv_rd, parceiro_rating, peso, games_meus, games_deles)
    select v.jogador_id, s.set_id, v.venceu,
           least(ieu.rating, ipar.rating) * par.peso_do_mais_fraco
             + greatest(ieu.rating, ipar.rating) * (1 - par.peso_do_mais_fraco),
           least(ia.rating, ib.rating) * par.peso_do_mais_fraco
             + greatest(ia.rating, ib.rating) * (1 - par.peso_do_mais_fraco),
           (ia.rd + ib.rd) / 2,
           ipar.rating,
           least(par.teto_peso,
                 s.peso_base * case when est.peso < par.calibracao_alvo
                                    then par.peso_calibracao else 1 end),
           v.games_meus, v.games_deles
    from _sets s
    cross join lateral (values
      (s.a1, s.games_a > s.games_b, s.a2, s.b1, s.b2, s.games_a, s.games_b),
      (s.a2, s.games_a > s.games_b, s.a1, s.b1, s.b2, s.games_a, s.games_b),
      (s.b1, s.games_b > s.games_a, s.b2, s.a1, s.a2, s.games_b, s.games_a),
      (s.b2, s.games_b > s.games_a, s.b1, s.a1, s.a2, s.games_b, s.games_a)
    ) as v(jogador_id, venceu, parceiro, adv1, adv2, games_meus, games_deles)
    join _inicio ieu on ieu.jogador_id = v.jogador_id
    join _inicio ipar on ipar.jogador_id = v.parceiro
    join _inicio ia on ia.jogador_id = v.adv1
    join _inicio ib on ib.jogador_id = v.adv2
    join _estado est on est.jogador_id = v.jogador_id
    where s.dia = v_dia;

    -- A conta do Glicko. A expectativa usa DUPLA contra DUPLA (`meu_time`
    -- contra `adv_time`); o ajuste é aplicado ao jogador individualmente,
    -- com a incerteza DELE — é isso que faz parceiro forte render menos.
    for r in
      select j.jogador_id, i.rating as r0, i.rd as rd0,
             sum(j.peso) as peso_total,
             sum(
               power(1 / sqrt(1 + 3*q*q*j.adv_rd*j.adv_rd / pi2), 2)
               * (1 / (1 + power(10, -(1 / sqrt(1 + 3*q*q*j.adv_rd*j.adv_rd / pi2))
                                 * (j.meu_time - j.adv_time) / 400)))
               * (1 - (1 / (1 + power(10, -(1 / sqrt(1 + 3*q*q*j.adv_rd*j.adv_rd / pi2))
                                 * (j.meu_time - j.adv_time) / 400))))
               * j.peso
             ) as soma_info,
             sum(
               (1 / sqrt(1 + 3*q*q*j.adv_rd*j.adv_rd / pi2))
               * ((case when j.venceu then 1 else 0 end)
                  - (1 / (1 + power(10, -(1 / sqrt(1 + 3*q*q*j.adv_rd*j.adv_rd / pi2))
                                 * (j.meu_time - j.adv_time) / 400))))
               * j.peso
             ) as soma_desvio,
             count(*) as qtd
      from _jogos j
      join _inicio i on i.jogador_id = j.jogador_id
      group by j.jogador_id, i.rating, i.rd
    loop
      declare
        v_d2 numeric; v_denom numeric;
        v_novo_rating numeric; v_novo_rd numeric;
        v_degrau_real smallint; v_exibido smallint; v_abaixo numeric;
      begin
        if r.soma_info <= 0 then continue; end if;

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

        -- A trilha guarda DEGRAU de terceiros, nunca o número deles.
        insert into public.rating_bloco_sets (
          bloco_id, set_id, venceu, peso, degrau_adversarios, degrau_parceiro,
          variacao, games_meus, games_deles
        )
        select v_bloco_id, j.set_id, j.venceu, j.peso,
               public.degrau_do_rating(j.adv_time),
               public.degrau_do_rating(j.parceiro_rating),
               -- Quanto ESTE set moveu, dentro do bloco do dia. A soma das
               -- variações dos sets do dia é exatamente a variação do bloco:
               -- o `(q / v_denom)` é o mesmo para todos, e o que muda de um
               -- set para outro é só o termo dele. Não é rateio nem
               -- aproximação — é a mesma conta, aberta.
               (q / v_denom)
                 * (1 / sqrt(1 + 3*q*q*j.adv_rd*j.adv_rd / pi2))
                 * ((case when j.venceu then 1 else 0 end)
                    - (1 / (1 + power(10, -(1 / sqrt(1 + 3*q*q*j.adv_rd*j.adv_rd / pi2))
                                  * (j.meu_time - j.adv_time) / 400))))
                 * j.peso,
               j.games_meus, j.games_deles
        from _jogos j where j.jogador_id = r.jogador_id;

        -- ---- proteção de rebaixamento ----
        -- Subir é imediato. Cair abre período de prova: o contador soma o
        -- peso enquanto o rating seguir abaixo da faixa exibida, e zera se
        -- ele voltar. É o Mecanismo A decidido em 09/08/2026.
        select degrau_exibido, peso_abaixo into v_exibido, v_abaixo
        from _estado where jogador_id = r.jogador_id;

        v_degrau_real := public.degrau_do_rating(v_novo_rating);

        if v_degrau_real >= v_exibido then
          v_exibido := v_degrau_real;   -- promoção na hora; volta zera a prova
          v_abaixo := 0;
        else
          v_abaixo := v_abaixo + r.peso_total;
          if v_abaixo >= par.peso_protecao_queda then
            v_exibido := v_degrau_real;
            v_abaixo := 0;
          end if;
        end if;

        update _estado
        set rating = v_novo_rating, rd = v_novo_rd,
            peso = peso + r.peso_total, jogou_em = v_dia,
            degrau_exibido = v_exibido, peso_abaixo = v_abaixo
        where jogador_id = r.jogador_id;

        v_blocos := v_blocos + 1;
      end;
    end loop;
  end loop;

  update _estado e
  set rd = least(par.rd_maximo,
                 sqrt(e.rd * e.rd + par.c_inatividade * par.c_inatividade
                      * (current_date - e.jogou_em)))
  where e.jogou_em is not null;

  insert into public.rating_jogadores (
    jogador_id, rating, rd, peso_acumulado, degrau, degrau_exibido,
    peso_abaixo, jogou_em, calculado_em
  )
  select jogador_id, rating, rd, peso,
         public.degrau_do_rating(rating), degrau_exibido, peso_abaixo,
         jogou_em, now()
  from _estado
  on conflict (jogador_id) do update
  set rating = excluded.rating, rd = excluded.rd,
      peso_acumulado = excluded.peso_acumulado, degrau = excluded.degrau,
      degrau_exibido = excluded.degrau_exibido, peso_abaixo = excluded.peso_abaixo,
      jogou_em = excluded.jogou_em, calculado_em = excluded.calculado_em;

  -- A categoria que o app mostra passa a ser a do motor (decisão de
  -- 09/08/2026: substitui a do cadastro imediatamente, sem esperar a
  -- calibração — o selo "em calibração" já avisa que o número se ajusta).
  -- Escreve na categoria de EXIBIÇÃO; a do cadastro fica intacta em
  -- `categoria_inicial`, que é de onde o próximo recálculo parte.
  update public.jogadores j
  set categoria = c.categoria,
      nivel_categoria = c.nivel,
      em_calibracao = (e.peso < par.calibracao_alvo)
  from _estado e
  cross join lateral public.categoria_do_degrau(e.degrau_exibido) c
  where j.id = e.jogador_id
    and e.jogou_em is not null;

  return v_blocos;
end;
$fn$;

revoke all on function public.recalcular_ratings() from public, anon, authenticated;

-- ============================================================
-- DEPOIS DE RODAR, RECALCULE
-- ============================================================
--     select public.recalcular_ratings();
--
-- Os ratings NÃO devem mudar: a conta é a mesma, só passou a guardar mais
-- detalhe. Se mudar, é erro nesta alteração.
