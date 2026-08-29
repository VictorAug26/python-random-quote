import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { diagnosticoPertenceAoLead } from '@/lib/repositorio/diagnosticos';
import { hashIp, ipDaRequisicao, userAgentResumido } from '@/lib/privacidade';
import { TEXTO_CONSENTIMENTO, VERSAO_POLITICA } from '@/lib/consentimento';
import { lerSessao } from '@/lib/sessao';
import { respostaDeFalha } from '@/lib/resposta';

const esquema = z.object({
  token: z.string().uuid(),
  consenteParceiro: z.boolean(),
});

/**
 * TELA 5 — botão "quero saber mais".
 *
 * Duas conferências antes de registrar qualquer coisa:
 *
 *  1. a sessão precisa ser a do dono daquele diagnóstico. O relatório é
 *     compartilhável, então quem recebe o link não pode pedir contato — nem
 *     dar consentimento — no lugar do produtor;
 *  2. o consentimento de compartilhamento precisa estar ativo. Se ele marcar
 *     a autorização agora, ela entra na mesma transação do interesse.
 */
export async function POST(requisicao: Request) {
  const leadId = await lerSessao();
  if (!leadId) {
    return NextResponse.json({ erro: 'sem_sessao' }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await requisicao.json();
  } catch {
    return NextResponse.json({ erro: 'corpo_invalido' }, { status: 400 });
  }

  const resultado = esquema.safeParse(corpo);
  if (!resultado.success) {
    return NextResponse.json({ erro: 'dados_invalidos' }, { status: 400 });
  }

  const { token, consenteParceiro } = resultado.data;

  try {
    const dono = await diagnosticoPertenceAoLead(token, leadId);
    if (!dono) {
      return NextResponse.json({ erro: 'nao_e_seu_diagnostico' }, { status: 403 });
    }

    const { error } = await supabaseServidor().rpc('registrar_interesse', {
      p_lead_id: leadId,
      p_diagnostico_id: dono.diagnosticoId,
      p_consente_parceiro: consenteParceiro,
      p_texto_parceiro: TEXTO_CONSENTIMENTO.compartilhamento_parceiro,
      p_versao_politica: VERSAO_POLITICA,
      p_ip_hash: hashIp(ipDaRequisicao(requisicao.headers)),
      p_user_agent: userAgentResumido(requisicao.headers),
    });

    if (error) {
      // A função recusa quando não há autorização de compartilhamento ativa.
      if (/autoriza/i.test(error.message)) {
        return NextResponse.json({ erro: 'falta_consentimento' }, { status: 400 });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (erro) {
    return respostaDeFalha('interesse', erro);
  }
}
