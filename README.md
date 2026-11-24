# GENESIS LLA V10.7.15 — ROC/AUC individual e combinações de genes

Protótipo acadêmico do GENESIS para Leucemia Linfoblástica Aguda (LLA), com interface web para exploração de coortes públicas e análise exploratória de biomarcadores de um caso individual.

## Fluxo atual

- **Análise do Paciente**: entrada de identificação, idade, sexo, leucócitos, subtipo, BCR-ABL1, mutações somáticas e expressão com escala informada. O caso pode ser comparado com 1–5 coortes já carregadas.
- **Estudos & Gráficos**: seleção/carregamento de estudos LLA e geração de principais genes mutados, Kaplan–Meier, Cox, DEA/Volcano, ROC/AUC individual e ROC/AUC multivariada de combinações de genes, conforme a disponibilidade e os critérios mínimos.
- **Histórico**: mantém separadas as análises de pacientes e os gráficos de coortes produzidos no navegador.
- **Resultados do R**: permanecem separados dos cálculos exploratórios locais e exibem diretamente as saídas fornecidas pelo roteiro R de referência do projeto.
- **Sobre o Projeto**: objetivo, autores, metodologia e limites científicos.


## V10.7.12 — navegação por família de gráfico

- remove os botões repetidos `KM · GENE` da navegação principal;
- separa **Risco relativo** (Forest Plot/Cox) de **Curvas de sobrevida** (Kaplan–Meier);
- `Anterior/Próximo` atua somente dentro de conjuntos do mesmo tipo, como as curvas de sobrevida por gene;
- adiciona atalhos no topo dos resultados com apenas um botão por tipo de gráfico gerado;
- adota rótulos mais práticos para o usuário, preservando os nomes científicos como informação secundária;
- substitui referências visuais a “professor” por **Referência R validada** / **referência do projeto** nas telas de resultados.

## Módulo do paciente

O módulo de caso individual segue o fluxo abaixo:

1. o usuário seleciona um paciente salvo ou cria um novo caso;
2. informa critérios clínicos disponíveis;
3. seleciona biomarcadores e registra mutação somática presente/ausente e/ou expressão;
4. seleciona 1–5 coortes LLA já carregadas;
5. o motor executa as análises disponíveis em cada estudo separadamente;
6. o sistema gera uma síntese exploratória, tabela de evidências, qualidade técnica e curvas dos grupos de perfis semelhantes quando houver dados suficientes;
7. relatório TXT, JSON auditável e impressão/PDF podem ser exportados.

O cadastro salvo preserva os dados clínicos, médico responsável, genes, mutações somáticas, expressão e respectivas unidades, BCR-ABL1 e recaída. O médico responsável e seu CRM/identificação profissional são obrigatórios para salvar o caso e para executar a análise. A expressão não informada permanece ausente e **nunca é convertida em zero**. A mesma regra foi corrigida também no pareamento por idade/leucócitos: campos clínicos vazios não são interpretados como valor 0.

## Regra de validação

- **Validado contra R**: somente quando estudo/coorte, filtros, transformação, gene(s), endpoint e valores numéricos foram confrontados com a saída R correspondente.
- **Exploratório local**: cálculo feito no navegador e ainda não confrontado com a execução R correspondente.
- O **Top 30 oficial** do TARGET ALL usa o case list mutacional completo `n=150`, reproduz os percentuais visíveis na figura R fornecida e é exibido em vermelho/laranja como referência principal.
- A seleção basal por paciente é mantida separadamente para expressão, sobrevida, pareamento e heatmap basal; ela não pode mais alterar o denominador do Top 30 oficial.
- A área **O que você quer analisar?** abre somente os controles necessários para cada análise. Nos resultados, há apenas um atalho por família de gráfico; curvas Kaplan–Meier de vários genes são navegadas internamente com **Anterior/Próximo**.

## Regras científicas consolidadas

