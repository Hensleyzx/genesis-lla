import assert from 'node:assert/strict';
import fs from 'node:fs';

const resultados=fs.readFileSync('src/js/resultados.js','utf8');
const studyUi=fs.readFileSync('src/js/study-ui.js','utf8');
const common=fs.readFileSync('src/js/common.js','utf8');
const datapack=fs.readFileSync('src/js/datapack.js','utf8');
const scriptR=fs.readFileSync('public/referencias/Script.R','utf8');
const scriptValidation=fs.readFileSync('public/referencias/Script_LLA_validacao.R','utf8');

assert.ok(!resultados.includes('id="generate-gene-graphs"'),'A interface não deve manter um segundo botão de geração junto aos genes.');
assert.equal((resultados.match(/id="generate-selected"/g)||[]).length,1,'Genes e tipos de gráfico devem compartilhar um único botão de geração.');
assert.match(resultados,/Montar análise/,'Genes e gráficos precisam ficar reunidos em um único painel de configuração.');
assert.match(resultados,/analysis-category-tabs/,'Seletor por tipo de análise ausente.');
assert.match(resultados,/data-analysis-tab="survival"/,'A categoria Sobrevida deve ser acionável diretamente.');
assert.match(resultados,/data-analysis-panel="survival"/,'O painel de Sobrevida deve abrir os próprios controles.');
assert.match(resultados,/Genes para Sobrevida/,'Os genes de Sobrevida precisam aparecer dentro do próprio painel de Sobrevida.');
assert.ok(!resultados.includes('analysis-builder-grid'),'A interface não deve voltar ao layout redundante de genes em uma coluna e análises em outra.');
assert.match(resultados,/result-analysis-block/,'Resultados precisam ser separados por blocos de análise.');
assert.match(resultados,/data-result-carousel/,'Blocos de resultados precisam permitir navegação lateral entre gráficos.');
assert.match(resultados,/Kaplan-Meier — \$\{g\}/,'Kaplan-Meier deve continuar gerando um gráfico separado por gene.');
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

console.log('GENESIS V10.7.11 teacher-request regression tests: OK');
