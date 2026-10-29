import type { Casa } from "../modelo/parlamentar.js";
import type { Despesa } from "../modelo/despesa.js";
import type { Proposicao } from "../modelo/proposicao.js";
import type { Votacao, Voto } from "../modelo/votacao.js";
import type { ResumoParlamentar } from "./agregacao.js";

/**
 * Panorama: só números gerais (decisão do produto: sem lista ordenada de parlamentares).
 * Partidos e estados aparecem em ordem alfabética; empresas e projetos podem ser ordenados
 * por valor porque não são parlamentares.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const soma = (v: number[]) => r2(v.reduce((a, b) => a + b, 0));
const media = (v: number[]) => (v.length ? r2(soma(v) / v.length) : null);
const mediana = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return r2(s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2);
};
const encurtar = (t: string, n: number) =>
  t.length <= n ? t : `${t.slice(0, t.lastIndexOf(" ", n))}…`;
const VIROU_LEI = /norma jur[ií]dica/i;

/** Taxa de presença (0–1) do resumo: dias na Câmara, votações no Senado. */
export function taxaPresenca(r: ResumoParlamentar): number | null {
  if (r.presenca.metrica === "sessao") {
    const dias = r.presenca.porAno.reduce((a, y) => a + (y.diasComSessao ?? 0), 0);
    const pres = r.presenca.porAno.reduce((a, y) => a + (y.diasPresente ?? 0), 0);
    return dias ? pres / dias : null;
  }
  const cont = Object.values(r.presenca.porAno);
  const total = cont.flatMap((c) => Object.values(c)).reduce((a, b) => a + b, 0);
  const pres = cont.reduce((a, c) => a + (c.presente ?? 0), 0);
  return total ? pres / total : null;
}

/** Faixas fixas (sempre as mesmas, para comparar ao longo do tempo). */
const FAIXAS_PRESENCA = [
  { rotulo: "90% ou mais", min: 0.9, max: 1.01 },
  { rotulo: "75% a 89%", min: 0.75, max: 0.9 },
  { rotulo: "50% a 74%", min: 0.5, max: 0.75 },
  { rotulo: "Menos de 50%", min: 0, max: 0.5 },
];

interface Grupo {
  nome: string;
  parlamentares: number;
  gastoMedio: number | null;
  presencaMedia: number | null;
  projetosMedio: number | null;
}

