import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CATEGORIAS, REGRAS, type Categoria, type Colaborador } from "@ebc/shared";
import BuscaColaborador from "../components/BuscaColaborador";
import Fundo from "../components/Fundo";
import { Caminhao, Carro, Moto, Seta, Volante } from "../components/Icones";
import { api } from "../lib/api";
import { useSessao } from "../lib/sessao";

const ICONE: Record<Categoria, typeof Carro> = { carro: Carro, caminhao: Caminhao, moto: Moto };

/** Identificação: o colaborador busca o próprio nome, escolhe a categoria e inicia a prova. */
export default function Home() {
  const nav = useNavigate();
  const { iniciar, sair } = useSessao();
  const [colab, setColab] = useState<Colaborador>();
  const [categoria, setCategoria] = useState<Categoria>();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string>();

  useEffect(() => { sair(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function comecar() {
    if (!colab || !categoria) return;
    setErro(undefined);
    setCarregando(true);
    try {
      iniciar(await api.iniciar({ colaboradorId: colab.id, categoria }));
      nav("/prova");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <Fundo />
      <section className="mx-auto max-w-xl">
        {/* Hero */}
        <div className="mb-7 text-center">
          <div className="au mx-auto mb-5 grid place-items-center rounded-[1.4rem]"
            style={{ width: 72, height: 72, background: "var(--p)", color: "var(--p-fg)", animation: "popIn .7s cubic-bezier(.22,1,.36,1) both, ring 2.6s 1s ease-out infinite" }}>
            <Volante width={38} height={38} style={{ animation: "wheel 14s linear infinite" }} />
          </div>
          <h1 className="au d1 text-[1.9rem] font-extrabold leading-tight tracking-tight sm:text-4xl">
            Avaliação <span style={{ color: "var(--p)" }}>teórica</span>
          </h1>
          <p className="au d2 muted mx-auto mt-2 max-w-sm text-sm sm:text-base">
            {REGRAS.teorica.totalQuestoes} questões · {REGRAS.teorica.duracaoMinutos} min · aprovação com {REGRAS.teorica.acertosMinimos} ou mais acertos
          </p>

          {/* Estrada animada */}
          <svg className="au d3 mx-auto mt-5 block w-full max-w-xs" viewBox="0 0 300 20" aria-hidden="true" height="20">
            <line x1="0" y1="10" x2="300" y2="10" stroke="var(--border-2)" strokeWidth="2" strokeDasharray="14 12"
              style={{ animation: "road 1.2s linear infinite" }} />
          </svg>
        </div>

        <div className="glass au d3 space-y-6 p-5 sm:p-7">
          {/* 1. Identificação */}
          <div className="space-y-3">
            <p className="flex items-center gap-2.5 text-sm font-semibold">
              <span className="grid place-items-center rounded-full text-xs font-bold"
                style={{ width: 24, height: 24, background: "var(--p)", color: "var(--p-fg)" }}>1</span>
              Procure o seu nome
            </p>
            <BuscaColaborador valor={colab} onChange={setColab} />
          </div>

          {/* 2. Categoria */}
          <div className="space-y-3 transition-all duration-300"
            style={colab ? undefined : { opacity: 0.4, pointerEvents: "none", filter: "grayscale(1)" }}>
            <p className="flex items-center gap-2.5 text-sm font-semibold">
              <span className="grid place-items-center rounded-full text-xs font-bold transition-colors"
                style={{ width: 24, height: 24, background: colab ? "var(--p)" : "var(--surface-3)", color: colab ? "var(--p-fg)" : "var(--fg-faint)" }}>2</span>
              Categoria da prova
            </p>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3" role="radiogroup" aria-label="Categoria da prova">
              {(Object.keys(CATEGORIAS) as Categoria[]).map((k) => {
                const Ic = ICONE[k];
                return (
                  <button key={k} type="button" role="radio" aria-checked={categoria === k}
                    onClick={() => setCategoria(k)}
                    className="opt flex-col items-center gap-2 py-5 text-center" style={{ alignItems: "center" }}>
                    <Ic width={28} height={28} style={{ color: categoria === k ? "var(--p)" : "var(--fg-muted)" }} />
                    <span className="text-sm font-semibold">{CATEGORIAS[k]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {erro && <p className="alert af" role="alert">{erro}</p>}

          <button onClick={comecar} disabled={!colab || !categoria || carregando} className="btn btn-p btn-block">
            {carregando ? <><span className="spinner" /> Carregando…</> : <>Iniciar avaliação <Seta width={18} height={18} /></>}
          </button>
        </div>

        <p className="au d5 mt-6 text-center text-sm">
          <Link to="/instrutor" className="link">Área do instrutor</Link>
        </p>
      </section>
    </>
  );
}
