# Auditoria V10.7 — correção KM 21/21 x 46/46

## Diagnóstico
O site V10.6 calculava KM/Cox sobre a seleção basal deduplicada (uma amostra primária por paciente). No caso reportado, após OS + expressão, o conjunto tinha 42 casos completos e a divisão pela mediana resultava em 21 Alto / 21 Baixo.

O pipeline R do projeto alinha todas as amostras do perfil de expressão a dados clínicos por patient_id e só depois executa KM/Cox. As curvas R fornecidas têm 92 observações, divididas em 46 Alto / 46 Baixo.

## Correção
- DATA_VERSION 9 (cache antigo invalidado).
- Dois modos explícitos de sobrevida:
  - Compatibilidade R: todas as amostras de expressão alinhadas ao clínico; NA de expressão imputado pela mediana do gene antes de KM/Cox.
  - Basal por paciente: uma amostra primária por paciente.
- TARGET ALL usa Compatibilidade R como padrão na página Estudos & Gráficos.
- O painel mostra o modo utilizado e os Ns resultantes.
- O universo mutacional Top 30 continua separado e n=150.

## Testes executados
- npm test: PASSOU.
- 250 coortes sintéticas: PASSOU.
- Integridade GENESIS-R: PASSOU.
- Regressão específica KM: 92 observações -> 46 Alto / 46 Baixo: PASSOU.
- node --check nos arquivos JS alterados: PASSOU.
- npm run build local: NÃO executado, pois o binário Vite não está instalado neste ambiente (`vite: not found`). O GitHub Actions continua responsável por npm ci + testes + build + deploy.

## Arquivo R novo do professor
`TARGET_ALL_analise_ajustado_professor.R` foi preservado em `public/referencias/`. O arquivo recebido termina após o bloco de heatmap e não contém implementação de Kaplan-Meier/Cox; por isso ele não substitui o Script.R completo utilizado como referência das curvas de sobrevida.
