import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { CRITERIOS_PRATICOS, VEICULOS, type AvaliacaoPraticaDetalhada } from "@ebc/shared";
import { Busca, Chevron, Grafico, Mais } from "../components/Icones";
import { apiInstrutor, instrutorSessao } from "../lib/api";

export default function InstrutorResultados() {
  const nav = useNavigate();
  const [lista, setLista] = useState<AvaliacaoPraticaDetalhada[]>();
  const [erro, setErro] = useState<string>();
  const [programa, setPrograma] = useState("Escola do Bom Condutor");
  const [filtro, setFiltro] = useState("");
  const [aberta, setAberta] = useState<string>();

  useEffect(() => {
    if (!instrutorSessao.get()) return;
    setLista(undefined);
    apiInstrutor.listar(programa ? { programa } : {}).then(setLista).catch((e: Error) => {
      if (e.message.includes("Sessão")) { instrutorSessao.limpar(); nav("/instrutor"); } else setErro(e.message);
    });
  }, [programa, nav]);

  if (!instrutorSessao.get()) return <Navigate to="/instrutor" replace />;

  const f = filtro.trim().toLowerCase();
  const visiveis = (lista ?? []).filter((a) => !f || (a.colaborador?.nome ?? "").toLowerCase().includes(f));
  const aptos = visiveis.filter((a) => a.resultado.apto).length;

  return (
    <section className="space-y-5">
      <div className="au flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Resultados <span className="faint font-semibold">· prática</span></h1>
        <div className="flex gap-2">
          <Link to="/instrutor/dashboard" className="btn btn-g !px-4 !py-2.5 !text-sm"><Grafico width={16} height={16} /> Dashboard</Link>
          <Link to="/instrutor/avaliacao" className="btn btn-p !px-4 !py-2.5 !text-sm"><Mais width={16} height={16} /> Nova</Link>
        </div>
      </div>

      <div className="au d1 grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <Busca className="faint pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" width={18} height={18} />
          <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por nome"
            className="inp" style={{ paddingLeft: "2.6rem" }} />
        </div>
        <select value={programa} onChange={(e) => setPrograma(e.target.value)} className="inp">
          <option value="Escola do Bom Condutor">Escola do Bom Condutor</option>
          <option value="De Olho na Condução">De Olho na Condução</option>
          <option value="">Todos</option>
        </select>
      </div>

      {erro && <p className="alert af" role="alert">{erro}</p>}
      {!lista && !erro && (
        <div className="space-y-2.5">{[0, 1, 2, 3, 4].map((n) => <div key={n} className="skel" style={{ height: 64 }} />)}</div>
      )}

      {lista && (
        <>
          <div className="au d2 grid grid-cols-3 gap-3">
            {[
              { rot: "Avaliações", val: visiveis.length, cor: "var(--fg)" },
              { rot: "Aptos", val: aptos, cor: "var(--p)" },
              { rot: "Inaptos", val: visiveis.length - aptos, cor: "var(--d)" },
            ].map((s) => (
              <div key={s.rot} className="card p-4 text-center">
                <p className="text-3xl font-extrabold" style={{ color: s.cor, fontVariantNumeric: "tabular-nums" }}>{s.val}</p>
                <p className="muted mt-0.5 text-xs font-medium">{s.rot}</p>
              </div>
            ))}
          </div>

          <ul className="space-y-2.5">
            {visiveis.map((a, idx) => {
              const aberto = aberta === a.id;
              return (
                <li key={a.id} className="card au overflow-hidden" style={{ borderRadius: "var(--r)", animationDelay: `${Math.min(idx, 12) * 30}ms` }}>
                  <button className="flex w-full items-center justify-between gap-3 p-4 text-left"
                    style={{ background: "transparent", border: 0, color: "inherit", font: "inherit", cursor: "pointer" }}
                    aria-expanded={aberto} onClick={() => setAberta(aberto ? undefined : a.id)}>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{a.colaborador?.nome ?? a.colaboradorId}</span>
                      <span className="faint block truncate text-xs">
                        {[a.tipo === "reteste" ? "Reteste" : "1ª avaliação", a.veiculo && VEICULOS[a.veiculo], a.base,
                          a.realizadaEm && new Date(a.realizadaEm).toLocaleDateString("pt-BR")].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={`chip ${a.resultado.apto ? "chip-ok" : "chip-bad"}`}>{a.resultado.apto ? "APTO" : "INAPTO"}</span>
                      <Chevron className="faint transition-transform duration-200" width={18} height={18}
                        style={{ transform: aberto ? "rotate(180deg)" : undefined }} />
                    </span>
                  </button>
                  {aberto && (
                    <div className="af space-y-2 px-4 pb-4 text-sm" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)", paddingTop: "1rem" }}>
                      <p className="muted">{a.resultado.eliminatoria ? "Infração eliminatória." : `${a.resultado.pontos} ponto(s).`} Avaliador: <strong style={{ color: "var(--fg)" }}>{a.avaliador}</strong></p>
                      <ul className="list-disc space-y-1 pl-5">
                        {a.ocorrencias.map((o) => (
                          <li key={o.criterioId}>{o.quantidade}× {CRITERIOS_PRATICOS.find((c) => c.id === o.criterioId)?.descricao}</li>
                        ))}
                        {a.ocorrencias.length === 0 && <li>Nenhuma infração registrada.</li>}
                      </ul>
                      {a.descricao && <p className="muted italic">{a.descricao}</p>}
                      {a.evidencias && a.evidencias.length > 0 && (
                        <ul className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-3">
                          {a.evidencias.map((e) => (
                            <li key={e.id}>
                              <a href={e.url} target="_blank" rel="noreferrer">
                                <img src={e.url} alt="Evidência com carimbo" loading="lazy" className="aspect-[4/3] w-full rounded-[var(--r-sm)] object-cover" style={{ border: "1px solid var(--border)" }} />
                              </a>
                              <p className="faint mt-1 text-[0.68rem] leading-snug">
                                {new Date(e.capturadaEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                                {e.latitude !== null && e.longitude !== null && (
                                  <> · <a className="link !text-[0.68rem]" target="_blank" rel="noreferrer"
                                    href={`https://www.google.com/maps?q=${e.latitude},${e.longitude}`}>ver no mapa</a></>
                                )}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                      {a.evidenciaUrl && <a href={a.evidenciaUrl} target="_blank" rel="noreferrer" className="link">Ver evidência</a>}
                    </div>
                  )}
                </li>
              );
            })}
            {visiveis.length === 0 && <li className="muted py-10 text-center text-sm">Nenhuma avaliação encontrada.</li>}
          </ul>
        </>
      )}
    </section>
  );
}
