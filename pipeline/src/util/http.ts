export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface OpcoesHttp {
  tentativas?: number;
  esperaInicialMs?: number;
  fetcher?: Fetcher;
  dormir?: (ms: number) => Promise<void>;
}

const dormirPadrao = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Status que valem nova tentativa: excesso de requisições e instabilidade do servidor. */
const STATUS_RETENTAVEIS = new Set([429, 500, 502, 503, 504]);

export class ErroHttp extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
  ) {
    super(`HTTP ${status} em ${url}`);
  }
}

/** GET JSON com retentativa e espera crescente (a Câmara responde 429 sob carga). */
export async function getJson<T>(url: string, opcoes: OpcoesHttp = {}): Promise<T> {
  const { tentativas = 4, esperaInicialMs = 1000, fetcher = fetch, dormir = dormirPadrao } = opcoes;

  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      const resp = await fetcher(url, { headers: { Accept: "application/json" } });
      if (resp.ok) return (await resp.json()) as T;
      ultimoErro = new ErroHttp(url, resp.status);
      if (!STATUS_RETENTAVEIS.has(resp.status)) throw ultimoErro;
    } catch (erro) {
      if (erro instanceof ErroHttp && !STATUS_RETENTAVEIS.has(erro.status)) throw erro;
      ultimoErro = erro;
    }
    if (i < tentativas - 1) await dormir(esperaInicialMs * 2 ** i);
  }
  throw ultimoErro;
}
