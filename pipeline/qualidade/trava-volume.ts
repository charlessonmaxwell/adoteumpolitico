import type { DadosTratados } from '../tratamento/index.js';

export const QUEDA_MAXIMA = 0.3;

/** Retorna true se a queda entre o volume anterior e o atual passar de 30%. */
export function quedaExcessiva(anterior: number, atual: number): boolean {
  if (anterior <= 0) return false;
  return (anterior - atual) / anterior > QUEDA_MAXIMA;
}

export async function verificarVolume(dados: DadosTratados, anterior = 0): Promise<void> {
  if (quedaExcessiva(anterior, dados.totalRegistros)) {
    throw new Error(
      `Volume caiu de ${anterior} para ${dados.totalRegistros}. Publicação bloqueada; site anterior continua no ar.`,
    );
  }
}
