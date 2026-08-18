import assert from 'node:assert/strict';
import { analyzeSurvival } from '../src/js/survival.js';
import { rCompatibleExpressionValues, buildRCompatibleReferenceVectors } from '../src/js/analysis-engine.js';

// Regressão do erro reportado pelo professor: 92 observações válidas devem
// formar 46/46 quando a expressão é dividida pela mediana na reprodução da saída R do professor.
const n=92;
const sampleIds=Array.from({length:n},(_,i)=>`TARGET-X-P${String(i+1).padStart(3,'0')}-09`);
const clinicalRows=sampleIds.map((sid,i)=>({PATIENT_ID:`TARGET-X-P${String(i+1).padStart(3,'0')}`,OS_MONTHS:String(12+i),OS_STATUS:i%3===0?'1:DECEASED':'0:LIVING'}));
const sampleToPatient=new Map(sampleIds.map((sid,i)=>[sid,clinicalRows[i].PATIENT_ID]));
const raw=Float32Array.from(Array.from({length:n},(_,i)=>i+1));
const dp={clinical:{rows:clinicalRows},rSampleIds:sampleIds,sampleToPatient,exprR:[{symbol:'TP53',entrez:7157,values:raw}],pack:{rExpressionSampleIds:sampleIds}};
const v=buildRCompatibleReferenceVectors(dp);
assert.equal(v.time.length,92);
const info=rCompatibleExpressionValues(dp,'TP53');
const vals=v.sampleIndices.map(i=>info.values[i]);
const km=analyzeSurvival(v.time,v.event,vals);
assert.ok(km);
assert.equal(km.n,92);
assert.equal(km.nAlto,46);
assert.equal(km.nBaixo,46);

// NA é imputado pela mediana do gene antes do filtro, como no roteiro R original do professor.
const rawMissing=Float32Array.from(raw);rawMissing[3]=NaN;rawMissing[17]=NaN;
dp.exprR=[{symbol:'TP53',entrez:7157,values:rawMissing}];
const info2=rCompatibleExpressionValues(dp,'TP53');
assert.ok(Number.isFinite(info2.values[3]));
assert.ok(Number.isFinite(info2.values[17]));
console.log('KM professor-reference regression: OK (92 -> 46/46)');
