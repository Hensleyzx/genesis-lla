import { cbio, chooseSampleList, DEFAULT_LLA_STUDY, expressionTransformForProfile, isLlaStudy } from './cbio-api.js';
import * as ST from './storage.js';
import { GENE_IDS } from './data.js';

const DATA_VERSION = 9;
const CLINICAL_CANDIDATES = [
  'PATIENT_ID','OS_MONTHS','OS_DAYS','OS_STATUS','VITAL_STATUS','DFS_MONTHS','EFS_MONTHS','DFS_STATUS','EFS_STATUS','DAYS_TO_EVENT','DAYS_TO_DEATH',
  'FIRST_EVENT','AGE','AGE_IN_DAYS','GENDER','SEX','WBC','MOLECULAR_SUBTYPE','ANALYSIS_COHORT','MRD_PERCENT_DAY_29',
  'BCR_ABL1_STATUS','ETV6_RUNX1_FUSION_STATUS','MLL_STATUS','TCF3_PBX1_STATUS','TRISOMY_4_10','CELL_OF_ORIGIN','CANCER_TYPE','CANCER_TYPE_DETAILED'
];

function pivotClinical(records){const attrs=[],rows=new Map();for(const item of records){if(!rows.has(item.patientId))rows.set(item.patientId,{PATIENT_ID:item.patientId});rows.get(item.patientId)[item.clinicalAttributeId]=item.value;if(!attrs.includes(item.clinicalAttributeId))attrs.push(item.clinicalAttributeId);}return{attributes:attrs,rows:[...rows.values()]};}
function patientIdOfSample(sample){if(sample?.patientId)return String(sample.patientId);return String(sample?.sampleId||'').replace(/\.\d+$/,'').replace(/-[0-9A-Za-z]+$/,'');}
function sampleTypeCode(sampleId){const m=String(sampleId||'').match(/-([0-9]{2})(?:[A-Z])?(?:\.\d+)?$/i);return m?m[1]:null;}

export function selectAnalysisSamples(samples,rnaSampleIds){const byId=new Map(samples.map(s=>[s.sampleId,s])),byPatient=new Map();for(const sid of rnaSampleIds){const s=byId.get(sid)||{sampleId:sid,patientId:null},pid=patientIdOfSample(s);if(!pid)continue;if(!byPatient.has(pid))byPatient.set(pid,[]);byPatient.get(pid).push(sid);}const selected=[],excluded={xenograft:0,recurrent:0,normal:0,duplicate:0},targetLike=rnaSampleIds.some(id=>String(id).startsWith('TARGET-'));
  for(const [pid,ids] of byPatient){let candidates=[...ids];if(targetLike){const scored=candidates.map(id=>({id,code:sampleTypeCode(id)}));const prim=scored.filter(x=>['09','03'].includes(x.code));if(prim.length){prim.sort((a,b)=>(a.code==='09'?0:1)-(b.code==='09'?0:1));selected.push(prim[0].id);excluded.duplicate+=Math.max(0,ids.length-1);for(const x of scored){if(['60','61'].includes(x.code))excluded.xenograft++;else if(['04','40'].includes(x.code))excluded.recurrent++;else if(['10','11','14'].includes(x.code))excluded.normal++;}continue;}candidates=scored.filter(x=>!['60','61','04','40','10','11','14'].includes(x.code)).map(x=>x.id);}
    if(candidates.length){selected.push(candidates[0]);excluded.duplicate+=Math.max(0,ids.length-1);} }
  return{sampleIds:selected,patientIds:[...new Set(selected.map(id=>patientIdOfSample(byId.get(id)||{sampleId:id})))],method:targetLike?'Uma amostra basal por paciente; prioridade medula óssea (09), depois sangue periférico (03); recaída/xeno/normal excluídos.':'Uma amostra de expressão por paciente; duplicatas removidas.',excluded,targetLike};}

