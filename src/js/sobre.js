import '../css/genesis.css';
import { mountLayout, injectFontAwesome, warningBanner } from './common.js';
import { PROJECT_INFO } from './data.js';

injectFontAwesome();
mountLayout('sobre', 'Sobre o Projeto');
const content=document.getElementById('page-content');
content.innerHTML=`
${warningBanner()}
<section class="about-hero"><span class="hero__badge"><i class="fa-solid fa-dna"></i> Protótipo Acadêmico · LLA</span><h1>${PROJECT_INFO.name}</h1><p>${PROJECT_INFO.subtitle}</p></section>
<div class="about-grid">
  <div class="card about-section"><h3>Objetivo</h3><p>Organizar dados públicos e resultados bioinformáticos relacionados à Leucemia Linfoblástica Aguda em uma interface acadêmica simples, com foco em rastreabilidade e comparação com saídas produzidas pelo código R do projeto.</p></div>
  <div class="card about-section"><h3>Fluxo atual</h3><p>O módulo <strong>Análise do Paciente</strong> recebe dados clínicos e biomarcadores e compara o caso com até cinco coortes já carregadas. Em <strong>Estudos & Gráficos</strong>, o usuário escolhe/carrega estudos LLA e gera somente os gráficos desejados.</p></div>
  <div class="card about-section"><h3>Validação gráfico a gráfico</h3><p>Um resultado só recebe o selo “validado contra R” quando os números vêm de uma saída R correspondente e são conferidos. Resultados calculados localmente no navegador permanecem marcados como exploratórios.</p></div>
  <div class="card about-section"><h3>Dados e coortes</h3><p>O GENESIS mostra estudo, número de pacientes/amostras e filtros usados para evitar comparar resultados de coortes diferentes como se fossem a mesma execução.</p></div>
  <div class="card about-section"><h3>Limite científico</h3><p>O módulo do paciente produz uma síntese exploratória de associações e perfis semelhantes. Curvas de Kaplan-Meier descrevem grupos de referência; o sistema não as converte em probabilidade individual, não emite diagnóstico clínico e não recomenda tratamento.</p></div>
  <div class="card about-section"><h3>Tecnologias</h3><p>${PROJECT_INFO.technologies.join(' · ')}</p></div>
</div>
<div class="card mt-6"><div class="card__title"><i class="fa-solid fa-users"></i> Autores</div><div class="authors">${PROJECT_INFO.authors.map(a=>`<div class="author-card"><div class="author-card__avatar">${a.initials}</div><div class="author-card__info"><div class="name">${a.name}</div><div class="role">Estudante · Pesquisador</div></div></div>`).join('')}</div></div>`;
