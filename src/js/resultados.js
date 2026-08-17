import '../css/genesis.css';
import { mountLayout, injectFontAwesome, warningBanner, getChartTheme } from './common.js';
import { renderStudyManager } from './study-ui.js';
import { DEFAULT_LLA_STUDY } from './cbio-api.js';
import { loadDatapack } from './datapack.js';
import { buildStudyAnalytics, volcanoPoints } from './research-analytics.js';
import { buildReferenceVectors, buildRCompatibleReferenceVectors, rCompatibleExpressionValues, transformExpressionValue } from './analysis-engine.js';
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
    <div><strong>Cox</strong><span>10 uni · 9 multi</span></div>
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
      <div class="cohort-warning"><strong>Política de denominador:</strong> Top 30 usa o case list mutacional completo. Para KM/Cox você pode usar <b>Compatibilidade R</b> (mesmo universo de amostras de expressão do Script.R) ou <b>Basal por paciente</b>. No TARGET ALL, Compatibilidade R é o padrão para reproduzir 46/46 quando houver 92 observações válidas.</div>
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
      <div><strong>Genes escolhidos?</strong><small>Gera imediatamente a frequência mutacional de referência e, quando houver dados suficientes, Cox e Kaplan–Meier.</small></div>
      <button class="btn btn-primary btn-lg" id="generate-gene-graphs"><i class="fa-solid fa-chart-line"></i> Gerar gráficos</button>
    </div>
  </div>

  <div class="card mt-6">
    <div class="section-route"><span>3</span><div><strong>Escolher quais gráficos gerar</strong><small>Nenhum gráfico é executado automaticamente. O usuário solicita somente o que quer visualizar.</small></div></div>
    <div class="survival-mode-box mt-4">
      <div><strong>Modo de sobrevida (KM/Cox)</strong><small>No TARGET ALL, use Compatibilidade R para reproduzir o pipeline do professor. O modo basal permanece disponível para a análise deduplicada por paciente.</small></div>
      <label><input type="radio" name="survival-mode" value="r" ${p.studyId===DEFAULT_LLA_STUDY?'checked':''} ${!(p.nRCompatibleSamples||p.nRnaSamples)?'disabled':''}> <span><b>Compatibilidade R</b><small>Todas as amostras de expressão alinhadas ao clínico; NA de expressão imputado pela mediana do gene antes do KM/Cox.</small></span></label>
      <label><input type="radio" name="survival-mode" value="basal" ${p.studyId!==DEFAULT_LLA_STUDY?'checked':''}> <span><b>Basal por paciente</b><small>Uma amostra primária por paciente; evita duplicação de indivíduos.</small></span></label>
    </div>
    <div class="graph-choice-grid mt-4">
      ${graphChoice('top30','Top 30 oficial — referência R','TARGET ALL · n=150 · usa a figura/valores validados pelo professor e pelo pipeline R.')}
      ${graphChoice('selectedmut','Frequência mutacional — genes selecionados','Mostra o valor de referência R quando disponível; fora da referência, identifica explicitamente o valor como exploratório do estudo ativo.')}
      ${graphChoice('mutheat','Heatmap mutacional basal — Top 30','Oncoprint binário simplificado da seleção basal; não substitui o Top 30 oficial n=150.')}
      ${graphChoice('degs','Top DEGs — Relapse vs None', dp.pack.scope==='completo' ? 'DEA exploratória em escopo completo. Ainda não é limma/R validado.' : 'Exige escopo Completo para evitar FDR/DEGs calculados sobre painel parcial.', dp.pack.scope!=='completo')}
      ${graphChoice('volcano','Volcano Plot', dp.pack.scope==='completo' ? 'Usa a mesma DEA exploratória completa; validação final depende da saída R corrigida.' : 'Exige escopo Completo; no modo Expresso faltam genes para reproduzir a análise transcriptômica.', dp.pack.scope!=='completo')}
      ${graphChoice('cox','Forest Plot — Cox univariado','Roda somente os genes selecionados acima; HR por 1 DP de expressão.')}
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

