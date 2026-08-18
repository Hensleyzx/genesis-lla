import Papa from 'papaparse';
import { clinicalAgeYears } from './clinical-utils.js';
const cache = new Map();
const toNum = (v) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : NaN; };

export async function fetchCSV(url) {
  if (cache.has(url)) return cache.get(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao carregar ${url}`);
  const parsed = Papa.parse(await response.text(), { header: true, skipEmptyLines: true });
  const out = { rows: parsed.data.filter((x) => Object.values(x).some((v) => v !== '' && v != null)), fields: parsed.meta.fields || [] };
  cache.set(url, out);
  return out;
}

export function uniquePatients(rows) {
  const map = new Map();
  for (const row of rows) {
    const id = row.PATIENT_ID || row.patient_id;
    if (id && !map.has(String(id))) map.set(String(id), row);
  }
  return [...map.values()];
}

export function summarizeClinical(rows) {
  const patients = uniquePatients(rows);
  const firstEvent = {}, sex = {}, ageGroups = { '0–4': 0, '5–9': 0, '10–14': 0, '15–19': 0, '20+': 0 };
  let deceased = 0;
  for (const row of patients) {
    const event = String(row.FIRST_EVENT || 'Sem informação') || 'Sem informação';
    firstEvent[event] = (firstEvent[event] || 0) + 1;
    const sx = String(row.SEX || row.GENDER || 'Não informado');
    sex[sx] = (sex[sx] || 0) + 1;
    const age = clinicalAgeYears(row);
    if (Number.isFinite(age)) {
      if (age <= 4) ageGroups['0–4']++; else if (age <= 9) ageGroups['5–9']++; else if (age <= 14) ageGroups['10–14']++; else if (age <= 19) ageGroups['15–19']++; else ageGroups['20+']++;
    }
    if (/DECEASED|DEAD|DIED|(^|:)1($|:)/.test(String(row.OS_STATUS || row.VITAL_STATUS || '').toUpperCase())) deceased++;
  }
  return { patients, totalPatients: patients.length, relapse: patients.filter((r) => String(r.FIRST_EVENT) === 'Relapse').length, none: patients.filter((r) => String(r.FIRST_EVENT) === 'None').length, deceased, firstEvent, sex, ageGroups };
}

export function summarizeDEA(rows) {
  const clean = rows.map((r) => ({
    gene: r.gene || r.Gene || r.SYMBOL || '',
    logFC: toNum(r.logFC ?? r.log2FC ?? r.Log2FC),
    adjP: toNum(r['adj.P.Val'] ?? r.padj ?? r.FDR ?? r.adjP),
  })).filter((x) => x.gene && Number.isFinite(x.logFC));
  const significant = clean.filter((x) => Number.isFinite(x.adjP) && x.adjP < 0.05 && Math.abs(x.logFC) > 0.5);
  return { clean, significant, up: significant.filter((x) => x.logFC > 0), down: significant.filter((x) => x.logFC < 0), top: [...significant].sort((a, b) => a.adjP - b.adjP).slice(0, 20) };
}

export function detectDatasetType(fields = []) {
  const names = fields.map((f) => String(f).toLowerCase());
  const has = (re) => names.some((x) => re.test(x));
  if (has(/^gene$|symbol|símbolo|hugo/) && has(/logfc|log2fc|log2foldchange|fold/) && has(/adj\.p|padj|fdr|p\.adjust|q[_ .-]?value/)) return 'dea';
  if (has(/patient_id|patientid|sample_id|sampleid/) && (has(/first_event|event/) || has(/os_status|os_months|os_days|surv_time|vital_status/))) return 'clinical';
  if (has(/^gene$|symbol|hugo/) && has(/^hr$|hazard/) && has(/lower|hr_lower|conf\.low|ci[_ .-]?low/) && has(/upper|hr_upper|conf\.high|ci[_ .-]?high/)) return 'cox';
  if (has(/^gene$|symbol|hugo/) && has(/freq|frequency|percent|n_amostras|count|mutation|alteration/)) return 'mutation';
  if (has(/^gene$|symbol|símbolo|hugo/) && has(/express|rpkm|tpm|fpkm|normalized.?count|value/)) return 'expression';
  return 'generic';
}

export function detectGenesFromRows(rows, fields, geneIds = null, { onlySignificantDEA = false, maxGenes = 30 } = {}) {
  const geneColumn = fields.find((c) => /^(gene|symbol|símbolo|hugoGeneSymbol|hugo_symbol)$/i.test(c)) || fields.find((c) => /gene|symbol|símbolo|hugo/i.test(c));
  const exprColumn = fields.find((c) => /rpkm|tpm|fpkm|expression|expressão|normalized.?count|value/i.test(c)) || fields.find((c) => /log2foldchange|log2fc|logfc|fold/i.test(c));
  const adjColumn = fields.find((c) => /adj\.p|padj|fdr|p\.adjust|q[_ .-]?value/i.test(c));
  const logColumn = fields.find((c) => /log2foldchange|log2fc|logfc|fold/i.test(c));
  const allow = Array.isArray(geneIds) && geneIds.length ? new Set(geneIds.map(x=>String(x).toUpperCase())) : null;
  const genes = [], expression = {};
  if (!geneColumn) return { genes, expression };

  for (const row of rows) {
    const gene = String(row[geneColumn] || '').trim().toUpperCase();
    if (!gene || (allow && !allow.has(gene)) || genes.includes(gene)) continue;
    if (!/^[A-Z0-9][A-Z0-9.\-]{1,30}$/.test(gene)) continue;
    if (onlySignificantDEA && adjColumn && logColumn) {
      const adj = toNum(row[adjColumn]), logfc = toNum(row[logColumn]);
      if (!(Number.isFinite(adj) && adj < 0.05 && Number.isFinite(logfc) && Math.abs(logfc) > 0.5)) continue;
    }
    genes.push(gene);
    if (exprColumn && !/log2fc|logfc|fold/i.test(exprColumn)) {
      const v = toNum(row[exprColumn]);
      if (Number.isFinite(v)) expression[gene] = v;
    }
    if (genes.length >= maxGenes) break;
  }
  return { genes, expression };
}

export function detectRScript(code) {
  return [
    ['cBioPortalData', 'Acesso ao cBioPortal'], ['cBioDataPack', 'Download do TARGET ALL'],
    ['limma', 'Expressão diferencial'], ['topTable', 'Tabela de DEGs'], ['survfit', 'Kaplan-Meier'],
    ['coxph', 'Regressão de Cox'], ['ggsurvplot', 'Visualização de sobrevida'], ['write.csv', 'Exportação CSV'],
    ['all_phase2_target_2018_pub', 'Estudo TARGET ALL'],
  ].map(([token, label]) => ({ token, label, found: code.includes(token) }));
}
