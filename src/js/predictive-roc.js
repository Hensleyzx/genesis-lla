import { transformExpressionValue } from './analysis-engine.js';

function finiteValue(v){
  return v !== null && v !== undefined && String(v).trim() !== '' && Number.isFinite(Number(v));
}

function normalizedGenes(genes=[]){
  return [...new Set((genes||[]).map(g=>String(g||'').trim().toUpperCase()).filter(Boolean))];
}

function relapseGroups(dp){
  const clinical = new Map((dp?.clinical?.rows||[]).map(row=>[String(row.PATIENT_ID||''),row]));
  return (dp?.rnaSampleIds||[]).map(sampleId=>{
    const patientId = String(dp?.sampleToPatient?.get?.(sampleId) || '');
    const firstEvent = String(clinical.get(patientId)?.FIRST_EVENT ?? '').trim().toLowerCase();
    if(firstEvent === 'relapse') return 1;
    if(firstEvent === 'none') return 0;
    return -1;
  });
}

function rocFromPairs(labels,scores){
  const rows=[];
  for(let i=0;i<labels.length;i++){
    const y=Number(labels[i]),s=Number(scores[i]);
    if((y===0||y===1)&&Number.isFinite(s)) rows.push({y,s});
  }
  const nPos=rows.filter(r=>r.y===1).length,nNeg=rows.filter(r=>r.y===0).length;
  if(!nPos||!nNeg) return {auc:NaN,points:[],nPos,nNeg,n:nPos+nNeg};
  rows.sort((a,b)=>b.s-a.s);
  let tp=0,fp=0,prevScore=Infinity;
  const points=[{fpr:0,tpr:0,threshold:Infinity}];
  for(let i=0;i<rows.length;){
    const score=rows[i].s;
    let groupPos=0,groupNeg=0;
    while(i<rows.length && rows[i].s===score){
      if(rows[i].y===1) groupPos++; else groupNeg++;
      i++;
    }
    tp+=groupPos;fp+=groupNeg;prevScore=score;
    points.push({fpr:fp/nNeg,tpr:tp/nPos,threshold:prevScore});
  }
  const last=points[points.length-1];
  if(last.fpr!==1||last.tpr!==1) points.push({fpr:1,tpr:1,threshold:-Infinity});
  let auc=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    auc+=(b.fpr-a.fpr)*(a.tpr+b.tpr)/2;
  }
  return {auc,points,nPos,nNeg,n:nPos+nNeg};
}

function aucCI95(auc,nPos,nNeg){
  if(!Number.isFinite(auc)||nPos<2||nNeg<2) return {lower:NaN,upper:NaN,se:NaN};
  const q1=auc/(2-auc),q2=(2*auc*auc)/(1+auc);
  const variance=(auc*(1-auc)+(nPos-1)*(q1-auc*auc)+(nNeg-1)*(q2-auc*auc))/(nPos*nNeg);
  const se=Math.sqrt(Math.max(0,variance));
  return {se,lower:Math.max(0,auc-1.96*se),upper:Math.min(1,auc+1.96*se)};
}

export function aucFromScores(labels,scores,{orient=true}={}){
  const raw=rocFromPairs(labels,scores);
  if(!Number.isFinite(raw.auc)) return {...raw,rawAuc:raw.auc,flipped:false,direction:'indefinida',ci95:aucCI95(raw.auc,raw.nPos,raw.nNeg)};
  let result=raw,flipped=false;
  if(orient && raw.auc<.5){
    result=rocFromPairs(labels,scores.map(v=>Number.isFinite(Number(v))?-Number(v):NaN));
    flipped=true;
  }
  const direction = Math.abs(result.auc-.5)<1e-12 ? 'sem direção discriminatória' : flipped ? 'menor expressão associada ao grupo Relapse' : 'maior expressão associada ao grupo Relapse';
  return {...result,rawAuc:raw.auc,flipped,direction,ci95:aucCI95(result.auc,result.nPos,result.nNeg)};
}

function expressionRows(dp){
  return new Map((dp?.expr||[]).map(row=>[String(row.symbol||'').toUpperCase(),row]));
}

function transformedGeneValues(dp,row){
  const n=dp?.rnaSampleIds?.length||0;
  const values=[];
  for(let i=0;i<n;i++) values.push(transformExpressionValue(row?.values?.[i],dp.pack));
  return values;
}

