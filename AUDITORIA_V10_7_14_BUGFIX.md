# Auditoria V10.7.14 — revisão de bugs e simulações

## Base revisada

- Origem: V10.7.13 — Fluxo Intuitivo.
- Escopo: interface de Estudos & Gráficos, persistência do estado dos resultados, Cox, tratamento de expressão ausente e comportamento ao alternar coortes.
- Login/autenticação não foi alterado.

## Bugs encontrados e corrigidos

1. **Resultados antigos mudavam após nova seleção de genes.**
   - Causa: todos os gráficos eram redesenhados usando a seleção atual da tela.
   - Correção: cada tipo de análise armazena uma cópia dos genes e do modo de sobrevida usados na geração.

2. **Principais genes podia exibir TARGET ALL com outra coorte ativa.**
   - Causa: o Top 30 principal era fixo na referência R.
   - Correção: TARGET ALL mantém a referência R validada; demais coortes usam o ranking mutacional da própria coorte, rotulado como exploratório.

3. **Expressão `null` podia entrar no Cox como zero.**
   - Causa: uso de `isFinite()` global, que aceita `null` por coerção.
   - Correção: Cox univariado/multivariado usam `Number.isFinite()` e descartam eventos/expressões ausentes.

4. **Modo compatível com R podia converter `null` para zero antes da imputação.**
   - Correção: `null`/vazio vira NA e recebe a mediana, conforme a política do procedimento de referência.

5. **“Selecionar os 10” selecionava genes manuais.**
   - Correção: somente genes marcados como base do Top 10 são selecionados por esse comando.

6. **Histórico duplicava resultados antigos.**
   - Correção: cada ação registra somente o(s) tipo(s) de análise solicitado(s) naquela geração.

7. **Ao gerar novo gráfico, a visualização podia voltar a um resultado antigo.**
   - Correção: o tipo recém-gerado passa a ser o painel ativo.

## Testes executados

- `npm test`: OK.
- regressões científicas: OK.
- 250 coortes sintéticas da suíte: OK.
- estresse adicional: 2.000 coortes sintéticas com censura, empates e valores `null`/`undefined`/`NaN`: OK.
- referência R: OK.
- KM compatível com referência: 92 → 46/46: OK.
- integração do paciente: OK.
- heatmap demográfico: OK.
- integridade de rotas/imports e sintaxe JS/MJS: OK.

## Limitação do ambiente

O `npm ci` não concluiu porque o registry npm não respondeu dentro do limite deste ambiente. Por isso o `vite build` não pôde ser executado nesta auditoria. A falha observada é de obtenção de dependências, não uma falha detectada na suíte Node do projeto.
