import { z } from "zod";

export const TIPOS_EXERCICIO = ["legado", "multipla_escolha", "previsao_saida"] as const;
export type TipoExercicio = typeof TIPOS_EXERCICIO[number];
const texto = z.string().trim().min(1);
export const AlternativaSchema = z.object({ id: z.enum(["a", "b", "c", "d"]), texto: texto.max(1000) });
export type Alternativa = z.infer<typeof AlternativaSchema>;

export function normalizarSaida(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/[\t ]+$/gm, "").replace(/^\n+|\n+$/g, "");
}

const base = { pergunta: texto.max(6000), dica: texto.max(1000), explicacao: texto.max(2000) };

function previsaoTextualSimples(ex: { pergunta: string; codigo?: string; linguagem_codigo?: string }) {
  const bloco = ex.pergunta.match(/```([^\n]+)\n([\s\S]+?)\n```/);
  const linguagem = (ex.linguagem_codigo ?? bloco?.[1] ?? "").trim().toLowerCase();
  const codigo = ex.codigo ?? bloco?.[2] ?? "";
  // Filtros de conteúdo evidente, não execução ou prova do gabarito.
  if (["html", "css", "jsx", "tsx"].includes(linguagem)) return false;
  if (linguagem === "sql" && /\b(?:select|with)\b/i.test(codigo)) return false;
  if (/(?:=>|return)\s*<[a-zA-Z]/.test(codigo)) return false;
  return Boolean(linguagem && codigo);
}
export const ExercicioNovoSchema = z.discriminatedUnion("tipo", [
  z.object({ ...base, tipo: z.literal("multipla_escolha"), alternativas: z.array(AlternativaSchema).length(4),
    resposta_esperada: z.enum(["a", "b", "c", "d"]) }),
  z.object({ ...base, tipo: z.literal("previsao_saida"), alternativas: z.null(),
    codigo: texto.max(3000).optional(), linguagem_codigo: z.string().regex(/^[a-zA-Z0-9+#.-]+$/).max(40).optional(),
    resposta_esperada: z.string().transform(normalizarSaida).pipe(z.string().min(1).max(120)) }),
]).superRefine((ex, ctx) => {
  if (ex.tipo === "multipla_escolha") {
    const ids = new Set(ex.alternativas.map(a => a.id));
    const texts = new Set(ex.alternativas.map(a => a.texto.toLocaleLowerCase("pt-BR")));
    if (ids.size !== 4 || texts.size !== 4) ctx.addIssue({ code: "custom", message: "Alternativas repetidas." });
  } else if (ex.resposta_esperada.includes("\n") || !previsaoTextualSimples(ex)) {
    ctx.addIssue({ code: "custom", message: "Previsão exige código e saída de uma linha." });
  }
}).transform(ex => ex.tipo === "previsao_saida" && ex.codigo && ex.linguagem_codigo && !ex.pergunta.includes("```")
  ? { ...ex, pergunta: `${ex.pergunta}\n\n\`\`\`${ex.linguagem_codigo}\n${ex.codigo}\n\`\`\`` } : ex);
export type ExercicioNovo = z.infer<typeof ExercicioNovoSchema>;

export function selecionarExercicios(values: unknown[]): ExercicioNovo[] {
  const validos = values.flatMap(value => {
    const result = ExercicioNovoSchema.safeParse(value);
    return result.success ? [result.data] : [];
  });
  const escolhas = validos.filter(ex => ex.tipo === "multipla_escolha");
  const saida = validos.find(ex => ex.tipo === "previsao_saida");
  if (escolhas.length < 2 || (!saida && escolhas.length < 3)) throw new Error("São necessários três exercícios válidos.");
  return [escolhas[0], escolhas[1], saida ?? escolhas[2]];
}

export function embaralharAlternativas(alternativas: readonly Alternativa[], random = Math.random): Alternativa[] {
  const ordem = alternativas.map(a => ({ ...a }));
  for (let i = ordem.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }
  return ordem;
}
