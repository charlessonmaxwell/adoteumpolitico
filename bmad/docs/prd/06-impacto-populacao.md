# Épico 6 — Impacto para a população

## Objetivo
Mostrar como o parlamentar votou nas decisões de maior impacto econômico (poder de compra, impostos, receita do país), como fato rotulado com fonte, sem julgamento.

## Stories
### 6.1 Seleção das votações de impacto
- CA1: unidade de rotulagem = **proposição** (não a votação); exibe o voto do parlamentar no texto principal e, opcionalmente, nos destaques
- CA2: só proposições com votação nominal; volume medido em 2025: ~25 proposições econômicas na Câmara (69 votações) + ~10 estimadas no Senado → **~25–35/ano**
- CA3: pré-seleção automática por palavras-chave na ementa; confirmação da lista por revisão (o filtro tem falsos positivos)
- CA4: critério de seleção documentado e público no portal

### 6.2 Geração automática de etiquetas (com trava)
Como sistema, quero gerar a etiqueta de impacto a partir da nota técnica oficial.
- CA1: etiqueta objetiva (ex.: "reduz imposto sobre X", "aumenta gasto público em R$ Y")
- CA2: publicação automática só quando há fonte oficial (IFI, nota técnica de impacto orçamentário) com valor explícito
- CA3: casos sem fonte clara ou ambíguos vão para fila de revisão humana e não são publicados até aprovação

### 6.3 Exibição no perfil
- CA1: votação, etiqueta e voto do parlamentar lado a lado
- CA2: toda etiqueta exibe fonte, aviso "gerado automaticamente" e botão "reportar erro"
- CA3: nenhuma soma, nota ou saldo "a favor/contra a população"

### 6.4 Reporte de erro
- CA1: reporte envia a etiqueta para a fila de revisão
- CA2: etiqueta com muitos reportes é ocultada até revisão (limiar a definir)

## Dependências
Épicos 1, 2 e 3.
