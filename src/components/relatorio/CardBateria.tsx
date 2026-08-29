import { alertaRevisarTarifa, textoPorte, textoRetorno } from '@/lib/motor/mensagens';
import type { DiagnosticoExibivel } from '@/lib/motor/tipos';

/** Porte recomendado, custo e retorno — com o alerta quando não fecha a conta. */
export function CardBateria({ diagnostico }: { diagnostico: DiagnosticoExibivel }) {
  const alerta = alertaRevisarTarifa(diagnostico);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-base font-semibold text-stone-900">O que seria preciso</h2>
        <p className="mt-2 leading-relaxed text-stone-700">{textoPorte(diagnostico)}</p>
        <p className="mt-3 leading-relaxed text-stone-700">{textoRetorno(diagnostico)}</p>
      </div>

      {alerta ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-base font-semibold text-amber-900">Vale saber antes</h2>
          <p className="mt-2 leading-relaxed text-amber-900">{alerta}</p>
        </div>
      ) : null}
    </section>
  );
}
