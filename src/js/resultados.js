import '../css/genesis.css';
import { mountLayout, injectFontAwesome, warningBanner, getChartTheme, graphReport } from './common.js';
import { renderStudyManager } from './study-ui.js';
import { DEFAULT_LLA_STUDY } from './cbio-api.js';
import { loadDatapack } from './datapack.js';
import { buildStudyAnalytics, volcanoPoints } from './research-analytics.js';
import { buildReferenceVectors, buildRCompatibleReferenceVectors, rCompatibleExpressionValues, transformExpressionValue } from './analysis-engine.js';
import { buildDemographicHeatmap } from './demographic-heatmap.js';
import { univariate as coxUnivariate } from './cox.js';
import { bhFdr } from './stats.js';
import { analyzeSurvival, atRiskAt } from './survival.js';
import Chart from 'chart.js/auto';

injectFontAwesome();
mountLayout('resultados', 'Estudos & Gráficos');

const content = document.getElementById('page-content');
const HISTORY_KEY = 'genesis_graph_history_v10';
let dp = null;
let analytics = null;
let charts = [];
let customGenes = [];
let rReference = null;
let coxRReference = [];

content.innerHTML = `
${warningBanner()}
<div class="flow-head">
  <div>
    <div class="result-hero__label">MÓDULO DE COORTES · ESTUDOS & GRÁFICOS</div>
    <h1 class="page-title">Explore coortes LLA e gere análises de referência</h1>
    <p class="page-desc">Esta página trabalha com as coortes de referência do GENESIS. Gráficos calculados no navegador são marcados como <strong>exploratórios</strong>; somente resultados conferidos contra a saída correspondente do R recebem o selo <strong>validado contra R</strong>.</p>
  </div>
  <a class="btn btn-secondary" href="dashboard.html"><i class="fa-solid fa-clock-rotate-left"></i> Ver histórico</a>
</div>

<div class="card mt-6 genesis-r-study-card">
  <div class="card__header">
    <div>
      <div class="result-hero__label">ESTUDO DE VALIDAÇÃO DO PROJETO</div>
      <div class="card__title"><i class="fa-solid fa-flask-vial"></i> GENESIS-R — Estudo de Validação TARGET ALL</div>
      <div class="card__subtitle">Pacote fixo com os CSVs e gráficos produzidos pelo pipeline R: Top 30 n=150, DEA Relapse vs None, Cox univariado/multivariado, Kaplan–Meier e dados clínicos.</div>
    </div>
    <a class="btn btn-primary" href="resultados-r.html?autoload=1"><i class="fa-solid fa-database"></i> Carregar GENESIS-R</a>
  </div>
  <div class="official-r-badges mt-4">
    <span><i class="fa-solid fa-shield-heart"></i> DADOS DO R</span>
    <span>TARGET ALL</span>
    <span>Top 30: n=150</span>
    <span>OS · Sobrevida Global</span>
  </div>
  <div class="genesis-r-preview-grid mt-4">
    <div><strong>Top 30</strong><span>NRAS 10,7% · KRAS 5,3%</span></div>
    <div><strong>DEA</strong><span>23.405 genes no CSV</span></div>
    <div><strong>Cox</strong><span>10 uni · 9 multi no GENESIS-R</span></div>
    <div><strong>Kaplan–Meier</strong><span>10 curvas da saída R</span></div>
  </div>
  <p class="chart-note mt-3">O GENESIS-R é separado das coortes exploratórias abaixo para impedir que resultados recalculados no navegador sejam confundidos com as saídas fornecidas pelo R.</p>
</div>

<div class="mt-6">
  <div class="section-route"><span>1</span><div><strong>Escolher / carregar estudo</strong><small>O estudo ativo define a coorte usada nos módulos exploratórios.</small></div></div>
  <div id="study-manager" class="mt-4"></div>
</div>

<div id="results-workspace" class="mt-6"></div>
`;

rReference = await loadRReference();
coxRReference = await loadCoxRReference();
await renderStudyManager('#study-manager', { simple: true, onReady: async () => { await refreshWorkspace(); } });
await refreshWorkspace();
window.addEventListener('genesis:themechange', () => { if (dp) renderGeneratedGraphs(true); });

async function refreshWorkspace() {
  destroyCharts();
  dp = await loadDatapack().catch(() => null);
  const host = document.getElementById('results-workspace');
  if (!dp) {
    host.innerHTML = `<div class="card"><div class="card__title"><i class="fa-solid fa-database"></i> Nenhum estudo ativo</div><p class="page-desc mt-3">Carregue um estudo LLA acima. Depois disso, o GENESIS calcula o Top 30 da coorte ativa e atualiza automaticamente o painel com os 10 genes mais frequentes.</p></div>`;
    return;
  }
  analytics = buildStudyAnalytics(dp);
  const top10 = (dp.pack.studyId === DEFAULT_LLA_STUDY && rReference?.genes?.length
    ? rReference.genes.slice(0,10).map(x=>String(x.gene).toUpperCase())
    : analytics.topMut.slice(0,10).map(x=>String(x.symbol).toUpperCase()));
  customGenes = customGenes.filter(g => !top10.includes(g));
  renderWorkspace(top10);
}

