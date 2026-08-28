/**
 * Leitura de variáveis de ambiente.
 *
 * Nenhuma chave vive no código. Estas funções são chamadas em tempo de
 * execução (nunca no topo de um módulo) para que a ausência de uma variável
 * quebre a requisição com mensagem clara, e não o build inteiro.
 */

export function envObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor || valor.trim() === '') {
    throw new Error(
      `Variável de ambiente ausente: ${nome}. Veja .env.example e configure antes de subir.`,
    );
  }
  return valor;
}

export function envOpcional(nome: string, padrao = ''): string {
  const valor = process.env[nome];
  return valor && valor.trim() !== '' ? valor : padrao;
}

/** WhatsApp de atendimento, usado no rodapé e na página de dados pessoais. */
export function whatsappContato(): string {
  return envOpcional('WHATSAPP_CONTATO', '+5534900000000');
}

/** Mesma coisa, formatado para virar link wa.me (só dígitos). */
export function whatsappContatoLink(): string {
  return whatsappContato().replace(/\D/g, '');
}
