type Props = {
  tipo: 'checkbox' | 'radio';
  id: string;
  /** Só para radio: agrupa as opções que se excluem. */
  nome?: string;
  marcado: boolean;
  aoMudar: (marcado: boolean) => void;
  titulo: string;
  descricao?: string;
};

/**
 * Opção em formato de cartão: o alvo de toque é o cartão inteiro, não o
 * quadradinho. No celular, no meio do curral, isso é a diferença entre
 * responder e desistir.
 */
export function CaixaOpcao({ tipo, id, nome, marcado, aoMudar, titulo, descricao }: Props) {
  return (
    <label
      htmlFor={id}
      className={[
        'flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4',
        marcado ? 'border-emerald-700 bg-emerald-50/60' : 'border-stone-300',
      ].join(' ')}
    >
      <input
        type={tipo}
        id={id}
        name={nome}
        checked={marcado}
        onChange={(evento) => aoMudar(evento.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-emerald-700"
      />
      <span>
        <span className="block font-medium text-stone-800">{titulo}</span>
        {descricao ? (
          <span className="mt-0.5 block text-sm text-stone-500">{descricao}</span>
        ) : null}
      </span>
    </label>
  );
}
