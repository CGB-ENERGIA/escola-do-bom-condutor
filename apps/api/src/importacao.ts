import type { AusentesAcao, Colaborador, ImportacaoRes } from "@ebc/shared";
import { lerPlanilha, type Tabela } from "./planilha";

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/\s+/g, " ").trim();
const texto = (v: string | number | null | undefined) => (v === null || v === undefined ? null : String(v).trim() || null);

/** Nomes por extenso das bases viram a sigla usada em todo o sistema. */
const SIGLAS: Record<string, string> = {
  "BACABAL": "BCB", "SANTA INES": "STI", "ITAPECURU MIRIM": "ITM", "PEDREIRAS": "PDS", "PRESIDENTE DUTRA": "PDT", "BARRA DO CORDA": "BDC",
};
export const siglaBase = (b: string | null) => (b ? (SIGLAS[norm(b)] ?? b.trim().toUpperCase()) : null);

/** Cabeçalhos aceitos (sem acento/maiúsculas) para cada campo. */
const CABECALHOS: Record<string, string[]> = {
  chapa: ["CHAPA", "MATRICULA", "MATRÍCULA", "ID"],
  nome: ["NOME", "COLABORADOR"],
  funcao: ["FUNCAO", "CARGO"],
  base: ["BASE"],
  processo: ["PROCESSO"],
  gerencia: ["GERENCIA"],
  gerente: ["COORDENADOR", "GERENTE"],
  situacao: ["SITUACAO", "STATUS"],
};

/** Campos que, quando mudam, contam como alteração (e que a tela mostra no resumo). */
const CAMPOS: (keyof Colaborador)[] = ["nome", "funcao", "base", "gerencia", "processo", "gerente", "situacao"];
const ROTULO: Record<string, string> = { nome: "Nome", funcao: "Função", base: "Base", gerencia: "Gerência", processo: "Processo", gerente: "Coordenador", situacao: "Situação" };

export class ErroPlanilha extends Error {}

/** Converte a tabela lida em colaboradores (um por chapa; quem aparece em vários processos tem os processos unidos). */
export function converter(tabela: Tabela) {
  const idxCab = tabela.findIndex((l) => l.some((c) => c !== null && CABECALHOS.chapa!.some((n) => norm(n) === norm(String(c)))));
  if (idxCab < 0) throw new ErroPlanilha("Não encontrei a coluna CHAPA na planilha. A primeira linha precisa ter os títulos: CHAPA, NOME, FUNÇÃO, BASE, PROCESSO, GERENCIA, SITUAÇÃO.");
  const cab = tabela[idxCab]!.map((c) => (c === null ? "" : norm(String(c))));
  const col = (campo: string) => cab.findIndex((h) => CABECALHOS[campo]!.some((n) => norm(n) === h));
  const ix = Object.fromEntries(Object.keys(CABECALHOS).map((k) => [k, col(k)])) as Record<string, number>;
  if (ix.nome! < 0) throw new ErroPlanilha("Não encontrei a coluna NOME na planilha.");

  const porChapa = new Map<string, Colaborador & { _processos: string[] }>();
  const ignorados: string[] = [];
  let duplicados = 0, linhas = 0;
  for (const [i, l] of tabela.slice(idxCab + 1).entries()) {
    if (l.every((c) => c === null)) continue;
    linhas++;
    let chapa = texto(l[ix.chapa!]);
    const nome = texto(l[ix.nome!]);
    if (chapa && /^\d+\.0$/.test(chapa)) chapa = chapa.slice(0, -2);
    if (!chapa || !nome) { ignorados.push(`Linha ${idxCab + 2 + i}: ${!chapa ? "sem chapa" : "sem nome"}${nome ? ` (${nome})` : ""}`); continue; }
    const processo = ix.processo! >= 0 ? texto(l[ix.processo!]) : null;
    const ex = porChapa.get(chapa);
    if (ex) { duplicados++; if (processo && !ex._processos.includes(processo)) ex._processos.push(processo); continue; }
    porChapa.set(chapa, {
      id: chapa, matricula: chapa, nome,
      funcao: ix.funcao! >= 0 ? texto(l[ix.funcao!]) : null,
      base: ix.base! >= 0 ? siglaBase(texto(l[ix.base!])) : null,
      gerencia: ix.gerencia! >= 0 ? texto(l[ix.gerencia!])?.toUpperCase() ?? null : null,
      gerente: ix.gerente! >= 0 ? texto(l[ix.gerente!]) : undefined,
      situacao: ix.situacao! >= 0 ? (texto(l[ix.situacao!])?.toUpperCase() ?? "ATIVO") : "ATIVO",
      _processos: processo ? [processo] : [],
    });
  }
  const lista: Colaborador[] = [...porChapa.values()].map(({ _processos, ...c }) => {
    const out: Colaborador = { ...c, processo: _processos.length ? _processos.join(" / ") : null };
    if (out.gerente === undefined) delete out.gerente;
    return out;
  });
  return { lista, linhas, duplicados, ignorados, temColuna: (campo: string) => ix[campo]! >= 0 };
}

