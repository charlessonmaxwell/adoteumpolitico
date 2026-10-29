/**
 * Métricas de saúde das rotinas, gravadas em `metricas.json` ao fim de cada execução
 * (com sucesso ou não) e enviadas ao Grafana Cloud por scripts/enviar-metricas.mjs.
 */
import { writeFile } from "node:fs/promises";

export interface MetricasExecucao {
  workflow: "diario" | "presenca" | "publicar";
  resultado: "sucesso" | "falha";
  /** Etapa em que falhou, se falhou. */
  etapaFalha?: string;
  duracaoTotalS: number;
  etapasS: Record<string, number>;
  /** Chaves no formato "tipo/casa-ano" (ex.: "despesas/camara-2026") ou simples ("parlamentares"). */
  contagens: Record<string, number>;
  travaDisparou: boolean;
  mudou: boolean | null;
  extras?: Record<string, number>;
}

export async function gravarMetricas(m: MetricasExecucao, arquivo = "metricas.json") {
  try {
    await writeFile(arquivo, JSON.stringify(m, null, 2));
  } catch {
    // Monitoramento nunca derruba a rotina
  }
}
