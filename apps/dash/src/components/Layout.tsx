import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Escudo, Grafico, Lista, Lua, Sair, Sol, Volante } from "./Icones";
import { sessao } from "../lib/api";
import { useTema } from "../lib/theme";

const MENU = [
  { to: "/", rot: "Dash", Icone: Grafico, fim: true },
  { to: "/teorica", rot: "Avaliação Teórica", Icone: Lista },
  { to: "/pratica", rot: "Avaliação Prática", Icone: Volante },
];

/** Estrutura do painel: menu lateral (Dash, Teórica, Prática) + conteúdo. No celular o menu vira abas no topo. */
export default function Layout() {
  const nav = useNavigate();
  const { search } = useLocation();
  const { tema, alternar } = useTema();
  const s = sessao.get();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_1fr]">
      <aside className="topbar lg:!sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r" style={{ borderRight: undefined }}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:flex-col lg:items-stretch lg:gap-6 lg:px-4 lg:py-5 lg:h-full">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center rounded-xl" style={{ width: 38, height: 38, background: "var(--p)", color: "var(--p-fg)" }}>
              <Escudo width={20} height={20} />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-extrabold">Escola do Bom Condutor</p>
              <p className="faint text-[0.7rem] font-semibold">Painel de relatórios</p>
            </div>
          </div>

          <nav className="hidden flex-col gap-1 lg:flex" aria-label="Menu">
            {MENU.map(({ to, rot, Icone, fim }) => (
              <NavLink key={to} to={{ pathname: to, search }} end={fim} className="navitem">
                <Icone width={18} height={18} /> {rot}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 lg:mt-auto lg:flex-col lg:items-stretch">
            {s && <p className="muted hidden text-xs lg:block">Conectado como <strong style={{ color: "var(--fg)" }}>{s.nome}</strong></p>}
            <div className="flex gap-2">
              <button className="icon-btn" onClick={alternar} aria-label="Alternar tema" title="Alternar tema">
                {tema === "dark" ? <Sol width={18} height={18} /> : <Lua width={18} height={18} />}
              </button>
              <button className="btn btn-g !px-3 !py-2 !text-sm lg:flex-1" onClick={() => { sessao.limpar(); nav("/login"); }}>
                <Sair width={16} height={16} /> <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
        {/* Abas no celular */}
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label="Menu">
          {MENU.map(({ to, rot, Icone, fim }) => (
            <NavLink key={to} to={{ pathname: to, search }} end={fim} className="navitem !whitespace-nowrap">
              <Icone width={16} height={16} /> {rot}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8"><Outlet /></main>
    </div>
  );
}

/** Título da página + selo "ao vivo" com a hora da última atualização automática. */
export function CabecalhoPagina({ titulo, destaque, sub, atualizadoEm, demo, children }: {
  titulo: string; destaque: string; sub: string; atualizadoEm?: Date; demo: boolean; children?: ReactNode;
}) {
  const [, setParams] = useSearchParams();
  const [, forcar] = useState(0);
  useEffect(() => { const t = setInterval(() => forcar((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const hora = atualizadoEm?.toLocaleTimeString("pt-BR");
  return (
    <div className="au flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{titulo} <span style={{ color: "var(--p)" }}>{destaque}</span></h1>
        <p className="muted mt-1 text-sm">{sub}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {children}
        <label className="muted flex cursor-pointer items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={demo} onChange={(e) => setParams(e.target.checked ? { demo: "1" } : {}, { replace: true })} /> Dados de demonstração
        </label>
        <span className="chip chip-ok" title="Os relatórios se atualizam sozinhos quando uma avaliação é finalizada.">
          <span className="live" /> Ao vivo · {hora ?? "…"}
        </span>
      </div>
    </div>
  );
}
