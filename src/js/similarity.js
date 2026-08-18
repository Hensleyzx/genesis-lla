import { median } from './stats.js';
import { kmByGroup } from './survival.js';
import { clinicalAgeYears, clinicalWbcX10e9L, normalizeWbcValue } from './clinical-utils.js';
import { expressionScaleCompatibility } from './expression-scale.js';

function num(v){if(v==null||String(v).trim()==='')return NaN;const x=Number(String(v).replace(',','.'));return Number.isFinite(x)?x:NaN}
function transformExpressionValue(value,pack){const x=Number(value);if(!Number.isFinite(x))return NaN;return pack?.expressionTransform?.key==='log2p1'?Math.log2(Math.max(0,x)+1):x}
function normText(v){return String(v??'').trim().toUpperCase().replace(/\s+/g,' ')}
function sex(v){const s=normText(v);if(/^F/.test(s)||s==='FEMALE')return'F';if(/^M/.test(s)||s==='MALE')return'M';return''}
function subtype(row){return normText(row?.MOLECULAR_SUBTYPE||row?.ANALYSIS_COHORT||row?.CELL_OF_ORIGIN||'')}
function fusionStatus(v){const s=normText(v);if(!s||/UNKNOWN|NOT AVAILABLE|N\/A|NA$/.test(s))return'';if(/POSITIVE|PRESENT|DETECTED|YES|(^|:)1($|:)/.test(s))return'positivo';if(/NEGATIVE|ABSENT|NOT DETECTED|NO|(^|:)0($|:)/.test(s))return'negativo';return''}
function robustScale(values){const xs=values.filter(Number.isFinite);if(xs.length<3)return 1;const med=median(xs);const dev=xs.map(x=>Math.abs(x-med));const mad=median(dev);return Number.isFinite(mad)&&mad>1e-9?1.4826*mad:Math.max(1e-6,(Math.max(...xs)-Math.min(...xs))/4||1)}
function simContinuous(a,b,scale){if(!Number.isFinite(a)||!Number.isFinite(b))return null;const s=Math.max(1e-9,scale);return Math.exp(-Math.abs(a-b)/s)}
function addFeature(parts,label,score,weight){if(score==null||!Number.isFinite(score)||weight<=0)return;parts.push({label,score:Math.max(0,Math.min(1,score)),weight})}
function patientMutationIndex(dp){const byGene={},source=dp?.mut?.basal?.byGene||dp?.mut?.byGene||{};for(const [gene,g] of Object.entries(source)){const set=new Set();for(const sid of g.samples||[]){const pid=String(dp.sampleToPatient?.get(sid)||'');if(pid)set.add(pid)}byGene[String(gene).toUpperCase()]=set;}return byGene}

