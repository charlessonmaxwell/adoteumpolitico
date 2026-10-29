import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  frasesGastos,
  frasesPresenca,
  frasesProjetos,
  frasesVotacoes,
} from "../site/src/lib/frases.js";
import { formatarMoedaCurta, humanizarCategoria, pelaUf } from "../site/src/lib/formato.js";
import type { ResumoParlamentar } from "../pipeline/src/rotina/agregacao.js";

const base = JSON.parse(
  readFileSync("site/fixtures/resumo/camara-62881.json", "utf8"),
) as ResumoParlamentar;
const senado = JSON.parse(
  readFileSync("site/fixtures/resumo/senado-5008.json", "utf8"),
) as ResumoParlamentar;
const media = {
  parlamentares: 513,
  gastoTotal: 1373518.56,
  projetosLegislativosComoAutor: 39.64,
  taxaPresenca: 0.9,
};
const com = (mudar: (r: ResumoParlamentar) => void) => {
  const r = structuredClone(base);
  mudar(r);
  return r;
};

describe("Story 2.3 — frases", () => {
  it("presença da Câmara: soma os anos e explica faltas", () => {
    const f = frasesPresenca(base)!;
    expect(f.principal).toBe("Marcou presença em 169 dos 191 dias de votação desde 2025.");
    expect(f.detalhes[0]).toBe("Faltou 11 vezes sem dar justificativa.");
  });

  it("CA2: singular e zero", () => {
    const um = com((r) => {
      if (r.presenca.metrica === "sessao")
        r.presenca.porAno = [
          { ...r.presenca.porAno[0]!, ausenciasNaoJustificadas: 1, diasAusenciaJustificada: 0 },
        ];
    });
    expect(frasesPresenca(um)!.detalhes).toEqual([
      "Faltou 1 vez sem dar justificativa.",
      "Não teve falta justificada.",
    ]);
    const zero = com((r) => {
      if (r.presenca.metrica === "sessao")
        r.presenca.porAno = [{ ...r.presenca.porAno[0]!, ausenciasNaoJustificadas: 0 }];
    });
    expect(frasesPresenca(zero)!.detalhes[0]).toBe("Não faltou nenhuma vez sem dar justificativa.");
    const semProj = com((r) => (r.projetos.legislativas = { autor: 0, coautor: 0, viraramLei: 0 }));
    expect(frasesProjetos(semProj, media).principal).toBe(
      "Não criou nenhum projeto de lei como autor principal desde 2023.",
    );
    const umaLei = com((r) => (r.projetos.legislativas = { autor: 1, coautor: 0, viraramLei: 1 }));
    expect(frasesProjetos(umaLei, media).principal).toBe(
      "Criou 1 projeto de lei como autor principal desde 2023.",
    );
    expect(frasesProjetos(umaLei, media).detalhes).toContain("1 virou lei.");
  });

  it("presença ainda não coletada → sem frase (o bloco mostra o motivo)", () => {
    expect(frasesPresenca(com((r) => (r.presenca = { metrica: "sessao", porAno: [] })))).toBeNull();
  });

  it("destaque em número grande por bloco", () => {
    expect(frasesPresenca(base)!.destaque).toEqual({
      valor: "88%",
      rotulo: "dos dias de votação com presença",
    });
    expect(frasesGastos(base, media).destaque).toEqual({
      valor: "R$ 1,77 mi",
      rotulo: "da cota desde 2023",
    });
    expect(frasesProjetos(base, media).destaque?.valor).toBe("10");
  });

  it("CA4 (2.2): Senado fala em votações, nunca em sessões", () => {
    const f = frasesPresenca(senado)!;
    expect(f.principal).toMatch(/votações/);
    expect([f.principal, ...f.detalhes].join(" ")).not.toMatch(/sess/);
  });

  it("média é fato, nunca comparação", () => {
    const todas = [frasesGastos(base, media), frasesProjetos(base, media), frasesVotacoes(base)]
      .flatMap((f) => [f.principal, ...f.detalhes])
      .join(" ");
    expect(todas).toContain("No mesmo período, cada deputado gastou em média R$ 1,37 milhão.");
    expect(todas).not.toMatch(/acima|abaixo|melhor|pior|mais que|menos que/i);
  });

  it("formatos", () => {
    expect(formatarMoedaCurta(1773233)).toBe("R$ 1,77 milhão");
    expect(formatarMoedaCurta(2500000)).toBe("R$ 2,5 milhões");
    expect(formatarMoedaCurta(358593)).toBe("R$ 359 mil");
    expect(humanizarCategoria("PASSAGEM AÉREA - SIGEPA")).toBe("Passagem aérea");
    expect(humanizarCategoria("DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR.")).toBe(
      "Divulgação da atividade parlamentar",
    );
    expect(pelaUf("CE")).toBe("pelo Ceará");
    expect(pelaUf("BA")).toBe("pela Bahia");
    expect(pelaUf("SE")).toBe("por Sergipe");
  });
});
