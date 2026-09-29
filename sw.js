// Servis çalışanı: uygulama dosyalarını ve görülen afişleri saklar; internet yokken arşivin açılmasını sağlar.
// Not: index.html'e yeni bir dosya (js/css/img) eklenirse aşağıdaki APP_FILES listesine de ekle.

const APP_CACHE = 'arsiv-uygulama';
const IMAGE_CACHE = 'arsiv-afisler';
const MAX_IMAGES = 300; // saklanacak en fazla afiş sayısı (fazlası eskiden başlayarak silinir)
const NETWORK_TIMEOUT = 4000; // internet 4 saniyede cevap vermezse saklanan sürüm açılır

const APP_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/storage.js',
  'js/theme.js',
  'js/config.js',
  'js/tmdb.js',
  'js/omdb.js',
  'js/discover.js',
  'js/diary.js',
  'js/stats.js',
  'js/lists.js',
  'js/profile.js',
  'js/share.js',
  'js/app.js',
  'js/backup.js',
  'js/pwa.js',
  'img/logo.jpg',
  'img/icon-64.png',
  'img/icon-180.png'
];

// Kurulumda dosyaları önceden sakla. Biri (ör. sadece bilgisayarda olan js/config.js) bulunamazsa diğerleri yine saklanır.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await Promise.allSettled(APP_FILES.map(file => cache.add(new Request(file, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (url.hostname === 'image.tmdb.org') {
    event.respondWith(cacheFirstImage(request));
  }
  // Diğer her şey (TMDB/OMDb verisi, YouTube) doğrudan internetten gelir; saklanmaz
});

// Uygulama dosyaları: internet varken hep en yenisi alınır (ve saklanır); yoksa ya da yavaşsa saklanan sürüm açılır
async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetchWithTimeout(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // Sayfa açılışı istendiyse ana sayfayı ver (adres sonundaki #… zaten sunucuya gitmez)
    if (request.mode === 'navigate') {
      const home = (await cache.match('./')) || (await cache.match('index.html'));
      if (home) return home;
    }
    return Response.error();
  }
}

function fetchWithTimeout(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT);
  return fetch(request, { cache: 'no-cache', signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Afişler: bir kez görüldüyse saklanandan gelir (hem hızlı hem çevrimdışı çalışır)
async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;
  try {
    // "cors" ile istenir: tuvalde kullanılabilir olur ve saklama kotası şişmez (opak yanıtlar çok yer sayılır)
    const response = await fetch(request.url, { mode: 'cors' });
    if (response.ok) {
      await cache.put(request.url, response.clone());
      trimImages(cache);
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function trimImages(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_IMAGES))) await cache.delete(key);
}
