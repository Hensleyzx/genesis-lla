import assert from 'node:assert/strict';
import fs from 'node:fs';

const resultados=fs.readFileSync('src/js/resultados.js','utf8');
const studyUi=fs.readFileSync('src/js/study-ui.js','utf8');
const common=fs.readFileSync('src/js/common.js','utf8');
const datapack=fs.readFileSync('src/js/datapack.js','utf8');
const scriptR=fs.readFileSync('public/referencias/Script.R','utf8');
const scriptValidation=fs.readFileSync('public/referencias/Script_LLA_validacao.R','utf8');

assert.ok(!resultados.includes('id="generate-gene-graphs"'),'A interface não deve manter um segundo botão de geração junto aos genes.');
assert.ok(!resultados.includes('id="generate-selected"'),'A revisão atual não deve manter um botão genérico de geração que force o usuário a relacionar duas áreas diferentes.');
assert.match(resultados,/data-run-analysis="top30"/,'Principais genes deve ter geração direta.');
assert.match(resultados,/data-run-analysis="km"/,'Sobrevida deve gerar Kaplan–Meier diretamente, sem uma segunda seleção redundante.');
assert.match(resultados,/data-run-analysis="cox"/,'Risco relativo deve ser uma análise independente de Sobrevida.');
assert.match(resultados,/O que você quer analisar\?/,'A interface deve induzir o usuário a escolher uma análise de forma direta.');
assert.match(resultados,/analysis-category-tabs/,'Seletor por tipo de análise ausente.');
assert.match(resultados,/data-analysis-tab="survival"/,'A categoria Sobrevida deve ser acionável diretamente.');
assert.match(resultados,/data-analysis-panel="survival"/,'O painel de Sobrevida deve abrir os próprios controles.');
assert.match(resultados,/Escolha os genes para comparar/,'Os genes de Sobrevida precisam aparecer dentro do próprio painel de Sobrevida.');
assert.ok(!resultados.includes('analysis-builder-grid'),'A interface não deve voltar ao layout redundante de genes em uma coluna e análises em outra.');
assert.match(resultados,/result-main-stage/,'Os resultados devem usar uma área única de visualização para evitar empilhamento de gráficos.');
assert.match(resultados,/data-result-subcarousel/,'Conjuntos com vários gráficos do mesmo tipo precisam permitir navegação lateral.');
assert.match(resultados,/data-result-family-panel/,'Cada tipo de gráfico gerado deve ter um painel próprio na navegação principal.');
assert.match(resultados,/data-result-shortcut/,'Resultados gerados precisam oferecer atalhos por tipo de gráfico.');
assert.ok(resultados.includes('`Sobrevida — ${g}`'),'Sobrevida deve continuar gerando uma curva separada por gene.');
assert.match(resultados,/Sobrevida/,'Bloco de Sobrevida ausente.');
assert.match(resultados,/Mutações/,'Bloco de Mutações ausente.');
assert.ok(!resultados.includes('genesis-r-study-card'),'GENESIS-R não deve permanecer como um segundo card de carregamento acima do seletor principal.');
assert.ok(!studyUi.includes('GENESIS-R — TARGET ALL'),'GENESIS-R não deve aparecer dentro do carregador de coortes públicas.');
assert.ok(!studyUi.includes('Abrir GENESIS-R'),'O carregador de coortes não deve duplicar o acesso ao GENESIS-R.');
assert.match(common,/href: 'resultados-r\.html'.*label: 'GENESIS-R'/,'GENESIS-R deve continuar acessível pelo menu lateral.');
assert.match(studyUi,/Coorte pública LLA \(cBioPortal\)/,'A área deve permanecer dedicada ao carregamento de coortes públicas.');
assert.match(resultados,/fig1_top30_genes_R_original\.jpeg/,'Top 30 principal deve usar a figura R oficial');
assert.match(resultados,/VALIDADO CONTRA R/,'Top 30 oficial precisa estar identificado como validado');
assert.ok(!resultados.includes("rgba(155,89,182,.72)"),'O antigo Top 30 roxo não pode permanecer');
assert.match(resultados,/selectedmut/,'Genes selecionados precisam ter gráfico de frequência mutacional');
assert.match(resultados,/Valor de referência/,'A interface deve explicar o valor de referência sem chamá-lo de normal clínico');

assert.match(datapack,/const DATA_VERSION = 12/,'Cache precisa ser invalidado após mudar o denominador');
assert.match(datapack,/mutationProfileSampleIds=\[\.\.\.mutSampleIds\]/,'Top 30 deve usar o case list mutacional completo');
assert.match(datapack,/PROFILED_MUTATION_CASE_LIST/,'Política do denominador mutacional deve ficar registrada');
assert.match(datapack,/mutations\.basal=aggregateMutations/,'A seleção basal deve continuar disponível separadamente');

for(const [name,script] of [['Script.R',scriptR],['Script_LLA_validacao.R',scriptValidation]]){
  const block=script.match(/# ---- 4\. Mutações[\s\S]*?(?=# ---- 5\. DEA BASAL)/)?.[0]||'';
  assert.ok(block,`${name}: bloco de mutações ausente`);
  assert.match(block,/denom_mut <- ncol\(mut_bin\)/,`${name}: denominador mutacional precisa vir de todas as colunas perfiladas`);
  assert.match(block,/round\(100 \* n_amostras \/ denom_mut, 1\)/,`${name}: frequência precisa reproduzir a precisão da figura R`);
  assert.ok(!/filter\(sample_type %in% c\("09", "03"\)\)/.test(block),`${name}: Top 30 oficial não pode ser filtrado para 09/03`);
  assert.match(block,/scale_fill_gradient\(low = "#fef0d9", high = "#d7301f"/,`${name}: paleta da figura R deve permanecer vermelho/laranja`);
}

console.log('GENESIS V10.7.13 teacher-request regression tests: OK');
