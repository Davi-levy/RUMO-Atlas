import { z } from "zod";
import { extrairJson } from "./trilha.server";

const ResponseSchema = z.object({
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z.array(z.object({
    finishReason: z.string().optional(),
    content: z.object({ parts: z.array(z.object({
      text: z.string().optional(), thought: z.boolean().optional(),
    })) }).optional(),
  })).optional(),
});

export async function gerarJsonGemini<T>(options: {
  prompt: (erroAnterior?: string) => string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  validar: (value: T) => void;
  responseSchema: Record<string, unknown>;
  systemInstruction?: string;
  maxAttempts?: 1 | 2;
}) {
  const key = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
  if (!key) throw new Error("Configure GEMINI_API_KEY no servidor para gerar trilhas.");
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error("GEMINI_MODEL inválido.");

  let erroAnterior: string | undefined;
  // O prazo cobre as duas tentativas e a leitura do corpo, não apenas os headers.
  const signal = AbortSignal.timeout(90_000);
  const maxAttempts = options.maxAttempts ?? 2;
  for (let tentativa = 0; tentativa < maxAttempts; tentativa++) {
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        signal,
        body: JSON.stringify({
          ...(options.systemInstruction ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } } : {}),
          contents: [{ role: "user", parts: [{ text: options.prompt(erroAnterior) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: options.responseSchema,
            maxOutputTokens: 8192,
            ...(model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: "LOW" } } : {}),
          },
        }),
      });
    } catch {
      throw new Error("Não foi possível conectar ao Gemini ou o tempo de espera terminou. Tente novamente.");
    }

    // Nunca repassa o corpo de erros do provedor: pode conter informações sensíveis.
    if (!response.ok) {
      if (tentativa + 1 < maxAttempts && (response.status === 408 || response.status >= 500)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      if (response.status === 429) throw new Error("Limite de uso do Gemini atingido. Aguarde e verifique a cota da API.");
      if (response.status === 401 || response.status === 403) throw new Error("O Gemini recusou o acesso. Verifique a chave e as permissões no servidor.");
      if (response.status === 404) throw new Error("Modelo Gemini indisponível. Verifique GEMINI_MODEL no servidor.");
      throw new Error(`O Gemini não conseguiu gerar o conteúdo (HTTP ${response.status}). Tente novamente.`);
    }

    let result: z.infer<typeof ResponseSchema>;
    try {
      result = ResponseSchema.parse(await response.json());
    } catch {
      throw new Error("O Gemini retornou uma resposta inesperada. Tente novamente.");
    }
    const candidate = result.candidates?.[0];
    if (result.promptFeedback?.blockReason || (candidate?.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason))) {
      throw new Error("O Gemini não pôde gerar esse conteúdo. Tente outro tema.");
    }

    try {
      if (candidate?.finishReason === "MAX_TOKENS") throw new Error("Resposta incompleta");
      const text = candidate?.content?.parts.filter(p => !p.thought).map(p => p.text ?? "").join("") ?? "";
      const value = options.schema.parse(extrairJson(text));
      options.validar(value);
      return value;
    } catch {
      // Uma única nova tentativa para JSON incompleto ou conteúdo inválido.
      erroAnterior = "JSON incompleto ou conteúdo fora do formato solicitado";
    }
  }
  throw new Error(maxAttempts === 1
    ? "O Gemini não retornou um planejamento válido. Tente novamente."
    : "O Gemini não retornou conteúdo válido após duas tentativas. Tente novamente.");
}

const string = { type: "string" };
const alternativaJsonSchema = { type: "object", properties: { id: { type: "string", enum: ["a", "b", "c", "d"] }, texto: string }, required: ["id", "texto"] };
const exercicioBase = { pergunta: string, resposta_esperada: string, dica: string, explicacao: string };
const exercicioRequired = ["tipo", "pergunta", "resposta_esperada", "dica", "explicacao", "alternativas"];
export const esqueletoJsonSchema = {
  type: "object",
  properties: {
    titulo: string, descricao: string,
    modulos: { type: "array", minItems: 6, maxItems: 6, items: {
      type: "object", properties: { titulo: string, resumo: string,
        objetivos: { type: "array", minItems: 2, maxItems: 3, items: string },
        pre_requisitos: { type: "array", maxItems: 6, items: string },
      }, required: ["titulo", "resumo", "objetivos", "pre_requisitos"],
    } },
  },
  required: ["titulo", "descricao", "modulos"],
};

export const moduloJsonSchema = {
  type: "object",
  properties: {
    conteudo: { type: "string", description: "Aula completa em Markdown, com 350 a 600 palavras. Desenvolva conceitos e explique cada etapa do exemplo resolvido e da prática guiada. Seções: ## Objetivos, ## Pré-requisitos, ## Conceitos, ## Exemplo resolvido, ## Prática guiada, ## Erros comuns e resumo." },
    exercicios: { type: "array", minItems: 3, items: { anyOf: [
      { type: "object", properties: { ...exercicioBase, tipo: { type: "string", enum: ["multipla_escolha"] },
        alternativas: { type: "array", minItems: 4, maxItems: 4, items: alternativaJsonSchema } }, required: exercicioRequired },
      { type: "object", properties: { ...exercicioBase, tipo: { type: "string", enum: ["previsao_saida"] },
        alternativas: { type: "null" }, codigo: string, linguagem_codigo: string }, required: [...exercicioRequired, "codigo", "linguagem_codigo"] },
    ] } },
  },
  required: ["conteudo", "exercicios"],
};
