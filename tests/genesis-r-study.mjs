import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const base = path.join(root, 'public', 'data', 'genesis_r');
const read = (name) => fs.readFileSync(path.join(base, name), 'utf8');

function parseCsv(text) {
  const rows=[]; let row=[], field='', quote=false;
  for (let i=0;i<text.length;i++) {
    const ch=text[i];
    if (quote) {
      if (ch==='"' && text[i+1]==='"') { field+='"'; i++; }
      else if (ch==='"') quote=false;
      else field+=ch;
    } else {
      if (ch==='"') quote=true;
      else if (ch===',') { row.push(field); field=''; }
      else if (ch==='\n') { row.push(field.replace(/\r$/,'')); rows.push(row); row=[]; field=''; }
      else field+=ch;
    }
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/,'')); rows.push(row); }
  const headers=rows.shift();
  return rows.filter(r=>r.some(v=>v!=='')) .map(r=>Object.fromEntries(headers.map((h,i)=>[h,coerce(r[i]??'')])));
}
function coerce(v){const s=String(v);if(s==='')return '';const n=Number(s);return Number.isFinite(n)&&s.trim()!==''?n:s;}
const csv=(name)=>parseCsv(read(name));

const manifest = JSON.parse(read('manifest.json'));
assert.equal(manifest.id, 'genesis-r-target-all');
assert.equal(manifest.name, 'GENESIS-R — Estudo de Validação TARGET ALL');
assert.equal(manifest.study_id, 'all_phase2_target_2018_pub');
assert.equal(manifest.mutation_denominator, 150);
assert.equal(manifest.endpoint, 'OS (Sobrevida Global)');

const top30 = csv('top30_genes_mutados.csv');
assert.equal(top30.length, 30);
const nras = top30.find(r => r.Gene === 'NRAS');
const kras = top30.find(r => r.Gene === 'KRAS');
assert.deepEqual([nras.n_amostras, nras.freq_relativa], [16, 10.7]);
assert.deepEqual([kras.n_amostras, kras.freq_relativa], [8, 5.3]);

const clinical = csv('clinical_data.csv');
assert.equal(clinical.length, 1127);
assert.equal(new Set(clinical.map(r => r.PATIENT_ID).filter(Boolean)).size, 755);
assert.ok(clinical.some(r => r.OS_STATUS === '1:DECEASED'));

const dea = csv('DEA_results_relapse_vs_none.csv');
assert.equal(dea.length, 23405);
assert.equal(dea[0].gene, 'C9orf72');
assert.ok(Number(dea[0]['adj.P.Val']) < 1e-8);

const uni = csv('cox_univariado.csv');
assert.equal(uni.length, 10);
const c9 = uni.find(r => r.Gene === 'C9orf72');
assert.equal(c9.HR, 0.522);
assert.equal(c9.HR_lower, 0.345);
assert.equal(c9.HR_upper, 0.789);
assert.equal(c9.p_value, 0.002);

const multi = csv('cox_multivariado.csv');
assert.equal(multi.length, 9);
const mir = multi.find(r => r.Gene === 'MIR221');
assert.ok(Math.abs(mir.HR - 0.525299419692089) < 1e-12);
assert.ok(mir.p_value < 0.05);

for (const gene of manifest.km_genes) assert.ok(fs.existsSync(path.join(base, 'km', `${gene}.jpeg`)), `KM ausente: ${gene}`);
assert.ok(fs.existsSync(path.join(base, 'forest_cox_R_original.jpeg')));
assert.ok(fs.existsSync(path.join(base, 'top30_R_original.jpeg')));
assert.ok(fs.existsSync(path.join(root, 'public', 'referencias', 'GENESIS_R_Script_professor.R')));

const pageJs = fs.readFileSync(path.join(root, 'src', 'js', 'resultados-r.js'), 'utf8');
assert.match(pageJs, /GENESIS-R — Estudo de Validação TARGET ALL/);
assert.match(pageJs, /não redesenha estas curvas/i);
assert.match(pageJs, /cox_univariado\.csv/);
assert.match(pageJs, /DEA_results_relapse_vs_none\.csv/);

console.log('GENESIS-R study integrity: OK');
