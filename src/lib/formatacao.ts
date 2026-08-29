/** Formatações de exibição. Nada aqui toca banco nem valida regra de negócio. */

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

/**
 * "2027-05-27" → "27/05/2027".
 *
 * Sem passar por `new Date`: a string vem só com a data, e o construtor a
 * interpretaria como meia-noite UTC — o que no fuso de Brasília cai no dia
 * anterior e mostraria a vigência terminando um dia antes.
 */
export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
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
