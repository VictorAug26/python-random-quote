import { Passos } from '@/components/ui/Passos';
import { FormCadastro } from '@/components/formularios/FormCadastro';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** TELA 1 — cadastro rápido. */
export default async function PaginaCadastro({ searchParams }: Props) {
  const parametros = await searchParams;
  const bruto = parametros.origem;
  const origem = typeof bruto === 'string' ? bruto.slice(0, 60) : undefined;

  return (
    <>
      <Passos atual={1} />

      <h1 className="mt-6 text-3xl font-bold leading-tight text-stone-900">
        Quanto sua fazenda pode economizar de energia?
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-stone-600">
        Responda 3 telas rápidas sobre a propriedade e a conta de luz. Em 2 minutos você
        recebe uma estimativa de quanto dá para economizar por mês com baterias.
      </p>

      <div className="mt-8">
        <FormCadastro origem={origem} />
      </div>
    </>
  );
}
