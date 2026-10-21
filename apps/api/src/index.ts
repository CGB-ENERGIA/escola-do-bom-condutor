import { Hono } from "hono";
import { cors } from "hono/cors";
import { MemoryRepository } from "./repository";
import { colaboradoresRoutes } from "./routes/colaboradores";
import { provaRoutes } from "./routes/prova";
import { adminRoutes } from "./routes/admin";
import { praticaRoutes } from "./routes/pratica";
import { dashboardRoutes } from "./routes/dashboard";
import { evidenciasRoutes } from "./routes/evidencias";

const repo = new MemoryRepository();
const app = new Hono();

app.use("/api/*", cors());
app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/colaboradores", colaboradoresRoutes(repo));
app.route("/api/tentativas", provaRoutes(repo));
app.route("/api/admin", adminRoutes(repo));
app.route("/api/pratica", praticaRoutes(repo));
app.route("/api/dashboard", dashboardRoutes(repo));
app.route("/api/evidencias", evidenciasRoutes());
/** Hora oficial do servidor (rede). O carimbo das fotos usa isto, não o relógio do aparelho. */
app.get("/api/tempo", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ agora: new Date().toISOString() });
});

const port = Number(process.env.PORT ?? 3001);
console.log(`API rodando em http://localhost:${port}`);

export default { port, fetch: app.fetch };
