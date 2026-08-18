import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chooseSampleList } from '../src/js/cbio-api.js';

const main=fs.readFileSync('src/js/main.js','utf8');
const analise=fs.readFileSync('src/js/analise.js','utf8');
const resultados=fs.readFileSync('src/js/resultados.js','utf8');
const datapack=fs.readFileSync('src/js/datapack.js','utf8');

// 1) Página inicial enxuta: remover os blocos que o professor considerou desnecessários.
assert.ok(!main.includes('medical-stat-grid'),'Página inicial não deve mais mostrar os quatro contadores.');
assert.ok(!main.includes('care-path'),'Página inicial não deve mais mostrar o fluxo em três cartões.');
assert.ok(!main.includes('medical-info-grid'),'Página inicial não deve repetir cartões informativos auxiliares.');
assert.match(main,/Analisar paciente/,'A ação principal de análise deve permanecer.');
assert.match(main,/Estudos & gráficos/,'A ação de estudos/gráficos deve permanecer.');

// 2) Médico + identificação profissional obrigatórios para salvar e analisar.
assert.match(analise,/Médico responsável \*/,'Campo de médico responsável deve estar marcado como obrigatório.');
assert.match(analise,/id="p-doctor" required aria-required="true"/,'Select do médico deve ser obrigatório.');
assert.match(analise,/CRM \/ identificação profissional \*/,'Identificação profissional deve estar marcada como obrigatória.');
assert.match(analise,/id="d-id" required aria-required="true"/,'Identificação profissional deve usar validação obrigatória no formulário.');
assert.match(analise,/Selecione o médico responsável para prosseguir/,'Execução deve bloquear análise sem médico.');
assert.match(analise,/não possui CRM\/identificação profissional/,'Execução deve bloquear médico sem identificação.');

// 3) O gráfico auxiliar O x E foi removido, mas o log-rank numérico e os dados auditáveis permanecem.
assert.ok(!resultados.includes('result-km-oe-'),'Canvas observado x esperado não deve existir mais.');
assert.ok(!resultados.includes("label:'Eventos observados'"),'Bar chart observado x esperado não deve ser instanciado.');
assert.match(resultados,/Log-rank<\/span><strong>χ²=/,'Resumo numérico do log-rank deve permanecer.');
assert.match(resultados,/logRank:\{chi2:.*O:s\.logRank\?\.O,E:s\.logRank\?\.E\}/s,'O/E devem permanecer no JSON para auditoria, sem gráfico visual.');

// 4) Cache invalidado porque o acoplamento perfil de expressão <-> case list mudou.
assert.match(datapack,/const DATA_VERSION = 11/,'Cache antigo deve ser invalidado após corrigir o case list de expressão.');
assert.match(datapack,/chooseSampleList\(lists,'rna',resolved\.expression\)/,'Datapack deve escolher o case list usando o perfil molecular selecionado.');

// 5) TARGET tem RNA-seq e microarray; RPKM precisa escolher o case list de RNA-seq.
const lists=[
  {sampleListId:'all_phase2_target_2018_pub_mrna',name:'Samples with mRNA data (Agilent microarray)',description:'Samples with mRNA expression data (301 samples)'},
  {sampleListId:'all_phase2_target_2018_pub_rna_seq_mrna',name:'Samples with mRNA data (RNA Seq)',description:'Samples with mRNA expression data (203 samples)'},
];
const rpkm={molecularProfileId:'all_phase2_target_2018_pub_rna_seq_mrna',name:'mRNA expression (RNA Seq RPKM)'};
const agilent={molecularProfileId:'all_phase2_target_2018_pub_mrna',name:'mRNA expression (Agilent microarray)'};
assert.equal(chooseSampleList(lists,'rna',rpkm)?.sampleListId,'all_phase2_target_2018_pub_rna_seq_mrna','Perfil RPKM deve usar as 203 amostras RNA-seq, não o case list Agilent.');
assert.equal(chooseSampleList(lists,'rna',agilent)?.sampleListId,'all_phase2_target_2018_pub_mrna','Perfil Agilent deve usar o case list de microarray correspondente.');

// 6) A interface deve distinguir a saída R original da análise basal deduplicada.
assert.match(resultados,/Modo compatível com referência R/,'O modo de referência deve ser rotulado como compatível, sem alegar reprodução integral.');
assert.match(resultados,/n representa observações de amostra, não necessariamente pacientes únicos/,'A interface não deve chamar 46\/46 automaticamente de pacientes únicos.');
assert.match(resultados,/Basal por paciente \(alternativa\)/,'Modo deduplicado deve ser apresentado como análise distinta.');

console.log('GENESIS V10.7.6 teacher-review regression tests: OK');