export function buildMatchedCohort(dp,vectors,dados,expMap){
  if(!dp||!vectors?.patients?.length)return null;
  const clinicalByPatient=new Map((dp.clinical?.rows||[]).map(r=>[String(r.PATIENT_ID),r]));
  const mutationByGene=patientMutationIndex(dp);
  const mutationProfiled=new Set((dp.pack?.mutationSelection?.patientIds||[]).map(String));
  const caseSubtype=normText(dados.subtipoMolecular||'');
  const caseAge=num(dados.idade),caseWbc=normalizeWbcValue(dados.leucocitos,dados.unidadeLeucocitos),caseSex=sex(dados.sexo),caseFusion=String(dados.fusoes?.['BCR-ABL1']||'nao_informado');
  const wbcUnit=dp?.pack?.clinicalUnits?.wbc||{key:'unknown'};
  const exprCompatibility=expressionScaleCompatibility(dados.escalaExpressao,dp?.pack||{});
  const exprFeatures=[];
  for(const gene of dados.biomarcadores||[]){
    const raw=num(dados.expressao?.[gene]);const row=expMap?.get(String(gene).toUpperCase());
    if(!exprCompatibility.compatible||!Number.isFinite(raw)||!row)continue;
    const vals=vectors.sampleIndices.map(i=>Number.isInteger(i)?transformExpressionValue(row.values?.[i],dp.pack):NaN);
    const finite=vals.filter(Number.isFinite);if(finite.length<8)continue;
    exprFeatures.push({gene:String(gene).toUpperCase(),caseValue:transformExpressionValue(raw,dp.pack),values:vals,scale:robustScale(finite)});
  }
  const alterationFeatures=Object.entries(dados.mutacoesSomaticas||dados.alteracoes||{}).filter(([,v])=>v==='presente'||v==='ausente').map(([g,v])=>({gene:String(g).toUpperCase(),status:v}));
  const criteria=[];
  if(Number.isFinite(caseAge))criteria.push('idade');
  if(Number.isFinite(caseWbc)&&wbcUnit?.key&&wbcUnit.key!=='unknown')criteria.push('leucócitos (×10⁹/L padronizado)');
  if(caseSex)criteria.push('sexo');
  if(caseSubtype)criteria.push('subtipo molecular');
  if(caseFusion==='positivo'||caseFusion==='negativo')criteria.push('BCR-ABL1');
  if(alterationFeatures.length)criteria.push(`${alterationFeatures.length} mutação(ões) somática(s)`);
  if(exprFeatures.length)criteria.push(`${exprFeatures.length} medida(s) de expressão`);
  if(criteria.length<2)return {available:false,reason:'Informe pelo menos dois critérios comparáveis (por exemplo idade + mutação somática, subtipo + expressão, ou múltiplas mutações somáticas) para formar uma coorte semelhante.',criteria};

  const rows=[];
  for(let i=0;i<vectors.patients.length;i++){
    const patientId=String(vectors.patients[i]||'');const clinical=clinicalByPatient.get(patientId)||vectors.clinicalRows?.[i]||{};const parts=[];
    const a=clinicalAgeYears(clinical);if(Number.isFinite(caseAge)&&Number.isFinite(a))addFeature(parts,'idade',simContinuous(caseAge,a,5),1.5);
    const cw=clinicalWbcX10e9L(clinical,wbcUnit);if(Number.isFinite(caseWbc)&&Number.isFinite(cw))addFeature(parts,'leucócitos',simContinuous(Math.log1p(caseWbc),Math.log1p(cw),0.8),1.5);
    const cs=sex(clinical.SEX||clinical.GENDER);if(caseSex&&cs)addFeature(parts,'sexo',caseSex===cs?1:0,0.5);
    const st=subtype(clinical);if(caseSubtype&&st){const exact=caseSubtype===st;const partial=!exact&&(caseSubtype.includes(st)||st.includes(caseSubtype));addFeature(parts,'subtipo molecular',exact?1:partial?.7:0,3);}
    if(caseFusion==='positivo'||caseFusion==='negativo'){const fs=fusionStatus(clinical.BCR_ABL1_STATUS);if(fs)addFeature(parts,'BCR-ABL1',fs===caseFusion?1:0,4);}
    for(const f of alterationFeatures){if(!mutationProfiled.has(patientId))continue;const present=mutationByGene[f.gene]?.has(patientId)||false;const same=(f.status==='presente')===present;addFeature(parts,`mutação ${f.gene}`,same?1:0,4);}
    for(const f of exprFeatures){const v=f.values[i];if(Number.isFinite(v))addFeature(parts,`expressão ${f.gene}`,simContinuous(f.caseValue,v,1.5*f.scale),2);}
    // Um candidato precisa ser comparável em pelo menos dois critérios do caso;
    // caso contrário, uma única variável disponível poderia dominar artificialmente o pareamento.
    if(parts.length<2)continue;
    const weight=parts.reduce((s,p)=>s+p.weight,0);if(weight<=0)continue;const score=100*parts.reduce((s,p)=>s+p.score*p.weight,0)/weight;
    rows.push({index:i,patientId,score,weight,parts,time:vectors.time[i],event:vectors.event[i]});
  }
  if(rows.length<20)return {available:false,reason:'Menos de 20 pacientes possuem pelo menos dois critérios comparáveis e dados de OS válidos nesta coorte.',criteria,nCandidates:rows.length};
  rows.sort((a,b)=>b.score-a.score);
  const target=Math.max(12,Math.min(60,Math.round(rows.length*.2)));
  const selected=rows.slice(0,target);
  const medianSimilarity=median(selected.map(x=>x.score));
  const selectedSet=new Set(selected.map(x=>x.index));
  const group=vectors.time.map((_,i)=>selectedSet.has(i)?'Perfis semelhantes':'Demais pacientes');
  const km=kmByGroup(vectors.time,vectors.event,group);
  const matched=km.find(x=>x.name==='Perfis semelhantes');
  const rest=km.find(x=>x.name==='Demais pacientes');
  const events=selected.reduce((s,x)=>s+(x.event?1:0),0);
  if(events<5)return {available:false,reason:'O grupo de perfis semelhantes teve menos de 5 eventos de OS; a curva comparativa foi bloqueada para evitar interpretação instável.',criteria,nCandidates:rows.length,nMatched:selected.length,nEvents:events,medianSimilarity};
  const strength=selected.length>=30&&events>=10&&medianSimilarity>=70?'Alta':selected.length>=15&&events>=5&&medianSimilarity>=55?'Moderada':'Limitada';
  return {
    available:true,
    criteria,
    nCandidates:rows.length,
    nMatched:selected.length,
    nEvents:events,
    medianSimilarity,
    strength,
    groups:[matched,rest].filter(Boolean).map(g=>({name:g.name,n:g.n,nEvents:g.nEvents,points:g.times.map((x,j)=>({x,y:g.surv[j]}))})),
    note:'Pareamento heurístico de pesquisa baseado apenas em variáveis informadas e disponíveis na coorte. Não é modelo clínico validado nem probabilidade individual.'
  };
}
