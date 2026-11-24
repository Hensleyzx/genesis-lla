import assert from 'node:assert/strict';
import { aucFromScores, individualRocAnalysis, combinationRocAnalysis } from '../src/js/predictive-roc.js';

function makeDp(nPerGroup=30){
  const rnaSampleIds=[],sampleToPatient=new Map(),clinicalRows=[];
  const genes=['GENEA','GENEB','NOISE','NULLISH'];
  const values=Object.fromEntries(genes.map(g=>[g,[]]));
  for(let group=0;group<=1;group++){
    for(let j=0;j<nPerGroup;j++){
      const idx=group*nPerGroup+j, sid=`S${idx}`, pid=`P${idx}`;
      rnaSampleIds.push(sid);sampleToPatient.set(sid,pid);
      clinicalRows.push({PATIENT_ID:pid,FIRST_EVENT:group===1?'Relapse':'None'});
      const noise1=Math.sin((idx+1)*1.73)*0.95;
      const noise2=Math.cos((idx+1)*2.11)*0.95;
      values.GENEA.push(group*0.75+noise1);
      values.GENEB.push(group*0.75+noise2);
      values.NOISE.push(Math.sin((idx+1)*4.17));
      values.NULLISH.push(j%7===0?NaN:group*0.4+Math.cos(idx));
    }
  }
  return {
    pack:{expressionTransform:{key:'none'}},rnaSampleIds,sampleToPatient,
    clinical:{rows:clinicalRows},
    expr:genes.map(symbol=>({symbol,values:Float64Array.from(values[symbol])}))
  };
}

{
  const r=aucFromScores([0,0,1,1],[0.1,0.2,0.8,0.9]);
  assert.equal(r.auc,1);
  assert.equal(r.flipped,false);
}
{
  const r=aucFromScores([0,0,1,1],[0.9,0.8,0.2,0.1]);
  assert.equal(r.auc,1);
  assert.equal(r.flipped,true);
}
{
  const dp=makeDp();
  const r=individualRocAnalysis(dp,['GENEA','NOISE','MISSING']);
  assert.equal(r.available,true);
  assert.ok(r.results.find(x=>x.gene==='GENEA').auc>.65);
  assert.ok(r.missing.some(x=>x.gene==='MISSING'));
}
{
  const dp=makeDp();
  const one=individualRocAnalysis(dp,['GENEA','GENEB']);
  const combo=combinationRocAnalysis(dp,['GENEA','GENEB'],{minPerGroup:10,maxGenes:8,maxSize:2});
  assert.equal(combo.available,true);
  assert.equal(combo.results.length,1);
  const bestSingle=Math.max(...one.results.map(x=>x.auc));
  assert.ok(combo.results[0].auc>0.5);
  // O modelo multivariado deve permanecer plausível; em dados sintéticos aditivos tende a igualar/superar os genes isolados.
  assert.ok(combo.results[0].auc>=bestSingle-0.12);
  assert.equal(combo.results[0].folds,5);
}
{
  const dp=makeDp();
  const r=combinationRocAnalysis(dp,['GENEA']);
  assert.equal(r.available,false);
  assert.match(r.reason,/pelo menos 2/i);
}
{
  const dp=makeDp();
  const tooMany=['A','B','C','D','E','F','G','H','I'];
  const r=combinationRocAnalysis(dp,tooMany);
  assert.equal(r.available,false);
  assert.match(r.reason,/no máximo 8/i);
}

console.log('predictive ROC/AUC regression: OK');

// V10.7.16: múltiplas combinações exatas, deduplicação, busca de pares/trios.
{
  const dp=makeDp();
  const r=combinationRocAnalysis(dp,['GENEA','GENEB','NOISE'],{explicitCombos:[['GENEA','GENEB'],['GENEB','GENEA'],['GENEA','NOISE','GENEB']]});
  assert.equal(r.tested,2);assert.equal(r.results.length,2);
  assert.ok(r.results.every(x=>x.genes.includes('GENEA')));
  assert.ok(!r.results.some(x=>x.label==='GENEB + NOISE'));
  const invalid=combinationRocAnalysis(dp,['GENEA','GENEB'],{explicitCombos:[['GENEA','NOISE']]});
  assert.equal(invalid.available,false);
}
{
  const dp=makeDp(40); const genes=Array.from({length:10},(_,i)=>`G${i}`);
  dp.expr=genes.map((symbol,j)=>({symbol,values:Float64Array.from(dp.rnaSampleIds.map((_,i)=>i%19===0&&j===0?NaN:(i>=40?0.4:0)+Math.sin((i+1)*(j+1)*.71)))}));
  const r=combinationRocAnalysis(dp,genes,{maxGenes:10,maxSize:3,commonCases:true});
  assert.equal(r.tested,165);assert.equal(r.results.length,165);assert.equal(r.commonCases,true);
  assert.equal(new Set(r.results.map(x=>x.n)).size,1);
  assert.ok(r.results.every((x,i)=>x.auc>=0&&x.auc<=1&&(!i||r.results[i-1].auc>=x.auc)));
  const unavailable=combinationRocAnalysis(dp,[...genes.slice(0,2),'MISSING'],{maxGenes:10,maxSize:3,commonCases:true});
  assert.equal(unavailable.available,false);
}
{
  const r=aucFromScores([0,1,0,1,null,1],[1,2,null,'',100,undefined],{orient:false});
  assert.equal(r.n,2);assert.equal(r.auc,1);
}
console.log('V10.7.16 exact combinations, common cohort, 165 models and missing values: OK');
