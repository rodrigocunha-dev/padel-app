-- Sprint 5 (varredura) — regras escritas ANTES do convite existir
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- POR QUE ESTE SCRIPT EXISTE
-- ============================================================
-- A Entrega A já rendeu três correções da mesma família: "Minhas partidas"
-- mostrando convite pendente como jogo seu, o rateio visível para quem só
-- foi convidado (`017`) e o convidado virando inadimplente (`021`).
--
-- Este script é a varredura que faltava. Cada função abaixo foi escrita no
-- Sprint 4, quando estar em `partida_jogadores` significava estar jogando.
-- Depois do script `014` deixou de significar — e nenhuma delas foi relida.
--
-- Os quatro furos abaixo foram REPRODUZIDOS no banco em 08/08/2026, com
-- quatro contas de teste e uma sessão privada descartável. Não são leitura
-- de código: cada um foi visto acontecendo.

-- ============================================================
-- FURO 1 — QUALQUER PESSOA ENTRAVA NUMA SESSÃO PRIVADA SEM CONVITE
-- ============================================================
-- `entrar_na_partida` é o botão "entrar" da partida ABERTA. Ela nunca
-- olhou `tipo`, porque quando foi escrita só existia partida aberta.
--
-- Testado: o Eduardo, sem convite nenhum, chamou a função numa sessão
-- privada do Rodrigo e **entrou como jogador aceito**. Isso derruba a
-- decisão central da Entrega A — "ninguém entra numa partida (e numa conta
-- a pagar) sem dizer sim" — e ainda entra na divisão do valor, pode
-- registrar set, contestar e votar.
--
-- Duas travas, porque uma só não basta:
--   (a) a função recusa partida que não seja aberta;
--   (b) `jogador_compativel` deixa de dar "compatível" para faixa nula.
--
-- O (b) importa: sessão privada não tem faixa de categoria nem sexo do jogo
-- (são nulos desde o `014`). Em SQL, `4 < null` não é falso, é **nulo** — e
-- `if null then` não entra. Ou seja, a checagem de compatibilidade estava
-- passando batido em toda sessão privada. É o tipo de furo que não aparece
-- lendo rápido, porque o código "parece" que compara.

