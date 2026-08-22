-- ============================================================
-- SEED AVULSO — recria a partida aberta de teste
-- ============================================================
-- A partida de 30/10 foi cancelada durante os testes, e com ela sumiu o
-- único cenário em que o Rodrigo pode testar "Sair da partida" (ele precisa
-- estar DENTRO de uma partida FUTURA que NÃO é dele).
--
-- ⚠️ NÃO APAGA NADA. Só acrescenta.
--
-- Monta o cenário completo:
--   Carlos   = organizador
--   Rodrigo  = jogador (é ele quem testa o "Sair da partida")
--   Diego    = jogador
--   Eduardo  = jogador
--   partida aberta, competitiva, 4 vagas, daqui a 30 dias

do $$
declare
  v_carlos uuid; v_rodrigo uuid; v_diego uuid; v_eduardo uuid;
  v_quadra uuid;
  v_reserva uuid;
  v_partida uuid;
  v_inicio timestamptz;
  v_fim timestamptz;
begin
  select id into v_carlos  from public.jogadores where nome ilike 'Carlos%'  and anonimizado_em is null limit 1;
  select id into v_rodrigo from public.jogadores where nome ilike 'Rodrigo%' and anonimizado_em is null limit 1;
  select id into v_diego   from public.jogadores where nome ilike 'Diego%'   and anonimizado_em is null limit 1;
  select id into v_eduardo from public.jogadores where nome ilike 'Eduardo%' and anonimizado_em is null limit 1;

  select q.id into v_quadra
  from public.quadras q
  join public.clubes c on c.id = q.clube_id
  where c.nome = 'Clube Teste' and q.esporte = 'padel'
  limit 1;

  if v_carlos is null or v_rodrigo is null or v_diego is null or v_eduardo is null then
    raise exception 'Faltou alguma conta de teste (Carlos, Rodrigo, Diego, Eduardo).';
  end if;
  if v_quadra is null then
    raise exception 'Nao encontrei quadra de padel no Clube Teste.';
  end if;

  -- Procura um horário livre nos próximos dias, às 19h. Sem isto o script
  -- esbarraria na trava de overbooking se já houvesse reserva no horário.
  v_inicio := date_trunc('day', now() + interval '30 days')
              + interval '22 hours';  -- 19h em São Paulo
  v_fim := v_inicio + interval '90 minutes';

  while exists (
    select 1 from public.reservas r
    where r.quadra_id = v_quadra
      and r.status = 'confirmada'
      and tstzrange(r.inicio, r.fim) && tstzrange(v_inicio, v_fim)
  ) loop
    v_inicio := v_inicio + interval '1 day';
    v_fim := v_inicio + interval '90 minutes';
  end loop;

  insert into public.reservas
    (quadra_id, inicio, fim, origem, jogador_id, status, criado_por, preco_centavos)
  values
    (v_quadra, v_inicio, v_fim, 'app', v_carlos, 'confirmada', v_carlos, 10000)
  returning id into v_reserva;

  insert into public.partidas
    (reserva_id, organizador_id, tipo, categoria_min, categoria_max, competitiva,
     sexo_jogo, max_jogadores, quadra_id, inicio, fim, preco_centavos, status)
  values
    (v_reserva, v_carlos, 'aberta', 1, 7, true, 'mista', 4, v_quadra,
     v_inicio, v_fim, 10000, 'completa')
  returning id into v_partida;

  -- O organizador entra primeiro (ordem 1), como acontece no app.
  insert into public.partida_jogadores (partida_id, jogador_id, papel, ordem, estado)
  values
    (v_partida, v_carlos,  'jogador', 1, 'aceito'),
    (v_partida, v_rodrigo, 'jogador', 2, 'aceito'),
    (v_partida, v_diego,   'jogador', 3, 'aceito'),
    (v_partida, v_eduardo, 'jogador', 4, 'aceito');

  raise notice 'Partida criada: % — inicio %', v_partida, v_inicio;
end $$;


-- ============================================================
-- CONFERIR
-- ============================================================
-- A partida nova, com os quatro dentro:
--     select p.id, p.inicio, p.status, count(pj.jogador_id) as jogadores
--     from public.partidas p
--     join public.partida_jogadores pj on pj.partida_id = p.id
--     where p.inicio > now()
--     group by p.id, p.inicio, p.status
--     order by p.inicio desc limit 3;
--
-- Depois, no app: entre como Rodrigo, abra essa partida e o botão
-- "Sair da partida" tem de estar lá (logo abaixo de "Pagar minha parte").
