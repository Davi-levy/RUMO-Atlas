export const NIVEIS = ["iniciante", "intermediario", "avancado"] as const;
export type Nivel = (typeof NIVEIS)[number];

export const MENSAGEM_LIMITE_AVALIACOES = "Você atingiu o limite diário de 5 avaliações de tema.";
export const MENSAGEM_TEMA_RECUSADO = "O tema solicitado está fora do escopo de programação e desenvolvimento.";
