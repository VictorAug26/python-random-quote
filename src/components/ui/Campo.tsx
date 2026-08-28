import type { InputHTMLAttributes, ReactNode } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  rotulo: string;
  ajuda?: ReactNode;
  erro?: string | undefined;
};

/** Campo de texto: rótulo grande, alvo de toque alto, erro logo abaixo. */
export function Campo({ id, rotulo, ajuda, erro, className, ...resto }: Props) {
  const idAjuda = ajuda ? `${id}-ajuda` : undefined;
  const idErro = erro ? `${id}-erro` : undefined;
  const descrito = [idAjuda, idErro].filter(Boolean).join(' ');

  return (
    <div>
      <label htmlFor={id} className="block text-base font-medium text-stone-800">
        {rotulo}
      </label>

      {ajuda ? (
        <p id={idAjuda} className="mt-0.5 text-sm text-stone-500">
          {ajuda}
        </p>
      ) : null}

      <input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descrito || undefined}
        className={[
          'mt-2 w-full rounded-xl border bg-white px-4 py-3.5 text-stone-900',
          'placeholder:text-stone-400',
          erro ? 'border-red-600' : 'border-stone-300',
          className ?? '',
        ].join(' ')}
        {...resto}
      />

      {erro ? (
        <p id={idErro} role="alert" className="mt-1.5 text-sm font-medium text-red-700">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
