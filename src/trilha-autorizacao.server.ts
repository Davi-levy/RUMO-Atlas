import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { EsqueletoSchema, type Esqueleto } from "./trilha.server";
import { NIVEIS, type Nivel } from "./trilha.shared";

const AutorizacaoSchema = z.object({
  usuarioId: z.string().uuid(), geracaoId: z.string().uuid(),
  linguagem: z.string().trim().min(1).max(80), nivel: z.enum(NIVEIS),
  plano: EsqueletoSchema, expiraEm: z.number().int(),
});

export function segredoGeracao() {
  const segredo = process.env.TRILHA_GENERATION_SECRET?.trim();
  if (!segredo || segredo.length < 32) throw new Error("Configure TRILHA_GENERATION_SECRET no servidor (mínimo 32 caracteres).");
  return segredo;
}

export function assinarPlano(data: { usuarioId: string; geracaoId: string; linguagem: string; nivel: Nivel; plano: Esqueleto }, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ ...data, expiraEm: now + 60 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", segredoGeracao()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verificarPlano(token: string, usuarioId: string, geracaoId: string, now = Date.now()) {
  const segredo = segredoGeracao();
  try {
    const [payload, signature, extra] = token.split(".");
    if (extra !== undefined || !payload || !signature || !/^[\w-]+$/.test(payload) || !/^[\w-]+$/.test(signature)) throw new Error();
    const expected = createHmac("sha256", segredo).update(payload).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) throw new Error();
    const data = AutorizacaoSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (data.usuarioId !== usuarioId || data.geracaoId !== geracaoId || now >= data.expiraEm) throw new Error();
    return data;
  } catch { throw new Error("Plano inválido ou expirado. Inicie uma nova geração."); }
}
