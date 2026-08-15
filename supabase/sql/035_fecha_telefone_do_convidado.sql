-- Correção do 034 — o telefone do convidado continuava à vista do grupo
-- Rode no Supabase: SQL Editor → New query → colar → Run.
--
-- ============================================================
-- O FURO, E POR QUE O 034 NÃO FECHOU
-- ============================================================
-- O `034` fez:
--     revoke select (telefone) on public.partida_jogadores from authenticated;
--
-- Isso **não tem efeito** enquanto o papel tem SELECT na TABELA inteira:
-- no Postgres, a permissão de tabela cobre todas as colunas, e revogar uma
-- coluna isolada não tira nada. Para restringir coluna é preciso revogar a
-- tabela e devolver coluna a coluna.
--
-- Reproduzido com contas de teste antes de corrigir: o Diego, participante
-- comum da sessão, leu o telefone de alguém que só tinha sido convidado.
-- É exatamente o furo que o `022` fechou do outro lado — bastava convidar
-- alguém para obter o número dela.
--
-- ⚠️ Lição para os próximos scripts: **revoke de coluna só funciona depois
-- de revogar a tabela.** O Sprint 4 já fazia certo em `jogadores`
-- (script `008`, linhas 22-24); eu não segui o padrão que já existia.

revoke select on public.partida_jogadores from anon, authenticated;

-- Tudo o que o app precisa ler — menos `telefone` e `nome_convidado`, que
-- são dados de quem ainda não é usuário e não pediu para estar ali.
grant select (
  id, partida_id, jogador_id, papel, ordem, estado,
  convidado_por, convidado_em, desistiu_em, substitui_jogador_id
) on public.partida_jogadores to authenticated;


-- ============================================================
-- O CÓDIGO DE CONVITE PRECISA CHEGAR AO DONO DELE
-- ============================================================
-- `jogadores` já tinha a tabela revogada desde o `008`, com as colunas
-- liberadas uma a uma. Isso tem um efeito que é bom e é armadilha ao mesmo
-- tempo: **toda coluna nova nasce fechada**. Foi o que aconteceu com
-- `categoria_inicial` no motor de rating, e agora com `codigo_convite`.
--
-- Aqui o fechamento é correto para `convidado_por` e `origem_cadastro`
-- (dado nosso, não do jogador), mas o `codigo_convite` precisa chegar ao
-- app — é ele que monta o link de "chamar um amigo".
--
-- Devolvido por função, e não por `grant`: com grant, qualquer pessoa
-- logada leria o código de qualquer outra, e daria para atribuir cadastros
-- a quem não convidou ninguém.
create or replace function public.meu_codigo_convite()
returns text
language sql
security definer
set search_path = public
stable
as $fn$
  select codigo_convite from public.jogadores where id = auth.uid();
$fn$;

revoke all on function public.meu_codigo_convite() from public, anon;
grant execute on function public.meu_codigo_convite() to authenticated;

-- Registrar de onde veio quem acabou de se cadastrar. Só funciona uma vez:
-- depois de gravado, ninguém reescreve a origem.
create or replace function public.registrar_origem(p_codigo text, p_origem text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_quem uuid;
begin
  if auth.uid() is null then return; end if;

  if p_codigo is not null then
    select id into v_quem from public.jogadores where codigo_convite = p_codigo;
    -- Ninguém convida a si mesmo.
    if v_quem = auth.uid() then v_quem := null; end if;
  end if;

  update public.jogadores
  set convidado_por = coalesce(convidado_por, v_quem),
      origem_cadastro = coalesce(origem_cadastro, nullif(trim(coalesce(p_origem, '')), ''))
  where id = auth.uid()
    and (convidado_por is null or origem_cadastro is null);
end;
$fn$;

revoke all on function public.registrar_origem(text, text) from public, anon;
grant execute on function public.registrar_origem(text, text) to authenticated;

-- ============================================================
-- CONFERÊNCIA
-- ============================================================
-- Depois de rodar, um participante comum lendo a coluna deve receber
-- "permission denied", e o organizador deve seguir vendo pela função
-- `convites_por_telefone`.
