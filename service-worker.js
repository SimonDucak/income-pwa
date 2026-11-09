const CACHE = 'income-shell-v2'
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon.svg',
  './css/styles.css',
  './js/calculations.js',
  './js/database.js',
  './js/app.js',
  './vendor/sql-wasm-inline.js',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put('./index.html', response.clone()))
      return response
    }).catch(async () => (await caches.match(request)) || (await caches.match('./index.html'))))
    return
  }

  const staticAsset = ['script', 'style', 'image', 'font'].includes(request.destination) || url.pathname.endsWith('.wasm')
  if (!staticAsset) return
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()))
    return response
  })))
})
