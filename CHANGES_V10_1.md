# GENESIS V10.1 — correção da central de Resultados

Esta revisão corrige uma falha da primeira V10: `resultados.html` ainda carregava a tela antiga do resultado validado e `src/js/resultados.js` ainda continha o fluxo de R Server.

## Corrigido
- `resultados.html` agora abre a Central de Resultados real (`src/js/resultados.js`).
- Removido o fluxo de R Server da área principal e removidos arquivos mortos de integração com servidor.
- Seleção/carregamento do estudo passou para Resultados.
- Top 10 de genes é atualizado a partir dos dez primeiros do Top 30 mutacional da coorte ativa.
- Usuário pode selecionar 1, vários, todos os 10 ou adicionar outro gene.
- Usuário escolhe quais gráficos gerar: Top 30, heatmap mutacional, Top DEGs, Volcano, Cox e Kaplan-Meier.
- Cox usa somente os genes escolhidos pelo usuário.
- Kaplan-Meier gera uma curva separada para cada gene escolhido.
- Todos os cálculos locais são marcados como `EXPLORATÓRIO LOCAL` até comparação com a mesma saída R.
- O Top 30 R já validado (TARGET ALL n=150) permanece separado e claramente identificado.
- Dashboard registra apenas os gráficos solicitados.
