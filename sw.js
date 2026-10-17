// Versão web instalável (iPhone/navegador): guarda os arquivos grandes para abrir rápido e sem gastar internet.
// Código e páginas: sempre tenta a rede primeiro (atualização na hora); modelos e sons: usa o guardado e atualiza por trás.
const CACHE = 'ponte-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const grande = /\.(bin|png)$/.test(u.pathname);
  e.respondWith(caches.open(CACHE).then(async c => {
    const guardado = await c.match(e.request);
    const rede = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; });
    if (grande && guardado) { rede.catch(() => {}); return guardado; }
    return rede.catch(() => guardado || Response.error());
  }));
});
