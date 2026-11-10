import { describe, expect, it } from "vitest";
import { ultimasVotacoes } from "../site/src/lib/ultimas.js";
import type { VotoEmProjeto } from "../pipeline/src/rotina/votos-por-projeto.js";

const voto = (id: string, data: string, mudar: Partial<VotoEmProjeto> = {}): VotoEmProjeto => ({
  idProposicao: id,
  titulo: `PL ${id}`,
  ementa: `Ementa ${id}.`,
  data,
  principal: {
    data,
    voto: "sim",
    resultado: "aprovada",
    tipo: "nominal",
    descricao: "Aprovado. Sim: 300; Não: 10; Total: 310.",
  },
  outras: [],
  ...mudar,
});

describe("Story 2.7 — últimas votações", () => {
  it("CA1: até 5, do mais recente para o mais antigo", () => {
    const lista = [
      "2025-01-01",
      "2026-10-14",
      "2024-05-02",
      "2026-03-01",
      "2025-07-07",
      "2026-09-09",
      "2023-02-02",
    ].map((d, i) => voto(`c-${i}`, d));
    const r = ultimasVotacoes(lista, new Map());
    expect(r.map((x) => x.data)).toEqual([
      "2026-10-14",
      "2026-09-09",
      "2026-03-01",
      "2025-07-07",
      "2025-01-01",
    ]);
  });

  it("CA1: mesma data mantém a ordem original e respeita n", () => {
    const lista = [voto("a", "2026-10-14"), voto("b", "2026-10-14"), voto("c", "2026-10-14")];
    expect(ultimasVotacoes(lista, new Map(), 2).map((x) => x.idProposicao)).toEqual(["a", "b"]);
  });

  it("CA1: traz voto e resultado da votação do projeto", () => {
    const [x] = ultimasVotacoes(
      [
        voto("a", "2026-10-14", {
          principal: {
            data: "2026-10-14",
            voto: "ausente",
            resultado: "rejeitada",
            tipo: "nominal",
            descricao: "",
          },
        }),
      ],
      new Map(),
    );
    expect(x!.voto).toBe("ausente");
    expect(x!.resultado).toBe("rejeitada");
  });

  it("CA2: usa a explicação popular quando existe, senão a ementa", () => {
    const lista = [
      voto("a", "2026-10-14"),
      voto("b", "2026-10-13"),
      voto("c", "2026-10-12", { ementa: "" }),
    ];
    const r = ultimasVotacoes(
      lista,
      new Map([
        ["a", "Muda o limite do MEI."],
        ["b", "   "],
      ]),
    );
    expect(r[0]).toMatchObject({ texto: "Muda o limite do MEI.", origemTexto: "explicacao" });
    expect(r[1]).toMatchObject({ texto: "Ementa b.", origemTexto: "ementa" });
    expect(r[2]).toMatchObject({ texto: "", origemTexto: null });
  });

  it("CA3: só procedimento fica sem voto principal", () => {
    const [x] = ultimasVotacoes([voto("a", "2026-10-14", { principal: null })], new Map());
    expect(x!.voto).toBeNull();
    expect(x!.resultado).toBeNull();
  });

  it("CA4: lista vazia devolve vazio", () => {
    expect(ultimasVotacoes([], new Map())).toEqual([]);
  });
});
