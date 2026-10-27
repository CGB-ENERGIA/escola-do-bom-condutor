import { Hono } from "hono";
import type { Repository } from "../repository";

/** Rotas de apoio para testes. Protegidas por chave simples (ADMIN_KEY, padrão "teste"). */
export function adminRoutes(repo: Repository) {
  const app = new Hono();
  const producao = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  const chave = process.env.ADMIN_KEY ?? (producao ? undefined : "teste");

  app.use("*", async (c, next) => {
    if (!chave || c.req.header("x-admin-key") !== chave) return c.json({ erro: "Não autorizado" }, 401);
    await next();
  });

  /** GET /api/admin/resultados -> tentativas finalizadas com dados do colaborador. */
  app.get("/resultados", async (c) => {
    const lista = (await repo.listarTentativas()).filter((t) => t.finalizadaEm);
    const out = await Promise.all(
      lista.map(async (t) => ({
        tentativaId: t.id,
        colaborador: await repo.getColaborador(t.colaboradorId),
        categoria: t.categoria,
        finalizadaEm: t.finalizadaEm,
        resultado: t.resultado,
      })),
    );
    return c.json(out);
  });

  return app;
}
