import '../css/genesis.css';
import { mountLayout, injectFontAwesome, warningBanner, getChartTheme, graphReport } from './common.js';
import { GENES, adicionarAnalise, salvarAnaliseAtual, gerarRelatorioTexto } from './data.js';
import { analyzePatient } from './analysis-engine.js';
import { listLoadedStudyMeta, getActiveStudyId } from './datapack.js';
import Chart from 'chart.js/auto';

injectFontAwesome();
mountLayout('analise', 'Análise do Paciente');

const content=document.getElementById('page-content');
const PATIENTS_KEY='genesis_patients_v10';
const DOCTORS_KEY='genesis_doctors_v10';
const DEFAULT_GENES=new Set(['TP53','IKZF1','BCR-ABL1','NOTCH1']);
let charts=[];
let loadedStudies=[];
let activeStudyId=null;
let lastResult=null;

const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const nfmt=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toLocaleString('pt-BR',{maximumFractionDigits:d}):'—';

function showMessage(id,text,type='warning'){
  const el=document.getElementById(id);
  if(el)el.innerHTML=`<div class="alert ${type}">${esc(text)}</div>`;
}
function clearMessage(id){const el=document.getElementById(id);if(el)el.innerHTML='';}

function patientOptions(){
  const patients=read(PATIENTS_KEY);
  return `<option value="">Novo caso</option>${patients.map((p,i)=>`<option value="${i}">${esc(p.name||p.id)} · ${esc(p.id)}</option>`).join('')}`;
}
function doctorOptions(){
  const doctors=read(DOCTORS_KEY);
  return `<option value="">Não vincular</option>${doctors.map((d,i)=>`<option value="${i}">${esc(d.name)}${d.identifier?` · ${esc(d.identifier)}`:''}</option>`).join('')}`;
}

async function init(){
  [loadedStudies,activeStudyId]=await Promise.all([
    listLoadedStudyMeta().catch(()=>[]),
    getActiveStudyId().catch(()=>null)
  ]);
  renderPage();
  bindPage();
}

