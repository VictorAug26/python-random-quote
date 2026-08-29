/**
 * Textos e versão da política de privacidade.
 *
 * A frase gravada em `consentimentos.texto_apresentado` tem que ser
 * literalmente a mesma que o produtor leu na tela — por isso os componentes
 * do formulário e a rota de API importam daqui, e ninguém redigita.
 *
 * Ao mudar qualquer texto abaixo ou a página /privacidade, suba a versão.
 * Os consentimentos antigos continuam válidos e apontando para a versão em
 * que foram dados.
 */

export const VERSAO_POLITICA = '2026-08-28';

export const FINALIDADES = ['diagnostico', 'compartilhamento_parceiro'] as const;

export type Finalidade = (typeof FINALIDADES)[number];

export const TEXTO_CONSENTIMENTO: Record<Finalidade, string> = {
  diagnostico: 'Autorizo o uso dos meus dados para gerar o diagnóstico energético.',
  compartilhamento_parceiro:
    'Autorizo o compartilhamento do meu contato com um parceiro fornecedor de baterias.',
};
