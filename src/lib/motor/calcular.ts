import { PARAMETROS, VERSAO_MOTOR } from '@/lib/motor/parametros';
import type { Confianca, Diagnostico, EntradasMotor } from '@/lib/motor/tipos';

/**
 * Motor de diagnóstico — função pura, sem I/O.
 *
 * Recebe as respostas das três telas e devolve a estimativa. Não lê banco,
 * não chama rede, não olha relógio: dadas as mesmas entradas, sempre o mesmo
 * resultado. É o que permite testar dezenas de cenários em milissegundos e
 * recalibrar mexendo só em parametros.ts.
 *
 * As regras estão descritas em docs/motor-diagnostico.md.
 */
export function calcularDiagnostico(entradas: EntradasMotor): Diagnostico {
  const p = PARAMETROS;

  // --- 1. Consumo mensal em kWh ---------------------------------------------
  const consumoFoiInformado = entradas.consumoKwh !== null && entradas.consumoKwh > 0;
  const consumoKwhUsado = consumoFoiInformado
    ? (entradas.consumoKwh as number)
    : entradas.valorFaturaReais / p.tarifaMediaReaisPorKwh[entradas.classeTarifaria];

  // --- 2. Fração do consumo que dá para deslocar ----------------------------
  const somaAtividades = entradas.atividades.reduce(
    (total, atividade) => total + p.fracaoDeslocavel.porAtividade[atividade],
    0,
  );
  const somaEquipamentos = entradas.equipamentos.reduce(
    (total, equipamento) => total + p.fracaoDeslocavel.porEquipamento[equipamento],
    0,
  );
  const fracaoDeslocavel = Math.min(
    p.fracaoDeslocavel.teto,
    p.fracaoDeslocavel.base + somaAtividades + somaEquipamentos,
  );

  // --- 3. Diferença de tarifa capturável ------------------------------------
  const deltaTarifa = p.deltaTarifaReaisPorKwh[entradas.classeTarifaria];

  // --- 4. Porte de bateria ---------------------------------------------------
  // O dimensionamento vem ANTES da economia de propósito: quem economiza é a
  // bateria que vai ser instalada, não a energia que teoricamente daria para
  // deslocar. Se o porte comercial escolhido não comporta tudo, a economia
  // cai junto — senão o relatório prometeria um ganho que o equipamento
  // recomendado não entrega.
  const consumoDiarioKwh = consumoKwhUsado / 30;
  const energiaDeslocavelPorDia = consumoDiarioKwh * fracaoDeslocavel;

  const bessCapacidadeKwh = arredondarParaFaixaComercial(
    energiaDeslocavelPorDia / p.bess.profundidadeDescarga,
  );
  const bessPotenciaKw = arredondar(bessCapacidadeKwh / p.bess.horasDescarga, 1);

  const energiaUtilPorDia = bessCapacidadeKwh * p.bess.profundidadeDescarga;
  const energiaDeslocadaPorDia = Math.min(energiaDeslocavelPorDia, energiaUtilPorDia);

  // --- 5. Economia mensal ----------------------------------------------------
  const ajusteSolar = entradas.possuiSolar ? p.ajusteSolar : 1;
  const ajusteBess = entradas.possuiBess ? p.ajusteBessExistente : 1;

  const economiaAntesDoTeto =
    energiaDeslocadaPorDia * 30 * deltaTarifa * p.eficienciaBateria * ajusteSolar * ajusteBess;

  const teto = entradas.valorFaturaReais * p.tetoEconomiaSobreFatura;
  const limitadoPeloTeto = economiaAntesDoTeto > teto;
  const economiaMensalReais = arredondar(Math.min(economiaAntesDoTeto, teto), 2);

  const economiaMinReais = arredondar(economiaMensalReais * (1 - p.margemFaixa), 2);
  const economiaMaxReais = arredondar(economiaMensalReais * (1 + p.margemFaixa), 2);
  const economiaPercentual = arredondar(
    Math.min(100, (economiaMensalReais / entradas.valorFaturaReais) * 100),
    2,
  );

  // --- 6. Investimento e retorno ---------------------------------------------
  const investimentoEstimadoReais = arredondar(
    bessCapacidadeKwh * p.investimentoReaisPorKwh,
    2,
  );
  const paybackMeses =
    economiaMensalReais > 0
      ? Math.round(investimentoEstimadoReais / economiaMensalReais)
      : null;

  // --- 7. Confiança e recomendação -------------------------------------------
  const confianca = calcularConfianca(consumoFoiInformado, entradas.classeTarifaria === 'nao_sei');

  // Em tarifa sem diferença por horário, ou com retorno muito longo, o
  // primeiro passo honesto é revisar a tarifa — não comprar bateria.
  const recomendaRevisarTarifa =
    entradas.classeTarifaria === 'convencional' ||
    paybackMeses === null ||
    paybackMeses > p.paybackMesesParaAlertar;

  return {
    motorVersao: VERSAO_MOTOR,
    economiaMensalReais,
    economiaMinReais,
    economiaMaxReais,
    economiaPercentual,
    bessCapacidadeKwh,
    bessPotenciaKw,
    investimentoEstimadoReais,
    paybackMeses,
    confianca,
    recomendaRevisarTarifa,
    detalhes: {
      consumoKwhUsado: arredondar(consumoKwhUsado, 2),
      consumoFoiInformado,
      fracaoDeslocavel: arredondar(fracaoDeslocavel, 4),
      deltaTarifaReaisPorKwh: deltaTarifa,
      economiaAntesDoTeto: arredondar(economiaAntesDoTeto, 2),
      limitadoPeloTeto,
    },
  };
}

function calcularConfianca(consumoInformado: boolean, tarifaDesconhecida: boolean): Confianca {
  if (consumoInformado && !tarifaDesconhecida) return 'alta';
  if (!consumoInformado && tarifaDesconhecida) return 'baixa';
  return 'media';
}

/**
 * Leva ao porte comercial MAIS PRÓXIMO — não ao próximo acima.
 *
 * Arredondar sempre para cima empurrava 125 kWh para 200 e quase dobrava o
 * investimento, piorando o retorno sem que o produtor ganhasse nada com isso.
 * Acima da maior faixa, arredonda de 50 em 50: ninguém compra "137 kWh".
 */
function arredondarParaFaixaComercial(kwh: number): number {
  const faixas = PARAMETROS.bess.faixasComerciaisKwh;
  const menor = faixas[0] as number;
  const maior = faixas[faixas.length - 1] as number;

  if (kwh <= menor) return menor;
  if (kwh > maior) return Math.round(kwh / 50) * 50;

  return faixas.reduce((melhor, faixa) =>
    Math.abs(faixa - kwh) < Math.abs(melhor - kwh) ? faixa : melhor,
  );
}

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}
