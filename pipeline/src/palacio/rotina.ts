/**
 * Story 7.1 — Cartão corporativo do Palácio (Presidente e família; Vice).
 * Rotina mensal: baixa do Portal da Transparência os meses que faltam (e revisa os 3 últimos),
 * soma por ficha, corrige pelo IPCA e regrava só a pasta `palacio/` da publicação.
 * Nunca lê nem guarda CPF ou nome de portador: só unidade, transação e valor.
 * Uso: pnpm rotina:palacio <pasta-publicada>
 */
import { unzipSync } from "fflate";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { percorrerCsv, valorBr } from "../coleta/emendas.js";
import { ErroHttp, getBytes, getJson, type OpcoesHttp } from "../util/http.js";
import { gravarMetricas } from "../monitoramento/metricas.js";
import { ErroTrava, verificarQuedas } from "../rotina/trava.js";

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const URL_CPGF = (mes: string) =>
  `https://portaldatransparencia.gov.br/download-de-dados/cpgf/${mes}`;
/** IPCA número-índice (dez/1993 = 100), IBGE/SIDRA tabela 1737, variável 2266. */
export const URL_IPCA = "https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2266/p/all";
/** Unidade fora da lista sob a Presidência com valor acima disto no mês trava a publicação. */
export const LIMITE_UG_NOVA = 10_000;
/** Meses mais recentes refeitos a cada rodada (o Portal revisa lançamentos). */
export const MESES_REVISAO = 3;

export type IdFicha = "presidente" | "vice";
export interface Config {
  inicio: string;
  fichas: Record<IdFicha, { nome: string; unidades: Record<string, string> }>;
  excluidas: Record<string, string>;
  governos: { nome: string; de: string; ate: string }[];
}
export interface Soma {
  total: number;
  sigiloso: number;
  transacoes: number;
}
export type Mes = Record<IdFicha, Soma>;

const r2 = (n: number) => Math.round(n * 100) / 100;
const vazio = (): Soma => ({ total: 0, sigiloso: 0, transacoes: 0 });
const FICHAS: IdFicha[] = ["presidente", "vice"];

export class ErroUnidadeNova extends Error {
  constructor(
    public readonly unidades: { mes: string; codigo: string; nome: string; valor: number }[],
  ) {
    super(
      `Unidade(s) nova(s) sob a Presidência, sem classificação em config/palacio.json: ` +
        unidades
          .map((u) => `${u.codigo} ${u.nome} (${u.mes}, R$ ${u.valor.toFixed(2)})`)
          .join("; "),
    );
  }
}

/** Soma um CSV mensal por ficha. Devolve também unidades desconhecidas sob a Presidência. */
export function somarMes(csv: string, cfg: Config) {
  const fichaDe = new Map<string, IdFicha>();
  for (const f of FICHAS) for (const c of Object.keys(cfg.fichas[f].unidades)) fichaDe.set(c, f);
  const mes: Mes = { presidente: vazio(), vice: vazio() };
  const novas = new Map<string, { nome: string; valor: number }>();
  percorrerCsv(csv, (r) => {
    const ug = r["CÓDIGO UNIDADE GESTORA"] ?? "";
    const valor = valorBr(r["VALOR TRANSAÇÃO"]);
    const f = fichaDe.get(ug);
    if (f) {
      const s = mes[f];
      s.total = r2(s.total + valor);
      s.transacoes++;
      const sig =
        /sigilo/i.test(r["TRANSAÇÃO"] ?? "") || /^sigiloso$/i.test(r["NOME FAVORECIDO"] ?? "");
      if (sig) s.sigiloso = r2(s.sigiloso + valor);
      return;
    }
    if (cfg.excluidas[ug]) return;
    const daPresidencia = /presid/i.test(`${r["NOME ÓRGÃO SUPERIOR"]} ${r["NOME ÓRGÃO"]}`);
    if (!daPresidencia) return;
    const n = novas.get(ug) ?? { nome: r["NOME UNIDADE GESTORA"] ?? "", valor: 0 };
    n.valor = r2(n.valor + valor);
    novas.set(ug, n);
  });
  return {
    mes,
    novas: [...novas.entries()]
      .filter(([, n]) => n.valor > LIMITE_UG_NOVA)
      .map(([codigo, n]) => ({ codigo, ...n })),
  };
}

/** Meses AAAAMM de `de` até `ate`, inclusive. */
export function mesesEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  let a = Number(de.slice(0, 4));
  let m = Number(de.slice(4));
  while (`${a}${String(m).padStart(2, "0")}` <= ate) {
    out.push(`${a}${String(m).padStart(2, "0")}`);
    if (++m > 12) {
      m = 1;
      a++;
    }
  }
  return out;
}

