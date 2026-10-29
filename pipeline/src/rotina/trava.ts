/** Queda máxima aceita em qualquer contagem em relação à última publicação. */
export const QUEDA_MAXIMA = 0.3;

export type Contagens = Record<string, number>;

export interface Queda {
  chave: string;
  anterior: number;
  atual: number;
  queda: number;
}

/**
 * Compara contagens com a última publicação. Chave que sumiu conta como queda de 100%.
 * Chave nova (ex.: virada de ano) não é queda.
 */
export function verificarQuedas(anterior: Contagens | null, atual: Contagens): Queda[] {
  if (!anterior) return [];
  const quedas: Queda[] = [];
  for (const [chave, antes] of Object.entries(anterior)) {
    // Contagens de explicações variam de propósito (reaproveitadas × novas): não são volume de fonte
    if (antes <= 0 || chave.startsWith("explicacoes-")) continue;
    const agora = atual[chave] ?? 0;
    const queda = (antes - agora) / antes;
    if (queda > QUEDA_MAXIMA) quedas.push({ chave, anterior: antes, atual: agora, queda });
  }
  return quedas;
}

export class ErroTrava extends Error {
  constructor(public readonly quedas: Queda[]) {
    super(
      `Queda acima de ${QUEDA_MAXIMA * 100}% em ${quedas.length} contagem(ns): ` +
        quedas
          .map((q) => `${q.chave} ${q.anterior}→${q.atual} (-${Math.round(q.queda * 100)}%)`)
          .join("; "),
    );
  }
}
