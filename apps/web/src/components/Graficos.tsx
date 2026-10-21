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
export function BarrasDuplas({ itens, selecionado, onSelecionar, altura = 150 }: {
  itens: { chave: string; rotulo: string; a: number; b: number }[]; altura?: number;
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
              <button key={i.chave} type="button" onClick={() => onSelecionar?.(i.chave)} title={`${i.rotulo}: ${i.a} aprovado(s), ${i.b} reprovado(s)`}
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
        <span className="inline-flex items-center gap-1.5"><i className="inline-block rounded-full" style={{ width: 8, height: 8, background: "var(--p)" }} />Aprovados</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block rounded-full" style={{ width: 8, height: 8, background: "var(--d)" }} />Reprovados</span>
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
