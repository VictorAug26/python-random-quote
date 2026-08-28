import 'server-only';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { TEXTO_CONSENTIMENTO, VERSAO_POLITICA } from '@/lib/consentimento';

/**
 * Acesso a dados do cadastro (tela 1).
 *
 * Tudo passa pela função registrar_cadastro do banco, que grava o lead e os
 * dois consentimentos na mesma transação. Ver supabase/migrations/0003.
 */

export type EntradaCadastro = {
  nome: string;
  whatsapp: string;
  nomePropriedade: string;
  municipio: string;
  consenteDiagnostico: boolean;
  consenteParceiro: boolean;
  origem?: string | undefined;
  ipHash: string | null;
  userAgent: string | null;
};

export async function registrarCadastro(entrada: EntradaCadastro): Promise<string> {
  const { data, error } = await supabaseServidor().rpc('registrar_cadastro', {
    p_nome: entrada.nome,
    p_whatsapp: entrada.whatsapp,
    p_nome_propriedade: entrada.nomePropriedade,
    p_municipio: entrada.municipio,
    p_versao_politica: VERSAO_POLITICA,
    p_consente_diagnostico: entrada.consenteDiagnostico,
    p_texto_diagnostico: TEXTO_CONSENTIMENTO.diagnostico,
    p_consente_parceiro: entrada.consenteParceiro,
    p_texto_parceiro: TEXTO_CONSENTIMENTO.compartilhamento_parceiro,
    p_uf: 'MG',
    p_origem: entrada.origem ?? null,
    p_ip_hash: entrada.ipHash,
    p_user_agent: entrada.userAgent,
  });

  if (error) {
    throw new Error(`Falha ao registrar cadastro: ${error.message}`);
  }
  if (typeof data !== 'string') {
    throw new Error('Falha ao registrar cadastro: o banco não devolveu o id do lead.');
  }

  return data;
}
