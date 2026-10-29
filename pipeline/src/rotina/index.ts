import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { coletarParlamentares } from "../coleta/parlamentares.js";
import { coletarVotacoesCamara } from "../coleta/votacoes-camara.js";
import { coletarLicencas, coletarVotacoesSenado } from "../coleta/votacoes-senado.js";
import { anosDeColeta, coletarGastos } from "../coleta/gastos.js";
import { coletarProposicoes } from "../coleta/proposicoes.js";
import { INICIO_PERIODO } from "../coleta/proposicoes-senado.js";
import type { Parlamentar } from "../modelo/parlamentar.js";
import type { DespesaInvalida } from "../modelo/despesa.js";
import type { Presenca, ResumoPresencaCamara } from "../modelo/votacao.js";
import { agregar, type Dados } from "./agregacao.js";
import { agruparPorProjeto } from "./votos-por-projeto.js";
import { ErroTrava, verificarQuedas, type Contagens } from "./trava.js";
import { gravarMetricas } from "../monitoramento/metricas.js";

/** Coletores injetáveis (testes usam versões simuladas). */
export interface Coletores {
  parlamentares: () => Promise<Parlamentar[]>;
  votacoes: (
    anos: number[],
    senadores: Parlamentar[],
  ) => Promise<Pick<Dados, "votacoes" | "votos" | "presencasSenado" | "licencas">>;
  gastos: (anos: number[]) => Promise<{ validas: Dados["despesas"]; invalidas: DespesaInvalida[] }>;
  proposicoes: (parlamentares: Parlamentar[], anos: number[]) => Promise<Dados["proposicoes"]>;
}

export const coletoresReais: Coletores = {
  parlamentares: () => coletarParlamentares(),
  votacoes: async (anos, senadores) => {
    const r: Pick<Dados, "votacoes" | "votos" | "presencasSenado" | "licencas"> = {
      votacoes: [],
      votos: [],
      presencasSenado: [],
      licencas: [],
    };
    for (const ano of anos) {
      const c = await coletarVotacoesCamara(ano);
      const s = await coletarVotacoesSenado(ano);
      r.votacoes = r.votacoes.concat(c.votacoes, s.votacoes);
      r.votos = r.votos.concat(c.votos, s.votos);
      r.presencasSenado = r.presencasSenado.concat(s.presencas);
    }
    r.licencas = await coletarLicencas(senadores, INICIO_PERIODO);
    return r;
  },
  gastos: (anos) => coletarGastos(anos),
  proposicoes: (parlamentares, anos) => coletarProposicoes(parlamentares, anos),
};

export interface Meta {
  atualizadoEm: string;
  impressao: string;
  contagens: Contagens;
  anos: number[];
}

export interface OpcoesRotina {
  /** Pasta com a última publicação (branch `data`); pode não existir na primeira execução. */
  anterior: string;
  /** Só para execução manual após mudança intencional de estrutura (revisada por uma pessoa). */
  ignorarTrava?: boolean;
  saida: string;
  anos?: number[];
  coletores?: Coletores;
  agora?: () => Date;
  log?: (msg: string) => void;
}

export class ErroEtapa extends Error {
  constructor(
    public readonly etapa: string,
    public readonly causa: unknown,
    public readonly contagens: Contagens,
    public readonly duracoes: Record<string, number> = {},
  ) {
    super(`Etapa "${etapa}" falhou: ${causa instanceof Error ? causa.message : String(causa)}`);
  }
}