const igual = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

/**
 * Coordenador que um colaborador novo herda: o mais comum entre quem já está na mesma gerência e base
 * (ou, se não houver ninguém na base, o coordenador da gerência quando for um só). O campo se chama "gerente" no código.
 */
export function gerentePadrao(atual: Colaborador[], gerencia: string | null | undefined, base: string | null | undefined): string | null {
  if (!gerencia) return null;
  const moda = (xs: Colaborador[]) => {
    const n = new Map<string, number>();
    for (const c of xs) if (c.gerente) n.set(c.gerente, (n.get(c.gerente) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]);
  };
  const ativos = atual.filter((c) => c.gerencia === gerencia && c.situacao !== "TESTE");
  const daBase = moda(ativos.filter((c) => c.base === base));
  if (daBase.length) return daBase[0]![0];
  const daGerencia = moda(ativos);
  return daGerencia.length === 1 ? daGerencia[0]![0] : null;
}

/**
 * Compara a planilha com a base atual. Quem tem a mesma chapa é atualizado; chapa nova entra;
 * quem está na base e não veio na planilha é "ausente" (desligado, excluído ou mantido, conforme `ausentes`).
 * Só se aplica quando `aplicar` é verdadeiro (senão devolve apenas a prévia).
 */
export async function importar(opts: {
  bytes: Uint8Array; nomeArquivo: string; atual: Colaborador[]; aplicar: boolean; ausentes: AusentesAcao;
  salvar: (c: Colaborador) => Promise<void>; excluir: (id: string) => Promise<boolean>;
}): Promise<ImportacaoRes> {
  let tabela: Tabela;
  try { tabela = lerPlanilha(opts.bytes); }
  catch (e) { throw new ErroPlanilha(e instanceof Error ? e.message : "Não foi possível ler o arquivo."); }
  const { lista, linhas, duplicados, ignorados, temColuna } = converter(tabela);
  if (lista.length === 0) throw new ErroPlanilha("A planilha não tem nenhum colaborador válido.");

  const atual = new Map(opts.atual.map((c) => [c.id, c]));
  const novos: Colaborador[] = [];
  const alterados: ImportacaoRes["alterados"] = [];
  let semMudanca = 0;
  for (const n of lista) {
    const a = atual.get(n.id);
    if (!a) {
      // sem coluna de coordenador na planilha: o novo colaborador herda o da gerência/base
      if (!n.gerente) { const g = gerentePadrao(opts.atual, n.gerencia, n.base); if (g) n.gerente = g; }
      novos.push(n); continue;
    }
    // campos que a planilha não traz (ex.: coordenador) ficam como estão na base
    const campos = CAMPOS.filter((k) => (k !== "gerente" || temColuna("gerente")) && !igual(a[k], n[k]));
    if (campos.length === 0) { semMudanca++; continue; }
    const depois: Colaborador = { ...a };
    for (const k of campos) (depois as Record<string, unknown>)[k] = n[k] ?? null;
    alterados.push({ antes: a, depois, campos: campos.map((k) => ROTULO[k as string]!) });
  }
  const naPlanilha = new Set(lista.map((c) => c.id));
  // quem já está desligado / fora da base e o colaborador de testes não contam como "ausentes"
  const ausentes = opts.atual.filter((c) => !naPlanilha.has(c.id) && c.situacao !== "TESTE" && c.situacao !== "DESLIGADO" && c.situacao !== "FORA DA BASE");

  if (opts.aplicar) {
    for (const c of novos) await opts.salvar(c);
    for (const a of alterados) await opts.salvar(a.depois);
    for (const c of ausentes) {
      if (opts.ausentes === "excluir") await opts.excluir(c.id);
      else if (opts.ausentes === "desligar") await opts.salvar({ ...c, situacao: "DESLIGADO" });
    }
  }
  return {
    aplicada: opts.aplicar, arquivo: { nome: opts.nomeArquivo, linhas, validos: lista.length, duplicados, ignorados },
    novos, alterados, ausentes, semMudanca,
  };
}
