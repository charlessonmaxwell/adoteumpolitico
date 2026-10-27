import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { coletarDeputados } from "./camara.js";
import { coletarSenadores } from "./senado.js";
import type { OpcoesHttp } from "../util/http.js";
import type { Parlamentar } from "../modelo/parlamentar.js";

/** Abaixo disso, a fonte provavelmente veio incompleta (esperado em 27/10/2026: 513 + 81 = 594). */
export const MINIMO_PARLAMENTARES = 580;

export async function coletarParlamentares(opcoes: OpcoesHttp = {}): Promise<Parlamentar[]> {
  const coletadoEm = new Date().toISOString();
  const deputados = await coletarDeputados(coletadoEm, opcoes);
  // A legislatura vigente é a dos deputados: todos são eleitos na mesma.
  const legislaturaVigente = Math.max(...deputados.map((d) => d.idLegislatura));
  const senadores = await coletarSenadores(coletadoEm, legislaturaVigente, opcoes);
  const todos = [...deputados, ...senadores];

  if (todos.length < MINIMO_PARLAMENTARES) {
    throw new Error(
      `Coleta incompleta: ${todos.length} parlamentares (mínimo ${MINIMO_PARLAMENTARES}). Publicação abortada.`,
    );
  }
  return todos;
}

async function main() {
  const todos = await coletarParlamentares();
  await mkdir("data", { recursive: true });
  await writeFile("data/parlamentares.json", JSON.stringify(todos, null, 2));
  const camara = todos.filter((p) => p.casa === "camara").length;
  console.log(
    `OK: ${camara} deputados + ${todos.length - camara} senadores → data/parlamentares.json`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
}
