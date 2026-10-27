# Pipeline de Dados

## Frequência
| Fonte | Frequência | Motivo |
|---|---|---|
| Cadastro (Câmara/Senado) | Diária | Barato; capta suplente que assumiu |
| Votos e votações | Diária | Arquivos em lote atualizados de madrugada |
| Cota parlamentar / CEAPS | Diária | Arquivos atualizados de madrugada |
| Proposições / processos | Diária | Incremental (só novos e com mudança de situação) |
| Presença Câmara (HTML) | **Semanal**, com pausa entre páginas | 513 páginas; raspagem frágil e não pode sobrecarregar o site da Câmara |
| Licenças Senado | Semanal | Muda pouco |

## Fontes por épico (confirmadas em `docs/analise-fontes.md`)
| Épico | Câmara | Senado |
|---|---|---|
| 1/2 Cadastro | API `/deputados` | API `/senador/lista/atual` |
| 3 Votos | Arquivos `votacoes-AAAA`, `votacoesVotos-AAAA`, `votacoesProposicoes-AAAA` | `/plenario/lista/votacao/{ini}/{fim}` + `/senador/{cod}/votacoes` |
| 3 Presença | `/eventos/{id}/deputados` + HTML `presenca-plenario` (motivos) | Comparecimento em votações + `/senador/{cod}/licencas` |
| 4 Gastos | Arquivo `cotas/Ano-AAAA.json.zip` | API CEAPS `/despesas_ceaps/{ano}` |
| 5 Projetos | API `/proposicoes?idDeputadoAutor` | `/processo?codigoParlamentarAutor` |

**Proibido usar:** endpoint `/despesas` da Câmara (vazio); `/votacao` e `/autorias` do Senado (503).

## Etapas
1. **Coleta:** download para pasta temporária; retentativa com espera crescente (Câmara retorna 429 sob carga)
2. **Validação:**
   - despesa com data futura/inválida → fora dos totais, registrada em log de qualidade
   - campos pessoais (CPF) descartados na coleta, nunca persistidos
   - queda brusca de volume vs. dia anterior (>30%) → aborta publicação e abre issue (protege contra fonte quebrada)
3. **Normalização:** modelo único para Câmara e Senado (`Parlamentar`, `Voto`, `Despesa`, `Proposicao`, `Presenca`) com campo `casa`
4. **Agregação:** um JSON por parlamentar (resumo + detalhes paginados) + JSON da média por casa
5. **Persistência:** JSON tratado versionado em branch `data` do repositório (histórico gratuito e auditável); arquivos brutos não são guardados (re-baixáveis)

## Escopo temporal
- Legislatura atual completa (2023–2026)
- **Atenção:** nova legislatura começa em 01/02/2027. Modelo de dados guarda `idLegislatura` desde o início para não quebrar a troca de 513 deputados e 1/3 do Senado

## Falhas
- Falha de coleta → mantém o último site publicado no ar com a data da última atualização visível; abre issue automática
- Nenhuma etapa publica dados parciais
