# Site

## Páginas geradas
| Página | Quantidade | Conteúdo |
|---|---|---|
| Início + busca | 1 | Busca por nome, UF, partido |
| Estado | 27 | Bancada da UF |
| Perfil | ~600 | Resumo dos épicos 3–6 |
| Detalhe (votos, gastos, projetos) | ~1.800 | Listas paginadas |
| Votação/proposição | ~500/ano | Resumo popular + como cada um votou |
| Metodologia e fontes | 1 | Critérios públicos (neutralidade, épico 6) |

## Decisões
- **Responsivo:** desktop primeiro, adaptado de 360px em diante (RNF-04)
- **Busca:** Pagefind, índice gerado no build; tolera erro de digitação
- **Compartilhamento:** cada perfil gera imagem de prévia (Open Graph) no build — nome, foto e UF, sem números (evita recorte fora de contexto)
- **Fonte visível:** todo dado com link para a origem e data de coleta (RNF-08)
- **Textos de métricas:** modelos de frase fixos ("faltou 12 de 100 sessões"), sem IA — custo zero e sem risco de alucinação
- **Acessibilidade:** contraste AA, navegação por teclado, textos alternativos (RNF-07)
- **Performance:** página pronta servida por CDN; alvo < 3s em 4G (RNF-03)

## "Reportar erro"
Botão abre formulário simples → Cloudflare Worker (plano gratuito) → cria issue no GitHub com o link da página. Sem login, com proteção anti-spam (Turnstile, gratuito).
