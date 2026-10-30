import type { Emenda, Recebimento, TipoFavorecido } from "../modelo/emenda.js";
import type { Parlamentar } from "../modelo/parlamentar.js";

const r2 = (n: number) => Math.round(n * 100) / 100;
type V = Emenda["valores"];
const zero = (): V => ({ empenhado: 0, liquidado: 0, pago: 0, restosPagos: 0 });
const somar = (a: V, b: V) => {
  for (const k of Object.keys(a) as (keyof V)[]) a[k] = r2(a[k] + b[k]);
  return a;
};
const chaveNome = (uf: string | null, nome: string) =>
  `${uf ?? ""}|${nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")}`;

export interface Favorecido {
  cnpj: string;
  nome: string;
  tipo: TipoFavorecido;
  municipio: string;
  uf: string | null;
  valor: number;
}

/** Soma o que cada favorecido recebeu (por CNPJ) e devolve os maiores. Favorecido não é parlamentar. */
function favorecidosDe(lista: Recebimento[], limite: number): Favorecido[] {
  const m = new Map<string, Favorecido>();
  for (const x of lista) {
    const f = m.get(x.cnpj) ?? {
      cnpj: x.cnpj,
      nome: x.nome,
      tipo: x.tipo,
      municipio: x.municipio,
      uf: x.uf,
      valor: 0,
    };
    f.valor = r2(f.valor + x.valor);
    m.set(x.cnpj, f);
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor).slice(0, limite);
}

const porTipo = (lista: Recebimento[]) => {
  const t: Partial<Record<TipoFavorecido, number>> = {};
  for (const x of lista) t[x.tipo] = r2((t[x.tipo] ?? 0) + x.valor);
  return t;
};

export interface CidadeEmendas {
  ibge: string;
  nome: string;
  uf: string;
  /** Emendas cujo destino oficial é a cidade. */
  destinadas: {
    valores: V;
    emendas: number;
    pix: { emendas: number; valores: V };
    porTipo: Record<string, { valores: V; emendas: number }>;
    /** Em ordem alfabética (sem ranking de parlamentares). */
    autores: {
      idParlamentar: string | null;
      nome: string;
      tipo: string;
      valores: V;
      emendas: number;
    }[];
    porArea: { area: string; valores: V }[];
  };
  /** Quem recebeu dinheiro de emenda com endereço na cidade. */
  recebidos: {
    total: number;
    porTipo: Partial<Record<TipoFavorecido, number>>;
    favorecidos: Favorecido[];
  };
}

