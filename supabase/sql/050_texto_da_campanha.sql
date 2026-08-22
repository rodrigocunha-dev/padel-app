-- ============================================================
-- 050 — O TEXTO DA CAMPANHA NA NOTIFICAÇÃO
-- ============================================================
-- O tipo `horarios_livres` nasceu no script 049 e ainda não tem texto
-- próprio em `push_pendentes` — cairia no genérico "Novidade no app / Toque
-- para ver.", que foi exatamente o problema que o script 043 corrigiu para
-- os outros três avisos.
--
-- Este script só troca os textos. Nenhuma tabela, nenhuma política.
--
-- ⚠️ Ordem conferida antes de enviar (regra do CLAUDE.md, 20/08/2026): esta
-- função só depende de tabelas e colunas que já existem desde o 049.

drop function if exists public.push_pendentes(integer);

create function public.push_pendentes(p_limite integer default 200)
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
-- COMO CONFERIR
-- ============================================================
--     select titulo, corpo from public.push_pendentes(20);
-- Nenhuma linha pode dizer "Novidade no app".
