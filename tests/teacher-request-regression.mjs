import assert from 'node:assert/strict';
import fs from 'node:fs';

const resultados=fs.readFileSync('src/js/resultados.js','utf8');
const datapack=fs.readFileSync('src/js/datapack.js','utf8');
const scriptR=fs.readFileSync('public/referencias/Script.R','utf8');
const scriptValidation=fs.readFileSync('public/referencias/Script_LLA_validacao.R','utf8');

assert.match(resultados,/id="generate-gene-graphs"/,'Botão Gerar gráficos deve ficar junto à seleção de genes');
assert.match(resultados,/fig1_top30_genes_R_original\.jpeg/,'Top 30 principal deve usar a figura R oficial');
assert.match(resultados,/VALIDADO CONTRA R/,'Top 30 oficial precisa estar identificado como validado');
assert.ok(!resultados.includes("rgba(155,89,182,.72)"),'O antigo Top 30 roxo não pode permanecer');
assert.match(resultados,/selectedmut/,'Genes selecionados precisam ter gráfico de frequência mutacional');
assert.match(resultados,/Valor de referência/,'A interface deve explicar o valor de referência sem chamá-lo de normal clínico');

assert.match(datapack,/const DATA_VERSION = 9/,'Cache precisa ser invalidado após mudar o denominador');
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

console.log('GENESIS V10.7 teacher-request regression tests: OK');