function renderWorkspace(top10) {
  const topMut = analytics.topMut || [];
  const p = dp.pack;
  const mutationDenom = Number(dp.mut?.totalSamples || p.nMutationSamples || 0);
  const top10Html = top10.length ? top10.map((g, i) => `
    <label class="gene-choice">
      <input type="checkbox" class="result-gene" value="${esc(g)}" ${i === 0 ? 'checked' : ''}>
      <span><strong>${esc(g)}</strong><small>#${i + 1} do Top 30 desta coorte</small></span>
    </label>`).join('') : `<div class="empty-science">O estudo ativo não possui um ranking de mutações suficiente para formar o Top 10.</div>`;

  document.getElementById('results-workspace').innerHTML = `
  <div class="card">
    <div class="active-study-compact">
      <div>
        <div class="result-hero__label">ESTUDO ATIVO</div>
        <h3>${esc(p.studyName)}</h3>
        <p>${esc(p.studyId)} · ${p.nPatients || 0} pacientes basais · ${p.nAnalysisSamples || 0} amostras basais · ${p.nRCompatibleSamples || p.nRnaSamples || 0} amostras no perfil de expressão · ${mutationDenom} amostras no perfil mutacional</p>
      </div>
      <div class="cohort-warning"><strong>Política de denominador:</strong> Top 30 usa o case list mutacional completo. No TARGET ALL, KM/Cox usam por padrão a <b>Referência R do professor</b>, que segue o mesmo universo/alinhamento de amostras descrito no roteiro R de referência e permite conferir a divisão 46/46 quando há 92 observações válidas. O modo <b>Basal por paciente</b> é uma análise alternativa, deduplicada, e por isso pode ter outro n.</div>
    </div>
  </div>

  <div class="card mt-6">
    <div class="section-route"><span>2</span><div><strong>Genes disponíveis para análise</strong><small>No TARGET ALL, os 10 primeiros vêm diretamente da referência R validada. Em outros estudos, vêm do ranking mutacional do próprio estudo. Você pode escolher 1, vários, todos ou adicionar outro gene.</small></div></div>
    <div class="flex gap-2 mt-4" style="flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" id="select-all-genes">Selecionar os 10</button>
      <button class="btn btn-ghost btn-sm" id="clear-genes">Limpar seleção</button>
    </div>
    <div class="gene-choice-grid mt-4" id="gene-choice-grid">${top10Html}</div>
    <div class="custom-gene-add mt-4" style="display:grid;grid-template-columns:1fr auto;gap:10px">
      <input class="form-input" id="custom-gene" placeholder="Adicionar outro gene HUGO, ex.: STAT2, MIR221, DAPK1">
      <button class="btn btn-secondary" id="add-custom-gene"><i class="fa-solid fa-plus"></i> Adicionar gene</button>
    </div>
    <div id="gene-msg" class="mt-3"></div>
    <div class="gene-generate-bar mt-4">
      <div><strong>Genes escolhidos?</strong><small>Gera a frequência mutacional e Kaplan–Meier dos genes escolhidos. No TARGET ALL com Referência R ativa, o Cox usa o CSV fixo do professor; no modo Basal ele é recalculado para os genes selecionados.</small></div>
      <button class="btn btn-primary btn-lg" id="generate-gene-graphs"><i class="fa-solid fa-chart-line"></i> Gerar gráficos</button>
    </div>
  </div>

  <div class="card mt-6">
    <div class="section-route"><span>3</span><div><strong>Escolher quais gráficos gerar</strong><small>Nenhum gráfico é executado automaticamente. O usuário solicita somente o que quer visualizar.</small></div></div>
    <div class="survival-mode-box mt-4">
      <div><strong>Modo de sobrevida (KM/Cox)</strong><small>No TARGET ALL, o modo compatível com referência R é o padrão para comparar a estrutura das figuras fornecidas. O modo basal permanece disponível como análise alternativa deduplicada por paciente.</small></div>
      <label><input type="radio" name="survival-mode" value="r" ${p.studyId===DEFAULT_LLA_STUDY?'checked':''} ${!(p.nRCompatibleSamples||p.nRnaSamples)?'disabled':''}> <span><b>Referência R do professor</b><small>No TARGET ALL, o Forest Plot de Cox usa diretamente o CSV fornecido pelo professor, preservando genes, HR, IC95% e p-value. Kaplan–Meier continua no modo compatível com o alinhamento de amostras do procedimento de referência; nesse caso, n representa observações de amostra, não necessariamente pacientes únicos, e a equivalência numérica integral das curvas depende da matriz bruta original.</small></span></label>
      <label><input type="radio" name="survival-mode" value="basal" ${p.studyId!==DEFAULT_LLA_STUDY?'checked':''}> <span><b>Basal por paciente (alternativa)</b><small>Uma amostra primária por paciente; evita duplicação de indivíduos e pode produzir um n diferente da figura R original.</small></span></label>
    </div>
    <div class="graph-choice-grid mt-4">
      ${graphChoice('top30','Top 30 oficial — referência R','TARGET ALL · n=150 · usa a figura/valores validados pelo professor e pelo pipeline R.')}
      ${graphChoice('selectedmut','Frequência mutacional — genes selecionados','Mostra o valor de referência R quando disponível; fora da referência, identifica explicitamente o valor como exploratório do estudo ativo.')}
      ${graphChoice('demographic','Heatmap demográfico — genes × sexo/idade','GRÁFICO PEDIDO PELO PROFESSOR · Genes selecionados × quatro grupos de sexo e idade. Usa amostras basais, idade/sexo clínicos e z-score de expressão; a idade é dividida pela mediana da própria coorte.')}
      ${graphChoice('mutheat','Oncoprint mutacional basal — Top 30','Matriz binária gene × amostra basal. É um gráfico de mutações e NÃO é o heatmap demográfico solicitado pelo professor.')}
      ${graphChoice('degs','Top DEGs — Relapse vs None', dp.pack.scope==='completo' ? 'DEA exploratória em escopo completo. Ainda não é limma/R validado.' : 'Exige escopo Completo para evitar FDR/DEGs calculados sobre painel parcial.', dp.pack.scope!=='completo')}
      ${graphChoice('volcano','Volcano Plot', dp.pack.scope==='completo' ? 'Usa a mesma DEA exploratória completa; validação final depende da saída R corrigida.' : 'Exige escopo Completo; no modo Expresso faltam genes para reproduzir a análise transcriptômica.', dp.pack.scope!=='completo')}
      ${graphChoice('cox','Forest Plot — Cox univariado', p.studyId===DEFAULT_LLA_STUDY ? 'No modo Referência R, usa exatamente cox_univariado_top10_genes.csv do professor; no modo Basal, recalcula apenas os genes selecionados.' : 'Exploratório local: roda somente os genes selecionados acima; HR por 1 DP de expressão.')}
      ${graphChoice('km','Kaplan-Meier por gene','Gera uma curva separada para cada gene selecionado, dividindo expressão pela mediana.')}
    </div>
    <div class="flex gap-2 mt-4" style="flex-wrap:wrap">
      <button class="btn btn-primary" id="generate-selected"><i class="fa-solid fa-play"></i> Gerar gráficos selecionados</button>
      <button class="btn btn-ghost" id="clear-results"><i class="fa-solid fa-broom"></i> Limpar gráficos</button>
    </div>
    <div id="generation-msg" class="mt-3"></div>
  </div>

  <div class="mt-6">
    <div class="section-route"><span>4</span><div><strong>Gráficos solicitados</strong><small>Cada gráfico mostra estudo, denominador/endpoint e status de validação.</small></div></div>
    <div id="generated-results" class="result-graph-stack mt-4"><div class="card"><div class="empty-science">Nenhum gráfico solicitado ainda.</div></div></div>
  </div>`;

  document.getElementById('select-all-genes').onclick = () => document.querySelectorAll('.result-gene').forEach(x => { x.checked = true; });
  document.getElementById('clear-genes').onclick = () => document.querySelectorAll('.result-gene').forEach(x => { x.checked = false; });
  document.getElementById('add-custom-gene').onclick = addCustomGene;
  document.getElementById('custom-gene').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCustomGene(); } });
  document.getElementById('generate-gene-graphs').onclick = generateGeneGraphs;
  document.getElementById('generate-selected').onclick = () => renderGeneratedGraphs(false);
  document.getElementById('clear-results').onclick = () => { destroyCharts(); document.getElementById('generated-results').innerHTML='<div class="card"><div class="empty-science">Nenhum gráfico solicitado ainda.</div></div>'; msg('generation-msg','Gráficos removidos da tela.',true); };
}


async function loadRReference() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/r_validated/top30_genes_mutados.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Number(data?.n_samples) === 150 && Array.isArray(data?.genes) ? data : null;
  } catch {
    return null;
  }
}