- Kaplan–Meier e Cox usam **somente Overall Survival (OS)**; não há fallback silencioso para EFS/DFS.
- Status clínico ausente/desconhecido não é convertido em censura.
- KM e Cox exigem por gene ≥20 casos completos e ≥5 eventos; KM exige também ≥5 indivíduos por grupo.
- Kaplan–Meier usa IC95% log-log/Greenwood, censuras, número em risco e log-rank.
- Cox usa Efron, expressão padronizada por 1 DP e apresenta HR, IC95%, p, FDR, N e eventos.
- DEA/Volcano permanecem bloqueados no escopo molecular parcial tanto na interface quanto no motor interno, preservando o universo de testes/FDR.
- Pareamento de perfis semelhantes exige pelo menos dois critérios por candidato, 20 candidatos comparáveis e 5 eventos no grupo semelhante antes de exibir curva.
- Valores moleculares nulos não viram zero.
- Em TARGET, a análise basal por paciente prioriza amostra primária e exclui recaída/xenoenxerto/normal quando identificável. O modo compatível com a referência R usa separadamente o universo de amostras de expressão do procedimento de referência; equivalência numérica integral depende da matriz bruta original.
- Para mutações, o Top 30 usa todas as amostras do case list mutacional perfilado; a seleção basal fica armazenada em um agregado separado para heatmap/pareamento.
- `DATA_VERSION=12` invalida caches antigos após as revisões de acoplamento expressão/case list e da disponibilidade do endpoint de sobrevida.
- ROC/AUC individual usa expressão basal por paciente e `FIRST_EVENT` para comparar **Relapse vs None**; a direção do marcador é explicitada e a AUC não é apresentada como prova de causalidade.
- Combinações de 2 a 4 genes usam regressão logística multivariada com regularização L2. A AUC é calculada em predições de validação cruzada estratificada, reduzindo o viés de avaliar o modelo nos mesmos casos usados no ajuste.
- A análise combinatória aceita de 2 a 8 genes por execução e não é apresentada como modelo clínico validado; a melhor combinação precisa de validação externa independente.

## Interface e deploy

A interface mantém tema claro como padrão, tons clínicos verde-azulados, navegação separando caso e coortes, avisos metodológicos visíveis e layout responsivo. A página inicial foi simplificada na V10.7.5: contadores, fluxo em cartões e blocos informativos redundantes foram removidos a pedido do orientador.

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
- regressão ROC/AUC com marcador perfeito, direção invertida, genes ausentes e combinações multivariadas;
- fuzz ROC/AUC em 300 coortes sintéticas adicionais, com dados ausentes e diferentes tamanhos de grupo;
- regressão de interface para garantir que ROC individual, combinações e atalho de genes do Volcano permaneçam acessíveis.

## Segurança científica

O GENESIS é um protótipo de pesquisa/educação. A expressão “análise do paciente” significa comparação exploratória com grupos de referência. O sistema **não é dispositivo médico validado, não emite diagnóstico clínico, não produz probabilidade individual validada de sobrevivência/morte e não recomenda tratamento**.

## V10.7 — GENESIS-R

A V10.7 adiciona o **GENESIS-R — Estudo de Validação TARGET ALL**. Diferentemente das coortes exploratórias carregadas via cBioPortal, este módulo é um pacote fixo de resultados fornecidos pelo pipeline R do projeto.

Arquivos incorporados: Top 30 mutacional, DEA Relapse vs None, dados clínicos, Cox univariado, Cox multivariado, 10 Kaplan–Meier, Forest Plot de referência e o script R correspondente. A interface identifica a procedência de cada saída e não trata imagens do R como cálculos refeitos no navegador.


## V10.7.7 — Sobrevida, escalas e denominadores
No TARGET ALL, KM/Cox podem usar o **Modo compatível com referência R**, que segue o universo/alinhamento do procedimento de referência sem afirmar reprodução numérica integral sem os dados brutos originais. Essas contagens representam observações de amostras alinhadas ao clínico e não devem ser chamadas automaticamente de pacientes únicos. O modo **Basal por paciente** permanece como análise alternativa deduplicada.

A V10.7.5 também corrige um risco de denominador: o TARGET possui case lists de expressão diferentes para RNA-seq e microarray. O GENESIS agora escolhe o case list de acordo com o perfil molecular selecionado (por exemplo, RPKM/RNA-seq com o case list RNA-seq), em vez de aceitar o primeiro case list de expressão encontrado.

O gráfico auxiliar de eventos observados × esperados foi retirado da interface Kaplan–Meier; o teste log-rank continua calculado e apresentado por χ² e p-value, e O/E continuam disponíveis no JSON auditável.

## Correção V10.7.7 — Forest Plot Cox

O Forest Plot de Cox no modo **Referência R do professor** usa diretamente `public/data/r_validated/cox_univariado_top10_genes.csv` e pode ser comparado à figura `fig7_forest_cox.png`. Isso evita misturar o recálculo exploratório dos genes do Top 30 com a tabela Cox de referência.

## V10.7.8 — revisão de prontidão para a feira

