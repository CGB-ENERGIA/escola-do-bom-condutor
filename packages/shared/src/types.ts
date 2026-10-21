import type { CATEGORIAS, NATUREZAS, VEICULOS } from "./config";

export type Categoria = keyof typeof CATEGORIAS;
export type NaturezaInfracao = keyof typeof NATUREZAS;
export type TipoVeiculo = keyof typeof VEICULOS;

export type Colaborador = {
  /** Matrícula quando existir; senão, um identificador derivado do nome. */
  id: string;
  matricula: string | null;
  nome: string;
  funcao: string | null;
  base: string | null;
  gerencia: string | null;
};

export type Alternativa = { id: string; texto: string };

export type Questao = {
  id: string;
  numero: number;
  enunciado: string;
  alternativas: Alternativa[];
  pontos: number;
  /** Id da alternativa correta. NUNCA enviar ao cliente. */
  correta: string;
};

/** Questão como o colaborador a vê (sem gabarito). */
export type QuestaoPublica = Omit<Questao, "correta">;

/** questaoId -> alternativaId */
export type Respostas = Record<string, string>;

export type StatusTeorica = "aprovado" | "reprovado";

export type ResultadoTeorico = {
  acertos: number;
  total: number;
  pontos: number;
  pontosMaximos: number;
  aprovado: boolean;
  status: StatusTeorica;
  /** true quando o tempo acabou antes de o colaborador finalizar (conta só o respondido). */
  tempoEsgotado?: boolean;
};

export type Tentativa = {
  id: string;
  colaboradorId: string;
  categoria: Categoria;
  iniciadaEm: string;
  /** Limite para finalizar (início + duração). */
  expiraEm?: string;
  finalizadaEm?: string;
  respostas?: Respostas;
  resultado?: ResultadoTeorico;
};

/* ---------- avaliação prática ---------- */
export type CriterioPratico = { id: string; descricao: string; natureza: NaturezaInfracao };

/** Quantas vezes o critério (infração) ocorreu durante o percurso. */
export type Ocorrencia = { criterioId: string; quantidade: number };

export type AptidaoPratica = "apto" | "inapto";

export type ResultadoPratico = {
  pontos: number;
  eliminatoria: boolean;
  apto: boolean;
  aptidao: AptidaoPratica;
  /** Explicação legível quando inapto. */
  motivos: string[];
};

/** Foto de evidência com carimbo. A hora vem da REDE (servidor), nunca do relógio do aparelho. */
export type Evidencia = {
  id: string;
  /** Caminho da imagem (servido pela API). */
  url: string;
  /** Hora de rede usada no carimbo (ISO). */
  capturadaEm: string;
  /** Hora em que o servidor recebeu a foto (ISO). */
  recebidaEm: string;
  latitude: number | null;
  longitude: number | null;
  /** Precisão do GPS em metros. */
  precisao: number | null;
  instrutor: string;
};

export type AvaliacaoPratica = {
  id: string;
  colaboradorId: string;
  /** Programa de origem (histórico: "Escola do Bom Condutor" ou "De Olho na Condução"). */
  programa?: string;
  tipo: "primeira" | "reteste";
  veiculo: TipoVeiculo | null;
  base: string | null;
  ocorrencias: Ocorrencia[];
  descricao: string;
  evidenciaUrl: string | null;
  /** Fotos tiradas na hora, com carimbo de data/hora (rede) e localização. */
  evidencias?: Evidencia[];
  avaliador: string;
  realizadaEm: string | null;
  resultado: ResultadoPratico;
};

/* ---------- contratos da API ---------- */
export type IniciarTentativaReq = { colaboradorId: string; categoria: Categoria };
export type IniciarTentativaRes = {
  tentativaId: string;
  colaborador: Colaborador;
  categoria: Categoria;
  questoes: QuestaoPublica[];
  /** Horário do servidor ao iniciar e limite da prova (ISO). */
  agora: string;
  expiraEm: string;
};
export type FinalizarTentativaReq = { respostas: Respostas };
export type FinalizarTentativaRes = { resultado: ResultadoTeorico };

/** Linha "achatada" de uma prova teórica finalizada, usada pelo dashboard. */
export type RegistroTeorico = {
  id: string;
  colaboradorId: string;
  nome: string;
  matricula: string | null;
  base: string | null;
  gerencia: string | null;
  categoria: Categoria;
  pontos: number;
  pontosMaximos: number;
  aprovado: boolean;
  tempoEsgotado: boolean;
  finalizadaEm: string;
};
export type DashboardTeoricaRes = { demo: boolean; registros: RegistroTeorico[] };

/** Linha "achatada" de uma avaliação prática, usada pelo dashboard. */
export type RegistroPratico = {
  id: string;
  colaboradorId: string;
  nome: string;
  matricula: string | null;
  base: string | null;
  gerencia: string | null;
  tipo: "primeira" | "reteste";
  veiculo: TipoVeiculo | null;
  pontos: number;
  apto: boolean;
  avaliador: string;
  /** Pode ser nulo nos registros históricos sem data. */
  realizadaEm: string | null;
};
export type DashboardPraticaRes = { demo: boolean; registros: RegistroPratico[] };

export type CriarAvaliacaoPraticaReq = {
  colaboradorId: string;
  tipo: "primeira" | "reteste";
  veiculo: TipoVeiculo;
  ocorrencias: Ocorrencia[];
  descricao?: string;
  evidenciaUrl?: string;
  /** Ids das fotos já enviadas por /api/evidencias. */
  evidencias?: string[];
};
export type AvaliacaoPraticaDetalhada = AvaliacaoPratica & { colaborador?: Colaborador };
export type LoginInstrutorReq = { usuario: string; senha: string };
export type LoginInstrutorRes = { token: string; nome: string };
