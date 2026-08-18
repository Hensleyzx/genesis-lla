import { buildDatapack, loadDatapack, clearDatapack, listLoadedStudyMeta, setActiveStudy } from './datapack.js';
import { cbio, DEFAULT_LLA_STUDY, rawStudyDownloadUrl, CORE_LLA_STUDY_IDS } from './cbio-api.js';
import { buildStudyAnalytics } from './research-analytics.js';
import { technicalReliability } from './quality.js';

const COMPARE_KEY='genesis_compare_studies_v5';
function fmtDate(x){try{return new Date(x).toLocaleString('pt-BR')}catch{return x}}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function studyOption(s){return `<option value="${esc(s.studyId)}" ${s.studyId===DEFAULT_LLA_STUDY?'selected':''}>${esc(s.name)} · ${Number(s.allSampleCount||0).toLocaleString('pt-BR')} amostras totais no estudo</option>`}
function getCompareIds(){try{return JSON.parse(localStorage.getItem(COMPARE_KEY)||'[]')}catch{return[]}}
function saveCompareIds(ids){localStorage.setItem(COMPARE_KEY,JSON.stringify([...new Set(ids)]));}

export async function renderStudyManager(container,{onReady,simple=false}={}){
  const root=typeof container==='string'?document.querySelector(container):container;if(!root)return null;
  const dp=await loadDatapack().catch(()=>null);
  const loaded=await listLoadedStudyMeta().catch(()=>[]);
  root.innerHTML=`
    ${dp?activePackHtml(dp):''}
    ${!simple&&loaded.length?loadedStudiesHtml(loaded,dp?.pack?.studyId):''}
    <div class="card study-catalog-card ${(dp||loaded.length)?'mt-6':''}">
      <div class="card__header"><div><div class="card__title"><i class="fa-solid fa-cloud-arrow-down"></i> cBioPortal — 5 coortes LLA selecionadas</div><div class="card__subtitle">Consulte, armazene e compare mais de uma coorte pública de Leucemia Linfoblástica/Linfoide Aguda no mesmo navegador.</div></div><span class="study-pill ready" id="api-status"><i class="fa-solid fa-spinner fa-spin"></i> Consultando API</span></div>
      ${simple?'':`<div class="catalog-metrics mt-4"><div><strong id="catalog-total">—</strong><span>estudos no cBioPortal</span></div><div><strong id="catalog-lla">—</strong><span>coortes LLA identificadas</span></div><div><strong>${loaded.length}</strong><span>estudos carregados localmente</span></div></div>
      <div class="analysis-note mt-4"><strong>Multicoorte:</strong> você pode carregar 2–5 estudos e compará-los lado a lado. O GENESIS não mistura automaticamente endpoints ou escalas incompatíveis; cada coorte mantém seus próprios resultados e qualidade técnica.</div>`}
      <div class="study-browser mt-4">
        <div class="form-group"><label class="form-label">Buscar nas 5 coortes selecionadas</label><div class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="lla-study-search" placeholder="Ex.: TARGET, St. Jude"></div></div>
        <div class="form-group"><label class="form-label">Estudo LLA</label><select class="form-select" id="lla-study-select"><option>Carregando estudos…</option></select></div>
        <div class="form-group"><label class="form-label">Escopo molecular</label><select class="form-select" id="lla-study-scope"><option value="expresso">Expresso — painel GENESIS + até 500 genes mais mutados</option><option value="completo">Completo — todos os genes disponíveis (pesado)</option></select></div>
      </div>
      <div id="study-inspection" class="study-inspection mt-4"></div>
      <div class="study-actions">
        <button class="btn btn-secondary" id="inspect-study"><i class="fa-solid fa-stethoscope"></i> Verificar estudo</button>
        <button class="btn btn-primary" id="load-study"><i class="fa-solid fa-database"></i> ${simple?'Carregar estudo':'Carregar/adicionar'}</button>
        ${simple?'':'<button class="btn btn-secondary" id="load-five"><i class="fa-solid fa-layer-group"></i> Carregar os 5 (Expresso)</button>'}
        <a class="btn btn-ghost" id="raw-study" href="#" target="_blank" rel="noopener"><i class="fa-solid fa-file-zipper"></i> Baixar pacote bruto</a>
      </div>
      <div class="study-progress"><div data-study-progress></div></div><div class="study-log" data-study-log>Selecione uma coorte. Para apresentação, carregue primeiro TARGET ALL e depois as demais que desejar comparar.</div>
    </div>`;

  const select=root.querySelector('#lla-study-select'),search=root.querySelector('#lla-study-search'),status=root.querySelector('#api-status');let lla=[];
  const fillStudies=(items,keepValue=true)=>{const previous=keepValue?select.value:'';select.innerHTML=items.length?items.map(studyOption).join(''):'<option value="">Nenhum estudo corresponde à busca</option>';if(previous&&items.some(s=>s.studyId===previous))select.value=previous;else if(dp?.pack?.studyId&&items.some(s=>s.studyId===dp.pack.studyId))select.value=dp.pack.studyId;else if(items.some(s=>s.studyId===DEFAULT_LLA_STUDY))select.value=DEFAULT_LLA_STUDY;updateRaw();};
  try{
    const cat=await cbio.listLlaStudies();lla=cat.core;
    if(root.querySelector('#catalog-total'))root.querySelector('#catalog-total').textContent=cat.all.length.toLocaleString('pt-BR');
    if(root.querySelector('#catalog-lla'))root.querySelector('#catalog-lla').textContent=lla.length.toLocaleString('pt-BR');
    fillStudies(lla,false);
    status.innerHTML=`<i class="fa-solid fa-circle-check"></i> API online · ${lla.length}/${CORE_LLA_STUDY_IDS.length} coortes`;
    if(cat.missingCoreIds.length)root.querySelector('[data-study-log]').textContent=`A API não retornou: ${cat.missingCoreIds.join(', ')}. As demais coortes continuam disponíveis.`;
  }catch(err){console.error(err);status.classList.remove('ready');status.innerHTML='<i class="fa-solid fa-triangle-exclamation"></i> API indisponível';select.innerHTML=`<option value="${DEFAULT_LLA_STUDY}">TARGET ALL Phase II</option>`;root.querySelector('[data-study-log]').textContent=`Falha ao consultar catálogo: ${err.message||err}`;}

  function updateRaw(){const a=root.querySelector('#raw-study');if(a)a.href=select.value?rawStudyDownloadUrl(select.value):'#';}
  updateRaw();
  select.addEventListener('change',()=>{updateRaw();root.querySelector('#study-inspection').innerHTML='';});
  search?.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();const filtered=!q?lla:lla.filter(s=>`${s.studyId} ${s.name} ${s.description||''}`.toLowerCase().includes(q));fillStudies(filtered);root.querySelector('#study-inspection').innerHTML='';});
  root.querySelector('#inspect-study').addEventListener('click',()=>inspectSelected(root,select.value));
  root.querySelector('#load-study').addEventListener('click',()=>startBuild(root,select.value,root.querySelector('#lla-study-scope').value,onReady,simple));
  root.querySelector('#load-five')?.addEventListener('click',()=>loadFive(root,lla,onReady,simple));

  root.querySelectorAll('[data-study-active]').forEach(b=>b.addEventListener('click',async()=>{await setActiveStudy(b.dataset.studyActive);await renderStudyManager(root,{onReady,simple});onReady?.(await loadDatapack());}));
  root.querySelectorAll('[data-study-clear-one]').forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.studyClearOne;if(!confirm(`Apagar ${id} do cache local?`))return;await clearDatapack(id);await renderStudyManager(root,{onReady,simple});onReady?.(await loadDatapack());}));
  const compareBoxes=[...root.querySelectorAll('.study-compare-check')];
  compareBoxes.forEach(c=>c.addEventListener('change',()=>{const ids=compareBoxes.filter(x=>x.checked).map(x=>x.value);saveCompareIds(ids);renderComparison(root,ids);}));
  if(compareBoxes.length)await renderComparison(root,compareBoxes.filter(x=>x.checked).map(x=>x.value));
  if(dp){root.querySelector('[data-study-rebuild]')?.addEventListener('click',()=>startBuild(root,dp.pack.studyId,dp.pack.scope,onReady,simple));root.querySelector('[data-study-clear]')?.addEventListener('click',async()=>{if(!confirm('Apagar o estudo ativo deste navegador?'))return;await clearDatapack(dp.pack.studyId);await renderStudyManager(root,{onReady,simple});onReady?.(await loadDatapack());});}
  return dp;
}