function selectedGenes() {
  return [...new Set([...document.querySelectorAll('.result-gene:checked')].map(x => String(x.value).toUpperCase()))];
}

function generateGeneGraphs() {
  const genes = selectedGenes();
  if (!genes.length) return msg('gene-msg','Selecione pelo menos um gene antes de gerar os gráficos.',false);
  const wanted = new Set(['selectedmut','cox','km']);
  document.querySelectorAll('.result-graph').forEach(el => {
    if (wanted.has(el.value) && !el.disabled) el.checked = true;
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
  if (selectedGraphs.includes('mutheat') && drawMutationHeatmap()) rendered.push({title:'Heatmap mutacional basal — Top 30', genes:[]});
  if (selectedGraphs.includes('degs') && drawDEGs()) rendered.push({title:'Top DEGs — Relapse vs None', genes:[]});
  if (selectedGraphs.includes('volcano') && drawVolcano()) rendered.push({title:'Volcano Plot — Relapse vs None', genes:[]});
  if (selectedGraphs.includes('cox') && drawCox(genes)) rendered.push({title:'Forest Plot — Cox univariado', genes});
  if (selectedGraphs.includes('km')) for (const g of genes) if (drawKM(g)) rendered.push({title:`Kaplan-Meier — ${g}`, genes:[g]});

  if (!redrawOnly) {
    saveHistory(rendered);
    msg('generation-msg', `${rendered.length} gráfico(s) preparado(s). O Top 30 e os valores mutacionais presentes na referência R são identificados como referência validada; Cox, KM, heatmap e análises locais continuam exploratórios até validação específica.`, true);
  }
}

function statusHeader(extra='') {
  return `<div class="validated-result-head"><span class="quality-badge mid"><i class="fa-solid fa-flask"></i> EXPLORATÓRIO LOCAL</span><span class="study-pill">${esc(dp.pack.studyId)}</span>${extra}</div>`;
}

function validatedStatusHeader(extra='') {
  return `<div class="validated-result-head"><span class="quality-badge high"><i class="fa-solid fa-shield-heart"></i> VALIDADO CONTRA R</span><span class="study-pill">TARGET ALL</span><span class="study-pill">n=150</span>${extra}</div>`;
}

function top30Card() {
  if (!rReference?.genes?.length) return noDataCard('Top 30 oficial — referência R','O arquivo numérico da referência R não pôde ser carregado.');
  return `<div class="card result-graph-card">${validatedStatusHeader()}<div class="card__title">Top 30 Genes Mais Mutados/Alterados</div><div class="card__subtitle">Figura oficial do projeto. Denominador mutacional: 150 amostras perfiladas. Este gráfico substitui o antigo ranking roxo de n=81.</div><div class="r-reference-box mt-4"><img id="result-top30-reference" src="${import.meta.env.BASE_URL}fig1_top30_genes_R_original.jpeg" alt="Top 30 validado contra R"></div><p class="chart-note mt-3">NRAS 10,7% · KRAS 5,3% · TP53/PTPN11/JAK2/CREBBP 4,0%. Valores completos auditáveis em resultados-r.html.</p></div>`;
}

function selectedMutationCard(genes) {
  if (!genes.length) return noDataCard('Frequência mutacional — genes selecionados','Selecione pelo menos um gene.');
  const rows = selectedMutationRows(genes);
  if (!rows.length) return noDataCard('Frequência mutacional — genes selecionados','Nenhum dos genes selecionados possui frequência mutacional disponível.');
  const hasRef = rows.some(r=>r.source==='R');
  return `<div class="card result-graph-card">${hasRef?validatedStatusHeader('<span class="study-pill">valores R quando disponíveis</span>'):statusHeader()}<div class="card__title">Frequência mutacional — genes selecionados</div><div class="card__subtitle">“Valor de referência” significa a frequência observada na saída R do estudo, e não um valor clínico normal. Genes que não constam no Top 30 R são marcados como exploratórios do estudo ativo.</div><div class="single-result-canvas"><canvas id="result-selected-mut"></canvas></div><div id="selected-mut-meta" class="mt-4"></div></div>`;
}

function mutationHeatmapCard() {
  const basalGenes=Object.values(dp.mut?.basal?.byGene||{});
  if (!basalGenes.length || !(dp.pack?.mutationSelection?.sampleIds||[]).length) return noDataCard('Heatmap mutacional basal — Top 30','Matriz mutacional basal não disponível.');
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">${dp.pack.mutationSelection.sampleIds.length} amostras basais</span>`)}<div class="card__title">Heatmap mutacional basal — Top 30 genes</div><div class="card__subtitle">Esta visualização usa somente a seleção basal por paciente e é deliberadamente separada do Top 30 oficial n=150. Linhas = genes; colunas = amostras basais; célula preenchida = alteração detectada.</div><div class="mutation-heatmap-scroll mt-4"><canvas id="result-mutheat"></canvas></div></div>`;
}

function degCard() {
  if (dp.pack.scope!=='completo') return noDataCard('Top DEGs — Relapse vs None','Bloqueado no modo Expresso: um painel parcial altera o universo de testes e o FDR. Reconstrua o estudo em escopo Completo.');
  if (!analytics.topDEGs?.length) return noDataCard('Top DEGs — Relapse vs None','Dados insuficientes para DEA significativa nesta coorte.');
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">Relapse ${analytics.dea.n1||0} vs None ${analytics.dea.n0||0}</span><span class="study-pill">escopo completo</span>`)}<div class="card__title">Top DEGs — Relapse vs None</div><div class="card__subtitle">DEA local aproximada em log2(expressão+1). O resultado só recebe selo R após comparação com a tabela limma corrigida.</div><div class="single-result-canvas"><canvas id="result-degs"></canvas></div></div>`;
}

function volcanoCard() {
  if (dp.pack.scope!=='completo') return noDataCard('Volcano Plot','Bloqueado no modo Expresso: o painel parcial não reproduz o universo transcriptômico usado pelo R e altera o FDR.');
  if (!(analytics.dea?.table||[]).length) return noDataCard('Volcano Plot','DEA não disponível nesta coorte.');
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">${esc(dp.pack.expressionTransform?.label||'escala não informada')}</span><span class="study-pill">escopo completo</span>`)}<div class="card__title">Volcano Plot — Relapse vs None</div><div class="card__subtitle">FDR &lt; 0,05 e |log2FC| &gt; 0,5. Esta é uma reprodução exploratória local; para equivalência científica, compare com a saída do Script.R corrigido (limma-trend).</div><div class="single-result-canvas"><canvas id="result-volcano"></canvas></div></div>`;
}

function coxCard(genes) {
  const ctx=survivalContextFor(genes);
  const available = ctx.genes;
  const v=ctx.v;
  if (!available.length || !v.endpointAdequate) return noDataCard('Forest Plot — Cox univariado','Endpoint/expressão insuficientes: são necessários pelo menos 20 registros válidos e 5 eventos, além de expressão para o(s) gene(s) selecionado(s).');
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">genes: ${available.map(esc).join(', ')}</span><span class="study-pill">${esc(v.endpointKey)} · ${esc(v.endpointTimeColumn||'tempo?')}</span>`)}<div class="card__title">Forest Plot — Cox univariado</div><div class="card__subtitle">Somente os genes escolhidos. HR por +1 DP de expressão; no modo Compatibilidade R a escala segue o RPKM bruto do Script.R antes da padronização; IC95% e p são locais. O FDR é corrigido apenas dentro dos genes selecionados nesta execução. O teste cox.zph do R ainda é necessário antes de validar.</div><div class="single-result-canvas"><canvas id="result-cox"></canvas></div><div id="cox-meta" class="mt-4"></div></div>`;
}

function kmCard(gene) {
  const ctx=survivalContextFor([gene]);
  const row = ctx.rows[gene];
  const v = ctx.v;
  if (!row || !v.endpointAdequate) return noDataCard(`Kaplan-Meier — ${gene}`,`${gene} não possui expressão alinhada com um endpoint adequado (mínimo 20 registros e 5 eventos) no estudo ativo.`);
  return `<div class="card result-graph-card">${statusHeader(`<span class="study-pill">${esc(v.endpointLabel||'sobrevida')}</span><span class="study-pill">${esc(v.endpointTimeColumn||'tempo?')}</span><span class="study-pill">gene ${esc(gene)}</span>`)}<div class="card__title">Kaplan-Meier — ${esc(gene)}</div><div class="card__subtitle">Grupos Alto/Baixo definidos pela mediana de expressão na coorte do modo escolhido. A faixa translúcida representa o IC95% log-log/Greenwood. Curva de grupos de referência, não previsão individual.</div><div class="single-result-canvas"><canvas id="result-km-${safeId(gene)}"></canvas></div><div class="card__subtitle mt-4"><strong>Log-rank — eventos observados × esperados</strong></div><div class="single-result-canvas" style="min-height:260px"><canvas id="result-km-oe-${safeId(gene)}"></canvas></div><div id="km-meta-${safeId(gene)}" class="mt-3"></div></div>`;
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

function drawCox(genes) {
  const el=document.getElementById('result-cox'); if(!el) return false; const x=survivalContextFor(genes),v=x.v; if(!x.genes.length||!v.endpointAdequate) return false;
  let d=coxUnivariate(v.time,v.event,x.genes,x.rows).filter(r=>Number.isFinite(r.HR)&&r.HR>0&&r.HR_lower>0&&r.HR_upper>0);
  if(!d.length){
    if(el.parentElement)el.parentElement.innerHTML='<div class="empty-science">Nenhum gene passou os mínimos do Cox nesta execução (≥20 casos completos, ≥5 eventos, expressão variável e convergência).</div>';
    const meta=document.getElementById('cox-meta');if(meta)meta.innerHTML='<div class="alert warning"><i class="fa-solid fa-triangle-exclamation"></i> O gráfico não foi gerado porque nenhum gene selecionado produziu um modelo Cox utilizável.</div>';
    return false;
  }
  const q=bhFdr(d.map(r=>r.p_value)); d.forEach((r,i)=>r.q_value=q[i]); d=d.sort((a,b)=>a.HR-b.HR);
  const points=d.map((r,i)=>({x:r.HR,y:i,gene:r.Gene,lo:r.HR_lower,hi:r.HR_upper,p:r.p_value,q:r.q_value,n:r.n,events:r.nEvents})),t=getChartTheme();
  charts.push(new Chart(el,{type:'scatter',data:{datasets:[{data:points,backgroundColor:points.map(p=>p.q<.05?(p.x>1?'#e74c3c':'#2e7ff0'):'#8590a8'),pointRadius:7}]},options:{responsive:true,maintainAspectRatio:false,parsing:false,animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw.gene}: HR=${c.raw.x.toFixed(3)} · IC95% ${c.raw.lo.toFixed(3)}–${c.raw.hi.toFixed(3)}`,afterLabel:c=>`p=${fmtP(c.raw.p)} · FDR=${fmtP(c.raw.q)} · eventos=${c.raw.events}/${c.raw.n}`}}},scales:{x:{type:'logarithmic',min:Math.max(.05,Math.min(...points.map(p=>p.lo))*.8),max:Math.max(2,Math.max(...points.map(p=>p.hi))*1.2),ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'Hazard Ratio (escala log)',color:t.text}},y:{min:-1,max:d.length,ticks:{color:t.text,callback:v=>Number.isInteger(v)&&d[v]?d[v].Gene:''},grid:{display:false}}}},plugins:[forestCIPlugin()]}));
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
    if(el.parentElement)el.parentElement.innerHTML='<div class="empty-science">Kaplan-Meier não gerado: este gene não atingiu ≥20 casos completos, ≥5 eventos e ≥5 indivíduos em cada grupo definido pela mediana.</div>';
    const oe=document.getElementById(`result-km-oe-${safeId(gene)}`);if(oe?.parentElement)oe.parentElement.innerHTML='<div class="empty-science">Observado × esperado indisponível porque o log-rank não foi executado.</div>';
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

  const oeEl=document.getElementById(`result-km-oe-${safeId(gene)}`);
  if(oeEl&&s.logRank?.labels?.length){
    charts.push(new Chart(oeEl,{
      type:'bar',
      data:{labels:s.logRank.labels,datasets:[
        {label:'Eventos observados',data:s.logRank.O,backgroundColor:'rgba(192,57,43,.72)'},
        {label:'Eventos esperados',data:s.logRank.E,backgroundColor:'rgba(41,128,185,.58)'}
      ]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{labels:{color:t.text}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${Number(c.raw).toFixed(3)}`}}},scales:{x:{ticks:{color:t.text},grid:{display:false}},y:{beginAtZero:true,ticks:{color:t.muted},grid:{color:t.grid},title:{display:true,text:'Número de eventos',color:t.text}}}}
    }));
  }

  const maxTime=Math.max(...s.km.flatMap(g=>g.obs.map(o=>o.t)).filter(Number.isFinite),0);
  const riskTimes=niceRiskTimes(maxTime);
  const riskRows=s.km.map(g=>({name:g.name,vals:atRiskAt(g,riskTimes)}));
  const riskTable=`<div class="km-risk-wrap"><strong>Número em risco</strong><div class="table-wrap"><table class="data-table km-risk-table"><thead><tr><th>Grupo</th>${riskTimes.map(x=>`<th>${fmtTime(x)} m</th>`).join('')}</tr></thead><tbody>${riskRows.map(r=>`<tr><td>${esc(r.name)}</td>${r.vals.map(n=>`<td>${n}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  const meta=document.getElementById(`km-meta-${safeId(gene)}`);
  if(meta){
    meta.innerHTML=`<div class="validation-strip"><div><span>Gene</span><strong>${esc(gene)}</strong></div><div><span>Corte de expressão</span><strong>mediana = ${Number(s.medianCut).toFixed(4)}</strong></div><div><span>Grupos</span><strong>Alto n=${s.nAlto} · Baixo n=${s.nBaixo}</strong></div><div><span>Log-rank</span><strong>χ²=${Number(s.logRank?.chi2||0).toFixed(4)} · p=${fmtP(s.logRank?.p)}</strong></div><div><span>Endpoint</span><strong>${esc(v.endpointKey)} · ${esc(v.endpointTimeColumn||'—')}</strong></div><div><span>Modo</span><strong>${esc(x.modeLabel||'Basal por paciente')}</strong></div><div><span>Eventos</span><strong>${s.events}/${s.n}</strong></div></div>${riskTable}<div class="flex gap-2 mt-3" style="flex-wrap:wrap"><button class="btn btn-secondary btn-sm" id="km-json-${safeId(gene)}"><i class="fa-solid fa-file-code"></i> Baixar dados KM em JSON</button></div><p class="chart-note mt-3">IC95%: transformação log-log com variância de Greenwood. O gráfico observado × esperado usa exatamente as quantidades do mesmo teste log-rank. KM e Cox usam o mesmo conjunto de casos completos por gene (OS + expressão). No modo Compatibilidade R, ausências de expressão são imputadas pela mediana do gene antes do filtro de OS, reproduzindo a ordem do Script.R. O selo “validado contra R” só é permitido depois da comparação numérica com a saída R correspondente.</p>`;
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
    return{v,rows,genes:available,mode:'r',modeLabel:'Compatibilidade R'};
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
