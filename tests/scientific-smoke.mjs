import assert from 'node:assert/strict';
import { logRank, analyzeSurvival, atRiskAt } from '../src/js/survival.js';
import { univariate } from '../src/js/cox.js';
import { buildReferenceVectors, transformExpressionValue } from '../src/js/analysis-engine.js';
import { selectAnalysisSamples, aggregateMutations } from '../src/js/datapack.js';

function near(actual,expected,tol=1e-9,msg=''){
  assert.ok(Number.isFinite(actual),`${msg} não finito: ${actual}`);
  assert.ok(Math.abs(actual-expected)<=tol,`${msg}: ${actual} != ${expected}`);
}

function makeDp(rows){
  const rna=[],map=new Map();
  rows.forEach((r,i)=>{const sid=`S${i+1}`;rna.push(sid);map.set(sid,r.PATIENT_ID);});
  return {clinical:{rows},rnaSampleIds:rna,sampleToPatient:map,pack:{analysisPatientIds:rows.map(r=>r.PATIENT_ID)}};
}

// 1) Log-rank: referência independente statsmodels.survdiff.
{
  const time=[5,6,6,7,10,12,15,18,20,22,25,30];
  const event=[1,1,0,1,1,0,1,1,0,1,1,0];
  const group=['A','B','A','B','A','B','A','B','A','B','A','B'];
  const r=logRank(time,event,group);
  near(r.chi2,0.06907582617182202,1e-12,'logrank chi2');
  near(r.p,0.7926871584028927,1e-12,'logrank p');
  assert.deepEqual(r.labels,['A','B']);
  assert.equal(r.O.length,2);
  assert.equal(r.E.length,2);
}

// 2) Cox Efron padronizado: referência independente statsmodels.PHReg.
// Aqui reduzimos apenas os mínimos para testar a fórmula no fixture de 16 casos.
{
  const time=[5,6,6,7,10,12,15,18,20,22,25,30,35,40,42,50];
  const event=[1,1,0,1,1,0,1,1,0,1,1,0,1,0,1,0];
  const x=[1.2,0.7,1.5,0.4,1.1,0.9,1.7,1.3,2.0,1.8,2.2,2.4,2.0,2.8,2.6,3.0];
  const r=univariate(time,event,['G'],{G:{values:x}},{minN:5,minEvents:1})[0];
  near(r.HR,0.07428768465924318,1e-10,'cox HR');
  near(r.HR_lower,0.015097856894411585,1e-10,'cox lower');
  near(r.HR_upper,0.365526056487783,1e-9,'cox upper');
  near(r.p_value,0.001384376913493579,2e-6,'cox p');
}

// 3) Endpoint único: escolhe uma única coluna OS e não mistura OS_DAYS por paciente.
{
  const rows=[];
  for(let i=1;i<=24;i++) rows.push({
    PATIENT_ID:`P${i}`,
    OS_MONTHS:i<=22?String(10+i):'',
    OS_DAYS:String((10+i)*30.4375),
    OS_STATUS:i<=6?'DECEASED':'LIVING',
    EFS_MONTHS:String(5+i),
    EFS_STATUS:i<=10?'EVENT':'0'
  });
  const v=buildReferenceVectors(makeDp(rows));
  assert.equal(v.endpointKey,'OS');
  assert.equal(v.endpointPolicy,'OS_ONLY');
  assert.equal(v.endpointTimeColumn,'OS_MONTHS');
  assert.equal(v.time.length,22);
  assert.equal(v.nEvents,6);
  assert.equal(v.endpointAdequate,true);
}

// 4) OS-only: EFS adequado NÃO substitui OS insuficiente.
{
  const rows=[];
  for(let i=1;i<=24;i++) rows.push({
    PATIENT_ID:`P${i}`,
    OS_MONTHS:i<=12?String(10+i):'',
    OS_STATUS:i<=3?'DECEASED':'LIVING',
    EFS_MONTHS:String(5+i),
    EFS_STATUS:i<=10?'EVENT':'0'
  });
  const v=buildReferenceVectors(makeDp(rows));
  assert.equal(v.endpointKey,'OS');
  assert.equal(v.endpointPolicy,'OS_ONLY');
  assert.equal(v.time.length,12);
  assert.equal(v.nEvents,3);
  assert.equal(v.endpointAdequate,false);
}

