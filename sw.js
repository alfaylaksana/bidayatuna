// Service worker Ekosistem Bidayatuna — saat ini hanya mencakup folder maktabah/
// Letak file: root repo (sejajar dengan folder maktabah/)
// Naikkan angka versi ini kalau ingin memaksa cache lama dibuang.
const CACHE = 'bidayatuna-maktabah-v1';
const SCOPE = self.registration.scope;               // .../bidayatuna/maktabah/
const PRECACHE = [SCOPE, SCOPE + 'index.html'];
const NAV_TIMEOUT = 4000;                            // ms, sebelum jatuh ke cache

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Halaman: utamakan jaringan (supaya update langsung terlihat), cache sebagai cadangan.
async function halamanJaringanDulu(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NAV_TIMEOUT))
    ]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    return hit || cache.match(SCOPE + 'index.html') || Response.error();
  }
}

// Library Firebase dari gstatic: URL-nya berversi, jadi aman diutamakan dari cache.
async function cacheDulu(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin && req.mode === 'navigate') {
    e.respondWith(halamanJaringanDulu(req));
  } else if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(cacheDulu(req));
  }
  // Selain itu (Firestore, Auth, dll.) tidak disentuh.
});
