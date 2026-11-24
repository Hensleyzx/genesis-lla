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

// V10.7.16: verify the actual chart configurations and action wiring.
assert.match(js,/data-analysis-tab="volcano"/);
assert.match(js,/data-run-analysis="volcano-reference"/);
assert.match(js,/types = \['volcano','degs'\]/);
assert.match(js,/drawVolcano\(true\)/);
assert.match(js,/data-run-analysis="roccombo-auto"/);
assert.match(js,/data-run-analysis="roccombo-manual"/);
assert.match(js,/id="roc-combo-select"/);
assert.match(js,/curveChart\.update\('none'\)/);
assert.equal((js.match(/y:\{type:'category',labels:d\.map\(r=>r\.Gene\),offset:true,reverse:true,ticks:\{color:t\.text,autoSkip:false\}/g)||[]).length,2,'Ambos os Forest Plots devem preservar os rótulos categóricos dos genes.');
assert.equal((js.match(/x:\{type:'linear',min:0,max:1,ticks:\{color:t\.muted\},grid:\{color:t\.grid\},title:\{display:true,text:'1 − Especificidade/g)||[]).length,2,'ROC precisa de eixo X numérico.');
console.log('V10.7.16 Volcano, ROC navigation and Forest Plot configuration: OK');
