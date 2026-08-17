# GENESIS V2 — principais mudanças

## 1. Download do estudo TARGET ALL
- Recurso inspirado no `genesis-main`.
- Usa a REST API pública do cBioPortal.
- Modo **Expresso**: painel GENESIS + genes mais mutados encontrados no estudo.
- Modo **Completo**: todos os genes (pesado).
- Cache local em IndexedDB.
- Botões para reconstruir e apagar o cache.

## 2. Correção dos cálculos
Foram removidos:
- pesos fixos por gene;
- score molecular artificial;
- “confiança” simulada;
- porcentagem de sobrevida calculada a partir do score.

A V2 utiliza, quando o estudo está baixado:
- mediana real de expressão da coorte;
- Kaplan-Meier por expressão alta/baixa;
- teste log-rank;
- Cox univariado com HR, IC95% e p-valor;
- frequência de mutações da coorte;
- DEA do CSV real do projeto.

## 3. Resultados relacionados ao paciente
Quando existe expressão RPKM informada na mesma escala da coorte:
- o paciente é posicionado como expressão Alta/Baixa em relação à mediana;
- o resultado mostra a curva Kaplan-Meier do grupo de referência;
- apresenta sobrevida de referência aos 60 meses quando há seguimento suficiente;
- compara expressão do paciente com a mediana TARGET ALL;
- mostra Cox/Forest dos genes selecionados;
- mostra frequência de mutação dos genes na coorte.

## 4. Central de Bioinformática
- CSV/TSV/TXT continuam sendo lidos e exibidos em tabela.
- Script.R continua sendo reconhecido sem execução no navegador.
- No DEA, apenas genes com `adj.P.Val < 0,05` e `|log2FC| > 0,5` são marcados como significativos para integração.
- Log2FC de DEA não é mais copiado incorretamente para o campo de expressão individual RPKM.

## 5. Modo claro e escuro
- Alternância no cabeçalho.
- Preferência salva no navegador.
- Gráficos são redesenhados ao trocar de tema.
