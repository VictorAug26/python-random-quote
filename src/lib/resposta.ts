import { NextResponse } from 'next/server';
import { ErroDeConfiguracao } from '@/lib/config';

/**
 * Resposta padrão de falha das rotas de API.
 *
 * O detalhe vai para o log do servidor; o produtor recebe uma frase que dá
 * para entender, sem dado pessoal nem stack trace.
 *
 * A exceção é erro de configuração em desenvolvimento: aí a mensagem aparece
 * na tela. Sem isso, quem está montando o ambiente vê "falha interna", vai
 * atrás no terminal, corrige uma variável, e descobre a próxima só na
 * tentativa seguinte.
 */
export function respostaDeFalha(contexto: string, erro: unknown): NextResponse {
  console.error(`[${contexto}] falha`, erro);

  if (erro instanceof ErroDeConfiguracao && process.env.NODE_ENV !== 'production') {
    return NextResponse.json(
      { erro: 'configuracao_incompleta', detalhe: erro.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ erro: 'falha_interna' }, { status: 500 });
}
