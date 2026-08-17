# GENESIS LLA V10.7 — compatibilidade R para KM/Cox

- Corrige a divergência reportada pelo professor em Kaplan–Meier: o modo exploratório basal podia produzir 21/21 ao trabalhar com 42 casos completos.
- Adiciona **Compatibilidade R** para TARGET ALL, preservando todas as amostras do perfil de expressão alinhadas ao clínico, como no Script.R do projeto.
- No modo R, valores ausentes de expressão são imputados pela mediana do gene antes de KM/Cox, seguindo a ordem do pipeline R.
- Mantém **Basal por paciente** como modo alternativo e metodologicamente distinto.
- Interface mostra explicitamente qual modo e denominador foram usados.
- Novo teste de regressão: 92 observações válidas devem resultar em 46 Alto / 46 Baixo após corte pela mediana.
- DATA_VERSION atualizado para 9 para impedir reaproveitamento de cache antigo incompatível.

Observação: o arquivo `TARGET_ALL_analise_ajustado.R` recebido termina no bloco de heatmap e não contém os blocos de KM/Cox; a compatibilidade de KM/Cox usa a lógica do Script.R anterior do projeto, que continha essas etapas.
