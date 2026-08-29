import { NextResponse } from 'next/server';
import { esquemaConsumo, errosPorCampo } from '@/lib/validacao/schemas';
import { salvarConsumo } from '@/lib/repositorio/consumos';
import { buscarPerfil } from '@/lib/repositorio/perfis';
import { registrarDiagnostico } from '@/lib/repositorio/diagnosticos';
import { calcularDiagnostico } from '@/lib/motor/calcular';
import type { EntradasMotor } from '@/lib/motor/tipos';
import { lerSessao } from '@/lib/sessao';
import { respostaDeFalha } from '@/lib/resposta';

/**
 * TELA 3 — consumo energético, e TELA 4 — o motor.
 *
 * Grava o consumo, junta com o perfil da tela 2, roda o motor de regras e
 * grava o diagnóstico. Devolve o endereço do relatório, com o token público.
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
      demandaContratadaKw: dados.demandaContratadaKw,
    });

    // Sem o perfil não há o que calcular: falta metade das entradas.
    const perfil = await buscarPerfil(leadId);
    if (!perfil) {
      return NextResponse.json({ erro: 'perfil_ausente', proximaEtapa: '/perfil' }, { status: 409 });
    }

    const entradas: EntradasMotor = {
      atividades: perfil.atividades,
      equipamentos: perfil.equipamentos,
      possuiSolar: perfil.possuiSolar,
      possuiBess: perfil.possuiBess,
      valorFaturaReais: dados.valorFaturaReais,
      consumoKwh: dados.consumoKwh,
      classeTarifaria: dados.classeTarifaria,
      // Só o Grupo A cobra demanda; nas outras tarifas o motor ignora.
      demandaContratadaKw:
        dados.classeTarifaria === 'grupo_a' ? dados.demandaContratadaKw : null,
    };

    const diagnostico = calcularDiagnostico(entradas);
    const token = await registrarDiagnostico(leadId, diagnostico, entradas);

    return NextResponse.json({ ok: true, proximaEtapa: `/relatorio/${token}` });
  } catch (erro) {
    return respostaDeFalha('consumo', erro);
  }
}
