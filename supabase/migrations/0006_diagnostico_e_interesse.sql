-- =============================================================================
-- 0006 — Motor (tela 4) e relatório (tela 5)
--
--   registrar_diagnostico()  grava o resultado e devolve o token público
--   diagnosticos_publicos    view SEM dado pessoal, para a página compartilhável
--   registrar_interesse()    "quero saber mais", com o consentimento junto
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Grava o diagnóstico calculado e devolve o token da página pública.
-- -----------------------------------------------------------------------------

create or replace function public.registrar_diagnostico(
  p_lead_id                     uuid,
  p_motor_versao                text,
  p_economia_mensal_reais       numeric,
  p_economia_min_reais          numeric,
  p_economia_max_reais          numeric,
  p_economia_percentual         numeric,
  p_bess_capacidade_kwh         numeric,
  p_bess_potencia_kw            numeric,
  p_investimento_estimado_reais numeric,
  p_confianca                   text,
  p_entradas                    jsonb,
  p_detalhes                    jsonb,
  p_payback_meses               integer default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token uuid;
begin
  if not public.fn_consentimento_ativo(p_lead_id, 'diagnostico') then
    raise exception 'Cálculo bloqueado: o titular % não autorizou o uso dos dados.', p_lead_id;
  end if;

  insert into public.diagnosticos (
    lead_id, motor_versao,
    economia_mensal_reais, economia_min_reais, economia_max_reais, economia_percentual,
    bess_capacidade_kwh, bess_potencia_kw, investimento_estimado_reais, payback_meses,
    confianca, entradas, detalhes
  )
  values (
    p_lead_id, p_motor_versao,
    p_economia_mensal_reais, p_economia_min_reais, p_economia_max_reais, p_economia_percentual,
    p_bess_capacidade_kwh, p_bess_potencia_kw, p_investimento_estimado_reais, p_payback_meses,
    p_confianca, p_entradas, p_detalhes
  )
  returning token_publico into v_token;

  update public.leads
     set etapa = 'diagnostico'
   where id = p_lead_id
     and etapa in ('cadastro', 'perfil', 'consumo');

  return v_token;
end;
$$;

comment on function public.registrar_diagnostico is
  'Tela 4: grava o resultado do motor e devolve o token da página pública.';

-- -----------------------------------------------------------------------------
-- A página /relatorio/[token] é compartilhável por WhatsApp — ou seja, é
-- pública na prática. Esta view é o contrato de que ela não tem como mostrar
-- dado pessoal: nome, WhatsApp, propriedade, município e lead_id não estão
-- aqui, nem as entradas (que carregam o consumo e o valor da fatura).
-- -----------------------------------------------------------------------------

create view public.diagnosticos_publicos
with (security_invoker = true) as
select
  d.token_publico,
  d.motor_versao,
  d.economia_mensal_reais,
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

-- -----------------------------------------------------------------------------
-- "Quero saber mais": registra o interesse comercial.
--
-- Só grava com o consentimento de compartilhamento ativo — se o produtor
-- marcou a autorização agora, ela entra na mesma transação. Sem autorização
-- não existe interesse registrado: não teria como agir sobre ele.
-- -----------------------------------------------------------------------------

create or replace function public.registrar_interesse(
  p_lead_id            uuid,
  p_diagnostico_id     uuid,
  p_consente_parceiro  boolean,
  p_texto_parceiro     text,
  p_versao_politica    text,
  p_ip_hash            text default null,
  p_user_agent         text default null,
  p_observacao         text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_interesse_id uuid;
begin
  -- Autorização dada agora, na própria tela do relatório.
  if p_consente_parceiro and not public.fn_consentimento_ativo(p_lead_id, 'compartilhamento_parceiro') then
    insert into public.consentimentos
      (lead_id, finalidade, concedido, versao_politica, texto_apresentado, origem, ip_hash, user_agent)
    values
      (p_lead_id, 'compartilhamento_parceiro', true, p_versao_politica,
       p_texto_parceiro, 'formulario_web', p_ip_hash, p_user_agent);
  end if;

  if not public.fn_consentimento_ativo(p_lead_id, 'compartilhamento_parceiro') then
    raise exception 'Interesse não registrado: falta a autorização de contato do parceiro.';
  end if;

  insert into public.interesses_comerciais (lead_id, diagnostico_id, quer_contato, observacao)
  values (p_lead_id, p_diagnostico_id, true, p_observacao)
  returning id into v_interesse_id;

  -- Retenção de quem entrou no funil comercial: 24 meses, como diz a política.
  update public.leads
     set etapa = 'concluido',
         expira_em = greatest(expira_em, now() + interval '24 months')
   where id = p_lead_id;

  return v_interesse_id;
end;
$$;

comment on function public.registrar_interesse is
  'Tela 5: registra o interesse comercial e, se for o caso, o consentimento dado na hora.';

revoke all on function public.registrar_diagnostico(
  uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb, jsonb, integer
) from public, anon, authenticated;

revoke all on function public.registrar_interesse(uuid, uuid, boolean, text, text, text, text, text)
  from public, anon, authenticated;

revoke all on public.diagnosticos_publicos from anon, authenticated;
