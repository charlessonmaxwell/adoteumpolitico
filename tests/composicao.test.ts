import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contarGenero, montarComposicao } from "../pipeline/src/rotina/composicao.js";
import { coletarDeputadas, coletarSenadoras } from "../pipeline/src/coleta/composicao.js";
import {
  fimLegislatura,
  inicioLegislatura,
  legislaturaNaData,
  legislaturaVigente,
} from "../pipeline/src/modelo/legislatura.js";
import { legislaturasAte } from "../pipeline/src/coleta/legislaturas.js";
import { periodoMandato } from "../pipeline/src/coleta/senado.js";
import { executarRotina, type Coletores } from "../pipeline/src/rotina/index.js";
import type { Parlamentar } from "../pipeline/src/modelo/parlamentar.js";
import type { Fetcher } from "../pipeline/src/util/http.js";

const parl = (casa: "camara" | "senado", id: number, partido = "X", leg = 57): Parlamentar => ({
  id: `${casa}-${id}`,
  casa,
  idOrigem: String(id),
  nome: `P${id}`,
  partido,
  uf: "SE",
  urlFoto: null,
  idLegislatura: leg,
  urlFonte: "",
  coletadoEm: new Date().toISOString(),
});

const json = (corpo: unknown) =>
  new Response(JSON.stringify(corpo), { headers: { "Content-Type": "application/json" } });

describe("Story 9.2 — calendário das legislaturas", () => {
  it("57ª vai de 01/02/2023 a 31/01/2027; a 58ª começa em 01/02/2027", () => {
    expect(inicioLegislatura(57)).toBe("2023-02-01");
    expect(fimLegislatura(57)).toBe("2027-01-31");
    expect(inicioLegislatura(58)).toBe("2027-02-01");
    expect(legislaturaNaData(new Date("2026-11-25T12:00:00Z"))).toBe(57);
    expect(legislaturaNaData(new Date("2027-01-31T12:00:00Z"))).toBe(57);
    expect(legislaturaNaData(new Date("2027-02-01T12:00:00Z"))).toBe(58);
  });

  it("lista de legislaturas das emendas começa na 56ª e inclui a 58ª depois da virada", () => {
    expect(legislaturasAte(57)).toEqual([56, 57]);
    expect(legislaturasAte(58)).toEqual([56, 57, 58]);
  });

  it("legislatura vigente é a dos deputados", () => {
    expect(legislaturaVigente([parl("camara", 1, "X", 58), parl("senado", 2, "X", 57)])).toBe(58);
  });

  it("mandato do senador: do início da 1ª ao fim da 2ª legislatura", () => {
    expect(
      periodoMandato({
        PrimeiraLegislaturaDoMandato: { NumeroLegislatura: "57" },
        SegundaLegislaturaDoMandato: { NumeroLegislatura: "58" },
      }),
    ).toEqual({ inicio: "2023-02-01", fim: "2031-01-31" });
    expect(periodoMandato(undefined)).toBeUndefined();
  });
});

