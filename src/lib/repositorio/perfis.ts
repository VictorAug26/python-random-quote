import 'server-only';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { Atividade, Equipamento } from '@/lib/dominio';
import { modoDemo } from '@/lib/demo/modo';
import { buscarPerfilDemo, salvarPerfilDemo } from '@/lib/demo/armazem';

/**
 * Acesso a dados do perfil da atividade (tela 2).
 *
 * A gravação passa pela função salvar_perfil_atividade, que confere o
 * consentimento antes de escrever. Ver supabase/migrations/0004.
 */

export type EntradaPerfil = {
  leadId: string;
  atividades: Atividade[];
  atividadeOutro?: string | undefined;
  equipamentos: Equipamento[];
  possuiSolar: boolean;
  possuiBess: boolean;
};

export async function salvarPerfil(entrada: EntradaPerfil): Promise<void> {
  if (modoDemo()) return salvarPerfilDemo(entrada);

  const { error } = await supabaseServidor().rpc('salvar_perfil_atividade', {
    p_lead_id: entrada.leadId,
    p_atividades: entrada.atividades,
    p_equipamentos: entrada.equipamentos,
    p_possui_solar: entrada.possuiSolar,
    p_possui_bess: entrada.possuiBess,
    p_atividade_outro: entrada.atividadeOutro ?? null,
  });

  if (error) {
    throw new Error(`Falha ao salvar o perfil: ${error.message}`);
  }
}

export type PerfilSalvo = {
  atividades: Atividade[];
  atividadeOutro: string | null;
  equipamentos: Equipamento[];
  possuiSolar: boolean;
  possuiBess: boolean;
};

/** Para reabrir a tela já preenchida quando o produtor volta para corrigir. */
export async function buscarPerfil(leadId: string): Promise<PerfilSalvo | null> {
  if (modoDemo()) return buscarPerfilDemo(leadId);

  const { data, error } = await supabaseServidor()
    .from('perfis_atividade')
    .select('atividades, atividade_outro, equipamentos, possui_solar, possui_bess')
    .eq('lead_id', leadId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao ler o perfil: ${error.message}`);
  }
  if (!data) return null;

  return {
    atividades: data.atividades as Atividade[],
    atividadeOutro: data.atividade_outro as string | null,
    equipamentos: data.equipamentos as Equipamento[],
    possuiSolar: data.possui_solar as boolean,
    possuiBess: data.possui_bess as boolean,
  };
}
