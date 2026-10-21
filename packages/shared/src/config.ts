/**
 * Regras do programa Escola do Bom Condutor.
 * Centralizadas aqui para serem ajustadas sem mexer na lógica.
 */
export const REGRAS = {
  teorica: {
    /** Cada prova (por categoria) tem 30 questões de 1 ponto. */
    totalQuestoes: 30,
    /** Mínimo de acertos (= pontos) para aprovação. Menos que isso: reprovado. */
    acertosMinimos: 20,
    /** Tempo limite da prova, em minutos. Ao esgotar, conta só o que foi respondido. */
    duracaoMinutos: 40,
  },
  pratica: {
    /**
     * Máximo de pontos tolerado: Apto = nenhuma infração, ou apenas 1 leve (3 pts) e nada mais,
     * e nenhuma eliminatória. Mais que isso = Inapto.
     */
    limitePontosInfracao: 3,
  },
} as const;

/**
 * Natureza das infrações da avaliação prática.
 * Gravíssima é ELIMINATÓRIA (reprova/inapto independente de pontos).
 */
export const NATUREZAS = {
  leve: { rotulo: "Infração Leve", pontos: 3, eliminatoria: false },
  media: { rotulo: "Infração Média", pontos: 4, eliminatoria: false },
  grave: { rotulo: "Infração Grave", pontos: 5, eliminatoria: false },
  gravissima: { rotulo: "Infração Eliminatória", pontos: 0, eliminatoria: true },
} as const;

/** Tipos de veículo da avaliação prática. */
export const VEICULOS = {
  carro: "Carro/Caminhonete",
  caminhao: "Caminhão",
  moto: "Motocicleta",
} as const;

/** Categorias de prova disponíveis. */
export const CATEGORIAS = {
  carro: "Carro/Caminhonete",
  caminhao: "Caminhão",
  moto: "Motocicleta",
} as const;
