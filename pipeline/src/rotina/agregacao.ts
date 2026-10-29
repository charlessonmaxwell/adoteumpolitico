import type { Casa, Parlamentar } from "../modelo/parlamentar.js";
import type { Despesa } from "../modelo/despesa.js";
import type { Proposicao } from "../modelo/proposicao.js";
import type { Licenca, Presenca, ResumoPresencaCamara, Votacao, Voto } from "../modelo/votacao.js";

export interface Dados {
  parlamentares: Parlamentar[];
  despesas: Despesa[];
  proposicoes: Proposicao[];
  votacoes: Votacao[];
  votos: Voto[];
  presencasSenado: Presenca[];
  resumosPresencaCamara: ResumoPresencaCamara[];
  licencas: Licenca[];
}

const agrupar = <T>(lista: T[], chave: (x: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of lista) {
    const k = chave(x);
    const g = m.get(k);
    if (g) g.push(x);
    else m.set(k, [x]);
  }
  return m;
};

const somar = (valores: number[]) => Math.round(valores.reduce((a, b) => a + b, 0) * 100) / 100;
const contar = <T>(lista: T[], chave: (x: T) => string) => {
  const c: Record<string, number> = {};
  for (const x of lista) c[chave(x)] = (c[chave(x)] ?? 0) + 1;
  return c;
};
const VIROU_LEI = /norma jur[ií]dica/i;

export interface ResumoParlamentar {
  parlamentar: Parlamentar;
  gastos: {
    total: number;
    porAno: Record<string, number>;
    porCategoria: { categoria: string; total: number }[];
    quantidade: number;
    comNotaFiscal: number;
  };
  projetos: {
    legislativas: { autor: number; coautor: number; viraramLei: number };
    homenagens: number;
    procedimentais: number;
  };
  votacoes: {
    nominaisDaCasa: number;
    comRegistro: number;
    votos: Record<string, number>;
  };
  presenca:
    | { metrica: "sessao"; porAno: Omit<ResumoPresencaCamara, "idParlamentar">[] }
    | {
        metrica: "votacao";
        porAno: Record<string, Record<string, number>>;
        licencas: number;
      };
}

export function agregar(d: Dados) {
  const despesas = agrupar(d.despesas, (x) => x.idParlamentar);
  const proposicoes = agrupar(d.proposicoes, (x) => x.idParlamentar);
  const votos = agrupar(d.votos, (x) => x.idParlamentar);
  const presSenado = agrupar(d.presencasSenado, (x) => x.idParlamentar);
  const presCamara = agrupar(d.resumosPresencaCamara, (x) => x.idParlamentar);
  const licencas = agrupar(d.licencas, (x) => x.idParlamentar);
  const nominais = contar(
    d.votacoes.filter((v) => v.tipo !== "simbolica"),
    (v) => v.casa,
  );

  const resumos: ResumoParlamentar[] = d.parlamentares.map((p) => {
    const g = despesas.get(p.id) ?? [];
    const porCat = agrupar(g, (x) => x.categoria);
    const pr = proposicoes.get(p.id) ?? [];
    const leg = pr.filter((x) => x.categoria === "legislativa");
    const vt = votos.get(p.id) ?? [];
    return {
      parlamentar: p,
      gastos: {
        total: somar(g.map((x) => x.valor)),
        porAno: Object.fromEntries(
          [...agrupar(g, (x) => String(x.ano))].map(([a, l]) => [a, somar(l.map((x) => x.valor))]),
        ),
        porCategoria: [...porCat]
          .map(([categoria, l]) => ({ categoria, total: somar(l.map((x) => x.valor)) }))
          .sort((a, b) => b.total - a.total),
        quantidade: g.length,
        comNotaFiscal: g.filter((x) => x.urlDocumento).length,
      },
      projetos: {
        legislativas: {
          autor: leg.filter((x) => x.autoria === "autor").length,
          coautor: leg.filter((x) => x.autoria === "coautor").length,
          viraramLei: leg.filter((x) => VIROU_LEI.test(x.situacao ?? "")).length,
        },
        homenagens: pr.filter((x) => x.categoria === "homenagem").length,
        procedimentais: pr.filter((x) => x.categoria === "procedimental").length,
      },
      votacoes: {
        nominaisDaCasa: nominais[p.casa] ?? 0,
        comRegistro: vt.length,
        votos: contar(vt, (x) => x.voto),
      },
      presenca:
        p.casa === "camara"
          ? {
              metrica: "sessao" as const,
              porAno: (presCamara.get(p.id) ?? [])
                .map(({ idParlamentar: _, ...r }) => r)
                .sort((a, b) => a.ano - b.ano),
            }
          : {
              metrica: "votacao" as const,
              porAno: Object.fromEntries(
                [...agrupar(presSenado.get(p.id) ?? [], (x) => x.data.slice(0, 4))].map(
                  ([a, l]) => [a, contar(l, (x) => x.situacao)],
                ),
              ),
              licencas: (licencas.get(p.id) ?? []).length,
            },
    };
  });

  return { resumos, medias: medias(resumos) };
}

const media = (v: number[]) => (v.length ? Math.round((somar(v) / v.length) * 100) / 100 : null);

/** Médias por casa, para comparação no perfil ("acima/abaixo da média"). */
export function medias(resumos: ResumoParlamentar[]) {
  const porCasa = (casa: Casa) => {
    const r = resumos.filter((x) => x.parlamentar.casa === casa);
    const taxaPresenca = r
      .map((x) => {
        if (x.presenca.metrica === "sessao") {
          const dias = x.presenca.porAno.reduce((a, y) => a + (y.diasComSessao ?? 0), 0);
          const pres = x.presenca.porAno.reduce((a, y) => a + (y.diasPresente ?? 0), 0);
          return dias ? pres / dias : null;
        }
        const tot = Object.values(x.presenca.porAno).flatMap((c) => Object.values(c));
        const pres = Object.values(x.presenca.porAno).reduce((a, c) => a + (c.presente ?? 0), 0);
        const n = somar(tot);
        return n ? pres / n : null;
      })
      .filter((v): v is number => v !== null);
    return {
      parlamentares: r.length,
      gastoTotal: media(r.map((x) => x.gastos.total)),
      projetosLegislativosComoAutor: media(r.map((x) => x.projetos.legislativas.autor)),
      taxaPresenca: media(taxaPresenca),
    };
  };
  return { camara: porCasa("camara"), senado: porCasa("senado") };
}