async function lerJson<T>(caminho: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(caminho, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Arquivo → conteúdo. Nada é gravado antes de a trava passar. */
type Arquivos = Map<string, unknown>;

const porCasaAno = <T extends { casa: string }>(
  lista: T[],
  ano: (x: T) => number | string | null,
) => {
  const m = new Map<string, T[]>();
  for (const x of lista) {
    const k = `${x.casa}-${ano(x) ?? "sem-ano"}`;
    const g = m.get(k);
    if (g) g.push(x);
    else m.set(k, [x]);
  }
  return m;
};

export async function executarRotina(
  o: OpcoesRotina,
): Promise<{ meta: Meta; mudou: boolean; duracoes: Record<string, number> }> {
  const c = o.coletores ?? coletoresReais;
  const anos = o.anos ?? anosDeColeta();
  const log = o.log ?? console.log;
  const contagens: Contagens = {};
  const duracoes: Record<string, number> = {};
  const etapa = async <T>(nome: string, f: () => Promise<T>): Promise<T> => {
    const t = Date.now();
    try {
      const r = await f();
      duracoes[nome] = Math.round((Date.now() - t) / 100) / 10;
      log(`✓ ${nome} (${Math.round(duracoes[nome])}s)`);
      return r;
    } catch (e) {
      duracoes[nome] = Math.round((Date.now() - t) / 100) / 10;
      throw new ErroEtapa(nome, e, contagens, duracoes);
    }
  };

  // Ordem da story: cadastro → votos/presença → gastos → proposições → validação → agregação
  const parlamentares = await etapa("cadastro", c.parlamentares);
  contagens["parlamentares"] = parlamentares.length;
  const senadores = parlamentares.filter((p) => p.casa === "senado");

  const vot = await etapa("votacoes", () => c.votacoes(anos, senadores));
  const gastos = await etapa("gastos", () => c.gastos(anos));
  const proposicoes = await etapa("proposicoes", () => c.proposicoes(parlamentares, anos));

  // Presença da Câmara vem do job semanal: reaproveita a última publicação
  const presCamara = new Map<number, { presencas: Presenca[]; resumos: ResumoPresencaCamara[] }>();
  for (const ano of anos) {
    const base = join(o.anterior, "presenca", `camara-${ano}`);
    const presencas = await lerJson<Presenca[]>(`${base}.json`);
    const resumos = await lerJson<ResumoPresencaCamara[]>(`${base}-resumo.json`);
    if (presencas && resumos) presCamara.set(ano, { presencas, resumos });
  }

  const arquivos: Arquivos = new Map();
  arquivos.set("parlamentares.json", parlamentares);
  for (const [k, l] of porCasaAno(gastos.validas, (x) => x.ano)) {
    arquivos.set(`despesas/${k}.json`, l);
    contagens[`despesas/${k}`] = l.length;
  }
  arquivos.set("qualidade/despesas-invalidas.json", gastos.invalidas);
  // Pareceres e emendas da Câmara vêm com ano 0: usa o ano de apresentação
  const anoProposicao = (x: (typeof proposicoes)[number]) =>
    x.ano || (x.dataApresentacao ? Number(x.dataApresentacao.slice(0, 4)) : null);
  for (const [k, l] of porCasaAno(proposicoes, anoProposicao)) {
    arquivos.set(`proposicoes/${k}.json`, l);
    contagens[`proposicoes/${k}`] = l.length;
  }
  for (const [k, l] of porCasaAno(vot.votacoes, (x) => x.data.slice(0, 4))) {
    arquivos.set(`votacoes/${k}.json`, l);
    contagens[`votacoes/${k}`] = l.length;
  }
  const casaDoVoto = (id: string) => id.split("-")[0] ?? "";
  const anoDaVotacao = new Map(vot.votacoes.map((v) => [v.id, v.data.slice(0, 4)]));
  for (const [k, l] of porCasaAno(
    vot.votos.map((v) => ({ ...v, casa: casaDoVoto(v.idVotacao) })),
    (v) => anoDaVotacao.get(v.idVotacao) ?? null,
  )) {
    arquivos.set(
      `votacoes/${k}-votos.json`,
      l.map(({ casa: _, ...v }) => v),
    );
    contagens[`votos/${k}`] = l.length;
  }
  for (const [k, l] of porCasaAno(
    vot.presencasSenado.map((p) => ({ ...p, casa: "senado" })),
    (p) => p.data.slice(0, 4),
  )) {
    arquivos.set(
      `presenca/${k}.json`,
      l.map(({ casa: _, ...p }) => p),
    );
  }
  arquivos.set("presenca/senado-licencas.json", vot.licencas);
  for (const [ano, p] of presCamara) {
    arquivos.set(`presenca/camara-${ano}.json`, p.presencas);
    arquivos.set(`presenca/camara-${ano}-resumo.json`, p.resumos);
  }

  contagens["projetos-votados"] = new Set(
    vot.votacoes.filter((v) => v.tipo !== "simbolica" && v.idProposicao).map((v) => v.idProposicao),
  ).size;

  // Validação: trava contra fonte quebrada
  const metaAnterior = await lerJson<Meta>(join(o.anterior, "meta.json"));
  await etapa("validacao", async () => {
    const quedas = verificarQuedas(metaAnterior?.contagens ?? null, contagens);
    if (quedas.length && o.ignorarTrava) {
      log(`⚠ Trava ignorada manualmente. Quedas: ${new ErroTrava(quedas).message}`);
    } else if (quedas.length) throw new ErroTrava(quedas);
  });

  const agg = await etapa("agregacao", async () =>
    agregar({
      parlamentares,
      despesas: gastos.validas,
      proposicoes,
      votacoes: vot.votacoes,
      votos: vot.votos,
      presencasSenado: vot.presencasSenado,
      resumosPresencaCamara: [...presCamara.values()].flatMap((p) => p.resumos),
      licencas: vot.licencas,
    }),
  );
  for (const r of agg.resumos) arquivos.set(`resumo/${r.parlamentar.id}.json`, r);

  // Votos por projeto (story 3.1): um arquivo por parlamentar e um por projeto
  const vp = await etapa("votos-por-projeto", async () =>
    agruparPorProjeto(vot.votacoes, vot.votos),
  );
  const atuais = new Set(parlamentares.map((p) => p.id));
  for (const [id, lista] of vp.porParlamentar)
    if (atuais.has(id)) arquivos.set(`votos/${id}.json`, lista);
  for (const p of vp.projetos) arquivos.set(`projetos/${p.id}.json`, p);
  arquivos.set("medias.json", agg.medias);

  // Impressão digital do conteúdo (sem horário de coleta): igual à anterior = nada mudou (CA3)
  const hash = createHash("sha256");
  for (const nome of [...arquivos.keys()].sort()) {
    hash.update(nome);
    hash.update(JSON.stringify(arquivos.get(nome), (k, v) => (k === "coletadoEm" ? undefined : v)));
  }
  const impressao = hash.digest("hex");
  const meta: Meta = {
    atualizadoEm: (o.agora ?? (() => new Date()))().toISOString(),
    impressao,
    contagens,
    anos,
  };
  const mudou = impressao !== metaAnterior?.impressao;

  for (const [nome, conteudo] of arquivos) {
    const caminho = join(o.saida, nome);
    await mkdir(join(caminho, ".."), { recursive: true });
    await writeFile(caminho, JSON.stringify(conteudo));
  }
  await writeFile(join(o.saida, "meta.json"), JSON.stringify(meta, null, 2));
  return { meta, mudou, duracoes };
}

/** Texto da issue automática: etapa, erro e contagens. */
export function relatorioFalha(e: unknown): string {
  const etapa = e instanceof ErroEtapa ? e.etapa : "desconhecida";
  const causa = e instanceof ErroEtapa ? e.causa : e;
  const contagens = e instanceof ErroEtapa ? e.contagens : {};
  const quedas = causa instanceof ErroTrava ? causa.quedas : [];
  return [
    `**Etapa:** ${etapa}`,
    `**Erro:** ${causa instanceof Error ? causa.message : String(causa)}`,
    "",
    "O site **não foi atualizado**: a última publicação continua no ar.",
    quedas.length
      ? "\n**Quedas detectadas:**\n" +
        quedas
          .map(
            (q) => `- \`${q.chave}\`: ${q.anterior} → ${q.atual} (-${Math.round(q.queda * 100)}%)`,
          )
          .join("\n")
      : "",
    Object.keys(contagens).length
      ? "\n**Contagens até a falha:**\n" +
        Object.entries(contagens)
          .map(([k, v]) => `- \`${k}\`: ${v}`)
          .join("\n")
      : "",
  ].join("\n");
}

async function main() {
  const [anterior = "publicado", saida = "saida"] = process.argv.slice(2);
  const inicio = Date.now();
  const total = () => Math.round((Date.now() - inicio) / 1000);
  try {
    const ignorarTrava = process.env.IGNORAR_TRAVA === "true";
    const { meta, mudou, duracoes } = await executarRotina({ anterior, saida, ignorarTrava });
    console.log(
      `OK: ${Object.keys(meta.contagens).length} contagens; ${mudou ? "houve mudança" : "sem mudança"}`,
    );
    if (process.env.GITHUB_OUTPUT)
      await writeFile(process.env.GITHUB_OUTPUT, `mudou=${mudou}\n`, { flag: "a" });
    await gravarMetricas({
      workflow: "diario",
      resultado: "sucesso",
      duracaoTotalS: total(),
      etapasS: duracoes,
      contagens: meta.contagens,
      travaDisparou: false,
      mudou,
    });
  } catch (e) {
    await writeFile("relatorio-falha.md", relatorioFalha(e));
    await gravarMetricas({
      workflow: "diario",
      resultado: "falha",
      etapaFalha: e instanceof ErroEtapa ? e.etapa : "desconhecida",
      duracaoTotalS: total(),
      etapasS: e instanceof ErroEtapa ? e.duracoes : {},
      contagens: e instanceof ErroEtapa ? e.contagens : {},
      travaDisparou: e instanceof ErroEtapa && e.causa instanceof ErroTrava,
      mudou: null,
    });
    console.error(e);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void main();
