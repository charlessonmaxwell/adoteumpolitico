/**
 * Rotina quinzenal de emendas (dias 1 e 15). Lê a publicação atual (pasta da branch `data`),
 * baixa a base da CGU, liga autores, agrega e regrava só a pasta `emendas/`.
 * Uso: pnpm rotina:emendas <pasta-publicada>
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { coletarEmendas } from "../coleta/emendas.js";
import type { Emenda } from "../modelo/emenda.js";
import type { Parlamentar } from "../modelo/parlamentar.js";
import { gravarMetricas } from "../monitoramento/metricas.js";
import { ErroTrava, verificarQuedas } from "../rotina/trava.js";
import { ligarAutores, type DePara, type ResultadoLigacao } from "./ligacao.js";
import {
  favorecidosPorParlamentar,
  montarCidades,
  resumoRecebimentos,
  type Favorecido,
} from "./cidades.js";
import type { Recebimento, TipoFavorecido } from "../modelo/emenda.js";

const r2 = (n: number) => Math.round(n * 100) / 100;
type Valores = Emenda["valores"];
const zero = (): Valores => ({ empenhado: 0, liquidado: 0, pago: 0, restosPagos: 0 });
const somar = (a: Valores, b: Valores) => {
  for (const k of Object.keys(a) as (keyof Valores)[]) a[k] = r2(a[k] + b[k]);
  return a;
};
function agrupar<T>(lista: Emenda[], chave: (e: Emenda) => string, extra: (e: Emenda) => T) {
  const m = new Map<string, { valores: Valores; emendas: number } & T>();
  for (const e of lista) {
    const k = chave(e);
    const g = m.get(k) ?? { valores: zero(), emendas: 0, ...extra(e) };
    somar(g.valores, e.valores);
    g.emendas++;
    m.set(k, g);
  }
  return [...m.entries()].map(([chave, g]) => ({ chave, ...g }));
}
const porEmpenho = (a: { valores: Valores }, b: { valores: Valores }) =>
  b.valores.empenhado - a.valores.empenhado;

export interface EmendasDoParlamentar {
  /** Quem recebeu o dinheiro das emendas deste parlamentar (E2). */
  recebidos?: {
    total: number;
    porTipo: Partial<Record<TipoFavorecido, number>>;
    favorecidos: Favorecido[];
  };
  total: Valores;
  emendas: number;
  pix: { emendas: number; valores: Valores };
  porAno: Record<string, Valores>;
  porArea: { area: string; valores: Valores; emendas: number }[];
  destinos: {
    nome: string;
    uf: string | null;
    nivel: string;
    ibge: string | null;
    valores: Valores;
    emendas: number;
  }[];
  lista: {
    id: string;
    ano: number;
    pix: boolean;
    destino: string;
    area: string;
    subarea: string;
    valores: Valores;
  }[];
}

export function porParlamentar(emendas: Emenda[]): Map<string, EmendasDoParlamentar> {
  const grupos = new Map<string, Emenda[]>();
  for (const e of emendas)
    if (e.idParlamentar) {
      const l = grupos.get(e.idParlamentar);
      if (l) l.push(e);
      else grupos.set(e.idParlamentar, [e]);
    }
  const saida = new Map<string, EmendasDoParlamentar>();
  for (const [id, l] of grupos) {
    const porAno: Record<string, Valores> = {};
    for (const e of l) porAno[e.ano] = somar(porAno[e.ano] ?? zero(), e.valores);
    const pix = l.filter((e) => e.pix);
    saida.set(id, {
      total: l.reduce((a, e) => somar(a, e.valores), zero()),
      emendas: l.length,
      pix: { emendas: pix.length, valores: pix.reduce((a, e) => somar(a, e.valores), zero()) },
      porAno,
      porArea: agrupar(
        l,
        (e) => e.area || "Não informada",
        () => ({}),
      )
        .sort(porEmpenho)
        .map((g) => ({ area: g.chave, valores: g.valores, emendas: g.emendas })),
      destinos: agrupar(
        l,
        (e) => e.destino.ibge ?? e.destino.uf ?? e.destino.nome,
        (e) => ({
          nome: e.destino.nome,
          uf: e.destino.uf,
          nivel: e.destino.nivel,
          ibge: e.destino.ibge,
        }),
      )
        .sort(porEmpenho)
        .map(({ chave: _, ...g }) => g),
      lista: [...l]
        .sort((a, b) => b.ano - a.ano || b.valores.empenhado - a.valores.empenhado)
        .map((e) => ({
          id: e.id,
          ano: e.ano,
          pix: e.pix,
          destino:
            e.destino.uf && e.destino.nivel === "municipio"
              ? `${e.destino.nome} (${e.destino.uf})`
              : e.destino.nome,
          area: e.area,
          subarea: e.subarea,
          valores: e.valores,
        })),
    });
  }
  return saida;
}

