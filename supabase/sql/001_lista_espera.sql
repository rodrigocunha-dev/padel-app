-- Tabela da lista de espera (Sprint 0)
-- Rode este script no Supabase: Project → SQL Editor → New query → colar → Run

create table if not exists public.lista_espera (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text not null,
  cidade text not null,
  clube text,
  categoria text not null,
  criado_em timestamptz not null default now()
);

-- Evita que a mesma pessoa (mesmo WhatsApp) entre duplicada na lista
create unique index if not exists lista_espera_whatsapp_key
  on public.lista_espera (whatsapp);

-- LGPD / segurança: ativa a trava de acesso na tabela
alter table public.lista_espera enable row level security;

-- Permite que QUALQUER pessoa (mesmo sem login) INSIRA um registro (preencha o formulário)
create policy "lista_espera_insercao_publica"
  on public.lista_espera
  for insert
  to anon
  with check (true);

-- Nenhuma policy de leitura é criada de propósito: ninguém de fora consegue LER a lista
-- pelo site. Vocês (fundadores) continuam vendo tudo normalmente pelo painel do Supabase
-- (Table Editor), que usa uma chave com acesso total e ignora essa trava.
