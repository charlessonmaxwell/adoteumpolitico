import { describe, expect, it } from "vitest";
import { categorizarVotacao } from "../pipeline/src/coleta/categoria-votacao.js";

// Descrições reais de 2026 (Câmara e Senado)
const casos: [string, string][] = [
  ["Aprovado o Requerimento de Urgência (Art. 155 do RICD). Sim: 320; Não: 67", "procedimento"],
  ["Rejeitado o Requerimento. Sim: 11; Não: 387; Total: 398.", "procedimento"],
  ["Rejeitado o Recurso nº 12, de 2026, contra parecer terminativo", "procedimento"],
  ["Aprovada a preferência. Sim: 300; Não: 100", "procedimento"],
  ["Mantido o texto. Sim: 280; Não: 150; Total: 430.", "destaque"],
  ["Aprovado o Projeto de Lei nº 1.234, de 2026, ressalvado o destaque. Sim: 300", "principal"],
  [
    "Aprovado o Substitutivo ao Projeto de Lei Complementar nº 80, de 2026, adotado pelo relator",
    "principal",
  ],
  [
    "Aprovada a Subemenda Substitutiva Global ao Projeto de Lei Complementar nº 186, de 2026",
    "principal",
  ],
  [
    "Rejeitada a Subemenda Substitutiva ao Projeto de Lei Complementar nº 281, de 2019",
    "principal",
  ],
  ["Aprovada, em segundo turno, a Proposta de Emenda à Constituição nº 66, de 2023", "principal"],
  [
    "Aprovada a Medida Provisória nº 1.300 de 2026, na forma do Projeto de Lei de Conversão",
    "principal",
  ],
  ["Rejeitada a Emenda de Plenário nº 3. Sim: 100; Não: 300", "emenda"],
  ["Rejeitada a Emenda de Plenário ao Substitutivo. Sim: 100", "emenda"],
  ["Aprovada a Emenda de Redação nº 1. Sim: 400", "emenda"],
  [
    "Votação nominal do Projeto de Lei Complementar nº 186, de 2026, nos termos do parecer.",
    "principal",
  ],
  [
    "Votação nominal da Proposta de Emenda à Constituição nº 221, de 2019, em primeiro turno.",
    "principal",
  ],
  [
    "Votação nominal da Emenda nº 1 (Substitutivo) ao Projeto de Lei Complementar nº 22, de 2025",
    "principal",
  ],
  ["Votação nominal da Emenda nº 3 ao Projeto de Lei Complementar nº 22, de 2025", "emenda"],
  ["Votação nominal da Mensagem nº 45, de 2026 - Fulano de Tal (embaixador).", "autoridade"],
  ["Votação nominal do Ofício nº 12, de 2026 - Beltrano (CNJ).", "autoridade"],
  ["Resultado. Sim: 300; Não: 100; Abstenção: 2; Total: 402.", "outra"],
];

describe("Story 3.1 — categoria da votação (descrições reais)", () => {
  it.each(casos)("%s → %s", (descricao, esperado) => {
    expect(categorizarVotacao(descricao)).toBe(esperado);
  });
});
