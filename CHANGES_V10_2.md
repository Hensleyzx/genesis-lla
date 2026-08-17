# GENESIS V10.2 — auditoria funcional e científica

## Erros encontrados e corrigidos

1. **Log-rank**: a versão anterior somava contribuições marginais como independentes e, em dois grupos, podia dobrar o qui-quadrado. Foi substituído pelo cálculo com matriz de covariância; teste sintético conferido com `statsmodels.survdiff`.
2. **IC de Kaplan-Meier**: corrigida a fórmula log-log/Greenwood.
3. **Endpoint de sobrevida**: o site podia misturar `OS_MONTHS` e `OS_DAYS` paciente a paciente. Agora escolhe uma única coluna/endpoint para toda a coorte, como o `Script.R` corrigido.
4. **KM**: adicionados marcadores de censura, número em risco e identificação explícita da coluna/endpoint.
5. **DEA/Volcano em painel parcial**: agora são bloqueados no escopo `Expresso`. O FDR não deve ser calculado sobre um subconjunto de genes e apresentado como se fosse transcriptoma completo.
6. **Cox**: o site informa que o FDR é restrito aos genes selecionados e que `cox.zph` ainda precisa ser conferido no R antes de validação.
7. **Fluxo do professor**: a área de estudo em Resultados foi simplificada; multicoorte continua disponível no código para outras rotas, mas não polui a rota principal.
8. **Terminologia**: todos os cálculos locais continuam com selo `EXPLORATÓRIO LOCAL`; nenhum recebe selo R por semelhança visual.

## Testes executados

- Sintaxe de todos os módulos JS com `node --check`.
- Log-rank local comparado numericamente com `statsmodels.duration.survfunc.survdiff` em conjunto sintético: mesmo qui-quadrado e p-valor.
- Cox univariado local comparado com `statsmodels.PHReg` usando ties=Efron e expressão padronizada: HR, IC95% e p-valor coincidentes no teste sintético.
- Auditoria estática de rotas, arquivos Vite e workflow GitHub Pages.

O build Vite completo ainda depende das dependências npm instaladas; o ambiente de auditoria não concluiu o download de pacotes. O workflow do GitHub Pages permanece configurado para executar `npm ci` e `npm run build`.
