import '../css/genesis.css';
import { mountLayout, injectFontAwesome, warningBanner } from './common.js';
import { PROJECT_INFO } from './data.js';

async function init() {
  injectFontAwesome();
  mountLayout('inicio','Visão geral');
  document.getElementById('boot-fallback')?.remove();
  const content = document.getElementById('page-content');
  if (!content) throw new Error('Área principal da interface não foi criada.');

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
          <a href="resultados-r.html" class="btn btn-ghost btn-lg"><i class="fa-solid fa-circle-check"></i> Resultados do R</a>
        </div>
        <div class="clinical-scope">
          <i class="fa-solid fa-shield-heart"></i>
          <div><strong>Uso acadêmico e de pesquisa.</strong><span>O sistema organiza o caso e compara informações com coortes públicas. Não substitui diagnóstico médico, laudo laboratorial, prognóstico clínico validado ou decisão terapêutica.</span></div>
        </div>
      </div>
      <div class="medical-hero__visual" aria-hidden="true">
        <div class="monitor-card">
          <div class="monitor-card__top"><span>GENESIS / LLA</span><i class="fa-solid fa-dna"></i></div>
          <div class="pulse-line"><span></span></div>
          <div class="monitor-metrics">
            <div><span>Endpoint</span><strong>OS</strong></div>
            <div><span>Modelo</span><strong>Cox</strong></div>
            <div><span>Contexto</span><strong>Coorte</strong></div>
          </div>
          <div class="monitor-note"><i class="fa-solid fa-microscope"></i> Pesquisa molecular orientada por evidências</div>
        </div>
      </div>
    </section>`;
}

init().catch((error) => {
  console.error('[GENESIS] Falha na inicialização:', error);
  const status = document.getElementById('boot-status');
  const fallback = document.getElementById('boot-fallback');
  if (fallback) fallback.style.display = 'flex';
  if (status) status.innerHTML = `<strong style="color:#ff7b72">Falha ao iniciar a interface.</strong><br><span style="font-size:13px">${String(error?.message || error)}</span>`;
});
