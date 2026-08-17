import '../css/genesis.css';
import { mountLayout, injectFontAwesome, warningBanner } from './common.js';
import { PROJECT_INFO } from './data.js';
import { loadDatapack } from './datapack.js';
import { cbio } from './cbio-api.js';

function fmt(value){
  const n=Number(value);
  return Number.isFinite(n)?n.toLocaleString('pt-BR'):'—';
}

async function withTimeout(promise,ms=4500){
  let timer;
  try{
    return await Promise.race([
      promise,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('tempo limite excedido')),ms);})
    ]);
  }finally{
    clearTimeout(timer);
  }
}

async function init() {
  injectFontAwesome();
  mountLayout('inicio','Visão geral');
  document.getElementById('boot-fallback')?.remove();
  const content = document.getElementById('page-content');
  if (!content) throw new Error('Área principal da interface não foi criada.');

  let history=[];
  try{history=JSON.parse(localStorage.getItem('genesis_graph_history_v10')||'[]')}catch{}

  content.innerHTML=`
    ${warningBanner()}
    <section class="medical-hero">
      <div class="medical-hero__copy">
        <div class="medical-kicker"><i class="fa-solid fa-heart-pulse"></i> Bioinformática aplicada à LLA</div>
        <h1>Interpretação de biomarcadores com contexto de coortes públicas</h1>
        <p>${PROJECT_INFO.subtitle}</p>
        <div class="medical-hero__actions">
          <a href="analise.html" class="btn btn-primary btn-lg"><i class="fa-solid fa-user-doctor"></i> Analisar paciente</a>
          <a href="resultados.html" class="btn btn-secondary btn-lg"><i class="fa-solid fa-chart-line"></i> Estudos & gráficos</a>
          <a href="resultados-r.html" class="btn btn-ghost btn-lg"><i class="fa-solid fa-circle-check"></i> Resultado validado no R</a>
        </div>
        <div class="clinical-scope">
          <i class="fa-solid fa-shield-heart"></i>
          <div><strong>Uso acadêmico e de pesquisa.</strong><span>A análise do paciente compara dados informados com grupos de referência. Não substitui diagnóstico médico, laudo laboratorial ou decisão terapêutica.</span></div>
        </div>
      </div>
      <div class="medical-hero__visual" aria-hidden="true">
        <div class="monitor-card">
          <div class="monitor-card__top"><span>GENESIS / LLA</span><i class="fa-solid fa-dna"></i></div>
          <div class="pulse-line"><span></span></div>
          <div class="monitor-metrics">
            <div><span>Endpoint</span><strong>OS</strong></div>
            <div><span>Modelo</span><strong>Cox</strong></div>
            <div><span>Coorte</span><strong>Basal</strong></div>
          </div>
          <div class="monitor-note"><i class="fa-solid fa-microscope"></i> Pesquisa molecular orientada por evidências</div>
        </div>
      </div>
    </section>

    <div class="medical-stat-grid">
      <div class="medical-stat"><i class="fa-solid fa-database"></i><div><strong id="stat-catalog">—</strong><span>estudos no catálogo cBioPortal</span></div></div>
      <div class="medical-stat"><i class="fa-solid fa-ribbon"></i><div><strong id="stat-lla">—</strong><span>estudos LLA identificados</span></div></div>
      <div class="medical-stat"><i class="fa-solid fa-vials"></i><div><strong id="stat-cache">—</strong><span>amostras na coorte ativa</span></div></div>
      <div class="medical-stat"><i class="fa-solid fa-chart-simple"></i><div><strong>${fmt(history.length)}</strong><span>gráficos no histórico local</span></div></div>
    </div>

    <section class="care-path mt-6">
      <div class="section-heading">
        <span>Fluxo da plataforma</span>
        <h2>Do caso individual à evidência de referência</h2>
        <p>O GENESIS separa a entrada do paciente da exploração das coortes para deixar claro o que pertence ao caso e o que pertence aos estudos.</p>
      </div>
      <div class="care-path__grid">
        <a class="care-step" href="analise.html"><span class="care-step__num">01</span><i class="fa-solid fa-user-injured"></i><h3>Análise do paciente</h3><p>Informe dados clínicos, alterações e expressão dos biomarcadores. O sistema compara o caso com 1–5 coortes já carregadas.</p><b>Iniciar análise <i class="fa-solid fa-arrow-right"></i></b></a>
        <a class="care-step" href="resultados.html"><span class="care-step__num">02</span><i class="fa-solid fa-flask-vial"></i><h3>Estudos & gráficos</h3><p>Carregue estudos LLA, inspecione a coorte e gere Top 30, Kaplan–Meier, Cox, DEA e Volcano quando houver dados adequados.</p><b>Abrir estudos <i class="fa-solid fa-arrow-right"></i></b></a>
        <a class="care-step" href="dashboard.html"><span class="care-step__num">03</span><i class="fa-solid fa-file-medical"></i><h3>Histórico</h3><p>Consulte análises de pacientes e gráficos produzidos neste navegador, sempre separados por tipo de resultado e status científico.</p><b>Ver histórico <i class="fa-solid fa-arrow-right"></i></b></a>
      </div>
    </section>

    <section class="medical-info-grid mt-6">
      <article class="medical-info-card"><div class="medical-info-card__icon"><i class="fa-solid fa-filter"></i></div><div><h3>Coorte basal controlada</h3><p>Em TARGET, a seleção prioriza amostras basais e exclui recaída, xenoenxerto e normal da coorte analítica quando identificável.</p></div></article>
      <article class="medical-info-card"><div class="medical-info-card__icon"><i class="fa-solid fa-chart-area"></i></div><div><h3>Sobrevida com critérios mínimos</h3><p>Kaplan–Meier e Cox usam Overall Survival e só são calculados quando há tamanho amostral e eventos mínimos definidos na auditoria.</p></div></article>
      <article class="medical-info-card"><div class="medical-info-card__icon"><i class="fa-solid fa-code-compare"></i></div><div><h3>Exploratório ≠ validado no R</h3><p>Resultados calculados no navegador permanecem identificados como exploratórios. Saídas validadas contra o R são mostradas separadamente.</p></div></article>
    </section>`;

  const dpPromise=loadDatapack().catch(()=>null);
  const catalogPromise=withTimeout(cbio.listLlaStudies()).catch(()=>null);
  const [dp,catalog]=await Promise.all([dpPromise,catalogPromise]);
  const c=document.getElementById('stat-catalog');
  const l=document.getElementById('stat-lla');
  const a=document.getElementById('stat-cache');
  if(c)c.textContent=catalog?fmt(catalog.all.length):'offline';
  if(l)l.textContent=catalog?fmt(catalog.lla.length):'—';
  if(a)a.textContent=dp?fmt(dp.pack.nAnalysisSamples):'0';
}

init().catch((error) => {
  console.error('[GENESIS] Falha na inicialização:', error);
  const status = document.getElementById('boot-status');
  const fallback = document.getElementById('boot-fallback');
  if (fallback) fallback.style.display = 'flex';
  if (status) status.innerHTML = `<strong style="color:#ff7b72">Falha ao iniciar a interface.</strong><br><span style="font-size:13px">${String(error?.message || error)}</span>`;
});
