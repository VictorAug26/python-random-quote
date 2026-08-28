import 'server-only';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type {
  Confianca,
  Diagnostico,
  DiagnosticoExibivel,
  EntradasMotor,
} from '@/lib/motor/tipos';

/** Acesso a dados do diagnóstico (telas 4 e 5). Ver supabase/migrations/0006. */

export async function registrarDiagnostico(
  leadId: string,
  diagnostico: Diagnostico,
  entradas: EntradasMotor,
): Promise<string> {
  const { data, error } = await supabaseServidor().rpc('registrar_diagnostico', {
    p_lead_id: leadId,
    p_motor_versao: diagnostico.motorVersao,
    p_economia_mensal_reais: diagnostico.economiaMensalReais,
    p_economia_min_reais: diagnostico.economiaMinReais,
    p_economia_max_reais: diagnostico.economiaMaxReais,
    p_economia_percentual: diagnostico.economiaPercentual,
    p_bess_capacidade_kwh: diagnostico.bessCapacidadeKwh,
    p_bess_potencia_kw: diagnostico.bessPotenciaKw,
    p_investimento_estimado_reais: diagnostico.investimentoEstimadoReais,
    p_payback_meses: diagnostico.paybackMeses,
    p_confianca: diagnostico.confianca,
    p_entradas: entradas,
    // A flag vai junto dos detalhes para a view pública poder expô-la sem
    // precisar das entradas, que carregam consumo e valor da fatura.
    p_detalhes: {
      ...diagnostico.detalhes,
      recomendaRevisarTarifa: diagnostico.recomendaRevisarTarifa,
    },
  });

  if (error) throw new Error(`Falha ao gravar o diagnóstico: ${error.message}`);
  if (typeof data !== 'string') {
    throw new Error('Falha ao gravar o diagnóstico: o banco não devolveu o token.');
  }

  return data;
}

/** Só os números — é o que a página compartilhável pode mostrar. */
export type DiagnosticoPublico = DiagnosticoExibivel;

export async function buscarDiagnosticoPublico(
  token: string,
): Promise<DiagnosticoPublico | null> {
  const { data, error } = await supabaseServidor()
    .from('diagnosticos_publicos')
    .select('*')
    .eq('token_publico', token)
    .maybeSingle();

  if (error) throw new Error(`Falha ao ler o diagnóstico: ${error.message}`);
  if (!data) return null;

  return {
    economiaMensalReais: Number(data.economia_mensal_reais),
    economiaMinReais: Number(data.economia_min_reais),
    economiaMaxReais: Number(data.economia_max_reais),
    economiaPercentual: Number(data.economia_percentual),
    bessCapacidadeKwh: Number(data.bess_capacidade_kwh),
    bessPotenciaKw: Number(data.bess_potencia_kw),
    investimentoEstimadoReais: Number(data.investimento_estimado_reais),
    paybackMeses: data.payback_meses === null ? null : Number(data.payback_meses),
    confianca: data.confianca as Confianca,
    recomendaRevisarTarifa: Boolean(data.recomenda_revisar_tarifa),
  };
}

/**
 * O relatório é compartilhável, mas o botão "quero saber mais" não pode ser.
 * Quem recebe o link vê os números; só o dono da sessão pede contato — senão
 * qualquer um com o link registraria interesse (e consentimento) no lugar
 * do produtor.
 */
export async function diagnosticoPertenceAoLead(
  token: string,
  leadId: string,
): Promise<{ diagnosticoId: string } | null> {
  const { data, error } = await supabaseServidor()
    .from('diagnosticos')
    .select('id')
    .eq('token_publico', token)
    .eq('lead_id', leadId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao conferir o diagnóstico: ${error.message}`);
  return data ? { diagnosticoId: data.id as string } : null;
}
