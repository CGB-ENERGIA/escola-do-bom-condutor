import { Hono } from "hono";
import { REGRAS, type Categoria, type DashboardPraticaRes, type DashboardTeoricaRes, type RegistroPratico, type RegistroTeorico } from "@ebc/shared";
import { exigirInstrutor } from "../auth";
import type { Repository } from "../repository";
import { colaboradores } from "../seed";

/** PRNG determinístico (mulberry32): a demonstração sempre gera os mesmos dados. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dados FICTÍCIOS só para visualizar o dashboard cheio (ligado por ?demo=1). */
function gerarDemo(): RegistroTeorico[] {
  const rand = rng(2026);
  const base = colaboradores.filter((c) => c.base && c.gerencia).slice(0, 72);
  const categorias: Categoria[] = ["carro", "carro", "carro", "caminhao", "moto"];
  const agora = new Date();
  return base.map((c, i) => {
    // mais provas nos meses recentes
    const voltar = Math.floor(Math.pow(rand(), 1.6) * 5);
    const d = new Date(agora.getFullYear(), agora.getMonth() - voltar, 1 + Math.floor(rand() * 27), 8 + Math.floor(rand() * 9), Math.floor(rand() * 60));
    const pontos = rand() < 0.12 ? 12 + Math.floor(rand() * 8) : 20 + Math.floor(rand() * 11);
    return {
      id: `demo-${i}`, colaboradorId: c.id, nome: c.nome, matricula: c.matricula, base: c.base, gerencia: c.gerencia,
      categoria: categorias[Math.floor(rand() * categorias.length)]!,
      pontos, pontosMaximos: REGRAS.teorica.totalQuestoes,
      aprovado: pontos >= REGRAS.teorica.acertosMinimos, tempoEsgotado: false,
      finalizadaEm: (d > agora ? agora : d).toISOString(),
    };
  });
}

export function dashboardRoutes(repo: Repository) {
  const app = new Hono<{ Variables: { instrutor: string } }>();
  app.use("*", exigirInstrutor);

  /** GET /api/dashboard/teorica[?demo=1] -> provas teóricas finalizadas (os filtros são aplicados no navegador). */
  app.get("/teorica", async (c) => {
    if (c.req.query("demo") === "1") {
      const res: DashboardTeoricaRes = { demo: true, registros: gerarDemo() };
      return c.json(res);
    }
    const finalizadas = (await repo.listarTentativas()).filter((t) => t.finalizadaEm && t.resultado);
    const registros: RegistroTeorico[] = [];
    for (const t of finalizadas) {
      const col = await repo.getColaborador(t.colaboradorId);
      registros.push({
        id: t.id, colaboradorId: t.colaboradorId, nome: col?.nome ?? t.colaboradorId,
        matricula: col?.matricula ?? null, base: col?.base ?? null, gerencia: col?.gerencia ?? null,
        categoria: t.categoria, pontos: t.resultado!.pontos, pontosMaximos: t.resultado!.pontosMaximos,
        aprovado: t.resultado!.aprovado, tempoEsgotado: !!t.resultado!.tempoEsgotado,
        finalizadaEm: t.finalizadaEm!,
      });
    }
    const res: DashboardTeoricaRes = { demo: false, registros };
    return c.json(res);
  });

  /** GET /api/dashboard/pratica[?demo=1] -> avaliações práticas da Escola do Bom Condutor (filtros no navegador). */
  app.get("/pratica", async (c) => {
    if (c.req.query("demo") === "1") {
      const rand = rng(77);
      const base = colaboradores.filter((c2) => c2.base && c2.gerencia).slice(0, 60);
      const agora = new Date();
      const registros: RegistroPratico[] = base.map((col, i) => {
        const d = new Date(agora.getFullYear(), agora.getMonth() - Math.floor(rand() * 5), 1 + Math.floor(rand() * 27), 9, 0);
        const apto = rand() < 0.4;
        return {
          id: `demo-p-${i}`, colaboradorId: col.id, nome: col.nome, matricula: col.matricula, base: col.base, gerencia: col.gerencia,
          tipo: rand() < 0.2 ? "reteste" : "primeira", veiculo: "carro", pontos: apto ? 0 : 4 + Math.floor(rand() * 10), apto,
          avaliador: "Demonstração", realizadaEm: (d > agora ? agora : d).toISOString(),
        };
      });
      return c.json({ demo: true, registros } satisfies DashboardPraticaRes);
    }
    const registros: RegistroPratico[] = [];
    for (const a of await repo.listarAvaliacoesPraticas()) {
      if ((a.programa ?? "Escola do Bom Condutor") !== "Escola do Bom Condutor") continue;
      const col = await repo.getColaborador(a.colaboradorId);
      registros.push({
        id: a.id, colaboradorId: a.colaboradorId, nome: col?.nome ?? a.colaboradorId, matricula: col?.matricula ?? null,
        base: a.base ?? col?.base ?? null, gerencia: col?.gerencia ?? null, tipo: a.tipo, veiculo: a.veiculo,
        pontos: a.resultado.pontos, apto: a.resultado.apto, avaliador: a.avaliador, realizadaEm: a.realizadaEm,
      });
    }
    return c.json({ demo: false, registros } satisfies DashboardPraticaRes);
  });

  return app;
}