describe("Story 9.1 — quem ocupa as cadeiras", () => {
  it("partidos em ordem alfabética e gênero só em totais (CA1, CA3)", () => {
    const ps = [parl("camara", 1, "PT"), parl("camara", 2, "MDB"), parl("camara", 3, "PT")];
    const c = montarComposicao(ps, { camara: new Set(["camara-2"]), senado: null }, 57);
    expect(c.camara.partidos).toEqual([
      { nome: "MDB", parlamentares: 1 },
      { nome: "PT", parlamentares: 2 },
    ]);
    expect(c.camara.genero).toEqual({ mulheres: 1, homens: 2 });
    expect(c.senado).toEqual({ total: 0, partidos: [], genero: null });
    expect(JSON.stringify(c)).not.toContain("camara-2");
    expect(c).toMatchObject({ legislatura: 57, inicio: "2023-02-01", fim: "2027-01-31" });
  });

  it("CA2: sem dado, zero ou mais da metade = indisponível (não mostra número errado)", () => {
    const ids = ["a", "b", "c", "d"];
    expect(contarGenero(ids, null)).toBeNull();
    expect(contarGenero(ids, new Set())).toBeNull();
    expect(contarGenero(ids, new Set(["a", "b", "c"]))).toBeNull();
    expect(contarGenero(ids, new Set(["a", "x"]))).toEqual({ mulheres: 1, homens: 3 });
  });

  it("coleta: Câmara pelo filtro siglaSexo=F, com paginação", async () => {
    const chamadas: string[] = [];
    const fetcher: Fetcher = async (url) => {
      chamadas.push(url);
      const pagina = Number(new URL(url).searchParams.get("pagina"));
      const n = pagina === 1 ? 100 : 3;
      return json({ dados: Array.from({ length: n }, (_, i) => ({ id: pagina * 1000 + i })) });
    };
    const ids = await coletarDeputadas({ fetcher, tentativas: 1 });
    expect(ids.size).toBe(103);
    expect(chamadas[0]).toContain("siglaSexo=F");
  });

  it("coleta: Senado pelo SexoParlamentar; sem o campo, devolve null", async () => {
    const lista = (com: boolean) => async () =>
      json({
        ListaParlamentarEmExercicio: {
          Parlamentares: {
            Parlamentar: [
              {
                IdentificacaoParlamentar: {
                  CodigoParlamentar: "1",
                  ...(com && { SexoParlamentar: "Feminino" }),
                },
              },
              {
                IdentificacaoParlamentar: {
                  CodigoParlamentar: "2",
                  ...(com && { SexoParlamentar: "Masculino" }),
                },
              },
            ],
          },
        },
      });
    expect(await coletarSenadoras({ fetcher: lista(true), tentativas: 1 })).toEqual(
      new Set(["senado-1"]),
    );
    expect(await coletarSenadoras({ fetcher: lista(false), tentativas: 1 })).toBeNull();
  });
});

function coletores(leg: number): Coletores {
  return {
    parlamentares: async () => [
      parl("camara", 1, "A", leg),
      parl("camara", 2, "B", leg),
      parl("camara", 3, "B", leg),
      parl("senado", 9, "A", leg),
    ],
    votacoes: async () => ({ votacoes: [], votos: [], presencasSenado: [], licencas: [] }),
    gastos: async () => ({ validas: [], invalidas: [] }),
    proposicoes: async () => [],
    mulheres: async () => ({ camara: new Set(["camara-2"]), senado: null }),
  };
}

describe("Story 9.2 — virada de legislatura na rotina", () => {
  it("grava composição, guarda os resumos da legislatura que acabou e mantém o arquivo", async () => {
    const raiz = await mkdtemp(join(tmpdir(), "virada-"));
    const dia = (d: string) => ({ log: () => {}, anos: [2026], agora: () => new Date(d) });
    const a = join(raiz, "a");
    const b = join(raiz, "b");
    const c = join(raiz, "c");

    // Último dia da 57ª
    const m1 = await executarRotina({
      ...dia("2027-01-31T12:00:00Z"),
      anterior: join(raiz, "x"),
      saida: a,
      coletores: coletores(57),
    });
    expect(m1.meta.legislatura).toBe(57);
    const comp = JSON.parse(await readFile(join(a, "composicao/57.json"), "utf8"));
    expect(comp.camara.genero).toEqual({ mulheres: 1, homens: 2 });
    expect(comp.camara.partidos).toEqual([
      { nome: "A", parlamentares: 1 },
      { nome: "B", parlamentares: 2 },
    ]);

    // Primeiro dia da 58ª: a trava não bloqueia e os resumos da 57ª vão para o arquivo (CA3)
    const m2 = await executarRotina({
      ...dia("2027-02-01T12:00:00Z"),
      anterior: a,
      saida: b,
      coletores: coletores(58),
    });
    expect(m2.meta.legislatura).toBe(58);
    const arq = await readdir(join(b, "arquivo/57/resumo"));
    expect(arq.sort()).toEqual([
      "camara-1.json",
      "camara-2.json",
      "camara-3.json",
      "senado-9.json",
    ]);
    expect(await readdir(join(b, "composicao"))).toEqual(
      expect.arrayContaining(["57.json", "58.json"]),
    );

    // Dias seguintes: o arquivo continua
    await executarRotina({
      ...dia("2027-02-02T12:00:00Z"),
      anterior: b,
      saida: c,
      coletores: coletores(58),
    });
    expect((await readdir(join(c, "arquivo/57/resumo"))).length).toBe(4);
    expect(await readdir(join(c, "composicao"))).toEqual(
      expect.arrayContaining(["57.json", "58.json"]),
    );
  });
});
