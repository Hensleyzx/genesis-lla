# Teste rápido — V6

1. `npm install`
2. `npm run build`
3. `npm run dev`
4. Bioinformática: carregar um estudo com mutações e conferir **Top 30 genes mais mutados** + **Heatmap mutacional Top 30**.
5. Carregar 2–5 estudos.
6. Nova Análise: marcar pelo menos 2 estudos.
7. Informar pelo menos dois critérios para pareamento, por exemplo:
   - idade + subtipo molecular;
   - alteração TP53 + expressão IKZF1;
   - BCR-ABL1 + idade + leucócitos.
8. Selecionar genes e marcar o status de alteração quando conhecido.
9. Concluir a análise.
10. Resultados: conferir a seção **Pacientes com perfil semelhante ao caso**.
11. Confirmar que nenhuma curva é rotulada como probabilidade individual do caso.
12. Importar o `Script_original_usuario.R`: a interface deve avisar que Bioconductor requer R/RStudio e não deve tentar executar o pipeline completo no WebR.
