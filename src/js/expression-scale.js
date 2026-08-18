export function normalizeExpressionScale(value){
  const s=String(value??'').trim().toLowerCase().replace(/[_\s-]+/g,'');
  if(!s)return'unknown';
  if(s.includes('rpkm'))return'rpkm';
  if(s.includes('tpm'))return'tpm';
  if(s.includes('fpkm'))return'fpkm';
  if(s.includes('zscore')||s==='z')return'zscore';
  if(['original','identity','valororiginal','other','outro'].includes(s))return'original';
  return'unknown';
}
export function cohortExpressionScale(pack={}){
  const direct=normalizeExpressionScale(pack?.expressionTransform?.inputKey);if(direct!=='unknown')return direct;
  const fromLabel=normalizeExpressionScale(pack?.expressionTransform?.inputLabel);if(fromLabel!=='unknown')return fromLabel;
  return normalizeExpressionScale(`${pack?.expressionProfileId||''} ${pack?.expressionProfileName||''}`);
}
export function expressionScaleLabel(key){return({rpkm:'RPKM',tpm:'TPM',fpkm:'FPKM',zscore:'z-score',original:'escala original',unknown:'não informada'})[key]||'não informada';}
export function expressionScaleCompatibility(patientScale,pack={}){
  const patient=normalizeExpressionScale(patientScale),cohort=cohortExpressionScale(pack);
  if(patient==='unknown')return{compatible:false,patient,cohort,reason:'A escala da expressão do paciente não foi informada.'};
  if(cohort==='unknown')return{compatible:false,patient,cohort,reason:'A escala do perfil de expressão da coorte não pôde ser confirmada.'};
  if(patient==='original'||cohort==='original')return{compatible:false,patient,cohort,reason:'Escala original/não padronizada não é comparada automaticamente entre coortes. Use uma escala reconhecida e confirmada (RPKM, TPM, FPKM ou z-score).'};
  if(patient!==cohort)return{compatible:false,patient,cohort,reason:`Escalas incompatíveis: paciente em ${expressionScaleLabel(patient)} e coorte em ${expressionScaleLabel(cohort)}.`};
  return{compatible:true,patient,cohort,reason:'Escala de expressão compatível.'};
}
