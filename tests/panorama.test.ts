import { describe, expect, it } from "vitest";
import { montarPanorama } from "../pipeline/src/rotina/panorama.js";
import type { ResumoParlamentar } from "../pipeline/src/rotina/agregacao.js";

const resumo = (
  id: string,
  partido: string,
  uf: string,
  gasto: number,
  pres: number,
): ResumoParlamentar =>
  ({
    parlamentar: { id, casa: "camara", partido, uf, nome: id },
    gastos: { total: gasto, porAno: {}, porCategoria: [], quantidade: 1, comNotaFiscal: 0 },
    projetos: {
      legislativas: { autor: 2, coautor: 0, viraramLei: id === "camara-1" ? 1 : 0 },
      homenagens: 0,
      procedimentais: 0,
    },
    votacoes: { nominaisDaCasa: 0, comRegistro: 0, votos: {} },
    presenca: { metrica: "sessao", porAno: [{ ano: 2025, diasComSessao: 10, diasPresente: pres }] },
  }) as unknown as ResumoParlamentar;

describe("panorama", () => {
  it("gera números gerais, grupos em ordem alfabética e sem dados de ex-parlamentares", () => {
    const p = montarPanorama({
      resumos: [resumo("camara-1", "PT", "SP", 100, 10), resumo("camara-2", "MDB", "SE", 300, 6)],
      despesas: [
        {
          idParlamentar: "camara-1",
          casa: "camara",
          ano: 2025,
          categoria: "X",
          fornecedor: "Empresa A",
          cnpjFornecedor: "1",
          valor: 100,
        },
        {
          idParlamentar: "camara-9",
          casa: "camara",
          ano: 2025,
          categoria: "X",
          fornecedor: "Ex",
          cnpjFornecedor: "2",
          valor: 999,
        },
      ] as never,
      proposicoes: [
        {
          id: "camara-10",
          idParlamentar: "camara-1",
          casa: "camara",
          categoria: "legislativa",
          situacao: "Transformado em Norma Jurídica",
        },
        {
          id: "camara-10",
          idParlamentar: "camara-2",
          casa: "camara",
          categoria: "legislativa",
          situacao: "Transformado em Norma Jurídica",
        },
      ] as never,
      votacoes: [],
      votos: [],
    });
    expect(p.camara.gastos.total).toBe(100);
    expect(p.camara.gastos.empresas).toEqual([{ cnpj: "1", nome: "Empresa A", total: 100 }]);
    expect(p.camara.projetos).toMatchObject({
      apresentados: 1,
      viraramLei: 1,
      parlamentaresComLei: 1,
    });
    expect(p.camara.porPartido.map((g) => g.nome)).toEqual(["MDB", "PT"]);
    expect(p.camara.presenca.faixas.map((f) => f.parlamentares)).toEqual([1, 0, 1, 0]);
    expect(p.camara.gastos.medianaPorParlamentar).toBe(200);
  });
});
