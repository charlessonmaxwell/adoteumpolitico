import { describe, expect, it } from "vitest";
import { chave, ligado } from "../site/src/lib/flags.js";

describe("chave liga/desliga", () => {
  it("liga só com valores explícitos", () => {
    for (const v of ["true", "TRUE", " 1 ", "sim", "ligado", "on"]) expect(ligado(v)).toBe(true);
  });
  it("sem padrão, fica desligada", () => {
    for (const v of [undefined, null, "", "false", "0", "não", "talvez"])
      expect(ligado(v)).toBe(false);
  });
  it("usa o padrão quando a variável não existe", () => {
    expect(chave(undefined, true)).toBe(true);
    expect(chave("", true)).toBe(true);
    expect(chave("false", true)).toBe(false);
    expect(chave("true", false)).toBe(true);
  });
});
