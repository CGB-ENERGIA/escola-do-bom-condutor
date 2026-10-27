import { criarApp } from "./app";

const app = criarApp();
const port = Number(process.env.PORT ?? 3001);
console.log(`API rodando em http://localhost:${port}`);

export default { port, fetch: app.fetch };
