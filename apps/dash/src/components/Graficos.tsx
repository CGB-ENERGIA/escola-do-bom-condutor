import { useState, type MouseEvent, type ReactNode } from "react";

export const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d });
const pct = (parte: number, total: number) => (total ? `${fmt((parte / total) * 100)}%` : "—");

/* ── Cartão de detalhes (aparece ao passar o mouse ou tocar) ───────────────── */
type Linha = { rot: string; val: string; cor?: string };
type TipConteudo = { titulo: string; cor?: string; linhas: Linha[] };
type TipDados = TipConteudo & { x: number; y: number };

function TipCard({ x, y, titulo, cor, linhas }: TipDados) {
  const w = typeof window === "undefined" ? 1200 : window.innerWidth;
  const h = typeof window === "undefined" ? 800 : window.innerHeight;
  const left = x + 18 > w - 240 ? Math.max(8, x - 18 - 220) : x + 18;
  const top = y + 18 > h - 40 - 34 * (linhas.length + 1) ? Math.max(8, y - 28 - 34 * (linhas.length + 1)) : y + 18;
  return (
    <div className="tip" style={{ left, top }} role="tooltip">
      <p className="tip-t">
        {cor && <i style={{ background: cor }} />}
        <span>{titulo}</span>
      </p>
      <dl>
        {linhas.map((l) => (
          <div key={l.rot}>
            <dt>{l.cor && <i style={{ background: l.cor }} />}{l.rot}</dt>
            <dd>{l.val}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Controla o cartão de detalhes de um gráfico: `props(conteudo)` vai no elemento, `node` vai no fim do gráfico. */
function useTip() {
  const [tip, setTip] = useState<TipDados | null>(null);
  const mostrar = (e: MouseEvent, c: TipConteudo) => setTip({ x: e.clientX, y: e.clientY, ...c });
  return {
    props: (c: TipConteudo) => ({
      onMouseEnter: (e: MouseEvent) => mostrar(e, c),
      onMouseMove: (e: MouseEvent) => mostrar(e, c),
      onMouseLeave: () => setTip(null),
    }),
    esconder: () => setTip(null),
    node: tip ? <TipCard {...tip} /> : null,
  };
}

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

/** Linha de lista clicável (mouse e teclado): clicar filtra o painel; clicar de novo remove o filtro. */
function linhaClicavel(chave: string, selecionado?: string, onSelecionar?: (c: string) => void) {
  if (!onSelecionar) return {};
  return {
    role: "button" as const, tabIndex: 0, "aria-pressed": selecionado === chave,
    onClick: () => onSelecionar(chave),
    onKeyDown: (e: { key: string; preventDefault: () => void }) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelecionar(chave); } },
  };
}
function estiloLinha(chave: string, selecionado?: string, onSelecionar?: (c: string) => void) {
  return {
    cursor: onSelecionar ? "pointer" : "default",
    opacity: !selecionado || selecionado === chave ? 1 : 0.4,
    background: selecionado === chave ? "var(--p-tint)" : undefined,
    transition: "opacity .2s, background-color .15s",
  } as const;
}

/** Barras verticais ajustadas à largura do painel (sem rolagem). Passe o mouse para ver os detalhes; clique para filtrar. */
export function Barras({ itens, selecionado, onSelecionar, cor = "var(--p)", altura = 170, rotValor = "Total", mostrarPct = true }: {
  itens: { chave: string; rotulo: string; valor: number }[]; cor?: string; altura?: number; rotValor?: string; mostrarPct?: boolean;
} & Sel) {
  const tip = useTip();
  if (!itens.length) return <Vazio />;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  const soma = itens.reduce((s, i) => s + i.valor, 0);
  return (
    <div>
      <div className="flex w-full items-end gap-1 sm:gap-1.5" style={{ height: altura + 44 }}>
        {itens.map((i, idx) => {
          const ativo = !selecionado || selecionado === i.chave;
          const linhas: Linha[] = [{ rot: rotValor, val: fmt(i.valor), cor }];
          if (mostrarPct) linhas.push({ rot: "% do total", val: pct(i.valor, soma) });
          return (
            <button key={i.chave} type="button" onClick={() => onSelecionar?.(i.chave)} aria-label={`${i.rotulo}: ${fmt(i.valor)}`}
              {...tip.props({ titulo: i.rotulo, cor, linhas })}
              className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 bg-transparent"
              style={{ height: "100%", border: 0, cursor: onSelecionar ? "pointer" : "default", opacity: ativo ? 1 : 0.35, transition: "opacity .2s", font: "inherit", color: "inherit" }}>
              <span className="text-[0.7rem] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(i.valor)}</span>
              <span className="block w-full max-w-[3.2rem] rounded-t-md transition-[filter,transform] group-hover:-translate-y-0.5 group-hover:brightness-110"
                style={{ height: `${Math.max(2, (i.valor / max) * altura)}px`, background: cor, transformOrigin: "bottom", animation: `growY .6s ${idx * 50}ms cubic-bezier(.22,.8,.36,1) both` }} />
              <span className="muted w-full truncate text-center text-[0.66rem] font-semibold">{i.rotulo}</span>
            </button>
          );
        })}
      </div>
      {tip.node}
    </div>
  );
}

/** Barras agrupadas (ex.: aptos x inaptos) por categoria, sem rolagem. */
export function BarrasDuplas({ itens, selecionado, onSelecionar, altura = 150, rotA = "Aprovados", rotB = "Reprovados" }: {
  itens: { chave: string; rotulo: string; a: number; b: number }[]; altura?: number; rotA?: string; rotB?: string;
} & Sel) {
  const tip = useTip();
  if (!itens.length) return <Vazio />;
  const max = Math.max(...itens.flatMap((i) => [i.a, i.b]), 1);
  const barra = (v: number, cor: string, idx: number) => (
    <span className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" style={{ maxWidth: "1.4rem", height: "100%" }}>
      <span className="text-[0.65rem] font-bold" style={{ fontVariantNumeric: "tabular-nums", opacity: v ? 1 : 0.4 }}>{v}</span>
      <span className="block w-full rounded-t" style={{ height: `${v ? Math.max(3, (v / max) * altura) : 2}px`, background: cor, transformOrigin: "bottom", animation: `growY .6s ${idx * 50}ms cubic-bezier(.22,.8,.36,1) both` }} />
    </span>
  );
  return (
    <div>
      <div className="flex w-full items-end gap-1" style={{ height: altura + 44 }}>
        {itens.map((i, idx) => {
          const ativo = !selecionado || selecionado === i.chave;
          const t = i.a + i.b;
          return (
            <button key={i.chave} type="button" onClick={() => onSelecionar?.(i.chave)} aria-label={`${i.rotulo}: ${i.a} ${rotA}, ${i.b} ${rotB}`}
              {...tip.props({
                titulo: i.rotulo,
                linhas: [
                  { rot: rotA, val: `${i.a} · ${pct(i.a, t)}`, cor: "var(--p)" },
                  { rot: rotB, val: `${i.b} · ${pct(i.b, t)}`, cor: "var(--d)" },
                  { rot: "Total", val: String(t) },
                ],
              })}
              className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 bg-transparent"
              style={{ height: "100%", border: 0, cursor: onSelecionar ? "pointer" : "default", opacity: ativo ? 1 : 0.35, transition: "opacity .2s", font: "inherit", color: "inherit" }}>
              <span className="flex w-full items-end justify-center gap-0.5 transition-transform group-hover:-translate-y-0.5" style={{ height: altura + 20 }}>{barra(i.a, "var(--p)", idx)}{barra(i.b, "var(--d)", idx)}</span>
              <span className="muted w-full truncate text-center text-[0.66rem] font-semibold">{i.rotulo}</span>
            </button>
          );
        })}
      </div>
      <p className="muted mt-2 flex justify-center gap-4 text-[0.7rem]">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block rounded-full" style={{ width: 8, height: 8, background: "var(--p)" }} />{rotA}</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block rounded-full" style={{ width: 8, height: 8, background: "var(--d)" }} />{rotB}</span>
      </p>
      {tip.node}
    </div>
  );
}

/** Rosca de um percentual (ex.: % de inaptos), com legenda embaixo. */
export function Rosca({ pct: valor, rotulo, cor = "var(--d)", legenda }: {
  pct: number; rotulo: string; cor?: string; legenda?: { rotulo: string; valor: number; cor: string }[];
}) {
  const tip = useTip();
  const r = 52, c = 2 * Math.PI * r;
  const total = legenda?.reduce((s, l) => s + l.valor, 0) ?? 0;
  return (
    <div className="grid h-full place-items-center gap-3 py-2">
      <div className="relative" style={{ width: 176, height: 176 }}
        {...tip.props({
          titulo: rotulo,
          cor,
          linhas: [{ rot: "Percentual", val: `${fmt(valor)}%` }, ...(legenda?.map((l) => ({ rot: l.rotulo, val: `${l.valor} · ${pct(l.valor, total)}`, cor: l.cor })) ?? [])],
        })}>
        <svg viewBox="0 0 120 120" width="176" height="176" style={{ transform: "rotate(-90deg)" }} role="img" aria-label={`${fmt(valor)}% ${rotulo}`}>
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="14" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={cor} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, valor) / 100)} style={{ transition: "stroke-dashoffset .8s cubic-bezier(.22,.8,.36,1)" }} />
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="text-3xl font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(valor)}%</span>
          <span className="muted text-[0.7rem] font-semibold">{rotulo}</span>
        </div>
      </div>
      {legenda && (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
          {legenda.map((l) => (
            <li key={l.rotulo} className="inline-flex items-center gap-1.5">
              <i className="inline-block rounded-full" style={{ width: 9, height: 9, background: l.cor }} />
              <span className="font-semibold">{l.rotulo}</span>
              <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>{l.valor}</span>
            </li>
          ))}
        </ul>
      )}
      {tip.node}
    </div>
  );
}

