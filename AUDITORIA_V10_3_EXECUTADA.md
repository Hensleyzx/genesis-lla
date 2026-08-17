# Auditoria executada — GENESIS LLA V10.3

Data da revisão: 16/08/2026.

## Escopo

A versão V10.2 recebida em dois arquivos ZIP foi comparada integralmente. Os conteúdos eram idênticos; a diferença era apenas a pasta externa do pacote `AUDITADA`. A versão `REPO_ROOT` foi usada como base da V10.3.

## Correções confirmadas nesta revisão

- Endpoint de Kaplan–Meier e Cox limitado a **Overall Survival (OS)** no JavaScript e no `Script.R`.
- Removido fallback de coorte para EFS/DFS.
- Status clínicos ausentes/desconhecidos não são tratados automaticamente como censura.
- KM e Cox aplicam mínimos por gene compatíveis com o script R: 20 casos completos e 5 eventos; KM também exige 5 indivíduos por grupo.
- Cox exige expressão variável e convergência do ajuste.
- Expressão molecular ausente (`null`/vazio) não é convertida em zero.
- A seleção de mutações TARGET não volta silenciosamente a amostras não basais quando nenhuma amostra basal válida é encontrada.
- `DATA_VERSION=7` invalida o cache local construído pela lógica anterior.
- Kaplan–Meier mostra IC95% log-log/Greenwood, censuras, número em risco e observado × esperado do log-rank.
- Dados de KM/IC podem ser exportados em JSON.
- Cox exibe tabela com HR, IC95%, p, FDR BH, N e eventos.
- GitHub Pages usa base derivada do nome real do repositório, em vez de `/genesis-lla/` fixo.
- O workflow de Pages roda `npm run test:science` antes do build.

## Testes executados

1. `node --check` em todos os módulos `src/js/*.js` e testes `.mjs`: **OK**.
2. `node tests/scientific-smoke.mjs`: **OK**.
3. Comparação independente contra `statsmodels 0.14.6` em 20 conjuntos sintéticos aleatórios com empates e censura:
   - log-rank: diferença absoluta máxima de qui-quadrado ≈ `4,61e-15` e p ≈ `3,89e-15`;
   - Cox Efron: HR ≈ `1,69e-14`, limite inferior do IC ≈ `4,39e-09`, limite superior ≈ `1,00e-08`, p ≈ `2,41e-15`.
4. Validação estrutural de `package.json` e `package-lock.json`: **OK**.
5. `Script.R` e `Script_LLA_validacao.R`: conteúdo corrigido e idêntico.

## Limitações do ambiente desta auditoria

- `Rscript` não está instalado neste ambiente; portanto, o script R foi revisado estaticamente, mas não foi executado aqui.
- O build Vite não pôde ser concluído localmente porque as dependências npm não estão instaladas e a instalação no ambiente de auditoria falhou por problema do próprio ambiente. Isso não foi interpretado como falha do código. O workflow do GitHub instala as dependências, executa os testes científicos e só depois realiza o build.

## Status científico

Os cálculos locais permanecem classificados como **exploratórios** até que a mesma coorte, filtros e valores sejam comparados com a execução correspondente do R. O GENESIS continua sendo um protótipo acadêmico/de pesquisa, não um sistema clínico validado.
