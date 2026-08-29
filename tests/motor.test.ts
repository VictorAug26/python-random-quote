import { describe, expect, it } from 'vitest';
import { calcularDiagnostico } from '@/lib/motor/calcular';
import { PARAMETROS } from '@/lib/motor/parametros';
import type { EntradasMotor } from '@/lib/motor/tipos';
import { frasePrincipal, mensagemWhatsapp } from '@/lib/motor/mensagens';

/** Fazenda leiteira estruturada em tarifa branca: o cenário central do MVP. */
const LEITEIRA: EntradasMotor = {
  atividades: ['leite_gado'],
  equipamentos: ['tanque_resfriamento', 'ordenha_mecanizada'],
  possuiSolar: false,
  possuiBess: false,
  valorFaturaReais: 8400,
  consumoKwh: 8900,
  classeTarifaria: 'branca',
  demandaContratadaKw: null,
};

describe('cenário central: fazenda de leite, tarifa branca', () => {
  const d = calcularDiagnostico(LEITEIRA);

  it('usa o consumo informado, sem estimar pela fatura', () => {
    expect(d.detalhes.consumoFoiInformado).toBe(true);
    expect(d.detalhes.consumoKwhUsado).toBe(8900);
  });

  it('soma base + atividade + equipamentos na fração deslocável', () => {
    // 0,08 base + 0,02 leite + 0,18 tanque + 0,10 ordenha = 0,38
    expect(d.detalhes.fracaoDeslocavel).toBeCloseTo(0.38, 4);
  });

  it('chega a uma economia coerente com as tarifas da ANEEL', () => {
    // Carga flexível: 8900/30 × 0,38 = 112,7 kWh/dia.
    // Mas só 11% do consumo cai na ponta: 296,7 × 0,11 = 32,6 kWh/dia.
    // Vale o menor — não dá para economizar sobre energia que já era barata.
    // Bateria: 32,6/0,9 = 36,3 → faixa comercial de 30 kWh, que entrega 27.
    // Fatura ÷ kWh = R$ 0,9438; tarifa nua da ANEEL = R$ 0,9173 → 1,0289 de
    // tributos, medido na conta do próprio produtor.
    // Economia: 27 × 30 × (1,06751 × 1,0289) × 0,88 = 782,93.
    expect(d.economiaMensalReais).toBeCloseTo(782.93, 1);
    expect(d.detalhes.limitadoPeloTeto).toBe(false);
  });

  it('a economia nunca passa do que a bateria recomendada entrega', () => {
    const entregaMensalMaxima =
      d.bessCapacidadeKwh *
      PARAMETROS.bess.profundidadeDescarga *
      30 *
      d.detalhes.deltaTarifaReaisPorKwh *
      PARAMETROS.eficienciaBateria;

    expect(d.economiaMensalReais).toBeLessThanOrEqual(entregaMensalMaxima + 0.01);
  });

  it('devolve uma faixa de ±25% em torno da estimativa', () => {
    expect(d.economiaMinReais).toBeCloseTo(d.economiaMensalReais * 0.75, 1);
    expect(d.economiaMaxReais).toBeCloseTo(d.economiaMensalReais * 1.25, 1);
    expect(d.economiaMinReais).toBeLessThan(d.economiaMaxReais);
  });

  it('indica um porte comercial de bateria, não um número quebrado', () => {
    expect(PARAMETROS.bess.faixasComerciaisKwh).toContain(d.bessCapacidadeKwh);
    expect(d.bessPotenciaKw).toBeCloseTo(d.bessCapacidadeKwh / 3, 1);
  });

  it('tem confiança alta: kWh e tarifa vieram do produtor', () => {
    expect(d.confianca).toBe('alta');
  });
});

