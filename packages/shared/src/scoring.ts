import { NATUREZAS, REGRAS } from "./config";
import { CRITERIOS_PRATICOS } from "./criterios";
import type { Ocorrencia, Questao, Respostas, ResultadoPratico, ResultadoTeorico } from "./types";

/** Corrige a prova teórica: 1 ponto por acerto; aprovado com >= acertosMinimos. */
export function corrigirTeorica(questoes: Questao[], respostas: Respostas): ResultadoTeorico {
  let pontos = 0;
  let acertos = 0;
  for (const q of questoes) {
    if (respostas[q.id] === q.correta) {
      pontos += q.pontos;
      acertos++;
    }
  }
  const pontosMaximos = questoes.reduce((s, q) => s + q.pontos, 0);
  const aprovado = pontos >= REGRAS.teorica.acertosMinimos;
  return {
    acertos,
    total: questoes.length,
    pontos,
    pontosMaximos,
    aprovado,
    status: aprovado ? "aprovado" : "reprovado",
  };
}

/**
 * Avaliação prática (instrutor).
 * Inapto se houver qualquer infração gravíssima (eliminatória) OU soma de pontos > limite (3).
 * Na prática: nenhuma infração, ou somente 1 leve = Apto; 2+ leves, ou média/grave = Inapto.
 */
export function avaliarPratica(ocorrencias: Ocorrencia[]): ResultadoPratico {
  let pontos = 0;
  let eliminatoria = false;
  for (const o of ocorrencias) {
    if (o.quantidade <= 0) continue;
    const c = CRITERIOS_PRATICOS.find((x) => x.id === o.criterioId);
    if (!c) continue;
    const nat = NATUREZAS[c.natureza];
    pontos += o.quantidade * nat.pontos;
    if (nat.eliminatoria) eliminatoria = true;
  }
  const motivos: string[] = [];
  if (eliminatoria) motivos.push("Cometeu infração gravíssima (eliminatória).");
  if (pontos > REGRAS.pratica.limitePontosInfracao)
    motivos.push(`Somou ${pontos} pontos (limite: ${REGRAS.pratica.limitePontosInfracao}, ou seja, 1 infração leve).`);
  const apto = motivos.length === 0;
  return { pontos, eliminatoria, apto, aptidao: apto ? "apto" : "inapto", motivos };
}
