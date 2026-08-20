-- ============================================================
-- 044 — O NÚMERO DE MENSAGENS NA NOTIFICAÇÃO DO CHAT
-- ============================================================
-- Decisão do fundador (17/08/2026), depois de uma conversa que corrigiu uma
-- suposição dele e uma limitação minha:
--
--  - Ele achava que não dá para mudar uma notificação já enviada. DÁ: cada
--    notificação vai com uma etiqueta, e outra com a mesma etiqueta
--    SUBSTITUI a anterior na tela em vez de empilhar.
--  - Mas colocar o número só no envio não resolveria: o aviso nasce na
--    PRIMEIRA mensagem não lida, então o número seria sempre 1.
--
-- Então: a primeira mensagem alerta; cada mensagem seguinte manda uma
-- atualização SILENCIOSA, que troca o texto na tela sem vibrar de novo.
-- Isso não desfaz a decisão do script 042 — o combinado era não INCOMODAR
-- por mensagem, não deixar de atualizar.
--
-- ⚠️ O comportamento de "substituir sem vibrar" é padrão da web e conhecido
-- no Android. NO IPHONE NÃO ESTÁ VERIFICADO — e nesta mesma semana eu errei
-- dois palpites seguidos sobre o iOS antes de parar de adivinhar e medir no
-- aparelho do fundador. Este script é para SER TESTADO no celular dele: duas
-- mensagens seguidas têm de vibrar UMA vez.


-- ============================================================
-- 1) MARCAR O QUE É REENVIO
-- ============================================================
-- Sem isto não dá para o service worker saber se deve alertar ou atualizar
-- em silêncio: os dois chegam pelo mesmo caminho.

alter table public.avisos
  add column if not exists push_reenvio boolean not null default false;


-- ============================================================
-- 2) O GATILHO PASSA A REENVIAR EM VEZ DE PULAR
-- ============================================================
-- Antes (script 042): existindo aviso não lido, a mensagem nova não fazia
-- nada. Agora ela devolve o MESMO aviso para a fila de envio, marcado como
-- reenvio — mesma etiqueta, texto novo, sem barulho.

create or replace function public.mensagem_avisa_grupo()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Quem AINDA NÃO TEM aviso não lido: nasce um, e este alerta.
  insert into public.avisos (jogador_id, tipo, partida_id)
  select pj.jogador_id, 'chat_novas_mensagens', new.partida_id
  from public.partida_jogadores pj
  where pj.partida_id = new.partida_id
    and pj.papel = 'jogador'
    and pj.estado = 'aceito'
    and pj.jogador_id <> new.autor_id
    and not exists (
      select 1 from public.avisos a
      where a.jogador_id = pj.jogador_id
        and a.partida_id = new.partida_id
        and a.tipo = 'chat_novas_mensagens'
        and a.lido_em is null
    )
    -- Está com a conversa aberta agora: não vibra o bolso de quem já olha.
    and not exists (
      select 1 from public.leitura_chat l
      where l.partida_id = new.partida_id
        and l.jogador_id = pj.jogador_id
        and l.lido_ate > now() - interval '2 minutes'
    );

  -- Quem JÁ TEM aviso não lido: o mesmo aviso volta para a fila, silencioso.
  update public.avisos a
  set push_enviado_em = null,
      push_reenvio = true
  where a.partida_id = new.partida_id
    and a.tipo = 'chat_novas_mensagens'
    and a.lido_em is null
    and a.jogador_id <> new.autor_id
    and a.push_enviado_em is not null
    and not exists (
      select 1 from public.leitura_chat l
      where l.partida_id = new.partida_id
        and l.jogador_id = a.jogador_id
        and l.lido_ate > now() - interval '2 minutes'
    );

  return null;
end;
$fn$;


-- ============================================================
-- 3) O TEXTO PASSA A CONTAR
-- ============================================================

-- ⚠️ PRECISA APAGAR ANTES, e não é opcional: esta versão devolve uma coluna
-- a mais (`silencioso`), e o Postgres recusa `create or replace` quando o
-- formato do retorno muda — "cannot change return type of existing function".
--
-- Apagar é seguro aqui: nada no banco depende desta função. Quem a chama é o
-- endpoint de envio, por RPC, em tempo de execução. Os `grant`/`revoke` são
-- reaplicados no fim do script, porque o `drop` leva as permissões junto.
drop function if exists public.push_pendentes(integer);

create function public.push_pendentes(p_limite integer default 200)
returns table (
  aviso_id uuid,
  inscricao_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  titulo text,
  corpo text,
  url text,
  tag text,
  silencioso boolean
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
           coalesce(cp.nome, cc.nome) as clube,
           p.inicio,
           -- Quantas mensagens esta pessoa ainda não leu NESTA partida.
           -- Calculado na hora do envio, e é isso que faz o número subir a
           -- cada atualização em vez de ficar preso no 1.
           (
             select count(*)
             from public.mensagens m
             left join public.leitura_chat l
               on l.partida_id = m.partida_id and l.jogador_id = a.jogador_id
             where m.partida_id = coalesce(a.partida_id, s.partida_id)
               and m.autor_id <> a.jogador_id
               and (l.lido_ate is null or m.criado_em > l.lido_ate)
           ) as nao_lidas
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

    -- A etiqueta é o que faz a atualização SUBSTITUIR em vez de empilhar.
    -- Precisa ser idêntica entre o primeiro aviso e as atualizações dele.
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
-- COMO CONFERIR
-- ============================================================
-- Mande 3 mensagens seguidas e olhe o que sairia:
--     select titulo, corpo, silencioso from public.push_pendentes(20);
--
-- O TESTE QUE IMPORTA é no celular: duas mensagens seguidas têm de acender
-- a notificação UMA vez, e o número tem de subir sozinho na tela.
