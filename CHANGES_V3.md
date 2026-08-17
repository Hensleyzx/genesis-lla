# GENESIS LLA V3 — principais mudanças

## Catálogo cBioPortal
- consulta o catálogo completo em tempo real;
- exibe a quantidade total de estudos e a quantidade de estudos LLA detectados;
- oferece busca por TARGET, St. Jude, B-ALL, T-ALL etc.;
- somente estudos LLA podem ser integrados ao GENESIS;
- verifica dados clínicos, sobrevida, mutações e expressão antes do carregamento;
- oferece download do pacote bruto Datahub e carregamento seletivo pela REST API.

## Correções científicas
- removido uso de CSV DEA legado como fonte principal do dashboard;
- DEA dinâmica alinhada às amostras basais;
- RPKM/TPM/FPKM são analisados em log2(x+1);
- uma amostra basal por paciente em TARGET (09 > 03);
- amostras de recaída, xen enxerto e normais ficam fora da coorte prognóstica basal;
- endpoint de sobrevida é único por modelo (OS preferencial; EFS apenas como fallback de coorte);
- Cox usa p-valor sem arredondamento antes do FDR;
- frequência de mutação usa amostras basais do conjunto perfilado quando identificáveis;
- BCR-ABL1 é tratado separadamente como fusão;
- EPM2AIP1 substitui a grafia incorreta EPM2AIP2.

## Resultados do caso
- múltiplas curvas Kaplan-Meier por genes selecionados;
- destaque do grupo de referência Alto/Baixo sem chamar isso de previsão individual;
- expressão do caso vs mediana/percentil da coorte;
- Forest Plot com HR por 1 DP, IC95%, p e FDR;
- frequência de mutações na coorte;
- nenhuma fórmula artificial de sobrevida, confiança ou score molecular.

## Script R corrigido
`Script_LLA_validacao.R` adiciona:
- seleção basal;
- log2(RPKM+1);
- limma-trend;
- Kaplan-Meier basal;
- Cox + FDR;
- `cox.zph` para hipótese de riscos proporcionais;
- proteção contra sobreajuste no Cox multivariado;
- arquivos de metadados e rastreabilidade.

## Escopo
A interface tem padrão de **pesquisa clínica**, mas o software continua sem validação clínica/regulatória e não deve ser usado para decisões assistenciais.