function activePackHtml(dp){
  const p=dp.pack,c=p.capabilities||{};const status=[c.clinical?'Clínico':'—',c.mutation?'Mutações':'—',c.expression?'Expressão':'—',c.survival?'Sobrevida':'—'].filter(x=>x!=='—').join(' · ')||'Metadados';
  let q={score:0,label:'—'};try{q=technicalReliability(dp,buildStudyAnalytics(dp));}catch{}
  return `<div class="card study-card"><div class="card__header"><div><div class="card__title"><i class="fa-solid fa-database"></i> Estudo LLA ativo</div><div class="card__subtitle">${esc(p.studyName)}</div></div><span class="quality-badge ${q.score>=80?'high':q.score>=60?'mid':'low'}">Qualidade ${q.label} · ${q.score}/100</span></div><div class="study-status"><span class="study-pill"><i class="fa-solid fa-users"></i> ${p.nPatients} pacientes na seleção basal</span><span class="study-pill"><i class="fa-solid fa-vial"></i> ${p.nAnalysisSamples} amostras basais de expressão</span><span class="study-pill"><i class="fa-solid fa-vials"></i> ${p.nRnaSamples||0} amostras no perfil de expressão</span><span class="study-pill"><i class="fa-solid fa-dna"></i> ${p.nGenes} genes carregados</span><span class="study-pill"><i class="fa-solid fa-layer-group"></i> ${p.scope==='completo'?'Completo':'Expresso'}</span></div><p class="chart-note"><strong>Módulos:</strong> ${esc(status)}. ${esc(p.selection?.method||'Coorte clínica carregada.')} Perfil: ${esc(p.expressionProfileName||p.expressionProfileId||'—')} · case list: ${esc(p.expressionSampleListName||p.expressionSampleListId||'—')}. Escala da análise basal: ${esc(p.expressionTransform?.label||'—')}. O modo compatível com referência R preserva a escala/procedimento de referência quando selecionado, sem afirmar equivalência integral sem os dados brutos originais. <strong>Qualidade técnica</strong> mede completude/adequação do dataset, não confiança diagnóstica.</p><div class="study-actions"><button class="btn btn-secondary btn-sm" data-study-rebuild><i class="fa-solid fa-rotate"></i> Reconstruir</button><button class="btn btn-danger btn-sm" data-study-clear><i class="fa-solid fa-trash"></i> Apagar ativo</button></div></div>`;
}

