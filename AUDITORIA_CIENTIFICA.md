# Auditoria científica — GENESIS LLA V3

Esta versão corrige pontos identificados no `Script_original_usuario.R` e no protótipo web anterior.

## Correções aplicadas

1. **DEA em RPKM bruto**
   - Antes: `lmFit()` era aplicado diretamente sobre RPKM, embora o resultado fosse chamado de log2FC.
   - V3/R: usa `log2(RPKM + 1)` e `eBayes(..., trend = TRUE)`.
   - V3/web: usa a mesma transformação para perfis RPKM/TPM/FPKM.

2. **Múltiplas amostras do mesmo paciente**
   - V3 prioriza uma amostra basal por paciente em TARGET: tipo 09, depois 03.
   - Exclui da coorte basal códigos 04/40 (recorrência), 60/61 (xen enxerto) e 10/11/14 (normal).

3. **Vazamento de informação em Relapse vs None**
   - A DEA usa expressão da amostra basal e `FIRST_EVENT` como desfecho posterior.

4. **Endpoint de sobrevida**
   - KM e Cox usam exclusivamente Overall Survival (OS).
   - EFS/DFS não são usados como fallback. Se OS não atingir os mínimos, a análise de sobrevida é bloqueada.

5. **Cox**
   - HR é calculado por 1 desvio-padrão de expressão.
   - p-valores não são arredondados antes do FDR.
   - O script R adiciona FDR BH e `cox.zph` para avaliar a hipótese de riscos proporcionais.

6. **Mutações**
   - O frontend usa uma amostra basal perfilada por paciente quando identificável para o denominador de frequência.

7. **BCR-ABL1**
   - É tratado como status de fusão/alteração estrutural e não inferido a partir de RPKM do gene.

8. **Kaplan-Meier**
   - As curvas representam grupos da coorte de referência.
   - O site não chama a curva do grupo de “previsão de sobrevida do paciente”.

## Limitação explícita

Mesmo com essas correções, o GENESIS continua sendo um protótipo acadêmico/de pesquisa. Para uso assistencial real seriam necessários, entre outros pontos, validação externa independente, protocolo prospectivo, governança de dados, avaliação de desempenho, validação clínica, segurança, rastreabilidade e requisitos regulatórios aplicáveis.
