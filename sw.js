// Offline cache: app shell precached, data + audio cached the first time they are used.
const V = 'dk-v3';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'data/levels.js', 'data/a1.js', 'data/a2.js', 'data/b1.js', 'icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const isAsset = u.origin === location.origin || u.host.includes('fonts.g');
  if (!isAsset) return;
  const net = () => fetch(e.request).then(r => { if (r.ok) { const cl = r.clone(); caches.open(V).then(c => c.put(e.request, cl)); } return r; });
  // network-first for shell/data (so updates arrive), cache-first for audio + fonts
  if (u.pathname.includes('/audio/') || u.host.includes('fonts.g')) e.respondWith(caches.match(e.request).then(r => r || net()));
  else e.respondWith(net().catch(() => caches.match(e.request, { ignoreSearch: true })));
});
