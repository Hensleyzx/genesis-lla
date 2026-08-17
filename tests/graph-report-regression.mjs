import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { graphReport } from '../src/js/common.js';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const sample=graphReport({what:'A < B',finding:'p=0,01',caution:'Não é diagnóstico.',source:'Teste'});
assert.match(sample,/Mini-laudo do gráfico/);
assert.match(sample,/O que é/);
assert.match(sample,/Leitura deste resultado/);
assert.match(sample,/Limite/);
assert.ok(sample.includes('A &lt; B'),'O mini-laudo deve escapar HTML dinâmico');
assert.ok(!sample.includes('A < B'),'Texto dinâmico cru não deve entrar no HTML');

const results=read('src/js/resultados.js');
for(const token of [
  'top30GraphReport()',
  'selectedMutationGraphReport(rows)',
  'mutationHeatmapGraphReport()',
  'degGraphReport()',
  'volcanoGraphReport()',
  "id=\"cox-graph-report\"",
  'coxGraphReport(d)',
  'kmGraphReport(gene,s)',
]) assert.ok(results.includes(token),`Interpretação ausente em Estudos & Gráficos: ${token}`);

const genesisR=read('src/js/resultados-r.js');
for(const token of [
  'rTop30GraphReport()',
  'rDeaGraphReport(deaSummary)',
  'rCoxUniGraphReport()',
  'rCoxMultiGraphReport()',
  'id="gr-km-report"',
  'rKmGraphReport(gene, r)',
]) assert.ok(genesisR.includes(token),`Interpretação ausente no GENESIS-R: ${token}`);

const patient=read('src/js/analise.js');
assert.match(patient,/patientMatchedGraphReport\(s\)/,'Curva de perfis semelhantes precisa de mini-laudo');
assert.match(patient,/não deve ser convertida em probabilidade individual/i);

const css=read('src/css/genesis.css');
assert.match(css,/\.graph-report\{/);
assert.match(css,/\.graph-report__row/);

// Regressões numéricas usadas pelos textos do GENESIS-R.
function parseCsv(text){
  const lines=text.trim().split(/\r?\n/);const head=lines.shift().split(',').map(h=>h.replace(/^\"|\"$/g,''));
  return lines.map(line=>{const vals=[];let f='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'&&line[i+1]==='"'){f+='"';i++;}else if(c==='"')q=false;else f+=c;}else if(c==='"')q=true;else if(c===','){vals.push(f);f='';}else f+=c;}vals.push(f);return Object.fromEntries(head.map((h,i)=>[h,vals[i]??'']));});
}
const uni=parseCsv(read('public/data/genesis_r/cox_univariado.csv'));
const multi=parseCsv(read('public/data/genesis_r/cox_multivariado.csv'));
assert.equal(uni.filter(r=>Number(r.p_value)<.05).length,7,'Mini-laudo Cox univariado deve partir de 7/10 p<0,05');
assert.equal(multi.filter(r=>Number(r.p_value)<.05).length,1,'Mini-laudo Cox multivariado deve partir de 1/9 p<0,05');
const manifest=JSON.parse(read('public/data/genesis_r/manifest.json'));
for(const gene of manifest.km_genes){
  assert.equal(manifest.km_results[gene].high_n,46,`KM R ${gene}: grupo Alto deve permanecer n=46`);
  assert.equal(manifest.km_results[gene].low_n,46,`KM R ${gene}: grupo Baixo deve permanecer n=46`);
}
assert.ok(manifest.km_results.EPM2AIP1.p<.05);
assert.ok(manifest.km_results.FRMD4A.p>=.05);

console.log('Graph mini-report regression: OK');
