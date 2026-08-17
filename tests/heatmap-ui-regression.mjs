import fs from 'node:fs';
const s = fs.readFileSync('src/js/resultados.js','utf8');
const must = [
  'Oncoprint mutacional basal — Top 30',
  'NÃO É O HEATMAP DEMOGRÁFICO',
  'Heatmap demográfico — genes × sexo/idade',
  'GRÁFICO PEDIDO PELO PROFESSOR',
  "if (el.value === 'mutheat') el.checked = false",
  'PEDIDO DO PROFESSOR'
];
for (const x of must) if (!s.includes(x)) throw new Error(`Regressão de interface: ausente ${x}`);
console.log('heatmap-ui-regression OK');
