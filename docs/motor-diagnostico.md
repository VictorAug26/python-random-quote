# Motor de diagnóstico — especificação v1

Tela 4 do fluxo: não tem interface, roda no servidor logo depois que o produtor
envia a tela 3. É um **motor de regras**, não modelo estatístico — com os dados
que temos (uma fatura e alguns checkboxes), regra bem calibrada ganha de
qualquer coisa mais sofisticada.

> **O preço da energia não é mais estimativa.** Tarifa, diferença
> ponta/fora-ponta e preço da demanda vêm da resolução homologatória vigente da
> CEMIG-D, publicada pela ANEEL em dados abertos. Ficam em
> `src/lib/motor/tarifas-cemig.json`, gerado por `npm run tarifas`, e são lidas
> por `src/lib/motor/tarifas.ts`.
>
> ⚠️ **O resto continua estimativa**, e precisa de calibração com faturas reais
> e com a tabela de preços do parceiro integrador antes de virar número mostrado
> a produtor — principalmente a **fração deslocável** (passo 2), o **perfil de
> consumo por posto** (passo 3) e o **investimento por kWh** (passo 6). Ficam em
> `src/lib/motor/parametros.ts`, num objeto só, versionado.

## De onde vem o preço da energia

O portal de dados abertos da ANEEL publica as tarifas de aplicação de todas as
distribuidoras do país, regeradas diariamente. `scripts/atualizar-tarifas.mjs`
busca as linhas da CEMIG-D e grava um JSON commitado.

Não é consulta em tempo real, e isso é decisão de projeto:

1. **Reprodutibilidade.** O relatório é um link compartilhável. Se o produtor
   voltar em março, os números têm que ser os mesmos, e explicáveis por uma
   resolução específica — que fica gravada com o diagnóstico.
2. **Disponibilidade.** O portal cair não pode derrubar o diagnóstico.
3. **Revisão.** Número que muda sozinho em produção não passa por ninguém.
   Tarifa errada vira promessa errada de economia.

O workflow `.github/workflows/tarifas.yml` roda toda segunda, e quando a ANEEL
reajusta ele **abre um pull request** em vez de aplicar. Os testes de número
fixo em `tests/motor.test.ts` falham de propósito nesse PR: é o portão que
obriga alguém a olhar o quanto a economia prometida mudou.

Qual linha da ANEEL vale para cada produtor está em `perfilTarifario()`:

| Resposta na tela 3 | Linha da ANEEL |
| --- | --- |
| Convencional | B2 Rural Convencional |
| Tarifa branca | B2 Rural Branca |
| Grupo A, demanda < 300 kW | A4 Verde |
| Grupo A, demanda ≥ 300 kW | A4 Azul |
| Não sei | B2 Rural Branca, com o ganho cortado pela metade |

A modalidade do Grupo A sai da demanda contratada em vez de virar pergunta:
acima de 300 kW a distribuidora exige a Azul. Perguntar "azul ou verde?" seria
jargão que o produtor não usa.

O filtro que isola o consumidor cativo comum é `DscDetalhe = "Não se aplica"`.
As outras opções (`SCEE`, para quem já tem geração própria; `APE`, autoprodutor)
têm TE bem menor e dariam um número plausível e errado.

### Tributos

As tarifas da ANEEL são **sem tributos e sem bandeira**; a conta que chega é
maior. O motor aplica um fator, e prefere medir a estimar:

- **Produtor informou fatura e kWh:** o fator sai da divisão —
  `(fatura / kWh) / tarifaDaAneel`. É o único ponto do motor que se calibra com
  dado do próprio produtor. Fora da faixa 1,0–1,8 é descartado, porque quase
  sempre é erro de digitação.
- **Não informou:** 1/(1 − 0,23), de PIS/COFINS (~5%) e ICMS (18% em MG desde a
  LC 194/2022). É limite superior: produtor rural tem isenções em alguns casos.

