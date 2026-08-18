# Auditoria executada — GENESIS LLA V10.7.6

Data da revisão: 18/08/2026.

## Objetivo

Endurecer os pontos metodológicos encontrados após o teste do professor, sem transformar o GENESIS em ferramenta clínica. A versão continua sendo um protótipo acadêmico/exploratório.

## Correções verificadas

1. **Escala de expressão do paciente**
   - RPKM, TPM, FPKM e z-score só são comparados quando a coorte informa a mesma escala reconhecida.
   - Escalas diferentes são bloqueadas e recebem justificativa explícita.
   - Perfis em escala original/não padronizada também são bloqueados para comparação automática, mesmo que ambos apareçam como “original”, porque isso não garante equivalência entre plataformas.

2. **Biomarcadores moleculares**
   - O campo genérico “alteração detectada” foi substituído por **mutação somática** no fluxo em que o sistema consulta o perfil de mutações do cBioPortal.
   - Fusão BCR-ABL1 continua tratada separadamente quando o status clínico correspondente está disponível.

3. **Idade**
   - Uma única função é usada pelos módulos revisados.
   - `AGE_IN_DAYS` tem prioridade; `AGE` é usado como fallback.

4. **Leucócitos/WBC**
   - O caso exige unidade.
   - ×10^9/L e ×10^3/µL são tratados como equivalentes.
   - células/µL é convertido para ×10^9/L.
   - Coorte sem unidade confirmável/inferível de modo conservador não usa WBC no pareamento.

5. **Síntese multicoorte**
   - Uma única associação direcional entre várias coortes não produz mais “predomínio”.
   - Para uma direção ser sintetizada em cenário multicoorte, são exigidas pelo menos duas coortes concordantes e nenhuma em direção oposta.
   - “Coortes com dados” passa a contar disponibilidade molecular relevante, em vez de apenas a existência de um objeto de resultado.

6. **Kaplan–Meier / referência R**
   - O modo foi renomeado para **modo compatível com referência R**.
   - O sistema não afirma equivalência numérica integral sem a matriz bruta original usada no R.
   - As 10 referências KM empacotadas são verificadas quanto à integridade, presença de imagem, `high_n=46`, `low_n=46` e p-value registrado.

7. **Cache de dados**
   - `DATA_VERSION = 11`, forçando reconstrução de datapacks antigos após a atualização.

## Bateria automatizada executada

Comando: `npm test`

### Testes científicos — aprovados

- `scientific-smoke.mjs`
- `fuzz-invariants.mjs` — **250 coortes sintéticas**
- `r-reference-integrity.mjs`
- `teacher-request-regression.mjs`
- `genesis-r-study.mjs`
- `km-r-compat-regression.mjs` — **92 observações → 46/46**
- `teacher-review-v10-7-5.mjs`
- `scientific-hardening-v10-7-6.mjs`

### Testes do site — aprovados

- `site-integrity.mjs`
- `patient-integration.mjs`
- `graph-report-regression.mjs`
- `demographic-heatmap-regression.mjs`
- `heatmap-ui-regression.mjs`

### Verificação adicional de sintaxe/HTML — aprovada

- **38 arquivos JS/MJS** verificados com `node --check`: 0 falhas.
- HTML estático verificado para IDs duplicados: nenhum encontrado.

## Testes adicionados especificamente nesta versão

A nova regressão V10.7.6 confirma, entre outros pontos:

- RPKM do paciente não é reutilizado como z-score.
- Escala original/não padronizada não é tratada como equivalente entre coortes.
- 1 associação favorável + 4 inconclusivas permanece **inconclusivo** no cenário multicoorte.
- Coorte sem modalidade relevante não é contabilizada como “coorte com dados”.
- Idade é idêntica entre os módulos revisados.
- 54 ×10^9/L equivale a 54.000 células/µL após normalização.
- WBC sem unidade não é usado.
- A interface usa “mutação somática”, contém seletores de escala/unidade e não volta ao rótulo genérico anterior.
- As 10 referências Kaplan–Meier empacotadas permanecem 46/46; MIR221 conserva p=0,0078 no manifesto de referência.

## Build, lint e typecheck

Esses três comandos **não foram declarados como aprovados neste ambiente**, pois o ZIP de trabalho não contém `node_modules` e as dependências de desenvolvimento não estão instaladas:

- `npm run build` → `vite: not found`
- `npm run lint` → `eslint: not found`
- `npm run typecheck` → React/typings ausentes (`react`, `react-dom/client`, `react/jsx-runtime`)

Isso é diferente de uma falha demonstrada na lógica do GENESIS: a bateria executável sem reinstalar dependências passou. No repositório/CI, a sequência correta continua sendo `npm ci`, depois `npm test`, `npm run typecheck`, `npm run lint` e `npm run build`.

## Limitação científica que permanece explícita

A V10.7.6 valida a integridade das referências Kaplan–Meier e a lógica do modo compatível, mas **não reivindica recálculo independente dos 10 p-values a partir da matriz bruta original**, porque essa matriz específica usada para gerar as figuras de referência não está empacotada no projeto. Qualquer afirmação de reprodução integral deve depender dessa comparação futura.

## Resultado

A bateria automatizada disponível terminou sem falhas de regressão na V10.7.6. As fragilidades metodológicas identificadas na revisão anterior receberam guardrails e testes específicos. A versão deve continuar sendo apresentada como protótipo acadêmico de exploração e apoio à pesquisa, não como dispositivo médico validado.
