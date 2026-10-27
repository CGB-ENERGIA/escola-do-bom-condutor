import { Hono } from "hono";
import {
  CRITERIOS_PRATICOS, REGRAS, avaliarPratica,
  type AusentesAcao, type BaseColaboradoresRes, type Colaborador, type Categoria, type CruzamentoRes, type DashboardPraticaRes, type DashboardTeoricaRes, type DetalheTeoricaRes, type LoginInstrutorReq,
  type Ocorrencia, type QuestaoCatalogo, type RegistroCruzamento, type RegistroPratico, type RegistroTeorico, type RegistroTeoricoDetalhe,
  type ResumoAvaliacao,
} from "@ebc/shared";
import { exigirAdmin, exigirPainel, loginPainel } from "../auth";
import { ErroPlanilha, gerentePadrao, importar, siglaBase } from "../importacao";
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

/** Amostra de `n` colaboradores espalhados por toda a base (bases e gerências variadas), sempre a mesma. */
function amostraDemo(n: number) {
  const todos = colaboradores.filter((c) => c.base && c.gerencia && c.situacao !== "TESTE" && c.situacao !== "FORA DA BASE");
  const passo = Math.max(1, Math.floor(todos.length / n));
  return Array.from({ length: Math.min(n, todos.length) }, (_, i) => todos[i * passo]!);
}

/** Dados FICTÍCIOS só para visualizar o dashboard cheio (ligado por ?demo=1). */
function gerarDemo(): RegistroTeorico[] {
  const rand = rng(2026);
  const base = amostraDemo(72);
  const categorias: Categoria[] = ["carro", "carro", "carro", "caminhao", "moto"];
  const agora = new Date();
  return base.map((c, i) => {
    // mais provas nos meses recentes
    const voltar = Math.floor(Math.pow(rand(), 1.6) * 5);
    const d = new Date(agora.getFullYear(), agora.getMonth() - voltar, 1 + Math.floor(rand() * 27), 8 + Math.floor(rand() * 9), Math.floor(rand() * 60));
    const pontos = rand() < 0.12 ? 12 + Math.floor(rand() * 8) : 20 + Math.floor(rand() * 11);
    return {
      id: `demo-${i}`, colaboradorId: c.id, nome: c.nome, matricula: c.matricula, base: c.base, gerencia: c.gerencia, coordenador: c.gerente ?? null,
      categoria: categorias[Math.floor(rand() * categorias.length)]!,
      pontos, pontosMaximos: REGRAS.teorica.totalQuestoes,
      aprovado: pontos >= REGRAS.teorica.acertosMinimos, tempoEsgotado: false,
      finalizadaEm: (d > agora ? agora : d).toISOString(),
    };
  });
}

