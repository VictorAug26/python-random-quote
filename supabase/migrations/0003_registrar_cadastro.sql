-- =============================================================================
-- 0003 — registrar_cadastro(): tela 1 em uma única transação
--
-- Por que uma função e não três inserts pela API:
-- o lead e os dois consentimentos precisam nascer juntos. Se o insert do
-- consentimento falhasse depois do insert do lead, ficaríamos com dado
-- pessoal gravado sem a base legal que o autoriza — exatamente o que não
-- pode acontecer. Dentro de uma função plpgsql tudo é uma transação só:
-- ou grava tudo, ou não grava nada.
-- =============================================================================

create or replace function public.registrar_cadastro(
  p_nome                  text,
  p_whatsapp              text,
  p_nome_propriedade      text,
  p_municipio             text,
  p_versao_politica       text,
  p_consente_diagnostico  boolean,
  p_texto_diagnostico     text,
  p_consente_parceiro     boolean,
  p_texto_parceiro        text,
  p_uf                    char(2) default 'MG',
  p_origem                text    default null,
  p_ip_hash               text    default null,
  p_user_agent            text    default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
begin
  -- Sem o consentimento de diagnóstico não existe base legal para guardar
  -- nada. A tela já bloqueia, mas a regra vale no banco também.
  if not p_consente_diagnostico then
    raise exception 'Cadastro recusado: o consentimento para gerar o diagnóstico é obrigatório.';
  end if;

  insert into public.leads (nome, whatsapp, nome_propriedade, municipio, uf, origem, etapa)
  values (
    btrim(p_nome),
    p_whatsapp,
    btrim(p_nome_propriedade),
    btrim(p_municipio),
    upper(p_uf),
    nullif(btrim(coalesce(p_origem, '')), ''),
    'cadastro'
  )
  returning id into v_lead_id;

  insert into public.consentimentos
    (lead_id, finalidade, concedido, versao_politica, texto_apresentado, origem, ip_hash, user_agent)
  values
    (v_lead_id, 'diagnostico', p_consente_diagnostico, p_versao_politica,
     p_texto_diagnostico, 'formulario_web', p_ip_hash, p_user_agent),
    (v_lead_id, 'compartilhamento_parceiro', p_consente_parceiro, p_versao_politica,
     p_texto_parceiro, 'formulario_web', p_ip_hash, p_user_agent);

  return v_lead_id;
end;
$$;

comment on function public.registrar_cadastro is
  'Tela 1: cria o lead e as duas manifestações de consentimento atomicamente.';

-- Só a service role (que a API do servidor usa) pode chamar.
revoke all on function public.registrar_cadastro(
  text, text, text, text, text, boolean, text, boolean, text, char, text, text, text
) from public, anon, authenticated;
