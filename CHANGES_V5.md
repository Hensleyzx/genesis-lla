# GENESIS LLA V5 — Multicoorte e Qualidade de Dados

## Correções principais
- O importador manual de DEA agora valida a escala antes de rotular valores como log2FC.
- Arquivos legados com efeitos extremos incompatíveis com log2FC não geram Volcano/Top DEGs enganoso; o sistema mostra um alerta e preserva a tabela bruta.
- Top DEGs limitado a 15 barras com tooltip de FDR para melhorar legibilidade.
- Volcano Plot preserva todos os pontos significativos e amostra apenas não significativos quando necessário para desempenho.
- Forest Plot de Cox usa escala logarítmica, IC95% e linha de referência HR=1.
- Top mutações aceita frequências em 0–1 ou 0–100 e padroniza a exibição em porcentagem.

## Painel molecular
- Painel inicial ampliado de 8 para 10 genes: TP53, IKZF1, BCR-ABL1, NOTCH1, RUNX1, CDKN2A, DAPK1, EPM2AIP1, PAX5 e KMT2A.
- Campo para adicionar qualquer símbolo HUGO escolhido pelo profissional/pesquisador.
- Genes personalizados ausentes na coorte permanecem como "sem dado"; nenhum valor é inventado.

## Multicoorte
- Cache IndexedDB agora armazena vários estudos simultaneamente.
- É possível carregar individualmente ou carregar as cinco coortes LLA validadas no modo Expresso.
- Estudos carregados podem ser selecionados simultaneamente para uma tabela comparativa.
- A análise de um caso usa uma coorte de referência por vez para evitar misturar escalas e endpoints incompatíveis; a troca de coorte não exige novo download.

## Qualidade / confiabilidade técnica
- Cada coorte recebe um índice técnico de 0–100 baseado em tamanho amostral, disponibilidade molecular, endpoint/eventos e integridade da seleção basal.
- Cada evidência por gene recebe uma confiabilidade técnica baseada em completude da coorte, tamanho amostral, eventos, FDR/IC95% e apoio da DEA.
- Esses índices NÃO são confiança diagnóstica, acurácia clínica, probabilidade de sobrevida nem validação prognóstica.

## R / dados manuais
- Mantido o R Lab em WebR para scripts compatíveis com WebAssembly.
- O pipeline completo com Bioconductor/cBioPortalData continua indicado para R/RStudio externo.
