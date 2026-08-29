import { createHmac, timingSafeEqual } from 'node:crypto';
import { envObrigatoria } from '@/lib/config';

/**
 * Token de sessão sem login.
 *
 * O produtor não cria conta: o que liga as três telas é um cookie httpOnly
 * carregando só o id do lead. Assinado para que ninguém troque o id no
 * navegador e leia o diagnóstico de outra pessoa.
 *
 * Separado de sessao.ts (que mexe no cookie) para poder ser testado sem
 * simular uma requisição.
 */

export const VALIDADE_SEGUNDOS = 60 * 60 * 24 * 7; // uma semana para terminar o formulário

function assinar(corpo: string): string {
  return createHmac('sha256', envObrigatoria('SESSAO_SECRET')).update(corpo).digest('base64url');
}

function conferirAssinatura(esperada: string, recebida: string): boolean {
  const a = Buffer.from(esperada);
  const b = Buffer.from(recebida);
  // Comparação em tempo constante; tamanhos diferentes já reprovam.
  return a.length === b.length && timingSafeEqual(a, b);
}

export function criarToken(leadId: string, agora = Date.now()): string {
  const corpo = `${leadId}.${agora}`;
  return `${corpo}.${assinar(corpo)}`;
}

/** Devolve o lead_id se o token for íntegro e estiver no prazo; senão, null. */
export function lerToken(token: string | undefined, agora = Date.now()): string | null {
  if (!token) return null;

  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const [leadId, carimbo, assinatura] = partes as [string, string, string];
  if (!conferirAssinatura(assinar(`${leadId}.${carimbo}`), assinatura)) return null;

  const emitidoEm = Number(carimbo);
  if (!Number.isFinite(emitidoEm)) return null;
  if (agora - emitidoEm > VALIDADE_SEGUNDOS * 1000) return null;

  return leadId;
}
