import type { ReactNode } from 'react';

type Props = {
  titulo: string;
  ajuda?: string;
  erro?: string | undefined;
  children: ReactNode;
};

/** Bloco de pergunta: título, ajuda opcional, opções e erro. */
export function Grupo({ titulo, ajuda, erro, children }: Props) {
  return (
    <fieldset>
      <legend className="text-base font-medium text-stone-800">{titulo}</legend>
      {ajuda ? <p className="mt-0.5 text-sm text-stone-500">{ajuda}</p> : null}

      <div className="mt-3 space-y-2">{children}</div>

      {erro ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {erro}
        </p>
      ) : null}
    </fieldset>
  );
}
