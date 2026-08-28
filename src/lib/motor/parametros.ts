import type { Atividade, ClasseTarifaria, Equipamento } from '@/lib/dominio';

/**
 * TODAS as constantes calibráveis do motor moram aqui.
 *
 * ⚠️ Os números abaixo são estimativas iniciais, não medições. Precisam ser
 * calibrados com 3–5 faturas reais da região e com a tabela de preço do
 * parceiro integrador antes de o resultado ser mostrado a produtor de
 * verdade. Nenhuma lógica de cálculo depende dos valores — trocar aqui é
 * suficiente.
 *
 * Ao mexer em qualquer número, suba a VERSAO_MOTOR. Ela vai gravada em cada
 * diagnóstico, para que um resultado de seis meses atrás continue explicável.
 */

export const VERSAO_MOTOR = 'v1.0.0';

export const PARAMETROS = {
  /**
   * Quanto custa o kWh, com tributos, para estimar o consumo a partir do
   * valor da fatura quando o produtor não sabe o kWh.
   */
  tarifaMediaReaisPorKwh: {
    convencional: 0.95,
    branca: 0.92,
    grupo_a: 0.7,
    nao_sei: 0.95,
  } satisfies Record<ClasseTarifaria, number>,

  /**
   * Fração do consumo que dá para tirar do horário caro e jogar no barato.
   * É o coração do cálculo: soma de uma base, um ajuste por atividade e o
   * peso de cada equipamento, tudo limitado por um teto.
   */
  fracaoDeslocavel: {
    // Iluminação e uso geral, que toda propriedade tem.
    base: 0.08,

    // A atividade indica carga que existe mesmo sem equipamento marcado:
    // quem tira leite ordenha de algum jeito.
    porAtividade: {
      leite_gado: 0.02,
      graos_cafe_irrigado: 0.03,
      outro: 0,
    } satisfies Record<Atividade, number>,

    // Cargas grandes, previsíveis e com alguma folga de horário — que é
    // exatamente o que bateria aproveita.
    porEquipamento: {
      tanque_resfriamento: 0.18,
      ordenha_mecanizada: 0.1,
      caldeira: 0.08,
      pivo_central: 0.22,
    } satisfies Record<Equipamento, number>,

    teto: 0.45,
  },

  /** Quanto se ganha por kWh deslocado, conforme a tarifa. */
  deltaTarifaReaisPorKwh: {
    branca: 0.45,
    grupo_a: 0.55,
    // Sem diferença de preço por horário quase não há o que capturar.
    convencional: 0.12,
    // Conservador de propósito: não sabemos em que tarifa a pessoa está.
    nao_sei: 0.25,
  } satisfies Record<ClasseTarifaria, number>,

  /** Perda de ida e volta da bateria (carrega e descarrega). */
  eficienciaBateria: 0.88,

  /** Quem já tem solar aproveita mais a bateria: guarda o excedente. */
  ajusteSolar: 1.25,

  /** Quem já tem bateria já capturou boa parte do ganho. */
  ajusteBessExistente: 0.3,

  /** Trava de sanidade: o relatório nunca promete mais que isto da fatura. */
  tetoEconomiaSobreFatura: 0.35,

  /** A faixa mostrada no relatório é a estimativa ± esta margem. */
  margemFaixa: 0.25,

  bess: {
    /** Parte da capacidade que se usa de fato, sem maltratar a bateria. */
    profundidadeDescarga: 0.9,
    /** Descarga em ~3 horas define a potência a partir da capacidade. */
    horasDescarga: 3,
    /** Portes que o mercado vende; arredondamos para o próximo acima. */
    faixasComerciaisKwh: [15, 30, 50, 100, 200],
  },

  /** R$ por kWh instalado, chave na mão. A calibrar com o parceiro. */
  investimentoReaisPorKwh: 3200,

  /** Acima disto, o relatório sugere revisar a tarifa antes de comprar. */
  paybackMesesParaAlertar: 120,
} as const;
