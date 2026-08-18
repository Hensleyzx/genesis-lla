function num(v){
  if(v==null||String(v).trim()==='')return NaN;
  const x=Number(String(v).replace(',','.'));
  return Number.isFinite(x)?x:NaN;
}

export function clinicalAgeYears(row={}){
  const days=num(row?.AGE_IN_DAYS);
  if(Number.isFinite(days)&&days>=0)return days/365.25;
  const age=num(row?.AGE);
  if(!Number.isFinite(age)||age<0)return NaN;
  return age>150?age/365.25:age;
}

export function normalizeWbcUnit(unit){
  const s=String(unit??'').trim().toLowerCase();
  if(!s)return'unknown';
  if(['x10e9_l','x10^9/l','10^9/l','10e9/l','10^3/ul','x10^3/ul','k/ul','k/µl','10^3/µl'].includes(s))return'x10e9_l';
  if(['cells_ul','cells/ul','cells/µl','celulas/ul','células/µl','/ul','/µl'].includes(s))return'cells_ul';
  return'unknown';
}

export function normalizeWbcValue(value,unit){
  const x=num(value),u=normalizeWbcUnit(unit);
  if(!Number.isFinite(x)||x<0||u==='unknown')return NaN;
  return u==='cells_ul'?x/1000:x;
}

export function inferWbcUnit({rows=[],attributeMetadata=[]}={}){
  const metaText=(attributeMetadata||[])
    .filter(a=>/^(WBC|WBC_AT_DIAGNOSIS|WHITE_BLOOD_CELL_COUNT)$/i.test(String(a?.clinicalAttributeId||a?.id||'')))
    .map(a=>`${a?.displayName||''} ${a?.description||''} ${a?.unit||''}`).join(' ').toLowerCase();
  if(/(?:10\s*\^?\s*9\s*\/\s*l|10e9\s*\/\s*l|10\s*\^?\s*3\s*\/\s*[uµ]l|k\s*\/\s*[uµ]l)/i.test(metaText))return{key:'x10e9_l',label:'×10⁹/L (equiv. ×10³/µL)',source:'metadata'};
  if(/(?:cells?|c[eé]lulas?)\s*\/\s*[uµ]l/i.test(metaText))return{key:'cells_ul',label:'células/µL',source:'metadata'};
  const vals=[];
  for(const row of rows||[]){for(const k of ['WBC','WBC_AT_DIAGNOSIS','WHITE_BLOOD_CELL_COUNT']){const x=num(row?.[k]);if(Number.isFinite(x)&&x>=0){vals.push(x);break;}}}
  if(vals.length>=20){const sorted=vals.slice().sort((a,b)=>a-b),med=sorted[Math.floor(sorted.length/2)];if(med>0&&med<1000)return{key:'x10e9_l',label:'×10⁹/L (inferido pela escala)',source:'distribution'};if(med>=1000)return{key:'cells_ul',label:'células/µL (inferido pela escala)',source:'distribution'};}
  return{key:'unknown',label:'unidade de WBC não confirmada',source:'unknown'};
}

export function clinicalWbcX10e9L(row={},unitMeta={key:'unknown'}){
  let raw=NaN;
  for(const k of ['WBC','WBC_AT_DIAGNOSIS','WHITE_BLOOD_CELL_COUNT']){const x=num(row?.[k]);if(Number.isFinite(x)&&x>=0){raw=x;break;}}
  return normalizeWbcValue(raw,unitMeta?.key||unitMeta);
}
