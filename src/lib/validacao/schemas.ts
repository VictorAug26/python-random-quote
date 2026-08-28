import { z } from 'zod';
import { normalizarWhatsapp } from '@/lib/telefone';
import {
  VALORES_ATIVIDADE,
  VALORES_CLASSE_TARIFARIA,
  VALORES_EQUIPAMENTO,
  VALORES_INSTALACAO,
} from '@/lib/dominio';
import { parsearNumeroBR } from '@/lib/numeros';

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

/** Remove repetição — o cliente pode mandar o mesmo valor duas vezes. */
const semRepetidos = <T,>(lista: T[]): T[] => [...new Set(lista)];

export const esquemaPerfil = z.object({
  atividades: z
    .array(z.enum(VALORES_ATIVIDADE), { error: 'Escolha o que a fazenda produz.' })
    .transform(semRepetidos)
    .refine((lista) => lista.length >= 1, {
      error: 'Escolha pelo menos uma atividade.',
    }),

  atividadeOutro: z.string().trim().max(120, { error: 'Resposta longa demais.' }).optional(),

  // Pode vir vazio: nem toda propriedade tem um desses equipamentos.
  equipamentos: z.array(z.enum(VALORES_EQUIPAMENTO)).transform(semRepetidos).default([]),

  instalacao: z.enum(VALORES_INSTALACAO, {
    error: 'Diga se já tem energia solar ou baterias.',
  }),
});

export type DadosPerfil = z.infer<typeof esquemaPerfil>;

/**
 * Número digitado como texto ("8.400,00") vira número de verdade aqui.
 * Os tetos são os mesmos CHECK da migration 0001 — se um passar, o outro
 * pega, mas é melhor o produtor ver a mensagem antes de chegar no banco.
 */
const numeroDigitado = (opcoes: {
  faltando: string;
  invalido: string;
  maximo: number;
  acimaDoMaximo: string;
}) =>
  z
    .string({ error: opcoes.faltando })
    .trim()
    .min(1, { error: opcoes.faltando })
    .transform((texto) => parsearNumeroBR(texto))
    .refine((valor): valor is number => valor !== null && valor > 0, {
      error: opcoes.invalido,
    })
    .refine((valor) => valor <= opcoes.maximo, { error: opcoes.acimaDoMaximo });

export const esquemaConsumo = z.object({
  valorFaturaReais: numeroDigitado({
    faltando: 'Escreva o valor da última conta de luz.',
    invalido: 'Valor inválido. Escreva só o número, como 8.400.',
    maximo: 1000000,
    acimaDoMaximo: 'Esse valor parece alto demais. Confira na fatura.',
  }),

  // Opcional de verdade: muita gente não tem a fatura em mãos na hora.
  consumoKwh: z
    .union([z.literal(''), z.string()])
    .optional()
    .transform((texto) => (texto && texto.trim() !== '' ? parsearNumeroBR(texto) : null))
    .refine((valor) => valor === null || (valor > 0 && valor <= 5000000), {
      error: 'Consumo inválido. Escreva só o número em kWh, como 8.900.',
    }),

  classeTarifaria: z.enum(VALORES_CLASSE_TARIFARIA, {
    error: 'Escolha uma opção. Se não souber, marque "Não sei".',
  }),
});

export type DadosConsumo = z.infer<typeof esquemaConsumo>;

/** Converte os erros do Zod em { campo: mensagem } para a tela exibir. */
export function errosPorCampo(erro: z.ZodError): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const problema of erro.issues) {
    const campo = problema.path.join('.') || 'formulario';
    if (!(campo in saida)) saida[campo] = problema.message;
  }
  return saida;
}
