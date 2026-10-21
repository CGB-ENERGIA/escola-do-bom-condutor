import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  CRITERIOS_PRATICOS, NATUREZAS, REGRAS, VEICULOS, avaliarPratica,
  type AvaliacaoPratica, type Colaborador, type Evidencia, type NaturezaInfracao, type TipoVeiculo,
} from "@ebc/shared";
import BuscaColaborador from "../components/BuscaColaborador";
import CameraEvidencia from "../components/CameraEvidencia";
import { Camera, Chevron, Fechar, Grafico, Lista, Mais, Menos, Sair } from "../components/Icones";
import { apiInstrutor, instrutorSessao } from "../lib/api";

const MAX_FOTOS = 6;
const ORDEM: NaturezaInfracao[] = ["gravissima", "grave", "media", "leve"];
/** [cor forte, fundo suave] por natureza */
const COR: Record<NaturezaInfracao, [string, string]> = {
  gravissima: ["var(--d)", "var(--d-tint)"], grave: ["var(--o)", "var(--o-tint)"],
  media: ["var(--w)", "var(--w-tint)"], leve: ["var(--i)", "var(--i-tint)"],
};

/** Ficha da avaliação prática preenchida pelo instrutor de trânsito. */
export default function InstrutorAvaliacao() {
  const nav = useNavigate();
  const sessao = instrutorSessao.get();
  const [colab, setColab] = useState<Colaborador>();
  const [tipo, setTipo] = useState<"primeira" | "reteste">("primeira");
  const [veiculo, setVeiculo] = useState<TipoVeiculo>("carro");
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [salva, setSalva] = useState<AvaliacaoPratica>();
  const [fotos, setFotos] = useState<Evidencia[]>([]);
  const [camera, setCamera] = useState(false);
  const [fechadas, setFechadas] = useState<Partial<Record<NaturezaInfracao, boolean>>>({});

  const ocorrencias = useMemo(
    () => Object.entries(qtd).filter(([, q]) => q > 0).map(([criterioId, quantidade]) => ({ criterioId, quantidade })),
    [qtd],
  );
  const resultado = useMemo(() => avaliarPratica(ocorrencias), [ocorrencias]);

  if (!sessao) return <Navigate to="/instrutor" replace />;

  const ajustar = (id: string, d: number) =>
    setQtd((q) => ({ ...q, [id]: Math.max(0, Math.min(20, (q[id] ?? 0) + d)) }));

  function nova() {
    setColab(undefined); setQtd({}); setDescricao(""); setTipo("primeira"); setFotos([]);
    setSalva(undefined); setErro(undefined);
  }

  async function salvar() {
    if (!colab) { setErro("Escolha o colaborador (no topo da página) para finalizar a avaliação."); return; }
    if (!descricao.trim()) { setErro("Preencha a descrição / observações do instrutor para finalizar a avaliação."); return; }
    if (fotos.length === 0) { setErro("Registre ao menos 1 foto de evidência para finalizar a avaliação."); return; }
    setErro(undefined);
    setSalvando(true);
    try {
      setSalva(await apiInstrutor.criarAvaliacao({
        colaboradorId: colab.id, tipo, veiculo, ocorrencias, descricao, evidencias: fotos.map((f) => f.id),
      }));
    } catch (e) {
      setErro((e as Error).message);
      if ((e as Error).message.includes("Sessão")) { instrutorSessao.limpar(); nav("/instrutor"); }
    } finally {
      setSalvando(false);
    }
  }

  if (salva)
    return (
      <section className="mx-auto max-w-md space-y-5 text-center">
        <p className="muted au text-sm">{colab?.nome}</p>
        <div className="glass au d1 p-8">
          <p className={`chip ap mb-1 px-6 py-2.5 text-xl ${salva.resultado.apto ? "chip-ok" : "chip-bad"}`} style={{ letterSpacing: ".08em" }}>
            {salva.resultado.apto ? "APTO" : "INAPTO"}
          </p>
          <p className="muted mt-4 text-sm">{salva.resultado.pontos} ponto(s) de infração</p>
          {salva.resultado.motivos.map((m) => <p key={m} className="mt-1 text-sm" style={{ color: "var(--d)" }}>{m}</p>)}
        </div>
        <button onClick={nova} className="btn btn-p btn-block au d2">Nova avaliação</button>
        <Link to="/instrutor/resultados" className="link au d3 block text-sm">Ver resultados</Link>
      </section>
    );

  return (
    <section className="space-y-6 pb-28">
      {/* Barra do instrutor */}
      <div className="au flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center rounded-full text-sm font-bold"
            style={{ width: 38, height: 38, background: "var(--p-tint)", color: "var(--p)" }}>
            {sessao.nome.slice(0, 1).toUpperCase()}
          </span>
          <div className="leading-tight">
            <p className="faint text-xs">Instrutor</p>
            <p className="text-sm font-semibold">{sessao.nome}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/instrutor/dashboard" className="btn btn-g !px-3.5 !py-2 !text-sm"><Grafico width={16} height={16} /> Dashboard</Link>
          <Link to="/instrutor/resultados" className="btn btn-g !px-3.5 !py-2 !text-sm"><Lista width={16} height={16} /> Resultados</Link>
          <button className="btn btn-g !px-3.5 !py-2 !text-sm" onClick={() => { instrutorSessao.limpar(); nav("/instrutor"); }}>
            <Sair width={16} height={16} /> Sair
          </button>
        </div>
      </div>

      <div className="au d1">
        <h1 className="text-3xl font-extrabold tracking-tight">Avaliação prática</h1>
        <p className="muted mt-1.5 text-sm">
          Marque quantas vezes cada infração ocorreu. <strong style={{ color: "var(--fg)" }}>Apto:</strong> nenhuma infração ou apenas 1 leve.
          Qualquer outra combinação (2+ leves, média, grave) ou gravíssima = <strong style={{ color: "var(--fg)" }}>Inapto</strong>.
        </p>
      </div>

      <div className="card au d2 space-y-4 p-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Colaborador</p>
          <BuscaColaborador valor={colab} onChange={setColab} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Avaliação
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="inp mt-1.5">
              <option value="primeira">1ª Avaliação</option>
              <option value="reteste">Reteste</option>
            </select>
          </label>
          <label className="text-sm font-medium">Tipo de veículo
            <select value={veiculo} onChange={(e) => setVeiculo(e.target.value as TipoVeiculo)} className="inp mt-1.5">
              {(Object.keys(VEICULOS) as TipoVeiculo[]).map((k) => <option key={k} value={k}>{VEICULOS[k]}</option>)}
            </select>
          </label>
        </div>
      </div>

      {ORDEM.map((nat) => {
        const [forte, suave] = COR[nat];
        const criterios = CRITERIOS_PRATICOS.filter((c) => c.natureza === nat);
        const marcadas = criterios.reduce((s, c) => s + (qtd[c.id] ?? 0), 0);
        const fechada = !!fechadas[nat];
        return (
          <fieldset key={nat} className="card au d3 overflow-hidden" style={{ borderColor: marcadas > 0 ? forte : undefined }}>
            <legend className="sr-only">{NATUREZAS[nat].rotulo}</legend>
            <button type="button" onClick={() => setFechadas((f) => ({ ...f, [nat]: !f[nat] }))} aria-expanded={!fechada}
              className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
              style={{ background: suave, borderBottom: fechada ? 0 : "1px solid var(--border)" }}>
              <div className="flex items-center gap-2.5">
                <span className="rounded-full" style={{ width: 12, height: 12, background: forte }} />
                <h2 className="text-[0.95rem] font-extrabold" style={{ color: forte }}>{NATUREZAS[nat].rotulo}</h2>
                <span className="faint text-xs font-semibold">
                  {NATUREZAS[nat].eliminatoria ? "reprova automaticamente" : `${NATUREZAS[nat].pontos} pts cada`}
                </span>
              </div>
              <span className="flex items-center gap-2">
                <span className="chip" style={{ background: marcadas > 0 ? forte : "var(--surface)", color: marcadas > 0 ? "var(--surface)" : "var(--fg-faint)", border: marcadas > 0 ? 0 : "1px solid var(--border)" }}>
                  {marcadas} marcada{marcadas === 1 ? "" : "s"}
                </span>
                <Chevron className="faint transition-transform duration-200" width={18} height={18}
                  style={{ transform: fechada ? undefined : "rotate(180deg)" }} />
              </span>
            </button>
            {!fechada && <div className="space-y-2 p-3">
            {criterios.map((c) => {
              const n = qtd[c.id] ?? 0;
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-[var(--r)] p-3 transition-all duration-200"
                  style={{
                    border: `1.5px solid ${n > 0 ? forte : "var(--border)"}`,
                    background: n > 0 ? suave : "var(--surface)",
                  }}>
                  <span className="flex-1 text-sm leading-snug">{c.descricao}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="menos" onClick={() => ajustar(c.id, -1)} disabled={n === 0} className="step"><Menos width={16} height={16} style={{ margin: "auto" }} /></button>
                    <span className="w-6 text-center text-base font-bold" style={{ fontVariantNumeric: "tabular-nums", color: n > 0 ? forte : "var(--fg-faint)" }}>{n}</span>
                    <button type="button" aria-label="mais" onClick={() => ajustar(c.id, 1)} className="step"><Mais width={16} height={16} style={{ margin: "auto" }} /></button>
                  </div>
                </div>
              );
            })}
            </div>}
          </fieldset>
        );
      })}

      <div className="card space-y-4 p-5">
        <label className="block text-sm font-medium">Descrição / observações do instrutor <span style={{ color: "var(--d)" }}>*</span>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className="inp mt-1.5 resize-y"
            required placeholder="Obrigatório: descreva o desempenho do colaborador na avaliação." />
        </label>
        <div>
          <p className="text-sm font-medium">
            Foto da evidência <span style={{ color: "var(--d)" }}>*</span>{" "}
            <span className="faint font-normal">({fotos.length}/{MAX_FOTOS})</span>
          </p>
          <p className="faint mt-1 text-xs">Obrigatória: registre ao menos 1 foto. Cada foto sai com carimbo de data, hora (da rede, não do aparelho) e localização.</p>
          <div className="mt-4 flex justify-center">
            <button type="button" className={`btn ${fotos.length ? "btn-g" : "btn-p"}`} disabled={fotos.length >= MAX_FOTOS} onClick={() => setCamera(true)}>
              <Camera width={20} height={20} /> {fotos.length ? "Outra foto" : "Abrir câmera"}
            </button>
          </div>
          {fotos.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fotos.map((f) => (
                <li key={f.id} className="ap relative overflow-hidden rounded-[var(--r)]" style={{ border: "1px solid var(--border)" }}>
                  <a href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt="Evidência com carimbo" className="aspect-[4/3] w-full object-cover" /></a>
                  <button type="button" aria-label="Remover foto" onClick={() => setFotos((l) => l.filter((x) => x.id !== f.id))}
                    className="icon-btn absolute right-1.5 top-1.5" style={{ width: 30, height: 30 }}><Fechar width={14} height={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {camera && sessao && (
        <CameraEvidencia instrutor={sessao.nome} colaborador={colab?.nome}
          onFechar={() => setCamera(false)} onConcluir={(e) => { setFotos((l) => [...l, e]); setCamera(false); }} />
      )}

      {erro && <p className="alert af" role="alert">{erro}</p>}

      {/* Barra fixa com resultado ao vivo */}
      <div className="dock">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex flex-1 items-center gap-3">
            <span key={String(resultado.apto)} className={`chip ap px-3.5 py-1.5 text-sm ${resultado.apto ? "chip-ok" : "chip-bad"}`}>
              {resultado.apto ? "APTO" : "INAPTO"}
            </span>
            <span className="muted text-sm">
              {resultado.eliminatoria ? "eliminatória" : `${resultado.pontos}/${REGRAS.pratica.limitePontosInfracao} pts`}
            </span>
            {!colab && <span className="chip chip-warn hidden sm:inline-flex">falta o colaborador</span>}
            {!descricao.trim() && (
              <span className="chip chip-warn hidden sm:inline-flex">falta a descrição</span>
            )}
            {fotos.length === 0 && (
              <span className="chip chip-warn hidden sm:inline-flex"><Camera width={12} height={12} /> falta a foto</span>
            )}
          </div>
          <button onClick={salvar} disabled={salvando} className="btn btn-p">
            {salvando ? <><span className="spinner" /> Salvando…</> : "Registrar"}
          </button>
        </div>
      </div>
    </section>
  );
}