function loadedStudiesHtml(loaded,activeId){
  const selected=new Set(getCompareIds());
  if(selected.size<2)loaded.slice(0,2).forEach(x=>selected.add(x.studyId));
  return `<div class="card mt-6"><div class="card__header"><div><div class="card__title"><i class="fa-solid fa-code-compare"></i> Estudos carregados — comparação simultânea</div><div class="card__subtitle">Marque 2–5 coortes para comparar disponibilidade, amostragem e qualidade técnica sem juntar resultados incompatíveis.</div></div><span class="study-pill">${loaded.length} no cache</span></div><div class="loaded-study-list mt-4">${loaded.map(p=>`<div class="loaded-study-row"><label class="study-check"><input class="study-compare-check" type="checkbox" value="${esc(p.studyId)}" ${selected.has(p.studyId)?'checked':''}><span><strong>${esc(p.studyName)}</strong><small>${esc(p.studyId)}</small></span></label><div class="loaded-study-actions"><button class="btn btn-sm ${p.studyId===activeId?'btn-success':'btn-secondary'}" data-study-active="${esc(p.studyId)}">${p.studyId===activeId?'Ativo':'Usar na análise'}</button><button class="btn btn-danger btn-sm" data-study-clear-one="${esc(p.studyId)}"><i class="fa-solid fa-trash"></i></button></div></div>`).join('')}</div><div id="multi-study-comparison" class="mt-4"></div></div>`;
}

