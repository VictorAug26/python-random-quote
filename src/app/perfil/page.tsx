import { redirect } from 'next/navigation';
import { lerSessao } from '@/lib/sessao';
import { buscarPerfil } from '@/lib/repositorio/perfis';
import { booleanosParaInstalacao } from '@/lib/dominio';
import { Passos } from '@/components/ui/Passos';
import { FormPerfil, type ValoresPerfil } from '@/components/formularios/FormPerfil';

export const dynamic = 'force-dynamic';

const VAZIO: ValoresPerfil = {
  atividades: [],
  atividadeOutro: '',
  equipamentos: [],
  instalacao: '',
};

/** TELA 2 — perfil da atividade. */
export default async function PaginaPerfil() {
  const leadId = await lerSessao();
  if (!leadId) redirect('/');

  // Quem volta para corrigir encontra o formulário como deixou.
  const salvo = await buscarPerfil(leadId);
  const iniciais: ValoresPerfil = salvo
    ? {
        atividades: salvo.atividades,
        atividadeOutro: salvo.atividadeOutro ?? '',
        equipamentos: salvo.equipamentos,
        instalacao: booleanosParaInstalacao(salvo.possuiSolar, salvo.possuiBess),
      }
    : VAZIO;

  return (
    <>
      <Passos atual={2} />

      <h1 className="mt-6 text-3xl font-bold leading-tight text-stone-900">
        Como é a sua propriedade?
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-stone-600">
        É o que define quanta energia dá para deslocar para o horário mais barato.
      </p>

      <div className="mt-8">
        <FormPerfil iniciais={iniciais} />
      </div>
    </>
  );
}