/** Mês anterior ao de `agora`, em AAAAMM (o mês corrente nunca está fechado). */
export function ultimoMesFechado(agora: Date): string {
  const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function governoDe(mes: string, cfg: Config): string | null {
  return cfg.governos.find((g) => mes >= g.de && mes <= g.ate)?.nome ?? null;
}

/** Fator para trazer valores do mês ao mês-base. Mês sem índice ainda usa o último índice. */
export function fatorIpca(ipca: Record<string, number>, mes: string, base: string): number {
  const ib = ipca[base];
  const meses = Object.keys(ipca).sort();
  const im = ipca[mes] ?? ipca[meses[meses.length - 1]!];
  if (!ib || !im) throw new Error(`IPCA sem índice para ${mes} ou ${base}`);
  return ib / im;
}

export function montarResumo(
  meses: Record<string, Mes>,
  ipca: Record<string, number>,
  cfg: Config,
  atualizadoEm: string,
) {
  const lista = Object.keys(meses).sort();
  const base = Object.keys(ipca).sort().pop()!;
  const ficha = (f: IdFicha) => {
    const porAno: Record<string, Soma> = {};
    const porGoverno = new Map<
      string,
      { total: number; corrigido: number; meses: number; de: string; ate: string }
    >();
    for (const m of lista) {
      const s = meses[m]![f];
      const a = (porAno[m.slice(0, 4)] ??= vazio());
      a.total = r2(a.total + s.total);
      a.sigiloso = r2(a.sigiloso + s.sigiloso);
      a.transacoes += s.transacoes;
      const g = governoDe(m, cfg);
      if (!g) throw new Error(`Mês ${m} sem governo em config/palacio.json`);
      const x = porGoverno.get(g) ?? { total: 0, corrigido: 0, meses: 0, de: m, ate: m };
      x.total = r2(x.total + s.total);
      x.corrigido = r2(x.corrigido + s.total * fatorIpca(ipca, m, base));
      x.meses++;
      x.ate = m;
      porGoverno.set(g, x);
    }
    const tot = Object.values(porAno).reduce(
      (t, s) => ({
        total: r2(t.total + s.total),
        sigiloso: r2(t.sigiloso + s.sigiloso),
        transacoes: t.transacoes + s.transacoes,
      }),
      vazio(),
    );
    return {
      nome: cfg.fichas[f].nome,
      unidades: cfg.fichas[f].unidades,
      total: tot,
      porAno,
      porMes: Object.fromEntries(lista.map((m) => [m, meses[m]![f]])),
      porGoverno: [...porGoverno.entries()].map(([nome, g]) => ({
        nome,
        ...g,
        mediaMensalCorrigida: r2(g.corrigido / g.meses),
      })),
    };
  };
  return {
    atualizadoEm,
    primeiroMes: lista[0],
    ultimoMes: lista[lista.length - 1],
    ipcaBase: base,
    excluidas: cfg.excluidas,
    presidente: ficha("presidente"),
    vice: ficha("vice"),
    contagens: { meses: lista.length },
  };
}
export type ResumoPalacio = ReturnType<typeof montarResumo>;

export async function lerIpca(opcoes: OpcoesHttp = {}): Promise<Record<string, number>> {
  const linhas = await getJson<{ D3C: string; V: string }[]>(URL_IPCA, opcoes);
  const out: Record<string, number> = {};
  for (const l of linhas.slice(1)) {
    const v = Number(l.V);
    if (/^\d{6}$/.test(l.D3C) && Number.isFinite(v) && v > 0) out[l.D3C] = v;
  }
  if (Object.keys(out).length < 100) throw new Error("IPCA do IBGE veio incompleto");
  return out;
}

/** Status de bloqueio temporário do Portal (excesso de downloads). */
export const BLOQUEIO = new Set([403, 405]);
export const ESPERA_BLOQUEIO_MS = 60_000;

/** CSV do mês, ou null se o Portal ainda não publicou (404 ou arquivo que não é zip). */
export async function baixarMes(mes: string, opcoes: OpcoesHttp = {}): Promise<string | null> {
  let bytes: Uint8Array | null = null;
  // O Portal responde 403/405 quando recebe muitos downloads seguidos: espera e tenta de novo.
  for (let i = 0; i < 4 && !bytes; i++) {
    try {
      bytes = await getBytes(URL_CPGF(mes), { tentativas: 3, esperaInicialMs: 3000, ...opcoes });
    } catch (e) {
      if (e instanceof ErroHttp && e.status === 404) return null;
      if (!(e instanceof ErroHttp && BLOQUEIO.has(e.status)) || i === 3) throw e;
      await (opcoes.dormir ?? dormir)(ESPERA_BLOQUEIO_MS * (i + 1));
    }
  }
  if (!bytes) return null;
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return null; // não é zip
  const arq = Object.values(unzipSync(bytes, { filter: (f) => f.name.endsWith(".csv") }))[0];
  return arq ? new TextDecoder("latin1").decode(arq) : null;
}

const lerJson = async <T>(arq: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(arq, "utf8")) as T;
  } catch {
    return null;
  }
};

