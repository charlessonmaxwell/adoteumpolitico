import { describe, expect, it } from "vitest";
import { agruparPorProjeto } from "../pipeline/src/rotina/votos-por-projeto.js";
import type { Votacao, Voto } from "../pipeline/src/modelo/votacao.js";

const v = (
  id: string,
  data: string,
  categoria: Votacao["categoria"],
  extra: Partial<Votacao> = {},
): Votacao => ({
  id,
  casa: "camara",
  data,
  tipo: "nominal",
  resultado: "aprovada",
  idProposicao: "camara-100",
  projeto: { titulo: "PLP 186/2026", ementa: "Limita os juros do cartão." },
  categoria,
  descricao: `desc ${id}`,
  urlFonte: "",
  ...extra,
});
const votacoes = [
  v("u", "2026-10-01", "procedimento"),
  v("t1", "2026-10-14", "principal"),
  v("d1", "2026-10-14", "destaque"),
  v("t2", "2026-10-15", "principal", { descricao: "Redação final" }),
  v("s", "2026-10-15", "principal", { tipo: "simbolica" }),
  v("x", "2026-10-15", "principal", { idProposicao: null, projeto: null }),
];
const votos: Voto[] = [
  { idVotacao: "u", idParlamentar: "camara-1", voto: "nao" },
  { idVotacao: "t1", idParlamentar: "camara-1", voto: "sim" },
  { idVotacao: "d1", idParlamentar: "camara-1", voto: "sim" },
  { idVotacao: "t2", idParlamentar: "camara-1", voto: "sim" },
  { idVotacao: "t1", idParlamentar: "camara-2", voto: "nao" },
];

describe("Story 3.1 — votos por projeto", () => {
  const r = agruparPorProjeto(votacoes, votos);

  it("um projeto, sem simbólicas e sem votações sem projeto; principal é a última do texto", () => {
    expect(r.projetos).toHaveLength(1);
    expect(r.projetos[0]!.votacoes.map((x) => x.id)).toEqual(["u", "t1", "d1", "t2"]);
    expect(r.projetos[0]!.idPrincipal).toBe("t2");
  });

  it("parlamentar vê o voto na principal e as outras votações em que votou", () => {
    const l = r.porParlamentar.get("camara-1")!;
    expect(l).toHaveLength(1);
    expect(l[0]!.principal).toMatchObject({ voto: "sim", resultado: "aprovada" });
    expect(l[0]!.outras.map((o) => [o.categoria, o.voto])).toEqual([
      ["procedimento", "nao"],
      ["principal", "sim"],
      ["destaque", "sim"],
    ]);
  });

  it("quem não aparece na votação principal fica como 'nao_registrou'", () => {
    const l = r.porParlamentar.get("camara-2")!;
    expect(l[0]!.principal?.voto).toBe("nao_registrou");
  });
});
