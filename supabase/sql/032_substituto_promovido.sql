-- O substituto: aviso de promoção e o aviso sabendo de qual partida é
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- O BURACO QUE ISTO FECHA
-- ============================================================
-- Quem está na fila de substitutos **não consegue chegar na partida**.
-- "Minhas partidas" exige `papel = 'jogador'`, então nunca lista quem está
-- na fila; e o feed só mostra partidas que ainda não começaram. Assim que o
-- jogo começa, o substituto perde o único acesso que tinha.
--
-- O pior não é a navegação. É que a promoção acontece em SILÊNCIO: alguém
-- sai, o primeiro da fila vira jogador automaticamente, e ele não fica
-- sabendo. Sem aviso, arrumar só a tela deixaria o problema real de pé —
-- a pessoa só descobriria se abrisse o app sem ter motivo para abrir.
--
-- Decidido com o fundador em 12/08/2026: a fila ganha **bloco próprio**
-- (não entra na lista de "Minhas partidas", porque fila é possibilidade e
-- não jogo), e a promoção **gera aviso**.

-- ============================================================
-- 1) O AVISO PASSA A SABER DE QUAL PARTIDA É
-- ============================================================
-- Até agora todo aviso vinha de um SET, e a partida era descoberta pelo
-- caminho aviso → set → partida. O aviso de promoção não tem set: ele é
-- sobre a partida inteira. Então a partida passa a ser gravada direto.
alter table public.avisos
  add column if not exists partida_id uuid references public.partidas (id) on delete cascade;

-- Preenche os que já existem, pelo caminho antigo.
update public.avisos a
set partida_id = s.partida_id
from public.sets s
where s.id = a.set_id and a.partida_id is null;

-- E daqui em diante o próprio banco preenche, em vez de depender de cada
-- função lembrar. Assim `registrar_set`, `contestar_set` e
-- `avisar_votacao` seguem intocadas e o campo nunca fica vazio por
-- esquecimento — nosso ou de quem mexer nisso daqui a um ano.
create or replace function public.aviso_herda_partida()
returns trigger
language plpgsql
as $fn$
begin
  if new.partida_id is null and new.set_id is not null then
    select partida_id into new.partida_id from public.sets where id = new.set_id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_aviso_herda_partida on public.avisos;
create trigger trg_aviso_herda_partida
  before insert on public.avisos
  for each row execute function public.aviso_herda_partida();

-- ============================================================
-- 2) O TIPO NOVO
-- ============================================================
alter table public.avisos drop constraint if exists avisos_tipo_check;
alter table public.avisos add constraint avisos_tipo_check
  check (tipo in ('set_registrado', 'votacao_aberta', 'promovido'));

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

      -- O aviso da promoção. Sem ele, a pessoa sobe de substituto a jogador
      -- em SILÊNCIO e só descobre se abrir o app por conta própria — sem ter
      -- motivo nenhum para abrir. Era o buraco que a fila tinha.
      insert into public.avisos (jogador_id, tipo, partida_id)
      values (v_promovido, 'promovido', p_partida_id);
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
-- 3) O PUSH DO AVISO DE PROMOÇÃO
-- ============================================================
-- Duas mudanças em `push_pendentes`: o `join` com sets vira `left join`
-- (o aviso de promoção não tem set, e um join comum o descartaria em
-- silêncio), e a partida sai de `avisos.partida_id`.
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
  select a.id, i.id, i.endpoint, i.p256dh, i.auth,
         case a.tipo
           when 'set_registrado' then 'Registraram um resultado do seu jogo'
           when 'votacao_aberta' then 'Há um placar em disputa'
           when 'promovido' then 'Você entrou no jogo!'
           else 'Novidade no app'
         end,
         case a.tipo
           when 'set_registrado' then 'Confira. Se não estiver certo, você tem 24h para contestar.'
           when 'votacao_aberta' then 'Você estava lá. Toque para dizer qual placar está certo.'
           when 'promovido' then 'Abriu vaga e você saiu da fila. Confira o horário e a quadra.'
           else 'Toque para ver.'
         end,
         '/app/partidas/' || coalesce(a.partida_id, s.partida_id),
         a.tipo
  from public.avisos a
  left join public.sets s on s.id = a.set_id
  join public.push_inscricoes i on i.jogador_id = a.jogador_id
  where a.push_enviado_em is null
    and a.lido_em is null
    and i.invalidado_em is null
    and a.criado_em > now() - interval '24 hours'
    and coalesce(a.partida_id, s.partida_id) is not null
  order by a.criado_em
  limit p_limite;
$fn$;

revoke all on function public.push_pendentes(integer) from public, anon, authenticated;
