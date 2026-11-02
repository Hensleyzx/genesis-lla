import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const htmlFiles=['index.html','analise.html','resultados.html','resultados-r.html','dashboard.html','bioinformatica.html','sobre.html'];

for(const file of htmlFiles){
  const full=path.join(root,file);
  assert.ok(fs.existsSync(full),`HTML ausente: ${file}`);
  const html=fs.readFileSync(full,'utf8');
  const scripts=[...html.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/g)].map(m=>m[1]);
  assert.equal(scripts.length,1,`${file} deve ter exatamente um entrypoint module`);
  const rel=scripts[0].replace(/^\.\//,'');
  assert.ok(!rel.startsWith('/'),`${file}: entrypoint absoluto quebra deploy fora da raiz`);
  assert.ok(fs.existsSync(path.join(root,rel)),`${file}: entrypoint inexistente ${rel}`);
  assert.ok(!/href=["']\/favicon\.svg/.test(html),`${file}: favicon absoluto`);
  assert.ok(html.includes('id="boot-fallback"'),`${file}: fallback de inicialização ausente`);
  assert.ok(html.includes('unhandledrejection'),`${file}: diagnóstico de falha de módulo ausente`);
}

const vite=fs.readFileSync(path.join(root,'vite.config.ts'),'utf8');
assert.match(vite,/const base = process\.env\.VITE_BASE_PATH \|\| '\.\/';/,'Vite deve usar base relativa por padrão');

const common=fs.readFileSync(path.join(root,'src/js/common.js'),'utf8');
assert.match(common,/Análise do Paciente/,'Navegação deve expor o módulo do paciente');
assert.match(common,/Estudos & Gráficos/,'Navegação deve separar estudos do caso individual');

const patient=fs.readFileSync(path.join(root,'src/js/analise.js'),'utf8');
assert.match(patient,/analyzePatient/,'Tela de paciente deve chamar o motor de análise');
assert.match(patient,/id="run-patient-analysis"/,'Botão de análise do paciente ausente');
assert.match(patient,/Baixar relatório TXT/,'Exportação de relatório do paciente ausente');


// Todos os imports relativos JavaScript/CSS devem apontar para arquivos existentes.
for(const jsFile of fs.readdirSync(path.join(root,'src/js')).filter(x=>x.endsWith('.js'))){
  const full=path.join(root,'src/js',jsFile);
  const text=fs.readFileSync(full,'utf8');
  for(const m of text.matchAll(/(?:from\s+|import\s*)["'](\.{1,2}\/[^"']+)["']/g)){
    const target=path.resolve(path.dirname(full),m[1]);
    assert.ok(fs.existsSync(target),`${jsFile}: import relativo inexistente ${m[1]}`);
  }
}

const existing=new Set(htmlFiles);
for(const jsFile of fs.readdirSync(path.join(root,'src/js')).filter(x=>x.endsWith('.js'))){
  const text=fs.readFileSync(path.join(root,'src/js',jsFile),'utf8');
  for(const m of text.matchAll(/href=["'`]([^"'`]+\.html)(?:[?#][^"'`]*)?["'`]/g)){
    const target=path.basename(m[1]);
    assert.ok(existing.has(target),`${jsFile}: rota HTML inexistente ${target}`);
  }
}

console.log('GENESIS V10.5 site integrity tests: OK');

// PWA V10.8.0: manifest, ícones, instalação e geração do service worker.
const manifestPath=path.join(root,'public','manifest.webmanifest');
assert.ok(fs.existsSync(manifestPath),'Manifest PWA ausente.');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
assert.equal(manifest.display,'standalone','PWA deve abrir em modo standalone.');
assert.equal(manifest.start_url,'./index.html','start_url PWA deve ser relativo para GitHub Pages.');
assert.equal(manifest.scope,'./','scope PWA deve ser relativo para GitHub Pages.');
assert.ok(manifest.icons.some(i=>i.sizes==='192x192'),'Ícone PWA 192x192 ausente.');
assert.ok(manifest.icons.some(i=>i.sizes==='512x512' && String(i.purpose).includes('maskable')),'Ícone PWA 512/maskable ausente.');
for(const file of htmlFiles){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  assert.match(html,/rel="manifest" href="\.\/manifest\.webmanifest"/i,`${file}: link do manifest ausente.`);
  assert.match(html,/apple-touch-icon/i,`${file}: apple-touch-icon ausente.`);
}
assert.ok(fs.existsSync(path.join(root,'public','icons','icon-192.png')),'Ícone PWA 192 ausente.');
assert.ok(fs.existsSync(path.join(root,'public','icons','icon-512.png')),'Ícone PWA 512 ausente.');
assert.ok(fs.existsSync(path.join(root,'scripts','generate-sw.mjs')),'Gerador de service worker ausente.');
assert.match(common,/beforeinstallprompt/,'Fluxo de instalação PWA ausente.');
assert.match(common,/serviceWorker\.register\('\.\/sw\.js'/,'Registro do service worker deve ser relativo.');
assert.match(common,/Modo offline · dados locais/,'Estado offline deve ser explícito.');
const swGenerator=fs.readFileSync(path.join(root,'scripts','generate-sw.mjs'),'utf8');
assert.match(swGenerator,/isApiRequest/,'SW deve distinguir APIs externas.');
assert.match(swGenerator,/isScientificPayload/,'SW deve evitar cache silencioso de payload científico.');
const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
assert.match(packageJson.scripts.build,/generate-sw\.mjs/,'Build deve gerar o service worker após o Vite.');
console.log('GENESIS V10.8.0 PWA integrity checks: OK');
