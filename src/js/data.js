export const GENES = [
  { id: 'TP53', name: 'TP53', desc: 'Supressor tumoral e estabilidade genômica.' },
  { id: 'IKZF1', name: 'IKZF1', desc: 'Fator de transcrição ligado à diferenciação linfoide.' },
  { id: 'BCR-ABL1', name: 'BCR-ABL1', desc: 'Fusão molecular investigada em subgrupos de LLA.' },
  { id: 'NOTCH1', name: 'NOTCH1', desc: 'Via de sinalização relevante sobretudo em LLA-T.' },
  { id: 'RUNX1', name: 'RUNX1', desc: 'Fator de transcrição hematopoiético.' },
  { id: 'CDKN2A', name: 'CDKN2A', desc: 'Regulador do ciclo celular.' },
  { id: 'DAPK1', name: 'DAPK1', desc: 'Relacionado a vias de morte celular.' },
  { id: 'EPM2AIP1', name: 'EPM2AIP1', desc: 'Gene identificado nas análises exploratórias do projeto; requer validação independente.' },
  { id: 'PAX5', name: 'PAX5', desc: 'Fator de transcrição essencial à diferenciação de células B; alterações são descritas em subgrupos de LLA-B.' },
  { id: 'KMT2A', name: 'KMT2A', desc: 'Gene associado a rearranjos recorrentes em subgrupos de LLA; deve ser interpretado conforme o tipo de alteração reportada.' },
];

export const GENE_IDS = GENES.map((g) => g.id);

export const ANALYSIS_STEPS = [
  'Validando dados do paciente',
  'Carregando coortes LLA selecionadas',
  'Verificando biomarcadores selecionados',
  'Pareando pacientes com perfis semelhantes',
  'Calculando curvas de sobrevida das coortes semelhantes',
  'Executando Cox univariado',
  'Consultando expressão diferencial',
  'Organizando evidências',
  'Gerando visualizações comparativas do caso',
  'Finalizando relatório de pesquisa',
];

export const PROJECT_INFO = {
  name: 'GENESIS LLA Platform',
  subtitle: 'Plataforma acadêmica de bioinformática para apoio à interpretação de biomarcadores na Leucemia Linfoblástica Aguda (LLA)',
  authors: [
    { name: 'Davi Hensley de Araujo Costa', initials: 'DA' },
    { name: 'Mickael Medeiros Rodrigues', initials: 'MR' },
  ],
  school: 'Escola Estadual Professor Abel Freire Coelho',
  event: '26ª FECEAC',
  technologies: ['HTML5', 'CSS3', 'JavaScript', 'Chart.js', 'PapaParse', 'jsPDF', 'IndexedDB', 'cBioPortal REST API', 'R'],
  warning: 'Uso exclusivo em pesquisa/educação. O GENESIS não é dispositivo médico validado, não emite diagnóstico, não estima prognóstico individual validado e não deve orientar tratamento ou decisão assistencial.',
};

const HISTORY_KEY = 'genesis_lla_analises_v6';
const CURRENT_KEY = 'genesis_lla_atual_v6';

export function carregarAnalises() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

export function salvarAnalises(items) {
  const list = Array.isArray(items) ? items : [];
  // Histórico compacto para não estourar a cota do localStorage após várias análises.
  for (const limit of [60, 40, 20, 10]) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, limit)));
      return;
    } catch {}
  }
}

function resumoHistorico(item) {
  return {
    id: item?.id || '',
    nome: item?.nome || '',
    data: item?.data || new Date().toISOString(),
    biomarcadores: [...(item?.biomarcadores || [])],
    perfil: item?.perfil ? {
      key: item.perfil.key,
      label: item.perfil.label,
      favoraveis: item.perfil.favoraveis,
      desfavoraveis: item.perfil.desfavoraveis,
      inconclusivas: item.perfil.inconclusivas,
    } : null,
    dataQuality: item?.dataQuality ? {
      score: item.dataQuality.score,
      label: item.dataQuality.label,
    } : null,
    referencias: (item?.referencias || []).map(r => ({ studyId: r.studyId, studyName: r.studyName })),
    studyResults: (item?.studyResults || []).map(s => ({ studyId: s.studyId, studyName: s.studyName })),
  };
}

