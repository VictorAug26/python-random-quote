import { NextResponse } from 'next/server';
import { esquemaPerfil, errosPorCampo } from '@/lib/validacao/schemas';
import { salvarPerfil } from '@/lib/repositorio/perfis';
import { instalacaoParaBooleanos } from '@/lib/dominio';
import { lerSessao } from '@/lib/sessao';
import { respostaDeFalha } from '@/lib/resposta';

/**
 * TELA 2 — perfil da atividade.
 *
 * Sem sessão válida não há o que gravar: o lead nasce na tela 1, e é o cookie
 * assinado que diz de quem é este formulário.
 */
export async function POST(requisicao: Request) {
  const leadId = await lerSessao();
  if (!leadId) {
    return NextResponse.json({ erro: 'sem_sessao', proximaEtapa: '/' }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await requisicao.json();
  } catch {
    return NextResponse.json({ erro: 'corpo_invalido' }, { status: 400 });
  }

  const resultado = esquemaPerfil.safeParse(corpo);
  if (!resultado.success) {
    return NextResponse.json(
      { erro: 'dados_invalidos', campos: errosPorCampo(resultado.error) },
      { status: 400 },
    );
  }

  const dados = resultado.data;
  const { possuiSolar, possuiBess } = instalacaoParaBooleanos(dados.instalacao);

  try {
    await salvarPerfil({
      leadId,
      atividades: dados.atividades,
      // Só faz sentido guardar a descrição se "outra atividade" foi marcada.
      atividadeOutro: dados.atividades.includes('outro') ? dados.atividadeOutro : undefined,
      equipamentos: dados.equipamentos,
      possuiSolar,
      possuiBess,
    });

    return NextResponse.json({ ok: true, proximaEtapa: '/consumo' });
  } catch (erro) {
    return respostaDeFalha('perfil', erro);
  }
}