describe('trava de sanidade', () => {
  it('nunca promete mais que 35% da fatura', () => {
    // Consumo altíssimo para uma fatura pequena: a conta estoura o teto.
    const d = calcularDiagnostico({
      ...LEITEIRA,
      equipamentos: ['tanque_resfriamento', 'ordenha_mecanizada', 'caldeira', 'pivo_central'],
      valorFaturaReais: 1000,
      consumoKwh: 20000,
      classeTarifaria: 'grupo_a',
    });

    expect(d.detalhes.limitadoPeloTeto).toBe(true);
    expect(d.economiaMensalReais).toBeCloseTo(350, 2);
    expect(d.economiaPercentual).toBeCloseTo(35, 1);
  });

  it('respeita o teto da fração deslocável', () => {
    const d = calcularDiagnostico({
      ...LEITEIRA,
      atividades: ['leite_gado', 'graos_cafe_irrigado', 'outro'],
      equipamentos: ['tanque_resfriamento', 'ordenha_mecanizada', 'caldeira', 'pivo_central'],
    });
    // A soma crua passaria de 0,60; o teto segura em 0,45.
    expect(d.detalhes.fracaoDeslocavel).toBe(PARAMETROS.fracaoDeslocavel.teto);
  });

  it('a economia percentual nunca passa de 100 — o banco não aceitaria', () => {
    const d = calcularDiagnostico({ ...LEITEIRA, valorFaturaReais: 50, consumoKwh: 90000 });
    expect(d.economiaPercentual).toBeLessThanOrEqual(100);
    expect(d.economiaPercentual).toBeGreaterThanOrEqual(0);
  });
});

describe('quando falta informação', () => {
  it('estima o consumo pela fatura quando o kWh não vem', () => {
    const d = calcularDiagnostico({ ...LEITEIRA, consumoKwh: null });
    expect(d.detalhes.consumoFoiInformado).toBe(false);
    // Sem o kWh não dá para medir os tributos do produtor: entra o fator médio
    // de Minas (1/0,77). Tarifa branca média da ANEEL R$ 0,9173 × 1,2987 =
    // R$ 1,1913/kWh → 8400 / 1,1913 ≈ 7051 kWh.
    expect(d.detalhes.consumoKwhUsado).toBeCloseTo(7051, 0);
    expect(d.detalhes.fatorTributosObservado).toBe(false);
    expect(d.confianca).toBe('media');
  });

  it('cai para confiança baixa sem kWh e sem tarifa', () => {
    const d = calcularDiagnostico({ ...LEITEIRA, consumoKwh: null, classeTarifaria: 'nao_sei' });
    expect(d.confianca).toBe('baixa');
  });

  it('confiança média quando falta só a tarifa', () => {
    const d = calcularDiagnostico({ ...LEITEIRA, classeTarifaria: 'nao_sei' });
    expect(d.confianca).toBe('media');
  });

  it('trata kWh zerado como não informado', () => {
    const d = calcularDiagnostico({ ...LEITEIRA, consumoKwh: 0 });
    expect(d.detalhes.consumoFoiInformado).toBe(false);
  });
});

describe('o que o produtor já tem instalado', () => {
  it('solar aumenta o ganho da bateria', () => {
    const sem = calcularDiagnostico(LEITEIRA);
    const com = calcularDiagnostico({ ...LEITEIRA, possuiSolar: true });
    expect(com.economiaMensalReais).toBeGreaterThan(sem.economiaMensalReais);
    expect(com.economiaMensalReais / sem.economiaMensalReais).toBeCloseTo(1.25, 2);
  });

  it('quem já tem bateria tem bem menos a ganhar', () => {
    const sem = calcularDiagnostico(LEITEIRA);
    const com = calcularDiagnostico({ ...LEITEIRA, possuiBess: true });
    expect(com.economiaMensalReais).toBeLessThan(sem.economiaMensalReais);
    expect(com.economiaMensalReais / sem.economiaMensalReais).toBeCloseTo(0.3, 2);
  });
});

