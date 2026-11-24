import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync(new URL('../src/js/resultados.js',import.meta.url),'utf8');
const roc=fs.readFileSync(new URL('../src/js/predictive-roc.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/css/genesis.css',import.meta.url),'utf8');

assert.match(js,/data-analysis-tab="rocgene"/);
assert.match(js,/Desempenho dos genes/);
assert.match(js,/data-analysis-tab="roccombo"/);
assert.match(js,/Combinações de genes/);
assert.match(js,/data-use-volcano-genes/);
assert.match(js,/FIRST_EVENT — Relapse vs None/);
assert.match(js,/não um teste diagnóstico de LLA versus indivíduos saudáveis/i);
assert.match(js,/validação cruzada/i);
assert.match(roc,/individualRocAnalysis/);
assert.match(roc,/combinationRocAnalysis/);
assert.match(roc,/regularização L2/i);
assert.match(roc,/crossValidatedLogistic/);
assert.match(css,/\.roc-result-grid/);

console.log('predictive ROC/AUC UI regression: OK');
