/**
 * Modelos de frase fixos (story 2.3). Linguagem do dia a dia, sem IA.
 * Informal, mas sem julgar: só o fato e a fonte. Nada de nota, adjetivo ou "acima/abaixo da média".
 */
import type { ResumoParlamentar } from "../../../pipeline/src/rotina/agregacao.js";
import {
  formatarMoedaCurta,
  formatarNumero as n,
  formatarPct,
  humanizarCategoria,
  plural,
} from "./formato.js";

type R = ResumoParlamentar;
export type Medias = {
  parlamentares: number;
  gastoTotal: number | null;
  projetosLegislativosComoAutor: number | null;
  taxaPresenca: number | null;
};
export type Frases = {
  principal: string;
  detalhes: string[];
  destaque: { valor: string; rotulo: string } | null;
};

const casaSingular = (r: R) => (r.parlamentar.casa === "camara" ? "cada deputado" : "cada senador");

export function frasesPresenca(r: R): Frases | null {
  const p = r.presenca;
  if (p.metrica === "sessao") {
    if (!p.porAno.length) return null;
    const dias = p.porAno.reduce((a, y) => a + (y.diasComSessao ?? 0), 0);
    const pres = p.porAno.reduce((a, y) => a + (y.diasPresente ?? 0), 0);
    const just = p.porAno.reduce((a, y) => a + (y.diasAusenciaJustificada ?? 0), 0);
    const semJust = p.porAno.reduce((a, y) => a + (y.ausenciasNaoJustificadas ?? 0), 0);
    const desde = p.porAno[0]!.ano;
    return {
      destaque: { valor: formatarPct(pres, dias), rotulo: "dos dias de votação com presença" },
      principal: `Marcou presença em ${n(pres)} dos ${n(dias)} dias de votação desde ${desde}.`,
      detalhes: [
        semJust === 0
          ? "Não faltou nenhuma vez sem dar justificativa."
          : `Faltou ${n(semJust)} ${plural(semJust, "vez", "vezes")} sem dar justificativa.`,
        just > 0
          ? `Em ${n(just)} ${plural(just, "dia", "dias")}, a falta foi justificada: viagem a serviço, licença ou decisão da Mesa.`
          : "Não teve falta justificada.",
      ],
    };
  }
  const anos = Object.values(p.porAno);
  const total = anos.reduce((a, c) => a + Object.values(c).reduce((x, y) => x + y, 0), 0);
  if (!total) return null;
  const pres = anos.reduce((a, c) => a + (c.presente ?? 0), 0);
  const just = anos.reduce((a, c) => a + (c.ausencia_justificada ?? 0), 0);
  const aus = anos.reduce((a, c) => a + (c.ausente ?? 0), 0);
  return {
    destaque: { valor: formatarPct(pres, total), rotulo: "das votações com presença" },
    principal: `Apareceu em ${n(pres)} das ${n(total)} votações com registro de voto desde 2023.`,
    detalhes: [
      aus === 0
        ? "Não faltou nenhuma votação sem dar justificativa."
        : `Faltou ${n(aus)} ${plural(aus, "votação", "votações")} sem dar justificativa.`,
      just > 0
        ? `Em ${n(just)} ${plural(just, "votação", "votações")}, a falta foi justificada: trabalho fora do plenário, viagem a serviço ou licença.`
        : "Não teve falta justificada.",
      `Pediu licença ${n(p.licencas)} ${plural(p.licencas, "vez", "vezes")} desde 2023.`,
    ],
  };
}

export function frasesGastos(r: R, m: Medias): Frases {
  const g = r.gastos;
  if (!g.quantidade)
    return {
      destaque: null,
      principal: "Não tem gasto da cota registrado desde 2023.",
      detalhes: [],
    };
  const top = g.porCategoria[0]!;
  const detalhes = [
    `Onde mais gastou: ${humanizarCategoria(top.categoria).toLowerCase()}, com ${formatarMoedaCurta(top.total)} (${formatarPct(top.total, g.total)} do total).`,
  ];
  if (m.gastoTotal)
    detalhes.push(
      `No mesmo período, ${casaSingular(r)} gastou em média ${formatarMoedaCurta(m.gastoTotal)}.`,
    );
  if (r.parlamentar.casa === "camara")
    detalhes.push(
      `${formatarPct(g.comNotaFiscal, g.quantidade)} das despesas têm nota fiscal publicada, pra você conferir.`,
    );
  return {
    destaque: {
      valor: formatarMoedaCurta(g.total).replace(" milhão", " mi").replace(" milhões", " mi"),
      rotulo: "da cota desde 2023",
    },
    principal: `Gastou ${formatarMoedaCurta(g.total)} da cota parlamentar (a verba do gabinete paga com dinheiro público) desde 2023.`,
    detalhes,
  };
}

export function frasesProjetos(r: R, m: Medias): Frases {
  const { autor, coautor, viraramLei } = r.projetos.legislativas;
  const principal =
    autor === 0
      ? "Não criou nenhum projeto de lei como autor principal desde 2023."
      : `Criou ${n(autor)} ${plural(autor, "projeto de lei", "projetos de lei")} como autor principal desde 2023.`;
  const detalhes = [
    coautor > 0
      ? `Assinou mais ${n(coautor)} junto com colegas.`
      : "Não assinou projeto de colegas.",
    viraramLei === 0
      ? "Nenhum desses virou lei até agora."
      : `${n(viraramLei)} ${plural(viraramLei, "virou lei", "viraram lei")}.`,
  ];
  if (r.projetos.homenagens > 0)
    detalhes.push(
      `Também fez ${n(r.projetos.homenagens)} ${plural(r.projetos.homenagens, "homenagem", "homenagens")} (nome de rua, data comemorativa). Essas a gente conta separado.`,
    );
  if (m.projetosLegislativosComoAutor !== null)
    detalhes.push(
      `Em média, ${casaSingular(r)} criou ${n(Math.round(m.projetosLegislativosComoAutor))}.`,
    );
  return {
    destaque: {
      valor: n(autor),
      rotulo: plural(autor, "projeto de lei criado", "projetos de lei criados"),
    },
    principal,
    detalhes,
  };
}

export const VOTO_ROTULO: Record<string, string> = {
  sim: "Sim",
  nao: "Não",
  abstencao: "Abstenção",
  obstrucao: "Obstrução",
  votou: "Votou (voto secreto)",
  presidente: "Presidindo a sessão",
  presente_sem_voto: "Presente, sem votar",
  ausente: "Faltou",
  nao_informado: "Não informado",
};

export function votosEfetivos(r: R) {
  const v = r.votacoes.votos;
  return (v.sim ?? 0) + (v.nao ?? 0) + (v.abstencao ?? 0) + (v.obstrucao ?? 0) + (v.votou ?? 0);
}

export function frasesVotacoes(r: R): Frases {
  const total = r.votacoes.nominaisDaCasa;
  const votou = votosEfetivos(r);
  const v = r.votacoes.votos;
  return {
    destaque: { valor: n(votou), rotulo: `votos registrados, de ${n(total)} votações` },
    principal: `Votou em ${n(votou)} das ${n(total)} votações em que o voto de cada um fica registrado.`,
    detalhes: [
      `Disse "sim" ${n(v.sim ?? 0)} ${plural(v.sim ?? 0, "vez", "vezes")} e "não" ${n(v.nao ?? 0)} ${plural(v.nao ?? 0, "vez", "vezes")}.`,
      "Muita coisa é decidida em votação simbólica, sem registro de quem votou o quê. Essas não entram na conta.",
    ],
  };
}
