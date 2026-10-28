import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { anosDeColeta, coletarGastos } from "../pipeline/src/coleta/gastos.js";
import { paraData, paraValor, somenteCnpj } from "../pipeline/src/util/normalizacao.js";
import type { Fetcher } from "../pipeline/src/util/http.js";

const HOJE = "2026-10-27";
const semEspera = { dormir: async () => {} };
const CPF_PARLAMENTAR = "12345678901";

/** Registro no formato do arquivo da Câmara, com campos pessoais que devem ser descartados. */
const cota = (i: number, extra: Record<string, unknown> = {}) => ({
  nomeParlamentar: `Deputado ${i}`,
  cpf: CPF_PARLAMENTAR,
  idDeputado: 200000 + i,
  numeroDeputadoID: 2000 + i, // id interno: não deve ser usado
  descricao: "COMBUSTÍVEIS E LUBRIFICANTES.",
  fornecedor: "POSTO EXEMPLO LTDA",
  cnpjCPF: "12.345.678/0001-90",
  dataEmissao: "2026-03-10T00:00:00",
  valorLiquido: "250.5",
  mes: 3,
  ano: 2026,
  passageiro: "FULANO DE TAL",
  urlDocumento: i % 10 ? `https://www.camara.leg.br/cota-parlamentar/nota-fiscal/${i}` : "",
  ...extra,
});

/** Registro no formato da API CEAPS do Senado. */
const ceaps = (i: number, extra: Record<string, unknown> = {}) => ({
  id: i,
  codSenador: 5000 + i,
  nomeSenador: `Senador ${i}`,
  tipoDespesa: "Aluguel de imóveis para escritório político",
  cpfCnpj: "98.765.432/0001-10",
  fornecedor: "IMOBILIARIA EXEMPLO",
  data: "2026-02-01",
  valorReembolsado: "1.234,56",
  mes: 2,
  ano: 2026,
  ...extra,
});

function fetcherGastos(camara: unknown[], senado: unknown[]) {
  const chamadas: string[] = [];
  const fetcher: Fetcher = async (url) => {
    chamadas.push(url);
    if (url.includes("camara.leg.br/cotas/")) {
      const zip = zipSync({ "Ano-2026.json": strToU8(JSON.stringify({ dados: camara })) });
      return new Response(zip, { status: 200 });
    }
    if (url.includes("despesas_ceaps")) return Response.json(senado);
    return new Response("", { status: 404 });
  };
  return Object.assign(fetcher, { chamadas });
}

describe("Story 1.3 — gastos", () => {
  it("unifica Câmara (zip) e Senado (API) no modelo único", async () => {
    const fetcher = fetcherGastos([cota(1), cota(2)], [ceaps(1)]);
    const { validas, invalidas } = await coletarGastos([2026], { fetcher, ...semEspera }, HOJE);

    expect(invalidas).toHaveLength(0);
    expect(validas).toHaveLength(3);
    expect(validas[0]).toMatchObject({
      idParlamentar: "camara-200001",
      casa: "camara",
      data: "2026-03-10",
      ano: 2026,
      mes: 3,
      cnpjFornecedor: "12345678000190",
      valor: 250.5,
    });
    expect(validas[2]).toMatchObject({ idParlamentar: "senado-5001", valor: 1234.56 });
  });

  it("CA1: nenhum CPF (do parlamentar ou de fornecedor pessoa física) sai na saída", async () => {
    const fetcher = fetcherGastos(
      [cota(1, { cnpjCPF: "111.222.333-44" })],
      [ceaps(1, { cpfCnpj: "555.666.777-88" })],
    );
    const r = await coletarGastos([2026], { fetcher, ...semEspera }, HOJE);
    const saida = JSON.stringify(r);

    expect(saida).not.toMatch(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/);
    expect(saida).not.toContain(CPF_PARLAMENTAR);
    expect(saida).not.toContain("FULANO DE TAL");
    expect(r.validas.every((d) => d.cnpjFornecedor === null)).toBe(true);
  });

  it("CA2: Câmara preserva o link do documento fiscal", async () => {
    const dados = Array.from({ length: 100 }, (_, i) => cota(i));
    const fetcher = fetcherGastos(dados, []);
    const { validas } = await coletarGastos([2026], { fetcher, ...semEspera }, HOJE);
    const comLink = validas.filter((d) => d.urlDocumento).length;
    expect(comLink).toBe(90); // registros com urlDocumento vazio viram null
  });

  it("CA3: Senado sempre sem urlDocumento", async () => {
    const fetcher = fetcherGastos([], [ceaps(1), ceaps(2)]);
    const { validas } = await coletarGastos([2026], { fetcher, ...semEspera }, HOJE);
    expect(validas.every((d) => d.urlDocumento === null)).toBe(true);
  });

  it("CA4: nunca chama o endpoint /deputados/{id}/despesas", async () => {
    const fetcher = fetcherGastos([cota(1)], [ceaps(1)]);
    await coletarGastos([2025, 2026], { fetcher, ...semEspera }, HOJE);
    expect(fetcher.chamadas.some((u) => /\/deputados\/\d+\/despesas/.test(u))).toBe(false);
    expect(fetcher.chamadas).toHaveLength(4);
  });

  it("tarefa 5: data futura, inválida ou sem parlamentar fica fora dos totais", async () => {
    const fetcher = fetcherGastos(
      [
        cota(1, { dataEmissao: "2026-13-40" }),
        cota(2, { idDeputado: undefined, nomeParlamentar: "LIDERANÇA DO PARTIDO" }),
      ],
      [ceaps(1, { data: "2026-10-30" }), ceaps(2)],
    );
    const { validas, invalidas } = await coletarGastos([2026], { fetcher, ...semEspera }, HOJE);

    expect(validas).toHaveLength(1);
    expect(invalidas.map((i) => i.motivo).sort()).toEqual([
      "data futura",
      "data inválida",
      "sem parlamentar vinculado",
    ]);
  });

  it("aceita data nula (vale a competência ano/mês)", async () => {
    const fetcher = fetcherGastos([cota(1, { dataEmissao: null })], []);
    const { validas } = await coletarGastos([2026], { fetcher, ...semEspera }, HOJE);
    expect(validas[0]).toMatchObject({ data: null, ano: 2026, mes: 3 });
  });
});

describe("normalização", () => {
  it("valores em número e texto brasileiro", () => {
    expect(paraValor(10.5)).toBe(10.5);
    expect(paraValor("1.234,56")).toBe(1234.56);
    expect(paraValor("-80.00")).toBe(-80);
    expect(paraValor("abc")).toBeNull();
  });
  it("datas", () => {
    expect(paraData("2026-01-05T00:00:00")).toBe("2026-01-05");
    expect(paraData("05/01/2026")).toBe("2026-01-05");
    expect(paraData("2026-02-30")).toBe("invalida");
    expect(paraData(null)).toBeNull();
  });
  it("só CNPJ é mantido", () => {
    expect(somenteCnpj("12.345.678/0001-90")).toBe("12345678000190");
    expect(somenteCnpj("111.222.333-44")).toBeNull();
  });
  it("anos de coleta desde 2023", () => {
    expect(anosDeColeta(2026)).toEqual([2023, 2024, 2025, 2026]);
  });
});
