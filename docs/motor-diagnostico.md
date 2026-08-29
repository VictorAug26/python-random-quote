# Motor de diagnóstico — especificação v1

Tela 4 do fluxo: não tem interface, roda no servidor logo depois que o produtor
envia a tela 3. É um **motor de regras**, não modelo estatístico — com os dados
que temos (uma fatura e alguns checkboxes), regra bem calibrada ganha de
qualquer coisa mais sofisticada.

> ⚠️ **Todas as constantes abaixo são estimativas iniciais.** Precisam ser
> calibradas com 3–5 faturas reais da região e com a tabela de preços do
> parceiro integrador antes de mostrar número para produtor. Elas ficam todas
> em `src/lib/motor/parametros.ts`, num objeto só, versionado.

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
}
```

## Passo 1 — consumo mensal em kWh

Se o produtor informou `consumoKwh`, usa. Senão, estima pela fatura:

```
consumoKwh = valorFaturaReais / tarifaMediaEstimada[classeTarifaria]
```

| Classe | R$/kWh (com tributos) |
| --- | --- |
| convencional | 0,95 |
| branca | 0,92 |
| grupo_a | 0,70 |
| nao_sei | 0,95 |

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

Quanto se ganha por kWh deslocado:

| Classe | R$/kWh economizado | Observação para o relatório |
| --- | --- | --- |
| branca | 0,45 | cenário típico do MVP |
| grupo_a | 0,55 | ponta × fora ponta pesa mais |
| convencional | 0,12 | sem diferença de horário; vale sugerir avaliar mudança de tarifa |
| nao_sei | 0,25 | conservador de propósito |

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

## ⚠️ Achado de calibração: o retorno não fecha com os números de hoje

Rodando o motor, o payback cai entre **20 e 25 anos** nos melhores cenários.
Não é bug: é o que estas constantes produzem. A conta se reduz a duas delas, e
**não depende do tamanho da fazenda**:

```
paybackMeses ≈ investimentoPorKwh / (deltaTarifa × 0,88 × 30)
             ≈ 3.200 / (0,45 × 0,88 × 30)
             ≈ 269 meses  (22 anos)
```

Para o retorno cair para 10 anos seria preciso **uma** destas coisas:

| Alavanca | Hoje | Necessário para 120 meses |
| --- | --- | --- |
| Investimento por kWh instalado | R$ 3.200 | ≤ R$ 1.425 |
| Diferença tarifária capturada | R$ 0,45/kWh | ≥ R$ 1,01/kWh |

Três leituras possíveis, e é decisão de negócio qual vale:

1. **As constantes estão pessimistas.** Preço de BESS instalado caiu muito;
   o número real do parceiro pode ser bem menor que R$ 3.200/kWh.
2. **Falta a maior fonte de economia do Grupo A: a demanda contratada.**
   O modelo só captura diferença de preço por horário (energia). Em Grupo A,
   reduzir o pico de demanda em kW costuma valer mais que o deslocamento de
   energia — e não está aqui, porque exigiria perguntar a demanda contratada
   na tela 3.
3. **Bateria sozinha não se paga mesmo,** e o produto honesto é conduzir para
   solar + revisão de tarifa, com bateria entrando depois.

Enquanto isso não for decidido, o relatório mostra os números e o alerta de
"vale revisar a tarifa antes" — que é o comportamento correto para o que as
constantes dizem hoje.

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
