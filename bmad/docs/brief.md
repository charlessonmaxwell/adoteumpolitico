# Project Brief — Meu Político de Estimação

> Status: em construção pelo Analyst. Checkpoint humano obrigatório antes da fase PM.

## Ideia
Portal público e popular que mostra o desempenho de cada deputado e senador, em linguagem simples, sem termos técnicos, com dados de fontes diversas.

## Público-alvo
Eleitor comum: acesso via Web (navegador), com layout responsivo para celular. Consulta rápida, linguagem popular.

## Abrangência do MVP
Federal completo: 513 deputados + 81 senadores.

## Desempenho — métricas do MVP
1. Presença e votações
2. Gastos (cota parlamentar)
3. Projetos apresentados
4. Impacto para a população — votos e projetos ligados a poder de compra, carga tributária e geração de receita para o país. Trazido de volta ao MVP por decisão do usuário.
   - **Método: fato rotulado.** Cada votação selecionada recebe etiqueta objetiva com fonte (ex.: "reduz imposto sobre X", "aumenta gasto público em R$ Y"), baseada em fontes oficiais (IFI, notas técnicas de impacto orçamentário). O portal mostra como o parlamentar votou; o julgamento é do eleitor. Sem notas ou rankings.
   - **Escopo:** apenas votações de maior impacto econômico (ordem de 20–30/ano), para controlar custo de curadoria.
   - **Geração: automática com trava.** IA gera a etiqueta a partir da nota técnica; publica sozinha só quando há fonte oficial com valor explícito. Casos ambíguos vão para fila de revisão humana. Toda etiqueta exibe a fonte, o aviso "gerado automaticamente" e botão "reportar erro".
   - **Fontes adicionais:** IFI (Instituição Fiscal Independente), notas técnicas de impacto orçamentário da Câmara/Senado.

## Fontes de dados (MVP)
- API de Dados Abertos da Câmara dos Deputados — presença, votações, cota parlamentar, proposições
- API de Dados Abertos do Senado Federal — equivalentes

## Concorrentes / referências
| Referência | Foco | Lacuna frente ao nosso público |
|---|---|---|
| Ranking dos Políticos | Nota/ranking de parlamentares | Atribui juízo de valor; alvo de críticas de viés ideológico |
| Congresso em Foco (plataformas) | Jornalismo e dados do Congresso | Linguagem jornalística, não popular |
| Quem Foi Quem | Como cada parlamentar votou | Recorte de votações selecionadas, com curadoria editorial |
| Operação Serenata de Amor (robô Rosie) | Fiscalização de gastos da cota | Foco técnico/fiscalizatório, não consulta do eleitor |
| Excelência Parlamentar (Poder360) | Prêmio/avaliação anual | Evento pontual, não consulta contínua |

**Oportunidade:** nenhum combina, num só lugar, presença + gastos + projetos, em linguagem popular, web responsiva e sem dar nota ao parlamentar.

## Restrições
- Neutralidade: mostrar fatos e fontes, nunca notas ou adjetivos sobre o parlamentar
- LGPD: só dados públicos do exercício do mandato
- Custo: infraestrutura mínima; principal custo variável é a camada de linguagem popular (textos explicativos), que cresce com o volume de 594 parlamentares

## Critério de sucesso do MVP
Visitas / usuários únicos.
Risco registrado: mede alcance, não compreensão. Sugestão para a v2: complementar com taxa de compartilhamento.

## Sustentação
Ainda não definida — hipótese a validar.
