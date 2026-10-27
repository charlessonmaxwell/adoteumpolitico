# BMAD — Checklist de Setup · Meu Político de Estimação

## Instalado (manual, Claude.ai — sem npm)
```
bmad/
├── agents/  analyst.md · pm.md · orchestrator.md
├── docs/    brief.md (semente) · prd/index.md (sharded)
└── bmad-setup-checklist.md
```
Escopo: greenfield médio/grande. Agentes ativos: Analyst, PM, Orchestrator.

## Otimizações
| # | Otimização | Status | Onde |
|---|---|---|---|
| 2.1 | Lazy-load de knowledge | ✅ Aplicada | analyst.md, pm.md |
| 2.2 | Sharding do PRD | ✅ Aplicada (arquitetura fica para depois) | docs/prd/, pm.md |
| 2.3 | Modelo por fase | ⏸️ Adiada pelo usuário | — |
| 2.4 | MCPs desabilitados por padrão | ✅ Aplicada | orchestrator.md |
| 2.5 | Checkpoint humano | ✅ Aplicada em Analyst e PM | analyst.md, pm.md |

## Próximos passos manuais
- [ ] Desligar conectores não usados nas sessões do projeto (lista em orchestrator.md) — sem isso, 2.4 não economiza nada
- [ ] Instalar Architect antes de qualquer story de Dev (aplicar lazy-load, sharding de arquitetura e checkpoint nele)
- [ ] Revisitar 2.3 (modelo por fase) antes da fase de Dev
- [ ] Subir `bmad/` para um repositório quando quiser (e depois migrar para `npx bmad-method install`, se for usar Claude Code)

## Impacto esperado (qualitativo, não medido)
- Maior economia: 2.4 (muitos conectores eliminados do contexto) e 2.2 (stories carregam só seu épico, efeito forte na fase de Dev)
- Moderada: 2.1 (concentrada no PM; QA não instalado)
- Indireta: 2.5 (evita retrabalho de PRD e brief, o tipo mais caro)
