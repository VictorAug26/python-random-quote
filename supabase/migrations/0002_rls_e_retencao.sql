-- =============================================================================
-- 0002 — RLS (negar tudo por padrão) e rotina de retenção
--
-- Modelo de acesso deste projeto:
--   o navegador NUNCA fala com o Supabase. Toda leitura e escrita passa por
--   Route Handlers do Next.js usando a service role key, que só existe no
--   servidor. Portanto os papéis públicos (anon, authenticated) não precisam
--   de acesso nenhum — e é exatamente isso que este arquivo garante.
--
-- Se um dia alguém decidir consultar o Supabase direto do navegador, este
-- arquivo tem que ser revisado antes, com policies escritas caso a caso.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. RLS ligada em todas as tabelas, sem nenhuma policy.
--    Sem policy, RLS nega tudo. A service role tem BYPASSRLS e continua
--    funcionando normalmente.
-- -----------------------------------------------------------------------------

alter table public.leads                  enable row level security;
alter table public.consentimentos         enable row level security;
alter table public.perfis_atividade       enable row level security;
alter table public.consumos_energia       enable row level security;
alter table public.diagnosticos           enable row level security;
alter table public.interesses_comerciais  enable row level security;
alter table public.solicitacoes_titular   enable row level security;

-- -----------------------------------------------------------------------------
-- 2. Cinto e suspensório: tirar os privilégios dos papéis públicos.
--    RLS já barraria, mas um GRANT esquecido em uma migration futura não pode
--    virar vazamento.
-- -----------------------------------------------------------------------------

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public
  revoke all on tables    from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges in schema public
  revoke all on functions from anon, authenticated;

-- Nada neste MVP usa a API pública do PostgREST. Fechamos o schema inteiro.
-- ATENÇÃO: reverter esta linha antes de adotar qualquer acesso client-side.
revoke usage on schema public from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Retenção: apaga leads vencidos e, em cascata, perfil, consumo,
--    diagnósticos, consentimentos e interesses.
--
--    Prazos adotados (documentados em docs/lgpd.md e na política):
--      * 18 meses para quem só fez o diagnóstico  (default da coluna expira_em)
--      * 24 meses quando houve interesse comercial (a aplicação estende a data)
--    Revogação de consentimento ou pedido de exclusão antecipa: a aplicação
--    grava expira_em = now() e a próxima execução limpa.
-- -----------------------------------------------------------------------------

create or replace function public.lgpd_expurgar_expirados()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removidos integer;
begin
  with apagados as (
    delete from public.leads
     where expira_em <= now()
    returning 1
  )
  select count(*) into removidos from apagados;

  return removidos;
end;
$$;

comment on function public.lgpd_expurgar_expirados is
  'Apaga leads vencidos e todos os dados vinculados. Chamada pelo cron diário.';

revoke all on function public.lgpd_expurgar_expirados() from public, anon, authenticated;

-- Agendamento: a rota /api/cron/expurgo do Next.js (protegida por CRON_SECRET)
-- é chamada uma vez por dia pelo cron da Vercel. Alternativa, se preferirem
-- manter tudo no banco, é habilitar a extensão pg_cron no Supabase:
--
--   select cron.schedule('expurgo-lgpd', '0 4 * * *',
--                        $expurgo$ select public.lgpd_expurgar_expirados(); $expurgo$);
