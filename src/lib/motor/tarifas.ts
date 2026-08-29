import type { ClasseTarifaria } from '@/lib/dominio';
import dados from '@/lib/motor/tarifas-cemig.json';

/**
 * Tarifas reais da CEMIG-D, vindas do portal de dados abertos da ANEEL.
 *
 * O arquivo tarifas-cemig.json é gerado por `npm run tarifas` e commitado.
 * Nada aqui chama rede: um diagnóstico precisa ser reproduzível e precisa
 * apontar para uma resolução homologatória específica. Ver o cabeçalho de
 * scripts/atualizar-tarifas.mjs para o porquê da escolha.
 *
 * ⚠️ Os valores da ANEEL são SEM tributos e SEM bandeira. A conta que o
 * produtor paga é maior. O ajuste está em FATOR_TRIBUTOS, abaixo.
 */

export const TARIFAS_ANEEL = dados;

/**
 * Tributos embutidos na conta, "por dentro": PIS/COFINS (~5%) e ICMS.
 *
 * Minas Gerais cobra 18% de ICMS sobre energia desde a LC 194/2022. O produtor
 * rural tem isenções e reduções em alguns casos (irrigação noturna, baixa
 * tensão rural até certo consumo), então este fator é um limite superior —
 * quem tem desconto paga menos.
 *
 * ⚠️ Estimativa, não medição. Quando o produtor informa fatura E kWh, o motor
 * ignora este número e usa o fator real dele — ver fatorTributosObservado().
 */
const FATOR_TRIBUTOS = 1 / (1 - 0.23);

/**
 * Como o consumo se reparte entre os postos tarifários.
 *
 * Ponta são 3 horas por dia útil; intermediário, 1 hora de cada lado. Em horas
 * puras isso daria ~9% e ~6% do mês. Numa fazenda de leite a ordenha da tarde
 * costuma cair dentro da ponta, então o peso real tende a ser maior — é um dos
 * números que precisa de fatura real para calibrar.
 */
const PERFIL_CONSUMO = {
  branca: { ponta: 0.11, intermediario: 0.07, fora_ponta: 0.82 },
  grupo_a: { ponta: 0.13, fora_ponta: 0.87 },
} as const;

/**
 * Acima disto a distribuidora exige tarifa Azul; abaixo, o produtor escolhe e
 * na prática fica na Verde. Como a tela 3 já pergunta a demanda contratada,
 * dá para inferir a modalidade sem fazer mais uma pergunta com jargão.
 */
const LIMITE_AZUL_KW = 300;

export type PerfilTarifario = {
  /** Nome da modalidade, para explicar de onde veio o número. */
  modalidade: string;
  /** R$/kWh médio com tributos — estima o consumo a partir da fatura. */
  tarifaMediaReaisPorKwh: number;
  /** R$/kWh ganho ao tirar 1 kWh da ponta e jogar fora da ponta, com tributos. */
  deltaTarifaReaisPorKwh: number;
  /** R$/kW por mês economizado ao reduzir 1 kW de demanda, com tributos. */
  demandaReaisPorKwMes: number;
  /**
   * Quanto do consumo cai na ponta.
   *
   * É o TETO FÍSICO da arbitragem: a bateria só economiza sobre kWh que
   * estavam sendo comprados caro. Deslocar carga que já rodava fora da ponta
   * não economiza nada — e sem este limite o motor prometia economia sobre
   * energia que nunca passou pelo horário caro.
   */
  fracaoConsumoNaPonta: number;
};

/**
 * Traduz a classe tarifária respondida na tela 3 para os números que o motor
 * usa. Toda decisão sobre qual linha da ANEEL se aplica mora aqui.
 */