---

## Entradas

```ts
{
  atividades: ('leite_gado' | 'graos_cafe_irrigado' | 'outro')[]
  equipamentos: ('ordenha_mecanizada' | 'tanque_resfriamento' | 'caldeira' | 'pivo_central')[]
  possuiSolar: boolean
  possuiBess: boolean
  valorFaturaReais: number
  consumoKwh?: number
  classeTarifaria: 'branca' | 'convencional' | 'grupo_a' | 'nao_sei'
  demandaContratadaKw?: number   // só no Grupo A, e opcional mesmo lá
}
```

## Passo 1 — consumo mensal em kWh

Se o produtor informou `consumoKwh`, usa. Senão, estima pela fatura:

```
consumoKwh = valorFaturaReais / tarifaMediaEstimada[classeTarifaria]
```

A tarifa média sai da ANEEL, ponderada pelos postos tarifários e multiplicada
pelo fator de tributos acima. Ver `perfilTarifario().tarifaMediaReaisPorKwh`.

## Passo 2 — fração do consumo que dá para deslocar

Quanto do consumo pode sair do horário caro para o barato usando bateria.
Soma por equipamento, sobre uma base fixa, com teto:

| Item | Fração |
| --- | --- |
| base (iluminação, uso geral) | 0,08 |
| tanque de resfriamento | +0,18 |
| ordenha mecanizada | +0,10 |
| caldeira | +0,08 |
| pivô central | +0,22 |
| **teto** | **0,45** |

O tanque e o pivô puxam mais porque são cargas grandes, previsíveis e com
alguma folga de horário — exatamente o que bateria aproveita.

## Passo 3 — diferença de tarifa capturável

Quanto se ganha por kWh deslocado: `tarifaPonta − tarifaForaPonta`, das duas
linhas da ANEEL, vezes o fator de tributos.

Com a REH 3.589 (vigente até 27/05/2027), sem tributos:

| Modalidade | Ponta | Fora ponta | Diferença |
| --- | --- | --- | --- |
| B2 Rural Branca | 1,83628 | 0,76877 | **1,06751** |
| A4 Verde | 2,38718 | 0,48077 | **1,90641** |
| A4 Azul | 0,66001 | 0,48077 | **0,17924** |
| B2 Rural Convencional | — | — | **0** |

Três coisas que só ficaram visíveis com o número real:

- **A convencional não tem ponta.** A diferença é exatamente zero, não 0,12: a
  bateria não economiza nada ali. O relatório dessa classe muda de assunto e
  passa a falar de migração de tarifa (`CardTarifaPlana`).
- **Verde e Azul são opostas.** A Verde ganha deslocando energia; a Azul ganha
  cortando demanda (R$ 71,13/kW na ponta contra R$ 23,77 fora dela). Tratar
  "Grupo A" como um número só estava errado.
- **As estimativas antigas erravam por 3 a 4 vezes** para baixo na branca e na
  Verde, e por mais de 2 vezes para cima na Azul.

### Teto físico: só dá para economizar sobre o que era caro

A bateria economiza a diferença de tarifa sobre kWh que **estavam sendo
comprados na ponta**. Tirar carga do horário barato e devolver no horário
barato não economiza nada.

```
energiaNaPonta    = consumoDiario × fracaoConsumoNaPonta
energiaDeslocavel = min(consumoDiario × fracaoDeslocavel, energiaNaPonta)
```

O perfil de consumo por posto (`PERFIL_CONSUMO`) hoje é 11% na ponta e 7% no
intermediário na branca, 13% na ponta no Grupo A. Em horas puras a ponta daria
~9% do mês; numa fazenda de leite a ordenha da tarde costuma cair dentro dela,
então o peso real tende a ser maior. **É um dos números que mais precisa de
fatura real.**

Sem esse limite o motor prometia economia sobre energia que nunca passou pelo
horário caro. Com a diferença de R$ 0,12 que se estimava antes, o erro passava
despercebido; com R$ 1,07 real, ele dominava o resultado.

