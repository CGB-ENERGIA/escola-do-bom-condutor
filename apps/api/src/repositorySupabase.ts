import type { AvaliacaoPratica, Categoria, Colaborador, Evidencia, Tentativa } from "@ebc/shared";
import { MemoryRepository, buscarEm, type Repository } from "./repository";
import { avaliacoesPraticasHistorico, colaboradores } from "./seed";

const PAGINA = 1000; // limite padrão de linhas por resposta do Supabase

/**
 * Repositório que usa a API REST do Supabase (PostgREST) com a chave service_role, sem conexão direta ao Postgres.
 * As tabelas vêm de scripts/supabase.sql. A base de colaboradores e o histórico prático são carregados uma única vez.
 */
export class SupabaseRepository implements Repository {
  readonly persistente = true;
  private base = new MemoryRepository(); // questões (dados estáticos)
  private pronto?: Promise<void>;
  private cache?: { em: number; lista: Colaborador[] };
  private url: string;

  constructor(url: string, private chave: string) {
    this.url = url.replace(/\/+$/, "") + "/rest/v1";
  }

  private async req(caminho: string, init: RequestInit & { prefer?: string } = {}) {
    const { prefer, ...resto } = init;
    const r = await fetch(`${this.url}/${caminho}`, {
      ...resto,
      headers: { apikey: this.chave, Authorization: `Bearer ${this.chave}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(r.status === 404 ? `Tabela não encontrada no Supabase (rode scripts/supabase.sql): ${caminho.split("?")[0]}` : `Supabase ${r.status}: ${txt.slice(0, 200)}`);
    }
    return r;
  }

  /** Lê todas as linhas, página a página. */
  private async ler<T>(tabela: string, colunas: string, filtro = ""): Promise<T[]> {
    const todas: T[] = [];
    for (let de = 0; ; de += PAGINA) {
      const r = await this.req(`${tabela}?select=${colunas}${filtro}&order=id&limit=${PAGINA}&offset=${de}`);
      const lote = (await r.json()) as T[];
      todas.push(...lote);
      if (lote.length < PAGINA) return todas;
    }
  }

  private async gravar(tabela: string, linhas: object[]) {
    if (!linhas.length) return;
    await this.req(tabela, { method: "POST", body: JSON.stringify(linhas), prefer: "resolution=merge-duplicates,return=minimal" });
  }

  private iniciar() {
    return (this.pronto ??= (async () => {
      const existe = async (t: string) => ((await (await this.req(`${t}?select=id&limit=1`)).json()) as unknown[]).length > 0;
      if (!(await existe("colaboradores"))) {
        for (let i = 0; i < colaboradores.length; i += 200)
          await this.req("colaboradores", {
            method: "POST", prefer: "resolution=ignore-duplicates,return=minimal",
            body: JSON.stringify(colaboradores.slice(i, i + 200).map((x) => ({ id: x.id, dados: x }))),
          });
      }
      if (!(await existe("avaliacoes_praticas"))) {
        for (let i = 0; i < avaliacoesPraticasHistorico.length; i += 200)
          await this.req("avaliacoes_praticas", {
            method: "POST", prefer: "resolution=ignore-duplicates,return=minimal",
            body: JSON.stringify(avaliacoesPraticasHistorico.slice(i, i + 200).map((a) => ({ id: a.id, realizada_em: a.realizadaEm, dados: a }))),
          });
      }
    })().catch((e) => { this.pronto = undefined; throw e; }));
  }

  private async todos(): Promise<Colaborador[]> {
    if (this.cache && Date.now() - this.cache.em < 10_000) return this.cache.lista;
    await this.iniciar();
    const lista = (await this.ler<{ dados: Colaborador }>("colaboradores", "dados")).map((r) => r.dados)
      .sort((a, b) => a.nome.localeCompare(b.nome));
    this.cache = { em: Date.now(), lista };
    return lista;
  }
  async buscarColaboradores(termo: string, limite?: number) { return buscarEm(await this.todos(), termo, limite); }
  async getColaborador(id: string) { return (await this.todos()).find((c) => c.id === id); }
  async listarColaboradores() { return this.todos(); }
  async salvarColaborador(c: Colaborador) {
    await this.iniciar();
    await this.gravar("colaboradores", [{ id: c.id, dados: c, atualizado_em: new Date().toISOString() }]);
    this.cache = undefined;
  }
  async excluirColaborador(id: string) {
    await this.iniciar();
    const r = await this.req(`colaboradores?id=eq.${encodeURIComponent(id)}&select=id`, { method: "DELETE", prefer: "return=representation" });
    this.cache = undefined;
    return ((await r.json()) as unknown[]).length > 0;
  }
  getQuestoes(categoria: Categoria) { return this.base.getQuestoes(categoria); }

  async salvarTentativa(t: Tentativa) {
    await this.iniciar();
    await this.gravar("tentativas", [{ id: t.id, colaborador_id: t.colaboradorId, categoria: t.categoria, iniciada_em: t.iniciadaEm, finalizada_em: t.finalizadaEm ?? null, dados: t }]);
  }
  async getTentativa(id: string) {
    await this.iniciar();
    const r = await this.req(`tentativas?select=dados&id=eq.${encodeURIComponent(id)}`);
    return ((await r.json()) as { dados: Tentativa }[])[0]?.dados;
  }
  async listarTentativas() {
    await this.iniciar();
    return (await this.ler<{ dados: Tentativa }>("tentativas", "dados")).map((r) => r.dados)
      .sort((a, b) => a.iniciadaEm.localeCompare(b.iniciadaEm));
  }

  async salvarAvaliacaoPratica(a: AvaliacaoPratica) {
    await this.iniciar();
    await this.gravar("avaliacoes_praticas", [{ id: a.id, realizada_em: a.realizadaEm, dados: a }]);
  }
  async listarAvaliacoesPraticas() {
    await this.iniciar();
    return (await this.ler<{ dados: AvaliacaoPratica }>("avaliacoes_praticas", "dados")).map((r) => r.dados)
      .sort((a, b) => (b.realizadaEm ?? "").localeCompare(a.realizadaEm ?? ""));
  }

  async salvarEvidencia(meta: Evidencia, imagem: Uint8Array) {
    await this.iniciar();
    await this.gravar("evidencias", [{ id: meta.id, meta, imagem: Buffer.from(imagem).toString("base64") }]);
  }
  async getEvidencia(id: string) {
    await this.iniciar();
    const r = await this.req(`evidencias?select=meta&id=eq.${encodeURIComponent(id)}`);
    return ((await r.json()) as { meta: Evidencia }[])[0]?.meta ?? null;
  }
  async getEvidenciaImagem(id: string) {
    await this.iniciar();
    const r = await this.req(`evidencias?select=imagem&id=eq.${encodeURIComponent(id)}`);
    const linha = ((await r.json()) as { imagem: string }[])[0];
    return linha ? new Uint8Array(Buffer.from(linha.imagem, "base64")) : null;
  }
}
