-- ============================================================
-- 051 — O LIMITE PASSA A SER POR JOGADOR, E O AVISO ANTIGO SAI
-- ============================================================
-- Dois ajustes pedidos pelo fundador depois de testar a campanha.


-- ============================================================
-- 1) O AVISO ANTIGO DE UM HORÁRIO SÓ DEIXA DE EXISTIR
-- ============================================================
-- O fundador recebeu DOIS avisos parecidos: "quadra livre" (o antigo, um
-- horário por vez, script 039) e "horários livres" (a campanha, script 049).
-- Ele perguntou se não eram a mesma coisa. São — o antigo foi substituído,
-- e eu tirei o botão dele da tela mas deixei a função e os avisos vivos.
--
-- Deixar os dois é pior que escolher um: o jogador recebe duas notificações
-- do mesmo clube dizendo quase a mesma frase.

drop function if exists public.promover_horario_ocioso(uuid, timestamptz, timestamptz);

-- Os avisos antigos que ainda estão na tela de alguém somem: eles apontam
-- para um caminho que não existe mais.
update public.avisos
set lido_em = now()
where tipo = 'horario_livre' and lido_em is null;


-- ============================================================
-- 2) O LIMITE DE 6 HORAS PASSA A SER POR JOGADOR
-- ============================================================
-- Antes: uma campanha por CLUBE a cada 6h. O fundador achou o defeito —
-- avisar os horários de sábado bloqueava avisar os de domingo, mesmo sendo
-- quadras e horários diferentes.
--
-- ⚠️ A correção não é remover o limite, é mudar QUEM ele protege. O que
-- incomoda não é o clube mandar muitas campanhas: é o JOGADOR receber muitas
-- notificações. Então o clube cria à vontade, e cada jogador recebe no
-- máximo um aviso daquele clube a cada 6 horas.
--
-- Efeito colateral bom: um horário que já foi anunciado e continua livre
-- pode entrar numa campanha nova sem incomodar quem já foi avisado.

create or replace function public.promover_horarios(
  p_clube_id uuid,
  p_horarios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := (select auth.uid());
  v_promocao uuid;
  h jsonb;
  v_quadra uuid;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_validos integer := 0;
  v_avisados integer := 0;
  v_ja_avisados integer := 0;
begin
  if not exists (
    select 1 from public.clubes where id = p_clube_id and dono_id = eu
  ) then
    raise exception 'SO_O_DONO';
  end if;

  if jsonb_array_length(p_horarios) = 0 then
    raise exception 'NENHUM_HORARIO';
  end if;

  if jsonb_array_length(p_horarios) > 12 then
    raise exception 'HORARIOS_DEMAIS';
  end if;

  insert into public.promocoes (clube_id, criada_por)
  values (p_clube_id, eu)
  returning id into v_promocao;

  for h in select * from jsonb_array_elements(p_horarios) loop
    v_quadra := (h->>'quadra_id')::uuid;
    v_inicio := (h->>'inicio')::timestamptz;
    v_fim := (h->>'fim')::timestamptz;

    if not exists (
      select 1 from public.quadras where id = v_quadra and clube_id = p_clube_id
    ) then
      continue;
    end if;

    if v_inicio <= now() then
      continue;
    end if;

    if exists (
      select 1 from public.reservas r
      where r.quadra_id = v_quadra
        and r.status = 'confirmada'
        and tstzrange(r.inicio, r.fim) && tstzrange(v_inicio, v_fim)
    ) then
      continue;
    end if;

    insert into public.promocao_horarios (promocao_id, quadra_id, inicio, fim)
    values (v_promocao, v_quadra, v_inicio, v_fim)
    on conflict do nothing;

    v_validos := v_validos + 1;
  end loop;

  if v_validos = 0 then
    delete from public.promocoes where id = v_promocao;
    raise exception 'NENHUM_HORARIO_VALIDO';
  end if;

  -- Quantos ficariam de fora por já terem sido avisados há menos de 6h.
  -- Devolvido para a tela, porque "avisei 12 horários e ninguém recebeu"
  -- precisa de explicação — senão o clube acha que quebrou.
  select count(*) into v_ja_avisados
  from public.jogadores j
  join public.clubes c on c.id = p_clube_id
  where j.cidade = c.cidade
    and j.id <> eu
    and j.anonimizado_em is null
    and exists (
      select 1 from public.avisos a
      where a.jogador_id = j.id
        and a.clube_id = p_clube_id
        and a.tipo = 'horarios_livres'
        and a.criado_em > now() - interval '6 hours'
    );

  with alvo as (
    select j.id
    from public.jogadores j
    join public.clubes c on c.id = p_clube_id
    where j.cidade = c.cidade
      and j.id <> eu
      and j.anonimizado_em is null
      and not public.jogador_inadimplente(j.id)
      and exists (
        select 1 from public.promocao_horarios ph
        where ph.promocao_id = v_promocao
          and public.horario_na_disponibilidade(j.id, ph.inicio)
      )
      -- ⚠️ A TRAVA MORA AQUI, no jogador, e não lá em cima no clube.
      and not exists (
        select 1 from public.avisos a
        where a.jogador_id = j.id
          and a.clube_id = p_clube_id
          and a.tipo = 'horarios_livres'
          and a.criado_em > now() - interval '6 hours'
      )
  ), criados as (
    insert into public.avisos (jogador_id, tipo, clube_id, promocao_id)
    select alvo.id, 'horarios_livres', p_clube_id, v_promocao from alvo
    returning 1
  )
  select count(*) into v_avisados from criados;

  return jsonb_build_object(
    'promocao_id', v_promocao,
    'horarios', v_validos,
    'descartados', jsonb_array_length(p_horarios) - v_validos,
    'avisados', v_avisados,
    'ja_avisados_recentemente', v_ja_avisados
  );
end;
$fn$;

revoke all on function public.promover_horarios(uuid, jsonb) from public, anon;
grant execute on function public.promover_horarios(uuid, jsonb) to authenticated;


-- ============================================================
-- 3) O TIPO ANTIGO SAI DA LISTA PERMITIDA
-- ============================================================
-- ⚠️ Vem DEPOIS do update que marcou os antigos como lidos — a restrição
-- vale para linhas novas, mas deixar o tipo na lista convidaria alguém a
-- reusá-lo. As linhas antigas continuam no banco, como histórico.
alter table public.avisos drop constraint if exists avisos_tipo_check;
alter table public.avisos
  add constraint avisos_tipo_check
  check (tipo in ('set_registrado', 'votacao_aberta', 'promovido',
                  'edicao_proposta', 'chat_novas_mensagens',
                  'vaga_aberta', 'horarios_livres', 'horario_livre'));
-- 'horario_livre' segue na lista só para as linhas ANTIGAS continuarem
-- válidas. Nada novo o cria: a função que o gerava foi apagada acima.


-- ============================================================
-- COMO CONFERIR
-- ============================================================
-- Nenhum aviso antigo na tela de ninguém:
--     select count(*) from public.avisos
--     where tipo = 'horario_livre' and lido_em is null;   -- deve dar 0
--
-- E duas campanhas seguidas: a segunda deve criar a campanha normalmente,
-- mas avisar 0 pessoas (todas já avisadas nas últimas 6h).
