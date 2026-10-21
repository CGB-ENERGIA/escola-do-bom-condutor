import { Hono } from "hono";
import {
  CRITERIOS_PRATICOS, VEICULOS, avaliarPratica,
  type AvaliacaoPratica, type AvaliacaoPraticaDetalhada, type CriarAvaliacaoPraticaReq, type Evidencia, type LoginInstrutorReq,
} from "@ebc/shared";
import { carregarEvidencia } from "./evidencias";
import { exigirInstrutor, loginInstrutor } from "../auth";
import type { Repository } from "../repository";

export function praticaRoutes(repo: Repository) {
  const app = new Hono<{ Variables: { instrutor: string } }>();

  /** POST /api/pratica/login { usuario, senha } */
  app.post("/login", async (c) => {
    const { usuario, senha } = (await c.req.json()) as LoginInstrutorReq;
    const r = loginInstrutor(usuario ?? "", senha ?? "");
    return r ? c.json(r) : c.json({ erro: "Senha incorreta" }, 401);
  });

  /** POST /api/pratica -> registra uma avaliação prática (Apto/Inapto é calculado no servidor). */
  app.post("/", exigirInstrutor, async (c) => {
    const b = (await c.req.json()) as CriarAvaliacaoPraticaReq;
    const colaborador = await repo.getColaborador(b.colaboradorId);
    if (!colaborador) return c.json({ erro: "Colaborador não encontrado" }, 404);
    if (!(b.veiculo in VEICULOS)) return c.json({ erro: "Tipo de veículo inválido" }, 400);
    if (b.tipo !== "primeira" && b.tipo !== "reteste") return c.json({ erro: "Tipo de avaliação inválido" }, 400);

    const ids = new Set(CRITERIOS_PRATICOS.map((x) => x.id));
    const ocorrencias = (b.ocorrencias ?? []).filter(
      (o) => ids.has(o.criterioId) && Number.isInteger(o.quantidade) && o.quantidade > 0 && o.quantidade <= 20,
    );
    const evidencias = (
      await Promise.all((b.evidencias ?? []).slice(0, 10).map((id) => carregarEvidencia(id)))
    ).filter((e): e is Evidencia => !!e);
    if (evidencias.length === 0) return c.json({ erro: "Registre ao menos 1 foto de evidência para finalizar a avaliação." }, 400);
    if (!(b.descricao ?? "").trim()) return c.json({ erro: "Preencha a descrição / observações do instrutor para finalizar a avaliação." }, 400);
    const avaliacao: AvaliacaoPratica = {
      id: crypto.randomUUID(),
      colaboradorId: colaborador.id,
      programa: "Escola do Bom Condutor",
      tipo: b.tipo,
      veiculo: b.veiculo,
      base: colaborador.base,
      ocorrencias,
      descricao: (b.descricao ?? "").trim(),
      evidenciaUrl: b.evidenciaUrl?.trim() || null,
      evidencias,
      avaliador: c.get("instrutor"),
      realizadaEm: new Date().toISOString(),
      resultado: avaliarPratica(ocorrencias),
    };
    await repo.salvarAvaliacaoPratica(avaliacao);
    return c.json(avaliacao, 201);
  });

  /** GET /api/pratica?colaboradorId=...&programa=... -> avaliações (mais recentes primeiro). */
  app.get("/", exigirInstrutor, async (c) => {
    const { colaboradorId, programa } = c.req.query();
    const todas = (await repo.listarAvaliacoesPraticas())
      .filter((a) => (!colaboradorId || a.colaboradorId === colaboradorId) && (!programa || a.programa === programa))
      .sort((a, b) => (b.realizadaEm ?? "").localeCompare(a.realizadaEm ?? ""));
    const out: AvaliacaoPraticaDetalhada[] = await Promise.all(
      todas.map(async (a) => ({ ...a, colaborador: await repo.getColaborador(a.colaboradorId) })),
    );
    return c.json(out);
  });

  return app;
}
