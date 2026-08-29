import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  carregando?: boolean;
};

/** Botão principal: largura total, alto, difícil de errar o toque. */
export function Botao({ carregando = false, children, disabled, className, ...resto }: Props) {
  return (
    <button
      disabled={disabled || carregando}
      className={[
        'w-full rounded-xl bg-emerald-700 px-6 py-4 text-lg font-semibold text-white',
        'active:bg-emerald-800 disabled:bg-stone-400',
        className ?? '',
      ].join(' ')}
      {...resto}
    >
      {carregando ? 'Enviando…' : children}
    </button>
  );
}
