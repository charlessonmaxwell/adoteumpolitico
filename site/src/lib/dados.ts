import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ResumoParlamentar } from "../../../pipeline/src/rotina/agregacao.js";
import type { Meta } from "../../../pipeline/src/rotina/index.js";
import type { Parlamentar } from "../../../pipeline/src/modelo/parlamentar.js";
import type { Medias } from "./frases.js";
import type {
  ProjetoVotado,
  VotoEmProjeto,
} from "../../../pipeline/src/rotina/votos-por-projeto.js";

/** Pasta com a publicação da branch `data`. Sem ela, usa os dados simulados (desenvolvimento e CI). */
const DIR = resolve(process.env.DADOS_DIR ?? "site/fixtures");
const ler = <T>(arq: string): T => JSON.parse(readFileSync(join(DIR, arq), "utf8")) as T;

let cache: {
  resumos: ResumoParlamentar[];
  medias: Record<"camara" | "senado", Medias>;
  meta: Meta;
} | null = null;

export function dados() {
  if (cache) return cache;
  if (!existsSync(join(DIR, "meta.json")))
    throw new Error(`Dados não encontrados em ${DIR} (defina DADOS_DIR)`);
  const resumos = readdirSync(join(DIR, "resumo"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => ler<ResumoParlamentar>(`resumo/${f}`))
    .sort((a, b) => a.parlamentar.nome.localeCompare(b.parlamentar.nome, "pt-BR"));
  cache = { resumos, medias: ler("medias.json"), meta: ler("meta.json") };
  return cache;
}

export const cargo = (p: Parlamentar) =>
  p.casa === "camara" ? "Deputado(a) federal" : "Senador(a)";

/** Página oficial do parlamentar (link de fonte do perfil). */
export const paginaOficial = (p: Parlamentar) =>
  p.casa === "camara"
    ? `https://www.camara.leg.br/deputados/${p.idOrigem}`
    : `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${p.idOrigem}`;

/** Votos do parlamentar agrupados por projeto (story 3.1). Vazio se não houver arquivo. */
export function votosDe(id: string): VotoEmProjeto[] {
  const arq = join(DIR, "votos", `${id}.json`);
  return existsSync(arq) ? (JSON.parse(readFileSync(arq, "utf8")) as VotoEmProjeto[]) : [];
}

let cacheProjetos: ProjetoVotado[] | null = null;
export function projetos(): ProjetoVotado[] {
  if (cacheProjetos) return cacheProjetos;
  const pasta = join(DIR, "projetos");
  cacheProjetos = existsSync(pasta)
    ? readdirSync(pasta)
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(readFileSync(join(pasta, f), "utf8")) as ProjetoVotado)
    : [];
  return cacheProjetos;
}
