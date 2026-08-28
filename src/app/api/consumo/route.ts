import { NextResponse } from 'next/server';
import { esquemaConsumo, errosPorCampo } from '@/lib/validacao/schemas';
import { salvarConsumo } from '@/lib/repositorio/consumos';
import { lerSessao } from '@/lib/sessao';

/**
 * TELA 3 — consumo energético.
 *
 * Quando o motor de diagnóstico entrar (tela 4), é daqui que ele será
 * chamado: grava o consumo, calcula, e devolve o endereço do relatório.
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

  const resultado = esquemaConsumo.safeParse(corpo);
  if (!resultado.success) {
    return NextResponse.json(
      { erro: 'dados_invalidos', campos: errosPorCampo(resultado.error) },
      { status: 400 },
    );
  }

  const dados = resultado.data;

  try {
    await salvarConsumo({
      leadId,
      valorFaturaReais: dados.valorFaturaReais,
      consumoKwh: dados.consumoKwh,
      classeTarifaria: dados.classeTarifaria,
    });

    return NextResponse.json({ ok: true, proximaEtapa: '/relatorio' });
  } catch (erro) {
    console.error('[consumo] falha ao salvar', erro);
    return NextResponse.json({ erro: 'falha_interna' }, { status: 500 });
  }
}
