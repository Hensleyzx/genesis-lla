# GENESIS LLA V10.5 — interface médica + correções do Top 30

Protótipo acadêmico do GENESIS para Leucemia Linfoblástica Aguda (LLA), com interface web para exploração de coortes públicas e análise exploratória de biomarcadores de um caso individual.

## Fluxo da V10.5

- **Análise do Paciente**: entrada de identificação, idade, sexo, leucócitos, subtipo, BCR-ABL1, alterações genéticas e expressão. O caso pode ser comparado com 1–5 coortes já carregadas.
- **Estudos & Gráficos**: seleção/carregamento de estudos LLA e geração de Top 30 mutacional, heatmap, Kaplan–Meier, Cox, DEA e Volcano conforme a disponibilidade e os critérios mínimos.
- **Histórico**: mantém separadas as análises de pacientes e os gráficos de coortes produzidos no navegador.
- **Resultado validado no R**: permanece separado dos cálculos exploratórios locais para evitar confundir validação numérica com resultado ainda não conferido.
- **Sobre o Projeto**: objetivo, autores, metodologia e limites científicos.

## Módulo do paciente

A V10.5 mantém o fluxo de caso individual reativado na V10.4 que havia sido removido na simplificação da V10:

1. o usuário seleciona um paciente salvo ou cria um novo caso;
2. informa critérios clínicos disponíveis;
3. seleciona biomarcadores e registra alteração presente/ausente e/ou expressão;
4. seleciona 1–5 coortes LLA já carregadas;
5. o motor executa as análises disponíveis em cada estudo separadamente;
6. o sistema gera uma síntese exploratória, tabela de evidências, qualidade técnica e curvas dos grupos de perfis semelhantes quando houver dados suficientes;
7. relatório TXT, JSON auditável e impressão/PDF podem ser exportados.

O cadastro salvo preserva os dados clínicos, profissional, genes, alterações, expressão, BCR-ABL1 e recaída. A expressão não informada permanece ausente e **nunca é convertida em zero**. A mesma regra foi corrigida também no pareamento por idade/leucócitos: campos clínicos vazios não são interpretados como valor 0.

## Regra de validação

- **Validado contra R**: somente quando estudo/coorte, filtros, transformação, gene(s), endpoint e valores numéricos foram confrontados com a saída R correspondente.
- **Exploratório local**: cálculo feito no navegador e ainda não confrontado com a execução R correspondente.
- O **Top 30 oficial** do TARGET ALL usa o case list mutacional completo `n=150`, reproduz os percentuais visíveis na figura R fornecida e é exibido em vermelho/laranja como referência principal.
- A seleção basal por paciente é mantida separadamente para expressão, sobrevida, pareamento e heatmap basal; ela não pode mais alterar o denominador do Top 30 oficial.
- A área de seleção de genes possui um botão **Gerar gráficos** que gera imediatamente a frequência mutacional dos genes selecionados e tenta Cox/Kaplan–Meier quando os mínimos são atendidos.

## Regras científicas consolidadas

- Kaplan–Meier e Cox usam **somente Overall Survival (OS)**; não há fallback silencioso para EFS/DFS.
- Status clínico ausente/desconhecido não é convertido em censura.
- KM e Cox exigem por gene ≥20 casos completos e ≥5 eventos; KM exige também ≥5 indivíduos por grupo.
- Kaplan–Meier usa IC95% log-log/Greenwood, censuras, número em risco e log-rank.
- Cox usa Efron, expressão padronizada por 1 DP e apresenta HR, IC95%, p, FDR, N e eventos.
- DEA/Volcano permanecem bloqueados no escopo molecular parcial tanto na interface quanto no motor interno, preservando o universo de testes/FDR.
- Pareamento de perfis semelhantes exige pelo menos dois critérios por candidato, 20 candidatos comparáveis e 5 eventos no grupo semelhante antes de exibir curva.
- Valores moleculares nulos não viram zero.
- Em TARGET, expressão/sobrevida/paciente priorizam amostra basal por paciente e excluem recaída/xenoenxerto/normal quando identificável.
- Para mutações, o Top 30 usa todas as amostras do case list mutacional perfilado; a seleção basal fica armazenada em um agregado separado para heatmap/pareamento.
- `DATA_VERSION=8` impede reutilização de cache antigo em que o Top 30 podia herdar o denominador basal.

## Interface e deploy

A V10.5 mantém a identidade visual mais próxima de software médico: tema claro como padrão, tons clínicos verde-azulados, navegação separando paciente e coortes, avisos metodológicos visíveis e layout responsivo.

O Vite usa `base: './'`, permitindo publicar em GitHub Pages independentemente do nome do repositório. Todas as rotas têm fallback de inicialização para substituir a antiga tela preta por uma mensagem de erro diagnosticável. O workflow executa testes antes do build.

## Testes

```bash
npm ci
npm test
npm run build
```

`npm test` executa:

- regressões científicas de log-rank/Kaplan–Meier/Cox e regras de coorte;
- integridade das rotas e caminhos para GitHub Pages;
- teste de integração do motor do paciente, inclusive a regressão de campo de expressão ausente → `null`, nunca `0`;
- teste de invariantes em 250 coortes sintéticas com censura/empates;
- integridade da referência Top 30 validada contra R;
- regressão específica das alterações solicitadas pelo orientador (Top 30 n=150, paleta R, separação do n=81 e botão Gerar gráficos);
- fallback de inicialização em todas as rotas HTML.

## Segurança científica

O GENESIS é um protótipo de pesquisa/educação. A expressão “análise do paciente” significa comparação exploratória com grupos de referência. O sistema **não é dispositivo médico validado, não emite diagnóstico clínico, não produz probabilidade individual validada de sobrevivência/morte e não recomenda tratamento**.

## V10.7 — GENESIS-R

A V10.7 adiciona o **GENESIS-R — Estudo de Validação TARGET ALL**. Diferentemente das coortes exploratórias carregadas via cBioPortal, este módulo é um pacote fixo de resultados fornecidos pelo pipeline R do projeto.

Arquivos incorporados: Top 30 mutacional, DEA Relapse vs None, dados clínicos, Cox univariado, Cox multivariado, 10 Kaplan–Meier, Forest Plot de referência e o script R correspondente. A interface identifica a procedência de cada saída e não trata imagens do R como cálculos refeitos no navegador.


## V10.7 — Sobrevida compatível com R
No TARGET ALL, KM/Cox oferecem modo **Compatibilidade R**, que replica o universo de amostras de expressão do pipeline R e mantém o modo basal por paciente como alternativa.