function renderPage(){
  const studyHtml=loadedStudies.length?loadedStudies.map((s,i)=>{
    const checked=(s.studyId===activeStudyId)||(!activeStudyId&&i===0);
    return `<label class="patient-study-choice">
      <input type="checkbox" class="patient-study" value="${esc(s.studyId)}" ${checked?'checked':''}>
      <span><strong>${esc(s.studyName)}</strong><small>${esc(s.studyId)} · ${s.nPatients||0} pacientes · ${s.nAnalysisSamples||0} amostras expressão</small></span>
      ${s.studyId===activeStudyId?'<em>ATIVO</em>':''}
    </label>`;
  }).join(''):`<div class="patient-study-empty"><i class="fa-solid fa-database"></i><div><strong>Nenhum estudo LLA está carregado neste navegador.</strong><p>Antes da análise do paciente, carregue pelo menos uma coorte em “Estudos & Gráficos”.</p><a href="resultados.html" class="btn btn-primary btn-sm">Carregar estudo</a></div></div>`;

  const geneRows=GENES.map(g=>{
    const checked=DEFAULT_GENES.has(g.id);
    const isFusion=g.id==='BCR-ABL1';
    return `<div class="patient-biomarker-row" data-gene-row="${esc(g.id)}">
      <label class="patient-gene-toggle"><input type="checkbox" class="patient-gene" value="${esc(g.id)}" ${checked?'checked':''}><span><strong>${esc(g.name)}</strong><small>${esc(g.desc)}</small></span></label>
      <div class="form-group">
        <label class="form-label">${isFusion?'Status da fusão':'Alteração genética'}</label>
        ${isFusion
          ? '<div class="form-input patient-readonly-field"><i class="fa-solid fa-link"></i> Use o campo BCR-ABL1 da etapa 2</div><select class="patient-alteration" data-gene="BCR-ABL1" hidden disabled><option value="nao_informado" selected>Não informado</option></select>'
          : `<select class="form-select patient-alteration" data-gene="${esc(g.id)}"><option value="nao_informado">Não informado</option><option value="presente">Alteração detectada</option><option value="ausente">Sem alteração detectada</option></select>`}
      </div>
      <div class="form-group">
        <label class="form-label">Expressão</label>
        ${isFusion
          ? '<input class="form-input patient-expression" data-gene="BCR-ABL1" value="" placeholder="Não usada para inferir a fusão" disabled data-locked="true">'
          : `<input class="form-input patient-expression" data-gene="${esc(g.id)}" inputmode="decimal" placeholder="Opcional">`}
      </div>
    </div>`;
  }).join('');

  content.innerHTML=`
  ${warningBanner()}
  <section class="patient-hero">
    <div>
      <div class="medical-kicker"><i class="fa-solid fa-stethoscope"></i> Módulo do caso individual</div>
      <h1>Análise de biomarcadores do paciente</h1>
      <p>Registre as informações disponíveis do caso e compare-as com até cinco coortes LLA já carregadas. A saída é uma <strong>síntese exploratória de apoio ao prognóstico acadêmico</strong>, não um diagnóstico clínico.</p>
    </div>
    <div class="patient-hero__badge"><i class="fa-solid fa-shield-heart"></i><span>Dados ficam neste navegador</span></div>
  </section>

  <div class="patient-workflow">
    <aside class="patient-workflow__rail">
      <a href="#caso"><b>1</b><span>Identificação</span></a>
      <a href="#clinica"><b>2</b><span>Dados clínicos</span></a>
      <a href="#biomarcadores"><b>3</b><span>Biomarcadores</span></a>
      <a href="#coortes"><b>4</b><span>Coortes</span></a>
      <a href="#executar"><b>5</b><span>Analisar</span></a>
    </aside>

    <div class="patient-workflow__body">
      <section class="clinical-panel" id="caso">
        <div class="clinical-panel__head"><div><span>ETAPA 1</span><h2>Identificação do caso</h2><p>Use identificador ou apelido. Evite inserir informações pessoais desnecessárias em demonstrações públicas.</p></div><i class="fa-solid fa-id-card-clip"></i></div>
        <div class="patient-toolbar">
          <div class="form-group"><label class="form-label">Carregar paciente salvo</label><select class="form-select" id="saved-patient">${patientOptions()}</select></div>
          <button class="btn btn-secondary" id="save-patient" type="button"><i class="fa-solid fa-floppy-disk"></i> Salvar cadastro</button>
        </div>
        <div class="form-grid mt-4">
          <div class="form-group"><label class="form-label">Identificador do caso *</label><input class="form-input" id="p-id" placeholder="Ex.: LLA-001"></div>
          <div class="form-group"><label class="form-label">Nome/apelido</label><input class="form-input" id="p-name" placeholder="Opcional"></div>
          <div class="form-group"><label class="form-label">Profissional responsável</label><select class="form-select" id="p-doctor">${doctorOptions()}</select></div>
          <div class="form-group"><label class="form-label">Observação</label><input class="form-input" id="p-note" placeholder="Opcional"></div>
        </div>
        <details class="clinical-details mt-4">
          <summary><i class="fa-solid fa-user-doctor"></i> Cadastrar profissional responsável</summary>
          <div class="form-grid mt-4">
            <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" id="d-name"></div>
            <div class="form-group"><label class="form-label">CRM / identificação</label><input class="form-input" id="d-id"></div>
            <div class="form-group"><label class="form-label">Instituição</label><input class="form-input" id="d-inst"></div>
            <div class="form-group"><label class="form-label">E-mail</label><input class="form-input" id="d-email" type="email"></div>
          </div>
          <button class="btn btn-secondary mt-3" id="save-doctor" type="button"><i class="fa-solid fa-floppy-disk"></i> Salvar profissional</button>
          <div id="doctor-msg" class="mt-3"></div>
        </details>
        <div id="patient-msg" class="mt-3"></div>
      </section>

      <section class="clinical-panel" id="clinica">
        <div class="clinical-panel__head"><div><span>ETAPA 2</span><h2>Dados clínicos comparáveis</h2><p>Todos são opcionais, mas quanto mais critérios disponíveis, melhor a capacidade de formar uma coorte de perfis semelhantes.</p></div><i class="fa-solid fa-notes-medical"></i></div>
        <div class="form-grid">
          <div class="form-group"><label class="form-label">Idade (anos)</label><input class="form-input" id="p-age" type="number" min="0" max="120" step="0.1"></div>
          <div class="form-group"><label class="form-label">Sexo</label><select class="form-select" id="p-sex"><option value="">Não informado</option><option value="F">Feminino</option><option value="M">Masculino</option></select></div>
          <div class="form-group"><label class="form-label">Leucócitos / WBC</label><input class="form-input" id="p-wbc" type="number" min="0" step="any" placeholder="Na unidade usada pela coorte"></div>
          <div class="form-group"><label class="form-label">Subtipo molecular</label><input class="form-input" id="p-subtype" placeholder="Ex.: Ph-like, ETV6-RUNX1..."></div>
          <div class="form-group"><label class="form-label">BCR-ABL1</label><select class="form-select" id="p-bcr"><option value="nao_informado">Não informado</option><option value="positivo">Positivo</option><option value="negativo">Negativo</option></select></div>
          <div class="form-group"><label class="form-label">Recaída informada</label><select class="form-select" id="p-relapse"><option value="">Não informado</option><option value="nao">Não</option><option value="sim">Sim</option></select></div>
        </div>
      </section>

      <section class="clinical-panel" id="biomarcadores">
        <div class="clinical-panel__head"><div><span>ETAPA 3</span><h2>Biomarcadores</h2><p>Marque os genes que fazem parte do caso. Alteração e expressão podem ser preenchidas independentemente; campo vazio nunca é tratado como zero.</p></div><i class="fa-solid fa-dna"></i></div>
        <div class="biomarker-head"><span>Gene</span><span>Alteração</span><span>Expressão</span></div>
        <div class="patient-biomarker-list">${geneRows}</div>
        <div class="analysis-note mt-4"><strong>Escala de expressão:</strong> use valores compatíveis com o perfil molecular da coorte selecionada. Quando a coorte exige transformação log2(x+1), o GENESIS aplica a mesma transformação ao valor informado antes da comparação.</div>
      </section>

      <section class="clinical-panel" id="coortes">
        <div class="clinical-panel__head"><div><span>ETAPA 4</span><h2>Coortes de referência</h2><p>Selecione de 1 a 5 estudos já carregados. As coortes são analisadas separadamente; resultados incompatíveis não são fundidos.</p></div><i class="fa-solid fa-hospital-user"></i></div>
        <div id="patient-study-list" class="patient-study-list">${studyHtml}</div>
        <div id="study-select-msg" class="mt-3"></div>
        ${loadedStudies.length?'<a class="inline-medical-link mt-4" href="resultados.html"><i class="fa-solid fa-plus"></i> Carregar ou revisar outras coortes</a>':''}
      </section>

      <section class="clinical-panel patient-run-panel" id="executar">
        <div class="clinical-panel__head"><div><span>ETAPA 5</span><h2>Executar análise</h2><p>O motor usa dados de expressão/mutação disponíveis, Cox univariado, Kaplan–Meier e pareamento heurístico de perfis semelhantes quando os critérios mínimos são atendidos.</p></div><i class="fa-solid fa-microscope"></i></div>
        <div class="patient-consent-note"><i class="fa-solid fa-circle-info"></i><p><strong>Interpretação correta:</strong> “favorável”, “desfavorável” ou “misto” descreve a direção das associações exploratórias nas coortes de referência. Não significa diagnóstico, estágio da doença ou probabilidade individual de sobrevivência.</p></div>
        <div class="analysis-actions mt-5">
          <button class="btn btn-primary btn-lg" id="run-patient-analysis" ${loadedStudies.length?'':'disabled'}><i class="fa-solid fa-play"></i> Analisar paciente</button>
          <button class="btn btn-ghost btn-lg" id="reset-patient-form"><i class="fa-solid fa-rotate-left"></i> Limpar formulário</button>
        </div>
        <div id="analysis-progress" class="mt-4"></div>
      </section>

      <section id="patient-analysis-output" class="mt-6"></section>
    </div>
  </div>`;
}

