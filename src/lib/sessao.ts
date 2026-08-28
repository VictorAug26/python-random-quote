import 'server-only';
import { cookies } from 'next/headers';
import { criarToken, lerToken, VALIDADE_SEGUNDOS } from '@/lib/sessao-token';

/** Leitura e escrita do cookie de sessão. A lógica do token está em sessao-token.ts. */

const NOME_COOKIE = 'dx_sessao';

export async function definirSessao(leadId: string): Promise<void> {
  const armazem = await cookies();
  armazem.set(NOME_COOKIE, criarToken(leadId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: VALIDADE_SEGUNDOS,
  });
}

export async function lerSessao(): Promise<string | null> {
  const armazem = await cookies();
  return lerToken(armazem.get(NOME_COOKIE)?.value);
}

export async function limparSessao(): Promise<void> {
  const armazem = await cookies();
  armazem.delete(NOME_COOKIE);
}