export function resumoGeral(
  emendas: Emenda[],
  q: ResultadoLigacao["qualidade"],
  atualizadoEm: string,
) {
  const tipos = agrupar(
    emendas,
    (e) => (e.pix ? "individual-pix" : e.tipo),
    () => ({}),
  );
  return {
    atualizadoEm,
    anoInicial: Math.min(...emendas.map((e) => e.ano)),
    total: emendas.reduce((a, e) => somar(a, e.valores), zero()),
    porTipo: Object.fromEntries(
      tipos.map((t) => [t.chave, { valores: t.valores, emendas: t.emendas }]),
    ),
    porUf: agrupar(
      emendas.filter((e) => e.destino.uf),
      (e) => e.destino.uf!,
      () => ({}),
    )
      .map((g) => ({ uf: g.chave, valores: g.valores, emendas: g.emendas }))
      .sort((a, b) => a.uf.localeCompare(b.uf)),
    porArea: agrupar(
      emendas,
      (e) => e.area || "Não informada",
      () => ({}),
    )
      .sort(porEmpenho)
      .map((g) => ({ area: g.chave, valores: g.valores, emendas: g.emendas })),
    ligacao: {
      individuais: q.individuais,
      individuaisLigadas: q.individuaisLigadas,
      parlamentaresComEmenda: q.parlamentaresComEmenda,
    },
    contagens: {
      emendas: emendas.length,
      individuaisLigadas: q.individuaisLigadas,
      parlamentaresComEmenda: q.parlamentaresComEmenda,
    },
  };
}

const lerJson = async <T>(arq: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(arq, "utf8")) as T;
  } catch {
    return null;
  }
};

export async function executarEmendas(
  dir: string,
  o: {
    dados?: { emendas: Emenda[]; recebimentos: Recebimento[] };
    agora?: Date;
    ignorarTrava?: boolean;
  } = {},
) {
  const parlamentares = await lerJson<Parlamentar[]>(join(dir, "parlamentares.json"));
  if (!parlamentares?.length) throw new Error(`parlamentares.json ausente em ${dir}`);
  const depara = (await lerJson<DePara>("config/autores-emendas.json")) ?? {};
  const { emendas: brutas, recebimentos } = o.dados ?? (await coletarEmendas());
  const lig = ligarAutores(brutas, parlamentares, depara);
  const cid = montarCidades(lig.emendas, recebimentos, parlamentares);
  const rec = resumoRecebimentos(recebimentos);
  const base = resumoGeral(lig.emendas, lig.qualidade, (o.agora ?? new Date()).toISOString());
  const resumo = {
    ...base,
    recebidos: { total: rec.total, porTipo: rec.porTipo },
    cidades: cid.indice.length,
    contagens: { ...base.contagens, recebimentos: recebimentos.length, cidades: cid.indice.length },
  };

  const anterior = await lerJson<{ contagens: Record<string, number> }>(
    join(dir, "emendas", "resumo.json"),
  );
  const quedas = verificarQuedas(anterior?.contagens ?? null, resumo.contagens);
  if (quedas.length && !o.ignorarTrava) throw new ErroTrava(quedas);

  const pasta = join(dir, "emendas");
  await rm(pasta, { recursive: true, force: true });
  await mkdir(join(pasta, "parlamentar"), { recursive: true });
  await mkdir(join(pasta, "cidade"), { recursive: true });
  const favP = favorecidosPorParlamentar(lig.emendas, recebimentos);
  for (const [id, d] of porParlamentar(lig.emendas))
    await writeFile(
      join(pasta, "parlamentar", `${id}.json`),
      JSON.stringify({ ...d, recebidos: favP.get(id) }),
    );
  for (const [id, c] of cid.cidades)
    await writeFile(join(pasta, "cidade", `${id}.json`), JSON.stringify(c));
  await writeFile(join(pasta, "cidades.json"), JSON.stringify(cid.indice));
  await writeFile(join(pasta, "resumo.json"), JSON.stringify(resumo));
  await writeFile(
    join(pasta, "qualidade.json"),
    JSON.stringify(
      { ...lig.qualidade, recebimentosSemCidade: cid.semCidade, naturezas: rec.naturezas },
      null,
      1,
    ),
  );
  return { resumo, qualidade: lig.qualidade };
}

async function main() {
  const dir = process.argv[2] ?? "publicado";
  const inicio = Date.now();
  try {
    const { resumo, qualidade } = await executarEmendas(dir, {
      ignorarTrava: process.env.IGNORAR_TRAVA === "true",
    });
    const pct = qualidade.valorIndividual
      ? Math.round((qualidade.valorLigado / qualidade.valorIndividual) * 1000) / 10
      : 0;
    console.log(
      `Emendas: ${resumo.contagens.emendas} desde ${resumo.anoInicial}; individuais ligadas ${qualidade.individuaisLigadas}/${qualidade.individuais} (${pct}% do valor); ${qualidade.parlamentaresComEmenda} parlamentares atuais com emenda; ${qualidade.naoLigados.length} autores não ligados (ex-parlamentares ou a revisar); ${resumo.contagens.recebimentos} recebimentos, ${resumo.cidades} cidades.`,
    );
    await gravarMetricas({
      workflow: "emendas",
      resultado: "sucesso",
      duracaoTotalS: Math.round((Date.now() - inicio) / 1000),
      etapasS: {},
      contagens: resumo.contagens,
      travaDisparou: false,
      mudou: null,
      extras: { valor_ligado_pct: pct },
    });
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    await gravarMetricas({
      workflow: "emendas",
      resultado: "falha",
      etapaFalha: "emendas",
      duracaoTotalS: Math.round((Date.now() - inicio) / 1000),
      etapasS: {},
      contagens: {},
      travaDisparou: e instanceof ErroTrava,
      mudou: null,
    });
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void main();
