import type { VotoEmProjeto } from "../../../pipeline/src/rotina/votos-por-projeto.js";

export interface UltimaVotacao {
  idProposicao: string;
  titulo: string;
  data: string;
  /** Explicação popular, ou a ementa oficial quando não há explicação. Vazio se nenhuma das duas existe. */
  texto: string;
  origemTexto: "explicacao" | "ementa" | null;
  /** Voto na votação do projeto em si. Null se só votou em etapas de procedimento. */
  voto: NonNullable<VotoEmProjeto["principal"]>["voto"] | null;
  resultado: NonNullable<VotoEmProjeto["principal"]>["resultado"] | null;
}

/** Os `n` projetos votados mais recentes do parlamentar, prontos para a seção "Últimas votações". */
export function ultimasVotacoes(
  lista: VotoEmProjeto[],
  explicacoes: ReadonlyMap<string, string | undefined>,
  n = 5,
): UltimaVotacao[] {
  return lista
    .map((x, i) => ({ x, i }))
    .sort((a, b) => b.x.data.localeCompare(a.x.data) || a.i - b.i)
    .slice(0, Math.max(0, n))
    .map(({ x }) => {
      const explicacao = explicacoes.get(x.idProposicao)?.trim();
      const ementa = x.ementa?.trim();
      return {
        idProposicao: x.idProposicao,
        titulo: x.titulo,
        data: x.data,
        texto: explicacao || ementa || "",
        origemTexto: explicacao ? "explicacao" : ementa ? "ementa" : null,
        voto: x.principal?.voto ?? null,
        resultado: x.principal?.resultado ?? null,
      };
    });
}
