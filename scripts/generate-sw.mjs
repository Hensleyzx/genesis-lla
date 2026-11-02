import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (!fs.existsSync(dist)) {
  throw new Error('dist/ não existe. Execute o build do Vite antes de gerar o service worker.');
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const allowedRoot = new Set([
  'index.html', 'analise.html', 'resultados.html', 'resultados-r.html',
  'dashboard.html', 'bioinformatica.html', 'sobre.html',
  'manifest.webmanifest', 'favicon.svg'
]);

const precache = walk(dist)
  .map((file) => path.relative(dist, file).split(path.sep).join('/'))
  .filter((rel) => {
    if (allowedRoot.has(rel)) return true;
    if (rel.startsWith('assets/')) return true;
    if (rel.startsWith('icons/')) return true;
    return false;
  })
  .filter((rel) => rel !== 'sw.js')
  .map((rel) => `./${rel}`)
  .sort();

const version = String(pkg.version || 'dev').replace(/[^a-zA-Z0-9._-]/g, '-');
const sw = String.raw`/* GENESIS PWA — gerado automaticamente após o build. */
const VERSION = ${JSON.stringify(version)};
const PRECACHE = 'genesis-precache-' + VERSION;
const RUNTIME = 'genesis-runtime-' + VERSION;
const APP_SHELL = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('genesis-') && ![PRECACHE, RUNTIME].includes(key))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isApiRequest(url) {
  return url.origin !== self.location.origin ||
    /cbioportal|api\.cbioportal|cancer\.gov|gdc\.cancer\.gov/i.test(url.href);
}

function isScientificPayload(url) {
  return /\/(data|referencias)\//i.test(url.pathname) || /\.(csv|tsv|r|json)$/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Dados científicos externos/dinâmicos continuam network-only.
  if (isApiRequest(url) || isScientificPayload(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const network = await fetch(request);
        if (network.ok && url.origin === self.location.origin) {
          const cache = await caches.open(RUNTIME);
          cache.put(request, network.clone()).catch(() => {});
        }
        return network;
      } catch {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(request, { ignoreSearch: false });
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(RUNTIME);
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })());
  }
});
`;

fs.writeFileSync(path.join(dist, 'sw.js'), sw);
console.log(`[PWA] service worker gerado com ${precache.length} arquivos de shell (v${version}).`);
