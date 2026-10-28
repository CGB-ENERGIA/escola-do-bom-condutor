import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Banco, Detalhe, Engrenagem, Grafico, Lista, Lua, Relatorio, Sair, Sol, Volante } from "./Icones";
import { sessao } from "../lib/api";
import { useTema } from "../lib/theme";

const MENU = [
  { to: "/", rot: "Dash", Icone: Grafico, fim: true },
  { to: "/teorica", rot: "Avaliação Teórica", Icone: Lista },
  { to: "/pratica", rot: "Avaliação Prática", Icone: Volante },
  { to: "/detalhamento", rot: "Detalhamento", Icone: Detalhe },
  { to: "/banco-de-dados", rot: "Banco de dados", Icone: Banco },
  { to: "/configuracao", rot: "Configuração", Icone: Engrenagem },
];

const DESENVOLVEDOR = "Marcus Vinicius Silva Queiros";
const CHAVE_MENU = "ebc:menu-recolhido";
const lerRecolhido = () => { try { return localStorage.getItem(CHAVE_MENU) === "1"; } catch { return false; } };

const IconeMenu = ({ recolhido }: { recolhido: boolean }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M9 4v16" />
    <path d={recolhido ? "m13.5 9.5 2.5 2.5-2.5 2.5" : "m16 9.5-2.5 2.5 2.5 2.5"} />
  </svg>
);

/** Estrutura do painel: menu lateral recolhível (Dash, Teórica, Prática) + conteúdo. No celular o menu vira abas no topo. */
export default function Layout() {
  const nav = useNavigate();
  const { search } = useLocation();
  const { tema, alternar } = useTema();
  const s = sessao.get();
  const [recolhido, setRecolhido] = useState(lerRecolhido);

  const alternarMenu = () => setRecolhido((v) => {
    try { localStorage.setItem(CHAVE_MENU, v ? "0" : "1"); } catch { /* ignora */ }
    return !v;
  });
  // só some o texto no desktop; no celular o menu é sempre completo
  const oculto = recolhido ? "lg:hidden" : "";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[var(--menu-w)_1fr] lg:transition-[grid-template-columns] lg:duration-300"
      style={{ "--menu-w": recolhido ? "4.75rem" : "15.5rem" } as CSSProperties}>
      <aside className="topbar lg:!sticky lg:top-0 lg:h-dvh lg:overflow-hidden lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:h-full lg:flex-col lg:items-stretch lg:gap-6 lg:px-3 lg:py-5">
          <div className={`flex items-center gap-2.5 ${recolhido ? "lg:flex-col lg:gap-3" : ""}`}>
            <span className="grid shrink-0 place-items-center rounded-xl" style={{ width: 38, height: 38, background: "var(--p)", color: "var(--p-fg)" }}>
              <Relatorio width={22} height={22} />
            </span>
            <div className={`min-w-0 flex-1 leading-tight ${oculto}`}>
              <p className="text-sm font-extrabold">Escola do Bom Condutor</p>
              <p className="faint text-[0.7rem] font-semibold">Relatórios</p>
            </div>
            <button type="button" onClick={alternarMenu} className="icon-btn hidden shrink-0 lg:inline-flex"
              aria-label={recolhido ? "Expandir menu" : "Recolher menu"} title={recolhido ? "Expandir menu" : "Recolher menu"} aria-expanded={!recolhido}>
              <IconeMenu recolhido={recolhido} />
            </button>
          </div>

          <nav className="hidden flex-col gap-1 lg:flex" aria-label="Menu">
            {MENU.map(({ to, rot, Icone, fim }) => (
              <NavLink key={to} to={{ pathname: to, search }} end={fim} title={rot} aria-label={rot}
                className={`navitem ${recolhido ? "lg:justify-center lg:!px-0" : ""}`}>
                <Icone width={18} height={18} /> <span className={oculto}>{rot}</span>
              </NavLink>
            ))}
          </nav>

          <div className={`flex items-center gap-2 lg:mt-auto lg:flex-col lg:items-stretch`}>
            {s && <p className={`muted hidden text-xs lg:block ${oculto}`}>Conectado como <strong style={{ color: "var(--fg)" }}>{s.nome}</strong></p>}
            <div className={`flex gap-2 ${recolhido ? "lg:flex-col lg:items-center" : ""}`}>
              <button className="icon-btn" onClick={alternar} aria-label="Alternar tema" title="Alternar tema">
                {tema === "dark" ? <Sol width={18} height={18} /> : <Lua width={18} height={18} />}
              </button>
              <button className={`btn btn-g !px-3 !py-2 !text-sm ${recolhido ? "lg:!h-10 lg:!w-10 lg:!p-0" : "lg:flex-1"}`}
                onClick={() => { sessao.limpar(); nav("/login"); }} title="Sair" aria-label="Sair">
                <Sair width={16} height={16} /> <span className={oculto}>Sair</span>
              </button>
            </div>
          </div>

          {/* Crédito do desenvolvedor (rodapé do menu, só no desktop) */}
          <div className="hidden border-t pt-3 lg:block" style={{ borderColor: "var(--border)" }}
            title={`Desenvolvedor: ${DESENVOLVEDOR}`}>
            {recolhido ? (
              <p className="text-center text-[0.7rem] font-extrabold tracking-wider" style={{ color: "var(--p)" }}>MQ</p>
            ) : (
              <>
                <p className="faint text-[0.62rem] font-bold uppercase tracking-wider">Desenvolvedor</p>
                <p className="text-xs font-semibold leading-snug">{DESENVOLVEDOR}</p>
              </>
            )}
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

      <main className="min-w-0 px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
        <Outlet />
        {/* No celular o menu vira abas; o crédito vai para o fim da página */}
        <p className="faint mt-8 text-center text-[0.7rem] lg:hidden">Desenvolvedor: <strong>{DESENVOLVEDOR}</strong></p>
      </main>
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
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{titulo} <span style={{ color: "var(--p)" }}>{destaque}</span></h1>
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
