import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { MENSAGEM_LIMITE_DIARIO } from "./trilha-limite";

export async function reservarGeracao(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.rpc("reservar_geracao_trilha");
  if (error?.code === "P0001") {
    throw new Error(MENSAGEM_LIMITE_DIARIO);
  }
  if (error || !data) throw new Error("Não foi possível verificar seu limite diário. Tente novamente.");
  return data;
}

export async function reservarModulo(supabase: SupabaseClient<Database>, geracaoId: string, posicao: number) {
  const { error } = await supabase.from("geracoes_modulos").insert({ geracao_id: geracaoId, posicao });
  if (error?.code === "23505") throw new Error("Este módulo já foi solicitado nesta geração.");
  if (error) throw new Error("Geração inválida ou expirada. Inicie uma nova trilha respeitando o limite diário.");
}
