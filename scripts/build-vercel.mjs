// Monta o projeto único da Vercel:  /  = provas (web)  ·  /painel = relatórios (dash)  ·  /api = API (função).
// Saída: public/ (estáticos) e server-dist/api.mjs (API empacotada; api/index.js a reexporta).
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const run = (cmd, cwd, env = {}) => execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, ...env } });

rmSync("public", { recursive: true, force: true });
rmSync("server-dist", { recursive: true, force: true });
mkdirSync("public", { recursive: true });
mkdirSync("server-dist", { recursive: true });

run("npm run build", "apps/web");
cpSync("apps/web/dist", "public", { recursive: true });

run("npm run build", "apps/dash", { DASH_BASE: "/painel/" });
cpSync("apps/dash/dist", "public/painel", { recursive: true });

run("npm run build", "apps/api");
cpSync("apps/api/api/index.js", "server-dist/api.mjs");

console.log("Build unificado pronto: public/ + server-dist/api.mjs");
