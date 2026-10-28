import { readFileSync } from "node:fs";
import type { Categoria } from "../modelo/proposicao.js";

export interface ConfigCategorias {
  tiposLegislativos: string[];
  termosHomenagem: string[];
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function carregarConfig(
  caminho = new URL("../../../config/categorias-proposicao.json", import.meta.url),
): ConfigCategorias {
  return JSON.parse(readFileSync(caminho, "utf8")) as ConfigCategorias;
}

/** Homenagem só se aplica a tipos legislativos (ex.: PL que dá nome a viaduto). */
export function categorizar(tipo: string, ementa: string, cfg: ConfigCategorias): Categoria {
  if (!cfg.tiposLegislativos.includes(tipo.toUpperCase())) return "procedimental";
  const e = semAcento(ementa);
  return cfg.termosHomenagem.some((t) => e.includes(semAcento(t))) ? "homenagem" : "legislativa";
}
