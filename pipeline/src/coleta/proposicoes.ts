import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { carregarConfig, type ConfigCategorias } from "./categoria.js";
import { coletarProposicoesCamara } from "./proposicoes-camara.js";
import { coletarProposicoesSenado } from "./proposicoes-senado.js";
import { coletarParlamentares } from "./parlamentares.js";
import { anosDeColeta } from "./gastos.js";
import type { Parlamentar } from "../modelo/parlamentar.js";
import type { Proposicao } from "../modelo/proposicao.js";
import type { OpcoesHttp } from "../util/http.js";

export async function coletarProposicoes(
  parlamentares: Parlamentar[],
  anos: number[],
  cfg: ConfigCategorias = carregarConfig(),
  opcoes: OpcoesHttp = {},
): Promise<Proposicao[]> {
  // concat em vez de push(...lote): com ~100 mil itens o spread estoura a pilha
  let camara: Proposicao[] = [];
  for (const ano of anos) camara = camara.concat(await coletarProposicoesCamara(ano, cfg, opcoes));
  const senadores = parlamentares.filter((p) => p.casa === "senado");
  const senado = await coletarProposicoesSenado(senadores, cfg, opcoes);
  return [...camara, ...senado];
}

async function main() {
  const parlamentares = await coletarParlamentares();
  const todas = await coletarProposicoes(parlamentares, anosDeColeta());
  await mkdir("data", { recursive: true });
  for (const casa of ["camara", "senado"] as const) {
    const lote = todas.filter((p) => p.casa === casa);
    await writeFile(`data/proposicoes-${casa}.json`, JSON.stringify(lote));
  }
  const cat = (c: string) => todas.filter((p) => p.categoria === c).length;
  console.log(
    `OK: ${todas.length} autorias (legislativa ${cat("legislativa")}, homenagem ${cat("homenagem")}, procedimental ${cat("procedimental")})`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
}
