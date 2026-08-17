# GENESIS LLA V10.7.3 — Heatmap demográfico

Alteração solicitada pelo orientador após a V10.7.2.

## Novo gráfico
- Adiciona **Heatmap demográfico — expressão × sexo/idade** em Estudos & Gráficos.
- O gráfico usa os genes selecionados pelo usuário (até 20 com expressão disponível).
- Universo: amostras **basais por paciente**, evitando duplicação de indivíduos.
- Dados demográficos: `SEX`/`GENDER` e `AGE`/`AGE_IN_DAYS` do estudo ativo.
- Grupos: Feminino abaixo/acima da mediana etária e Masculino abaixo/acima da mediana etária.
- O corte de idade é calculado dinamicamente pela **mediana da coorte elegível** e é explicitamente marcado como divisor descritivo, não limiar clínico.
- Valor da célula: média do **z-score de expressão** do gene dentro do grupo.
- Paleta divergente azul–branco–vermelho, coerente com o heatmap de expressão do Script R.
- O botão **Gerar gráficos** dos genes passa a solicitar também este heatmap.

## Mini-laudo
O heatmap recebe mini-laudo automático com:
- o que a visualização mede;
- número de casos basais com idade, sexo e expressão utilizáveis;
- maior desvio médio observado;
- aviso de que o gráfico é descritivo e não testa significância, causalidade ou risco individual.

## Guardrails
- não gera o gráfico sem idade, sexo e expressão simultaneamente;
- mínimo de 5 casos por grupo;
- genes sem expressão são removidos;
- genes sem variabilidade suficiente são removidos;
- máximo de 20 genes por visualização;
- nenhum valor ausente é convertido em zero.

## Dados reais disponíveis
No `clinical_data.csv` do GENESIS-R:
- 1.127 registros;
- 755 `PATIENT_ID` distintos;
- `SEX`, `AGE` e `AGE_IN_DAYS` estão presentes;
- entre pacientes distintos, idade observada de 2 a 30 anos e mediana 11 anos.

Essas contagens documentam disponibilidade clínica; o heatmap dinâmico usa somente o subconjunto basal que também possui expressão no datapack carregado.
