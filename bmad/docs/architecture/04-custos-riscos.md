# Custos e Riscos

## Custo mensal estimado (MVP)
| Item | Custo | Observação |
|---|---|---|
| Hospedagem (Cloudflare Pages) | R$ 0 | Banda ilimitada no plano gratuito |
| Rotinas (GitHub Actions) | R$ 0 | Gratuito em repositório público |
| Busca, métricas, Worker, anti-spam | R$ 0 | Planos gratuitos |
| Domínio `.com.br` | ~R$ 4 | ~R$ 40/ano |
| IA recorrente | ~R$ 5–15 | Só itens novos |
| **Total recorrente** | **~R$ 10–20/mês** | Teto: R$ 50 |
| IA — carga inicial do histórico | ~R$ 50–150 (uma vez) | Estimativa; validar preço vigente da API antes |

Custo humano recorrente: ~1–2 h/mês (confirmar lista do épico 6 + revisar casos ambíguos e reportes).

## Riscos
| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | Fonte oficial muda formato ou sai do ar | Média | Alto | Validação de volume aborta publicação; site antigo continua no ar; issue automática |
| R2 | Raspagem de presença quebra (mudança no HTML) | Média | Baixo | Degrada para presença/ausência sem motivo (já previsto no PRD) |
| R3 | IA gera resumo/etiqueta com viés ou erro | Média | Alto | Palavras proibidas, trava do épico 6, aviso "gerado automaticamente", botão reportar erro |
| R4 | Troca de legislatura (01/02/2027) | Certa | Médio | `idLegislatura` no modelo desde o início; planejar lançamento considerando a data |
| R5 | Repositório privado (se escolhido) consome minutos pagos do Actions | Baixa | Baixo | Manter público; rotina diária ~10 min cabe até nos 2.000 min/mês do plano gratuito privado |
| R6 | Pico de acesso | Baixa | Baixo | CDN absorve sem custo |
| R7 | Questionamento jurídico por parlamentar | Baixa | Alto | Só dado oficial com fonte e data; sem adjetivos; metodologia pública |
