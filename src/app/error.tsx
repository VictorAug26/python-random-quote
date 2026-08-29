'use client';

import { useEffect } from 'react';

/**
 * Tela de erro.
 *
 * Sem ela, uma falha no servidor vira "A server error occurred" e um código
 * de rastreio — o produtor não entende, e quem está montando o ambiente não
 * descobre a causa sem ir ao log.
 *
 * Em desenvolvimento mostramos a mensagem real. Em produção, não: ela pode
 * carregar nome de tabela e detalhe de infraestrutura.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[tela] falha ao renderizar', error);
  }, [error]);

  const emDesenvolvimento = process.env.NODE_ENV !== 'production';

  return (
    <div className="py-8">
      <h1 className="text-2xl font-bold text-stone-900">Algo deu errado aqui</h1>

      <p className="mt-3 leading-relaxed text-stone-600">
        Não conseguimos carregar esta tela. Suas respostas anteriores foram salvas — é
        só tentar de novo.
      </p>

      <button
        type="button"
        onClick={reset}
        className="mt-6 w-full rounded-xl bg-emerald-700 px-6 py-4 text-lg font-semibold text-white active:bg-emerald-800"
      >
        Tentar de novo
      </button>

      {/*
        O digest é o mesmo código que o Next grava no log do servidor. Em
        produção é a única ponte entre o que o usuário viu e a causa real —
        sem ele, não há como cruzar uma reclamação com o log da Vercel.
      */}
      {!emDesenvolvimento && error.digest ? (
        <p className="mt-6 font-mono text-xs text-stone-400">
          Código do erro: {error.digest}
        </p>
      ) : null}

      {emDesenvolvimento ? (
        <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Detalhe técnico (só aparece em desenvolvimento)
          </p>
          <p className="mt-2 break-words font-mono text-xs leading-relaxed text-amber-900">
            {error.message}
          </p>
          <p className="mt-3 text-sm text-amber-900">
            Erro de coluna ou tabela inexistente costuma ser migration que faltou
            aplicar. Rode <code className="font-mono">npm run checar</code>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
