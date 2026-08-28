import { describe, expect, it } from 'vitest';
import { criarToken, lerToken, VALIDADE_SEGUNDOS } from '@/lib/sessao-token';

const LEAD = '11111111-1111-1111-1111-111111111111';

describe('token de sessão', () => {
  it('vai e volta', () => {
    expect(lerToken(criarToken(LEAD))).toBe(LEAD);
  });

  it('recusa token adulterado — ninguém lê o diagnóstico dos outros', () => {
    const token = criarToken(LEAD);
    const outroLead = '22222222-2222-2222-2222-222222222222';
    const forjado = token.replace(LEAD, outroLead);

    expect(forjado).not.toBe(token);
    expect(lerToken(forjado)).toBeNull();
  });

  it('recusa assinatura trocada, formato errado e valor ausente', () => {
    const token = criarToken(LEAD);
    expect(lerToken(`${token}x`)).toBeNull();
    expect(lerToken(`${LEAD}.${Date.now()}`)).toBeNull();
    expect(lerToken(LEAD)).toBeNull();
    expect(lerToken('')).toBeNull();
    expect(lerToken(undefined)).toBeNull();
  });

  it('expira depois do prazo', () => {
    const agora = Date.now();
    const token = criarToken(LEAD, agora);

    const quaseNoPrazo = agora + VALIDADE_SEGUNDOS * 1000 - 1000;
    expect(lerToken(token, quaseNoPrazo)).toBe(LEAD);

    const vencido = agora + VALIDADE_SEGUNDOS * 1000 + 1000;
    expect(lerToken(token, vencido)).toBeNull();
  });
});