describe('honestidade do resultado', () => {
  /**
   * O retorno, quando a bateria comporta tudo que dá para deslocar, depende
   * só de duas constantes:
   *
   *   payback (meses) = investimentoPorKwh / (deltaTarifa × eficiência × 30)
   *
   * Não depende do tamanho da fazenda. Este teste deixa a conta visível e
   * avisa quando a tarifa da ANEEL ou o preço do parceiro mudarem o quadro.
   */
  it('deixa explícito o retorno que as constantes de hoje produzem', () => {
    const d = calcularDiagnostico(LEITEIRA);
    const esperado =
      PARAMETROS.investimentoReaisPorKwh /
      (d.detalhes.deltaTarifaReaisPorKwh * PARAMETROS.eficienciaBateria * 30);

    // Com a REH vigente, a branca dá menos de 10 anos — bem longe dos 22 anos
    // que as estimativas iniciais produziam.
    expect(esperado).toBeLessThan(120);
    // O retorno real é pior que a fórmula: a bateria comercial escolhida é
    // maior que a energia que a fazenda consegue deslocar todo dia.
    expect(d.paybackMeses as number).toBeGreaterThanOrEqual(Math.round(esperado));
  });

  it('em tarifa convencional não há o que a bateria capture', () => {
    const d = calcularDiagnostico({ ...LEITEIRA, classeTarifaria: 'convencional' });

    // A convencional cobra o mesmo preço a qualquer hora: deslocar consumo
    // não economiza nada. Prometer economia aqui seria mentira.
    expect(d.detalhes.deltaTarifaReaisPorKwh).toBe(0);
    expect(d.economiaMensalReais).toBe(0);
    expect(d.paybackMeses).toBeNull();
    expect(d.recomendaRevisarTarifa).toBe(true);
  });

  it('e mostra quanto a migração para a branca destravaria', () => {
    const d = calcularDiagnostico({ ...LEITEIRA, classeTarifaria: 'convencional' });
    const branca = calcularDiagnostico({ ...LEITEIRA, classeTarifaria: 'branca' });

    expect(d.economiaSeMigrarParaBrancaReais).toBe(branca.economiaMensalReais);
    expect(d.economiaSeMigrarParaBrancaReais as number).toBeGreaterThan(0);
  });

  it('fora da convencional não sugere migração que não faz sentido', () => {
    expect(calcularDiagnostico(LEITEIRA).economiaSeMigrarParaBrancaReais).toBeNull();
  });

  it('sugere rever a tarifa quando o retorno passa de 10 anos', () => {
    const d = calcularDiagnostico({
      ...LEITEIRA,
      equipamentos: [],
      atividades: ['outro'],
      valorFaturaReais: 400,
      consumoKwh: 430,
    });
    expect(d.paybackMeses).not.toBeNull();
    expect(d.paybackMeses as number).toBeGreaterThan(PARAMETROS.paybackMesesParaAlertar);
    expect(d.recomendaRevisarTarifa).toBe(true);
  });

  it('grupo A rende mais que tarifa branca, com o mesmo consumo', () => {
    const branca = calcularDiagnostico(LEITEIRA);
    const grupoA = calcularDiagnostico({ ...LEITEIRA, classeTarifaria: 'grupo_a' });
    expect(grupoA.economiaMensalReais).toBeGreaterThan(branca.economiaMensalReais);
  });
});

describe('resultados que o banco precisa aceitar', () => {
  const cenarios: EntradasMotor[] = [
    LEITEIRA,
    { ...LEITEIRA, consumoKwh: null, classeTarifaria: 'nao_sei' },
    { ...LEITEIRA, atividades: ['outro'], equipamentos: [], valorFaturaReais: 120, consumoKwh: null },
    { ...LEITEIRA, valorFaturaReais: 999999, consumoKwh: 4999999, classeTarifaria: 'grupo_a' },
    { ...LEITEIRA, possuiSolar: true, possuiBess: true, classeTarifaria: 'convencional' },
    { ...LEITEIRA, equipamentos: ['pivo_central'], atividades: ['graos_cafe_irrigado'] },
  ];

  it('todo cenário cabe nos CHECK da migration 0001', () => {
    for (const entradas of cenarios) {
      const d = calcularDiagnostico(entradas);

      expect(d.economiaMensalReais).toBeGreaterThanOrEqual(0);
      expect(d.economiaMinReais).toBeLessThanOrEqual(d.economiaMaxReais);
      expect(d.economiaPercentual).toBeGreaterThanOrEqual(0);
      expect(d.economiaPercentual).toBeLessThanOrEqual(100);
      expect(d.bessCapacidadeKwh).toBeGreaterThan(0);
      expect(d.bessPotenciaKw).toBeGreaterThan(0);
      expect(d.investimentoEstimadoReais).toBeGreaterThanOrEqual(0);
      if (d.paybackMeses !== null) expect(d.paybackMeses).toBeGreaterThan(0);
      expect(['baixa', 'media', 'alta']).toContain(d.confianca);
      expect(Number.isFinite(d.economiaMensalReais)).toBe(true);
    }
  });

  it('é determinístico: mesmas entradas, mesmo resultado', () => {
    expect(calcularDiagnostico(LEITEIRA)).toEqual(calcularDiagnostico(LEITEIRA));
  });
});

