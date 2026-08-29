-- =============================================================================
-- Diagnóstico energético rural — instalação completa do banco
--
-- GERADO AUTOMATICAMENTE por scripts/gerar-sql-unico.mjs. Não edite aqui:
-- mexa nos arquivos de supabase/migrations/ e rode `npm run sql`.
--
-- ⚠️ ESTE ARQUIVO É PARA BANCO VAZIO. Rode UMA VEZ, na primeira instalação.
--
-- JÁ TEM O BANCO E QUER SÓ ATUALIZAR? Não rode este arquivo. Ele para na
-- primeira tabela ("relation already exists") e NADA depois é executado — as
-- migrations novas, que ficam no fim, nunca chegam a rodar. Rode apenas os
-- arquivos de supabase/migrations/ que ainda faltam, um por um, em ordem.
--
-- Para saber quais faltam: `npm run checar` compara o seu banco com o código.
--
-- Se precisar recomeçar do zero, rode antes:
--
--   drop schema public cascade;
--   create schema public;
--   grant usage on schema public to postgres, service_role;
--
-- ⚠️ Isso apaga TODOS os dados. Só use em ambiente de teste.
--
-- Contém 9 migrations, na ordem:
--   0001_schema_inicial.sql
--   0002_rls_e_retencao.sql
--   0003_registrar_cadastro.sql
--   0004_salvar_perfil.sql
--   0005_salvar_consumo.sql
--   0006_diagnostico_e_interesse.sql
--   0007_expurgo_agendado.sql
--   0008_demanda_contratada.sql
--   0009_economia_migrando_tarifa.sql
-- =============================================================================


-- ##########################################################################
-- 0001_schema_inicial.sql
-- ##########################################################################

-- =============================================================================
-- 0001 — Schema inicial do diagnóstico energético rural
--
-- Princípios aplicados desde este primeiro commit:
--   * minimização: nenhum campo de CPF, RG, endereço completo ou e-mail.
--     Só o que o diagnóstico e o follow-up comercial realmente usam.
--   * consentimento é registro próprio, append-only, com prova (versão da
--     política + texto exibido + carimbo de tempo).
--   * cada etapa do formulário é uma tabela: o lead é capturado na tela 1
--     mesmo que abandone na tela 3.
--   * retenção com data de expiração explícita em cada lead.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------

create or replace function public.tg_atualizado_em()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

comment on function public.tg_atualizado_em is
  'Mantém a coluna atualizado_em em dia.';

create or replace function public.tg_bloqueia_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Tabela append-only: registros existentes não podem ser alterados. Insira um novo registro.';
end;
$$;

comment on function public.tg_bloqueia_update is
  'Protege o histórico de consentimento contra alteração retroativa.';

-- -----------------------------------------------------------------------------
-- TELA 1 — cadastro rápido
-- -----------------------------------------------------------------------------

create table public.leads (
  id                uuid primary key default gen_random_uuid(),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),

  nome              text not null check (length(btrim(nome)) between 2 and 120),
  -- WhatsApp normalizado em E.164 pela aplicação antes de gravar.
  whatsapp          text not null check (whatsapp ~ '^\+55[1-9][0-9]{9,10}$'),
  nome_propriedade  text not null check (length(btrim(nome_propriedade)) between 2 and 120),
  municipio         text not null check (length(btrim(municipio)) between 2 and 80),
  uf                char(2) not null default 'MG' check (uf ~ '^[A-Z]{2}$'),

  -- Onde o produtor parou. Serve para medir o funil e retomar o preenchimento.
  etapa             text not null default 'cadastro'
                    check (etapa in ('cadastro','perfil','consumo','diagnostico','concluido')),

  -- Origem da visita (campanha/indicação). Texto livre curto, sem rastreio de terceiros.
  origem            text check (length(origem) <= 60),

  -- Retenção: o expurgo apaga o lead (e tudo em cascata) depois desta data.
  expira_em         timestamptz not null default (now() + interval '18 months')
);

comment on table public.leads is
  'Cadastro mínimo do produtor (tela 1). Base legal: consentimento.';
comment on column public.leads.expira_em is
  'Data-limite de retenção. Ver public.lgpd_expurgar_expirados().';

create index leads_whatsapp_idx  on public.leads (whatsapp);
create index leads_criado_em_idx on public.leads (criado_em desc);
create index leads_expira_em_idx on public.leads (expira_em);
create index leads_municipio_idx on public.leads (municipio);

create trigger leads_atualizado_em
  before update on public.leads
  for each row execute function public.tg_atualizado_em();

-- -----------------------------------------------------------------------------
-- Consentimentos — granulares, independentes e append-only
--
-- Duas finalidades separadas (tela 1):
--   'diagnostico'               → usar os dados para gerar o diagnóstico
--   'compartilhamento_parceiro' → repassar o contato ao fornecedor de BESS
--
-- Revogação NÃO apaga a linha: insere-se uma nova com concedido = false.
-- Assim fica provado o que foi consentido, quando, sob qual texto e versão.
-- -----------------------------------------------------------------------------