export function adicionarAnalise(item) {
  const items = carregarAnalises();
  items.unshift(resumoHistorico(item));
  salvarAnalises(items);
  return items;
}

export function salvarAnaliseAtual(result) {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(result));
  } catch {
    // Se o resultado completo for grande demais, preserva ao menos a síntese.
    try { localStorage.setItem(CURRENT_KEY, JSON.stringify(resumoHistorico(result))); } catch {}
  }
}

export function carregarAnaliseAtual() {
  try { return JSON.parse(localStorage.getItem(CURRENT_KEY) || 'null'); }
  catch { return null; }
}

export function formatarData(value) {
  try { return new Date(value).toLocaleString('pt-BR'); }
  catch { return value; }
}

export function gerarRelatorioTexto(r) {
  const lines = [
    'GENESIS — RELATÓRIO DE PESQUISA MOLECULAR EM LLA',
    '',
    `Caso: ${r.nome || '—'} (${r.id || '—'})`,
    `Data: ${formatarData(r.data)}`,
    `Idade: ${r.idade ?? '—'} anos`,
    `Sexo: ${r.sexo === 'F' ? 'Feminino' : r.sexo === 'M' ? 'Masculino' : '—'}`,
    `Histórico de recaída informado: ${r.recaida == null ? '—' : r.recaida ? 'Sim' : 'Não'}`,
    `Subtipo molecular informado: ${r.subtipoMolecular || '—'}`,
    `Leucócitos/WBC informado: ${r.leucocitos ?? '—'}`,
    `BCR-ABL1 informado: ${r.fusoes?.['BCR-ABL1'] === 'positivo' ? 'Positivo' : r.fusoes?.['BCR-ABL1'] === 'negativo' ? 'Negativo' : '—'}`,
    `Profissional responsável: ${r.profissional?.name || '—'}${r.profissional?.identifier ? ` (${r.profissional.identifier})` : ''}${r.profissional?.institution ? ` — ${r.profissional.institution}` : ''}`, 
    `Estudos comparados: ${(r.referencias || []).map(x => x.studyName || x.studyId).join('; ') || '—'}`,
    `Biomarcadores informados: ${(r.biomarcadores || []).join(', ') || 'Nenhum'}`,
    '',
    `Síntese de evidências: ${r.perfil?.label || 'Inconclusivo'}`,
    `Evidências desfavoráveis: ${r.perfil?.desfavoraveis ?? 0}`,
    `Evidências favoráveis: ${r.perfil?.favoraveis ?? 0}`,
    `Evidências inconclusivas: ${r.perfil?.inconclusivas ?? 0}`,
    '',
    'Resumo das análises:',
  ];

  for (const ev of r.evidencias || []) {
    lines.push(`- ${ev.gene}: ${ev.resumo}`);
  }

  for (const s of r.studyResults || []) {
    if (s.matched?.available) lines.push(`- Coorte semelhante em ${s.studyName}: n=${s.matched.nMatched}, eventos=${s.matched.nEvents}, similaridade mediana=${Number(s.matched.medianSimilarity||0).toFixed(1)}/100, força do pareamento=${s.matched.strength}.`);
  }
  lines.push('', 'Interpretação de pesquisa:', r.interpretacao || '—', '', 'AVISO: as curvas de sobrevida pertencem a grupos de pacientes de referência com perfil semelhante. O GENESIS não as converte em probabilidade individual de morte/sobrevida, não emite diagnóstico clínico e não recomenda tratamento.');
  return lines.join('\n');
}
