import { useEffect, useState } from "react";
import type { Colaborador } from "@ebc/shared";
import { api } from "../lib/api";
import { Busca, Check } from "./Icones";

type Props = { valor?: Colaborador; onChange: (c?: Colaborador) => void };

const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

/** Campo de busca por nome/matrícula com lista de sugestões. Reutilizado pelo colaborador e pelo instrutor. */
export default function BuscaColaborador({ valor, onChange }: Props) {
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Colaborador[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (valor || busca.trim().length < 2) { setLista([]); setBuscando(false); return; }
    const ctl = new AbortController();
    setBuscando(true);
    const t = setTimeout(() => {
      api.buscarColaboradores(busca, ctl.signal)
        .then((r) => { setLista(r); setBuscando(false); })
        .catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [busca, valor]);

  if (valor)
    return (
      <div className="ap flex items-center gap-3 rounded-[var(--r)] p-3"
        style={{ border: "1.5px solid var(--p)", background: "var(--p-tint)" }}>
        <span className="grid shrink-0 place-items-center rounded-full text-sm font-bold"
          style={{ width: 42, height: 42, background: "var(--p)", color: "var(--p-fg)" }}>
          {iniciais(valor.nome)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{valor.nome}</p>
          <p className="muted truncate text-xs">
            {[valor.matricula && `Matrícula ${valor.matricula}`, valor.base, valor.gerencia].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button type="button" className="link text-sm" onClick={() => { onChange(undefined); setBusca(""); }}>
          Trocar
        </button>
      </div>
    );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Busca className="faint pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          autoComplete="off" value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Digite o nome ou a matrícula"
          className="inp" style={{ paddingLeft: "2.8rem" }} aria-label="Buscar colaborador"
        />
        {buscando && <span className="spinner faint absolute right-3.5 top-1/2 -translate-y-1/2" />}
      </div>

      {lista.length > 0 && (
        <ul className="card af max-h-72 divide-y overflow-auto" style={{ borderRadius: "var(--r)", borderColor: "var(--border)" }}>
          {lista.map((c) => (
            <li key={c.id} style={{ borderColor: "var(--border)" }}>
              <button type="button" onClick={() => onChange(c)}
                className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-[var(--surface-2)]"
                style={{ background: "transparent", color: "inherit", border: 0, font: "inherit", cursor: "pointer" }}>
                <span className="grid shrink-0 place-items-center rounded-full text-xs font-bold"
                  style={{ width: 36, height: 36, background: "var(--surface-3)", color: "var(--fg-muted)" }}>
                  {iniciais(c.nome)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.nome}</span>
                  <span className="faint block truncate text-xs">{[c.matricula, c.base, c.gerencia].filter(Boolean).join(" · ")}</span>
                </span>
                <Check className="faint" width={16} height={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!buscando && busca.trim().length >= 2 && lista.length === 0 && (
        <p className="muted af text-sm">Nenhum colaborador encontrado.</p>
      )}
    </div>
  );
}
