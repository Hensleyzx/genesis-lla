# GENESIS LLA — Mudanças V4

## Objetivo da V4

A V4 foi preparada para tornar a plataforma mais robusta para demonstração de pesquisa clínica, mantendo o foco exclusivo em Leucemia Linfoblástica/Linfoide Aguda (LLA/ALL) e evitando resultados simulados ou interpretações clínicas não validadas.

## 1. Cinco estudos de LLA no cBioPortal

A interface passa a trabalhar com cinco coortes públicas identificadas explicitamente no catálogo do cBioPortal:

- `all_phase2_target_2018_pub` — TARGET ALL Phase II
- `bll_target_gdc` — TARGET GDC B-Lymphoblastic Leukemia/Lymphoma
- `all_stjude_2015` — St. Jude 2015
- `all_stjude_2016` — St. Jude 2016
- `all_stjude_2013` — St. Jude Hypodiploid ALL 2013

A capacidade de cada estudo é verificada antes do carregamento. Se uma coorte não possuir expressão, sobrevida ou mutações compatíveis, somente o módulo dependente daquele dado é desativado. Nenhum valor é fabricado para completar gráficos ausentes.

## 2. Gráficos científicos revisados

A área de Bioinformática e o Dashboard receberam visualizações específicas do estudo ativo:

- Top DEGs — comparação basal `Relapse vs None`;
- Volcano Plot com limiares de FDR e magnitude de efeito;
- Forest Plot de Cox univariado com HR, IC95% e escala logarítmica;
- Top mutações com frequência baseada nas amostras disponíveis/perfiladas;
- Curva de sobrevida da coorte quando o estudo possui endpoint compatível.

Os gráficos são comparações da coorte e não previsões individuais de sobrevida.

## 3. Importação manual revisada

A página Bioinformática passa a aceitar CSV, TSV e TXT com detecção mais tolerante de delimitador e cabeçalhos. São reconhecidos conjuntos do tipo:

- expressão diferencial;
- dados clínicos;
- mutações;
- Cox/Forest;
- expressão gênica.

Arquivos `.R` podem ser abertos no laboratório R, mas nunca são executados automaticamente.

## 4. Laboratório R no navegador

Foi incluído um laboratório R usando WebR/WebAssembly. O usuário pode:

- carregar um exemplo;
- editar código R;
- sincronizar o CSV manual como `/data/genesis_input.csv`;
- executar código R compatível no navegador;
- visualizar saída textual e gráficos gerados pelo R;
- interromper a execução.

O arquivo `public/referencias/Exemplo_WebR.R` mostra o formato esperado.

### Limitação importante

O pipeline completo do projeto (`cBioPortalData`, Bioconductor, `survival`, `limma`, etc.) não deve ser assumido como executável integralmente dentro do WebR. Pacotes que não possuem build WebAssembly compatível continuam devendo ser executados em R/RStudio ou em um backend R dedicado. O laboratório do navegador é voltado a código R compatível e exploração dos dados já carregados.

## 5. Build Vercel

O `vite.config.ts` agora usa `build.target = 'esnext'`, corrigindo a falha de produção causada por `top-level await` nos módulos da aplicação.

## Segurança científica

A V4 não reintroduz score molecular arbitrário, confiança simulada ou porcentagem individual de sobrevida. Os resultados são apresentados como análise exploratória e referência de coorte.
