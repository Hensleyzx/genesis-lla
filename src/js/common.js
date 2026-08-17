import { PROJECT_INFO } from './data.js';

const NAV_ITEMS = [
  { href: 'index.html', icon: 'fa-house', label: 'Início', page: 'inicio' },
  { href: 'analise.html', icon: 'fa-user-doctor', label: 'Análise do Paciente', page: 'analise' },
  { href: 'resultados.html', icon: 'fa-chart-line', label: 'Estudos & Gráficos', page: 'resultados' },
  { href: 'resultados-r.html', icon: 'fa-flask-vial', label: 'GENESIS-R', page: 'genesis-r' },
  { href: 'dashboard.html', icon: 'fa-clock-rotate-left', label: 'Histórico', page: 'dashboard' },
  { href: 'sobre.html', icon: 'fa-circle-info', label: 'Sobre o Projeto', page: 'sobre' },
];

const THEME_KEY = 'genesis_theme';

export function getTheme() {
  return document.documentElement.dataset.theme || localStorage.getItem(THEME_KEY) || 'dark';
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  updateThemeButton(theme);
  window.dispatchEvent(new CustomEvent('genesis:themechange', { detail: { theme } }));
}

function updateThemeButton(theme) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i><span>Claro</span>' : '<i class="fa-solid fa-moon"></i><span>Escuro</span>';
  btn.title = theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro';
}

export function getChartTheme() {
  const s = getComputedStyle(document.documentElement);
  return {
    text: s.getPropertyValue('--text-secondary').trim() || '#a9b4d0',
    muted: s.getPropertyValue('--text-muted').trim() || '#6b7794',
    grid: s.getPropertyValue('--chart-grid').trim() || 'rgba(70,90,130,.18)',
    card: s.getPropertyValue('--bg-card').trim() || '#141c3a',
    primary: s.getPropertyValue('--primary').trim() || '#2e7ff0',
  };
}

export function renderLayout(activePage, headerTitle) {
  const navHtml = NAV_ITEMS.map((item) => `
    <a href="${item.href}" class="nav-item ${item.page === activePage ? 'active' : ''}">
      <i class="fa-solid ${item.icon}"></i><span>${item.label}</span>
    </a>`).join('');

  return {
    sidebarHtml: `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar__brand">
          <div class="sidebar__logo"><i class="fa-solid fa-dna"></i></div>
          <div class="sidebar__brand-text"><h1>GENESIS</h1><span>LLA · Medicina de Precisão</span></div>
        </div>
        <nav class="sidebar__nav"><div class="sidebar__section">Navegação</div>${navHtml}</nav>
        <div class="sidebar__footer"><strong>${PROJECT_INFO.school}</strong><br>${PROJECT_INFO.event}</div>
      </aside><div class="sidebar-backdrop" id="sidebar-backdrop"></div>`,
    headerHtml: `
      <header class="header">
        <div class="header__title"><button class="menu-toggle" id="menu-toggle" aria-label="Menu"><i class="fa-solid fa-bars"></i></button><h2>${headerTitle}</h2><span class="badge">LLA · pesquisa</span></div>
        <div class="header__right">
          <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Alternar tema"></button>
          <div class="header__status"><span class="status-dot"></span><span>Ambiente acadêmico ativo</span></div>
          <div class="header__user"><div class="header__avatar"><i class="fa-solid fa-microscope"></i></div><div class="header__user-info"><span class="name">GENESIS</span><span class="role">Bioinformática em LLA</span></div></div>
        </div>
      </header>`,
  };
}

export function mountLayout(activePage, headerTitle) {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.dataset.theme = saved;
  const { sidebarHtml, headerHtml } = renderLayout(activePage, headerTitle);
  const shell = document.createElement('div');
  shell.className = 'app-shell';
  shell.innerHTML = `${sidebarHtml}<div class="main-area">${headerHtml}<main class="content" id="page-content"></main></div>`;
  document.body.appendChild(shell);
  document.getElementById('boot-fallback')?.remove();

  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  document.getElementById('menu-toggle')?.addEventListener('click', () => { sidebar.classList.add('open'); backdrop.classList.add('active'); });
  backdrop?.addEventListener('click', () => { sidebar.classList.remove('open'); backdrop.classList.remove('active'); });
  document.getElementById('theme-toggle')?.addEventListener('click', () => applyTheme(getTheme() === 'dark' ? 'light' : 'dark'));
  updateThemeButton(saved);
}

export function warningBanner() {
  return `<div class="academic-warning"><i class="fa-solid fa-triangle-exclamation"></i><p><strong>Aviso:</strong> ${PROJECT_INFO.warning}</p></div>`;
}


function graphReportEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

export function graphReport({
  title = 'Mini-laudo do gráfico',
  what = '',
  finding = '',
  caution = 'Interpretação acadêmica/exploratória; não substitui laudo, diagnóstico ou decisão clínica.',
  source = 'GENESIS',
} = {}) {
  const row = (icon, label, text) => text ? `
    <div class="graph-report__row">
      <i class="fa-solid ${icon}"></i>
      <div><span>${graphReportEscape(label)}</span><p>${graphReportEscape(text)}</p></div>
    </div>` : '';
  return `
    <aside class="graph-report" aria-label="${graphReportEscape(title)}">
      <div class="graph-report__head">
        <div><i class="fa-solid fa-file-waveform"></i><strong>${graphReportEscape(title)}</strong></div>
        <span>${graphReportEscape(source)}</span>
      </div>
      ${row('fa-circle-info', 'O que é', what)}
      ${row('fa-magnifying-glass-chart', 'Leitura deste resultado', finding)}
      ${row('fa-shield-heart', 'Limite', caution)}
    </aside>`;
}

export function injectFontAwesome() {
  if (document.querySelector('link[data-fa]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
  link.setAttribute('data-fa', 'true');
  document.head.appendChild(link);
}
