import { describe, expect, it } from 'vitest';
import { calcularDiagnostico } from '@/lib/motor/calcular';
import {
  TARIFAS_ANEEL,
  fatorTributosObservado,
  fonteTarifaria,
  perfilTarifario,
} from '@/lib/motor/tarifas';
import type { EntradasMotor } from '@/lib/motor/tipos';

/**
 * Estes testes são quase todos RELACIONAIS de propósito: afirmam que ponta é
 * mais cara que fora ponta, que a Verde tem mais arbitragem que a Azul, e
 * assim por diante. Assim continuam valendo depois de um reajuste anual.
 *
 * Os poucos testes com número fixo estão em motor.test.ts, e são o portão de
 * revisão: quando a ANEEL reajusta, eles falham de propósito, para obrigar
 * alguém a olhar o quanto a economia prometida mudou.
 */

const BASE: EntradasMotor = {
  atividades: ['leite_gado'],
  equipamentos: ['tanque_resfriamento', 'ordenha_mecanizada'],
  possuiSolar: false,
  possuiBess: false,
  valorFaturaReais: 8400,
  consumoKwh: 8900,
  classeTarifaria: 'branca',
  demandaContratadaKw: null,
};

describe('o arquivo de tarifas da ANEEL', () => {
  it('aponta para uma resolução homologatória de verdade', () => {
    expect(TARIFAS_ANEEL.reh).toMatch(/RESOLUÇÃO HOMOLOGATÓRIA/i);
    expect(TARIFAS_ANEEL.distribuidora).toBe('CEMIG-D');
  });

  it('está vigente — tarifa vencida vira promessa errada', () => {
    expect(new Date(TARIFAS_ANEEL.vigencia.fim).getTime()).toBeGreaterThan(Date.now());
  });

  it('tem ponta mais cara que fora ponta em toda modalidade com horário', () => {
    const t = TARIFAS_ANEEL.tarifas;
    expect(t.b2_rural_branca.ponta).toBeGreaterThan(t.b2_rural_branca.intermediario);
    expect(t.b2_rural_branca.intermediario).toBeGreaterThan(t.b2_rural_branca.fora_ponta);
    expect(t.a4_verde.ponta).toBeGreaterThan(t.a4_verde.fora_ponta);
    expect(t.a4_azul.ponta).toBeGreaterThan(t.a4_azul.fora_ponta);
    expect(t.a4_azul.demanda_ponta).toBeGreaterThan(t.a4_azul.demanda_fora_ponta);
  });

  it('diz de onde veio, para o produtor poder conferir', () => {
    const fonte = fonteTarifaria();
    expect(fonte.portal).toContain('dadosabertos.aneel.gov.br');
    expect(fonte.reh).toBe(TARIFAS_ANEEL.reh);
  });
});

describe('modalidade do Grupo A', () => {
  it('abaixo de 300 kW usa a Verde', () => {
    expect(perfilTarifario('grupo_a', 150).modalidade).toBe('A4 Verde');
  });

  it('de 300 kW para cima a distribuidora exige a Azul', () => {
    expect(perfilTarifario('grupo_a', 300).modalidade).toBe('A4 Azul');
    expect(perfilTarifario('grupo_a', 800).modalidade).toBe('A4 Azul');
  });

  it('sem demanda informada, assume Verde — é o caso rural comum', () => {
    expect(perfilTarifario('grupo_a', null).modalidade).toBe('A4 Verde');
  });

  /**
   * As duas modalidades ganham dinheiro por caminhos opostos, e é por isso
   * que tratar "Grupo A" como um número só estava errado: na Verde a bateria
   * vale por deslocar energia; na Azul, por cortar o pico de demanda.
   */
  it('Verde ganha na energia, Azul ganha na demanda', () => {
    const verde = perfilTarifario('grupo_a', 150);
    const azul = perfilTarifario('grupo_a', 500);

    expect(verde.deltaTarifaReaisPorKwh).toBeGreaterThan(azul.deltaTarifaReaisPorKwh * 3);
    expect(azul.demandaReaisPorKwMes).toBeGreaterThan(verde.demandaReaisPorKwMes);
  });
});

