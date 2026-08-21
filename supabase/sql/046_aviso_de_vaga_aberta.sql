-- ============================================================
-- 046 — AVISO DE VAGA ABERTA EM PARTIDA COMPATÍVEL
-- ============================================================
-- Item do Módulo 1.3 que estava no plano original da fila de substitutos e
-- nunca foi feito: só o mecanismo de promoção existia.
--
-- Agora ele faz sentido pela primeira vez, porque o push existe (script 033)
-- e a compatibilidade já é decidida por `jogador_compativel` (022).
--
-- ⚠️ QUANDO AVISA: quando a partida VOLTA a ter vaga — alguém saiu e não
-- havia substituto na fila para assumir. Não avisa na criação da partida: o
-- feed já mostra partidas novas, e transformar "criei uma partida" em push
-- para toda a cidade é o caminho mais curto para as pessoas desligarem as
-- notificações do app.

alter table public.avisos drop constraint if exists avisos_tipo_check;
alter table public.avisos
  add constraint avisos_tipo_check
  check (tipo in ('set_registrado', 'votacao_aberta', 'promovido',
                  'horario_livre', 'edicao_proposta', 'chat_novas_mensagens',
                  'vaga_aberta'));


create or replace function public.partida_avisa_vaga()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  p public.partidas;
begin
  -- Só interessa a transição "estava cheia, agora tem vaga".
  if new.status <> 'aberta' or old.status <> 'completa' then
    return null;
  end if;

  select * into p from public.partidas where id = new.id;

  -- Partida que já começou (ou já passou) não tem vaga para ninguém.
  if p.inicio <= now() then
    return null;
  end if;

  -- ⚠️ Uma vez por partida a cada 6 horas. A partida pode encher e esvaziar
  -- várias vezes num dia; sem isto, as mesmas pessoas receberiam o mesmo
  -- aviso repetido. Mesmo intervalo do resto do produto.
  if exists (
    select 1 from public.avisos a
    where a.partida_id = new.id
      and a.tipo = 'vaga_aberta'
      and a.criado_em > now() - interval '6 hours'
  ) then
    return null;
  end if;

  insert into public.avisos (jogador_id, tipo, partida_id)
  select j.id, 'vaga_aberta', new.id
  from public.jogadores j
  where j.anonimizado_em is null
    -- Compatível pela MESMA regra do feed: categoria dentro da faixa e sexo
    -- do jogo. Uma segunda definição de "compatível" divergiria da primeira
    -- no primeiro ajuste — foi o que produziu os furos da varredura de 08/08.
    and public.jogador_compativel(p, j.id)
    -- Inadimplente não pode entrar em partida nova (regra do Sprint 4);
    -- avisá-lo de uma vaga que ele não pode ocupar é só irritação.
    and not public.jogador_inadimplente(j.id)
    -- Quem já está na partida, na fila, ou saiu dela, não é convidado a
    -- voltar por push.
    and not exists (
      select 1 from public.partida_jogadores pj
      where pj.partida_id = new.id and pj.jogador_id = j.id
    );

  return null;
end;
$fn$;

drop trigger if exists trg_partida_avisa_vaga on public.partidas;
create trigger trg_partida_avisa_vaga
  after update of status on public.partidas
  for each row execute function public.partida_avisa_vaga();


-- ============================================================
-- O TEXTO DO PUSH
-- ============================================================
-- Mesma função de sempre; só entra o caso novo. Mantido o `else`, que é o
-- que evita a próxima peça nascer com "Novidade no app" — foi assim que os
-- três avisos anteriores ficaram sem texto até o script 043.

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
      when 'vaga_aberta'          then 'Abriu vaga numa partida do seu nível'
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
          -- Em `to_char`, texto literal vai entre ASPAS DUPLAS. Sem elas, o
          -- Postgres tenta ler cada letra como código de formato.
          to_char(b.inicio at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24"h"') ||
          ' · toque para entrar',
          'Toque para ver a partida.'
        )
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
-- Encha uma partida, tire um jogador SEM ter substituto na fila, e veja:
--     select tipo, count(*) from public.avisos
--     where tipo = 'vaga_aberta' group by tipo;
--
-- Quem NÃO pode receber: quem já está na partida, inadimplentes, contas
-- anonimizadas e quem está fora da faixa de categoria ou do sexo do jogo.
