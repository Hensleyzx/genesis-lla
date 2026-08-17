import '../css/genesis.css';
import { mountLayout, injectFontAwesome, warningBanner, getChartTheme } from './common.js';
import Chart from 'chart.js/auto';
import Papa from 'papaparse';

injectFontAwesome();
mountLayout('genesis-r', 'GENESIS-R · Validação em R');

const content = document.getElementById('page-content');
const BASE = `${import.meta.env.BASE_URL}data/genesis_r/`;
let charts = [];
let study = null;

content.innerHTML = `
${warningBanner()}
<div class="flow-head genesis-r-hero">
  <div>
    <div class="result-hero__label">ESTUDO FIXO · RESULTADOS PRODUZIDOS NO R</div>
    <h1 class="page-title">GENESIS-R — Estudo de Validação TARGET ALL</h1>
    <p class="page-desc">Painel de validação estatística do GENESIS baseado nos arquivos gerados pelo pipeline R do projeto. Este modo <strong>não substitui os valores do R por cálculos locais</strong>: ele carrega os CSVs fornecidos e apresenta a procedência de cada resultado.</p>
  </div>
  <a class="btn btn-secondary" href="resultados.html"><i class="fa-solid fa-arrow-left"></i> Estudos exploratórios</a>
</div>

<div class="genesis-r-launch card mt-6" id="genesis-r-launch">
  <div class="genesis-r-launch__icon"><i class="fa-solid fa-flask-vial"></i></div>
  <div>
    <div class="card__title">Pacote de validação disponível</div>
    <p class="card__subtitle">TARGET ALL · Top 30 · DEA Relapse vs None · Cox univariado/multivariado · Kaplan–Meier · dados clínicos.</p>
    <div class="official-r-badges mt-3">
      <span><i class="fa-brands fa-r-project"></i> Pipeline R</span>
      <span>all_phase2_target_2018_pub</span>
      <span>OS · Sobrevida Global</span>
    </div>
  </div>
  <button class="btn btn-primary btn-lg" id="load-genesis-r"><i class="fa-solid fa-database"></i> Carregar estudo GENESIS-R</button>
</div>

<div id="genesis-r-progress" class="card mt-6 genesis-r-progress" hidden>
  <div class="card__title"><i class="fa-solid fa-spinner fa-spin"></i> Carregando resultados validados</div>
  <div class="genesis-progress-track mt-4"><div id="genesis-progress-bar"></div></div>
  <div id="genesis-progress-label" class="card__subtitle mt-3">Preparando arquivos…</div>
  <div id="genesis-progress-steps" class="genesis-progress-steps mt-4"></div>
</div>

<div id="genesis-r-study" hidden></div>`;

document.getElementById('load-genesis-r').addEventListener('click', loadStudy);
if (new URLSearchParams(location.search).get('autoload') === '1') loadStudy();

async function loadStudy() {
  const btn = document.getElementById('load-genesis-r');
  btn.disabled = true;
  document.getElementById('genesis-r-progress').hidden = false;
  const steps = [
    ['manifest', 'Identificando o estudo GENESIS-R'],
    ['top30', 'Lendo Top 30 mutacional'],
    ['clinical', 'Lendo dados clínicos'],
    ['dea', 'Lendo expressão diferencial'],
    ['coxUni', 'Lendo Cox univariado'],
    ['coxMulti', 'Lendo Cox multivariado'],
  ];
  const data = {};
  try {
    for (let i = 0; i < steps.length; i++) {
      const [key, label] = steps[i];
      setProgress(Math.round((i / steps.length) * 100), label, steps.slice(0, i).map(x => x[1]));
      if (key === 'manifest') data.manifest = await fetchJson('manifest.json');
      else data[key] = await fetchCsv(fileFor(key));
      await visibleDelay(100);
    }
    validateStudy(data);
    setProgress(100, 'GENESIS-R pronto para visualização', steps.map(x => x[1]));
    study = data;
    await visibleDelay(180);
    document.getElementById('genesis-r-progress').hidden = true;
    renderStudy();
  } catch (error) {
    document.getElementById('genesis-progress-label').innerHTML = `<strong class="text-danger">Falha ao carregar:</strong> ${esc(error.message)}`;
    btn.disabled = false;
  }
}

function fileFor(key) {
  return ({
    top30: 'top30_genes_mutados.csv',
    clinical: 'clinical_data.csv',
    dea: 'DEA_results_relapse_vs_none.csv',
    coxUni: 'cox_univariado.csv',
    coxMulti: 'cox_multivariado.csv',
  })[key];
}