function bindPage(){
  document.getElementById('saved-patient')?.addEventListener('change',loadSavedPatient);
  document.getElementById('save-patient')?.addEventListener('click',savePatient);
  document.getElementById('save-doctor')?.addEventListener('click',saveDoctor);
  document.getElementById('run-patient-analysis')?.addEventListener('click',runAnalysis);
  document.getElementById('reset-patient-form')?.addEventListener('click',resetForm);
  document.querySelectorAll('.patient-study').forEach(cb=>cb.addEventListener('change',enforceStudyLimit));
  document.querySelectorAll('.patient-gene').forEach(cb=>cb.addEventListener('change',()=>syncGeneRow(cb)));
  document.querySelectorAll('.patient-gene').forEach(syncGeneRow);
  window.addEventListener('genesis:themechange',()=>{if(lastResult)renderCharts(lastResult);});
}

function syncGeneRow(cb){
  const row=cb.closest('.patient-biomarker-row');
  row?.classList.toggle('selected',cb.checked);
  row?.querySelectorAll('select,input.patient-expression').forEach(el=>{el.disabled=el.dataset.locked==='true'||!cb.checked;});
}

function enforceStudyLimit(e){
  const checked=[...document.querySelectorAll('.patient-study:checked')];
  if(checked.length>5){
    e.target.checked=false;
    showMessage('study-select-msg','Selecione no máximo cinco coortes por análise.','warning');
  }else clearMessage('study-select-msg');
}

