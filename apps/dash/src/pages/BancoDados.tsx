import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CATEGORIAS, CRITERIOS_PRATICOS, NATUREZAS, VEICULOS, avaliarPratica,
  type Ocorrencia, type RegistroPratico, type RegistroTeorico,
} from "@ebc/shared";
import { api, sessao } from "../lib/api";
import { Indicadores } from "../lib/filtros";
import { Modal } from "./Configuracao";

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
const POR_PAGINA = 50;
const sel = "inp !py-2.5 !text-sm";
const PROGRAMAS = ["Escola do Bom Condutor", "De Olho na Condução"];

type Aba = "teorica" | "pratica";
type Acao = { t: "editar-t"; r: RegistroTeorico } | { t: "editar-p"; r: RegistroPratico } | { t: "excluir"; aba: Aba; id: string; nome: string; data: string | null } | null;

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "sem data");
/** ISO -> valor do <input type="datetime-local"> (horário local). */
const paraInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const deInput = (v: string) => (v ? new Date(v).toISOString() : "");

/** Banco de dados das provas: corrigir ou excluir avaliações teóricas (colaborador) e práticas (instrutor). */
export default function BancoDados() {
  const nav = useNavigate();
  const [aba, setAba] = useState<Aba>("teorica");
  const [teoricas, setTeoricas] = useState<RegistroTeorico[]>();
  const [praticas, setPraticas] = useState<RegistroPratico[]>();
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [acao, setAcao] = useState<Acao>(null);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");
  const [programa, setPrograma] = useState("");
  const [pagina, setPagina] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([api.teorica(false), api.pratica(false)]);
      setTeoricas(t.registros); setPraticas(p.registros); setErro(undefined);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("Sessão")) { sessao.limpar(); nav("/login"); return; }
      setErro(msg);
    }
  }, [nav]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { setPagina(0); }, [aba, busca, situacao, programa]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(undefined), 6000); return () => clearTimeout(t); }, [aviso]);

  const concluiu = async (msg: string) => { setAcao(null); setAviso(msg); await carregar(); };

  const textoOk = (nome: string, mat: string | null) => {
    const t = norm(busca);
    return !t || t.split(/\s+/).every((p) => norm(`${nome} ${mat ?? ""}`).includes(p));
  };
  const porData = <T extends { id: string }>(xs: T[], d: (x: T) => string | null) => [...xs].sort((a, b) => (d(b) ?? "").localeCompare(d(a) ?? ""));

  const tFiltradas = useMemo(() => porData((teoricas ?? []).filter((r) =>
    textoOk(r.nome, r.matricula) && (!situacao || (situacao === "ok") === r.aprovado)), (r) => r.finalizadaEm), [teoricas, busca, situacao]); // eslint-disable-line react-hooks/exhaustive-deps
  const pFiltradas = useMemo(() => porData((praticas ?? []).filter((r) =>
    textoOk(r.nome, r.matricula) && (!situacao || (situacao === "ok") === r.apto) && (!programa || r.programa === programa)), (r) => r.realizadaEm), [praticas, busca, situacao, programa]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = aba === "teorica" ? tFiltradas : pFiltradas;
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const ini = pagina * POR_PAGINA;
  const carregando = !teoricas && !praticas && !erro;
  const filtrando = !!(busca || situacao || programa);

  return (
    <section className="space-y-5">
      <div className="au">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Banco de dados <span style={{ color: "var(--p)" }}>· provas</span></h1>
        <p className="muted mt-1 text-sm">Corrija ou exclua as avaliações realizadas pelos colaboradores (teórica) e pelos instrutores (prática).</p>
      </div>

      {aviso && <p className="chip chip-ok af" role="status" style={{ padding: ".6rem .9rem", fontSize: ".8rem" }}>{aviso}</p>}
      {erro && <p className="alert af" role="alert">{erro}</p>}
      {carregando && <div className="skel" style={{ height: 110 }} />}

      {teoricas && praticas && (
        <>
          <Indicadores itens={[
            { rot: "Provas teóricas", val: String(teoricas.length), cor: "var(--i)" },
            { rot: "Teóricas aprovadas", val: String(teoricas.filter((r) => r.aprovado).length), cor: "var(--p)" },
            { rot: "Avaliações práticas", val: String(praticas.length), cor: "var(--w)" },
            { rot: "Práticas aptas", val: String(praticas.filter((r) => r.apto).length), cor: "var(--p)" },
          ]} />

          <div className="au d2 grid gap-3 sm:grid-cols-2">
            {([["teorica", "Avaliações teóricas", "Provas feitas pelos colaboradores", teoricas.length], ["pratica", "Avaliações práticas", "Avaliações feitas pelos instrutores", praticas.length]] as const).map(([k, t, s, n]) => (
              <button key={k} type="button" aria-pressed={aba === k} onClick={() => { setAba(k); setSituacao(""); setPrograma(""); }}
                className="card p-4 text-left transition-all"
                style={{ cursor: "pointer", font: "inherit", color: "inherit", borderColor: aba === k ? "var(--p)" : undefined, boxShadow: aba === k ? "0 0 0 1px var(--p)" : undefined }}>
                <span className="flex items-center justify-between gap-2"><span className="font-extrabold">{t}</span><span className="chip chip-ok !py-0.5">{n}</span></span>
                <span className="muted mt-1 block text-xs">{s}</span>
              </button>
            ))}
          </div>

          <div className="card au d3 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <label className="col-span-2 text-xs font-semibold">Buscar
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou chapa" className={`${sel} mt-1`} />
              </label>
              <label className="text-xs font-semibold">Resultado
                <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className={`${sel} mt-1`}>
                  <option value="">Todos</option>
                  <option value="ok">{aba === "teorica" ? "Aprovados" : "Aptos"}</option>
                  <option value="nao">{aba === "teorica" ? "Reprovados" : "Inaptos"}</option>
                </select>
              </label>
              {aba === "pratica" && (
                <label className="text-xs font-semibold">Programa
                  <select value={programa} onChange={(e) => setPrograma(e.target.value)} className={`${sel} mt-1`}>
                    <option value="">Todos</option>{PROGRAMAS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </label>
              )}
            </div>
            {filtrando && (
              <div className="af mt-3 flex items-center gap-3 text-xs">
                <span className="muted">Mostrando <strong style={{ color: "var(--fg)" }}>{lista.length}</strong></span>
                <button className="link" onClick={() => { setBusca(""); setSituacao(""); setPrograma(""); }}>Limpar filtros</button>
              </div>
            )}
          </div>

          <section className="card au p-4 sm:p-5">
            {lista.length === 0 ? (
              <p className="faint grid min-h-[8rem] place-items-center text-sm">Nenhuma avaliação encontrada.</p>
            ) : (
              <div className="tabela-wrap">
                {aba === "teorica" ? (
                  <table className="tabela">
                    <thead><tr><th>Data</th><th>Colaborador</th><th>Base</th><th>Categoria</th><th>Pontos</th><th>Resultado</th><th style={{ textAlign: "right" }}>Ações</th></tr></thead>
                    <tbody>
                      {tFiltradas.slice(ini, ini + POR_PAGINA).map((r) => (
                        <tr key={r.id}>
                          <td className="whitespace-nowrap">{fmt(r.finalizadaEm)}</td>
                          <td style={{ minWidth: "14rem" }}><span className="font-semibold">{r.nome}</span><span className="faint block text-xs">Mat. {r.matricula ?? r.colaboradorId}</span></td>
                          <td className="whitespace-nowrap font-semibold">{r.base ?? "—"}</td>
                          <td className="whitespace-nowrap">{CATEGORIAS[r.categoria]}</td>
                          <td className="whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>{r.pontos}/{r.pontosMaximos}</td>
                          <td><span className={`chip ${r.aprovado ? "chip-ok" : "chip-bad"} !py-0.5`}>{r.aprovado ? "Aprovado" : "Reprovado"}</span></td>
                          <td className="whitespace-nowrap" style={{ textAlign: "right" }}>
                            <button className="link text-xs" onClick={() => setAcao({ t: "editar-t", r })}>Editar</button>
                            <button className="link ml-3 text-xs" style={{ color: "var(--d)" }} onClick={() => setAcao({ t: "excluir", aba: "teorica", id: r.id, nome: r.nome, data: r.finalizadaEm })}>Excluir</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="tabela">
                    <thead><tr><th>Data</th><th>Colaborador</th><th>Base</th><th>Programa</th><th>Tipo</th><th>Veículo</th><th>Infrações</th><th>Resultado</th><th>Avaliador</th><th style={{ textAlign: "right" }}>Ações</th></tr></thead>
                    <tbody>
                      {pFiltradas.slice(ini, ini + POR_PAGINA).map((r) => (
                        <tr key={r.id}>
                          <td className="whitespace-nowrap">{fmt(r.realizadaEm)}</td>
                          <td style={{ minWidth: "14rem" }}><span className="font-semibold">{r.nome}</span><span className="faint block text-xs">Mat. {r.matricula ?? r.colaboradorId}</span></td>
                          <td className="whitespace-nowrap font-semibold">{r.base ?? "—"}</td>
                          <td style={{ minWidth: "9rem" }}>{r.programa}</td>
                          <td className="whitespace-nowrap">{r.tipo === "reteste" ? "Reteste" : "Primeira"}</td>
                          <td className="whitespace-nowrap">{r.veiculo ? VEICULOS[r.veiculo] : "—"}</td>
                          <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.ocorrencias.reduce((s, o) => s + o.quantidade, 0)}</td>
                          <td><span className={`chip ${r.apto ? "chip-ok" : "chip-bad"} !py-0.5`}>{r.apto ? "Apto" : "Inapto"}</span></td>
                          <td style={{ minWidth: "8rem" }}>{r.avaliador}</td>
                          <td className="whitespace-nowrap" style={{ textAlign: "right" }}>
                            <button className="link text-xs" onClick={() => setAcao({ t: "editar-p", r })}>Editar</button>
                            <button className="link ml-3 text-xs" style={{ color: "var(--d)" }} onClick={() => setAcao({ t: "excluir", aba: "pratica", id: r.id, nome: r.nome, data: r.realizadaEm })}>Excluir</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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

      {acao?.t === "editar-t" && <EditarTeorica r={acao.r} onFechar={() => setAcao(null)} onSalvo={concluiu} />}
      {acao?.t === "editar-p" && <EditarPratica r={acao.r} onFechar={() => setAcao(null)} onSalvo={concluiu} />}
      {acao?.t === "excluir" && <Excluir a={acao} onFechar={() => setAcao(null)} onFeito={concluiu} />}
    </section>
  );
}

/* ───────────────────────── editar teórica ───────────────────────── */

function EditarTeorica({ r, onFechar, onSalvo }: { r: RegistroTeorico; onFechar: () => void; onSalvo: (msg: string) => void }) {
  const [categoria, setCategoria] = useState(r.categoria);
  const [pontos, setPontos] = useState(String(r.pontos));
  const [quando, setQuando] = useState(paraInput(r.finalizadaEm));
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);
  const n = Number(pontos);
  const valido = Number.isInteger(n) && n >= 0 && n <= r.pontosMaximos;
  const aprovado = valido && n >= 20;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(undefined); setSalvando(true);
    try { await api.editarProva("teorica", r.id, { categoria, pontos: n, finalizadaEm: deInput(quando) }); onSalvo(`Prova teórica de ${r.nome} atualizada.`); }
    catch (err) { setErro((err as Error).message); setSalvando(false); }
  }
  return (
    <Modal titulo="Editar avaliação teórica" onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-sm">Colaborador: <strong>{r.nome}</strong> <span className="faint">(chapa {r.matricula ?? r.colaboradorId})</span></p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Categoria
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as typeof categoria)} className="inp mt-1.5">
              {(Object.keys(CATEGORIAS) as (keyof typeof CATEGORIAS)[]).map((k) => <option key={k} value={k}>{CATEGORIAS[k]}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Pontuação (0 a {r.pontosMaximos})
            <input type="number" min={0} max={r.pontosMaximos} value={pontos} onChange={(e) => setPontos(e.target.value)} className="inp mt-1.5" required />
          </label>
        </div>
        <label className="block text-sm font-medium">Data e hora da prova
          <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} className="inp mt-1.5" required />
        </label>
        <p className="text-sm">Resultado: <span className={`chip ${valido ? (aprovado ? "chip-ok" : "chip-bad") : ""} !py-0.5`}>{valido ? (aprovado ? "Aprovado" : "Reprovado") : "pontuação inválida"}</span>
          <span className="faint ml-2 text-xs">(mínimo de 20 acertos para aprovar)</span></p>
        <p className="faint text-xs">As respostas marcadas pelo colaborador não mudam: o ranking de questões mais erradas continua usando as respostas originais.</p>
        {erro && <p className="alert af" role="alert">{erro}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-g" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-p" disabled={salvando || !valido}>{salvando ? <><span className="spinner" /> Salvando…</> : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────── editar prática ───────────────────────── */

function EditarPratica({ r, onFechar, onSalvo }: { r: RegistroPratico; onFechar: () => void; onSalvo: (msg: string) => void }) {
  const [tipo, setTipo] = useState(r.tipo);
  const [veiculo, setVeiculo] = useState(r.veiculo ?? "carro");
  const [programa, setPrograma] = useState(r.programa);
  const [avaliador, setAvaliador] = useState(r.avaliador);
  const [quando, setQuando] = useState(paraInput(r.realizadaEm));
  const [descricao, setDescricao] = useState(r.descricao);
  const [qtd, setQtd] = useState<Record<string, number>>(() => Object.fromEntries(r.ocorrencias.map((o) => [o.criterioId, o.quantidade])));
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);

  const ocorrencias: Ocorrencia[] = Object.entries(qtd).filter(([, q]) => q > 0).map(([criterioId, quantidade]) => ({ criterioId, quantidade }));
  const res = avaliarPratica(ocorrencias);
  const total = ocorrencias.reduce((s, o) => s + o.quantidade, 0);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(undefined); setSalvando(true);
    try {
      await api.editarProva("pratica", r.id, { tipo, veiculo, programa, avaliador, descricao, ocorrencias, realizadaEm: deInput(quando) });
      onSalvo(`Avaliação prática de ${r.nome} atualizada.`);
    } catch (err) { setErro((err as Error).message); setSalvando(false); }
  }

  return (
    <Modal titulo="Editar avaliação prática" onFechar={onFechar} largo>
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-sm">Colaborador: <strong>{r.nome}</strong> <span className="faint">(chapa {r.matricula ?? r.colaboradorId})</span></p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Programa
            <select value={programa} onChange={(e) => setPrograma(e.target.value)} className="inp mt-1.5">{PROGRAMAS.map((p) => <option key={p}>{p}</option>)}</select>
          </label>
          <label className="block text-sm font-medium">Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="inp mt-1.5">
              <option value="primeira">Primeira avaliação</option><option value="reteste">Reteste</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Veículo
            <select value={veiculo} onChange={(e) => setVeiculo(e.target.value as typeof veiculo)} className="inp mt-1.5">
              {(Object.keys(VEICULOS) as (keyof typeof VEICULOS)[]).map((k) => <option key={k} value={k}>{VEICULOS[k]}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Data e hora
            <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} className="inp mt-1.5" />
          </label>
        </div>
        <label className="block text-sm font-medium">Instrutor (avaliador)
          <input value={avaliador} onChange={(e) => setAvaliador(e.target.value)} className="inp mt-1.5" />
        </label>
        <label className="block text-sm font-medium">Descrição / observações do instrutor
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className="inp mt-1.5" />
        </label>

        <fieldset className="rounded-[var(--r)] p-3" style={{ border: "1px solid var(--border)" }}>
          <legend className="px-1 text-xs font-bold">Infrações cometidas (quantidade de vezes)</legend>
          <div className="space-y-4">
            {(Object.keys(NATUREZAS) as (keyof typeof NATUREZAS)[]).map((nat) => {
              const itens = CRITERIOS_PRATICOS.filter((c) => c.natureza === nat);
              if (itens.length === 0) return null;
              return (
                <div key={nat}>
                  <p className="muted mb-1 text-xs font-bold uppercase tracking-wider">{NATUREZAS[nat].rotulo}</p>
                  <ul className="space-y-1">
                    {itens.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                        <span style={{ fontWeight: qtd[c.id] ? 700 : 400 }}>{c.descricao}</span>
                        <input type="number" min={0} max={99} value={qtd[c.id] ?? 0} aria-label={`Quantidade: ${c.descricao}`}
                          onChange={(e) => setQtd((x) => ({ ...x, [c.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                          className="inp !w-20 !py-1.5 text-center" />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </fieldset>

        <p className="text-sm">Resultado: <span className={`chip ${res.apto ? "chip-ok" : "chip-bad"} !py-0.5`}>{res.apto ? "Apto" : "Inapto"}</span>
          <span className="faint ml-2 text-xs">{total} infração(ões), {res.pontos} ponto(s){res.motivos.length ? ` · ${res.motivos.join(" ")}` : ""}</span></p>
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

function Excluir({ a, onFechar, onFeito }: { a: Extract<Acao, { t: "excluir" }>; onFechar: () => void; onFeito: (msg: string) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string>();
  async function excluir() {
    setErro(undefined); setOcupado(true);
    try { await api.excluirProva(a.aba, a.id); onFeito(`Avaliação ${a.aba === "teorica" ? "teórica" : "prática"} de ${a.nome} excluída.`); }
    catch (e) { setErro((e as Error).message); setOcupado(false); }
  }
  return (
    <Modal titulo="Excluir avaliação" onFechar={onFechar}>
      <div className="space-y-4">
        <p className="text-sm">Avaliação {a.aba === "teorica" ? "teórica" : "prática"} de <strong>{a.nome}</strong> ({fmt(a.data)}).</p>
        <div className="rounded-[var(--r)] p-3 text-sm" style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <p className="font-semibold">Esta ação não pode ser desfeita.</p>
          <p className="muted mt-1 text-xs">Ela sai de todos os relatórios (Dash, Teórica, Prática e Detalhamento).</p>
        </div>
        {erro && <p className="alert af" role="alert">{erro}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="btn btn-g" onClick={onFechar} disabled={ocupado}>Cancelar</button>
          <button className="btn btn-p" style={{ background: "var(--d)", borderColor: "var(--d)" }} onClick={excluir} disabled={ocupado}>
            {ocupado ? <><span className="spinner" /> Excluindo…</> : "Excluir definitivamente"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