## Passo 4 — porte de bateria

O dimensionamento vem **antes** do cálculo de economia, de propósito: quem
economiza é a bateria que vai ser instalada, não a energia que teoricamente
daria para deslocar.

```
consumoDiario     = consumoKwh / 30
energiaDeslocavel = consumoDiario × fracaoDeslocavel
capacidadeKwh     = faixaComercialMaisProxima(energiaDeslocavel / 0,90)
potenciaKw        = capacidadeKwh / 3
energiaDeslocada  = min(energiaDeslocavel, capacidadeKwh × 0,90)
```

Faixas comerciais: **15, 30, 50, 100, 200 kWh**, escolhendo a **mais próxima**
(acima de 200, arredonda de 50 em 50). Arredondar sempre para cima empurrava
125 kWh para 200 e quase dobrava o investimento sem o produtor ganhar nada.

Se o porte comercial escolhido não comporta tudo o que daria para deslocar, a
economia cai junto — senão o relatório prometeria um ganho que o equipamento
recomendado não entrega.

## Passo 4b — redução de demanda contratada (só Grupo A)

A conta do Grupo A cobra também pelo **maior pico de kW do mês**, e cortar esse
pico costuma valer mais que deslocar energia. A tela 3 pergunta a demanda
contratada quando a tarifa é Grupo A — opcional, porque nem todo produtor sabe
de cabeça.

```
reducaoKw = min(potenciaBateria, demandaContratada × 0,30)
economiaDemanda = reducaoKw × R$ 30/kW/mês
```

| Constante | Valor | Origem |
| --- | --- | --- |
| R$ por kW de demanda, por mês | 30 | ⚠️ estimativa, calibrar com fatura real |
| Fração do pico que dá para cortar | 0,30 | ⚠️ estimativa |

O corte esbarra em dois limites: a **potência da bateria** (não adianta ter
energia se não entrega kW) e a **parte do pico que é redutível** — parte da
carga é simultânea e inevitável.

Efeito no cenário de referência (fazenda leiteira, R$ 8.400, Grupo A):

| Demanda contratada | Energia | Demanda | Total | Retorno |
| --- | --- | --- | --- | --- |
| não informada | R$ 1.307 | — | R$ 1.307 | 20,4 anos |
| 50 kW | R$ 1.307 | R$ 450 | R$ 1.757 | 15,2 anos |
| 150 kW | R$ 1.307 | R$ 999 | R$ 2.306 | **11,6 anos** |
| 300 kW | R$ 1.307 | R$ 999 | R$ 2.306 | 11,6 anos |

Satura em 150 kW porque a partir daí o gargalo passa a ser a potência da
bateria (33,3 kW), não o pico disponível para cortar.

## Passo 5 — economia mensal

```
economiaEnergia = energiaDeslocada
         × 30
         × deltaTarifa
         × 0,88            // eficiência de ida e volta da bateria
         × ajusteSolar     // 1,25 se já tem solar, senão 1,00
         × ajusteBess      // 0,30 se já tem bateria

economia = economiaEnergia + economiaDemanda
economia = min(economia, valorFaturaReais × 0,35)   // trava de sanidade
faixa    = economia × 0,75  ..  economia × 1,25
```

Quando o teto corta, as duas parcelas encolhem na mesma proporção — senão a
soma exibida no relatório não bateria com o total.

A trava de 35% existe para o relatório nunca prometer o improvável. Quem já
tem solar ganha mais com bateria (guarda o excedente em vez de injetar), por
isso o multiplicador para cima.

## Passo 6 — investimento e retorno

```
investimento  = capacidadeKwh × 3.200   // R$/kWh instalado, a calibrar
paybackMeses  = investimento / economia
```

