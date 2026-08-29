import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import { buscarConsumo } from '@/lib/repositorio/consumos';
import { formatarNumeroBR } from '@/lib/numeros';
import { Passos } from '@/components/ui/Passos';
import { FormConsumo, type ValoresConsumo } from '@/components/formularios/FormConsumo';

export const dynamic = 'force-dynamic';

const VAZIO: ValoresConsumo = {
  valorFaturaReais: '',
  consumoKwh: '',
  classeTarifaria: '',
};

/** TELA 3 — consumo energético. */
export default async function PaginaConsumo() {
  const leadId = await lerSessao();
  if (!leadId) redirect('/');

  const salvo = await buscarConsumo(leadId);
  const iniciais: ValoresConsumo = salvo
    ? {
        valorFaturaReais: formatarNumeroBR(salvo.valorFaturaReais, 2),
        consumoKwh: salvo.consumoKwh === null ? '' : formatarNumeroBR(salvo.consumoKwh, 0),
        classeTarifaria: salvo.classeTarifaria,
      }
    : VAZIO;

  return (
    <>
      <Passos atual={3} />

      <h1 className="mt-6 text-3xl font-bold leading-tight text-stone-900">
        Última pergunta: a conta de luz
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-stone-600">
        É a partir daqui que sai a estimativa de quanto você pode economizar por mês.
      </p>

      <div className="mt-8">
        <FormConsumo iniciais={iniciais} />
      </div>
    </>
  );
}
