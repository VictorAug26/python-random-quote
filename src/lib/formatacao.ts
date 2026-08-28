/** Formatações de exibição. Nada aqui toca banco nem valida regra de negócio. */

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

/** Só as iniciais maiúsculas, preservando preposições ("Santa Rosa da Serra"). */
export function capitalizarNome(texto: string): string {
  const minusculas = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return texto
    .trim()
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .map((palavra, indice) =>
      indice > 0 && minusculas.has(palavra)
        ? palavra
        : palavra.charAt(0).toLocaleUpperCase('pt-BR') + palavra.slice(1),
    )
    .join(' ');
}
