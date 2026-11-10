/**
 * Situação de cada fonte de dados para a página pública "Quando os dados foram atualizados" (story 2.8).
 * Funções puras: recebem as tentativas (execuções das rotinas) e o "agora", devolvem os textos fixos.
 * Horário de Brasília = UTC−3 (sem horário de verão desde 2019).
 */

export type IdFonte = "diario" | "presenca" | "emendas" | "explicacoes" | "palacio";
export type Estado = "em-dia" | "atrasada" | "aguardando";
export type Dia = "ok" | "falha" | "sem";

/** Uma execução terminada de uma rotina. */
export interface Tentativa {
  /** Fim da execução (ISO, UTC). */
  quando: string;
  ok: boolean;
  /** Texto bruto do erro (anotação do GitHub), só para escolher o motivo. Nunca vai para a página. */
  erro?: string;
  /** Falso quando a execução deu certo mas não atualizou nada (ex.: repescagem dispensada). */
  atualizou?: boolean;
}

export interface Fonte {
  id: IdFonte;
  nome: string;
  inclui: string;
  frequencia: string;
  /** Dias sem atualização a partir dos quais a fonte conta como atrasada. Null: não se aplica. */
  prazoDias: number | null;
  /** Próxima tentativa prevista, no horário de Brasília. */
  proxima: (agoraBr: Date, okHoje: boolean) => { dia: Date; hora?: string };
  /** Mostra os últimos 14 dias. */
  historico?: boolean;
}

export interface SituacaoFonte {
  id: IdFonte;
  nome: string;
  inclui: string;
  frequencia: string;
  estado: Estado;
  /** Texto pronto ("09/11 às 15:53") ou null se nunca atualizou. */
  ultimaAtualizacao: string | null;
  aviso: string | null;
  proximaTentativa: string;
  dias?: Dia[];
}

export interface Situacao {
  conferidoEm: string;
  /** Null quando não foi possível conferir (API fora do ar, sem permissão). */
  fontes: SituacaoFonte[] | null;
}

const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;
const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Data deslocada para Brasília: use os métodos getUTC* para ler dia e hora locais. */
export const paraBr = (iso: string | Date) => new Date(new Date(iso).getTime() - 3 * HORA_MS);
const dois = (n: number) => String(n).padStart(2, "0");
const diaMes = (d: Date) => `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}`;
const chaveDia = (d: Date) => d.toISOString().slice(0, 10);
export const dataHoraBr = (iso: string) => {
  const d = paraBr(iso);
  return `${diaMes(d)} às ${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}`;
};

/** Próximo dia (a partir de hoje, se ainda não deu certo hoje) que satisfaz `cabe`. */
const proximoDia = (agoraBr: Date, okHoje: boolean, cabe: (d: Date) => boolean) => {
  const inicio = new Date(
    Date.UTC(agoraBr.getUTCFullYear(), agoraBr.getUTCMonth(), agoraBr.getUTCDate()),
  );
  for (let i = okHoje ? 1 : 0; i < 40; i++) {
    const d = new Date(inicio.getTime() + i * DIA_MS);
    if (cabe(d)) return d;
  }
  return inicio;
};

export const FONTES: Fonte[] = [
  {
    id: "diario",
    nome: "Votos, gastos, projetos e cadastro",
    inclui:
      "Como cada um votou, gastos da cota, projetos apresentados e a lista de deputados e senadores.",
    frequencia: "Todo dia",
    prazoDias: 2,
    historico: true,
    // .github/workflows/diario.yml: 10:07 e repescagem às 16:07
    proxima: (agora, okHoje) => {
      const min = agora.getUTCHours() * 60 + agora.getUTCMinutes();
      const hoje = new Date(
        Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()),
      );
      const amanha = new Date(hoje.getTime() + DIA_MS);
      if (okHoje || min >= 16 * 60 + 7) return { dia: amanha, hora: "10:07" };
      return { dia: hoje, hora: min < 10 * 60 + 7 ? "10:07" : "16:07" };
    },
  },
  {
    id: "presenca",
    nome: "Presença na Câmara",
    inclui:
      "Dias de votação em que o deputado foi, faltou com justificativa ou faltou sem justificativa.",
    frequencia: "Uma vez por semana (domingo)",
    prazoDias: 9,
    proxima: (agora, okHoje) => ({ dia: proximoDia(agora, okHoje, (d) => d.getUTCDay() === 0) }),
  },
  {
    id: "emendas",
    nome: "Emendas parlamentares",
    inclui: "Dinheiro que cada parlamentar mandou para cidades e estados.",
    frequencia: "Duas vezes por mês (dias 1 e 15)",
    prazoDias: 17,
    proxima: (agora, okHoje) => ({
      dia: proximoDia(agora, okHoje, (d) => [1, 15].includes(d.getUTCDate())),
    }),
  },
  {
    id: "explicacoes",
    nome: "Explicação simples dos projetos",
    inclui: "O texto em linguagem do dia a dia de cada projeto votado.",
    frequencia: "Uma vez por semana (segunda), quando há projeto novo votado",
    // Sem projeto novo (recesso), não há o que explicar: a falta de atualização não é atraso.
    prazoDias: null,
    proxima: (agora, okHoje) => ({ dia: proximoDia(agora, okHoje, (d) => d.getUTCDay() === 1) }),
  },
  {
    id: "palacio",
    nome: "Cartão corporativo do Palácio",
    inclui: "Gastos do cartão da Presidência e da Vice-Presidência.",
    frequencia: "Duas vezes por mês (dias 3 e 18)",
    prazoDias: 17,
    proxima: (agora, okHoje) => ({
      dia: proximoDia(agora, okHoje, (d) => [3, 18].includes(d.getUTCDate())),
    }),
  },
];

