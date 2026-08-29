-- =============================================================================
-- 0008 — Demanda contratada (Grupo A)
--
-- O motor só enxergava arbitragem de energia: mover kWh de horário caro para
-- barato. Mas a conta do Grupo A cobra também pelo maior pico de kW do mês, e
-- cortar esse pico costuma valer mais que deslocar energia.
--
-- Faltava a informação: ninguém perguntava a demanda contratada. Esta
-- migration abre espaço para ela e leva a parcela de economia até o relatório.
-- =============================================================================

alter table public.consumos_energia
  add column if not exists demanda_contratada_kw numeric(10,2)
    check (demanda_contratada_kw is null
           or (demanda_contratada_kw > 0 and demanda_contratada_kw <= 100000));

comment on column public.consumos_energia.demanda_contratada_kw is
  'kW contratados. Só existe no Grupo A, e mesmo lá é opcional.';

-- -----------------------------------------------------------------------------
-- A função de gravação passa a aceitar o novo campo.
-- Parâmetro com default no fim: chamadas antigas continuam funcionando.
-- -----------------------------------------------------------------------------

create or replace function public.salvar_consumo_energia(
  p_lead_id               uuid,
  p_valor_fatura_reais    numeric,
  p_classe_tarifaria      text,
  p_consumo_kwh           numeric default null,
  p_demanda_contratada_kw numeric default null
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
    (lead_id, valor_fatura_reais, consumo_kwh, classe_tarifaria, demanda_contratada_kw)
  values
    (p_lead_id, p_valor_fatura_reais, p_consumo_kwh, p_classe_tarifaria,
     -- Demanda só faz sentido no Grupo A; nas outras tarifas é ruído.
     case when p_classe_tarifaria = 'grupo_a' then p_demanda_contratada_kw end)
  on conflict (lead_id) do update set
    valor_fatura_reais    = excluded.valor_fatura_reais,
    consumo_kwh           = excluded.consumo_kwh,
    classe_tarifaria      = excluded.classe_tarifaria,
    demanda_contratada_kw = excluded.demanda_contratada_kw;

  update public.leads
     set etapa = 'consumo'
   where id = p_lead_id
     and etapa in ('cadastro', 'perfil');
end;
$$;

revoke all on function public.salvar_consumo_energia(uuid, numeric, text, numeric, numeric)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- O relatório agora separa as duas parcelas da economia. Os valores vêm de
-- dentro de `detalhes`, então a view pública continua sem tocar nas entradas
-- (que carregam consumo e valor da fatura).
-- -----------------------------------------------------------------------------

-- `create or replace view` só aceita colunas novas NO FIM da lista. As duas
-- parcelas entram no meio, ao lado do total a que pertencem, então a view
-- precisa ser derrubada e recriada. Nada depende dela além do código do app.
drop view if exists public.diagnosticos_publicos;

create view public.diagnosticos_publicos
with (security_invoker = true) as
select
  d.token_publico,
  d.motor_versao,
  d.economia_mensal_reais,
  coalesce((d.detalhes ->> 'economiaEnergiaReais')::numeric, d.economia_mensal_reais)
    as economia_energia_reais,
  coalesce((d.detalhes ->> 'economiaDemandaReais')::numeric, 0)
    as economia_demanda_reais,
  d.economia_min_reais,
  d.economia_max_reais,
  d.economia_percentual,
  d.bess_capacidade_kwh,
  d.bess_potencia_kw,
  d.investimento_estimado_reais,
  d.payback_meses,
  d.confianca,
  coalesce((d.detalhes ->> 'recomendaRevisarTarifa')::boolean, false) as recomenda_revisar_tarifa,
  d.criado_em
from public.diagnosticos d;

comment on view public.diagnosticos_publicos is
  'Somente os números do diagnóstico. Nenhuma coluna que identifique o titular.';

revoke all on public.diagnosticos_publicos from anon, authenticated;
