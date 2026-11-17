import { describe, expect, it } from "vitest";
import { buscarEstados, buscarProjetos, type ProjetoBusca } from "../site/src/lib/busca.js";

const UFS = { CE: "Ceará", SE: "Sergipe", RS: "Rio Grande do Sul", RN: "Rio Grande do Norte" };
const P: ProjetoBusca[] = [
  {
    id: "camara-1",
    titulo: "PLP 186/2026",
    ementa: "Altera regras de juros do cartão de crédito e do cheque especial.",
    casa: "camara",
  },
  {
    id: "senado-2",
    titulo: "PL 50/2025",
    ementa: "Cria o programa de merenda escolar.",
    casa: "senado",
  },
];

describe("Busca por estado e projeto", () => {
  it("acha estado por sigla, nome e erro de grafia", () => {
    expect(buscarEstados(UFS, "ce")[0]!.uf).toBe("CE");
    expect(buscarEstados(UFS, "ceara")[0]!.uf).toBe("CE");
    expect(buscarEstados(UFS, "sergpe")[0]!.uf).toBe("SE");
    expect(
      buscarEstados(UFS, "rio grande")
        .map((e) => e.uf)
        .sort(),
    ).toEqual(["RN", "RS"]);
  });
  it("acha projeto pelo número e pelo assunto", () => {
    expect(buscarProjetos(P, "186/2026")[0]!.id).toBe("camara-1");
    expect(buscarProjetos(P, "plp 186")[0]!.id).toBe("camara-1");
    expect(buscarProjetos(P, "cartao de credito")[0]!.id).toBe("camara-1");
    expect(buscarProjetos(P, "merenda")[0]!.id).toBe("senado-2");
  });
  it("não mostra projeto ao buscar nome de pessoa", () => {
    expect(buscarProjetos(P, "Danilo Forte")).toEqual([]);
    expect(buscarProjetos(P, "pp")).toEqual([]);
  });
});
