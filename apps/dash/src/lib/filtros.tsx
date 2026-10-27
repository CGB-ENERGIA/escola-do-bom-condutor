import { useState, type ReactNode } from "react";
import { Fechar } from "../components/Icones";

export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MESES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const SEM = "(sem informação)";

export type Situacao = "" | "sim" | "nao";
export type Filtros = { ano: string; mes: string; gerencia: string; base: string; coordenador: string; colaborador: string; situacao: Situacao };
export const LIMPO: Filtros = { ano: "", mes: "", gerencia: "", base: "", coordenador: "", colaborador: "", situacao: "" };

/** Campos que todo registro do painel precisa ter para ser filtrado. */
export type Filtravel = { ano: number; mes: number; gerenciaK: string; baseK: string; coordK: string; ok: boolean; colabId: string; colabNome: string };

export const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export function agrupar<T>(linhas: T[], chave: (l: T) => string) {
  const m = new Map<string, T[]>();
  for (const l of linhas) { const k = chave(l); (m.get(k) ?? m.set(k, []).get(k)!).push(l); }
  return [...m.entries()];
}

/** Nome abreviado das bases, usado em todos os gráficos e filtros do painel. */
const SIGLAS: Record<string, string> = {
  "BACABAL": "BCB", "SANTA INES": "STI", "ITAPECURU MIRIM": "ITM",
  "PEDREIRAS": "PDS", "PRESIDENTE DUTRA": "PDT", "BARRA DO CORDA": "BDC",
};
export function siglaBase(base: string | null): string {
  if (!base) return SEM;
  const chave = base.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/\s*-\s*/g, " ").trim();
  return SIGLAS[chave] ?? base;
}

/** Derivados de data/base/gerência usados pelos filtros. */
export function derivar(data: string | null, gerencia: string | null, base: string | null, coordenador?: string | null) {
  const d = data ? new Date(data) : null;
  return { ano: d ? d.getFullYear() : 0, mes: d ? d.getMonth() + 1 : 0, gerenciaK: gerencia ?? SEM, baseK: siglaBase(base), coordK: coordenador ?? SEM };
}

/** Estado dos filtros + função que diz se uma linha passa (cada gráfico pode ignorar o próprio filtro). */
export function useFiltros<T extends Filtravel>() {
  const [f, setF] = useState<Filtros>(LIMPO);
  const set = (p: Partial<Filtros>) => setF((x) => ({ ...x, ...p }));
  /** Clicar de novo no mesmo item remove o filtro. */
  const alternar = (campo: keyof Filtros, valor: string) => setF((x) => ({ ...x, [campo]: x[campo] === valor ? "" : valor }));
  const passa = (l: T, ignorar?: keyof Filtros) =>
    (ignorar === "ano" || !f.ano || String(l.ano) === f.ano) &&
    (ignorar === "mes" || !f.mes || String(l.mes) === f.mes) &&
    (ignorar === "gerencia" || !f.gerencia || l.gerenciaK === f.gerencia) &&
    (ignorar === "base" || !f.base || l.baseK === f.base) &&
    (ignorar === "coordenador" || !f.coordenador || l.coordK === f.coordenador) &&
    (ignorar === "colaborador" || !f.colaborador || l.colabId === f.colaborador) &&
    (ignorar === "situacao" || !f.situacao || (f.situacao === "sim") === l.ok);
  return { f, set, alternar, passa, limpar: () => setF(LIMPO) };
}

