import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import { Passos } from '@/components/ui/Passos';

export const dynamic = 'force-dynamic';

/**
 * TELA 3 — consumo energético. Ainda não construída.
 * Por enquanto só confirma que o perfil foi salvo e que a sessão está de pé.
 */
export default async function PaginaConsumo() {
  const leadId = await lerSessao();
  if (!leadId) redirect('/');

  return (
    <>
      <Passos atual={3} />

      <h1 className="mt-6 text-2xl font-bold text-stone-900">Perfil salvo</h1>
      <p className="mt-3 leading-relaxed text-stone-600">
        As perguntas sobre a conta de luz entram aqui no próximo passo do desenvolvimento.
      </p>
    </>
  );
}
