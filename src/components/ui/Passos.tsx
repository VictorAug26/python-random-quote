const TOTAL = 3;

/** "Passo 1 de 3" — o produtor precisa ver que é curto antes de começar. */
export function Passos({ atual }: { atual: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: TOTAL }, (_, indice) => (
          <span
            key={indice}
            className={[
              'h-1.5 w-8 rounded-full',
              indice < atual ? 'bg-emerald-700' : 'bg-stone-300',
            ].join(' ')}
          />
        ))}
      </div>
      <span className="text-sm text-stone-500">
        Passo {atual} de {TOTAL}
      </span>
    </div>
  );
}
