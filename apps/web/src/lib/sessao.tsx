import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { IniciarTentativaRes, Respostas, ResultadoTeorico } from "@ebc/shared";

export type Sessao = {
  prova?: IniciarTentativaRes;
  respostas: Respostas;
  resultado?: ResultadoTeorico;
};

type Ctx = {
  sessao: Sessao;
  iniciar: (p: IniciarTentativaRes) => void;
  responder: (questaoId: string, alternativaId: string) => void;
  concluir: (r: ResultadoTeorico) => void;
  sair: () => void;
};

const CHAVE = "ebc:sessao";
const VAZIA: Sessao = { respostas: {} };
const SessaoCtx = createContext<Ctx>(null!);

function carregar(): Sessao {
  try {
    const raw = sessionStorage.getItem(CHAVE);
    return raw ? (JSON.parse(raw) as Sessao) : VAZIA;
  } catch {
    return VAZIA;
  }
}

/** Mantém a sessão do colaborador (prova em andamento) mesmo se a página for recarregada. */
export function SessaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao>(carregar);

  useEffect(() => {
    try { sessionStorage.setItem(CHAVE, JSON.stringify(sessao)); } catch { /* ignora */ }
  }, [sessao]);

  const value: Ctx = {
    sessao,
    iniciar: (prova) => setSessao({ prova, respostas: {} }),
    responder: (q, a) => setSessao((s) => ({ ...s, respostas: { ...s.respostas, [q]: a } })),
    concluir: (resultado) => setSessao((s) => ({ ...s, resultado })),
    sair: () => setSessao(VAZIA),
  };
  return <SessaoCtx.Provider value={value}>{children}</SessaoCtx.Provider>;
}

export const useSessao = () => useContext(SessaoCtx);
