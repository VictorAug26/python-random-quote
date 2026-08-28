-- =============================================================================
-- Dados de teste para desenvolvimento local. Todos fictícios.
-- Nunca rodar em produção. Nunca colocar dado de produtor real aqui.
-- =============================================================================

-- Fazenda leiteira estruturada, tarifa branca, sem solar.
-- Cenário principal do MVP.
with novo_lead as (
  insert into public.leads (nome, whatsapp, nome_propriedade, municipio, etapa, origem)
  values ('Produtor Exemplo', '+5534991110001', 'Fazenda Modelo', 'Patrocínio', 'concluido', 'teste-local')
  returning id
)
insert into public.consentimentos (lead_id, finalidade, concedido, versao_politica, texto_apresentado)
select id, f.finalidade, f.concedido, '2026-08-28', f.texto
from novo_lead,
lateral (values
  ('diagnostico', true,
   'Autorizo o uso dos meus dados para gerar o diagnóstico energético.'),
  ('compartilhamento_parceiro', false,
   'Autorizo o compartilhamento do meu contato com um parceiro fornecedor de BESS.')
) as f(finalidade, concedido, texto);

insert into public.perfis_atividade (lead_id, atividades, equipamentos, possui_solar, possui_bess)
select id, array['leite_gado'], array['ordenha_mecanizada','tanque_resfriamento'], false, false
from public.leads where whatsapp = '+5534991110001';

insert into public.consumos_energia (lead_id, valor_fatura_reais, consumo_kwh, classe_tarifaria, mes_referencia)
select id, 8400.00, 8900.00, 'branca', date '2026-07-01'
from public.leads where whatsapp = '+5534991110001';

-- Café irrigado com pivô, não sabe a tarifa: cenário de confiança baixa.
with novo_lead as (
  insert into public.leads (nome, whatsapp, nome_propriedade, municipio, etapa, origem)
  values ('Produtora Exemplo', '+5534991110002', 'Sítio das Águas', 'Rio Paranaíba', 'consumo', 'teste-local')
  returning id
)
insert into public.consentimentos (lead_id, finalidade, concedido, versao_politica, texto_apresentado)
select id, 'diagnostico', true, '2026-08-28',
       'Autorizo o uso dos meus dados para gerar o diagnóstico energético.'
from novo_lead;

insert into public.perfis_atividade (lead_id, atividades, equipamentos, possui_solar, possui_bess)
select id, array['graos_cafe_irrigado'], array['pivo_central'], true, false
from public.leads where whatsapp = '+5534991110002';
