/**
 * Modelos de frase fixos (story 2.3). Sem IA, sem adjetivo, sem nota: só o fato e a fonte.
 * Comparação com a média é sempre fato ("a média é X"), nunca "acima/abaixo".
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

const casaPlural = (r: R) => (r.parlamentar.casa === "camara" ? "deputados" : "senadores");

export function frasesPresenca(r: R): { principal: string; detalhes: string[] } | null {
  const p = r.presenca;
  if (p.metrica === "sessao") {
    if (!p.porAno.length) return null;
    const dias = p.porAno.reduce((a, y) => a + (y.diasComSessao ?? 0), 0);
    const pres = p.porAno.reduce((a, y) => a + (y.diasPresente ?? 0), 0);
    const just = p.porAno.reduce((a, y) => a + (y.diasAusenciaJustificada ?? 0), 0);
    const semJust = p.porAno.reduce((a, y) => a + (y.ausenciasNaoJustificadas ?? 0), 0);
    const desde = p.porAno[0]!.ano;
    return {
      principal: `Esteve presente em ${n(pres)} dos ${n(dias)} dias com sessão de votação desde ${desde}.`,
      detalhes: [
        semJust === 0
          ? "Não faltou nenhuma sessão sem justificativa."
          : `Faltou ${n(semJust)} ${plural(semJust, "sessão", "sessões")} sem justificativa.`,
        just > 0
          ? `Em ${n(just)} ${plural(just, "dia", "dias")}, a ausência foi justificada (missão oficial, licença ou decisão da Mesa).`
          : "Não teve ausência justificada.",
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
    principal: `Compareceu a ${n(pres)} das ${n(total)} votações com registro de voto desde 2023.`,
    detalhes: [
      aus === 0
        ? "Não teve ausência sem justificativa."
        : `Não compareceu, sem justificativa, a ${n(aus)} ${plural(aus, "votação", "votações")}.`,
      just > 0
        ? `Em ${n(just)} ${plural(just, "votação", "votações")}, a ausência foi justificada (atividade parlamentar, missão ou licença).`
        : "Não teve ausência justificada.",
      `Licenças registradas desde 2023: ${n(p.licencas)}.`,
    ],
  };
}

export function frasesGastos(r: R, m: Medias): { principal: string; detalhes: string[] } {
  const g = r.gastos;
  if (!g.quantidade)
    return { principal: "Não há gastos da cota registrados desde 2023.", detalhes: [] };
  const top = g.porCategoria[0]!;
  const detalhes = [
    `O maior gasto foi com ${humanizarCategoria(top.categoria).toLowerCase()}: ${formatarMoedaCurta(top.total)} (${formatarPct(top.total, g.total)} do total).`,
  ];
  if (m.gastoTotal)
    detalhes.push(
      `A média entre os ${casaPlural(r)} no mesmo período é ${formatarMoedaCurta(m.gastoTotal)}.`,
    );
  if (r.parlamentar.casa === "camara")
    detalhes.push(
      `${formatarPct(g.comNotaFiscal, g.quantidade)} das despesas têm a nota fiscal publicada pela Câmara.`,
    );
  return {
    principal: `Usou ${formatarMoedaCurta(g.total)} da cota parlamentar desde 2023.`,
    detalhes,
  };
}

export function frasesProjetos(r: R, m: Medias): { principal: string; detalhes: string[] } {
  const { autor, coautor, viraramLei } = r.projetos.legislativas;
  const principal =
    autor === 0
      ? "Não apresentou projeto de lei como autor principal desde 2023."
      : `Apresentou ${n(autor)} ${plural(autor, "projeto de lei", "projetos de lei")} como autor principal desde 2023.`;
  const detalhes = [
    coautor > 0
      ? `Assinou outros ${n(coautor)} junto com colegas.`
      : "Não assinou projetos de colegas.",
    viraramLei === 0
      ? "Nenhum desses projetos virou lei até agora."
      : `${n(viraramLei)} ${plural(viraramLei, "virou lei", "viraram lei")}.`,
  ];
  if (r.projetos.homenagens > 0)
    detalhes.push(
      `Também apresentou ${n(r.projetos.homenagens)} ${plural(r.projetos.homenagens, "homenagem", "homenagens")} (nome de rua, data comemorativa), contadas à parte.`,
    );
  if (m.projetosLegislativosComoAutor !== null)
    detalhes.push(
      `A média entre os ${casaPlural(r)} é ${n(Math.round(m.projetosLegislativosComoAutor))} como autor principal.`,
    );
  return { principal, detalhes };
}

export const VOTO_ROTULO: Record<string, string> = {
  sim: "Sim",
  nao: "Não",
  abstencao: "Abstenção",
  obstrucao: "Obstrução",
  votou: "Votou (secreta)",
  presidente: "Presidindo a sessão",
  presente_sem_voto: "Presente, sem voto",
  ausente: "Ausente",
  nao_informado: "Não informado",
};

export function votosEfetivos(r: R) {
  const v = r.votacoes.votos;
  return (v.sim ?? 0) + (v.nao ?? 0) + (v.abstencao ?? 0) + (v.obstrucao ?? 0) + (v.votou ?? 0);
}

export function frasesVotacoes(r: R): { principal: string; detalhes: string[] } {
  const total = r.votacoes.nominaisDaCasa;
  const votou = votosEfetivos(r);
  const v = r.votacoes.votos;
  const detalhes = [
    `Votou "sim" ${n(v.sim ?? 0)} ${plural(v.sim ?? 0, "vez", "vezes")} e "não" ${n(v.nao ?? 0)} ${plural(v.nao ?? 0, "vez", "vezes")}.`,
    "A maioria das decisões é tomada em votação simbólica, sem registro de voto individual; elas não entram nesta conta.",
  ];
  return {
    principal: `Registrou voto em ${n(votou)} das ${n(total)} votações com voto individual desde 2023.`,
    detalhes,
  };
}
