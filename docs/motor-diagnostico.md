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

## Passo 4 — economia mensal

```
economia = consumoKwh
         × fracaoDeslocavel
         × deltaTarifa
         × 0,88            // eficiência de ida e volta da bateria
         × ajusteSolar     // 1,25 se já tem solar, senão 1,00
         × ajusteBess      // 0,30 se já tem bateria (boa parte já foi capturada)

economia = min(economia, valorFaturaReais × 0,35)   // trava de sanidade
faixa    = economia × 0,75  ..  economia × 1,25
```

A trava de 35% existe para o relatório nunca prometer o improvável. Quem já
tem solar ganha mais com bateria (guarda o excedente em vez de injetar),
por isso o multiplicador para cima.

## Passo 5 — porte de BESS sugerido

```
consumoDiario     = consumoKwh / 30
energiaDeslocada  = consumoDiario × fracaoDeslocavel
capacidadeKwh     = arredondaParaFaixaComercial(energiaDeslocada / 0,90)  // 90% de uso útil
potenciaKw        = capacidadeKwh / 3                                     // descarga em ~3 h
```

Faixas comerciais: **15, 30, 50, 100, 200 kWh** — arredonda para a faixa
imediatamente acima.

## Passo 6 — investimento e retorno

```
investimento  = capacidadeKwh × 3.200   // R$/kWh instalado, a calibrar com o parceiro
paybackMeses  = investimento / economia
```

Se o payback passar de 120 meses, o relatório muda de tom: em vez de vender
bateria, sugere revisar a tarifa primeiro. Diagnóstico honesto vende melhor no
médio prazo — e evita lead queimado com o parceiro.

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