async function loadGeneMap(onProgress){const cached=await ST.get('genes','map');if(cached)return cached;const list=await cbio.getGenes(onProgress);const map={sym2entrez:{},entrez2sym:{}};for(const gene of list){if(!gene.hugoGeneSymbol)continue;map.sym2entrez[String(gene.hugoGeneSymbol).toUpperCase()]=gene.entrezGeneId;map.entrez2sym[gene.entrezGeneId]=String(gene.hugoGeneSymbol).toUpperCase();}await ST.set('genes','map',map);return map;}
export function aggregateMutations(raw,geneMap,totalSamples){const byGene={};for(const m of raw){const sym=String(m.gene?.hugoGeneSymbol||geneMap.entrez2sym[m.entrezGeneId]||m.entrezGeneId||'').toUpperCase();if(!sym)continue;if(!byGene[sym])byGene[sym]={symbol:sym,entrez:m.entrezGeneId,count:0,samples:[],proteinChanges:{}};const g=byGene[sym];if(!g.samples.includes(m.sampleId)){g.samples.push(m.sampleId);g.count++;}const change=m.proteinChange||m.mutationType||'Não informado';g.proteinChanges[change]=(g.proteinChanges[change]||0)+1;}for(const g of Object.values(byGene))g.frequency=totalSamples?100*g.count/totalSamples:0;return{byGene,totalSamples};}
function buildExpressionRows(raw,genes,sampleIds){const index=new Map(sampleIds.map((id,i)=>[id,i])),byEntrez=new Map();for(const row of raw){if(!byEntrez.has(row.entrezGeneId)){const a=new Float32Array(sampleIds.length);a.fill(NaN);byEntrez.set(row.entrezGeneId,a);}const i=index.get(row.sampleId),v=row.value==null?NaN:Number(row.value);if(i!=null)byEntrez.get(row.entrezGeneId)[i]=Number.isFinite(v)?v:NaN;}return genes.map(g=>({symbol:g.symbol,entrez:g.entrez,values:byEntrez.get(g.entrez)})).filter(g=>g.values);}
function subsetExpressionRows(rows,fullSampleIds,selectedSampleIds){const idx=new Map(fullSampleIds.map((id,i)=>[id,i]));return rows.map(g=>{const a=new Float32Array(selectedSampleIds.length);a.fill(NaN);for(let j=0;j<selectedSampleIds.length;j++){const i=idx.get(selectedSampleIds[j]);if(i!=null)a[j]=g.values[i];}return{symbol:g.symbol,entrez:g.entrez,values:a};});}

