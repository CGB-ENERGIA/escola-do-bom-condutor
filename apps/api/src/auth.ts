import { createMiddleware } from "hono/factory";

/**
 * Autenticação SIMPLES do instrutor, apenas para a fase de testes.
 * Senha em INSTRUTOR_SENHA (padrão definido abaixo). Sessões ficam em memória.
 * TODO: trocar por autenticação real (SSO/AD, hash de senha, expiração) antes de produção.
 */
const SENHA = process.env.INSTRUTOR_SENHA ?? "@inaldo1234";
const sessoes = new Map<string, { nome: string }>();

export function loginInstrutor(usuario: string, senha: string) {
  if (senha !== SENHA) return null;
  const token = crypto.randomUUID();
  const nome = usuario.trim() || "Inaldo Costa";
  sessoes.set(token, { nome });
  return { token, nome };
}

export const exigirInstrutor = createMiddleware<{ Variables: { instrutor: string } }>(async (c, next) => {
  const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const s = token ? sessoes.get(token) : undefined;
  if (!s) return c.json({ erro: "Sessão do instrutor inválida. Faça login novamente." }, 401);
  c.set("instrutor", s.nome);
  await next();
});
