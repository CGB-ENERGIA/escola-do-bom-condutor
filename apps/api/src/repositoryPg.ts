import postgres from "postgres";
import type { AvaliacaoPratica, Categoria, Colaborador, Evidencia, Tentativa } from "@ebc/shared";
import { MemoryRepository, buscarEm, type Repository } from "./repository";
import { avaliacoesPraticasHistorico, colaboradores } from "./seed";

/**
 * Repositório em PostgreSQL (Neon, Supabase, etc.). A base de colaboradores, as tentativas, as avaliações práticas
 * e as fotos ficam no banco (as questões continuam vindo do código). As tabelas são criadas sozinhas na primeira
 * chamada e a base de colaboradores é carregada do arquivo de seed uma única vez; depois é editada pela Configuração.
 */
export class PgRepository implements Repository {
  readonly persistente = true;
  private sql: postgres.Sql;
  private base = new MemoryRepository(); // questões (dados estáticos)
  private pronto?: Promise<void>;
  /** Cópia curta da base de colaboradores: a busca da prova roda a cada tecla e as listas consultam vários ids. */
  private cache?: { em: number; lista: Colaborador[] };

  constructor(url: string) {
    // prepare:false => compatível com o pooler do Neon/PgBouncer; max baixo => cabe em funções serverless
    this.sql = postgres(url, { ssl: "require", max: 3, prepare: false, idle_timeout: 20, connect_timeout: 15 });
  }

  private iniciar() {
    return (this.pronto ??= (async () => {
      const sql = this.sql;
      await sql`create table if not exists tentativas (
        id text primary key, colaborador_id text not null, categoria text not null,
        iniciada_em timestamptz not null, finalizada_em timestamptz, dados jsonb not null)`;
      await sql`create table if not exists avaliacoes_praticas (
        id text primary key, realizada_em timestamptz, dados jsonb not null)`;
      await sql`create table if not exists evidencias (
        id text primary key, meta jsonb not null, imagem bytea not null)`;
      await sql`create table if not exists colaboradores (
        id text primary key, dados jsonb not null, atualizado_em timestamptz not null default now())`;
      // base de colaboradores: carregada do seed uma única vez (depois só muda pela tela de Configuração)
      const [{ c }] = await sql<{ c: number }[]>`select count(*)::int as c from colaboradores`;
      if (c === 0) {
        const lote = 200;
        for (let i = 0; i < colaboradores.length; i += lote) {
          const linhas = colaboradores.slice(i, i + lote).map((x) => ({ id: x.id, dados: sql.json(x as never) }));
          await sql`insert into colaboradores ${sql(linhas, "id", "dados")} on conflict (id) do nothing`;
        }
      }
      // histórico importado da planilha: entra uma única vez
      const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from avaliacoes_praticas`;
      if (n === 0) {
        for (const a of avaliacoesPraticasHistorico)
          await sql`insert into avaliacoes_praticas (id, realizada_em, dados) values (${a.id}, ${a.realizadaEm}, ${sql.json(a as never)}) on conflict (id) do nothing`;
      }
    })().catch((e) => { this.pronto = undefined; throw e; }));
  }

  private async todos(): Promise<Colaborador[]> {
    if (this.cache && Date.now() - this.cache.em < 10_000) return this.cache.lista;
    await this.iniciar();
    const lista = (await this.sql<{ dados: Colaborador }[]>`select dados from colaboradores order by dados->>'nome'`).map((r) => r.dados);
    this.cache = { em: Date.now(), lista };
    return lista;
  }
  async buscarColaboradores(termo: string, limite?: number) { return buscarEm(await this.todos(), termo, limite); }
  async getColaborador(id: string) { return (await this.todos()).find((c) => c.id === id); }
  async listarColaboradores() { return this.todos(); }
  async salvarColaborador(c: Colaborador) {
    await this.iniciar();
    await this.sql`insert into colaboradores (id, dados) values (${c.id}, ${this.sql.json(c as never)})
      on conflict (id) do update set dados = excluded.dados, atualizado_em = now()`;
    this.cache = undefined;
  }
  async excluirColaborador(id: string) {
    await this.iniciar();
    const r = await this.sql`delete from colaboradores where id = ${id}`;
    this.cache = undefined;
    return r.count > 0;
  }
  getQuestoes(categoria: Categoria) { return this.base.getQuestoes(categoria); }

  async salvarTentativa(t: Tentativa) {
    await this.iniciar();
    await this.sql`insert into tentativas (id, colaborador_id, categoria, iniciada_em, finalizada_em, dados)
      values (${t.id}, ${t.colaboradorId}, ${t.categoria}, ${t.iniciadaEm}, ${t.finalizadaEm ?? null}, ${this.sql.json(t as never)})
      on conflict (id) do update set finalizada_em = excluded.finalizada_em, dados = excluded.dados`;
  }
  async getTentativa(id: string) {
    await this.iniciar();
    const r = await this.sql<{ dados: Tentativa }[]>`select dados from tentativas where id = ${id}`;
    return r[0]?.dados;
  }
  async listarTentativas() {
    await this.iniciar();
    return (await this.sql<{ dados: Tentativa }[]>`select dados from tentativas order by iniciada_em`).map((r) => r.dados);
  }

  async excluirTentativa(id: string) {
    await this.iniciar();
    return (await this.sql`delete from tentativas where id = ${id}`).count > 0;
  }
  async excluirAvaliacaoPratica(id: string) {
    await this.iniciar();
    return (await this.sql`delete from avaliacoes_praticas where id = ${id}`).count > 0;
  }

  async salvarAvaliacaoPratica(a: AvaliacaoPratica) {
    await this.iniciar();
    await this.sql`insert into avaliacoes_praticas (id, realizada_em, dados) values (${a.id}, ${a.realizadaEm}, ${this.sql.json(a as never)})
      on conflict (id) do update set realizada_em = excluded.realizada_em, dados = excluded.dados`;
  }
  async listarAvaliacoesPraticas() {
    await this.iniciar();
    return (await this.sql<{ dados: AvaliacaoPratica }[]>`select dados from avaliacoes_praticas order by realizada_em desc nulls last`).map((r) => r.dados);
  }

  async salvarEvidencia(meta: Evidencia, imagem: Uint8Array) {
    await this.iniciar();
    await this.sql`insert into evidencias (id, meta, imagem) values (${meta.id}, ${this.sql.json(meta as never)}, ${Buffer.from(imagem)})`;
  }
  async getEvidencia(id: string) {
    await this.iniciar();
    const r = await this.sql<{ meta: Evidencia }[]>`select meta from evidencias where id = ${id}`;
    return r[0]?.meta ?? null;
  }
  async getEvidenciaImagem(id: string) {
    await this.iniciar();
    const r = await this.sql<{ imagem: Buffer }[]>`select imagem from evidencias where id = ${id}`;
    return r[0] ? new Uint8Array(r[0].imagem) : null;
  }
}
