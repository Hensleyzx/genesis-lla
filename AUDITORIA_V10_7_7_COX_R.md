# AUDITORIA V10.7.7 — Forest Plot Cox vs referência R

## Problema confirmado
O Forest Plot exibido no módulo exploratório não era a mesma figura de referência fornecida pelo professor.

Diferenças identificadas:
- o gráfico local era recalculado a partir dos genes selecionados no painel mutacional;
- esse fluxo incluía TAS2R19 e não incluía NOTCH2;
- o CSV de referência fornecido contém NOTCH2 e não contém TAS2R19;
- o gráfico local usava eixo X logarítmico;
- a figura R fornecida usa eixo linear para Hazard Ratio;
- o gráfico local coloria principalmente por FDR; a figura R diferencia os pontos por HR > 1.

## Correção
No TARGET ALL, quando o modo `Referência R do professor` está ativo, o Forest Plot de Cox passa a ler diretamente:

- `public/data/r_validated/cox_univariado_top10_genes.csv`
- `public/data/r_validated/fig7_forest_cox.png`

O modo `Basal por paciente` continua disponível como recálculo exploratório local.

## Tabela de referência preservada
O CSV possui 9 modelos:
NRAS, KRAS, CREBBP, JAK2, PTPN11, TP53, CDK11A, FLT3 e NOTCH2.

NOTCH2: HR 1.518; IC95% 1.248–1.845; p=0.
FLT3: HR 0.435; IC95% 0.268–0.707; p=0.0008.

## Integridade dos arquivos
- CSV SHA-256: `31982446e69db82d02340dd8abe5b6da4acd3eb9a2bbab68f754e1b9a6a944e3`
- Figura SHA-256: `ad120c259636221ea4bc2eb036d6343a85d91a963c54cf3d9fa8f572054c6b66`

## Testes executados
- `npm test`: aprovado integralmente.
- 250 coortes sintéticas: aprovadas.
- regressão KM 92 -> 46/46: aprovada.
- integração de paciente: aprovada.
- heatmap demográfico: aprovado.
- teste de referência Cox: confirma 9 linhas, presença de NOTCH2, ausência de TAS2R19 e valores HR/IC95% de NOTCH2.
- `node --check` em todos os JS/MJS: aprovado.

## Build
`npm run build` não foi concluído neste ambiente porque a instalação das dependências via `npm ci` não finalizou e o binário `vite` não ficou disponível. O workflow do GitHub Pages continua configurado para instalar dependências antes do build.
