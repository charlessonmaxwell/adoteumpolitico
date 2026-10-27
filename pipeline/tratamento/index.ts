import type { DadosBrutos } from '../coleta/index.js';

/** Normaliza, valida e agrega por parlamentar. Saída em data/*.json. */
export type DadosTratados = { totalRegistros: number };

export async function tratar(_bruto: DadosBrutos): Promise<DadosTratados> {
  // TODO: story 1.x
  return { totalRegistros: 0 };
}
