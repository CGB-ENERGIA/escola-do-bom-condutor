import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardPraticaRes, DashboardTeoricaRes, LoginInstrutorRes } from "@ebc/shared";

async function json<T>(r: Response): Promise<T> {
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((body as { erro?: string }).erro ?? "Erro inesperado. Tente novamente.");
  return body as T;
}

const TOKEN = "ebc:dash";
export const sessao = {
  get(): { token: string; nome: string } | null {
    try { const r = sessionStorage.getItem(TOKEN); return r ? JSON.parse(r) : null; } catch { return null; }
  },
  set(v: LoginInstrutorRes) { try { sessionStorage.setItem(TOKEN, JSON.stringify(v)); } catch { /* ignora */ } },
  limpar() { try { sessionStorage.removeItem(TOKEN); } catch { /* ignora */ } },
};

const auth = (): HeadersInit => {
  const s = sessao.get();
  return s ? { Authorization: `Bearer ${s.token}` } : {};
};

export const api = {
  login: (usuario: string, senha: string) =>
    fetch("/api/pratica/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario, senha }),
    }).then(json<LoginInstrutorRes>),
  teorica: (demo: boolean) =>
    fetch(`/api/dashboard/teorica${demo ? "?demo=1" : ""}`, { headers: auth(), cache: "no-store" }).then(json<DashboardTeoricaRes>),
  pratica: (demo: boolean) =>
    fetch(`/api/dashboard/pratica${demo ? "?demo=1" : ""}`, { headers: auth(), cache: "no-store" }).then(json<DashboardPraticaRes>),
};

/** Intervalo de atualização automática dos relatórios (ms). */
export const INTERVALO_MS = 5000;

/**
 * Busca os dados e os atualiza sozinho: a cada poucos segundos e quando a aba volta ao foco.
 * Só troca o estado quando algo mudou, para os gráficos não "piscarem".
 */
export function useAtualizacao<T>(buscar: () => Promise<T>, chave: string) {
  const [dados, setDados] = useState<T>();
  const [erro, setErro] = useState<string>();
  const [atualizadoEm, setAtualizadoEm] = useState<Date>();
  const ultimo = useRef("");
  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;

  const carregar = useCallback(async () => {
    try {
      const novo = await buscarRef.current();
      const txt = JSON.stringify(novo);
      if (txt !== ultimo.current) { ultimo.current = txt; setDados(novo); }
      setErro(undefined);
      setAtualizadoEm(new Date());
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("Sessão")) { sessao.limpar(); window.location.assign("/login"); return; }
      setErro(msg);
    }
  }, []);

  useEffect(() => {
    ultimo.current = ""; setDados(undefined); setErro(undefined);
    void carregar();
    const t = window.setInterval(() => { if (!document.hidden) void carregar(); }, INTERVALO_MS);
    const vis = () => { if (!document.hidden) void carregar(); };
    document.addEventListener("visibilitychange", vis);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [chave, carregar]);

  return { dados, erro, atualizadoEm };
}
