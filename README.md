# Diagnóstico energético para produtores rurais

Ferramenta que estima, em 3 telas curtas, quanto uma fazenda pode economizar
por mês com um sistema de baterias (BESS). Foco inicial: fazendas leiteiras
estruturadas do Alto Paranaíba e Triângulo Mineiro (MG).

O produtor preenche cadastro, perfil da atividade e consumo de energia; recebe
um relatório com a economia estimada e o porte de bateria indicado; e decide se
quer ser contatado por um parceiro comercial.

## Estado atual

| Tela | Situação |
| --- | --- |
| 1 — Cadastro rápido | pronta |
| 2 — Perfil da atividade | a fazer |
| 3 — Consumo energético | a fazer |
| 4 — Motor de diagnóstico | especificado em `docs/motor-diagnostico.md` |
| 5 — Relatório final | a fazer |
| Política de privacidade e canal de exclusão | prontas |

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev
```

Aplique as migrations no seu projeto Supabase, em ordem:

```
supabase/migrations/0001_schema_inicial.sql
supabase/migrations/0002_rls_e_retencao.sql
supabase/migrations/0003_registrar_cadastro.sql
```

`supabase/seed.sql` tem dados fictícios para desenvolvimento. Nunca rode em
produção.

## Verificação

```bash
npm run test       # testes unitários (telefone, validação, sessão)
npm run typecheck
npm run build
```

## Antes do primeiro deploy

- [ ] Preencher `[DEFINIR]` na política de privacidade: nome do controlador e
      do parceiro integrador
- [ ] Definir o `WHATSAPP_CONTATO` de atendimento de dados pessoais
- [ ] Calibrar as constantes do motor com faturas reais e preço do parceiro
- [ ] Configurar as variáveis de ambiente na Vercel
- [ ] Agendar o cron diário de expurgo

## Documentação

- [`docs/arquitetura.md`](docs/arquitetura.md) — stack, estrutura, fluxo entre telas
- [`docs/lgpd.md`](docs/lgpd.md) — dados coletados, consentimento, retenção
- [`docs/motor-diagnostico.md`](docs/motor-diagnostico.md) — regras e constantes do motor

## Duas regras que não se negociam

1. **Chave nenhuma no código.** Tudo por variável de ambiente. A service role
   do Supabase só existe no servidor — não há chave anônima neste projeto,
   porque o navegador não fala com o banco.
2. **Consentimento não vem pré-marcado.** As duas autorizações são separadas e
   independentes, e ficam registradas com a versão da política e o texto exato
   que o produtor leu.
