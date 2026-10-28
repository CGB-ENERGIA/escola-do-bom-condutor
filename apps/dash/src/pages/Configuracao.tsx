import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { AusentesAcao, BaseColaboradoresRes, Colaborador, ImportacaoRes } from "@ebc/shared";
import { Fechar } from "../components/Icones";
import { api, sessao } from "../lib/api";
import { baixarCsv } from "../lib/csv";
import { Indicadores } from "../lib/filtros";

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
const SEM_GERENTE = "__sem";
const SITUACOES = ["ATIVO", "FÉRIAS", "AFASTADO", "DESLIGADO"];
const POR_PAGINA = 50;
const sel = "inp !py-2.5 !text-sm";

type Aba = { t: "colab"; colab?: Colaborador } | { t: "excluir"; colab: Colaborador } | { t: "importar" } | { t: "gerente" } | null;

const corSituacao = (s?: string | null) =>
  s === "ATIVO" ? "chip-ok" : s === "FÉRIAS" || s === "AFASTADO" ? "chip-warn" : s === "DESLIGADO" || s === "FORA DA BASE" ? "chip-bad" : "";

/** Janela de diálogo simples (fecha com Esc ou clicando fora). */
export function Modal({ titulo, onFechar, children, largo }: { titulo: string; onFechar: () => void; children: ReactNode; largo?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFechar]);
  return (
    <div className="af fixed inset-0 z-50 grid place-items-center p-3 sm:p-6" style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(4px)" }} onClick={onFechar}>
      <div role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}
        className={`ap card flex max-h-[92dvh] w-full flex-col overflow-hidden ${largo ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-lg font-extrabold tracking-tight">{titulo}</h2>
          <button type="button" className="icon-btn" onClick={onFechar} aria-label="Fechar"><Fechar width={18} height={18} /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** Configuração: base de colaboradores (consultar, editar, excluir, incluir, importar e exportar). */
export default function Configuracao() {
  const nav = useNavigate();
  const [res, setRes] = useState<BaseColaboradoresRes>();
  const [erro, setErro] = useState<string>();
  const [aba, setAba] = useState<Aba>(null);
  const [aviso, setAviso] = useState<string>();
  const [busca, setBusca] = useState("");
  const [base, setBase] = useState("");
  const [gerencia, setGerencia] = useState("");
  const [gerente, setGerente] = useState("");
  const [situacao, setSituacao] = useState("");
  const [pagina, setPagina] = useState(0);

  const carregar = useCallback(async () => {
    try { setRes(await api.base()); setErro(undefined); }
    catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("Sessão")) { sessao.limpar(); nav("/login"); return; }
      setErro(msg);
    }
  }, [nav]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { setPagina(0); }, [busca, base, gerencia, gerente, situacao]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(undefined), 6000); return () => clearTimeout(t); }, [aviso]);

  const editavel = !!res?.editavel;
  const todos = useMemo(() => res?.colaboradores ?? [], [res]);
  // o colaborador de testes não entra nas contagens
  const reais = useMemo(() => todos.filter((c) => c.situacao !== "TESTE"), [todos]);

  const passa = (c: Colaborador, ignorar?: "base" | "gerencia" | "gerente" | "situacao") => {
    const t = norm(busca);
    return (!t || t.split(/\s+/).every((p) => norm(`${c.nome} ${c.matricula ?? ""}`).includes(p))) &&
      (ignorar === "base" || !base || c.base === base) &&
      (ignorar === "gerencia" || !gerencia || c.gerencia === gerencia) &&
      (ignorar === "gerente" || !gerente || (gerente === SEM_GERENTE ? !c.gerente : c.gerente === gerente)) &&
      (ignorar === "situacao" || !situacao || (c.situacao ?? "ATIVO") === situacao);
  };
  const filtrados = reais.filter((c) => passa(c));
  const distintos = (f: (c: Colaborador) => string | null | undefined) => [...new Set(reais.map(f).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
  const bases = distintos((c) => c.base);
  const gerencias = distintos((c) => c.gerencia);
  const gerentes = distintos((c) => c.gerente);
  const processos = distintos((c) => c.processo);
  const situacoes = [...new Set([...SITUACOES, ...distintos((c) => c.situacao)])];

  const conta = (f: (c: Colaborador) => boolean) => reais.filter(f).length;
  const ativos = conta((c) => (c.situacao ?? "ATIVO") === "ATIVO");
  const ferias = conta((c) => c.situacao === "FÉRIAS");
  const inativos = conta((c) => c.situacao === "DESLIGADO" || c.situacao === "FORA DA BASE");

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const visiveis = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const filtrando = !!(busca || base || gerencia || gerente || situacao);

  const exportar = () => baixarCsv("colaboradores",
    ["CHAPA", "NOME", "FUNÇÃO", "BASE", "PROCESSO", "GERENCIA", "COORDENADOR", "SITUAÇÃO"],
    filtrados.map((c) => [c.matricula ?? c.id, c.nome, c.funcao, c.base, c.processo, c.gerencia, c.gerente, c.situacao]));

  const concluiu = async (msg: string) => { setAba(null); setAviso(msg); await carregar(); };

  return (
    <section className="space-y-5">
      <div className="au flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Configuração <span style={{ color: "var(--p)" }}>· colaboradores</span></h1>
          <p className="muted mt-1 text-sm">Base de colaboradores usada na prova, na ficha do instrutor e nos relatórios.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-p !py-2.5 !text-sm" disabled={!editavel} onClick={() => setAba({ t: "colab" })}>+ Novo colaborador</button>
          <button className="btn btn-g !py-2.5 !text-sm" onClick={() => setAba({ t: "importar" })}>Importar planilha</button>
          <button className="btn btn-g !py-2.5 !text-sm" onClick={exportar} disabled={filtrados.length === 0}>Exportar CSV</button>
          <button className="btn btn-g !py-2.5 !text-sm" disabled={!editavel} onClick={() => setAba({ t: "gerente" })}>Definir coordenador</button>
        </div>
      </div>

      {res && !res.editavel && (
        <p className="alert af" role="alert">
          O banco de dados ainda não está configurado, por isso esta tela está só para consulta. Para editar, importar e excluir é preciso
          configurar o banco de dados (<strong>DATABASE_URL</strong>) na Vercel.
        </p>
      )}
      {res && res.editavel && !res.persistente && (
        <p className="alert af" role="status" style={{ background: "var(--w-tint)", color: "var(--w)", borderColor: "color-mix(in srgb, var(--w) 25%, transparent)" }}>
          Modo de desenvolvimento: sem banco de dados, as alterações ficam só na memória e somem quando a API reinicia.
        </p>
      )}
      {aviso && <p className="chip chip-ok af" role="status" style={{ padding: ".6rem .9rem", fontSize: ".8rem" }}>{aviso}</p>}
      {erro && <p className="alert af" role="alert">{erro}</p>}
      {!res && !erro && <div className="skel" style={{ height: 110 }} />}

      {res && (
        <>
          <Indicadores itens={[
            { rot: "Colaboradores na base", val: String(reais.length), cor: "var(--i)" },
            { rot: "Ativos", val: String(ativos), cor: "var(--p)" },
            { rot: "Em férias", val: String(ferias), cor: "var(--w)" },
            { rot: "Desligados / fora da base", val: String(inativos), cor: "var(--d)" },
          ]} />

          {/* Resumo por base e por gerência (clique para filtrar) */}
          <div className="card au d2 grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
            {([
              ["Por base", bases, base, setBase, "base"],
              ["Por gerência", gerencias, gerencia, setGerencia, "gerencia"],
            ] as const).map(([titulo, itens, atual, definir, ignorar]) => (
              <div key={titulo}>
                <p className="muted mb-2 text-xs font-bold uppercase tracking-wider">{titulo}</p>
                <div className="flex flex-wrap gap-2">
                  {itens.map((v) => {
                    const n = reais.filter((c) => passa(c, ignorar) && (ignorar === "base" ? c.base === v : c.gerencia === v)).length;
                    const ativo = atual === v;
                    return (
                      <button key={v} type="button" aria-pressed={ativo} onClick={() => definir(ativo ? "" : v)}
                        className="rounded-[var(--r)] px-3 py-1.5 text-left transition-all"
                        style={{ border: `1.5px solid ${ativo ? "var(--p)" : "var(--border)"}`, background: ativo ? "var(--p-tint)" : "var(--surface)", cursor: "pointer", font: "inherit", color: "inherit", opacity: atual && !ativo ? 0.55 : 1 }}>
                        <span className="text-xs font-extrabold">{v}</span>
                        <span className="ml-2 text-sm font-bold" style={{ color: "var(--p)", fontVariantNumeric: "tabular-nums" }}>{n}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div className="card au d3 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <label className="col-span-2 text-xs font-semibold md:col-span-3 lg:col-span-2">Buscar
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou chapa" className={`${sel} mt-1`} />
              </label>
              <label className="text-xs font-semibold">Base
                <select value={base} onChange={(e) => setBase(e.target.value)} className={`${sel} mt-1`}>
                  <option value="">Todas</option>{bases.map((b) => <option key={b}>{b}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold">Gerência
                <select value={gerencia} onChange={(e) => setGerencia(e.target.value)} className={`${sel} mt-1`}>
                  <option value="">Todas</option>{gerencias.map((g) => <option key={g}>{g}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold">Coordenador
                <select value={gerente} onChange={(e) => setGerente(e.target.value)} className={`${sel} mt-1`}>
                  <option value="">Todos</option>
                  <option value={SEM_GERENTE}>(sem coordenador definido)</option>
                  {gerentes.map((g) => <option key={g}>{g}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold">Situação
                <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className={`${sel} mt-1`}>
                  <option value="">Todas</option>{situacoes.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            {filtrando && (
              <div className="af mt-3 flex items-center gap-3 text-xs">
                <span className="muted">Mostrando <strong style={{ color: "var(--fg)" }}>{filtrados.length}</strong> de {reais.length}</span>
                <button className="link" onClick={() => { setBusca(""); setBase(""); setGerencia(""); setGerente(""); setSituacao(""); }}>Limpar filtros</button>
              </div>
            )}
          </div>

          {/* Tabela */}
          <section className="card au p-4 sm:p-5">
            {filtrados.length === 0 ? (
              <p className="faint grid min-h-[8rem] place-items-center text-sm">Nenhum colaborador encontrado.</p>
            ) : (
              <div className="tabela-wrap">
                <table className="tabela">
                  <thead>
                    <tr><th>Chapa</th><th>Nome</th><th>Função</th><th>Base</th><th>Gerência</th><th>Coordenador</th><th>Processo</th><th>Situação</th><th style={{ textAlign: "right" }}>Ações</th></tr>
                  </thead>
                  <tbody>
                    {visiveis.map((c) => (
                      <tr key={c.id}>
                        <td className="whitespace-nowrap font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{c.matricula ?? c.id}</td>
                        <td style={{ minWidth: "14rem" }} className="font-semibold">{c.nome}</td>
                        <td style={{ minWidth: "11rem" }}>{c.funcao ?? "—"}</td>
                        <td className="whitespace-nowrap font-semibold">{c.base ?? "—"}</td>
                        <td className="whitespace-nowrap">{c.gerencia ?? "—"}</td>
                        <td className="whitespace-nowrap">{c.gerente ?? <span className="faint">—</span>}</td>
                        <td style={{ minWidth: "9rem" }}>{c.processo ?? "—"}</td>
                        <td><span className={`chip ${corSituacao(c.situacao)} !py-0.5`} style={corSituacao(c.situacao) ? undefined : { background: "var(--surface-3)" }}>{c.situacao ?? "ATIVO"}</span></td>
                        <td className="whitespace-nowrap" style={{ textAlign: "right" }}>
                          <button className="link text-xs" disabled={!editavel} onClick={() => setAba({ t: "colab", colab: c })}>Editar</button>
                          <button className="link ml-3 text-xs" style={{ color: "var(--d)" }} disabled={!editavel} onClick={() => setAba({ t: "excluir", colab: c })}>Excluir</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {totalPaginas > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3 text-sm">
                <button className="btn btn-g !px-3 !py-1.5 !text-sm" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>← Anterior</button>
                <span className="muted">Página <strong style={{ color: "var(--fg)" }}>{pagina + 1}</strong> de {totalPaginas}</span>
                <button className="btn btn-g !px-3 !py-1.5 !text-sm" disabled={pagina >= totalPaginas - 1} onClick={() => setPagina((p) => p + 1)}>Próxima →</button>
              </div>
            )}
          </section>
        </>
      )}

      {aba?.t === "colab" && (
        <FormColaborador inicial={aba.colab} bases={bases} gerencias={gerencias} processos={processos} situacoes={situacoes}
          onFechar={() => setAba(null)} onSalvo={(m) => concluiu(m)} />
      )}
      {aba?.t === "excluir" && <Excluir colab={aba.colab} onFechar={() => setAba(null)} onFeito={(m) => concluiu(m)} />}
      {aba?.t === "gerente" && <GerenteEmLote gerencias={gerencias} bases={bases} reais={reais} onFechar={() => setAba(null)} onFeito={(m) => concluiu(m)} />}
      {aba?.t === "importar" && <Importar editavel={editavel} totalAtivos={ativos} onFechar={() => setAba(null)} onFeito={(m) => concluiu(m)} />}
    </section>
  );
}

/* ───────────────────────── novo / editar ───────────────────────── */

function FormColaborador({ inicial, bases, gerencias, processos, situacoes, onFechar, onSalvo }: {
  inicial?: Colaborador; bases: string[]; gerencias: string[]; processos: string[]; situacoes: string[];
  onFechar: () => void; onSalvo: (msg: string) => void;
}) {
  const novo = !inicial;
  const [f, setF] = useState({
    chapa: inicial?.matricula ?? inicial?.id ?? "", nome: inicial?.nome ?? "", funcao: inicial?.funcao ?? "", base: inicial?.base ?? "",
    gerencia: inicial?.gerencia ?? "", gerente: inicial?.gerente ?? "", processo: inicial?.processo ?? "", situacao: inicial?.situacao ?? "ATIVO",
  });
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(undefined); setSalvando(true);
    try {
      if (novo) await api.criarColaborador({ ...f, chapa: f.chapa.trim() });
      else await api.editarColaborador(inicial!.id, f);
      onSalvo(novo ? `Colaborador ${f.nome.toUpperCase()} adicionado.` : `Dados de ${f.nome.toUpperCase()} atualizados.`);
    } catch (err) { setErro((err as Error).message); setSalvando(false); }
  }

  const campo = (rot: string, k: keyof typeof f, extra?: { lista?: string[]; id?: string; req?: boolean; ro?: boolean; dica?: string }) => (
    <label className="block text-sm font-medium">{rot}{extra?.req && <span style={{ color: "var(--d)" }}> *</span>}
      <input value={f[k]} onChange={set(k)} className="inp mt-1.5" list={extra?.lista ? `lista-${k}` : undefined}
        required={extra?.req} readOnly={extra?.ro} style={extra?.ro ? { opacity: 0.7 } : undefined} />
      {extra?.lista && <datalist id={`lista-${k}`}>{extra.lista.map((v) => <option key={v} value={v} />)}</datalist>}
      {extra?.dica && <span className="faint mt-1 block text-xs font-normal">{extra.dica}</span>}
    </label>
  );

  return (
    <Modal titulo={novo ? "Novo colaborador" : "Editar colaborador"} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {campo("Chapa", "chapa", { req: true, ro: !novo, dica: novo ? "Não pode repetir e não muda depois." : "A chapa não pode ser alterada." })}
          {campo("Situação", "situacao", { lista: situacoes })}
        </div>
        {campo("Nome", "nome", { req: true })}
        {campo("Função", "funcao")}
        <div className="grid gap-4 sm:grid-cols-2">
          {campo("Base", "base", { lista: bases })}
          {campo("Gerência", "gerencia", { lista: gerencias })}
          {campo("Coordenador", "gerente")}
          {campo("Processo", "processo", { lista: processos })}
        </div>
        {erro && <p className="alert af" role="alert">{erro}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-g" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-p" disabled={salvando}>{salvando ? <><span className="spinner" /> Salvando…</> : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────── excluir ───────────────────────── */

function Excluir({ colab, onFechar, onFeito }: { colab: Colaborador; onFechar: () => void; onFeito: (msg: string) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string>();
  const executar = async (acao: "desligar" | "excluir") => {
    setErro(undefined); setOcupado(true);
    try {
      if (acao === "excluir") await api.excluirColaborador(colab.id);
      else await api.editarColaborador(colab.id, { ...colab, situacao: "DESLIGADO" });
      onFeito(acao === "excluir" ? `${colab.nome} foi excluído da base.` : `${colab.nome} foi marcado como desligado.`);
    } catch (e) { setErro((e as Error).message); setOcupado(false); }
  };
  const teste = colab.situacao === "TESTE";
  return (
    <Modal titulo="Excluir colaborador" onFechar={onFechar}>
      <div className="space-y-4">
        <p className="text-sm">Colaborador: <strong>{colab.nome}</strong> <span className="faint">(chapa {colab.matricula ?? colab.id})</span></p>
        <div className="rounded-[var(--r)] p-3 text-sm" style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <p className="font-semibold">Quando o colaborador for desligado, prefira “Marcar como desligado”.</p>
          <p className="muted mt-1 text-xs">Ele sai da busca da prova, mas o histórico das avaliações dele continua com o nome. Se você excluir de vez, as avaliações antigas passam a mostrar só a chapa.</p>
        </div>
        {erro && <p className="alert af" role="alert">{erro}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="btn btn-g" onClick={onFechar} disabled={ocupado}>Cancelar</button>
          <button className="btn btn-g" style={{ borderColor: "var(--d)", color: "var(--d)" }} onClick={() => executar("excluir")} disabled={ocupado || teste}>Excluir definitivamente</button>
          <button className="btn btn-p" onClick={() => executar("desligar")} disabled={ocupado || colab.situacao === "DESLIGADO"}>Marcar como desligado</button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── coordenador em lote ───────────────────────── */

function GerenteEmLote({ gerencias, bases, reais, onFechar, onFeito }: {
  gerencias: string[]; bases: string[]; reais: Colaborador[]; onFechar: () => void; onFeito: (msg: string) => void;
}) {
  const [ger, setGer] = useState(gerencias[0] ?? "");
  const [bas, setBas] = useState("");
  const doGrupo = (g: string, b: string) => reais.filter((c) => c.gerencia === g && (!b || c.base === b));
  const gerenteAtual = (g: string, b: string) => doGrupo(g, b).find((c) => c.gerente)?.gerente ?? "";
  const [nome, setNome] = useState(gerenteAtual(gerencias[0] ?? "", ""));
  const [erro, setErro] = useState<string>();
  const [ocupado, setOcupado] = useState(false);
  const qtd = doGrupo(ger, bas).length;
  const trocar = (g: string, b: string) => { setGer(g); setBas(b); setNome(gerenteAtual(g, b)); };

  async function aplicar(e: React.FormEvent) {
    e.preventDefault();
    setErro(undefined); setOcupado(true);
    try { const r = await api.gerenteEmLote(ger, bas, nome); onFeito(`Coordenador de ${ger}${bas ? ` (${bas})` : ""} definido para ${r.atualizados} colaboradores.`); }
    catch (err) { setErro((err as Error).message); setOcupado(false); }
  }
  return (
    <Modal titulo="Definir coordenador por gerência" onFechar={onFechar}>
      <form onSubmit={aplicar} className="space-y-4">
        <p className="muted text-sm">A planilha não traz o coordenador. Aqui você informa o nome do coordenador de uma gerência (de todas as bases ou só de uma). Colaboradores novos herdam o coordenador da gerência e base deles.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Gerência
            <select value={ger} onChange={(e) => trocar(e.target.value, bas)} className="inp mt-1.5">
              {gerencias.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Base
            <select value={bas} onChange={(e) => trocar(ger, e.target.value)} className="inp mt-1.5">
              <option value="">Todas as bases</option>
              {bases.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">Nome do coordenador
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="inp mt-1.5" placeholder="Deixe vazio para remover" />
        </label>
        <p className="faint text-xs">Será aplicado a {qtd} colaborador(es) de {ger}{bas ? ` na base ${bas}` : ""}.</p>
        {erro && <p className="alert af" role="alert">{erro}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-g" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-p" disabled={ocupado || !ger}>{ocupado ? <><span className="spinner" /> Aplicando…</> : "Aplicar"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────── importar planilha ───────────────────────── */

function Importar({ editavel, totalAtivos, onFechar, onFeito }: { editavel: boolean; totalAtivos: number; onFechar: () => void; onFeito: (msg: string) => void }) {
  const [arquivo, setArquivo] = useState<File>();
  const [previa, setPrevia] = useState<ImportacaoRes>();
  const [ausentes, setAusentes] = useState<AusentesAcao>("desligar");
  const [confirmado, setConfirmado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string>();

  const escolher = (f?: File) => { setArquivo(f); setPrevia(undefined); setErro(undefined); setConfirmado(false); };

  async function analisar() {
    if (!arquivo) return;
    setErro(undefined); setOcupado(true);
    try { setPrevia(await api.importarBase(arquivo, false, ausentes)); }
    catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  }
  async function aplicar() {
    if (!arquivo || !previa) return;
    setErro(undefined); setOcupado(true);
    try {
      const r = await api.importarBase(arquivo, true, ausentes);
      const afetados = ausentes === "manter" ? 0 : r.ausentes.length;
      onFeito(`Importação concluída: ${r.novos.length} novo(s), ${r.alterados.length} alterado(s)${afetados ? `, ${afetados} ${ausentes === "excluir" ? "excluído(s)" : "desligado(s)"}` : ""}.`);
    } catch (e) { setErro((e as Error).message); setOcupado(false); }
  }

  const mudancas = previa ? previa.novos.length + previa.alterados.length + (ausentes === "manter" ? 0 : previa.ausentes.length) : 0;
  // trocar de planilha por engano apagaria muita gente: pede confirmação extra
  const muitos = !!previa && ausentes !== "manter" && previa.ausentes.length > Math.max(10, totalAtivos * 0.2);

  return (
    <Modal titulo="Importar planilha de colaboradores" onFechar={onFechar} largo>
      <div className="space-y-4">
        <div className="text-sm">
          <p className="muted">Envie a planilha (<strong>.xlsx</strong> ou <strong>.csv</strong>) com os títulos <strong>CHAPA, NOME, FUNÇÃO, BASE, PROCESSO, GERENCIA, SITUAÇÃO</strong> (COORDENADOR é opcional). Na planilha .xlsx é lida a aba “Base” (ou a primeira).</p>
          <p className="faint mt-1 text-xs">Dica: use “Exportar CSV” para ter um modelo no formato certo. Nada é alterado até você confirmar.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => escolher(e.target.files?.[0])} className="text-sm" />
          <button className="btn btn-g !py-2 !text-sm" onClick={analisar} disabled={!arquivo || ocupado}>
            {ocupado && !previa ? <><span className="spinner" /> Analisando…</> : "Analisar planilha"}
          </button>
        </div>

        {erro && <p className="alert af" role="alert">{erro}</p>}

        {previa && (
          <div className="af space-y-4">
            <p className="muted text-xs">
              {previa.arquivo.nome}: {previa.arquivo.linhas} linha(s), {previa.arquivo.validos} colaborador(es) válido(s)
              {previa.arquivo.duplicados > 0 && ` (${previa.arquivo.duplicados} linha(s) repetidas da mesma chapa foram unidas)`}
              {previa.arquivo.ignorados.length > 0 && `, ${previa.arquivo.ignorados.length} linha(s) ignorada(s)`}.
            </p>

            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {([
                ["Novos", previa.novos.length, "var(--p)"], ["Alterados", previa.alterados.length, "var(--i)"],
                ["Fora da planilha", previa.ausentes.length, "var(--d)"], ["Sem mudança", previa.semMudanca, "var(--fg-muted)"],
              ] as const).map(([rot, n, cor]) => (
                <div key={rot} className="card p-3" style={{ borderRadius: "var(--r)" }}>
                  <p className="text-2xl font-extrabold" style={{ color: cor, fontVariantNumeric: "tabular-nums" }}>{n}</p>
                  <p className="muted text-xs font-semibold">{rot}</p>
                </div>
              ))}
            </div>

            {previa.ausentes.length > 0 && (
              <fieldset className="rounded-[var(--r)] p-3" style={{ border: "1px solid var(--border)" }}>
                <legend className="px-1 text-xs font-bold">O que fazer com os {previa.ausentes.length} que estão na base e não vieram na planilha?</legend>
                {([
                  ["desligar", "Marcar como desligados", "saem da busca da prova, mas o histórico de avaliações é mantido (recomendado)"],
                  ["excluir", "Excluir da base", "as avaliações antigas passam a mostrar só a chapa"],
                  ["manter", "Manter como estão", "não mexer neles"],
                ] as const).map(([v, rot, desc]) => (
                  <label key={v} className="flex cursor-pointer items-start gap-2 py-1.5 text-sm">
                    <input type="radio" name="ausentes" className="mt-1" checked={ausentes === v} onChange={() => { setAusentes(v); setConfirmado(false); }} />
                    <span><strong>{rot}</strong> <span className="faint text-xs">— {desc}</span></span>
                  </label>
                ))}
              </fieldset>
            )}

            {muitos && (
              <label className="alert flex cursor-pointer items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
                <span>Atenção: {previa.ausentes.length} colaboradores seriam {ausentes === "excluir" ? "excluídos" : "desligados"}. Confirme que esta é a planilha completa e mais recente.</span>
              </label>
            )}

            {([
              ["Novos", previa.novos.map((c) => `${c.id} · ${c.nome} · ${c.base ?? "—"} / ${c.gerencia ?? "—"}`)],
              ["Alterados", previa.alterados.map((a) => `${a.depois.id} · ${a.depois.nome} — mudou: ${a.campos.join(", ")}`)],
              ["Fora da planilha", previa.ausentes.map((c) => `${c.id} · ${c.nome} · ${c.base ?? "—"} / ${c.gerencia ?? "—"}`)],
            ] as const).map(([rot, itens]) => itens.length > 0 && (
              <details key={rot} className="text-sm">
                <summary className="cursor-pointer font-semibold">{rot} ({itens.length})</summary>
                <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto pl-1 text-xs" style={{ scrollbarWidth: "thin" }}>
                  {itens.slice(0, 300).map((t) => <li key={t} className="muted">{t}</li>)}
                  {itens.length > 300 && <li className="faint">… e mais {itens.length - 300}</li>}
                </ul>
              </details>
            ))}

            {!editavel && <p className="alert" role="alert">O banco de dados não está configurado: dá para analisar a planilha, mas não aplicar as mudanças.</p>}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button className="btn btn-g" onClick={onFechar} disabled={ocupado}>Cancelar</button>
              <button className="btn btn-p" onClick={aplicar} disabled={ocupado || !editavel || mudancas === 0 || (muitos && !confirmado)}>
                {ocupado ? <><span className="spinner" /> Aplicando…</> : mudancas === 0 ? "Nada a atualizar" : `Aplicar ${mudancas} mudança(s)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
