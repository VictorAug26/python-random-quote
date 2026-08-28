import type { ReactNode } from 'react';

type Props = {
  id: string;
  marcado: boolean;
  aoMudar: (marcado: boolean) => void;
  erro?: string | undefined;
  children: ReactNode;
};

/**
 * Checkbox de consentimento.
 *
 * Não existe prop de "marcado por padrão", de propósito: consentimento
 * pré-marcado não é consentimento. Quem quiser marcar, marca.
 */
export function CaixaConsentimento({ id, marcado, aoMudar, erro, children }: Props) {
  const idErro = erro ? `${id}-erro` : undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className={[
          'flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4',
          marcado ? 'border-emerald-700 bg-emerald-50/60' : 'border-stone-300',
          erro ? 'border-red-600' : '',
        ].join(' ')}
      >
        <input
          type="checkbox"
          id={id}
          checked={marcado}
          onChange={(evento) => aoMudar(evento.target.checked)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={idErro}
          className="mt-0.5 size-5 shrink-0 accent-emerald-700"
        />
        <span className="text-sm leading-relaxed text-stone-700">{children}</span>
      </label>

      {erro ? (
        <p id={idErro} role="alert" className="mt-1.5 text-sm font-medium text-red-700">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
