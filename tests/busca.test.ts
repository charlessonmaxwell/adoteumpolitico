import { describe, expect, it } from "vitest";
import { buscar, distancia, type ItemBusca } from "../site/src/lib/busca.js";

const item = (id: string, nome: string, uf: string, estado: string, partido = "PP"): ItemBusca => ({
  id,
  nome,
  uf,
  estado,
  partido,
  casa: "camara",
  foto: null,
});
const itens = [
  item("1", "Danilo Forte", "CE", "Ceará"),
  item("2", "Danielle Fortes", "SP", "São Paulo", "PT"),
  item("3", "Acácio Favacho", "AP", "Amapá", "MDB"),
  item("4", "Ana Beatriz Moura", "SE", "Sergipe", "PSD"),
  item("5", "José da Silva", "SE", "Sergipe", "PSD"),
];
const ids = (q: string) => buscar(itens, q).map((i) => i.id);

describe("Story 2.1 — busca", () => {
  it("CA1: tolera erro de digitação, acento e nome parcial", () => {
    expect(ids("Danilo Fort")[0]).toBe("1");
    expect(ids("danilo forte")[0]).toBe("1");
    expect(ids("Dánilo")[0]).toBe("1");
    expect(ids("Dnailo")).toContain("1"); // letras trocadas
    expect(ids("acacio")).toEqual(["3"]);
    expect(ids("favaxo")).toEqual(["3"]); // ch/x
    expect(ids("jose da silva")).toEqual(["5"]);
    expect(ids("jose da sylva")).toEqual(["5"]); // y/i
  });

  it("CA2: encontra por UF, nome do estado e partido", () => {
    expect(ids("se").sort()).toEqual(["4", "5"]);
    expect(ids("sergipe").sort()).toEqual(["4", "5"]);
    expect(ids("psd sergipe").sort()).toEqual(["4", "5"]);
    expect(ids("ana sergipe")).toEqual(["4"]);
  });

  it("nome exato vem antes de parecido", () => {
    expect(ids("forte")).toEqual(["1", "2"]);
  });

  it("consulta vazia ou sem relação não retorna nada", () => {
    expect(ids("")).toEqual([]);
    expect(ids("xyzwq")).toEqual([]);
  });

  it("distância de edição", () => {
    expect(distancia("dnailo", "danilo", 2)).toBe(1);
    expect(distancia("abc", "abcdefgh", 2)).toBe(3);
  });
});
