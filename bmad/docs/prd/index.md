# PRD — Índice (sharded)

> Cada épico vive em seu próprio arquivo. Agentes carregam só o épico relevante.
> Mantido pelo PM a cada /prd ou /epics.

## Visão geral
Arquivo: `00-visao-geral.md` — problema, público, objetivos, princípios, requisitos não funcionais, fora de escopo.

## Épicos (ordem = prioridade de entrega)
| # | Épico | Arquivo | Depende de | Status |
|---|---|---|---|---|
| 1 | Fundação de dados | `01-fundacao-de-dados.md` | — | Rascunho |
| 2 | Busca e perfil do parlamentar | `02-perfil-parlamentar.md` | 1 | Rascunho |
| 3 | Presença e votações | `03-presenca-votacoes.md` | 1, 2 | Rascunho |
| 4 | Gastos da cota parlamentar | `04-gastos-cota.md` | 1, 2 | Rascunho |
| 5 | Projetos apresentados | `05-projetos.md` | 1, 2 | Rascunho |
| 6 | Impacto para a população | `06-impacto-populacao.md` | 1, 2, 3 | Rascunho |

## Convenção
- Nome: `NN-slug-do-epico.md`
- Cada arquivo contém: objetivo, stories, critérios de aceite, dependências
