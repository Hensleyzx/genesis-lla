# GENESIS LLA V9 — Resultados R validados

## Mudança de estratégia
O R Server foi retirado do fluxo principal. O GENESIS passa a incorporar resultados científicos um gráfico por vez, sempre comparados com uma saída R fornecida pelo projeto.

## Etapa 1 — Top 30 genes mais mutados/alterados
- Coorte exibida no R: TARGET ALL, n=150 amostras.
- O site usa exatamente os 30 percentuais mostrados no gráfico R fornecido.
- Nenhuma frequência é gerada aleatoriamente ou estimada pelo navegador.
- A página `resultados.html` agora abre o módulo de resultados R validados.
- O gráfico R original foi incluído apenas como referência visual/auditoria.
- A tabela numérica que alimenta o gráfico fica visível na página.

## Limite científico
A validação atual garante igualdade com a precisão exibida no gráfico R (1 casa decimal quando aplicável). Para casas decimais adicionais, variantes e amostras individuais, deve-se usar o CSV original `top30_genes_mutados.csv` produzido pelo R.

## Próximos gráficos
Kaplan-Meier e Cox/Forest não serão reconstruídos apenas a partir de imagem, porque isso exigiria inventar tempos de evento/censura ou intervalos não exibidos. Para esses gráficos, usar a tabela/CSV original do R ou o dataset que alimentou `survfit()`/`coxph()`.
