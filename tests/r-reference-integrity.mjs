import assert from 'node:assert/strict';
import fs from 'node:fs';

const path='public/data/r_validated/top30_genes_mutados.json';
assert.ok(fs.existsSync(path),'Arquivo da referência R ausente');
assert.ok(fs.existsSync('public/fig1_top30_genes_R_original.jpeg'),'Figura R original ausente');
const data=JSON.parse(fs.readFileSync(path,'utf8'));
assert.equal(Number(data.n_samples),150);
assert.equal(data.status,'VALIDADO_NA_PRECISAO_EXIBIDA');
assert.equal(data.genes.length,30);
const expected=new Map([
  ['NRAS',10.7],['KRAS',5.3],['TP53',4],['PTPN11',4],['JAK2',4],['CREBBP',4],
  ['WHSC1',3.3],['FLT3',3.3],['CDK11A',3.3],['TAS2R19',2.7],['OVGP1',2.7],['NOTCH2',2.7],
  ['UBR4',2],['QRICH2',2],['KMT2D',2],['HLA-C',2],['DOT1L',2],['FCGBP',1.3],['FAM207A',1.3],
  ['EZH2',1.3],['ELL',1.3],['DSPP',1.3],['DNAH8',1.3],['CRLF2',1.3],['CHIT1',1.3],['CECR5',1.3],
  ['C10orf118',1.3],['ATF7IP',1.3],['APOE',1.3],['ACRC',1.3]
]);
for(const row of data.genes){
  assert.ok(expected.has(row.gene),`Gene inesperado na referência R: ${row.gene}`);
  assert.equal(Number(row.frequency_pct),expected.get(row.gene),`Frequência divergente: ${row.gene}`);
}
assert.equal(new Set(data.genes.map(x=>x.gene)).size,30,'Genes duplicados na referência R');
console.log('GENESIS V10.5 R-reference integrity tests: OK');
