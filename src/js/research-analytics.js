import { runDEA } from './dea.js';
import { univariate as coxUnivariate } from './cox.js';
import { bhFdr } from './stats.js';
import { buildReferenceVectors, transformExpressionValue } from './analysis-engine.js';

function finite(v){return Number.isFinite(Number(v));}

export function buildStudyAnalytics(dp){
  const vectors=buildReferenceVectors(dp);
  const clinicalMap=new Map((dp.clinical?.rows||[]).map(r=>[String(r.PATIENT_ID),r]));
  const groups=(dp.rnaSampleIds||[]).map(id=>{
    const pid=String(dp.sampleToPatient.get(id)||'');
    const ev=String(clinicalMap.get(pid)?.FIRST_EVENT??'').trim().toLowerCase();
    return ev==='relapse'?1:ev==='none'?0:-1;
  });
  // O FDR da DEA depende do universo de genes. Em painel parcial/"Expresso"
  // a análise diferencial fica bloqueada em vez de produzir um ranking enganoso.
  const dea=dp.pack.scope==='completo'
    ? runDEA(dp.expr||[],groups,{transform:dp.pack.expressionTransform?.key==='log2p1'?'log2p1':'none'})
    : {table:[],n0:0,n1:0,df:0,nDEG:0,blocked:true,warning:'DEA bloqueada no escopo Expresso; use escopo Completo.'};
  const topDEGs=(dea.table||[])
    .filter(x=>x.signif!=='NS'&&finite(x.logFC)&&finite(x['adj.P.Val']))
    .sort((a,b)=>a['adj.P.Val']-b['adj.P.Val']||Math.abs(b.logFC)-Math.abs(a.logFC))
    .slice(0,20);

  const topMut=Object.values(dp.mut?.byGene||{})
    .filter(x=>finite(x.frequency))
    .sort((a,b)=>b.frequency-a.frequency||b.count-a.count)
    .slice(0,30);

  let cox=[];
  if(vectors.expressionAligned&&vectors.time.length>=10&&vectors.nEvents>=3&&(dp.expr||[]).length){
    const exprMap=new Map((dp.expr||[]).map(r=>[String(r.symbol).toUpperCase(),r]));
    let candidateGenes=topDEGs.slice(0,15).map(x=>String(x.gene).toUpperCase());
    if(candidateGenes.length<5){
      const mutGenes=topMut.map(x=>String(x.symbol).toUpperCase()).filter(g=>exprMap.has(g));
      candidateGenes=[...new Set([...candidateGenes,...mutGenes])].slice(0,15);
    }
    if(candidateGenes.length<5){
      candidateGenes=[...new Set([...candidateGenes,...[...exprMap.keys()].slice(0,15)])].slice(0,15);
    }
    const rows={};
    for(const gene of candidateGenes){
      const src=exprMap.get(gene);if(!src)continue;
      rows[gene]={values:vectors.sampleIndices.map(i=>Number.isInteger(i)?transformExpressionValue(src.values?.[i],dp.pack):NaN)};
    }
    cox=coxUnivariate(vectors.time,vectors.event,candidateGenes,rows)
      .filter(x=>finite(x.HR)&&finite(x.HR_lower)&&finite(x.HR_upper)&&finite(x.p_value));
    const q=bhFdr(cox.map(x=>x.p_value));
    cox.forEach((x,i)=>{x.q_value=q[i];});
    cox.sort((a,b)=>a.q_value-b.q_value||a.p_value-b.p_value);
  }

  return{vectors,groups,dea,topDEGs,topMut,cox};
}

export function volcanoPoints(dea,maxPoints=3000){
  const all=(dea?.table||[]).filter(x=>finite(x.logFC)&&finite(x['adj.P.Val'])&&Number(x['adj.P.Val'])>0);
  const sig=all.filter(x=>Number(x['adj.P.Val'])<.05&&Math.abs(Number(x.logFC))>.5);
  const ns=all.filter(x=>!(Number(x['adj.P.Val'])<.05&&Math.abs(Number(x.logFC))>.5));
  const slots=Math.max(0,maxPoints-sig.length);
  const step=slots&&ns.length>slots?Math.ceil(ns.length/slots):1;
  const sampled=slots?ns.filter((_,i)=>i%step===0).slice(0,slots):[];
  return[...sig,...sampled].map(x=>({
    gene:x.gene,
    x:Number(x.logFC),
    y:-Math.log10(Number(x['adj.P.Val'])),
    adjP:Number(x['adj.P.Val']),
    significant:Number(x['adj.P.Val'])<.05&&Math.abs(Number(x.logFC))>.5,
  }));
}
