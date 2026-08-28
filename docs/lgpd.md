# LGPD — decisões aplicadas no produto

Documento curto e prático. Serve para (a) orientar quem escreve código e
(b) virar a base do texto da política de privacidade.

> **Pendência de negócio:** definir quem é o **controlador** — a pessoa física
> ou empresa que responde pelos dados — e o WhatsApp de atendimento. Sem isso a
> política de privacidade não pode ir ao ar.
> Nota: este documento organiza as decisões de produto; não substitui revisão
> jurídica antes do lançamento.

---

## 1. Dados coletados e por quê

| Dado | Tela | Para que serve | Poderia não coletar? |
| --- | --- | --- | --- |
| Nome | 1 | Personalizar o relatório e a abordagem do parceiro | Não |
| WhatsApp | 1 | Entregar o resultado e permitir o follow-up | Não |
| Nome da propriedade | 1 | Identificar a fazenda no relatório | Não |
| Município | 1 | Contexto tarifário/distribuidora da região | Não |
| Atividade e equipamentos | 2 | Entrada direta do motor de diagnóstico | Não |
| Já tem solar/BESS | 2 | Ajusta o cálculo e a recomendação | Não |
| Valor da fatura | 3 | Base do cálculo de economia | Não |
| Consumo em kWh | 3 | Melhora a precisão (opcional) | É opcional |
| Classe tarifária | 3 | Define quanto dá para capturar de diferença | Não |

**Não coletamos** — e não devemos passar a coletar sem uma razão concreta:
CPF, RG, e-mail, endereço completo, coordenadas da propriedade, dados
bancários, foto de documento, foto da fatura.

Se em algum momento alguém pedir "só mais um campinho", a pergunta é: *qual
número do diagnóstico muda por causa dele?* Se nenhum, não entra.

---

## 2. Consentimento granular

Os dois checkboxes da tela 1 são independentes e **nenhum vem pré-marcado**:

1. `diagnostico` — "Autorizo o uso dos meus dados para gerar o diagnóstico
   energético." → **obrigatório**, sem ele não há produto a entregar.
2. `compartilhamento_parceiro` — "Autorizo o compartilhamento do meu contato com
   um parceiro fornecedor de BESS." → **opcional**. Quem recusa recebe o
   diagnóstico normalmente. O botão "quero saber mais" da tela 5 pede esse
   aceite na hora, se ainda não tiver sido dado.

Como isso vive no banco (`public.consentimentos`):

- uma linha por finalidade, por manifestação;
- guarda a **versão da política** e o **texto exato** que apareceu na tela;
- guarda hash do IP (SHA-256 com pepper do servidor) e user agent — nunca o IP
  em claro;
- é **append-only**: um trigger bloqueia `UPDATE`. Revogar é inserir uma nova
  linha com `concedido = false`;
- a view `consentimentos_atuais` mostra o estado vigente.

**Trava técnica:** o trigger `interesses_valida_consentimento` impede gravar
`encaminhado_em` num lead sem o consentimento de compartilhamento ativo. Ou
seja, mesmo um script interno errado não consegue repassar um contato que não
autorizou.

---

## 3. Retenção e expurgo

| Situação | Prazo | Onde é aplicado |
| --- | --- | --- |
| Fez o diagnóstico, sem interesse comercial | 18 meses | default de `leads.expira_em` |
| Registrou interesse comercial | 24 meses | a aplicação estende `expira_em` |
| Revogou consentimento ou pediu exclusão | imediato | `expira_em = now()` |

`public.lgpd_expurgar_expirados()` roda **todo dia às 4h (UTC)**, agendada por
pg_cron dentro do próprio Supabase (migration 0007). Ela apaga os leads
vencidos; como todas as tabelas filhas têm `on delete cascade`, some tudo:
perfil, consumo, diagnósticos, consentimentos e interesse.

Cada execução deixa uma linha em `expurgos_lgpd` — quantos leads saíram,
quando e em quanto tempo. Nenhum dado pessoal no log, só a contagem. É a prova
de que a retenção é cumprida, e o lugar de olhar se alguém perguntar.

O agendamento fica no banco, e não numa rota HTTP chamada de fora, porque o
trabalho é todo dentro do Postgres: uma rota só acrescentaria um endpoint
público na internet, um segredo para administrar e uma dependência de o app
estar no ar.

---

## 4. Direitos do titular

Canal único e simples: o mesmo WhatsApp de contato, divulgado na política e na
página `/meus-dados`. Pedidos são registrados em `solicitacoes_titular` com
prazo padrão de **15 dias**, para nenhum se perder na conversa.

Para **exclusão**, quem atende roda uma linha:

```sql
select public.lgpd_atender_pedido_exclusao('+5534991234567');
```

A função antecipa o expurgo daquele titular (`expira_em = now()`) e registra o
atendimento. A execução seguinte apaga tudo em cascata — ninguém precisa sair
apagando tabela por tabela e torcendo para não esquecer nenhuma.

Depois que os dados somem, o próprio expurgo **apaga o telefone guardado no
registro de atendimento**, mantendo só a prova de que o pedido existiu e foi
cumprido. Não faria sentido honrar uma exclusão e continuar guardando o número
de quem pediu.

Atende a: confirmação de tratamento, acesso, correção, exclusão, revogação de
consentimento e portabilidade.

---

## 5. Segurança

- **Nenhuma chave no código.** Tudo por variável de ambiente; `.env.local` no
  `.gitignore`; valores só no painel da Vercel.
- **Service role nunca sai do servidor.** Não existe
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` neste projeto.
- **RLS ligada com zero policies** + `REVOKE` para `anon`/`authenticated`
  (migration `0002`): o padrão é negar.
- **Relatório compartilhável não tem dado pessoal.** O link
  `/relatorio/[token]` usa UUID aleatório e mostra só os números — porque link
  mandado em grupo de WhatsApp é link público na prática.
- **HTTPS** em todo lugar, automático na Vercel.
- **Cookie de sessão** `httpOnly`, `secure`, `sameSite=lax`, assinado, carregando
  só o `lead_id`.

---

## 6. Compartilhamento com o parceiro

Só vai para o parceiro quem marcou o segundo checkbox **e** apertou "quero
saber mais". O que é enviado: nome, WhatsApp, propriedade, município e o
resumo do diagnóstico. Não enviamos o histórico bruto de navegação nem os
registros de consentimento.

A política precisa dizer isso com todas as letras, incluindo o nome do
parceiro quando estiver fechado.
