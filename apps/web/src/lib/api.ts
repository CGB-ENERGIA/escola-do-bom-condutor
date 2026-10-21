import type {
  DashboardTeoricaRes, Evidencia, AvaliacaoPraticaDetalhada, AvaliacaoPratica, CriarAvaliacaoPraticaReq, LoginInstrutorRes, Colaborador, FinalizarTentativaRes, IniciarTentativaReq, IniciarTentativaRes, Respostas,
} from "@ebc/shared";

async function json<T>(r: Response): Promise<T> {
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((body as { erro?: string }).erro ?? "Erro inesperado. Tente novamente.");
  return body as T;
}

export const api = {
  buscarColaboradores: (q: string, signal?: AbortSignal) =>
    fetch(`/api/colaboradores?q=${encodeURIComponent(q)}`, { signal }).then(json<Colaborador[]>),

  iniciar: (req: IniciarTentativaReq) =>
    fetch("/api/tentativas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }).then(json<IniciarTentativaRes>).then((r) => ({
      // converte o limite para o relógio deste aparelho (evita erro se o relógio estiver adiantado/atrasado)
      ...r, expiraEm: new Date(Date.now() + (Date.parse(r.expiraEm) - Date.parse(r.agora))).toISOString(),
    })),

  finalizar: (tentativaId: string, respostas: Respostas) =>
    fetch(`/api/tentativas/${tentativaId}/finalizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ respostas }),
    }).then(json<FinalizarTentativaRes>),
};

/* ---------- área do instrutor ---------- */
const TOKEN = "ebc:instrutor";
export const instrutorSessao = {
  get(): { token: string; nome: string } | null {
    try { const r = sessionStorage.getItem(TOKEN); return r ? JSON.parse(r) : null; } catch { return null; }
  },
  set(v: LoginInstrutorRes) { try { sessionStorage.setItem(TOKEN, JSON.stringify(v)); } catch { /* ignora */ } },
  limpar() { try { sessionStorage.removeItem(TOKEN); } catch { /* ignora */ } },
};

function auth(): HeadersInit {
  const s = instrutorSessao.get();
  return { "Content-Type": "application/json", ...(s ? { Authorization: `Bearer ${s.token}` } : {}) };
}

export const apiInstrutor = {
  login: (usuario: string, senha: string) =>
    fetch("/api/pratica/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, senha }),
    }).then(json<LoginInstrutorRes>),

  criarAvaliacao: (req: CriarAvaliacaoPraticaReq) =>
    fetch("/api/pratica", { method: "POST", headers: auth(), body: JSON.stringify(req) }).then(json<AvaliacaoPratica>),

  /** Hora oficial da rede (servidor), com compensação da latência. Não usa o relógio do aparelho. */
  async horaDaRede(): Promise<Date> {
    const t0 = performance.now();
    const r = await fetch("/api/tempo", { cache: "no-store" }).then(json<{ agora: string }>);
    const rtt = performance.now() - t0;
    return new Date(Date.parse(r.agora) + rtt / 2);
  },

  enviarEvidencia: (foto: Blob, meta: { lat?: number; lon?: number; precisao?: number; capturadaEm: Date }) => {
    const p = new URLSearchParams({ capturadaEm: meta.capturadaEm.toISOString() });
    if (meta.lat !== undefined) p.set("lat", String(meta.lat));
    if (meta.lon !== undefined) p.set("lon", String(meta.lon));
    if (meta.precisao !== undefined) p.set("precisao", String(Math.round(meta.precisao)));
    return fetch(`/api/evidencias?${p}`, { method: "POST", headers: { ...auth(), "Content-Type": "image/jpeg" }, body: foto }).then(json<Evidencia>);
  },

  dashboardTeorica: (demo = false) =>
    fetch(`/api/dashboard/teorica${demo ? "?demo=1" : ""}`, { headers: auth() }).then(json<DashboardTeoricaRes>),

  listar: (params: { programa?: string } = {}) =>
    fetch(`/api/pratica?${new URLSearchParams(params as Record<string, string>)}`, { headers: auth() })
      .then(json<AvaliacaoPraticaDetalhada[]>),
};
