import { z } from "zod";
import { selecionarExercicios } from "./exercicios";

import type { Nivel } from "./trilha.shared";
export { NIVEIS, type Nivel } from "./trilha.shared";

export function rotuloNivel(nivel: Nivel) {
  return nivel === "iniciante"
    ? "iniciante absoluto"
    : nivel === "intermediario"
      ? "intermediário"
      : "avançado";
}

// --- Etapa 1: esqueleto da trilha (rápido, poucos tokens) ---

export const EsqueletoSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().min(1).max(1000),
  modulos: z.array(z.object({ titulo: z.string().trim().min(1).max(200), resumo: z.string().trim().min(1).max(2000),
    objetivos: z.array(z.string().trim().min(1).max(300)).min(2).max(3),
    pre_requisitos: z.array(z.string().trim().min(1).max(300)).max(6),
  })).length(6),
});

export type Esqueleto = z.infer<typeof EsqueletoSchema>;

export function promptEsqueleto(linguagem: string, nivel: Nivel, erroAnterior?: string) {
  return `Você é um professor especialista em ${linguagem}. Planeje uma trilha de estudos em PORTUGUÊS DO BRASIL para um aluno de nível ${rotuloNivel(nivel)}.

Regras:
- Exatamente 6 módulos, em ordem didática crescente.
- "titulo": curto. "resumo": uma frase dizendo o que o módulo ensina.
- Cada módulo tem 2–3 "objetivos" observáveis (o que o aluno conseguirá fazer) e "pre_requisitos" (array vazio se não houver).
- No primeiro módulo, explicite conhecimentos externos necessários. Nos seguintes, cite conceitos dos módulos anteriores pelo nome.
- ${orientacaoNivel(nivel)}
- Use títulos distintos. Evite repetir conteúdo e não antecipe conceitos que serão apresentados depois.
- Não escreva o conteúdo dos módulos agora.

Responda SOMENTE com JSON válido, sem texto antes ou depois:
{"titulo":"...","descricao":"...","modulos":[{"titulo":"...","resumo":"...","objetivos":["...","..."],"pre_requisitos":[]}]}${
    erroAnterior ? `\n\nATENÇÃO: a resposta anterior foi rejeitada (${erroAnterior}). Devolva apenas o JSON completo e fechado.` : ""
  }`;
}

export function validarEsqueleto(e: Esqueleto) {
  if (!e.titulo.trim() || !e.descricao.trim()) throw new Error("título ou descrição vazios");
  if (e.modulos.length !== 6) throw new Error("Planeje seis módulos.");
  if (new Set(e.modulos.map(m => m.titulo.trim().toLocaleLowerCase("pt-BR"))).size !== 6) throw new Error("Títulos de módulos repetidos.");
  e.modulos.forEach((m, i) => {
    if (!m.titulo.trim()) throw new Error(`módulo ${i + 1} sem título`);
  });
}

// --- Etapa 2: conteúdo de um módulo por vez ---