describe('texto do relatório', () => {
  it('fala em reais por mês, sem jargão', () => {
    const frase = frasePrincipal(calcularDiagnostico(LEITEIRA));
    expect(frase).toMatch(/R\$/);
    expect(frase).toMatch(/por mês/);
    expect(frase).not.toMatch(/dispatch|peak shaving|arbitragem|EMS|BESS/i);
  });

  it('a mensagem de WhatsApp leva os números e o link, e nenhum dado pessoal', () => {
    const d = calcularDiagnostico(LEITEIRA);
    const msg = mensagemWhatsapp(d, 'https://exemplo.com/relatorio/abc');

    expect(msg).toContain('https://exemplo.com/relatorio/abc');
    expect(msg).toMatch(/R\$/);
    expect(msg).toContain(`${d.bessCapacidadeKwh} kWh`);
    expect(msg).not.toMatch(/jo[aã]o|silva|fazenda boa vista|\(\d{2}\)/i);
  });
});

describe('demanda contratada (Grupo A)', () => {
  const GRUPO_A: EntradasMotor = { ...LEITEIRA, classeTarifaria: 'grupo_a' };

  it('ignora a demanda fora do Grupo A — lá ela nem é cobrada', () => {
    const branca = calcularDiagnostico({ ...LEITEIRA, demandaContratadaKw: 150 });
    expect(branca.economiaDemandaReais).toBe(0);
    expect(branca.detalhes.reducaoDemandaKw).toBe(0);
  });

  it('ignora quando o produtor não soube informar', () => {
    const d = calcularDiagnostico({ ...GRUPO_A, demandaContratadaKw: null });
    expect(d.economiaDemandaReais).toBe(0);
  });

  it('corta o pico até o limite da potência da bateria', () => {
    // Demanda alta: 30% de 500 kW = 150 kW, bem acima da potência da bateria.
    const d = calcularDiagnostico({ ...GRUPO_A, demandaContratadaKw: 500 });
    expect(d.detalhes.reducaoDemandaKw).toBe(d.bessPotenciaKw);
  });

  it('e até o limite do que é redutível, quando a demanda é pequena', () => {
    // 30% de 50 kW = 15 kW, abaixo da potência da bateria: o gargalo vira o pico.
    const d = calcularDiagnostico({ ...GRUPO_A, demandaContratadaKw: 50 });
    expect(d.detalhes.reducaoDemandaKw).toBeCloseTo(15, 2);
    expect(d.detalhes.reducaoDemandaKw).toBeLessThan(d.bessPotenciaKw);
  });

  it('informar a demanda melhora bastante o retorno', () => {
    const sem = calcularDiagnostico(GRUPO_A);
    const com = calcularDiagnostico({ ...GRUPO_A, demandaContratadaKw: 150 });

    expect(com.economiaMensalReais).toBeGreaterThan(sem.economiaMensalReais);
    expect(com.paybackMeses as number).toBeLessThan(sem.paybackMeses as number);
  });

  it('as duas parcelas sempre somam o total exibido', () => {
    for (const demanda of [null, 50, 150, 500]) {
      const d = calcularDiagnostico({ ...GRUPO_A, demandaContratadaKw: demanda });
      expect(d.economiaEnergiaReais + d.economiaDemandaReais).toBeCloseTo(
        d.economiaMensalReais,
        1,
      );
    }
  });

  it('a soma continua batendo mesmo quando o teto de 35% corta', () => {
    const d = calcularDiagnostico({
      ...GRUPO_A,
      valorFaturaReais: 1000,
      demandaContratadaKw: 2000,
    });
    expect(d.detalhes.limitadoPeloTeto).toBe(true);
    expect(d.economiaEnergiaReais + d.economiaDemandaReais).toBeCloseTo(d.economiaMensalReais, 1);
  });
});
