import type { ValorVoto } from "../../../pipeline/src/modelo/votacao.js";

/** Rótulo e estilo de cada voto (sem cor de partido: sim = petróleo, não = grafite escuro). */
export const SELO: Record<ValorVoto | "nao_registrou", { texto: string; classe: string }> = {
  sim: { texto: "Votou SIM", classe: "sim" },
  nao: { texto: "Votou NÃO", classe: "nao" },
  abstencao: { texto: "Absteve-se", classe: "neutro" },
  obstrucao: { texto: "Obstrução", classe: "neutro" },
  votou: { texto: "Votou (voto secreto)", classe: "neutro" },
  presidente: { texto: "Presidia a sessão", classe: "neutro" },
  presente_sem_voto: { texto: "Presente, sem votar", classe: "neutro" },
  ausente: { texto: "Faltou", classe: "falta" },
  nao_informado: { texto: "Voto não informado", classe: "neutro" },
  nao_registrou: { texto: "Não registrou voto", classe: "neutro" },
};

export const RESULTADO = (r: "aprovada" | "rejeitada" | null) =>
  r === "aprovada" ? "Aprovado" : r === "rejeitada" ? "Rejeitado" : "Resultado não informado";

/** Tira o placar ("Sim: 320; Não: 67...") da descrição: ele aparece em separado. */
export const semPlacar = (d: string) => d.replace(/\s*Sim:\s*\d+.*$/i, "").replace(/\.$/, "").trim() || d;