/** Faixa de filtros (ano, mês, gerência, base e, opcionalmente, situação). */
export function BarraFiltros<T extends Filtravel>({ todas, ctl, situacao, extra, campos, busca }: {
  todas: T[];
  ctl: ReturnType<typeof useFiltros<T>>;
  situacao?: { sim: string; nao: string };
  extra?: ReactNode;
  /** Filtros específicos da página (ex.: categoria, natureza), exibidos junto aos demais. */
  campos?: ReactNode;
  /** Campo de busca por nome/matrícula do colaborador. */
  busca?: { valor: string; onChange: (v: string) => void };
}) {
  const { f, set, limpar } = ctl;
  const anos = [...new Set(todas.map((l) => l.ano).filter(Boolean))].sort((a, b) => b - a);
  const gerencias = [...new Set(todas.map((l) => l.gerenciaK))].sort();
  const bases = [...new Set(todas.map((l) => l.baseK))].sort();
  const coordenadores = [...new Set(todas.map((l) => l.coordK))].sort();
  const ativos = (Object.keys(f) as (keyof Filtros)[]).filter((k) => f[k]);
  const sel = "inp !py-2.5 !text-sm";
  const rotSit = (v: Situacao) => (v === "sim" ? situacao?.sim : v === "nao" ? situacao?.nao : "");
  return (
    <div className="card au d1 p-4 sm:p-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
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
        <label className="text-xs font-semibold">Coordenador
          <select value={f.coordenador} onChange={(e) => set({ coordenador: e.target.value })} className={`${sel} mt-1`}>
            <option value="">Todos</option>{coordenadores.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
        {busca && (
          <label className="col-span-2 text-xs font-semibold md:col-span-2">Colaborador
            <input value={busca.valor} onChange={(e) => busca.onChange(e.target.value)} placeholder="Nome ou matrícula" className={`${sel} mt-1`} />
          </label>
        )}
        {campos}
        {situacao && (
          <div className="col-span-2 text-xs font-semibold md:col-span-4 lg:col-span-1">Situação
            <div className="mt-1 grid grid-cols-3 gap-1 rounded-[var(--r)] p-1" style={{ background: "var(--surface-3)" }} role="radiogroup" aria-label="Situação">
              {([["", "Todas"], ["sim", situacao.sim], ["nao", situacao.nao]] as const).map(([v, r]) => (
                <button key={v} type="button" role="radio" aria-checked={f.situacao === v} onClick={() => set({ situacao: v })}
                  className="rounded-[calc(var(--r)-4px)] px-1 py-2 transition-all"
                  style={{
                    border: 0, cursor: "pointer", font: "inherit", fontSize: ".75rem", fontWeight: 700,
                    background: f.situacao === v ? (v === "nao" ? "var(--d)" : "var(--p)") : "transparent",
                    color: f.situacao === v ? "var(--p-fg)" : "var(--fg-muted)",
                  }}>{r}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      {(ativos.length > 0 || extra) && (
        <div className="af mt-3 flex flex-wrap items-center gap-2">
          {ativos.map((k) => (
            <button key={k} onClick={() => set({ [k]: "" })} className="chip chip-ok" style={{ border: 0, cursor: "pointer" }}>
              {k === "mes" ? MESES_LONGO[Number(f.mes) - 1] : k === "situacao" ? rotSit(f.situacao) : k === "colaborador" ? (todas.find((l) => l.colabId === f.colaborador)?.colabNome ?? f.colaborador) : f[k]} <Fechar width={12} height={12} />
            </button>
          ))}
          {ativos.length > 0 && <button onClick={limpar} className="link text-xs">Limpar filtros</button>}
          {extra}
        </div>
      )}
    </div>
  );
}

/** Cartões de indicadores (KPIs). */
export function Indicadores({ itens }: { itens: { rot: string; val: string; cor: string }[] }) {
  return (
    <div className="au d2 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {itens.map((k) => (
        <div key={k.rot} className="card relative overflow-hidden p-4" style={{ borderRadius: "var(--r)" }}>
          <span className="absolute inset-y-0 left-0" style={{ width: 4, background: k.cor }} />
          <p className="muted pl-2 text-xs font-semibold">{k.rot}</p>
          <p className="pl-2 text-4xl font-extrabold leading-tight" style={{ fontVariantNumeric: "tabular-nums" }}>{k.val}</p>
        </div>
      ))}
    </div>
  );
}

/** Mês/ano -> chave "2026-10" e rótulo "out/26". */
export const chaveMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;
export const rotuloMes = (k: string) => `${MESES[Number(k.slice(5)) - 1]}/${k.slice(2, 4)}`;
