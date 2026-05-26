/**
 * GarageOS Service Worker
 *
 * Strategy:
 *  - Navigation requests: network-first, fall back to /offline on failure
 *  - Static assets (JS/CSS/fonts/images): cache-first, populate on first fetch
 *  - API routes: always network-only (never cache auth-dependent responses)
 *
 * Push notifications: listener is wired up and ready.
 * To send a push from the server, POST to the Web Push API with your VAPID keys.
 * See: https://web.dev/push-notifications-overview/
 */

const CACHE_VERSION = 'garageos-v1'
const OFFLINE_URL   = '/offline'

const PRECACHE = [
  OFFLINE_URL,
  '/manifest.json',
]

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept API calls, NextAuth, or cross-origin requests
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.origin !== self.location.origin
  ) {
    return
  }

  // Static assets — cache-first
  if (/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|ico|webp|avif)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (!response.ok) return response
          const clone = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone))
          return response
        })
      })
    )
    return
  }

  // Navigation — network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r ?? new Response('Offline', { status: 503 }))
      )
    )
  }
})

// ─── Push notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = { title: 'GarageOS', body: '', tag: 'default', url: '/dashboard' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch { /* invalid JSON — use defaults */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag:   data.tag,
      data:  { url: data.url },
      dir:   'rtl',
      lang:  'he',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/dashboard'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find((c) => c.url.includes(targetUrl))
        return existing ? existing.focus() : clients.openWindow(targetUrl)
      })
  )
})
