'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker (/public/sw.js) for offline support and
 * push notification capability.
 *
 * Renders nothing — drop this anywhere inside the root layout's <body>.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[SW] Registered. Scope:', reg.scope)
        }

        // Check for waiting update; prompt user to refresh if needed
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // A new version is available — optionally show a toast here
              if (process.env.NODE_ENV === 'development') {
                console.log('[SW] New version available. Refresh to update.')
              }
            }
          })
        })
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[SW] Registration failed:', err)
        }
      })
  }, [])

  return null
}