export async function buildDatapack({studyId=DEFAULT_LLA_STUDY,scope='expresso',onProgress=()=>{}}={}){
  onProgress({pct:1,phase:'connect',msg:'Conectando ao cBioPortal…'});
  const [study,samples,lists,attrs,resolved]=await Promise.all([cbio.getStudy(studyId),cbio.getSamples(studyId),cbio.getSampleLists(studyId),cbio.getClinicalAttributes(studyId),cbio.resolveProfiles(studyId)]);
  if(!isLlaStudy(study))throw new Error('O GENESIS V10.7 aceita apenas estudos de Leucemia Linfoblástica/Linfoide Aguda (LLA/ALL).');
  const sampleToPatient=new Map(samples.map(s=>[s.sampleId,patientIdOfSample(s)]));
  const rnaList=chooseSampleList(lists,'rna'),mutList=chooseSampleList(lists,'mutation');
  let rnaSampleIds=resolved.expression?(rnaList?await cbio.getSampleListIds(rnaList.sampleListId):samples.map(s=>s.sampleId)):[];
  let mutSampleIds=resolved.mutation?(mutList?await cbio.getSampleListIds(mutList.sampleListId):samples.map(s=>s.sampleId)):[];
  rnaSampleIds=rnaSampleIds.filter(id=>sampleToPatient.has(id));mutSampleIds=mutSampleIds.filter(id=>sampleToPatient.has(id));
  const analysisSelection=selectAnalysisSamples(samples,rnaSampleIds);
  // Dois universos são preservados de propósito:
  // 1) BASAL: uma amostra primária por paciente (análises clínicas exploratórias).
  // 2) R-COMPATÍVEL: todas as amostras do case list de expressão, como no Script.R
  //    do projeto, que alinha sample_id -> patient_id antes de KM/Cox.
  const mutationSelection=selectAnalysisSamples(samples,mutSampleIds);
  const analysisSampleIds=analysisSelection.sampleIds;
  const rExpressionSampleIds=[...rnaSampleIds];
  const rExpressionPatientIds=[...new Set(rExpressionSampleIds.map(id=>patientIdOfSample(sampleToPatient.has(id)?{sampleId:id,patientId:sampleToPatient.get(id)}:{sampleId:id})).filter(Boolean))];
  const analysisMutationSampleIds=mutationSelection.sampleIds;
  const mutationProfileSampleIds=[...mutSampleIds];
  const patients=analysisSelection.patientIds.length?analysisSelection.patientIds:[...new Set(samples.map(patientIdOfSample).filter(Boolean))];
  const analysisPatientIds=[...patients];
  const clinicalPatientIds=[...new Set([...patients,...rExpressionPatientIds])];
  onProgress({pct:8,phase:'samples',msg:`${patients.length} pacientes basais · ${rExpressionSampleIds.length} amostras de expressão no modo compatível com R`});

  const availableAttrs=new Set(attrs.map(a=>a.clinicalAttributeId)),clinicalAttrs=CLINICAL_CANDIDATES.filter(id=>availableAttrs.has(id));
  onProgress({pct:12,phase:'clinical',msg:'Baixando dados clínicos…'});
  const clinicalRaw=clinicalAttrs.length&&clinicalPatientIds.length?await cbio.fetchClinical(studyId,clinicalAttrs,clinicalPatientIds,(done,total)=>onProgress({pct:12+Math.round(8*done/total),phase:'clinical',msg:`Dados clínicos ${done}/${total}`})):[];
  const clinical=pivotClinical(clinicalRaw);

  onProgress({pct:22,phase:'genes',msg:'Carregando mapa de genes humanos…'});
  const geneMap=await loadGeneMap(n=>onProgress({pct:22,phase:'genes',msg:`${n.toLocaleString('pt-BR')} genes indexados`}));

  let mutations={byGene:{},totalSamples:mutationProfileSampleIds.length,denominatorMode:'PROFILED_MUTATION_CASE_LIST',basal:{byGene:{},totalSamples:analysisMutationSampleIds.length}};
  if(resolved.mutation&&mutationProfileSampleIds.length){
    onProgress({pct:28,phase:'mutations',msg:`Baixando mutações das ${mutationProfileSampleIds.length} amostras perfiladas…`});
    const rawMut=await cbio.fetchMutations(
      resolved.mutation.molecularProfileId,
      mutationProfileSampleIds,
      (done,total)=>onProgress({pct:28+Math.round(10*done/total),phase:'mutations',msg:`Mutações ${done}/${total}`})
    );
    mutations=aggregateMutations(rawMut,geneMap,mutationProfileSampleIds.length);
    mutations.denominatorMode='PROFILED_MUTATION_CASE_LIST';
    const basalSet=new Set(analysisMutationSampleIds);
    mutations.basal=aggregateMutations(rawMut.filter(m=>basalSet.has(m.sampleId)),geneMap,analysisMutationSampleIds.length);
  }

  let genes=[];if(resolved.expression){if(scope==='completo'){genes=Object.entries(geneMap.sym2entrez).map(([symbol,entrez])=>({symbol,entrez}));}else{const curated=GENE_IDS.map(symbol=>geneMap.sym2entrez[symbol]?({symbol,entrez:geneMap.sym2entrez[symbol]}):null).filter(Boolean);const topMutated=Object.values(mutations.byGene).sort((a,b)=>b.count-a.count).slice(0,500).map(g=>({symbol:g.symbol,entrez:g.entrez||geneMap.sym2entrez[g.symbol]})).filter(g=>g.entrez);const seen=new Set();genes=[...curated,...topMutated].filter(g=>{if(seen.has(g.symbol))return false;seen.add(g.symbol);return true;});}}

  let expr=[],exprR=[];
  if(resolved.expression&&rExpressionSampleIds.length&&genes.length){
    onProgress({pct:40,phase:'expression',msg:`Baixando expressão de ${genes.length.toLocaleString('pt-BR')} genes em ${rExpressionSampleIds.length} amostras do perfil…`});
    const rawExpr=await cbio.fetchMolecularData(resolved.expression.molecularProfileId,rExpressionSampleIds,genes.map(g=>g.entrez),(done,total)=>onProgress({pct:40+Math.round(55*done/total),phase:'expression',msg:`Expressão ${done}/${total} blocos`}));
    exprR=buildExpressionRows(rawExpr,genes,rExpressionSampleIds);
    expr=subsetExpressionRows(exprR,rExpressionSampleIds,analysisSampleIds);
  }

  const transform=expressionTransformForProfile(resolved.expression);
  const meta={dataVersion:DATA_VERSION,studyId,studyName:study.name||study.shortName||studyId,studyDescription:study.description||'',studyCitation:study.citation||'',pmid:study.pmid||'',referenceGenome:study.referenceGenome||'',scope,buildDate:new Date().toISOString(),nPatients:patients.length,nRnaSamples:rnaSampleIds.length,nAnalysisSamples:analysisSampleIds.length,nRCompatibleSamples:rExpressionSampleIds.length,nMutationSamples:mutationProfileSampleIds.length,nMutationBasalSamples:analysisMutationSampleIds.length,nGenes:expr.length,analysisPatientIds,analysisSampleIds,rExpressionSampleIds,rExpressionPatientIds,sampleToPatient:Object.fromEntries(sampleToPatient),mutationProfileId:resolved.mutation?.molecularProfileId||null,expressionProfileId:resolved.expression?.molecularProfileId||null,expressionProfileName:resolved.expression?.name||'',expressionTransform:transform,selection:analysisSelection,mutationSelection,mutationDenominatorPolicy:'PROFILED_MUTATION_CASE_LIST',survivalModes:{basal:'Uma amostra basal por paciente',rCompatible:'Todas as amostras de expressão alinhadas ao clínico, como no Script.R; ausências de expressão imputadas pela mediana do gene.'},capabilities:{clinical:clinical.rows.length>0,mutation:!!resolved.mutation,expression:!!resolved.expression,survival:clinical.attributes.some(x=>/OS_MONTHS|OS_DAYS|OVERALL_SURVIVAL_MONTHS|OS_STATUS|VITAL_STATUS/i.test(x))}};
  const sid=studyId;
  await ST.set('meta',`pack:${sid}`,meta);
  await ST.set('meta','activeStudyId',sid);
  await ST.set('clinical',`all:${sid}`,clinical);
  await ST.set('mut',`agg:${sid}`,mutations);
  await ST.set('expr',`meta:${sid}`,{sampleIds:analysisSampleIds,rSampleIds:rExpressionSampleIds,geneMeta:expr.map(g=>({symbol:g.symbol,entrez:g.entrez}))});
  await ST.putMany('expr',expr.map(g=>[`expr:${sid}:${g.entrez}`,g.values]));
  await ST.putMany('expr',exprR.map(g=>[`exprR:${sid}:${g.entrez}`,g.values]));
  onProgress({pct:100,phase:'done',msg:'Estudo LLA pronto para análise local.'});return meta;
}

