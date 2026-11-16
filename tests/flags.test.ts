import { describe, expect, it } from "vitest";
import { ligado } from "../site/src/lib/flags.js";

describe("chave liga/desliga", () => {
  it("liga só com valores explícitos", () => {
    for (const v of ["true", "TRUE", " 1 ", "sim", "ligado", "on"]) expect(ligado(v)).toBe(true);
  });
  it("fica desligada por padrão (versão atual no ar)", () => {
    for (const v of [undefined, null, "", "false", "0", "não", "talvez"])
      expect(ligado(v)).toBe(false);
  });
});
