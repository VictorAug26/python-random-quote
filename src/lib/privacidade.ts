import 'server-only';
import { createHash } from 'node:crypto';
import { envObrigatoria } from '@/lib/config';

/**
 * Guardamos o hash do IP, nunca o IP em claro.
 *
 * Serve para conferir uma contestação de consentimento ("eu nunca preenchi
 * isso") sem estocar um dado que, por si só, não usamos para nada. O pepper
 * fica no ambiente do servidor: sem ele, o hash não volta a ser IP nem por
 * força bruta sobre a faixa de endereços.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const limpo = ip.trim();
  if (limpo === '') return null;

  return createHash('sha256')
    .update(`${limpo}:${envObrigatoria('IP_HASH_PEPPER')}`)
    .digest('hex');
}

/**
 * Extrai o IP do cliente dos cabeçalhos do proxy da Vercel.
 * O primeiro item de x-forwarded-for é o cliente original.
 */
export function ipDaRequisicao(cabecalhos: Headers): string | null {
  const encaminhado = cabecalhos.get('x-forwarded-for');
  if (encaminhado) {
    const primeiro = encaminhado.split(',')[0]?.trim();
    if (primeiro) return primeiro;
  }
  return cabecalhos.get('x-real-ip');
}

/** O banco aceita no máximo 300 caracteres, e não precisamos de mais. */
export function userAgentResumido(cabecalhos: Headers): string | null {
  const ua = cabecalhos.get('user-agent');
  if (!ua) return null;
  return ua.slice(0, 300);
}
