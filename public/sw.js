// Service worker: rende l'app utilizzabile senza rete.
// - Pagina: prima la rete (per ricevere gli aggiornamenti), poi la copia in cache.
// - File statici (JS/CSS con hash, icone): prima la cache, poi la rete.
// I dati dell'utente non passano mai da qui: restano in IndexedDB.
const CACHE = 'palestra-app-v1'
const SHELL = ['./', './index.html', './favicon.svg', './manifest.webmanifest', './icon-180.png', './icon-512.png']

const assetsOf = (html) => [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)].map((m) => `./${m[1]}`)

async function precache() {
  const cache = await caches.open(CACHE)
  await cache.addAll(SHELL)
  const html = await (await cache.match('./index.html')).text()
  await cache.addAll(assetsOf(html))
}

// Rimuove dalla cache i file statici delle versioni precedenti
async function prune(html) {
  const keep = new Set(assetsOf(html).map((a) => new URL(a, self.registration.scope).href))
  const cache = await caches.open(CACHE)
  for (const req of await cache.keys()) if (req.url.includes('/assets/') && !keep.has(req.url)) await cache.delete(req)
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(async (res) => {
          if (res.ok) {
            const html = await res.clone().text()
            const cache = await caches.open(CACHE)
            await cache.put('./index.html', res.clone())
            await cache.addAll(assetsOf(html)).catch(() => {})
            prune(html)
          }
          return res
        })
        .catch(async () => (await caches.match('./index.html')) ?? Response.error()),
    )
    return
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok && new URL(req.url).pathname.includes('/assets/')) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})