export function individualRocAnalysis(dp,genes,{minPerGroup=8}={}){
  const selected=normalizedGenes(genes),groups=relapseGroups(dp),expr=expressionRows(dp);
  const results=[],missing=[];
  for(const gene of selected){
    const row=expr.get(gene);
    if(!row){missing.push({gene,reason:'Expressão não carregada para este gene.'});continue;}
    const values=transformedGeneValues(dp,row),labels=[],scores=[];
    for(let i=0;i<groups.length;i++){
      if((groups[i]===0||groups[i]===1)&&Number.isFinite(values[i])){labels.push(groups[i]);scores.push(values[i]);}
    }
    const n1=labels.filter(y=>y===1).length,n0=labels.filter(y=>y===0).length;
    if(n1<minPerGroup||n0<minPerGroup){
      missing.push({gene,reason:`Amostra insuficiente (Relapse n=${n1}; None n=${n0}; mínimo ${minPerGroup} por grupo).`});
      continue;
    }
    const roc=aucFromScores(labels,scores,{orient:true});
    results.push({gene,...roc});
  }
  results.sort((a,b)=>b.auc-a.auc||a.gene.localeCompare(b.gene));
  const groupCounts={relapse:groups.filter(x=>x===1).length,none:groups.filter(x=>x===0).length,unknown:groups.filter(x=>x!==0&&x!==1).length};
  return {available:results.length>0,endpoint:'FIRST_EVENT: Relapse vs None',results,missing,groupCounts,method:'ROC/AUC empírica por expressão gênica basal; direção orientada para AUC ≥ 0,5.',validation:'Exploratória na coorte ativa.'};
}

function combinations(items,size,start=0,prefix=[],out=[]){
  if(prefix.length===size){out.push([...prefix]);return out;}
  for(let i=start;i<=items.length-(size-prefix.length);i++){
    prefix.push(items[i]);combinations(items,size,i+1,prefix,out);prefix.pop();
  }
  return out;
}

function sigmoid(z){
  if(z>=0){const e=Math.exp(-z);return 1/(1+e);}
  const e=Math.exp(z);return e/(1+e);
}

function solveLinear(A,b){
  const n=b.length,M=A.map((row,i)=>[...row,b[i]]);
  for(let col=0;col<n;col++){
    let pivot=col;
    for(let r=col+1;r<n;r++) if(Math.abs(M[r][col])>Math.abs(M[pivot][col])) pivot=r;
    if(Math.abs(M[pivot][col])<1e-10) return null;
    if(pivot!==col){const tmp=M[col];M[col]=M[pivot];M[pivot]=tmp;}
    const div=M[col][col];
    for(let j=col;j<=n;j++) M[col][j]/=div;
    for(let r=0;r<n;r++){
      if(r===col) continue;
      const factor=M[r][col];
      if(!factor) continue;
      for(let j=col;j<=n;j++) M[r][j]-=factor*M[col][j];
    }
  }
  return M.map(row=>row[n]);
}

function fitLogistic(X,y,{lambda=.15,maxIter=80,tol=1e-7}={}){
  if(!X.length) return null;
  const p=(X[0]?.length||0)+1,beta=new Array(p).fill(0);
  for(let iter=0;iter<maxIter;iter++){
    const H=Array.from({length:p},()=>new Array(p).fill(0)),g=new Array(p).fill(0);
    for(let i=0;i<X.length;i++){
      const row=[1,...X[i]],z=row.reduce((s,x,j)=>s+x*beta[j],0),pr=sigmoid(z),w=Math.max(1e-6,pr*(1-pr)),err=y[i]-pr;
      for(let a=0;a<p;a++){
        g[a]+=row[a]*err;
        for(let b=0;b<p;b++) H[a][b]+=row[a]*w*row[b];
      }
    }
    for(let j=1;j<p;j++){H[j][j]+=lambda;g[j]-=lambda*beta[j];}
    H[0][0]+=1e-8;
    const delta=solveLinear(H,g);if(!delta)return null;
    let maxChange=0;
    for(let j=0;j<p;j++){beta[j]+=delta[j];maxChange=Math.max(maxChange,Math.abs(delta[j]));}
    if(maxChange<tol) break;
  }
  return beta;
}

function standardizer(X,indices){
  const p=X[0]?.length||0,means=new Array(p).fill(0),sds=new Array(p).fill(1);
  for(let j=0;j<p;j++){
    let sum=0;for(const i of indices)sum+=X[i][j];means[j]=sum/indices.length;
    let ss=0;for(const i of indices){const d=X[i][j]-means[j];ss+=d*d;}
    const sd=Math.sqrt(ss/Math.max(1,indices.length-1));sds[j]=Number.isFinite(sd)&&sd>1e-9?sd:1;
  }
  return {means,sds};
}

function applyStandardizer(row,scaler){return row.map((x,j)=>(x-scaler.means[j])/scaler.sds[j]);}

