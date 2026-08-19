-- ============================================================
-- 042 — AVISO DO CHAT: UM POR CONVERSA, NÃO UM POR MENSAGEM
-- ============================================================
-- Decisão do fundador (17/08/2026), corrigindo o recorte do script 041, que
-- não avisava nada.
--
-- A ideia que resolve o problema do spam sem abrir mão do aviso: enquanto
-- existir um aviso NÃO LIDO daquela conversa, mensagem nova não cria outro.
-- Vinte mensagens seguidas viram um aviso só. Depois que a pessoa lê, a
-- próxima mensagem cria um novo — que é o comportamento que se espera.
--
-- 💡 MELHORIA JÁ REGISTRADA (não é para agora): mostrar o TEXTO da mensagem
-- na notificação, como o WhatsApp faz. Isso exige antes a opção de
-- silenciar — geral e por conversa —, senão a pessoa se afoga. Ver
-- CLAUDE.md.

alter table public.avisos drop constraint if exists avisos_tipo_check;
alter table public.avisos
  add constraint avisos_tipo_check
  check (tipo in ('set_registrado', 'votacao_aberta', 'promovido',
                  'horario_livre', 'edicao_proposta', 'chat_novas_mensagens'));


create or replace function public.mensagem_avisa_grupo()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.avisos (jogador_id, tipo, partida_id)
  select pj.jogador_id, 'chat_novas_mensagens', new.partida_id
  from public.partida_jogadores pj
  where pj.partida_id = new.partida_id
    and pj.papel = 'jogador'
    and pj.estado = 'aceito'
    -- Quem escreveu não é avisado da própria mensagem.
    and pj.jogador_id <> new.autor_id

    -- TRAVA 1 — já existe aviso não lido desta conversa para esta pessoa.
    -- É o que faz "um por conversa" em vez de "um por mensagem".
    and not exists (
      select 1 from public.avisos a
      where a.jogador_id = pj.jogador_id
        and a.partida_id = new.partida_id
        and a.tipo = 'chat_novas_mensagens'
        and a.lido_em is null
    )

    -- TRAVA 2 — a pessoa está com a conversa aberta AGORA. Avisar quem está
    -- lendo é vibrar o bolso de alguém que já está olhando para a tela.
    and not exists (
      select 1 from public.leitura_chat l
      where l.partida_id = new.partida_id
        and l.jogador_id = pj.jogador_id
        and l.lido_ate > now() - interval '2 minutes'
    );

  return null;
end;
$fn$;

drop trigger if exists trg_mensagem_avisa on public.mensagens;
create trigger trg_mensagem_avisa
  after insert on public.mensagens
  for each row execute function public.mensagem_avisa_grupo();


-- ⚠️ O push sai sozinho pelo gatilho do script 033, que dispara ao NASCER
-- um aviso. Não há nada a ligar aqui — e é justamente por isso que a trava
-- de "um por conversa" precisa estar no nascimento do aviso, e não na hora
-- de enviar: se o aviso nascesse por mensagem, o push já teria saído.


-- ============================================================
-- COMO CONFERIR
-- ============================================================
-- Mande 5 mensagens seguidas numa partida e confira que o outro jogador
-- recebeu UM aviso, não cinco:
--     select tipo, count(*) from public.avisos
--     where tipo = 'chat_novas_mensagens' and lido_em is null
--     group by tipo;
--
-- Depois que ele abrir a partida (o que marca os avisos como lidos), a
-- próxima mensagem deve criar um aviso novo.
