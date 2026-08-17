# AUDITORIA V10.7.3 — Heatmap demográfico

## Base
V10.7.2 preservada. Nenhum CSV, resultado R, Kaplan-Meier, Cox, Top 30 ou DEA foi alterado.

## Solicitação
Adicionar um heatmap de genes estratificado por sexo e idade, inspirado na figura enviada pelo orientador, sem copiar dados de outro contexto oncológico.

## Verificação do arquivo R recebido
O `TARGET_ALL_analise_ajustado(1).R` contém os heatmaps de Top 40/Top 15 DEGs (Relapse vs None), mas não contém um heatmap por sexo/idade. O novo gráfico demográfico do site é, portanto, uma visualização adicional e permanece marcado como exploratório.

## Dados
O clinical_data.csv usado no GENESIS-R contém SEX, AGE e AGE_IN_DAYS. Em 755 PATIENT_ID distintos, a idade vai de 2 a 30 anos e a mediana é 11 anos.

## Método implementado
1. usa amostras basais deduplicadas do datapack;
2. cruza sampleId -> patientId -> clínico;
3. exige sexo e idade válidos;
4. calcula mediana etária somente nos casos elegíveis;
5. forma quatro grupos sexo × faixa abaixo/acima da mediana;
6. transforma expressão conforme o perfil do estudo;
7. padroniza cada gene por z-score no universo elegível;
8. calcula a média do z-score por grupo;
9. exige >=5 casos em cada grupo;
10. exibe até 20 genes selecionados.

## Testes executados
- `node --check src/js/demographic-heatmap.js`: OK
- `node --check src/js/resultados.js`: OK
- `node tests/demographic-heatmap-regression.mjs`: OK
- `npm test`: OK
  - regressão científica;
  - 250 coortes sintéticas;
  - referência R;
  - solicitações do orientador;
  - GENESIS-R;
  - KM R 92 -> 46/46;
  - integridade do site;
  - paciente;
  - mini-laudos;
  - heatmap demográfico.
- todos os módulos `src/js/*.js` em `node --check`: OK.

## Build
`npm run build` não pôde ser executado localmente porque o binário `vite` não está instalado neste ambiente (`vite: not found`). O workflow do GitHub continua responsável por `npm ci`, testes, build e deploy.

## Limite científico
O heatmap demográfico é descritivo. Não testa associação estatística entre sexo/idade e expressão, não demonstra causalidade e não fornece prognóstico individual.
