// Plain-JS service worker: no bundler, no imports (registered as a classic
// script). Precaches the offline fallback, serves navigations network-first
// with that fallback, and turns push events into notifications.

const CACHE_NAME = 'tienda-shell-v1'
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isBypassed(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.endsWith('.supabase.co')
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (isBypassed(url)) return
  if (request.mode !== 'navigate') return

  event.respondWith(
    fetch(request).catch(() =>
      caches
        .match(OFFLINE_URL)
        .then((response) => response ?? Response.error()),
    ),
  )
})

/** True when `clientUrl` is already showing the page the push points at. */
function showsTarget(clientUrl, targetUrl) {
  try {
    const client = new URL(clientUrl)
    const target = new URL(targetUrl, client.origin)
    if (client.origin !== target.origin) return false
    const normalize = (path) => path.replace(/\/+$/, '') || '/'
    return normalize(client.pathname) === normalize(target.pathname)
  } catch {
    return false
  }
}

// Realtime and push must not both announce the same transition. The page the
// push points at is the page that already has a realtime subscription, so when
// a visible tab is on it the OS notification is dropped and that tab is told
// instead (the provider turns the message into a refresh). Every other case —
// no window, another page, a hidden tab — still gets the notification.
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    return
  }
  const { title, body, url, tag } = payload

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const watching = clients.filter(
          (client) =>
            client.visibilityState === 'visible' &&
            showsTarget(client.url, url),
        )
        if (watching.length > 0) {
          for (const client of watching) {
            client.postMessage({ type: 'push-suppressed', payload })
          }
          return undefined
        }
        return self.registration.showNotification(title, {
          body,
          data: { url },
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-96.png',
          tag,
        })
      }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (showsTarget(client.url, targetUrl) && 'focus' in client) {
            return client.focus()
          }
        }
        return self.clients.openWindow(targetUrl)
      }),
  )
})
