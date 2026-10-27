import { Hono } from "hono";
import { cors } from "hono/cors";
import { MemoryRepository, type Repository } from "./repository";
import { PgRepository } from "./repositoryPg";
import { colaboradoresRoutes } from "./routes/colaboradores";
import { provaRoutes } from "./routes/prova";
import { adminRoutes } from "./routes/admin";
import { praticaRoutes } from "./routes/pratica";
import { dashboardRoutes } from "./routes/dashboard";
import { evidenciasRoutes } from "./routes/evidencias";

/** Com DATABASE_URL usa o PostgreSQL; sem ela, memória (apenas desenvolvimento). */
export function criarRepositorio(): Repository {
  const url = process.env.DATABASE_URL;
  if (url) { console.log("Banco: PostgreSQL"); return new PgRepository(url); }
  console.log("Banco: memória (desenvolvimento; os dados somem ao reiniciar)");
  return new MemoryRepository();
}

export function criarApp(repo: Repository = criarRepositorio()) {
  const app = new Hono();

  app.use("/api/*", cors());
  app.get("/api/health", (c) => c.json({ ok: true }));
  app.route("/api/colaboradores", colaboradoresRoutes(repo));
  app.route("/api/tentativas", provaRoutes(repo));
  app.route("/api/admin", adminRoutes(repo));
  app.route("/api/pratica", praticaRoutes(repo));
  app.route("/api/dashboard", dashboardRoutes(repo));
  app.route("/api/evidencias", evidenciasRoutes(repo));
  /** Hora oficial do servidor (rede). O carimbo das fotos usa isto, não o relógio do aparelho. */
  app.get("/api/tempo", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ agora: new Date().toISOString() });
  });
  return app;
}
