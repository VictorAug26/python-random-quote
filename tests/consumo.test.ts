import { describe, expect, it } from 'vitest';
import { esquemaConsumo, errosPorCampo } from '@/lib/validacao/schemas';
import { formatarNumeroBR, limparEntradaNumerica, parsearNumeroBR } from '@/lib/numeros';

describe('parsearNumeroBR', () => {
  it('entende o valor do jeito que o produtor digita', () => {
    expect(parsearNumeroBR('8400')).toBe(8400);
    expect(parsearNumeroBR('8.400')).toBe(8400);
    expect(parsearNumeroBR('8.400,00')).toBe(8400);
    expect(parsearNumeroBR('8400,50')).toBe(8400.5);
    expect(parsearNumeroBR('R$ 8.400,00')).toBe(8400);
    expect(parsearNumeroBR('  8400  ')).toBe(8400);
    expect(parsearNumeroBR('1.234.567')).toBe(1234567);
  });

  it('não confunde separador de milhar com decimal', () => {
    // Em fatura brasileira "8.400" é oito mil e quatrocentos.
    expect(parsearNumeroBR('8.400')).toBe(8400);
    // Mas "8.4" só pode ser decimal.
    expect(parsearNumeroBR('8.4')).toBe(8.4);
  });

  it('recusa o que não é número', () => {
    expect(parsearNumeroBR('')).toBeNull();
    expect(parsearNumeroBR('não sei')).toBeNull();
    expect(parsearNumeroBR('R$')).toBeNull();
    expect(parsearNumeroBR('8,4,5')).toBeNull();
  });

  it('formata de volta para o padrão brasileiro', () => {
    expect(formatarNumeroBR(8400, 2)).toBe('8.400,00');
    expect(formatarNumeroBR(8900, 0)).toBe('8.900');
  });

  it('limpa a digitação sem atrapalhar quem está escrevendo', () => {
    expect(limparEntradaNumerica('R$ 8.400,00')).toBe('8.400,00');
    expect(limparEntradaNumerica('abc123')).toBe('123');
  });
});

const valido = {
  valorFaturaReais: '8.400,00',
  consumoKwh: '8.900',
  classeTarifaria: 'branca',
};

describe('esquemaConsumo', () => {
  it('aceita a tela preenchida e devolve números', () => {
    const r = esquemaConsumo.safeParse(valido);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.valorFaturaReais).toBe(8400);
      expect(r.data.consumoKwh).toBe(8900);
      expect(r.data.classeTarifaria).toBe('branca');
    }
  });

  it('exige o valor da fatura', () => {
    const r = esquemaConsumo.safeParse({ ...valido, valorFaturaReais: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errosPorCampo(r.error).valorFaturaReais).toMatch(/conta de luz/i);
  });

  it('trata o kWh como opcional de verdade', () => {
    for (const entrada of [{ ...valido, consumoKwh: '' }, { valorFaturaReais: '8400', classeTarifaria: 'nao_sei' }]) {
      const r = esquemaConsumo.safeParse(entrada);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.consumoKwh).toBeNull();
    }
  });

  it('recusa valor zero, negativo ou que não é número', () => {
    for (const ruim of ['0', '-100', 'muito']) {
      expect(esquemaConsumo.safeParse({ ...valido, valorFaturaReais: ruim }).success).toBe(false);
    }
  });

  it('barra valores acima do que o banco aceita', () => {
    const r = esquemaConsumo.safeParse({ ...valido, valorFaturaReais: '2.000.000' });
    expect(r.success).toBe(false);
    if (!r.success) expect(errosPorCampo(r.error).valorFaturaReais).toMatch(/alto demais/i);

    expect(esquemaConsumo.safeParse({ ...valido, consumoKwh: '9.000.000' }).success).toBe(false);
  });

  it('exige a classe tarifária, com "não sei" valendo como resposta', () => {
    const { classeTarifaria: _ignorado, ...sem } = valido;
    const r = esquemaConsumo.safeParse(sem);
    expect(r.success).toBe(false);
    if (!r.success) expect(errosPorCampo(r.error).classeTarifaria).toMatch(/Não sei/i);

    expect(esquemaConsumo.safeParse({ ...valido, classeTarifaria: 'nao_sei' }).success).toBe(true);
  });

  it('recusa classe que o banco não aceitaria', () => {
    expect(esquemaConsumo.safeParse({ ...valido, classeTarifaria: 'verde' }).success).toBe(false);
  });
});
