import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import FundoRelatorios from "../components/FundoRelatorios";
import LogoNeon from "../components/LogoNeon";
import { api, sessao } from "../lib/api";

/** Acesso aos Relatórios (administrador). A tela de entrada é sempre escura, para o neon da logo brilhar. */
export default function Login() {
  const nav = useNavigate();
  const [usuario, setUsuario] = useState("");
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
    <div className="dark grid min-h-dvh place-items-center px-4 py-8" style={{ position: "relative", isolation: "isolate", background: "var(--bg)", color: "var(--fg)" }}>
      <FundoRelatorios />
      <section className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="au mx-auto mb-3" style={{ width: "min(26rem, 88vw)", marginLeft: "50%", translate: "-50% 0" }}>
            <LogoNeon />
          </div>
          <h1 className="au d1 text-3xl font-extrabold tracking-tight">Relatórios</h1>
          <p className="au d2 muted mt-2 text-sm">Escola do Bom Condutor · acesso restrito.</p>
        </div>
        <form onSubmit={entrar} className="glass au d3 space-y-4 p-6">
          <label className="block text-sm font-medium">Nome
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} className="inp mt-1.5" autoComplete="username" autoFocus placeholder="Seu nome de administrador" />
          </label>
          <label className="block text-sm font-medium">Senha
            <div className="relative mt-1.5">
              <input type={ver ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)}
                className="inp" style={{ paddingRight: "5.5rem" }} autoComplete="current-password" />
              <button type="button" onClick={() => setVer((v) => !v)} aria-pressed={ver}
                className="link absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold">{ver ? "Ocultar" : "Mostrar"}</button>
            </div>
          </label>
          {erro && <p className="alert af" role="alert">{erro}</p>}
          <button disabled={!usuario.trim() || !senha || carregando} className="btn btn-p btn-block">
            {carregando ? <><span className="spinner" /> Entrando…</> : "Entrar"}
          </button>
        </form>
      </section>
    </div>
  );
}