// 5) Status desconhecido não vira censura (0); é excluído da coorte de OS.
{
  const rows=[];
  for(let i=1;i<=24;i++) rows.push({PATIENT_ID:`P${i}`,OS_MONTHS:String(10+i),OS_STATUS:i<=5?'DECEASED':'LIVING'});
  rows[23].OS_STATUS='[Not Available]';
  const v=buildReferenceVectors(makeDp(rows));
  assert.equal(v.time.length,23);
  assert.equal(v.event.length,23);
  assert.equal(v.nEvents,5);
  assert.equal(v.endpointAdequate,true);
}

// 6) KM: fórmula/split e número em risco (mínimos reduzidos apenas no fixture).
{
  const time=[5,6,7,8,9,10,11,12];
  const event=[1,0,1,0,1,1,0,1];
  const expr=[1,2,3,4,5,6,7,8];
  const s=analyzeSurvival(time,event,expr,undefined,{minN:5,minEvents:1,minGroup:2});
  assert.equal(s.nAlto,4);
  assert.equal(s.nBaixo,4);
  const alto=s.km.find(g=>g.name==='Alto');
  assert.deepEqual(atRiskAt(alto,[0,10,12]),[4,3,1]);
  assert.equal(alto.ciLo.length,alto.times.length);
  assert.equal(alto.ciHi.length,alto.times.length);
  alto.ciLo.forEach((lo,i)=>assert.ok(lo<=alto.surv[i]+1e-12));
  alto.ciHi.forEach((hi,i)=>assert.ok(hi+1e-12>=alto.surv[i]));
}

// 7) Proteções do R por gene: KM bloqueia grupo <5 e Cox bloqueia <20 casos completos.
{
  const time=Array.from({length:24},(_,i)=>i+1);
  const event=time.map((_,i)=>i<8?1:0);
  const exprKm=time.map((_,i)=>i===0?0:1); // mediana=1 -> grupo baixo n=1
  assert.equal(analyzeSurvival(time,event,exprKm),null);

  const exprCox=time.map((_,i)=>i<19?i+1:NaN);
  const c=univariate(time,event,['G'],{G:{values:exprCox}});
  assert.equal(c.length,0);
}

// 8) Ausência molecular nunca é reinterpretada como expressão zero.
{
  assert.ok(Number.isNaN(transformExpressionValue(null,{expressionTransform:{key:'none'}})));
  assert.ok(Number.isNaN(transformExpressionValue('',{expressionTransform:{key:'none'}})));
  near(transformExpressionValue(3,{expressionTransform:{key:'log2p1'}}),2,1e-12,'log2p1');
}

// 9) TARGET sem amostra basal válida fica vazio; não reintroduz relapse/xeno/normal.
{
  const samples=[
    {sampleId:'TARGET-10-TESTAA-04',patientId:'TARGET-10-TESTAA'},
    {sampleId:'TARGET-10-TESTAA-60.2',patientId:'TARGET-10-TESTAA'},
    {sampleId:'TARGET-10-TESTAA-10',patientId:'TARGET-10-TESTAA'}
  ];
  const sel=selectAnalysisSamples(samples,samples.map(x=>x.sampleId));
  assert.deepEqual(sel.sampleIds,[]);
}


// 10) O Top 30 mutacional usa o case list perfilado completo, não o subconjunto basal.
{
  const ids=Array.from({length:150},(_,i)=>`S${i+1}`);
  const raw=[];
  for(let i=0;i<16;i++)raw.push({sampleId:ids[i],entrezGeneId:4893,gene:{hugoGeneSymbol:'NRAS'},proteinChange:'p.Q61'});
  for(let i=0;i<8;i++)raw.push({sampleId:ids[i],entrezGeneId:3845,gene:{hugoGeneSymbol:'KRAS'},proteinChange:'p.G12'});
  const geneMap={entrez2sym:{4893:'NRAS',3845:'KRAS'}};
  const full=aggregateMutations(raw,geneMap,150);
  const basalSet=new Set(ids.slice(0,81));
  const basal=aggregateMutations(raw.filter(x=>basalSet.has(x.sampleId)),geneMap,81);
  near(full.byGene.NRAS.frequency,100*16/150,1e-12,'NRAS full denominator');
  near(full.byGene.KRAS.frequency,100*8/150,1e-12,'KRAS full denominator');
  assert.equal(full.totalSamples,150);
  assert.equal(basal.totalSamples,81);
  assert.notEqual(full.byGene.NRAS.frequency,basal.byGene.NRAS.frequency,'A coorte basal não pode sobrescrever o Top 30 oficial');
}

console.log('GENESIS V10.5 scientific regression tests: OK');