const PALETA = ["var(--p)", "var(--i)", "var(--o)", "var(--w)", "#8b5cf6", "#14b8a6", "var(--d)", "#64748b"];

/** Rosca com várias fatias: rótulos FORA do anel, legenda embaixo e cartão de detalhes ao passar o mouse. */
export function Pizza({ itens, selecionado, onSelecionar, rotValor = "Participantes" }: {
  itens: { chave: string; rotulo: string; valor: number }[]; rotValor?: string;
} & Sel) {
  const tip = useTip();
  const [hover, setHover] = useState<string>();
  if (!itens.length) return <Vazio />;

  const total = itens.reduce((s, i) => s + i.valor, 0) || 1;
  const W = 380, H = 280, cx = W / 2, cy = H / 2, r = 64, sw = 28;
  const pt = (a: number, rad: number) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)] as const;

  let ang = -Math.PI / 2;
  const fatias = itens.map((i, idx) => {
    const frac = i.valor / total;
    const a0 = ang, a1 = ang + frac * 2 * Math.PI;
    ang = a1;
    return { ...i, idx, frac, a0, a1, am: (a0 + a1) / 2, cor: PALETA[idx % PALETA.length]! };
  });

  // posição dos rótulos externos; em cada lado, afasta os que ficariam um sobre o outro
  const rotulos = fatias.map((f) => {
    const dir = Math.cos(f.am) >= 0 ? 1 : -1;
    const [px, py] = pt(f.am, r + sw / 2 + 3);
    const [ex, ey] = pt(f.am, r + sw / 2 + 16);
    return { f, dir, px, py, ex, ey, ly: ey };
  });
  for (const lado of [1, -1]) {
    const g = rotulos.filter((l) => l.dir === lado).sort((a, b) => a.ey - b.ey);
    for (let k = 0; k < g.length; k++) {
      const min = k === 0 ? 18 : g[k - 1]!.ly + 31;
      g[k]!.ly = Math.max(g[k]!.ey, min);
    }
    for (let k = g.length - 1; k >= 0; k--) {
      const max = k === g.length - 1 ? H - 18 : g[k + 1]!.ly - 31;
      g[k]!.ly = Math.min(g[k]!.ly, max);
    }
  }

  const arco = (a0: number, a1: number) => {
    const folga = fatias.length > 1 ? 0.014 : 0;
    const s = a0 + folga, e = a1 - folga;
    const [x0, y0] = pt(s, r), [x1, y1] = pt(e, r);
    return `M${x0},${y0} A${r},${r} 0 ${e - s > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
  };

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full" style={{ maxWidth: "26rem" }} role="img" aria-label="Distribuição">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={sw} />
        {fatias.map((f) => {
          const ativo = (!selecionado || selecionado === f.chave) && (!hover || hover === f.chave);
          const destaque = hover === f.chave;
          const d = f.frac > 0.9999 ? undefined : arco(f.a0, f.a1);
          const comum = {
            fill: "none" as const, stroke: f.cor, strokeWidth: destaque ? sw + 8 : sw, opacity: ativo ? 1 : 0.28,
            style: { cursor: onSelecionar ? "pointer" : "default", transition: "stroke-width .15s, opacity .2s" },
            onClick: () => onSelecionar?.(f.chave),
            ...tip.props({
              titulo: f.rotulo, cor: f.cor,
              linhas: [{ rot: rotValor, val: String(f.valor) }, { rot: "% do total", val: pct(f.valor, total) }],
            }),
          };
          const entrar = (e: MouseEvent) => { setHover(f.chave); comum.onMouseEnter(e); };
          const sair = () => { setHover(undefined); comum.onMouseLeave(); };
          return d
            ? <path key={f.chave} d={d} {...comum} onMouseEnter={entrar} onMouseLeave={sair} />
            : <circle key={f.chave} cx={cx} cy={cy} r={r} {...comum} onMouseEnter={entrar} onMouseLeave={sair} />;
        })}

        {/* total no centro */}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--fg)" style={{ fontVariantNumeric: "tabular-nums" }}>{total}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--fg-muted)">total</text>

        {/* rótulos externos com linha-guia */}
        {rotulos.map(({ f, dir, px, py, ex, ly }) => {
          const lx = ex + dir * 16;
          const ativo = (!selecionado || selecionado === f.chave) && (!hover || hover === f.chave);
          return (
            <g key={f.chave} opacity={ativo ? 1 : 0.35} style={{ transition: "opacity .2s", pointerEvents: "none" }}>
              <polyline points={`${px},${py} ${ex},${ly} ${lx - dir * 3},${ly}`} fill="none" stroke={f.cor} strokeWidth="1.4" />
              <text x={lx} y={ly - 2} textAnchor={dir > 0 ? "start" : "end"} fontSize="12" fontWeight="700" fill="var(--fg)">{f.rotulo}</text>
              <text x={lx} y={ly + 11} textAnchor={dir > 0 ? "start" : "end"} fontSize="10.5" fontWeight="600" fill="var(--fg-muted)">{f.valor} · {fmt(f.frac * 100, 0)}%</text>
            </g>
          );
        })}
      </svg>

      {/* legenda na parte inferior */}
      <ul className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
        {fatias.map((f) => (
          <li key={f.chave}>
            <button type="button" onClick={() => onSelecionar?.(f.chave)} onMouseEnter={() => setHover(f.chave)} onMouseLeave={() => setHover(undefined)}
              className="inline-flex items-center gap-1.5 bg-transparent"
              style={{ border: 0, cursor: onSelecionar ? "pointer" : "default", font: "inherit", color: "inherit", opacity: !selecionado || selecionado === f.chave ? 1 : 0.4 }}>
              <i className="inline-block rounded-full" style={{ width: 9, height: 9, background: f.cor }} />
              <span className="font-semibold">{f.rotulo}</span>
            </button>
          </li>
        ))}
      </ul>
      {tip.node}
    </div>
  );
}

/** Linha suave (ex.: horas por mês), com pontos que mostram os detalhes. */
export function Linha({ itens, selecionado, onSelecionar, rotValor = "Total" }: {
  itens: { chave: string; rotulo: string; valor: number }[]; rotValor?: string;
} & Sel) {
  const tip = useTip();
  if (!itens.length) return <Vazio />;
  const W = 320, H = 170, px = 24, py = 24;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  const soma = itens.reduce((s, i) => s + i.valor, 0);
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
    <div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Evolução por mês">
        <path d={`${d} L${pts[pts.length - 1]![0]},${H - py} L${pts[0]![0]},${H - py} Z`} fill="var(--p)" opacity=".1" />
        <path d={d} fill="none" stroke="var(--p)" strokeWidth="3" strokeLinecap="round" />
        {itens.map((it, i) => (
          <g key={it.chave} style={{ cursor: onSelecionar ? "pointer" : "default", opacity: !selecionado || selecionado === it.chave ? 1 : 0.35 }}
            onClick={() => onSelecionar?.(it.chave)}
            {...tip.props({
              titulo: it.rotulo, cor: "var(--p)",
              linhas: [{ rot: rotValor, val: fmt(it.valor, 0) }, { rot: "% do período", val: pct(it.valor, soma) }],
            })}>
            <circle cx={pts[i]![0]} cy={pts[i]![1]} r="16" fill="transparent" />
            <circle cx={pts[i]![0]} cy={pts[i]![1]} r="5" fill="var(--surface)" stroke="var(--p)" strokeWidth="2.5" />
            <text x={pts[i]![0]} y={pts[i]![1] - 11} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--fg)">{fmt(it.valor, 0)}</text>
            <text x={pts[i]![0]} y={H + 8} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--fg-muted)">{it.rotulo}</text>
          </g>
        ))}
      </svg>
      {tip.node}
    </div>
  );
}

/** Lista com contagem (participação por colaborador, aptos, inaptos, reteste). */
export function ListaContagem({ itens, cor = "var(--p)", altura = "18rem", rotValor = "Quantidade", selecionado, onSelecionar }: {
  itens: { chave: string; rotulo: string; valor: number }[]; cor?: string; altura?: string; rotValor?: string;
} & Sel) {
  const tip = useTip();
  if (!itens.length) return <Vazio />;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <>
      <ul className="space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: altura, scrollbarWidth: "thin" }}>
        {itens.map((i) => (
          <li key={i.chave} {...linhaClicavel(i.chave, selecionado, onSelecionar)}
            className="grid items-center gap-2 rounded-md px-1 py-0.5 text-xs transition-colors hover:bg-[var(--surface-2)]"
            style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) 1.5rem", ...estiloLinha(i.chave, selecionado, onSelecionar) }}
            {...tip.props({ titulo: i.rotulo, cor, linhas: [{ rot: rotValor, val: String(i.valor) }, ...(onSelecionar ? [{ rot: "Clique", val: selecionado === i.chave ? "remove o filtro" : "filtra o painel" }] : [])] })}>
            <span className="truncate text-right font-semibold">{i.rotulo}</span>
            <span className="bar !h-2.5"><span style={{ width: `${(i.valor / max) * 100}%`, background: cor }} /></span>
            <span className="font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{i.valor}</span>
          </li>
        ))}
      </ul>
      {tip.node}
    </>
  );
}

/** Ranking horizontal rolável (média por colaborador). Abaixo do mínimo = vermelho. */
export function Ranking({ itens, minimo, max, selecionado, onSelecionar }: { itens: { chave: string; rotulo: string; valor: number }[]; minimo: number; max: number } & Sel) {
  const tip = useTip();
  if (!itens.length) return <Vazio />;
  return (
    <>
      <ul className="max-h-[22rem] space-y-1.5 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
        {itens.map((i) => {
          const abaixo = i.valor < minimo;
          return (
            <li key={i.chave} {...linhaClicavel(i.chave, selecionado, onSelecionar)}
              className="grid items-center gap-2 rounded-md px-1 py-0.5 text-xs transition-colors hover:bg-[var(--surface-2)]"
              style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) 2rem", ...estiloLinha(i.chave, selecionado, onSelecionar) }}
              {...tip.props({
                titulo: i.rotulo, cor: abaixo ? "var(--d)" : "var(--i)",
                linhas: [{ rot: "Média", val: fmt(i.valor) }, { rot: "Situação", val: abaixo ? `Abaixo do mínimo (${minimo})` : "Dentro da meta" }],
              })}>
              <span className="truncate text-right font-semibold">{i.rotulo}</span>
              <span className="bar !h-2.5"><span style={{ width: `${(i.valor / max) * 100}%`, background: abaixo ? "var(--d)" : "var(--i)" }} /></span>
              <span className="font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(i.valor)}</span>
            </li>
          );
        })}
      </ul>
      {tip.node}
    </>
  );
}
