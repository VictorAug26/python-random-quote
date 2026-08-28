import { describe, expect, it } from 'vitest';
import { esquemaPerfil, errosPorCampo } from '@/lib/validacao/schemas';
import {
  booleanosParaInstalacao,
  instalacaoParaBooleanos,
  VALORES_INSTALACAO,
} from '@/lib/dominio';

const valido = {
  atividades: ['leite_gado'],
  equipamentos: ['tanque_resfriamento', 'ordenha_mecanizada'],
  instalacao: 'nenhum',
};

describe('esquemaPerfil', () => {
  it('aceita um perfil completo', () => {
    const r = esquemaPerfil.safeParse(valido);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.equipamentos).toHaveLength(2);
  });

  it('exige pelo menos uma atividade', () => {
    const r = esquemaPerfil.safeParse({ ...valido, atividades: [] });
    expect(r.success).toBe(false);
    if (!r.success) expect(errosPorCampo(r.error).atividades).toMatch(/pelo menos uma/i);
  });

  it('aceita propriedade sem nenhum dos equipamentos listados', () => {
    const r = esquemaPerfil.safeParse({ ...valido, equipamentos: [] });
    expect(r.success).toBe(true);
  });

  it('assume lista vazia quando equipamentos nem vem', () => {
    const { equipamentos: _ignorado, ...semEquipamentos } = valido;
    const r = esquemaPerfil.safeParse(semEquipamentos);
    expect(r.success && r.data.equipamentos).toEqual([]);
  });

  it('exige a resposta sobre solar/baterias', () => {
    const { instalacao: _ignorado, ...semInstalacao } = valido;
    const r = esquemaPerfil.safeParse(semInstalacao);
    expect(r.success).toBe(false);
    if (!r.success) expect(errosPorCampo(r.error).instalacao).toMatch(/solar ou baterias/i);
  });

  it('recusa valores que o banco não aceitaria', () => {
    expect(esquemaPerfil.safeParse({ ...valido, atividades: ['pecuaria_corte'] }).success).toBe(
      false,
    );
    expect(esquemaPerfil.safeParse({ ...valido, equipamentos: ['trator'] }).success).toBe(false);
    expect(esquemaPerfil.safeParse({ ...valido, instalacao: 'talvez' }).success).toBe(false);
  });

  it('remove repetição — o CHECK do banco conta os itens', () => {
    const r = esquemaPerfil.safeParse({
      ...valido,
      atividades: ['leite_gado', 'leite_gado', 'outro'],
      equipamentos: ['caldeira', 'caldeira'],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.atividades).toEqual(['leite_gado', 'outro']);
      expect(r.data.equipamentos).toEqual(['caldeira']);
    }
  });
});

describe('conversão de instalação', () => {
  it('traduz a escolha única nos dois booleanos do banco', () => {
    expect(instalacaoParaBooleanos('nenhum')).toEqual({ possuiSolar: false, possuiBess: false });
    expect(instalacaoParaBooleanos('solar')).toEqual({ possuiSolar: true, possuiBess: false });
    expect(instalacaoParaBooleanos('baterias')).toEqual({ possuiSolar: false, possuiBess: true });
    expect(instalacaoParaBooleanos('solar_e_baterias')).toEqual({
      possuiSolar: true,
      possuiBess: true,
    });
  });

  it('volta ao valor original — é o que reabre a tela preenchida', () => {
    for (const valor of VALORES_INSTALACAO) {
      const { possuiSolar, possuiBess } = instalacaoParaBooleanos(valor);
      expect(booleanosParaInstalacao(possuiSolar, possuiBess)).toBe(valor);
    }
  });
});
