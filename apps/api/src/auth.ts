import { createMiddleware } from "hono/factory";

/**
 * Autenticação SIMPLES do instrutor, apenas para a fase de testes.
 * A senha vem de INSTRUTOR_SENHA e o token é assinado (HMAC) com AUTH_SECRET, sem estado no servidor:
 * funciona em funções serverless e continua válido se a API reiniciar.
 * Em produção as duas variáveis são obrigatórias.
 * TODO: trocar por autenticação real (SSO/AD, hash de senha) antes de uso definitivo.
 */
const PRODUCAO = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
const VALIDADE_MS = 12 * 60 * 60 * 1000;
const enc = new TextEncoder();

function config() {
  const senha = process.env.INSTRUTOR_SENHA ?? (PRODUCAO ? undefined : "@inaldo123");
  const segredo = process.env.AUTH_SECRET ?? (PRODUCAO ? undefined : "dev-segredo-local");
  if (!senha || !segredo) throw new Error("Configure INSTRUTOR_SENHA e AUTH_SECRET no ambiente de produção.");
  return { senha, segredo };
}

const chaveHmac = (segredo: string) =>
  crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
const b64 = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64url");

type Papel = "instrutor" | "admin";

async function emitir(nome: string, papel: Papel) {
  const payload = b64(enc.encode(JSON.stringify({ nome, papel, exp: Date.now() + VALIDADE_MS })));
  const assinatura = b64(await crypto.subtle.sign("HMAC", await chaveHmac(config().segredo), enc.encode(payload)));
  return { token: `${payload}.${assinatura}`, nome };
}

export async function loginInstrutor(usuario: string, senha: string) {
  if (senha !== config().senha) return null;
  return emitir(usuario.trim() || "Inaldo Costa", "instrutor");
}

/** Acesso ao painel de relatórios: usuário e senha do administrador vêm de PAINEL_USUARIO e PAINEL_SENHA. */
export async function loginPainel(usuario: string, senha: string) {
  const u = process.env.PAINEL_USUARIO, s = process.env.PAINEL_SENHA;
  if (!u || !s) throw new Error("Configure PAINEL_USUARIO e PAINEL_SENHA no ambiente.");
  const norm = (x: string) => x.trim().toLowerCase();
  if (norm(usuario) !== norm(u) || senha !== s) return null;
  return emitir(u, "admin");
}

async function validar(token: string): Promise<{ nome: string; papel: Papel } | null> {
  const [payload, assinatura] = token.split(".");
  if (!payload || !assinatura) return null;
  const ok = await crypto.subtle.verify("HMAC", await chaveHmac(config().segredo), Buffer.from(assinatura, "base64url"), enc.encode(payload));
  if (!ok) return null;
  try {
    const { nome, papel, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { nome: string; papel?: Papel; exp: number };
    return exp > Date.now() ? { nome, papel: papel ?? "instrutor" } : null;
  } catch { return null; }
}

const exigir = (papeis: Papel[], msg: string) =>
  createMiddleware<{ Variables: { instrutor: string } }>(async (c, next) => {
    const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    const s = token ? await validar(token) : null;
    if (!s || !papeis.includes(s.papel)) return c.json({ erro: msg }, 401);
    c.set("instrutor", s.nome);
    await next();
  });

/** Só instrutor (registrar avaliação, enviar fotos). */
export const exigirInstrutor = exigir(["instrutor"], "Sessão do instrutor inválida. Faça login novamente.");
/** Só o administrador (editar a base de colaboradores). */
export const exigirAdmin = exigir(["admin"], "Sessão de administrador inválida. Faça login novamente.");
/** Painel de relatórios: administrador (ou instrutor, para o painel antigo dentro do app de provas). */
export const exigirPainel = exigir(["admin", "instrutor"], "Sessão inválida. Faça login novamente.");
