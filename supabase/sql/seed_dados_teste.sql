-- ============================================================
-- SEED / LIMPEZA DE DADOS DE TESTE  ⚠️ SÓ RODAR EM AMBIENTE DE TESTE
-- ============================================================
-- Faz três coisas, nesta ordem:
--   1) Limpa reservas/partidas/pagamentos de teste (mantém contas e clubes).
--   2) Deixa o Bruno inadimplente (partida de 3 dias atrás, não paga).
--   3) Cria clubes novos em Novo Hamburgo e outras cidades, com quadras.
-- NÃO rode isto em produção real: o passo 1 apaga TODAS as reservas.

-- ------------------------------------------------------------
-- 1) LIMPEZA
-- Apagar reservas cascateia para partidas → partida_jogadores,
-- pagamentos e agenda_publica. Jogadores, clubes, quadras e preços ficam.
-- ------------------------------------------------------------
delete from public.reservas;
-- (pagamentos/partidas/agenda_publica já saíram no cascade; garantia:)
delete from public.pagamentos;
delete from public.partidas;

-- ------------------------------------------------------------
-- 2) BRUNO INADIMPLENTE — partida de 3 dias atrás, sem pagamento
-- ------------------------------------------------------------
do $$
declare
  v_bruno uuid;
  v_quadra uuid;
  v_reserva uuid;
  v_partida uuid;
begin
  select id into v_bruno from public.jogadores where nome = 'Bruno Teste' limit 1;
  select q.id into v_quadra
    from public.quadras q
    join public.clubes c on c.id = q.clube_id
    where c.nome = 'Clube Teste' and q.esporte = 'padel'
    limit 1;

  if v_bruno is not null and v_quadra is not null then
    insert into public.reservas (quadra_id, inicio, fim, origem, jogador_id, status, criado_por, preco_centavos)
      values (v_quadra, now() - interval '3 days', now() - interval '3 days' + interval '90 minutes',
              'app', v_bruno, 'confirmada', v_bruno, 20000)
      returning id into v_reserva;
    insert into public.partidas (reserva_id, organizador_id, categoria_min, categoria_max,
              competitiva, sexo_jogo, max_jogadores, quadra_id, inicio, fim, preco_centavos)
      values (v_reserva, v_bruno, 3, 6, false, 'masculino', 4, v_quadra,
              now() - interval '3 days', now() - interval '3 days' + interval '90 minutes', 20000)
      returning id into v_partida;
    insert into public.partida_jogadores (partida_id, jogador_id, papel, ordem)
      values (v_partida, v_bruno, 'jogador', 1);
  end if;
end $$;

-- ------------------------------------------------------------
-- 3) CLUBES NOVOS (com quadras e preços, para o mapa e as partidas)
-- Cada um é dono de um clube via as contas de teste que já existem
-- (Rodrigo já é dono do Clube Teste, então usamos as outras contas).
-- ------------------------------------------------------------
do $$
declare
  v_dono uuid;
  v_clube uuid;
  v_q uuid;
begin
  -- ---- Arena Padel Sinos — Novo Hamburgo (mesma cidade do Clube Teste) — dono: Carlos
  select id into v_dono from public.jogadores where nome = 'Carlos Teste' limit 1;
  if v_dono is not null and not exists (select 1 from public.clubes where nome = 'Arena Padel Sinos') then
    insert into public.clubes (dono_id, nome, cidade, endereco, telefone, latitude, longitude, horas_limite_cancelamento, descricao)
      values (v_dono, 'Arena Padel Sinos', 'Novo Hamburgo', 'Av. Nações Unidas, 2000 - Novo Hamburgo',
              '5551988887777', -29.6850, -51.1200, 12, 'Quatro quadras cobertas, bar e estacionamento.')
      returning id into v_clube;
    insert into public.quadras (clube_id, nome, esporte, tipo, coberta) values (v_clube, 'Quadra 1', 'padel', 'vidro', true) returning id into v_q;
    insert into public.quadra_precos (quadra_id, dias, hora_inicio, hora_fim, preco_centavos) values (v_q, array[0,1,2,3,4,5,6], '08:00', '23:00', 13000);
    insert into public.quadras (clube_id, nome, esporte, tipo, coberta) values (v_clube, 'Quadra 2', 'padel', 'vidro', true) returning id into v_q;
    insert into public.quadra_precos (quadra_id, dias, hora_inicio, hora_fim, preco_centavos) values (v_q, array[0,1,2,3,4,5,6], '08:00', '23:00', 14000);
  end if;

  -- ---- Padel Club Porto Alegre — Porto Alegre — dono: Diego
  select id into v_dono from public.jogadores where nome = 'Diego Teste' limit 1;
  if v_dono is not null and not exists (select 1 from public.clubes where nome = 'Padel Club Porto Alegre') then
    insert into public.clubes (dono_id, nome, cidade, endereco, telefone, latitude, longitude, horas_limite_cancelamento, descricao)
      values (v_dono, 'Padel Club Porto Alegre', 'Porto Alegre', 'Av. Ipiranga, 5000 - Porto Alegre',
              '5551977776666', -30.0346, -51.2177, 24, 'Referência de padel na capital.')
      returning id into v_clube;
    insert into public.quadras (clube_id, nome, esporte, tipo, coberta) values (v_clube, 'Central', 'padel', 'vidro', true) returning id into v_q;
    insert into public.quadra_precos (quadra_id, dias, hora_inicio, hora_fim, preco_centavos) values (v_q, array[0,1,2,3,4,5,6], '07:00', '23:00', 16000);
    insert into public.quadras (clube_id, nome, esporte, tipo, coberta) values (v_clube, 'Beach 1', 'beach_tennis', 'areia', false) returning id into v_q;
    insert into public.quadra_precos (quadra_id, dias, hora_inicio, hora_fim, preco_centavos) values (v_q, array[0,1,2,3,4,5,6], '08:00', '22:00', 12000);
  end if;

  -- ---- Vale Padel — São Leopoldo — dono: Eduardo
  select id into v_dono from public.jogadores where nome = 'Eduardo Teste' limit 1;
  if v_dono is not null and not exists (select 1 from public.clubes where nome = 'Vale Padel') then
    insert into public.clubes (dono_id, nome, cidade, endereco, telefone, latitude, longitude, horas_limite_cancelamento, descricao)
      values (v_dono, 'Vale Padel', 'São Leopoldo', 'Rua Independência, 800 - São Leopoldo',
              '5551966665555', -29.7604, -51.1470, 6, 'Quadras de padel e tênis, ambiente família.')
      returning id into v_clube;
    insert into public.quadras (clube_id, nome, esporte, tipo, coberta) values (v_clube, 'Quadra A', 'padel', 'alvenaria', false) returning id into v_q;
    insert into public.quadra_precos (quadra_id, dias, hora_inicio, hora_fim, preco_centavos) values (v_q, array[0,1,2,3,4,5,6], '09:00', '22:00', 11000);
    insert into public.quadras (clube_id, nome, esporte, tipo, coberta) values (v_clube, 'Tênis 1', 'tenis', 'saibro', false) returning id into v_q;
    insert into public.quadra_precos (quadra_id, dias, hora_inicio, hora_fim, preco_centavos) values (v_q, array[1,2,3,4,5], '08:00', '21:00', 9000);
  end if;
end $$;
