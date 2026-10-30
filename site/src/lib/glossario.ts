/** Termos técnicos com explicação ao tocar (story 2.3, CA2). Linguagem do dia a dia. */
export const GLOSSARIO: Record<string, string> = {
  "cota parlamentar":
    "Verba mensal paga com dinheiro público para despesas do mandato: passagens, aluguel de escritório, combustível, divulgação. O valor muda conforme o estado.",
  "votação simbólica":
    "O presidente da sessão pergunta quem é contra e olha o plenário. Não fica registrado como cada um votou.",
  "votações nominais":
    "Cada parlamentar vota no painel eletrônico e o voto de cada um fica público. É diferente da votação simbólica.",
  "falta foi justificada":
    "Ausência com motivo aceito pela Casa: viagem a serviço (missão), licença médica, licença-maternidade ou decisão da Mesa.",
  "decisão da Mesa":
    "A Mesa é o grupo que comanda a Casa (presidente, vice e secretários). Ela pode abonar faltas.",
  "autor principal":
    "Quem escreveu e apresentou o projeto. Os outros que assinam junto são coautores.",
  homenagem:
    "Projeto que dá nome a rua, ponte ou prédio, cria data comemorativa ou dá título a cidade. Contamos separado para não inflar o número de projetos.",
  "voto secreto":
    "Em algumas votações (como escolha de autoridades), o voto é secreto: só aparece que a pessoa votou, não em quê.",
  emendas:
    "Pedaço do orçamento da União que cada deputado e senador pode indicar para uma cidade, um estado ou uma entidade. O governo é obrigado a pagar a maior parte delas.",
  "emendas Pix":
    "Tipo de emenda em que o dinheiro cai direto no caixa da prefeitura ou do estado, sem convênio. Desde 2024 o STF exige plano de ação e prestação de contas.",
  "já foi pago":
    "O governo reserva o dinheiro primeiro (empenho), confere a entrega e só depois paga. Aqui mostramos o que já saiu do caixa da União.",
  licença: "Afastamento autorizado do mandato, por saúde, interesse particular ou missão oficial.",
};

export type Segmento = { texto: string; termo?: string };

/** Divide o texto marcando a 1ª ocorrência de cada termo do glossário (sem diferenciar maiúsculas). */
export function segmentar(texto: string, jaUsados = new Set<string>()): Segmento[] {
  const termos = Object.keys(GLOSSARIO).sort((a, b) => b.length - a.length);
  const lower = texto.toLowerCase();
  for (const termo of termos) {
    if (jaUsados.has(termo)) continue;
    const i = lower.indexOf(termo.toLowerCase());
    if (i >= 0) {
      jaUsados.add(termo);
      return [
        ...segmentar(texto.slice(0, i), jaUsados),
        { texto: texto.slice(i, i + termo.length), termo },
        ...segmentar(texto.slice(i + termo.length), jaUsados),
      ].filter((s) => s.texto);
    }
  }
  return [{ texto }];
}