export function perfilTarifario(
  classe: ClasseTarifaria,
  demandaContratadaKw: number | null,
  fatorTributos: number = FATOR_TRIBUTOS,
): PerfilTarifario {
  const t = TARIFAS_ANEEL.tarifas;
  const com = (valor: number) => valor * fatorTributos;

  switch (classe) {
    case 'convencional': {
      // A convencional cobra o mesmo preço a qualquer hora. Não existe
      // arbitragem de horário para a bateria capturar — o delta é zero, e é
      // por isso que o relatório manda revisar a tarifa antes de comprar.
      return {
        modalidade: 'B2 Rural Convencional',
        tarifaMediaReaisPorKwh: com(t.b2_rural_convencional.unico),
        deltaTarifaReaisPorKwh: 0,
        demandaReaisPorKwMes: 0,
        // Não existe posto de ponta na convencional.
        fracaoConsumoNaPonta: 0,
      };
    }

    case 'branca': {
      const b = t.b2_rural_branca;
      const perfil = PERFIL_CONSUMO.branca;
      return {
        modalidade: 'B2 Rural Branca',
        tarifaMediaReaisPorKwh: com(
          b.ponta * perfil.ponta +
            b.intermediario * perfil.intermediario +
            b.fora_ponta * perfil.fora_ponta,
        ),
        deltaTarifaReaisPorKwh: com(b.ponta - b.fora_ponta),
        demandaReaisPorKwMes: 0,
        fracaoConsumoNaPonta: perfil.ponta,
      };
    }

    case 'grupo_a': {
      const azul = demandaContratadaKw !== null && demandaContratadaKw >= LIMITE_AZUL_KW;
      const perfil = PERFIL_CONSUMO.grupo_a;

      if (azul) {
        const a = t.a4_azul;
        return {
          modalidade: 'A4 Azul',
          tarifaMediaReaisPorKwh: com(a.ponta * perfil.ponta + a.fora_ponta * perfil.fora_ponta),
          deltaTarifaReaisPorKwh: com(a.ponta - a.fora_ponta),
          // Na Azul a demanda tem dois preços. Cortar o pico da ponta é o que
          // vale dinheiro; a demanda fora da ponta continua contratada.
          demandaReaisPorKwMes: com(a.demanda_ponta - a.demanda_fora_ponta),
          fracaoConsumoNaPonta: perfil.ponta,
        };
      }

      const v = t.a4_verde;
      return {
        modalidade: 'A4 Verde',
        tarifaMediaReaisPorKwh: com(v.ponta * perfil.ponta + v.fora_ponta * perfil.fora_ponta),
        deltaTarifaReaisPorKwh: com(v.ponta - v.fora_ponta),
        // Na Verde a demanda é única: cada kW cortado vale a tarifa inteira.
        demandaReaisPorKwMes: com(v.demanda),
        fracaoConsumoNaPonta: perfil.ponta,
      };
    }

    case 'nao_sei': {
      // Sem saber a tarifa, o cenário real vai de "não economiza nada"
      // (convencional) a "economiza muito" (verde). Fica na branca cortada
      // pela metade: um meio-termo que não promete demais.
      const b = t.b2_rural_branca;
      const perfil = PERFIL_CONSUMO.branca;
      return {
        modalidade: 'não informada',
        tarifaMediaReaisPorKwh: com(
          b.ponta * perfil.ponta +
            b.intermediario * perfil.intermediario +
            b.fora_ponta * perfil.fora_ponta,
        ),
        deltaTarifaReaisPorKwh: com(b.ponta - b.fora_ponta) * 0.5,
        demandaReaisPorKwMes: 0,
        fracaoConsumoNaPonta: perfil.ponta,
      };
    }
  }
}

/**
 * Quando o produtor informa fatura E consumo, o fator de tributos dele não
 * precisa ser estimado: sai da divisão.
 *
 *     fatura / kWh = tarifa que ele paga de fato
 *     essa tarifa / tarifa da ANEEL = tributos + bandeira + taxas
 *
 * É o único ponto do motor que se auto-calibra com dado do próprio produtor.
 * Fica preso a uma faixa: fora dela, o mais provável é que a pessoa tenha
 * digitado kWh no lugar de reais, ou uma fatura com mês de vencimento errado.
 */
export function fatorTributosObservado(
  valorFaturaReais: number,
  consumoKwh: number | null,
  classe: ClasseTarifaria,
  demandaContratadaKw: number | null,
): { fator: number; observado: boolean } {
  const media = { fator: FATOR_TRIBUTOS, observado: false };
  if (consumoKwh === null || consumoKwh <= 0) return media;

  const semTributos = perfilTarifario(classe, demandaContratadaKw, 1).tarifaMediaReaisPorKwh;
  if (semTributos <= 0) return media;

  const observado = valorFaturaReais / consumoKwh / semTributos;

  // Abaixo de 1 a conta sairia mais barata que a tarifa sem imposto — possível
  // com desconto rural forte, mas mais provável que seja erro de digitação.
  // Acima de 1,8 seria mais de 44% de tributo, que não existe hoje.
  if (observado < 1 || observado > 1.8) return media;
  return { fator: observado, observado: true };
}

/** Para o rodapé do relatório: de onde vieram os números. */
export function fonteTarifaria(): {
  reh: string;
  /** "Resolução Homologatória nº 3.589" — o jeito que dá para ler em voz alta. */
  rehCurta: string;
  vigenciaFim: string;
  portal: string;
} {
  // A ANEEL publica em caixa alta: "RESOLUÇÃO HOMOLOGATÓRIA Nº 3.589, DE 26
  // DE MAIO DE 2026". No relatório interessa só o número.
  const numero = TARIFAS_ANEEL.reh.match(/Nº\s*([\d.]+)/i)?.[1];

  return {
    reh: TARIFAS_ANEEL.reh,
    rehCurta: numero ? `Resolução Homologatória nº ${numero}` : TARIFAS_ANEEL.reh,
    vigenciaFim: TARIFAS_ANEEL.vigencia.fim,
    portal: TARIFAS_ANEEL.fonte.portal,
  };
}
