import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { envObrigatoria } from '@/lib/config';

/**
 * Cliente Supabase com service role. SÓ SERVIDOR.
 *
 * O import 'server-only' no topo faz o build falhar se algum componente de
 * cliente importar este arquivo por engano — a chave nunca chega ao navegador.
 * É por isso que o projeto não tem chave anônima: o navegador não fala com o
 * banco, ponto.
 */

let cliente: SupabaseClient | null = null;

export function supabaseServidor(): SupabaseClient {
  if (cliente) return cliente;

  cliente = createClient(envObrigatoria('SUPABASE_URL'), envObrigatoria('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      // Nada de sessão de usuário: cada requisição é isolada.
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cliente;
}
