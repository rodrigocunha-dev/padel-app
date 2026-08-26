-- ============================================================
-- 053 — "FALTA UM": A SESSÃO PRIVADA GANHA VAGAS ABERTAS
-- ============================================================
-- Hoje o app é tudo ou nada. Ou você convida as quatro pessoas (sessão
-- privada), ou abre o jogo para a cidade inteira (partida aberta). O caso
-- mais comum do padel de clube — "somos três, falta um" — não existe.
--
-- O caso híbrido já estava aprovado desde o começo, e o script `014` chegou
-- a citá-lo como motivo para NÃO criar uma tabela `sessoes` separada:
-- "a partida privada PODE ter vagas abertas — com duas tabelas, o híbrido
-- ficaria metade em cada uma". A estrutura sempre coube. Faltava a regra.
--
-- O QUE ESTE SCRIPT NÃO FAZ, de propósito:
--   • não muda o modelo de pagamento. O estranho que entra continua no
--     "caderninho" (reserva na confiança), igual à partida aberta de hoje.
--     O pagar-ao-entrar segue EM AVALIAÇÃO no CLAUDE.md e depende do
--     gateway real — inventá-lo aqui seria decidir no escuro.
--   • não deixa declarar amistosa ao abrir vaga. Sessão privada conta
--     sempre (decisão de 08/08/2026), e uma chavinha aqui devolveria pela
--     porta dos fundos o meio-termo que o fundador tirou de propósito:
--     bastaria abrir uma vaga, nunca preenchê-la, e marcar amistosa.
--   • não cria fila de substitutos no híbrido. Vaga cheia some do feed;
--     vaga que reabre volta a aparecer. Fila numa sessão privada mistura
--     duas mecânicas que já brigaram entre si uma vez (o `022`).


-- ============================================================
-- 1) AS DUAS COLUNAS NOVAS
-- ============================================================
-- ⚠️ VÊM ANTES DE TUDO. Toda função e toda trava abaixo consultam estas
-- colunas — foi exatamente essa ordem que derrubou o script `049` na mão
-- do fundador (política citando coluna criada mais abaixo no mesmo arquivo).

alter table public.partidas
  add column if not exists vagas_abertas smallint not null default 0;

alter table public.partidas drop constraint if exists vagas_abertas_nao_negativa;
alter table public.partidas
  add constraint vagas_abertas_nao_negativa check (vagas_abertas >= 0);

-- Vaga aberta só existe em sessão privada (na partida aberta TUDO é vaga
-- aberta), e só com faixa de categoria e sexo declarados.
--
-- ⚠️ Esta segunda metade não é burocracia: é a lição do furo nº 1 do `022`.
-- Sessão privada tem faixa nula, e em SQL `4 < null` não é falso, é NULO —
-- o `if` não entra e a trava de compatibilidade **parecia** barrar sem
-- barrar. Uma sessão com vaga aberta e faixa nula seria o mesmo furo de
-- volta, agora com a porta oficialmente aberta.
alter table public.partidas drop constraint if exists vaga_aberta_exige_filtros;
alter table public.partidas add constraint vaga_aberta_exige_filtros check (
  vagas_abertas = 0
  or (
    tipo = 'privada'
    and categoria_min is not null
    and categoria_max is not null
    and sexo_jogo is not null
  )
);

-- O aviso de que alguém de fora entrou no jogo do grupo.
--
-- ⚠️ A lista precisa repetir TODOS os tipos que já existem: `add constraint`
-- valida as linhas antigas, e um tipo esquecido aqui derruba o script no
-- meio. Os oito primeiros vêm do `051`.
alter table public.avisos drop constraint if exists avisos_tipo_check;
alter table public.avisos
  add constraint avisos_tipo_check
  check (tipo in ('set_registrado', 'votacao_aberta', 'promovido',
                  'edicao_proposta', 'chat_novas_mensagens',
                  'vaga_aberta', 'horarios_livres', 'horario_livre',
                  'entrou_na_vaga'));

-- Quem entrou pela vaga aberta não é convidado de ninguém. A diferença
-- importa na hora de sair: o convidado usa "Desistir" (a vaga fica em
-- troca e o pagamento fica com ele); o estranho que ainda não pagou
-- simplesmente sai, e a vaga volta para o feed.
alter table public.partida_jogadores
  add column if not exists entrou_pela_vaga boolean not null default false;