function stratifiedFoldIds(y,k){
  const fold=new Array(y.length).fill(-1),pos=[],neg=[];
  y.forEach((v,i)=>(v===1?pos:neg).push(i));
  pos.forEach((idx,i)=>{fold[idx]=i%k;});neg.forEach((idx,i)=>{fold[idx]=i%k;});
  return fold;
}

function crossValidatedLogistic(X,y,{folds=5,lambda=.15}={}){
  const nPos=y.filter(v=>v===1).length,nNeg=y.filter(v=>v===0).length;
  const k=Math.min(folds,nPos,nNeg);
  if(k<3) return null;
  const foldIds=stratifiedFoldIds(y,k),pred=new Array(y.length).fill(NaN);
  for(let f=0;f<k;f++){
    const train=[],test=[];for(let i=0;i<y.length;i++)(foldIds[i]===f?test:train).push(i);
    if(!train.length||!test.length) continue;
    const scaler=standardizer(X,train),trainX=train.map(i=>applyStandardizer(X[i],scaler)),trainY=train.map(i=>y[i]);
    const beta=fitLogistic(trainX,trainY,{lambda});if(!beta)return null;
    for(const i of test){const row=[1,...applyStandardizer(X[i],scaler)],z=row.reduce((s,x,j)=>s+x*beta[j],0);pred[i]=sigmoid(z);}
  }
  const roc=aucFromScores(y,pred,{orient:false});
  return {...roc,folds:k,predictions:pred};
}

function completeCaseMatrix(dp,genes,groups){
  const expr=expressionRows(dp),rows=genes.map(g=>expr.get(g));
  if(rows.some(r=>!r)) return {X:[],y:[],missingGenes:genes.filter((g,i)=>!rows[i])};
  const transformed=rows.map(row=>transformedGeneValues(dp,row)),X=[],y=[];
  for(let i=0;i<groups.length;i++){
    if(groups[i]!==0&&groups[i]!==1) continue;
    const row=transformed.map(values=>values[i]);
    if(row.every(Number.isFinite)){X.push(row);y.push(groups[i]);}
  }
  return {X,y,missingGenes:[]};
}

export function combinationRocAnalysis(dp,genes,{minPerGroup=10,maxGenes=8,maxSize=4,maxCombinations=220,folds=5}={}){
  const selected=normalizedGenes(genes);
  if(selected.length<2) return {available:false,reason:'Selecione pelo menos 2 genes para testar combinações.',results:[],endpoint:'FIRST_EVENT: Relapse vs None'};
  if(selected.length>maxGenes) return {available:false,reason:`Selecione no máximo ${maxGenes} genes por vez para a análise combinatória.`,results:[],endpoint:'FIRST_EVENT: Relapse vs None'};
  const groups=relapseGroups(dp),allCombos=[];
  for(let size=2;size<=Math.min(maxSize,selected.length);size++) combinations(selected,size,0,[],allCombos);
  if(allCombos.length>maxCombinations) return {available:false,reason:`A seleção geraria ${allCombos.length} modelos. Reduza o número de genes para manter a análise interpretável.`,results:[],endpoint:'FIRST_EVENT: Relapse vs None'};
  const results=[],skipped=[];
  for(const combo of allCombos){
    const {X,y,missingGenes}=completeCaseMatrix(dp,combo,groups);
    if(missingGenes.length){skipped.push({genes:combo,reason:`Expressão não carregada: ${missingGenes.join(', ')}`});continue;}
    const n1=y.filter(v=>v===1).length,n0=y.filter(v=>v===0).length;
    if(n1<minPerGroup||n0<minPerGroup){skipped.push({genes:combo,reason:`Amostra insuficiente (Relapse n=${n1}; None n=${n0}).`});continue;}
    const cv=crossValidatedLogistic(X,y,{folds});
    if(!cv||!Number.isFinite(cv.auc)){skipped.push({genes:combo,reason:'Modelo não convergiu ou não produziu AUC válida.'});continue;}
    results.push({genes:combo,label:combo.join(' + '),...cv});
  }
  results.sort((a,b)=>b.auc-a.auc||a.genes.length-b.genes.length||a.label.localeCompare(b.label));
  return {available:results.length>0,reason:results.length?'':(skipped[0]?.reason||'Nenhuma combinação pôde ser avaliada.'),endpoint:'FIRST_EVENT: Relapse vs None',results,skipped,tested:allCombos.length,method:'Regressão logística multivariada com regularização L2 e validação cruzada estratificada.',validation:`AUC calculada em predições fora da amostra (${Math.min(folds,5)}-fold quando os grupos permitem).`,maxGenes,maxSize};
}