async function fetchJson(name) {
  const r = await fetch(`${BASE}${name}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
}

async function fetchCsv(name) {
  const r = await fetch(`${BASE}${name}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  const text = await r.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
  if (parsed.errors?.length) throw new Error(`${name}: ${parsed.errors[0].message}`);
  return parsed.data;
}

function validateStudy(d) {
  if (d.manifest?.id !== 'genesis-r-target-all') throw new Error('Manifesto GENESIS-R inválido.');
  if (Number(d.manifest.mutation_denominator) !== 150) throw new Error('Denominador mutacional esperado: n=150.');
  if (d.top30.length !== 30) throw new Error(`Top 30 possui ${d.top30.length} linhas.`);
  if (d.clinical.length !== Number(d.manifest.clinical_rows)) throw new Error('clinical_data.csv não corresponde ao manifesto.');
  if (d.dea.length !== Number(d.manifest.dea_rows)) throw new Error('DEA não corresponde ao manifesto.');
  if (d.coxUni.length !== 10 || d.coxMulti.length !== 9) throw new Error('Tabelas de Cox incompletas.');
  const nras = d.top30.find(x => String(x.Gene).toUpperCase() === 'NRAS');
  if (!nras || Number(nras.n_amostras) !== 16 || Number(nras.freq_relativa) !== 10.7) throw new Error('Referência NRAS divergente do arquivo R.');
}

function renderStudy() {
  destroyCharts();
  const m = study.manifest;
  const clinicalSummary = summarizeClinical(study.clinical);
  const deaSummary = summarizeDea(study.dea);
  const sigUni = study.coxUni.filter(x => Number(x.p_value) < 0.05).length;
  const sigMulti = study.coxMulti.filter(x => Number(x.p_value) < 0.05).length;
  const host = document.getElementById('genesis-r-study');
  host.hidden = false;
  host.innerHTML = `
  <div class="genesis-r-status mt-6">
    <span class="quality-badge high"><i class="fa-solid fa-shield-heart"></i> RESULTADOS DO R CARREGADOS</span>
    <span class="study-pill">${esc(m.study_id)}</span>
    <span class="study-pill">endpoint: ${esc(m.endpoint)}</span>
    <a class="study-pill genesis-r-script-link" href="${import.meta.env.BASE_URL}referencias/GENESIS_R_Script_professor.R" target="_blank" rel="noopener"><i class="fa-solid fa-code"></i> Script R</a>
  </div>

  <div class="genesis-r-summary mt-4">
    ${metric('150', 'amostras no Top 30', 'fa-dna')}
    ${metric(m.clinical_rows.toLocaleString('pt-BR'), 'registros clínicos', 'fa-notes-medical')}
    ${metric(m.unique_patients.toLocaleString('pt-BR'), 'IDs de paciente distintos', 'fa-users')}
    ${metric(m.dea_rows.toLocaleString('pt-BR'), 'genes avaliados na DEA', 'fa-microscope')}
    ${metric(`${sigUni}/10`, 'Cox univariado p<0,05', 'fa-chart-line')}
    ${metric(`${sigMulti}/9`, 'Cox multivariado p<0,05', 'fa-chart-simple')}
  </div>

  <div class="clinical-gate mt-6">
    <div><i class="fa-brands fa-r-project"></i></div>
    <div><strong>Procedência preservada.</strong><p>Os números desta página são lidos dos arquivos fornecidos pelo pipeline R. Os Kaplan–Meier são mostrados como imagens da saída R porque os dados ponto a ponto das curvas não foram exportados em CSV.</p></div>
  </div>

  ${sectionNav()}

  <section class="card mt-6 genesis-r-section" id="gr-top30">
    ${sectionHeader('01', 'Top 30 Genes Mais Mutados/Alterados', 'Frequência mutacional calculada no R com denominador n=150.', 'VALIDADO NO R')}
    <div class="genesis-r-chart-large mt-4"><canvas id="gr-top30-chart"></canvas></div>
    <div class="flex gap-2 mt-4" style="flex-wrap:wrap"><button class="btn btn-secondary btn-sm" id="gr-top30-image"><i class="fa-solid fa-image"></i> Comparar com figura R</button></div>
    <div class="r-reference-box mt-4" id="gr-top30-original" hidden><img src="${BASE}top30_R_original.jpeg" alt="Top 30 original produzido no R"></div>
    <div class="table-wrap mt-4"><table class="data-table">${top30Table()}</table></div>
  </section>

  <section class="card mt-6 genesis-r-section" id="gr-dea">
    ${sectionHeader('02', 'DEA — Relapse vs None', `${m.dea_rows.toLocaleString('pt-BR')} genes · limma · adj.P.Val disponível no CSV.`, 'DADOS DO R')}
    <div class="genesis-r-kpis mt-4">
      ${miniMetric(deaSummary.up, 'Upregulados')}${miniMetric(deaSummary.down, 'Downregulados')}${miniMetric(deaSummary.ns, 'Não significativos')}${miniMetric(deaSummary.fdr05, 'adj.P.Val < 0,05')}
    </div>
    <div class="genesis-r-chart-large mt-4"><canvas id="gr-volcano-chart"></canvas></div>
    <p class="chart-note mt-3">Cada ponto vem de DEA_results_relapse_vs_none.csv. O eixo Y usa −log10(adj.P.Val), preservando a correção múltipla já exportada pelo R.</p>
    <div class="table-wrap mt-4"><table class="data-table">${deaTable()}</table></div>
  </section>

  <section class="card mt-6 genesis-r-section" id="gr-cox">
    ${sectionHeader('03', 'Cox univariado', 'HR, IC95% e p-value lidos diretamente de cox_univariado.csv.', 'DADOS DO R')}
    <div class="genesis-r-chart-forest mt-4"><canvas id="gr-cox-uni-chart"></canvas></div>
    <div class="flex gap-2 mt-4" style="flex-wrap:wrap"><button class="btn btn-secondary btn-sm" id="gr-cox-image"><i class="fa-solid fa-image"></i> Comparar com Forest Plot R</button></div>
    <div class="r-reference-box mt-4" id="gr-cox-original" hidden><img src="${BASE}forest_cox_R_original.jpeg" alt="Forest Plot original produzido no R"></div>
    <div class="table-wrap mt-4"><table class="data-table">${coxUniTable()}</table></div>
  </section>

  <section class="card mt-6 genesis-r-section" id="gr-cox-multi">
    ${sectionHeader('04', 'Cox multivariado', 'Modelo conjunto exportado pelo R; esta tabela não possui IC95% no CSV recebido.', 'DADOS DO R')}
    <div class="genesis-r-chart-medium mt-4"><canvas id="gr-cox-multi-chart"></canvas></div>
    <div class="table-wrap mt-4"><table class="data-table">${coxMultiTable()}</table></div>
  </section>

  <section class="card mt-6 genesis-r-section" id="gr-km">
    ${sectionHeader('05', 'Kaplan–Meier — OS', 'Curvas produzidas no R com divisão Alto/Baixo pela mediana de expressão.', 'IMAGENS DA SAÍDA R')}
    <div class="km-study-controls mt-4">
      <label class="form-group"><span class="form-label">Gene da curva</span><select class="form-input" id="gr-km-gene">${m.km_genes.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}</select></label>
      <div id="gr-km-meta" class="km-study-meta"></div>
    </div>
    <div class="genesis-r-km-frame mt-4"><img id="gr-km-image" alt="Curva Kaplan-Meier produzida no R"></div>
    <p class="chart-note mt-3">As imagens exibem IC95%, marcas de censura, p do log-rank e tabela de pacientes em risco. Como o CSV ponto a ponto das curvas não foi fornecido, o GENESIS-R não redesenha estas curvas.</p>
  </section>

  <section class="card mt-6 genesis-r-section" id="gr-clinical">
    ${sectionHeader('06', 'Dados clínicos do estudo', `${m.clinical_rows.toLocaleString('pt-BR')} registros × ${m.clinical_columns} variáveis no arquivo recebido.`, 'ARQUIVO DO R')}
    <div class="genesis-r-kpis mt-4">
      ${miniMetric(clinicalSummary.uniquePatients, 'Pacientes distintos')}${miniMetric(clinicalSummary.events, 'Eventos OS')}${miniMetric(clinicalSummary.relapse, 'Registros FIRST_EVENT=Relapse')}${miniMetric(clinicalSummary.none, 'Registros FIRST_EVENT=None')}
    </div>
    <div class="clinical-summary-grid mt-4">
      ${summaryList('OS_STATUS', clinicalSummary.osStatus)}
      ${summaryList('BCR_ABL1_STATUS', clinicalSummary.bcrAbl1)}
      ${summaryList('ANALYSIS_COHORT', clinicalSummary.cohort)}
    </div>
    <p class="chart-note mt-4">Contagens desta seção descrevem as linhas do arquivo clinical_data.csv. Um mesmo PATIENT_ID pode aparecer em múltiplas amostras; por isso registros de amostra não devem ser tratados como pacientes independentes.</p>
  </section>`;

  document.getElementById('gr-top30-image').onclick = () => toggle('gr-top30-original');
  document.getElementById('gr-cox-image').onclick = () => toggle('gr-cox-original');
  document.getElementById('gr-km-gene').onchange = renderKm;
  renderKm();
  drawTop30();
  drawVolcano();
  drawCoxUni();
  drawCoxMulti();
  host.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function drawTop30() {
  const rows = study.top30.slice().sort((a,b) => Number(a.freq_relativa) - Number(b.freq_relativa));
  const t = getChartTheme();
  charts.push(new Chart(document.getElementById('gr-top30-chart'), {
    type: 'bar',
    data: { labels: rows.map(x => x.Gene), datasets: [{ data: rows.map(x => Number(x.freq_relativa)), backgroundColor: rows.map(x => mutationColor(Number(x.freq_relativa))) }] },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', animation: false, plugins: { legend: { display:false }, tooltip: { callbacks: { label: c => `${pct(c.raw)} · ${rows[c.dataIndex].n_amostras}/150 amostras` } } }, scales: { x: { beginAtZero:true, suggestedMax:12, title:{display:true,text:'Frequência de Mutação (%)',color:t.text}, ticks:{color:t.muted}, grid:{color:t.grid} }, y:{ticks:{color:t.text,autoSkip:false},grid:{display:false}} } },
    plugins: [valueLabelsPlugin('pct')]
  }));
}

function drawVolcano() {
  const t = getChartTheme();
  const groups = { Upregulado: [], Downregulado: [], NS: [] };
  for (const r of study.dea) {
    const x = Number(r.logFC), p = Number(r['adj.P.Val']);
    if (!Number.isFinite(x) || !Number.isFinite(p) || p <= 0) continue;
    const g = groups[r.color_grp] ? r.color_grp : 'NS';
    groups[g].push({ x, y: -Math.log10(p), gene: r.gene, p });
  }
  charts.push(new Chart(document.getElementById('gr-volcano-chart'), {
    type:'scatter',
    data:{ datasets:[
      {label:'Upregulado',data:groups.Upregulado,pointRadius:2.1,backgroundColor:'#c0392b'},
      {label:'Downregulado',data:groups.Downregulado,pointRadius:2.1,backgroundColor:'#2980b9'},
      {label:'NS',data:groups.NS,pointRadius:1.05,backgroundColor:'rgba(127,140,141,.30)'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,plugins:{legend:{labels:{color:t.text}},tooltip:{callbacks:{label:c=>`${c.raw.gene}: logFC ${num(c.raw.x,3)} · FDR ${sci(c.raw.p)}`}}},scales:{x:{title:{display:true,text:'log2 Fold Change',color:t.text},ticks:{color:t.muted},grid:{color:t.grid}},y:{title:{display:true,text:'−log10(adj.P.Val)',color:t.text},ticks:{color:t.muted},grid:{color:t.grid}}}}
  }));
}

function drawCoxUni() {
  const rows = study.coxUni.slice().sort((a,b)=>Number(a.HR)-Number(b.HR));
  const t = getChartTheme();
  const datasets = [];
  rows.forEach((r) => {
    const gene = String(r.Gene), sig = Number(r.p_value) < .05;
    datasets.push({type:'line',label:`${gene} IC95%`,data:[{x:Number(r.HR_lower),y:gene},{x:Number(r.HR_upper),y:gene}],showLine:true,borderColor:'rgba(86,96,109,.85)',borderWidth:2,pointRadius:0});
    datasets.push({type:'scatter',label:gene,data:[{x:Number(r.HR),y:gene,p:Number(r.p_value)}],pointRadius:sig?7:5,backgroundColor:Number(r.HR)<1?'#147d83':'#c0392b'});
  });
  charts.push(new Chart(document.getElementById('gr-cox-uni-chart'), {
    data:{datasets},
    options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},tooltip:{filter:i=>i.dataset.type==='scatter',callbacks:{label:c=>{const r=study.coxUni.find(x=>String(x.Gene)===String(c.raw.y));return `${r.Gene}: HR ${num(r.HR,3)} (IC95% ${num(r.HR_lower,3)}–${num(r.HR_upper,3)}), p=${fmtP(r.p_value)}`}}}},scales:{x:{type:'linear',min:0.3,suggestedMax:1.15,title:{display:true,text:'Hazard Ratio (IC 95%)',color:t.text},ticks:{color:t.muted},grid:{color:t.grid}},y:{type:'category',labels:rows.map(x=>String(x.Gene)),ticks:{color:t.text},grid:{display:false}}}},
    plugins:[referenceLinePlugin(1)]
  }));
}

function drawCoxMulti() {
  const rows = study.coxMulti.slice().sort((a,b)=>Number(a.HR)-Number(b.HR));
  const t=getChartTheme();
  charts.push(new Chart(document.getElementById('gr-cox-multi-chart'),{
    type:'bar',
    data:{labels:rows.map(r=>r.Gene),datasets:[{data:rows.map(r=>Number(r.HR)),backgroundColor:rows.map(r=>Number(r.p_value)<.05?'#147d83':'rgba(94,116,134,.55)')}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',animation:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>{const r=rows[c.dataIndex];return `HR ${num(r.HR,3)} · p=${fmtP(r.p_value)}`}}}},scales:{x:{beginAtZero:true,suggestedMax:1.6,title:{display:true,text:'Hazard Ratio',color:t.text},ticks:{color:t.muted},grid:{color:t.grid}},y:{ticks:{color:t.text},grid:{display:false}}}},
    plugins:[referenceLinePlugin(1)]
  }));
}

function renderKm() {
  if (!study) return;
  const gene = document.getElementById('gr-km-gene').value;
  const r = study.manifest.km_results?.[gene];
  document.getElementById('gr-km-image').src = `${BASE}km/${encodeURIComponent(gene)}.jpeg`;
  document.getElementById('gr-km-image').alt = `Kaplan-Meier ${gene} produzido no R`;
  document.getElementById('gr-km-meta').innerHTML = r ? `<span class="quality-badge ${Number(r.p)<.05?'high':'mid'}">p = ${fmtP(r.p)}</span><span class="study-pill">Alto n=${r.high_n}</span><span class="study-pill">Baixo n=${r.low_n}</span>` : '';
}

function summarizeDea(rows) {
  const out={up:0,down:0,ns:0,fdr05:0};
  for(const r of rows){if(r.color_grp==='Upregulado')out.up++;else if(r.color_grp==='Downregulado')out.down++;else out.ns++;if(Number(r['adj.P.Val'])<.05)out.fdr05++;}
  return out;
}
function summarizeClinical(rows) {
  const freq=(key)=>{const m={};for(const r of rows){const v=String(r[key]??'').trim()||'Ausente';m[v]=(m[v]||0)+1;}return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8)};
  return {uniquePatients:new Set(rows.map(r=>String(r.PATIENT_ID||'')).filter(Boolean)).size,events:rows.filter(r=>Number(r.surv_event)===1).length,relapse:rows.filter(r=>String(r.FIRST_EVENT)==='Relapse').length,none:rows.filter(r=>String(r.FIRST_EVENT)==='None').length,osStatus:freq('OS_STATUS'),bcrAbl1:freq('BCR_ABL1_STATUS'),cohort:freq('ANALYSIS_COHORT')};
}

function top30Table(){return `<thead><tr><th>#</th><th>Gene</th><th>Amostras</th><th>Frequência</th></tr></thead><tbody>${study.top30.map((r,i)=>`<tr><td>${i+1}</td><td><strong>${esc(r.Gene)}</strong></td><td>${r.n_amostras}/150</td><td>${pct(r.freq_relativa)}</td></tr>`).join('')}</tbody>`}
function deaTable(){return `<thead><tr><th>Gene</th><th>logFC</th><th>adj.P.Val</th><th>Classe R</th></tr></thead><tbody>${study.dea.slice().sort((a,b)=>Number(a['adj.P.Val'])-Number(b['adj.P.Val'])).slice(0,20).map(r=>`<tr><td><strong>${esc(r.gene)}</strong></td><td>${num(r.logFC,3)}</td><td>${sci(r['adj.P.Val'])}</td><td>${esc(r.signif)}</td></tr>`).join('')}</tbody>`}
function coxUniTable(){return `<thead><tr><th>Gene</th><th>HR</th><th>IC95%</th><th>p</th><th>R</th></tr></thead><tbody>${study.coxUni.map(r=>`<tr><td><strong>${esc(r.Gene)}</strong></td><td>${num(r.HR,3)}</td><td>${num(r.HR_lower,3)}–${num(r.HR_upper,3)}</td><td>${fmtP(r.p_value)}</td><td>${Number(r.p_value)<.05?'<span class="match-pill"><i class="fa-solid fa-check"></i> p<0,05</span>':'—'}</td></tr>`).join('')}</tbody>`}
function coxMultiTable(){return `<thead><tr><th>Gene</th><th>coef</th><th>HR</th><th>SE</th><th>z</th><th>p</th></tr></thead><tbody>${study.coxMulti.map(r=>`<tr><td><strong>${esc(r.Gene)}</strong></td><td>${num(r.coef,4)}</td><td>${num(r.HR,3)}</td><td>${num(r.se_coef,4)}</td><td>${num(r.z,3)}</td><td>${fmtP(r.p_value)}</td></tr>`).join('')}</tbody>`}

function sectionNav(){return `<div class="genesis-r-section-nav mt-6"><a href="#gr-top30">Top 30</a><a href="#gr-dea">DEA</a><a href="#gr-cox">Cox uni</a><a href="#gr-cox-multi">Cox multi</a><a href="#gr-km">Kaplan–Meier</a><a href="#gr-clinical">Clínico</a></div>`}
function sectionHeader(n,title,sub,badge){return `<div class="card__header"><div><div class="result-hero__label">GENESIS-R · ${n}</div><div class="card__title">${title}</div><div class="card__subtitle">${sub}</div></div><span class="quality-badge high"><i class="fa-solid fa-circle-check"></i> ${badge}</span></div>`}
function metric(value,label,icon){return `<div class="genesis-r-metric"><i class="fa-solid ${icon}"></i><div><strong>${value}</strong><span>${label}</span></div></div>`}
function miniMetric(value,label){return `<div class="genesis-r-mini"><strong>${Number(value).toLocaleString('pt-BR')}</strong><span>${label}</span></div>`}
function summaryList(title,items){return `<div class="clinical-summary-card"><strong>${title}</strong>${items.map(([k,v])=>`<div><span>${esc(k)}</span><b>${Number(v).toLocaleString('pt-BR')}</b></div>`).join('')}</div>`}

function setProgress(pctValue,label,done=[]){document.getElementById('genesis-progress-bar').style.width=`${pctValue}%`;document.getElementById('genesis-progress-label').textContent=label;document.getElementById('genesis-progress-steps').innerHTML=done.map(s=>`<span><i class="fa-solid fa-circle-check"></i> ${esc(s)}</span>`).join('')}
function toggle(id){const el=document.getElementById(id);el.hidden=!el.hidden}
function visibleDelay(ms){return new Promise(r=>setTimeout(r,ms))}
function destroyCharts(){charts.forEach(c=>c?.destroy());charts=[]}
function mutationColor(v){const lo=[254,240,217],hi=[215,48,31],min=1.3,max=10.7,t=Math.max(0,Math.min(1,(v-min)/(max-min)));return `rgb(${lo.map((x,i)=>Math.round(x+(hi[i]-x)*t)).join(',')})`}
function valueLabelsPlugin(mode){return{id:`labels-${mode}`,afterDatasetsDraw(c){const {ctx}=c;ctx.save();ctx.fillStyle=getChartTheme().text;ctx.font='11px sans-serif';ctx.textBaseline='middle';c.getDatasetMeta(0).data.forEach((bar,i)=>ctx.fillText(pct(c.data.datasets[0].data[i]),bar.x+6,bar.y));ctx.restore()}}}
function referenceLinePlugin(x){return{id:`ref-${x}`,afterDraw(c){const s=c.scales.x;if(!s)return;const px=s.getPixelForValue(x),{top,bottom}=c.chartArea,ctx=c.ctx;ctx.save();ctx.strokeStyle='rgba(100,116,139,.8)';ctx.setLineDash([6,6]);ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,bottom);ctx.stroke();ctx.restore()}}}
function pct(v){const n=Number(v);return `${n.toLocaleString('pt-BR',{minimumFractionDigits:n%1?1:0,maximumFractionDigits:1})}%`}
function num(v,d=2){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—'}
function fmtP(v){const n=Number(v);if(!Number.isFinite(n))return'—';if(n<0.001)return n.toLocaleString('pt-BR',{maximumSignificantDigits:2});return n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:4})}
function sci(v){const n=Number(v);return Number.isFinite(n)?n.toExponential(2).replace('.',','):'—'}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
