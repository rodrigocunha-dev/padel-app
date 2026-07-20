-- Correção pós-teste do Módulo 1.1: impede faixas de preço sobrepostas
-- na mesma quadra (mesmo dia da semana + horários que se cruzam).
-- Rode no Supabase: SQL Editor → New query → colar → Run.

create or replace function public.checar_sobreposicao_preco()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.quadra_precos p
    where p.quadra_id = new.quadra_id
      and p.id <> new.id
      and p.dias && new.dias            -- algum dia em comum
      and p.hora_inicio < new.hora_fim  -- horários se cruzam
      and p.hora_fim > new.hora_inicio
  ) then
    raise exception 'Faixa de preco sobrepoe outra ja cadastrada nesta quadra';
  end if;
  return new;
end;
$$;

drop trigger if exists preco_sem_sobreposicao on public.quadra_precos;

create trigger preco_sem_sobreposicao
  before insert or update on public.quadra_precos
  for each row
  execute function public.checar_sobreposicao_preco();