create table public.consentimentos (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid not null references public.leads(id) on delete cascade,

  finalidade        text not null
                    check (finalidade in ('diagnostico','compartilhamento_parceiro')),
  concedido         boolean not null,

  versao_politica   text not null check (length(versao_politica) between 1 and 20),
  -- Frase exata que apareceu na tela, copiada no momento do aceite.
  texto_apresentado text not null check (length(texto_apresentado) between 10 and 500),

  origem            text not null default 'formulario_web'
                    check (origem in ('formulario_web','whatsapp','telefone','painel_interno')),

  -- Prova técnica mínima. Guardamos hash do IP (sha256 com pepper do servidor),
  -- nunca o IP em claro — dá para conferir uma contestação sem estocar o dado.
  ip_hash           text check (ip_hash ~ '^[0-9a-f]{64}$'),
  user_agent        text check (length(user_agent) <= 300),

  criado_em         timestamptz not null default now()
);

comment on table public.consentimentos is
  'Histórico append-only de consentimento. Revogar = inserir linha com concedido=false.';

create index consentimentos_lead_idx on public.consentimentos (lead_id, finalidade, criado_em desc);

create trigger consentimentos_sem_update
  before update on public.consentimentos
  for each row execute function public.tg_bloqueia_update();

-- Estado atual de cada consentimento (última manifestação vence).
create view public.consentimentos_atuais
with (security_invoker = true) as
select distinct on (lead_id, finalidade)
       lead_id,
       finalidade,
       concedido,
       versao_politica,
       criado_em as decidido_em
from public.consentimentos
order by lead_id, finalidade, criado_em desc;

create or replace function public.fn_consentimento_ativo(p_lead_id uuid, p_finalidade text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select concedido
       from public.consentimentos
      where lead_id = p_lead_id
        and finalidade = p_finalidade
      order by criado_em desc
      limit 1),
    false);
$$;

comment on function public.fn_consentimento_ativo is
  'true se a última manifestação do titular para a finalidade foi um "sim".';

-- -----------------------------------------------------------------------------
-- TELA 2 — perfil da atividade
-- -----------------------------------------------------------------------------

