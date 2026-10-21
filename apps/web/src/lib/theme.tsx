import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Tema = "light" | "dark";
type Ctx = { tema: Tema; alternar: () => void };

const CHAVE = "ebc:theme";
const TemaCtx = createContext<Ctx>({ tema: "light", alternar: () => {} });

function inicial(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo === "dark" || salvo === "light") return salvo;
  } catch { /* ignora */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Tema claro/escuro: respeita o sistema na 1ª visita e lembra a escolha do usuário. */
export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(inicial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", tema === "dark" ? "#070d0b" : "#0a8f64");
  }, [tema]);

  const alternar = useCallback(() => {
    const el = document.documentElement;
    el.classList.add("theme-switching");
    setTema((t) => {
      const novo = t === "dark" ? "light" : "dark";
      try { localStorage.setItem(CHAVE, novo); } catch { /* ignora */ }
      return novo;
    });
    window.setTimeout(() => el.classList.remove("theme-switching"), 450);
  }, []);

  const value = useMemo(() => ({ tema, alternar }), [tema, alternar]);
  return <TemaCtx.Provider value={value}>{children}</TemaCtx.Provider>;
}

export const useTema = () => useContext(TemaCtx);
