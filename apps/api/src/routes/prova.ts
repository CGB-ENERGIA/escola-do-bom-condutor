import { Hono } from "hono";
import {
  CATEGORIAS, REGRAS, corrigirTeorica,
  type FinalizarTentativaReq, type IniciarTentativaReq, type IniciarTentativaRes, type QuestaoPublica,
} from "@ebc/shared";
import type { Repository } from "../repository";

export function provaRoutes(repo: Repository) {
  const app = new Hono();

  /** POST /api/tentativas { colaboradorId, categoria } -> inicia a prova e devolve questões SEM gabarito. */
  app.post("/", async (c) => {
    const { colaboradorId, categoria } = (await c.req.json()) as IniciarTentativaReq;
    if (!(categoria in CATEGORIAS)) return c.json({ erro: "Categoria inválida" }, 400);
    const colaborador = await repo.getColaborador(colaboradorId);
    if (!colaborador) return c.json({ erro: "Colaborador não encontrado" }, 404);

    const tentativaId = crypto.randomUUID();
    const agora = new Date();
    const expiraEm = new Date(agora.getTime() + REGRAS.teorica.duracaoMinutos * 60_000).toISOString();
    await repo.salvarTentativa({
      id: tentativaId, colaboradorId, categoria, iniciadaEm: agora.toISOString(), expiraEm,
    });
    const questoes: QuestaoPublica[] = (await repo.getQuestoes(categoria)).map(
      ({ correta: _gabarito, ...q }) => q,
    );
    const res: IniciarTentativaRes = {
      tentativaId, colaborador, categoria, questoes, agora: agora.toISOString(), expiraEm,
    };
    return c.json(res, 201);
  });

  /** POST /api/tentativas/:id/finalizar { respostas } -> pontuação e status. */
  app.post("/:id/finalizar", async (c) => {
    const t = await repo.getTentativa(c.req.param("id"));
    if (!t) return c.json({ erro: "Tentativa não encontrada" }, 404);
    if (t.finalizadaEm) return c.json({ erro: "Esta prova já foi finalizada" }, 409);

    const { respostas } = (await c.req.json()) as FinalizarTentativaReq;
    // Só o que foi respondido conta (questão em branco = 0), inclusive quando o tempo esgota.
    const agora = Date.now();
    const tempoEsgotado = !!t.expiraEm && agora >= Date.parse(t.expiraEm);
    const resultado = {
      ...corrigirTeorica(await repo.getQuestoes(t.categoria), respostas ?? {}),
      ...(tempoEsgotado ? { tempoEsgotado: true } : {}),
    };
    await repo.salvarTentativa({
      ...t, respostas: respostas ?? {}, resultado, finalizadaEm: new Date(agora).toISOString(),
    });
    return c.json({ resultado });
  });

  return app;
}
