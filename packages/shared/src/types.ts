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
  /** Processo(s) em que atua (vários separados por " / "). */
  processo?: string | null;
  /** Nome do gerente responsável (a planilha não traz; é preenchido na Configuração). */
  gerente?: string | null;
  /** ATIVO, FÉRIAS, ... ou "FORA DA BASE" (consta só no histórico; não aparece na busca). */
  situacao?: string | null;
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
  /** Coordenador do colaborador (campo "gerente" da base). */
  coordenador?: string | null;
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
  coordenador?: string | null;
  tipo: "primeira" | "reteste";
  veiculo: TipoVeiculo | null;
  pontos: number;
  apto: boolean;
  /** "Escola do Bom Condutor" ou "De Olho na Condução" (a prática vale para os dois; a teórica só para a Escola). */
  programa: string;
  /** Infrações cometidas (critério + quantidade). */
  ocorrencias: Ocorrencia[];
  /** Observações do instrutor. */
  descricao: string;
  avaliador: string;
  /** Pode ser nulo nos registros históricos sem data. */
  realizadaEm: string | null;
};
export type DashboardPraticaRes = { demo: boolean; registros: RegistroPratico[] };

/* ---------- Configuração: base de colaboradores ---------- */
export type BaseColaboradoresRes = {
  /** true quando há banco de dados (as alterações ficam guardadas). */
  persistente: boolean;
  /** false em produção sem banco: a tela só consulta. */
  editavel: boolean;
  colaboradores: Colaborador[];
};
/** O que fazer com quem está na base mas não veio na planilha importada. */
export type AusentesAcao = "desligar" | "excluir" | "manter";
export type ImportacaoRes = {
  aplicada: boolean;
  arquivo: { nome: string; linhas: number; validos: number; duplicados: number; ignorados: string[] };
  novos: Colaborador[];
  alterados: { antes: Colaborador; depois: Colaborador; campos: string[] }[];
  ausentes: Colaborador[];
  semMudanca: number;
};

/** Resumo da última avaliação de um colaborador em um tipo de avaliação. */
export type ResumoAvaliacao = { qtd: number; ultima: string | null; /** aprovado / apto na última */ ok: boolean; pontos: number };
/** Um colaborador e o que ele já fez: teórica (só Escola), prática da Escola e prática do De Olho na Condução. */
export type RegistroCruzamento = {
  colaboradorId: string;
  nome: string;
  matricula: string | null;
  base: string | null;
  gerencia: string | null;
  coordenador?: string | null;
  teorica: ResumoAvaliacao | null;
  praticaEscola: ResumoAvaliacao | null;
  praticaOlho: ResumoAvaliacao | null;
};
export type CruzamentoRes = { demo: boolean; registros: RegistroCruzamento[] };

/** Questão da prova com gabarito, usada só no detalhamento do painel (área restrita). */
export type QuestaoCatalogo = {
  id: string;
  /** Provas de Carro e Caminhão usam as mesmas questões. */
  grupo: "carro" | "moto";
  numero: number;
  enunciado: string;
  /** Id da alternativa correta. */
  correta: string;
  alternativas: Alternativa[];
};
/** Prova teórica finalizada + as questões erradas: [id da questão, id da alternativa marcada ou null se em branco]. */
export type RegistroTeoricoDetalhe = RegistroTeorico & { erros: [string, string | null][] };
export type DetalheTeoricaRes = { demo: boolean; questoes: QuestaoCatalogo[]; registros: RegistroTeoricoDetalhe[] };

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
