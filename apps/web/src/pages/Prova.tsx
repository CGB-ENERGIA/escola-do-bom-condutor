import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CATEGORIAS } from "@ebc/shared";
import { Relogio, Seta, SetaEsq } from "../components/Icones";
import { api } from "../lib/api";
import { useSessao } from "../lib/sessao";

/** Segundos restantes até `expiraEm` (recalculado do relógio, então não "atrasa" com a aba em segundo plano). */
function useRestante(expiraEm?: string) {
  const alvo = expiraEm ? Date.parse(expiraEm) : 0;
  const calc = () => Math.max(0, Math.ceil((alvo - Date.now()) / 1000));
  const [s, setS] = useState(calc);
  useEffect(() => {
    setS(calc());
    const t = window.setInterval(() => setS(calc()), 500);
    const vis = () => setS(calc());
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [alvo]); // eslint-disable-line react-hooks/exhaustive-deps
  return s;
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Uma questão por vez, com navegação, barra de progresso e contagem regressiva (pensado para celular). */
export default function Prova() {
  const nav = useNavigate();
  const { sessao, responder, concluir } = useSessao();
  const [i, setI] = useState(0);
  const [sentido, setSentido] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();
  const { prova, respostas } = sessao;
  const restante = useRestante(prova?.expiraEm);
  const esgotado = !!prova && restante <= 0;
  const respRef = useRef(respostas);
  respRef.current = respostas;
  const auto = useRef(false);

  // Tempo acabou: envia automaticamente só o que foi respondido
  useEffect(() => {
    if (esgotado && !auto.current) { auto.current = true; void enviar(); }
  }, [esgotado]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!prova) return <Navigate to="/" replace />;

  const total = prova.questoes.length;
  const q = prova.questoes[i]!;
  const respondidas = prova.questoes.filter((x) => respostas[x.id]).length;
  const faltam = total - respondidas;

  const ir = (n: number) => { setSentido(n > i ? 1 : -1); setI(n); window.scrollTo({ top: 0, behavior: "smooth" }); };

  async function enviar() {
    setErro(undefined);
    setEnviando(true);
    try {
      const { resultado } = await api.finalizar(prova!.tentativaId, respRef.current);
      concluir(resultado);
      nav("/resultado", { replace: true });
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }

  async function finalizar() {
    if (faltam > 0 && !window.confirm(`Ainda há ${faltam} questão(ões) sem resposta. Finalizar mesmo assim?`)) return;
    await enviar();
  }

  const ultima = i === total - 1;
  const critico = restante <= 60;
  const alerta = restante <= 300;
  const corTempo = critico ? "var(--d)" : alerta ? "var(--w)" : "var(--fg)";

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      {/* Cronômetro fixo no topo */}
      <div className="sticky top-[3.7rem] z-30 -mx-1 flex items-center justify-between gap-3 rounded-[var(--r)] px-4 py-2.5 backdrop-blur"
        style={{ background: "var(--glass)", border: `1px solid ${alerta ? corTempo : "var(--border)"}`, boxShadow: "var(--sh)" }}
        role="timer" aria-live={critico ? "assertive" : "off"} aria-label={`Tempo restante ${mmss(restante)}`}>
        <span className="muted flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <Relogio width={16} height={16} style={critico ? { animation: "tick 1s ease-in-out infinite" } : undefined} /> Tempo restante
        </span>
        <span className="text-xl font-extrabold" style={{ color: corTempo, fontVariantNumeric: "tabular-nums", animation: critico && !esgotado ? "tick 1s ease-in-out infinite" : undefined }}>
          {mmss(restante)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="muted truncate">{prova.colaborador.nome}</span>
        <span className="chip chip-ok shrink-0">{CATEGORIAS[prova.categoria]}</span>
      </div>

      {esgotado && (
        <p className="alert af" role="alert">
          {enviando ? "Tempo esgotado. Enviando as respostas…" : "Tempo esgotado. Não foi possível enviar — tente novamente."}
          {!enviando && <button onClick={() => void enviar()} className="link ml-2 text-sm">Reenviar</button>}
        </p>
      )}

      {/* Progresso */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">Questão {i + 1}<span className="faint font-normal"> de {total}</span></span>
          <span className="muted text-xs">{respondidas} respondida(s)</span>
        </div>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={respondidas}>
          <span style={{ width: `${(respondidas / total) * 100}%` }} />
        </div>
      </div>

      {/* Questão (key reinicia a animação ao trocar) */}
      <fieldset key={q.id} disabled={esgotado} className="card as p-5 sm:p-7" style={{ animationName: sentido > 0 ? "slideIn" : "fadeIn" }}>
        <legend className="sr-only">Questão {q.numero}</legend>
        <p className="text-[1.05rem] font-semibold leading-relaxed sm:text-lg">
          <span style={{ color: "var(--p)" }}>{q.numero}.</span> {q.enunciado}
        </p>
        <div className="mt-5 space-y-2.5" role="radiogroup">
          {q.alternativas.map((a, idx) => (
            <button key={a.id} type="button" role="radio" aria-checked={respostas[q.id] === a.id}
              onClick={() => responder(q.id, a.id)} className="opt">
              <span className="dot" />
              <span className="min-w-0 flex-1 text-[0.95rem] leading-snug">
                <span className="faint mr-1.5 font-semibold">{String.fromCharCode(65 + idx)})</span>{a.texto}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-3">
        <button disabled={i === 0 || esgotado} onClick={() => ir(i - 1)} className="btn btn-g flex-1">
          <SetaEsq width={18} height={18} /> Anterior
        </button>
        {!ultima ? (
          <button disabled={esgotado} onClick={() => ir(i + 1)} className="btn btn-p flex-1">
            Próxima <Seta width={18} height={18} />
          </button>
        ) : (
          <button onClick={finalizar} disabled={enviando || esgotado} className="btn btn-p flex-1">
            {enviando ? <><span className="spinner" /> Enviando…</> : "Finalizar prova"}
          </button>
        )}
      </div>

      {/* Navegador de questões */}
      <div className="card p-4">
        <p className="muted mb-3 text-xs font-semibold uppercase tracking-wider">Navegação</p>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
          {prova.questoes.map((x, idx) => (
            <button key={x.id} disabled={esgotado} onClick={() => ir(idx)} aria-label={`Ir para questão ${x.numero}`}
              aria-current={idx === i} data-done={!!respostas[x.id]} className="qn">
              {x.numero}
            </button>
          ))}
        </div>
      </div>

      {!ultima && respondidas === total && (
        <button onClick={finalizar} disabled={enviando || esgotado} className="btn btn-g btn-block af"
          style={{ borderColor: "var(--p)", color: "var(--p)" }}>
          Todas respondidas — finalizar prova
        </button>
      )}
      {erro && !esgotado && <p className="alert af" role="alert">{erro}</p>}
    </section>
  );
}
