import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CATEGORIAS, REGRAS } from "@ebc/shared";
import Fundo from "../components/Fundo";
import { Fechar } from "../components/Icones";
import { useSessao } from "../lib/sessao";

/** Conta de 0 até o valor final (animação do placar). */
function useContador(alvo: number, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const ini = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - ini) / ms);
      setN(Math.round(alvo * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, ms]);
  return n;
}

export default function Resultado() {
  const nav = useNavigate();
  const { sessao, sair } = useSessao();
  const { prova, resultado } = sessao;
  const pontos = useContador(resultado?.pontos ?? 0);
  if (!prova || !resultado) return <Navigate to="/" replace />;

  const ok = resultado.aprovado;
  const cor = ok ? "var(--p)" : "var(--d)";
  const pct = Math.round((resultado.pontos / resultado.pontosMaximos) * 100);

  return (
    <>
      <Fundo />
      <section className="mx-auto max-w-md space-y-5 text-center">
        <p className="muted au text-sm">{prova.colaborador.nome} · {CATEGORIAS[prova.categoria]}</p>

        <div className="glass au d1 p-7 sm:p-9">
          {/* Selo */}
          <div className="ap d2 mx-auto mb-5 grid place-items-center rounded-full"
            style={{ width: 84, height: 84, background: ok ? "var(--p-tint)" : "var(--d-tint)", color: cor, animation: ok ? "popIn .6s .2s both, ring 2.4s 1s ease-out infinite" : "popIn .6s .2s both" }}>
            {ok ? (
              <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path className="check-draw" d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            ) : <Fechar width={40} height={40} strokeWidth={2.4} />}
          </div>

          <p className="muted text-xs font-semibold uppercase tracking-widest">Sua pontuação</p>
          <p className="mt-1 text-7xl font-extrabold leading-none tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>
            {pontos}
            <span className="faint text-2xl font-semibold"> / {resultado.pontosMaximos}</span>
          </p>

          <div className="bar mx-auto mt-5 max-w-[14rem]">
            <span style={{ width: `${pct}%`, background: cor }} />
          </div>

          <p className={`chip ap d4 mt-6 px-5 py-2 text-base ${ok ? "chip-ok" : "chip-bad"}`} style={{ letterSpacing: ".08em" }}>
            {ok ? "APROVADO" : "REPROVADO"}
          </p>

          {resultado.tempoEsgotado && (
            <p className="chip chip-warn af mt-4">TEMPO ESGOTADO · contou só o que foi respondido</p>
          )}

          <p className="muted mt-4 text-sm">
            {ok
              ? `Você atingiu a pontuação mínima (${REGRAS.teorica.acertosMinimos} acertos).`
              : `Pontuação mínima para aprovação: ${REGRAS.teorica.acertosMinimos} acertos.`}
          </p>
        </div>

        <button onClick={() => { sair(); nav("/", { replace: true }); }} className="btn btn-g btn-block au d3">
          Voltar ao início
        </button>
      </section>
    </>
  );
}
