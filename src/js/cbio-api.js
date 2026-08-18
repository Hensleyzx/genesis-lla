export const CBIO_BASE = 'https://www.cbioportal.org/api';
export const DEFAULT_LLA_STUDY = 'all_phase2_target_2018_pub';
export const DATAHUB_BASE = 'https://datahub.assets.cbioportal.org';

// Cinco coortes de LLA/ALL selecionadas explicitamente para o GENESIS.
// A lista curada evita incluir AML ou outras leucemias por correspondência textual acidental
// e não deve ser interpretada como o total de estudos LLA existentes no cBioPortal.
export const CORE_LLA_STUDY_IDS = [
  'all_phase2_target_2018_pub',
  'bll_target_gdc',
  'all_stjude_2015',
  'all_stjude_2016',
  'all_stjude_2013',
];

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function httpJson(url, opts = {}) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...opts,
        headers: {
          Accept: 'application/json',
          ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
          ...(opts.headers || {}),
        },
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} — ${text.slice(0, 220)}`);
      }
      return await response.json();
    } catch (err) {
      lastError = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * (2 ** attempt)));
    }
  }
  throw lastError;
}

export function isLlaStudy(study) {
  const idRaw = String(study?.studyId || '');
  const nameRaw = String(study?.name || '');
  const descRaw = String(study?.description || '');
  const id = idRaw.toLowerCase();
  const ctype = String(study?.cancerTypeId || '').toLowerCase();
  const text = `${idRaw} ${nameRaw} ${descRaw}`;
  if (/acute myeloid|\bAML\b|myeloma/i.test(text)) return false;
  return ctype === 'bll'
    || CORE_LLA_STUDY_IDS.includes(idRaw)
    || /^all_|_all_|all_phase/i.test(id)
    || /acute lymphoblastic|acute lymphoid|lymphoblastic leukemia|lymphoblastic lymphoma|\bB[- ]?ALL\b|\bT[- ]?ALL\b/i.test(text)
    || /\bALL\b/.test(`${idRaw} ${nameRaw}`);
}

export function rawStudyDownloadUrl(studyId) {
  return `${DATAHUB_BASE}/${encodeURIComponent(studyId)}.tar.gz`;
}

export const cbio = {
  get(path) { return httpJson(`${CBIO_BASE}${path}`); },
  post(path, body) { return httpJson(`${CBIO_BASE}${path}`, { method: 'POST', body: JSON.stringify(body) }); },
  getStudies() { return this.get('/studies'); },
  getStudy(studyId = DEFAULT_LLA_STUDY) { return this.get(`/studies/${encodeURIComponent(studyId)}`); },
  getSamples(studyId = DEFAULT_LLA_STUDY) { return this.get(`/studies/${encodeURIComponent(studyId)}/samples`); },
  getSampleLists(studyId = DEFAULT_LLA_STUDY) { return this.get(`/studies/${encodeURIComponent(studyId)}/sample-lists`); },
  getSampleListIds(id) { return this.get(`/sample-lists/${encodeURIComponent(id)}/sample-ids`); },
  getClinicalAttributes(studyId = DEFAULT_LLA_STUDY) { return this.get(`/studies/${encodeURIComponent(studyId)}/clinical-attributes`); },
  getMolecularProfiles(studyId = DEFAULT_LLA_STUDY) { return this.get(`/studies/${encodeURIComponent(studyId)}/molecular-profiles`); },

  async listLlaStudies() {
    const all = await this.getStudies();
    const byId = new Map(all.map((s) => [s.studyId, s]));
    const core = CORE_LLA_STUDY_IDS.map((id) => byId.get(id)).filter(Boolean);
    const discovered = all.filter(isLlaStudy).filter((s) => !CORE_LLA_STUDY_IDS.includes(s.studyId));
    return {
      all,
      core,
      lla: [...core, ...discovered],
      missingCoreIds: CORE_LLA_STUDY_IDS.filter((id) => !byId.has(id)),
    };
  },

  async resolveProfiles(studyId = DEFAULT_LLA_STUDY) {
    const profiles = await this.getMolecularProfiles(studyId);
    const mutation = profiles.find((p) => /MUTATION_EXTENDED/i.test(p.molecularAlterationType || ''))
      || profiles.find((p) => /mutation/i.test(`${p.molecularProfileId} ${p.name}`));
    const candidates = profiles.filter((p) => /MRNA_EXPRESSION/i.test(p.molecularAlterationType || '')
      || /rna|rpkm|fpkm|tpm|expression/i.test(`${p.molecularProfileId} ${p.name}`));
    const rank = (p) => {
      const t = `${p.molecularProfileId} ${p.name}`.toLowerCase();
      if (/rpkm/.test(t)) return 1;
      if (/tpm|fpkm/.test(t)) return 2;
      if (/rna.*expression|mrna/.test(t) && !/zscore|z-score/.test(t)) return 3;
      if (/zscore|z-score/.test(t)) return 4;
      return 9;
    };
    const expression = [...candidates].sort((a, b) => rank(a) - rank(b))[0] || null;
    return { mutation, expression, profiles };
  },

  async inspectStudy(studyId) {
    const [study, samples, lists, attrs, resolved] = await Promise.all([
      this.getStudy(studyId),
      this.getSamples(studyId),
      this.getSampleLists(studyId),
      this.getClinicalAttributes(studyId),
      this.resolveProfiles(studyId),
    ]);
    const attrIds = new Set(attrs.map((a) => String(a.clinicalAttributeId || '').toUpperCase()));
    const hasOS = [...attrIds].some((x) => /OS_MONTHS|OS_DAYS|OVERALL_SURVIVAL/.test(x))
      && [...attrIds].some((x) => /OS_STATUS|VITAL_STATUS/.test(x));
    return {
      study,
      samples,
      lists,
      attrs,
      resolved,
      capabilities: {
        clinical: attrs.length > 0,
        survival: hasOS,
        mutation: !!resolved.mutation,
        expression: !!resolved.expression,
      },
    };
  },

  async fetchClinical(studyId, attributeIds, patientIds, onChunk) {
    const out = [];
    const groups = chunk(patientIds, 350);
    for (let i = 0; i < groups.length; i += 1) {
      const rows = await this.post(
        `/studies/${encodeURIComponent(studyId)}/clinical-data/fetch?clinicalDataType=PATIENT&projection=DETAILED&pageSize=10000`,
        { attributeIds, ids: groups[i] },
      );
      out.push(...rows);
      onChunk?.(i + 1, groups.length);
    }
    return out;
  },

  async fetchMutations(profileId, sampleIds, onChunk) {
    if (!profileId) return [];
    const out = [];
    const groups = chunk(sampleIds, 40);
    for (let i = 0; i < groups.length; i += 1) {
      const rows = await this.post(
        `/molecular-profiles/${encodeURIComponent(profileId)}/mutations/fetch?projection=DETAILED`,
        { sampleIds: groups[i] },
      );
      out.push(...rows);
      onChunk?.(i + 1, groups.length);
    }
    return out;
  },

  async fetchMolecularData(profileId, sampleIds, entrezGeneIds, onProgress) {
    if (!profileId || !sampleIds?.length || !entrezGeneIds?.length) return [];
    const out = [];
    const geneGroups = chunk(entrezGeneIds, 300);
    const sampleGroups = chunk(sampleIds, 35);
    const total = geneGroups.length * sampleGroups.length;
    let done = 0;
    for (const genes of geneGroups) {
      for (const samples of sampleGroups) {
        const rows = await this.post(
          `/molecular-profiles/${encodeURIComponent(profileId)}/molecular-data/fetch`,
          { sampleIds: samples, entrezGeneIds: genes },
        );
        out.push(...rows);
        done += 1;
        onProgress?.(done, total, out.length);
      }
    }
    return out;
  },

  async getGenes(onProgress) {
    const out = [];
    const pageSize = 1000;
    for (let page = 0; page < 60; page += 1) {
      const rows = await this.get(`/genes?pageSize=${pageSize}&pageNumber=${page}`);
      out.push(...rows);
      onProgress?.(out.length);
      if (rows.length < pageSize) break;
    }
    return out;
  },
};

export function chooseSampleList(lists, kind, profile = null) {
  const hay = (lists || []).map((x) => ({
    ...x,
    text: `${x.sampleListId || ''} ${x.name || ''} ${x.description || ''} ${x.category || ''}`.toLowerCase(),
  }));
  if (kind === 'mutation') return hay.find((x) => /sequenced|mutation/.test(x.text)) || null;
  if (kind === 'rna') {
    const profileText = `${profile?.molecularProfileId || ''} ${profile?.name || ''} ${profile?.description || ''}`.toLowerCase();
    const wantsSeq = /rpkm|tpm|fpkm|rna[_ -]?seq|rnaseq/.test(profileText);
    const wantsArray = /agilent|microarray|expression[_ -]?array|mrna[_ -]?array/.test(profileText);
    const scored = hay.map((x, index) => {
      let score = 0;
      if (/rna|mrna|rpkm|tpm|fpkm|expression/.test(x.text)) score += 20;
      if (/all cases|all samples/.test(x.text)) score += 2;
      const isSeq = /rna[_ -]?seq|rnaseq/.test(x.text);
      const isArray = /agilent|microarray|mrna[_ -]?array|expression[_ -]?array/.test(x.text);
      if (wantsSeq) {
        if (isSeq) score += 100;
        if (isArray) score -= 100;
      }
      if (wantsArray) {
        if (isArray) score += 100;
        if (isSeq) score -= 60;
      }
      return { x, score, index };
    }).sort((a, b) => b.score - a.score || a.index - b.index);
    return scored[0]?.score > 0 ? scored[0].x : null;
  }
  return null;
}

export function expressionTransformForProfile(profile) {
  const text = `${profile?.molecularProfileId || ''} ${profile?.name || ''}`.toLowerCase();
  if (/rpkm|tpm|fpkm/.test(text)) {
    return {
      key: 'log2p1',
      label: 'log2(expressão + 1)',
      inputKey: /rpkm/.test(text) ? 'rpkm' : /tpm/.test(text) ? 'tpm' : 'fpkm',
      inputLabel: /rpkm/.test(text) ? 'RPKM' : /tpm/.test(text) ? 'TPM' : 'FPKM',
      reason: 'Perfil normalizado contínuo; a análise usa transformação log2(x+1).',
    };
  }
  if (/zscore|z-score/.test(text)) {
    return { key: 'identity', label: 'z-score', inputKey: 'zscore', inputLabel: 'z-score', reason: 'O perfil já está padronizado.' };
  }
  return {
    key: 'identity',
    label: profile ? 'escala original' : 'não disponível',
    inputKey: profile ? 'original' : 'unknown',
    inputLabel: 'valor de expressão',
    reason: profile ? 'Escala não reconhecida automaticamente; resultados devem ser conferidos no pipeline R.' : 'Estudo sem perfil de expressão compatível.',
  };
}
