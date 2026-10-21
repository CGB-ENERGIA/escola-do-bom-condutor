import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Fundo from "../components/Fundo";
import { Escudo } from "../components/Icones";
import { api, sessao } from "../lib/api";

/** Acesso ao painel (mesma senha da área do instrutor, enquanto não há autenticação real). */
export default function Login() {
  const nav = useNavigate();
  const [usuario, setUsuario] = useState("Inaldo Costa");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string>();
  const [carregando, setCarregando] = useState(false);

  if (sessao.get()) return <Navigate to="/" replace />;

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(undefined); setCarregando(true);
    try { sessao.set(await api.login(usuario, senha)); nav("/", { replace: true }); }
    catch (err) { setErro((err as Error).message); }
    finally { setCarregando(false); }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Fundo />
      <section className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-5 grid place-items-center rounded-[1.4rem]" style={{ width: 72, height: 72, background: "var(--p)", color: "var(--p-fg)" }}>
            <Escudo width={36} height={36} />
          </div>
          <h1 className="au text-3xl font-extrabold tracking-tight">Painel de relatórios</h1>
          <p className="au d1 muted mt-2 text-sm">Escola do Bom Condutor · acesso restrito.</p>
        </div>
        <form onSubmit={entrar} className="glass au d2 space-y-4 p-6">
          <label className="block text-sm font-medium">Nome
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} className="inp mt-1.5" autoComplete="username" />
          </label>
          <label className="block text-sm font-medium">Senha
            <div className="relative mt-1.5">
              <input type={ver ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus
                className="inp" style={{ paddingRight: "5.5rem" }} autoComplete="current-password" />
              <button type="button" onClick={() => setVer((v) => !v)} aria-pressed={ver}
                className="link absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold">{ver ? "Ocultar" : "Mostrar"}</button>
            </div>
          </label>
          {erro && <p className="alert af" role="alert">{erro}</p>}
          <button disabled={!senha || carregando} className="btn btn-p btn-block">
            {carregando ? <><span className="spinner" /> Entrando…</> : "Entrar"}
          </button>
        </form>
      </section>
    </div>
  );
}
