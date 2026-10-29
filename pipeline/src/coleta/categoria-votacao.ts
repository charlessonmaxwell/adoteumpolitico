/**
 * Classifica uma votação pelo que estava em jogo (story 3.1).
 * Regras fixas e auditáveis, ajustadas com as descrições reais de 2026 da Câmara e do Senado.
 *
 * - principal: o projeto em si (texto-base, substitutivo, turno de PEC, MP)
 * - emenda: mudança pontual no texto (emenda de plenário, de redação)
 * - destaque: votação em separado de um trecho ("Mantido o texto": SIM = manter o trecho)
 * - procedimento: urgência, requerimento, recurso, preferência
 * - autoridade: escolha de autoridade no Senado (mensagem/ofício; em geral secreta)
 * - outra: sem padrão reconhecido
 */
export type CategoriaVotacao =
  "principal" | "emenda" | "destaque" | "procedimento" | "autoridade" | "outra";

export function categorizarVotacao(descricao: string): CategoriaVotacao {
  const d = descricao.toLowerCase();
  if (/ressalvad[oa]s? (o|os) destaques?/.test(d)) return "principal"; // texto-base, destaques votados depois
  if (
    /requerimento|urgência|recurso|preferência|adiamento|retirada de pauta|encerramento da discussão/.test(
      d,
    )
  )
    return "procedimento";
  if (/mantid[oa] o texto|destaque/.test(d)) return "destaque";
  if (/(mensagem|ofício) n[º°o]/.test(d)) return "autoridade";
  if (/emendas? de plenário|emenda de redação|emendas? n[º°o]\s*\d+(?!\s*\(substitutivo\))/.test(d))
    return "emenda";
  if (/projeto|proposta de emenda|medida provisória|substitutiv|turno/.test(d)) return "principal";
  return "outra";
}

export const ROTULO_CATEGORIA: Record<CategoriaVotacao, string> = {
  principal: "Votação do projeto",
  emenda: "Emenda (mudança no texto)",
  destaque: "Destaque (votação de um trecho)",
  procedimento: "Procedimento (urgência, requerimento)",
  autoridade: "Escolha de autoridade",
  outra: "Outra votação",
};
