import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ResumoParlamentar } from "../../../pipeline/src/rotina/agregacao.js";
import type { Meta } from "../../../pipeline/src/rotina/index.js";
import type { Parlamentar } from "../../../pipeline/src/modelo/parlamentar.js";
import type { Medias } from "./frases.js";
import { fimLegislatura, inicioLegislatura } from "../../../pipeline/src/modelo/legislatura.js";
import type {
  ProjetoVotado,
  VotoEmProjeto,
} from "../../../pipeline/src/rotina/votos-por-projeto.js";

/** Pasta com a publicação da branch `data`. Sem ela, usa os dados simulados (desenvolvimento e CI). */
const DIR = resolve(process.env.DADOS_DIR ?? "site/fixtures");
/** O Senado entrega fotos em http; a CSP (story 8.1) só aceita https. */
export const fotoSegura = (url: string | null): string | null =>
  url ? url.replace(/^http:\/\//, "https://") : url;

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
    .map((r) => ({
      ...r,
      parlamentar: { ...r.parlamentar, urlFoto: fotoSegura(r.parlamentar.urlFoto) },
    }))
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

let cacheExplicacoes: Map<string, string | undefined> | null = null;
/** Explicação popular de cada projeto votado, por id (story 2.7). */
export function explicacoesDosProjetos(): Map<string, string | undefined> {
  cacheExplicacoes ??= new Map(projetos().map((p) => [p.id, p.explicacao]));
  return cacheExplicacoes;
}

/** Situação das atualizações (story 2.8). Null se a publicação ainda não tem o arquivo. */
export function situacao(): import("../../../pipeline/src/situacao/calculo.js").Situacao | null {
  const arq = join(DIR, "situacao.json");
  return existsSync(arq) ? JSON.parse(readFileSync(arq, "utf8")) : null;
}

/** Números gerais do Congresso (página Panorama). Null se a publicação ainda não tem o arquivo. */
export function panorama(): import("../../../pipeline/src/rotina/panorama.js").Panorama | null {
  const arq = join(DIR, "panorama.json");
  return existsSync(arq) ? JSON.parse(readFileSync(arq, "utf8")) : null;
}

type EmendasP = import("../../../pipeline/src/emendas/rotina.js").EmendasDoParlamentar;
/** Emendas individuais ligadas ao parlamentar (rotina quinzenal). Null se não tiver nenhuma. */
export function emendasDe(id: string): EmendasP | null {
  const arq = join(DIR, "emendas", "parlamentar", `${id}.json`);
  return existsSync(arq) ? (JSON.parse(readFileSync(arq, "utf8")) as EmendasP) : null;
}
/** Resumo geral das emendas (Panorama). Null antes da primeira rotina quinzenal. */
export function resumoEmendas(): ReturnType<
  typeof import("../../../pipeline/src/emendas/rotina.js").resumoGeral
> | null {
  const arq = join(DIR, "emendas", "resumo.json");
  return existsSync(arq) ? JSON.parse(readFileSync(arq, "utf8")) : null;
}

type Cidade = import("../../../pipeline/src/emendas/cidades.js").CidadeEmendas;
export interface CidadeIndice {
  id: string;
  nome: string;
  uf: string;
  empenhado: number;
  recebido: number;
}
/** Índice das cidades com emenda ou dinheiro recebido (só as que têm arquivo publicado). */
export function cidadesEmendas(): CidadeIndice[] {
  const arq = join(DIR, "emendas", "cidades.json");
  if (!existsSync(arq)) return [];
  return (JSON.parse(readFileSync(arq, "utf8")) as CidadeIndice[]).filter((c) =>
    existsSync(join(DIR, "emendas", "cidade", `${c.id}.json`)),
  );
}
export function cidadeEmendas(id: string): Cidade {
  return JSON.parse(readFileSync(join(DIR, "emendas", "cidade", `${id}.json`), "utf8")) as Cidade;
}

type Palacio = import("../../../pipeline/src/palacio/rotina.js").ResumoPalacio;
/** Cartão corporativo do Palácio (story 7.1). Null antes da primeira rotina mensal. */
export function palacio(): Palacio | null {
  const arq = join(DIR, "palacio", "resumo.json");
  return existsSync(arq) ? (JSON.parse(readFileSync(arq, "utf8")) as Palacio) : null;
}

type Composicao = import("../../../pipeline/src/rotina/composicao.js").Composicao;
/** Quem ocupa as cadeiras, uma entrada por legislatura (story 9.1), da mais nova para a mais antiga. */
export function composicoes(): Composicao[] {
  const pasta = join(DIR, "composicao");
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(pasta, f), "utf8")) as Composicao)
    .sort((a, b) => b.legislatura - a.legislatura);
}

/** Resumos guardados das legislaturas encerradas (story 9.2), da mais nova para a mais antiga. */
let cacheArquivo:
  | {
      leg: number;
      resumos: ResumoParlamentar[];
      medias: Record<"camara" | "senado", Medias> | null;
    }[]
  | null = null;
export function arquivo() {
  if (cacheArquivo) return cacheArquivo;
  const pasta = join(DIR, "arquivo");
  cacheArquivo = existsSync(pasta)
    ? readdirSync(pasta)
        .filter((d) => /^\d+$/.test(d) && existsSync(join(pasta, d, "resumo")))
        .map((d) => ({
          leg: Number(d),
          resumos: readdirSync(join(pasta, d, "resumo"))
            .filter((f) => f.endsWith(".json"))
            .map((f) => ler<ResumoParlamentar>(`arquivo/${d}/resumo/${f}`))
            .map((r) => ({
              ...r,
              parlamentar: { ...r.parlamentar, urlFoto: fotoSegura(r.parlamentar.urlFoto) },
            })),
          medias: existsSync(join(pasta, d, "medias.json"))
            ? ler<Record<"camara" | "senado", Medias>>(`arquivo/${d}/medias.json`)
            : null,
        }))
        .sort((a, b) => b.leg - a.leg)
    : [];
  return cacheArquivo;
}

export interface Mandato {
  numero: number;
  inicio: string;
  /** null = em andamento. */
  fim: string | null;
  partido: string;
  href: string;
  /** Só senadores: o mandato de 8 anos. */
  mandatoSenado?: { inicio: string; fim: string };
}

/** Uma entrada por legislatura em que a pessoa aparece (atual e guardadas), da mais nova para a mais antiga. */
export function mandatosDe(id: string): Mandato[] {
  const atual = dados().resumos.find((r) => r.parlamentar.id === id);
  const lista: Mandato[] = [];
  if (atual) {
    const n = atual.parlamentar.idLegislatura;
    lista.push({
      numero: n,
      inicio: inicioLegislatura(n),
      fim: null,
      partido: atual.parlamentar.partido,
      href: `/p/${id}/`,
      mandatoSenado: atual.parlamentar.mandato,
    });
  }
  for (const a of arquivo()) {
    const r = a.resumos.find((x) => x.parlamentar.id === id);
    if (!r || (atual && a.leg === atual.parlamentar.idLegislatura)) continue;
    const encerradoAqui = !atual && lista.length === 0;
    lista.push({
      numero: a.leg,
      inicio: inicioLegislatura(a.leg),
      fim: fimLegislatura(a.leg),
      partido: r.parlamentar.partido,
      href: encerradoAqui ? `/p/${id}/` : `/p/${id}/${a.leg}/`,
      mandatoSenado: r.parlamentar.mandato,
    });
  }
  return lista;
}
