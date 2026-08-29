import { formatarMoeda } from '@/lib/formatacao';
import { explicacaoConfianca, frasePrincipal } from '@/lib/motor/mensagens';
import type { DiagnosticoExibivel } from '@/lib/motor/tipos';

/** O número que o produtor abriu a página para ver. */
export function CardEconomia({ diagnostico }: { diagnostico: DiagnosticoExibivel }) {
  return (
    <section className="rounded-2xl bg-emerald-700 p-6 text-white">
      <p className="text-sm font-medium text-emerald-100">Economia estimada</p>

      <p className="mt-1 text-5xl font-bold tracking-tight">
        {formatarMoeda(diagnostico.economiaMensalReais)}
      </p>
      <p className="text-lg text-emerald-100">por mês</p>

      <p className="mt-4 border-t border-emerald-600 pt-4 text-sm text-emerald-50">
        Na prática, entre {formatarMoeda(diagnostico.economiaMinReais)} e{' '}
        {formatarMoeda(diagnostico.economiaMaxReais)} por mês — cerca de{' '}
        {Math.round(diagnostico.economiaPercentual)}% da sua conta de luz.
      </p>
    </section>
  );
}

/** Repete a frase principal em texto corrido, com a ressalva de confiança. */
export function TextoEconomia({ diagnostico }: { diagnostico: DiagnosticoExibivel }) {
  return (
    <section>
      <p className="text-lg leading-relaxed text-stone-800">{frasePrincipal(diagnostico)}</p>
      <p className="mt-2 text-sm leading-relaxed text-stone-500">
        {explicacaoConfianca(diagnostico.confianca)}
      </p>
    </section>
  );
}