export async function executarPalacio(
  dir: string,
  o: {
    cfg?: Config;
    baixar?: (mes: string) => Promise<string | null>;
    ipca?: Record<string, number>;
    agora?: Date;
    ignorarTrava?: boolean;
    pausaMs?: number;
  } = {},
) {
  const cfg = o.cfg ?? ((await lerJson<Config>("config/palacio.json")) as Config);
  const agora = o.agora ?? new Date();
  const pasta = join(dir, "palacio");
  const anterior = (await lerJson<Record<string, Mes>>(join(pasta, "meses.json"))) ?? {};
  const resumoAnt = await lerJson<{ contagens: Record<string, number> }>(
    join(pasta, "resumo.json"),
  );
  const todos = mesesEntre(cfg.inicio, ultimoMesFechado(agora));
  const revisar = new Set(todos.slice(-MESES_REVISAO));
  const meses: Record<string, Mes> = { ...anterior };
  const novas: ErroUnidadeNova["unidades"] = [];
  const baixar = o.baixar ?? ((m: string) => baixarMes(m));
  let baixados = 0;
  for (const m of todos) {
    if (meses[m] && !revisar.has(m)) continue;
    const csv = await baixar(m);
    if (csv === null) {
      // Só os meses mais recentes podem ainda não ter saído
      if (revisar.has(m)) continue;
      throw new Error(`Portal sem arquivo do cartão corporativo para ${m}`);
    }
    const r = somarMes(csv, cfg);
    novas.push(...r.novas.map((n) => ({ mes: m, ...n })));
    meses[m] = r.mes;
    baixados++;
    if (o.pausaMs ?? 3000) await dormir(o.pausaMs ?? 3000);
  }
  if (novas.length && !o.ignorarTrava) throw new ErroUnidadeNova(novas);

  const ipca = o.ipca ?? (await lerIpca());
  const resumo = montarResumo(meses, ipca, cfg, agora.toISOString());
  const quedas = verificarQuedas(resumoAnt?.contagens ?? null, resumo.contagens);
  if (quedas.length && !o.ignorarTrava) throw new ErroTrava(quedas);

  await mkdir(pasta, { recursive: true });
  const ordenado = Object.fromEntries(
    Object.keys(meses)
      .sort()
      .map((k) => [k, meses[k]]),
  );
  await writeFile(join(pasta, "meses.json"), JSON.stringify(ordenado));
  await writeFile(join(pasta, "resumo.json"), JSON.stringify(resumo));
  return { resumo, baixados, novas };
}

async function main() {
  const dir = process.argv[2] ?? "publicado";
  const inicio = Date.now();
  try {
    const { resumo, baixados } = await executarPalacio(dir, {
      ignorarTrava: process.env.IGNORAR_TRAVA === "true",
    });
    const p = resumo.presidente.total;
    console.log(
      `Palácio: ${resumo.contagens.meses} meses (${resumo.primeiroMes}–${resumo.ultimoMes}), ${baixados} baixados; ` +
        `presidente R$ ${p.total.toFixed(2)} (${Math.round((p.sigiloso / (p.total || 1)) * 100)}% sigiloso); IPCA base ${resumo.ipcaBase}.`,
    );
    await gravarMetricas({
      workflow: "palacio",
      resultado: "sucesso",
      duracaoTotalS: Math.round((Date.now() - inicio) / 1000),
      etapasS: {},
      contagens: resumo.contagens,
      travaDisparou: false,
      mudou: null,
    });
  } catch (e) {
    console.error(`::error::${e instanceof Error ? e.message : String(e)}`);
    await gravarMetricas({
      workflow: "palacio",
      resultado: "falha",
      etapaFalha: "palacio",
      duracaoTotalS: Math.round((Date.now() - inicio) / 1000),
      etapasS: {},
      contagens: {},
      travaDisparou: e instanceof ErroTrava || e instanceof ErroUnidadeNova,
      mudou: null,
    });
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void main();