create or replace function public.jogador_compativel(
  p_partida public.partidas,
  p_jogador_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $fn$
declare
  v_categoria smallint;
  v_sexo text;
begin
  select categoria, sexo into v_categoria, v_sexo
  from public.jogadores where id = p_jogador_id;

  if v_categoria is null then
    return false;  -- sem perfil completo
  end if;

  -- NOVO: sem faixa declarada não existe "compatível". Quem não tem faixa é
  -- a sessão privada, e nela o caminho é o convite, não a compatibilidade.
  if p_partida.categoria_min is null or p_partida.categoria_max is null
     or p_partida.sexo_jogo is null then
    return false;
  end if;

  if v_categoria < p_partida.categoria_min
     or v_categoria > p_partida.categoria_max then
    return false;
  end if;

  -- Jogo masculino/feminino exige o sexo correspondente; mista aceita todos.
  if p_partida.sexo_jogo <> 'mista' then
    if v_sexo is null or v_sexo <> p_partida.sexo_jogo then
      return false;
    end if;
  end if;

  return true;
end;
$fn$;


create or replace function public.entrar_na_partida(p_partida_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  v_partida public.partidas;
  v_qtd_jogadores integer;
  v_proxima_ordem integer;
  v_papel text;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;
  if public.jogador_inadimplente(v_jog) then
    raise exception 'PENDENCIA' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id for update;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;

  -- NOVO: em sessão privada só se entra por convite aceito.
  if v_partida.tipo <> 'aberta' then
    raise exception 'SO_POR_CONVITE' using errcode = 'P0001';
  end if;

  if v_partida.status = 'cancelada' then
    raise exception 'PARTIDA_CANCELADA' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.partida_jogadores
             where partida_id = p_partida_id and jogador_id = v_jog) then
    raise exception 'JA_ESTA_NA_PARTIDA' using errcode = 'P0001';
  end if;
  if not public.jogador_compativel(v_partida, v_jog) then
    raise exception 'INCOMPATIVEL' using errcode = 'P0001';
  end if;

  -- NOVO: quem conta para as vagas é quem ACEITOU. Em partida aberta todo
  -- mundo é 'aceito', então nada muda hoje — mas a conta passa a estar certa
  -- se um dia a partida aberta também tiver convite.
  select count(*) into v_qtd_jogadores
  from public.partida_jogadores
  where partida_id = p_partida_id and papel = 'jogador' and estado = 'aceito';

  select coalesce(max(ordem), 0) + 1 into v_proxima_ordem
  from public.partida_jogadores where partida_id = p_partida_id;

  if v_qtd_jogadores < v_partida.max_jogadores then
    v_papel := 'jogador';
  else
    v_papel := 'substituto';
  end if;

  insert into public.partida_jogadores (partida_id, jogador_id, papel, ordem)
  values (p_partida_id, v_jog, v_papel, v_proxima_ordem);

  if v_papel = 'jogador' and v_qtd_jogadores + 1 = v_partida.max_jogadores then
    update public.partidas set status = 'completa' where id = p_partida_id;
  end if;

  return v_papel;
end;
$fn$;

revoke all on function public.entrar_na_partida(uuid) from public, anon;
grant execute on function public.entrar_na_partida(uuid) to authenticated;


-- ============================================================
-- FURO 2 — O ORGANIZADOR RECEBIA O TELEFONE DE QUEM NUNCA ACEITOU
-- ============================================================
-- `contato_jogadores_partida` é o caminho controlado que reabre o telefone
-- (fechado no `008`) para o organizador cobrar. Ela devolve todo mundo com
-- `papel = 'jogador'`, sem olhar o estado.
--
-- Testado: o organizador recebeu nome e telefone do Carlos, que só tinha
-- sido **convidado e nunca respondeu**, e do Diego, que **recusou**.
--
-- Isso é o contrário do combinado. O telefone existe aqui para cobrar quem
-- deve; quem não aceitou não deve nada. Na prática, bastaria convidar
-- alguém — sem que essa pessoa fizesse nada — para obter o telefone dela.
create or replace function public.contato_jogadores_partida(p_partida_id uuid)
returns table (jogador_id uuid, nome text, telefone text)
language plpgsql
security definer
set search_path = public
stable
as $fn$
begin
  if not exists (
    select 1 from public.partidas
    where id = p_partida_id and organizador_id = auth.uid()
  ) then
    raise exception 'SO_O_ORGANIZADOR' using errcode = 'P0001';
  end if;

  return query
    select j.id, j.nome, j.telefone
    from public.partida_jogadores pj
    join public.jogadores j on j.id = pj.jogador_id
    where pj.partida_id = p_partida_id
      and pj.papel = 'jogador'
      -- NOVO: só quem aceitou. Convidado, recusado e quem já foi substituído
      -- ('saiu') não entram na cobrança — logo, não têm telefone reaberto.
      and pj.estado = 'aceito';
end;
$fn$;

revoke all on function public.contato_jogadores_partida(uuid) from public, anon;
grant execute on function public.contato_jogadores_partida(uuid) to authenticated;


-- ============================================================
-- FURO 3 — "SAIR" APAGAVA A PESSOA DA SESSÃO POR FORA DO "DESISTIR"
-- ============================================================
-- `sair_da_partida` **apaga a linha** e promove o primeiro substituto. Faz
-- sentido na partida aberta, onde a fila existe e ninguém foi convidado.
--
-- Na sessão privada não faz. O caminho de lá (`018`) é o "Desistir": a vaga
-- fica disponível **sem a pessoa sair**, ela só sai quando alguém assume,
-- pode voltar atrás, e o pagamento dela continua valendo a vaga. Apagar a
-- linha atropela tudo isso — inclusive o divisor congelado, que passa a não
-- bater com quem está na sessão.
--
-- Testado: o Carlos, apenas convidado, sumiu da sessão sem que ficasse
-- registrado que houve convite. Recusar deixa rastro ('recusado'); sumir
-- não deixa nenhum — e é justamente esse rastro que a reputação de conduta
-- (Fase 2) vai precisar ler.
create or replace function public.sair_da_partida(p_partida_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := auth.uid();
  v_partida public.partidas;
  v_papel text;
  v_promovido uuid;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas
  where id = p_partida_id for update;

  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;

  -- NOVO: na sessão privada a saída tem caminho próprio — recusar o convite
  -- ou "Desistir". Nenhum dos dois apaga a linha.
  if v_partida.tipo <> 'aberta' then
    raise exception 'USE_DESISTIR' using errcode = 'P0001';
  end if;

  if v_jog = v_partida.organizador_id then
    raise exception 'ORGANIZADOR_NAO_SAI' using errcode = 'P0001';
  end if;

  select papel into v_papel from public.partida_jogadores
  where partida_id = p_partida_id and jogador_id = v_jog;

  if v_papel is null then
    raise exception 'NAO_ESTA_NA_PARTIDA' using errcode = 'P0001';
  end if;

  delete from public.partida_jogadores
  where partida_id = p_partida_id and jogador_id = v_jog;

  if v_papel = 'jogador' then
    -- Promove o primeiro da fila de substitutos, se houver.
    select jogador_id into v_promovido
    from public.partida_jogadores
    where partida_id = p_partida_id
      and papel = 'substituto'
      and estado = 'aceito'
    order by ordem
    limit 1;

    if v_promovido is not null then
      update public.partida_jogadores set papel = 'jogador'
      where partida_id = p_partida_id and jogador_id = v_promovido;
    else
      -- Sem substituto: abriu vaga, a partida volta a ficar aberta.
      update public.partidas set status = 'aberta'
      where id = p_partida_id and status = 'completa';
    end if;
  end if;
end;
$fn$;

revoke all on function public.sair_da_partida(uuid) from public, anon;
grant execute on function public.sair_da_partida(uuid) to authenticated;


-- ============================================================
-- FURO 4 — QUALQUER PESSOA GRAVAVA PAGAMENTO EM PARTIDA ALHEIA
-- ============================================================
-- A política `pagamentos_gerencia_proprio` (`010`) confere uma coisa só:
-- que a linha é do próprio jogador. Ela **não confere se essa pessoa está
-- na partida**. Quando foi escrita, a única forma de aparecer numa partida
-- era entrando nela — a checagem parecia redundante.
--
-- Testado: o Eduardo, que não é participante nem foi convidado, gravou um
-- pagamento numa sessão do Rodrigo. E aí vem o estrago de verdade: o
-- gatilho `trg_congelar_divisor` (`018`) dispara em QUALQUER inserção em
-- `pagamentos` — então esse pagamento de fora **congelou o divisor da
-- sessão em 4**, com o grupo ainda se formando.
--
-- Isso é exatamente o que a regra do divisor congelado existe para
-- impedir: "ninguém que já pagou pode ter a conta alterada por decisão de
-- outra pessoa". Só que a decisão de congelar estava aberta a estranhos.
--
-- A correção é a pergunta que faltava: só grava pagamento quem ACEITOU
-- estar na partida.
drop policy if exists "pagamentos_gerencia_proprio" on public.pagamentos;
create policy "pagamentos_gerencia_proprio"
  on public.pagamentos for all to authenticated
  using (
    (select auth.uid()) = jogador_id
    and exists (
      select 1 from public.partida_jogadores pj
      where pj.partida_id = pagamentos.partida_id
        and pj.jogador_id = (select auth.uid())
        and pj.papel = 'jogador'
        and pj.estado = 'aceito'
    )
  )
  with check (
    (select auth.uid()) = jogador_id
    and exists (
      select 1 from public.partida_jogadores pj
      where pj.partida_id = pagamentos.partida_id
        and pj.jogador_id = (select auth.uid())
        and pj.papel = 'jogador'
        and pj.estado = 'aceito'
    )
  );

-- Atenção para quando o gateway real entrar: quem desiste continua com o
-- pagamento válido (decisão de 04/08/2026), e o estado dele vira 'saiu'.
-- Com a política acima ele deixa de conseguir LER o próprio pagamento
-- dessa partida. Hoje não incomoda — o valor já está quitado e a vaga é de
-- outra pessoa —, mas se um dia existir recibo ou estorno, é aqui que se
-- mexe.
