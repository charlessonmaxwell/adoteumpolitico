import { describe, expect, it } from "vitest";
import { codigoPix, crc16 } from "../site/src/lib/pix.js";

describe("Pix copia e cola", () => {
  it("CRC16 do padrão (vetor conhecido '123456789' = 29B1)", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
  it("monta o BR Code com chave, nome sem acento e CRC no fim", () => {
    const c = codigoPix({
      chave: "123e4567-e12b-12d1-a456-426655440000",
      nome: "Adote um Político",
      cidade: "Aracaju",
    });
    expect(c.startsWith("000201")).toBe(true);
    expect(c).toContain("0014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-426655440000");
    expect(c).toContain("5917ADOTE UM POLITICO6007ARACAJU");
    expect(c.slice(-8, -4)).toBe("6304");
    expect(crc16(c.slice(0, -4))).toBe(c.slice(-4));
  });
});
