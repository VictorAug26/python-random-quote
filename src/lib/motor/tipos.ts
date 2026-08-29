import type { Atividade, ClasseTarifaria, Equipamento } from '@/lib/dominio';

export type EntradasMotor = {
  atividades: Atividade[];
  equipamentos: Equipamento[];
  possuiSolar: boolean;
  possuiBess: boolean;
  valorFaturaReais: number;
  consumoKwh: number | null;
  classeTarifaria: ClasseTarifaria;
  /** Só existe no Grupo A, e mesmo lá é opcional. */
  demandaContratadaKw: number | null;
};

export type Confianca = 'baixa' | 'media' | 'alta';

export type Diagnostico = {
  motorVersao: string;

  economiaMensalReais: number;
  /** Parte da economia que vem de deslocar energia de horário. */
  economiaEnergiaReais: number;
  /** Parte que vem de cortar o pico de demanda (só Grupo A). */
  economiaDemandaReais: number;
  economiaMinReais: number;
  economiaMaxReais: number;
  economiaPercentual: number;

  bessCapacidadeKwh: number;
  bessPotenciaKw: number;
  investimentoEstimadoReais: number;
  /** null quando a economia é baixa demais para o retorno fazer sentido. */
  paybackMeses: number | null;

  confianca: Confianca;
  /** Quando comprar bateria não é o primeiro passo mais sensato. */
  recomendaRevisarTarifa: boolean;

  /**
   * Só na convencional: quanto a bateria economizaria se o produtor migrasse
   * para a tarifa branca. Na convencional o preço é o mesmo a qualquer hora,
   * então a bateria não tem o que capturar — sem este número o relatório
   * diria "R$ 0" e pararia aí, que é a resposta certa e o conselho errado.
   *
   * Chega ao relatório pela migration 0009; enquanto ela não for aplicada o
   * app lê `null` e só omite a frase.
   */
  economiaSeMigrarParaBrancaReais: number | null;

  /** Passos intermediários, guardados para poder explicar o resultado depois. */
  detalhes: {
    consumoKwhUsado: number;
    consumoFoiInformado: boolean;
    fracaoDeslocavel: number;
    deltaTarifaReaisPorKwh: number;
    economiaAntesDoTeto: number;
    limitadoPeloTeto: boolean;
    /** Quantos kW de pico a bateria consegue cortar. */
    reducaoDemandaKw: number;

    /** Modalidade tarifária usada no cálculo — "A4 Verde", "B2 Rural Branca"… */
    modalidadeTarifaria: string;
    /** Resolução homologatória de onde saíram as tarifas. */
    tarifaReh: string;
    /** Tributos e encargos sobre a tarifa nua da ANEEL. */
    fatorTributos: number;
    /** true quando o fator veio da fatura do próprio produtor, não da média. */
    fatorTributosObservado: boolean;
  };
};

/**
 * O subconjunto que o relatório mostra — exatamente o que a view
 * diagnosticos_publicos expõe. Nenhum dado pessoal, nenhuma entrada.
 */
export type DiagnosticoExibivel = Pick<
  Diagnostico,
  | 'economiaMensalReais'
  | 'economiaEnergiaReais'
  | 'economiaDemandaReais'
  | 'economiaMinReais'
  | 'economiaMaxReais'
  | 'economiaPercentual'
  | 'bessCapacidadeKwh'
  | 'bessPotenciaKw'
  | 'investimentoEstimadoReais'
  | 'paybackMeses'
  | 'confianca'
  | 'recomendaRevisarTarifa'
  | 'economiaSeMigrarParaBrancaReais'
>;
