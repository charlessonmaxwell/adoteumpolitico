import { describe, expect, it } from "vitest";
// @ts-expect-error -- script .mjs sem tipos
import { paraLinhasVisitas } from "../scripts/coletar-visitas.mjs";

const g = (dim: Record<string, string>, count: number, visits: number) => ({
  dimensions: dim,
  count,
  sum: { visits },
});

describe("paraLinhasVisitas", () => {
  it("gera totais, ranking de páginas, origens e dispositivos", () => {
    const linhas: string[] = paraLinhasVisitas({
      total: { visitas: 120, paginas: 300 },
      paginas: [g({ requestPath: "/" }, 100, 80), g({ requestPath: "/p/camara-1/" }, 150, 30)],
      origens: [g({ refererHost: "" }, 50, 40), g({ refererHost: "wa.me" }, 20, 15)],
      dispositivos: [g({ deviceType: "mobile" }, 200, 90)],
    });
    expect(linhas[0]).toBe("site_visitas visitas=120,paginas=300");
    expect(linhas[1]).toBe("site_pagina,caminho=/p/camara-1/ paginas=150,visitas=30");
    expect(linhas).toContain("site_origem,origem=direto visitas=40");
    expect(linhas).toContain("site_origem,origem=wa.me visitas=15");
    expect(linhas).toContain("site_dispositivo,tipo=mobile visitas=90");
  });

  it("limita a 10 páginas", () => {
    const paginas = Array.from({ length: 30 }, (_, i) => g({ requestPath: `/p/${i}/` }, i, i));
    const linhas: string[] = paraLinhasVisitas({
      total: { visitas: 0, paginas: 0 },
      paginas,
      origens: [],
      dispositivos: [],
    });
    expect(linhas.filter((l) => l.startsWith("site_pagina"))).toHaveLength(10);
  });
});
