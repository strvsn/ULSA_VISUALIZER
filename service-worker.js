const CACHE_NAME = 'ulsa-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/main.js',
  '/windChart.js',
  '/serial.js',
  '/ui.js',
  '/style.css',
  '/chart.js',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});
