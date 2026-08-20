-- ============================================================
-- 045 — DESFAZ A ATUALIZAÇÃO SILENCIOSA (o iPhone não colabora)
-- ============================================================
-- MEDIDO no iPhone do fundador (13 Pro, iOS 18.7), 20/08/2026, com três
-- mensagens enviadas com 8 segundos entre elas:
--
--   esperado:  1 notificação na tela, texto virando "3 mensagens novas",
--              uma vibração só
--   obtido:    3 notificações empilhadas, 3 vibrações, 3 sons
--
-- Ou seja, o iOS ignorou as DUAS coisas em que a ideia se apoiava:
--   1. `tag` igual NÃO substituiu a notificação anterior — empilhou;
--   2. `silent: true` NÃO calou a entrega — vibrou e tocou igual.
--
-- Sem substituir, o contador não tem para onde ir; sem silêncio, cada
-- mensagem incomoda. A ideia inteira dependia de as duas funcionarem, e
-- nenhuma funcionou. Então volta o desenho do script 042: UM aviso por
-- conversa, sem reenvio.
--
-- ⚠️ ISTO NÃO É PERDA DE TRABALHO, É INFORMAÇÃO CARA E NOVA. O fundador quer,
-- no futuro, notificação estilo WhatsApp (com o texto da mensagem). Este
-- teste diz que, no iPhone, esse caminho NÃO pode ser construído sobre
-- substituir notificação nem sobre entrega silenciosa — vai precisar de outra
-- abordagem, e agora sabemos disso antes de investir.


-- ============================================================
-- O GATILHO VOLTA A SÓ CRIAR, NUNCA REENVIAR
-- ============================================================
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
    and pj.jogador_id <> new.autor_id

    -- A trava que faz "um por conversa". Enquanto houver aviso não lido
    -- daquela conversa, mensagem nova não gera nada.
    and not exists (
      select 1 from public.avisos a
      where a.jogador_id = pj.jogador_id
        and a.partida_id = new.partida_id
        and a.tipo = 'chat_novas_mensagens'
        and a.lido_em is null
    )

    -- Está com a conversa aberta agora.
    and not exists (
      select 1 from public.leitura_chat l
      where l.partida_id = new.partida_id
        and l.jogador_id = pj.jogador_id
        and l.lido_ate > now() - interval '2 minutes'
    );

  return null;
end;
$fn$;


-- ============================================================
-- O QUE FICA DO 044, E POR QUÊ
-- ============================================================
-- A coluna `push_reenvio` e a contagem em `push_pendentes` FICAM. Não são
-- peso morto:
--
--   - `push_reenvio` agora é sempre false, e o `silent` do service worker
--     passa a nunca disparar. Custo zero, e é o gancho pronto se um dia o
--     iOS mudar (ou para Android, onde isto funciona).
--
--   - A CONTAGEM continua útil de verdade: a varredura de segurança roda a
--     cada 15 minutos, e se o gatilho não completar, várias mensagens podem
--     se acumular antes de o push sair. Nesse caso o texto dirá "4 mensagens
--     novas" corretamente, em vez de "Mensagem nova".
--
-- Nada a reverter no app: o service worker continua respeitando um sinal que
-- deixou de ser mandado.

-- Zera o que ficou marcado como reenvio na tentativa.
update public.avisos set push_reenvio = false where push_reenvio;
