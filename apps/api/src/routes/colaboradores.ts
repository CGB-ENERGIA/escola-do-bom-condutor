import { Hono } from "hono";
import type { Repository } from "../repository";

export function colaboradoresRoutes(repo: Repository) {
  const app = new Hono();

  /** GET /api/colaboradores?q=maria -> até 8 colaboradores por nome ou matrícula. */
  app.get("/", async (c) => {
    const q = (c.req.query("q") ?? "").trim();
    if (q.length < 2) return c.json([]);
    return c.json(await repo.buscarColaboradores(q));
  });

  return app;
}
