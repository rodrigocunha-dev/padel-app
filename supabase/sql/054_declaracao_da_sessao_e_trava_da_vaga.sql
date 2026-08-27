-- ============================================================
-- 054 — A SESSÃO PODE SER AMISTOSA, E A VAGA PÚBLICA NÃO SE REMOVE
-- ============================================================
-- Duas decisões do fundador (26/08/2026), depois da partida híbrida.
--
-- 1) A DECLARAÇÃO VOLTA PARA A SESSÃO PRIVADA. Em 08/08 ela tinha sido
--    tirada: sessão privada contava sempre, e quem não quisesse que
--    contasse simplesmente não registrava o set. O caso que derrubou essa
--    regra é real e específico: alguém de nível mais alto jogando com um
--    amigo mais fraco, que quer o jogo no histórico mas não quer arriscar
--    a categoria numa derrota. Hoje ele perde as três coisas de uma vez
--    (rating, histórico e gamificação) por não ter meio-termo.
--
--    ⚠️ Isto NÃO é uma escapatória nova. Marcar amistosa acontece na
--    criação, ANTES de qualquer resultado existir, e continua congelado
--    quando o jogo começa (gatilho do `014`). Ninguém joga, vê que perdeu
--    e muda depois.
--
--    A decisão estava prevista: o CLAUDE.md já registrava "se grupos de
--    amigos reclamarem que nem todo jogo deveria contar, a saída é
--    devolver a declaração à sessão privada". É o caminho de volta que a
--    própria decisão deixou aberto.
--
-- 2) QUEM ENTROU PELA VAGA PÚBLICA NÃO PODE SER REMOVIDO pelo organizador.
--    O "Desistir" é a pessoa saindo por vontade própria e acertando por
--    fora com quem ela conhece. O estranho da vaga pública não conhece
--    ninguém ali para acertar nada — então tirá-lo à força para dar o
--    lugar a um conhecido seria decidir sobre o dinheiro de alguém que não
--    tem a quem recorrer.


-- ============================================================
-- 1) A TRAVA DA VAGA PÚBLICA
-- ============================================================
-- ⚠️ Cópia da versão do `020` com UMA trava a mais. Não reescrevi de
-- memória: a versão de hoje já recusa remover quem pagou, e essa regra
-- teria se perdido numa reescrita "limpa" — foi o que quase aconteceu com
-- `sair_da_partida` e `convidar_participante` no script `053`.
--
-- As duas travas convivem e dizem coisas diferentes: `JOGADOR_JA_PAGOU`
-- protege o dinheiro de qualquer participante; `VEIO_DA_VAGA_PUBLICA`
-- protege a vaga de quem não tem vínculo com o grupo, tenha pago ou não.
create or replace function public.remover_participante(
  p_partida_id uuid,
  p_jogador_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org uuid := auth.uid();
  v_partida public.partidas;
begin
  if v_org is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_partida.organizador_id <> v_org then
    raise exception 'SO_O_ORGANIZADOR_REMOVE' using errcode = 'P0001';
  end if;
  if p_jogador_id = v_partida.organizador_id then
    raise exception 'ORGANIZADOR_NAO_SAI' using errcode = 'P0001';
  end if;
  if v_partida.inicio <= now() then
    raise exception 'PARTIDA_JA_COMECOU' using errcode = 'P0001';
  end if;

  -- NOVO: a vaga pública não é do organizador para dar e tirar.
  if exists (
    select 1 from public.partida_jogadores
    where partida_id = p_partida_id
      and jogador_id = p_jogador_id
      and entrou_pela_vaga
  ) then
    raise exception 'VEIO_DA_VAGA_PUBLICA' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.pagamentos
    where partida_id = p_partida_id
      and jogador_id = p_jogador_id
      and status = 'pago'
  ) then
    raise exception 'JOGADOR_JA_PAGOU' using errcode = 'P0001';
  end if;

  delete from public.partida_jogadores
  where partida_id = p_partida_id and jogador_id = p_jogador_id;

  if not found then
    raise exception 'JOGADOR_NAO_ESTA_NA_SESSAO' using errcode = 'P0001';
  end if;
end;
$fn$;