Se o payback passar de 120 meses, o relatório muda de tom: em vez de vender
bateria, sugere revisar a tarifa primeiro. Diagnóstico honesto vende melhor no
médio prazo — e evita lead queimado com o parceiro.

---

## Retorno, com as tarifas reais da ANEEL

A troca das tarifas estimadas pelas da REH 3.589 mudou o quadro. Antes, com
`deltaTarifa = 0,45` chutado, o payback dava 22 anos em todo cenário. Agora:

| Cenário (fatura R$ 8.400, 8.900 kWh) | Economia/mês | Bateria | Payback |
| --- | --- | --- | --- |
| Grupo A Verde, 150 kW | R$ 2.940 | 50 kWh | **4,5 anos** |
| Tarifa branca | R$ 783 | 30 kWh | **10,3 anos** |
| Grupo A Azul, 500 kW | R$ 1.264 | 50 kWh | **10,6 anos** |
| Não sei a tarifa | R$ 391 | 30 kWh | 20,4 anos |
| Convencional | R$ 0 | — | não se paga |

Pivô central em Grupo A Verde (fatura R$ 25.000): R$ 6.086/mês, **4,4 anos**.

Duas leituras:

- **O Grupo A Verde fecha a conta** mesmo com o investimento por kWh ainda
  chutado. É o perfil que o produto deveria priorizar comercialmente.
- **A branca fica no limite.** 10,3 anos contra uma vida útil de ~15 anos é
  retorno real mas magro, e o relatório aciona o alerta de retorno longo.

### O que ainda está chutado, e pesa mais

`investimentoReaisPorKwh = 3.200` é **a maior incerteza que restou**, e domina
o resultado: o payback é proporcional a ele. Preço de BESS instalado caiu muito
nos últimos anos, e o número do parceiro integrador pode ser bem menor. A 
R$ 2.000/kWh a branca cairia para ~6,4 anos.

Depois dele, na ordem: o **perfil de consumo por posto** (quanto da energia cai
de fato na ponta — hoje 11%/13% estimados) e a **fração deslocável**. Os dois
só saem de fatura real ou de medição na propriedade.

### Limitação conhecida: desconto de irrigação

Produtor rural com irrigação tem direito a desconto na tarifa noturna
(Convênio ICMS 76/91 e desconto de irrigação da própria ANEEL), tipicamente
entre 21h30 e 6h. Quem já tem esse desconto tem menos a ganhar com bateria, e o
motor **não modela isso** — nem a tabela de tarifas de aplicação da ANEEL traz o
desconto, que é aplicado à parte. Para pivô central, o resultado tende a ser
otimista.

## Passo 7 — confiança

| Situação | Confiança |
| --- | --- |
| informou kWh **e** classe tarifária | alta |
| informou só um dos dois | média |
| não informou nenhum | baixa |

A confiança muda a formulação: com confiança baixa o texto vira *"pelo que dá
para estimar, algo em torno de R$ X por mês"*.

---

## Saída (gravada em `public.diagnosticos`)

```ts
{
  motorVersao: 'v1.0.0',
  economiaMensalReais, economiaMinReais, economiaMaxReais, economiaPercentual,
  bessCapacidadeKwh, bessPotenciaKw,
  investimentoEstimadoReais, paybackMeses,
  confianca,
  entradas,   // snapshot do que entrou
  detalhes    // consumo estimado, fração deslocável, delta usado
}
```

`motorVersao` muda toda vez que uma constante é recalibrada. Assim um
diagnóstico de seis meses atrás continua explicável.

---

## Linguagem do relatório

Sempre concreto e sem jargão:

- ✅ "Com um sistema de baterias, você pode economizar cerca de **R$ 1.840 por mês**."
- ✅ "Para a sua fazenda, o porte indicado é de **50 kWh** de bateria."
- ❌ "otimização de dispatch", "EMS", "peak shaving", "arbitragem tarifária".

Regra prática: se a frase não faria sentido dita em voz alta no curral, reescreve.
