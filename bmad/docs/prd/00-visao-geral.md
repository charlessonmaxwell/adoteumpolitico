# PRD — Visão Geral · Meu Político de Estimação

## Problema
O eleitor comum não tem um lugar simples para saber o que seu deputado ou senador faz no mandato. Os dados existem (dados abertos oficiais), mas estão dispersos, em linguagem técnica, e as iniciativas existentes ou atribuem notas (risco de viés) ou cobrem só um recorte.

## Público
Eleitor comum. Web responsiva (desktop primeiro, adaptado ao celular). Consulta rápida, sem termos técnicos.

## Objetivo do MVP
Permitir que qualquer eleitor encontre um parlamentar federal e entenda, em linguagem popular, presença, votos, gastos, projetos e o impacto econômico das principais votações.

## Métrica de sucesso
Visitas / usuários únicos (instrumentado desde o lançamento).

## Princípios de produto
1. **Neutralidade:** fatos + fonte. Nunca nota, ranking ou adjetivo sobre o parlamentar.
2. **Linguagem popular:** todo número acompanhado de explicação simples ("faltou 12 de 100 sessões").
3. **Fonte sempre visível:** todo dado linka para a origem oficial.
4. **Custo mínimo:** automação antes de operação manual.

## Requisitos não funcionais (decisões para o Architect)
| # | Requisito |
|---|---|
| RNF-01 | Cobertura: 513 deputados + 81 senadores (legislatura atual) |
| RNF-02 | Atualização automática dos dados ao menos 1x/dia |
| RNF-03 | Página de perfil carrega em < 3s em conexão 4G |
| RNF-04 | Responsivo: funcional de 360px a desktop |
| RNF-05 | Apenas dados públicos do mandato (LGPD) |
| RNF-06 | Infraestrutura de custo mínimo; custo de IA (textos e etiquetas) estimado e monitorado |
| RNF-07 | Acessibilidade básica (contraste, leitura em tela) |
| RNF-08 | Toda informação rastreável à fonte (link + data de coleta) |

## Fora do escopo do MVP
- Parlamentares estaduais/municipais
- Notas, rankings ou comparativos de "melhor/pior"
- App nativo
- Login/contas de usuário
- Processos judiciais e ficha criminal

## Em aberto
- Modelo de sustentação (hipótese a validar)
