import assert from 'node:assert/strict';
import { logRank, analyzeSurvival } from '../src/js/survival.js';
import { univariate } from '../src/js/cox.js';

let seed=0x5eed1234;
function rnd(){seed=(1664525*seed+1013904223)>>>0;return seed/2**32;}
function normal(){const u=Math.max(1e-12,rnd()),v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}

for(let rep=0;rep<250;rep++){
  const n=20+Math.floor(rnd()*100);
  const time=[],event=[],group=[],expr=[];
  for(let i=0;i<n;i++){
    // Tempos discretizados de propósito para criar empates e censura.
    time.push(1+Math.floor(rnd()*60));
    event.push(rnd()<0.36?1:0);
    group.push(i%2?'B':'A');
    expr.push(normal()+0.15*(i%2));
  }
  if(event.reduce((a,b)=>a+b,0)<5){for(let i=0;i<5;i++)event[i]=1;}

  const lr=logRank(time,event,group);
  assert.ok(Number.isFinite(lr.chi2) && lr.chi2>=-1e-10,`log-rank chi2 inválido no rep ${rep}`);
  assert.ok(Number.isFinite(lr.p) && lr.p>=0 && lr.p<=1,`log-rank p inválido no rep ${rep}`);
  assert.equal(lr.O.length,2);
  assert.equal(lr.E.length,2);

  const km=analyzeSurvival(time,event,expr);
  if(km){
    assert.ok(km.nAlto>=5 && km.nBaixo>=5);
    assert.ok(km.logRank.p>=0 && km.logRank.p<=1);
    for(const g of km.km){
      assert.equal(g.times.length,g.surv.length);
      for(let i=1;i<g.surv.length;i++)assert.ok(g.surv[i]<=g.surv[i-1]+1e-12,'KM não pode aumentar');
      g.surv.forEach(x=>assert.ok(x>=-1e-12&&x<=1+1e-12));
    }
  }

  const c=univariate(time,event,['G'],{G:{values:expr}});
  if(c.length){
    const r=c[0];
    assert.ok(Number.isFinite(r.HR)&&r.HR>0);
    assert.ok(Number.isFinite(r.HR_lower)&&r.HR_lower>0);
    assert.ok(Number.isFinite(r.HR_upper)&&r.HR_upper>=r.HR_lower);
    assert.ok(Number.isFinite(r.p_value)&&r.p_value>=0&&r.p_value<=1);
    assert.ok(r.n>=20&&r.nEvents>=5&&r.converged);
  }
}
console.log('GENESIS V10.5 fuzz/invariant tests: OK (250 coortes sintéticas)');
