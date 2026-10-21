import type { AvaliacaoPratica, Colaborador, Questao, Categoria, Tentativa } from "@ebc/shared";
import { avaliacoesPraticasHistorico, colaboradores, questoesPorCategoria } from "./seed";

/**
 * Camada de dados abstrata. O banco ainda será definido:
 * basta implementar esta interface (SQLite, Postgres, etc.).
 */
export interface Repository {
  buscarColaboradores(termo: string, limite?: number): Promise<Colaborador[]>;
  getColaborador(id: string): Promise<Colaborador | undefined>;
  getQuestoes(categoria: Categoria): Promise<Questao[]>;
  salvarTentativa(t: Tentativa): Promise<void>;
  getTentativa(id: string): Promise<Tentativa | undefined>;
  listarTentativas(): Promise<Tentativa[]>;
  salvarAvaliacaoPratica(a: AvaliacaoPratica): Promise<void>;
  listarAvaliacoesPraticas(): Promise<AvaliacaoPratica[]>;
}

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** Implementação em memória, apenas para desenvolvimento/testes. */
export class MemoryRepository implements Repository {
  private tentativas = new Map<string, Tentativa>();
  private praticas = new Map<string, AvaliacaoPratica>(avaliacoesPraticasHistorico.map((a) => [a.id, a]));
  private indice = colaboradores.map((c) => ({
    c,
    texto: normalizar(`${c.nome} ${c.matricula ?? ""}`),
  }));

  async buscarColaboradores(termo: string, limite = 8) {
    const partes = normalizar(termo).split(/\s+/).filter(Boolean);
    if (partes.length === 0) return [];
    return this.indice
      .filter(({ texto }) => partes.every((p) => texto.includes(p)))
      .slice(0, limite)
      .map(({ c }) => c);
  }
  async getColaborador(id: string) { return colaboradores.find((c) => c.id === id); }
  async getQuestoes(categoria: Categoria) { return questoesPorCategoria[categoria]; }
  async salvarTentativa(t: Tentativa) { this.tentativas.set(t.id, t); }
  async getTentativa(id: string) { return this.tentativas.get(id); }
  async listarTentativas() { return [...this.tentativas.values()]; }
  async salvarAvaliacaoPratica(a: AvaliacaoPratica) { this.praticas.set(a.id, a); }
  async listarAvaliacoesPraticas() { return [...this.praticas.values()]; }
}