/** Motivo da falha em linguagem simples, sem endereço nem código de erro. */
export function motivoPopular(erro: string | undefined): string {
  const e = (erro ?? "").toLowerCase();
  if (e.includes("camara.leg.br")) return "O site de dados da Câmara não respondeu";
  if (e.includes("senado.leg.br") || e.includes("senado.gov.br"))
    return "O site de dados do Senado não respondeu";
  if (e.includes("portaldatransparencia")) return "O Portal da Transparência não respondeu";
  if (e.includes("queda acima"))
    return "Os dados chegaram bem menores que o normal e, por segurança, não foram publicados";
  return "A atualização não terminou";
}

const textoProxima = (agoraBr: Date, p: { dia: Date; hora?: string }) => {
  const hoje = chaveDia(agoraBr);
  const amanha = chaveDia(new Date(agoraBr.getTime() + DIA_MS));
  const k = chaveDia(p.dia);
  const base =
    k === hoje
      ? "hoje"
      : k === amanha
        ? `amanhã, ${diaMes(p.dia)}`
        : `${SEMANA[p.dia.getUTCDay()]}, ${diaMes(p.dia)}`;
  return p.hora ? `${base}, às ${p.hora}` : base;
};

/** Situação de uma fonte a partir das tentativas (qualquer ordem). */
export function situacaoDaFonte(fonte: Fonte, tentativas: Tentativa[], agora: Date): SituacaoFonte {
  const lista = [...tentativas].sort((a, b) => b.quando.localeCompare(a.quando));
  const agoraBr = paraBr(agora);
  const hoje = chaveDia(agoraBr);
  const okHoje = lista.some((t) => t.ok && chaveDia(paraBr(t.quando)) === hoje);
  const atualizacao = lista.find((t) => t.ok && t.atualizou !== false);
  const ultimaOk = lista.find((t) => t.ok);
  const ultima = lista[0];

  let estado: Estado = "em-dia";
  let aviso: string | null = null;
  const dados = atualizacao ? diaMes(paraBr(atualizacao.quando)) : null;
  if (!atualizacao) {
    estado = "aguardando";
    if (ultima && !ultima.ok)
      aviso = `${motivoPopular(ultima.erro)} na tentativa de ${diaMes(paraBr(ultima.quando))}. Ainda não há dados desta fonte no site.`;
  } else if (ultima && !ultima.ok && (!ultimaOk || ultima.quando > ultimaOk.quando)) {
    estado = "atrasada";
    aviso = `${motivoPopular(ultima.erro)} na tentativa de ${diaMes(paraBr(ultima.quando))}. Os números mostrados são de ${dados}.`;
  } else if (
    fonte.prazoDias !== null &&
    agora.getTime() - new Date(ultimaOk!.quando).getTime() > fonte.prazoDias * DIA_MS
  ) {
    estado = "atrasada";
    aviso = `Não houve atualização no prazo previsto. Os números mostrados são de ${dados}.`;
  }

  const s: SituacaoFonte = {
    id: fonte.id,
    nome: fonte.nome,
    inclui: fonte.inclui,
    frequencia: fonte.frequencia,
    estado,
    ultimaAtualizacao: atualizacao ? dataHoraBr(atualizacao.quando) : null,
    aviso,
    proximaTentativa: textoProxima(agoraBr, fonte.proxima(agoraBr, okHoje)),
  };
  if (fonte.historico) s.dias = ultimosDias(lista, agoraBr, 14);
  return s;
}

/** Um valor por dia (mais antigo primeiro): atualizou, tentou e não conseguiu, ou não rodou. */
export function ultimosDias(tentativas: Tentativa[], agoraBr: Date, n: number): Dia[] {
  const porDia = new Map<string, Dia>();
  for (const t of tentativas) {
    const k = chaveDia(paraBr(t.quando));
    if (t.ok) porDia.set(k, "ok");
    else if (!porDia.has(k)) porDia.set(k, "falha");
  }
  return Array.from(
    { length: n },
    (_, i) => porDia.get(chaveDia(new Date(agoraBr.getTime() - (n - 1 - i) * DIA_MS))) ?? "sem",
  );
}

export function calcularSituacao(
  tentativas: Partial<Record<IdFonte, Tentativa[]>>,
  agora: Date,
): Situacao {
  return {
    conferidoEm: agora.toISOString(),
    fontes: FONTES.map((f) => situacaoDaFonte(f, tentativas[f.id] ?? [], agora)),
  };
}