// Unifica os dois títulos finais quando o modelo os separa, sem alterar código.
export function normalizarSecoes(conteudo: string) {
  const partes = conteudo.split(/(```[\s\S]*?```)/g);
  const titulos = partes.filter((_, i) => i % 2 === 0).join("").match(/^##\s+.+$/gm) ?? [];
  if (titulos.at(-2)?.trim() !== "## Erros comuns" || titulos.at(-1)?.trim() !== "## Resumo") return conteudo;
  return partes.map((parte, i) => i % 2 ? parte : parte
    .replace(/^## Erros comuns\s*$/gm, "## Erros comuns e resumo")
    .replace(/^## Resumo\s*$/gm, "### Resumo")).join("");
}

export const ModuloSchema = z.object({
  conteudo: z.string().min(150).max(16000).transform(normalizarSecoes),
  exercicios: z.array(z.unknown()).transform((values, ctx) => {
    try { return selecionarExercicios(values); }
    catch { ctx.addIssue({ code: "custom", message: "Exercícios objetivos incompletos." }); return z.NEVER; }
  }),
});

export type ModuloGerado = z.infer<typeof ModuloSchema>;

export function promptModulo(
  args: {
    linguagem: string;
    nivel: Nivel;
    tituloTrilha: string;
    tituloModulo: string;
    resumoModulo: string;
    posicao: number;
    total: number;
    plano: Esqueleto;
  },
  erroAnterior?: string,
) {
  return `Você é um professor especialista em ${args.linguagem}. Escreva o módulo ${args.posicao} de ${args.total} da trilha "${args.tituloTrilha}", para um aluno de nível ${rotuloNivel(args.nivel)}. Tudo em PORTUGUÊS DO BRASIL.

Módulo: "${args.tituloModulo}" — ${args.resumoModulo}
Planejamento completo aprovado (JSON): ${JSON.stringify(args.plano)}
Ensine somente o módulo ${args.posicao}. Retome brevemente pré-requisitos dos anteriores e não ensine antecipadamente os seguintes.

Regras:
- ${orientacaoNivel(args.nivel)}
- "conteudo": uma aula completa de aproximadamente 350–600 palavras, não uma lista de definições. Desenvolva conceitos, acompanhe cada etapa do exemplo e explique como resolver a prática guiada. Use seções de nível 2 nesta ordem: Objetivos, Pré-requisitos, Conceitos, Exemplo resolvido, Prática guiada, Erros comuns e resumo. Não separe a última seção em dois títulos.
- Apresente todos os objetivos e pré-requisitos do planejamento. Use pelo menos um bloco de código com linguagem indicada, dados definidos e uma explicação curta do resultado. A prática guiada deve usar variação do exemplo, sem revelar os gabaritos dos exercícios.
- Gere 3 exercícios alinhados aos objetivos: 2 "multipla_escolha" e 1 "previsao_saida". Se uma saída textual simples não for adequada ao conteúdo (HTML, CSS, JSX, comportamento visual ou consultas SELECT que retornam tabelas, mesmo uma coluna/linha), gere 3 de múltipla escolha. Decida pelo conteúdo do módulo: JavaScript puro dentro de React pode ter saída textual, mas não preveja a estrutura interna de elementos JSX nem o ciclo de renderização.
- Múltipla escolha: "alternativas" é array com quatro objetos {"id":"a|b|c|d","texto":"..."}, IDs a,b,c,d distintos e textos distintos. Uma única opção correta, indicada pelo ID em "resposta_esperada". Evite "todas/nenhuma das anteriores", referências a letras e opções que dependem da ordem: serão embaralhadas.
- Previsão: "alternativas": null. "pergunta" pede a saída exata de uma linha (até 120 caracteres); envie o trecho curto no campo "codigo" (sem cercas Markdown) e a linguagem no campo "linguagem_codigo", como "python" ou "javascript". O servidor monta o bloco de código. Dados definidos, sem rede, horário, aleatoriedade, arredondamento dependente do ambiente, tabelas ou saída multilinha. Preserve espaços relevantes e não inclua aspas explicativas no gabarito.
- "dica": pista breve sem entregar o gabarito. "explicacao": explicação curta e verificável da solução, descrevendo o resultado ou por que a alternativa é correta. Não há execução de código nem avaliação de respostas dissertativas.
- Dentro das strings JSON use \\n para quebras de linha.

Responda SOMENTE com JSON válido, sem texto antes ou depois:
{"conteudo":"...","exercicios":[{"tipo":"multipla_escolha","pergunta":"...","alternativas":[{"id":"a","texto":"..."},{"id":"b","texto":"..."},{"id":"c","texto":"..."},{"id":"d","texto":"..."}],"resposta_esperada":"a","dica":"...","explicacao":"..."}]}${
    erroAnterior ? `\n\nATENÇÃO: a resposta anterior foi rejeitada (${erroAnterior}). Devolva apenas o JSON completo e fechado.` : ""
  }`;
}

export function validarModulo(m: ModuloGerado) {
  if (m.conteudo.trim().length < 150) throw new Error("conteúdo muito curto");
  const secoes = ["Objetivos", "Pré-requisitos", "Conceitos", "Exemplo resolvido", "Prática guiada", "Erros comuns e resumo"];
  const semCodigo = m.conteudo.replace(/```[\s\S]*?```/g, "");
  const titulos = [...semCodigo.matchAll(/^##\s+(.+?)\s*$/gm)].map(match => match[1]);
  if (secoes.some((titulo, i) => titulos[i] !== titulo)) throw new Error("Seções didáticas ausentes ou fora de ordem.");
  if (!/```[^\n]+\n[\s\S]+?\n```/.test(m.conteudo)) throw new Error("Exemplo de código ausente.");
  if (m.exercicios.length !== 3) throw new Error("São necessários três exercícios.");
  if (new Set(m.exercicios.map(ex => ex.pergunta.trim().toLowerCase())).size !== 3) throw new Error("Exercícios repetidos.");
  m.exercicios.forEach((ex, j) => {
    if (!ex.pergunta.trim() || !ex.resposta_esperada.trim())
      throw new Error(`exercício ${j + 1} incompleto`);
  });
}

export function orientacaoNivel(nivel: Nivel) {
  return nivel === "iniciante"
    ? "Iniciante: não presuma experiência; explique termos, acompanhe exemplos passo a passo e proponha pequenas aplicações."
    : nivel === "intermediario"
      ? "Intermediário: explicite a base necessária; combine conceitos, identifique bugs e aplique funcionalidades sem repetir uma introdução completa."
      : "Avançado: explicite a base necessária; analise casos extremos, limitações e alternativas com justificativas. Inclua exercícios sobre um caso extremo e uma escolha entre abordagens; não pergunte apenas nomes de comandos ou definições. A dificuldade vem do raciocínio, não de jargão ou texto maior.";
}

export function incluirObjetivosPlanejados(conteudo: string, modulo: Esqueleto["modulos"][number]) {
  const conceitos = conteudo.search(/^## Conceitos\s*$/m);
  if (conceitos < 0) throw new Error("Seção de conceitos ausente.");
  return `## Objetivos\n\n${modulo.objetivos.map(o => `- ${o}`).join("\n")}\n\n## Pré-requisitos\n\n${modulo.pre_requisitos.length ? modulo.pre_requisitos.map(p => `- ${p}`).join("\n") : "Nenhum conhecimento prévio específico."}\n\n${conteudo.slice(conceitos)}`;
}

// --- Parser tolerante a cercas de markdown / texto extra ---

export function extrairJson(text: string): unknown {
  let raw = text.trim();
  // O conteúdo do módulo contém cercas de código dentro das strings JSON.
  // Parsear primeiro impede confundi-las com uma cerca ao redor da resposta.
  try {
    return JSON.parse(raw);
  } catch {
    // Aceita também uma resposta envolvida em Markdown ou texto extra.
  }
  const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fence?.[1]) raw = fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("resposta sem JSON");
  if (start > 0 || end < raw.length - 1) raw = raw.slice(start, end + 1);
  return JSON.parse(raw);
}

