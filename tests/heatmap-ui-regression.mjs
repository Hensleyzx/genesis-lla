import fs from 'node:fs';
const s = fs.readFileSync('src/js/resultados.js','utf8');
const must = [
  'Oncoprint mutacional basal — Top 30',
  'NÃO É O HEATMAP DEMOGRÁFICO',
  'Heatmap demográfico — genes × sexo/idade',
  'GRÁFICO PEDIDO PELO PROFESSOR',
  'PEDIDO DO PROFESSOR',
  "graphChoice('mutheat'",
  "graphChoice('demographic'",
  'Perfil demográfico e expressão'
];
for (const x of must) if (!s.includes(x)) throw new Error(`Regressão de interface: ausente ${x}`);
if (s.includes("if (el.value === 'mutheat') el.checked = false")) throw new Error('A interface não deve mais usar a geração automática antiga que manipulava o Oncoprint.');
console.log('heatmap-ui-regression OK');
