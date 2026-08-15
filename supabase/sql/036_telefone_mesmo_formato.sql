-- Correção — o convite por telefone nunca encontraria a conta
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- O BUG, MEDIDO ANTES DE CORRIGIR
-- ============================================================
-- O cadastro grava o telefone com o código do país:
--     jogadores.telefone = '+5551999998888'   → 13 dígitos
--
-- O organizador digita o número como se fala no Brasil:
--     '(51) 99999-8888'                       → 11 dígitos
--
-- O `034` comparava só os dígitos dos dois lados. **13 contra 11 nunca
-- batem.** O convite ficaria pendente para sempre: a pessoa criaria a
-- conta, `vincular_convites_do_telefone` não acharia nada, e ninguém veria
-- erro nenhum. Falha silenciosa, que é a pior espécie.
--
-- Achado por causa de uma pergunta do fundador ("cadastrar o número de
-- teste não tira o sentido do teste?") — fui conferir o formato para
-- responder e o bug apareceu no caminho.

-- ============================================================
-- UMA FORMA CANÔNICA, USADA NOS DOIS LADOS
-- ============================================================
-- Tira tudo que não é dígito e remove o 55 do país quando ele está lá.
-- O que sobra é sempre DDD + número, que é como as duas pontas conseguem
-- se reconhecer.
--
-- ⚠️ Assume Brasil, e isso é consciente: o produto nasce em Novo
-- Hamburgo/RS e o login é por telefone brasileiro. Quando houver outro
-- país, esta função é o único lugar a mudar.
create or replace function public.telefone_canonico(p_tel text)
returns text
language sql
immutable
as $fn$
  select case
    when length(d) in (12, 13) and left(d, 2) = '55' then substr(d, 3)
    else d
  end
  from (select regexp_replace(coalesce(p_tel, ''), '\D', '', 'g') as d) x;
$fn$;

-- ============================================================
-- OS DOIS LADOS PASSAM A FALAR A MESMA LÍNGUA
-- ============================================================
create or replace function public.convidar_por_telefone(
  p_partida_id uuid,
  p_telefone text,
  p_nome text
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org uuid := auth.uid();
  v_partida public.partidas;
  v_tel text;
  v_existente uuid;
begin
  if v_org is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_partida.organizador_id <> v_org then
    raise exception 'SO_O_ORGANIZADOR' using errcode = 'P0001';
  end if;
  if v_partida.tipo <> 'privada' then
    raise exception 'SO_SESSAO_PRIVADA' using errcode = 'P0001';
  end if;
  if v_partida.status = 'cancelada' then
    raise exception 'PARTIDA_CANCELADA' using errcode = 'P0001';
  end if;

  v_tel := public.telefone_canonico(p_telefone);
  if length(v_tel) < 10 then
    raise exception 'TELEFONE_INVALIDO' using errcode = 'P0001';
  end if;

  -- Se já tem conta, vira convite normal. Convidar por telefone alguém que
  -- já está no app não pode criar um participante fantasma paralelo à conta.
  select id into v_existente from public.jogadores
  where public.telefone_canonico(telefone) = v_tel;

  if v_existente is not null then
    perform public.convidar_participante(p_partida_id, v_existente);
    return 'ja_tem_conta';
  end if;

  insert into public.partida_jogadores (
    partida_id, jogador_id, telefone, nome_convidado, papel, ordem,
    estado, convidado_por, convidado_em
  ) values (
    p_partida_id, null, v_tel, nullif(trim(coalesce(p_nome, '')), ''),
    'jogador',
    coalesce((select max(ordem) from public.partida_jogadores where partida_id = p_partida_id), 0) + 1,
    'convidado', v_org, now()
  )
  on conflict do nothing;

  return 'convite_pendente';
end;
$fn$;

revoke all on function public.convidar_por_telefone(uuid, text, text) from public, anon;
grant execute on function public.convidar_por_telefone(uuid, text, text) to authenticated;


create or replace function public.vincular_convites_do_telefone()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  v_tel text;
  v_qtd integer;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select public.telefone_canonico(telefone) into v_tel
  from public.jogadores where id = v_jog;

  if v_tel is null or length(v_tel) < 10 then
    return 0;
  end if;

  with ligados as (
    update public.partida_jogadores pj
    set jogador_id = v_jog, telefone = null, nome_convidado = null
    -- Compara pela forma canônica dos dois lados: os convites gravados
    -- antes desta correção podem estar em outro formato.
    where public.telefone_canonico(pj.telefone) = v_tel
      and pj.jogador_id is null
      and not exists (
        select 1 from public.partida_jogadores outro
        where outro.partida_id = pj.partida_id and outro.jogador_id = v_jog
      )
    returning 1
  )
  select count(*) into v_qtd from ligados;

  return v_qtd;
end;
$fn$;

revoke all on function public.vincular_convites_do_telefone() from public, anon;
grant execute on function public.vincular_convites_do_telefone() to authenticated;

-- Os convites já gravados passam para a forma canônica também.
update public.partida_jogadores
set telefone = public.telefone_canonico(telefone)
where telefone is not null
  and telefone <> public.telefone_canonico(telefone);