export async function setActiveStudy(studyId){
  if(!studyId)return;
  const pack=await ST.get('meta',`pack:${studyId}`);
  if(!pack||pack.dataVersion!==DATA_VERSION)throw new Error('Estudo não está carregado nesta versão do GENESIS.');
  await ST.set('meta','activeStudyId',studyId);
}

export async function getActiveStudyId(){return await ST.get('meta','activeStudyId');}

export async function listLoadedStudyMeta(){
  const ks=await ST.keys('meta');
  const ids=ks.filter(k=>String(k).startsWith('pack:')).map(k=>String(k).slice(5));
  const out=[];
  for(const id of ids){const p=await ST.get('meta',`pack:${id}`);if(p?.dataVersion===DATA_VERSION)out.push(p);}
  return out.sort((a,b)=>String(a.studyName).localeCompare(String(b.studyName),'pt-BR'));
}

export async function loadDatapack(studyId=null){
  const sid=studyId||await ST.get('meta','activeStudyId');
  if(!sid)return null;
  const pack=await ST.get('meta',`pack:${sid}`);if(!pack||pack.dataVersion!==DATA_VERSION)return null;
  const clinical=await ST.get('clinical',`all:${sid}`),mut=await ST.get('mut',`agg:${sid}`),exprMeta=await ST.get('expr',`meta:${sid}`);
  if(!clinical||!exprMeta)return null;
  const expr=[],exprR=[];for(const g of exprMeta.geneMeta||[]){const values=await ST.get('expr',`expr:${sid}:${g.entrez}`);if(values)expr.push({...g,values});const rValues=await ST.get('expr',`exprR:${sid}:${g.entrez}`);if(rValues)exprR.push({...g,values:rValues});}
  return{pack,clinical,mut:mut||{byGene:{},totalSamples:0},rnaSampleIds:exprMeta.sampleIds||[],rSampleIds:exprMeta.rSampleIds||pack.rExpressionSampleIds||[],sampleToPatient:new Map(Object.entries(pack.sampleToPatient||{})),expr,exprR};
}

export async function loadDatapacks(studyIds=[]){
  const out=[];for(const id of studyIds){const dp=await loadDatapack(id);if(dp)out.push(dp);}return out;
}

export async function clearDatapack(studyId=null){
  const sid=studyId||await ST.get('meta','activeStudyId');if(!sid)return;
  const exprMeta=await ST.get('expr',`meta:${sid}`);
  for(const g of exprMeta?.geneMeta||[]){await ST.del('expr',`expr:${sid}:${g.entrez}`);await ST.del('expr',`exprR:${sid}:${g.entrez}`);}
  await ST.del('expr',`meta:${sid}`);await ST.del('clinical',`all:${sid}`);await ST.del('mut',`agg:${sid}`);await ST.del('meta',`pack:${sid}`);
  const active=await ST.get('meta','activeStudyId');if(active===sid){const left=await listLoadedStudyMeta();if(left[0])await ST.set('meta','activeStudyId',left[0].studyId);else await ST.del('meta','activeStudyId');}
}
