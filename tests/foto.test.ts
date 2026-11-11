import { describe, expect, it } from "vitest";
import { fotoSegura } from "../site/src/lib/dados.js";

describe("fotoSegura", () => {
  it("troca http por https (fotos do Senado)", () => {
    expect(fotoSegura("http://www.senado.leg.br/x.jpg")).toBe("https://www.senado.leg.br/x.jpg");
    expect(fotoSegura("https://www.camara.leg.br/y.jpg")).toBe("https://www.camara.leg.br/y.jpg");
    expect(fotoSegura(null)).toBeNull();
  });
});