describe('tarifa convencional', () => {
  it('não tem diferença de horário, então não tem o que capturar', () => {
    const p = perfilTarifario('convencional', null);
    expect(p.deltaTarifaReaisPorKwh).toBe(0);
    expect(p.fracaoConsumoNaPonta).toBe(0);
  });

  it('o motor não inventa economia onde não existe', () => {
    const d = calcularDiagnostico({ ...BASE, classeTarifaria: 'convencional' });
    expect(d.economiaMensalReais).toBe(0);
    expect(d.economiaEnergiaReais).toBe(0);
    expect(d.economiaDemandaReais).toBe(0);
  });
});

describe('teto físico da ponta', () => {
  /**
   * O erro que este limite corrige: uma fazenda com muita carga flexível mas
   * pouco consumo na ponta ganhava economia sobre kWh que já eram baratos.
   */
  it('não desloca mais energia do que a fazenda compra na ponta', () => {
    const d = calcularDiagnostico(BASE);
    const consumoDiario = d.detalhes.consumoKwhUsado / 30;
    const naPonta = consumoDiario * perfilTarifario('branca', null).fracaoConsumoNaPonta;
    const entregaDiaria = d.economiaMensalReais / 30 / d.detalhes.deltaTarifaReaisPorKwh / 0.88;

    expect(entregaDiaria).toBeLessThanOrEqual(naPonta + 0.01);
  });

  it('carga flexível a mais não aumenta a economia depois que a ponta acaba', () => {
    const poucoEquipamento = calcularDiagnostico({ ...BASE, equipamentos: ['tanque_resfriamento'] });
    const tudo = calcularDiagnostico({
      ...BASE,
      equipamentos: ['tanque_resfriamento', 'ordenha_mecanizada', 'caldeira', 'pivo_central'],
    });

    // A fração deslocável sobe, mas a energia na ponta é a mesma.
    expect(tudo.detalhes.fracaoDeslocavel).toBeGreaterThan(poucoEquipamento.detalhes.fracaoDeslocavel);
    expect(tudo.economiaMensalReais).toBe(poucoEquipamento.economiaMensalReais);
  });
});

describe('fator de tributos', () => {
  it('sai da fatura do produtor quando ele informa fatura e kWh', () => {
    const { fator, observado } = fatorTributosObservado(8400, 8900, 'branca', null);
    const nua = perfilTarifario('branca', null, 1).tarifaMediaReaisPorKwh;

    expect(observado).toBe(true);
    expect(fator).toBeCloseTo(8400 / 8900 / nua, 6);
  });

  it('cai para a média de Minas quando falta o kWh', () => {
    expect(fatorTributosObservado(8400, null, 'branca', null).observado).toBe(false);
    expect(fatorTributosObservado(8400, 0, 'branca', null).observado).toBe(false);
  });

  it('ignora número absurdo — quase sempre é erro de digitação', () => {
    // kWh digitado no campo de reais: fatura minúscula para o consumo.
    expect(fatorTributosObservado(89, 8900, 'branca', null).observado).toBe(false);
    // Fatura de um ano inteiro num mês só.
    expect(fatorTributosObservado(100800, 8900, 'branca', null).observado).toBe(false);
  });

  it('o fator medido chega ao relatório, para dar para conferir depois', () => {
    const d = calcularDiagnostico(BASE);
    expect(d.detalhes.fatorTributosObservado).toBe(true);
    expect(d.detalhes.modalidadeTarifaria).toBe('B2 Rural Branca');
    expect(d.detalhes.tarifaReh).toBe(TARIFAS_ANEEL.reh);
  });
});