async function loadCoxRReference() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/r_validated/cox_univariado_top10_genes.csv`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(x => x.replace(/^"|"$/g,'').trim());
    const rows = lines.slice(1).map(line => {
      const cells = line.split(',').map(x => x.replace(/^"|"$/g,'').trim());
      const row = Object.fromEntries(headers.map((h,i)=>[h,cells[i] ?? '']));
      return {
        Gene: String(row.Gene || '').toUpperCase(),
        HR: Number(row.HR),
        HR_lower: Number(row.HR_lower),
        HR_upper: Number(row.HR_upper),
        p_value: Number(row.p_value),
        p_signif: row.p_signif || ''
      };
    }).filter(r => r.Gene && Number.isFinite(r.HR) && Number.isFinite(r.HR_lower) && Number.isFinite(r.HR_upper) && Number.isFinite(r.p_value));
    return rows;
  } catch {
    return [];
  }
}

function hasExactCoxRReference() {
  return dp?.pack?.studyId === DEFAULT_LLA_STUDY && selectedSurvivalMode() === 'r' && coxRReference.length > 0;
}

function selectedGenes() {
  return [...new Set([...document.querySelectorAll('.result-gene:checked')].map(x => String(x.value).toUpperCase()))];
}

function generateGeneGraphs() {
  const genes = selectedGenes();
  if (!genes.length) return msg('gene-msg','Selecione pelo menos um gene antes de gerar os gráficos.',false);
  const wanted = new Set(['selectedmut','demographic','cox','km']);
  document.querySelectorAll('.result-graph').forEach(el => {
    if (el.value === 'mutheat') el.checked = false;
    else if (wanted.has(el.value) && !el.disabled) el.checked = true;
  });
  renderGeneratedGraphs(false);
  setTimeout(() => document.getElementById('generated-results')?.scrollIntoView({ behavior:'smooth', block:'start' }), 0);
}

function graphChoice(value, title, note, disabled=false) {
  return `<label class="graph-choice ${disabled?'disabled':''}"><input type="checkbox" class="result-graph" value="${value}" ${disabled?'disabled':''}><span><strong>${title}</strong>${disabled?'<em class="graph-lock">ESCopo completo necessário</em>':''}<small>${note}</small></span></label>`;
}

function addCustomGene() {
  const input = document.getElementById('custom-gene');
  const gene = String(input.value || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.-]{1,24}$/.test(gene)) return msg('gene-msg','Informe um símbolo HUGO válido.',false);
  if ([...document.querySelectorAll('.result-gene')].some(x => x.value === gene)) return msg('gene-msg',`${gene} já está no painel.`,false);
  customGenes.push(gene);
  const host = document.getElementById('gene-choice-grid');
  host.insertAdjacentHTML('beforeend', `<label class="gene-choice"><input type="checkbox" class="result-gene" value="${esc(gene)}" checked><span><strong>${esc(gene)}</strong><small>gene adicionado manualmente</small></span></label>`);
  input.value = '';
  msg('gene-msg',`${gene} adicionado. Gráficos dependentes de expressão só serão gerados se esse gene existir no estudo ativo.`,true);
}

async function renderGeneratedGraphs(redrawOnly = false) {
  if (!dp || !analytics) return;
  const selectedGraphs = [...document.querySelectorAll('.result-graph:checked')].map(x => x.value);
  const genes = [...new Set([...document.querySelectorAll('.result-gene:checked')].map(x => x.value.toUpperCase()))];
  if (!selectedGraphs.length) return msg('generation-msg','Escolha pelo menos um gráfico.',false);
  if ((selectedGraphs.includes('cox') || selectedGraphs.includes('km')) && !genes.length) return msg('generation-msg','Forest Plot e Kaplan-Meier exigem pelo menos um gene selecionado.',false);

  destroyCharts();
  const cards = [];
  for (const type of selectedGraphs) {
    if (type === 'top30') cards.push(top30Card());
    if (type === 'selectedmut') cards.push(selectedMutationCard(genes));
    if (type === 'demographic') cards.push(demographicHeatmapCard(genes));
    if (type === 'mutheat') cards.push(mutationHeatmapCard());
    if (type === 'degs') cards.push(degCard());
    if (type === 'volcano') cards.push(volcanoCard());
    if (type === 'cox') cards.push(coxCard(genes));
    if (type === 'km') genes.forEach(g => cards.push(kmCard(g)));
  }
  const host = document.getElementById('generated-results');
  host.innerHTML = cards.join('') || '<div class="card"><div class="empty-science">Nenhum resultado pôde ser preparado com os dados disponíveis.</div></div>';

  const rendered = [];
  if (selectedGraphs.includes('top30') && drawTop30()) rendered.push({title:'Top 30 oficial — referência R', genes:[], status:'validado contra R'});
  if (selectedGraphs.includes('selectedmut') && drawSelectedMutation(genes)) rendered.push({title:'Frequência mutacional — genes selecionados', genes, status:allGenesHaveRReference(genes)?'referência R':'misto: referência R + exploratório'});
  if (selectedGraphs.includes('demographic') && drawDemographicHeatmap(genes)) rendered.push({title:'Heatmap demográfico — genes × sexo/idade', genes});
  if (selectedGraphs.includes('mutheat') && drawMutationHeatmap()) rendered.push({title:'Oncoprint mutacional basal — Top 30', genes:[]});
  if (selectedGraphs.includes('degs') && drawDEGs()) rendered.push({title:'Top DEGs — Relapse vs None', genes:[]});
  if (selectedGraphs.includes('volcano') && drawVolcano()) rendered.push({title:'Volcano Plot — Relapse vs None', genes:[]});
  if (selectedGraphs.includes('cox') && drawCox(genes)) rendered.push({title:'Forest Plot — Cox univariado', genes:hasExactCoxRReference()?coxRReference.map(r=>r.Gene):genes, status:hasExactCoxRReference()?'referência R do professor':'exploratório local'});
  if (selectedGraphs.includes('km')) for (const g of genes) if (drawKM(g)) rendered.push({title:`Kaplan-Meier — ${g}`, genes:[g]});

  if (!redrawOnly) {
    saveHistory(rendered);
    msg('generation-msg', `${rendered.length} gráfico(s) preparado(s). O Top 30 e os valores mutacionais presentes na referência R são identificados como referência validada; Cox, KM, heatmaps e análises locais continuam exploratórios até validação específica.`, true);
  }
}

function statusHeader(extra='') {
  return `<div class="validated-result-head"><span class="quality-badge mid"><i class="fa-solid fa-flask"></i> EXPLORATÓRIO LOCAL</span><span class="study-pill">${esc(dp.pack.studyId)}</span>${extra}</div>`;
}

function validatedStatusHeader(extra='') {
  return `<div class="validated-result-head"><span class="quality-badge high"><i class="fa-solid fa-shield-heart"></i> VALIDADO CONTRA R</span><span class="study-pill">TARGET ALL</span><span class="study-pill">n=150</span>${extra}</div>`;
}

function coxRReferenceHeader(extra='') {
  return `<div class="validated-result-head"><span class="quality-badge high"><i class="fa-solid fa-shield-heart"></i> REFERÊNCIA R DO PROFESSOR</span><span class="study-pill">TARGET ALL</span><span class="study-pill">CSV original · 9 modelos</span>${extra}</div>`;
}


function top30GraphReport() {
  return graphReport({
    what: 'Ranking de frequência de mutações/alterações no TARGET ALL. A barra indica a porcentagem de amostras mutacionais em que cada gene apresentou alteração.',
    finding: 'Na referência R com n=150, NRAS foi o mais frequente (10,7%; 16/150), seguido de KRAS (5,3%; 8/150). TP53, PTPN11, JAK2 e CREBBP aparecem com 4,0%.',
    caution: 'Frequência na coorte não é risco individual, não define prognóstico sozinha e não representa uma faixa de normalidade clínica.',
    source: 'Referência validada no R',
  });
}

function selectedMutationGraphReport(rows) {
  const ordered = [...rows].sort((a,b) => b.value - a.value);
  const first = ordered[0];
  const nR = rows.filter(r => r.source === 'R').length;
  return graphReport({
    what: 'Compara a frequência mutacional apenas dos genes selecionados. Barras de referência R usam o TARGET ALL n=150; valores locais usam o denominador da coorte ativa.',
    finding: first
      ? `${first.gene} apresentou a maior frequência entre os genes selecionados (${Number(first.value).toFixed(1)}%). ${nR} de ${rows.length} valor(es) vieram diretamente da referência R.`
      : 'Não houve valores utilizáveis.',
    caution: 'Comparar frequências só é válido quando a fonte e o denominador estão identificados. O gráfico não informa efeito funcional ou risco individual.',
    source: nR === rows.length ? 'Referência R' : nR ? 'R + exploratório local' : 'Exploratório local',
  });
}

function mutationHeatmapGraphReport() {
  const genes = Object.values(dp?.mut?.basal?.byGene || {})
    .filter(x => Number.isFinite(Number(x.frequency)))
    .sort((a,b) => Number(b.frequency) - Number(a.frequency));
  const first = genes[0];
  const n = dp?.pack?.mutationSelection?.sampleIds?.length || 0;
  return graphReport({
    what: 'Oncoprint binário de alterações na seleção basal: cada linha é um gene, cada coluna é uma amostra e cada célula preenchida indica alteração detectada. Este não é o heatmap demográfico de expressão.',
    finding: `${n} amostras basais compõem este universo.${first ? ` Entre os genes exibidos, ${first.symbol} teve a maior frequência basal (${Number(first.frequency).toFixed(1)}%).` : ''}`,
    caution: 'Este heatmap usa a coorte basal deduplicada e, por isso, não deve ser confundido com o Top 30 oficial de n=150.',
    source: 'Exploratório local · basal',
  });
}

function degGraphReport() {
  const rows = analytics?.topDEGs || [];
  const first = rows[0];
  const nDeg = Number(analytics?.dea?.nDEG || rows.length || 0);
  return graphReport({
    what: 'Mostra genes diferencialmente expressos entre Relapse e None. Barras positivas indicam maior expressão relativa em Relapse e negativas, menor expressão relativa.',
    finding: `${nDeg} gene(s) passaram o critério de DEA nesta execução.${first ? ` O gene mais bem ranqueado por FDR foi ${first.gene} (log2FC ${Number(first.logFC).toFixed(3)}; FDR ${fmtP(first['adj.P.Val'])}).` : ''}`,
    caution: 'É uma DEA exploratória local. Diferença de expressão é associação entre grupos e não demonstra causalidade nem diagnostica recaída.',
    source: 'Exploratório local',
  });
}

function volcanoGraphReport() {
  const table = analytics?.dea?.table || [];
  const valid = table.filter(r => Number.isFinite(Number(r.logFC)) && Number.isFinite(Number(r['adj.P.Val'])) && Number(r['adj.P.Val']) > 0);
  const sig = valid.filter(r => Number(r['adj.P.Val']) < .05 && Math.abs(Number(r.logFC)) > .5);
  const up = sig.filter(r => Number(r.logFC) > 0).length;
  const down = sig.length - up;
  const first = [...sig].sort((a,b) => Number(a['adj.P.Val']) - Number(b['adj.P.Val']))[0];
  return graphReport({
    what: 'Volcano Plot combina tamanho do efeito (log2FC, eixo X) e significância ajustada (−log10 FDR, eixo Y). Pontos mais afastados do centro e mais altos merecem maior atenção estatística.',
    finding: `${sig.length} gene(s) passaram FDR < 0,05 e |log2FC| > 0,5: ${up} up e ${down} down.${first ? ` O menor FDR entre eles foi de ${first.gene}.` : ''}`,
    caution: 'Este Volcano é exploratório e depende do universo de genes e da transformação da coorte ativa. Não deve substituir a saída R sem validação equivalente.',
    source: 'Exploratório local',
  });
}

function coxGraphReport(rows) {
  const sigFdr = rows.filter(r => Number(r.q_value) < .05);
  const best = [...rows].sort((a,b) => Number(a.q_value) - Number(b.q_value) || Number(a.p_value) - Number(b.p_value))[0];
  return graphReport({
    what: 'Forest Plot do Cox univariado. HR abaixo de 1 representa associação com menor hazard e HR acima de 1 com maior hazard para +1 DP de expressão; o IC95% mostra a incerteza.',
    finding: `${sigFdr.length} de ${rows.length} gene(s) apresentaram FDR < 0,05 nesta execução.${best ? ` O menor FDR foi de ${best.Gene} (HR ${Number(best.HR).toFixed(3)}; IC95% ${Number(best.HR_lower).toFixed(3)}–${Number(best.HR_upper).toFixed(3)}; FDR ${fmtP(best.q_value)}).` : ''}`,
    caution: 'Modelo univariado e exploratório. Associação não implica causalidade e não fornece uma probabilidade individual de sobrevivência.',
    source: 'Exploratório local · Cox',
  });
}

function kmGraphReport(gene, survival) {
  const p = Number(survival?.logRank?.p);
  const significant = Number.isFinite(p) && p < .05;
  return graphReport({
    what: `Kaplan–Meier de Sobrevida Global para ${gene}, comparando grupos Alto e Baixo definidos pela mediana de expressão. O teste log-rank é resumido numericamente por χ² e p-value.`,
    finding: Number.isFinite(p)
      ? `${significant ? 'O log-rank detectou diferença estatisticamente significativa' : 'O log-rank não detectou diferença estatisticamente significativa'} pelo limiar de 0,05 (p=${fmtP(p)}; Alto n=${survival.nAlto}; Baixo n=${survival.nBaixo}). A direção e a magnitude da separação devem ser observadas nas próprias curvas e nos IC95%.`
      : 'O p do log-rank não ficou disponível.',
    caution: 'As curvas descrevem grupos da coorte e são sensíveis a censura, tamanho amostral e corte pela mediana. Não representam previsão individual.',
    source: 'Exploratório local · OS',
  });
}

function top30Card() {
  if (!rReference?.genes?.length) return noDataCard('Top 30 oficial — referência R','O arquivo numérico da referência R não pôde ser carregado.');
  return `<div class="card result-graph-card">${validatedStatusHeader()}<div class="card__title">Top 30 Genes Mais Mutados/Alterados</div><div class="card__subtitle">Figura oficial do projeto. Denominador mutacional: 150 amostras perfiladas. Este gráfico substitui o antigo ranking roxo de n=81.</div><div class="r-reference-box mt-4"><img id="result-top30-reference" src="${import.meta.env.BASE_URL}fig1_top30_genes_R_original.jpeg" alt="Top 30 validado contra R"></div>${top30GraphReport()}<p class="chart-note mt-3">NRAS 10,7% · KRAS 5,3% · TP53/PTPN11/JAK2/CREBBP 4,0%. Valores completos auditáveis em resultados-r.html.</p></div>`;
}

function selectedMutationCard(genes) {
  if (!genes.length) return noDataCard('Frequência mutacional — genes selecionados','Selecione pelo menos um gene.');
  const rows = selectedMutationRows(genes);
  if (!rows.length) return noDataCard('Frequência mutacional — genes selecionados','Nenhum dos genes selecionados possui frequência mutacional disponível.');
  const hasRef = rows.some(r=>r.source==='R');
  return `<div class="card result-graph-card">${hasRef?validatedStatusHeader('<span class="study-pill">valores R quando disponíveis</span>'):statusHeader()}<div class="card__title">Frequência mutacional — genes selecionados</div><div class="card__subtitle">“Valor de referência” significa a frequência observada na saída R do estudo, e não um valor clínico normal. Genes que não constam no Top 30 R são marcados como exploratórios do estudo ativo.</div><div class="single-result-canvas"><canvas id="result-selected-mut"></canvas></div>${selectedMutationGraphReport(rows)}<div id="selected-mut-meta" class="mt-4"></div></div>`;
}

function mutationHeatmapCard() {
  const basalGenes=Object.values(dp.mut?.basal?.byGene||{});
  if (!basalGenes.length || !(dp.pack?.mutationSelection?.sampleIds||[]).length) return noDataCard('Oncoprint mutacional basal — Top 30','Matriz mutacional basal não disponível.');
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">${dp.pack.mutationSelection.sampleIds.length} amostras basais</span><span class="study-pill">NÃO É O HEATMAP DEMOGRÁFICO</span>`)}<div class="card__title">Oncoprint mutacional basal — Top 30 genes</div><div class="card__subtitle">Matriz de mutações da seleção basal. Linhas = genes; colunas = amostras; célula preenchida = alteração detectada. Este gráfico permanece como análise mutacional e não corresponde ao heatmap de sexo/idade solicitado pelo professor.</div><div class="mutation-heatmap-scroll mt-4"><canvas id="result-mutheat"></canvas></div>${mutationHeatmapGraphReport()}</div>`;
}


function demographicHeatmapCard(genes) {
  const data = buildDemographicHeatmap(dp, genes, { maxGenes:20, minGroupN:5 });
  if (!data.available) return noDataCard('Heatmap demográfico — genes × sexo/idade', data.reason || 'Dados demográficos e de expressão insuficientes.');
  const groupPills = data.groups.map(g => `<span class="study-pill">${esc(g.label)} · n=${g.n}</span>`).join('');
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">PEDIDO DO PROFESSOR</span><span class="study-pill">basal por paciente</span><span class="study-pill">corte etário: mediana ${esc(data.cutoffLabel)} anos</span>`)}
    <div class="card__title">Heatmap demográfico — genes × sexo/idade</div>
    <div class="card__subtitle">Expressão média padronizada (z-score) dos genes selecionados em quatro grupos demográficos. O corte etário é a mediana da própria coorte elegível, usado apenas para visualização e <strong>não</strong> como limiar clínico.</div>
    <div class="demographic-group-pills mt-3">${groupPills}</div>
    <div id="result-demographic-heatmap" class="demographic-heatmap-wrap mt-4"></div>
    <div id="demographic-heatmap-report"></div>
  </div>`;
}

function demographicHeatmapReport(data) {
  const strongest = data?.strongest;
  const group = strongest ? data.groups.find(g => g.key === strongest.group) : null;
  const direction = strongest && Number(strongest.value) >= 0 ? 'acima' : 'abaixo';
  return graphReport({
    what: 'Resume a expressão dos genes selecionados por sexo clínico e faixa etária. Cada célula é a média do z-score de expressão do gene naquele grupo; valores positivos ficam acima da média daquele gene na coorte basal e valores negativos, abaixo.',
    finding: strongest && group
      ? `${data.eligibleN} casos basais tinham simultaneamente expressão, idade e sexo utilizáveis. O maior desvio médio absoluto foi observado em ${strongest.gene} no grupo ${group.label} (z=${Number(strongest.value).toFixed(2)}, ${direction} da média do gene).`
      : `${data?.eligibleN || 0} casos basais tinham dados demográficos e expressão utilizáveis.`,
    caution: `A idade foi dividida pela mediana da coorte (${data?.cutoffLabel || '—'} anos) somente para visualização. Este heatmap é descritivo, não testa significância entre grupos, não demonstra efeito de sexo/idade sobre o gene e não define risco individual.`,
    source: 'Exploratório local · TARGET ALL/cBioPortal',
  });
}

function drawDemographicHeatmap(genes) {
  const host = document.getElementById('result-demographic-heatmap');
  const report = document.getElementById('demographic-heatmap-report');
  if (!host || !report) return false;
  const data = buildDemographicHeatmap(dp, genes, { maxGenes:20, minGroupN:5 });
  if (!data.available) {
    host.innerHTML = `<div class="empty-science">${esc(data.reason || 'Dados insuficientes.')}</div>`;
    return false;
  }

  const head = data.groups.map(g => `<th><span>${esc(g.short)}</span><small>n=${g.n}</small></th>`).join('');
  const rows = data.rows.map(row => `<tr><th>${esc(row.gene)}</th>${row.cells.map(cell => {
    const v = Number(cell.value);
    const label = Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : '—';
    const style = Number.isFinite(v) ? `background:${heatZColor(v)};color:${Math.abs(v) > .8 ? '#fff' : '#17324d'}` : '';
    return `<td style="${style}" title="${esc(row.gene)} · ${esc(data.groups.find(g=>g.key===cell.group)?.label || cell.group)} · z=${label} · n=${cell.n}">${label}</td>`;
  }).join('')}</tr>`).join('');

  host.innerHTML = `
    <div class="demographic-heatmap-scroll">
      <table class="demographic-heatmap-table">
        <thead><tr><th>Gene</th>${head}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="demographic-heatmap-legend" aria-label="Escala de z-score">
      <span>−2</span><div class="demographic-heatmap-gradient"></div><span>0</span><div class="demographic-heatmap-gradient positive"></div><span>+2</span>
      <small>Expressão média padronizada (z-score)</small>
    </div>`;
  report.innerHTML = demographicHeatmapReport(data);
  return true;
}

function heatZColor(value) {
  const v = Math.max(-2, Math.min(2, Number(value) || 0));
  const white = [247,247,247], blue=[33,102,172], red=[214,96,77];
  const target = v < 0 ? blue : red;
  const t = Math.abs(v) / 2;
  const rgb = white.map((x,i)=>Math.round(x + (target[i]-x)*t));
  return `rgb(${rgb.join(',')})`;
}

function degCard() {
  if (dp.pack.scope!=='completo') return noDataCard('Top DEGs — Relapse vs None','Bloqueado no modo Expresso: um painel parcial altera o universo de testes e o FDR. Reconstrua o estudo em escopo Completo.');
  if (!analytics.topDEGs?.length) return noDataCard('Top DEGs — Relapse vs None','Dados insuficientes para DEA significativa nesta coorte.');
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">Relapse ${analytics.dea.n1||0} vs None ${analytics.dea.n0||0}</span><span class="study-pill">escopo completo</span>`)}<div class="card__title">Top DEGs — Relapse vs None</div><div class="card__subtitle">DEA local aproximada em log2(expressão+1). O resultado só recebe selo R após comparação com a tabela limma corrigida.</div><div class="single-result-canvas"><canvas id="result-degs"></canvas></div>${degGraphReport()}</div>`;
}

function volcanoCard() {
  if (dp.pack.scope!=='completo') return noDataCard('Volcano Plot','Bloqueado no modo Expresso: o painel parcial não reproduz o universo transcriptômico usado pelo R e altera o FDR.');
  if (!(analytics.dea?.table||[]).length) return noDataCard('Volcano Plot','DEA não disponível nesta coorte.');
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">${esc(dp.pack.expressionTransform?.label||'escala não informada')}</span><span class="study-pill">escopo completo</span>`)}<div class="card__title">Volcano Plot — Relapse vs None</div><div class="card__subtitle">FDR &lt; 0,05 e |log2FC| &gt; 0,5. Esta é uma reprodução exploratória local; para equivalência científica, compare com a saída do Script.R corrigido (limma-trend).</div><div class="single-result-canvas"><canvas id="result-volcano"></canvas></div>${volcanoGraphReport()}</div>`;
}

function coxCard(genes) {
  if (hasExactCoxRReference()) {
    const refGenes=coxRReference.map(r=>r.Gene);
    return `<div class="card result-graph-card">${coxRReferenceHeader(`<span class="study-pill">genes: ${refGenes.map(esc).join(', ')}</span><span class="study-pill">OS · OS_MONTHS</span>`)}<div class="card__title">Forest Plot — Cox univariado</div><div class="card__subtitle">Reprodução da referência do professor. Os pontos, intervalos e p-values abaixo são lidos diretamente de <strong>cox_univariado_top10_genes.csv</strong>; por isso este modo não substitui NOTCH2 por TAS2R19 nem recalcula o conjunto de genes a partir do Top 30 mutacional.</div><div class="single-result-canvas"><canvas id="result-cox"></canvas></div><div id="cox-graph-report"></div><div id="cox-meta" class="mt-4"></div><details class="r-reference-box mt-4"><summary><strong>Comparar com a figura R original</strong></summary><img src="${import.meta.env.BASE_URL}data/r_validated/fig7_forest_cox.png" alt="Forest Plot Cox univariado original fornecido pelo professor"></details></div>`;
  }
  const ctx=survivalContextFor(genes);
  const available = ctx.genes;
  const v=ctx.v;
  if (!available.length || !v.endpointAdequate) return noDataCard('Forest Plot — Cox univariado','Endpoint/expressão insuficientes: são necessários pelo menos 20 registros válidos e 5 eventos, além de expressão para o(s) gene(s) selecionado(s).');
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">genes: ${available.map(esc).join(', ')}</span><span class="study-pill">${esc(v.endpointKey)} · ${esc(v.endpointTimeColumn||'tempo?')}</span>`)}<div class="card__title">Forest Plot — Cox univariado</div><div class="card__subtitle">Exploratório local no modo Basal por paciente. Somente os genes escolhidos são recalculados; HR por +1 DP de expressão, com IC95% e p locais. O FDR é corrigido apenas dentro dos genes selecionados nesta execução e o teste cox.zph do R ainda é necessário antes de validar.</div><div class="single-result-canvas"><canvas id="result-cox"></canvas></div><div id="cox-graph-report"></div><div id="cox-meta" class="mt-4"></div></div>`;
}

function kmCard(gene) {
  const ctx=survivalContextFor([gene]);
  const row = ctx.rows[gene];
  const v = ctx.v;
  if (!row || !v.endpointAdequate) return noDataCard(`Kaplan-Meier — ${gene}`,`${gene} não possui expressão alinhada com um endpoint adequado (mínimo 20 registros e 5 eventos) no estudo ativo.`);
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">${esc(v.endpointLabel||'sobrevida')}</span><span class="study-pill">${esc(v.endpointTimeColumn||'tempo?')}</span><span class="study-pill">gene ${esc(gene)}</span>`)}<div class="card__title">Kaplan-Meier — ${esc(gene)}</div><div class="card__subtitle">Grupos Alto/Baixo definidos pela mediana de expressão na coorte do modo escolhido. A faixa translúcida representa o IC95% log-log/Greenwood. Curva de grupos de referência, não previsão individual.</div><div class="single-result-canvas"><canvas id="result-km-${safeId(gene)}"></canvas></div><div id="km-graph-report-${safeId(gene)}"></div><div id="km-meta-${safeId(gene)}" class="mt-3"></div></div>`;
}

function noDataCard(title, note) {
  return `<div class="card result-graph-card">${statusHeader()}<div class="card__title">${esc(title)}</div><div class="empty-science mt-4">${esc(note)}</div></div>`;
}

function rReferenceMap() {
  return new Map((rReference?.genes||[]).map(r=>[String(r.gene).toUpperCase(), Number(r.frequency_pct)]));
}

function allGenesHaveRReference(genes) {
  if (dp?.pack?.studyId !== DEFAULT_LLA_STUDY || !genes.length) return false;
  const ref=rReferenceMap();
  return genes.every(g=>ref.has(String(g).toUpperCase()));
}

function selectedMutationRows(genes) {
  const ref=rReferenceMap();
  return genes.map(g=>{
    const gene=String(g).toUpperCase();
    if(dp?.pack?.studyId===DEFAULT_LLA_STUDY && ref.has(gene)){
      return {gene,value:ref.get(gene),source:'R',n:150,count:Math.round(ref.get(gene)*1.5)};
    }
    const local=dp?.mut?.byGene?.[gene];
    if(local && Number.isFinite(Number(local.frequency))){
      return {gene,value:Number(local.frequency),source:'LOCAL',n:Number(dp.mut?.totalSamples||dp.pack?.nMutationSamples||0),count:Number(local.count||0)};
    }
    return null;
  }).filter(Boolean);
}

function drawTop30() {
  return !!document.getElementById('result-top30-reference');
}

function drawSelectedMutation(genes) {
  const el=document.getElementById('result-selected-mut'); if(!el) return false;
  const rows=selectedMutationRows(genes); if(!rows.length) return false;
  const t=getChartTheme();
  const d=[...rows].sort((a,b)=>a.value-b.value);
  const colors=d.map(r=>r.source==='R'?'rgba(215,48,31,.88)':'rgba(79,94,120,.72)');
  charts.push(new Chart(el,{
    type:'bar',
    data:{labels:d.map(r=>r.gene),datasets:[{label:'Frequência (%)',data:d.map(r=>r.value),backgroundColor:colors,borderColor:d.map(r=>r.source==='R'?'#a61f16':'#43506a'),borderWidth:1}]},
    options:{
      responsive:true,maintainAspectRatio:false,indexAxis:'y',animation:false,
      layout:{padding:{right:44}},
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{
          label:c=>`${Number(c.raw).toFixed(1)}%`,
          afterLabel:c=>{
            const r=d[c.dataIndex];
            return r.source==='R'?`Referência R · n=150`:`Exploratório local · n=${r.n} · ${r.count} amostra(s) alterada(s)`;
          }
        }}
      },
      scales:{
        x:{beginAtZero:true,suggestedMax:Math.max(12,Math.max(...d.map(r=>r.value))*1.2),ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'Frequência de mutação (%)',color:t.text}},
        y:{ticks:{color:t.text},grid:{display:false}}
      }
    },
    plugins:[barValueLabels(d)]
  }));
  const meta=document.getElementById('selected-mut-meta');
  if(meta) meta.innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>Gene</th><th>Frequência</th><th>Fonte</th><th>Denominador</th></tr></thead><tbody>${d.slice().reverse().map(r=>`<tr><td><strong>${esc(r.gene)}</strong></td><td>${r.value.toFixed(1)}%</td><td>${r.source==='R'?'<span class="match-pill"><i class="fa-solid fa-circle-check"></i> Referência R</span>':'Exploratório local'}</td><td>${r.source==='R'?'n=150':`n=${r.n}`}</td></tr>`).join('')}</tbody></table></div><p class="chart-note mt-3">O termo “referência” descreve a frequência observada no conjunto TARGET ALL usado pelo R. Não representa faixa de normalidade biológica nem valor individual de paciente.</p>`;
  return true;
}

