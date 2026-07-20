-- Ajustes pós-teste do Sprint 2: campos de edição do clube
-- Rode no Supabase: SQL Editor → New query → colar → Run.

-- Descrição livre (aparece na página do clube) e política de
-- cancelamento (regra de negócio nº 7: exibida ANTES do pagamento,
-- quando as reservas pelo app chegarem).
alter table public.clubes
  add column if not exists descricao text,
  add column if not exists politica_cancelamento text;