- `capabilities.survival` só é verdadeira quando existem **tempo de OS e status/evento**, evitando mostrar sobrevida como disponível com endpoint incompleto.
- `p=0` arredondado em CSV/saída passa a ser exibido como **p < 0,0001**, sem afirmar probabilidade exatamente zero.
- A página GENESIS-R identifica explicitamente seu Cox histórico como **análise separada** do Forest Plot de referência enviado pelo professor.
- A interface usa **mutações somáticas** para o perfil mutacional, evitando confundir mutação com CNA, fusão ou rearranjo.
- O Forest Plot de referência do professor continua lendo diretamente `public/data/r_validated/cox_univariado_top10_genes.csv` e a figura original correspondente.

## V10.7.9 — fluxo único de estudos e resultados por blocos

- O GENESIS-R foi integrado à mesma área de escolha/carregamento das coortes públicas do cBioPortal; não existe mais um segundo card de estudo acima do carregador principal.
- A seleção de **genes** e de **tipos de gráfico** foi reunida em um único painel chamado **Montar análise**.
- Existe apenas **um botão de geração**: `Gerar gráficos selecionados`. A geração automática antiga ligada à seleção de genes foi removida.
- Os tipos de gráfico são organizados por categoria: **Mutações**, **Sobrevida**, **Perfil demográfico e expressão** e **Expressão diferencial**.
- Os resultados não são mais apresentados como uma pilha contínua. Cada categoria recebe seu próprio bloco e, quando há múltiplos resultados, o usuário navega por **Anterior**, **Próximo** ou pelo nome do gráfico.
- Kaplan–Meier continua sendo calculado separadamente por gene; por exemplo, `KM · NRAS`, `KM · KRAS` e `KM · TP53` aparecem como itens independentes dentro do bloco **Sobrevida**.
- O fluxo científico, denominadores, referências R, Cox, Kaplan–Meier, heatmap demográfico, Top 30, DEA e Volcano não tiveram suas fórmulas alteradas nesta revisão; a mudança é de organização e navegação da interface.
- A tela de login/autenticação do médico **não foi implementada nesta versão**, conforme decisão de deixar essa etapa para depois.



## V10.7.10 — GENESIS-R apenas no menu lateral

A pedido do orientador, o acesso ao **GENESIS-R** foi removido do carregador de estudos em **Estudos & Gráficos**. Essa área agora é dedicada exclusivamente às cinco coortes públicas LLA selecionadas no cBioPortal. O GENESIS-R permanece acessível pela entrada própria **GENESIS-R** no menu lateral, evitando duplicidade de navegação e a impressão de que o estudo de validação é apenas mais uma coorte pública.

Os demais ajustes da V10.7.9 — painel único de genes/gráficos e resultados organizados por blocos com navegação lateral — foram preservados.


## V10.7.11 — análises por categoria, sem redundância dos genes

A pedido do orientador, o painel fixo **Genes disponíveis para análise** deixou de ocupar uma coluna separada ao lado dos tipos de gráfico. A configuração agora começa pela categoria **Mutações**, **Sobrevida**, **Perfil demográfico** ou **Expressão diferencial**. Ao abrir **Sobrevida**, por exemplo, os genes aparecem dentro do próprio painel junto das opções Cox/Kaplan–Meier e do modo de sobrevida.

A seleção de biomarcadores é sincronizada entre as categorias que dependem de genes, evitando configurações contraditórias. Expressão diferencial permanece sem seletor manual de genes porque Top DEGs/Volcano trabalham com o conjunto transcriptômico da coorte. A organização dos resultados por blocos e carrosséis da V10.7.9/V10.7.10 foi mantida, e nenhuma fórmula científica foi alterada nesta revisão.


## V10.7.12 — atalhos por tipo de gráfico

- Os resultados passaram a oferecer atalhos por família de gráfico, evitando botões separados para cada gene.
- Kaplan–Meier mantém navegação interna por gene com **Anterior/Próximo**.
- Forest Plot/Cox permanece separado das curvas de sobrevida.
- Rótulos da interface foram simplificados sem remover os nomes técnicos das análises.

## V10.7.13 — fluxo direto e linguagem mais intuitiva

