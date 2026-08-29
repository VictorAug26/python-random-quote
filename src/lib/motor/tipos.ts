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
>;