export function montarCidades(
  emendas: Emenda[],
  recebimentos: Recebimento[],
  parlamentares: Parlamentar[],
) {
  const nomes = new Map(parlamentares.map((p) => [p.id, p.nome]));
  const cidades = new Map<string, CidadeEmendas>();
  const porNome = new Map<string, string>();
  const nova = (ibge: string, nome: string, uf: string): CidadeEmendas => ({
    ibge,
    nome,
    uf,
    destinadas: {
      valores: zero(),
      emendas: 0,
      pix: { emendas: 0, valores: zero() },
      porTipo: {},
      autores: [],
      porArea: [],
    },
    recebidos: { total: 0, porTipo: {}, favorecidos: [] },
  });

  const autores = new Map<string, Map<string, CidadeEmendas["destinadas"]["autores"][number]>>();
  const areas = new Map<string, Map<string, V>>();
  for (const e of emendas) {
    if (e.destino.nivel !== "municipio" || !e.destino.ibge || !e.destino.uf) continue;
    const c = cidades.get(e.destino.ibge) ?? nova(e.destino.ibge, e.destino.nome, e.destino.uf);
    cidades.set(c.ibge, c);
    porNome.set(chaveNome(c.uf, c.nome), c.ibge);
    const d = c.destinadas;
    somar(d.valores, e.valores);
    d.emendas++;
    if (e.pix) {
      d.pix.emendas++;
      somar(d.pix.valores, e.valores);
    }
    const t = e.pix ? "individual-pix" : e.tipo;
    d.porTipo[t] ??= { valores: zero(), emendas: 0 };
    somar(d.porTipo[t]!.valores, e.valores);
    d.porTipo[t]!.emendas++;
    const nome = e.idParlamentar ? (nomes.get(e.idParlamentar) ?? e.autorTexto) : e.autorTexto;
    const ka = `${e.idParlamentar ?? e.codigoAutor}`;
    const mA = autores.get(c.ibge) ?? new Map();
    const a = mA.get(ka) ?? {
      idParlamentar: e.idParlamentar,
      nome,
      tipo: e.tipo,
      valores: zero(),
      emendas: 0,
    };
    somar(a.valores, e.valores);
    a.emendas++;
    mA.set(ka, a);
    autores.set(c.ibge, mA);
    const mArea = areas.get(c.ibge) ?? new Map<string, V>();
    mArea.set(e.area, somar(mArea.get(e.area) ?? zero(), e.valores));
    areas.set(c.ibge, mArea);
  }
  for (const c of cidades.values()) {
    c.destinadas.autores = [...(autores.get(c.ibge)?.values() ?? [])].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
    c.destinadas.porArea = [...(areas.get(c.ibge) ?? [])]
      .map(([area, valores]) => ({ area, valores }))
      .sort((a, b) => b.valores.empenhado - a.valores.empenhado);
  }

  // Recebimentos: ligados à cidade pelo endereço do favorecido (nome + UF → IBGE)
  const recPorCidade = new Map<string, Recebimento[]>();
  let semCidade = 0;
  for (const x of recebimentos) {
    const ibge = porNome.get(chaveNome(x.uf, x.municipio));
    if (!ibge) {
      semCidade++;
      continue;
    }
    const l = recPorCidade.get(ibge);
    if (l) l.push(x);
    else recPorCidade.set(ibge, [x]);
  }
  for (const [ibge, l] of recPorCidade) {
    const c = cidades.get(ibge)!;
    c.recebidos = {
      total: r2(l.reduce((a, x) => a + x.valor, 0)),
      porTipo: porTipo(l),
      favorecidos: favorecidosDe(l, 20),
    };
  }

  const indice = [...cidades.values()]
    .map((c) => ({
      ibge: c.ibge,
      nome: c.nome,
      uf: c.uf,
      empenhado: c.destinadas.valores.empenhado,
    }))
    .sort((a, b) => a.uf.localeCompare(b.uf) || a.nome.localeCompare(b.nome, "pt-BR"));
  return { cidades, indice, semCidade };
}

/** Maiores favorecidos das emendas de cada parlamentar. */
export function favorecidosPorParlamentar(emendas: Emenda[], recebimentos: Recebimento[]) {
  const dono = new Map(emendas.filter((e) => e.idParlamentar).map((e) => [e.id, e.idParlamentar!]));
  const grupos = new Map<string, Recebimento[]>();
  for (const x of recebimentos) {
    const id = dono.get(x.idEmenda);
    if (!id) continue;
    const l = grupos.get(id);
    if (l) l.push(x);
    else grupos.set(id, [x]);
  }
  return new Map(
    [...grupos].map(([id, l]) => [
      id,
      {
        total: r2(l.reduce((a, x) => a + x.valor, 0)),
        porTipo: porTipo(l),
        favorecidos: favorecidosDe(l, 10),
      },
    ]),
  );
}

/** Totais gerais por tipo de favorecido e naturezas jurídicas vistas (para revisar o classificador). */
export function resumoRecebimentos(recebimentos: Recebimento[]) {
  const naturezas = new Map<string, { tipo: TipoFavorecido; valor: number }>();
  for (const x of recebimentos) {
    const n = naturezas.get(x.natureza) ?? { tipo: x.tipo, valor: 0 };
    n.valor = r2(n.valor + x.valor);
    naturezas.set(x.natureza, n);
  }
  return {
    total: r2(recebimentos.reduce((a, x) => a + x.valor, 0)),
    porTipo: porTipo(recebimentos),
    naturezas: [...naturezas]
      .map(([natureza, v]) => ({ natureza, ...v }))
      .sort((a, b) => b.valor - a.valor),
  };
}
