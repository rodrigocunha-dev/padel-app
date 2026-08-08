-- Sprint 5 (correção) — só quem ACEITOU pode ser inadimplente
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- O BUG
-- ============================================================
-- Descoberto em 07/08/2026, montando dados de teste: o Carlos aparecia
-- como inadimplente por uma partida em que ele estava apenas
-- **convidado** — nunca aceitou, nunca jogou, nunca entrou na divisão.
--
-- A função `jogador_inadimplente` (script 010) filtra por
-- `pj.papel = 'jogador'`, mas **não olha o estado**. Ela é anterior ao
-- convite existir: quando foi escrita, estar em `partida_jogadores`
-- significava estar jogando. Depois do script 014, deixou de significar.
--
-- Consequência real, e grave: quem é convidado para um jogo e **ignora o
-- convite** vira devedor 24h depois. E fica bloqueado de reservar quadra,
-- criar partida e aceitar qualquer outro convite — por um jogo do qual
-- nunca participou. Pior: não há como se livrar, porque recusar o convite
-- também não tira a linha da tabela.
--
-- É a mesma família de erro já corrigida em "Minhas partidas" (onde o
-- convite pendente aparecia como jogo seu) e na política do split
-- (script 017, onde o convidado via o rateio antes de aceitar). Toda
-- regra escrita antes do convite existir precisa ser relida com essa
-- pergunta: "isto vale para quem só foi convidado?".
--
-- Correção: exigir `estado = 'aceito'`. Quem desistiu e foi substituído
-- ('saiu') também não deve — a vaga dele foi assumida por outra pessoa.

create or replace function public.jogador_inadimplente(p_uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $fn$
  select exists (
    select 1
    from public.partida_jogadores pj
    join public.partidas p on p.id = pj.partida_id
    where pj.jogador_id = p_uid
      and pj.papel = 'jogador'
      -- NOVO: convite pendente, recusado ou substituído não gera dívida.
      and pj.estado = 'aceito'
      and p.status <> 'cancelada'
      and p.preco_centavos > 0
      and p.fim + interval '24 hours' < now()
      and not exists (
        select 1 from public.pagamentos pg
        where pg.partida_id = p.id
          and pg.jogador_id = p_uid
          and pg.status = 'pago'
      )
  );
$fn$;

revoke all on function public.jogador_inadimplente(uuid) from public, anon;
grant execute on function public.jogador_inadimplente(uuid) to authenticated;
