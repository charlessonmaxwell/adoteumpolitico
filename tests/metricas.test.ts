import { describe, expect, it } from "vitest";
// @ts-expect-error script .mjs sem tipos
import { paraLinhas } from "../scripts/enviar-metricas.mjs";

describe("monitoramento — métricas para o Grafana", () => {
  it("converte execução, etapas, contagens e extras em linhas Influx", () => {
    const linhas: string[] = paraLinhas({
      workflow: "diario",
      resultado: "falha",
      etapaFalha: "validacao",
      duracaoTotalS: 82,
      etapasS: { cadastro: 2, gastos: 23.4 },
      contagens: { parlamentares: 594, "despesas/camara-2026": 118988 },
      travaDisparou: true,
      mudou: null,
      extras: { falhas_2026: 0 },
    });
    expect(linhas).toEqual([
      "rotina_execucao,workflow=diario,resultado=falha,etapa_falha=validacao sucesso=0,duracao_total_s=82,trava_disparou=1,mudou=0",
      "rotina_etapa,workflow=diario,etapa=cadastro duracao_s=2",
      "rotina_etapa,workflow=diario,etapa=gastos duracao_s=23.4",
      "rotina_contagem,workflow=diario,tipo=parlamentares,casa=todas,ano=todos valor=594",
      "rotina_contagem,workflow=diario,tipo=despesas,casa=camara,ano=2026 valor=118988",
      "rotina_extra,workflow=diario,nome=falhas_2026 valor=0",
    ]);
  });
});
