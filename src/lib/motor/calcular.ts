import { PARAMETROS, VERSAO_MOTOR } from '@/lib/motor/parametros';
import { TARIFAS_ANEEL, fatorTributosObservado, perfilTarifario } from '@/lib/motor/tarifas';
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

  // --- 0. Preço da energia, da ANEEL -----------------------------------------
  // As tarifas vêm da resolução homologatória vigente da CEMIG-D, não de
  // estimativa. A modalidade do Grupo A (Verde ou Azul) sai da demanda
  // contratada, para não obrigar o produtor a responder mais uma pergunta
  // com jargão que ele não usa.
  //
  // Quem informa fatura e kWh calibra os próprios tributos; quem não informa
  // cai no fator médio de Minas.
  const tributos = fatorTributosObservado(
    entradas.valorFaturaReais,
    entradas.consumoKwh,
    entradas.classeTarifaria,
    entradas.demandaContratadaKw ?? null,
  );
  const tarifa = perfilTarifario(
    entradas.classeTarifaria,
    entradas.demandaContratadaKw ?? null,
    tributos.fator,
  );

  // --- 1. Consumo mensal em kWh ---------------------------------------------
  const consumoFoiInformado = entradas.consumoKwh !== null && entradas.consumoKwh > 0;
  const consumoKwhUsado = consumoFoiInformado
    ? (entradas.consumoKwh as number)
    : entradas.valorFaturaReais / tarifa.tarifaMediaReaisPorKwh;

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
  const deltaTarifa = tarifa.deltaTarifaReaisPorKwh;

  // --- 4. Porte de bateria ---------------------------------------------------
  // O dimensionamento vem ANTES da economia de propósito: quem economiza é a
  // bateria que vai ser instalada, não a energia que teoricamente daria para
  // deslocar. Se o porte comercial escolhido não comporta tudo, a economia
  // cai junto — senão o relatório prometeria um ganho que o equipamento
  // recomendado não entrega.
  const consumoDiarioKwh = consumoKwhUsado / 30;

  // Dois limites independentes, e vale o menor:
  //
  //   a) que parte da carga tem folga de horário (fração deslocável);
  //   b) quanta energia a fazenda de fato compra CARO, na ponta.
  //
  // (b) é o teto físico. A bateria economiza a diferença de tarifa sobre kWh
  // que estavam sendo comprados na ponta — tirar do horário barato e devolver
  // no horário barato não economiza nada. Numa fazenda com muita carga
  // flexível mas pouco consumo na ponta, é (b) que manda.
  const energiaNaPontaPorDia = consumoDiarioKwh * tarifa.fracaoConsumoNaPonta;
  const energiaDeslocavelPorDia = Math.min(
    consumoDiarioKwh * fracaoDeslocavel,
    energiaNaPontaPorDia,
  );

  const bessCapacidadeKwh = arredondarParaFaixaComercial(
    energiaDeslocavelPorDia / p.bess.profundidadeDescarga,
  );
  const bessPotenciaKw = arredondar(bessCapacidadeKwh / p.bess.horasDescarga, 1);

  const energiaUtilPorDia = bessCapacidadeKwh * p.bess.profundidadeDescarga;
  const energiaDeslocadaPorDia = Math.min(energiaDeslocavelPorDia, energiaUtilPorDia);

  // --- 5. Economia mensal ----------------------------------------------------
  const ajusteSolar = entradas.possuiSolar ? p.ajusteSolar : 1;
  const ajusteBess = entradas.possuiBess ? p.ajusteBessExistente : 1;

  const economiaEnergia =
    energiaDeslocadaPorDia * 30 * deltaTarifa * p.eficienciaBateria * ajusteSolar * ajusteBess;

  // --- 5b. Economia de demanda contratada (só Grupo A) -----------------------
  // A conta do Grupo A cobra pelo maior pico de kW do mês. A bateria corta
  // esse pico até o limite da própria potência — e só até a parte do pico que
  // é de fato redutível, porque parte da carga é simultânea e inevitável.
  const reducaoDemandaKw =
    entradas.classeTarifaria === 'grupo_a' && entradas.demandaContratadaKw
      ? Math.min(
          bessPotenciaKw,
          entradas.demandaContratadaKw * p.demanda.fracaoMaximaRedutivel,
        )
      : 0;

  const economiaDemanda = reducaoDemandaKw * tarifa.demandaReaisPorKwMes * ajusteBess;

  const economiaAntesDoTeto = economiaEnergia + economiaDemanda;

  const teto = entradas.valorFaturaReais * p.tetoEconomiaSobreFatura;
  const limitadoPeloTeto = economiaAntesDoTeto > teto;
  const economiaMensalReais = arredondar(Math.min(economiaAntesDoTeto, teto), 2);

  // Quando o teto corta, as duas partes encolhem na mesma proporção — senão a
  // soma exibida no relatório não bateria com o total.
  const proporcao = economiaAntesDoTeto > 0 ? economiaMensalReais / economiaAntesDoTeto : 0;
  const economiaEnergiaReais = arredondar(economiaEnergia * proporcao, 2);
  const economiaDemandaReais = arredondar(economiaDemanda * proporcao, 2);

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

  // Na convencional o resultado é sempre R$ 0 — o preço não muda com a hora,
  // então não existe arbitragem. Dizer só isso deixaria o produtor sem saída.
  // Rodamos o mesmo cenário na tarifa branca para mostrar o que a migração
  // destravaria. Só um nível de recursão: a chamada abaixo já é 'branca'.
  const economiaSeMigrarParaBrancaReais =
    entradas.classeTarifaria === 'convencional'
      ? calcularDiagnostico({ ...entradas, classeTarifaria: 'branca' }).economiaMensalReais
      : null;

  return {
    motorVersao: VERSAO_MOTOR,
    economiaMensalReais,
    economiaEnergiaReais,
    economiaDemandaReais,
    economiaMinReais,
    economiaMaxReais,
    economiaPercentual,
    bessCapacidadeKwh,
    bessPotenciaKw,
    investimentoEstimadoReais,
    paybackMeses,
    confianca,
    recomendaRevisarTarifa,
    economiaSeMigrarParaBrancaReais,
    detalhes: {
      consumoKwhUsado: arredondar(consumoKwhUsado, 2),
      consumoFoiInformado,
      fracaoDeslocavel: arredondar(fracaoDeslocavel, 4),
      deltaTarifaReaisPorKwh: arredondar(deltaTarifa, 5),
      economiaAntesDoTeto: arredondar(economiaAntesDoTeto, 2),
      limitadoPeloTeto,
      reducaoDemandaKw: arredondar(reducaoDemandaKw, 2),
      modalidadeTarifaria: tarifa.modalidade,
      tarifaReh: TARIFAS_ANEEL.reh,
      fatorTributos: arredondar(tributos.fator, 4),
      fatorTributosObservado: tributos.observado,
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
