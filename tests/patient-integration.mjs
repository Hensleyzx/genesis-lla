import assert from 'node:assert/strict';
import { analyzeAgainstStudy } from '../src/js/analysis-engine.js';
import { buildStudyAnalytics } from '../src/js/research-analytics.js';

const N=30;
const sampleIds=Array.from({length:N},(_,i)=>`S${i+1}`);
const clinicalRows=Array.from({length:N},(_,i)=>({
  PATIENT_ID:`P${i+1}`,
  OS_MONTHS:String(8+i*1.8),
  OS_STATUS:i<10?'DECEASED':'LIVING',
  FIRST_EVENT:i%3===0?'Relapse':'None',
  AGE:String(3+(i%12)),
  GENDER:i%2===0?'Female':'Male',
  MOLECULAR_SUBTYPE:i%2===0?'B-ALL':'T-ALL',
  BCR_ABL1_STATUS:i%7===0?'POSITIVE':'NEGATIVE'
}));
const sampleToPatient=new Map(sampleIds.map((s,i)=>[s,`P${i+1}`]));
const tp53=new Float32Array(Array.from({length:N},(_,i)=>1+i*0.11));
const ikzf1=new Float32Array(Array.from({length:N},(_,i)=>2+(N-i)*0.08));

const dp={
  pack:{
    studyId:'fixture_lla',
    studyName:'Fixture LLA',
    nPatients:N,
    nAnalysisSamples:N,
    nMutationSamples:N,
    nGenes:2,
    buildDate:'2026-08-17T00:00:00Z',
    scope:'expresso',
    expressionTransform:{key:'none',label:'sem transformação'},
    selection:{method:'fixture'},
    mutationSelection:{sampleIds,patientIds:clinicalRows.map(r=>r.PATIENT_ID)},
    capabilities:{clinical:true,mutation:true,expression:true,survival:true}
  },
  clinical:{rows:clinicalRows,attributes:['PATIENT_ID','OS_MONTHS','OS_STATUS','FIRST_EVENT','AGE','GENDER','MOLECULAR_SUBTYPE','BCR_ABL1_STATUS']},
  rnaSampleIds:sampleIds,
  sampleToPatient,
  expr:[
    {symbol:'TP53',entrez:7157,values:tp53},
    {symbol:'IKZF1',entrez:10320,values:ikzf1}
  ],
  mut:{
    totalSamples:N,
    byGene:{
      TP53:{symbol:'TP53',count:4,frequency:100*4/N,samples:sampleIds.slice(0,4)},
      IKZF1:{symbol:'IKZF1',count:3,frequency:10,samples:sampleIds.slice(4,7)}
    }
  }
};

const result=await analyzeAgainstStudy({
  id:'TEST-001',
  idade:8,
  sexo:'F',
  subtipoMolecular:'B-ALL',
  biomarcadores:['TP53','IKZF1'],
  expressao:{TP53:2.1},
  alteracoes:{TP53:'presente'},
  fusoes:{'BCR-ABL1':'nao_informado'}
},dp);

assert.equal(result.studyId,'fixture_lla');
assert.equal(result.vectors.endpointKey,'OS');
assert.equal(result.vectors.endpointPolicy,'OS_ONLY');
assert.ok(result.vectors.endpointAdequate);
const tp=result.evidencias.find(x=>x.gene==='TP53');
const ik=result.evidencias.find(x=>x.gene==='IKZF1');
assert.ok(tp);
assert.ok(ik);
assert.equal(tp.patientExpression,2.1);
assert.equal(tp.referencePosition,'Dentro da faixa central','O caso de referência deve conseguir aparecer dentro da faixa central Q25–Q75');
assert.ok(Number.isFinite(tp.q25)&&Number.isFinite(tp.q75)&&tp.q25<=tp.patientExpression&&tp.patientExpression<=tp.q75);
assert.equal(ik.patientExpression,null,'Expressão ausente não pode virar zero');
assert.equal(ik.patientGroup,null,'Caso sem expressão não pode ser colocado artificialmente em Alto/Baixo');
assert.ok(result.dataQuality);
assert.ok(result.matched && typeof result.matched.available==='boolean');
assert.equal(result.dea?.blocked,true,'DEA deve ficar bloqueada em painel parcial/escopo expresso');
assert.equal(result.dea?.table?.length,0,'Painel parcial não pode produzir FDR/DEA como se fosse transcriptoma completo');
const analytics=buildStudyAnalytics(dp);
assert.equal(analytics.dea?.blocked,true,'Painel de estudos também deve bloquear DEA em escopo parcial');
assert.equal(analytics.topDEGs.length,0,'Painel parcial não deve produzir Top DEGs');

console.log('GENESIS V10.5 patient integration tests: OK');
