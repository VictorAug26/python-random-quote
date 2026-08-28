/**
 * Vocabulário do diagnóstico: os códigos que vão para o banco e o texto que
 * aparece na tela, lado a lado.
 *
 * Ficam juntos de propósito. Quando alguém acrescentar uma atividade nova,
 * vai ver na mesma tela que precisa mexer no CHECK da migration também — os
 * valores aqui têm que bater com os aceitos em perfis_atividade.
 */

export const VALORES_ATIVIDADE = ['leite_gado', 'graos_cafe_irrigado', 'outro'] as const;
export type Atividade = (typeof VALORES_ATIVIDADE)[number];

export const ATIVIDADES: { valor: Atividade; titulo: string; descricao: string }[] = [
  {
    valor: 'leite_gado',
    titulo: 'Leite ou gado',
    descricao: 'Ordenha, cria, recria ou engorda',
  },
  {
    valor: 'graos_cafe_irrigado',
    titulo: 'Grãos ou café irrigado',
    descricao: 'Lavoura com irrigação',
  },
  {
    valor: 'outro',
    titulo: 'Outra atividade',
    descricao: 'Conte qual no campo que aparece',
  },
];

export const VALORES_EQUIPAMENTO = [
  'ordenha_mecanizada',
  'tanque_resfriamento',
  'caldeira',
  'pivo_central',
] as const;
export type Equipamento = (typeof VALORES_EQUIPAMENTO)[number];

export const EQUIPAMENTOS: { valor: Equipamento; titulo: string; descricao: string }[] = [
  {
    valor: 'ordenha_mecanizada',
    titulo: 'Ordenha mecanizada',
    descricao: 'Puxa energia em horário fixo, todo dia',
  },
  {
    valor: 'tanque_resfriamento',
    titulo: 'Tanque de resfriamento',
    descricao: 'Um dos maiores gastos de uma fazenda de leite',
  },
  {
    valor: 'caldeira',
    titulo: 'Caldeira elétrica',
    descricao: 'Aquecimento de água',
  },
  {
    valor: 'pivo_central',
    titulo: 'Pivô central',
    descricao: 'Irrigação — costuma ser a maior carga da propriedade',
  },
];

/**
 * O que já existe instalado.
 *
 * O banco guarda dois booleanos (solar e bateria), mas perguntar duas vezes
 * na tela seria uma pergunta a mais sem necessidade. Uma escolha só, quatro
 * opções, e a conversão acontece aqui.
 */
export const VALORES_INSTALACAO = ['nenhum', 'solar', 'baterias', 'solar_e_baterias'] as const;
export type Instalacao = (typeof VALORES_INSTALACAO)[number];

export const INSTALACOES: { valor: Instalacao; titulo: string }[] = [
  { valor: 'nenhum', titulo: 'Não tenho nenhum dos dois' },
  { valor: 'solar', titulo: 'Só energia solar' },
  { valor: 'baterias', titulo: 'Só baterias' },
  { valor: 'solar_e_baterias', titulo: 'Solar e baterias' },
];

export function instalacaoParaBooleanos(valor: Instalacao): {
  possuiSolar: boolean;
  possuiBess: boolean;
} {
  return {
    possuiSolar: valor === 'solar' || valor === 'solar_e_baterias',
    possuiBess: valor === 'baterias' || valor === 'solar_e_baterias',
  };
}

export function booleanosParaInstalacao(possuiSolar: boolean, possuiBess: boolean): Instalacao {
  if (possuiSolar && possuiBess) return 'solar_e_baterias';
  if (possuiSolar) return 'solar';
  if (possuiBess) return 'baterias';
  return 'nenhum';
}
