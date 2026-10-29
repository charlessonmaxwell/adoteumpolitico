/**
 * Votos agrupados por projeto (story 3.1).
 * Só votações nominais/secretas ligadas a um projeto. A "principal" de cada projeto é a última votação
 * do texto em si (texto-base, substitutivo, 2º turno de PEC) ou, no Senado, a escolha da autoridade.
 */
import type { Casa } from "../modelo/parlamentar.js";
import type { ValorVoto, Votacao, Voto } from "../modelo/votacao.js";
import type { CategoriaVotacao } from "../coleta/categoria-votacao.js";

export interface VotacaoDoProjeto {
  id: string;
  data: string;
  categoria: CategoriaVotacao;
  tipo: Votacao["tipo"];
  resultado: Votacao["resultado"];
  descricao: string;
  votos: Record<string, ValorVoto>;
}

export interface ProjetoVotado {
  id: string;
  casa: Casa;
  titulo: string;
  ementa: string;
  /** Explicação popular gerada por IA (opcional; o texto oficial continua em `ementa`). */
  explicacao?: string;
  idPrincipal: string | null;
  votacoes: VotacaoDoProjeto[];
}

export interface VotoEmProjeto {
  idProposicao: string;
  titulo: string;
  ementa: string;
  data: string;
  /** Voto na votação principal; "nao_registrou" se ele não aparece nela. Null se o projeto não teve votação principal nominal. */
  principal: {
    data: string;
    voto: ValorVoto | "nao_registrou";
    resultado: Votacao["resultado"];
    tipo: Votacao["tipo"];
    descricao: string;
  } | null;
  outras: {
    data: string;
    categoria: CategoriaVotacao;
    voto: ValorVoto | "nao_registrou";
    resultado: Votacao["resultado"];
    descricao: string;
  }[];
}

const EH_PRINCIPAL = new Set<CategoriaVotacao>(["principal", "autoridade"]);
const MAX_EMENTA = 180;
const encurtar = (s: string) =>
  s.length > MAX_EMENTA ? s.slice(0, MAX_EMENTA - 1).trimEnd() + "…" : s;

export function agruparPorProjeto(votacoes: Votacao[], votos: Voto[]) {
  const votosPorVotacao = new Map<string, Record<string, ValorVoto>>();
  for (const v of votos) {
    let m = votosPorVotacao.get(v.idVotacao);
    if (!m) votosPorVotacao.set(v.idVotacao, (m = {}));
    m[v.idParlamentar] = v.voto;
  }

  const projetos = new Map<string, ProjetoVotado>();
  // Ordem estável: data e, no mesmo dia, a ordem da fonte (sequência das votações)
  const ordenadas = votacoes
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v.tipo !== "simbolica" && v.idProposicao)
    .sort((a, b) => a.v.data.localeCompare(b.v.data) || a.i - b.i);

  for (const { v } of ordenadas) {
    const id = v.idProposicao!;
    let p = projetos.get(id);
    if (!p) {
      p = {
        id,
        casa: v.casa,
        titulo: v.projeto?.titulo || id,
        ementa: v.projeto?.ementa ?? "",
        idPrincipal: null,
        votacoes: [],
      };
      projetos.set(id, p);
    }
    p.votacoes.push({
      id: v.id,
      data: v.data,
      categoria: v.categoria,
      tipo: v.tipo,
      resultado: v.resultado,
      descricao: v.descricao,
      votos: votosPorVotacao.get(v.id) ?? {},
    });
    if (EH_PRINCIPAL.has(v.categoria)) p.idPrincipal = v.id; // a última vence
  }

  const porParlamentar = new Map<string, VotoEmProjeto[]>();
  for (const p of projetos.values()) {
    const participantes = new Set(p.votacoes.flatMap((v) => Object.keys(v.votos)));
    for (const idParl of participantes) {
      const principal = p.votacoes.find((v) => v.id === p.idPrincipal) ?? null;
      const item: VotoEmProjeto = {
        idProposicao: p.id,
        titulo: p.titulo,
        ementa: encurtar(p.ementa),
        data: (principal ?? p.votacoes.at(-1)!).data,
        principal: principal
          ? {
              data: principal.data,
              voto: principal.votos[idParl] ?? "nao_registrou",
              resultado: principal.resultado,
              tipo: principal.tipo,
              descricao: principal.descricao,
            }
          : null,
        outras: p.votacoes
          .filter((v) => v.id !== p.idPrincipal && v.votos[idParl])
          .map((v) => ({
            data: v.data,
            categoria: v.categoria,
            voto: v.votos[idParl]!,
            resultado: v.resultado,
            descricao: v.descricao,
          })),
      };
      let l = porParlamentar.get(idParl);
      if (!l) porParlamentar.set(idParl, (l = []));
      l.push(item);
    }
  }
  for (const l of porParlamentar.values()) l.sort((a, b) => b.data.localeCompare(a.data));
  return { projetos: [...projetos.values()], porParlamentar };
}
