import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/**
 * TELA 5 — relatório. Ainda não construída.
 *
 * Quando o motor (tela 4) entrar, /api/consumo vai calcular o diagnóstico e
 * mandar o produtor direto para /relatorio/[token], com o token público.
 */
export default async function PaginaRelatorio() {
  const leadId = await lerSessao();
  if (!leadId) redirect('/');

  return (
    <>
      <h1 className="mt-6 text-2xl font-bold text-stone-900">Respostas salvas</h1>
      <p className="mt-3 leading-relaxed text-stone-600">
        O cálculo da economia e o relatório entram aqui no próximo passo do desenvolvimento.
      </p>
    </>
  );
}