function drawMutationHeatmap() {
  const canvas = document.getElementById('result-mutheat'); if (!canvas) return false;
  const genes = Object.values(dp.mut?.basal?.byGene||{}).filter(x=>Number.isFinite(Number(x.frequency))).sort((a,b)=>b.frequency-a.frequency||b.count-a.count).slice(0,30);
  const allSamples=(dp.pack?.mutationSelection?.sampleIds||[]).slice(); if (!genes.length||!allSamples.length) return false;
  const geneSets=genes.map(g=>({gene:g.symbol,freq:g.frequency,set:new Set(g.samples||[])}));
  const burden=new Map(allSamples.map(s=>[s,0])); for(const g of geneSets) for(const sid of g.set) if(burden.has(sid)) burden.set(sid,(burden.get(sid)||0)+1);
  const samples=[...allSamples].sort((a,b)=>(burden.get(b)||0)-(burden.get(a)||0)).slice(0,90);
  const rowH=22,colW=Math.max(7,Math.min(12,Math.floor(760/Math.max(1,samples.length)))),labelW=116,rightW=72,topH=34,bottomH=20;
  canvas.width=labelW+samples.length*colW+rightW; canvas.height=topH+geneSets.length*rowH+bottomH; canvas.style.width=`${canvas.width}px`; canvas.style.height=`${canvas.height}px`;
  const ctx=canvas.getContext('2d'),t=getChartTheme(); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.font='11px sans-serif'; ctx.textBaseline='middle';
  geneSets.forEach((g,r)=>{const y=topH+r*rowH;ctx.fillStyle=t.text;ctx.fillText(g.gene,4,y+rowH/2);for(let c=0;c<samples.length;c++){const x=labelW+c*colW;ctx.fillStyle=g.set.has(samples[c])?'#d7301f':'rgba(130,140,160,.14)';ctx.fillRect(x+1,y+2,colW-2,rowH-4);}ctx.fillStyle=t.muted;ctx.fillText(`${Number(g.freq||0).toFixed(1)}%`,labelW+samples.length*colW+8,y+rowH/2);});
  ctx.fillStyle=t.muted;ctx.font='10px sans-serif';ctx.fillText(`${samples.length}/${allSamples.length} amostras basais exibidas`,labelW,15);
  return true;
}

