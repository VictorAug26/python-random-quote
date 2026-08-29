import type { Atividade, Equipamento } from '@/lib/dominio';

/**
 * As constantes calibráveis do motor que NÃO vêm da ANEEL moram aqui.
 *
 * Preço de energia (tarifa, delta ponta/fora ponta, demanda) saiu deste
 * arquivo: agora vem de src/lib/motor/tarifas-cemig.json, gerado a partir do
 * portal de dados abertos da ANEEL. Ver src/lib/motor/tarifas.ts.
 *
 * ⚠️ O que sobrou aqui continua sendo estimativa, não medição — principalmente
 * a fração deslocável (que precisa de curva de carga real) e o investimento
 * por kWh (que precisa da tabela do parceiro integrador). Nenhuma lógica de
 * cálculo depende dos valores: trocar aqui é suficiente.
 *
 * Ao mexer em qualquer número, suba a VERSAO_MOTOR. Ela vai gravada em cada
 * diagnóstico, para que um resultado de seis meses atrás continue explicável —
 * inclusive qual resolução homologatória valia na época.
 */

export const VERSAO_MOTOR = 'v2.0.0';

export const PARAMETROS = {
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

  /**
   * Redução de demanda contratada — só existe no Grupo A.
   *
   * É a segunda fonte de economia, e costuma valer mais que deslocar energia:
   * a conta do Grupo A cobra pelo maior pico de kW do mês, e a bateria corta
   * esse pico. Só entra na conta quando o produtor informa a demanda
   * contratada na tela 3.
   *
   * O preço do kW saiu daqui — vem da ANEEL, e muda conforme a modalidade
   * (na Verde a demanda é única; na Azul o que vale é a diferença entre o kW
   * da ponta e o de fora da ponta).
   */
  demanda: {
    /**
     * Quanto do pico dá para cortar na prática. Não é 100%: parte da carga
     * é simultânea e inevitável, e a bateria não pode descarregar o mês todo.
     */
    fracaoMaximaRedutivel: 0.3,
  },

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
