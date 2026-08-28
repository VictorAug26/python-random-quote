-- =============================================================================
-- 0007 — O expurgo passa a acontecer sozinho
--
-- Até aqui, lgpd_expurgar_expirados() existia mas ninguém chamava: a retenção
-- prometida na política era só texto. Esta migration fecha isso.
--
-- Optamos por agendar dentro do próprio banco (pg_cron) em vez de expor uma
-- rota HTTP chamada por um cron externo. O trabalho é 100% dentro do Postgres,
-- então dar a volta pela internet só acrescentaria um endpoint público, um
-- segredo para administrar e uma dependência de o app estar no ar.
--
-- Também entra aqui o que faltava para o pedido de exclusão ser real: uma
-- função que o atendente executa e que antecipa o expurgo daquele titular.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Registro das execuções — a visibilidade que um painel de cron daria.
-- Não guarda nada sobre quem foi apagado, só quantos e quando.
-- -----------------------------------------------------------------------------

create table if not exists public.expurgos_lgpd (
  id                    bigint generated always as identity primary key,
  executado_em          timestamptz not null default now(),
  leads_removidos       integer not null,
  solicitacoes_anonimizadas integer not null default 0,
  duracao_ms            integer
);

comment on table public.expurgos_lgpd is
  'Log do expurgo diário. Prova de que a retenção é cumprida, sem dado pessoal.';

create index if not exists expurgos_executado_em_idx
  on public.expurgos_lgpd (executado_em desc);

alter table public.expurgos_lgpd enable row level security;
revoke all on table public.expurgos_lgpd from anon, authenticated;

-- -----------------------------------------------------------------------------
-- O expurgo, agora com log e com limpeza do rastro de atendimento.
-- -----------------------------------------------------------------------------

create or replace function public.lgpd_expurgar_expirados()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio       timestamptz := clock_timestamp();
  v_removidos    integer;
  v_anonimizadas integer;
begin
  with apagados as (
    delete from public.leads
     where expira_em <= now()
    returning 1
  )
  select count(*) into v_removidos from apagados;

  -- Um pedido de exclusão já atendido não precisa continuar guardando o
  -- telefone de quem pediu. O lead_id virou null na cascata acima; o que
  -- sobra é a prova de que o pedido existiu e foi cumprido.
  with anonimizadas as (
    update public.solicitacoes_titular
       set whatsapp_informado = null
     where status = 'concluida'
       and lead_id is null
       and whatsapp_informado is not null
    returning 1
  )
  select count(*) into v_anonimizadas from anonimizadas;

  insert into public.expurgos_lgpd (leads_removidos, solicitacoes_anonimizadas, duracao_ms)
  values (
    v_removidos,
    v_anonimizadas,
    (extract(epoch from (clock_timestamp() - v_inicio)) * 1000)::integer
  );

  return v_removidos;
end;
$$;

comment on function public.lgpd_expurgar_expirados is
  'Apaga leads vencidos, limpa rastro de atendimento e registra a execução.';

revoke all on function public.lgpd_expurgar_expirados() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Pedido de exclusão vindo pelo WhatsApp.
--
-- O atendente roda uma linha em vez de sair apagando tabela por tabela e
-- torcendo para não esquecer nenhuma. Marca a data de expurgo para agora: a
-- execução seguinte apaga tudo em cascata.
-- -----------------------------------------------------------------------------

create or replace function public.lgpd_atender_pedido_exclusao(p_whatsapp text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marcados integer;
  v_lead_id  uuid;
begin
  if p_whatsapp !~ '^\+55[1-9][0-9]{9,10}$' then
    raise exception 'WhatsApp fora do formato esperado (+55DDNNNNNNNNN): %', p_whatsapp;
  end if;

  select id into v_lead_id
    from public.leads
   where whatsapp = p_whatsapp
   order by criado_em desc
   limit 1;

  update public.leads
     set expira_em = now()
   where whatsapp = p_whatsapp;

  get diagnostics v_marcados = row_count;

  insert into public.solicitacoes_titular
    (lead_id, whatsapp_informado, tipo, canal, status, concluido_em, resposta)
  values (
    v_lead_id, p_whatsapp, 'exclusao', 'whatsapp', 'concluida', now(),
    format('Marcado para exclusão. %s cadastro(s) atingido(s).', v_marcados)
  );

  return v_marcados;
end;
$$;

comment on function public.lgpd_atender_pedido_exclusao is
  'Atende pedido de exclusão: antecipa o expurgo do titular e registra o atendimento.';

revoke all on function public.lgpd_atender_pedido_exclusao(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Agendamento: todo dia às 4h (UTC).
--
-- O bloco é condicional para a migration rodar igual em qualquer Postgres —
-- inclusive num banco local de teste, onde pg_cron não existe. No Supabase a
-- extensão está disponível e o agendamento acontece de verdade.
-- -----------------------------------------------------------------------------

do $agendamento$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice
      'pg_cron indisponível: o expurgo NÃO foi agendado. Em produção, habilite a extensão e rode esta migration de novo.';
    return;
  end if;

  execute 'create extension if not exists pg_cron';

  -- Idempotente: reagendar não duplica o job.
  if exists (select 1 from cron.job where jobname = 'expurgo-lgpd') then
    perform cron.unschedule('expurgo-lgpd');
  end if;

  perform cron.schedule(
    'expurgo-lgpd',
    '0 4 * * *',
    'select public.lgpd_expurgar_expirados();'
  );

  raise notice 'Expurgo LGPD agendado para todo dia às 4h (UTC).';
end;
$agendamento$;
