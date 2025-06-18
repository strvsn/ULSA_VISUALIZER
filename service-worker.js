const CACHE_NAME = 'ulsa-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './main.js',
  './windChart.js',
  './serial.js',
  './ui.js',
  './utils.js',
  './style.css',
  './manifest.json',
  './images/icon-192.png',
  './images/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // 個別にファイルをキャッシュして、失敗したファイルがあっても続行
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => {
              console.warn(`Failed to cache ${url}:`, err);
              return null;
            })
          )
        );
      })
      .catch(err => {
        console.error('Cache installation failed:', err);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
      .catch(err => {
        console.warn(`Fetch failed for ${event.request.url}:`, err);
        // フォールバック処理（必要に応じて）
        return new Response('Network error', { status: 503 });
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});