function drawDEGs() {
  if(dp.pack.scope!=='completo') return false;
  const el=document.getElementById('result-degs'); if(!el) return false; const d=[...analytics.topDEGs].slice(0,15).sort((a,b)=>a.logFC-b.logFC); const t=getChartTheme();
  charts.push(new Chart(el,{type:'bar',data:{labels:d.map(x=>x.gene),datasets:[{data:d.map(x=>x.logFC),backgroundColor:d.map(x=>x.logFC>0?'rgba(231,76,60,.78)':'rgba(46,127,240,.78)')}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`log2FC=${Number(c.raw).toFixed(4)}`,afterLabel:c=>`FDR=${fmtP(d[c.dataIndex]['adj.P.Val'])}`}}},scales:{x:{ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'log2 Fold Change (Relapse − None)',color:t.text}},y:{ticks:{color:t.text},grid:{display:false}}}}})); return true;
}

function drawVolcano() {
  if(dp.pack.scope!=='completo') return false;
  const el=document.getElementById('result-volcano'); if(!el) return false; const pts=volcanoPoints(analytics.dea),ns=pts.filter(x=>!x.significant),up=pts.filter(x=>x.significant&&x.x>0),down=pts.filter(x=>x.significant&&x.x<0),t=getChartTheme();
  charts.push(new Chart(el,{type:'scatter',data:{datasets:[{label:'NS',data:ns,backgroundColor:'rgba(133,144,168,.48)',pointRadius:2},{label:'Up',data:up,backgroundColor:'rgba(231,76,60,.78)',pointRadius:3},{label:'Down',data:down,backgroundColor:'rgba(46,127,240,.78)',pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,parsing:false,animation:false,plugins:{legend:{labels:{color:t.text}},tooltip:{callbacks:{label:c=>`${c.raw.gene}: log2FC=${c.raw.x.toFixed(4)} · FDR=${fmtP(c.raw.adjP)}`}}},scales:{x:{ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'log2 Fold Change',color:t.text}},y:{ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'−log10(FDR)',color:t.text}}}},plugins:[thresholdPlugin(.5,-Math.log10(.05))]})); return true;
}


