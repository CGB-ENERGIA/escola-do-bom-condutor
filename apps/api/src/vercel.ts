import { handle } from "hono/vercel";
import { criarApp } from "./app";

/** Ponto de entrada da função serverless da Vercel (empacotado em api/index.js pelo script "build"). */
const app = criarApp();
const h = handle(app);

export const GET = h;
export const POST = h;
export const PUT = h;
export const PATCH = h;
export const DELETE = h;
export const OPTIONS = h;
export const HEAD = h;
