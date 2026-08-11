-- Sprint 5 — motor de rating: força da dupla, privacidade e proteção de queda
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- TRÊS CORREÇÕES, TODAS DECIDIDAS COM O FUNDADOR EM 09/08/2026
-- ============================================================
--
-- 1) A FORÇA DO PARCEIRO NÃO ENTRAVA NA CONTA.
--    O `025` comparava **o meu rating** contra a média dos adversários. Isso
--    é Glicko de dupla pela metade: quem jogava com um parceiro muito
--    melhor ganhava os mesmos pontos de quem carregava um parceiro fraco.
--    Medido, eu 4ª Médio contra dois 4ª Médio, vencendo:
--      · parceiro 1ª Forte → era esperado ganhar (80%) → +3,9
--      · parceiro igual    → 50% → +9,9
--      · parceiro 7ª Fraco → 20% → +16,1
--    Além de errado, era um vetor de abuso: pendurar-se num parceiro muito
--    melhor rendia rating de graça.
--
-- 2) O NÚMERO ERA PÚBLICO.
--    `rating_jogadores` estava legível por qualquer pessoa logada, com o
--    valor exato — e a trilha guardava o rating dos adversários como número.
--    A decisão é: o número é **privado**; de terceiros mostra-se **categoria
--    e nível**, nunca o valor. Vale também para o parceiro de dupla.
--
-- 3) A CATEGORIA DO MOTOR PASSA A SER A QUE APARECE — com proteção de queda.
--    Promoção é imediata. Queda abre um **período de prova**: um contador
--    soma peso a cada set enquanto o rating seguir abaixo da faixa exibida;
--    chegando ao alvo, a categoria cai. Se o rating voltar para dentro da
--    faixa, o contador zera e a categoria nunca mudou.
--
--    ⚠️ O alvo da queda é **5**, não 20. Medido: jogador calibrado move ±7 a
--    ±10 pontos por set e um degrau tem 50 — logo ~5 a 7 sets cruzam um
--    degrau. Peso 20 seriam 3 a 4 degraus de movimento, e o problema não é
--    ser generoso: a categoria exibida ficaria muito atrasada, com a pessoa
--    aparecendo como 4ª Fraco enquanto já joga como 5ª Fraco — atraindo
--    adversários pela categoria errada. O peso 20 continua sendo o alvo da
--    CALIBRAÇÃO, que responde outra pergunta.

-- ============================================================
-- 1) COLUNAS NOVAS — todas antes das funções
-- ============================================================
-- (Lição do script 018: o Postgres valida o corpo da função na criação, e
-- uma coluna criada depois no mesmo script faz o script inteiro falhar.)

-- A categoria do CADASTRO, congelada. O motor parte dela; a categoria de
-- exibição é escrita por cima da outra. Sem este congelamento, o próximo
-- recálculo do zero partiria de um lugar já movido e o resultado deixaria
-- de ser reproduzível — a garantia pela qual escolhemos refazer do zero.
alter table public.jogadores
  add column if not exists categoria_inicial smallint,
  add column if not exists nivel_inicial text;

update public.jogadores
set categoria_inicial = categoria, nivel_inicial = nivel_categoria
where categoria_inicial is null and categoria is not null;

-- O congelamento vira regra do BANCO, não da tela: assim não depende de o
-- onboarding lembrar de preencher, hoje ou daqui a um ano.
create or replace function public.congelar_categoria_inicial()
returns trigger
language plpgsql
as $fn$
begin
  if new.categoria_inicial is null then
    new.categoria_inicial := new.categoria;
    new.nivel_inicial := coalesce(new.nivel_categoria, 'medio');
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_congelar_categoria_inicial on public.jogadores;
create trigger trg_congelar_categoria_inicial
  before insert on public.jogadores
  for each row execute function public.congelar_categoria_inicial();

-- Alvo do período de prova da queda.
alter table public.rating_parametros
  add column if not exists peso_protecao_queda numeric not null default 5;

-- Estado da proteção de queda, por jogador. Recalculado do zero junto com
-- o resto — não é estado acumulado à parte.
alter table public.rating_jogadores
  add column if not exists degrau_exibido smallint,
  add column if not exists peso_abaixo numeric not null default 0;

update public.rating_jogadores set degrau_exibido = degrau where degrau_exibido is null;

-- A trilha deixa de guardar número de terceiros. Degrau é categoria+nível,
-- que é justamente o que se pode mostrar.
alter table public.rating_bloco_sets
  drop column if exists rating_adversarios;
alter table public.rating_bloco_sets
  add column if not exists degrau_adversarios smallint,
  add column if not exists degrau_parceiro smallint;


-- ============================================================
-- 2) PRIVACIDADE DO NÚMERO
-- ============================================================
-- Antes: qualquer pessoa logada lia o rating exato de qualquer um. Agora só
-- o dono. Categoria e nível continuam públicos por `jogadores`, que é de
-- onde todas as telas já leem — nada mais precisa mudar por causa disto.
drop policy if exists "rating_leitura" on public.rating_jogadores;
drop policy if exists "rating_leitura_dono" on public.rating_jogadores;
create policy "rating_leitura_dono"
  on public.rating_jogadores for select to authenticated
  using (jogador_id = (select auth.uid()));


-- ============================================================
-- 3) O MOTOR, CORRIGIDO
-- ============================================================
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
    peso numeric
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
    insert into _jogos (jogador_id, set_id, venceu, meu_time, adv_time, adv_rd, parceiro_rating, peso)
    select v.jogador_id, s.set_id, v.venceu,
           (ieu.rating + ipar.rating) / 2,
           (ia.rating + ib.rating) / 2,
           (ia.rd + ib.rd) / 2,
           ipar.rating,
           least(par.teto_peso,
                 s.peso_base * case when est.peso < par.calibracao_alvo
                                    then par.peso_calibracao else 1 end)
    from _sets s
    cross join lateral (values
      (s.a1, s.games_a > s.games_b, s.a2, s.b1, s.b2),
      (s.a2, s.games_a > s.games_b, s.a1, s.b1, s.b2),
      (s.b1, s.games_b > s.games_a, s.b2, s.a1, s.a2),
      (s.b2, s.games_b > s.games_a, s.b1, s.a1, s.a2)
    ) as v(jogador_id, venceu, parceiro, adv1, adv2)
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
          bloco_id, set_id, venceu, peso, degrau_adversarios, degrau_parceiro
        )
        select v_bloco_id, j.set_id, j.venceu, j.peso,
               public.degrau_do_rating(j.adv_time),
               public.degrau_do_rating(j.parceiro_rating)
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
-- 💡 EVOLUÇÃO REGISTRADA, NÃO IMPLEMENTADA — "Mecanismo B"
-- ============================================================
-- Em vez de um contador que liga e zera, olhar a PROPORÇÃO da janela mais
-- recente (ex.: últimos 20 de peso) em que o rating esteve abaixo da linha,
-- e confirmar a queda por um limiar de proporção em vez de exigir sequência
-- ininterrupta. Mais preciso — uma volta isolada acima da linha não apaga
-- toda a evidência acumulada —, mas exige um parâmetro a mais (o limiar) e
-- é mais difícil de explicar em uma frase para o jogador.
-- Reavaliar com dados reais do beta, quando houver como justificar a
-- complexidade extra.
