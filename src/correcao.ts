// Correção local (sem IA): compara a resposta do aluno com a resposta esperada
// por similaridade textual e monta um feedback avaliativo.
import { normalizarSaida, type TipoExercicio } from "./exercicios";

export type Resultado = "acertou" | "quase" | "errou";

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s+\-*/=<>._()[\]{}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(texto: string) {
  return new Set(normalizar(texto).split(" ").filter((t) => t.length > 1));
}

export function similaridade(resposta: string, esperada: string) {
  const a = normalizar(resposta);
  const b = normalizar(esperada);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const ta = tokens(resposta);
  const tb = tokens(esperada);
  if (tb.size === 0) return a.includes(b) || b.includes(a) ? 1 : 0;

  let comuns = 0;
  tb.forEach((t) => {
    if (ta.has(t)) comuns += 1;
  });
  const dice = (2 * comuns) / (ta.size + tb.size);
  const cobertura = comuns / tb.size;

  const bonus = a.includes(b) || b.includes(a) ? 0.35 : 0;
  return Math.min(1, Math.max(dice, cobertura * 0.9) + bonus);
}

export interface Correcao {
  resultado: Resultado;
  acertou: boolean;
  score: number;
  feedback: string;
}

export function corrigir(
  resposta: string,
  esperada: string,
  explicacao?: string | null,
): Correcao {
  const score = similaridade(resposta, esperada);
  const resultado: Resultado = score >= 0.75 ? "acertou" : score >= 0.45 ? "quase" : "errou";

  const faltando = [...tokens(esperada)].filter((t) => !tokens(resposta).has(t)).slice(0, 5);

  let feedback: string;
  if (resultado === "acertou") {
    feedback = "Correto. Sua resposta cobre o que era esperado.";
  } else if (resultado === "quase") {
    feedback = `Quase. Você chegou perto, mas faltou considerar: ${faltando.join(", ") || "alguns detalhes"}.`;
  } else {
    feedback = `Ainda não. Sua resposta não contempla o que o exercício pedia. Resposta esperada: ${esperada}`;
  }

  if (explicacao) feedback += `\n\n${explicacao}`;

  return { resultado, acertou: resultado === "acertou", score, feedback };
}

export function corrigirObjetivo(resposta: string, ex: {
  tipo: Exclude<TipoExercicio, "legado">; resposta_esperada: string;
  dica: string | null; explicacao: string | null;
}): Correcao {
  const acertou = ex.tipo === "multipla_escolha"
    ? /^[a-d]$/.test(resposta) && resposta === ex.resposta_esperada
    : normalizarSaida(resposta) === normalizarSaida(ex.resposta_esperada);
  return { acertou, resultado: acertou ? "acertou" : "errou", score: acertou ? 1 : 0,
    feedback: acertou ? `Correto.${ex.explicacao ? `\n\n${ex.explicacao}` : ""}`
      : `Ainda não. Revise o exemplo e tente novamente.${ex.dica ? `\n\nDica: ${ex.dica}` : ""}` };
}