-- ============================================================
-- 2) O TAMANHO DA SESSÃO — e por que o divisor para de escorregar
-- ============================================================
-- Em 04/08/2026 o fundador viu R$130 divididos por 2 (R$65 cada, quadra
-- quitada) virarem R$43,33 quando um terceiro aceitou — e a tela passou a
-- cobrar mais por uma quadra já paga. A lição: divisor que se mexe depois
-- que o dinheiro andou deixa quem pagou sempre errado.
--
-- A vaga aberta traria esse fantasma de volta, porque o grupo cresce
-- SOZINHO conforme estranhos entram. A saída é contar a vaga vazia como se
-- já estivesse ocupada:
--
--     tamanho = quem ocupa vaga  +  vagas ainda abertas
--
-- Quando um estranho entra, o primeiro sobe 1 e o segundo desce 1. A soma
-- não muda, então o valor por pessoa não muda. O divisor fica estável por
-- construção, sem depender de congelamento nenhum.
create or replace function public.tamanho_da_sessao(p_partida_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $fn$
  select public.vagas_ocupadas(p_partida_id)
       + coalesce((select vagas_abertas from public.partidas where id = p_partida_id), 0);
$fn$;


-- O divisor passa a olhar o tamanho, não só quem já está dentro.
create or replace function public.divisor_da_partida(p_partida_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $fn$
  select greatest(
    public.minimo_de_jogadores(),
    coalesce(
      (select divisor_congelado from public.partidas where id = p_partida_id),
      public.tamanho_da_sessao(p_partida_id)
    )
  );
$fn$;


-- E o congelamento também. Sem isto, uma sessão de 5 (4 dentro + 1 vaga)
-- congelaria em 4 no primeiro pagamento, e o quinto jogaria de graça.
create or replace function public.congelar_divisor()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.partidas
  set divisor_congelado = greatest(
    public.minimo_de_jogadores(),
    public.tamanho_da_sessao(new.partida_id)
  )
  where id = new.partida_id
    and divisor_congelado is null;
  return new;
end;
$fn$;


-- ============================================================
-- 3) ABRIR E FECHAR VAGAS
-- ============================================================
-- Só o organizador. Abrir vaga é anunciar o jogo do grupo para estranhos,
-- e isso não é decisão de um convidado.
create or replace function public.abrir_vagas(
  p_partida_id uuid,
  p_vagas smallint,
  p_categoria_min smallint,
  p_categoria_max smallint,
  p_sexo_jogo text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org uuid := (select auth.uid());
  v_partida public.partidas;
  v_ocupadas integer;
  v_teto integer;
begin
  if v_org is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id for update;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_partida.organizador_id <> v_org then
    raise exception 'SO_O_ORGANIZADOR' using errcode = 'P0001';
  end if;
  if v_partida.tipo <> 'privada' then
    raise exception 'SO_EM_SESSAO_PRIVADA' using errcode = 'P0001';
  end if;
  if v_partida.status = 'cancelada' then
    raise exception 'PARTIDA_CANCELADA' using errcode = 'P0001';
  end if;
  -- Anunciar vaga para um jogo que já começou é convidar alguém a chegar
  -- atrasado numa quadra que já está em uso.
  if v_partida.inicio <= now() then
    raise exception 'PARTIDA_JA_COMECOU' using errcode = 'P0001';
  end if;
  if p_vagas < 1 then
    raise exception 'VAGAS_INVALIDAS' using errcode = 'P0001';
  end if;
  if p_categoria_min is null or p_categoria_max is null or p_sexo_jogo is null then
    raise exception 'FALTAM_FILTROS' using errcode = 'P0001';
  end if;
  if p_categoria_max < p_categoria_min then
    raise exception 'FAIXA_INVALIDA' using errcode = 'P0001';
  end if;

  select public.vagas_ocupadas(p_partida_id) into v_ocupadas;

  -- ⚠️ O teto NÃO é `max_jogadores`, e isso é deliberado. Em sessão privada
  -- essa coluna virou decorativa: o `014` a checava, mas o `020` reescreveu
  -- `convidar_participante` sem a checagem, então hoje um grupo convida à
  -- vontade enquanto o divisor não congelou. E `criar_sessao` grava 4 fixo
  -- em toda sessão — usar isso como teto barraria justamente o caso mais
  -- comum que o fundador descreve, o grupo de 5–6 querendo mais um.
  -- Fica o limite do produto (regra nº 6: de 4 a 8 jogadores).
  v_teto := 8;

  -- Se o divisor JÁ congelou, ele manda: passar dele significaria arrecadar
  -- mais que o preço da quadra, ou baixar a conta de quem já pagou. Nenhum
  -- dos dois pode acontecer por decisão de outra pessoa.
  if v_partida.divisor_congelado is not null then
    v_teto := least(v_teto, v_partida.divisor_congelado);
  end if;

  if v_ocupadas + p_vagas > v_teto then
    raise exception 'PASSA_DO_TAMANHO' using errcode = 'P0001';
  end if;

  update public.partidas
  set vagas_abertas = p_vagas,
      categoria_min = p_categoria_min,
      categoria_max = p_categoria_max,
      sexo_jogo     = p_sexo_jogo
  where id = p_partida_id;
end;
$fn$;


-- Fechar é só zerar as vagas. A faixa e o sexo ficam gravados de propósito:
-- se o grupo reabrir a vaga depois, a tela já vem preenchida com o que ele
-- escolheu da primeira vez. Com `vagas_abertas = 0` eles não filtram nada.
create or replace function public.fechar_vagas(p_partida_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org uuid := (select auth.uid());
  v_partida public.partidas;
begin
  if v_org is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;

  select * into v_partida from public.partidas where id = p_partida_id for update;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;
  if v_partida.organizador_id <> v_org then
    raise exception 'SO_O_ORGANIZADOR' using errcode = 'P0001';
  end if;

  update public.partidas set vagas_abertas = 0 where id = p_partida_id;
end;
$fn$;


-- ============================================================
-- 4) ENTRAR — a porta que o `022` fechou, entreaberta com regra
-- ============================================================
-- O `022` fechou `entrar_na_partida` para sessão privada porque estranhos
-- estavam entrando sem convite. Isso continua valendo: o padrão é fechado.
-- O que muda é que agora existe uma porta explícita, aberta pelo
-- organizador, com número de vagas e filtro declarados.
create or replace function public.entrar_na_partida(p_partida_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := (select auth.uid());
  v_partida public.partidas;
  v_qtd_jogadores integer;
  v_proxima_ordem integer;
  v_papel text;
  v_pela_vaga boolean := false;
begin
  if v_jog is null then
    raise exception 'PRECISA_LOGIN' using errcode = 'P0001';
  end if;
  if public.jogador_inadimplente(v_jog) then
    raise exception 'PENDENCIA' using errcode = 'P0001';
  end if;

  -- O `for update` é o que impede duas pessoas de levarem a mesma última
  -- vaga: a segunda espera a primeira terminar e já lê `vagas_abertas`
  -- descontada.
  select * into v_partida from public.partidas where id = p_partida_id for update;
  if v_partida.id is null then
    raise exception 'PARTIDA_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;

  if v_partida.tipo <> 'aberta' then
    if v_partida.vagas_abertas < 1 then
      raise exception 'SO_POR_CONVITE' using errcode = 'P0001';
    end if;
    v_pela_vaga := true;
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

  select count(*) into v_qtd_jogadores
  from public.partida_jogadores
  where partida_id = p_partida_id and papel = 'jogador' and estado = 'aceito';

  select coalesce(max(ordem), 0) + 1 into v_proxima_ordem
  from public.partida_jogadores where partida_id = p_partida_id;

  if v_pela_vaga then
    -- No híbrido não existe fila: ou tem vaga anunciada, ou não se entra.
    -- A vaga tomada some do anúncio na mesma transação.
    v_papel := 'jogador';
    update public.partidas
    set vagas_abertas = vagas_abertas - 1
    where id = p_partida_id;
  elsif v_qtd_jogadores < v_partida.max_jogadores then
    v_papel := 'jogador';
  else
    v_papel := 'substituto';
  end if;

  insert into public.partida_jogadores
    (partida_id, jogador_id, papel, ordem, estado, entrou_pela_vaga)
  values
    (p_partida_id, v_jog, v_papel, v_proxima_ordem, 'aceito', v_pela_vaga);

  -- Um desconhecido entrando no jogo de um grupo não pode acontecer em
  -- silêncio: essas pessoas se conhecem e vão jogar juntas. O grupo INTEIRO
  -- é avisado, não só o organizador — quem vai dividir a quadra com alguém
  -- novo é todo mundo.
  --
  -- Isto não vira enxurrada como o chat: acontece UMA vez por vaga
  -- preenchida, e o número de vagas é o organizador quem escolhe.
  if v_pela_vaga then
    insert into public.avisos (jogador_id, tipo, partida_id)
    select pj.jogador_id, 'entrou_na_vaga', p_partida_id
    from public.partida_jogadores pj
    where pj.partida_id = p_partida_id
      and pj.jogador_id <> v_jog
      and pj.papel = 'jogador'
      and pj.estado = 'aceito'
      and pj.desistiu_em is null;
  end if;

  -- `status = 'completa'` é linguagem da partida aberta (é o que tira do
  -- feed e liga a fila). No híbrido quem faz esse papel é `vagas_abertas`,
  -- então mexer no status aqui só criaria dois donos da mesma verdade.
  if not v_pela_vaga
     and v_papel = 'jogador'
     and v_qtd_jogadores + 1 = v_partida.max_jogadores then
    update public.partidas set status = 'completa' where id = p_partida_id;
  end if;

  return v_papel;
end;
$fn$;


-- ============================================================
-- 5) SAIR — o estranho sai, o convidado desiste
-- ============================================================
-- São saídas diferentes porque significam coisas diferentes. O convidado
-- faz parte do grupo: a vaga dele fica em troca, e o pagamento continua
-- valendo (decisão de 04/08/2026). O estranho que acabou de entrar e ainda
-- não pagou não deixa nada para trás — a vaga volta a ser anunciada.
create or replace function public.sair_da_partida(p_partida_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_jog uuid := (select auth.uid());
  v_partida public.partidas;
  v_papel text;
  v_pela_vaga boolean;
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

  select papel, entrou_pela_vaga into v_papel, v_pela_vaga
  from public.partida_jogadores
  where partida_id = p_partida_id and jogador_id = v_jog;

  if v_papel is null then
    raise exception 'NAO_ESTA_NA_PARTIDA' using errcode = 'P0001';
  end if;

  -- Antes do desvio por tipo, senão o organizador de uma sessão ouviria
  -- "use Desistir" quando o certo é "organizador não sai".
  if v_jog = v_partida.organizador_id then
    raise exception 'ORGANIZADOR_NAO_SAI' using errcode = 'P0001';
  end if;

  if v_partida.tipo <> 'aberta' then
    -- Convidado continua sem esta porta: o caminho dele é recusar ou
    -- "Desistir", e nenhum dos dois apaga a linha.
    if not coalesce(v_pela_vaga, false) then
      raise exception 'USE_DESISTIR' using errcode = 'P0001';
    end if;
    -- Quem já pagou não some sem deixar rastro: o valor está quitado para
    -- o clube e a vaga é de outra pessoa. Isso é exatamente "Desistir".
    if exists (
      select 1 from public.pagamentos
      where partida_id = p_partida_id
        and jogador_id = v_jog
        and status = 'pago'
    ) then
      raise exception 'PAGOU_USE_DESISTIR' using errcode = 'P0001';
    end if;
  end if;

  delete from public.partida_jogadores
  where partida_id = p_partida_id and jogador_id = v_jog;

  if coalesce(v_pela_vaga, false) then
    -- A vaga volta ao anúncio. Só isso: no híbrido não há fila nem status
    -- 'completa' para desfazer.
    --
    -- Ela volta mesmo que o organizador já tivesse FECHADO os anúncios, e
    -- isso é de propósito: o que mantém o valor por pessoa parado é a soma
    -- "ocupadas + abertas" não mudar. Sem devolver a vaga, quem ficou
    -- passaria a dever mais por causa da saída de outra pessoa — que é
    -- exatamente o defeito que o divisor congelado existe para impedir. Se
    -- o grupo não quiser mais ninguém, é um toque em "Fechar as vagas".
    update public.partidas
    set vagas_abertas = vagas_abertas + 1
    where id = p_partida_id;
    return;
  end if;

  if v_papel = 'jogador' then
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

      -- ⚠️ Este aviso é do `032` e quase se perdeu aqui: eu reescrevi esta
      -- função a partir da versão do `022`, que é ANTERIOR a ele. Sem o
      -- aviso, quem sobe de substituto a jogador sobe em silêncio — que era
      -- exatamente o buraco que o `032` fechou.
      insert into public.avisos (jogador_id, tipo, partida_id)
      values (v_promovido, 'promovido', p_partida_id);
    else
      update public.partidas set status = 'aberta'
      where id = p_partida_id and status = 'completa';
    end if;
  end if;
end;
$fn$;


-- ============================================================
-- 6) CONVIDAR PRECISA ENXERGAR A VAGA ANUNCIADA
-- ============================================================
-- ⚠️ Esta é a versão do `020` copiada inteira, com UMA linha alterada.
-- Escrevi uma versão "limpa" primeiro e ela teria causado dois estragos:
-- a de hoje tem TRÊS argumentos (o de dois foi apagado de propósito no
-- `020`, para a chamada não ficar ambígua), e carrega a vaga-alvo do
-- "Desistir", o `on conflict` de quem já tinha recusado e a trava por
-- divisor congelado. Reescrever de memória apagaria tudo isso.
--
-- A linha que muda: depois que o divisor congela, a vaga ANUNCIADA também
-- é um lugar já prometido. Sem contá-la, o organizador convidaria alguém
-- para o lugar do estranho, e o estranho entrando estouraria o divisor —
-- ou seja, mais gente do que a quadra que foi paga.
create or replace function public.convidar_participante(
  p_partida_id uuid,
  p_jogador_id uuid,
  p_substitui uuid default null
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
    raise exception 'SO_O_ORGANIZADOR_CONVIDA' using errcode = 'P0001';
  end if;
  if v_partida.status = 'cancelada' then
    raise exception 'PARTIDA_CANCELADA' using errcode = 'P0001';
  end if;
  if v_partida.inicio <= now() then
    raise exception 'PARTIDA_JA_COMECOU' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.jogadores where id = p_jogador_id) then
    raise exception 'PRECISA_TER_CONTA' using errcode = 'P0001';
  end if;

  -- Se disse qual vaga preenche, essa pessoa precisa ter oferecido a dela.
  if p_substitui is not null and not exists (
    select 1 from public.partida_jogadores
    where partida_id = p_partida_id
      and jogador_id = p_substitui
      and estado = 'aceito'
      and desistiu_em is not null
  ) then
    raise exception 'VAGA_ALVO_INVALIDA' using errcode = 'P0001';
  end if;

  if v_partida.divisor_congelado is not null
     and public.vagas_ocupadas(p_partida_id) + v_partida.vagas_abertas
         >= v_partida.divisor_congelado then
    raise exception 'SEM_VAGA_ABERTA' using errcode = 'P0001';
  end if;

  insert into public.partida_jogadores (
    partida_id, jogador_id, papel, ordem, estado,
    convidado_por, convidado_em, substitui_jogador_id
  ) values (
    p_partida_id, p_jogador_id, 'jogador',
    coalesce((select max(ordem) from public.partida_jogadores where partida_id = p_partida_id), 0) + 1,
    'convidado', v_org, now(), p_substitui
  )
  on conflict (partida_id, jogador_id) do update
    set estado = 'convidado',
        desistiu_em = null,
        convidado_por = v_org,
        convidado_em = now(),
        respondido_em = null,
        substitui_jogador_id = p_substitui
    where public.partida_jogadores.estado in ('recusado', 'saiu');
end;
$fn$;


-- ============================================================
-- 7) QUEM VÊ A SESSÃO COM VAGA ABERTA
-- ============================================================
-- O `023` fechou a leitura das partidas com uma frase só, de propósito:
-- "você vê uma partida se ela é aberta, ou se tem qualquer vínculo com
-- ela". Lista de estados foi o formato que produziu os furos daquela
-- varredura. A frase continua com o mesmo formato, só ganha um caso:
-- **ou se ela está anunciando vaga**.
--
-- Consequência aceita: enquanto houver vaga anunciada, qualquer pessoa
-- logada vê quem já está nesse jogo — exatamente como numa partida aberta.
-- Fechada a última vaga, a sessão volta a ser visível só para quem tem
-- vínculo. Quem entrou pela vaga tem vínculo, então não perde o acesso.
create or replace function public.posso_ver_partida(p_partida_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $fn$
  select exists (
    select 1
    from public.partidas p
    where p.id = p_partida_id
      and (
        p.tipo = 'aberta'
        or p.vagas_abertas > 0
        or p.organizador_id = (select auth.uid())
        or exists (
          select 1
          from public.partida_jogadores pj
          where pj.partida_id = p.id
            and pj.jogador_id = (select auth.uid())
        )
      )
  );
$fn$;


-- ============================================================
-- 8) O TEXTO DO AVISO NOVO
-- ============================================================
-- Cópia EXATA da versão do `050`, com dois ramos a mais (título e corpo do
-- `entrou_na_vaga`). Não redigitei a função: ela é o caminho de TODAS as
-- notificações do app, e um erro de transcrição aqui quebraria o push de
-- tudo, não só o desta entrega. Extraí o texto do arquivo anterior.

create or replace function public.push_pendentes(p_limite integer default 200)
returns table (
  aviso_id uuid, inscricao_id uuid, endpoint text, p256dh text, auth text,
  titulo text, corpo text, url text, tag text, silencioso boolean
)
language sql
security definer
set search_path = public
stable
as $fn$
  with base as (
    select a.id as aviso_id, a.tipo, a.jogador_id, a.criado_em, a.push_reenvio,
           coalesce(a.partida_id, s.partida_id) as partida_id,
           a.clube_id,
           a.promocao_id,
           coalesce(cp.nome, cc.nome) as clube,
           p.inicio,
           (
             select count(*)
             from public.mensagens m
             left join public.leitura_chat l
               on l.partida_id = m.partida_id and l.jogador_id = a.jogador_id
             where m.partida_id = coalesce(a.partida_id, s.partida_id)
               and m.autor_id <> a.jogador_id
               and (l.lido_ate is null or m.criado_em > l.lido_ate)
           ) as nao_lidas,
           -- Quantos horários da campanha servem para ESTA pessoa. É o
           -- número que faz o aviso valer a pena abrir.
           (
             select count(*)
             from public.promocao_horarios ph
             where ph.promocao_id = a.promocao_id
               and public.horario_na_disponibilidade(a.jogador_id, ph.inicio)
           ) as horarios_para_ele
    from public.avisos a
    left join public.sets s on s.id = a.set_id
    left join public.partidas p on p.id = coalesce(a.partida_id, s.partida_id)
    left join public.quadras q on q.id = p.quadra_id
    left join public.clubes cp on cp.id = q.clube_id
    left join public.clubes cc on cc.id = a.clube_id
    where a.push_enviado_em is null
      and a.lido_em is null
      and a.criado_em > now() - interval '24 hours'
      and (a.partida_id is not null or s.partida_id is not null
           or a.clube_id is not null)
  )
  select b.aviso_id, i.id, i.endpoint, i.p256dh, i.auth,

    case b.tipo
      when 'set_registrado'       then 'Registraram um resultado do seu jogo'
      when 'votacao_aberta'       then 'Há um placar em disputa'
      when 'promovido'            then 'Você entrou no jogo!'
      when 'horario_livre'        then 'Quadra livre ' ||
                                       coalesce('no ' || b.clube, 'perto de você')
      when 'edicao_proposta'      then 'Querem mudar seu jogo'
      when 'vaga_aberta'          then 'Abriu vaga numa partida do seu nível'
      when 'entrou_na_vaga'       then 'Entrou alguém no jogo do grupo'
      when 'horarios_livres'      then
        case when b.horarios_para_ele > 1
             then b.horarios_para_ele || ' horários livres para você'
             else 'Horário livre para você' end
      when 'chat_novas_mensagens' then
        case when b.nao_lidas > 1
             then b.nao_lidas || ' mensagens novas no seu jogo'
             else 'Mensagem nova no seu jogo' end
      else 'Novidade no app'
    end,

    case b.tipo
      when 'set_registrado' then
        'Confira. Se não estiver certo, você tem 24h para contestar.'
      when 'votacao_aberta' then
        'Você estava lá. Toque para dizer qual placar está certo.'
      when 'promovido' then
        'Abriu vaga e você saiu da fila. Confira o horário e a quadra.'
      when 'horario_livre' then
        'Sobrou horário na agenda. Toque para ver e reservar.'
      when 'edicao_proposta' then
        coalesce(b.clube || ': o', 'O') ||
        ' organizador pediu uma mudança. Nada muda sem a sua aprovação.'
      when 'vaga_aberta' then
        coalesce(
          b.clube || ', ' ||
          to_char(b.inicio at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24"h"') ||
          ' · toque para entrar',
          'Toque para ver a partida.'
        )
      when 'entrou_na_vaga' then
        coalesce(
          'A vaga que vocês anunciaram foi preenchida. ' || b.clube || ', ' ||
          to_char(b.inicio at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24"h"'),
          'A vaga que vocês anunciaram foi preenchida. Toque para ver quem é.'
        )
      when 'horarios_livres' then
        coalesce(b.clube || ': horários', 'Horários') ||
        ' que combinam com os seus dias. Toque para ver.'
      when 'chat_novas_mensagens' then
        coalesce(
          b.clube || ', ' ||
          to_char(b.inicio at time zone 'America/Sao_Paulo', 'DD/MM') ||
          ' · toque para ler e responder',
          'Toque para ler e responder.'
        )
      else 'Toque para ver.'
    end,

    case
      when b.partida_id is not null then '/app/partidas/' || b.partida_id
      else '/app/clubes/' || b.clube_id
    end,

    b.tipo || '-' || coalesce(b.partida_id::text, b.clube_id::text),
    b.push_reenvio

  from base b
  join public.push_inscricoes i on i.jogador_id = b.jogador_id
  where i.invalidado_em is null
  order by b.criado_em
  limit p_limite;
$fn$;

revoke all on function public.push_pendentes(integer) from public, anon, authenticated;


-- ============================================================
-- 9) PERMISSÕES
-- ============================================================
revoke all on function public.tamanho_da_sessao(uuid) from public, anon;
grant execute on function public.tamanho_da_sessao(uuid) to authenticated;

revoke all on function public.abrir_vagas(uuid, smallint, smallint, smallint, text) from public, anon;
grant execute on function public.abrir_vagas(uuid, smallint, smallint, smallint, text) to authenticated;

revoke all on function public.fechar_vagas(uuid) from public, anon;
grant execute on function public.fechar_vagas(uuid) to authenticated;

revoke all on function public.divisor_da_partida(uuid) from public, anon;
grant execute on function public.divisor_da_partida(uuid) to authenticated;

revoke all on function public.entrar_na_partida(uuid) from public, anon;
grant execute on function public.entrar_na_partida(uuid) to authenticated;

revoke all on function public.sair_da_partida(uuid) from public, anon;
grant execute on function public.sair_da_partida(uuid) to authenticated;

-- ⚠️ TRÊS argumentos. A versão de dois foi apagada no `020` justamente
-- para a chamada não ficar ambígua; recriá-la traria de volta o erro
-- "function is not unique".
revoke all on function public.convidar_participante(uuid, uuid, uuid) from public, anon;
grant execute on function public.convidar_participante(uuid, uuid, uuid) to authenticated;

revoke all on function public.posso_ver_partida(uuid) from public, anon;
grant execute on function public.posso_ver_partida(uuid) to authenticated;


-- ============================================================
-- COMO CONFERIR
-- ============================================================
-- 1) Nenhuma sessão anuncia vaga sem filtro (deve dar 0):
--      select count(*) from public.partidas
--      where vagas_abertas > 0
--        and (categoria_min is null or sexo_jogo is null or tipo <> 'privada');
--
-- 2) O tamanho não muda quando alguém entra pela vaga. Antes e depois de
--    um estranho entrar, isto tem de devolver o MESMO número:
--      select public.tamanho_da_sessao('<partida_id>'),
--             public.divisor_da_partida('<partida_id>');
--
-- 3) Sessão privada sem vaga anunciada continua fechada para estranhos:
--      select public.entrar_na_partida('<sessao_sem_vaga>');  -- SO_POR_CONVITE