- O painel de configuração agora começa com **O que você quer analisar?**, usando ações diretas: **Principais genes**, **Mutações por gene**, **Sobrevida**, **Risco relativo** e **Outras análises**.
- **Sobrevida** gera diretamente as curvas Kaplan–Meier; não existe uma segunda caixa para marcar “Kaplan–Meier”, removendo a redundância apontada na revisão do orientador.
- **Risco relativo** (Forest Plot/Cox) é tratado como análise independente e não aparece dentro do conjunto de curvas de sobrevida.
- **Principais genes** substitui o rótulo “Top 30 oficial” na navegação. O texto explica que o ranking mostra genes **mais frequentemente mutados na coorte** e não prova que sejam, isoladamente, causadores de LLA.
- A análise de frequência mutacional usa a chamada **Quais genes você quer analisar?**, incentivando a seleção antes da geração do gráfico.
- Os resultados gerados ficam em uma única área: os botões superiores funcionam como abas e **somente um tipo de gráfico é exibido por vez**.
- Quando Sobrevida possui vários genes, **Anterior/Próximo** navega somente pelas curvas desses genes. Forest Plot, Top 30 e demais gráficos não entram nesse carrossel.
- Configurações metodológicas de sobrevida foram recolhidas em **Configuração dos dados de sobrevida (opcional)** para reduzir poluição visual, preservando a referência R e o modo deduplicado.
- Heatmap demográfico, Oncoprint e expressão diferencial continuam disponíveis em **Outras análises**, sem competir com os testes principais durante a apresentação.
- Nenhuma fórmula científica de Kaplan–Meier, Cox, Top 30, DEA, Volcano ou heatmap foi alterada nesta revisão.
- A tela de login/autenticação do médico continua fora do escopo desta versão.


## V10.7.14 — revisão de bugs e simulações

A V10.7.14 consolida uma rodada de revisão após o fluxo intuitivo da V10.7.13. Foram corrigidos problemas encontrados por simulação de uso contínuo e por testes com dados ausentes:

- cada análise gerada preserva os genes e o modo de sobrevida usados no momento da geração; alterar a seleção depois não modifica silenciosamente gráficos anteriores;
- ao gerar um novo tipo de gráfico, esse resultado passa a ser o painel ativo em vez de a interface voltar para o primeiro atalho;
- o histórico registra somente a análise solicitada naquela ação, evitando duplicar gráficos antigos;
- **Principais genes** usa a referência R validada somente no TARGET ALL; em outras coortes, o ranking é calculado a partir da própria coorte e identificado como exploratório local;
- Cox univariado e multivariado rejeitam `null`, `undefined`, `NaN` e eventos ausentes em vez de permitir coerção implícita para zero/censura;
- no modo compatível com R, expressão ausente é tratada como NA e segue a imputação por mediana do procedimento de referência, nunca como zero;
- **Selecionar os 10** afeta apenas os dez genes-base e não genes adicionados manualmente; genes manuais são preservados quando a área de análise é redesenhada.

Além da suíte existente, foi executado estresse adicional com 2.000 coortes sintéticas contendo censura, empates e dados ausentes. As proteções de KM/Cox e os invariantes estatísticos permaneceram válidos.


## V10.7.15 — ROC/AUC individual e combinações de genes

A V10.7.15 implementa no GENESIS a lógica estatística das Figuras 4 e 6 do trabalho de referência mostrado pelo orientador, adaptada para LLA e para o endpoint realmente disponível nas coortes do sistema.

- **Desempenho dos genes**: cada gene selecionado é avaliado isoladamente por curva ROC/AUC usando expressão basal e `FIRST_EVENT = Relapse vs None`. O painel mostra ranking de AUC, curva ROC do melhor gene, IC95% aproximado, número de casos e direção da associação.
- **Combinações de genes**: testa combinações de 2, 3 e 4 genes entre 2–8 candidatos. Cada conjunto é ajustado por regressão logística multivariada com regularização L2 e avaliado por validação cruzada estratificada; o painel mostra as melhores AUCs e a ROC do melhor conjunto.
- **Fluxo Volcano → ROC**: quando a coorte está em escopo Completo e a DEA possui resultados, o botão **Usar genes da triagem Volcano** seleciona até seis genes diferencialmente expressos mais bem ranqueados para continuar a validação ROC/AUC.
- **Terminologia**: como as coortes atuais com esse endpoint contêm pacientes com LLA, a tela descreve a análise como capacidade discriminatória/preditiva de recaída. O sistema não chama esse resultado de diagnóstico de LLA versus indivíduo saudável.
- **Guardrails**: ROC individual exige amostra mínima por grupo; combinações exigem pelo menos 10 registros por grupo, no máximo 8 genes selecionados e no máximo 220 modelos candidatos por execução.
- O módulo é marcado como **exploratório local** e não altera as referências R já validadas para Top 30/Cox/KM.
