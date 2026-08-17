import { median, chi2P } from './stats.js';

export function kmByGroup(time,event,group){
  const labels=[...new Set(group)].sort();
  const per=Object.fromEntries(labels.map(l=>[l,{
    name:l,n:0,times:[0],surv:[1],nRisk:[0],ciLo:[1],ciHi:[1],
    nEvents:0,nCensor:0,obs:[],censorTimes:[],censorSurv:[]
  }]));
  for(let i=0;i<time.length;i++){
    if(!Number.isFinite(time[i]))continue;
    const g=per[group[i]]; if(!g)continue;
    g.obs.push({t:time[i],e:event[i]?1:0}); g.n++;
  }
  for(const l of labels){
    const g=per[l],obs=g.obs.slice().sort((a,b)=>a.t-b.t);
    let nRisk=obs.length,s=1,greenwood=0,i=0;
    g.nRisk=[nRisk];
    while(i<obs.length){
      const t=obs[i].t; let d=0,c=0;
      while(i<obs.length&&obs[i].t===t){obs[i].e?d++:c++;i++}
      if(d>0){
        s*=1-d/nRisk;
        g.nEvents+=d;
        if(nRisk>d) greenwood+=d/(nRisk*(nRisk-d));
      }
      if(c>0){
        g.nCensor+=c;
        for(let k=0;k<c;k++){g.censorTimes.push(t);g.censorSurv.push(s);}
      }
      nRisk-=d+c;
      g.times.push(t); g.surv.push(s); g.nRisk.push(nRisk);
      let lo=s,hi=s;
      // IC log-log como em survfit(): se(log(-log(S))) = sqrt(Greenwood)/|log(S)|
      if(s>0&&s<1&&greenwood>0){
        const seLogLog=Math.sqrt(greenwood)/Math.abs(Math.log(s));
        const z=1.959963984540054;
        lo=Math.max(0,Math.exp(-Math.exp(Math.log(-Math.log(s))+z*seLogLog)));
        hi=Math.min(1,Math.exp(-Math.exp(Math.log(-Math.log(s))-z*seLogLog)));
      }
      g.ciLo.push(lo); g.ciHi.push(hi);
    }
  }
  return labels.map(l=>per[l]);
}

// Log-rank clássico. Para 2 grupos usa (O1-E1)^2 / V11.
// Para >2 grupos usa a matriz de covariância (k-1)x(k-1), evitando
// o erro de somar variâncias marginais como se fossem independentes.
export function logRank(time,event,group){
  const labels=[...new Set(group)].sort();
  const k=labels.length;
  if(k<2)return{chi2:0,df:0,p:1,labels,O:[0],E:[0]};
  const idx=group.map(g=>labels.indexOf(g));
  const valid=time.map((_,i)=>i).filter(i=>Number.isFinite(time[i])&&Number.isFinite(event[i])&&idx[i]>=0).sort((a,b)=>time[a]-time[b]);
  const O=new Array(k).fill(0),E=new Array(k).fill(0);
  const V=Array.from({length:k},()=>new Array(k).fill(0));
  let pos=0;
  while(pos<valid.length){
    const tt=time[valid[pos]];
    let end=pos;
    const dBy=new Array(k).fill(0);
    let d=0;
    while(end<valid.length&&time[valid[end]]===tt){
      const i=valid[end];
      if(event[i]){d++;dBy[idx[i]]++;}
      end++;
    }
    const riskIdx=valid.slice(pos);
    const n=riskIdx.length;
    if(d>0&&n>1){
      const nBy=new Array(k).fill(0);
      for(const i of riskIdx)nBy[idx[i]]++;
      for(let a=0;a<k;a++){
        O[a]+=dBy[a];
        E[a]+=d*nBy[a]/n;
        for(let b=0;b<k;b++){
          const factor=d*(n-d)/(n-1);
          if(a===b) V[a][b]+=factor*(nBy[a]/n)*(1-nBy[a]/n);
          else V[a][b]+=-factor*(nBy[a]/n)*(nBy[b]/n);
        }
      }
    }
    pos=end;
  }

  const m=k-1;
  const diff=O.slice(0,m).map((o,i)=>o-E[i]);
  const A=V.slice(0,m).map(r=>r.slice(0,m));
  const inv=invert(A);
  let chi2=0;
  if(inv){
    for(let i=0;i<m;i++)for(let j=0;j<m;j++)chi2+=diff[i]*inv[i][j]*diff[j];
  }
  const df=m;
  return{chi2,df,p:df>0?chi2P(chi2,df):1,labels,O,E,V};
}

function invert(a){
  const n=a.length;if(!n)return null;
  const aug=a.map((r,i)=>r.slice().concat(Array.from({length:n},(_,j)=>i===j?1:0)));
  for(let c=0;c<n;c++){
    let p=c;
    for(let r=c+1;r<n;r++)if(Math.abs(aug[r][c])>Math.abs(aug[p][c]))p=r;
    if(Math.abs(aug[p][c])<1e-12)return null;
    [aug[c],aug[p]]=[aug[p],aug[c]];
    const d=aug[c][c];
    for(let j=0;j<2*n;j++)aug[c][j]/=d;
    for(let r=0;r<n;r++)if(r!==c){
      const f=aug[r][c];
      for(let j=0;j<2*n;j++)aug[r][j]-=f*aug[c][j];
    }
  }
  return aug.map(r=>r.slice(n));
}

export function atRiskAt(groupResult,times){
  const obs=groupResult?.obs||[];
  return times.map(t=>obs.reduce((n,o)=>n+(o.t>=t?1:0),0));
}

export function analyzeSurvival(time,event,expr,medianCut,options={}){
  const {minN=20,minEvents=5,minGroup=5}=options;
  const t=[],e=[],x=[];
  for(let i=0;i<time.length;i++){
    if(!Number.isFinite(time[i])||time[i]<=0||!Number.isFinite(expr[i]))continue;
    if(!Number.isFinite(event[i]))continue;
    t.push(time[i]);e.push(event[i]?1:0);x.push(expr[i]);
  }
  const events=e.reduce((a,b)=>a+b,0);
  if(x.length<minN||events<minEvents)return null;
  const cut=medianCut??median(x);
  const groups=x.map(v=>v>=cut?'Alto':'Baixo');
  if(new Set(groups).size<2)return null;
  const nAlto=groups.filter(g=>g==='Alto').length;
  const nBaixo=groups.filter(g=>g==='Baixo').length;
  // Mesma proteção do Script.R: não produz KM/log-rank com grupo muito pequeno.
  if(Math.min(nAlto,nBaixo)<minGroup)return null;
  return{
    km:kmByGroup(t,e,groups),
    logRank:logRank(t,e,groups),
    medianCut:cut,
    nAlto,nBaixo,
    n:t.length,
    events
  };
}
