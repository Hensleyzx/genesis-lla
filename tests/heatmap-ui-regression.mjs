import fs from 'node:fs';
const s = fs.readFileSync('src/js/resultados.js','utf8');
const must = [
  'Mapa de mutações',
  'NÃO É O HEATMAP DEMOGRÁFICO',
  'Heatmap demográfico — genes × sexo/idade',
  'Expressão por sexo e idade',
  'OUTRAS ANÁLISES',
  'data-run-analysis="mutheat"',
  'data-run-analysis="demographic"',
  'Expressão por sexo e idade'
];
for (const x of must) if (!s.includes(x)) throw new Error(`Regressão de interface: ausente ${x}`);
if (s.includes("if (el.value === 'mutheat') el.checked = false")) throw new Error('A interface não deve mais usar a geração automática antiga que manipulava o Oncoprint.');
console.log('heatmap-ui-regression OK');
