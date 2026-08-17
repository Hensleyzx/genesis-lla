import '../css/genesis.css';
import { mountLayout, injectFontAwesome, warningBanner } from './common.js';
import { carregarAnalises } from './data.js';

injectFontAwesome();
mountLayout('dashboard','Histórico');
const content=document.getElementById('page-content');
const GRAPH_HISTORY_KEY='genesis_graph_history_v10';

const readGraphs=()=>{try{return JSON.parse(localStorage.getItem(GRAPH_HISTORY_KEY)||'[]')}catch{return[]}};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fmtDate=v=>{try{return new Date(v).toLocaleString('pt-BR')}catch{return v||'—'}};

function render(){
  const patientHistory=carregarAnalises();
  const graphHistory=readGraphs();
  const uniqueStudies=new Set([
    ...graphHistory.map(x=>x.studyId),
    ...patientHistory.flatMap(x=>(x.referencias||[]).map(r=>r.studyId))
  ].filter(Boolean));

  content.innerHTML=`
  ${warningBanner()}
  <section class="history-hero">
    <div><div class="medical-kicker"><i class="fa-solid fa-clock-rotate-left"></i> Registros locais</div><h1>Histórico de análises e gráficos</h1><p>Os registros abaixo ficam somente neste navegador. Análises de pacientes e gráficos de estudos são mantidos em trilhas separadas para evitar confusão entre caso individual e exploração de coorte.</p></div>
    <div class="history-hero__actions"><a class="btn btn-primary" href="analise.html"><i class="fa-solid fa-user-doctor"></i> Nova análise</a><a class="btn btn-secondary" href="resultados.html"><i class="fa-solid fa-chart-line"></i> Novo gráfico</a></div>
  </section>

  <div class="medical-stat-grid mt-6">
    <div class="medical-stat"><i class="fa-solid fa-user-injured"></i><div><strong>${patientHistory.length}</strong><span>análises de pacientes</span></div></div>
    <div class="medical-stat"><i class="fa-solid fa-chart-simple"></i><div><strong>${graphHistory.length}</strong><span>gráficos registrados</span></div></div>
    <div class="medical-stat"><i class="fa-solid fa-database"></i><div><strong>${uniqueStudies.size}</strong><span>coortes presentes no histórico</span></div></div>
    <div class="medical-stat"><i class="fa-solid fa-circle-check"></i><div><strong>${graphHistory.filter(x=>x.status==='validado contra R').length}</strong><span>gráficos validados contra R</span></div></div>
  </div>

  <section class="card mt-6">
    <div class="card__header"><div><div class="card__title"><i class="fa-solid fa-file-medical"></i> Análises de pacientes</div><div class="card__subtitle">Sínteses exploratórias geradas no módulo do paciente.</div></div><button class="btn btn-ghost btn-sm" id="clear-patient-history"><i class="fa-solid fa-trash"></i> Limpar</button></div>
    <div class="patient-history-grid">
      ${patientHistory.length?patientHistory.slice(0,50).map(r=>`
        <article class="patient-history-card">
          <div class="patient-history-card__top"><div><span>CASO</span><h3>${esc(r.nome||r.id||'Sem identificação')}</h3><small>${esc(r.id||'—')}</small></div><span class="signal ${r.perfil?.key==='favoravel'?'favoravel':r.perfil?.key==='desfavoravel'?'desfavoravel':'inconclusivo'}">${esc(r.perfil?.label||'Inconclusivo')}</span></div>
          <div class="patient-history-meta"><span><i class="fa-solid fa-dna"></i> ${(r.biomarcadores||[]).map(esc).join(', ')||'—'}</span><span><i class="fa-solid fa-database"></i> ${r.studyResults?.length||r.referencias?.length||0} coorte(s)</span><span><i class="fa-solid fa-gauge-high"></i> Qualidade ${r.dataQuality?.score??0}/100</span></div>
          <time>${fmtDate(r.data)}</time>
        </article>`).join(''):'<div class="empty-science compact">Nenhuma análise de paciente foi executada neste navegador.</div>'}
    </div>
  </section>

  <section class="card mt-6">
    <div class="card__header"><div><div class="card__title"><i class="fa-solid fa-chart-column"></i> Gráficos de estudos</div><div class="card__subtitle">Resultados solicitados em Estudos & Gráficos, com status científico explícito.</div></div><button class="btn btn-ghost btn-sm" id="clear-graph-history"><i class="fa-solid fa-trash"></i> Limpar</button></div>
    <div class="result-history-grid">
      ${graphHistory.length?graphHistory.slice(0,80).map(x=>`<article class="history-result-card"><div><span class="quality-badge ${x.status==='validado contra R'?'good':'warn'}">${x.status==='validado contra R'?'<i class="fa-solid fa-circle-check"></i> validado R':'<i class="fa-solid fa-flask"></i> exploratório'}</span><h3>${esc(x.title)}</h3><p>${esc(x.studyName||x.studyId||'—')}</p>${x.genes?.length?`<small>Genes: ${x.genes.map(esc).join(', ')}</small>`:''}</div><time>${fmtDate(x.createdAt)}</time></article>`).join(''):'<div class="empty-science compact">Nenhum gráfico foi registrado ainda.</div>'}
    </div>
  </section>`;

  document.getElementById('clear-patient-history').onclick=()=>{
    if(confirm('Apagar o histórico local de análises de pacientes?')){
      localStorage.removeItem('genesis_lla_analises_v6');
      localStorage.removeItem('genesis_lla_atual_v6');
      render();
    }
  };
  document.getElementById('clear-graph-history').onclick=()=>{
    if(confirm('Apagar o histórico local de gráficos?')){
      localStorage.removeItem(GRAPH_HISTORY_KEY);
      render();
    }
  };
}
render();