function drawExactCoxRReference(el) {
  const d=[...coxRReference].filter(r=>r.HR>0&&r.HR_lower>0&&r.HR_upper>0).sort((a,b)=>a.HR-b.HR);
  if(!d.length)return false;
  const t=getChartTheme();
  const points=d.map((r,i)=>({x:r.HR,y:i,gene:r.Gene,lo:r.HR_lower,hi:r.HR_upper,p:r.p_value}));
  charts.push(new Chart(el,{
    type:'scatter',
    data:{datasets:[{
      data:points,
      backgroundColor:points.map(p=>p.x>1?'#00BFC4':'#F8766D'),
      borderColor:points.map(p=>p.x>1?'#00BFC4':'#F8766D'),
      pointRadius:7,
      pointHoverRadius:8
    }]},
    options:{
      responsive:true,maintainAspectRatio:false,parsing:false,animation:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{
          label:c=>`${c.raw.gene}: HR=${c.raw.x.toFixed(3)} · IC95% ${c.raw.lo.toFixed(3)}–${c.raw.hi.toFixed(3)}`,
          afterLabel:c=>`p=${Number(c.raw.p).toFixed(4)}`
        }}
      },
      scales:{
        x:{type:'linear',min:Math.max(0,Math.min(...points.map(p=>p.lo))-.08),max:Math.max(...points.map(p=>p.hi))+.08,ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'Hazard Ratio (IC 95%)',color:t.text}},
        y:{min:-.5,max:d.length-.5,ticks:{color:t.text,stepSize:1,callback:v=>Number.isInteger(v)&&d[v]?d[v].Gene:''},grid:{display:false}}
      }
    },
    plugins:[forestCIReferencePlugin()]
  }));
  const coxReport=document.getElementById('cox-graph-report');
  const sig=d.filter(r=>r.p_value<.05);
  if(coxReport) coxReport.innerHTML=graphReport({
    title:'Leitura do Forest Plot — referência R',
    what:'Cada ponto é o Hazard Ratio do modelo Cox univariado fornecido no CSV do professor; a barra horizontal é o IC95% e a linha tracejada marca HR = 1.',
    finding:`${sig.length} de ${d.length} modelos têm p < 0,05 no CSV de referência. NOTCH2 está presente (HR 1,518; IC95% 1,248–1,845) e TAS2R19 não pertence a esta tabela de Cox.`,
    caution:'Este cartão exibe a saída de referência fornecida. Não deve ser confundido com o recálculo exploratório local a partir dos genes selecionados.'
  });
  const meta=document.getElementById('cox-meta');
  if(meta) meta.innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>Gene</th><th>HR</th><th>IC95%</th><th>p</th><th>Significância</th></tr></thead><tbody>${d.slice().reverse().map(r=>`<tr><td><strong>${esc(r.Gene)}</strong></td><td>${r.HR.toFixed(3)}</td><td>${r.HR_lower.toFixed(3)}–${r.HR_upper.toFixed(3)}</td><td>${Number(r.p_value).toFixed(4)}</td><td>${r.p_value<.05?'p < 0,05':'—'}</td></tr>`).join('')}</tbody></table></div><p class="chart-note mt-3">Fonte: cox_univariado_top10_genes.csv fornecido nesta revisão. O arquivo contém 9 modelos. A ordem visual é determinada pelo HR, como no Forest Plot R enviado pelo professor.</p>`;
  return true;
}

function forestCIReferencePlugin(){
  return{id:'genesisForestCIReference',beforeDatasetsDraw(chart){
    const ds=chart.data.datasets[0],meta=chart.getDatasetMeta(0),x=chart.scales.x,ctx=chart.ctx;
    ctx.save();ctx.strokeStyle='#1f1f1f';ctx.lineWidth=2;
    ds.data.forEach((p,i)=>{const el=meta.data[i];if(!el||!Number.isFinite(p.lo)||!Number.isFinite(p.hi))return;const y=el.y,x1=x.getPixelForValue(p.lo),x2=x.getPixelForValue(p.hi);ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();ctx.beginPath();ctx.moveTo(x1,y-6);ctx.lineTo(x1,y+6);ctx.moveTo(x2,y-6);ctx.lineTo(x2,y+6);ctx.stroke();});
    const one=x.getPixelForValue(1);ctx.setLineDash([7,7]);ctx.strokeStyle=tickReferenceColor();ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(one,chart.chartArea.top);ctx.lineTo(one,chart.chartArea.bottom);ctx.stroke();ctx.restore();
  }};
}
function tickReferenceColor(){return getChartTheme().muted||'#555';}

function drawCox(genes) {
  const el=document.getElementById('result-cox'); if(!el) return false;
  if (hasExactCoxRReference()) return drawExactCoxRReference(el);
  const x=survivalContextFor(genes),v=x.v; if(!x.genes.length||!v.endpointAdequate) return false;
  let d=coxUnivariate(v.time,v.event,x.genes,x.rows).filter(r=>Number.isFinite(r.HR)&&r.HR>0&&r.HR_lower>0&&r.HR_upper>0);
  if(!d.length){
    if(el.parentElement)el.parentElement.innerHTML='<div class="empty-science">Nenhum gene passou os mínimos do Cox nesta execução (≥20 casos completos, ≥5 eventos, expressão variável e convergência).</div>';
    const meta=document.getElementById('cox-meta');if(meta)meta.innerHTML='<div class="alert warning"><i class="fa-solid fa-triangle-exclamation"></i> O gráfico não foi gerado porque nenhum gene selecionado produziu um modelo Cox utilizável.</div>';
    return false;
  }
  const q=bhFdr(d.map(r=>r.p_value)); d.forEach((r,i)=>r.q_value=q[i]); d=d.sort((a,b)=>a.HR-b.HR);
  const points=d.map((r,i)=>({x:r.HR,y:i,gene:r.Gene,lo:r.HR_lower,hi:r.HR_upper,p:r.p_value,q:r.q_value,n:r.n,events:r.nEvents})),t=getChartTheme();
  charts.push(new Chart(el,{type:'scatter',data:{datasets:[{data:points,backgroundColor:points.map(p=>p.q<.05?(p.x>1?'#e74c3c':'#2e7ff0'):'#8590a8'),pointRadius:7}]},options:{responsive:true,maintainAspectRatio:false,parsing:false,animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw.gene}: HR=${c.raw.x.toFixed(3)} · IC95% ${c.raw.lo.toFixed(3)}–${c.raw.hi.toFixed(3)}`,afterLabel:c=>`p=${fmtP(c.raw.p)} · FDR=${fmtP(c.raw.q)} · eventos=${c.raw.events}/${c.raw.n}`}}},scales:{x:{type:'logarithmic',min:Math.max(.05,Math.min(...points.map(p=>p.lo))*.8),max:Math.max(2,Math.max(...points.map(p=>p.hi))*1.2),ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'Hazard Ratio (escala log)',color:t.text}},y:{min:-1,max:d.length,ticks:{color:t.text,callback:v=>Number.isInteger(v)&&d[v]?d[v].Gene:''},grid:{display:false}}}},plugins:[forestCIPlugin()]}));
  const coxReport=document.getElementById('cox-graph-report');
  if(coxReport) coxReport.innerHTML=coxGraphReport(d);
  const meta=document.getElementById('cox-meta');
  if(meta){
    const requested=new Set(genes);
    const modeled=new Set(d.map(r=>r.Gene));
    const skipped=[...requested].filter(g=>!modeled.has(g));
    meta.innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>Gene</th><th>HR (+1 DP)</th><th>IC95%</th><th>p</th><th>FDR BH</th><th>N</th><th>Eventos</th></tr></thead><tbody>${d.map(r=>`<tr><td><strong>${esc(r.Gene)}</strong></td><td>${r.HR.toFixed(4)}</td><td>${r.HR_lower.toFixed(4)}–${r.HR_upper.toFixed(4)}</td><td>${fmtP(r.p_value)}</td><td>${fmtP(r.q_value)}</td><td>${r.n}</td><td>${r.nEvents}</td></tr>`).join('')}</tbody></table></div>${skipped.length?`<div class="alert warning mt-3"><i class="fa-solid fa-triangle-exclamation"></i> Sem Cox utilizável nesta execução: ${skipped.map(esc).join(', ')}. Cada gene exige ≥20 casos completos, ≥5 eventos, variância de expressão e convergência.</div>`:''}<p class="chart-note mt-3">KM e Cox filtram, para cada gene, o mesmo conjunto de casos completos de OS + expressão. Assim, o N do gene é comparável entre os dois módulos.</p>`;
  }
  return true;
}

function drawKM(gene) {
  const el=document.getElementById(`result-km-${safeId(gene)}`); if(!el) return false;
  const x=survivalContextFor([gene]),v=x.v,row=x.rows[gene]; if(!row||!v.endpointAdequate) return false;
  const s=analyzeSurvival(v.time,v.event,row.values);
  if(!s||!s.km?.length){
    if(el.parentElement)el.parentElement.innerHTML='<div class="empty-science">Kaplan-Meier não gerado: este gene não atingiu ≥20 casos completos, ≥5 eventos e ≥5 observações em cada grupo definido pela mediana.</div>';
    const meta=document.getElementById(`km-meta-${safeId(gene)}`);if(meta)meta.innerHTML='<div class="alert warning"><i class="fa-solid fa-triangle-exclamation"></i> Dados insuficientes para uma curva Kaplan-Meier protegida neste gene.</div>';
    return false;
  }
  const t=getChartTheme(),palette={Alto:'#c0392b',Baixo:'#2980b9'},band={Alto:'rgba(192,57,43,.14)',Baixo:'rgba(41,128,185,.14)'};
  const datasets=[];
  for(const g of s.km){
    datasets.push({
      type:'line',label:`IC95% ${g.name} inferior`,
      data:g.times.map((xx,i)=>({x:xx,y:g.ciLo[i]})),
      borderColor:'transparent',backgroundColor:'transparent',
      stepped:true,pointRadius:0,borderWidth:0
    });
    datasets.push({
      type:'line',label:`IC95% ${g.name}`,
      data:g.times.map((xx,i)=>({x:xx,y:g.ciHi[i]})),
      borderColor:'transparent',backgroundColor:band[g.name]||'rgba(120,130,150,.12)',
      fill:'-1',stepped:true,pointRadius:0,borderWidth:0
    });
    datasets.push({
      type:'line',label:`${g.name} (n=${g.n})`,
      data:g.times.map((xx,i)=>({x:xx,y:g.surv[i]})),
      borderColor:palette[g.name]||t.primary,backgroundColor:'transparent',
      stepped:true,pointRadius:0,borderWidth:2.5
    });
    if(g.censorTimes?.length){
      datasets.push({
        type:'scatter',label:`Censura ${g.name}`,
        data:g.censorTimes.map((xx,i)=>({x:xx,y:g.censorSurv[i]})),
        borderColor:palette[g.name]||t.primary,backgroundColor:palette[g.name]||t.primary,
        pointStyle:'cross',pointRadius:4,pointHoverRadius:5,showLine:false
      });
    }
  }
  charts.push(new Chart(el,{
    type:'line',data:{datasets},
    options:{
      responsive:true,maintainAspectRatio:false,parsing:false,animation:false,
      plugins:{
        legend:{labels:{color:t.text,filter:item=>!String(item.text).startsWith('Censura')&&!String(item.text).startsWith('IC95%')}},
        tooltip:{filter:item=>!String(item.dataset.label).startsWith('IC95%'),callbacks:{label:c=>String(c.dataset.label).startsWith('Censura')?`Censura · t=${Number(c.raw.x).toFixed(2)} meses`:`${c.dataset.label}: S(t)=${Number(c.raw.y).toFixed(3)}`}}
      },
      scales:{
        x:{type:'linear',ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'Tempo (meses)',color:t.text}},
        y:{min:0,max:1,ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'Probabilidade de sobrevida do grupo',color:t.text}}
      }
    }
  }));

  // O gráfico auxiliar observado × esperado foi removido da interface a pedido do orientador.
  // As quantidades O/E continuam preservadas no JSON do log-rank para auditoria estatística.

  const maxTime=Math.max(...s.km.flatMap(g=>g.obs.map(o=>o.t)).filter(Number.isFinite),0);
  const riskTimes=niceRiskTimes(maxTime);
  const riskRows=s.km.map(g=>({name:g.name,vals:atRiskAt(g,riskTimes)}));
  const riskTable=`<div class="km-risk-wrap"><strong>Número em risco</strong><div class="table-wrap"><table class="data-table km-risk-table"><thead><tr><th>Grupo</th>${riskTimes.map(x=>`<th>${fmtTime(x)} m</th>`).join('')}</tr></thead><tbody>${riskRows.map(r=>`<tr><td>${esc(r.name)}</td>${r.vals.map(n=>`<td>${n}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  const kmReport=document.getElementById(`km-graph-report-${safeId(gene)}`);
  if(kmReport) kmReport.innerHTML=kmGraphReport(gene,s);
  const meta=document.getElementById(`km-meta-${safeId(gene)}`);
  if(meta){
    meta.innerHTML=`<div class="validation-strip"><div><span>Gene</span><strong>${esc(gene)}</strong></div><div><span>Corte de expressão</span><strong>mediana = ${Number(s.medianCut).toFixed(4)}</strong></div><div><span>Grupos</span><strong>Alto n=${s.nAlto} · Baixo n=${s.nBaixo}</strong></div><div><span>Log-rank</span><strong>χ²=${Number(s.logRank?.chi2||0).toFixed(4)} · p=${fmtP(s.logRank?.p)}</strong></div><div><span>Endpoint</span><strong>${esc(v.endpointKey)} · ${esc(v.endpointTimeColumn||'—')}</strong></div><div><span>Modo</span><strong>${esc(x.modeLabel||'Basal por paciente')}</strong></div><div><span>Eventos</span><strong>${s.events}/${s.n}</strong></div></div>${riskTable}<div class="flex gap-2 mt-3" style="flex-wrap:wrap"><button class="btn btn-secondary btn-sm" id="km-json-${safeId(gene)}"><i class="fa-solid fa-file-code"></i> Baixar dados KM em JSON</button></div><p class="chart-note mt-3">IC95%: transformação log-log com variância de Greenwood. O log-rank permanece calculado e é apresentado por χ² e p-value; o gráfico auxiliar de eventos observados × esperados foi removido. KM e Cox usam o mesmo conjunto de casos completos por gene (OS + expressão). ${x.mode==='r'?'No modo compatível com referência R, n representa observações de amostras de expressão alinhadas ao clínico e pode incluir mais de uma amostra do mesmo paciente; a equivalência integral com a saída R original só pode ser afirmada após comparação numérica usando a matriz bruta correspondente.':'No modo Basal por paciente, n representa a seleção deduplicada de uma amostra por paciente.'} O selo “validado contra R” só é permitido depois da comparação numérica com a saída R correspondente.</p>`;
    const btn=document.getElementById(`km-json-${safeId(gene)}`);
    if(btn)btn.onclick=()=>downloadJson(`GENESIS_KM_${safeId(gene)}_${safeId(dp.pack.studyId)}.json`,{
      schema:'GENESIS_KM_V10_3',generatedAt:new Date().toISOString(),studyId:dp.pack.studyId,studyName:dp.pack.studyName,gene,
      endpoint:{key:v.endpointKey,label:v.endpointLabel,timeColumn:v.endpointTimeColumn,eventColumn:v.endpointEventColumn,policy:v.endpointPolicy},
      medianCut:s.medianCut,n:s.n,events:s.events,nAlto:s.nAlto,nBaixo:s.nBaixo,
      logRank:{chi2:s.logRank?.chi2,df:s.logRank?.df,p:s.logRank?.p,labels:s.logRank?.labels,O:s.logRank?.O,E:s.logRank?.E},
      groups:s.km.map(g=>({name:g.name,n:g.n,nEvents:g.nEvents,nCensor:g.nCensor,times:g.times,survival:g.surv,ci95Low:g.ciLo,ci95High:g.ciHi,nRisk:g.nRisk,censorTimes:g.censorTimes,censorSurvival:g.censorSurv}))
    });
  }
  return true;
}

function niceRiskTimes(maxTime){
  if(!Number.isFinite(maxTime)||maxTime<=0)return[0];
  const digits=maxTime<10?1:0;
  return [...new Set([0,.25,.5,.75,1].map(f=>Number((maxTime*f).toFixed(digits))))].sort((a,b)=>a-b);
}
function fmtTime(x){return Number.isInteger(x)?String(x):Number(x).toFixed(1);}
function downloadJson(filename,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
}

function selectedSurvivalMode(){
  const requested=document.querySelector('input[name="survival-mode"]:checked')?.value;
  if(requested==='r'&&(dp.rSampleIds||[]).length&&(dp.exprR||[]).length)return'r';
  return'basal';
}

function survivalContextFor(genes){
  const mode=selectedSurvivalMode(),rows={},available=[];
  if(mode==='r'){
    const v=buildRCompatibleReferenceVectors(dp);
    for(const gene of genes){
      const info=rCompatibleExpressionValues(dp,gene);if(!info)continue;
      const values=v.sampleIndices.map(i=>Number.isInteger(i)?info.values[i]:NaN);
      rows[gene]={values,medianImputation:info.medianImputation};available.push(gene);
    }
    return{v,rows,genes:available,mode:'r',modeLabel:'Modo compatível com referência R'};
  }
  const v=buildReferenceVectors(dp),map=new Map((dp.expr||[]).map(r=>[String(r.symbol).toUpperCase(),r]));
  for(const gene of genes){const src=map.get(gene);if(!src)continue;const values=v.sampleIndices.map(i=>Number.isInteger(i)?transformExpressionValue(src.values?.[i],dp.pack):NaN);rows[gene]={values};available.push(gene);}
  return{v,rows,genes:available,mode:'basal',modeLabel:'Basal por paciente'};
}

function expressionRowsFor(genes) {
  const v=buildReferenceVectors(dp),map=new Map((dp.expr||[]).map(r=>[String(r.symbol).toUpperCase(),r])),rows={},available=[];
  for(const gene of genes){const src=map.get(gene); if(!src) continue; const values=v.sampleIndices.map(i=>Number.isInteger(i)?transformExpressionValue(src.values?.[i],dp.pack):NaN); rows[gene]={values}; available.push(gene);}
  return {rows,genes:available};
}

function saveHistory(items) {
  if (!items.length) return;
  let history=[]; try{history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{}
  const now=new Date().toISOString();
  for(const x of items) history.unshift({id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,title:x.title,genes:x.genes,studyId:dp.pack.studyId,studyName:dp.pack.studyName,status:x.status||'exploratório local',createdAt:now});
  localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(0,100)));
}

function destroyCharts(){charts.forEach(c=>{try{c.destroy()}catch{}});charts=[];}
function barValueLabels(rows){
  return{id:'genesisBarValueLabels',afterDatasetsDraw(chart){
    const meta=chart.getDatasetMeta(0),ctx=chart.ctx,x=chart.scales.x;
    ctx.save();ctx.font='600 11px sans-serif';ctx.textBaseline='middle';ctx.fillStyle=getChartTheme().text;
    meta.data.forEach((bar,i)=>{
      const v=Number(rows[i]?.value);
      if(!Number.isFinite(v)||!bar)return;
      const px=Math.min(x.right-2,bar.x+7);
      ctx.textAlign=px>x.right-36?'right':'left';
      ctx.fillText(`${v.toFixed(1)}%`,px>x.right-36?x.right-3:px,bar.y);
    });
    ctx.restore();
  }};
}
function thresholdPlugin(xCut,yCut){return{id:'genesisThresholds',afterDraw(chart){const{x,y}=chart.scales,ctx=chart.ctx;ctx.save();ctx.setLineDash([5,5]);ctx.strokeStyle='rgba(130,140,160,.7)';ctx.lineWidth=1;for(const v of[-xCut,xCut]){const px=x.getPixelForValue(v);ctx.beginPath();ctx.moveTo(px,y.top);ctx.lineTo(px,y.bottom);ctx.stroke();}const py=y.getPixelForValue(yCut);ctx.beginPath();ctx.moveTo(x.left,py);ctx.lineTo(x.right,py);ctx.stroke();ctx.restore();}}}
function forestCIPlugin(){return{id:'genesisForestCI',beforeDatasetsDraw(chart){const ds=chart.data.datasets[0],meta=chart.getDatasetMeta(0),x=chart.scales.x,ctx=chart.ctx;ctx.save();ctx.strokeStyle='rgba(130,140,160,.9)';ctx.lineWidth=2;ds.data.forEach((p,i)=>{const el=meta.data[i];if(!el||!Number.isFinite(p.lo)||!Number.isFinite(p.hi))return;const y=el.y,x1=x.getPixelForValue(p.lo),x2=x.getPixelForValue(p.hi);ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();ctx.beginPath();ctx.moveTo(x1,y-4);ctx.lineTo(x1,y+4);ctx.moveTo(x2,y-4);ctx.lineTo(x2,y+4);ctx.stroke();});const one=x.getPixelForValue(1);ctx.setLineDash([5,4]);ctx.strokeStyle='rgba(110,120,140,.8)';ctx.beginPath();ctx.moveTo(one,chart.chartArea.top);ctx.lineTo(one,chart.chartArea.bottom);ctx.stroke();ctx.restore();}}}
function msg(id,text,ok){const el=document.getElementById(id);if(el)el.innerHTML=`<div class="alert ${ok?'success':'warning'}"><i class="fa-solid ${ok?'fa-circle-check':'fa-triangle-exclamation'}"></i> ${esc(text)}</div>`;}
function safeId(s){return String(s).replace(/[^A-Za-z0-9_-]/g,'_');}
function fmtP(x){const v=Number(x);if(!Number.isFinite(v))return'—';return v<.001?v.toExponential(2):v.toFixed(4);}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
