import { Hono } from "hono";
import type { Evidencia } from "@ebc/shared";
import { exigirInstrutor } from "../auth";
import type { Repository } from "../repository";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_BYTES = 4 * 1024 * 1024; // limite de corpo das funções da Vercel é ~4,5 MB

const num = (v: string | undefined) => {
  const n = v === undefined || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};

export function evidenciasRoutes(repo: Repository) {
  const app = new Hono<{ Variables: { instrutor: string } }>();

  /**
   * POST /api/evidencias?lat=&lon=&precisao=&capturadaEm=  (corpo = imagem JPEG)
   * Guarda a foto e registra a hora de RECEBIMENTO do servidor (relógio de rede).
   */
  app.post("/", exigirInstrutor, async (c) => {
    if (!(c.req.header("content-type") ?? "").startsWith("image/jpeg"))
      return c.json({ erro: "Envie a foto em JPEG." }, 415);
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return c.json({ erro: "Foto vazia ou maior que 4 MB." }, 413);
    if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return c.json({ erro: "Arquivo não é uma imagem JPEG." }, 400);

    const q = c.req.query();
    const id = crypto.randomUUID();
    const agora = new Date().toISOString();
    const capturada = q.capturadaEm && !Number.isNaN(Date.parse(q.capturadaEm)) ? new Date(q.capturadaEm).toISOString() : agora;
    const ev: Evidencia = {
      id, url: `/api/evidencias/${id}.jpg`, capturadaEm: capturada, recebidaEm: agora,
      latitude: num(q.lat), longitude: num(q.lon), precisao: num(q.precisao), instrutor: c.get("instrutor"),
    };
    await repo.salvarEvidencia(ev, bytes);
    return c.json(ev, 201);
  });

  /** GET /api/evidencias/:id.jpg — o id é um UUID aleatório (fase de testes; proteger com login em produção). */
  app.get("/:arquivo", async (c) => {
    const id = c.req.param("arquivo").replace(/\.jpg$/, "");
    if (!ID.test(id)) return c.notFound();
    const img = await repo.getEvidenciaImagem(id);
    if (!img) return c.notFound();
    return new Response(img as BodyInit, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" } });
  });

  return app;
}
