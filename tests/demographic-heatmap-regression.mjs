import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDemographicHeatmap, normalizeClinicalSex, clinicalAgeYears, median, rankDemographicGenes, DEMOGRAPHIC_AGE_CUTOFF } from '../src/js/demographic-heatmap.js';

assert.equal(normalizeClinicalSex('Female'), 'female');
assert.equal(normalizeClinicalSex('Male'), 'male');
assert.equal(normalizeClinicalSex('Feminino'), 'female');
assert.equal(normalizeClinicalSex('Masculino'), 'male');
assert.equal(normalizeClinicalSex('[Not Available]'), null);
assert.equal(clinicalAgeYears({AGE:'11'}), 11);
assert(Math.abs(clinicalAgeYears({AGE_IN_DAYS:'3652.5'}) - 10) < 1e-9);
assert.equal(median([2,4,10,12]), 7);
assert.equal(median([2,4,10]), 4);

// 24 casos basais: 6 em cada quadrante demográfico.
// Corte fixo de 7 anos: grupos <7 e >=7, independentemente da mediana.
const sampleIds = [];
const clinicalRows = [];
const sampleToPatient = new Map();
const g1 = new Float32Array(24);
const g2 = new Float32Array(24);
for (let i=0;i<24;i++) {
  const sample = `S${i+1}`;
  const patient = `P${i+1}`;
  sampleIds.push(sample);
  sampleToPatient.set(sample, patient);
  const quadrant = Math.floor(i / 6);
  const sex = quadrant < 2 ? 'Female' : 'Male';
  const high = quadrant % 2 === 1;
  const age = high ? 14 + (i%3) : 4 + (i%3);
  clinicalRows.push({PATIENT_ID:patient, SEX:sex, AGE:age});
  g1[i] = quadrant * 10 + (i%3);
  g2[i] = 30 - quadrant * 7 + (i%2);
}

const dp = {
  clinical:{rows:clinicalRows},
  rnaSampleIds:sampleIds,
  sampleToPatient,
  pack:{expressionTransform:{key:'none'}},
  expr:[
    {symbol:'GENEA', values:g1},
    {symbol:'GENEB', values:g2},
  ],
};

const out = buildDemographicHeatmap(dp, ['GENEA','GENEB'], {minGroupN:5});
assert.equal(out.available, true);
assert.equal(out.groups.length, 4);
assert(out.groups.every(g => g.n === 6));
assert.equal(out.rows.length, 2);
assert.equal(out.cutoff, 7);
assert.equal(DEMOGRAPHIC_AGE_CUTOFF, 7);
assert(out.groups.every(g=>g.label.includes("7 anos")));
assert(out.rows[0].cells[0].value < 0);
assert(out.rows[0].cells[3].value > 0);
assert(out.strongest && ['GENEA','GENEB'].includes(out.strongest.gene));

// Proteção contra grupos muito pequenos.
const small = buildDemographicHeatmap({
  ...dp,
  rnaSampleIds:sampleIds.slice(0,8),
  expr:[
    {symbol:'GENEA', values:g1.slice(0,8)},
  ],
}, ['GENEA'], {minGroupN:5});
assert.equal(small.available, false);

// O CSV real fornecido pelo professor contém os campos necessários.
const clinicalText = fs.readFileSync(new URL('../public/data/genesis_r/clinical_data.csv', import.meta.url), 'utf8');
const header = clinicalText.split(/\r?\n/,1)[0];
assert(/\bSEX\b/.test(header), 'clinical_data.csv deve conter SEX');
assert(/\bAGE\b/.test(header), 'clinical_data.csv deve conter AGE');
assert(/\bAGE_IN_DAYS\b/.test(header), 'clinical_data.csv deve conter AGE_IN_DAYS');

// A interface precisa oferecer e gerar o novo heatmap.
const ui = fs.readFileSync(new URL('../src/js/resultados.js', import.meta.url), 'utf8');
assert(ui.includes('data-run-analysis="demographic"'), 'A análise demográfica deve ter um botão direto de geração.');
assert(ui.includes('drawDemographicHeatmap(genes)'));
assert(ui.includes('Heatmap demográfico — genes × sexo/idade'));
assert(!ui.includes("new Set(['selectedmut','demographic','cox','km'])"), 'A revisão atual remove a geração automática de um pacote fixo de gráficos.');
assert(!ui.includes('id="generate-selected"'), 'A interface atual deve usar ações diretas por análise, sem botão genérico redundante.');
assert(ui.includes('corte fixo'));
assert(ui.includes('rankDemographicGenes(dp)'));
assert(ui.includes('ranked.results.slice(0,20)'));
assert(ui.includes('const v = cell.value;'));
assert(ui.includes('negativo = abaixo da média'));
assert(!ui.includes('mediana da própria coorte'));
assert(ui.includes('não testa significância entre grupos'));

console.log('OK demographic heatmap: sexo/idade presentes, agrupamento basal e guardrails validados.');

// Idade exatamente 7 pertence ao grupo >=7, mesmo em coortes com outra mediana.
const boundary={...dp,clinical:{rows:clinicalRows.map((r,i)=>({...r,AGE:i===6||i===18?7:r.AGE}))}};
assert(buildDemographicHeatmap(boundary,['GENEA']).groups.every(g=>g.n===6));
// Uma célula sem expressão suficiente permanece ausente, jamais zero.
const incomplete={...dp,expr:[{symbol:'GENEA',values:Array.from(g1,(v,i)=>i<6?null:v)}]};
const partial=buildDemographicHeatmap(incomplete,['GENEA']);
assert.equal(partial.available,true);
assert.equal(partial.rows[0].cells[0].value,null);
assert.equal(partial.rows[0].cells[0].n,0);
// Ranking usa todos os genes de expressão, independentemente da frequência mutacional.
const rankedDp={...dp,clinical:{rows:clinicalRows.map((r,i)=>({...r,FIRST_EVENT:i%2?'Relapse':'None'}))},expr:Array.from({length:25},(_,j)=>({symbol:`G${String(j).padStart(2,'0')}`,values:sampleIds.map((_,i)=>j===24?i%2:(i+j)%7)}))};
const ranked=rankDemographicGenes(rankedDp);
assert.equal(ranked.results.length,25);
assert.equal(ranked.results[0].gene,'G24');
assert.equal(ranked.results[0].auc,1);
assert(!('points' in ranked.results[0]));
assert(ranked.results.every((r,i,a)=>i===0||a[i-1].auc>=r.auc));
const rankedHeat=buildDemographicHeatmap(rankedDp,ranked.results.map(r=>r.gene));
assert.equal(rankedHeat.rows.length,20);
assert.equal(rankedHeat.rows[0].gene,'G24');
assert.equal(rankDemographicGenes({...rankedDp,clinical:{rows:clinicalRows}}).available,false);
console.log('V10.7.17 fixed cutoff, missing cells and top 20 AUC heatmap: OK');
