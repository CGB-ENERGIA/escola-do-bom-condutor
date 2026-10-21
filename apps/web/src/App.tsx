import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Prova from "./pages/Prova";
import Resultado from "./pages/Resultado";
import InstrutorLogin from "./pages/InstrutorLogin";
import InstrutorAvaliacao from "./pages/InstrutorAvaliacao";
import InstrutorResultados from "./pages/InstrutorResultados";
import InstrutorDashboard from "./pages/InstrutorDashboard";
import { Lua, Sol, Volante } from "./components/Icones";
import { TemaProvider, useTema } from "./lib/theme";

function BotaoTema() {
  const { tema, alternar } = useTema();
  const escuro = tema === "dark";
  return (
    <button
      type="button" onClick={alternar} className="icon-btn"
      aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
    >
      {escuro ? <Sol /> : <Lua />}
    </button>
  );
}

function Layout() {
  const { pathname } = useLocation();
  // key por rota: reinicia a animação de entrada a cada página
  return (
    <div className="min-h-dvh">
      <header className="topbar">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2.5" style={{ color: "var(--fg)", textDecoration: "none" }}>
            <span className="grid place-items-center rounded-xl" style={{ width: 34, height: 34, background: "var(--p)", color: "var(--p-fg)" }}>
              <Volante width={20} height={20} />
            </span>
            <span className="text-[0.95rem] font-bold tracking-tight">Escola do Bom Condutor</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="chip chip-warn hidden sm:inline-flex">MODO TESTE</span>
            <BotaoTema />
          </div>
        </div>
      </header>

      <main key={pathname} className={`mx-auto px-4 pb-16 pt-6 sm:pt-10 ${pathname.startsWith("/instrutor/dashboard") ? "max-w-7xl" : "max-w-3xl"}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/prova" element={<Prova />} />
          <Route path="/resultado" element={<Resultado />} />
          <Route path="/instrutor" element={<InstrutorLogin />} />
          <Route path="/instrutor/avaliacao" element={<InstrutorAvaliacao />} />
          <Route path="/instrutor/resultados" element={<InstrutorResultados />} />
          <Route path="/instrutor/dashboard" element={<InstrutorDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <TemaProvider>
      <Layout />
    </TemaProvider>
  );
}
