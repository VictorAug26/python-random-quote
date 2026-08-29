import 'server-only';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { ClasseTarifaria } from '@/lib/dominio';
import { modoDemo } from '@/lib/demo/modo';
import { buscarConsumoDemo, salvarConsumoDemo } from '@/lib/demo/armazem';

/**
 * Acesso a dados do consumo energético (tela 3).
 * A gravação passa por salvar_consumo_energia. Ver supabase/migrations/0005.
 */

export type EntradaConsumo = {
  leadId: string;
  valorFaturaReais: number;
  consumoKwh: number | null;
  classeTarifaria: ClasseTarifaria;
  demandaContratadaKw: number | null;
};

export async function salvarConsumo(entrada: EntradaConsumo): Promise<void> {
  if (modoDemo()) return salvarConsumoDemo(entrada);

  const { error } = await supabaseServidor().rpc('salvar_consumo_energia', {
    p_lead_id: entrada.leadId,
    p_valor_fatura_reais: entrada.valorFaturaReais,
    p_classe_tarifaria: entrada.classeTarifaria,
    p_consumo_kwh: entrada.consumoKwh,
    p_demanda_contratada_kw: entrada.demandaContratadaKw,
  });

  if (error) {
    throw new Error(`Falha ao salvar o consumo: ${error.message}`);
  }
}

export type ConsumoSalvo = {
  valorFaturaReais: number;
  consumoKwh: number | null;
  classeTarifaria: ClasseTarifaria;
  demandaContratadaKw: number | null;
};

/** Para reabrir a tela já preenchida quando o produtor volta para corrigir. */
export async function buscarConsumo(leadId: string): Promise<ConsumoSalvo | null> {
  if (modoDemo()) return buscarConsumoDemo(leadId);

  const { data, error } = await supabaseServidor()
    .from('consumos_energia')
    .select('valor_fatura_reais, consumo_kwh, classe_tarifaria, demanda_contratada_kw')
    .eq('lead_id', leadId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao ler o consumo: ${error.message}`);
  }
  if (!data) return null;

  return {
    valorFaturaReais: Number(data.valor_fatura_reais),
    consumoKwh: data.consumo_kwh === null ? null : Number(data.consumo_kwh),
    classeTarifaria: data.classe_tarifaria as ClasseTarifaria,
    demandaContratadaKw:
      data.demanda_contratada_kw === null ? null : Number(data.demanda_contratada_kw),
  };
}
