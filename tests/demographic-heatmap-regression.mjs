import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDemographicHeatmap, normalizeClinicalSex, clinicalAgeYears, median } from '../src/js/demographic-heatmap.js';

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
// Idades têm mediana 11, portanto grupos <11 e >=11.
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
  const age = high ? 14 + (i%3) : 5 + (i%3);
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
assert(Number.isFinite(out.cutoff));
assert(out.cutoff >= 7 && out.cutoff <= 14);
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
assert(ui.includes("graphChoice('demographic'"));
assert(ui.includes('drawDemographicHeatmap(genes)'));
assert(ui.includes('Heatmap demográfico — genes × sexo/idade'));
assert(ui.includes("new Set(['selectedmut','demographic','cox','km'])"));
assert(ui.includes('mediana da própria coorte'));
assert(ui.includes('não testa significância entre grupos'));

console.log('OK demographic heatmap: sexo/idade presentes, agrupamento basal e guardrails validados.');
