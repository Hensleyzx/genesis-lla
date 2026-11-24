import assert from 'node:assert/strict';
import { individualRocAnalysis, combinationRocAnalysis } from '../src/js/predictive-roc.js';

let seed=0x5eed1234;
function rnd(){seed=(1664525*seed+1013904223)>>>0;return seed/2**32;}
function normalish(){return (rnd()+rnd()+rnd()+rnd()+rnd()+rnd()-3)/1.22;}

function syntheticDp(iter){
  const n0=12+Math.floor(rnd()*26), n1=12+Math.floor(rnd()*26), n=n0+n1;
  const geneCount=3+Math.floor(rnd()*3), genes=Array.from({length:geneCount},(_,i)=>`G${i+1}`);
  const rnaSampleIds=[],sampleToPatient=new Map(),clinicalRows=[];
  const values=Object.fromEntries(genes.map(g=>[g,[]]));
  const effects=genes.map((_,i)=> i<2 ? 0.25+rnd()*0.85 : (rnd()-.5)*0.25);
  for(let i=0;i<n;i++){
    const y=i>=n0?1:0,sid=`I${iter}_S${i}`,pid=`I${iter}_P${i}`;
    rnaSampleIds.push(sid);sampleToPatient.set(sid,pid);clinicalRows.push({PATIENT_ID:pid,FIRST_EVENT:y?'Relapse':'None'});
    genes.forEach((g,j)=>{
      let v=normalish()+effects[j]*y;
      if(rnd()<0.05)v=NaN;
      values[g].push(v);
    });
  }
  return {pack:{expressionTransform:{key:'none'}},rnaSampleIds,sampleToPatient,clinical:{rows:clinicalRows},expr:genes.map(symbol=>({symbol,values:Float64Array.from(values[symbol])})),genes};
}

function assertRoc(r){
  assert.ok(r.auc>=0&&r.auc<=1,`AUC inválida ${r.auc}`);
  let lastF=-1,lastT=-1;
  for(const p of r.points){assert.ok(p.fpr>=lastF-1e-12);assert.ok(p.tpr>=lastT-1e-12);lastF=p.fpr;lastT=p.tpr;}
}

for(let iter=0;iter<300;iter++){
  const dp=syntheticDp(iter);
  const individual=individualRocAnalysis(dp,dp.genes,{minPerGroup:8});
  for(const r of individual.results){assertRoc(r);assert.ok(r.auc>=.5-1e-12);assert.ok(r.n===r.nPos+r.nNeg);}
  const combo=combinationRocAnalysis(dp,dp.genes,{minPerGroup:8,maxGenes:8,maxSize:3,maxCombinations:80,folds:5});
  if(combo.available){
    for(const r of combo.results){assertRoc(r);assert.ok(r.n===r.nPos+r.nNeg);assert.ok(r.folds>=3&&r.folds<=5);}
    for(let i=1;i<combo.results.length;i++)assert.ok(combo.results[i-1].auc>=combo.results[i].auc-1e-12);
  }
}
console.log('predictive ROC/AUC fuzz: OK (300 coortes sintéticas)');
