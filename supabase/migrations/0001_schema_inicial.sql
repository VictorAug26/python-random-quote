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
