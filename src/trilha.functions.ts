import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { NIVEIS } from "./trilha.shared";
import type { ModuloGerado } from "./trilha.server";
import { ModuloSchema, promptModulo, validarModulo, incluirObjetivosPlanejados } from "./trilha.server";
import { gerarJsonGemini, moduloJsonSchema } from "./gemini.server";
import { reservarModulo } from "./trilha-quota.server";
import { consultarLimites, planejarTrilha, POLITICA_PROGRAMACAO } from "./trilha-planejamento.server";
import { verificarPlano } from "./trilha-autorizacao.server";

export const consultarLimiteDiario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => consultarLimites(context.supabase));

export const gerarEsqueleto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ linguagem: z.string().trim().min(1).max(80), nivel: z.enum(NIVEIS) }).parse(input),
  )
  .handler(({ data, context }) => planejarTrilha(context.supabase, context.userId, data));

export const gerarModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      geracaoId: z.string().uuid(),
      autorizacao: z.string().min(1).max(120_000),
      posicao: z.number().int().min(1).max(6),
    }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ModuloGerado> => {
    const aprovado = verificarPlano(data.autorizacao, context.userId, data.geracaoId);
    const modulo = aprovado.plano.modulos[data.posicao - 1];
    if (!modulo) throw new Error("Módulo ausente no plano aprovado.");
    await reservarModulo(context.supabase, data.geracaoId, data.posicao);
    const resultado = await gerarJsonGemini({
      systemInstruction: POLITICA_PROGRAMACAO,
      prompt: erro => promptModulo({
        linguagem: aprovado.linguagem, nivel: aprovado.nivel,
        tituloTrilha: aprovado.plano.titulo, tituloModulo: modulo.titulo,
        resumoModulo: modulo.resumo, posicao: data.posicao, total: aprovado.plano.modulos.length,
        plano: aprovado.plano,
      }, erro),
      schema: ModuloSchema, validar: validarModulo, responseSchema: moduloJsonSchema,
    });
    return { ...resultado, conteudo: incluirObjetivosPlanejados(resultado.conteudo, modulo) };
  });