-- ============================================================
-- 2) MUDAR A DECLARAÇÃO DE UMA SESSÃO PRIVADA
-- ============================================================
-- Segue a MESMA lógica da partida aberta (opção B, escolhida pelo
-- fundador): sozinho vale na hora; com gente dentro vira solicitação que
-- TODOS aprovam; congela quando o jogo começa.
--
-- ⚠️ Por que uma função própria em vez de abrir `propor_edicao_partida`
-- para sessão privada — três motivos concretos, não preferência:
--   • aquela função exige faixa de categoria e sexo, que a sessão privada
--     sem vaga anunciada não tem (são nulos, e ela recusaria);
--   • ela carrega a regra "competitiva só com 4", que é da partida aberta
--     (revezamento de 5+ não vale rating). Sessão de 5–6 amigos vale, e
--     aplicar aquela regra aqui quebraria justamente o caso mais comum;
--   • ela mexe em `max_jogadores`, que na sessão é decorativo.
--
-- O que ela REAPROVEITA é tudo que importa: a mesma tabela de propostas, a
-- mesma votação (`responder_edicao_partida`), o mesmo cancelamento e o
-- mesmo aviso. A aplicação já usa `coalesce(e.competitiva, competitiva)`,
-- então uma proposta que carrega só a declaração funciona sem tocar nela.
create or replace function public.propor_declaracao_sessao(
  p_partida_id uuid,
  p_competitiva boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  eu uuid := (select auth.uid());
  p public.partidas;
  v_outros integer;
  v_id uuid;
begin
  if eu is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into p from public.partidas where id = p_partida_id;

  if p.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if p.organizador_id <> eu then
    raise exception 'SO_O_ORGANIZADOR' using errcode = 'P0001';
  end if;
  if p.tipo <> 'privada' then
    raise exception 'SO_SESSAO_PRIVADA' using errcode = 'P0001';
  end if;
  if p.status = 'cancelada' then
    raise exception 'PARTIDA_CANCELADA' using errcode = 'P0001';
  end if;
  -- Mesma trava do `014`: depois que a bola rola, a declaração é o que era.
  if p.inicio <= now() then
    raise exception 'PARTIDA_JA_COMECOU' using errcode = 'P0001';
  end if;
  if p_competitiva is null then
    raise exception 'DECLARACAO_INVALIDA' using errcode = 'P0001';
  end if;
  if p.competitiva = p_competitiva then
    raise exception 'JA_ESTA_ASSIM' using errcode = 'P0001';
  end if;

  select count(*) into v_outros
  from public.partida_jogadores pj
  where pj.partida_id = p_partida_id
    and pj.papel = 'jogador'
    and pj.estado = 'aceito'
    and pj.desistiu_em is null
    and pj.jogador_id <> eu;

  -- Sozinho: vale na hora. É o caso da criação — o organizador acabou de
  -- montar o jogo e ainda não convidou ninguém.
  if v_outros = 0 then
    update public.partidas set competitiva = p_competitiva
    where id = p_partida_id;
    return jsonb_build_object('aplicada', true, 'faltam', 0);
  end if;

  -- Com gente dentro: proposta. Só a declaração vai preenchida; o resto
  -- fica nulo e a aplicação preserva o valor atual pelo `coalesce`.
  insert into public.partida_edicoes (partida_id, proposta_por, competitiva)
  values (p_partida_id, eu, p_competitiva)
  returning id into v_id;

  insert into public.avisos (jogador_id, tipo, partida_id)
  select pj.jogador_id, 'edicao_proposta', p_partida_id
  from public.partida_jogadores pj
  where pj.partida_id = p_partida_id
    and pj.papel = 'jogador'
    and pj.estado = 'aceito'
    and pj.desistiu_em is null
    and pj.jogador_id <> eu;

  return jsonb_build_object('aplicada', false, 'faltam', v_outros, 'edicao_id', v_id);
exception
  when unique_violation then
    raise exception 'JA_HA_PROPOSTA' using errcode = 'P0001';
end;
$fn$;


-- ============================================================
-- 3) PERMISSÕES
-- ============================================================
revoke all on function public.remover_participante(uuid, uuid) from public, anon;
grant execute on function public.remover_participante(uuid, uuid) to authenticated;

revoke all on function public.propor_declaracao_sessao(uuid, boolean) from public, anon;
grant execute on function public.propor_declaracao_sessao(uuid, boolean) to authenticated;


-- ============================================================
-- COMO CONFERIR
-- ============================================================
-- 1) A trava da vaga pública. Numa sessão híbrida em que alguém entrou
--    pela vaga, o organizador tentando remover essa pessoa recebe
--    VEIO_DA_VAGA_PUBLICA. Removendo um CONVIDADO que não pagou, funciona
--    normalmente.
--
-- 2) A declaração sozinho vale na hora:
--      select public.propor_declaracao_sessao('<sessao_so_com_voce>', false);
--      -- {"aplicada": true, "faltam": 0}
--
-- 3) E com gente dentro vira proposta:
--      select public.propor_declaracao_sessao('<sessao_com_3>', false);
--      -- {"aplicada": false, "faltam": 2, ...}
--    Cada um aprova com `responder_edicao_partida`, e só na última
--    aprovação a sessão muda.
--
-- 4) Depois de o jogo começar, PARTIDA_JA_COMECOU nos dois casos.
