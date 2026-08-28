/**
 * Leitura de números digitados por gente de verdade.
 *
 * O produtor vai digitar o valor da conta do jeito que enxerga na fatura:
 * "8400", "8.400", "8.400,00", "R$ 8400,50". Todos querem dizer a mesma coisa.
 * Módulo puro — o mesmo schema de validação usa isto nos dois lados.
 */

/**
 * Converte texto em número, no padrão brasileiro (vírgula decimal).
 * Devolve null quando não dá para reconhecer um número.
 */
export function parsearNumeroBR(entrada: string): number | null {
  const limpo = entrada.replace(/[R$\s]/gi, '').trim();
  if (limpo === '') return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+([.,]\d+)?$|^\d+$/.test(limpo)) return null;

  let normalizado: string;

  if (limpo.includes(',')) {
    // Tem vírgula: ela é o separador decimal e os pontos são de milhar.
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else if (limpo.includes('.')) {
    const partes = limpo.split('.');
    const ultima = partes[partes.length - 1] ?? '';
    // "8.400" é oito mil e quatrocentos, não oito e quatro décimos: aqui,
    // ponto seguido de exatamente três dígitos é separador de milhar.
    normalizado = partes.length > 1 && ultima.length === 3 ? partes.join('') : limpo;
  } else {
    normalizado = limpo;
  }

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

/** Formata para exibição no campo, sem o símbolo da moeda. */
export function formatarNumeroBR(valor: number, casas = 2): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Deixa o campo aceitar só o que pode virar número. */
export function limparEntradaNumerica(entrada: string): string {
  return entrada.replace(/[^\d.,]/g, '').slice(0, 15);
}
