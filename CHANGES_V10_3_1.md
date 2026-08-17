# GENESIS LLA V10.3.1 — correção GitHub Pages

- Vite passa a usar `base: './'`, gerando caminhos relativos para assets.
- A publicação deixa de depender do nome do repositório GitHub Pages.
- A página inicial mostra um boot/fallback visível em vez de fundo preto quando o JS não inicia.
- Erros de inicialização e promises rejeitadas passam a aparecer na tela/console.
- A interface básica é montada antes das consultas remotas do cBioPortal.
- Workflow GitHub Pages continua publicando `dist/`.
