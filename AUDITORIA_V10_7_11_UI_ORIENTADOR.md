# Auditoria V10.7.11 — UI do orientador

## Mudança solicitada
O orientador identificou redundância entre o painel fixo dos 10 genes e a categoria Sobrevida. A interface foi reorganizada para que o usuário escolha primeiro o tipo de análise e veja os genes dentro da própria categoria quando necessário.

## Alterações
- removido o layout em duas colunas `genes × visualizações`;
- adicionadas categorias acionáveis: Mutações, Sobrevida, Perfil demográfico e Expressão diferencial;
- genes de Sobrevida agora aparecem somente ao abrir a categoria Sobrevida;
- seleção de genes sincronizada entre Mutações, Sobrevida e Perfil demográfico;
- Top DEGs e Volcano não exibem seletor manual de genes;
- mantido um único botão `Gerar gráficos selecionados`;
- mantidos os blocos/carrosséis de resultados separados por tipo de análise;
- nenhuma fórmula científica, referência R ou denominador foi alterado.

## Verificações
- `node --check src/js/resultados.js`;
- suíte `npm test`;
- `npm run build`: não pôde ser concluído neste ambiente porque o executável local do Vite não está instalado; `npm ci --offline` também não pôde restaurá-lo por ausência do pacote `yocto-queue` no cache. A suíte de testes Node e a validação de sintaxe foram concluídas.
