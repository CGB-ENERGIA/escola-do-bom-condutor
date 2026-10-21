import type { ReactNode } from "react";

export const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d });

/** Cartão de gráfico com título (estilo painel). */
export function Painel({ titulo, children, className = "" }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card au flex min-w-0 flex-col p-4 sm:p-5 ${className}`}>
      <h3 className="mb-3 text-center text-[0.95rem] font-bold tracking-tight" style={{ color: "var(--p)" }}>{titulo}</h3>
      <div className="flex-1">{children}</div>
    </section>
  );
}

export const Vazio = () => <p className="faint grid h-full min-h-[8rem] place-items-center text-sm">Sem dados para os filtros.</p>;

type Sel = { selecionado?: string; onSelecionar?: (chave: string) => void };

/** Barras verticais simples. Clicar numa barra aplica o filtro (como no Power BI). */
export function Barras({ itens, selecionado, onSelecionar, cor = "var(--p)", altura = 170 }: {
  itens: { chave: string; rotulo: string; valor: number }[]; cor?: string; altura?: number;
} & Sel) {
  if (!itens.length) return <Vazio />;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-full items-end gap-2" style={{ height: altura + 44 }}>
        {itens.map((i, idx) => {
          const ativo = !selecionado || selecionado === i.chave;
          return (
            <button key={i.chave} type="button" onClick={() => onSelecionar?.(i.chave)} title={`${i.rotulo}: ${fmt(i.valor)}`}
              className="group flex min-w-[2.6rem] flex-1 flex-col items-center justify-end gap-1.5 bg-transparent"
              style={{ height: "100%", border: 0, cursor: onSelecionar ? "pointer" : "default", opacity: ativo ? 1 : 0.35, transition: "opacity .2s", font: "inherit", color: "inherit" }}>
              <span className="text-[0.7rem] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(i.valor)}</span>
              <span className="block w-full max-w-[3rem] rounded-t-md transition-[filter] group-hover:brightness-110"
                style={{ height: `${Math.max(2, (i.valor / max) * altura)}px`, background: cor, transformOrigin: "bottom", animation: `growY .6s ${idx * 50}ms cubic-bezier(.22,.8,.36,1) both` }} />
              <span className="muted w-full truncate text-center text-[0.68rem] font-semibold">{i.rotulo}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Barras agrupadas (aprovados x reprovados) por categoria. */
export function BarrasDuplas({ itens, selecionado, onSelecionar, altura = 150, rotA = "Aprovados", rotB = "Reprovados" }: {
  itens: { chave: string; rotulo: string; a: number; b: number }[]; altura?: number; rotA?: string; rotB?: string;
} & Sel) {
  if (!itens.length) return <Vazio />;
  const max = Math.max(...itens.flatMap((i) => [i.a, i.b]), 1);
  const barra = (v: number, cor: string, idx: number) => (
    <span className="flex flex-col items-center justify-end gap-1" style={{ width: "1.2rem", height: "100%" }}>
      <span className="text-[0.65rem] font-bold" style={{ fontVariantNumeric: "tabular-nums", opacity: v ? 1 : 0.4 }}>{v}</span>
      <span className="block w-full rounded-t" style={{ height: `${v ? Math.max(3, (v / max) * altura) : 2}px`, background: cor, transformOrigin: "bottom", animation: `growY .6s ${idx * 50}ms cubic-bezier(.22,.8,.36,1) both` }} />
    </span>
  );
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-full items-end gap-1" style={{ height: altura + 44 }}>
          {itens.map((i, idx) => {
            const ativo = !selecionado || selecionado === i.chave;
            return (
              <button key={i.chave} type="button" onClick={() => onSelecionar?.(i.chave)} title={`${i.rotulo}: ${i.a} ${rotA.toLowerCase()}, ${i.b} ${rotB.toLowerCase()}`}
                className="flex min-w-[3.4rem] flex-1 flex-col items-center justify-end gap-1.5 bg-transparent"
                style={{ height: "100%", border: 0, cursor: onSelecionar ? "pointer" : "default", opacity: ativo ? 1 : 0.35, transition: "opacity .2s", font: "inherit", color: "inherit" }}>
                <span className="flex items-end gap-1" style={{ height: altura + 20 }}>{barra(i.a, "var(--p)", idx)}{barra(i.b, "var(--d)", idx)}</span>
                <span className="muted w-full truncate text-center text-[0.68rem] font-semibold">{i.rotulo}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="muted mt-2 flex justify-center gap-4 text-[0.7rem]">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block rounded-full" style={{ width: 8, height: 8, background: "var(--p)" }} />{rotA}</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block rounded-full" style={{ width: 8, height: 8, background: "var(--d)" }} />{rotB}</span>
      </p>
    </div>
  );
}

/** Rosca: percentual de reprovados. */
export function Rosca({ pct, rotulo, cor = "var(--d)" }: { pct: number; rotulo: string; cor?: string }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="grid h-full place-items-center py-2">
      <div className="relative" style={{ width: 168, height: 168 }}>
        <svg viewBox="0 0 120 120" width="168" height="168" style={{ transform: "rotate(-90deg)" }} role="img" aria-label={`${fmt(pct)}% ${rotulo}`}>
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="14" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={cor} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, pct) / 100)} style={{ transition: "stroke-dashoffset .8s cubic-bezier(.22,.8,.36,1)" }} />
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="text-3xl font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(pct)}%</span>
          <span className="muted text-[0.7rem] font-semibold">{rotulo}</span>
        </div>
      </div>
    </div>
  );
}

const PALETA = ["var(--p)", "var(--i)", "var(--o)", "var(--w)", "#8b5cf6", "#14b8a6", "var(--d)", "#64748b"];

/** Rosca com várias fatias (participação por base / gerência). Clicar numa fatia filtra. */
export function Pizza({ itens, selecionado, onSelecionar }: { itens: { chave: string; rotulo: string; valor: number }[] } & Sel) {
  if (!itens.length) return <Vazio />;
  const total = itens.reduce((s, i) => s + i.valor, 0) || 1;
  const r = 44, c = 2 * Math.PI * r;
  let acumulado = 0;
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <svg viewBox="0 0 120 120" width="150" height="150" style={{ transform: "rotate(-90deg)", flex: "none" }} role="img" aria-label="Distribuição">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="16" />
        {itens.map((i, idx) => {
          const len = (i.valor / total) * c;
          const el = (
            <circle key={i.chave} cx="60" cy="60" r={r} fill="none" stroke={PALETA[idx % PALETA.length]} strokeWidth="16"
              strokeDasharray={`${Math.max(0, len - 1)} ${c}`} strokeDashoffset={-acumulado}
              opacity={!selecionado || selecionado === i.chave ? 1 : 0.3}
              style={{ cursor: onSelecionar ? "pointer" : "default", transition: "opacity .2s" }} onClick={() => onSelecionar?.(i.chave)}>
              <title>{`${i.rotulo}: ${i.valor} (${fmt((i.valor / total) * 100, 0)}%)`}</title>
            </circle>
          );
          acumulado += len;
          return el;
        })}
      </svg>
      <ul className="grid gap-1 text-xs">
        {itens.map((i, idx) => (
          <li key={i.chave}>
            <button type="button" onClick={() => onSelecionar?.(i.chave)} className="flex items-center gap-2 bg-transparent"
              style={{ border: 0, cursor: onSelecionar ? "pointer" : "default", font: "inherit", color: "inherit", opacity: !selecionado || selecionado === i.chave ? 1 : 0.4 }}>
              <i className="inline-block rounded-full" style={{ width: 9, height: 9, background: PALETA[idx % PALETA.length] }} />
              <span className="font-semibold">{i.rotulo}</span>
              <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>{i.valor} · {fmt((i.valor / total) * 100, 0)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Linha suave (horas por mês). */
export function Linha({ itens, selecionado, onSelecionar }: { itens: { chave: string; rotulo: string; valor: number }[] } & Sel) {
  if (!itens.length) return <Vazio />;
  const W = 320, H = 170, px = 24, py = 24;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  const x = (i: number) => (itens.length === 1 ? W / 2 : px + (i * (W - 2 * px)) / (itens.length - 1));
  const y = (v: number) => H - py - (v / max) * (H - 2 * py);
  const pts = itens.map((it, i) => [x(i), y(it.valor)] as const);
  const d = pts.map(([a, b], i) => {
    if (i === 0) return `M${a},${b}`;
    const [pa, pb] = pts[i - 1]!;
    const cx = (pa + a) / 2;
    return `C${cx},${pb} ${cx},${b} ${a},${b}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Evolução por mês">
      <path d={`${d} L${pts[pts.length - 1]![0]},${H - py} L${pts[0]![0]},${H - py} Z`} fill="var(--p)" opacity=".1" />
      <path d={d} fill="none" stroke="var(--p)" strokeWidth="3" strokeLinecap="round" />
      {itens.map((it, i) => (
        <g key={it.chave} style={{ cursor: onSelecionar ? "pointer" : "default", opacity: !selecionado || selecionado === it.chave ? 1 : 0.35 }}
          onClick={() => onSelecionar?.(it.chave)}>
          <circle cx={pts[i]![0]} cy={pts[i]![1]} r="5" fill="var(--surface)" stroke="var(--p)" strokeWidth="2.5" />
          <text x={pts[i]![0]} y={pts[i]![1] - 11} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--fg)">{fmt(it.valor, 0)}</text>
          <text x={pts[i]![0]} y={H + 8} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--fg-muted)">{it.rotulo}</text>
        </g>
      ))}
    </svg>
  );
}

