import type { Esqueleto, ModuloGerado } from "./trilha.server";
import type { Nivel } from "./trilha.shared";

type Tema = { linguagem: string; nivel: Nivel };
type PedidoModulo = Tema & {
  geracaoId: string;
  autorizacao: string;
  tituloTrilha: string; tituloModulo: string; resumoModulo: string; posicao: number; total: number;
};
export type ConteudoTrilha = {
  esqueleto: Esqueleto;
  modulos: { titulo: string; gerado: ModuloGerado }[];
};

async function aguardar<T>(operation: () => Promise<T>, signal: AbortSignal, titulo: string) {
  signal.throwIfAborted();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: () => void = () => {};
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`A geração de ${titulo} demorou demais. Tente novamente.`)), 100_000);
        abort = () => reject(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

export async function executarGeracaoTrilha(tema: Tema, options: {
  signal: AbortSignal;
  gerarEsqueleto: (tema: Tema) => Promise<Esqueleto & { geracaoId: string; autorizacao: string }>;
  gerarModulo: (pedido: PedidoModulo) => Promise<ModuloGerado>;
  salvar: (conteudo: ConteudoTrilha) => Promise<string>;
  onPlano: (plano: Esqueleto) => void;
  onModulo: (indice: number) => void;
}) {
  const esqueleto = await aguardar(() => options.gerarEsqueleto(tema), options.signal, "planejamento");
  options.signal.throwIfAborted();
  options.onPlano(esqueleto);
  const modulos: ConteudoTrilha["modulos"] = [];
  for (const [i, plano] of esqueleto.modulos.entries()) {
    const gerado = await aguardar(() => options.gerarModulo({
      geracaoId: esqueleto.geracaoId,
      autorizacao: esqueleto.autorizacao,
      ...tema, tituloTrilha: esqueleto.titulo, tituloModulo: plano.titulo,
      resumoModulo: plano.resumo, posicao: i + 1, total: esqueleto.modulos.length,
    }), options.signal, plano.titulo);
    options.signal.throwIfAborted();
    modulos.push({ titulo: plano.titulo, gerado });
    options.onModulo(i);
  }
  options.signal.throwIfAborted();
  // Nenhuma trilha é gravada enquanto o Gemini ainda está escrevendo os módulos.
  return options.salvar({ esqueleto, modulos });
}
