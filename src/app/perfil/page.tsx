import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import { Passos } from '@/components/ui/Passos';

export const dynamic = 'force-dynamic';

/**
 * TELA 2 — perfil da atividade. Ainda não construída.
 *
 * Por enquanto só confirma que o cadastro foi salvo e que a sessão está de pé:
 * sem cookie válido, volta para o começo.
 */
export default async function PaginaPerfil() {
  const leadId = await lerSessao();
  if (!leadId) redirect('/');

  return (
    <>
      <Passos atual={2} />

      <h1 className="mt-6 text-2xl font-bold text-stone-900">Cadastro salvo</h1>
      <p className="mt-3 leading-relaxed text-stone-600">
        As perguntas sobre a atividade da fazenda entram aqui no próximo passo do
        desenvolvimento.
      </p>
    </>
  );
}
