// Flashy service worker.
//
// CACHE_NAME and SHELL_ASSETS are rewritten by vite.config.ts on every
// production build, so the precache list always matches the hashed Vite
// output and each deploy gets its own cache bucket.
const CACHE_NAME = 'flashy-dev'
const SHELL_ASSETS = ['/']

function openShellCache() {
  return caches.open(CACHE_NAME)
}

function matchShell(request) {
  return openShellCache().then((cache) => cache.match(request))
}

function saveToShell(request, response) {
  return openShellCache().then((cache) => cache.put(request, response))
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    openShellCache()
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

// App shell navigations are network-first so an online visit always picks up
// the newest deployment, and fall back to the cached shell while offline.
async function handleNavigation(event, request) {
  try {
    const response = await fetch(request)
    event.waitUntil(saveToShell(request, response.clone()))
    return response
  } catch {
    const cached = await matchShell(request)
    if (cached) return cached
    const shell = await matchShell('/index.html')
    if (shell) return shell
    return new Response('Flashy is unavailable offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

// Everything else same-origin is cache-first with a background refresh, so
// hashed assets keep working offline and get replaced once a new build ships.
async function handleAsset(event, request) {
  const cached = await matchShell(request)
  if (cached) {
    event.waitUntil(
      fetch(request)
        .then((response) => (response && response.ok ? saveToShell(request, response) : undefined))
        .catch(() => undefined)
    )
    return cached
  }

  const response = await fetch(request)
  if (response && response.ok) {
    event.waitUntil(saveToShell(request, response.clone()))
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event, request))
    return
  }

  event.respondWith(handleAsset(event, request))
})
