# Como rodar o app

Do zero até clicar nas cinco telas. São uns 15 minutos, quase todos esperando
o Supabase criar o projeto.

O app precisa de um banco de verdade — as regras de consentimento e retenção
vivem dentro do Postgres, não no código. Por isso não existe "modo demonstração":
o que você testaria não seria o app.

---

## 1. Um projeto no Supabase (grátis)

1. Entre em [supabase.com](https://supabase.com) e crie um projeto.
2. Guarde a senha do banco que ele pedir — você vai precisar no passo 2.
3. Escolha a região mais perto (`South America (São Paulo)`).

Enquanto ele provisiona, siga para o passo 3.

## 2. Aplicar as migrations

As sete migrations em `supabase/migrations/` criam tabelas, regras e o
agendamento do expurgo. Duas formas:

**Com o CLI do Supabase** (recomendado — aplica todas na ordem certa):

```bash
npm install -g supabase
supabase link --project-ref SEU_REF   # o ref está na URL do painel
supabase db push
```

**Ou pelo painel**, se preferir não instalar nada: abra o **SQL Editor** e cole
o conteúdo de cada arquivo de `supabase/migrations/`, **na ordem numérica**,
rodando um de cada vez.

> **Antes de rodar a 0007**, habilite a extensão `pg_cron` em
> **Database → Extensions**. É ela que faz o expurgo diário acontecer. Sem ela
> a migration avisa e segue — o app funciona, mas a retenção não roda sozinha.

## 3. Configurar o app

```bash
npm install
cp .env.example .env.local
```

Abra o `.env.local` e preencha quatro valores:

| Variável | Onde achar |
| --- | --- |
| `SUPABASE_URL` | Painel → Project Settings → Data API → **Project URL** |
| `SUPABASE_SERVICE_ROLE_KEY` | Painel → Project Settings → API Keys → **service_role** |
| `SESSAO_SECRET` | gere: `openssl rand -base64 32` |
| `IP_HASH_PEPPER` | gere: `openssl rand -base64 32` |

> A `service_role` é a chave que **ignora todas as travas de segurança** do
> banco. Ela só existe no servidor e nunca deve ir para o navegador — por isso
> nenhuma variável deste projeto começa com `NEXT_PUBLIC_` a não ser a URL do
> site. Não comite o `.env.local` (ele já está no `.gitignore`).

## 4. Conferir antes de abrir

```bash
npm run checar
```

Diz exatamente o que falta — variável não preenchida, chave trocada, migration
que não foi aplicada. Quando aparecer **"Tudo pronto"**:

```bash
npm run dev
```

Abra <http://localhost:3000>.

---

## Testando no celular

O visual é feito para celular, e é assim que vale olhar. Duas opções:

**Mesma rede Wi-Fi:** o `npm run dev` mostra um endereço `Network:` — abra
esse no celular.

**De qualquer lugar:** publique na Vercel. Importe o repositório em
[vercel.com/new](https://vercel.com/new), cole as mesmas quatro variáveis em
**Environment Variables**, e defina também:

```
NEXT_PUBLIC_SITE_URL=https://seu-app.vercel.app
WHATSAPP_CONTATO=+5534SEUNUMERO
```

O deploy sai em uns dois minutos e você tem um link para mandar para quem
quiser opinar.

---

## O que olhar enquanto testa

Um roteiro do que vale conferir:

- **Tela 1** — os dois consentimentos são separados? Tente enviar sem marcar o
  primeiro. Marque só o primeiro e siga: o diagnóstico sai igual.
- **Tela 2** — marque "Outra atividade" e veja o campo aparecer.
- **Tela 3** — digite `8400` no valor e saia do campo. Digite `8.400,00`.
  Deixe o kWh em branco e siga assim mesmo.
- **Relatório** — o número faz sentido para a fazenda que você descreveu? O
  aviso sobre o retorno longo aparece? (Ver o achado de calibração em
  `motor-diagnostico.md` — os números ainda são estimativas.)
- **Compartilhar** — abra o link do relatório numa aba anônima. Você vê os
  números, mas não o botão de pedir contato, e nenhum dado pessoal.
- **Voltar e corrigir** — volte para `/perfil` ou `/consumo`: as respostas
  estão lá.

## Ver o que foi gravado

No painel do Supabase, **Table Editor**. Vale olhar `consentimentos`: uma linha
por autorização, com a versão da política e a frase exata que apareceu na tela.

## Apagar tudo e recomeçar

```sql
truncate leads cascade;
```

Ou, para simular um pedido de exclusão de um titular só:

```sql
select public.lgpd_atender_pedido_exclusao('+5534991234567');
select public.lgpd_expurgar_expirados();
```

---

## Se algo der errado

| Sintoma | Provável causa |
| --- | --- |
| "Variável de ambiente ausente: X" na tela | falta preencher no `.env.local` — rode `npm run checar` |
| "Não conseguimos salvar agora" | o Supabase recusou; veja o terminal do `npm run dev` |
| Formulário não reage aos cliques | recarregue; se persistir, veja o console do navegador |
| Erro de tabela inexistente | alguma migration não foi aplicada — `npm run checar` diz qual |