/** Lista com contagem (participação por colaborador, aptos, inaptos, reteste). */
export function ListaContagem({ itens, cor = "var(--p)", altura = "18rem" }: {
  itens: { chave: string; rotulo: string; valor: number }[]; cor?: string; altura?: string;
}) {
  if (!itens.length) return <Vazio />;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <ul className="space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: altura, scrollbarWidth: "thin" }}>
      {itens.map((i) => (
        <li key={i.chave} className="grid items-center gap-2 text-xs" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) 1.5rem" }}>
          <span className="truncate text-right font-semibold" title={i.rotulo}>{i.rotulo}</span>
          <span className="bar !h-2.5"><span style={{ width: `${(i.valor / max) * 100}%`, background: cor }} /></span>
          <span className="font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{i.valor}</span>
        </li>
      ))}
    </ul>
  );
}

/** Ranking horizontal rolável (média por colaborador). Abaixo do mínimo = vermelho. */
export function Ranking({ itens, minimo, max }: { itens: { chave: string; rotulo: string; valor: number }[]; minimo: number; max: number }) {
  if (!itens.length) return <Vazio />;
  return (
    <ul className="max-h-[22rem] space-y-1.5 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
      {itens.map((i) => (
        <li key={i.chave} className="grid items-center gap-2 text-xs" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) 2rem" }}>
          <span className="truncate text-right font-semibold" title={i.rotulo}>{i.rotulo}</span>
          <span className="bar !h-2.5"><span style={{ width: `${(i.valor / max) * 100}%`, background: i.valor < minimo ? "var(--d)" : "var(--i)" }} /></span>
          <span className="font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(i.valor)}</span>
        </li>
      ))}
    </ul>
  );
}
