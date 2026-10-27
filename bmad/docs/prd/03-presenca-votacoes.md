# Épico 3 — Presença e votações

## Objetivo
Mostrar se o parlamentar comparece e como vota.

## Stories
### 3.1 Presença
- CA1 (Câmara): percentual e número absoluto de presenças vs. sessões de plenário no período
- CA2 (Câmara): ausências separadas por motivo (ex.: missão autorizada, licença) — fonte: página HTML de presença (raspagem); se a coleta falhar, exibir só presença/ausência
- CA3 (Senado): comparecimento em votações nominais, por tipo (votou, atividade parlamentar, ausência comunicada, afastamento) + licenças. Rotular explicitamente como "comparecimento em votações", não "presença em sessões"
- CA4: comparação neutra com a média da casa (dado, sem adjetivo); nunca comparar Câmara x Senado, pois as métricas são diferentes

### 3.2 Histórico de votos
- CA1: votações nominais com o voto do parlamentar (sim, não, abstenção, ausente)
- CA2: votações simbólicas exibidas com o resultado (aprovado/rejeitado) e o aviso "votação simbólica — não há registro de voto individual"
- CA3: votações secretas exibidas com o resultado e o aviso "votação secreta"
- CA4: cada votação com resumo em linguagem popular do que estava sendo decidido
- CA5: filtro por período e por tema

## Limitações de fonte (confirmadas em 27/10/2026)
- Voto individual só existe em votações nominais (ex.: 6 de 80 no plenário da Câmara em set–out/2026)
- Senado não publica presença por sessão
- Justificativa de ausência na Câmara não está na API

## Dependências
Épicos 1 e 2.
