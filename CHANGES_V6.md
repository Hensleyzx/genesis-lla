# GENESIS LLA — V6 Perfis Semelhantes

## Alterações principais

1. **Remoção de linguagem de probabilidade individual**
   - A tela de resultados não mostra probabilidades individuais de desfecho.
   - Curvas de Kaplan-Meier são rotuladas como experiência observada em grupos de pacientes da coorte de referência.

2. **Pareamento de pacientes semelhantes**
   - O caso pode ser comparado com pacientes de cada coorte usando variáveis disponíveis e informadas pelo usuário.
   - Critérios possíveis: alteração genética presente/ausente, expressão, subtipo molecular, idade, leucócitos, sexo e BCR-ABL1.
   - O índice de similaridade é heurístico e serve apenas para ordenar perfis de pesquisa; não é acurácia clínica.
   - Cada estudo produz sua própria curva de pacientes semelhantes; estudos não são fundidos quando escalas/endpoints diferem.

3. **Análise em 1–5 estudos na mesma execução**
   - A tela Nova Análise permite marcar até cinco coortes já carregadas.
   - O resultado mostra comparação por estudo, qualidade, número de pacientes semelhantes, eventos e força do pareamento.

4. **Heatmap mutacional dos Top 30 genes**
   - Oncoprint binário simplificado na Central de Bioinformática.
   - Linhas = Top 30 genes mais mutados.
   - Colunas = amostras basais sequenciadas.
   - Célula preenchida = alteração detectada.

5. **Entrada de alterações por gene**
   - Cada gene pode ser marcado como: Não informado / Alteração detectada / Sem alteração detectada.
   - “Não informado” nunca é interpretado como ausência.

6. **Script.R / WebR**
   - Scripts com BiocManager/cBioPortalData/Bioconductor são identificados como pipeline R externo.
   - O R Lab impede a execução integral desses scripts e direciona para os módulos web do GENESIS ou RStudio.

## Observação metodológica

A V6 continua sendo uma plataforma acadêmica de pesquisa. O pareamento por similaridade não foi validado como modelo clínico e não deve ser apresentado como diagnóstico individual.