export function dashboardRoutes(repo: Repository) {
  const app = new Hono<{ Variables: { instrutor: string } }>();

  /** POST /api/dashboard/login { usuario, senha } -> acesso do administrador ao painel. */
  app.post("/login", async (c) => {
    const { usuario, senha } = (await c.req.json()) as LoginInstrutorReq;
    const r = await loginPainel(usuario ?? "", senha ?? "");
    return r ? c.json(r) : c.json({ erro: "Usuário ou senha incorretos" }, 401);
  });

  app.use("*", exigirPainel);

  /* ---------- Configuração: base de colaboradores (só administrador) ---------- */
  const PRODUCAO = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  /** Em produção sem banco de dados as alterações não ficariam guardadas; então a tela só consulta. */
  const editavel = () => repo.persistente || !PRODUCAO;
  const somenteLeitura = { erro: "O banco de dados ainda não está configurado: as alterações não seriam guardadas. Configure o DATABASE_URL e tente de novo." };
  const txt = (v: unknown) => (typeof v === "string" ? v.trim() || null : null);
  const campos = (b: Record<string, unknown>) => ({
    nome: txt(b.nome)?.toUpperCase() ?? null,
    funcao: txt(b.funcao)?.toUpperCase() ?? null,
    base: siglaBase(txt(b.base)),
    gerencia: txt(b.gerencia)?.toUpperCase() ?? null,
    processo: txt(b.processo),
    gerente: txt(b.gerente),
    situacao: txt(b.situacao)?.toUpperCase() ?? "ATIVO",
  });
  app.use("/base", exigirAdmin);
  app.use("/base/*", exigirAdmin);

  /** GET /api/dashboard/base -> toda a base de colaboradores (inclusive desligados). */
  app.get("/base", async (c) =>
    c.json({ persistente: repo.persistente, editavel: editavel(), colaboradores: await repo.listarColaboradores() } satisfies BaseColaboradoresRes));

  /** POST /api/dashboard/base -> novo colaborador (a chapa não pode repetir). */
  app.post("/base", async (c) => {
    if (!editavel()) return c.json(somenteLeitura, 409);
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const chapa = txt(b.chapa) ?? txt(b.matricula) ?? txt(b.id);
    const f = campos(b);
    if (!chapa || !/^[A-Za-z0-9._-]{1,20}$/.test(chapa)) return c.json({ erro: "Informe a chapa (letras e números, até 20 caracteres)." }, 400);
    if (!f.nome) return c.json({ erro: "Informe o nome do colaborador." }, 400);
    if (await repo.getColaborador(chapa)) return c.json({ erro: `Já existe um colaborador com a chapa ${chapa}.` }, 409);
    // sem gerente informado: herda o da gerência/base
    const gerente = f.gerente ?? gerentePadrao(await repo.listarColaboradores(), f.gerencia, f.base);
    const novo: Colaborador = { id: chapa, matricula: chapa, ...f, gerente, nome: f.nome };
    await repo.salvarColaborador(novo);
    return c.json(novo, 201);
  });

  /** PUT /api/dashboard/base/:id -> edita os dados (a chapa não muda). */
  app.put("/base/:id", async (c) => {
    if (!editavel()) return c.json(somenteLeitura, 409);
    const atual = await repo.getColaborador(c.req.param("id"));
    if (!atual) return c.json({ erro: "Colaborador não encontrado." }, 404);
    const f = campos((await c.req.json().catch(() => ({}))) as Record<string, unknown>);
    if (!f.nome) return c.json({ erro: "Informe o nome do colaborador." }, 400);
    const novo: Colaborador = { ...atual, ...f, nome: f.nome };
    await repo.salvarColaborador(novo);
    return c.json(novo);
  });

  /** DELETE /api/dashboard/base/:id -> exclui o colaborador (o histórico de avaliações passa a mostrar só a chapa). */
  app.delete("/base/:id", async (c) => {
    if (!editavel()) return c.json(somenteLeitura, 409);
    const id = c.req.param("id");
    if (id === "00000") return c.json({ erro: "O colaborador de testes não pode ser excluído." }, 400);
    return (await repo.excluirColaborador(id)) ? c.json({ ok: true }) : c.json({ erro: "Colaborador não encontrado." }, 404);
  });

  /** POST /api/dashboard/base/gerente { gerencia, base?, gerente } -> define o gerente de todos da gerência (e da base, se informada). */
  app.post("/base/gerente", async (c) => {
    if (!editavel()) return c.json(somenteLeitura, 409);
    const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const gerencia = txt(b.gerencia)?.toUpperCase();
    if (!gerencia) return c.json({ erro: "Escolha a gerência." }, 400);
    const gerente = txt(b.gerente);
    const base = siglaBase(txt(b.base));
    let n = 0;
    for (const x of await repo.listarColaboradores()) {
      if (x.gerencia === gerencia && (!base || x.base === base) && x.situacao !== "TESTE") { await repo.salvarColaborador({ ...x, gerente }); n++; }
    }
    return c.json({ atualizados: n });
  });

  /**
   * POST /api/dashboard/base/importar?aplicar=0|1&ausentes=desligar|excluir|manter&nome=arquivo.xlsx
   * Corpo = o arquivo (.xlsx ou .csv). Com aplicar=0 só devolve a prévia (novos, alterados e ausentes).
   */
  app.post("/base/importar", async (c) => {
    const aplicar = c.req.query("aplicar") === "1";
    if (aplicar && !editavel()) return c.json(somenteLeitura, 409);
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 4 * 1024 * 1024) return c.json({ erro: "Envie um arquivo de até 4 MB." }, 413);
    const a = c.req.query("ausentes");
    const ausentes: AusentesAcao = a === "excluir" || a === "manter" ? a : "desligar";
    try {
      return c.json(await importar({
        bytes, nomeArquivo: c.req.query("nome") ?? "planilha", atual: await repo.listarColaboradores(), aplicar, ausentes,
        salvar: (x) => repo.salvarColaborador(x), excluir: (id) => repo.excluirColaborador(id),
      }));
    } catch (e) {
      if (e instanceof ErroPlanilha) return c.json({ erro: e.message }, 400);
      throw e;
    }
  });

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
        matricula: col?.matricula ?? null, base: col?.base ?? null, gerencia: col?.gerencia ?? null, coordenador: col?.gerente ?? null,
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
      const base = amostraDemo(60);
      const agora = new Date();
      const registros: RegistroPratico[] = base.map((col, i) => {
        const d = new Date(agora.getFullYear(), agora.getMonth() - Math.floor(rand() * 5), 1 + Math.floor(rand() * 27), 9, 0);
        // 40% sem infração (ou 1 leve); os demais cometem de 1 a 3 infrações (as primeiras da lista são as mais comuns)
        const ocorrencias: Ocorrencia[] = [];
        if (rand() < 0.4) {
          const leves = CRITERIOS_PRATICOS.filter((x) => x.natureza === "leve");
          if (rand() < 0.35) ocorrencias.push({ criterioId: leves[Math.floor(rand() * leves.length)]!.id, quantidade: 1 });
        } else {
          for (let k = 0, n = 1 + Math.floor(rand() * 3); k < n; k++) {
            const c2 = CRITERIOS_PRATICOS[Math.floor(Math.pow(rand(), 1.6) * CRITERIOS_PRATICOS.length)]!;
            if (!ocorrencias.some((o) => o.criterioId === c2.id)) ocorrencias.push({ criterioId: c2.id, quantidade: 1 + Math.floor(rand() * 2) });
          }
        }
        const resultado = avaliarPratica(ocorrencias);
        return {
          programa: i % 7 === 6 ? "De Olho na Condução" : "Escola do Bom Condutor",
          id: `demo-p-${i}`, colaboradorId: col.id, nome: col.nome, matricula: col.matricula, base: col.base, gerencia: col.gerencia, coordenador: col.gerente ?? null,
          tipo: rand() < 0.2 ? "reteste" : "primeira", veiculo: (["carro", "carro", "caminhao", "moto"] as const)[Math.floor(rand() * 4)]!,
          pontos: resultado.pontos, apto: resultado.apto, ocorrencias,
          descricao: resultado.apto ? "Conduziu com segurança durante todo o percurso." : "Cometeu infrações durante o percurso; orientado e encaminhado para reciclagem.",
          avaliador: "Demonstração", realizadaEm: (d > agora ? agora : d).toISOString(),
        };
      });
      return c.json({ demo: true, registros } satisfies DashboardPraticaRes);
    }
    const registros: RegistroPratico[] = [];
    for (const a of await repo.listarAvaliacoesPraticas()) {
      const col = await repo.getColaborador(a.colaboradorId);
      registros.push({
        programa: a.programa ?? "Escola do Bom Condutor", id: a.id, colaboradorId: a.colaboradorId, nome: col?.nome ?? a.colaboradorId, matricula: col?.matricula ?? null,
        base: a.base ?? col?.base ?? null, gerencia: col?.gerencia ?? null, coordenador: col?.gerente ?? null, tipo: a.tipo, veiculo: a.veiculo,
        pontos: a.resultado.pontos, apto: a.resultado.apto, ocorrencias: a.ocorrencias, descricao: a.descricao ?? "",
        avaliador: a.avaliador, realizadaEm: a.realizadaEm,
      });
    }
    return c.json({ demo: false, registros } satisfies DashboardPraticaRes);
  });

  /**
   * GET /api/dashboard/cruzamento[?demo=1] -> um registro por colaborador com o que já fez:
   * teórica (só Escola do Bom Condutor), prática da Escola e prática do De Olho na Condução.
   * Serve para achar quem fez uma etapa e ainda não fez a outra.
   */
  app.get("/cruzamento", async (c) => {
    type Item = { data: string | null; ok: boolean; pontos: number };
    const resumir = (xs: Item[]): ResumoAvaliacao | null => {
      if (xs.length === 0) return null;
      const ult = [...xs].sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""))[0]!;
      return { qtd: xs.length, ultima: ult.data, ok: ult.ok, pontos: ult.pontos };
    };
    const teoricas = new Map<string, Item[]>();
    const escola = new Map<string, Item[]>();
    const olho = new Map<string, Item[]>();
    const add = (m: Map<string, Item[]>, id: string, it: Item) => (m.get(id) ?? m.set(id, []).get(id)!).push(it);
    const ESCOLA = "Escola do Bom Condutor";
    const demo = c.req.query("demo") === "1";

    if (demo) {
      const rand = rng(909);
      const base = amostraDemo(100);
      const data = () => new Date(Date.now() - Math.floor(rand() * 120) * 86_400_000).toISOString();
      // 0-69 fizeram a teórica; 10-79 fizeram a prática da Escola (logo: 0-9 sem prática, 70-79 sem teórica); 80-99 só De Olho na Condução
      base.slice(0, 70).forEach((x) => { const p = rand() < 0.12 ? 14 + Math.floor(rand() * 6) : 20 + Math.floor(rand() * 11); add(teoricas, x.id, { data: data(), ok: p >= REGRAS.teorica.acertosMinimos, pontos: p }); });
      base.slice(10, 80).forEach((x) => { const ap = rand() < 0.45; add(escola, x.id, { data: data(), ok: ap, pontos: ap ? 0 : 4 + Math.floor(rand() * 9) }); });
      base.slice(80, 100).forEach((x) => { const ap = rand() < 0.5; add(olho, x.id, { data: data(), ok: ap, pontos: ap ? 0 : 5 }); });
      const registros: RegistroCruzamento[] = base.slice(0, 100).map((x) => ({
        colaboradorId: x.id, nome: x.nome, matricula: x.matricula, base: x.base, gerencia: x.gerencia, coordenador: x.gerente ?? null,
        teorica: resumir(teoricas.get(x.id) ?? []), praticaEscola: resumir(escola.get(x.id) ?? []), praticaOlho: resumir(olho.get(x.id) ?? []),
      }));
      return c.json({ demo: true, registros } satisfies CruzamentoRes);
    }

    for (const t of (await repo.listarTentativas()).filter((x) => x.finalizadaEm && x.resultado))
      add(teoricas, t.colaboradorId, { data: t.finalizadaEm!, ok: t.resultado!.aprovado, pontos: t.resultado!.pontos });
    for (const a of await repo.listarAvaliacoesPraticas())
      add((a.programa ?? ESCOLA) === ESCOLA ? escola : olho, a.colaboradorId, { data: a.realizadaEm, ok: a.resultado.apto, pontos: a.resultado.pontos });

    const ids = new Set([...teoricas.keys(), ...escola.keys(), ...olho.keys()]);
    const registros: RegistroCruzamento[] = [];
    for (const id of ids) {
      const col = await repo.getColaborador(id);
      registros.push({
        colaboradorId: id, nome: col?.nome ?? id, matricula: col?.matricula ?? null, base: col?.base ?? null, gerencia: col?.gerencia ?? null, coordenador: col?.gerente ?? null,
        teorica: resumir(teoricas.get(id) ?? []), praticaEscola: resumir(escola.get(id) ?? []), praticaOlho: resumir(olho.get(id) ?? []),
      });
    }
    return c.json({ demo: false, registros } satisfies CruzamentoRes);
  });

  /**
   * GET /api/dashboard/teorica-detalhe[?demo=1] -> provas finalizadas com as questões que cada colaborador errou
   * (alternativa marcada, ou em branco) + catálogo das questões. Os filtros e rankings são feitos no navegador.
   */
  app.get("/teorica-detalhe", async (c) => {
    const grupoDe = (cat: Categoria) => (cat === "moto" ? "moto" : "carro") as "carro" | "moto";
    // Catálogo: Carro e Caminhão compartilham as mesmas questões
    const catalogo: QuestaoCatalogo[] = [];
    for (const grupo of ["carro", "moto"] as const) {
      for (const q of await repo.getQuestoes(grupo))
        catalogo.push({ id: q.id, grupo, numero: q.numero, enunciado: q.enunciado, correta: q.correta, alternativas: q.alternativas });
    }
    const porId = new Map(catalogo.map((q) => [q.id, q]));

    if (c.req.query("demo") === "1") {
      const rand = rng(404);
      // cada questão tem uma "dificuldade" fixa: algumas são muito mais erradas que as outras
      const peso = new Map(catalogo.map((q) => [q.id, 0.15 + Math.pow(rand(), 2.2)]));
      const registros: RegistroTeoricoDetalhe[] = gerarDemo().map((r) => {
        const grupo = grupoDe(r.categoria);
        const pool = catalogo.filter((q) => q.grupo === grupo);
        const erros: [string, string | null][] = [];
        const livres = [...pool];
        for (let k = 0, n = Math.max(0, r.pontosMaximos - r.pontos); k < n && livres.length; k++) {
          const soma = livres.reduce((s, q) => s + peso.get(q.id)!, 0);
          let alvo = rand() * soma, idx = 0;
          for (; idx < livres.length - 1; idx++) { alvo -= peso.get(livres[idx]!.id)!; if (alvo <= 0) break; }
          const [q] = livres.splice(idx, 1);
          const erradas = q!.alternativas.filter((a) => a.id !== q!.correta);
          erros.push([q!.id, rand() < 0.1 ? null : erradas[Math.floor(rand() * erradas.length)]!.id]);
        }
        return { ...r, erros };
      });
      return c.json({ demo: true, questoes: catalogo, registros } satisfies DetalheTeoricaRes);
    }

    const registros: RegistroTeoricoDetalhe[] = [];
    for (const t of (await repo.listarTentativas()).filter((x) => x.finalizadaEm && x.resultado)) {
      const col = await repo.getColaborador(t.colaboradorId);
      const respostas = t.respostas ?? {};
      const erros: [string, string | null][] = (await repo.getQuestoes(t.categoria))
        .filter((q) => porId.has(q.id) && respostas[q.id] !== q.correta)
        .map((q) => [q.id, respostas[q.id] ?? null]);
      registros.push({
        id: t.id, colaboradorId: t.colaboradorId, nome: col?.nome ?? t.colaboradorId,
        matricula: col?.matricula ?? null, base: col?.base ?? null, gerencia: col?.gerencia ?? null, coordenador: col?.gerente ?? null,
        categoria: t.categoria, pontos: t.resultado!.pontos, pontosMaximos: t.resultado!.pontosMaximos,
        aprovado: t.resultado!.aprovado, tempoEsgotado: !!t.resultado!.tempoEsgotado, finalizadaEm: t.finalizadaEm!, erros,
      });
    }
    return c.json({ demo: false, questoes: catalogo, registros } satisfies DetalheTeoricaRes);
  });

  return app;
}
