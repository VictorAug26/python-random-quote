-- =============================================================================
-- 0009 — O que a migração de tarifa destravaria
--
-- Na tarifa convencional a energia custa o mesmo a qualquer hora. Bateria não
-- tem o que capturar ali, e o motor agora diz isso com todas as letras: a
-- economia é R$ 0.
--
-- Só que parar em "R$ 0" deixa o produtor sem saída, e é a resposta errada:
-- o problema dele não é a bateria, é a tarifa. O motor já calcula quanto a
-- mesma propriedade economizaria na tarifa branca. Esta migration leva esse
-- número até o relatório.
--
-- SEGURA DE PULAR: o app lê a view com `select *` e trata a coluna ausente
-- como "não informado". Sem esta migration o relatório só perde a frase da
-- migração de tarifa — nada quebra.
-- =============================================================================

-- `create or replace view` só aceita coluna nova NO FIM. A nova entra ao lado
-- da economia a que se refere, então a view é derrubada e recriada. Nada
-- depende dela além do código do app.
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
  -- Fica null fora da convencional: nas outras tarifas não há migração que
  -- faça sentido sugerir.
  (d.detalhes ->> 'economiaSeMigrarParaBrancaReais')::numeric
    as economia_se_migrar_para_branca_reais,
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