create table public.perfis_atividade (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid not null unique references public.leads(id) on delete cascade,

  atividades        text[] not null
                    check (
                      array_length(atividades, 1) between 1 and 3
                      and atividades <@ array['leite_gado','graos_cafe_irrigado','outro']::text[]
                    ),
  atividade_outro   text check (length(atividade_outro) <= 120),

  equipamentos      text[] not null default '{}'::text[]
                    check (
                      equipamentos <@ array[
                        'ordenha_mecanizada','tanque_resfriamento','caldeira','pivo_central'
                      ]::text[]
                    ),

  possui_solar      boolean not null default false,
  possui_bess       boolean not null default false,

  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

comment on table public.perfis_atividade is
  'Tela 2. Um perfil por lead (o produtor pode voltar e corrigir).';

create trigger perfis_atividade_atualizado_em
  before update on public.perfis_atividade
  for each row execute function public.tg_atualizado_em();

-- -----------------------------------------------------------------------------
-- TELA 3 — consumo energético
-- -----------------------------------------------------------------------------

create table public.consumos_energia (
  id                  uuid primary key default gen_random_uuid(),
  lead_id             uuid not null unique references public.leads(id) on delete cascade,

  valor_fatura_reais  numeric(12,2) not null
                      check (valor_fatura_reais > 0 and valor_fatura_reais <= 1000000),
  -- Opcional: muita gente não tem a fatura em mãos.
  consumo_kwh         numeric(12,2)
                      check (consumo_kwh is null or (consumo_kwh > 0 and consumo_kwh <= 5000000)),

  classe_tarifaria    text not null
                      check (classe_tarifaria in ('branca','convencional','grupo_a','nao_sei')),

  mes_referencia      date,

  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

comment on table public.consumos_energia is 'Tela 3. Entradas quantitativas do diagnóstico.';

create trigger consumos_energia_atualizado_em
  before update on public.consumos_energia
  for each row execute function public.tg_atualizado_em();

-- -----------------------------------------------------------------------------
-- TELA 4 (motor) — resultado calculado
--
-- Guarda o snapshot das entradas e a versão do motor: quando recalibrarmos as
-- constantes, os diagnósticos antigos continuam explicáveis.
-- -----------------------------------------------------------------------------

create table public.diagnosticos (
  id                        uuid primary key default gen_random_uuid(),
  lead_id                   uuid not null references public.leads(id) on delete cascade,

  -- Identificador do relatório público. Aleatório, não sequencial.
  token_publico             uuid not null unique default gen_random_uuid(),

  motor_versao              text not null check (length(motor_versao) between 1 and 20),

  economia_mensal_reais     numeric(12,2) not null check (economia_mensal_reais >= 0),
  economia_min_reais        numeric(12,2) check (economia_min_reais >= 0),
  economia_max_reais        numeric(12,2) check (economia_max_reais >= 0),
  economia_percentual       numeric(5,2) not null
                            check (economia_percentual >= 0 and economia_percentual <= 100),

  bess_capacidade_kwh       numeric(10,2) check (bess_capacidade_kwh > 0),
  bess_potencia_kw          numeric(10,2) check (bess_potencia_kw > 0),
  investimento_estimado_reais numeric(12,2) check (investimento_estimado_reais >= 0),
  payback_meses             integer check (payback_meses > 0),

  confianca                 text not null default 'media' check (confianca in ('baixa','media','alta')),

  entradas                  jsonb not null,                    -- o que entrou no cálculo
  detalhes                  jsonb not null default '{}'::jsonb, -- passos intermediários

  criado_em                 timestamptz not null default now(),

  constraint diagnosticos_faixa_coerente
    check (economia_min_reais is null or economia_max_reais is null
           or economia_min_reais <= economia_max_reais)
);

comment on table public.diagnosticos is
  'Saída do motor de regras. Vários por lead: o mais recente é o que vale.';
comment on column public.diagnosticos.token_publico is
  'Usado na URL /relatorio/[token]. A página não expõe dados pessoais.';

create index diagnosticos_lead_idx on public.diagnosticos (lead_id, criado_em desc);

-- -----------------------------------------------------------------------------
-- TELA 5 — "quero saber mais": interesse comercial
--
-- Encaminhar o contato ao parceiro só é permitido com o consentimento
-- 'compartilhamento_parceiro' ativo. Isso é garantido no banco, não só no código.
-- -----------------------------------------------------------------------------

create table public.interesses_comerciais (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references public.leads(id) on delete cascade,
  diagnostico_id  uuid references public.diagnosticos(id) on delete set null,

  quer_contato    boolean not null default true,
  melhor_horario  text check (length(melhor_horario) <= 60),
  observacao      text check (length(observacao) <= 500),

  status          text not null default 'novo'
                  check (status in ('novo','encaminhado','em_contato','ganho','perdido')),
  parceiro_slug   text check (length(parceiro_slug) <= 40),
  encaminhado_em  timestamptz,

  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

comment on table public.interesses_comerciais is
  'Tela 5. Confirmação de interesse e trilha do repasse ao parceiro.';

create index interesses_status_idx on public.interesses_comerciais (status, criado_em desc);
create index interesses_lead_idx   on public.interesses_comerciais (lead_id);

create trigger interesses_atualizado_em
  before update on public.interesses_comerciais
  for each row execute function public.tg_atualizado_em();

create or replace function public.tg_exige_consentimento_parceiro()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.encaminhado_em is not null
     and not public.fn_consentimento_ativo(new.lead_id, 'compartilhamento_parceiro') then
    raise exception
      'Encaminhamento bloqueado: o titular % não autorizou o compartilhamento com o parceiro.',
      new.lead_id;
  end if;
  return new;
end;
$$;

create trigger interesses_valida_consentimento
  before insert or update on public.interesses_comerciais
  for each row execute function public.tg_exige_consentimento_parceiro();

-- -----------------------------------------------------------------------------
-- Pedidos do titular (exclusão, correção, acesso, revogação)
-- Chegam pelo WhatsApp e são registrados aqui para não se perderem.
-- -----------------------------------------------------------------------------

create table public.solicitacoes_titular (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid references public.leads(id) on delete set null,
  -- Guardado quando ainda não sabemos qual lead é (contato veio solto no WhatsApp).
  whatsapp_informado text check (whatsapp_informado ~ '^\+55[1-9][0-9]{9,10}$'),

  tipo              text not null
                    check (tipo in ('acesso','correcao','exclusao','revogacao_consentimento','portabilidade')),
  canal             text not null default 'whatsapp'
                    check (canal in ('whatsapp','formulario','email','telefone')),
  descricao         text check (length(descricao) <= 1000),

  status            text not null default 'aberta'
                    check (status in ('aberta','em_andamento','concluida','recusada')),
  resposta          text check (length(resposta) <= 1000),

  criado_em         timestamptz not null default now(),
  -- Prazo de resposta que assumimos publicamente na política.
  prazo_em          timestamptz not null default (now() + interval '15 days'),
  concluido_em      timestamptz
);

comment on table public.solicitacoes_titular is
  'Fila de pedidos de acesso/correção/exclusão. Prazo padrão de 15 dias.';

create index solicitacoes_status_idx on public.solicitacoes_titular (status, prazo_em);


-- ##########################################################################
-- 0002_rls_e_retencao.sql
-- ##########################################################################

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


-- ##########################################################################
-- 0003_registrar_cadastro.sql
-- ##########################################################################

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


-- ##########################################################################
-- 0004_salvar_perfil.sql
-- ##########################################################################

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


-- ##########################################################################
-- 0005_salvar_consumo.sql
-- ##########################################################################

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


-- ##########################################################################
-- 0006_diagnostico_e_interesse.sql
-- ##########################################################################

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


-- ##########################################################################
-- 0007_expurgo_agendado.sql
-- ##########################################################################

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


-- ##########################################################################
-- 0008_demanda_contratada.sql
-- ##########################################################################

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


-- ##########################################################################
-- 0009_economia_migrando_tarifa.sql
-- ##########################################################################

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

