# GENESIS LLA V10.7.1 — Correção do Volcano Plot GENESIS-R

- Não altera nenhum valor do CSV do professor.
- Corrige a apresentação da DEA para reproduzir os critérios do Script R.
- Exibe linhas de corte em logFC = ±0,5 e adj.P.Val = 0,05.
- Rotula os 20 DEGs com menor adj.P.Val.
- Diferencia:
  - 450 Upregulados;
  - 1.047 Downregulados;
  - 1.497 DEGs classificados pelo critério completo do R;
  - 3.141 genes com FDR < 0,05 antes do corte de |logFC|.
- Preserva a escala X completa, incluindo logFC extremos do CSV.
- Reduz a altura do Volcano e aplica painel científico claro.
- Adiciona regressões automáticas para as contagens e para a presença dos recursos visuais.
