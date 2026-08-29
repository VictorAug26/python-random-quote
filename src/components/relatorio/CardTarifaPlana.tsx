import { formatarMoeda } from '@/lib/formatacao';
import type { DiagnosticoExibivel } from '@/lib/motor/tipos';

/**
 * O relatório de quem está na tarifa convencional.
 *
 * Ali a energia custa o mesmo a qualquer hora do dia, e é da diferença entre
 * horário caro e barato que a bateria tira a economia. O resultado honesto é
 * R$ 0 — mas mostrar "R$ 0" em corpo 48 ao lado de um orçamento de bateria de
 * R$ 48.000 é pior que inútil: passa a impressão de que o diagnóstico falhou,
 * quando na verdade ele encontrou algo aproveitável.
 *
 * O achado é que o problema não é a bateria, é a tarifa. Então o card inteiro
 * fala disso, e o porte de bateria nem aparece — não se recomenda um
 * investimento que, hoje, não devolve nada.
 */
export function CardTarifaPlana({ diagnostico }: { diagnostico: DiagnosticoExibivel }) {
  const seMigrar = diagnostico.economiaSeMigrarParaBrancaReais;

  return (
    <>
      <section className="rounded-2xl bg-amber-500 p-6 text-white">
        <p className="text-sm font-medium text-amber-50">O que encontramos</p>

        <p className="mt-1 text-3xl font-bold leading-tight tracking-tight">
          A sua tarifa não deixa a bateria trabalhar
        </p>

        <p className="mt-4 border-t border-amber-400 pt-4 leading-relaxed text-amber-50">
          Na tarifa convencional a energia custa o mesmo de manhã, à tarde e de madrugada.
          A bateria economiza guardando energia barata para usar na hora cara — e, hoje,
          essa hora cara não existe na sua conta.
        </p>
      </section>

      <section>
        <p className="text-lg leading-relaxed text-stone-800">
          Comprar bateria agora não devolveria o investimento. O primeiro passo é outro,
          e é mais barato: rever a sua tarifa junto à CEMIG.
        </p>

        {seMigrar !== null && seMigrar > 0 ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="leading-relaxed text-emerald-900">
              Na tarifa branca, com o mesmo consumo que você informou, uma bateria
              passaria a economizar cerca de{' '}
              <strong className="font-bold">{formatarMoeda(seMigrar)} por mês</strong>.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-emerald-800">
              A mudança de tarifa é pedida direto na distribuidora e não custa nada. Vale
              conferir antes se o seu consumo se encaixa: na branca a energia fica mais
              cara no fim da tarde, então quem usa muita energia nesse horário pode acabar
              pagando mais.
            </p>
          </div>
        ) : null}
      </section>
    </>
  );
}
