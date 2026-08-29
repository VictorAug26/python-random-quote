/**
 * Modo demonstração: o app roda sem banco.
 *
 * Serve para clicar nas telas e criticar texto, campo e fluxo sem precisar
 * criar projeto no Supabase. Os dados ficam na memória do servidor e somem
 * quando ele reinicia.
 *
 * Liga sozinho quando não há SUPABASE_URL **e** não é produção. Não existe
 * variável para ativar: em produção, banco ausente é erro, não demonstração.
 *
 * O que ele NÃO testa, e por isso não substitui um ambiente de verdade:
 * as travas que vivem dentro do Postgres — gravação bloqueada por
 * consentimento revogado, atomicidade das transações, cascata do expurgo e a
 * view sem dado pessoal. O comportamento visível é reproduzido aqui; a
 * garantia, não.
 */
export function modoDemo(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return !process.env.SUPABASE_URL?.trim();
}
