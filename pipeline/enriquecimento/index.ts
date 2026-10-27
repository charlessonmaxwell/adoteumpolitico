import type { DadosTratados } from '../tratamento/index.js';

/** IA (Claude Haiku) só para itens novos: resumos populares e etiquetas de impacto (épico 6). */
export async function enriquecer(_dados: DadosTratados): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY ausente: enriquecimento pulado.');
    return;
  }
  // TODO: story 6.x
}
