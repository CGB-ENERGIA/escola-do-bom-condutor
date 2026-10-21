import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Fundo from "../components/Fundo";
import { Escudo, SetaEsq } from "../components/Icones";
import { apiInstrutor, instrutorSessao } from "../lib/api";

/** Login do instrutor (senha configurável em INSTRUTOR_SENHA na API). Ao entrar, abre a avaliação prática. */
export default function InstrutorLogin() {
  const nav = useNavigate();
  const [usuario, setUsuario] = useState("Inaldo Costa");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string>();
  const [carregando, setCarregando] = useState(false);

  if (instrutorSessao.get()) return <Navigate to="/instrutor/avaliacao" replace />;

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(undefined);
    setCarregando(true);
    try {
      instrutorSessao.set(await apiInstrutor.login(usuario, senha));
      nav("/instrutor/avaliacao", { replace: true });
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <Fundo />
      <section className="mx-auto max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-5 grid place-items-center rounded-[1.4rem]"
            style={{ width: 72, height: 72, background: "var(--p)", color: "var(--p-fg)", animation: "popIn .7s cubic-bezier(.22,1,.36,1) both, ring 2.6s 1s ease-out infinite" }}>
            <Escudo width={36} height={36} />
          </div>
          <h1 className="au d1 text-3xl font-extrabold tracking-tight">Área do instrutor</h1>
          <p className="au d2 muted mt-2 text-sm">Entre para registrar avaliações práticas.</p>
        </div>

        <form onSubmit={entrar} className="glass au d3 space-y-4 p-6">
          <label className="block text-sm font-medium">Nome do instrutor
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} className="inp mt-1.5" autoComplete="username" />
          </label>
          <label className="block text-sm font-medium">Senha
            <div className="relative mt-1.5">
              <input type={verSenha ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus
                className="inp" style={{ paddingRight: "5.5rem" }} autoComplete="current-password" />
              <button type="button" onClick={() => setVerSenha((v) => !v)}
                aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"} aria-pressed={verSenha}
                className="link absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold">
                {verSenha ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>
          {erro && <p className="alert af" role="alert">{erro}</p>}
          <button disabled={!senha || carregando} className="btn btn-p btn-block">
            {carregando ? <><span className="spinner" /> Entrando…</> : "Entrar"}
          </button>
        </form>

        <p className="au d5 mt-6 text-center text-sm">
          <Link to="/" className="link inline-flex items-center gap-1.5"><SetaEsq width={16} height={16} /> Voltar à prova</Link>
        </p>
      </section>
    </>
  );
}