async function renderComparison(root,ids){
  const box=root.querySelector('#multi-study-comparison');if(!box)return;saveCompareIds(ids);
  if(ids.length<2){box.innerHTML='<div class="analysis-note"><strong>Selecione pelo menos dois estudos</strong> para habilitar a comparação multicoorte.</div>';return;}
  box.innerHTML='<div class="analysis-note"><i class="fa-solid fa-spinner fa-spin"></i> Comparando coortes carregadas…</div>';
  const rows=[];
  for(const id of ids.slice(0,5)){
    const dp=await loadDatapack(id).catch(()=>null);if(!dp)continue;let a=null;try{a=buildStudyAnalytics(dp);}catch{}const q=technicalReliability(dp,a);rows.push({dp,a,q});
  }
  box.innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>Coorte</th><th>Pacientes basais</th><th>Amostras basais de expressão</th><th>Eventos</th><th>DEGs</th><th>Mutações</th><th>Qualidade técnica</th></tr></thead><tbody>${rows.map(({dp,a,q})=>`<tr><td><strong>${esc(dp.pack.studyName)}</strong><br><small>${esc(dp.pack.studyId)}</small></td><td>${dp.pack.nPatients}</td><td>${dp.pack.nAnalysisSamples}</td><td>${a?.vectors?.nEvents??'—'}</td><td>${a?.dea?.nDEG??'—'}</td><td>${dp.pack.nMutationSamples||0}</td><td><span class="quality-badge ${q.className}">${q.label} · ${q.score}/100</span></td></tr>`).join('')}</tbody></table></div><p class="chart-note">Índice técnico = tamanho amostral + disponibilidade molecular + endpoint/eventos + integridade da seleção basal. Não representa sensibilidade, especificidade, acurácia clínica ou probabilidade de prognóstico.</p>`;
}

async function inspectSelected(root,studyId){
  if(!studyId)return;const box=root.querySelector('#study-inspection'),btn=root.querySelector('#inspect-study');btn.disabled=true;box.innerHTML='<div class="analysis-note"><i class="fa-solid fa-spinner fa-spin"></i> Verificando perfis moleculares, atributos clínicos e amostras…</div>';
  try{const x=await cbio.inspectStudy(studyId),c=x.capabilities;const score=[c.clinical,c.survival,c.mutation,c.expression].filter(Boolean).length;box.innerHTML=`<div class="inspection-grid"><div><span>Estudo</span><strong>${esc(x.study.name)}</strong></div><div><span>Amostras totais do estudo</span><strong>${Number(x.study.allSampleCount||x.samples.length).toLocaleString('pt-BR')}</strong></div><div><span>Clínico</span><strong class="${c.clinical?'ok':'bad'}">${c.clinical?'Disponível':'Ausente'}</strong></div><div><span>Sobrevida</span><strong class="${c.survival?'ok':'bad'}">${c.survival?'Disponível':'Limitada/ausente'}</strong></div><div><span>Mutações</span><strong class="${c.mutation?'ok':'bad'}">${c.mutation?'Disponível':'Ausente'}</strong></div><div><span>Expressão</span><strong class="${c.expression?'ok':'bad'}">${c.expression?esc(x.resolved.expression.name||x.resolved.expression.molecularProfileId):'Ausente'}</strong></div><div><span>Genoma</span><strong>${esc(x.study.referenceGenome||'Não informado')}</strong></div><div><span>Compatibilidade</span><strong>${score}/4 módulos</strong></div></div><p class="chart-note">Kaplan-Meier/Cox exigem endpoint + expressão alinhados; Volcano/Top DEGs exigem expressão + FIRST_EVENT. Ausência de um módulo reduz a qualidade técnica e desativa somente a análise dependente dele.</p>`;}catch(err){box.innerHTML=`<div class="alert danger"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(err.message||err)}</div>`;}finally{btn.disabled=false;}
}

async function startBuild(root,studyId,scope,onReady,simple=false){
  if(!studyId)return;if(scope==='completo'&&!confirm('O escopo completo pode baixar muitos dados e consumir bastante memória/rede. Deseja continuar?'))return;const btns=root.querySelectorAll('button'),bar=root.querySelector('[data-study-progress]'),log=root.querySelector('[data-study-log]');btns.forEach(b=>b.disabled=true);
  try{await buildDatapack({studyId,scope,onProgress:p=>{if(bar)bar.style.width=`${Math.max(0,Math.min(100,p.pct||0))}%`;if(log)log.textContent=`${p.msg||'Processando…'} (${p.pct||0}%)`;}});const dp=await loadDatapack(studyId);await renderStudyManager(root,{onReady,simple});onReady?.(dp);}catch(err){console.error(err);if(log)log.innerHTML=`<span style="color:var(--error)">Falha: ${esc(err.message||err)}</span>`;btns.forEach(b=>b.disabled=false);}
}

async function loadFive(root,lla,onReady,simple=false){
  if(!lla.length)return;if(!confirm('Carregar as cinco coortes no modo Expresso pode levar vários minutos e usar bastante rede/memória. Continuar?'))return;const bar=root.querySelector('[data-study-progress]'),log=root.querySelector('[data-study-log]'),btns=root.querySelectorAll('button');btns.forEach(b=>b.disabled=true);
  const failures=[];
  for(let i=0;i<lla.length;i++){
    const s=lla[i];try{await buildDatapack({studyId:s.studyId,scope:'expresso',onProgress:p=>{const overall=Math.round(((i+(p.pct||0)/100)/lla.length)*100);if(bar)bar.style.width=`${overall}%`;if(log)log.textContent=`${i+1}/${lla.length} · ${s.name}: ${p.msg||'Processando…'}`;}});}catch(err){failures.push(`${s.studyId}: ${err.message||err}`);}
  }
  await setActiveStudy(DEFAULT_LLA_STUDY).catch(()=>{});await renderStudyManager(root,{onReady,simple});onReady?.(await loadDatapack());if(failures.length)alert(`Alguns estudos não carregaram completamente:\n${failures.join('\n')}`);
}
