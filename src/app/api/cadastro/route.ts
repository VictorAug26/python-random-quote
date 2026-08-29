import { NextResponse } from 'next/server';
import { esquemaCadastro, errosPorCampo } from '@/lib/validacao/schemas';
import { registrarCadastro } from '@/lib/repositorio/leads';
import { hashIp, ipDaRequisicao, userAgentResumido } from '@/lib/privacidade';
import { definirSessao } from '@/lib/sessao';
import { respostaDeFalha } from '@/lib/resposta';

/**
 * TELA 1 — cadastro rápido.
 *
 * Valida de novo no servidor (a validação do navegador é conveniência, não
 * garantia), grava lead + consentimentos numa transação só e devolve o
 * cookie de sessão que liga esta tela às próximas.
 */
export async function POST(requisicao: Request) {
  let corpo: unknown;
  try {
    corpo = await requisicao.json();
  } catch {
    return NextResponse.json({ erro: 'corpo_invalido' }, { status: 400 });
  }

  const resultado = esquemaCadastro.safeParse(corpo);
  if (!resultado.success) {
    return NextResponse.json(
      { erro: 'dados_invalidos', campos: errosPorCampo(resultado.error) },
      { status: 400 },
    );
  }

  const dados = resultado.data;

  try {
    const leadId = await registrarCadastro({
      nome: dados.nome,
      whatsapp: dados.whatsapp,
      nomePropriedade: dados.nomePropriedade,
      municipio: dados.municipio,
      consenteDiagnostico: dados.consenteDiagnostico,
      consenteParceiro: dados.consenteParceiro,
      origem: dados.origem,
      ipHash: hashIp(ipDaRequisicao(requisicao.headers)),
      userAgent: userAgentResumido(requisicao.headers),
    });

    await definirSessao(leadId);

    return NextResponse.json({ ok: true, proximaEtapa: '/perfil' }, { status: 201 });
  } catch (erro) {
    return respostaDeFalha('cadastro', erro);
  }
}
