import { transformExpressionValue } from './analysis-engine.js';

function finiteNumber(value) {
  if (value == null || String(value).trim() === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export function normalizeClinicalSex(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return null;
  if (['female','f','feminino','feminina','woman','mulher'].includes(s)) return 'female';
  if (['male','m','masculino','masculina','man','homem'].includes(s)) return 'male';
  return null;
}

export function clinicalAgeYears(row = {}) {
  const age = finiteNumber(row.AGE);
  if (Number.isFinite(age)) return age;
  const days = finiteNumber(row.AGE_IN_DAYS);
  if (Number.isFinite(days)) return days / 365.25;
  return NaN;
}

export function median(values = []) {
  const v = values.map(Number).filter(Number.isFinite).sort((a,b) => a-b);
  if (!v.length) return NaN;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m-1] + v[m]) / 2;
}

function sampleSd(values = []) {
  const v = values.map(Number).filter(Number.isFinite);
  if (v.length < 2) return NaN;
  const mean = v.reduce((a,b)=>a+b,0) / v.length;
  const ss = v.reduce((a,b)=>a + (b-mean)**2, 0);
  return Math.sqrt(ss / (v.length - 1));
}

function ageLabel(cutoff) {
  return Number.isInteger(cutoff)
    ? String(cutoff)
    : cutoff.toLocaleString('pt-BR',{maximumFractionDigits:1});
}

function patientIdForSample(dp, sampleId) {
  if (dp?.sampleToPatient instanceof Map) {
    const v = dp.sampleToPatient.get(sampleId);
    if (v) return String(v);
  }
  if (dp?.pack?.sampleToPatient && dp.pack.sampleToPatient[sampleId]) {
    return String(dp.pack.sampleToPatient[sampleId]);
  }
  return String(sampleId || '').replace(/\.\d+$/,'').replace(/-[0-9A-Za-z]+$/,'');
}

/**
 * Heatmap demográfico exploratório:
 * - universo: amostras basais já deduplicadas do datapack (dp.rnaSampleIds)
 * - grupos: sexo clínico × idade abaixo/acima da mediana da coorte elegível
 * - valor: média do z-score de expressão por gene dentro do grupo
 *
 * A mediana é um divisor descritivo da coorte, não um limiar clínico.
 */
export function buildDemographicHeatmap(dp, requestedGenes = [], { maxGenes = 20, minGroupN = 5 } = {}) {
  const clinicalRows = dp?.clinical?.rows || [];
  const sampleIds = dp?.rnaSampleIds || [];
  const exprRows = dp?.expr || [];

  if (!clinicalRows.length) return { available:false, reason:'Dados clínicos indisponíveis.' };
  if (!sampleIds.length || !exprRows.length) return { available:false, reason:'Expressão basal indisponível.' };

  const clinicalMap = new Map(clinicalRows.map(r => [String(r.PATIENT_ID ?? ''), r]));
  const records = [];
  for (let i=0;i<sampleIds.length;i++) {
    const sampleId = sampleIds[i];
    const patientId = patientIdForSample(dp, sampleId);
    const row = clinicalMap.get(patientId);
    if (!row) continue;
    const sex = normalizeClinicalSex(row.SEX ?? row.GENDER);
    const age = clinicalAgeYears(row);
    if (!sex || !Number.isFinite(age)) continue;
    records.push({ index:i, sampleId, patientId, sex, age });
  }

  if (records.length < minGroupN * 4) {
    return { available:false, reason:'Poucos casos com expressão, idade e sexo disponíveis simultaneamente.' };
  }

  const cutoff = median(records.map(r=>r.age));
  if (!Number.isFinite(cutoff)) return { available:false, reason:'Não foi possível calcular a mediana de idade.' };

  const cutTxt = ageLabel(cutoff);
  const groups = [
    { key:'female_low', sex:'female', band:'low', label:`Feminino < ${cutTxt} anos`, short:`F < ${cutTxt}` },
    { key:'female_high', sex:'female', band:'high', label:`Feminino ≥ ${cutTxt} anos`, short:`F ≥ ${cutTxt}` },
    { key:'male_low', sex:'male', band:'low', label:`Masculino < ${cutTxt} anos`, short:`M < ${cutTxt}` },
    { key:'male_high', sex:'male', band:'high', label:`Masculino ≥ ${cutTxt} anos`, short:`M ≥ ${cutTxt}` },
  ];
  for (const g of groups) {
    g.records = records.filter(r => r.sex === g.sex && (g.band === 'low' ? r.age < cutoff : r.age >= cutoff));
    g.n = g.records.length;
  }

  if (groups.some(g => g.n < minGroupN)) {
    return {
      available:false,
      reason:`Um ou mais grupos demográficos têm menos de ${minGroupN} casos basais.`,
      cutoff,
      groups:groups.map(({records,...g})=>g),
      eligibleN:records.length,
    };
  }

  const exprMap = new Map(exprRows.map(r => [String(r.symbol || '').toUpperCase(), r]));
  const genes = [...new Set((requestedGenes || []).map(g=>String(g).toUpperCase()).filter(Boolean))]
    .filter(g => exprMap.has(g))
    .slice(0, maxGenes);

  if (!genes.length) return {
    available:false,
    reason:'Nenhum dos genes selecionados possui expressão no painel carregado.',
    cutoff,
    groups:groups.map(({records,...g})=>g),
    eligibleN:records.length,
  };

  const rows = [];
  for (const gene of genes) {
    const expr = exprMap.get(gene);
    const transformedByIndex = new Map();
    const all = [];
    for (const rec of records) {
      const v = transformExpressionValue(expr.values?.[rec.index], dp.pack);
      if (!Number.isFinite(v)) continue;
      transformedByIndex.set(rec.index, v);
      all.push(v);
    }
    const mean = all.length ? all.reduce((a,b)=>a+b,0)/all.length : NaN;
    const sd = sampleSd(all);
    if (!Number.isFinite(sd) || sd <= 0) continue;

    const cells = groups.map(g => {
      const z = g.records
        .map(rec => transformedByIndex.has(rec.index) ? (transformedByIndex.get(rec.index)-mean)/sd : NaN)
        .filter(Number.isFinite);
      return {
        group:g.key,
        value:z.length ? z.reduce((a,b)=>a+b,0)/z.length : null,
        n:z.length,
      };
    });
    if (cells.some(c => c.value != null)) rows.push({ gene, cells });
  }

  if (!rows.length) return {
    available:false,
    reason:'Os genes selecionados não apresentaram variabilidade suficiente para padronização.',
    cutoff,
    groups:groups.map(({records,...g})=>g),
    eligibleN:records.length,
  };

  const cleanGroups = groups.map(({records,...g})=>g);
  const flat = rows.flatMap(r=>r.cells.filter(c=>Number.isFinite(c.value)).map(c=>({gene:r.gene,...c})));
  const strongest = flat.length
    ? flat.reduce((best,c)=>Math.abs(c.value)>Math.abs(best.value)?c:best,flat[0])
    : null;

  return {
    available:true,
    cutoff,
    cutoffLabel:cutTxt,
    eligibleN:records.length,
    groups:cleanGroups,
    rows,
    strongest,
    method:'Média do z-score de expressão por gene em amostras basais; grupos definidos por sexo clínico e mediana etária da coorte elegível.',
  };
}
