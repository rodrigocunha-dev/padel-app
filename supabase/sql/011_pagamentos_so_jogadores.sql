-- Sprint 4 (ajuste) — quem lê o "quem-pagou" da partida
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- Decisão do fundador: só quem está JOGANDO vê a divisão de pagamento —
-- nem substitutos, nem quem só visita a partida, nem o clube. O
-- organizador é sempre um jogador ativo, então está incluído.

drop policy if exists "pagamentos_leitura_participantes" on public.pagamentos;
drop policy if exists "pagamentos_leitura_jogadores" on public.pagamentos;

create policy "pagamentos_leitura_jogadores"
  on public.pagamentos for select to authenticated
  using (
    exists (
      select 1 from public.partida_jogadores pj
      where pj.partida_id = pagamentos.partida_id
        and pj.jogador_id = (select auth.uid())
        and pj.papel = 'jogador'
    )
  );
