import type { InputHTMLAttributes, ReactNode } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  rotulo: string;
  ajuda?: ReactNode;
  erro?: string | undefined;
  /** Marca fixa dentro do campo, como "R$" ou "kWh". */
  prefixo?: string;
};

/** Campo de texto: rótulo grande, alvo de toque alto, erro logo abaixo. */
export function Campo({ id, rotulo, ajuda, erro, prefixo, className, ...resto }: Props) {
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

      <div className="relative mt-2">
        {prefixo ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-500"
          >
            {prefixo}
          </span>
        ) : null}

        <input
          id={id}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descrito || undefined}
          className={[
            'w-full rounded-xl border bg-white py-3.5 pr-4 text-stone-900',
            prefixo ? 'pl-12' : 'pl-4',
            'placeholder:text-stone-400',
            erro ? 'border-red-600' : 'border-stone-300',
            className ?? '',
          ].join(' ')}
          {...resto}
        />
      </div>

      {erro ? (
        <p id={idErro} role="alert" className="mt-1.5 text-sm font-medium text-red-700">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