function porGrupo(r: ResumoParlamentar[], chave: (x: ResumoParlamentar) => string): Grupo[] {
  const m = new Map<string, ResumoParlamentar[]>();
  for (const x of r) m.set(chave(x), [...(m.get(chave(x)) ?? []), x]);
  return [...m]
    .map(([nome, l]) => ({
      nome,
      parlamentares: l.length,
      gastoMedio: media(l.map((x) => x.gastos.total)),
      presencaMedia: media(l.map(taxaPresenca).filter((v): v is number => v !== null)),
      projetosMedio: media(l.map((x) => x.projetos.legislativas.autor)),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface PanoramaCasa {
  parlamentares: number;
  gastos: {
    total: number;
    porAno: Record<string, number>;
    mediaPorParlamentar: number | null;
    medianaPorParlamentar: number | null;
    porCategoria: { categoria: string; total: number }[];
    empresas: { nome: string; cnpj: string; total: number }[];
    notas: number;
  };
  presenca: {
    metrica: "sessao" | "votacao";
    media: number | null;
    faixas: { rotulo: string; parlamentares: number }[];
  };
  projetos: {
    apresentados: number;
    viraramLei: number;
    homenagens: number;
    procedimentais: number;
    parlamentaresComLei: number;
  };
  votacoes: {
    nominais: number;
    aprovadas: number;
    rejeitadas: number;
    votos: Record<string, number>;
    apertadas: {
      idProposicao: string;
      titulo: string;
      ementa: string;
      data: string;
      sim: number;
      nao: number;
    }[];
  };
  porPartido: Grupo[];
  porEstado: Grupo[];
}

export interface Panorama {
  camara: PanoramaCasa;
  senado: PanoramaCasa;
}

export function montarPanorama(d: {
  resumos: ResumoParlamentar[];
  despesas: Despesa[];
  proposicoes: Proposicao[];
  votacoes: Votacao[];
  votos: Voto[];
}): Panorama {
  const casa = (c: Casa): PanoramaCasa => {
    const r = d.resumos.filter((x) => x.parlamentar.casa === c);
    const atuais = new Set(r.map((x) => x.parlamentar.id));
    const desp = d.despesas.filter((x) => x.casa === c && atuais.has(x.idParlamentar));

    const porAno: Record<string, number> = {};
    const porCat = new Map<string, number>();
    const empresas = new Map<string, { nome: string; total: number }>();
    for (const x of desp) {
      porAno[x.ano] = (porAno[x.ano] ?? 0) + x.valor;
      porCat.set(x.categoria, (porCat.get(x.categoria) ?? 0) + x.valor);
      if (x.cnpjFornecedor) {
        const e = empresas.get(x.cnpjFornecedor) ?? { nome: x.fornecedor, total: 0 };
        e.total += x.valor;
        empresas.set(x.cnpjFornecedor, e);
      }
    }

    const taxas = r.map(taxaPresenca).filter((v): v is number => v !== null);

    // Projetos distintos (a mesma proposição aparece uma vez por autor)
    const props = d.proposicoes.filter((x) => x.casa === c && atuais.has(x.idParlamentar));
    const distintos = new Map(props.map((x) => [x.id, x]));
    const leg = [...distintos.values()].filter((x) => x.categoria === "legislativa");

    const nominais = d.votacoes.filter((v) => v.casa === c && v.tipo !== "simbolica");
    const idsNominais = new Set(nominais.map((v) => v.id));
    const votos: Record<string, number> = {};
    const placar = new Map<string, { sim: number; nao: number }>();
    for (const v of d.votos) {
      if (!idsNominais.has(v.idVotacao)) continue;
      votos[v.voto] = (votos[v.voto] ?? 0) + 1;
      const p = placar.get(v.idVotacao) ?? { sim: 0, nao: 0 };
      if (v.voto === "sim") p.sim++;
      if (v.voto === "nao") p.nao++;
      placar.set(v.idVotacao, p);
    }
    const apertadas = nominais
      .filter((v) => v.categoria === "principal" && v.idProposicao && v.projeto)
      .map((v) => ({ v, p: placar.get(v.id) ?? { sim: 0, nao: 0 } }))
      .filter(({ p }) => p.sim + p.nao >= (c === "camara" ? 200 : 40))
      .sort((a, b) => Math.abs(a.p.sim - a.p.nao) - Math.abs(b.p.sim - b.p.nao))
      .filter(({ v }, i, l) => l.findIndex((o) => o.v.idProposicao === v.idProposicao) === i)
      .slice(0, 5)
      .map(({ v, p }) => ({
        idProposicao: v.idProposicao!,
        titulo: v.projeto!.titulo,
        ementa: encurtar(v.projeto!.ementa.split("NOVA EMENTA:").pop()!.trim(), 220),
        data: v.data,
        sim: p.sim,
        nao: p.nao,
      }));

    return {
      parlamentares: r.length,
      gastos: {
        total: soma(desp.map((x) => x.valor)),
        porAno: Object.fromEntries(Object.entries(porAno).map(([a, v]) => [a, r2(v)])),
        mediaPorParlamentar: media(r.map((x) => x.gastos.total)),
        medianaPorParlamentar: mediana(r.map((x) => x.gastos.total)),
        porCategoria: [...porCat]
          .map(([categoria, total]) => ({ categoria, total: r2(total) }))
          .sort((a, b) => b.total - a.total),
        empresas: [...empresas]
          .map(([cnpj, e]) => ({ cnpj, nome: e.nome, total: r2(e.total) }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10),
        notas: desp.length,
      },
      presenca: {
        metrica: c === "camara" ? "sessao" : "votacao",
        media: media(taxas),
        faixas: FAIXAS_PRESENCA.map((f) => ({
          rotulo: f.rotulo,
          parlamentares: taxas.filter((t) => t >= f.min && t < f.max).length,
        })),
      },
      projetos: {
        apresentados: leg.length,
        viraramLei: leg.filter((x) => VIROU_LEI.test(x.situacao ?? "")).length,
        homenagens: [...distintos.values()].filter((x) => x.categoria === "homenagem").length,
        procedimentais: [...distintos.values()].filter((x) => x.categoria === "procedimental")
          .length,
        parlamentaresComLei: r.filter((x) => x.projetos.legislativas.viraramLei > 0).length,
      },
      votacoes: {
        nominais: nominais.length,
        aprovadas: nominais.filter((v) => v.resultado === "aprovada").length,
        rejeitadas: nominais.filter((v) => v.resultado === "rejeitada").length,
        votos,
        apertadas,
      },
      porPartido: porGrupo(r, (x) => x.parlamentar.partido),
      porEstado: porGrupo(r, (x) => x.parlamentar.uf),
    };
  };
  return {
    camara: casa("camara"),
    senado: casa("senado"),
  };
}
