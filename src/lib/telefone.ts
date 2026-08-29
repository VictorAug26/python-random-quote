/**
 * WhatsApp: máscara e normalização.
 *
 * Módulo puro de propósito — roda igual no navegador e no servidor, sem
 * importar nada de Node. É o que permite o mesmo schema de validação valer
 * nos dois lados.
 */

/**
 * Normaliza para E.164 (+55DDNNNNNNNNN).
 *
 * Aceita o que o produtor digitar: "(34) 99123-4567", "34991234567",
 * "+55 34 99123 4567". Devolve null se não der para reconhecer um número
 * brasileiro válido — aí o formulário pede a correção.
 */
export function normalizarWhatsapp(entrada: string): string | null {
  let digitos = entrada.replace(/\D/g, '');

  // Tira zero de operadora ou de DDD ("034...").
  if (digitos.length > 11 && digitos.startsWith('0')) {
    digitos = digitos.replace(/^0+/, '');
  }

  // Com código do país: 55 + DDD (2) + número (8 ou 9 dígitos).
  if (digitos.length === 12 || digitos.length === 13) {
    if (!digitos.startsWith('55')) return null;
    digitos = digitos.slice(2);
  }

  if (digitos.length !== 10 && digitos.length !== 11) return null;

  const ddd = Number(digitos.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;

  // Celular no Brasil tem 9 dígitos e começa com 9.
  if (digitos.length === 11 && digitos[2] !== '9') return null;

  return `+55${digitos}`;
}

/**
 * Máscara progressiva enquanto o produtor digita:
 * "34" → "(34" → "(34) 9912" → "(34) 99123-4567"
 */
export function mascararTelefone(entrada: string): string {
  const d = entrada.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
