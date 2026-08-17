import * as st from './stats.js';

function bisection(func,lo,hi,maxIter=80,tol=1e-6){let fLo=func(lo);for(let it=0;it<maxIter;it++){const mid=(lo+hi)/2,fMid=func(mid);if(Math.abs(fMid)<tol||(hi-lo)/2<tol)return mid;if(fLo*fMid<0)hi=mid;else{lo=mid;fLo=fMid}}return(lo+hi)/2}
function estimatePriorDF(variances,df){if(variances.length<3||df<=0)return 0;const logs=variances.map(Math.log),m=st.mean(logs);let v=0;for(const x of logs)v+=(x-m)**2;v/=Math.max(1,logs.length-1);const target=v-st.trigamma(df/2);if(target<=1e-6)return 100000;const f=d0=>st.trigamma(d0/2)-target;return bisection(f,.001,5000)}

export function runDEA(rows,groups,{transform='log2p1'}={}){
  let n0=0,n1=0;for(const g of groups){if(g===0)n0++;else if(g===1)n1++;}
  const df=n0+n1-2;if(n0<3||n1<3||df<=1)return{table:[],n0,n1,df,nDEG:0,warning:'Grupos insuficientes para DEA.'};
  const raw=[];
  for(const row of rows){const vals=row.values||[];let m0=0,c0=0,m1=0,c1=0,mAll=0,cAll=0;for(let i=0;i<vals.length;i++){if(groups[i]!==0&&groups[i]!==1)continue;let x=Number(vals[i]);if(!Number.isFinite(x))continue;if(transform==='log2p1')x=Math.log2(Math.max(0,x)+1);mAll+=x;cAll++;if(groups[i]===1){m1+=x;c1++;}else{m0+=x;c0++;}}if(c0<2||c1<2)continue;const mean0=m0/c0,mean1=m1/c1;let ss0=0,ss1=0;for(let i=0;i<vals.length;i++){if(groups[i]!==0&&groups[i]!==1)continue;let x=Number(vals[i]);if(!Number.isFinite(x))continue;if(transform==='log2p1')x=Math.log2(Math.max(0,x)+1);const d=x-(groups[i]===1?mean1:mean0);if(groups[i]===1)ss1+=d*d;else ss0+=d*d;}const localDf=c0+c1-2,s2=(ss0+ss1)/Math.max(1,localDf);if(!Number.isFinite(s2)||s2<=0)continue;raw.push({gene:row.symbol||row.gene,entrez:row.entrez,logFC:mean1-mean0,AveExpr:mAll/cAll,s2,varMean:1/c0+1/c1,df:localDf});}
  if(!raw.length)return{table:[],n0,n1,df,nDEG:0};
  const s2s=raw.map(r=>r.s2),s02=st.mean(s2s),d0=estimatePriorDF(s2s,df),pvals=[];
  for(const r of raw){const dfPost=r.df+d0,s2Post=(d0*s02+r.df*r.s2)/(d0+r.df),se=Math.sqrt(s2Post*r.varMean),t=se>0?r.logFC/se:0;r.t=t;r['P.Value']=st.twoSidedTP(t,dfPost);pvals.push(r['P.Value']);}
  const q=st.bhFdr(pvals);raw.forEach((r,i)=>{r['adj.P.Val']=q[i];const a=q[i],l=r.logFC;r.signif=(a<.01&&Math.abs(l)>1)?(l>0?'Up — Alta':'Down — Alta'):(a<.05&&Math.abs(l)>.5)?(l>0?'Up — Moderada':'Down — Moderada'):'NS';r.color_grp=r.signif==='NS'?'NS':r.signif.startsWith('Up')?'Upregulado':'Downregulado';});
  raw.sort((a,b)=>a['adj.P.Val']-b['adj.P.Val']);
  return{table:raw,n0,n1,df,priorDF:d0,priorVar:s02,nDEG:raw.filter(r=>r.signif!=='NS').length,transform};
}
