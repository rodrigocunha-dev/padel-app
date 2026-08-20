-- ============================================================
-- 043 — OS TEXTOS DO PUSH, E UM AVISO QUE NUNCA SAÍA
-- ============================================================
-- O fundador recebeu a notificação do chat e disse que o texto não ficou
-- bom. Fui ver: ele caía no texto genérico "Novidade no app / Toque para
-- ver.", porque `push_pendentes` (última versão no script 032) só conhecia
-- três tipos de aviso.
--
-- ⚠️ E o problema era maior que o chat: os TRÊS avisos criados depois do 032
-- — `horario_livre` (Entrega 2), `edicao_proposta` (Entrega 3) e
-- `chat_novas_mensagens` (Entrega 4) — caíam todos no mesmo texto genérico.
--
-- ⚠️⚠️ PIOR: `horario_livre` NUNCA VIRAVA PUSH. A consulta terminava com
-- `coalesce(a.partida_id, s.partida_id) is not null`, e o aviso de horário
-- livre não tem partida — ele aponta para o CLUBE. O clube promovia o
-- horário, o aviso aparecia dentro do app, e nenhuma notificação saía.
--
-- É a MESMA família de erro das duas outras vezes (o `032`, quando a busca
-- era por set; e a marcação de lido na Entrega 2): peça nova nasce sem
-- partida, e um filtro escrito quando toda peça tinha partida a descarta em
-- silêncio. Terceira vez. Por isso agora o filtro aceita partida OU clube,
-- e o texto tem um `else` que continua funcionando para o que vier depois.

create or replace function public.push_pendentes(p_limite integer default 200)
returns table (
  aviso_id uuid,
  inscricao_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  titulo text,
  corpo text,
  url text,
  tag text
)
language sql
security definer
set search_path = public
stable
as $fn$
  with base as (
    select a.id as aviso_id, a.tipo, a.jogador_id, a.criado_em,
           coalesce(a.partida_id, s.partida_id) as partida_id,
           a.clube_id,
           -- Onde o jogo é. Vira o "qual partida" que o texto precisa: sem
           -- isso a pessoa recebe "mensagem nova" e não sabe de qual jogo,
           -- ainda mais quem tem dois jogos marcados na semana.
           coalesce(cp.nome, cc.nome) as clube,
           p.inicio
    from public.avisos a
    left join public.sets s on s.id = a.set_id
    left join public.partidas p on p.id = coalesce(a.partida_id, s.partida_id)
    left join public.quadras q on q.id = p.quadra_id
    left join public.clubes cp on cp.id = q.clube_id
    left join public.clubes cc on cc.id = a.clube_id
    where a.push_enviado_em is null
      and a.lido_em is null          -- já leu dentro do app: não incomoda
      and a.criado_em > now() - interval '24 hours'
      -- Aceita os dois destinos. Aviso sem partida E sem clube não tem para
      -- onde levar ninguém, e aí realmente não deve virar notificação.
      and (a.partida_id is not null or s.partida_id is not null
           or a.clube_id is not null)
  )
  select b.aviso_id, i.id, i.endpoint, i.p256dh, i.auth,

    case b.tipo
      when 'set_registrado'      then 'Registraram um resultado do seu jogo'
      when 'votacao_aberta'      then 'Há um placar em disputa'
      when 'promovido'           then 'Você entrou no jogo!'
      when 'horario_livre'       then 'Quadra livre ' ||
                                      coalesce('no ' || b.clube, 'perto de você')
      when 'edicao_proposta'     then 'Querem mudar seu jogo'
      when 'chat_novas_mensagens' then 'Mensagem nova no seu jogo'
      else 'Novidade no app'
    end,

    -- O corpo carrega o CONTEXTO: qual jogo, e o que se espera da pessoa.
    -- Título curto porque o celular corta; corpo com o detalhe.
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

    -- A tag agrupa: um segundo aviso do mesmo tipo NA MESMA partida
    -- substitui o anterior na tela do celular, em vez de empilhar.
    b.tipo || '-' || coalesce(b.partida_id::text, b.clube_id::text)

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
-- Os textos que sairiam agora (rode como dono do banco):
--     select titulo, corpo, url from public.push_pendentes(20);
--
-- E o que estava quebrado: um aviso de horário livre não lido deveria
-- aparecer nessa lista. Antes deste script, não aparecia nunca.
