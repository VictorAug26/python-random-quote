import { z } from 'zod';
import { normalizarWhatsapp } from '@/lib/telefone';

/**
 * Schemas de entrada. O mesmo arquivo valida no navegador (mensagem na hora)
 * e na rota de API (a que realmente conta — o cliente pode ser burlado).
 */

/**
 * Uma mensagem por situação, escrita como se fosse dita em voz alta.
 * Campo vazio e campo curto demais dão na mesma para quem preenche: falta
 * escrever direito. Não vale a pena distinguir os dois na tela.
 */
const textoCurto = (min: number, max: number, faltando: string, longo: string) =>
  z
    .string({ error: faltando })
    .trim()
    .min(min, { error: faltando })
    .max(max, { error: longo });

export const esquemaCadastro = z.object({
  nome: textoCurto(2, 120, 'Escreva seu nome.', 'Esse nome é longo demais.'),

  whatsapp: z
    .string({ error: 'Escreva seu WhatsApp.' })
    .trim()
    .refine((valor) => normalizarWhatsapp(valor) !== null, {
      error: 'WhatsApp inválido. Use DDD + número, como (34) 99123-4567.',
    })
    .transform((valor) => normalizarWhatsapp(valor) as string),

  nomePropriedade: textoCurto(
    2,
    120,
    'Escreva o nome da propriedade.',
    'Esse nome é longo demais.',
  ),
  municipio: textoCurto(2, 80, 'Escreva o município.', 'Esse nome é longo demais.'),

  // Os dois consentimentos são independentes: um obrigatório, um opcional.
  consenteDiagnostico: z.literal(true, {
    error: 'Para gerar o diagnóstico, precisamos da sua autorização.',
  }),
  consenteParceiro: z.boolean().default(false),

  origem: z.string().trim().max(60).optional(),
});

export type DadosCadastro = z.infer<typeof esquemaCadastro>;

/** Converte os erros do Zod em { campo: mensagem } para a tela exibir. */
export function errosPorCampo(erro: z.ZodError): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const problema of erro.issues) {
    const campo = problema.path.join('.') || 'formulario';
    if (!(campo in saida)) saida[campo] = problema.message;
  }
  return saida;
}
