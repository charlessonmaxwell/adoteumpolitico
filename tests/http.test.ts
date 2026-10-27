import { describe, expect, it } from "vitest";
import { ErroHttp, getJson } from "../pipeline/src/util/http.js";

const resposta = (status: number, corpo: unknown = {}) =>
  new Response(JSON.stringify(corpo), { status });

describe("cliente HTTP", () => {
  it("tenta de novo após 429 com espera crescente e devolve o JSON", async () => {
    const esperas: number[] = [];
    let n = 0;
    const r = await getJson<{ ok: boolean }>("https://x.test", {
      fetcher: async () => (++n < 3 ? resposta(429) : resposta(200, { ok: true })),
      dormir: async (ms) => void esperas.push(ms),
      esperaInicialMs: 100,
    });
    expect(r.ok).toBe(true);
    expect(esperas).toEqual([100, 200]);
  });

  it("não insiste em erro definitivo (404)", async () => {
    let n = 0;
    await expect(
      getJson("https://x.test", {
        fetcher: async () => (n++, resposta(404)),
        dormir: async () => {},
      }),
    ).rejects.toBeInstanceOf(ErroHttp);
    expect(n).toBe(1);
  });

  it("desiste após esgotar as tentativas", async () => {
    let n = 0;
    await expect(
      getJson("https://x.test", {
        fetcher: async () => (n++, resposta(503)),
        dormir: async () => {},
        tentativas: 3,
      }),
    ).rejects.toThrow(/HTTP 503/);
    expect(n).toBe(3);
  });

  it("tenta de novo em falha de rede", async () => {
    let n = 0;
    const r = await getJson<{ ok: boolean }>("https://x.test", {
      fetcher: async () => {
        if (++n === 1) throw new TypeError("fetch failed");
        return resposta(200, { ok: true });
      },
      dormir: async () => {},
    });
    expect(r.ok).toBe(true);
  });
});
