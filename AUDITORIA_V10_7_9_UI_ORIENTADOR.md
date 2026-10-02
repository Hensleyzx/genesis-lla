# AUDITORIA V10.7.8 — prontidão para a feira e Forest Plot Cox

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

NOTCH2: HR 1.518; IC95% 1.248–1.845; o CSV recebido armazena `p=0`, portanto a interface exibe **p < 0,0001** para não sugerir probabilidade exatamente zero.
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
- `node --check` em 38 arquivos JS/MJS: aprovado.
- validação independente de 100 coortes contra `statsmodels`: log-rank e Cox/Efron coincidiram dentro de tolerância numérica (~10⁻¹² a 10⁻¹³).
- integridade clínica: 1.127 registros, 755 PATIENT_ID distintos e nenhum conflito intra-paciente em OS_MONTHS, OS_DAYS, OS_STATUS, FIRST_EVENT, SEX, AGE ou AGE_IN_DAYS.
- 10 referências Kaplan–Meier presentes; todas preservam Alto n=46 / Baixo n=46 e os p-values do manifesto.
- referências locais/imports e IDs HTML estáticos: aprovados.
- varredura de segredos privados conhecidos: nenhum segredo detectado.
- pacote final: 99 arquivos, dentro do limite de upload do GitHub Web.

## Build
`npm run build` não foi concluído neste ambiente porque a instalação das dependências via `npm ci` não finalizou e o binário `vite` não ficou disponível. O workflow do GitHub Pages continua configurado para instalar dependências antes do build.


## Revisão V10.7.8

Além da integridade da referência Cox, a revisão final endurece a apresentação de p-values, separa explicitamente o Cox histórico GENESIS-R do Forest Plot do professor, restringe a disponibilidade de OS a endpoint completo (tempo + status) e padroniza a nomenclatura mutacional da interface.

---

# REVISÃO V10.7.9 — interface solicitada pelo orientador

## Alterações de fluxo

1. **Carregamento de estudo unificado**
   - removido o card independente do GENESIS-R do topo de `Estudos & Gráficos`;
   - GENESIS-R e coortes públicas do cBioPortal agora aparecem dentro da mesma área de estudos;
   - a distinção científica entre saída R e cálculos exploratórios continua explícita.

2. **Genes + gráficos em um único painel**
   - removida a duplicidade entre “Genes disponíveis para análise” e “Escolher quais gráficos gerar” como etapas independentes;
   - criado o painel único `Montar análise`;
   - removido `generate-gene-graphs` e mantido somente `generate-selected`.

3. **Resultados separados por tipo de análise**
   - Sobrevida: Forest Plot Cox + um Kaplan–Meier separado por gene;
   - Mutações: Top 30, frequência dos genes selecionados e Oncoprint;
   - Perfil demográfico e expressão: heatmap sexo/idade;
   - Expressão diferencial: Top DEGs e Volcano.

4. **Navegação lateral de gráficos**
   - cada bloco possui abas identificadas e botões `Anterior` / `Próximo`;
   - somente um gráfico fica em foco por vez dentro do bloco;
   - as curvas Kaplan–Meier usam rótulos por gene (`KM · GENE`) para evitar ambiguidade.

5. **Login médico**
   - não implementado nesta revisão. Nenhum fluxo de autenticação foi alterado.

## Revisão técnica executada

- `node --check src/js/resultados.js`: aprovado.
- `node --check src/js/study-ui.js`: aprovado.
- `npm test`: aprovado integralmente após atualizar os testes de regressão para o novo requisito do orientador.
- 250 coortes sintéticas: aprovadas.
- referência R: aprovada.
- KM 92 -> 46/46: aprovado.
- integração de paciente: aprovada.
- mini-relatórios dos gráficos: aprovados.
- heatmap demográfico e guardrails: aprovados.
- integridade das rotas/HTML: aprovada.

## Build

O `npm run build` não pôde ser executado neste ambiente porque o binário `vite` não está instalado localmente. Uma tentativa de `npm ci --ignore-scripts` não concluiu dentro do ambiente disponível. A suíte de testes, que não depende do binário Vite para essas regressões, foi executada e passou integralmente.