function loadSavedPatient(e){
  const idx=Number(e.target.value);
  if(!Number.isInteger(idx)||e.target.value==='')return;
  const p=read(PATIENTS_KEY)[idx];
  if(!p)return;
  document.getElementById('p-id').value=p.id||'';
  document.getElementById('p-name').value=p.name||'';
  document.getElementById('p-age').value=p.age??'';
  document.getElementById('p-sex').value=normalizeSex(p.sex);
  document.getElementById('p-wbc').value=p.wbc??'';
  document.getElementById('p-subtype').value=p.subtype||'';
  document.getElementById('p-note').value=p.note||'';
  document.getElementById('p-bcr').value=['positivo','negativo'].includes(p.bcrAbl1)?p.bcrAbl1:'nao_informado';
  document.getElementById('p-relapse').value=p.relapse===true?'sim':p.relapse===false?'nao':'';

  const doctors=read(DOCTORS_KEY);
  const doctorIndex=doctors.findIndex(d=>p.doctorRef&&(
    (p.doctorRef.identifier&&d.identifier===p.doctorRef.identifier) ||
    (!p.doctorRef.identifier&&d.name===p.doctorRef.name)
  ));
  document.getElementById('p-doctor').value=doctorIndex>=0?String(doctorIndex):'';

  const savedGenes=Array.isArray(p.genes)?new Set(p.genes):null;
  document.querySelectorAll('.patient-gene').forEach(cb=>{
    cb.checked=savedGenes?savedGenes.has(cb.value):DEFAULT_GENES.has(cb.value);
    const alteration=document.querySelector(`.patient-alteration[data-gene="${cb.value}"]`);
    const expression=document.querySelector(`.patient-expression[data-gene="${cb.value}"]`);
    if(alteration)alteration.value=p.alterations?.[cb.value]||'nao_informado';
    if(expression)expression.value=p.expression?.[cb.value]??'';
    syncGeneRow(cb);
  });
  showMessage('patient-msg','Cadastro completo carregado. Revise biomarcadores e coortes antes de analisar.','success');
}
function normalizeSex(v){
  const s=String(v||'').toUpperCase();
  if(s==='F' || s.startsWith('FEM'))return'F';
  if(s==='M' || s.startsWith('MAS'))return'M';
  return'';
}

