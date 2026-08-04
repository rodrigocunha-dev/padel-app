-- Sprint 5 (ajuste) — a divisão do valor só é visível para quem ACEITOU
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- A regra do fundador (script 011) é: só quem está JOGANDO vê a divisão de
-- pagamento — nem substituto, nem quem só visita, nem o clube.
--
-- Quando o convite passou a existir (script 014), surgiu um caso que a
-- política antiga não previa: o convidado também tem `papel = 'jogador'`,
-- mas ainda NÃO aceitou. Pela regra, ele não deveria ver o rateio de um
-- jogo em que ainda não entrou — nem quanto é, nem quem já pagou.
--
-- A política antiga não estava errada; ela é anterior ao convite existir.

drop policy if exists "pagamentos_leitura_jogadores" on public.pagamentos;

create policy "pagamentos_leitura_jogadores"
  on public.pagamentos for select to authenticated
  using (
    exists (
      select 1 from public.partida_jogadores pj
      where pj.partida_id = pagamentos.partida_id
        and pj.jogador_id = (select auth.uid())
        and pj.papel = 'jogador'
        and pj.estado = 'aceito'
    )
  );
