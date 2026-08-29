-- =============================================================================
-- 0005 — salvar_consumo_energia(): tela 3
--
-- Mesmas duas garantias da tela 2: confere o consentimento no momento da
-- gravação e só deixa leads.etapa andar para frente.
-- =============================================================================

create or replace function public.salvar_consumo_energia(
  p_lead_id            uuid,
  p_valor_fatura_reais numeric,
  p_classe_tarifaria   text,
  p_consumo_kwh        numeric default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.fn_consentimento_ativo(p_lead_id, 'diagnostico') then
    raise exception 'Gravação bloqueada: o titular % não autorizou o uso dos dados.', p_lead_id;
  end if;

  insert into public.consumos_energia
    (lead_id, valor_fatura_reais, consumo_kwh, classe_tarifaria)
  values
    (p_lead_id, p_valor_fatura_reais, p_consumo_kwh, p_classe_tarifaria)
  on conflict (lead_id) do update set
    valor_fatura_reais = excluded.valor_fatura_reais,
    consumo_kwh        = excluded.consumo_kwh,
    classe_tarifaria   = excluded.classe_tarifaria;

  update public.leads
     set etapa = 'consumo'
   where id = p_lead_id
     and etapa in ('cadastro', 'perfil');
end;
$$;

comment on function public.salvar_consumo_energia is
  'Tela 3: grava ou atualiza o consumo energético, conferindo o consentimento.';

revoke all on function public.salvar_consumo_energia(uuid, numeric, text, numeric)
  from public, anon, authenticated;
