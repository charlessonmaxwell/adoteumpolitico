/**
 * Orquestrador do pipeline diário.
 * Cada etapa é implementada por uma story do épico correspondente.
 */
import { coletar } from './coleta/index.js';
import { tratar } from './tratamento/index.js';
import { enriquecer } from './enriquecimento/index.js';
import { verificarVolume } from './qualidade/trava-volume.js';

async function main(): Promise<void> {
  const bruto = await coletar();
  const tratado = await tratar(bruto);
  await verificarVolume(tratado); // lança erro e impede o deploy se o volume cair > 30%
  await enriquecer(tratado);
  console.log('Pipeline concluído.');
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
