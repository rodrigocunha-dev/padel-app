-- ============================================================
-- SEED AVULSO — refaz a dívida do Bruno, para testar a trava
-- ============================================================
-- O fundador apagou a conta do Bruno testando a exclusão e recriou o perfil.
-- Com isso a dívida sumiu, e a trava de "quem deve não apaga a conta" ficou
-- sem como ser testada.
--
-- ⚠️ ISTO NÃO APAGA NADA. Diferente do `seed_dados_teste.sql`, que começa
-- limpando TODAS as reservas do banco, este script só acrescenta uma partida
-- antiga não paga. Pode rodar com o resto dos dados no lugar.
--
-- Como funciona a inadimplência (script 021): jogou, passou 24h do fim da
-- partida, e não há pagamento com status 'pago'. Por isso a partida é criada
-- com 3 dias de idade — dentro da regra, sem depender de esperar.

do $$
declare
  v_bruno uuid;
  v_quadra uuid;
  v_reserva uuid;
  v_partida uuid;
begin
  -- O nome pode ter voltado como "Bruno" ou "Bruno Teste", dependendo de
  -- como o fundador recadastrou. Busca pelos dois.
  select id into v_bruno
  from public.jogadores
  where nome ilike 'Bruno%' and anonimizado_em is null
  limit 1;

  select q.id into v_quadra
  from public.quadras q
  join public.clubes c on c.id = q.clube_id
  where c.nome = 'Clube Teste' and q.esporte = 'padel'
  limit 1;

  if v_bruno is null then
    raise exception 'Nao encontrei o jogador Bruno. Confira o nome do perfil.';
  end if;
  if v_quadra is null then
    raise exception 'Nao encontrei quadra de padel no Clube Teste.';
  end if;

  -- Já está devendo? Então não cria outra — senão cada execução empilha uma
  -- dívida nova e o teste fica sujo.
  if public.jogador_inadimplente(v_bruno) then
    raise notice 'Bruno ja esta inadimplente. Nada a fazer.';
    return;
  end if;

  insert into public.reservas
    (quadra_id, inicio, fim, origem, jogador_id, status, criado_por, preco_centavos)
  values
    (v_quadra, now() - interval '3 days',
     now() - interval '3 days' + interval '90 minutes',
     'app', v_bruno, 'confirmada', v_bruno, 20000)
  returning id into v_reserva;

  insert into public.partidas
    (reserva_id, organizador_id, categoria_min, categoria_max, competitiva,
     sexo_jogo, max_jogadores, quadra_id, inicio, fim, preco_centavos)
  values
    (v_reserva, v_bruno, 3, 6, false, 'masculino', 4, v_quadra,
     now() - interval '3 days',
     now() - interval '3 days' + interval '90 minutes', 20000)
  returning id into v_partida;

  insert into public.partida_jogadores (partida_id, jogador_id, papel, ordem, estado)
  values (v_partida, v_bruno, 'jogador', 1, 'aceito');

  raise notice 'Divida criada para o Bruno na partida %', v_partida;
end $$;


-- ============================================================
-- CONFERIR
-- ============================================================
-- Deve devolver true:
--     select public.jogador_inadimplente(id) from public.jogadores
--     where nome ilike 'Bruno%';
--
-- Depois disso, tentar apagar a conta do Bruno pelo app deve ser RECUSADO
-- com a mensagem de pagamento em aberto.
