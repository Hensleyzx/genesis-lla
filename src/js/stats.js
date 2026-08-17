export function mean(a){let s=0,c=0;for(const x of a)if(Number.isFinite(x)){s+=x;c++}return c?s/c:NaN}
export function variance(a,ddof=1){const m=mean(a);let s=0,c=0;for(const x of a)if(Number.isFinite(x)){s+=(x-m)**2;c++}return c-ddof>0?s/(c-ddof):0}
export function sd(a){return Math.sqrt(variance(a,1))}
export function sum(a){let s=0;for(const x of a)if(Number.isFinite(x))s+=x;return s}
export function median(a){const b=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!b.length)return NaN;const n=b.length;return n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2}
export function quantile(a,q){const b=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!b.length)return NaN;const pos=(b.length-1)*q,base=Math.floor(pos),rest=pos-base;return b[base+1]!==undefined?b[base]+rest*(b[base+1]-b[base]):b[base]}
export function scale(a){const m=mean(a),s=sd(a);if(!Number.isFinite(s)||s===0)return a.map(()=>0);return a.map(x=>(x-m)/s)}
export function percentileRank(a,value){const b=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!b.length||!Number.isFinite(value))return NaN;let below=0,equal=0;for(const x of b){if(x<value)below++;else if(x===value)equal++;}return 100*(below+0.5*equal)/b.length}

const L=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
export function lgamma(z){if(z<.5)return Math.log(Math.PI/Math.sin(Math.PI*z))-lgamma(1-z);z-=1;let a=L[0];for(let i=1;i<9;i++)a+=L[i]/(z+i);const t=z+7.5;return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(a)}
function betacf(a,b,x){const MAX=300,EPS=3e-14,FPMIN=1e-300,qab=a+b,qap=a+1,qam=a-1;let c=1,d=1-qab*x/qap;if(Math.abs(d)<FPMIN)d=FPMIN;d=1/d;let h=d;for(let m=1;m<=MAX;m++){const m2=2*m;let aa=m*(b-m)*x/((qam+m2)*(a+m2));d=1+aa*d;if(Math.abs(d)<FPMIN)d=FPMIN;c=1+aa/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;h*=d*c;aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<FPMIN)d=FPMIN;c=1+aa/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<EPS)break}return h}
export function betai(a,b,x){if(x<=0)return 0;if(x>=1)return 1;const bt=Math.exp(lgamma(a+b)-lgamma(a)-lgamma(b)+a*Math.log(x)+b*Math.log(1-x));return x<(a+1)/(a+b+2)?bt*betacf(a,b,x)/a:1-bt*betacf(b,a,1-x)/b}
function gser(a,x){const IT=400,EPS=3e-14;let ap=a,sumv=1/a,del=sumv;for(let n=1;n<=IT;n++){ap++;del*=x/ap;sumv+=del;if(Math.abs(del)<Math.abs(sumv)*EPS)break}return sumv*Math.exp(-x+a*Math.log(x)-lgamma(a))}
function gcf(a,x){const IT=400,EPS=3e-14,FPMIN=1e-300;let b=x+1-a,c=1/FPMIN,d=1/b,h=d;for(let i=1;i<=IT;i++){const an=-i*(i-a);b+=2;d=an*d+b;if(Math.abs(d)<FPMIN)d=FPMIN;c=b+an/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<EPS)break}return Math.exp(-x+a*Math.log(x)-lgamma(a))*h}
export function gammp(a,x){if(x<0)return NaN;if(x===0)return 0;return x<a+1?gser(a,x):1-gcf(a,x)}
export function chi2P(x,df){return 1-gammp(df/2,x/2)}
function erf(x){const sign=x<0?-1:1,ax=Math.abs(x),t=1/(1+.3275911*ax);const y=1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t)*Math.exp(-ax*ax);return sign*y}
export function normalCDF(x){return .5*(1+erf(x/Math.SQRT2))}
export function normalP2(z){return Number.isFinite(z)?chi2P(z*z,1):NaN}
export function tCDF(t,df){const x=df/(df+t*t);return t>=0?1-.5*betai(df/2,.5,x):.5*betai(df/2,.5,x)}
export function twoSidedTP(t,df){return 2*(1-tCDF(Math.abs(t),df))}
export function trigamma(x){let v=0,z=x;while(z<7){v+=1/(z*z);z+=1}const z2=z*z;return v+1/z+1/(2*z2)+1/(6*z2*z)-1/(30*z2*z2*z)+1/(42*z2*z2*z2*z)-1/(30*z2*z2*z2*z2*z)}
export function bhFdr(pvals){const n=pvals.length;if(!n)return[];const safe=pvals.map(p=>Number.isFinite(p)?Math.max(0,Math.min(1,p)):1);const order=safe.map((p,i)=>i).sort((a,b)=>safe[a]-safe[b]);const q=new Array(n);let prev=1;for(let k=n;k>=1;k--){const i=order[k-1],val=Math.min(1,safe[i]*n/k);prev=Math.min(prev,val);q[i]=prev}return q}
export function fmtP(p){if(!Number.isFinite(p))return'p = NA';if(p<.0001)return'p < 0,0001';return`p = ${Number(p.toPrecision(3)).toLocaleString('pt-BR')}`}
