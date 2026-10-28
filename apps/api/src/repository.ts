import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AvaliacaoPratica, Colaborador, Evidencia, Questao, Categoria, Tentativa } from "@ebc/shared";
import { avaliacoesPraticasHistorico, colaboradores, questoesPorCategoria } from "./seed";

/**
 * Camada de dados abstrata.
 * Sem DATABASE_URL: MemoryRepository (desenvolvimento). Com DATABASE_URL: PgRepository (repositoryPg.ts).
 */
export interface Repository {
  /** true quando as alterações ficam guardadas (banco de dados); false = só memória. */
  readonly persistente: boolean;
  buscarColaboradores(termo: string, limite?: number): Promise<Colaborador[]>;
  getColaborador(id: string): Promise<Colaborador | undefined>;
  /** Base completa de colaboradores (inclusive desligados / fora da base), para a tela de Configuração. */
  listarColaboradores(): Promise<Colaborador[]>;
  salvarColaborador(c: Colaborador): Promise<void>;
  excluirColaborador(id: string): Promise<boolean>;
  getQuestoes(categoria: Categoria): Promise<Questao[]>;
  salvarTentativa(t: Tentativa): Promise<void>;
  getTentativa(id: string): Promise<Tentativa | undefined>;
  listarTentativas(): Promise<Tentativa[]>;
  excluirTentativa(id: string): Promise<boolean>;
  salvarAvaliacaoPratica(a: AvaliacaoPratica): Promise<void>;
  listarAvaliacoesPraticas(): Promise<AvaliacaoPratica[]>;
  excluirAvaliacaoPratica(id: string): Promise<boolean>;
  salvarEvidencia(meta: Evidencia, imagem: Uint8Array): Promise<void>;
  getEvidencia(id: string): Promise<Evidencia | null>;
  getEvidenciaImagem(id: string): Promise<Uint8Array | null>;
}

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** Quem não deve aparecer na busca da prova (só existe para o histórico). */
export const FORA_DA_BUSCA = new Set(["FORA DA BASE", "DESLIGADO"]);

/** Busca por nome ou matrícula: todas as palavras digitadas precisam aparecer. */
export function buscarEm(lista: Colaborador[], termo: string, limite = 8): Colaborador[] {
  const partes = normalizar(termo).split(/\s+/).filter(Boolean);
  if (partes.length === 0) return [];
  const out: Colaborador[] = [];
  for (const c of lista) {
    if (c.situacao && FORA_DA_BUSCA.has(c.situacao)) continue;
    const texto = normalizar(`${c.nome} ${c.matricula ?? ""}`);
    if (partes.every((p) => texto.includes(p))) { out.push(c); if (out.length >= limite) break; }
  }
  return out;
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Pasta das fotos no desenvolvimento local (apps/api/data/evidencias). */
const PASTA = join(process.cwd(), "data", "evidencias");

/** Implementação em memória, apenas para desenvolvimento/testes (fotos em disco). */
export class MemoryRepository implements Repository {
  readonly persistente = false;
  private tentativas = new Map<string, Tentativa>();
  private praticas = new Map<string, AvaliacaoPratica>(avaliacoesPraticasHistorico.map((a) => [a.id, a]));
  private pessoas = new Map<string, Colaborador>(colaboradores.map((c) => [c.id, c]));

  async buscarColaboradores(termo: string, limite = 8) { return buscarEm([...this.pessoas.values()], termo, limite); }
  async getColaborador(id: string) { return this.pessoas.get(id); }
  async listarColaboradores() { return [...this.pessoas.values()]; }
  async salvarColaborador(c: Colaborador) { this.pessoas.set(c.id, c); }
  async excluirColaborador(id: string) { return this.pessoas.delete(id); }

  async getQuestoes(categoria: Categoria) { return questoesPorCategoria[categoria]; }
  async salvarTentativa(t: Tentativa) { this.tentativas.set(t.id, t); }
  async getTentativa(id: string) { return this.tentativas.get(id); }
  async listarTentativas() { return [...this.tentativas.values()]; }
  async excluirTentativa(id: string) { return this.tentativas.delete(id); }
  async salvarAvaliacaoPratica(a: AvaliacaoPratica) { this.praticas.set(a.id, a); }
  async listarAvaliacoesPraticas() { return [...this.praticas.values()]; }
  async excluirAvaliacaoPratica(id: string) { return this.praticas.delete(id); }

  async salvarEvidencia(meta: Evidencia, imagem: Uint8Array) {
    await mkdir(PASTA, { recursive: true });
    await writeFile(join(PASTA, `${meta.id}.jpg`), imagem);
    await writeFile(join(PASTA, `${meta.id}.json`), JSON.stringify(meta));
  }
  async getEvidencia(id: string) {
    if (!ID.test(id)) return null;
    try { return JSON.parse(await readFile(join(PASTA, `${id}.json`), "utf8")) as Evidencia; } catch { return null; }
  }
  async getEvidenciaImagem(id: string) {
    if (!ID.test(id)) return null;
    try { return new Uint8Array(await readFile(join(PASTA, `${id}.jpg`))); } catch { return null; }
  }
}
