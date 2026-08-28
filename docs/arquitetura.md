# Arquitetura — Diagnóstico Energético Rural (MVP)

Ferramenta de diagnóstico energético para produtores rurais do Alto Paranaíba /
Triângulo Mineiro. O produtor preenche 3 telas curtas, recebe uma estimativa de
economia com BESS e decide se quer falar com um parceiro comercial.

---

## 1. Stack escolhida

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Frontend | **Next.js (App Router) + TypeScript** | Uma rota por tela, formulários renderizados no servidor, zero JS de banco no navegador. Deploy trivial. |
| Estilo | **Tailwind CSS** | Mobile-first sem CSS espalhado; iteração rápida no MVP. |
| Validação | **Zod** | Mesmo schema valida no cliente e no servidor. |
| Backend | **Route Handlers do próprio Next.js** | Não precisa de serviço separado; o motor de diagnóstico roda aqui. |
| Banco | **Supabase (Postgres)** com RLS ligada | Postgres de verdade, migrations em SQL versionado. |
| Deploy | **Vercel** | HTTPS automático e preview por branch, sem configuração. |
| Testes | **Vitest** (só no motor de regras) | O motor é a parte com risco real de erro; telas testamos na mão. |

Alternativa considerada: HTML/JS puro. Descartada porque precisaríamos de um
backend separado de qualquer jeito (a chave do banco **não pode** ir para o
navegador), e aí o Next.js sai mais barato.

### Decisão de segurança que molda tudo

**O navegador nunca fala com o Supabase.** Nem com a chave anônima.
Todo acesso a dados passa por Route Handlers do Next.js usando a
`SUPABASE_SERVICE_ROLE_KEY`, que só existe como variável de ambiente no
servidor. Consequências:

- não existe `NEXT_PUBLIC_SUPABASE_ANON_KEY` neste projeto — se aparecer, é bug;
- as tabelas têm RLS ligada **e nenhuma policy** para `anon`/`authenticated`:
  o padrão é negar tudo;
- validação e regras de negócio ficam num lugar só, impossível de burlar pelo
  DevTools.

---

## 2. Estrutura de pastas

`✓` = já construído. O resto é o desenho combinado, tela por tela.

```
.
├── README.md                     ✓
├── .env.example                  ✓  nomes das variáveis, nunca valores
├── next.config.mjs               ✓  cabeçalhos de segurança e CSP
├── package.json / tsconfig.json  ✓
├── postcss.config.mjs            ✓  Tailwind 4 (configuração mora no CSS)
│
├── docs/                         ✓  arquitetura, lgpd, motor-diagnostico
│
├── supabase/
│   ├── migrations/
│   │   ├── 0001_schema_inicial.sql      ✓ tabelas, checks, triggers
│   │   ├── 0002_rls_e_retencao.sql      ✓ RLS deny-all, revokes, expurgo
│   │   ├── 0003_registrar_cadastro.sql  ✓ tela 1 em uma transação
│   │   ├── 0004_salvar_perfil.sql       ✓ tela 2, com upsert
│   │   ├── 0005_salvar_consumo.sql      ✓ tela 3, com upsert
│   │   ├── 0006_diagnostico_e_interesse.sql ✓ telas 4 e 5 + view pública
│   │   └── 0007_expurgo_agendado.sql    ✓ retenção automática (pg_cron)
│   └── seed.sql                         ✓ dados de teste locais (fictícios)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx               ✓  shell mobile-first
│   │   ├── icon.svg                 ✓
│   │   ├── page.tsx                 ✓  TELA 1 — cadastro rápido
│   │   ├── perfil/page.tsx          ✓  TELA 2 — perfil da atividade
│   │   ├── consumo/page.tsx         ✓  TELA 3 — consumo energético
│   │   ├── relatorio/[token]/page.tsx ✓ TELA 5 — relatório final
│   │   ├── privacidade/page.tsx     ✓  política de privacidade
│   │   ├── meus-dados/page.tsx      ✓  como pedir exclusão/correção
│   │   └── api/
│   │       ├── cadastro/route.ts    ✓  POST tela 1
│   │       ├── perfil/route.ts      ✓  POST tela 2
│   │       ├── consumo/route.ts     ✓  POST tela 3 + roda o motor
│   │       └── interesse/route.ts   ✓  POST botão "quero saber mais"
│   │
│   ├── components/
│   │   ├── ui/                      ✓  Campo, CaixaConsentimento, CaixaOpcao,
│   │   │                                 Grupo, Botao, Passos
│   │   ├── formularios/             ✓  FormCadastro, FormPerfil, FormConsumo,
│   │   │                                 useErros
│   │   └── relatorio/              ✓  CardEconomia, CardBateria, AcoesRelatorio
│   │
│   ├── lib/
│   │   ├── config.ts                ✓  leitura de variáveis de ambiente
│   │   ├── supabase/servidor.ts     ✓  cliente service-role, marcado server-only
│   │   ├── repositorio/leads.ts     ✓  acesso a dados do cadastro
│   │   ├── repositorio/perfis.ts    ✓  acesso a dados do perfil
│   │   ├── repositorio/consumos.ts  ✓  acesso a dados do consumo
│   │   ├── numeros.ts               ✓  lê "8.400,00" digitado à mão
│   │   ├── dominio.ts               ✓  atividades, equipamentos, instalações,
│   │   │                                 classes tarifárias
│   │   ├── validacao/schemas.ts     ✓  schemas Zod das 3 telas
│   │   ├── sessao.ts                ✓  cookie httpOnly assinado
│   │   ├── sessao-token.ts          ✓  assinatura do token (testável isolado)
│   │   ├── consentimento.ts         ✓  textos exibidos + versão da política
│   │   ├── privacidade.ts           ✓  hash de IP, IP e user agent da requisição
│   │   ├── telefone.ts              ✓  máscara e normalização E.164
│   │   ├── municipios.ts            ✓  sugestões da região
│   │   ├── formatacao.ts            ✓  R$, capitalização
│   │   ├── repositorio/diagnosticos.ts ✓ resultado e token público
│   │   └── motor/
│   │       ├── parametros.ts        ✓  TODAS as constantes calibráveis
│   │       ├── calcular.ts          ✓  função pura: entradas → diagnóstico
│   │       ├── mensagens.ts         ✓  texto do relatório, sem jargão
│   │       └── tipos.ts             ✓
│   │
│   └── styles/globals.css           ✓
│
└── tests/                           ✓  motor, telefone, sessao, cadastro,
                                         perfil, consumo
```