function saveDoctor(){
  const name=document.getElementById('d-name')?.value.trim();
  if(!name)return showMessage('doctor-msg','Informe o nome do profissional.','warning');
  const obj={
    name,
    identifier:document.getElementById('d-id')?.value.trim()||'',
    institution:document.getElementById('d-inst')?.value.trim()||'',
    email:document.getElementById('d-email')?.value.trim()||'',
    createdAt:new Date().toISOString()
  };
  const arr=read(DOCTORS_KEY);
  arr.unshift(obj);
  write(DOCTORS_KEY,arr.slice(0,100));
  const select=document.getElementById('p-doctor');
  if(select){
    select.innerHTML=doctorOptions();
    select.value='0';
  }
  ['d-name','d-id','d-inst','d-email'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  showMessage('doctor-msg','Profissional salvo localmente e vinculado ao caso.','success');
}

function savePatient(){
  const id=document.getElementById('p-id').value.trim();
  if(!id)return showMessage('patient-msg','Informe o identificador do caso antes de salvar.','warning');
  const doctorIdx=document.getElementById('p-doctor').value;
  const doctor=doctorIdx===''?null:read(DOCTORS_KEY)[Number(doctorIdx)]||null;
  const genes=[...document.querySelectorAll('.patient-gene:checked')].map(x=>x.value);
  const alterations={},expression={};
  for(const gene of genes){
    const alteration=document.querySelector(`.patient-alteration[data-gene="${gene}"]`)?.value||'nao_informado';
    if(alteration!=='nao_informado')alterations[gene]=alteration;
    const value=finiteOrNull(document.querySelector(`.patient-expression[data-gene="${gene}"]`)?.value);
    if(value!=null)expression[gene]=value;
  }
  const relapse=document.getElementById('p-relapse').value;
  const obj={
    id,
    name:document.getElementById('p-name').value.trim(),
    age:finiteOrNull(document.getElementById('p-age').value),
    sex:document.getElementById('p-sex').value,
    wbc:finiteOrNull(document.getElementById('p-wbc').value),
    subtype:document.getElementById('p-subtype').value.trim(),
    note:document.getElementById('p-note').value.trim(),
    bcrAbl1:document.getElementById('p-bcr').value,
    relapse:relapse===''?null:relapse==='sim',
    doctorRef:doctor?{name:doctor.name,identifier:doctor.identifier||'',institution:doctor.institution||''}:null,
    genes,alterations,expression,
    updatedAt:new Date().toISOString()
  };
  const arr=read(PATIENTS_KEY);
  const existing=arr.findIndex(x=>String(x.id)===id);
  let selectedIndex=0;
  if(existing>=0){arr[existing]={...arr[existing],...obj};selectedIndex=existing;}else arr.unshift(obj);
  write(PATIENTS_KEY,arr.slice(0,100));
  const select=document.getElementById('saved-patient');
  select.innerHTML=patientOptions();
  select.value=String(selectedIndex);
  showMessage('patient-msg',existing>=0?'Cadastro completo atualizado localmente.':'Paciente e biomarcadores salvos localmente.','success');
}

function finiteOrNull(v){
  if(v==null||String(v).trim()==='')return null;
  const x=Number(String(v).replace(',','.'));
  return Number.isFinite(x)?x:null;
}

function buildPayload(){
  const id=document.getElementById('p-id').value.trim();
  if(!id)throw new Error('Informe o identificador do caso.');
  const genes=[...document.querySelectorAll('.patient-gene:checked')].map(x=>x.value);
  if(!genes.length)throw new Error('Selecione pelo menos um biomarcador.');
  const studyIds=[...document.querySelectorAll('.patient-study:checked')].map(x=>x.value);
  if(!studyIds.length)throw new Error('Selecione pelo menos uma coorte de referência.');
  if(studyIds.length>5)throw new Error('Selecione no máximo cinco coortes.');

  const alteracoes={},expressao={};
  for(const gene of genes){
    const a=document.querySelector(`.patient-alteration[data-gene="${gene}"]`)?.value||'nao_informado';
    if(a!=='nao_informado')alteracoes[gene]=a;
    const raw=document.querySelector(`.patient-expression[data-gene="${gene}"]`)?.value;
    const value=finiteOrNull(raw);
    if(value!=null)expressao[gene]=value;
  }
  const relapse=document.getElementById('p-relapse').value;
  const doctorIdx=document.getElementById('p-doctor').value;
  const doctor=doctorIdx===''?null:read(DOCTORS_KEY)[Number(doctorIdx)]||null;
  return {
    id,
    nome:document.getElementById('p-name').value.trim(),
    idade:finiteOrNull(document.getElementById('p-age').value),
    sexo:document.getElementById('p-sex').value,
    leucocitos:finiteOrNull(document.getElementById('p-wbc').value),
    subtipoMolecular:document.getElementById('p-subtype').value.trim(),
    observacao:document.getElementById('p-note').value.trim(),
    recaida:relapse===''?null:relapse==='sim',
    profissional:doctor?{name:doctor.name,identifier:doctor.identifier||'',institution:doctor.institution||''}:null,
    biomarcadores:genes,
    alteracoes,
    expressao,
    fusoes:{'BCR-ABL1':document.getElementById('p-bcr').value},
    studyIds
  };
}

async function runAnalysis(){
  clearMessage('analysis-progress');
  const btn=document.getElementById('run-patient-analysis');
  let payload;
  try{payload=buildPayload();}catch(err){showMessage('analysis-progress',err.message||err,'warning');return;}
  btn.disabled=true;
  const old=btn.innerHTML;
  btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Analisando coortes…';
  document.getElementById('analysis-progress').innerHTML=`<div class="patient-progress"><div class="patient-progress__bar"><span></span></div><p>Organizando o caso, alinhando biomarcadores e executando as análises disponíveis…</p></div>`;
  try{
    await new Promise(r=>setTimeout(r,30));
    const result=await analyzePatient(payload);
    if(!result.studyResults?.length)throw new Error('Nenhuma das coortes selecionadas pôde ser analisada. Reconstrua o estudo e confirme se há dados clínicos/moleculares disponíveis.');
    lastResult=result;
    salvarAnaliseAtual(result);
    adicionarAnalise(result);
    renderResult(result);
    document.getElementById('patient-analysis-output')?.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(err){
    console.error('[GENESIS] Falha na análise do paciente',err);
    showMessage('analysis-progress',`Falha na análise: ${err.message||err}`,'danger');
  }finally{
    btn.disabled=false;
    btn.innerHTML=old;
  }
}

function signalLabel(ev){
  if(ev.sinal==='favoravel')return['favoravel','Associação favorável'];
  if(ev.sinal==='desfavoravel')return['desfavoravel','Associação desfavorável'];
  return['inconclusivo','Inconclusivo'];
}
function qualityClass(score){return score>=80?'high':score>=60?'mid':'low';}


function patientMatchedGraphReport(studyResult) {
  const m = studyResult?.matched;
  if (!m?.available) return '';
  const groups = m.groups || [];
  const similar = groups.find(g => String(g.name).toLowerCase().includes('semelh'));
  const rest = groups.find(g => !String(g.name).toLowerCase().includes('semelh'));
  return graphReport({
    what: 'Curva Kaplan–Meier descritiva que compara a Sobrevida Global observada no grupo de perfis mais semelhantes ao caso com os demais pacientes da mesma coorte.',
    finding: `O pareamento formou ${m.nMatched} perfil(is) semelhante(s), com ${m.nEvents} evento(s) de OS e similaridade mediana ${nfmt(m.medianSimilarity,1)}/100.${similar && rest ? ` As curvas exibidas correspondem a ${similar.name} (n=${similar.n}) e ${rest.name} (n=${rest.n}).` : ''}`,
    caution: 'O pareamento é heurístico e não validado clinicamente. A curva pertence aos grupos de referência e não deve ser convertida em probabilidade individual de sobrevivência, diagnóstico ou recomendação terapêutica.',
    source: 'Análise do paciente · exploratória',
  });
}

function renderResult(r){
  destroyCharts();
  const host=document.getElementById('patient-analysis-output');
  const evidenceRows=(r.evidencias||[]).map(ev=>{
    const [cls,label]=signalLabel(ev);
    const c=ev.cox;
    return `<tr>
      <td><strong>${esc(ev.gene)}</strong><br><span class="signal ${cls}">${label}</span></td>
      <td>${ev.patientExpression!=null?`${nfmt(ev.patientExpression,3)}${ev.patientGroup?` · ${esc(ev.patientGroup)}`:''}${ev.referencePosition?`<br><span class="cohort-reference ${ev.referencePosition.startsWith('Dentro')?'within':'outside'}">${esc(ev.referencePosition)}</span>`:''}${ev.q25!=null&&ev.q75!=null?`<br><small>Q25–Q75: ${nfmt(ev.q25,3)}–${nfmt(ev.q75,3)}</small>`:''}`:'Não informado'}</td>
      <td>${c?`HR ${nfmt(c.HR,3)}<br><small>IC95% ${nfmt(c.HR_lower,3)}–${nfmt(c.HR_upper,3)}</small>`:'—'}</td>
      <td>${c?`p ${formatP(c.p_value)}<br><small>FDR ${formatP(c.q_value)}</small>`:'—'}</td>
      <td><span class="quality-badge ${qualityClass(ev.reliability?.score||0)}">${esc(ev.reliability?.label||'—')} · ${ev.reliability?.score||0}/100</span></td>
      <td class="evidence-summary-cell">${esc(ev.resumo||'—')}</td>
    </tr>`;
  }).join('');

  const studyCards=(r.studyResults||[]).map((s,i)=>{
    const m=s.matched;
    return `<article class="matched-study-card">
      <div class="matched-study-card__head"><div><span>COORTE ${i+1}</span><h3>${esc(s.studyName)}</h3><small>${esc(s.studyId)}</small></div><span class="quality-badge ${qualityClass(s.dataQuality?.score||0)}">${esc(s.dataQuality?.label||'—')} · ${s.dataQuality?.score||0}/100</span></div>
      ${m?.available?`<div class="matched-summary"><div><span>Perfis semelhantes</span><strong>${m.nMatched}</strong></div><div><span>Eventos</span><strong>${m.nEvents}</strong></div><div><span>Similaridade mediana</span><strong>${nfmt(m.medianSimilarity,1)}/100</strong></div><div><span>Força</span><strong>${esc(m.strength)}</strong></div></div><div class="chart-wrap patient-result-km"><canvas id="patient-km-${i}"></canvas></div>${patientMatchedGraphReport(s)}<p class="chart-note">${esc(m.note||'')}</p>`:`<div class="empty-science compact">${esc(m?.reason||'Não foi possível formar grupo de perfis semelhantes nesta coorte.')}</div>`}
    </article>`;
  }).join('');

  host.innerHTML=`
    <div class="result-section-title"><span>RESULTADO DO CASO</span><h2>Síntese exploratória de ${esc(r.nome||r.id)}</h2><p>Gerada em ${new Date(r.data).toLocaleString('pt-BR')} com ${r.studyResults.length} coorte(s) de referência.</p></div>
    <div class="patient-result-hero ${esc(r.perfil?.className||'neutral')}">
      <div><span>SÍNTESE EXPLORATÓRIA</span><h2>${esc(r.perfil?.label||'Inconclusivo')}</h2><p>${esc(r.interpretacao||'')}</p></div>
      <div class="patient-result-quality"><span>Qualidade técnica média</span><strong>${r.dataQuality?.score||0}/100</strong><small>${esc(r.dataQuality?.label||'—')}</small></div>
    </div>
    <div class="patient-result-kpis">
      <div><i class="fa-solid fa-dna"></i><span>Biomarcadores</span><strong>${r.biomarcadores?.length||0}</strong></div>
      <div><i class="fa-solid fa-database"></i><span>Coortes usadas</span><strong>${r.studyResults?.length||0}</strong></div>
      <div><i class="fa-solid fa-arrow-trend-up"></i><span>Favoráveis</span><strong>${r.perfil?.favoraveis||0}</strong></div>
      <div><i class="fa-solid fa-arrow-trend-down"></i><span>Desfavoráveis</span><strong>${r.perfil?.desfavoraveis||0}</strong></div>
    </div>

    <div class="card mt-6">
      <div class="card__header"><div><div class="card__title"><i class="fa-solid fa-microscope"></i> Evidências por biomarcador</div><div class="card__subtitle">Cox por 1 desvio-padrão de expressão; FDR calculado entre os genes analisados na execução. A faixa Q25–Q75 indica a região central observada na coorte e não uma “normalidade” clínica.</div></div></div>
      <div class="table-wrap"><table class="data-table patient-evidence-table"><thead><tr><th>Gene</th><th>Posição do caso</th><th>Cox</th><th>Significância</th><th>Força técnica</th><th>Interpretação</th></tr></thead><tbody>${evidenceRows||'<tr><td colspan="6">Sem evidências calculáveis.</td></tr>'}</tbody></table></div>
    </div>

    <div class="mt-6">
      <div class="result-section-title compact"><span>PERFIS SEMELHANTES</span><h2>Experiência observada nas coortes de referência</h2><p>As curvas pertencem aos grupos comparados; não representam uma probabilidade individual para o caso.</p></div>
      <div class="matched-study-grid">${studyCards}</div>
    </div>

    <div class="card mt-6">
      <div class="card__header"><div><div class="card__title"><i class="fa-solid fa-file-medical"></i> Relatório do caso</div><div class="card__subtitle">Exporte a síntese com a identificação de uso acadêmico.</div></div></div>
      <div class="analysis-actions">
        <button class="btn btn-primary" id="download-report"><i class="fa-solid fa-file-lines"></i> Baixar relatório TXT</button>
        <button class="btn btn-secondary" id="download-json"><i class="fa-solid fa-file-code"></i> Baixar JSON auditável</button>
        <button class="btn btn-ghost" id="print-report"><i class="fa-solid fa-print"></i> Imprimir / PDF</button>
      </div>
      <div class="clinical-gate mt-4"><i class="fa-solid fa-triangle-exclamation"></i><div><strong>Não é laudo ou diagnóstico.</strong> O relatório descreve associações exploratórias e grupos de referência. A interpretação clínica depende de equipe habilitada, métodos laboratoriais validados e contexto assistencial.</div></div>
    </div>`;

  document.getElementById('download-report').onclick=()=>downloadBlob(`GENESIS_${safeName(r.id)}_relatorio.txt`,gerarRelatorioTexto(r),'text/plain;charset=utf-8');
  document.getElementById('download-json').onclick=()=>downloadBlob(`GENESIS_${safeName(r.id)}_auditoria.json`,JSON.stringify(r,null,2),'application/json');
  document.getElementById('print-report').onclick=()=>window.print();
  renderCharts(r);
  document.getElementById('analysis-progress').innerHTML='<div class="alert success"><i class="fa-solid fa-circle-check"></i> Análise concluída e salva no histórico local.</div>';
}

function renderCharts(r){
  destroyCharts();
  const theme=getChartTheme();
  const secondary=getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim()||'#0f9f96';
  (r.studyResults||[]).forEach((s,i)=>{
    const canvas=document.getElementById(`patient-km-${i}`);
    const groups=s.matched?.available?s.matched.groups||[]:[];
    if(!canvas||!groups.length)return;
    charts.push(new Chart(canvas,{
      type:'line',
      data:{datasets:groups.map((g,j)=>({
        label:`${g.name} · n=${g.n}`,
        data:(g.points||[]).map(p=>({x:p.x,y:p.y*100})),
        borderColor:j===0?theme.primary:secondary,
        backgroundColor:'transparent',
        borderWidth:j===0?3:2,
        pointRadius:0,
        stepped:'after'
      }))},
      options:{
        responsive:true,maintainAspectRatio:false,animation:false,
        interaction:{mode:'nearest',intersect:false},
        scales:{
          x:{type:'linear',title:{display:true,text:'Meses',color:theme.text},ticks:{color:theme.muted},grid:{color:theme.grid}},
          y:{min:0,max:100,title:{display:true,text:'Sobrevida observada (%)',color:theme.text},ticks:{color:theme.muted,callback:v=>`${v}%`},grid:{color:theme.grid}}
        },
        plugins:{legend:{labels:{color:theme.text,usePointStyle:true}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${Number(c.parsed.y).toFixed(1)}%`}}}
      }
    }));
  });
}
function destroyCharts(){charts.forEach(c=>{try{c.destroy()}catch{}});charts=[];}
function formatP(v){
  const x=Number(v);
  if(!Number.isFinite(x))return'—';
  return x<0.001?x.toExponential(2):x.toFixed(3);
}
function safeName(v){return String(v||'caso').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'')||'caso';}
function downloadBlob(name,text,type){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function resetForm(){
  if(!confirm('Limpar os dados preenchidos deste formulário?'))return;
  document.querySelectorAll('#caso input,#clinica input').forEach(x=>x.value='');
  document.querySelectorAll('#caso select,#clinica select').forEach(x=>x.selectedIndex=0);
  document.querySelectorAll('.patient-alteration').forEach(x=>x.value='nao_informado');
  document.querySelectorAll('.patient-expression').forEach(x=>x.value='');
  document.querySelectorAll('.patient-gene').forEach(x=>{x.checked=DEFAULT_GENES.has(x.value);syncGeneRow(x);});
  const saved=document.getElementById('saved-patient');if(saved)saved.value='';
  lastResult=null;destroyCharts();document.getElementById('patient-analysis-output').innerHTML='';clearMessage('analysis-progress');clearMessage('patient-msg');
}

init().catch(err=>{
  console.error(err);
  content.innerHTML=`${warningBanner()}<div class="card"><div class="alert danger"><strong>Falha ao abrir o módulo do paciente.</strong><br>${esc(err.message||err)}</div></div>`;
});
