-- =============================================================================
-- 0004 — salvar_perfil_atividade(): tela 2
--
-- Duas coisas que a função garante e a aplicação sozinha não garantiria:
--
--   1. Só grava se o consentimento de diagnóstico estiver ativo. Se o titular
--      revogou entre uma tela e outra, a gravação para aqui — não adianta a
--      tela 1 ter conferido, o que vale é o estado agora.
--   2. leads.etapa só anda para frente. O produtor pode voltar e corrigir o
--      perfil sem que o funil registre um retrocesso.
-- =============================================================================

create or replace function public.salvar_perfil_atividade(
  p_lead_id         uuid,
  p_atividades      text[],
  p_equipamentos    text[],
  p_possui_solar    boolean,
  p_possui_bess     boolean,
  p_atividade_outro text default null
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

  insert into public.perfis_atividade
    (lead_id, atividades, atividade_outro, equipamentos, possui_solar, possui_bess)
  values
    (p_lead_id, p_atividades, nullif(btrim(coalesce(p_atividade_outro, '')), ''),
     p_equipamentos, p_possui_solar, p_possui_bess)
  on conflict (lead_id) do update set
    atividades      = excluded.atividades,
    atividade_outro = excluded.atividade_outro,
    equipamentos    = excluded.equipamentos,
    possui_solar    = excluded.possui_solar,
    possui_bess     = excluded.possui_bess;

  update public.leads
     set etapa = 'perfil'
   where id = p_lead_id
     and etapa = 'cadastro';
end;
$$;

comment on function public.salvar_perfil_atividade is
  'Tela 2: grava ou atualiza o perfil da atividade, conferindo o consentimento.';

revoke all on function public.salvar_perfil_atividade(uuid, text[], text[], boolean, boolean, text)
  from public, anon, authenticated;
