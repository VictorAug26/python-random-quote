import { describe, expect, it } from 'vitest';
import { mascararTelefone, normalizarWhatsapp } from '@/lib/telefone';

describe('normalizarWhatsapp', () => {
  it('aceita os formatos que o produtor costuma digitar', () => {
    const esperado = '+5534991234567';
    expect(normalizarWhatsapp('(34) 99123-4567')).toBe(esperado);
    expect(normalizarWhatsapp('34991234567')).toBe(esperado);
    expect(normalizarWhatsapp('+55 34 99123 4567')).toBe(esperado);
    expect(normalizarWhatsapp('55 (34) 99123-4567')).toBe(esperado);
    expect(normalizarWhatsapp('  34 9 9123 4567  ')).toBe(esperado);
  });

  it('aceita fixo de 10 dígitos', () => {
    expect(normalizarWhatsapp('(34) 3821-1234')).toBe('+553438211234');
  });

  it('tira o zero de operadora', () => {
    expect(normalizarWhatsapp('034991234567')).toBe('+5534991234567');
  });

  it('recusa o que não dá para reconhecer', () => {
    expect(normalizarWhatsapp('')).toBeNull();
    expect(normalizarWhatsapp('991234567')).toBeNull(); // sem DDD
    expect(normalizarWhatsapp('(01) 99123-4567')).toBeNull(); // DDD inexistente
    expect(normalizarWhatsapp('(34) 89123-4567')).toBeNull(); // celular sem o 9
    expect(normalizarWhatsapp('+1 415 555 2671')).toBeNull(); // fora do Brasil
    expect(normalizarWhatsapp('não tenho')).toBeNull();
  });

  it('sai sempre no formato que o banco aceita', () => {
    const aceitoPeloBanco = /^\+55[1-9][0-9]{9,10}$/;
    for (const entrada of ['(34) 99123-4567', '3438211234', '+553499123456']) {
      const saida = normalizarWhatsapp(entrada);
      if (saida !== null) expect(saida).toMatch(aceitoPeloBanco);
    }
  });
});

describe('mascararTelefone', () => {
  it('vai formatando enquanto digita', () => {
    expect(mascararTelefone('3')).toBe('(3');
    expect(mascararTelefone('34')).toBe('(34');
    expect(mascararTelefone('349')).toBe('(34) 9');
    expect(mascararTelefone('349912')).toBe('(34) 9912');
    expect(mascararTelefone('3499123456')).toBe('(34) 9912-3456');
    expect(mascararTelefone('34991234567')).toBe('(34) 99123-4567');
  });

  it('ignora o que passar de 11 dígitos', () => {
    expect(mascararTelefone('349912345678888')).toBe('(34) 99123-4567');
  });

  it('não quebra com texto solto', () => {
    expect(mascararTelefone('')).toBe('');
    expect(mascararTelefone('abc')).toBe('');
  });
});
