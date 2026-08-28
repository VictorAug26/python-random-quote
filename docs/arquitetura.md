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
| Deploy | **Vercel** | HTTPS automático, preview por branch, cron nativo para o expurgo LGPD. |
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

```
.
├── README.md
├── .env.example                     # nomes das variáveis, nunca valores
├── .gitignore
├── next.config.mjs
├── package.json
├── tailwind.config.ts
├── tsconfig.json
│
├── docs/
│   ├── arquitetura.md               # este arquivo
│   ├── lgpd.md                      # mapa de dados, bases legais, retenção
│   └── motor-diagnostico.md         # regras e constantes do motor v1
│
├── supabase/
│   ├── migrations/
│   │   ├── 0001_schema_inicial.sql  # tabelas, checks, triggers
│   │   └── 0002_rls_e_retencao.sql  # RLS deny-all, revokes, expurgo
│   └── seed.sql                     # dados de teste locais (fictícios)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx               # shell mobile-first + indicador de passo
│   │   ├── page.tsx                 # TELA 1 — cadastro rápido
│   │   ├── perfil/page.tsx          # TELA 2 — perfil da atividade
│   │   ├── consumo/page.tsx         # TELA 3 — consumo energético
│   │   ├── relatorio/[token]/page.tsx  # TELA 5 — relatório final
│   │   ├── privacidade/page.tsx     # política de privacidade
│   │   ├── meus-dados/page.tsx      # como pedir exclusão/correção
│   │   └── api/
│   │       ├── cadastro/route.ts    # POST tela 1 → cria lead + consentimentos
│   │       ├── perfil/route.ts      # POST tela 2
│   │       ├── consumo/route.ts     # POST tela 3 → dispara TELA 4 (motor)
│   │       ├── interesse/route.ts   # POST botão "quero saber mais"
│   │       └── cron/expurgo/route.ts# GET protegido por CRON_SECRET
│   │
│   ├── components/
│   │   ├── ui/                      # Campo, Checkbox, Botao, Passos, Moeda
│   │   ├── formularios/             # FormCadastro, FormPerfil, FormConsumo
│   │   └── relatorio/               # CardEconomia, CardBess, BotaoWhatsApp
│   │
│   ├── lib/
│   │   ├── supabase/servidor.ts     # cliente service-role, marcado server-only
│   │   ├── validacao/schemas.ts     # schemas Zod das 3 telas
│   │   ├── sessao.ts                # cookie httpOnly assinado com lead_id
│   │   ├── consentimento.ts         # registro append-only + versão da política
│   │   ├── privacidade.ts           # hash de IP com pepper, normalização
│   │   ├── formatacao.ts            # R$, kWh, telefone BR
│   │   └── motor/
│   │       ├── parametros.ts        # TODAS as constantes calibráveis
│   │       ├── calcular.ts          # função pura: entradas → diagnóstico
│   │       ├── mensagens.ts         # texto do relatório, sem jargão
│   │       └── tipos.ts
│   │
│   └── styles/globals.css
│
└── tests/
    └── motor.test.ts                # casos de referência do motor
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
| `POLITICA_VERSAO` | versão da política vigente, gravada em cada consentimento |
| `WHATSAPP_CONTATO` | canal de exclusão/correção de dados |
| `PARCEIRO_SLUG` | identifica o integrador que recebe os leads |
| `CRON_SECRET` | protege a rota de expurgo |
| `NEXT_PUBLIC_SITE_URL` | monta o link do relatório no compartilhamento |

---

## 5. Próximos passos sugeridos

1. Revisar este documento e o schema (`supabase/migrations/`).
2. Calibrar as constantes de `docs/motor-diagnostico.md` com 3–5 faturas reais
   da região e a tabela de preço do parceiro — hoje são estimativas.
3. Escrever a política de privacidade com o nome do controlador (pessoa/empresa
   que responde pelos dados) e o WhatsApp de atendimento.
4. Aí sim, tela por tela: 1 → 2 → 3 → motor → 5.
