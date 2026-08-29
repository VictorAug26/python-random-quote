import { describe, expect, it } from 'vitest';
import { esquemaCadastro, errosPorCampo } from '@/lib/validacao/schemas';

const valido = {
  nome: 'João da Silva',
  whatsapp: '(34) 99123-4567',
  nomePropriedade: 'Fazenda Boa Vista',
  municipio: 'Patrocínio',
  consenteDiagnostico: true,
  consenteParceiro: false,
};

describe('esquemaCadastro', () => {
  it('aceita um cadastro completo e normaliza o WhatsApp', () => {
    const r = esquemaCadastro.safeParse(valido);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.whatsapp).toBe('+5534991234567');
      expect(r.data.consenteParceiro).toBe(false);
    }
  });

  it('recusa cadastro sem o consentimento de diagnóstico', () => {
    const r = esquemaCadastro.safeParse({ ...valido, consenteDiagnostico: false });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(errosPorCampo(r.error).consenteDiagnostico).toMatch(/autoriza/i);
    }
  });

  it('não exige o consentimento do parceiro', () => {
    const { consenteParceiro: _ignorado, ...semParceiro } = valido;
    const r = esquemaCadastro.safeParse(semParceiro);
    expect(r.success).toBe(true);
    // Ausente vira false: nunca "sim" por omissão.
    if (r.success) expect(r.data.consenteParceiro).toBe(false);
  });

  it('reclama de cada campo vazio com mensagem em português', () => {
    const r = esquemaCadastro.safeParse({
      nome: '',
      whatsapp: '123',
      nomePropriedade: '',
      municipio: '',
      consenteDiagnostico: true,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const erros = errosPorCampo(r.error);
      expect(Object.keys(erros).sort()).toEqual([
        'municipio',
        'nome',
        'nomePropriedade',
        'whatsapp',
      ]);
      expect(erros.whatsapp).toMatch(/WhatsApp inválido/);
    }
  });

  it('tira espaços das pontas', () => {
    const r = esquemaCadastro.safeParse({ ...valido, nome: '  João  ' });
    expect(r.success && r.data.nome).toBe('João');
  });

  it('corta campo longo demais para o banco', () => {
    const r = esquemaCadastro.safeParse({ ...valido, nome: 'a'.repeat(121) });
    expect(r.success).toBe(false);
  });
});
