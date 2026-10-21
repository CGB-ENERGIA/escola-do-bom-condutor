import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { REGRAS, type RegistroTeorico } from "@ebc/shared";
import { Barras, BarrasDuplas, Painel, Ranking, Rosca, fmt } from "../components/Graficos";
import { Fechar, Lista, Mais } from "../components/Icones";
import { apiInstrutor, instrutorSessao } from "../lib/api";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SEM = "(sem informação)";

type Situacao = "" | "aprovado" | "reprovado";
type Filtros = { ano: string; mes: string; gerencia: string; base: string; situacao: Situacao };
const LIMPO: Filtros = { ano: "", mes: "", gerencia: "", base: "", situacao: "" };

type Linha = RegistroTeorico & { ano: number; mes: number; gerenciaK: string; baseK: string };

const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Agrupa e devolve [chave, registros]. */
function agrupar(linhas: Linha[], chave: (l: Linha) => string) {
  const m = new Map<string, Linha[]>();
  for (const l of linhas) { const k = chave(l); (m.get(k) ?? m.set(k, []).get(k)!).push(l); }
  return [...m.entries()];
}

/** Dashboard interativo da avaliação teórica (filtros + gráficos que também filtram ao clicar). */
export default function InstrutorDashboard() {
  const nav = useNavigate();
  const [dados, setDados] = useState<RegistroTeorico[]>();
  const [demo, setDemo] = useState(false);
  const [erro, setErro] = useState<string>();
  const [f, setF] = useState<Filtros>(LIMPO);

  useEffect(() => {
    if (!instrutorSessao.get()) return;
    setDados(undefined); setErro(undefined);
    apiInstrutor.dashboardTeorica(demo).then((r) => setDados(r.registros)).catch((e: Error) => {
      if (e.message.includes("Sessão")) { instrutorSessao.limpar(); nav("/instrutor"); } else setErro(e.message);
    });
  }, [demo, nav]);

  const todas: Linha[] = useMemo(() => (dados ?? []).map((r) => {
    const d = new Date(r.finalizadaEm);
    return { ...r, ano: d.getFullYear(), mes: d.getMonth() + 1, gerenciaK: r.gerencia ?? SEM, baseK: r.base ?? SEM };
  }), [dados]);

  if (!instrutorSessao.get()) return <Navigate to="/instrutor" replace />;

  const set = (p: Partial<Filtros>) => setF((x) => ({ ...x, ...p }));
  /** Clicar de novo no mesmo item remove o filtro. */
  const alternar = (campo: keyof Filtros, valor: string) => setF((x) => ({ ...x, [campo]: x[campo] === valor ? "" : valor }));

  const anos = [...new Set(todas.map((l) => l.ano))].sort((a, b) => b - a);
  const gerencias = [...new Set(todas.map((l) => l.gerenciaK))].sort();
  const bases = [...new Set(todas.map((l) => l.baseK))].sort();

  const passa = (l: Linha, ignorar?: keyof Filtros) =>
    (ignorar === "ano" || !f.ano || String(l.ano) === f.ano) &&
    (ignorar === "mes" || !f.mes || String(l.mes) === f.mes) &&
    (ignorar === "gerencia" || !f.gerencia || l.gerenciaK === f.gerencia) &&
    (ignorar === "base" || !f.base || l.baseK === f.base) &&
    (ignorar === "situacao" || !f.situacao || (f.situacao === "aprovado") === l.aprovado);

  const linhas = todas.filter((l) => passa(l));
  const aprovados = linhas.filter((l) => l.aprovado).length;
  const reprovados = linhas.length - aprovados;
  const mediaGeral = media(linhas.map((l) => l.pontos));
  const ativos = (Object.keys(f) as (keyof Filtros)[]).filter((k) => f[k]);

  // Gráficos: cada um ignora o próprio filtro, para continuar mostrando as demais opções (como no Power BI)
  const porMes = agrupar(todas.filter((l) => passa(l, "ano") && passa(l, "mes")), (l) => `${l.ano}-${String(l.mes).padStart(2, "0")}`)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ chave: k, rotulo: `${MESES[Number(k.slice(5)) - 1]}/${k.slice(2, 4)}`, valor: v.length }));
  const mesSelecionado = f.ano && f.mes ? `${f.ano}-${f.mes.padStart(2, "0")}` : undefined;

  const duplas = (campo: "baseK" | "gerenciaK", ignorar: "base" | "gerencia") =>
    agrupar(todas.filter((l) => passa(l, ignorar)), (l) => l[campo])
      .map(([k, v]) => ({ chave: k, rotulo: k, a: v.filter((l) => l.aprovado).length, b: v.filter((l) => !l.aprovado).length }))
      .sort((x, y) => y.a + y.b - (x.a + x.b));
  const mediaPor = (campo: "baseK" | "gerenciaK", ignorar: "base" | "gerencia") =>
    agrupar(todas.filter((l) => passa(l, ignorar)), (l) => l[campo])
      .map(([k, v]) => ({ chave: k, rotulo: k, valor: media(v.map((l) => l.pontos)) }))
      .sort((x, y) => y.valor - x.valor);

  const ranking = agrupar(linhas, (l) => l.colaboradorId)
    .map(([k, v]) => ({ chave: k, rotulo: v[0]!.nome, valor: media(v.map((l) => l.pontos)) }))
    .sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo));

  const sel = "inp !py-2.5 !text-sm";
  const pctReprovados = linhas.length ? (reprovados / linhas.length) * 100 : 0;

  return (
    <section className="space-y-5">
      <div className="au flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Avaliação <span style={{ color: "var(--p)" }}>teórica</span></h1>
          <p className="muted mt-1 text-sm">Painel de resultados · clique nos gráficos para filtrar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/instrutor/resultados" className="btn btn-g !px-3.5 !py-2 !text-sm"><Lista width={16} height={16} /> Avaliação prática</Link>
          <Link to="/instrutor/avaliacao" className="btn btn-p !px-3.5 !py-2 !text-sm"><Mais width={16} height={16} /> Nova prática</Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="card au d1 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <label className="text-xs font-semibold">Ano
            <select value={f.ano} onChange={(e) => set({ ano: e.target.value })} className={`${sel} mt-1`}>
              <option value="">Todos</option>{anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold">Mês
            <select value={f.mes} onChange={(e) => set({ mes: e.target.value })} className={`${sel} mt-1`}>
              <option value="">Todos</option>{MESES_LONGO.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold">Gerência
            <select value={f.gerencia} onChange={(e) => set({ gerencia: e.target.value })} className={`${sel} mt-1`}>
              <option value="">Todas</option>{gerencias.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold">Base
            <select value={f.base} onChange={(e) => set({ base: e.target.value })} className={`${sel} mt-1`}>
              <option value="">Todas</option>{bases.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <div className="col-span-2 text-xs font-semibold md:col-span-3 lg:col-span-1">Situação
            <div className="mt-1 grid grid-cols-3 gap-1 rounded-[var(--r)] p-1" style={{ background: "var(--surface-3)" }} role="radiogroup" aria-label="Situação">
              {([["", "Todas"], ["aprovado", "Aprovado"], ["reprovado", "Reprovado"]] as const).map(([v, r]) => (
                <button key={v} type="button" role="radio" aria-checked={f.situacao === v} onClick={() => set({ situacao: v })}
                  className="rounded-[calc(var(--r)-4px)] px-1 py-2 text-xs font-bold transition-all"
                  style={{
                    border: 0, cursor: "pointer", font: "inherit", fontSize: ".75rem", fontWeight: 700,
                    background: f.situacao === v ? (v === "reprovado" ? "var(--d)" : "var(--p)") : "transparent",
                    color: f.situacao === v ? "var(--p-fg)" : "var(--fg-muted)",
                  }}>{r}</button>
              ))}
            </div>
          </div>
        </div>
        {(ativos.length > 0 || demo) && (
          <div className="af mt-3 flex flex-wrap items-center gap-2">
            {ativos.map((k) => (
              <button key={k} onClick={() => set({ [k]: "" })} className="chip chip-ok" style={{ border: 0, cursor: "pointer" }}>
                {k === "mes" ? MESES_LONGO[Number(f.mes) - 1] : f[k]} <Fechar width={12} height={12} />
              </button>
            ))}
            {ativos.length > 0 && <button onClick={() => setF(LIMPO)} className="link text-xs">Limpar filtros</button>}
          </div>
        )}
      </div>

      {demo && <p className="chip chip-warn af">DADOS DE DEMONSTRAÇÃO (fictícios)</p>}
      {erro && <p className="alert af" role="alert">{erro}</p>}
      {!dados && !erro && (
        <div className="grid gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((n) => <div key={n} className="skel" style={{ height: 96 }} />)}</div>
      )}

      {dados && todas.length === 0 && (
        <div className="card au p-8 text-center">
          <p className="text-lg font-bold">Ainda não há provas finalizadas</p>
          <p className="muted mx-auto mt-1 max-w-md text-sm">Assim que os colaboradores concluírem a prova teórica, os resultados aparecem aqui automaticamente.</p>
          <button onClick={() => setDemo(true)} className="btn btn-g mt-5">Ver com dados de demonstração</button>
        </div>
      )}

      {dados && todas.length > 0 && (
        <>
          {/* Indicadores */}
          <div className="au d2 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { rot: "Avaliados", val: String(linhas.length), cor: "var(--i)" },
              { rot: "Aprovados", val: String(aprovados), cor: "var(--p)" },
              { rot: "Reprovados", val: linhas.length ? String(reprovados) : "—", cor: "var(--d)" },
              { rot: "Média de acertos", val: linhas.length ? fmt(mediaGeral) : "—", cor: "var(--fg-muted)" },
            ].map((k) => (
              <div key={k.rot} className="card relative overflow-hidden p-4" style={{ borderRadius: "var(--r)" }}>
                <span className="absolute inset-y-0 left-0" style={{ width: 4, background: k.cor }} />
                <p className="muted pl-2 text-xs font-semibold">{k.rot}</p>
                <p className="pl-2 text-4xl font-extrabold leading-tight" style={{ fontVariantNumeric: "tabular-nums" }}>{k.val}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <Painel titulo="Avaliações por mês" className="lg:col-span-4">
              <Barras itens={porMes} selecionado={mesSelecionado}
                onSelecionar={(k) => (mesSelecionado === k ? set({ ano: "", mes: "" }) : set({ ano: String(Number(k.slice(0, 4))), mes: String(Number(k.slice(5))) }))} />
            </Painel>
            <Painel titulo="Aprovados vs Reprovados por base" className="lg:col-span-4">
              <BarrasDuplas itens={duplas("baseK", "base")} selecionado={f.base} onSelecionar={(k) => alternar("base", k)} />
            </Painel>
            <Painel titulo="Aprovados vs Reprovados por gerência" className="lg:col-span-4">
              <BarrasDuplas itens={duplas("gerenciaK", "gerencia")} selecionado={f.gerencia} onSelecionar={(k) => alternar("gerencia", k)} />
            </Painel>

            <Painel titulo="% de reprovados" className="lg:col-span-3">
              <Rosca pct={pctReprovados} rotulo={`${reprovados} de ${linhas.length}`} />
            </Painel>
            <Painel titulo="Média por base" className="lg:col-span-3">
              <Barras itens={mediaPor("baseK", "base")} selecionado={f.base} onSelecionar={(k) => alternar("base", k)} cor="var(--p-h)" />
            </Painel>
            <Painel titulo="Média por gerência" className="lg:col-span-3">
              <Barras itens={mediaPor("gerenciaK", "gerencia")} selecionado={f.gerencia} onSelecionar={(k) => alternar("gerencia", k)} cor="var(--p-h)" />
            </Painel>
            <Painel titulo="Média por colaborador" className="lg:col-span-3">
              <Ranking itens={ranking} minimo={REGRAS.teorica.acertosMinimos} max={REGRAS.teorica.totalQuestoes} />
            </Painel>
          </div>

          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="faint">Mínimo para aprovação: {REGRAS.teorica.acertosMinimos} de {REGRAS.teorica.totalQuestoes}. Barras vermelhas no ranking = abaixo do mínimo.</span>
            <label className="muted flex cursor-pointer items-center gap-2 font-semibold">
              <input type="checkbox" checked={demo} onChange={(e) => { setDemo(e.target.checked); setF(LIMPO); }} /> Dados de demonstração
            </label>
          </div>
        </>
      )}
    </section>
  );
}