Regra de ouro do motor: `calcular.ts` é **função pura**, sem I/O. Recebe as
entradas, devolve o diagnóstico. Isso permite testar dezenas de cenários sem
banco e recalibrar as constantes em um arquivo só.

---

## 3. Fluxo entre as telas (sem login)

O produtor não cria conta. A continuidade entre as telas vem de um **cookie
`httpOnly` assinado** (`dx_sessao`) que carrega só o `lead_id`:

```
Tela 1 → POST /api/cadastro   → cria lead + 2 consentimentos → seta cookie
Tela 2 → POST /api/perfil     → lê lead_id do cookie → grava perfil
Tela 3 → POST /api/consumo    → grava consumo → roda o motor → grava diagnóstico
                              → redireciona para /relatorio/{token_publico}
Tela 5 → botão "quero saber mais" → POST /api/interesse
```

Por que gravar a cada tela em vez de tudo no fim:

- **captura o lead na tela 1.** Quem abandona na tela 3 ainda é um contato
  válido, com consentimento registrado;
- dá para medir onde o funil trava (`leads.etapa`);
- se o celular perde sinal no meio, o produtor volta e continua.

### O link do relatório e o botão de WhatsApp

`/relatorio/[token]` usa um `token_publico` (UUID aleatório) — não sequencial,
não adivinhável. **Essa página não mostra nome, WhatsApp nem nome da
propriedade**, só os números do diagnóstico. Motivo: o botão de compartilhar
manda esse link para grupos de WhatsApp, e link compartilhado é link vazado.
Os dados pessoais aparecem só na sessão do próprio produtor (via cookie).

A mensagem pré-formatada de compartilhamento leva o resumo em texto + o link.

### Retenção: por que o agendamento fica no banco

O expurgo é agendado por **pg_cron, dentro do Supabase** (migration 0007), e
não por uma rota HTTP chamada de fora. O trabalho é todo dentro do Postgres —
apagar linhas vencidas —, então dar a volta pela internet só acrescentaria um
endpoint público, um segredo para administrar e uma dependência de o app estar
no ar. A visibilidade que um painel de cron daria vem da tabela
`expurgos_lgpd`, que registra cada execução sem guardar dado pessoal.

---

## 4. Variáveis de ambiente

Nenhuma chave no código, nunca. `.env.example` documenta os nomes; os valores
vivem no painel da Vercel e no `.env.local` de cada dev (ignorado pelo git).

| Variável | Uso |
| --- | --- |
| `SUPABASE_URL` | endpoint do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | **só servidor**; nunca com prefixo `NEXT_PUBLIC_` |
| `SESSAO_SECRET` | assina o cookie de sessão |
| `IP_HASH_PEPPER` | tempera o hash de IP na prova de consentimento |
| `WHATSAPP_CONTATO` | canal de exclusão/correção de dados |
| `PARCEIRO_SLUG` | identifica o integrador que recebe os leads |
| `NEXT_PUBLIC_SITE_URL` | monta o link do relatório no compartilhamento |

---

A versão da política de privacidade **não** é variável de ambiente: o texto
mora no repositório (`src/app/privacidade/page.tsx`), então a versão mora junto
(`src/lib/consentimento.ts`). Uma coisa só para manter em dia.

---

## 5. Próximos passos

1. **Calibrar as constantes do motor** — hoje o retorno dá 20–25 anos; ver o
   achado no fim de `docs/motor-diagnostico.md`.
2. Preencher o nome do controlador e do parceiro na política de privacidade
   (estão marcados com `[DEFINIR]`) antes de qualquer divulgação.
